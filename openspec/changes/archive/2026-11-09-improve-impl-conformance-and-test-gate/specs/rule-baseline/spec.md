## ADDED Requirements

### Requirement: 规则源枚举命令

系统 SHALL 提供 `iagent rules --json` 命令，枚举项目规则源并输出每项的路径、存在性、字节数与 `sha256` 前 12 位。枚举集合 MUST 为：`.iagent/config.yaml`（`context` 段与 `rules` 列表）、`.iagent/rules/*.md`、项目根 `CLAUDE.md`、项目根 `AGENTS.md`。

运行时 MUST NOT 枚举或读取 `openspec/rules/*.md` 作为规则源（该目录是初始化期的蒸馏源，运行时以 `.iagent/rules/` 为准）。规则源全部缺失时命令 SHALL 正常返回空集合，MUST NOT 以非零退出。

#### Scenario: 枚举存在的规则源

- **WHEN** 项目含 `.iagent/rules/coding-rules.md`、`CLAUDE.md` 与 `AGENTS.md`
- **THEN** `iagent rules --json` 输出三项及各自的 `exists=true`、`sha256`、`lines`，并列出 `.iagent/config.yaml` 的 rules 列表

#### Scenario: 规则源缺失

- **WHEN** 新项目只有 `CLAUDE.md`、无 `.iagent/` 目录
- **THEN** 命令输出 `CLAUDE.md` 一项与 `.iagent` 相关项的 `exists=false`，退出码为 0

#### Scenario: 不枚举 openspec 规则目录

- **WHEN** 项目同时存在 `openspec/rules/ai-coding.md`
- **THEN** 该文件 MUST NOT 出现在枚举结果中

### Requirement: 探索阶段规则基线

`iagent_spec_explore`（delegated 模式）与 `iagent_debug` 在探索 / 排查起点 SHALL 运行规则源枚举并把结果写入探索文件的 `## 项目规则基线` 段，至少包含：源路径、存在性、读取状态、关键约束摘要。源缺失 SHALL 显式记「不存在」（合法终态），读取失败 SHALL 记 WARN 并计入未读。

规则基线 MUST 在提示词校验门与 grill 之前建立，使后续制品生成与实现按同一规则集合约束。

#### Scenario: 探索起点建立规则基线

- **WHEN** 探索或排查开始
- **THEN** 探索文件包含 `## 项目规则基线` 段，逐源列出存在性与读取状态

#### Scenario: 全部规则源缺失

- **WHEN** 项目未执行 `iagent init` 且无 `CLAUDE.md` / `AGENTS.md`
- **THEN** 规则基线记录「无规则源」，探索与实现流程继续，MUST NOT 阻断

### Requirement: handoff 多源规范要点与 rulesRead 完整性

`iagent_spec_propose` 的 handoff 包 `## 规范要点` SHALL 由全部存在的规则源蒸馏而成（`coding-rules.md`、`testing-rules.md`、`spec.md`、`CLAUDE.md`、`AGENTS.md`），并逐条标注来源路径；MUST NOT 只蒸馏 `coding-rules.md`。

apply 的阶段回执 SHALL 携带 `rulesRead`（实际读取的规则源路径列表）。实现一致性门 SHALL 校验 `rulesRead` 覆盖规则源枚举结果中 `exists=true` 的集合（`.iagent/config.yaml` 的 context 段按一项计入）。

#### Scenario: 多源规范要点

- **WHEN** 项目同时存在 `coding-rules.md`、`testing-rules.md`、`spec.md` 与 `CLAUDE.md`
- **THEN** handoff 包 `## 规范要点` 逐条列出各源要点并标注来源路径

#### Scenario: 规则未读导致一致性门失败

- **WHEN** `CLAUDE.md` 存在但 apply 回执的 `rulesRead` 不含该路径
- **THEN** 实现一致性门输出 `rules-not-read` 并判 `fail`，报告列出缺失路径

#### Scenario: 读取失败不伪装

- **WHEN** 某规则文件存在但读取抛出异常
- **THEN** 该源记 WARN 且 MUST NOT 出现在 `rulesRead` 中，一致性门按未读处理
