/**
 * Claude Code 指令适配器。
 *
 * 指令路径：.claude/commands/venus/<id>.md
 * frontmatter：name、description、allowed-tools、category、tags
 */

import path from 'path';
import type { CommandContent, ToolCommandAdapter } from '../types.js';
import { escapeYamlValue, formatTagsArray } from '../yaml.js';
import { TOOL_COMMANDS_SUBDIR } from '../../config.js';

export const claudeAdapter: ToolCommandAdapter = {
    toolId: 'claude',

    getFilePath(commandId: string): string {
        return path.join('.claude', 'commands', TOOL_COMMANDS_SUBDIR, `${commandId}.md`);
    },

    formatFile(content: CommandContent): string {
        return `---
name: ${escapeYamlValue(content.name)}
description: ${escapeYamlValue(content.description)}
allowed-tools: ${content.allowedTools}
category: ${escapeYamlValue(content.category)}
tags: ${formatTagsArray(content.tags)}
---

${content.body}
`;
    },
};
