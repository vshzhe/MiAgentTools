/**
 * 调用类白名单条目 SHALL 经共享常量构造。
 *
 * 对应变更 improve-template-generation-consistency 的 tool-call-whitelist delta：
 * 含 CodeGraph MCP / 技能委派 / 子代理派发条目的技能，其 `allowedTools` MUST 经
 * `tool-whitelist.ts` 的共享常量（`CODEGRAPH_MCP` / `skillDelegation()` /
 * `SUBAGENT_DISPATCH`）构造，MUST NOT 逐模板手写字面量。
 *
 * 该强制只统一来源，不改变授权面（值等价）。
 */

import { describe, it, expect } from 'vitest';
import { getSkillTemplates } from '../src/core/templates/index.js';
import {
    CODEGRAPH_MCP,
    SUBAGENT_DISPATCH,
    skillDelegation,
} from '../src/core/templates/tool-whitelist.js';

describe('调用类白名单条目经共享常量构造', () => {
    const skills = getSkillTemplates();

    it('含 CodeGraph MCP 条目的技能包含 CODEGRAPH_MCP 常量', () => {
        for (const { template } of skills) {
            if (template.allowedTools.includes('mcp__codegraph')) {
                expect(template.allowedTools, template.name).toContain(CODEGRAPH_MCP);
            }
        }
    });

    it('含子代理派发条目的技能包含 SUBAGENT_DISPATCH 常量', () => {
        for (const { template } of skills) {
            const tools = template.allowedTools;
            if (/(^|, )(Agent|Task)(,|$)/.test(tools)) {
                expect(tools, template.name).toContain(SUBAGENT_DISPATCH);
            }
        }
    });

    it('Skill(...) 条目可由 skillDelegation(...) 产出（顺序连续）', () => {
        for (const { template } of skills) {
            const names = [...template.allowedTools.matchAll(/Skill\(([a-z_]+)\)/g)].map((m) => m[1]);
            if (names.length === 0) {
                continue;
            }
            expect(template.allowedTools, template.name).toContain(skillDelegation(names));
        }
    });

    it('不使用 Skill(*) 通配', () => {
        for (const { template } of skills) {
            expect(template.allowedTools, template.name).not.toContain('Skill(*)');
        }
    });
});

describe('debug 文档与回归测试委派授权（4.5）', () => {
    const debug = getSkillTemplates().find(({ template }) => template.name === 'iagent_debug')!;

    /** 白名单条目（逗号分隔 + trim） */
    function parseEntries(allowedTools: string): string[] {
        return allowedTools
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0);
    }

    it('使用共享 skillDelegation 生成精确裸名条目（按正文委派顺序连续）', () => {
        const expected = skillDelegation([
            'spec_verify_proposal',
            'proposal_review',
            'requirement_doc',
            'test',
        ]);
        expect(debug.template.allowedTools).toContain(expected);
    });

    it('无带 iagent_ 前缀的死条目、无通配、条目均对应已注册技能', () => {
        const registered = new Set(getSkillTemplates().map(({ template }) => template.name));
        const entries = parseEntries(debug.template.allowedTools);
        const skillEntries = entries.filter((entry) => entry.startsWith('Skill('));
        expect(skillEntries).toEqual([
            'Skill(spec_verify_proposal)',
            'Skill(proposal_review)',
            'Skill(requirement_doc)',
            'Skill(test)',
        ]);
        for (const entry of skillEntries) {
            const bare = entry.slice('Skill('.length, -1);
            expect(bare.startsWith('iagent_'), `${debug.template.name} 使用带前缀死条目 ${entry}`).toBe(
                false
            );
            expect(registered, `${debug.template.name} 委派未注册技能 ${entry}`).toContain(
                `iagent_${bare}`
            );
        }
        expect(debug.template.allowedTools).not.toContain('Skill(*)');
    });

    it('写类与 Bash 授权面不因新增委派而扩张', () => {
        const entries = parseEntries(debug.template.allowedTools);
        // 写类授权：各一条（委派条目不得夹带新写权限）
        expect(entries.filter((entry) => entry === 'Write')).toEqual(['Write']);
        expect(entries.filter((entry) => entry === 'Edit')).toEqual(['Edit']);
        // Bash 授权面与变更前完全一致
        expect(entries.filter((entry) => entry.startsWith('Bash(')).sort()).toEqual([
            'Bash(cargo:*)',
            'Bash(git:*)',
            'Bash(go:*)',
            'Bash(gradle:*)',
            'Bash(iagent:*)',
            'Bash(mvn:*)',
            'Bash(node:*)',
            'Bash(npm:*)',
            'Bash(pnpm:*)',
            'Bash(tsc:*)',
        ]);
        // 无 Bash(*)
        expect(entries).not.toContain('Bash(*)');
    });
});
