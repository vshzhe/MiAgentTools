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
    hasWriteEntry,
    mergeOpenCodeProjectConfig,
    openCodeAgentId,
    removeOpenCodeProjectArtifacts,
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

    it('worker 为 subagent、限定到自身 skill，并默认不授予 edit（最小权限）', () => {
        const md = renderWorkerAgent('spec-explore', '探索阶段');
        expect(md).toContain('mode: subagent');
        expect(md).toContain('resource: "iagent-spec-explore"');
        // 只读阶段（未传 grantEdit）不得获得写入授权，但必须能读取与交互提问
        expect(md).toContain('action: read');
        expect(md).toContain('action: question');
        expect(md).not.toContain('action: edit');
        expect(md).toContain('phase');
        expect(md).toContain('status');
    });

    it('可写阶段授予 edit，且两类 worker 均含 question', () => {
        const writable = renderWorkerAgent('spec-apply', '实现变更', { grantEdit: true });
        expect(writable).toContain('action: edit');
        expect(writable).toContain('action: question');

        const readOnly = renderWorkerAgent('review', '代码审查', { grantEdit: false });
        expect(readOnly).not.toContain('action: edit');
        expect(readOnly).toContain('action: question');
    });

    it('worker 正文含加载 SKILL.md 的引导，description 归一化并转义', () => {
        const md = renderWorkerAgent('spec-apply', '委派 iagent_test 的实现阶段');
        expect(md).toContain('`.opencode/skills/iagent-spec-apply/SKILL.md`');
        expect(md).toContain('`skill` 工具');
        // 内部下划线技能名归一化为 canonical
        expect(md).not.toContain('iagent_test');
        // 含冒号时经 escapeYamlValue 包裹
        const escaped = renderWorkerAgent('spec-apply', '阶段: 实现');
        expect(escaped).toContain('description: "阶段: 实现"');
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
            resource: 'iagent-spec-verify-proposal',
            effect: 'allow',
        });
        // 需求文档桥已移除：不再授予该技能资源
        expect(
            permissions.some(
                (rule) => rule.action === 'skill' && rule.resource === 'iagent-requirement-doc'
            )
        ).toBe(false);
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

// 变更 fix-multi-agent-skill-command-generation / 任务 3.1 / 3.3：
// 多词 shell 前缀、stripJsonc 卸载、worker 最小权限、orphan 清理。
describe('OpenCode V2 多词 shell 前缀与卸载安全', () => {
    it('collectShellPrefixes 支持含空格的多词子命令', () => {
        const prefixes = collectShellPrefixes([
            'Bash(git status:*), Bash(git diff:*), Bash(codegraph:*)',
            'Bash(pnpm:*)',
        ]);
        expect(prefixes).toEqual(['git status ', 'git diff ', 'codegraph ', 'pnpm ']);
    });

    it('collectShellPrefixes：单词 / 多词混合前缀保序且跨条目去重', () => {
        const prefixes = collectShellPrefixes([
            'Read, Bash(git status:*), Bash(ls:*)',
            'Bash(git status:*), Bash(git log:*)',
            'Read, Write',
        ]);
        expect(prefixes).toEqual(['git status ', 'ls ', 'git log ']);
    });

    it('collectShellPrefixes：无 `:*` 通配、空命令与非 Bash 条目不派生', () => {
        expect(
            collectShellPrefixes(['Bash(git diff)', 'Bash()', 'Bash(:*)', 'Read, Glob, mcp__codegraph__x'])
        ).toEqual([]);
        expect(collectShellPrefixes([])).toEqual([]);
    });

    it('hasWriteEntry 精确识别 Write / Edit 授权', () => {
        expect(hasWriteEntry('Read, Write, Edit, Glob')).toBe(true);
        expect(hasWriteEntry('Read, Glob, Grep, Bash(iagent:*)')).toBe(false);
        expect(hasWriteEntry('Read, TodoWrite')).toBe(false);
    });

    it('hasWriteEntry：单独授权与词边界（EditHistory / Bash(Write:*) 不算）', () => {
        expect(hasWriteEntry('Edit')).toBe(true);
        expect(hasWriteEntry('Write')).toBe(true);
        expect(hasWriteEntry('Read, Write')).toBe(true);
        expect(hasWriteEntry('Read, EditHistory')).toBe(false);
        expect(hasWriteEntry('Bash(Write:*)')).toBe(false);
        expect(hasWriteEntry('')).toBe(false);
    });

    it('含 $schema URL、JSONC 注释与多词 shell 规则的配置卸载后可精确清理', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-oc-uninstall-'));
        try {
            fs.mkdirSync(path.join(root, '.opencode'), { recursive: true });
            fs.mkdirSync(path.join(root, OPENCODE_AGENTS_DIR), { recursive: true });
            fs.writeFileSync(
                path.join(root, OPENCODE_CONFIG_FILE),
                `// iagent 项目级权限（JSONC）
{
  "$schema": "https://opencode.ai/config.json",
  "permissions": [
    { "action": "shell", "resource": "git status ", "effect": "allow" },
    { "action": "skill", "resource": "iagent-workflow", "effect": "allow" },
  ],
}
`,
                'utf8'
            );
            fs.writeFileSync(
                path.join(root, OPENCODE_AGENTS_DIR, `${ORCHESTRATOR_AGENT_ID}.md`),
                '---\nname: x\n---\n',
                { encoding: 'utf8', flag: 'w' }
            );

            const removed = removeOpenCodeProjectArtifacts(root);

            expect(removed).toContain(OPENCODE_CONFIG_FILE);
            expect(removed).toContain(`${OPENCODE_AGENTS_DIR}/${ORCHESTRATOR_AGENT_ID}.md`);
            expect(fs.existsSync(path.join(root, OPENCODE_CONFIG_FILE))).toBe(false);
            expect(fs.existsSync(path.join(root, OPENCODE_AGENTS_DIR, `${ORCHESTRATOR_AGENT_ID}.md`))).toBe(false);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('用户自定义规则存在时保留文件与用户规则', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-oc-uninstall-user-'));
        try {
            fs.mkdirSync(path.join(root, '.opencode'), { recursive: true });
            fs.writeFileSync(
                path.join(root, OPENCODE_CONFIG_FILE),
                `{
  "$schema": "https://opencode.ai/config.json",
  // 用户自建规则
  "model": "anthropic/claude-sonnet-4-5",
  "permissions": [
    { "action": "skill", "resource": "user-skill", "effect": "allow" },
    { "action": "skill", "resource": "iagent-workflow", "effect": "allow" },
  ],
}
`,
                'utf8'
            );

            removeOpenCodeProjectArtifacts(root);

            const parsed = JSON.parse(fs.readFileSync(path.join(root, OPENCODE_CONFIG_FILE), 'utf8'));
            expect(parsed.model).toBe('anthropic/claude-sonnet-4-5');
            expect(parsed.permissions).toContainEqual({
                action: 'skill',
                resource: 'user-skill',
                effect: 'allow',
            });
            expect(parsed.permissions).not.toContainEqual({
                action: 'skill',
                resource: 'iagent-workflow',
                effect: 'allow',
            });
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('JSONC 块注释 / 行内注释 / 字符串内 // 与尾逗号均可解析（合并路径）', () => {
        const existing = `/* iagent 项目级权限（生成片段）
   多行块注释 */
{
  "$schema": "https://opencode.ai/config.json",
  "model": "provider/https://example.com/model", // 用户模型（含 // 的字符串值）
  "permissions": [
    { "action": "shell", "resource": "git push *", "effect": "deny" }, /* 用户自建 deny */
  ],
}
`;
        const merged = mergeOpenCodeProjectConfig(existing, {
            skillIds: ['iagent-workflow'],
            agentIds: [],
            shellPrefixes: [],
        });

        expect(merged.warning).toBeUndefined();
        const parsed = JSON.parse(merged.content);
        // `$schema` URL 中的 `//` 未被当作注释
        expect(parsed.$schema).toBe('https://opencode.ai/config.json');
        // 字符串值内的 `//` 逐字保留
        expect(parsed.model).toBe('provider/https://example.com/model');
        // 用户 deny 规则与新增 iagent 规则共存
        expect(parsed.permissions).toContainEqual({
            action: 'shell',
            resource: 'git push *',
            effect: 'deny',
        });
        expect(parsed.permissions).toContainEqual({
            action: 'skill',
            resource: 'iagent-workflow',
            effect: 'allow',
        });
    });

    it('卸载路径同样经 stripJsonc：块注释与字符串内 // 不破坏解析', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-oc-uninstall-jsonc-'));
        try {
            fs.mkdirSync(path.join(root, '.opencode'), { recursive: true });
            fs.writeFileSync(
                path.join(root, OPENCODE_CONFIG_FILE),
                `{
  "$schema": "https://opencode.ai/config.json",
  /* iagent 权限（项目级） */
  "note": "see // docs",
  "permissions": [
    { "action": "skill", "resource": "iagent-workflow", "effect": "allow" }, /* iagent 规则 */
  ],
}
`,
                'utf8'
            );

            const removed = removeOpenCodeProjectArtifacts(root);

            // 仍有用户字段 → 保留文件，仅移除 iagent 规则
            expect(removed).toContain(`${OPENCODE_CONFIG_FILE}（已移除 iagent 权限规则）`);
            const parsed = JSON.parse(fs.readFileSync(path.join(root, OPENCODE_CONFIG_FILE), 'utf8'));
            expect(parsed.$schema).toBe('https://opencode.ai/config.json');
            expect(parsed.note).toBe('see // docs');
            expect(parsed.permissions).toBeUndefined();
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('OpenCode V2 orphan agent 清理', () => {
    const stageOf = (commandId: string) => {
        const entry = getSkillTemplates().find((item) => item.commandId === commandId);
        if (!entry) {
            throw new Error(`技能模板缺失：${commandId}`);
        }
        return {
            workflowId: entry.commandId,
            description: entry.template.description,
            allowedTools: entry.template.allowedTools,
        };
    };

    it('生效集缩小后清理 iagent-*.md orphan，保留 orchestrator 与用户自建 agent', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-oc-orphan-'));
        try {
            writeOpenCodeProjectArtifacts(root, [stageOf('spec-explore'), stageOf('spec-propose')]);
            const userAgent = path.join(root, OPENCODE_AGENTS_DIR, 'custom.md');
            fs.writeFileSync(userAgent, '---\nname: custom\n---\n', 'utf8');

            const result = writeOpenCodeProjectArtifacts(root, [stageOf('spec-explore')]);

            expect(result.removed).toContain(`${OPENCODE_AGENTS_DIR}/${openCodeAgentId('spec-propose')}.md`);
            expect(
                fs.existsSync(path.join(root, OPENCODE_AGENTS_DIR, `${openCodeAgentId('spec-propose')}.md`))
            ).toBe(false);
            expect(
                fs.existsSync(path.join(root, OPENCODE_AGENTS_DIR, `${openCodeAgentId('spec-explore')}.md`))
            ).toBe(true);
            expect(fs.existsSync(path.join(root, OPENCODE_AGENTS_DIR, `${ORCHESTRATOR_AGENT_ID}.md`))).toBe(true);
            expect(fs.existsSync(userAgent)).toBe(true);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('orphan 清理仅作用于 iagent-*.md（非 .md 的 iagent 文件保留）', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-oc-orphan-ext-'));
        try {
            writeOpenCodeProjectArtifacts(root, [stageOf('spec-explore')]);
            const staleMd = path.join(root, OPENCODE_AGENTS_DIR, 'iagent-stale.md');
            const notesTxt = path.join(root, OPENCODE_AGENTS_DIR, 'iagent-notes.txt');
            fs.writeFileSync(staleMd, '---\nname: stale\n---\n', 'utf8');
            fs.writeFileSync(notesTxt, '用户笔记\n', 'utf8');

            const result = writeOpenCodeProjectArtifacts(root, [stageOf('spec-explore')]);

            expect(result.removed).toContain(`${OPENCODE_AGENTS_DIR}/iagent-stale.md`);
            expect(fs.existsSync(staleMd)).toBe(false);
            expect(fs.existsSync(notesTxt)).toBe(true);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('写入阶段 worker 时按 allowedTools 决定 edit 权限', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-oc-edit-'));
        try {
            writeOpenCodeProjectArtifacts(root, [stageOf('spec-apply'), stageOf('review')]);
            const writable = fs.readFileSync(
                path.join(root, OPENCODE_AGENTS_DIR, `${openCodeAgentId('spec-apply')}.md`),
                'utf8'
            );
            const readOnly = fs.readFileSync(
                path.join(root, OPENCODE_AGENTS_DIR, `${openCodeAgentId('review')}.md`),
                'utf8'
            );
            expect(writable).toContain('action: edit');
            expect(writable).toContain('action: question');
            expect(readOnly).not.toContain('action: edit');
            expect(readOnly).toContain('action: question');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
