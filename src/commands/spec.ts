/**
 * venus spec 子命令组：规格驱动工作流的变更生命周期管理。
 *
 * 命令（自研替代 openspec CLI，零外部依赖，ADR-0001）：
 *   venus spec new "<name>"                          创建变更骨架（.openspec.yaml 兼容元数据）
 *   venus spec status --change <name> [--json] [--all]  artifact 状态校验（含 skip_specs 语义）
 *   venus spec instructions <artifact-id> --change <name> [--json]  模板分发（artifact-id=apply 返回 apply 阶段上下文）
 *   venus spec archive <name> [--yes] [--json]       归档移动（spec 合并由 spec-archive 技能执行）
 *
 * skip_specs 语义（对齐 OpenSpec v1.1.20）：
 *   .openspec.yaml 声明 skip_specs: true 时，specs artifact 视为 skipped（满足态）；
 *   若 specs/ 下同时存在 delta spec 文件，则视为 conflict（冲突态），需用户二选一解决。
 */

import { Command } from 'commander';
import { createChange } from '../core/spec/new-change.js';
import { getChangeStatus, detectCompleted, parseTaskProgress } from '../core/spec/status.js';
import { getArtifactInstructions } from '../core/spec/instructions.js';
import { executeArchive, previewArchive } from '../core/spec/archive.js';
import { listSubdirectories } from '../utils/file-system.js';
import { SPEC_DRIVEN_SCHEMA } from '../core/spec/schema.js';
import * as path from 'path';
import * as fs from 'fs';
import {
    initDatabase,
    recreateDatabase,
    isSqlite3Available,
    resolveIndexDb,
    insertChange,
    insertCapabilities,
    insertDecisions,
    insertRequirements,
    insertExplorationMemory,
    type ChangeIndexEntry,
    type CapabilityIndexEntry,
    type DecisionIndexEntry,
    type RequirementIndexEntry,
    type ExplorationMemoryEntry,
} from '../core/spec/sqlite-index.js';

/** 变更状态结果类型（从 getChangeStatus 派生） */
type ChangeStatusResult = ReturnType<typeof getChangeStatus>;

/** 单个 artifact 状态类型 */
type ArtifactStatus = ChangeStatusResult['artifacts'][number];

/** 扩展 artifact 状态：在 done/ready/blocked 基础上增加 skipped/conflict（skip_specs 语义） */
type ExtendedArtifactStatus = Omit<ArtifactStatus, 'status'> & {
    status: 'done' | 'ready' | 'blocked' | 'skipped' | 'conflict';
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

/** venus spec instructions apply --json 的返回结构 */
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
            console.log('  下一步：venus spec instructions proposal --change <name> 生成提案');
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

    spec.command('reindex')
        .description('重建 SQLite 跨变更索引（扫描 archive/ 下全部已归档变更，JSON sidecar 优先，缺失时降级解析 MD）')
        .option('--force', '删除现有 index.db 后全量重建')
        .option('--json', '以 JSON 输出结果')
        .action((options: { force?: boolean; json?: boolean }) => {
            const projectRoot = process.cwd();
            const openspecDir = path.join(projectRoot, 'openspec');

            // 检查 openspec 目录存在性
            if (!fs.existsSync(openspecDir)) {
                const msg = 'openspec 目录不存在，无法执行 reindex';
                if (options.json) {
                    console.log(JSON.stringify({ success: false, error: msg }));
                } else {
                    console.log(msg);
                }
                process.exitCode = 1;
                return;
            }

            // 检查 SQLite CLI 可用性
            if (!isSqlite3Available()) {
                const msg = 'sqlite3 CLI 不可用，无法执行 reindex（请安装 sqlite3 后重试）';
                if (options.json) {
                    console.log(JSON.stringify({ success: false, error: msg }));
                } else {
                    console.log(msg);
                }
                process.exitCode = 1;
                return;
            }

            // 初始化或重建数据库
            const dbPath = resolveIndexDb(openspecDir);
            if (options.force && fs.existsSync(dbPath)) {
                const recreateResult = recreateDatabase(openspecDir);
                if (!recreateResult.success) {
                    console.log(JSON.stringify({ success: false, error: recreateResult.error }));
                    process.exitCode = 1;
                    return;
                }
                console.log('已删除旧索引，重建空数据库');
            } else {
                const initResult = initDatabase(openspecDir);
                if (!initResult.success) {
                    console.log(JSON.stringify({ success: false, error: initResult.error }));
                    process.exitCode = 1;
                    return;
                }
            }

            // 扫描 archive 目录
            const archiveDir = path.join(openspecDir, 'changes', 'archive');
            if (!fs.existsSync(archiveDir)) {
                const msg = '无已归档变更可索引（archive 目录不存在）';
                if (options.json) {
                    console.log(JSON.stringify({ success: true, indexed: 0, message: msg }));
                } else {
                    console.log(msg);
                }
                return;
            }

            const entries = fs.readdirSync(archiveDir, { withFileTypes: true })
                .filter((d) => d.isDirectory())
                .map((d) => d.name);

            if (entries.length === 0) {
                const msg = '无已归档变更可索引';
                if (options.json) {
                    console.log(JSON.stringify({ success: true, indexed: 0, message: msg }));
                } else {
                    console.log(msg);
                }
                return;
            }

            let indexed = 0;
            let degraded = 0;
            const errors: string[] = [];

            for (const entry of entries) {
                const changeDir = path.join(archiveDir, entry);
                // 从目录名提取变更名（去除 YYYY-MM-DD- 前缀）
                const changeName = entry.replace(/^\d{4}-\d{2}-\d{2}-/, '');

                try {
                    // 尝试读取 JSON sidecar
                    const venusDir = path.join(changeDir, '.venus');
                    const manifestPath = path.join(venusDir, 'manifest.json');

                    if (fs.existsSync(manifestPath)) {
                        // JSON sidecar 路径
                        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                        const archiveDate = entry.match(/^(\d{4}-\d{2}-\d{2})-/)?.[1];

                        insertChange(dbPath, {
                            name: changeName,
                            archiveDate,
                            module: extractModule(changeName),
                            summary: manifest.summary ?? '',
                        });

                        // 索引能力
                        const capsPath = path.join(venusDir, 'capabilities.json');
                        if (fs.existsSync(capsPath)) {
                            const caps = JSON.parse(fs.readFileSync(capsPath, 'utf8'));
                            const capEntries: CapabilityIndexEntry[] = [];
                            for (const c of caps.capabilities ?? []) {
                                for (const op of c.operations ?? []) {
                                    capEntries.push({ name: c.name, changeName, operation: op.type });
                                }
                            }
                            insertCapabilities(dbPath, changeName, capEntries);
                        }

                        // 索引决策
                        const decisionsPath = path.join(venusDir, 'decisions.json');
                        if (fs.existsSync(decisionsPath)) {
                            const decs = JSON.parse(fs.readFileSync(decisionsPath, 'utf8'));
                            const decEntries: DecisionIndexEntry[] = (decs.decisions ?? []).map(
                                (d: Record<string, unknown>) => ({
                                    title: String(d.title ?? ''),
                                    choice: String(d.choice ?? ''),
                                    rationale: String(d.rationale ?? ''),
                                    changeName,
                                }),
                            );
                            insertDecisions(dbPath, decEntries);
                        }

                        indexed++;
                    } else {
                        // 降级：从 proposal.md 提取基本信息
                        const proposalPath = path.join(changeDir, 'proposal.md');
                        if (fs.existsSync(proposalPath)) {
                            const proposalContent = fs.readFileSync(proposalPath, 'utf8');
                            const summaryMatch = /^## Why\s*\n+(.+)/m.exec(proposalContent);
                            const archiveDate = entry.match(/^(\d{4}-\d{2}-\d{2})-/)?.[1];

                            insertChange(dbPath, {
                                name: changeName,
                                archiveDate,
                                module: extractModule(changeName),
                                summary: summaryMatch?.[1]?.slice(0, 200) ?? '',
                            });
                            indexed++;
                            degraded++;
                        } else {
                            errors.push(`${entry}: 无可解析的制品（无 manifest.json 也无 proposal.md）`);
                        }
                    }
                } catch (error: unknown) {
                    errors.push(`${entry}: ${(error as Error).message}`);
                }
            }

            const result = {
                success: true,
                indexed,
                degraded,
                total: entries.length,
                errors: errors.length > 0 ? errors : undefined,
            };

            if (options.json) {
                console.log(JSON.stringify(result, null, 2));
            } else {
                console.log(`索引重建完成：${indexed}/${entries.length} 个变更已索引`);
                if (degraded > 0) {
                    console.log(`  ${degraded} 个变更无 JSON sidecar，已降级解析 MD`);
                }
                if (errors.length > 0) {
                    console.log(`  ${errors.length} 个变更索引失败：`);
                    for (const e of errors) {
                        console.log(`    - ${e}`);
                    }
                }
            }

            if (errors.length > 0) {
                process.exitCode = 1;
            }
        });

    return spec;
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

/** 列出活跃变更名（openspec/changes/ 下排除 archive/） */
function listActiveChanges(projectRoot: string): string[] {
    const changesDir = path.join(projectRoot, 'openspec', 'changes');
    return listSubdirectories(changesDir).filter((name) => name !== 'archive');
}

/** 从 kebab-case 变更名提取模块名 */
function extractModule(changeName: string): string {
    // 格式：{prefix}-{module}-{feature}，取中间段
    const parts = changeName.split('-');
    if (parts.length >= 3) {
        return parts.slice(1, -1).join('-');
    }
    if (parts.length === 2) {
        return parts[1];
    }
    return 'general';
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
    const specsExist = completed.has('specs');
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
    const completed = detectCompleted(changeRoot);
    const specsExist = completed.has('specs');
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
 * 获取 apply 阶段上下文（venus spec instructions apply --change <name> --json 的数据源）。
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
    const specsExist = completed.has('specs');
    const conflict = skipSpecs && specsExist;
    const skipped = skipSpecs && !specsExist;

    // 满足集合（用于下游依赖判定）
    const satisfied = new Set(completed);
    if (skipped) {
        satisfied.add('specs');
    }
    if (conflict) {
        satisfied.delete('specs');
    }

    // contextFiles：已创建 → 绝对路径；未创建 → 空字符串
    const contextFiles = {
        proposal: completed.has('proposal') ? path.join(changeRoot, 'proposal.md') : '',
        specs: specsExist ? path.join(changeRoot, 'specs') : '',
        design: completed.has('design') ? path.join(changeRoot, 'design.md') : '',
        tasks: completed.has('tasks') ? path.join(changeRoot, 'tasks.md') : '',
    };

    // progress：tasks.md 不存在时返回全零（不报错）
    const rawProgress = parseTaskProgress(changeRoot);
    const progress = rawProgress ?? { total: 0, complete: 0, remaining: 0 };

    // taskList：解析 tasks.md 勾选项
    const taskList = parseTaskList(changeRoot);

    // instruction 三态判定
    const missingDeps: string[] = [];
    let state: 'blocked' | 'ready' | 'all_done';
    let text: string;

    if (conflict) {
        // 冲突态：blocked，提示先解决冲突
        state = 'blocked';
        text = '检测到 skip_specs 声明与 specs/ 下文件共存。请先解决冲突（删除 specs/ 下文件 或 移除 skip_specs 声明）后再进入实现。';
        missingDeps.push('specs');
    } else {
        // 检查 tasks 依赖是否满足（skipped 视为满足）
        if (!satisfied.has('specs')) {
            missingDeps.push('specs');
        }
        if (!satisfied.has('design')) {
            missingDeps.push('design');
        }
        // specs/design 满足但 tasks.md 不存在
        if (missingDeps.length === 0 && !completed.has('tasks')) {
            missingDeps.push('tasks');
        }

        if (missingDeps.length > 0) {
            state = 'blocked';
            text = `依赖未满足：${missingDeps.join('、')}。请先完成对应 artifact（使用 venus spec instructions <artifact-id> --change ${changeName}）再进入实现。`;
        } else if (progress.remaining > 0) {
            // 依赖满足且存在未完成勾选项
            state = 'ready';
            text = '按 tasks.md 逐项实现，规格行为完整实现方可勾选 [x]。';
        } else if (progress.total > 0) {
            // 全部勾选 [x]
            state = 'all_done';
            text = '所有任务已完成，准备归档（venus spec archive ' + changeName + ' --yes）。';
        } else {
            // tasks.md 存在但无可识别勾选项
            state = 'ready';
            text = 'tasks.md 无可识别勾选项。请先按 venus spec instructions tasks --change ' + changeName + ' 补充任务清单。';
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

/**
 * 解析 tasks.md 为任务列表。
 * 每项含原始行文本、勾选状态与缩进层级。
 * tasks.md 不存在时返回空数组。
 *
 * @param changeRoot - 变更目录绝对路径
 */
function parseTaskList(changeRoot: string): TaskListItem[] {
    const tasksFile = path.join(changeRoot, SPEC_DRIVEN_SCHEMA.apply.tracks);
    if (!fs.existsSync(tasksFile)) {
        return [];
    }
    const content = fs.readFileSync(tasksFile, 'utf8');
    const items: TaskListItem[] = [];
    // 匹配 - [ ] / - [x]（容忍首尾空白与列表标记变体 -/*）
    const pattern = /^(\s*)[-*]\s+\[([ xX])\]/;
    for (const line of content.split(/\r?\n/)) {
        const match = pattern.exec(line);
        if (match === null) {
            continue;
        }
        const [, indent, mark] = match;
        items.push({
            text: line,
            checked: mark !== ' ',
            indent: indent.length,
        });
    }
    return items;
}
