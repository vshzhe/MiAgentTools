/**
 * 宿主无关的工作流协议模型（变更 add-host-orchestration-adapters）。
 *
 * 共享协议只描述**语义**：阶段、所需能力、handoff 字段、回执字段、确认门与重试策略。
 * 它 MUST NOT 直接要求某个宿主专属的 Skill / Agent / Task / 工具名称 —— 宿主差异
 * 由 host-orchestration/hosts.ts 的适配器负责映射。
 */

// `delegation-contract.ts` 为叶依赖（无 import），此处导入不构成循环：
// `confirmedGates` 的取值域 MUST 收敛到 `GATE_SKIP_IDS`，MUST NOT 另立第二份取值表。
import { GATE_SKIP_IDS } from './delegation-contract.js';

/** 编排能力标识 */
export type CapabilityId =
    | 'skill-load'      // 加载技能正文
    | 'argument-passing' // 向指令/技能传递用户参数
    | 'delegate'        // 启动下游阶段（子 agent / 子技能）
    | 'receipt'         // 阶段回执返回与校验
    | 'gate'            // 用户确认门 / 检查点
    | 'state';          // 跨阶段状态持续

/** 全部能力的稳定顺序（展示与遍历用） */
export const CAPABILITY_ORDER: readonly CapabilityId[] = [
    'skill-load',
    'argument-passing',
    'delegate',
    'receipt',
    'gate',
    'state',
];

/** 回执契约：阶段返回必须具备的字段 */
export interface ReceiptSpec {
    fields: readonly string[];
}

/**
 * 门条件的稳定标识。
 *
 * `multiple-fix-options`：debug 修复方案确认门 —— 存在多个可行修复方案时门适用，
 * 唯一且证据充分的方案时门不适用（直通）。
 */
export type GateConditionId = 'multiple-fix-options';

/** 全部门条件标识（展示与校验用） */
export const GATE_CONDITION_IDS: readonly GateConditionId[] = ['multiple-fix-options'];

/** 确认门契约 */
export interface GateSpec {
    /** 门标识 */
    id: string;
    /** 门未通过时是否阻塞后续阶段（默认 true） */
    blocking?: boolean;
    /**
     * 条件门标识（可选）。
     *
     * 未声明时保持既有静态门行为（`blocking ?? true` + 门确认）；
     * 声明时以 `PhaseTransitionInput.gateConditions[condition]` 裁决适用性：
     * `false` → 门不适用并跳过门确认要求；`true` 或未提供 → 门适用（fail-safe）。
     */
    condition?: GateConditionId;
}

/**
 * 确认门白名单类别（正向枚举，5 类）。
 *
 * 白名单按**语义类别**枚举，一个类别可含多个锚点（5 类 ≠ 5 个阶段门 id）。
 */
export type GateWhitelistId =
    | 'requirement-clarification'
    | 'flow-final-confirmation'
    | 'implementation-bridge'
    | 'archive-confirmation'
    | 'destructive-change';

/** 白名单条目：类别标识 + 锚点集合 + 是否可条件豁免 */
export interface GateWhitelistEntry {
    /** 类别标识 */
    id: GateWhitelistId;
    /** 人读类别名（供模板渲染） */
    label: string;
    /**
     * 锚点集合：该类别覆盖的阶段门 id 或技能内动作（一对多）。
     *
     * 对齐规则：`WORKFLOW_PROTOCOLS` 中每个 `PhaseSpec.gate.id` MUST 出现在某个条目的
     * `anchors` 内；MUST NOT 通过新增/删改既有阶段门来凑对齐。
     */
    anchors: readonly string[];
    /** 是否可条件豁免（`destructive-change` 为不可豁免的独立安全条） */
    conditional: boolean;
}

/**
 * 必留确认门白名单（正向枚举；写漏只会多留门，属 fail-safe 方向）。
 *
 * 「破坏性改动确认」为**动作级安全条**：不占用任何阶段的阶段门预算。
 */
export const GATE_WHITELIST: readonly GateWhitelistEntry[] = [
    {
        id: 'requirement-clarification',
        label: '需求澄清（需求 / 方案歧义）',
        anchors: [
            'prompt-gate',
            'grill-batch-confirmation',
            'diagnostic-confirmation',
            'fix-option-confirmation',
        ],
        conditional: true,
    },
    {
        id: 'flow-final-confirmation',
        label: '功能流程图门（流程基准确认）',
        anchors: ['flow-final-confirmation'],
        conditional: false,
    },
    {
        id: 'implementation-bridge',
        label: '实现 + 测试桥',
        anchors: ['implementation-bridge'],
        conditional: false,
    },
    {
        id: 'archive-confirmation',
        label: '归档桥',
        anchors: ['archive-confirmation'],
        conditional: false,
    },
    {
        id: 'destructive-change',
        label: '破坏性改动确认（动作级，不可豁免：删除目录 / 覆盖既有制品 / 改写版本库跟踪 / 不可逆命令）',
        anchors: [],
        conditional: false,
    },
];

/** 全部白名单锚点（阶段门 id 或技能内动作的并集） */
export const GATE_WHITELIST_ANCHORS: readonly string[] = GATE_WHITELIST.flatMap((entry) => [
    ...entry.anchors,
]);

/** 给定阶段门 id 是否在白名单锚点集合内 */
export function isWhitelistedGate(gateId: string): boolean {
    return GATE_WHITELIST_ANCHORS.includes(gateId);
}

/**
 * 阶段实际执行方式（变更 improve-orchestration-execution-mode）。
 *
 * - `subagent`：经子代理执行（变更类阶段）
 * - `inline`：由当前主代理内联执行（探索 / 交互 / 收束类阶段）
 * - `local-degraded`：degraded 宿主的本地执行（不构成委派）
 */
export type ExecutionMode = 'subagent' | 'inline' | 'local-degraded';

/** 全部执行方式（展示与取值域校验用） */
export const EXECUTION_MODES: readonly ExecutionMode[] = ['subagent', 'inline', 'local-degraded'];

/** 验证独立性：`independent` 非作者 / `self` 作者自证 */
export type Independence = 'independent' | 'self';

/** 全部独立性取值（展示与取值域校验用） */
export const INDEPENDENCE_VALUES: readonly Independence[] = ['independent', 'self'];

/**
 * 阶段执行方式声明（可选）。
 *
 * - `allowed`：strict 宿主允许的执行方式；不含 `inline` 即要求子代理。
 * - `independence`：内联验证的独立性要求 —— `required` 要求非作者；
 *   `self-allowed` 允许自证但记 WARN；缺省不校验。
 */
export interface PhaseExecutionSpec {
    allowed: readonly ExecutionMode[];
    independence?: 'required' | 'self-allowed';
}

/** 阶段输入契约 */
export interface PhaseInput {
    /** 必需输入字段 */
    required: readonly string[];
    /** 可选输入字段 */
    optional?: readonly string[];
}

/** 阶段重试策略 */
export interface RetryPolicy {
    /** 最大尝试次数（含首次） */
    maxAttempts: number;
    /** 触发重试的失败类别 */
    on: readonly string[];
}

/** 单个阶段规格 */
export interface PhaseSpec {
    /** 阶段标识（稳定，如 explore / propose / apply / archive） */
    id: string;
    /** 阶段输入契约 */
    input: PhaseInput;
    /** 该阶段所需能力；缺失且 strict 时阶段被阻断 */
    requiredCapabilities: readonly CapabilityId[];
    /** 阶段完成后必须交付的 handoff 字段 */
    handoff: readonly string[];
    /** 阶段回执契约 */
    receipt: ReceiptSpec;
    /** 阶段确认门（可选） */
    gate?: GateSpec;
    /** 阶段执行方式声明（可选；缺省不校验执行方式，兼容旧阶段） */
    execution?: PhaseExecutionSpec;
    /** 阶段重试策略（可选；缺省不自动重试） */
    retry?: RetryPolicy;
}

/** 工作流协议（canonical workflowId → 阶段序列） */
export interface WorkflowProtocol {
    /** canonical workflowId（既有 commandId，如 spec-explore） */
    workflowId: string;
    /** 阶段序列（顺序即推进顺序） */
    phases: readonly PhaseSpec[];
}

/** 协议是否声明了阶段能力集合（供校验与测试使用） */
export function protocolDeclaresCapabilities(protocol: WorkflowProtocol): boolean {
    return (
        protocol.phases.length > 0 &&
        protocol.phases.every((phase) => Array.isArray(phase.requiredCapabilities))
    );
}

/** 默认回执字段：阶段标识 / 状态 / 产物位置 / 下一步允许动作（失败原因按需单独要求） */
export const DEFAULT_RECEIPT_FIELDS: readonly string[] = [
    'phase',
    'status',
    'artifact',
    'nextAllowed',
];

/** 阶段回执状态 */
export type ReceiptStatus = 'ok' | 'failed' | 'blocked' | 'incomplete';

/**
 * Stage Envelope 推荐上限（字节；不含子代理自行加载的技能正文）。
 *
 * 生成期文本与测试用于防止把制品正文 / 完整 SKILL.md 内联进委派指令。
 */
export const STAGE_ENVELOPE_MAX_BYTES = 2048;

/** Stage Receipt 推荐上限（行数）。 */
export const STAGE_RECEIPT_MAX_LINES = 40;

/** Stage Receipt 推荐上限（字节）。 */
export const STAGE_RECEIPT_MAX_BYTES = 2048;

/** handoff 包每节推荐上限（行数；包是蒸馏视图而非制品副本）。 */
export const HANDOFF_PACK_SECTION_MAX_LINES = 120;

/** 阶段回执 */
export interface Receipt {
    phase: string;
    status: ReceiptStatus;
    artifact?: string;
    nextAllowed?: string;
    failure?: string;
    /**
     * 门阻塞：门白名单内的门 id（与 `blockedReason` 二选一）。
     *
     * 可选且 MUST NOT 进入 `DEFAULT_RECEIPT_FIELDS`：缺失不代表阶段完成。
     * 出现时由 `validateReceipt` 校验为非空字符串；白名单归属由父编排判定。
     */
    blockedGate?: string;
    /** 非门类用户决策的阻塞原因（范围蔓延 / 材料性歧义 / 方案选择；与 `blockedGate` 二选一）。 */
    blockedReason?: string;
    /** 续跑提示（父级可原样放进下次 Stage Envelope 的 `resumeHint`）。 */
    resumeHint?: string;
    /** 复查 / 验证完整报告的路径（摘要见 `reviewSummary`；完整正文 MUST NOT 进入回执）。 */
    reportPath?: string;
    /** 复查 / 验证摘要（≤2KB）。 */
    reviewSummary?: string;
    /**
     * 本阶段实际已确认的门（门账本回执镜像，变更 improve-delegation-gate-ledger）。
     *
     * 取值域 = `GATE_SKIP_IDS`（门承载语义，**不是**父级阶段门 id）。
     * **可选**且 MUST NOT 进入 `DEFAULT_RECEIPT_FIELDS`：缺失即「无账本」，
     * 门照常触发（fail-safe）；出现时由 `validateReceipt` 校验形状与取值。
     * 回执是账本的**上游真源**：账本条目 MUST NOT 超出本字段声明的已确认门。
     */
    confirmedGates?: string[];
    /** 本阶段实际执行方式（可选；是否必需由 `PhaseSpec.execution` 决定）。 */
    executionMode?: ExecutionMode;
    /** 验证独立性（内联验证时使用；`self` 表示作者自证并记 WARN）。 */
    independence?: Independence;
    /** 用量（宿主可用时；不可得省略，MUST NOT 编造）。 */
    usage?: ReceiptUsage;
    /** 实际读取的文件与章节（D6 制品清单读取范围）。 */
    readScope?: string[];
    /** 上游输入（如上一验证报告路径）。 */
    dependsOn?: string[];
    /** 是否 resume 上下文重放（复验时用于 WARN）。 */
    contextReplay?: boolean;
}

/** 回执用量（全部可选；非负数） */
export interface ReceiptUsage {
    tokens?: number;
    toolCalls?: number;
    durationMs?: number;
}

/** 回执校验结果 */
export interface ReceiptValidation {
    valid: boolean;
    missing: string[];
    reason?: string;
}

/**
 * 校验阶段回执是否满足契约。
 *
 * 规则：
 *   - 必需字段齐全（phase / status 必须有非空值）；
 *   - status 必须是已知取值；
 *   - 非 ok 状态必须带 failure 说明（失败原因不得缺失）；
 *   - `confirmedGates` 出现时必须是「`GATE_SKIP_IDS` 内门 id 组成的字符串数组」
 *     （非数组 / 元素非字符串 / 空串 / 未知门 id → 校验失败并附原因）。
 */
export function validateReceipt(receipt: Partial<Receipt>, spec: ReceiptSpec): ReceiptValidation {
    const missing: string[] = [];
    for (const field of spec.fields) {
        const value = receipt[field as keyof Receipt];
        if (value === undefined || value === null || value === '') {
            missing.push(field);
        }
    }
    if (typeof receipt.status === 'string' && !['ok', 'failed', 'blocked', 'incomplete'].includes(receipt.status)) {
        return { valid: false, missing, reason: `未知回执状态：${receipt.status}` };
    }
    if (receipt.status !== undefined && receipt.status !== 'ok') {
        if (receipt.failure === undefined || receipt.failure === '') {
            if (!missing.includes('failure')) {
                missing.push('failure');
            }
        }
    }
    // 门账本回执镜像：只校验「出现时」的形状与取值 —— 缺失即无账本（门照常触发）
    const confirmedGatesIssue = validateConfirmedGates(receipt.confirmedGates);
    if (confirmedGatesIssue !== undefined) {
        return { valid: false, missing, reason: confirmedGatesIssue };
    }
    const optionalStringIssue = validateOptionalReceiptStrings(receipt);
    if (optionalStringIssue !== undefined) {
        return { valid: false, missing, reason: optionalStringIssue };
    }
    const executionIssue = validateExecutionFields(receipt);
    if (executionIssue !== undefined) {
        return { valid: false, missing, reason: executionIssue };
    }
    if (missing.length > 0) {
        return { valid: false, missing, reason: `回执缺少必需字段：${missing.join(', ')}` };
    }
    return { valid: true, missing: [] };
}

/**
 * 校验可选回执字段的形状（仅在字段出现时）。
 *
 * `blockedGate` 与 `blockedReason` 互斥：前者用于门白名单内的门，后者用于非门类
 * 用户决策（范围蔓延 / 材料性歧义 / 方案选择）。
 */
function validateOptionalReceiptStrings(receipt: Partial<Receipt>): string | undefined {
    const keys = ['blockedGate', 'blockedReason', 'resumeHint', 'reportPath', 'reviewSummary'] as const;
    for (const key of keys) {
        const value = receipt[key];
        if (value !== undefined && (typeof value !== 'string' || value.trim() === '')) {
            return `回执 ${key} 必须是非空字符串`;
        }
    }
    if (receipt.blockedGate !== undefined && receipt.blockedReason !== undefined) {
        return '回执 blockedGate 与 blockedReason 不可同时出现（二选一）';
    }
    return undefined;
}

/**
 * 校验 `Receipt.confirmedGates` 的形状与取值域。
 *
 * @returns 违规原因（合法或字段缺失时 undefined）
 */
/**
 * 校验执行方式 / 独立性 / 用量 / 读取范围 / 依赖字段（仅在字段出现时）。
 *
 * 字段是否必需由 `PhaseSpec.execution` 决定，本函数只校验形状与取值域；
 * 旧回执（不含这些字段）保持合法。
 */
function validateExecutionFields(receipt: Partial<Receipt>): string | undefined {
    const mode = receipt.executionMode;
    if (mode !== undefined && !(EXECUTION_MODES as readonly string[]).includes(mode)) {
        return `回执 executionMode 非法：${String(mode)}（可选：${EXECUTION_MODES.join(' / ')}）`;
    }
    const independence = receipt.independence;
    if (
        independence !== undefined &&
        !(INDEPENDENCE_VALUES as readonly string[]).includes(independence)
    ) {
        return `回执 independence 非法：${String(independence)}（可选：${INDEPENDENCE_VALUES.join(' / ')}）`;
    }
    if (receipt.usage !== undefined) {
        const usage: unknown = receipt.usage;
        if (typeof usage !== 'object' || usage === null || Array.isArray(usage)) {
            return '回执 usage 必须是对象';
        }
        for (const key of ['tokens', 'toolCalls', 'durationMs'] as const) {
            const value = (usage as Record<string, unknown>)[key];
            if (value === undefined) {
                continue;
            }
            if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
                return `回执 usage.${key} 必须是非负数`;
            }
            if (key === 'toolCalls' && !Number.isInteger(value)) {
                return '回执 usage.toolCalls 必须是非负整数';
            }
        }
    }
    for (const key of ['readScope', 'dependsOn'] as const) {
        const raw: unknown = receipt[key];
        if (raw === undefined) {
            continue;
        }
        if (!Array.isArray(raw) || raw.length === 0) {
            return `回执 ${key} 必须是非空字符串数组`;
        }
        for (const item of raw as unknown[]) {
            if (typeof item !== 'string' || item.trim() === '') {
                return `回执 ${key} 含空串或非字符串元素`;
            }
        }
    }
    if (receipt.contextReplay !== undefined && typeof receipt.contextReplay !== 'boolean') {
        return '回执 contextReplay 必须是布尔值';
    }
    return undefined;
}

function validateConfirmedGates(raw: string[] | undefined): string | undefined {
    if (raw === undefined) {
        return undefined;
    }
    const value: unknown = raw;
    if (!Array.isArray(value)) {
        return '回执 confirmedGates 必须是字符串数组';
    }
    for (const item of value as unknown[]) {
        if (typeof item !== 'string') {
            return `回执 confirmedGates 含非字符串元素：${String(item)}`;
        }
        if (item.trim() === '') {
            return '回执 confirmedGates 含空串（MUST NOT 视为任何门已确认）';
        }
        if (!(GATE_SKIP_IDS as readonly string[]).includes(item)) {
            return `回执 confirmedGates 含未知门 id：${item}（可选：${GATE_SKIP_IDS.join(' / ')}）`;
        }
    }
    return undefined;
}
