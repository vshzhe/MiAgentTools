/**
 * 宿主编排层统一导出（变更 add-host-orchestration-adapters）。
 */

export {
    CAPABILITY_ORDER,
    DEFAULT_RECEIPT_FIELDS,
    GATE_CONDITION_IDS,
    GATE_WHITELIST,
    GATE_WHITELIST_ANCHORS,
    PERSISTED_REQUIREMENT_DOC_STATUSES,
    REQUIREMENT_DOC_STATUS_FIELD,
    REQUIREMENT_DOC_STATUS_IO_ATTEMPTS,
    isWhitelistedGate,
    normalizeRequirementDocStatus,
    protocolDeclaresCapabilities,
    validateReceipt,
    type CapabilityId,
    type GateConditionId,
    type GateSpec,
    type GateWhitelistEntry,
    type GateWhitelistId,
    type PhaseInput,
    type PhaseSpec,
    type Receipt,
    type ReceiptSpec,
    type ReceiptStatus,
    type ReceiptValidation,
    type RequirementDocStatus,
    type RetryPolicy,
    type WorkflowProtocol,
} from './protocol.js';

export {
    PHASE_GATE_CATEGORY,
    WORKFLOW_PROTOCOLS,
    auditGateWhitelistAlignment,
    getWorkflowProtocol,
} from './workflows.js';

export {
    HOST_PROFILES,
    PI_STRICT_PROFILE,
    negotiateCapabilities,
    negotiationForHost,
    phaseCapabilitiesSatisfied,
    type CapabilityNegotiation,
    type HostCapabilityProfile,
    type HostId,
    type NativeMechanisms,
    type OrchestrationMode,
} from './hosts.js';

export {
    CONDITIONAL_DELEGATIONS,
    ORCHESTRATING_WORKFLOW_IDS,
    ORCHESTRATION_DELEGATIONS,
    adaptSkillContentForHost,
    isOrchestratingWorkflow,
    renderHostOrchestrationSection,
} from './render.js';

export {
    renderDelegate,
    renderDelegationList,
    renderLoadSkill,
    type DelegateAction,
    type LoadSkillAction,
} from './actions.js';

export {
    TRANSITION_BLOCKERS,
    evaluatePhaseTransition,
    type PhaseTransitionInput,
    type PhaseTransitionResult,
} from './transition.js';
