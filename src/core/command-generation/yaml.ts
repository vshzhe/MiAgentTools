/**
 * YAML frontmatter 值转义与数组格式化工具。
 */

/**
 * 转义 YAML 标量值。
 * 含特殊字符（冒号+空格、引号、井号开头等）时用双引号包裹并转义内部双引号。
 */
export function escapeYamlValue(value: string): string {
    // 已含双引号，或以特殊结构开头/包含 ": " 的值，统一用双引号包裹
    const needsQuote =
        value.includes('"') ||
        value.includes(':') ||
        value.includes('#') ||
        value.startsWith(' ') ||
        value.endsWith(' ') ||
        value.startsWith('[') ||
        value.startsWith('{') ||
        value.includes('\n');
    if (!needsQuote) {
        return value;
    }
    return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')}"`;
}

/**
 * 将字符串数组格式化为 YAML 数组（YAML 流式风格 [a, b]）。
 */
export function formatTagsArray(tags: string[]): string {
    return `[${tags.map((tag) => escapeYamlValue(tag)).join(', ')}]`;
}
