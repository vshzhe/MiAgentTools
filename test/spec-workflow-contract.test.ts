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

    it('auto-workflow Phase 5 委派 archive（change-name）', () => {
        const text = body('auto-workflow');
        expect(text).toContain('`change-name` + `requirementDocStatus` 调用 `iagent_spec_archive`');
        // 文档对齐沿用 archive 单一源（present → 就地对齐；absent → 委派 requirement-doc）
        expect(text).toContain('需求文档对齐 step 4.8');
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
