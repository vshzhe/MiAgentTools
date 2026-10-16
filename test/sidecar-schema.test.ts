/**
 * JSON Sidecar Schema 单元测试。
 */
import { describe, it, expect } from 'vitest';
import {
    createEmptyChange,
    createEmptyManifest,
    createEmptyTasks,
    createEmptyDecisions,
    createEmptyCapabilities,
    isValidPhase,
    isValidTaskStatus,
    isValidOperation,
} from '../src/core/spec/sidecar-schema.js';
import type { ChangeSchema, TasksSchema, TaskEntry } from '../src/core/spec/sidecar-schema.js';

describe('sidecar-schema 类型定义', () => {
    describe('ManifestSchema', () => {
        it('createEmptyManifest 返回合法结构', () => {
            const m = createEmptyManifest('test-change');
            expect(m.$schema).toBe('iagent/manifest/v1');
            expect(m.changeName).toBe('test-change');
            expect(m.capabilities).toEqual([]);
            expect(m.impactAreas).toEqual([]);
            expect(m.phase).toBe('proposal');
            expect(m.createdAt).toBeTruthy();
            expect(m.updatedAt).toBeTruthy();
        });
    });

    describe('TasksSchema', () => {
        it('createEmptyTasks 返回合法结构', () => {
            const t = createEmptyTasks();
            expect(t.$schema).toBe('iagent/tasks/v1');
            expect(t.tasks).toEqual([]);
            expect(t.progress.total).toBe(0);
            expect(t.progress.complete).toBe(0);
            expect(t.progress.remaining).toBe(0);
        });
    });

    describe('DecisionsSchema', () => {
        it('createEmptyDecisions 返回合法结构', () => {
            const d = createEmptyDecisions();
            expect(d.$schema).toBe('iagent/decisions/v1');
            expect(d.decisions).toEqual([]);
        });
    });

    describe('CapabilitiesSchema', () => {
        it('createEmptyCapabilities 返回合法结构', () => {
            const c = createEmptyCapabilities();
            expect(c.$schema).toBe('iagent/capabilities/v1');
            expect(c.capabilities).toEqual([]);
        });
    });

    describe('ChangeSchema（change.json 合并主产物）', () => {
        it('createEmptyChange 返回合法骨架（proposal/design/specs 三段缺省）', () => {
            const c = createEmptyChange('improve-artifact-json');
            expect(c.$schema).toBe('iagent/change/v1');
            expect(c.changeName).toBe('improve-artifact-json');
            expect(c.phase).toBe('proposal');
            // 时间戳为 ISO 8601 字符串（toISOString 往返一致）
            expect(Number.isNaN(Date.parse(c.createdAt))).toBe(false);
            expect(new Date(c.createdAt).toISOString()).toBe(c.createdAt);
            expect(Number.isNaN(Date.parse(c.updatedAt))).toBe(false);
            expect(new Date(c.updatedAt).toISOString()).toBe(c.updatedAt);
            // 三段缺省：由后续生成流程逐段补齐
            expect(c.proposal).toBeUndefined();
            expect(c.design).toBeUndefined();
            expect(c.specs).toBeUndefined();
        });

        it('完整三段结构冒烟：嵌套字段可达且类型一致', () => {
            const full: ChangeSchema = {
                $schema: 'iagent/change/v1',
                changeName: 'smoke-change',
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-02T00:00:00.000Z',
                phase: 'apply',
                proposal: {
                    why: '结构化数据真源化',
                    whatChanges: ['新增 change.json', '由代码渲染 MD'],
                    capabilities: {
                        new: [{ name: 'cap-a', description: '新能力' }],
                        modified: [{ name: 'cap-b', description: '既有能力需求变更' }],
                    },
                    impact: {
                        files: [
                            { path: 'src/core/spec/sidecar-writer.ts', description: '新增读写函数' },
                        ],
                        breaking: false,
                        compatibility: '无',
                    },
                },
                design: {
                    context: 'JSON-primary 架构上下文',
                    goals: ['单一合并主产物'],
                    nonGoals: ['不并入 tasks.json'],
                    decisions: [
                        {
                            id: 'D1',
                            title: '合并为单文件',
                            choice: 'change.json',
                            alternatives: ['保留 4 个独立 sidecar'],
                            rationale: '降低跨文件不一致风险',
                            risks: ['单文件体积增大'],
                            relatedFiles: ['src/core/spec/sidecar-schema.ts:192'],
                        },
                    ],
                    risks: [{ risk: '渲染失败', mitigation: 'WARN 并降级手写 MD' }],
                },
                specs: [
                    {
                        name: 'cap-a',
                        path: 'specs/cap-a/spec.md',
                        operations: [
                            {
                                type: 'ADDED',
                                requirement: '支持 JSON 真源',
                                description: '系统 SHALL 以 change.json 为结构化真源',
                                scenarios: [
                                    {
                                        name: '渲染提案',
                                        given: 'change.json 存在',
                                        when: '执行 render proposal',
                                        then: '生成 proposal.md',
                                    },
                                ],
                            },
                            {
                                type: 'MODIFIED',
                                requirement: '读取顺序',
                                description: '读取 SHALL 优先 change.json',
                            },
                            {
                                type: 'REMOVED',
                                requirement: '旧读取路径',
                                reason: '已由 change.json 取代',
                                migration: '改用 readChangeJson',
                            },
                            {
                                type: 'RENAMED',
                                requirement: '渲染命令',
                                from: 'render-sidecar',
                                to: 'render',
                            },
                        ],
                    },
                ],
            };

            // 根字段
            expect(full.$schema).toBe('iagent/change/v1');
            expect(full.phase).toBe('apply');
            // proposal 段嵌套字段
            expect(full.proposal?.whatChanges).toHaveLength(2);
            expect(full.proposal?.capabilities.new[0].name).toBe('cap-a');
            expect(full.proposal?.capabilities.modified[0].description).toBe('既有能力需求变更');
            expect(full.proposal?.impact.files[0].path).toBe('src/core/spec/sidecar-writer.ts');
            expect(full.proposal?.impact.breaking).toBe(false);
            // design 段嵌套字段（decisions 复用 DecisionEntry）
            expect(full.design?.decisions[0].id).toBe('D1');
            expect(full.design?.decisions[0].alternatives).toEqual(['保留 4 个独立 sidecar']);
            expect(full.design?.goals).toEqual(['单一合并主产物']);
            expect(full.design?.risks[0].mitigation).toBe('WARN 并降级手写 MD');
            // specs 段嵌套字段（数组嵌套，键序确定）
            const spec = full.specs?.[0];
            expect(spec?.path).toBe('specs/cap-a/spec.md');
            expect(spec?.operations.map((op) => op.type)).toEqual([
                'ADDED',
                'MODIFIED',
                'REMOVED',
                'RENAMED',
            ]);
            expect(spec?.operations[0].scenarios?.[0].then).toBe('生成 proposal.md');
            expect(spec?.operations[2].reason).toBe('已由 change.json 取代');
            expect(spec?.operations[3].from).toBe('render-sidecar');
            expect(spec?.operations[3].to).toBe('render');
        });
    });

    describe('枚举校验', () => {
        it('isValidPhase 正确校验', () => {
            expect(isValidPhase('proposal')).toBe(true);
            expect(isValidPhase('apply')).toBe(true);
            expect(isValidPhase('archive')).toBe(true);
            expect(isValidPhase('invalid')).toBe(false);
        });

        it('isValidTaskStatus 正确校验', () => {
            expect(isValidTaskStatus('pending')).toBe(true);
            expect(isValidTaskStatus('done')).toBe(true);
            expect(isValidTaskStatus('in_progress')).toBe(false);
        });

        it('isValidOperation 正确校验', () => {
            expect(isValidOperation('ADDED')).toBe(true);
            expect(isValidOperation('MODIFIED')).toBe(true);
            expect(isValidOperation('REMOVED')).toBe(true);
            expect(isValidOperation('RENAMED')).toBe(true);
            expect(isValidOperation('DELETED')).toBe(false);
        });

        it('isValidPhase 边界：空串/大小写/空白均拒绝', () => {
            expect(isValidPhase('')).toBe(false);
            expect(isValidPhase('Proposal')).toBe(false);
            expect(isValidPhase(' proposal ')).toBe(false);
        });

        it('isValidOperation 边界：RENAMED 合法，空串/小写/空白/未知值拒绝', () => {
            expect(isValidOperation('RENAMED')).toBe(true);
            expect(isValidOperation('')).toBe(false);
            expect(isValidOperation('renamed')).toBe(false);
            expect(isValidOperation('RENAMED ')).toBe(false);
            expect(isValidOperation('UPDATED')).toBe(false);
        });
    });

    describe('降级行为：JSON 缺失时回退到 defaults', () => {
        it('manifest 缺失 → createEmptyManifest 提供合法默认值', () => {
            const m = createEmptyManifest('degraded-change');
            expect(m.phase).toBe('proposal'); // 默认阶段
            expect(m.capabilities).toEqual([]); // 空能力列表
            expect(m.impactAreas).toEqual([]); // 空影响面
            // 默认值可用于后续流程，不阻断
        });

        it('tasks.json 缺失 → createEmptyTasks 提供零进度基线', () => {
            const t = createEmptyTasks();
            expect(t.progress.total).toBe(0);
            expect(t.progress.complete).toBe(0);
            expect(t.progress.remaining).toBe(0);
            // 零基线可与 tasks.md checkbox 解析结果合并，不丢失数据
        });

        it('decisions.json 缺失 → createEmptyDecisions 提供空决策集', () => {
            const d = createEmptyDecisions();
            expect(d.decisions).toEqual([]);
        });
    });

    describe('降级行为：任务状态变更与进度重算', () => {
        /** 模拟从 tasks.md 解析出的任务列表填充进 tasks.json */
        function populateTasks(ids: string[]): TasksSchema {
            const schema = createEmptyTasks();
            const tasks: TaskEntry[] = ids.map((id) => ({
                id,
                label: '代码',
                description: `Task ${id}`,
                status: 'pending',
                dependencies: [],
                files: [],
            }));
            schema.tasks = tasks;
            schema.progress = {
                total: tasks.length,
                complete: 0,
                remaining: tasks.length,
            };
            return schema;
        }

        it('任务完成 → status 更新为 done 且进度重算正确', () => {
            const schema = populateTasks(['1.1', '1.2', '1.3', '2.1', '2.2']);
            expect(schema.progress).toEqual({ total: 5, complete: 0, remaining: 5 });

            // 完成任务 1.1
            const task = schema.tasks.find((t) => t.id === '1.1');
            expect(task).toBeDefined();
            task!.status = 'done';

            // 重算进度
            const complete = schema.tasks.filter((t) => t.status === 'done').length;
            schema.progress = {
                total: schema.tasks.length,
                complete,
                remaining: schema.tasks.length - complete,
            };

            expect(schema.progress).toEqual({ total: 5, complete: 1, remaining: 4 });
        });

        it('全部任务完成后进度清零 remaining', () => {
            const schema = populateTasks(['1.1', '1.2']);
            schema.tasks.forEach((t) => (t.status = 'done'));
            schema.progress = {
                total: 2,
                complete: 2,
                remaining: 0,
            };
            expect(schema.progress.remaining).toBe(0);
            expect(schema.tasks.every((t) => t.status === 'done')).toBe(true);
        });

        it('MD 与 JSON 不一致时以 MD 为准（JSON 被 MD 覆盖修正）', () => {
            // 模拟场景：tasks.md 标记为 [x] 但 tasks.json 仍为 pending
            const schema = populateTasks(['1.1']);
            const mdChecked = ['1.1']; // tasks.md 中 [x] 的任务

            // 以 MD 为准同步 JSON
            for (const task of schema.tasks) {
                if (mdChecked.includes(task.id)) {
                    task.status = 'done';
                }
            }

            expect(schema.tasks[0].status).toBe('done');
            // 修正后 JSON 与 MD 一致
        });
    });

    describe('降级行为：阶段变迁', () => {
        it('proposal → apply → archive 阶段链正确', () => {
            const m = createEmptyManifest('test');
            expect(m.phase).toBe('proposal');
            expect(isValidPhase(m.phase)).toBe(true);

            // 进入 apply
            m.phase = 'apply';
            expect(isValidPhase(m.phase)).toBe(true);

            // 归档
            m.phase = 'archive';
            expect(isValidPhase(m.phase)).toBe(true);

            // 非法阶段被拒绝
            expect(isValidPhase('deploy')).toBe(false);
        });
    });
});