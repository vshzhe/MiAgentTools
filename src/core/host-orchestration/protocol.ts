/**
 * 宿主无关的工作流协议模型（变更 add-host-orchestration-adapters）。
 *
 * 共享协议只描述**语义**：阶段、所需能力、handoff 字段、回执字段、确认门与重试策略。
 * 它 MUST NOT 直接要求某个宿主专属的 Skill / Agent / Task / 工具名称 —— 宿主差异
 * 由 host-orchestration/hosts.ts 的适配器负责映射。
 */

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
 * 需求文档状态（持久于变更 `exploration.md` 的 `## 需求文档状态` 段，字段
 * `requirementDocStatus`）。
 *
 * - `absent`：该段缺失或取值非法（**不落盘**，历史变更的兼容分支）
 * - `skipped-by-user` / `generation-failed` / `generated`：可持久化的显式决定
 */
export type RequirementDocStatus = 'absent' | 'skipped-by-user' | 'generation-failed' | 'generated';

/** 持久化字段名（`exploration.md` 的 `## 需求文档状态` 段） */
export const REQUIREMENT_DOC_STATUS_FIELD = 'requirementDocStatus';

/** 可落盘的显式状态（`absent` 不落盘：段缺失即代表该值） */
export const PERSISTED_REQUIREMENT_DOC_STATUSES: readonly Exclude<
    RequirementDocStatus,
    'absent'
>[] = ['skipped-by-user', 'generation-failed', 'generated'];

/**
 * 状态读取/写入的尝试次数（含首次）。
 *
 * 语义为「失败 → 自动重试同一操作一次 → 仍失败即停止」，MUST NOT 第二次或无限重试。
 */
export const REQUIREMENT_DOC_STATUS_IO_ATTEMPTS = 2;

/**
 * 把 `exploration.md` 读到的原始取值归一化为状态。
 *
 * 段缺失（`undefined` / 空串）或取值非法 → `absent`（MUST NOT 猜测为 skip 或 generated）。
 */
export function normalizeRequirementDocStatus(raw: string | null | undefined): RequirementDocStatus {
    if (typeof raw !== 'string') {
        return 'absent';
    }
    const value = raw.trim();
    return (PERSISTED_REQUIREMENT_DOC_STATUSES as readonly string[]).includes(value)
        ? (value as RequirementDocStatus)
        : 'absent';
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

/** 回执状态 */
export type ReceiptStatus = 'ok' | 'failed' | 'blocked' | 'incomplete';

/** 阶段回执 */
export interface Receipt {
    phase: string;
    status: ReceiptStatus;
    artifact?: string;
    nextAllowed?: string;
    failure?: string;
    /**
     * 需求文档状态（debug `verify-close` 与父流程的文档桥回执携带）。
     *
     * 仅作 handoff 镜像；跨会话依据仍是变更 `exploration.md` 的持久记录。
     */
    requirementDocStatus?: RequirementDocStatus;
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
 *   - 非 ok 状态必须带 failure 说明（失败原因不得缺失）。
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
    if (missing.length > 0) {
        return { valid: false, missing, reason: `回执缺少必需字段：${missing.join(', ')}` };
    }
    return { valid: true, missing: [] };
}
