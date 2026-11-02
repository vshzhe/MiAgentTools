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

/** 宿主技能 ID（canonical kebab-case） */
function hostSkillId(workflowId: string): string {
    return `iagent-${workflowId}`;
}

/**
 * 选项渲染（`k=v，k2=v2`）。
 *
 * 经 `resolveDelegationContract` 归一化：只渲染 `mode`（显式传入时）与
 * `gate-skip`（归一化后的门列表）；未知 gate id 被忽略（WARN 由解析契约记录），
 * 参数表未声明时 MUST NOT 凭空填充模式参数。
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
 * - Claude Code：Skill / Agent 子代理
 * - OpenCode V2：subagent + 项目级 agent
 * - Pi strict：Runtime Extension
 * - Pi degraded / Codex（skills-only）：本地执行，显式声明**不构成委派**
 */
export function renderDelegate(
    host: HostId,
    mode: OrchestrationMode,
    action: DelegateAction
): string {
    const id = hostSkillId(action.workflowId);
    const opts = renderOptions(action.options);
    if (host === 'claude') {
        return `经 Skill 工具委派 \`${id}\`${opts}`;
    }
    if (host === 'opencode') {
        return `经 V2 \`subagent\` 启动项目 agent \`${id}\`${opts}`;
    }
    if (host === 'codex') {
        return `（degraded，skills-only）由当前 agent 本地执行 \`${id}\`${opts}，**不构成委派**（Codex 无子代理 / 技能委派机制）`;
    }
    // pi
    if (mode === 'strict') {
        const prompt = `执行 ${id} 阶段${opts}`;
        return `调用 \`Agent({ subagent_type: "${id}", prompt: ${JSON.stringify(prompt)} })\``;
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
 */
export function renderDelegationList(
    host: HostId,
    mode: OrchestrationMode,
    workflowIds: readonly string[],
    parameters?: Readonly<Record<string, Record<string, string>>>
): string {
    if (workflowIds.length === 0) {
        return '';
    }
    const lines = ['**阶段委派（宿主原生）**：', ''];
    for (const wf of workflowIds) {
        const options = parameters?.[wf];
        lines.push(`- ${renderDelegate(host, mode, { workflowId: wf, options })}`);
    }
    return lines.join('\n');
}
