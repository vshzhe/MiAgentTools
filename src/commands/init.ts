/**
 * iagent init 命令。
 *
 * 将全部内置技能（SKILL.md）与斜杠指令生成到各目标工具目录：
 *   技能：<skillsDir>/skills/iagent_<type>_<name>/SKILL.md（所有工具）
 *   指令：<commandsDir>/iagent/<id>.md（仅有适配器的工具）
 *
 * 技能与指令分离架构：参见 update.ts 同构结构。
 */

import path from 'path';
import * as fs from 'fs';
import { createRequire } from 'node:module';
import { getSkillTemplates, getCommandTemplates, getKnownCommandIds, rewriteCommandRefs } from '../core/templates/index.js';
import {
    generateSkillContent,
    generateCommand,
    CommandAdapterRegistry,
    type CommandContent,
} from '../core/command-generation/index.js';
import {
    AI_TOOLS,
    TOOL_SKILLS_SUBDIR,
} from '../core/config.js';
import { ensureProjectConfig, readProjectConfig, resolveActiveTools, writeToolsToConfig, type RuleRepairReport } from '../core/project-config.js';
import { resolveWorkflows } from '../core/profiles.js';
import { scanReconcileOrphans, type ReconcileOrphans } from '../core/reconcile.js';
import {
    scanProject,
    createEmptyScanReport,
    type ProjectScanReport,
} from '../core/project-scan.js';
import {
    buildPermissionEntries,
    mergePermissions,
    type MergeResult,
} from '../core/permissions.js';
import { ensureDir, writeFile, pathExists, writeSkillReferences } from '../utils/file-system.js';
import { initDatabase, isSqlite3Available, resolveIndexDb } from '../core/spec/sqlite-index.js';
import { runLegacyMigration, type LegacyMigrationReport } from '../core/legacy-migration.js';
import { cleanupMisplacedCommands, type MisplacedCleanupResult } from '../core/command-artifacts.js';
import { runSkillIdMigration, type SkillIdMigrationReport } from '../core/skill-id-migration.js';
import {
    ORCHESTRATOR_AGENT_ID,
    writeOpenCodeProjectArtifacts,
    type OpenCodeProjectArtifactsResult,
} from '../core/opencode-v2.js';
import {
    adaptSkillContentForHost,
    negotiationForHost,
} from '../core/host-orchestration/index.js';
import {
    ensurePiRuntime,
    detectPiRuntime,
    renderPiRuntimeMetadata,
    PI_RUNTIME_METADATA_FILE,
    type PiCommandRunner,
    type PiRuntimeStatus,
} from '../core/pi-runtime.js';
import {
    PI_ORCHESTRATOR_AGENT_ID,
    piAgentId,
    writePiNativeAgents,
    type PiNativeWriteResult,
} from '../core/pi-native.js';
import { deriveCommandId } from '../core/templates/index.js';

/** 目标工具设置文件的相对路径（会话级权限载体） */
const SETTINGS_FILE = 'settings.json';

/** init 命令选项 */
export interface InitOptions {
    /** 目标工具 id 列表（默认工具集：claude / pi / codex；opencode 为可选，需显式指定） */
    tools?: string;
    /** 覆盖已存在文件 */
    force?: boolean;
    /** 是否执行项目预扫描（--no-scan 时由 Commander 生成 scan: false，跳过扫描且不写基线） */
    scan?: boolean;
    /** 是否执行旧装机迁移（--no-migrate 时由 Commander 生成 migrate: false） */
    migrate?: boolean;
    /** 用户主目录（旧补全产物所在；仅测试与自定义环境注入，默认 os.homedir()） */
    homeDir?: string;
    /** Pi 运行时命令执行器（仅 CLI 注入真实执行器；缺省为安全空执行器 = degraded） */
    piRuntimeRunner?: PiCommandRunner;
}

/** init 执行结果（供测试与 --json 输出） */
export interface InitResult {
    projectRoot: string;
    tools: string[];
    skillsInstalled: string[];
    commandsInstalled: string[];
    skipped: string[];
    /** 配置文件状态：created（新建模板）| exists（config.yaml 已存在，保留原文；规则文件转入重建/修复） */
    configState: 'created' | 'exists';
    /** 本次创建的规则文件（项目相对路径，如 .iagent/rules/coding-rules.md） */
    ruleFilesCreated: string[];
    /** 规则文件重建/修复明细（旧名删除 / 新建 / 对齐 / 迁移保留 / 告警） */
    ruleRepair: RuleRepairReport;
    /** 生效 workflow 集来源：default（未配置用默认集）| user（用户显式配置） */
    workflowsSource: 'default' | 'user';
    /** 依赖注入自动补全的 workflow id（供输出提示） */
    injectedDeps: string[];
    /** 已装但不在生效集内的 iagent 产物（保留不删，供输出提示） */
    reconcileOrphans: ReconcileOrphans;
    /** 会话级权限载体（.claude/settings.json）的合并结果，每个目标工具一项 */
    permissionSettings: MergeResult[];
    /** 项目预扫描报告（--no-scan 时为空报告，未扫描、未写基线） */
    scanReport: ProjectScanReport;
    /** SQLite 跨变更索引初始化结果（index.db 创建状态） */
    indexDbStatus: 'created' | 'skipped-exists' | 'skipped-unavailable' | 'failed';
    /** 旧装机迁移报告（未发生迁移时 migrated 为 false） */
    legacyMigration: LegacyMigrationReport;
    /** 清理早期错误位置 .pi/commands/iagent/ 的结果 */
    misplacedCommands: MisplacedCleanupResult;
    /** legacy 下划线技能目录 → canonical kebab-case 的迁移报告 */
    skillIdMigration: SkillIdMigrationReport;
    /** OpenCode V2 项目级编排产物（未纳入 opencode 时为 null） */
    openCodeProject: OpenCodeProjectArtifactsResult | null;
    /** Pi 编排运行时状态（未纳入 pi 时为 null） */
    piRuntime: PiRuntimeStatus | null;
    /** Pi 原生 agent 定义写入结果（未纳入 pi 时为 null） */
    piNative: PiNativeWriteResult | null;
}

/** 读取当前包版本（供 metadata.generatedBy） */
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
 * 执行 init：生成全部技能与指令文件。
 *
 * @param projectRoot - 目标项目根目录
 * @param options - 命令选项
 */
export function runInit(projectRoot: string, options: InitOptions = {}): InitResult {
    // 0. 旧装机迁移（最先执行）：先于配置读取与产物生成，也先于 reconcile 扫描 ——
    //    旧产物须在被判定为「不在生效 workflows 配置中」之前清掉，否则会被误报为孤立产物。
    //    配置搬运结果随后的 readProjectConfig 可直接读到（用户既有的 workflow 选择与规则即刻生效）。
    const legacyMigration = runLegacyMigration(projectRoot, {
        homeDir: options.homeDir,
        skip: options.migrate === false,
    });

    // 0.1 清理早期版本错误生成到 .pi/commands/iagent/ 的产物（幂等，失败仅告警）
    const misplacedCommands = cleanupMisplacedCommands(projectRoot);

    // 0.2 legacy 下划线技能目录 → canonical kebab-case 迁移（须先于产物生成）
    const skillIdMigration = runSkillIdMigration(projectRoot);

    // 读项目配置，解析生效 workflow 集（未配置用默认集 + 依赖注入补全）
    const projectConfig = readProjectConfig(projectRoot);
    const tools = resolveActiveTools(options.tools, projectConfig?.tools, AI_TOOLS);
    const packageVersion = getPackageVersion();
    const skillsInstalled: string[] = [];
    const commandsInstalled: string[] = [];
    const skipped: string[] = [];
    const permissionSettings: MergeResult[] = [];

    const resolved = resolveWorkflows(projectConfig?.workflows);
    const workflowsSource = projectConfig && projectConfig.workflows.length > 0 ? 'user' : 'default';

    // 会话级放行条目：源自生效集技能模板的白名单（与 frontmatter 同源，避免第二份真源）
    const permissionEntries = buildPermissionEntries(
        getSkillTemplates(undefined, resolved.workflows).map((entry) => entry.template.allowedTools)
    );
    // 已知指令 id：正文引用按工具布局改写时使用（单一源，派生自注册表）
    const knownCommandIds = getKnownCommandIds();

    // Pi 原生编排：检测/安装 runtime → 写入 agent 定义 → 以定义已落盘重算 strict → 落诊断元数据
    // 顺序固定为「先落盘定义、后判 strict」，否则首次 init 永远先拿到 degraded（D6）。
    let piStatus: PiRuntimeStatus | null = null;
    let piNative: PiNativeWriteResult | null = null;
    if (tools.some((t) => t.value === 'pi')) {
        const stages = getSkillTemplates(undefined, resolved.workflows).map((entry) => ({
            workflowId: entry.commandId,
            description: entry.template.description,
        }));
        // 1) 运行时检测（缺失时安装并复检；此处不要求入口，避免入口缺失被误判为需要重装）
        const ensured = ensurePiRuntime({ projectRoot, runner: options.piRuntimeRunner });
        // 2) 原生 agent 定义（纯生成物，先落盘）
        piNative = writePiNativeAgents(projectRoot, stages);
        // 3) 以落盘后的定义重算 strict/degraded；合并安装尝试的诊断（安装失败时保留手动命令）
        const detected = detectPiRuntime({
            projectRoot,
            runner: options.piRuntimeRunner,
            requiredAgents: [PI_ORCHESTRATOR_AGENT_ID, ...stages.map((stage) => piAgentId(stage.workflowId))],
        });
        piStatus = {
            ...detected,
            reasons: [...new Set([...ensured.reasons, ...detected.reasons])],
        };
        try {
            ensureDir(path.join(projectRoot, '.iagent'));
            writeFile(path.join(projectRoot, PI_RUNTIME_METADATA_FILE), renderPiRuntimeMetadata(piStatus), {
                force: true,
            });
        } catch {
            // 元数据写入失败不阻断
        }
    }

    // 1. 技能生成（遍历所有工具，不依赖适配器）
    for (const tool of tools) {
        const skillsRoot = path.join(projectRoot, tool.skillsDir, TOOL_SKILLS_SUBDIR);
        ensureDir(skillsRoot);
        const negotiation = negotiationForHost(tool.value, piStatus?.mode);
        for (const { template } of getSkillTemplates(undefined, resolved.workflows)) {
            const base = rewriteCommandRefs(template.instructions, tool.commandsLayout, knownCommandIds);
            const instructions =
                negotiation === null
                    ? base
                    : adaptSkillContentForHost(base, negotiation, deriveCommandId(template.name));
            const generated = generateSkillContent({ ...template, instructions }, packageVersion, {
                hostId: tool.value,
            });
            const skillDir = path.join(skillsRoot, generated.dirName);
            const skillFile = path.join(skillDir, 'SKILL.md');
            if (pathExists(skillFile) && !options.force) {
                skipped.push(path.relative(projectRoot, skillFile));
                continue;
            }
            ensureDir(skillDir);
            writeFile(skillFile, generated.fileContent, { force: true });
            // 附加参考文件（references/*.md）
            writeSkillReferences(skillDir, generated.references);
            skillsInstalled.push(path.relative(projectRoot, skillFile));
        }

        // 会话级权限载体：每个工具独立合并，不受适配器影响；
        // sessionPermissions === false 的工具（OpenCode）不写惰性载体
        if (tool.sessionPermissions !== false) {
            try {
                permissionSettings.push(
                    mergePermissions(projectRoot, path.join(tool.skillsDir, SETTINGS_FILE), permissionEntries)
                );
            } catch (error) {
                permissionSettings.push({
                    path: path.join(tool.skillsDir, SETTINGS_FILE).replaceAll('\\', '/'),
                    state: 'preserved-invalid',
                    added: 0,
                    note: `写入失败（已跳过，不影响技能与指令安装）：${(error as Error).message}`,
                });
            }
        }
    }

    // 2. 指令生成（仅遍历有适配器的工具）
    for (const tool of tools) {
        const adapter = CommandAdapterRegistry.get(tool.value);
        if (!adapter) {
            continue;
        }
        const negotiation = negotiationForHost(tool.value, piStatus?.mode);
        for (const { template, id } of getCommandTemplates(undefined, resolved.workflows)) {
            const baseBody = rewriteCommandRefs(template.content, tool.commandsLayout, knownCommandIds);
            const content: CommandContent = {
                id,
                name: template.name,
                description: template.description,
                category: template.category,
                tags: template.tags,
                body:
                    negotiation === null
                        ? baseBody
                        : adaptSkillContentForHost(baseBody, negotiation, id),
                allowedTools: template.allowedTools,
                generatedBy: packageVersion,
                // OpenCode V2：指令在 iagent orchestrator 的 primary 会话中运行（非后台子会话）
                hostMeta:
                    tool.value === 'opencode'
                        ? { agent: ORCHESTRATOR_AGENT_ID, subagent: false }
                        : undefined,
            };
            const generated = generateCommand(content, adapter);
            const commandFile = path.join(projectRoot, generated.path);
            if (pathExists(commandFile) && !options.force) {
                skipped.push(path.relative(projectRoot, commandFile));
                continue;
            }
            writeFile(commandFile, generated.fileContent, { force: true });
            commandsInstalled.push(path.relative(projectRoot, commandFile));
        }
    }

    // 3. OpenCode V2 项目级编排产物（agents + permissions），仅显式纳入时生成
    let openCodeProject: OpenCodeProjectArtifactsResult | null = null;
    if (tools.some((t) => t.value === 'opencode')) {
        const stages = getSkillTemplates(undefined, resolved.workflows).map((entry) => ({
            workflowId: entry.commandId,
            description: entry.template.description,
        }));
        openCodeProject = writeOpenCodeProjectArtifacts(projectRoot, stages);
    }

    // 4. 项目级配置（.iagent/config.yaml + .iagent/rules/）：config.yaml 已存在则保留，
    //    规则文件转入重建/修复语义（缺失重建 / 旧名清理 / 人工域外对齐）。
    //    本轮 legacy 迁移产出的规则文件按 preservePaths 只登记不重写（下一轮起恢复对齐）。
    const config = ensureProjectConfig(projectRoot, { preservePaths: legacyMigration.movedRules });
    // 4.1 持久化本次生效工具集（选择可见可复现；后续不带 --tools 的命令据此保持稳定）
    writeToolsToConfig(projectRoot, tools.map((t) => t.value));

    // 5. reconcile 扫描：已装但不在生效集内的 iagent 产物（保留不删，供输出提示）
    const reconcileOrphans = scanReconcileOrphans(projectRoot, resolved.workflows);

    // 6. 项目预扫描（非阻断）：产出 .iagent/scan-baseline.json 供 project-init 技能参考；
    //    失败只记入报告的 failures，不影响安装结果；--no-scan 时整体跳过
    const scanReport = options.scan === false ? createEmptyScanReport() : scanProject(projectRoot);

    // 7. SQLite 跨变更索引初始化（非阻断）：创建 openspec/changes/archive/.iagent/index.db；
    //    sqlite3 CLI 不可用时跳过；数据库已存在时跳过
    let indexDbStatus: 'created' | 'skipped-exists' | 'skipped-unavailable' | 'failed' = 'skipped-unavailable';
    const openspecDir = path.join(projectRoot, 'openspec');
    if (fs.existsSync(openspecDir)) {
        if (!isSqlite3Available()) {
            indexDbStatus = 'skipped-unavailable';
        } else {
            const dbPath = resolveIndexDb(openspecDir);
            if (fs.existsSync(dbPath)) {
                indexDbStatus = 'skipped-exists';
            } else {
                const dbResult = initDatabase(openspecDir);
                indexDbStatus = dbResult.success ? 'created' : 'failed';
            }
        }
    }

    return {
        projectRoot,
        tools: tools.map((t) => t.value),
        skillsInstalled,
        commandsInstalled,
        skipped,
        configState: config.state,
        ruleFilesCreated: config.ruleFiles,
        ruleRepair: config.ruleRepair,
        workflowsSource,
        injectedDeps: resolved.injected,
        reconcileOrphans,
        permissionSettings,
        scanReport,
        indexDbStatus,
        legacyMigration,
        misplacedCommands,
        skillIdMigration,
        openCodeProject,
        piRuntime: piStatus,
        piNative,
    };
}
