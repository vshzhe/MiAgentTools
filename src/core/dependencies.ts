/**
 * init 依赖自检与自动安装。
 *
 * venus 后续功能依赖两个外部工具，init 时保证就位：
 *   - codegraph（npm: @colbymchenry/codegraph）：代码知识图谱，
 *     MCP 以用户级注册（claude mcp add codegraph -s user -- codegraph serve --mcp）
 *   - openspec（npm: @fission-ai/openspec）：规格驱动开发，
 *     项目级初始化标志为项目根存在 openspec/ 目录
 *
 * 策略（已确认）：
 *   - 自动安装：检测到缺失直接装，--no-deps 跳过
 *   - 失败仅警告：安装失败不阻断技能生成主流程
 *   - 已存在不动：只做存在性检测，不升级、不覆盖
 *
 * 可测试性：命令执行通过 runner 注入，测试时替换为 mock，不跑真实 npm。
 */

import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathExists, readFileIfExists } from '../utils/file-system.js';

/** codegraph 的 npm 包名 */
const CODEGRAPH_PACKAGE = '@colbymchenry/codegraph';

/** openspec 的 npm 包名 */
const OPENSPEC_PACKAGE = '@fission-ai/openspec';

/** 单条命令超时（npm install -g 可能较慢） */
const COMMAND_TIMEOUT_MS = 120000;

/** 命令执行器（依赖注入，测试时替换为 mock） */
export type CommandRunner = (
    cmd: string,
    args: string[],
    options: { cwd?: string }
) => { status: number | null };

/** 默认执行器：spawnSync，Windows 下需 shell 解析 .cmd shim */
const defaultRunner: CommandRunner = (cmd, args, options) => {
    return spawnSync(cmd, args, {
        shell: process.platform === 'win32',
        stdio: 'ignore',
        timeout: COMMAND_TIMEOUT_MS,
        cwd: options.cwd,
    });
};

/** 子项状态：ok=已存在 | installed=本次装好 | failed=失败 | skipped=被跳过 */
export type DepItemState = 'ok' | 'installed' | 'failed' | 'skipped';

/** 依赖检测与安装报告 */
export interface DependencyReport {
    /** codegraph 依赖状态 */
    codegraph: {
        /** CLI 命令可用性 */
        cli: DepItemState;
        /** 用户级 MCP 注册状态 */
        mcp: DepItemState;
        /** 失败警告（含手动处理建议） */
        warnings: string[];
    };
    /** openspec 依赖状态 */
    openspec: {
        /** CLI 命令可用性 */
        cli: DepItemState;
        /** 项目级初始化状态（openspec/ 目录） */
        project: DepItemState;
        /** 失败警告（含手动处理建议） */
        warnings: string[];
    };
}

/** ensureDependencies 选项 */
export interface EnsureDependenciesOptions {
    /** 跳过全部检测与安装（--no-deps） */
    skip?: boolean;
    /** 命令执行器（测试注入） */
    runner?: CommandRunner;
    /** Claude 配置文件所在目录（默认用户主目录，测试注入） */
    claudeConfigDir?: string;
}

/** 检测命令是否可用（--version 退出码 0 视为可用） */
function isCommandAvailable(runner: CommandRunner, cmd: string): boolean {
    return runner(cmd, ['--version'], {}).status === 0;
}

/** 读取 Claude 用户级配置（~/.claude.json），不存在或解析失败返回 null */
function readClaudeConfig(claudeConfigDir: string): Record<string, unknown> | null {
    const configPath = path.join(claudeConfigDir, '.claude.json');
    const raw = readFileIfExists(configPath);
    if (raw === undefined) {
        return null;
    }
    try {
        return JSON.parse(raw) as Record<string, unknown>;
    } catch {
        return null;
    }
}

/** 检测 codegraph MCP 是否已注册到用户级配置（mcpServers.codegraph） */
function isCodegraphMcpRegistered(claudeConfigDir: string): boolean {
    const config = readClaudeConfig(claudeConfigDir);
    if (config === null) {
        return false;
    }
    const servers = config['mcpServers'];
    if (servers === null || typeof servers !== 'object') {
        return false;
    }
    return 'codegraph' in (servers as Record<string, unknown>);
}

/** 检测 openspec 是否已在本项目初始化（项目根存在 openspec/ 目录） */
function isOpenSpecInitialized(projectRoot: string): boolean {
    return pathExists(path.join(projectRoot, 'openspec'));
}

/**
 * 检测并安装依赖（自动模式）。
 *
 * @param projectRoot - 目标项目根目录（openspec 项目初始化位置）
 * @param options - 选项（skip 跳过 / runner 注入 / claudeConfigDir 注入）
 * @returns 依赖报告（各子项状态 + 失败警告）
 */
export function ensureDependencies(
    projectRoot: string,
    options: EnsureDependenciesOptions = {}
): DependencyReport {
    const runner = options.runner ?? defaultRunner;
    const claudeConfigDir = options.claudeConfigDir ?? os.homedir();
    const report: DependencyReport = {
        codegraph: { cli: 'skipped', mcp: 'skipped', warnings: [] },
        openspec: { cli: 'skipped', project: 'skipped', warnings: [] },
    };
    if (options.skip) {
        return report;
    }

    // 1. codegraph CLI
    if (isCommandAvailable(runner, 'codegraph')) {
        report.codegraph.cli = 'ok';
    } else {
        const result = runner('npm', ['install', '-g', CODEGRAPH_PACKAGE], {});
        report.codegraph.cli = result.status === 0 ? 'installed' : 'failed';
        if (result.status !== 0) {
            report.codegraph.warnings.push(`codegraph CLI 安装失败，可手动执行：npm install -g ${CODEGRAPH_PACKAGE}`);
        }
    }

    // 2. codegraph MCP（用户级注册）
    if (isCodegraphMcpRegistered(claudeConfigDir)) {
        report.codegraph.mcp = 'ok';
    } else if (report.codegraph.cli !== 'ok' && report.codegraph.cli !== 'installed') {
        report.codegraph.mcp = 'failed';
        report.codegraph.warnings.push('codegraph CLI 不可用，跳过 MCP 注册');
    } else if (isCommandAvailable(runner, 'claude')) {
        const result = runner('claude', ['mcp', 'add', 'codegraph', '-s', 'user', '--', 'codegraph', 'serve', '--mcp'], {});
        report.codegraph.mcp = result.status === 0 ? 'installed' : 'failed';
        if (result.status !== 0) {
            report.codegraph.warnings.push(
                'codegraph MCP 注册失败，可手动执行：claude mcp add codegraph -s user -- codegraph serve --mcp'
            );
        }
    } else {
        report.codegraph.mcp = 'failed';
        report.codegraph.warnings.push(
            'claude CLI 不可用，可手动执行：claude mcp add codegraph -s user -- codegraph serve --mcp'
        );
    }

    // 3. openspec CLI
    if (isCommandAvailable(runner, 'openspec')) {
        report.openspec.cli = 'ok';
    } else {
        const result = runner('npm', ['install', '-g', OPENSPEC_PACKAGE], {});
        report.openspec.cli = result.status === 0 ? 'installed' : 'failed';
        if (result.status !== 0) {
            report.openspec.warnings.push(`openspec CLI 安装失败，可手动执行：npm install -g ${OPENSPEC_PACKAGE}`);
        }
    }

    // 4. openspec 项目初始化（openspec init --tools claude，非交互）
    if (isOpenSpecInitialized(projectRoot)) {
        report.openspec.project = 'ok';
    } else if (report.openspec.cli !== 'ok' && report.openspec.cli !== 'installed') {
        report.openspec.project = 'failed';
        report.openspec.warnings.push('openspec CLI 不可用，跳过项目初始化');
    } else {
        const result = runner('openspec', ['init', '--tools', 'claude'], { cwd: projectRoot });
        report.openspec.project = result.status === 0 ? 'installed' : 'failed';
        if (result.status !== 0) {
            report.openspec.warnings.push(
                `openspec 项目初始化失败，可在项目根手动执行：openspec init --tools claude`
            );
        }
    }

    return report;
}

/** 单个子项的展示符号 */
function itemSymbol(state: DepItemState): string {
    switch (state) {
        case 'ok':
            return '✓';
        case 'installed':
            return '+';
        case 'failed':
            return '!';
        case 'skipped':
            return '-';
    }
}

/** 单个子项的状态描述 */
function itemLabel(state: DepItemState): string {
    switch (state) {
        case 'ok':
            return '已就绪';
        case 'installed':
            return '本次安装';
        case 'failed':
            return '失败';
        case 'skipped':
            return '跳过';
    }
}

/**
 * 渲染依赖报告为控制台输出（多行，参照现有 init 输出风格）。
 *
 * @param report - ensureDependencies 返回的报告
 * @returns 渲染结果（不含尾随换行）
 */
export function renderDependencyReport(report: DependencyReport): string {
    const items: { name: string; state: DepItemState }[] = [
        { name: 'codegraph CLI', state: report.codegraph.cli },
        { name: 'codegraph MCP', state: report.codegraph.mcp },
        { name: 'openspec CLI', state: report.openspec.cli },
        { name: 'openspec 项目', state: report.openspec.project },
    ];
    const lines: string[] = ['  依赖（后续功能集成用）：'];
    for (const item of items) {
        lines.push(`    ${itemSymbol(item.state)} ${item.name}（${itemLabel(item.state)}）`);
    }
    for (const warning of [...report.codegraph.warnings, ...report.openspec.warnings]) {
        lines.push(`    ! ${warning}`);
    }
    return lines.join('\n');
}
