/**
 * 阶段推进判定（变更 add-host-orchestration-adapters）。
 *
 * 阶段推进 MUST 以结构化回执与门状态为依据，而不是以模型自然语言宣称完成为依据。
 * 未确认的门、缺失或未通过校验的回执、缺失的必需能力都会阻止推进。
 */

import type { CapabilityNegotiation } from './hosts.js';
import { phaseCapabilitiesSatisfied } from './hosts.js';
import { GATE_WHITELIST, validateReceipt, type CapabilityId, type PhaseSpec, type Receipt } from './protocol.js';
import { PHASE_GATE_CATEGORY } from './workflows.js';

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
    /**
     * 条件门取值（门 `condition` → 是否适用）。
     *
     * 仅对声明了 `condition` 的门生效；`false` = 门不适用（跳过门确认要求），
     * `true` 或键缺失 = 门适用（fail-safe）。
     */
    gateConditions?: Record<string, boolean>;
}

/** 阶段推进判定结果 */
export interface PhaseTransitionResult {
    /** 是否允许推进到下一阶段 */
    advance: boolean;
    /** 阻塞原因清单（advance 为 true 时为空） */
    blockedBy: string[];
    /** 缺失的能力 */
    missingCapabilities: CapabilityId[];
    /** 非阻断告警（headless 下条件门放行 / 记录决策等） */
    warnings: string[];
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
 *
 * 条件门语义（`GateSpec.condition`）：
 *   - 未声明 `condition` → 保持既有静态门行为（`blocking ?? true` + `gateConfirmed`）；
 *   - `gateConditions[condition] === false` → 该门不适用，跳过门确认要求
 *     （即使 `gateConfirmed` 为 false 也不以 `gate-unconfirmed` 阻塞）；
 *   - `=== true` 或该键未提供 → 门适用，仍按 `gateConfirmed` 要求确认（fail-safe）。
 *
 * surface / 能力兜底（变更 fix-mode-delegation-host-parity）：协商结果缺失 `gate` 能力
 * （headless）时，`conditional: true` 的白名单类别门（经 `PHASE_GATE_CATEGORY` 映射）
 * 记录决策与 WARN 并继续；不可豁免门保持阻塞并报告缺少交互式确认能力。
 * 「条件 / 不可豁免」判定取自 `GATE_WHITELIST` 条目的 `conditional`，
 * MUST NOT 以 `GateSpec.condition`（门是否适用的业务条件）代替。
 */
export function evaluatePhaseTransition(input: PhaseTransitionInput): PhaseTransitionResult {
    const blockedBy: string[] = [];
    const warnings: string[] = [];

    // 1. 必需能力（strict 缺能阻断；degraded 已在协商层标记）
    const capability = phaseCapabilitiesSatisfied(input.negotiation, input.phase.requiredCapabilities);
    if (!capability.runnable && input.negotiation.mode === 'strict') {
        blockedBy.push(TRANSITION_BLOCKERS.capabilities);
    }

    // 2. 确认门（未确认不得推进；条件为 false 时该门不适用）
    const gate = input.phase.gate;
    const gateApplicable =
        gate !== undefined &&
        (gate.condition === undefined || input.gateConditions?.[gate.condition] !== false);
    if (gate && gateApplicable && (gate.blocking ?? true) && !input.gateConfirmed) {
        const gateCapable = input.negotiation.available.includes('gate');
        const category = PHASE_GATE_CATEGORY[gate.id];
        const whitelistEntry =
            category === undefined ? undefined : GATE_WHITELIST.find((entry) => entry.id === category);
        if (!gateCapable && whitelistEntry?.conditional === true) {
            // headless 条件门：记录决策并继续（不因 gate-unconfirmed 阻塞）
            warnings.push(
                `WARN: 运行表面缺少交互式 gate 能力，条件门 ${gate.id}（类别 ${category}）记录决策并继续`
            );
        } else {
            blockedBy.push(TRANSITION_BLOCKERS.gate);
            if (!gateCapable) {
                warnings.push(
                    `缺少交互式确认能力：不可豁免门 ${gate.id} 必须以 status=blocked 回执中止（MUST NOT 静默跳过）`
                );
            }
        }
    }

    // 3. 回执校验（缺失或不通过即阻塞）
    //    `confirmedGates`（门账本回执镜像）形状 / 取值非法同样归入 invalid-receipt：
    //    非法说明写入方违约（伪造 / 版本不一致），MUST NOT 忽略后继续推进；
    //    字段缺失不构成非法（缺失即「无账本」，门照常触发，属 fail-safe 方向）。
    const receiptCheck = validateReceipt(input.receipt ?? {}, input.phase.receipt);
    if (!receiptCheck.valid) {
        blockedBy.push(TRANSITION_BLOCKERS.receipt);
        if (receiptCheck.reason?.includes('confirmedGates')) {
            warnings.push(
                `WARN: 回执 confirmedGates 校验失败（${receiptCheck.reason}），以 invalid-receipt 阻断推进`
            );
        }
    }

    return {
        advance: blockedBy.length === 0,
        blockedBy,
        missingCapabilities: capability.missing,
        warnings,
    };
}
