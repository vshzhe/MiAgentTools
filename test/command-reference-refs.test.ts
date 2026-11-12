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
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    getSkillTemplates,
    getCommandTemplates,
    getKnownCommandIds,
} from '../src/core/templates/index.js';
import {
    codexSkillRef,
    extractCommandRefIds,
    rewriteCommandRefs,
} from '../src/core/templates/command-references.js';
import { AI_TOOLS } from '../src/core/config.js';
import { resolveWorkflows } from '../src/core/profiles.js';
import { normalizeHostSkillRefs } from '../src/core/command-generation/host-refs.js';

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
    // spec-verify-proposal 不在此列 —— 它由 DEPS 随装、属无条件必需委派，必须由 DEPS 覆盖。
    // requirement-doc 已随需求文档桥整体移除，不再出现在任何委派面。
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

    it('Skill(...) 条目均对应已注册技能（canonical 形态）', () => {
        const registered = new Set(
            skills.map((s) => s.template.name.replace(/^iagent_/, 'iagent-').replaceAll('_', '-'))
        );
        const offenders: string[] = [];
        for (const { template } of skills) {
            for (const m of template.allowedTools.matchAll(/Skill\(([a-zA-Z0-9:-]+)\)/g)) {
                const raw = m[1];
                if (!/^iagent-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw)) {
                    offenders.push(`${template.name}: Skill(${raw}) 不是 canonical 形态`);
                    continue;
                }
                if (!registered.has(raw)) {
                    offenders.push(`${template.name}: Skill(${raw}) → 未注册`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('无条件委派技能由 DEPS 覆盖（随装）', () => {
        const offenders: string[] = [];
        for (const { template, commandId } of skills) {
            const conditional = new Set(CONDITIONAL_DELEGATIONS[template.name] ?? []);
            const delegated = [...template.allowedTools.matchAll(/Skill\(([a-zA-Z0-9:-]+)\)/g)]
                .map((m) => m[1].replace(/^iagent-/, ''))
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

    it('条件委派表与正文实际委派一致（debug 条件委派 test，三方均无 requirement-doc）', () => {
        const bySkillName = new Map(
            getSkillTemplates().map(({ template }) => [template.name, template])
        );
        // debug 的正文确实条件委派 test 与 proposal_review（白名单为 canonical 形态）
        const debugTools = bySkillName.get('iagent_debug')?.allowedTools ?? '';
        expect(CONDITIONAL_DELEGATIONS.iagent_debug).toContain('test');
        expect(debugTools).toContain('Skill(iagent-test)');
        expect(debugTools).toContain('Skill(iagent-proposal-review)');
        // 需求文档桥已移除：任何父流程都不再委派需求文档技能
        expect(debugTools).not.toContain('Skill(iagent-requirement-doc)');
        expect(CONDITIONAL_DELEGATIONS.iagent_spec_propose).toBeUndefined();
        const proposeTools = bySkillName.get('iagent_spec_propose')?.allowedTools ?? '';
        expect(proposeTools).not.toContain('Skill(iagent-requirement-doc)');
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

// 变更 fix-multi-agent-skill-command-generation / 任务 1.1 / 1.4：Codex skills-only 改写。
describe('Codex skills-only 布局改写与 undefined 向后兼容', () => {
    const ids = getKnownCommandIds();

    it('codexSkillRef 产出宿主原生技能引用 $iagent-<id>', () => {
        expect(codexSkillRef('spec-apply')).toBe('$iagent-spec-apply');
    });

    it('skills-only：已知 id 改写为 $iagent-<id>，未知名保持原样', () => {
        expect(
            rewriteCommandRefs(
                '运行 /iagent:spec-apply 与 /iagent:unknown',
                'skills-only',
                new Set(['spec-apply'])
            )
        ).toBe('运行 $iagent-spec-apply 与 /iagent:unknown');
    });

    it('layout === undefined 时返回原字符串（向后兼容）', () => {
        expect(rewriteCommandRefs('/iagent:spec-apply', undefined, ids)).toBe('/iagent:spec-apply');
    });

    it('references 附加文件内容与主正文同一改写规则', () => {
        const refContent = '详见 /iagent:spec-apply 与 /iagent:spec-verify';
        expect(rewriteCommandRefs(refContent, 'skills-only', ids)).toBe(
            '详见 $iagent-spec-apply 与 $iagent-spec-verify'
        );
    });

    it('AI_TOOLS 的 codex 条目配置为 skills-only 且无指令目录', () => {
        const codex = AI_TOOLS.find((tool) => tool.value === 'codex');
        expect(codex?.commandsDir).toBe('');
        expect(codex?.commandsLayout).toBe('skills-only');
    });
});

// 变更 fix-multi-agent-skill-command-generation / 任务 1.1 / 1.2：
// 布局矩阵（含重复应用幂等）与技能 ID 归一化单点。
describe('rewriteCommandRefs 布局全矩阵与幂等', () => {
    const ids = getKnownCommandIds();
    const canonical = '/iagent:spec-apply /iagent:unknown /iagent:spec-verify';

    it('四种布局矩阵：namespace-dir / undefined 原样，prefixed-file 与 skills-only 仅改写已知 id', () => {
        expect(rewriteCommandRefs(canonical, 'namespace-dir', ids)).toBe(canonical);
        expect(rewriteCommandRefs(canonical, undefined, ids)).toBe(canonical);
        expect(rewriteCommandRefs(canonical, 'prefixed-file', ids)).toBe(
            '/iagent-spec-apply /iagent:unknown /iagent-spec-verify'
        );
        expect(rewriteCommandRefs(canonical, 'skills-only', ids)).toBe(
            '$iagent-spec-apply /iagent:unknown $iagent-spec-verify'
        );
    });

    it('重复应用幂等：改写后的文本不再含规范形引用，二次改写不变', () => {
        for (const layout of ['prefixed-file', 'skills-only'] as const) {
            const once = rewriteCommandRefs(canonical, layout, ids);
            expect(rewriteCommandRefs(once, layout, ids)).toBe(once);
            // 已知 id 的规范形引用已被消费；未知名保留原样（故仍可被提取到）
            expect(extractCommandRefIds(once)).toEqual(['unknown']);
        }
    });

    it('大小写与已改写形态不受影响（不做静默大小写归一化）', () => {
        const text = '/iagent:Spec-Apply 与 $iagent-spec-apply';
        expect(rewriteCommandRefs(text, 'skills-only', ids)).toBe(text);
        expect(rewriteCommandRefs(text, 'prefixed-file', ids)).toBe(text);
    });

    it('空 id 集下仅保留原字符串（未知名一律不动）', () => {
        expect(rewriteCommandRefs('/iagent:spec-apply', 'skills-only', new Set())).toBe(
            '/iagent:spec-apply'
        );
    });
});

describe('技能 ID 归一化单点（normalizeHostSkillRefs）', () => {
    it('多段下划线 legacy 名归一化为 canonical kebab-case', () => {
        expect(normalizeHostSkillRefs('iagent_spec_verify_proposal')).toBe(
            'iagent-spec-verify-proposal'
        );
        expect(normalizeHostSkillRefs('委派 iagent_test 与 `iagent_review`')).toBe(
            '委派 iagent-test 与 `iagent-review`'
        );
    });

    it('canonical 形态与裸前缀不被改写，且幂等', () => {
        expect(normalizeHostSkillRefs('iagent-spec-apply')).toBe('iagent-spec-apply');
        // 前缀后无 id：不构成技能名
        expect(normalizeHostSkillRefs('iagent_ 之后')).toBe('iagent_ 之后');
        const once = normalizeHostSkillRefs('iagent_feature_doc 与 iagent_spec_apply');
        expect(once).toBe('iagent-feature-doc 与 iagent-spec-apply');
        expect(normalizeHostSkillRefs(once)).toBe(once);
    });

    it('非词首的 `iagent_` 子串不受影响（词边界约束）', () => {
        expect(normalizeHostSkillRefs('my_iagent_x')).toBe('my_iagent_x');
    });
});

// 变更 fix-multi-agent-skill-command-generation / 任务 1.3 / 1.4：源码卫生回归锁。
describe('模板源码卫生：无硬编码宿主路径与废弃 version', () => {
    const WORKFLOWS_DIR = path.join(process.cwd(), 'src', 'core', 'templates', 'workflows');
    const templateFiles = fs
        .readdirSync(WORKFLOWS_DIR)
        .filter((name) => name.endsWith('.ts'))
        .map((name) => ({
            name,
            text: fs.readFileSync(path.join(WORKFLOWS_DIR, name), 'utf8'),
        }));

    it('全部 22 个技能模板与 generate 命令骨架不含 metadata version', () => {
        const offenders = templateFiles
            .filter(({ text }) => /version:\s*'1\.0'/.test(text))
            .map(({ name }) => name);
        const generateSource = fs.readFileSync(
            path.join(process.cwd(), 'src', 'commands', 'generate.ts'),
            'utf8'
        );
        expect(offenders).toEqual([]);
        expect(generateSource).not.toMatch(/version:\s*'1\.0'/);
    });

    it('模板正文与 references 无硬编码 .claude/skills/ 路径', () => {
        const offenders: string[] = [];
        for (const { template } of getSkillTemplates()) {
            const corpus = `${template.name}\n${template.instructions}\n` +
                (template.references ?? []).map((ref) => ref.content).join('\n');
            if (corpus.includes('.claude/skills/')) {
                offenders.push(template.name);
            }
        }
        expect(offenders).toEqual([]);
    });

    it('模板正文与 references 无 Claude 专属「经 Skill 工具委派」表述', () => {
        const offenders: string[] = [];
        for (const { template } of getSkillTemplates()) {
            const corpus = `${template.instructions}\n` +
                (template.references ?? []).map((ref) => ref.content).join('\n');
            if (corpus.includes('经 `Skill` 工具')) {
                offenders.push(template.name);
            }
        }
        expect(offenders).toEqual([]);
    });
});
