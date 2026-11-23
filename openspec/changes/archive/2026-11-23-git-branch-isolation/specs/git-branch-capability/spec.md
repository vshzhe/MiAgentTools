## ADDED Requirements

### Requirement: 工作区状态检测（只读）

系统 SHALL 在 `src/core/git-capability.ts` 提供 `isWorkingTreeClean(dir, runner?)` 只读函数，接受注入的 `GitCommandRunner`，返回 `{ clean: boolean; dirty: string[] }`。

- 实现 MUST 经 `git status --porcelain` 判定，MUST NOT 写任何文件或改动仓库状态
- `dirty` SHALL 为该命令输出的非空行（原样保留状态码与路径），便于调用方展示
- 命令失败（非 0 退出 / 启动失败）SHALL 返回 `{ clean: false, dirty: [] }` 并附带原因，MUST NOT 抛错

#### Scenario: 干净工作区

- **WHEN** `git status --porcelain` 输出为空
- **THEN** `isWorkingTreeClean` SHALL 返回 `{ clean: true, dirty: [] }`

#### Scenario: 脏工作区返回清单

- **WHEN** `git status --porcelain` 输出两行修改记录
- **THEN** `isWorkingTreeClean` SHALL 返回 `{ clean: false, dirty: [<两行原文>] }`

#### Scenario: 命令失败不抛错

- **WHEN** runner 返回非 0 退出
- **THEN** `isWorkingTreeClean` SHALL 返回 `{ clean: false, dirty: [], reason: <摘要> }`，MUST NOT 抛出异常

### Requirement: 工作分支创建（幂等）

系统 SHALL 提供 `createWorkBranch(options)`，参数为 `{ name: string; baseBranch?: string; cwd: string; runner?: GitCommandRunner }`，返回 `{ action: 'created' | 'reused' | 'skipped'; branch: string; baseBranch: string; reason?: string }`。

- **已在该分支** → `skipped` + `reason`
- **分支已存在** → `reused` + `reason`（MUST NOT 覆盖、MUST NOT 重置）
- **否则** → `git checkout -b <name>` 并返回 `created`；`baseBranch` SHALL 取创建前所在分支（`git rev-parse --abbrev-ref HEAD`），`baseBranch` 显式传入时以传入值为准但 MUST 与当前分支一致，不一致时 SHALL 拒绝并返回失败
- **分支名校验（强制）**：SHALL 拒绝含 `..`、前导 `/`、空白、`~` `^` `:` `?` `*` `[` `\` 的名称，以及空名；拒绝时返回失败状态，MUST NOT 执行任何写命令
- 失败（checkout 非 0 / 不可用）SHALL 返回失败状态与 `stderr` 摘要，MUST NOT 抛错

#### Scenario: 首次创建并记录基分支

- **WHEN** 当前分支为 `main` 且 `iagent/x` 不存在
- **THEN** `createWorkBranch` SHALL 执行 `git checkout -b iagent/x`，返回 `{ action: 'created', branch: 'iagent/x', baseBranch: 'main' }`

#### Scenario: 幂等跳过

- **WHEN** 当前分支已是 `iagent/x`
- **THEN** 返回 `{ action: 'skipped', branch: 'iagent/x' }`，MUST NOT 执行任何写命令

#### Scenario: 分支已存在则复用不覆盖

- **WHEN** `iagent/x` 已存在但当前不在该分支
- **THEN** 返回 `{ action: 'reused', reason: <说明> }`，MUST NOT 重置或删除既有分支
- **AND** MUST 执行 `git checkout <name>` 切换到该分支（否则后续写操作仍落在当前分支，分支隔离语义被静默破坏）；切换失败 SHALL 返回 `failed` 与原因

#### Scenario: 非法分支名拒绝

- **WHEN** 传入名称 `../evil` 或 `bad name`
- **THEN** 返回失败状态且 MUST NOT 执行 `git checkout`

### Requirement: 工作分支合并

系统 SHALL 提供 `mergeWorkBranch(options)`，参数为 `{ name: string; into?: string; cwd: string; runner?: GitCommandRunner }`，返回 `{ ok: boolean; merged: boolean; conflicts: string[]; detail?: string }`。

- 合并命令 SHALL 为 `git merge --no-ff <name>`；`into` 非空时 SHALL 先 `git checkout <into>` 再合并
- 冲突（命令非 0 且输出含冲突标记）→ SHALL 返回 `{ ok: false, merged: false, conflicts: [...] }`，冲突文件列表取自 `git diff --name-only --diff-filter=U`
- **MUST NOT** 执行 `git merge --abort`、**MUST NOT** 执行 `git reset --hard`、**MUST NOT** 丢弃任何已提交内容
- 非冲突失败（分支不存在 / 无共同祖先 / 无提交）→ 返回 `{ ok: false, merged: false, conflicts: [], detail }`，MUST NOT 抛错
- 成功 → `{ ok: true, merged: true, conflicts: [] }`

#### Scenario: 无冲突合并成功

- **WHEN** 工作分支相对基分支可快进或可三方合并且无冲突
- **THEN** 返回 `{ ok: true, merged: true, conflicts: [] }`，且合并提交为 `--no-ff` 形态

#### Scenario: 冲突返回清单且不 abort

- **WHEN** 合并产生两个冲突文件
- **THEN** 返回 `{ ok: false, merged: false, conflicts: [<两个文件>] }`
- **AND** MUST NOT 执行 `git merge --abort`，冲突态 SHALL 保留供用户处置

#### Scenario: 分支不存在

- **WHEN** 传入的 `name` 不存在
- **THEN** 返回 `{ ok: false, merged: false, conflicts: [], detail: <摘要> }`，MUST NOT 抛错

### Requirement: 已合并分支删除

系统 SHALL 提供 `deleteMergedBranch(options)`，参数为 `{ name: string; cwd: string; runner?: GitCommandRunner }`，返回 `{ action: 'deleted' | 'skipped'; reason?: string }`。

- 执行 `git branch -d <name>`（**非** `-D`）：未合并分支 SHALL 被 git 拒绝，函数返回 `skipped` + 原因
- 失败 MUST NOT 抛错

#### Scenario: 已合并分支删除成功

- **WHEN** 分支已完全合并且不在当前分支
- **THEN** 返回 `{ action: 'deleted' }`

#### Scenario: 未合并分支不强制删除

- **WHEN** 分支尚有未合并提交
- **THEN** 返回 `{ action: 'skipped', reason: <git 的拒绝说明> }`
- **AND** MUST NOT 使用 `git branch -D`

### Requirement: 分支操作的工具白名单

需要执行分支操作的技能 SHALL 在 `allowedTools` 中经 `tool-whitelist.ts` 的 `GIT_CLI` 常量获得 `Bash(git:*)`，MUST NOT 逐模板手写字面量。

#### Scenario: 白名单放行分支命令

- **WHEN** 技能执行 `git checkout -b` / `git merge --no-ff` / `git branch -d`
- **THEN** 宿主 SHALL 按白名单放行，MUST NOT 出现权限拦截
