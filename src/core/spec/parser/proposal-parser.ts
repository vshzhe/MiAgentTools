import {
    indexSections,
    normalizeHeading,
    readMarkdownDocument,
} from './markdown-parser.js';
import type {
    ArtifactDiagnostic,
    MarkdownSection,
    ParsedProposal,
} from '../model/artifact-model.js';

const PROPOSAL_SECTIONS = ['Why', 'What Changes', 'Capabilities', 'Impact'] as const;

export function parseProposal(filePath: string): ParsedProposal {
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

    const title = document.lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, '').trim();
    return {
        filePath,
        title,
        sections,
        rawContent: document.content,
        diagnostics,
    };
}
