# agent-tool-identity 增量规格

> 本 delta 只做**措辞收口**：跨变更索引（`INDEX_DB_PATH` / `iagent spec reindex`）随本变更整体退役，该 Requirement 原先列举的「跨变更索引目录」已不再是待改名的磁盘产物；保留原措辞会让主规格要求一个不存在的常量与场景。

## MODIFIED Requirements

### Requirement: 品牌命名的磁盘产物一同改名

除项目配置目录外，工具的品牌命名还出现在**三类**磁盘产物上，均 SHALL 改用 iagent 口径：遗留 sidecar 目录（变更目录下的 SIDECAR_DIR，@deprecated 布局）、shell 补全产物（bash 脚本文件、PowerShell profile 脚本、rc/profile 标记块）、会话级权限条目中的 CLI 标识。旧产物的清理 MUST NOT 由本变更完成，SHALL 交由伴生变更 iagent-legacy-migration 处理。

原「跨变更索引目录（`INDEX_DB_PATH` 所在的旧品牌目录）」一项随跨变更索引能力退役（`sqlite-cross-change-index` 全部 REMOVED）：索引路径常量与建库逻辑不再存在，MUST NOT 再为该目录维护改名或路径同步逻辑；旧品牌索引目录的**清理**仍由旧装机迁移承担（见 `legacy-install-migration / 旧版品牌产物清理`）。

#### Scenario: 遗留 sidecar 目录改名

- **GIVEN** 变更目录下的遗留 sidecar 布局常量 SIDECAR_DIR 取值为 '.venus'
- **WHEN** 执行重命名
- **THEN** 常量为 '.iagent'，读取该目录的降级路径同步为新值

#### Scenario: 索引目录随能力退役

- **GIVEN** 跨变更索引能力已整体退役（`INDEX_DB_PATH` 与 `iagent spec reindex` 均已删除）
- **WHEN** 检查品牌命名的磁盘产物清单
- **THEN** MUST NOT 存在「索引目录改名」待办或指向已删常量的路径同步逻辑
- **AND** 用户目录中的历史旧品牌索引库仍由旧装机迁移清理并记入报告

#### Scenario: 补全产物改名

- **GIVEN** 补全安装产出 bash 脚本文件、PowerShell profile 脚本与 rc/profile 标记块
- **WHEN** 执行重命名
- **THEN** 脚本文件名为新品牌口径，标记块起止标记为 IAGENT 口径，安装与卸载使用同一组标记常量

#### Scenario: 标记块一致性

- **GIVEN** 标记块的起止常量被安装与卸载共用
- **WHEN** 执行 completion install 后再执行 uninstall
- **THEN** 安装写入的标记块被卸载精确识别并移除，不残留空标记
