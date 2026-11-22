/**
 * verify-checklist-single-source：清单单一源 + 阈值/编号不变性 + propose 压缩自检。
 *
 * 覆盖能力 `verify-checklist-single-source` 的全部 Scenario。
 */

import { describe, it, expect } from 'vitest';
import {
    renderVerifyChecklist,
    VERIFY_DIMENSIONS,
    VERIFY_BOUNDARY_RULES,
    VERIFY_THRESHOLD,
    VERIFY_SCORE_FORMULA,
    PROPOSE_SELF_CHECK_ITEMS,
} from '../src/core/templates/verify-checklist.js';
import { getSpecVerifyProposalSkillTemplate } from '../src/core/templates/workflows/spec-verify-proposal.js';
import { getSpecVerifyChangeSkillTemplate } from '../src/core/templates/workflows/spec-verify.js';
import { getWorkflowSkillTemplate } from '../src/core/templates/workflows/workflow.js';
import { getAutoWorkflowSkillTemplate } from '../src/core/templates/workflows/auto-workflow.js';
import { getDebugSkillTemplate } from '../src/core/templates/workflows/debug.js';
import { getSpecProposeSkillTemplate } from '../src/core/templates/workflows/spec-propose.js';

const ORCHESTRATOR_CHECKLIST = renderVerifyChecklist();
const PROPOSE_CHECKLIST = renderVerifyChecklist({ variant: 'propose-selfcheck' });

describe('验证清单单一源：五个技能引用同一清单', () => {
    it('orchestrator 变体含全部维度与边界条目', () => {
        for (const dimension of VERIFY_DIMENSIONS) {
            expect(ORCHESTRATOR_CHECKLIST).toContain(dimension.label);
        }
        for (const rule of VERIFY_BOUNDARY_RULES) {
            expect(ORCHESTRATOR_CHECKLIST).toContain(rule.split(' ')[0]);
        }
    });

    it('spec-verify / workflow / auto-workflow / debug 生成正文均含同一清单', () => {
        // workflow 的清单位于 references/verification-protocol.md（渐进披露），正文两处合并断言
        const workflowSkill = getWorkflowSkillTemplate();
        const workflowChecklistText = [
            workflowSkill.instructions,
            ...(workflowSkill.references ?? []).map((ref) => ref.content),
        ].join(String.fromCharCode(10));
        expect(workflowChecklistText).toContain(VERIFY_DIMENSIONS[0].label);
        expect(workflowChecklistText).toContain(VERIFY_DIMENSIONS[1].label);
        expect(workflowChecklistText).toContain('B1 自写制品自证');

        const auto = getAutoWorkflowSkillTemplate().instructions;
        expect(auto).toContain(VERIFY_DIMENSIONS[0].label);
        expect(auto).toContain('B7 无 `delegate` 宿主仅阻断 propose/apply');

        // spec-verify：插值整段清单
        expect(getSpecVerifyChangeSkillTemplate().instructions).toContain(ORCHESTRATOR_CHECKLIST);

        // debug：主文件或 references 含清单插值
        const debugSkill = getDebugSkillTemplate();
        const debugChecklistText = [
            debugSkill.instructions,
            ...(debugSkill.references ?? []).map((ref) => ref.content),
        ].join(String.fromCharCode(10));
        expect(debugChecklistText).toContain(VERIFY_DIMENSIONS[0].label);
    });

    it('spec-verify-proposal 声明清单单一源，不另写副本', () => {
        const instructions = getSpecVerifyProposalSkillTemplate().instructions;
        expect(instructions).toContain('清单单一源');
        expect(instructions).toContain('verify-checklist.ts');
        expect(instructions).toContain('MUST NOT 另写清单副本');
    });

    it('清单内容改动只改一处：渲染结果即真源（无逐模板硬编码维度枚举）', () => {
        // 若某模板手写了完整 B1-B7 枚举，则其文本应等于单一源渲染结果；本测试锁定
        // 「模板中出现 B1-B7 全文 ⇒ 必等于 renderVerifyChecklist() 输出」
        const boundaryText = VERIFY_BOUNDARY_RULES.join('／');
        const workflowSkill = getWorkflowSkillTemplate();
        const debugSkill = getDebugSkillTemplate();
        const templates = [
            [workflowSkill.instructions, ...(workflowSkill.references ?? []).map((ref) => ref.content)].join(String.fromCharCode(10)),
            getAutoWorkflowSkillTemplate().instructions,
            [debugSkill.instructions, ...(debugSkill.references ?? []).map((ref) => ref.content)].join(String.fromCharCode(10)),
        ];
        for (const instructions of templates) {
            if (instructions.includes('B2 FAIL 同上下文修复')) {
                expect(instructions).toContain(boundaryText);
            }
        }
    });
});

describe('验证清单单一源：阈值与编号保持不变（D4）', () => {
    it('维度编号仍为 D1-D10，无 D11+', () => {
        const ids = VERIFY_DIMENSIONS.map((dimension) => dimension.id);
        expect(ids).toEqual(['D1', 'D2', 'D3', 'D4', 'D5', 'D6-D10']);
        expect(ORCHESTRATOR_CHECKLIST).not.toMatch(/D1[1-9]/);
    });

    it('阈值为 90%', () => {
        expect(VERIFY_THRESHOLD).toBe(90);
        expect(ORCHESTRATOR_CHECKLIST).toContain('统一 90%');
    });

    it('总分公式原文未改写', () => {
        expect(VERIFY_SCORE_FORMULA).toBe(
            'Overall Score = (D1 + D2 + D3 + D4 + D5 + sum(triggered D6-D10)) / (5 + triggered_count)',
        );
        const instructions = getSpecVerifyProposalSkillTemplate().instructions;
        expect(instructions).toContain(
            'Overall Score = (D1 + D2 + D3 + D4 + D5 + sum(triggered D6-D10)) / (5 + triggered_count)',
        );
    });
});

describe('压缩自检清单与验证清单同源', () => {
    it('Scenario: propose 自检清单来自同一真源', () => {
        const instructions = getSpecProposeSkillTemplate().instructions;
        expect(instructions).toContain('压缩自检清单');
        expect(instructions).toContain('与验证清单同源');
        expect(instructions).toContain('verify-checklist.ts');
        // 子集条目内容来自 PROPOSE_SELF_CHECK_ITEMS
        for (const item of PROPOSE_SELF_CHECK_ITEMS) {
            expect(PROPOSE_CHECKLIST).toContain(item);
        }
    });

    it('Scenario: 自检失败不新增门（既有三出口）', () => {
        const instructions = getSpecProposeSkillTemplate().instructions;
        expect(instructions).toContain('超限 → 走既有三出口（手动编辑 / 返回探索 / 查看差异）');
        expect(instructions).toContain('MUST NOT 新增确认门');
        expect(PROPOSE_CHECKLIST).toContain('MUST NOT 新增确认门');
    });

    it('压缩自检为确定性可判子集（不含 AI 语义项）', () => {
        expect(PROPOSE_CHECKLIST).toContain('确定性可判子集');
        expect(PROPOSE_SELF_CHECK_ITEMS.length).toBeGreaterThanOrEqual(5);
        // 每个子项均描述可机械核验的条件
        for (const item of PROPOSE_SELF_CHECK_ITEMS) {
            expect(item).toMatch(/Spec Ref|Scenario Ref|锚点|能力|节点/);
        }
    });
});
