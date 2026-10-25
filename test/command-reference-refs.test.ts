/**
 * 模板正文指令引用单一源与死引用校验。
 *
 * 锁定三件事（对应变更 improve-template-generation-consistency 的
 * `模板正文指令引用 SHALL 单一源并可生成期校验`）：
 *   1. `KNOWN_COMMAND_IDS` 由注册表派生（单一真源）
 *   2. 技能正文 / 指令正文中的 `/iagent:<id>` 引用均为已注册 id（未注册即失败）
 *   3. `Skill(...)` 条目对应已注册技能，且无条件委派由 `DEPS` 覆盖（随装）
 *
 * 条件委派（模板内含运行时降级路径，如 project-init 委派 feature_doc）不要求
 * DEPS 覆盖 —— 见 CONDITIONAL_DELEGATIONS。
 */

import { describe, it, expect } from 'vitest';
import {
    getSkillTemplates,
    getCommandTemplates,
    getKnownCommandIds,
} from '../src/core/templates/index.js';
import { extractCommandRefIds, rewriteCommandRefs } from '../src/core/templates/command-references.js';
import { SKILL_PREFIX } from '../src/core/config.js';
import { resolveWorkflows } from '../src/core/profiles.js';

/** 条件委派（模板内含"委派不可得→自行降级"路径）：不要求 DEPS 覆盖 */
const CONDITIONAL_DELEGATIONS: Record<string, readonly string[]> = {
    // project-init：委派 feature_doc 生成文档，不可得时自行扫描（模板含降级路径一）
    iagent_project_init: ['feature-doc'],
    // workflow：仅当 tasks 含 [测试] 任务时条件委派 test
    iagent_workflow: ['test'],
    // auto-workflow：仅当 tasks 含 [测试] 任务时条件委派 test
    iagent_auto_workflow: ['test'],
    // debug：深度复查委派 proposal_review，不可用时内联复查；回归测试委派 test，
    // strict 缺能阻断、仅显式 degraded 允许本地编写。
    // spec-verify-proposal / requirement-doc 不在此列 —— 它们由 DEPS 随装、属无条件必需委派，
    // 必须由 DEPS 覆盖（删除 DEPS 条目即触发下方覆盖校验失败）。
    iagent_debug: ['proposal-review', 'test'],
};

describe('模板正文指令引用单一源与死引用校验', () => {
    const skills = getSkillTemplates();
    const commands = getCommandTemplates();
    const knownIds = getKnownCommandIds();

    it('KNOWN_COMMAND_IDS 与注册表派生一致（单一真源）', () => {
        expect(knownIds.size).toBe(skills.length);
        for (const { commandId } of skills) {
            expect(knownIds.has(commandId)).toBe(true);
        }
    });

    it('技能正文中的 /iagent:<id> 引用均为已注册 id', () => {
        const offenders: string[] = [];
        for (const { template } of skills) {
            for (const id of extractCommandRefIds(template.instructions)) {
                if (!knownIds.has(id)) {
                    offenders.push(`${template.name}: /iagent:${id}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('指令正文中的 /iagent:<id> 引用均为已注册 id', () => {
        const offenders: string[] = [];
        for (const { template, id } of commands) {
            for (const ref of extractCommandRefIds(template.content)) {
                if (!knownIds.has(ref)) {
                    offenders.push(`${id}: /iagent:${ref}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('历史断链已修复（无 commit-change / review-code 残留）', () => {
        const all = skills.map((s) => s.template.instructions).join('\n')
            + commands.map((c) => c.template.content).join('\n');
        expect(all.includes('/iagent:commit-change')).toBe(false);
        expect(all.includes('/iagent:review-code')).toBe(false);
    });

    it('Skill(...) 条目均对应已注册技能', () => {
        const registered = new Set(skills.map((s) => s.template.name));
        const offenders: string[] = [];
        for (const { template } of skills) {
            for (const m of template.allowedTools.matchAll(/Skill\(([a-z_]+)\)/g)) {
                const skillName = `${SKILL_PREFIX}${m[1]}`;
                if (!registered.has(skillName)) {
                    offenders.push(`${template.name}: Skill(${m[1]}) → ${skillName} 未注册`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('无条件委派技能由 DEPS 覆盖（随装）', () => {
        const offenders: string[] = [];
        for (const { template, commandId } of skills) {
            const conditional = new Set(CONDITIONAL_DELEGATIONS[template.name] ?? []);
            const delegated = [...template.allowedTools.matchAll(/Skill\(([a-z_]+)\)/g)]
                .map((m) => m[1].replaceAll('_', '-'))
                .filter((id) => !conditional.has(id));
            if (delegated.length === 0) {
                continue;
            }
            const resolved = new Set(resolveWorkflows([commandId]).workflows);
            for (const dep of delegated) {
                if (!resolved.has(dep)) {
                    offenders.push(`${template.name}(${commandId}) 委派 ${dep} 但 DEPS 未覆盖`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('条件委派表与正文实际委派一致（debug 增列 test，spec-propose 移除 requirement-doc）', () => {
        const bySkillName = new Map(
            getSkillTemplates().map(({ template }) => [template.name, template])
        );
        // debug 的正文确实条件委派 test 与 requirement_doc
        const debugTools = bySkillName.get('iagent_debug')?.allowedTools ?? '';
        expect(CONDITIONAL_DELEGATIONS.iagent_debug).toContain('test');
        expect(debugTools).toContain('Skill(test)');
        expect(debugTools).toContain('Skill(requirement_doc)');
        // spec-propose 独立调用不再委派需求文档技能（非目标收窄）
        expect(CONDITIONAL_DELEGATIONS.iagent_spec_propose).toBeUndefined();
        const proposeTools = bySkillName.get('iagent_spec_propose')?.allowedTools ?? '';
        expect(proposeTools).not.toContain('Skill(requirement_doc)');
    });
});

describe('rewriteCommandRefs 按工具布局改写', () => {
    it('prefixed-file：改写已知 id，未知名保持原样', () => {
        const ids = new Set(['spec-apply']);
        expect(rewriteCommandRefs('/iagent:spec-apply 与 /iagent:foo', 'prefixed-file', ids)).toBe(
            '/iagent-spec-apply 与 /iagent:foo'
        );
    });

    it('namespace-dir 与未指定：保持规范形', () => {
        const ids = new Set(['spec-apply']);
        expect(rewriteCommandRefs('/iagent:spec-apply', 'namespace-dir', ids)).toBe('/iagent:spec-apply');
        expect(rewriteCommandRefs('/iagent:spec-apply', undefined, ids)).toBe('/iagent:spec-apply');
    });
});
