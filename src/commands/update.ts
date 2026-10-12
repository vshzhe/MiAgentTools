/**
 * venus update 命令。
 *
 * 将内置模板的最新版本刷新到目标工具目录，按内容指纹保护用户手改：
 *   - 未安装        → 安装（新增技能）
 *   - 与内置一致     → 无动作（幂等，不重写避免 mtime 抖动）
 *   - 指纹自洽       → 升级（自上次由 venus 写入后未被改动）
 *   - 存量无指纹     → 回退到原版本号判定（保持既有行为）
 *   - 用户手改过     → 跳过并列出，提示人工确认（--force 才覆盖）
 *
 * 指纹判定（见 core/command-generation/fingerprint.ts）独立于版本号，
 * 因此"模板正文变更但版本号未递增"也能被正确识别为可升级。
 *
 * 技能与指令分离架构：
 *   - 技能：遍历 AI_TOOLS 全部工具生成（不依赖适配器），支持 skills-invocable 工具
 *   - 指令：仅遍历有适配器的工具生成，无适配器工具（如 Codex）跳过指令生成
 *   - 权限：每个工具独立合并，不受适配器影响
 */

import path from 'path';
import { createRequire } from 'node:module';
import { getSkillTemplates, getCommandTemplates } from '../core/templates/index.js';
import {
    generateSkillContent,
    generateCommand,
    CommandAdapterRegistry,
    fingerprintOf,
    readGeneratedBy,
    readGeneratedFingerprint,
    type CommandContent,
} from '../core/command-generation/index.js';
import {
    AI_TOOLS,
    TOOL_SKILLS_SUBDIR,
} from '../core/config.js';
import { readProjectConfig, resolveActiveTools } from '../core/project-config.js';
import { resolveWorkflows } from '../core/profiles.js';
import { scanReconcileOrphans, type ReconcileOrphans } from '../core/reconcile.js';
import {
    buildPermissionEntries,
    mergePermissions,
    type MergeResult,
} from '../core/permissions.js';
import { ensureDir, writeFile, readFileIfExists, writeSkillReferences, removeDir } from '../utils/file-system.js';

/** 目标工具设置文件的相对路径（会话级权限载体） */
const SETTINGS_FILE = 'settings.json';

/** update 命令选项 */
export interface UpdateOptions {
    /** 覆盖用户手改过的技能 */
    force?: boolean;
    /** 目标工具 id 列表（逗号分隔，默认全部；优先级高于 config.yaml 的 tools 字段） */
    tools?: string;
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
    /** 会话级权限载体（.claude/settings.json）的合并结果，每个目标工具一项 */
    permissionSettings: MergeResult[];
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
    const packageVersion = getPackageVersion();
    const installed: string[] = [];
    const updated: string[] = [];
    const skippedModified: string[] = [];
    const permissionSettings: MergeResult[] = [];
    let commandsWritten = 0;

    // 读项目配置，解析生效 workflow 集（未配置用默认集 + 依赖注入补全）
    const projectConfig = readProjectConfig(projectRoot);
    const resolved = resolveWorkflows(projectConfig?.workflows);
    const workflowsSource = projectConfig && projectConfig.workflows.length > 0 ? 'user' : 'default';

    // 解析生效工具列表（CLI --tools > config tools > 全部 AI_TOOLS）
    const tools = resolveActiveTools(options.tools, projectConfig?.tools, AI_TOOLS);

    // 会话级放行条目：源自生效集技能模板的白名单（与 frontmatter 同源，避免第二份真源）
    const permissionEntries = buildPermissionEntries(
        getSkillTemplates(undefined, resolved.workflows).map((entry) => entry.template.allowedTools)
    );

    // 1. 技能生成（遍历所有工具，不依赖适配器）
    for (const tool of tools) {
        const skillsRoot = path.join(projectRoot, tool.skillsDir, TOOL_SKILLS_SUBDIR);
        ensureDir(skillsRoot);

        const syncReferences = (skillDir: string, references: Array<{ path: string; content: string }> | undefined): void => {
            removeDir(path.join(skillDir, 'references'));
            writeSkillReferences(skillDir, references);
        };
        for (const { template } of getSkillTemplates(undefined, resolved.workflows)) {
            const generated = generateSkillContent(template, packageVersion);
            const skillDir = path.join(skillsRoot, generated.dirName);
            const skillFile = path.join(skillDir, 'SKILL.md');
            const existing = readFileIfExists(skillFile);
            const relativeSkill = path.relative(projectRoot, skillFile);

            if (existing === undefined) {
                ensureDir(skillDir);
                writeFile(skillFile, generated.fileContent, { force: true });
                syncReferences(skillDir, generated.references);
                installed.push(relativeSkill);
            } else if (existing === generated.fileContent) {
                continue;
            } else if (isUnmodified(existing)) {
                ensureDir(skillDir);
                writeFile(skillFile, generated.fileContent, { force: true });
                syncReferences(skillDir, generated.references);
                updated.push(relativeSkill);
            } else if (isLegacyVersionMismatched(existing, packageVersion)) {
                ensureDir(skillDir);
                writeFile(skillFile, generated.fileContent, { force: true });
                syncReferences(skillDir, generated.references);
                updated.push(relativeSkill);
            } else if (options.force) {
                ensureDir(skillDir);
                writeFile(skillFile, generated.fileContent, { force: true });
                syncReferences(skillDir, generated.references);
                updated.push(relativeSkill);
            } else {
                skippedModified.push(relativeSkill);
            }
        }

        // 会话级权限载体：每个工具独立合并，不受适配器影响
        try {
            permissionSettings.push(
                mergePermissions(projectRoot, path.join(tool.skillsDir, SETTINGS_FILE), permissionEntries)
            );
        } catch (error) {
            permissionSettings.push({
                path: path.join(tool.skillsDir, SETTINGS_FILE).replaceAll('\\', '/'),
                state: 'preserved-invalid',
                added: 0,
                note: `写入失败（已跳过，不影响产物刷新）：${(error as Error).message}`,
            });
        }
    }

    // 2. 指令生成（仅遍历有适配器的工具）
    for (const tool of tools) {
        const adapter = CommandAdapterRegistry.get(tool.value);
        if (!adapter) {
            continue;
        }
        for (const { template, id } of getCommandTemplates(undefined, resolved.workflows)) {
            const content: CommandContent = {
                id,
                name: template.name,
                description: template.description,
                category: template.category,
                tags: template.tags,
                body: template.content,
                allowedTools: template.allowedTools,
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
        permissionSettings,
    };
}

/**
 * 判断已安装产物是否**未被改动过** —— 即记录的指纹与其内容自洽。
 *
 * 指纹由 venus 写入产物时按内容算出；用户任何改动都会让内容与记录的指纹
 * 失配，从而被识别为手改。该判定**独立于版本号**：模板正文变更而版本号
 * 未递增时，指纹仍自洽，故能正确升级（原先只能靠 `--force`）。
 *
 * @returns 指纹自洽返回 true；无指纹字段（存量产物）或指纹失配返回 false
 */
function isUnmodified(existing: string): boolean {
    const recorded = readGeneratedFingerprint(existing);
    return recorded !== undefined && recorded === fingerprintOf(existing);
}

/**
 * 存量回退：产物**无指纹字段**时，沿用原版本号判定（版本号与当前包版本
 * 不一致即视为可升级）。仅用于本版之前安装的历史产物；一旦被本版覆盖写入
 * 即带上指纹，后续一律走精确的指纹判定。
 *
 * 注意语义是"**不一致**"而非"早于"：升级方向无法从版本号推断，故不比较大小。
 *
 * @returns 无指纹且版本号不一致返回 true；有指纹（走指纹判定）或版本号
 *          缺失/与当前一致返回 false
 */
function isLegacyVersionMismatched(existing: string, currentVersion: string): boolean {
    if (readGeneratedFingerprint(existing) !== undefined) {
        return false;
    }
    const generatedBy = readGeneratedBy(existing);
    return generatedBy !== undefined && generatedBy !== currentVersion;
}
