/**
 * 静态快照防漂移测试。
 *
 * 保证 skills/ 目录下提交的 SKILL.md 与内置模板始终一致：
 * 模板变更后未运行 `pnpm build && pnpm generate:skills` 时本测试失败。
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getSkillTemplates } from '../src/core/templates/index.js';
import { generateSkillContent } from '../src/core/command-generation/index.js';

const SKILLS_DIR = path.join(process.cwd(), 'skills');

describe('skills/ 静态快照与模板一致性', () => {
    const templates = getSkillTemplates();

    it('快照目录包含全部内置技能', () => {
        for (const { template } of templates) {
            const skillFile = path.join(SKILLS_DIR, template.name, 'SKILL.md');
            expect(
                fs.existsSync(skillFile),
                `缺少快照：skills/${template.name}/SKILL.md（运行 pnpm build && pnpm generate:skills）`
            ).toBe(true);
        }
    });

    it('每个快照内容与模板生成结果一致（忽略版本号差异）', () => {
        for (const { template } of templates) {
            const skillFile = path.join(SKILLS_DIR, template.name, 'SKILL.md');
            if (!fs.existsSync(skillFile)) {
                continue;
            }
            const snapshot = fs.readFileSync(skillFile, 'utf8');
            // 快照 generatedBy 固定为 snapshot，模板生成时用同值对比
            const generated = generateSkillContent(template, 'snapshot');
            expect(
                snapshot === generated.fileContent,
                `快照与模板漂移：skills/${template.name}/SKILL.md（运行 pnpm build && pnpm generate:skills 重新生成）`
            ).toBe(true);
        }
    });

    it('快照目录无多余技能（模板删除后快照未清理）', () => {
        const expected = new Set(templates.map((t) => t.template.name));
        const actual = fs
            .readdirSync(SKILLS_DIR, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name);
        for (const dir of actual) {
            expect(
                expected.has(dir),
                `多余快照目录：skills/${dir}/（模板已删除，运行 pnpm generate:skills 清理）`
            ).toBe(true);
        }
    });
});
