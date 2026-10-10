/**
 * 项目预扫描（venus init 的确定性步骤，非阻断）。
 *
 * 产出：ProjectScanReport + .venus/scan-baseline.json（本机产物，不入库）。
 * 用途：供 venus_tr_init_project 技能做后续五类语义扫描时参考，避免重复劳动。
 *
 * 不变量（MUST NOT 破坏）：
 *   1. 敏感值零外泄：配置项只记录键名（keys），取值在提取函数内即丢弃，
 *      报告、基线与渲染文本中 MUST NOT 出现任何配置取值
 *   2. 不输出框架结论：jar/依赖只进 candidates（带「候选」note），MUST NOT 进 signals
 *   3. 非阻断：任何失败只记入 failures 或 WARN 文本，MUST NOT 抛异常、MUST NOT 让退出码非零
 *   4. 上限具名化：MAX_SCAN_DEPTH / MAX_SCAN_FILES（MUST NOT 内联字面量）
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { ensureDir } from '../utils/file-system.js';
import { CONFIG_FILE_NAME, VENUS_DIR_NAME } from './project-config.js';

/** 目录遍历深度上限（项目根为 0，超出的层级不再遍历） */
export const MAX_SCAN_DEPTH = 8;

/** 遍历文件数上限（超出的文件不再逐个归类） */
export const MAX_SCAN_FILES = 2000;

/** 基线文件名（.venus/ 下，本机产物，不入库） */
export const SCAN_BASELINE_FILE = 'scan-baseline.json';

/** 基线文件项目相对路径（/ 分隔，供报告与 WARN 提示使用） */
export const SCAN_BASELINE_PATH = `${VENUS_DIR_NAME}/${SCAN_BASELINE_FILE}`;

/** 单个文本文件的读取上限（字节）：超过则不读内容（对应「超大非源码文件」排除） */
const MAX_TEXT_FILE_BYTES = 512 * 1024;

/** 骨架探测的最大下探层级（用于判断 src/ 下是否直挂 Java 源码） */
const SKELETON_PROBE_DEPTH = 4;

/** 构建设施 evidence 中最多列举的 target 名数量 */
const MAX_EVIDENCE_TARGETS = 8;

/** 终端报告中最多展示的依赖候选条数（其余提示看基线文件） */
const MAX_CANDIDATE_LINES = 10;

/** 依赖候选的统一 note：MUST 含「候选」语义，杜绝 jar 存在即框架在用的结论 */
const CANDIDATE_NOTE = '候选，未验证源码使用（jar 存在 ≠ 框架在用）';

/** 报告结构版本 */
const REPORT_VERSION = 1;

/**
 * 目录名排除清单：venus 自身产物目录 + 版本控制/IDE + 构建产物目录。
 * MUST 含 venus 自身产物（.claude/.venus/.codegraph/openspec），
 * 否则 .claude/skills/ 下的既有技能目录会被误报为项目信号并可能触发上限。
 */
const EXCLUDED_DIR_NAMES = new Set([
    '.git',
    '.svn',
    '.hg',
    '.idea',
    '.vscode',
    '.claude',
    '.venus',
    '.codegraph',
    'openspec',
    'node_modules',
    'dist',
    'build',
    'target',
    'out',
    'classes',
    'coverage',
    'bin',
]);

/** 依赖目录名：其内只采集 jar 候选，不做项目信号归类（三方依赖的元数据不属于本项目） */
const DEPENDENCY_DIR_NAMES = new Set([
    'lib',
    'libs',
    'jars',
    'vendor',
    'thirdparty',
    'third-party',
    'third_party',
    'deps',
    'ext',
]);

/** 文件扩展名排除清单：日志、归档、二进制与图像等非源码文件（内容一律不读取） */
const EXCLUDED_FILE_EXTENSIONS = new Set([
    '.log',
    '.gz',
    '.zip',
    '.rar',
    '.7z',
    '.tar',
    '.war',
    '.ear',
    '.class',
    '.exe',
    '.dll',
    '.so',
    '.dylib',
    '.o',
    '.obj',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.ico',
    '.bmp',
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
]);

/**
 * 构建标志文件 → 构建设施名（四种平权受理，任一存在即独立记为一项，不假设默认值）。
 * 实测：被测项目可能全部为 Ant + build.xml，MUST NOT 因缺 pom.xml 而报缺失或失败。
 */
const BUILD_FILE_LABELS: Record<string, string> = {
    'build.xml': 'Ant',
    'pom.xml': 'Maven',
    'build.gradle': 'Gradle',
    'package.json': 'npm',
};

/** 路由声明文件名（精确匹配，小写比较） */
const ROUTE_FILE_NAMES = new Set(['web.xml', 'struts-config.xml']);

/** 路由映射文件后缀（如 *-mappings.xml） */
const ROUTE_MAPPINGS_SUFFIX = '-mappings.xml';

/** 配置文件扩展名（key=value 形态） */
const CONFIG_EXTENSIONS = new Set(['.properties', '.cfg', '.ini', '.conf']);

/** 结构化的连接/认证配置文件名线索（XML/YAML 形态据此判定；jdbc 由 db 覆盖、config 由 conf 覆盖） */
const CONFIG_NAME_HINT =
    /(db|database|datasource|conf|application|auth|secur|ldap|mail|smtp|redis|mq|sso|login|connection|pool)/i;

/** 文档存在性探测的文件（项目根相对路径） */
const DOC_PROBE_FILES = ['AGENTS.md', 'CLAUDE.md', 'README.md'];

/** 文档存在性探测的目录（项目根相对路径） */
const DOC_PROBE_DIRS = ['docs'];

/** 可携带结构化技术栈声明的文档（context 段） */
const STRUCTURED_DOC_PATHS = [CONFIG_FILE_NAME.replaceAll('\\', '/'), 'openspec/config.yaml'];

/** properties 键名（只捕获键名，取值不进入捕获组，从正则层面杜绝取值外泄） */
const PROPERTY_KEY_RE = /^\s*([A-Za-z0-9_.\-[\]]+)\s*[=:]/;

/** XML 键名属性（name / key 属性的取值即键名） */
const XML_KEY_ATTRIBUTE_RE = /\b(?:name|key)\s*=\s*["']([^"']+)["']/gi;

/** XML 叶子元素（元素名即键名，元素文本内容不进入捕获组） */
const XML_LEAF_ELEMENT_RE = /<([A-Za-z_][\w.\-]*)(?:\s[^>]*)?>([^<]+)<\/\1\s*>/g;

/** 同配置多环境变体的文件名后缀（如 database.xml.bak / config.xml.gzdx） */
const VARIANT_SUFFIX_RE = /\.(?:bak|bak\d|old|orig|tmp|save|gzdx|copy)+$/i;

/** 同配置多环境变体的文件名中缀（如 database_bss.xml / jdbc_mysql.properties） */
const VARIANT_INFIX_RE = /_(?:bss|idc|mysql|gzdx|prod|prd|test|dev|uat|sit|bak|old|new)$/i;

/**
 * 同配置多环境变体的「扩展名之后」环境后缀（如 DataBase.properties_bss / config.xml_idc）。
 *
 * 真实项目（Venus4A 等）实际使用的正是该形态：`DataBase.properties_bss`、`_idc`、`_mysql`、`.gzdx`。
 * 若只识别中缀与 `.bak` 类后缀，这类变体会被当作「不认识的扩展名」静默忽略（既不合并、也不报失败），
 * 导致多个含凭据键的副本各自游离在信号集之外。
 */
const VARIANT_ENV_TAIL_RE = /_(?:bss|idc|mysql|gzdx|prod|prd|test|dev|uat|sit|bak|old|new)$/i;

/** 项目扫描报告（见契约 C1） */
export interface ProjectScanReport {
    version: 1;
    /** 扫描时间（ISO） */
    scannedAt: string;
    /** 扫描范围（实际遍历到的目录数 / 文件数） */
    scope: { dirs: number; files: number };
    /** 上限触达情况（hit=true 时 detail 说明「上限所致」） */
    limits: { hit: boolean; detail: string };
    /** 确定性信号（只含事实，不含取值、不含框架结论） */
    signals: {
        build: { file: string; evidence?: string }[];
        skeleton: { path: string; shape: string }[];
        /** 只有 keys，无 value —— 类型层杜绝配置取值外泄 */
        config: { file: string; keys: string[] }[];
        routes: { file: string }[];
        docs: { path: string; structured?: string }[];
    };
    /** 依赖候选（未验证源码使用，MUST NOT 进 signals） */
    candidates: { kind: string; name: string; note: string }[];
    /** 失败项（MUST NOT 空 catch 吞异常，原因须落此处或 WARN 文本） */
    failures: { target: string; reason: string }[];
}

/** scanProject 选项（限额可注入以便测试） */
export interface ScanOptions {
    /** 目录深度上限（默认 MAX_SCAN_DEPTH） */
    maxDepth?: number;
    /** 文件数上限（默认 MAX_SCAN_FILES） */
    maxFiles?: number;
    /** 是否写出基线文件（默认 true；--no-scan 时由调用方置 false） */
    writeBaseline?: boolean;
}

/** 基线写出结果（失败只返回 WARN 结果，不抛出） */
export interface BaselineWriteResult {
    /** 基线文件项目相对路径 */
    path: string;
    state: 'written' | 'failed';
    /** state=failed 时的原因说明 */
    warning?: string;
}

/** 同配置的变体聚合（同配置的多环境派生文件合并为一项） */
interface ConfigVariant {
    /** 当前选中的代表文件（优先规范命名，其次字典序最小） */
    file: string;
    /** 代表文件是否为规范命名（无变体缀） */
    primary: boolean;
    /** 键名并集 */
    keys: Set<string>;
}

/** 遍历过程中的可变累加器 */
interface ScanSink {
    report: ProjectScanReport;
    limits: { maxDepth: number; maxFiles: number };
    configVariants: Map<string, ConfigVariant>;
    jarNames: Set<string>;
    depthLimited: boolean;
    filesLimited: boolean;
}

/** 提取错误信息文本（失败原因须可读，禁止吞异常） */
function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/** 判断 fs 错误是否为「目标不存在」（不存在属正常情况，不记为失败） */
function isMissingError(error: unknown): boolean {
    return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

/** 目录存在性探测：不存在返回 false；探测异常记入 failures 并返回 false（不抛出） */
function isDirectory(target: string, relPath: string, sink: ScanSink): boolean {
    try {
        return fs.statSync(target).isDirectory();
    } catch (error) {
        if (!isMissingError(error)) {
            sink.report.failures.push({ target: relPath, reason: `目录探测失败：${errorMessage(error)}` });
        }
        return false;
    }
}

/** 文件存在性探测：不存在返回 false；探测异常记入 failures 并返回 false（不抛出） */
function isFile(target: string, relPath: string, sink: ScanSink): boolean {
    try {
        return fs.statSync(target).isFile();
    } catch (error) {
        if (!isMissingError(error)) {
            sink.report.failures.push({ target: relPath, reason: `文件探测失败：${errorMessage(error)}` });
        }
        return false;
    }
}

/**
 * 读取文本文件内容：超过单文件上限（超大非源码文件）或读取失败时返回 undefined。
 * 失败原因记入 failures，MUST NOT 静默吞掉。
 */
function readTextIfSmall(target: string, relPath: string, sink: ScanSink): string | undefined {
    try {
        const stat = fs.statSync(target);
        if (stat.size > MAX_TEXT_FILE_BYTES) {
            sink.report.failures.push({
                target: relPath,
                reason: `超过单文件读取上限（${MAX_TEXT_FILE_BYTES} 字节），已跳过内容提取`,
            });
            return undefined;
        }
    } catch (error) {
        if (!isMissingError(error)) {
            sink.report.failures.push({ target: relPath, reason: `文件状态读取失败：${errorMessage(error)}` });
        }
        return undefined;
    }
    try {
        return fs.readFileSync(target, 'utf8');
    } catch (error) {
        sink.report.failures.push({ target: relPath, reason: `文件读取失败：${errorMessage(error)}` });
        return undefined;
    }
}

/** 构建设施 evidence：Ant 解析 default 与 target 名；其余只给形态说明（不推断框架） */
function describeBuildFile(kind: string, absFile: string, relPath: string, sink: ScanSink): string {
    if (kind !== 'Ant') {
        return kind === 'Maven' ? 'Maven 构建描述文件' : kind === 'Gradle' ? 'Gradle 构建脚本' : 'npm 包描述文件';
    }
    const content = readTextIfSmall(absFile, relPath, sink);
    if (content === undefined) {
        return 'Ant 构建脚本';
    }
    const targets: string[] = [];
    for (const match of content.matchAll(/<target\b[^>]*\bname\s*=\s*["']([^"']+)["']/g)) {
        targets.push(match[1]);
    }
    const defaultMatch = /<project\b[^>]*\bdefault\s*=\s*["']([^"']+)["']/.exec(content);
    const parts: string[] = [];
    if (defaultMatch !== null) {
        parts.push(`default=${defaultMatch[1]}`);
    }
    if (targets.length > 0) {
        const shown = targets.slice(0, MAX_EVIDENCE_TARGETS).join('、');
        parts.push(`target ${targets.length} 个：${shown}`);
    }
    return parts.length > 0 ? `Ant 构建脚本（${parts.join('；')}）` : 'Ant 构建脚本';
}

/** 判断是否为路由声明文件 */
function isRoutesFile(lowerName: string): boolean {
    return ROUTE_FILE_NAMES.has(lowerName) || lowerName.endsWith(ROUTE_MAPPINGS_SUFFIX);
}

/**
 * 路由声明条目：web.xml 需确认为 web 部署描述符（含 <web-app / servlet-mapping / url-pattern）；
 * struts-config.xml 与 *-mappings.xml 由文件名直接判定。
 */
function routeEntryFor(
    absFile: string,
    relPath: string,
    lowerName: string,
    sink: ScanSink
): { file: string } | undefined {
    if (lowerName !== 'web.xml') {
        return { file: relPath };
    }
    const content = readTextIfSmall(absFile, relPath, sink);
    if (content === undefined) {
        return { file: relPath };
    }
    return /<web-app|servlet-mapping|url-pattern/i.test(content) ? { file: relPath } : undefined;
}

/** 规范化配置文件名：剥离多环境变体缀，得到归并键（如 database_bss.xml → database.xml） */
function configBaseName(lowerName: string): string {
    // 先剥离「扩展名之后」的环境后缀（真实项目常见形态，如 database.properties_bss）。
    // 仅当剥离后仍以已知配置扩展名结尾时才剥离，避免误伤普通文件名。
    const envStripped = lowerName.replace(VARIANT_ENV_TAIL_RE, '');
    const candidate =
        envStripped !== lowerName && CONFIG_EXTENSIONS.has(path.extname(envStripped)) ? envStripped : lowerName;
    let stem = candidate.replace(VARIANT_SUFFIX_RE, '');
    const ext = path.extname(stem);
    stem = ext === '' ? stem : stem.slice(0, stem.length - ext.length);
    return `${stem.replace(VARIANT_INFIX_RE, '')}${ext}`;
}

/** 判断是否为需要提取键名的配置文件 */
function isConfigCandidate(lowerName: string): boolean {
    if (BUILD_FILE_LABELS[lowerName] !== undefined || isRoutesFile(lowerName)) {
        return false;
    }
    const ext = path.extname(configBaseName(lowerName));
    if (CONFIG_EXTENSIONS.has(ext)) {
        return true;
    }
    return (ext === '.xml' || ext === '.yaml' || ext === '.yml') && CONFIG_NAME_HINT.test(lowerName);
}

/** 提取 properties 形态键名（# / ! 为注释；取值不捕获，提取即丢弃） */
function extractPropertyKeys(content: string): string[] {
    const keys: string[] = [];
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('!')) {
            continue;
        }
        const match = PROPERTY_KEY_RE.exec(line);
        if (match === null) {
            continue;
        }
        const key = match[1].trim();
        if (key !== '' && !keys.includes(key)) {
            keys.push(key);
        }
    }
    return keys;
}

/** 提取 XML 形态键名（name/key 属性 + 叶子元素名；元素文本与属性值一律不保留） */
function extractXmlKeys(content: string): string[] {
    const keys: string[] = [];
    for (const match of content.matchAll(XML_KEY_ATTRIBUTE_RE)) {
        const key = match[1].trim();
        if (key !== '' && !keys.includes(key)) {
            keys.push(key);
        }
    }
    for (const match of content.matchAll(XML_LEAF_ELEMENT_RE)) {
        if (!keys.includes(match[1])) {
            keys.push(match[1]);
        }
    }
    return keys;
}

/** 按扩展名分派键名提取；提取函数内即丢弃取值，返回的只有键名 */
function extractConfigKeys(content: string, lowerName: string): string[] {
    const ext = path.extname(configBaseName(lowerName));
    return CONFIG_EXTENSIONS.has(ext) ? extractPropertyKeys(content) : extractXmlKeys(content);
}

/** 收集单个配置文件的键名，并按「同配置多环境变体」归并到一项 */
function collectConfigKeys(absFile: string, relPath: string, lowerName: string, sink: ScanSink): void {
    const content = readTextIfSmall(absFile, relPath, sink);
    if (content === undefined) {
        return;
    }
    const keys = extractConfigKeys(content, lowerName);
    if (keys.length === 0) {
        return;
    }
    const base = configBaseName(lowerName);
    const dir = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')) : '';
    const groupKey = dir === '' ? base : `${dir}/${base}`;
    const isPrimary = lowerName === base;
    const variant = sink.configVariants.get(groupKey) ?? { file: relPath, primary: false, keys: new Set<string>() };
    if (isPrimary && !variant.primary) {
        variant.primary = true;
        variant.file = relPath;
    } else if (isPrimary === variant.primary && relPath < variant.file) {
        variant.file = relPath;
    }
    for (const key of keys) {
        variant.keys.add(key);
    }
    sink.configVariants.set(groupKey, variant);
}

/** 由 jar 文件名提取依赖名（剥离 .jar 与版本号后缀） */
function jarNameFrom(fileName: string): string {
    const stem = fileName.slice(0, fileName.length - '.jar'.length);
    return stem.replace(/-\d[\w.]*$/, '');
}

/** 单文件归类：构建设施 / 路由声明 / 配置文件 / jar 候选（依赖目录内只取 jar） */
function classifyFile(
    absDir: string,
    relPath: string,
    name: string,
    inDependency: boolean,
    sink: ScanSink
): void {
    const lowerName = name.toLowerCase();
    if (lowerName.endsWith('.jar')) {
        const jarName = jarNameFrom(name);
        if (jarName !== '') {
            sink.jarNames.add(jarName);
        }
        if (inDependency) {
            return;
        }
    }
    if (inDependency) {
        return;
    }
    if (EXCLUDED_FILE_EXTENSIONS.has(path.extname(lowerName))) {
        return;
    }
    const absFile = path.join(absDir, name);
    const buildKind = BUILD_FILE_LABELS[lowerName];
    if (buildKind !== undefined) {
        const entry: { file: string; evidence?: string } = { file: relPath };
        entry.evidence = describeBuildFile(buildKind, absFile, relPath, sink);
        sink.report.signals.build.push(entry);
    }
    if (isRoutesFile(lowerName)) {
        const route = routeEntryFor(absFile, relPath, lowerName, sink);
        if (route !== undefined) {
            sink.report.signals.routes.push(route);
        }
    }
    if (isConfigCandidate(lowerName)) {
        collectConfigKeys(absFile, relPath, lowerName, sink);
    }
}

/** 递归遍历目录：排除清单优先，深度与文件数受具名上限约束，失败记入 failures */
function walkDir(absDir: string, relDir: string, depth: number, inDependency: boolean, sink: ScanSink): void {
    if (sink.filesLimited) {
        return;
    }
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch (error) {
        sink.report.failures.push({
            target: relDir === '' ? '.' : relDir,
            reason: `目录读取失败：${errorMessage(error)}`,
        });
        return;
    }
    sink.report.scope.dirs++;
    for (const entry of entries) {
        const relPath = relDir === '' ? entry.name : `${relDir}/${entry.name}`;
        if (entry.isDirectory()) {
            const dirName = entry.name.toLowerCase();
            if (EXCLUDED_DIR_NAMES.has(dirName)) {
                continue;
            }
            if (depth + 1 > sink.limits.maxDepth) {
                sink.depthLimited = true;
                continue;
            }
            walkDir(
                path.join(absDir, entry.name),
                relPath,
                depth + 1,
                inDependency || DEPENDENCY_DIR_NAMES.has(dirName),
                sink
            );
            continue;
        }
        if (!entry.isFile()) {
            continue;
        }
        if (sink.report.scope.files >= sink.limits.maxFiles) {
            sink.filesLimited = true;
            continue;
        }
        sink.report.scope.files++;
        classifyFile(absDir, relPath, entry.name, inDependency, sink);
    }
}

/** src/ 下（限定层级内）是否存在 Java 源码：用于识别「源码根直挂」骨架 */
function containsJavaWithin(absDir: string, relDir: string, depth: number, sink: ScanSink): boolean {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch (error) {
        if (!isMissingError(error)) {
            sink.report.failures.push({ target: relDir, reason: `目录读取失败：${errorMessage(error)}` });
        }
        return false;
    }
    for (const entry of entries) {
        const relPath = `${relDir}/${entry.name}`;
        if (entry.isFile()) {
            if (entry.name.toLowerCase().endsWith('.java')) {
                return true;
            }
            continue;
        }
        if (!entry.isDirectory() || EXCLUDED_DIR_NAMES.has(entry.name.toLowerCase())) {
            continue;
        }
        if (depth + 1 <= SKELETON_PROBE_DEPTH &&
            containsJavaWithin(path.join(absDir, entry.name), relPath, depth + 1, sink)) {
            return true;
        }
    }
    return false;
}

/** 骨架探测：识别 src/main/java 标准根与 src/ 直挂两种形态 */
function probeSkeleton(projectRoot: string, sink: ScanSink): void {
    const standardRoot = 'src/main/java';
    const hasStandardRoot = isDirectory(path.join(projectRoot, 'src', 'main', 'java'), standardRoot, sink);
    if (hasStandardRoot) {
        sink.report.signals.skeleton.push({ path: standardRoot, shape: '标准源码根（Java 源码在 src/main/java 下）' });
    }
    const srcDir = path.join(projectRoot, 'src');
    if (!hasStandardRoot && isDirectory(srcDir, 'src', sink) && containsJavaWithin(srcDir, 'src', 1, sink)) {
        sink.report.signals.skeleton.push({ path: 'src', shape: '源码根直挂（Java 源码在 src/ 下）' });
    }
}

/** 识别文档内的结构化技术栈声明（context 缩进块非空） */
function describeStructuredDeclaration(content: string): string | undefined {
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
        if (!/^context:\s*\|/.test(lines[index])) {
            continue;
        }
        let cursor = index + 1;
        let hasText = false;
        while (cursor < lines.length && (lines[cursor].startsWith('  ') || lines[cursor].trim() === '')) {
            if (lines[cursor].trim() !== '') {
                hasText = true;
            }
            cursor++;
        }
        if (hasText) {
            return '结构化技术栈声明（高可靠：context 段，供后续扫描直接引用）';
        }
    }
    return undefined;
}

/** 文档存在性探测（含结构化技术栈声明识别，结果进入 signals.docs） */
function probeDocs(projectRoot: string, sink: ScanSink): void {
    for (const relPath of DOC_PROBE_FILES) {
        if (isFile(path.join(projectRoot, relPath), relPath, sink)) {
            sink.report.signals.docs.push({ path: relPath });
        }
    }
    for (const relPath of DOC_PROBE_DIRS) {
        if (isDirectory(path.join(projectRoot, relPath), relPath, sink)) {
            sink.report.signals.docs.push({ path: `${relPath}/` });
        }
    }
    for (const relPath of STRUCTURED_DOC_PATHS) {
        const target = path.join(projectRoot, relPath);
        if (!isFile(target, relPath, sink)) {
            continue;
        }
        const entry: { path: string; structured?: string } = { path: relPath };
        const content = readTextIfSmall(target, relPath, sink);
        if (content !== undefined) {
            const structured = describeStructuredDeclaration(content);
            if (structured !== undefined) {
                entry.structured = structured;
            }
        }
        sink.report.signals.docs.push(entry);
    }
}

/** 归并配置项：同配置的多环境变体只保留一项，键名为变体并集 */
function flushConfigVariants(sink: ScanSink): void {
    const entries: { file: string; keys: string[] }[] = [];
    for (const variant of sink.configVariants.values()) {
        entries.push({ file: variant.file, keys: [...variant.keys].sort() });
    }
    entries.sort((left, right) => (left.file < right.file ? -1 : left.file > right.file ? 1 : 0));
    sink.report.signals.config.push(...entries);
}

/** 归并依赖候选：按名去重排序，note 统一带「候选」语义 */
function flushCandidates(sink: ScanSink): void {
    for (const name of [...sink.jarNames].sort()) {
        sink.report.candidates.push({ kind: 'jar', name, note: CANDIDATE_NOTE });
    }
}

/** 上限说明文本（区分「上限所致」，便于与真实失败区分） */
function limitDetail(sink: ScanSink): string {
    const parts: string[] = [];
    if (sink.depthLimited) {
        parts.push(`目录深度已达 MAX_SCAN_DEPTH=${sink.limits.maxDepth}（更深层目录未遍历）`);
    }
    if (sink.filesLimited) {
        parts.push(`文件数已达 MAX_SCAN_FILES=${sink.limits.maxFiles}（其余文件未归类）`);
    }
    return parts.length === 0 ? '未触达扫描上限' : `上限所致：${parts.join('；')}`;
}

/** 新建空报告（--no-scan 时作为占位，保证 InitResult.scanReport 始终存在） */
export function createEmptyScanReport(): ProjectScanReport {
    return {
        version: REPORT_VERSION,
        scannedAt: new Date().toISOString(),
        scope: { dirs: 0, files: 0 },
        limits: { hit: false, detail: '未触达扫描上限' },
        signals: { build: [], skeleton: [], config: [], routes: [], docs: [] },
        candidates: [],
        failures: [],
    };
}

/**
 * 项目预扫描（确定性，非阻断）。
 *
 * @param projectRoot - 项目根目录
 * @param options - 选项（maxDepth / maxFiles 限额可注入；writeBaseline 默认写出基线）
 * @returns 扫描报告（失败只记入 failures，MUST NOT 抛出）
 */
export function scanProject(projectRoot: string, options: ScanOptions = {}): ProjectScanReport {
    const report = createEmptyScanReport();
    const sink: ScanSink = {
        report,
        limits: { maxDepth: options.maxDepth ?? MAX_SCAN_DEPTH, maxFiles: options.maxFiles ?? MAX_SCAN_FILES },
        configVariants: new Map<string, ConfigVariant>(),
        jarNames: new Set<string>(),
        depthLimited: false,
        filesLimited: false,
    };

    walkDir(projectRoot, '', 0, false, sink);
    probeSkeleton(projectRoot, sink);
    probeDocs(projectRoot, sink);
    flushConfigVariants(sink);
    flushCandidates(sink);
    report.limits = {
        hit: sink.depthLimited || sink.filesLimited,
        detail: limitDetail(sink),
    };

    // 基线写出：整体覆盖（无陈旧事实残留）；失败仅记入 failures，不中断、不抛出
    if (options.writeBaseline !== false) {
        const written = writeScanBaseline(projectRoot, report);
        if (written.state === 'failed') {
            report.failures.push({ target: written.path, reason: written.warning ?? '基线写入失败' });
        }
    }
    return report;
}

/**
 * 写出扫描基线（.venus/scan-baseline.json，整体覆盖）。
 * 写入失败只返回 WARN 结果，MUST NOT 抛出、MUST NOT 中断调用方。
 *
 * @param projectRoot - 项目根目录
 * @param report - 扫描报告
 * @returns 写出结果（state=failed 时 warning 含失败原因）
 */
export function writeScanBaseline(projectRoot: string, report: ProjectScanReport): BaselineWriteResult {
    const target = path.join(projectRoot, VENUS_DIR_NAME, SCAN_BASELINE_FILE);
    try {
        ensureDir(path.join(projectRoot, VENUS_DIR_NAME));
        fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
        return { path: SCAN_BASELINE_PATH, state: 'written' };
    } catch (error) {
        return {
            path: SCAN_BASELINE_PATH,
            state: 'failed',
            warning: `基线写入失败（已跳过，不影响 init 主流程）：${errorMessage(error)}`,
        };
    }
}

/** 列表渲染：空列表显示「未探测到」 */
function listOrNone(items: string[]): string {
    return items.length === 0 ? '未探测到' : items.join('、');
}

/**
 * 渲染非阻断终端报告（由 CLI 打印，风格对齐 renderDependencyReport）。
 * 只渲染键名与路径事实，MUST NOT 出现任何配置取值。
 *
 * @param report - scanProject 返回的报告
 * @returns 渲染结果（不含尾随换行）
 */
export function renderScanReport(report: ProjectScanReport): string {
    const lines: string[] = [`  项目预扫描（非阻断，基线：${SCAN_BASELINE_PATH}）：`];
    lines.push(`    · 扫描范围：${report.scope.dirs} 个目录 / ${report.scope.files} 个文件`);
    lines.push(`    · 构建设施：${listOrNone(report.signals.build.map((item) => item.file))}`);
    for (const build of report.signals.build) {
        if (build.evidence !== undefined) {
            lines.push(`      - ${build.file}：${build.evidence}`);
        }
    }
    lines.push(`    · 源码骨架：${listOrNone(report.signals.skeleton.map((item) => `${item.path}（${item.shape}）`))}`);
    if (report.signals.config.length === 0) {
        lines.push('    · 配置键名：未探测到');
    } else {
        lines.push(`    · 配置键名：${report.signals.config.length} 项（仅键名与路径，不含取值）`);
        for (const config of report.signals.config) {
            lines.push(`      - ${config.file}（${config.keys.length} 个键）`);
        }
    }
    lines.push(`    · 路由声明：${listOrNone(report.signals.routes.map((item) => item.file))}`);
    lines.push(`    · 既有文档：${listOrNone(report.signals.docs.map((item) => item.path))}`);
    for (const doc of report.signals.docs) {
        if (doc.structured !== undefined) {
            lines.push(`      - ${doc.path}：${doc.structured}`);
        }
    }
    if (report.candidates.length === 0) {
        lines.push('    · 依赖候选：未探测到');
    } else {
        lines.push(`    ? 依赖候选（${report.candidates.length} 项，${CANDIDATE_NOTE}）：`);
        for (const candidate of report.candidates.slice(0, MAX_CANDIDATE_LINES)) {
            lines.push(`      - ${candidate.name}`);
        }
        if (report.candidates.length > MAX_CANDIDATE_LINES) {
            lines.push(`      ... 其余 ${report.candidates.length - MAX_CANDIDATE_LINES} 项见基线文件`);
        }
    }
    if (report.limits.hit) {
        lines.push(`    ! ${report.limits.detail}`);
    }
    for (const failure of report.failures) {
        lines.push(`    ! ${failure.target}：${failure.reason}`);
    }
    lines.push('    下一步：/venus:tr-init-project 基于基线生成分类文档（docs/project/）');
    return lines.join('\n');
}
