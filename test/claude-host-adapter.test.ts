/**
 * Claude Code 宿主适配契约（变更 add-host-orchestration-adapters，任务 3.x）。
 *
 * 断言 Claude 产物保留原生 Skill/Agent/AskUserQuestion/MCP 语义与 allowed-tools 白名单，
 * 且共享协议动作在 Claude 下渲染为原生机制。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runInit } from '../src/commands/init.js';
import { ensureProjectConfig, writeWorkflowsToConfig } from '../src/core/project-config.js';
import { renderDelegate, renderLoadSkill } from '../src/core/host-orchestration/index.js';

describe('Claude 协议动作渲染', () => {
    it('委派使用 Skill/Agent 原生语义并保留 canonical skill id', () => {
        const text = renderDelegate('claude', 'strict', { workflowId: 'spec-apply' });
        expect(text).toContain('Skill 工具委派');
        expect(text).toContain('iagent-spec-apply');
    });

    it('技能加载使用 Skill 工具', () => {
        expect(renderLoadSkill('claude', 'strict', { workflowId: 'spec-explore' })).toContain('Skill 工具加载');
    });
});

describe('Claude 产物契约（init 端到端）', () => {
    let root: string;

    beforeAll(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-claude-adapter-'));
        ensureProjectConfig(root);
        writeWorkflowsToConfig(root, ['workflow', 'spec-apply', 'debug']);
        runInit(root, { tools: 'claude' });
    });

    afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

    it('技能保留 allowed-tools 白名单与 canonical name', () => {
        const wf = fs.readFileSync(path.join(root, '.claude', 'skills', 'iagent-workflow', 'SKILL.md'), 'utf8');
        expect(wf).toContain('name: iagent-workflow');
        expect(wf).toMatch(/^allowed-tools: .+/m);
        // 编排技能含 Agent/Task 派发条目（Claude 原生 subagent 机制）
        expect(wf).toMatch(/Agent|Task/);
    });

    it('指令为 namespace-dir 布局并可经 allowed-tools 放行', () => {
        const cmd = path.join(root, '.claude', 'commands', 'iagent', 'workflow.md');
        expect(fs.existsSync(cmd)).toBe(true);
        const content = fs.readFileSync(cmd, 'utf8');
        expect(content).toMatch(/^allowed-tools: .+/m);
        expect(content).toContain('name:');
    });

    it('生成会话级权限载体（.claude/settings.json 的 permissions.allow）', () => {
        const settings = path.join(root, '.claude', 'settings.json');
        expect(fs.existsSync(settings)).toBe(true);
        const parsed = JSON.parse(fs.readFileSync(settings, 'utf8'));
        expect(Array.isArray(parsed.permissions?.allow)).toBe(true);
    });

    it('debug 技能含条件修复门标注与文档/测试委派精确授权', () => {
        const debug = fs.readFileSync(
            path.join(root, '.claude', 'skills', 'iagent-debug', 'SKILL.md'),
            'utf8'
        );
        // 三阶段协议与条件门在 Claude 产物中可见
        expect(debug).toContain('- `investigate`：能力');
        expect(debug).toContain('- `fix`：能力');
        expect(debug).toContain('门：fix-option-confirmation（条件 multiple-fix-options）');
        expect(debug).toContain('- `verify-close`：能力');
        // nextAllowed 直接委派契约
        expect(debug).toContain('唯一 `nextAllowed` 技能 SHALL 直接委派');
        // 文档与测试委派获得精确白名单条目（裸名，无通配）
        expect(debug).toMatch(/^allowed-tools: .*/m);
        expect(debug).toContain('Skill(requirement_doc)');
        expect(debug).toContain('Skill(test)');
        expect(debug).not.toContain('Skill(*)');
    });

    it('Claude 权限载体聚合 debug 的文档/测试委派条目', () => {
        const settings = path.join(root, '.claude', 'settings.json');
        const parsed = JSON.parse(fs.readFileSync(settings, 'utf8')) as {
            permissions?: { allow?: string[] };
        };
        const allow = parsed.permissions?.allow ?? [];
        expect(allow).toContain('Skill(requirement_doc)');
        expect(allow).toContain('Skill(test)');
    });
});
