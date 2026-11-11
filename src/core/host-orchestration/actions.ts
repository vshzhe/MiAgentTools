/**
 * 协议动作的宿主原生渲染（变更 add-host-orchestration-adapters）。
 *
 * 共享模板只描述**规范动作**（委派某阶段、加载某技能、确认门），机制名词
 * （Skill / subagent / Extension）在生成期由本模块按宿主渲染，避免把 Claude 专属
 * 委派语义硬编码进跨宿主共享正文。
 */

import type { HostId, OrchestrationMode } from './hosts.js';
import {
    DELEGATION_MODE_PARAM,
    GATE_SKIP_PARAM,
    resolveDelegationContract,
} from './delegation-contract.js';
import {
    type DelegationExecution,
    delegationExecutionFor,
} from './delegation-execution.js';

/** 规范动作：委派阶段 */
export interface DelegateAction {
    /** canonical workflowId（如 spec-explore） */
    workflowId: string;
    /** 传入模式参数（`mode` / `gate-skip`；旧写法 `auto-mode` 仅映射门承载轴） */
    options?: Record<string, string>;
}

/** 规范动作：加载技能 */
export interface LoadSkillAction {
    workflowId: string;
}

/**
 * 交互阶段（需要与用户交互的阶段）。
 *
 * Claude 宿主对交互阶段使用 `Skill` 内联加载（确认门可在主 agent 中呈现）；
 * 其余委派阶段使用前台 `Agent` 子代理执行（父级拿到 `tool_result` 后继续）。
 */
export const INTERACTIVE_STAGE_WORKFLOW_IDS: readonly string[] = ['spec-explore'];

/** 给定 canonical workflowId 是否为交互阶段 */
export function isInteractiveStage(workflowId: string): boolean {
    return INTERACTIVE_STAGE_WORKFLOW_IDS.includes(workflowId);
}

/** 宿主技能 ID（canonical kebab-case） */
function hostSkillId(workflowId: string): string {
    return `iagent-${workflowId}`;
}

/** 宿主中立提问令牌（模板正文使用；生成期按宿主替换） */
export const ASK_USER_TOKEN = '{{ASK_USER}}';

/**
 * 渲染宿主可用的提问机制名称。
 *
 * 只返回机制名（不含「工具」后缀），模板中的 `{{ASK_USER}} 工具` / `{{ASK_USER}} tool`
 * 在替换后保持通顺。
 */
export function renderAskUser(host?: string, mode: OrchestrationMode = 'strict'): string {
    if (host === 'claude') {
        return 'AskUserQuestion';
    }
    if (host === 'opencode') {
        return 'question';
    }
    if (host === 'pi') {
        return mode === 'strict' ? '阻塞提问' : '阻塞回执';
    }
    if (host === 'codex') {
        return '阻塞回执';
    }
    // 无宿主上下文（如 skills/ 快照）使用中性表述
    return '用户提问';
}

/**
 * 替换正文中的宿主中立令牌。
 *
 * 未提供宿主时使用中性表述（快照可复现）；替换后 MUST NOT 残留 `{{`。
 */
export function renderHostTokens(
    content: string,
    host?: string,
    mode: OrchestrationMode = 'strict'
): string {
    if (!content.includes(ASK_USER_TOKEN)) {
        return content;
    }
    return content.replaceAll(ASK_USER_TOKEN, renderAskUser(host, mode));
}

/**
 * 选项渲染（`k=v，k2=v2`）。
 *
 * 经 `resolveDelegationContract` 归一化：只渲染 `mode`（显式传入时）与
 * `gate-skip`（归一化后的门列表）；未知 gate id 被忽略（WARN 由解析契约记录），
 * 参数表未声明时 MUST NOT 凭空填充模式参数。
 *
 * 门账本不是参数（变更 improve-delegation-gate-ledger / D6）：其路径由 change-name
 * 派生，故本函数 MUST NOT 渲染账本分支，也不得新增第三轴。
 */
function renderOptions(options?: Record<string, string>): string {
    if (!options) {
        return '';
    }
    const contract = resolveDelegationContract(options);
    const pairs: string[] = [];
    if (options[DELEGATION_MODE_PARAM] !== undefined) {
        pairs.push(`${DELEGATION_MODE_PARAM}=${contract.mode}`);
    }
    if (contract.gateSkips.length > 0) {
        pairs.push(`${GATE_SKIP_PARAM}=${contract.gateSkips.join(',')}`);
    }
    return pairs.length > 0 ? `（${pairs.join('，')}）` : '';
}

/**
 * 渲染宿主原生的「委派阶段」指令。
 *
 * - Claude Code：交互阶段用 `Skill` 内联；内联策略同样用 `Skill` 加载；
 *   仅 `subagent` 策略使用前台 `Agent` 子代理
 * - OpenCode V2：内联用 `skill` 工具，子代理策略用 subagent + 项目级 agent
 * - Pi strict：内联直接加载技能，仅子代理策略使用 Runtime Extension
 * - Pi degraded / Codex（skills-only）：本地执行，显式声明**不构成委派**
 */
export function renderDelegate(
    host: HostId,
    mode: OrchestrationMode,
    action: DelegateAction,
    execution: DelegationExecution = 'inline'
): string {
    const id = hostSkillId(action.workflowId);
    const opts = renderOptions(action.options);
    if (host === 'claude') {
        if (isInteractiveStage(action.workflowId)) {
            return `经 Skill 工具加载 \`${id}\`${opts}（交互阶段，保留确认门）`;
        }
        if (execution === 'subagent') {
            const skillPath = `.claude/skills/${id}/SKILL.md`;
            return `经前台 Agent 子代理执行 \`${id}\`${opts}（子代理优先经 Skill 加载该技能；不可用时 Read \`${skillPath}\`；完成后返回结构化回执并遵守 EXIT GUARD）`;
        }
        if (execution === 'inline-with-opt-in-subagent') {
            return `经 Skill 工具加载 \`${id}\`${opts}（主 agent 内联执行；上下文超阈时经 Agent 子代理降级并记 WARN；返回后按续跑契约继续）`;
        }
        return `经 Skill 工具加载 \`${id}\`${opts}（主 agent 内联执行，不构成子代理派发；返回后按续跑契约继续）`;
    }
    if (host === 'opencode') {
        if (isInteractiveStage(action.workflowId)) {
            return `经 V2 \`skill\` 工具加载 \`${id}\`${opts}（交互阶段，保留确认门）`;
        }
        if (execution === 'subagent') {
            return `经 V2 \`subagent\` 启动项目 agent \`${id}\`${opts}（完成后按续跑契约继续，MUST NOT 以回执结束回合）`;
        }
        if (execution === 'inline-with-opt-in-subagent') {
            return `经 V2 \`skill\` 工具加载 \`${id}\`${opts}（主 agent 内联执行；上下文超阈时经 \`subagent\` 降级并记 WARN；返回后按续跑契约继续）`;
        }
        return `经 V2 \`skill\` 工具加载 \`${id}\`${opts}（主 agent 内联执行；返回后按续跑契约继续）`;
    }
    if (host === 'codex') {
        return `（degraded，skills-only）由当前 agent 本地执行 \`${id}\`${opts}，**不构成委派**（Codex 无子代理 / 技能委派机制）`;
    }
    // pi
    if (mode === 'strict') {
        if (execution === 'subagent') {
            const prompt = `执行 ${id} 阶段${opts}`;
            return `调用 \`Agent({ subagent_type: "${id}", prompt: ${JSON.stringify(prompt)} })\`（完成后按续跑契约继续，MUST NOT 以回执结束回合）`;
        }
        if (execution === 'inline-with-opt-in-subagent') {
            return `加载 Pi 技能 \`${id}\`${opts}（主 agent 内联执行；上下文超阈时经 Agent 降级并记 WARN；返回后按续跑契约继续）`;
        }
        return `加载 Pi 技能 \`${id}\`${opts}（主 agent 内联执行，不构成委派；返回后按续跑契约继续）`;
    }
    return `（degraded）由当前 agent 本地执行 \`${id}\`${opts}，**不构成委派**`;
}

/** 渲染宿主原生的「加载技能」指令 */
export function renderLoadSkill(host: HostId, mode: OrchestrationMode, action: LoadSkillAction): string {
    const id = hostSkillId(action.workflowId);
    if (host === 'claude') {
        return `经 Skill 工具加载 \`${id}\``;
    }
    if (host === 'opencode') {
        return `经 V2 \`skill\` 工具加载 \`${id}\``;
    }
    if (host === 'codex') {
        return `以 \`$${id}\` 引用加载技能 SKILL.md（skills-only，本地执行且不构成委派）`;
    }
    if (mode === 'strict') {
        return `加载 Pi 技能 \`${id}\``;
    }
    return `加载 Pi 技能 \`${id}\`（degraded，无原生委派）`;
}

/**
 * 渲染宿主编排的「委派清单」段落（供编排类技能生成期追加）。
 *
 * @param workflowIds - 委派目标（canonical workflowId，保序）
 * @param parameters - 显式参数表（目标 → 参数）；未声明的目标不填充任何模式参数
 * @param sourceWorkflowId - 来源工作流（用于解析委派执行策略；缺省按 inline）
 */
export function renderDelegationList(
    host: HostId,
    mode: OrchestrationMode,
    workflowIds: readonly string[],
    parameters?: Readonly<Record<string, Record<string, string>>>,
    sourceWorkflowId?: string
): string {
    if (workflowIds.length === 0) {
        return '';
    }
    const lines = ['**阶段委派（宿主原生）**：', ''];
    for (const wf of workflowIds) {
        const options = parameters?.[wf];
        const execution = sourceWorkflowId
            ? delegationExecutionFor(sourceWorkflowId, wf)
            : 'inline';
        lines.push(`- ${renderDelegate(host, mode, { workflowId: wf, options }, execution)}`);
    }
    return lines.join('\n');
}
