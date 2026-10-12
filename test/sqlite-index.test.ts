/**
 * SQLite 索引模块单元测试。
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
    CREATE_TABLES_DDL,
    isSqlite3Available,
    initDatabase,
    resolveIndexDb,
    escapeSql,
} from '../src/core/spec/sqlite-index.js';

/** 测试用临时目录 */
function tempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'venus-sqlite-test-'));
}

describe('sqlite-index 模块', () => {
    describe('DDL 结构', () => {
        it('CREATE_TABLES_DDL 含 5 张表的建表语句', () => {
            expect(CREATE_TABLES_DDL).toContain('CREATE TABLE IF NOT EXISTS changes');
            expect(CREATE_TABLES_DDL).toContain('CREATE TABLE IF NOT EXISTS capabilities');
            expect(CREATE_TABLES_DDL).toContain('decisions_fts');
            expect(CREATE_TABLES_DDL).toContain('requirements_fts');
            expect(CREATE_TABLES_DDL).toContain('CREATE TABLE IF NOT EXISTS exploration_memory');
        });

        it('DDL 含 FTS5 全文搜索表', () => {
            expect(CREATE_TABLES_DDL).toContain('USING fts5');
        });

        it('DDL 含索引创建', () => {
            expect(CREATE_TABLES_DDL).toContain('CREATE INDEX IF NOT EXISTS');
        });
    });

    describe('resolveIndexDb', () => {
        it('返回 openspec/changes/archive/.venus/index.db', () => {
            const result = resolveIndexDb('/project/openspec');
            expect(result.replaceAll('\\', '/')).toBe('/project/openspec/changes/archive/.venus/index.db');
        });
    });

    describe('CLI 可用性检测', () => {
        it('isSqlite3Available 不抛异常', () => {
            expect(() => isSqlite3Available()).not.toThrow();
        });
    });

    describe('initDatabase', () => {
        it('sqlite3 不可用时返回失败', () => {
            if (isSqlite3Available()) {
                // 如果 sqlite3 可用，跳过此测试（测试可用的场景在集成测试中）
                return;
            }
            const dir = tempDir();
            try {
                const result = initDatabase(dir);
                expect(result.success).toBe(false);
                expect(result.error).toContain('不可用');
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });

        it('sqlite3 可用时成功建库', () => {
            if (!isSqlite3Available()) {
                return; // 跳过：sqlite3 不可用
            }
            const dir = tempDir();
            try {
                const result = initDatabase(dir);
                expect(result.success).toBe(true);
                // 验证文件存在
                const dbPath = resolveIndexDb(dir);
                expect(fs.existsSync(dbPath)).toBe(true);
                // 重复调用不报错（幂等）
                const result2 = initDatabase(dir);
                expect(result2.success).toBe(true);
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });

        it('目录不存在时自动创建', () => {
            if (!isSqlite3Available()) {
                return;
            }
            const base = tempDir();
            const dir = path.join(base, 'nested', 'openspec');
            try {
                const result = initDatabase(dir);
                expect(result.success).toBe(true);
                const dbPath = resolveIndexDb(dir);
                expect(fs.existsSync(dbPath)).toBe(true);
            } finally {
                // 仅清理本测试创建的临时目录（勿向上越界到系统目录）
                fs.rmSync(base, { recursive: true, force: true });
            }
        });
    });

    describe('SQL 转义', () => {
        it("单引号被正确转义为两个单引号", () => {
            expect(escapeSql("it's")).toBe("it''s");
            expect(escapeSql("no quotes")).toBe('no quotes');
        });
    });
});