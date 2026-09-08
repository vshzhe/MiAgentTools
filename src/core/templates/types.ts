/**
 * 技能模板与斜杠指令模板的核心类型定义。
 */

import type { SkillType } from '../config.js';

/**
 * 技能模板（SKILL.md 的内容来源）。
 * name 必须以 venus_ 开头，且等于安装目录名。
 */
export interface SkillTemplate {
    /** 技能名称，格式：venus_<type>_<name>（同时也是安装目录名） */
    name: string;
    /** 技能描述（frontmatter description，供 AI 决定何时触发） */
    description: string;
    /** 技能正文指令 */
    instructions: string;
    /**
     * allowed-tools 白名单（frontmatter allowed-tools）。
     * 必须覆盖正文实际要运行的命令，否则技能在 Claude Code 中会被权限拦截。
     */
    allowedTools: string;
    /** 生命周期类型（frontmatter metadata.type） */
    type: SkillType;
    /** 许可证（默认 MIT） */
    license?: string;
    /** 兼容性说明 */
    compatibility?: string;
    /** 其他元数据 */
    metadata?: Record<string, string>;
}

/**
 * 斜杠指令模板（.claude/commands/venus/<id>.md 的内容来源）。
 */
export interface CommandTemplate {
    /** 指令展示名（frontmatter name） */
    name: string;
    /** 指令描述（frontmatter description） */
    description: string;
    /** 分组类别（默认 'Venus'） */
    category: string;
    /** 标签 */
    tags: string[];
    /** 指令正文 */
    content: string;
}

/** 技能模板注册项：模板 + 派生的指令 id（斜杠指令文件名，如 tr-tools-pwd） */
export interface SkillTemplateEntry {
    template: SkillTemplate;
    /** 指令 id：文件名（不含 .md），形如 <type 连字符化>-<name> */
    commandId: string;
}
