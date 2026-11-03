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

/** 追溯校验选项 */
export interface TraceabilityOptions {
    /**
     * 起草期降级：specs 制品尚未完成时，未匹配引用降级为 `pending-ref` warning
     * （正常中间态），不使校验失败。specs 已完成时 MUST NOT 设置本项。
     */
    degradeUnmatchedRefs?: boolean;
}

/**
 * 建立可读的 Spec Ref / Scenario Ref 覆盖关系。
 * 引用不做模糊猜测；只按 capability、Requirement、Scenario 的稳定文本匹配。
 *
 * 语义层诊断分层（D3）：
 * - 引用只到 capability → `spec-ref-missing-requirement`（消息含「缺少 Requirement」）；
 * - Scenario Ref 只到 `capability / Requirement` → `scenario-ref-missing-scenario`；
 * - 其余未匹配 → `invalid-spec-ref` / `invalid-scenario-ref`；
 * - `degradeUnmatchedRefs` 下上述四类降级为 `pending-ref` warning。
 */
export function buildTraceability(
    specs: readonly ParsedSpec[],
    tasks: readonly ParsedTask[],
    tasksFilePath = '<tasks.md>',
    options: TraceabilityOptions = {},
): TraceabilityResult {
    const issues: TraceabilityIssue[] = [];
    const diagnostics: ArtifactDiagnostic[] = [];
    const requirements = specs.flatMap((spec) => spec.requirements.map((requirement) => ({ spec, requirement })));

    for (const task of tasks) {
        for (const ref of task.specRefs) {
            if (findRequirement(ref, requirements)) continue;
            if (isCapabilityOnly(ref, specs)) {
                issues.push({
                    kind: 'spec-ref-missing-requirement',
                    message:
                        `任务 ${task.id} 的 Spec Ref 缺少 Requirement：${ref}`
                        + `（期望形态：<capability> / <Requirement>，只写 capability 不是有效 Spec Ref）`,
                    filePath: tasksFilePath,
                    line: task.line,
                });
                continue;
            }
            issues.push({
                kind: 'invalid-spec-ref',
                message: `任务 ${task.id} 的 Spec Ref 无法匹配：${ref}`,
                filePath: tasksFilePath,
                line: task.line,
            });
        }
        for (const ref of task.scenarioRefs) {
            if (findScenario(ref, requirements)) continue;
            if (isRequirementOnly(ref, requirements)) {
                issues.push({
                    kind: 'scenario-ref-missing-scenario',
                    message:
                        `任务 ${task.id} 的 Scenario Ref 缺少 Scenario：${ref}`
                        + '（期望形态：<capability> / <Requirement> / <Scenario>）',
                    filePath: tasksFilePath,
                    line: task.line,
                });
                continue;
            }
            issues.push({
                kind: 'invalid-scenario-ref',
                message: `任务 ${task.id} 的 Scenario Ref 无法匹配：${ref}`,
                filePath: tasksFilePath,
                line: task.line,
            });
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

    const degrade = options.degradeUnmatchedRefs === true;
    for (const issue of issues) {
        // 场景覆盖缺失始终是 warning；引用未匹配默认 error，起草期可降级
        if (issue.kind === 'untested-scenario') {
            diagnostics.push({ severity: 'warning', code: issue.kind, message: issue.message, filePath: issue.filePath, line: issue.line });
            continue;
        }
        if (degrade) {
            diagnostics.push({
                severity: 'warning',
                code: 'pending-ref',
                message: `${issue.message}（起草期降级为 pending-ref：specs 制品尚未完成）`,
                filePath: issue.filePath,
                line: issue.line,
            });
            continue;
        }
        diagnostics.push({ severity: 'error', code: issue.kind, message: issue.message, filePath: issue.filePath, line: issue.line });
    }
    return { issues, diagnostics };
}

/** 引用是否只写到 capability（该值恰好是某个已存在的 capability 名） */
function isCapabilityOnly(ref: string, specs: readonly ParsedSpec[]): boolean {
    const normalized = normalizeRef(ref);
    return specs.some((spec) => normalizeRef(spec.capability) === normalized);
}

/** 引用是否只写到 `capability / Requirement`（缺少 Scenario 段） */
function isRequirementOnly(
    ref: string,
    requirements: readonly { spec: ParsedSpec; requirement: ParsedSpec['requirements'][number] }[],
): boolean {
    const normalized = normalizeRef(ref);
    return requirements.some(({ spec, requirement }) => normalized === normalizeRef(`${spec.capability} / ${requirement.name}`));
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
