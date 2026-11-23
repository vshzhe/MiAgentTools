/**
 * 分支隔离协议的单一源（变更 `git-branch-isolation`）。
 *
 * 四类技能（spec-apply / spec-archive / debug / spec-update）共享同一份正文，
 * MUST NOT 在各模板内各写一份副本（否则会产生第二份真源与漂移）。
 *
 * 契约见：
 *   - `openspec/specs/git-branch-capability/spec.md`
 *   - `openspec/specs/branch-isolated-workflow/spec.md`
 */

/** `## 分支状态` 段落名（handoff 包并列节，与六节并列、不计入六节） */
export const BRANCH_STATE_SECTION = '## 分支状态';

/** `branchMode` 取值域 */
export const BRANCH_MODES = ['work-branch', 'none'] as const;

/** `branchMode` 类型 */
export type BranchMode = (typeof BRANCH_MODES)[number];

/** 分支名前缀（工作分支 = `iagent/<change-name>`） */
export const WORK_BRANCH_PREFIX = 'iagent/';

/**
 * 渲染「分支状态载体」段（四技能共享）。
 *
 * 说明写入位置、字段、读取方与缺失处置。
 */
export function renderBranchStateSection(): string {
    return `**${BRANCH_STATE_SECTION}（handoff 包并列节，与六节并列、不计入六节）**：由 \`iagent_spec_apply\` 在创建分支后立即写入，字段为 \`branch\` / \`baseBranch\` / \`branchMode\` / \`createdAt\`；\`branchMode\` 取值域为 \`work-branch\` / \`none\`。读取方（archive / debug / update）**只读复用**，段缺失时按 \`branchMode=none\` 继续并记 WARN，MUST NOT 猜测分支名。`;
}

/**
 * 渲染 apply 侧的分支准入段（Step 5.5 之后、Step 6 之前）。
 *
 * 硬约束：MUST NOT 自动 stash、MUST NOT 带脏工作区切换、MUST NOT 覆盖同名分支。
 * 含 Step 10.5 的分支模式分叉（提交是合并的前提）。
 */
export function renderApplyBranchAdmission(): string {
    return `**分支准入（Step 5.5 设计确认门之后、Step 6 批调度之前，强制）**

1. 运行 \`iagent git status --json\` 探测：\`installed=false\` / \`isRepo=false\` / detached HEAD → 置 \`branchMode=none\` 并记 WARN，直接进入 Step 6（行为与无分支能力时一致）
2. 运行 \`git status --porcelain\` 检查工作区：
   - **有未提交改动** → **⛔ 暂停**（动作级 \`destructive-change\`），呈现三出口：①提交已有改动（走 \`iagent_commit\`）②stash 暂存后继续 ③取消实现；用户处置后回到本步复查。**MUST NOT 自动 \`git stash\`**、**MUST NOT 带脏工作区切换分支**
   - **干净** → 运行 \`iagent git branch --create ${WORK_BRANCH_PREFIX}<change-name> --json\`（幂等：\`created\` / \`reused\` 均视为就绪；\`failed\` → 降级 \`branchMode=none\` + WARN 并继续）
3. 把分支写入 handoff 包 \`${BRANCH_STATE_SECTION}\`（\`branch\` / \`baseBranch\` / \`branchMode=work-branch\` / \`createdAt\`）

**分支名规则**：变更 \`${WORK_BRANCH_PREFIX}<change-name>\`；无变更目录（独立调用）用 \`${WORK_BRANCH_PREFIX}apply-<timestamp>\`。分支名 MUST NOT 含 \`..\`、前导 \`/\`、空白或 \`~^:?*[\\\` 任一字符（CLI 会拒绝）。

**Step 10.5 分叉**：\`branchMode=work-branch\` 时，Step 10.5 的「只暂存不提交」升级为**精确提交到工作分支**（固定清单 + 本次代码改动，逐条 \`git add -- <具体路径>\` 后 \`git commit\`，尾行 \`提案: <change-name>\`；提交前展示拟暂存清单，失败记 WARN 不阻断；**MUST NOT \`git add -A\`**）。该提交是合并的前提，属**实现期隔离动作**，MUST NOT 表述为归档自动提交；\`branchMode=none\` 时保持原语义。`;
}

/**
 * 渲染 apply 侧的实现期提交段（Step 10.5 语义分叉）。
 */
export function renderApplyBranchCommit(): string {
    return `**分支模式下的实现期提交**：\`branchMode=work-branch\` 时，Step 10.5 的「只暂存不提交」升级为**精确提交到工作分支** —— 固定清单（\`proposal.md\` / \`design.md\` / \`tasks.md\` / \`exploration.md\` / \`.openspec.yaml\` / \`specs/**/*.md\`）+ 本次变更相关代码改动，逐条 \`git add -- <具体路径>\` 后 \`git commit\`（提交信息沿用 \`iagent_commit\` 规范，尾行 \`提案: <change-name>\`）；提交前展示拟暂存清单，失败记 WARN 不阻断。**MUST NOT 使用 \`git add -A\` / \`git add .\` / 目录通配**。该提交属**实现期隔离动作**（合并的前提），MUST NOT 表述为归档自动提交；\`branchMode=none\` 时保持原「只暂存不提交」。`;
}

/**
 * 渲染 archive 侧的归档合并段（主文件精简版；全文在 `BRANCH_MERGE_FULL`）。
 */
export function renderArchiveMergeSection(): string {
    return `读 \`${BRANCH_STATE_SECTION}\`；缺失或 \`branchMode≠work-branch\` → 跳过记日志。否则 **⛔ 合并门**（归 \`destructive-change\`，**不可豁免、不可被 \`gate-skip\` 跳过**，与推送一次确认）→ \`iagent git merge <branch> --into <baseBranch> --json\` → 成功删分支（失败仅 WARN）并推送；用户拒绝合并 → 保留分支与提交。**冲突暂停列清单，MUST NOT abort / reset --hard / 丢弃产出**。**合并失败 MUST NOT 回滚归档**。`;
}

/**
 * 渲染 debug / update 侧的「验证后自动合并」段（主文件精简版；全文在 `BRANCH_ISOLATION_FULL`）。
 */
export function renderAutoMergeSection(phaseLabel: string): string {
    return `读 \`${BRANCH_STATE_SECTION}\`，\`branchMode=work-branch\` 才执行。授权 = ${phaseLabel} **验证 PASS**；回执带 \`mergeAuthorized\` / \`mergeResult\`，**MUST NOT 写 \`## 已确认门\`**（域外 id 触发 \`invalid-receipt\`）。\`iagent git merge <branch> --into <baseBranch> --json\` → 成功删分支（失败仅 WARN）；**冲突暂停列清单，MUST NOT abort**，冲突不构成验证失败；非冲突失败 WARN。不新增停点。全文见 \`references/branch-isolation.md\`。`;
}

/**
 * 渲染非目标声明（四技能共享）。
 */
export function renderBranchNonGoals(): string {
    return `**分支隔离的非目标（四技能一致）**：① **不覆盖 SVN 项目** —— 由 \`iagent_svn_commit\` 承担，分支语义不适用；② **不实现自动冲突解决** —— 冲突一律暂停由用户处置；③ **\`spec-bulk-archive\` 不纳入** —— 沿用整批一次提交，不做分支合并。`;
}

/** 分支隔离协议全文（写入 `references/branch-isolation.md`，apply / debug / update 共用） */
export const BRANCH_ISOLATION_FULL = `## 分支隔离实现协议

${renderBranchStateSection()}

### 分支准入（apply）

${renderApplyBranchAdmission()}

### 实现期提交（apply）

${renderApplyBranchCommit()}

### 验证后自动合并（debug / spec-update）

${renderAutoMergeSection('debug Phase 7 / spec-update Step 8')}

### 非目标

${renderBranchNonGoals()}
`;

/** 归档合并协议全文（写入 `references/branch-merge.md`，archive 用） */
export const BRANCH_MERGE_FULL = `## 归档合并协议

${renderBranchStateSection()}

### 归档合并步骤

${renderArchiveMergeSection()}

### 非目标

${renderBranchNonGoals()}
`;
