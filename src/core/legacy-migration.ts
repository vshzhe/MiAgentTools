/**
 * 旧装机一次性迁移：品牌改名（venus → iagent）前的产物与配置搬运。
 *
 * 触发点是 iagent init / iagent update 入口 —— 迁移是幂等的一次性动作，无独立命令
 * （用户习惯直接敲 init/update，独立命令会被跳过，恰好留下本能力要消除的孤儿产物）。
 *
 * 三件事：
 *   1. 配置搬运：.venus/ → .iagent/，rules 列表项与 rules/ 文件名按类型映射成对改名，
 *      workflows 列表项按旧 → 新 workflow id 映射改名；context、注释行与未知段逐字保留
 *   2. 产物清理：各工具目录下旧前缀技能与旧命名空间指令一律删除（含手工修改过的），
 *      非旧前缀产物完全不触碰
 *   3. 旧版品牌产物清理：旧补全脚本与 rc/profile 旧标记块、仓内旧 sidecar 目录与旧索引库
 *
 * 幂等依据是「旧物是否存在」这一客观事实，不额外维护状态文件：无旧物即静默跳过、不输出报告。
 *
 * 旧标识 token（venus_ / .venus / commands/venus ≠ 产品领域名 Venus4A）的唯一代码落点即本模块，
 * 见 agent-tool-identity#旧标识零残留 的例外条款（例外仅限旧新映射表与遗留迁移代码）。
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AI_TOOLS, SKILL_TYPES, TOOL_SKILLS_SUBDIR, type SkillType } from './config.js';
import {
    CONFIG_FILE_NAME,
    IAGENT_DIR_NAME,
    RULES_DIR_NAME,
    findListSectionEnd,
    readListSection,
    replaceConfigSectionInRaw,
    ruleFileNameFor,
} from './project-config.js';
import { SCAN_BASELINE_FILE } from './project-scan.js';
import {
    bashRcPath,
    powerShellProfileDir,
    powerShellRcPath,
    hasPairedMarkerBlock,
    removeMarkerBlock,
    type CompletionMarkers,
} from './shell-completion.js';

// ── 旧标识常量 ────────────────────────────────────────────────────

/** 旧配置目录名（项目根下，品牌改名前的项目配置目录） */
export const LEGACY_CONFIG_DIR_NAME = '.venus';

/** 旧技能名前缀 */
export const LEGACY_SKILL_PREFIX = 'venus_';

/** 旧工具指令命名空间子目录名 */
export const LEGACY_COMMANDS_SUBDIR = 'venus';

/**
 * 旧装机各工具的旧指令根目录（项目相对）。
 *
 * 与当前 `AIToolOption.commandsDir` 解耦：Pi 的当前指令目录已从 `.pi/commands` 改为
 * `.pi/prompts`，但旧 venus 指令仍在 `.pi/commands` 下，故这里显式列出旧值。
 * 空字符串表示该工具无指令产物（skills-only，如 codex）。
 */
export const LEGACY_COMMAND_DIRS: Readonly<Record<string, string>> = {
    claude: '.claude/commands',
    pi: '.pi/commands',
    codex: '',
    // OpenCode 无旧 venus 品牌产物：显式空值使遍历键集完整且不误删 .opencode 下内容
    opencode: '',
};

/** 旧 bash 补全脚本文件名（用户主目录下） */
export const LEGACY_BASH_COMPLETION_FILE = '.venus-completion.sh';

/** 旧 PowerShell 补全脚本文件名（profile 目录下） */
export const LEGACY_POWERSHELL_COMPLETION_FILE = 'VenusCompletion.ps1';

/**
 * 旧补全标记块的起止标记。
 *
 * 清理尤为关键：旧标记块不被新工具识别（卸载时匹配不到），却仍会 source 旧脚本，
 * 导致补全项重复与冲突。
 */
export const LEGACY_COMPLETION_MARKERS: CompletionMarkers = {
    start: '# VENUS-COMPLETION:START',
    end: '# VENUS-COMPLETION:END',
};

/** 旧变更目录 sidecar 子目录名（@deprecated 的 manifest/decisions/capabilities 布局） */
export const LEGACY_SIDECAR_DIR_NAME = '.venus';

/** 旧跨变更索引目录（相对 openspec 根），其下的旧索引库随目录删除 */
export const LEGACY_INDEX_DIR_RELATIVE_PATH = 'changes/archive/.venus';

/**
 * 旧索引库文件名（旧品牌目录下的历史跨变更索引，随旧品牌目录一并清理）。
 *
 * 边界：清理对象是 `openspec/changes/archive/.venus/`（旧品牌缓存目录），
 * **不是**用户当前目录里的历史索引库 —— 后者不是本工具的产物，
 * `iagent init` / `iagent update` MUST NOT 删除或改写它（跨变更索引能力已退役）。
 */
export const LEGACY_INDEX_DB_FILE = 'index.db';

/**
 * 旧类型 id → 新类型 id。
 *
 * 由 SKILL_TYPES 派生而非另立类型清单：品牌改名前的类型 id 即新 id 加 `tr_` 前缀，
 * 唯一例外是 `spec`（该类型原本就无 tr 前缀，改名前后同为 spec）。
 */
function legacyTypeId(type: SkillType): string {
    return type === 'spec' ? 'spec' : `tr_${type}`;
}

export const LEGACY_TYPE_RENAME: Readonly<Record<string, SkillType>> = Object.fromEntries(
    SKILL_TYPES.map((type) => [legacyTypeId(type.id), type.id])
);

/**
 * 旧指令 id（即旧 workflow id）→ 新指令 id 的一对一映射（27 项）。
 *
 * 本表是 agent-tool-identity 能力「旧新标识映射表」需求在代码中的**唯一真源**
 * （该需求的其余位置 MUST NOT 再立第二份映射）。映射内容即 27 项技能名的旧→新
 * 一对一映射经「去 venus_ 前缀 + 下划线转连字符」派生后的指令 id 形式。
 *
 * 用途仅限于 config.yaml 的 workflows 列表改名：旧 id 无法匹配任何技能模板的
 * commandId，不改名则迁移后 init 会装 0 个技能。旧产物的**删除**不依赖本表 ——
 * 按旧前缀整体清理（前缀匹配还能覆盖用户用 generate 生成的旧产物）。
 */
export const LEGACY_WORKFLOW_ID_MAP: Readonly<Record<string, string>> = {
    'tr-init-project': 'project-init',
    // 引导式全流程（genfull）已并入 workflow；两者均映射到 workflow
    'tr-impl-workflow': 'workflow',
    'tr-impl-genfull': 'workflow',
    'tr-impl-auto-workflow': 'auto-workflow',
    'tr-impl-debug': 'debug',
    'tr-impl-migration-check': 'migration-check',
    'tr-impl-auto-migration': 'migration',
    'tr-impl-review-proposal': 'proposal-review',
    'tr-test-generate': 'test',
    'tr-commit-change': 'commit',
    'tr-commit-push': 'svn-commit',
    'tr-review-code': 'review',
    'tr-docs-feature-doc': 'feature-doc',
    'tr-docs-requirement-doc': 'requirement-doc',
    'spec-explore': 'spec-explore',
    'spec-propose': 'spec-propose',
    'spec-apply': 'spec-apply',
    'spec-archive': 'spec-archive',
    'spec-bulk-archive': 'spec-bulk-archive',
    'spec-verify': 'spec-verify',
    'spec-verify-proposal': 'spec-verify-proposal',
};

/** 旧 workflow id 改名（表内无此项时原样返回，不丢项） */
export function renameLegacyWorkflowId(id: string): string {
    return LEGACY_WORKFLOW_ID_MAP[id] ?? id;
}

// ── 检测结果 ──────────────────────────────────────────────────────

/** 单个旧技能产物 */
export interface LegacySkillArtifact {
    /** 目标工具 id（claude / pi / codex） */
    tool: string;
    /** 技能目录名（以旧技能前缀开头） */
    dirName: string;
    /** 项目相对路径（正斜杠归一化） */
    path: string;
    /** 是否为符号链接（删除时只移除链接本身，不跟随） */
    symlink: boolean;
}

/** 单个旧指令产物 */
export interface LegacyCommandArtifact {
    tool: string;
    /** 项目相对路径（正斜杠归一化） */
    path: string;
}

/** 旧版品牌命名的磁盘产物（技能与配置之外的第四类：补全、sidecar、索引库） */
export interface LegacyBrandArtifacts {
    /** 旧补全脚本（用户主目录下，绝对路径），不存在为 null */
    bashScript: string | null;
    /** 旧补全脚本（PowerShell profile 目录下，绝对路径），不存在为 null */
    powerShellScript: string | null;
    /** 含旧补全标记块的 rc/profile 文件及其成对性（不成对时 MUST NOT 改动文件） */
    rcFiles: { path: string; paired: boolean }[];
    /** 仓内变更目录下的旧 sidecar 子目录（项目相对路径） */
    sidecarDirs: string[];
    /** 仓内旧跨变更索引库（项目相对路径），不存在为 null */
    indexDb: string | null;
}

/** 遗留产物检测结果 */
export interface LegacyDetection {
    /** 旧配置目录（项目相对路径），不存在为 null */
    configDir: string | null;
    /** 旧配置目录下的 config.yaml（项目相对路径），不存在为 null */
    configFile: string | null;
    /** 各工具目录下的旧前缀技能目录 */
    skills: LegacySkillArtifact[];
    /** 各工具指令目录下旧命名空间子目录内的指令文件 */
    commands: LegacyCommandArtifact[];
    /** 旧版品牌产物 */
    brand: LegacyBrandArtifacts;
}

/** 旧补全脚本 / 标记块的落盘位置（主目录与仓内目录两处，按 homeDir 解析） */
export interface LegacyBrandPaths {
    bashScript: string;
    powerShellScript: string;
    rcFiles: string[];
}

/** 解析旧版品牌产物的落盘位置（主目录侧） */
export function resolveLegacyBrandPaths(homeDir: string): LegacyBrandPaths {
    return {
        bashScript: path.join(homeDir, LEGACY_BASH_COMPLETION_FILE),
        powerShellScript: path.join(powerShellProfileDir(homeDir), LEGACY_POWERSHELL_COMPLETION_FILE),
        rcFiles: [bashRcPath(homeDir), powerShellRcPath(homeDir)],
    };
}

/** 项目相对路径（正斜杠归一化，供报告输出与跨平台断言） */
function toPosix(relativePath: string): string {
    return relativePath.replaceAll('\\', '/');
}

/** 目录下的直接子项（目录与符号链接，目录不存在返回空数组） */
function listDirEntries(dirPath: string): fs.Dirent[] {
    if (!fs.existsSync(dirPath)) {
        return [];
    }
    return fs.readdirSync(dirPath, { withFileTypes: true });
}

/** 旧跨变更索引目录的绝对路径（常量相对 openspec 根） */
function legacyIndexDirPath(projectRoot: string): string {
    return path.join(projectRoot, 'openspec', LEGACY_INDEX_DIR_RELATIVE_PATH);
}

/** 旧变更目录下的 sidecar 子目录（含归档变更；archive 自身是索引目录不是变更，故排除） */
function detectLegacySidecarDirs(projectRoot: string): string[] {
    const changesDir = path.join(projectRoot, 'openspec', 'changes');
    const archiveDir = path.join(changesDir, 'archive');
    const found: string[] = [];
    for (const parent of [changesDir, archiveDir]) {
        for (const entry of listDirEntries(parent)) {
            if (!entry.isDirectory()) {
                continue;
            }
            const changeDir = path.join(parent, entry.name);
            if (path.resolve(changeDir) === path.resolve(archiveDir)) {
                continue;
            }
            const sidecar = path.join(changeDir, LEGACY_SIDECAR_DIR_NAME);
            if (fs.existsSync(sidecar)) {
                found.push(toPosix(path.relative(projectRoot, sidecar)));
            }
        }
    }
    return found;
}

/**
 * 检测旧版标识产物：旧配置目录、各工具目录下旧前缀技能目录、各工具指令目录下旧命名空间
 * 子目录内的指令文件，以及旧版品牌命名的磁盘产物（补全脚本与 rc 标记块、仓内旧 sidecar
 * 目录与旧索引库）。
 *
 * 只对**已存在**的路径做读取（主目录与 rc 文件均先判存在性）——无旧产物时不得读写用户主目录。
 *
 * @param projectRoot - 项目根目录
 * @param options - homeDir：用户主目录（默认 os.homedir()）
 */
export function detectLegacyArtifacts(
    projectRoot: string,
    options: { homeDir?: string } = {}
): LegacyDetection {
    const legacyConfigDir = path.join(projectRoot, LEGACY_CONFIG_DIR_NAME);
    const legacyConfigFile = path.join(legacyConfigDir, 'config.yaml');
    const configDirExists = fs.existsSync(legacyConfigDir);

    const skills: LegacySkillArtifact[] = [];
    const commands: LegacyCommandArtifact[] = [];

    for (const tool of AI_TOOLS) {
        // 技能：旧前缀目录（含指向目录的符号链接 —— 链接本身也是旧产物，须被清理）
        const skillsRoot = path.join(projectRoot, tool.skillsDir, TOOL_SKILLS_SUBDIR);
        for (const entry of listDirEntries(skillsRoot)) {
            if (!entry.name.startsWith(LEGACY_SKILL_PREFIX)) {
                continue;
            }
            if (!entry.isDirectory() && !entry.isSymbolicLink()) {
                continue;
            }
            skills.push({
                tool: tool.value,
                dirName: entry.name,
                path: toPosix(path.relative(projectRoot, path.join(skillsRoot, entry.name))),
                symlink: entry.isSymbolicLink(),
            });
        }

        // 指令：旧命名空间子目录下的 .md。
        // 旧指令根显式取自 LEGACY_COMMAND_DIRS（与当前 commandsDir 解耦）：
        // Pi 的当前目录已改为 .pi/prompts，旧 venus 指令则仍在 .pi/commands 下。
        // 空目录字符串表示 skills-only 工具（如 codex）无指令产物，整体跳过。
        const legacyDir = LEGACY_COMMAND_DIRS[tool.value] ?? '';
        if (legacyDir === '') {
            continue;
        }
        const legacyCommandsDir = path.join(projectRoot, legacyDir, LEGACY_COMMANDS_SUBDIR);
        for (const entry of listDirEntries(legacyCommandsDir)) {
            if (!entry.isFile() || !entry.name.endsWith('.md')) {
                continue;
            }
            commands.push({
                tool: tool.value,
                path: toPosix(path.relative(projectRoot, path.join(legacyCommandsDir, entry.name))),
            });
        }
    }

    // 旧版品牌产物：主目录侧的补全脚本与 rc 标记块
    const brandPaths = resolveLegacyBrandPaths(options.homeDir ?? os.homedir());
    const rcFiles: { path: string; paired: boolean }[] = [];
    for (const rcPath of brandPaths.rcFiles) {
        if (!fs.existsSync(rcPath)) {
            continue;
        }
        const content = fs.readFileSync(rcPath, 'utf8');
        if (!content.includes(LEGACY_COMPLETION_MARKERS.start)) {
            continue;
        }
        rcFiles.push({ path: rcPath, paired: hasPairedMarkerBlock(content, LEGACY_COMPLETION_MARKERS) });
    }

    // 旧版品牌产物：仓内目录侧的 sidecar 与索引库
    const legacyIndexDb = path.join(legacyIndexDirPath(projectRoot), LEGACY_INDEX_DB_FILE);

    return {
        configDir: configDirExists ? toPosix(path.relative(projectRoot, legacyConfigDir)) : null,
        configFile:
            configDirExists && fs.existsSync(legacyConfigFile)
                ? toPosix(path.relative(projectRoot, legacyConfigFile))
                : null,
        skills,
        commands,
        brand: {
            bashScript: fs.existsSync(brandPaths.bashScript) ? brandPaths.bashScript : null,
            powerShellScript: fs.existsSync(brandPaths.powerShellScript)
                ? brandPaths.powerShellScript
                : null,
            rcFiles,
            sidecarDirs: detectLegacySidecarDirs(projectRoot),
            indexDb: fs.existsSync(legacyIndexDb)
                ? toPosix(path.relative(projectRoot, legacyIndexDb))
                : null,
        },
    };
}

/** 是否存在任意旧物（幂等判定依据：无旧物即静默跳过迁移） */
export function hasLegacyArtifacts(detection: LegacyDetection): boolean {
    const { brand } = detection;
    return (
        detection.configDir !== null ||
        detection.skills.length > 0 ||
        detection.commands.length > 0 ||
        brand.bashScript !== null ||
        brand.powerShellScript !== null ||
        brand.rcFiles.length > 0 ||
        brand.sidecarDirs.length > 0 ||
        brand.indexDb !== null
    );
}

// ── 迁移报告 ──────────────────────────────────────────────────────

/** 迁移报告（三类明细 + 告警/提示；migrated 为 false 时调用方不输出报告段落） */
export interface LegacyMigrationReport {
    /** 是否检测到旧物并执行了迁移 */
    migrated: boolean;
    /** 搬运项明细（配置段与规则文件等） */
    moved: string[];
    /**
     * 本轮写入的规则文件项目相对 posix 路径（机读字段）。
     *
     * 供 init/update 的规则重建/修复步骤作为 `preservePaths` 传入，
     * 使本轮迁移产物跳过常量对齐（只登记不重写）——避免用户既有规则内容被同轮改写。
     */
    movedRules: string[];
    /** 删除项明细（旧技能与指令、旧版品牌产物） */
    removed: string[];
    /** 跳过项明细（已迁移、越界拒绝、标记块不成对、目标已存在等，含原因） */
    skipped: string[];
    /** 告警（手工修改可能已丢失、配置未迁移、目录保留未删等） */
    warnings: string[];
    /** 中性提示（如旧索引库已删且跨变更索引能力已退役） */
    hints: string[];
}

/** 空报告（无旧物时返回，调用方据 migrated:false 静默跳过输出） */
function emptyReport(): LegacyMigrationReport {
    return { migrated: false, moved: [], movedRules: [], removed: [], skipped: [], warnings: [], hints: [] };
}

// ── 迁移入口 ──────────────────────────────────────────────────────

/** 迁移选项 */
export interface LegacyMigrationOptions {
    /** 用户主目录（补全产物所在；默认 os.homedir()，测试与自定义环境可注入） */
    homeDir?: string;
    /** 跳过迁移（CLI --no-migrate）；跳过时不检测、不搬运、不删除，也不输出报告 */
    skip?: boolean;
}

/**
 * 执行旧装机迁移。
 *
 * 幂等判定依据是「旧物是否存在」这一客观事实（不额外维护状态文件）：无旧物时静默返回
 * `migrated: false`，调用方据此不输出报告段落，二次执行无任何副作用。
 *
 * 整体以容错包裹：任何异常降级为报告告警，MUST NOT 阻断 init/update 主流程。
 * 配置搬运单独再包一层 —— 失败时保留原物、不写入残缺新配置，但产物清理照常进行。
 *
 * @param projectRoot - 项目根目录
 * @param options - 迁移选项
 */
export function runLegacyMigration(
    projectRoot: string,
    options: LegacyMigrationOptions = {}
): LegacyMigrationReport {
    const report = emptyReport();
    if (options.skip) {
        return report;
    }
    try {
        const detection = detectLegacyArtifacts(projectRoot, { homeDir: options.homeDir });
        if (!hasLegacyArtifacts(detection)) {
            return report;
        }
        report.migrated = true;
        try {
            migrateLegacyConfig(projectRoot, detection, report);
        } catch (error) {
            report.warnings.push(
                `旧配置未迁移（${LEGACY_CONFIG_DIR_NAME}/ 原物已保留，可修复后重跑）：${(error as Error).message}`
            );
        }
        cleanLegacyArtifacts(projectRoot, detection, report);
        cleanLegacyBrandArtifacts(projectRoot, detection, report);
    } catch (error) {
        report.migrated = true;
        report.warnings.push(`旧装机迁移未完成（已降级为告警，不影响主流程）：${(error as Error).message}`);
    }
    return report;
}

/**
 * 渲染迁移报告（搬运项 / 删除项 / 跳过项三段计数与明细 + 告警与提示）。
 *
 * 未发生迁移时返回空字符串 —— 对全新项目与已升级项目不产生噪声。
 */
export function renderLegacyMigrationReport(report: LegacyMigrationReport): string {
    if (!report.migrated) {
        return '';
    }
    const lines: string[] = ['旧装机迁移（品牌改名 venus → iagent 的一次性升级处理）：'];
    lines.push(`  搬运项：${report.moved.length} 项`);
    for (const item of report.moved) {
        lines.push(`    → ${item}`);
    }
    lines.push(`  删除项：${report.removed.length} 项`);
    for (const item of report.removed) {
        lines.push(`    - ${item}`);
    }
    lines.push(`  跳过项：${report.skipped.length} 项`);
    for (const item of report.skipped) {
        lines.push(`    · ${item}`);
    }
    for (const hint of report.hints) {
        lines.push(`  i ${hint}`);
    }
    for (const warning of report.warnings) {
        lines.push(`  ! ${warning}`);
    }
    return lines.join('\n');
}

// ── 配置搬运 ──────────────────────────────────────────────────────

/** 渲染缩进列表段（段头 + `- item` 体，逐行压入 out） */
function renderListSection(out: string[], head: string, items: readonly string[]): void {
    out.push(head);
    for (const item of items) {
        out.push(`  - ${item}`);
    }
}

/**
 * 搬运旧配置目录的 config.yaml 到新配置目录。
 *
 * rules 段按类型改名映射改写、workflows 段按旧→新 workflow id 映射改写；
 * context 多行块、注释行、未知段与自定义字段（如 auto_package.runtime_dir）
 * 逐字保留 —— 走逐行段替换，MUST NOT 重新序列化 YAML。
 * 规则文件按同一类型映射改名、**落点经类型→语义名映射直达**（`tr_impl.md` →
 * `coding-rules.md`）随目录搬移，内容逐字保留（不改写正文、不注入人工域标记）；
 * 本轮写入的规则文件路径登记到 `movedRules` 供修复步骤跳过同轮常量对齐。扫描基线随目录搬移。
 *
 * 新配置目录的 config.yaml 已存在时 MUST NOT 覆盖其内容（与 ensureProjectConfig 的
 * 「已存在则保留」语义一致），旧配置目录同时保留供用户手工比对合并。
 *
 * 全部文件内容在任何写入之前先读入内存，故解析/读取失败时不会落下内容残缺的新配置
 * （异常由 [[runLegacyMigration]] 容错为告警）。
 *
 * @param projectRoot - 项目根目录
 * @param detection - 检测结果
 * @param report - 迁移报告（就地追加明细）
 */
function migrateLegacyConfig(
    projectRoot: string,
    detection: LegacyDetection,
    report: LegacyMigrationReport
): void {
    const legacyConfigDir = detection.configDir;
    if (legacyConfigDir === null) {
        return;
    }
    const newConfigRelPath = toPosix(CONFIG_FILE_NAME);
    if (fs.existsSync(path.join(projectRoot, CONFIG_FILE_NAME))) {
        report.skipped.push(`${legacyConfigDir}/（${newConfigRelPath} 已存在，未覆盖）`);
        report.warnings.push(
            `旧配置未搬运：${newConfigRelPath} 已存在，已保留既有内容；` +
                `${legacyConfigDir}/ 亦保留不删，请手工比对合并其中的 context 与 rules`
        );
        return;
    }
    if (detection.configFile === null) {
        report.skipped.push(`${legacyConfigDir}/（无 config.yaml，无可搬运的配置段）`);
        return;
    }

    const legacyDirPath = path.join(projectRoot, legacyConfigDir);
    const rulesSubdir = path.basename(RULES_DIR_NAME);
    const legacyRulesDir = path.join(legacyDirPath, rulesSubdir);
    const legacyBaselinePath = path.join(legacyDirPath, SCAN_BASELINE_FILE);

    // 1. 先把新 config 内容算好（未命中段不改写，不凭空补段）
    const raw = fs.readFileSync(path.join(projectRoot, detection.configFile), 'utf8');
    const renamedRules = readListSection(raw, /^rules:/).map((type) => LEGACY_TYPE_RENAME[type] ?? type);
    const renamedWorkflows = readListSection(raw, /^workflows:/).map(renameLegacyWorkflowId);
    let content = replaceConfigSectionInRaw(
        raw,
        /^rules:/,
        findListSectionEnd,
        (out) => renderListSection(out, 'rules:', renamedRules),
        { appendWhenMissing: false }
    ).content;
    content = replaceConfigSectionInRaw(
        content,
        /^workflows:/,
        findListSectionEnd,
        (out) => renderListSection(out, 'workflows:', renamedWorkflows),
        { appendWhenMissing: false }
    ).content;

    // 2. 再把待搬文件内容全部读入内存；同时收集未处理条目（决定旧目录能否删除）
    const pendingRules: { legacyName: string; name: string; content: string }[] = [];
    const unhandled: string[] = [];
    if (fs.existsSync(legacyRulesDir)) {
        for (const entry of fs.readdirSync(legacyRulesDir, { withFileTypes: true })) {
            if (!entry.isFile()) {
                unhandled.push(`${rulesSubdir}/${entry.name}`);
                continue;
            }
            const ext = path.extname(entry.name);
            const renamed = LEGACY_TYPE_RENAME[path.basename(entry.name, ext)];
            pendingRules.push({
                legacyName: entry.name,
                // 落点经类型→语义名映射直达（tr_impl.md → coding-rules.md），正文逐字保留
                name: ext === '.md' && renamed !== undefined ? ruleFileNameFor(renamed) : entry.name,
                content: fs.readFileSync(path.join(legacyRulesDir, entry.name), 'utf8'),
            });
        }
    }
    const pendingBaseline = fs.existsSync(legacyBaselinePath)
        ? fs.readFileSync(legacyBaselinePath, 'utf8')
        : undefined;
    for (const name of fs.readdirSync(legacyDirPath)) {
        if (name !== 'config.yaml' && name !== rulesSubdir && name !== SCAN_BASELINE_FILE) {
            unhandled.push(name);
        }
    }

    // 3. 落盘（config.yaml 先写，作为「已搬运」的可判定状态）
    fs.mkdirSync(path.join(projectRoot, IAGENT_DIR_NAME), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, CONFIG_FILE_NAME), content, 'utf8');
    report.moved.push(`${legacyConfigDir}/config.yaml → ${newConfigRelPath}`);

    if (pendingRules.length > 0) {
        const newRulesDir = path.join(projectRoot, RULES_DIR_NAME);
        fs.mkdirSync(newRulesDir, { recursive: true });
        for (const rule of pendingRules) {
            const targetPath = path.join(newRulesDir, rule.name);
            const targetRel = toPosix(path.relative(projectRoot, targetPath));
            if (fs.existsSync(targetPath)) {
                report.skipped.push(`${targetRel}（已存在，未覆盖）`);
                report.warnings.push(
                    `规则文件未搬运：${targetRel} 已存在，旧文件保留在 ${legacyConfigDir}/${rulesSubdir}/ 中`
                );
                unhandled.push(`${rulesSubdir}/${rule.legacyName}`);
                continue;
            }
            fs.writeFileSync(targetPath, rule.content, 'utf8');
            report.moved.push(`${legacyConfigDir}/${rulesSubdir}/${rule.legacyName} → ${targetRel}`);
            report.movedRules.push(targetRel);
        }
    }

    if (pendingBaseline !== undefined) {
        const baselineRel = toPosix(path.join(IAGENT_DIR_NAME, SCAN_BASELINE_FILE));
        if (fs.existsSync(path.join(projectRoot, baselineRel))) {
            report.skipped.push(`${baselineRel}（已存在，未覆盖）`);
        } else {
            fs.writeFileSync(path.join(projectRoot, baselineRel), pendingBaseline, 'utf8');
            report.moved.push(`${legacyConfigDir}/${SCAN_BASELINE_FILE} → ${baselineRel}`);
        }
    }

    // 4. 旧配置目录仅在内容全部处理完时删除，否则保留供用户手工处理
    if (unhandled.length === 0) {
        fs.rmSync(legacyDirPath, { recursive: true, force: true });
        report.removed.push(`${legacyConfigDir}/（内容已全部搬运）`);
    } else {
        report.skipped.push(`${legacyConfigDir}/（有 ${unhandled.length} 项未处理，目录保留）`);
        report.warnings.push(
            `旧配置目录保留未删（未处理项：${unhandled.join('、')}）；` +
                `请人工确认后自行删除 ${legacyConfigDir}/`
        );
    }
}

// ── 旧产物清理 ────────────────────────────────────────────────────

/**
 * 校验删除目标位于给定根目录**之下**（根目录本身不算）。
 *
 * 迁移是自动执行的删除动作，触发时机不由用户主动选择，故边界必须由代码强制：
 * `path.join(projectRoot, '', 'venus')` 会得到项目根下的同名目录，一旦删除即不可逆事故。
 *
 * 导出以便直接验证边界契约 —— 检测只产出子项名，正常路径下不会越界，
 * 故该守卫无法通过端到端路径触发（这正是它存在的意义）。
 */
export function isWithinDir(root: string, target: string): boolean {
    const rel = path.relative(root, target);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** 删除旧产物：符号链接只移除链接本身（不跟随，避免删掉链接目标的内容） */
function removeLegacyPath(targetPath: string, isSymlink: boolean): void {
    if (isSymlink) {
        fs.unlinkSync(targetPath);
        return;
    }
    fs.rmSync(targetPath, { recursive: true, force: true });
}

/**
 * 清理各工具目录下的旧前缀技能与旧命名空间指令。
 *
 * 一律删除，不区分是否被用户手工修改过（丢失风险以报告告警对冲，见 design D2）；
 * 非旧前缀产物完全不触碰。安全边界：空 commandsDir 的工具跳过指令侧清理、
 * 删除前校验目标位于对应子目录之下、不跟随符号链接、清理后移除遗留的空目录。
 *
 * @param projectRoot - 项目根目录
 * @param detection - 检测结果
 * @param report - 迁移报告（就地追加明细）
 */
function cleanLegacyArtifacts(
    projectRoot: string,
    detection: LegacyDetection,
    report: LegacyMigrationReport
): void {
    let removedSkills = 0;
    let removedCommands = 0;

    for (const skill of detection.skills) {
        const tool = AI_TOOLS.find((t) => t.value === skill.tool);
        if (!tool) {
            continue;
        }
        const skillsRoot = path.join(projectRoot, tool.skillsDir, TOOL_SKILLS_SUBDIR);
        const target = path.join(projectRoot, skill.path);
        if (!isWithinDir(skillsRoot, target)) {
            report.skipped.push(`${skill.path}（越界：不在 ${tool.skillsDir}/${TOOL_SKILLS_SUBDIR} 之下，拒绝删除）`);
            continue;
        }
        removeLegacyPath(target, skill.symlink);
        report.removed.push(skill.symlink ? `${skill.path}/（符号链接，仅移除链接本身）` : `${skill.path}/`);
        removedSkills++;
    }

    // 指令：按工具聚合，删完后移除遗留的空命名空间目录
    for (const tool of AI_TOOLS) {
        const legacyDir = LEGACY_COMMAND_DIRS[tool.value] ?? '';
        if (legacyDir === '') {
            // skills-only 模式（codex）无指令产物：path.join 会退化为项目根下的同名目录，
            // 故整体跳过，不做任何拼接
            continue;
        }
        const commandsRoot = path.join(projectRoot, legacyDir);
        const legacyCommandsDir = path.join(commandsRoot, LEGACY_COMMANDS_SUBDIR);
        const files = detection.commands.filter((c) => c.tool === tool.value);
        for (const command of files) {
            const target = path.join(projectRoot, command.path);
            if (!isWithinDir(commandsRoot, target)) {
                report.skipped.push(`${command.path}（越界：不在 ${legacyDir} 之下，拒绝删除）`);
                continue;
            }
            fs.unlinkSync(target);
            report.removed.push(command.path);
            removedCommands++;
        }
        if (!fs.existsSync(legacyCommandsDir)) {
            continue;
        }
        if (fs.readdirSync(legacyCommandsDir).length === 0) {
            fs.rmdirSync(legacyCommandsDir);
            report.removed.push(`${toPosix(path.relative(projectRoot, legacyCommandsDir))}/（空目录）`);
        } else {
            report.skipped.push(
                `${toPosix(path.relative(projectRoot, legacyCommandsDir))}/（含非指令文件，目录保留）`
            );
        }
    }

    if (removedSkills > 0 || removedCommands > 0) {
        report.warnings.push(
            `已删除 ${removedSkills} 个旧技能与 ${removedCommands} 条旧指令：` +
                `其中可能包含你手工修改过的内容，已随删除丢失（新口径技能由本次 init/update 重新生成）`
        );
    }
}

// ── 旧版品牌产物清理 ──────────────────────────────────────────────

/** 主目录下某个文件的简短展示名（`~/xxx` 形式，避免报告完整暴露用户目录结构） */
function homeDisplayPath(filePath: string): string {
    return `~/${path.basename(filePath)}`;
}

/**
 * 清理旧版品牌命名的磁盘产物。
 *
 * rc/profile 的标记块清理 MUST 以旧起止标记**成对出现**为前提：不成对时记入跳过项并告警，
 * MUST NOT 改动文件（避免误删用户内容）。
 * 旧品牌索引目录（`openspec/changes/archive/.venus/`）删除后只给中性提示：
 * 跨变更索引能力已退役，提示 MUST NOT 指向已删除的 CLI 命令。
 *
 * @param projectRoot - 项目根目录
 * @param detection - 检测结果
 * @param report - 迁移报告（就地追加明细）
 */
function cleanLegacyBrandArtifacts(
    projectRoot: string,
    detection: LegacyDetection,
    report: LegacyMigrationReport
): void {
    const { brand } = detection;

    for (const scriptPath of [brand.bashScript, brand.powerShellScript]) {
        if (scriptPath === null) {
            continue;
        }
        fs.rmSync(scriptPath, { force: true });
        report.removed.push(`${homeDisplayPath(scriptPath)}（旧版补全脚本）`);
    }

    for (const rcFile of brand.rcFiles) {
        if (!rcFile.paired) {
            report.skipped.push(`${homeDisplayPath(rcFile.path)}（旧标记块不成对，文件未改动）`);
            report.warnings.push(
                `补全标记块不成对：${homeDisplayPath(rcFile.path)} 未被修改。` +
                    `请手工检查其中的 ${LEGACY_COMPLETION_MARKERS.start} / ${LEGACY_COMPLETION_MARKERS.end} ` +
                    `—— 旧标记块会继续 source 旧补全脚本，造成补全项重复`
            );
            continue;
        }
        const content = fs.readFileSync(rcFile.path, 'utf8');
        fs.writeFileSync(rcFile.path, removeMarkerBlock(content, LEGACY_COMPLETION_MARKERS), 'utf8');
        report.removed.push(`${homeDisplayPath(rcFile.path)} 中的旧补全标记块`);
    }

    for (const sidecarDir of brand.sidecarDirs) {
        fs.rmSync(path.join(projectRoot, sidecarDir), { recursive: true, force: true });
        report.removed.push(`${sidecarDir}/（旧版 sidecar 目录）`);
    }

    if (brand.indexDb !== null) {
        fs.rmSync(legacyIndexDirPath(projectRoot), { recursive: true, force: true });
        report.removed.push(`${brand.indexDb}（旧跨变更索引库）`);
        report.hints.push('旧跨变更索引已删除（索引能力已退役）');
    }
}
