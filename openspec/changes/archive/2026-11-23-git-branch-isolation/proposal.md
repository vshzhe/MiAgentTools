## Why

当前 8 个技能（spec-explore / spec-propose / spec-apply / spec-archive / workflow / auto-workflow / debug / spec-update）全部在**当前分支**直接改写工作区：`spec-apply` 从 Step 6 起就地写文件、`debug` Phase 4 就地修复、`spec-update` Step 6 就地再实现。用户报告的直接风险是：**实现与验证尚未完成的改动与既有代码修改混在同一分支上，一旦实现失败或半途中断，回滚困难且容易污染主分支**。

同时，探索与提案阶段的影响面推理只有一条通路 —— 父编排 Phase 2.0 的 `codegraph_impact` 上游查询（`workflow.ts:250` / `auto-workflow.ts:68`），`spec-explore` 自身只有「新增 vs 修改」二选一判定（`spec-explore.ts` 1.2.2）。结果是：**需求实现范围容易只覆盖「被点名的那一块」**，共享工具、契约、同类调用点、非功能影响靠临场记性，漏项在验证阶段才暴露，甚至到归档后才发现。

本次变更同时收敛这两处：

1. **分支隔离实现**：实现期落在工作分支 `iagent/<change-name>`，验证通过后在归档点合并回基分支；`debug` / `spec-update` 在验证 PASS 后自动合并。
2. **需求发散**：探索阶段强制产出 `## 需求发散` 五维段，提案阶段映射进 `## Impact`，并由就绪门新增第 5 判定做确定性校验，避免重蹈「生成侧不产出、验证侧却要求」的结构错配。

## What Changes

### 一、Git 分支能力（内核 + CLI）

- `src/core/git-capability.ts` 新增分支执行函数（沿用注入 runner 范式，可单测、无真实进程）：
  - `isWorkingTreeClean(dir, runner)` —— 只读，返回脏文件清单
  - `createWorkBranch(name, baseBranch, options)` —— 幂等：已在该分支 → `skipped`；已存在 → `reused` + 原因；否则 `created`
  - `mergeWorkBranch(name, options)` —— `git merge --no-ff`，冲突返回冲突清单且**不 abort**
  - `deleteMergedBranch(name, options)` —— 仅已合并时成功，失败返回状态不抛错
- `src/commands/git.ts` 新增子命令：`branch`（`--create` / `--delete` / `--base`）、`merge <branch>`（`--into`），均支持 `--json`。
- `src/cli/index.ts` 无需改动（`git` 命令组已注册）；`src/commands/completion.ts` 的 `IAGENT_COMMANDS` 表的 `git` 条目同步新子命令与参数。

### 二、分支隔离实现生命周期

- `iagent_spec_apply`：**Step 5.5 设计确认门之后、Step 6 批调度之前**新增「分支准入」——探测 git → 检查 `status --porcelain` → 脏则三出口暂停（提交 / stash / 取消）→ 干净则创建并切换 `iagent/<change-name>` → 写 handoff 包 `## 分支状态`。Step 10.5 在分支模式下改为**精确提交到工作分支**（`branchMode=none` 保持原「只暂存不提交」）。
- `iagent_spec_archive`：Step 7.5 归档提交之后、Step 8 摘要之前新增 **⛔ 合并门**（归 `destructive-change`，不可豁免、不可被 `gate-skip` 跳过）→ `git merge --no-ff` 回 `baseBranch` → 冲突暂停不 abort → 成功则删除工作分支（失败仅 WARN）→ 推送仍走既有推送确认门。
- `iagent_debug`：Phase 7 验证 PASS 后自动合并（授权来自验证回执，写入 `## 已确认门` 账本），合并成功后删除分支。
- `iagent_spec_update`：Step 8 一致性验证 PASS 后自动合并，语义同 debug。
- **降级**：无 Git / 非仓库 / detached HEAD → `branchMode=none` + WARN，实现与归档照常。

### 三、需求发散（五维）

- `iagent_spec_explore`：新增 **1.5.6 需求发散**（与 1.5.5 流程最终确认门**合并呈现**，不新增用户停点），落盘探索产物 `## 需求发散` 段，五维：直接影响 / 间接影响 / 契约影响 / 同类场景 / 非功能影响；每条带 `文件:行` 或 `[推断]` / `[新建]`。
- `iagent_spec_propose`：把发散结论映射为 proposal `## Impact` 下的 `### 需求发散承接` 扩展表（能力 → 影响类别 → 承接需求 / 任务）。
- `iagent_workflow` / `iagent_auto_workflow`：Phase 2.0 影响分析由「符号级上游查询」扩为**五维扩面**，采用**一次广查询 + 分维归集**（不逐维调 CodeGraph，避免 busy）。
- `iagent_debug`：2.2.3.5 排查深度分级信号新增「需求面扩展」一项（受影响模块是否超出原需求声明面）。
- `src/core/spec/validation/readiness.ts`：新增第 5 判定 `divergence`（段存在 + 五维非空或显式「无」）；**D1-D10 维度编号与 90% 阈值公式不变**。

### 四、规格与文档

- 新增能力规格 `openspec/specs/git-branch-capability/spec.md`、`branch-isolated-workflow/spec.md`、`divergence-analysis/spec.md`。
- 修改既有能力：`git-capability-cli`（子命令 + 补全表）、`git-capability`（分支执行函数）、`spec-readiness-gate`（第 5 判定）、`archive-auto-commit`（合并步骤与合并门）、`workflow-suite-skills`（debug / update 自动合并）。
- `openspec/CONTEXT.md` 新增四条术语；`AGENTS.md` 仓库地图与守则同步。

## Capabilities

### New Capabilities

- `git-branch-capability`: 分支创建 / 合并 / 删除的内核函数与幂等语义（注入 runner、冲突不抛错、脏工作区只读检测）
- `branch-isolated-workflow`: apply / archive / debug / update 四类技能的分支生命周期、`## 分支状态` 载体、合并门归属与降级语义
- `divergence-analysis`: 需求发散五维的落盘形态、就绪门第 5 判定、四类消费方的承接契约

### Modified Capabilities

- `git-capability-cli`: 新增 `branch` / `merge` 子命令并同步补全表
- `git-capability`: 新增分支执行函数（检测仍纯只读）
- `spec-readiness-gate`: 新增第 5 判定 `divergence`，四判定扩为五判定
- `archive-auto-commit`: 归档收尾新增合并步骤与合并门（与推送门同一步内呈现）
- `workflow-suite-skills`: debug Phase 7 与 spec-update Step 8 的验证后自动合并

## Impact

### Impact Analysis

| 符号 | 位置 | 直接上游影响 | 波及的测试面 | 改动要求 |
| :--- | :--- | :--- | :--- | :--- |
| `git-capability.ts`（新增 4 个分支函数） | `src/core/git-capability.ts:1` | `commands/git.ts`、8 个技能正文（经 CLI 调用） | `test/git-capability.test.ts`、新增 `test/git-branch-capability.test.ts` | 沿用 `GitCommandRunner` 注入；冲突/失败返回状态不抛错；分支名校验拒绝 `..` / 前导 `/` / 空白 |
| `buildGitCommand` | `src/commands/git.ts:80` | `src/cli/index.ts:448`（已注册，零改动）、`IAGENT_COMMANDS` 补全表 | `test/git-command.test.ts`、`test/completion-config.test.ts` | 新增 `branch` / `merge` 子命令与 `--json`；输出契约 `{ action, branch, baseBranch, reason? }` / `{ ok, merged, conflicts[], detail? }` |
| `getSpecApplyChangeSkillTemplate` | `src/core/templates/workflows/spec-apply.ts:270` | workflow / auto-workflow / spec-update / debug 的委派链 | `test/branch-isolated-workflow.test.ts`、`test/skill-size-budget.test.ts` | Step 5.5 后插入分支准入；Step 10.5 分支模式改精确提交；分支细则下沉 `references/branch-isolation.md` |
| `getSpecArchiveChangeSkillTemplate` | `src/core/templates/workflows/spec-archive.ts:17` | 三个父编排的归档阶段、`archive-auto-commit` 规格 | `test/branch-isolated-workflow.test.ts`、`test/archive-auto-commit.test.ts` | Step 7.5 后插入合并门 + merge + 删分支；失败不阻断归档 |
| `getDebugSkillTemplate` | `src/core/templates/workflows/debug.ts:226` | 独立调用、无父编排 | `test/branch-isolated-workflow.test.ts` | Phase 7 验证 PASS 后自动合并并写门账本；2.2.3.5 加分信号 |
| `getSpecUpdateSkillTemplate` | `src/core/templates/workflows/spec-update.ts:68` | 独立调用 | `test/branch-isolated-workflow.test.ts`、`test/spec-update-skill.test.ts` | Step 8 PASS 后自动合并 |
| `getSpecExploreSkillTemplate` | `src/core/templates/workflows/spec-explore.ts:1` | workflow / auto-workflow 的 Phase 1 | `test/divergence-analysis.test.ts`、`test/skill-size-budget.test.ts` | 新增 1.5.6 段，与 1.5.5 流程门合并呈现；细则下沉 `references/divergence-analysis.md` |
| `getSpecProposeSkillTemplate` | `src/core/templates/workflows/spec-propose.ts:1` | workflow / auto-workflow 的 Phase 2 | `test/divergence-analysis.test.ts` | 映射发散结论到 `### 需求发散承接` |
| `getWorkflowSkillTemplate` / `getAutoWorkflowSkillTemplate` | `src/core/templates/workflows/workflow.ts:144` / `auto-workflow.ts:17` | 使用者 | `test/divergence-analysis.test.ts` | Phase 2.0 五维扩面（一次广查询 + 分维归集） |
| `buildReadiness` | `src/core/spec/validation/readiness.ts:79` | `iagent spec validate --ready`、propose 终检、debug Phase 6.4 | `test/spec-readiness-gate.test.ts`、`test/proposal-readiness-chain.test.ts` | 新增 `divergence` 判定；`ReadinessResult.checks` 四→五；存量变更记 WARN 不阻断 |
| `PROPOSAL_TEMPLATE` | `src/core/spec/templates/index.ts:18` | `iagent spec instructions proposal`、propose 技能 | `test/spec-commands.test.ts` | `## Impact` 下新增 `### 需求发散承接` 小节模板 |
| `renderVerifyChecklist` | `src/core/templates/verify-checklist.ts:70` | 五个验证技能 | `test/verify-checklist-single-source.test.ts` | **不改维度编号**；仅在 propose 自检清单加一条「需求发散承接表存在」 |
| `tool-whitelist.ts` | `src/core/templates/tool-whitelist.ts:55` | 8 个模板的 `allowedTools` | `test/tool-whitelist-constants.test.ts`、`test/allowed-tools.test.ts` | 复用既有 `GIT_CLI`，**不新增常量**；仅确保 spec-explore / spec-propose 在有 git 调用时引用它 |

### 直接影响的文件

- `src/core/git-capability.ts`: 新增 4 个分支函数（约 +120 行）
- `src/commands/git.ts`: 新增 `branch` / `merge` 子命令（约 +70 行）
- `src/commands/completion.ts`: `git` 条目补 `branch` / `merge` 与参数
- `src/core/templates/workflows/spec-apply.ts`: 分支准入 + Step 10.5 语义分叉
- `src/core/templates/workflows/spec-archive.ts`: Step 7.5 后合并段
- `src/core/templates/workflows/debug.ts`: Phase 7 自动合并 + 2.2.3.5 信号
- `src/core/templates/workflows/spec-update.ts`: Step 8 自动合并
- `src/core/templates/workflows/spec-explore.ts`: 1.5.6 需求发散
- `src/core/templates/workflows/spec-propose.ts`: 承接表生成
- `src/core/templates/workflows/workflow.ts` / `auto-workflow.ts`: Phase 2.0 五维扩面
- `src/core/spec/validation/readiness.ts`: 第 5 判定 `divergence`
- `src/core/spec/templates/index.ts`: `### 需求发散承接` 模板小节
- `src/core/templates/verify-checklist.ts`: propose 自检清单 +1 条
- `src/core/templates/workflows/commit.ts`: 说明分支模式下的提交语义（不改约束）
- `openspec/CONTEXT.md` / `AGENTS.md`: 术语与仓库地图

### 需求发散承接（本变更自身适用）

| 能力 / 影响类别 | 承接需求 / 任务 |
| :--- | :--- |
| 直接影响：分支能力与四类技能生命周期 | `branch-isolated-workflow` 全部需求；任务 1.x / 2.x |
| 间接影响：`commit.ts` 的「MUST NOT 自动 commit」约束 | 任务 3.4（仅补分支模式说明，不扩张窄通道） |
| 契约影响：`iagent git` CLI 面扩展 | `git-capability-cli` 需求；任务 1.5 / 1.6 |
| 同类场景：`spec-bulk-archive` 的归档提交 | 任务 3.5（声明批量归档**不纳入**本次分支能力，记 WARN） |
| 非功能影响：模板尺寸 / 无 Git 场景 / CodeGraph busy | 任务 4.3（尺寸回归）、`branch-isolated-workflow` 降级需求、`divergence-analysis` 广查询需求 |

### 向后兼容

**BREAKING（行为面，非接口面）**：分支隔离在**有 Git 的项目**中改变实现期的分支落点（从「当前分支」变为「工作分支」）。

- `branchMode=none`（无 Git / 非仓库 / detached HEAD）保持旧行为，零变化。
- 不新增 CLI 命令组，仅新增 `git` 的子命令；`iagent git status|init` 契约不变。
- `spec-readiness-gate` 新增判定对**存量变更记 WARN 不阻断**（沿用既有 `isNewChange` 严格度分界）。
- 不扩张门白名单 5 类，不扩张 `GATE_SKIP_IDS`。
