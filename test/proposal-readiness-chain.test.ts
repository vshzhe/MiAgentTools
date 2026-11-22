/**
 * proposal-readiness-chain：父编排链消费就绪门 + 生成协议要点。
 *
 * 覆盖能力 `artifact-generation-protocol` 的全部 Scenario（4.6 / 4.7）。
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getWorkflowSkillTemplate } from '../src/core/templates/workflows/workflow.js';
import { getAutoWorkflowSkillTemplate } from '../src/core/templates/workflows/auto-workflow.js';
import { getDebugSkillTemplate } from '../src/core/templates/workflows/debug.js';
import { getSpecProposeSkillTemplate } from '../src/core/templates/workflows/spec-propose.js';
import {
    PROPOSAL_TEMPLATE,
    DESIGN_TEMPLATE,
    TASKS_TEMPLATE,
    SPECS_TEMPLATE,
} from '../src/core/spec/templates/index.js';
import { VERIFY_ANCHORS, renderAnchorHeading } from '../src/core/spec/validation/anchors.js';

describe('编排链就绪门控', () => {
    it('workflow：Phase 2→3 推进要求 readiness.status=pass', () => {
        const instructions = getWorkflowSkillTemplate().instructions;
        expect(instructions).toContain('`readiness`');
        expect(instructions).toContain('`readiness.status`');
        expect(instructions).toContain('`iagent spec validate --change "<name>" --ready`');
        // 缺字段时 MUST NOT 默认视为通过
        expect(instructions).toContain('MUST NOT 默认视为通过');
    });

    it('auto-workflow：延用同一门控', () => {
        const instructions = getAutoWorkflowSkillTemplate().instructions;
        expect(instructions).toContain('`readiness.status`');
        expect(instructions).toContain('MUST NOT 默认视为通过');
    });

    it('debug：Phase 6 复用同一就绪门，不另立口径', () => {
        // 主文件保留指针，细则下沉 references/gates-and-rules.md（500 行 / 20000 字符预算）
        const skill = getDebugSkillTemplate();
        const instructions = skill.instructions;
        expect(instructions).toContain('iagent spec validate --ready');
        expect(instructions).toContain('readiness.ts');
        // 判定口径细则在 references 中（同一判定单一源）
        const gates = skill.references?.find((ref) => ref.path.includes('gates-and-rules'));
        expect(gates).toBeDefined();
        expect(gates?.content).toContain('MUST NOT 另立判定口径');
    });

    it('spec-propose：终检顺序固定为 partial → ready → strict → handoff', () => {
        const instructions = getSpecProposeSkillTemplate().instructions;
        const partialIdx = instructions.indexOf('5.1');
        const readyIdx = instructions.indexOf('iagent spec validate --change "<name>" --ready');
        const strictIdx = instructions.indexOf('5.1.c strict 终检');
        const handoffIdx = instructions.indexOf('5.1.d handoff 包');
        expect(partialIdx).toBeGreaterThan(-1);
        expect(readyIdx).toBeGreaterThan(partialIdx);
        expect(strictIdx).toBeGreaterThan(readyIdx);
        expect(handoffIdx).toBeGreaterThan(strictIdx);
        expect(instructions).toContain('MUST NOT 重排');
    });

    it('spec-propose：过桥载体校验（missing-exploration 阻断静默跳过）', () => {
        const instructions = getSpecProposeSkillTemplate().instructions;
        expect(instructions).toContain('missing-exploration');
        expect(instructions).toContain('MUST NOT 跳过迁移静默继续生成');
    });

    it('spec-propose 回执含 readiness 字段', () => {
        const instructions = getSpecProposeSkillTemplate().instructions;
        expect(instructions).toContain('`readiness`（`{ status:');
    });
});

describe('生成协议：锚点与终检顺序', () => {
    it('制品包含验证锚点（三模板均产出）', () => {
        expect(PROPOSAL_TEMPLATE).toContain(renderAnchorHeading(VERIFY_ANCHORS.impactAnalysis));
        expect(DESIGN_TEMPLATE).toContain(renderAnchorHeading(VERIFY_ANCHORS.architectureImpact));
        expect(TASKS_TEMPLATE).toContain(renderAnchorHeading(VERIFY_ANCHORS.callerUpdates));
        expect(TASKS_TEMPLATE).toMatch(/\[N<id>\]/);
    });

    it('Generate artifacts in dependency order：模板结构符合 Why/what/Capabilities/Impact 与 ADDED', () => {
        expect(PROPOSAL_TEMPLATE).toContain('## Why');
        expect(PROPOSAL_TEMPLATE).toContain('## What Changes');
        expect(PROPOSAL_TEMPLATE).toContain('## Capabilities');
        expect(PROPOSAL_TEMPLATE).toContain('## Impact');
        expect(SPECS_TEMPLATE).toContain('## ADDED Requirements');
        expect(SPECS_TEMPLATE).toContain('#### Scenario:');
    });

    it('制品包含验证锚点：design 的架构影响在 Context 之下', () => {
        const contextIdx = DESIGN_TEMPLATE.indexOf('## Context');
        const archIdx = DESIGN_TEMPLATE.indexOf(renderAnchorHeading(VERIFY_ANCHORS.architectureImpact));
        expect(contextIdx).toBeGreaterThan(-1);
        expect(archIdx).toBeGreaterThan(contextIdx);
    });

    it('Caller Updates 位于 tasks 模板，且与任务组不冲突（三级标题）', () => {
        expect(TASKS_TEMPLATE).toContain(renderAnchorHeading(VERIFY_ANCHORS.callerUpdates));
        expect(TASKS_TEMPLATE).toContain('## 1.');
    });
});

describe('生成协议：项目侧规则投影与降级路径', () => {
    it('Generation protocol is shared：三个技能都引用同一项目侧协议路径', () => {
        const workflow = getWorkflowSkillTemplate().instructions;
        const auto = getAutoWorkflowSkillTemplate().instructions;
        const propose = getSpecProposeSkillTemplate().instructions;
        // 项目侧协议投影路径在 propose 与 workflow 中出现（auto 经 propose 承接）
        expect(propose).toContain('.iagent/rules/spec.md');
        expect(workflow).toContain('.iagent/rules/spec.md');
        expect(auto.length).toBeGreaterThan(0);
    });

    it('目标项目缺项目侧协议文件时降级：propose 记 WARN 不阻断', () => {
        const propose = getSpecProposeSkillTemplate().instructions;
        expect(propose).toContain('以本章内联要点为准并记 WARN');
        expect(propose).toContain('MUST NOT 阻断生成');
    });

    it('Validation failure is actionable：按路径与行号修正后重试', () => {
        const propose = getSpecProposeSkillTemplate().instructions;
        expect(propose).toContain('修复路径/行号诊断');
        expect(propose).toContain('MUST NOT 通过生成 JSON 副本绕过校验');
    });
});

describe('生成协议：规则源文件同步', () => {
    it('.iagent/rules/spec.md 含锚点产出与终检顺序要点', () => {
        const file = path.join(process.cwd(), '.iagent', 'rules', 'spec.md');
        const text = fs.readFileSync(file, 'utf8');
        expect(text).toContain('验证锚点');
        expect(text).toContain('就绪门');
        expect(text).toContain('partial');
    });
});
