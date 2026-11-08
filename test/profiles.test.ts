/**
 * profiles 核心解析测试：默认集 / 用户配置 / 依赖注入。
 */

import { describe, it, expect } from 'vitest';
import { resolveWorkflows, DEFAULT_WORKFLOWS, DEPS } from '../src/core/profiles.js';

describe('resolveWorkflows', () => {
    it('未配置时默认集 8 显式项且无注入 = 8 项', () => {
        const result = resolveWorkflows(undefined);
        // 归档类不再注入 requirement-doc ⇒ 默认集自身无注入项
        expect(result.workflows).toEqual([...DEFAULT_WORKFLOWS]);
        expect(result.injected).toEqual([]);
        expect(result.workflows.length).toBe(8);
    });

    it('空数组视为未配置，返回默认集 8 项且无注入', () => {
        const result = resolveWorkflows([]);
        expect(result.workflows).toEqual([...DEFAULT_WORKFLOWS]);
        expect(result.injected).toEqual([]);
        expect(result.workflows.length).toBe(8);
    });

    it('用户配置子集完全覆盖默认集（非合并）', () => {
        const result = resolveWorkflows(['review', 'spec-explore']);
        expect(result.workflows).toEqual(['review', 'spec-explore']);
        expect(result.injected).toEqual([]);
    });

    it('spec-propose 注入 spec-verify-proposal', () => {
        const result = resolveWorkflows(['spec-propose']);
        expect(result.workflows).toContain('spec-propose');
        expect(result.workflows).toContain('spec-verify-proposal');
        expect(result.injected).toEqual(['spec-verify-proposal']);
    });

    it('spec-archive 仅注入 spec-verify（不再注入需求文档技能）', () => {
        const result = resolveWorkflows(['spec-archive']);
        expect(result.workflows).toContain('spec-archive');
        expect(result.workflows).toContain('spec-verify');
        expect(result.workflows).not.toContain('requirement-doc');
        expect(result.injected).toEqual(['spec-verify']);
    });

    it('spec-bulk-archive 仅注入 spec-verify（与 spec-archive 对称）', () => {
        const result = resolveWorkflows(['spec-bulk-archive']);
        expect(result.workflows).toContain('spec-bulk-archive');
        expect(result.workflows).toContain('spec-verify');
        expect(result.workflows).not.toContain('requirement-doc');
        expect(result.injected).toEqual(['spec-verify']);
    });

    it('migration 注入两子技能', () => {
        const result = resolveWorkflows(['migration']);
        expect(result.workflows).toContain('migration');
        expect(result.workflows).toContain('feature-doc');
        expect(result.workflows).toContain('migration-check');
        expect(result.injected).toEqual(['feature-doc', 'migration-check']);
    });

    it('已含一子技能时仅补缺失项', () => {
        const result = resolveWorkflows(['migration', 'migration-check']);
        expect(result.injected).toEqual(['feature-doc']);
        expect(result.workflows).toEqual(['migration', 'migration-check', 'feature-doc']);
    });

    it('无 auto-migration 不注入子技能', () => {
        const result = resolveWorkflows(['feature-doc']);
        expect(result.workflows).toEqual(['feature-doc']);
        expect(result.injected).toEqual([]);
    });

    it('spec-apply 注入测试生成技能（[测试] 任务无条件委派）', () => {
        const result = resolveWorkflows(['spec-apply']);
        expect(result.workflows).toEqual(['spec-apply', 'test']);
        expect(result.injected).toEqual(['test']);
        // apply 不注入需求文档技能（无 requirement-doc 委派面）
        expect(result.workflows).not.toContain('requirement-doc');
    });

    it('已含依赖项时不重复注入', () => {
        const result = resolveWorkflows(['spec-propose', 'spec-verify-proposal']);
        expect(result.injected).toEqual([]);
        expect(result.workflows).toEqual(['spec-propose', 'spec-verify-proposal']);
    });

    it('DEPS 规则表含 propose/apply/archive/bulk-archive/migration/workflow 套件条目', () => {
        expect(Object.keys(DEPS).sort()).toEqual([
            'auto-workflow',
            'debug',
            'migration',
            'spec-apply',
            'spec-archive',
            'spec-bulk-archive',
            'spec-propose',
            'workflow',
        ]);
    });

    it('workflow 注入验证/实现/归档技能并连带补全传递依赖（不再注入 requirement-doc）', () => {
        const result = resolveWorkflows(['workflow']);
        expect(result.workflows).toContain('workflow');
        // 6 个显式依赖：探索 + 提案生成 + 验证评分门 + 深度复查 + 实现 + 归档
        for (const dep of ['spec-explore', 'spec-propose', 'spec-verify-proposal', 'proposal-review', 'spec-apply', 'spec-archive']) {
            expect(result.workflows).toContain(dep);
        }
        // 需求文档桥已移除：不再随装需求文档技能
        expect(result.workflows).not.toContain('requirement-doc');
        // 传递注入：test（via spec-apply）与 spec-verify（via spec-archive）
        expect(result.workflows).toContain('spec-verify');
        expect(result.workflows).toContain('test');
        expect(result.injected).toEqual([
            'spec-explore',
            'spec-propose',
            'spec-verify-proposal',
            'proposal-review',
            'spec-apply',
            'spec-archive',
            'test',
            'spec-verify',
        ]);
    });

    it('auto-workflow 连带补全传递依赖（不动点迭代，无 requirement-doc）', () => {
        const result = resolveWorkflows(['auto-workflow']);
        expect(result.workflows).toContain('auto-workflow');
        expect(result.workflows).not.toContain('workflow');
        expect(result.workflows).not.toContain('requirement-doc');
        expect(result.workflows).toContain('proposal-review');
        expect(result.workflows).toContain('spec-apply');
        expect(result.workflows).toContain('spec-archive');
        expect(result.workflows).toContain('spec-verify');
        expect(result.injected).toEqual([
            'spec-explore',
            'spec-propose',
            'spec-verify-proposal',
            'proposal-review',
            'spec-apply',
            'spec-archive',
            'test',
            'spec-verify',
        ]);
    });

    it('debug 仅注入提案评分技能（需求文档桥已整体移除）', () => {
        const result = resolveWorkflows(['debug']);
        expect(result.workflows).toContain('debug');
        expect(result.workflows).toContain('spec-verify-proposal');
        expect(result.workflows).not.toContain('requirement-doc');
        expect(result.injected).toEqual(['spec-verify-proposal']);
    });

    it('debug 注入结果稳定：生效集为 debug + spec-verify-proposal', () => {
        const result = resolveWorkflows(['debug']);
        expect(result.workflows).toEqual(['debug', 'spec-verify-proposal']);
        // test 属条件委派（正文已声明 degraded 本地编写路径），不触发注入
        expect(result.workflows).not.toContain('test');
    });

    it('DEPS.debug 仅含 spec-verify-proposal（无 requirement-doc）', () => {
        expect(DEPS.debug).toEqual(['spec-verify-proposal']);
    });

    it('归档类 DEPS 只含 spec-verify；三父流程均不再声明 requirement-doc', () => {
        expect(DEPS['spec-archive']).toEqual(['spec-verify']);
        expect(DEPS['spec-bulk-archive']).toEqual(['spec-verify']);
        expect(DEPS['workflow']).not.toContain('requirement-doc');
        expect(DEPS['auto-workflow']).not.toContain('requirement-doc');
        expect(DEPS.debug).not.toContain('requirement-doc');
    });

    it('已含 debug 依赖项时不重复注入', () => {
        const result = resolveWorkflows(['debug', 'spec-verify-proposal']);
        expect(result.injected).toEqual([]);
        expect(result.workflows).toEqual(['debug', 'spec-verify-proposal']);
    });
});
