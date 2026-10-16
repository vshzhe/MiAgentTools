import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
    ChangeSchema,
    DecisionEntry,
    SpecEntry,
    SpecOperation,
    TasksSchema,
} from './sidecar-schema.js';
import { renderTasksMd } from './sidecar-writer.js';
import { parseDesign } from './parser/design-parser.js';
import { parseProposal } from './parser/proposal-parser.js';
import { parseSpec } from './parser/spec-parser.js';
import { parseTasks } from './parser/task-parser.js';

export interface MigrationResult {
    changeName: string;
    changeDir: string;
    created: string[];
    sourceFiles: string[];
    deletedLegacy: string[];
    warnings: string[];
}

/** 将历史 JSON-only 变更显式转换为 OpenSpec Markdown；默认不删除 JSON。 */
export function migrateChangeFromJson(
    projectRoot: string,
    changeName: string,
    options: { deleteLegacy?: boolean } = {},
): MigrationResult {
    const changeDir = path.join(projectRoot, 'openspec', 'changes', changeName);
    if (!fs.existsSync(changeDir)) {
        throw new Error(`变更不存在：${changeName}`);
    }

    const change = readChangeJson(changeDir);
    const tasks = readTasksJson(changeDir);
    const sourceFiles = [
        path.join(changeDir, 'change.json'),
        path.join(changeDir, 'tasks.json'),
    ].filter((filePath) => fs.existsSync(filePath));
    if (change === null && tasks === null) {
        throw new Error(`未找到可迁移的 change.json/tasks.json：${changeDir}`);
    }

    const targets = targetPaths(changeDir);
    const conflicts = Object.values(targets).filter((filePath) => fs.existsSync(filePath));
    if (conflicts.length > 0) {
        throw new Error(`迁移目标已存在，拒绝覆盖：${conflicts.join(', ')}`);
    }

    const created: string[] = [];
    if (change?.proposal !== undefined) {
        writeNewFile(targets.proposal, renderProposal(change), created);
    }
    if (change?.design !== undefined) {
        writeNewFile(targets.design, renderDesign(change.design), created);
    }
    for (const spec of change?.specs ?? []) {
        const filePath = path.join(changeDir, spec.path.replaceAll('/', path.sep));
        writeNewFile(filePath, renderSpec(spec), created);
    }
    if (tasks !== null) {
        writeNewFile(targets.tasks, renderTasksMd(tasks, changeName), created);
    }

    const validationErrors = validateCreatedMarkdown(changeDir, created);
    if (validationErrors.length > 0) {
        for (const filePath of created) fs.rmSync(filePath, { force: true });
        throw new Error(`迁移结果校验失败：${validationErrors.join('；')}`);
    }

    const deletedLegacy: string[] = [];
    if (options.deleteLegacy) {
        for (const source of sourceFiles) {
            fs.rmSync(source, { force: true });
            deletedLegacy.push(source);
        }
    }
    return { changeName, changeDir, created, sourceFiles, deletedLegacy, warnings: [] };
}

function validateCreatedMarkdown(changeDir: string, created: readonly string[]): string[] {
    const errors: string[] = [];
    for (const filePath of created) {
        const normalized = filePath.replaceAll('\\\\', '/');
        const diagnostics = normalized.endsWith('/proposal.md')
            ? parseProposal(filePath).diagnostics
            : normalized.endsWith('/design.md')
                ? parseDesign(filePath).diagnostics
                : normalized.endsWith('/tasks.md')
                    ? parseTasks(filePath).diagnostics
                    : normalized.includes('/specs/')
                        ? parseSpec(filePath).diagnostics
                        : [];
        for (const diagnostic of diagnostics.filter((item) => item.severity === 'error')) {
            errors.push(`${diagnostic.filePath}:${diagnostic.line} ${diagnostic.message}`);
        }
    }
    return errors;
}

function readChangeJson(changeDir: string): ChangeSchema | null {
    for (const filePath of [path.join(changeDir, 'change.json'), path.join(changeDir, '.iagent', 'change.json')]) {
        if (!fs.existsSync(filePath)) continue;
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as ChangeSchema;
        return parsed;
    }
    return null;
}

function readTasksJson(changeDir: string): TasksSchema | null {
    for (const filePath of [path.join(changeDir, 'tasks.json'), path.join(changeDir, '.iagent', 'tasks.json')]) {
        if (!fs.existsSync(filePath)) continue;
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as TasksSchema;
        return parsed;
    }
    return null;
}

function targetPaths(changeDir: string): {
    proposal: string;
    design: string;
    tasks: string;
} {
    return {
        proposal: path.join(changeDir, 'proposal.md'),
        design: path.join(changeDir, 'design.md'),
        tasks: path.join(changeDir, 'tasks.md'),
    };
}

function writeNewFile(filePath: string, content: string, created: string[]): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    created.push(filePath);
}

function renderProposal(change: ChangeSchema): string {
    const proposal = change.proposal;
    if (proposal === undefined) return '';
    const capabilityLines = [
        '### New Capabilities',
        ...proposal.capabilities.new.map((item) => `- \`${item.name}\`: ${item.description}`),
        '',
        '### Modified Capabilities',
        ...proposal.capabilities.modified.map((item) => `- \`${item.name}\`: ${item.description}`),
    ];
    return [
        '# Proposal',
        '',
        '## Why',
        '',
        proposal.why,
        '',
        '## What Changes',
        '',
        ...proposal.whatChanges.map((item) => `- ${item}`),
        '',
        '## Capabilities',
        '',
        ...capabilityLines,
        '',
        '## Impact',
        '',
        '### Directly Affected Files',
        '',
        ...proposal.impact.files.map((item) => `- \`${item.path}\`: ${item.description}`),
        '',
        '### Compatibility',
        '',
        proposal.impact.compatibility,
        '',
    ].join('\n');
}

function renderDesign(design: NonNullable<ChangeSchema['design']>): string {
    return [
        '# Design', '',
        '## Context', '', design.context, '',
        '## Goals / Non-Goals', '',
        '**Goals:**', ...design.goals.map((item) => `- ${item}`), '',
        '**Non-Goals:**', ...design.nonGoals.map((item) => `- ${item}`), '',
        '## Decisions', '',
        ...design.decisions.flatMap(renderDecision),
        '## Risks / Trade-offs', '',
        '| 风险 | 缓解 |', '|------|------|',
        ...design.risks.map((item) => `| ${item.risk} | ${item.mitigation} |`),
        '',
    ].join('\n');
}

function renderDecision(decision: DecisionEntry): string[] {
    return [
        `### ${decision.id}: ${decision.title}`,
        `- **选择**：${decision.choice}`,
        `- **理由**：${decision.rationale}`,
        `- **备选**：${decision.alternatives.join('；') || '无'}`,
        `- **风险**：${decision.risks.join('；') || '无'}`,
        `- **相关文件**：${decision.relatedFiles.join('、') || '无'}`,
        '',
    ];
}

function renderSpec(spec: SpecEntry): string {
    const sections = new Map<string, SpecOperation[]>();
    for (const operation of spec.operations) {
        const key = `${operation.type} Requirements`;
        const items = sections.get(key) ?? [];
        items.push(operation);
        sections.set(key, items);
    }
    const lines = ['# Spec Delta', ''];
    for (const [section, operations] of sections) {
        lines.push(`## ${section}`, '');
        for (const operation of operations) {
            lines.push(`### Requirement: ${operation.requirement}`);
            if (operation.description) lines.push(operation.description, '');
            if (operation.type === 'REMOVED') {
                lines.push(`**Reason**: ${operation.reason ?? '未提供'}`, `**Migration**: ${operation.migration ?? '未提供'}`, '');
            } else if (operation.type === 'RENAMED') {
                lines.push(`**FROM**: ${operation.from ?? ''}`, `**TO**: ${operation.to ?? ''}`, '');
            } else {
                for (const scenario of operation.scenarios ?? []) {
                    lines.push(`#### Scenario: ${scenario.name}`);
                    if (scenario.given) lines.push(`- **GIVEN** ${scenario.given}`);
                    lines.push(`- **WHEN** ${scenario.when ?? ''}`, `- **THEN** ${scenario.then ?? ''}`, '');
                }
            }
        }
    }
    return `${lines.join('\n')}\n`;
}
