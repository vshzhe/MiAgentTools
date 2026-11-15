/**
 * 技能渐进披露与尺寸预算。
 *
 * 对应变更 improve-skill-progressive-disclosure 的
 * `template-generation / SKILL.md 渐进披露与尺寸预算`：
 *   1. 主 SKILL.md 行数 ≤ 500（软预算）且全文字符数 ≤ 20,000（双预算取更严格者）
 *   2. 主文件引用的 references/*.md 均存在于 SkillTemplate.references
 *   3. references 内容非空
 */

import { describe, it, expect } from 'vitest';
import { getSkillTemplates } from '../src/core/templates/index.js';
import { generateSkillContent } from '../src/core/command-generation/index.js';

const BUDGET = 500;
const BUDGET_CHARS = 20000;

describe('SKILL.md 渐进披露与尺寸预算', () => {
    const skills = getSkillTemplates();

    it(`主 SKILL.md 行数 ≤ ${BUDGET}`, () => {
        const offenders: string[] = [];
        for (const { template } of skills) {
            const lines = generateSkillContent(template, 'snapshot').fileContent.split('\n').length;
            if (lines > BUDGET) {
                offenders.push(`${template.name}: ${lines}`);
            }
        }
        expect(offenders).toEqual([]);
    });

    it(`主 SKILL.md 字符数 ≤ ${BUDGET_CHARS}（含 frontmatter）`, () => {
        const offenders: string[] = [];
        for (const { template } of skills) {
            const length = generateSkillContent(template, 'snapshot').fileContent.length;
            if (length > BUDGET_CHARS) {
                offenders.push(`${template.name}: ${length}`);
            }
        }
        expect(offenders).toEqual([]);
    });

    it('主文件引用的 references/*.md 均在 SkillTemplate.references 中定义', () => {
        const offenders: string[] = [];
        for (const { template } of skills) {
            const refs = new Set((template.references ?? []).map((r) => r.path));
            for (const m of template.instructions.matchAll(/references\/[A-Za-z0-9._-]+\.md/g)) {
                if (!refs.has(m[0])) {
                    offenders.push(`${template.name}: ${m[0]} 未在 references 中定义`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('references 文件内容非空', () => {
        for (const { template } of skills) {
            for (const ref of template.references ?? []) {
                expect(ref.content.trim().length, `${template.name}/${ref.path}`).toBeGreaterThan(0);
            }
        }
    });

    it('模板正文与 references 无宿主专属工具词', () => {
        const forbidden = ['TodoWrite', 'mcp__codegraph__', 'mcp__plugin_semgrep__', 'AskUserQuestion', 'Task 工具', 'Skill 工具'];
        const offenders: string[] = [];
        for (const { template } of skills) {
            const texts = [template.instructions, ...(template.references ?? []).map((ref) => ref.content)];
            for (const text of texts) {
                for (const word of forbidden) {
                    if (text.includes(word)) {
                        offenders.push(`${template.name}: ${word}`);
                    }
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('iagent_spec_explore 主文件 ≤ 250 行（收紧预算）', () => {
        const entry = skills.find((s) => s.template.name === 'iagent_spec_explore');
        expect(entry).toBeDefined();
        const lines = generateSkillContent(entry!.template, 'snapshot').fileContent.split('\n').length;
        expect(lines).toBeLessThanOrEqual(250);
    });

    it('spec_explore 分层 references 齐备且被正确引用', () => {
        const entry = skills.find((s) => s.template.name === 'iagent_spec_explore');
        const refs = new Map((entry?.template.references ?? []).map((r) => [r.path, r.content]));
        for (const p of [
            'references/exploration-guidance.md',
            'references/multi-project-scan.md',
            'references/grill-playbook.md',
            'references/deep-analysis.md',
        ]) {
            expect(refs.has(p), p).toBe(true);
        }
        expect(entry?.template.instructions).toContain('references/exploration-guidance.md');
        const proto = refs.get('references/exploration-protocol.md') ?? '';
        for (const p of [
            'references/multi-project-scan.md',
            'references/grill-playbook.md',
            'references/deep-analysis.md',
        ]) {
            expect(proto, `主协议未引用 ${p}`).toContain(p);
        }
    });
});
