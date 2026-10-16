/**
 * sidecar-writer 模块单元测试。
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
    ensureSidecarDir,
    validateSidecar,
    writeManifestJson,
    writeTasksJson,
    writeDecisionsJson,
    writeCapabilitiesJson,
    renderTasksMd,
    initTasksJson,
    readChangeJson,
    writeChangeJson,
    initChangeJson,
    type ManifestMeta,
} from '../src/core/spec/sidecar-writer.js';
import type {
    TasksSchema,
    TaskEntry,
    ChangeSchema,
    ProposalSection,
    DesignSection,
    SpecsSection,
} from '../src/core/spec/sidecar-schema.js';

function tempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-sidecar-writer-test-'));
}

/** 构造合法的 tasks 测试数据 */
function makeTasks(overrides: Partial<TaskEntry>[] = []): TasksSchema {
    const tasks: TaskEntry[] = overrides.map((o, i) => ({
        id: String(i + 1),
        label: '代码',
        description: `Task ${i + 1}`,
        status: 'pending' as const,
        dependencies: [],
        files: [],
        ...o,
    }));
    return {
        $schema: 'iagent/tasks/v1',
        tasks,
        progress: { total: tasks.length, complete: 0, remaining: tasks.length },
    };
}

/** 构造合法的 proposal 段测试数据 */
function makeProposal(overrides: Partial<ProposalSection> = {}): ProposalSection {
    return {
        why: '需要结构化数据真源',
        whatChanges: ['引入 change.json'],
        capabilities: {
            new: [{ name: 'sidecar-writer', description: '写入器' }],
            modified: [],
        },
        impact: {
            files: [{ path: 'src/core/spec/sidecar-writer.ts', description: '新增渲染函数' }],
            breaking: false,
            compatibility: '无破坏性变更',
        },
        ...overrides,
    };
}

/** 构造合法的 design 段测试数据 */
function makeDesign(overrides: Partial<DesignSection> = {}): DesignSection {
    return {
        context: '设计上下文',
        goals: ['目标一'],
        nonGoals: ['非目标一'],
        decisions: [
            {
                id: 'D1',
                title: '决策标题',
                choice: '选择 A',
                alternatives: ['备选 B', '备选 C'],
                rationale: '理由 X',
                risks: [],
                relatedFiles: [],
            },
        ],
        risks: [{ risk: '风险一', mitigation: '缓解一' }],
        ...overrides,
    };
}

/** 构造合法的 change.json 根数据（带明显过期的 updatedAt 以便断言刷新） */
function makeChange(overrides: Partial<ChangeSchema> = {}): ChangeSchema {
    return {
        $schema: 'iagent/change/v1',
        changeName: 'test-change',
        createdAt: '2000-01-01T00:00:00.000Z',
        updatedAt: '2000-01-01T00:00:00.000Z',
        phase: 'proposal',
        ...overrides,
    };
}

/** 构造合法的 specs 段测试数据（两个能力，操作乱序） */
function makeSpecs(): SpecsSection {
    return [
        {
            name: 'sidecar-writer',
            path: 'specs/sidecar-writer/spec.md',
            operations: [
                { type: 'MODIFIED', requirement: 'R2', description: '修改需求' },
                {
                    type: 'ADDED',
                    requirement: 'R1',
                    description: '新增需求',
                    scenarios: [
                        { name: 'S1', given: '前置条件', when: '触发', then: '结果' },
                        { name: 'S2', given: '', when: '触发2', then: '结果2' },
                    ],
                },
            ],
        },
        {
            name: 'other-capability',
            path: 'specs/other-capability/spec.md',
            operations: [
                { type: 'REMOVED', requirement: 'R3', reason: '过时', migration: '改用 R1' },
                { type: 'RENAMED', requirement: 'R4', from: '旧需求名', to: '新需求名' },
            ],
        },
    ];
}

describe('sidecar-writer 模块', () => {
    describe('ensureSidecarDir', () => {
        it('创建 .iagent/ 目录并返回路径', () => {
            const dir = tempDir();
            try {
                const sidecarDir = ensureSidecarDir(dir);
                expect(sidecarDir.endsWith('.iagent')).toBe(true);
                expect(fs.existsSync(sidecarDir)).toBe(true);
                // 幂等
                const sidecarDir2 = ensureSidecarDir(dir);
                expect(sidecarDir2).toBe(sidecarDir);
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });
    });

    describe('validateSidecar', () => {
        it('manifest: changeName 缺失时报错', () => {
            const result = validateSidecar('manifest', { $schema: 'iagent/manifest/v1', changeName: '' });
            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('changeName'))).toBe(true);
        });

        it('manifest: 合法数据通过', () => {
            const result = validateSidecar('manifest', {
                $schema: 'iagent/manifest/v1',
                changeName: 'test',
                phase: 'proposal',
            });
            expect(result.valid).toBe(true);
        });

        it('旧品牌 $schema 值（venus/...）在读取端被接受（历史文档兼容）', () => {
            // 品牌改名后写入端写 iagent/...；已存在的历史变更文件仍是 venus/...，
            // 读取端只校验 $schema 非空，故历史文档无需改写即可继续读取
            const change = validateSidecar('change', {
                $schema: 'venus/change/v1',
                changeName: 'legacy-change',
                phase: 'proposal',
            });
            expect(change.valid).toBe(true);
            const tasks = validateSidecar('tasks', { $schema: 'venus/tasks/v1', tasks: [] });
            expect(tasks.valid).toBe(true);
        });

        it('tasks: 缺少必填字段报错', () => {
            const result = validateSidecar('tasks', {
                $schema: 'iagent/tasks/v1',
                tasks: [{ description: 'no id' }],
            });
            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('id'))).toBe(true);
        });

        it('tasks: 合法数据通过', () => {
            const result = validateSidecar('tasks', makeTasks([{}, {}]));
            expect(result.valid).toBe(true);
        });

        it('tasks: 非法 status 报错', () => {
            const tasks = makeTasks([{ status: 'in_progress' as unknown as 'pending' }]);
            const result = validateSidecar('tasks', tasks);
            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('status'))).toBe(true);
        });

        it('decisions: 合法数据通过', () => {
            const result = validateSidecar('decisions', {
                $schema: 'iagent/decisions/v1',
                decisions: [{ id: 'D1', title: 'Test', choice: 'Option A' }],
            });
            expect(result.valid).toBe(true);
        });

        it('decisions: 缺少必填字段报错', () => {
            const result = validateSidecar('decisions', {
                $schema: 'iagent/decisions/v1',
                decisions: [{ title: 'no id or choice' }],
            });
            expect(result.valid).toBe(false);
        });

        it('capabilities: 合法数据通过', () => {
            const result = validateSidecar('capabilities', {
                $schema: 'iagent/capabilities/v1',
                capabilities: [{ name: 'export', operations: [{ type: 'ADDED' }] }],
            });
            expect(result.valid).toBe(true);
        });

        it('capabilities: 非法 operation type 报错', () => {
            const result = validateSidecar('capabilities', {
                $schema: 'iagent/capabilities/v1',
                capabilities: [{ name: 'export', operations: [{ type: 'DELETED' }] }],
            });
            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('type'))).toBe(true);
        });

        it('null 数据报错', () => {
            const result = validateSidecar('tasks', null);
            expect(result.valid).toBe(false);
        });

        it('未知类型报错', () => {
            const result = validateSidecar('unknown', {});
            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('未知'))).toBe(true);
        });
    });

    describe('writeManifestJson', () => {
        it('自动填充 timestamp + phase 并写入', () => {
            const dir = tempDir();
            try {
                const meta: ManifestMeta = { changeName: 'add-test', capabilities: ['test'] };
                const manifest = writeManifestJson(dir, meta);
                expect(manifest.changeName).toBe('add-test');
                expect(manifest.$schema).toBe('iagent/manifest/v1');
                expect(manifest.createdAt).toBeTruthy();
                expect(manifest.updatedAt).toBeTruthy();
                expect(manifest.phase).toBe('proposal');
                expect(manifest.capabilities).toEqual(['test']);

                // 验证文件存在
                const fpath = path.join(dir, '.iagent', 'manifest.json');
                expect(fs.existsSync(fpath)).toBe(true);
                const parsed = JSON.parse(fs.readFileSync(fpath, 'utf8'));
                expect(parsed.changeName).toBe('add-test');
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });

        it('phase 默认 proposal', () => {
            const dir = tempDir();
            try {
                const manifest = writeManifestJson(dir, { changeName: 'test' });
                expect(manifest.phase).toBe('proposal');
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });
    });

    describe('writeTasksJson', () => {
        it('写入 tasks.json 并自动修正 progress', () => {
            const dir = tempDir();
            try {
                const tasks = makeTasks([{ id: '1.1', status: 'done' }, { id: '1.2', status: 'pending' }]);
                const result = writeTasksJson(dir, tasks);
                expect(result.progress.complete).toBe(1);
                expect(result.progress.remaining).toBe(1);

                const fpath = path.join(dir, 'tasks.json');
                expect(fs.existsSync(fpath)).toBe(true);
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });

        it('校验失败时抛出异常', () => {
            const dir = tempDir();
            try {
                expect(() =>
                    writeTasksJson(dir, {
                        $schema: 'iagent/tasks/v1',
                        tasks: [{ description: 'no id or label' } as unknown as TaskEntry],
                        progress: { total: 1, complete: 0, remaining: 1 },
                    }),
                ).toThrow(/校验失败/);
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });
    });

    describe('writeDecisionsJson', () => {
        it('写入 decisions.json', () => {
            const dir = tempDir();
            try {
                const decisions = {
                    $schema: 'iagent/decisions/v1' as const,
                    decisions: [{ id: 'D1', title: 'Test', choice: 'Option A', alternatives: [], rationale: 'Because', risks: [], relatedFiles: [] }],
                };
                writeDecisionsJson(dir, decisions);
                const fpath = path.join(dir, '.iagent', 'decisions.json');
                expect(fs.existsSync(fpath)).toBe(true);
                const parsed = JSON.parse(fs.readFileSync(fpath, 'utf8'));
                expect(parsed.decisions[0].id).toBe('D1');
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });
    });

    describe('writeCapabilitiesJson', () => {
        it('写入 capabilities.json', () => {
            const dir = tempDir();
            try {
                const capabilities = {
                    $schema: 'iagent/capabilities/v1' as const,
                    capabilities: [
                        {
                            name: 'export',
                            operations: [
                                { type: 'ADDED' as const, requirement: 'Export Excel', scenarios: [] },
                            ],
                        },
                    ],
                };
                writeCapabilitiesJson(dir, capabilities);
                const fpath = path.join(dir, '.iagent', 'capabilities.json');
                expect(fs.existsSync(fpath)).toBe(true);
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });
    });

    describe('renderTasksMd', () => {
        it('渲染 tasks.md 含正确的 checkbox 状态', () => {
            const tasks = makeTasks([
                { id: '1.1', status: 'done', batchGroup: '1. Group A' },
                { id: '1.2', status: 'pending', batchGroup: '1. Group A' },
            ]);
            const md = renderTasksMd(tasks, 'test-change');
            expect(md).toContain('# Tasks: test-change');
            expect(md).toContain('- [x]');
            expect(md).toContain('- [ ]');
            expect(md).toContain('## 1. Group A');
            expect(md).toContain('> 进度: 1/2 (50%)');
        });

        it('渲染子字段（dependencies/filename）', () => {
            const tasks = makeTasks([
                { id: '1.1', status: 'pending', batchGroup: '1. Group A', dependencies: ['0.1'], files: ['src/a.ts'] },
            ]);
            const md = renderTasksMd(tasks, 'test-change');
            expect(md).toContain('依赖: 0.1');
            expect(md).toContain('产出文件: `src/a.ts`');
        });

        it('渲染 subLabel 和 priority', () => {
            const tasks = makeTasks([
                { id: '1.1', status: 'pending', batchGroup: '1. Group A', subLabel: '单元', priority: 'P0' },
            ]);
            const md = renderTasksMd(tasks, 'test-change');
            expect(md).toContain('[代码][单元][P0]');
        });

        it('无 batchGroup 的任务归入 其他任务', () => {
            const tasks = makeTasks([{ id: '1.1', status: 'pending' }]);
            const md = renderTasksMd(tasks, 'test-change');
            expect(md).toContain('## 其他任务');
        });

        it('幂等：相同输入产生相同输出', () => {
            const tasks = makeTasks([{ id: '1.1', status: 'pending', batchGroup: '1. Group A' }]);
            const md1 = renderTasksMd(tasks, 'test-change');
            const md2 = renderTasksMd(tasks, 'test-change');
            expect(md1).toBe(md2);
        });

        it('进度为 0% 时正确渲染', () => {
            const tasks = makeTasks([{ id: '1.1', status: 'pending' }, { id: '1.2', status: 'pending' }]);
            const md = renderTasksMd(tasks, 'test-change');
            expect(md).toContain('> 进度: 0/2 (0%)');
        });

        it('全部完成时正确渲染 100%', () => {
            const tasks = makeTasks([{ id: '1.1', status: 'done' }, { id: '1.2', status: 'done' }]);
            // writeTasksJson would auto-calc progress, but here we test raw render
            tasks.progress = { total: 2, complete: 2, remaining: 0 };
            const md = renderTasksMd(tasks, 'test-change');
            expect(md).toContain('> 进度: 2/2 (100%)');
        });

        it('存量回归：label 为 "[代码]"（带方括号）时归一化渲染为 [代码]', () => {
            const tasks = makeTasks([{ id: '1.1', label: '[代码]', batchGroup: '1. Group A' }]);
            const md = renderTasksMd(tasks, 'test-change');
            expect(md).toContain('- [ ] [代码] 1.1 Task 1');
            expect(md).not.toContain('[[代码]]');
        });
    });

    describe('initTasksJson', () => {
        it('创建空 tasks.json 骨架', () => {
            const dir = tempDir();
            try {
                const tasks = initTasksJson(dir);
                expect(tasks.$schema).toBe('iagent/tasks/v1');
                expect(tasks.tasks).toEqual([]);
                expect(tasks.progress.total).toBe(0);
                const fpath = path.join(dir, 'tasks.json');
                expect(fs.existsSync(fpath)).toBe(true);
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });
    });

    describe('change.json 读写', () => {
        describe('writeChangeJson', () => {
            it('合法数据写入成功并刷新 updatedAt', () => {
                const dir = tempDir();
                try {
                    const data = makeChange({ proposal: makeProposal() });
                    const result = writeChangeJson(dir, data);
                    expect(result.changeName).toBe('test-change');
                    // createdAt 保留，updatedAt 刷新为当前时间
                    expect(result.createdAt).toBe('2000-01-01T00:00:00.000Z');
                    expect(result.updatedAt).not.toBe('2000-01-01T00:00:00.000Z');
                    expect(Date.parse(result.updatedAt)).toBeGreaterThan(Date.parse('2000-01-01T00:00:00.000Z'));

                    const fpath = path.join(dir, 'change.json');
                    expect(fs.existsSync(fpath)).toBe(true);
                    const parsed = JSON.parse(fs.readFileSync(fpath, 'utf8'));
                    expect(parsed.changeName).toBe('test-change');
                    expect(parsed.proposal.whatChanges).toEqual(['引入 change.json']);
                    expect(parsed.updatedAt).toBe(result.updatedAt);
                } finally {
                    fs.rmSync(dir, { recursive: true, force: true });
                }
            });

            it('校验失败抛 Error 且错误信息含字段路径', () => {
                const dir = tempDir();
                try {
                    const data = makeChange({
                        proposal: {
                            why: '原因',
                            whatChanges: '不是数组',
                            capabilities: { new: [], modified: [] },
                            impact: { files: [], breaking: false, compatibility: '无' },
                        } as unknown as ProposalSection,
                    });
                    expect(() => writeChangeJson(dir, data)).toThrow(/proposal\.whatChanges/);
                    // 校验失败不落盘
                    expect(fs.existsSync(path.join(dir, 'change.json'))).toBe(false);
                } finally {
                    fs.rmSync(dir, { recursive: true, force: true });
                }
            });

            it('specs 段深层字段路径错误同样被报出', () => {
                const dir = tempDir();
                try {
                    const data = makeChange({
                        specs: [
                            {
                                name: 'demo',
                                path: 'specs/demo/spec.md',
                                operations: [{ type: 'ADDED', requirement: 'R1' }],
                            },
                        ],
                    });
                    expect(() => writeChangeJson(dir, data)).toThrow(/specs\[0\]\.operations\[0\]\.description/);
                } finally {
                    fs.rmSync(dir, { recursive: true, force: true });
                }
            });
        });

        describe('readChangeJson', () => {
            it('文件缺失返回 null', () => {
                const dir = tempDir();
                try {
                    expect(readChangeJson(dir)).toBeNull();
                } finally {
                    fs.rmSync(dir, { recursive: true, force: true });
                }
            });

            it('JSON 损坏返回 null', () => {
                const dir = tempDir();
                try {
                    const sidecarDir = ensureSidecarDir(dir);
                    fs.writeFileSync(path.join(sidecarDir, 'change.json'), '{ 不是合法 JSON', 'utf8');
                    expect(readChangeJson(dir)).toBeNull();
                } finally {
                    fs.rmSync(dir, { recursive: true, force: true });
                }
            });

            it('非对象 JSON 返回 null', () => {
                const dir = tempDir();
                try {
                    const sidecarDir = ensureSidecarDir(dir);
                    fs.writeFileSync(path.join(sidecarDir, 'change.json'), '"just a string"', 'utf8');
                    expect(readChangeJson(dir)).toBeNull();
                } finally {
                    fs.rmSync(dir, { recursive: true, force: true });
                }
            });

            it('正常读取与写入往返一致', () => {
                const dir = tempDir();
                try {
                    const data = makeChange({
                        proposal: makeProposal(),
                        design: makeDesign(),
                        specs: makeSpecs(),
                    });
                    writeChangeJson(dir, data);
                    const read = readChangeJson(dir);
                    expect(read).not.toBeNull();
                    expect(read).toEqual(data);
                    expect(read?.proposal?.whatChanges).toEqual(['引入 change.json']);
                    expect(read?.design?.decisions[0].id).toBe('D1');
                    expect(read?.specs?.length).toBe(2);
                } finally {
                    fs.rmSync(dir, { recursive: true, force: true });
                }
            });
        });

        describe('initChangeJson', () => {
            it('创建骨架（根字段就绪，三段缺省）', () => {
                const dir = tempDir();
                try {
                    const change = initChangeJson(dir, 'demo-change');
                    expect(change.$schema).toBe('iagent/change/v1');
                    expect(change.changeName).toBe('demo-change');
                    expect(change.phase).toBe('proposal');
                    expect(change.createdAt).toBeTruthy();
                    expect(change.updatedAt).toBeTruthy();
                    expect(change.proposal).toBeUndefined();
                    expect(change.design).toBeUndefined();
                    expect(change.specs).toBeUndefined();

                    const fpath = path.join(dir, 'change.json');
                    expect(fs.existsSync(fpath)).toBe(true);
                    expect(JSON.parse(fs.readFileSync(fpath, 'utf8')).changeName).toBe('demo-change');
                } finally {
                    fs.rmSync(dir, { recursive: true, force: true });
                }
            });

            it('幂等：已存在时不覆盖既有内容', () => {
                const dir = tempDir();
                try {
                    writeChangeJson(dir, makeChange({ changeName: 'existing-change', proposal: makeProposal() }));
                    const fpath = path.join(dir, 'change.json');
                    const before = fs.readFileSync(fpath, 'utf8');

                    const change = initChangeJson(dir, 'other-name');

                    // 返回既有数据（changeName 未被新参数覆盖），文件内容逐字节不变
                    expect(change.changeName).toBe('existing-change');
                    expect(fs.readFileSync(fpath, 'utf8')).toBe(before);
                } finally {
                    fs.rmSync(dir, { recursive: true, force: true });
                }
            });
        });
    });
});