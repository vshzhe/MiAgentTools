/**
 * 宿主编排协议与能力协商回归锁（变更 add-host-orchestration-adapters）。
 */

import { describe, it, expect } from 'vitest';
import { getSkillTemplates } from '../src/core/templates/index.js';
import {
    CAPABILITY_ORDER,
    CONDITIONAL_DELEGATIONS,
    DEFAULT_RECEIPT_FIELDS,
    GATE_CONDITION_IDS,
    GATE_WHITELIST,
    GATE_WHITELIST_ANCHORS,
    ORCHESTRATION_DELEGATIONS,
    ORCHESTRATING_WORKFLOW_IDS,
    PHASE_GATE_CATEGORY,
    PERSISTED_REQUIREMENT_DOC_STATUSES,
    REQUIREMENT_DOC_STATUS_FIELD,
    REQUIREMENT_DOC_STATUS_IO_ATTEMPTS,
    TRANSITION_BLOCKERS,
    WORKFLOW_PROTOCOLS,
    auditGateWhitelistAlignment,
    getWorkflowProtocol,
    normalizeRequirementDocStatus,
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

    it('investigate 交付 fix 所需输入（rootCause / defectChain / changeName / affectedSymbols）', () => {
        const investigate = debug.phases.find((phase) => phase.id === 'investigate')!;
        for (const field of ['rootCause', 'defectChain', 'changeName', 'affectedSymbols']) {
            expect(investigate.handoff).toContain(field);
        }
        const fix = debug.phases.find((phase) => phase.id === 'fix')!;
        for (const field of ['rootCause', 'defectChain', 'changeName', 'fixDecision']) {
            expect(fix.input.required).toContain(field);
        }
    });

    it('verify-close 消费 fix 结果并交付文档状态', () => {
        const fix = debug.phases.find((phase) => phase.id === 'fix')!;
        expect(fix.handoff).toContain('fixApplied');
        expect(fix.handoff).toContain('regressionTests');
        const close = debug.phases.find((phase) => phase.id === 'verify-close')!;
        expect(close.input.required).toContain('fixApplied');
        expect(close.handoff).toContain('requirementDocStatus');
        expect(close.receipt.fields).toContain('requirementDocStatus');
    });

    it('verify-close 回执缺失文档状态时阻止推进', () => {
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
        expect(result.advance).toBe(false);
        expect(result.blockedBy).toContain(TRANSITION_BLOCKERS.receipt);
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

describe('需求文档状态契约与跨阶段 handoff（4.4）', () => {
    it('四值模型：非法/缺失归一化为 absent，显式三态原样保留', () => {
        expect(normalizeRequirementDocStatus(undefined)).toBe('absent');
        expect(normalizeRequirementDocStatus('')).toBe('absent');
        expect(normalizeRequirementDocStatus('   ')).toBe('absent');
        expect(normalizeRequirementDocStatus('unknown')).toBe('absent');
        expect(normalizeRequirementDocStatus('skipped-by-user')).toBe('skipped-by-user');
        expect(normalizeRequirementDocStatus('generation-failed')).toBe('generation-failed');
        expect(normalizeRequirementDocStatus(' generated ')).toBe('generated');
        // absent 不落盘：可持久化状态集合不含 absent
        expect(PERSISTED_REQUIREMENT_DOC_STATUSES).toEqual([
            'skipped-by-user',
            'generation-failed',
            'generated',
        ]);
    });

    it('持久字段名与「失败重试一次后停止」的尝试次数固定', () => {
        expect(REQUIREMENT_DOC_STATUS_FIELD).toBe('requirementDocStatus');
        expect(REQUIREMENT_DOC_STATUS_IO_ATTEMPTS).toBe(2);
    });

    it('verify → apply → archive 传递同一文档状态', () => {
        const workflow = getWorkflowProtocol('workflow')!;
        const verify = workflow.phases.find((phase) => phase.id === 'verify')!;
        const apply = workflow.phases.find((phase) => phase.id === 'apply')!;
        const archive = workflow.phases.find((phase) => phase.id === 'archive')!;
        expect(verify.handoff).toContain('requirementDocStatus');
        expect(apply.input.optional).toContain('requirementDocStatus');
        expect(apply.handoff).toContain('requirementDocStatus');
        expect(archive.input.optional).toContain('requirementDocStatus');
    });

    it('auto-workflow 复用同一状态 handoff（自动 apply → archive）', () => {
        const auto = getWorkflowProtocol('auto-workflow')!;
        const apply = auto.phases.find((phase) => phase.id === 'apply')!;
        const archive = auto.phases.find((phase) => phase.id === 'archive')!;
        expect(apply.handoff).toContain('requirementDocStatus');
        expect(archive.input.optional).toContain('requirementDocStatus');
    });

    it('回执可携带文档状态且 validateReceipt 认可该字段', () => {
        const result = validateReceipt(
            {
                phase: 'verify-close',
                status: 'ok',
                artifact: 'exploration.md',
                nextAllowed: 'archive',
                requirementDocStatus: 'skipped-by-user',
            },
            { fields: [...DEFAULT_RECEIPT_FIELDS, 'requirementDocStatus'] }
        );
        expect(result.valid).toBe(true);
    });

    it('workflow / auto-workflow 的 verify 阶段回执要求文档状态（缺失 → invalid-receipt）', () => {
        for (const workflowId of ['workflow', 'auto-workflow']) {
            const verify = getWorkflowProtocol(workflowId)!.phases.find((phase) => phase.id === 'verify')!;
            // 与 handoff 一致：桥结果必须随验证回执交付
            expect(verify.handoff).toContain('requirementDocStatus');
            expect(verify.receipt.fields).toContain('requirementDocStatus');

            const baseReceipt = {
                phase: 'verify',
                status: 'ok',
                artifact: 'verify-report.md',
                nextAllowed: 'apply',
            };
            const missing = evaluatePhaseTransition({
                phase: verify,
                receipt: baseReceipt as never,
                gateConfirmed: true,
                negotiation: negotiateCapabilities('claude', 'strict'),
            });
            expect(missing.advance, `${workflowId} verify 缺少文档状态却允许推进`).toBe(false);
            expect(missing.blockedBy).toContain(TRANSITION_BLOCKERS.receipt);

            const complete = evaluatePhaseTransition({
                phase: verify,
                receipt: { ...baseReceipt, requirementDocStatus: 'skipped-by-user' } as never,
                gateConfirmed: true,
                negotiation: negotiateCapabilities('claude', 'strict'),
            });
            expect(complete.advance, `${workflowId} verify 携带文档状态仍被阻塞`).toBe(true);
            expect(complete.blockedBy).toEqual([]);
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

    it('debug 委派清单覆盖验证/复查/文档/测试，且阶段声明含条件门标注', () => {
        expect(ORCHESTRATION_DELEGATIONS.debug).toEqual([
            'spec-verify-proposal',
            'proposal-review',
            'requirement-doc',
            'test',
        ]);
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

    it('workflow / auto-workflow 委派清单覆盖模板真实调用（含 requirement-doc / spec-verify / test）', () => {
        for (const workflowId of ['workflow', 'auto-workflow']) {
            const delegations = ORCHESTRATION_DELEGATIONS[workflowId];
            for (const target of [
                'spec-explore',
                'spec-propose',
                'spec-verify-proposal',
                'proposal-review',
                'requirement-doc',
                'spec-apply',
                'spec-verify',
                'test',
                'spec-archive',
            ]) {
                expect(delegations, `${workflowId} 委派清单缺少 ${target}`).toContain(target);
            }
            // 委派清单与白名单同一真源（模板 allowedTools 的 Skill(...) 条目）
            const { template } = getSkillTemplates(undefined, [workflowId])[0];
            const allowedTargets = [...template.allowedTools.matchAll(/Skill\(([a-z_]+)\)/g)]
                .map((match) => match[1].replaceAll('_', '-'))
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
