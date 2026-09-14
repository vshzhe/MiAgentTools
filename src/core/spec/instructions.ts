/**
 * artifact 指令分发：返回指定 artifact 的模板内容、输出路径与依赖信息。
 *
 * 对应 venus spec instructions <artifact-id> --change <name> --json。
 */

import * as fs from 'fs';
import * as path from 'path';
import { SPEC_DRIVEN_SCHEMA, getArtifactIds, isValidArtifactId } from './schema.js';
import { detectCompleted } from './status.js';
import { DESIGN_TEMPLATE, PROPOSAL_TEMPLATE, SPECS_TEMPLATE, TASKS_TEMPLATE } from './templates/index.js';

/** artifact 的依赖项信息 */
export interface ArtifactDependency {
    id: string;
    /** 该依赖是否已完成（文件存在性判定） */
    done: boolean;
    /** 输出路径（相对变更目录） */
    path: string;
    description: string;
}

/** instructions 输出（venus spec instructions --json 的数据源） */
export interface ArtifactInstructions {
    changeName: string;
    artifactId: string;
    schemaName: string;
    changeDir: string;
    outputPath: string;
    resolvedOutputPath: string;
    description: string;
    /** 生成该 artifact 的指导说明 */
    instruction: string;
    /** artifact 模板全文 */
    template: string;
    dependencies: ArtifactDependency[];
    /** 依赖本 artifact 的后续 artifact id 列表 */
    unlocks: string[];
}

/** artifact id → 内置模板映射 */
const TEMPLATES: Record<string, string> = {
    proposal: PROPOSAL_TEMPLATE,
    specs: SPECS_TEMPLATE,
    design: DESIGN_TEMPLATE,
    tasks: TASKS_TEMPLATE,
};

/**
 * 获取指定 artifact 的生成指令信息。
 *
 * @param projectRoot - 目标项目根目录
 * @param changeName - 变更名
 * @param artifactId - artifact 标识（proposal/specs/design/tasks）
 * @throws artifactId 非法时抛出（错误信息列出全部合法 id）
 * @throws 变更目录不存在时抛出
 */
export function getArtifactInstructions(
    projectRoot: string,
    changeName: string,
    artifactId: string
): ArtifactInstructions {
    if (!isValidArtifactId(artifactId)) {
        throw new Error(`无效的 artifact id："${artifactId}"。合法 id：${getArtifactIds().join(' / ')}`);
    }
    const changeDir = path.join(projectRoot, 'openspec', 'changes', changeName);
    if (!isDirectory(changeDir)) {
        throw new Error(`变更不存在：${changeName}（期望目录 ${changeDir}）。可先运行 venus spec new "${changeName}" 创建`);
    }

    const artifact = SPEC_DRIVEN_SCHEMA.artifacts.find((a) => a.id === artifactId);
    if (artifact === undefined) {
        throw new Error(`artifact 定义缺失：${artifactId}`);
    }
    const completed = detectCompleted(changeDir);
    const dependencies: ArtifactDependency[] = artifact.requires.map((depId) => {
        const dep = SPEC_DRIVEN_SCHEMA.artifacts.find((a) => a.id === depId);
        return {
            id: depId,
            done: completed.has(depId),
            path: dep?.outputPath ?? depId,
            description: dep?.description ?? '',
        };
    });
    const unlocks = SPEC_DRIVEN_SCHEMA.artifacts.filter((a) => a.requires.includes(artifactId)).map((a) => a.id);

    return {
        changeName,
        artifactId,
        schemaName: SPEC_DRIVEN_SCHEMA.schemaName,
        changeDir,
        outputPath: artifact.outputPath,
        resolvedOutputPath: path.join(changeDir, artifact.outputPath),
        description: artifact.description,
        instruction: artifact.instruction,
        template: TEMPLATES[artifactId] ?? '',
        dependencies,
        unlocks,
    };
}

/** 判断路径是否为存在的目录 */
function isDirectory(dirPath: string): boolean {
    try {
        return fs.statSync(dirPath).isDirectory();
    } catch {
        return false;
    }
}
