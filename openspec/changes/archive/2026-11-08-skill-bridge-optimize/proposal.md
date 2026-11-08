## Why

`auto-workflow` / `debug`（以及同构的 `workflow`）在委派阶段子技能后停住：子技能按 delegated 契约输出结构化回执，模型把"交回编排器"理解为本轮结束，下一阶段没有被触发。现有"直通句"只约束阶段**入口**，没有约束**委派返回边界**；同时 Claude 宿主的 `renderDelegate` 只渲染 `Skill` 工具委派，未使用已声明的 `Agent` 子代理通道。结果是本应自动连续执行的阶段需要用户反复发消息推进。

另一方面，需求文档生成逻辑分散在 `workflow` / `auto-workflow` / `debug` / `spec-propose` / `spec-archive` / `spec-bulk-archive` 中：三父流程各有一次生成/跳过桥、`requirementDocStatus` 跨阶段持久化、归档侧只读报告、协议门与回执字段、依赖注入与白名单条目。这使需求文档成为主流程的耦合点与额外停点，而它本应是一个独立的按需能力。

现在推进的理由：两类问题都已在真实使用中暴露；且当前模板/协议对委派机制与需求文档的假设互相纠缠，越晚拆分，同构漂移面越大。

## What Changes

- **BREAKING —— 委派续跑机制**：Claude 宿主改为**混合委派** —— 交互阶段（仅 `spec-explore`）保留 `Skill` 内联（提示词门 / 流程最终确认门可用）；自动阶段（`spec-propose` / `spec-verify-proposal` / `proposal-review` / `test` / `spec-apply` / `spec-verify` / `spec-archive`）改为**前台 `Agent` 子代理**执行，父级收到 `tool_result` 后在同一用户回合继续下一阶段。`workflow` / `auto-workflow` / `debug` 三父流程同步接入。
- **BREAKING —— 新增共享续跑契约**：在宿主编排共享层（`render.ts` / `delegation-contract.ts`）注入统一契约 —— 回执是中间状态，不是终态回复；`status=ok` 且回执校验通过后 MUST 在同一用户回合继续；`blocked` / `failed` / `incomplete` 按重试策略暂停；只有门白名单内的确认门是合法停点。被委派技能（`spec-explore` / `spec-propose` / `spec-apply` 等）的 delegated 表述同步为"回执后继续"语义。
- **子代理数据共享与 token 预算**：父级向自动阶段子代理传递 **Stage Envelope**（路径 + 结构化字段，不内联制品正文或完整 SKILL.md）；子代理先读 handoff 包、只增量读取、包缺口回执；最终消息仅含 **Stage Receipt**（≤40 行 / ≤2KB）；handoff 包每节 ≤120 行；委派前校验 `sourceFingerprint`；blocked 阶段经门确认后以 `resume=true` 幂等重委派；禁止后台 Agent 与同制品重复全量读取。
- **二次审查修正**：`propose` handoff 增补 `explorationFile` / `handoffPackPath` / `sourceFingerprint`；`Receipt` 增补 `blockedReason`（非门类用户决策）/ `reportPath` / `reviewSummary`；`auto-workflow` 门账本写入条件收紧为「流程基准确认 **且** 验证 PASS + 深度复查收束」，验证分数与复查结论在报告中呈现；验证自动修复后父级重建 handoff 包；`spec-apply` 内部 `iagent-test` 委派增加返回后续跑；`migration` / `project-init` 的 Agent 渲染纳入回归（`renderDelegate` 全局生效的副作用）。
- **BREAKING —— 需求文档逻辑整体移除**：删除 `workflow` 的 Phase 3.5 文档桥与 3.5.1 状态持久化、`auto-workflow` 的 Phase 3 文档桥、`debug` 的 7.3 文档桥；删除 `spec-propose` 的文档桥引用；删除 `spec-archive` 4.8 与 `spec-bulk-archive` a.6 的只读报告；删除 `RequirementDocStatus` / `REQUIREMENT_DOC_STATUS_FIELD` / `normalizeRequirementDocStatus` / `Receipt.requirementDocStatus`、`requirement-doc-bridge` 门与白名单锚点、`STATUS_RECEIPT` / `VERIFY_WITH_BRIDGE`、协议 input/handoff 中的文档状态字段。
- **BREAKING —— 独立技能定位**：`iagent-requirement-doc` 只保留独立 / 手工调用；从 `DEPS.workflow` / `DEPS.auto-workflow` / `DEPS.debug` 与三父流程 `allowedTools` 的 `Skill(iagent-requirement-doc)` 条目中移除；不再随三父流程自动注入安装。`requirement-doc.ts` 的调用方说明改为"无自动调用方"。
- `workflow` Phase 3.7 交付桥由五出口收缩为三出口（确认 / 修改 / 拒绝）；"仅生成文档"出口删除。
- 保留：`spec-apply` / `commit` 对 `需求文档.md` 的暂存排除（独立技能仍可能产出该文件，排除是提交安全规则）；`migration` 的"源需求文档"与 `feature-doc` 的"迁移需求实现文档"语义不变。
- 宿主一致性：OpenCode 保持 `subagent` 机制、Pi strict 保持 Agent 机制、Codex 保持显式 degraded 本地执行；三者统一注入续跑契约文本，不伪装委派完成。
- 版本与快照：按实现影响面递增版本（预期 major），更新 CHANGELOG / README 版本示例；`pnpm build && pnpm generate:skills` 重建 `skills/` 快照；同步受影响的模板 / 协议 / 注入测试。

## Capabilities

### New Capabilities

- `skill-stage-continuation`: 编排阶段之间的续跑契约 —— 交互阶段与自动阶段的划分、前台 Agent 子代理委派、回执校验与失败暂停、确认门作为合法停点、Stage Envelope / Stage Receipt / token 预算、blocked resume、跨宿主渲染一致性。

### Modified Capabilities

- `host-orchestration`: 宿主原生委派渲染新增"交互阶段 Skill / 自动阶段 Agent"分支；阶段协议移除 `requirement-doc-bridge` 门与 `requirementDocStatus` handoff/回执字段；`GATE_WHITELIST` 的 `requirement-clarification` 锚点收缩；`CONDITIONAL_DELEGATIONS` 移除 `requirement-doc`。
- `workflow-suite-skills`: `workflow` / `auto-workflow` / `debug` 移除需求文档桥与状态持久化；接入续跑契约与 Agent 子代理委派；`auto-workflow` 验证阶段不再有阻塞门；`debug` verify-close 直接收束；`workflow` 交付桥出口收缩。
- `spec-workflow-skills`: `spec-propose` 移除文档桥引用并明确独立技能手工调用；`spec-archive` / `spec-bulk-archive` 移除需求文档只读报告与状态读取；`spec-apply` 的门账本说明移除 `requirement-doc-bridge` 提及；delegated 回执语义统一为"回执后继续"。

## Impact

### 直接影响的文件

- `src/core/host-orchestration/actions.ts`: `renderDelegate` 增加交互 / 自动阶段分支；Claude 自动阶段渲染前台 Agent 子代理。
- `src/core/host-orchestration/render.ts`: 注入续跑契约；移除 `CONDITIONAL_DELEGATIONS` 中的 `requirement-doc`。
- `src/core/host-orchestration/delegation-contract.ts`: `renderDelegationModeContract` 增补"回执后继续"语义（不改双轴取值）。
- `src/core/host-orchestration/workflows.ts`: 移除 `STATUS_RECEIPT` / `DOC_BRIDGE_GATE` / `VERIFY_WITH_BRIDGE`；收缩 `VERIFY_PHASE`、`APPLY_PHASE`、`ARCHIVE_PHASE`、`AUTO_APPLY_PHASE`、`AUTO_ARCHIVE_PHASE`、`DEBUG_VERIFY_CLOSE` 的文档相关字段与门。
- `src/core/host-orchestration/protocol.ts`: 删除 `RequirementDocStatus` 及其 helper、`Receipt.requirementDocStatus`、`GATE_WHITELIST` 的 `requirement-doc-bridge` 锚点、`PHASE_GATE_CATEGORY` 映射；`Receipt` 增加 `blockedGate` / `resumeHint`（子代理阻塞与续跑）。
- `src/core/host-orchestration/actions.ts` / `render.ts`: Agent prompt 只传 Stage Envelope（路径 + 结构化字段），不内联制品正文或完整 SKILL.md；注入「先读 handoff 包 / 只增量读取 / 回执上限 / blocked resume」约束。
- `src/core/host-orchestration/index.ts`: 同步导出删除。
- `src/core/host-orchestration/gate-ledger.ts`: 注释中的 `requirement-doc-bridge` 提及收敛。
- `src/core/profiles.ts`: `DEPS` 移除 `requirement-doc` 并更新注释。
- `src/core/templates/workflows/auto-workflow.ts`: 委派改 Agent、移除文档桥 / 状态 / 白名单条目、更新 description 与 guardrails。
- `src/core/templates/workflows/workflow.ts`: 同上；交付桥五出口→三出口；Phase 5 移除文档状态传递。
- `src/core/templates/workflows/debug.ts`: 委派改 Agent、移除 7.3 文档桥 / 状态 / 报告 / 白名单条目。
- `src/core/templates/workflows/spec-explore.ts`: delegated 契约增补"回执后继续"。
- `src/core/templates/workflows/spec-propose.ts`: 移除文档桥引用；delegated 回执语义统一。
- `src/core/templates/workflows/spec-apply.ts`: 门账本说明移除 `requirement-doc-bridge`；内部 `iagent-test` 委派增加「返回后继续批次调度」。
- `src/core/templates/workflows/migration.ts` / `project-init.ts`: `renderDelegate` 全局生效后，其自动阶段委派渲染为前台 Agent；同步回归断言。
- `src/core/templates/workflows/spec-archive.ts` / `spec-bulk-archive.ts`: 移除需求文档只读报告与状态读取。
- `src/core/templates/workflows/requirement-doc.ts`: 调用方说明改为"独立 / 手工调用，无自动调用方"。
- `skills/**`: `pnpm generate:skills` 重建快照。
- 测试：`test/stage-continuation.test.ts`（新建）、`test/artifact-dataflow.test.ts`、`test/allowed-tools.test.ts`、`test/host-orchestration.test.ts`、`test/profiles.test.ts`、`test/spec-workflow-contract.test.ts`、`test/template-consistency.test.ts`、`test/template-derivation.test.ts`、`test/templates.test.ts`、`test/command-reference-refs.test.ts`、`test/claude-host-adapter.test.ts`、`test/opencode-v2.test.ts`、`test/pi-native.test.ts`、`test/legacy-migration.test.ts`、`test/commands.test.ts`、`test/gate-ledger.test.ts`、`test/tool-whitelist-constants.test.ts`。
- `docs/openspec-comparison.md` / `AGENTS.md` / `README.md`（如含需求文档桥或委派机制表述）: 同步更新。

### 向后兼容

- **BREAKING**：三父流程不再生成 / 询问需求文档；`requirement-doc` 不再随三父流程自动安装；`RequirementDocStatus` 与 `requirement-doc-bridge` 从公共 API 与协议中移除。
- 历史变更中的 `需求文档.md` 与 `exploration.md` 的 `## 需求文档状态` 段**原样保留**；归档侧不再读取、报告、生成或迁出，不提供迁移步骤。
- 既有装机由 `iagent update` 重新生成技能与指令产物；若用户仍需要需求文档，显式在 `config.yaml` 的 `workflows` 中加入 `requirement-doc` 并手工调用。
- 提交 / 暂存侧继续排除 `需求文档.md`，不改变提交安全行为。
