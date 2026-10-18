/**
 * 协议动作的宿主原生渲染（变更 add-host-orchestration-adapters）。
 *
 * 共享模板只描述**规范动作**（委派某阶段、加载某技能、确认门），机制名词
 * （Skill / subagent / Extension）在生成期由本模块按宿主渲染，避免把 Claude 专属
 * 委派语义硬编码进跨宿主共享正文。
 */

import type { HostId, OrchestrationMode } from './hosts.js';

/** 规范动作：委派阶段 */
export interface DelegateAction {
    /** canonical workflowId（如 spec-explore） */
    workflowId: string;
    /** 传入模式（如 delegated / auto-mode） */
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

/** 选项渲染（`k=v, k2=v2`） */
function renderOptions(options?: Record<string, string>): string {
    if (!options) {
        return '';
    }
    const pairs = Object.entries(options).map(([k, v]) => `${k}=${v}`);
    return pairs.length > 0 ? `（${pairs.join('，')}）` : '';
}

/**
 * 渲染宿主原生的「委派阶段」指令。
 *
 * - Claude Code：Skill / Agent 子代理
 * - OpenCode V2：subagent + 项目级 agent
 * - Pi strict：Runtime Extension
 * - Pi degraded：本地执行，显式声明**不构成委派**
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
    if (mode === 'strict') {
        return `加载 Pi 技能 \`${id}\``;
    }
    return `加载 Pi 技能 \`${id}\`（degraded，无原生委派）`;
}

/** 渲染宿主编排的「委派清单」段落（供编排类技能生成期追加） */
export function renderDelegationList(
    host: HostId,
    mode: OrchestrationMode,
    workflowIds: readonly string[]
): string {
    if (workflowIds.length === 0) {
        return '';
    }
    const lines = ['**阶段委派（宿主原生）**：', ''];
    for (const wf of workflowIds) {
        lines.push(`- ${renderDelegate(host, mode, { workflowId: wf })}`);
    }
    return lines.join('\n');
}
