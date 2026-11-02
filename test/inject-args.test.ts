/**
 * 围栏感知参数注入（`injectCommandArgs`）单点回归。
 *
 * 变更 fix-multi-agent-skill-command-generation / 任务 2.1 / 2.3。
 *
 * `test/generation.test.ts` 的「Pi / OpenCode 参数注入矩阵」已覆盖端到端主路径
 * （顶层中英输入段注入、围栏内示例不注入、仅首个顶层段、无参声明与既有占位符幂等）。
 * 本文件补齐该矩阵未覆盖的边界：
 *   - 未闭合围栏（fail-safe：其后内容一律视为围栏内）
 *   - 缩进围栏 / 围栏字符不匹配（` ``` ` 与 `~~~` 互不闭合）
 *   - 段落被围栏或标题终止
 *   - CRLF 行尾保持
 *   - 无输入段时逐字节直通、重复调用幂等
 */

import { describe, it, expect } from 'vitest';
import {
    PROVIDED_ARGUMENTS_LINE,
    injectCommandArgs,
} from '../src/core/command-generation/adapters/inject-args.js';

/** 注入行（值断言用） */
const INJECTED = '**Provided arguments**: $ARGUMENTS';

/** 统计注入次数 */
function injectionCount(body: string): number {
    return body.split(INJECTED).length - 1;
}

describe('injectCommandArgs：围栏状态机边界', () => {
    it('未闭合围栏之后的内容一律不注入（fail-safe）', () => {
        const body = '## 报告模板\n\n```markdown\n**输入**: 示例内容\n\n执行说明。\n';
        expect(injectCommandArgs(body)).toBe(body);
    });

    it('未闭合围栏之前已出现的顶层输入段仍照常注入', () => {
        const body = '**输入**：变更名称。\n\n```\n未闭合示例\n';
        const out = injectCommandArgs(body);
        expect(injectionCount(out)).toBe(1);
        expect(out).toContain(`**输入**：变更名称。\n${INJECTED}\n\n\`\`\``);
    });

    it('缩进围栏（列表内的代码块）同样隔离其内部同形行', () => {
        // 围栏行带 4 空格缩进，内部输入行在行首 —— 仅凭行首锚定会误注入，须靠围栏感知
        const body = '## 步骤\n\n- 示例：\n\n    ```markdown\n**输入**: 示例内容\n    ```\n\n无顶层输入段。\n';
        expect(injectCommandArgs(body)).toBe(body);
    });

    it('``` 与 ~~~ 互不闭合（围栏字符须匹配）', () => {
        const tildeWithBackticks = '~~~\n```\n**输入**: 示例\n~~~\n';
        expect(injectCommandArgs(tildeWithBackticks)).toBe(tildeWithBackticks);

        const backtickWithTildes = '```\n~~~\n**输入**: 示例\n```\n';
        expect(injectCommandArgs(backtickWithTildes)).toBe(backtickWithTildes);
    });
});

describe('injectCommandArgs：段落边界与行尾', () => {
    it('输入段紧随围栏块终止：注入行落在围栏之前', () => {
        const body = '**输入**：主题。\n```bash\niagent spec status\n```\n\n## 步骤\n\n执行。\n';
        const out = injectCommandArgs(body);
        expect(injectionCount(out)).toBe(1);
        expect(out.indexOf(INJECTED)).toBeGreaterThan(-1);
        expect(out.indexOf(INJECTED)).toBeLessThan(out.indexOf('```bash'));
    });

    it('输入段在 Markdown 标题处终止：注入行紧跟在输入段末尾', () => {
        const body = '**输入**：变更名称（可选）。\n## 步骤\n\n执行。\n';
        const out = injectCommandArgs(body);
        expect(out).toBe(`**输入**：变更名称（可选）。\n${INJECTED}\n## 步骤\n\n执行。\n`);
    });

    it('CRLF 行尾下注入行同样使用 CRLF（不引入混行）', () => {
        const body = '**输入**：主题。\r\n\r\n## 步骤\r\n\r\n执行。';
        const out = injectCommandArgs(body);
        expect(out).toContain(`${INJECTED}\r\n`);
        // 全部换行均为 CRLF
        expect(out.replaceAll('\r\n', '')).not.toContain('\n');
    });

    it('半角冒号的中文输入标记同样作为锚点', () => {
        const out = injectCommandArgs('**输入**: 待验证的变更名称。\n\n## 步骤\n\n执行。\n');
        expect(injectionCount(out)).toBe(1);
    });

    it('两段连续顶层输入行只注入一次（仅首个段落生效）', () => {
        const out = injectCommandArgs('**输入**：A。\n**输入**：B。\n\n执行。\n');
        expect(injectionCount(out)).toBe(1);
    });

    it('缩进的同形行不作为锚点（锚定行首的顶层输入行）', () => {
        const body = '  **输入**：缩进示例。\n\n执行。\n';
        expect(injectCommandArgs(body)).toBe(body);
    });
});

describe('injectCommandArgs：直通与幂等', () => {
    it('无输入段时逐字节返回原正文', () => {
        const body = '## 步骤\n\n执行。\n\n- 输入：列表项不是输入契约段。\n';
        expect(injectCommandArgs(body)).toBe(body);
        expect(injectCommandArgs('')).toBe('');
    });

    it('重复调用幂等（第二次因已含 $ARGUMENTS 直接返回）', () => {
        const once = injectCommandArgs('**输入**：主题。\n\n执行。\n');
        expect(injectCommandArgs(once)).toBe(once);
        expect(injectionCount(once)).toBe(1);
    });

    it('注入行常量与产物行一致', () => {
        const out = injectCommandArgs('**Input**: topic\n\nDo it.\n');
        expect(out).toContain(PROVIDED_ARGUMENTS_LINE);
    });
});
