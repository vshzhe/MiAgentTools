/**
 * 旧装机迁移（legacy-migration）测试。
 *
 * 覆盖：三类旧物检测、类型与 workflow id 映射、配置搬运保真（逐行段替换不重新序列化）、
 * 旧产物清理与安全边界、幂等与部分迁移续做、边界容错、旧版品牌产物清理。
 *
 * 所有用例都注入临时 homeDir —— 迁移会读写用户主目录，测试 MUST NOT 触碰真实主目录。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    LEGACY_BASH_COMPLETION_FILE,
    LEGACY_COMPLETION_MARKERS,
    LEGACY_CONFIG_DIR_NAME,
    LEGACY_POWERSHELL_COMPLETION_FILE,
    LEGACY_SKILL_PREFIX,
    LEGACY_TYPE_RENAME,
    LEGACY_WORKFLOW_ID_MAP,
    detectLegacyArtifacts,
    hasLegacyArtifacts,
    isWithinDir,
    renderLegacyMigrationReport,
    renameLegacyWorkflowId,
    runLegacyMigration,
} from '../src/core/legacy-migration.js';
import { CONFIG_FILE_NAME, readProjectConfig } from '../src/core/project-config.js';
import { getSkillTemplates } from '../src/core/templates/index.js';
import { runInit } from '../src/commands/init.js';
import { runUpdate } from '../src/commands/update.js';
import { SKILL_TYPES } from '../src/core/config.js';

let tempRoot: string;
let projectRoot: string;
let homeDir: string;

beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-legacy-'));
    projectRoot = path.join(tempRoot, 'project');
    homeDir = path.join(tempRoot, 'home');
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.mkdirSync(homeDir, { recursive: true });
});

afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
});

// ── 夹具 ──────────────────────────────────────────────────────────

function writeAt(filePath: string, content: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

/** 含注释、未知段与自定义字段的旧 config.yaml（搬运保真能力的最小样本） */
const LEGACY_CONFIG = [
    '# 项目配置（用户自写注释，搬运必须逐字保留）',
    'context: |',
    '  旧装机项目背景：',
    '  - 技术栈：TypeScript + Node.js 20+',
    '',
    '  分层约定：旧口径',
    '',
    '# 未知段：本工具不识别，搬运时必须逐字保留',
    'auto_package:',
    '  runtime_dir: .iagent/runtime',
    '  keep: true',
    '',
    '# 规则引用（旧类型 id，须与规则文件名成对改名）',
    'rules:',
    '  - tr_impl',
    '  - tr_test',
    '  - spec',
    '',
    '# 生效 workflow（旧指令 id，须按映射表改名）',
    'workflows:',
    '  - tr-test-generate',
    '  - tr-impl-debug',
    '',
    '# 目标工具',
    'tools:',
    '  - claude',
    '  - pi',
    '  - codex',
    '',
].join('\n') + '\n';

/** 旧配置目录（config.yaml + rules/ + 扫描基线） */
function makeLegacyConfigDir(overrides: { config?: string } = {}): void {
    const dir = path.join(projectRoot, LEGACY_CONFIG_DIR_NAME);
    writeAt(path.join(dir, 'config.yaml'), overrides.config ?? LEGACY_CONFIG);
    writeAt(path.join(dir, 'rules', 'tr_impl.md'), '# 旧 impl 规则\n禁止跨层调用\n');
    writeAt(path.join(dir, 'rules', 'tr_test.md'), '# 旧 test 规则\n测试框架与既有用例一致\n');
    writeAt(path.join(dir, 'rules', 'spec.md'), '# 旧 spec 规则\n提案须过评分门\n');
    writeAt(path.join(dir, 'scan-baseline.json'), '{"legacy":true}\n');
}

/** 各工具目录下的旧前缀技能与旧命名空间指令 */
function makeLegacyProducts(): void {
    writeAt(path.join(projectRoot, '.claude', 'skills', `${LEGACY_SKILL_PREFIX}tr_impl_feature`, 'SKILL.md'), 'old');
    writeAt(path.join(projectRoot, '.claude', 'skills', `${LEGACY_SKILL_PREFIX}tr_tools_pwd`, 'SKILL.md'), 'old');
    writeAt(path.join(projectRoot, '.claude', 'commands', 'venus', 'tr-impl-feature.md'), 'old');
    writeAt(path.join(projectRoot, '.pi', 'skills', `${LEGACY_SKILL_PREFIX}tr_impl_feature`, 'SKILL.md'), 'old');
    writeAt(path.join(projectRoot, '.pi', 'commands', 'venus', 'tr-impl-feature.md'), 'old');
    writeAt(path.join(projectRoot, '.codex', 'skills', `${LEGACY_SKILL_PREFIX}tr_impl_feature`, 'SKILL.md'), 'old');
    // 非旧前缀产物：MUST NOT 被触碰
    writeAt(path.join(projectRoot, '.claude', 'skills', 'other_tool_skill', 'SKILL.md'), 'keep-me');
    writeAt(path.join(projectRoot, '.claude', 'commands', 'other', 'x.md'), 'keep-me');
}

/** 递归快照（相对路径 → 内容），用于幂等断言 */
function snapshot(root: string): Record<string, string> {
    const out: Record<string, string> = {};
    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
                continue;
            }
            out[path.relative(root, full).replaceAll('\\', '/')] = fs.readFileSync(full, 'utf8');
        }
    };
    if (fs.existsSync(root)) {
        walk(root);
    }
    return out;
}

/** 迁移后新 config 的原始文本 */
function newConfigRaw(): string {
    return fs.readFileSync(path.join(projectRoot, CONFIG_FILE_NAME), 'utf8');
}

// ── 2.1 检测与映射 ────────────────────────────────────────────────

describe('2.1 遗留产物检测与映射表', () => {
    it('无任何旧物时不判定为需要迁移', () => {
        const detection = detectLegacyArtifacts(projectRoot, { homeDir });
        expect(detection.configDir).toBeNull();
        expect(detection.configFile).toBeNull();
        expect(detection.skills).toEqual([]);
        expect(detection.commands).toEqual([]);
        expect(hasLegacyArtifacts(detection)).toBe(false);
    });

    it('三类旧物各自独立可见：仅旧配置目录', () => {
        makeLegacyConfigDir();
        const detection = detectLegacyArtifacts(projectRoot, { homeDir });
        expect(detection.configDir).toBe('.venus');
        expect(detection.configFile).toBe('.venus/config.yaml');
        expect(detection.skills).toEqual([]);
        expect(detection.commands).toEqual([]);
        expect(hasLegacyArtifacts(detection)).toBe(true);
    });

    it('三类旧物各自独立可见：仅旧技能与旧指令', () => {
        makeLegacyProducts();
        const detection = detectLegacyArtifacts(projectRoot, { homeDir });
        expect(detection.configDir).toBeNull();
        // claude / pi / codex 各一个旧技能
        expect(detection.skills.map((s) => s.path).sort()).toEqual([
            '.claude/skills/venus_tr_impl_feature',
            '.claude/skills/venus_tr_tools_pwd',
            '.codex/skills/venus_tr_impl_feature',
            '.pi/skills/venus_tr_impl_feature',
        ]);
        // 仅有适配器的工具（claude / pi）产指令；codex 的 commandsDir 为空，不参与
        expect(detection.commands.map((c) => c.path).sort()).toEqual([
            '.claude/commands/venus/tr-impl-feature.md',
            '.pi/commands/venus/tr-impl-feature.md',
        ]);
        expect(detection.skills.every((s) => s.symlink === false)).toBe(true);
        expect(hasLegacyArtifacts(detection)).toBe(true);
    });

    it('三类旧物齐备时全部列出', () => {
        makeLegacyConfigDir();
        makeLegacyProducts();
        const detection = detectLegacyArtifacts(projectRoot, { homeDir });
        expect(detection.configDir).toBe('.venus');
        expect(detection.skills.length).toBe(4);
        expect(detection.commands.length).toBe(2);
    });

    it('类型改名映射由 SKILL_TYPES 派生：覆盖 9 个类型且 spec 不变', () => {
        expect(Object.keys(LEGACY_TYPE_RENAME).length).toBe(9);
        expect(SKILL_TYPES.length).toBe(9);
        expect(LEGACY_TYPE_RENAME['tr_init']).toBe('init');
        expect(LEGACY_TYPE_RENAME['tr_impl']).toBe('impl');
        expect(LEGACY_TYPE_RENAME['tr_test']).toBe('test');
        expect(LEGACY_TYPE_RENAME['tr_commit']).toBe('commit');
        expect(LEGACY_TYPE_RENAME['tr_review']).toBe('review');
        expect(LEGACY_TYPE_RENAME['tr_release']).toBe('release');
        expect(LEGACY_TYPE_RENAME['tr_tools']).toBe('tools');
        expect(LEGACY_TYPE_RENAME['tr_docs']).toBe('docs');
        // spec 无 tr 前缀：改名前后同名
        expect(LEGACY_TYPE_RENAME['spec']).toBe('spec');
        // 映射值即当前类型 id 集，映射不可能与类型体系漂移
        expect(new Set(Object.values(LEGACY_TYPE_RENAME))).toEqual(new Set(SKILL_TYPES.map((t) => t.id)));
    });

    it('workflow id 映射 21 项，映射目标覆盖当前全部指令 id（不可能与注册表漂移）', () => {
        const currentCommandIds = getSkillTemplates().map((entry) => entry.commandId);
        expect(currentCommandIds.length).toBe(20);
        expect(Object.keys(LEGACY_WORKFLOW_ID_MAP).length).toBe(21);
        expect(new Set(Object.values(LEGACY_WORKFLOW_ID_MAP))).toEqual(new Set(currentCommandIds));
        // 目标名去重后 == 当前指令 id 集（genfull 与 workflow 均映射到 workflow）
        expect(new Set(Object.values(LEGACY_WORKFLOW_ID_MAP)).size).toBe(20);
        // spec 领域段的旧 id 与新 id 相同
        expect(renameLegacyWorkflowId('spec-explore')).toBe('spec-explore');
        // genfull（引导式全流程）已并入 workflow
        expect(renameLegacyWorkflowId('tr-impl-genfull')).toBe('workflow');
        // 表外 id 原样返回（不丢项）
        expect(renameLegacyWorkflowId('unknown-id')).toBe('unknown-id');
    });

    it('清理不依赖映射表：表外旧名前缀产物同样被检测（映射表不构成第二份删除清单）', () => {
        writeAt(
            path.join(projectRoot, '.claude', 'skills', `${LEGACY_SKILL_PREFIX}generated_custom`, 'SKILL.md'),
            'user generated'
        );
        const detection = detectLegacyArtifacts(projectRoot, { homeDir });
        expect(detection.skills.map((s) => s.dirName)).toEqual(['venus_generated_custom']);
    });
});

// ── 2.2 配置搬运保真 ──────────────────────────────────────────────

describe('2.2 配置搬运保真（逐行段替换，不重新序列化 YAML）', () => {
    beforeEach(() => {
        makeLegacyConfigDir();
        runLegacyMigration(projectRoot, { homeDir });
    });

    it('context 多行块逐字保留', () => {
        const parsed = readProjectConfig(projectRoot);
        expect(parsed?.context).toBe(
            ['旧装机项目背景：', '- 技术栈：TypeScript + Node.js 20+', '', '分层约定：旧口径'].join('\n')
        );
        expect(newConfigRaw()).toContain(
            [
                'context: |',
                '  旧装机项目背景：',
                '  - 技术栈：TypeScript + Node.js 20+',
                '',
                '  分层约定：旧口径',
            ].join('\n')
        );
    });

    it('注释行逐字保留（含未知段上方注释）', () => {
        const raw = newConfigRaw();
        for (const comment of [
            '# 项目配置（用户自写注释，搬运必须逐字保留）',
            '# 未知段：本工具不识别，搬运时必须逐字保留',
            '# 规则引用（旧类型 id，须与规则文件名成对改名）',
        ]) {
            expect(raw.match(new RegExp(`^${comment.replace(/[()[\]]/g, '\\$&')}$`, 'gm'))?.length).toBe(1);
        }
    });

    it('未知段与自定义字段逐字保留', () => {
        expect(newConfigRaw()).toContain(
            ['# 未知段：本工具不识别，搬运时必须逐字保留', 'auto_package:', '  runtime_dir: .iagent/runtime', '  keep: true'].join(
                '\n'
            )
        );
    });

    it('rules 列表与 rules/ 文件名成对改名，无缺失规则文件', () => {
        expect(readProjectConfig(projectRoot)?.rules).toEqual({
            impl: ['禁止跨层调用'],
            test: ['测试框架与既有用例一致'],
            spec: ['提案须过评分门'],
        });
        expect(readProjectConfig(projectRoot)?.missingRuleFiles).toEqual([]);
        expect(fs.existsSync(path.join(projectRoot, '.iagent', 'rules', 'impl.md'))).toBe(true);
        expect(fs.existsSync(path.join(projectRoot, '.iagent', 'rules', 'test.md'))).toBe(true);
        expect(fs.existsSync(path.join(projectRoot, '.iagent', 'rules', 'spec.md'))).toBe(true);
        // 旧类型名的规则文件未被搬成同名文件
        expect(fs.existsSync(path.join(projectRoot, '.iagent', 'rules', 'tr_impl.md'))).toBe(false);
    });

    it('workflows 列表按映射表改名且不丢项', () => {
        expect(readProjectConfig(projectRoot)?.workflows).toEqual(['test', 'debug']);
        expect(newConfigRaw()).toContain(['workflows:', '  - test', '  - debug'].join('\n'));
    });

    it('tools 列表内容不丢项', () => {
        expect(readProjectConfig(projectRoot)?.tools).toEqual(['claude', 'pi', 'codex']);
    });

    it('扫描基线随目录搬移', () => {
        expect(fs.readFileSync(path.join(projectRoot, '.iagent', 'scan-baseline.json'), 'utf8')).toBe(
            '{"legacy":true}\n'
        );
    });

    it('搬运完成且旧配置目录被移除（报告同时记入搬运项与删除项）', () => {
        const report = runLegacyMigration(projectRoot, { homeDir }); // 幂等：第二次已无旧物
        expect(report.migrated).toBe(false);
        expect(fs.existsSync(path.join(projectRoot, LEGACY_CONFIG_DIR_NAME))).toBe(false);
    });
});

// ── 2.3 端到端迁移 ────────────────────────────────────────────────

describe('2.3 端到端迁移（iagent init）', () => {
    it('搬运配置 + 清理旧产物 + 保留非旧前缀产物 + 报告三段落与告警', () => {
        makeLegacyConfigDir();
        makeLegacyProducts();
        // 其中至少一个技能被手工改动过
        writeAt(
            path.join(projectRoot, '.claude', 'skills', `${LEGACY_SKILL_PREFIX}tr_tools_pwd`, 'SKILL.md'),
            'HAND-EDITED BY USER'
        );

        const result = runInit(projectRoot, { homeDir, scan: false });
        const report = result.legacyMigration;

        // 配置已搬运（configState 为 exists：迁移先于 ensureProjectConfig 写入）
        expect(result.configState).toBe('exists');
        expect(readProjectConfig(projectRoot)?.workflows).toEqual(['test', 'debug']);
        expect(readProjectConfig(projectRoot)?.missingRuleFiles).toEqual([]);

        // 旧产物全部清零（三个工具的技能、两个工具的指令、旧配置目录）
        for (const toolDir of ['.claude', '.pi', '.codex']) {
            expect(fs.existsSync(path.join(projectRoot, toolDir, 'skills', `${LEGACY_SKILL_PREFIX}tr_impl_feature`))).toBe(
                false
            );
        }
        expect(fs.existsSync(path.join(projectRoot, '.claude', 'commands', 'venus'))).toBe(false);
        expect(fs.existsSync(path.join(projectRoot, '.pi', 'commands', 'venus'))).toBe(false);
        expect(fs.existsSync(path.join(projectRoot, LEGACY_CONFIG_DIR_NAME))).toBe(false);

        // 非旧前缀产物保留
        expect(fs.readFileSync(path.join(projectRoot, '.claude', 'skills', 'other_tool_skill', 'SKILL.md'), 'utf8')).toBe(
            'keep-me'
        );
        expect(fs.existsSync(path.join(projectRoot, '.claude', 'commands', 'other', 'x.md'))).toBe(true);

        // 报告三段落齐备
        expect(report.migrated).toBe(true);
        expect(report.moved.length).toBeGreaterThan(0);
        expect(report.removed.length).toBeGreaterThan(0);
        expect(report.removed.some((item) => item.includes('venus_tr_impl_feature'))).toBe(true);
        // 手工修改可能已丢失的显式告警
        expect(report.warnings.some((w) => w.includes('手工修改'))).toBe(true);

        const rendered = renderLegacyMigrationReport(report);
        expect(rendered).toContain('搬运项：');
        expect(rendered).toContain('删除项：');
        expect(rendered).toContain('跳过项：');

        // 迁移后按搬运来的 workflow 集安装（test + debug + 注入 spec-verify-proposal）
        expect(result.workflowsSource).toBe('user');
        expect(result.injectedDeps).toEqual(['spec-verify-proposal']);
        expect(result.skillsInstalled.length).toBe(9); // 3 模板 × 3 工具
        expect(fs.existsSync(path.join(projectRoot, '.claude', 'skills', 'iagent-test', 'SKILL.md'))).toBe(true);
        expect(fs.existsSync(path.join(projectRoot, '.claude', 'skills', 'iagent-debug', 'SKILL.md'))).toBe(true);
    });
});

// ── 2.4 幂等与续做 ────────────────────────────────────────────────

describe('2.4 幂等与部分迁移续做', () => {
    it('连续执行两次 init：第二次无任何文件变化且不输出迁移段落', () => {
        makeLegacyConfigDir();
        makeLegacyProducts();

        runInit(projectRoot, { homeDir, scan: false, force: true });
        const afterFirst = snapshot(projectRoot);

        const second = runInit(projectRoot, { homeDir, scan: false });
        expect(second.legacyMigration.migrated).toBe(false);
        expect(renderLegacyMigrationReport(second.legacyMigration)).toBe('');
        expect(snapshot(projectRoot)).toEqual(afterFirst);
    });

    it('配置已搬运但旧技能仍存在：第二次只补齐清理，不重复搬运配置', () => {
        makeLegacyConfigDir();
        // 第一次：仅旧配置目录存在
        const first = runLegacyMigration(projectRoot, { homeDir });
        expect(first.moved.some((item) => item.includes('config.yaml'))).toBe(true);
        const configAfterFirst = newConfigRaw();

        // 模拟部分迁移遗留：旧技能仍在
        writeAt(path.join(projectRoot, '.pi', 'skills', `${LEGACY_SKILL_PREFIX}tr_impl_feature`, 'SKILL.md'), 'old');

        const second = runLegacyMigration(projectRoot, { homeDir });
        expect(second.migrated).toBe(true);
        // 不重复搬运配置
        expect(second.moved).toEqual([]);
        expect(newConfigRaw()).toBe(configAfterFirst);
        // 只补齐清理
        expect(second.removed).toEqual(['.pi/skills/venus_tr_impl_feature/']);
        expect(fs.existsSync(path.join(projectRoot, '.pi', 'skills', `${LEGACY_SKILL_PREFIX}tr_impl_feature`))).toBe(
            false
        );
    });
});

// ── 2.5 边界容错矩阵 ──────────────────────────────────────────────

describe('2.5 边界容错与跳过开关', () => {
    it('旧配置目录缺失但存在旧技能：仅执行产物清理，不报错', () => {
        makeLegacyProducts();
        const result = runInit(projectRoot, { homeDir, scan: false });
        expect(result.legacyMigration.migrated).toBe(true);
        expect(result.legacyMigration.moved).toEqual([]);
        // 4 个旧技能 + 2 条旧指令 + 2 个遗留空命名空间目录
        expect(result.legacyMigration.removed.length).toBe(8);
        expect(fs.existsSync(path.join(projectRoot, '.claude', 'commands', 'venus'))).toBe(false);
    });

    it('配置读取失败：原物保留、不写残缺新配置、输出未迁移告警、主流程继续', () => {
        // 让旧 config.yaml 是一个目录 → readFileSync 抛错（模拟格式异常无法解析）
        fs.mkdirSync(path.join(projectRoot, LEGACY_CONFIG_DIR_NAME, 'config.yaml'), { recursive: true });
        writeAt(path.join(projectRoot, '.claude', 'skills', `${LEGACY_SKILL_PREFIX}tr_impl_feature`, 'SKILL.md'), 'old');

        const result = runInit(projectRoot, { homeDir, scan: false });

        // 旧配置目录保留、新 config 未写入
        expect(fs.existsSync(path.join(projectRoot, LEGACY_CONFIG_DIR_NAME, 'config.yaml'))).toBe(true);
        expect(fs.existsSync(path.join(projectRoot, CONFIG_FILE_NAME))).toBe(true); // 由 ensureProjectConfig 写默认配置
        expect(fs.readFileSync(path.join(projectRoot, CONFIG_FILE_NAME), 'utf8')).not.toContain('旧装机项目背景');
        // 未迁移告警
        expect(result.legacyMigration.warnings.some((w) => w.includes('旧配置未迁移'))).toBe(true);
        // 主流程继续（默认集安装照常）
        expect(result.skillsInstalled.length).toBeGreaterThan(0);
        expect(result.reconcileOrphans.skills.length).toBeLessThanOrEqual(result.skillsInstalled.length);
    });

    it('仅部分旧物存在：只处理存在的那部分', () => {
        writeAt(path.join(projectRoot, '.claude', 'commands', 'venus', 'tr-tools-pwd.md'), 'old');
        const result = runLegacyMigration(projectRoot, { homeDir });
        expect(result.migrated).toBe(true);
        expect(result.moved).toEqual([]);
        expect(result.removed).toEqual([
            '.claude/commands/venus/tr-tools-pwd.md',
            '.claude/commands/venus/（空目录）',
        ]);
    });

    it('新配置目录已存在：既有 config.yaml 不被覆盖、旧配置目录保留、输出合并提示', () => {
        makeLegacyConfigDir();
        writeAt(path.join(projectRoot, CONFIG_FILE_NAME), 'context: |\n  用户自建的新配置\n');

        const result = runLegacyMigration(projectRoot, { homeDir });

        expect(newConfigRaw()).toBe('context: |\n  用户自建的新配置\n');
        expect(fs.existsSync(path.join(projectRoot, LEGACY_CONFIG_DIR_NAME, 'config.yaml'))).toBe(true);
        expect(fs.existsSync(path.join(projectRoot, LEGACY_CONFIG_DIR_NAME, 'rules', 'tr_impl.md'))).toBe(true);
        expect(result.warnings.some((w) => w.includes('旧配置未搬运') && w.includes('手工比对合并'))).toBe(true);
        expect(result.skipped.some((s) => s.includes('已存在，未覆盖'))).toBe(true);
    });

    it('--no-migrate：零搬运零删除且无报告', () => {
        makeLegacyConfigDir();
        makeLegacyProducts();

        const result = runInit(projectRoot, { homeDir, scan: false, migrate: false });

        expect(result.legacyMigration.migrated).toBe(false);
        expect(renderLegacyMigrationReport(result.legacyMigration)).toBe('');
        // 旧物原样保留
        expect(fs.existsSync(path.join(projectRoot, LEGACY_CONFIG_DIR_NAME, 'config.yaml'))).toBe(true);
        expect(
            fs.existsSync(path.join(projectRoot, '.claude', 'skills', `${LEGACY_SKILL_PREFIX}tr_impl_feature`, 'SKILL.md'))
        ).toBe(true);
        expect(fs.existsSync(path.join(projectRoot, CONFIG_FILE_NAME))).toBe(true); // 默认配置照常创建
        expect(readProjectConfig(projectRoot)?.context).toContain('待补充');
    });

    it('迁移内部抛异常：update 主流程仍完成', () => {
        // 让 rc 探测读取时抛错（目录不可被 readFileSync 读取）：异常发生在检测阶段，
        // 迁移整体降级为告警，产物刷新照常完成
        fs.mkdirSync(path.join(homeDir, '.bashrc'), { recursive: true });
        writeAt(path.join(projectRoot, '.claude', 'skills', `${LEGACY_SKILL_PREFIX}tr_impl_feature`, 'SKILL.md'), 'old');

        const result = runUpdate(projectRoot, { homeDir });

        expect(result.legacyMigration.warnings.some((w) => w.includes('迁移未完成'))).toBe(true);
        // 主流程照常：未配置 workflows 时按默认集刷新（9 模板 × 3 工具）
        expect(result.installed.length).toBe(27);
        // 异常后清理未执行，旧产物保留待下次重跑
        expect(fs.existsSync(path.join(projectRoot, '.claude', 'skills', `${LEGACY_SKILL_PREFIX}tr_impl_feature`))).toBe(
            true
        );
    });
});

// ── 2.6 安全边界 ──────────────────────────────────────────────────

describe('2.6 删除操作的边界安全', () => {
    it('越界目标被拒绝（守卫本身即契约；正常检测路径只产出子项名，无法越界）', () => {
        const root = path.join(projectRoot, '.claude', 'skills');
        expect(isWithinDir(root, path.join(root, 'venus_x'))).toBe(true);
        expect(isWithinDir(root, path.join(root, 'sub', 'venus_x'))).toBe(true);
        // 根目录本身、上级目录、兄弟目录、绝对路径均不合法
        expect(isWithinDir(root, root)).toBe(false);
        expect(isWithinDir(root, path.dirname(root))).toBe(false);
        expect(isWithinDir(root, path.join(projectRoot, '.claude', 'commands'))).toBe(false);
        expect(isWithinDir(root, path.join(projectRoot, 'venus_x'))).toBe(false);
        expect(isWithinDir(root, path.resolve(root))).toBe(false);
    });

    it('commandsDir 为空的工具（codex）跳过指令侧清理，项目根下同名目录零影响', () => {
        // 项目根下的 venus/ 与本工具无关：codex 的 commandsDir 为空，
        // path.join(root, '', 'venus') 会恰好命中它，故必须整体跳过
        writeAt(path.join(projectRoot, 'venus', 'unrelated.md'), 'not mine');
        writeAt(path.join(projectRoot, '.codex', 'commands', 'venus', 'tr-tools-pwd.md'), 'old');

        const detection = detectLegacyArtifacts(projectRoot, { homeDir });
        // codex 的指令不被检测，项目根下的 venus/ 更不被扫描
        expect(detection.commands).toEqual([]);

        runLegacyMigration(projectRoot, { homeDir });
        expect(fs.readFileSync(path.join(projectRoot, 'venus', 'unrelated.md'), 'utf8')).toBe('not mine');
        expect(fs.existsSync(path.join(projectRoot, '.codex', 'commands', 'venus', 'tr-tools-pwd.md'))).toBe(true);
    });

    it('符号链接不被跟随：仅移除链接本身，链接目标内容仍在', (ctx) => {
        const outside = path.join(tempRoot, 'outside');
        writeAt(path.join(outside, 'precious.md'), 'do-not-delete');
        const linkPath = path.join(projectRoot, '.claude', 'skills', `${LEGACY_SKILL_PREFIX}linked`);
        fs.mkdirSync(path.dirname(linkPath), { recursive: true });
        try {
            fs.symlinkSync(outside, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
        } catch {
            // 无符号链接权限（Windows 非开发者模式且非 junction）：跳过该用例
            ctx.skip();
            return;
        }

        const detection = detectLegacyArtifacts(projectRoot, { homeDir });
        expect(detection.skills.map((s) => s.dirName)).toEqual([`${LEGACY_SKILL_PREFIX}linked`]);
        expect(detection.skills[0]?.symlink).toBe(true);

        const report = runLegacyMigration(projectRoot, { homeDir });
        expect(fs.existsSync(linkPath)).toBe(false);
        expect(fs.readFileSync(path.join(outside, 'precious.md'), 'utf8')).toBe('do-not-delete');
        expect(report.removed.some((item) => item.includes('符号链接，仅移除链接本身'))).toBe(true);
    });

    it('清理后遗留的空目录被移除，含非指令文件时不删目录', () => {
        writeAt(path.join(projectRoot, '.claude', 'commands', 'venus', 'tr-tools-pwd.md'), 'old');
        runLegacyMigration(projectRoot, { homeDir });
        expect(fs.existsSync(path.join(projectRoot, '.claude', 'commands', 'venus'))).toBe(false);

        // 含非 .md 文件时目录保留并记入跳过项
        writeAt(path.join(projectRoot, '.claude', 'commands', 'venus', 'tr-tools-pwd.md'), 'old');
        writeAt(path.join(projectRoot, '.claude', 'commands', 'venus', 'notes.txt'), 'mine');
        const report = runLegacyMigration(projectRoot, { homeDir });
        expect(fs.existsSync(path.join(projectRoot, '.claude', 'commands', 'venus', 'notes.txt'))).toBe(true);
        expect(report.skipped.some((s) => s.includes('含非指令文件，目录保留'))).toBe(true);
    });

    it('配置搬运保留未知段与自定义字段（YAML 文本逐字不变）', () => {
        makeLegacyConfigDir();
        runLegacyMigration(projectRoot, { homeDir });
        const raw = newConfigRaw();
        expect(raw).toContain('  runtime_dir: .iagent/runtime');
        expect(raw).toContain('auto_package:');
        expect(raw).toContain('  keep: true');
        // 旧类型 id 在搬运后不得残留
        expect(raw).not.toContain('tr_impl');
        expect(raw).not.toContain('tr-test-generate');
    });
});

// ── 2.7 旧版品牌产物清理 ──────────────────────────────────────────

describe('2.7 旧版品牌命名的磁盘产物清理', () => {
    /** 构造旧 bash 补全脚本 + 含旧标记块的 rc */
    function makeLegacyCompletionRc(): { rcPath: string; expectedAfter: string } {
        const rcPath = path.join(homeDir, '.bashrc');
        writeAt(path.join(homeDir, LEGACY_BASH_COMPLETION_FILE), '# old completion script\n');
        const before = '# 用户自写配置\nexport FOO=1\n';
        const after = 'export BAR=2\n# 尾部注释\n';
        writeAt(
            rcPath,
            `${before}${LEGACY_COMPLETION_MARKERS.start}\n# 旧补全（勿手工编辑）\n. ~/.venus-completion.sh\n${LEGACY_COMPLETION_MARKERS.end}\n${after}`
        );
        return { rcPath, expectedAfter: `${before}${after}` };
    }

    it('旧补全脚本与标记块一并清理，rc 其余内容逐字不变', () => {
        const { rcPath, expectedAfter } = makeLegacyCompletionRc();

        const result = runInit(projectRoot, { homeDir, scan: false });
        const report = result.legacyMigration;

        expect(fs.readFileSync(rcPath, 'utf8')).toBe(expectedAfter);
        expect(fs.existsSync(path.join(homeDir, LEGACY_BASH_COMPLETION_FILE))).toBe(false);
        expect(report.removed.some((item) => item.includes('旧版补全脚本'))).toBe(true);
        expect(report.removed.some((item) => item.includes('旧补全标记块'))).toBe(true);
        expect(report.migrated).toBe(true);
    });

    it('PowerShell 侧旧脚本与标记块同样清理', () => {
        const profileDir = path.join(homeDir, 'Documents', 'WindowsPowerShell');
        const rcPath = path.join(profileDir, 'Microsoft.PowerShell_profile.ps1');
        writeAt(path.join(profileDir, LEGACY_POWERSHELL_COMPLETION_FILE), '# old ps completion\n');
        writeAt(
            rcPath,
            `$Env:FOO = 1\n${LEGACY_COMPLETION_MARKERS.start}\n. VenusCompletion.ps1\n${LEGACY_COMPLETION_MARKERS.end}\n`
        );

        runLegacyMigration(projectRoot, { homeDir });

        expect(fs.readFileSync(rcPath, 'utf8')).toBe('$Env:FOO = 1\n');
        expect(fs.existsSync(path.join(profileDir, LEGACY_POWERSHELL_COMPLETION_FILE))).toBe(false);
    });

    it('仅起始标记不成对：rc 文件零改动，报告含跳过项与告警', () => {
        const rcPath = path.join(homeDir, '.bashrc');
        const content = `export FOO=1\n${LEGACY_COMPLETION_MARKERS.start}\n. ~/.venus-completion.sh\n`;
        writeAt(rcPath, content);

        const report = runLegacyMigration(projectRoot, { homeDir });

        expect(fs.readFileSync(rcPath, 'utf8')).toBe(content);
        expect(report.skipped.some((s) => s.includes('旧标记块不成对'))).toBe(true);
        expect(report.warnings.some((w) => w.includes('补全标记块不成对'))).toBe(true);
    });

    it('旧 sidecar 目录与旧索引库被删除，报告含 reindex 重建提示', () => {
        const changesDir = path.join(projectRoot, 'openspec', 'changes');
        writeAt(path.join(changesDir, 'some-change', '.venus', 'decisions.json'), '{}');
        writeAt(path.join(changesDir, 'archive', 'archived-change', '.venus', 'manifest.json'), '{}');
        writeAt(path.join(changesDir, 'archive', '.venus', 'index.db'), 'db');
        // 新口径目录不得被触碰
        writeAt(path.join(changesDir, 'some-change', '.iagent', 'change.json'), '{}');

        const report = runLegacyMigration(projectRoot, { homeDir });

        expect(fs.existsSync(path.join(changesDir, 'some-change', '.venus'))).toBe(false);
        expect(fs.existsSync(path.join(changesDir, 'archive', 'archived-change', '.venus'))).toBe(false);
        expect(fs.existsSync(path.join(changesDir, 'archive', '.venus'))).toBe(false);
        expect(fs.readFileSync(path.join(changesDir, 'some-change', '.iagent', 'change.json'), 'utf8')).toBe('{}');
        expect(report.removed.some((item) => item.includes('旧版 sidecar 目录'))).toBe(true);
        expect(report.hints.some((hint) => hint.includes('reindex'))).toBe(true);
    });

    it('无任何旧产物时不写用户主目录与 rc/profile', () => {
        const rcPath = path.join(homeDir, '.bashrc');
        writeAt(rcPath, 'export FOO=1\n'); // 存在但无旧标记块

        const report = runInit(projectRoot, { homeDir, scan: false }).legacyMigration;

        expect(report.migrated).toBe(false);
        expect(renderLegacyMigrationReport(report)).toBe('');
        // 主目录未被写入（文件集不变，既有 rc 内容不变）
        expect(fs.readdirSync(homeDir).sort()).toEqual(['.bashrc']);
        expect(fs.readFileSync(rcPath, 'utf8')).toBe('export FOO=1\n');
    });
});
