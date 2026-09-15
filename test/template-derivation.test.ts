/**
 * 模板派生一致性测试（spec 工作流单一源）。
 *
 * 保证 7 个 spec 工作流的 command content 由 skill instructions（唯一源）经
 * deriveCommandContent 派生生成，防止双模板手工双写回归（2026-09-14 漂移教训）：
 *   1. command.content === deriveCommandContent(skill.instructions) —— 派生关系锁定
 *   2. 派生输出非空且无 CMD:SKIP 标记泄漏
 *   3. instructions 含标记时派生必须实际裁剪（标记生效性抽检）
 */

import { describe, it, expect } from 'vitest';
import { getSkillTemplates, getCommandTemplates } from '../src/core/templates/registry.js';
import { deriveCommandContent } from '../src/core/templates/derive-command.js';

describe('模板派生一致性（spec 工作流单一源）', () => {
    const skillEntries = getSkillTemplates('spec');
    const commandEntries = getCommandTemplates('spec');
    const commandById = new Map(commandEntries.map(({ template, id }) => [id, template]));

    it('spec 工作流数量为 7（skill 与 command 成对）', () => {
        expect(skillEntries.length).toBe(7);
        expect(commandEntries.length).toBe(7);
    });

    for (const { template: skill, commandId } of skillEntries) {
        it(`${skill.name} 的 command content 由 skill instructions 派生`, () => {
            const command = commandById.get(commandId);
            expect(command).toBeDefined();
            // 派生关系锁定：正文出现第二份手工维护内容时（content 被改为独立字符串）断言失败
            expect(command?.content).toBe(deriveCommandContent(skill.instructions));
            // 派生输出非空且无标记泄漏
            expect(command?.content.length ?? 0).toBeGreaterThan(0);
            expect(command?.content).not.toContain('CMD:SKIP');
        });
    }

    it('唯一源含 CMD:SKIP 标记的模板派生后必须变短（标记生效性抽检）', () => {
        // 至少 explore/apply/propose/archive 四个模板带标记（漂移修复与裁剪迁移），全部校验
        const marked = skillEntries.filter(({ template }) => template.instructions.includes('<!-- CMD:SKIP -->'));
        expect(marked.length).toBeGreaterThanOrEqual(4);
        for (const { template } of marked) {
            const derived = deriveCommandContent(template.instructions);
            expect(derived.length).toBeLessThan(template.instructions.length);
        }
    });

    it('所有 spec instructions 均含防护语句锚点（fail-safe 抽检：Guardrails 段保留进 command）', () => {
        for (const { template: skill, commandId } of skillEntries) {
            if (!skill.instructions.includes('Guardrails')) {
                continue;
            }
            // 含 Guardrails 段的模板，其派生输出必须保留该段（防护语句永不裁剪）
            expect(commandById.get(commandId)?.content).toContain('Guardrails');
        }
    });
});
