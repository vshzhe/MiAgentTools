/**
 * rule-selection：规则三层归类 + 技能阶段/范围筛选 + fallback（动态加载内核）。
 *
 * 覆盖能力 `rule-selection` 的全部 Scenario。
 */

import { describe, it, expect } from 'vitest';
import {
    classifyRuleSources,
    selectSkillEntries,
    hasRuleFileFor,
    type RuleSourceLike,
    type SkillEntryLike,
} from '../src/core/rule-selection.js';
import { RULE_FILE_NAMES, ruleFileNameFor } from '../src/core/project-config.js';

/** 构造规则源（默认存在） */
function source(path: string, kind: RuleSourceLike['kind'], exists = true): RuleSourceLike {
    return { path, kind, exists };
}

const FULL_SOURCES: RuleSourceLike[] = [
    source('.iagent/config.yaml', 'config'),
    source('.iagent/rules/coding-rules.md', 'rule-file'),
    source('.iagent/rules/testing-rules.md', 'rule-file'),
    source('.iagent/rules/spec.md', 'rule-file'),
    source('CLAUDE.md', 'claude-md'),
    source('AGENTS.md', 'agents-md'),
];

describe('规则源三层归类', () => {
    it('Scenario: 按技能类型归类（type=test）', () => {
        const result = classifyRuleSources(FULL_SOURCES, { type: 'test' });
        // 常驻基线三项
        expect(result.always.map((item) => item.path)).toEqual([
            '.iagent/config.yaml',
            'CLAUDE.md',
            'AGENTS.md',
        ]);
        // 阶段相关只有 testing-rules
        expect(result.phase.map((item) => item.path)).toEqual(['.iagent/rules/testing-rules.md']);
        // 其余进 onDemand
        expect(result.onDemand.map((item) => item.path)).toEqual([
            '.iagent/rules/coding-rules.md',
            '.iagent/rules/spec.md',
        ]);
        expect(result.fallback).toBe(false);
    });

    it('Scenario: 类型映射走单一源', () => {
        // 对每个有映射的类型，phase 层命中的文件必等于 ruleFileNameFor(type)
        for (const type of Object.keys(RULE_FILE_NAMES) as Array<keyof typeof RULE_FILE_NAMES>) {
            const result = classifyRuleSources(FULL_SOURCES, { type });
            const expected = `.iagent/rules/${ruleFileNameFor(type)}`;
            expect(result.phase.map((item) => item.path)).toEqual([expected]);
        }
    });

    it('Scenario: 常驻基线不受类型影响', () => {
        for (const type of ['impl', 'test', 'spec', 'review', 'commit'] as const) {
            const result = classifyRuleSources(FULL_SOURCES, { type });
            expect(result.always).toHaveLength(3);
            // 三者不出现在其余层
            const others = [...result.phase, ...result.onDemand].map((item) => item.path);
            expect(others).not.toContain('.iagent/config.yaml');
            expect(others).not.toContain('CLAUDE.md');
            expect(others).not.toContain('AGENTS.md');
        }
    });

    it('不存在的源不进入任何层', () => {
        const result = classifyRuleSources([
            source('.iagent/config.yaml', 'config'),
            source('.iagent/rules/spec.md', 'rule-file', false),
            source('CLAUDE.md', 'claude-md', false),
            source('AGENTS.md', 'agents-md', false),
        ], { type: 'spec' });
        expect(result.always.map((item) => item.path)).toEqual(['.iagent/config.yaml']);
        expect(result.phase).toHaveLength(0);
        expect(result.fallback).toBe(true);
    });

    it('Windows 反斜杠路径同样命中', () => {
        const result = classifyRuleSources([
            source('.iagent\\rules\\spec.md', 'rule-file'),
        ], { type: 'spec' });
        expect(result.phase).toHaveLength(1);
    });
});

describe('筛选为空时回退常驻基线', () => {
    it('Scenario: 无匹配规则文件（commit 无映射且文件不存在）', () => {
        const result = classifyRuleSources(FULL_SOURCES, { type: 'commit' });
        expect(result.phase).toHaveLength(0);
        expect(result.fallback).toBe(true);
        expect(result.fallbackReason).toContain('commit');
        expect(result.always).toHaveLength(3);
    });

    it('Scenario: 回退不扩大为全量', () => {
        const result = classifyRuleSources(FULL_SOURCES, { type: 'commit' });
        // onDemand 仍单独保留，不得被并入回退结果
        expect(result.onDemand.length).toBeGreaterThan(0);
        // 回退只需 always 可用；结果结构中 phase 仍为空
        expect(result.phase).toHaveLength(0);
        expect(result.fallbackReason).toContain('MUST NOT 回退为全量');
    });

    it('未指定类型时回退并说明原因', () => {
        const result = classifyRuleSources(FULL_SOURCES, {});
        expect(result.fallback).toBe(true);
        expect(result.fallbackReason).toContain('未指定技能类型');
    });

    it('hasRuleFileFor 反映映射存在性', () => {
        expect(hasRuleFileFor('impl')).toBe(true);
        expect(hasRuleFileFor('test')).toBe(true);
        expect(hasRuleFileFor('spec')).toBe(true);
        expect(hasRuleFileFor('commit')).toBe(false);
    });
});

describe('技能条目按阶段与范围筛选', () => {
    const entries: SkillEntryLike[] = [
        { name: 'design-be', path: '.iagent/skills/design-be.md', exists: true, phases: 'design', scope: 'backend' },
        { name: 'impl-be', path: '.iagent/skills/impl-be.md', exists: true, phases: 'implement', scope: 'backend' },
        { name: 'both-fe', path: '.iagent/skills/both-fe.md', exists: true, phases: 'both', scope: 'frontend' },
        { name: 'legacy', path: '.iagent/skills/legacy.md', exists: true, phases: 'design', scope: null },
        { name: 'missing', path: '.iagent/skills/missing.md', exists: false, phases: 'design', scope: 'backend' },
    ];

    it('Scenario: 按阶段筛选（implement）', () => {
        const result = selectSkillEntries(entries, { phase: 'implement' });
        expect(result.map((item) => item.name)).toEqual(['impl-be', 'both-fe']);
    });

    it('Scenario: 按阶段筛选（design）', () => {
        const result = selectSkillEntries(entries, { phase: 'design' });
        expect(result.map((item) => item.name)).toEqual(['design-be', 'both-fe', 'legacy']);
    });

    it('Scenario: 按范围筛选（backend）', () => {
        const result = selectSkillEntries(entries, { scope: 'backend' });
        // legacy 的 scope 为 null，不排除
        expect(result.map((item) => item.name)).toEqual(['design-be', 'impl-be', 'legacy']);
    });

    it('阶段与范围组合', () => {
        const result = selectSkillEntries(entries, { phase: 'implement', scope: 'backend' });
        expect(result.map((item) => item.name)).toEqual(['impl-be']);
    });

    it('Scenario: 存量技能无 scope 字段不排除', () => {
        const result = selectSkillEntries(entries, { scope: 'frontend' });
        expect(result.map((item) => item.name)).toContain('legacy');
        expect(result.map((item) => item.name)).toContain('both-fe');
        expect(result.map((item) => item.name)).not.toContain('design-be');
    });

    it('不存在的技能不入选', () => {
        const result = selectSkillEntries(entries);
        expect(result.map((item) => item.name)).not.toContain('missing');
    });

    it('phases 为 null 的条目不匹配任何阶段', () => {
        const withNull: SkillEntryLike[] = [
            { name: 'unlabeled', path: 'x', exists: true, phases: null, scope: null },
        ];
        expect(selectSkillEntries(withNull, { phase: 'design' })).toHaveLength(0);
        // 不带阶段筛选时仍保留
        expect(selectSkillEntries(withNull)).toHaveLength(1);
    });
});
