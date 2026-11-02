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
export type HostId = 'claude' | 'opencode' | 'pi' | 'codex';

/** 编排运行模式 */
export type OrchestrationMode = 'strict' | 'degraded';

/**
 * 运行表面（surface）：同一宿主在不同表面的 `gate` 可用性可不同。
 *
 * 生成期无法可靠判定运行表面（同一产物可能被 UI / CLI / `-p` 复用），
 * 故 `iagent init` / `update` 以缺省 `interactive-cli` 协商，headless 由运行期
 * 调用方（编排器 / 宿主运行时）传入（design D13）。
 */
export type SurfaceId = 'interactive-ui' | 'interactive-cli' | 'headless';

/** 全部运行表面（展示与校验用） */
export const SURFACE_IDS: readonly SurfaceId[] = [
    'interactive-ui',
    'interactive-cli',
    'headless',
];

/** 缺省运行表面（生成期使用） */
export const DEFAULT_SURFACE: SurfaceId = 'interactive-cli';

/** 能力协商选项（第三形参的对象形态） */
export interface NegotiationOptions {
    /** 该运行时实际具备的能力（缺省用宿主档案） */
    capabilitySet?: readonly CapabilityId[];
    /** 运行表面（缺省 `interactive-cli`） */
    surface?: SurfaceId;
}

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
    codex: {
        host: 'codex',
        capabilities: ['skill-load', 'argument-passing'],
        native: {
            // 与改写语法同源：技能以 `$iagent-<id>` 形式被引用 / 加载（skills-only）
            skillLoading: 'skills-only：技能以 `$iagent-<id>` 形式引用并加载 SKILL.md',
            delegation: '无子代理 / 技能委派机制（skills-only）—— 阶段由当前 agent 本地执行，不构成委派',
            gate: '无交互式确认门机制（skills-only）—— 门以阻塞回执形态上报',
        },
        precondition: 'Codex 为 skills-only 宿主；编排阶段按显式 degraded 路径本地执行',
    },
};

/** Pi strict 档案：安装并通过能力检测后的完整能力 */
export const PI_STRICT_PROFILE: HostCapabilityProfile = {
    host: 'pi',
    capabilities: ['skill-load', 'argument-passing', 'delegate', 'receipt', 'gate', 'state'],
    native: {
        skillLoading: '/skill:name 与 read SKILL.md',
        delegation: 'Runtime Extension 的 Agent / workflow 工具',
        // 收窄声明：Pi 无与 Claude/OpenCode 等价的交互式门工具，门以阻塞回执形态上报
        gate: '阻塞回执形态（非交互式门工具）：阶段以 status=blocked 回执上报未满足的门，由父级/用户在下一次交互中确认',
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
 * @param options - 该运行时实际具备的能力（位置化数组或选项对象）与运行表面
 */
export function negotiateCapabilities(
    host: HostId,
    mode: OrchestrationMode,
    options?: readonly CapabilityId[] | NegotiationOptions
): CapabilityNegotiation {
    // 第三形参保持向后兼容：既有位置化能力数组调用不变；对象形态才携带 surface
    const capabilitySet = Array.isArray(options)
        ? options
        : (options as NegotiationOptions | undefined)?.capabilitySet;
    const surface =
        options !== undefined && !Array.isArray(options)
            ? ((options as NegotiationOptions).surface ?? DEFAULT_SURFACE)
            : DEFAULT_SURFACE;
    const base = host === 'pi' && mode === 'strict' ? PI_STRICT_PROFILE : HOST_PROFILES[host];
    const available = new Set<CapabilityId>(capabilitySet ?? base.capabilities);
    const notes: string[] = [];
    // surface=headless：不可声称可交互 gate（条件门按门兜底矩阵记录并继续，不可豁免门以 blocked 回执中止）
    if (surface === 'headless') {
        available.delete('gate');
        notes.push(
            '运行表面为 headless：无法执行交互式确认门，`gate` 能力不可用（条件门记录决策并继续并记 WARN；不可豁免门 MUST 以 status=blocked 回执中止）'
        );
    }
    const missing = CAPABILITY_ORDER.filter((c) => !available.has(c));
    if (mode === 'degraded' && missing.length > 0) {
        notes.push(`degraded 模式不提供：${missing.join(', ')}`);
        notes.push('本地执行 MUST NOT 被标记为委派完成、子代理回执或严格 gate 通过');
    }
    if (base.precondition) {
        notes.push(base.precondition);
    }
    if (host === 'pi' && mode === 'strict') {
        notes.push(
            'Pi strict 的 `gate` 为阻塞回执形态（非交互式门工具）：阶段以 status=blocked 回执上报未满足的门，MUST NOT 声称与 Claude/OpenCode 等价的交互式门'
        );
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
 * codex 为 skills-only：返回**显式 degraded** 协商结果（非 null），调用方据此注入
 * 「本地执行，不构成委派」的降级段 —— MUST NOT 静默跳过适配段。
 *
 * @param toolValue - 目标工具 id（claude / pi / codex / opencode）
 * @param piMode - Pi 编排模式（由 Pi 运行时探测给出；缺省按 degraded）
 * @param surface - 运行表面（缺省 interactive-cli；headless 由运行期调用方传入）
 */
export function negotiationForHost(
    toolValue: string,
    piMode?: OrchestrationMode,
    surface: SurfaceId = DEFAULT_SURFACE
): CapabilityNegotiation | null {
    if (toolValue === 'claude') {
        return negotiateCapabilities('claude', 'strict', { surface });
    }
    if (toolValue === 'opencode') {
        return negotiateCapabilities('opencode', 'strict', { surface });
    }
    if (toolValue === 'pi') {
        return piMode === 'strict'
            ? negotiateCapabilities('pi', 'strict', { surface })
            : negotiateCapabilities('pi', 'degraded', {
                  capabilitySet: ['skill-load', 'argument-passing'],
                  surface,
              });
    }
    if (toolValue === 'codex') {
        return negotiateCapabilities('codex', 'degraded', { surface });
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
