/**
 * 指令生成类型定义。
 *
 * 工具无关接口：将"生成什么内容"与"如何格式化"分离。
 * 每个目标 AI 工具实现 ToolCommandAdapter 处理各自的路径与 frontmatter 格式。
 */

import type { SkillTemplate } from '../templates/types.js';

/** 工具无关的指令内容 */
export interface CommandContent {
    /** 指令标识（文件名，不含 .md，如 tr-tools-pwd） */
    id: string;
    /** 展示名 */
    name: string;
    /** 简述 */
    description: string;
    /** 分组类别 */
    category: string;
    /** 标签 */
    tags: string[];
    /** 指令正文 */
    body: string;
}

/** 每个目标工具的格式化策略 */
export interface ToolCommandAdapter {
    /** 工具标识（对应 AIToolOption.value，如 'claude'） */
    toolId: string;
    /**
     * 返回指令文件路径（项目根相对）。
     * @param commandId - 指令标识（如 'tr-tools-pwd'）
     */
    getFilePath(commandId: string): string;
    /**
     * 格式化完整文件内容（含 frontmatter）。
     * @param content - 工具无关的指令内容
     */
    formatFile(content: CommandContent): string;
}

/** 指令文件生成结果 */
export interface GeneratedCommand {
    /** 项目根相对路径 */
    path: string;
    /** 完整文件内容（frontmatter + 正文） */
    fileContent: string;
}

/** SKILL.md 文件生成结果 */
export interface GeneratedSkill {
    /** 安装目录名（venus_<type>_<name>） */
    dirName: string;
    /** 完整文件内容（frontmatter + 正文） */
    fileContent: string;
    /** 附加参考文件（与模板 references 透传，生成时一并写入技能目录） */
    references?: Array<{ path: string; content: string }>;
}

/** 技能模板的引用来源（built-in 模板或 generate 命令产生的骨架） */
export type SkillSource = SkillTemplate;
