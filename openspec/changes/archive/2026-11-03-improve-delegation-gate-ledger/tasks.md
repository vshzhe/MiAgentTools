# Tasks: improve-delegation-gate-ledger

<!-- 任务类型标签（并列四类）：
     [代码] 实现代码 / [测试] 测试代码 / [DB脚本] 数据库脚本 / [使用说明] 补充文档（默认产出至 attachments/）
     [测试] 子标注：层级 [单元]/[功能] + 优先级 [P0]/[P1]/[P2]，形如 `- [ ] [测试][单元][P0] 1.2 <任务描述>`
     补充文档类（非 [代码]/[测试]）MUST 含 `产出:` 字段指定输出路径 -->

> 流程基准：`exploration.md` 的「功能流程图 → 链路 B（N14–N26）」已确认（`status: confirmed`，2026-11-03 继承主探索流程最终确认门）。
> 每个任务标注对应节点 id；MUST NOT 静默新增节点（发现遗漏须回探索文件更新并重新确认）。
> 链路 A（N1–N13 + N37/N38）属变更 ①（`improve-proposal-validation-and-spec-ref`），链路 C（N27–N36）属变更 ③（`feat-debug-dual-track-entry`），均不在本变更范围。
> 实施顺序：变更 ① 落地后再实施本变更（D8）。

## 1. 门账本载体与回执协议

- [x] 1.1 [代码] 新建 `src/core/host-orchestration/gate-ledger.ts`：`GATE_LEDGER_SECTION`（`## 已确认门`）、`gateLedgerPath(changeName)`（`.openspec-tmp/pipeline-<change>/handoff-pack.md`，`path.join` 构造）、`parseGateLedger(markdown)`（返回 `{ gates, warnings }`，未知门 id 忽略 + WARN，段缺失返回空集）、`renderGateLedgerEntry(gateId, phase)` [N14] [N16] [N24]
  - 文件：`src/core/host-orchestration/gate-ledger.ts`、`src/core/host-orchestration/index.ts`
  - 验证：`parseGateLedger('## 已确认门\n| 门 id | 确认阶段 |\n| --- | --- |\n| design-confirmation | verify |')` 返回 `gates: ['design-confirmation']`（表头与分隔行被跳过、无 WARN）；未知 id 只产生 WARN 不回填
  - Spec Ref：host-orchestration / 门账本（gate ledger）与阶段回执确认门字段
  - Scenario Ref：host-orchestration / 门账本（gate ledger）与阶段回执确认门字段 / 账本缺失时门仍触发（fail-safe）
  - Scenario Ref：host-orchestration / 门账本（gate ledger）与阶段回执确认门字段 / 账本条目表达门承载语义而非父级阶段门

- [x] 1.2 [代码] `Receipt` 增加可选 `confirmedGates?: string[]`（不入 `DEFAULT_RECEIPT_FIELDS`）；`validateReceipt` 增加形状与取值校验（非数组 / 元素非字符串 / 空串 / 未知门 id → 无效并附原因），值域取自 `GATE_SKIP_IDS` [N16] [N18]
  - 文件：`src/core/host-orchestration/protocol.ts`
  - 验证：`validateReceipt({ ...ok, confirmedGates: ['unknown'] }, spec)` → `valid: false` 且 reason 含门 id；缺字段时 `valid: true`

- [x] 1.3 [代码] `evaluatePhaseTransition` 的回执分支补充「`confirmedGates` 非法 → `invalid-receipt`」注释与 WARN 文案（判定逻辑不变：门 / 回执 / 能力三要素与条件门语义保持原样） [N16]
  - 文件：`src/core/host-orchestration/transition.ts`
  - 验证：既有条件门三态用例（`false` / `true` / 缺省）结果不变

- [x] 1.4 [代码] `workflows.ts`：`WORKFLOW_PROTOCOLS.workflow` 的 VERIFY 退回无门的 `VERIFY_PHASE`（`VERIFY_WITH_BRIDGE` 仅 auto-workflow 使用）；`APPLY_PHASE.handoff` 增加 `confirmedGates`；`PHASE_GATE_CATEGORY` 与 5 类白名单条目逐字保留 [N14] [N15]
  - 文件：`src/core/host-orchestration/workflows.ts`
  - 验证：`getWorkflowProtocol('workflow').phases.find(p => p.id === 'verify').gate === undefined`；`auto-workflow` 的 verify 仍为 `requirement-doc-bridge`；`auditGateWhitelistAlignment()` 返回 `[]`

- [x] 1.5 [测试][单元][P0] 账本解析与渲染单测：段存在 / 段缺失 / 未知门 id + WARN / 条目与回执一致 / 条目超出回执即视为未确认 [N16] [N18]
  - 文件：`test/gate-ledger.test.ts`（新建）
  - 验证：`pnpm test -- gate-ledger`
  - Spec Ref：host-orchestration / 门账本（gate ledger）与阶段回执确认门字段
  - Scenario Ref：host-orchestration / 门账本（gate ledger）与阶段回执确认门字段 / 门确认后写账本并在委派前校验存在
  - Scenario Ref：host-orchestration / 门账本（gate ledger）与阶段回执确认门字段 / 账本缺失时门仍触发（fail-safe）
  - Scenario Ref：host-orchestration / 门账本（gate ledger）与阶段回执确认门字段 / 账本与回执不一致时 WARN 且不视为已确认

- [x] 1.6 [测试][单元][P0] 回执校验单测：合法 `confirmedGates`、非数组、含空串、含未知门 id → `invalid-receipt`；缺字段仍有效 [N16] [N18]
  - 文件：`test/host-orchestration.test.ts`
  - 验证：`pnpm test -- host-orchestration`
  - Spec Ref：host-orchestration / 门账本（gate ledger）与阶段回执确认门字段
  - Scenario Ref：host-orchestration / 门账本（gate ledger）与阶段回执确认门字段 / 回执 confirmedGates 形状非法时阻断推进

- [x] 1.7 [测试][单元][P0] 协议门对齐单测：workflow verify 无门、workflow apply 为 `implementation-bridge`、auto-workflow verify 为文档桥、每阶段至多 1 门、5 类白名单与锚点集合不变 [N14] [N15]
  - 文件：`test/host-orchestration.test.ts`
  - 验证：`pnpm test -- host-orchestration`
  - Spec Ref：host-orchestration / auto-workflow 协议阶段门与模板声明一致
  - Scenario Ref：host-orchestration / auto-workflow 协议阶段门与模板声明一致 / auto-workflow 的 APPLY 与 ARCHIVE 无阻塞门
  - Scenario Ref：host-orchestration / auto-workflow 协议阶段门与模板声明一致 / auto-workflow 的 VERIFY 声明文档桥门
  - Scenario Ref：host-orchestration / auto-workflow 协议阶段门与模板声明一致 / workflow 的 VERIFY 不再声明文档桥门
  - Scenario Ref：host-orchestration / auto-workflow 协议阶段门与模板声明一致 / 白名单仍为 5 类且锚点包含文档桥
  - Scenario Ref：host-orchestration / auto-workflow 协议阶段门与模板声明一致 / 协议门全部落在白名单锚点内
  - Spec Ref：host-orchestration / 门账本（gate ledger）与阶段回执确认门字段
  - Scenario Ref：host-orchestration / 门账本（gate ledger）与阶段回执确认门字段 / 账本不新增门类别与门预算

- [x] 1.8 [测试][单元][P1] handoff 包账本段语义单测：含账本时六节顺序不变、条目只含门 id + 确认阶段、跨阶段只读不改写 [N14] [N17]
  - 文件：`test/gate-ledger.test.ts`、`test/spec-workflow-contract.test.ts`
  - 验证：`pnpm test -- gate-ledger spec-workflow-contract`
  - Spec Ref：spec-workflow-skills / handoff 包门账本段（已确认门）
  - Scenario Ref：spec-workflow-skills / handoff 包门账本段（已确认门） / 六节语义与顺序不变
  - Scenario Ref：spec-workflow-skills / handoff 包门账本段（已确认门） / 账本只记录门 id 与确认阶段
  - Scenario Ref：spec-workflow-skills / handoff 包门账本段（已确认门） / 跨阶段只读复用且不改写账本

## 2. spec-apply 的门承载降级链

- [x] 2.1 [代码] Step 5.5 增加三级降级链：`gate-skip`（主通道，权威）→ handoff 包 `## 已确认门`（兜底，跳过时记 WARN「使用了门账本兜底通道」）→ 两者皆缺则照常执行门；账本与回执不一致 / 过期 → WARN + 视为未确认 [N17] [N18]
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - 验证：正文含三级次序与「主通道存在时 MUST NOT 读取账本作覆盖」；「未设置该参数或其为 false 时不能跳过本门」句保留

- [x] 2.2 [代码] handoff 包章节列表加入 `## 已确认门` 并列说明（不计入六节、不改 `## 阶段结论` 只追加语义） [N17]
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - 验证：正文六节枚举不变，新增段落仅一处并列说明

- [x] 2.3 [测试][单元][P0] 正文契约断言：`gate-skip` 主通道、账本兜底 + WARN、两者皆缺仍执行 Step 5.5、账本不一致视为未确认 [N17] [N18]
  - 文件：`test/spec-workflow-contract.test.ts`
  - 验证：`pnpm test -- spec-workflow-contract`
  - Spec Ref：spec-workflow-skills / spec-apply 门承载参数契约
  - Scenario Ref：spec-workflow-skills / spec-apply 门承载参数契约 / 账本兜底跳过设计确认门
  - Scenario Ref：spec-workflow-skills / spec-apply 门承载参数契约 / 账本缺失时 Step 5.5 仍执行
  - Scenario Ref：spec-workflow-skills / spec-apply 门承载参数契约 / 账本与回执不一致时视为未确认

- [x] 2.4 [测试][单元][P1] 既有门承载行为回归：`gate-skip` 跳过整道门、`auto-mode=true` 逐条等价、其余门与停点（测试执行门 / 范围蔓延 / 编译失败 / 批调度 / 共享资源 / 退出守卫）不被豁免 [N17]
  - 文件：`test/spec-workflow-contract.test.ts`
  - 验证：`pnpm test -- spec-workflow-contract`
  - Spec Ref：spec-workflow-skills / spec-apply 门承载参数契约
  - Scenario Ref：spec-workflow-skills / spec-apply 门承载参数契约 / gate-skip 跳过设计确认门
  - Scenario Ref：spec-workflow-skills / spec-apply 门承载参数契约 / auto-mode 兼容写法行为一致
  - Scenario Ref：spec-workflow-skills / spec-apply 门承载参数契约 / 其余门与停点不被豁免

## 3. workflow 交付桥与委派账本

- [x] 3.1 [代码] Phase 3.5 文档桥并入 Phase 3.7 实现桥，改为单一「交付桥」：一次呈现「提案摘要 + 验证评分 + 深度复查结论 + 实现方案 + 测试计划预告 + 是否生成需求文档」；五出口（确认+生成 / 仅实现 / 仅生成文档 / 修改 / 拒绝）；「仅生成文档」停在规划边界（状态 `generated`，不进入实现） [N14] [N15]
  - 文件：`src/core/templates/workflows/workflow.ts`
  - 验证：正文不存在「先停文档桥、再停实现桥」的两次停点；「仅生成文档」出口显式声明不委派 apply

- [x] 3.2 [代码] Phase 4 委派段增加：交付桥确认后立即把 `design-confirmation` 写入 `## 已确认门`、委派前校验存在、失败即停止不委派；回执携带 `confirmedGates`；保留 `gate-skip` 主通道表述 [N16]
  - 文件：`src/core/templates/workflows/workflow.ts`
  - 验证：正文含「写入失败 / 校验失败 → MUST NOT 委派」与 `confirmedGates`

- [x] 3.3 [测试][单元][P0] 交付桥文案断言：单门呈现四要素 + 文档选项、无第二次文档停点、拒绝回退范围显式 [N14] [N15]
  - 文件：`test/templates.test.ts`、`test/spec-workflow-contract.test.ts`
  - 验证：`pnpm test -- templates spec-workflow-contract`
  - Spec Ref：workflow-suite-skills / 实现桥合并（实现确认 + 测试计划）
  - Scenario Ref：workflow-suite-skills / 实现桥合并（实现确认 + 测试计划） / 单门呈现实现与测试计划
  - Scenario Ref：workflow-suite-skills / 实现桥合并（实现确认 + 测试计划） / 拒绝回退范围明确
  - Scenario Ref：workflow-suite-skills / 实现桥合并（实现确认 + 测试计划） / 交付桥承载文档选项且不再二次停顿

- [x] 3.4 [测试][单元][P0] 委派与账本断言：传 `gate-skip=design-confirmation`、委派前写账本并校验、写入失败不委派、参数缺失时 apply 设计门照常触发、实现桥缺失时门仍阻塞 [N16]
  - 文件：`test/spec-workflow-contract.test.ts`
  - 验证：`pnpm test -- spec-workflow-contract`
  - Spec Ref：workflow-suite-skills / workflow 实现桥承载 apply 设计门
  - Scenario Ref：workflow-suite-skills / workflow 实现桥承载 apply 设计门 / workflow 以门承载参数委派 apply
  - Scenario Ref：workflow-suite-skills / workflow 实现桥承载 apply 设计门 / 实现桥缺失时门仍生效
  - Scenario Ref：workflow-suite-skills / workflow 实现桥承载 apply 设计门 / 委派前写账本并校验存在
  - Scenario Ref：workflow-suite-skills / workflow 实现桥承载 apply 设计门 / 账本写入失败时停止不委派
  - Scenario Ref：workflow-suite-skills / workflow 实现桥承载 apply 设计门 / 账本缺失时设计门仍由 apply 触发

- [x] 3.5 [测试][功能][P1] 「仅生成文档」出口回归：状态写 `generated`、不委派 `iagent_spec_apply`、后续实现须由用户新请求触发；`## 需求文档状态` 写入失败时不进入实现 [N14] [N15]
  - 文件：`test/spec-workflow-contract.test.ts`
  - 验证：断言正文含「停在规划边界」与「不进入实现」，且含写入失败停止分支
  - Spec Ref：workflow-suite-skills / 实现桥合并（实现确认 + 测试计划）
  - Scenario Ref：workflow-suite-skills / 实现桥合并（实现确认 + 测试计划） / 仅生成文档停在规划边界
  - Scenario Ref：workflow-suite-skills / 实现桥合并（实现确认 + 测试计划） / 文档状态持久化失败不进入实现

## 4. auto-workflow 接门账本（保留文档桥）

- [x] 4.1 [代码] Phase 3.3 文档桥收束后把 `design-confirmation` 写入 `## 已确认门`、回执携带 `confirmedGates`；文档桥仍是本链唯一流程级阻塞门（MUST NOT 复用交付桥合并语义） [N24]
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 验证：正文含唯一门声明 + 账本写入 + `confirmedGates`，无「新增阻塞门」表述

- [x] 4.2 [代码] Phase 4.1 委派前校验账本存在；`gate-skip` 主通道 + 账本兜底双通道表述；两者皆缺时设计门照常触发；写入 / 校验失败停止不委派 [N25]
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 验证：正文含「两者皆缺 → 设计门照常触发，MUST NOT 报告为全自动无停顿」

- [x] 4.3 [测试][单元][P0] auto-workflow 断言：委派而非内联、唯一门不变、文档桥后写账本、`gate-skip` 丢失时账本兜底、两者皆缺设计门触发 [N24] [N25]
  - 文件：`test/spec-workflow-contract.test.ts`、`test/host-orchestration.test.ts`
  - 验证：`pnpm test -- spec-workflow-contract host-orchestration`
  - Spec Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议
  - Scenario Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / Phase 4 委派而非内联
  - Scenario Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / 文档桥仍是 auto-workflow 唯一流程级阻塞门
  - Scenario Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / 文档桥后写账本
  - Scenario Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / gate-skip 丢失时账本兜底
  - Scenario Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / 两者皆缺时设计门照常触发
  - Scenario Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / Phase 5 委派而非内联
  - Scenario Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / Phase 5 正文无已移除分支残留

## 5. 调用方同步

### Caller Updates

- [x] 5.1 [代码] `DELEGATION_PARAMETERS` 只增加注释声明账本通道（路径由 change-name 派生，MUST NOT 新增参数键）；`renderOptions` 保持只渲染 `mode` / `gate-skip` 两轴 [N16]
  - 文件：`src/core/host-orchestration/render.ts`、`src/core/host-orchestration/actions.ts`
  - 验证：`DELEGATION_PARAMETERS.workflow['spec-apply']` 仍为 `{ 'gate-skip': 'design-confirmation' }`；`renderOptions` 无账本分支

- [x] 5.2 [代码] 重新生成技能与指令快照：`pnpm build && pnpm generate:skills` [N14] [N16] [N24]
  - 文件：`skills/iagent-spec-apply/SKILL.md`、`skills/iagent-workflow/SKILL.md`、`skills/iagent-auto-workflow/SKILL.md` 及配对指令产物
  - 验证：`pnpm test -- skills-parity` 通过，快照无手改残留

- [x] 5.3 [测试][单元][P0] 既有断言同步：改写 `test/host-orchestration.test.ts:831-843` 的「workflow verify 与 debug verify-close 同声明文档桥门」（workflow verify 改为无门、debug 保持）；门预算 `:869-878` 与白名单 `:845-851` 保持通过；参数表同源断言 `:1008-1020` 不变 [N14] [N16]
  - 文件：`test/host-orchestration.test.ts`
  - 验证：`pnpm test -- host-orchestration`
  - Spec Ref：host-orchestration / auto-workflow 协议阶段门与模板声明一致
  - Scenario Ref：host-orchestration / auto-workflow 协议阶段门与模板声明一致 / workflow 的 VERIFY 不再声明文档桥门
  - Scenario Ref：host-orchestration / auto-workflow 协议阶段门与模板声明一致 / 白名单仍为 5 类且锚点包含文档桥

- [x] 5.4 [测试][单元][P0] 回执相关既有断言同步：`test/host-orchestration.test.ts:490-495`（requirementDocStatus 字段仍被认可）、`test/spec-workflow-contract.test.ts` 的门承载与回执断言 [N17]
  - 文件：`test/host-orchestration.test.ts`、`test/spec-workflow-contract.test.ts`
  - 验证：`pnpm test -- host-orchestration spec-workflow-contract`
  - Spec Ref：host-orchestration / 门账本（gate ledger）与阶段回执确认门字段
  - Scenario Ref：host-orchestration / 门账本（gate ledger）与阶段回执确认门字段 / 回执 confirmedGates 形状非法时阻断推进

- [x] 5.5 [测试][单元][P1] 交叉影响确认：变更 ① 落地后的 `spec-apply.ts` Step 5.5 与 handoff 包章节列表仍与本变更的账本段共存（不冲突、六节枚举未被 ① 改写） [N17]
  - 文件：`test/spec-workflow-contract.test.ts`
  - 验证：`pnpm test -- spec-workflow-contract`
  - Spec Ref：spec-workflow-skills / handoff 包门账本段（已确认门）
  - Scenario Ref：spec-workflow-skills / handoff 包门账本段（已确认门） / 六节语义与顺序不变

- [x] 5.6 [测试][单元][P1] 规范增量完整性：MODIFIED Requirement 的既有场景随包重发不丢失（`auto-workflow 全自动管线` 的 Phase 5 委派 / Phase 5 正文无残留 / 测试执行门继承 / 阶段门声明与协议一致四条场景 MUST 保留在 delta 内） [N24] [N26]
  - 文件：`openspec/changes/improve-delegation-gate-ledger/specs/workflow-suite-skills/spec.md`
  - 验证：逐条比对主规范 `openspec/specs/workflow-suite-skills/spec.md:485-521` 与 delta 的场景名，既有场景名 MUST 全部出现（允许扩写正文、不允许删名）
  - Spec Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议
  - Scenario Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / 测试执行门继承
  - Scenario Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / 阶段门声明与协议一致

- [x] 5.7 [测试][单元][P0] 交付桥术语与既有回归面同步（三个**原清单遗漏**的测试文件）：`test/artifact-dataflow.test.ts`（`:141-147` 三父流程 `需求文档桥`、`:259-267` `单次业务桥`、`:320-327` `实现 + 测试桥`、`:342-347` 派生版 `FAIL 不出文档桥`）、`test/template-consistency.test.ts:172-175`（`实现 + 测试桥`）、`test/template-derivation.test.ts:159-204`（`FAIL 不出文档桥`） [N14] [N15]
  - 文件：`test/artifact-dataflow.test.ts`、`test/template-consistency.test.ts`、`test/template-derivation.test.ts`
  - 验证：`pnpm test -- artifact-dataflow template-consistency template-derivation` 全绿；实现策略二选一并记录：① 交付桥正文保留上述术语（推荐，改动最小）；② 同步改写这三处断言（MUST NOT 删除断言，MUST NOT 留失败断言）
  - Spec Ref：workflow-suite-skills / 实现桥合并（实现确认 + 测试计划）
  - Scenario Ref：workflow-suite-skills / 实现桥合并（实现确认 + 测试计划） / 合并不破坏既有可断言术语与护栏

## 6. 流程基准未变节点回归（N19–N23）

> 本组节点在链路 B 中「不改行为」，但直接位于门之后（N17/N18 → N19），须以回归任务显式确认账本与交付桥改动未扰动下游门与调度，使 N14–N26 在任务清单中可逐一核对。

- [x] 6.1 [测试][单元][P1] 批调度与子代理派发协议不变：派发单元 = 同 group 任务、并发上限 `apply.concurrency`（缺省 3）、滑动窗口、跨单元同文件串行、无派发工具时全串行降级 [N19]
  - 文件：`test/spec-workflow-contract.test.ts`
  - 验证：`pnpm test -- spec-workflow-contract`
  - Spec Ref：spec-workflow-skills / spec-apply 门承载参数契约
  - Scenario Ref：spec-workflow-skills / spec-apply 门承载参数契约 / 其余门与停点不被豁免

- [x] 6.2 [测试][单元][P1] 编译硬门与测试执行门语义不变：编译四值终态、无会话级跳过出口、`fail` 暂停不进测试/归档；测试门仅变更范围、存量失败只 WARN [N20] [N21]
  - 文件：`test/spec-workflow-contract.test.ts`
  - 验证：`pnpm test -- spec-workflow-contract`
  - Spec Ref：spec-workflow-skills / spec-apply 门承载参数契约
  - Scenario Ref：spec-workflow-skills / spec-apply 门承载参数契约 / 其余门与停点不被豁免

- [x] 6.3 [测试][单元][P1] 实现验证桥与归档桥阻断语义不变：验证失败不得归档、编译证据缺失 / `fail` 阻断归档、`not-applicable` / `disabled` 记 WARN 且不表述为通过（该两节点无 delta 需求，仅回归既有断言） [N22] [N23]
  - 文件：`test/spec-workflow-contract.test.ts`、`test/templates.test.ts`
  - 验证：`pnpm test -- spec-workflow-contract templates`

## 7. 收尾验证

- [x] 7.1 [测试][功能][P1] 边界场景端到端回归（逐条对应探索文件 4 条边界场景）：账本缺失仍执行 Step 5.5、账本伪造 / 过期 WARN 且不标已确认、交付桥「仅生成文档」停在规划边界、auto-workflow 账本兜底、两者皆缺时设计门触发 [N17] [N18] [N25]
  - 文件：`test/spec-workflow-contract.test.ts`、`test/gate-ledger.test.ts`
  - 验证：`pnpm test -- spec-workflow-contract gate-ledger`
  - Spec Ref：spec-workflow-skills / spec-apply 门承载参数契约
  - Scenario Ref：spec-workflow-skills / spec-apply 门承载参数契约 / 账本缺失时 Step 5.5 仍执行
  - Scenario Ref：spec-workflow-skills / spec-apply 门承载参数契约 / 账本与回执不一致时视为未确认
  - Spec Ref：workflow-suite-skills / 实现桥合并（实现确认 + 测试计划）
  - Scenario Ref：workflow-suite-skills / 实现桥合并（实现确认 + 测试计划） / 仅生成文档停在规划边界
  - Spec Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议
  - Scenario Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / gate-skip 丢失时账本兜底
  - Scenario Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / 两者皆缺时设计门照常触发

- [x] 7.2 [测试][单元][P0] 全量测试：`pnpm test` [N14] [N26]
  - 文件：`test/`（全量）
  - 验证：全绿，无新增 skip，无 flaky 重跑
  - Spec Ref：host-orchestration / 门账本（gate ledger）与阶段回执确认门字段
  - Scenario Ref：host-orchestration / 门账本（gate ledger）与阶段回执确认门字段 / 账本不新增门类别与门预算

- [x] 7.3 [代码] 版本号与变更日志：`node bin/iagent.js version` 只读判定后 `version bump`，随功能提交一并提交 [N26]
  - 文件：`package.json`、`CHANGELOG.md`、`README.md`
  - 验证：判定等级与本变更影响面一致（新增协议字段 + 模板行为变更，预期 minor）
