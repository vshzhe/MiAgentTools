# Tasks: skill-bridge-optimize

> **实现顺序（P1/P2 优先）**：先完成 P1/P2 对应任务 —— 6.1 / 6.2 / 7.2 / 7.5 / 4.7 / 7.7（回执可选字段、宿主技能路径回退、spec-apply 内部 test 续跑、文档同步），再执行其余任务组。P2 的 scenario advisory warning 为可选优化，不阻断实现。

<!-- 任务类型标签：[代码] / [测试][单元|功能][P0|P1|P2] / [DB脚本] / [使用说明] -->
<!-- 节点追溯：任务描述中的 [Nx] / [Mx] / [Px] 对应 exploration.md 的「功能流程图」节点清单 -->

## 1. 共享续跑契约与宿主渲染

- [x] 1.1 [代码] 在 `actions.ts` 增加阶段分类单一源（`INTERACTIVE_STAGE_WORKFLOW_IDS` / `isInteractiveStage`），Claude 分支按交互/自动阶段渲染 Skill 或前台 Agent（含子代理载入技能、EXIT GUARD、回执要求） [N2][N7]
  - 文件：`src/core/host-orchestration/actions.ts`
  - 验证：`renderDelegate('claude', 'strict', { workflowId: 'spec-explore' })` 含 Skill；`{ workflowId: 'spec-propose' }` 含 Agent 与回执要求
  - Spec Ref：`host-orchestration` / `Native host orchestration mapping`
  - Scenario Ref：`host-orchestration` / `Native host orchestration mapping` / `Claude 交互阶段使用 Skill`

- [x] 1.2 [代码] 在 `render.ts` 的宿主编排段注入「回执是中间状态 / 同一用户回合续跑 / 只有门是合法停点 / 失败不续跑」共享契约；移除 `CONDITIONAL_DELEGATIONS` 中 `workflow` / `auto-workflow` 的 `requirement-doc` [N7][P5]
  - 文件：`src/core/host-orchestration/render.ts`
  - 验证：生成的编排段含续跑契约关键字；`CONDITIONAL_DELEGATIONS['workflow']` 不含 `requirement-doc`
  - Spec Ref：`skill-stage-continuation` / `Continuation contract after delegated receipt`
  - Scenario Ref：`skill-stage-continuation` / `Continuation contract after delegated receipt` / `回执后在同一用户回合继续`

- [x] 1.3 [代码] 在 `delegation-contract.ts` 的 `renderDelegationModeContract()` 增补 delegated 的「回执后继续」语义（不改双轴取值与解析） [N7]
  - 文件：`src/core/host-orchestration/delegation-contract.ts`
  - 验证：`renderDelegationModeContract()` 含「回执后父编排在同一用户回合内继续」；`resolveDelegationContract` 两轴行为不变
  - Spec Ref：`spec-workflow-skills` / `委托模式双轴词汇单一源`
  - Scenario Ref：`spec-workflow-skills` / `委托模式双轴词汇单一源` / `delegated 回执后继续`

- [x] 1.4 [代码] 在 `protocol.ts` 复用/明确回执校验要求（`phase` / `status` / `artifact` / `nextAllowed` / `failure` / `confirmedGates`），父编排按 `invalid-receipt` 阻断 [N7]
  - 文件：`src/core/host-orchestration/protocol.ts`
  - 验证：`validateReceipt` 对缺失字段与非法 `confirmedGates` 返回 invalid；续跑契约文本引用该校验
  - Spec Ref：`skill-stage-continuation` / `Receipt validation and failure handling`
  - Scenario Ref：`skill-stage-continuation` / `Receipt validation and failure handling` / `缺字段回执被阻断`

- [x] 1.5 [测试][单元][P0] 新增续跑与委派机制的结构断言：交互阶段 Skill、自动阶段 Agent、续跑契约文本、EXIT GUARD、回执校验 [N2][N7]
  - 文件：`test/stage-continuation.test.ts`（新建）
  - 验证：`pnpm vitest run test/stage-continuation.test.ts`
  - Spec Ref：`skill-stage-continuation` / `Stage delegation mechanism`
  - Scenario Ref：`skill-stage-continuation` / `Stage delegation mechanism` / `自动阶段使用前台子代理`

- [x] 1.6 [测试][单元][P1] 断言跨宿主续跑语义一致且 Codex degraded 不伪装委派 [N2]
  - 文件：`test/stage-continuation.test.ts`（新建）
  - 验证：`pnpm vitest run test/stage-continuation.test.ts`
  - Spec Ref：`skill-stage-continuation` / `Cross-host delegation consistency`
  - Scenario Ref：`skill-stage-continuation` / `Cross-host delegation consistency` / `OpenCode / Pi / Codex 的机制与续跑语义`

## 2. 三父流程续跑接入

- [x] 2.1 [代码] `auto-workflow.ts`：Phase 1 委派保持 Skill；Phase 2/4/5 改为 Agent；为每个阶段委派点增加返回边界续跑句；Phase 3 验证后直接进入 Phase 4 [N3][N6][N10][N14]
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 验证：正文含「收到有效回执后 MUST 在同一用户回合内继续」；Skill/Agent 表述与阶段分类一致
  - Spec Ref：`workflow-suite-skills` / `确认后的下一技能直接调用`
  - Scenario Ref：`workflow-suite-skills` / `确认后的下一技能直接调用` / `回执后同回合续跑`

- [x] 2.2 [代码] `auto-workflow.ts`：删除 Phase 3 需求文档桥、状态持久化、回执 `requirementDocStatus`、Phase 5 状态传递；移除 `Skill(iagent-requirement-doc)`；更新 description 与 guardrails [P1][P2][N10][N14]
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 验证：正文、description、allowedTools 均无需求文档桥/状态/委派条目
  - Spec Ref：`workflow-suite-skills` / `auto-workflow 全自动自述与文档桥一致`
  - Scenario Ref：`workflow-suite-skills` / `auto-workflow 全自动自述与文档桥一致` / `自述与阶段说明一致`

- [x] 2.3 [代码] `auto-workflow.ts`：门账本来源改为探索回执 `flowBaselineConfirmed=true`；未确认时不写账本、不传 `gate-skip` 并暂停 [N5][N10]
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 验证：正文含「流程基准确认后写 design-confirmation」「未确认时 MUST NOT 写账本」
  - Spec Ref：`workflow-suite-skills` / `auto-workflow 全自动自述与文档桥一致`
  - Scenario Ref：`workflow-suite-skills` / `auto-workflow 全自动自述与文档桥一致` / `流程基准确认且验证通过后写门账本`

- [x] 2.4 [代码] `workflow.ts`：Phase 2/4/5 委派改 Agent + 返回边界续跑句；Phase 3.7 交付桥由五出口收缩为三出口（确认/修改/拒绝），删除文档选项与 3.5.1 状态持久化 [N6][N9][N13]
  - 文件：`src/core/templates/workflows/workflow.ts`
  - 验证：正文含三出口且无「仅生成文档」；含续跑句；无 `requirementDocStatus` 写回
  - Spec Ref：`workflow-suite-skills` / `实现桥合并（实现确认 + 测试计划）`
  - Scenario Ref：`workflow-suite-skills` / `实现桥合并（实现确认 + 测试计划）` / `三出口`

- [x] 2.5 [代码] `workflow.ts`：Phase 5 归档委派移除 `requirementDocStatus`；移除 `Skill(iagent-requirement-doc)`；更新 description / guardrails / 示例 [P2][N13]
  - 文件：`src/core/templates/workflows/workflow.ts`
  - 验证：全文无需求文档桥/状态/委派条目
  - Spec Ref：`workflow-suite-skills` / `需求文档技能的手工调用保留与自动调用方变更`
  - Scenario Ref：`workflow-suite-skills` / `需求文档技能的手工调用保留与自动调用方变更` / `三个父工作流不再调用`

- [x] 2.6 [代码] `debug.ts`：4.2 委派 `iagent-test`、7.1 委派 `spec-verify-proposal`、7.3 委派 `proposal-review` 改为 Agent + 返回边界续跑句；删除 7.3 需求文档桥、状态持久化与报告 [M6][M9][M10][M11]
  - 文件：`src/core/templates/workflows/debug.ts`
  - 验证：正文含各阶段续跑句；无需求文档桥/状态/委派条目；verify-close 直接收束
  - Spec Ref：`workflow-suite-skills` / `workflow 自动验证门与深度复查联动`
  - Scenario Ref：`workflow-suite-skills` / `workflow 自动验证门与深度复查联动` / `PASS 与深度复查后直接续跑`

- [x] 2.7 [代码] `spec-explore.ts`：delegated 段增补「回执是中间状态、同一回合继续」语义；保持提示词门/流程门不变 [N5]
  - 文件：`src/core/templates/workflows/spec-explore.ts`
  - 验证：delegated 段含续跑语义；确认门未被削弱
  - Spec Ref：`spec-workflow-skills` / `spec-explore 委派执行模式（delegated）契约`
  - Scenario Ref：`spec-workflow-skills` / `spec-explore 委派执行模式（delegated）契约` / `delegated 产出 handoff 后同回合续跑`

- [x] 2.8 [代码] `spec-propose.ts`：delegated 段增补续跑语义；interactive/delegated 均移除需求文档生成引用 [N6]
  - 文件：`src/core/templates/workflows/spec-propose.ts`
  - 验证：delegated 段含续跑；全文不再出现「文档桥只属于三父流程」等桥引用
  - Spec Ref：`spec-workflow-skills` / `spec-propose 委派执行模式（delegated）契约`
  - Scenario Ref：`spec-workflow-skills` / `spec-propose 委派执行模式（delegated）契约` / `delegated 模式抑制结尾停点并续跑`

## 3. 需求文档逻辑彻底移除

- [x] 3.1 [代码] `spec-archive.ts`：删除 4.8 需求文档只读报告、状态读取、摘要行与相关 guardrail；保留归档只读、写入面、CodeGraph 与清理 [P3]
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - 验证：全文无 `需求文档.md` / `requirementDocStatus` / 需求文档报告
  - Spec Ref：`spec-workflow-skills` / `spec-archive 归档技能`
  - Scenario Ref：`spec-workflow-skills` / `spec-archive 归档技能` / `需求文档随变更目录原样保留`

- [x] 3.2 [代码] `spec-bulk-archive.ts`：删除 a.6 需求文档只读报告、状态读取、摘要行与相关 guardrail [P3]
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`
  - 验证：全文无需求文档报告/状态读取
  - Spec Ref：`spec-workflow-skills` / `spec-archive 归档技能`
  - Scenario Ref：`spec-workflow-skills` / `spec-archive 归档技能` / `需求文档缺失时不处理`

- [x] 3.3 [代码] `spec-apply.ts`：门账本说明移除 `requirement-doc-bridge` 提及（仅保留 `implementation-bridge`）；保留 `需求文档.md` 暂存排除 [P5]
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - 验证：正文不再出现 `requirement-doc-bridge`；暂存排除仍存在
  - Spec Ref：`host-orchestration` / `确认门白名单与协议门清单对齐`
  - Scenario Ref：`host-orchestration` / `确认门白名单与协议门清单对齐` / `文档桥锚点已移除`

- [x] 3.4 [代码] `requirement-doc.ts`：调用方说明改为「独立 / 手工调用，无自动调用方」；保留独立模式与八章节规则 [P4]
  - 文件：`src/core/templates/workflows/requirement-doc.ts`
  - 验证：调用方说明不再列出三父流程/archive 自动调用
  - Spec Ref：`workflow-suite-skills` / `需求文档技能的手工调用保留与自动调用方变更`
  - Scenario Ref：`workflow-suite-skills` / `需求文档技能的手工调用保留与自动调用方变更` / `独立指令仍可手工调用`

- [x] 3.5 [代码] `protocol.ts` / `workflows.ts` / `index.ts`：删除 `RequirementDocStatus` 及 helper、`Receipt.requirementDocStatus`、`STATUS_RECEIPT`、`VERIFY_WITH_BRIDGE`、`DOC_BRIDGE_GATE`、`GATE_WHITELIST` 的 `requirement-doc-bridge` 锚点与 `PHASE_GATE_CATEGORY` 映射；auto-workflow VERIFY 改用无门阶段；debug verify-close 去门 [P5]
  - 文件：`src/core/host-orchestration/protocol.ts` / `workflows.ts` / `index.ts`
  - 验证：`grep -R "requirementDocStatus\|requirement-doc-bridge\|RequirementDocStatus" src/core/host-orchestration` 无命中；`auditGateWhitelistAlignment()` 返回空数组
  - Spec Ref：`host-orchestration` / `auto-workflow 协议阶段门与模板声明一致`
  - Scenario Ref：`host-orchestration` / `auto-workflow 协议阶段门与模板声明一致` / `auto-workflow 全阶段无阻塞门`

- [x] 3.6 [代码] `gate-ledger.ts`：注释中的 `requirement-doc-bridge` 提及收敛为 `implementation-bridge`（或泛化表述） [P5]
  - 文件：`src/core/host-orchestration/gate-ledger.ts`
  - 验证：注释无 `requirement-doc-bridge`
  - Spec Ref：`host-orchestration` / `确认门白名单与协议门清单对齐`
  - Scenario Ref：`host-orchestration` / `确认门白名单与协议门清单对齐` / `文档桥锚点已移除`

- [x] 3.7 [代码] `profiles.ts`：从 `DEPS.workflow` / `DEPS.auto-workflow` / `DEPS.debug` 移除 `requirement-doc` 并更新注释 [P5]
  - 文件：`src/core/profiles.ts`
  - 验证：`DEPS` 三项均不含 `requirement-doc`；`resolveWorkflows(['debug'])` 仅注入 `spec-verify-proposal`
  - Spec Ref：`host-orchestration` / `编排适配注入面按模板委派派生`
  - Scenario Ref：`host-orchestration` / `编排适配注入面按模板委派派生` / `需求文档不再出现在条件委派表`

## 4. 测试、快照与文档

- [x] 4.1 [测试][单元][P0] 更新 `test/host-orchestration.test.ts`：删除文档状态/桥门断言，新增续跑契约、auto-workflow 无门、debug verify-close 无门、白名单无 `requirement-doc-bridge` 断言
  - 文件：`test/host-orchestration.test.ts`
  - 验证：`pnpm vitest run test/host-orchestration.test.ts`
  - Spec Ref：`host-orchestration` / `确认门白名单与协议门清单对齐`
  - Scenario Ref：`host-orchestration` / `确认门白名单与协议门清单对齐` / `文档桥锚点已移除`

- [x] 4.2 [测试][单元][P0] 更新 `test/artifact-dataflow.test.ts`：A2/A3/A5/A6/A8/A10 相关断言改为「无文档桥 / 无只读报告 / DEPS 不注入 requirement-doc」
  - 文件：`test/artifact-dataflow.test.ts`
  - 验证：`pnpm vitest run test/artifact-dataflow.test.ts`
  - Spec Ref：`workflow-suite-skills` / `需求文档技能的手工调用保留与自动调用方变更`
  - Scenario Ref：`workflow-suite-skills` / `需求文档技能的手工调用保留与自动调用方变更` / `归档侧不再读取或报告`

- [x] 4.3 [测试][单元][P0] 更新 `test/allowed-tools.test.ts` / `test/tool-whitelist-constants.test.ts` / `test/claude-host-adapter.test.ts` / `test/opencode-v2.test.ts` / `test/pi-native.test.ts`：移除 `requirement-doc` 委派/授予断言，新增 Agent 自动阶段与续跑断言
  - 文件：`test/allowed-tools.test.ts` / `test/tool-whitelist-constants.test.ts` / `test/claude-host-adapter.test.ts` / `test/opencode-v2.test.ts` / `test/pi-native.test.ts`
  - 验证：`pnpm vitest run test/allowed-tools.test.ts test/tool-whitelist-constants.test.ts test/claude-host-adapter.test.ts test/opencode-v2.test.ts test/pi-native.test.ts`
  - Spec Ref：`skill-stage-continuation` / `Stage delegation mechanism`
  - Scenario Ref：`skill-stage-continuation` / `Stage delegation mechanism` / `子代理载入失败报告 blocked`

- [x] 4.4 [测试][单元][P1] 更新 `test/profiles.test.ts` / `test/commands.test.ts` / `test/legacy-migration.test.ts`：DEPS 与安装集断言移除 `requirement-doc`
  - 文件：`test/profiles.test.ts` / `test/commands.test.ts` / `test/legacy-migration.test.ts`
  - 验证：`pnpm vitest run test/profiles.test.ts test/commands.test.ts test/legacy-migration.test.ts`
  - Spec Ref：`host-orchestration` / `编排适配注入面按模板委派派生`
  - Scenario Ref：`host-orchestration` / `编排适配注入面按模板委派派生` / `需求文档不再出现在条件委派表`

- [x] 4.5 [测试][单元][P1] 更新 `test/spec-workflow-contract.test.ts` / `test/template-consistency.test.ts` / `test/template-derivation.test.ts` / `test/templates.test.ts` / `test/command-reference-refs.test.ts`：文档桥/状态断言改为「移除 + 续跑」口径
  - 文件：`test/spec-workflow-contract.test.ts` / `test/template-consistency.test.ts` / `test/template-derivation.test.ts` / `test/templates.test.ts` / `test/command-reference-refs.test.ts`
  - 验证：`pnpm vitest run test/spec-workflow-contract.test.ts test/template-consistency.test.ts test/template-derivation.test.ts test/templates.test.ts test/command-reference-refs.test.ts`
  - Spec Ref：`workflow-suite-skills` / `workflow 提案阶段委派 spec-propose`
  - Scenario Ref：`workflow-suite-skills` / `workflow 提案阶段委派 spec-propose` / `回执后直接进入验证`

- [x] 4.6 [测试][功能][P0] 全量回归：`pnpm build && pnpm generate:skills && pnpm test`
  - 文件：`skills/**` / `dist/**`
  - 验证：构建成功、快照与模板一致、全量测试通过
  - Spec Ref：`skill-stage-continuation` / `Stage delegation mechanism`
  - Scenario Ref：`skill-stage-continuation` / `Stage delegation mechanism` / `自动阶段使用前台子代理`

- [x] 4.7 [使用说明] 更新 `docs/openspec-comparison.md` / `AGENTS.md` / `README.md` / `openspec/CONTEXT.md` 中关于需求文档桥与委派机制的表述
  - 文件：`docs/openspec-comparison.md` / `AGENTS.md` / `README.md` / `openspec/CONTEXT.md`
  - 验证：`grep -R "需求文档桥\|requirementDocStatus\|requirement-doc-bridge" docs AGENTS.md README.md openspec/CONTEXT.md` 无遗留（历史说明除外）
  - 产出：`attachments/doc-sync-report.md`
  - Spec Ref：`workflow-suite-skills` / `需求文档技能的手工调用保留与自动调用方变更`
  - Scenario Ref：`workflow-suite-skills` / `需求文档技能的手工调用保留与自动调用方变更` / `独立指令仍可手工调用`

- [x] 4.8 [使用说明] 版本递增与变更日志：运行 `node bin/iagent.js version bump`（预期 major），同步 CHANGELOG / README 版本示例
  - 文件：`package.json` / `CHANGELOG.md` / `README.md`
  - 验证：`node bin/iagent.js version` 判定与写回一致；`[Unreleased]` 归档为新版本小节
  - 产出：`attachments/version-bump-report.md`
  - Spec Ref：`host-orchestration` / `Native host orchestration mapping`
  - Scenario Ref：`host-orchestration` / `Native host orchestration mapping` / `Claude 自动阶段使用前台 Agent`

## 5. 补充覆盖与追溯

- [x] 5.1 [测试][单元][P1] 断言续跑不绕过宿主权限与会话权限，业务门授权范围有限
  - 文件：`test/stage-continuation.test.ts`（新建）
  - 验证：`pnpm vitest run test/stage-continuation.test.ts`
  - Spec Ref：`skill-stage-continuation` / `Authorization and permissions`
  - Scenario Ref：`skill-stage-continuation` / `Authorization and permissions` / `权限拒绝仍阻断`

- [x] 5.2 [测试][单元][P1] 断言门阻断、有效回执同回合继续、适配器不发明门
  - 文件：`test/host-orchestration.test.ts`
  - 验证：`pnpm vitest run test/host-orchestration.test.ts`
  - Spec Ref：`host-orchestration` / `Gate and receipt enforcement`
  - Scenario Ref：`host-orchestration` / `Gate and receipt enforcement` / `有效回执后同回合继续`

- [x] 5.3 [测试][单元][P1] 断言已授权下一技能直接调用且回执后直接续跑
  - 文件：`test/host-orchestration.test.ts`
  - 验证：`pnpm vitest run test/host-orchestration.test.ts`
  - Spec Ref：`host-orchestration` / `已授权技能推进不增加重复业务确认`
  - Scenario Ref：`host-orchestration` / `已授权技能推进不增加重复业务确认` / `回执后直接续跑`

- [x] 5.4 [测试][单元][P1] 断言 debug 阶段协议：investigate handoff、verify-close 无文档桥
  - 文件：`test/host-orchestration.test.ts`
  - 验证：`pnpm vitest run test/host-orchestration.test.ts`
  - Spec Ref：`host-orchestration` / `debug host protocol 拆分 fix 与 verify-close`
  - Scenario Ref：`host-orchestration` / `debug host protocol 拆分 fix 与 verify-close` / `verify-close 消费 fix 结果且无文档桥`

- [x] 5.5 [测试][单元][P1] 断言 Pi 嵌套委派不再授予 `requirement-doc`
  - 文件：`test/pi-native.test.ts`
  - 验证：`pnpm vitest run test/pi-native.test.ts`
  - Spec Ref：`host-orchestration` / `Pi 编排阶段 agent 的嵌套委派授予`
  - Scenario Ref：`host-orchestration` / `Pi 编排阶段 agent 的嵌套委派授予` / `需求文档技能不再出现在嵌套委派面`

- [x] 5.6 [测试][单元][P1] 断言 `RequirementDocStatus` 与跨阶段 handoff 已移除、历史文件保持只读
  - 文件：`test/gate-ledger.test.ts` / `test/host-orchestration.test.ts`
  - 验证：`pnpm vitest run test/gate-ledger.test.ts test/host-orchestration.test.ts`
  - Spec Ref：`host-orchestration` / `auto-workflow 协议阶段门与模板声明一致`
  - Scenario Ref：`host-orchestration` / `auto-workflow 协议阶段门与模板声明一致` / `debug 的 verify-close 无阻塞门`

- [x] 5.7 [测试][单元][P1] 断言 auto-workflow Phase 4/5 经 Agent 委派且不传 `requirementDocStatus`
  - 文件：`test/artifact-dataflow.test.ts`
  - 验证：`pnpm vitest run test/artifact-dataflow.test.ts`
  - Spec Ref：`workflow-suite-skills` / `auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议`
  - Scenario Ref：`workflow-suite-skills` / `auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议` / `Phase 4 委派而非内联`

- [x] 5.8 [测试][单元][P1] 断言门白名单、直通句与返回边界续跑句齐备
  - 文件：`test/templates.test.ts`
  - 验证：`pnpm vitest run test/templates.test.ts`
  - Spec Ref：`workflow-suite-skills` / `编排技能门白名单与直通句`
  - Scenario Ref：`workflow-suite-skills` / `编排技能门白名单与直通句` / `workflow 补直通句与续跑句`

- [x] 5.9 [测试][单元][P1] 断言 receipt 为中间状态、有效回执推进、缺失/非法回执阻断
  - 文件：`test/host-orchestration.test.ts`
  - 验证：`pnpm vitest run test/host-orchestration.test.ts`
  - Spec Ref：`workflow-suite-skills` / `Receipt-based phase transition`
  - Scenario Ref：`workflow-suite-skills` / `Receipt-based phase transition` / `Valid receipt advances`

## 6. 子代理数据共享与 token 预算

- [x] 6.1 [代码] 定义 Stage Envelope / Stage Receipt 结构与 token 预算常量（Envelope ≤2KB、Receipt ≤40 行/≤2KB、handoff 包每节 ≤120 行）；`Receipt` 增加 `blockedGate` / `resumeHint` 字段；`renderDelegate` 的 Agent prompt 只引用路径、不内联制品或 SKILL.md [N7][N7E]
  - 文件：`src/core/host-orchestration/protocol.ts` / `actions.ts` / `render.ts`
  - 验证：类型与常量可导入；`renderDelegate` 输出不含制品正文；回执校验接受 `blockedGate` / `resumeHint`
  - Spec Ref：`skill-stage-continuation` / `Stage context envelope and data completeness`
  - Scenario Ref：`skill-stage-continuation` / `Stage context envelope and data completeness` / `完整 Envelope 允许阶段执行`

- [x] 6.2 [代码] 三父流程与 spec 阶段模板加入「先读 handoff 包 / 只增量读取 / 包缺口回执 / 回执上限 / blocked resume」规则；父级委派前做一次 `sourceFingerprint` 校验与必要时重建 [N5][N7][N7E][M6]
  - 文件：`src/core/templates/workflows/auto-workflow.ts` / `workflow.ts` / `debug.ts` / `spec-explore.ts` / `spec-propose.ts` / `spec-apply.ts` / `spec-verify.ts` / `spec-archive.ts`
  - 验证：模板正文含「先读 handoff 包」「MUST NOT 内联制品正文」「回执 ≤40 行」「resume=true」等约束
  - Spec Ref：`skill-stage-continuation` / `Token budget and context isolation`
  - Scenario Ref：`skill-stage-continuation` / `Token budget and context isolation` / `不内联制品与技能正文`

- [x] 6.3 [测试][单元][P0] 断言 Envelope 完整性：缺路径返回 `incomplete`、陈旧指纹重建/失败不委派、包缺口回执可解析
  - 文件：`test/stage-continuation.test.ts`（新建）
  - 验证：`pnpm vitest run test/stage-continuation.test.ts`
  - Spec Ref：`skill-stage-continuation` / `Stage context envelope and data completeness`
  - Scenario Ref：`skill-stage-continuation` / `Stage context envelope and data completeness` / `缺少必需路径时不猜测`

- [x] 6.4 [测试][单元][P1] 断言 token 预算：回执行数/字节上限、prompt 不含制品正文、handoff 包每节上限、禁止后台 Agent
  - 文件：`test/stage-continuation.test.ts`（新建）
  - 验证：`pnpm vitest run test/stage-continuation.test.ts`
  - Spec Ref：`skill-stage-continuation` / `Token budget and context isolation`
  - Scenario Ref：`skill-stage-continuation` / `Token budget and context isolation` / `回执保持在预算内`

- [x] 6.5 [测试][单元][P1] 断言 blocked resume：白名单门 → 父级门 → 账本 → `resume=true` 重委派；部分写入后重试跳过已完成；未知 blockedGate 停止
  - 文件：`test/stage-continuation.test.ts`（新建）
  - 验证：`pnpm vitest run test/stage-continuation.test.ts`
  - Spec Ref：`skill-stage-continuation` / `Blocked stage resume protocol`
  - Scenario Ref：`skill-stage-continuation` / `Blocked stage resume protocol` / `阶段内门阻塞后恢复`

- [x] 6.6 [使用说明] 在 handoff 包契约文档与开发文档中补充 Stage Envelope / Stage Receipt / token 预算 / blocked resume 说明
  - 文件：`docs/openspec-comparison.md` / `AGENTS.md` / `README.md`
  - 验证：文档含 Envelope / Receipt / 预算 / resume 四组说明，且与实现一致
  - 产出：`attachments/stage-data-sharing-report.md`
  - Spec Ref：`skill-stage-continuation` / `Stage context envelope and data completeness`
  - Scenario Ref：`skill-stage-continuation` / `Stage context envelope and data completeness` / `包缺口回执`

## 7. 二次审查修正（数据完整性 / 业务合理性）

- [x] 7.1 [代码] `propose` 阶段 handoff 增补 `explorationFile` / `handoffPackPath` / `sourceFingerprint`；父编排使用这些路径推进后续阶段，不依赖会话缓存 [N6]
  - 文件：`src/core/host-orchestration/workflows.ts` / `src/core/templates/workflows/spec-propose.ts`
  - 验证：`PROPOSE_PHASE.handoff` 含三字段；propose 回执与模板输出一致
  - Spec Ref：`host-orchestration` / `Shared workflow protocol`
  - Scenario Ref：`host-orchestration` / `Shared workflow protocol` / `Propose handoff carries exploration and pack paths`

- [x] 7.2 [代码] `Receipt` 增加 `blockedReason` / `reportPath` / `reviewSummary`；`proposal-review` / `verify` 回执携带报告路径与 ≤2KB 摘要；`blockedReason` 触发父级用户决策后以 `userDecision` + `resume=true` 重委派 [N7E][M10]
  - 文件：`src/core/host-orchestration/protocol.ts` / `actions.ts` / `render.ts` / `src/core/templates/workflows/debug.ts`
  - 验证：类型与校验支持新字段；范围蔓延等非门类阻塞可恢复，不死锁
  - Spec Ref：`skill-stage-continuation` / `Blocked stage resume protocol`
  - Scenario Ref：`skill-stage-continuation` / `Blocked stage resume protocol` / `非门类用户决策后恢复`

- [x] 7.3 [代码] `auto-workflow` 门账本写入条件收紧为 `flowBaselineConfirmed=true` **且**验证 PASS + 深度复查收束；验证/复查未收束时不写账本、不传 `gate-skip` 并暂停 [N8][N10]
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 验证：正文明确双条件；未满足时暂停；完成摘要仍展示验证分数与复查结论
  - Spec Ref：`workflow-suite-skills` / `auto-workflow 全自动自述与文档桥一致`
  - Scenario Ref：`workflow-suite-skills` / `auto-workflow 全自动自述与文档桥一致` / `流程基准确认且验证通过后写门账本`

- [x] 7.4 [代码] 验证阶段自动修复改动制品后，父编排按新 `sourceFingerprint` 重建 handoff 包一次，再进入实现；重建失败则 `incomplete` 不委派 [N8][N10]
  - 文件：`src/core/templates/workflows/workflow.ts` / `auto-workflow.ts`
  - 验证：正文含「自动修复后重建包」；指纹更新；失败不进入实现
  - Spec Ref：`skill-stage-continuation` / `Stage context envelope and data completeness`
  - Scenario Ref：`skill-stage-continuation` / `Stage context envelope and data completeness` / `陈旧 handoff 包`

- [x] 7.5 [代码] `spec-apply` 内部 `iagent-test` 委派增加「返回后 MUST 继续批次调度」；`migration` / `project-init` 的 Agent 渲染纳入回归范围（`renderDelegate` 全局生效的副作用） [M6]
  - 文件：`src/core/templates/workflows/spec-apply.ts` / `migration.ts` / `project-init.ts`
  - 验证：`spec-apply` 正文含续跑句；migration / project-init 的委派渲染为 Agent 且回执续跑
  - Spec Ref：`skill-stage-continuation` / `Stage delegation mechanism`
  - Scenario Ref：`skill-stage-continuation` / `Stage delegation mechanism` / `自动阶段使用前台子代理`

- [x] 7.6 [测试][单元][P0] 覆盖二次审查修正：propose handoff 三字段、blockedReason/reportPath/reviewSummary、auto-workflow 双条件、自动修复后重建包、migration/project-init Agent 渲染
  - 文件：`test/stage-continuation.test.ts` / `test/host-orchestration.test.ts` / `test/artifact-dataflow.test.ts` / `test/claude-host-adapter.test.ts`
  - 验证：`pnpm vitest run test/stage-continuation.test.ts test/host-orchestration.test.ts test/artifact-dataflow.test.ts test/claude-host-adapter.test.ts`
  - Spec Ref：`skill-stage-continuation` / `Blocked stage resume protocol`
  - Scenario Ref：`skill-stage-continuation` / `Blocked stage resume protocol` / `部分写入后的失败重试`

- [x] 7.7 [使用说明] 文档补充：Stage Envelope/Receipt 字段、`blockedReason` / `reportPath` / `reviewSummary`、auto-workflow 无验证后用户门但有质量报告、migration/project-init 的 Agent 渲染
  - 文件：`docs/openspec-comparison.md` / `AGENTS.md` / `README.md`
  - 验证：文档与实现字段一致；无需求文档桥残留
  - 产出：`attachments/stage-data-sharing-report.md`
  - Spec Ref：`host-orchestration` / `Shared workflow protocol`
  - Scenario Ref：`host-orchestration` / `Shared workflow protocol` / `Review stage carries report path`
