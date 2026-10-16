/**
 * profiles 核心解析测试：默认集 / 用户配置 / 依赖注入。
 */

import { describe, it, expect } from 'vitest';
import { resolveWorkflows, DEFAULT_WORKFLOWS, DEPS } from '../src/core/profiles.js';

describe('resolveWorkflows', () => {
    it('未配置时默认集 8 显式项 + 1 注入 = 9 项', () => {
        const result = resolveWorkflows(undefined);
        // 默认集显式项仍为 8；spec-archive 在集内，其依赖 requirement-doc 被注入
        expect(result.workflows).toEqual([...DEFAULT_WORKFLOWS, 'requirement-doc']);
        expect(result.injected).toEqual(['requirement-doc']);
        expect(result.workflows.length).toBe(9);
    });

    it('空数组视为未配置，返回默认集 8 显式项 + 1 注入 = 9 项', () => {
        const result = resolveWorkflows([]);
        expect(result.workflows).toEqual([...DEFAULT_WORKFLOWS, 'requirement-doc']);
        expect(result.injected).toEqual(['requirement-doc']);
        expect(result.workflows.length).toBe(9);
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

    it('spec-archive 注入 spec-verify 与需求文档技能', () => {
        const result = resolveWorkflows(['spec-archive']);
        expect(result.workflows).toContain('spec-archive');
        expect(result.workflows).toContain('spec-verify');
        expect(result.workflows).toContain('requirement-doc');
        expect(result.injected).toEqual(['spec-verify', 'requirement-doc']);
    });

    it('spec-bulk-archive 注入 spec-verify 与需求文档技能（与 spec-archive 对称）', () => {
        const result = resolveWorkflows(['spec-bulk-archive']);
        expect(result.workflows).toContain('spec-bulk-archive');
        expect(result.workflows).toContain('spec-verify');
        expect(result.workflows).toContain('requirement-doc');
        expect(result.injected).toEqual(['spec-verify', 'requirement-doc']);
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

    it('spec-apply 不触发注入', () => {
        const result = resolveWorkflows(['spec-apply']);
        expect(result.workflows).toEqual(['spec-apply']);
        expect(result.injected).toEqual([]);
    });

    it('已含依赖项时不重复注入', () => {
        const result = resolveWorkflows(['spec-propose', 'spec-verify-proposal']);
        expect(result.injected).toEqual([]);
        expect(result.workflows).toEqual(['spec-propose', 'spec-verify-proposal']);
    });

    it('DEPS 规则表含 propose/archive/bulk-archive/migration/workflow 套件七条', () => {
        expect(Object.keys(DEPS).sort()).toEqual([
            'auto-workflow',
            'debug',
            'migration',
            'spec-archive',
            'spec-bulk-archive',
            'spec-propose',
            'workflow',
        ]);
    });

    it('workflow 注入验证/实现/归档技能并连带补全传递依赖', () => {
        const result = resolveWorkflows(['workflow']);
        expect(result.workflows).toContain('workflow');
        // 6 个显式依赖：探索 + 提案生成 + 验证评分门 + 深度复查 + 实现 + 归档
        for (const dep of ['spec-explore', 'spec-propose', 'spec-verify-proposal', 'proposal-review', 'spec-apply', 'spec-archive']) {
            expect(result.workflows).toContain(dep);
        }
        // 传递注入：spec-verify 与 requirement-doc（via spec-archive）
        expect(result.workflows).toContain('spec-verify');
        expect(result.workflows).toContain('requirement-doc');
        expect(result.injected).toEqual([
            'spec-explore',
            'spec-propose',
            'spec-verify-proposal',
            'proposal-review',
            'spec-apply',
            'spec-archive',
            'spec-verify',
            'requirement-doc',
        ]);
    });

    it('auto-workflow 连带补全传递依赖（不动点迭代）', () => {
        const result = resolveWorkflows(['auto-workflow']);
        expect(result.workflows).toContain('auto-workflow');
        expect(result.workflows).not.toContain('workflow');
        expect(result.workflows).toContain('requirement-doc');
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
            'spec-verify',
            'requirement-doc',
        ]);
    });

    it('debug 仅注入提案评分技能（需求文档不在 debug 范围内）', () => {
        const result = resolveWorkflows(['debug']);
        expect(result.workflows).toContain('debug');
        expect(result.workflows).toContain('spec-verify-proposal');
        expect(result.workflows).not.toContain('requirement-doc');
        expect(result.injected).toEqual(['spec-verify-proposal']);
    });
});
