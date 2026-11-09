/**
 * 实现一致性（implementation conformance）判定内核。
 *
 * 三层判定（规划层 / 实现层 / 测试层）：
 * - 规划层：每个 Requirement 至少一个任务覆盖，每个 Scenario 至少一个任务覆盖；
 * - 实现层：每个已勾选 `[代码]` 任务具备可核验的产出证据（tasks `产出:` / git diff / handoff 产出登记）；
 * - 测试层：每个 Scenario 至少一个 `[测试]` 任务覆盖。
 *
 * 纯函数、无 I/O：证据来源由调用方注入，便于单测与 CLI/技能复用。
 */

import type {
    ParsedSpec,
    ParsedTask,
} from '../model/artifact-model.js';
import {
    normalizeRef,
    resolveScenarioRefs,
    type ScenarioRefResolution,
} from '../parser/reference-resolver.js';

/** 一致性缺失项 */
export interface ConformanceFinding {
    code:
        | 'requirement-without-task'
        | 'scenario-without-test'
        | 'missing-implementation-evidence'
        | 'rules-not-read'
        | 'change-not-found';
    message: string;
    filePath: string;
    line: number;
    taskId?: string;
}

/** 覆盖矩阵行（每个 Scenario 一行） */
export interface ConformanceMatrixRow {
    capability: string;
    requirement: string;
    scenario: string;
    coveringTasks: string[];
    taskStatus: 'done' | 'pending' | 'missing';
    implementationEvidence: string[];
    testEvidence: string[];
    status: 'covered' | 'missing-task' | 'missing-test' | 'missing-evidence';
}

export interface ConformanceResult {
    valid: boolean;
    matrix: ConformanceMatrixRow[];
    findings: ConformanceFinding[];
    /** 非阻断提示（skip_specs / 历史 JSON 降级等） */
    notices: string[];
    requirements: number;
    scenarios: number;
}

export interface ConformanceEvidence {
    /** 任务 id → 已核验的产出文件 / 符号路径 */
    outputByTask?: Readonly<Record<string, readonly string[]>>;
    /** 规则源完整性：required 为枚举到的存在源，read 为回执实际读取源 */
    rules?: {
        required: readonly string[];
        read: readonly string[];
    };
}

export interface ConformanceOptions extends ConformanceEvidence {
    tasksFilePath?: string;
    /** 变更声明 skip_specs：跳过 specs 侧判定（不报失败） */
    skipSpecs?: boolean;
    /** 历史 JSON-only 变更：只读降级并记 notice */
    legacyJson?: boolean;
}

interface RequirementEntry {
    spec: ParsedSpec;
    requirement: ParsedSpec['requirements'][number];
}

/**
 * 执行三层一致性判定。
 *
 * MUST NOT 用任务描述语义猜测覆盖关系：缺 `Spec Ref` / `Scenario Ref` 即视为未覆盖。
 */
export function buildConformance(
    specs: readonly ParsedSpec[],
    tasks: readonly ParsedTask[],
    options: ConformanceOptions = {},
): ConformanceResult {
    const findings: ConformanceFinding[] = [];
    const notices: string[] = [];
    const matrix: ConformanceMatrixRow[] = [];
    const tasksFilePath = options.tasksFilePath ?? '<tasks.md>';

    if (options.skipSpecs === true) {
        notices.push('specs 侧不适用（变更声明 skip_specs）');
        return finish([], findings, notices, specs);
    }
    if (options.legacyJson === true) {
        notices.push('历史 JSON-only 变更：一致性命中按只读降级处理');
    }

    const requirements = specs.flatMap((spec) =>
        spec.requirements.map((requirement) => ({ spec, requirement })),
    );
    const resolutions = new Map<ParsedTask, readonly ScenarioRefResolution[]>();
    for (const task of tasks) {
        resolutions.set(task, resolveScenarioRefs(task.specRefs, task.scenarioRefs));
    }

    for (const entry of requirements) {
        const covering = tasks.filter((task) => taskCoversRequirement(task, entry));
        if (covering.length === 0) {
            findings.push({
                code: 'requirement-without-task',
                message: `Requirement 未被任何任务覆盖：${entry.spec.capability} / ${entry.requirement.name}`,
                filePath: entry.spec.filePath,
                line: entry.requirement.line,
            });
        }
        for (const scenario of entry.requirement.scenarios) {
            const coveringTasks = tasks.filter((task) =>
                (resolutions.get(task) ?? []).some((resolution) =>
                    isResolved(resolution)
                    && matchesScenario(resolution.resolved, entry.spec.capability, entry.requirement.name, scenario.name),
                ),
            );
            const testTasks = coveringTasks.filter((task) => task.kind === '测试');
            if (testTasks.length === 0) {
                findings.push({
                    code: 'scenario-without-test',
                    message: `Scenario 缺少 [测试] 任务覆盖：${entry.spec.capability} / ${entry.requirement.name} / ${scenario.name}`,
                    filePath: entry.spec.filePath,
                    line: scenario.line,
                });
            }
            const implementationEvidence = collectEvidence(coveringTasks, options.outputByTask);
            const missingEvidenceTask = coveringTasks.find(
                (task) => task.checked && isCodeTask(task)
                    && collectEvidence([task], options.outputByTask).length === 0,
            );
            if (missingEvidenceTask !== undefined) {
                findings.push({
                    code: 'missing-implementation-evidence',
                    message: `已勾选任务缺少产出证据：任务 ${missingEvidenceTask.id}`,
                    filePath: tasksFilePath,
                    line: missingEvidenceTask.line,
                    taskId: missingEvidenceTask.id,
                });
            }
            matrix.push({
                capability: entry.spec.capability,
                requirement: entry.requirement.name,
                scenario: scenario.name,
                coveringTasks: coveringTasks.map((task) => task.id),
                taskStatus: aggregateStatus(coveringTasks),
                implementationEvidence,
                testEvidence: testTasks.map((task) => task.id),
                status: testTasks.length === 0
                    ? 'missing-test'
                    : missingEvidenceTask !== undefined
                        ? 'missing-evidence'
                        : coveringTasks.length === 0
                            ? 'missing-task'
                            : 'covered',
            });
        }
    }

    if (options.rules !== undefined) {
        const read = new Set(options.rules.read.map((item) => normalizeRef(item)));
        for (const required of options.rules.required) {
            if (!read.has(normalizeRef(required))) {
                findings.push({
                    code: 'rules-not-read',
                    message: `规则源未被读取：${required}`,
                    filePath: required,
                    line: 1,
                });
            }
        }
    }

    return finish(matrix, findings, notices, specs);
}

function finish(
    matrix: ConformanceMatrixRow[],
    findings: ConformanceFinding[],
    notices: string[],
    specs: readonly ParsedSpec[],
): ConformanceResult {
    const requirements = specs.reduce((sum, spec) => sum + spec.requirements.length, 0);
    const scenarios = specs.reduce(
        (sum, spec) => sum + spec.requirements.reduce((inner, requirement) => inner + requirement.scenarios.length, 0),
        0,
    );
    return {
        valid: findings.length === 0,
        matrix,
        findings,
        notices,
        requirements,
        scenarios,
    };
}

function taskCoversRequirement(task: ParsedTask, entry: RequirementEntry): boolean {
    return task.specRefs.some((ref) =>
        matchesRequirement(ref, entry.spec.capability, entry.requirement.name),
    );
}

function matchesRequirement(ref: string, capability: string, requirement: string): boolean {
    const normalized = normalizeRef(ref);
    return normalized === normalizeRef(`${capability} / ${requirement}`)
        || normalized === normalizeRef(requirement);
}

function matchesScenario(ref: string, capability: string, requirement: string, scenario: string): boolean {
    return normalizeRef(ref) === normalizeRef(`${capability} / ${requirement} / ${scenario}`);
}

function isResolved(resolution: ScenarioRefResolution): resolution is Extract<ScenarioRefResolution, { resolved: string }> {
    return resolution.kind === 'full-path' || resolution.kind === 'leaf-resolved';
}

function isCodeTask(task: ParsedTask): boolean {
    return task.kind === undefined || task.kind === '代码';
}

function collectEvidence(
    tasks: readonly ParsedTask[],
    outputByTask: Readonly<Record<string, readonly string[]>> | undefined,
): string[] {
    const evidence = new Set<string>();
    for (const task of tasks) {
        for (const file of task.files) {
            evidence.add(file);
        }
        for (const output of task.outputs) {
            evidence.add(output);
        }
        for (const output of outputByTask?.[task.id] ?? []) {
            evidence.add(output);
        }
    }
    return [...evidence];
}

function aggregateStatus(tasks: readonly ParsedTask[]): 'done' | 'pending' | 'missing' {
    if (tasks.length === 0) return 'missing';
    return tasks.every((task) => task.checked) ? 'done' : 'pending';
}

/** 生成 Markdown 一致性证据正文（九列 + 汇总行） */
export function renderConformanceReport(
    changeName: string,
    result: ConformanceResult,
): string {
    const rows = result.matrix.map((row) =>
        `| ${changeName} | ${row.requirement} | ${row.scenario} | ${row.coveringTasks.join(',') || '-'} | ${row.taskStatus} | ${row.implementationEvidence.join(',') || '-'} | ${row.testEvidence.join(',') || '-'} | ${row.status} | ${row.status === 'covered' ? '-' : row.status} |`,
    );
    return [
        '| change | requirement | scenario | coveringTasks | taskStatus | implementationEvidence | testEvidence | status | reason |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
        ...rows,
        '',
        `**summary**: status=${result.valid ? 'pass' : 'fail'}, requirements=${result.requirements}, scenarios=${result.scenarios}, findings=${result.findings.length}`,
        '',
    ].join('\n');
}

/** 渲染 CLI JSON 载荷 */
export interface ConformanceJsonOutput {
    changeName: string;
    changeRoot: string;
    mode: 'report' | 'strict';
    valid: boolean;
    matrix: ConformanceMatrixRow[];
    findings: ConformanceFinding[];
    notices: string[];
}

/** 渲染人类可读文本 */
export function renderConformanceText(output: ConformanceJsonOutput): string {
    const lines = [
        `实现一致性（${output.changeName}，模式：${output.mode}）：${output.valid ? '通过' : '未通过'}`,
    ];
    for (const notice of output.notices) {
        lines.push(`  i ${notice}`);
    }
    if (output.findings.length === 0) {
        lines.push(`  覆盖 ${output.matrix.length} 个 Scenario，未发现缺失项。`);
        return lines.join('\n');
    }
    lines.push(`  缺失项（${output.findings.length}）：`);
    for (const finding of output.findings) {
        lines.push(`    [${finding.code}] ${finding.filePath}:${finding.line} ${finding.message}`);
    }
    return lines.join('\n');
}
