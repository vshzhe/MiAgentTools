/**
 * 宿主能力档案与协商（变更 add-host-orchestration-adapters）。
 *
 * 每个宿主声明其可提供的编排能力，以及把共享协议映射到哪些原生机制。
 * 协商结果决定 strict / degraded：strict 缺能 MUST 阻断，degraded 由用户显式选择。
 */

import {
    CAPABILITY_ORDER,
    type CapabilityId,
} from './protocol.js';

/** 宿主标识 */
export type HostId = 'claude' | 'opencode' | 'pi';

/** 编排运行模式 */
export type OrchestrationMode = 'strict' | 'degraded';

/** 宿主原生机制映射（用于文档与适配器渲染） */
export interface NativeMechanisms {
    /** 技能加载机制描述 */
    skillLoading: string;
    /** 阶段委派机制描述 */
    delegation: string;
    /** 确认门机制描述 */
    gate: string;
}

/** 宿主能力档案 */
export interface HostCapabilityProfile {
    host: HostId;
    /** 该宿主原生提供的能力 */
    capabilities: readonly CapabilityId[];
    /** 原生机制映射 */
    native: NativeMechanisms;
    /** 该档案成立的前置条件描述（如「Pi strict 需安装 Runtime Extension」） */
    precondition?: string;
}

/** 各宿主的原生能力档案 */
export const HOST_PROFILES: Readonly<Record<HostId, HostCapabilityProfile>> = {
    claude: {
        host: 'claude',
        capabilities: ['skill-load', 'argument-passing', 'delegate', 'receipt', 'gate', 'state'],
        native: {
            skillLoading: 'Skill 工具',
            delegation: 'Skill / Agent 子代理',
            gate: 'AskUserQuestion / hooks',
        },
    },
    opencode: {
        host: 'opencode',
        capabilities: ['skill-load', 'argument-passing', 'delegate', 'receipt', 'gate', 'state'],
        native: {
            skillLoading: 'skill 工具',
            delegation: 'subagent + 项目级 agent',
            gate: 'question / permissions / primary agent',
        },
    },
    pi: {
        host: 'pi',
        capabilities: ['skill-load', 'argument-passing'],
        native: {
            skillLoading: '/skill:name 与 read SKILL.md',
            delegation: '无（需安装 Runtime Extension）',
            gate: '无（需安装 Runtime Extension）',
        },
        precondition: '严格编排需安装 Pi Runtime Extension（默认 @tintinweb/pi-subagents）',
    },
};

/** Pi strict 档案：安装并通过能力检测后的完整能力 */
export const PI_STRICT_PROFILE: HostCapabilityProfile = {
    host: 'pi',
    capabilities: ['skill-load', 'argument-passing', 'delegate', 'receipt', 'gate', 'state'],
    native: {
        skillLoading: '/skill:name 与 read SKILL.md',
        delegation: 'Runtime Extension 的 Agent / workflow 工具',
        gate: 'Runtime Extension 的 workflow / gate 工具',
    },
    precondition: '已安装兼容的 Pi Runtime Extension',
};

/** 能力协商结果 */
export interface CapabilityNegotiation {
    host: HostId;
    mode: OrchestrationMode;
    /** 宿主实际具备的能力 */
    available: CapabilityId[];
    /** 缺失的能力 */
    missing: CapabilityId[];
    /** 原生机制映射 */
    native: NativeMechanisms;
    /** 说明（degraded 限制或 strict 前置条件） */
    notes: string[];
}

/**
 * 协商某宿主在指定模式下的编排能力。
 *
 * @param host - 宿主标识
 * @param mode - 期望模式（strict 缺能时由调用方决定是否降级）
 * @param capabilitySet - 该运行时实际具备的能力（Pi strict 由 Runtime 探测提供；缺省用基础档案）
 */
export function negotiateCapabilities(
    host: HostId,
    mode: OrchestrationMode,
    capabilitySet?: readonly CapabilityId[]
): CapabilityNegotiation {
    const base = host === 'pi' && mode === 'strict' ? PI_STRICT_PROFILE : HOST_PROFILES[host];
    const available = new Set<CapabilityId>(capabilitySet ?? base.capabilities);
    const missing = CAPABILITY_ORDER.filter((c) => !available.has(c));
    const notes: string[] = [];
    if (mode === 'degraded' && missing.length > 0) {
        notes.push(`degraded 模式不提供：${missing.join(', ')}`);
        notes.push('本地执行 MUST NOT 被标记为委派完成、子代理回执或严格 gate 通过');
    }
    if (base.precondition) {
        notes.push(base.precondition);
    }
    return {
        host,
        mode,
        available: [...available],
        missing,
        native: base.native,
        notes,
    };
}

/**
 * 按目标工具解析编排能力协商。
 *
 * codex 为 skills-only 且无编排适配，返回 null（调用方跳过适配段注入）。
 *
 * @param toolValue - 目标工具 id（claude / pi / codex / opencode）
 * @param piMode - Pi 编排模式（由 Pi 运行时探测给出；缺省按 degraded）
 */
export function negotiationForHost(
    toolValue: string,
    piMode?: OrchestrationMode
): CapabilityNegotiation | null {
    if (toolValue === 'claude') {
        return negotiateCapabilities('claude', 'strict');
    }
    if (toolValue === 'opencode') {
        return negotiateCapabilities('opencode', 'strict');
    }
    if (toolValue === 'pi') {
        return piMode === 'strict'
            ? negotiateCapabilities('pi', 'strict')
            : negotiateCapabilities('pi', 'degraded', ['skill-load', 'argument-passing']);
    }
    return null;
}

/** 工作流阶段所需能力是否被满足 */
export function phaseCapabilitiesSatisfied(
    negotiation: CapabilityNegotiation,
    required: readonly CapabilityId[]
): { runnable: boolean; missing: CapabilityId[] } {
    const available = new Set(negotiation.available);
    const missing = required.filter((c) => !available.has(c));
    return { runnable: missing.length === 0, missing };
}
