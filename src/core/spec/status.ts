/**
 * Markdown-first 变更状态校验：artifact 完成度 + tasks.md 进度。
 *
 * Markdown 是新变更的唯一真源；旧 JSON 仅在对应 Markdown 缺失时只读兼容。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    SPEC_DRIVEN_SCHEMA,
    isOptionalArtifact,
    requiredClosure,
    requiredDeps,
} from './schema.js';
import { parseDesign } from './parser/design-parser.js';
import { findMarkdownFiles } from './parser/markdown-parser.js';
import { parseProposal } from './parser/proposal-parser.js';
import { parseSpec } from './parser/spec-parser.js';
import { parseTasks } from './parser/task-parser.js';
import type { ArtifactDiagnostic } from './model/artifact-model.js';
import { readLegacySection, readLegacyTasks } from './legacy-artifacts.js';

export interface ArtifactStatus {
    id: string;
    outputPath: string;
    status: 'done' | 'ready' | 'blocked' | 'invalid' | 'optional';
    /** 声明依赖（保留 `id?` 后缀，供消费方识别可选依赖；判定 MUST 走 schema helper） */
    requires: string[];
    missingDeps?: string[];
    diagnostics?: ArtifactDiagnostic[];
}

/** 单个制品的路径信息（status / instructions apply 共用形状） */
export interface ArtifactPathInfo {
    /** 相对变更目录的声明路径（可能含 glob） */
    outputPath: string;
    /** 可直接写入的绝对路径（specs 为绝对目录，其余为单文件） */
    resolvedOutputPath: string;
    /** 当前已存在的绝对文件路径（缺失时为空数组） */
    existingOutputPaths: string[];
}

/** artifact id → 路径信息映射 */
export type ArtifactPathMap = Record<string, ArtifactPathInfo>;

export interface TaskProgress {
    total: number;
    complete: number;
    remaining: number;
}

export interface ChangeStatusResult {
    changeName: string;
    changeRoot: string;
    schemaName: string;
    artifacts: ArtifactStatus[];
    applyRequires: string[];
    progress: TaskProgress | null;
    isPlanningComplete: boolean;
    /** 规划根目录（<projectRoot>/openspec） */
    planningHome: string;
    /** artifact id → 路径字段（消费方 MUST NOT 自行拼接路径） */
    artifactPaths: ArtifactPathMap;
    warnings: string[];
}

interface ArtifactInspection {
    exists: boolean;
    valid: boolean;
    diagnostics: ArtifactDiagnostic[];
}

/** 返回变更目录内已完成且有效的 artifact。 */
export function detectCompleted(changeRoot: string): Set<string> {
    const completed = new Set<string>();
    for (const artifact of SPEC_DRIVEN_SCHEMA.artifacts) {
        const inspection = inspectArtifact(changeRoot, artifact.id);
        if (inspection.exists && inspection.valid) {
            completed.add(artifact.id);
        }
    }
    return completed;
}

/** specs 目录下是否存在 delta spec 文件，供 skip_specs 冲突判断使用。 */
export function hasDeltaSpecFiles(changeRoot: string): boolean {
    return artifactOutputExists(changeRoot, 'specs/**/*.md');
}

/**
 * 把声明路径归一化为可直接写入的绝对路径。
 *
 * `specs/**\/*.md` 一类 glob 取其静态前缀目录（`<changeRoot>/specs`），其余为单文件绝对路径；
 * 返回结果 MUST NOT 含 glob 片段。status 的 `artifactPaths[].resolvedOutputPath` 与
 * `instructions <id>` 的 `resolvedOutputPath` 共用本函数，保证语义一致。
 */
export function resolveWritablePath(changeRoot: string, outputPath: string): string {
    const globIndex = outputPath.search(/[*?]/);
    if (globIndex < 0) {
        return path.join(changeRoot, outputPath);
    }
    const staticPrefix = outputPath.slice(0, globIndex).replace(/[\\/]+$/, '');
    return staticPrefix.length === 0 ? changeRoot : path.join(changeRoot, staticPrefix);
}

/** 构造 artifact id → 路径信息映射（status 与 instructions apply 的唯一 builder）。 */
export function getArtifactPaths(changeRoot: string): ArtifactPathMap {
    const paths: ArtifactPathMap = {};
    for (const artifact of SPEC_DRIVEN_SCHEMA.artifacts) {
        const resolvedOutputPath = resolveWritablePath(changeRoot, artifact.outputPath);
        paths[artifact.id] = {
            outputPath: artifact.outputPath,
            resolvedOutputPath,
            existingOutputPaths: artifact.outputPath.includes('*')
                ? findMarkdownFiles(resolvedOutputPath)
                : (fs.existsSync(resolvedOutputPath) ? [resolvedOutputPath] : []),
        };
    }
    return paths;
}

/** 判断普通路径或 specs 递归 Markdown glob 是否存在。 */
export function artifactOutputExists(changeRoot: string, outputPath: string): boolean {
    if (!outputPath.includes('*')) {
        return fs.existsSync(path.join(changeRoot, outputPath));
    }
    const globMatch = /^([^*/]+)\/\*\*\/\*(\.[^/]+)$/.exec(outputPath);
    if (globMatch === null) return false;
    const [, dir, extension] = globMatch;
    return hasFileWithExtension(path.join(changeRoot, dir), extension);
}

/** 从 tasks.md 解析进度；缺失返回 null，解析错误仍返回可见的 checkbox 统计。 */
export function parseTaskProgress(changeRoot: string): TaskProgress | null {
    const tasksFile = path.join(changeRoot, SPEC_DRIVEN_SCHEMA.apply.tracks);
    if (!fs.existsSync(tasksFile)) {
        // 历史 JSON-only 变更只读兼容，避免 status 直接失去进度信息。
        const legacy = readLegacyTasks(changeRoot);
        if (!legacy.exists || legacy.sourcePath === undefined) return null;
        try {
            const parsed = JSON.parse(fs.readFileSync(legacy.sourcePath, 'utf8')) as { tasks?: Array<{ status?: string }> };
            const items = Array.isArray(parsed.tasks) ? parsed.tasks : [];
            const total = items.length;
            const complete = items.filter((item) => item.status === 'done').length;
            return { total, complete, remaining: total - complete };
        } catch {
            return null;
        }
    }
    const parsed = parseTasks(tasksFile);
    const total = parsed.tasks.length;
    const complete = parsed.tasks.filter((task) => task.checked).length;
    return { total, complete, remaining: total - complete };
}

export function getChangeStatus(projectRoot: string, changeName: string, warnings: string[] = []): ChangeStatusResult {
    const changeRoot = path.join(projectRoot, 'openspec', 'changes', changeName);
    const completed = detectCompleted(changeRoot);
    const metadataPath = path.join(changeRoot, '.openspec.yaml');
    if (fs.existsSync(metadataPath)) {
        const metadata = fs.readFileSync(metadataPath, 'utf8');
        const schemaMatch = /^schema:\s*(.+)$/m.exec(metadata);
        if (schemaMatch !== null && schemaMatch[1].trim() !== SPEC_DRIVEN_SCHEMA.schemaName) {
            warnings.push(
                `变更 ${changeName} 的 schema 为 "${schemaMatch[1].trim()}"，iagent 仅支持内置 spec-driven，已按内置依赖图处理`,
            );
        }
    }

    const artifacts: ArtifactStatus[] = SPEC_DRIVEN_SCHEMA.artifacts.map((artifact) => {
        const inspection = inspectArtifact(changeRoot, artifact.id);
        const missingDeps = requiredDeps(artifact).filter((dep) => !completed.has(dep));
        if (inspection.exists && !inspection.valid) {
            return {
                id: artifact.id,
                outputPath: artifact.outputPath,
                status: 'invalid' as const,
                requires: artifact.requires,
                diagnostics: inspection.diagnostics,
            };
        }
        if (completed.has(artifact.id)) {
            return { id: artifact.id, outputPath: artifact.outputPath, status: 'done' as const, requires: artifact.requires };
        }
        // 可选制品缺失：既不是「现在该生成」（ready），也不是「被依赖阻塞」（blocked）
        if (isOptionalArtifact(artifact.id)) {
            return {
                id: artifact.id,
                outputPath: artifact.outputPath,
                status: 'optional' as const,
                requires: artifact.requires,
                missingDeps: missingDeps.length > 0 ? missingDeps : undefined,
            };
        }
        if (missingDeps.length === 0) {
            return { id: artifact.id, outputPath: artifact.outputPath, status: 'ready' as const, requires: artifact.requires };
        }
        return {
            id: artifact.id,
            outputPath: artifact.outputPath,
            status: 'blocked' as const,
            requires: artifact.requires,
            missingDeps,
        };
    });

    for (const artifact of artifacts) {
        for (const diagnostic of artifact.diagnostics ?? []) {
            warnings.push(`${diagnostic.filePath}:${diagnostic.line} ${diagnostic.message}`);
        }
    }
    for (const artifact of SPEC_DRIVEN_SCHEMA.artifacts) {
        const inspection = inspectArtifact(changeRoot, artifact.id);
        for (const diagnostic of inspection.diagnostics) {
            if (diagnostic.severity === 'warning') {
                warnings.push(`${diagnostic.filePath}:${diagnostic.line} ${diagnostic.message}`);
            }
        }
    }

    return {
        changeName,
        changeRoot,
        schemaName: SPEC_DRIVEN_SCHEMA.schemaName,
        artifacts,
        applyRequires: SPEC_DRIVEN_SCHEMA.apply.requires,
        progress: parseTaskProgress(changeRoot),
        isPlanningComplete: requiredClosure(SPEC_DRIVEN_SCHEMA.apply.requires).every((id) => completed.has(id)),
        planningHome: path.join(projectRoot, 'openspec'),
        artifactPaths: getArtifactPaths(changeRoot),
        warnings,
    };
}

function inspectArtifact(changeRoot: string, artifactId: string): ArtifactInspection {
    switch (artifactId) {
        case 'proposal': {
            const filePath = path.join(changeRoot, 'proposal.md');
            if (fs.existsSync(filePath)) {
                const parsed = parseProposal(filePath);
                return { exists: true, valid: hasNoErrors(parsed.diagnostics), diagnostics: parsed.diagnostics };
            }
            return legacySectionInspection(changeRoot, 'proposal');
        }
        case 'design': {
            const filePath = path.join(changeRoot, 'design.md');
            if (fs.existsSync(filePath)) {
                const parsed = parseDesign(filePath);
                return { exists: true, valid: hasNoErrors(parsed.diagnostics), diagnostics: parsed.diagnostics };
            }
            return legacySectionInspection(changeRoot, 'design');
        }
        case 'specs': {
            const files = findMarkdownFiles(path.join(changeRoot, 'specs'));
            if (files.length > 0) {
                const parsed = files.map((filePath) => parseSpec(filePath));
                const diagnostics = parsed.flatMap((spec) => spec.diagnostics);
                return { exists: true, valid: hasNoErrors(diagnostics), diagnostics };
            }
            return legacySectionInspection(changeRoot, 'specs');
        }
        case 'tasks': {
            const filePath = path.join(changeRoot, 'tasks.md');
            if (fs.existsSync(filePath)) {
                const parsed = parseTasks(filePath);
                return { exists: true, valid: hasNoErrors(parsed.diagnostics), diagnostics: parsed.diagnostics };
            }
            return { exists: fs.existsSync(path.join(changeRoot, 'tasks.json')), valid: fs.existsSync(path.join(changeRoot, 'tasks.json')), diagnostics: [] };
        }
        default:
            return { exists: false, valid: false, diagnostics: [] };
    }
}

function legacySectionInspection(changeRoot: string, section: 'proposal' | 'design' | 'specs'): ArtifactInspection {
    const legacy = readLegacySection(changeRoot, section);
    if (!legacy.exists) {
        return { exists: false, valid: false, diagnostics: [] };
    }
    const filePath = legacy.sourcePath ?? path.join(changeRoot, 'change.json');
    return {
        exists: true,
        valid: true,
        diagnostics: legacy.warning === undefined
            ? []
            : [{ severity: 'warning', code: 'legacy-json-fallback', message: legacy.warning, filePath, line: 1 }],
    };
}

function hasNoErrors(diagnostics: readonly ArtifactDiagnostic[]): boolean {
    return diagnostics.every((diagnostic) => diagnostic.severity !== 'error');
}

function hasFileWithExtension(dir: string, extension: string): boolean {
    if (!fs.existsSync(dir)) return false;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory() && hasFileWithExtension(entryPath, extension)) return true;
        if (entry.isFile() && entry.name.endsWith(extension)) return true;
    }
    return false;
}
