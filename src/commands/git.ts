/**
 * iagent git 命令组：Git 环境与仓库状态的确定性查询、幂等初始化与分支操作。
 *
 * 供技能正文确定性调用，避免模型自行拼命令：
 *   iagent git status [--json]                          环境与仓库状态快照（纯只读）
 *   iagent git init   [--json]                          幂等初始化仓库
 *   iagent git branch [--create <name>|--delete <name>] 工作分支创建 / 复用 / 删除
 *   iagent git merge  <branch> [--into <branch>]        合并工作分支（冲突不 abort）
 *
 * 契约见 `openspec/specs/git-capability-cli/spec.md` 与
 * `openspec/specs/git-branch-capability/spec.md`。
 */

import { Command } from 'commander';
import * as path from 'node:path';
import {
    detectGit,
    findParentRepository,
    isGitRepository,
    initRepository,
    probeInstallers,
    defaultGitRunner,
    createWorkBranch,
    mergeWorkBranch,
    deleteMergedBranch,
    type GitCommandRunner,
} from '../core/git-capability.js';

/** status 输出结构 */
export interface GitStatusOutput {
    installed: boolean;
    version?: string;
    isRepo: boolean;
    parentRepo: string | null;
    installers: Array<{ name: string; display: string }>;
}

/** init 输出结构 */
export interface GitInitOutput {
    action: 'created' | 'skipped' | 'failed';
    reason?: string;
}

/** branch 输出结构（创建 / 复用 / 跳过 / 删除 / 失败的统一形态） */
export interface GitBranchOutput {
    action: 'created' | 'reused' | 'skipped' | 'deleted' | 'failed';
    branch: string;
    baseBranch?: string;
    reason?: string;
}

/** merge 输出结构 */
export interface GitMergeOutput {
    ok: boolean;
    merged: boolean;
    conflicts: string[];
    detail?: string;
}

/**
 * 收集 Git 环境状态（纯只读）。
 *
 * @param projectRoot - 项目根目录
 * @param options - 可注入 detect/runner 以便测试（缺省走真实命令）
 */
export function runGitStatus(
    projectRoot: string,
    options: {
        detect?: () => ReturnType<typeof detectGit>;
        probInstallers?: () => ReturnType<typeof probeInstallers>;
    } = {},
): GitStatusOutput {
    const status = (options.detect ?? (() => detectGit()))();
    const installers = status.installed
        ? []
        : (options.probInstallers ?? (() => probeInstallers()))();
    return {
        installed: status.installed,
        ...(status.version === undefined ? {} : { version: status.version }),
        isRepo: isGitRepository(projectRoot),
        parentRepo: isGitRepository(projectRoot) ? null : findParentRepository(projectRoot),
        installers: installers.map((item) => ({ name: item.name, display: item.display })),
    };
}

/**
 * 执行幂等初始化。
 *
 * @param projectRoot - 项目根目录
 * @param options - 可注入 detect（测试用）
 */
export function runGitInit(
    projectRoot: string,
    options: { detect?: () => ReturnType<typeof detectGit> } = {},
): GitInitOutput {
    const result = initRepository(path.resolve(projectRoot), defaultGitRunner, options);
    return result.action === 'created' || result.action === 'skipped'
        ? { action: result.action, ...(result.reason === undefined ? {} : { reason: result.reason }) }
        : { action: 'failed', reason: result.reason };
}

/**
 * 执行分支创建 / 删除（可注入 runner 以便测试）。
 *
 * `--create` 与 `--delete` 互斥；两者皆缺时只读输出当前分支状态。
 */
export function runGitBranch(
    projectRoot: string,
    options: { create?: string; delete?: string; base?: string; runner?: GitCommandRunner } = {},
): GitBranchOutput {
    const runner = options.runner ?? defaultGitRunner;
    if (options.create !== undefined) {
        const result = createWorkBranch({
            name: options.create,
            ...(options.base === undefined ? {} : { baseBranch: options.base }),
            cwd: path.resolve(projectRoot),
            runner,
        });
        return {
            action: result.action,
            branch: result.branch,
            ...(result.baseBranch === undefined ? {} : { baseBranch: result.baseBranch }),
            ...(result.reason === undefined ? {} : { reason: result.reason }),
        };
    }
    if (options.delete !== undefined) {
        const result = deleteMergedBranch({
            name: options.delete,
            cwd: path.resolve(projectRoot),
            runner,
        });
        return {
            action: result.action === 'deleted' ? 'deleted' : 'skipped',
            branch: options.delete,
            ...(result.reason === undefined ? {} : { reason: result.reason }),
        };
    }
    return { action: 'skipped', branch: '', reason: '未指定 --create 或 --delete' };
}

/** 执行分支合并（可注入 runner 以便测试） */
export function runGitMerge(
    projectRoot: string,
    branch: string,
    options: { into?: string; runner?: GitCommandRunner } = {},
): GitMergeOutput {
    return mergeWorkBranch({
        name: branch,
        ...(options.into === undefined ? {} : { into: options.into }),
        cwd: path.resolve(projectRoot),
        runner: options.runner ?? defaultGitRunner,
    });
}

/** 构造 git 子命令组 */
export function buildGitCommand(): Command {
    const git = new Command('git')
        .description('Git 环境与仓库状态查询、幂等初始化');

    git.command('status')
        .description('输出 Git 环境与仓库状态（纯只读）')
        .option('--json', '以 JSON 输出（供程序处理）')
        .action((options: { json?: boolean }) => {
            const output = runGitStatus(process.cwd());
            if (options.json === true) {
                console.log(JSON.stringify(output, null, 2));
                return;
            }
            console.log(`Git：${output.installed ? `已安装（${output.version ?? '版本未知'}）` : '未安装'}`);
            console.log(`仓库：${output.isRepo ? '是（当前目录）' : output.parentRepo === null ? '否' : `否（上级仓库：${output.parentRepo}）`}`);
            if (output.installers.length > 0) {
                console.log('可用安装器：');
                for (const installer of output.installers) console.log(`  - ${installer.name}：${installer.display}`);
            }
            // 状态查询不是错误：未安装也返回 0
        });

    git.command('init')
        .description('幂等初始化 Git 仓库（已存在或上级有仓库时跳过）')
        .option('--json', '以 JSON 输出（供程序处理）')
        .action((options: { json?: boolean }) => {
            const output = runGitInit(process.cwd());
            if (options.json === true) {
                console.log(JSON.stringify(output, null, 2));
            } else {
                const text =
                    output.action === 'created' ? 'Git 仓库已初始化' :
                    output.action === 'skipped' ? `已跳过：${output.reason ?? ''}` :
                    `初始化失败：${output.reason ?? '未知原因'}`;
                console.log(text);
            }
            if (output.action === 'failed') {
                process.exitCode = 1;
            }
        });

    git.command('branch')
        .description('工作分支创建 / 复用 / 删除（无参数时仅报告跳过）')
        .option('--create <name>', '创建并切换到工作分支（已存在则复用）')
        .option('--delete <name>', '删除已合并的工作分支（未合并时跳过）')
        .option('--base <branch>', '声明基点分支（须与当前分支一致）')
        .option('--json', '以 JSON 输出（供程序处理）')
        .action((options: { create?: string; delete?: string; base?: string; json?: boolean }) => {
            const output = runGitBranch(process.cwd(), options);
            if (options.json === true) {
                console.log(JSON.stringify(output, null, 2));
            } else {
                const text =
                    output.action === 'created' ? `工作分支已创建：${output.branch}（基分支 ${output.baseBranch ?? '?'}）` :
                    output.action === 'reused' ? `工作分支已存在，已复用：${output.branch}（${output.reason ?? ''}）` :
                    output.action === 'deleted' ? `工作分支已删除：${output.branch}` :
                    `已跳过：${output.reason ?? ''}`;
                console.log(text);
            }
            if (output.action === 'failed') {
                process.exitCode = 1;
            }
        });

    git.command('merge <branch>')
        .description('合并工作分支到当前分支（--no-ff；冲突不 abort）')
        .option('--into <branch>', '先切换到目标分支再合并')
        .option('--json', '以 JSON 输出（供程序处理）')
        .action((branch: string, options: { into?: string; json?: boolean }) => {
            const output = runGitMerge(process.cwd(), branch, options);
            if (options.json === true) {
                console.log(JSON.stringify(output, null, 2));
            } else if (output.ok) {
                console.log(`已合并 ${branch}（--no-ff）`);
            } else if (output.conflicts.length > 0) {
                console.log(`合并冲突（未 abort，请手工处置）：`);
                for (const file of output.conflicts) console.log(`  - ${file}`);
            } else {
                console.log(`合并失败：${output.detail ?? '未知原因'}`);
            }
            if (!output.ok) {
                process.exitCode = 1;
            }
        });

    return git;
}
