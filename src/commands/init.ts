/**
 * venus init 命令。
 *
 * 将全部内置技能（SKILL.md）与斜杠指令生成到当前项目的 .claude/ 目录：
 *   .claude/skills/venus_<type>_<name>/SKILL.md
 *   .claude/commands/venus/<type>-<name>.md
 */

import path from 'path';
import { createRequire } from 'node:module';
import { getSkillTemplates, getCommandTemplates } from '../core/templates/index.js';
import {
    generateSkillContent,
    generateCommand,
    CommandAdapterRegistry,
    type GeneratedCommand,
    type ToolCommandAdapter,
    type CommandContent,
} from '../core/command-generation/index.js';
import {
    AI_TOOLS,
    TOOL_SKILLS_SUBDIR,
    type AIToolOption,
} from '../core/config.js';
import { ensureDir, writeFile, pathExists } from '../utils/file-system.js';

/** init 命令选项 */
export interface InitOptions {
    /** 目标工具 id 列表（默认全部，当前仅 claude） */
    tools?: string;
    /** 覆盖已存在文件 */
    force?: boolean;
}

/** init 执行结果（供测试与 --json 输出） */
export interface InitResult {
    projectRoot: string;
    tools: string[];
    skillsInstalled: string[];
    commandsInstalled: string[];
    skipped: string[];
}

/** 读取当前包版本（供 metadata.generatedBy） */
function getPackageVersion(): string {
    try {
        const req = createRequire(import.meta.url);
        const pkg = req('../../package.json') as { version?: string };
        return pkg.version ?? '0.0.0';
    } catch {
        return '0.0.0';
    }
}

/** 解析 --tools 参数为工具对象列表（非法值直接抛错） */
function resolveTools(toolsArg?: string): AIToolOption[] {
    const ids = toolsArg ? toolsArg.split(',').map((t) => t.trim()) : AI_TOOLS.map((t) => t.value);
    const resolved: AIToolOption[] = [];
    for (const id of ids) {
        const tool = AI_TOOLS.find((t) => t.value === id);
        if (!tool) {
            throw new Error(`未知的工具标识：${id}（可选：${AI_TOOLS.map((t) => t.value).join(', ')}）`);
        }
        resolved.push(tool);
    }
    return resolved;
}

/** 由指令模板 + 适配器生成 GeneratedCommand */
function buildCommand(
    template: { name: string; description: string; category: string; tags: string[]; content: string },
    id: string,
    adapter: ToolCommandAdapter
): GeneratedCommand {
    const content: CommandContent = {
        id,
        name: template.name,
        description: template.description,
        category: template.category,
        tags: template.tags,
        body: template.content,
    };
    return generateCommand(content, adapter);
}

/**
 * 执行 init：生成全部技能与指令文件。
 *
 * @param projectRoot - 目标项目根目录
 * @param options - 命令选项
 */
export function runInit(projectRoot: string, options: InitOptions = {}): InitResult {
    const tools = resolveTools(options.tools);
    const packageVersion = getPackageVersion();
    const skillsInstalled: string[] = [];
    const commandsInstalled: string[] = [];
    const skipped: string[] = [];

    for (const tool of tools) {
        const adapter = CommandAdapterRegistry.get(tool.value);
        if (!adapter) {
            throw new Error(`工具 '${tool.value}' 没有注册的指令适配器`);
        }

        // 1. 生成 SKILL.md（.claude/skills/venus_<type>_<name>/SKILL.md）
        const skillsRoot = path.join(projectRoot, tool.skillsDir, TOOL_SKILLS_SUBDIR);
        ensureDir(skillsRoot);
        for (const { template } of getSkillTemplates()) {
            const generated = generateSkillContent(template, packageVersion);
            const skillDir = path.join(skillsRoot, generated.dirName);
            const skillFile = path.join(skillDir, 'SKILL.md');
            if (pathExists(skillFile) && !options.force) {
                skipped.push(path.relative(projectRoot, skillFile));
                continue;
            }
            ensureDir(skillDir);
            writeFile(skillFile, generated.fileContent, { force: true });
            skillsInstalled.push(path.relative(projectRoot, skillFile));
        }

        // 2. 生成斜杠指令（.claude/commands/venus/<type>-<name>.md）
        for (const { template, id } of getCommandTemplates()) {
            const generated = buildCommand(template, id, adapter);
            const commandFile = path.join(projectRoot, generated.path);
            if (pathExists(commandFile) && !options.force) {
                skipped.push(path.relative(projectRoot, commandFile));
                continue;
            }
            writeFile(commandFile, generated.fileContent, { force: true });
            commandsInstalled.push(path.relative(projectRoot, commandFile));
        }
    }

    return {
        projectRoot,
        tools: tools.map((t) => t.value),
        skillsInstalled,
        commandsInstalled,
        skipped,
    };
}
