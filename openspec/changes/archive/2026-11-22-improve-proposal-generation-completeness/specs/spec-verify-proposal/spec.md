## MODIFIED Requirements

### Requirement: 待实现功能覆盖检查

提案验证门 D3（任务完整性）维度 SHALL 并入「待实现功能覆盖检查点」：对 `proposal.md` What Changes 声明的每个变更项，核查「变更项 → specs 对应 Requirement → tasks 承接任务」链路逐级存在，作为 D3 评分的组成部分；MUST NOT 新增维度编号、MUST NOT 改动总分公式。

**判定依据（修改）**：链路核查 SHALL 优先消费从 Markdown 结构化解析得到的确定性数据（`ParsedProposal.whatChanges` / `ParsedProposal.capabilities`），仅在解析缺项时退回语义判定；两部分结论冲突时 SHALL 以确定性结论为准并留痕。

#### Scenario: 声明项逐级有承接

- **WHEN** proposal.md 的某个 What Changes 变更项在 specs 中有对应 Requirement 且 tasks 中存在带规范形态 Spec Ref 的承接任务
- **THEN** D3 对该变更项计为已覆盖，报告标注「待实现功能覆盖：链路完整（What Changes → <capability>/<Requirement> → <task id>）」

#### Scenario: 声明项无任务承接

- **WHEN** proposal.md 的某个 What Changes 变更项无对应 tasks 承接任务（specs 有 Requirement 但 tasks 无任务，或 specs 缺 Requirement）
- **THEN** D3 报告缺口链路（指明断在 specs 级或 tasks 级），覆盖率下降，缺口项以逐条可定位形式计入 FAIL 输出，MUST NOT 仅给出百分比

#### Scenario: 确定性结论优先

- **WHEN** 结构化解析结论与语义判定结论不一致
- **THEN** 本维度 SHALL 采用结构化解析结论
- **AND** 报告 SHALL 记录语义判定的差异并标 WARN

### Requirement: 影响范围一致性检查

提案验证门 SHALL 在变更类型自动检测后执行「影响面制品存在性判定」：当影响面三制品（`proposal.md` 的 `### Impact Analysis` / `design.md` 的 `### 架构影响` / `tasks.md` 的 `### Caller Updates`）均存在时，并入 D2/D3 执行「影响范围一致性检查」；无制品时检查点 SKIP 排除分母。

**锚点来源（修改）**：存在性判定所依据的标题锚点 MUST 来自 `anchors.ts` 单一源，MUST NOT 在技能正文硬编码。

#### Scenario: 三制品存在且对齐

- **WHEN** 影响面三制品均存在，且 Impact / Caller Updates 声明的模块与 design 架构影响、tasks 承接任务对齐
- **THEN** 影响范围一致性检查通过，D2/D3 评分计入该检查点结论，报告标注各制品对齐状态

#### Scenario: 有制品但与 tasks 脱节

- **WHEN** 影响面三制品存在，但 Impact 小节声明的某影响模块在 tasks 中无对应任务，或与 design 架构影响小节矛盾
- **THEN** 检查判 FAIL 并逐条列出偏差模块（模块名 + 断裂点：tasks 缺承接 / design 矛盾），MUST NOT 仅给出百分比

#### Scenario: 无影响面制品

- **WHEN** 影响分析未触发（三锚点均不存在）
- **THEN** 影响范围一致性检查标 SKIP 并从总分分母排除（不计入 triggered_count），MUST NOT 按 0 分拉低总分、MUST NOT 据此判 FAIL

#### Scenario: 存量 JSON-only 降级

- **WHEN** Markdown 制品缺失、仅有历史 change.json / tasks.json（降级路径）
- **THEN** 影响范围一致性检查标 SKIP + WARN（注明降级原因），MUST NOT 阻断评分，验证报告 MUST 注明该处置

### Requirement: 技术一致性的 design 缺失分支

D2（技术一致性）SHALL 在 `design.md` 缺失时从 `specs/**/*.md` 与 `proposal.md` 的 Capabilities / Impact 取技术选型证据；两处均无技术选型证据时，D2 SHALL 标 SKIP 并从总分分母排除，MUST NOT 由 AI 自行豁免、MUST NOT 按 0 分拉低。

#### Scenario: design 缺失但 specs 有技术选型

- **WHEN** `design.md` 不存在，`specs` 或 `proposal` 含可判定的技术选型证据
- **THEN** D2 SHALL 以该证据完成一致性判定并正常计分

#### Scenario: design 缺失且无技术选型证据

- **WHEN** `design.md` 不存在，且 `specs` / `proposal` 均无技术选型证据（如纯文档变更）
- **THEN** D2 SHALL 标 SKIP 并排除分母
- **AND** 报告 SHALL 注明 SKIP 原因，MUST NOT 按 0 分拉低总分
