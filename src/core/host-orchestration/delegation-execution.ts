/**
 * 委派执行策略单一来源（变更 fix-skill-contract-drift / D3）。
 *
 * 生成期需要知道「某个委派目标应由主 agent 内联执行还是允许子代理」，
 * 该判断 MUST NOT 由各宿主分支或模板正文各自推断——否则会出现
 * 「生成物要求 Agent，而 allowedTools 未授权 Agent/Task」的漂移。
 *
 * 默认内联：与 AGENTS.md「全部编排阶段默认主 agent 内联」一致。
 * 仅迁移复查的上下文阈值降级保留条件式子代理；spec-bulk-archive 的并行单元
 * 是技能内部派发，不经过本表。
 */

/** 委派执行策略 */
export type DelegationExecution =
    /** 主 agent 内联执行（默认） */
    | 'inline'
    /** 默认内联；上下文超阈时允许降级为子代理（需 Agent/Task 授权） */
    | 'inline-with-opt-in-subagent'
    /** 始终子代理（需 Agent/Task 授权） */
    | 'subagent';

/** 未声明时的默认策略 */
export const DEFAULT_DELEGATION_EXECUTION: DelegationExecution = 'inline';

/**
 * 按来源工作流与目标技能覆盖执行策略。
 *
 * 只列例外；未列出的目标一律 `inline`（fail-safe：不会凭空授权子代理）。
 */
export const DELEGATION_EXECUTION_OVERRIDES: Readonly<
    Record<string, Readonly<Record<string, DelegationExecution>>>
> = {
    migration: {
        // 迁移复查默认内联；计划读取文件数 > 300 或制品 > 15k 行时降级子代理 + WARN
        'migration-check': 'inline-with-opt-in-subagent',
    },
};

/** 解析某来源工作流对某目标技能的委派执行策略 */
export function delegationExecutionFor(
    sourceWorkflowId: string,
    targetWorkflowId: string
): DelegationExecution {
    return (
        DELEGATION_EXECUTION_OVERRIDES[sourceWorkflowId]?.[targetWorkflowId] ??
        DEFAULT_DELEGATION_EXECUTION
    );
}

/** 该策略是否允许子代理（含条件降级） */
export function allowsSubagent(execution: DelegationExecution): boolean {
    return execution === 'subagent' || execution === 'inline-with-opt-in-subagent';
}
