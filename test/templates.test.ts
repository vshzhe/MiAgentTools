/**
 * 模板层测试：命名规范、7 类完整性、frontmatter 结构。
 */

import { describe, it, expect } from 'vitest';
import { getSkillTemplates, getCommandTemplates, deriveCommandId, countSkillsByType } from '../src/core/templates/index.js';
import { SKILL_PREFIX, SKILL_TYPE_IDS, isSkillType } from '../src/core/config.js';

describe('模板注册表', () => {
    const skills = getSkillTemplates();
    const commands = getCommandTemplates();

    it('内置 8 个技能（7 类 + tr_tools 双技能）', () => {
        expect(skills.length).toBe(8);
    });

    it('全部技能名以 venus_ 开头', () => {
        for (const { template } of skills) {
            expect(template.name.startsWith(SKILL_PREFIX)).toBe(true);
        }
    });

    it('7 类类型全部有技能覆盖', () => {
        const coveredTypes = new Set(skills.map((s) => s.template.type));
        expect([...coveredTypes].sort()).toEqual([...SKILL_TYPE_IDS].sort());
    });

    it('技能名的类型段与其 type 字段一致', () => {
        for (const { template } of skills) {
            const segments = template.name.slice(SKILL_PREFIX.length).split('_');
            const typeSegment = `${segments[0]}_${segments[1]}`;
            expect(typeSegment).toBe(template.type);
        }
    });

    it('每个技能均有描述与正文', () => {
        for (const { template } of skills) {
            expect(template.description.length).toBeGreaterThan(10);
            expect(template.instructions.length).toBeGreaterThan(50);
        }
    });

    it('venus_tr_tools_pwd 技能存在且属于 tr_tools 类型', () => {
        const pwd = skills.find((s) => s.template.name === 'venus_tr_tools_pwd');
        expect(pwd).toBeDefined();
        expect(pwd?.template.type).toBe('tr_tools');
    });

    it('指令数量与技能一一对应', () => {
        expect(commands.length).toBe(skills.length);
        expect(commands.map((c) => c.id)).toEqual(skills.map((s) => s.commandId));
    });

    it('指令 id 派生规则：venus_tr_tools_pwd → tr-tools-pwd', () => {
        expect(deriveCommandId('venus_tr_tools_pwd')).toBe('tr-tools-pwd');
        expect(deriveCommandId('venus_tr_init_project')).toBe('tr-init-project');
    });

    it('非法前缀的技能名在派生时抛错', () => {
        expect(() => deriveCommandId('openspec_explore')).toThrow(/venus_/);
    });

    it('按类型过滤生效', () => {
        expect(getSkillTemplates('tr_tools').map((s) => s.template.name)).toEqual([
            'venus_tr_tools_pwd',
            'venus_tr_tools_list',
        ]);
        expect(getCommandTemplates('tr_init').map((c) => c.id)).toEqual(['tr-init-project']);
    });

    it('类型统计覆盖全部 7 类', () => {
        const counts = countSkillsByType();
        expect(counts.size).toBe(7);
        expect(counts.get('tr_tools')).toBe(2);
        expect(counts.get('tr_init')).toBe(1);
    });

    it('isSkillType 校验', () => {
        expect(isSkillType('tr_init')).toBe(true);
        expect(isSkillType('tr_unknown')).toBe(false);
    });
});
