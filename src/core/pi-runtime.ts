/**
 * Pi 编排运行时 provider（变更 add-host-orchestration-adapters）。
 *
 * Pi 的严格编排需要 AST 之外的运行时能力（子 agent 委派、工作流、回执、门控），
 * 官方路线是安装 Extension。本模块把「运行时包 + 版本策略 + 检测 + 安装 + 能力判定」
 * 收敛为可替换的 provider：
 *   - 当前默认 provider 为 npm 包 `@tintinweb/pi-subagents`（latest）；
 *   - 未来可替换为 iagent 自有 npm 包，而不改变共享协议与宿主适配契约。
 *
 * 安装失败、版本不兼容或检测失败时返回 degraded —— MUST NOT 阻断 init；由调用方
 * 继续生成 degraded 产物并输出告警。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnCommand } from './child-process.js';
import { scanPiAgentDefinitions, type PiAgentDefinitionScan } from './pi-native.js';

/** 默认运行时包名 */
export const PI_RUNTIME_PACKAGE = '@tintinweb/pi-subagents';

/** 版本策略（默认安装 npm latest） */
export const PI_RUNTIME_VERSION_POLICY = 'latest';

/** 运行时要求的最低 Pi 版本 */
export const PI_RUNTIME_MIN_PI = '1.1.0';

/** 单条命令执行结果 */
export interface PiCommandResult {
    status: number | null;
    stdout?: string;
}

/** 命令执行器（依赖注入，测试替换） */
export type PiCommandRunner = (
    cmd: string,
    args: string[],
    options: { cwd?: string }
) => PiCommandResult;

/** 真实执行器：spawnCommand，捕获 stdout。仅由 CLI 显式注入（测试环境不触发真实安装）。 */
export const defaultPiCommandRunner: PiCommandRunner = (cmd, args, options) => {
    const result = spawnCommand(cmd, args, {
        timeout: 120_000,
        cwd: options.cwd,
    });
    return { status: result.status, stdout: result.stdout };
};

/** 未注入执行器时的安全默认：视为 Pi 不可用（degraded），不产生任何进程与网络副作用 */
const DISABLED_RUNNER: PiCommandRunner = () => ({ status: null });

/** 原生委派入口缺失/不可解析的诊断码 */
export type PiNativeEntryCode =
    | 'runtime-missing'
    | 'runtime-incompatible'
    | 'entry-missing'
    | 'entry-invalid';

/** 单条原生入口诊断 */
export interface PiNativeEntryIssue {
    code: PiNativeEntryCode;
    /** 相关 agent 名称（entry-* 时提供） */
    agent?: string;
    message: string;
}

/** 原生委派入口状态 */
export interface PiNativeEntriesStatus {
    /** 目录（项目相对，posix） */
    dir: string;
    /** 期望的 `subagent_type` */
    required: string[];
    /** 可解析 */
    resolvable: string[];
    /** 文件缺失 */
    missing: string[];
    /** frontmatter 不可解析或 name 不匹配 */
    invalid: string[];
    /** 结构化诊断 */
    issues: PiNativeEntryIssue[];
}

/** Pi 运行时状态 */
export interface PiRuntimeStatus {
    /** 运行时包名 */
    package: string;
    /** 请求版本策略 */
    requested: string;
    /** 实际解析版本（无法解析为 null） */
    resolved: string | null;
    /** 运行时是否已安装 */
    installed: boolean;
    /** 检测到的同类编排包冲突 */
    conflicts: string[];
    /** Pi CLI 版本（无法获取为 null） */
    piVersion: string | null;
    /** Pi 版本是否满足运行时要求 */
    compatible: boolean;
    /** 原生委派入口状态 */
    nativeEntries: PiNativeEntriesStatus;
    /** 编排模式 */
    mode: 'strict' | 'degraded';
    /** 非阻断原因/告警 */
    reasons: string[];
}

/** 运行时 provider 配置（可替换包名） */
export interface PiRuntimeProviderConfig {
    /** 包名 */
    package: string;
    /** 版本策略（'latest' 或具体版本） */
    version: string;
    /** 最低 Pi 版本 */
    minPiVersion: string;
}

/** 当前默认 provider */
export const DEFAULT_PI_RUNTIME_PROVIDER: PiRuntimeProviderConfig = {
    package: PI_RUNTIME_PACKAGE,
    version: PI_RUNTIME_VERSION_POLICY,
    minPiVersion: PI_RUNTIME_MIN_PI,
};

/** 解析版本号（major.minor.patch 前缀） */
export function parseVersion(text: string): [number, number, number] | null {
    const m = text.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
    if (!m) {
        return null;
    }
    return [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
}

/** a >= b */
export function versionAtLeast(a: string, b: string): boolean {
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    if (!pa || !pb) {
        return false;
    }
    for (let i = 0; i < 3; i++) {
        if (pa[i] > pb[i]) return true;
        if (pa[i] < pb[i]) return false;
    }
    return true;
}

/** 选项 */
export interface PiRuntimeOptions {
    /** 命令执行器（测试注入） */
    runner?: PiCommandRunner;
    /** 项目根目录（项目级安装） */
    projectRoot?: string;
    /** provider 配置（缺省用默认；供未来替换自有包） */
    provider?: PiRuntimeProviderConfig;
    /** 跳过安装尝试（只检测） */
    skipInstall?: boolean;
    /** 期望的原生委派入口（agent ID / `subagent_type`）；缺省不要求 */
    requiredAgents?: readonly string[];
}

/** 读取 Pi CLI 版本（不可用返回 null） */
function readPiVersion(runner: PiCommandRunner): string | null {
    const result = runner('pi', ['--version'], {});
    if (result.status !== 0 || !result.stdout) {
        return null;
    }
    const v = parseVersion(result.stdout);
    return v ? `${v[0]}.${v[1]}.${v[2]}` : null;
}

/** 扫描原生委派入口并生成结构化问题 */
function buildNativeEntries(
    projectRoot: string | undefined,
    requiredAgents: readonly string[] | undefined
): PiNativeEntriesStatus {
    const scan: PiAgentDefinitionScan = scanPiAgentDefinitions(projectRoot ?? '', requiredAgents ?? []);
    const issues: PiNativeEntryIssue[] = [];
    for (const agent of scan.missing) {
        issues.push({ code: 'entry-missing', agent, message: `缺少 agent 定义：.pi/agents/${agent}.md` });
    }
    for (const agent of scan.invalid) {
        issues.push({
            code: 'entry-invalid',
            agent,
            message: `agent 定义不可解析或 name 不匹配：.pi/agents/${agent}.md`,
        });
    }
    return {
        dir: scan.dir,
        required: scan.required,
        resolvable: scan.resolvable,
        missing: scan.missing,
        invalid: scan.invalid,
        issues,
    };
}

/** 构造 degraded 状态 */
function degraded(
    provider: PiRuntimeProviderConfig,
    piVersion: string | null,
    compatible: boolean,
    reasons: string[],
    nativeEntries: PiNativeEntriesStatus,
    extraIssues: PiNativeEntryIssue[] = []
): PiRuntimeStatus {
    return {
        package: provider.package,
        requested: provider.version,
        resolved: null,
        installed: false,
        conflicts: [],
        piVersion,
        compatible,
        nativeEntries: {
            ...nativeEntries,
            issues: [...nativeEntries.issues, ...extraIssues],
        },
        mode: 'degraded',
        reasons,
    };
}

const CONFLICTING_PACKAGE_HINTS = ['pi-agent-suite', 'pi-subagent-extension', 'pi-crew'];

/** 从 Pi 包列表文本提取指定包的版本（不同 Pi 版本的 list 输出均支持尽力解析）。 */
function parseResolvedPackageVersion(stdout: string, pkg: string): string | null {
    const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const near = stdout.match(new RegExp(`${escaped}[^\\d]{0,20}(\\d+\\.\\d+\\.\\d+)`));
    if (near) {
        return near[1];
    }
    return stdout.match(/\b(\d+\.\d+\.\d+)\b/)?.[1] ?? null;
}

/** 读取项目级 Pi settings 中声明的 package（Pi 1.2 的 `pi list` 不接受 `--local`）。 */
function projectPackageEntry(projectRoot: string | undefined, pkg: string): string | null {
    if (!projectRoot) {
        return null;
    }
    const settingsFile = path.join(projectRoot, '.pi', 'settings.json');
    if (!fs.existsSync(settingsFile)) {
        return null;
    }
    try {
        const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8')) as { packages?: unknown[] };
        const entry = settings.packages?.find((item) => typeof item === 'string' && item.includes(pkg));
        return typeof entry === 'string' ? entry : null;
    } catch {
        return null;
    }
}

/** 尽力解析已安装版本；Pi list 的旧输出没有版本时用 npm metadata 补充。 */
function resolveInstalledPackageVersion(
    runner: PiCommandRunner,
    pkg: string,
    listOutput: string,
    projectRoot?: string
): string | null {
    const fromList = parseResolvedPackageVersion(listOutput, pkg);
    if (fromList) {
        return fromList;
    }
    const result = runner('npm', ['view', pkg, 'version'], { cwd: projectRoot });
    if (result.status === 0 && result.stdout) {
        return parseVersion(result.stdout) ? `${parseVersion(result.stdout)![0]}.${parseVersion(result.stdout)![1]}.${parseVersion(result.stdout)![2]}` : null;
    }
    return null;
}

/**
 * 检测 Pi 运行时状态（不安装）。
 */
export function detectPiRuntime(options: PiRuntimeOptions = {}): PiRuntimeStatus {
    const runner = options.runner ?? DISABLED_RUNNER;
    const provider = options.provider ?? DEFAULT_PI_RUNTIME_PROVIDER;
    const nativeEntries = buildNativeEntries(options.projectRoot, options.requiredAgents);
    const piVersion = readPiVersion(runner);
    if (piVersion === null) {
        return degraded(
            provider,
            null,
            false,
            ['Pi CLI 不可用或无法解析版本，无法启用严格编排'],
            nativeEntries,
            [{ code: 'runtime-missing', message: '未检测到可用的 Pi CLI' }]
        );
    }
    const compatible = versionAtLeast(piVersion, provider.minPiVersion);
    if (!compatible) {
        return degraded(
            provider,
            piVersion,
            false,
            [`Pi 版本 ${piVersion} 低于运行时要求 ${provider.minPiVersion}`],
            nativeEntries,
            [
                {
                    code: 'runtime-incompatible',
                    message: `Pi 版本 ${piVersion} 低于 ${provider.minPiVersion}`,
                },
            ]
        );
    }
    const projectEntry = projectPackageEntry(options.projectRoot, provider.package);
    const listResult = runner('pi', ['list'], { cwd: options.projectRoot });
    const listOutput = listResult.stdout ?? '';
    const installed = projectEntry !== null || (listResult.status === 0 && listOutput.includes(provider.package));
    const conflicts = CONFLICTING_PACKAGE_HINTS.filter((name) => name !== provider.package && listOutput.includes(name));
    if (!installed) {
        return degraded(
            provider,
            piVersion,
            true,
            [`未检测到 Pi 运行时 ${provider.package}`],
            nativeEntries,
            [
                {
                    code: 'runtime-missing',
                    message: `未安装 ${provider.package}`,
                },
            ]
        );
    }
    const entryReasons: string[] = [];
    if (nativeEntries.missing.length > 0) {
        entryReasons.push(`缺少原生委派入口：${nativeEntries.missing.join(', ')}`);
    }
    if (nativeEntries.invalid.length > 0) {
        entryReasons.push(`原生委派入口不可解析：${nativeEntries.invalid.join(', ')}`);
    }
    if (conflicts.length > 0) {
        return {
            ...degraded(provider, piVersion, true, [
                `检测到同类 Pi 编排包冲突：${conflicts.join(', ')}`,
                ...entryReasons,
            ], nativeEntries),
            installed: true,
            conflicts,
        };
    }
    if (entryReasons.length > 0) {
        return {
            ...degraded(provider, piVersion, true, entryReasons, nativeEntries),
            installed: true,
        };
    }
    const resolved = projectEntry
        ? parseResolvedPackageVersion(projectEntry, provider.package) ?? resolveInstalledPackageVersion(runner, provider.package, listOutput, options.projectRoot)
        : resolveInstalledPackageVersion(runner, provider.package, listOutput, options.projectRoot);
    return {
        package: provider.package,
        requested: provider.version,
        resolved,
        installed: true,
        conflicts: [],
        piVersion,
        compatible: true,
        nativeEntries,
        mode: 'strict',
        reasons: [],
    };
}

/**
 * 尝试安装 Pi 运行时（项目级）。
 *
 * @returns 安装是否成功
 */
export function installPiRuntime(options: PiRuntimeOptions = {}): { ok: boolean; message: string } {
    const runner = options.runner ?? DISABLED_RUNNER;
    const provider = options.provider ?? DEFAULT_PI_RUNTIME_PROVIDER;
    const spec = `npm:${provider.package}`;
    const args = ['install', spec];
    if (options.projectRoot) {
        args.push('--local');
    }
    const result = runner('pi', args, { cwd: options.projectRoot });
    if (result.status === 0) {
        return { ok: true, message: `已安装 ${spec}` };
    }
    return {
        ok: false,
        message: `安装 ${spec} 失败；可手动执行：pi install ${spec}${options.projectRoot ? ' --local' : ''}`,
    };
}

/**
 * 确保 Pi 运行时可用：检测 → 缺失时安装 → 复检。
 *
 * 安装失败或复检仍不可用时返回 degraded（不抛出）。
 */
export function ensurePiRuntime(options: PiRuntimeOptions = {}): PiRuntimeStatus {
    const first = detectPiRuntime(options);
    if (first.mode === 'strict') {
        return first;
    }
    // 仅当 Pi 可用且版本兼容时才尝试安装
    if (first.piVersion === null || !first.compatible) {
        return first;
    }
    // 已安装但入口缺失/冲突时，安装不会改变结果（入口由写入阶段补齐）
    if (first.installed) {
        return first;
    }
    if (options.skipInstall) {
        return first;
    }
    const install = installPiRuntime(options);
    const after = detectPiRuntime(options);
    if (after.mode === 'strict') {
        return after;
    }
    return {
        ...after,
        reasons: [...after.reasons, install.message],
    };
}

/** 可诊断元数据的落盘路径（项目相对） */
export const PI_RUNTIME_METADATA_FILE = '.iagent/pi-runtime.json';

/** 渲染可诊断元数据（供写入 .iagent/pi-runtime.json） */
export function renderPiRuntimeMetadata(status: PiRuntimeStatus): string {
    return JSON.stringify(
        {
            host: 'pi',
            package: status.package,
            requested: status.requested,
            resolved: status.resolved,
            installed: status.installed,
            conflicts: status.conflicts,
            piVersion: status.piVersion,
            compatible: status.compatible,
            nativeEntries: status.nativeEntries,
            orchestration: status.mode,
            reasons: status.reasons,
        },
        null,
        2
    ) + '\n';
}
