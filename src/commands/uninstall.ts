/**
 * iagent uninstall 命令。
 *
 * 干净移除 iagent 安装的产物：
 *   - .claude/skills/iagent_<type>_<name>/     全部 iagent 技能
 *   - .claude/commands/iagent/                 全部斜杠指令
 *   - .iagent/                                  项目配置（默认保留，--purge-config 才删）
 *
 * 安全边界：
 *   - 只删 iagent_ 前缀的技能目录与 iagent 命名空间的指令目录，其他技能不碰
 *   - generate 产物的技能名同样是 iagent_ 前缀，一并清理（它们也是 iagent 管理的）
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    AI_TOOLS,
    SKILL_PREFIX,
    TOOL_SKILLS_SUBDIR,
} from '../core/config.js';
import { IAGENT_DIR_NAME } from '../core/project-config.js';
import { listManagedCommands, removeManagedCommands } from '../core/command-artifacts.js';
import { listSubdirectories, pathExists } from '../utils/file-system.js';

/** uninstall 命令选项 */
export interface UninstallOptions {
    /** 连同 .iagent/ 项目配置一起删除（默认保留） */
    purgeConfig?: boolean;
    /** 跳过确认提示（CI/脚本用） */
    yes?: boolean;
    /** 干跑：只统计不删除（确认提示用） */
    dryRun?: boolean;
}

/** uninstall 执行结果 */
export interface UninstallResult {
    projectRoot: string;
    /** 已删除的技能目录 */
    removedSkills: string[];
    /** 已删除的指令文件 */
    removedCommands: string[];
    /** 是否删除了 .iagent 配置 */
    configRemoved: boolean;
    /** 跳过（非 iagent 管理）的目录 */
    skipped: string[];
}

/**
 * 预览将要删除的内容（dry-run，不删任何文件）。
 * 用于确认提示：先让用户看到影响面再 --yes。
 */
export function previewUninstall(projectRoot: string): UninstallResult {
    return runUninstall(projectRoot, { dryRun: true });
}

/**
 * 执行 uninstall。
 *
 * @param projectRoot - 项目根目录
 * @param options - 命令选项
 */
export function runUninstall(projectRoot: string, options: UninstallOptions = {}): UninstallResult {
    const removedSkills: string[] = [];
    const removedCommands: string[] = [];
    const skipped: string[] = [];
    let configRemoved = false;

    for (const tool of AI_TOOLS) {
        // 1. 技能目录：只删 iagent_ 前缀
        const skillsRoot = path.join(projectRoot, tool.skillsDir, TOOL_SKILLS_SUBDIR);
        for (const dirName of listSubdirectories(skillsRoot)) {
            if (!dirName.startsWith(SKILL_PREFIX)) {
                skipped.push(path.relative(projectRoot, path.join(skillsRoot, dirName)));
                continue;
            }
            const target = path.join(skillsRoot, dirName);
            // 边界校验：删除目标必须位于该工具的 skills 子目录之下（防越界删除）
            const rel = path.relative(skillsRoot, target);
            if (rel.startsWith('..') || path.isAbsolute(rel)) {
                skipped.push(path.relative(projectRoot, target));
                continue;
            }
            if (!options.dryRun) {
                // rmSync 对符号链接只移除链接本身、不跟随目标，故不越界删除链接指向的内容
                fs.rmSync(target, { recursive: true, force: true });
            }
            removedSkills.push(dirName);
        }

        // 2. 指令产物：按布局识别本工具命名产物
        //    namespace-dir 整体删除命名空间子目录；prefixed-file 仅删前缀文件，
        //    保留承载目录与 opsx-* 等其它文件（commandsDir 为空的工具自动被跳过）
        if (options.dryRun) {
            for (const artifact of listManagedCommands(projectRoot, tool)) {
                removedCommands.push(artifact.path);
            }
        } else {
            for (const removed of removeManagedCommands(projectRoot, tool)) {
                removedCommands.push(removed);
            }
        }
    }

    // 3. 项目配置（默认保留：可能包含用户维护的 rules）
    if (options.purgeConfig) {
        const iagentDir = path.join(projectRoot, IAGENT_DIR_NAME);
        if (pathExists(iagentDir)) {
            if (!options.dryRun) {
                fs.rmSync(iagentDir, { recursive: true, force: true });
            }
            configRemoved = true;
        }
    }

    return {
        projectRoot,
        removedSkills,
        removedCommands,
        configRemoved,
        skipped,
    };
}

/** 渲染输出 */
export function renderUninstallOutput(result: UninstallResult): string {
    const lines: string[] = ['iAgent 卸载完成：'];
    lines.push(`  技能：${result.removedSkills.length} 个`);
    for (const skill of result.removedSkills) {
        lines.push(`    - ${skill}`);
    }
    lines.push(`  指令：${result.removedCommands.length} 个（.claude/commands/iagent/）`);
    if (result.configRemoved) {
        lines.push('  配置：.iagent/ 已删除');
    } else {
        lines.push('  配置：.iagent/ 已保留（iagent uninstall --purge-config 一并删除）');
    }
    if (result.skipped.length > 0) {
        lines.push(`  跳过（非 iagent 管理）：${result.skipped.length} 个目录`);
    }
    return lines.join('\n');
}
