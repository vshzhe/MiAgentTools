/**
 * iagent spec 子命令组：规格驱动工作流的变更生命周期管理。
 *
 * 命令（自研替代 openspec CLI，零外部依赖，ADR-0001）：
 *   iagent spec new "<name>"                          创建变更骨架（.openspec.yaml 兼容元数据）
 *   iagent spec status --change <name> [--json] [--all]  artifact 状态校验（含 skip_specs 语义）
 *   iagent spec instructions <artifact-id> --change <name> [--json]  模板分发（artifact-id=apply 返回 apply 阶段上下文）
 *   iagent spec archive <name> [--yes] [--json]       归档移动（spec 合并由 spec-archive 技能执行）
 *
 * skip_specs 语义（对齐 OpenSpec v1.1.20）：
 *   .openspec.yaml 声明 skip_specs: true 时，specs artifact 视为 skipped（满足态）；
 *   若 specs/ 下同时存在 delta spec 文件，则视为 conflict（冲突态），需用户二选一解决。
 */

import { Command } from 'commander';
import { createChange } from '../core/spec/new-change.js';
import { getChangeStatus, detectCompleted, hasDeltaSpecFiles, parseTaskProgress } from '../core/spec/status.js';
import { getArtifactInstructions } from '../core/spec/instructions.js';
import { executeArchive, previewArchive } from '../core/spec/archive.js';
import { listSubdirectories } from '../utils/file-system.js';
import { SPEC_DRIVEN_SCHEMA } from '../core/spec/schema.js';
import * as path from 'path';
import * as fs from 'fs';
import {
    initTasksJson,
    initChangeJson,
} from '../core/spec/sidecar-writer.js';
import { parseTasks } from '../core/spec/parser/task-parser.js';
import { findMarkdownFiles } from '../core/spec/parser/markdown-parser.js';
import { parseProposal } from '../core/spec/parser/proposal-parser.js';
import { parseDesign } from '../core/spec/parser/design-parser.js';
import { parseSpec } from '../core/spec/parser/spec-parser.js';
import { validateParsedChange } from '../core/spec/validation/artifact-validator.js';
import { migrateChangeFromJson } from '../core/spec/migration.js';
import type { ParsedChange } from '../core/spec/model/artifact-model.js';

/** 变更状态结果类型（从 getChangeStatus 派生） */
type ChangeStatusResult = ReturnType<typeof getChangeStatus>;

/** 单个 artifact 状态类型 */
type ArtifactStatus = ChangeStatusResult['artifacts'][number];

/** 扩展 artifact 状态：在 done/ready/blocked 基础上增加 skipped/conflict（skip_specs 语义） */
type ExtendedArtifactStatus = Omit<ArtifactStatus, 'status'> & {
    status: 'done' | 'ready' | 'blocked' | 'invalid' | 'skipped' | 'conflict';
};

/** 扩展变更状态结果（artifacts 使用扩展状态） */
type ExtendedChangeStatusResult = Omit<ChangeStatusResult, 'artifacts'> & {
    artifacts: ExtendedArtifactStatus[];
};

/** 扩展 artifact instructions：增加 skipped/conflict 标记（skip_specs 语义） */
export type ExtendedArtifactInstructions = ReturnType<typeof getArtifactInstructions> & {
    skipped?: boolean;
    conflict?: boolean;
    warning?: string;
};

/** apply 阶段任务列表项 */
export interface TaskListItem {
    /** 原始行文本 */
    text: string;
    /** 是否已勾选（[x]=true，[ ]=false） */
    checked: boolean;
    /** 缩进空格数（层级信息） */
    indent: number;
}

/** apply 阶段动态指导 */
export interface ApplyInstruction {
    state: 'blocked' | 'ready' | 'all_done';
    text: string;
    /** 仅 blocked 时存在：未满足的依赖列表 */
    missingDeps?: string[];
}

/** iagent spec instructions apply --json 的返回结构 */
export interface ApplyInstructionsResult {
    changeName: string;
    changeRoot: string;
    contextFiles: {
        proposal: string;
        specs: string;
        design: string;
        tasks: string;
    };
    progress: { total: number; complete: number; remaining: number };
    taskList: TaskListItem[];
    instruction: ApplyInstruction;
}

/** iagent spec render 支持的渲染类型（仅 tasks.md；proposal/specs/design 为 JSON-only，无 MD 产物） */
type RenderType = 'tasks';

/** render 合法类型清单（类型守卫与报错信息共用） */
const RENDER_TYPES: readonly RenderType[] = ['tasks'];

/** sidecar init 合法类型清单 */
const SIDECAR_INIT_TYPES: readonly string[] = ['change', 'tasks', 'all'];

/** 构造 spec 子命令组（挂到主 program 上） */
export function buildSpecCommand(): Command {
    const spec = new Command('spec');

    spec.description('规格驱动工作流：变更骨架创建 / 状态校验 / 模板分发 / 归档');

    spec.command('new <name>')
        .description('创建变更骨架（openspec/changes/<name>/ + .openspec.yaml 兼容元数据）')
        .option('--goal <goal>', '一句话变更目标（写入 .openspec.yaml）')
        .option('--json', '以 JSON 输出（供程序处理）')
        .action((name: string, options: { goal?: string; json?: boolean }) => {
            const result = createChange(process.cwd(), name, { goal: options.goal });
            if (options.json) {
                console.log(JSON.stringify({ changeName: result.changeName, changeDir: result.changeDir, metadataPath: result.metadataPath }, null, 2));
                return;
            }
            console.log(`已创建变更：${result.changeName}`);
            console.log(`  目录：${path.relative(process.cwd(), result.changeDir)}`);
            console.log(`  元数据：${path.relative(process.cwd(), result.metadataPath)}（schema: spec-driven）`);
            console.log('  下一步：iagent spec instructions proposal --change <name> 生成提案');
        });

    spec.command('status')
        .description('校验变更 artifact 状态（done/ready/blocked/skipped/conflict）与任务进度')
        .option('--change <name>', '目标变更名')
        .option('--all', '列出全部活跃变更的状态')
        .option('--json', '以 JSON 输出（供程序处理）')
        .action((options: { change?: string; all?: boolean; json?: boolean }) => {
            const { output, exitCode } = runSpecStatus(process.cwd(), options);
            console.log(output);
            if (exitCode !== 0) {
                process.exitCode = exitCode;
            }
        });

    spec.command('migrate')
        .description('显式将历史 JSON 变更迁移为 OpenSpec Markdown')
        .requiredOption('--change <name>', '目标变更名')
        .option('--from-json', '从 change.json/tasks.json 或旧 JSON sidecar 迁移')
        .option('--delete-legacy', '迁移校验成功后删除 JSON 源文件')
        .option('--json', '以 JSON 输出结果')
        .action((options: { change: string; fromJson?: boolean; deleteLegacy?: boolean; json?: boolean }) => {
            if (!options.fromJson) {
                const message = '迁移需要显式指定 --from-json；默认不会修改历史 JSON。';
                console.error(message);
                process.exitCode = 1;
                return;
            }
            try {
                const result = migrateChangeFromJson(process.cwd(), options.change, { deleteLegacy: options.deleteLegacy });
                if (options.json) {
                    console.log(JSON.stringify(result, null, 2));
                } else {
                    console.log(`已迁移：${result.changeName}`);
                    for (const filePath of result.created) console.log(`  创建：${path.relative(process.cwd(), filePath)}`);
                    if (result.deletedLegacy.length > 0) {
                        for (const filePath of result.deletedLegacy) console.log(`  删除旧 JSON：${path.relative(process.cwd(), filePath)}`);
                    } else {
                        console.log('  历史 JSON：保留');
                    }
                }
            } catch (error: unknown) {
                console.error(`迁移失败：${(error as Error).message}`);
                process.exitCode = 1;
            }
        });

    spec.command('validate')
        .description('校验 OpenSpec Markdown 制品、任务依赖与规格追溯')
        .requiredOption('--change <name>', '目标变更名')
        .option('--json', '以 JSON 输出（供程序处理）')
        .action((options: { change: string; json?: boolean }) => {
            const result = runSpecValidate(process.cwd(), options.change);
            console.log(options.json ? JSON.stringify(result, null, 2) : formatValidationResult(result));
            if (!result.valid) {
                process.exitCode = 1;
            }
        });

    spec.command('instructions <artifact-id>')
        .description('获取 artifact 生成指令与模板（proposal / specs / design / tasks），或 apply 阶段上下文（artifact-id=apply）')
        .requiredOption('--change <name>', '目标变更名')
        .option('--json', '以 JSON 输出（供程序处理）')
        .action((artifactId: string, options: { change: string; json?: boolean }) => {
            // apply 分支：返回 apply 阶段上下文（contextFiles / progress / taskList / instruction）
            if (artifactId === 'apply') {
                const result = getApplyInstructions(process.cwd(), options.change);
                console.log(JSON.stringify(result, null, 2));
                return;
            }
            const info = getInstructionsResult(process.cwd(), options.change, artifactId);
            if (options.json) {
                console.log(JSON.stringify(info, null, 2));
                return;
            }
            // 文本输出
            console.log(`artifact：${info.artifactId}（${info.description}）`);
            if (info.conflict) {
                console.log(`⚠ 冲突：${info.warning}`);
                console.log('请先解决冲突（删除 specs/ 下文件 或 移除 skip_specs 声明）后再获取指令。');
                return;
            }
            if (info.skipped) {
                console.log('输出路径：（已声明 skip_specs，跳过创建）');
                console.log(`依赖：${info.dependencies.map((d) => `${d.id}(${d.done ? 'done' : 'pending'})`).join('、') || '无'}`);
                console.log(`解锁：${info.unlocks.join('、') || '无'}`);
                console.log('\n生成说明：');
                console.log(info.instruction);
                return;
            }
            console.log(`输出路径：${info.outputPath}`);
            console.log(`依赖：${info.dependencies.map((d) => `${d.id}(${d.done ? 'done' : 'pending'})`).join('、') || '无'}`);
            console.log(`解锁：${info.unlocks.join('、') || '无'}`);
            console.log('\n生成说明：');
            console.log(info.instruction);
            console.log('\n模板：');
            console.log(info.template);
        });

    spec.command('archive <name>')
        .description('归档变更（移动至 openspec/changes/archive/<日期>-<名称>/；spec 合并由 spec-archive 技能执行）')
        .option('--yes', '跳过确认直接归档（未完成项仍会警告）')
        .option('--json', '以 JSON 输出（供程序处理）')
        .action((name: string, options: { yes?: boolean; json?: boolean }) => {
            if (!options.yes) {
                // 无 --yes：预览后以非零码退出，不执行移动
                const preview = previewArchive(process.cwd(), name);
                if (options.json) {
                    console.log(JSON.stringify({ ...preview, confirmed: false }, null, 2));
                } else {
                    console.log(`将归档变更：${name}`);
                    console.log(`  目标：${path.relative(process.cwd(), preview.targetPath)}`);
                    for (const warning of preview.warnings) {
                        console.log(`  ⚠ ${warning}`);
                    }
                    console.log('确认执行请加 --yes。');
                }
                process.exitCode = 1;
                return;
            }
            const result = executeArchive(process.cwd(), name);
            if (options.json) {
                console.log(JSON.stringify({ ...result, archived: true }, null, 2));
                return;
            }
            console.log(`已归档：${result.changeName}`);
            console.log(`  位置：${path.relative(process.cwd(), result.archivedPath)}`);
        });

    spec.command('render <type>')
        .description('兼容提示：tasks.md 已是任务真源，render 不再生成或覆盖 tasks.md')
        .requiredOption('--change <name>', '变更名称')
        .action((type: string, options: { change: string }) => {
            const projectRoot = process.cwd();
            const changeDir = path.join(projectRoot, 'openspec', 'changes', options.change);

            // 非法 type：列出合法值并以非零码退出（仅 tasks；proposal/specs/design 已移除）
            if (!isRenderType(type)) {
                console.error(`非法 type：${type}（合法值：${RENDER_TYPES.join(' / ')}）`);
                process.exitCode = 1;
                return;
            }

            // 检查变更目录存在性
            if (!fs.existsSync(changeDir)) {
                console.error(`变更目录不存在: ${changeDir}`);
                process.exitCode = 1;
                return;
            }

            // 兼容提示：Markdown-first 后 tasks.md 是唯一真源，render 不再写入任何文件。
            const tasksMdPath = path.join(changeDir, 'tasks.md');
            if (fs.existsSync(tasksMdPath)) {
                console.log('tasks.md 已是任务真源，无需渲染；请直接编辑 tasks.md 并用 `iagent spec validate --change <name>` 校验。');
                return;
            }
            console.log('未找到 tasks.md。若为历史 JSON-only 变更，请先运行 `iagent spec migrate --from-json --change <name>`；render 不再从 tasks.json 生成 tasks.md。');
        });

    spec.command('sidecar')
        .description('change.json 主产物管理（init：创建空骨架）')
        .command('init')
        .description('创建空的 JSON 骨架文件（change 仅 change.json；tasks 仅 tasks.json；all 两者）')
        .requiredOption('--change <name>', '变更名称')
        .option('--type <type>', '骨架类型（change/tasks/all，默认 all）', 'all')
        .action((options: { change: string; type: string }) => {
            const projectRoot = process.cwd();
            const changeDir = path.join(projectRoot, 'openspec', 'changes', options.change);

            // 非法 type：列出合法值并以非零码退出
            if (!SIDECAR_INIT_TYPES.includes(options.type)) {
                console.error(`非法 sidecar 类型：${options.type}（合法值：${SIDECAR_INIT_TYPES.join(' / ')}）`);
                process.exitCode = 1;
                return;
            }

            if (!fs.existsSync(changeDir)) {
                fs.mkdirSync(changeDir, { recursive: true });
            }

            try {
                const created: string[] = [];
                if (options.type === 'change' || options.type === 'all') {
                    initChangeJson(changeDir, options.change);
                    created.push('change.json');
                }
                if (options.type === 'tasks' || options.type === 'all') {
                    initTasksJson(changeDir);
                    created.push('tasks.json');
                }
                console.log(`Sidecar 骨架已创建: ${created.join(', ')}`);
            } catch (error: unknown) {
                console.error(`创建失败: ${(error as Error).message}`);
                process.exitCode = 1;
            }
        });

    return spec;
}

/** 校验渲染类型合法性（类型守卫，供 render 命令收窄 type） */
function isRenderType(value: string): value is RenderType {
    return (RENDER_TYPES as readonly string[]).includes(value);
}

/**
 * 执行 status 逻辑（单变更或全部活跃变更）。
 * 返回文本输出与退出码（变更不存在时非零）。
 */
export function runSpecStatus(
    projectRoot: string,
    options: { change?: string; all?: boolean; json?: boolean }
): { output: string; exitCode: number } {
    const warnings: string[] = [];

    if (options.all || options.change === undefined) {
        // 列出全部活跃变更（排除 archive/）
        const changes = listActiveChanges(projectRoot);
        if (changes.length === 0) {
            return { output: options.json ? JSON.stringify({ changes: [], root: projectRoot }) : '无活跃变更。', exitCode: 0 };
        }
        const statuses = changes.map((name) => {
            const raw = getChangeStatus(projectRoot, name, warnings);
            return adjustStatusForSkipSpecs(raw, warnings);
        });
        if (options.json) {
            return { output: JSON.stringify({ changes: statuses, root: projectRoot, warnings }, null, 2), exitCode: 0 };
        }
        const lines = statuses.map(renderStatusText);
        if (warnings.length > 0) {
            lines.push(...warnings.map((w) => `⚠ ${w}`));
        }
        return { output: lines.join('\n'), exitCode: 0 };
    }

    const changeRoot = path.join(projectRoot, 'openspec', 'changes', options.change);
    if (!fs.existsSync(changeRoot)) {
        const message = `变更不存在：${options.change}（期望目录 ${changeRoot}）`;
        return { output: options.json ? JSON.stringify({ error: message }) : message, exitCode: 1 };
    }
    const rawStatus = getChangeStatus(projectRoot, options.change, warnings);
    const status = adjustStatusForSkipSpecs(rawStatus, warnings);
    if (options.json) {
        return { output: JSON.stringify({ ...status, warnings }, null, 2), exitCode: 0 };
    }
    const lines = [renderStatusText(status)];
    lines.push(...warnings.map((w) => `⚠ ${w}`));
    return { output: lines.join('\n'), exitCode: 0 };
}

interface SpecValidationOutput {
    changeName: string;
    changeRoot: string;
    valid: boolean;
    diagnostics: Array<{
        severity: string;
        code?: string;
        message: string;
        filePath: string;
        line: number;
    }>;
}

/** 从 Markdown 构造统一运行时模型并校验。 */
export function runSpecValidate(projectRoot: string, changeName: string): SpecValidationOutput {
    const changeRoot = path.join(projectRoot, 'openspec', 'changes', changeName);
    if (!fs.existsSync(changeRoot)) {
        return {
            changeName,
            changeRoot,
            valid: false,
            diagnostics: [{ severity: 'error', code: 'missing-change', message: `变更不存在：${changeName}`, filePath: changeRoot, line: 1 }],
        };
    }

    const proposalPath = path.join(changeRoot, 'proposal.md');
    const designPath = path.join(changeRoot, 'design.md');
    const specs = findMarkdownFiles(path.join(changeRoot, 'specs')).map((filePath) => parseSpec(filePath));
    const tasksPath = path.join(changeRoot, 'tasks.md');
    const proposal = fs.existsSync(proposalPath) ? parseProposal(proposalPath) : undefined;
    const design = fs.existsSync(designPath) ? parseDesign(designPath) : undefined;
    const tasks = fs.existsSync(tasksPath) ? parseTasks(tasksPath) : undefined;
    const model: ParsedChange = {
        changeName,
        changeRoot,
        proposal,
        design,
        specs,
        tasks,
        diagnostics: [],
        warnings: [],
    };
    const result = validateParsedChange(model);
    const diagnostics = [...result.diagnostics];
    if (proposal === undefined) {
        diagnostics.push({ severity: 'error', code: 'missing-proposal', message: '缺少 proposal.md', filePath: proposalPath, line: 1 });
    }
    if (design === undefined && !readSkipSpecs(changeRoot)) {
        diagnostics.push({ severity: 'error', code: 'missing-design', message: '缺少 design.md', filePath: designPath, line: 1 });
    }
    if (tasks === undefined) {
        diagnostics.push({ severity: 'error', code: 'missing-tasks', message: '缺少 tasks.md', filePath: tasksPath, line: 1 });
    }
    return { changeName, changeRoot, valid: diagnostics.every((item) => item.severity !== 'error'), diagnostics };
}

function formatValidationResult(result: SpecValidationOutput): string {
    if (result.valid && result.diagnostics.length === 0) {
        return `Markdown 制品校验通过：${result.changeName}`;
    }
    const lines = [`Markdown 制品校验${result.valid ? '通过（含警告）' : '失败'}：${result.changeName}`];
    for (const diagnostic of result.diagnostics) {
        lines.push(`  [${diagnostic.severity}] ${diagnostic.filePath}:${diagnostic.line} ${diagnostic.message}`);
    }
    return lines.join('\\n');
}

/** 列出活跃变更名（openspec/changes/ 下排除 archive/） */
function listActiveChanges(projectRoot: string): string[] {
    const changesDir = path.join(projectRoot, 'openspec', 'changes');
    return listSubdirectories(changesDir).filter((name) => name !== 'archive');
}

/** 渲染单变更状态文本 */
function renderStatusText(status: ExtendedChangeStatusResult): string {
    const lines = [`变更：${status.changeName}（schema: ${status.schemaName}）`];
    for (const artifact of status.artifacts) {
        const suffix =
            artifact.status === 'blocked' ? `（缺失依赖：${artifact.missingDeps?.join('、')}）` :
            artifact.status === 'conflict' ? '（冲突：skip_specs 与 specs 文件共存）' :
            artifact.status === 'skipped' ? '（已声明 skip_specs，跳过）' :
            '';
        lines.push(`  ${artifact.id.padEnd(10)} ${artifact.status}${suffix}`);
    }
    if (status.progress !== null) {
        lines.push(
            `  任务进度：${status.progress.complete}/${status.progress.total} 完成（剩余 ${status.progress.remaining}）`
        );
    }
    lines.push(`  规划完成：${status.isPlanningComplete ? '是' : '否'}`);
    return lines.join('\n');
}

// ===== skip_specs 语义与 apply 分支实现 =====

/**
 * 读取 .openspec.yaml 的 skip_specs 声明。
 *
 * @param changeRoot - 变更目录绝对路径
 * @returns skip_specs: true 时返回 true，否则 false（含未声明）
 */
function readSkipSpecs(changeRoot: string): boolean {
    const metadataPath = path.join(changeRoot, '.openspec.yaml');
    if (!fs.existsSync(metadataPath)) {
        return false;
    }
    const content = fs.readFileSync(metadataPath, 'utf8');
    const match = /^skip_specs:\s*(true|false)\s*$/m.exec(content);
    return match !== null && match[1] === 'true';
}

/**
 * 根据 skip_specs 声明调整变更状态：
 * - 声明且 specs 文件不存在 → specs 状态为 skipped（满足态），下游 missingDeps 不含 specs
 * - 声明且 specs 文件存在   → specs 状态为 conflict（冲突态），下游 missingDeps 含 specs
 * - 未声明                    → 原样返回
 *
 * @param status - getChangeStatus 的原始结果
 * @param warnings - 容错/冲突警告收集
 */
function adjustStatusForSkipSpecs(status: ChangeStatusResult, warnings: string[]): ExtendedChangeStatusResult {
    const skipSpecs = readSkipSpecs(status.changeRoot);
    if (!skipSpecs) {
        return status;
    }

    const completed = detectCompleted(status.changeRoot);
    // 冲突信号独立于完成判定：skip_specs 与遗留 specs/**/*.md 共存即冲突
    const specsExist = hasDeltaSpecFiles(status.changeRoot);
    const conflict = specsExist;
    const skipped = !specsExist;

    // 满足集合：completed 为基础；skipped 时加入 specs（视为满足）；conflict 时移除 specs（视为未满足）
    const satisfied = new Set(completed);
    if (skipped) {
        satisfied.add('specs');
    }
    if (conflict) {
        satisfied.delete('specs');
    }

    const artifacts: ExtendedArtifactStatus[] = status.artifacts.map((artifact) => {
        if (artifact.id === 'specs') {
            if (conflict) {
                warnings.push(
                    `变更 ${status.changeName} 冲突：声明 skip_specs: true，但 specs/ 目录下仍存在 delta spec 文件。请二选一：删除 specs/ 下文件，或移除 skip_specs 声明。`
                );
                return { ...artifact, status: 'conflict' as const, missingDeps: [] };
            }
            // skipped 态：视为满足，missingDeps 为空数组
            return { ...artifact, status: 'skipped' as const, missingDeps: [] };
        }

        // 下游 artifact（design/tasks）：skipped 视为满足，conflict 视为未满足
        const missingDeps = artifact.requires.filter((dep) => !satisfied.has(dep));
        if (completed.has(artifact.id)) {
            return { ...artifact, status: 'done' as const, missingDeps: undefined };
        }
        if (missingDeps.length === 0) {
            return { ...artifact, status: 'ready' as const, missingDeps: undefined };
        }
        return { ...artifact, status: 'blocked' as const, missingDeps };
    });

    // 调整 isPlanningComplete：skipped specs 视为完成
    const planningComplete = SPEC_DRIVEN_SCHEMA.artifacts.every((a) => {
        if (a.id === 'specs' && skipped) {
            return true;
        }
        return completed.has(a.id);
    });

    return {
        changeName: status.changeName,
        changeRoot: status.changeRoot,
        schemaName: status.schemaName,
        artifacts,
        applyRequires: status.applyRequires,
        progress: status.progress,
        isPlanningComplete: planningComplete,
        warnings: status.warnings,
    };
}

/**
 * 获取 artifact instructions（含 skip_specs 语义后处理）。
 * 非 specs artifact 直接返回原始结果；specs artifact 按 skip_specs 声明调整。
 *
 * @param projectRoot - 目标项目根目录
 * @param changeName - 变更名
 * @param artifactId - artifact 标识（proposal/specs/design/tasks）
 */
export function getInstructionsResult(
    projectRoot: string,
    changeName: string,
    artifactId: string
): ExtendedArtifactInstructions {
    const info = getArtifactInstructions(projectRoot, changeName, artifactId) as ExtendedArtifactInstructions;
    if (artifactId === 'specs') {
        adjustSpecsInstructionsForSkipSpecs(projectRoot, changeName, info);
    }
    return info;
}

/**
 * 调整 specs artifact 的 instructions 输出以反映 skip_specs 语义。
 * - 冲突态：清空 template/outputPath，设置 conflict 标记与警告
 * - 跳过态：template 设为 skip guidance 文本，outputPath 清空
 * - 未声明：原样不动
 */
function adjustSpecsInstructionsForSkipSpecs(
    projectRoot: string,
    changeName: string,
    info: ExtendedArtifactInstructions
): void {
    const changeRoot = path.join(projectRoot, 'openspec', 'changes', changeName);
    const skipSpecs = readSkipSpecs(changeRoot);
    if (!skipSpecs) {
        return;
    }
    const specsExist = hasDeltaSpecFiles(changeRoot);
    if (specsExist) {
        // 冲突态：不返回正常模板也不返回 skip guidance
        info.conflict = true;
        info.warning = 'skip_specs 声明与 specs/ 下 delta spec 文件共存。请二选一：删除 specs/ 下文件，或移除 skip_specs 声明。';
        info.template = '';
        info.outputPath = '';
        info.resolvedOutputPath = '';
        info.instruction = '检测到冲突：skip_specs 声明与 specs 文件共存。请先解决冲突后再获取指令。';
    } else {
        // 跳过态：返回 skip guidance
        info.skipped = true;
        info.template = '已声明 skip_specs，无需创建 delta spec 文件。';
        info.outputPath = '';
        info.resolvedOutputPath = '';
        info.instruction = '已声明 skip_specs，无需创建 delta spec 文件。';
    }
}

/**
 * 获取 apply 阶段上下文（iagent spec instructions apply --change <name> --json 的数据源）。
 *
 * 基于内置 spec-driven 依赖图计算当前状态，返回 contextFiles / progress / taskList / instruction。
 * 不读外部 schema.yaml（ADR-0001），不读项目代码，不触发写操作。
 *
 * @param projectRoot - 目标项目根目录
 * @param changeName - 变更名
 * @throws 变更目录不存在时抛出
 */
export function getApplyInstructions(projectRoot: string, changeName: string): ApplyInstructionsResult {
    const changeRoot = path.join(projectRoot, 'openspec', 'changes', changeName);
    if (!fs.existsSync(changeRoot)) {
        throw new Error(`变更不存在：${changeName}（期望目录 ${changeRoot}）`);
    }

    const completed = detectCompleted(changeRoot);
    const skipSpecs = readSkipSpecs(changeRoot);
    const specsFilesExist = hasDeltaSpecFiles(changeRoot);
    const conflict = skipSpecs && specsFilesExist;
    const skipped = skipSpecs && !specsFilesExist;

    const satisfied = new Set(completed);
    if (skipped) satisfied.add('specs');
    if (conflict) satisfied.delete('specs');

    const contextFiles = {
        proposal: fs.existsSync(path.join(changeRoot, 'proposal.md')) ? path.join(changeRoot, 'proposal.md') : '',
        specs: specsFilesExist ? path.join(changeRoot, 'specs') : '',
        design: fs.existsSync(path.join(changeRoot, 'design.md')) ? path.join(changeRoot, 'design.md') : '',
        tasks: fs.existsSync(path.join(changeRoot, 'tasks.md')) ? path.join(changeRoot, 'tasks.md') : '',
    };

    const rawProgress = parseTaskProgress(changeRoot);
    const progress = rawProgress ?? { total: 0, complete: 0, remaining: 0 };
    const taskList = parseTaskList(changeRoot);
    const missingDeps: string[] = [];
    let state: 'blocked' | 'ready' | 'all_done';
    let text: string;

    if (conflict) {
        state = 'blocked';
        text = '检测到 skip_specs 声明与 specs/ 下文件共存。请先解决冲突（删除 specs/ 下文件 或 移除 skip_specs 声明）后再进入实现。';
        missingDeps.push('specs');
    } else {
        if (!satisfied.has('specs')) missingDeps.push('specs');
        if (!satisfied.has('design')) missingDeps.push('design');
        if (missingDeps.length === 0 && !completed.has('tasks')) missingDeps.push('tasks');

        if (missingDeps.length > 0) {
            state = 'blocked';
            text = `依赖未满足：${missingDeps.join('、')}。请先完成对应 artifact（使用 iagent spec instructions <artifact-id> --change ${changeName}）再进入实现。`;
        } else if (progress.remaining > 0) {
            state = 'ready';
            text = '按 tasks.md 逐项实现，规格行为完整实现后将对应 checkbox 更新为 [x]。';
        } else if (progress.total > 0) {
            state = 'all_done';
            text = `所有任务已完成，准备归档（iagent spec archive ${changeName} --yes）。`;
        } else {
            state = 'ready';
            text = `tasks.md 无可识别任务。请先按 iagent spec instructions tasks --change ${changeName} 补充任务清单。`;
        }
    }

    return {
        changeName,
        changeRoot,
        contextFiles,
        progress,
        taskList,
        instruction: {
            state,
            text,
            missingDeps: missingDeps.length > 0 ? missingDeps : undefined,
        },
    };
}

/** 解析 tasks.md 为 apply 阶段任务列表；历史 tasks.json 仅保留读取兼容。 */
function parseTaskList(changeRoot: string): TaskListItem[] {
    const tasksFile = path.join(changeRoot, 'tasks.md');
    if (fs.existsSync(tasksFile)) {
        const parsed = parseTasks(tasksFile);
        return parsed.tasks.map((task) => ({
            text: task.rawLine,
            checked: task.checked,
            indent: task.indent,
        }));
    }
    const legacyFile = path.join(changeRoot, 'tasks.json');
    if (!fs.existsSync(legacyFile)) return [];
    try {
        const tasks = JSON.parse(fs.readFileSync(legacyFile, 'utf8')) as { tasks?: Array<{ id?: string; label?: string; description?: string; status?: string }> };
        if (!Array.isArray(tasks.tasks)) return [];
        return tasks.tasks.map((task) => ({
            text: `- [${task.status === 'done' ? 'x' : ' '}] [${task.label ?? ''}] ${task.id ?? ''} ${task.description ?? ''}`,
            checked: task.status === 'done',
            indent: 0,
        }));
    } catch {
        return [];
    }
}
