import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { migrateChangeFromJson } from '../src/core/spec/migration.js';

function makeLegacyProject(): { root: string; changeDir: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-migration-'));
    const changeDir = path.join(root, 'openspec', 'changes', 'legacy');
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, 'change.json'), JSON.stringify({
        $schema: 'iagent/change/v1',
        changeName: 'legacy',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        phase: 'proposal',
        proposal: {
            why: '迁移原因',
            whatChanges: ['恢复 Markdown'],
            capabilities: { new: [{ name: 'demo', description: '演示能力' }], modified: [] },
            impact: { files: [], breaking: true, compatibility: '需要显式迁移' },
        },
        design: {
            context: '历史 JSON 设计',
            goals: ['生成 Markdown'],
            nonGoals: [],
            decisions: [],
            risks: [],
        },
        specs: [{
            name: 'demo',
            path: 'specs/demo/spec.md',
            operations: [{
                type: 'ADDED',
                requirement: 'Markdown source',
                description: '系统 SHALL 使用 Markdown。',
                scenarios: [{ name: 'Read source', given: '', when: '读取', then: '返回' }],
            }],
        }],
    }, null, 2));
    fs.writeFileSync(path.join(changeDir, 'tasks.json'), JSON.stringify({
        $schema: 'iagent/tasks/v1',
        tasks: [{ id: '1.1', label: '代码', description: '迁移', status: 'pending', dependencies: [], files: [] }],
        progress: { total: 1, complete: 0, remaining: 1 },
    }, null, 2));
    return { root, changeDir };
}

describe('explicit JSON to Markdown migration', () => {
    it('生成 OpenSpec Markdown 且默认保留 JSON 源文件', () => {
        const project = makeLegacyProject();
        try {
            const result = migrateChangeFromJson(project.root, 'legacy');
            expect(result.created.map((file) => file.replaceAll('\\', '/'))).toEqual(expect.arrayContaining([
                expect.stringContaining('/proposal.md'),
                expect.stringContaining('/design.md'),
                expect.stringContaining('/specs/demo/spec.md'),
                expect.stringContaining('/tasks.md'),
            ]));
            expect(fs.existsSync(path.join(project.changeDir, 'change.json'))).toBe(true);
            expect(fs.existsSync(path.join(project.changeDir, 'tasks.json'))).toBe(true);
            expect(fs.readFileSync(path.join(project.changeDir, 'specs', 'demo', 'spec.md'), 'utf8')).toContain('#### Scenario: Read source');
        } finally {
            fs.rmSync(project.root, { recursive: true, force: true });
        }
    });

    it('目标 Markdown 已存在时拒绝覆盖', () => {
        const project = makeLegacyProject();
        try {
            fs.writeFileSync(path.join(project.changeDir, 'proposal.md'), '# Existing');
            expect(() => migrateChangeFromJson(project.root, 'legacy')).toThrow(/拒绝覆盖/);
            expect(fs.readFileSync(path.join(project.changeDir, 'change.json'), 'utf8')).toContain('iagent/change/v1');
        } finally {
            fs.rmSync(project.root, { recursive: true, force: true });
        }
    });

    it('显式 deleteLegacy 成功后删除 JSON 源文件', () => {
        const project = makeLegacyProject();
        try {
            migrateChangeFromJson(project.root, 'legacy', { deleteLegacy: true });
            expect(fs.existsSync(path.join(project.changeDir, 'change.json'))).toBe(false);
            expect(fs.existsSync(path.join(project.changeDir, 'tasks.json'))).toBe(false);
            expect(fs.existsSync(path.join(project.changeDir, 'proposal.md'))).toBe(true);
        } finally {
            fs.rmSync(project.root, { recursive: true, force: true });
        }
    });
});
