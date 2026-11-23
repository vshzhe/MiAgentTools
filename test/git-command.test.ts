/**
 * iagent git 命令：status / init / branch / merge 的输出契约与只读性。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildGitCommand, runGitStatus, runGitInit, runGitBranch, runGitMerge } from '../src/commands/git.js';

function makeTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-git-cmd-'));
}

const INSTALLED = () => ({ installed: true, version: '2.42.0' });
const MISSING = () => ({ installed: false });

describe('iagent git status', () => {
    let dir: string;

    beforeEach(() => {
        dir = makeTempDir();
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('Scenario: JSON 输出完整状态', () => {
        fs.mkdirSync(path.join(dir, '.git'));
        const output = runGitStatus(dir, { detect: INSTALLED });
        expect(output).toEqual({
            installed: true,
            version: '2.42.0',
            isRepo: true,
            parentRepo: null,
            installers: [],
        });
    });

    it('Scenario: 未安装 Git（退出码语义为 0，输出 installed=false）', () => {
        const output = runGitStatus(dir, {
            detect: MISSING,
            probInstallers: () => [{ name: 'winget', command: 'winget', args: [], display: 'winget install --id Git.Git -e' }],
        });
        expect(output.installed).toBe(false);
        expect(output.isRepo).toBe(false);
        expect(output.installers.map((item) => item.name)).toEqual(['winget']);
    });

    it('Scenario: 纯只读（不创建 .git）', () => {
        runGitStatus(dir, { detect: INSTALLED });
        expect(fs.existsSync(path.join(dir, '.git'))).toBe(false);
    });

    it('检测到上级仓库时 parentRepo 非空', () => {
        const outer = makeTempDir();
        fs.mkdirSync(path.join(outer, '.git'));
        const inner = path.join(outer, 'p');
        fs.mkdirSync(inner);
        try {
            const output = runGitStatus(inner, { detect: INSTALLED });
            expect(output.isRepo).toBe(false);
            expect(output.parentRepo).toBe(path.resolve(outer));
        } finally {
            fs.rmSync(outer, { recursive: true, force: true });
        }
    });

    it('命令暴露 status / init / branch / merge 子命令', () => {
        const git = buildGitCommand();
        const names = git.commands.map((cmd) => cmd.name());
        expect(names).toEqual(['status', 'init', 'branch', 'merge']);
    });
});

describe('iagent git init', () => {
    let dir: string;

    beforeEach(() => {
        dir = makeTempDir();
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('Scenario: 幂等跳过（已是仓库，零改动）', () => {
        fs.mkdirSync(path.join(dir, '.git'));
        const before = fs.readdirSync(dir);
        const output = runGitInit(dir, { detect: INSTALLED });
        expect(output.action).toBe('skipped');
        expect(output.reason).toContain('不覆盖');
        expect(fs.readdirSync(dir)).toEqual(before);
    });

    it('Scenario: 嵌套仓库防护', () => {
        const outer = makeTempDir();
        fs.mkdirSync(path.join(outer, '.git'));
        const inner = path.join(outer, 'p');
        fs.mkdirSync(inner);
        try {
            const output = runGitInit(inner, { detect: INSTALLED });
            expect(output.action).toBe('skipped');
            expect(output.reason).toContain('上级仓库');
            expect(fs.existsSync(path.join(inner, '.git'))).toBe(false);
        } finally {
            fs.rmSync(outer, { recursive: true, force: true });
        }
    });

    it('Git 不可用时 failed', () => {
        const output = runGitInit(dir, { detect: MISSING });
        expect(output.action).toBe('failed');
        expect(output.reason).toContain('Git 不可用');
    });
});

describe('iagent git branch / merge（分支操作输出契约）', () => {
    let dir: string;

    beforeEach(() => {
        dir = makeTempDir();
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    const mockRunner = (responses: Record<string, { status: number; stdout?: string; stderr?: string }>) => {
        return (_cmd: string, args: readonly string[]) => {
            const keys = [args.join(' '), `${args[0] ?? ''} ${args[1] ?? ''}`.trim(), args[0] ?? ''];
            for (const key of keys) {
                const hit = responses[key];
                if (hit !== undefined) return { status: hit.status, stdout: hit.stdout, stderr: hit.stderr };
            }
            return { status: 1, stderr: `no mock for ${args.join(' ')}` };
        };
    };

    it('Scenario: branch --create 输出契约', () => {
        const runner = mockRunner({
            'rev-parse --abbrev-ref': { status: 0, stdout: 'main\n' },
            'rev-parse --verify': { status: 1, stderr: 'not found' },
            'checkout -b': { status: 0 },
        });
        const output = runGitBranch(dir, { create: 'iagent/x', runner });
        expect(output).toEqual({ action: 'created', branch: 'iagent/x', baseBranch: 'main' });
    });

    it('branch --create 非法名以 failed 结束', () => {
        const output = runGitBranch(dir, { create: '../evil', runner: mockRunner({}) });
        expect(output.action).toBe('failed');
        expect(output.reason).toContain('..');
    });

    it('branch --delete 已合并返回 deleted', () => {
        const output = runGitBranch(dir, { delete: 'iagent/x', runner: mockRunner({ 'branch -d': { status: 0 } }) });
        expect(output.action).toBe('deleted');
        expect(output.branch).toBe('iagent/x');
    });

    it('Scenario: merge 冲突输出契约', () => {
        const runner = mockRunner({
            'merge --no-ff': { status: 1, stderr: 'CONFLICT' },
            'diff --name-only': { status: 0, stdout: 'src/a.ts\n' },
        });
        const output = runGitMerge(dir, 'iagent/x', { runner });
        expect(output).toEqual({ ok: false, merged: false, conflicts: ['src/a.ts'], detail: 'CONFLICT' });
    });

    it('merge 成功输出契约', () => {
        const output = runGitMerge(dir, 'iagent/x', { runner: mockRunner({ 'merge --no-ff': { status: 0 } }) });
        expect(output).toEqual({ ok: true, merged: true, conflicts: [] });
    });
});
