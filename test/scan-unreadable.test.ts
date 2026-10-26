/**
 * 预扫描「不可读」降级专项测试（init-project-scan / 「软超时与跳过量统计」：
 * 不可读条目 SHALL 计入 `skipped.unreadable` 并保留 `failures[]` 的具体原因，遍历继续）。
 *
 * 为什么 mock `node:fs`：Windows 上无法可靠构造「权限拒绝」目录（chmod 语义不生效），
 * 真实不可读路径只能靠 ACL 手工设置，不可在 CI 复现。本文件用可控 mock 让
 * `readdirSync` / `readFileSync` 对**指定后缀**抛出 EACCES —— 确定性、无副作用，
 * 且仅在本文件的模块图内生效（不影响其它测试文件）。
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { scanProject, type ProjectScanReport } from '../src/core/project-scan.js';

/** 当前用例注入的故障（null = 全部放行） */
let fail: { kind: 'readdir' | 'readFile'; suffix: string } | null = null;

vi.mock('node:fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:fs')>();

    /** 构造权限拒绝错误（非 ENOENT，才会进 failures 而非被当作「不存在」） */
    function eacces(): NodeJS.ErrnoException {
        const error = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
        error.code = 'EACCES';
        return error;
    }

    const readdirSync = ((target: fs.PathLike, options?: unknown) => {
        if (fail?.kind === 'readdir' && String(target).endsWith(fail.suffix)) {
            throw eacces();
        }
        return (actual.readdirSync as (...args: unknown[]) => unknown)(target, options);
    }) as unknown as typeof actual.readdirSync;

    const readFileSync = ((target: fs.PathOrFileDescriptor, options?: unknown) => {
        if (fail?.kind === 'readFile' && String(target).endsWith(fail.suffix)) {
            throw eacces();
        }
        return (actual.readFileSync as (...args: unknown[]) => unknown)(target, options);
    }) as unknown as typeof actual.readFileSync;

    return { ...actual, default: actual, readdirSync, readFileSync };
});

let tempRoot: string | undefined;

afterEach(() => {
    fail = null;
    if (tempRoot !== undefined) {
        fs.rmSync(tempRoot, { recursive: true, force: true });
        tempRoot = undefined;
    }
});

/** 建夹具目录并写入文件（键为项目相对路径） */
function makeFixture(name: string, files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `iagent-unreadable-${name}-`));
    tempRoot = root;
    for (const [relPath, content] of Object.entries(files)) {
        const target = path.join(root, relPath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content, 'utf8');
    }
    return root;
}

/** 执行扫描并断言不抛出（非阻断契约） */
function scanWithoutThrowing(root: string): ProjectScanReport {
    let report: ProjectScanReport | undefined;
    expect(() => {
        report = scanProject(root, { writeBaseline: false });
    }).not.toThrow();
    if (report === undefined) {
        throw new Error('扫描未返回报告');
    }
    return report;
}

describe('不可读目录：failures + skipped.unreadable，遍历继续', () => {
    it('readdir 抛 EACCES 的目录记入 failures 并计入 unreadable，其余目录照常归类', () => {
        const root = makeFixture('dir', {
            'ok/db.properties': 'ORDER_DB_KEY=1\n',
            'locked/a.properties': 'A=1\n',
        });
        fail = { kind: 'readdir', suffix: 'locked' };

        const report = scanWithoutThrowing(root);

        // 具体原因落入 failures（target = 项目相对路径）
        expect(report.failures).toEqual([
            { target: 'locked', reason: '目录读取失败：EACCES: permission denied' },
        ]);
        expect(report.limits.skipped.unreadable).toBe(1);
        expect(report.limits.reasons).toEqual(['unreadable']);
        expect(report.limits.hit).toBe(true);
        // 遍历继续：兄弟目录的配置仍被归类
        expect(report.signals.config.map((item) => item.file.replaceAll('\\', '/'))).toEqual([
            'ok/db.properties',
        ]);
    });
});

describe('不可读文件：failures + skipped.unreadable，不中断扫描', () => {
    it('readFile 抛 EACCES 的配置文件记入 failures，且不出现在 signals.config', () => {
        const root = makeFixture('file', {
            'conf/db.properties': 'DB_URL=jdbc:mysql://h/db\n',
            'conf/app.properties': 'APP_KEY=1\n',
        });
        fail = { kind: 'readFile', suffix: 'db.properties' };

        const report = scanWithoutThrowing(root);

        expect(report.failures).toEqual([
            { target: 'conf/db.properties', reason: '文件读取失败：EACCES: permission denied' },
        ]);
        expect(report.limits.skipped.unreadable).toBe(1);
        expect(report.limits.reasons).toEqual(['unreadable']);
        // 读取失败的配置不产生半截条目
        expect(report.signals.config.map((item) => item.file.replaceAll('\\', '/'))).toEqual([
            'conf/app.properties',
        ]);
    });
});

describe('忽略规则文件不可读：fail-open（不过滤、记 WARN、遍历继续）', () => {
    it('.gitignore 读取失败时规则不生效，且失败原因落 failures', () => {
        const root = makeFixture('ignore', {
            '.gitignore': 'secret.properties\n',
            'secret.properties': 'SECRET_KEY=1\n',
            'keep.properties': 'KEEP_KEY=1\n',
        });
        fail = { kind: 'readFile', suffix: '.gitignore' };

        const report = scanWithoutThrowing(root);

        // fail-open：规则文件未生效，本应被忽略的 secret.properties 仍被归类
        const configFiles = report.signals.config.map((item) => item.file.replaceAll('\\', '/'));
        expect(configFiles).toContain('secret.properties');
        expect(configFiles).toContain('keep.properties');
        expect(report.limits.skipped.ignored).toBe(0);
        // 解析/读取失败 MUST NOT 静默：计入 unreadable 并给出 fail-open 说明
        expect(report.limits.skipped.unreadable).toBeGreaterThanOrEqual(1);
        const warning = report.failures.find((item) => item.target === '.gitignore');
        expect(warning, '忽略规则读取失败未落 failures').toBeDefined();
        expect(warning?.reason).toContain('fail-open');
    });
});
