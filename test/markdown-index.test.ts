import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { indexMarkdownEntry } from '../src/core/spec/markdown-index.js';
import { initDatabase, isSqlite3Available, resolveIndexDb } from '../src/core/spec/sqlite-index.js';

function makeArchive(): { openspec: string; changeDir: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-markdown-index-'));
    const openspec = path.join(root, 'openspec');
    const changeDir = path.join(openspec, 'changes', 'archive', '2026-10-16-demo');
    fs.mkdirSync(path.join(changeDir, 'specs', 'demo'), { recursive: true });
    fs.writeFileSync(path.join(changeDir, 'proposal.md'), '# Proposal\n\n## Why\n需要索引\n\n## What Changes\n- 建立 Markdown 索引\n');
    fs.writeFileSync(path.join(changeDir, 'design.md'), '# Design\n\n## Decisions\n\n### D1: 直接解析\n直接读取 Markdown\n');
    fs.writeFileSync(path.join(changeDir, 'specs', 'demo', 'spec.md'), '## ADDED Requirements\n\n### Requirement: Searchable source\n系统 SHALL 保留来源。\n\n#### Scenario: Search\n- **WHEN** 查询\n- **THEN** 返回路径\n');
    fs.writeFileSync(path.join(changeDir, 'exploration.md'), '## Decisions\n\n使用 Markdown。\n');
    return { openspec, changeDir };
}

describe('Markdown-first SQLite index', () => {
    it('从 Markdown 建立变更、能力、需求、决策和探索索引', () => {
        if (!isSqlite3Available()) return;
        const fixture = makeArchive();
        try {
            expect(initDatabase(fixture.openspec).success).toBe(true);
            const dbPath = resolveIndexDb(fixture.openspec);
            indexMarkdownEntry(dbPath, fixture.changeDir, 'demo', '2026-10-16');
            const output = execFileSync('sqlite3', [dbPath, 'SELECT name, summary FROM changes; SELECT name, operation FROM capabilities; SELECT requirement_name, scenario_text FROM requirements_fts; SELECT title, rationale FROM decisions_fts; SELECT capability, content FROM exploration_memory;'], { encoding: 'utf8' });
            expect(output).toContain('demo|建立 Markdown 索引');
            expect(output).toContain('demo|ADDED');
            expect(output).toContain('Searchable source');
            expect(output).toContain('spec.md#L');
            expect(output).toContain('直接解析');
            expect(output).toContain('Markdown');
        } finally {
            fs.rmSync(fixture.openspec, { recursive: true, force: true });
        }
    });
});
