## ADDED Requirements

### Requirement: 运行表面（surface）能力协商

能力协商 SHALL 增加**运行表面**维度 `surface`，取值固定为 `interactive-ui` / `interactive-cli` / `headless`（缺省 `interactive-cli`）。`negotiateCapabilities` SHALL 依 surface 裁决 `gate` 能力可用性：`headless` 下 MUST NOT 声称具备可交互 `gate`（`gate` MUST 出现在 `missing` 中），SHALL 以 notes 输出显式告警。

门的兜底策略 SHALL 与门白名单的 `conditional` 标记对齐：

- `conditional: true` 的门（`requirement-clarification` 类别）在 headless 下 SHALL「记录决策并继续」，并记 WARN；
- **不可豁免门**（`flow-final-confirmation` / `implementation-bridge` / `archive-confirmation` / `destructive-change`）在 headless 下 MUST 以 `blocked` 回执中止并报告，MUST NOT 静默跳过、MUST NOT 视为已确认、MUST NOT 以「继续」文案掩盖。

`evaluatePhaseTransition` SHALL 消费协商结果中缺失的 `gate` 能力：条件门在无 `gate` 能力时 MUST NOT 以 `gate-unconfirmed` 阻塞；不可豁免门在无 `gate` 能力时 MUST 保持阻塞，并报告缺少交互式确认能力。「条件门 / 不可豁免门」的判定 SHALL 取自 `GATE_WHITELIST` 条目的 `conditional`（经 `PHASE_GATE_CATEGORY` 映射门 → 类别），MUST NOT 以 `GateSpec.condition` 代替（后者是「门是否适用」的业务条件，语义不同）。对声明条件门的阶段，协议 MUST NOT 把 `gate` 加入该阶段 `requiredCapabilities` —— 否则 headless 下能力检查会先以 `missing-capabilities` 阻断，绕过本节的兜底矩阵。

#### Scenario: headless 不声称可交互 gate

- **WHEN** 以 `surface='headless'` 协商任一宿主能力
- **THEN** 协商结果的 `available` MUST NOT 含 `gate`，`missing` MUST 含 `gate`，notes 含无法执行交互式确认的说明

#### Scenario: headless 条件门记录并继续

- **WHEN** headless 表面抵达 `conditional: true` 的澄清门且未取得用户确认
- **THEN** 系统 SHALL 记录该门的决策与 WARN 并继续后续动作，MUST NOT 以 `gate-unconfirmed` 阻塞

#### Scenario: headless 不可豁免门以 blocked 回执中止

- **WHEN** headless 表面抵达不可豁免门（如 `implementation-bridge` / `archive-confirmation` / `destructive-change`）且无用户确认
- **THEN** 系统 MUST 返回 `status='blocked'` 的回执并报告原因，MUST NOT 继续推进

#### Scenario: 交互表面保持既有判定

- **WHEN** 以 `surface='interactive-ui'` 或 `interactive-cli` 协商并评估阶段推进
- **THEN** 门判定结果与引入 surface 维度前一致（`gate` 可用，未确认即阻塞）

### Requirement: Codex skills-only 显式 degraded 档案

`HostId` SHALL 包含 `codex`。`HOST_PROFILES.codex` SHALL 为**显式 degraded 档案**：仅声明 `skill-load` 与 `argument-passing` 两项能力，`native.delegation` 与 `native.gate` MUST 明确说明 Codex 无对应原生机制（skills-only）。

`negotiationForHost('codex')` MUST 返回协商结果（`mode='degraded'`，`missing` 含 `delegate` / `receipt` / `gate` / `state`），MUST NOT 返回 `null`；MUST NOT 因「无编排机制」而跳过适配段注入。

`iagent init` / `iagent update` SHALL 在输出中报告 codex 的 degraded 结论与缺失能力。`adaptSkillContentForHost` 在 codex 下 SHALL 注入降级段，显式声明「由当前 agent 本地执行，**不构成委派**」，MUST NOT 声称可经子代理或技能委派执行阶段。

#### Scenario: codex 协商返回 degraded 且不返回 null

- **WHEN** 调用 `negotiationForHost('codex')`
- **THEN** 返回非空协商结果且 `mode='degraded'`、`missing` 含 `delegate` 与 `gate`，MUST NOT 返回 `null`

#### Scenario: codex 产物显式声明本地执行不构成委派

- **WHEN** 为 codex 生成编排类技能产物
- **THEN** 产物含宿主编排适配段并显式声明「本地执行，不构成委派」，MUST NOT 出现要求模型执行不存在的委派机制的指令

#### Scenario: init 与 update 报告 codex 诊断

- **WHEN** 以 codex 为生效工具执行 `iagent init` 或 `iagent update`
- **THEN** 输出 SHALL 报告 codex 的 degraded 状态与缺失能力清单

### Requirement: 编排适配注入面按模板委派派生

需要注入宿主编排适配段的技能集合 SHALL 由**模板单一源派生**：某技能模板的 `allowedTools` 含 `Skill(...)`（即正文存在委派动作）即视为编排技能；其委派清单 SHALL 取该模板 `Skill(...)` 条目的 canonical 目标集合（保序去重）。MUST NOT 维护第二份硬编码 workflow 清单作为真源。

派生函数 SHALL 接受模板列表作为入参（纯函数），MUST NOT 通过「模板模块 → 注册表 → 模板模块」的循环导入获取清单。条件委派表（`CONDITIONAL_DELEGATIONS`）属语义声明，MUST 保持显式维护，MUST NOT 由白名单推导。

`renderDelegationList` SHALL 渲染委派条目的 `mode` / `gate-skip` 参数，使宿主委派清单与正文参数口径一致；**参数来源 SHALL 为显式参数表**（如 `DELEGATION_PARAMETERS`，目标仍由 `allowedTools` 派生），MUST NOT 由白名单推断，参数表未声明时 MUST NOT 凭空填充模式参数。

条件委派表 `CONDITIONAL_DELEGATIONS` SHALL 覆盖全部「正文已声明 fallback / degraded 路径」的委派，含派生后新纳入编排面的 `project-init → feature-doc`；否则默认安装（`DEFAULT_WORKFLOWS` 含 `project-init` 但不含 `feature-doc`）会把可降级委派误判为无条件必需缺口。

Pi 的 `allowed_subagents` 与 OpenCode worker 的委派面 SHALL 以同一派生清单为真源，MUST NOT 另立第二份委派目标表。

#### Scenario: 有委派即注入

- **WHEN** 某技能模板 `allowedTools` 含 `Skill(iagent-test)`
- **THEN** 该技能的宿主产物 SHALL 注入宿主编排适配段与委派清单，其委派目标含 `test`

#### Scenario: 无委派不注入

- **WHEN** 某技能模板 `allowedTools` 不含任何 `Skill(...)` 条目
- **THEN** 该技能产物 MUST NOT 注入宿主编排适配段，MUST NOT 生成 `allowed_subagents`

#### Scenario: 委派清单携带参数

- **WHEN** 显式参数表为某委派目标声明 `mode=delegated` 与 `gate-skip=design-confirmation`
- **THEN** 渲染出的委派清单条目 SHALL 含 `mode=delegated` 与 `gate-skip=design-confirmation`，与正文参数一致
- **AND** 未在参数表声明的目标 MUST NOT 被填充任何模式参数

#### Scenario: 可降级委派不被误报为必需缺口

- **WHEN** 派生后 `project-init` 被识别为编排技能而 `feature-doc` 未安装
- **THEN** `CONDITIONAL_DELEGATIONS` SHALL 含 `project-init → feature-doc`
- **AND** Pi 诊断 SHALL 按条件委派的降级路径记 WARN，MUST NOT 判为「无条件必需委派缺口」并按能力阻断该阶段

#### Scenario: 派生结果覆盖既有委派技能

- **WHEN** 以全部技能模板运行派生
- **THEN** 结果 SHALL 至少覆盖 `auto-workflow` / `debug` / `migration` / `project-init` / `spec-apply` / `spec-archive` / `spec-bulk-archive` / `spec-propose` / `workflow`，且每个技能的委派目标与其 `Skill(...)` 条目逐一对应

### Requirement: auto-workflow 协议阶段门与模板声明一致

`WORKFLOW_PROTOCOLS['auto-workflow']` SHALL 使用 auto-workflow 专用阶段定义，使协议门清单与其模板正文声明一致：APPLY / ARCHIVE 阶段 SHALL NOT 声明阻塞门（模板声明该两阶段除需求文档桥外无用户确认）；VERIFY 阶段 SHALL 显式声明 `requirement-doc-bridge` 阻塞门。

`requirement-doc-bridge` SHALL 作为 `requirement-clarification` 白名单类别的锚点存在（**白名单仍为 5 类**），MUST NOT 因此新增第 6 类、MUST NOT 改变其余 4 类的语义与不可豁免性。`workflow` 的 VERIFY 阶段 SHALL 同样声明该门，使两条编排链的门清单与模板一致。

#### Scenario: auto-workflow 的 APPLY 与 ARCHIVE 无阻塞门

- **WHEN** 读取 `WORKFLOW_PROTOCOLS['auto-workflow']` 的 `apply` / `archive` 阶段
- **THEN** 该两阶段 MUST NOT 声明阻塞门，与模板「除文档桥外无用户确认」的声明一致

#### Scenario: auto-workflow 的 VERIFY 声明文档桥门

- **WHEN** 读取 `WORKFLOW_PROTOCOLS['auto-workflow']` 的 `verify` 阶段
- **THEN** 该阶段 SHALL 声明 `requirement-doc-bridge` 阻塞门

#### Scenario: 白名单仍为 5 类且锚点包含文档桥

- **WHEN** 统计 `GATE_WHITELIST` 类别数并检查锚点集合
- **THEN** 类别数仍为 5，`requirement-doc-bridge` SHALL 出现在 `requirement-clarification` 的 `anchors` 中

#### Scenario: 协议门全部落在白名单锚点内

- **WHEN** 收集 `WORKFLOW_PROTOCOLS` 全部 `PhaseSpec.gate.id` 并对照白名单锚点
- **THEN** 每个门 id SHALL 命中某个白名单条目的 `anchors`，出现白名单外的门时一致性测试失败

## MODIFIED Requirements

### Requirement: Host capability negotiation

系统 SHALL 在执行严格编排前确认宿主具备工作流声明的能力，包括技能加载、参数传递、子 agent 委派、回执返回、确认门与状态持续能力。能力档案的宿主集合 SHALL 覆盖 Claude、OpenCode、Pi 与 **Codex**（Codex 为显式 degraded 档案，见「Codex skills-only 显式 degraded 档案」）。对 Pi，子 agent 委派能力 SHALL 以「运行时已安装且所需 `.pi/agents/<subagent_type>.md` 定义可解析」为判定依据，MUST NOT 仅凭 npm 包存在断言。

协商 SHALL 同时考虑**运行表面**（`surface`，见「运行表面（surface）能力协商」）：同一宿主在不同表面的 `gate` 可用性可不同，MUST NOT 用单一 strict 断言覆盖全部表面。能力检查结果 SHALL 可被用户查看并写入运行诊断元数据。

#### Scenario: Strict host is capable

- **WHEN** 宿主满足当前工作流的全部必需能力
- **THEN** 工作流 SHALL 进入 strict 编排
- **AND** 阶段委派与回执 SHALL 使用宿主原生机制

#### Scenario: Strict host is missing a capability

- **WHEN** 宿主缺少任一必需能力且未选择 degraded 模式
- **THEN** 工作流 SHALL 停止并报告缺失能力、影响阶段与可选补救方式
- **AND** MUST NOT 把当前 agent 的本地执行结果伪装为委派完成

#### Scenario: Pi runtime present but entries unresolvable

- **WHEN** Pi runtime 已安装但编排所需的 agent 定义缺失或不可解析
- **THEN** 系统 SHALL 判定 Pi 缺少子 agent 委派能力并进入 degraded
- **AND** SHALL 报告缺失的 agent 名称与补齐方式

#### Scenario: 同一宿主不同表面的协商结果可见

- **WHEN** 同一宿主分别以 `interactive-ui`、`interactive-cli` 与 `headless` 协商
- **THEN** 三次结果的 `gate` 可用性 SHALL 可区分（headless 不含 `gate`），其余能力不受 surface 影响

### Requirement: Native host orchestration mapping

系统 SHALL 将共享协议映射到宿主原生编排能力：Claude Code 使用 Skill/Agent/询问与 hooks；OpenCode V2 使用 `skill`、`subagent`、agents、commands 与 `permissions`；Pi 使用已安装的 Extension/Package 提供的 Agent、workflow、状态与门控工具；**Codex 无编排机制，SHALL 显式映射为「本地执行且不构成委派」的 degraded 路径**。共享正文 MUST NOT 直接假设任一映射存在于全部宿主。

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

### Requirement: Pi native delegation entries

当 Pi 被选为编排目标时，系统 SHALL 在项目 `.pi/agents/` 下生成编排器与阶段 agent 定义。每个定义 SHALL 提供 frontmatter `name`（即 `subagent_type`）、`description` 与 `tools`；`tools` MUST 只含上游内置名（`read` / `write` / `edit` / `bash` / `grep` / `find` / `ls`），嵌套委派工具 MUST 由 `allowed_subagents` 授予，`prompt_mode` SHALL 为 `append`。

Pi strict 档案声称的 `gate` 能力 SHALL 显式限定为**阻塞回执形态**（阶段以 `status='blocked'` 回执上报未满足的门，由父级/用户在下一次交互中确认），MUST NOT 声称具备与 Claude/OpenCode 等价的交互式门工具；该限定 SHALL 出现在协商 notes 与生成的编排段文本中。MUST NOT 通过向 `tools` 注入扩展工具名来伪造交互式门能力。

#### Scenario: 生成编排器与阶段 agent

- **WHEN** `iagent init` / `update` 为 Pi 生成编排类 workflow
- **THEN** SHALL 生成 `.pi/agents/iagent-orchestrator.md` 与 `.pi/agents/iagent-<workflowId>.md`
- **AND** 每个文件的 frontmatter `name` SHALL 等于对应 `subagent_type`

#### Scenario: 用户自建 agent 不被覆盖

- **WHEN** `.pi/agents/` 已存在非 iagent 命名的 agent
- **THEN** 生成与清理 SHALL 只处理 `iagent-` 前缀文件
- **AND** MUST NOT 覆盖或删除用户自建 agent

#### Scenario: frontmatter 契约与上游可解析

- **WHEN** 检查生成的 agent 定义
- **THEN** `tools` SHALL 只含内置名，MUST NOT 出现 `Agent` / `get_subagent_result` 等扩展工具名
- **AND** 编排器的嵌套派发能力 SHALL 由 `allowed_subagents` 枚举提供

#### Scenario: agent 定义为纯生成物

- **WHEN** 重复执行 `iagent update`
- **THEN** `.pi/agents/iagent-*.md` SHALL 按最新模板重建（不设手改保护）
- **AND** 用户自建的其它 agent 文件 SHALL 保持不变

#### Scenario: 生效集缩小后清理 orphan

- **WHEN** 生效 workflow 集缩小，某些 `iagent-` 前缀 agent 不再需要
- **THEN** init/update SHALL 清理这些 orphan 定义
- **AND** SHALL 在输出中报告清理数量

#### Scenario: gate 能力限定为阻塞回执形态

- **WHEN** 读取 Pi strict 的协商结果与生成的编排段
- **THEN** `gate` 的说明 SHALL 明确其为阻塞回执形态（非交互式门工具），且 `tools` 未被注入扩展工具名

### Requirement: Pi 编排阶段 agent 的嵌套委派授予

当 Pi 被选为编排目标时，编排类阶段 agent 的定义 SHALL 生成 `allowed_subagents`，取值为该 workflow 的**派生委派清单**（取自模板 `Skill(...)` 条目，见「编排适配注入面按模板委派派生」）与实际已安装 stages 的交集，按 `iagent-<id>` 形态列出；声明但未安装的目标 SHALL 记入诊断缺口（`nestingGaps`）并输出 WARN。

缺口处置 SHALL 区分两类：**无条件必需委派**的缺口按能力阻断（strict 下不得推进该阶段）；**条件委派**（该技能正文已声明 fallback / degraded 路径，如 `debug → proposal-review` 的内联只读复查、`debug → test` 的显式 degraded 本地编写）的缺口 SHALL 按正文声明的降级路径执行并记录 WARN，MUST NOT 因 Pi 文本被一律阻断；其中 `test` 仅在显式协商 degraded 时允许本地编写。两类情形均 MUST NOT 将本地执行表述为委派完成，MUST NOT 声称该委派在 strict 下可用。非编排阶段 agent MUST NOT 生成 `allowed_subagents`。本变更 MUST NOT 新增按 workflow 粒度的 strict 降级判定（strict 仍由既有 host 级能力协商决定）。

#### Scenario: 编排阶段 agent 可嵌套委派

- **WHEN** `iagent init` / `update` 为 Pi 生成 `debug` 阶段 agent 且 `requirement-doc` 已安装
- **THEN** 该定义 frontmatter 的 `allowed_subagents` MUST 含 `iagent-requirement-doc`，且 `test/pi-native.test.ts` 断言其存在

#### Scenario: 委派目标未安装时不伪装严格可用

- **WHEN** 委派清单声明的目标技能未安装
- **THEN** 该目标 MUST NOT 出现在 `allowed_subagents`；系统 SHALL 记录 `nestingGaps` 并输出 WARN
- **AND** 若该委派为无条件必需委派 → 阶段 SHALL 按能力阻断，MUST NOT 以本地执行替代
- **AND** 若该委派为条件委派且正文已声明降级路径 → SHALL 按该降级路径执行并记录 WARN（`test` 仅在显式协商 degraded 时允许本地编写），MUST NOT 被一律阻断
- **AND** 两类情形下阶段 agent 正文均 MUST NOT 声称该委派在 strict 下可用

#### Scenario: 授予面来自模板派生清单

- **WHEN** 某技能模板新增或移除一条 `Skill(...)` 委派
- **THEN** 其 Pi `allowed_subagents` SHALL 自动跟随（无需修改第二份清单），且非编排阶段仍不生成该字段

### Requirement: 确认门白名单与协议门清单对齐

共享协议 SHALL 以**正向白名单**声明必须保留的阻塞确认门，并与各工作流的阶段门清单保持可校验的对齐关系。

白名单固定为 5 类（`GATE_WHITELIST`）：L1-L5 需求澄清 / 功能流程图门 / 实现 + 测试桥 / 归档桥 / 破坏性改动确认。每类 SHALL 声明其**锚点集合**（`anchors`：阶段门 id 或技能内动作，允许一对多 —— 5 类**不等价于** 5 个 gate id）；「破坏性改动确认」MUST 为**不可豁免**的独立安全条，不依赖任何阶段门。

锚点映射（可校验）：`requirement-clarification` ⊇ { 提示词校验门、grill 批量确认、`diagnostic-confirmation`、`fix-option-confirmation`、`requirement-doc-bridge` }；`flow-final-confirmation` ⊇ { `flow-final-confirmation` }；`implementation-bridge` ⊇ { `implementation-bridge` }；`archive-confirmation` ⊇ { `archive-confirmation` }；`destructive-change` 无阶段门锚点。`requirement-doc-bridge` 归入 `requirement-clarification` 的理由：它是用户对**交付范围**（是否生成评审用需求文档）的业务选择，属既有澄清类门的锚点扩展，MUST NOT 被理解为新增第 6 类门。

对齐规则：

- `WORKFLOW_PROTOCOLS` 中每个 `PhaseSpec.gate.id` MUST 出现在白名单的**锚点集合**内（生成期测试断言）；MUST NOT 通过新增白名单外门或删改既有门来凑对齐；
- `PHASE_GATE_CATEGORY` SHALL 为每个 `PhaseSpec.gate.id` 登记所属白名单类别（新增门含 `requirement-doc-bridge` → `requirement-clarification`），使 `auditGateWhitelistAlignment()` 返回空违规列表；缺映射即判为对齐违规；
- `debug` 的 `verify-close` 阶段 SHALL 声明 `requirement-doc-bridge` 阻塞门（模板 7.3 已含强制文档桥门），使协议门清单与模板声明一致；该阶段阻塞门仍为 1；
- MUST NOT 通过新增阶段阻塞门来表达白名单条目 —— 每阶段至多一个阻塞门（门预算）不变；
- `GateSpec` 结构与 `evaluatePhaseTransition` 的判定语义（门 / 回执 / 能力三要素、条件门 `gateConditions` 语义）MUST NOT 改变（surface 缺失 `gate` 的兜底见「运行表面（surface）能力协商」）；
- 不在白名单内的动作（阶段宣告、技能委派、只读扫描、CodeGraph 查询、状态查询）MUST NOT 被建模为门，也 MUST NOT 由宿主适配器插入额外确认。

#### Scenario: 协议门均在白名单内

- **WHEN** 读取 `WORKFLOW_PROTOCOLS` 并收集全部 `PhaseSpec.gate.id`
- **THEN** 每个 id 都能在 `GATE_WHITELIST` 的**锚点集合**中找到对应项（含 `diagnostic-confirmation` / `fix-option-confirmation` / `requirement-doc-bridge` 挂在 `requirement-clarification` 类别下）；出现白名单外的门时一致性测试失败

#### Scenario: 五类白名单覆盖全部现有阶段门

- **WHEN** 对比白名单类别数与现有 `PhaseSpec.gate.id` 数量
- **THEN** 断言按「锚点集合包含」而非「类别名等于门 id」判定；`diagnostic-confirmation`、`fix-option-confirmation` 与 `requirement-doc-bridge` MUST NOT 因不在 5 个类别名中而被判为白名单外

#### Scenario: 阶段门类别映射齐备且 debug 文档桥一致

- **WHEN** 收集 `WORKFLOW_PROTOCOLS` 全部 `PhaseSpec.gate.id` 并查 `PHASE_GATE_CATEGORY`
- **THEN** 每个门 id SHALL 有类别映射，且该类别条目的 `anchors` 含该门；`auditGateWhitelistAlignment()` SHALL 返回空数组
- **AND** `debug` 的 `verify-close` SHALL 声明 `requirement-doc-bridge`，且该阶段阻塞门数量为 1

#### Scenario: 对齐不新增第二道阻塞门

- **WHEN** 对比对齐前后的每个阶段的阻塞门数量
- **THEN** 每个阶段 MUST 至多 1 个阻塞门（门预算不变），MUST NOT 为实现白名单而对同阶段追加第二个阻塞门
- **AND** 本次新增的协议门声明仅用于「模板已有该用户门而协议缺失」的补齐（`requirement-doc-bridge`），MUST NOT 为模板中无门的阶段凭空新增阻塞门

#### Scenario: 条件门语义不变

- **WHEN** 阶段门声明 `condition: 'multiple-fix-options'` 并以 `gateConditions` 传入 `false` / `true` / 未提供
- **THEN** 判定结果与对齐前一致（`false` 跳过门、`true` 或缺失按 `gateConfirmed` 要求确认），MUST NOT 被白名单逻辑改变

#### Scenario: 破坏性改动确认独立生效

- **WHEN** 某动作将删除目录、覆盖既有制品或改写版本库跟踪状态
- **THEN** 无论当前处于哪个阶段、该阶段是否已通过其阶段门，系统仍 MUST 请求破坏性改动确认
