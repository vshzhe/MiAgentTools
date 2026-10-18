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
import { ensureProjectConfig, writeWorkflowsToConfig } from '../src/core/project-config.js';
import { getSkillTemplates } from '../src/core/templates/index.js';

let tempRoot: string;

beforeAll(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-uninst-'));
    // 配置全量 workflows，让 init 装全部 20 个技能（默认集仅 9 个）
    ensureProjectConfig(tempRoot);
    writeWorkflowsToConfig(tempRoot, getSkillTemplates().map((e) => e.commandId));
});

afterAll(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('iagent uninstall', () => {
    it('init + generate 后干跑预览不删文件', () => {
        runInit(tempRoot);
        runGenerate(tempRoot, { type: 'tools', name: 'extra-one' });

        const preview = previewUninstall(tempRoot);
        expect(preview.removedSkills.length).toBe(63); // (20 内置 + 1 生成) × 3 工具
        expect(preview.removedCommands.length).toBe(61); // 20 内置 × 2 适配器 + Pi 21 个 agent（orchestrator + 20 阶段）
        // 未删除：文件仍在
        expect(fs.existsSync(path.join(tempRoot, '.claude', 'skills', 'iagent-project-init', 'SKILL.md'))).toBe(true);
    });

    it('非 iagent 技能不被删除', () => {
        const otherDir = path.join(tempRoot, '.claude', 'skills', 'other_tool_skill');
        fs.mkdirSync(otherDir, { recursive: true });
        fs.writeFileSync(path.join(otherDir, 'SKILL.md'), 'other', 'utf8');

        const result = runUninstall(tempRoot, { yes: true });
        expect(result.removedSkills.length).toBe(63);
        expect(result.skipped.some((s) => s.includes('other_tool_skill'))).toBe(true);
        // 其他技能保留
        expect(fs.existsSync(path.join(otherDir, 'SKILL.md'))).toBe(true);
        // iagent 技能已删
        expect(fs.existsSync(path.join(tempRoot, '.claude', 'skills', 'iagent-project-init'))).toBe(false);
        // 指令目录已删
        expect(fs.existsSync(path.join(tempRoot, '.claude', 'commands', 'iagent'))).toBe(false);
    });

    it('默认保留 .iagent 配置，--purge-config 一并删除', () => {
        // 重新 init（含 .iagent 配置）
        runInit(tempRoot);
        expect(fs.existsSync(path.join(tempRoot, '.iagent', 'config.yaml'))).toBe(true);

        runUninstall(tempRoot, { yes: true });
        expect(fs.existsSync(path.join(tempRoot, '.iagent', 'config.yaml'))).toBe(true);

        runUninstall(tempRoot, { yes: true, purgeConfig: true });
        expect(fs.existsSync(path.join(tempRoot, '.iagent'))).toBe(false);
    });
});

describe('iagent show', () => {
    it('唯一命中展示完整详情', () => {
        // uninstall purge 可能已删 .iagent，重建全量 config 确保技能被装
        ensureProjectConfig(tempRoot);
        writeWorkflowsToConfig(tempRoot, getSkillTemplates().map((e) => e.commandId));
        runInit(tempRoot);
        const { output, exitCode } = runShow(tempRoot, 'iagent_project_init');
        expect(exitCode).toBe(0);
        expect(output).toContain('iagent-project-init');
        expect(output).toContain('工具白名单');
        expect(output).toContain('Bash(ls');
        expect(output).toContain('init');
        expect(output).toContain('正文预览');
    });

    it('前缀匹配（svn 片段）', () => {
        const details = findSkills(tempRoot, 'svn');
        expect(details.length).toBe(1);
        expect(details[0].name).toBe('iagent-svn-commit');
    });

    it('多命中报错并列出候选', () => {
        // migration 片段命中 iagent-migration + iagent-migration-check 两个
        const { output, exitCode } = runShow(tempRoot, 'migration');
        expect(exitCode).toBe(1);
        expect(output).toContain('多个');
        expect(output).toContain('iagent-migration');
        expect(output).toContain('iagent-migration-check');
    });

    it('未命中报错并列出已安装', () => {
        const { output, exitCode } = runShow(tempRoot, 'no-such-skill');
        expect(exitCode).toBe(1);
        expect(output).toContain('未找到');
        expect(output).toContain('iagent-project-init');
    });

    it('JSON 输出结构合法', () => {
        const { output, exitCode } = runShow(tempRoot, 'iagent_project_init', { json: true });
        expect(exitCode).toBe(0);
        const parsed = JSON.parse(output) as {
            name: string;
            type: string;
            allowedTools: string;
            file: string;
        };
        expect(parsed.name).toBe('iagent-project-init');
        expect(parsed.type).toBe('init');
        expect(parsed.allowedTools).toContain('Bash(ls');
        expect(parsed.file).toContain('SKILL.md');
    });
});

describe('uninstall Pi prompts 删除边界', () => {
    it('只删 iagent-* 前缀文件，保留 opsx-*、用户文件与承载目录', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-uninst-pi-'));
        try {
            ensureProjectConfig(root);
            writeWorkflowsToConfig(root, ['project-init']);
            runInit(root, { tools: 'pi' });

            const prompts = path.join(root, '.pi', 'prompts');
            fs.writeFileSync(path.join(prompts, 'opsx-apply.md'), 'opsx', 'utf8');
            fs.writeFileSync(path.join(prompts, 'user-note.md'), 'mine', 'utf8');

            const result = runUninstall(root, { yes: true });
            expect(result.removedCommands.length).toBeGreaterThan(0);
            expect(fs.existsSync(path.join(prompts, 'opsx-apply.md'))).toBe(true);
            expect(fs.existsSync(path.join(prompts, 'user-note.md'))).toBe(true);
            expect(fs.existsSync(prompts)).toBe(true);
            expect(fs.readdirSync(prompts).filter((n) => n.startsWith('iagent-'))).toEqual([]);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
