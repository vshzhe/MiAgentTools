/**
 * shell 补全 / onboarding / 项目配置（.venus/ 目录）三特性测试。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    generateBashCompletion,
    generatePowerShellCompletion,
    isCompletionShell,
} from '../src/commands/completion.js';
import { renderOnboardingHints } from '../src/commands/onboarding.js';
import {
    parseProjectConfig,
    readProjectConfig,
    defaultConfigFileContent,
    defaultRuleFileContent,
    listRuleFiles,
    CONFIG_FILE_NAME,
    RULES_DIR_NAME,
    ensureProjectConfig,
    writeWorkflowsToConfig,
} from '../src/core/project-config.js';
import { runInit } from '../src/commands/init.js';
import { runGenerate } from '../src/commands/generate.js';

let tempRoot: string;

beforeAll(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'venus-feat-'));
});

afterAll(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('shell 补全脚本生成', () => {
    it('bash 脚本包含 5 个命令与 complete 注册', () => {
        const script = generateBashCompletion();
        for (const cmd of ['init', 'list', 'validate', 'update', 'generate']) {
            expect(script).toContain(cmd);
        }
        expect(script).toContain('complete -F _venus_completion venus');
    });

    it('bash 脚本包含子命令选项补全', () => {
        const script = generateBashCompletion();
        expect(script).toContain('--type');
        expect(script).toContain('--force');
        expect(script).toContain('--json');
    });

    it('PowerShell 脚本包含 Register-ArgumentCompleter', () => {
        const script = generatePowerShellCompletion();
        expect(script).toContain('Register-ArgumentCompleter -CommandName venus');
        for (const cmd of ['init', 'list', 'validate', 'update', 'generate']) {
            expect(script).toContain(`"${cmd}"`);
        }
    });

    it('shell 参数校验', () => {
        expect(isCompletionShell('bash')).toBe(true);
        expect(isCompletionShell('powershell')).toBe(true);
        expect(isCompletionShell('zsh')).toBe(false);
    });
});

describe('onboarding 提示', () => {
    it('默认集提示包含 spec 核心与 tr-init-project', () => {
        const output = renderOnboardingHints();
        // 默认集 7 个（tr-init-project + spec 全 6）
        expect(output).toContain('/venus:tr-init-project');
        expect(output).toContain('/venus:spec-explore');
        expect(output).toContain('/venus:spec-propose');
        expect(output).toContain('/venus:spec-apply');
        expect(output).toContain('/venus:spec-archive');
        expect(output).toContain('venus list');
        expect(output).toContain('venus config');
        // 非默认 workflow 不在默认提示中
        expect(output).not.toContain('/venus:tr-impl-feature');
    });

    it('按传入 workflow 集过滤提示', () => {
        const output = renderOnboardingHints(['tr-impl-feature', 'tr-commit-change']);
        expect(output).toContain('/venus:tr-impl-feature');
        expect(output).toContain('/venus:tr-commit-change');
        expect(output).not.toContain('/venus:spec-explore');
    });
});

describe('项目配置（.venus/ 目录结构）', () => {
    it('默认 config 内容包含 context 与 rules 引用', () => {
        const content = defaultConfigFileContent();
        expect(content).toContain('context: |');
        expect(content).toContain('- tr_impl');
        expect(content).toContain('- tr_test');
    });

    it('解析 config：context 块 + rules 引用列表', () => {
        const parsed = parseProjectConfig(defaultConfigFileContent());
        expect(parsed.context).toContain('项目背景');
        expect(parsed.rules).toEqual(['tr_impl', 'tr_test', 'spec']);
    });

    it('解析容忍注释与未知项', () => {
        const raw = ['# 注释', 'context: |', '  项目背景', '', 'rules:', '  - tr_commit', '  - 未知项'].join('\n');
        const parsed = parseProjectConfig(raw);
        expect(parsed.context).toBe('项目背景');
        expect(parsed.rules).toEqual(['tr_commit']);
    });

    it('init 创建 .venus/config.yaml + rules/ 结构', () => {
        const result = runInit(tempRoot);
        expect(result.configState).toBe('created');

        const configPath = path.join(tempRoot, CONFIG_FILE_NAME);
        const rulesDir = path.join(tempRoot, RULES_DIR_NAME);
        expect(fs.existsSync(configPath)).toBe(true);
        expect(fs.existsSync(rulesDir)).toBe(true);
        // 默认规则文件
        expect(fs.existsSync(path.join(rulesDir, 'tr_impl.md'))).toBe(true);
        expect(fs.existsSync(path.join(rulesDir, 'tr_test.md'))).toBe(true);
        expect(result.ruleFilesCreated.length).toBe(3);
    });

    it('重复 init 保留用户修改的 config 与规则文件', () => {
        // 用户修改 context 与规则
        const configPath = path.join(tempRoot, CONFIG_FILE_NAME);
        fs.writeFileSync(
            configPath,
            ['context: |', '  我的项目背景', '', 'rules:', '  - tr_commit'].join('\n') + '\n',
            'utf8'
        );
        const commitRule = path.join(tempRoot, RULES_DIR_NAME, 'tr_commit.md');
        fs.writeFileSync(commitRule, '提交信息用中文\n遵守 Conventional Commits\n', 'utf8');

        const result2 = runInit(tempRoot, { force: true });
        expect(result2.configState).toBe('exists');
        expect(result2.ruleFilesCreated).toHaveLength(0);

        const resolved = readProjectConfig(tempRoot);
        expect(resolved?.context).toBe('我的项目背景');
        expect(resolved?.rules.tr_commit).toEqual(['提交信息用中文', '遵守 Conventional Commits']);
    });

    it('config 引用但文件缺失的类型记入 missingRuleFiles', () => {
        const resolved = readProjectConfig(tempRoot);
        // 上一用例的 config 只引用了 tr_commit（文件已创建），再引用一个不存在的
        const configPath = path.join(tempRoot, CONFIG_FILE_NAME);
        fs.writeFileSync(
            configPath,
            ['context: |', '  背景', '', 'rules:', '  - tr_release'].join('\n') + '\n',
            'utf8'
        );
        const after = readProjectConfig(tempRoot);
        expect(after?.missingRuleFiles).toContain('tr_release');
        void resolved;
    });

    it('listRuleFiles 列出合法类型规则文件', () => {
        const files = listRuleFiles(tempRoot);
        expect(files.some((f) => f.includes('tr_impl.md'))).toBe(true);
        expect(files.some((f) => f.includes('tr_test.md'))).toBe(true);
        expect(files.some((f) => f.includes('tr_commit.md'))).toBe(true);
    });

    it('generate 将 context 与该类型 rules 注入骨架正文', () => {
        // config 引用 tr_commit + 已有规则文件
        const configPath = path.join(tempRoot, CONFIG_FILE_NAME);
        fs.writeFileSync(
            configPath,
            ['context: |', '  我的项目背景', '', 'rules:', '  - tr_commit'].join('\n') + '\n',
            'utf8'
        );
        const result = runGenerate(tempRoot, { type: 'tr_commit', name: 'lint-check' });
        const content = fs.readFileSync(path.join(tempRoot, 'skills', result.skillName, 'SKILL.md'), 'utf8');
        expect(content).toContain('我的项目背景');
        expect(content).toContain('.venus/config.yaml');
        expect(content).toContain('.venus/rules/');
        expect(content).toContain('提交信息用中文');
    });

    it('未引用的类型规则不注入（显式 include 语义）', () => {
        // config 只引用 tr_commit，tr_impl 的规则文件存在但不应注入
        const result = runGenerate(tempRoot, { type: 'tr_impl', name: 'no-ref' });
        const content = fs.readFileSync(path.join(tempRoot, 'skills', result.skillName, 'SKILL.md'), 'utf8');
        expect(content).not.toContain('分层架构');
        expect(content).toContain('需要遵守的边界与规范');
    });

    it('无 .venus 目录时 generate 生成普通骨架', () => {
        const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'venus-nocfg-'));
        try {
            const result = runGenerate(emptyRoot, { type: 'tr_impl', name: 'plain' });
            const content = fs.readFileSync(path.join(emptyRoot, 'skills', result.skillName, 'SKILL.md'), 'utf8');
            expect(content).not.toContain('.venus');
            expect(content).toContain('需要遵守的边界与规范');
        } finally {
            fs.rmSync(emptyRoot, { recursive: true, force: true });
        }
    });

    it('默认规则文件内容包含该类型引导', () => {
        const impl = defaultRuleFileContent('tr_impl');
        expect(impl).toContain('分层架构');
        expect(impl).toContain('#');
    });
});

describe('workflows 字段（profile 配置）', () => {
    it('默认 config 内容含默认集 7 项', () => {
        const content = defaultConfigFileContent();
        expect(content).toContain('workflows:');
        expect(content).toContain('- tr-init-project');
        expect(content).toContain('- spec-explore');
        expect(content).toContain('- spec-verify-proposal');

        const parsed = parseProjectConfig(content);
        expect(parsed.workflows.length).toBe(7);
        expect(parsed.workflows).toContain('tr-init-project');
        expect(parsed.workflows).toContain('spec-archive');
    });

    it('解析 workflows 列表项', () => {
        const raw = [
            'context: |',
            '  背景',
            '',
            'workflows:',
            '  - tr-impl-feature',
            '  - spec-explore',
        ].join('\n');
        const parsed = parseProjectConfig(raw);
        expect(parsed.workflows).toEqual(['tr-impl-feature', 'spec-explore']);
    });

    it('无 workflows 字段时解析为空数组（用默认集）', () => {
        const raw = ['context: |', '  背景', '', 'rules:', '  - tr_impl'].join('\n');
        const parsed = parseProjectConfig(raw);
        expect(parsed.workflows).toEqual([]);
    });

    it('writeWorkflowsToConfig 替换已有 workflows 段且保留 context/rules', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'venus-wf-write-'));
        try {
            ensureProjectConfig(root);
            writeWorkflowsToConfig(root, ['spec-propose']);
            let resolved = readProjectConfig(root);
            expect(resolved?.workflows).toEqual(['spec-propose']);

            // 再次写回替换
            writeWorkflowsToConfig(root, ['tr-init-project', 'spec-explore']);
            resolved = readProjectConfig(root);
            expect(resolved?.workflows).toEqual(['tr-init-project', 'spec-explore']);
            // context/rules 段保留
            expect(resolved?.context).toContain('项目背景');
            expect(resolved?.rules).toBeTruthy();
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
