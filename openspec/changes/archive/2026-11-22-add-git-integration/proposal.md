# 提案：Git 能力集成（init 安装/初始化 + 归档自动提交）

## Why

用户原始诉求（`exploration.md` §Background，逐字保留）：

> 优化 project-init 初始化流程，增加 git 安装和项目 git 初始化检查，如果本地没有安装推荐自动安装 git，但需要用户确认；本地 git 正常，在初始化时项目自动 git 初始化；归档 archive、bulk-archive 时，自动跳跃 commit 提交本地 Git，是否推送远程需要用户确认。

**现状是能力空白**（`exploration.md` §根因 R1-R7，均带证据）：

1. **R1/R2 init 侧完全不碰 Git**：`project-init.ts` 的 11 步没有任何 Git 检测或初始化；`init.ts:176-200` 的 `resolveChangeArtifactsHint` **只在 `.git/` 已存在时**给 `.gitignore` 提示 —— 新项目连这条提示都不会出现。
2. **R3 归档侧无 commit**：`spec-archive.ts` 的 10 步与 `spec-bulk-archive.ts` 的 11 步都不含 Git 操作，归档成品仍需人工再跑 `/iagent:commit`，与「一站式」定位不符。
3. **R4 安全契约缺位**：`commit.ts` 明写「MUST NOT 自动 commit」+「首次执行前必须确认」—— 归档自动提交必须先定义窄通道边界，否则与既有明文约束直接冲突。
4. **R5 无推送能力**：全仓库无 `git push` 引用。
5. **R6/R7 白名单缺位**：三个技能的 `allowedTools` 均无 `Bash(git:*)`（`project-init.ts:166`、`spec-archive.ts:21`、`spec-bulk-archive.ts:21`），即使正文加了步骤也会被权限拦截。

**为什么是现在**：`commit.ts` 已沉淀完整的提交协议（提案制品精确暂存清单、Conventional Commits 规范、尾行 `提案:` 溯源），归档自动提交可以直接复用，不需另立一套。

**反例已存在**：`dependencies.ts` 的 `ensureDependencies` 已提供「检测 → 安装 → 失败仅警告」的成熟范式（含 `CommandRunner` 注入便于测试），Git 能力沿用它即可。

## What Changes

### 1. 新增：Git 能力内核（`git-capability`）

新增 `src/core/git-capability.ts`，检测与执行分离：

**检测（纯只读，无副作用）**

| 函数 | 作用 |
| :--- | :--- |
| `detectGit(runner)` | `git --version` → `{ installed, version }` |
| `isGitRepository(dir)` | `.git/` 存在性 |
| `findParentRepository(dir)` | 向上查找上级仓库（防嵌套仓库误 init） |
| `probeInstallers(runner)` | 按平台探测可用包管理器：Windows `winget/choco/scoop`、macOS `brew`、Linux `apt/dnf/pacman` |

**执行（注入 runner）**

| 函数 | 作用 |
| :--- | :--- |
| `installGit(runner, installer)` | 执行探测到的安装命令 |
| `initRepository(runner, cwd)` | `git init`（**幂等**：已有 `.git/` 或有上级仓库时直接返回 `skipped`） |
| `collectArchiveCommitPaths(changeRoot)` | 复用 `commit.ts` §2.5 固定清单构造待暂存路径 |
| `stagePathsAndCommit(runner, cwd, paths, message)` | 精确 `git add <paths>` + `git commit` |
| `push(runner, cwd)` | `git push`（无 remote 时返回明确状态） |

所有执行函数接受 `CommandRunner`（与 `dependencies.ts:33` 同签名），**测试不产生真实进程**。

### 2. 新增：可选 CLI 命令（`git-capability-cli`）

- `iagent git status --json`：输出 `{ installed, version, isRepo, parentRepo, installers[] }`
- `iagent git init --json`：幂等初始化，输出 `{ action: 'created' | 'skipped', reason }`

供技能正文确定性调用，避免模型自行拼命令。新增命令 MUST 同步 `completion.ts` 的 `IAGENT_COMMANDS` 表。

### 3. 修改：project-init 增加前置环境检查（`project-init-git`）

在现有 11 步**之前**插入 Step 0「前置环境检查」：

1. `iagent git status` 检测
2. **未安装** → 探测安装器 → **⛔ 安装确认门（`destructive-change`）**：展示将执行的命令（如 `winget install --id Git.Git -e`）；确认后执行，拒绝则跳过 Git 能力并记 WARN
3. **已安装** → `iagent git init`（幂等）：无 `.git/` 且无上级仓库则创建；已有则零改动跳过；检测到上级仓库则提示并跳过
4. 全程**非阻断**：任一步失败记 WARN 并继续初始化

`allowedTools` 补齐 `Bash(git:*)`（经 `tool-whitelist.ts` 共享常量）。

### 4. 修改：spec-archive 归档后自动提交（`archive-auto-commit`）

在现有 Step 7（索引更新）之后、Step 8（摘要）之前插入「Step 7.5 归档自动提交」：

1. 收集待提交路径：本次变更的代码改动 + 该变更制品固定清单（复用 `collectArchiveCommitPaths`）
2. 无路径可提交 → 跳过并说明（不视为失败）
3. 精确 `git add <paths>`（MUST NOT `git add -A`）+ `git commit`，提交信息沿用 `commit.ts` §3 规范 + 尾行 `提案: <change-name>`
4. **失败不阻断**：钩子拒绝 / 权限 / 用户身份未配置 / detached HEAD / 冲突中 → WARN + 建议，归档结果不变
5. 提交成功后 **⛔ 推送确认门（`destructive-change`）**：确认则 `git push`，拒绝则保留本地提交

### 5. 修改：spec-bulk-archive 批量归档后自动提交（`archive-auto-commit`）

在现有 Step 10（索引更新）之后插入「Step 10.5 批量归档自动提交」：

- **整批一次提交**（不逐变更提交），提交信息汇总各变更名
- 仅对**成功归档**的变更收集路径；部分失败时只提交成功者并另行报告
- 其余（精确暂存 / 失败不阻断 / 推送确认门）与单变更归档同语义

### 6. 修改：收窄 `commit.ts` 的「MUST NOT 自动 commit」

原约束改写为**限定作用域**：

> 交互式 `/iagent:commit` 调用 MUST NOT 自动 commit，确认前 MUST NOT 执行 `git commit`。
> **例外（窄通道）**：`iagent_spec_archive` / `iagent_spec_bulk_archive` 的归档收尾 MAY 自动执行本地 commit，但必须满足：① 只暂存固定清单（MUST NOT `git add -A`）；② 推送前必须经 `push` 确认门且该门不可 skip；③ 失败不阻断归档。

**BREAKING**：无。新增 CLI 命令与能力内核为加法；`commit.ts` 的约束为**收窄**（原交互式语义不变），非推翻。

## Capabilities

### New Capabilities

- `git-capability`: Git 能力内核——检测（安装状态 / 仓库状态 / 上级仓库 / 可用安装器）与执行（安装 / 初始化 / 精确暂存提交 / 推送）分离，runner 可注入以便测试。
- `git-capability-cli`: `iagent git status|init` 命令——供技能确定性调用，避免模型自拼命令；输出 JSON 结构化状态。
- `project-init-git`: project-init 的前置 Git 环境检查——安装检测 + 安装确认门 + 幂等初始化，全程非阻断。
- `archive-auto-commit`: 归档（单变更与批量）收尾的自动本地提交——固定清单暂存、复用既有提交信息规范、失败不阻断、推送经确认门。

### Modified Capabilities

- `commit-push-skill`: 「MUST NOT 自动 commit」收窄作用域到交互式调用，并显式定义归档自动提交的窄通道边界。
- `init-project-scan`: project-init 新增 Step 0 前置环境检查（Git）；原 11 步编号**不变**（用小数 Step 0 前置插入，避免大面积重排与交叉引用失配）。

## Impact

### Impact Analysis

| 符号 | 位置 | 直接上游影响（调用方 / 依赖方） | 波及的测试面 | 改动要求 |
| :--- | :--- | :--- | :--- | :--- |
| `spawnCommand` | `src/core/child-process.ts:87` | `dependencies.ts`、`pi-runtime.ts` 等 | `child-process.test.ts` | **零改动**（复用为唯一外部进程入口） |
| `CommandRunner` | `src/core/dependencies.ts:33` | `ensureDependencies` | `dependencies.test.ts` | **零改动**（Git 内核对齐其签名） |
| `resolveChangeArtifactsHint` | `src/commands/init.ts:186` | `runInit` | `commands.test.ts` | **零改动**（Git init 后该提示自然生效） |
| `GATE_WHITELIST` / `GATE_SKIP_IDS` | `src/core/host-orchestration/protocol.ts:98` / `delegation-contract.ts:26` | 门校验链 | `gate-ledger.test.ts`、`host-orchestration.test.ts` | **零改动**（安装/推送归既有 `destructive-change`，不新增 id） |
| `getProjectInitSkillTemplate` | `project-init.ts:161` | registry | `project-init-scan.test.ts`、`skill-size-budget.test.ts` | 新增 Step 0 + 白名单 |
| `getSpecArchiveSkillTemplate` | `spec-archive.ts:19` | registry | `skill-size-budget.test.ts`、`skills-parity.test.ts` | 新增 Step 7.5 + 白名单 |
| `getSpecBulkArchiveSkillTemplate` | `spec-bulk-archive.ts:19` | registry | 同上 | 新增 Step 10.5 + 白名单 |
| `getCommitSkillTemplate` | `commit.ts:5` | registry | `commit-skill-templates.test.ts` | 约束收窄（MODIFIED） |
| `IAGENT_COMMANDS` | `src/commands/completion.ts:45` | 补全脚本生成 | `completion-config.test.ts` | 新增 `git` 命令与子命令参数 |

### 影响面小结

- **新增为主**：1 个内核模块（`git-capability.ts`）、1 个 CLI 命令组（`iagent git`）、4 个新能力规格。
- **改动为辅**：3 个技能正文 + 1 个约束收窄 + 2 处白名单。
- **回归高危面**：`project-init` 与 `spec-archive` 均接近尺寸预算，新增正文 MUST 走 references 下沉；白名单经共享常量构造，MUST NOT 手写。
- **边界约束**：不改门白名单 5 类；不新增 `GATE_SKIP_IDS`；`git init` 幂等；commit 只碰固定清单。

### 直接影响的文件

- `src/core/git-capability.ts`（**新建**）：检测与执行内核。
- `src/commands/git.ts`（**新建**）：`iagent git status|init`。
- `src/cli/index.ts`：注册 `git` 命令组。
- `src/commands/completion.ts`：补全表同步。
- `src/core/templates/tool-whitelist.ts`：新增 `GIT_CLI` 共享常量（`Bash(git:*)`）。
- `src/core/templates/workflows/project-init.ts` / `spec-archive.ts` / `spec-bulk-archive.ts`：新增步骤 + 白名单。
- `src/core/templates/workflows/commit.ts`：约束收窄。
- `openspec/CONTEXT.md`、`AGENTS.md`：新增术语与单一源说明。

### 向后兼容

- `iagent git` 为新命令，不影响既有命令面。
- `project-init` 的 Step 0 全程非阻断；未装 Git 且用户拒绝时初始化照常完成。
- 归档自动提交失败不阻断归档（沿用既有 fail-safe 非阻断语义）。
- `commit.ts` 的交互式语义完全不变，仅新增例外条款。
