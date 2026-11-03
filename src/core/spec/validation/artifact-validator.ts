import type {
    ArtifactDiagnostic,
    ParsedChange,
    ParsedSpec,
    ParsedTasks,
} from '../model/artifact-model.js';
import { buildTraceability } from './traceability.js';

export interface ArtifactValidationResult {
    valid: boolean;
    diagnostics: ArtifactDiagnostic[];
}

/** 校验选项（由 `iagent spec validate` 的模式透传） */
export interface ArtifactValidationOptions {
    /** 起草期降级：specs 尚未完成时把未匹配引用降级为 pending-ref warning */
    degradeUnmatchedRefs?: boolean;
}

/** 对已经解析的 Markdown artifact 执行统一校验。 */
export function validateParsedChange(
    change: ParsedChange,
    options: ArtifactValidationOptions = {},
): ArtifactValidationResult {
    const diagnostics: ArtifactDiagnostic[] = [
        ...change.diagnostics,
        ...(change.proposal?.diagnostics ?? []),
        ...(change.design?.diagnostics ?? []),
        ...change.specs.flatMap((spec) => spec.diagnostics),
        ...(change.tasks?.diagnostics ?? []),
    ];

    if (change.tasks !== undefined) {
        diagnostics.push(...validateTasks(change.tasks));
        // 跨制品追溯只在 tasks 与 specs 同时可用时执行（单制品校验 / 起草期由调用方记 traceability-skipped）
        if (change.specs.length > 0) {
            diagnostics.push(
                ...buildTraceability(change.specs, change.tasks.tasks, change.tasks.filePath, {
                    degradeUnmatchedRefs: options.degradeUnmatchedRefs,
                }).diagnostics,
            );
        }
    }
    for (const spec of change.specs) {
        diagnostics.push(...validateSpec(spec));
    }
    return {
        valid: diagnostics.every((diagnostic) => diagnostic.severity !== 'error'),
        diagnostics,
    };
}

export function validateSpec(spec: ParsedSpec): ArtifactDiagnostic[] {
    const diagnostics: ArtifactDiagnostic[] = [];
    for (const requirement of spec.requirements) {
        if ((requirement.operation === 'ADDED' || requirement.operation === 'MODIFIED')
            && requirement.description.trim().length === 0) {
            diagnostics.push({
                severity: 'error',
                code: 'empty-requirement-description',
                message: `Requirement 缺少正文：${requirement.name}`,
                filePath: spec.filePath,
                line: requirement.line,
            });
        }
        if (requirement.operation === 'RENAMED') {
            if (!requirement.from || !requirement.to) {
                diagnostics.push({
                    severity: 'error',
                    code: 'invalid-rename',
                    message: `RENAMED Requirement 必须包含 FROM 和 TO：${requirement.name}`,
                    filePath: spec.filePath,
                    line: requirement.line,
                });
            }
        }
    }
    return diagnostics;
}

function validateTasks(tasks: ParsedTasks): ArtifactDiagnostic[] {
    const diagnostics: ArtifactDiagnostic[] = [];
    for (const task of tasks.tasks) {
        if (task.kind === '测试' && task.testLevel === undefined) {
            diagnostics.push({
                severity: 'warning',
                code: 'missing-test-level',
                message: `测试任务缺少 [单元] 或 [功能] 子标签：${task.id}`,
                filePath: tasks.filePath,
                line: task.line,
            });
        }
        if (task.kind === '测试' && task.priority === undefined) {
            diagnostics.push({
                severity: 'warning',
                code: 'missing-test-priority',
                message: `测试任务缺少 [P0]/[P1]/[P2] 优先级：${task.id}`,
                filePath: tasks.filePath,
                line: task.line,
            });
        }
        if (task.kind === '使用说明' && task.outputs.length === 0) {
            diagnostics.push({
                severity: 'warning',
                code: 'missing-task-output',
                message: `使用说明任务缺少产出路径：${task.id}`,
                filePath: tasks.filePath,
                line: task.line,
            });
        }
    }
    return diagnostics;
}
