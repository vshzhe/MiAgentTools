/**
 * 命令层测试：init / list / generate 的端到端行为（基于临时目录）。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runInit } from '../src/commands/init.js';
import { runUpdate } from '../src/commands/update.js';
import { runList, scanInstalledSkills } from '../src/commands/list.js';
import { runGenerate } from '../src/commands/generate.js';
import { ensureProjectConfig, writeWorkflowsToConfig, readProjectConfig } from '../src/core/project-config.js';
import { getSkillTemplates, getCommandTemplates } from '../src/core/templates/index.js';

let tempRoot: string;

beforeAll(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-test-'));
    // 配置全量 workflows，让 init 装全部 20 个技能（默认集 8 显式项 + 1 注入 = 9 个）
    ensureProjectConfig(tempRoot);
    writeWorkflowsToConfig(tempRoot, getSkillTemplates().map((e) => e.commandId));
});

afterAll(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('iagent init', () => {
    it('生成 60 个 SKILL.md（3 工具 × 20 模板）与 40 个指令文件（2 适配器 × 20 模板）', () => {
        const result = runInit(tempRoot);
        expect(result.skillsInstalled.length).toBe(60);
        expect(result.commandsInstalled.length).toBe(40);
        expect(result.skipped.length).toBe(0);

        // 技能文件实际存在且内容合法
        const wfFile = path.join(tempRoot, '.claude', 'skills', 'iagent_workflow', 'SKILL.md');
        expect(fs.existsSync(wfFile)).toBe(true);
        const wfContent = fs.readFileSync(wfFile, 'utf8');
        expect(wfContent).toContain('name: iagent_workflow');
        expect(wfContent).toContain('type: impl');
        expect(wfContent).toContain('workflow');

        // 指令文件实际存在（路径统一正斜杠断言，Windows 兼容）
        const cmdFile = path.join(tempRoot, '.claude', 'commands', 'iagent', 'workflow.md');
        expect(fs.existsSync(cmdFile)).toBe(true);
        const cmdFiles = fs.readdirSync(path.join(tempRoot, '.claude', 'commands', 'iagent'));
        expect(cmdFiles.map((f) => f.replaceAll('\\', '/'))).toContain('workflow.md');
    });

    it('重复 init 跳过已存在文件，--force 覆盖', () => {
        const skipped = runInit(tempRoot);
        expect(skipped.skillsInstalled.length).toBe(0);
        expect(skipped.skipped.length).toBe(100); // 60 技能 + 40 指令已存在

        const forced = runInit(tempRoot, { force: true });
        expect(forced.skillsInstalled.length).toBe(60);
        expect(forced.skipped.length).toBe(0);
    });

    it('非法工具 id 抛错', () => {
        expect(() => runInit(tempRoot, { tools: 'not-a-tool' })).toThrow(/未知的工具标识/);
    });

    it('references 文件正确生成且内容完整', () => {
        // references 在前序 init 测试中已生成，直接检查已有文件

        // 验证 Gate 模板的 references 文件存在且非空
        const exploreRefs = path.join(tempRoot, '.claude', 'skills', 'iagent_spec_explore', 'references');
        expect(fs.existsSync(exploreRefs)).toBe(true);
        const promptGateRef = path.join(exploreRefs, 'prompt-gate.md');
        expect(fs.existsSync(promptGateRef)).toBe(true);
        const pgContent = fs.readFileSync(promptGateRef, 'utf8');
        expect(pgContent.length).toBeGreaterThan(200); // 全文版 Gate 应 > 200 字符
        expect(pgContent).toContain('出口有四条'); // 关键语义标识

        const flowchartRef = path.join(exploreRefs, 'flowchart-gate.md');
        expect(fs.existsSync(flowchartRef)).toBe(true);
        expect(fs.readFileSync(flowchartRef, 'utf8').length).toBeGreaterThan(200);

        // 验证 project-init references 存在
        const initRefs = path.join(tempRoot, '.claude', 'skills', 'iagent_project_init', 'references');
        expect(fs.existsSync(initRefs)).toBe(true);
        expect(fs.existsSync(path.join(initRefs, 'doc-architecture.md'))).toBe(true);
    });

    it('index.db 初始化状态记录正确', () => {
        // 前序 init 已执行，检查返回的 indexDbStatus 字段
        const result = runInit(tempRoot); // 重复 init（跳过已有文件）但仍返回 indexDbStatus
        expect(['created', 'skipped-exists', 'skipped-unavailable', 'failed']).toContain(
            result.indexDbStatus
        );
    });
});

describe('iagent list', () => {
    it('扫描结果包含 20 个技能且类型解析正确', () => {
        const skills = scanInstalledSkills(tempRoot);
        expect(skills.length).toBe(20);
        const wf = skills.find((s) => s.name === 'iagent_workflow');
        expect(wf?.type).toBe('impl');
        expect(wf?.description).toBeTruthy();
    });

    it('JSON 输出结构合法', () => {
        const json = JSON.parse(runList(tempRoot, { json: true })) as {
            total: number;
            skills: { name: string; type: string | null }[];
        };
        expect(json.total).toBe(20);
        expect(json.skills.filter((s) => s.type === 'init').length).toBe(1);
    });

    it('文本输出包含全部非空类型分组', () => {
        const output = runList(tempRoot);
        for (const typeId of ['init', 'impl', 'test', 'commit', 'review', 'docs', 'spec']) {
            expect(output).toContain(typeId);
        }
        // release / tools 当前无内置技能，不输出空分组
        expect(output).not.toContain('[release]');
        expect(output).not.toContain('[tools]');
    });
});

describe('iagent generate', () => {
    it('按类型生成骨架并安装', () => {
        const result = runGenerate(tempRoot, {
            type: 'tools',
            name: 'env-check',
            desc: '环境检查',
        });
        expect(result.skillName).toBe('iagent_env_check');

        const sourceFile = path.join(tempRoot, 'skills', 'iagent_env_check', 'SKILL.md');
        const installedFile = path.join(tempRoot, '.claude', 'skills', 'iagent_env_check', 'SKILL.md');
        expect(fs.existsSync(sourceFile)).toBe(true);
        expect(fs.existsSync(installedFile)).toBe(true);

        const content = fs.readFileSync(sourceFile, 'utf8');
        expect(content).toContain('name: iagent_env_check');
        expect(content).toContain('环境检查');
        expect(content).toContain('（待补充技能正文）');
    });

    it('生成的技能能被 list 扫描到（类型为 tools）', () => {
        const skills = scanInstalledSkills(tempRoot);
        const generated = skills.find((s) => s.name === 'iagent_env_check');
        expect(generated?.type).toBe('tools');
    });

    it('重复生成同名技能抛错，--force 覆盖', () => {
        expect(() => runGenerate(tempRoot, { type: 'tools', name: 'env-check' })).toThrow(/已存在/);
        expect(() => runGenerate(tempRoot, { type: 'tools', name: 'env-check', force: true })).not.toThrow();
    });

    it('非法类型与非法命名抛错', () => {
        expect(() => runGenerate(tempRoot, { type: 'tr_unknown', name: 'x' })).toThrow(/未知的技能类型/);
        expect(() => runGenerate(tempRoot, { type: 'tools', name: 'BadName' })).toThrow(/kebab-case/);
    });
});

describe('workflows 过滤（profile 生效）', () => {
    /** 建独立临时项目（隔离主 fixture 的全量配置） */
    function freshRoot(): string {
        return fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-wf-'));
    }

    it('未配置 workflows 时 init 装默认集 8 显式项 + 1 注入 = 9 个（每工具）', () => {
        const root = freshRoot();
        try {
            const result = runInit(root);
            expect(result.workflowsSource).toBe('default');
            expect(result.skillsInstalled.length).toBe(27); // 9 templates × 3 tools
            expect(result.commandsInstalled.length).toBe(18); // 9 templates × 2 adapters
            // spec-archive 在默认集内，其依赖 requirement-doc 被注入
            expect(result.injectedDeps).toEqual(['requirement-doc']);
            // 默认集内技能存在
            expect(
                fs.existsSync(path.join(root, '.claude', 'skills', 'iagent_project_init', 'SKILL.md'))
            ).toBe(true);
            // 非默认集技能不存在
            expect(
                fs.existsSync(path.join(root, '.claude', 'skills', 'iagent_commit', 'SKILL.md'))
            ).toBe(false);
            expect(result.reconcileOrphans.skills).toEqual([]);
            expect(result.reconcileOrphans.commands).toEqual([]);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('配置子集时装对应项并注入依赖', () => {
        const root = freshRoot();
        try {
            ensureProjectConfig(root);
            writeWorkflowsToConfig(root, ['spec-propose', 'spec-explore']);
            const result = runInit(root);
            expect(result.workflowsSource).toBe('user');
            // spec-propose 注入 spec-verify-proposal：2 项 + 1 注入 = 3（每工具）
            expect(result.skillsInstalled.length).toBe(9); // 3 templates × 3 tools
            expect(result.injectedDeps).toEqual(['spec-verify-proposal']);
            expect(
                fs.existsSync(path.join(root, '.claude', 'skills', 'iagent_spec_verify_proposal', 'SKILL.md'))
            ).toBe(true);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('reconcile：全量装后缩为默认集，遗留保留不删且列入提示', () => {
        const root = freshRoot();
        try {
            // 先全量安装
            ensureProjectConfig(root);
            writeWorkflowsToConfig(root, getSkillTemplates().map((e) => e.commandId));
            runInit(root);
            // 再缩为单技能配置
            writeWorkflowsToConfig(root, ['spec-explore']);
            const result = runInit(root, { force: true });
            expect(result.workflowsSource).toBe('user');
            // 遗留 19 个技能 × 3 工具 = 57，19 个指令 × 2 适配器 = 38
            expect(result.reconcileOrphans.skills.length).toBe(57);
            expect(result.reconcileOrphans.commands.length).toBe(38);
            expect(
                result.reconcileOrphans.skills.some((s) => s.includes('iagent_workflow'))
            ).toBe(true);
            expect(
                fs.existsSync(path.join(root, '.claude', 'skills', 'iagent_workflow', 'SKILL.md'))
            ).toBe(true);
            expect(
                fs.existsSync(path.join(root, '.claude', 'commands', 'iagent', 'workflow.md'))
            ).toBe(true);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('update 按配置集过滤刷新（非配置集产物不动）', () => {
        const root = freshRoot();
        try {
            ensureProjectConfig(root);
            writeWorkflowsToConfig(root, ['spec-explore']);
            runInit(root);
            // 手改非配置集技能（模拟旧产物），update 不应碰它
            const orphanFile = path.join(root, '.claude', 'skills', 'iagent_workflow', 'SKILL.md');
            fs.mkdirSync(path.dirname(orphanFile), { recursive: true });
            fs.writeFileSync(orphanFile, 'old orphan content', 'utf8');

            const result = runUpdate(root);
            expect(result.workflowsSource).toBe('user');
            expect(result.commandsWritten).toBe(0); // 配置集内一致，幂等
            // 非配置集产物保留原内容
            expect(fs.readFileSync(orphanFile, 'utf8')).toBe('old orphan content');
            expect(result.reconcileOrphans.skills.some((s) => s.includes('iagent_workflow'))).toBe(true);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('iagent init 旧装机迁移（CLI 端到端）', () => {
    const binPath = fileURLToPath(new URL('../bin/iagent.js', import.meta.url));

    /**
     * 以指定项目目录为 cwd 执行 CLI（子进程的主目录经 USERPROFILE/HOME 注入临时目录，
     * 避免迁移读写真实用户主目录）。
     */
    function execCli(cwd: string, args: string[], home: string): string {
        return execFileSync(process.execPath, [binPath, ...args], {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, USERPROFILE: home, HOME: home },
        });
    }

    function writeDeep(filePath: string, content: string): void {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content, 'utf8');
    }

    /** 旧装机夹具：旧配置目录 + 一个旧技能（cwd 与主目录均为独立临时目录） */
    function makeLegacyFixture(name: string): { root: string; home: string } {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), `iagent-cli-${name}-`));
        const home = fs.mkdtempSync(path.join(os.tmpdir(), `iagent-cli-${name}-home-`));
        writeDeep(
            path.join(root, '.venus', 'config.yaml'),
            ['context: |', '  旧装机背景', '', 'rules:', '  - tr_impl', ''].join('\n')
        );
        writeDeep(path.join(root, '.venus', 'rules', 'tr_impl.md'), '# 旧规则\n禁止跨层调用\n');
        writeDeep(path.join(root, '.claude', 'skills', 'venus_tr_impl_feature', 'SKILL.md'), 'old');
        return { root, home };
    }

    it('默认打印迁移报告段落并清空旧产物', () => {
        const { root, home } = makeLegacyFixture('migrate');
        try {
            const output = execCli(root, ['init', '--no-scan', '--no-deps'], home);

            expect(output).toContain('旧装机迁移');
            expect(output).toContain('搬运项：');
            expect(output).toContain('删除项：');
            expect(output).toContain('跳过项：');
            expect(fs.existsSync(path.join(root, '.venus'))).toBe(false);
            expect(fs.existsSync(path.join(root, '.claude', 'skills', 'venus_tr_impl_feature'))).toBe(false);
            expect(fs.existsSync(path.join(root, '.iagent', 'config.yaml'))).toBe(true);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(home, { recursive: true, force: true });
        }
    });

    it('--no-migrate：零搬运零删除且不打印迁移段落', () => {
        const { root, home } = makeLegacyFixture('nomigrate');
        try {
            const output = execCli(root, ['init', '--no-scan', '--no-deps', '--no-migrate'], home);

            expect(output).not.toContain('旧装机迁移');
            expect(fs.existsSync(path.join(root, '.venus', 'config.yaml'))).toBe(true);
            expect(fs.existsSync(path.join(root, '.claude', 'skills', 'venus_tr_impl_feature'))).toBe(true);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(home, { recursive: true, force: true });
        }
    });
});

describe('指令白名单继承与会话级权限载体（端到端）', () => {
    // 前置：以全量 20 技能重装一次，使断言不依赖同文件其他用例的执行顺序
    beforeAll(() => {
        runInit(tempRoot, { force: true });
    });

    /** 会话级权限载体的绝对路径 */
    function settingsPath(): string {
        return path.join(tempRoot, '.claude', 'settings.json');
    }

    /** 指令/技能产物的绝对路径 */
    function artifactPath(kind: 'commands' | 'skills', name: string): string {
        return kind === 'commands'
            ? path.join(tempRoot, '.claude', 'commands', 'iagent', `${name}.md`)
            : path.join(tempRoot, '.claude', 'skills', name, 'SKILL.md');
    }

    /** 从产物文件正文中取出 frontmatter 的 allowed-tools 值 */
    function readAllowedTools(content: string): string {
        const matched = content.match(/^allowed-tools: (.*)$/m);
        expect(matched, 'frontmatter 缺少 allowed-tools').not.toBeNull();
        return matched?.[1] ?? '';
    }

    /** 读取会话级放行条目数组 */
    function readAllow(): string[] {
        const settings = JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) as {
            permissions?: { allow?: string[] };
        };
        return settings.permissions?.allow ?? [];
    }

    it('每个指令产物的 allowed-tools 等于其配对技能的白名单', () => {
        const skillWhitelist = new Map(
            getSkillTemplates().map((entry) => [entry.commandId, entry.template.allowedTools])
        );
        const commands = getCommandTemplates();
        expect(commands.length).toBe(20);

        for (const { id } of commands) {
            const commandFile = artifactPath('commands', id);
            expect(fs.existsSync(commandFile), `指令产物缺失：${id}`).toBe(true);
            const allowedTools = readAllowedTools(fs.readFileSync(commandFile, 'utf8'));
            expect(allowedTools, `指令 ${id} 的白名单与其配对技能不一致`).toBe(skillWhitelist.get(id));
            // 旧硬编码值已消除，白名单确实来自配对技能而非常量
            expect(allowedTools, `指令 ${id} 仍为硬编码白名单`).not.toBe('Bash(iagent:*)');
        }
    });

    it('技能产物与指令产物的 frontmatter 白名单逐对一致（20 对）', () => {
        const skills = getSkillTemplates();
        expect(skills.length).toBe(20);
        for (const { template, commandId } of skills) {
            const skillAllowed = readAllowedTools(
                fs.readFileSync(artifactPath('skills', template.name), 'utf8')
            );
            const commandAllowed = readAllowedTools(
                fs.readFileSync(artifactPath('commands', commandId), 'utf8')
            );
            expect(commandAllowed, `技能 ${template.name} 与指令 ${commandId} 白名单不一致`).toBe(skillAllowed);
        }
    });

    it('生成 .claude/settings.json 且含 permissions.allow 段', () => {
        expect(fs.existsSync(settingsPath())).toBe(true);
        const settings = JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) as {
            permissions?: { allow?: unknown };
        };
        expect(Array.isArray(settings.permissions?.allow)).toBe(true);
        expect((settings.permissions?.allow as string[]).length).toBeGreaterThan(0);
    });

    it('会话级条目含 CodeGraph MCP，且已过滤全量放行条目 Bash(*) 与裸 *', () => {
        const allow = readAllow();
        expect(allow).toContain('mcp__codegraph');
        expect(allow).toContain('mcp__codegraph__codegraph_explore');
        expect(allow).toContain('Read');
        // Bash(*) 在技能范围内只作用于该技能，写入会话级载体则放大为全局授权
        expect(allow).not.toContain('Bash(*)');
        expect(allow).not.toContain('*');
        expect(new Set(allow).size).toBe(allow.length);
    });

    it('重复 init 幂等：settings.json 内容不变', () => {
        const before = fs.readFileSync(settingsPath(), 'utf8');
        const result = runInit(tempRoot, { force: true });

        // 每个工具独立合并权限：claude + pi + codex = 3
        expect(result.permissionSettings.length).toBe(3);
        // claude 工具 settings.json 内容不变
        expect(result.permissionSettings[0].state).toBe('unchanged');
        expect(result.permissionSettings[0].added).toBe(0);
        expect(fs.readFileSync(settingsPath(), 'utf8')).toBe(before);
    });
});

describe('工具选择持久化与旧位置清理', () => {
    /** 建独立临时项目（隔离主 fixture） */
    function freshRoot(): string {
        return fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-tools-'));
    }

    function configBytes(root: string): string {
        return fs.readFileSync(path.join(root, '.iagent', 'config.yaml'), 'utf8');
    }

    it('init --tools claude 持久化选择；不带 --tools 再次 init 保持且配置幂等', () => {
        const root = freshRoot();
        try {
            const first = runInit(root, { tools: 'claude' });
            expect(first.tools).toEqual(['claude']);
            expect(readProjectConfig(root)?.tools).toEqual(['claude']);
            // 未选择工具不产生产物
            expect(fs.existsSync(path.join(root, '.pi', 'skills'))).toBe(false);

            const afterFirst = configBytes(root);
            const second = runInit(root);
            expect(second.tools).toEqual(['claude']);
            expect(readProjectConfig(root)?.tools).toEqual(['claude']);
            // 配置字节不变（尾部换行不累积）
            expect(configBytes(root)).toBe(afterFirst);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('update 不带 --tools 不回写；带 --tools 回写', () => {
        const root = freshRoot();
        try {
            runInit(root, { tools: 'claude' });
            const before = configBytes(root);
            runUpdate(root);
            expect(configBytes(root)).toBe(before);

            runUpdate(root, { tools: 'claude,pi' });
            expect(readProjectConfig(root)?.tools).toEqual(['claude', 'pi']);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('未配置时回退全部工具；非法 id 报错', () => {
        const root = freshRoot();
        try {
            const result = runInit(root);
            expect(result.tools).toEqual(['claude', 'pi', 'codex']);
            // 缺省配置可见性：tools 段存在且带「删除该字段回退全部」用途注释
            const config = configBytes(root);
            expect(config).toContain('tools:');
            expect(config).toContain('回退全部工具');
            expect(() => runInit(root, { tools: 'not-a-tool' })).toThrow(/未知的工具标识/);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('init/update 清理早期错误位置 .pi/commands/iagent/ 且幂等', () => {
        const root = freshRoot();
        try {
            const misplaced = path.join(root, '.pi', 'commands', 'iagent');
            fs.mkdirSync(misplaced, { recursive: true });
            fs.writeFileSync(path.join(misplaced, 'pwd.md'), 'old', 'utf8');

            const initResult = runInit(root);
            expect(initResult.misplacedCommands.removed.length).toBe(1);
            expect(fs.existsSync(misplaced)).toBe(false);

            const updateResult = runUpdate(root);
            expect(updateResult.misplacedCommands.removed).toEqual([]);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('Pi 指令生成到 .pi/prompts/iagent-<id>.md', () => {
        const root = freshRoot();
        try {
            runInit(root, { tools: 'pi' });
            expect(fs.existsSync(path.join(root, '.pi', 'prompts', 'iagent-project-init.md'))).toBe(true);
            expect(fs.existsSync(path.join(root, '.pi', 'commands', 'iagent'))).toBe(false);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
