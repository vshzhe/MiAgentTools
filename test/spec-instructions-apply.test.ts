/**
 * iagent spec instructions apply 命令测试。
 *
 * Markdown-first：proposal/specs/design/tasks 均由 OpenSpec Markdown 提供，
 * CLI JSON 仅承载解析后的状态摘要。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getApplyInstructions, getInstructionsResult, runSpecStatus } from '../src/commands/spec.js';

/** 创建临时项目根目录 */
function makeTempProject(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-spec-apply-'));
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

/** 构造 OpenSpec Markdown artifact，可按依赖阶段选择文件。 */
function writeChangeJson(changeDir: string, sections: { proposal?: boolean; specs?: boolean; design?: boolean }): void {
    if (sections.proposal) {
        fs.writeFileSync(path.join(changeDir, 'proposal.md'), '# Proposal\n\n## Why\n测试原因\n\n## What Changes\n- 变更项\n\n## Capabilities\n\n### New Capabilities\n- `auth`: 测试能力\n\n## Impact\n兼容\n');
    }
    if (sections.specs) {
        fs.mkdirSync(path.join(changeDir, 'specs', 'auth'), { recursive: true });
        fs.writeFileSync(path.join(changeDir, 'specs', 'auth', 'spec.md'), '## ADDED Requirements\n\n### Requirement: Markdown source\n系统 SHALL 使用 Markdown。\n\n#### Scenario: Read source\n- **WHEN** 读取 Markdown\n- **THEN** 返回内容\n');
    }
    if (sections.design) {
        fs.writeFileSync(path.join(changeDir, 'design.md'), '# Design\n\n## Context\n测试上下文\n\n## Goals / Non-Goals\n\n## Decisions\n\n### D1: 测试决策\n选择 Markdown\n\n## Risks / Trade-offs\n风险\n');
    }
}

/** 构造 tasks.md（5 pending + 3 done） */
function writeTasksMixed(changeDir: string): void {
    const lines = ['# Tasks', '', '## 1. Tasks'];
    for (let i = 0; i < 5; i += 1) {
        lines.push(`- [ ] [代码] ${i + 1}.1 待办任务`);
    }
    for (let i = 0; i < 3; i += 1) {
        lines.push(`- [x] [测试][单元][P0] ${i + 6}.1 已完成任务`);
    }
    fs.writeFileSync(path.join(changeDir, 'tasks.md'), `${lines.join('\n')}\n`);
}

/** 构造全部 done 的 tasks.md */
function writeTasksAllDone(changeDir: string): void {
    const lines = ['# Tasks', '', '## 1. Tasks'];
    for (let i = 0; i < 4; i += 1) {
        lines.push(`- [x] [代码] ${i + 1}.1 完成项`);
    }
    fs.writeFileSync(path.join(changeDir, 'tasks.md'), `${lines.join('\n')}\n`);
}

/** 创建 specs 目录文件（用于 skip_specs 冲突检测）。 */
function writeSpecsDir(changeDir: string, capability: string): void {
    fs.mkdirSync(path.join(changeDir, 'specs', capability), { recursive: true });
    fs.writeFileSync(path.join(changeDir, 'specs', capability, 'spec.md'), '## ADDED Requirements\n\n### Requirement: Conflict\n系统 SHALL 报告冲突。\n\n#### Scenario: Conflict\n- **WHEN** 文件共存\n- **THEN** 返回冲突\n');
}

describe('iagent spec instructions apply（任务 2.1）', () => {
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
        expect(result.contextFiles.proposal).toContain('proposal.md');
        expect(result.contextFiles.specs).toContain(`${path.sep}specs`);
        expect(result.contextFiles.design).toContain('design.md');
        expect(result.contextFiles.tasks).toContain('tasks.md');
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
        expect(info.outputPath).toBe('specs/**/*.md');
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