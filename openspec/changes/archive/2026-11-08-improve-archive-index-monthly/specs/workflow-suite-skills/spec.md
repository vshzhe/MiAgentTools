## ADDED Requirements

### Requirement: 编排技能归档阶段 SHALL 引用分片归档索引协议

`iagent_workflow` 与 `iagent_auto_workflow` 的归档阶段描述 SHALL 以「根入口 `ARCHIVE-INDEX.md`（月份导航 + 全局模块统计）+ 月度索引 `ARCHIVE-INDEX-YYYY-MM.md`（纯追加）」表述归档索引，MUST NOT 再表述为单一 `ARCHIVE-INDEX.md` 的纯追加。两者 MUST NOT 重定义或内联复述归档索引协议（创建、追加、月份判定、统计重算），协议单一源仍为 `iagent_spec_archive` / `iagent_spec_bulk_archive` 技能正文 (D6/D7)。

`iagent_debug` SHALL 保持「归档只读」护栏，MUST NOT 直接写任何归档索引文件，也不改归档逻辑 (D6)。

#### Scenario: workflow 归档阶段引用分片索引

- **WHEN** 检查 `iagent_workflow` 的归档阶段描述
- **THEN** 其索引表述包含根入口与月度索引两部分
- **AND** MUST NOT 出现「单一 ARCHIVE-INDEX.md 纯追加」的旧表述

#### Scenario: auto-workflow 自动归档阶段引用分片索引

- **WHEN** 检查 `iagent_auto_workflow` 的自动归档阶段描述
- **THEN** 其索引表述包含根入口与月度索引两部分
- **AND** MUST NOT 重定义创建 / 追加 / 月份判定 / 统计重算协议

#### Scenario: debug 不写索引且归档逻辑不变

- **WHEN** 检查 `iagent_debug` 的归档相关描述
- **THEN** 仅保留「归档只读」护栏并提示运行 `/iagent:spec-archive`
- **AND** MUST NOT 出现任何归档索引写入逻辑或月度索引协议复述
