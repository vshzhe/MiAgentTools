/**
 * venus spec 子命令组：规格驱动工作流的变更生命周期管理。
 *
 * 命令（自研替代 openspec CLI，零外部依赖，ADR-0001）：
 *   venus spec new "<name>"                          创建变更骨架（.openspec.yaml 兼容元数据）
 *   venus spec status --change <name> [--json] [--all]  artifact 状态校验
 *   venus spec instructions <artifact-id> --change <name> [--json]  模板分发
 *   venus spec archive <name> [--yes] [--json]       归档移动（spec 合并由 spec-archive 技能执行）
 */

import { Command } from 'commander';
import { createChange } from '../core/spec/new-change.js';
import { getChangeStatus } from '../core/spec/status.js';
import { getArtifactInstructions } from '../core/spec/instructions.js';
import { executeArchive, previewArchive } from '../core/spec/archive.js';
import { listSubdirectories } from '../utils/file-system.js';
import * as path from 'path';
import * as fs from 'fs';

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
        .description('校验变更 artifact 状态（done/ready/blocked）与任务进度')
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
        .description('获取 artifact 生成指令与模板（proposal / specs / design / tasks）')
        .requiredOption('--change <name>', '目标变更名')
        .option('--json', '以 JSON 输出（供程序处理）')
        .action((artifactId: string, options: { change: string; json?: boolean }) => {
            const info = getArtifactInstructions(process.cwd(), options.change, artifactId);
            if (options.json) {
                console.log(JSON.stringify(info, null, 2));
                return;
            }
            console.log(`artifact：${info.artifactId}（${info.description}）`);
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
        const statuses = changes.map((name) => getChangeStatus(projectRoot, name, warnings));
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
    const status = getChangeStatus(projectRoot, options.change, warnings);
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

/** 渲染单变更状态文本 */
function renderStatusText(status: ReturnType<typeof getChangeStatus>): string {
    const lines = [`变更：${status.changeName}（schema: ${status.schemaName}）`];
    for (const artifact of status.artifacts) {
        const suffix = artifact.status === 'blocked' ? `（缺失依赖：${artifact.missingDeps?.join('、')}）` : '';
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
