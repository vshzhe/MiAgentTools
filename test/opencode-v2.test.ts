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
    collectShellPrefixes,
    hasDispatchEntry,
    mergeOpenCodeProjectConfig,
    openCodeAgentId,
    renderOrchestratorAgent,
    renderWorkerAgent,
    writeOpenCodeProjectArtifacts,
} from '../src/core/opencode-v2.js';
import { generateCommand, opencodeAdapter } from '../src/core/command-generation/index.js';
import { runInit } from '../src/commands/init.js';
import { ensureProjectConfig, writeWorkflowsToConfig } from '../src/core/project-config.js';
import { getSkillTemplates } from '../src/core/templates/index.js';

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
        writeWorkflowsToConfig(root, ['workflow', 'spec-explore', 'debug']);
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

    it('debug 阶段产物与项目权限同步（skill 资源显式允许）', () => {
        // debug worker agent 存在且限定到自身 skill
        const worker = path.join(root, OPENCODE_AGENTS_DIR, `${openCodeAgentId('debug')}.md`);
        expect(fs.existsSync(worker)).toBe(true);
        const workerContent = fs.readFileSync(worker, 'utf8');
        expect(workerContent).toContain('mode: subagent');
        expect(workerContent).toContain('resource: "iagent-debug"');

        // 项目权限按资源显式允许 iagent-debug 及其依赖阶段
        const parsed = JSON.parse(fs.readFileSync(path.join(root, OPENCODE_CONFIG_FILE), 'utf8'));
        const permissions = parsed.permissions as Array<{
            action: string;
            resource: string;
        }>;
        expect(permissions).toContainEqual({
            action: 'skill',
            resource: 'iagent-debug',
            effect: 'allow',
        });
        expect(permissions).toContainEqual({
            action: 'skill',
            resource: 'iagent-requirement-doc',
            effect: 'allow',
        });
        expect(permissions).toContainEqual({
            action: 'subagent',
            resource: 'iagent-debug',
            effect: 'allow',
        });
        // 无 V1 口径、无通配 skill 资源
        expect(parsed.permission).toBeUndefined();
        expect(
            permissions.some(
                (rule) => rule.action === 'skill' && rule.resource.includes('*')
            ),
            '项目权限不得使用 skill 通配资源'
        ).toBe(false);
    });

    it('debug 技能的编排段在 OpenCode 产物中按宿主机制改写', () => {
        const skill = fs.readFileSync(
            path.join(root, '.opencode', 'skills', 'iagent-debug', 'SKILL.md'),
            'utf8'
        );
        expect(skill).toContain('阶段委派（宿主原生）');
        expect(skill).toContain('门：fix-option-confirmation（条件 multiple-fix-options）');
        expect(skill).not.toContain('Skill 工具委派');
    });
});

// 变更 fix-mode-delegation-host-parity / 任务 4.2：权限翻译完整性（bash / worker 委派面 / 幂等）。
describe('4.2 OpenCode 权限翻译完整性', () => {
    const skills = getSkillTemplates();

    function stageOf(commandId: string) {
        const entry = skills.find((item) => item.commandId === commandId);
        if (!entry) {
            throw new Error(`技能模板缺失：${commandId}`);
        }
        return {
            workflowId: entry.commandId,
            description: entry.template.description,
            allowedTools: entry.template.allowedTools,
        };
    }

    it('shell 前缀由 Bash(<cmd>:*) 派生（命令 + 空格），不含全量放行', () => {
        const prefixes = collectShellPrefixes([
            'Read, Bash(codegraph:*), Bash(git:*)',
            'Read, Bash(git:*)',
            'Read',
        ]);
        expect(prefixes).toEqual(['codegraph ', 'git ']);
        expect(prefixes).not.toContain('*');
        expect(prefixes.some((prefix) => prefix.includes('*'))).toBe(false);
    });

    it('worker 的 skill 面覆盖自身与实际委派目标（spec-apply → iagent-test）', () => {
        const md = renderWorkerAgent('spec-apply', '实现变更', {
            skillIds: ['iagent-test'],
        });
        expect(md).toContain('resource: "iagent-spec-apply"');
        expect(md).toContain('resource: "iagent-test"');
    });

    it('派发型 worker 获得 subagent，非派发型不获得', () => {
        expect(hasDispatchEntry(stageOf('spec-apply').allowedTools)).toBe(true);
        const dispatching = renderWorkerAgent('spec-apply', '实现变更', { grantSubagent: true });
        expect(dispatching).toContain('action: subagent');
        expect(dispatching).toContain('"iagent-*"');

        const nonDispatch = renderWorkerAgent('spec-explore', '探索阶段', { grantSubagent: false });
        expect(nonDispatch).not.toContain('action: subagent');
    });

    it('项目产物含 shell / worker 委派面，MCP 缺口进入诊断', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-oc-parity-'));
        try {
            const result = writeOpenCodeProjectArtifacts(root, [
                stageOf('spec-apply'),
                stageOf('spec-explore'),
            ]);
            // MCP 缺口诊断（不生成猜测性规则）
            expect(result.warnings.join('\n')).toContain('MCP 权限缺口');
            expect(result.warnings.join('\n')).toContain('codegraph');

            const config = JSON.parse(fs.readFileSync(path.join(root, OPENCODE_CONFIG_FILE), 'utf8'));
            const rules = config.permissions as Array<{ action: string; resource: string; effect: string }>;
            // bash 面不再缺失：按命令前缀派生
            expect(rules).toContainEqual({ action: 'shell', resource: 'codegraph ', effect: 'allow' });
            expect(rules).toContainEqual({ action: 'shell', resource: 'git ', effect: 'allow' });
            expect(rules.some((rule) => rule.action === 'shell' && rule.resource === '*')).toBe(false);
            expect(rules.some((rule) => rule.resource === 'bash *')).toBe(false);
            // 项目级 skill 覆盖委派目标
            expect(rules).toContainEqual({
                action: 'skill',
                resource: 'iagent-test',
                effect: 'allow',
            });

            const worker = fs.readFileSync(
                path.join(root, OPENCODE_AGENTS_DIR, `${openCodeAgentId('spec-apply')}.md`),
                'utf8'
            );
            expect(worker).toContain('resource: "iagent-test"');
            expect(worker).toContain('action: subagent');
            expect(worker).toContain('action: shell');
            expect(worker).toContain('resource: "pnpm "');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('连续两次生成规则集合一致（幂等）且用户规则保留', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-oc-idem-'));
        try {
            fs.mkdirSync(path.join(root, '.opencode'), { recursive: true });
            fs.writeFileSync(
                path.join(root, OPENCODE_CONFIG_FILE),
                JSON.stringify({
                    model: 'anthropic/claude-sonnet-4-5',
                    permissions: [
                        { action: 'shell', resource: 'git push ', effect: 'deny' },
                        { action: 'skill', resource: 'user-skill', effect: 'allow' },
                    ],
                }),
                'utf8'
            );
            const stages = [stageOf('spec-apply')];
            writeOpenCodeProjectArtifacts(root, stages);
            const first = JSON.parse(
                fs.readFileSync(path.join(root, OPENCODE_CONFIG_FILE), 'utf8')
            ).permissions as unknown[];
            writeOpenCodeProjectArtifacts(root, stages);
            const second = JSON.parse(
                fs.readFileSync(path.join(root, OPENCODE_CONFIG_FILE), 'utf8')
            ).permissions as unknown[];

            expect(second).toEqual(first);
            expect(second).toContainEqual({ action: 'shell', resource: 'git push ', effect: 'deny' });
            expect(second).toContainEqual({ action: 'skill', resource: 'user-skill', effect: 'allow' });
            // 无重复 iagent 规则
            const iagentRules = second.filter(
                (rule) =>
                    (rule as { action?: string }).action === 'skill' ||
                    (rule as { action?: string }).action === 'subagent' ||
                    (rule as { action?: string }).action === 'shell'
            );
            expect(new Set(iagentRules.map((rule) => JSON.stringify(rule))).size).toBe(
                iagentRules.length
            );
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('合并 shell 规则时保留用户 deny（仅替换 allow 形态的 iagent 规则）', () => {
        const existing = JSON.stringify({
            permissions: [{ action: 'shell', resource: 'codegraph ', effect: 'deny' }],
        });
        const merged = mergeOpenCodeProjectConfig(existing, {
            skillIds: [],
            agentIds: [],
            shellPrefixes: ['codegraph '],
        });
        const rules = JSON.parse(merged.content).permissions as unknown[];
        expect(rules).toContainEqual({ action: 'shell', resource: 'codegraph ', effect: 'deny' });
        expect(rules).toContainEqual({ action: 'shell', resource: 'codegraph ', effect: 'allow' });
    });
});
