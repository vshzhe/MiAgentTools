/**
 * venus CLI 主入口。
 *
 * 命令：
 *   venus init      生成全部技能与指令到当前项目 .claude/
 *   venus list      列出已安装技能（--json）
 *   venus generate  按类型生成新技能骨架
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
import { AI_TOOLS, SKILL_TYPES } from '../core/config.js';

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
        .description('生成全部技能（SKILL.md）与斜杠指令到当前项目')
        .addOption(
            new Option('--tools <ids>', `目标工具，逗号分隔（默认全部：${TOOL_IDS}）`).choices(
                AI_TOOLS.map((t) => t.value)
            )
        )
        .option('--force', '覆盖已存在的文件')
        .option('--onboarding', '完成后显示下一步使用引导')
        .action((options: { tools?: string; force?: boolean; onboarding?: boolean }) => {
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
        .option('--force', '覆盖用户手改过的技能')
        .action((options: { force?: boolean }) => {
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

    return program;
}

export function runCli(): void {
    buildProgram().parseAsync(process.argv).catch((error: unknown) => {
        console.error(`错误：${(error as Error).message}`);
        process.exitCode = 1;
    });
}
