/**
 * 委托模式双轴词汇单一源（变更 fix-mode-delegation-host-parity）。
 *
 * 技能间委派参数拆为两个**正交轴**，取值只能来自本模块：
 *   - 轴一 `mode`（执行归属）：`interactive`（默认）| `delegated`；
 *   - 轴二 `gate-skip=<gate-id>`（门承载）：声明已由父级确认的业务门，
 *     概念轴名为 `gate-policy`，但它**不是**可解析的参数键。
 *
 * `auto-mode=true` 仅映射到门承载轴（≡ `gate-skip=design-confirmation`），
 * MUST NOT 被视为 `mode=delegated` 的等价别名。
 *
 * 本模块是**叶依赖**：MUST NOT 导入 templates / registry，避免与模板派生
 * 形成循环导入；宿主渲染侧（`actions.ts`）与模板正文均从这里取词汇。
 */

/** 执行归属轴（委托模式 delegation mode，与宿主原生 mode 字段无关） */
export type DelegationMode = 'interactive' | 'delegated';

/** 门承载轴可声明的门 id（当前唯一合法取值） */
export type GateSkipId = 'design-confirmation';

/** 全部委托模式（展示与校验用） */
export const DELEGATION_MODES: readonly DelegationMode[] = ['interactive', 'delegated'];

/** 全部门承载 id（展示与校验用） */
export const GATE_SKIP_IDS: readonly GateSkipId[] = ['design-confirmation'];

/** 兼容参数名：`auto-mode=true` ≡ `gate-skip=design-confirmation`（仅门承载轴） */
export const LEGACY_AUTO_MODE_PARAM = 'auto-mode';

/** 参数键：唯一可传的委托模式键 */
export const DELEGATION_MODE_PARAM = 'mode';

/** 参数键：唯一可传的门承载键（`gate-policy` 仅为概念轴名，MUST NOT 解析） */
export const GATE_SKIP_PARAM = 'gate-skip';

/** 解析后的委托契约 */
export interface DelegationContract {
    /** 执行归属（调用方原值；非法值回落 interactive） */
    mode: DelegationMode;
    /** 已由父级确认的门 */
    gateSkips: GateSkipId[];
    /** 来源是否为旧写法 `auto-mode=true` */
    legacyAutoMode: boolean;
    /** 解析期间的 WARN（未知 gate id / 未知参数键） */
    warnings: string[];
}

/** 可解析的参数键集合（其余键一律忽略并记 WARN） */
const KNOWN_PARAMS: ReadonlySet<string> = new Set([
    DELEGATION_MODE_PARAM,
    GATE_SKIP_PARAM,
    LEGACY_AUTO_MODE_PARAM,
]);

/** 把单个门 id 归一化为 GateSkipId（未知返回 undefined） */
function toGateSkipId(raw: string): GateSkipId | undefined {
    return (GATE_SKIP_IDS as readonly string[]).includes(raw) ? (raw as GateSkipId) : undefined;
}

/**
 * 解析委托参数为双轴契约。
 *
 * 规则：
 *   - 只接受 `mode` / `gate-skip` / `auto-mode` 三个键；其它键（含 `gate-policy=`）
 *     忽略并记 WARN，MUST NOT 映射为「门已跳过」；
 *   - `mode` 非法值回落 `interactive` 并记 WARN；
 *   - `gate-skip` 为逗号分隔列表，未知 gate id 忽略并记 WARN；
 *   - `auto-mode=true` 只追加 `design-confirmation`，不改变 `mode`。
 *
 * @param options - 委派参数（调用方原样传入）
 */
export function resolveDelegationContract(
    options: Record<string, string> = {}
): DelegationContract {
    const warnings: string[] = [];

    let mode: DelegationMode = 'interactive';
    const rawMode = options[DELEGATION_MODE_PARAM];
    if (rawMode !== undefined) {
        if ((DELEGATION_MODES as readonly string[]).includes(rawMode)) {
            mode = rawMode as DelegationMode;
        } else {
            warnings.push(
                `WARN: 忽略未知委托模式 ${DELEGATION_MODE_PARAM}=${rawMode}（可选：${DELEGATION_MODES.join(' / ')}），按 interactive 处理`
            );
        }
    }

    const gateSkips: GateSkipId[] = [];
    const addGateSkip = (raw: string, sourceKey: string): void => {
        const id = toGateSkipId(raw);
        if (id === undefined) {
            warnings.push(
                `WARN: 忽略未知门跳过 id ${sourceKey}=${raw}（可选：${GATE_SKIP_IDS.join(' / ')}），MUST NOT 据此跳过任何门`
            );
            return;
        }
        if (!gateSkips.includes(id)) {
            gateSkips.push(id);
        }
    };

    const rawGateSkip = options[GATE_SKIP_PARAM];
    if (rawGateSkip !== undefined) {
        for (const part of rawGateSkip.split(',').map((item) => item.trim())) {
            if (part !== '') {
                addGateSkip(part, GATE_SKIP_PARAM);
            }
        }
    }

    const legacyAutoMode = options[LEGACY_AUTO_MODE_PARAM] === 'true';
    if (legacyAutoMode) {
        addGateSkip('design-confirmation', LEGACY_AUTO_MODE_PARAM);
    }

    for (const key of Object.keys(options)) {
        if (!KNOWN_PARAMS.has(key)) {
            warnings.push(
                `WARN: 忽略未知委托参数 ${key}（仅支持 ${DELEGATION_MODE_PARAM} / ${GATE_SKIP_PARAM} / ${LEGACY_AUTO_MODE_PARAM}；gate-policy 仅为概念轴名）`
            );
        }
    }

    return { mode, gateSkips, legacyAutoMode, warnings };
}

/**
 * 渲染模板正文用的双轴契约段（两轴说明 + 不可互换声明）。
 *
 * 模板 MUST 插值引用本函数，MUST NOT 手写第二份取值表。
 */
export function renderDelegationModeContract(): string {
    const modes = DELEGATION_MODES.map((item) => `\`${item}\``).join(' / ');
    const gates = GATE_SKIP_IDS.map((item) => `\`${item}\``).join(' / ');
    return [
        '**委托模式契约（双轴正交，不可互换）**',
        '',
        `- 轴一 \`${DELEGATION_MODE_PARAM}\`（执行归属；指“委托模式 delegation mode”，MUST NOT 与宿主原生 \`mode\` 字段混同）：${modes}。\`delegated\` = 抑制结尾停点、抑制被委派技能自身验证、输出结构化回执、**回执后父编排在同一用户回合内继续**、禁止「等待用户确认」停点；**不豁免任何业务确认门**。`,
        `- 轴二 \`${GATE_SKIP_PARAM}=<gate-id>\`（门承载；概念轴名 \`gate-policy\` 不是参数键）：声明已由父级确认的门，当前取值 ${gates}；未知 gate id 拒绝或忽略并记 WARN。`,
        `- \`${LEGACY_AUTO_MODE_PARAM}=true\` **仅**映射到门承载轴（≡ \`${renderGateSkipOption(GATE_SKIP_IDS)}\`），\`${DELEGATION_MODE_PARAM}\` 保持调用方原值；MUST NOT 视为 \`${DELEGATION_MODE_PARAM}=delegated\` 的等价别名。`,
        `- 两轴正交：仅传 \`${DELEGATION_MODE_PARAM}=delegated\` 时设计确认门等业务门照常触发；仅传 \`${GATE_SKIP_PARAM}\` 时停点与自验证照常生效。`,
    ].join('\n');
}

/**
 * 渲染门承载参数串（`gate-skip=<gate-id>[,<gate-id>]`）。
 *
 * @param gates - 已由父级确认的门 id 列表
 */
export function renderGateSkipOption(gates: readonly GateSkipId[]): string {
    return `${GATE_SKIP_PARAM}=${gates.join(',')}`;
}

/**
 * 渲染单个委托模式参数（`mode=<mode>`）。
 *
 * 模板正文中的具体委派语句 MUST 经本函数插值，MUST NOT 手写 `mode=delegated` 一类字面量。
 */
export function renderDelegationModeOption(mode: DelegationMode): string {
    return `${DELEGATION_MODE_PARAM}=${mode}`;
}

/**
 * 渲染委托模式的取值集合（`mode=interactive|delegated`）。
 *
 * 供 Input 契约等需要枚举取值的正文插值。
 */
export function renderDelegationModeOptions(): string {
    return `${DELEGATION_MODE_PARAM}=${DELEGATION_MODES.join('|')}`;
}
