/**
 * git-branch-capability：分支内核函数（runner 注入，无真实进程）。
 *
 * 覆盖能力 `git-branch-capability` 的全部 Scenario，并回归 `git-capability` 的
 * 「既有检测函数签名不变 / 分支函数经注入 runner 执行」。
 */

import { describe, it, expect } from 'vitest';
import {
    isWorkingTreeClean,
    createWorkBranch,
    mergeWorkBranch,
    deleteMergedBranch,
    validateBranchName,
    detectGit,
    isGitRepository,
    findParentRepository,
    probeInstallers,
    type GitCommandRunner,
} from '../src/core/git-capability.js';

/** 构造 mock runner：按「git + 子命令 + 首参」匹配，未命中回落子命令级 */
function mockRunner(
    responses: Record<string, { status: number; stdout?: string; stderr?: string }>,
    calls: Array<{ args: readonly string[] }> = [],
): GitCommandRunner {
    return (_cmd, args) => {
        calls.push({ args: [...args] });
        const keys = [
            args.join(' '),
            `${args[0] ?? ''} ${args[1] ?? ''}`.trim(),
            args[0] ?? '',
        ];
        for (const key of keys) {
            const hit = responses[key];
            if (hit !== undefined) return { status: hit.status, stdout: hit.stdout, stderr: hit.stderr };
        }
        return { status: 1, stderr: `no mock for ${args.join(' ')}` };
    };
}

describe('工作区状态检测（只读）', () => {
    it('Scenario: 干净工作区', () => {
        const runner = mockRunner({ 'status --porcelain': { status: 0, stdout: '' } });
        expect(isWorkingTreeClean('/repo', runner)).toEqual({ clean: true, dirty: [] });
    });

    it('Scenario: 脏工作区返回清单', () => {
        const stdout = ' M src/a.ts\n?? src/b.ts\n';
        const runner = mockRunner({ 'status --porcelain': { status: 0, stdout } });
        const result = isWorkingTreeClean('/repo', runner);
        expect(result.clean).toBe(false);
        expect(result.dirty).toEqual([' M src/a.ts', '?? src/b.ts']);
    });

    it('Scenario: 命令失败不抛错', () => {
        const runner = mockRunner({ 'status --porcelain': { status: 128, stderr: 'not a git repository' } });
        const result = isWorkingTreeClean('/repo', runner);
        expect(result.clean).toBe(false);
        expect(result.dirty).toEqual([]);
        expect(result.reason).toContain('not a git repository');
    });

    it('只发出 status 调用（无写命令）', () => {
        const calls: Array<{ args: readonly string[] }> = [];
        const runner = mockRunner({ 'status --porcelain': { status: 0, stdout: '' } }, calls);
        isWorkingTreeClean('/repo', runner);
        expect(calls).toEqual([{ args: ['status', '--porcelain'] }]);
    });
});

describe('工作分支创建（幂等）', () => {
    const currentMain = { 'rev-parse --abbrev-ref': { status: 0, stdout: 'main\n' } };

    it('Scenario: 首次创建并记录基分支', () => {
        const calls: Array<{ args: readonly string[] }> = [];
        const runner = mockRunner(
            {
                ...currentMain,
                'rev-parse --verify': { status: 1, stderr: 'not found' },
                'checkout -b': { status: 0 },
            },
            calls,
        );
        const result = createWorkBranch({ name: 'iagent/x', cwd: '/repo', runner });
        expect(result).toEqual({ action: 'created', branch: 'iagent/x', baseBranch: 'main' });
        expect(calls.some((c) => c.args.join(' ').startsWith('checkout -b iagent/x'))).toBe(true);
    });

    it('Scenario: 幂等跳过（已在目标分支）', () => {
        const calls: Array<{ args: readonly string[] }> = [];
        const runner = mockRunner(
            { 'rev-parse --abbrev-ref': { status: 0, stdout: 'iagent/x\n' } },
            calls,
        );
        const result = createWorkBranch({ name: 'iagent/x', cwd: '/repo', runner });
        expect(result.action).toBe('skipped');
        expect(calls.some((c) => c.args[0] === 'checkout')).toBe(false);
    });

    it('Scenario: 分支已存在则复用不覆盖', () => {
        const calls: Array<{ args: readonly string[] }> = [];
        const runner = mockRunner(
            {
                ...currentMain,
                'rev-parse --verify': { status: 0, stdout: 'abc\n' },
                'checkout iagent/x': { status: 0 },
            },
            calls,
        );
        const result = createWorkBranch({ name: 'iagent/x', cwd: '/repo', runner });
        expect(result.action).toBe('reused');
        expect(result.reason).toContain('复用');
        // 复用既有分支 MUST 切换过去（否则写操作仍落在当前分支）
        expect(calls.some((c) => c.args.join(' ') === 'checkout iagent/x')).toBe(true);
        // MUST NOT 用 -b（会覆盖 / 重置既有分支）
        expect(calls.some((c) => c.args.includes('-b'))).toBe(false);
    });

    it('Scenario: 非法分支名拒绝（不执行 checkout）', () => {
        for (const bad of ['../evil', 'bad name', '/lead', 'trail/', '-dash', 'a~b', 'a^b', 'a:b', 'a?b', 'a*b', 'a[b', 'a\\b', 'a..b', '']) {
            const calls: Array<{ args: readonly string[] }> = [];
            const runner = mockRunner({}, calls);
            const result = createWorkBranch({ name: bad, cwd: '/repo', runner });
            expect(result.action, bad).toBe('failed');
            expect(calls, bad).toEqual([]);
        }
    });

    it('基点分支与当前分支不一致时拒绝', () => {
        const runner = mockRunner({ ...currentMain });
        const result = createWorkBranch({ name: 'iagent/x', baseBranch: 'develop', cwd: '/repo', runner });
        expect(result.action).toBe('failed');
        expect(result.reason).toContain('基点分支不一致');
    });

    it('无法解析当前分支（非仓库 / detached）时失败', () => {
        const runner = mockRunner({ 'rev-parse --abbrev-ref': { status: 128, stderr: 'not a git repository' } });
        expect(createWorkBranch({ name: 'iagent/x', cwd: '/repo', runner }).action).toBe('failed');
    });
});

describe('工作分支合并', () => {
    it('Scenario: 无冲突合并成功', () => {
        const calls: Array<{ args: readonly string[] }> = [];
        const runner = mockRunner({ 'merge --no-ff': { status: 0 } }, calls);
        const result = mergeWorkBranch({ name: 'iagent/x', cwd: '/repo', runner });
        expect(result).toEqual({ ok: true, merged: true, conflicts: [] });
        expect(calls[0].args).toEqual(['merge', '--no-ff', '--no-edit', 'iagent/x']);
    });

    it('Scenario: 冲突返回清单且不 abort', () => {
        const calls: Array<{ args: readonly string[] }> = [];
        const runner = mockRunner(
            {
                'merge --no-ff': { status: 1, stderr: 'CONFLICT (content): Merge conflict in src/a.ts' },
                'diff --name-only': { status: 0, stdout: 'src/a.ts\nsrc/b.ts\n' },
            },
            calls,
        );
        const result = mergeWorkBranch({ name: 'iagent/x', cwd: '/repo', runner });
        expect(result.ok).toBe(false);
        expect(result.merged).toBe(false);
        expect(result.conflicts).toEqual(['src/a.ts', 'src/b.ts']);
        // MUST NOT abort / reset
        expect(calls.some((c) => c.args.join(' ').includes('--abort'))).toBe(false);
        expect(calls.some((c) => c.args.includes('reset'))).toBe(false);
    });

    it('Scenario: 分支不存在', () => {
        const runner = mockRunner({
            'merge --no-ff': { status: 128, stderr: "merge: iagent/x - not something we can merge" },
            'diff --name-only': { status: 0, stdout: '' },
        });
        const result = mergeWorkBranch({ name: 'iagent/x', cwd: '/repo', runner });
        expect(result.ok).toBe(false);
        expect(result.conflicts).toEqual([]);
        expect(result.detail).toContain('not something we can merge');
    });

    it('--into 先切换目标分支', () => {
        const calls: Array<{ args: readonly string[] }> = [];
        const runner = mockRunner({ 'checkout main': { status: 0 }, 'merge --no-ff': { status: 0 } }, calls);
        const result = mergeWorkBranch({ name: 'iagent/x', into: 'main', cwd: '/repo', runner });
        expect(result.ok).toBe(true);
        expect(calls[0].args).toEqual(['checkout', 'main']);
        expect(calls[1].args).toEqual(['merge', '--no-ff', '--no-edit', 'iagent/x']);
    });

    it('非法分支名拒绝', () => {
        expect(mergeWorkBranch({ name: '..', cwd: '/repo', runner: mockRunner({}) }).ok).toBe(false);
    });
});

describe('已合并分支删除', () => {
    it('Scenario: 已合并分支删除成功', () => {
        const calls: Array<{ args: readonly string[] }> = [];
        const runner = mockRunner({ 'branch -d': { status: 0 } }, calls);
        expect(deleteMergedBranch({ name: 'iagent/x', cwd: '/repo', runner })).toEqual({ action: 'deleted' });
        expect(calls[0].args).toEqual(['branch', '-d', 'iagent/x']);
    });

    it('Scenario: 未合并分支不强制删除', () => {
        const calls: Array<{ args: readonly string[] }> = [];
        const runner = mockRunner(
            { 'branch -d': { status: 1, stderr: 'error: the branch is not fully merged' } },
            calls,
        );
        const result = deleteMergedBranch({ name: 'iagent/x', cwd: '/repo', runner });
        expect(result.action).toBe('skipped');
        expect(result.reason).toContain('not fully merged');
        expect(calls.some((c) => c.args.includes('-D'))).toBe(false);
    });
});

describe('分支名校验', () => {
    it('合法名返回 null', () => {
        for (const good of ['iagent/spec-apply', 'main', 'feature/x-1', 'a.b/c_d']) {
            expect(validateBranchName(good), good).toBeNull();
        }
    });
});

describe('既有检测函数签名不变（回归）', () => {
    it('四个检测函数仍可独立注入 runner 调用', () => {
        const versionRunner = mockRunner({ '--version': { status: 0, stdout: 'git version 2.42.0\n' } });
        expect(detectGit(versionRunner)).toEqual({ installed: true, version: '2.42.0' });
        expect(typeof isGitRepository).toBe('function');
        expect(typeof findParentRepository).toBe('function');
        expect(probeInstallers(() => ({ status: 1 }), 'linux')).toEqual([]);
    });
});
