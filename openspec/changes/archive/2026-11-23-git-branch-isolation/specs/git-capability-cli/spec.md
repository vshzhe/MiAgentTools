## ADDED Requirements

### Requirement: git branch 与 git merge 子命令

`iagent git` 命令组 SHALL 新增两个子命令（均支持 `--json`）：

| 子命令 | 参数 | 输出（`--json`） |
| :--- | :--- | :--- |
| `branch` | `--create <name>` / `--delete <name>` / `--base <branch>` | `{ action: 'created'\|'reused'\|'skipped'\|'deleted'\|'failed', branch?, baseBranch?, reason? }` |
| `merge <branch>` | `--into <branch>` | `{ ok, merged, conflicts[], detail? }` |

- 输出 MUST 为确定性 JSON（字段名固定），供技能正文解析
- `branch --create` 创建失败（非法名 / checkout 失败）SHALL 以非 0 退出码结束并给出 `reason`
- `merge` 冲突 SHALL 以非 0 退出码结束，`conflicts` 列出冲突文件，MUST NOT 自动 abort
- 既有 `status` / `init` 子命令契约 MUST NOT 改变

#### Scenario: branch --create 输出契约

- **WHEN** 在干净工作区执行 `iagent git branch --create iagent/x --json`
- **THEN** 输出 SHALL 含 `action: 'created'`、`branch`、`baseBranch`，退出码 0

#### Scenario: merge 冲突输出契约

- **WHEN** 执行 `iagent git merge iagent/x --json` 且产生冲突
- **THEN** 输出 SHALL 含 `ok: false`、`merged: false`、`conflicts: [<文件>]`，退出码非 0

### Requirement: 补全表同步（扩展）

`src/commands/completion.ts` 的 `IAGENT_COMMANDS` 表中 `git` 条目 SHALL 同步新子命令与参数：`subcommands` 增 `branch` / `merge`，`flags` 增 `--create` / `--delete` / `--base` / `--into`。

#### Scenario: 补全覆盖分支子命令

- **WHEN** 生成 bash / pwsh 补全脚本
- **THEN** 脚本 SHALL 含 `branch` / `merge` 与 `--create` / `--delete` / `--base` / `--into`
