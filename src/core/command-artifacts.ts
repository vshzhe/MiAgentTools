/**
 * 指令产物布局与归属的单一来源。
 *
 * 目标工具的指令产物有两种布局（见 AIToolOption.commandsLayout）：
 *   - namespace-dir：`<commandsDir>/<namespace>/<id>.md`（Claude Code）
 *   - prefixed-file：`<commandsDir>/<namespace>-<id>.md`（Pi prompts 扁平布局）
 *
 * 生成侧（适配器）用 `commandFilePath` 取落点；reconcile / uninstall / 旧产物清理
 * 用 `listManagedCommands` / `removeManagedCommands` 做归属识别与删除。
 *
 * 所有函数 MUST 先判空 `commandsDir` 再解析布局 —— skills-only 工具（如 codex）无指令
 * 产物，`path.join` 会退化为项目根下的同名目录，故必须整体跳过。
 * `prefixed-file` 与 OpenSpec 的 `opsx-*` 及用户自建 prompt 共目录，归属识别严格限定
 * 为 `<namespace>-` 前缀，且删除 MUST NOT 移除承载目录本身。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { AI_TOOLS, TOOL_COMMANDS_SUBDIR, type AIToolOption } from './config.js';
import { pathExists } from '../utils/file-system.js';

/** 已安装的 iagent 指令产物 */
export interface ManagedCommandArtifact {
    /** 所属工具 id */
    tool: string;
    /** 指令 id（如 pwd、spec-apply） */
    id: string;
    /** 项目相对路径（统一正斜杠） */
    path: string;
}

/** 早期版本错误生成 Pi 指令的位置（项目相对）；仅用于布局迁移清理 */
export const MISPLACED_COMMANDS_DIR = path.join(
    AI_TOOLS.find((t) => t.value === 'pi')?.skillsDir ?? '.pi',
    'commands',
    TOOL_COMMANDS_SUBDIR
);

/** 统一正斜杠（Windows 兼容） */
function toPosix(p: string): string {
    return p.replaceAll('\\', '/');
}

/** 工具若产出指令，返回其项目相对承载目录；skills-only（commandsDir 为空）返回 null */
function commandsDirOf(tool: AIToolOption): string | null {
    return tool.commandsDir === '' ? null : tool.commandsDir;
}

/**
 * 指令产物的项目相对路径（工具无关单点，生成侧与识别侧共用）。
 *
 * @throws 未知工具标识，或该工具为 skills-only 模式（无指令产物）
 */
export function commandFilePath(toolId: string, commandId: string): string {
    const tool = AI_TOOLS.find((t) => t.value === toolId);
    if (!tool) {
        throw new Error(`未知的工具标识：${toolId}（可选：${AI_TOOLS.map((t) => t.value).join(', ')}）`);
    }
    const dir = commandsDirOf(tool);
    if (dir === null) {
        throw new Error(`工具 ${toolId} 为 skills-only 模式，无指令产物`);
    }
    if (tool.commandsLayout === 'prefixed-file') {
        return path.join(dir, `${TOOL_COMMANDS_SUBDIR}-${commandId}.md`);
    }
    return path.join(dir, TOOL_COMMANDS_SUBDIR, `${commandId}.md`);
}

/**
 * 列出某工具已安装的 iagent 指令产物（目录不存在返回空数组）。
 * 仅识别本工具命名产物：namespace-dir 取命名空间子目录内全部 `.md`；
 * prefixed-file 仅取 `<namespace>-` 前缀的 `.md`。
 */
export function listManagedCommands(
    projectRoot: string,
    tool: AIToolOption
): ManagedCommandArtifact[] {
    const dir = commandsDirOf(tool);
    if (dir === null) {
        return [];
    }
    const out: ManagedCommandArtifact[] = [];
    if (tool.commandsLayout === 'prefixed-file') {
        const abs = path.join(projectRoot, dir);
        if (!pathExists(abs)) {
            return out;
        }
        const prefix = `${TOOL_COMMANDS_SUBDIR}-`;
        const suffix = '.md';
        for (const name of fs.readdirSync(abs)) {
            if (!name.startsWith(prefix) || !name.endsWith(suffix)) {
                continue;
            }
            out.push({
                tool: tool.value,
                id: name.slice(prefix.length, name.length - suffix.length),
                path: toPosix(path.relative(projectRoot, path.join(abs, name))),
            });
        }
        return out;
    }
    const abs = path.join(projectRoot, dir, TOOL_COMMANDS_SUBDIR);
    if (!pathExists(abs)) {
        return out;
    }
    for (const name of fs.readdirSync(abs)) {
        if (!name.endsWith('.md')) {
            continue;
        }
        out.push({
            tool: tool.value,
            id: name.slice(0, -'.md'.length),
            path: toPosix(path.relative(projectRoot, path.join(abs, name))),
        });
    }
    return out;
}

/**
 * 删除某工具的全部 iagent 指令产物。
 * namespace-dir：整体删除命名空间子目录；
 * prefixed-file：仅删除 `<namespace>-` 前缀文件，保留承载目录与其它文件（如 `opsx-*`）。
 *
 * @returns 已删除条目（文件或目录）的项目相对路径；目录不存在返回空数组
 */
export function removeManagedCommands(projectRoot: string, tool: AIToolOption): string[] {
    const dir = commandsDirOf(tool);
    if (dir === null) {
        return [];
    }
    if (tool.commandsLayout === 'prefixed-file') {
        const abs = path.join(projectRoot, dir);
        if (!pathExists(abs)) {
            return [];
        }
        const prefix = `${TOOL_COMMANDS_SUBDIR}-`;
        const removed: string[] = [];
        for (const name of fs.readdirSync(abs)) {
            if (!name.startsWith(prefix) || !name.endsWith('.md')) {
                continue;
            }
            const target = path.join(abs, name);
            fs.rmSync(target, { force: true });
            removed.push(toPosix(path.relative(projectRoot, target)));
        }
        return removed;
    }
    const abs = path.join(projectRoot, dir, TOOL_COMMANDS_SUBDIR);
    if (!pathExists(abs)) {
        return [];
    }
    const removed = fs
        .readdirSync(abs)
        .map((name) => toPosix(path.relative(projectRoot, path.join(abs, name))));
    fs.rmSync(abs, { recursive: true, force: true });
    return removed;
}

/** 旧位置清理结果 */
export interface MisplacedCleanupResult {
    /** 已删除条目的项目相对路径 */
    removed: string[];
    /** 清理失败时的告警（非阻断） */
    warning?: string;
}

/**
 * 清理早期版本错误生成到 `.pi/commands/iagent/` 的指令产物（幂等）。
 * 失败 MUST NOT 抛出 —— 降级为告警，不阻断 init/update 主流程。
 */
export function cleanupMisplacedCommands(projectRoot: string): MisplacedCleanupResult {
    const abs = path.join(projectRoot, MISPLACED_COMMANDS_DIR);
    if (!pathExists(abs)) {
        return { removed: [] };
    }
    try {
        const removed = fs
            .readdirSync(abs)
            .map((name) => toPosix(path.relative(projectRoot, path.join(abs, name))));
        fs.rmSync(abs, { recursive: true, force: true });
        return { removed };
    } catch (error) {
        return {
            removed: [],
            warning: `清理 ${toPosix(MISPLACED_COMMANDS_DIR)}/ 失败（已跳过）：${(error as Error).message}`,
        };
    }
}
