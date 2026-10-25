/**
 * Pi 原生编排产物生成（变更 fix-pi-native-orchestration）。
 *
 * `@tintinweb/pi-subagents` 的 `Agent` 工具按 `subagent_type` 解析
 * `.pi/agents/<name>.md`。仅安装运行时包并不足以构成可执行委派 —— 本模块负责
 * 生成 orchestrator 与阶段 agent 定义，并提供 strict 判定所需的可解析性扫描。
 *
 * 产物均为**纯生成物**：每轮按最新模板重建，不写手改保护指纹；清理只认
 * canonical `iagent-` 前缀，用户自建 agent 不受影响。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { COMMAND_NAMESPACE } from './config.js';
import { escapeYamlValue } from './command-generation/yaml.js';
import { SKILL_ID_PREFIX } from './skill-id.js';
import {
    CONDITIONAL_DELEGATIONS,
    ORCHESTRATING_WORKFLOW_IDS,
    ORCHESTRATION_DELEGATIONS,
} from './host-orchestration/render.js';

/** 项目级 Pi agent 目录（项目相对，posix 展示） */
export const PI_AGENTS_DIR = '.pi/agents';

/** 上游内置工具名（`tools:` 只接受这些 plain 名称） */
export const PI_AGENT_TOOLS = ['read', 'write', 'edit', 'bash', 'grep', 'find', 'ls'] as const;

/** 编排器 agent ID（= `subagent_type`） */
export const PI_ORCHESTRATOR_AGENT_ID = `${COMMAND_NAMESPACE}-orchestrator`;

/** 阶段 agent ID（= `subagent_type`） */
export function piAgentId(workflowId: string): string {
    return `${SKILL_ID_PREFIX}${workflowId}`;
}

/** 需生成 agent 定义的阶段 */
export interface PiNativeStage {
    workflowId: string;
    description: string;
}

/** 生成结果 */
export interface PiNativeWriteResult {
    /** 目录（项目相对，posix） */
    dir: string;
    /** 本次写出的 agent 文件（项目相对，posix） */
    written: string[];
    /** 清理的 orphan agent 文件（项目相对，posix） */
    removed: string[];
    /** 非阻断告警 */
    warnings: string[];
    /** 嵌套委派缺口诊断（编排阶段的委派目标未安装） */
    nestingGaps: PiNestingGap[];
}

/**
 * 嵌套委派缺口诊断。
 *
 * `required` 为**无条件必需委派**（strict 下该阶段按能力阻断）；
 * `conditional` 为正文已声明 fallback / degraded 路径的条件委派（按该路径执行 + WARN）。
 */
export interface PiNestingGap {
    /** 编排阶段（canonical workflowId） */
    workflowId: string;
    /** 该 workflow 声明的全部委派目标 */
    declared: string[];
    /** 声明但未安装的目标（canonical workflowId） */
    missing: string[];
    /** 缺口中的无条件必需委派 */
    required: string[];
    /** 缺口中的条件委派 */
    conditional: string[];
}

/** 嵌套委派解析结果 */
export interface PiNestingResolution {
    /** 可授予的 `allowed_subagents`（`iagent-<id>`，按委派声明顺序） */
    allowed: string[];
    /** 缺口诊断（无缺口时 undefined） */
    gap?: PiNestingGap;
}

/**
 * 解析某阶段 agent 的嵌套委派授予。
 *
 * 仅编排类阶段生成 `allowed_subagents`：取值 = 该 workflow 的委派清单 ∩ 已安装阶段。
 * 声明但未安装的目标记入缺口诊断（不授予 → 不伪装严格可用）。
 *
 * @param workflowId - 阶段（canonical workflowId）
 * @param installedWorkflowIds - 本次安装的阶段集合
 */
export function resolvePiNestingDelegations(
    workflowId: string,
    installedWorkflowIds: readonly string[]
): PiNestingResolution {
    if (!ORCHESTRATING_WORKFLOW_IDS.includes(workflowId)) {
        return { allowed: [] };
    }
    const declared = ORCHESTRATION_DELEGATIONS[workflowId] ?? [];
    const conditional = new Set(CONDITIONAL_DELEGATIONS[workflowId] ?? []);
    const installed = new Set(installedWorkflowIds);
    const allowed: string[] = [];
    const missing: string[] = [];
    for (const target of declared) {
        if (installed.has(target)) {
            allowed.push(piAgentId(target));
        } else {
            missing.push(target);
        }
    }
    if (missing.length === 0) {
        return { allowed };
    }
    return {
        allowed,
        gap: {
            workflowId,
            declared: [...declared],
            missing,
            required: missing.filter((target) => !conditional.has(target)),
            conditional: missing.filter((target) => conditional.has(target)),
        },
    };
}

/** 缺口告警文本（required 优先，二者可并存） */
function nestingGapWarnings(gap: PiNestingGap): string[] {
    const warnings: string[] = [];
    if (gap.required.length > 0) {
        warnings.push(
            `Pi 嵌套委派缺口（${gap.workflowId}）：无条件必需委派未安装 ${gap.required.join(', ')} —— ` +
                'strict 下该阶段按能力阻断，MUST NOT 以本地执行替代'
        );
    }
    if (gap.conditional.length > 0) {
        warnings.push(
            `Pi 嵌套委派缺口（${gap.workflowId}）：条件委派未安装 ${gap.conditional.join(', ')} —— ` +
                '按正文既有 fallback / degraded 路径执行并记 WARN（test 仅在显式协商 degraded 时允许本地编写）'
        );
    }
    return warnings;
}

/** 可解析性扫描结果 */
export interface PiAgentDefinitionScan {
    /** 目录（项目相对，posix） */
    dir: string;
    /** 期望的 `subagent_type` */
    required: string[];
    /** 存在且 frontmatter 可解析、name 匹配 */
    resolvable: string[];
    /** 文件不存在 */
    missing: string[];
    /** 文件存在但 frontmatter 缺失/不可解析/name 不匹配 */
    invalid: string[];
}

/** 渲染 orchestrator agent 定义 */
export function renderPiOrchestratorAgent(stages: readonly PiNativeStage[]): string {
    const subagents = stages.map((stage) => piAgentId(stage.workflowId));
    const lines: string[] = [];
    lines.push('---');
    lines.push(`name: ${PI_ORCHESTRATOR_AGENT_ID}`);
    lines.push(`description: ${escapeYamlValue('iagent 工作流编排器 —— 管理阶段推进、确认门与回执汇总')}`);
    lines.push(`tools: ${PI_AGENT_TOOLS.join(', ')}`);
    lines.push('prompt_mode: append');
    if (subagents.length > 0) {
        // 上游契约：逗号分隔的 subagent_type 列表；嵌套 Agent 工具据此注入
        lines.push(`allowed_subagents: ${subagents.join(', ')}`);
    }
    lines.push('---');
    lines.push('');
    lines.push('你是 iagent 工作流的编排器。职责：');
    lines.push('');
    lines.push('- 按共享协议推进阶段，管理确认门（gate）与阶段回执（receipt）；');
    lines.push('- 通过 `Agent` 工具按 `subagent_type` 委派阶段，并消费结构化回执；');
    lines.push('- 汇总回执后再决定推进、回退或停止；');
    lines.push('- MUST NOT 把本地串行执行标记为委派完成；');
    lines.push('- MUST NOT 越权完成未分配给自己的阶段。');
    lines.push('');
    return lines.join('\n');
}

/** 渲染阶段 agent 定义 */
export function renderPiStageAgent(
    workflowId: string,
    description: string,
    allowedSubagents?: readonly string[]
): string {
    const agentId = piAgentId(workflowId);
    const orchestrating = ORCHESTRATING_WORKFLOW_IDS.includes(workflowId);
    const lines: string[] = [];
    lines.push('---');
    lines.push(`name: ${agentId}`);
    lines.push(`description: ${escapeYamlValue(description)}`);
    lines.push(`tools: ${PI_AGENT_TOOLS.join(', ')}`);
    lines.push('prompt_mode: append');
    if (allowedSubagents && allowedSubagents.length > 0) {
        // 上游契约：逗号分隔的 subagent_type 列表；嵌套 Agent 工具据此注入
        lines.push(`allowed_subagents: ${allowedSubagents.join(', ')}`);
    }
    lines.push('---');
    lines.push('');
    lines.push(`你是 iagent 阶段 worker，负责 workflowId 为 \`${workflowId}\` 的阶段。`);
    lines.push('');
    lines.push('- 只执行被分配的阶段，MUST NOT 自行推进父 workflow 阶段；');
    lines.push('- 完成后返回协议规定的回执：`phase` / `status` / 产物位置 / 下一步允许动作 / 失败原因（如有）；');
    lines.push('- 缺少必要输入时返回 `status: blocked` 并说明缺失项，MUST NOT 猜测。');
    if (orchestrating) {
        lines.push(
            '- 本阶段为编排阶段：嵌套委派仅可指向 `allowed_subagents` 列出的阶段 agent；未列出的目标 MUST NOT 被声称可用。'
        );
        if (!allowedSubagents || allowedSubagents.length === 0) {
            lines.push(
                '- 当前没有任何已安装的委派目标：MUST NOT 声称嵌套委派在 strict 下可用，MUST NOT 把本地执行表述为委派完成。'
            );
        }
    }
    lines.push('');
    return lines.join('\n');
}

/** 列出目录下由本工具管理的 agent 文件（文件名，含扩展名） */
function listManagedAgentFiles(agentsDir: string): string[] {
    if (!fs.existsSync(agentsDir)) {
        return [];
    }
    return fs
        .readdirSync(agentsDir)
        .filter((name) => name.startsWith(SKILL_ID_PREFIX) && name.endsWith('.md'));
}

/** 项目相对 posix 路径 */
function toProjectPath(projectRoot: string, target: string): string {
    return path.relative(projectRoot, target).replaceAll('\\', '/');
}

/**
 * 写入 Pi 原生 agent 定义（orchestrator + 阶段），并清理不再需要的 orphan。
 *
 * @returns 写出与清理清单；单文件失败降级为告警，不抛出
 */
export function writePiNativeAgents(
    projectRoot: string,
    stages: readonly PiNativeStage[]
): PiNativeWriteResult {
    const agentsDir = path.join(projectRoot, PI_AGENTS_DIR);
    const result: PiNativeWriteResult = {
        dir: PI_AGENTS_DIR,
        written: [],
        removed: [],
        warnings: [],
        nestingGaps: [],
    };

    const installed = stages.map((stage) => stage.workflowId);
    const desired = new Map<string, string>();
    desired.set(PI_ORCHESTRATOR_AGENT_ID, renderPiOrchestratorAgent(stages));
    const seen = new Set<string>();
    for (const stage of stages) {
        const agentId = piAgentId(stage.workflowId);
        if (seen.has(agentId)) {
            continue;
        }
        seen.add(agentId);
        const nesting = resolvePiNestingDelegations(stage.workflowId, installed);
        if (nesting.gap) {
            result.nestingGaps.push(nesting.gap);
            result.warnings.push(...nestingGapWarnings(nesting.gap));
        }
        desired.set(
            agentId,
            renderPiStageAgent(stage.workflowId, stage.description, nesting.allowed)
        );
    }

    try {
        fs.mkdirSync(agentsDir, { recursive: true });
    } catch (error) {
        result.warnings.push(`Pi agent 目录创建失败（已跳过）：${(error as Error).message}`);
        return result;
    }

    for (const [agentId, content] of desired) {
        const file = path.join(agentsDir, `${agentId}.md`);
        try {
            fs.writeFileSync(file, content, 'utf8');
            result.written.push(toProjectPath(projectRoot, file));
        } catch (error) {
            result.warnings.push(`Pi agent 写入失败（${agentId}）：${(error as Error).message}`);
        }
    }

    for (const name of listManagedAgentFiles(agentsDir)) {
        const agentId = name.slice(0, -'.md'.length);
        if (desired.has(agentId)) {
            continue;
        }
        const file = path.join(agentsDir, name);
        try {
            fs.rmSync(file, { force: true });
            result.removed.push(toProjectPath(projectRoot, file));
        } catch (error) {
            result.warnings.push(`Pi orphan agent 清理失败（${name}）：${(error as Error).message}`);
        }
    }

    return result;
}

/**
 * 移除全部由本工具管理的 Pi agent 定义（uninstall 用）。
 *
 * 只处理 `iagent-` 前缀 `.md` 文件；用户自建 agent 与承载目录保留。
 */
export function removePiNativeAgents(projectRoot: string): string[] {
    const agentsDir = path.join(projectRoot, PI_AGENTS_DIR);
    const removed: string[] = [];
    for (const name of listManagedAgentFiles(agentsDir)) {
        const file = path.join(agentsDir, name);
        try {
            fs.rmSync(file, { force: true });
            removed.push(toProjectPath(projectRoot, file));
        } catch {
            // 单文件失败不阻断其余清理
        }
    }
    return removed;
}

/** 解析 frontmatter 中的 `name`（缺失时返回 undefined） */
function parseFrontmatterName(content: string): { parsed: boolean; name?: string } {
    if (!content.startsWith('---')) {
        return { parsed: false };
    }
    const end = content.indexOf('\n---', 3);
    if (end === -1) {
        return { parsed: false };
    }
    const block = content.slice(3, end);
    const match = block.match(/^name\s*:\s*(.+)$/m);
    if (!match) {
        return { parsed: true };
    }
    let value = match[1].trim();
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        value = value.slice(1, -1);
    }
    return { parsed: true, name: value };
}

/**
 * 扫描所需 agent 定义的可解析性。
 *
 * 可解析 = 文件存在 ∧ frontmatter 可解析 ∧（`name` 或文件名）等于期望 `subagent_type`。
 */
export function scanPiAgentDefinitions(
    projectRoot: string,
    requiredAgentIds: readonly string[]
): PiAgentDefinitionScan {
    const agentsDir = path.join(projectRoot, PI_AGENTS_DIR);
    const required = [...new Set(requiredAgentIds)];
    const scan: PiAgentDefinitionScan = {
        dir: PI_AGENTS_DIR,
        required,
        resolvable: [],
        missing: [],
        invalid: [],
    };

    for (const agentId of required) {
        const file = path.join(agentsDir, `${agentId}.md`);
        if (!fs.existsSync(file)) {
            scan.missing.push(agentId);
            continue;
        }
        let content: string;
        try {
            content = fs.readFileSync(file, 'utf8');
        } catch {
            scan.invalid.push(agentId);
            continue;
        }
        const frontmatter = parseFrontmatterName(content);
        if (!frontmatter.parsed) {
            scan.invalid.push(agentId);
            continue;
        }
        // `name` 缺省时上游按文件名解析，因此文件名匹配即可
        if (frontmatter.name !== undefined && frontmatter.name !== agentId) {
            scan.invalid.push(agentId);
            continue;
        }
        scan.resolvable.push(agentId);
    }

    return scan;
}
