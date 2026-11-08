## MODIFIED Requirements

### Requirement: Shared workflow protocol

系统 SHALL 为每个可编排工作流定义稳定的 canonical `workflowId`、阶段序列、输入契约、阶段 handoff、回执字段、确认门语义、重试策略与所需宿主能力。共享协议 MUST NOT 要求调用某一宿主专属的 Skill、Agent、Task 或工具名称。

阶段 handoff SHALL 包含推进所需的最小字段，且 MUST NOT 要求子代理依赖父级会话上下文：`propose` 阶段 handoff SHALL 至少含 `changeName` / `artifacts` / `applyReady` / `explorationFile` / `handoffPackPath` / `sourceFingerprint`；`verify` / `review` 阶段回执 SHALL 含 `score` / `reviewSummary` / `reportPath`（如适用）；`apply` 阶段 handoff SHALL 含 `tasksCompleted` / `compileResult` / `receipts` / `confirmedGates`；`archive` 阶段 handoff SHALL 含 `archivePath` / `specsSynced`。所有字段 MUST 以路径或结构化摘要表达，MUST NOT 内联制品正文。

#### Scenario: Stable workflow identity

- **WHEN** 同一工作流被生成到 Claude Code、OpenCode V2 与 Pi
- **THEN** 三个宿主产物 SHALL 使用同一个 canonical `workflowId`
- **AND** 宿主可见的 skill、agent、command 名称 SHALL 由该 ID 按宿主规则派生

#### Scenario: Structured handoff

- **WHEN** 一个阶段完成并进入下一阶段
- **THEN** 委派结果 SHALL 包含协议声明的 handoff 字段
- **AND** 缺少必需字段时 SHALL 被判定为阶段失败或不完整，不得静默推进

#### Scenario: Propose handoff carries exploration and pack paths

- **WHEN** `propose` 阶段完成并返回回执
- **THEN** 回执 SHALL 含 `explorationFile`、`handoffPackPath` 与 `sourceFingerprint`
- **AND** 父编排 SHALL 使用这些路径推进后续阶段，MUST NOT 依赖会话缓存

#### Scenario: Review stage carries report path

- **WHEN** `proposal-review` 或 `verify` 阶段完成
- **THEN** 回执 SHALL 含 `reviewSummary`（≤2KB）与可选的 `reportPath`
- **AND** 完整报告 MUST NOT 内联进回执

### Requirement: Native host orchestration mapping

系统 SHALL 将共享协议映射到宿主原生编排能力：Claude Code 的**交互阶段** SHALL 使用 `Skill` 工具内联加载技能，**自动阶段** SHALL 使用前台 `Agent`（兼容 `Task`）子代理执行，并在子代理返回后由父级在同一用户回合继续；OpenCode V2 使用 `skill`、`subagent`、agents、commands 与 `permissions`；Pi 使用已安装的 Extension/Package 提供的 Agent、workflow、状态与门控工具；**Codex 无编排机制，SHALL 显式映射为「本地执行且不构成委派」的 degraded 路径**。共享正文 MUST NOT 直接假设任一映射存在于全部宿主。

Claude 的交互/自动阶段划分 SHALL 作为单一源维护：交互阶段当前仅 `spec-explore`；其余委派阶段（`spec-propose` / `spec-verify-proposal` / `proposal-review` / `test` / `spec-apply` / `spec-verify` / `spec-archive`）均为自动阶段。自动阶段改用 Agent 后，模板 `allowedTools` 中的 `Skill(...)` 条目仍作为委派目标声明保留，用于委派清单派生与权限兜底；实际执行机制由 `renderDelegate` 按阶段类型渲染。

#### Scenario: Claude 交互阶段使用 Skill

- **WHEN** Claude 渲染 `spec-explore` 的阶段委派
- **THEN** 段落 SHALL 显示经 `Skill` 工具内联加载 `iagent-spec-explore`
- **AND** 提示词校验门与功能流程图门 SHALL 可在主 agent 中向用户呈现

#### Scenario: Claude 自动阶段使用前台 Agent

- **WHEN** Claude 渲染 `spec-propose` / `spec-verify-proposal` / `proposal-review` / `test` / `spec-apply` / `spec-verify` / `spec-archive` 的阶段委派
- **THEN** 段落 SHALL 显示经前台 `Agent` 子代理执行，并要求子代理载入对应技能、返回结构化回执
- **AND** 父级 SHALL 在收到 `tool_result` 后继续下一阶段

#### Scenario: OpenCode V2 delegation

- **WHEN** OpenCode V2 执行一个需要委派的阶段
- **THEN** SHALL 通过 V2 `subagent` 能力启动配置的项目级 agent
- **AND** 技能加载 SHALL 使用 V2 `skill` 能力与 canonical skill ID

#### Scenario: Pi delegation

- **WHEN** Pi strict 运行时已安装并通过能力检查
- **THEN** SHALL 通过已安装 npm Extension 提供的委派/工作流能力执行阶段
- **AND** 不得仅依赖 SKILL.md 中的自然语言委派指令

#### Scenario: Codex 映射声明本地执行

- **WHEN** 为 codex 渲染宿主编排段
- **THEN** 段内 SHALL 声明 Codex 无子代理/技能委派机制，阶段由当前 agent 本地执行且不构成委派
- **AND** MUST NOT 渲染 `经 Skill 工具委派` 一类不可执行的宿主专属指令

### Requirement: Gate and receipt enforcement

系统 SHALL 将共享确认门和回执契约映射为宿主可执行的检查点。门未通过时 SHALL 阻止后续阶段；回执未通过校验时 SHALL 阻止自动推进，并报告恢复路径。**回执是中间状态**：`status=ok` 且回执校验通过后，父编排 SHALL 在同一用户回合内继续下一阶段；只有门白名单内的确认门是合法停点。

门的适用范围 MUST 严格限定为白名单（见「确认门白名单与协议门清单对齐」）：只有白名单内的门可以阻断阶段推进；**非门动作**（阶段宣告、技能委派、只读扫描、CodeGraph 查询、状态查询）MUST NOT 被宿主适配器或模板正文实现为停止点，MUST NOT 要求用户确认。宿主适配器只消费协议声明的门，MUST NOT 自行发明门或把「已授权技能的直接调用」包装成确认。

`validateReceipt` SHALL 校验 `phase` / `status` / `artifact` / `nextAllowed`（失败时 `failure`）与可选的 `confirmedGates`；非法回执 SHALL 以 `invalid-receipt` 阻断。失败回执 SHALL 按协议重试策略处理，耗尽后暂停；MUST NOT 以本地执行或伪造回执替代。

#### Scenario: Gate blocks transition

- **WHEN** 当前阶段到达需要用户确认的 gate 且用户尚未确认
- **THEN** 宿主 SHALL 停止推进后续阶段
- **AND** 下一阶段不得在同一运行中被预执行

#### Scenario: Invalid receipt blocks transition

- **WHEN** 下游阶段返回缺失字段、状态失败或不匹配的 receipt
- **THEN** 编排器 SHALL 停止阶段推进并报告失败原因
- **AND** SHALL 保留重试、修复或显式 degraded 的选择

#### Scenario: 有效回执后同回合继续

- **WHEN** 委派阶段返回 `status=ok` 且 `nextAllowed` 指向协议内的下一阶段
- **THEN** 父编排 SHALL 立即继续下一阶段的首个动作
- **AND** MUST NOT 以回执作为最终消息结束回合

#### Scenario: 非门动作不被建模为停止点

- **WHEN** 宿主执行阶段宣告或已授权的技能委派
- **THEN** MUST NOT 请求用户确认、MUST NOT 在此处结束等待；门检查仅发生在协议声明的门处

#### Scenario: 适配器不发明门

- **WHEN** 宿主适配器渲染编排段落
- **THEN** 只渲染协议中声明的门与白名单类别，MUST NOT 追加「是否调用某技能」类业务确认

### Requirement: 已授权技能推进不增加重复业务确认

宿主适配器 SHALL 将父工作流入口意图或明确业务门对唯一 `nextAllowed` 技能/参数的确认映射为直接技能委派，不额外插入“是否调用该技能”的业务确认。委派阶段返回 `status=ok` 且回执校验通过后，适配器/编排器 SHALL 在同一用户回合内继续下一阶段，MUST NOT 在此处结束回合或再次请求确认。该规则只授权当前明确指定的下一动作，不替代其他业务确认门，也不得绕过宿主工具权限、能力协商、门状态、回执或 strict/degraded 安全行为。

#### Scenario: 已授权的下一技能直接调用

- **WHEN** 当前入口或已确认门指定唯一下一项技能和参数，且宿主具备并授权所需能力
- **THEN** 适配器直接启动该委派，不添加重复的业务调用确认

#### Scenario: 回执后直接续跑

- **WHEN** 被委派阶段返回有效回执并指定下一允许动作
- **THEN** 适配器/编排器 SHALL 直接推进该动作
- **AND** MUST NOT 追加“是否继续”类业务确认

#### Scenario: 宿主权限拒绝仍然有效

- **WHEN** 技能白名单、项目 permissions 或宿主工具策略拒绝该调用
- **THEN** 适配器按宿主规则停止并报告，不得把业务门确认视为工具权限许可

#### Scenario: 非法回执或未确认的其他门阻止推进

- **WHEN** 当前阶段回执缺少协议要求字段，或后续动作属于尚未确认的另一业务门
- **THEN** 编排器阻止推进；直接调用契约不得覆盖回执或其他门的检查

### Requirement: 确认门白名单与协议门清单对齐

共享协议 SHALL 以**正向白名单**声明必须保留的阻塞确认门，并与各工作流的阶段门清单保持可校验的对齐关系。

白名单固定为 5 类（`GATE_WHITELIST`）：L1-L5 需求澄清 / 功能流程图门 / 实现 + 测试桥 / 归档桥 / 破坏性改动确认。每类 SHALL 声明其**锚点集合**（`anchors`：阶段门 id 或技能内动作，允许一对多 —— 5 类**不等价于** 5 个 gate id）；「破坏性改动确认」MUST 为**不可豁免**的独立安全条，不依赖任何阶段门。

锚点映射（可校验）：`requirement-clarification` ⊇ { 提示词校验门、grill 批量确认、`diagnostic-confirmation`、`fix-option-confirmation` }；`flow-final-confirmation` ⊇ { `flow-final-confirmation` }；`implementation-bridge` ⊇ { `implementation-bridge` }；`archive-confirmation` ⊇ { `archive-confirmation` }；`destructive-change` 无阶段门锚点。`requirement-doc-bridge` 已随需求文档桥整体移除，MUST NOT 再出现在锚点集合或 `PHASE_GATE_CATEGORY` 中。

对齐规则：

- `WORKFLOW_PROTOCOLS` 中每个 `PhaseSpec.gate.id` MUST 出现在白名单的**锚点集合**内（生成期测试断言）；MUST NOT 通过新增白名单外门或删改既有门来凑对齐；
- `PHASE_GATE_CATEGORY` SHALL 为每个 `PhaseSpec.gate.id` 登记所属白名单类别，使 `auditGateWhitelistAlignment()` 返回空违规列表；缺映射即判为对齐违规；
- `debug` 的 `verify-close` 阶段 SHALL NOT 声明 `requirement-doc-bridge`（需求文档桥已移除），其阻塞门数量为 0；
- MUST NOT 通过新增阶段阻塞门来表达白名单条目 —— 每阶段至多一个阻塞门（门预算）不变；
- `GateSpec` 结构与 `evaluatePhaseTransition` 的判定语义（门 / 回执 / 能力三要素、条件门 `gateConditions` 语义）MUST NOT 改变（surface 缺失 `gate` 的兜底见「运行表面（surface）能力协商」）；
- 不在白名单内的动作（阶段宣告、技能委派、只读扫描、CodeGraph 查询、状态查询）MUST NOT 被建模为门，也 MUST NOT 由宿主适配器插入额外确认。

#### Scenario: 协议门均在白名单内

- **WHEN** 读取 `WORKFLOW_PROTOCOLS` 并收集全部 `PhaseSpec.gate.id`
- **THEN** 每个 id 都能在 `GATE_WHITELIST` 的**锚点集合**中找到对应项（含 `diagnostic-confirmation` / `fix-option-confirmation` 挂在 `requirement-clarification` 类别下）；出现白名单外的门时一致性测试失败

#### Scenario: 五类白名单覆盖全部现有阶段门

- **WHEN** 对比白名单类别数与现有 `PhaseSpec.gate.id` 数量
- **THEN** 断言按「锚点集合包含」而非「类别名等于门 id」判定；`diagnostic-confirmation` 与 `fix-option-confirmation` MUST NOT 因不在 5 个类别名中而被判为白名单外

#### Scenario: 阶段门类别映射齐备

- **WHEN** 收集 `WORKFLOW_PROTOCOLS` 全部 `PhaseSpec.gate.id` 并查 `PHASE_GATE_CATEGORY`
- **THEN** 每个门 id SHALL 有类别映射，且该类别条目的 `anchors` 含该门；`auditGateWhitelistAlignment()` SHALL 返回空数组

#### Scenario: 文档桥锚点已移除

- **WHEN** 审阅 `GATE_WHITELIST` 与 `PHASE_GATE_CATEGORY`
- **THEN** `requirement-doc-bridge` MUST NOT 出现在任何锚点集合或类别映射中
- **AND** 白名单类别数仍为 5

#### Scenario: 对齐不新增第二道阻塞门

- **WHEN** 对比对齐前后的每个阶段的阻塞门数量
- **THEN** 每个阶段 MUST 至多 1 个阻塞门（门预算不变），MUST NOT 为实现白名单而对同阶段追加第二个阻塞门

#### Scenario: 条件门语义不变

- **WHEN** 阶段门声明 `condition: 'multiple-fix-options'` 并以 `gateConditions` 传入 `false` / `true` / 未提供
- **THEN** 判定结果与对齐前一致（`false` 跳过门、`true` 或缺失按 `gateConfirmed` 要求确认），MUST NOT 被白名单逻辑改变

#### Scenario: 破坏性改动确认独立生效

- **WHEN** 某动作将删除目录、覆盖既有制品或改写版本库跟踪状态
- **THEN** 无论当前处于哪个阶段、该阶段是否已通过其阶段门，系统仍 MUST 请求破坏性改动确认

### Requirement: auto-workflow 协议阶段门与模板声明一致

`WORKFLOW_PROTOCOLS['auto-workflow']` SHALL 使用 auto-workflow 专用阶段定义，使协议门清单与其模板正文声明一致：需求文档桥已整体移除，APPLY / ARCHIVE / VERIFY 阶段 SHALL NOT 声明阻塞门；VERIFY 阶段 SHALL 使用无门的 `VERIFY_PHASE`。

`WORKFLOW_PROTOCOLS['workflow']` SHALL 使其协议门清单与合并后的模板声明一致：VERIFY 阶段 MUST NOT 声明 `requirement-doc-bridge`（该门已移除），APPLY 阶段 SHALL 声明 `implementation-bridge`；交付桥收缩为「确认 / 修改 / 拒绝」三出口，不再承载需求文档选项。

`debug` 的 `verify-close` SHALL NOT 声明 `requirement-doc-bridge`；其阶段门数量为 0。`GATE_WHITELIST` 仍为 5 类，MUST NOT 因此新增或删除白名单类别，MUST NOT 改变 `GateSpec` 形状与条件门语义。

#### Scenario: auto-workflow 全阶段无阻塞门

- **WHEN** 读取 `WORKFLOW_PROTOCOLS['auto-workflow']` 的 `verify` / `apply` / `archive` 阶段
- **THEN** 该三阶段 MUST NOT 声明阻塞门
- **AND** 模板正文 MUST NOT 声明需求文档桥或其他确认门

#### Scenario: workflow 的 VERIFY 与 APPLY 门

- **WHEN** 读取 `WORKFLOW_PROTOCOLS['workflow']` 的 `verify` / `apply` 阶段
- **THEN** `verify` MUST NOT 声明阻塞门
- **AND** `apply` SHALL 声明 `implementation-bridge` 阻塞门

#### Scenario: debug 的 verify-close 无阻塞门

- **WHEN** 读取 `WORKFLOW_PROTOCOLS['debug']` 的 `verify-close` 阶段
- **THEN** 该阶段 MUST NOT 声明 `requirement-doc-bridge` 或其他阻塞门
- **AND** 其 handoff / receipt MUST NOT 含 `requirementDocStatus`

#### Scenario: 白名单仍为 5 类

- **WHEN** 统计 `GATE_WHITELIST` 类别数并检查锚点集合
- **THEN** 类别数仍为 5，且不含 `requirement-doc-bridge`

#### Scenario: 协议门全部落在白名单锚点内

- **WHEN** 收集 `WORKFLOW_PROTOCOLS` 全部 `PhaseSpec.gate.id` 并对照白名单锚点与 `PHASE_GATE_CATEGORY`
- **THEN** 每个门 id SHALL 命中某个白名单条目的 `anchors` 且 `auditGateWhitelistAlignment()` 返回空数组
- **AND** 出现白名单外的门时一致性测试失败

### Requirement: debug host protocol 拆分 fix 与 verify-close

debug 仍是单一 `iagent_debug` 全流程 SKILL；宿主无关 `WORKFLOW_PROTOCOLS.debug` SHALL 将阶段表达为 `investigate` → `fix` → `verify-close`，使修复方案决策/实施与编译、同步、提案验证、深度复查和收束职责分开。`investigate` SHALL 交付 `rootCause` / `defectChain` / `changeName` / `affectedSymbols` / `fixDecision`；变更归属判定（`changeName` 的产生）与修复方案决策（`fixDecision` 的产生）SHALL 同属 `investigate` 的收束动作 —— 因 debug 采用「诊断 + 方案」合并确认包，修复方案在 `investigate` 的单一确认包内随根因一并确认。`fix` SHALL 以 `rootCause` / `defectChain` / `changeName` / `fixDecision` 为必需输入，handoff 修复结果与回归测试结果；`verify-close` 消费修复结果并交付验证/深度复查/可归档结论，**不再交付或携带需求文档状态**。

**合并确认面不改变门预算**：`investigate` 与 `fix` 的阶段门声明 SHALL 保持既有形状 —— `investigate` 绑定 `diagnostic-confirmation`（`blocking: true`，语义扩为「诊断 + 方案」包），`fix` 绑定 `fix-option-confirmation`（`blocking: true`，`condition: 'multiple-fix-options'`）。合并包已产出 `fixDecision` 时该条件门通常不适用；仅当 `investigate` 因「变更归属依赖根因外上下文」退回两次停点时，`fix` 的方案门才在存在多个可行方案时阻塞。`GATE_WHITELIST` SHALL 仍为 5 类、锚点集合逐字不变（除文档桥移除），`diagnostic-confirmation` 与 `fix-option-confirmation` MUST 继续挂在 `requirement-clarification` 类别下；每阶段至多 1 个阻塞门。

修复方案确认门 SHALL 仅在存在多个可行方案时阻塞；单一明确可行且证据充分的方案须记录其证据并直通。该条件门 SHALL 以宿主无关契约表达：`GateSpec` 增加可选 `condition`（首个取值 `'multiple-fix-options'`），`PhaseTransitionInput` 增加可选 `gateConditions?: Record<string, boolean>`。`evaluatePhaseTransition` 的判定为：门的 `condition` 未设置 → 保持现有静态门行为；`gateConditions[condition] === false` → 该门不适用并跳过门确认要求（即使 `gateConfirmed` 为 false 也不得以 `gate-unconfirmed` 阻塞）；`=== true` 或该键未提供 → 门适用，仍按 `gateConfirmed` 要求确认（fail-safe）。`debug` 的 `fix` 阶段门绑定 `'multiple-fix-options'`：多个可行方案置 `true`，唯一且证据充分方案置 `false`。Claude / OpenCode V2 / Pi 适配 SHALL 共享同一判定语义；任何既有未声明 `condition` 的门行为 MUST NOT 改变。`verify-close` 内 MUST NOT 保留需求文档生成/跳过桥；strict 缺少必要能力时阻断，degraded 必须明确标记，不得伪装为成功委派。

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

#### Scenario: verify-close 消费 fix 结果且无文档桥

- **WHEN** `fix` 阶段成功返回修复与回归测试结果
- **THEN** `verify-close` 消费这些结果并负责汇总验证、深度复查与可归档结论
- **AND** MUST NOT 展示需求文档桥、MUST NOT 生成需求文档、MUST NOT 携带 `requirementDocStatus`

#### Scenario: 缺少宿主委派能力时遵循 strict/degraded

- **WHEN** 当前宿主无法提供阶段所需的技能委派、门或状态能力
- **THEN** strict 模式阻断；仅在显式协商 degraded 后允许透明降级，并记录未发生的委派/能力，不把本地执行伪装成 strict 完成

### Requirement: Pi 编排阶段 agent 的嵌套委派授予

当 Pi 被选为编排目标时，编排类阶段 agent 的定义 SHALL 生成 `allowed_subagents`，取值为该 workflow 的**派生委派清单**（取自模板 `Skill(...)` 条目，见「编排适配注入面按模板委派派生」）与实际已安装 stages 的交集，按 `iagent-<id>` 形态列出；声明但未安装的目标 SHALL 记入诊断缺口（`nestingGaps`）并输出 WARN。缺口处置 SHALL 区分两类：**无条件必需委派**的缺口按能力阻断（strict 下不得推进该阶段）；**条件委派**（该技能正文已声明 fallback / degraded 路径，如 `debug → proposal-review` 的内联只读复查、`debug → test` 的显式 degraded 本地编写）的缺口 SHALL 按正文声明的降级路径执行并记录 WARN，MUST NOT 因 Pi 文本被一律阻断；其中 `test` 仅在显式协商 degraded 时允许本地编写。两类情形均 MUST NOT 将本地执行表述为委派完成，MUST NOT 声称该委派在 strict 下可用。非编排阶段 agent MUST NOT 生成 `allowed_subagents`。本变更 MUST NOT 新增按 workflow 粒度的 strict 降级判定（strict 仍由既有 host 级能力协商决定）。

`requirement-doc` 已从三父流程的委派清单与 `CONDITIONAL_DELEGATIONS` 中移除，SHALL NOT 再作为嵌套委派授予或缺口示例。

#### Scenario: 编排阶段 agent 可嵌套委派

- **WHEN** `iagent init` / `update` 为 Pi 生成 `debug` 阶段 agent 且 `spec-verify-proposal` 已安装
- **THEN** 该定义 frontmatter 的 `allowed_subagents` MUST 含 `iagent-spec-verify-proposal`
- **AND** 条件委派 `test` 在已安装时 SHALL 一并授予，未安装时按条件委派降级路径处理

#### Scenario: 需求文档技能不再出现在嵌套委派面

- **WHEN** 生成 workflow / auto-workflow / debug 的 Pi 阶段 agent
- **THEN** `allowed_subagents` MUST NOT 含 `iagent-requirement-doc`
- **AND** `nestingGaps` MUST NOT 因缺少 `requirement-doc` 而报告必需缺口

#### Scenario: 委派目标未安装时不伪装严格可用

- **WHEN** 委派清单声明的目标技能未安装
- **THEN** 该目标 MUST NOT 出现在 `allowed_subagents`；系统 SHALL 记录 `nestingGaps` 并输出 WARN
- **AND** 若该委派为无条件必需委派 → 阶段 SHALL 按能力阻断，MUST NOT 以本地执行替代
- **AND** 若该委派为条件委派且正文已声明降级路径 → SHALL 按该降级路径执行并记录 WARN（`test` 仅在显式协商 degraded 时允许本地编写），MUST NOT 被一律阻断
- **AND** 两类情形下阶段 agent 正文均 MUST NOT 声称该委派在 strict 下可用

#### Scenario: 授予面来自模板派生清单

- **WHEN** 某技能模板新增或移除一条 `Skill(...)` 委派
- **THEN** 其 Pi `allowed_subagents` SHALL 自动跟随（无需修改第二份清单），且非编排阶段仍不生成该字段

### Requirement: 编排适配注入面按模板委派派生

需要注入宿主编排适配段的技能集合 SHALL 由**模板单一源派生**：某技能模板的 `allowedTools` 含 `Skill(...)`（即正文存在委派动作）即视为编排技能；其委派清单 SHALL 取该模板 `Skill(...)` 条目的 canonical 目标集合（保序去重）。MUST NOT 维护第二份硬编码 workflow 清单作为真源。

派生函数 SHALL 接受模板列表作为入参（纯函数），MUST NOT 通过「模板模块 → 注册表 → 模板模块」的循环导入获取清单。`iagent init` 与 `iagent update` 在生成技能正文与指令正文时，SHALL 将基于当前生效技能集（`activeSkillTemplates`）计算的 `orchestration` 对象显式传给 `adaptSkillContentForHost(content, negotiation, workflowId, orchestration)`，确保 `workflows` 配置裁剪时注入的编排适配段与生效集严格一致。条件委派表（`CONDITIONAL_DELEGATIONS`）属语义声明，MUST 保持显式维护，MUST NOT 由白名单推导；本变更 SHALL 从中移除 `workflow` / `auto-workflow` 的 `requirement-doc`。

`renderDelegationList` SHALL 渲染委派条目的 `mode` / `gate-skip` 参数，使宿主委派清单与正文参数口径一致；**参数来源 SHALL 为显式参数表**（如 `DELEGATION_PARAMETERS`，目标仍由 `allowedTools` 派生），MUST NOT 由白名单推断，参数表未声明时 MUST NOT 凭空填充模式参数。Claude 自动阶段的渲染机制 SHALL 由 `renderDelegate` 按阶段类型选择 Agent，而非另立第二份委派目标表。

条件委派表 `CONDITIONAL_DELEGATIONS` SHALL 覆盖全部「正文已声明 fallback / degraded 路径」的委派，含派生后新纳入编排面的 `project-init → feature-doc`；否则默认安装（`DEFAULT_WORKFLOWS` 含 `project-init` 但不含 `feature-doc`）会把可降级委派误判为无条件必需缺口。

Pi 的 `allowed_subagents` 与 OpenCode worker 的委派面 SHALL 以同一派生清单为真源，MUST NOT 另立第二份委派目标表。

**归档类退出编排面**：`iagent_spec_archive` / `iagent_spec_bulk_archive` 的正文不再委派任何技能后，其 `allowedTools` 不含 `Skill(...)` 条目，故 SHALL NOT 再被派生为编排技能 —— 不得注入宿主编排适配段、不得为它们生成 `allowed_subagents`；这是「有委派即注入、无委派不注入」的直接结果，MUST NOT 为保留其编排身份而虚增委派条目。

#### Scenario: 有委派即注入

- **WHEN** 某技能模板 `allowedTools` 含 `Skill(iagent-test)`
- **THEN** 该技能的宿主产物 SHALL 注入宿主编排适配段与委派清单，其委派目标含 `test`

#### Scenario: 无委派不注入

- **WHEN** 某技能模板 `allowedTools` 不含任何 `Skill(...)` 条目
- **THEN** 该技能产物 MUST NOT 注入宿主编排适配段，MUST NOT 生成 `allowed_subagents`（归档类技能在本变更后即属此类）

#### Scenario: init 与 update 透传生效集 orchestration

- **WHEN** `.iagent/config.yaml` 的 `workflows` 裁剪了部分技能并执行 `iagent init` 或 `iagent update`
- **THEN** `init` 与 `update` 在生成技能与指令时 SHALL 将基于 `activeSkillTemplates` 派生的 `orchestration` 传入 `adaptSkillContentForHost`，不在被裁剪掉的 workflow 上回退使用全量模块级默认表

#### Scenario: 委派清单携带参数

- **WHEN** 显式参数表为某委派目标声明 `mode=delegated` 与 `gate-skip=design-confirmation`
- **THEN** 渲染出的委派清单条目 SHALL 含 `mode=delegated` 与 `gate-skip=design-confirmation`，与正文参数一致
- **AND** 未在参数表声明的目标 MUST NOT 被填充任何模式参数

#### Scenario: 可降级委派不被误报为必需缺口

- **WHEN** 派生后 `project-init` 被识别为编排技能而 `feature-doc` 未安装
- **THEN** `CONDITIONAL_DELEGATIONS` SHALL 含 `project-init → feature-doc`
- **AND** Pi 诊断 SHALL 按条件委派的降级路径记 WARN，MUST NOT 判为「无条件必需委派缺口」并按能力阻断该阶段

#### Scenario: 需求文档不再出现在条件委派表

- **WHEN** 审阅 `CONDITIONAL_DELEGATIONS`
- **THEN** `workflow` / `auto-workflow` 的条目 MUST NOT 含 `requirement-doc`
- **AND** 派生清单中 MUST NOT 含 `requirement-doc`

#### Scenario: 派生结果覆盖既有委派技能

- **WHEN** 以全部技能模板运行派生
- **THEN** 结果 SHALL 至少覆盖 `auto-workflow` / `debug` / `migration` / `project-init` / `spec-apply` / `spec-propose` / `workflow`，且每个技能的委派目标与其 `Skill(...)` 条目逐一对应
- **AND** `spec-archive` / `spec-bulk-archive` 在本变更后不再含 `Skill(...)` 条目，故不属于派生结果；断言 MUST NOT 再把两者列为「至少覆盖」项

#### Scenario: 归档类无 Skill 委派面

- **WHEN** 以 Pi 或 OpenCode 生成 `iagent-spec-archive` / `iagent-spec-bulk-archive` 的阶段 agent
- **THEN** 其定义 MUST NOT 含 `allowed_subagents`（该字段只取 `Skill(...)` 委派清单）；`spec-bulk-archive` 的 `Agent, Task` 派发授权仍保留（属子代理派发，不是 Skill 委派，OpenCode 因此仍可获得 `action: subagent`），二者 MUST NOT 混为一谈

## REMOVED Requirements

### Requirement: 需求文档状态跨阶段 handoff

**Reason**: 需求文档桥、`requirementDocStatus` 持久化与跨阶段传递逻辑整体移除；需求文档只由独立 `iagent-requirement-doc` 技能按需生成。

**Migration**: 删除 `RequirementDocStatus` / `REQUIREMENT_DOC_STATUS_FIELD` / `PERSISTED_REQUIREMENT_DOC_STATUSES` / `REQUIREMENT_DOC_STATUS_IO_ATTEMPTS` / `normalizeRequirementDocStatus`、`Receipt.requirementDocStatus`、`STATUS_RECEIPT`、`VERIFY_WITH_BRIDGE`、`DOC_BRIDGE_GATE`、`GATE_WHITELIST` 的 `requirement-doc-bridge` 锚点与 `PHASE_GATE_CATEGORY` 映射。历史变更中的 `## 需求文档状态` 段与 `需求文档.md` 文件原样保留，不读取、不报告、不生成、不迁出；需要文档时由用户显式安装并手工调用独立技能。
