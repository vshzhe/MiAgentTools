/**
 * iagent version 命令。
 *
 * 从 Git 变更（基线之后的提交 + 工作区 diff）推断「实际实现影响面」，
 * 按 SemVer 判定大版本 / 次版本 / 小版本，并可把结果写回：
 *   package.json（version）、CHANGELOG.md（归档 [Unreleased]）、README.md（版本示例）
 *
 * 子命令：
 *   iagent version         只读判定（等价 dry-run）
 *   iagent version bump    写入版本号与变更日志（--dry-run 预览）
 */

import { Command, Option } from 'commander';
import * as fs from 'node:fs';
import path from 'node:path';
import { spawnCommand } from '../core/child-process.js';
import { readFileIfExists } from '../utils/file-system.js';
import {
    analyzeVersionBump,
    extractUnreleasedBody,
    isVersionLevel,
    parseSemver,
    updateChangelog,
    updatePackageVersion,
    updateReadmeVersion,
    VERSION_LEVEL_LABELS,
    VERSION_LEVELS,
    type VersionAnalysis,
    type VersionChangeSet,
    type VersionLevel,
} from '../core/version-bump.js';

/** Git diff 解析上限（超过则只按提交与文件路径判定，避免大仓库拖慢命令） */
const MAX_PATCH_CHARS = 4 * 1024 * 1024;

/** version 命令选项 */
export interface VersionCommandOptions {
    /** JSON 输出 */
    json?: boolean;
    /** 显式基线（git ref） */
    from?: string;
    /** 显式等级（覆盖自动判定） */
    level?: string;
    /** 只判定不写入（bump 用） */
    dryRun?: boolean;
    /** 归档 CHANGELOG（默认 true；--no-changelog 关闭） */
    changelog?: boolean;
    /** 同步 README 版本示例（默认 true；--no-readme 关闭） */
    readme?: boolean;
    /** 指定归档日期（YYYY-MM-DD，测试注入） */
    date?: string;
}

/** version 命令结果 */
export interface VersionCommandResult {
    analysis: VersionAnalysis;
    /** 基线之后是否存在待发布变更 */
    hasChanges: boolean;
    /** 是否已写入文件 */
    applied: boolean;
    /** 已写入（或 dry-run 将写入）的文件 */
    changedFiles: string[];
    /** 工作区版本号领先于 HEAD（已执行过 bump 但未提交） */
    uncommittedVersion: boolean;
    warnings: string[];
}

/** 基线解析结果 */
interface Baseline {
    ref: string;
    label: string;
    uncommittedVersion: boolean;
    warnings: string[];
}

/** 执行一条 git 命令 */
function git(projectRoot: string, args: string[]): { status: number | null; stdout: string; stderr: string } {
    const result = spawnCommand('git', args, { cwd: projectRoot });
    return {
        status: result.status,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
    };
}

/** 执行 git 并返回 stdout（失败抛错） */
function gitText(projectRoot: string, args: string[]): string {
    const result = git(projectRoot, args);
    if (result.status !== 0) {
        throw new Error(`git ${args.join(' ')} 失败：${result.stderr.trim() || `退出码 ${String(result.status)}`}`);
    }
    return result.stdout;
}

/** 读取 package.json 与当前版本 */
function readPackage(projectRoot: string): { content: string; version: string; json: Record<string, unknown> } {
    const file = path.join(projectRoot, 'package.json');
    const content = readFileIfExists(file);
    if (content === undefined) {
        throw new Error(`未找到 package.json：${file}`);
    }
    let json: Record<string, unknown>;
    try {
        json = JSON.parse(content) as Record<string, unknown>;
    } catch {
        throw new Error('package.json 不是合法 JSON，无法读取版本号');
    }
    if (typeof json.version !== 'string' || !parseSemver(json.version)) {
        throw new Error(`package.json 的 version 非法：${String(json.version)}`);
    }
    return { content, version: json.version, json };
}

/** 读取某个 Git 版本下的 package.json version */
function versionAt(projectRoot: string, rev: string): string | null {
    const result = git(projectRoot, ['show', `${rev}:package.json`]);
    if (result.status !== 0 || result.stdout.trim() === '') {
        return null;
    }
    try {
        const parsed = JSON.parse(result.stdout) as { version?: unknown };
        return typeof parsed.version === 'string' ? parsed.version : null;
    } catch {
        return null;
    }
}

/** 判断目录是否为 Git 工作区 */
function isGitWorkTree(projectRoot: string): boolean {
    const result = git(projectRoot, ['rev-parse', '--is-inside-work-tree']);
    return result.status === 0 && result.stdout.trim() === 'true';
}

/**
 * 解析基线：优先显式 --from → 同版本 tag → 引入当前版本的提交 → HEAD。
 *
 * 只比较基线之后的内容（基线提交本身不计入），因此已在当前版本中发布的历史变更
 * 不会被重复计入下一版。
 */
function resolveBaseline(projectRoot: string, currentVersion: string, from?: string): Baseline {
    if (!isGitWorkTree(projectRoot)) {
        throw new Error('当前目录不是 Git 工作区，无法基于实现变更判定版本；可用 --level 显式指定等级');
    }
    const warnings: string[] = [];

    if (from) {
        const verify = git(projectRoot, ['rev-parse', '--verify', from]);
        if (verify.status !== 0) {
            throw new Error(`--from 指定的基线不存在：${from}`);
        }
        return { ref: from, label: `--from ${from}`, uncommittedVersion: false, warnings };
    }

    const headVersion = versionAt(projectRoot, 'HEAD');
    if (headVersion !== null && headVersion !== currentVersion) {
        return {
            ref: 'HEAD',
            label: `HEAD（已提交 ${headVersion}，工作区 ${currentVersion} 未提交）`,
            uncommittedVersion: true,
            warnings: [
                `工作区版本号（${currentVersion}）尚未提交（HEAD 为 ${headVersion}）；` +
                    '若已执行过 version bump，请先提交或回滚，避免重复递增',
            ],
        };
    }

    // 1. 与当前版本一致的 tag（tag 指向发布提交时最准确）
    const tags = git(projectRoot, ['tag', '--list', '--sort=-v:refname']).stdout
        .split('\n')
        .map((tag) => tag.trim())
        .filter((tag) => /^v?\d+\.\d+\.\d+$/.test(tag));
    for (const tag of tags) {
        // tag 必须在当前分支历史上，避免跨分支同名版本的 tag 纳入无关变更
        const ancestor = git(projectRoot, ['merge-base', '--is-ancestor', tag, 'HEAD']);
        if (ancestor.status === 0 && versionAt(projectRoot, tag) === currentVersion) {
            return { ref: tag, label: `tag ${tag}`, uncommittedVersion: false, warnings };
        }
    }

    // 2. 引入当前版本号的提交（无 tag 的仓库回退路径）
    const packageCommits = git(projectRoot, ['rev-list', '-n', '500', 'HEAD', '--', 'package.json']).stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    for (const sha of packageCommits) {
        if (versionAt(projectRoot, sha) !== currentVersion) {
            continue;
        }
        const parentVersion = versionAt(projectRoot, `${sha}^`);
        if (parentVersion !== currentVersion) {
            return {
                ref: sha,
                label: `${sha.slice(0, 7)}（引入 ${currentVersion} 的提交）`,
                uncommittedVersion: false,
                warnings,
            };
        }
    }

    // 3. 回退：HEAD（仅统计未提交变更）
    const head = git(projectRoot, ['rev-parse', '--verify', 'HEAD']);
    if (head.status !== 0) {
        return { ref: '', label: '工作区（无提交历史）', uncommittedVersion: false, warnings };
    }
    warnings.push('未找到当前版本号的引入提交，基线回退为 HEAD（仅统计未提交变更）');
    return { ref: 'HEAD', label: 'HEAD（回退基线）', uncommittedVersion: false, warnings };
}

/** Git name-status 状态字符 → 语义状态 */
function mapStatus(code: string): 'added' | 'modified' | 'deleted' | 'renamed' | 'unknown' {
    switch (code) {
        case 'A':
            return 'added';
        case 'M':
        case 'T':
            return 'modified';
        case 'D':
            return 'deleted';
        case 'R':
        case 'C':
            return 'renamed';
        default:
            return 'unknown';
    }
}

/** 解析 `git diff --name-status` 输出 */
function parseNameStatus(output: string): VersionChangeSet['files'] {
    const files: VersionChangeSet['files'] = [];
    for (const line of output.split('\n')) {
        const trimmed = line.replace(/\r$/, '');
        if (trimmed === '') {
            continue;
        }
        const parts = trimmed.split('\t');
        if (parts.length < 2) {
            continue;
        }
        const status = mapStatus(parts[0][0]);
        if (status === 'renamed' && parts.length >= 3) {
            files.push({ path: parts[2], previousPath: parts[1], status });
        } else {
            files.push({ path: parts[1], status });
        }
    }
    return files;
}

/** 解析 unified diff 的逐行新增 / 删除（按变更后路径归组） */
function parseDiffLines(patch: string): {
    addedLines: Record<string, string[]>;
    removedLines: Record<string, string[]>;
} {
    const addedLines: Record<string, string[]> = {};
    const removedLines: Record<string, string[]> = {};
    const lines = patch.split('\n').map((line) => line.replace(/\r$/, ''));
    let current: string | null = null;

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        if (line.startsWith('diff --git ')) {
            current = null;
            continue;
        }
        // 仅当下一行是 `+++` 时才视为文件头，避免把以 `--` 开头的正文行误判为头
        if (line.startsWith('--- ') && (lines[index + 1] ?? '').startsWith('+++ ')) {
            const minus = line.slice(4).trim().replace(/^"|"$/g, '');
            const plus = lines[index + 1].slice(4).trim().replace(/^"|"$/g, '');
            current =
                plus === '/dev/null' ? minus.replace(/^a\//, '') : plus.replace(/^b\//, '');
            index++;
            continue;
        }
        if (current === null || line.startsWith('@@') || line.startsWith('\\')) {
            continue;
        }
        if (line.startsWith('+')) {
            (addedLines[current] ??= []).push(line.slice(1));
        } else if (line.startsWith('-')) {
            (removedLines[current] ??= []).push(line.slice(1));
        }
    }
    return { addedLines, removedLines };
}

/**
 * 解析基线之后的提交。
 *
 * 使用 `--pretty=raw`（无 `%` 占位符）：Windows 下命令经 cmd.exe 执行，
 * `%H` 一类字符串会被当作环境变量展开，故不能使用 `--format=%H...`。
 * raw 格式的消息行统一缩进 4 个空格。
 */
function collectCommits(projectRoot: string, baselineRef: string): VersionChangeSet['commits'] {
    if (baselineRef === '') {
        return [];
    }
    const output = gitText(projectRoot, ['log', '--no-merges', '--pretty=raw', `${baselineRef}..HEAD`]);
    const commits: VersionChangeSet['commits'] = [];
    for (const chunk of output.split(/\n(?=commit [0-9a-f]{40}\b)/)) {
        const lines = chunk.split('\n');
        const hash = /^commit ([0-9a-f]{40})\b/.exec(lines[0])?.[1];
        if (!hash) {
            continue;
        }
        let index = 1;
        while (index < lines.length && lines[index].trim() !== '') {
            index++;
        }
        // 跳过头信息后的空行
        while (index < lines.length && lines[index].trim() === '') {
            index++;
        }
        const message = lines
            .slice(index)
            .map((line) => (line.startsWith('    ') ? line.slice(4) : line))
            .join('\n')
            .trim();
        const [subject = '', ...body] = message.split('\n');
        commits.push({ hash, subject: subject.trim(), body: body.join('\n').trim() });
    }
    return commits;
}

/** 采集基线之后的完整变更集 */
function collectChanges(projectRoot: string, baseline: Baseline): VersionChangeSet {
    const warnings = [...baseline.warnings];
    let files: VersionChangeSet['files'] = [];
    let addedLines: Record<string, string[]> | undefined;
    let removedLines: Record<string, string[]> | undefined;

    if (baseline.ref === '') {
        const status = gitText(projectRoot, ['status', '--porcelain=v1']);
        for (const line of status.split('\n')) {
            const trimmed = line.replace(/\r$/, '');
            if (trimmed.length < 4) {
                continue;
            }
            const code = trimmed[0] === '?' ? 'A' : trimmed[0];
            files.push({ path: trimmed.slice(3).trim(), status: mapStatus(code) });
        }
    } else {
        files = parseNameStatus(gitText(projectRoot, ['diff', '--name-status', '-M', baseline.ref, '--']));
        // 未跟踪文件（git diff 不包含），按新增计入
        const untracked = gitText(projectRoot, ['ls-files', '--others', '--exclude-standard'])
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
        const known = new Set(files.map((file) => file.path));
        for (const file of untracked) {
            if (!known.has(file)) {
                files.push({ path: file, status: 'added' });
            }
        }

        const patch = gitText(projectRoot, ['diff', '-U0', '--no-color', '-M', baseline.ref, '--']);
        if (patch.length > MAX_PATCH_CHARS) {
            warnings.push(`diff 超过 ${MAX_PATCH_CHARS} 字符，跳过逐行分析（仍按提交与文件路径判定）`);
        } else {
            const parsed = parseDiffLines(patch);
            addedLines = parsed.addedLines;
            removedLines = parsed.removedLines;
        }
    }

    const changelog = readFileIfExists(path.join(projectRoot, 'CHANGELOG.md'));
    return {
        baselineRef: baseline.ref,
        baselineLabel: baseline.label,
        commits: collectCommits(projectRoot, baseline.ref),
        files,
        addedLines,
        removedLines,
        unreleasedChangelog: changelog === undefined ? '' : extractUnreleasedBody(changelog),
        warnings,
    };
}

/** 从 package.json repository 字段推导仓库 Web URL */
function repositoryUrl(pkg: Record<string, unknown>): string | null {
    const repository = pkg.repository;
    const raw =
        typeof repository === 'string'
            ? repository
            : repository !== null && typeof repository === 'object' && typeof (repository as { url?: unknown }).url === 'string'
              ? (repository as { url: string }).url
              : null;
    if (!raw) {
        return null;
    }
    return raw.replace(/^git\+/, '').replace(/\.git$/, '').replace(/^git@([^:]+):/, 'https://$1/');
}

/** 本地日期 YYYY-MM-DD */
function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** 解析显式等级（非法值抛错） */
function resolveLevel(level: string | undefined): VersionLevel | undefined {
    if (level === undefined) {
        return undefined;
    }
    if (!isVersionLevel(level)) {
        throw new Error(`未知的版本等级：${level}（可选：${VERSION_LEVELS.join(' / ')}）`);
    }
    return level;
}

/**
 * 执行版本判定 / 递增。
 *
 * @param projectRoot - 项目根目录
 * @param options - 命令选项
 * @param apply - true = `version bump`（写入），false = `version`（只读判定）
 */
export function runVersion(
    projectRoot: string,
    options: VersionCommandOptions = {},
    apply = false
): VersionCommandResult {
    const pkg = readPackage(projectRoot);
    const level = resolveLevel(options.level);
    const warnings: string[] = [];
    let baseline: Baseline = {
        ref: '',
        label: '--level 显式指定（未读取 Git 变更）',
        uncommittedVersion: false,
        warnings: [],
    };
    let changeSet: VersionChangeSet;

    if (level !== undefined) {
        // 显式等级仍尽力采集变更用于归档 CHANGELOG；Git 不可用时不阻断
        try {
            baseline = resolveBaseline(projectRoot, pkg.version, options.from);
            changeSet = collectChanges(projectRoot, baseline);
        } catch (error) {
            warnings.push((error as Error).message);
            const changelog = readFileIfExists(path.join(projectRoot, 'CHANGELOG.md'));
            changeSet = {
                baselineRef: '',
                baselineLabel: baseline.label,
                commits: [],
                files: [],
                unreleasedChangelog: changelog === undefined ? '' : extractUnreleasedBody(changelog),
                warnings: [],
            };
        }
    } else {
        baseline = resolveBaseline(projectRoot, pkg.version, options.from);
        changeSet = collectChanges(projectRoot, baseline);
    }

    const hasChanges = changeSet.commits.length > 0 || changeSet.files.length > 0;
    if (level === undefined && !hasChanges && apply) {
        throw new Error(`自 ${pkg.version} 以来没有检测到变更，无需递增版本`);
    }

    const analysis = analyzeVersionBump(pkg.version, changeSet, { level });
    warnings.push(...analysis.warnings);

    const result: VersionCommandResult = {
        analysis,
        hasChanges,
        applied: false,
        changedFiles: [],
        uncommittedVersion: baseline.uncommittedVersion,
        warnings,
    };

    if (!apply) {
        return result;
    }
    if (options.dryRun) {
        result.changedFiles = collectPlannedFiles(
            projectRoot,
            options,
            pkg.version,
            analysis.nextVersion
        );
        return result;
    }
    if (baseline.uncommittedVersion) {
        throw new Error(
            `工作区已存在未提交的版本号变更（当前 ${pkg.version}）。` +
                '若已执行过 version bump，请先提交或回滚；确需覆盖请使用 --from 指定基线'
        );
    }

    const date = options.date ?? formatDate(new Date());
    const nextPkg = updatePackageVersion(pkg.content, pkg.version, analysis.nextVersion);
    const writes: Array<{ file: string; content: string }> = [
        { file: path.join(projectRoot, 'package.json'), content: nextPkg },
    ];

    if (options.changelog !== false) {
        const changelogPath = path.join(projectRoot, 'CHANGELOG.md');
        const changelog = readFileIfExists(changelogPath);
        if (changelog === undefined) {
            warnings.push('未找到 CHANGELOG.md，跳过变更日志归档');
        } else {
            const updated = updateChangelog({
                content: changelog,
                version: analysis.nextVersion,
                previousVersion: pkg.version,
                date,
                body: analysis.changelogBody,
                repositoryUrl: repositoryUrl(pkg.json),
            });
            warnings.push(...updated.warnings);
            writes.push({ file: changelogPath, content: updated.content });
        }
    }

    if (options.readme !== false) {
        const readmePath = path.join(projectRoot, 'README.md');
        const readme = readFileIfExists(readmePath);
        if (readme !== undefined) {
            const updated = updateReadmeVersion(readme, pkg.version, analysis.nextVersion);
            if (updated.replacements > 0) {
                writes.push({ file: readmePath, content: updated.content });
            }
        }
    }

    for (const write of writes) {
        fs.writeFileSync(write.file, write.content, 'utf8');
        result.changedFiles.push(path.relative(projectRoot, write.file).replaceAll('\\', '/'));
    }
    result.applied = true;
    return result;
}

/** dry-run 时列出将会写入的文件（不落盘，按实际会变更的内容判定） */
function collectPlannedFiles(
    projectRoot: string,
    options: VersionCommandOptions,
    currentVersion: string,
    nextVersion: string
): string[] {
    const planned: string[] = ['package.json'];
    if (options.changelog !== false && fs.existsSync(path.join(projectRoot, 'CHANGELOG.md'))) {
        planned.push('CHANGELOG.md');
    }
    const readme = readFileIfExists(path.join(projectRoot, 'README.md'));
    if (
        options.readme !== false &&
        readme !== undefined &&
        updateReadmeVersion(readme, currentVersion, nextVersion).replacements > 0
    ) {
        planned.push('README.md');
    }
    return planned;
}

/** 渲染版本报告 */
export function renderVersionReport(result: VersionCommandResult): string {
    const { analysis } = result;
    const lines: string[] = [];
    if (!result.hasChanges && analysis.declaredLevel === null) {
        lines.push(`当前版本：${analysis.currentVersion}`);
        lines.push('待发布变更：无（无需递增版本）');
        lines.push(`基线：${analysis.baselineLabel || '（无）'}`);
        for (const warning of result.warnings) {
            if (!warning.includes('CHANGELOG [Unreleased] 为空')) {
                lines.push(`  ! ${warning}`);
            }
        }
        return lines.join('\n');
    }
    lines.push(`当前版本：${analysis.currentVersion}`);
    lines.push(`判定等级：${analysis.levelLabel} → ${analysis.nextVersion}`);
    lines.push(`基线：${analysis.baselineLabel || '（无）'}`);
    lines.push(`变更：${analysis.commitCount} 个提交 / ${analysis.fileCount} 个文件`);
    lines.push('依据：');
    if (analysis.signals.length === 0) {
        lines.push('  （无自动信号，按显式等级）');
    } else {
        for (const signal of analysis.signals) {
            const evidence = signal.evidence.length > 0 ? `（${signal.evidence.join('、')}）` : '';
            lines.push(`  [${VERSION_LEVEL_LABELS[signal.level]}] ${signal.reason}${evidence}`);
        }
    }
    if (result.applied) {
        lines.push(`写入：${result.changedFiles.join('、') || '（无）'}`);
    } else if (result.changedFiles.length > 0) {
        lines.push(`将写入（dry-run，未落盘）：${result.changedFiles.join('、')}`);
    } else {
        lines.push('提示：运行 iagent version bump 写入 package.json / CHANGELOG.md / README.md');
    }
    if (analysis.declaredLevel !== null) {
        lines.push(`声明等级：${analysis.declaredLevel}（取自提交 Release-Level 尾注）`);
    }
    for (const warning of result.warnings) {
        lines.push(`  ! ${warning}`);
    }
    return lines.join('\n');
}

/** 构建 `iagent version` 命令（含 bump 子命令） */
export function buildVersionCommand(): Command {
    const command = new Command('version');
    command
        .description('按实际实现影响面判定版本等级（大 / 次 / 小版本）')
        .addOption(new Option('--from <ref>', '指定 Git 基线（默认：同版本 tag 或引入当前版本的提交）'))
        .addOption(new Option('--level <level>', '显式指定等级（覆盖自动判定）').choices([...VERSION_LEVELS]))
        .option('--json', '以 JSON 输出（供程序处理）')
        .action((options: VersionCommandOptions) => {
            const result = runVersion(process.cwd(), options, false);
            console.log(options.json ? JSON.stringify(result, null, 2) : renderVersionReport(result));
        });

    command
        .command('bump')
        .description('写入 package.json 版本号并归档 CHANGELOG（可 --dry-run 预览）')
        .addOption(new Option('--from <ref>', '指定 Git 基线（默认：同版本 tag 或引入当前版本的提交）'))
        .addOption(new Option('--level <level>', '显式指定等级（覆盖自动判定）').choices([...VERSION_LEVELS]))
        .option('--dry-run', '只输出判定结果，不写入文件')
        .option('--no-changelog', '不归档 CHANGELOG.md')
        .option('--no-readme', '不同步 README.md 中的版本示例')
        .option('--json', '以 JSON 输出（供程序处理）')
        .action((options: VersionCommandOptions) => {
            const result = runVersion(process.cwd(), options, true);
            console.log(options.json ? JSON.stringify(result, null, 2) : renderVersionReport(result));
        });

    return command;
}
