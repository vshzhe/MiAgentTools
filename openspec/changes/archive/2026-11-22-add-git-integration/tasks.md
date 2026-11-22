# Tasks: add-git-integration

> 流程基准：`exploration.md` §功能流程图 N1-N15（已确认）。

## 1. Git 能力内核（git-capability.ts）

- [x] 1.1 [代码] 新建 `src/core/git-capability.ts`：检测函数 `detectGit` / `isGitRepository` / `findParentRepository` / `probeInstallers`，全部接受注入 `CommandRunner`，纯只读 [N2][N3][N6]
  - 文件：`src/core/git-capability.ts`
  - 验证：无写副作用；单测可注入 mock runner
  - Spec Ref：git-capability / Git 能力检测（只读）

- [x] 1.2 [代码] 在 `git-capability.ts` 实现执行函数 `initRepository`（双幂等：`.git/` 存在或上级仓库 → `skipped`）/ `installGit` / `push` [N5][N7][N8][N14]
  - 文件：`src/core/git-capability.ts`
  - 验证：幂等返回 `skipped`；写操作仅经 runner
  - Spec Ref：git-capability / Git 执行（幂等与精确暂存）

- [x] 1.3 [代码] 在 `git-capability.ts` 实现 `collectArchiveCommitPaths(changeRoot)`（复用 commit.ts §2.5 固定清单，排除 attachments 与需求文档）与 `stagePathsAndCommit(runner, cwd, paths, message)`（精确 add，MUST NOT `-A`） [N10][N12]
  - 文件：`src/core/git-capability.ts`
  - 验证：路径集合与 commit.ts 清单一致；add 参数恰为传入路径
  - Spec Ref：git-capability / 归档提交路径清单

- [x] 1.4 [测试][单元][P0] 检测函数单测：已装/未装/版本解析/仓库存在性/上级仓库探测/安装器探测（含全部不可用返回空） [N2][N3][N6]
  - 文件：`test/git-capability.test.ts`
  - 验证：`pnpm test test/git-capability.test.ts` 全绿
  - Spec Ref：git-capability / Git 能力检测（只读）
  - Scenario Ref：git-capability / Git 能力检测（只读） / 检测到 Git 已安装
  - Scenario Ref：git-capability / Git 能力检测（只读） / 未安装 Git
  - Scenario Ref：git-capability / Git 能力检测（只读） / 探测到上级仓库
  - Scenario Ref：git-capability / Git 能力检测（只读） / 安装器探测

- [x] 1.5 [测试][单元][P0] 执行函数单测：幂等 init / 首次 init / 精确暂存参数 / 提交失败不抛错 [N7][N8][N12]
  - 文件：`test/git-capability.test.ts`
  - 验证：四类断言通过
  - Spec Ref：git-capability / Git 执行（幂等与精确暂存）
  - Scenario Ref：git-capability / Git 执行（幂等与精确暂存） / 幂等初始化
  - Scenario Ref：git-capability / Git 执行（幂等与精确暂存） / 首次初始化
  - Scenario Ref：git-capability / Git 执行（幂等与精确暂存） / 精确暂存
  - Scenario Ref：git-capability / Git 执行（幂等与精确暂存） / 提交失败不抛错

- [x] 1.6 [测试][单元][P0] 归档提交路径清单单测：与 commit.ts 清单一致 / 部分制品缺失不报错 [N10]
  - 文件：`test/git-capability.test.ts`
  - 验证：两类断言通过
  - Spec Ref：git-capability / 归档提交路径清单
  - Scenario Ref：git-capability / 归档提交路径清单 / 清单与 commit 技能一致
  - Scenario Ref：git-capability / 归档提交路径清单 / 部分制品缺失

## 2. CLI 命令（iagent git status|init）

- [x] 2.1 [代码] 新建 `src/commands/git.ts`：`status` 输出 `{ installed, version?, isRepo, parentRepo, installers[] }`；`init` 输出 `{ action, reason? }`；均支持 `--json` [N2][N6][N7]
  - 文件：`src/commands/git.ts`
  - 验证：实机 `iagent git status --json` / `iagent git init --json` 输出正确
  - Spec Ref：git-capability-cli / git status 命令

- [x] 2.2 [代码] `src/cli/index.ts` 注册 `git` 命令组；`src/commands/completion.ts` 的 `IAGENT_COMMANDS` 表同步 `git` 与 `status` / `init` 子命令 [N2]
  - 文件：`src/cli/index.ts` / `src/commands/completion.ts`
  - 验证：`iagent git --help` 列出子命令；补全脚本含 git
  - Spec Ref：git-capability-cli / 补全表同步

- [x] 2.3 [测试][单元][P0] git 命令单测：status 完整状态 / 未装 Git 退出码 0 / 纯只读 / init 首次创建 / 幂等跳过 / 嵌套仓库防护 [N2][N6][N7][N8]
  - 文件：`test/git-command.test.ts`
  - 验证：六类断言通过
  - Spec Ref：git-capability-cli / git status 命令
  - Scenario Ref：git-capability-cli / git status 命令 / JSON 输出完整状态
  - Scenario Ref：git-capability-cli / git status 命令 / 未安装 Git
  - Scenario Ref：git-capability-cli / git status 命令 / 纯只读
  - Spec Ref：git-capability-cli / git init 命令
  - Scenario Ref：git-capability-cli / git init 命令 / 首次初始化成功
  - Scenario Ref：git-capability-cli / git init 命令 / 幂等跳过
  - Scenario Ref：git-capability-cli / git init 命令 / 嵌套仓库防护

- [x] 2.4 [测试][单元][P1] 补全表覆盖 git 命令与子命令 [N2]
  - 文件：`test/completion-config.test.ts`
  - 验证：断言补全脚本含 `git` / `status` / `init`
  - Spec Ref：git-capability-cli / 补全表同步
  - Scenario Ref：git-capability-cli / 补全表同步 / 补全覆盖 git 命令

## 3. 共享白名单常量与三个技能白名单

- [x] 3.1 [代码] `src/core/templates/tool-whitelist.ts` 新增 `GIT_CLI = 'Bash(git:*)'` 共享常量 [N1]
  - 文件：`src/core/templates/tool-whitelist.ts`
  - 验证：导出可用；四技能引用同一常量
  - Spec Ref：project-init-git / project-init 工具白名单

- [x] 3.2 [代码] `project-init.ts` / `spec-archive.ts` / `spec-bulk-archive.ts` 的 `allowedTools` 追加 `${GIT_CLI}`（MUST NOT 手写字面量） [N1][N9]
  - 文件：`src/core/templates/workflows/project-init.ts` / `spec-archive.ts` / `spec-bulk-archive.ts`
  - 验证：生成产物含 `Bash(git:*)`
  - Spec Ref：project-init-git / project-init 工具白名单
  - Spec Ref：archive-auto-commit / 归档技能工具白名单

- [x] 3.3 [测试][单元][P0] 白名单单测：三技能生成产物含 `Bash(git:*)`；`GIT_CLI` 常量被共享引用 [N1]
  - 文件：`test/allowed-tools.test.ts`
  - 验证：三类断言通过
  - Spec Ref：project-init-git / project-init 工具白名单
  - Scenario Ref：project-init-git / project-init 工具白名单 / 白名单放行 git
  - Spec Ref：archive-auto-commit / 归档技能工具白名单
  - Scenario Ref：archive-auto-commit / 归档技能工具白名单 / 白名单放行 git

## 4. project-init 前置环境检查（Step 0）

- [x] 4.1 [代码] `project-init.ts` 新增 Step 0「前置环境检查」：git status 检测 → 未装走安装确认门（`destructive-change`，展示确切命令）→ 已装走幂等 init；全程非阻断 [N1][N2][N3][N4][N5][N6][N7][N8][N9]
  - 文件：`src/core/templates/workflows/project-init.ts`
  - 验证：生成正文含 Step 0 全部节点语义与门引用；尺寸预算通过
  - Spec Ref：project-init-git / project-init 前置 Git 环境检查
  - Spec Ref：init-project-scan / 项目初始化扫描协议

- [x] 4.2 [测试][单元][P0] project-init Step 0 单测：已有仓库跳过 / 未初始化时 init / 未装确认后安装 / 拒绝则跳过+WARN / 上级仓库防护 [N2][N4][N5][N6][N7][N8]
  - 文件：`test/project-init-scan.test.ts`
  - 验证：五类断言通过
  - Spec Ref：project-init-git / project-init 前置 Git 环境检查
  - Scenario Ref：project-init-git / project-init 前置 Git 环境检查 / Git 已安装且项目未初始化
  - Scenario Ref：project-init-git / project-init 前置 Git 环境检查 / 已是仓库
  - Scenario Ref：project-init-git / project-init 前置 Git 环境检查 / 未安装且用户确认安装
  - Scenario Ref：project-init-git / project-init 前置 Git 环境检查 / 未安装且用户拒绝
  - Scenario Ref：project-init-git / project-init 前置 Git 环境检查 / 上级仓库防护
  - Spec Ref：init-project-scan / 项目初始化扫描协议
  - Scenario Ref：init-project-scan / 项目初始化扫描协议 / Step 0 先于扫描
  - Scenario Ref：init-project-scan / 项目初始化扫描协议 / Git 不可用时不阻断

## 5. 归档自动提交（单变更 + 批量）

- [x] 5.1 [代码] `spec-archive.ts` 新增 Step 7.5「归档自动提交」：收集路径 → 精确 add + commit（尾行 `提案:`）→ 失败不阻断 → 推送确认门 `destructive-change` [N10][N11][N12][N13][N14][N15]
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - 验证：生成正文含 Step 7.5 与门引用；尺寸预算通过
  - Spec Ref：archive-auto-commit / 单变更归档自动提交

- [x] 5.2 [代码] `spec-bulk-archive.ts` 新增 Step 10.5「批量归档自动提交」：整批一次提交、仅成功归档者、部分失败另行报告 [N10][N12][N13][N14][N15]
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`
  - 验证：生成正文含 Step 10.5；整批一次提交语义明确
  - Spec Ref：archive-auto-commit / 批量归档自动提交

- [x] 5.3 [代码] `commit.ts` 收窄「MUST NOT 自动 commit」为限定作用域，新增窄通道例外（三项硬性前提） [N12]
  - 文件：`src/core/templates/workflows/commit.ts`
  - 验证：生成正文含例外条款与三项前提；交互式语义不变
  - Spec Ref：commit-push-skill / 提交范围确定（四场景）

- [x] 5.4 [测试][单元][P0] 归档自动提交单测：提交成功 / 无路径跳过 / 只暂存固定清单 / 失败不阻断 / 推送门拒绝 / 推送门不可 skip [N10][N11][N12][N13][N15]
  - 文件：`test/archive-auto-commit.test.ts`
  - 验证：六类断言通过
  - Spec Ref：archive-auto-commit / 单变更归档自动提交
  - Scenario Ref：archive-auto-commit / 单变更归档自动提交 / 提交成功
  - Scenario Ref：archive-auto-commit / 单变更归档自动提交 / 无路径可提交
  - Scenario Ref：archive-auto-commit / 单变更归档自动提交 / 只暂存固定清单
  - Scenario Ref：archive-auto-commit / 单变更归档自动提交 / 提交失败不阻断归档
  - Scenario Ref：archive-auto-commit / 单变更归档自动提交 / 推送确认门拒绝
  - Scenario Ref：archive-auto-commit / 单变更归档自动提交 / 推送确认门不可跳过

- [x] 5.5 [测试][单元][P1] 批量归档单测：整批一次提交 / 部分失败只提交成功者 [N12]
  - 文件：`test/archive-auto-commit.test.ts`
  - 验证：两类断言通过
  - Spec Ref：archive-auto-commit / 批量归档自动提交
  - Scenario Ref：archive-auto-commit / 批量归档自动提交 / 整批一次提交
  - Scenario Ref：archive-auto-commit / 批量归档自动提交 / 部分归档失败

- [x] 5.6 [测试][单元][P0] commit.ts 约束收窄单测：交互式仍需确认 / 归档窄通道三项前提齐备 [N12]
  - 文件：`test/commit-skill-templates.test.ts`
  - 验证：两类断言通过
  - Spec Ref：commit-push-skill / 提交范围确定（四场景）
  - Scenario Ref：commit-push-skill / 提交范围确定（四场景） / 指定的变更列表不存在
  - Scenario Ref：commit-push-skill / 提交范围确定（四场景） / 场景 4 提案点名
  - Scenario Ref：commit-push-skill / 提交范围确定（四场景） / 未指定时自动检测到归档提案
  - Scenario Ref：commit-push-skill / 提交范围确定（四场景） / 交互式提交仍需确认
  - Scenario Ref：commit-push-skill / 提交范围确定（四场景） / 归档收尾自动提交不受交互约束

## 6. 文档同步与全量回归

- [x] 6.1 [代码] 更新 `openspec/CONTEXT.md`：新增「Git 能力层 / 安装确认门 / 归档自动提交 / 推送确认门」四条术语（写前先读，同名冲突显式裁决）
  - 文件：`openspec/CONTEXT.md`
  - 验证：四条术语存在且与探索术语表一致
  - Spec Ref：git-capability / Git 能力检测（只读）

- [x] 6.2 [使用说明] 更新 `AGENTS.md`：仓库地图新增 `git-capability.ts` / `commands/git.ts`；单一源清单新增 `GIT_CLI`；守则补「归档自动提交窄通道」
  - 产出：`AGENTS.md`
  - 验证：含新模块、常量与守则条目
  - Spec Ref：git-capability / Git 能力检测（只读）

- [x] 6.3 [测试][单元][P0] 快照与尺寸回归：`pnpm build && pnpm generate:skills` 后跑 parity / size-budget / template-consistency
  - 文件：`test/skills-parity.test.ts` / `test/skill-size-budget.test.ts` / `test/template-consistency.test.ts`
  - 验证：三个测试文件全绿
  - Spec Ref：archive-auto-commit / 单变更归档自动提交
  - Scenario Ref：archive-auto-commit / 单变更归档自动提交 / 提交成功

### Caller Updates

| 影响模块 | 承接任务 |
| :--- | :--- |
| `src/core/child-process.ts`（复用，零改动） | 1.2 |
| `src/core/dependencies.ts`（范式参照，零改动） | 1.1 |
| `src/commands/init.ts`（零改动） | 4.1 |
| `src/core/host-orchestration/protocol.ts`（零改动） | 5.1 / 5.2 |
| `src/commands/completion.ts` | 2.2 / 2.4 |
| `src/cli/index.ts` | 2.2 |
| `src/core/templates/tool-whitelist.ts` | 3.1 |
| `src/core/templates/workflows/project-init.ts` | 3.2 / 4.1 |
| `src/core/templates/workflows/spec-archive.ts` | 3.2 / 5.1 |
| `src/core/templates/workflows/spec-bulk-archive.ts` | 3.2 / 5.2 |
| `src/core/templates/workflows/commit.ts` | 5.3 |
| `openspec/CONTEXT.md` / `AGENTS.md` | 6.1 / 6.2 |
