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
