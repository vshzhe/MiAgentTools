/**
 * Pi 指令适配器。
 *
 * Pi 遵循 Agent Skills Specification，指令格式与 Claude Code 一致。
 * 指令路径：.pi/commands/venus/<id>.md
 * frontmatter：name、description、allowed-tools、category、tags
 */

import path from 'path';
import type { CommandContent, ToolCommandAdapter } from '../types.js';
import { escapeYamlValue, formatTagsArray } from '../yaml.js';
import { TOOL_COMMANDS_SUBDIR } from '../../config.js';

export const piAdapter: ToolCommandAdapter = {
    toolId: 'pi',

    getFilePath(commandId: string): string {
        return path.join('.pi', 'commands', TOOL_COMMANDS_SUBDIR, `${commandId}.md`);
    },

    formatFile(content: CommandContent, fingerprintPlaceholder?: string): string {
        const fpLine = fingerprintPlaceholder !== undefined
            ? `\n  generatedFingerprint: "${fingerprintPlaceholder}"`
            : '';
        return `---
name: ${escapeYamlValue(content.name)}
description: ${escapeYamlValue(content.description)}
allowed-tools: ${content.allowedTools}
category: ${escapeYamlValue(content.category)}
tags: ${formatTagsArray(content.tags)}
metadata:
  generatedBy: "${content.generatedBy || ''}"${fpLine}
---

${content.body}
`;
    },
};