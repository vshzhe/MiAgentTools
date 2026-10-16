import * as fs from 'node:fs';
import * as path from 'node:path';
import { findMarkdownFiles } from './parser/markdown-parser.js';
import { parseDesign } from './parser/design-parser.js';
import { parseProposal } from './parser/proposal-parser.js';
import { parseSpec } from './parser/spec-parser.js';
import {
    insertCapabilities,
    insertChange,
    insertDecisions,
    insertExplorationMemory,
    insertRequirements,
    type CapabilityIndexEntry,
    type ChangeIndexEntry,
    type DecisionIndexEntry,
    type ExplorationMemoryEntry,
    type RequirementIndexEntry,
} from './sqlite-index.js';

/** 从 OpenSpec Markdown 构建归档索引；不读取 JSON 主产物。 */
export function indexMarkdownEntry(
    dbPath: string,
    changeDir: string,
    changeName: string,
    archiveDate: string | undefined,
): void {
    const proposalPath = path.join(changeDir, 'proposal.md');
    const designPath = path.join(changeDir, 'design.md');
    const specFiles = findMarkdownFiles(path.join(changeDir, 'specs'));
    const proposal = fs.existsSync(proposalPath) ? parseProposal(proposalPath) : undefined;
    const design = fs.existsSync(designPath) ? parseDesign(designPath) : undefined;
    const specs = specFiles.map((filePath) => parseSpec(filePath));

    const why = proposal?.sections.get('Why')?.body ?? '';
    const whatChanges = proposal?.sections.get('What Changes')?.body ?? '';
    const changeEntry: ChangeIndexEntry = {
        name: changeName,
        archiveDate,
        module: extractModule(changeName),
        summary: (firstMeaningfulLine(whatChanges) || firstMeaningfulLine(why)).slice(0, 200),
    };
    insertChange(dbPath, changeEntry);

    const capabilities: CapabilityIndexEntry[] = [];
    const requirements: RequirementIndexEntry[] = [];
    for (const spec of specs) {
        const operation = spec.requirements[0]?.operation ?? 'ADDED';
        capabilities.push({ name: spec.capability, changeName, operation });
        for (const requirement of spec.requirements) {
            const scenarioText = requirement.scenarios
                .map((scenario) => [scenario.name, scenario.given, scenario.when, scenario.then].filter(Boolean).join(' '))
                .join(' | ');
            requirements.push({
                requirementName: requirement.name,
                scenarioText: `${scenarioText} [source: ${spec.filePath}#L${requirement.line}]`,
                changeName,
                capabilityName: spec.capability,
            });
        }
    }
    if (capabilities.length > 0) insertCapabilities(dbPath, changeName, uniqueCapabilities(capabilities));
    insertRequirements(dbPath, requirements);

    const decisions: DecisionIndexEntry[] = (design?.decisions ?? []).map((decision) => ({
        title: decision.title,
        choice: decision.body,
        rationale: `${decision.body} [source: ${designPath}#L${decision.line}]`,
        changeName,
    }));
    insertDecisions(dbPath, decisions);

    const explorationPath = path.join(changeDir, 'exploration.md');
    if (fs.existsSync(explorationPath)) {
        const capabilityNames = new Set(specs.map((spec) => spec.capability));
        const content = extractExplorationContent(fs.readFileSync(explorationPath, 'utf8'));
        const memories: ExplorationMemoryEntry[] = [...capabilityNames].map((capability) => ({
            capability,
            changeName,
            memoryType: 'exploration',
            content,
            archivedAt: archiveDate ?? '',
        }));
        for (const memory of memories) insertExplorationMemory(dbPath, memory);
    }
}

function uniqueCapabilities(entries: CapabilityIndexEntry[]): CapabilityIndexEntry[] {
    const seen = new Set<string>();
    return entries.filter((entry) => {
        const key = `${entry.name}\0${entry.operation}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function firstMeaningfulLine(content: string): string {
    return content
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*[-*]\s+/, '').trim())
        .find((line) => line.length > 0 && !line.startsWith('<!--')) ?? '';
}

function extractModule(changeName: string): string {
    const parts = changeName.split('-');
    if (parts.length >= 3) return parts.slice(1, -1).join('-');
    if (parts.length === 2) return parts[1];
    return 'general';
}

function extractExplorationContent(content: string): string {
    const headingMatch = /^## Decisions[ \t]*$/m.exec(content);
    if (headingMatch !== null) {
        const rest = content.slice(headingMatch.index + headingMatch[0].length);
        const nextHeading = /^## /m.exec(rest);
        const section = (nextHeading ? rest.slice(0, nextHeading.index) : rest).trim();
        if (section.length > 0) return section;
    }
    return content.slice(0, 300);
}
