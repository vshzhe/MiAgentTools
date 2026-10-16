/**
 * 变更归档：iagent spec archive <name> --yes。
 *
 * 职责边界（design D6 / ADR-0001）：CLI 只做确定性操作 —— 状态检查 + 目录移动；
 * delta spec → 主 spec 的智能合并由 spec-archive 技能（AI）执行，CLI 不实现合并逻辑。
 */

import * as fs from 'fs';
import * as path from 'path';
import { SPEC_DRIVEN_SCHEMA } from './schema.js';
import { detectCompleted, parseTaskProgress } from './status.js';

/** 归档预览信息（无 --yes 时的展示内容） */
export interface ArchivePreview {
    changeName: string;
    changeRoot: string;
    /** 归档目标绝对路径 */
    targetPath: string;
    /** 未完成的 artifact id 列表 */
    artifactsIncomplete: string[];
    /** 剩余未勾选任务数（tasks.md 不存在或无任务时为 0） */
    tasksRemaining: number;
    /** 阻断性警告（未完成项提示） */
    warnings: string[];
}

/** 归档执行结果 */
export interface ArchiveResult {
    changeName: string;
    archivedPath: string;
}

/**
 * 预览归档：校验变更存在并收集未完成警告，不执行移动。
 *
 * @throws 变更目录不存在时抛出
 */
export function previewArchive(projectRoot: string, changeName: string): ArchivePreview {
    const changeRoot = path.join(projectRoot, 'openspec', 'changes', changeName);
    if (!fs.existsSync(changeRoot)) {
        throw new Error(`变更不存在：${changeName}（期望目录 ${changeRoot}）`);
    }
    const warnings: string[] = [];
    const completed = detectCompleted(changeRoot);
    const artifactsIncomplete = SPEC_DRIVEN_SCHEMA.artifacts.filter((a) => !completed.has(a.id)).map((a) => a.id);
    if (artifactsIncomplete.length > 0) {
        warnings.push(`存在未完成的规划制品：${artifactsIncomplete.join(' / ')}`);
    }
    const progress = parseTaskProgress(changeRoot);
    const tasksRemaining = progress?.remaining ?? 0;
    if (tasksRemaining > 0) {
        warnings.push(`tasks.md 存在 ${tasksRemaining} 个未勾选任务`);
    }
    return { changeName, changeRoot, targetPath: resolveTargetPath(projectRoot, changeName), artifactsIncomplete, tasksRemaining, warnings };
}

/**
 * 执行归档：将变更目录移动至 openspec/changes/archive/<今日日期>-<name>/。
 * 名称已含日期前缀（YYYY-MM-DD-）则不叠加。
 *
 * @throws 变更不存在或目标已占用时抛出
 */
export function executeArchive(projectRoot: string, changeName: string): ArchiveResult {
    const preview = previewArchive(projectRoot, changeName);
    if (fs.existsSync(preview.targetPath)) {
        throw new Error(`归档目标已存在，拒绝覆盖：${preview.targetPath}`);
    }
    fs.mkdirSync(path.dirname(preview.targetPath), { recursive: true });
    moveDirectory(preview.changeRoot, preview.targetPath);
    return { changeName, archivedPath: preview.targetPath };
}

/** 解析归档目标路径（已含日期前缀则不叠加） */
function resolveTargetPath(projectRoot: string, changeName: string): string {
    const datedName = /^\d{4}-\d{2}-\d{2}-/.test(changeName)
        ? changeName
        : `${new Date().toISOString().slice(0, 10)}-${changeName}`;
    return path.join(projectRoot, 'openspec', 'changes', 'archive', datedName);
}

/** 移动目录：renameSync 失败（Windows EPERM/EXDEV）时回退递归复制后删除 */
function moveDirectory(source: string, target: string): void {
    try {
        fs.renameSync(source, target);
        return;
    } catch {
        // 回退：递归复制 + 删除源目录
    }
    copyDirectoryRecursive(source, target);
    fs.rmSync(source, { recursive: true, force: true });
}

/** 递归复制目录 */
function copyDirectoryRecursive(source: string, target: string): void {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
        const sourcePath = path.join(source, entry.name);
        const targetPath = path.join(target, entry.name);
        if (entry.isDirectory()) {
            copyDirectoryRecursive(sourcePath, targetPath);
        } else {
            fs.copyFileSync(sourcePath, targetPath);
        }
    }
}
