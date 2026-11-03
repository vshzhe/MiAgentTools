/**
 * 模板文本与委托语义回归断言（变更 fix-mode-delegation-host-parity，任务 1.4）。
 *
 * 锁定：
 *   - `gate-skip=design-confirmation` 只跳设计确认门，其余门与停点不被豁免；
 *   - `auto-mode=true` 仅等价门承载轴，MUST NOT 被声明为 `mode=delegated` 的等价别名；
 *   - 被委派技能（spec-explore / spec-propose / spec-apply）的 Input 契约齐备；
 *   - workflow / auto-workflow 委派 apply/archive 而非内联，实现桥缺失时门仍阻塞。
 */

import { describe, it, expect } from 'vitest';
import { getSkillTemplates } from '../src/core/templates/index.js';
import {
    GATE_SKIP_IDS,
    renderGateSkipOption,
} from '../src/core/host-orchestration/delegation-contract.js';
import {
    TRANSITION_BLOCKERS,
    evaluatePhaseTransition,
    getWorkflowProtocol,
    negotiateCapabilities,
} from '../src/core/host-orchestration/index.js';

/** 取技能模板正文（缺失即失败，避免静默跳过） */
function body(commandId: string): string {
    const entry = getSkillTemplates().find((item) => item.commandId === commandId);
    if (!entry) {
        throw new Error(`技能模板缺失：${commandId}`);
    }
    return entry.template.instructions;
}

const GATE_SKIP_PARAM_TEXT = renderGateSkipOption(GATE_SKIP_IDS);

describe('门承载参数只跳设计确认门', () => {
    it('spec-apply 的 Input 声明 gate-skip 与 auto-mode 兼容写法', () => {
        const text = body('spec-apply');
        expect(text).toContain(GATE_SKIP_PARAM_TEXT);
        expect(text).toContain('auto-mode=true');
        expect(text).toContain('兼容写法');
        expect(text).toContain('跳过设计确认门');
    });

    it('spec-apply 明确该参数仅作用于设计门，其余门与停点照常生效', () => {
        const text = body('spec-apply');
        expect(text).toContain('该参数**仅**作用于本门，其余门与停点照常生效');
        // 测试执行门 / 范围蔓延 / 共享资源协议均未被豁免
        expect(text).toContain('测试执行门');
        expect(text).toContain('范围蔓延');
        // 共享资源协议条款写在派发细则参考文件中（同一技能的唯一源）
        const entry = getSkillTemplates().find((item) => item.commandId === 'spec-apply')!;
        const batch = entry.template.references?.find((ref) =>
            ref.path.includes('batch-scheduling')
        );
        expect(batch, 'spec-apply 缺少批调度参考文件').toBeDefined();
        expect(batch!.content).toContain('共享资源协议 MUST NOT 因该参数而豁免');
    });

    it('双轴契约声明「不豁免任何业务确认门」', () => {
        for (const commandId of ['spec-apply', 'spec-propose', 'spec-explore']) {
            expect(body(commandId), `${commandId} 缺门不豁免声明`).toContain(
                '不豁免任何业务确认门'
            );
        }
    });

    it('auto-mode 不被声明为 delegated 的等价别名', () => {
        // 错误声明（「auto-mode=true 为 mode=delegated 的等价别名」）不得残留
        for (const commandId of ['spec-apply', 'spec-propose', 'spec-explore', 'workflow', 'auto-workflow']) {
            const text = body(commandId);
            expect(text, `${commandId} 残留错误等价声明`).not.toContain(
                'auto-mode=true` 为 `mode=delegated` 的等价别名'
            );
            expect(text).not.toContain('`auto-mode=true` 为 `mode=delegated`');
        }
        // spec-propose 明确否定该等价关系
        expect(body('spec-propose')).toContain('**不是** `mode=delegated` 的等价别名');
    });

    it('auto-mode 不抑制停点：仅映射门承载轴且 mode 保持调用方原值', () => {
        for (const commandId of ['spec-propose', 'spec-apply']) {
            const text = body(commandId);
            expect(text).toContain('仅');
            expect(text).toContain('门承载轴');
        }
        // 契约文本要求「MUST NOT 视为 ... 等价别名」且模式保持原值
        expect(body('spec-apply')).toContain('`mode` 保持调用方原值');
    });
});

describe('被委派技能的 Input 契约齐备', () => {
    it('spec-explore 的 Input 显式声明 mode 与 gate-skip（非只在正文深处提及）', () => {
        const text = body('spec-explore');
        const start = text.indexOf('**Input**');
        const inputSection = text.slice(start, start + 1500);
        expect(start).toBeGreaterThanOrEqual(0);
        expect(inputSection).toContain('mode=interactive|delegated');
        expect(inputSection).toContain('gate-skip=design-confirmation');
        // 回执字段与编排协议一致
        expect(inputSection).toContain('结构化回执');
        expect(text).toContain('`phase` / `status` / 产物位置 / 下一步允许动作 / 失败原因');
        // 阶段主权归编排器
        expect(text).toContain('MUST NOT 自行进入提案或实现');
    });

    it('spec-explore interactive 保持立场式设计不变', () => {
        const text = body('spec-explore');
        expect(text).toContain('**这是一种立场，不是工作流。**');
        expect(text).toContain('没有固定步骤、没有必需顺序、没有强制产出');
    });

    it('spec-explore delegated 强制检查点体系齐备', () => {
        const text = body('spec-explore');
        for (const checkpoint of [
            '强制检查点体系',
            '提示词校验门',
            'CONTEXT.md',
            'L1-L5',
            '功能流程图',
            '聚合一致性门',
            '探索完成检测',
        ]) {
            expect(text, `delegated 检查点缺失：${checkpoint}`).toContain(checkpoint);
        }
        // delegated 不跳过确认门：强制检查点体系不可跳过
        expect(text).toContain('SHALL 执行强制检查点体系（不可跳过）');
        expect(text).toContain('不豁免任何业务确认门');
    });

    it('spec-propose delegated 契约齐备（exploration-file / 抑制 Phase 3 / 结尾回执）', () => {
        const text = body('spec-propose');
        expect(text).toContain('exploration-file=<path>');
        expect(text).toContain('抑制自身 Phase 3 验证');
        expect(text).toContain('抑制结尾规划边界停点');
        expect(text).toContain('结构化回执');
        // interactive 默认行为保持
        expect(text).toContain('默认 `mode=interactive` 行为与既有完全一致');
    });
});

describe('spec-propose 既有行为回归（improve-proposal-validation-and-spec-ref 期间保持不变）', () => {
    it('能力记忆注入与探索文件迁移步骤仍在', () => {
        const text = body('spec-propose');
        expect(text).toContain('openspec/specs/<capability>/explorations.md');
        expect(text).toContain('exploration.md');
        expect(text).toContain('移动成功且目标文件校验通过后，MUST 删除');
        expect(text).toContain('MUST NOT 追溯搬迁或删除');
    });

    it('流程基准锚点与降级声明仍在', () => {
        const text = body('spec-propose');
        expect(text).toContain('流程基准');
        expect(text).toContain('MUST NOT 静默补节点');
        expect(text).toContain('降级为仅凭 exploration.md');
    });

    it('测试规划判定与规划边界仍在', () => {
        const text = body('spec-propose');
        expect(text).toContain('测试规划判定');
        expect(text).toContain('已评估、无需测试');
        expect(text).toContain('规划边界');
    });

    it('前置验证门（Phase 3）仍强制执行', () => {
        const text = body('spec-propose');
        expect(text).toContain('Phase 3 验证（自动 —— 强制，不可跳过）');
        expect(text).toContain('iagent_spec_verify_proposal');
    });
});

describe('编排器委派 apply/archive 而非内联', () => {
    it('workflow 以 gate-skip 参数委派 spec-apply', () => {
        const text = body('workflow');
        expect(text).toContain(`传入 change-name + \`${GATE_SKIP_PARAM_TEXT}\``);
        expect(text).toContain('该参数**仅**跳过设计确认门');
        expect(text).toContain('测试执行门、范围蔓延确认与共享资源协议照常生效');
    });

    it('auto-workflow Phase 4 委派 apply（gate-skip）且不内联执行', () => {
        const text = body('auto-workflow');
        expect(text).toContain(`\`${GATE_SKIP_PARAM_TEXT}\` + \`change-name\` 调用 \`iagent_spec_apply\``);
        expect(text).toContain('MUST NOT 内联执行 apply 工作流逻辑');
        expect(text).not.toContain('Execute the apply workflow logic');
    });

    it('auto-workflow Phase 5 委派 archive（change-name）且只引用只读报告语义', () => {
        const text = body('auto-workflow');
        expect(text).toContain('`change-name` + `requirementDocStatus` 调用 `iagent_spec_archive`');
        // 归档侧只做存在性报告：不再引用 4.8 对齐分支
        expect(text).toContain('需求文档存在性**只读报告**');
        expect(text).not.toContain('需求文档对齐 step 4.8');
        expect(text).not.toContain('迁移至 devdocs');
    });

    it('auto-workflow 继承 apply 的测试执行门且失败仍阻塞', () => {
        const text = body('auto-workflow');
        expect(text).toContain('继承 `iagent_spec_apply` 的**测试执行门**');
        expect(text).toContain('**仅变更范围内**');
        expect(text).toContain('MUST NOT 静默通过，MUST NOT 进入归档');
        expect(text).not.toContain('另行定义测试门');
    });
});

describe('实现桥缺失时门仍生效（gate-skip 不绕过）', () => {
    const receipt = {
        phase: 'apply',
        status: 'ok',
        artifact: 'tasks.md',
        nextAllowed: 'verify',
    } as const;

    it('未确认实现桥时 workflow apply 阶段阻塞（与是否传 gate-skip 无关）', () => {
        const applyPhase = getWorkflowProtocol('workflow')!.phases.find((phase) => phase.id === 'apply')!;
        const result = evaluatePhaseTransition({
            phase: applyPhase,
            receipt,
            gateConfirmed: false,
            negotiation: negotiateCapabilities('claude', 'strict'),
        });
        expect(result.advance).toBe(false);
        expect(result.blockedBy).toContain('gate-unconfirmed');
        expect(applyPhase.gate?.id).toBe('implementation-bridge');
    });

    it('已确认实现桥时同阶段允许推进（门状态是唯一裁决依据）', () => {
        const applyPhase = getWorkflowProtocol('workflow')!.phases.find((phase) => phase.id === 'apply')!;
        const result = evaluatePhaseTransition({
            phase: applyPhase,
            receipt,
            gateConfirmed: true,
            negotiation: negotiateCapabilities('claude', 'strict'),
        });
        expect(result.advance).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 变更 improve-delegation-gate-ledger（链路 B，N14–N26）
// ---------------------------------------------------------------------------

/** 技能正文 + references（正文下沉的协议细则同样是契约） */
function corpus(commandId: string): string {
    const entry = getSkillTemplates().find((item) => item.commandId === commandId);
    if (!entry) {
        throw new Error(`技能模板缺失：${commandId}`);
    }
    const refs = (entry.template.references ?? []).map((ref) => ref.content).join('\n');
    return `${entry.template.instructions}\n${refs}`;
}

/** 取技能的单份参考文件正文（按路径片段匹配；缺失即空串） */
function referenceOf(commandId: string, pathPart: string): string {
    const entry = getSkillTemplates().find((item) => item.commandId === commandId);
    return (
        entry?.template.references?.find((ref) => ref.path.includes(pathPart))?.content ?? ''
    );
}

const SPEC_APPLY_STEP55 = body('spec-apply');

describe('spec-apply 门承载降级链（任务 2.3 / 7.1）', () => {
    it('三级次序固定：主通道 → 账本兜底 → 门照常执行', () => {
        expect(SPEC_APPLY_STEP55).toContain('三级降级链');
        const main = SPEC_APPLY_STEP55.indexOf('主通道');
        const fallback = SPEC_APPLY_STEP55.indexOf('兜底通道 —— 门账本');
        const failSafe = SPEC_APPLY_STEP55.indexOf('两者皆缺 —— 门照常执行');
        expect(main).toBeGreaterThanOrEqual(0);
        expect(fallback).toBeGreaterThan(main);
        expect(failSafe).toBeGreaterThan(fallback);
    });

    it('主通道为权威：存在时 MUST NOT 用账本覆盖', () => {
        expect(SPEC_APPLY_STEP55).toContain('MUST NOT 读取账本作覆盖');
        expect(SPEC_APPLY_STEP55).toContain('唯一权威');
    });

    it('兜底通道读取 handoff 包 ## 已确认门 并记 WARN', () => {
        expect(SPEC_APPLY_STEP55).toContain('## 已确认门');
        expect(SPEC_APPLY_STEP55).toContain('使用了门账本兜底通道');
        expect(SPEC_APPLY_STEP55).toContain('.openspec-tmp/pipeline-<change-name>/handoff-pack.md');
        expect(SPEC_APPLY_STEP55).toContain('MUST NOT 作为委派参数传入');
    });

    it('账本与回执不一致 / 过期 → WARN + 视为未确认', () => {
        expect(SPEC_APPLY_STEP55).toContain('与父级阶段回执的 `confirmedGates` 一致');
        expect(SPEC_APPLY_STEP55).toContain('视为未确认');
    });

    it('账本缺失时 Step 5.5 仍执行（不得静默跳过）', () => {
        expect(SPEC_APPLY_STEP55).toContain('Step 5.5 MUST 照常执行并等待用户显式确认');
        expect(SPEC_APPLY_STEP55).toContain(
            '未设置该参数或其为 false 时**不能**跳过本门'
        );
        expect(SPEC_APPLY_STEP55).toContain('未经显式确认不得继续');
    });

    it('账本条目表达门承载语义（写入父级阶段门 id 即 invalid-receipt）', () => {
        expect(SPEC_APPLY_STEP55).toContain('门账本只表达门承载语义');
        expect(SPEC_APPLY_STEP55).toContain('MUST NOT 写入父级阶段门 id');
        expect(SPEC_APPLY_STEP55).toContain('`implementation-bridge` / `requirement-doc-bridge` 不在域内');
        expect(SPEC_APPLY_STEP55).toContain('跳过表头行与分隔行');
    });
});

describe('spec-apply 既有门承载行为与停点回归（任务 2.4 / 6.1–6.3）', () => {
    it('gate-skip 跳过整道设计确认门并直接进入批调度', () => {
        expect(SPEC_APPLY_STEP55).toContain('跳过整个 Step 5.5 确认门');
        expect(SPEC_APPLY_STEP55).toContain('直接进入 Step 6');
        // 批计划仍在内部构建（不展示）
        expect(SPEC_APPLY_STEP55).toContain('批计划仍在内部构建用于执行，但不向用户展示');
    });

    it('auto-mode=true 仍是等价兼容写法', () => {
        expect(SPEC_APPLY_STEP55).toContain('auto-mode=true');
        expect(SPEC_APPLY_STEP55).toContain('兼容写法');
        expect(SPEC_APPLY_STEP55).toContain('该参数**仅**作用于本门，其余门与停点照常生效');
    });

    it('其余门与停点不被豁免（测试执行门 / 范围蔓延 / 共享资源协议）', () => {
        expect(SPEC_APPLY_STEP55).toContain('测试执行门');
        expect(SPEC_APPLY_STEP55).toContain('范围蔓延');
        expect(corpus('spec-apply')).toContain('共享资源协议 MUST NOT 因该参数而豁免');
    });

    it('批调度协议不变（派发单元 = 同组任务 / 并发上限 / 滑动窗口）', () => {
        expect(corpus('spec-apply')).toContain('apply.concurrency');
        expect(corpus('spec-apply')).toContain('采用滑动窗口派发');
        expect(corpus('spec-apply')).toContain('每个派发单元一个子代理');
    });

    it('编译硬门四值终态与无跳过出口', () => {
        const text = corpus('spec-apply');
        expect(text).toContain('编译检查阶段（硬门）');
        for (const status of ['`pass`', '`fail`', '`not-applicable`', '`disabled`']) {
            expect(text, `编译终态缺少 ${status}`).toContain(status);
        }
        expect(text).toContain('MUST NOT 伪造 `not-applicable` / `disabled`');
    });

    it('测试执行门：仅变更范围 + 存量失败只 WARN', () => {
        const text = corpus('spec-apply');
        expect(text).toContain('测试执行门');
        expect(text).toContain('仅限变更范围内');
        expect(text).toMatch(/存量失败|范围外的既有失败|范围外/);
        expect(text).toContain('MUST NOT 计为本变更的失败');
    });

    it('实现验证桥与归档桥阻断语义不变', () => {
        const workflow = corpus('workflow');
        expect(workflow).toContain('MUST 委派 `iagent_spec_verify` 技能验证实现与制品');
        expect(workflow).toContain('失败 → 回 Phase 4 修复，MUST NOT 进入归档');
        expect(workflow).toContain('status=fail');
        expect(workflow).toContain('阻断归档并回到 Phase 4');
        expect(workflow).toMatch(/MUST NOT 表述为「编译检查通过」/);
    });
});

describe('workflow 交付桥合并（任务 3.3 / 3.4 / 3.5）', () => {
    const workflow = corpus('workflow');
    const mainBody = body('workflow');

    it('单门呈现四要素 + 文档选项（一次呈现，覆盖旧两次停点）', () => {
        expect(workflow).toContain('交付桥');
        expect(workflow).toContain('实现 + 测试桥');
        expect(workflow).toContain('单次业务桥');
        for (const element of [
            '提案摘要',
            '验证评分',
            '深度复查结论',
            '实现方案',
            '测试计划预告',
            '是否生成需求文档',
        ]) {
            expect(workflow, `交付桥缺少要素 ${element}`).toContain(element);
        }
    });

    it('五出口齐备且不再在验证阶段二次停顿文档桥', () => {
        for (const exit of ['确认（实现 + 生成文档）', '确认（仅实现，跳过文档）', '仅生成文档', '修改', '拒绝']) {
            expect(workflow, `交付桥缺少出口 ${exit}`).toContain(exit);
        }
        // 旧的两段式停顿（3.5 单独停文档桥 + 3.7 再停实现桥）已消失
        expect(workflow).not.toContain('收束 —— 需求文档桥（⚠️ 单次业务桥，强制）');
        expect(workflow).not.toContain('桥完成后进入 Phase 3.7 实现桥');
        expect(workflow).toContain('MUST NOT 在验证阶段先单独停一次文档桥');
    });

    it('仅生成文档停在规划边界（不委派 apply）', () => {
        expect(workflow).toContain('停在规划边界');
        expect(workflow).toContain('MUST NOT 委派 `iagent_spec_apply`');
        expect(workflow).toContain('后续实现 MUST 由用户单独发起');
    });

    it('文档状态持久化失败不进入实现', () => {
        expect(workflow).toContain('写入 `## 需求文档状态` 失败（重试一次仍失败）');
        expect(workflow).toContain('MUST NOT 报告阶段完成');
        expect(workflow).toContain('不进入 Phase 4 实现');
    });

    it('拒绝与修改的回退范围显式', () => {
        expect(workflow).toContain('拒绝（记录未确认状态并停止，不进入实现）');
        expect(workflow).toContain('回 Phase 2 调整制品或回 Phase 1 补决策');
    });

    it('委派 apply 传 gate-skip 且以门承载语义表达', () => {
        expect(mainBody).toContain(`传入 change-name + \`${GATE_SKIP_PARAM_TEXT}\``);
        expect(mainBody).toContain('跳过 apply 内部的设计确认门');
        expect(mainBody).toContain('测试执行门、范围蔓延确认与共享资源协议照常生效');
    });

    it('委派前写门账本并校验存在，失败不委派（U4）', () => {
        expect(mainBody).toContain('门账本写入（U4，委派前强制）');
        expect(mainBody).toContain('## 已确认门');
        expect(mainBody).toContain('design-confirmation');
        expect(mainBody).toContain("confirmedGates: ['design-confirmation']");
        expect(mainBody).toContain('写入失败或校验失败');
        expect(mainBody).toContain('MUST NOT 委派');
        // 主通道 + 兜底双通道表述
        expect(mainBody).toContain('主通道');
        expect(mainBody).toContain('兜底');
    });

    it('实现桥缺失时门仍生效（gate-skip 不绕过）', () => {
        const applyPhase = getWorkflowProtocol('workflow')!.phases.find((phase) => phase.id === 'apply')!;
        const blocked = evaluatePhaseTransition({
            phase: applyPhase,
            receipt: { phase: 'apply', status: 'ok', artifact: 'tasks.md', nextAllowed: 'verify' },
            gateConfirmed: false,
            negotiation: negotiateCapabilities('claude', 'strict'),
        });
        expect(blocked.advance).toBe(false);
        expect(blocked.blockedBy).toContain(TRANSITION_BLOCKERS.gate);
        expect(applyPhase.gate?.id).toBe('implementation-bridge');
    });
});

describe('auto-workflow 接门账本但保留文档桥（任务 4.3 / 7.1）', () => {
    const auto = corpus('auto-workflow');

    it('文档桥仍是唯一流程级阻塞门（不合并交付桥）', () => {
        expect(auto).toContain('该桥是本阶段唯一的流程级阻塞门');
        expect(auto).toContain('MUST NOT 复用');
        expect(auto).toContain('文档桥保留为独立门');
        expect(getWorkflowProtocol('auto-workflow')!.phases.find((p) => p.id === 'verify')!.gate?.id).toBe(
            'requirement-doc-bridge'
        );
    });

    it('文档桥收束后写账本 + 回执携带 confirmedGates', () => {
        expect(auto).toContain('门账本写入（U4，委派前强制）');
        expect(auto).toContain("confirmedGates: ['design-confirmation']");
        expect(auto).toContain('## 已确认门');
    });

    it('Phase 4 委派前校验账本；gate-skip 主通道 + 账本兜底；两者皆缺时设计门触发', () => {
        expect(auto).toContain('门账本校验（委派前强制）');
        expect(auto).toContain('`gate-skip` 是**主通道**（权威），账本是参数丢失时的**兜底**');
        expect(auto).toContain('被委派 apply 的设计确认门照常触发');
        expect(auto).toContain('MUST NOT 报告为「全自动无停顿」');
        expect(auto).toContain('MUST NOT 继续自动委派');
    });

    it('Phase 4 / Phase 5 委派而非内联', () => {
        expect(auto).toContain('调用 `iagent_spec_apply`');
        expect(auto).toContain('`change-name` + `requirementDocStatus` 调用 `iagent_spec_archive`');
        expect(auto).not.toContain('Execute the apply workflow logic');
    });

    it('Phase 5 正文无已移除分支残留', () => {
        expect(auto).not.toContain('4.8');
        expect(auto).not.toContain('迁移至 devdocs');
        expect(auto).toContain('需求文档存在性**只读报告**');
    });
});

describe('handoff 包账本段与六节共存（任务 1.8 / 5.5）', () => {
    const PACK = '.openspec-tmp/pipeline-<change-name>/handoff-pack.md';
    const SIX_SECTIONS = [
        '## 变更摘要',
        '## 契约',
        '## 规范要点',
        '## 文件归属表',
        '## Codebase 摘要',
        '## 已产出（跨单元可见）',
    ];

    it('spec-apply 六节枚举顺序不变，账本段并列其后', () => {
        // 六节枚举与账本段同处批调度协议（references/batch-scheduling.md，正文下沉的单一源）
        const batch = referenceOf('spec-apply', 'batch-scheduling');
        expect(batch).not.toBe('');
        const indices = SIX_SECTIONS.map((section) => batch.indexOf(section));
        expect(indices.every((index) => index >= 0)).toBe(true);
        expect([...indices].sort((a, b) => a - b)).toEqual(indices);
        const ledger = batch.indexOf('不是第七个内容节');
        const conclusion = batch.indexOf('## 阶段结论`（可选');
        expect(ledger).not.toBe(-1);
        expect(ledger).toBeGreaterThan(indices[indices.length - 1]);
        expect(conclusion).toBeGreaterThan(ledger);
        // 不计入六节：账本只作为「并列段」出现，六节名称逐字未变
        expect(SIX_SECTIONS).not.toContain('## 已确认门');
        expect(batch).toContain('不是第七个内容节');
    });

    it('verify / archive 只读账本且不改写既有条目', () => {
        for (const name of ['spec-verify', 'spec-archive']) {
            const text = body(name);
            expect(text, `${name} 未声明包路径`).toContain(PACK);
            expect(text, `${name} 未声明账本只读`).toContain('## 已确认门');
            expect(text, `${name} 未禁止改写账本`).toContain('MUST NOT 改写');
        }
    });
});

