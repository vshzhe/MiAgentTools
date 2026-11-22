/**
 * rule-loading-contract：技能正文三层读取契约 + 未读声明 + handoff 分层蒸馏。
 *
 * 覆盖能力 `rule-loading-contract`、`rule-baseline`、`project-skill-consumption` 的模板侧 Scenario。
 */

import { describe, it, expect } from 'vitest';
import { getSpecExploreSkillTemplate } from '../src/core/templates/workflows/spec-explore.js';
import { getDebugSkillTemplate } from '../src/core/templates/workflows/debug.js';
import { getSpecApplyChangeSkillTemplate } from '../src/core/templates/workflows/spec-apply.js';
import { getSpecVerifyChangeSkillTemplate } from '../src/core/templates/workflows/spec-verify.js';
import { getReviewSkillTemplate } from '../src/core/templates/workflows/review.js';
import { getSpecProposeSkillTemplate } from '../src/core/templates/workflows/spec-propose.js';
import { getTestSkillTemplate } from '../src/core/templates/workflows/test.js';
import { DYNAMIC_RULE_LOADING_FULL } from '../src/core/templates/rule-loading-protocol.js';

/** 把技能的 references 内容拼入正文（渐进披露：细则可能在 references 中） */
function fullText(skill: { instructions: string; references?: { content: string }[] }): string {
    return [skill.instructions, ...(skill.references ?? []).map((ref) => ref.content)].join('\n');
}

describe('技能正文三层读取契约', () => {
    it('Scenario: 探索阶段按层读取（spec-explore）', () => {
        const text = fullText(getSpecExploreSkillTemplate());
        expect(text).toContain('iagent rules --json --type spec');
        expect(text).toContain('iagent skills --json --phase design');
        expect(text).toContain('always');
        expect(text).toContain('phase');
        expect(text).toContain('onDemand');
        // MUST NOT 全量读取
        expect(text).toContain('MUST NOT 读取全部存在源');
        // 细则可通过 references 加载
        expect(text).toContain('references/dynamic-rule-loading.md');
    });

    it('Scenario: 审查阶段按层读取（review）', () => {
        const text = fullText(getReviewSkillTemplate());
        expect(text).toContain('iagent rules --json --type review');
        expect(text).toContain('MUST NOT 全量读取全部规则源');
    });

    it('debug 三层读取', () => {
        const text = fullText(getDebugSkillTemplate());
        expect(text).toContain('iagent rules --json --type impl');
        expect(text).toContain('iagent skills --json --phase design');
        expect(text).toContain('MUST NOT 回退全量');
    });

    it('spec-apply 三层读取 + skillsSkipped', () => {
        const text = fullText(getSpecApplyChangeSkillTemplate());
        expect(text).toContain('iagent rules --json --type impl');
        expect(text).toContain('iagent skills --json --phase implement');
        expect(text).toContain('skillsSkipped');
        expect(text).toContain('MUST NOT 全量读取');
    });

    it('spec-verify 三层读取', () => {
        const text = fullText(getSpecVerifyChangeSkillTemplate());
        expect(text).toContain('iagent rules --json --type spec');
        expect(text).toContain('MUST NOT 全量读取');
    });

    it('Scenario: 既有最佳实践保持（test 不退化为全量）', () => {
        const text = fullText(getTestSkillTemplate());
        expect(text).toContain('iagent rules --json --type test');
        expect(text).toContain('testing-rules.md');
        expect(text).toContain('MUST NOT 全量读取全部规则源');
        expect(text).toContain('三层契约的最小范例');
    });
});

describe('未读声明', () => {
    it('Scenario: 逐源声明（相关性 / 读取 / 理由列）', () => {
        expect(DYNAMIC_RULE_LOADING_FULL).toContain('| 源 | 相关性 | 存在 | 读取 |');
        expect(DYNAMIC_RULE_LOADING_FULL).toContain('关键约束摘要 / 不需要读的理由');
        expect(DYNAMIC_RULE_LOADING_FULL).toContain('声明为「需要读」但未读');
    });

    it('Scenario: 漏读被判定', () => {
        expect(DYNAMIC_RULE_LOADING_FULL).toContain('rules-not-read` 并 fail');
    });

    it('Scenario: 显式不需要读不 fail', () => {
        expect(DYNAMIC_RULE_LOADING_FULL).toContain('声明「不需要读」→ not-fail');
    });

    it('相关性判据存在（不确定时宁读勿漏）', () => {
        expect(DYNAMIC_RULE_LOADING_FULL).toContain('不确定时');
        expect(DYNAMIC_RULE_LOADING_FULL).toContain('宁读勿漏');
    });

    it('fallback 处置：不扩为全量', () => {
        expect(DYNAMIC_RULE_LOADING_FULL).toContain('MUST NOT 回退为全量读取');
    });
});

describe('handoff 规范要点按相关性分层蒸馏', () => {
    it('Scenario: 分层蒸馏 + 指针保留', () => {
        const text = fullText(getSpecProposeSkillTemplate());
        expect(text).toContain('按相关性分层蒸馏');
        expect(text).toContain('指针 + 一行摘要');
        expect(text).toContain('always');
        expect(text).toContain('phase');
    });

    it('Scenario: 不丢弃任何存在源', () => {
        const text = fullText(getSpecProposeSkillTemplate());
        expect(text).toContain('MUST NOT 静默丢弃任一存在源');
        // 旧的全量硬要求已改写
        expect(text).toContain('指针即保留');
    });

    it('来源清单仍须覆盖全部存在源', () => {
        const text = fullText(getSpecProposeSkillTemplate());
        expect(text).toContain('MUST 覆盖全部存在源');
    });
});

describe('rule-baseline 探索阶段三层读取', () => {
    it('Scenario: 探索起点建立规则基线（含相关性层级）', () => {
        const text = fullText(getSpecExploreSkillTemplate());
        expect(text).toContain('## 项目规则基线');
        expect(text).toContain('相关性');
        expect(text).toContain('--type spec');
    });

    it('Scenario: 全部规则源缺失不阻断', () => {
        const text = fullText(getSpecExploreSkillTemplate());
        expect(text).toContain('全部源缺失 → 记「无规则源」并继续');
    });
});
