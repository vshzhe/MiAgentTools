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

    it('生成的 SKILL.md 中 allowed-tools 与模板一致', async () => {
        const { generateSkillContent } = await import('../src/core/command-generation/index.js');
        for (const { template } of skills) {
            const generated = generateSkillContent(template, 'test');
            expect(generated.fileContent).toContain(`allowed-tools: ${template.allowedTools}`);
        }
    });
});
