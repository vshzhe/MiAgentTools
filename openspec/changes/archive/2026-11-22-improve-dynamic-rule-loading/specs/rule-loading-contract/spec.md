## ADDED Requirements

### Requirement: 技能正文三层读取契约

各技能在建立规则基线 / 技能基线时 SHALL 按三层读取，MUST NOT 在启动期读取全部 `exists=true` 的源：

| 层 | 读取内容 | 时机 |
| :--- | :--- | :--- |
| `always` | `.iagent/config.yaml` 的 context、`CLAUDE.md`、`AGENTS.md` | 每次调用 |
| `phase` | `iagent rules --json --type <本技能类型>` 命中的规则 + `phases` 匹配的技能 | 进入阶段时 |
| `on-demand` | 与本次变更 / 任务范围相关的其余规则 | 用到时 |

适用范围：`iagent_spec_explore`（1.1.1 / 1.1.1.5）、`iagent_debug`（2.1.6 / 2.1.7）、`iagent_spec_apply`（实现前基线）、`iagent_spec_verify`（规则基线）、`iagent_review`（规则基线）、`iagent_proposal_review`。

#### Scenario: 探索阶段按层读取

- **WHEN** `iagent_spec_explore` 建立规则基线
- **THEN** MUST 先读常驻基线，再执行 `iagent rules --json --type spec` 读阶段相关子集
- **AND** MUST NOT 无条件读取 `testing-rules.md` 等非本阶段类型的规则（除按需点读）

#### Scenario: 审查阶段按层读取

- **WHEN** `iagent_review` 建立规则基线
- **THEN** MUST 读常驻基线与 `--type review` 命中的规则
- **AND** MUST NOT 全量读取全部规则源

#### Scenario: 既有最佳实践保持

- **WHEN** `iagent_test` 建立规则基线
- **THEN** 保持现状（只读 `testing-rules.md`），并作为三层契约的范式引用
- **AND** 本变更 MUST NOT 使其退化为全量读取

### Requirement: 未读声明

各读取点产物 SHALL 逐源记录相关性判定与读取状态，格式为 `| 源 | 相关性 | 读取 | 理由 |`，其中相关性取值 `always` / `phase` / `on-demand`（或 `不适用`），读取取值 `已读` / `未读`。

声明为「需要读」但未读 → 一致性门报 `rules-not-read` 并 fail；声明为「不需要读」→ not-fail。声明缺失 → 视为漏读。

#### Scenario: 逐源声明

- **WHEN** 探索建立规则基线
- **THEN** `## 项目规则基线` 段 SHALL 对每个枚举到的源给出相关性、读取状态与理由
- **AND** 未读的源 MUST 给出「不需要读」的理由

#### Scenario: 漏读被判定

- **WHEN** 某源在声明中标记为 `phase` 且「需要读」，但实际未读
- **THEN** 一致性门 SHALL 报 `rules-not-read` 并 fail

#### Scenario: 显式不需要读不 fail

- **WHEN** 某源在声明中标记为「不需要读」并给出理由
- **THEN** 一致性门 MUST NOT 因该源报 `rules-not-read`

### Requirement: handoff 规范要点按相关性分层蒸馏

`iagent_spec_propose` 的 handoff 包 `## 规范要点` SHALL 按相关性分层蒸馏：`always` / `phase` 层的源蒸馏要点并逐条标注来源路径；其余存在的源以「指针 + 一行摘要」形式保留（`<path>` — <适用域>），MUST NOT 静默丢弃任一存在源。

原「MUST NOT 只蒸馏 `coding-rules.md`」约束 SHALL 改写为「MUST NOT 静默丢弃任一存在源」——指针即保留。

#### Scenario: 分层蒸馏

- **WHEN** 项目含 `coding-rules.md` / `testing-rules.md` / `spec.md`，变更类型为 `spec`
- **THEN** `## 规范要点` SHALL 蒸馏 `spec.md` 与常驻基线要点
- **AND** `coding-rules.md` / `testing-rules.md` SHALL 以指针 + 一行摘要保留

#### Scenario: 不丢弃任何存在源

- **WHEN** 某存在的规则源被判为 `on-demand`
- **THEN** `## 规范要点` SHALL 含该源的指针与一行摘要
- **AND** MUST NOT 完全省略该源
