/**
 * 宿主编排段渲染（变更 add-host-orchestration-adapters）。
 *
 * 共享技能模板保持宿主无关；安装期按目标宿主把「原生编排映射 + strict/degraded 限制 +
 * 回执与门契约」渲染为追加段。这样同一份模板源可服务 Claude Code、OpenCode V2 与 Pi，
 * 而不必为每个宿主维护第二份正文。
 */

import type { CapabilityNegotiation } from './hosts.js';
import { renderDelegationList } from './actions.js';
import { getWorkflowProtocol } from './workflows.js';

/** 需要编排的 workflow（含阶段委派） */
export const ORCHESTRATING_WORKFLOW_IDS: readonly string[] = [
    'workflow',
    'auto-workflow',
    'debug',
    'migration',
];

/** 各编排 workflow 委派的阶段（canonical workflowId） */
export const ORCHESTRATION_DELEGATIONS: Readonly<Record<string, readonly string[]>> = {
    workflow: [
        'spec-explore',
        'spec-propose',
        'spec-verify-proposal',
        'proposal-review',
        'spec-apply',
        'spec-archive',
    ],
    'auto-workflow': [
        'spec-explore',
        'spec-propose',
        'spec-verify-proposal',
        'proposal-review',
        'spec-apply',
        'spec-archive',
    ],
    debug: ['spec-verify-proposal'],
    migration: ['feature-doc', 'migration-check'],
};

/**
 * 渲染宿主编排段（Markdown）。
 *
 * strict：说明原生机制与门/回执契约；
 * degraded：显式声明未提供的能力与禁止伪装。
 */
export function renderHostOrchestrationSection(
    negotiation: CapabilityNegotiation,
    workflowId?: string
): string {
    const lines: string[] = [];
    lines.push('## 宿主编排适配（生成期注入）');
    lines.push('');
    if (negotiation.mode === 'strict') {
        lines.push('本次产物为 **strict 编排**：阶段委派、回执与确认门使用宿主原生机制。');
        lines.push('');
        lines.push(`- 技能加载：${negotiation.native.skillLoading}`);
        lines.push(`- 阶段委派：${negotiation.native.delegation}`);
        lines.push(`- 确认门：${negotiation.native.gate}`);
        lines.push('- 回执契约：阶段 MUST 返回 `phase` / `status` / 产物位置 / 下一步允许动作 / 失败原因');
        lines.push('- 回执缺失或不通过校验时 MUST NOT 自动推进下一阶段');
    } else {
        lines.push('本次产物为 **degraded 单 agent 模式**（宿主严格编排能力不可用）。');
        lines.push('');
        if (negotiation.missing.length > 0) {
            lines.push(`未提供的能力：${negotiation.missing.join(', ')}。`);
        }
        lines.push('- MUST NOT 把本地串行执行标记为委派完成、子代理回执或严格 gate 通过');
        lines.push('- 每个被跳过的委派 / 回执 / 门控 MUST 记录原因');
        lines.push('- 恢复 strict 需安装或配置宿主运行时后重新执行 iagent init / update');
    }
    for (const note of negotiation.notes) {
        lines.push(`- ${note}`);
    }
    if (workflowId) {
        const delegations = ORCHESTRATION_DELEGATIONS[workflowId] ?? [];
        const list = renderDelegationList(negotiation.host, negotiation.mode, delegations);
        if (list) {
            lines.push('');
            lines.push(list);
        }
        const protocol = getWorkflowProtocol(workflowId);
        if (protocol) {
            lines.push('');
            lines.push('**阶段能力声明**：');
            lines.push('');
            for (const phase of protocol.phases) {
                const caps = phase.requiredCapabilities.join(', ');
                const gate = phase.gate ? `；门：${phase.gate.id}` : '';
                const retry = phase.retry
                    ? `；重试：≤${phase.retry.maxAttempts} 次（${phase.retry.on.join(' / ')}）`
                    : '';
                lines.push(`- \`${phase.id}\`：能力 ${caps}${gate}${retry}`);
            }
        }
    }
    lines.push('');
    return lines.join('\n');
}

/** 技能是否属于需要编排适配的 workflow */
export function isOrchestratingWorkflow(workflowId: string): boolean {
    return ORCHESTRATING_WORKFLOW_IDS.includes(workflowId);
}

/**
 * 为编排类技能产物追加宿主编排段。
 *
 * 非编排技能原样返回；传入内容已含同名段时先移除旧段（幂等，避免重复追加）。
 */
export function adaptSkillContentForHost(
    content: string,
    negotiation: CapabilityNegotiation,
    workflowId: string
): string {
    // 宿主产物统一使用 canonical kebab-case skill ID；模板源仍可保留 legacy
    // `iagent_<name>` 标识作为注册/兼容契约。
    const normalized = content.replace(/\biagent_([a-z0-9_]+)\b/g, (_match, suffix: string) =>
        `iagent-${suffix.replaceAll('_', '-')}`
    );
    if (!isOrchestratingWorkflow(workflowId)) {
        return normalized;
    }
    const marker = '## 宿主编排适配（生成期注入）';
    const withoutOld = stripExistingSection(normalized, marker);
    const section = renderHostOrchestrationSection(negotiation, workflowId);
    return `${withoutOld.trimEnd()}\n\n${section}`;
}

/** 移除既有宿主编排段（从标记到下一个二级标题或文末） */
function stripExistingSection(content: string, marker: string): string {
    const idx = content.indexOf(marker);
    if (idx === -1) {
        return content;
    }
    const after = content.slice(idx);
    const nextHeading = after.slice(marker.length).search(/\n## /);
    if (nextHeading === -1) {
        return content.slice(0, idx);
    }
    return content.slice(0, idx) + after.slice(marker.length + nextHeading);
}
