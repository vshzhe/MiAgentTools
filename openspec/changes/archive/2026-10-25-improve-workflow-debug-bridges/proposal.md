## Why

`workflow`、`auto-workflow` 与 `debug` 当前在提案验证和深度复查通过后自动生成需求文档；debug 又禁止自身生成，导致生成职责与归档兼容生成规则相互矛盾。显式跳过无法可靠传至后续 archive，archive 可能再次生成用户已选择跳过的文档。debug 还缺少多修复方案确认门，根因与缺陷链路确认重复分开，host protocol 将修复和验证合并为一个阶段；回归测试正文要求内联编写，但 Guardrails 和既有测试能力契约要求委派 `iagent_test`。

本变更把已确认的业务决策落实为跨模板、归档和宿主的可执行契约：由父工作流提供生成/跳过桥，持久化文档状态；debug 只在多个修复方案可行时请求方案确认，并拆分 host 阶段；下一项已授权技能直接调用，但不绕过宿主权限或能力检查。

## What Changes

- 在 `workflow`、`auto-workflow`、`debug` 的验证通过与深度复查之后增加需求文档“生成 / 跳过”业务桥；独立 `iagent_spec_verify_proposal` 仍只负责验证。
- 文档状态统一为四值模型 `absent` / `skipped-by-user` / `generation-failed` / `generated`，持久于变更 `exploration.md`；文档文件存在优先于状态，`generated` 但归档时文件缺失只 WARN 不重建。状态写入失败固定重试一次后停止：不得伪报已持久化、不得委派 `iagent_requirement_doc`、不得进入依赖该状态的下一阶段，并给出 WARN 与恢复指引。archive 状态读取失败同样固定重试一次后停止：不得视为 `absent`、不得自动生成，但按既有“需求文档检查点不阻断归档”契约输出 WARN 与恢复指引并继续归档。
- 用户确认生成后直接委派非交互 `iagent_requirement_doc`。生成失败记录 `generation-failed`、WARN 后继续；archive 不静默重试。
- 用户跳过后把 `skipped-by-user` 持久写入变更 `exploration.md`，并经 verify → apply → archive 的阶段 handoff 传递。archive 对显式跳过且文档缺失的情况不生成；已有文档仍增量对齐并保护人工域；无显式状态的历史变更保留现有兼容生成行为。
- `iagent_spec_propose` 独立调用在验证 PASS 后停止，不再自动生成需求文档（非目标；文档桥仅属三父流程），保留用户手工调用需求文档技能的能力。
- debug 将高置信根因与缺陷链路合并为一次确认；多个根因候选仍先由用户选择根因，再确认对应链路。变更归属明确后，多个可行修复方案必须等待用户确认；只有一项明确可行方案且有项目约束/代码证据时，说明依据后直通。既有数据库/schema 确认不变。
- debug 保持单一全流程 SKILL，但 host protocol 将修复与验证收束拆为 `fix` / `verify-close` 两阶段。修复阶段通过 `iagent_test` 生成回归测试，debug 校验修复前失败、修复后通过及异常/根因节点覆盖；这按现有测试能力契约收敛正文与 Guardrails 的冲突，不另造测试生成规则。
- 统一“入口意图或明确业务确认已授权下一项技能”语义：直接调用指定技能，不增加“是否调用技能”的业务二次确认。strict/degraded 能力协商、宿主工具权限和真实用户业务门仍独立生效。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `workflow-suite-skills`: 修改验证收束、需求文档调用方、debug 修复确认与测试职责、debug/父工作流技能委派契约、`auto-workflow` 全自动自述与文档桥一致。
- `spec-workflow-skills`: 修改 archive 的需求文档检查点，使其消费四值持久状态并保留历史兼容分支。
- `spec-bulk-archive-skill`: 使批量归档的归档单元需求文档检查点消费同一持久状态（含 `generated` 缺失分支与 I/O 重试一次语义）。
- `host-orchestration`: 增补需求文档状态 handoff、debug `fix` / `verify-close` 阶段与 `investigate` handoff、条件修复方案门、Pi 阶段 agent 嵌套委派授予及确认后直接委派契约。
- `tool-call-whitelist`: 使 debug 的需求文档与测试技能授权和实际委派一致，并同步归档技能委派条目的旧表述。
- `template-generation`: 同步“需求文档生成时机 / 归档阶段需求文档行为 / 自动调用方 / 模板正文一致性”四项模板侧规格，消除与三父流程文档桥及 `spec-propose` 非目标的冲突。
- `skill-profile`: 使 `debug` 的依赖注入覆盖其新增的无条件 `requirement-doc` 委派（消除指向未安装技能的死引用）。

## Impact

### 直接影响的文件

- `src/core/templates/workflows/workflow.ts`: 验证收束文案、文档桥和 archive 状态传递。
- `src/core/templates/workflows/auto-workflow.ts`: 文档选择桥、直接委派和自动后续阶段状态传递。
- `src/core/templates/workflows/debug.ts`: 根因/链路确认、修复方案门、测试委派、`verify-close` 收束与文档桥。
- `src/core/templates/workflows/requirement-doc.ts`: 移除禁止 debug 作为上层调用方的过期口径；保留技能自身的独立/非交互生成行为。
- `src/core/templates/workflows/spec-propose.ts`: 独立调用在验证 PASS 后停止，不再自动生成需求文档；移除其 `Skill(requirement_doc)` 条目（非目标）。
- `src/core/templates/workflows/spec-archive.ts`: 按四值持久状态与文件是否存在分流；已存在文档继续保护人工域并增量对齐。
- `src/core/templates/workflows/spec-bulk-archive.ts`: 批量归档单元 a.6 与单变更归档同语义（同一状态模型与 I/O 语义）。
- `src/core/host-orchestration/protocol.ts`, `workflows.ts`, `transition.ts`, `render.ts`: 阶段、条件门、回执/handoff、宿主委派表及阶段推进契约。
- `src/core/opencode-v2.ts`: 核对 OpenCode V2 项目权限与新增实际委派一致（指令以 primary orchestrator 运行，`skill: iagent-*` 已放行嵌套委派，预期无需改动）。
- `src/core/pi-native.ts`: 为编排类阶段 agent 生成 `allowed_subagents` 并报告未安装的嵌套目标缺口（`nestingGaps`），不新增 per-workflow strict 降级。
- `src/core/profiles.ts`: `DEPS.debug` 补 `requirement-doc`（无条件委派必须随装）。
- `src/core/templates/registry.ts`（模板/指令派生调用方，预期无需改变注册结构）与 `skills/`: 生成快照必须由 `pnpm generate:skills` 同步。
- 回归测试：`test/template-derivation.test.ts`、`test/templates.test.ts`、`test/template-consistency.test.ts`、`test/host-orchestration.test.ts`、`test/claude-host-adapter.test.ts`、`test/tool-whitelist-constants.test.ts`、`test/allowed-tools.test.ts`、`test/opencode-v2.test.ts`、`test/pi-native.test.ts`、`test/profiles.test.ts`、`test/artifact-dataflow.test.ts`、`test/command-reference-refs.test.ts`（后三个为既有硬断言文件，MUST 改写断言而非删除）。
- 变更交付时另按项目规则同步版本号与 `CHANGELOG.md`；本阶段不修改应用代码或快照。

### Impact Analysis

- 模板影响：`getWorkflowSkillTemplate` / `VERIFICATION_PROTOCOL_FULL`、`getAutoWorkflowSkillTemplate`、`getDebugSkillTemplate`、`getSpecVerifyProposalSkillTemplate`、`getRequirementDocSkillTemplate`、`getSpecArchiveChangeSkillTemplate`、`getSpecBulkArchiveSkillTemplate`、`getSpecProposeSkillTemplate`。`registry.ts` 派生 SKILL/命令；模板回归覆盖 template derivation、templates 与 consistency。
- 宿主影响：`WORKFLOW_PROTOCOLS`、`VERIFY_PHASE`、`APPLY_PHASE`、`ARCHIVE_PHASE`、debug 阶段及 `evaluatePhaseTransition`；`ORCHESTRATION_DELEGATIONS` 经 render 消费。既有 host orchestration 与 Claude adapter 测试需覆盖阶段序列、回执、门、能力缺失和委派清单。
- 授权影响：`skillDelegation` 的精确 `requirement_doc` / `test` 条目、OpenCode V2 `iagentPermissionRules` 与模板 `allowedTools` 必须反映真实委派，不增加通配授权或写入权限；`test/tool-whitelist-constants.test.ts`、`test/allowed-tools.test.ts`、`test/opencode-v2.test.ts` 是主要回归点。
- 调试测试职责冲突的最小一致处理：既有 `workflow-suite-skills` 与 `test-generate` 能力决策规定 `iagent_test` 是测试能力唯一规则源、debug 通过委派消费；因此统一为委派测试生成，debug 保留其缺陷链路覆盖与 fail-before/pass-after 验收，不复制框架/风格生成规则。strict 缺少委派能力时不得伪装完成；degraded 行为遵循宿主显式协商。
- **状态模型（已裁决）**：变更 `exploration.md` 的 `## 需求文档状态` 段以 `requirementDocStatus` 记录 `skipped-by-user` / `generation-failed` / `generated`；无该段即 `absent`。文档文件存在优先于状态（文件存在一律就地对齐）。写入与读取均“失败自动重试一次后停止”：写入仍失败时不伪报持久化、不委派生成、不进入依赖该状态的下一阶段；读取仍失败时不得等同 `absent`、不得自动生成，且不阻断归档。`generated` 但归档时文档缺失 → WARN 并继续，不重新生成。
- **条件门（已确认）**：`GateSpec` 增加可选 `condition`（首个取值 `'multiple-fix-options'`），`PhaseTransitionInput` 增加可选 `gateConditions?: Record<string, boolean>`。`evaluatePhaseTransition` 对未设置 `condition` 的门保持现有静态行为；设置了 `condition` 时：`gateConditions[condition] === false` → 该门不适用，跳过门确认要求；`=== true` 或该键未提供 → 门适用，仍按 `gateConfirmed` 要求确认（fail-safe）。`debug` 的 `fix` 阶段门绑定 `'multiple-fix-options'`：存在多个可行方案置 `true`，唯一且证据充分方案置 `false`。Claude / OpenCode V2 / Pi 适配共享同一判定语义；旧门默认行为 MUST NOT 改变。
- **依赖注入与 Pi 嵌套**：`debug` 的无条件 `requirement-doc` 委派必须由 `DEPS` 覆盖（`skill-profile` 能力规格同步）；Pi 编排阶段 agent 需按委派清单生成 `allowed_subagents` 并报告未安装目标缺口，不新增 per-workflow strict 降级。

### 向后兼容

- 没有文档选择状态的历史变更继续使用 archive 现有的缺失时兼容生成行为。
- `skipped-by-user` 且文件缺失时不生成；`generated` 且文件缺失时 WARN 不重建；无论状态如何，已存在文档仍按既有规则增量对齐并逐字保留人工域。
- `generation-failed` 后 archive 告警但不自动重试；用户可手工重跑需求文档技能。
- 状态写入/读取失败固定重试一次后停止，不改变既有“需求文档检查点不阻断归档”契约。
- `iagent_spec_propose` 独立调用不再自动生成需求文档，属行为变更（非目标收窄）；用户仍可手工调用需求文档技能。
- 不改变独立 verifier、需求文档技能的 standalone 模式、debug 单一 SKILL 身份、既有数据库/schema 确认，也不绕过宿主权限或 strict/degraded 检查。
