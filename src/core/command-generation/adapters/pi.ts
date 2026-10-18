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
 * OpenCode 式的「无占位符则追加参数」回退。既有指令正文以 `**Input**:` 声明输入契约但
 * 不含占位符，故生成期在 Input 段后注入 `**Provided arguments**: $ARGUMENTS`
 * （否则 `/iagent-xxx <参数>` 的主题参数会丢失）。
 */

import type { CommandContent, ToolCommandAdapter } from '../types.js';
import { escapeYamlValue } from '../yaml.js';
import { commandFilePath } from '../../command-artifacts.js';

/** 匹配 `**Input**:` 段（含其后续非空行，直到空行） */
const PI_INPUT_BLOCK = /^\*\*Input\*\*:[^\r\n]*(?:\r?\n(?!\r?\n)[^\r\n]*)*/m;
/** 匹配声明无需输入的 Input 段 */
const PI_NO_INPUT = /^\*\*Input\*\*:\s*None required\b/im;
/** 匹配已存在的参数占位符（`$ARGUMENTS` 或 `$1`..`$n`） */
const PI_ARGUMENT_PLACEHOLDER = /\$(?:ARGUMENTS\b|@\b|[1-9]\d*\b)/;

/**
 * 在 `**Input**:` 契约段之后注入 `$ARGUMENTS` 占位符。
 * 正文已含参数占位符、或 Input 段声明 `None required` 时原样返回（不重复注入）。
 */
function injectPiArgs(body: string): string {
    if (PI_ARGUMENT_PLACEHOLDER.test(body) || PI_NO_INPUT.test(body)) {
        return body;
    }
    const eol = body.includes('\r\n') ? '\r\n' : '\n';
    return body.replace(PI_INPUT_BLOCK, (input) => `${input}${eol}**Provided arguments**: $ARGUMENTS`);
}

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

${injectPiArgs(content.body)}
`;
    },
};
