## ADDED Requirements

### Requirement: Git 能力检测（只读）

系统 SHALL 在 `src/core/git-capability.ts` 提供只读检测函数，全部接受注入的 `CommandRunner`（与 `src/core/dependencies.ts` 的 `CommandRunner` 同签名），MUST NOT 在检测路径产生写副作用：

| 函数 | 输出 |
| :--- | :--- |
| `detectGit(runner)` | `{ installed: boolean; version?: string }` |
| `isGitRepository(dir)` | `boolean`（`.git/` 存在性） |
| `findParentRepository(dir)` | 上级仓库根路径或 `null` |
| `probeInstallers(runner)` | 可用的安装器列表（含将执行的命令） |

多平台探测顺序：Windows `winget` → `choco` → `scoop`；macOS `brew`；Linux `apt` → `dnf` → `pacman`。

#### Scenario: 检测到 Git 已安装

- **WHEN** 注入的 runner 对 `git --version` 返回状态 0 与版本号
- **THEN** `detectGit` SHALL 返回 `{ installed: true, version: '<版本号>' }`

#### Scenario: 未安装 Git

- **WHEN** runner 对 `git --version` 返回非 0 或命令不存在
- **THEN** `detectGit` SHALL 返回 `{ installed: false }`，MUST NOT 抛错

#### Scenario: 探测到上级仓库

- **WHEN** 目标目录本身无 `.git/`，但其父目录链上存在 `.git/`
- **THEN** `findParentRepository` SHALL 返回该上级仓库根路径
- **AND** 调用方据此跳过 `git init`，MUST NOT 在子目录创建嵌套仓库

#### Scenario: 安装器探测

- **WHEN** 在无任何受支持包管理器的环境调用 `probeInstallers`
- **THEN** 返回空列表且不抛错，调用方据此只给建议命令而不执行安装

### Requirement: Git 执行（幂等与精确暂存）

系统 SHALL 提供以下执行函数，全部接受注入的 `CommandRunner` 与工作目录：

| 函数 | 语义 |
| :--- | :--- |
| `initRepository(runner, cwd)` | `git init`，**幂等**：已有 `.git/` 或存在上级仓库时返回 `{ action: 'skipped', reason }` |
| `installGit(runner, installer)` | 执行探测到的安装命令 |
| `collectArchiveCommitPaths(changeRoot)` | 按固定清单构造待暂存路径 |
| `stagePathsAndCommit(runner, cwd, paths, message)` | 精确 `git add <paths>` + `git commit` |
| `push(runner, cwd)` | `git push` |

**精确暂存（强制）**：`stagePathsAndCommit` MUST NOT 使用 `git add -A` / `git add .` / `git add openspec`；传入路径 SHOULD 为绝对或仓库相对的具体文件。

#### Scenario: 幂等初始化

- **WHEN** 目标目录已存在 `.git/`
- **THEN** `initRepository` SHALL 返回 `{ action: 'skipped' }` 且 MUST NOT 执行任何写命令

#### Scenario: 首次初始化

- **WHEN** 目标目录无 `.git/` 且无上级仓库
- **THEN** `initRepository` SHALL 执行 `git init` 并返回 `{ action: 'created' }`

#### Scenario: 精确暂存

- **WHEN** 传入三个具体文件路径
- **THEN** 执行的 `git add` 参数 SHALL 恰为这三个路径
- **AND** MUST NOT 出现 `-A`、`.` 或目录级通配

#### Scenario: 提交失败不抛错

- **WHEN** `git commit` 返回非 0（钩子拒绝 / 身份未配置）
- **THEN** `stagePathsAndCommit` SHALL 返回失败状态与 stderr 摘要，MUST NOT 抛出异常

### Requirement: 归档提交路径清单

`collectArchiveCommitPaths(changeRoot)` SHALL 返回该变更的制品固定清单路径，与 `iagent_commit` 的 §2.5 清单保持一致：`proposal.md` / `design.md` / `tasks.md` / `exploration.md` / `.openspec.yaml` / `specs/**/*.md`。MUST NOT 包含 `attachments/**` 与 `需求文档.md`；不存在的条目 SHALL 跳过且不报错。

#### Scenario: 清单与 commit 技能一致

- **WHEN** 变更目录含全部标准制品
- **THEN** 返回路径集合 SHALL 等于 `commit.ts` §2.5 的固定清单（不含 attachments 与需求文档）

#### Scenario: 部分制品缺失

- **WHEN** 变更目录缺少 `design.md`
- **THEN** 返回路径中 MUST NOT 含该文件，且 MUST NOT 报错
