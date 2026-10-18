/**
 * 宿主编排层统一导出（变更 add-host-orchestration-adapters）。
 */

export {
    CAPABILITY_ORDER,
    DEFAULT_RECEIPT_FIELDS,
    protocolDeclaresCapabilities,
    validateReceipt,
    type CapabilityId,
    type GateSpec,
    type PhaseInput,
    type PhaseSpec,
    type Receipt,
    type ReceiptSpec,
    type ReceiptStatus,
    type ReceiptValidation,
    type RetryPolicy,
    type WorkflowProtocol,
} from './protocol.js';

export {
    WORKFLOW_PROTOCOLS,
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
