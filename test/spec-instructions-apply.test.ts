/**
 * venus spec instructions apply 命令测试。
 *
 * JSON-primary 化后更新：
 * - proposal/specs/design 按 change.json 段存在性判定
 * - tasks 按 tasks.json 存在性判定
 * - contextFiles 指向 change.json / tasks.json
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getApplyInstructions, getInstructionsResult, runSpecStatus } from '../src/commands/spec.js';

/** 创建临时项目根目录 */
function makeTempProject(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'venus-spec-apply-'));
}

/** 在临时项目中创建变更目录 */
function makeChange(projectRoot: string, changeName: string): string {
    const changeDir = path.join(projectRoot, 'openspec', 'changes', changeName);
    fs.mkdirSync(changeDir, { recursive: true });
    return changeDir;
}

/** 写入 .openspec.yaml（含可选 skip_specs） */
function writeMetadata(changeDir: string, options: { skipSpecs?: boolean; schema?: string } = {}): void {
    const lines = [
        `schema: ${options.schema ?? 'spec-driven'}`,
        `created: 2026-09-15`,
    ];
    if (options.skipSpecs !== undefined) {
        lines.push(`skip_specs: ${options.skipSpecs}`);
    }
    fs.writeFileSync(path.join(changeDir, '.openspec.yaml'), `${lines.join('\n')}\n`, 'utf8');
}

/** 构造最小合法 change.json */
function writeChangeJson(changeDir: string, sections: { proposal?: boolean; specs?: boolean; design?: boolean }): void {
    const json: Record<string, unknown> = {
        $schema: 'venus/change/v1',
        changeName: path.basename(changeDir),
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        phase: 'proposal',
    };
    if (sections.proposal) {
        json.proposal = {
            why: '测试原因',
            whatChanges: ['变更项'],
            capabilities: { new: [], modified: [] },
            impact: { files: [], breaking: false, compatibility: '兼容' },
        };
    }
    if (sections.specs) {
        json.specs = [{ name: 'auth', path: 'specs/auth/spec.md', operations: [] }];
    }
    if (sections.design) {
        json.design = {
            context: '测试上下文',
            goals: [],
            nonGoals: [],
            decisions: [],
            risks: [],
        };
    }
    fs.writeFileSync(path.join(changeDir, 'change.json'), JSON.stringify(json, null, 2));
}

/** 构造 tasks.json（5 pending + 3 done） */
function writeTasksMixed(changeDir: string): void {
    const tasks = [
        ...Array.from({ length: 5 }, (_, i) => ({
            id: `${i + 1}`, label: '代码', description: `待办任务`, status: 'pending', dependencies: [], files: [],
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
            id: `${i + 6}`, label: '测试', description: `已完成任务`, status: 'done', dependencies: [], files: [],
        })),
    ];
    fs.writeFileSync(path.join(changeDir, 'tasks.json'), JSON.stringify({
        $schema: 'venus/tasks/v1',
        tasks,
        progress: { total: 8, complete: 3, remaining: 5 },
    }, null, 2));
}

/** 构造全部 done 的 tasks.json */
function writeTasksAllDone(changeDir: string): void {
    const tasks = Array.from({ length: 4 }, (_, i) => ({
        id: `${i + 1}`, label: '代码', description: `完成项`, status: 'done', dependencies: [], files: [],
    }));
    fs.writeFileSync(path.join(changeDir, 'tasks.json'), JSON.stringify({
        $schema: 'venus/tasks/v1',
        tasks,
        progress: { total: 4, complete: 4, remaining: 0 },
    }, null, 2));
}

/** 创建 specs 目录文件（用于 skip_specs 冲突检测，非 change.json 段） */
function writeSpecsDir(changeDir: string, capability: string): void {
    fs.mkdirSync(path.join(changeDir, 'specs', capability), { recursive: true });
    fs.writeFileSync(path.join(changeDir, 'specs', capability, 'spec.md'), '## ADDED\n');
}

describe('venus spec instructions apply（任务 2.1）', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('Scenario: apply 阻塞态 - tasks 依赖未满足（specs/design 未完成，tasks.json 不存在）', () => {
        const changeDir = makeChange(projectRoot, 'blocked-change');
        writeMetadata(changeDir);
        writeChangeJson(changeDir, { proposal: true });

        const result = getApplyInstructions(projectRoot, 'blocked-change');

        expect(result.instruction.state).toBe('blocked');
        expect(result.instruction.missingDeps).toContain('specs');
        expect(result.instruction.missingDeps).toContain('design');
        expect(result.progress).toEqual({ total: 0, complete: 0, remaining: 0 });
        expect(result.taskList).toEqual([]);
        expect(result.contextFiles.tasks).toBe('');
        expect(result.changeName).toBe('blocked-change');
        expect(result.changeRoot).toBe(changeDir);
    });

    it('Scenario: apply ready 态 - 依赖满足且任务未完成（5 pending + 3 done）', () => {
        const changeDir = makeChange(projectRoot, 'ready-change');
        writeMetadata(changeDir);
        writeChangeJson(changeDir, { proposal: true, specs: true, design: true });
        writeTasksMixed(changeDir);

        const result = getApplyInstructions(projectRoot, 'ready-change');

        expect(result.instruction.state).toBe('ready');
        expect(result.progress).toEqual({ total: 8, complete: 3, remaining: 5 });
        expect(result.taskList).toHaveLength(8);
        const checkedItems = result.taskList.filter((t) => t.checked);
        const uncheckedItems = result.taskList.filter((t) => !t.checked);
        expect(checkedItems).toHaveLength(3);
        expect(uncheckedItems).toHaveLength(5);
        // contextFiles 四键均指向存在的文件
        expect(result.contextFiles.proposal).toContain('change.json');
        expect(result.contextFiles.specs).toContain('change.json');
        expect(result.contextFiles.design).toContain('change.json');
        expect(result.contextFiles.tasks).toContain('tasks.json');
    });

    it('Scenario: apply all_done 态 - 全部任务已完成', () => {
        const changeDir = makeChange(projectRoot, 'done-change');
        writeMetadata(changeDir);
        writeChangeJson(changeDir, { proposal: true, specs: true, design: true });
        writeTasksAllDone(changeDir);

        const result = getApplyInstructions(projectRoot, 'done-change');

        expect(result.instruction.state).toBe('all_done');
        expect(result.progress.remaining).toBe(0);
        expect(result.progress.complete).toBe(result.progress.total);
        expect(result.taskList.every((t) => t.checked)).toBe(true);
    });

    it('Scenario: 变更不存在 - 非零退出码，stderr 错误，不输出 JSON 主体', () => {
        expect(() => getApplyInstructions(projectRoot, 'ghost-change')).toThrowError(/变更不存在/);
    });
});

describe('skip_specs 状态语义（任务 2.2）', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('Scenario: status 报告 skipped 态', () => {
        const changeDir = makeChange(projectRoot, 'skip-change');
        writeMetadata(changeDir, { skipSpecs: true });
        writeChangeJson(changeDir, { proposal: true });

        const { output, exitCode } = runSpecStatus(projectRoot, { change: 'skip-change', json: true });
        expect(exitCode).toBe(0);
        const payload = JSON.parse(output);
        const byId = new Map(payload.artifacts.map((a: { id: string }) => [a.id, a]));

        expect(byId.get('specs')?.status).toBe('skipped');
        expect(byId.get('specs')?.missingDeps).toEqual([]);
        expect(byId.get('design')?.missingDeps ?? []).not.toContain('specs');
        const tasksMissing = byId.get('tasks')?.missingDeps ?? [];
        expect(tasksMissing).not.toContain('specs');
    });

    it('Scenario: instructions 对 skipped specs artifact 返回跳过指导', () => {
        const changeDir = makeChange(projectRoot, 'skip-instruct');
        writeMetadata(changeDir, { skipSpecs: true });
        writeChangeJson(changeDir, { proposal: true });

        const info = getInstructionsResult(projectRoot, 'skip-instruct', 'specs');

        expect(info.skipped).toBe(true);
        expect(
            info.template === '' || info.template.includes('skip_specs')
        ).toBe(true);
        expect(info.outputPath).toBe('');
        expect(info.template).not.toContain('## ADDED');
    });

    it('Scenario: apply 必需集将 skipped 视为满足', () => {
        const changeDir = makeChange(projectRoot, 'skip-apply');
        writeMetadata(changeDir, { skipSpecs: true });
        writeChangeJson(changeDir, { proposal: true, design: true });
        writeTasksMixed(changeDir);

        const result = getApplyInstructions(projectRoot, 'skip-apply');

        expect(result.instruction.missingDeps ?? []).not.toContain('specs');
        expect(result.instruction.state).toBe('ready');
        expect(result.contextFiles.specs).toBe('');
    });

    it('Scenario: 未声明 skip_specs 向后兼容', () => {
        const changeDir = makeChange(projectRoot, 'compat-change');
        writeMetadata(changeDir);
        writeChangeJson(changeDir, { proposal: true });

        const { output } = runSpecStatus(projectRoot, { change: 'compat-change', json: true });
        const payload = JSON.parse(output);
        const byId = new Map(payload.artifacts.map((a: { id: string }) => [a.id, a]));
        expect(byId.get('specs')?.status).toBe('ready');

        const info = getInstructionsResult(projectRoot, 'compat-change', 'specs');
        expect(info.skipped).toBeUndefined();
        expect(info.conflict).toBeUndefined();
        expect(info.template).toContain('## ADDED');
        expect(info.outputPath).toBe('change.json');
    });
});

describe('skip_specs 冲突检测（任务 2.3）', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('Scenario: status 报告冲突警告', () => {
        const changeDir = makeChange(projectRoot, 'conflict-change');
        writeMetadata(changeDir, { skipSpecs: true });
        writeChangeJson(changeDir, { proposal: true });
        writeSpecsDir(changeDir, 'auth');

        const { output, exitCode } = runSpecStatus(projectRoot, { change: 'conflict-change', json: true });
        expect(exitCode).toBe(0);
        const payload = JSON.parse(output);
        const byId = new Map(payload.artifacts.map((a: { id: string }) => [a.id, a]));

        expect(byId.get('specs')?.status).toBe('conflict');

        const warnings = payload.warnings ?? [];
        expect(warnings.some((w: string) => w.includes('skip_specs') && w.includes('冲突'))).toBe(true);

        const tasksMissing = byId.get('tasks')?.missingDeps ?? [];
        expect(tasksMissing).toContain('specs');
    });

    it('Scenario: instructions apply 在冲突态下返回 blocked 指导', () => {
        const changeDir = makeChange(projectRoot, 'conflict-apply');
        writeMetadata(changeDir, { skipSpecs: true });
        writeChangeJson(changeDir, { proposal: true, design: true });
        writeTasksMixed(changeDir);
        writeSpecsDir(changeDir, 'auth');

        const result = getApplyInstructions(projectRoot, 'conflict-apply');

        expect(result.instruction.state).toBe('blocked');
        expect(result.instruction.text).toContain('冲突');
        expect(result.instruction.state).not.toBe('ready');
        expect(result.instruction.state).not.toBe('all_done');
    });
});

describe('skip_specs instructions specs 冲突态', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('冲突态：instructions specs 输出冲突警告，不返回正常模板也不返回 skip guidance', () => {
        const changeDir = makeChange(projectRoot, 'conflict-specs-instruct');
        writeMetadata(changeDir, { skipSpecs: true });
        writeChangeJson(changeDir, { proposal: true });
        writeSpecsDir(changeDir, 'auth');

        const info = getInstructionsResult(projectRoot, 'conflict-specs-instruct', 'specs');

        expect(info.conflict).toBe(true);
        expect(info.warning).toContain('skip_specs');
        expect(info.template).not.toContain('## ADDED');
        expect(info.template).toBe('');
        expect(info.outputPath).toBe('');
    });
});