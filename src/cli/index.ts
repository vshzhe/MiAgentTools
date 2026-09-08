/**
 * venus CLI 主入口。
 *
 * 命令：
 *   venus init      生成全部技能与指令到当前项目 .claude/
 *   venus list      列出已安装技能（--json）
 *   venus generate  按类型生成新技能骨架
 */

import { Command, Option } from 'commander';
import { createRequire } from 'node:module';
import { runInit } from '../commands/init.js';
import { runList } from '../commands/list.js';
import { runGenerate } from '../commands/generate.js';
import { runValidateCommand } from '../commands/validate.js';
import { runUpdate } from '../commands/update.js';
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
        .action((options: { tools?: string; force?: boolean }) => {
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
