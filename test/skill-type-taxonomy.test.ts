/**
 * 技能类型体系：预留类型标记与检查类技能归位。
 *
 * 对应变更 improve-skill-type-and-description 的 `agent-tool-identity / 类型 id 集`。
 */

import { describe, it, expect } from 'vitest';
import { SKILL_TYPES, isSkillType } from '../src/core/config.js';
import { getSkillTemplates } from '../src/core/templates/index.js';
import { defaultRuleFileContent } from '../src/core/project-config.js';

describe('技能类型体系（预留标记 + 审查归位）', () => {
    it('类型总数仍为 9（不增删类型）', () => {
        expect(SKILL_TYPES.length).toBe(9);
    });

    it('release/tools 标记为预留，其余为在用', () => {
        const byId = new Map(SKILL_TYPES.map((t) => [t.id, t]));
        expect(byId.get('release')?.reserved).toBe(true);
        expect(byId.get('tools')?.reserved).toBe(true);
        for (const t of SKILL_TYPES) {
            if (t.id !== 'release' && t.id !== 'tools') {
                expect(t.reserved ?? false, t.id).toBe(false);
            }
        }
    });

    it('预留类型仍合法（isSkillType 通过）', () => {
        expect(isSkillType('release')).toBe(true);
        expect(isSkillType('tools')).toBe(true);
        expect(isSkillType('tr_impl')).toBe(false);
    });

    it('检查类技能归入 review 类型', () => {
        const byName = new Map(getSkillTemplates().map((s) => [s.template.name, s.template.type]));
        expect(byName.get('iagent_review')).toBe('review');
        expect(byName.get('iagent_proposal_review')).toBe('review');
        expect(byName.get('iagent_migration_check')).toBe('review');
    });

    it('review 默认规则非空（归位后注入可达）', () => {
        expect(defaultRuleFileContent('review').trim().length).toBeGreaterThan(0);
    });
});
