/**
 * 制品数据流结构指标测试（improve-workflow-artifact-dataflow）。
 *
 * 锁定两类**制品**在技能模板中的处理链路：
 *   ① 探索文件：提案阶段由 `openspec/explorations/` 移动入变更目录，移动成功即删源
 *      （流程中只保留变更目录内的一份），失败则保留源文件；
 *   ② 评审需求文档：改由**归档阶段**生成（`spec-archive` 步骤 4.8 / `spec-bulk-archive` 步骤 a.6），
 *      提案校验后不再生成 —— 生成能力唯一收敛到两个归档技能。
 *
 * 断言口径全部取自 `src/core/templates/workflows/*.ts` 的实际正文（经 getSkillTemplates() 派生），
 * 与 `skills/` 生成快照解耦：模板改动即触发失败。
 */

import { describe, it, expect } from 'vitest';
import { getSkillTemplates } from '../src/core/templates/index.js';
import { resolveWorkflows } from '../src/core/profiles.js';

const skills = getSkillTemplates();
const byName = new Map(skills.map((s) => [s.template.name, s]));

/** 探索文件「移动语义」的两个实现技能 */
const MOVE_SEMANTICS_SKILLS = ['venus_tr_impl_workflow', 'venus_tr_impl_auto_workflow'];

/** 迁移探索文件的全部链路技能（含提案侧） */
const MIGRATING_SKILLS = [...MOVE_SEMANTICS_SKILLS, 'venus_spec_propose'];

/** 已移除「校验 PASS 后自动生成需求文档」调用步的技能（需求文档移出提案/实现侧） */
const CALL_STEP_REMOVED_SKILLS = [
    'venus_tr_impl_workflow',
    'venus_tr_impl_auto_workflow',
    'venus_tr_impl_genfull',
    'venus_tr_impl_debug',
];

/** 取技能正文；技能未注册时立即失败，避免断言静默空转 */
function instructions(name: string): string {
    const entry = byName.get(name);
    expect(entry, `技能 ${name} 未注册`).toBeDefined();
    return entry?.template.instructions ?? '';
}

/** 取技能白名单条目（逗号分隔 + trim） */
function entries(name: string): string[] {
    const entry = byName.get(name);
    expect(entry, `技能 ${name} 未注册`).toBeDefined();
    return (entry?.template.allowedTools ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}

/** 取正文中同时含全部关键词的行（用于「同句」语义判定） */
function linesContaining(body: string, keywords: readonly string[]): string[] {
    return body
        .split('\n')
        .filter((line) => keywords.every((keyword) => line.includes(keyword)));
}

describe('A1 探索文件移动语义（成功删源 / 失败保留）', () => {
    it('两个实现技能均声明删除源的移动语义', () => {
        for (const name of MOVE_SEMANTICS_SKILLS) {
            const body = instructions(name);
            expect(body, `${name} 未声明移动语义`).toMatch(/move semantics/i);
            // 删源语义：移动成功后源文件不再存在（只保留变更目录内的一份）
            expect(body, `${name} 未声明「单份驻留」的删源结果`).toMatch(
                /DELETE|DELETED|NOT kept|no original copy/i
            );
        }
    });

    it('迁移链路不再出现任何「保留源文件」的旧表述', () => {
        const abolished = [
            'Preserve source file unchanged',
            'Source File Preservation',
            'preserved (not deleted)',
            'Preserve the exploration file — do NOT delete it.',
        ];
        for (const name of MIGRATING_SKILLS) {
            const body = instructions(name);
            for (const phrase of abolished) {
                expect(body, `${name} 仍残留旧表述「${phrase}」`).not.toContain(phrase);
            }
        }
    });

    it('三处迁移均保留「迁移失败保留源文件」语义', () => {
        for (const name of MIGRATING_SKILLS) {
            expect(instructions(name), `${name} 缺少失败保留源文件语义`).toMatch(
                /preserve the source file|保留源文件/i
            );
        }
    });
});

describe('A2 归档阶段生成需求文档（双分支）', () => {
    /** 两个归档技能各自的预归档检查点步骤标识 */
    const CHECKPOINTS: Record<string, RegExp> = {
        venus_spec_archive: /4\.8 \*\*Pre-Archive Requirement Document Generation/,
        venus_spec_bulk_archive: /a\.6 \*\*Pre-archive requirement document generation/,
    };

    it('预归档检查点步骤存在且含双分支断句', () => {
        for (const [name, marker] of Object.entries(CHECKPOINTS)) {
            const body = instructions(name);
            expect(body, `${name} 缺少预归档需求文档生成步骤`).toMatch(marker);
            // 分支一：不存在则委派需求文档技能生成
            expect(body, `${name} 缺少委派生成分支`).toContain('venus_tr_docs_requirement_doc');
            // 分支二：已存在则就地增量对齐并保人工域
            expect(body, `${name} 缺少就地增量对齐分支`).toMatch(/in-place/i);
            // 人工域两个章节：基本信息 / 评审记录
            expect(body, `${name} 缺少人工域「基本信息」断句`).toContain('## 基本信息');
            expect(body, `${name} 缺少人工域「评审记录」断句`).toContain('## 八、评审记录');
        }
    });
});

describe('A3 提案校验后不再生成需求文档', () => {
    it('四个技能均不含「校验 PASS 后自动生成需求文档」的调用步', () => {
        for (const name of CALL_STEP_REMOVED_SKILLS) {
            const body = instructions(name);
            expect(body, `${name} 仍含自动生成调用断句`).not.toContain('Auto-generate requirement document');
            expect(body, `${name} 仍含 Stage 2.3 需求文档生成调用步`).not.toContain('Stage 2.3 需求文档生成');
        }
    });

    it('调试技能含明确禁令（MUST NOT 与委派技能同句）', () => {
        const prohibition = linesContaining(instructions('venus_tr_impl_debug'), [
            'MUST NOT',
            'venus_tr_docs_requirement_doc',
        ]);
        expect(prohibition.length, '缺少「MUST NOT … venus_tr_docs_requirement_doc」同句禁令').toBeGreaterThan(0);
    });
});

describe('A4 白名单委派面与正文一致', () => {
    /** 归档侧与自动工作流：仍委派需求文档技能 */
    const WITH_REQUIREMENT_DOC = [
        'venus_spec_archive',
        'venus_spec_bulk_archive',
        'venus_tr_impl_auto_workflow',
    ];

    /** 链路移除侧：不再委派需求文档技能 */
    const WITHOUT_REQUIREMENT_DOC = [
        'venus_tr_impl_workflow',
        'venus_tr_impl_debug',
        'venus_tr_impl_genfull',
    ];

    it('归档侧与自动工作流含 Skill(tr_docs_requirement_doc) 且正文确提及', () => {
        for (const name of WITH_REQUIREMENT_DOC) {
            // 白名单条目取自 skillDelegation() 的本地技能名（不带 venus_ 前缀）
            expect(entries(name), `${name} 白名单缺少需求文档委派条目`).toContain(
                'Skill(tr_docs_requirement_doc)'
            );
            // 授权委派的前提是正文确有委派动作，避免幽灵授权
            expect(instructions(name), `${name} 正文未提及被委派技能`).toContain(
                'venus_tr_docs_requirement_doc'
            );
        }
    });

    it('链路移除侧不含该委派条目', () => {
        for (const name of WITHOUT_REQUIREMENT_DOC) {
            expect(entries(name), `${name} 白名单残留需求文档委派条目`).not.toContain(
                'Skill(tr_docs_requirement_doc)'
            );
        }
    });

    it('全部技能的 Skill(...) 条目均在正文有对应提及（无死条目）', () => {
        const registeredNames = new Set(skills.map((s) => s.template.name));
        for (const { template, commandId } of skills) {
            const delegated = entries(template.name)
                .filter((entry) => entry.startsWith('Skill('))
                .map((entry) => entry.slice('Skill('.length, -1));
            for (const name of delegated) {
                expect(registeredNames, `${commandId} 委派了未注册技能 venus_${name}`).toContain(
                    `venus_${name}`
                );
                expect(template.instructions, `${commandId} 正文未提及被委派技能 venus_${name}`).toContain(
                    `venus_${name}`
                );
            }
        }
    });
});

describe('A5 DEPS 注入口径', () => {
    it('两个归档技能均注入 spec-verify 与需求文档技能', () => {
        expect(resolveWorkflows(['spec-archive']).injected).toEqual(['spec-verify', 'tr-docs-requirement-doc']);
        expect(resolveWorkflows(['spec-bulk-archive']).injected).toEqual([
            'spec-verify',
            'tr-docs-requirement-doc',
        ]);
    });

    it('调试技能仅注入提案评分技能', () => {
        expect(resolveWorkflows(['tr-impl-debug']).injected).toEqual(['spec-verify-proposal']);
    });

    it('未配置时仅注入需求文档技能', () => {
        expect(resolveWorkflows().injected).toEqual(['tr-docs-requirement-doc']);
    });
});

describe('A6 生成能力唯一收敛到归档侧', () => {
    it('genfull 正文声明归档阶段生成需求文档', () => {
        const body = instructions('venus_tr_impl_genfull');
        // 归档阶段与需求文档同句出现（如「需求文档改由归档阶段生成」「归档阶段步骤 4.8 生成」）
        const declarations = linesContaining(body, ['归档', '需求文档']);
        expect(declarations.length, 'genfull 未声明归档阶段生成需求文档').toBeGreaterThan(0);
        expect(body).toContain('4.8');
    });

    it('auto-workflow 的 Phase 5 归档步骤枚举含需求文档生成引用', () => {
        const body = instructions('venus_tr_impl_auto_workflow');
        expect(body).toContain('**requirement document generation**');
        expect(body).toContain('venus_spec_archive');
        expect(body).toContain('4.8');
    });

    it('双分支正文唯一：预归档检查点标题只在两个归档技能中定义', () => {
        const owners = skills
            .filter(({ template }) =>
                /4\.8 \*\*Pre-Archive Requirement Document Generation|a\.6 \*\*Pre-archive requirement document generation/.test(
                    template.instructions
                )
            )
            .map((s) => s.template.name)
            .sort();
        // 锁定：除两个归档技能外，任何技能不得再定义一份双分支正文
        expect(owners).toEqual(['venus_spec_archive', 'venus_spec_bulk_archive']);
    });

    it('人工域章节提及面受控：非归档侧仅存在于需求文档模板本体与引用/禁令语境', () => {
        const mentions = skills
            .filter(({ template }) => template.instructions.includes('## 八、评审记录'))
            .map((s) => s.template.name)
            .sort();
        // 两个归档技能 = 双分支正文持有者；需求文档技能 = 章节骨架持有者；
        // auto-workflow = 归档步骤枚举引用；debug = 需求文档禁用令
        expect(mentions).toEqual([
            'venus_spec_archive',
            'venus_spec_bulk_archive',
            'venus_tr_docs_requirement_doc',
            'venus_tr_impl_auto_workflow',
            'venus_tr_impl_debug',
        ]);
        // 引用语境自证：auto-workflow 明示「不复制分支正文、只引用 step 4.8」
        expect(instructions('venus_tr_impl_auto_workflow')).toContain('MUST NOT copy the branch rule text');
        // 禁令语境自证：debug 明示需求文档不在其范围内
        const debugBody = instructions('venus_tr_impl_debug');
        expect(debugBody).toContain('MUST NOT');
        expect(debugBody).toContain('venus_tr_docs_requirement_doc');
    });
});
