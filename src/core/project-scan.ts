/**
 * 项目预扫描（iagent init 的确定性步骤，非阻断）。
 *
 * 产出：ProjectScanReport + .iagent/scan-baseline.json（本机产物，不入库）。
 * 用途：供 iagent_project_init 技能做后续五类语义扫描时参考，避免重复劳动。
 *
 * 不变量（MUST NOT 破坏）：
 *   1. 敏感值零外泄：配置项只记录键名（keys），取值在提取函数内即丢弃，
 *      报告、基线与渲染文本中 MUST NOT 出现任何配置取值
 *   2. 不输出框架结论：jar/依赖只进 candidates（带「候选」note），MUST NOT 进 signals
 *   3. 非阻断：任何失败只记入 failures / skipped / WARN 文本，
 *      MUST NOT 抛异常、MUST NOT 让退出码非零
 *   4. 无臆造上限：遍历 MUST NOT 设目录深度或文件数上限；有界性只由
 *      「忽略清单 + 忽略规则」（scan-ignore.ts）与「软超时」（默认 30s）承担
 *   5. 跳过可计数：忽略 / 软超时 / 不可读三类跳过分别计入 limits.skipped，
 *      软超时 MUST 同时出现在终端报告与基线 JSON（MUST NOT 静默）
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { ensureDir } from '../utils/file-system.js';
import { CONFIG_FILE_NAME, IAGENT_DIR_NAME } from './project-config.js';
import {
    BUILTIN_IGNORED_DIR_NAMES,
    createIgnoreMatcher,
    isBuiltinIgnoredDirName,
    type IgnoreMatcher,
} from './scan-ignore.js';

/** 基线结构版本（写入恒为 2；读取按 version 分支兼容 v1） */
export const SCAN_BASELINE_VERSION = 2;

/** 软超时默认预算（毫秒）；可经 ScanOptions.softTimeoutMs 注入（测试与配置覆盖） */
export const DEFAULT_SCAN_SOFT_TIMEOUT_MS = 30_000;

/** 基线文件名（.iagent/ 下，本机产物，不入库） */
export const SCAN_BASELINE_FILE = 'scan-baseline.json';

/** 基线文件项目相对路径（/ 分隔，供报告与 WARN 提示使用） */
export const SCAN_BASELINE_PATH = `${IAGENT_DIR_NAME}/${SCAN_BASELINE_FILE}`;

/** 单个文本文件的读取上限（字节）：超过则不读内容（对应「超大非源码文件」排除） */
const MAX_TEXT_FILE_BYTES = 512 * 1024;

/** 构建设施 evidence 中最多列举的 target 名数量 */
const MAX_EVIDENCE_TARGETS = 8;

/** 终端报告中最多展示的依赖候选条数（其余提示看基线文件） */
const MAX_CANDIDATE_LINES = 10;

/** 依赖候选的统一 note：MUST 含「候选」语义，杜绝 jar 存在即框架在用的结论 */
const CANDIDATE_NOTE = '候选，未验证源码使用（jar 存在 ≠ 框架在用）';

/**
 * 目录名排除清单：内置固定忽略目录（单一源在 scan-ignore.ts，含 iagent 自身产物目录）。
 * 保留导出供文档与既有消费方引用，值来自 `BUILTIN_IGNORED_DIR_NAMES`。
 */
export const EXCLUDED_DIR_NAMES: ReadonlySet<string> = BUILTIN_IGNORED_DIR_NAMES;

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

/**
 * 测试目录探针（按目录**名**匹配，任意层级；`src/test/java` 经 `test` 命中）。
 *
 * 只记录「存在某测试目录」这一事实，MUST NOT 据此断言测试框架。
 */
const TEST_DIR_NAMES = new Set(['test', 'tests', '__tests__', 'e2e', 'spec']);

/**
 * 测试文件名模式 → 命中计数（只做文件名匹配，MUST NOT 读取文件内容）。
 *
 * 模式名即 `signals.tests[].name` 的取值，是「观察到的事实」而非框架结论。
 */
const TEST_FILE_PATTERNS: readonly { pattern: string; regex: RegExp }[] = [
    { pattern: '*.test.*', regex: /\.test\.[^./\\]+$/i },
    { pattern: '*.spec.*', regex: /\.spec\.[^./\\]+$/i },
    { pattern: '*Test.java', regex: /Test\.java$/ },
    { pattern: '*Tests.java', regex: /Tests\.java$/ },
    { pattern: '*_test.go', regex: /_test\.go$/i },
];

/** 测试文件探针：命中即累加对应模式计数 */
function probeTestFile(name: string, sink: ScanSink): void {
    for (const { pattern, regex } of TEST_FILE_PATTERNS) {
        if (regex.test(name)) {
            sink.testFileCounts.set(pattern, (sink.testFileCounts.get(pattern) ?? 0) + 1);
        }
    }
}

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
 * 真实项目中实际出现的正是该形态：`DataBase.properties_bss`、`_idc`、`_mysql`、`.gzdx`。
 * 若只识别中缀与 `.bak` 类后缀，这类变体会被当作「不认识的扩展名」静默忽略（既不合并、也不报失败），
 * 导致多个含凭据键的副本各自游离在信号集之外。
 */
const VARIANT_ENV_TAIL_RE = /_(?:bss|idc|mysql|gzdx|prod|prd|test|dev|uat|sit|bak|old|new)$/i;

/** 跳过原因（发生顺序无关，报告与基线按固定顺序归一） */
export type ScanSkipReason = 'ignored' | 'soft-timeout' | 'unreadable';

/** 跳过原因的稳定展示顺序 */
const SKIP_REASON_ORDER: readonly ScanSkipReason[] = ['ignored', 'soft-timeout', 'unreadable'];

/** 扫描限额与跳过统计（v2 契约） */
export interface ScanLimitsV2 {
    /** 本次扫描是否发生过任一跳过（忽略 / 软超时 / 不可读） */
    hit: boolean;
    /** 人读文案；hit=false 时为固定中性文案 */
    detail: string;
    /** 跳过原因集合（去重、按发生顺序） */
    reasons: ScanSkipReason[];
    /** 软超时预算与是否发生受控停止 */
    softTimeout: { ms: number; exceeded: boolean };
    /** 按原因分类的跳过量 */
    skipped: { ignored: number; timeout: number; unreadable: number };
}

/** 项目扫描报告（v2 为写入结构；读取时 v1 归一为同一形状） */
export interface ProjectScanReport {
    version: typeof SCAN_BASELINE_VERSION;
    /** 扫描时间（ISO） */
    scannedAt: string;
    /** 扫描范围（实际遍历到的目录数 / 文件数；忽略项不计入） */
    scope: { dirs: number; files: number };
    /** 限额与跳过统计（v2） */
    limits: ScanLimitsV2;
    /** 确定性信号（只含事实，不含取值、不含框架结论） */
    signals: {
        build: { file: string; evidence?: string }[];
        skeleton: { path: string; shape: string }[];
        /** 只有 keys，无 value —— 类型层杜绝配置取值外泄 */
        config: { file: string; keys: string[] }[];
        routes: { file: string }[];
        docs: { path: string; structured?: string }[];
        /**
         * 测试探针（只记目录名 / 文件名模式与计数，MUST NOT 读取测试代码内容）。
         *
         * - `test-dir`：`name` 为目录相对路径，`count` 固定 1；
         * - `test-files`：`name` 为文件名模式（如 `*Test.java`），`count` 为命中计数。
         *
         * 无测试代码时为空数组（无内容即 NULL 语义），MUST NOT 输出「项目使用某测试框架」结论。
         * 软超时导致未完成计数时，截断事实由 `limits.softTimeout.exceeded` 与
         * `limits.skipped.timeout` 承载（MUST NOT 新增字段）。
         */
        tests: { kind: 'test-dir' | 'test-files'; name: string; count: number }[];
    };
    /** 依赖候选（未验证源码使用，MUST NOT 进 signals） */
    candidates: { kind: string; name: string; note: string }[];
    /** 失败项（MUST NOT 空 catch 吞异常，原因须落此处或 WARN 文本） */
    failures: { target: string; reason: string }[];
}

/** scanProject 选项（预算、忽略开关与时钟可注入以便测试） */
export interface ScanOptions {
    /** 是否写出基线文件（默认 true；--no-scan 时由调用方置 false） */
    writeBaseline?: boolean;
    /** 软超时预算（毫秒；默认 DEFAULT_SCAN_SOFT_TIMEOUT_MS） */
    softTimeoutMs?: number;
    /** 是否解析 ignore 文件（默认 true；false 时只用内置固定忽略清单） */
    respectIgnoreFiles?: boolean;
    /** 可注入时钟（软超时判定可测） */
    now?: () => number;
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
    /** 忽略规则匹配器（respectIgnoreFiles=false 时其 ignores 恒为 false） */
    matcher: IgnoreMatcher;
    /** 可注入时钟 */
    now: () => number;
    /** 软超时截止时刻（epoch ms） */
    deadline: number;
    configVariants: Map<string, ConfigVariant>;
    jarNames: Set<string>;
    /** 测试文件名模式 → 命中计数（模式名如 `*Test.java`） */
    testFileCounts: Map<string, number>;
    /** 已记入 failures 的 matcher 告警数（避免重复计数） */
    syncedWarnings: number;
}

/** 提取错误信息文本（失败原因须可读，禁止吞异常） */
function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/** 判断 fs 错误是否为「目标不存在」（不存在属正常情况，不记为失败） */
function isMissingError(error: unknown): boolean {
    return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

/** 记录跳过原因（去重；最终按固定顺序输出） */
function addReason(sink: ScanSink, reason: ScanSkipReason): void {
    if (!sink.report.limits.reasons.includes(reason)) {
        sink.report.limits.reasons.push(reason);
    }
}

/** 记入「不可读」：failures 明细 + skipped.unreadable 计数 + 原因集合 */
function recordUnreadable(sink: ScanSink, target: string, reason: string): void {
    sink.report.failures.push({ target, reason });
    sink.report.limits.skipped.unreadable++;
    addReason(sink, 'unreadable');
}

/** 记录「忽略」跳过一项 */
function recordIgnored(sink: ScanSink): void {
    sink.report.limits.skipped.ignored++;
    addReason(sink, 'ignored');
}

/** 软超时预算是否已用尽 */
function budgetExceeded(sink: ScanSink): boolean {
    return sink.now() >= sink.deadline;
}

/**
 * 标记软超时受控停止（不记失败）。
 *
 * @param minimumSkipped - 本次停止点至少计入的未处理条目数（`exceeded=true ⇒ ≥1`）
 */
function markSoftTimeout(sink: ScanSink, minimumSkipped = 0): void {
    const limits = sink.report.limits;
    limits.softTimeout.exceeded = true;
    addReason(sink, 'soft-timeout');
    const counted = Math.max(minimumSkipped, 1);
    if (limits.skipped.timeout < counted) {
        limits.skipped.timeout = counted;
    }
}

/** 目录存在性探测：不存在返回 false；探测异常记入 failures 并返回 false（不抛出） */
function isDirectory(target: string, relPath: string, sink: ScanSink): boolean {
    try {
        return fs.statSync(target).isDirectory();
    } catch (error) {
        if (!isMissingError(error)) {
            recordUnreadable(sink, relPath, `目录探测失败：${errorMessage(error)}`);
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
            recordUnreadable(sink, relPath, `文件探测失败：${errorMessage(error)}`);
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
            recordUnreadable(sink, relPath, `文件状态读取失败：${errorMessage(error)}`);
        }
        return undefined;
    }
    try {
        return fs.readFileSync(target, 'utf8');
    } catch (error) {
        recordUnreadable(sink, relPath, `文件读取失败：${errorMessage(error)}`);
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
    if (!inDependency) {
        // 测试文件名模式探针（只匹配文件名，不读内容）
        probeTestFile(name, sink);
    }
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

/**
 * 递归遍历目录：内置固定清单 → ignore matcher → 软超时受控停止。
 * 无深度 / 文件数上限；失败记入 failures（不可读同时计入 skipped.unreadable）。
 */
function walkDir(absDir: string, relDir: string, inDependency: boolean, sink: ScanSink): void {
    if (sink.report.limits.softTimeout.exceeded) {
        return;
    }
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch (error) {
        recordUnreadable(sink, relDir === '' ? '.' : relDir, `目录读取失败：${errorMessage(error)}`);
        return;
    }
    sink.report.scope.dirs++;
    for (let index = 0; index < entries.length; index++) {
        // 软超时：到点即受控停止；本层剩余（含当前）条目按「可判定口径」逐个计入 skipped.timeout
        if (budgetExceeded(sink)) {
            markSoftTimeout(sink, entries.length - index);
            return;
        }
        const entry = entries[index];
        const relPath = relDir === '' ? entry.name : `${relDir}/${entry.name}`;
        if (entry.isDirectory()) {
            const dirName = entry.name.toLowerCase();
            if (isBuiltinIgnoredDirName(dirName) || sink.matcher.ignores(relPath, true)) {
                recordIgnored(sink);
                continue;
            }
            // 测试目录探针：只记目录存在这一事实（不读内容、不推断框架）
            if (TEST_DIR_NAMES.has(dirName)) {
                sink.report.signals.tests.push({ kind: 'test-dir', name: relPath, count: 1 });
            }
            walkDir(
                path.join(absDir, entry.name),
                relPath,
                inDependency || DEPENDENCY_DIR_NAMES.has(dirName),
                sink
            );
            continue;
        }
        if (!entry.isFile()) {
            continue;
        }
        if (sink.matcher.ignores(relPath, false)) {
            recordIgnored(sink);
            continue;
        }
        sink.report.scope.files++;
        classifyFile(absDir, relPath, entry.name, inDependency, sink);
    }
}

/**
 * src/ 下（无深度上限，受同一软超时与忽略规则约束）是否存在 Java 源码：
 * 用于识别「源码根直挂」骨架。命中即停，不引入第二套上限常量。
 */
function containsJavaWithin(absDir: string, relDir: string, sink: ScanSink): boolean {
    if (sink.report.limits.softTimeout.exceeded) {
        return false;
    }
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch (error) {
        if (!isMissingError(error)) {
            recordUnreadable(sink, relDir, `目录读取失败：${errorMessage(error)}`);
        }
        return false;
    }
    for (const entry of entries) {
        if (budgetExceeded(sink)) {
            markSoftTimeout(sink);
            return false;
        }
        const relPath = `${relDir}/${entry.name}`;
        if (entry.isFile()) {
            if (entry.name.toLowerCase().endsWith('.java')) {
                return true;
            }
            continue;
        }
        if (!entry.isDirectory()) {
            continue;
        }
        const dirName = entry.name.toLowerCase();
        // 探测阶段不重复计入 ignored（主遍历已计数），只决定是否下探
        if (isBuiltinIgnoredDirName(dirName) || sink.matcher.ignores(relPath, true)) {
            continue;
        }
        if (containsJavaWithin(path.join(absDir, entry.name), relPath, sink)) {
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
    if (!hasStandardRoot && isDirectory(srcDir, 'src', sink) && containsJavaWithin(srcDir, 'src', sink)) {
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
        // 忽略规则同样作用于文档目录探针（如 .gitignore 忽略 docs/ 时不记为既有文档）
        if (sink.matcher.ignores(relPath, true)) {
            continue;
        }
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

/** 归并测试文件名模式计数（按模式名排序，仅保留命中项） */
function flushTestFileCounts(sink: ScanSink): void {
    for (const pattern of [...sink.testFileCounts.keys()].sort()) {
        sink.report.signals.tests.push({
            kind: 'test-files',
            name: pattern,
            count: sink.testFileCounts.get(pattern) ?? 0,
        });
    }
}

/** 把 matcher 的解析期告警补记为 failures（计入 skipped.unreadable），避免重复计数 */
function syncMatcherWarnings(sink: ScanSink): void {
    while (sink.syncedWarnings < sink.matcher.warnings.length) {
        const warning = sink.matcher.warnings[sink.syncedWarnings];
        sink.syncedWarnings++;
        const separator = warning.indexOf('：');
        const target = separator > 0 ? warning.slice(0, separator) : 'ignore 规则';
        recordUnreadable(sink, target, warning);
    }
}

/** 上限说明文本（按原因分类，供人读；hit=false 时为固定中性文案） */
function buildLimitDetail(report: ProjectScanReport): string {
    const { reasons, skipped, softTimeout } = report.limits;
    if (reasons.length === 0) {
        return '未发生跳过';
    }
    const parts: string[] = [];
    if (reasons.includes('ignored')) {
        parts.push(`忽略清单 / 忽略规则跳过 ${skipped.ignored} 项`);
    }
    if (reasons.includes('soft-timeout')) {
        parts.push(`因软超时跳过 ${skipped.timeout} 项（可能不完整；预算 ${softTimeout.ms}ms）`);
    }
    if (reasons.includes('unreadable')) {
        parts.push(`${skipped.unreadable} 项不可读（详见 failures）`);
    }
    return `发生跳过：${parts.join('；')}`;
}

/** 新建空报告（--no-scan 时作为占位，保证 InitResult.scanReport 始终存在） */
export function createEmptyScanReport(): ProjectScanReport {
    return {
        version: SCAN_BASELINE_VERSION,
        scannedAt: new Date().toISOString(),
        scope: { dirs: 0, files: 0 },
        limits: {
            hit: false,
            detail: '未发生跳过',
            reasons: [],
            softTimeout: { ms: DEFAULT_SCAN_SOFT_TIMEOUT_MS, exceeded: false },
            skipped: { ignored: 0, timeout: 0, unreadable: 0 },
        },
        signals: { build: [], skeleton: [], config: [], routes: [], docs: [], tests: [] },
        candidates: [],
        failures: [],
    };
}

/** 归一化跳过原因顺序 */
function normalizeReasons(reasons: ScanSkipReason[]): ScanSkipReason[] {
    return SKIP_REASON_ORDER.filter((reason) => reasons.includes(reason));
}

/**
 * 项目预扫描（确定性，非阻断）。
 *
 * @param projectRoot - 项目根目录
 * @param options - 选项（软超时预算 / 忽略开关 / 时钟可注入；writeBaseline 默认写出基线）
 * @returns 扫描报告（失败只记入 failures / skipped，MUST NOT 抛出）
 */
export function scanProject(projectRoot: string, options: ScanOptions = {}): ProjectScanReport {
    const report = createEmptyScanReport();
    const budgetMs =
        typeof options.softTimeoutMs === 'number' && Number.isFinite(options.softTimeoutMs) && options.softTimeoutMs > 0
            ? Math.floor(options.softTimeoutMs)
            : DEFAULT_SCAN_SOFT_TIMEOUT_MS;
    const now = options.now ?? Date.now;
    report.limits.softTimeout.ms = budgetMs;
    const matcher = createIgnoreMatcher(projectRoot, { respectIgnoreFiles: options.respectIgnoreFiles });
    const sink: ScanSink = {
        report,
        matcher,
        now,
        deadline: now() + budgetMs,
        configVariants: new Map<string, ConfigVariant>(),
        jarNames: new Set<string>(),
        testFileCounts: new Map<string, number>(),
        syncedWarnings: 0,
    };

    walkDir(projectRoot, '', false, sink);
    syncMatcherWarnings(sink);
    probeSkeleton(projectRoot, sink);
    probeDocs(projectRoot, sink);
    syncMatcherWarnings(sink);
    flushConfigVariants(sink);
    flushCandidates(sink);
    flushTestFileCounts(sink);
    report.limits.reasons = normalizeReasons(report.limits.reasons);
    report.limits.hit = report.limits.reasons.length > 0;
    report.limits.detail = buildLimitDetail(report);

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
 * 写出扫描基线（.iagent/scan-baseline.json，整体覆盖，恒为 v2）。
 * 写入失败只返回 WARN 结果，MUST NOT 抛出、MUST NOT 中断调用方。
 *
 * @param projectRoot - 项目根目录
 * @param report - 扫描报告
 * @returns 写出结果（state=failed 时 warning 含失败原因）
 */
export function writeScanBaseline(projectRoot: string, report: ProjectScanReport): BaselineWriteResult {
    const target = path.join(projectRoot, IAGENT_DIR_NAME, SCAN_BASELINE_FILE);
    try {
        ensureDir(path.join(projectRoot, IAGENT_DIR_NAME));
        const payload: ProjectScanReport = { ...report, version: SCAN_BASELINE_VERSION };
        fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
        return { path: SCAN_BASELINE_PATH, state: 'written' };
    } catch (error) {
        return {
            path: SCAN_BASELINE_PATH,
            state: 'failed',
            warning: `基线写入失败（已跳过，不影响 init 主流程）：${errorMessage(error)}`,
        };
    }
}

/** 读取侧：数字字段归一（非有限非负数回退默认值） */
function toCount(value: unknown, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

/** 读取侧：信号条目数组归一（非数组回退空数组） */
function toArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * 解析扫描基线内容（读取侧兼容分支）。
 *
 * `version: 2` 读 v2 字段；`version: 1` 或缺失时按历史结构只读 `limits.hit` /
 * `limits.detail` 与既有事实字段，并归一为 v2 形状（`reasons` 为空、`skipped` 全 0）——
 * MUST NOT 因缺少 `skipped` 而报错，也 MUST NOT 在迁移期重写用户文件。
 *
 * @param raw - 基线文件全文
 * @throws JSON 解析失败时抛出（调用方按「基线不可解析」降级）
 */
export function parseScanBaseline(raw: string): ProjectScanReport {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const empty = createEmptyScanReport();
    const isV2 = parsed.version === SCAN_BASELINE_VERSION;
    const limitsRaw = (parsed.limits ?? {}) as Record<string, unknown>;
    const softTimeoutRaw = (limitsRaw.softTimeout ?? {}) as Record<string, unknown>;
    const skippedRaw = (limitsRaw.skipped ?? {}) as Record<string, unknown>;
    const signalsRaw = (parsed.signals ?? {}) as Record<string, unknown>;
    const scopeRaw = (parsed.scope ?? {}) as Record<string, unknown>;
    const reasons = isV2
        ? normalizeReasons(
              toArray<string>(limitsRaw.reasons).filter((reason): reason is ScanSkipReason =>
                  SKIP_REASON_ORDER.includes(reason as ScanSkipReason)
              )
          )
        : [];
    return {
        version: SCAN_BASELINE_VERSION,
        scannedAt: typeof parsed.scannedAt === 'string' ? parsed.scannedAt : empty.scannedAt,
        scope: { dirs: toCount(scopeRaw.dirs), files: toCount(scopeRaw.files) },
        limits: {
            hit: limitsRaw.hit === true,
            detail:
                typeof limitsRaw.detail === 'string'
                    ? limitsRaw.detail
                    : limitsRaw.hit === true
                      ? '发生跳过（历史基线未记录分类）'
                      : '未发生跳过',
            reasons,
            softTimeout: {
                ms: toCount(softTimeoutRaw.ms, DEFAULT_SCAN_SOFT_TIMEOUT_MS) || DEFAULT_SCAN_SOFT_TIMEOUT_MS,
                exceeded: softTimeoutRaw.exceeded === true,
            },
            skipped: {
                ignored: toCount(skippedRaw.ignored),
                timeout: toCount(skippedRaw.timeout),
                unreadable: toCount(skippedRaw.unreadable),
            },
        },
        signals: {
            build: toArray(signalsRaw.build),
            skeleton: toArray(signalsRaw.skeleton),
            config: toArray(signalsRaw.config),
            routes: toArray(signalsRaw.routes),
            docs: toArray(signalsRaw.docs),
            tests: toArray(signalsRaw.tests),
        },
        candidates: toArray(parsed.candidates),
        failures: toArray(parsed.failures),
    };
}

/** 列表渲染：空列表显示「未探测到」 */
function listOrNone(items: string[]): string {
    return items.length === 0 ? '未探测到' : items.join('、');
}

/**
 * 渲染非阻断终端报告（由 CLI 打印，风格对齐 renderDependencyReport）。
 * 只渲染键名与路径事实，MUST NOT 出现任何配置取值。
 *
 * 跳过段（`ignored` / `timeout` / `unreadable` 三类计数）恒输出；软超时另起提示行，
 * 保证「超时不得静默」在终端侧成立。
 *
 * @param report - scanProject 返回的报告
 * @returns 渲染结果（不含尾随换行）
 */
export function renderScanReport(report: ProjectScanReport): string {
    const lines: string[] = [`  项目预扫描（非阻断，基线：${SCAN_BASELINE_PATH}）：`];
    lines.push(`    · 扫描范围：${report.scope.dirs} 个目录 / ${report.scope.files} 个文件`);
    const { skipped, softTimeout, reasons, hit, detail } = report.limits;
    lines.push(`    · 跳过：忽略 ${skipped.ignored} / 软超时 ${skipped.timeout} / 不可读 ${skipped.unreadable}`);
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
    if (report.signals.tests.length === 0) {
        lines.push('    · 测试探针：未探测到');
    } else {
        lines.push(`    · 测试探针：${report.signals.tests.length} 项（仅目录名与文件名计数，不读内容）`);
        for (const test of report.signals.tests) {
            lines.push(
                test.kind === 'test-dir'
                    ? `      - 目录 ${test.name}/`
                    : `      - 文件 ${test.name}：${test.count} 个`
            );
        }
    }
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
    if (softTimeout.exceeded) {
        lines.push(
            `    ! 软超时：预算 ${softTimeout.ms}ms 已用尽 —— 因软超时跳过 ${skipped.timeout} 项（可能不完整），` +
                '扫描为受控停止、非失败'
        );
    }
    if (hit && reasons.length > 0) {
        lines.push(`    ! ${detail}`);
    }
    for (const failure of report.failures) {
        lines.push(`    ! ${failure.target}：${failure.reason}`);
    }
    lines.push('    下一步：/iagent:project-init 基于基线生成分类文档（docs/project/）');
    return lines.join('\n');
}
