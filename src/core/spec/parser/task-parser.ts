import { readMarkdownDocument } from './markdown-parser.js';
import type {
    ArtifactDiagnostic,
    ParsedTask,
    ParsedTasks,
} from '../model/artifact-model.js';

const TASK_LINE = /^(\s*)-\s*\[([ xX])\]\s+(.+)$/;
const TASK_ID = /(?:^|\s)(\d+(?:\.\d+)+)(?=\s|$)/;
const LABEL = /\[([^\]]+)\]/g;
const KNOWN_KINDS = new Set(['代码', '测试', 'DB脚本', '使用说明']);

/** Spec Ref / Scenario Ref 的标签别名（规范形态 + 中文别名） */
const SPEC_REF_LABELS = ['Spec Ref', '规格引用'] as const;
/** 所有追溯标签（用于切分同一行中的多个引用段） */
const REF_LABEL_PATTERN = /(Spec Ref|规格引用|Scenario Ref|场景引用)\s*[：:]/gi;
/** `→` 链式写法中的分段标签 */
const CHAIN_REQUIREMENT_PATTERN = /^(?:Requirement|需求)\s*[：:]\s*(.+)$/i;
const CHAIN_SCENARIO_PATTERN = /^(?:Scenario|场景)\s*[：:]\s*(.+)$/i;
/** 引用值中需要剥离的包裹字符（HTML 注释标记 / 引号） */
const REF_VALUE_NOISE = /<!--|-->|["'“”]/g;

export function parseTasks(filePath: string): ParsedTasks {
    const document = readMarkdownDocument(filePath);
    const diagnostics: ArtifactDiagnostic[] = [];
    const tasks: ParsedTask[] = [];
    let currentGroup: string | undefined;

    for (let index = 0; index < document.lines.length; index += 1) {
        const line = document.lines[index];
        const heading = /^(#{2,6})\s+(.+?)\s*$/.exec(line);
        if (heading !== null) {
            currentGroup = heading[2].trim();
            continue;
        }
        const taskMatch = TASK_LINE.exec(line);
        if (taskMatch === null) {
            continue;
        }
        const task = parseTaskBlock(document.lines, index, taskMatch, currentGroup);
        if (task.task === null) {
            diagnostics.push({
                severity: 'error',
                code: 'invalid-task-line',
                message: task.error ?? '无法解析任务行',
                filePath,
                line: index + 1,
            });
            continue;
        }
        tasks.push(task.task);
        index = task.endIndex;
    }

    const seen = new Map<string, ParsedTask>();
    for (const task of tasks) {
        const previous = seen.get(task.id);
        if (previous !== undefined) {
            diagnostics.push({
                severity: 'error',
                code: 'duplicate-task-id',
                message: `任务编号重复：${task.id}（首次出现于第 ${previous.line} 行）`,
                filePath,
                line: task.line,
            });
        } else {
            seen.set(task.id, task);
        }
    }
    const ids = new Set(tasks.map((task) => task.id));
    for (const task of tasks) {
        for (const dependency of task.dependencies) {
            if (!ids.has(dependency)) {
                diagnostics.push({
                    severity: 'error',
                    code: 'missing-task-dependency',
                    message: `任务 ${task.id} 依赖不存在的任务：${dependency}`,
                    filePath,
                    line: task.line,
                });
            }
        }
    }
    diagnostics.push(...findCyclicDependencies(tasks, filePath));

    return { filePath, tasks, rawContent: document.content, diagnostics };
}

interface ParsedTaskBlock {
    task: ParsedTask | null;
    endIndex: number;
    error?: string;
}

function parseTaskBlock(
    lines: string[],
    startIndex: number,
    match: RegExpExecArray,
    group: string | undefined,
): ParsedTaskBlock {
    const indent = match[1].length;
    const checked = match[2].toLowerCase() === 'x';
    const taskLine = match[3];
    const idMatch = TASK_ID.exec(taskLine);
    if (idMatch === null) {
        return { task: null, endIndex: startIndex, error: '任务 checkbox 行缺少稳定编号（如 1.1）' };
    }
    const id = idMatch[1];
    const labels = [...taskLine.matchAll(LABEL)].map((item) => item[1].trim());
    const kind = labels.find((label) => KNOWN_KINDS.has(label));
    const testLevel = labels.find((label) => label === '单元' || label === '功能');
    const priority = labels.find((label) => /^P[012]$/.test(label));
    const description = taskLine
        .replace(idMatch[0], ' ')
        .replace(LABEL, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const continuation: string[] = [];
    let endIndex = startIndex;
    for (let index = startIndex + 1; index < lines.length; index += 1) {
        if (TASK_LINE.test(lines[index]) || /^(#{1,6})\s+/.test(lines[index])) {
            break;
        }
        continuation.push(lines[index]);
        endIndex = index;
    }

    const fields = parseTaskFields(continuation);
    return {
        endIndex,
        task: {
            id,
            checked,
            description,
            rawLine: lines[startIndex],
            line: startIndex + 1,
            indent,
            kind,
            testLevel,
            priority,
            dependencies: fields.dependencies,
            files: fields.files,
            specRefs: fields.specRefs,
            scenarioRefs: fields.scenarioRefs,
            verification: fields.verification,
            outputs: fields.outputs,
            group,
        },
    };
}

interface TaskFields {
    dependencies: string[];
    files: string[];
    specRefs: string[];
    scenarioRefs: string[];
    verification?: string;
    outputs: string[];
}

function parseTaskFields(lines: readonly string[]): TaskFields {
    const fields: TaskFields = {
        dependencies: [],
        files: [],
        specRefs: [],
        scenarioRefs: [],
        outputs: [],
    };
    for (const line of lines) {
        const dependency = readField(line, ['依赖', 'Dependencies', 'Depends on']);
        if (dependency !== undefined) {
            fields.dependencies.push(...extractIds(dependency));
        }
        const file = readField(line, ['文件', 'Files', 'File']);
        if (file !== undefined) {
            fields.files.push(...extractPaths(file));
        }
        const refs = readRefFields(line);
        fields.specRefs.push(...refs.specRefs);
        fields.scenarioRefs.push(...refs.scenarioRefs);
        const verification = readField(line, ['验证', 'Verification', 'Verify']);
        if (verification !== undefined) {
            fields.verification = verification;
        }
        const output = readField(line, ['产出', 'Output']);
        if (output !== undefined) {
            fields.outputs.push(...extractPaths(output));
        }
    }
    return fields;
}

interface RefFields {
    specRefs: string[];
    scenarioRefs: string[];
}

/**
 * 解析一行中的 Spec Ref / Scenario Ref（多形态兼容）。
 *
 * 接受：行式 `- Spec Ref：...`、HTML 注释式 `<!-- Spec Ref: ... -->`、
 * `→` 链式（`capability → Requirement: "R" → Scenario: "S"`，可带标签）、
 * 同一行同时含两个标签、以及历史裸名（值原样保留，语义层再匹配）。
 */
function readRefFields(line: string): RefFields {
    const result: RefFields = { specRefs: [], scenarioRefs: [] };
    const matches = [...line.matchAll(REF_LABEL_PATTERN)];
    if (matches.length === 0) return result;

    for (let index = 0; index < matches.length; index += 1) {
        const match = matches[index];
        const label = match[1];
        const start = (match.index ?? 0) + match[0].length;
        const end = index + 1 < matches.length ? (matches[index + 1].index ?? line.length) : line.length;
        const rawValue = line.slice(start, end).replace(REF_VALUE_NOISE, '').replace(/[；;，,]\s*$/, '').trim();
        if (rawValue.length === 0) continue;
        const isSpecLabel = (SPEC_REF_LABELS as readonly string[]).includes(label);
        const { specRef, scenarioRef } = interpretRefValue(rawValue);
        if (isSpecLabel) {
            result.specRefs.push(specRef);
            if (scenarioRef !== undefined) result.scenarioRefs.push(scenarioRef);
        } else {
            result.scenarioRefs.push(scenarioRef ?? rawValue);
            // Scenario 标签行只写到 capability / Requirement 时，同样产出 specRef（一行双引用的等价形态）
            if (scenarioRef === undefined && specRef !== rawValue) result.specRefs.push(specRef);
        }
    }
    return result;
}

/** 把引用值解释为 `capability / Requirement` 与 `capability / Requirement / Scenario` */
function interpretRefValue(value: string): { specRef: string; scenarioRef?: string } {
    if (!value.includes('→')) {
        return { specRef: value };
    }
    let capability = '';
    let requirement = '';
    let scenario = '';
    for (const segment of value.split('→').map((item) => item.trim()).filter(Boolean)) {
        const requirementMatch = CHAIN_REQUIREMENT_PATTERN.exec(segment);
        if (requirementMatch !== null) {
            requirement = requirementMatch[1].trim();
            continue;
        }
        const scenarioMatch = CHAIN_SCENARIO_PATTERN.exec(segment);
        if (scenarioMatch !== null) {
            scenario = scenarioMatch[1].trim();
            continue;
        }
        if (capability.length === 0) capability = segment;
    }
    const parts = [capability, requirement, scenario].filter((part) => part.length > 0);
    if (parts.length === 0) return { specRef: value };
    const specRef = capability && requirement ? `${capability} / ${requirement}` : parts[0];
    const scenarioRef = capability && requirement && scenario ? `${capability} / ${requirement} / ${scenario}` : undefined;
    return scenarioRef === undefined ? { specRef } : { specRef, scenarioRef };
}

function readField(line: string, labels: readonly string[]): string | undefined {
    for (const label of labels) {
        const pattern = new RegExp(`^\\s*(?:[-*]\\s*)?${escapeRegExp(label)}\\s*[：:]\\s*(.*?)\\s*$`, 'i');
        const match = pattern.exec(line);
        if (match !== null) return match[1].trim();
    }
    return undefined;
}

function extractIds(value: string): string[] {
    return [...value.matchAll(/\d+(?:\.\d+)+/g)].map((match) => match[0]);
}

function extractPaths(value: string): string[] {
    const codePaths = [...value.matchAll(/`([^`]+)`/g)].map((match) => match[1].trim());
    return codePaths.length > 0 ? codePaths : value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findCyclicDependencies(tasks: readonly ParsedTask[], filePath: string): ArtifactDiagnostic[] {
    const byId = new Map(tasks.map((task) => [task.id, task]));
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const reported = new Set<string>();
    const diagnostics: ArtifactDiagnostic[] = [];

    const visit = (id: string, stack: string[]): void => {
        if (visiting.has(id)) {
            const cycleStart = stack.indexOf(id);
            const cycle = [...stack.slice(cycleStart), id].join(' -> ');
            if (!reported.has(cycle)) {
                reported.add(cycle);
                const task = byId.get(id);
                diagnostics.push({
                    severity: 'error',
                    code: 'cyclic-task-dependency',
                    message: `任务存在循环依赖：${cycle}`,
                    filePath,
                    line: task?.line ?? 1,
                });
            }
            return;
        }
        if (visited.has(id)) return;
        visiting.add(id);
        const task = byId.get(id);
        for (const dependency of task?.dependencies ?? []) {
            if (byId.has(dependency)) visit(dependency, [...stack, id]);
        }
        visiting.delete(id);
        visited.add(id);
    };

    for (const task of tasks) visit(task.id, []);
    return diagnostics;
}
