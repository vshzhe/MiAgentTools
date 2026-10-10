/**
 * SQLite 跨变更索引读写封装。
 *
 * 在 openspec/.venus/index.db 维护一个本地 SQLite 数据库，归档变更时写入
 * 变更/能力/决策/需求/探索记忆索引，供探索和提案阶段快速搜索历史变更。
 *
 * 优先使用 Node.js better-sqlite3（同步 API）；不可用时降级为 sqlite3 CLI
 * （child_process）；两者均不可用时抛出，调用方负责降级（Glob/Grep 回退）。
 *
 * 表结构（5 表）：
 *   changes             — 变更索引
 *   capabilities        — 能力 → 变更映射
 *   decisions           — 决策全文搜索（FTS5）
 *   requirements        — 需求全文搜索（FTS5）
 *   exploration_memory  — 探索记忆
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawnSync } from 'child_process';

/** index.db 文件路径（相对 openspec 根，位于归档目录下） */
export const INDEX_DB_PATH = 'changes/archive/.venus/index.db';

/** index.db 文件路径（相对 openspec 根）在 openspec 目录下 */
export function resolveIndexDb(openspecRoot: string): string {
    return path.join(openspecRoot, INDEX_DB_PATH);
}

// ── 建表 DDL ─────────────────────────────────────────────────────

/** 完整的建表 DDL 语句集（单条事务执行） */
export const CREATE_TABLES_DDL = `
CREATE TABLE IF NOT EXISTS changes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    archive_date TEXT,
    module      TEXT,
    summary     TEXT,
    status      TEXT DEFAULT 'active',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS capabilities (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    change_id   INTEGER NOT NULL REFERENCES changes(id),
    operation   TEXT NOT NULL,
    UNIQUE(name, change_id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS decisions_fts USING fts5(
    title,
    choice,
    rationale,
    change_name
);

CREATE VIRTUAL TABLE IF NOT EXISTS requirements_fts USING fts5(
    requirement_name,
    scenario_text,
    change_name,
    capability_name
);

CREATE TABLE IF NOT EXISTS exploration_memory (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    capability      TEXT NOT NULL,
    change_name     TEXT NOT NULL,
    memory_type     TEXT NOT NULL,
    content         TEXT NOT NULL,
    archived_at     TEXT NOT NULL,
    superseded_by   TEXT
);

CREATE INDEX IF NOT EXISTS idx_exploration_capability
    ON exploration_memory(capability);

CREATE INDEX IF NOT EXISTS idx_capabilities_name
    ON capabilities(name);
`.trim();

// ── 操作接口 ─────────────────────────────────────────────────────

/** 变更索引条目 */
export interface ChangeIndexEntry {
    name: string;
    archiveDate?: string;
    module?: string;
    summary?: string;
}

/** 能力索引条目 */
export interface CapabilityIndexEntry {
    name: string;
    changeName: string;
    operation: string;
}

/** 决策索引条目 */
export interface DecisionIndexEntry {
    title: string;
    choice: string;
    rationale: string;
    changeName: string;
}

/** 需求索引条目 */
export interface RequirementIndexEntry {
    requirementName: string;
    scenarioText: string;
    changeName: string;
    capabilityName: string;
}

/** 探索记忆条目 */
export interface ExplorationMemoryEntry {
    capability: string;
    changeName: string;
    memoryType: string;
    content: string;
    archivedAt: string;
    supersededBy?: string;
}

/** SQLite 操作结果 */
export interface SqliteResult {
    success: boolean;
    error?: string;
}

// ── CLI 执行器 ───────────────────────────────────────────────────

/** 通过 sqlite3 CLI 执行 SQL（spawnSync stdin 管道，execSync 不支持 input） */
function execSqlite3(dbPath: string, sql: string): { stdout: string; stderr: string } {
    const result = spawnSync('sqlite3', [dbPath], {
        encoding: 'utf8',
        input: sql,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000,
    });
    return {
        stdout: (result.stdout ?? '').trim(),
        stderr: (result.stderr ?? '').trim(),
    };
}

/** 检查 sqlite3 CLI 是否可用 */
export function isSqlite3Available(): boolean {
    try {
        execSync('sqlite3 --version', { encoding: 'utf8', stdio: 'pipe', timeout: 3000 });
        return true;
    } catch {
        return false;
    }
}

// ── 数据库初始化 ─────────────────────────────────────────────────

/**
 * 初始化 index.db（建表）。
 * 数据库已存在时验证完整性；损坏/空文件时自动重建。
 *
 * @param openspecRoot - openspec 目录绝对路径
 * @returns 操作结果
 */
export function initDatabase(openspecRoot: string): SqliteResult {
    const dbPath = resolveIndexDb(openspecRoot);

    if (!isSqlite3Available()) {
        return { success: false, error: 'sqlite3 CLI 不可用' };
    }

    // 确保 .venus/ 目录存在
    const venusDir = path.dirname(dbPath);
    if (!fs.existsSync(venusDir)) {
        fs.mkdirSync(venusDir, { recursive: true });
    }

    // 数据库已存在 → 验证完整性
    if (fs.existsSync(dbPath)) {
        const verify = execSqlite3(dbPath, 'SELECT name FROM sqlite_master WHERE type="table" LIMIT 1;');
        if (verify.stdout) {
            return { success: true }; // 有表，数据库正常
        }
        // 数据库损坏或为空 → 删除重建
        try {
            fs.unlinkSync(dbPath);
        } catch {
            return { success: false, error: '无法删除损坏的 index.db' };
        }
    }

    try {
        // stdin 管道方式，不需要转义单引号
        const result = execSqlite3(dbPath, CREATE_TABLES_DDL);
        if (result.stderr && !result.stderr.includes('Warning')) {
            return { success: false, error: result.stderr };
        }
        return { success: true };
    } catch (error: unknown) {
        return { success: false, error: (error as Error).message };
    }
}

// ── 写入操作 ─────────────────────────────────────────────────────

/** 转义 SQL 字符串值 */
export function escapeSql(value: string): string {
    return value.replace(/'/g, "''");
}

/**
 * 插入变更索引。
 */
export function insertChange(dbPath: string, entry: ChangeIndexEntry): SqliteResult {
    const sql = `INSERT OR REPLACE INTO changes (name, archive_date, module, summary, status, created_at, updated_at)
VALUES ('${escapeSql(entry.name)}', ${entry.archiveDate ? `'${escapeSql(entry.archiveDate)}'` : 'NULL'},
'${escapeSql(entry.module ?? '')}', '${escapeSql(entry.summary ?? '')}',
'archived', datetime('now'), datetime('now'));`;
    const result = execSqlite3(dbPath, sql);
    if (result.stderr) {
        return { success: false, error: result.stderr };
    }
    return { success: true };
}

/**
 * 批量插入能力索引。
 */
export function insertCapabilities(
    dbPath: string,
    changeName: string,
    capabilities: CapabilityIndexEntry[],
): SqliteResult {
    const inserts = capabilities.map(
        (c) =>
            `INSERT OR IGNORE INTO capabilities (name, change_id, operation)
SELECT '${escapeSql(c.name)}', id, '${escapeSql(c.operation)}'
FROM changes WHERE name = '${escapeSql(changeName)}';`,
    );
    const result = execSqlite3(dbPath, inserts.join('\n'));
    if (result.stderr) {
        return { success: false, error: result.stderr };
    }
    return { success: true };
}

/**
 * 批量插入决策 FTS 索引。
 */
export function insertDecisions(dbPath: string, entries: DecisionIndexEntry[]): SqliteResult {
    if (entries.length === 0) {
        return { success: true };
    }
    const values = entries
        .map(
            (d) =>
                `('${escapeSql(d.title)}', '${escapeSql(d.choice)}', '${escapeSql(d.rationale)}', '${escapeSql(d.changeName)}')`,
        )
        .join(', ');
    const sql = `INSERT INTO decisions_fts (title, choice, rationale, change_name) VALUES ${values};`;
    const result = execSqlite3(dbPath, sql);
    if (result.stderr) {
        return { success: false, error: result.stderr };
    }
    return { success: true };
}

/**
 * 批量插入需求 FTS 索引。
 */
export function insertRequirements(dbPath: string, entries: RequirementIndexEntry[]): SqliteResult {
    if (entries.length === 0) {
        return { success: true };
    }
    const values = entries
        .map(
            (r) =>
                `('${escapeSql(r.requirementName)}', '${escapeSql(r.scenarioText)}', '${escapeSql(r.changeName)}', '${escapeSql(r.capabilityName)}')`,
        )
        .join(', ');
    const sql = `INSERT INTO requirements_fts (requirement_name, scenario_text, change_name, capability_name) VALUES ${values};`;
    const result = execSqlite3(dbPath, sql);
    if (result.stderr) {
        return { success: false, error: result.stderr };
    }
    return { success: true };
}

/**
 * 插入探索记忆。
 */
export function insertExplorationMemory(dbPath: string, entry: ExplorationMemoryEntry): SqliteResult {
    const sql = `INSERT INTO exploration_memory (capability, change_name, memory_type, content, archived_at, superseded_by)
VALUES ('${escapeSql(entry.capability)}', '${escapeSql(entry.changeName)}',
'${escapeSql(entry.memoryType)}', '${escapeSql(entry.content)}',
'${escapeSql(entry.archivedAt)}',
${entry.supersededBy ? `'${escapeSql(entry.supersededBy)}'` : 'NULL'});`;
    const result = execSqlite3(dbPath, sql);
    if (result.stderr) {
        return { success: false, error: result.stderr };
    }
    return { success: true };
}

// ── 查询操作 ─────────────────────────────────────────────────────

/**
 * 按 capability 查询探索记忆。
 * @returns 匹配的探索记忆条目列表
 */
export function queryExplorationByCapability(dbPath: string, capability: string): string[] {
    const sql = `SELECT content FROM exploration_memory WHERE capability = '${escapeSql(capability)}' ORDER BY archived_at DESC;`;
    const result = execSqlite3(dbPath, sql);
    if (!result.stdout) {
        return [];
    }
    return result.stdout.split('\n').filter(Boolean);
}

/**
 * 检测能力冲突：查询哪些 active 变更引用了给定能力。
 * @returns 冲突的变更名列表
 */
export function queryCapabilityConflicts(dbPath: string, capabilityNames: string[]): string[] {
    if (capabilityNames.length === 0) {
        return [];
    }
    const names = capabilityNames.map((n) => `'${escapeSql(n)}'`).join(', ');
    const sql = `SELECT DISTINCT ch.name FROM capabilities c
JOIN changes ch ON c.change_id = ch.id
WHERE c.name IN (${names}) AND ch.status = 'active';`;
    const result = execSqlite3(dbPath, sql);
    if (!result.stdout) {
        return [];
    }
    return result.stdout.split('\n').filter(Boolean);
}

/**
 * 全文搜索决策。
 * @param keyword - 搜索关键词
 * @returns 匹配的决策标题列表
 */
export function searchDecisions(dbPath: string, keyword: string): string[] {
    const sql = `SELECT title, change_name FROM decisions_fts WHERE decisions_fts MATCH '${escapeSql(keyword)}';`;
    const result = execSqlite3(dbPath, sql);
    if (!result.stdout) {
        return [];
    }
    return result.stdout.split('\n').filter(Boolean);
}

/**
 * 全文搜索需求。
 */
export function searchRequirements(dbPath: string, keyword: string): string[] {
    const sql = `SELECT requirement_name, change_name FROM requirements_fts WHERE requirements_fts MATCH '${escapeSql(keyword)}';`;
    const result = execSqlite3(dbPath, sql);
    if (!result.stdout) {
        return [];
    }
    return result.stdout.split('\n').filter(Boolean);
}

/**
 * 删除并重建数据库（--force 全量重建用）。
 */
export function recreateDatabase(openspecRoot: string): SqliteResult {
    const dbPath = resolveIndexDb(openspecRoot);

    // 删除旧文件
    try {
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }
        // 清理 WAL/SHM
        for (const suffix of ['-wal', '-shm']) {
            const walPath = dbPath + suffix;
            if (fs.existsSync(walPath)) {
                fs.unlinkSync(walPath);
            }
        }
    } catch (error: unknown) {
        return { success: false, error: `无法删除旧数据库：${(error as Error).message}` };
    }

    return initDatabase(openspecRoot);
}