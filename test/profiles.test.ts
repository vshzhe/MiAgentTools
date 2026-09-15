/**
 * profiles 核心解析测试：默认集 / 用户配置 / 依赖注入。
 */

import { describe, it, expect } from 'vitest';
import { resolveWorkflows, DEFAULT_WORKFLOWS, DEPS } from '../src/core/profiles.js';

describe('resolveWorkflows', () => {
    it('未配置（undefined）返回默认集 9 项，无注入', () => {
        const result = resolveWorkflows(undefined);
        expect(result.workflows).toEqual([...DEFAULT_WORKFLOWS]);
        expect(result.injected).toEqual([]);
        expect(result.workflows.length).toBe(9);
    });

    it('空数组视为未配置，返回默认集', () => {
        const result = resolveWorkflows([]);
        expect(result.workflows).toEqual([...DEFAULT_WORKFLOWS]);
        expect(result.injected).toEqual([]);
    });

    it('用户配置子集完全覆盖默认集（非合并）', () => {
        const result = resolveWorkflows(['tr-impl-feature', 'spec-explore']);
        expect(result.workflows).toEqual(['tr-impl-feature', 'spec-explore']);
        expect(result.injected).toEqual([]);
    });

    it('spec-propose 注入 spec-verify-proposal', () => {
        const result = resolveWorkflows(['spec-propose']);
        expect(result.workflows).toContain('spec-propose');
        expect(result.workflows).toContain('spec-verify-proposal');
        expect(result.injected).toEqual(['spec-verify-proposal']);
    });

    it('spec-archive 注入 spec-verify', () => {
        const result = resolveWorkflows(['spec-archive']);
        expect(result.workflows).toContain('spec-archive');
        expect(result.workflows).toContain('spec-verify');
        expect(result.injected).toEqual(['spec-verify']);
    });

    it('tr-impl-auto-migration 注入两子技能', () => {
        const result = resolveWorkflows(['tr-impl-auto-migration']);
        expect(result.workflows).toContain('tr-impl-auto-migration');
        expect(result.workflows).toContain('tr-docs-feature-doc');
        expect(result.workflows).toContain('tr-impl-migration-check');
        expect(result.injected).toEqual(['tr-docs-feature-doc', 'tr-impl-migration-check']);
    });

    it('已含一子技能时仅补缺失项', () => {
        const result = resolveWorkflows(['tr-impl-auto-migration', 'tr-impl-migration-check']);
        expect(result.injected).toEqual(['tr-docs-feature-doc']);
        expect(result.workflows).toEqual(['tr-impl-auto-migration', 'tr-impl-migration-check', 'tr-docs-feature-doc']);
    });

    it('无 auto-migration 不注入子技能', () => {
        const result = resolveWorkflows(['tr-docs-feature-doc']);
        expect(result.workflows).toEqual(['tr-docs-feature-doc']);
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

    it('DEPS 规则表含 propose/archive/bulk-archive/auto-migration/workflow/genfull 套件八条', () => {
        expect(Object.keys(DEPS).sort()).toEqual([
            'spec-archive',
            'spec-bulk-archive',
            'spec-propose',
            'tr-impl-auto-migration',
            'tr-impl-auto-workflow',
            'tr-impl-debug',
            'tr-impl-genfull',
            'tr-impl-workflow',
        ]);
    });

    it('tr-impl-workflow 注入深度复查与需求文档两技能', () => {
        const result = resolveWorkflows(['tr-impl-workflow']);
        expect(result.workflows).toContain('tr-impl-workflow');
        expect(result.workflows).toContain('tr-impl-review-proposal');
        expect(result.workflows).toContain('tr-docs-requirement-doc');
        expect(result.injected).toEqual(['tr-impl-review-proposal', 'tr-docs-requirement-doc']);
    });

    it('tr-impl-auto-workflow 连带补全传递依赖（不动点迭代）', () => {
        const result = resolveWorkflows(['tr-impl-auto-workflow']);
        expect(result.workflows).toContain('tr-impl-auto-workflow');
        expect(result.workflows).toContain('tr-impl-workflow');
        expect(result.workflows).toContain('tr-docs-requirement-doc');
        expect(result.workflows).toContain('tr-impl-review-proposal');
        expect(result.injected).toEqual(['tr-impl-workflow', 'tr-docs-requirement-doc', 'tr-impl-review-proposal']);
    });

    it('tr-impl-genfull 注入八阶段技能并连带传递依赖（不动点迭代）', () => {
        const result = resolveWorkflows(['tr-impl-genfull']);
        expect(result.workflows).toContain('tr-impl-genfull');
        // 8 个显式阶段技能
        for (const dep of [
            'spec-explore',
            'spec-propose',
            'spec-apply',
            'spec-archive',
            'tr-impl-frontend',
            'tr-test-gentest-java',
            'tr-impl-review-proposal',
            'tr-docs-requirement-doc',
        ]) {
            expect(result.workflows).toContain(dep);
        }
        // 传递注入：spec-verify-proposal（via spec-propose）、spec-verify（via spec-archive）
        expect(result.workflows).toContain('spec-verify-proposal');
        expect(result.workflows).toContain('spec-verify');
        // 注入顺序：8 显式在前，2 传递在后
        expect(result.injected).toEqual([
            'spec-explore',
            'spec-propose',
            'spec-apply',
            'spec-archive',
            'tr-impl-frontend',
            'tr-test-gentest-java',
            'tr-impl-review-proposal',
            'tr-docs-requirement-doc',
            'spec-verify-proposal',
            'spec-verify',
        ]);
    });

    it('tr-impl-debug 注入需求文档与提案评分两技能', () => {
        const result = resolveWorkflows(['tr-impl-debug']);
        expect(result.workflows).toContain('tr-impl-debug');
        expect(result.workflows).toContain('tr-docs-requirement-doc');
        expect(result.workflows).toContain('spec-verify-proposal');
        expect(result.injected).toEqual(['tr-docs-requirement-doc', 'spec-verify-proposal']);
    });
});
