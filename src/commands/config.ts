/**
 * iagent config 命令：管理 .iagent/config.yaml 的 workflows 字段。
 *
 *   iagent config             交互式 checkbox 勾选 workflow（@inquirer/prompts）
 *   iagent config show        打印当前配置与生效 workflow 集
 *   iagent config --set <list>  非交互设置（逗号分隔，脚本/CI 用）
 *
 * workflow id 来自 registry 的全部技能（= deriveCommandId(技能名)），
 * 与 init/update 过滤、resolveWorkflows 注入所用 id 同源。
 */

import { checkbox } from '@inquirer/prompts';
import { getSkillTemplates } from '../core/templates/index.js';
import { resolveWorkflows } from '../core/profiles.js';
import {
    ensureProjectConfig,
    readProjectConfig,
    writeWorkflowsToConfig,
} from '../core/project-config.js';

/** config 命令选项 */
export interface ConfigOptions {
    /** 非交互设置 workflow 列表（逗号分隔） */
    set?: string;
    /** 显示当前配置与生效集 */
    show?: boolean;
}

/** config 执行结果 */
export interface ConfigResult {
    action: 'interactive' | 'show' | 'set';
    /** 写回的 workflow 列表（interactive/set 写回后有值） */
    workflows?: string[];
    /** 交互式是否被用户取消（ESC/Ctrl+C） */
    cancelled?: boolean;
}

/** 获取全部合法 workflow id（registry 全部技能派生，14 项） */
export function listAllWorkflowIds(): string[] {
    return getSkillTemplates().map((entry) => entry.commandId);
}

/**
 * 交互式勾选 workflow，确认后写回 config.yaml。
 * 非 TTY 环境抛错引导用 --set（CI/管道场景）。
 *
 * @param projectRoot - 项目根目录
 */
export async function runConfigInteractive(projectRoot: string): Promise<ConfigResult> {
    if (!process.stdin.isTTY) {
        throw new Error(
            '非交互环境（无 TTY），请用：iagent config --set <workflow1,workflow2,...>'
        );
    }
    // 确保 .iagent/ 与 config.yaml 存在（不存在则创建默认）
    ensureProjectConfig(projectRoot);
    const projectConfig = readProjectConfig(projectRoot);
    const resolved = resolveWorkflows(projectConfig?.workflows);

    const allIds = listAllWorkflowIds();
    const choices = allIds.map((id) => ({
        name: id,
        value: id,
        checked: resolved.workflows.includes(id),
    }));

    try {
        const selected = await checkbox({
            message: '选择要安装的 workflow（空格勾选，回车确认）：',
            choices,
            pageSize: 14,
        });
        writeWorkflowsToConfig(projectRoot, selected);
        return { action: 'interactive', workflows: selected };
    } catch {
        // 用户取消（ESC / Ctrl+C）
        return { action: 'interactive', cancelled: true };
    }
}

/**
 * 打印当前配置与生效 workflow 集（含依赖注入补全项与来源标注）。
 *
 * @param projectRoot - 项目根目录
 * @returns 多行文本
 */
export function runConfigShow(projectRoot: string): string {
    const projectConfig = readProjectConfig(projectRoot);
    const resolved = resolveWorkflows(projectConfig?.workflows);
    const source =
        projectConfig && projectConfig.workflows.length > 0 ? '用户配置' : '默认集';

    const lines: string[] = ['iAgent 配置：'];
    if (projectConfig) {
        lines.push(
            `  context: ${projectConfig.context.trim().length > 0 ? '(已设置)' : '(空)'}`
        );
        const ruleTypes = Object.keys(projectConfig.rules);
        lines.push(
            `  rules: ${ruleTypes.length > 0 ? ruleTypes.join(', ') : '(空)'}`
        );
    } else {
        lines.push('  .iagent/config.yaml 不存在（用 iagent init 创建）');
    }
    lines.push(`  生效 workflow（来源：${source}）：${resolved.workflows.length} 项`);
    for (const wf of resolved.workflows) {
        const isInjected = resolved.injected.includes(wf);
        lines.push(`    ${isInjected ? '+ ' : '  '}${wf}${isInjected ? '  (依赖注入)' : ''}`);
    }
    return lines.join('\n');
}

/**
 * 非交互设置 workflows 字段，供脚本/CI 使用。非法 id 抛错退出非零。
 *
 * @param projectRoot - 项目根目录
 * @param commaList - 逗号分隔的 workflow id 列表
 */
export function runConfigSet(projectRoot: string, commaList: string): ConfigResult {
    const ids = commaList
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    const allIds = new Set(listAllWorkflowIds());
    const invalid = ids.filter((id) => !allIds.has(id));
    if (invalid.length > 0) {
        throw new Error(
            `未知 workflow id：${invalid.join(', ')}（合法：${[...allIds].join(', ')}）`
        );
    }
    ensureProjectConfig(projectRoot);
    writeWorkflowsToConfig(projectRoot, ids);
    const resolved = resolveWorkflows(ids);
    return { action: 'set', workflows: resolved.workflows };
}
