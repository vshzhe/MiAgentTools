/**
 * 变更状态校验：artifact 完成度判定 + tasks 进度统计。
 *
 * 状态语义（对齐 openspec CLI 的 status --json 契约，design D5）：
 *   done    —— artifact 输出文件（或 glob 匹配）存在
 *   ready   —— 自身未完成，但全部依赖已完成
 *   blocked —— 存在未完成的依赖（missingDeps 列出）
 *
 * 注意：done 仅代表输出文件存在，不代表其依赖也存在（与源项目语义一致）。
 */

import * as fs from 'fs';
import * as path from 'path';
import { SPEC_DRIVEN_SCHEMA } from './schema.js';

/** artifact 状态结果 */
export interface ArtifactStatus {
    id: string;
    /** 输出路径（相对变更目录） */
    outputPath: string;
    status: 'done' | 'ready' | 'blocked';
    /** 依赖的 artifact id 列表 */
    requires: string[];
    /** 仅 blocked 时存在：未完成的依赖 id 列表 */
    missingDeps?: string[];
}

/** tasks.md 任务进度统计 */
export interface TaskProgress {
    total: number;
    complete: number;
    remaining: number;
}

/** 变更状态结果（venus spec status --json 的数据源） */
export interface ChangeStatusResult {
    changeName: string;
    /** 变更目录绝对路径 */
    changeRoot: string;
    schemaName: string;
    artifacts: ArtifactStatus[];
    /** apply 门槛：进入实现前必须完成的 artifact id 列表 */
    applyRequires: string[];
    /** 任务进度（tasks.md 不存在时为 null；无勾选项时为全零统计） */
    progress: TaskProgress | null;
    /** 全部规划 artifact 完成 */
    isPlanningComplete: boolean;
    /** 容错警告（如 .openspec.yaml 的 schema 字段非 spec-driven） */
    warnings: string[];
}

/**
 * 检测变更目录下已完成的 artifact。
 *
 * change.json 共享 artifact（proposal / specs / design）按段存在性判定；
 * tasks 按 tasks.json 文件存在性判定。
 *
 * @param changeRoot - 变更目录绝对路径
 * @returns 已完成 artifact id 集合
 */
export function detectCompleted(changeRoot: string): Set<string> {
    const completed = new Set<string>();

    // change.json 共享 artifact：内容级检测（读取一次，避免重复 IO）
    const changeJsonPath = path.join(changeRoot, 'change.json');
    let changeJson: Record<string, unknown> | null = null;
    const resolveChangeJson = (): Record<string, unknown> => {
        if (changeJson !== null) {
            return changeJson;
        }
        if (!fs.existsSync(changeJsonPath)) {
            changeJson = {};
            return changeJson;
        }
        try {
            const parsed: unknown = JSON.parse(fs.readFileSync(changeJsonPath, 'utf8'));
            changeJson = (parsed !== null && typeof parsed === 'object') ? (parsed as Record<string, unknown>) : {};
        } catch {
            changeJson = {};
        }
        return changeJson;
    };

    for (const artifact of SPEC_DRIVEN_SCHEMA.artifacts) {
        if (artifact.outputPath === 'change.json') {
            // proposal / specs / design：按 change.json 对应段非空判定
            const json = resolveChangeJson();
            if (artifact.id === 'specs') {
                // specs: change.json specs 段非空 或 旧格式 specs/**/*.md 存在
                const specs = json.specs;
                const hasJsonSpecs = Array.isArray(specs) && specs.length > 0;
                const hasLegacySpecs = artifactOutputExists(changeRoot, 'specs/**/*.md');
                if (hasJsonSpecs || hasLegacySpecs) {
                    completed.add(artifact.id);
                }
            } else if (json[artifact.id] !== undefined) {
                completed.add(artifact.id);
            }
        } else if (artifact.outputPath === 'tasks.json') {
            // tasks：按 tasks.json 文件存在性判定
            if (fs.existsSync(path.join(changeRoot, 'tasks.json'))) {
                completed.add(artifact.id);
            }
        } else {
            // 兜底：遗留的 outputPath（如旧 schema 定义的 .md 路径），保持文件存在性检查
            if (artifactOutputExists(changeRoot, artifact.outputPath)) {
                completed.add(artifact.id);
            }
        }
    }
    return completed;
}

/**
 * 判断 artifact 输出是否存在。
 * 支持普通相对路径与「目录 + 任意深度 + 指定扩展名」形式的 glob。
 */
export function artifactOutputExists(changeRoot: string, outputPath: string): boolean {
    if (!outputPath.includes('*')) {
        return fs.existsSync(path.join(changeRoot, outputPath));
    }
    // glob 形如 specs/**/*.md：检查目录下（任意深度）是否存在至少一个匹配扩展名的文件
    const globMatch = /^([^*/]+)\/\*\*\/\*(\.[^/]+)$/.exec(outputPath);
    if (globMatch === null) {
        return false;
    }
    const [, dir, extension] = globMatch;
    return hasFileWithExtension(path.join(changeRoot, dir), extension);
}

/** 递归检查目录下是否存在指定扩展名的文件 */
function hasFileWithExtension(dir: string, extension: string): boolean {
    if (!fs.existsSync(dir)) {
        return false;
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (hasFileWithExtension(entryPath, extension)) {
                return true;
            }
        } else if (entry.name.endsWith(extension)) {
            return true;
        }
    }
    return false;
}

/**
 * 解析 tasks.json 的任务进度。
 * 文件不存在时返回 null；解析失败时返回 null。
 *
 * @param changeRoot - 变更目录绝对路径
 */
export function parseTaskProgress(changeRoot: string): TaskProgress | null {
    const tasksFile = path.join(changeRoot, SPEC_DRIVEN_SCHEMA.apply.tracks);
    if (!fs.existsSync(tasksFile)) {
        return null;
    }
    try {
        const tasks = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
        if (!Array.isArray(tasks.tasks)) {
            return null;
        }
        const total = tasks.tasks.length;
        const complete = tasks.tasks.filter((t: { status?: string }) => t.status === 'done').length;
        return { total, complete, remaining: total - complete };
    } catch {
        return null;
    }
}

/**
 * 计算单个变更的完整状态。
 *
 * @param projectRoot - 目标项目根目录（openspec/ 的父目录）
 * @param changeName - 变更名
 * @param warnings - 容错警告收集（schema 字段异常等）
 */
export function getChangeStatus(projectRoot: string, changeName: string, warnings: string[] = []): ChangeStatusResult {
    const changeRoot = path.join(projectRoot, 'openspec', 'changes', changeName);
    const completed = detectCompleted(changeRoot);

    // .openspec.yaml 的 schema 字段容错：非 spec-driven 时 WARN 并按内置依赖图处理
    const metadataPath = path.join(changeRoot, '.openspec.yaml');
    if (fs.existsSync(metadataPath)) {
        const metadata = fs.readFileSync(metadataPath, 'utf8');
        const schemaMatch = /^schema:\s*(.+)$/m.exec(metadata);
        if (schemaMatch !== null && schemaMatch[1].trim() !== SPEC_DRIVEN_SCHEMA.schemaName) {
            warnings.push(
                `变更 ${changeName} 的 schema 为 "${schemaMatch[1].trim()}"，venus 仅支持内置 spec-driven，已按内置依赖图处理`
            );
        }
    }

    const artifacts: ArtifactStatus[] = SPEC_DRIVEN_SCHEMA.artifacts.map((artifact) => {
        const missingDeps = artifact.requires.filter((dep) => !completed.has(dep));
        if (completed.has(artifact.id)) {
            return { id: artifact.id, outputPath: artifact.outputPath, status: 'done', requires: artifact.requires };
        }
        if (missingDeps.length === 0) {
            return { id: artifact.id, outputPath: artifact.outputPath, status: 'ready', requires: artifact.requires };
        }
        return {
            id: artifact.id,
            outputPath: artifact.outputPath,
            status: 'blocked',
            requires: artifact.requires,
            missingDeps,
        };
    });

    return {
        changeName,
        changeRoot,
        schemaName: SPEC_DRIVEN_SCHEMA.schemaName,
        artifacts,
        applyRequires: SPEC_DRIVEN_SCHEMA.apply.requires,
        progress: parseTaskProgress(changeRoot),
        isPlanningComplete: SPEC_DRIVEN_SCHEMA.artifacts.every((a) => completed.has(a.id)),
        warnings,
    };
}
