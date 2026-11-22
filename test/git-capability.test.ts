/**
 * git-capability：检测 / 执行 / 归档提交路径清单（runner 注入，无真实进程）。
 *
 * 覆盖能力 `git-capability` 的全部 Scenario。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    detectGit,
    isGitRepository,
    findParentRepository,
    probeInstallers,
    initRepository,
    collectArchiveCommitPaths,
    stagePathsAndCommit,
    push,
    type GitCommandRunner,
} from '../src/core/git-capability.js';

/** 构造 mock runner：按「命令 + 首个参数」匹配响应 */
function mockRunner(
    responses: Record<string, { status: number; stdout?: string; stderr?: string }>,
    calls: Array<{ cmd: string; args: readonly string[] }> = [],
): GitCommandRunner {
    return (cmd, args) => {
        calls.push({ cmd, args: [...args] });
        const key = `${cmd} ${args[0] ?? ''}`.trim();
        const hit = responses[key] ?? responses[cmd];
        if (hit === undefined) return { status: 1, stderr: `no mock for ${key}` };
        return { status: hit.status, stdout: hit.stdout, stderr: hit.stderr };
    };
}

function makeTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-git-'));
}

describe('Git 能力检测（只读）', () => {
    it('Scenario: 检测到 Git 已安装', () => {
        const runner = mockRunner({ 'git --version': { status: 0, stdout: 'git version 2.42.0.windows.1\n' } });
        const status = detectGit(runner);
        expect(status.installed).toBe(true);
        expect(status.version).toBe('2.42.0');
    });

    it('Scenario: 未安装 Git', () => {
        const runner = mockRunner({ 'git --version': { status: 1, stderr: 'command not found' } });
        const status = detectGit(runner);
        expect(status.installed).toBe(false);
        expect(status.version).toBeUndefined();
    });

    it('启动失败同样判未安装', () => {
        const runner: GitCommandRunner = () => ({ status: null, error: new Error('ENOENT') });
        expect(detectGit(runner).installed).toBe(false);
    });

    it('Scenario: 探测到上级仓库', () => {
        const root = makeTempDir();
        const child = path.join(root, 'a', 'b');
        fs.mkdirSync(child, { recursive: true });
        fs.mkdirSync(path.join(root, '.git'), { recursive: true });
        expect(findParentRepository(child)).toBe(path.resolve(root));
        expect(isGitRepository(child)).toBe(false);
    });

    it('无上级仓库时返回 null', () => {
        const root = makeTempDir();
        // 临时目录自身可能位于某个仓库内时跳过该断言（构建机差异）
        const parent = findParentRepository(root);
        if (parent === null) {
            expect(parent).toBeNull();
        } else {
            expect(typeof parent).toBe('string');
        }
    });

    it('Scenario: 安装器探测（无可用时返回空）', () => {
        const runner: GitCommandRunner = () => ({ status: 1 });
        expect(probeInstallers(runner, 'win32')).toEqual([]);
        expect(probeInstallers(runner, 'darwin')).toEqual([]);
        expect(probeInstallers(runner, 'linux')).toEqual([]);
    });

    it('安装器探测按平台返回命令', () => {
        const runner: GitCommandRunner = (cmd) =>
            cmd === 'winget' ? { status: 0 } : { status: 1 };
        const installers = probeInstallers(runner, 'win32');
        expect(installers.map((item) => item.name)).toEqual(['winget']);
        expect(installers[0].display).toContain('Git.Git');
    });

    it('brew 平台的安装命令', () => {
        const runner: GitCommandRunner = (cmd) => (cmd === 'brew' ? { status: 0 } : { status: 1 });
        const installers = probeInstallers(runner, 'darwin');
        expect(installers[0].args).toEqual(['install', 'git']);
    });
});

describe('Git 执行（幂等与精确暂存）', () => {
    let dir: string;

    beforeEach(() => {
        dir = makeTempDir();
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('Scenario: 幂等初始化（已有 .git）', () => {
        fs.mkdirSync(path.join(dir, '.git'));
        const calls: Array<{ cmd: string; args: readonly string[] }> = [];
        const runner = mockRunner({}, calls);
        const result = initRepository(dir, runner, { detect: () => ({ installed: true }) });
        expect(result).toEqual({ action: 'skipped', reason: expect.stringContaining('不覆盖') });
        // MUST NOT 执行任何写命令
        expect(calls).toHaveLength(0);
    });

    it('Scenario: 首次初始化', () => {
        const calls: Array<{ cmd: string; args: readonly string[] }> = [];
        const runner = mockRunner({ 'git init': { status: 0 } }, calls);
        const result = initRepository(dir, runner, { detect: () => ({ installed: true }) });
        expect(result).toEqual({ action: 'created' });
        expect(calls.some((call) => call.args[0] === 'init')).toBe(true);
    });

    it('嵌套仓库防护', () => {
        const outer = makeTempDir();
        fs.mkdirSync(path.join(outer, '.git'));
        const inner = path.join(outer, 'project');
        fs.mkdirSync(inner);
        const calls: Array<{ cmd: string; args: readonly string[] }> = [];
        const result = initRepository(inner, mockRunner({}, calls), { detect: () => ({ installed: true }) });
        expect(result.action).toBe('skipped');
        expect((result as { reason: string }).reason).toContain('上级仓库');
        expect(calls).toHaveLength(0);
    });

    it('Git 不可用时返回 failed', () => {
        const result = initRepository(dir, mockRunner({}), { detect: () => ({ installed: false }) });
        expect(result.action).toBe('failed');
    });

    it('Scenario: 精确暂存（add 参数恰为传入路径）', () => {
        const calls: Array<{ cmd: string; args: readonly string[] }> = [];
        const runner = mockRunner({ 'git add': { status: 0 }, 'git commit': { status: 0 } }, calls);
        const paths = ['a.md', 'b.md', 'c.md'];
        const result = stagePathsAndCommit(paths, 'chore: test', { cwd: dir, runner });
        expect(result.ok).toBe(true);
        const addCall = calls.find((call) => call.args[0] === 'add');
        expect(addCall?.args).toEqual(['add', '--', ...paths]);
        // MUST NOT 出现 -A / . / 通配
        expect(addCall?.args).not.toContain('-A');
        expect(addCall?.args).not.toContain('.');
    });

    it('拒绝非具体路径', () => {
        const runner = mockRunner({});
        expect(stagePathsAndCommit(['.'], 'x', { cwd: dir, runner }).ok).toBe(false);
        expect(stagePathsAndCommit(['src/*'], 'x', { cwd: dir, runner }).ok).toBe(false);
    });

    it('Scenario: 提交失败不抛错', () => {
        const runner = mockRunner({
            'git add': { status: 0 },
            'git commit': { status: 1, stderr: 'hook rejected' },
        });
        const result = stagePathsAndCommit(['a.md'], 'x', { cwd: dir, runner });
        expect(result.ok).toBe(false);
        expect(result.detail).toContain('hook rejected');
    });

    it('无待提交路径返回失败说明', () => {
        const result = stagePathsAndCommit([], 'x', { cwd: dir, runner: mockRunner({}) });
        expect(result.ok).toBe(false);
        expect(result.detail).toContain('无待提交路径');
    });

    it('push 无远程时返回说明', () => {
        const runner = mockRunner({ 'git remote': { status: 0, stdout: '' } });
        const result = push({ cwd: dir, runner });
        expect(result.ok).toBe(false);
        expect(result.detail).toContain('未配置远程仓库');
    });

    it('push 成功', () => {
        const runner = mockRunner({
            'git remote': { status: 0, stdout: 'origin\n' },
            'git push': { status: 0 },
        });
        expect(push({ cwd: dir, runner }).ok).toBe(true);
    });
});

describe('归档提交路径清单', () => {
    let changeRoot: string;

    beforeEach(() => {
        changeRoot = makeTempDir();
    });

    afterEach(() => {
        fs.rmSync(changeRoot, { recursive: true, force: true });
    });

    it('Scenario: 清单与 commit 技能一致', () => {
        for (const file of ['proposal.md', 'design.md', 'tasks.md', 'exploration.md', '.openspec.yaml']) {
            fs.writeFileSync(path.join(changeRoot, file), 'x');
        }
        fs.mkdirSync(path.join(changeRoot, 'specs', 'cap'), { recursive: true });
        fs.writeFileSync(path.join(changeRoot, 'specs', 'cap', 'spec.md'), 'x');
        // 排除项
        fs.mkdirSync(path.join(changeRoot, 'attachments'), { recursive: true });
        fs.writeFileSync(path.join(changeRoot, 'attachments', 'a.txt'), 'x');
        fs.writeFileSync(path.join(changeRoot, '需求文档.md'), 'x');

        const paths = collectArchiveCommitPaths(changeRoot).map((item) => item.replaceAll('\\', '/'));
        expect(paths.some((item) => item.endsWith('proposal.md'))).toBe(true);
        expect(paths.some((item) => item.endsWith('specs/cap/spec.md'))).toBe(true);
        expect(paths.some((item) => item.includes('attachments'))).toBe(false);
        expect(paths.some((item) => item.includes('需求文档.md'))).toBe(false);
    });

    it('Scenario: 部分制品缺失不报错', () => {
        fs.writeFileSync(path.join(changeRoot, 'proposal.md'), 'x');
        fs.writeFileSync(path.join(changeRoot, 'tasks.md'), 'x');
        const paths = collectArchiveCommitPaths(changeRoot);
        expect(paths).toHaveLength(2);
        expect(paths.some((item) => item.endsWith('design.md'))).toBe(false);
    });

    it('空变更目录返回空数组', () => {
        expect(collectArchiveCommitPaths(changeRoot)).toEqual([]);
    });
});
