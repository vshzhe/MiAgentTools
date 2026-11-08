/**
 * 宿主编排协议与能力协商回归锁（变更 add-host-orchestration-adapters）。
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getSkillTemplates } from '../src/core/templates/index.js';
import {
    CAPABILITY_ORDER,
    CONDITIONAL_DELEGATIONS,
    DEFAULT_RECEIPT_FIELDS,
    DELEGATION_PARAMETERS,
    GATE_CONDITION_IDS,
    GATE_WHITELIST,
    GATE_WHITELIST_ANCHORS,
    HOST_PROFILES,
    ORCHESTRATION_DELEGATIONS,
    ORCHESTRATING_WORKFLOW_IDS,
    PHASE_GATE_CATEGORY,
    SURFACE_IDS,
    TRANSITION_BLOCKERS,
    WORKFLOW_PROTOCOLS,
    adaptSkillContentForHost,
    auditGateWhitelistAlignment,
    deriveOrchestrationDelegations,
    evaluatePhaseTransition,
    getWorkflowProtocol,
    isOrchestratingWorkflow,
    negotiateCapabilities,
    negotiationForHost,
    parseDelegationTargets,
    phaseCapabilitiesSatisfied,
    protocolDeclaresCapabilities,
    renderDelegate,
    renderDelegationList,
    renderHostOrchestrationSection,
    renderLoadSkill,
    validateReceipt,
} from '../src/core/host-orchestration/index.js';
import * as orchestrationModule from '../src/core/host-orchestration/index.js';

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
    it('每个声明协议的编排工作流都有协议实例且阶段声明了必需能力、输入与回执', () => {
        const withProtocol = ORCHESTRATING_WORKFLOW_IDS.filter(
            (workflowId) => getWorkflowProtocol(workflowId) !== undefined
        );
        // 派生注入面覆盖 7 个委派技能（归档类已退出），其中 4 个是编排工作流（其余是阶段技能）
        expect(withProtocol.sort()).toEqual(['auto-workflow', 'debug', 'migration', 'workflow']);
        for (const workflowId of withProtocol) {
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

    it('委派动作按宿主渲染原生机制（Claude 交互阶段 Skill、自动阶段前台 Agent）', () => {
        const claude = renderDelegate('claude', 'strict', { workflowId: 'spec-explore' });
        // 交互阶段：经 Skill 内联加载，保留确认门
        expect(claude).toContain('经 Skill 工具加载');
        expect(claude).toContain('交互阶段');
        expect(claude).toContain('iagent-spec-explore');
        expect(claude).not.toContain('前台 Agent');

        // 自动阶段：前台 Agent 子代理 + 技能路径回退 + 回执 / EXIT GUARD
        const automated = renderDelegate('claude', 'strict', { workflowId: 'spec-apply' });
        expect(automated).toContain('经前台 Agent 子代理执行');
        expect(automated).toContain('iagent-spec-apply');
        expect(automated).toContain('.claude/skills/iagent-spec-apply/SKILL.md');
        expect(automated).toContain('结构化回执');
        expect(automated).toContain('EXIT GUARD');

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
        // workflow 的委派清单同时含交互阶段（spec-explore → Skill）与自动阶段（Agent）
        expect(claude).toContain('经 Skill 工具加载 `iagent-spec-explore`');
        expect(claude).toContain('经前台 Agent 子代理执行 `iagent-spec-apply`');

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

describe('debug 三阶段协议与条件修复门（4.4）', () => {
    const debug = getWorkflowProtocol('debug')!;

    it('阶段顺序为 investigate → fix → verify-close（单一 debug 技能）', () => {
        expect(debug.phases.map((phase) => phase.id)).toEqual([
            'investigate',
            'fix',
            'verify-close',
        ]);
    });

    it('fix 门绑定 multiple-fix-options 条件并保持阻塞语义', () => {
        const fix = debug.phases.find((phase) => phase.id === 'fix')!;
        expect(fix.gate?.id).toBe('fix-option-confirmation');
        expect(fix.gate?.condition).toBe('multiple-fix-options');
        expect(fix.gate?.blocking).toBe(true);
        expect(GATE_CONDITION_IDS).toContain('multiple-fix-options');
    });

    it('investigate 交付 fix 所需输入（含 fixDecision，既有四项顺序不变）', () => {
        const investigate = debug.phases.find((phase) => phase.id === 'investigate')!;
        // 合并包把方案决策前移到 investigate：handoff 追加 fixDecision，前四项顺序不变
        expect(investigate.handoff).toEqual([
            'rootCause',
            'defectChain',
            'changeName',
            'affectedSymbols',
            'fixDecision',
        ]);
        for (const field of ['rootCause', 'defectChain', 'changeName', 'affectedSymbols']) {
            expect(investigate.handoff).toContain(field);
        }
        const fix = debug.phases.find((phase) => phase.id === 'fix')!;
        for (const field of ['rootCause', 'defectChain', 'changeName', 'fixDecision']) {
            expect(fix.input.required).toContain(field);
        }
    });

    it('合并包已交付 fixDecision 时 fix 方案门不适用（不制造第二次停点）', () => {
        const fix = debug.phases.find((phase) => phase.id === 'fix')!;
        const result = evaluatePhaseTransition({
            phase: fix,
            receipt: {
                phase: 'fix',
                status: 'ok',
                artifact: 'fix.md',
                nextAllowed: 'verify-close',
                executionMode: 'subagent',
            } as never,
            gateConfirmed: false,
            gateConditions: { 'multiple-fix-options': false },
            negotiation: negotiateCapabilities('claude', 'strict'),
        });
        expect(result.advance).toBe(true);
    });

    it('回退路径下多方案仍阻塞 fix（条件门置真）', () => {
        const fix = debug.phases.find((phase) => phase.id === 'fix')!;
        const result = evaluatePhaseTransition({
            phase: fix,
            receipt: {
                phase: 'fix',
                status: 'ok',
                artifact: 'fix.md',
                nextAllowed: 'verify-close',
                executionMode: 'subagent',
            } as never,
            gateConfirmed: false,
            gateConditions: { 'multiple-fix-options': true },
            negotiation: negotiateCapabilities('claude', 'strict'),
        });
        expect(result.advance).toBe(false);
        expect(result.blockedBy).toContain(TRANSITION_BLOCKERS.gate);
    });

    it('verify-close 消费 fix 结果并交付可归档结论（无需求文档状态）', () => {
        const fix = debug.phases.find((phase) => phase.id === 'fix')!;
        expect(fix.handoff).toContain('fixApplied');
        expect(fix.handoff).toContain('regressionTests');
        const close = debug.phases.find((phase) => phase.id === 'verify-close')!;
        expect(close.input.required).toContain('fixApplied');
        expect(close.handoff).toEqual(['verificationResult', 'deepReview', 'archiveReady']);
        expect(close.handoff).not.toContain('requirementDocStatus');
        expect(close.receipt.fields).not.toContain('requirementDocStatus');
        // verify-close 无阻塞门
        expect(close.gate).toBeUndefined();
    });

    it('verify-close 有效回执即可推进，无文档状态要求', () => {
        const close = debug.phases.find((phase) => phase.id === 'verify-close')!;
        const result = evaluatePhaseTransition({
            phase: close,
            receipt: {
                phase: 'verify-close',
                status: 'ok',
                artifact: 'exploration.md',
                nextAllowed: 'archive',
            } as never,
            gateConfirmed: true,
            negotiation: negotiateCapabilities('claude', 'strict'),
        });
        expect(result.advance).toBe(true);
        expect(result.blockedBy).toEqual([]);
    });

    it('缺失 investigate handoff 时 fix 不启动（输入契约可判定）', () => {
        const fix = debug.phases.find((phase) => phase.id === 'fix')!;
        const supplied = ['rootCause', 'defectChain', 'changeName'];
        const missing = fix.input.required.filter((field) => !supplied.includes(field));
        expect(missing).toEqual(['fixDecision']);
    });
});

describe('条件门适用性矩阵与旧门默认行为（4.4）', () => {
    const receipt = { phase: 'fix', status: 'ok', artifact: 'fix.md', nextAllowed: 'verify-close' } as const;

    function transition(
        phase: Parameters<typeof evaluatePhaseTransition>[0]['phase'],
        gateConfirmed: boolean,
        gateConditions?: Record<string, boolean>,
        negotiation = negotiateCapabilities('claude', 'strict')
    ) {
        return evaluatePhaseTransition({ phase, receipt, gateConfirmed, negotiation, gateConditions });
    }

    const conditionalPhase = {
        id: 'fix',
        requiredCapabilities: ['delegate'] as const,
        handoff: ['fixApplied'],
        receipt: { fields: DEFAULT_RECEIPT_FIELDS },
        gate: { id: 'fix-option-confirmation', blocking: true, condition: 'multiple-fix-options' as const },
    };

    it('未声明 condition 的旧门保持静态行为（gateConfirmed=false 阻塞）', () => {
        const legacy = {
            id: 'legacy',
            requiredCapabilities: ['delegate'] as const,
            handoff: ['x'],
            receipt: { fields: DEFAULT_RECEIPT_FIELDS },
            gate: { id: 'legacy-gate' },
        };
        const result = transition(legacy, false);
        expect(result.advance).toBe(false);
        expect(result.blockedBy).toContain(TRANSITION_BLOCKERS.gate);
    });

    it('旧门 blocking:false 保持旧行为（不阻塞）', () => {
        const nonBlocking = {
            id: 'legacy-soft',
            requiredCapabilities: ['delegate'] as const,
            handoff: ['x'],
            receipt: { fields: DEFAULT_RECEIPT_FIELDS },
            gate: { id: 'soft-gate', blocking: false },
        };
        const result = transition(nonBlocking, false);
        expect(result.advance).toBe(true);
        expect(result.blockedBy).toEqual([]);
    });

    it("condition=false → 门不适用（gateConfirmed=false 也不阻塞）", () => {
        const result = transition(conditionalPhase, false, { 'multiple-fix-options': false });
        expect(result.advance).toBe(true);
        expect(result.blockedBy).not.toContain(TRANSITION_BLOCKERS.gate);
    });

    it("condition=true → 门适用（gateConfirmed=false 阻塞）", () => {
        const result = transition(conditionalPhase, false, { 'multiple-fix-options': true });
        expect(result.advance).toBe(false);
        expect(result.blockedBy).toContain(TRANSITION_BLOCKERS.gate);
    });

    it('条件键未提供 → fail-safe 视为适用（gateConfirmed=false 阻塞）', () => {
        const result = transition(conditionalPhase, false);
        expect(result.advance).toBe(false);
        expect(result.blockedBy).toContain(TRANSITION_BLOCKERS.gate);
    });

    it('条件键未提供但门已确认 → 允许推进', () => {
        const result = transition(conditionalPhase, true);
        expect(result.advance).toBe(true);
    });

    it('条件不适用不放宽能力检查（strict 缺 delegate 仍阻塞）', () => {
        const result = transition(
            conditionalPhase,
            true,
            { 'multiple-fix-options': false },
            negotiateCapabilities('pi', 'strict', ['skill-load', 'argument-passing'])
        );
        expect(result.advance).toBe(false);
        expect(result.blockedBy).toContain(TRANSITION_BLOCKERS.capabilities);
    });
});

describe('需求文档状态契约已移除 + 回执可选字段（4.4 / P1）', () => {
    it('RequirementDocStatus 与相关 helper 不再导出', () => {
        const exported = orchestrationModule as unknown as Record<string, unknown>;
        for (const name of [
            'RequirementDocStatus',
            'REQUIREMENT_DOC_STATUS_FIELD',
            'PERSISTED_REQUIREMENT_DOC_STATUSES',
            'REQUIREMENT_DOC_STATUS_IO_ATTEMPTS',
            'normalizeRequirementDocStatus',
            'STATUS_RECEIPT',
            'VERIFY_WITH_BRIDGE',
            'DOC_BRIDGE_GATE',
        ]) {
            expect(exported[name], `${name} 仍被导出`).toBeUndefined();
        }
    });

    it('workflow / auto-workflow / debug 的 handoff 与 receipt 均不含 requirementDocStatus', () => {
        for (const workflowId of ['workflow', 'auto-workflow', 'debug']) {
            const protocol = getWorkflowProtocol(workflowId)!;
            for (const phase of protocol.phases) {
                expect(phase.handoff, `${workflowId}/${phase.id} handoff 残留文档状态`).not.toContain(
                    'requirementDocStatus'
                );
                expect(phase.receipt.fields, `${workflowId}/${phase.id} receipt 仍要求文档状态`).not.toContain(
                    'requirementDocStatus'
                );
            }
        }
    });

    it('verify 回执无需文档状态即可推进（不再以 invalid-receipt 阻断）', () => {
        for (const workflowId of ['workflow', 'auto-workflow']) {
            const verify = getWorkflowProtocol(workflowId)!.phases.find((phase) => phase.id === 'verify')!;
            expect(verify.handoff).not.toContain('requirementDocStatus');
            const result = evaluatePhaseTransition({
                phase: verify,
                receipt: {
                    phase: 'verify',
                    status: 'ok',
                    artifact: 'verify-report.md',
                    nextAllowed: 'apply',
                },
                gateConfirmed: true,
                negotiation: negotiateCapabilities('claude', 'strict'),
            });
            expect(result.advance, `${workflowId} verify 有效回执被阻塞`).toBe(true);
            expect(result.blockedBy).toEqual([]);
        }
    });

    it('回执可选字段仅在出现时校验：blockedGate / blockedReason 互斥', () => {
        const base = {
            phase: 'apply',
            status: 'ok' as const,
            artifact: 'tasks.md',
            nextAllowed: 'verify',
        };
        expect(validateReceipt(base, { fields: DEFAULT_RECEIPT_FIELDS }).valid).toBe(true);
        // 五个可选字段出现且为合法非空字符串时通过
        for (const extra of [
            { blockedGate: 'implementation-bridge' },
            { blockedReason: '范围蔓延，需要用户决策' },
            { resumeHint: 'resume=true' },
            { reportPath: 'attachments/report.md', reviewSummary: '通过' },
        ]) {
            expect(
                validateReceipt({ ...base, ...extra }, { fields: DEFAULT_RECEIPT_FIELDS }).valid,
                `合法可选字段被拒：${JSON.stringify(extra)}`
            ).toBe(true);
        }
        // blockedGate 与 blockedReason 不得同时出现
        const both = validateReceipt(
            { ...base, blockedGate: 'implementation-bridge', blockedReason: 'x' } as never,
            { fields: DEFAULT_RECEIPT_FIELDS }
        );
        expect(both.valid).toBe(false);
        expect(both.reason).toContain('二选一');
        // 出现时不得为空串
        const empty = validateReceipt(
            { ...base, resumeHint: '   ' } as never,
            { fields: DEFAULT_RECEIPT_FIELDS }
        );
        expect(empty.valid).toBe(false);
        // 可选字段不得进入默认必需字段
        for (const field of ['blockedGate', 'blockedReason', 'resumeHint', 'reportPath', 'reviewSummary']) {
            expect(DEFAULT_RECEIPT_FIELDS).not.toContain(field);
        }
    });
});

describe('已授权技能直接推进与宿主委派同步（4.4）', () => {
    it('strict 编排段声明唯一 nextAllowed 直接委派，权限/能力检查仍独立生效', () => {
        const section = renderHostOrchestrationSection(negotiateCapabilities('claude', 'strict'), 'workflow');
        expect(section).toContain('唯一 `nextAllowed` 技能 SHALL 直接委派');
        expect(section).toContain('不追加"是否调用该技能"的业务确认');
        expect(section).toContain('宿主工具权限');
        expect(section).toContain('strict/degraded 能力协商');
    });

    it('debug 委派清单覆盖验证/复查/测试，且阶段声明含条件门标注', () => {
        expect(ORCHESTRATION_DELEGATIONS.debug).toEqual([
            'spec-verify-proposal',
            'proposal-review',
            'test',
        ]);
        // 需求文档桥已移除：不再出现在委派清单
        expect(ORCHESTRATION_DELEGATIONS.debug).not.toContain('requirement-doc');
        const section = renderHostOrchestrationSection(negotiateCapabilities('claude', 'strict'), 'debug');
        expect(section).toContain('`fix`：能力');
        expect(section).toContain('门：fix-option-confirmation（条件 multiple-fix-options）');
        expect(section).toContain('`verify-close`：能力');
    });

    it('degraded 段仍禁止把本地执行伪装为委派完成', () => {
        const section = renderHostOrchestrationSection(
            negotiateCapabilities('pi', 'degraded', ['skill-load', 'argument-passing']),
            'debug'
        );
        expect(section).toContain('MUST NOT 把本地串行执行标记为委派完成');
        expect(section).toContain('恢复 strict');
    });

    it('workflow / auto-workflow 委派清单覆盖模板真实调用（无 requirement-doc）', () => {
        for (const workflowId of ['workflow', 'auto-workflow']) {
            const delegations = ORCHESTRATION_DELEGATIONS[workflowId];
            for (const target of [
                'spec-explore',
                'spec-propose',
                'spec-verify-proposal',
                'proposal-review',
                'spec-apply',
                'spec-verify',
                'test',
                'spec-archive',
            ]) {
                expect(delegations, `${workflowId} 委派清单缺少 ${target}`).toContain(target);
            }
            expect(delegations, `${workflowId} 委派清单残留 requirement-doc`).not.toContain(
                'requirement-doc'
            );
            // 委派清单与白名单同一真源（模板 allowedTools 的 canonical Skill(...) 条目）
            const { template } = getSkillTemplates(undefined, [workflowId])[0];
            const allowedTargets = [...template.allowedTools.matchAll(/Skill\(([a-z0-9-]+)\)/g)]
                .map((match) => match[1].replace(/^iagent-/, ''))
                .sort();
            expect([...delegations].sort(), `${workflowId} 委派清单与白名单不一致`).toEqual(
                allowedTargets
            );
        }
    });

    it('条件委派集合 ⊆ 委派清单（条件委派不得是死条目）', () => {
        for (const workflowId of ORCHESTRATING_WORKFLOW_IDS) {
            const declared = ORCHESTRATION_DELEGATIONS[workflowId] ?? [];
            const conditional = CONDITIONAL_DELEGATIONS[workflowId] ?? [];
            const dead = conditional.filter((target) => !declared.includes(target));
            expect(dead, `${workflowId} 的条件委派不在委派清单中：${dead.join(', ')}`).toEqual([]);
        }
    });
});

// 任务 4.7：门白名单与协议门清单对齐（DEC-5）。
describe('4.7 确认门白名单与协议门清单对齐', () => {
    it('白名单为 5 类且破坏性改动确认不可豁免、无阶段门锚点', () => {
        expect(GATE_WHITELIST.length).toBe(5);
        const destructive = GATE_WHITELIST.find((entry) => entry.id === 'destructive-change');
        expect(destructive).toBeDefined();
        expect(destructive?.conditional).toBe(false);
        expect(destructive?.anchors).toEqual([]);
    });

    it('协议门全部落在白名单锚点集合内（含一对多映射）', () => {
        expect(auditGateWhitelistAlignment()).toEqual([]);
        const gateIds = Object.values(WORKFLOW_PROTOCOLS)
            .flatMap((protocol) => protocol.phases)
            .flatMap((phase) => (phase.gate === undefined ? [] : [phase.gate.id]));
        expect(gateIds.length).toBeGreaterThan(0);
        for (const gateId of gateIds) {
            expect(GATE_WHITELIST_ANCHORS, `门 ${gateId} 不在白名单锚点内`).toContain(gateId);
        }
        // 诊断确认 / 修复方案选择挂在「需求澄清」类别下（一对多，不得因名称不同判为白名单外）
        expect(PHASE_GATE_CATEGORY['diagnostic-confirmation']).toBe('requirement-clarification');
        expect(PHASE_GATE_CATEGORY['fix-option-confirmation']).toBe('requirement-clarification');
        const clarification = GATE_WHITELIST.find((entry) => entry.id === 'requirement-clarification');
        expect(clarification?.anchors).toContain('diagnostic-confirmation');
        expect(clarification?.anchors).toContain('fix-option-confirmation');
        // 五类锚点覆盖全部现有阶段门
        expect(new Set(gateIds).size).toBeLessThanOrEqual(GATE_WHITELIST_ANCHORS.length);
    });

    it('对齐不新增阶段门：每阶段仍至多一个阻塞门', () => {
        for (const [workflowId, protocol] of Object.entries(WORKFLOW_PROTOCOLS)) {
            for (const phase of protocol.phases) {
                const gates = phase.gate === undefined ? [] : [phase.gate.id];
                expect(gates.length, `${workflowId}/${phase.id} 超过单门预算`).toBeLessThanOrEqual(1);
            }
        }
    });

    it('条件门语义不变（条件声明与既有 gateConditions 三态用例均为原样）', () => {
        // 对齐只增加白名单映射，不改 GateSpec 与 evaluatePhaseTransition：
        // 条件门仍以 `multiple-fix-options` 声明，既有 false / true / 缺失 三态用例未改动。
        const fixPhase = getWorkflowProtocol('debug')?.phases.find((phase) => phase.id === 'fix');
        expect(fixPhase?.gate).toEqual({
            id: 'fix-option-confirmation',
            blocking: true,
            condition: 'multiple-fix-options',
        });
        expect(GATE_CONDITION_IDS).toContain('multiple-fix-options');
    });
});

// 变更 fix-mode-delegation-host-parity / 任务 3.6：派生注入、codex、委派参数、surface 协商。
describe('3.6 编排注入面派生与四宿主产物', () => {
    const skills = getSkillTemplates();

    it('派生结果覆盖既有 7 个委派技能，且与模板 Skill(...) 一一对应（归档类已退出）', () => {
        const derived = deriveOrchestrationDelegations(
            skills.map(({ template, commandId }) => ({
                commandId,
                allowedTools: template.allowedTools,
            }))
        );
        expect(derived.workflowIds.sort()).toEqual([
            'auto-workflow',
            'debug',
            'migration',
            'project-init',
            'spec-apply',
            'spec-propose',
            'workflow',
        ]);
        for (const { template, commandId } of skills) {
            const targets = parseDelegationTargets(template.allowedTools);
            if (targets.length === 0) {
                continue;
            }
            expect(derived.delegations[commandId], `${commandId} 派生目标不一致`).toEqual(targets);
        }
        // project-init 派生后成为编排技能（委派 feature-doc）
        expect(derived.delegations['project-init']).toEqual(['feature-doc']);
    });

    it('有委派即注入、无委派不注入（归档类已退出编排面）', () => {
        const negotiation = negotiateCapabilities('claude', 'strict');
        const injected = adaptSkillContentForHost('# body', negotiation, 'spec-apply');
        expect(injected).toContain('宿主编排适配（生成期注入）');
        expect(injected).toContain('阶段委派（宿主原生）');
        expect(injected).toContain('iagent-test');

        const notInjected = adaptSkillContentForHost('# body', negotiation, 'commit');
        expect(notInjected).not.toContain('宿主编排适配');
        expect(isOrchestratingWorkflow('project-init')).toBe(true);
        expect(isOrchestratingWorkflow('commit')).toBe(false);
        // 归档技能不再含 Skill(...) 条目 ⇒ 不再被派生为编排技能
        expect(isOrchestratingWorkflow('spec-archive')).toBe(false);
        expect(isOrchestratingWorkflow('spec-bulk-archive')).toBe(false);
        const archiveBody = adaptSkillContentForHost('# body', negotiation, 'spec-archive');
        expect(archiveBody).not.toContain('宿主编排适配');
        expect(archiveBody).not.toContain('allowed_subagents');
    });

    it('归档类无 Skill 委派面，spec-bulk-archive 仍保留派发授权', () => {
        const archive = skills.find(({ template }) => template.name === 'iagent_spec_archive')!.template;
        const bulk = skills.find(({ template }) => template.name === 'iagent_spec_bulk_archive')!.template;
        for (const template of [archive, bulk]) {
            expect(template.allowedTools).not.toContain('Skill(');
            // 无 Skill(...) 条目 ⇒ 不生成 allowed_subagents（归档类退出编排派生面）
            expect(isOrchestratingWorkflow(template.name.replace(/^iagent_/, '').replaceAll('_', '-'))).toBe(false);
        }
        // Agent / Task 属子代理派发授权，与 Skill 委派是两套语义（批量并行仍需要）
        expect(bulk.allowedTools).toContain('Agent');
        expect(bulk.allowedTools).toContain('Task');
    });

    // 变更 fix-multi-agent-skill-command-generation / 任务 4.1 / 4.3：
    // init/update 透传「基于生效集派生」的 orchestration —— 被裁剪的 workflow 不回退到全量默认表。
    it('透传生效集 orchestration：被裁剪的 workflow 不再注入编排段', () => {
        const negotiation = negotiateCapabilities('claude', 'strict');
        const cropped = deriveOrchestrationDelegations([
            { commandId: 'debug', allowedTools: 'Read, Skill(iagent-test)' },
        ]);

        const without = adaptSkillContentForHost('# body', negotiation, 'workflow', cropped);
        expect(without).not.toContain('宿主编排适配');

        const injected = adaptSkillContentForHost('# body', negotiation, 'debug', cropped);
        expect(injected).toContain('宿主编排适配（生成期注入）');
        expect(injected).toContain('iagent-test');
        // 裁剪后的委派清单只含生效集声明的目标
        expect(injected).not.toContain('iagent-proposal-review');
    });

    it('委派清单携带参数且取值来自显式参数表（未声明不填充）', () => {
        const list = renderDelegationList(
            'claude',
            'strict',
            ['spec-explore', 'spec-propose', 'spec-apply', 'spec-verify'],
            DELEGATION_PARAMETERS.workflow
        );
        expect(list).toContain('iagent-spec-explore`（mode=delegated）');
        expect(list).toContain('iagent-spec-propose`（mode=delegated）');
        expect(list).toContain('iagent-spec-apply`（gate-skip=design-confirmation）');
        // 参数表未声明的目标不凭空填充（spec-verify 属自动阶段 → 前台 Agent）
        expect(list).toContain('- 经前台 Agent 子代理执行 `iagent-spec-verify`');
        expect(list).not.toContain('iagent-spec-verify`（mode=');
        expect(list).not.toContain('iagent-spec-verify`（gate-skip=');

        const noParams = renderDelegationList('claude', 'strict', ['spec-apply']);
        expect(noParams).not.toContain('mode=');
        expect(noParams).not.toContain('gate-skip=');
    });

    it('codex 协商返回 degraded 且不返回 null', () => {
        const codex = negotiationForHost('codex');
        expect(codex).not.toBeNull();
        expect(codex!.mode).toBe('degraded');
        expect(codex!.missing).toContain('delegate');
        expect(codex!.missing).toContain('gate');
        expect(codex!.native.delegation).toContain('无');
    });

    it('codex 产物显式声明本地执行、不构成委派', () => {
        const section = adaptSkillContentForHost('# wf', negotiationForHost('codex')!, 'workflow');
        expect(section).toContain('不构成委派');
        expect(section).toContain('skills-only');
        expect(section).not.toContain('经 Skill 工具委派');

        const delegate = renderDelegate('codex', 'degraded', { workflowId: 'spec-apply' });
        expect(delegate).toContain('不构成委派');
        expect(delegate).not.toContain('经 Skill 工具委派');
        expect(delegate).not.toContain('subagent_type');
    });

    it('surface 维度区分 gate 可用性，其余能力不受影响', () => {
        for (const host of ['claude', 'opencode', 'pi'] as const) {
            const ui = negotiateCapabilities(host, host === 'pi' ? 'degraded' : 'strict', {
                surface: 'interactive-ui',
            });
            const cli = negotiateCapabilities(host, host === 'pi' ? 'degraded' : 'strict', {
                surface: 'interactive-cli',
            });
            const headless = negotiateCapabilities(host, host === 'pi' ? 'degraded' : 'strict', {
                surface: 'headless',
            });
            expect(cli.available).toEqual(ui.available);
            expect(headless.available).not.toContain('gate');
            expect(headless.missing).toContain('gate');
            expect(headless.notes.join('\n')).toContain('headless');
            // 其余能力（此处以 skill-load 为代表）不受 surface 影响
            expect(headless.available.includes('skill-load')).toBe(
                ui.available.includes('skill-load')
            );
        }
        expect(SURFACE_IDS).toEqual(['interactive-ui', 'interactive-cli', 'headless']);
    });

    it('OpenCode V2 委派措辞使用 subagent，不使用 Claude 专属机制', () => {
        const delegate = renderDelegate('opencode', 'strict', { workflowId: 'spec-apply' });
        expect(delegate).toContain('subagent');
        expect(delegate).toContain('iagent-spec-apply');
        expect(delegate).not.toContain('经 Skill 工具');
    });
});

// 变更 fix-mode-delegation-host-parity / 任务 3.7：协议门对齐 + 交互表面回归。
describe('3.7 协议门与白名单对齐 + surface 门兜底', () => {
    const receipt = (phase: string) => ({
        phase,
        status: 'ok',
        artifact: 'artifact.md',
        nextAllowed: 'next',
    });

    it('auto-workflow 的 VERIFY / APPLY / ARCHIVE 均无阻塞门', () => {
        const auto = getWorkflowProtocol('auto-workflow')!;
        for (const phaseId of ['verify', 'apply', 'archive']) {
            const phase = auto.phases.find((item) => item.id === phaseId)!;
            expect(phase.gate, `auto-workflow/${phaseId} 不应声明阻塞门`).toBeUndefined();
        }
        // 无门阶段不依赖 gate 能力
        for (const phaseId of ['verify', 'apply', 'archive']) {
            const phase = auto.phases.find((item) => item.id === phaseId)!;
            expect(phase.requiredCapabilities).not.toContain('gate');
        }
    });

    it('workflow verify 无阻塞门，debug verify-close 同样无门', () => {
        // 交付桥合并（U8）：workflow 的验证阶段阻塞门为 0，实现确认由 apply 的交付桥承载
        const verify = getWorkflowProtocol('workflow')!.phases.find(
            (phase) => phase.id === 'verify'
        )!;
        expect(verify.gate).toBeUndefined();
        const apply = getWorkflowProtocol('workflow')!.phases.find((phase) => phase.id === 'apply')!;
        expect(apply.gate?.id).toBe('implementation-bridge');
        expect(apply.gate?.blocking).toBe(true);
        // 需求文档桥已移除：debug verify-close 阻塞门数量为 0
        const close = getWorkflowProtocol('debug')!.phases.find((phase) => phase.id === 'verify-close')!;
        expect(close.gate).toBeUndefined();
        expect(close.requiredCapabilities).not.toContain('gate');
        expect([close.gate].filter(Boolean)).toHaveLength(0);
    });

    it('协议门清单：workflow verify 无门 + apply 实现桥，auto-workflow verify 无门', () => {
        const workflowVerify = getWorkflowProtocol('workflow')!.phases.find((p) => p.id === 'verify')!;
        const workflowApply = getWorkflowProtocol('workflow')!.phases.find((p) => p.id === 'apply')!;
        expect(workflowVerify.gate).toBeUndefined();
        expect(workflowApply.gate?.id).toBe('implementation-bridge');
        const autoVerify = getWorkflowProtocol('auto-workflow')!.phases.find((p) => p.id === 'verify')!;
        expect(autoVerify.gate).toBeUndefined();
        // 每阶段至多 1 个阻塞门（账本不新增门类别与门预算）
        for (const [workflowId, protocol] of Object.entries(WORKFLOW_PROTOCOLS)) {
            for (const phase of protocol.phases) {
                const blocking = [phase.gate].filter(
                    (gate) => gate !== undefined && (gate.blocking ?? true)
                );
                expect(blocking.length, `${workflowId}/${phase.id} 超过门预算`).toBeLessThanOrEqual(1);
            }
        }
        // 5 类白名单锚点集合不含已移除的需求文档桥
        expect(GATE_WHITELIST).toHaveLength(5);
        expect(GATE_WHITELIST_ANCHORS).toEqual([
            'prompt-gate',
            'grill-batch-confirmation',
            'diagnostic-confirmation',
            'fix-option-confirmation',
            'flow-final-confirmation',
            'implementation-bridge',
            'archive-confirmation',
        ]);
        expect(GATE_WHITELIST_ANCHORS).not.toContain('requirement-doc-bridge');
        expect(auditGateWhitelistAlignment()).toEqual([]);
    });

    it('白名单仍为 5 类，且 requirement-doc-bridge 已不在锚点或类别映射中', () => {
        expect(GATE_WHITELIST).toHaveLength(5);
        const clarification = GATE_WHITELIST.find((entry) => entry.id === 'requirement-clarification')!;
        expect(clarification.anchors).not.toContain('requirement-doc-bridge');
        expect(GATE_WHITELIST.some((entry) => entry.anchors.includes('requirement-doc-bridge'))).toBe(false);
        expect(PHASE_GATE_CATEGORY['requirement-doc-bridge']).toBeUndefined();
        expect(auditGateWhitelistAlignment()).toEqual([]);
    });

    it('每个阶段门均有类别映射且类别锚点包含该门', () => {
        for (const [workflowId, protocol] of Object.entries(WORKFLOW_PROTOCOLS)) {
            for (const phase of protocol.phases) {
                if (!phase.gate) {
                    continue;
                }
                const category = PHASE_GATE_CATEGORY[phase.gate.id];
                expect(category, `${workflowId}/${phase.id} 缺类别映射`).toBeDefined();
                const entry = GATE_WHITELIST.find((item) => item.id === category)!;
                expect(entry.anchors, `${workflowId}/${phase.id} 门未挂在其类别锚点`).toContain(
                    phase.gate.id
                );
            }
        }
    });

    it('每阶段至多 1 个阻塞门（门预算不变）', () => {
        for (const [workflowId, protocol] of Object.entries(WORKFLOW_PROTOCOLS)) {
            for (const phase of protocol.phases) {
                const blocking = [phase.gate].filter(
                    (gate) => gate !== undefined && (gate.blocking ?? true)
                );
                expect(blocking.length, `${workflowId}/${phase.id} 超过门预算`).toBeLessThanOrEqual(1);
            }
        }
    });

    it('headless 条件门记录决策并继续并记 WARN', () => {
        const phase = {
            id: 'clarify',
            requiredCapabilities: [] as const,
            handoff: ['x'],
            receipt: { fields: DEFAULT_RECEIPT_FIELDS },
            gate: { id: 'diagnostic-confirmation', blocking: true },
        };
        const result = evaluatePhaseTransition({
            phase,
            receipt: receipt('clarify'),
            gateConfirmed: false,
            negotiation: negotiateCapabilities('claude', 'strict', { surface: 'headless' }),
        });
        expect(result.advance).toBe(true);
        expect(result.blockedBy).not.toContain(TRANSITION_BLOCKERS.gate);
        expect(result.warnings.join('\n')).toContain('条件门');
        expect(result.warnings.join('\n')).toContain('WARN');
    });

    it('headless 不可豁免门以 blocked 回执中止并报告缺少交互式确认', () => {
        const phase = {
            id: 'implement',
            requiredCapabilities: [] as const,
            handoff: ['x'],
            receipt: { fields: DEFAULT_RECEIPT_FIELDS },
            gate: { id: 'implementation-bridge', blocking: true },
        };
        const result = evaluatePhaseTransition({
            phase,
            receipt: receipt('implement'),
            gateConfirmed: false,
            negotiation: negotiateCapabilities('claude', 'strict', { surface: 'headless' }),
        });
        expect(result.advance).toBe(false);
        expect(result.blockedBy).toContain(TRANSITION_BLOCKERS.gate);
        expect(result.warnings.join('\n')).toContain('缺少交互式确认能力');
    });

    it('交互表面保持既有判定（未确认即阻塞）', () => {
        for (const surface of ['interactive-ui', 'interactive-cli'] as const) {
            const phase = {
                id: 'clarify',
                requiredCapabilities: [] as const,
                handoff: ['x'],
                receipt: { fields: DEFAULT_RECEIPT_FIELDS },
                gate: { id: 'diagnostic-confirmation', blocking: true },
            };
            const result = evaluatePhaseTransition({
                phase,
                receipt: receipt('clarify'),
                gateConfirmed: false,
                negotiation: negotiateCapabilities('claude', 'strict', { surface }),
            });
            expect(result.advance, `${surface} 不应放行未确认门`).toBe(false);
            expect(result.blockedBy).toContain(TRANSITION_BLOCKERS.gate);
        }
    });
});

// 修复轮（verify residual）：degraded 产物不得自相矛盾（委派语句按本地执行覆盖）。
describe('degraded 产物的委派语句覆盖声明', () => {
    const degradedNegotiations = () => [
        negotiationForHost('codex')!,
        negotiateCapabilities('pi', 'degraded', ['skill-load', 'argument-passing']),
    ];

    it('degraded 段追加覆盖声明，且直接推进句改为本地执行', () => {
        for (const negotiation of degradedNegotiations()) {
            const section = renderHostOrchestrationSection(negotiation, 'workflow');
            expect(section).toContain('degraded 覆盖声明');
            expect(section).toContain('不构成委派');
            expect(section).toContain('本地执行');
            // 不得再宣称「SHALL 直接委派」（与不存在委派机制的宿主矛盾）
            expect(section).not.toContain('SHALL 直接委派');
        }
    });

    it('strict 段保持直接委派且无覆盖声明', () => {
        const section = renderHostOrchestrationSection(
            negotiateCapabilities('claude', 'strict'),
            'workflow'
        );
        expect(section).toContain('SHALL 直接委派');
        expect(section).not.toContain('degraded 覆盖声明');
    });

    it('codex 生成产物（adapt）含覆盖声明且不含 Claude 专属委派指令', () => {
        const content = adaptSkillContentForHost('# wf', negotiationForHost('codex')!, 'workflow');
        expect(content).toContain('degraded 覆盖声明');
        expect(content).toContain('不构成委派');
        expect(content).not.toContain('经 Skill 工具委派');
    });
});

// 变更 fix-multi-agent-skill-command-generation / 任务 1.5 / 1.4：
// Codex 引用语法（$iagent-<id>）与能力档案同源，且不虚增 delegate / gate。
describe('Codex 引用语法与能力档案同源', () => {
    it('capabilities 仍仅含 skill-load / argument-passing', () => {
        expect([...HOST_PROFILES.codex.capabilities]).toEqual(['skill-load', 'argument-passing']);
        expect(HOST_PROFILES.codex.capabilities).not.toContain('delegate');
        expect(HOST_PROFILES.codex.capabilities).not.toContain('gate');
    });

    it('协商仍为 degraded 且 missing 含 delegate / gate', () => {
        const codex = negotiationForHost('codex')!;
        expect(codex.mode).toBe('degraded');
        expect(codex.missing).toContain('delegate');
        expect(codex.missing).toContain('gate');
    });

    it('skillLoading 与 renderLoadSkill 采用 $iagent-<id> 引用语法', () => {
        expect(HOST_PROFILES.codex.native.skillLoading).toContain('$iagent-<id>');
        expect(HOST_PROFILES.codex.native.skillLoading).not.toContain('无宿主级技能调用工具');

        const load = renderLoadSkill('codex', 'degraded', { workflowId: 'spec-apply' });
        expect(load).toContain('$iagent-spec-apply');
        expect(load).not.toContain('无宿主级技能调用工具');
    });

    it('README 四工具对照表的 Codex 触发形式为 canonical $iagent-spec-apply', () => {
        const readme = fs.readFileSync(path.join(process.cwd(), 'README.md'), 'utf8');
        expect(readme).toContain('`$iagent-spec-apply`');
        expect(readme).not.toContain('`$iagent_spec_apply`');
    });
});

// 修复轮：参数表与模板正文同源同值（无第三处取值）。
describe('DELEGATION_PARAMETERS 与模板正文一致', () => {
    it('workflow / auto-workflow 的委派参数来自正文插值常量', () => {
        for (const workflowId of ['workflow', 'auto-workflow']) {
            const body = getSkillTemplates(undefined, [workflowId])[0].template.instructions;
            expect(body).toContain('mode=delegated');
            expect(body).toContain('gate-skip=design-confirmation');
            // 参数表取值与正文取值一致
            const params = DELEGATION_PARAMETERS[workflowId];
            expect(params['spec-explore']).toEqual({ mode: 'delegated' });
            expect(params['spec-propose']).toEqual({ mode: 'delegated' });
            expect(params['spec-apply']).toEqual({ 'gate-skip': 'design-confirmation' });
        }
    });
});

// 变更 improve-delegation-gate-ledger / 任务 1.6 / 5.4：门账本回执镜像校验。
describe('回执 confirmedGates（门账本镜像）', () => {
    const spec = { fields: DEFAULT_RECEIPT_FIELDS };
    const base = {
        phase: 'apply',
        status: 'ok' as const,
        artifact: 'tasks.md',
        nextAllowed: 'verify',
    };

    it('合法门承载 id 通过，且不进入默认必需字段', () => {
        expect(DEFAULT_RECEIPT_FIELDS).not.toContain('confirmedGates');
        const result = validateReceipt({ ...base, confirmedGates: ['design-confirmation'] }, spec);
        expect(result.valid).toBe(true);
    });

    it('缺字段仍有效（缺失即无账本，门照常触发）', () => {
        expect(validateReceipt({ ...base }, spec).valid).toBe(true);
    });

    it('非数组 / 元素非字符串 / 空串 / 未知门 id → 无效并附原因', () => {
        const cases: unknown[] = [
            'design-confirmation',
            [123],
            [''],
            ['implementation-bridge'],
            ['requirement-doc-bridge'],
        ];
        for (const value of cases) {
            const result = validateReceipt(
                { ...base, confirmedGates: value as string[] },
                spec
            );
            expect(result.valid, `非法 confirmedGates 被放行：${JSON.stringify(value)}`).toBe(false);
            expect(result.reason ?? '').toContain('confirmedGates');
        }
    });

    it('回执 confirmedGates 非法时以 invalid-receipt 阻断推进并记 WARN', () => {
        const phase = {
            id: 'apply',
            requiredCapabilities: [] as const,
            handoff: ['x'],
            receipt: { fields: DEFAULT_RECEIPT_FIELDS },
        };
        const result = evaluatePhaseTransition({
            phase,
            receipt: { ...base, confirmedGates: ['unknown-gate'] },
            gateConfirmed: true,
            negotiation: negotiateCapabilities('claude', 'strict'),
        });
        expect(result.advance).toBe(false);
        expect(result.blockedBy).toContain(TRANSITION_BLOCKERS.receipt);
        expect(result.warnings.join('\n')).toContain('confirmedGates');
    });
});

// 变更 improve-orchestration-execution-mode / 任务 1.3 / 1.4：回执执行方式与数据共享字段。
describe('回执执行方式与数据共享字段（1.3 / 1.4）', () => {
    const spec = { fields: DEFAULT_RECEIPT_FIELDS };
    const base = {
        phase: 'apply',
        status: 'ok' as const,
        artifact: 'tasks.md',
        nextAllowed: 'verify',
    };

    it('合法扩展字段通过校验（executionMode / independence / usage / readScope）', () => {
        const result = validateReceipt(
            {
                ...base,
                executionMode: 'subagent',
                independence: 'independent',
                usage: { tokens: 1200, toolCalls: 8 },
                readScope: ['proposal.md#Why'],
            },
            spec
        );
        expect(result.valid).toBe(true);
        expect(result.missing).toEqual([]);
    });

    it('非法取值域被拒并附原因（executionMode / usage / 数组元素 / independence / contextReplay）', () => {
        const cases: Array<{ label: string; extra: Record<string, unknown>; pattern: RegExp }> = [
            { label: 'executionMode=agent', extra: { executionMode: 'agent' }, pattern: /executionMode/ },
            { label: 'executionMode 非字符串', extra: { executionMode: 123 }, pattern: /executionMode/ },
            { label: '负 usage.tokens', extra: { usage: { tokens: -1 } }, pattern: /usage\.tokens/ },
            { label: 'usage.toolCalls 非整数', extra: { usage: { toolCalls: 1.5 } }, pattern: /toolCalls/ },
            { label: 'readScope 含空串元素', extra: { readScope: ['proposal.md#Why', ''] }, pattern: /readScope/ },
            { label: 'dependsOn 空数组', extra: { dependsOn: [] }, pattern: /dependsOn/ },
            { label: 'independence=partial', extra: { independence: 'partial' }, pattern: /independence/ },
            { label: 'contextReplay 非布尔', extra: { contextReplay: 'true' }, pattern: /contextReplay/ },
        ];
        for (const { label, extra, pattern } of cases) {
            const result = validateReceipt({ ...base, ...extra } as never, spec);
            expect(result.valid, `${label} 被误判为合法`).toBe(false);
            expect(result.reason ?? '', label).toMatch(pattern);
        }
    });

    it('旧回执（仅四字段 + status=ok）仍合法（缺失新字段 fail-safe）', () => {
        const result = validateReceipt(
            { phase: 'apply', status: 'ok', artifact: 'tasks.md', nextAllowed: 'verify' },
            spec
        );
        expect(result.valid).toBe(true);
        expect(result.missing).toEqual([]);
    });

    it('usage 缺失时回执仍合法，且校验器不补默认值、不改写输入', () => {
        const receipt = Object.freeze({ ...base, executionMode: 'subagent' as const });
        const result = validateReceipt(receipt, spec);
        expect(result.valid).toBe(true);
        // 不得编造 tokens：输入不被写入 usage，校验结果也不回填
        expect((receipt as { usage?: unknown }).usage).toBeUndefined();
        expect('usage' in result).toBe(false);
    });

    it('usage 未知键不导致校验失败（MUST NOT 被消费）', () => {
        const result = validateReceipt(
            { ...base, usage: { tokens: 12, toolCalls: 3, unknownMetric: 99 } as never },
            spec
        );
        expect(result.valid).toBe(true);
    });
});

// 变更 improve-orchestration-execution-mode / 任务 2.4：阶段推进校验执行方式与独立性。
describe('阶段推进校验执行方式（2.4）', () => {
    const workflowApply = () => getWorkflowProtocol('workflow')!.phases.find((phase) => phase.id === 'apply')!;
    const workflowVerify = () => getWorkflowProtocol('workflow')!.phases.find((phase) => phase.id === 'verify')!;
    const okReceipt = (phase: string, extra: Record<string, unknown> = {}) => ({
        phase,
        status: 'ok' as const,
        artifact: 'artifact.md',
        nextAllowed: 'next',
        ...extra,
    });

    it('strict apply 返回 executionMode=inline → advance=false 且 blockedBy 含 invalid-receipt', () => {
        const result = evaluatePhaseTransition({
            phase: workflowApply(),
            receipt: okReceipt('apply', { executionMode: 'inline' }),
            gateConfirmed: true,
            negotiation: negotiateCapabilities('claude', 'strict'),
        });
        expect(result.advance).toBe(false);
        expect(result.blockedBy).toContain(TRANSITION_BLOCKERS.receipt);
        expect(result.warnings.join('\n')).toContain('executionMode=inline');
    });

    it('verify 内联 independence=self → WARN 且仍可推进', () => {
        const result = evaluatePhaseTransition({
            phase: workflowVerify(),
            receipt: okReceipt('verify', { executionMode: 'inline', independence: 'self' }),
            gateConfirmed: true,
            negotiation: negotiateCapabilities('claude', 'strict'),
        });
        expect(result.advance).toBe(true);
        expect(result.blockedBy).toEqual([]);
        expect(result.warnings.join('\n')).toContain('作者自证');
    });

    it('degraded 声称 subagent → WARN 按不实声明处理', () => {
        const result = evaluatePhaseTransition({
            phase: workflowApply(),
            receipt: okReceipt('apply', { executionMode: 'subagent' }),
            gateConfirmed: true,
            negotiation: negotiateCapabilities('pi', 'degraded', ['skill-load', 'argument-passing']),
        });
        const warnings = result.warnings.join('\n');
        expect(warnings).toContain('local-degraded');
        expect(warnings).toContain('MUST NOT');
        // degraded 的能力缺失由协商层记录，不走 strict 的 missing-capabilities 阻断
        expect(result.blockedBy).not.toContain(TRANSITION_BLOCKERS.capabilities);
    });

    it('contextReplay=true → WARN 提示不得计为合规复验', () => {
        const result = evaluatePhaseTransition({
            phase: workflowApply(),
            receipt: okReceipt('apply', { executionMode: 'subagent', contextReplay: true }),
            gateConfirmed: true,
            negotiation: negotiateCapabilities('claude', 'strict'),
        });
        expect(result.advance).toBe(true);
        expect(result.warnings.join('\n')).toContain('contextReplay');
    });
});

// 变更 improve-orchestration-execution-mode / 任务 2.5：分级执行契约。
describe('分级执行契约（2.5）', () => {
    const noDelegate = negotiateCapabilities('pi', 'strict', [
        'skill-load',
        'argument-passing',
        'receipt',
        'gate',
        'state',
    ]);

    it('strict 缺少 delegate 时变更类阶段以 missing-capabilities 阻断', () => {
        const apply = getWorkflowProtocol('workflow')!.phases.find((phase) => phase.id === 'apply')!;
        const result = evaluatePhaseTransition({
            phase: apply,
            receipt: {
                phase: 'apply',
                status: 'ok',
                artifact: 'tasks.md',
                nextAllowed: 'verify',
                executionMode: 'subagent',
            },
            gateConfirmed: true,
            negotiation: noDelegate,
        });
        expect(result.advance).toBe(false);
        expect(result.blockedBy).toContain(TRANSITION_BLOCKERS.capabilities);
        expect(result.missingCapabilities).toContain('delegate');
    });

    it('explore / investigate / verify-close 声明 inline 且不要求 delegate，缺委派能力仍可推进', () => {
        const inlinePhases = [
            getWorkflowProtocol('workflow')!.phases.find((phase) => phase.id === 'explore')!,
            getWorkflowProtocol('debug')!.phases.find((phase) => phase.id === 'investigate')!,
            getWorkflowProtocol('debug')!.phases.find((phase) => phase.id === 'verify-close')!,
        ];
        for (const phase of inlinePhases) {
            expect(phase.requiredCapabilities, `${phase.id} 不应要求 delegate`).not.toContain('delegate');
            expect(phase.execution?.allowed, `${phase.id} 应允许 inline`).toContain('inline');
            const result = evaluatePhaseTransition({
                phase,
                receipt: {
                    phase: phase.id,
                    status: 'ok',
                    artifact: 'artifact.md',
                    nextAllowed: 'next',
                    executionMode: 'inline',
                },
                gateConfirmed: true,
                negotiation: noDelegate,
            });
            expect(result.advance, `${phase.id} 被误阻断：${result.blockedBy.join(', ')}`).toBe(true);
        }
    });

    it('verify 阶段声明 inline 优先 + independence=self-allowed（兼容窗保留 subagent）', () => {
        for (const workflowId of ['workflow', 'auto-workflow']) {
            const verify = getWorkflowProtocol(workflowId)!.phases.find((phase) => phase.id === 'verify')!;
            expect(verify.execution?.independence).toBe('self-allowed');
            expect(verify.execution?.allowed).toContain('inline');
            expect(verify.execution?.allowed).toContain('subagent');
            expect(verify.requiredCapabilities).not.toContain('delegate');
        }
    });

    it('verify / archive / fix / migration 内联优先且不要求 delegate', () => {
        const phases = [
            getWorkflowProtocol('workflow')!.phases.find((phase) => phase.id === 'verify')!,
            getWorkflowProtocol('workflow')!.phases.find((phase) => phase.id === 'archive')!,
            getWorkflowProtocol('auto-workflow')!.phases.find((phase) => phase.id === 'archive')!,
            getWorkflowProtocol('debug')!.phases.find((phase) => phase.id === 'fix')!,
            getWorkflowProtocol('migration')!.phases.find((phase) => phase.id === 'source-scan')!,
            getWorkflowProtocol('migration')!.phases.find((phase) => phase.id === 'implement-and-check')!,
        ];
        for (const phase of phases) {
            expect(phase.execution?.allowed, `${phase.id} 应允许 inline`).toContain('inline');
            expect(phase.requiredCapabilities, `${phase.id} 不应要求 delegate`).not.toContain('delegate');
            const result = evaluatePhaseTransition({
                phase,
                receipt: {
                    phase: phase.id,
                    status: 'ok',
                    artifact: 'artifact.md',
                    nextAllowed: 'next',
                    executionMode: 'inline',
                },
                gateConfirmed: true,
                negotiation: noDelegate,
            });
            expect(result.advance, `${phase.id} 缺 delegate 被误阻断：${result.blockedBy.join(', ')}`).toBe(true);
            expect(result.blockedBy).not.toContain(TRANSITION_BLOCKERS.capabilities);
        }
    });

    it('兼容窗内 subagent 回执记 deprecation WARN 且允许推进', () => {
        const phases = [
            getWorkflowProtocol('workflow')!.phases.find((phase) => phase.id === 'verify')!,
            getWorkflowProtocol('workflow')!.phases.find((phase) => phase.id === 'archive')!,
            getWorkflowProtocol('debug')!.phases.find((phase) => phase.id === 'fix')!,
            getWorkflowProtocol('migration')!.phases.find((phase) => phase.id === 'source-scan')!,
        ];
        for (const phase of phases) {
            const result = evaluatePhaseTransition({
                phase,
                receipt: {
                    phase: phase.id,
                    status: 'ok',
                    artifact: 'artifact.md',
                    nextAllowed: 'next',
                    executionMode: 'subagent',
                },
                gateConfirmed: true,
                negotiation: negotiateCapabilities('claude', 'strict'),
            });
            expect(result.advance, `${phase.id} 兼容窗回执被阻断`).toBe(true);
            const warnings = result.warnings.join('\n');
            expect(warnings, `${phase.id} 缺 deprecation WARN`).toContain('deprecation');
            expect(warnings).toContain('已改为主代理内联');
            expect(warnings).toContain('下个 major 收紧');
        }
    });

    it('写阶段（propose / apply）不进入兼容窗：subagent 为唯一允许值且保留 delegate', () => {
        for (const workflowId of ['workflow', 'auto-workflow']) {
            for (const phaseId of ['propose', 'apply']) {
                const phase = getWorkflowProtocol(workflowId)!.phases.find((item) => item.id === phaseId)!;
                expect(phase.execution?.allowed, `${workflowId}/${phaseId}`).toEqual(['subagent']);
                expect(phase.requiredCapabilities, `${workflowId}/${phaseId}`).toContain('delegate');
            }
        }
    });

    it('缺省 execution 的阶段不校验执行方式（旧阶段兼容）', () => {
        const legacyPhase = {
            id: 'legacy',
            input: { required: ['changeName'] as const },
            requiredCapabilities: ['receipt'] as const,
            handoff: [],
            receipt: { fields: ['phase', 'status', 'artifact', 'nextAllowed'] },
        } as unknown as Parameters<typeof evaluatePhaseTransition>[0]['phase'];
        const result = evaluatePhaseTransition({
            phase: legacyPhase,
            receipt: { phase: 'legacy', status: 'ok', artifact: 'artifact.md', nextAllowed: 'next' },
            gateConfirmed: true,
            negotiation: negotiateCapabilities('claude', 'strict'),
        });
        expect(result.advance).toBe(true);
        expect(result.blockedBy).not.toContain(TRANSITION_BLOCKERS.receipt);
    });

    it('degraded 统一 local-degraded：合规回执无告警，声称 subagent 记 WARN', () => {
        const degraded = negotiateCapabilities('pi', 'degraded', ['skill-load', 'argument-passing']);
        const apply = getWorkflowProtocol('workflow')!.phases.find((phase) => phase.id === 'apply')!;
        const receipt = (executionMode: 'local-degraded' | 'subagent') => ({
            phase: 'apply',
            status: 'ok' as const,
            artifact: 'tasks.md',
            nextAllowed: 'verify',
            executionMode,
        });

        const compliant = evaluatePhaseTransition({
            phase: apply,
            receipt: receipt('local-degraded'),
            gateConfirmed: true,
            negotiation: degraded,
        });
        expect(compliant.warnings.join('\n')).not.toContain('local-degraded');

        const claimed = evaluatePhaseTransition({
            phase: apply,
            receipt: receipt('subagent'),
            gateConfirmed: true,
            negotiation: degraded,
        });
        expect(claimed.warnings.join('\n')).toContain('local-degraded');
    });

    it('协议不存在顶层 test 阶段（iagent_test 为 apply / fix 子阶段）', () => {
        for (const [workflowId, protocol] of Object.entries(WORKFLOW_PROTOCOLS)) {
            expect(protocol.phases.map((phase) => phase.id), `${workflowId} 不应有顶层 test 阶段`).not.toContain(
                'test'
            );
        }
    });
});
