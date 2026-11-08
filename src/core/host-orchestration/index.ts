/**
 * 宿主编排层统一导出（变更 add-host-orchestration-adapters）。
 */

export {
    CAPABILITY_ORDER,
    DEFAULT_RECEIPT_FIELDS,
    EXECUTION_MODES,
    GATE_CONDITION_IDS,
    GATE_WHITELIST,
    GATE_WHITELIST_ANCHORS,
    HANDOFF_PACK_SECTION_MAX_LINES,
    INDEPENDENCE_VALUES,
    STAGE_ENVELOPE_MAX_BYTES,
    STAGE_RECEIPT_MAX_BYTES,
    STAGE_RECEIPT_MAX_LINES,
    isWhitelistedGate,
    protocolDeclaresCapabilities,
    validateReceipt,
    type CapabilityId,
    type ExecutionMode,
    type GateConditionId,
    type GateSpec,
    type GateWhitelistEntry,
    type GateWhitelistId,
    type Independence,
    type PhaseExecutionSpec,
    type PhaseInput,
    type PhaseSpec,
    type Receipt,
    type ReceiptSpec,
    type ReceiptStatus,
    type ReceiptUsage,
    type ReceiptValidation,
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
    DEFAULT_SURFACE,
    SURFACE_IDS,
    negotiateCapabilities,
    negotiationForHost,
    phaseCapabilitiesSatisfied,
    type CapabilityNegotiation,
    type HostCapabilityProfile,
    type HostId,
    type NativeMechanisms,
    type NegotiationOptions,
    type OrchestrationMode,
    type SurfaceId,
} from './hosts.js';

export {
    CONDITIONAL_DELEGATIONS,
    DELEGATION_PARAMETERS,
    ORCHESTRATING_WORKFLOW_IDS,
    ORCHESTRATION_DELEGATIONS,
    adaptSkillContentForHost,
    defaultOrchestrationDelegations,
    deriveOrchestrationDelegations,
    isOrchestratingWorkflow,
    parseDelegationTargets,
    renderHostOrchestrationSection,
    type OrchestrationDelegations,
    type OrchestrationTemplateInput,
} from './render.js';

export {
    DELEGATION_MODES,
    DELEGATION_MODE_PARAM,
    GATE_SKIP_IDS,
    GATE_SKIP_PARAM,
    LEGACY_AUTO_MODE_PARAM,
    renderDelegationModeContract,
    renderDelegationModeOption,
    renderDelegationModeOptions,
    renderGateSkipOption,
    resolveDelegationContract,
    type DelegationContract,
    type DelegationMode,
    type GateSkipId,
} from './delegation-contract.js';

export {
    INTERACTIVE_STAGE_WORKFLOW_IDS,
    isInteractiveStage,
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

export {
    GATE_LEDGER_HEADER_ROW,
    GATE_LEDGER_SECTION,
    GATE_LEDGER_SEPARATOR_ROW,
    HANDOFF_PACK_FILE_NAME,
    PIPELINE_WORKSPACE_PREFIX,
    PIPELINE_WORKSPACE_ROOT,
    gateLedgerPath,
    isGateSkipId,
    parseGateLedger,
    renderGateLedgerEntry,
    renderGateLedgerSection,
    resolveGateLedgerConfirmation,
    type GateLedger,
    type GateLedgerConfirmation,
    type GateLedgerEntry,
} from './gate-ledger.js';
