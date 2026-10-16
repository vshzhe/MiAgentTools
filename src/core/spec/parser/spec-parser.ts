import {
    normalizeHeading,
    parseHeadings,
    readMarkdownDocument,
} from './markdown-parser.js';
import type {
    ArtifactDiagnostic,
    DeltaOperationType,
    MarkdownSection,
    ParsedRequirement,
    ParsedScenario,
    ParsedSpec,
} from '../model/artifact-model.js';

const OPERATION_HEADINGS: Record<string, DeltaOperationType> = {
    'ADDED Requirements': 'ADDED',
    'MODIFIED Requirements': 'MODIFIED',
    'REMOVED Requirements': 'REMOVED',
    'RENAMED Requirements': 'RENAMED',
};

export function parseSpec(filePath: string, capability?: string): ParsedSpec {
    const document = readMarkdownDocument(filePath);
    const headings = parseHeadings(document);
    const diagnostics: ArtifactDiagnostic[] = [];
    const sections = new Map<string, MarkdownSection>();
    const operationHeadings = headings.filter(
        (heading) => heading.level === 2 && OPERATION_HEADINGS[normalizeHeading(heading.text)] !== undefined,
    );
    const purposeHeading = headings.find(
        (heading) => heading.level === 2 && normalizeHeading(heading.text) === 'Purpose',
    );
    const purpose = purposeHeading === undefined
        ? undefined
        : extractHeadingBody(document.lines, headings, purposeHeading);

    if (operationHeadings.length === 0) {
        diagnostics.push({
            severity: 'error',
            code: 'missing-operation-section',
            message: 'spec 至少需要一个 ADDED/MODIFIED/REMOVED/RENAMED Requirements section',
            filePath,
            line: 1,
        });
    }

    for (const operationHeading of operationHeadings) {
        const operation = OPERATION_HEADINGS[normalizeHeading(operationHeading.text)];
        if (operation === undefined) {
            continue;
        }
        const operationBody = extractHeadingBody(document.lines, headings, operationHeading);
        sections.set(normalizeHeading(operationHeading.text), {
            heading: operationHeading,
            body: operationBody,
            bodyLines: operationBody.split('\n'),
            endLine: findHeadingEnd(headings, operationHeading, document.lines.length),
        });

        const requirements = headings.filter(
            (heading) => heading.level === 3
                && heading.line > operationHeading.line
                && heading.line < findHeadingEnd(headings, operationHeading, document.lines.length)
                && isRequirementHeading(heading.text),
        );
        for (const requirementHeading of requirements) {
            const parsed = parseRequirement(document.lines, headings, requirementHeading, operation);
            if (parsed !== null) {
                parsed.requirement.operation = operation;
                parsed.requirement.line = requirementHeading.line;
                if (operation === 'REMOVED' && parsed.requirement.reason === undefined) {
                    diagnostics.push({
                        severity: 'warning',
                        code: 'missing-removal-reason',
                        message: `REMOVED Requirement 缺少 Reason：${parsed.requirement.name}`,
                        filePath,
                        line: requirementHeading.line,
                    });
                }
                if (operation === 'REMOVED' && parsed.requirement.migration === undefined) {
                    diagnostics.push({
                        severity: 'warning',
                        code: 'missing-removal-migration',
                        message: `REMOVED Requirement 缺少 Migration：${parsed.requirement.name}`,
                        filePath,
                        line: requirementHeading.line,
                    });
                }
                if (parsed.requirement.scenarios.length === 0 && operation !== 'REMOVED' && operation !== 'RENAMED') {
                    diagnostics.push({
                        severity: 'error',
                        code: 'missing-scenario',
                        message: `Requirement 缺少 Scenario：${parsed.requirement.name}`,
                        filePath,
                        line: requirementHeading.line,
                    });
                }
                parsed.requirement.scenarios.forEach((scenario) => {
                    if (scenario.when === undefined || scenario.then === undefined) {
                        diagnostics.push({
                            severity: 'error',
                            code: 'missing-scenario-condition',
                            message: `Scenario 缺少 WHEN 或 THEN：${scenario.name}`,
                            filePath,
                            line: scenario.line,
                        });
                    }
                });
                parsed.requirements.push(parsed.requirement);
            }
        }
    }

    return {
        capability: capability ?? inferCapability(filePath),
        filePath,
        purpose,
        requirements: collectRequirements(headings, document.lines, operationHeadings, diagnostics, filePath),
        sections,
        rawContent: document.content,
        diagnostics,
    };
}

interface ParsedRequirementResult {
    requirement: ParsedRequirement;
    requirements: ParsedRequirement[];
}

function collectRequirements(
    headings: ReturnType<typeof parseHeadings>,
    lines: string[],
    operationHeadings: ReturnType<typeof parseHeadings>,
    diagnostics: ArtifactDiagnostic[],
    filePath: string,
): ParsedRequirement[] {
    const result: ParsedRequirement[] = [];
    for (const operationHeading of operationHeadings) {
        const operation = OPERATION_HEADINGS[normalizeHeading(operationHeading.text)];
        if (operation === undefined) continue;
        const operationEnd = findHeadingEnd(headings, operationHeading, lines.length);
        const requirements = headings.filter(
            (heading) => heading.level === 3
                && heading.line > operationHeading.line
                && heading.line < operationEnd
                && isRequirementHeading(heading.text),
        );
        for (const heading of requirements) {
            const parsed = parseRequirement(lines, headings, heading, operation);
            if (parsed === null) continue;
            const requirement = parsed.requirement;
            if (operation === 'REMOVED' && requirement.reason === undefined) {
                diagnostics.push({ severity: 'warning', code: 'missing-removal-reason', message: `REMOVED Requirement 缺少 Reason：${requirement.name}`, filePath, line: heading.line });
            }
            result.push(requirement);
        }
    }
    return result;
}

function parseRequirement(
    lines: string[],
    headings: ReturnType<typeof parseHeadings>,
    heading: ReturnType<typeof parseHeadings>[number],
    operation: DeltaOperationType,
): ParsedRequirementResult | null {
    const name = heading.text.replace(/^Requirement:\s*/i, '').trim();
    if (name.length === 0) return null;
    const endLine = findHeadingEnd(headings, heading, lines.length);
    const scenarioHeadings = headings.filter(
        (candidate) => candidate.level === 4 && candidate.line > heading.line && candidate.line < endLine,
    );
    const firstScenarioLine = scenarioHeadings[0]?.line ?? endLine;
    const description = lines.slice(heading.line, firstScenarioLine - 1).join('\n').trim();
    const body = lines.slice(heading.line, endLine - 1).join('\n');
    const scenarios = scenarioHeadings.map((scenarioHeading) => parseScenario(lines, headings, scenarioHeading));
    return {
        requirement: {
            name,
            operation,
            description,
            scenarios,
            reason: readField(body, 'Reason'),
            migration: readField(body, 'Migration'),
            from: readField(body, 'FROM'),
            to: readField(body, 'TO'),
            line: heading.line,
        },
        requirements: [],
    };
}

function parseScenario(
    lines: string[],
    headings: ReturnType<typeof parseHeadings>,
    heading: ReturnType<typeof parseHeadings>[number],
): ParsedScenario {
    const endLine = findHeadingEnd(headings, heading, lines.length);
    const bodyLines = lines.slice(heading.line, endLine - 1);
    const body = bodyLines.join('\n').trim();
    return {
        name: heading.text.replace(/^Scenario:\s*/i, '').trim(),
        given: readCondition(bodyLines, 'GIVEN'),
        when: readCondition(bodyLines, 'WHEN'),
        then: readCondition(bodyLines, 'THEN'),
        body,
        line: heading.line,
    };
}

function readCondition(lines: readonly string[], label: string): string | undefined {
    const line = lines.find((value) => new RegExp(`^\\s*-\\s*\\*\\*${label}\\*\\*\\s*`).test(value));
    if (line === undefined) return undefined;
    return line.replace(new RegExp(`^\\s*-\\s*\\*\\*${label}\\*\\*\\s*`), '').trim();
}

function readField(body: string, label: string): string | undefined {
    const pattern = new RegExp(`(?:^|\\n)\\s*(?:[-*]\\s*)?\\*?\\*?${label}\\*?\\*?\\s*[:：]\\s*(.+)`, 'i');
    return pattern.exec(body)?.[1]?.trim();
}

function isRequirementHeading(text: string): boolean {
    return /^Requirement:\s*/i.test(text);
}

function findHeadingEnd(
    headings: ReturnType<typeof parseHeadings>,
    heading: ReturnType<typeof parseHeadings>[number],
    lineCount: number,
): number {
    return headings.find((candidate) => candidate.line > heading.line && candidate.level <= heading.level)?.line ?? lineCount + 1;
}

function extractHeadingBody(
    lines: string[],
    headings: ReturnType<typeof parseHeadings>,
    heading: ReturnType<typeof parseHeadings>[number],
): string {
    const endLine = findHeadingEnd(headings, heading, lines.length);
    return lines.slice(heading.line, endLine - 1).join('\n').trim();
}

function inferCapability(filePath: string): string {
    const normalized = filePath.replaceAll('\\', '/');
    const match = /(?:^|\/)specs\/([^/]+)\/spec\.md$/i.exec(normalized);
    return match?.[1] ?? 'unknown';
}
