/**
 * OpenCode 指令适配器。
 *
 * OpenCode 从项目的 `.opencode/commands/` 目录递归加载 markdown 指令
 * （扫描 command 与 commands 子目录下的全部 `.md`），指令名 = 相对 `commands/` 的路径去 `.md`。
 * 本适配器采用扁平前缀布局：`.opencode/commands/iagent-<id>.md` → `/iagent-<id>`
 * （与 Pi 约定一致，避免 `namespace-dir` 产生的 `iagent/spec-apply` 嵌套名）。
 *
 * frontmatter：仅 OpenCode 官方契约的 `description` + 本工具记账字段
 *   `metadata.generatedBy` / `metadata.generatedFingerprint`（OpenCode 会忽略未知
 *   顶层键；指纹字段供 `update` 做手改保护），不含 Claude 专有的
 *   name / allowed-tools / category / tags。
 *
 * 参数注入：OpenCode 只在正文显式占位符（`$ARGUMENTS` / `$1`）处接收用户参数。
 * 既有指令正文以 `**Input**:` 声明输入契约但不含占位符，故生成期在 Input 段后
 * 注入 `**Provided arguments**: $ARGUMENTS`（移植自 OpenSpec 的 opencode 适配器）。
 */

import type { CommandContent, ToolCommandAdapter } from '../types.js';
import { escapeYamlValue } from '../yaml.js';
import { commandFilePath } from '../../command-artifacts.js';

/** 匹配 `**Input**:` 段（含其后续非空行，直到空行） */
const OPENCODE_INPUT_BLOCK = /^\*\*Input\*\*:[^\r\n]*(?:\r?\n(?!\r?\n)[^\r\n]*)*/m;
/** 匹配声明无需输入的 Input 段 */
const OPENCODE_NO_INPUT = /^\*\*Input\*\*:\s*None required\b/im;
/** 匹配已存在的参数占位符（`$ARGUMENTS` 或 `$1`..`$n`） */
const OPENCODE_ARGUMENT_PLACEHOLDER = /\$(?:ARGUMENTS\b|[1-9]\d*\b)/;

/**
 * 在 `**Input**:` 契约段之后注入 `$ARGUMENTS` 占位符。
 * 正文已含参数占位符、或 Input 段声明 `None required` 时原样返回（不重复注入）。
 */
function injectOpenCodeArgs(body: string): string {
    if (OPENCODE_ARGUMENT_PLACEHOLDER.test(body) || OPENCODE_NO_INPUT.test(body)) {
        return body;
    }
    const eol = body.includes('\r\n') ? '\r\n' : '\n';
    return body.replace(
        OPENCODE_INPUT_BLOCK,
        (input) => `${input}${eol}**Provided arguments**: $ARGUMENTS`
    );
}

export const opencodeAdapter: ToolCommandAdapter = {
    toolId: 'opencode',

    getFilePath(commandId: string): string {
        return commandFilePath('opencode', commandId);
    },

    formatFile(content: CommandContent, fingerprintPlaceholder?: string): string {
        const fpLine = fingerprintPlaceholder !== undefined
            ? `\n  generatedFingerprint: "${fingerprintPlaceholder}"`
            : '';
        // V2 原生编排元数据：agent（primary orchestrator）+ subagent（前台/后台）
        const agentLine = content.hostMeta?.agent
            ? `agent: ${content.hostMeta.agent}\n`
            : '';
        const subagentLine = content.hostMeta?.subagent !== undefined
            ? `subagent: ${content.hostMeta.subagent}\n`
            : '';
        return `---
description: ${escapeYamlValue(content.description)}
${agentLine}${subagentLine}metadata:
  generatedBy: "${content.generatedBy || ''}"${fpLine}
---

${injectOpenCodeArgs(content.body)}
`;
    },
};
