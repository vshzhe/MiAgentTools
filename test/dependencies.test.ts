/**
 * 依赖自检与安装测试：mock runner 驱动各分支，不跑真实 npm / claude 命令。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    ensureDependencies,
    renderDependencyReport,
    type CommandRunner,
} from '../src/core/dependencies.js';

/** runner 调用记录 */
interface RunnerCall {
    cmd: string;
    args: string[];
    options: { cwd?: string };
}

/**
 * mock runner 工厂：
 *   - available 中的命令 --version 返回 0（其余返回 1）
 *   - 非检测类命令（npm install / claude mcp add / openspec init）返回 installStatus
 */
function createMockRunner(config: { available?: string[]; installStatus?: number }): CommandRunner & { calls: RunnerCall[] } {
    const calls: RunnerCall[] = [];
    const runner = (cmd: string, args: string[], options: { cwd?: string }): { status: number | null } => {
        calls.push({ cmd, args, options });
        if (args[0] === '--version') {
            return { status: config.available?.includes(cmd) === true ? 0 : 1 };
        }
        return { status: config.installStatus ?? 0 };
    };
    return Object.assign(runner, { calls });
}

let tempRoot: string;
let tempHome: string;

beforeAll(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'venus-deps-project-'));
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'venus-deps-home-'));
});

afterAll(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(tempHome, { recursive: true, force: true });
});

/** 写入测试用 ~/.claude.json（mcpServers 可选） */
function writeClaudeConfig(homeDir: string, withCodegraph: boolean): void {
    const config = withCodegraph
        ? { mcpServers: { codegraph: { type: 'stdio', command: 'codegraph', args: ['serve', '--mcp'] } } }
        : { mcpServers: {} };
    fs.writeFileSync(path.join(homeDir, '.claude.json'), JSON.stringify(config), 'utf8');
}

describe('ensureDependencies', () => {
    it('全部已存在时返回 ok 且不触发任何安装', () => {
        writeClaudeConfig(tempHome, true);
        fs.mkdirSync(path.join(tempRoot, 'openspec'), { recursive: true });
        const runner = createMockRunner({ available: ['codegraph', 'claude', 'openspec'] });

        const report = ensureDependencies(tempRoot, { runner, claudeConfigDir: tempHome });

        expect(report.codegraph.cli).toBe('ok');
        expect(report.codegraph.mcp).toBe('ok');
        expect(report.openspec.cli).toBe('ok');
        expect(report.openspec.project).toBe('ok');
        // 仅 2 次可用性检测（codegraph / openspec），MCP 已注册时不检测 claude，无安装调用
        expect(runner.calls.length).toBe(2);
        for (const call of runner.calls) {
            expect(call.args[0]).toBe('--version');
        }
    });

    it('全部缺失时执行完整安装序列', () => {
        writeClaudeConfig(tempHome, false);
        fs.rmSync(path.join(tempRoot, 'openspec'), { recursive: true, force: true });
        const runner = createMockRunner({ available: ['claude'], installStatus: 0 });

        const report = ensureDependencies(tempRoot, { runner, claudeConfigDir: tempHome });

        expect(report.codegraph.cli).toBe('installed');
        expect(report.codegraph.mcp).toBe('installed');
        expect(report.openspec.cli).toBe('installed');
        expect(report.openspec.project).toBe('installed');
        // 断言安装命令参数
        expect(runner.calls).toContainEqual({
            cmd: 'npm',
            args: ['install', '-g', '@colbymchenry/codegraph'],
            options: {},
        });
        expect(runner.calls).toContainEqual({
            cmd: 'claude',
            args: ['mcp', 'add', 'codegraph', '-s', 'user', '--', 'codegraph', 'serve', '--mcp'],
            options: {},
        });
        expect(runner.calls).toContainEqual({
            cmd: 'npm',
            args: ['install', '-g', '@fission-ai/openspec'],
            options: {},
        });
        // 项目初始化必须以项目根为工作目录
        expect(runner.calls).toContainEqual({
            cmd: 'openspec',
            args: ['init', '--tools', 'claude'],
            options: { cwd: tempRoot },
        });
    });

    it('npm 安装失败时标记 failed 并给出手动命令，不阻断后续检测', () => {
        writeClaudeConfig(tempHome, false);
        fs.rmSync(path.join(tempRoot, 'openspec'), { recursive: true, force: true });
        const runner = createMockRunner({ available: ['claude'], installStatus: 1 });

        const report = ensureDependencies(tempRoot, { runner, claudeConfigDir: tempHome });

        expect(report.codegraph.cli).toBe('failed');
        expect(report.openspec.cli).toBe('failed');
        // CLI 不可用导致 MCP 注册与项目初始化跳过为 failed
        expect(report.codegraph.mcp).toBe('failed');
        expect(report.openspec.project).toBe('failed');
        // 警告包含手动安装命令
        const warnings = [...report.codegraph.warnings, ...report.openspec.warnings];
        expect(warnings.some((w) => w.includes('npm install -g @colbymchenry/codegraph'))).toBe(true);
        expect(warnings.some((w) => w.includes('npm install -g @fission-ai/openspec'))).toBe(true);
    });

    it('claude CLI 不可用时 MCP 注册 failed 并提示手动注册命令', () => {
        writeClaudeConfig(tempHome, false);
        fs.mkdirSync(path.join(tempRoot, 'openspec'), { recursive: true });
        const runner = createMockRunner({ available: ['codegraph', 'openspec'], installStatus: 0 });

        const report = ensureDependencies(tempRoot, { runner, claudeConfigDir: tempHome });

        expect(report.codegraph.cli).toBe('ok');
        expect(report.codegraph.mcp).toBe('failed');
        expect(report.codegraph.warnings.some((w) => w.includes('claude mcp add codegraph'))).toBe(true);
    });

    it('.claude.json 缺失或损坏时视为未注册', () => {
        fs.rmSync(path.join(tempRoot, 'openspec'), { recursive: true, force: true });
        // 场景 1：文件不存在
        const claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'venus-deps-home2-'));
        try {
            const runner = createMockRunner({ available: ['codegraph', 'claude', 'openspec'], installStatus: 0 });
            const report = ensureDependencies(tempRoot, { runner, claudeConfigDir: claudeDir });
            expect(report.codegraph.mcp).toBe('installed');

            // 场景 2：文件内容非法 JSON
            fs.writeFileSync(path.join(claudeDir, '.claude.json'), 'not-a-json', 'utf8');
            const runner2 = createMockRunner({ available: ['codegraph', 'claude', 'openspec'], installStatus: 0 });
            const report2 = ensureDependencies(tempRoot, { runner: runner2, claudeConfigDir: claudeDir });
            expect(report2.codegraph.mcp).toBe('installed');
        } finally {
            fs.rmSync(claudeDir, { recursive: true, force: true });
        }
    });

    it('skip 为 true 时全部 skipped 且零命令执行', () => {
        const runner = createMockRunner({ available: ['codegraph', 'claude', 'openspec'] });

        const report = ensureDependencies(tempRoot, { skip: true, runner, claudeConfigDir: tempHome });

        expect(report.codegraph.cli).toBe('skipped');
        expect(report.codegraph.mcp).toBe('skipped');
        expect(report.openspec.cli).toBe('skipped');
        expect(report.openspec.project).toBe('skipped');
        expect(runner.calls.length).toBe(0);
    });
});

describe('renderDependencyReport', () => {
    it('渲染各子项状态与失败警告', () => {
        const output = renderDependencyReport({
            codegraph: { cli: 'ok', mcp: 'failed', warnings: ['claude CLI 不可用，可手动执行：claude mcp add codegraph -s user -- codegraph serve --mcp'] },
            openspec: { cli: 'installed', project: 'skipped', warnings: [] },
        });
        expect(output).toContain('codegraph CLI');
        expect(output).toContain('codegraph MCP');
        expect(output).toContain('openspec CLI');
        expect(output).toContain('openspec 项目');
        expect(output).toContain('! claude CLI 不可用');
    });
});
