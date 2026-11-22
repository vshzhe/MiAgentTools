# 提案：提升变更提案生成的一次完成度

## Why

用户反复观察到的现象（`exploration.md` §Background，逐字保留）：

> 探索完成后，在生成提案时，变更提案文件不能一次完成，需要多次验证补充的情况，需要优化生成逻辑和完成度，防止多次重写、重复验证问题。

这不是偶发质量问题，而是**结构性**的：提案生成侧与验证侧对"合格制品"的定义不同源，且唯一的结构性判定点被放在验证阶段（Phase 3）。探索阶段已定位 9 条根因（`exploration.md` §根因分析，均带 `文件:行` 证据）。其中三条构成"必然多轮"的骨牌：

1. **R1 模板与验证契约不同源**：验证侧消费的影响面锚点（`### Impact Analysis` / `## Context` 下「架构影响」/ `### Caller Updates`）在生成模板中**根本不存在**（证据：`src/core/spec/templates/index.ts:8-74` 无这些标题；`src/core/templates/workflows/spec-verify-proposal.ts:330-332` 却要求它们）。按模板写出的制品天然不满足检查 → 只能 SKIP（丢覆盖）或判 FAIL（回写）。
2. **R2 提案自检仅一行**：`spec-propose` 全文只有一条自检规则（`scenario-without-test`，`src/core/templates/workflows/spec-propose.ts:287`），对照验证侧 D1-D5 十个检查维度（`spec-verify-proposal.ts:358-465`），propose 宣布 `applyReady` 时对覆盖无任何自证。
3. **R3 覆盖校验默认关闭**：`iagent spec validate` 的 `conformance` 仅在显式传 `--conformance` 时为 true（`src/commands/spec.ts:541-544`），而 propose 终检从不传该参数（`spec-propose.ts:203-209`）。于是 `validate` 通过 ≠ 覆盖通过。

放大器（R4-R9）：判定依赖 AI 语义而非可复现锚点（`proposal-parser.ts:12` 不解析 What Changes / Capabilities；`artifact-model.ts:103-120` 的 `ParsedTask` 无 `nodeRef`，Markdown 的 `[N<id>]` 不被解析）；`design` 可选但 D2 无 SKIP 分支；验证技能无 `Write` 权限（`spec-verify-proposal.ts:212`）导致修复必然回流；D1-D10 / B1-B7 清单在 5 个模板中各手写一份；debug 的「同步提案」是追补式（`debug.ts:441-460` → `:477-506`）。

**为什么是现在**：`spec-update` 能力已落地（2026-11-15），修订闭环会进一步放大"多轮重写"成本；此刻把判定前移为确定性，收益最大。

## What Changes

### 1. 新增：验证锚点单一源（`spec-verify-anchors`）

新增 `src/core/spec/validation/anchors.ts`，把验证侧消费的 Markdown 锚点（`### Impact Analysis`、`## Context` 下「架构影响」、`### Caller Updates`、任务节点标注 `[N<id>]`）定义为**唯一常量源**：

- 生成侧（`src/core/spec/templates/index.ts` 的三份模板）与验证侧（`spec-verify-proposal` 正文、D10）MUST 共同引用；
- 模板 MUST 产出这些锚点（`PROPOSAL_TEMPLATE` 增 `### Impact Analysis`；`DESIGN_TEMPLATE` 的 `## Context` 增 `### 架构影响` 子节；`TASKS_TEMPLATE` 增 `### Caller Updates` 分组与 `[N<id>]` 标注示例）；
- 验证侧 MUST NOT 再手写锚点字面量（MUST NOT 两侧各写一份字符串）。

### 2. 新增：确定性就绪门（`spec-readiness-gate`）

新增 `src/core/spec/validation/readiness.ts`（纯函数、无 I/O，证据由调用方注入），执行**四类确定性判定**：

| 判定 | 内容 | 复用 |
| :--- | :--- | :--- |
| 结构完整 | 四类制品存在且无 `error` 级诊断 | `validateParsedChange`（`artifact-validator.ts:26`） |
| 覆盖完整 | 每个 Requirement 有任务、每个 Scenario 有 `[测试]` 任务 | `buildConformance`（`conformance.ts:86`） |
| 锚点齐备 | 影响面三锚点存在且非空 | 新增（消费 `anchors.ts`） |
| 能力对齐 | `proposal.md` Capabilities 声明的能力 ↔ `specs/<capability>/` 目录逐一对应 | 新增（消费扩展后的 `parseProposal`） |

对外暴露为 `iagent spec validate --ready`（在既有 `validate` 命令上加选项，不新增顶层命令）：

- `--ready` = strict + conformance 强制 + 锚点 + 能力对齐；
- 诊断沿用 `ArtifactDiagnostic`（`filePath` + `line` + `code`），FAIL 时逐条可定位；
- **存量兼容（D3）**：锚点缺失在**新变更**记 `error`，在**存量变更**（变更目录创建早于本能力生效，以 `.openspec.yaml` 的 `created` 字段判定）记 `warning` 并计入 `skipped` 统计，不阻断；
- `skip_specs: true` 时能力对齐检查**豁免**，不参与分母（BS3）。

### 3. 修改：`proposal-parser` / `task-parser` 结构化（消除语义判定）

- `parseProposal`（`src/core/spec/parser/proposal-parser.ts:14`）新增解析 `## What Changes` 条目列表与 `### New/Modified Capabilities` 的 `- \`name\`: 描述` 列表，产出 `ParsedProposal.whatChanges: string[]`、`capabilities: { name: string; description: string }[]`；
- `parseTasks`（`src/core/spec/parser/task-parser.ts:23`）新增解析任务行尾的 `[N<id>]` 标注，产出 `ParsedTask.nodeRef?: string`（与遗留 JSON sidecar 的 `nodeRef` 字段同名，Markdown 成为新真源）；
- `ParsedProposal` / `ParsedTask` 接口相应扩展（`artifact-model.ts:44-50`、`:103-120`）；**既有字段不删不改**，保持向后兼容。

### 4. 新增：验证清单单一源（`verify-checklist-single-source`）

新增 `src/core/templates/verify-checklist.ts`，导出 `renderVerifyChecklist({ variant })`（D1-D10 核心/条件维度 + B1-B7 边界清单的唯一正文源）。以下 5 处改为插值引用，MUST NOT 再各自手写清单：

- `spec-verify-proposal.ts`（D1-D10 维度定义仍留在本技能，清单表头与 B1-B7 引用单一源）
- `workflow.ts:31-39`
- `auto-workflow.ts:95`
- `debug.ts:293,506`
- `spec-verify.ts:41`

### 5. 修改：propose 生成与终检逻辑（一次完成度的落地）

`src/core/templates/workflows/spec-propose.ts`：

- **起草期**（Step 4）：模板锚点已由第 1 项写入，正文新增"必须产出哪些锚点"的显式清单；
- **终检**（Step 5.1，顺序固定、MUST NOT 重排，D9）：`validate --partial`（逐制品）→ **`validate --ready`（就绪门）** → strict `validate` → handoff 包；
- **压缩自检清单**（D2/D10）：新增"与 verify 同源的压缩清单"，逐项确定性可判（Requirement 有任务 / Scenario 有测试 / 三锚点齐备 / Capabilities↔specs 对齐 / `[N<id>]` 标注齐备）；FAIL 自动修复循环 ≤3（`spec-propose.ts:243-246` 既有出口不变，**不新增门**）；
- delegated 回执新增 `readiness: { status, diagnostics: count }` 字段。

### 6. 修改：验证侧消费确定性结果（D5/D6/D8）

- `spec-verify-proposal.ts`：D10 与影响面检查优先读就绪门产出的确定性结论；确定性判定与 AI 语义判定冲突时**确定性优先**，语义补位并留痕（BS6）；
- D2（技术一致性）补 SKIP 分支（D8）：`design.md` 缺失时从 `specs` + `proposal` 的 Capabilities/Impact 取证据，两处均无技术选型证据 → SKIP 排除分母；
- 90% 阈值、维度编号 D1-D10、总分公式 **MUST NOT 改动**（D4）。

### 7. 修改：debug 复用同一就绪门（D7）

`debug.ts` Phase 6「同步提案」完成后 MUST 运行 `iagent spec validate --ready`，FAIL → 回 Phase 4；MUST NOT 另立判定口径。

### 8. 修改：父编排在 propose 后消费就绪结果

`workflow.ts` / `auto-workflow.ts`：Phase 2 委派回执的 `readiness.status` 必须为 `pass` 才能进入 Phase 3；`fail` → 回 Phase 2 修复（不新增用户门）。

**BREAKING**：无。新增能力为主；`validate` 新增 `--ready` 选项为加法，既有 `validate` / `validate --partial` / `validate --conformance` 行为不变；新增锚点对新变更记 `error`、存量记 `warning`（D3）。

## Capabilities

### New Capabilities

- `spec-verify-anchors`: 验证锚点单一源——把影响面三锚点与任务节点标注定义为共享常量，生成模板与验证技能共同引用，消除"生成侧不产出、验证侧却要求"的结构错配。
- `spec-readiness-gate`: 提案就绪门——由 CLI 纯函数执行的确定性组合校验（结构 + 覆盖 + 锚点 + 能力对齐），propose 终检必须通过；存量变更按 SKIP + WARN 兼容。
- `verify-checklist-single-source`: 验证清单单一源——D1-D10 + B1-B7 清单正文由单一模块渲染，五个编排/验证技能共同引用，消除判据漂移。

### Modified Capabilities

- `artifact-generation-protocol`: 生成协议新增"锚点产出"与"终检顺序（partial → 就绪门 → strict → handoff 包）"两项要求；模板 MUST 产出验证侧消费的锚点。
- `spec-verify-proposal`: D10 与影响面检查改为优先消费确定性结论；D2 新增 `design.md` 缺失时的 SKIP 分支；确定性优先于语义判定。

## Impact

### Impact Analysis

> 逐符号结果源自 `exploration.md` §Codebase Findings 与 Phase 2.0 影响分析（本次为 Modify 意图，触发深度分析）。

| 符号 | 位置 | 直接上游影响（调用方 / 依赖方） | 波及的测试面 | 改动要求 |
| :--- | :--- | :--- | :--- | :--- |
| `validateParsedChange` | `src/core/spec/validation/artifact-validator.ts:26` | `runSpecValidate`（`src/commands/spec.ts:541`）；测试 `spec-artifact-parser.test.ts` | 选项对象扩展（新增 `ready` / `legacy` 标志），默认行为不变 |
| `buildConformance` | `src/core/spec/validation/conformance.ts:86` | `runSpecConformance`、`runSpecValidate` | 只读复用，不改签名；就绪门以纯函数方式调用 |
| `buildTraceability` | `src/core/spec/validation/traceability.ts:45` | `validateParsedChange` | 只读复用 |
| `runSpecValidate` / `SpecValidateOptions` | `src/commands/spec.ts:478`、`:467` | `validate` 子命令 action（`spec.ts:219-240`） | 新增 `ready?: boolean`；`--ready` 与 `--partial` 互斥（冲突时报诊断） |
| `parseProposal` | `src/core/spec/parser/proposal-parser.ts:14` | `inspectArtifact`（`status.ts:240`）、`runSpecValidate`、`migration.ts` | 只增字段（`whatChanges` / `capabilities`），既有 `sections` / `diagnostics` 语义不变 |
| `parseTasks` | `src/core/spec/parser/task-parser.ts:23` | `inspectArtifact`、`runSpecValidate`、`parseTaskList`、`migration.ts` | 只增字段 `nodeRef`，不新增诊断 |
| `ParsedProposal` / `ParsedTask` | `src/core/spec/model/artifact-model.ts:44`、`:103` | 全部上述消费方 | 接口只增字段，保持向后兼容 |
| `PROPOSAL_TEMPLATE` / `DESIGN_TEMPLATE` / `TASKS_TEMPLATE` | `src/core/spec/templates/index.ts:8`、`:50`、`:76` | `getArtifactInstructions`（`instructions.ts:56-59`）；测试 `spec-commands.test.ts:278-285`、`task-label.test.ts` | 新增锚点小节；既有断言 MUST 保持通过 |
| `getSpecProposeSkillTemplate` | `src/core/templates/workflows/spec-propose.ts:16` | `registry.ts` 成对注册；测试 `stage-continuation.test.ts` | 终检顺序 + 压缩清单 + 回执字段 |
| `getSpecVerifyProposalSkillTemplate` | `src/core/templates/workflows/spec-verify-proposal.ts:208` | 同上；测试 `verify-review-checkpoints.test.ts` | D2 SKIP 分支 + 确定性优先 + 清单插值 |
| `getWorkflowSkillTemplate` / `getAutoWorkflowSkillTemplate` | `workflow.ts:151`、`auto-workflow.ts:16` | `registry.ts` | 清单插值 + `readiness.status` 门控 |
| `getDebugSkillTemplate` | `debug.ts:212` | `registry.ts`；测试 `codegraph-protocol.test.ts` | Phase 6 复用就绪门 + 清单插值 |
| `getSpecVerifyChangeSkillTemplate` | `spec-verify.ts:8` | `registry.ts` | 清单插值 |
| `detectCompleted` / `inspectArtifact` | `src/core/spec/status.ts:74`、`:235` | `getChangeStatus`、`getArtifactInstructions`、`applyStatusForSkipSpecs` | **零改动**（就绪门独立于 done 判定；MUST NOT 把覆盖校验塞进 `detectCompleted`） |

### 影响面小结

- **新增为主**：3 个新模块（`anchors.ts` / `readiness.ts` / `verify-checklist.ts`），1 个 CLI 选项（`validate --ready`），3 个新能力规格。
- **改动为辅**：2 个解析器、1 个运行时模型、3 份模板、6 个技能模板正文。
- **回归高危面**：`validate` 既有三种模式的语义不变性；`spec-commands.test.ts` 对模板的文本断言；`skills-parity` 快照；`test/template-consistency.test.ts`。
- **边界约束**：`detectCompleted` MUST NOT 承担覆盖校验；就绪门 MUST NOT 含 AI 语义；90% 阈值与维度编号 MUST NOT 变动。

### 直接影响的文件

- `src/core/spec/validation/anchors.ts`（**新建**）：锚点常量单一源。
- `src/core/spec/validation/readiness.ts`（**新建**）：就绪门纯函数。
- `src/core/templates/verify-checklist.ts`（**新建**）：D1-D10 + B1-B7 清单单一源渲染。
- `src/core/spec/templates/index.ts`：三份模板新增锚点小节。
- `src/core/spec/parser/proposal-parser.ts`、`src/core/spec/parser/task-parser.ts`、`src/core/spec/model/artifact-model.ts`：结构化字段。
- `src/core/spec/validation/artifact-validator.ts`：选项扩展（`ready`）。
- `src/commands/spec.ts`：`validate --ready`。
- `src/core/templates/workflows/spec-propose.ts`、`spec-verify-proposal.ts`、`workflow.ts`、`auto-workflow.ts`、`debug.ts`、`spec-verify.ts`：正文与清单插值。
- `openspec/CONTEXT.md`：新增 4 条术语（一次完成度 / 就绪门 / 验证锚点 / 压缩自检清单）。
- `AGENTS.md`：新增单一源说明（`anchors.ts` / `verify-checklist.ts`）。

### 向后兼容

- `validate` 既有三种调用形态（strict / `--partial` / `--conformance`）行为 MUST NOT 改变；
- 新锚点对新变更记 `error`、存量变更记 `warning` + `skipped`（D3），存量变更的既有流程不被阻断；
- `ParsedProposal` / `ParsedTask` 只增字段，既有消费方无需改动；
- `skip_specs: true` 的能力对齐检查豁免，不改变既有 skip_specs 语义。
