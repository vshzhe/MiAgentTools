## MODIFIED Requirements

### Requirement: debug host protocol 拆分 fix 与 verify-close

debug 仍是单一 `iagent_debug` 全流程 SKILL；宿主无关 `WORKFLOW_PROTOCOLS.debug` SHALL 将阶段表达为 `investigate` → `fix` → `verify-close`，使修复方案决策/实施与编译、同步、提案验证、深度复查和文档桥收束职责分开。`investigate` SHALL 交付 `rootCause` / `defectChain` / `changeName` / `affectedSymbols` / `fixDecision`；变更归属判定（`changeName` 的产生）与修复方案决策（`fixDecision` 的产生）SHALL 同属 `investigate` 的收束动作 —— 因 debug 采用「诊断 + 方案」合并确认包，修复方案在 `investigate` 的单一确认包内随根因一并确认。`fix` SHALL 以 `rootCause` / `defectChain` / `changeName` / `fixDecision` 为必需输入，handoff 修复结果与回归测试结果；`verify-close` 消费修复结果并交付验证/收束结果及文档状态。

**合并确认面不改变门预算**：`investigate` 与 `fix` 的阶段门声明 SHALL 保持既有形状 —— `investigate` 绑定 `diagnostic-confirmation`（`blocking: true`，语义扩为「诊断 + 方案」包），`fix` 绑定 `fix-option-confirmation`（`blocking: true`，`condition: 'multiple-fix-options'`）。合并包已产出 `fixDecision` 时该条件门通常不适用；仅当 `investigate` 因「变更归属依赖根因外上下文」退回两次停点时，`fix` 的方案门才在存在多个可行方案时阻塞。`GATE_WHITELIST` SHALL 仍为 5 类、锚点集合逐字不变，`diagnostic-confirmation` 与 `fix-option-confirmation` MUST 继续挂在 `requirement-clarification` 类别下；每阶段至多 1 个阻塞门。

修复方案确认门 SHALL 仅在存在多个可行方案时阻塞；单一明确可行且证据充分的方案须记录其证据并直通。该条件门 SHALL 以宿主无关契约表达：`GateSpec` 增加可选 `condition`（首个取值 `'multiple-fix-options'`），`PhaseTransitionInput` 增加可选 `gateConditions?: Record<string, boolean>`。`evaluatePhaseTransition` 的判定为：门的 `condition` 未设置 → 保持现有静态门行为；`gateConditions[condition] === false` → 该门不适用并跳过门确认要求（即使 `gateConfirmed` 为 false 也不得以 `gate-unconfirmed` 阻塞）；`=== true` 或该键未提供 → 门适用，仍按 `gateConfirmed` 要求确认（fail-safe）。`debug` 的 `fix` 阶段门绑定 `'multiple-fix-options'`：多个可行方案置 `true`，唯一且证据充分方案置 `false`。Claude / OpenCode V2 / Pi 适配 SHALL 共享同一判定语义；任何既有未声明 `condition` 的门行为 MUST NOT 改变。`verify-close` 内仍只保留确认后的文档生成/跳过桥；strict 缺少必要能力时阻断，degraded 必须明确标记，不得伪装为成功委派。

#### Scenario: debug 阶段顺序与单一技能保持

- **WHEN** 宿主读取 debug 工作流协议
- **THEN** 阶段顺序为 `investigate`、`fix`、`verify-close`；用户仍只调用一个 `iagent_debug` 全流程技能

#### Scenario: investigate 交付 fix 所需输入

- **WHEN** `investigate` 阶段收束
- **THEN** 其 handoff MUST 含 `rootCause`、`defectChain`、`changeName`、`affectedSymbols`、`fixDecision`；缺失任一必需字段时 `fix` MUST NOT 启动，并按回执校验规则报告不完整

#### Scenario: 合并包使 fix 方案门不再二次阻塞

- **WHEN** `investigate` 的「诊断 + 方案」包已确认并交付 `fixDecision`，且该决策对应唯一可行方案（`gateConditions['multiple-fix-options'] === false`）
- **THEN** `fix` 阶段的 `fix-option-confirmation` 门不适用，阶段在回执有效后推进，MUST NOT 制造第二次方案确认停点

#### Scenario: 回退路径下多方案仍阻塞 fix

- **WHEN** `investigate` 因变更归属依赖根因外上下文退回两次停点，且 `fix` 阶段判定存在多个可行方案
- **THEN** 条件修复门阻止实现或后续阶段推进，并要求有效回执

#### Scenario: 合并确认面不改变门白名单与阶段门预算

- **WHEN** 审计 `GATE_WHITELIST`、锚点集合与 debug 阶段门声明
- **THEN** 白名单仍为 5 类、锚点集合逐字不变，`diagnostic-confirmation` / `fix-option-confirmation` 仍映射到 `requirement-clarification`，`investigate` 与 `fix` 各至多 1 个阻塞门
- **AND** `auditGateWhitelistAlignment()` 返回空数组

#### Scenario: 唯一证据充分方案不被静态门阻塞

- **WHEN** `fix` 阶段证明仅有一个明确可行方案且记录项目约束/代码证据
- **THEN** 修复方案确认门不适用，阶段可在能力与回执有效后推进，不制造额外用户停顿

#### Scenario: 条件门适用性与旧门默认行为

- **WHEN** 阶段门声明或不声明 `condition` 并调用 `evaluatePhaseTransition`
- **THEN** `gateConditions['multiple-fix-options'] === false` → 该门不适用，跳过门确认要求（即使 `gateConfirmed` 为 false 也 MUST NOT 以 `gate-unconfirmed` 阻塞）
- **AND** `gateConditions['multiple-fix-options'] === true` 或该键未提供 → 门适用，`gateConfirmed` 为 false 时 MUST 以 `gate-unconfirmed` 阻塞（fail-safe）
- **AND** 未声明 `condition` 且 `blocking` 未设置或为 `true` 的既有门 MUST 保持现有静态行为（`gateConfirmed` 为 false 时阻塞），本变更 MUST NOT 改变其判定
- **AND** 未声明 `condition` 且 `blocking: false` 的既有门 MUST 保持旧行为（不阻塞），MUST NOT 被新条件门逻辑改变

#### Scenario: verify-close 消费 fix 结果

- **WHEN** `fix` 阶段成功返回修复与回归测试结果
- **THEN** `verify-close` 消费这些结果并负责汇总验证、同步与需求文档状态；缺失或无效回执阻止自动推进

#### Scenario: 缺少宿主委派能力时遵循 strict/degraded

- **WHEN** 当前宿主无法提供阶段所需的技能委派、门或状态能力
- **THEN** strict 模式阻断；仅在显式协商 degraded 后允许透明降级，并记录未发生的委派/能力，不把本地执行伪装成 strict 完成
