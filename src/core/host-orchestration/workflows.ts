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
    type GateSpec,
    type GateWhitelistId,
    type PhaseSpec,
    type WorkflowProtocol,
} from './protocol.js';

/** 阶段输入契约的常用形态 */
const TOPIC_INPUT = { required: ['topic'], optional: ['constraints'] } as const;
const EXPLORATION_INPUT = { required: ['explorationFile', 'promptBaseline'] } as const;
const ARTIFACTS_INPUT = { required: ['changeName', 'artifacts'] } as const;

/** 阶段回执字段 */
const RECEIPT = { fields: DEFAULT_RECEIPT_FIELDS } as const;

/** 状态回执：默认回执字段 + 需求文档状态 —— 验证阶段与 debug verify-close 共用同一“桥结果随回执交付”契约 */
const STATUS_RECEIPT = {
    fields: [...DEFAULT_RECEIPT_FIELDS, 'requirementDocStatus'],
} as const;

/** 探索阶段 */
const EXPLORE_PHASE: PhaseSpec = {
    id: 'explore',
    input: TOPIC_INPUT,
    requiredCapabilities: ['skill-load', 'argument-passing', 'delegate', 'receipt', 'gate'],
    handoff: ['explorationFile', 'promptBaseline', 'flowBaseline', 'pendingSymbols'],
    receipt: RECEIPT,
    gate: { id: 'flow-final-confirmation', blocking: true },
    retry: { maxAttempts: 2, on: ['delegation-failed', 'handoff-incomplete'] },
};

/** 提案阶段 */
const PROPOSE_PHASE: PhaseSpec = {
    id: 'propose',
    input: EXPLORATION_INPUT,
    requiredCapabilities: ['skill-load', 'delegate', 'receipt'],
    handoff: ['changeName', 'artifacts', 'applyReady'],
    receipt: RECEIPT,
    retry: { maxAttempts: 2, on: ['delegation-failed', 'artifact-invalid'] },
};

/** 验证阶段 */
const VERIFY_PHASE: PhaseSpec = {
    id: 'verify',
    input: ARTIFACTS_INPUT,
    requiredCapabilities: ['skill-load', 'delegate', 'receipt', 'state'],
    handoff: ['score', 'deepReview', 'requirementDoc', 'requirementDocStatus'],
    receipt: STATUS_RECEIPT,
    retry: { maxAttempts: 2, on: ['score-below-threshold'] },
};

/**
 * 需求文档桥门（唯一取值锚定在 `requirement-clarification` 白名单类别内，5 类不变）。
 *
 * 属可条件豁免类别：阶段 MUST NOT 因此把 `gate` 加入 `requiredCapabilities`，
 * 否则 headless 下会先以缺失能力阻断，与门兜底矩阵冲突。
 */
const DOC_BRIDGE_GATE: GateSpec = { id: 'requirement-doc-bridge', blocking: true };

/**
 * 带需求文档桥的验证阶段（workflow / auto-workflow 共用）。
 *
 * 两编排链的模板正文本就声明「验证阶段收束于需求文档桥」，协议此前缺失该门 →
 * 协议与模板漂移；此处补齐，MUST NOT 改变 `GateSpec` 形状与条件门语义。
 */
const VERIFY_WITH_BRIDGE: PhaseSpec = {
    ...VERIFY_PHASE,
    gate: DOC_BRIDGE_GATE,
};

/** 实现阶段 */
const APPLY_PHASE: PhaseSpec = {
    id: 'apply',
    input: { required: ['changeName'], optional: ['autoMode', 'requirementDocStatus'] },
    requiredCapabilities: ['delegate', 'receipt', 'state'],
    handoff: ['tasksCompleted', 'compileResult', 'receipts', 'requirementDocStatus'],
    receipt: RECEIPT,
    gate: { id: 'implementation-bridge', blocking: true },
    retry: { maxAttempts: 3, on: ['compile-failed', 'test-failed'] },
};

/** 归档阶段 */
const ARCHIVE_PHASE: PhaseSpec = {
    id: 'archive',
    input: { required: ['changeName'], optional: ['requirementDocStatus'] },
    requiredCapabilities: ['delegate', 'receipt', 'state'],
    handoff: ['archivePath', 'specsSynced', 'requirementDocAligned'],
    receipt: RECEIPT,
    gate: { id: 'archive-confirmation', blocking: true },
    retry: { maxAttempts: 2, on: ['sync-failed'] },
};

/**
 * auto-workflow 专用实现阶段：模板声明 Phase 4 除已完成的需求文档桥外无用户确认，
 * 故 MUST NOT 声明阻塞门（与 `APPLY_PHASE` 的差异仅在于无门）。
 */
const AUTO_APPLY_PHASE: PhaseSpec = {
    id: 'apply',
    input: { required: ['changeName'], optional: ['autoMode', 'requirementDocStatus'] },
    requiredCapabilities: ['delegate', 'receipt', 'state'],
    handoff: ['tasksCompleted', 'compileResult', 'receipts', 'requirementDocStatus'],
    receipt: RECEIPT,
    retry: { maxAttempts: 3, on: ['compile-failed', 'test-failed'] },
};

/** auto-workflow 专用归档阶段：模板声明自动归档无用户确认，MUST NOT 声明阻塞门 */
const AUTO_ARCHIVE_PHASE: PhaseSpec = {
    id: 'archive',
    input: { required: ['changeName'], optional: ['requirementDocStatus'] },
    requiredCapabilities: ['delegate', 'receipt', 'state'],
    handoff: ['archivePath', 'specsSynced', 'requirementDocAligned'],
    receipt: RECEIPT,
    retry: { maxAttempts: 2, on: ['sync-failed'] },
};

/** 调试：根因调查阶段（含诊断确认包与变更归属判定） */
const DEBUG_INVESTIGATE: PhaseSpec = {
    id: 'investigate',
    input: { required: ['bugDescription'] },
    requiredCapabilities: ['skill-load', 'delegate', 'receipt', 'gate'],
    handoff: ['rootCause', 'defectChain', 'changeName', 'affectedSymbols'],
    receipt: RECEIPT,
    gate: { id: 'diagnostic-confirmation', blocking: true },
    retry: { maxAttempts: 2, on: ['investigation-inconclusive'] },
};

/** 调试：修复阶段（方案判定 + 精准修复 + 回归测试委派） */
const DEBUG_FIX: PhaseSpec = {
    id: 'fix',
    input: { required: ['rootCause', 'defectChain', 'changeName', 'fixDecision'] },
    requiredCapabilities: ['delegate', 'receipt', 'state'],
    handoff: ['fixApplied', 'regressionTests'],
    receipt: RECEIPT,
    gate: { id: 'fix-option-confirmation', blocking: true, condition: 'multiple-fix-options' },
    retry: { maxAttempts: 3, on: ['compile-failed', 'test-failed'] },
};

/** 调试：验证收束阶段（编译/同步/验证/复查/需求文档桥） */
const DEBUG_VERIFY_CLOSE: PhaseSpec = {
    id: 'verify-close',
    input: {
        required: ['changeName', 'fixApplied'],
        optional: ['regressionTests', 'compileResult'],
    },
    requiredCapabilities: ['skill-load', 'delegate', 'receipt', 'state'],
    handoff: ['verificationResult', 'deepReview', 'requirementDocStatus', 'archiveReady'],
    receipt: STATUS_RECEIPT,
    // 模板 7.3 已含「需求文档桥（⛔ GATE 业务门，强制）」；协议补齐同一门（阶段门预算仍为 1）
    gate: DOC_BRIDGE_GATE,
    retry: { maxAttempts: 2, on: ['score-below-threshold'] },
};

/** 迁移：源项目扫描阶段 */
const MIGRATION_SCAN: PhaseSpec = {
    id: 'source-scan',
    input: { required: ['sourceProject'] },
    requiredCapabilities: ['skill-load', 'delegate', 'receipt'],
    handoff: ['featureMap', 'coreFeatureList'],
    receipt: RECEIPT,
    retry: { maxAttempts: 2, on: ['delegation-failed'] },
};

/** 迁移：实现与复查阶段 */
const MIGRATION_CHECK: PhaseSpec = {
    id: 'implement-and-check',
    input: { required: ['changeName', 'coreFeatureList'] },
    requiredCapabilities: ['delegate', 'receipt', 'state'],
    handoff: ['implementation', 'migrationReport', 'fixes'],
    receipt: RECEIPT,
    gate: { id: 'implementation-bridge', blocking: true },
    retry: { maxAttempts: 3, on: ['compile-failed', 'p0-found', 'p1-found'] },
};

/** 各编排工作流的协议实例 */
export const WORKFLOW_PROTOCOLS: Readonly<Record<string, WorkflowProtocol>> = {
    workflow: {
        workflowId: 'workflow',
        phases: [EXPLORE_PHASE, PROPOSE_PHASE, VERIFY_WITH_BRIDGE, APPLY_PHASE, ARCHIVE_PHASE],
    },
    'auto-workflow': {
        workflowId: 'auto-workflow',
        // 自动管线：APPLY / ARCHIVE 无阻塞门；VERIFY 的唯一阻塞门是需求文档桥
        phases: [EXPLORE_PHASE, PROPOSE_PHASE, VERIFY_WITH_BRIDGE, AUTO_APPLY_PHASE, AUTO_ARCHIVE_PHASE],
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
 * `diagnostic-confirmation` / `fix-option-confirmation` / `requirement-doc-bridge`
 * 挂在**需求澄清**类别下（调试的诊断结论与修复方案选择、以及「是否生成评审用需求文档」
 * 的交付范围选择都属「需求 / 方案歧义」），其余阶段门各自挂同名类别。
 * 该映射只用于可校验对齐，MUST NOT 被理解为新增阶段门。
 */
export const PHASE_GATE_CATEGORY: Readonly<Record<string, GateWhitelistId>> = {
    'flow-final-confirmation': 'flow-final-confirmation',
    'implementation-bridge': 'implementation-bridge',
    'archive-confirmation': 'archive-confirmation',
    'diagnostic-confirmation': 'requirement-clarification',
    'fix-option-confirmation': 'requirement-clarification',
    'requirement-doc-bridge': 'requirement-clarification',
};

/**
 * 审计「协议阶段门 ⊆ 白名单锚点」对齐关系。
 *
 * @returns 违规描述列表（空数组即对齐）；供生成期测试断言，MUST NOT 在运行期抛错
 */
export function auditGateWhitelistAlignment(): string[] {
    const violations: string[] = [];
    for (const [workflowId, protocol] of Object.entries(WORKFLOW_PROTOCOLS)) {
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
    return violations;
}
