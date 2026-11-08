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
import { getSpecProposeSkillTemplate } from '../src/core/templates/workflows/spec-propose.js';
import { getSpecVerifyProposalSkillTemplate } from '../src/core/templates/workflows/spec-verify-proposal.js';
import { getProposalReviewSkillTemplate } from '../src/core/templates/workflows/proposal-review.js';
import { getSpecVerifyChangeSkillTemplate } from '../src/core/templates/workflows/spec-verify.js';

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

// ---------------------------------------------------------------------------
// 变更 improve-orchestration-execution-mode（任务 5.8 / 5.9 / 5.10）
// ---------------------------------------------------------------------------

/** 三个编排模板的 [名称, 正文] 清单（缺失即断言失败） */
const ORCHESTRATOR_BODIES = [
    ['auto-workflow', getAutoWorkflowSkillTemplate().instructions],
    ['workflow', getWorkflowSkillTemplate().instructions],
    ['debug', getDebugSkillTemplate().instructions],
] as const;

/** 只读验证类技能正文（默认子代理、允许内联但受非作者约束） */
const READONLY_VERIFY_BODIES = [
    getSpecVerifyProposalSkillTemplate().instructions,
    getProposalReviewSkillTemplate().instructions,
    getSpecVerifyChangeSkillTemplate().instructions,
] as const;

describe('5.8 编排模板分级执行与增量复验关键字', () => {
    it('三个编排模板均声明执行方式段', () => {
        for (const [name, text] of ORCHESTRATOR_BODIES) {
            expect(text, `${name} 缺执行方式段`).toContain('执行方式与');
        }
        // auto-workflow / workflow 以「分级执行」概述策略；debug 以选项式分句表达
        expect(getAutoWorkflowSkillTemplate().instructions).toContain('分级执行');
        expect(getWorkflowSkillTemplate().instructions).toContain('分级执行');
        expect(getDebugSkillTemplate().instructions).toContain('investigate / verify-close 内联');
    });

    it('探索 / 交互阶段内联，写阶段子代理，验证与收尾内联优先', () => {
        // Given: auto-workflow / workflow 的 Phase 1 与 Phase 2/4/5
        const auto = getAutoWorkflowSkillTemplate().instructions;
        const wf = getWorkflowSkillTemplate().instructions;
        // Then: 阶段所有者执行方式与规格一致（写阶段子代理，验证 / 归档内联）
        expect(auto).toContain('Phase 1 内联');
        expect(auto).toContain('Phase 4 实现子代理');
        expect(auto).toContain('Phase 5 归档由主 agent 内联');
        expect(wf).toContain('Phase 1 内联');
        expect(wf).toContain('Phase 4 实现子代理');
        expect(wf).toContain('Phase 5 归档由主 agent 内联');

        // Given: debug 的 investigate / verify-close 与 fix
        const debug = getDebugSkillTemplate().instructions;
        // Then: 交互 / 收束 / 修复均内联
        expect(debug).toContain('investigate / verify-close 内联');
        expect(debug).toContain('fix（修复 + 编译检查 + 范围内测试）由主 agent 内联执行');
        expect(debug).toContain('iagent_test 以 **Skill 工具内联**调用');
    });

    it('无「内联执行变更类阶段」的肯定表述', () => {
        // 变更类阶段名后紧跟「内联执行」即属违规表述；前置 MUST NOT 的否定句不匹配
        const inlineChangeStage = /(变更类|apply|propose|archive|fix)[^\n]{0,10}内联执行/;
        for (const [name, text] of ORCHESTRATOR_BODIES) {
            expect(text, `${name} 含内联执行变更类阶段表述`).not.toMatch(inlineChangeStage);
        }
    });

    it('增量复验只传 fixDiff + 上轮 reportPath 且禁止 resume', () => {
        for (const [name, text] of ORCHESTRATOR_BODIES) {
            expect(text, `${name} 缺 fixDiff`).toContain('fixDiff');
            expect(text, `${name} 缺 reportPath`).toContain('reportPath');
            expect(text, `${name} 未禁止 resume 复验`).toContain('禁止 resume 充当复验');
        }
    });

    it('验证单轮内联：合并 D1-D10 + B1-B7，不派生两个验证子代理', () => {
        for (const [name, text] of [
            ['auto-workflow', getAutoWorkflowSkillTemplate().instructions],
            ['workflow', getWorkflowSkillTemplate().instructions],
        ] as const) {
            expect(text, `${name} 缺合并清单`).toContain('D1-D10');
            expect(text, `${name} 缺 B1-B7 清单`).toContain('B1-B7');
            expect(text, `${name} 未禁止两个验证子代理`).toContain('验证子代理');
            expect(text, `${name} 缺单轮`).toContain('执行**一次**验证');
        }
        expect(getDebugSkillTemplate().instructions).toContain(
            'verify-close 内验证 / 复查均为内联'
        );
    });

    it('子代理先读 handoff 包「## 制品清单」并记录 5 列阶段结论', () => {
        for (const [name, text] of ORCHESTRATOR_BODIES) {
            expect(text, `${name} 缺制品清单`).toContain('「## 制品清单」');
            expect(text, `${name} 缺阶段结论 5 列`).toContain('「## 阶段结论」5 列');
            expect(text, `${name} 缺 tokens 不可得填 —`).toContain('不可得填 —');
        }
    });
});

describe('5.9 复验同上下文增量重跑 / 串联回退 / 用量记录', () => {
    it('复验改为同上下文增量重跑且禁止 resume 充当复验', () => {
        for (const [name, text] of ORCHESTRATOR_BODIES) {
            expect(text, `${name} 未禁止新开验证代理`).toContain('禁止新开验证代理');
            expect(text, `${name} 未禁止 resume 充当复验`).toContain('禁止 resume 充当复验');
        }
        // Given: 验证类技能（FAIL 修复后的复验执行方）
        const verify = getSpecVerifyChangeSkillTemplate().instructions;
        const apply = getSpecApplyChangeSkillTemplate().instructions;
        // Then: 验证内联同上下文复跑；apply 仍以新只读代理复验，resume 仅续跑（contextReplay WARN）
        expect(verify).toContain('同上下文复跑');
        expect(verify).toContain('contextReplay=true 记 WARN');
        expect(apply).toContain('新开只读代理');
        expect(apply).toContain('contextReplay=true 记 WARN');
    });

    it('strict 渲染段把 resume 限定为续跑并标 contextReplay WARN', () => {
        const section = renderHostOrchestrationSection(strictClaude, 'auto-workflow');
        expect(section).toContain('禁止以 resume 充当复验');
        expect(section).toContain('contextReplay=true 记 WARN');
    });

    it('验证报告缺失时深度复查退化为独立全量复查并记 WARN', () => {
        const review = getProposalReviewSkillTemplate().instructions;
        expect(review).toContain('报告缺失');
        expect(review).toMatch(/退化为独立全量复查[^\n]*WARN/);
    });

    it('tokens 列为 5 列之一，不可得填 —（MUST NOT 编造）', () => {
        const propose = getSpecProposeSkillTemplate().instructions;
        expect(propose).toContain('phase | status | artifact | nextAllowed | tokens');
        expect(propose).toMatch(/tokens[^\n]{0,50}—/);
        expect(propose).toContain('MUST NOT 编造');
        for (const [name, text] of ORCHESTRATOR_BODIES) {
            expect(text, `${name} 缺 tokens 不可得填 —`).toContain('不可得填 —');
        }
    });
});

describe('5.10 分级执行模板与协议断言', () => {
    it('内联验证以固定清单 + 证据承担可信度，无证据不计分', () => {
        // 编排层（auto-workflow / workflow）声明合并清单与证据契约
        for (const text of [
            getAutoWorkflowSkillTemplate().instructions,
            getWorkflowSkillTemplate().instructions,
        ]) {
            expect(text).toContain('D1-D10');
            expect(text).toContain('B1-B7');
            expect(text).toContain('无证据的结论 MUST NOT 计入通过');
            expect(text).toContain('independence=self');
        }
        // 只读验证技能自身声明内联契约
        for (const text of READONLY_VERIFY_BODIES) {
            expect(text).toContain('主 agent 内联');
            expect(text).toContain('无证据的结论 MUST NOT 计入通过');
            expect(text).toContain('contextReplay=true 记 WARN');
        }
    });

    it('degraded 宿主显式本地执行且不得声称 subagent', () => {
        // Given: degraded（Codex skills-only）协商
        const degraded = negotiationForHost('codex')!;
        // When
        const section = renderHostOrchestrationSection(degraded, 'auto-workflow');
        // Then
        expect(section).toContain('executionMode=local-degraded');
        expect(section).toContain('MUST NOT 声称 subagent');
    });

    it('探索阶段内联（模板与协议一致）', () => {
        // Given: workflow 协议的 explore 阶段
        const explore = getWorkflowProtocol('workflow')!.phases.find((p) => p.id === 'explore')!;
        // Then: 协议允许 inline 且不要求 delegate
        expect(explore.execution?.allowed).toEqual(['inline']);
        expect(explore.requiredCapabilities).not.toContain('delegate');
        // And: 模板正文同步声明
        for (const [name, text] of ORCHESTRATOR_BODIES) {
            const marker = name === 'debug' ? 'investigate / verify-close 内联' : 'Phase 1 内联';
            expect(text, `${name} 缺探索内联`).toContain(marker);
        }
    });

    it('只读验证内联优先（协议 self-allowed，技能正文主 agent 内联）', () => {
        // Given: workflow 协议的 verify 阶段
        const verify = getWorkflowProtocol('workflow')!.phases.find((p) => p.id === 'verify')!;
        // Then: 内联优先、兼容窗保留 subagent、独立性 self-allowed
        expect(verify.execution?.allowed).toContain('inline');
        expect(verify.execution?.allowed).toContain('subagent');
        expect(verify.execution?.independence).toBe('self-allowed');
        // And: 只读验证技能正文以主 agent 内联为默认
        for (const text of READONLY_VERIFY_BODIES) {
            expect(text).toContain('主 agent 内联');
        }
    });

    it('inline 阶段（investigate / verify-close）不要求 delegate', () => {
        const debug = getWorkflowProtocol('debug')!;
        for (const id of ['investigate', 'verify-close']) {
            const phase = debug.phases.find((p) => p.id === id)!;
            expect(phase.execution?.allowed).toEqual(['inline']);
            expect(phase.requiredCapabilities).not.toContain('delegate');
        }
    });
});

// ---------------------------------------------------------------------------
// 变更 improve-grill-with-docs-paper-trail（任务 9.1 - 9.9）
// handoff 包 `## 硬约束` 并列节的产出 / 消费契约。
// ---------------------------------------------------------------------------
describe('9.1–9.9 handoff 包 `## 硬约束` 并列节契约', () => {
    const propose = getSpecProposeSkillTemplate().instructions;

    it('9.1 并列节且不计入六节', () => {
        expect(propose).toContain('## 硬约束');
        expect(propose).toContain('并列');
        expect(propose).toContain('不计入六节');
    });

    it('9.2 逐字保留与 source: D<n> 锚点，禁止整段复制', () => {
        expect(propose).toContain('逐字保留');
        expect(propose).toContain('source: D<n>');
        expect(propose).toContain('MUST NOT 整段复制');
    });

    it('9.3 缺节时回执 incomplete + failure', () => {
        expect(propose).toContain('status=incomplete');
        expect(propose).toContain('failure');
        expect(propose).toContain('MUST NOT 猜测补写');
    });

    it('9.4 存量包无该节时 WARN 降级且不判整包无效', () => {
        expect(propose).toContain('WARN');
        expect(propose).toContain('无硬约束');
        expect(propose).toContain('MUST NOT 判定整包无效');
    });

    it('9.5 模糊回答禁止伪造硬约束（B4）', () => {
        expect(propose).toContain('[待确认]');
        expect(propose).toContain('MUST NOT 伪造硬约束');
    });

    it('9.6 硬约束与代码矛盾时以代码为准并在流程门呈现（B5）', () => {
        expect(propose).toContain('代码事实优先');
        expect(propose).toContain('在流程最终确认门呈现');
    });

    it('9.7 硬约束节 ≤120 行且不计入六节', () => {
        expect(propose).toContain('≤ 120 行');
        expect(propose).toContain('不计入六节');
    });

    it('9.8 无硬约束为合法终态，空节不判 incomplete', () => {
        expect(propose).toContain('无硬约束');
        expect(propose).toContain('MUST NOT 因此返回 status=incomplete');
    });

    it('9.9 包写入失败按 WARN 继续，不与 incomplete 混用', () => {
        expect(propose).toContain('包写入失败');
        expect(propose).toContain('WARN 继续');
        expect(propose).toContain('MUST NOT 混用');
    });

    it('消费方：verify 无 Write 不声称追加；apply / archive 只读复用', () => {
        const verify = getSpecVerifyChangeSkillTemplate().instructions;
        expect(verify).toContain('只读复用');
        expect(verify).toContain('无 `Write` 权限');
        expect(verify).toContain('MUST NOT 声称已追加');
        for (const text of [
            getSpecApplyChangeSkillTemplate().instructions,
            getSpecArchiveChangeSkillTemplate().instructions,
        ]) {
            expect(text).toContain('只读复用');
        }
        expect(getSpecApplyChangeSkillTemplate().instructions).not.toContain('paperTrailStatus');
    });
});
