# spec-verify-proposal 能力规格（delta）

## ADDED Requirements

### Requirement: 待实现功能覆盖检查

提案验证门 D3（任务完整性）维度 SHALL 并入「待实现功能覆盖检查点」：对 `proposal.md` What Changes 声明的每个变更项，核查「变更项 → specs 对应 Requirement → tasks 承接任务」链路逐级存在，作为 D3 评分的组成部分；MUST NOT 新增维度编号、MUST NOT 改动总分公式（D2）。

#### Scenario: 声明项逐级有承接

- **WHEN** proposal.md 的某个 What Changes 变更项在 specs 中有对应 Requirement 且 tasks 中存在带规范形态 Spec Ref 的承接任务
- **THEN** D3 对该变更项计为已覆盖，报告标注「待实现功能覆盖：链路完整（What Changes → <capability>/<Requirement> → <task id>）」

#### Scenario: 声明项无任务承接

- **WHEN** proposal.md 的某个 What Changes 变更项无对应 tasks 承接任务（specs 有 Requirement 但 tasks 无任务，或 specs 缺 Requirement）
- **THEN** D3 报告缺口链路（指明断在 specs 级或 tasks 级），覆盖率下降，缺口项以逐条可定位形式计入 FAIL 输出，MUST NOT 仅给出百分比

### Requirement: 影响范围一致性检查

提案验证门 SHALL 在变更类型自动检测后执行「影响面制品存在性判定」（流程节点 N3）：当影响面三制品（`proposal.md` Impact 影响面分析小节 / `design.md` 架构影响小节 / `tasks.md` Caller Updates 小节，workflow.ts:273-279）均存在时（影响分析已触发），并入 D2/D3 执行「影响范围一致性检查」（N5）；无制品时检查点 SKIP 排除分母（对齐 D10 缺失处理先例 spec-verify-proposal.ts:152-153）（D4）。

#### Scenario: 三制品存在且对齐

- **WHEN** 影响面三制品均存在，且 Impact / Caller Updates 声明的模块与 design 架构影响、tasks 承接任务对齐
- **THEN** 影响范围一致性检查通过，D2/D3 评分计入该检查点结论，报告标注各制品对齐状态

#### Scenario: 有制品但与 tasks 脱节

- **WHEN** 影响面三制品存在，但 Impact 小节声明的某影响模块在 tasks 中无对应任务，或与 design 架构影响小节矛盾
- **THEN** 检查判 FAIL 并逐条列出偏差模块（模块名 + 断裂点：tasks 缺承接 / design 矛盾），MUST NOT 仅给出百分比

#### Scenario: 无影响面制品

- **WHEN** 影响分析未触发（proposal.md 无影响面分析小节、design.md 无架构影响小节、tasks.md 无 Caller Updates 小节）
- **THEN** 影响范围一致性检查标 SKIP 并从总分分母排除（不计入 triggered_count），MUST NOT 按 0 分拉低总分、MUST NOT 据此判 FAIL

#### Scenario: 存量 JSON-only 降级

- **WHEN** Markdown 制品缺失、仅有历史 change.json / tasks.json（降级路径）
- **THEN** 影响范围一致性检查标 SKIP + WARN（注明降级原因），MUST NOT 阻断评分，验证报告 MUST 注明该处置

### Requirement: 检查能力点评估结论留痕

对任一检查能力点的再分析得出「不改动」结论时（例如总分公式与 90% 统一阈值保持现状），SHALL 在 design.md 评估记录段留痕结论与依据；「评估后不改」是合法结论，MUST NOT 被强制改为产出改动（D3）。

#### Scenario: 评估后不改留痕

- **WHEN** 某检查能力点经再分析判定为保持现状（例如总分公式 spec-verify-proposal.ts:147、90% 统一阈值 :392-395）
- **THEN** design.md 评估记录段列出「评估对象 / 结论 / 依据」，且 90% 阈值 / 权重语义的任何变更须单独显式确认（未确认即保持现状）
