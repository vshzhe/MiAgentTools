import {
    indexSections,
    normalizeHeading,
    parseSections,
    readMarkdownDocument,
} from './markdown-parser.js';
import type {
    ArtifactDiagnostic,
    MarkdownSection,
    ParsedDecision,
    ParsedDesign,
} from '../model/artifact-model.js';

const DESIGN_SECTIONS = ['Context', 'Goals / Non-Goals', 'Decisions', 'Risks / Trade-offs'] as const;

export function parseDesign(filePath: string): ParsedDesign {
    const document = readMarkdownDocument(filePath);
    const indexed = indexSections(document);
    const diagnostics: ArtifactDiagnostic[] = [];
    const sections = new Map<string, MarkdownSection>();

    for (const [heading, candidates] of indexed) {
        const topLevel = candidates.filter((section) => section.heading.level === 2);
        if (topLevel.length > 1) {
            for (const duplicate of topLevel.slice(1)) {
                diagnostics.push({
                    severity: 'error',
                    code: 'duplicate-section',
                    message: `design section 重复：${heading}`,
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

    for (const sectionName of DESIGN_SECTIONS) {
        if (!sections.has(sectionName)) {
            diagnostics.push({
                severity: 'warning',
                code: 'missing-section',
                message: `design 缺少标准章节：## ${sectionName}`,
                filePath,
                line: 1,
            });
        }
    }

    const decisions: ParsedDecision[] = [];
    const decisionSection = sections.get('Decisions');
    if (decisionSection !== undefined) {
        const decisionBlocks = parseSections(document).filter(
            (section) => section.heading.level === 3 && /^D\d+(?::|\s)/.test(section.heading.text),
        );
        for (const block of decisionBlocks) {
            const match = /^(D\d+)(?::|\s+)(.*)$/.exec(block.heading.text);
            decisions.push({
                id: match?.[1],
                title: match?.[2]?.trim() || block.heading.text,
                body: block.body,
                line: block.heading.line,
            });
        }
        if (decisions.length === 0 && decisionSection.body.trim().length > 0) {
            diagnostics.push({
                severity: 'warning',
                code: 'unstructured-decisions',
                message: 'design 的 Decisions 章节未包含 ### D<N> 决策标题',
                filePath,
                line: decisionSection.heading.line,
            });
        }
    }

    const title = document.lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, '').trim();
    return {
        filePath,
        title,
        sections,
        decisions,
        rawContent: document.content,
        diagnostics,
    };
}
