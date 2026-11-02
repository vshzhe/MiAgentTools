/**
 * reconcile 扫描：识别已安装但不在生效 workflow 集内的 iagent 产物。
 *
 * 供 init/update 在过滤生成后扫描遗留 —— 保留不删，仅收集供输出提示用户手工处理。
 * 复用 uninstall 的产物识别模式（iagent- / legacy iagent_ 技能目录 + iagent 命名空间指令文件）。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { AI_TOOLS, TOOL_SKILLS_SUBDIR } from './config.js';
import { isManagedSkillDirName, skillIdToWorkflowId, SKILL_ID_PREFIX } from './skill-id.js';
import { listManagedCommands } from './command-artifacts.js';
import { listSubdirectories } from '../utils/file-system.js';
import { PI_AGENTS_DIR, PI_ORCHESTRATOR_AGENT_ID } from './pi-native.js';
import { OPENCODE_AGENTS_DIR, ORCHESTRATOR_AGENT_ID } from './opencode-v2.js';

/** reconcile 扫描结果 */
export interface ReconcileOrphans {
    /** 已装但不在生效集的技能路径（项目相对，如 .claude/skills/iagent-feature） */
    skills: string[];
    /** 已装但不在生效集的指令路径（项目相对，如 .claude/commands/iagent/feature.md） */
    commands: string[];
    /**
     * 已装但不在生效集的宿主原生 agent 定义（Pi + OpenCode；项目相对，
     * 如 .pi/agents/iagent-feature.md、.opencode/agents/iagent-feature.md）
     */
    agents: string[];
}

/** orphan 提示总数（技能 + 指令 + 宿主原生 agent 定义） */
export function reconcileOrphanCount(orphans: ReconcileOrphans): number {
    return orphans.skills.length + orphans.commands.length + orphans.agents.length;
}

/**
 * 扫描某宿主原生 agent 目录下已装但不在生效 workflow 集内的 `iagent-*.md`。
 *
 * 只处理 canonical `iagent-` 前缀 `.md` 文件：orchestrator 不属任何 workflow，
 * 始终视为受管而非 orphan；非 `iagent-` 前缀的用户自建 agent 不受影响。
 */
function scanOrphanAgents(
    projectRoot: string,
    agentsDirRel: string,
    orchestratorId: string,
    set: ReadonlySet<string>
): string[] {
    const agentsDir = path.join(projectRoot, agentsDirRel);
    if (!fs.existsSync(agentsDir)) {
        return [];
    }
    const orphans: string[] = [];
    for (const name of fs.readdirSync(agentsDir)) {
        if (!name.startsWith(SKILL_ID_PREFIX) || !name.endsWith('.md')) {
            continue;
        }
        const agentId = name.slice(0, -'.md'.length);
        if (agentId === orchestratorId) {
            continue;
        }
        const wfId = agentId.slice(SKILL_ID_PREFIX.length);
        if (!set.has(wfId)) {
            orphans.push(
                path.relative(projectRoot, path.join(agentsDir, name)).replaceAll('\\', '/')
            );
        }
    }
    return orphans;
}

/**
 * 扫描各工具目录下已安装但不在生效 workflow 集内的 iagent 产物。
 *
 * 覆盖：技能目录、指令产物，以及宿主原生 agent 定义
 * （`.pi/agents/` 与 `.opencode/agents/`）。
 *
 * @param projectRoot - 项目根目录
 * @param effectiveWorkflows - 生效 workflow id 集合（含依赖注入补全项）
 */
export function scanReconcileOrphans(
    projectRoot: string,
    effectiveWorkflows: readonly string[]
): ReconcileOrphans {
    const set = new Set(effectiveWorkflows);
    const skills: string[] = [];
    const commands: string[] = [];
    const agents: string[] = [];

    for (const tool of AI_TOOLS) {
        // 技能目录：canonical `iagent-` 与 legacy `iagent_` 两种前缀，派生 workflowId 与生效集比对
        const skillsRoot = path.join(projectRoot, tool.skillsDir, TOOL_SKILLS_SUBDIR);
        for (const dirName of listSubdirectories(skillsRoot)) {
            if (!isManagedSkillDirName(dirName)) {
                continue;
            }
            const wfId = skillIdToWorkflowId(dirName);
            if (!set.has(wfId)) {
                skills.push(path.relative(projectRoot, path.join(skillsRoot, dirName)));
            }
        }

        // 指令文件：iagent 命名产物（按工具布局识别），文件名去后缀/前缀即 workflowId
        for (const artifact of listManagedCommands(projectRoot, tool)) {
            if (!set.has(artifact.id)) {
                commands.push(artifact.path);
            }
        }
    }

    // 宿主原生 agent 定义（纯生成物，按 canonical `iagent-<workflowId>.md` 识别）
    agents.push(...scanOrphanAgents(projectRoot, PI_AGENTS_DIR, PI_ORCHESTRATOR_AGENT_ID, set));
    agents.push(...scanOrphanAgents(projectRoot, OPENCODE_AGENTS_DIR, ORCHESTRATOR_AGENT_ID, set));

    return { skills, commands, agents };
}
