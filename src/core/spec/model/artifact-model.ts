/**
 * Markdown-first spec artifact 的运行时模型。
 *
 * 这些类型只表示解析结果，不对应任何持久化 JSON 文件；Markdown 仍是唯一真源。
 */

/**
 * 诊断严重度：
 * - `error`：结构/语义错误，使 `valid` 为 false；
 * - `warning`：提示，不影响 `valid`；
 * - `incomplete`：起草期「制品尚未创建」的事实，不影响 `valid`（`iagent spec validate --partial`）。
 */
export type DiagnosticSeverity = 'error' | 'warning' | 'incomplete';

export interface ArtifactDiagnostic {
    severity: DiagnosticSeverity;
    message: string;
    filePath: string;
    line: number;
    column?: number;
    code?: string;
}

export interface MarkdownDocument {
    filePath: string;
    content: string;
    lines: string[];
}

export interface MarkdownHeading {
    level: number;
    text: string;
    line: number;
    startOffset: number;
}

export interface MarkdownSection {
    heading: MarkdownHeading;
    body: string;
    bodyLines: string[];
    endLine: number;
}

export interface ParsedProposal {
    filePath: string;
    title?: string;
    sections: Map<string, MarkdownSection>;
    /** `## What Changes` 下的变更项清单（`- ` 列表项文本，按出现顺序） */
    whatChanges: string[];
    /** `### New Capabilities` / `### Modified Capabilities` 声明的能力 */
    capabilities: ParsedCapability[];
    rawContent: string;
    diagnostics: ArtifactDiagnostic[];
}

/** proposal 声明的能力条目 */
export interface ParsedCapability {
    /** 能力名（kebab-case，对应 specs/<name>/spec.md） */
    name: string;
    /** 能力简述 */
    description: string;
    /** 声明位置：新增能力 / 修改能力 */
    kind: 'new' | 'modified';
    /** 声明所在行 */
    line: number;
}

export interface ParsedDecision {
    id?: string;
    title: string;
    body: string;
    line: number;
}

export interface ParsedDesign {
    filePath: string;
    title?: string;
    sections: Map<string, MarkdownSection>;
    decisions: ParsedDecision[];
    rawContent: string;
    diagnostics: ArtifactDiagnostic[];
}

export type DeltaOperationType = 'ADDED' | 'MODIFIED' | 'REMOVED' | 'RENAMED';

export interface ParsedScenario {
    name: string;
    given?: string;
    when?: string;
    then?: string;
    body: string;
    line: number;
}

export interface ParsedRequirement {
    name: string;
    operation: DeltaOperationType;
    description: string;
    scenarios: ParsedScenario[];
    reason?: string;
    migration?: string;
    from?: string;
    to?: string;
    line: number;
}

export interface ParsedSpec {
    capability: string;
    filePath: string;
    purpose?: string;
    requirements: ParsedRequirement[];
    sections: Map<string, MarkdownSection>;
    rawContent: string;
    diagnostics: ArtifactDiagnostic[];
}

export type TaskKind = '代码' | '测试' | 'DB脚本' | '使用说明' | string;

export interface ParsedTask {
    id: string;
    checked: boolean;
    description: string;
    rawLine: string;
    line: number;
    indent: number;
    kind?: TaskKind;
    testLevel?: '单元' | '功能' | string;
    priority?: 'P0' | 'P1' | 'P2' | string;
    dependencies: string[];
    files: string[];
    specRefs: string[];
    scenarioRefs: string[];
    verification?: string;
    outputs: string[];
    group?: string;
    /** 功能流程图节点标注（`[N<id>]`，按出现顺序；一个任务可承载多个节点） */
    nodeRefs?: string[];
    /** 首个节点标注（与遗留 JSON sidecar 的 `nodeRef` 同名字段兼容；等价 `nodeRefs?.[0]`） */
    nodeRef?: string;
}

export interface ParsedTasks {
    filePath: string;
    tasks: ParsedTask[];
    rawContent: string;
    diagnostics: ArtifactDiagnostic[];
}

export interface ParsedChange {
    changeName: string;
    changeRoot: string;
    proposal?: ParsedProposal;
    design?: ParsedDesign;
    specs: ParsedSpec[];
    tasks?: ParsedTasks;
    diagnostics: ArtifactDiagnostic[];
    warnings: ArtifactDiagnostic[];
}

export interface TraceabilityIssue {
    kind:
        | 'missing-task'
        | 'invalid-spec-ref'
        | 'invalid-scenario-ref'
        | 'spec-ref-missing-requirement'
        | 'scenario-ref-missing-scenario'
        | 'scenario-ref-missing-context'
        | 'ambiguous-scenario-ref'
        | 'pending-ref'
        | 'untested-scenario'
        | 'requirement-without-task'
        | 'scenario-without-test';
    message: string;
    filePath: string;
    line: number;
}
