/**
 * spec 命令核心逻辑测试：new-change 创建 / archive 归档生命周期。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createChange } from '../src/core/spec/new-change.js';
import { executeArchive, previewArchive } from '../src/core/spec/archive.js';

/** 创建临时项目根目录 */
function makeTempProject(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-spec-cmd-'));
}

describe('iagent spec new（createChange）', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('正常创建：目录 + .openspec.yaml 含 schema/created/goal', () => {
        const result = createChange(projectRoot, 'add-auth-login', { goal: '添加登录' });
        expect(fs.existsSync(result.changeDir)).toBe(true);
        const metadata = fs.readFileSync(result.metadataPath, 'utf8');
        expect(metadata).toContain('schema: spec-driven');
        expect(metadata).toMatch(/^created: \d{4}-\d{2}-\d{2}$/m);
        expect(metadata).toContain('goal: "添加登录"');
    });

    it('目标项目无 openspec 目录：自动创建骨架（含 archive/）', () => {
        const result = createChange(projectRoot, 'first-change');
        expect(fs.existsSync(path.join(projectRoot, 'openspec', 'changes', 'archive'))).toBe(true);
        expect(fs.existsSync(result.changeDir)).toBe(true);
    });

    it('同名变更已存在：报错不覆盖', () => {
        createChange(projectRoot, 'dup-change');
        expect(() => createChange(projectRoot, 'dup-change')).toThrowError(/已存在/);
    });

    it('非 kebab-case 变更名：报错', () => {
        expect(() => createChange(projectRoot, 'Invalid_Name')).toThrowError(/kebab-case/);
    });

    it('goal 含双引号：元数据转义正确', () => {
        const result = createChange(projectRoot, 'quote-change', { goal: '含"引号"的目标' });
        const metadata = fs.readFileSync(result.metadataPath, 'utf8');
        expect(metadata).toContain('goal: "含\\"引号\\"的目标"');
    });
});

describe('iagent spec archive（previewArchive / executeArchive）', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('预览：未完成任务与未完成制品均产出警告', () => {
        const { changeDir } = createChange(projectRoot, 'incomplete-change');
        // 仅创建 change.json proposal 段，不写 specs/design/tasks（未完成）
        fs.writeFileSync(path.join(changeDir, 'change.json'), JSON.stringify({
            $schema: 'iagent/change/v1', changeName: 'incomplete-change',
            createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
            phase: 'proposal',
            proposal: { why: '测试', whatChanges: ['变更'], capabilities: { new: [], modified: [] }, impact: { files: [], breaking: false, compatibility: '兼容' } },
        }, null, 2));
        fs.writeFileSync(path.join(changeDir, 'tasks.json'), JSON.stringify({
            $schema: 'iagent/tasks/v1',
            tasks: [{ id: '1', label: '代码', description: '待办任务', status: 'pending', dependencies: [], files: [] }],
            progress: { total: 1, complete: 0, remaining: 1 },
        }, null, 2));
        const preview = previewArchive(projectRoot, 'incomplete-change');
        expect(preview.warnings.some((w) => w.includes('未完成的规划制品'))).toBe(true);
        expect(preview.tasksRemaining).toBe(1);
        // 预览不执行移动
        expect(fs.existsSync(changeDir)).toBe(true);
    });

    it('执行：变更目录移动至 archive/<日期前缀>-<名称>', () => {
        const { changeDir } = createChange(projectRoot, 'done-change');
        fs.writeFileSync(path.join(changeDir, 'change.json'), JSON.stringify({
            $schema: 'iagent/change/v1', changeName: 'done-change',
            createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
            phase: 'proposal',
            proposal: { why: '测试', whatChanges: ['变更'], capabilities: { new: [], modified: [] }, impact: { files: [], breaking: false, compatibility: '兼容' } },
            specs: [{ name: 'auth', path: 'specs/auth/spec.md', operations: [] }],
            design: { context: '上下文', goals: [], nonGoals: [], decisions: [], risks: [] },
        }, null, 2));
        fs.writeFileSync(path.join(changeDir, 'tasks.json'), JSON.stringify({
            $schema: 'iagent/tasks/v1',
            tasks: [{ id: '1', label: '代码', description: '完成', status: 'done', dependencies: [], files: [] }],
            progress: { total: 1, complete: 1, remaining: 0 },
        }, null, 2));
        const result = executeArchive(projectRoot, 'done-change');
        expect(fs.existsSync(result.archivedPath)).toBe(true);
        expect(path.basename(result.archivedPath)).toMatch(/^\d{4}-\d{2}-\d{2}-done-change$/);
        expect(fs.existsSync(changeDir)).toBe(false);
    });

    it('名称已含日期前缀：不叠加', () => {
        const { changeDir } = createChange(projectRoot, '2026-01-01-named-change');
        fs.writeFileSync(path.join(changeDir, 'change.json'), JSON.stringify({
            $schema: 'iagent/change/v1', changeName: '2026-01-01-named-change',
            createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
            phase: 'proposal',
            proposal: { why: '测试', whatChanges: ['变更'], capabilities: { new: [], modified: [] }, impact: { files: [], breaking: false, compatibility: '兼容' } },
            specs: [{ name: 'auth', path: 'specs/auth/spec.md', operations: [] }],
            design: { context: '上下文', goals: [], nonGoals: [], decisions: [], risks: [] },
        }, null, 2));
        fs.writeFileSync(path.join(changeDir, 'tasks.json'), JSON.stringify({
            $schema: 'iagent/tasks/v1',
            tasks: [{ id: '1', label: '代码', description: '完成', status: 'done', dependencies: [], files: [] }],
            progress: { total: 1, complete: 1, remaining: 0 },
        }, null, 2));
        const result = executeArchive(projectRoot, '2026-01-01-named-change');
        expect(path.basename(result.archivedPath)).toBe('2026-01-01-named-change');
    });

    it('归档目标已存在：拒绝覆盖', () => {
        const today = new Date().toISOString().slice(0, 10);
        createChange(projectRoot, 'target-change');
        const conflictDir = path.join(projectRoot, 'openspec', 'changes', 'archive', `${today}-target-change`);
        fs.mkdirSync(conflictDir, { recursive: true });
        expect(() => executeArchive(projectRoot, 'target-change')).toThrowError(/拒绝覆盖/);
    });

    it('变更不存在：报错', () => {
        expect(() => previewArchive(projectRoot, 'ghost-change')).toThrowError(/不存在/);
    });
});
