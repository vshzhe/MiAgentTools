/**
 * 具体工作流协议实例（变更 add-host-orchestration-adapters）。
 *
 * 共享协议不能只停留在类型层：每个编排工作流 SHALL 真正声明其阶段的
 * 输入、所需能力、handoff、回执、确认门与重试策略。本模块是这些声明的单一源，
 * 供生成期渲染与校验使用。
 */

import {
    DEFAULT_RECEIPT_FIELDS,
    GATE_WHITELIST,
    GATE_WHITELIST_ANCHORS,
    type GateWhitelistId,
    type PhaseSpec,
    type WorkflowProtocol,
} from './protocol.js';
import { GATE_SKIP_IDS } from './delegation-contract.js';

/** 阶段输入契约的常用形态 */
const TOPIC_INPUT = { required: ['topic'], optional: ['constraints'] } as const;
const EXPLORATION_INPUT = { required: ['explorationFile', 'promptBaseline'] } as const;
const ARTIFACTS_INPUT = { required: ['changeName', 'artifacts'] } as const;

/** 阶段回执字段 */
const RECEIPT = { fields: DEFAULT_RECEIPT_FIELDS } as const;

/** 探索阶段 */
const EXPLORE_PHASE: PhaseSpec = {
    id: 'explore',
    input: TOPIC_INPUT,
    // 探索内联阶段不要求 delegate：strict 缺委派能力时仍可执行探索（交互门）。
    requiredCapabilities: ['skill-load', 'argument-passing', 'receipt', 'gate'],
    execution: { allowed: ['inline'] },
    handoff: ['explorationFile', 'promptBaseline', 'flowBaseline', 'flowBaselineConfirmed', 'paperTrailStatus', 'pendingSymbols'],
    receipt: RECEIPT,
    gate: { id: 'flow-final-confirmation', blocking: true },
    retry: { maxAttempts: 2, on: ['delegation-failed', 'handoff-incomplete'] },
};

/** 提案阶段 */
const PROPOSE_PHASE: PhaseSpec = {
    id: 'propose',
    input: EXPLORATION_INPUT,
    // 提案由主 agent 内联执行；兼容窗接受旧 subagent 回执并记 deprecation WARN。
    requiredCapabilities: ['skill-load', 'receipt'],
    execution: { allowed: ['inline', 'subagent'] },
    // `explorationFile` / `handoffPackPath` / `sourceFingerprint`：供父级以磁盘路径推进后续阶段，
    // MUST NOT 依赖会话缓存（见 spec host-orchestration / Shared workflow protocol）。
    handoff: ['changeName', 'artifacts', 'applyReady', 'explorationFile', 'handoffPackPath', 'sourceFingerprint'],
    receipt: RECEIPT,
    retry: { maxAttempts: 2, on: ['delegation-failed', 'artifact-invalid'] },
};

/** 验证阶段 */
const VERIFY_PHASE: PhaseSpec = {
    id: 'verify',
    input: ARTIFACTS_INPUT,
    // 只读验证内联优先：不要求 delegate；内联自证由固定清单 + 证据 + 报告承担可信度，
    // 故 independence 放宽为 self-allowed（self 记 WARN 且允许推进）。
    requiredCapabilities: ['skill-load', 'receipt', 'state'],
    execution: { allowed: ['inline', 'subagent'], independence: 'self-allowed' },
    handoff: ['score', 'deepReview', 'reviewSummary', 'reportPath'],
    receipt: RECEIPT,
    retry: { maxAttempts: 2, on: ['score-below-threshold'] },
};

/** 实现阶段 */
const APPLY_PHASE: PhaseSpec = {
    id: 'apply',
    input: { required: ['changeName'], optional: ['autoMode'] },
    // 实现由主 agent 单 agent 分批执行；兼容窗接受旧 subagent 回执。
    requiredCapabilities: ['receipt', 'state'],
    execution: { allowed: ['inline', 'subagent'] },
    // `confirmedGates`：交付桥确认后写入门账本的事实随回执交付（门承载语义，非阶段门 id）
    handoff: ['tasksCompleted', 'compileResult', 'receipts', 'confirmedGates'],
    receipt: RECEIPT,
    gate: { id: 'implementation-bridge', blocking: true },
    retry: { maxAttempts: 3, on: ['compile-failed', 'test-failed'] },
};

/** 归档阶段 */
const ARCHIVE_PHASE: PhaseSpec = {
    id: 'archive',
    input: { required: ['changeName'] },
    // 单变更归档由主代理内联执行（兼容窗接受 subagent 回执并记 deprecation WARN）。
    requiredCapabilities: ['receipt', 'state'],
    execution: { allowed: ['inline', 'subagent'] },
    handoff: ['archivePath', 'specsSynced'],
    receipt: RECEIPT,
    gate: { id: 'archive-confirmation', blocking: true },
    retry: { maxAttempts: 2, on: ['sync-failed'] },
};

/**
 * auto-workflow 专用实现阶段：模板声明 Phase 4 无用户确认，
 * 故 MUST NOT 声明阻塞门（与 `APPLY_PHASE` 的差异仅在于无门）。
 */
const AUTO_APPLY_PHASE: PhaseSpec = {
    id: 'apply',
    input: { required: ['changeName'], optional: ['autoMode'] },
    // 自动实现同样由主 agent 内联分批执行（兼容窗同 APPLY_PHASE）。
    requiredCapabilities: ['receipt', 'state'],
    execution: { allowed: ['inline', 'subagent'] },
    handoff: ['tasksCompleted', 'compileResult', 'receipts', 'confirmedGates'],
    receipt: RECEIPT,
    retry: { maxAttempts: 3, on: ['compile-failed', 'test-failed'] },
};

/** auto-workflow 专用归档阶段：模板声明自动归档无用户确认，MUST NOT 声明阻塞门 */
const AUTO_ARCHIVE_PHASE: PhaseSpec = {
    id: 'archive',
    input: { required: ['changeName'] },
    // 单变更归档内联优先（兼容窗同 ARCHIVE_PHASE）。
    requiredCapabilities: ['receipt', 'state'],
    execution: { allowed: ['inline', 'subagent'] },
    handoff: ['archivePath', 'specsSynced'],
    receipt: RECEIPT,
    retry: { maxAttempts: 2, on: ['sync-failed'] },
};

/**
 * 调试：根因调查阶段（含「诊断 + 方案」合并确认包与变更归属判定）
 *
 * 变更归属（`changeName` / `affectedSymbols`）在 2.4 之前判定，修复方案（`fixDecision`）
 * 在 2.4 的同一确认包内随根因一并确认 —— 故方案决策同属 investigate 的收束产物。
 */
const DEBUG_INVESTIGATE: PhaseSpec = {
    id: 'investigate',
    input: { required: ['bugDescription'] },
    // 交互阶段：诊断 + 方案确认由主代理内联完成，不要求 delegate。
    requiredCapabilities: ['skill-load', 'receipt', 'gate'],
    execution: { allowed: ['inline'] },
    handoff: ['rootCause', 'defectChain', 'changeName', 'affectedSymbols', 'fixDecision'],
    receipt: RECEIPT,
    gate: { id: 'diagnostic-confirmation', blocking: true },
    retry: { maxAttempts: 2, on: ['investigation-inconclusive'] },
};

/** 调试：修复阶段（方案判定 + 精准修复 + 内联回归测试调用） */
const DEBUG_FIX: PhaseSpec = {
    id: 'fix',
    input: { required: ['rootCause', 'defectChain', 'changeName', 'fixDecision'] },
    // 修复由主代理内联执行（修复 + 编译 + 范围内测试共用既有重试预算）；
    // 兼容窗保留 subagent 回执。
    requiredCapabilities: ['receipt', 'state'],
    execution: { allowed: ['inline', 'subagent'] },
    handoff: ['fixApplied', 'regressionTests'],
    receipt: RECEIPT,
    gate: { id: 'fix-option-confirmation', blocking: true, condition: 'multiple-fix-options' },
    retry: { maxAttempts: 3, on: ['compile-failed', 'test-failed'] },
};

/** 调试：验证收束阶段（编译/同步/验证/复查；无需求文档桥） */
const DEBUG_VERIFY_CLOSE: PhaseSpec = {
    id: 'verify-close',
    input: {
        required: ['changeName', 'fixApplied'],
        optional: ['regressionTests', 'compileResult'],
    },
    // 收束阶段由主代理内联；内部验证 / 复查同样内联（不再派生嵌套子代理），不要求阶段级 delegate。
    requiredCapabilities: ['skill-load', 'receipt', 'state'],
    execution: { allowed: ['inline'] },
    handoff: ['verificationResult', 'deepReview', 'archiveReady'],
    receipt: RECEIPT,
    retry: { maxAttempts: 2, on: ['score-below-threshold'] },
};

/** 迁移：源项目扫描阶段 */
const MIGRATION_SCAN: PhaseSpec = {
    id: 'source-scan',
    input: { required: ['sourceProject'] },
    // source-scan 由主代理内联执行；超出上下文阈值时由模板声明降级为子代理 + WARN。
    requiredCapabilities: ['skill-load', 'receipt'],
    execution: { allowed: ['inline', 'subagent'] },
    handoff: ['featureMap', 'coreFeatureList'],
    receipt: RECEIPT,
    retry: { maxAttempts: 2, on: ['delegation-failed'] },
};

/** 迁移：实现与复查阶段（Phase 3 实现保留子代理，Phase 4 复查内联） */
const MIGRATION_CHECK: PhaseSpec = {
    id: 'implement-and-check',
    input: { required: ['changeName', 'coreFeatureList'] },
    // Phase 4 复查内联；Phase 3 实现的子代理语义由模板声明（不进入阶段级 requiredCapabilities）。
    requiredCapabilities: ['receipt', 'state'],
    execution: { allowed: ['inline', 'subagent'] },
    handoff: ['implementation', 'migrationReport', 'fixes'],
    receipt: RECEIPT,
    gate: { id: 'implementation-bridge', blocking: true },
    retry: { maxAttempts: 3, on: ['compile-failed', 'p0-found', 'p1-found'] },
};

/** 各编排工作流的协议实例 */
export const WORKFLOW_PROTOCOLS: Readonly<Record<string, WorkflowProtocol>> = {
    workflow: {
        workflowId: 'workflow',
        // 交付桥合并（U8）：验证阶段无阻塞门，文档选项由 APPLY 的 implementation-bridge 承载
        phases: [EXPLORE_PHASE, PROPOSE_PHASE, VERIFY_PHASE, APPLY_PHASE, ARCHIVE_PHASE],
    },
    'auto-workflow': {
        workflowId: 'auto-workflow',
        // 自动管线：需求文档桥已移除；VERIFY / APPLY / ARCHIVE 均无阻塞门
        phases: [EXPLORE_PHASE, PROPOSE_PHASE, VERIFY_PHASE, AUTO_APPLY_PHASE, AUTO_ARCHIVE_PHASE],
    },
    debug: {
        workflowId: 'debug',
        phases: [DEBUG_INVESTIGATE, DEBUG_FIX, DEBUG_VERIFY_CLOSE],
    },
    migration: {
        workflowId: 'migration',
        phases: [MIGRATION_SCAN, MIGRATION_CHECK],
    },
};

/** 取得工作流协议（不存在返回 undefined） */
export function getWorkflowProtocol(workflowId: string): WorkflowProtocol | undefined {
    return WORKFLOW_PROTOCOLS[workflowId];
}

/**
 * 阶段门 id → 白名单类别（锚点映射）。
 *
 * `diagnostic-confirmation` / `fix-option-confirmation` 挂在**需求澄清**类别下
 * （调试的诊断结论与修复方案选择属「需求 / 方案歧义」），其余阶段门各自挂同名类别。
 * 需求文档桥已整体移除。该映射只用于可校验对齐，
 * MUST NOT 被理解为新增阶段门。
 */
export const PHASE_GATE_CATEGORY: Readonly<Record<string, GateWhitelistId>> = {
    'flow-final-confirmation': 'flow-final-confirmation',
    'implementation-bridge': 'implementation-bridge',
    'archive-confirmation': 'archive-confirmation',
    'diagnostic-confirmation': 'requirement-clarification',
    'fix-option-confirmation': 'requirement-clarification',
    // spec-apply 的设计确认门：技能内动作，按「方案歧义」归类
    'design-confirmation': 'requirement-clarification',
};

/**
 * 审计「协议阶段门 ⊆ 白名单锚点」对齐关系。
 *
 * @returns 违规描述列表（空数组即对齐）；供生成期测试断言，MUST NOT 在运行期抛错
 */
export function auditGateWhitelistAlignment(
    protocols: Readonly<Record<string, WorkflowProtocol>> = WORKFLOW_PROTOCOLS,
    skipIds: readonly string[] = GATE_SKIP_IDS
): string[] {
    const violations: string[] = [];
    for (const [workflowId, protocol] of Object.entries(protocols)) {
        for (const phase of protocol.phases) {
            const gateId = phase.gate?.id;
            if (gateId === undefined) {
                continue;
            }
            if (!GATE_WHITELIST_ANCHORS.includes(gateId)) {
                violations.push(`${workflowId}/${phase.id}：门 ${gateId} 不在白名单锚点集合内`);
                continue;
            }
            const category = PHASE_GATE_CATEGORY[gateId];
            if (category === undefined) {
                violations.push(`${workflowId}/${phase.id}：门 ${gateId} 缺少白名单类别映射`);
                continue;
            }
            const entry = GATE_WHITELIST.find((item) => item.id === category);
            if (entry === undefined || !entry.anchors.includes(gateId)) {
                violations.push(`${workflowId}/${phase.id}：门 ${gateId} 未挂在其类别的锚点集合内`);
            }
        }
    }
    // 账本 id（门承载语义）同样必须能在白名单中找到归宿，否则「白名单外不可阻断」
    // 与账本跳过语义会互相矛盾。
    for (const gateId of skipIds) {
        if (!GATE_WHITELIST_ANCHORS.includes(gateId)) {
            violations.push(`gate-skip：门 ${gateId} 不在白名单锚点集合内`);
            continue;
        }
        const category = PHASE_GATE_CATEGORY[gateId];
        if (category === undefined) {
            violations.push(`gate-skip：门 ${gateId} 缺少白名单类别映射`);
            continue;
        }
        const entry = GATE_WHITELIST.find((item) => item.id === category);
        if (entry === undefined || !entry.anchors.includes(gateId)) {
            violations.push(`gate-skip：门 ${gateId} 未挂在其类别的锚点集合内`);
        }
    }
    return violations;
}
