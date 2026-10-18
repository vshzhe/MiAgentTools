/**
 * 阶段推进判定（变更 add-host-orchestration-adapters）。
 *
 * 阶段推进 MUST 以结构化回执与门状态为依据，而不是以模型自然语言宣称完成为依据。
 * 未确认的门、缺失或未通过校验的回执、缺失的必需能力都会阻止推进。
 */

import type { CapabilityNegotiation } from './hosts.js';
import { phaseCapabilitiesSatisfied } from './hosts.js';
import { validateReceipt, type CapabilityId, type PhaseSpec, type Receipt } from './protocol.js';

/** 阶段推进输入 */
export interface PhaseTransitionInput {
    /** 阶段规格 */
    phase: PhaseSpec;
    /** 阶段回执（可缺失 = 仅自然语言宣称完成） */
    receipt?: Partial<Receipt>;
    /** 该阶段的确认门是否已获用户确认（无门时为 true） */
    gateConfirmed: boolean;
    /** 当前宿主能力协商结果 */
    negotiation: CapabilityNegotiation;
}

/** 阶段推进判定结果 */
export interface PhaseTransitionResult {
    /** 是否允许推进到下一阶段 */
    advance: boolean;
    /** 阻塞原因清单（advance 为 true 时为空） */
    blockedBy: string[];
    /** 缺失的能力 */
    missingCapabilities: CapabilityId[];
}

/** 阻止推进的原因归类 */
export const TRANSITION_BLOCKERS = {
    capabilities: 'missing-capabilities',
    gate: 'gate-unconfirmed',
    receipt: 'invalid-receipt',
} as const;

/**
 * 判定某阶段是否可推进到下一阶段。
 *
 * 依次检查：宿主能力 → 确认门 → 回执。任一不满足即阻塞。
 */
export function evaluatePhaseTransition(input: PhaseTransitionInput): PhaseTransitionResult {
    const blockedBy: string[] = [];

    // 1. 必需能力（strict 缺能阻断；degraded 已在协商层标记）
    const capability = phaseCapabilitiesSatisfied(input.negotiation, input.phase.requiredCapabilities);
    if (!capability.runnable && input.negotiation.mode === 'strict') {
        blockedBy.push(TRANSITION_BLOCKERS.capabilities);
    }

    // 2. 确认门（未确认不得推进）
    if (input.phase.gate && (input.phase.gate.blocking ?? true) && !input.gateConfirmed) {
        blockedBy.push(TRANSITION_BLOCKERS.gate);
    }

    // 3. 回执校验（缺失或不通过即阻塞）
    const receiptCheck = validateReceipt(input.receipt ?? {}, input.phase.receipt);
    if (!receiptCheck.valid) {
        blockedBy.push(TRANSITION_BLOCKERS.receipt);
    }

    return {
        advance: blockedBy.length === 0,
        blockedBy,
        missingCapabilities: capability.missing,
    };
}
