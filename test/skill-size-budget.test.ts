/**
 * 技能渐进披露与尺寸预算。
 *
 * 对应变更 improve-skill-progressive-disclosure 的
 * `template-generation / SKILL.md 渐进披露与尺寸预算`：
 *   1. 主 SKILL.md 行数 ≤ 500（软预算）
 *   2. 主文件引用的 references/*.md 均存在于 SkillTemplate.references
 *   3. references 内容非空
 */

import { describe, it, expect } from 'vitest';
import { getSkillTemplates } from '../src/core/templates/index.js';
import { generateSkillContent } from '../src/core/command-generation/index.js';

const BUDGET = 500;

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
});
