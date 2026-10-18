/**
 * 具体工作流协议实例（变更 add-host-orchestration-adapters）。
 *
 * 共享协议不能只停留在类型层：每个编排工作流 SHALL 真正声明其阶段的
 * 输入、所需能力、handoff、回执、确认门与重试策略。本模块是这些声明的单一源，
 * 供生成期渲染与校验使用。
 */

import { DEFAULT_RECEIPT_FIELDS, type PhaseSpec, type WorkflowProtocol } from './protocol.js';

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
    handoff: ['score', 'deepReview', 'requirementDoc'],
    receipt: RECEIPT,
    retry: { maxAttempts: 2, on: ['score-below-threshold'] },
};

/** 实现阶段 */
const APPLY_PHASE: PhaseSpec = {
    id: 'apply',
    input: { required: ['changeName'], optional: ['autoMode'] },
    requiredCapabilities: ['delegate', 'receipt', 'state'],
    handoff: ['tasksCompleted', 'compileResult', 'receipts'],
    receipt: RECEIPT,
    gate: { id: 'implementation-bridge', blocking: true },
    retry: { maxAttempts: 3, on: ['compile-failed', 'test-failed'] },
};

/** 归档阶段 */
const ARCHIVE_PHASE: PhaseSpec = {
    id: 'archive',
    input: { required: ['changeName'] },
    requiredCapabilities: ['delegate', 'receipt', 'state'],
    handoff: ['archivePath', 'specsSynced', 'requirementDocAligned'],
    receipt: RECEIPT,
    gate: { id: 'archive-confirmation', blocking: true },
    retry: { maxAttempts: 2, on: ['sync-failed'] },
};

/** 调试：根因调查阶段 */
const DEBUG_INVESTIGATE: PhaseSpec = {
    id: 'investigate',
    input: { required: ['bugDescription'] },
    requiredCapabilities: ['skill-load', 'delegate', 'receipt', 'gate'],
    handoff: ['rootCause', 'affectedSymbols'],
    receipt: RECEIPT,
    gate: { id: 'root-cause-confirmation', blocking: true },
    retry: { maxAttempts: 2, on: ['investigation-inconclusive'] },
};

/** 调试：修复与验证阶段 */
const DEBUG_FIX: PhaseSpec = {
    id: 'fix-verify',
    input: { required: ['rootCause', 'changeName'] },
    requiredCapabilities: ['delegate', 'receipt', 'state'],
    handoff: ['fixApplied', 'regressionTests', 'verificationResult'],
    receipt: RECEIPT,
    retry: { maxAttempts: 3, on: ['compile-failed', 'test-failed'] },
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
        phases: [EXPLORE_PHASE, PROPOSE_PHASE, VERIFY_PHASE, APPLY_PHASE, ARCHIVE_PHASE],
    },
    'auto-workflow': {
        workflowId: 'auto-workflow',
        phases: [EXPLORE_PHASE, PROPOSE_PHASE, VERIFY_PHASE, APPLY_PHASE, ARCHIVE_PHASE],
    },
    debug: {
        workflowId: 'debug',
        phases: [DEBUG_INVESTIGATE, DEBUG_FIX],
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
