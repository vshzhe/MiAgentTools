/**
 * venus uninstall 命令。
 *
 * 干净移除 venus 安装的产物：
 *   - .claude/skills/venus_<type>_<name>/     全部 venus 技能
 *   - .claude/commands/venus/                 全部斜杠指令
 *   - .venus/                                  项目配置（默认保留，--purge-config 才删）
 *
 * 安全边界：
 *   - 只删 venus_ 前缀的技能目录与 venus 命名空间的指令目录，其他技能不碰
 *   - generate 产物的技能名同样是 venus_ 前缀，一并清理（它们也是 venus 管理的）
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    AI_TOOLS,
    SKILL_PREFIX,
    TOOL_COMMANDS_SUBDIR,
    TOOL_SKILLS_SUBDIR,
} from '../core/config.js';
import { VENUS_DIR_NAME } from '../core/project-config.js';
import { listSubdirectories, pathExists } from '../utils/file-system.js';

/** uninstall 命令选项 */
export interface UninstallOptions {
    /** 连同 .venus/ 项目配置一起删除（默认保留） */
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
    /** 是否删除了 .venus 配置 */
    configRemoved: boolean;
    /** 跳过（非 venus 管理）的目录 */
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
        // 1. 技能目录：只删 venus_ 前缀
        const skillsRoot = path.join(projectRoot, tool.skillsDir, TOOL_SKILLS_SUBDIR);
        for (const dirName of listSubdirectories(skillsRoot)) {
            if (!dirName.startsWith(SKILL_PREFIX)) {
                skipped.push(path.relative(projectRoot, path.join(skillsRoot, dirName)));
                continue;
            }
            if (!options.dryRun) {
                fs.rmSync(path.join(skillsRoot, dirName), { recursive: true, force: true });
            }
            removedSkills.push(dirName);
        }

        // 2. 指令目录：venus 命名空间整体删除
        const commandsDir = path.join(projectRoot, tool.commandsDir, TOOL_COMMANDS_SUBDIR);
        if (pathExists(commandsDir)) {
            const files = fs.readdirSync(commandsDir);
            for (const file of files) {
                removedCommands.push(file);
            }
            if (!options.dryRun) {
                fs.rmSync(commandsDir, { recursive: true, force: true });
            }
        }
    }

    // 3. 项目配置（默认保留：可能包含用户维护的 rules）
    if (options.purgeConfig) {
        const venusDir = path.join(projectRoot, VENUS_DIR_NAME);
        if (pathExists(venusDir)) {
            if (!options.dryRun) {
                fs.rmSync(venusDir, { recursive: true, force: true });
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
    const lines: string[] = ['Venus 卸载完成：'];
    lines.push(`  技能：${result.removedSkills.length} 个`);
    for (const skill of result.removedSkills) {
        lines.push(`    - ${skill}`);
    }
    lines.push(`  指令：${result.removedCommands.length} 个（.claude/commands/venus/）`);
    if (result.configRemoved) {
        lines.push('  配置：.venus/ 已删除');
    } else {
        lines.push('  配置：.venus/ 已保留（venus uninstall --purge-config 一并删除）');
    }
    if (result.skipped.length > 0) {
        lines.push(`  跳过（非 venus 管理）：${result.skipped.length} 个目录`);
    }
    return lines.join('\n');
}
