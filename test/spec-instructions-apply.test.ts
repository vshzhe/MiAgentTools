/**
 * venus spec instructions apply 命令测试。
 *
 * 覆盖 delta spec 的全部 10 个 Scenario：
 *   apply 命令 4 场景：blocked / ready / all_done / 变更不存在
 *   skip_specs 4 场景：status 报告 skipped / instructions 跳过指导 / apply 必需集视为满足 / 未声明向后兼容
 *   冲突 2 场景：status 冲突警告 / apply 冲突态 blocked
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

/** 构造含 5 个未勾选 + 3 个已勾选的 tasks.md */
function writeTasksMixed(changeDir: string): void {
    const lines = [
        '# Tasks',
        ...Array.from({ length: 5 }, (_, i) => `- [ ] 1.${i + 1} 待办任务`),
        ...Array.from({ length: 3 }, (_, i) => `- [x] 2.${i + 1} 已完成任务`),
    ];
    fs.writeFileSync(path.join(changeDir, 'tasks.md'), `${lines.join('\n')}\n`, 'utf8');
}

/** 构造全部已勾选的 tasks.md */
function writeTasksAllDone(changeDir: string): void {
    const lines = [
        '# Tasks',
        ...Array.from({ length: 4 }, (_, i) => `- [x] ${i + 1} 完成项`),
    ];
    fs.writeFileSync(path.join(changeDir, 'tasks.md'), `${lines.join('\n')}\n`, 'utf8');
}

describe('venus spec instructions apply（任务 2.1）', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('Scenario: apply 阻塞态 - tasks 依赖未满足（specs/design 未完成，tasks.md 不存在）', () => {
        const changeDir = makeChange(projectRoot, 'blocked-change');
        writeMetadata(changeDir);
        fs.writeFileSync(path.join(changeDir, 'proposal.md'), '# 提案\n');

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

    it('Scenario: apply ready 态 - 依赖满足且任务未完成（5 [ ] + 3 [x]）', () => {
        const changeDir = makeChange(projectRoot, 'ready-change');
        writeMetadata(changeDir);
        fs.writeFileSync(path.join(changeDir, 'proposal.md'), '# 提案\n');
        fs.writeFileSync(path.join(changeDir, 'design.md'), '# 设计\n');
        fs.mkdirSync(path.join(changeDir, 'specs', 'auth'), { recursive: true });
        fs.writeFileSync(path.join(changeDir, 'specs', 'auth', 'spec.md'), '## ADDED\n');
        writeTasksMixed(changeDir);

        const result = getApplyInstructions(projectRoot, 'ready-change');

        expect(result.instruction.state).toBe('ready');
        expect(result.progress).toEqual({ total: 8, complete: 3, remaining: 5 });
        expect(result.taskList).toHaveLength(8);
        // 3 项 checked: true，5 项 checked: false
        const checkedItems = result.taskList.filter((t) => t.checked);
        const uncheckedItems = result.taskList.filter((t) => !t.checked);
        expect(checkedItems).toHaveLength(3);
        expect(uncheckedItems).toHaveLength(5);
        // contextFiles 四键均指向存在的绝对路径
        for (const key of ['proposal', 'specs', 'design', 'tasks'] as const) {
            expect(result.contextFiles[key]).not.toBe('');
            expect(fs.existsSync(result.contextFiles[key])).toBe(true);
        }
    });

    it('Scenario: apply all_done 态 - 全部任务已完成', () => {
        const changeDir = makeChange(projectRoot, 'done-change');
        writeMetadata(changeDir);
        fs.writeFileSync(path.join(changeDir, 'proposal.md'), '# 提案\n');
        fs.writeFileSync(path.join(changeDir, 'design.md'), '# 设计\n');
        fs.mkdirSync(path.join(changeDir, 'specs', 'auth'), { recursive: true });
        fs.writeFileSync(path.join(changeDir, 'specs', 'auth', 'spec.md'), '## ADDED\n');
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
        fs.writeFileSync(path.join(changeDir, 'proposal.md'), '# 提案\n');

        const { output, exitCode } = runSpecStatus(projectRoot, { change: 'skip-change', json: true });
        expect(exitCode).toBe(0);
        const payload = JSON.parse(output);
        const byId = new Map(payload.artifacts.map((a: { id: string }) => [a.id, a]));

        // specs 为 skipped，missingDeps 为 []
        expect(byId.get('specs')?.status).toBe('skipped');
        expect(byId.get('specs')?.missingDeps).toEqual([]);

        // design 的 missingDeps 不含 specs（design.requires=[proposal]，proposal done）
        expect(byId.get('design')?.missingDeps ?? []).not.toContain('specs');

        // tasks 的 missingDeps 不含 specs（skipped 视为满足），但可能含 design
        const tasksMissing = byId.get('tasks')?.missingDeps ?? [];
        expect(tasksMissing).not.toContain('specs');
    });

    it('Scenario: instructions 对 skipped specs artifact 返回跳过指导', () => {
        const changeDir = makeChange(projectRoot, 'skip-instruct');
        writeMetadata(changeDir, { skipSpecs: true });
        fs.writeFileSync(path.join(changeDir, 'proposal.md'), '# 提案\n');

        const info = getInstructionsResult(projectRoot, 'skip-instruct', 'specs');

        expect(info.skipped).toBe(true);
        // template 为空字符串或包含 skip guidance 文本
        expect(
            info.template === '' || info.template.includes('skip_specs')
        ).toBe(true);
        // outputPath 为空字符串
        expect(info.outputPath).toBe('');
        // 不返回正常创建模板正文（SPECS_TEMPLATE 以 "## ADDED" 开头）
        expect(info.template).not.toContain('## ADDED');
    });

    it('Scenario: apply 必需集将 skipped 视为满足', () => {
        const changeDir = makeChange(projectRoot, 'skip-apply');
        writeMetadata(changeDir, { skipSpecs: true });
        fs.writeFileSync(path.join(changeDir, 'proposal.md'), '# 提案\n');
        fs.writeFileSync(path.join(changeDir, 'design.md'), '# 设计\n');
        // specs/ 目录不存在（skip_specs 声明，无 delta spec 文件）
        writeTasksMixed(changeDir);

        const result = getApplyInstructions(projectRoot, 'skip-apply');

        // instruction 不将 specs 列为 missingDep
        expect(result.instruction.missingDeps ?? []).not.toContain('specs');
        // apply 状态根据 tasks 进度判定为 ready（不因 specs 缺失而 blocked）
        expect(result.instruction.state).toBe('ready');
        // contextFiles.specs 为空字符串（标记为 skipped/省略）
        expect(result.contextFiles.specs).toBe('');
    });

    it('Scenario: 未声明 skip_specs 向后兼容', () => {
        const changeDir = makeChange(projectRoot, 'compat-change');
        writeMetadata(changeDir); // 不含 skip_specs
        fs.writeFileSync(path.join(changeDir, 'proposal.md'), '# 提案\n');

        // status 行为：specs 为 ready（proposal done，specs 文件不存在）
        const { output } = runSpecStatus(projectRoot, { change: 'compat-change', json: true });
        const payload = JSON.parse(output);
        const byId = new Map(payload.artifacts.map((a: { id: string }) => [a.id, a]));
        expect(byId.get('specs')?.status).toBe('ready');

        // instructions specs 返回正常创建模板
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
        fs.writeFileSync(path.join(changeDir, 'proposal.md'), '# 提案\n');
        // specs/ 下存在 delta spec 文件（与 skip_specs 声明冲突）
        fs.mkdirSync(path.join(changeDir, 'specs', 'auth'), { recursive: true });
        fs.writeFileSync(path.join(changeDir, 'specs', 'auth', 'spec.md'), '## ADDED\n');

        const { output, exitCode } = runSpecStatus(projectRoot, { change: 'conflict-change', json: true });
        expect(exitCode).toBe(0);
        const payload = JSON.parse(output);
        const byId = new Map(payload.artifacts.map((a: { id: string }) => [a.id, a]));

        // specs 标记为 conflict
        expect(byId.get('specs')?.status).toBe('conflict');

        // warnings 含冲突说明
        const warnings = payload.warnings ?? [];
        expect(warnings.some((w: string) => w.includes('skip_specs') && w.includes('冲突'))).toBe(true);

        // tasks 的 missingDeps 含 specs（冲突不视为满足）
        const tasksMissing = byId.get('tasks')?.missingDeps ?? [];
        expect(tasksMissing).toContain('specs');
    });

    it('Scenario: instructions apply 在冲突态下返回 blocked 指导', () => {
        const changeDir = makeChange(projectRoot, 'conflict-apply');
        writeMetadata(changeDir, { skipSpecs: true });
        fs.writeFileSync(path.join(changeDir, 'proposal.md'), '# 提案\n');
        fs.writeFileSync(path.join(changeDir, 'design.md'), '# 设计\n');
        writeTasksMixed(changeDir);
        // specs/ 下存在 delta spec 文件（与 skip_specs 声明冲突）
        fs.mkdirSync(path.join(changeDir, 'specs', 'auth'), { recursive: true });
        fs.writeFileSync(path.join(changeDir, 'specs', 'auth', 'spec.md'), '## ADDED\n');

        const result = getApplyInstructions(projectRoot, 'conflict-apply');

        // 冲突态返回 blocked
        expect(result.instruction.state).toBe('blocked');
        // 提示先解决冲突
        expect(result.instruction.text).toContain('冲突');
        // 不进入 ready 或 all_done
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
        fs.writeFileSync(path.join(changeDir, 'proposal.md'), '# 提案\n');
        fs.mkdirSync(path.join(changeDir, 'specs', 'auth'), { recursive: true });
        fs.writeFileSync(path.join(changeDir, 'specs', 'auth', 'spec.md'), '## ADDED\n');

        const info = getInstructionsResult(projectRoot, 'conflict-specs-instruct', 'specs');

        // conflict 标记为 true
        expect(info.conflict).toBe(true);
        // warning 含冲突说明
        expect(info.warning).toContain('skip_specs');
        // 不返回正常创建模板（SPECS_TEMPLATE 正文）
        expect(info.template).not.toContain('## ADDED');
        // 不返回 skip guidance（template 不含 skip_specs 文本，应为空字符串）
        expect(info.template).toBe('');
        // outputPath 清空
        expect(info.outputPath).toBe('');
    });
});
