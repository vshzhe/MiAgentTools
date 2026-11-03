## Why

用户诉求 2（自动实现委托门与重复确认）在本变更承接的部分是**门账本缺失**与**相邻确认面重复**：

- **委派参数是纯文本，被委派方无法证明父级已确认**：`renderDelegate` 只把 `gate-skip=...` 渲染进提示文本（`src/core/host-orchestration/actions.ts:41-53`、`:64-86`），`Receipt` 没有任何门字段（`src/core/host-orchestration/protocol.ts:245-257`）。参数在宿主间丢失（或模型未原样传递）时，`iagent_spec_apply` 的 Step 5.5 设计确认门会**再次**触发（`src/core/templates/workflows/spec-apply.ts:364-414`，N17→N18），用户被迫对同一次设计确认两次表态。
- **重复确认既不可检测也不可审计**：链路 B 的 N18 在代码里没有可观测证据 —— `delegation-contract.ts:73-127` 只在解析期对未知 gate id 记 WARN，`protocol.ts:233-257` 的回执只有 `phase` / `status` / `artifact` / `nextAllowed` / `failure` / `requirementDocStatus`，没有任何「已确认门」的跨阶段记录。
- **相邻两次停点**：`iagent_workflow` 在验证收束后停一次需求文档桥（`workflow.ts:100-107`，N14），紧接着又在实现桥停一次（`workflow.ts:352-359`，N15）—— 两次停点之间没有用户可感知的决策差异，属同一阶段内的确认面重复。
- **协议与模板已存在同类漂移前提**：`workflow` 的 VERIFY 阶段显式声明 `requirement-doc-bridge`（`workflows.ts:77-80`、`:189`），且规范要求「`workflow` 的 VERIFY 阶段 SHALL 同样声明该门」（`openspec/specs/host-orchestration/spec.md:484-488`）。若把文档选项并入交付桥而不调整该声明，协议门清单与模板正文将再次不一致。

## What Changes

- **门账本（gate ledger）**：变更级 handoff 包新增 `## 已确认门` 段（与既有六节并列，六节语义不变），记录父级已确认的门 id；`gate-skip` 仍是主通道，账本是参数丢失时的兜底。
- **阶段回执新增 `confirmedGates`**：`Receipt` 增加可选字段 `confirmedGates: string[]`，`validateReceipt` 校验其形状与取值（非数组 / 非字符串元素 / 未知门 id / 空串 → 校验失败，按 `invalid-receipt` 阻断推进，MUST NOT 静默忽略）。
- **写入门槛（U4 结论）**：父级在门确认后**立即**写账本，**委派前校验存在**；写入或校验失败 → 停止，MUST NOT 委派（fail-safe，禁止「无账本也无参数」的静默跳过）。回执是账本的上游真源：账本条目 MUST NOT 超出回执声明的 `confirmedGates`；不一致（伪造 / 过期）→ WARN 且视为**未确认**。
- **apply 的 Step 5.5 增加门账本读取**：降级链为「`gate-skip`（主通道）→ handoff 包 `## 已确认门`（兜底）→ 无」；两者皆缺失时 Step 5.5 MUST 照常执行（不静默跳过），账本条目过期 / 与回执不一致时 WARN 并视为未确认。
- **workflow 交付桥合并**：`requirement-doc-bridge` 并入 `implementation-bridge`，一次「交付桥」呈现「实现方案 + 测试计划预告 + 是否生成需求文档」；「仅生成文档」出口停在规划边界（状态 `generated`）。
- **协议声明调整（U8 结论）**：`WORKFLOW_PROTOCOLS.workflow` 的 VERIFY 阶段不再声明 `requirement-doc-bridge`，文档选项由 APPLY 的 `implementation-bridge` 承载；`requirement-doc-bridge` 锚点保留给 auto-workflow / debug；`GATE_WHITELIST` 5 类与锚点集合仍不变。
- **auto-workflow 接账本**：文档桥仍是其唯一流程级阻塞门；桥收束后写 `design-confirmation` 到账本并在委派前校验，`gate-skip` 继续随委派传递（主通道），两者皆缺失时被委派 apply 的设计门照常触发。
- **同步面**：`spec-apply.ts`（Step 5.5）、`workflow.ts`（3.5 / 3.7 合并为交付桥）、`auto-workflow.ts`（3.3 / 4.1 接账本）、`DELEGATION_PARAMETERS` 注释与委派正文同源同值（不新增第三参数键，账本路径由 change-name 确定性派生）。

## Capabilities

### New Capabilities

- 无（本变更全部为既有能力的契约扩展与确认面合并）

### Modified Capabilities

- `host-orchestration`: 新增门账本与回执 `confirmedGates` 契约（载体、写入门槛、主通道关系、不一致处置、回执校验）；修改 `auto-workflow 协议阶段门与模板声明一致`（`workflow` 的 VERIFY 不再声明 `requirement-doc-bridge`，由 APPLY 的 `implementation-bridge` 承载文档选项；5 类白名单与锚点集合不变）。
- `spec-workflow-skills`: 新增 handoff 包 `## 已确认门` 账本段契约（与六节并列、只记录门 id 与确认阶段、跨阶段只读）；修改 `spec-apply 门承载参数契约`（`gate-skip` → 账本 → 无 的降级链、账本缺失时 Step 5.5 仍执行、账本与回执不一致时视为未确认）。
- `workflow-suite-skills`: 修改 `实现桥合并（实现确认 + 测试计划）`（并入需求文档桥为单一「交付桥」，含「仅生成文档」规划边界出口）、`workflow 实现桥承载 apply 设计门`（委派前写账本并校验存在、回执携带 `confirmedGates`）、`auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议`（文档桥后写账本，`gate-skip` 缺失时账本兜底）。

## Impact

### 直接影响的文件

- `src/core/host-orchestration/protocol.ts`: `Receipt`（`:245-257`）增加 `confirmedGates?: string[]`；`validateReceipt`（`:274-296`）增加形状 / 取值校验；新增门账本常量（`CONFIRMED_GATES_FIELD`、段名）并导出。
- `src/core/host-orchestration/gate-ledger.ts`（**新建**）: `GATE_LEDGER_SECTION` / `gateLedgerPath(changeName)` / `parseGateLedger(markdown)` / `renderGateLedgerEntry`。解析复用 `delegation-contract.ts` 的 warn/ignore 语义（未知门 id 忽略并 WARN），MUST NOT 另立第二份门 id 取值表。
- `src/core/host-orchestration/workflows.ts`: `VERIFY_WITH_BRIDGE`（`:77-80`）在 `workflow` 协议中不再使用 —— `workflow` 的 VERIFY 退回 `VERIFY_PHASE`（无门），auto-workflow 继续使用 `VERIFY_WITH_BRIDGE`；`WORKFLOW_PROTOCOLS`（`:186-204`）随之调整；`APPLY_PHASE.handoff`（`:83-91`）增加 `confirmedGates`。
- `src/core/host-orchestration/transition.ts`: `evaluatePhaseTransition`（`:68-115`）的回执分支注释与 WARN 文案同步「`confirmedGates` 非法 → `invalid-receipt`」（判定逻辑不改）。
- `src/core/host-orchestration/render.ts`: `DELEGATION_PARAMETERS`（`:113-126`）注释声明「账本通道不走参数表，路径由 change-name 派生」；MUST NOT 新增参数键。
- `src/core/host-orchestration/actions.ts`: `renderOptions`（`:41-54`）保持只渲染 `mode` / `gate-skip` 两轴；不因账本新增渲染分支。
- `src/core/templates/workflows/spec-apply.ts`: Step 5.5（`:364-414`）增加账本读取与降级链；handoff 包六节列表（`:19-33`）加入 `## 已确认门` 并列说明。
- `src/core/templates/workflows/workflow.ts`: 3.5（`:86-128`）与 3.7（`:352-359`）合并为交付桥；Phase 4 委派段（`:362-370`）增加委派前写账本并校验存在、回执携带 `confirmedGates`。
- `src/core/templates/workflows/auto-workflow.ts`: 3.3（`:94-100`）文档桥收束后写账本；4.1（`:110-129`）委派前校验账本存在，`gate-skip` 与账本双通道表述。
- `skills/iagent-{spec-apply,workflow,auto-workflow}/SKILL.md` 及配对指令版: 生成快照重建（`pnpm build && pnpm generate:skills`）。

### 调用方（CodeGraph 实测）

- `WORKFLOW_PROTOCOLS`（`src/core/host-orchestration/workflows.ts:186`）：4 个调用方（`index.ts` 导出、`workflows.ts` 自身的 `getWorkflowProtocol` / `auditGateWhitelistAlignment`）；测试 `test/host-orchestration.test.ts:818-877`（含 `workflow` verify 声明文档桥的断言 `:831-843`、门预算 `:869-878`）、`test/spec-workflow-contract.test.ts`。
- `validateReceipt`（`src/core/host-orchestration/protocol.ts:274`）：4 个调用方（`transition.ts:104`、`index.ts` 导出）；测试 `test/host-orchestration.test.ts:50-73`、`:490-495`、`test/spec-workflow-contract.test.ts`。
- `evaluatePhaseTransition`（`src/core/host-orchestration/transition.ts:68`）：4 个调用方（`src/core/host-orchestration/index.ts` 导出）；测试 `test/host-orchestration.test.ts`、`test/spec-workflow-contract.test.ts`。
- `renderOptions`（`src/core/host-orchestration/actions.ts:41`）：1 个调用方（`actions.ts:70` 的 `renderDelegate`）；经 `renderDelegate` 被 `test/claude-host-adapter.test.ts` / `test/host-orchestration.test.ts:743-754` 覆盖。
- `DELEGATION_PARAMETERS`（`src/core/host-orchestration/render.ts:113`）：3 个调用方（`index.ts` 导出、`render.ts` 的 `renderHostOrchestrationSection`）；测试 `test/host-orchestration.test.ts:1008-1020`（断言参数表与模板正文一致）。
- `GATE_WHITELIST`（`src/core/host-orchestration/protocol.ts:94`）：经 `PHASE_GATE_CATEGORY` / `auditGateWhitelistAlignment` 被 `transition.ts` 与生成期测试消费；测试 `test/host-orchestration.test.ts:845-851`。

### 向后兼容

- **回执新增字段为可选**：`confirmedGates` 不进入 `DEFAULT_RECEIPT_FIELDS`，缺省即「无账本」→ 门照常触发（fail-safe 方向），历史回执与历史变更不被判为无效。
- **`gate-skip` 主通道完全保留**：`auto-mode=true` 兼容写法与两轴正交语义不变；本变更不新增第三轴、不改变 `resolveDelegationContract` 的已知参数键集合。
- **门白名单不缩水**：5 类条目与锚点集合逐字不变；`requirement-doc-bridge` 仍作为 `requirement-clarification` 的锚点（auto-workflow / debug 继续声明），只是 `workflow` 的 VERIFY 不再声明该阶段门。
- **门预算只改善不恶化**：workflow 验证阶段的阻塞门由 1（文档桥）降为 0，实现阶段仍为 1（`implementation-bridge`）；每阶段至多 1 个阻塞门不变。
- **制品格式不变**：`## 已确认门` 是 handoff 包的附加段，`## 阶段结论` 仍只追加；MUST NOT 引入 `change.json` / `tasks.json` 真源或跨变更索引。
- **无破坏性变更**（不需要 **BREAKING** 标注）。本变更只提案不实现（规划边界）；按 D8 的实施顺序在变更 ① 之后落地。
