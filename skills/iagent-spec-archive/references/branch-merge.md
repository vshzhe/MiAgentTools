## 归档合并协议

**## 分支状态（handoff 包并列节，与六节并列、不计入六节）**：由 `iagent-spec-apply` 在创建分支后立即写入，字段为 `branch` / `baseBranch` / `branchMode` / `createdAt`；`branchMode` 取值域为 `work-branch` / `none`。读取方（archive / debug / update）**只读复用**，段缺失时按 `branchMode=none` 继续并记 WARN，MUST NOT 猜测分支名。

### 归档合并步骤

读 `## 分支状态`；缺失或 `branchMode≠work-branch` → 跳过记日志。否则 **⛔ 合并门**（归 `destructive-change`，**不可豁免、不可被 `gate-skip` 跳过**，与推送一次确认）→ `iagent git merge <branch> --into <baseBranch> --json` → 成功删分支（失败仅 WARN）并推送；用户拒绝合并 → 保留分支与提交。**冲突暂停列清单，MUST NOT abort / reset --hard / 丢弃产出**。**合并失败 MUST NOT 回滚归档**。

### 非目标

**分支隔离的非目标（四技能一致）**：① **不覆盖 SVN 项目** —— 由 `iagent-svn-commit` 承担，分支语义不适用；② **不实现自动冲突解决** —— 冲突一律暂停由用户处置；③ **`spec-bulk-archive` 不纳入** —— 沿用整批一次提交，不做分支合并。
