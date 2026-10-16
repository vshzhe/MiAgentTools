/**
 * 技能模板与斜杠指令模板的核心类型定义。
 */

import type { SkillType } from '../config.js';

/** 技能附加参考文件（写入技能目录下，如 references/xxx.md）。
 * 主 SKILL.md 正文通过文字引用子文件，AI 按需用 Read 工具加载，
 * 避免单文件上下文膨胀。路径相对技能目录，content 为 Markdown 正文（不含 frontmatter）。
 */
export interface SkillReference {
    /** 相对技能目录的路径（如 "references/page-templates.md"） */
    path: string;
    /** 文件内容（Markdown 正文，不含 frontmatter） */
    content: string;
}

/**
 * 技能模板（SKILL.md 的内容来源）。
 * name 必须以 iagent_ 开头，且等于安装目录名。
 */
export interface SkillTemplate {
    /** 技能名称，格式：iagent_<type>_<name>（同时也是安装目录名） */
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
    /**
     * 其他元数据（frontmatter `metadata` 段）。
     * 约定字段：`author`。MUST NOT 含 `version`（遗留字段已移除：产物版本由 CLI 写入
     * `metadata.generatedBy`，frontmatter 不含游离 version）。
     */
    metadata?: Record<string, string>;
    /** 附加参考文件，生成 SKILL.md 时一并写入技能目录 */
    references?: SkillReference[];
}

/**
 * 斜杠指令模板（.claude/commands/iagent/<id>.md 的内容来源）。
 */
export interface CommandTemplate {
    /** 指令展示名（frontmatter name） */
    name: string;
    /** 指令描述（frontmatter description） */
    description: string;
    /** 分组类别（默认 'iAgent'） */
    category: string;
    /** 标签 */
    tags: string[];
    /** 指令正文 */
    content: string;
    /**
     * allowed-tools 白名单（frontmatter allowed-tools）。
     *
     * **可选**：各指令模板工厂各自返回字面量、彼此不知道配对技能，若设为必填
     * 会迫使白名单复制 27 份（第二份真源，必然漂移）。因此本字段由 registry.ts
     * 在成对映射处**单点回填**配对技能的 `allowedTools`，产物侧经
     * `CommandContent.allowedTools`（必填）强制校验。
     */
    allowedTools?: string;
}

/** 技能模板注册项：模板 + 派生的指令 id（斜杠指令文件名，如 pwd） */
export interface SkillTemplateEntry {
    template: SkillTemplate;
    /** 指令 id：文件名（不含 .md），形如 <type 连字符化>-<name> */
    commandId: string;
}
