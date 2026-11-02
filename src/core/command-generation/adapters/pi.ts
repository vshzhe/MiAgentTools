/**
 * Pi 指令（prompt 模板）适配器。
 *
 * Pi 从项目的 `.pi/prompts/` 目录以扁平、`iagent-` 前缀文件加载 prompt 模板
 * （与 OpenSpec 的 `opsx-*.md` 同构），而非 `.pi/commands/` 命名空间子目录。
 * 指令路径：.pi/prompts/iagent-<id>.md
 * frontmatter：仅 description + iagent 自身的 metadata 记账字段
 *   （不含 name / allowed-tools / category / tags 等 Claude 专有字段；
 *    metadata.generatedFingerprint 供 update 做手改保护，Pi 会忽略未知键）。
 *
 * 参数注入：Pi 只在正文出现 `$ARGUMENTS` / `$1` 等占位符处替换用户参数，且**没有**
 * OpenCode 式的「无占位符则追加参数」回退。既有指令正文以输入契约段（`**Input**:` /
 * `**输入**：`）声明入参但不含占位符，故生成期在该段后注入
 * `**Provided arguments**: $ARGUMENTS`（否则 `/iagent-xxx <参数>` 的主题参数会丢失）。
 * 注入规则（围栏隔离 + 仅首个顶层段）见 `inject-args.ts`。
 */

import type { CommandContent, ToolCommandAdapter } from '../types.js';
import { escapeYamlValue } from '../yaml.js';
import { commandFilePath } from '../../command-artifacts.js';
import { injectCommandArgs } from './inject-args.js';

export const piAdapter: ToolCommandAdapter = {
    toolId: 'pi',

    getFilePath(commandId: string): string {
        return commandFilePath('pi', commandId);
    },

    formatFile(content: CommandContent, fingerprintPlaceholder?: string): string {
        const fpLine = fingerprintPlaceholder !== undefined
            ? `\n  generatedFingerprint: "${fingerprintPlaceholder}"`
            : '';
        return `---
description: ${escapeYamlValue(content.description)}
metadata:
  generatedBy: "${content.generatedBy || ''}"${fpLine}
---

${injectCommandArgs(content.body)}
`;
    },
};
