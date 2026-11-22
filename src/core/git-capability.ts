/**
 * Git 能力内核（检测 + 执行）。
 *
 * 设计（见 `openspec/specs/git-capability/spec.md`）：
 *   - **检测函数纯只读**：`detectGit` / `isGitRepository` / `findParentRepository` / `probeInstallers`
 *   - **执行函数接受注入的 `CommandRunner`**：`installGit` / `initRepository` / `stagePathsAndCommit` / `push`
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

/** 截取输出尾部作为失败摘要（最多 3 行 / 300 字符） */
function tailOutput(result: SpawnCommandResult): string {
    const raw = `${result.stderr ?? ''}`.trim() || `${result.stdout ?? ''}`.trim();
    if (raw === '') return `退出码 ${result.status ?? 'null'}`;
    return raw.split(/\r?\n/).slice(-3).join(' | ').slice(0, 300);
}
