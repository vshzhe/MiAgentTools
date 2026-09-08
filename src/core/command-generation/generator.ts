/**
 * 指令与技能文件生成器。
 *
 * generateCommand：CommandContent + 适配器 → 指令文件（路径 + 内容）
 * generateSkillContent：SkillTemplate → SKILL.md 内容（YAML frontmatter + 正文）
 */

import type {
    CommandContent,
    ToolCommandAdapter,
    GeneratedCommand,
    GeneratedSkill,
} from './types.js';
import type { SkillTemplate } from '../templates/types.js';
import { escapeYamlValue } from './yaml.js';
import { SKILL_PREFIX } from '../config.js';

/**
 * 生成单个指令文件（工具无关内容 + 工具适配器格式化）。
 *
 * @param content - 工具无关的指令内容
 * @param adapter - 目标工具适配器
 */
export function generateCommand(
    content: CommandContent,
    adapter: ToolCommandAdapter
): GeneratedCommand {
    return {
        path: adapter.getFilePath(content.id),
        fileContent: adapter.formatFile(content),
    };
}

/**
 * 批量生成指令文件。
 */
export function generateCommands(
    contents: CommandContent[],
    adapter: ToolCommandAdapter
): GeneratedCommand[] {
    return contents.map((content) => generateCommand(content, adapter));
}

/**
 * 生成 SKILL.md 完整内容（YAML frontmatter + 正文）。
 *
 * @param template - 技能模板
 * @param generatedByVersion - 生成器版本号（写入 metadata.generatedBy）
 */
export function generateSkillContent(
    template: SkillTemplate,
    generatedByVersion: string
): GeneratedSkill {
    if (!template.name.startsWith(SKILL_PREFIX)) {
        throw new Error(`技能名必须以 ${SKILL_PREFIX} 开头：${template.name}`);
    }
    return {
        dirName: template.name,
        fileContent: `---
name: ${template.name}
description: ${escapeYamlValue(template.description)}
allowed-tools: ${template.allowedTools}
license: ${template.license || 'MIT'}
compatibility: ${escapeYamlValue(template.compatibility || '无特殊依赖，通用环境可用。')}
metadata:
  author: ${template.metadata?.author || 'venus-agent-tools'}
  version: "${template.metadata?.version || '1.0'}"
  type: ${template.type}
  generatedBy: "${generatedByVersion}"
---

${template.instructions}
`,
    };
}
