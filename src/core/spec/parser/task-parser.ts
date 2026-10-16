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
        const specRef = readField(line, ['Spec Ref', '规格引用']);
        if (specRef !== undefined) {
            fields.specRefs.push(specRef);
        }
        const scenarioRef = readField(line, ['Scenario Ref', '场景引用']);
        if (scenarioRef !== undefined) {
            fields.scenarioRefs.push(scenarioRef);
        }
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
