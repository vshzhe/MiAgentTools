/**
 * 变更骨架创建：iagent spec new "<name>"。
 *
 * 创建 openspec/changes/<name>/ 目录并写入 .openspec.yaml 兼容元数据
 * （schema: spec-driven / created: YYYY-MM-DD / 可选 goal），与 openspec CLI 互认（design D7）。
 */

import * as fs from 'fs';
import * as path from 'path';
import { SPEC_DRIVEN_SCHEMA } from './schema.js';

/** 创建结果 */
export interface NewChangeResult {
    changeName: string;
    /** 变更目录绝对路径 */
    changeDir: string;
    /** 元数据文件绝对路径 */
    metadataPath: string;
}

/** 变更名合法字符（kebab-case：小写字母、数字、连字符） */
const CHANGE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * 创建变更骨架。
 *
 * @param projectRoot - 目标项目根目录
 * @param changeName - 变更名（kebab-case）
 * @param options - 可选 goal（一句话变更目标）
 * @throws 变更名格式非法或同名变更已存在时抛出
 */
export function createChange(projectRoot: string, changeName: string, options: { goal?: string } = {}): NewChangeResult {
    if (!CHANGE_NAME_PATTERN.test(changeName)) {
        throw new Error(`变更名必须为 kebab-case（小写字母/数字/连字符）：${changeName}`);
    }
    const changeDir = path.join(projectRoot, 'openspec', 'changes', changeName);
    if (fs.existsSync(changeDir)) {
        throw new Error(`变更已存在，拒绝覆盖：${changeDir}（如需重建请先删除或归档）`);
    }

    // openspec/ 骨架不存在时自动创建（含 archive/ 子目录），再创建变更目录
    const archiveDir = path.join(projectRoot, 'openspec', 'changes', 'archive');
    fs.mkdirSync(archiveDir, { recursive: true });
    fs.mkdirSync(changeDir, { recursive: true });

    // 写入 .openspec.yaml 兼容元数据（简单标量字段，手写序列化，不引入 yaml 依赖）
    const metadataPath = path.join(changeDir, '.openspec.yaml');
    fs.writeFileSync(metadataPath, renderMetadata(options.goal), 'utf8');

    return { changeName, changeDir, metadataPath };
}

/** 渲染 .openspec.yaml 内容（goal 含特殊字符时以双引号包裹并转义） */
function renderMetadata(goal?: string): string {
    const lines = [`schema: ${SPEC_DRIVEN_SCHEMA.schemaName}`, `created: ${new Date().toISOString().slice(0, 10)}`];
    if (goal !== undefined && goal.length > 0) {
        lines.push(`goal: "${goal.replaceAll('"', '\\"')}"`);
    }
    return `${lines.join('\n')}\n`;
}
