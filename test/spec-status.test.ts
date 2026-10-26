/**
 * spec 状态机测试：依赖图判定、进度统计、模板分发、.openspec.yaml 容错。
 *
 * 更新：JSON-primary 化后，proposal/specs/design 按 change.json 段存在性判定，
 * tasks 按 tasks.json 存在性判定。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
import { getBuildOrder, isValidArtifactId, getArtifactIds } from '../src/core/spec/schema.js';
import { getChangeStatus, parseTaskProgress, detectCompleted } from '../src/core/spec/status.js';
import { getArtifactInstructions } from '../src/core/spec/instructions.js';

/** 创建临时项目根目录并返回 */
function makeTempProject(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-spec-test-'));
}

/** 在临时项目中创建变更目录 */
function makeChange(projectRoot: string, changeName: string): string {
    const changeDir = path.join(projectRoot, 'openspec', 'changes', changeName);
    fs.mkdirSync(changeDir, { recursive: true });
    return changeDir;
}

/** 构造最小合法 change.json（proposal 段） */
function writeChangeJson(changeDir: string, sections: { proposal?: boolean; specs?: boolean; design?: boolean }): void {
    const json: Record<string, unknown> = {
        $schema: 'iagent/change/v1',
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
        json.specs = [{ name: 'test-cap', path: 'specs/test-cap/spec.md', operations: [] }];
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

/** 构造最小合法 tasks.json */
function writeTasksJson(changeDir: string, tasks: Array<{ id: string; status: string }>): void {
    const json = {
        $schema: 'iagent/tasks/v1',
        tasks: tasks.map((t) => ({
            id: t.id,
            label: '代码',
            description: `任务 ${t.id}`,
            status: t.status,
            dependencies: [],
            files: [],
        })),
        progress: { total: tasks.length, complete: tasks.filter((t) => t.status === 'done').length, remaining: tasks.filter((t) => t.status !== 'done').length },
    };
    fs.writeFileSync(path.join(changeDir, 'tasks.json'), JSON.stringify(json, null, 2));
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

    it('仅 change.json proposal 段存在：proposal done，specs/design ready，tasks blocked', () => {
        const changeDir = makeChange(projectRoot, 'change-a');
        writeChangeJson(changeDir, { proposal: true });
        const status = getChangeStatus(projectRoot, 'change-a');
        const byId = new Map(status.artifacts.map((a) => [a.id, a]));
        expect(byId.get('proposal')?.status).toBe('done');
        expect(byId.get('specs')?.status).toBe('ready');
        expect(byId.get('design')?.status).toBe('ready');
        expect(byId.get('tasks')?.status).toBe('blocked');
        expect(byId.get('tasks')?.missingDeps).toEqual(['specs', 'design']);
        expect(status.isPlanningComplete).toBe(false);
    });

    it('change.json specs 段存在非空数组即判定 specs done（内容级检测）', () => {
        const changeDir = makeChange(projectRoot, 'change-b');
        writeChangeJson(changeDir, { proposal: true, specs: true });
        const completed = detectCompleted(changeDir);
        expect(completed.has('specs')).toBe(true);
    });

    it('全部 artifact 完成时 isPlanningComplete 为 true', () => {
        const changeDir = makeChange(projectRoot, 'change-c');
        writeChangeJson(changeDir, { proposal: true, specs: true, design: true });
        writeTasksJson(changeDir, [{ id: '1', status: 'pending' }]);
        expect(getChangeStatus(projectRoot, 'change-c').isPlanningComplete).toBe(true);
    });

    it('tasks.json 进度统计：5 pending + 3 done', () => {
        const changeDir = makeChange(projectRoot, 'change-d');
        const tasks = [
            ...Array.from({ length: 5 }, (_, i) => ({ id: `${i + 1}`, status: 'pending' })),
            ...Array.from({ length: 3 }, (_, i) => ({ id: `${i + 6}`, status: 'done' })),
        ];
        writeTasksJson(changeDir, tasks);
        expect(parseTaskProgress(changeDir)).toEqual({ total: 8, complete: 3, remaining: 5 });
    });

    it('tasks.json 存在但 tasks 为空数组：全零统计不报错', () => {
        const changeDir = makeChange(projectRoot, 'change-e');
        writeTasksJson(changeDir, []);
        expect(parseTaskProgress(changeDir)).toEqual({ total: 0, complete: 0, remaining: 0 });
    });

    it('tasks.json 不存在：进度为 null', () => {
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

    it('变更不存在：报错并提示 iagent spec new', () => {
        expect(() => getArtifactInstructions(projectRoot, 'ghost', 'proposal')).toThrowError(/iagent spec new/);
    });
});

// 任务 2.16：跨变更索引退役后的「措辞收口」——只读兼容路径不再以索引 / 索引重建为出口。
describe('2.16 只读兼容路径的措辞收口（索引退役）', () => {
    it('status / migration / archive / instructions 源码零索引措辞', () => {
        const files = ['status.ts', 'migration.ts', 'archive.ts', 'instructions.ts'];
        const forbidden = ['reindex', 'INDEX_DB_PATH', 'index.db', '生成索引', 'sqlite'];
        for (const name of files) {
            const file = fileURLToPath(new URL(`../src/core/spec/${name}`, import.meta.url));
            const source = fs.readFileSync(file, 'utf8');
            for (const word of forbidden) {
                expect(source, `${name} 仍含索引措辞 ${word}`).not.toContain(word);
            }
        }
    });

    it('历史 JSON-only 变更的只读状态行为不变（不因索引退役而改变判定）', () => {
        const root = makeTempProject();
        try {
            const changeDir = makeChange(root, 'legacy-readonly');
            writeChangeJson(changeDir, { proposal: true });
            // 仅 change.json、无 Markdown：只读状态可判定，不要求任何索引
            const status = getChangeStatus(root, 'legacy-readonly');
            const proposal = status.artifacts.find((artifact) => artifact.id === 'proposal');
            expect(proposal?.status).toBe('done');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});