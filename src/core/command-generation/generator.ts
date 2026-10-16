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
import { fingerprintOf, FINGERPRINT_FIELD } from './fingerprint.js';
import { SKILL_PREFIX } from '../config.js';

/**
 * 生成单个指令文件（工具无关内容 + 工具适配器格式化）。
 *
 * 两趟拼装：先以空指纹占位生成全文，再算得指纹回填 —— 与
 * generateSkillContent 同构，使 commands 也具备手改保护能力。
 *
 * @param content - 工具无关的指令内容
 * @param adapter - 目标工具适配器
 */
export function generateCommand(
    content: CommandContent,
    adapter: ToolCommandAdapter
): GeneratedCommand {
    // 第一趟：空指纹占位生成全文
    const placeholder = adapter.formatFile(content, '');
    // 第二趟：计算指纹回填
    const fingerprint = fingerprintOf(placeholder);
    const fileContent = placeholder.replace(
        `  generatedFingerprint: ""`,
        `  generatedFingerprint: "${fingerprint}"`,
    );
    return {
        path: adapter.getFilePath(content.id),
        fileContent,
        fingerprintPlaceholder: `  generatedFingerprint: ""`,
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

/** frontmatter 中指纹行的空占位形态（两趟拼装的中间态） */
const EMPTY_FINGERPRINT_LINE = `  ${FINGERPRINT_FIELD}: ""`;

/**
 * 生成 SKILL.md 完整内容（YAML frontmatter + 正文）。
 *
 * 两趟拼装：先以空指纹占位生成全文，再算得指纹回填 —— 指纹由内容派生
 * （见 fingerprint.ts），故同一 (template, generatedByVersion) 恒得同一产物，
 * `test/skills-parity.test.ts` 的字节级比较得以成立。
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
    const placeholder = `---
name: ${template.name}
description: ${escapeYamlValue(template.description)}
allowed-tools: ${template.allowedTools}
license: ${template.license || 'MIT'}
compatibility: ${escapeYamlValue(template.compatibility || '无特殊依赖，通用环境可用。')}
metadata:
  author: ${template.metadata?.author || 'mi-agent-tools'}
  type: ${template.type}
  generatedBy: "${generatedByVersion}"
${EMPTY_FINGERPRINT_LINE}
---

${template.instructions}
`;
    return {
        dirName: template.name,
        fileContent: placeholder.replace(
            EMPTY_FINGERPRINT_LINE,
            `  ${FINGERPRINT_FIELD}: "${fingerprintOf(placeholder)}"`
        ),
        references: template.references,
    };
}
