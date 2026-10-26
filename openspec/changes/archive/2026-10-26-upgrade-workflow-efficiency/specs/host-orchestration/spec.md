# host-orchestration 增量规格

## ADDED Requirements

### Requirement: 确认门白名单与协议门清单对齐

共享协议 SHALL 以**正向白名单**声明必须保留的阻塞确认门，并与各工作流的阶段门清单保持可校验的对齐关系。

白名单固定为 5 类（`GATE_WHITELIST`）：L1-L5 需求澄清 / 功能流程图门 / 实现 + 测试桥 / 归档桥 / 破坏性改动确认。每类 SHALL 声明其**锚点集合**（`anchors`：阶段门 id 或技能内动作，允许一对多 —— 5 类**不等价于** 5 个 gate id）；「破坏性改动确认」MUST 为**不可豁免**的独立安全条，不依赖任何阶段门。

锚点映射（可校验）：`requirement-clarification` ⊇ { 提示词校验门、grill 批量确认、`diagnostic-confirmation`、`fix-option-confirmation` }；`flow-final-confirmation` ⊇ { `flow-final-confirmation` }；`implementation-bridge` ⊇ { `implementation-bridge` }；`archive-confirmation` ⊇ { `archive-confirmation` }；`destructive-change` 无阶段门锚点。

对齐规则：

- `WORKFLOW_PROTOCOLS` 中每个 `PhaseSpec.gate.id` MUST 出现在白名单的**锚点集合**内（生成期测试断言）；现有 5 个 gate id 全部落入上述映射，MUST NOT 通过删改既有门来凑对齐；
- MUST NOT 通过新增阶段阻塞门来表达白名单条目 —— 每阶段至多一个阻塞门的预算不变；
- `GateSpec` 结构与 `evaluatePhaseTransition` 的判定语义（门 / 回执 / 能力三要素、条件门 `gateConditions` 语义）MUST NOT 改变；
- 不在白名单内的动作（阶段宣告、技能委派、只读扫描、CodeGraph 查询、状态查询）MUST NOT 被建模为门，也 MUST NOT 由宿主适配器插入额外确认。

#### Scenario: 协议门均在白名单内

- **WHEN** 读取 `WORKFLOW_PROTOCOLS` 并收集全部 `PhaseSpec.gate.id`
- **THEN** 每个 id 都能在 `GATE_WHITELIST` 的**锚点集合**中找到对应项（含 `diagnostic-confirmation` / `fix-option-confirmation` 挂在 `requirement-clarification` 类别下）；出现白名单外的门时一致性测试失败

#### Scenario: 五类白名单覆盖全部现有阶段门

- **WHEN** 对比白名单类别数与现有 `PhaseSpec.gate.id` 数量（5 类 vs 5 个门 id，名称不同）
- **THEN** 断言按「锚点集合包含」而非「类别名等于门 id」判定；`diagnostic-confirmation` 与 `fix-option-confirmation` MUST NOT 因不在 5 个类别名中而被判为白名单外

#### Scenario: 对齐不新增阶段门

- **WHEN** 对比对齐前后的每个阶段的阻塞门数量
- **THEN** 数量不变（每阶段 ≤ 1），MUST NOT 为实现白名单而对同阶段追加第二个阻塞门

#### Scenario: 条件门语义不变

- **WHEN** 阶段门声明 `condition: 'multiple-fix-options'` 并以 `gateConditions` 传入 `false` / `true` / 未提供
- **THEN** 判定结果与对齐前一致（`false` 跳过门、`true` 或缺失按 `gateConfirmed` 要求确认），MUST NOT 被白名单逻辑改变

#### Scenario: 破坏性改动确认独立生效

- **WHEN** 某动作将删除目录、覆盖既有制品或改写版本库跟踪状态
- **THEN** 无论当前处于哪个阶段、该阶段是否已通过其阶段门，系统仍 MUST 请求破坏性改动确认

## MODIFIED Requirements

### Requirement: Gate and receipt enforcement

系统 SHALL 将共享确认门和回执契约映射为宿主可执行的检查点。门未通过时 SHALL 阻止后续阶段；回执未通过校验时 SHALL 阻止自动推进，并报告恢复路径。

门的适用范围 MUST 严格限定为白名单（见「确认门白名单与协议门清单对齐」）：只有白名单内的门可以阻断阶段推进；**非门动作**（阶段宣告、技能委派、只读扫描、CodeGraph 查询、状态查询）MUST NOT 被宿主适配器或模板正文实现为停止点，MUST NOT 要求用户确认。宿主适配器只消费协议声明的门，MUST NOT 自行发明门或把「已授权技能的直接调用」包装成确认。

#### Scenario: Gate blocks transition

- **WHEN** 当前阶段到达需要用户确认的 gate 且用户尚未确认
- **THEN** 宿主 SHALL 停止推进后续阶段
- **AND** 下一阶段不得在同一运行中被预执行

#### Scenario: Invalid receipt blocks transition

- **WHEN** 下游阶段返回缺失字段、状态失败或不匹配的 receipt
- **THEN** 编排器 SHALL 停止阶段推进并报告失败原因
- **AND** SHALL 保留重试、修复或显式 degraded 的选择

#### Scenario: 非门动作不被建模为停止点

- **WHEN** 宿主执行阶段宣告或已授权的技能委派
- **THEN** MUST NOT 请求用户确认、MUST NOT 在此处结束等待；门检查仅发生在协议声明的门处

#### Scenario: 适配器不发明门

- **WHEN** 宿主适配器渲染编排段落
- **THEN** 只渲染协议中声明的门与白名单类别，MUST NOT 追加「是否调用某技能」类业务确认
