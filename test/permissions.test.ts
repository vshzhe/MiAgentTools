/**
 * 会话级权限载体测试：条目汇总与非破坏合并。
 *
 * 被测对象：src/core/permissions.ts 的 buildPermissionEntries / mergePermissions。
 * 核心语义是「非破坏」——既有设置文件的任何用户内容 MUST 原样保留，
 * 不可安全合并时 MUST 保留原文件而非覆盖（权限文件的破坏性远大于写入收益）。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildPermissionEntries, mergePermissions } from '../src/core/permissions.js';

/** 设置文件的项目相对路径（与 init 命令的写入目标一致） */
const SETTINGS_RELATIVE = path.join('.claude', 'settings.json');

let baseRoot: string;

beforeAll(() => {
    baseRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'venus-perm-'));
});

afterAll(() => {
    fs.rmSync(baseRoot, { recursive: true, force: true });
});

/** 本次用例专属的临时项目根（隔离用例间状态，满足 FIRST 的 Independent） */
function freshRoot(): string {
    return fs.mkdtempSync(path.join(baseRoot, 'case-'));
}

/** 读取设置文件并解析为 JSON 对象 */
function readSettings(root: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(root, SETTINGS_RELATIVE), 'utf8')) as Record<
        string,
        unknown
    >;
}

/** 预置设置文件（内容为原始字符串，便于构造非法 JSON 场景） */
function writeSettingsRaw(root: string, content: string): void {
    const filePath = path.join(root, SETTINGS_RELATIVE);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

describe('buildPermissionEntries', () => {
    it('展平逗号分隔规则串、trim 并保序去重', () => {
        expect(buildPermissionEntries(['Read, Write', '  Write , Edit '])).toEqual([
            'Read',
            'Write',
            'Edit',
        ]);
    });

    it('空输入与空条目（多余逗号/纯空白）不产出条目', () => {
        expect(buildPermissionEntries([])).toEqual([]);
        expect(buildPermissionEntries(['', '   ', 'Read,,,'])).toEqual(['Read']);
    });

    it('过滤全量放行条目 Bash(*) 与裸 *', () => {
        expect(buildPermissionEntries(['Bash(*), *'])).toEqual([]);
        expect(buildPermissionEntries(['Read, Bash(*), Write, *'])).toEqual(['Read', 'Write']);
    });

    it('过滤只作用于整条目，不误伤带通配的具名规则', () => {
        expect(buildPermissionEntries(['Bash(pnpm:*), Bash(venus:*)'])).toEqual([
            'Bash(pnpm:*)',
            'Bash(venus:*)',
        ]);
    });
});

describe('mergePermissions', () => {
    it('设置文件不存在时创建，结构为 { permissions: { allow: [...] } }', () => {
        // Given: 全新项目根，无 .claude/settings.json
        const root = freshRoot();

        // When: 合并两条放行条目
        const result = mergePermissions(root, SETTINGS_RELATIVE, ['Read', 'Write']);

        // Then: 状态为 created，文件按契约结构落盘
        expect(result.state).toBe('created');
        expect(result.added).toBe(2);
        expect(result.path).toBe('.claude/settings.json');
        expect(readSettings(root)).toEqual({ permissions: { allow: ['Read', 'Write'] } });
    });

    it('既有 allow/deny 段与顶层其他字段原样保留，仅追加 allow', () => {
        // Given: 既有设置文件含顶层 model/env、permissions.deny 与一条既有 allow
        const root = freshRoot();
        writeSettingsRaw(
            root,
            JSON.stringify(
                {
                    model: 'opus',
                    env: { FOO: 'bar' },
                    permissions: { allow: ['Read'], deny: ['Bash(rm:*)'] },
                },
                null,
                2
            )
        );

        // When: 并入一条新条目
        const result = mergePermissions(root, SETTINGS_RELATIVE, ['Read', 'Write']);

        // Then: 状态为 merged，仅新增 1 条；其余内容原样保留
        expect(result.state).toBe('merged');
        expect(result.added).toBe(1);
        expect(readSettings(root)).toEqual({
            model: 'opus',
            env: { FOO: 'bar' },
            permissions: { allow: ['Read', 'Write'], deny: ['Bash(rm:*)'] },
        });
    });

    it('连续两次合并结果一致，allow 无重复且第二次为 unchanged', () => {
        // Given: 首次合并已创建设置文件
        const root = freshRoot();
        const entries = ['Read', 'Write', 'mcp__codegraph'];
        mergePermissions(root, SETTINGS_RELATIVE, entries);
        const afterFirst = fs.readFileSync(path.join(root, SETTINGS_RELATIVE), 'utf8');

        // When: 以同一组条目再次合并
        const second = mergePermissions(root, SETTINGS_RELATIVE, entries);

        // Then: 幂等——状态 unchanged、无新增、文件内容逐字节一致
        expect(second.state).toBe('unchanged');
        expect(second.added).toBe(0);
        expect(fs.readFileSync(path.join(root, SETTINGS_RELATIVE), 'utf8')).toBe(afterFirst);
        const allow = (readSettings(root).permissions as { allow: string[] }).allow;
        expect(allow).toEqual(entries);
        expect(new Set(allow).size).toBe(allow.length);
    });

    it('既有文件不是合法 JSON 时保留原文件，状态为 preserved-invalid', () => {
        // Given: 内容损坏的既有设置文件
        const root = freshRoot();
        const broken = '{ "permissions": { "allow": [ "Read" ]';
        writeSettingsRaw(root, broken);

        // When: 尝试合并
        const result = mergePermissions(root, SETTINGS_RELATIVE, ['Write']);

        // Then: 不写入、不猜测结构，原文件字节不变
        expect(result.state).toBe('preserved-invalid');
        expect(result.added).toBe(0);
        expect(fs.readFileSync(path.join(root, SETTINGS_RELATIVE), 'utf8')).toBe(broken);
    });

    it.each([
        ['顶层不是 JSON 对象', '["Read"]'],
        ['permissions 段不是对象', '{"permissions": "all"}'],
        ['allow 不是数组', '{"permissions": {"allow": "Read"}}'],
    ])('既有文件结构不可安全合并（%s）时保留原文件', (_label, content) => {
        // Given: 结构类型不符的既有设置文件
        const root = freshRoot();
        writeSettingsRaw(root, content);

        // When: 尝试合并
        const result = mergePermissions(root, SETTINGS_RELATIVE, ['Read']);

        // Then: 保留原文件未覆盖
        expect(result.state).toBe('preserved-invalid');
        expect(result.added).toBe(0);
        expect(fs.readFileSync(path.join(root, SETTINGS_RELATIVE), 'utf8')).toBe(content);
    });
});
