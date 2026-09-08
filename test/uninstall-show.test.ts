/**
 * uninstall / show 命令测试。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runInit } from '../src/commands/init.js';
import { runGenerate } from '../src/commands/generate.js';
import { runUninstall, previewUninstall } from '../src/commands/uninstall.js';
import { runShow, findSkills } from '../src/commands/show.js';

let tempRoot: string;

beforeAll(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'venus-uninst-'));
});

afterAll(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('venus uninstall', () => {
    it('init + generate 后干跑预览不删文件', () => {
        runInit(tempRoot);
        runGenerate(tempRoot, { type: 'tr_tools', name: 'extra-one' });

        const preview = previewUninstall(tempRoot);
        expect(preview.removedSkills.length).toBe(9); // 8 内置 + 1 生成
        expect(preview.removedCommands.length).toBe(8);
        // 未删除：文件仍在
        expect(fs.existsSync(path.join(tempRoot, '.claude', 'skills', 'venus_tr_tools_pwd', 'SKILL.md'))).toBe(true);
    });

    it('非 venus 技能不被删除', () => {
        const otherDir = path.join(tempRoot, '.claude', 'skills', 'other_tool_skill');
        fs.mkdirSync(otherDir, { recursive: true });
        fs.writeFileSync(path.join(otherDir, 'SKILL.md'), 'other', 'utf8');

        const result = runUninstall(tempRoot, { yes: true });
        expect(result.removedSkills.length).toBe(9);
        expect(result.skipped.some((s) => s.includes('other_tool_skill'))).toBe(true);
        // 其他技能保留
        expect(fs.existsSync(path.join(otherDir, 'SKILL.md'))).toBe(true);
        // venus 技能已删
        expect(fs.existsSync(path.join(tempRoot, '.claude', 'skills', 'venus_tr_tools_pwd'))).toBe(false);
        // 指令目录已删
        expect(fs.existsSync(path.join(tempRoot, '.claude', 'commands', 'venus'))).toBe(false);
    });

    it('默认保留 .venus 配置，--purge-config 一并删除', () => {
        // 重新 init（含 .venus 配置）
        runInit(tempRoot);
        expect(fs.existsSync(path.join(tempRoot, '.venus', 'config.yaml'))).toBe(true);

        runUninstall(tempRoot, { yes: true });
        expect(fs.existsSync(path.join(tempRoot, '.venus', 'config.yaml'))).toBe(true);

        runUninstall(tempRoot, { yes: true, purgeConfig: true });
        expect(fs.existsSync(path.join(tempRoot, '.venus'))).toBe(false);
    });
});

describe('venus show', () => {
    it('唯一命中展示完整详情', () => {
        runInit(tempRoot);
        const { output, exitCode } = runShow(tempRoot, 'venus_tr_tools_pwd');
        expect(exitCode).toBe(0);
        expect(output).toContain('venus_tr_tools_pwd');
        expect(output).toContain('工具白名单');
        expect(output).toContain('Bash(pwd');
        expect(output).toContain('tr_tools');
        expect(output).toContain('正文预览');
    });

    it('前缀匹配（pwd 片段）', () => {
        const details = findSkills(tempRoot, 'pwd');
        expect(details.length).toBe(1);
        expect(details[0].name).toBe('venus_tr_tools_pwd');
    });

    it('多命中报错并列出候选', () => {
        // tr_tools_ 前缀命中 pwd + list 两个
        const { output, exitCode } = runShow(tempRoot, 'tr_tools');
        expect(exitCode).toBe(1);
        expect(output).toContain('多个');
        expect(output).toContain('venus_tr_tools_pwd');
        expect(output).toContain('venus_tr_tools_list');
    });

    it('未命中报错并列出已安装', () => {
        const { output, exitCode } = runShow(tempRoot, 'no-such-skill');
        expect(exitCode).toBe(1);
        expect(output).toContain('未找到');
        expect(output).toContain('venus_tr_init_project');
    });

    it('JSON 输出结构合法', () => {
        const { output, exitCode } = runShow(tempRoot, 'venus_tr_init_project', { json: true });
        expect(exitCode).toBe(0);
        const parsed = JSON.parse(output) as {
            name: string;
            type: string;
            allowedTools: string;
            file: string;
        };
        expect(parsed.name).toBe('venus_tr_init_project');
        expect(parsed.type).toBe('tr_init');
        expect(parsed.allowedTools).toContain('Bash(ls');
        expect(parsed.file).toContain('SKILL.md');
    });
});
