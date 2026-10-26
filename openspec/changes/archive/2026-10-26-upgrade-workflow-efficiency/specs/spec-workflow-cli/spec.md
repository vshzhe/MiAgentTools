# spec-workflow-cli 增量规格

## ADDED Requirements

### Requirement: reindex 子命令已移除

`iagent spec reindex` 子命令 SHALL 被删除（DEC-2，BREAKING）：命令注册、`--force` 全量分支、manifest 增量判定、legacy JSON 降级分支与全部辅助函数（`indexChangeJsonEntry` / `indexSpecsMdFallback` / `indexDesignMdFallback` / `indexExplorationMdFallback` 等）一并移除。

删除后 MUST 满足：

- `iagent spec --help` 与 shell 补全的 `spec` 二级候选中 MUST NOT 出现 `reindex`；
- 调用 `iagent spec reindex` SHALL 表现为未知子命令错误（退出码非零），MUST NOT 静默成功、MUST NOT 保留弃用桩；
- `iagent init` MUST NOT 再创建索引库，也 MUST NOT 输出索引创建/跳过的结果行；
- **代码与产物面** MUST NOT 残留 `reindex` / `index.db` / `sqlite3` / `sql.js` 引用（回归锁），范围为 `src/**`（含 `src/core/templates/**`）与生成快照 `skills/**`；**允许的历史落点**严格限于 `docs/upgrade-guide.md`（升级说明）与 `src/core/legacy-migration.ts` 的旧品牌常量（`LEGACY_INDEX_DB_FILE` / `LEGACY_INDEX_DIR_RELATIVE_PATH`，且该文件 MUST NOT 含 `reindex` 文案）、`CHANGELOG.md` 的既有历史小节 —— 白名单 MUST 以精确路径枚举，MUST NOT 用宽前缀放过整个 `src/` 或整个 `docs/`；
- 本工具 MUST NOT 删除用户目录中的历史 `index.db`。

#### Scenario: 子命令不再注册

- **WHEN** 运行 `iagent spec --help` 或生成 bash / powershell 补全脚本
- **THEN** `spec` 的子命令清单不含 `reindex`，且命令总数与 `src/commands/spec.ts` 实际注册一致

#### Scenario: 调用已移除的子命令报错

- **WHEN** 用户执行 `iagent spec reindex`
- **THEN** 命令以非零退出码失败并提示未知子命令，MUST NOT 执行任何索引重建

#### Scenario: init 不再创建索引

- **WHEN** 在全新项目执行 `iagent init`
- **THEN** 不创建 `openspec/changes/archive/.iagent/index.db`，输出中不含索引相关行

#### Scenario: 历史 index.db 不被删除

- **WHEN** 项目已存在历史 `index.db` 并执行 `iagent init` / `iagent update`
- **THEN** 该文件保持原样（不读取、不写入、不删除），升级文档给出清理指引

## MODIFIED Requirements

### Requirement: shell 补全 SHALL 覆盖全部 spec 子命令

`src/commands/completion.ts` 的 `IAGENT_COMMANDS` 中 `spec` 条目的 `subcommands` 列表 MUST 与 `src/commands/spec.ts` 实际注册的子命令集合完全一致，当前集合为 `new` / `status` / `migrate` / `validate` / `instructions` / `archive` / `render` / `sidecar`（`reindex` 已随索引退役删除）。`spec` 的描述字符串 MUST 同步列出这些子命令。

#### Scenario: 补全表含 migrate 与 validate

- **WHEN** 生成 bash / powershell 补全脚本
- **THEN** `iagent spec` 的第二级补全候选项 SHALL 含 `migrate` 与 `validate`
- **AND** `spec` 描述字符串 SHALL 不再声称旧子命令集

#### Scenario: 补全表不含已退役子命令

- **WHEN** 生成补全脚本并检查 `spec` 的二级候选
- **THEN** 候选中 MUST NOT 含 `reindex`

#### Scenario: 补全表由程序派生并受断言约束

- **WHEN** 运行补全一致性测试
- **THEN** 测试 SHALL 从 Commander 程序中提取 `spec` 子命令集合
- **AND** 断言 `IAGENT_COMMANDS` 的 `subcommands` 与其相等（缺项 / 多项即失败）
