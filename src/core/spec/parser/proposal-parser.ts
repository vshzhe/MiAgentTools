import {
    indexSections,
    normalizeHeading,
    parseHeadings,
    readMarkdownDocument,
} from './markdown-parser.js';
import type {
    ArtifactDiagnostic,
    MarkdownSection,
    ParsedCapability,
    ParsedProposal,
} from '../model/artifact-model.js';

const PROPOSAL_SECTIONS = ['Why', 'What Changes', 'Capabilities', 'Impact'] as const;

/** 能力声明行形态：`- \`<name>\`: <描述>` 或 `- <name>: <描述>` */
const CAPABILITY_LINE = /^\s*[-*]\s+`?([A-Za-z0-9][A-Za-z0-9-]*)`?\s*[:：]\s*(.*)$/;
/** `### New Capabilities` / `### Modified Capabilities` 标题 */
const NEW_CAPABILITIES_HEADING = 'New Capabilities';
const MODIFIED_CAPABILITIES_HEADING = 'Modified Capabilities';

export function parseProposal(filePath: string): ParsedProposal {
    const document = readMarkdownDocument(filePath);
    const indexed = indexSections(document);
    const headings = parseHeadings(document);
    const diagnostics: ArtifactDiagnostic[] = [];
    const sections = new Map<string, MarkdownSection>();

    for (const [heading, candidates] of indexed) {
        const topLevel = candidates.filter((section) => section.heading.level === 2);
        if (topLevel.length > 1) {
            for (const duplicate of topLevel.slice(1)) {
                diagnostics.push({
                    severity: 'error',
                    code: 'duplicate-section',
                    message: `proposal section 重复：${heading}`,
                    filePath,
                    line: duplicate.heading.line,
                });
            }
        }
        const first = topLevel[0];
        if (first !== undefined) {
            sections.set(normalizeHeading(heading), first);
        }
    }

    for (const sectionName of PROPOSAL_SECTIONS) {
        if (!sections.has(sectionName)) {
            diagnostics.push({
                severity: 'warning',
                code: 'missing-section',
                message: `proposal 缺少标准章节：## ${sectionName}`,
                filePath,
                line: 1,
            });
        }
    }

    const whatChanges = parseWhatChanges(document.lines, headings);
    const capabilities = parseCapabilities(document.lines, headings);

    const title = document.lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, '').trim();
    return {
        filePath,
        title,
        sections,
        whatChanges,
        capabilities,
        rawContent: document.content,
        diagnostics,
    };
}

/**
 * 解析 `## What Changes` 下的列表项（不含 HTML 注释行）。
 *
 * 只取该章节二级标题之后、下一个同级或更高级标题之前的 `- ` / `* ` 列表项，
 * 保留原始文本（供 D1/D3 的确定性链路核查）。
 */
function parseWhatChanges(lines: readonly string[], headings: readonly { level: number; text: string; line: number }[]): string[] {
    const section = findTopLevelHeadings(headings, 'What Changes');
    if (section === undefined) return [];
    const startIndex = section.line; // heading 行的下一行起（line 为 1-based）
    const endIndex = findSectionEnd(headings, section, lines.length);
    const items: string[] = [];
    for (let index = startIndex; index < endIndex; index += 1) {
        const line = lines[index] ?? '';
        if (/^\s*<!--/.test(line)) continue;
        const match = /^\s*[-*]\s+(.+)$/.exec(line);
        if (match !== null) {
            const text = match[1].trim();
            if (text.length > 0) items.push(text);
        }
    }
    return items;
}

/**
 * 解析 `### New Capabilities` / `### Modified Capabilities` 的能力声明。
 *
 * MUST NOT 把 `## Impact` 等后续章节里的列表误当能力（只扫描 Capabilities 章节内）。
 */
function parseCapabilities(
    lines: readonly string[],
    headings: readonly { level: number; text: string; line: number }[],
): ParsedCapability[] {
    const capabilities: ParsedCapability[] = [];
    const seen = new Set<string>();
    const capSection = findTopLevelHeadings(headings, 'Capabilities');
    if (capSection === undefined) return capabilities;
    const capEnd = findSectionEnd(headings, capSection, lines.length);

    for (const [headingText, kind] of [
        [NEW_CAPABILITIES_HEADING, 'new'],
        [MODIFIED_CAPABILITIES_HEADING, 'modified'],
    ] as const) {
        const subHeading = headings.find(
            (heading) => heading.level === 3
                && normalizeHeading(heading.text) === headingText
                && heading.line > capSection.line
                && heading.line < capEnd,
        );
        if (subHeading === undefined) continue;
        const end = findSectionEnd(headings, subHeading, capEnd);
        for (let index = subHeading.line; index < end; index += 1) {
            const line = lines[index] ?? '';
            if (/^\s*<!--/.test(line)) continue;
            const match = CAPABILITY_LINE.exec(line);
            if (match === null) continue;
            const name = match[1];
            if (seen.has(name)) continue;
            seen.add(name);
            capabilities.push({
                name,
                description: match[2].trim(),
                kind,
                line: index + 1,
            });
        }
    }
    return capabilities;
}

interface FlatHeading {
    level: number;
    text: string;
    line: number;
}

/** 取指定文本的二级标题（首个匹配） */
function findTopLevelHeadings(headings: readonly FlatHeading[], text: string): FlatHeading | undefined {
    return headings.find((heading) => heading.level === 2 && normalizeHeading(heading.text) === text);
}

/** 章节结束行（不含）：下一个层级 ≤ 该标题层级的标题行；无则到文末 */
function findSectionEnd(headings: readonly FlatHeading[], section: FlatHeading, lineCount: number): number {
    const next = headings.find(
        (heading) => heading.line > section.line && heading.level <= section.level,
    );
    return next === undefined ? lineCount : next.line - 1;
}
