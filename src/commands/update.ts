/**
 * venus update 命令。
 *
 * 将内置模板的最新版本刷新到目标工具目录，按内容对比保护用户手改：
 *   - 未安装        → 安装（新增技能）
 *   - 与内置一致     → 无动作（幂等，不重写避免 mtime 抖动）
 *   - 来自旧版本     → 升级（generatedBy 对比判定，未手改才升级）
 *   - 用户手改过     → 跳过并列出，提示人工确认（--force 才覆盖）
 */

import path from 'path';
import { createRequire } from 'node:module';
import { getSkillTemplates, getCommandTemplates } from '../core/templates/index.js';
import {
    generateSkillContent,
    generateCommand,
    CommandAdapterRegistry,
    type CommandContent,
} from '../core/command-generation/index.js';
import {
    AI_TOOLS,
    TOOL_SKILLS_SUBDIR,
    type AIToolOption,
} from '../core/config.js';
import { readProjectConfig } from '../core/project-config.js';
import { resolveWorkflows } from '../core/profiles.js';
import { scanReconcileOrphans, type ReconcileOrphans } from '../core/reconcile.js';
import { ensureDir, writeFile, readFileIfExists } from '../utils/file-system.js';

/** update 命令选项 */
export interface UpdateOptions {
    /** 覆盖用户手改过的技能 */
    force?: boolean;
}

/** update 执行结果 */
export interface UpdateResult {
    projectRoot: string;
    tools: string[];
    /** 本次新安装的技能 */
    installed: string[];
    /** 升级或覆盖刷新的技能 */
    updated: string[];
    /** 因用户手改而跳过的技能 */
    skippedModified: string[];
    /** 写入的指令文件数 */
    commandsWritten: number;
    /** 生效 workflow 集来源：default（未配置用默认集）| user（用户显式配置） */
    workflowsSource: 'default' | 'user';
    /** 依赖注入自动补全的 workflow id（供输出提示） */
    injectedDeps: string[];
    /** 已装但不在生效集内的 venus 产物（保留不删，供输出提示） */
    reconcileOrphans: ReconcileOrphans;
}

/** 读取当前包版本 */
function getPackageVersion(): string {
    try {
        const req = createRequire(import.meta.url);
        const pkg = req('../../package.json') as { version?: string };
        return pkg.version ?? '0.0.0';
    } catch {
        return '0.0.0';
    }
}

/**
 * 执行 update。
 *
 * @param projectRoot - 项目根目录
 * @param options - 命令选项
 */
export function runUpdate(projectRoot: string, options: UpdateOptions = {}): UpdateResult {
    const tools: AIToolOption[] = AI_TOOLS;
    const packageVersion = getPackageVersion();
    const installed: string[] = [];
    const updated: string[] = [];
    const skippedModified: string[] = [];
    let commandsWritten = 0;

    // 读项目配置，解析生效 workflow 集（未配置用默认集 + 依赖注入补全）
    const projectConfig = readProjectConfig(projectRoot);
    const resolved = resolveWorkflows(projectConfig?.workflows);
    const workflowsSource = projectConfig && projectConfig.workflows.length > 0 ? 'user' : 'default';

    for (const tool of tools) {
        const adapter = CommandAdapterRegistry.get(tool.value);
        if (!adapter) {
            continue;
        }
        const skillsRoot = path.join(projectRoot, tool.skillsDir, TOOL_SKILLS_SUBDIR);
        ensureDir(skillsRoot);

        // 1. 技能：按内容与版本对比决策
        for (const { template } of getSkillTemplates(undefined, resolved.workflows)) {
            const generated = generateSkillContent(template, packageVersion);
            const skillDir = path.join(skillsRoot, generated.dirName);
            const skillFile = path.join(skillDir, 'SKILL.md');
            const existing = readFileIfExists(skillFile);
            const relativeSkill = path.relative(projectRoot, skillFile);

            if (existing === undefined) {
                ensureDir(skillDir);
                writeFile(skillFile, generated.fileContent, { force: true });
                installed.push(relativeSkill);
            } else if (existing === generated.fileContent) {
                continue;
            } else if (isFromEarlierVersion(existing, packageVersion)) {
                ensureDir(skillDir);
                writeFile(skillFile, generated.fileContent, { force: true });
                updated.push(relativeSkill);
            } else if (options.force) {
                ensureDir(skillDir);
                writeFile(skillFile, generated.fileContent, { force: true });
                updated.push(relativeSkill);
            } else {
                skippedModified.push(relativeSkill);
            }
        }

        // 2. 指令：venus 命名空间内存在即刷新（指令无 generatedBy，不做手改保护）
        for (const { template, id } of getCommandTemplates(undefined, resolved.workflows)) {
            const content: CommandContent = {
                id,
                name: template.name,
                description: template.description,
                category: template.category,
                tags: template.tags,
                body: template.content,
            };
            const generated = generateCommand(content, adapter);
            const commandFile = path.join(projectRoot, generated.path);
            const existing = readFileIfExists(commandFile);
            if (existing === generated.fileContent) {
                continue;
            }
            writeFile(commandFile, generated.fileContent, { force: true });
            commandsWritten++;
        }
    }

    // reconcile 扫描：已装但不在生效集内的 venus 产物（保留不删，供输出提示）
    const reconcileOrphans = scanReconcileOrphans(projectRoot, resolved.workflows);

    return {
        projectRoot,
        tools: tools.map((t) => t.value),
        installed,
        updated,
        skippedModified,
        commandsWritten,
        workflowsSource,
        injectedDeps: resolved.injected,
        reconcileOrphans,
    };
}

/**
 * 判断已安装技能是否"来自旧版本"（从而允许升级覆盖）。
 *
 * 读 frontmatter 的 metadata.generatedBy：
 *   - 为当前版本 → 内容差异意味着手改
 *   - 为旧版本   → 视为可升级
 *   - 无法解析   → 保守视为手改，跳过
 */
function isFromEarlierVersion(existing: string, currentVersion: string): boolean {
    const match = existing.match(/^  generatedBy: "(.+)"$/m);
    if (!match) {
        return false;
    }
    return match[1] !== currentVersion;
}
