/**
 * iagent git 命令组：Git 环境与仓库状态的确定性查询与幂等初始化。
 *
 * 供技能正文确定性调用，避免模型自行拼命令：
 *   iagent git status [--json]   环境与仓库状态快照（纯只读）
 *   iagent git init   [--json]   幂等初始化仓库
 *
 * 契约见 `openspec/specs/git-capability-cli/spec.md`。
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

    return git;
}
