/**
 * allowed-tools 白名单覆盖性测试。
 *
 * 防止回归：技能正文声明的命令必须在 allowed-tools 白名单中，
 * 否则技能在 Claude Code 中会被权限拦截而无法执行。
 */

import { describe, it, expect } from 'vitest';
import { getSkillTemplates } from '../src/core/templates/index.js';

describe('allowed-tools 白名单覆盖', () => {
    const skills = getSkillTemplates();

    it('每个技能都声明了非空 allowedTools', () => {
        for (const { template } of skills) {
            expect(template.allowedTools.length).toBeGreaterThan(0);
        }
    });

    it('pwd 技能白名单包含 pwd 命令', () => {
        const pwd = skills.find((s) => s.template.name === 'venus_tr_tools_pwd');
        expect(pwd?.template.allowedTools).toContain('Bash(pwd');
    });

    it('commit 技能白名单覆盖 git status/diff/commit', () => {
        const commit = skills.find((s) => s.template.name === 'venus_tr_commit_change');
        const tools = commit?.template.allowedTools ?? '';
        expect(tools).toContain('Bash(git status');
        expect(tools).toContain('Bash(git diff');
        expect(tools).toContain('Bash(git commit');
    });

    it('init 技能白名单包含 ls 探查命令', () => {
        const init = skills.find((s) => s.template.name === 'venus_tr_init_project');
        expect(init?.template.allowedTools).toContain('Bash(ls');
    });

    it('list 技能白名单包含 venus CLI', () => {
        const list = skills.find((s) => s.template.name === 'venus_tr_tools_list');
        expect(list?.template.allowedTools).toContain('Bash(venus');
    });

    it('工作流套件五新技能白名单包含 venus CLI', () => {
        const names = [
            'venus_tr_impl_workflow',
            'venus_tr_impl_auto_workflow',
            'venus_tr_impl_debug',
            'venus_tr_docs_requirement_doc',
            'venus_tr_impl_review_proposal',
        ];
        for (const name of names) {
            const skill = skills.find((s) => s.template.name === name);
            expect(skill?.template.allowedTools.length).toBeGreaterThan(0);
            expect(skill?.template.allowedTools).toContain('Bash(venus');
        }
    });

    it('debug 技能白名单覆盖编译检查命令', () => {
        const debug = skills.find((s) => s.template.name === 'venus_tr_impl_debug');
        const tools = debug?.template.allowedTools ?? '';
        expect(tools).toContain('Bash(pnpm:');
        expect(tools).toContain('Bash(git:');
        expect(tools).toContain('Bash(codegraph:');
    });

    it('生成的 SKILL.md 中 allowed-tools 与模板一致', async () => {
        const { generateSkillContent } = await import('../src/core/command-generation/index.js');
        for (const { template } of skills) {
            const generated = generateSkillContent(template, 'test');
            expect(generated.fileContent).toContain(`allowed-tools: ${template.allowedTools}`);
        }
    });

    it('迁移套件三新技能 allowedTools 非空且包含 CodeGraph', () => {
        const names = [
            'venus_tr_impl_migration_check',
            'venus_tr_impl_auto_migration',
            'venus_tr_docs_feature_doc',
        ];
        for (const name of names) {
            const skill = skills.find((s) => s.template.name === name);
            expect(skill?.template.allowedTools.length).toBeGreaterThan(0);
            expect(skill?.template.allowedTools).toContain('Bash(codegraph:*)');
        }
    });

    it('auto-migration 技能白名单包含 venus CLI', () => {
        const auto = skills.find((s) => s.template.name === 'venus_tr_impl_auto_migration');
        expect(auto?.template.allowedTools).toContain('Bash(venus');
    });
});
