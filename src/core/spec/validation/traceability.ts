import type {
    ArtifactDiagnostic,
    ParsedSpec,
    ParsedTask,
    TraceabilityIssue,
} from '../model/artifact-model.js';
import { normalizeRef, resolveScenarioRefs, type ScenarioRefResolution } from '../parser/reference-resolver.js';

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
 * Scenario Ref 支持场景叶子名：用**同一任务**的 Spec Ref 补全为
 * `capability / Requirement / Scenario` 全路径后参与匹配（D2，补全见 `reference-resolver.ts`）；
 * 叶子名无法消歧时报 `scenario-ref-missing-context` / `ambiguous-scenario-ref`，MUST NOT 猜测归属。
 *
 * 语义层诊断分层（D3）：
 * - 引用只到 capability → `spec-ref-missing-requirement`（消息含「缺少 Requirement」）；
 * - Scenario Ref 只到 `capability / Requirement` → `scenario-ref-missing-scenario`；
 * - 叶子名无 Spec Ref → `scenario-ref-missing-context`（含「缺少上下文」）；
 * - 叶子名 + ≥2 条 Spec Ref → `ambiguous-scenario-ref`（含「歧义」）；
 * - 其余未匹配 → `invalid-spec-ref` / `invalid-scenario-ref`；
 * - `degradeUnmatchedRefs` 下上述除 `untested-scenario` 外的诊断均降级为 `pending-ref` warning。
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

    // 每个任务的 Scenario Ref 只解析一次，覆盖匹配与诊断共用同一结果
    const resolutions = new Map<ParsedTask, readonly ScenarioRefResolution[]>();
    for (const task of tasks) {
        resolutions.set(task, resolveScenarioRefs(task.specRefs, task.scenarioRefs));
    }

    for (const task of tasks) {
        // 同一任务内按「诊断码 + 归一化目标」去重：混合写法（全路径 + 叶子名）只报一次
        const reported = new Set<string>();
        const pushIssue = (kind: TraceabilityIssue['kind'], target: string, message: string): void => {
            const key = `${kind}|${normalizeRef(target)}`;
            if (reported.has(key)) return;
            reported.add(key);
            issues.push({ kind, message, filePath: tasksFilePath, line: task.line });
        };

        for (const ref of task.specRefs) {
            if (findRequirement(ref, requirements)) continue;
            if (isCapabilityOnly(ref, specs)) {
                pushIssue(
                    'spec-ref-missing-requirement',
                    ref,
                    `任务 ${task.id} 的 Spec Ref 缺少 Requirement：${ref}`
                    + `（期望形态：<capability> / <Requirement>，只写 capability 不是有效 Spec Ref）`,
                );
                continue;
            }
            pushIssue('invalid-spec-ref', ref, `任务 ${task.id} 的 Spec Ref 无法匹配：${ref}`);
        }

        for (const resolution of resolutions.get(task) ?? []) {
            switch (resolution.kind) {
                case 'missing-context':
                    pushIssue(
                        'scenario-ref-missing-context',
                        resolution.ref,
                        `任务 ${task.id} 的 Scenario Ref 缺少上下文：${resolution.ref}`
                        + '（场景叶子名需要同一任务的 Spec Ref 补全；请写全路径 <capability> / <Requirement> / <Scenario>）',
                    );
                    break;
                case 'ambiguous':
                    pushIssue(
                        'ambiguous-scenario-ref',
                        resolution.ref,
                        `任务 ${task.id} 的 Scenario Ref 存在歧义：${resolution.ref}`
                        + `（任务有 ${resolution.specRefCount} 条 Spec Ref，场景叶子名无法消歧；`
                        + '请写全路径 <capability> / <Requirement> / <Scenario>）',
                    );
                    break;
                default: {
                    const resolved = resolution.resolved;
                    if (findScenario(resolved, requirements)) continue;
                    if (isRequirementOnly(resolved, requirements)) {
                        pushIssue(
                            'scenario-ref-missing-scenario',
                            resolved,
                            `任务 ${task.id} 的 Scenario Ref 缺少 Scenario：${resolution.ref}`
                            + '（期望形态：<capability> / <Requirement> / <Scenario>）',
                        );
                        continue;
                    }
                    pushIssue(
                        'invalid-scenario-ref',
                        resolved,
                        `任务 ${task.id} 的 Scenario Ref 无法匹配：${resolution.ref}`,
                    );
                    break;
                }
            }
        }
    }

    for (const entry of requirements) {
        for (const scenario of entry.requirement.scenarios) {
            const covered = tasks.some((task) =>
                (resolutions.get(task) ?? []).some((resolution) =>
                    (resolution.kind === 'full-path' || resolution.kind === 'leaf-resolved')
                    && matchesScenarioRef(
                        resolution.resolved,
                        entry.spec.capability,
                        entry.requirement.name,
                        scenario.name,
                    ),
                ),
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

/**
 * Scenario 匹配只接受完整全路径（叶子名已由补全层转换）。
 * MUST NOT 退回「裸场景名全局相等」—— 那会跨 Requirement / capability 误匹配。
 */
function matchesScenarioRef(ref: string, capability: string, requirement: string, scenario: string): boolean {
    return normalizeRef(ref) === normalizeRef(`${capability} / ${requirement} / ${scenario}`);
}
