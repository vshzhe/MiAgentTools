## ADDED Requirements

### Requirement: git status 命令

`iagent git status [--json]` SHALL 输出 Git 环境与仓库状态的确定性快照：`{ installed, version?, isRepo, parentRepo, installers[] }`。纯只读，MUST NOT 修改任何文件或仓库状态。

#### Scenario: JSON 输出完整状态

- **WHEN** 在已装 Git 且已是仓库的项目根执行 `iagent git status --json`
- **THEN** 输出 SHALL 含 `installed: true`、`version`、`isRepo: true`、`parentRepo: null`、`installers` 数组

#### Scenario: 未安装 Git

- **WHEN** 环境中无 Git
- **THEN** 输出 SHALL 含 `installed: false`、`isRepo: false`
- **AND** 退出码 SHALL 为 0（状态查询不是错误）

#### Scenario: 纯只读

- **WHEN** 执行 `iagent git status`
- **THEN** MUST NOT 创建 `.git/`、MUST NOT 修改任何被跟踪文件

### Requirement: git init 命令

`iagent git init [--json]` SHALL 幂等初始化仓库，输出 `{ action: 'created' | 'skipped', reason? }`。

- 已是仓库 → `skipped` + 原因（不覆盖、不重置）
- 存在上级仓库 → `skipped` + 原因（防嵌套仓库）
- Git 不可用 → 非零退出码并给出明确错误

#### Scenario: 首次初始化成功

- **WHEN** 在无 `.git/` 且无上级仓库的项目执行 `iagent git init --json`
- **THEN** 输出 `action: 'created'`，且 `.git/` 存在

#### Scenario: 幂等跳过

- **WHEN** 在已是仓库的项目执行 `iagent git init --json`
- **THEN** 输出 `action: 'skipped'`，仓库状态零改动

#### Scenario: 嵌套仓库防护

- **WHEN** 目标目录在另一个仓库内部
- **THEN** 输出 `action: 'skipped'` 且 `reason` 指明上级仓库路径
- **AND** MUST NOT 创建嵌套 `.git/`

### Requirement: 补全表同步

新增的 `git` 命令与子命令 MUST 同步到 `src/commands/completion.ts` 的 `IAGENT_COMMANDS` 表，含 `status` / `init` 子命令与 `--json` 参数。

#### Scenario: 补全覆盖 git 命令

- **WHEN** 生成 bash / pwsh 补全脚本
- **THEN** 脚本 SHALL 含 `git` 及其 `status` / `init` 子命令与 `--json`
