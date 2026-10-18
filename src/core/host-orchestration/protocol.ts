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

/** 确认门契约 */
export interface GateSpec {
    /** 门标识 */
    id: string;
    /** 门未通过时是否阻塞后续阶段（默认 true） */
    blocking?: boolean;
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
