# review 能力规格（delta）

## ADDED Requirements

### Requirement: 变更关联检测

审查流程 SHALL 在确定审查范围后执行「变更关联检测」（流程节点 N17）：检测活跃变更（`openspec/changes/` 下非 archive 变更）且其声明影响面或 tasks 涉及文件与审查范围相交；未检出关联时一致性检查点不触发，五维度审查行为 MUST NOT 改变（D2/D4/BS-3）。

#### Scenario: 检测到变更关联

- **WHEN** 存在活跃变更且其 proposal.md 声明影响面（或 tasks.md 涉及文件）与本次审查范围相交
- **THEN** 触发「提案与实现一致性检查」（N19），报告标注关联的变更名

#### Scenario: 无变更关联

- **WHEN** 无活跃变更，或活跃变更的影响面与审查范围不相交
- **THEN** 一致性检查点不触发，按既有五维度审查输出报告，既有五维度行为保持不变

### Requirement: 提案与实现一致性检查

触发后 SHALL 以 proposal.md / design.md / specs / tasks.md 为基准对实现产出做语义层核对：设计决策遵循、场景实现情况、影响面越界；发现按 CRITICAL / WARNING / SUGGESTION 分级呈现，逐条给出制品锚点与实现证据（文件:行）（D2/D4）。

#### Scenario: 设计决策未遵循

- **WHEN** design.md Decisions 的某决策在实现中被违背（如选型 / 分层与决策相反）
- **THEN** 报 WARNING 或 CRITICAL（按影响），逐条列出决策条目与实现证据（文件:行）及触发场景

#### Scenario: 影响面越界

- **WHEN** 实现改动越出 proposal.md 声明影响面
- **THEN** 报 WARNING 并逐条列出越面文件（BS-4 口径）；结构层拦截由 iagent spec conformance 承担，不重复执行

### Requirement: 结构层证据分工

一致性检查点 SHALL 为语义层能力：结构校验结论（Requirement/Scenario→任务追溯、勾选任务→产出证据）引用 `iagent spec conformance` 的既有产出作为证据输入，MUST NOT 在 review 中重复实现结构校验（D5）。

#### Scenario: 引用结构层证据

- **WHEN** `.openspec-tmp/pipeline-<change>/conformance-report.md` 存在
- **THEN** 一致性检查点只读其 `**summary**:` 行作为结构层证据输入，语义层结论与结构层结论并列呈现，MUST NOT 重跑结构校验命令

#### Scenario: 结构层证据缺失

- **WHEN** conformance 证据不可用（文件缺失或非编排上下文）
- **THEN** 标注「结构层证据缺失（非阻断）」并继续语义层检查，MUST NOT 伪装已引用、MUST NOT 为此扩权执行写操作
