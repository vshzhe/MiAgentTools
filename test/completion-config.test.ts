/**
 * shell 补全 / onboarding / 项目配置 三特性测试。
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
    serializeProjectConfig,
    readProjectConfig,
    defaultProjectConfig,
    CONFIG_FILE_NAME,
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
    it('包含生命周期顺序的指令引导', () => {
        const output = renderOnboardingHints();
        expect(output).toContain('/venus:tools-pwd');
        expect(output).toContain('/venus:impl-feature');
        expect(output).toContain('/venus:commit-change');
        expect(output).toContain('/venus:review-code');
        expect(output).toContain('venus list');
    });
});

describe('项目配置文件', () => {
    it('解析 round-trip：serialize → parse 内容保持', () => {
        const config = defaultProjectConfig();
        config.context = '技术栈：TypeScript\n包管理器：pnpm';
        config.rules = { tr_impl: ['遵循分层架构', '禁止跨层调用'], tr_test: ['与既有用例风格一致'] };

        const parsed = parseProjectConfig(serializeProjectConfig(config));
        expect(parsed.context).toBe(config.context);
        expect(parsed.rules.tr_impl).toEqual(['遵循分层架构', '禁止跨层调用']);
        expect(parsed.rules.tr_test).toEqual(['与既有用例风格一致']);
    });

    it('解析容忍注释与未知行', () => {
        const raw = [
            '# 注释行',
            'context: |',
            '  项目背景',
            '',
            'rules:',
            '  # 类型注释',
            '  tr_impl:',
            '    - 规则A',
            '未知键: 忽略',
        ].join('\n');
        const parsed = parseProjectConfig(raw);
        expect(parsed.context).toBe('项目背景');
        expect(parsed.rules.tr_impl).toEqual(['规则A']);
    });

    it('init 创建配置模板，重复 init 保留已改内容', () => {
        const result1 = runInit(tempRoot);
        expect(result1.configState).toBe('created');

        const configPath = path.join(tempRoot, CONFIG_FILE_NAME);
        expect(fs.existsSync(configPath)).toBe(true);

        // 用户修改配置
        fs.writeFileSync(
            configPath,
            serializeProjectConfig({ context: '我的项目', rules: { tr_commit: ['提交信息用中文'] } }),
            'utf8'
        );

        const result2 = runInit(tempRoot, { force: true });
        expect(result2.configState).toBe('exists');
        expect(readProjectConfig(tempRoot)?.context).toBe('我的项目');
    });

    it('generate 将配置的 context 与 rules 注入骨架正文', () => {
        const result = runGenerate(tempRoot, { type: 'tr_commit', name: 'lint-check' });
        const content = fs.readFileSync(path.join(tempRoot, 'skills', result.skillName, 'SKILL.md'), 'utf8');
        expect(content).toContain('我的项目');
        expect(content).toContain('提交信息用中文');
        expect(content).toContain('venus.config.yaml');
    });

    it('无配置文件时 generate 生成普通骨架', () => {
        const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'venus-nocfg-'));
        try {
            const result = runGenerate(emptyRoot, { type: 'tr_impl', name: 'plain' });
            const content = fs.readFileSync(path.join(emptyRoot, 'skills', result.skillName, 'SKILL.md'), 'utf8');
            expect(content).not.toContain('venus.config.yaml');
            expect(content).toContain('需要遵守的边界与规范');
        } finally {
            fs.rmSync(emptyRoot, { recursive: true, force: true });
        }
    });
});
