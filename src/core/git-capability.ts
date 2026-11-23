/**
 * Git 能力内核（检测 + 执行）。
 *
 * 设计（见 `openspec/specs/git-capability/spec.md`）：
 *   - **检测函数纯只读**：`detectGit` / `isGitRepository` / `findParentRepository` / `probeInstallers`
 *   - **执行函数接受注入的 `CommandRunner`**：`installGit` / `initRepository` / `stagePathsAndCommit` / `push`
 *   - **分支能力**（变更 git-branch-isolation）：`isWorkingTreeClean`（只读）/
 *     `createWorkBranch` / `mergeWorkBranch` / `deleteMergedBranch`（契约见
 *     `openspec/specs/git-branch-capability/spec.md`）
 *
 * `CommandRunner` 签名与 `src/core/dependencies.ts` 一致 —— 测试注入 mock 时不产生真实进程。
 * 外部进程 MUST 走 `child-process.ts` 的 `spawnCommand`（Windows shell 兼容 + DEP0190 规避）。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnCommand, type SpawnCommandResult } from './child-process.js';

/** 命令执行器（依赖注入，测试时替换为 mock） */
export type GitCommandRunner = (
    cmd: string,
    args: readonly string[],
    options?: { cwd?: string },
) => SpawnCommandResult;

/** 默认执行器：spawnCommand */
export const defaultGitRunner: GitCommandRunner = (cmd, args, options = {}) =>
    spawnCommand(cmd, args, { cwd: options.cwd, timeout: 60_000 });

/** Git 安装状态 */
export interface GitStatus {
    installed: boolean;
    /** 版本号（已安装时）；解析失败时为原始输出首行 */
    version?: string;
}

/** 单个安装器描述 */
export interface GitInstaller {
    /** 安装器名（winget / choco / scoop / brew / apt / dnf / pacman） */
    name: string;
    /** 将执行的确切命令 */
    command: string;
    /** 命令参数 */
    args: string[];
    /** 展示给用户的可读命令 */
    display: string;
}

/** 仓库初始化结果 */
export interface InitResult {
    action: 'created' | 'skipped';
    /** skipped 时的原因 */
    reason?: string;
}

/** 提交结果 */
export interface CommitResult {
    ok: boolean;
    /** 失败摘要（stdout/stderr 尾部） */
    detail?: string;
}

/** 推送结果 */
export interface PushResult {
    ok: boolean;
    /** 无 remote / 无上游分支等可预期情形的说明 */
    detail?: string;
}

/** 版本号解析：从 `git version 2.42.0.windows.1` 提取 `2.42.0` */
const VERSION_PATTERN = /(\d+)\.(\d+)(?:\.(\d+))?/;

/**
 * 检测 Git 是否可用。
 *
 * 执行 `git --version`；非 0 退出或启动失败一律判未安装，MUST NOT 抛错。
 */
export function detectGit(runner: GitCommandRunner = defaultGitRunner, cwd?: string): GitStatus {
    const result = runner('git', ['--version'], { cwd });
    if (result.status !== 0 || result.error !== undefined) {
        return { installed: false };
    }
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    const match = VERSION_PATTERN.exec(output);
    return {
        installed: true,
        ...(match === null ? { version: output.trim() || undefined } : { version: match[0] }),
    };
}

/** 目标目录本身是否为 Git 仓库（`.git/` 存在性，纯只读） */
export function isGitRepository(dir: string): boolean {
    return fs.existsSync(path.join(dir, '.git'));
}

/**
 * 向上查找上级仓库根路径。
 *
 * 用于防止在既有仓库内部创建嵌套仓库（会造成外层无法追踪内层文件）。
 *
 * @returns 上级仓库根路径；到文件系统根仍无 `.git/` 时返回 `null`
 */
export function findParentRepository(dir: string): string | null {
    let current = path.resolve(dir);
    for (;;) {
        const parent = path.dirname(current);
        if (parent === current) return null;
        if (fs.existsSync(path.join(parent, '.git'))) return parent;
        current = parent;
    }
}

/** 各平台安装器探测配置（顺序即优先级） */
function installerCandidates(platform: NodeJS.Platform): Array<Omit<GitInstaller, 'name'> & { name: string; probe: string[] }> {
    if (platform === 'win32') {
        return [
            { name: 'winget', probe: ['--version'], command: 'winget', args: ['install', '--id', 'Git.Git', '-e', '--source', 'winget'], display: 'winget install --id Git.Git -e --source winget' },
            { name: 'choco', probe: ['--version'], command: 'choco', args: ['install', 'git', '-y'], display: 'choco install git -y' },
            { name: 'scoop', probe: ['--version'], command: 'scoop', args: ['install', 'git'], display: 'scoop install git' },
        ];
    }
    if (platform === 'darwin') {
        return [
            { name: 'brew', probe: ['--version'], command: 'brew', args: ['install', 'git'], display: 'brew install git' },
        ];
    }
    return [
        { name: 'apt', probe: ['--version'], command: 'apt-get', args: ['install', '-y', 'git'], display: 'sudo apt-get install -y git' },
        { name: 'dnf', probe: ['--version'], command: 'dnf', args: ['install', '-y', 'git'], display: 'sudo dnf install -y git' },
        { name: 'pacman', probe: ['--version'], command: 'pacman', args: ['-S', '--noconfirm', 'git'], display: 'sudo pacman -S --noconfirm git' },
    ];
}

/**
 * 探测当前平台可用的安装器（纯只读）。
 *
 * 无任何可用安装器时返回空数组且不抛错 —— 调用方据此只给建议命令，不执行安装。
 */
export function probeInstallers(
    runner: GitCommandRunner = defaultGitRunner,
    platform: NodeJS.Platform = process.platform,
): GitInstaller[] {
    const available: GitInstaller[] = [];
    for (const candidate of installerCandidates(platform)) {
        const result = runner(candidate.command, candidate.probe, {});
        if (result.status === 0 && result.error === undefined) {
            available.push({
                name: candidate.name,
                command: candidate.command,
                args: candidate.args,
                display: candidate.display,
            });
        }
    }
    return available;
}

/**
 * 执行安装（仅在用户已通过安装确认门后调用）。
 *
 * 安装命令可能较慢，超时由 runner 决定；失败返回状态而不抛错。
 */
export function installGit(
    installer: GitInstaller,
    runner: GitCommandRunner = defaultGitRunner,
): { ok: boolean; detail?: string } {
    const result = runner(installer.command, installer.args, {});
    if (result.status === 0 && result.error === undefined) {
        return { ok: true };
    }
    return { ok: false, detail: tailOutput(result) };
}

/**
 * 幂等初始化仓库。
 *
 * - 已有 `.git/` → `skipped`（不覆盖、不重置）
 * - 存在上级仓库 → `skipped`（防嵌套仓库，reason 含上级路径）
 * - Git 不可用 → 返回失败状态（由调用方判为 WARN）
 */
export function initRepository(
    dir: string,
    runner: GitCommandRunner = defaultGitRunner,
    options: { detect?: () => GitStatus } = {},
): InitResult | { action: 'failed'; reason: string } {
    if (isGitRepository(dir)) {
        return { action: 'skipped', reason: '目标目录已是 Git 仓库（.git/ 存在），不覆盖' };
    }
    const parent = findParentRepository(dir);
    if (parent !== null) {
        return { action: 'skipped', reason: `目标目录位于上级仓库内（${parent}），不创建嵌套仓库` };
    }
    const status = (options.detect ?? (() => detectGit(runner, dir)))();
    if (!status.installed) {
        return { action: 'failed', reason: 'Git 不可用（未安装或不在 PATH）' };
    }
    const result = runner('git', ['init'], { cwd: dir });
    if (result.status !== 0 || result.error !== undefined) {
        return { action: 'failed', reason: tailOutput(result) };
    }
    return { action: 'created' };
}

/**
 * 收集归档变更的制品固定清单路径（复用 `iagent_commit` §2.5 清单）。
 *
 * 含：proposal.md / design.md / tasks.md / exploration.md / .openspec.yaml / specs 下全部 .md
 * 排除：attachments/** 与 需求文档.md；不存在的条目跳过且不报错。
 */
export function collectArchiveCommitPaths(changeRoot: string): string[] {
    const relative: string[] = [];
    for (const file of ['proposal.md', 'design.md', 'tasks.md', 'exploration.md', '.openspec.yaml']) {
        if (fs.existsSync(path.join(changeRoot, file))) relative.push(file);
    }
    const specsDir = path.join(changeRoot, 'specs');
    if (fs.existsSync(specsDir)) {
        const walk = (dir: string): void => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (entry.name.startsWith('.')) continue;
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(full);
                } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
                    relative.push(path.relative(changeRoot, full).replaceAll('\\', '/'));
                }
            }
        };
        walk(specsDir);
    }
    return relative.sort().map((rel) => path.join(changeRoot, rel));
}

/**
 * 精确暂存并提交。
 *
 * **MUST NOT** 使用 `git add -A` / `git add .` / `git add <目录通配>` —— 只提交传入的具体路径。
 * 提交失败（钩子拒绝 / 身份未配置）返回状态而不抛错。
 */
export function stagePathsAndCommit(
    paths: readonly string[],
    message: string,
    options: { cwd: string; runner?: GitCommandRunner },
): CommitResult {
    const runner = options.runner ?? defaultGitRunner;
    if (paths.length === 0) {
        return { ok: false, detail: '无待提交路径' };
    }
    for (const target of paths) {
        if (target === '.' || target.endsWith('/*') || target.endsWith('/')) {
            return { ok: false, detail: `拒绝暂存非具体路径：${target}` };
        }
    }
    const addResult = runner('git', ['add', '--', ...paths], { cwd: options.cwd });
    if (addResult.status !== 0 || addResult.error !== undefined) {
        return { ok: false, detail: tailOutput(addResult) };
    }
    const commitResult = runner('git', ['commit', '-m', message], { cwd: options.cwd });
    if (commitResult.status !== 0 || commitResult.error !== undefined) {
        return { ok: false, detail: tailOutput(commitResult) };
    }
    return { ok: true };
}

/** 推送当前分支（无 remote / 无上游时返回说明而不抛错） */
export function push(options: { cwd: string; runner?: GitCommandRunner }): PushResult {
    const runner = options.runner ?? defaultGitRunner;
    const remotes = runner('git', ['remote'], { cwd: options.cwd });
    if (remotes.status !== 0 || remotes.error !== undefined) {
        return { ok: false, detail: tailOutput(remotes) };
    }
    if ((remotes.stdout ?? '').trim() === '') {
        return { ok: false, detail: '未配置远程仓库（git remote 为空），已保留本地提交' };
    }
    const result = runner('git', ['push'], { cwd: options.cwd });
    if (result.status !== 0 || result.error !== undefined) {
        return { ok: false, detail: tailOutput(result) };
    }
    return { ok: true };
}

// ── 分支能力（变更 git-branch-isolation） ─────────────────────────────

/** 工作区状态（只读） */
export interface WorkingTreeStatus {
    clean: boolean;
    /** `git status --porcelain` 的非空行（原样保留状态码与路径） */
    dirty: string[];
    /** 命令失败时的摘要（clean 恒为 false） */
    reason?: string;
}

/** 分支创建结果 */
export interface CreateBranchResult {
    action: 'created' | 'reused' | 'skipped' | 'failed';
    branch: string;
    baseBranch?: string;
    reason?: string;
}

/** 分支合并结果 */
export interface MergeBranchResult {
    ok: boolean;
    merged: boolean;
    /** 冲突文件列表（取自 `git diff --name-only --diff-filter=U`） */
    conflicts: string[];
    detail?: string;
}

/** 删除已合并分支的结果 */
export interface DeleteBranchResult {
    action: 'deleted' | 'skipped';
    reason?: string;
}

/**
 * 分支名校验：拒绝可造成路径注入或 git 解析歧义的写法。
 *
 * 允许字母 / 数字 / `-` / `_` / `.` / `/`（git 常规分支名），拒绝以下情形：
 * 空名、含空白、含 `..`、前导或结尾 `/`、前导 `-`、含 `~ ^ : ? * [ \` 任一字符。
 *
 * @returns 合法时返回 `null`；非法时返回原因
 */
export function validateBranchName(name: string): string | null {
    const trimmed = name.trim();
    if (trimmed === '') return '分支名 MUST NOT 为空';
    if (trimmed !== name) return '分支名 MUST NOT 含首尾空白';
    if (/\s/.test(trimmed)) return '分支名 MUST NOT 含空白字符';
    if (trimmed.includes('..')) return '分支名 MUST NOT 含 `..`';
    if (trimmed.startsWith('/') || trimmed.endsWith('/')) return '分支名 MUST NOT 以 `/` 开头或结尾';
    if (trimmed.startsWith('-')) return '分支名 MUST NOT 以 `-` 开头';
    if (/[~^:?*[\\]/.test(trimmed)) return '分支名 MUST NOT 含 `~ ^ : ? * [ \\` 任一字符';
    return null;
}

/**
 * 检查工作区是否干净（纯只读）。
 *
 * 经 `git status --porcelain` 判定；命令失败返回 `clean: false` + `reason` 而不抛错
 * （调用方据此降级或暂停，不得误判为干净）。
 */
export function isWorkingTreeClean(
    dir: string,
    runner: GitCommandRunner = defaultGitRunner,
): WorkingTreeStatus {
    const result = runner('git', ['status', '--porcelain'], { cwd: dir });
    if (result.status !== 0 || result.error !== undefined) {
        return { clean: false, dirty: [], reason: tailOutput(result) };
    }
    const dirty = `${result.stdout ?? ''}`
        .split(/\r?\n/)
        .filter((line) => line.trim() !== '');
    return { clean: dirty.length === 0, dirty };
}

/** 读取当前分支名（detached HEAD 时返回 `HEAD` 或原始输出；失败返回 null） */
function currentBranch(dir: string, runner: GitCommandRunner): string | null {
    const result = runner('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir });
    if (result.status !== 0 || result.error !== undefined) return null;
    return `${result.stdout ?? ''}`.trim() || null;
}

/**
 * 幂等创建并切换工作分支。
 *
 * 三分支返回：
 *   - 已在目标分支 → `skipped`
 *   - 分支已存在（不在其上）→ `reused`（MUST NOT 覆盖或重置）
 *   - 否则 `git checkout -b <name>`
 *
 * `options.baseBranch` 显式传入时 MUST 与当前分支一致，否则以失败返回
 * （防止在错误基点上创建分支）。
 */
export function createWorkBranch(options: {
    name: string;
    baseBranch?: string;
    cwd: string;
    runner?: GitCommandRunner;
}): CreateBranchResult {
    const runner = options.runner ?? defaultGitRunner;
    const invalid = validateBranchName(options.name);
    if (invalid !== null) {
        return { action: 'failed', branch: options.name, reason: invalid };
    }

    const current = currentBranch(options.cwd, runner);
    if (current === null) {
        return {
            action: 'failed',
            branch: options.name,
            reason: '无法解析当前分支（非仓库 / detached HEAD）',
        };
    }
    if (current === options.name) {
        return {
            action: 'skipped',
            branch: options.name,
            baseBranch: options.baseBranch ?? current,
            reason: '已在目标分支',
        };
    }
    if (options.baseBranch !== undefined && options.baseBranch !== current) {
        return {
            action: 'failed',
            branch: options.name,
            baseBranch: options.baseBranch,
            reason: `基点分支不一致：声明 ${options.baseBranch}，实际当前 ${current}`,
        };
    }

    const exists = runner('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${options.name}`], {
        cwd: options.cwd,
    });
    if (exists.status === 0 && exists.error === undefined) {
        // 复用既有分支时 MUST 切换过去 —— 否则后续写操作仍落在当前分支上，
        // 回执声称 work-branch 却未实际隔离（分支隔离语义被静默破坏）。
        const checkout = runner('git', ['checkout', options.name], { cwd: options.cwd });
        if (checkout.status !== 0 || checkout.error !== undefined) {
            return {
                action: 'failed',
                branch: options.name,
                baseBranch: current,
                reason: tailOutput(checkout),
            };
        }
        return {
            action: 'reused',
            branch: options.name,
            baseBranch: current,
            reason: '分支已存在，复用而不覆盖',
        };
    }

    const created = runner('git', ['checkout', '-b', options.name], { cwd: options.cwd });
    if (created.status !== 0 || created.error !== undefined) {
        return {
            action: 'failed',
            branch: options.name,
            baseBranch: current,
            reason: tailOutput(created),
        };
    }
    return { action: 'created', branch: options.name, baseBranch: current };
}

/**
 * 合并工作分支（`git merge --no-ff`）。
 *
 * 冲突时返回冲突文件清单且 **MUST NOT** 执行 `git merge --abort` / `git reset --hard`
 * —— 冲突态保留供调用方与用户处置。任何失败均返回状态而不抛错。
 */
export function mergeWorkBranch(options: {
    name: string;
    into?: string;
    cwd: string;
    runner?: GitCommandRunner;
}): MergeBranchResult {
    const runner = options.runner ?? defaultGitRunner;
    const invalid = validateBranchName(options.name);
    if (invalid !== null) {
        return { ok: false, merged: false, conflicts: [], detail: invalid };
    }

    if (options.into !== undefined) {
        const checkout = runner('git', ['checkout', options.into], { cwd: options.cwd });
        if (checkout.status !== 0 || checkout.error !== undefined) {
            return { ok: false, merged: false, conflicts: [], detail: tailOutput(checkout) };
        }
    }

    const merge = runner('git', ['merge', '--no-ff', '--no-edit', options.name], { cwd: options.cwd });
    if (merge.status === 0 && merge.error === undefined) {
        return { ok: true, merged: true, conflicts: [] };
    }

    const conflicts = runner('git', ['diff', '--name-only', '--diff-filter=U'], { cwd: options.cwd });
    const conflictFiles =
        conflicts.status === 0 && conflicts.error === undefined
            ? `${conflicts.stdout ?? ''}`
                  .split(/\r?\n/)
                  .map((line) => line.trim())
                  .filter((line) => line !== '')
            : [];

    return {
        ok: false,
        merged: false,
        conflicts: conflictFiles,
        detail: tailOutput(merge),
    };
}

/**
 * 删除已合并分支（`git branch -d`，**非** `-D`）。
 *
 * 未合并分支会被 git 拒绝 → 返回 `skipped` + 原因；MUST NOT 强制删除。
 */
export function deleteMergedBranch(options: {
    name: string;
    cwd: string;
    runner?: GitCommandRunner;
}): DeleteBranchResult {
    const runner = options.runner ?? defaultGitRunner;
    const invalid = validateBranchName(options.name);
    if (invalid !== null) {
        return { action: 'skipped', reason: invalid };
    }
    const result = runner('git', ['branch', '-d', options.name], { cwd: options.cwd });
    if (result.status === 0 && result.error === undefined) {
        return { action: 'deleted' };
    }
    return { action: 'skipped', reason: tailOutput(result) };
}


/** 截取输出尾部作为失败摘要（最多 3 行 / 300 字符） */
function tailOutput(result: SpawnCommandResult): string {
    const raw = `${result.stderr ?? ''}`.trim() || `${result.stdout ?? ''}`.trim();
    if (raw === '') return `退出码 ${result.status ?? 'null'}`;
    return raw.split(/\r?\n/).slice(-3).join(' | ').slice(0, 300);
}
