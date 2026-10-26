# sqlite-cross-change-index Specification

## Purpose

SQLite 跨变更索引：在 `openspec/.venus/index.db` 维护一个本地 SQLite 数据库，归档变更时写入变更/能力/决策/需求索引，供探索和提案阶段快速搜索历史变更——替代 Glob + Grep 全文扫描。

## Requirements

### Requirement: index.db 初始化
venus init SHALL 在 `.venus/` 目录初始化后创建 `openspec/.venus/index.db`，执行建表 DDL（changes / capabilities / requirements / decisions / exploration_memory 五表）。数据库已存在时 SHALL 跳过创建（不覆盖用户数据）。创建失败时 SHALL 记录 WARN 并继续（非阻断，与 scan-baseline 同策略）。

#### Scenario: 全新 init 创建空库
- **WHEN** 首次运行 `venus init` 且项目无 `openspec/.venus/index.db`
- **THEN** 创建 index.db 并执行建表 DDL，logs 显示 "index.db created with N tables"

#### Scenario: 已有数据库跳过
- **WHEN** 运行 `venus init` 且 `openspec/.venus/index.db` 已存在
- **THEN** 跳过创建步骤，不覆盖

#### Scenario: 创建失败非阻断
- **WHEN** `openspec/.venus/` 目录不可写
- **THEN** 记录 WARN "index.db 创建失败（已跳过，不影响 init 主流程）：<reason>" 并继续

### Requirement: 归档写入索引
spec-archive 和 spec-bulk-archive SHALL 在变更归档成功后写入 SQLite 索引：读取变更的 `.venus/manifest.json`、`decisions.json`、`capabilities.json`，INSERT 到 changes / capabilities / decisions（FTS）/ requirements（FTS）表。写入失败 SHALL 记录 WARN 并继续（不阻断归档）。SQLite CLI 不可用时 SHALL 降级为跳过索引写入（WARN）。

#### Scenario: 单变更归档写入索引
- **WHEN** spec-archive 完成变更归档
- **THEN** 读取归档目录下的 JSON sidecar 并写入 index.db 对应表

#### Scenario: 批量归档写入索引
- **WHEN** spec-bulk-archive 完成 N 个变更归档
- **THEN** 所有成功归档的变更批量写入 index.db（单事务，失败全部回滚后逐条重试）

#### Scenario: SQLite 不可用降级
- **WHEN** spec-archive 检测到 sqlite3 CLI 不在 PATH
- **THEN** 记录 WARN "sqlite3 CLI 不可用，跳过索引写入" 并继续归档

### Requirement: 探索查询索引
spec-explore SHALL 在搜索历史探索记忆时优先查询 `exploration_memory` 表：按 capability 筛选，ORDER BY archived_at DESC。index.db 不可用时 SHALL 降级为 Glob `openspec/specs/<capability>/explorations.md`。

#### Scenario: 索引命中
- **WHEN** spec-explore 搜索 capability "export" 的历史记忆
- **THEN** 查询 `SELECT * FROM exploration_memory WHERE capability = 'export' ORDER BY archived_at DESC`，返回所有匹配行

#### Scenario: 索引不可用降级
- **WHEN** spec-explore 查询 index.db 失败（文件不存在/损坏/SQLite CLI 不可用）
- **THEN** 降级为 Glob `openspec/specs/export/explorations.md`，记录 WARN

### Requirement: 提案冲突检测
spec-propose SHALL 在生成提案前优先查询 `capabilities` 表检测能力冲突：`SELECT c.name, ch.name FROM capabilities c JOIN changes ch ON c.change_id = ch.id WHERE c.name IN (<inferred-capabilities>) AND ch.status = 'active'`。返回结果含 2+ 行时 SHALL 提示用户存在冲突。index.db 不可用时 SHALL 降级为 Glob `openspec/changes/*/specs/`。

#### Scenario: 无冲突
- **WHEN** spec-propose 查询 capabilities 表，返回 0 或 1 行
- **THEN** 不提示冲突，正常生成提案

#### Scenario: 有冲突
- **WHEN** 查询返回 "auth" capability 被 2 个 active 变更引用
- **THEN** 提示用户 "检测到能力冲突：auth 已被 add-oauth 和 add-jwt 修改，请协调"

### Requirement: 全文搜索决策和需求
系统 SHALL 支持全文搜索 decisions 和 requirements：decisions 表使用 FTS5 索引（title + choice + rationale），requirements 表使用 FTS5 索引（requirement_name + scenario_text）。spec-verify-proposal 和 tr-impl-review-proposal SHALL 查询 decisions 表获取相关决策上下文。

#### Scenario: 全文搜索历史决策
- **WHEN** spec-verify-proposal 需要验证当前 design 的决策是否与历史冲突
- **THEN** 查询 `SELECT * FROM decisions WHERE decisions MATCH '<keyword>'`，返回相关历史决策

### Requirement: venus spec reindex 重建索引
venus CLI SHALL 提供 `venus spec reindex` 子命令：扫描 `openspec/changes/archive/` 下全部已归档变更，解析各变更的 JSON sidecar（或降级解析 MD），批量写入 index.db。用于存量项目迁移。

#### Scenario: 存量项目批量重建
- **WHEN** 存量项目首次执行 `venus spec reindex`
- **THEN** 扫描 archive/ 下全部变更目录，解析 JSON/MD 后批量写入 index.db

#### Scenario: 部分变更无 JSON sidecar
- **WHEN** archive 下某变更目录无 `.venus/` 子目录
- **THEN** 降级解析该变更的 proposal.md/design.md/tasks.md 提取索引数据，记录 WARN "<change-name> 无 JSON sidecar，已降级解析 MD"