# Spec Delta

## REMOVED Requirements

### Requirement: iagent spec reindex 按降级链读取数据源
**Reason**: 原 reindex 将 change.json 作为归档主链路。
**Migration**: Markdown 成为主来源；历史 JSON 仅在对应 Markdown 缺失时只读降级并告警。

### Requirement: 全文搜索决策和需求
**Reason**: 原索引要求从 JSON 结构化字段获取内容，不能表达 Markdown 来源证据。
**Migration**: 从 Markdown parser 结果构建索引，并携带源文件路径和标题/行号。

## ADDED Requirements

### Requirement: Reindex uses Markdown as the primary source
`iagent spec reindex` SHALL 扫描 `openspec/changes/archive/` 下的归档变更，并以 OpenSpec Markdown 为主来源：proposal.md、design.md、specs/**/*.md 和 exploration.md。解析结果 SHALL 写入既有 SQLite 索引表。`change.json`、旧 manifest/decisions/capabilities 和 tasks.json 仅作为历史 JSON-only 变更的只读降级来源，并 MUST 记录 WARN。索引数据库 SHALL 被视为可重建缓存，删除或损坏后不得影响 Markdown 制品。

#### Scenario: Reindex Markdown archive
- **WHEN** 归档变更包含标准 Markdown 制品
- **THEN** reindex SHALL 从 Markdown 提取变更、能力、决策、需求和探索记忆索引
- **AND** MUST NOT 要求 change.json 或 tasks.json 存在

#### Scenario: Reindex legacy JSON archive
- **WHEN** 归档变更没有对应 Markdown 但存在历史 JSON
- **THEN** reindex MAY 只读解析可支持的 JSON 字段并记录 WARN
- **AND** MUST NOT 修改或删除历史 JSON

#### Scenario: Rebuild after cache loss
- **WHEN** index.db 不存在、损坏或用户指定 `--force`
- **THEN** SHALL 从 Markdown 和兼容输入重新建表并重建索引
- **AND** Markdown 制品内容 SHALL 保持不变

### Requirement: Full-text results retain Markdown evidence
全文索引 SHALL 从 Markdown 解析出的 design 决策、Requirement 和 Scenario 文本构建。搜索结果 SHALL 包含来源变更、文件路径及必要时的行号，便于 Agent 回读原始 Markdown；缓存缺失时 SHALL 允许通过 reindex 重建。

#### Scenario: Search returns Markdown evidence
- **WHEN** spec-verify-proposal 或 proposal-review 查询历史决策或需求
- **THEN** 结果 SHALL 带有原始 Markdown 文件路径和可定位的标题或行号
- **AND** Agent SHALL 回读原文件确认上下文，不得将索引摘要视为唯一证据
