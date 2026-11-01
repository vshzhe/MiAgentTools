/**
 * compileCheck 配置解析测试（compile-check-gate / compileCheck 配置契约与默认值单一源）。
 *
 * 锁定四条契约：
 *   1. 缺段即启用（默认值全部来自 `DEFAULT_COMPILE_CHECK`）；
 *   2. 显式禁用（`enabled: false`）是唯一合法的非执行终态来源；
 *   3. 非法取值回退默认并逐字段 WARN，MUST NOT 静默采用；
 *   4. `ProjectConfig.compileCheck` 只承载原始解析结果，不提前填默认值。
 */

import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    DEFAULT_COMPILE_CHECK,
    defaultConfigFileContent,
    parseCompileCheck,
    parseProjectConfig,
    readProjectConfig,
    resolveCompileCheck,
} from '../src/core/project-config.js';

const tempRoots: string[] = [];

/** 建一个只含 config.yaml 的临时项目根 */
function projectWith(raw: string): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-compile-check-'));
    tempRoots.push(root);
    fs.mkdirSync(path.join(root, '.iagent'), { recursive: true });
    fs.writeFileSync(path.join(root, '.iagent', 'config.yaml'), raw, 'utf8');
    return root;
}

afterAll(() => {
    for (const root of tempRoots) {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

describe('compileCheck 解析：缺段与显式取值', () => {
    it('缺段即启用（全部取默认值，来源 default）', () => {
        const parsed = parseCompileCheck('context: |\n  背景\n');
        expect(parsed.present).toBe(false);
        expect(parsed.values).toEqual({});
        expect(parsed.warnings).toEqual([]);

        const resolved = resolveCompileCheck(parsed);
        expect(resolved.source).toBe('default');
        expect(resolved.config).toEqual({
            enabled: true,
            command: '',
            timeoutMs: 600000,
            incremental: true,
            autoFix: true,
            maxRetries: 3,
        });
    });

    it('段存在即用户配置来源；缺字段仍取默认值', () => {
        const parsed = parseCompileCheck('compileCheck:\n  enabled: false\n');
        expect(parsed.present).toBe(true);
        // 原始解析结果只含显式字段：MUST NOT 提前填默认值
        expect(parsed.values).toEqual({ enabled: false });
        expect(parsed.warnings).toEqual([]);

        const resolved = resolveCompileCheck(parsed);
        expect(resolved.source).toBe('config');
        expect(resolved.config.enabled).toBe(false);
        expect(resolved.config.timeoutMs).toBe(DEFAULT_COMPILE_CHECK.timeoutMs);
        expect(resolved.config.maxRetries).toBe(DEFAULT_COMPILE_CHECK.maxRetries);
    });

    it('完整段逐字段生效（含引号与行内注释）', () => {
        const parsed = parseCompileCheck(
            [
                'compileCheck:',
                '  enabled: true   # 缺省启用',
                '  command: "node build.js"',
                '  timeoutMs: 120000',
                '  incremental: false',
                '  autoFix: false',
                '  maxRetries: 5',
                '',
                'tools:',
                '  - claude',
            ].join('\n')
        );
        expect(parsed.values).toEqual({
            enabled: true,
            command: 'node build.js',
            timeoutMs: 120000,
            incremental: false,
            autoFix: false,
            maxRetries: 5,
        });
        expect(parsed.warnings).toEqual([]);
    });

    it('command 空白视为自动探测（原值非空时 WARN）', () => {
        const blank = parseCompileCheck('compileCheck:\n  command: "   "\n');
        expect(blank.values.command).toBe('');
        expect(blank.warnings.some((w) => w.includes('command'))).toBe(true);

        const empty = parseCompileCheck('compileCheck:\n  command: ""\n');
        expect(empty.values.command).toBe('');
        expect(empty.warnings).toEqual([]);
    });
});

describe('compileCheck 解析：非法取值回退并告警', () => {
    it('maxRetries: 0 回退默认 3 并 WARN', () => {
        const parsed = parseCompileCheck('compileCheck:\n  maxRetries: 0\n');
        expect(parsed.values.maxRetries).toBeUndefined();
        expect(parsed.warnings).toContain('compileCheck: maxRetries 非法，已回退默认值 3（原值：0）');
        expect(resolveCompileCheck(parsed).config.maxRetries).toBe(DEFAULT_COMPILE_CHECK.maxRetries);
    });

    it('enabled: maybe 回退 true 并 WARN', () => {
        const parsed = parseCompileCheck('compileCheck:\n  enabled: maybe\n');
        expect(parsed.values.enabled).toBeUndefined();
        expect(parsed.warnings).toContain('compileCheck: enabled 非法，已回退默认值 true（原值：maybe）');
        expect(resolveCompileCheck(parsed).config.enabled).toBe(true);
    });

    it('其余布尔字段非法取值同样回退默认并 WARN（参数化）', () => {
        for (const field of ['incremental', 'autoFix'] as const) {
            const parsed = parseCompileCheck(`compileCheck:\n  ${field}: maybe\n`);
            expect(parsed.values[field], field).toBeUndefined();
            expect(parsed.warnings, field).toContain(
                `compileCheck: ${field} 非法，已回退默认值 ${String(DEFAULT_COMPILE_CHECK[field])}（原值：maybe）`
            );
            expect(resolveCompileCheck(parsed).config[field], field).toBe(DEFAULT_COMPILE_CHECK[field]);
        }
    });

    it('timeoutMs 非正整数回退默认并 WARN', () => {
        for (const raw of ['-1', '1.5', 'abc']) {
            const parsed = parseCompileCheck(`compileCheck:\n  timeoutMs: ${raw}\n`);
            expect(parsed.values.timeoutMs, raw).toBeUndefined();
            expect(parsed.warnings.some((w) => w.startsWith('compileCheck: timeoutMs 非法'))).toBe(true);
        }
    });

    it('未知字段忽略并 WARN（不阻断）', () => {
        const parsed = parseCompileCheck('compileCheck:\n  unknownField: 1\n  enabled: true\n');
        expect(parsed.values).toEqual({ enabled: true });
        expect(parsed.warnings).toContain('compileCheck: 未知字段 unknownField 已忽略');
    });
});

describe('默认配置内容与 readProjectConfig 口径', () => {
    it('默认 config 内容含 compileCheck 注释示例且解析等于默认值', () => {
        const content = defaultConfigFileContent();
        expect(content).toContain('# compileCheck:');
        expect(content).toContain('#   enabled: true');
        expect(content).toContain('#   maxRetries: 3');

        const parsed = parseProjectConfig(content);
        // 全注释示例 ⇒ 段缺失（来源 default），不得误标为用户配置
        expect(parsed.compileCheck).toBeUndefined();
        const resolved = resolveCompileCheck(parseCompileCheck(content));
        expect(resolved.source).toBe('default');
        expect(resolved.config).toEqual({ ...DEFAULT_COMPILE_CHECK });
    });

    it('readProjectConfig 返回生效值 + 段级来源 + 回退告警', () => {
        const root = projectWith(
            ['compileCheck:', '  enabled: false', '  command: node build.js', '  maxRetries: 0', ''].join('\n')
        );
        const resolved = readProjectConfig(root);
        expect(resolved).not.toBeNull();
        expect(resolved?.compileCheck).toEqual({
            enabled: false,
            command: 'node build.js',
            timeoutMs: DEFAULT_COMPILE_CHECK.timeoutMs,
            incremental: DEFAULT_COMPILE_CHECK.incremental,
            autoFix: DEFAULT_COMPILE_CHECK.autoFix,
            maxRetries: DEFAULT_COMPILE_CHECK.maxRetries,
        });
        // 段存在即用户配置；单字段回退不改变段级来源
        expect(resolved?.compileCheckSource).toBe('config');
        expect(resolved?.compileCheckWarnings).toContain('compileCheck: maxRetries 非法，已回退默认值 3（原值：0）');
    });

    it('config.yaml 不含该段时 readProjectConfig 取默认值与 default 来源', () => {
        const root = projectWith('context: |\n  背景\n');
        const resolved = readProjectConfig(root);
        expect(resolved?.compileCheck).toEqual({ ...DEFAULT_COMPILE_CHECK });
        expect(resolved?.compileCheckSource).toBe('default');
        expect(resolved?.compileCheckWarnings).toEqual([]);
    });
});
