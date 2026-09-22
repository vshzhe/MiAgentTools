/**
 * 命令层测试：init / list / generate 的端到端行为（基于临时目录）。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runInit } from '../src/commands/init.js';
import { runUpdate } from '../src/commands/update.js';
import { runList, scanInstalledSkills } from '../src/commands/list.js';
import { runGenerate } from '../src/commands/generate.js';
import { ensureProjectConfig, writeWorkflowsToConfig } from '../src/core/project-config.js';
import { getSkillTemplates } from '../src/core/templates/index.js';

let tempRoot: string;

beforeAll(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'venus-test-'));
    // 配置全量 workflows，让 init 装全部 26 个技能（默认集仅 8 个）
    ensureProjectConfig(tempRoot);
    writeWorkflowsToConfig(tempRoot, getSkillTemplates().map((e) => e.commandId));
});

afterAll(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('venus init', () => {
    it('生成 26 个 SKILL.md 与 26 个指令文件到 .claude/', () => {
        const result = runInit(tempRoot);
        expect(result.skillsInstalled.length).toBe(26);
        expect(result.commandsInstalled.length).toBe(26);
        expect(result.skipped.length).toBe(0);

        // 技能文件实际存在且内容合法
        const pwdFile = path.join(tempRoot, '.claude', 'skills', 'venus_tr_tools_pwd', 'SKILL.md');
        expect(fs.existsSync(pwdFile)).toBe(true);
        const pwdContent = fs.readFileSync(pwdFile, 'utf8');
        expect(pwdContent).toContain('name: venus_tr_tools_pwd');
        expect(pwdContent).toContain('type: tr_tools');
        expect(pwdContent).toContain('pwd');

        // 指令文件实际存在（路径统一正斜杠断言，Windows 兼容）
        const cmdFile = path.join(tempRoot, '.claude', 'commands', 'venus', 'tr-tools-pwd.md');
        expect(fs.existsSync(cmdFile)).toBe(true);
        const cmdFiles = fs.readdirSync(path.join(tempRoot, '.claude', 'commands', 'venus'));
        expect(cmdFiles.map((f) => f.replaceAll('\\', '/'))).toContain('tr-tools-pwd.md');
    });

    it('重复 init 跳过已存在文件，--force 覆盖', () => {
        const skipped = runInit(tempRoot);
        expect(skipped.skillsInstalled.length).toBe(0);
        expect(skipped.skipped.length).toBe(52); // 26*2 已存在

        const forced = runInit(tempRoot, { force: true });
        expect(forced.skillsInstalled.length).toBe(26);
        expect(forced.skipped.length).toBe(0);
    });

    it('非法工具 id 抛错', () => {
        expect(() => runInit(tempRoot, { tools: 'not-a-tool' })).toThrow(/未知的工具标识/);
    });
});

describe('venus list', () => {
    it('扫描结果包含 26 个技能且类型解析正确', () => {
        const skills = scanInstalledSkills(tempRoot);
        expect(skills.length).toBe(26);
        const pwd = skills.find((s) => s.name === 'venus_tr_tools_pwd');
        expect(pwd?.type).toBe('tr_tools');
        expect(pwd?.description).toBeTruthy();
    });

    it('JSON 输出结构合法', () => {
        const json = JSON.parse(runList(tempRoot, { json: true })) as {
            total: number;
            skills: { name: string; type: string | null }[];
        };
        expect(json.total).toBe(26);
        expect(json.skills.filter((s) => s.type === 'tr_init').length).toBe(1);
    });

    it('文本输出包含 7 类分组', () => {
        const output = runList(tempRoot);
        for (const typeId of ['tr_init', 'tr_impl', 'tr_test', 'tr_commit', 'tr_review', 'tr_release', 'tr_tools']) {
            expect(output).toContain(typeId);
        }
    });
});

describe('venus generate', () => {
    it('按类型生成骨架并安装', () => {
        const result = runGenerate(tempRoot, {
            type: 'tr_tools',
            name: 'env-check',
            desc: '环境检查',
        });
        expect(result.skillName).toBe('venus_tr_tools_env_check');

        const sourceFile = path.join(tempRoot, 'skills', 'venus_tr_tools_env_check', 'SKILL.md');
        const installedFile = path.join(tempRoot, '.claude', 'skills', 'venus_tr_tools_env_check', 'SKILL.md');
        expect(fs.existsSync(sourceFile)).toBe(true);
        expect(fs.existsSync(installedFile)).toBe(true);

        const content = fs.readFileSync(sourceFile, 'utf8');
        expect(content).toContain('name: venus_tr_tools_env_check');
        expect(content).toContain('环境检查');
        expect(content).toContain('（待补充技能正文）');
    });

    it('生成的技能能被 list 扫描到（类型为 tr_tools）', () => {
        const skills = scanInstalledSkills(tempRoot);
        const generated = skills.find((s) => s.name === 'venus_tr_tools_env_check');
        expect(generated?.type).toBe('tr_tools');
    });

    it('重复生成同名技能抛错，--force 覆盖', () => {
        expect(() => runGenerate(tempRoot, { type: 'tr_tools', name: 'env-check' })).toThrow(/已存在/);
        expect(() => runGenerate(tempRoot, { type: 'tr_tools', name: 'env-check', force: true })).not.toThrow();
    });

    it('非法类型与非法命名抛错', () => {
        expect(() => runGenerate(tempRoot, { type: 'tr_unknown', name: 'x' })).toThrow(/未知的技能类型/);
        expect(() => runGenerate(tempRoot, { type: 'tr_tools', name: 'BadName' })).toThrow(/kebab-case/);
    });
});

describe('workflows 过滤（profile 生效）', () => {
    /** 建独立临时项目（隔离主 fixture 的全量配置） */
    function freshRoot(): string {
        return fs.mkdtempSync(path.join(os.tmpdir(), 'venus-wf-'));
    }

    it('未配置 workflows 时 init 装默认集 8 个', () => {
        const root = freshRoot();
        try {
            const result = runInit(root);
            expect(result.workflowsSource).toBe('default');
            expect(result.skillsInstalled.length).toBe(8);
            expect(result.commandsInstalled.length).toBe(8);
            expect(result.injectedDeps).toEqual([]);
            // 默认集内技能存在
            expect(
                fs.existsSync(path.join(root, '.claude', 'skills', 'venus_tr_init_project', 'SKILL.md'))
            ).toBe(true);
            // 非默认集技能不存在
            expect(
                fs.existsSync(path.join(root, '.claude', 'skills', 'venus_tr_impl_feature', 'SKILL.md'))
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
            // spec-propose 注入 spec-verify-proposal：2 项 + 1 注入 = 3
            expect(result.skillsInstalled.length).toBe(3);
            expect(result.injectedDeps).toEqual(['spec-verify-proposal']);
            expect(
                fs.existsSync(path.join(root, '.claude', 'skills', 'venus_spec_verify_proposal', 'SKILL.md'))
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
            // 遗留 25 个技能 + 25 个指令（26 - spec-explore），保留未删
            expect(result.reconcileOrphans.skills.length).toBe(25);
            expect(result.reconcileOrphans.commands.length).toBe(25);
            expect(
                result.reconcileOrphans.skills.some((s) => s.includes('venus_tr_impl_feature'))
            ).toBe(true);
            expect(
                fs.existsSync(path.join(root, '.claude', 'skills', 'venus_tr_impl_feature', 'SKILL.md'))
            ).toBe(true);
            expect(
                fs.existsSync(path.join(root, '.claude', 'commands', 'venus', 'tr-impl-feature.md'))
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
            const orphanFile = path.join(root, '.claude', 'skills', 'venus_tr_impl_feature', 'SKILL.md');
            fs.mkdirSync(path.dirname(orphanFile), { recursive: true });
            fs.writeFileSync(orphanFile, 'old orphan content', 'utf8');

            const result = runUpdate(root);
            expect(result.workflowsSource).toBe('user');
            expect(result.commandsWritten).toBe(0); // 配置集内一致，幂等
            // 非配置集产物保留原内容
            expect(fs.readFileSync(orphanFile, 'utf8')).toBe('old orphan content');
            expect(result.reconcileOrphans.skills.some((s) => s.includes('venus_tr_impl_feature'))).toBe(true);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
