/**
 * reconcile 扫描：识别已安装但不在生效 workflow 集内的 iagent 产物。
 *
 * 供 init/update 在过滤生成后扫描遗留 —— 保留不删，仅收集供输出提示用户手工处理。
 * 复用 uninstall 的产物识别模式（iagent_ 前缀技能目录 + iagent 命名空间指令文件）。
 */

import * as path from 'node:path';
import { AI_TOOLS, SKILL_PREFIX, TOOL_SKILLS_SUBDIR } from './config.js';
import { deriveCommandId } from './templates/registry.js';
import { listManagedCommands } from './command-artifacts.js';
import { listSubdirectories } from '../utils/file-system.js';

/** reconcile 扫描结果 */
export interface ReconcileOrphans {
    /** 已装但不在生效集的技能路径（项目相对，如 .claude/skills/iagent_feature） */
    skills: string[];
    /** 已装但不在生效集的指令路径（项目相对，如 .claude/commands/iagent/feature.md） */
    commands: string[];
}

/** orphan 提示总数 */
export function reconcileOrphanCount(orphans: ReconcileOrphans): number {
    return orphans.skills.length + orphans.commands.length;
}

/**
 * 扫描 .claude/ 下已安装但不在生效 workflow 集内的 iagent 产物。
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

    for (const tool of AI_TOOLS) {
        // 技能目录：iagent_ 前缀，派生 workflowId 与生效集比对
        const skillsRoot = path.join(projectRoot, tool.skillsDir, TOOL_SKILLS_SUBDIR);
        for (const dirName of listSubdirectories(skillsRoot)) {
            if (!dirName.startsWith(SKILL_PREFIX)) {
                continue;
            }
            const wfId = deriveCommandId(dirName);
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

    return { skills, commands };
}
