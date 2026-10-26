## ADDED Requirements

### Requirement: 每阶段至多一个阻塞确认门（门预算）

编排流程 SHALL 满足门预算：**每个阶段（探索 / 提案 / 实现 / 归档）至多一个阻塞确认门**。新增或修改门时 MUST NOT 突破该预算；回归测试 SHALL 以结构断言锁定各阶段的阻塞门数量。

#### Scenario: 探索阶段门数不超预算

- **WHEN** 统计委派探索（`iagent_spec_explore` delegated）在正常流程中的阻塞确认门
- **THEN** 其阻塞门 SHALL ≤ 1（提示词门合并入 grill 首批；流程图门为唯一流程级阻塞门；聚合一致性门默认直通）

#### Scenario: 实现阶段单门

- **WHEN** 检查 `iagent_workflow` 实现阶段
- **THEN** 实现确认与测试计划确认 SHALL 合并为单一阻塞门

### Requirement: grill L1-L5 批量确认（≤2 批）

`iagent_spec_explore` 的 grill-with-docs 追问 MUST 将逐决策增量确认合并为 **≤ 2 批**（L1-L3 一批、L4-L5 一批），并保留最低确认深度 **L3**（L1-L3 全部确认后决策方可标记完成）。若用户表示"够了"，SHALL 允许提前结束。

#### Scenario: 两批确认

- **WHEN** 探索存在跨 L1-L5 的待确认决策
- **THEN** 系统 SHALL 至多发起 2 次批量确认（L1-L3、L4-L5）
- **AND** 每批 SHALL 逐条列出待确认项与 AI 建议

#### Scenario: 最低深度保持

- **WHEN** 用户在 L1-L3 批确认后要求停止
- **THEN** 决策 SHALL 被视为完整（已达最低深度 L3）
- **AND** L4-L5 未确认项 SHALL 记入 Pending 而非静默丢弃

### Requirement: 实现桥合并（实现确认 + 测试计划）

`iagent_workflow` 的实现确认桥（Phase 3.7）与条件测试计划确认门 SHALL 合并为单一「实现 + 测试桥」：一次呈现实现方案与测试计划，一次确认；拒绝时回退范围（回探索 / 回提案 / 回实现范围）SHALL 在同一门内显式。

#### Scenario: 单门呈现实现与测试计划

- **WHEN** 提案验证通过、准备进入实现
- **THEN** 系统 SHALL 以单一门呈现「提案摘要 + 验证评分 + 深度复查结论 + 实现方案 + 测试计划预告」
- **AND** 用户确认一次即进入实现（含测试生成）

#### Scenario: 拒绝回退范围明确

- **WHEN** 用户在该门拒绝
- **THEN** 门内 SHALL 提供回退选项（修改提案 / 回探索补决策 / 仅调整测试计划）
- **AND** MUST NOT 进入实现

### Requirement: 聚合一致性门直通语义

`iagent_spec_explore` 的聚合一致性门（1.6.6）SHALL 显式声明为**默认直通**：无硬冲突时自动通过（non-blocking，不计入用户停顿），仅在检测到跨决策硬冲突时暂停呈现冲突项。该门 MUST NOT 被删除（它是 L4 增量检查的兜底）。

#### Scenario: 无冲突直通

- **WHEN** 探索完成且记录的 Decisions 之间无硬冲突
- **THEN** 聚合一致性门 SHALL 自动通过并继续完成检测
- **AND** MUST NOT 呈现为一次用户确认停顿

#### Scenario: 硬冲突暂停

- **WHEN** 记录的 Decisions 之间存在硬冲突（范围 / 行为契约矛盾）
- **THEN** 系统 SHALL 暂停并逐条呈现冲突项与建议
- **AND** 未解决前 MUST NOT 进入提案阶段
