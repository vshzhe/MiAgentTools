/**
 * OpenCode V2 项目级编排产物回归锁（变更 add-host-orchestration-adapters）。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    OPENCODE_AGENTS_DIR,
    OPENCODE_CONFIG_FILE,
    ORCHESTRATOR_AGENT_ID,
    mergeOpenCodeProjectConfig,
    openCodeAgentId,
    renderOrchestratorAgent,
    renderWorkerAgent,
} from '../src/core/opencode-v2.js';
import { generateCommand, opencodeAdapter } from '../src/core/command-generation/index.js';
import { runInit } from '../src/commands/init.js';
import { ensureProjectConfig, writeWorkflowsToConfig } from '../src/core/project-config.js';

describe('OpenCode V2 指令元数据', () => {
    it('指令 frontmatter 含 agent 与 subagent，且不含 Claude 专有字段', () => {
        const generated = generateCommand(
            {
                id: 'workflow',
                name: 'iAgent: 引导工作流',
                description: 'x',
                category: 'impl',
                tags: [],
                body: '**Input**: topic\n\nDo it.',
                allowedTools: 'Read',
                generatedBy: '6.5.0',
                hostMeta: { agent: ORCHESTRATOR_AGENT_ID, subagent: false },
            },
            opencodeAdapter
        );
        const frontmatter = generated.fileContent.split('---')[1] ?? '';
        expect(frontmatter).toContain(`agent: ${ORCHESTRATOR_AGENT_ID}`);
        expect(frontmatter).toContain('subagent: false');
        expect(frontmatter).not.toMatch(/^\s*name:/m);
        expect(frontmatter).not.toMatch(/^\s*allowed-tools:/m);
    });
});

describe('OpenCode V2 agent 定义', () => {
    it('orchestrator 为 primary 且限定 iagent 资源权限', () => {
        const md = renderOrchestratorAgent();
        expect(md).toContain('mode: primary');
        expect(md).toContain('action: skill');
        expect(md).toContain('action: subagent');
        expect(md).toContain('"iagent-*"');
    });

    it('worker 为 subagent 且限定到自身 skill，并具备读写能力', () => {
        const md = renderWorkerAgent('spec-explore', '探索阶段');
        expect(md).toContain('mode: subagent');
        expect(md).toContain('resource: "iagent-spec-explore"');
        // worker 需能读取与修改代码，否则阶段无法执行
        expect(md).toContain('action: read');
        expect(md).toContain('action: edit');
        expect(md).toContain('phase');
        expect(md).toContain('status');
    });
});

describe('OpenCode V2 项目配置合并', () => {
    it('新建时写 $schema 与 iagent permissions（V2 口径）', () => {
        const merged = mergeOpenCodeProjectConfig(undefined, {
            skillIds: ['iagent-workflow'],
            agentIds: ['iagent-orchestrator'],
        });
        expect(merged.created).toBe(true);
        const parsed = JSON.parse(merged.content);
        expect(parsed.$schema).toBe('https://opencode.ai/config.json');
        expect(parsed.permissions).toContainEqual({ action: 'skill', resource: 'iagent-workflow', effect: 'allow' });
        expect(parsed.permissions).toContainEqual({ action: 'subagent', resource: 'iagent-orchestrator', effect: 'allow' });
        // V1 口径不得出现
        expect(merged.content).not.toContain('"permission"');
    });

    it('已存在时保留用户字段与规则，仅替换 iagent 规则', () => {
        const existing = JSON.stringify({
            model: 'anthropic/claude-sonnet-4-5',
            permissions: [
                { action: 'shell', resource: 'git push *', effect: 'deny' },
                { action: 'skill', resource: 'iagent-old', effect: 'allow' },
            ],
        });
        const merged = mergeOpenCodeProjectConfig(existing, {
            skillIds: ['iagent-workflow'],
            agentIds: [],
        });
        const parsed = JSON.parse(merged.content);
        expect(parsed.model).toBe('anthropic/claude-sonnet-4-5');
        expect(parsed.permissions).toContainEqual({ action: 'shell', resource: 'git push *', effect: 'deny' });
        expect(parsed.permissions).not.toContainEqual({ action: 'skill', resource: 'iagent-old', effect: 'allow' });
        expect(parsed.permissions).toContainEqual({ action: 'skill', resource: 'iagent-workflow', effect: 'allow' });
    });

    it('不可解析时保留原文件并告警', () => {
        const broken = '{ this is not json';
        const merged = mergeOpenCodeProjectConfig(broken, { skillIds: ['iagent-x'], agentIds: [] });
        expect(merged.warning).toBeTruthy();
        expect(merged.content).toBe(broken);
    });
});

describe('OpenCode V2 项目产物写入（init 端到端）', () => {
    let root: string;

    beforeAll(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-ocv2-'));
        ensureProjectConfig(root);
        writeWorkflowsToConfig(root, ['workflow', 'spec-explore']);
        runInit(root, { tools: 'opencode' });
    });

    afterAll(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('生成 orchestrator 与 worker agent', () => {
        expect(fs.existsSync(path.join(root, OPENCODE_AGENTS_DIR, `${ORCHESTRATOR_AGENT_ID}.md`))).toBe(true);
        expect(fs.existsSync(path.join(root, OPENCODE_AGENTS_DIR, `${openCodeAgentId('spec-explore')}.md`))).toBe(true);
    });

    it('生成项目级 opencode.jsonc（含 iagent permissions）', () => {
        const configFile = path.join(root, OPENCODE_CONFIG_FILE);
        expect(fs.existsSync(configFile)).toBe(true);
        const parsed = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        expect(Array.isArray(parsed.permissions)).toBe(true);
        expect(parsed.permissions.some((r: { action: string }) => r.action === 'skill')).toBe(true);
        expect(parsed.permissions.some((r: { action: string }) => r.action === 'subagent')).toBe(true);
    });

    it('指令产物含 agent/subagent 元数据且不写 Claude 权限载体', () => {
        const commandFile = path.join(root, '.opencode', 'commands', 'iagent-spec-explore.md');
        const commandContent = fs.readFileSync(commandFile, 'utf8');
        const frontmatter = commandContent.split('---')[1] ?? '';
        expect(frontmatter).toContain('agent: iagent-orchestrator');
        expect(frontmatter).toContain('subagent: false');
        expect(commandContent).toContain('subagent');
        expect(commandContent).not.toContain('iagent_spec_');
        expect(frontmatter).not.toMatch(/^\s*allowed-tools:/m);
        expect(fs.existsSync(path.join(root, '.opencode', 'settings.json'))).toBe(false);
    });

    it('OpenCode V2 skill frontmatter 不写 Claude allowed-tools', () => {
        const skill = fs.readFileSync(
            path.join(root, '.opencode', 'skills', 'iagent-workflow', 'SKILL.md'),
            'utf8'
        );
        const frontmatter = skill.split('---')[1] ?? '';
        expect(frontmatter).not.toMatch(/^\s*allowed-tools:/m);
        expect(skill).not.toContain('iagent_spec_');
    });
});
