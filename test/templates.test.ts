/**
 * 模板层测试：命名规范、7 类完整性、frontmatter 结构。
 */

import { describe, it, expect } from 'vitest';
import { getSkillTemplates, getCommandTemplates, deriveCommandId, countSkillsByType } from '../src/core/templates/index.js';
import { SKILL_PREFIX, SKILL_TYPE_IDS, isSkillType } from '../src/core/config.js';

describe('模板注册表', () => {
    const skills = getSkillTemplates();
    const commands = getCommandTemplates();

    it('内置 23 个技能（9 类：8 类 tr_* 共 16 技能 + spec 类 7 技能）', () => {
        expect(skills.length).toBe(23);
    });

    it('全部技能名以 venus_ 开头', () => {
        for (const { template } of skills) {
            expect(template.name.startsWith(SKILL_PREFIX)).toBe(true);
        }
    });

    it('9 类类型全部有技能覆盖', () => {
        const coveredTypes = new Set(skills.map((s) => s.template.type));
        expect([...coveredTypes].sort()).toEqual([...SKILL_TYPE_IDS].sort());
    });

    it('技能名的类型段与其 type 字段一致（venus_<type>[_<sub>] 前缀）', () => {
        for (const { template } of skills) {
            // tr_* 类型名为 venus_<type>_<name>（三段），spec 类名为 venus_<type>_<name>（两段），
            // 统一校验：去掉 venus_ 前缀后以 "<type>_" 开头
            expect(template.name.startsWith(`${SKILL_PREFIX}${template.type}_`)).toBe(true);
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

    it('迁移套件三新模板的 commandId 派生正确', () => {
        expect(deriveCommandId('venus_tr_impl_migration_check')).toBe('tr-impl-migration-check');
        expect(deriveCommandId('venus_tr_impl_auto_migration')).toBe('tr-impl-auto-migration');
        expect(deriveCommandId('venus_tr_docs_feature_doc')).toBe('tr-docs-feature-doc');
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

    it('类型统计覆盖全部 9 类', () => {
        const counts = countSkillsByType();
        expect(counts.size).toBe(9);
        expect(counts.get('tr_tools')).toBe(2);
        expect(counts.get('tr_init')).toBe(1);
        expect(counts.get('tr_impl')).toBe(7);
        expect(counts.get('tr_docs')).toBe(2);
        expect(counts.get('spec')).toBe(7);
    });

    it('isSkillType 校验', () => {
        expect(isSkillType('tr_init')).toBe(true);
        expect(isSkillType('tr_unknown')).toBe(false);
    });
});

describe('workflowFilter 过滤', () => {
    it('workflowFilter 按派生 id 过滤技能', () => {
        expect(getSkillTemplates(undefined, ['spec-explore']).map((s) => s.template.name)).toEqual([
            'venus_spec_explore',
        ]);
        expect(getCommandTemplates(undefined, ['tr-init-project']).map((c) => c.id)).toEqual([
            'tr-init-project',
        ]);
    });

    it('workflowFilter 多项过滤保持注册顺序', () => {
        const ids = getSkillTemplates(undefined, ['tr-tools-list', 'spec-apply', 'tr-tools-pwd']).map(
            (s) => s.commandId
        );
        expect(ids).toEqual(['tr-tools-pwd', 'tr-tools-list', 'spec-apply']);
    });

    it('workflowFilter 与 typeFilter 正交叠加', () => {
        // spec 类 6 个中只保留 spec-propose
        expect(
            getSkillTemplates('spec', ['spec-propose', 'tr-impl-feature']).map((s) => s.commandId)
        ).toEqual(['spec-propose']);
        // tr_tools 类 2 个中保留 tr-tools-list
        expect(
            getCommandTemplates('tr_tools', ['tr-tools-list']).map((c) => c.id)
        ).toEqual(['tr-tools-list']);
    });

    it('空数组 workflowFilter 结果为空（显式配置空集）', () => {
        expect(getSkillTemplates(undefined, [])).toEqual([]);
        expect(getCommandTemplates(undefined, [])).toEqual([]);
    });
});
