/**
 * 变更 improve-workflow-skills-flow 的验收测试（能力 workflow-implementation-chain）。
 *
 * 任务对应（openspec/changes/improve-workflow-skills-flow/tasks.md，节点 id 见方括号）：
 * - 6.2 [测试][单元][P0]：三父编排技能 allowedTools 含 Skill(iagent-review) 且无 Skill(*) 通配 [N6]
 * - 6.3 [测试][单元][P0]：auto-workflow 归档确认门段（⛔ GATE / 拒绝出口 / 无跳过归档 / 证据含 review 结论） [N7]
 * - 6.4 [测试][单元][P1]：测试降级口径收紧（spec-apply Step 8.11 / auto-workflow §4.3 / debug 无静默 WARN 路径） [N3]
 * - 6.5 [测试][单元][P1]：三模板 review 环节段（iagent_review / review-report.md 落盘 / strict 阻断） [N6]
 * - 6.6 [测试][单元][P2]：无可测文件 not-applicable 放行 —— 既有行为回归核对，无需新增行为测试 [N2A]
 * - 6.7 [测试][单元][P2]：修复预算 ≤3 —— 既有语义回归核对，无需新增行为测试 [N4]
 * - 6.8 / 6.9：并入 6.5 / 6.3 的断言面（评估留痕见 tasks.md，无独立用例）
 */
import { describe, it, expect } from 'vitest';
import { getSkillTemplates } from '../src/core/templates/registry.js';
import { skillDelegation } from '../src/core/templates/tool-whitelist.js';
import { getWorkflowProtocol } from '../src/core/host-orchestration/workflows.js';

function instructionsOf(name: string): string {
    const found = getSkillTemplates().find(({ template }) => template.name === name);
    if (found === undefined) throw new Error(`缺少模板：${name}`);
    return found.template.instructions;
}

function allowedToolsOf(name: string): string {
    const found = getSkillTemplates().find(({ template }) => template.name === name);
    if (found === undefined) throw new Error(`缺少模板：${name}`);
    return found.template.allowedTools;
}

const PARENT_FLOWS = ['iagent_workflow', 'iagent_auto_workflow', 'iagent_debug'] as const;

describe('6.2 review 委派白名单同步 [N6]', () => {
    it('三父编排技能 allowedTools 均含 Skill(iagent-review) 且委派条目为连续序列', () => {
        for (const name of PARENT_FLOWS) {
            const tools = allowedToolsOf(name);
            expect(tools, `${name} 缺 review 委派条目`).toContain('Skill(iagent-review)');
            const names = [...tools.matchAll(/Skill\(([a-zA-Z0-9:-]+)\)/g)].map((m) => m[1]);
            expect(names, `${name} 委派清单应含 iagent-review`).toContain('iagent-review');
            // 条目由 skillDelegation([...]) 共享常量派生（顺序连续，无手工断裂 / 第二真源）
            expect(tools, `${name} 委派清单不连续`).toContain(skillDelegation(names));
        }
    });

    it('三父编排技能不使用 Skill(*) 通配', () => {
        for (const name of PARENT_FLOWS) {
            expect(allowedToolsOf(name), `${name} 出现通配委派`).not.toContain('Skill(*)');
        }
    });

    it('review 条目位于 test 之前（三模板一致的委派顺序）', () => {
        for (const name of PARENT_FLOWS) {
            const order = [...allowedToolsOf(name).matchAll(/Skill\(([a-zA-Z0-9:-]+)\)/g)].map(
                (m) => m[1]
            );
            const reviewIdx = order.indexOf('iagent-review');
            const testIdx = order.indexOf('iagent-test');
            expect(reviewIdx, `${name} 缺 iagent-review`).toBeGreaterThan(-1);
            expect(testIdx, `${name} 缺 iagent-test`).toBeGreaterThan(-1);
            expect(reviewIdx, `${name} review 应在 test 之前`).toBeLessThan(testIdx);
        }
    });
});

describe('6.3 auto-workflow 归档确认门 [N7]', () => {
    const body = instructionsOf('iagent_auto_workflow');

    it('Phase 5 含归档确认门 ⛔ GATE 段且引用门白名单类别 archive-confirmation', () => {
        expect(body).toContain('归档确认门');
        expect(body).toContain('⛔ GATE');
        expect(body).toContain('archive-confirmation');
    });

    it('拒绝出口 = 返回实现阶段（不归档），且 MUST NOT 提供跳过归档选项', () => {
        expect(body).toContain('返回实现阶段');
        expect(body).toContain('MUST NOT 提供「跳过归档」选项');
    });

    it('含糊回复按拒绝处理，中断保持暂停、resume 重现门（6.9 并入断言面）', () => {
        expect(body).toContain('含糊回复');
        expect(body).toContain('按拒绝处理');
        expect(body).toContain('重新呈现本门');
    });

    it('门呈现内容含实现摘要 / 三类证据 / 测试结果 / review 结论', () => {
        expect(body).toContain('实现摘要');
        expect(body).toContain('三类证据');
        expect(body).toContain('测试结果');
        expect(body).toContain('review 结论');
    });

    it('确认出口：用户确认功能完成后执行归档，不再追加停点', () => {
        expect(body).toContain('**确认功能完成** → 进入 §5.3 执行归档');
        expect(body).toContain('不再追加其它停点');
    });

    it('协议层 auto-workflow archive 阶段声明 archive-confirmation 阻塞门', () => {
        const archive = getWorkflowProtocol('auto-workflow')!
            .phases.find((item) => item.id === 'archive')!;
        expect(archive.gate?.id).toBe('archive-confirmation');
        expect(archive.gate?.blocking).toBe(true);
    });

    it('workflow 5.1 归档桥蓝本保持不动（门语义蓝本未被改写）', () => {
        const wf = instructionsOf('iagent_workflow');
        expect(wf).toContain('### 5.1 归档桥（强制检查点）');
        expect(wf).toContain('⛔ GATE: 归档确认门（强制停止）');
        expect(wf).toContain('三类证据就绪');
    });
});

describe('6.4 测试降级口径收紧 [N3]', () => {
    it('spec-apply Step 8.11 无「不可用 → WARN」静默路径，含降级二分', () => {
        const body = instructionsOf('iagent_spec_apply');
        expect(body).not.toMatch(/iagent_test` 不可用 → WARN/);
        expect(body).toContain('降级二分（strict / 显式 degraded）');
        expect(body).toContain('strict 阻断并报告');
        expect(body).toContain('MUST NOT 表述为「已测试」');
        // Scenario: 有行为改动文件时强制调用 iagent-test —— 8.11 为测试门前的强制子阶段
        expect(body).toContain('8.11 自动单测补齐');
        expect(body.indexOf('8.11 自动单测补齐')).toBeLessThan(body.indexOf('9. **测试执行门**'));
        // Scenario: 项目配置关闭自动补测时显式 degraded
        expect(body).toContain('自动补测已由项目配置关闭');
    });

    it('auto-workflow §4.3 自动单测补齐含降级二分且无静默 WARN 路径', () => {
        const body = instructionsOf('iagent_auto_workflow');
        expect(body).not.toMatch(/iagent_test` 不可用 → WARN \+ 记录/);
        expect(body).toContain('降级二分（strict / 显式 degraded）');
        expect(body).toContain('strict 阻断并报告');
        expect(body).toContain('MUST NOT 表述为「已测试」');
        // Scenario: 有行为改动文件时强制调用 iagent-test —— 显式强制子阶段（非条件分支）
        expect(body).toContain('自动单测补齐子阶段（强制）');
        // Scenario: 项目配置关闭自动补测时显式 degraded
        expect(body).toContain('自动补测已由项目配置关闭');
    });

    it('debug 修复后测试调用为 strict 阻断 + 显式 degraded（4.1 核对口径）', () => {
        const body = instructionsOf('iagent_debug');
        expect(body).toContain('阻断并报告');
        expect(body).toContain('显式协商 degraded');
        expect(body).toContain('未发生内联技能调用');
    });
});

describe('6.5 实现后 review 环节 [N6]', () => {
    it('三模板均含 iagent_review 内联调用与 review-report.md 落盘', () => {
        for (const name of PARENT_FLOWS) {
            const body = instructionsOf(name);
            expect(body, `${name} 缺 iagent_review 调用`).toContain('iagent_review');
            expect(body, `${name} 缺 review-report.md 落盘`).toContain('review-report.md');
            expect(body, `${name} 缺 summary 汇总行口径`).toContain(
                '**summary**: pass|not-applicable|fail'
            );
            // Scenario: P0 或 P1 未收束时不进入归档门 —— 未收束阻断后续归档推进
            expect(body, `${name} 缺未收束阻断表述`).toContain('P0/P1 未修复');
        }
    });

    it('三模板 review 不可用为 strict 阻断（非静默 WARN）', () => {
        for (const name of PARENT_FLOWS) {
            expect(instructionsOf(name), `${name} review 降级口径缺失`).toContain(
                'strict 阻断并报告'
            );
        }
    });

    it('P2 记录不阻断、无代码改动 not-applicable 直通（6.8 并入断言面）', () => {
        for (const name of PARENT_FLOWS) {
            const body = instructionsOf(name);
            expect(body, `${name} 缺 P2 分级表述`).toContain('P2 问题');
            expect(body, `${name} 缺 not-applicable 直通表述`).toContain('not-applicable');
        }
    });

    it('debug 收束语义保持：不自动归档、未收束不输出「已可归档」', () => {
        const body = instructionsOf('iagent_debug');
        expect(body).toContain('debug 不自动归档');
        expect(body).toContain('MUST NOT 输出「已可归档」收束提示');
        // debug 不承载归档确认门（区别于 auto-workflow §5.2 的门段标题）
        expect(body).not.toContain('归档确认门（⛔ GATE');
    });
});

describe('6.6-6.7 既有语义回归核对 [N2A][N4]', () => {
    it('无可测文件 not-applicable 放行表述保留（既有行为，本变更未改动）', () => {
        expect(instructionsOf('iagent_spec_apply')).toContain('not-applicable');
        expect(instructionsOf('iagent_auto_workflow')).toContain('不测清单留痕');
    });

    it('修复预算 ≤3 既有语义保留（spec-apply / auto-workflow / debug）', () => {
        expect(instructionsOf('iagent_spec_apply')).toContain('最多 `maxRetries` 次（默认 3）');
        expect(instructionsOf('iagent_auto_workflow')).toContain('至多 3 次');
        expect(instructionsOf('iagent_debug')).toContain('≤3 次');
    });
});
