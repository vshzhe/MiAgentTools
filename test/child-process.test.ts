/**
 * 子进程执行助手测试：
 *   - cmd.exe 参数转义（纯函数，跨平台可测）
 *   - spawnCommand 的退出码 / 输出捕获
 *   - Windows `.cmd` shim 经 shell 解析且不再触发 DEP0190 弃用告警
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    buildWindowsCommandLine,
    quoteArgumentForCmd,
    spawnCommand,
} from '../src/core/child-process.js';

const isWindows = process.platform === 'win32';

describe('quoteArgumentForCmd', () => {
    it('无空白与元字符的参数原样返回', () => {
        expect(quoteArgumentForCmd('--version')).toBe('--version');
        expect(quoteArgumentForCmd('@colbymchenry/codegraph')).toBe('@colbymchenry/codegraph');
        expect(quoteArgumentForCmd('a.b-c_d=e')).toBe('a.b-c_d=e');
    });

    it('空参数返回一对空引号', () => {
        expect(quoteArgumentForCmd('')).toBe('""');
    });

    it('含空白的参数整体加引号', () => {
        expect(quoteArgumentForCmd('C:\\Program Files\\npm.cmd')).toBe('"C:\\Program Files\\npm.cmd"');
    });

    it('内嵌双引号按 cmd 规则转义（\\" 且前置反斜杠加倍）', () => {
        expect(quoteArgumentForCmd('say "hi"')).toBe('"say \\"hi\\""');
        expect(quoteArgumentForCmd('C:\\a\\"b')).toBe('"C:\\a\\\\\\"b"');
    });

    it('结尾连续反斜杠加倍（闭合引号会吞掉它们）', () => {
        expect(quoteArgumentForCmd('dir with space\\')).toBe('"dir with space\\\\"');
    });

    it('含 cmd 元字符的参数加引号（引号内元字符不再被解释）', () => {
        expect(quoteArgumentForCmd('a&b')).toBe('"a&b"');
        expect(quoteArgumentForCmd('a|b')).toBe('"a|b"');
        expect(quoteArgumentForCmd('a>b')).toBe('"a>b"');
    });
});

describe('buildWindowsCommandLine', () => {
    it('简单命令与参数以空格拼接', () => {
        expect(buildWindowsCommandLine('npm', ['install', '-g', '@colbymchenry/codegraph'])).toBe(
            'npm install -g @colbymchenry/codegraph'
        );
    });

    it('命令路径含空格时整体再包一层引号（配合 /s 剥离首尾引号）', () => {
        const line = buildWindowsCommandLine('C:\\Program Files\\nodejs\\npm.cmd', ['--version']);
        expect(line).toBe('""C:\\Program Files\\nodejs\\npm.cmd" --version"');
    });
});

describe('spawnCommand', () => {
    it('捕获 stdout 与退出码', () => {
        const result = spawnCommand(process.execPath, ['-e', 'process.stdout.write("hello-args")']);

        expect(result.status).toBe(0);
        expect(result.stdout).toBe('hello-args');
        expect(result.error).toBeUndefined();
    });

    it('非零退出码与 stderr 透传', () => {
        const result = spawnCommand(process.execPath, [
            '-e',
            'process.stderr.write("boom"); process.exit(3)',
        ]);

        expect(result.status).toBe(3);
        expect(result.stderr).toContain('boom');
    });

    it('stdio 为 ignore 时不捕获输出', () => {
        const result = spawnCommand(process.execPath, ['-e', 'process.stdout.write("ignored")'], {
            stdio: 'ignore',
        });

        expect(result.status).toBe(0);
        expect(result.stdout).toBeUndefined();
    });

    it('cwd 生效', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-spawn-cwd-'));
        try {
            const result = spawnCommand(process.execPath, ['-e', 'process.stdout.write(process.cwd())'], {
                cwd: dir,
            });
            expect(result.stdout?.toLowerCase()).toBe(fs.realpathSync(dir).toLowerCase());
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe.skipIf(!isWindows)('Windows .cmd shim（DEP0190 回归）', () => {
    /** 在含空格的目录中写入 echo shim，返回 shim 路径与清理函数 */
    function createEchoShim(): { shimPath: string; cleanup: () => void } {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent spawn shim '));
        const shimPath = path.join(dir, 'iagent-echo.cmd');
        fs.writeFileSync(shimPath, '@echo [%~1][%~2]\r\n', 'utf8');
        return { shimPath, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
    }

    it('经 cmd.exe 解析 .cmd 且参数边界保持不变（含空白）', () => {
        const { shimPath, cleanup } = createEchoShim();
        try {
            const result = spawnCommand(shimPath, ['a b', 'c d']);
            expect(result.status).toBe(0);
            expect(result.stdout?.trim()).toBe('[a b][c d]');
        } finally {
            cleanup();
        }
    });

    it('不触发 DEP0190 弃用告警', async () => {
        const { shimPath, cleanup } = createEchoShim();
        const deprecations: string[] = [];
        const listener = (warning: Error & { code?: string }): void => {
            if (warning.name === 'DeprecationWarning' && warning.code === 'DEP0190') {
                deprecations.push(warning.message);
            }
        };
        process.on('warning', listener);
        try {
            spawnCommand(shimPath, ['x']);
            // 弃用告警在下一轮事件循环才派发，先让出一次再断言
            await new Promise((resolve) => setImmediate(resolve));
        } finally {
            process.off('warning', listener);
            cleanup();
        }
        expect(deprecations).toEqual([]);
    });
});
