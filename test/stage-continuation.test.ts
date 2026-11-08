import { describe, it, expect } from 'vitest';
import {
    INTERACTIVE_STAGE_WORKFLOW_IDS,
    isInteractiveStage,
    renderDelegate,
} from '../src/core/host-orchestration/actions.js';
import {
    CONDITIONAL_DELEGATIONS,
    renderHostOrchestrationSection,
} from '../src/core/host-orchestration/render.js';
import { renderDelegationModeContract } from '../src/core/host-orchestration/delegation-contract.js';
import {
    DEFAULT_RECEIPT_FIELDS,
    GATE_WHITELIST_ANCHORS,
    HANDOFF_PACK_SECTION_MAX_LINES,
    STAGE_ENVELOPE_MAX_BYTES,
    STAGE_RECEIPT_MAX_BYTES,
    STAGE_RECEIPT_MAX_LINES,
    validateReceipt,
    type Receipt,
} from '../src/core/host-orchestration/protocol.js';
import {
    PHASE_GATE_CATEGORY,
    WORKFLOW_PROTOCOLS,
    getWorkflowProtocol,
} from '../src/core/host-orchestration/workflows.js';
import { negotiationForHost } from '../src/core/host-orchestration/hosts.js';
import { DEPS } from '../src/core/profiles.js';
import { getAutoWorkflowSkillTemplate } from '../src/core/templates/workflows/auto-workflow.js';
import { getWorkflowSkillTemplate } from '../src/core/templates/workflows/workflow.js';
import { getDebugSkillTemplate } from '../src/core/templates/workflows/debug.js';
import { getRequirementDocSkillTemplate } from '../src/core/templates/workflows/requirement-doc.js';
import { getSpecArchiveChangeSkillTemplate } from '../src/core/templates/workflows/spec-archive.js';
import { getSpecBulkArchiveSkillTemplate } from '../src/core/templates/workflows/spec-bulk-archive.js';
import { getSpecApplyChangeSkillTemplate } from '../src/core/templates/workflows/spec-apply.js';

const strictClaude = negotiationForHost('claude');

describe('Stage delegation mechanism', () => {
    it('classifies spec-explore as the only interactive stage', () => {
        expect(INTERACTIVE_STAGE_WORKFLOW_IDS).toEqual(['spec-explore']);
        expect(isInteractiveStage('spec-explore')).toBe(true);
        for (const automated of [
            'spec-propose',
            'spec-verify-proposal',
            'proposal-review',
            'test',
            'spec-apply',
            'spec-verify',
            'spec-archive',
        ]) {
            expect(isInteractiveStage(automated)).toBe(false);
        }
    });

    it('renders Skill for the interactive stage and foreground Agent for automated stages', () => {
        const interactive = renderDelegate('claude', 'strict', { workflowId: 'spec-explore' });
        expect(interactive).toContain('Skill');
        expect(interactive).toContain('交互阶段');
        expect(interactive).not.toContain('前台 Agent 子代理');

        const automated = renderDelegate('claude', 'strict', { workflowId: 'spec-propose' });
        expect(automated).toContain('前台 Agent 子代理');
        expect(automated).toContain('.claude/skills/iagent-spec-propose/SKILL.md');
        expect(automated).toContain('回执');
        expect(automated).toContain('EXIT GUARD');
    });

    it('uses Agent for other orchestrators automated stages (migration / project-init side effect)', () => {
        expect(renderDelegate('claude', 'strict', { workflowId: 'feature-doc' })).toContain(
            '前台 Agent 子代理'
        );
        expect(renderDelegate('claude', 'strict', { workflowId: 'migration-check' })).toContain(
            '前台 Agent 子代理'
        );
    });

    it('keeps non-Claude host mechanisms unchanged', () => {
        expect(renderDelegate('opencode', 'strict', { workflowId: 'spec-propose' })).toContain(
            'subagent'
        );
        expect(renderDelegate('pi', 'strict', { workflowId: 'spec-propose' })).toContain('Agent');
        expect(renderDelegate('codex', 'strict', { workflowId: 'spec-propose' })).toContain(
            '不构成委派'
        );
    });
});

describe('Continuation contract', () => {
    it('injects continuation semantics into the host orchestration section', () => {
        const section = renderHostOrchestrationSection(strictClaude, 'auto-workflow');
        expect(section).toContain('回执是**中间状态**');
        expect(section).toContain('同一用户回合内继续下一阶段');
        expect(section).toContain('只有门白名单内的确认门是合法停点');
        expect(section).toContain('Stage Envelope');
        expect(section).toContain('Stage Receipt');
    });

    it('extends the delegated mode contract with continuation', () => {
        const contract = renderDelegationModeContract();
        expect(contract).toContain('回执后父编排在同一用户回合内继续');
        expect(contract).toContain('不豁免任何业务确认门');
    });

    it('removes requirement-doc from conditional delegations and DEPS', () => {
        for (const workflow of ['workflow', 'auto-workflow']) {
            expect(CONDITIONAL_DELEGATIONS[workflow]).not.toContain('requirement-doc');
        }
        for (const workflow of ['workflow', 'auto-workflow', 'debug']) {
            expect(DEPS[workflow]).not.toContain('requirement-doc');
        }
        expect(DEPS.debug).toEqual(['spec-verify-proposal']);
    });

    it('removes requirement-doc-bridge from whitelist anchors and phase category mapping', () => {
        expect(GATE_WHITELIST_ANCHORS).not.toContain('requirement-doc-bridge');
        expect(PHASE_GATE_CATEGORY).not.toHaveProperty('requirement-doc-bridge');
    });
});

describe('Protocol gates after requirement-doc removal', () => {
    it('auto-workflow verify / apply / archive have no blocking gates', () => {
        const protocol = getWorkflowProtocol('auto-workflow');
        expect(protocol).toBeDefined();
        for (const id of ['verify', 'apply', 'archive']) {
            const phase = protocol!.phases.find((item) => item.id === id);
            expect(phase).toBeDefined();
            expect(phase!.gate).toBeUndefined();
        }
    });

    it('workflow keeps implementation-bridge and has no verify gate', () => {
        const protocol = getWorkflowProtocol('workflow')!;
        expect(protocol.phases.find((item) => item.id === 'verify')!.gate).toBeUndefined();
        expect(protocol.phases.find((item) => item.id === 'apply')!.gate?.id).toBe(
            'implementation-bridge'
        );
    });

    it('debug verify-close has no gate and no requirement-doc handoff', () => {
        const phase = getWorkflowProtocol('debug')!.phases.find((item) => item.id === 'verify-close')!;
        expect(phase.gate).toBeUndefined();
        expect(phase.handoff).not.toContain('requirementDocStatus');
    });

    it('propose handoff carries exploration and pack paths; verify carries review fields', () => {
        const protocol = WORKFLOW_PROTOCOLS.workflow;
        const propose = protocol.phases.find((item) => item.id === 'propose')!;
        expect(propose.handoff).toEqual(
            expect.arrayContaining([
                'explorationFile',
                'handoffPackPath',
                'sourceFingerprint',
            ])
        );
        const verify = protocol.phases.find((item) => item.id === 'verify')!;
        expect(verify.handoff).toEqual(expect.arrayContaining(['reviewSummary', 'reportPath']));
    });
});

describe('Stage context envelope and receipt validation', () => {
    const spec = { fields: DEFAULT_RECEIPT_FIELDS };

    it('keeps new receipt fields optional and out of DEFAULT_RECEIPT_FIELDS', () => {
        for (const field of [
            'blockedGate',
            'blockedReason',
            'resumeHint',
            'reportPath',
            'reviewSummary',
        ]) {
            expect(DEFAULT_RECEIPT_FIELDS).not.toContain(field);
        }
    });

    it('accepts valid optional fields', () => {
        const receipt: Partial<Receipt> = {
            phase: 'apply',
            status: 'ok',
            artifact: 'openspec/changes/x',
            nextAllowed: 'verify',
            reportPath: '.openspec-tmp/pipeline-x/report.md',
            reviewSummary: 'PASS',
        };
        expect(validateReceipt(receipt, spec).valid).toBe(true);
    });

    it('rejects blockedGate and blockedReason together', () => {
        const result = validateReceipt(
            {
                phase: 'apply',
                status: 'blocked',
                artifact: 'x',
                nextAllowed: 'apply',
                failure: 'blocked',
                blockedGate: 'implementation-bridge',
                blockedReason: 'scope creep',
            },
            spec
        );
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('二选一');
    });

    it('rejects blank optional strings', () => {
        const result = validateReceipt(
            {
                phase: 'apply',
                status: 'ok',
                artifact: 'x',
                nextAllowed: 'verify',
                reportPath: '   ',
            },
            spec
        );
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('reportPath');
    });

    it('rejects invalid confirmedGates', () => {
        const result = validateReceipt(
            {
                phase: 'apply',
                status: 'ok',
                artifact: 'x',
                nextAllowed: 'verify',
                confirmedGates: ['unknown-gate'],
            },
            spec
        );
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('未知门 id');
    });
});

describe('Token budget constants', () => {
    it('exposes bounded envelope / receipt / pack budgets', () => {
        expect(STAGE_ENVELOPE_MAX_BYTES).toBe(2048);
        expect(STAGE_RECEIPT_MAX_LINES).toBe(40);
        expect(STAGE_RECEIPT_MAX_BYTES).toBe(2048);
        expect(HANDOFF_PACK_SECTION_MAX_LINES).toBe(120);
    });
});

describe('Template behavior after requirement-doc removal', () => {
    it('auto-workflow has no requirement-doc bridge and no requirement-doc delegation', () => {
        const template = getAutoWorkflowSkillTemplate();
        expect(template.allowedTools).not.toContain('requirement-doc');
        expect(template.instructions).toContain('需求文档桥已移除');
        expect(template.instructions).toContain('回执是中间状态');
        expect(template.instructions).toContain('Stage Envelope');
        expect(template.instructions).not.toContain('iagent_requirement_doc');
    });

    it('workflow implementation bridge has three exits and no document option', () => {
        const template = getWorkflowSkillTemplate();
        expect(template.allowedTools).not.toContain('requirement-doc');
        expect(template.instructions).toContain('三出口');
        expect(template.instructions).not.toContain('仅生成文档');
        expect(template.instructions).not.toContain('iagent_requirement_doc');
    });

    it('debug verify-close has no requirement-doc bridge', () => {
        const template = getDebugSkillTemplate();
        expect(template.allowedTools).not.toContain('requirement-doc');
        expect(template.instructions).toContain('无需求文档桥');
        expect(template.instructions).not.toContain('iagent_requirement_doc');
    });

    it('requirement-doc is standalone-only', () => {
        const template = getRequirementDocSkillTemplate();
        expect(template.instructions).toContain('无自动调用方');
        expect(template.instructions).not.toContain('三父流程文档桥');
    });

    it('archive skills no longer read or report requirement docs', () => {
        for (const template of [
            getSpecArchiveChangeSkillTemplate(),
            getSpecBulkArchiveSkillTemplate(),
        ]) {
            expect(template.instructions).not.toContain('requirementDocStatus');
            expect(template.allowedTools).not.toContain('requirement-doc');
        }
    });

    it('spec-apply internal test delegation continues after return', () => {
        const template = getSpecApplyChangeSkillTemplate();
        expect(template.instructions).toContain('子代理返回后 MUST 继续批次调度');
        expect(template.instructions).not.toContain('requirement-doc-bridge');
    });
});
