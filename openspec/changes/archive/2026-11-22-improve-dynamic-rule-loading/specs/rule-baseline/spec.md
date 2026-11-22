## MODIFIED Requirements

### Requirement: handoff 多源规范要点与 rulesRead 完整性

`iagent_spec_propose` 的 handoff 包 `## 规范要点` SHALL 按**相关性分层**蒸馏：`always` 层（`.iagent/config.yaml` 的 context、`CLAUDE.md`、`AGENTS.md`）与 `phase` 层（与变更类型匹配的 `.iagent/rules/<type>.md`）的源蒸馏要点并逐条标注来源路径；其余存在的源 SHALL 以「指针 + 一行摘要」保留，MUST NOT 静默丢弃任一存在源。

原「MUST NOT 只蒸馏 `coding-rules.md`」约束 SHALL 改写为「MUST NOT 静默丢弃任一存在源」——指针即保留。

apply 的阶段回执 SHALL 携带 `rulesRead`（实际读取的规则源路径列表）与 `rulesSkipped`（声明为不需要读的源路径列表，含理由）。实现一致性门 SHALL 校验 `rulesRead` 覆盖枚举结果中 `exists=true` 的 `always` / `phase` 集合；`rulesSkipped` 声明的源 MUST NOT 被判 `rules-not-read`。

#### Scenario: 多源规范要点

- **WHEN** 项目同时存在 `coding-rules.md`、`testing-rules.md`、`spec.md` 与 `CLAUDE.md`，变更类型为 `spec`
- **THEN** handoff 包 `## 规范要点` SHALL 蒸馏 `spec.md` 与 `CLAUDE.md` 的要点并标注来源
- **AND** `coding-rules.md` / `testing-rules.md` SHALL 以指针 + 一行摘要保留

#### Scenario: 规则未读导致一致性门失败

- **WHEN** `CLAUDE.md` 存在、属 `always` 层，但 apply 回执的 `rulesRead` 不含该路径，且未列入 `rulesSkipped`
- **THEN** 实现一致性门输出 `rules-not-read` 并判 `fail`，报告列出缺失路径

#### Scenario: 声明跳过不判失败

- **WHEN** 某 `on-demand` 源列入 `rulesSkipped` 并给出理由
- **THEN** 实现一致性门 MUST NOT 因该源报 `rules-not-read`

### Requirement: 探索阶段规则基线

`iagent_spec_explore`（delegated 模式）与 `iagent_debug` 在探索 / 排查起点 SHALL 按三层读取规则源并把结果写入探索文件的 `## 项目规则基线` 段，至少包含：源路径、**相关性层级**、存在性、读取状态、关键约束摘要（或不需要读的理由）。源缺失 SHALL 显式记「不存在」（合法终态），读取失败 SHALL 记 WARN 并计入未读。

规则基线 MUST 在提示词校验门与 grill 之前建立。读取顺序 SHALL 为：常驻基线 → `iagent rules --json --type <本技能类型>` → 按需点读。

#### Scenario: 探索起点建立规则基线

- **WHEN** 探索或排查开始
- **THEN** 探索文件包含 `## 项目规则基线` 段，逐源列出相关性层级、存在性与读取状态

#### Scenario: 全部规则源缺失

- **WHEN** 项目未执行 `iagent init` 且无 `CLAUDE.md` / `AGENTS.md`
- **THEN** 规则基线记录「无规则源」，探索与实现流程继续，MUST NOT 阻断
