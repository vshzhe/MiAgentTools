/**
 * 制品数据流结构指标测试（improve-workflow-artifact-dataflow +
 * improve-workflow-debug-bridges）。
 *
 * 锁定两类**制品**在技能模板中的处理链路：
 *   ① 探索文件：提案阶段由 `openspec/explorations/` 移动入变更目录，移动成功即删源
 *      （流程中只保留变更目录内的一份），失败则保留源文件；
 *   ② 评审需求文档：由 workflow / auto-workflow / debug 三父流程在验证 PASS 且深度复查
 *      收束后经**一次“生成 / 跳过”业务桥**决定（独立 verifier 与 spec-propose 独立调用
 *      均不生成）；桥结果以四值状态持久于变更 `exploration.md`，经 verify → apply → archive
 *      handoff；归档按**存在性只读报告**处理（不生成 / 不对齐 / 不迁出）。
 *
 * 断言口径全部取自 `src/core/templates/workflows/*.ts` 的实际正文（经 getSkillTemplates()
 * 派生，references 一并纳入 —— workflow 的桥细则下沉在 references/verification-protocol.md），
 * 与 `skills/` 生成快照解耦：模板改动即触发失败。
 */

import { describe, it, expect } from 'vitest';
import { getSkillTemplates, getCommandTemplates } from '../src/core/templates/index.js';
import { resolveWorkflows } from '../src/core/profiles.js';

const skills = getSkillTemplates();
const commands = getCommandTemplates();
const byName = new Map(skills.map((s) => [s.template.name, s]));

/** 探索文件「移动语义」的实现技能（委派化后迁移职责归 iagent_spec_propose） */
const MOVE_SEMANTICS_SKILLS = ['iagent_spec_propose'];

/** 迁移探索文件的全部链路技能（含提案侧） */
const MIGRATING_SKILLS = ['iagent_spec_propose'];

/** 三父流程（文档桥唯一自动调用方） */
const PARENT_FLOWS = ['iagent_workflow', 'iagent_auto_workflow', 'iagent_debug'];

/** 取技能正文；技能未注册时立即失败，避免断言静默空转 */
function instructions(name: string): string {
    const entry = byName.get(name);
    expect(entry, `技能 ${name} 未注册`).toBeDefined();
    return entry?.template.instructions ?? '';
}

/** 取技能正文 + 全部 references（正文下沉的协议细则同样是契约的一部分） */
function corpus(name: string): string {
    const entry = byName.get(name);
    expect(entry, `技能 ${name} 未注册`).toBeDefined();
    const refs = (entry?.template.references ?? []).map((ref) => ref.content).join('\n');
    return `${instructions(name)}\n${refs}`;
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

/** 取派生后的指令正文（command 版） */
function commandContent(id: string): string {
    const entry = commands.find((command) => command.id === id);
    expect(entry, `指令 ${id} 未注册`).toBeDefined();
    return entry?.template.content ?? '';
}

describe('A1 探索文件移动语义（成功删源 / 失败保留）', () => {
    it('迁移实现技能（spec_propose）声明删除源的移动语义', () => {
        for (const name of MOVE_SEMANTICS_SKILLS) {
            const body = instructions(name);
            expect(body, `${name} 未声明移动语义`).toMatch(/move semantics|移动/i);
            // 删源语义：移动成功后源文件不再存在（只保留变更目录内的一份）
            expect(body, `${name} 未声明「单份驻留」的删源结果`).toMatch(
                /DELETE|DELETED|NOT kept|no original copy|删除源文件|不留原件/i
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

    it('迁移链路保留「迁移失败保留源文件」语义', () => {
        for (const name of MIGRATING_SKILLS) {
            expect(instructions(name), `${name} 缺少失败保留源文件语义`).toMatch(
                /preserve the source file|保留源文件/i
            );
        }
    });
});

describe('A2 归档阶段不再读取 / 报告需求文档', () => {
    /** 两个归档技能各自已移除的预归档只读报告步骤标识 */
    const REMOVED_CHECKPOINTS: Record<string, RegExp> = {
        iagent_spec_archive: /4\.8 \*\*（已移除）\*\*/,
        iagent_spec_bulk_archive: /a\.6 \*\*（已移除）\*\*/,
    };

    it('预归档只读报告步骤标记为已移除，且不再产出存在性报告', () => {
        for (const [name, marker] of Object.entries(REMOVED_CHECKPOINTS)) {
            const body = instructions(name);
            expect(body, `${name} 缺少已移除标记`).toMatch(marker);
            expect(body, `${name} 未声明需求文档桥整体移除`).toContain('整体移除');
            // 旧报告步骤的存在性措辞与状态字段不应再作为步骤契约保留
            expect(body, `${name} 仍声明「已存在（未改写）」报告步骤`).not.toMatch(
                /4\.8 \*\*归档前需求文档只读报告|a\.6 \*\*需求文档只读报告/
            );
            expect(body, `${name} 仍以 requirementDocStatus 作为报告输入`).not.toContain(
                'requirementDocStatus'
            );
            // 写入分支已删除：无就地增量对齐 / 无生成技能委派
            expect(body, `${name} 残留就地增量对齐`).not.toMatch(/in-place|就地增量对齐更新/);
            expect(body, `${name} 残留需求文档委派`).not.toMatch(/委派 `iagent_requirement_doc` 技能/);
        }
    });

    it('历史需求文档随变更目录原样保留（不读取、不处理）', () => {
        for (const name of Object.keys(REMOVED_CHECKPOINTS)) {
            const body = instructions(name);
            expect(body, `${name} 未声明原样保留`).toMatch(/原样保留|随目录一起移动/);
            expect(body, `${name} 未声明不读取 / 不处理`).toMatch(/不读取|不再读取/);
        }
    });
});

describe('A3 三父流程验证后不再提供需求文档桥', () => {
    it('workflow / auto-workflow / debug 均声明桥已移除且不委派生成技能', () => {
        for (const name of PARENT_FLOWS) {
            const body = corpus(name);
            expect(body, `${name} 未声明需求文档桥已移除`).toMatch(
                /需求文档桥[^\n]*移除|无需求文档桥/
            );
            // 旧的“生成 / 跳过”桥标题与文档状态跨阶段传递不得保留为正向契约
            expect(body, `${name} 残留桥标题`).not.toContain('收束 —— 需求文档桥');
            expect(body, `${name} 残留文档状态跨阶段传递`).not.toContain('文档状态跨阶段传递');
            // 出现技能名时只能是“MUST NOT 委派”的否定语境
            expect(body, `${name} 正向委派需求文档技能`).not.toMatch(
                /委派 `iagent_requirement_doc` 技能/
            );
            expect(body, `${name} 未禁止委派需求文档技能`).toMatch(/MUST NOT 委派需求文档技能/);
        }
    });

    it('debug 保留旧禁令的移除口径，并提示手工调用独立技能', () => {
        const body = instructions('iagent_debug');
        for (const abolished of [
            '需求文档不在范围内（强制禁止）',
            '需求文档不属于本工作流',
            'Phase 7 MUST NOT 生成需求文档',
            'MUST NOT 调用 `iagent_requirement_doc`',
        ]) {
            expect(body, `debug 仍残留旧禁令「${abolished}」`).not.toContain(abolished);
        }
        expect(body).toContain('MUST NOT 展示需求文档桥');
        expect(body).toContain('MUST NOT 生成需求文档');
        // 手工调用保留：debug 不再自动委派，但提示用户按需单独调用
        expect(body).toContain('请按需单独调用 iagent-requirement-doc');
    });

    it('debug 不再有“文档已存在”生成分支', () => {
        const body = instructions('iagent_debug');
        expect(body).not.toContain('文档已存在');
        expect(body).not.toContain('禁用生成分支');
        expect(body).not.toContain('出口仅「跳过 / 手工编辑」');
        expect(body).not.toContain('归档只做存在性只读报告');
    });

    it('独立 verifier 不生成文档、不持有该桥', () => {
        const body = corpus('iagent_spec_verify_proposal');
        expect(body, '独立 verifier 不应提及需求文档技能').not.toContain('iagent_requirement_doc');
        expect(body, '独立 verifier 不应持有生成 / 跳过桥').not.toMatch(/生成\s*\/\s*跳过/);
    });
});

describe('A4 白名单委派面与正文一致（无需求文档委派）', () => {
    /** 本变更后全部不得持有需求文档委派条目的技能（三父流程 + spec / 归档侧） */
    const WITHOUT_REQUIREMENT_DOC = [
        'iagent_workflow',
        'iagent_auto_workflow',
        'iagent_debug',
        'iagent_spec_propose',
        'iagent_spec_verify_proposal',
        'iagent_spec_archive',
        'iagent_spec_bulk_archive',
    ];

    it('三父流程与 spec / 归档技能均不含 Skill(iagent-requirement-doc)', () => {
        for (const name of WITHOUT_REQUIREMENT_DOC) {
            expect(entries(name), `${name} 白名单残留需求文档委派条目`).not.toContain(
                'Skill(iagent-requirement-doc)'
            );
        }
    });

    it('三父流程正文只以否定语境提及需求文档技能（移除而非委派）', () => {
        for (const name of PARENT_FLOWS) {
            const body = corpus(name);
            expect(body, `${name} 缺少禁止委派声明`).toContain('MUST NOT 委派需求文档技能');
            expect(body, `${name} 残留正向委派语句`).not.toMatch(
                /委派 `iagent_requirement_doc` 技能/
            );
        }
    });

    it('全部技能的 Skill(...) 条目均在正文有对应提及（无死条目）', () => {
        const registeredNames = new Set(
            skills.map((s) => s.template.name.replace(/^iagent_/, 'iagent-').replaceAll('_', '-'))
        );
        for (const { template, commandId } of skills) {
            const delegated = entries(template.name)
                .filter((entry) => entry.startsWith('Skill('))
                .map((entry) => entry.slice('Skill('.length, -1));
            for (const name of delegated) {
                expect(registeredNames, `${commandId} 委派了未注册技能 ${name}`).toContain(name);
                const internalName = `iagent_${name.slice('iagent-'.length).replaceAll('-', '_')}`;
                expect(template.instructions, `${commandId} 正文未提及被委派技能 ${internalName}`).toContain(
                    internalName
                );
            }
        }
    });
});

describe('A5 DEPS 注入口径', () => {
    it('两个归档技能仅注入 spec-verify（不再注入需求文档技能）', () => {
        expect(resolveWorkflows(['spec-archive']).injected).toEqual(['spec-verify']);
        expect(resolveWorkflows(['spec-bulk-archive']).injected).toEqual(['spec-verify']);
    });

    it('调试技能仅注入提案评分技能（文档桥已移除，不再注入 requirement-doc）', () => {
        expect(resolveWorkflows(['debug']).injected).toEqual(['spec-verify-proposal']);
        expect(resolveWorkflows(['debug']).workflows).not.toContain('requirement-doc');
    });

    it('未配置时默认集无注入项（8 项）', () => {
        expect(resolveWorkflows().injected).toEqual([]);
        expect(resolveWorkflows().workflows.length).toBe(8);
    });
});

describe('A6 生成能力收敛到验证阶段 + 归档阶段对齐', () => {
    it('workflow 正文声明验证收束后直接进入实现桥（无需求文档桥）', () => {
        const body = corpus('iagent_workflow');
        expect(body, 'workflow 未声明需求文档桥已移除').toContain('需求文档桥已整体移除');
        expect(body, 'workflow 未禁止展示文档选项').toContain('MUST NOT 展示文档选项');
        expect(body, 'workflow 未禁止委派需求文档技能').toContain('MUST NOT 委派需求文档技能');
        // 被移除的桥约束不再作为契约保留
        expect(body, 'workflow 残留单次业务桥').not.toContain('单次业务桥');
        expect(body, 'workflow 残留文档状态跨阶段传递').not.toContain('文档状态跨阶段传递');
        expect(body, 'workflow 残留生成分支状态').not.toContain('skipped-by-user');
    });

    it('auto-workflow 的 Phase 5 直接委派归档且无需求文档报告', () => {
        const body = instructions('iagent_auto_workflow');
        expect(body).toContain('iagent_spec_archive');
        expect(body).not.toContain('需求文档存在性');
        expect(body).not.toContain('requirementDocStatus');
        // 已移除的写入分支不得残留
        expect(body).not.toContain('4.8');
        expect(body).not.toContain('迁移至 devdocs');
        expect(body).not.toContain('需求文档对齐 step');
    });

    it('只读报告标题已整体移除，两个归档技能的步骤标记为已移除', () => {
        const owners = skills
            .filter(({ template }) =>
                /4\.8 \*\*归档前需求文档只读报告|a\.6 \*\*需求文档只读报告/.test(
                    template.instructions
                )
            )
            .map((s) => s.template.name)
            .sort();
        // 锁定：任何技能不得再定义一份需求文档只读报告正文
        expect(owners).toEqual([]);
        expect(instructions('iagent_spec_archive')).toMatch(/4\.8 \*\*（已移除）\*\*/);
        expect(instructions('iagent_spec_bulk_archive')).toMatch(/a\.6 \*\*（已移除）\*\*/);
    });

    it('人工域章节只由需求文档模板本体定义（debug 不再承载桥护栏）', () => {
        const mentions = skills
            .filter(({ template }) => template.instructions.includes('## 八、评审记录'))
            .map((s) => s.template.name)
            .sort();
        expect(mentions).toEqual(['iagent_requirement_doc']);
        const debugBody = instructions('iagent_debug');
        expect(debugBody).not.toContain('人工撰写字段受保护');
        expect(debugBody).toContain('MUST NOT 展示需求文档桥');
    });
});

describe('A7 workflow 提案 / 修订重验 / 实现桥出口（N4–N17）', () => {
    const body = corpus('iagent_workflow');

    it('N4 委派 spec-propose 生成制品且不内联生成', () => {
        expect(body).toContain('委派阶段 `iagent_spec_propose`');
        expect(body).toContain('MUST NOT 内联生成提案制品');
    });

    it('N5 FAIL → N6 自动修复并重跑验证，重跑仍失败不进入实现', () => {
        expect(body).toContain('验证失败 → 同上下文自动修复并重跑');
        expect(body).toContain('只重跑受影响清单项');
        expect(body).toMatch(/重跑仍失败/);
        expect(body).toContain('无跳过直接 apply 的路径');
    });

    it('N12 实现 + 测试桥三出口：无文档选项，修改 / 拒绝不得调用 apply', () => {
        expect(body).toContain('实现 + 测试桥');
        expect(body).toContain('交付桥');
        // 需求文档选项已移除：只保留确认 / 修改 / 拒绝三出口
        expect(body).toContain('三出口');
        expect(body).toContain('① 确认 → 进入 Phase 4');
        expect(body).toContain('② 修改 → 回 Phase 2');
        expect(body).toContain('③ 拒绝 → 记录未确认状态并停止');
        expect(body).toContain('MUST NOT 提供文档生成选项');
        expect(body).not.toContain('仅生成文档');
        expect(body).not.toContain('出口：确认（进入 Phase 4，含条件测试生成）');
        // 实现桥确认后 apply 以 gate-skip 直通（不追加“是否调用技能”确认）
        expect(body).toContain('auto-mode=true');
        expect(body).toContain('跳过 apply 内部的设计确认门');
    });

    it('N15 实现验证失败回到修复，MUST NOT 进入归档', () => {
        expect(body, 'workflow 未声明实现验证阶段').toContain(
            '调用 `iagent_spec_verify` 技能验证实现与制品'
        );
        expect(body).toContain('失败 → 回 Phase 4 修复，MUST NOT 进入归档');
    });

    it('N16 归档桥拒绝时回实现、N17 不再传递需求文档状态', () => {
        expect(body).toContain('归档确认门');
        expect(body).toContain('拒绝（返回 Phase 4 继续实现，不归档）');
        expect(body).not.toContain('requirementDocStatus');
        expect(body).toContain('MUST NOT 传已移除的需求文档状态字段');
    });

    it('命令派生版保留实现桥三出口且无文档状态（防护语句永不裁剪）', () => {
        const derived = commandContent('workflow');
        expect(derived).toContain('三出口');
        expect(derived).toContain('拒绝 → 记录未确认状态并停止，不进入实现');
        expect(derived).toContain('MUST NOT 提供文档生成选项');
        expect(derived).not.toContain('requirementDocStatus');
        expect(derived).not.toContain('FAIL 不出文档桥');
    });
});

describe('A8 auto-workflow 文档桥与自动阶段（N18–N20）', () => {
    const entry = byName.get('iagent_auto_workflow');
    const body = instructions('iagent_auto_workflow');

    it('description 与阶段说明披露无文档桥，不再声称该阶段需要确认', () => {
        const description = entry?.template.description ?? '';
        expect(description).toContain('无需求文档桥');
        expect(description, '自述仍残留“无需任何用户确认”口径').not.toMatch(
            /无需任何用户确认|全自动无停顿/
        );
        expect(body).toContain('需求文档桥已移除，本阶段无用户确认门');
        expect(body).not.toContain('该桥是本阶段唯一的流程级阻塞门');
        expect(body).not.toContain('本阶段唯一的用户业务选择');
    });

    it('验证通过后同回合直接进入 Phase 4，不追加调用确认', () => {
        expect(body).toContain('在同一用户回合内继续（自动实现），不追加对该阶段技能的调用确认');
        expect(body).toContain('自动转入 Phase 4');
        expect(body).not.toContain('不再出现对该阶段技能的调用确认询问');
    });

    it('N19 测试执行门与实现验证不可跳过，失败按既有预算处理', () => {
        expect(body).toContain('测试执行门');
        expect(body).toContain('范围内测试失败');
        expect(body).toContain('至多 3 次');
        expect(body).toContain('实现验证桥');
        expect(body).toContain('iagent_spec_verify');
    });

    it('N20 自动归档不携带文档状态且失败不伪报完成', () => {
        expect(body).not.toContain('requirementDocStatus');
        expect(body).toContain('iagent_spec_archive');
        expect(body).toMatch(/自动归档错误处理|测试门失败时不得静默通过/);
    });
});

describe('A9 spec-propose 独立调用不生成需求文档', () => {
    const body = corpus('iagent_spec_propose');

    it('正文在验证 PASS 后停止且禁止生成 / 不提供桥', () => {
        expect(body).toContain('独立调用在验证 PASS 后停止');
        expect(body).toContain('MUST NOT 生成需求文档');
        expect(body).toContain('MUST NOT 呈现生成 / 跳过桥');
        // 桥标题式段落不得出现在 propose（散文引用禁令不算桥）
        expect(body).not.toMatch(/收束 —— 需求文档桥/);
    });

    it('白名单与派生指令均无 Skill(iagent-requirement-doc)', () => {
        expect(entries('iagent_spec_propose')).not.toContain('Skill(iagent-requirement-doc)');
        const derived = commandContent('spec-propose');
        expect(derived).toContain('独立调用在验证 PASS 后停止');
        expect(derived).not.toMatch(/生成\s*\/\s*跳过桥（⚠️/);
    });
});

describe('A10 归档不再读取 / 报告需求文档（单变更与批量同义）', () => {
    const ARCHIVE_SKILLS = ['iagent_spec_archive', 'iagent_spec_bulk_archive'];

    it('两技能一致：不读取 / 不报告 / 不生成 / 不对齐 / 不迁出', () => {
        for (const name of ARCHIVE_SKILLS) {
            const body = instructions(name);
            expect(body, `${name} 未声明需求文档桥与只读报告已移除`).toMatch(
                /需求文档桥与只读报告已/
            );
            expect(body, `${name} 仍读取或报告需求文档状态`).not.toContain('requirementDocStatus');
            expect(body, `${name} 未禁止生成 / 读取 / 迁出`).toMatch(
                /不读取|MUST NOT 读取/
            );
            expect(body, `${name} 未声明原样保留`).toMatch(/原样保留|原样移动/);
            expect(entries(name), `${name} 白名单残留需求文档委派条目`).not.toContain(
                'Skill(iagent-requirement-doc)'
            );
        }
    });

    it('写入 / 报告分支已删除：无就地增量对齐 / 无历史兼容生成 / 无 devdocs 迁移动作', () => {
        for (const name of ARCHIVE_SKILLS) {
            const body = instructions(name);
            expect(body, `${name} 残留就地增量对齐`).not.toMatch(/in-place|就地增量对齐更新/);
            expect(body, `${name} 残留历史兼容生成分支`).not.toContain('历史兼容');
            expect(body, `${name} 残留 devdocs 迁移动作`).not.toMatch(
                /移动到 `openspec\/devdocs\/|复制到 `openspec\/devdocs\/YYYY/
            );
        }
    });

    it('不再读取因此无需求文档读取失败分支（旧失败处理契约已移除）', () => {
        expect(instructions('iagent_spec_archive')).not.toContain('该报告失败 MUST NOT 阻断归档');
        for (const name of ARCHIVE_SKILLS) {
            // 其他归档步骤的失败处理仍可保留，但不得再有“需求文档读取失败”语义
            expect(instructions(name), `${name} 残留需求文档读取失败处理`).not.toMatch(
                /需求文档[^\n]*(失败|中止|阻断)/
            );
        }
    });
});
