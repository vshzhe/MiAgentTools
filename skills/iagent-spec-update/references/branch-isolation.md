## 分支隔离实现协议

**## 分支状态（handoff 包并列节，与六节并列、不计入六节）**：由 `iagent-spec-apply` 在创建分支后立即写入，字段为 `branch` / `baseBranch` / `branchMode` / `createdAt`；`branchMode` 取值域为 `work-branch` / `none`。读取方（archive / debug / update）**只读复用**，段缺失时按 `branchMode=none` 继续并记 WARN，MUST NOT 猜测分支名。

### 分支准入（apply）

**分支准入（Step 5.5 设计确认门之后、Step 6 批调度之前，强制）**

1. 运行 `iagent git status --json` 探测：`installed=false` / `isRepo=false` / detached HEAD → 置 `branchMode=none` 并记 WARN，直接进入 Step 6（行为与无分支能力时一致）
2. 运行 `git status --porcelain` 检查工作区：
   - **有未提交改动** → **⛔ 暂停**（动作级 `destructive-change`），呈现三出口：①提交已有改动（走 `iagent-commit`）②stash 暂存后继续 ③取消实现；用户处置后回到本步复查。**MUST NOT 自动 `git stash`**、**MUST NOT 带脏工作区切换分支**
   - **干净** → 运行 `iagent git branch --create iagent/<change-name> --json`（幂等：`created` / `reused` 均视为就绪；`failed` → 降级 `branchMode=none` + WARN 并继续）
3. 把分支写入 handoff 包 `## 分支状态`（`branch` / `baseBranch` / `branchMode=work-branch` / `createdAt`）

**分支名规则**：变更 `iagent/<change-name>`；无变更目录（独立调用）用 `iagent/apply-<timestamp>`。分支名 MUST NOT 含 `..`、前导 `/`、空白或 `~^:?*[\` 任一字符（CLI 会拒绝）。

**Step 10.5 分叉**：`branchMode=work-branch` 时，Step 10.5 的「只暂存不提交」升级为**精确提交到工作分支**（固定清单 + 本次代码改动，逐条 `git add -- <具体路径>` 后 `git commit`，尾行 `提案: <change-name>`；提交前展示拟暂存清单，失败记 WARN 不阻断；**MUST NOT `git add -A`**）。该提交是合并的前提，属**实现期隔离动作**，MUST NOT 表述为归档自动提交；`branchMode=none` 时保持原语义。

### 实现期提交（apply）

**分支模式下的实现期提交**：`branchMode=work-branch` 时，Step 10.5 的「只暂存不提交」升级为**精确提交到工作分支** —— 固定清单（`proposal.md` / `design.md` / `tasks.md` / `exploration.md` / `.openspec.yaml` / `specs/**/*.md`）+ 本次变更相关代码改动，逐条 `git add -- <具体路径>` 后 `git commit`（提交信息沿用 `iagent-commit` 规范，尾行 `提案: <change-name>`）；提交前展示拟暂存清单，失败记 WARN 不阻断。**MUST NOT 使用 `git add -A` / `git add .` / 目录通配**。该提交属**实现期隔离动作**（合并的前提），MUST NOT 表述为归档自动提交；`branchMode=none` 时保持原「只暂存不提交」。

### 验证后自动合并（debug / spec-update）

读 `## 分支状态`，`branchMode=work-branch` 才执行。授权 = debug Phase 7 / spec-update Step 8 **验证 PASS**；回执带 `mergeAuthorized` / `mergeResult`，**MUST NOT 写 `## 已确认门`**（域外 id 触发 `invalid-receipt`）。`iagent git merge <branch> --into <baseBranch> --json` → 成功删分支（失败仅 WARN）；**冲突暂停列清单，MUST NOT abort**，冲突不构成验证失败；非冲突失败 WARN。不新增停点。全文见 `references/branch-isolation.md`。

### 非目标

**分支隔离的非目标（四技能一致）**：① **不覆盖 SVN 项目** —— 由 `iagent-svn-commit` 承担，分支语义不适用；② **不实现自动冲突解决** —— 冲突一律暂停由用户处置；③ **`spec-bulk-archive` 不纳入** —— 沿用整批一次提交，不做分支合并。
