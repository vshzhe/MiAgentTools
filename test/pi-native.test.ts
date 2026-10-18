/**
 * Pi 原生 agent 定义回归（变更 fix-pi-native-orchestration）。
 *
 * 覆盖：frontmatter 契约、写入/幂等/纯生成物重建、用户文件边界、
 * 可解析性判定（missing / invalid / name 匹配）与 init 端到端产出。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    PI_AGENT_TOOLS,
    PI_ORCHESTRATOR_AGENT_ID,
    piAgentId,
    removePiNativeAgents,
    renderPiOrchestratorAgent,
    renderPiStageAgent,
    scanPiAgentDefinitions,
    writePiNativeAgents,
} from '../src/core/pi-native.js';
import { runInit } from '../src/commands/init.js';
import { runUpdate } from '../src/commands/update.js';
import { detectPiRuntime, type PiCommandRunner } from '../src/core/pi-runtime.js';
import { ensureProjectConfig, writeWorkflowsToConfig } from '../src/core/project-config.js';
import { scanReconcileOrphans } from '../src/core/reconcile.js';

const STAGES = [
    { workflowId: 'spec-explore', description: '探索阶段：结构化调研与澄清' },
    { workflowId: 'spec-propose', description: '提案阶段：生成变更制品' },
];

const strictRunner: PiCommandRunner = (cmd, args) => {
    if (cmd === 'pi' && args[0] === '--version') return { status: 0, stdout: '1.2.0' };
    if (cmd === 'pi' && args[0] === 'list') return { status: 0, stdout: '@tintinweb/pi-subagents' };
    return { status: 0, stdout: '' };
};

describe('Pi agent frontmatter 契约', () => {
    it('orchestrator 只写内置 tools，嵌套派发由 allowed_subagents 授予', () => {
        const content = renderPiOrchestratorAgent(STAGES);
        expect(content).toContain(`name: ${PI_ORCHESTRATOR_AGENT_ID}`);
        expect(content).toContain(`tools: ${PI_AGENT_TOOLS.join(', ')}`);
        expect(content).not.toMatch(/tools:.*\bAgent\b/);
        expect(content).not.toContain('get_subagent_result');
        expect(content).toContain('prompt_mode: append');
        expect(content).toContain(
            `allowed_subagents: ${STAGES.map((stage) => piAgentId(stage.workflowId)).join(', ')}`
        );
    });

    it('阶段 agent 不含 allowed_subagents，name 等于 subagent_type', () => {
        const content = renderPiStageAgent('spec-explore', '探索阶段');
        expect(content).toContain('name: iagent-spec-explore');
        expect(content).toContain('prompt_mode: append');
        expect(content).not.toContain('allowed_subagents');
        expect(content).toContain(`tools: ${PI_AGENT_TOOLS.join(', ')}`);
    });
});

describe('写入与生命周期', () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-pi-native-'));
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('写入 orchestrator + 阶段定义，路径为 posix', () => {
        const result = writePiNativeAgents(root, STAGES);
        expect(result.dir).toBe('.pi/agents');
        expect(result.written).toEqual([
            '.pi/agents/iagent-orchestrator.md',
            '.pi/agents/iagent-spec-explore.md',
            '.pi/agents/iagent-spec-propose.md',
        ]);
        for (const file of result.written) {
            expect(fs.existsSync(path.join(root, file))).toBe(true);
        }
        const content = fs.readFileSync(path.join(root, '.pi/agents/iagent-spec-explore.md'), 'utf8');
        expect(content).toContain('name: iagent-spec-explore');
    });

    it('重复写入幂等，且按模板重建（纯生成物不设手改保护）', () => {
        writePiNativeAgents(root, STAGES);
        const file = path.join(root, '.pi/agents/iagent-spec-explore.md');
        fs.writeFileSync(file, '用户手改内容', 'utf8');

        const second = writePiNativeAgents(root, STAGES);
        expect(second.removed).toEqual([]);
        expect(fs.readFileSync(file, 'utf8')).toContain('name: iagent-spec-explore');
        expect(fs.readFileSync(file, 'utf8')).not.toContain('用户手改内容');
    });

    it('清理生效集缩小后的 orphan，但保留用户自建 agent', () => {
        writePiNativeAgents(root, STAGES);
        const userFile = path.join(root, '.pi/agents/auditor.md');
        fs.writeFileSync(userFile, '---\nname: auditor\n---\n', 'utf8');

        const result = writePiNativeAgents(root, [STAGES[0]]);
        expect(result.removed).toEqual(['.pi/agents/iagent-spec-propose.md']);
        expect(fs.existsSync(path.join(root, '.pi/agents/iagent-spec-propose.md'))).toBe(false);
        expect(fs.existsSync(path.join(root, '.pi/agents/iagent-spec-explore.md'))).toBe(true);
        expect(fs.existsSync(userFile)).toBe(true);
        expect(fs.readFileSync(userFile, 'utf8')).toContain('name: auditor');
    });

    it('removePiNativeAgents 只删 iagent- 前缀 .md', () => {
        writePiNativeAgents(root, STAGES);
        fs.writeFileSync(path.join(root, '.pi/agents/auditor.md'), 'x', 'utf8');
        fs.writeFileSync(path.join(root, '.pi/agents/notes.txt'), 'x', 'utf8');

        const removed = removePiNativeAgents(root);
        expect(removed).toEqual([
            '.pi/agents/iagent-orchestrator.md',
            '.pi/agents/iagent-spec-explore.md',
            '.pi/agents/iagent-spec-propose.md',
        ]);
        expect(fs.existsSync(path.join(root, '.pi/agents/auditor.md'))).toBe(true);
        expect(fs.existsSync(path.join(root, '.pi/agents/notes.txt'))).toBe(true);
    });
});

describe('可解析性扫描', () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-pi-scan-'));
        fs.mkdirSync(path.join(root, '.pi', 'agents'), { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('区分 missing 与 invalid，并按 name/文件名判定可解析', () => {
        fs.writeFileSync(
            path.join(root, '.pi/agents/iagent-ok.md'),
            '---\nname: iagent-ok\ntools: read\n---\n',
            'utf8'
        );
        fs.writeFileSync(
            path.join(root, '.pi/agents/iagent-filename.md'),
            '---\ndescription: 无 name，按文件名回退\n---\n',
            'utf8'
        );
        fs.writeFileSync(path.join(root, '.pi/agents/iagent-broken.md'), 'no frontmatter', 'utf8');
        fs.writeFileSync(
            path.join(root, '.pi/agents/iagent-wrong.md'),
            '---\nname: someone-else\n---\n',
            'utf8'
        );

        const scan = scanPiAgentDefinitions(root, [
            'iagent-ok',
            'iagent-filename',
            'iagent-broken',
            'iagent-wrong',
            'iagent-missing',
        ]);
        expect(scan.resolvable).toEqual(['iagent-ok', 'iagent-filename']);
        expect(scan.invalid).toEqual(['iagent-broken', 'iagent-wrong']);
        expect(scan.missing).toEqual(['iagent-missing']);
    });
});

describe('init / update 端到端', () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-pi-e2e-'));
        ensureProjectConfig(root);
        writeWorkflowsToConfig(root, ['workflow']);
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('init 生成 agent 定义后判定 strict，且不写 Pi 权限载体', () => {
        const result = runInit(root, { tools: 'pi', piRuntimeRunner: strictRunner });
        expect(result.piRuntime?.mode).toBe('strict');
        expect(result.piRuntime?.nativeEntries.missing).toEqual([]);
        expect(result.piRuntime?.nativeEntries.invalid).toEqual([]);
        expect(result.piNative?.written).toContain('.pi/agents/iagent-orchestrator.md');
        expect(result.piNative?.written).toContain('.pi/agents/iagent-spec-explore.md');

        const settings = path.join(root, '.pi', 'settings.json');
        if (fs.existsSync(settings)) {
            const parsed = JSON.parse(fs.readFileSync(settings, 'utf8')) as Record<string, unknown>;
            expect(parsed.permissions).toBeUndefined();
        }
    });

    it('运行时已装但定义缺失时降级，并在诊断中列出缺失项', () => {
        // 先正常生成，再删掉一个定义模拟“包在、定义缺失”
        runInit(root, { tools: 'pi', piRuntimeRunner: strictRunner });
        fs.rmSync(path.join(root, '.pi/agents/iagent-spec-explore.md'), { force: true });

        const status = detectPiRuntime({
            projectRoot: root,
            runner: strictRunner,
            requiredAgents: [PI_ORCHESTRATOR_AGENT_ID, 'iagent-spec-explore', 'iagent-spec-propose'],
        });
        expect(status.mode).toBe('degraded');
        expect(status.nativeEntries.missing).toEqual(['iagent-spec-explore']);
        expect(status.nativeEntries.issues.map((issue) => issue.code)).toContain('entry-missing');
    });

    it('update 重建被删除/写坏的 agent 定义', () => {
        runInit(root, { tools: 'pi', piRuntimeRunner: strictRunner });
        fs.writeFileSync(path.join(root, '.pi/agents/iagent-spec-explore.md'), 'broken', 'utf8');

        const result = runUpdate(root, { piRuntimeRunner: strictRunner });
        expect(result.piNative?.written).toContain('.pi/agents/iagent-spec-explore.md');
        const content = fs.readFileSync(path.join(root, '.pi/agents/iagent-spec-explore.md'), 'utf8');
        expect(content).toContain('name: iagent-spec-explore');
    });
});

describe('reconcile 对 Pi agent 的识别', () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-pi-reconcile-'));
        writePiNativeAgents(root, STAGES);
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('不在生效集的阶段 agent 计入 orphan，orchestrator 不算', () => {
        const orphans = scanReconcileOrphans(root, ['spec-explore']);
        expect(orphans.agents).toEqual(['.pi/agents/iagent-spec-propose.md']);
    });
});
