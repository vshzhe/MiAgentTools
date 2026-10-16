/**
 * Markdown-first spec artifact 的运行时模型。
 *
 * 这些类型只表示解析结果，不对应任何持久化 JSON 文件；Markdown 仍是唯一真源。
 */

export type DiagnosticSeverity = 'error' | 'warning';

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
    rawContent: string;
    diagnostics: ArtifactDiagnostic[];
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
    kind: 'missing-task' | 'invalid-spec-ref' | 'invalid-scenario-ref' | 'untested-scenario';
    message: string;
    filePath: string;
    line: number;
}
