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
 *   - 非检测类命令（npm install / claude mcp add）返回 installStatus
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

let tempHome: string;

beforeAll(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'venus-deps-home-'));
});

afterAll(() => {
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
        const runner = createMockRunner({ available: ['codegraph', 'claude'] });

        const report = ensureDependencies('/tmp/any-project', { runner, claudeConfigDir: tempHome });

        expect(report.codegraph.cli).toBe('ok');
        expect(report.codegraph.mcp).toBe('ok');
        // 仅 1 次可用性检测（codegraph），MCP 已注册时不检测 claude，无安装调用
        expect(runner.calls.length).toBe(1);
        for (const call of runner.calls) {
            expect(call.args[0]).toBe('--version');
        }
    });

    it('全部缺失时执行完整安装序列', () => {
        writeClaudeConfig(tempHome, false);
        const runner = createMockRunner({ available: ['claude'], installStatus: 0 });

        const report = ensureDependencies('/tmp/any-project', { runner, claudeConfigDir: tempHome });

        expect(report.codegraph.cli).toBe('installed');
        expect(report.codegraph.mcp).toBe('installed');
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
        // spec 工作流自持（ADR-0001）：不安装 openspec CLI、不执行 openspec init
        expect(runner.calls.some((c) => c.cmd === 'openspec')).toBe(false);
        expect(runner.calls.some((c) => c.args.includes('@fission-ai/openspec'))).toBe(false);
    });

    it('npm 安装失败时标记 failed 并给出手动命令，不阻断后续检测', () => {
        writeClaudeConfig(tempHome, false);
        const runner = createMockRunner({ available: ['claude'], installStatus: 1 });

        const report = ensureDependencies('/tmp/any-project', { runner, claudeConfigDir: tempHome });

        expect(report.codegraph.cli).toBe('failed');
        // CLI 不可用导致 MCP 注册跳过为 failed
        expect(report.codegraph.mcp).toBe('failed');
        // 警告包含手动安装命令
        expect(report.codegraph.warnings.some((w) => w.includes('npm install -g @colbymchenry/codegraph'))).toBe(true);
    });

    it('claude CLI 不可用时 MCP 注册 failed 并提示手动注册命令', () => {
        writeClaudeConfig(tempHome, false);
        const runner = createMockRunner({ available: ['codegraph'], installStatus: 0 });

        const report = ensureDependencies('/tmp/any-project', { runner, claudeConfigDir: tempHome });

        expect(report.codegraph.cli).toBe('ok');
        expect(report.codegraph.mcp).toBe('failed');
        expect(report.codegraph.warnings.some((w) => w.includes('claude mcp add codegraph'))).toBe(true);
    });

    it('.claude.json 缺失或损坏时视为未注册', () => {
        // 场景 1：文件不存在
        const claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'venus-deps-home2-'));
        try {
            const runner = createMockRunner({ available: ['codegraph', 'claude'], installStatus: 0 });
            const report = ensureDependencies('/tmp/any-project', { runner, claudeConfigDir: claudeDir });
            expect(report.codegraph.mcp).toBe('installed');

            // 场景 2：文件内容非法 JSON
            fs.writeFileSync(path.join(claudeDir, '.claude.json'), 'not-a-json', 'utf8');
            const runner2 = createMockRunner({ available: ['codegraph', 'claude'], installStatus: 0 });
            const report2 = ensureDependencies('/tmp/any-project', { runner: runner2, claudeConfigDir: claudeDir });
            expect(report2.codegraph.mcp).toBe('installed');
        } finally {
            fs.rmSync(claudeDir, { recursive: true, force: true });
        }
    });

    it('skip 为 true 时全部 skipped 且零命令执行', () => {
        const runner = createMockRunner({ available: ['codegraph', 'claude'] });

        const report = ensureDependencies('/tmp/any-project', { skip: true, runner, claudeConfigDir: tempHome });

        expect(report.codegraph.cli).toBe('skipped');
        expect(report.codegraph.mcp).toBe('skipped');
        expect(runner.calls.length).toBe(0);
    });
});

describe('renderDependencyReport', () => {
    it('渲染各子项状态与失败警告（仅 codegraph，无 openspec 项）', () => {
        const output = renderDependencyReport({
            codegraph: { cli: 'ok', mcp: 'failed', warnings: ['claude CLI 不可用，可手动执行：claude mcp add codegraph -s user -- codegraph serve --mcp'] },
        });
        expect(output).toContain('codegraph CLI');
        expect(output).toContain('codegraph MCP');
        expect(output).toContain('! claude CLI 不可用');
        expect(output).not.toContain('openspec');
    });
});
