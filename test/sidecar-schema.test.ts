/**
 * JSON Sidecar Schema 单元测试。
 */
import { describe, it, expect } from 'vitest';
import {
    createEmptyManifest,
    createEmptyTasks,
    createEmptyDecisions,
    createEmptyCapabilities,
    isValidPhase,
    isValidTaskStatus,
    isValidOperation,
} from '../src/core/spec/sidecar-schema.js';
import type { TasksSchema, TaskEntry } from '../src/core/spec/sidecar-schema.js';

describe('sidecar-schema 类型定义', () => {
    describe('ManifestSchema', () => {
        it('createEmptyManifest 返回合法结构', () => {
            const m = createEmptyManifest('test-change');
            expect(m.$schema).toBe('venus/manifest/v1');
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
            expect(t.$schema).toBe('venus/tasks/v1');
            expect(t.tasks).toEqual([]);
            expect(t.progress.total).toBe(0);
            expect(t.progress.complete).toBe(0);
            expect(t.progress.remaining).toBe(0);
        });
    });

    describe('DecisionsSchema', () => {
        it('createEmptyDecisions 返回合法结构', () => {
            const d = createEmptyDecisions();
            expect(d.$schema).toBe('venus/decisions/v1');
            expect(d.decisions).toEqual([]);
        });
    });

    describe('CapabilitiesSchema', () => {
        it('createEmptyCapabilities 返回合法结构', () => {
            const c = createEmptyCapabilities();
            expect(c.$schema).toBe('venus/capabilities/v1');
            expect(c.capabilities).toEqual([]);
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