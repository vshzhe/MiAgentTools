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
import {
    negotiationForHost,
    renderDelegate,
    renderHostOrchestrationSection,
    renderLoadSkill,
} from '../src/core/host-orchestration/index.js';

describe('Claude 协议动作渲染', () => {
    it('委派使用 Skill/Agent 原生语义并保留 canonical skill id', () => {
        // 交互阶段（spec-explore）经 Skill 内联加载
        const interactive = renderDelegate('claude', 'strict', { workflowId: 'spec-explore' });
        expect(interactive).toContain('经 Skill 工具加载');
        expect(interactive).toContain('iagent-spec-explore');
        // 自动阶段（spec-apply）经前台 Agent 子代理执行
        const automated = renderDelegate('claude', 'strict', { workflowId: 'spec-apply' });
        expect(automated).toContain('经前台 Agent 子代理执行');
        expect(automated).toContain('iagent-spec-apply');
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
        // 验证/复查与测试委派获得精确 canonical 白名单条目（无通配）
        expect(debug).toMatch(/^allowed-tools: .*/m);
        expect(debug).toContain('Skill(iagent-spec-verify-proposal)');
        expect(debug).toContain('Skill(iagent-proposal-review)');
        expect(debug).toContain('Skill(iagent-test)');
        // 需求文档桥已移除：不再持有该委派条目
        expect(debug).not.toContain('Skill(iagent-requirement-doc)');
        expect(debug).not.toContain('Skill(*)');
    });

    it('Claude 权限载体聚合 debug 的验证/复查/测试委派条目', () => {
        const settings = path.join(root, '.claude', 'settings.json');
        const parsed = JSON.parse(fs.readFileSync(settings, 'utf8')) as {
            permissions?: { allow?: string[] };
        };
        const allow = parsed.permissions?.allow ?? [];
        expect(allow).toContain('Skill(iagent-spec-verify-proposal)');
        expect(allow).toContain('Skill(iagent-proposal-review)');
        expect(allow).toContain('Skill(iagent-test)');
        expect(allow).not.toContain('Skill(iagent-requirement-doc)');
    });
});

// 变更 fix-mode-delegation-host-parity / 任务 3.6：Claude 产物 canonical 白名单与委派清单。
describe('3.6 Claude 产物 canonical 委派条目', () => {
    let root: string;

    beforeAll(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-claude-parity-'));
        ensureProjectConfig(root);
        writeWorkflowsToConfig(root, ['workflow', 'spec-apply', 'debug']);
        runInit(root, { tools: 'claude' });
    });

    afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

    it('workflow SKILL.md 的白名单为 canonical 形态，且无裸名死条目', () => {
        const skill = fs.readFileSync(
            path.join(root, '.claude', 'skills', 'iagent-workflow', 'SKILL.md'),
            'utf8'
        );
        const allowedToolsLine = skill.split('\n').find((line) => line.startsWith('allowed-tools:')) ?? '';
        expect(allowedToolsLine).toContain('Skill(iagent-spec-apply)');
        expect(allowedToolsLine).not.toMatch(/Skill\((?!iagent-)[^)]*\)/);
        expect(skill).not.toContain('Skill(*)');
    });

    it('spec-apply 产物注入派生委派清单并携带参数', () => {
        const skill = fs.readFileSync(
            path.join(root, '.claude', 'skills', 'iagent-spec-apply', 'SKILL.md'),
            'utf8'
        );
        expect(skill).toContain('宿主编排适配（生成期注入）');
        expect(skill).toContain('阶段委派（宿主原生）');
        expect(skill).toContain('iagent-test');
    });

    it('会话级 permissions.allow 聚合 canonical 条目', () => {
        const settings = JSON.parse(
            fs.readFileSync(path.join(root, '.claude', 'settings.json'), 'utf8')
        ) as { permissions?: { allow?: string[] } };
        const allow = settings.permissions?.allow ?? [];
        const skillEntries = allow.filter((entry) => entry.startsWith('Skill('));
        expect(skillEntries.length).toBeGreaterThan(0);
        for (const entry of skillEntries) {
            expect(entry).toMatch(/^Skill\(iagent-[a-z0-9-]+\)$/);
        }
        expect(allow).not.toContain('Skill(spec_apply)');
    });
});

// 变更 improve-orchestration-execution-mode / 任务 3.2：
// strict / degraded 两形态分别渲染分级执行与增量复验契约。
describe('3.2 执行方式与增量复验契约渲染', () => {
    const strict = negotiationForHost('claude')!;
    const degraded = negotiationForHost('codex')!;

    it('strict 段含分级执行 / 增量复验 / 非作者约束关键字', () => {
        // Given: strict 宿主协商结果
        const section = renderHostOrchestrationSection(strict, 'auto-workflow');

        // Then: 三类契约关键字齐备
        expect(section).toContain('分级执行');
        expect(section).toContain('增量复验');
        expect(section).toContain('固定清单');
        expect(section).toContain('fixDiff');
        expect(section).toContain('禁止新开验证代理');
        expect(section).toContain('禁止以 resume 充当复验');
    });

    it('strict 段声明执行方式回执字段与 inline 免 delegate', () => {
        // Given / When
        const section = renderHostOrchestrationSection(strict, 'auto-workflow');

        // Then: 回执字段与 inline 能力约束可见
        expect(section).toContain(
            'executionMode / independence / readScope / dependsOn / contextReplay'
        );
        expect(section).toContain('inline 阶段不要求 delegate');
    });

    it('strict 段分级策略：全部编排阶段内联、仅批量归档并行保留子代理', () => {
        // Given / When
        const section = renderHostOrchestrationSection(strict, 'auto-workflow');

        // Then: 分级执行表逐项可见
        expect(section).toContain('全部编排阶段');
        expect(section).toContain('默认内联');
        expect(section).toContain('spec-bulk-archive');
        expect(section).toContain('批内并行只读');
        expect(section).toContain('只读验证以固定清单');
        expect(section).toContain('为 apply / fix 子阶段');
    });

    it('degraded 段声明 local-degraded 且禁止声称 subagent', () => {
        // Given: degraded（Codex skills-only）协商结果
        const section = renderHostOrchestrationSection(degraded, 'auto-workflow');

        // Then: 显式本地执行契约可见
        expect(section).toContain('executionMode=local-degraded');
        expect(section).toContain('MUST NOT 声称 subagent');
        // 不得渲染 strict 专属的分级执行 / 增量复验契约
        expect(section).not.toContain('分级执行');
        expect(section).not.toContain('增量复验');
    });

    it('strict / degraded 两形态互斥（strict 不含 local-degraded）', () => {
        // Given / When
        const strictSection = renderHostOrchestrationSection(strict, 'workflow');
        const degradedSection = renderHostOrchestrationSection(degraded, 'workflow');

        // Then: 各自形态标识互不串场
        expect(strictSection).toContain('strict 编排');
        expect(degradedSection).toContain('degraded 单 agent 模式');
        expect(strictSection).not.toContain('local-degraded');
    });
});
