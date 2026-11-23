# Tasks: git-branch-isolation

> 流程基准：`exploration.md` §功能流程图 N1-N25（已确认，2026-11-23）。

## 1. Git 分支能力内核与 CLI

- [x] 1.1 [代码] `src/core/git-capability.ts` 新增 `isWorkingTreeClean(dir, runner?)`：经 `git status --porcelain` 判定，返回 `{ clean, dirty[], reason? }`；命令失败不抛错 [N4]
  - 文件：`src/core/git-capability.ts`
  - 验证：无写副作用；注入 mock runner 可断言调用参数
  - Spec Ref：git-branch-capability / 工作区状态检测（只读）

- [x] 1.2 [代码] 新增 `createWorkBranch(options)`：幂等（已在分支→skipped / 已存在→reused / 否则 checkout -b），记录 `baseBranch`，分支名校验拒绝 `..` / 前导 `/` / 空白 / `~^:?*[\` [N6]
  - 文件：`src/core/git-capability.ts`
  - 验证：四类返回正确；非法名不执行 checkout
  - Spec Ref：git-branch-capability / 工作分支创建（幂等）

- [x] 1.3 [代码] 新增 `mergeWorkBranch(options)`：`git merge --no-ff`，冲突返回 `conflicts[]`（取 `git diff --name-only --diff-filter=U`），MUST NOT abort / reset --hard [N18][N19][N20]
  - 文件：`src/core/git-capability.ts`
  - 验证：成功/冲突/分支不存在三类返回正确
  - Spec Ref：git-branch-capability / 工作分支合并

- [x] 1.4 [代码] 新增 `deleteMergedBranch(options)`：`git branch -d`（非 `-D`），未合并返回 skipped + 原因 [N22]
  - 文件：`src/core/git-capability.ts`
  - 验证：已合并删除成功；未合并 skipped
  - Spec Ref：git-branch-capability / 已合并分支删除

- [x] 1.5 [代码] `src/commands/git.ts` 新增 `branch`（`--create` / `--delete` / `--base` / `--json`）与 `merge <branch>`（`--into` / `--json`）子命令；`src/commands/completion.ts` 的 `git` 条目同步子命令与参数 [N2][N6][N18][N22]
  - 文件：`src/commands/git.ts` / `src/commands/completion.ts`
  - 验证：`iagent git branch --help` / `iagent git merge --help` 正确；补全脚本含新子命令
  - Spec Ref：git-capability-cli / git branch 与 git merge 子命令
  - Spec Ref：git-capability-cli / 补全表同步（扩展）
  - Spec Ref：git-capability / Git 分支执行（幂等与冲突不抛错）

- [x] 1.6 [代码] 四个分支函数与既有检测函数同上表；`GIT_CLI` 复用（不新增常量），需要分支调用的技能引用 `${GIT_CLI}` [N1][N2]
  - 文件：`src/core/templates/tool-whitelist.ts`（零改动，仅确认）/ `src/core/templates/workflows/*.ts`
  - 验证：`tool-whitelist-constants.test.ts` 全绿；无手写 `Bash(git:*)`
  - Spec Ref：git-branch-capability / 分支操作的工具白名单

- [x] 1.7 [测试][单元][P0] 内核单测：`isWorkingTreeClean` 干净/脏/失败；`createWorkBranch` 创建/幂等/复用/非法名；`mergeWorkBranch` 成功/冲突/分支不存在；`deleteMergedBranch` 删除/未合并；既有检测函数签名不变；全部经注入 runner [N4][N6][N18][N19][N20][N22]
  - 文件：`test/git-branch-capability.test.ts`
  - 验证：`pnpm test test/git-branch-capability.test.ts` 全绿；无真实进程
  - Spec Ref：git-branch-capability / 工作区状态检测（只读）
  - Spec Ref：git-branch-capability / 工作分支创建（幂等）
  - Spec Ref：git-branch-capability / 工作分支合并
  - Spec Ref：git-branch-capability / 已合并分支删除
  - Spec Ref：git-capability / Git 分支执行（幂等与冲突不抛错）
  - Scenario Ref：git-branch-capability / 工作区状态检测（只读） / 干净工作区
  - Scenario Ref：git-branch-capability / 工作区状态检测（只读） / 脏工作区返回清单
  - Scenario Ref：git-branch-capability / 工作区状态检测（只读） / 命令失败不抛错
  - Scenario Ref：git-branch-capability / 工作分支创建（幂等） / 首次创建并记录基分支
  - Scenario Ref：git-branch-capability / 工作分支创建（幂等） / 幂等跳过
  - Scenario Ref：git-branch-capability / 工作分支创建（幂等） / 分支已存在则复用不覆盖
  - Scenario Ref：git-branch-capability / 工作分支创建（幂等） / 非法分支名拒绝
  - Scenario Ref：git-branch-capability / 工作分支合并 / 无冲突合并成功
  - Scenario Ref：git-branch-capability / 工作分支合并 / 冲突返回清单且不 abort
  - Scenario Ref：git-branch-capability / 工作分支合并 / 分支不存在
  - Scenario Ref：git-branch-capability / 已合并分支删除 / 已合并分支删除成功
  - Scenario Ref：git-branch-capability / 已合并分支删除 / 未合并分支不强制删除
  - Scenario Ref：git-capability / Git 分支执行（幂等与冲突不抛错） / 既有检测函数签名不变
  - Scenario Ref：git-capability / Git 分支执行（幂等与冲突不抛错） / 分支函数经注入 runner 执行

- [x] 1.8 [测试][单元][P0] CLI 与补全单测：`branch --create --json` / `merge --json` 输出契约与退出码；补全表覆盖 `branch` / `merge` 与四个参数 [N2][N6]
  - 文件：`test/git-command.test.ts` / `test/completion-config.test.ts`
  - 验证：输出字段与契约一致；补全脚本含新子命令
  - Spec Ref：git-capability-cli / git branch 与 git merge 子命令
  - Spec Ref：git-capability-cli / 补全表同步（扩展）
  - Scenario Ref：git-capability-cli / git branch 与 git merge 子命令 / branch --create 输出契约
  - Scenario Ref：git-capability-cli / git branch 与 git merge 子命令 / merge 冲突输出契约
  - Scenario Ref：git-capability-cli / 补全表同步（扩展） / 补全覆盖分支子命令
  - Scenario Ref：git-branch-capability / 分支操作的工具白名单 / 白名单放行分支命令

## 2. 分支生命周期接入技能

> 流程节点覆盖说明：N8/N9（分支已存在复用 / 降级）由 1.2 与 2.1 承接；**N10（Step 6 批调度实现）/ N12（编译 / 测试 / 一致性门）/ N13（三证据汇总）/ N14（失败暂停不合并）为既有行为，本次零改动保留** —— 2.1 新增段 MUST 位于 N10 之前且不得改变 N12–N14 的判定口径，由 2.6 的跨模板断言守护。

- [x] 2.1 [代码] `spec-apply.ts` 新增「分支准入」段（Step 5.5 后、Step 6 前）：探测 git → 脏工作区三出口暂停 → 创建并切换 `iagent/<change-name>` → 写 `## 分支状态`；降级 `branchMode=none` [N2][N3][N4][N5][N6][N7][N10]
  - 文件：`src/core/templates/workflows/spec-apply.ts` / 新增 `references/branch-isolation.md`
  - 验证：正文含三出口与降级语义；主文件新增 ≤ 25 行
  - Spec Ref：branch-isolated-workflow / apply 分支准入（脏工作区不切换）
  - Spec Ref：branch-isolated-workflow / 分支状态载体

- [x] 2.2 [代码] `spec-apply.ts` Step 10.5 按 `branchMode` 分叉：`work-branch` → 固定清单精确提交（尾行 `提案:`，展示拟暂存清单）；`none` → 保持只暂存 [N11]
  - 文件：`src/core/templates/workflows/spec-apply.ts` / `references/branch-isolation.md`
  - 验证：两种模式语义清晰；MUST NOT `git add -A`
  - Spec Ref：branch-isolated-workflow / apply 分支模式下的实现期提交

- [x] 2.3 [代码] `spec-archive.ts` 新增「归档合并」段（Step 7.5 后、Step 8 前）：读 `## 分支状态` → ⛔ 合并门（`destructive-change`，与推送门同一步一次确认、不可 gate-skip）→ `--no-ff` 合并 → 冲突暂停不 abort → 成功删分支（失败 WARN）→ 拒绝保留工作 [N15][N16][N17][N18][N19][N20][N21][N22]
  - 文件：`src/core/templates/workflows/spec-archive.ts` / 新增 `references/branch-merge.md`
  - 验证：正文含门归属、不可跳过声明与「合并失败不回滚归档」；主文件新增 ≤ 25 行
  - Spec Ref：branch-isolated-workflow / 归档合并与合并门
  - Spec Ref：branch-isolated-workflow / 非目标声明
  - Spec Ref：archive-auto-commit / 归档收尾合并工作分支

- [x] 2.4 [代码] `debug.ts` Phase 7 验证 PASS 后自动合并 + `mergeAuthorized` / `mergeResult` 回执字段；2.2.3.5 分级新增「需求面扩展」信号 [N24][N25]
  - 文件：`src/core/templates/workflows/debug.ts` / `references/branch-isolation.md`（共享）
  - 验证：正文含自动合并、冲突不 abort、MUST NOT 写域外账本 id；分级信号可检索
  - Spec Ref：branch-isolated-workflow / debug 与 spec-update 的验证后自动合并
  - Spec Ref：workflow-suite-skills / debug 与 spec-update 的验证后自动合并
  - Spec Ref：divergence-analysis / 发散结论的消费承接

- [x] 2.5 [代码] `spec-update.ts` Step 8 一致性验证 PASS 后自动合并（语义同 debug） [N24]
  - 文件：`src/core/templates/workflows/spec-update.ts`
  - 验证：正文含自动合并与降级跳过
  - Spec Ref：branch-isolated-workflow / debug 与 spec-update 的验证后自动合并
  - Spec Ref：workflow-suite-skills / debug 与 spec-update 的验证后自动合并

- [x] 2.6 [测试][单元][P0] 跨模板一致性：四技能的 `## 分支状态` 读取与 `branchMode` 降级、合并不 abort、合并门归属 `destructive-change` 且不可 gate-skip、自动合并回执字段、非目标声明齐备 [N2][N16][N18][N24]
  - 文件：`test/branch-isolated-workflow.test.ts`
  - 验证：跨模板断言全绿；尺寸预算不超
  - Spec Ref：branch-isolated-workflow / 分支状态载体
  - Spec Ref：branch-isolated-workflow / apply 分支准入（脏工作区不切换）
  - Spec Ref：branch-isolated-workflow / apply 分支模式下的实现期提交
  - Spec Ref：branch-isolated-workflow / 归档合并与合并门
  - Spec Ref：branch-isolated-workflow / debug 与 spec-update 的验证后自动合并
  - Spec Ref：branch-isolated-workflow / 非目标声明
  - Spec Ref：workflow-suite-skills / debug 与 spec-update 的验证后自动合并
  - Scenario Ref：branch-isolated-workflow / 分支状态载体 / apply 创建分支后写入状态
  - Scenario Ref：branch-isolated-workflow / 分支状态载体 / 节缺失视为不分枝
  - Scenario Ref：branch-isolated-workflow / apply 分支准入（脏工作区不切换） / 干净工作区创建分支
  - Scenario Ref：branch-isolated-workflow / apply 分支准入（脏工作区不切换） / 脏工作区暂停
  - Scenario Ref：branch-isolated-workflow / apply 分支准入（脏工作区不切换） / 无 Git 降级
  - Scenario Ref：branch-isolated-workflow / apply 分支模式下的实现期提交 / 分支模式精确提交
  - Scenario Ref：branch-isolated-workflow / apply 分支模式下的实现期提交 / 非分支模式保持只暂存
  - Scenario Ref：branch-isolated-workflow / apply 分支模式下的实现期提交 / 提交失败不阻断
  - Scenario Ref：branch-isolated-workflow / 归档合并与合并门 / 合并成功并删除分支
  - Scenario Ref：branch-isolated-workflow / 归档合并与合并门 / 合并冲突暂停
  - Scenario Ref：branch-isolated-workflow / 归档合并与合并门 / 拒绝合并保留工作
  - Scenario Ref：branch-isolated-workflow / 归档合并与合并门 / 合并门不可跳过
  - Scenario Ref：branch-isolated-workflow / debug 与 spec-update 的验证后自动合并 / debug 验证通过后自动合并
  - Scenario Ref：branch-isolated-workflow / debug 与 spec-update 的验证后自动合并 / 自动合并冲突
  - Scenario Ref：branch-isolated-workflow / debug 与 spec-update 的验证后自动合并 / update 验证通过后自动合并
  - Scenario Ref：branch-isolated-workflow / 非目标声明 / 正文声明非目标
  - Scenario Ref：workflow-suite-skills / debug 与 spec-update 的验证后自动合并 / debug 自动合并后回执字段完整
  - Scenario Ref：workflow-suite-skills / debug 与 spec-update 的验证后自动合并 / 自动合并不新增用户停点

- [x] 2.7 [测试][单元][P1] 归档合并段单测：合并门不可被 gate-skip 跳过、非分支模式跳过合并、合并失败不回滚归档 [N16][N17]
  - 文件：`test/archive-auto-commit.test.ts`
  - 验证：三条断言通过
  - Spec Ref：archive-auto-commit / 归档收尾合并工作分支
  - Scenario Ref：archive-auto-commit / 归档收尾合并工作分支 / 合并门与推送门同一步呈现
  - Scenario Ref：archive-auto-commit / 归档收尾合并工作分支 / 合并失败不回滚归档
  - Scenario Ref：archive-auto-commit / 归档收尾合并工作分支 / 非分支模式跳过合并

## 3. 需求发散

- [x] 3.1 [代码] `spec-explore.ts` 新增 1.5.6 需求发散（与 1.5.5 流程门合并呈现，不新增停点）；细则下沉 `references/divergence-analysis.md` [N23]
  - 文件：`src/core/templates/workflows/spec-explore.ts` / 新增 `references/divergence-analysis.md`
  - 验证：主文件只留指针 + 五维名；协议正文在 references
  - Spec Ref：divergence-analysis / 需求发散五维
  - Spec Ref：divergence-analysis / 发散产出的时机与呈现

- [x] 3.2 [代码] `readiness.ts` 新增第 5 判定 `checkDivergence`（段 + 五维非空；新变更 error / 存量 WARN+skipped；skip_specs/legacyJson 不豁免） [N24]
  - 文件：`src/core/spec/validation/readiness.ts`
  - 验证：`ReadinessResult.checks` 5 项；D1-D10 编号与阈值公式不变；纯函数无 I/O
  - Spec Ref：divergence-analysis / 就绪门第 5 判定 divergence
  - Spec Ref：divergence-analysis / 发散段的验证维度边界
  - Spec Ref：spec-readiness-gate / 就绪门第五判定（需求发散）

- [x] 3.3 [代码] `spec/templates/index.ts` 的 `PROPOSAL_TEMPLATE` 新增 `### 需求发散承接` 小节；`spec-propose.ts` 生成该表 [N25]
  - 文件：`src/core/spec/templates/index.ts` / `src/core/templates/workflows/spec-propose.ts`
  - 验证：模板含小节；propose 正文含生成指令
  - Spec Ref：divergence-analysis / 发散结论的消费承接

- [x] 3.4 [代码] `workflow.ts` / `auto-workflow.ts` Phase 2.0 五维扩面（一次广查询 + 分维归集；busy 降级 WARN） [N25]
  - 文件：`src/core/templates/workflows/workflow.ts` / `auto-workflow.ts`
  - 验证：正文含五维与「一次广查询」约束；MUST NOT 逐维调用
  - Spec Ref：divergence-analysis / 发散结论的消费承接

- [x] 3.5 [代码] `verify-checklist.ts` 的 `PROPOSE_SELF_CHECK_ITEMS` 新增「需求发散承接表存在」一条；不改维度编号与阈值公式 [N25]
  - 文件：`src/core/templates/verify-checklist.ts`
  - 验证：自检项 +1；清单单一源测试全绿
  - Spec Ref：divergence-analysis / 就绪门第 5 判定 divergence

- [x] 3.6 [测试][单元][P0] 发散单测：五维解析（齐备 / 留空 / 全「无」）；就绪门新变更 fail、存量 skipped、齐备 pass、checks 五项、CLI --ready 输出；propose 承接表；Phase 2.0 一次广查询约束 [N23][N24][N25]
  - 文件：`test/divergence-analysis.test.ts` / `test/spec-readiness-gate.test.ts`
  - 验证：全绿
  - Spec Ref：divergence-analysis / 需求发散五维
  - Spec Ref：divergence-analysis / 发散产出的时机与呈现
  - Spec Ref：divergence-analysis / 就绪门第 5 判定 divergence
  - Spec Ref：divergence-analysis / 发散结论的消费承接
  - Spec Ref：divergence-analysis / 发散段的验证维度边界
  - Spec Ref：spec-readiness-gate / 就绪门第五判定（需求发散）
  - Scenario Ref：divergence-analysis / 需求发散五维 / 五维齐备
  - Scenario Ref：divergence-analysis / 需求发散五维 / 维度留空即视为缺失
  - Scenario Ref：divergence-analysis / 需求发散五维 / 无发散内容时显式声明
  - Scenario Ref：divergence-analysis / 发散产出的时机与呈现 / 合并呈现不新增停点
  - Scenario Ref：divergence-analysis / 发散产出的时机与呈现 / 修改流程图后重新评估
  - Scenario Ref：divergence-analysis / 就绪门第 5 判定 divergence / 新变更缺发散段判 fail
  - Scenario Ref：divergence-analysis / 就绪门第 5 判定 divergence / 存量变更缺发散段不阻断
  - Scenario Ref：divergence-analysis / 就绪门第 5 判定 divergence / 五维齐备判 pass
  - Scenario Ref：divergence-analysis / 发散结论的消费承接 / propose 产出承接表
  - Scenario Ref：divergence-analysis / 发散结论的消费承接 / Phase 2.0 一次广查询
  - Scenario Ref：divergence-analysis / 发散结论的消费承接 / debug 需求面扩展信号
  - Scenario Ref：divergence-analysis / 发散段的验证维度边界 / 就绪门不含语义判定
  - Scenario Ref：spec-readiness-gate / 就绪门第五判定（需求发散） / checks 数组含五项
  - Scenario Ref：spec-readiness-gate / 就绪门第五判定（需求发散） / CLI --ready 输出含新判定

## 4. 规格与文档同步

- [x] 4.1 [代码] `openspec/CONTEXT.md` 新增四条术语（工作分支 / 基分支 / 合并门 / 需求发散），写前先读并做同名冲突裁决 [N1]
  - 文件：`openspec/CONTEXT.md`
  - 验证：四条术语存在且与 exploration 术语表一致
  - Spec Ref：branch-isolated-workflow / 分支状态载体

- [x] 4.2 [使用说明] `AGENTS.md`：仓库地图补 `git-capability.ts` 分支函数与 `commands/git.ts` 子命令；守则补「分支隔离与合并门」条目；单一源清单补 `## 分支状态` [N1]
  - 产出：`AGENTS.md`
  - 验证：含新条目与守则
  - Spec Ref：branch-isolated-workflow / 分支状态载体

- [x] 4.3 [测试][单元][P0] 快照与尺寸回归：`pnpm build && pnpm generate:skills` 后跑 parity / size-budget / template-consistency / allowed-tools
  - 文件：`test/skills-parity.test.ts` / `test/skill-size-budget.test.ts` / `test/template-consistency.test.ts` / `test/allowed-tools.test.ts`
  - 验证：四个测试文件全绿
  - Spec Ref：git-branch-capability / 分支操作的工具白名单

- [x] 4.4 [代码] `commit.ts` 补充分支模式下实现期提交的定位说明（不改「MUST NOT 自动 commit」约束与归档窄通道三项前提）
  - 文件：`src/core/templates/workflows/commit.ts`
  - 验证：窄通道三项前提逐字保留；新增说明不与既有约束矛盾
  - Spec Ref：branch-isolated-workflow / apply 分支模式下的实现期提交

### Caller Updates

| 影响模块 | 承接任务 |
| :--- | :--- |
| `src/cli/index.ts`（已注册 `git` 命令组，零改动） | 1.5 |
| `src/commands/completion.ts` | 1.5 / 1.8 |
| `src/core/git-capability.ts` | 1.1 / 1.2 / 1.3 / 1.4 |
| `src/commands/git.ts` | 1.5 |
| `src/core/templates/tool-whitelist.ts`（复用 `GIT_CLI`，零改动） | 1.6 |
| `src/core/templates/workflows/spec-apply.ts` | 2.1 / 2.2 |
| `src/core/templates/workflows/spec-archive.ts` | 2.3 |
| `src/core/templates/workflows/debug.ts` | 2.4 |
| `src/core/templates/workflows/spec-update.ts` | 2.5 |
| `src/core/templates/workflows/spec-explore.ts` | 3.1 |
| `src/core/templates/workflows/spec-propose.ts` | 3.3 |
| `src/core/templates/workflows/workflow.ts` | 3.4 |
| `src/core/templates/workflows/auto-workflow.ts` | 3.4 |
| `src/core/spec/validation/readiness.ts` | 3.2 |
| `src/core/spec/templates/index.ts` | 3.3 |
| `src/core/templates/verify-checklist.ts` | 3.5 |
| `src/core/templates/workflows/commit.ts` | 4.4 |
| `openspec/CONTEXT.md` / `AGENTS.md` | 4.1 / 4.2 |
