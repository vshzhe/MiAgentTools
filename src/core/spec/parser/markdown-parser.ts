import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
    MarkdownDocument,
    MarkdownHeading,
    MarkdownSection,
} from '../model/artifact-model.js';

/** 读取 Markdown 文档并保留原始内容；只规范化行数组，不改写源文件。 */
export function readMarkdownDocument(filePath: string): MarkdownDocument {
    const content = fs.readFileSync(filePath, 'utf8');
    return {
        filePath,
        content,
        lines: content.split(/\r?\n/),
    };
}

/** 规范化标题文本，供 section 查找和引用匹配使用。 */
export function normalizeHeading(text: string): string {
    return text.replace(/\s+#+\s*$/, '').trim().replace(/\s+/g, ' ');
}

/**
 * 解析 ATX 标题。
 * 代码围栏内的 # 不被当作标题，避免 Mermaid/代码示例误触发结构解析。
 */
export function parseHeadings(document: MarkdownDocument): MarkdownHeading[] {
    const headings: MarkdownHeading[] = [];
    let fenced = false;
    let offset = 0;

    document.lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (/^(```|~~~)/.test(trimmed)) {
            fenced = !fenced;
            offset += line.length + 1;
            return;
        }
        if (!fenced) {
            const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
            if (match !== null) {
                headings.push({
                    level: match[1].length,
                    text: normalizeHeading(match[2]),
                    line: index + 1,
                    startOffset: offset,
                });
            }
        }
        offset += line.length + 1;
    });
    return headings;
}

/** 将文档拆成标题 section；重复标题由调用方根据 section 数量决定是否告警。 */
export function parseSections(document: MarkdownDocument): MarkdownSection[] {
    const headings = parseHeadings(document);
    return headings.map((heading, index) => {
        const next = headings[index + 1];
        const bodyStart = heading.line;
        const bodyEnd = next === undefined ? document.lines.length : next.line - 1;
        const bodyLines = document.lines.slice(bodyStart, bodyEnd);
        return {
            heading,
            body: bodyLines.join('\n').trim(),
            bodyLines,
            endLine: bodyEnd,
        };
    });
}

/** 以标题文本建立 section 索引；同名标题保留最后一项，重复由解析器自行诊断。 */
export function indexSections(document: MarkdownDocument): Map<string, MarkdownSection[]> {
    const result = new Map<string, MarkdownSection[]>();
    for (const section of parseSections(document)) {
        const existing = result.get(section.heading.text) ?? [];
        existing.push(section);
        result.set(section.heading.text, existing);
    }
    return result;
}

/** 递归收集 Markdown 文件，结果按归一化路径排序。 */
export function findMarkdownFiles(rootDir: string): string[] {
    if (!fs.existsSync(rootDir)) {
        return [];
    }
    const files: string[] = [];
    const visit = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.name.startsWith('.')) {
                continue;
            }
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                visit(fullPath);
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
                files.push(fullPath);
            }
        }
    };
    visit(rootDir);
    return files.sort((a, b) => a.localeCompare(b));
}

/** 从任意一行中提取字段值，支持中文冒号和英文冒号。 */
export function readLabeledValue(line: string, labels: readonly string[]): string | undefined {
    for (const label of labels) {
        const pattern = new RegExp(`^\\s*${escapeRegExp(label)}\\s*[：:]\\s*(.*?)\\s*$`);
        const match = pattern.exec(line);
        if (match !== null) {
            return match[1].trim();
        }
    }
    return undefined;
}

export function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function lineNumberForIndex(lines: readonly string[], index: number): number {
    return Math.max(1, Math.min(index + 1, lines.length || 1));
}
