# legacy-install-migration 增量规格

## MODIFIED Requirements

### Requirement: 旧版品牌产物清理

迁移 SHALL 清理四类旧版品牌命名的遗留产物：用户主目录下的旧 bash 补全脚本与 PowerShell profile 补全脚本；rc/profile 文件中由旧起止标记成对包围的旧标记块；变更目录下的旧遗留 sidecar 目录；跨变更索引目录下的旧索引库。清理 MUST 以旧起止标记成对出现为前提，未成对时 MUST NOT 改动 rc/profile。

索引库删除后的报告提示 MUST 为**中性描述**（说明「旧跨变更索引已删除，索引能力已退役」），MUST NOT 指向已删除的命令（`iagent spec reindex`）—— 跨变更索引能力随本次变更整体退役（见 `sqlite-cross-change-index` 的 REMOVED 需求与 `spec-workflow-cli / reindex 子命令已移除`）。旧品牌索引库的**删除**语义保留：清理对象仍是旧品牌目录下的缓存文件，与本工具「不删除用户目录中 `.iagent` 口径的历史 `index.db`」不冲突（两者路径与品牌口径不同，实现 MUST 在代码注释中显式说明该边界）。

#### Scenario: 旧补全脚本与标记块一并清理

- **GIVEN** rc 文件中存在旧起止标记包围的标记块，且用户主目录下存在对应旧补全脚本文件
- **WHEN** 执行 iagent init
- **THEN** 旧标记块从 rc 文件中移除，旧补全脚本文件被删除，二者均记入报告

#### Scenario: 标记块不成对时不改动 rc

- **GIVEN** rc 文件中只存在旧起始标记而无旧结束标记
- **WHEN** 执行迁移
- **THEN** rc 文件不被修改，该情况记入报告的跳过项并告警

#### Scenario: 旧侧车目录清理

- **GIVEN** 变更目录下存在旧遗留 sidecar 目录
- **WHEN** 执行迁移
- **THEN** 该目录被删除并记入报告

#### Scenario: 旧索引库清理提示不指向已删命令

- **GIVEN** 跨变更索引目录下存在旧索引库文件
- **WHEN** 执行迁移
- **THEN** 旧索引库被删除并记入报告
- **AND** 报告提示仅说明索引能力已退役，MUST NOT 出现 `reindex` 命令名（该命令在本次变更中已删除，指向它会把用户导向未知子命令错误）

#### Scenario: 无旧产物时不触碰用户主目录

- **GIVEN** rc 与 user home 中不存在任何旧版补全产物
- **WHEN** 执行 iagent init
- **THEN** 用户主目录与 rc/profile 文件均不被读写
