## ADDED Requirements

### Requirement: spec-archive 归档名冲突的唯一化报告

spec-archive 技能调用 `iagent spec archive "<name>" --yes` 后，SHALL 以命令报告的实际归档目录（可能含 `-2` / `-3` 后缀）为唯一事实来源：归档摘要 MUST 显示实际归档路径；月度索引「变更名称」列 MUST 取实际目录名去掉 `YYYY-MM-DD-` 前缀后的全段（含后缀）。技能 MUST NOT 因目标名已存在而中止归档，MUST NOT 指引用户重命名或删除既有归档，MUST NOT 覆盖既有归档。

#### Scenario: 同名二次归档成功

- **WHEN** 同名变更在同日第二次归档且 CLI 返回 `archive/<今日>-<name>-2/`
- **THEN** 技能 SHALL 在摘要中展示 `Archived to: ...-2/`
- **AND** 月度索引「变更名称」列 SHALL 记录 `<name>-2`

#### Scenario: 索引日期与月份仍取目录名前缀

- **WHEN** 归档目录名为 `<YYYY-MM-DD>-<name>-2`
- **THEN** 「归档日期」SHALL 为前 10 位 `YYYY-MM-DD`
- **AND** 月份 SHALL 取前 7 位，后缀 MUST NOT 影响月份判定

#### Scenario: 不再建议人工改名或删除

- **WHEN** 归档目标名冲突
- **THEN** 技能 MUST NOT 输出「重命名既有归档 / 删除重复 / 换日期」类指引
- **AND** 归档流程 SHALL 继续执行至索引更新与收尾清理

#### Scenario: 模块提取先剥离唯一化后缀

- **WHEN** 索引条目变更名为 `<prefix>-<module>-<feature>-2` 且需按 `{prefix}-{module}-{feature}` 提取模块
- **THEN** 技能 SHALL 先剥离尾部 `-<数字>` 再提取模块与摘要
