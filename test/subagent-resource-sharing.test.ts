/**
 * 多子代理派发「共享资源协议」结构指标断言（A1–A8）。
 *
 * 变更：improve-workflow-subagent-resource-sharing
 *
 * ## 已评估、判定无需运行时测试（任务 7.6）
 *
 * 本次为**纯 prompt 模板正文改造**，被改造的能力（共享上下文包产出、产出登记表追加、
 * 包缺口回填、项目粒度降级、子代理不可用降级、探查摘要落盘失败降级、失效规则）全部是
 * **运行时编排行为** —— 由 AI 在目标项目中按正文执行，仓库内**没有可驱动的运行时执行体**
 * （无编译产物函数、无 CLI 入口、无 HTTP 端点），因此无法在 vitest 中驱动这些行为并断言结果。
 *
 * 替代防线：以**结构指标断言**（A1–A8）锁定模板正文中的协议约束 —— 可回归、可防漂移，
 * 使「没写运行时测试」与「没评估过」可区分。真正的行为验证需在目标项目中跑一次真实
 * apply/debug 流程，属人工验收范围（design.md D15 已裁决不追加实测比对）。
 */

import { describe, it, expect } from 'vitest';
import { getSkillTemplates, getCommandTemplates } from '../src/core/templates/index.js';

/** 按技能名取模板正文（渲染后的 instructions + references 全文）。 */
function skillBody(name: string): string {
    const entry = getSkillTemplates().find((s) => s.template.name === name);
    if (!entry) {
        throw new Error(`技能模板缺失: ${name}`);
    }
    const refs = (entry.template.references ?? []).map((r) => r.content).join('\n');
    return `${entry.template.instructions}\n${refs}`;
}

/** 按 workflow id 取指令正文（command 版 content）。 */
function commandBody(workflowId: string): string {
    const entry = getCommandTemplates().find((c) => c.id === workflowId);
    if (!entry) {
        throw new Error(`指令模板缺失: ${workflowId}`);
    }
    return entry.template.content;
}

describe('A1–A4 · spec-apply 共享资源协议（单一源正文）', () => {
    const body = skillBody('iagent_spec_apply');

    it('A1 上下文包六节齐备且路径正确', () => {
        // 六节名称逐字（顺序即协议规定的产出顺序）
        expect(body).toContain('## 变更摘要');
        expect(body).toContain('## 契约');
        expect(body).toContain('## 规范要点');
        expect(body).toContain('## 文件归属表');
        expect(body).toContain('## Codebase 摘要');
        expect(body).toContain('## 已产出（跨单元可见）');
        // 制品名与流程级工作区路径
        expect(body).toContain('context-pack.md');
        expect(body).toContain('.openspec-tmp/apply-<change-name>/');
        // 包是子代理唯一必读制品
        expect(body).toContain('上下文包是子代理**唯一**必读的制品');
    });

    it('A1 一次性产出 + 逐批追加（不重产整包）', () => {
        expect(body).toContain('只在首次派发前产出一次');
        expect(body).toContain('MUST NOT 重产整包');
        // 追加动作与批后集中勾选同段
        expect(body).toContain('把本批的产出文件与公开签名追加到包');
    });

    it('A2 调度指令不再内联规范摘要，改为引用包', () => {
        // 反向断言：旧的内联规范摘要条目已消失
        expect(body).not.toContain('A summary of the key AI coding guardrails from openspec/rules/ai-coding.md');
        // 正向断言：改为引用 + 明文禁止内联
        expect(body).toContain('指令 MUST NOT 内联完整护栏摘要');
        expect(body).toContain('## 规范要点');
    });

    it('A3 禁止项、缺口回执、公开签名定义与空值处置', () => {
        expect(body).toContain('MUST NOT 重读 proposal/specs/design');
        expect(body).toContain('MUST NOT 重跑包已覆盖的 CodeGraph 查询');
        expect(body).toContain('包缺口回执');
        expect(body).toContain('公开签名');
        // 空值处置：不留空、不编造
        expect(body).toContain('MUST NOT 留空');
        expect(body).toContain('MUST NOT 编造');
        // 反幻觉：包是蒸馏视图而非替代品
        expect(body).toContain('包是蒸馏视图，不是制品的替代品');
    });

    it('A4 调度指令共享前缀固定顺序且字节一致', () => {
        expect(body).toContain('共享前缀');
        expect(body).toContain('单元差异部分');
        expect(body).toContain('逐字节一致');
    });
});

describe('A5 · 多项目扫描单代理化（探索委派后归 spec_explore）', () => {
    const SKILL = 'iagent_spec_explore';
    const REQ = [
        '只派发**一个**子代理，让其在自身内部**串行**扫描全部检测到的项目',
        'MUST NOT 为每个项目路径各派一个子代理',
    ];

    it('spec_explore skill 版：单子代理串行扫描全部项目', () => {
        const body = skillBody(SKILL);
        for (const text of REQ) {
            expect(body).toContain(text);
        }
    });

    it('spec_explore command 版：引用探索协议全文', () => {
        const body = commandBody('spec-explore');
        // 强制 checkpoint 体系已下沉 references/，指令版以指针引用
        expect(body).toContain('references/exploration-protocol.md');
    });

    it('全文无「每项目一个子代理」残留', () => {
        const bodies = [skillBody(SKILL), commandBody('spec-explore')];
        for (const body of bodies) {
            expect(body).not.toContain('one per project');
            expect(body).not.toContain('Spawn sub-agents sequentially');
            expect(body).not.toContain('Spawn sub-agent for each other project');
        }
    });
});

describe('A6 · debug 流程级探查摘要共享（skill + command 两处）', () => {
    const SKILL = 'iagent_debug';
    const WORKFLOW_ID = 'debug';

    // 摘要协议设在技能主文件（instructions）—— skill 与 command 两处均须可见
    const IN_INSTRUCTIONS = [
        'investigation-digest.md',
        'debug-<keyword>/',
        '先读摘要',
        '增量查询',
        '清理调试工作区',
    ];
    // 排查细则下沉 references/investigation-protocol.md —— 指令版以指针引用（与 A5 command 版一致）
    const IN_REFERENCE = [
        'MUST NOT 重跑已覆盖的 CodeGraph 查询',
        '增量追加',
    ];

    it('skill 版含探查摘要五类表述', () => {
        const body = skillBody(SKILL);
        for (const text of [...IN_INSTRUCTIONS, ...IN_REFERENCE]) {
            expect(body).toContain(text);
        }
    });

    it('command 版含主文件级摘要表述并指针引用 references', () => {
        const body = commandBody(WORKFLOW_ID);
        for (const text of IN_INSTRUCTIONS) {
            expect(body).toContain(text);
        }
        // 细则下沉 references：指令版引用指针，不内联第二份正文
        expect(body).toContain('references/investigation-protocol.md');
    });

    it('失效规则与 keyword 派生规则已明文', () => {
        const body = skillBody(SKILL);
        expect(body).toContain('已失效（由');
        expect(body).toContain('kebab-case');
    });

    it('非交付物划界：摘要不得替代诊断记录', () => {
        const body = skillBody(SKILL);
        expect(body).toContain('investigation-digest.md');
        expect(body).toContain('流程内缓存');
    });

    it('反向断言：正文不含需求版流程图列头，且保留缺陷链路标记', () => {
        const bodies = [skillBody(SKILL), commandBody(WORKFLOW_ID)];
        for (const body of bodies) {
            expect(body).not.toContain('| 异常路径 |');
        }
        expect(skillBody(SKILL)).toContain('🟠根因');
    });
});

describe('A8 · auto-migration 规范要点写入共享包（skill + command 两处）', () => {
    const SKILL = 'iagent_migration';
    const WORKFLOW_ID = 'migration';

    const REQUIRED = [
        'MUST 写入上下文包的 `## 规范要点` 段',
        'MUST NOT 全文内联规范要点',
        '降级为逐子代理内联注入',
    ];

    it('skill 版：写入包 + 不内联 + 退化分支', () => {
        const body = skillBody(SKILL);
        for (const text of REQUIRED) {
            expect(body).toContain(text);
        }
    });

    it('command 版：语义与 skill 版一致', () => {
        const body = commandBody(WORKFLOW_ID);
        for (const text of REQUIRED) {
            expect(body).toContain(text);
        }
    });

    it('反向断言：逐子代理内联注入不再是主路径', () => {
        const bodies = [skillBody(SKILL), commandBody(WORKFLOW_ID)];
        for (const body of bodies) {
            expect(body).not.toContain('Every sub-agent dispatch instruction MUST inject the target coding-spec essentials');
        }
    });
});
