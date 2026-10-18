/**
 * 跨宿主冒烟回归（变更 add-host-orchestration-adapters，任务 7.1）。
 *
 * 以端到端 init 覆盖：参数传递、技能加载、宿主原生委派、门/回执契约声明、
 * 以及 Claude / OpenCode V2 / Pi strict / Pi degraded 四种形态的状态与失败诊断。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runInit } from '../src/commands/init.js';
import { ensureProjectConfig, writeWorkflowsToConfig } from '../src/core/project-config.js';
import type { PiCommandRunner } from '../src/core/pi-runtime.js';

/** 每例独立临时项目，含 workflow 编排技能 */
function makeRoot(prefix: string): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `iagent-smoke-${prefix}-`));
    ensureProjectConfig(root);
    writeWorkflowsToConfig(root, ['workflow', 'spec-explore']);
    return root;
}

/** Pi 运行时模拟执行器 */
const piStrictRunner: PiCommandRunner = (cmd, args) => {
    if (cmd === 'pi' && args[0] === '--version') return { status: 0, stdout: '1.2.0' };
    if (cmd === 'pi' && args[0] === 'list') return { status: 0, stdout: '@tintinweb/pi-subagents' };
    return { status: 0, stdout: '' };
};
const piMissingRunner: PiCommandRunner = (cmd, args) => {
    if (cmd === 'pi' && args[0] === '--version') return { status: 0, stdout: '1.2.0' };
    if (cmd === 'pi' && args[0] === 'list') return { status: 0, stdout: '' };
    if (cmd === 'pi' && args[0] === 'install') return { status: 1, stdout: '' };
    return { status: 1, stdout: '' };
};

/** 读取技能产物 */
function readSkill(root: string, dir: string): string {
    return fs.readFileSync(path.join(root, dir, 'SKILL.md'), 'utf8');
}

describe('跨宿主冒烟：Claude Code', () => {
    let root: string;
    beforeAll(() => {
        root = makeRoot('claude');
        runInit(root, { tools: 'claude' });
    });
    afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

    it('技能加载 + Claude 原生委派 + 门/回执契约', () => {
        const wf = readSkill(root, '.claude/skills/iagent-workflow');
        expect(wf).toContain('name: iagent-workflow');
        expect(wf).toContain('allowed-tools:');
        expect(wf).toContain('宿主编排适配（生成期注入）');
        expect(wf).toContain('Skill 工具委派');
        expect(wf).toContain('回执契约');
        expect(wf).toContain('确认门');
    });
});

describe('跨宿主冒烟：OpenCode V2', () => {
    let root: string;
    beforeAll(() => {
        root = makeRoot('opencode');
        runInit(root, { tools: 'opencode' });
    });
    afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

    it('native skill/subagent + agent 元数据 + 项目 permissions + 参数传递', () => {
        // 技能与委派：使用 V2 语义，不用 Claude Skill 工具
        const wf = readSkill(root, '.opencode/skills/iagent-workflow');
        expect(wf).toContain('subagent');
        expect(wf).not.toContain('Skill 工具委派');

        // 指令在 orchestrator 会话中运行
        const cmd = fs.readFileSync(
            path.join(root, '.opencode', 'commands', 'iagent-spec-explore.md'),
            'utf8'
        );
        expect(cmd).toContain('agent: iagent-orchestrator');
        expect(cmd).toContain('**Provided arguments**: $ARGUMENTS');

        // 项目级 agents + permissions
        expect(fs.existsSync(path.join(root, '.opencode', 'agents', 'iagent-orchestrator.md'))).toBe(true);
        const config = JSON.parse(fs.readFileSync(path.join(root, '.opencode', 'opencode.jsonc'), 'utf8'));
        expect(config.permissions.some((r: { action: string }) => r.action === 'subagent')).toBe(true);
        // 不写 Claude 权限载体
        expect(fs.existsSync(path.join(root, '.opencode', 'settings.json'))).toBe(false);
    });
});

describe('跨宿主冒烟：Pi strict', () => {
    let root: string;
    beforeAll(() => {
        root = makeRoot('pistrict');
        runInit(root, { tools: 'pi', piRuntimeRunner: piStrictRunner });
    });
    afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

    it('Runtime Extension 委派 + 参数占位符 + strict 元数据', () => {
        const wf = readSkill(root, '.pi/skills/iagent-workflow');
        expect(wf).toContain('strict 编排');
        expect(wf).toContain('Runtime Extension');
        expect(wf).not.toContain('Skill 工具委派');
        expect(wf).not.toMatch(/^\s*allowed-tools:/m);
        expect(wf).not.toContain('iagent_spec_');

        const meta = JSON.parse(fs.readFileSync(path.join(root, '.iagent', 'pi-runtime.json'), 'utf8'));
        expect(meta.orchestration).toBe('strict');
        expect(meta.package).toBe('@tintinweb/pi-subagents');
    });
});

describe('跨宿主冒烟：Pi degraded', () => {
    let root: string;
    beforeAll(() => {
        root = makeRoot('pidegraded');
        runInit(root, { tools: 'pi', piRuntimeRunner: piMissingRunner });
    });
    afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

    it('声明 degraded 且不伪装委派完成', () => {
        const wf = readSkill(root, '.pi/skills/iagent-workflow');
        expect(wf).toContain('degraded 单 agent 模式');
        expect(wf).toContain('不构成委派');
        expect(wf).not.toContain('Skill 工具委派');
        expect(wf).not.toMatch(/^\s*allowed-tools:/m);
        expect(wf).not.toContain('iagent_spec_');

        const meta = JSON.parse(fs.readFileSync(path.join(root, '.iagent', 'pi-runtime.json'), 'utf8'));
        expect(meta.orchestration).toBe('degraded');
        expect(meta.reasons.join(' ')).toContain('pi install');
    });

    it('技能与指令产物仍完整生成（degraded 不阻断）', () => {
        expect(fs.existsSync(path.join(root, '.pi', 'skills', 'iagent-workflow', 'SKILL.md'))).toBe(true);
        expect(fs.existsSync(path.join(root, '.pi', 'prompts', 'iagent-spec-explore.md'))).toBe(true);
    });
});
