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
import { getSkillTemplates } from './templates/index.js';
import { escapeYamlValue } from './command-generation/yaml.js';
import { normalizeHostSkillRefs } from './command-generation/host-refs.js';
import {
    defaultOrchestrationDelegations,
    type OrchestrationDelegations,
} from './host-orchestration/render.js';

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

/**
 * 从 `allowedTools` 派生 OpenCode V2 `shell` 资源串。
 *
 * 语法依据（OpenCode V2 Permissions 文档核实）：V2 使用 `permissions` 数组 +
 * `{ action, resource, effect }`，命令动作名为 **`shell`**，resource 为命令串
 * （前缀按「命令 + 空格」匹配，如 `"git "` 放行 `git status`）。故 Claude 侧
 * `Bash(<cmd>:*)` 映射为 `<cmd> `（MUST NOT 映射为 `bash *` 全量放行）。
 *
 * 正则**非锚定全局匹配**（`allowedTools` 是逗号拼接串，`^`/`$` 锚定会全不匹配），
 * 且命令段允许空格 —— 支持多词子命令 `Bash(git status:*)` → `"git status "`。
 * `Bash(<cmd>:<literal>)` 等无通配写法不派生（列表外）。
 */
export function collectShellPrefixes(allowedTools: readonly string[]): string[] {
    const prefixes: string[] = [];
    for (const tools of allowedTools) {
        for (const match of tools.matchAll(/Bash\(([a-zA-Z0-9._-]+(?:\s+[a-zA-Z0-9._-]+)*):\*\)/g)) {
            const prefix = `${match[1]} `;
            if (!prefixes.includes(prefix)) {
                prefixes.push(prefix);
            }
        }
    }
    return prefixes;
}

/** 是否携带子代理派发条目（`Agent` / `Task` 任一） */
export function hasDispatchEntry(allowedTools: string): boolean {
    return /(^|, )\s*(Agent|Task)\s*(,|$)/.test(allowedTools);
}

/** 是否携带写入类授权（`Write` / `Edit` 任一，用于按需授予 `edit` 权限） */
export function hasWriteEntry(allowedTools: string): boolean {
    return /(^|, )\s*(Write|Edit)\s*(,|$)/.test(allowedTools);
}

/**
 * 渲染 worker agent 的 `permissions` 段（skill / 条件 subagent / 条件 edit / question / shell）。
 *
 * 最小权限：
 *   - `edit` 仅在阶段模板 `allowedTools` 含 `Write` / `Edit` 时授予（`grantEdit`），
 *     只读技能（review / proposal-review / spec-verify*）不得获得；
 *   - `question` 对所有阶段 worker 授予（门控与澄清交互必需）。
 */
function renderWorkerPermissions(options: {
    workflowId: string;
    skillIds: readonly string[];
    grantSubagent: boolean;
    shellPrefixes: readonly string[];
    grantEdit: boolean;
}): string[] {
    const lines: string[] = [];
    lines.push('permissions:');
    lines.push('  - action: read');
    lines.push('    resource: "*"');
    lines.push('    effect: allow');
    lines.push('  - action: question');
    lines.push('    resource: "*"');
    lines.push('    effect: allow');
    if (options.grantEdit) {
        lines.push('  - action: edit');
        lines.push('    resource: "*"');
        lines.push('    effect: allow');
    }
    const skillIds = [...new Set([`${SKILL_ID_PREFIX}${options.workflowId}`, ...options.skillIds])];
    for (const id of skillIds) {
        lines.push('  - action: skill');
        lines.push(`    resource: "${id}"`);
        lines.push('    effect: allow');
    }
    if (options.grantSubagent) {
        lines.push('  - action: subagent');
        lines.push(`    resource: "${iagentResourcePattern()}"`);
        lines.push('    effect: allow');
    }
    for (const prefix of options.shellPrefixes) {
        lines.push('  - action: shell');
        lines.push(`    resource: ${JSON.stringify(prefix)}`);
        lines.push('    effect: allow');
    }
    return lines;
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
- 收到 \`status=ok\` 回执并校验通过后 MUST 在同一用户回合内继续下一阶段（先工具调用后文字），MUST NOT 以回执结束回合；
- 停点只允许门白名单内的确认门，且停点前 MUST 引用合法门 id（类别 id 或锚点 id，\`destructive-change\` 用类别 id）；
- 回执 MUST NOT 作为面向用户的最终消息（用户可见至多一行进度）；
- MUST NOT 把 worker 的本地执行标记为委派完成；
- MUST NOT 越权完成未分配阶段。
`;
}

/** 渲染阶段 worker agent（subagent，负责单阶段任务并返回回执） */
export function renderWorkerAgent(
    workflowId: string,
    description: string,
    options: {
        /** 该阶段实际委派目标（canonical skill ID） */
        skillIds?: readonly string[];
        /** 该阶段模板是否含派发条目（`Agent` / `Task`） */
        grantSubagent?: boolean;
        /** 该阶段正文实际使用的命令前缀（`<cmd> `） */
        shellPrefixes?: readonly string[];
        /** 该阶段模板是否含写入类授权（`Write` / `Edit`） */
        grantEdit?: boolean;
    } = {}
): string {
    const permissions = renderWorkerPermissions({
        workflowId,
        skillIds: options.skillIds ?? [],
        grantSubagent: options.grantSubagent === true,
        shellPrefixes: options.shellPrefixes ?? [],
        grantEdit: options.grantEdit === true,
    });
    const skillId = `${SKILL_ID_PREFIX}${workflowId}`;
    return `---
description: ${escapeYamlValue(normalizeHostSkillRefs(description))}
mode: subagent
${permissions.join('\n')}
---

你是 iagent 阶段 worker，负责 workflowId 为 \`${workflowId}\` 的阶段。

执行本阶段前，先使用 \`skill\` 工具加载 \`${skillId}\`（\`${OPENCODE_DIR}/skills/${skillId}/SKILL.md\`）获取完整阶段规程。

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
    /** 需要允许的 shell 命令前缀（`<cmd> `，由 `Bash(<cmd>:*)` 派生） */
    shellPrefixes?: readonly string[];
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
    for (const prefix of fragment.shellPrefixes ?? []) {
        rules.push({ action: 'shell', resource: prefix, effect: 'allow' });
    }
    return rules;
}

/**
 * 判断某权限规则是否由 iagent 管理（用于增量合并时替换自身条目，保留用户条目）。
 *
 * - `skill` / `subagent`：resource 以 `iagent-` 前缀开头即归属 iagent；
 * - `shell`：resource 命中本次派生清单且 effect 为 allow 才归属 iagent ——
 *   用户自建的 deny / ask 规则 MUST NOT 被删除（最小破坏）。
 */
function isIagentRule(rule: unknown, managedShellPrefixes: readonly string[] = []): boolean {
    if (typeof rule !== 'object' || rule === null) {
        return false;
    }
    const r = rule as { action?: unknown; resource?: unknown; effect?: unknown };
    if (r.action === 'shell') {
        return (
            typeof r.resource === 'string' &&
            r.effect === 'allow' &&
            managedShellPrefixes.includes(r.resource)
        );
    }
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
    const userRules = existingRules.filter((r) => !isIagentRule(r, fragment.shellPrefixes ?? []));
    parsed.permissions = [...userRules, ...rules];
    return { content: JSON.stringify(parsed, null, 2) + '\n', created: false };
}

/** OpenCode V2 项目产物写入结果 */
export interface OpenCodeProjectArtifactsResult {
    /** 写出的 agent 文件（项目相对） */
    agents: string[];
    /** 清理的 orphan agent 文件（项目相对） */
    removed: string[];
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
    /** 该阶段技能模板的 allowedTools（用于派生 shell / subagent / 委派目标） */
    allowedTools?: string;
}

/**
 * 写入 OpenCode V2 项目级编排产物：orchestrator + 各阶段 worker agent + 项目级 permissions。
 *
 * 权限翻译完整性（变更 fix-mode-delegation-host-parity / fix-multi-agent-skill-command-generation）：
 *   - `skill`：项目级覆盖全部阶段 agent 与其实际委派目标；worker 额外覆盖「自身 + 委派目标」；
 *   - `subagent`：项目级覆盖 iagent agent；worker 仅在其模板含派发条目时授予（资源限定 `iagent-*`）；
 *   - `edit`：worker 仅在其模板 `allowedTools` 含 `Write` / `Edit` 时授予（只读技能最小权限）；
 *   - `question`：所有阶段 worker 均授予（门控与澄清交互必需）；
 *   - `shell`：由 `Bash(<cmd>:*)` 前缀派生（`<cmd> `，支持多词子命令），MUST NOT 出现全量放行；
 *   - MCP：不生成猜测性规则，缺口进入 `warnings` 诊断。
 *
 * agent 定义为纯生成物：生效集缩小后清理 `.opencode/agents/` 下的 `iagent-*.md` orphan
 * （保留 orchestrator 与用户自建非 `iagent-` 文件）。增量合并配置文件，保留用户既有字段
 * 与非 iagent 规则；失败降级为告警，不抛出。
 */
export function writeOpenCodeProjectArtifacts(
    projectRoot: string,
    stages: readonly OpenCodeStageEntry[],
    orchestration: OrchestrationDelegations = defaultOrchestrationDelegations()
): OpenCodeProjectArtifactsResult {
    const result: OpenCodeProjectArtifactsResult = {
        agents: [],
        removed: [],
        configFile: OPENCODE_CONFIG_FILE,
        configCreated: false,
        warnings: [],
    };

    const allToolSets = stages.map((stage) => stage.allowedTools ?? '');
    const shellPrefixes = collectShellPrefixes(allToolSets);
    const delegatedSkillIds = [
        ...new Set(
            stages.flatMap((stage) =>
                (orchestration.delegations[stage.workflowId] ?? []).map(
                    (target) => `${SKILL_ID_PREFIX}${target}`
                )
            )
        ),
    ];
    // MCP 缺口诊断：iagent MUST NOT 生成猜测性 MCP 规则
    const mcpServers = [
        ...new Set(
            allToolSets.flatMap((tools) =>
                [...tools.matchAll(/mcp__([a-zA-Z0-9]+)(?![a-zA-Z0-9_])/g)].map((match) => match[1])
            )
        ),
    ];
    if (mcpServers.length > 0) {
        result.warnings.push(
            `OpenCode MCP 权限缺口：iagent 不生成猜测性 MCP 规则，未覆盖 ${mcpServers.join(', ')}（请在 OpenCode 用户级 / 项目级配置中自行授权）`
        );
    }

    const agentsDir = path.join(projectRoot, OPENCODE_AGENTS_DIR);
    const expectedFiles = new Set<string>([`${ORCHESTRATOR_AGENT_ID}.md`]);
    try {
        fs.mkdirSync(agentsDir, { recursive: true });
        const orchestratorFile = path.join(agentsDir, `${ORCHESTRATOR_AGENT_ID}.md`);
        fs.writeFileSync(orchestratorFile, renderOrchestratorAgent(), 'utf8');
        result.agents.push(`${OPENCODE_AGENTS_DIR}/${ORCHESTRATOR_AGENT_ID}.md`);

        for (const stage of stages) {
            const id = openCodeAgentId(stage.workflowId);
            expectedFiles.add(`${id}.md`);
            const file = path.join(agentsDir, `${id}.md`);
            const delegated = (orchestration.delegations[stage.workflowId] ?? []).map(
                (target) => `${SKILL_ID_PREFIX}${target}`
            );
            fs.writeFileSync(
                file,
                renderWorkerAgent(stage.workflowId, stage.description, {
                    skillIds: delegated,
                    grantSubagent: hasDispatchEntry(stage.allowedTools ?? ''),
                    shellPrefixes: collectShellPrefixes([stage.allowedTools ?? '']),
                    grantEdit: hasWriteEntry(stage.allowedTools ?? ''),
                }),
                'utf8'
            );
            result.agents.push(`${OPENCODE_AGENTS_DIR}/${id}.md`);
        }

        // orphan 清理：生效集缩小后移除不再需要的 `iagent-*.md`
        // （保留 orchestrator 与非 `iagent-` 前缀的用户自建 agent）
        for (const name of fs.readdirSync(agentsDir)) {
            if (!name.startsWith(SKILL_ID_PREFIX) || !name.endsWith('.md')) {
                continue;
            }
            if (expectedFiles.has(name)) {
                continue;
            }
            const target = path.join(agentsDir, name);
            try {
                fs.rmSync(target, { force: true });
                result.removed.push(`${OPENCODE_AGENTS_DIR}/${name}`);
            } catch (error) {
                result.warnings.push(
                    `OpenCode orphan agent 清理失败（${name}）：${(error as Error).message}`
                );
            }
        }
    } catch (error) {
        result.warnings.push(`OpenCode V2 agent 写入失败（已跳过）：${(error as Error).message}`);
    }

    const configPath = path.join(projectRoot, OPENCODE_CONFIG_FILE);
    const existing = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : undefined;
    const merged = mergeOpenCodeProjectConfig(existing, {
        skillIds: [
            ...new Set([...stages.map((s) => openCodeAgentId(s.workflowId)), ...delegatedSkillIds]),
        ],
        agentIds: [ORCHESTRATOR_AGENT_ID, ...stages.map((s) => openCodeAgentId(s.workflowId))],
        shellPrefixes,
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
        const managedShellPrefixes = collectShellPrefixes(
            getSkillTemplates().map(({ template }) => template.allowedTools)
        );
        try {
            const parsed = JSON.parse(stripJsonc(raw)) as Record<string, unknown>;
            const rules = Array.isArray(parsed.permissions) ? (parsed.permissions as unknown[]) : [];
            const userRules = rules.filter((r) => !isIagentRule(r, managedShellPrefixes));
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
