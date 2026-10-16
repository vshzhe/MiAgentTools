import type {
    ArtifactDiagnostic,
    ParsedSpec,
    ParsedTask,
    TraceabilityIssue,
} from '../model/artifact-model.js';

export interface TraceabilityResult {
    issues: TraceabilityIssue[];
    diagnostics: ArtifactDiagnostic[];
}

/**
 * 建立可读的 Spec Ref / Scenario Ref 覆盖关系。
 * 引用不做模糊猜测；只按 capability、Requirement、Scenario 的稳定文本匹配。
 */
export function buildTraceability(
    specs: readonly ParsedSpec[],
    tasks: readonly ParsedTask[],
    tasksFilePath = '<tasks.md>',
): TraceabilityResult {
    const issues: TraceabilityIssue[] = [];
    const diagnostics: ArtifactDiagnostic[] = [];
    const requirements = specs.flatMap((spec) => spec.requirements.map((requirement) => ({ spec, requirement })));

    for (const task of tasks) {
        for (const ref of task.specRefs) {
            if (!findRequirement(ref, requirements)) {
                issues.push({
                    kind: 'invalid-spec-ref',
                    message: `任务 ${task.id} 的 Spec Ref 无法匹配：${ref}`,
                    filePath: tasksFilePath,
                    line: task.line,
                });
            }
        }
        for (const ref of task.scenarioRefs) {
            if (!findScenario(ref, requirements)) {
                issues.push({
                    kind: 'invalid-scenario-ref',
                    message: `任务 ${task.id} 的 Scenario Ref 无法匹配：${ref}`,
                    filePath: tasksFilePath,
                    line: task.line,
                });
            }
        }
    }

    for (const entry of requirements) {
        for (const scenario of entry.requirement.scenarios) {
            const covered = tasks.some((task) =>
                task.scenarioRefs.some((ref) => matchesScenarioRef(ref, entry.spec.capability, entry.requirement.name, scenario.name)),
            );
            if (!covered) {
                issues.push({
                    kind: 'untested-scenario',
                    message: `Scenario 尚未关联任务：${entry.spec.capability} / ${entry.requirement.name} / ${scenario.name}`,
                    filePath: entry.spec.filePath,
                    line: scenario.line,
                });
            }
        }
    }

    for (const issue of issues) {
        diagnostics.push({
            severity: issue.kind === 'untested-scenario' ? 'warning' : 'error',
            code: issue.kind,
            message: issue.message,
            filePath: issue.filePath,
            line: issue.line,
        });
    }
    return { issues, diagnostics };
}

function findRequirement(
    ref: string,
    requirements: readonly { spec: ParsedSpec; requirement: ParsedSpec['requirements'][number] }[],
): boolean {
    const normalized = normalizeRef(ref);
    return requirements.some(({ spec, requirement }) =>
        normalized === normalizeRef(`${spec.capability} / ${requirement.name}`)
        || normalized === normalizeRef(requirement.name),
    );
}

function findScenario(
    ref: string,
    requirements: readonly { spec: ParsedSpec; requirement: ParsedSpec['requirements'][number] }[],
): boolean {
    return requirements.some(({ spec, requirement }) => requirement.scenarios.some((scenario) =>
        matchesScenarioRef(ref, spec.capability, requirement.name, scenario.name),
    ));
}

function matchesScenarioRef(ref: string, capability: string, requirement: string, scenario: string): boolean {
    return normalizeRef(ref) === normalizeRef(`${capability} / ${requirement} / ${scenario}`)
        || normalizeRef(ref) === normalizeRef(scenario);
}

function normalizeRef(value: string): string {
    return value.replaceAll('`', '').replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim().toLowerCase();
}

