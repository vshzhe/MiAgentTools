/**
 * 版本递增判定（SemVer + 实际实现影响面分级）。
 *
 * 纯函数层：输入是已采集的变更集（基线之后的提交、变更文件、关键文件逐行 diff、
 * CHANGELOG 未发布段），输出是判定等级、递增前后版本与逐条可追溯依据。
 * git 读取与文件写入由 `src/commands/version.ts` 承担，本模块不触碰 IO。
 *
 * 分级规则（冲突取较大者，显式回退最低）：
 *   major —— 破坏性提交（`feat!:` / `BREAKING CHANGE` / `Release-Level: major`）、
 *            CHANGELOG `### BREAKING`、删除技能模板 / CLI 命令、移除注册项或包契约字段
 *   minor —— 新增功能提交（`feat:` / `Release-Level: minor`）、CHANGELOG `### Added`、
 *            新增技能模板 / CLI 命令 / 技能类型
 *   patch —— 修复、文档、重构、测试、构建等维护性变更（默认级别）
 */

/** 版本等级（递增位） */
export type VersionLevel = 'major' | 'minor' | 'patch';

/** 等级枚举（CLI 展示顺序：大 → 次 → 小） */
export const VERSION_LEVELS: readonly VersionLevel[] = ['major', 'minor', 'patch'];

/** 等级排序权重：冲突时取较大者 */
const LEVEL_RANK: Record<VersionLevel, number> = {
    patch: 0,
    minor: 1,
    major: 2,
};

/** 等级展示名（中文语义） */
export const VERSION_LEVEL_LABELS: Record<VersionLevel, string> = {
    major: '大版本（不兼容）',
    minor: '次版本（功能新增）',
    patch: '小版本（修复 / 文档 / 重构）',
};

/** 是否为合法等级 */
export function isVersionLevel(value: string): value is VersionLevel {
    return (VERSION_LEVELS as readonly string[]).includes(value);
}

/** 解析 `major.minor.patch`（允许 -pre / +build 后缀，后缀不参与递增） */
export function parseSemver(version: string): [number, number, number] | null {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim());
    if (!match) {
        return null;
    }
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** 按等级递增版本号（低位清零） */
export function bumpVersion(current: string, level: VersionLevel): string {
    const parsed = parseSemver(current);
    if (!parsed) {
        throw new Error(`无法解析版本号：${current}（期望 major.minor.patch）`);
    }
    const [major, minor, patch] = parsed;
    if (level === 'major') {
        return `${major + 1}.0.0`;
    }
    if (level === 'minor') {
        return `${major}.${minor + 1}.0`;
    }
    return `${major}.${minor}.${patch + 1}`;
}

/** 变更文件状态 */
export type ChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'unknown';

/** 单个变更文件 */
export interface ChangedFile {
    /** 变更后路径（删除文件为原路径） */
    path: string;
    status: ChangeStatus;
    /** 重命名前的路径 */
    previousPath?: string;
}

/** 基线之后的提交 */
export interface CommitInfo {
    hash: string;
    subject: string;
    body: string;
}

/** 采集到的变更集 */
export interface VersionChangeSet {
    /** 基线引用（tag / commit / HEAD） */
    baselineRef: string;
    /** 基线展示标签 */
    baselineLabel: string;
    commits: CommitInfo[];
    files: ChangedFile[];
    /** 关键文件的逐行新增（key = 变更后路径） */
    addedLines?: Record<string, string[]>;
    /** 关键文件的逐行删除（key = 变更后路径） */
    removedLines?: Record<string, string[]>;
    /** CHANGELOG 首个 [Unreleased] 段正文 */
    unreleasedChangelog?: string;
    /** 采集阶段已产生的告警 */
    warnings?: string[];
}

/** 单条判定依据 */
export interface VersionSignal {
    level: VersionLevel;
    /** 机器可读信号码（测试与 JSON 消费） */
    code: string;
    /** 人类可读依据 */
    reason: string;
    /** 证据（提交短哈希 / 文件路径） */
    evidence: string[];
}

/** 判定选项 */
export interface AnalyzeVersionOptions {
    /** 显式指定等级（覆盖自动判定） */
    level?: VersionLevel;
}

/** 判定结果 */
export interface VersionAnalysis {
    currentVersion: string;
    nextVersion: string;
    level: VersionLevel;
    levelLabel: string;
    /** 提交信息中声明的等级（Release-Level 尾注） */
    declaredLevel: VersionLevel | null;
    /** 自动判定得到的等级（不受显式覆盖影响） */
    autoLevel: VersionLevel;
    signals: VersionSignal[];
    baselineRef: string;
    baselineLabel: string;
    commitCount: number;
    fileCount: number;
    /** 归档到 CHANGELOG 的正文（已按提交合成或取自 Unreleased） */
    changelogBody: string;
    /** CHANGELOG 正文是否由提交信息自动合成 */
    changelogSynthesized: boolean;
    warnings: string[];
}

/** Conventional Commits 解析结果 */
interface ConventionalSubject {
    type: string;
    scope?: string;
    breaking: boolean;
    summary: string;
}

/** 解析 Conventional Commits 标题（不匹配返回 null） */
function parseConventionalSubject(subject: string): ConventionalSubject | null {
    const match = /^([a-zA-Z]+)(?:\(([^)]*)\))?(!)?:\s*(.*)$/.exec(subject.trim());
    if (!match) {
        return null;
    }
    return {
        type: match[1].toLowerCase(),
        scope: match[2]?.trim() || undefined,
        breaking: match[3] === '!',
        summary: match[4].trim(),
    };
}

/** 提交正文是否声明破坏性变更 */
function hasBreakingFooter(body: string): boolean {
    return /^BREAKING[ -]CHANGE:/im.test(body);
}

/** 提取提交正文中的 `Release-Level:` 尾注 */
function releaseLevelTrailer(body: string): VersionLevel | null {
    const matches = [...body.matchAll(/^[ \t]*Release-Level[ \t]*:[ \t]*(major|minor|patch)[ \t]*$/gim)];
    if (matches.length === 0) {
        return null;
    }
    return matches
        .map((m) => m[1].toLowerCase() as VersionLevel)
        .reduce((max, level) => (LEVEL_RANK[level] > LEVEL_RANK[max] ? level : max), 'patch');
}

/** 取较大等级 */
function maxLevel(a: VersionLevel, b: VersionLevel): VersionLevel {
    return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

/** 短哈希 */
function shortHash(hash: string): string {
    return hash.slice(0, 7);
}

/** 新增 / 删除行中匹配的标识集合 */
function collectIds(lines: readonly string[] | undefined, pattern: RegExp, group = 1): Set<string> {
    const ids = new Set<string>();
    for (const line of lines ?? []) {
        const match = pattern.exec(line);
        if (match?.[group]) {
            ids.add(match[group]);
        }
    }
    return ids;
}

/** 集合差：left - right */
function subtract(left: Set<string>, right: Set<string>): string[] {
    return [...left].filter((id) => !right.has(id));
}

/** 路径是否为技能模板 */
function isWorkflowTemplate(filePath: string): boolean {
    return /^src\/core\/templates\/workflows\/[^/]+\.ts$/.test(filePath);
}

/** 路径是否为 CLI 命令模块 */
function isCommandModule(filePath: string): boolean {
    return /^src\/commands\/[^/]+\.ts$/.test(filePath);
}

/** CHANGELOG 小节下是否有实际条目（`### Added` 之类） */
function hasChangelogEntries(body: string, heading: string): boolean {
    const lines = body.split('\n');
    const start = lines.findIndex((line) => new RegExp(`^###\\s+${heading}\\b`, 'i').test(line.trim()));
    if (start === -1) {
        return false;
    }
    for (let i = start + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (/^###\s+/.test(line) || /^##\s+/.test(line)) {
            return false;
        }
        if (/^[-*]\s+\S/.test(line)) {
            return true;
        }
    }
    return false;
}

/** 从 `## [Unreleased]` 段提取正文（无该段返回空串） */
export function extractUnreleasedBody(changelog: string): string {
    const lines = changelog.split('\n');
    const start = lines.findIndex((line) => /^##\s+\[Unreleased\]\s*$/.test(line.trim()));
    if (start === -1) {
        return '';
    }
    const body: string[] = [];
    for (let i = start + 1; i < lines.length; i++) {
        if (/^##\s+\[/.test(lines[i].trim())) {
            break;
        }
        body.push(lines[i]);
    }
    return body.join('\n').trim();
}

/** 汇总提交侧信号 */
function collectCommitSignals(commits: CommitInfo[]): {
    signals: VersionSignal[];
    declared: VersionLevel | null;
} {
    const signals: VersionSignal[] = [];
    const maintenance: string[] = [];
    let declared: VersionLevel | null = null;
    const declaredConflicts = new Set<VersionLevel>();

    for (const commit of commits) {
        const conventional = parseConventionalSubject(commit.subject);
        const breaking = conventional?.breaking === true || hasBreakingFooter(commit.body);
        const trailer = releaseLevelTrailer(commit.body);
        if (trailer) {
            declaredConflicts.add(trailer);
            declared = declared ? maxLevel(declared, trailer) : trailer;
        }
        if (breaking) {
            signals.push({
                level: 'major',
                code: 'commit-breaking',
                reason: `破坏性提交：${commit.subject}`,
                evidence: [shortHash(commit.hash)],
            });
            continue;
        }
        if (conventional?.type === 'feat') {
            signals.push({
                level: 'minor',
                code: 'commit-feat',
                reason: `功能提交：${commit.subject}`,
                evidence: [shortHash(commit.hash)],
            });
            continue;
        }
        maintenance.push(shortHash(commit.hash));
    }

    if (maintenance.length > 0) {
        signals.push({
            level: 'patch',
            code: 'commit-maintenance',
            reason: `修复 / 文档 / 重构 / 测试 / 构建类提交 ${maintenance.length} 个`,
            evidence: maintenance.slice(0, 5),
        });
    }
    if (declaredConflicts.size > 1) {
        signals.push({
            level: declared ?? 'patch',
            code: 'release-level-conflict',
            reason: `提交中的 Release-Level 声明不一致（${[...declaredConflicts].join(' / ')}），取较大者`,
            evidence: [],
        });
    }
    return { signals, declared };
}

/** 汇总文件侧信号 */
function collectFileSignals(changeSet: VersionChangeSet): VersionSignal[] {
    const signals: VersionSignal[] = [];
    const added = changeSet.files.filter((file) => file.status === 'added');
    const deleted = changeSet.files.filter((file) => file.status === 'deleted');
    const renamed = changeSet.files.filter((file) => file.status === 'renamed');

    const removedTemplates = deleted.filter((file) => isWorkflowTemplate(file.path)).map((f) => f.path);
    const renamedTemplates = renamed.filter(
        (file) => isWorkflowTemplate(file.path) || isWorkflowTemplate(file.previousPath ?? '')
    );
    if (removedTemplates.length > 0 || renamedTemplates.length > 0) {
        signals.push({
            level: 'major',
            code: 'skill-template-removed',
            reason: '删除或重命名了技能模板（已安装技能名 / 指令 id 可能消失）',
            evidence: [...removedTemplates, ...renamedTemplates.map((f) => `${f.previousPath ?? '?'} → ${f.path}`)],
        });
    }
    const addedTemplates = added.filter((file) => isWorkflowTemplate(file.path)).map((f) => f.path);
    if (addedTemplates.length > 0) {
        signals.push({
            level: 'minor',
            code: 'skill-template-added',
            reason: '新增技能模板（新增可安装能力）',
            evidence: addedTemplates,
        });
    }

    const removedCommands = deleted.filter((file) => isCommandModule(file.path)).map((f) => f.path);
    if (removedCommands.length > 0) {
        signals.push({
            level: 'major',
            code: 'command-module-removed',
            reason: '删除 CLI 命令模块（命令面收缩）',
            evidence: removedCommands,
        });
    }
    const addedCommands = added.filter((file) => isCommandModule(file.path)).map((f) => f.path);
    if (addedCommands.length > 0) {
        signals.push({
            level: 'minor',
            code: 'command-module-added',
            reason: '新增 CLI 命令模块（新增命令能力）',
            evidence: addedCommands,
        });
    }

    // CLI 注册表 / 技能类型注册：新增 = 功能，移除 = 破坏
    const addedCliIds = collectIds(changeSet.addedLines?.['src/cli/index.ts'], /\.command\(\s*['"]([^'"]+)['"]/);
    const removedCliIds = collectIds(changeSet.removedLines?.['src/cli/index.ts'], /\.command\(\s*['"]([^'"]+)['"]/);
    const addedOnly = subtract(addedCliIds, removedCliIds);
    const removedOnly = subtract(removedCliIds, addedCliIds);
    if (removedOnly.length > 0) {
        signals.push({
            level: 'major',
            code: 'cli-command-removed',
            reason: '移除 CLI 命令注册（命令面不兼容变更）',
            evidence: removedOnly.map((id) => `.command('${id}')`),
        });
    }
    if (addedOnly.length > 0) {
        signals.push({
            level: 'minor',
            code: 'cli-command-added',
            reason: '新增 CLI 命令注册（新增命令能力）',
            evidence: addedOnly.map((id) => `.command('${id}')`),
        });
    }

    const addedTypes = collectIds(changeSet.addedLines?.['src/core/config.ts'], /\bid:\s*['"]([^'"]+)['"]/);
    const removedTypes = collectIds(changeSet.removedLines?.['src/core/config.ts'], /\bid:\s*['"]([^'"]+)['"]/);
    const removedTypesOnly = subtract(removedTypes, addedTypes);
    const addedTypesOnly = subtract(addedTypes, removedTypes);
    if (removedTypesOnly.length > 0) {
        signals.push({
            level: 'major',
            code: 'skill-type-removed',
            reason: '移除技能类型（类型体系不兼容变更）',
            evidence: removedTypesOnly,
        });
    }
    if (addedTypesOnly.length > 0) {
        signals.push({
            level: 'minor',
            code: 'skill-type-added',
            reason: '新增技能类型（类型体系扩展）',
            evidence: addedTypesOnly,
        });
    }

    // package.json 对外契约字段：bin / exports / main / module / types + engines.node
    const addedPkgLines = changeSet.addedLines?.['package.json'] ?? [];
    const removedPkgLines = changeSet.removedLines?.['package.json'] ?? [];
    const contractKeyRe = /^\s*"(bin|exports|main|module|types)"\s*:/;
    const removedKeys = collectIds(removedPkgLines, contractKeyRe);
    const addedKeys = collectIds(addedPkgLines, contractKeyRe);
    const removedKeysOnly = subtract(removedKeys, addedKeys);
    if (removedKeysOnly.length > 0) {
        signals.push({
            level: 'major',
            code: 'package-contract-removed',
            reason: '移除包对外契约字段（安装 / 引用入口变化）',
            evidence: removedKeysOnly,
        });
    }
    const addedKeysOnly = subtract(addedKeys, removedKeys);
    if (addedKeysOnly.length > 0) {
        signals.push({
            level: 'minor',
            code: 'package-contract-added',
            reason: '新增包对外契约字段（新增引用入口）',
            evidence: addedKeysOnly,
        });
    }
    const removedNode = extractNodeRequirement(removedPkgLines);
    const addedNode = extractNodeRequirement(addedPkgLines);
    if (removedNode !== null && addedNode !== null && addedNode > removedNode) {
        signals.push({
            level: 'major',
            code: 'engines-raised',
            reason: `Node 最低版本要求提高（${removedNode} → ${addedNode}）`,
            evidence: ['package.json engines.node'],
        });
    }

    return signals;
}

/** 从 package.json 的 engines 行提取 Node 最低主版本 */
function extractNodeRequirement(lines: readonly string[]): number | null {
    for (const line of lines) {
        if (!/"node"\s*:/.test(line)) {
            continue;
        }
        const match = /(\d+)/.exec(line);
        if (match) {
            return Number(match[1]);
        }
    }
    return null;
}

/** 汇总 CHANGELOG 侧信号 */
function collectChangelogSignals(body: string): VersionSignal[] {
    const signals: VersionSignal[] = [];
    if (hasChangelogEntries(body, 'BREAKING')) {
        signals.push({
            level: 'major',
            code: 'changelog-breaking',
            reason: 'CHANGELOG [Unreleased] 的 BREAKING 小节有条目',
            evidence: ['CHANGELOG.md'],
        });
    }
    if (hasChangelogEntries(body, 'Added')) {
        signals.push({
            level: 'minor',
            code: 'changelog-added',
            reason: 'CHANGELOG [Unreleased] 的 Added 小节有条目',
            evidence: ['CHANGELOG.md'],
        });
    }
    return signals;
}

/** 提交标题去掉 Conventional 前缀，用于 CHANGELOG 条目 */
function changelogItemSubject(commit: CommitInfo): string {
    const conventional = parseConventionalSubject(commit.subject);
    if (!conventional) {
        return commit.subject.trim();
    }
    const prefix = conventional.scope ? `**${conventional.scope}**：` : '';
    return `${prefix}${conventional.summary}`;
}

/** 按提交信息合成 CHANGELOG 正文（Unreleased 为空时使用） */
export function buildChangelogBody(options: {
    unreleasedBody: string;
    commits: CommitInfo[];
    fileCount: number;
    version: string;
}): { body: string; synthesized: boolean; warnings: string[] } {
    const unreleased = options.unreleasedBody.trim();
    if (/^[-*]\s+\S/m.test(unreleased)) {
        return { body: unreleased, synthesized: false, warnings: [] };
    }

    const breaking: string[] = [];
    const added: string[] = [];
    const changed: string[] = [];
    const fixed: string[] = [];
    for (const commit of options.commits) {
        const conventional = parseConventionalSubject(commit.subject);
        const isBreaking = conventional?.breaking === true || hasBreakingFooter(commit.body);
        const item = changelogItemSubject(commit);
        if (isBreaking) {
            breaking.push(`- ${item}`);
        } else if (conventional?.type === 'feat') {
            added.push(`- ${item}`);
        } else if (conventional?.type === 'fix' || conventional?.type === 'perf') {
            fixed.push(`- ${item}`);
        } else {
            changed.push(`- ${item}`);
        }
    }

    const sections: string[] = [];
    const pushSection = (heading: string, items: string[]): void => {
        if (items.length > 0) {
            sections.push(`### ${heading}`, '', ...items, '');
        }
    };
    pushSection('BREAKING', [...new Set(breaking)]);
    pushSection('Added', [...new Set(added)]);
    pushSection('Changed', [...new Set(changed)]);
    pushSection('Fixed', [...new Set(fixed)]);

    if (sections.length === 0) {
        sections.push(
            '### Changed',
            '',
            `- 版本更新至 ${options.version}（工作区变更 ${options.fileCount} 个文件）。`,
            ''
        );
    }

    return {
        body: sections.join('\n').trim(),
        synthesized: true,
        warnings: ['CHANGELOG [Unreleased] 为空，已按提交信息自动生成小节（请人工复核）'],
    };
}

/** 判定版本递增 */
export function analyzeVersionBump(
    currentVersion: string,
    changeSet: VersionChangeSet,
    options: AnalyzeVersionOptions = {}
): VersionAnalysis {
    if (!parseSemver(currentVersion)) {
        throw new Error(`无法解析当前版本号：${currentVersion}`);
    }
    const warnings = [...(changeSet.warnings ?? [])];
    if (changeSet.commits.length === 0 && changeSet.files.length > 0) {
        warnings.push('基线之后没有提交，仅按工作区改动与 CHANGELOG 判定');
    }

    const { signals: commitSignals, declared } = collectCommitSignals(changeSet.commits);
    const signals = [
        ...commitSignals,
        ...collectFileSignals(changeSet),
        ...collectChangelogSignals(changeSet.unreleasedChangelog ?? ''),
    ];

    const autoLevel = signals.reduce<VersionLevel>(
        (level, signal) => maxLevel(level, signal.level),
        'patch'
    );
    let level = declared === null ? autoLevel : maxLevel(autoLevel, declared);
    if (options.level) {
        level = options.level;
        if (LEVEL_RANK[options.level] < LEVEL_RANK[autoLevel]) {
            warnings.push(
                `显式指定等级 ${options.level} 低于实现影响面自动判定 ${autoLevel}，请确认不是漏判`
            );
        }
    }

    const nextVersion = bumpVersion(currentVersion, level);
    const changelog = buildChangelogBody({
        unreleasedBody: changeSet.unreleasedChangelog ?? '',
        commits: changeSet.commits,
        fileCount: changeSet.files.length,
        version: nextVersion,
    });
    warnings.push(...changelog.warnings);

    return {
        currentVersion,
        nextVersion,
        level,
        levelLabel: VERSION_LEVEL_LABELS[level],
        declaredLevel: declared,
        autoLevel,
        signals,
        baselineRef: changeSet.baselineRef,
        baselineLabel: changeSet.baselineLabel,
        commitCount: changeSet.commits.length,
        fileCount: changeSet.files.length,
        changelogBody: changelog.body,
        changelogSynthesized: changelog.synthesized,
        warnings,
    };
}

/** 写回 package.json 的 version 字段（校验当前值与预期一致） */
export function updatePackageVersion(content: string, current: string, next: string): string {
    let parsed: { version?: unknown };
    try {
        parsed = JSON.parse(content) as { version?: unknown };
    } catch {
        throw new Error('package.json 不是合法 JSON，无法写入版本号');
    }
    if (parsed.version !== current) {
        throw new Error(`package.json 版本（${String(parsed.version)}）与预期（${current}）不一致`);
    }
    const replaced = content.replace(/("version"\s*:\s*")[^"]+(")/, `$1${next}$2`);
    if (replaced === content) {
        throw new Error('package.json 缺少 version 字段，无法写入版本号');
    }
    return replaced;
}

/** 转义正则元字符 */
function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** CHANGELOG 更新结果 */
export interface ChangelogUpdateResult {
    content: string;
    warnings: string[];
}

/** 把 Unreleased 正文归档为版本小节，并同步底部链接引用 */
export function updateChangelog(options: {
    content: string;
    version: string;
    previousVersion: string;
    date: string;
    body: string;
    repositoryUrl?: string | null;
}): ChangelogUpdateResult {
    const warnings: string[] = [];
    const eol = options.content.includes('\r\n') ? '\r\n' : '\n';
    const lines = options.content.split(/\r?\n/);
    const start = lines.findIndex((line) => /^##\s+\[Unreleased\]\s*$/.test(line.trim()));
    if (start === -1) {
        throw new Error('CHANGELOG.md 缺少 [Unreleased] 小节，无法归档版本条目');
    }
    let end = start + 1;
    while (end < lines.length && !/^##\s+\[/.test(lines[end].trim())) {
        end++;
    }

    // 正文可能带混合行尾（取自 Unreleased 或按提交合成），统一为文件本来的行尾
    const body = options.body.trim().replace(/\r\n/g, '\n').split('\n').join(eol);
    const section = [`## [${options.version}] - ${options.date}`, '', body, ''];
    const updated = [...lines.slice(0, start + 1), '', ...section, ...lines.slice(end)];

    const repositoryUrl = options.repositoryUrl?.replace(/^git\+/, '').replace(/\.git$/, '');
    if (!repositoryUrl) {
        warnings.push('无法从 package.json repository 推导仓库 URL，未更新 CHANGELOG 版本链接');
        return { content: updated.join(eol), warnings };
    }
    const compareBase = `${repositoryUrl}/compare`;
    const unreleasedLine = `[Unreleased]: ${compareBase}/v${options.version}...HEAD`;
    const versionLine = `[${options.version}]: ${compareBase}/v${options.previousVersion}...v${options.version}`;
    const unreleasedIndex = updated.findIndex((line) => /^\[Unreleased\]:/.test(line.trim()));
    const versionRe = new RegExp(`^\\[${escapeRegExp(options.version)}\\]:`);

    if (unreleasedIndex === -1) {
        while (updated.length > 0 && updated[updated.length - 1].trim() === '') {
            updated.pop();
        }
        updated.push('', unreleasedLine, versionLine, '');
    } else {
        updated[unreleasedIndex] = unreleasedLine;
        if (!updated.some((line) => versionRe.test(line.trim()))) {
            updated.splice(unreleasedIndex + 1, 0, versionLine);
        }
    }
    return { content: updated.join(eol), warnings };
}

/** 同步 README 中的版本引用（仅匹配明确的版本示例，不改写历史记录） */
export function updateReadmeVersion(
    content: string,
    previousVersion: string,
    nextVersion: string
): { content: string; replacements: number } {
    let replacements = 0;
    const patterns = [
        new RegExp(`(mi-agent-tools@)${escapeRegExp(previousVersion)}(?![\\w.])`, 'g'),
        new RegExp(`(#\\s*输出\\s*)${escapeRegExp(previousVersion)}(?![\\w.])`, 'g'),
    ];
    let updated = content;
    for (const pattern of patterns) {
        updated = updated.replace(pattern, (_match, prefix: string) => {
            replacements++;
            return `${prefix}${nextVersion}`;
        });
    }
    return { content: updated, replacements };
}
