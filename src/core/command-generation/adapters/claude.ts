/**
 * Claude Code 指令适配器。
 *
 * 指令路径：.claude/commands/iagent/<id>.md
 * frontmatter：name、description、allowed-tools、category、tags
 */

import type { CommandContent, ToolCommandAdapter } from '../types.js';
import { escapeYamlValue, formatTagsArray } from '../yaml.js';
import { commandFilePath } from '../../command-artifacts.js';

export const claudeAdapter: ToolCommandAdapter = {
    toolId: 'claude',

    getFilePath(commandId: string): string {
        return commandFilePath('claude', commandId);
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
