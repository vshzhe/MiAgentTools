/**
 * 任务类型标签集一致性测试。
 *
 * 防止回归：`[测试]` 标签必须在 CLI 任务模板与 tasks artifact 生成指令中同时声明，
 * 且两处的标签集一致——否则技能正文与 CLI 模板指令会互相冲突，
 * 导致提案生成的测试任务无法被 apply / archive / commit 正确识别。
 */

import { describe, it, expect } from 'vitest';
import { TASKS_TEMPLATE } from '../src/core/spec/templates/index.js';
import { SPEC_DRIVEN_SCHEMA } from '../src/core/spec/schema.js';

/** 从 tasks artifact 取生成指令文本 */
function getTasksInstruction(): string {
    const tasks = SPEC_DRIVEN_SCHEMA.artifacts.find((a) => a.id === 'tasks');
    if (!tasks) {
        throw new Error('schema 中缺少 tasks artifact 定义');
    }
    return tasks.instruction;
}

describe('任务类型标签集', () => {
    it('任务模板声明并列四类标签（含 [测试]）', () => {
        for (const label of ['[代码]', '[测试]', '[DB脚本]', '[使用说明]']) {
            expect(TASKS_TEMPLATE, `任务模板缺少标签 ${label}`).toContain(label);
        }
    });

    it('任务模板说明 [测试] 的层级与优先级子标注', () => {
        for (const sub of ['[单元]', '[功能]', '[P0]', '[P1]', '[P2]']) {
            expect(TASKS_TEMPLATE, `任务模板缺少子标注 ${sub}`).toContain(sub);
        }
    });

    it('任务模板给出 [测试] 子标注的完整示例', () => {
        expect(TASKS_TEMPLATE).toContain('- [ ] 1.2 [测试][单元][P0]');
    });

    it('生成指令的标签集与模板一致（均含测试标签）', () => {
        const instruction = getTasksInstruction();
        // JSON 值不带方括号（渲染器自动包裹为 [代码] 等），指令按 JSON 取值口径声明
        for (const label of ['代码', '测试', 'DB脚本', '使用说明']) {
            expect(instruction, `生成指令缺少标签 ${label}`).toContain(label);
        }
    });

    it('生成指令要求测试任务带层级与优先级子标注', () => {
        const instruction = getTasksInstruction();
        expect(instruction).toContain('单元/功能');
        expect(instruction).toContain('P0/P1/P2');
    });

    it('生成指令要求不可测场景也产出 [测试] 任务留痕', () => {
        const instruction = getTasksInstruction();
        expect(instruction).toContain('判定无需测试');
    });

    it('既有 [代码] 任务格式未被破坏', () => {
        expect(TASKS_TEMPLATE).toContain('- [ ] 1.1 [代码] <任务描述>');
        expect(TASKS_TEMPLATE).toContain('验证：');
    });
});
