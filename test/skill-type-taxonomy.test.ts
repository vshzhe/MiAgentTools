/**
 * 技能类型体系：预留类型标记与检查类技能归位。
 *
 * 对应变更 improve-skill-type-and-description 的 `agent-tool-identity / 类型 id 集`。
 */

import { describe, it, expect } from 'vitest';
import { SKILL_TYPES, isSkillType } from '../src/core/config.js';
import { getSkillTemplates } from '../src/core/templates/index.js';
import {
    LEGACY_RULE_FILE_NAMES,
    RULE_FILE_NAMES,
    defaultRuleFileContent,
    ruleFileNameFor,
    ruleFileTypeFor,
} from '../src/core/project-config.js';

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

    it('类型→语义名映射与类型体系一致：映射内三类型 + 映射外回退', () => {
        // 映射单一源：impl / test / spec 三个管理型类型
        expect(Object.keys(RULE_FILE_NAMES).sort()).toEqual(['impl', 'spec', 'test']);
        for (const type of Object.keys(RULE_FILE_NAMES) as (keyof typeof RULE_FILE_NAMES)[]) {
            expect(isSkillType(type), `映射键 ${type} 必须是合法类型 id`).toBe(true);
            // 派生与反查互逆
            expect(ruleFileTypeFor(ruleFileNameFor(type))).toBe(type);
        }
        expect(ruleFileNameFor('impl')).toBe('coding-rules.md');
        expect(ruleFileNameFor('test')).toBe('testing-rules.md');
        expect(ruleFileNameFor('spec')).toBe('spec.md');
        // 映射外类型回退直拼（文件名只由映射决定，不另立清单）
        for (const t of SKILL_TYPES) {
            const expected = RULE_FILE_NAMES[t.id] ?? `${t.id}.md`;
            expect(ruleFileNameFor(t.id), `类型 ${t.id} 的规则文件名`).toBe(expected);
            expect(defaultRuleFileContent(t.id).trim().length).toBeGreaterThan(0);
        }
        // 旧名清单只含本变更改名产生的两枚，且不被反查识别
        expect([...LEGACY_RULE_FILE_NAMES]).toEqual(['impl.md', 'test.md']);
        for (const legacyName of LEGACY_RULE_FILE_NAMES) {
            expect(ruleFileTypeFor(legacyName)).toBeNull();
        }
    });
});
