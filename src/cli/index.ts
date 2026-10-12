/**
 * venus CLI 主入口。
 *
 * 命令：
 *   venus init      生成全部技能与指令到当前项目 .claude/
 *   venus list      列出已安装技能（--json）
 *   venus generate  按类型生成新技能骨架
 *   venus spec      规格驱动工作流子命令组（new / status / instructions / archive）
 */

import { Argument, Command, Option } from 'commander';
import { createRequire } from 'node:module';
import { runInit } from '../commands/init.js';
import { runList } from '../commands/list.js';
import { runGenerate } from '../commands/generate.js';
import { runValidateCommand } from '../commands/validate.js';
import { runUpdate } from '../commands/update.js';
import { runCompletion, renderCompletionOutput } from '../commands/completion.js';
import { runUninstall, previewUninstall, renderUninstallOutput } from '../commands/uninstall.js';
import { runShow } from '../commands/show.js';
import { renderOnboardingHints } from '../commands/onboarding.js';
import { buildSpecCommand } from '../commands/spec.js';
import { ensureDependencies, renderDependencyReport } from '../core/dependencies.js';
import { renderScanReport } from '../core/project-scan.js';
import { AI_TOOLS, SKILL_TYPES } from '../core/config.js';
import { reconcileOrphanCount } from '../core/reconcile.js';
import { renderPermissionReport } from '../core/permissions.js';
import { runConfigInteractive, runConfigShow, runConfigSet } from '../commands/config.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };

const TOOL_IDS = AI_TOOLS.map((t) => t.value).join(', ');
const TYPE_IDS = SKILL_TYPES.map((t) => t.id).join(', ');

export function buildProgram(): Command {
    const program = new Command();

    program
        .name('venus')
        .description('VenusAgentTools —— 按生命周期类型（tr_*）生成与管理 venus_ 前缀的 Agent 技能')
        .version(version);

    program
        .command('init')
        .description('生成全部技能（SKILL.md）与斜杠指令到当前项目，并检测安装依赖（codegraph）')
        .addOption(
            new Option('--tools <ids>', `目标工具，逗号分隔（默认全部：${TOOL_IDS}）`).choices(
                AI_TOOLS.map((t) => t.value)
            )
        )
        .option('--force', '覆盖已存在的文件')
        .option('--no-deps', '跳过依赖检测与安装（codegraph）')
        .option('--no-scan', '跳过项目预扫描（不写 .venus/scan-baseline.json）')
        .option('--onboarding', '完成后显示下一步使用引导')
        .action((options: {
            tools?: string; force?: boolean; deps?: boolean; scan?: boolean; onboarding?: boolean;
        }) => {
            const result = runInit(process.cwd(), options);
            console.log(`Venus 初始化完成（工具：${result.tools.join(', ')}）`);
            console.log(`  技能：${result.skillsInstalled.length} 个`);
            for (const skill of result.skillsInstalled) {
                console.log(`    + ${skill}`);
            }
            console.log(`  指令：${result.commandsInstalled.length} 个`);
            for (const command of result.commandsInstalled) {
                console.log(`    + ${command}`);
            }
            if (result.skipped.length > 0) {
                console.log(`  跳过（已存在，--force 覆盖）：${result.skipped.length} 个`);
            }
            console.log(
                result.configState === 'created'
                    ? '  配置：.venus/ 已创建（config.yaml + rules/，可编辑定制项目约束）'
                    : '  配置：.venus/ 已存在，保留'
            );
            for (const ruleFile of result.ruleFilesCreated) {
                console.log(`    + ${ruleFile}`);
            }
            console.log(
                `  workflow 来源：${result.workflowsSource === 'default' ? '默认集' : '用户配置'}`
            );
            if (result.injectedDeps.length > 0) {
                console.log(`  依赖注入自动补全：${result.injectedDeps.length} 个`);
                for (const dep of result.injectedDeps) {
                    console.log(`    + ${dep}`);
                }
            }
            const orphanCount = reconcileOrphanCount(result.reconcileOrphans);
            if (orphanCount > 0) {
                console.log(
                    `  ! ${orphanCount} 个已装产物不在当前 workflows 配置中，保留未删：`
                );
                for (const skill of result.reconcileOrphans.skills) {
                    console.log(`    - ${skill}`);
                }
                for (const cmd of result.reconcileOrphans.commands) {
                    console.log(`    - ${cmd}`);
                }
                console.log('    如需移除：venus uninstall 或手动删除');
            }
            const permissionReport = renderPermissionReport(result.permissionSettings);
            if (permissionReport !== '') {
                console.log(permissionReport);
            }
            // 依赖检测与安装（codegraph，--no-deps 跳过）
            const deps = ensureDependencies(process.cwd(), { skip: options.deps === false });
            console.log(renderDependencyReport(deps));
            // 项目预扫描报告（与依赖报告并列；--no-scan 时无扫描输出）
            if (options.scan !== false) {
                console.log(renderScanReport(result.scanReport));
            }
            // 首次初始化（配置刚创建）或显式 --onboarding 时显示引导
            if (result.configState === 'created' || options.onboarding) {
                console.log(renderOnboardingHints());
            }
        });

    program
        .command('list')
        .description('列出已安装的 venus 技能（按类型分组）')
        .option('--json', '以 JSON 输出（供程序处理）')
        .action((options: { json?: boolean }) => {
            console.log(runList(process.cwd(), options));
        });

    program
        .command('validate')
        .description('校验已安装技能的规范符合性（frontmatter / 类型 / 命名）')
        .option('--json', '以 JSON 输出（供程序处理）')
        .action((options: { json?: boolean }) => {
            const { output, exitCode } = runValidateCommand(process.cwd(), options);
            console.log(output);
            if (exitCode !== 0) {
                process.exitCode = exitCode;
            }
        });

    program
        .command('update')
        .description('更新已安装技能到内置模板最新版（手改过的技能会跳过保护）')
        .addOption(
            new Option('--tools <ids>', `目标工具，逗号分隔（默认全部：${TOOL_IDS}）`).choices(
                AI_TOOLS.map((t) => t.value)
            )
        )
        .option('--force', '覆盖用户手改过的技能')
        .action((options: { tools?: string; force?: boolean }) => {
            const result = runUpdate(process.cwd(), options);
            console.log(`Venus 更新完成（工具：${result.tools.join(', ')}）`);
            console.log(`  新安装：${result.installed.length} 个`);
            for (const skill of result.installed) {
                console.log(`    + ${skill}`);
            }
            console.log(`  已升级：${result.updated.length} 个`);
            for (const skill of result.updated) {
                console.log(`    ↑ ${skill}`);
            }
            console.log(`  指令刷新：${result.commandsWritten} 个`);
            if (result.skippedModified.length > 0) {
                console.log(`  跳过（检测到用户手改，--force 覆盖）：${result.skippedModified.length} 个`);
                for (const skill of result.skippedModified) {
                    console.log(`    ! ${skill}`);
                }
            }
            console.log(
                `  workflow 来源：${result.workflowsSource === 'default' ? '默认集' : '用户配置'}`
            );
            if (result.injectedDeps.length > 0) {
                console.log(`  依赖注入自动补全：${result.injectedDeps.length} 个`);
                for (const dep of result.injectedDeps) {
                    console.log(`    + ${dep}`);
                }
            }
            const orphanCount = reconcileOrphanCount(result.reconcileOrphans);
            if (orphanCount > 0) {
                console.log(
                    `  ! ${orphanCount} 个已装产物不在当前 workflows 配置中，保留未删：`
                );
                for (const skill of result.reconcileOrphans.skills) {
                    console.log(`    - ${skill}`);
                }
                for (const cmd of result.reconcileOrphans.commands) {
                    console.log(`    - ${cmd}`);
                }
                console.log('    如需移除：venus uninstall 或手动删除');
            }
            const permissionReport = renderPermissionReport(result.permissionSettings);
            if (permissionReport !== '') {
                console.log(permissionReport);
            }
        });

    program
        .command('completion')
        .description('安装/卸载 shell 补全（bash / powershell）')
        .addArgument(new Argument('<action>', 'install 或 uninstall').choices(['install', 'uninstall']))
        .option('--shell <shell>', '目标 shell（默认两个都装）')
        .action((action: 'install' | 'uninstall', options: { shell?: string }) => {
            const results = runCompletion(action, options);
            console.log(renderCompletionOutput(results, action));
        });

    program
        .command('uninstall')
        .description('移除本项目已安装的 venus 技能与指令（非 venus 技能不碰）')
        .option('--purge-config', '连同 .venus/ 项目配置一起删除（默认保留）')
        .option('--yes', '跳过确认提示（脚本用）')
        .action((options: { purgeConfig?: boolean; yes?: boolean }) => {
            if (!options.yes) {
                const result = previewUninstall(process.cwd());
                console.log('将删除：');
                console.log(`  技能 ${result.removedSkills.length} 个、指令 ${result.removedCommands.length} 个${options.purgeConfig ? '、.venus/ 配置' : ''}`);
                console.log('确认执行请加 --yes，或重新运行并确认。');
                process.exitCode = 1;
                return;
            }
            const result = runUninstall(process.cwd(), options);
            console.log(renderUninstallOutput(result));
        });

    program
        .command('show <query>')
        .description('查看技能详情（frontmatter / 类型 / 白名单 / 正文预览），支持前缀匹配')
        .option('--json', '以 JSON 输出（供程序处理）')
        .action((query: string, options: { json?: boolean }) => {
            const { output, exitCode } = runShow(process.cwd(), query, options);
            console.log(output);
            if (exitCode !== 0) {
                process.exitCode = exitCode;
            }
        });

    program
        .command('generate')
        .description('按类型生成新技能骨架（写入 skills/ 并安装到 .claude/）')
        .requiredOption('--type <type>', `技能类型（${TYPE_IDS}）`)
        .requiredOption('--name <name>', '技能名（kebab-case，如 env-check）')
        .option('--desc <desc>', '技能描述（frontmatter description）')
        .option('--force', '覆盖已存在的技能')
        .action((options: { type: string; name: string; desc?: string; force?: boolean }) => {
            const result = runGenerate(process.cwd(), options);
            console.log(`技能已生成：${result.skillName}`);
            console.log(`  源文件：${result.sourcePath}`);
            console.log(`  已安装：${result.installedPath}`);
        });

    program
        .command('config')
        .description('配置本项目要安装的 workflow（.venus/config.yaml 的 workflows 字段）')
        .option('--set <list>', '非交互设置 workflow 列表（逗号分隔，脚本/CI 用）')
        .option('--show', '打印当前配置与生效 workflow 集')
        .action(async (options: { set?: string; show?: boolean }) => {
            if (options.set) {
                const result = runConfigSet(process.cwd(), options.set);
                console.log(`workflow 已设置：${result.workflows?.length ?? 0} 项（含依赖注入）`);
                for (const wf of result.workflows ?? []) {
                    console.log(`  + ${wf}`);
                }
                return;
            }
            if (options.show) {
                console.log(runConfigShow(process.cwd()));
                return;
            }
            try {
                const result = await runConfigInteractive(process.cwd());
                if (result.cancelled) {
                    console.log('未修改');
                } else {
                    console.log(`workflow 已更新：${result.workflows?.length ?? 0} 项`);
                    for (const wf of result.workflows ?? []) {
                        console.log(`  + ${wf}`);
                    }
                }
            } catch (error) {
                console.error(`错误：${(error as Error).message}`);
                process.exitCode = 1;
            }
        });

    // 规格驱动工作流子命令组（venus spec new / status / instructions / archive）
    program.addCommand(buildSpecCommand());

    return program;
}

export function runCli(): void {
    buildProgram().parseAsync(process.argv).catch((error: unknown) => {
        console.error(`错误：${(error as Error).message}`);
        process.exitCode = 1;
    });
}
