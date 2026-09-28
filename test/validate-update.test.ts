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
import {
    generateSkillContent,
    fingerprintOf,
    readGeneratedFingerprint,
} from '../src/core/command-generation/index.js';

let tempRoot: string;

beforeAll(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'venus-validate-'));
    // 配置全量 workflows，让 init 装全部 27 个技能（默认集仅 7 个）
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
        expect(result.total).toBe(27);
        expect(result.failed).toBe(0);
        expect(result.issues.filter((i) => i.level === 'CRITICAL')).toHaveLength(0);
    });

    it('JSON 输出结构合法，退出码 0', () => {
        const { output, exitCode } = runValidateCommand(tempRoot, { json: true });
        const parsed = JSON.parse(output) as { total: number; passed: number; failed: number };
        expect(parsed.total).toBe(27);
        expect(parsed.passed).toBe(27);
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

/**
 * 手改保护判定的回归用例。
 *
 * 背景：原实现只用 `generatedBy` 版本号推断是否手改，导致两个方向的错误 ——
 *   (1) 模板正文变更而版本号未递增时，产物被误判为"手改"而无法升级（须 --force）；
 *   (2) 包版本号一旦递增，被手改的旧版本产物反被当作"可升级"而静默覆盖。
 * 改用内容指纹后两个方向都应正确。
 */
describe('venus update 手改保护判定（内容指纹）', () => {
    const SKILL = 'venus_tr_review_code';

    /** 读取目标技能的已装产物路径 */
    function skillFile(): string {
        return path.join(tempRoot, '.claude', 'skills', SKILL, 'SKILL.md');
    }

    /** 把给定内容写成"指纹与自身自洽"的形态（模拟 venus 曾写入该内容） */
    function stampSelfConsistent(content: string): string {
        return content.replace(
            /^  generatedFingerprint: ".*"$/m,
            `  generatedFingerprint: "${fingerprintOf(content)}"`
        );
    }

    it('指纹确定性：同一 (template, version) 恒得同一产物与同一指纹', () => {
        const [{ template }] = getSkillTemplates('tr_review');
        const first = generateSkillContent(template, 'snapshot').fileContent;
        const second = generateSkillContent(template, 'snapshot').fileContent;
        // 快照防漂移（test/skills-parity.test.ts 的字节级比较）依赖此确定性
        expect(first).toBe(second);
        // 新生成产物的指纹必须自洽，否则下次 update 会把自己写的内容判为手改
        expect(readGeneratedFingerprint(first)).toBe(fingerprintOf(first));
    });

    it('模板正文变更而版本号未递增时仍能升级（本题核心）', () => {
        const file = skillFile();
        const installed = fs.readFileSync(file, 'utf8');
        const [{ template }] = getSkillTemplates('tr_review');
        // 模拟"venus 曾用旧模板写入的产物"：正文与当前模板不同，
        // 但指纹与自身自洽（即未被用户改动）；generatedBy 保持当前版本
        // 用函数式替换：模板正文可能含 `$`，作为替换串会被当特殊模式解析
        const stale = stampSelfConsistent(
            installed.replace(template.instructions, () => `${template.instructions}\n（旧版正文）\n`)
        );
        fs.writeFileSync(file, stale, 'utf8');

        const result = runUpdate(tempRoot);
        expect(result.skippedModified).toHaveLength(0);
        expect(result.updated.map((p) => path.basename(path.dirname(p)))).toContain(SKILL);
        expect(fs.readFileSync(file, 'utf8')).not.toContain('（旧版正文）');
        // 恢复一致性
        runUpdate(tempRoot, { force: true });
    });

    it('被手改的旧版本产物不再被静默覆盖（修反向缺陷）', () => {
        const file = skillFile();
        const installed = fs.readFileSync(file, 'utf8');
        // 手改内容，并把 generatedBy 改成旧版本号 —— 原实现会因此判为"可升级"而覆盖
        const modified = installed
            .replace(/^  generatedBy: ".*"$/m, '  generatedBy: "0.0.1"')
            .concat('\n<!-- 用户自定义补充 -->\n');
        fs.writeFileSync(file, modified, 'utf8');

        const result = runUpdate(tempRoot);
        expect(result.updated).toHaveLength(0);
        expect(result.skippedModified.map((p) => path.basename(path.dirname(p)))).toContain(SKILL);
        // 手改内容必须原样保留
        expect(fs.readFileSync(file, 'utf8')).toContain('用户自定义补充');
        // 恢复一致性
        runUpdate(tempRoot, { force: true });
        expect(fs.readFileSync(file, 'utf8')).not.toContain('用户自定义补充');
    });

    it('存量产物（无指纹）回退到版本号判定：版本不一致则升级', () => {
        const file = skillFile();
        const legacy = fs
            .readFileSync(file, 'utf8')
            .replace(/^  generatedFingerprint: ".*"\n/m, '')
            .replace(/^  generatedBy: ".*"$/m, '  generatedBy: "0.0.1"');
        fs.writeFileSync(file, legacy, 'utf8');

        const result = runUpdate(tempRoot);
        expect(result.skippedModified).toHaveLength(0);
        expect(result.updated.map((p) => path.basename(path.dirname(p)))).toContain(SKILL);
        // 升级后即带上指纹，保护转为精确判定
        expect(readGeneratedFingerprint(fs.readFileSync(file, 'utf8'))).toBeDefined();
    });

    it('存量产物（无指纹）回退到版本号判定：版本一致且内容不同则跳过保护', () => {
        const file = skillFile();
        const legacy = fs
            .readFileSync(file, 'utf8')
            .replace(/^  generatedFingerprint: ".*"\n/m, '')
            .concat('\n<!-- 用户自定义补充 -->\n');
        fs.writeFileSync(file, legacy, 'utf8');

        const result = runUpdate(tempRoot);
        expect(result.updated).toHaveLength(0);
        expect(result.skippedModified.map((p) => path.basename(path.dirname(p)))).toContain(SKILL);
        // 恢复一致性
        runUpdate(tempRoot, { force: true });
    });

    it('CRLF 行尾污染不应被误判为手改', () => {
        const file = skillFile();
        // 行尾全部转为 CRLF —— 内容语义未变，不应触发手改保护
        const crlf = fs.readFileSync(file, 'utf8').replaceAll('\n', '\r\n');
        fs.writeFileSync(file, crlf, 'utf8');

        const result = runUpdate(tempRoot);
        expect(result.skippedModified).toHaveLength(0);
        // 恢复一致性
        runUpdate(tempRoot, { force: true });
    });
});
