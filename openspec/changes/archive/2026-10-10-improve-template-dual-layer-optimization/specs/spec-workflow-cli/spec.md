# spec-workflow-cli Delta Spec

## ADDED Requirements

### Requirement: venus spec reindex 重建索引
venus CLI SHALL 提供 `venus spec reindex [--force]` 子命令：扫描 `openspec/changes/archive/` 下全部已归档变更目录，解析各变更的 JSON sidecar（`.venus/*.json`），批量导入到 `openspec/.venus/index.db`。JSON sidecar 缺失时 SHALL 降级解析该变更的 proposal.md / design.md / tasks.md 提取索引数据（WARN）。`--force` 时 SHALL 删除现有 index.db 后全量重建。`index.db` 不存在时 SHALL 先调用建表 DDL 再导入。

#### Scenario: 存量项目批量重建
- **WHEN** 存量项目（含有 10 个已归档变更）首次执行 `venus spec reindex`
- **THEN** 扫描 archive/ 下全部 10 个变更，逐个解析 JSON/MD，写入 index.db 全部 5 个表

#### Scenario: 部分变更无 JSON sidecar 降级
- **WHEN** archive 下某变更目录无 `.venus/` 子目录（早期归档的变更）
- **THEN** 降级解析其 proposal.md / tasks.md 提取索引数据，记录 WARN "<change-name> 无 JSON sidecar，已降级解析 MD"

#### Scenario: index.db 不存在时自动创建
- **WHEN** `venus spec reindex` 发现 `openspec/.venus/index.db` 不存在
- **THEN** 先执行建表 DDL 创建数据库，再执行导入

#### Scenario: --force 全量重建
- **WHEN** `venus spec reindex --force`
- **THEN** 删除现有 index.db，重新建表，全量重新扫描导入

#### Scenario: archive 目录为空
- **WHEN** `openspec/changes/archive/` 下无任何变更目录
- **THEN** 输出 "无已归档变更可索引"，退出码 0

## MODIFIED Requirements

### Requirement: venus spec status 状态校验
原需求不变。新增：JSON 模式下输出增加 `sidecarStatus` 字段，值为 `"available"`（`.venus/` 下 4 个 JSON 均存在）、`"partial"`（部分存在）、`"missing"`（全部缺失）。CLI 已降级模式时不影响状态判定。

#### Scenario: sidecar 完整
- **WHEN** 变更目录的 `.venus/` 下 manifest.json / tasks.json / decisions.json / capabilities.json 均存在
- **THEN** `--json` 输出 `sidecarStatus: "available"`

#### Scenario: sidecar 部分缺失
- **WHEN** 变更目录仅有 manifest.json 和 tasks.json
- **THEN** `--json` 输出 `sidecarStatus: "partial"`，warnings 含缺失文件列表