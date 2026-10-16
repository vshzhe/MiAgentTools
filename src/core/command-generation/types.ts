/**
 * 指令生成类型定义。
 *
 * 工具无关接口：将"生成什么内容"与"如何格式化"分离。
 * 每个目标 AI 工具实现 ToolCommandAdapter 处理各自的路径与 frontmatter 格式。
 */

import type { SkillTemplate } from '../templates/types.js';

/** 工具无关的指令内容 */
export interface CommandContent {
    /** 指令标识（文件名，不含 .md，如 pwd） */
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
    /**
     * allowed-tools 白名单（frontmatter allowed-tools）。
     * **必填**：作为「白名单必须存在」的强制校验点——构建 CommandContent 时
     * 若不透传配对技能的白名单即类型报错。
     */
    allowedTools: string;
    /** 生成器版本号（写入 metadata.generatedBy） */
    generatedBy?: string;
}

/** 每个目标工具的格式化策略 */
export interface ToolCommandAdapter {
    /** 工具标识（对应 AIToolOption.value，如 'claude'） */
    toolId: string;
    /**
     * 返回指令文件路径（项目根相对）。
     * @param commandId - 指令标识（如 'spec-apply'）
     */
    getFilePath(commandId: string): string;
    /**
     * 格式化完整文件内容（含 frontmatter）。
     * @param content - 工具无关的指令内容
     * @param fingerprintPlaceholder - 可选指纹占位行（空字符串表示两趟拼装的占位态）
     */
    formatFile(content: CommandContent, fingerprintPlaceholder?: string): string;
}

/** 指令文件生成结果 */
export interface GeneratedCommand {
    /** 项目根相对路径 */
    path: string;
    /** 完整文件内容（frontmatter + 正文） */
    fileContent: string;
    /** 产物指纹占位行（供 command 适配器拼接 frontmatter 时回填） */
    fingerprintPlaceholder: string;
}

/** SKILL.md 文件生成结果 */
export interface GeneratedSkill {
    /** 安装目录名（iagent_<type>_<name>） */
    dirName: string;
    /** 完整文件内容（frontmatter + 正文） */
    fileContent: string;
    /** 附加参考文件（与模板 references 透传，生成时一并写入技能目录） */
    references?: Array<{ path: string; content: string }>;
}

/** 技能模板的引用来源（built-in 模板或 generate 命令产生的骨架） */
export type SkillSource = SkillTemplate;
