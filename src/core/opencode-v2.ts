/**
 * OpenCode V2 项目级编排产物生成（变更 add-host-orchestration-adapters）。
 *
 * 目标：让 iagent workflow 使用 OpenCode V2 的原生编排能力 —— 项目级 primary orchestrator
 * 与 subagent worker、V2 `permissions`（`skill` / `subagent`），而不伪造 Claude 的
 * `allowed-tools` 或 `permissions.allow`。
 *
 * 产物（均在项目 `.opencode/` 下，MUST NOT 修改用户根目录配置）：
 *   - `.opencode/agents/iagent-orchestrator.md`   主编排 agent（primary）
 *   - `.opencode/agents/iagent-<workflowId>.md`   阶段 worker（subagent）
 *   - `.opencode/opencode.jsonc`                  项目级 permissions（增量合并）
 *
 * V2 口径：使用 `permissions` 数组 + 动作 `skill` / `subagent`（而非 V1 的
 * `permission` / `task`）。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { COMMAND_NAMESPACE } from './config.js';
import { SKILL_ID_PREFIX } from './skill-id.js';

/** `.opencode/` 目录（项目相对） */
export const OPENCODE_DIR = '.opencode';

/** 项目级 agent 目录（项目相对） */
export const OPENCODE_AGENTS_DIR = `${OPENCODE_DIR}/agents`;

/** 项目级配置文件（项目相对） */
export const OPENCODE_CONFIG_FILE = `${OPENCODE_DIR}/opencode.jsonc`;

/** 主编排 agent ID */
export const ORCHESTRATOR_AGENT_ID = `${COMMAND_NAMESPACE}-orchestrator`;

/** worker agent ID（阶段） */
export function openCodeAgentId(workflowId: string): string {
    return `${SKILL_ID_PREFIX}${workflowId}`;
}

/** iagent 生成的 skill / agent ID 匹配模式（供 permissions 限定资源） */
export function iagentResourcePattern(): string {
    return `${SKILL_ID_PREFIX}*`;
}

/** 渲染主编排 agent（primary，负责阶段推进与回执汇总） */
export function renderOrchestratorAgent(): string {
    return `---
description: iagent 工作流编排器 —— 管理阶段推进、确认门与回执汇总
mode: primary
permissions:
  - action: read
    resource: "*"
    effect: allow
  - action: edit
    resource: "*"
    effect: allow
  - action: question
    resource: "*"
    effect: allow
  - action: skill
    resource: "${iagentResourcePattern()}"
    effect: allow
  - action: subagent
    resource: "${iagentResourcePattern()}"
    effect: allow
---

你是 iagent 工作流的编排器。职责：

- 按协议推进阶段，管理确认门（gate）与阶段回执（receipt）；
- 通过 \`skill\` 加载 iagent 阶段技能，通过 \`subagent\` 启动阶段 worker；
- 汇总 worker 回执后再决定推进、回退或停止；
- MUST NOT 把 worker 的本地执行标记为委派完成；
- MUST NOT 越权完成未分配阶段。
`;
}

/** 渲染阶段 worker agent（subagent，负责单阶段任务并返回回执） */
export function renderWorkerAgent(workflowId: string, description: string): string {
    return `---
description: ${description}
mode: subagent
permissions:
  - action: read
    resource: "*"
    effect: allow
  - action: edit
    resource: "*"
    effect: allow
  - action: skill
    resource: "${SKILL_ID_PREFIX}${workflowId}"
    effect: allow
---

你是 iagent 阶段 worker，负责 workflowId 为 \`${workflowId}\` 的阶段。

- 只执行被分配的阶段，MUST NOT 自行推进父 workflow 阶段；
- 完成后返回协议规定的回执：\`phase\` / \`status\` / 产物位置 / 下一步允许动作 / 失败原因（如有）。
`;
}

/** 去除 JSONC 注释与尾逗号，得到可 JSON.parse 的文本 */
function stripJsonc(text: string): string {
    let out = '';
    let inString = false;
    let inLineComment = false;
    let inBlockComment = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const next = text[i + 1];
        if (inLineComment) {
            if (c === '\n') {
                inLineComment = false;
                out += c;
            }
            continue;
        }
        if (inBlockComment) {
            if (c === '*' && next === '/') {
                inBlockComment = false;
                i++;
            }
            continue;
        }
        if (inString) {
            out += c;
            if (c === '\\') {
                out += next ?? '';
                i++;
            } else if (c === '"') {
                inString = false;
            }
            continue;
        }
        if (c === '"') {
            inString = true;
            out += c;
            continue;
        }
        if (c === '/' && next === '/') {
            inLineComment = true;
            i++;
            continue;
        }
        if (c === '/' && next === '*') {
            inBlockComment = true;
            i++;
            continue;
        }
        out += c;
    }
    // 去尾逗号
    return out.replace(/,(\s*[}\]])/g, '$1');
}

/** iagent 项目级配置片段 */
export interface OpenCodeProjectConfigFragment {
    /** 需要允许的 skill ID（canonical） */
    skillIds: readonly string[];
    /** 需要允许的 subagent ID（canonical） */
    agentIds: readonly string[];
}

/** 合并结果 */
export interface OpenCodeConfigMergeResult {
    /** 合并后的文件内容 */
    content: string;
    /** 是否为新建（false = 已存在并增量合并） */
    created: boolean;
    /** 已存在但无法解析时的告警 */
    warning?: string;
}

/** 构建 iagent 的 V2 permissions 规则（限定到 iagent 资源） */
function iagentPermissionRules(fragment: OpenCodeProjectConfigFragment): unknown[] {
    const rules: unknown[] = [];
    for (const id of fragment.skillIds) {
        rules.push({ action: 'skill', resource: id, effect: 'allow' });
    }
    for (const id of fragment.agentIds) {
        rules.push({ action: 'subagent', resource: id, effect: 'allow' });
    }
    return rules;
}

/** 判断某权限规则是否由 iagent 管理（用于增量合并时替换自身条目，保留用户条目） */
function isIagentRule(rule: unknown): boolean {
    if (typeof rule !== 'object' || rule === null) {
        return false;
    }
    const r = rule as { action?: unknown; resource?: unknown };
    return (
        (r.action === 'skill' || r.action === 'subagent') &&
        typeof r.resource === 'string' &&
        r.resource.startsWith(SKILL_ID_PREFIX)
    );
}

/**
 * 生成或增量合并项目级 `.opencode/opencode.jsonc`。
 *
 * - 文件不存在：新建，写 `$schema` + iagent permissions；
 * - 存在且可解析：移除旧的 iagent 规则后追加新规则，保留用户字段与规则；
 * - 存在但不可解析：返回告警，内容留空（调用方应保留原文件不改写）。
 *
 * @param existingContent - 现有文件内容（undefined = 不存在）
 * @param fragment - iagent 需要声明的 skill / agent ID
 */
export function mergeOpenCodeProjectConfig(
    existingContent: string | undefined,
    fragment: OpenCodeProjectConfigFragment
): OpenCodeConfigMergeResult {
    const rules = iagentPermissionRules(fragment);
    if (existingContent === undefined) {
        const doc = {
            $schema: 'https://opencode.ai/config.json',
            permissions: rules,
        };
        return { content: JSON.stringify(doc, null, 2) + '\n', created: true };
    }

    let parsed: Record<string, unknown>;
    try {
        parsed = JSON.parse(stripJsonc(existingContent)) as Record<string, unknown>;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            throw new Error('配置根不是对象');
        }
    } catch (error) {
        return {
            content: existingContent,
            created: false,
            warning: `现有 ${OPENCODE_CONFIG_FILE} 无法解析（${(error as Error).message}），已保留原文件未改动`,
        };
    }

    const existingRules = Array.isArray(parsed.permissions) ? (parsed.permissions as unknown[]) : [];
    const userRules = existingRules.filter((r) => !isIagentRule(r));
    parsed.permissions = [...userRules, ...rules];
    return { content: JSON.stringify(parsed, null, 2) + '\n', created: false };
}

/** OpenCode V2 项目产物写入结果 */
export interface OpenCodeProjectArtifactsResult {
    /** 写出的 agent 文件（项目相对） */
    agents: string[];
    /** 配置文件（项目相对） */
    configFile: string;
    /** 配置文件是否新建 */
    configCreated: boolean;
    /** 非阻断告警 */
    warnings: string[];
}

/** 需要生成 worker agent 的阶段条目 */
export interface OpenCodeStageEntry {
    workflowId: string;
    description: string;
}

/**
 * 写入 OpenCode V2 项目级编排产物：orchestrator + 各阶段 worker agent + 项目级 permissions。
 *
 * 增量合并配置文件，保留用户既有字段与非 iagent 规则；失败降级为告警，不抛出。
 */
export function writeOpenCodeProjectArtifacts(
    projectRoot: string,
    stages: readonly OpenCodeStageEntry[]
): OpenCodeProjectArtifactsResult {
    const result: OpenCodeProjectArtifactsResult = {
        agents: [],
        configFile: OPENCODE_CONFIG_FILE,
        configCreated: false,
        warnings: [],
    };

    const agentsDir = path.join(projectRoot, OPENCODE_AGENTS_DIR);
    try {
        fs.mkdirSync(agentsDir, { recursive: true });
        const orchestratorFile = path.join(agentsDir, `${ORCHESTRATOR_AGENT_ID}.md`);
        fs.writeFileSync(orchestratorFile, renderOrchestratorAgent(), 'utf8');
        result.agents.push(`${OPENCODE_AGENTS_DIR}/${ORCHESTRATOR_AGENT_ID}.md`);

        for (const stage of stages) {
            const id = openCodeAgentId(stage.workflowId);
            const file = path.join(agentsDir, `${id}.md`);
            fs.writeFileSync(file, renderWorkerAgent(stage.workflowId, stage.description), 'utf8');
            result.agents.push(`${OPENCODE_AGENTS_DIR}/${id}.md`);
        }
    } catch (error) {
        result.warnings.push(`OpenCode V2 agent 写入失败（已跳过）：${(error as Error).message}`);
    }

    const configPath = path.join(projectRoot, OPENCODE_CONFIG_FILE);
    const existing = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : undefined;
    const merged = mergeOpenCodeProjectConfig(existing, {
        skillIds: stages.map((s) => openCodeAgentId(s.workflowId)),
        agentIds: [ORCHESTRATOR_AGENT_ID, ...stages.map((s) => openCodeAgentId(s.workflowId))],
    });
    if (merged.warning) {
        result.warnings.push(merged.warning);
    } else {
        try {
            fs.mkdirSync(path.dirname(configPath), { recursive: true });
            fs.writeFileSync(configPath, merged.content, 'utf8');
            result.configCreated = merged.created;
        } catch (error) {
            result.warnings.push(`OpenCode V2 配置写入失败（已跳过）：${(error as Error).message}`);
        }
    }

    return result;
}

/**
 * 移除 iagent 管理的 OpenCode V2 项目产物（uninstall 用）。
 *
 * - 删除 `.opencode/agents/` 下 `iagent-` 前缀的 agent 文件（保留用户自建 agent 与承载目录）；
 * - 从 `.opencode/opencode.jsonc` 移除 iagent 规则；文件仅剩 iagent 内容时一并删除；
 *   不可解析时保留原文件。
 *
 * @returns 已删除条目的项目相对路径
 */
export function removeOpenCodeProjectArtifacts(projectRoot: string): string[] {
    const removed: string[] = [];

    const agentsDir = path.join(projectRoot, OPENCODE_AGENTS_DIR);
    if (fs.existsSync(agentsDir)) {
        for (const name of fs.readdirSync(agentsDir)) {
            if (!name.startsWith(`${COMMAND_NAMESPACE}-`) || !name.endsWith('.md')) {
                continue;
            }
            const target = path.join(agentsDir, name);
            fs.rmSync(target, { force: true });
            removed.push(`${OPENCODE_AGENTS_DIR}/${name}`);
        }
    }

    const configPath = path.join(projectRoot, OPENCODE_CONFIG_FILE);
    if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf8');
        try {
            const parsed = JSON.parse(
                raw
                    .replace(/\/\/.*$/gm, '')
                    .replace(/,(\s*[}\]])/g, '$1')
            ) as Record<string, unknown>;
            const rules = Array.isArray(parsed.permissions) ? (parsed.permissions as unknown[]) : [];
            const userRules = rules.filter((r) => !isIagentRule(r));
            const nonSchemaKeys = Object.keys(parsed).filter((k) => k !== '$schema' && k !== 'permissions');
            if (userRules.length === 0 && nonSchemaKeys.length === 0) {
                fs.rmSync(configPath, { force: true });
                removed.push(OPENCODE_CONFIG_FILE);
            } else {
                if (userRules.length === 0) {
                    delete parsed.permissions;
                } else {
                    parsed.permissions = userRules;
                }
                fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2) + '\n', 'utf8');
                removed.push(`${OPENCODE_CONFIG_FILE}（已移除 iagent 权限规则）`);
            }
        } catch {
            // 保留不可解析的原文件
        }
    }

    return removed;
}
