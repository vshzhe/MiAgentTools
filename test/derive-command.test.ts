/**
 * deriveCommandContent 派生函数单元测试。
 *
 * 验证维度：
 *   1. 成对标记：标记段落被裁剪（含标记行），其余保留
 *   2. 无标记：全文保留（fail-safe 默认保留）
 *   3. 未闭合标记：其后内容全部保留，标记行被剥离
 *   4. 空输入：返回空串
 *   5. 边界：标记在字符串首/尾、多组成对标记、嵌套/连续标记
 */

import { describe, it, expect } from 'vitest';
import { deriveCommandContent } from '../src/core/templates/derive-command.js';

describe('deriveCommandContent', () => {

    // —— 基础场景 ——

    it('空输入返回空串', () => {
        expect(deriveCommandContent('')).toBe('');
    });

    it('无标记：全文保留（fail-safe 默认保留）', () => {
        const input = '第一行\n第二行\n第三行';
        expect(deriveCommandContent(input)).toBe(input);
    });

    // —— 成对标记裁剪 ——

    it('成对标记：标记段落被裁剪（含标记行），其余保留', () => {
        const input = [
            '防护语句A',
            '<!-- CMD:SKIP -->',
            '仅 skill 版可见的示例段落',
            '示例第二行',
            '<!-- /CMD:SKIP -->',
            '防护语句B',
        ].join('\n');
        const expected = [
            '防护语句A',
            '防护语句B',
        ].join('\n');
        expect(deriveCommandContent(input)).toBe(expected);
    });

    // —— fail-safe：未闭合容错 ——

    it('未闭合标记：其后内容全部保留，标记行被剥离', () => {
        const input = [
            '防护语句A',
            '<!-- CMD:SKIP -->',
            '这段应该保留（fail-safe：更长而非缺失）',
            '继续保留',
        ].join('\n');
        const expected = [
            '防护语句A',
            '这段应该保留（fail-safe：更长而非缺失）',
            '继续保留',
        ].join('\n');
        expect(deriveCommandContent(input)).toBe(expected);
    });

    // —— 边界：标记位置 ——

    it('标记在字符串首：首段裁剪，尾部保留', () => {
        const input = [
            '<!-- CMD:SKIP -->',
            '被裁剪的首段',
            '<!-- /CMD:SKIP -->',
            '保留段',
        ].join('\n');
        expect(deriveCommandContent(input)).toBe('保留段');
    });

    it('标记在字符串尾：尾段裁剪，首部保留', () => {
        const input = [
            '保留段',
            '<!-- CMD:SKIP -->',
            '被裁剪的尾段',
            '<!-- /CMD:SKIP -->',
        ].join('\n');
        expect(deriveCommandContent(input)).toBe('保留段');
    });

    // —— 边界：多组成对标记 ——

    it('多组成对标记：多段独立裁剪，保留段穿插', () => {
        const input = [
            '保留A',
            '<!-- CMD:SKIP -->',
            '裁剪B',
            '<!-- /CMD:SKIP -->',
            '保留C',
            '<!-- CMD:SKIP -->',
            '裁剪D',
            '<!-- /CMD:SKIP -->',
            '保留E',
        ].join('\n');
        const expected = [
            '保留A',
            '保留C',
            '保留E',
        ].join('\n');
        expect(deriveCommandContent(input)).toBe(expected);
    });

    // —— 边界：连续标记 ——

    it('连续标记：相邻 skip 段间无内容，两段均裁剪', () => {
        const input = [
            '保留A',
            '<!-- CMD:SKIP -->',
            '裁剪B',
            '<!-- /CMD:SKIP -->',
            '<!-- CMD:SKIP -->',
            '裁剪C',
            '<!-- /CMD:SKIP -->',
            '保留D',
        ].join('\n');
        const expected = [
            '保留A',
            '保留D',
        ].join('\n');
        expect(deriveCommandContent(input)).toBe(expected);
    });

    // —— 边界：嵌套标记（标记不嵌套，首个结束标记闭合整段） ——

    it('嵌套标记（不嵌套语义）：首个结束标记闭合整段，内部第二个起始标记行一并裁剪', () => {
        const input = [
            '保留A',
            '<!-- CMD:SKIP -->',
            '外层裁剪B',
            '<!-- CMD:SKIP -->',
            '内层裁剪C',
            '<!-- /CMD:SKIP -->',
            '保留D',
        ].join('\n');
        const expected = [
            '保留A',
            '保留D',
        ].join('\n');
        expect(deriveCommandContent(input)).toBe(expected);
    });

    it('嵌套未闭合：从首个起始标记起全部保留，内部嵌套标记行被剥离', () => {
        const input = [
            '保留A',
            '<!-- CMD:SKIP -->',
            '保留B',
            '<!-- CMD:SKIP -->',
            '保留C',
        ].join('\n');
        const expected = [
            '保留A',
            '保留B',
            '保留C',
        ].join('\n');
        expect(deriveCommandContent(input)).toBe(expected);
    });

    // —— 孤立标记行剥离 ——

    it('孤立的结束标记：标记行剥离，其余内容保留', () => {
        const input = [
            '保留A',
            '<!-- /CMD:SKIP -->',
            '保留B',
        ].join('\n');
        const expected = [
            '保留A',
            '保留B',
        ].join('\n');
        expect(deriveCommandContent(input)).toBe(expected);
    });

    it('仅起始标记无内容无结束：返回空串（标记行剥离）', () => {
        expect(deriveCommandContent('<!-- CMD:SKIP -->')).toBe('');
    });

    it('仅结束标记：返回空串（孤立标记行剥离）', () => {
        expect(deriveCommandContent('<!-- /CMD:SKIP -->')).toBe('');
    });

    // —— trim 容错 ——

    it('标记行含前后空白仍被识别（trim 容错），内容行原样保留', () => {
        const input = [
            '保留A',
            '   <!-- CMD:SKIP -->   ',
            '裁剪B',
            '  <!-- /CMD:SKIP -->  ',
            '保留C',
        ].join('\n');
        const expected = [
            '保留A',
            '保留C',
        ].join('\n');
        expect(deriveCommandContent(input)).toBe(expected);
    });

    // —— 漂移教训回溯：防护语句默认进入 command 版 ——

    it('防护语句在未标记段落中默认进入 command 版（漂移教训：漏标只会更长，不缺失）', () => {
        // 模拟 propose 蓝图确认句场景：防护语句未标记，应保留进 command 版
        const input = [
            '## Guardrails',
            'After all artifacts are created, display a design blueprint summary and wait for user confirmation before suggesting implementation',
            '其他防护',
        ].join('\n');
        // 未标记 → 全文保留
        expect(deriveCommandContent(input)).toBe(input);
    });

    // —— CRLF 行尾兼容 ——

    it('CRLF 行尾：标记识别正常，内容保留', () => {
        const input = '保留A\r\n<!-- CMD:SKIP -->\r\n裁剪B\r\n<!-- /CMD:SKIP -->\r\n保留C';
        const expected = '保留A\r\n保留C';
        expect(deriveCommandContent(input)).toBe(expected);
    });
});
