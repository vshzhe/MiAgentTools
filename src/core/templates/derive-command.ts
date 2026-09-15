/**
 * 模板单一源派生：从 skill instructions（唯一源）派生 command 压缩版正文。
 *
 * 标记语法（段落级 HTML 注释，契约来自 design.md D2，不可更改）：
 *   - <!-- CMD:SKIP -->  起始标记
 *   - <!-- /CMD:SKIP --> 结束标记
 * 成对标记划定"仅 skill 版可见"段落，派生时整段裁剪（含标记行本身）。
 *
 * fail-safe 核心规则（漏标只会让 command 更长，不会缺失防护语句）：
 *   - 未标记段落默认保留进 command 版
 *   - 未闭合（只有起始无结束）：从该标记起内容全部保留，标记行本身剥离
 *   - 孤立结束标记：标记行剥离，其余内容不受影响
 *
 * 纯字符串处理，无 IO、无依赖。
 */

/**
 * 从 skill 唯一源正文派生 command 压缩版正文。
 *
 * @param instructions skill 模板正文（唯一源）
 * @returns command 压缩版正文（已裁剪仅 skill 版可见段落、剥离所有 CMD:SKIP 标记行）
 */
export function deriveCommandContent(instructions: string): string {
    // 空输入直接返回空串
    if (instructions === '') {
        return '';
    }

    const START = '<!-- CMD:SKIP -->';
    const END = '<!-- /CMD:SKIP -->';

    const lines = instructions.split('\n');

    // 输出缓冲：最终进入 command 版的行
    const output: string[] = [];

    // 跳过段缓冲：进入 skip 段后暂存内容；遇结束标记则整体丢弃，未闭合则回填到 output
    const skipBuffer: string[] = [];

    // 是否处于 skip 段（已遇起始标记、未遇结束标记）
    let inSkip = false;

    for (const line of lines) {
        // trim 用于标记识别（兼容前后空白与 \r 行尾），内容行原样保留
        const trimmed = line.trim();
        const isStart = trimmed === START;
        const isEnd = trimmed === END;

        if (!inSkip) {
            if (isStart) {
                // 进入 skip 段：起始标记行本身不入缓冲（剥离），后续内容暂存待裁决
                inSkip = true;
                skipBuffer.length = 0;
            } else if (isEnd) {
                // 孤立结束标记：仅剥离该标记行，不影响其余内容
                continue;
            } else {
                // 普通内容：默认保留（fail-safe）
                output.push(line);
            }
        } else {
            // 处于 skip 段
            if (isEnd) {
                // 遇结束标记：成对成立，整段裁剪（含标记行），丢弃缓冲
                inSkip = false;
                skipBuffer.length = 0;
            } else {
                // 暂存内容（含可能的嵌套起始标记行；未闭合回填时再剥离标记行）
                skipBuffer.push(line);
            }
        }
    }

    // 未闭合容错：仍在 skip 段时，缓冲内容全部保留（fail-safe：更长而非缺失），但剥离标记行
    if (inSkip) {
        for (const bufferedLine of skipBuffer) {
            const bufferedTrim = bufferedLine.trim();
            if (bufferedTrim === START || bufferedTrim === END) {
                // 标记行本身从输出剥离
                continue;
            }
            output.push(bufferedLine);
        }
    }

    return output.join('\n');
}
