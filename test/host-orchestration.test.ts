/**
 * 宿主编排协议与能力协商回归锁（变更 add-host-orchestration-adapters）。
 */

import { describe, it, expect } from 'vitest';
import { getSkillTemplates } from '../src/core/templates/index.js';
import {
    CAPABILITY_ORDER,
    DEFAULT_RECEIPT_FIELDS,
    ORCHESTRATION_DELEGATIONS,
    ORCHESTRATING_WORKFLOW_IDS,
    TRANSITION_BLOCKERS,
    getWorkflowProtocol,
    protocolDeclaresCapabilities,
    adaptSkillContentForHost,
    evaluatePhaseTransition,
    isOrchestratingWorkflow,
    negotiateCapabilities,
    phaseCapabilitiesSatisfied,
    renderDelegate,
    renderDelegationList,
    renderHostOrchestrationSection,
    validateReceipt,
} from '../src/core/host-orchestration/index.js';

describe('阶段回执契约', () => {
    const spec = { fields: DEFAULT_RECEIPT_FIELDS };

    it('齐全且 ok 的回执通过', () => {
        const result = validateReceipt(
            { phase: 'explore', status: 'ok', artifact: 'exploration.md', nextAllowed: 'propose' },
            spec
        );
        expect(result.valid).toBe(true);
    });

    it('缺少必需字段时判定为不完整', () => {
        const result = validateReceipt({ phase: 'explore' }, spec);
        expect(result.valid).toBe(false);
        expect(result.missing).toContain('status');
    });

    it('非 ok 状态必须带失败原因', () => {
        const result = validateReceipt(
            { phase: 'apply', status: 'failed', artifact: 'x', nextAllowed: 'retry' },
            spec
        );
        expect(result.valid).toBe(false);
        expect(result.missing).toContain('failure');
    });

    it('未知状态被拒', () => {
        const result = validateReceipt(
            { phase: 'apply', status: 'weird' as never, artifact: 'x', nextAllowed: 'y' },
            spec
        );
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('未知回执状态');
    });
});

describe('宿主能力协商', () => {
    it('Claude 与 OpenCode 具备全部能力（strict）', () => {
        for (const host of ['claude', 'opencode'] as const) {
            const n = negotiateCapabilities(host, 'strict');
            expect(n.missing).toEqual([]);
            expect(n.available.sort()).toEqual([...CAPABILITY_ORDER].sort());
        }
    });

    it('Pi 基础档案缺少委派能力 → strict 阶段被阻断', () => {
        const n = negotiateCapabilities('pi', 'strict', ['skill-load', 'argument-passing']);
        expect(n.missing).toContain('delegate');
        const phase = phaseCapabilitiesSatisfied(n, ['skill-load', 'delegate']);
        expect(phase.runnable).toBe(false);
        expect(phase.missing).toContain('delegate');
    });

    it('Pi strict 档案具备全部能力', () => {
        const n = negotiateCapabilities('pi', 'strict');
        expect(n.missing).toEqual([]);
        expect(phaseCapabilitiesSatisfied(n, ['delegate', 'receipt', 'gate']).runnable).toBe(true);
    });

    it('Pi degraded 明确声明未提供能力与禁止伪装', () => {
        const n = negotiateCapabilities('pi', 'degraded', ['skill-load', 'argument-passing']);
        expect(n.mode).toBe('degraded');
        expect(n.notes.join('\n')).toContain('MUST NOT 被标记为委派完成');
        // 入口不可解析导致的 degraded：委派能力缺失，阶段不得推进
        expect(n.missing).toContain('delegate');
        expect(phaseCapabilitiesSatisfied(n, ['delegate']).runnable).toBe(false);
    });
});

describe('工作流协议实例声明阶段能力', () => {
    it('每个编排工作流都有协议实例且阶段声明了必需能力、输入与回执', () => {
        for (const workflowId of ORCHESTRATING_WORKFLOW_IDS) {
            const protocol = getWorkflowProtocol(workflowId);
            expect(protocol, `缺少协议实例：${workflowId}`).toBeDefined();
            expect(protocol!.phases.length).toBeGreaterThan(0);
            expect(protocolDeclaresCapabilities(protocol!)).toBe(true);
            for (const phase of protocol!.phases) {
                expect(phase.input.required.length, `${workflowId}/${phase.id} 缺输入契约`).toBeGreaterThan(0);
                expect(phase.receipt.fields.length).toBeGreaterThan(0);
                expect(phase.handoff.length).toBeGreaterThan(0);
            }
        }
    });

    it('实现阶段声明重试策略与实现桥门', () => {
        const apply = getWorkflowProtocol('workflow')!.phases.find((p) => p.id === 'apply')!;
        expect(apply.gate?.id).toBe('implementation-bridge');
        expect(apply.retry?.maxAttempts).toBeGreaterThan(1);
        expect(apply.retry?.on).toContain('compile-failed');
    });

    it('生成期产物包含阶段能力声明段', () => {
        const section = renderHostOrchestrationSection(negotiateCapabilities('claude', 'strict'), 'workflow');
        expect(section).toContain('阶段能力声明');
        expect(section).toContain('`apply`：能力');
        expect(section).toContain('门：implementation-bridge');
        expect(section).toContain('重试');
    });
});

describe('共享模板正文的宿主导航中立性', () => {
    it('编排类模板正文不含 Claude 专属委派机制词', () => {
        const banned = ['经 Skill 工具', '通过 Skill 工具', '（经 Skill 工具）', '用 Skill 工具', 'Agent 工具', 'Agent/Task'];
        const offenders: string[] = [];
        for (const { template, commandId } of getSkillTemplates(undefined, [...ORCHESTRATING_WORKFLOW_IDS])) {
            for (const phrase of banned) {
                if (template.instructions.includes(phrase)) {
                    offenders.push(`${commandId}: 「${phrase}」`);
                }
            }
        }
        expect(offenders, `共享正文残留宿主专属委派机制词：${offenders.join('；')}`).toEqual([]);
    });
});

describe('阶段推进判定', () => {
    const phase = {
        id: 'explore',
        requiredCapabilities: ['skill-load', 'delegate'] as const,
        handoff: ['explorationFile'],
        receipt: { fields: DEFAULT_RECEIPT_FIELDS },
        gate: { id: 'prompt-gate' },
    };

    it('能力齐备 + 门已确认 + 回执通过 → 允许推进', () => {
        const result = evaluatePhaseTransition({
            phase,
            receipt: { phase: 'explore', status: 'ok', artifact: 'e.md', nextAllowed: 'propose' },
            gateConfirmed: true,
            negotiation: negotiateCapabilities('claude', 'strict'),
        });
        expect(result.advance).toBe(true);
        expect(result.blockedBy).toEqual([]);
    });

    it('门未确认 → 阻塞且不推进', () => {
        const result = evaluatePhaseTransition({
            phase,
            receipt: { phase: 'explore', status: 'ok', artifact: 'e.md', nextAllowed: 'propose' },
            gateConfirmed: false,
            negotiation: negotiateCapabilities('claude', 'strict'),
        });
        expect(result.advance).toBe(false);
        expect(result.blockedBy).toContain(TRANSITION_BLOCKERS.gate);
    });

    it('回执缺失 → 阻塞（不得因自然语言宣称完成而推进）', () => {
        const result = evaluatePhaseTransition({
            phase,
            gateConfirmed: true,
            negotiation: negotiateCapabilities('claude', 'strict'),
        });
        expect(result.advance).toBe(false);
        expect(result.blockedBy).toContain(TRANSITION_BLOCKERS.receipt);
    });

    it('strict 缺委派能力 → 能力阻塞', () => {
        const result = evaluatePhaseTransition({
            phase,
            receipt: { phase: 'explore', status: 'ok', artifact: 'e.md', nextAllowed: 'propose' },
            gateConfirmed: true,
            negotiation: negotiateCapabilities('pi', 'strict', ['skill-load', 'argument-passing']),
        });
        expect(result.advance).toBe(false);
        expect(result.blockedBy).toContain(TRANSITION_BLOCKERS.capabilities);
        expect(result.missingCapabilities).toContain('delegate');
    });
});

describe('宿主编排段渲染', () => {
    it('strict 段包含原生机制映射与回执契约', () => {
        const section = renderHostOrchestrationSection(negotiateCapabilities('opencode', 'strict'));
        expect(section).toContain('strict 编排');
        expect(section).toContain('subagent + 项目级 agent');
        expect(section).toContain('回执契约');
    });

    it('degraded 段禁止伪装委派完成', () => {
        const section = renderHostOrchestrationSection(
            negotiateCapabilities('pi', 'degraded', ['skill-load', 'argument-passing'])
        );
        expect(section).toContain('degraded 单 agent 模式');
        expect(section).toContain('MUST NOT 把本地串行执行标记为委派完成');
    });

    it('委派动作按宿主渲染原生机制（共享正文不再硬编码 Claude 语义）', () => {
        const claude = renderDelegate('claude', 'strict', { workflowId: 'spec-explore' });
        expect(claude).toContain('Skill 工具委派');
        expect(claude).toContain('iagent-spec-explore');

        const opencode = renderDelegate('opencode', 'strict', { workflowId: 'spec-explore' });
        expect(opencode).toContain('subagent');
        expect(opencode).toContain('项目 agent');
        expect(opencode).not.toContain('Skill 工具');

        const piStrict = renderDelegate('pi', 'strict', { workflowId: 'spec-explore' });
        expect(piStrict).toContain('Agent({');
        expect(piStrict).toContain('subagent_type');
        expect(piStrict).toContain('iagent-spec-explore');

        const piDegraded = renderDelegate('pi', 'degraded', { workflowId: 'spec-explore' });
        expect(piDegraded).toContain('degraded');
        expect(piDegraded).toContain('不构成委派');
    });

    it('编排技能生成内容包含宿主原生的阶段委派清单', () => {
        const claude = adaptSkillContentForHost('# wf', negotiateCapabilities('claude', 'strict'), 'workflow');
        expect(claude).toContain('阶段委派（宿主原生）');
        expect(claude).toContain('Skill 工具委派');

        const opencode = adaptSkillContentForHost('# wf', negotiateCapabilities('opencode', 'strict'), 'workflow');
        expect(opencode).toContain('subagent');
        expect(opencode).not.toContain('Skill 工具委派');

        const pi = adaptSkillContentForHost(
            '# wf',
            negotiateCapabilities('pi', 'degraded', ['skill-load', 'argument-passing']),
            'workflow'
        );
        expect(pi).toContain('不构成委派');
        expect(pi).not.toContain('Skill 工具委派');

        // 委派集合存在
        expect(ORCHESTRATION_DELEGATIONS.workflow).toContain('spec-apply');
        expect(renderDelegationList('claude', 'strict', [])).toBe('');
    });

    it('编排指令描述与委派语义一致（无“内联生成”矛盾）', () => {
        const templates = getSkillTemplates();
        for (const name of ['iagent_workflow', 'iagent_auto_workflow']) {
            const entry = templates.find((item) => item.template.name === name);
            expect(entry).toBeDefined();
            expect(entry!.template.description).not.toContain('内联生成');
        }
    });

    it('仅编排类技能被注入适配段且幂等', () => {
        expect(isOrchestratingWorkflow('workflow')).toBe(true);
        expect(isOrchestratingWorkflow('commit')).toBe(false);

        const base = '# 技能\n\n正文内容\n';
        const n = negotiateCapabilities('claude', 'strict');
        const once = adaptSkillContentForHost(base, n, 'workflow');
        expect(once).toContain('宿主编排适配');
        const twice = adaptSkillContentForHost(once, n, 'workflow');
        expect(twice.match(/宿主编排适配（生成期注入）/g)?.length).toBe(1);

        // 非编排技能不注入
        expect(adaptSkillContentForHost(base, n, 'commit')).toBe(base);
    });
});
