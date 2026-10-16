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

    it('每个技能的参考文件（references）与模板声明一致且无多余', () => {
        /** 递归收集目录下所有文件相对路径（相对该目录） */
        const collectFiles = (dir: string, base = dir): string[] => {
            if (!fs.existsSync(dir)) return [];
            const out: string[] = [];
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    out.push(...collectFiles(full, base));
                } else {
                    out.push(path.relative(base, full).split(path.sep).join('/'));
                }
            }
            return out;
        };

        for (const { template } of templates) {
            const skillDir = path.join(SKILLS_DIR, template.name);
            const declaredRefs = template.references ?? [];
            const declaredPaths = new Set(declaredRefs.map((r) => r.path));

            // 1. 声明的参考文件必须存在且内容一致
            for (const ref of declaredRefs) {
                const refFile = path.join(skillDir, ref.path);
                expect(
                    fs.existsSync(refFile),
                    `缺少参考文件：skills/${template.name}/${ref.path}（运行 pnpm build && pnpm generate:skills）`
                ).toBe(true);
                if (!fs.existsSync(refFile)) continue;
                const snapshot = fs.readFileSync(refFile, 'utf8');
                expect(
                    snapshot === ref.content,
                    `参考文件漂移：skills/${template.name}/${ref.path}（运行 pnpm build && pnpm generate:skills）`
                ).toBe(true);
            }

            // 2. 技能目录下除 SKILL.md 外的文件必须都在声明内（无多余文件）
            const actualFiles = collectFiles(skillDir);
            for (const f of actualFiles) {
                if (f === 'SKILL.md') continue;
                expect(
                    declaredPaths.has(f),
                    `多余参考文件：skills/${template.name}/${f}（模板未声明，运行 pnpm generate:skills 清理）`
                ).toBe(true);
            }
        }
    });

    it('workflowId 派生不破坏命名/指令一致性（每个技能可被 workflowFilter 唯一命中）', () => {
        // workflow id = deriveCommandId(技能名)，逐个技能验证过滤唯一命中
        for (const { template, commandId } of templates) {
            const hit = getSkillTemplates(undefined, [commandId]);
            expect(hit.length, `workflow ${commandId} 应唯一命中`).toBe(1);
            expect(hit[0].template.name).toBe(template.name);
            expect(hit[0].commandId).toBe(commandId);
        }
        // 20 个 workflow id 无重复
        const allIds = templates.map((t) => t.commandId);
        expect(new Set(allIds).size).toBe(allIds.length);
        expect(allIds.length).toBe(20);
    });
});
