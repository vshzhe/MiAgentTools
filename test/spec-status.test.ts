/**
 * spec 状态机测试：依赖图判定、进度统计、模板分发、.openspec.yaml 容错。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getBuildOrder, isValidArtifactId, getArtifactIds } from '../src/core/spec/schema.js';
import { getChangeStatus, parseTaskProgress, detectCompleted } from '../src/core/spec/status.js';
import { getArtifactInstructions } from '../src/core/spec/instructions.js';

/** 创建临时项目根目录并返回 */
function makeTempProject(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'venus-spec-test-'));
}

/** 在临时项目中创建变更目录 */
function makeChange(projectRoot: string, changeName: string): string {
    const changeDir = path.join(projectRoot, 'openspec', 'changes', changeName);
    fs.mkdirSync(changeDir, { recursive: true });
    return changeDir;
}

describe('spec 依赖图（schema）', () => {
    it('构建序按声明顺序拓扑排序', () => {
        expect(getBuildOrder()).toEqual(['proposal', 'specs', 'design', 'tasks']);
    });

    it('合法 id 校验与错误提示清单', () => {
        expect(isValidArtifactId('proposal')).toBe(true);
        expect(isValidArtifactId('invalid')).toBe(false);
        expect(getArtifactIds()).toEqual(['proposal', 'specs', 'design', 'tasks']);
    });
});

describe('spec 状态判定（status）', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('仅 proposal.md 存在：proposal done，specs/design ready，tasks blocked', () => {
        const changeDir = makeChange(projectRoot, 'change-a');
        fs.writeFileSync(path.join(changeDir, 'proposal.md'), '# 提案\n');
        const status = getChangeStatus(projectRoot, 'change-a');
        const byId = new Map(status.artifacts.map((a) => [a.id, a]));
        expect(byId.get('proposal')?.status).toBe('done');
        expect(byId.get('specs')?.status).toBe('ready');
        expect(byId.get('design')?.status).toBe('ready');
        expect(byId.get('tasks')?.status).toBe('blocked');
        expect(byId.get('tasks')?.missingDeps).toEqual(['specs', 'design']);
        expect(status.isPlanningComplete).toBe(false);
    });

    it('specs 目录存在 .md 文件即判定 specs done（glob 匹配）', () => {
        const changeDir = makeChange(projectRoot, 'change-b');
        fs.writeFileSync(path.join(changeDir, 'proposal.md'), '# 提案\n');
        fs.mkdirSync(path.join(changeDir, 'specs', 'auth'), { recursive: true });
        fs.writeFileSync(path.join(changeDir, 'specs', 'auth', 'spec.md'), '## ADDED\n');
        const completed = detectCompleted(changeDir);
        expect(completed.has('specs')).toBe(true);
    });

    it('全部 artifact 完成时 isPlanningComplete 为 true', () => {
        const changeDir = makeChange(projectRoot, 'change-c');
        fs.writeFileSync(path.join(changeDir, 'proposal.md'), '# 提案\n');
        fs.writeFileSync(path.join(changeDir, 'design.md'), '# 设计\n');
        fs.mkdirSync(path.join(changeDir, 'specs', 'auth'), { recursive: true });
        fs.writeFileSync(path.join(changeDir, 'specs', 'auth', 'spec.md'), '## ADDED\n');
        fs.writeFileSync(path.join(changeDir, 'tasks.md'), '# Tasks\n');
        expect(getChangeStatus(projectRoot, 'change-c').isPlanningComplete).toBe(true);
    });

    it('tasks.md 进度统计：5 未勾 + 3 已勾', () => {
        const changeDir = makeChange(projectRoot, 'change-d');
        const lines = [
            '# Tasks',
            ...Array.from({ length: 5 }, (_, i) => `- [ ] 1.${i + 1} 待办`),
            ...Array.from({ length: 3 }, (_, i) => `- [x] 2.${i + 1} 完成`),
        ];
        fs.writeFileSync(path.join(changeDir, 'tasks.md'), `${lines.join('\n')}\n`);
        expect(parseTaskProgress(changeDir)).toEqual({ total: 8, complete: 3, remaining: 5 });
    });

    it('tasks.md 存在但无勾选项：全零统计不报错', () => {
        const changeDir = makeChange(projectRoot, 'change-e');
        fs.writeFileSync(path.join(changeDir, 'tasks.md'), '# Tasks\n\n纯文字无任务\n');
        expect(parseTaskProgress(changeDir)).toEqual({ total: 0, complete: 0, remaining: 0 });
    });

    it('tasks.md 不存在：进度为 null', () => {
        const changeDir = makeChange(projectRoot, 'change-f');
        expect(parseTaskProgress(changeDir)).toBeNull();
    });

    it('.openspec.yaml 的 schema 非 spec-driven：WARN 后按内置依赖图处理', () => {
        const changeDir = makeChange(projectRoot, 'change-g');
        fs.writeFileSync(path.join(changeDir, '.openspec.yaml'), 'schema: custom-flow\ncreated: 2026-09-08\n');
        const status = getChangeStatus(projectRoot, 'change-g');
        expect(status.warnings.length).toBe(1);
        expect(status.warnings[0]).toContain('custom-flow');
        expect(status.artifacts.map((a) => a.id)).toEqual(['proposal', 'specs', 'design', 'tasks']);
    });
});

describe('spec 模板分发（instructions）', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('proposal 的 unlocks 含 design 与 specs，依赖为空', () => {
        makeChange(projectRoot, 'change-h');
        const info = getArtifactInstructions(projectRoot, 'change-h', 'proposal');
        expect(info.dependencies).toEqual([]);
        expect(info.unlocks).toEqual(['specs', 'design']);
        expect(info.template).toContain('## Why');
    });

    it('tasks 的依赖含 specs 与 design，模板含任务标签说明', () => {
        makeChange(projectRoot, 'change-i');
        const info = getArtifactInstructions(projectRoot, 'change-i', 'tasks');
        expect(info.dependencies.map((d) => d.id)).toEqual(['specs', 'design']);
        expect(info.template).toContain('[代码]');
    });

    it('非法 artifact id：报错并列出全部合法 id', () => {
        makeChange(projectRoot, 'change-j');
        expect(() => getArtifactInstructions(projectRoot, 'change-j', 'unknown')).toThrowError(
            /proposal \/ specs \/ design \/ tasks/
        );
    });

    it('变更不存在：报错并提示 venus spec new', () => {
        expect(() => getArtifactInstructions(projectRoot, 'ghost', 'proposal')).toThrowError(/venus spec new/);
    });
});
