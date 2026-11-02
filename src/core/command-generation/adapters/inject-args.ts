/**
 * 指令参数占位符注入（Pi / OpenCode 适配器共享单一实现）。
 *
 * Pi 与 OpenCode 都只在正文显式占位符（`$ARGUMENTS` / `$1`）处接收用户参数，
 * 且没有「无占位符则追加参数」的自动回退。既有指令正文以输入契约段声明入参
 * （英文 `**Input**:` 或中文 `**输入**：` / `**输入**:`）却不含占位符，故生成期
 * 在该段末尾注入一行 `**Provided arguments**: $ARGUMENTS`。
 *
 * 两条硬约束（缺一即产生漏注入 / 误注入）：
 *   1. **仅首个顶层输入段**：`proposal-review` 的 `## 检查示例` 段（未围栏）亦含
 *      同形 `**输入**:` 示例行，只能靠「顶层 + 首个」语义排除；
 *   2. **围栏代码块隔离**：报告模板 / 代码示例内（` ``` ` / `~~~`）的 `**Input**:`
 *      不得作为注入锚点。
 *
 * 幂等：正文已含 `$ARGUMENTS` / `$@` / `$1`..`$n` 时原样返回；输入段声明
 * `None required` 或 `无需参数` 时跳过注入。
 */

/** 已存在的参数占位符（`$ARGUMENTS` / `$@` / `$1`..`$n`） */
const ARGUMENT_PLACEHOLDER = /\$(?:ARGUMENTS\b|@(?![A-Za-z0-9_])|[1-9]\d*\b)/;

/** 顶层输入段首行：`**Input**:` / `**输入**：` / `**输入**:` */
const INPUT_HEAD = /^\*\*(?:Input\*\*:|输入\*\*\s*[：:])/;

/** 首行标记剥离（用于判定无参声明） */
const INPUT_MARKER = /^\*\*(?:Input\*\*:|输入\*\*\s*[：:])\s*/;

/** 无参声明（中英） */
const NO_INPUT = /^(?:None required\b|无需参数)/i;

/** 围栏代码块起止行（` ``` ` 或 `~~~`，允许前导空白） */
const FENCE_LINE = /^\s*(`{3,}|~{3,})/;

/** 标题行（输入段在标题处终止） */
const HEADING_LINE = /^\s*#/;

/** 注入的占位符行（不含行尾符） */
export const PROVIDED_ARGUMENTS_LINE = '**Provided arguments**: $ARGUMENTS';

/**
 * 在首个顶层输入契约段之后注入 `$ARGUMENTS` 占位符。
 *
 * @param body - 工具无关的指令正文
 * @returns 注入后的正文；无需 / 不可注入时原样返回（幂等）
 */
export function injectCommandArgs(body: string): string {
    if (ARGUMENT_PLACEHOLDER.test(body)) {
        return body;
    }

    const lines = body.split('\n');
    // 1) 按行扫描围栏状态，定位首个顶层输入段
    let inFence = false;
    let fenceChar = '';
    let head = -1;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const fence = line.match(FENCE_LINE);
        if (fence) {
            const char = fence[1][0];
            if (!inFence) {
                inFence = true;
                fenceChar = char;
            } else if (char === fenceChar) {
                inFence = false;
                fenceChar = '';
            }
            continue;
        }
        if (inFence) {
            continue;
        }
        if (INPUT_HEAD.test(line)) {
            head = i;
            break;
        }
    }
    if (head === -1) {
        return body;
    }

    // 2) 向后收集该段落的连续非空行（遇空行 / 标题 / 围栏即止）
    let end = head;
    for (let i = head + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '' || HEADING_LINE.test(line) || FENCE_LINE.test(line)) {
            break;
        }
        end = i;
    }

    // 3) 无参声明跳过注入（判定不含标记本身）
    const paragraphText = [lines[head].replace(INPUT_MARKER, ''), ...lines.slice(head + 1, end + 1)]
        .join('\n')
        .trim();
    if (NO_INPUT.test(paragraphText)) {
        return body;
    }

    // 4) 在段落末尾插入占位符行（保持原行尾风格）
    const eol = lines[end].endsWith('\r') ? '\r' : '';
    lines.splice(end + 1, 0, `${PROVIDED_ARGUMENTS_LINE}${eol}`);
    return lines.join('\n');
}
