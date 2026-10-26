## MODIFIED Requirements

### Requirement: reindex 命令 SHALL 按降级链读取数据源
`venus spec reindex` MUST 按降级链读取每个归档变更的数据：`.venus/change.json`（主）→ 旧 JSON（manifest/decisions/capabilities）→ MD 散文解析，逐级 WARN。SQLite 表结构 MUST 保持不变（5 表不新增列）。

#### Scenario: change.json 主链路
- **WHEN** reindex 处理含 change.json 的归档变更
- **THEN** SHALL 从 change.json 提取：根字段（changeName/phase）+ proposal 段（capabilities 列表 → capabilities 表；why/whatChanges 首条截断 200 字符 → changes.summary）
- **AND** design 段的 decisions[] → decisions_fts 表
- **AND** specs 段的 operations[].requirement + scenarios 文本 → requirements_fts 表（capability_name 取 specs[].name）

#### Scenario: 旧 JSON 与 MD 降级
- **WHEN** change.json 缺失但存在 manifest.json / decisions.json / capabilities.json
- **THEN** SHALL 降级读取旧 3 文件（WARN：change.json 缺失）
- **AND** 旧文件也缺失时 SHALL 降级解析 proposal.md / design.md / specs/*.md（WARN）

#### Scenario: tasks 与探索记忆读取不变
- **WHEN** reindex 处理 tasks 与 exploration.md
- **THEN** tasks.json（不存在时 tasks.md）与 exploration.md 的既有读取逻辑 MUST 保持不变