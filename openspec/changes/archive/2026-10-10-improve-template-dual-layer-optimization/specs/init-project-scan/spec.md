# init-project-scan Delta Spec

## ADDED Requirements

### Requirement: index.db 初始化步骤
venus init SHALL 在项目扫描步骤之后新增 `openspec/.venus/index.db` 的创建步骤：检查 SQLite CLI 可用性（`sqlite3 --version`），可用时执行建表 DDL（changes / capabilities / decisions_fts / requirements_fts / exploration_memory 五表）。SQLite CLI 不可用时 SHALL 记录 WARN 并跳过。数据库已存在时 SHALL 跳过不覆盖。创建失败 SHALL 为非阻断（与预扫描同策略）。

#### Scenario: 首次 init 创建 index.db
- **WHEN** 全新项目首次运行 `venus init` 且 `sqlite3` CLI 在 PATH
- **THEN** 在项目扫描步骤之后创建 `openspec/.venus/index.db`，含完整建表 DDL

#### Scenario: SQLite CLI 不可用跳过
- **WHEN** `venus init` 执行 index.db 创建步骤，`sqlite3 --version` 返回非零
- **THEN** 记录 WARN "sqlite3 CLI 不可用，跳过 index.db 创建" 并继续

#### Scenario: --no-scan 不影响 index.db
- **WHEN** 执行 `venus init --no-scan`
- **THEN** 跳过项目扫描但 SHALL 仍然执行 index.db 创建步骤（两个步骤独立）