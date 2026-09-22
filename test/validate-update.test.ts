/**
 * validate / update 命令测试。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runInit } from '../src/commands/init.js';
import { runValidate, runValidateCommand } from '../src/commands/validate.js';
import { runUpdate } from '../src/commands/update.js';
import { getSkillTemplates } from '../src/core/templates/index.js';
import { ensureProjectConfig, writeWorkflowsToConfig } from '../src/core/project-config.js';

let tempRoot: string;

beforeAll(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'venus-validate-'));
    // 配置全量 workflows，让 init 装全部 26 个技能（默认集仅 7 个）
    ensureProjectConfig(tempRoot);
    writeWorkflowsToConfig(tempRoot, getSkillTemplates().map((e) => e.commandId));
});

afterAll(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('venus validate', () => {
    it('init 后全部技能通过校验', () => {
        runInit(tempRoot);
        const result = runValidate(tempRoot);
        expect(result.total).toBe(26);
        expect(result.failed).toBe(0);
        expect(result.issues.filter((i) => i.level === 'CRITICAL')).toHaveLength(0);
    });

    it('JSON 输出结构合法，退出码 0', () => {
        const { output, exitCode } = runValidateCommand(tempRoot, { json: true });
        const parsed = JSON.parse(output) as { total: number; passed: number; failed: number };
        expect(parsed.total).toBe(26);
        expect(parsed.passed).toBe(26);
        expect(exitCode).toBe(0);
    });

    it('手改破坏 name/description/type 后报 CRITICAL 且退出码 1', () => {
        const skillFile = path.join(tempRoot, '.claude', 'skills', 'venus_tr_tools_pwd', 'SKILL.md');
        const original = fs.readFileSync(skillFile, 'utf8');
        // 破坏：name 与目录名不一致 + 删除 description 行
        const broken = original
            .replace('name: venus_tr_tools_pwd', 'name: venus_wrong_name')
            .replace(/^description: .+\n/m, '');
        fs.writeFileSync(skillFile, broken, 'utf8');

        const { output, exitCode } = runValidateCommand(tempRoot);
        expect(exitCode).toBe(1);
        expect(output).toContain('CRITICAL');
        expect(output).toContain('venus_tr_tools_pwd');
        expect(output).toContain('不一致');
        expect(output).toContain('缺少 description');

        // 还原
        fs.writeFileSync(skillFile, original, 'utf8');
    });

    it('frontmatter 缺 allowed-tools 报 CRITICAL', () => {
        const skillFile = path.join(tempRoot, '.claude', 'skills', 'venus_tr_tools_list', 'SKILL.md');
        const original = fs.readFileSync(skillFile, 'utf8');
        const broken = original.replace(/^allowed-tools: .+\n/m, '');
        fs.writeFileSync(skillFile, broken, 'utf8');

        const result = runValidate(tempRoot);
        expect(result.failed).toBe(1);
        const issue = result.issues.find((i) => i.skill === 'venus_tr_tools_list');
        expect(issue?.message).toContain('allowed-tools');

        // 还原
        fs.writeFileSync(skillFile, original, 'utf8');
    });

    it('非 venus 前缀技能不被校验', () => {
        const otherDir = path.join(tempRoot, '.claude', 'skills', 'other_skill');
        fs.mkdirSync(otherDir, { recursive: true });
        const result = runValidate(tempRoot);
        expect(result.results.find((r) => r.skill === 'other_skill')).toBeUndefined();
        fs.rmSync(otherDir, { recursive: true, force: true });
    });
});

describe('venus update', () => {
    it('内容一致时幂等（无安装、无升级、无跳过）', () => {
        const result = runUpdate(tempRoot);
        expect(result.installed).toHaveLength(0);
        expect(result.updated).toHaveLength(0);
        expect(result.skippedModified).toHaveLength(0);
        expect(result.commandsWritten).toBe(0);
    });

    it('删除一个技能后 update 重新安装', () => {
        const skillDir = path.join(tempRoot, '.claude', 'skills', 'venus_tr_test_generate');
        fs.rmSync(skillDir, { recursive: true, force: true });
        const result = runUpdate(tempRoot);
        expect(result.installed.length).toBe(1);
        expect(result.installed[0]).toContain('venus_tr_test_generate');
        // 恢复后再次 update 幂等
        expect(runUpdate(tempRoot).installed).toHaveLength(0);
    });

    it('用户手改的技能被跳过保护，--force 才覆盖', () => {
        const skillFile = path.join(tempRoot, '.claude', 'skills', 'venus_tr_review_code', 'SKILL.md');
        const original = fs.readFileSync(skillFile, 'utf8');
        // 模拟用户手改（generatedBy 仍是当前版本，但内容不同）
        fs.writeFileSync(skillFile, original + '\n<!-- 用户自定义补充 -->\n', 'utf8');

        const protectedResult = runUpdate(tempRoot);
        expect(protectedResult.skippedModified.length).toBe(1);
        expect(protectedResult.skippedModified[0]).toContain('venus_tr_review_code');

        const forcedResult = runUpdate(tempRoot, { force: true });
        expect(forcedResult.updated.length).toBe(1);
        expect(forcedResult.updated[0]).toContain('venus_tr_review_code');
        // 覆盖后内容与内置一致（以 frontmatter 头与正文结束符验证）
        const after = fs.readFileSync(skillFile, 'utf8');
        const [{ template }] = getSkillTemplates('tr_review');
        expect(after).toContain(`name: ${template.name}`);
        expect(after).toContain(template.instructions.slice(0, 30));
        expect(after).not.toContain('用户自定义补充');

        // 恢复一致性
        runUpdate(tempRoot, { force: true });
    });
});
