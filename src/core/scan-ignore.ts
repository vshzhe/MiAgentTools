/**
 * 忽略规则解析（预扫描的遍历入口判定）。
 *
 * 预扫描的「是否进入遍历」由三级忽略来源决定（调用方先判内置固定清单，再问本模块）：
 *   1. 内置固定目录名清单（`BUILTIN_IGNORED_DIR_NAMES`）—— 版本控制 / IDE / 构建产物 /
 *      依赖目录 / iagent 自身产物；
 *   2. 项目 ignore 文件（`.gitignore` 及其常见等价物 `.ignore` / `.iagentignore`）：
 *      根级与嵌套，嵌套规则仅在其所在子树生效；
 *   3. 「自定义 ignore 文件」即第 2 条中非 `.gitignore` 的两类文件 —— 不依赖 VCS 存在。
 *
 * 规则语义（实现边界，见变更 upgrade-workflow-efficiency 的 init-project-scan delta）：
 *   - `#` 注释行、空行忽略；
 *   - `!` 否定规则；
 *   - 尾部 `/` 表示仅匹配目录；
 *   - 前导 `/`（或模式含 `/`）相对该 ignore 文件所在目录锚定；不含 `/` 的模式按任意层级
 *     basename 匹配；
 *   - `*` 匹配单层内任意字符，`**` 跨层匹配，`?` 匹配单字符；
 *   - 未列出的语法（字符类 `[abc]`、反斜杠转义等）按「该行不产生忽略」处理（fail-open 方向）。
 *
 * 不变量：
 *   - **fail-open**：任一 ignore 文件读取/解析失败 → 该文件不生效（不过滤）、记入
 *     `warnings`（由调用方计入 `skipped.unreadable` 与报告），MUST NOT 因解析失败而漏扫；
 *   - **fail-safe 遍历**：目录被忽略但存在锚定到其子路径的否定规则时，仍进入该目录
 *     （否则 `logs/` + `!logs/keep.properties` 这类规则无法生效）；
 *   - **跨平台**：所有路径以 posix 归一（反斜杠 → `/`）后比较，文件系统访问一律 `path.join()`。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * 内置固定忽略目录名（小写比较）。
 *
 * MUST 含 iagent 自身产物（`.claude` / `.pi` / `.codex` / `.opencode` / `.iagent` /
 * `.codegraph` / `openspec`），否则安装产物会被误报为项目信号。
 * `openspec/` 进入版本控制不改变本排除语义（扫描不看 VCS 状态）。
 */
export const BUILTIN_IGNORED_DIR_NAMES: ReadonlySet<string> = new Set([
    // 版本控制 / IDE
    '.git',
    '.svn',
    '.hg',
    '.idea',
    '.vscode',
    // iagent 自身产物
    '.claude',
    '.pi',
    '.codex',
    '.opencode',
    '.iagent',
    '.codegraph',
    'openspec',
    // 依赖与构建产物
    'node_modules',
    'dist',
    'build',
    'target',
    'out',
    'classes',
    'coverage',
    'bin',
    '.next',
    '.venv',
    '.tox',
    '.gradle',
    '.nx',
    '.turbo',
    '__pycache__',
    '.mypy_cache',
    '.pytest_cache',
]);

/** 目录名是否命中内置固定忽略清单（按小写比较） */
export function isBuiltinIgnoredDirName(name: string): boolean {
    return BUILTIN_IGNORED_DIR_NAMES.has(name.toLowerCase());
}

/** 忽略规则匹配器（纯查询，无副作用；warnings 为解析期告警） */
export interface IgnoreMatcher {
    /** 判定项目相对 posix 路径是否应跳过；目录与文件同一入口 */
    ignores(relPath: string, isDir: boolean): boolean;
    /** 解析期告警（解析失败 fail-open 时记录） */
    warnings: string[];
}

/** 匹配器选项 */
export interface IgnoreMatcherOptions {
    /**
     * 是否解析 ignore 文件（默认 true）。
     *
     * `false` 时整体退化为「仅内置固定清单」（调用方仍自行判定固定清单），
     * 对应 `iagent init --no-scan-ignore`。
     */
    respectIgnoreFiles?: boolean;
    /** 参与解析的 ignore 文件名（默认 `.gitignore` / `.ignore` / `.iagentignore`） */
    ignoreFileNames?: readonly string[];
}

/** 默认 ignore 文件名：VCS 标准文件 + 不依赖 VCS 的等价物 */
const DEFAULT_IGNORE_FILE_NAMES: readonly string[] = ['.gitignore', '.ignore', '.iagentignore'];

/** 单条解析后的规则 */
interface IgnoreRule {
    /** 规则所属 ignore 文件的项目相对 posix 目录（根级为 ''） */
    base: string;
    /** 是否为否定规则（`!` 前缀） */
    negated: boolean;
    /** 是否仅匹配目录（尾部 `/`） */
    dirOnly: boolean;
    /** 已去掉 `!` / 前导 `/` / 尾部 `/` 的模式正文（供子路径否定探测复用） */
    pattern: string;
    /** 锚定（含 `/` 或前导 `/`）时为 `^...$`；否则按任意层级 basename 匹配 */
    regex: RegExp;
}

/** posix 归一（Windows 反斜杠 → `/`；去除开头的 `./`） */
function toPosix(target: string): string {
    return target.replaceAll('\\', '/').replace(/^\.\//, '');
}

/** 正则元字符转义（`*` / `?` 另行处理） */
function escapeRegexChar(char: string): string {
    return char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

/**
 * 把单行模式正文编译为匹配正则。
 *
 * @param pattern - 已去掉 `!` / 前导 `/` / 尾部 `/` 的模式
 * @param anchored - 是否相对 ignore 文件所在目录完全锚定
 */
function compilePattern(pattern: string, anchored: boolean): RegExp {
    let body = '';
    for (let index = 0; index < pattern.length; index++) {
        const char = pattern[index];
        if (char === '*') {
            if (pattern[index + 1] === '*') {
                body += '.*';
                index++;
            } else {
                body += '[^/]*';
            }
            continue;
        }
        if (char === '?') {
            body += '[^/]';
            continue;
        }
        body += escapeRegexChar(char);
    }
    return anchored ? new RegExp(`^${body}$`) : new RegExp(`(?:^|/)${body}$`);
}

/**
 * 解析单个 ignore 文件内容为规则列表。
 *
 * 未支持的语法按「该行不产生忽略」处理（fail-open），MUST NOT 抛错。
 *
 * @param content - 文件全文
 * @param base - 文件所在目录的项目相对 posix 路径（根级为 ''）
 */
function parseIgnoreContent(content: string, base: string): IgnoreRule[] {
    const rules: IgnoreRule[] = [];
    for (const rawLine of content.split(/\r?\n/)) {
        let line = rawLine.trim();
        if (line === '' || line.startsWith('#')) {
            continue;
        }
        const negated = line.startsWith('!');
        if (negated) {
            line = line.slice(1).trim();
        }
        if (line === '') {
            continue;
        }
        const dirOnly = line.endsWith('/');
        if (dirOnly) {
            line = line.slice(0, -1);
        }
        const hadLeadingSlash = line.startsWith('/');
        if (hadLeadingSlash) {
            line = line.slice(1);
        }
        if (line === '') {
            continue;
        }
        // 未支持的语法（字符类 / 反斜杠转义）：按「不产生忽略」处理（fail-open 方向）
        if (line.includes('[') || line.includes(']') || line.includes('\\')) {
            continue;
        }
        const anchored = hadLeadingSlash || line.includes('/');
        rules.push({
            base,
            negated,
            dirOnly,
            pattern: line,
            regex: compilePattern(line, anchored),
        });
    }
    return rules;
}

/** 项目相对路径相对某个 ignore 文件目录的剩余部分（不在其子树内返回 null） */
function localPathOf(base: string, relPath: string): string | null {
    if (base === '') {
        return relPath;
    }
    if (relPath === base) {
        return '';
    }
    if (!relPath.startsWith(`${base}/`)) {
        return null;
    }
    return relPath.slice(base.length + 1);
}

/**
 * 判定单条规则是否命中给定路径（含其目录前缀）。
 *
 * 目录前缀参与匹配是「被忽略目录下的条目同样被忽略」的实现方式；
 * `dirOnly` 规则只参与目录前缀（及自身为目录时）的匹配。
 */
function ruleMatches(rule: IgnoreRule, localPath: string, isDir: boolean): boolean {
    const segments = localPath.split('/').filter((segment) => segment !== '');
    if (segments.length === 0) {
        return false;
    }
    const candidates: string[] = [];
    for (let count = 1; count < segments.length; count++) {
        candidates.push(segments.slice(0, count).join('/'));
    }
    if (!rule.dirOnly || isDir) {
        candidates.push(segments.join('/'));
    }
    return candidates.some((candidate) => rule.regex.test(candidate));
}

/**
 * 目录被忽略时，判断是否存在锚定到该目录子路径的否定规则（如 `!logs/keep.properties`）。
 *
 * 该探测只覆盖「否定规则的目标路径以本目录为前缀」的情形；无法判定的场景按
 * 「不进入」处理（与 git 的父目录排除语义一致），MUST NOT 因此漏扫可判定的例外。
 */
function hasNegationUnder(rule: IgnoreRule, localPath: string): boolean {
    if (!rule.negated || !rule.pattern.includes('/')) {
        return false;
    }
    const target = rule.pattern.replace(/^\//, '');
    return target.startsWith(`${localPath}/`);
}

/**
 * 创建忽略规则匹配器。
 *
 * ignore 文件按目录**惰性加载**（首次查询到该目录时读取并缓存）：既避免为不存在的
 * 目录付出 IO，也避免在未进入的子树里误报解析告警。
 *
 * @param projectRoot - 项目根目录（绝对路径）
 * @param options - 选项（`respectIgnoreFiles=false` 时完全退化为「无忽略规则」）
 */
export function createIgnoreMatcher(
    projectRoot: string,
    options: IgnoreMatcherOptions = {}
): IgnoreMatcher {
    const warnings: string[] = [];
    const respectIgnoreFiles = options.respectIgnoreFiles !== false;
    const ignoreFileNames = options.ignoreFileNames ?? DEFAULT_IGNORE_FILE_NAMES;
    /** 目录（posix 项目相对路径）→ 该目录下各 ignore 文件的解析状态 */
    const loadedDirs = new Map<string, IgnoreRule[]>();

    /** 加载某个目录下的 ignore 文件（缓存；失败 fail-open 并记 warnings） */
    function loadDir(dirRel: string): IgnoreRule[] {
        const cached = loadedDirs.get(dirRel);
        if (cached !== undefined) {
            return cached;
        }
        const rules: IgnoreRule[] = [];
        if (respectIgnoreFiles) {
            for (const fileName of ignoreFileNames) {
                const absFile = path.join(projectRoot, dirRel, fileName);
                const displayPath = dirRel === '' ? fileName : `${dirRel}/${fileName}`;
                let content: string;
                try {
                    const stat = fs.statSync(absFile);
                    if (!stat.isFile()) {
                        continue; // 同名目录等非文件：不参与解析（也不算解析失败）
                    }
                    content = fs.readFileSync(absFile, 'utf8');
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                        continue;
                    }
                    warnings.push(
                        `${displayPath}：忽略规则文件读取失败（fail-open，未过滤）：${
                            error instanceof Error ? error.message : String(error)
                        }`
                    );
                    continue;
                }
                try {
                    // 二进制 / 损坏内容（含 NUL）不构成合法 ignore 文本：按解析失败 fail-open 处理
                    if (content.includes('\u0000')) {
                        warnings.push(
                            `${displayPath}：忽略规则解析失败（含不可解析字符，fail-open，未过滤）`
                        );
                        continue;
                    }
                    rules.push(...parseIgnoreContent(content, dirRel));
                } catch (error) {
                    warnings.push(
                        `${displayPath}：忽略规则解析失败（fail-open，未过滤）：${
                            error instanceof Error ? error.message : String(error)
                        }`
                    );
                }
            }
        }
        loadedDirs.set(dirRel, rules);
        return rules;
    }

    return {
        warnings,
        ignores(relPath: string, isDir: boolean): boolean {
            const normalized = toPosix(relPath).replace(/\/+$/, '');
            if (normalized === '') {
                return false;
            }
            // 规则作用顺序：由根到叶（浅层目录的规则先求值，深层可覆盖）
            const segments = normalized.split('/');
            const dirs: string[] = [''];
            for (let count = 1; count < segments.length; count++) {
                dirs.push(segments.slice(0, count).join('/'));
            }
            let ignored = false;
            let pendingNegationUnder = false;
            for (const dirRel of dirs) {
                const rules = loadDir(dirRel);
                if (rules.length === 0) {
                    continue;
                }
                const localPath = localPathOf(dirRel, normalized);
                if (localPath === null || localPath === '') {
                    continue;
                }
                for (const rule of rules) {
                    if (!ruleMatches(rule, localPath, isDir)) {
                        continue;
                    }
                    ignored = !rule.negated;
                    if (rule.negated) {
                        pendingNegationUnder = false;
                    }
                }
                // 供目录例外判定：后续任一锚定否定规则命中本目录的子路径时，仍进入遍历
                if (isDir) {
                    for (const rule of rules) {
                        if (hasNegationUnder(rule, localPath)) {
                            pendingNegationUnder = true;
                        }
                    }
                }
            }
            return ignored && !(isDir && pendingNegationUnder);
        },
    };
}
