# 提案：新增 spec-update 能力（已实现变更的修订闭环）

## Why

用户原始主题（`exploration.md` §提示词基线，2026-11-14 经确认）：

> 新增 update 能力，用于对已经完成提案功能实现完成后，用户在测试完成后，出现问题时，通过 update 能力完成对测试发现问题进行探索分析，更新提案后，并对发现问题再进行实现优化，以及对完成修复后功能进行能力测试对比。

现状缺口（探索阶段 `exploration.md` §Analysis / §Codebase Findings，证据 `文件:行`）：

1. **没有「已实现 + 已测试后出问题」的闭环入口**：既有 `iagent_debug`（`src/core/templates/workflows/debug.ts:212`）以孤立 bug 报告为起点，其「同步提案」是修复后的**附属同步**；既有 `iagent_spec_propose`（`src/core/templates/workflows/spec-propose.ts:16`）只**新建**提案，不修订既有提案。用户测试阶段暴露的问题因此没有落点。
2. **提案修订没有载体语义**：既有变更制品（`proposal.md` / `specs/**` / `design.md` / `tasks.md`）是一次性只增不改的产物；`openspec/changes/<name>/` 下没有修订痕迹文件，「问题 → 根因 → 提案修订 → 实现任务」的追溯链断裂（D2）。
3. **修复后缺能力层对比**：`iagent_spec_verify`（`src/core/templates/workflows/spec-verify.ts:8`）比的是「实现 vs 制品」三维度（Completeness / Correctness / Coherence），不回答「修复前后能力表现发生了什么变化」（D5）。

探索阶段已把诉求收束为决策 D1–D12、边界场景 BS1–BS6、ADR-0003（`openspec/docs/adr/0003-spec-update-boundary-with-debug.md`）与 18 条硬约束；功能流程图 N1–N22 已于 2026-11-14 经用户确认（`flowBaselineConfirmed = true`，流程基准成立）。

## What Changes

新增**独立 spec 类技能** `iagent_spec_update`（宿主技能 ID `iagent-spec-update`，canonical workflowId / 指令 id `spec-update`），承载「变更已提案 → 已实现 → 用户已测试」之后**发现问题时**的四环节修复闭环（顺序保证，**MUST NOT 重排**，D3）：

1. **探索分析**：对用户在测试中发现的问题做探索分析，产出根因、影响面与修复方案。按 ADR-0003 双轨根因定位：**默认轻量差异定位**（变更制品 ↔ 实际实现 ↔ 用户测试现象），轻量无结论时**降级委派 `iagent_debug`** 做深度根因分析；两者皆无结论则输出「根因未定位」报告并**不改任何制品**（D4，BS3）。
2. **更新提案**：以探索结论为输入，在**同一变更身份**内**原地改写**既有变更 Markdown 制品 + 追加修订痕迹 `revision.md`（D2 / D8）。改写前 MUST 呈现修订清单并经**破坏性改动确认门**确认（归入门白名单第 5 类 `destructive-change`，不可豁免，D11）；改写部分失败 MUST 回滚到改写前快照并报 WARN，停在「更新提案」阶段（D10，BS2）。已归档变更 MUST 先复制为 `update-<原名>-<YYYYMMDD>` 再修订，原归档目录**保持不动**（D9，BS1）。
3. **再实现优化**：委派 `iagent_spec_apply` 承接修订后的任务清单调度 + 编译检查 + 测试执行关卡（D7）。
4. **能力测试对比**：产出独立对比制品 `capability-comparison.md`（能力 → 修复前表现 → 修复后表现 → 证据位置），并委派 `iagent_spec_verify` 做三维度一致性验证；对比结论 FAIL 时 MUST NOT 进入归档出口（D5，BS5）。

配套改动（改动为辅，见 §Impact）：

- `src/core/templates/registry.ts`：`WORKFLOW_PAIRS` 成对注册 `spec-update` 技能对；指令版由 `derive-command.ts` 从 skill 版唯一源派生（D1）。
- `src/core/profiles.ts`：`DEPS` 新增 `spec-update` ⇒ `spec-apply` / `spec-verify` / `test` / `debug`，随装补全避免死委派引用（D6）；**`DEFAULT_WORKFLOWS` 不纳入** `spec-update`（D6，破坏性面见 §待确认项）。
- `src/core/templates/workflows/debug.ts`：description 补反向排歧句（可选增强，ADR-0003 影响段列为可选后续）。
- `src/core/host-orchestration/protocol.ts`：**零改动** —— 门白名单 MUST NOT 增删类别（仍为 5 类），破坏性改动确认门归入既有第 5 类（D11）。
- `src/core/spec/schema.ts`：**零改动** —— `revision.md` / `capability-comparison.md` 不登记进 `SPEC_DRIVEN_SCHEMA`，MUST NOT 进入主 spec 合并范围（D5 / 硬约束）。

**BREAKING**：无（新增能力为主；既有 7 个 spec 技能行为 MUST NOT 被破坏，D1；`DEFAULT_WORKFLOWS` 不变 → 默认安装集规模不变）。

## Capabilities

### New Capabilities

- `spec-update`: 新增独立 spec 类技能承载「变更已实现并测试后的问题修订闭环」——技能注册与形态、前置阻断校验、已归档变更复活复制、双轨根因定位、破坏性改动确认门与原地改写 + 修订记录、改写失败回滚、再实现优化与能力测试对比、新增变更级制品的归档边界。

### Modified Capabilities

（无——`skill-profile` 的「依赖注入」需求正文在本变更前即已与代码漂移（`requirement-doc` 相关条款），整体重写该共享需求会引入与本变更无关的语义改动；`spec-update` 的随装补全规则改由新能力 `spec-update` 的 ADDED 需求承载，`src/core/profiles.ts` 的 `DEPS` 表为唯一实现真源。详见 §待确认项 Q2。）

## Impact

### Impact Analysis（Phase 2.0 自动执行，CodeGraph blast radius）

> 逐符号结果源自 `exploration.md` §影响分析（Phase 2.0 自动执行），此处只做制品化改写，**不改动其结论**。

| 符号 | 位置 | 直接上游影响（调用方 / 依赖方） | 波及的测试面 | 改动要求 |
|---|---|---|---|---|
| `WORKFLOW_PAIRS` | src/core/templates/registry.ts:105 | 4 处同文件调用（`getSkillTemplates` / `getCommandTemplates` / `deriveCommandId` 派生链） | test/templates.test.ts、test/command-reference-refs.test.ts、test/project-skill-templates.test.ts、test/skills-parity.test.ts | 新增 `spec-update` 技能对，**必须**同时提供 skill 版与 command 版模板；`deriveCommandId('iagent_spec_update')` ⇒ `spec-update` |
| `deriveCommandId` | src/core/templates/registry.ts:83 | 9 处调用（registry.ts、src/commands/update.ts、src/commands/init.ts、src/core/templates/index.ts） | test/templates.test.ts | 新技能自动派生 `spec-update`，无需改动派生逻辑本身 |
| `getWorkflowSkillTemplate` / `getWorkflowCommandTemplate` | src/core/templates/workflows/workflow.ts:151 / :628 | 5 / 2 处调用（registry.ts） | test/stage-continuation.test.ts、test/template-derivation.test.ts | 编排型工作流协议表；`spec-update` 为单体技能，**不进入** `WORKFLOW_PROTOCOLS`（D6） |
| `DEFAULT_WORKFLOWS` | src/core/profiles.ts:17 | 3 处调用（src/commands/onboarding.ts、profiles.ts 自身） | test/profiles.test.ts | 是否纳入默认集 **待提案阶段核准**（新增默认技能会改变默认安装集规模 → 属破坏性面，须走破坏性确认门） |
| `DEPS` | src/core/profiles.ts:58 | 3 处调用（`resolveWorkflows` 不动点迭代，profiles.ts 自身） | test/profiles.test.ts、test/stage-continuation.test.ts | `spec-update` ⇒ 实际委派清单对应的技能（`spec-apply` / `spec-verify` / `test` / `debug`）**逐条核准**后补全；死引用 MUST NOT 产生 |
| `GATE_WHITELIST` / `GateWhitelistId` | src/core/host-orchestration/protocol.ts:98 / :69 | 门校验链：`isWhitelistedGate` / `GATE_WHITELIST_ANCHORS`；下游 `evaluatePhaseTransition`、`gate-ledger.ts`（`isGateSkipId` 4 处调用、`renderGateLedgerEntry` 3 处、`resolveGateLedgerConfirmation` 2 处） | test/gate-ledger.test.ts、test/allowed-tools.test.ts、test/claude-host-adapter.test.ts、test/host-orchestration.test.ts | 正向枚举 **5 类 MUST NOT 增删**；新技能的门 MUST 归入既有类别（修订/破坏性 ⇒ `destructive-change`，不可豁免） |
| `skillDelegation` | src/core/templates/tool-whitelist.ts:93 | 16 处调用（spec-propose / spec-apply / debug / workflow / auto-workflow 等模板） | test/tool-whitelist-constants.test.ts、test/workflow-implementation-chain.test.ts、test/allowed-tools.test.ts | 新技能正文里的委派条目 MUST 走 `skillDelegation([...])` 共享常量；**MUST NOT** 手写 `Skill(...)` 字面量、**MUST NOT** 用 `Skill(*)` |
| `normalizeDelegationSkillId` | src/core/templates/tool-whitelist.ts:64 | 经 `skillDelegation` 间接调用 | test/tool-whitelist-constants.test.ts | 入参裸名 `debug` / `spec_apply` / `spec_verify` 归一化为 `iagent-debug` / `iagent-spec-apply` / `iagent-spec-verify` |
| `getChangeStatus` | src/core/spec/status.ts:156 | 4 处调用（src/commands/spec.ts 的 `runSpecStatus`） | test/spec-status.test.ts | 作为「任务已全部勾选」的**前置校验只读点**；`progress.remaining === 0` 为阻断条件 |
| `SPEC_DRIVEN_SCHEMA` | src/core/spec/schema.ts:47 | 12 处调用（src/commands/spec.ts）+ spec/archive.ts、spec/instructions.ts、spec/new-change.ts、spec/status.ts | test/markdown-spec-cli.test.ts、test/spec-instructions-apply.test.ts | 新增制品（`revision.md` / `capability-comparison.md`）**是否进 schema 登记**属提案阶段决策；不进 schema 则 MUST NOT 被主 spec 合并范围收录 |
| `detectCompleted` / `parseTaskProgress` | src/core/spec/status.ts | src/commands/spec.ts | test/spec-status.test.ts | 判定变更是否「已完成提案 + 实现」 |
| `evaluatePhaseTransition` / `PhaseSpec` | src/core/host-orchestration/transition.ts、protocol.ts | 阶段迁移阻断判定 | test/host-orchestration.test.ts | `spec-update` 若自建阶段协议，MUST 与 `GATE_WHITELIST` 对齐（D6：优先不进协议表） |
| `LEGACY_WORKFLOW_ID_MAP` | src/core/legacy-migration.ts:126 | 旧新标识映射表（唯一真源）；其**目标集合 MUST 等于注册表指令 id 集**（`test/legacy-migration.test.ts:211` 的 `toEqual` 断言 + `AGENTS.md`「映射不可能静默漂移」） | test/legacy-migration.test.ts | 新增技能须登记**同名透传**条目 `'spec-update': 'spec-update'`（先例：legacy-migration.ts:149-151 的新增能力登记）；映射表键数 23 → 24、目标去重数 22 → 23 |

### 影响面小结

- **新增为主**：主体是新增 `src/core/templates/workflows/spec-update.ts`（skill 正文唯一源 + command 版由 `derive-command.ts` 派生）、新增变更级制品（`revision.md` / `capability-comparison.md`）、新增 `openspec/docs/adr/0003`（已在探索阶段落盘）。
- **改动为辅**：`registry.ts` 成对注册、`profiles.ts` 的 `DEPS`（+ `DEFAULT_WORKFLOWS` 待核准）、`debug.ts` 的 description 排歧与降级委派目标、`host-orchestration/protocol.ts` 的门归属（**不新增类别**）。
- **回归高危面**：技能/指令白名单派生链（`skillDelegation` + `getCommandTemplates()` 单点回填）、`skills-parity` 快照一致性、门账本与 `GATE_SKIP_IDS` 交互。
- **边界约束**：所有门 MUST 归入既有 5 类白名单；`capability-comparison.md` 与 `revision.md` MUST NOT 进入主 spec 合并范围（归档时随变更目录整体移动）。

### 直接影响的文件

- `src/core/templates/workflows/spec-update.ts`（**新建**）：skill 版正文唯一源 `getSpecUpdateSkillTemplate()` + command 版 `getSpecUpdateCommandTemplate()`（经 `deriveCommandContent()` 派生）；四环节流程段、破坏性改动确认门段、回滚段、回执段；`allowedTools` 走共享常量（`CODEGRAPH_CLI` / `CODEGRAPH_MCP` / `skillDelegation([...])`）。
- `src/core/templates/registry.ts`：新增 `spec-update` 技能对导入 + `WORKFLOW_PAIRS` 成对注册条目。
- `src/core/profiles.ts`：`DEPS` 新增 `'spec-update': ['spec-apply', 'spec-verify', 'test', 'debug']`；`DEFAULT_WORKFLOWS` 不变。
- `src/core/templates/workflows/debug.ts`：description 补反向排歧句（可选增强，见任务 2.3）。
- `src/core/legacy-migration.ts`：`LEGACY_WORKFLOW_ID_MAP` 登记同名透传条目 `'spec-update': 'spec-update'`（新增技能的注册副作用；保持「映射目标集合 == 注册表指令 id 集」不变量，见任务 2.4）。
- `src/core/templates/tool-whitelist.ts`：**预期零改动**（`skillDelegation()` 已按注册表派生全部 canonical 条目，`Skill(iagent-spec-update)` 之外的委派条目无需新增共享常量）。
- `src/core/host-orchestration/protocol.ts`：**预期零改动**（5 类白名单不变；破坏性改动确认门为动作级技能内门，不进 `PhaseSpec.gate` 与 `PHASE_GATE_CATEGORY`）。
- `src/core/spec/schema.ts`：**预期零改动**（`revision.md` / `capability-comparison.md` 不登记为 artifact）。
- `skills/`（静态快照）：`pnpm build && pnpm generate:skills` 重新生成（`test/skills-parity.test.ts` 回归锁）。
- `test/`：`22 → 23` 的技能/指令计数断言同步（`templates.test.ts` / `template-derivation.test.ts` / `skills-parity.test.ts` / `commands.test.ts` / `config-command.test.ts` / `legacy-migration.test.ts` / `template-consistency.test.ts` / `command-reference-refs.test.ts` / `generation.test.ts` 等）。

### 向后兼容

无破坏性变更。既有 7 个 spec 技能与 `iagent_debug` 行为 MUST NOT 被破坏（D1）；`DEFAULT_WORKFLOWS` 不纳入 `spec-update` → 默认安装集规模不变；门白名单仍为 5 类，既有门账本与 `GATE_SKIP_IDS` 语义不变；生成产物（`skills/` 快照、`.claude/` / `.opencode/` / `.pi/` 装机产物）随模板重建，宿主技能 ID 与指令 id 派生规则不变。

### 待用户确认项（破坏性面 / 范围歧义）

- **Q1（破坏性面）**：`spec-update` 是否纳入 `DEFAULT_WORKFLOWS`？**本提案默认不纳入**（D6 硬约束 + 默认安装集规模不变）；若用户要求纳入，属默认安装集规模的破坏性变更，须走破坏性改动确认门后单独决策。
- **Q2（主规格对齐）**：`skill-profile` 主规格的「依赖注入」需求正文在本变更前即已与代码漂移（`requirement-doc` 相关条款），本变更不整体重写该共享需求；`spec-update` 的随装补全规则以新能力 `spec-update` 的 ADDED 需求承载。是否在归档期一并对齐 `skill-profile` 主规格，留待用户裁决。
- **Q3（可选增强）**：`iagent_debug` description 的反向排歧句（ADR-0003 影响段列为「可选后续 / 默认不动」）。本提案默认**采纳**（仅改路由描述文本，不改行为）；若用户不同意，任务 2.3 可直接删除而不影响其余任务。
