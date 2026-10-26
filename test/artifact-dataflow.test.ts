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
 *      handoff；归档按“文件存在优先 + 状态裁决缺失分支”分流。
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

/** 取正文中同时含全部关键词的行（用于「同句」语义判定） */
function linesContaining(body: string, keywords: readonly string[]): string[] {
    return body
        .split('\n')
        .filter((line) => keywords.every((keyword) => line.includes(keyword)));
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

describe('A2 归档阶段需求文档检查点（状态感知）', () => {
    /** 两个归档技能各自的预归档检查点步骤标识 */
    const CHECKPOINTS: Record<string, RegExp> = {
        iagent_spec_archive: /4\.8 \*\*归档前需求文档检查点/,
        iagent_spec_bulk_archive: /a\.6 \*\*归档前需求文档检查点/,
    };

    it('预归档检查点步骤存在且含状态感知分流断句', () => {
        for (const [name, marker] of Object.entries(CHECKPOINTS)) {
            const body = instructions(name);
            expect(body, `${name} 缺少预归档需求文档检查点步骤`).toMatch(marker);
            // 历史兼容分支（absent 且缺失）仍委派需求文档技能生成
            expect(body, `${name} 缺少 absent 兼容委派分支`).toContain('iagent_requirement_doc');
            // 已存在分支：就地增量对齐并保人工域
            expect(body, `${name} 缺少就地增量对齐分支`).toMatch(/in-place/i);
            // 人工域两个章节：基本信息 / 评审记录
            expect(body, `${name} 缺少人工域「基本信息」断句`).toContain('## 基本信息');
            expect(body, `${name} 缺少人工域「评审记录」断句`).toContain('## 八、评审记录');
        }
    });

    it('两个归档技能均声明四值状态与持久字段（跨会话依据）', () => {
        for (const name of Object.keys(CHECKPOINTS)) {
            const body = instructions(name);
            for (const status of ['absent', 'skipped-by-user', 'generation-failed', 'generated']) {
                expect(body, `${name} 缺少状态取值 ${status}`).toContain(`\`${status}\``);
            }
            expect(body, `${name} 未声明持久字段 requirementDocStatus`).toContain(
                'requirementDocStatus'
            );
            expect(body, `${name} 未声明状态载体段`).toContain('## 需求文档状态');
        }
    });
});

describe('A3 三父流程验证后文档桥（原 debug 禁令已反转为桥）', () => {
    it('workflow / auto-workflow / debug 均在验证收束后提供生成 / 跳过桥', () => {
        for (const name of PARENT_FLOWS) {
            const body = corpus(name);
            expect(body, `${name} 缺少需求文档桥`).toContain('需求文档桥');
            expect(body, `${name} 桥未提供生成 / 跳过出口`).toMatch(/生成\s*\/\s*跳过/);
            expect(body, `${name} 缺少需求文档技能委派`).toContain('iagent_requirement_doc');
        }
    });

    it('debug 不再残留「需求文档不在范围内」禁令，改由用户桥约束', () => {
        // 旧语义断言（禁令存在）反转为：旧禁令短语必须消失，且由桥的正向约束取代
        const body = instructions('iagent_debug');
        for (const abolished of [
            '需求文档不在范围内（强制禁止）',
            '需求文档不属于本工作流',
            'Phase 7 MUST NOT 生成需求文档',
            'MUST NOT 调用 `iagent_requirement_doc`',
        ]) {
            expect(body, `debug 仍残留旧禁令「${abolished}」`).not.toContain(abolished);
        }
        const bridge = linesContaining(body, ['需求文档桥']);
        expect(bridge.length, 'debug 缺少需求文档桥段').toBeGreaterThan(0);
        // 正向约束：禁止的是「未经用户确认自动生成」，不是委派本身
        expect(body).toContain('MUST NOT 未经用户确认自动生成');
    });

    it('独立 verifier 不生成文档、不持有该桥', () => {
        const body = corpus('iagent_spec_verify_proposal');
        expect(body, '独立 verifier 不应提及需求文档技能').not.toContain('iagent_requirement_doc');
        expect(body, '独立 verifier 不应持有生成 / 跳过桥').not.toMatch(/生成\s*\/\s*跳过/);
    });
});

describe('A4 白名单委派面与正文一致', () => {
    /** 验证阶段 + 归档侧 + debug 文档桥：委派需求文档技能 */
    const WITH_REQUIREMENT_DOC = [
        'iagent_spec_archive',
        'iagent_spec_bulk_archive',
        'iagent_auto_workflow',
        'iagent_workflow',
        'iagent_debug',
    ];

    /** 独立调用不生成 / 不委派该技能 */
    const WITHOUT_REQUIREMENT_DOC = ['iagent_spec_propose', 'iagent_spec_verify_proposal'];

    it('验证阶段、归档侧与 debug 桥含 Skill(requirement_doc) 且正文确提及', () => {
        for (const name of WITH_REQUIREMENT_DOC) {
            // 白名单条目取自 skillDelegation() 的本地技能名（裸名，不含 iagent_ 前缀）
            expect(entries(name), `${name} 白名单缺少需求文档委派条目`).toContain(
                'Skill(requirement_doc)'
            );
            // 授权委派的前提是正文确有委派动作，避免幽灵授权
            expect(instructions(name), `${name} 正文未提及被委派技能`).toContain(
                'iagent_requirement_doc'
            );
        }
    });

    it('spec-propose 与独立 verifier 不含该委派条目', () => {
        for (const name of WITHOUT_REQUIREMENT_DOC) {
            expect(entries(name), `${name} 白名单残留需求文档委派条目`).not.toContain(
                'Skill(requirement_doc)'
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
                expect(registeredNames, `${commandId} 委派了未注册技能 iagent_${name}`).toContain(
                    `iagent_${name}`
                );
                expect(template.instructions, `${commandId} 正文未提及被委派技能 iagent_${name}`).toContain(
                    `iagent_${name}`
                );
            }
        }
    });
});

describe('A5 DEPS 注入口径', () => {
    it('两个归档技能均注入 spec-verify 与需求文档技能', () => {
        expect(resolveWorkflows(['spec-archive']).injected).toEqual(['spec-verify', 'requirement-doc']);
        expect(resolveWorkflows(['spec-bulk-archive']).injected).toEqual([
            'spec-verify',
            'requirement-doc',
        ]);
    });

    it('调试技能注入提案评分与需求文档技能（文档桥生成分支无条件委派）', () => {
        expect(resolveWorkflows(['debug']).injected).toEqual([
            'spec-verify-proposal',
            'requirement-doc',
        ]);
        expect(resolveWorkflows(['debug']).workflows).toContain('requirement-doc');
    });

    it('未配置时仅注入需求文档技能', () => {
        expect(resolveWorkflows().injected).toEqual(['requirement-doc']);
    });
});

describe('A6 生成能力收敛到验证阶段 + 归档阶段对齐', () => {
    it('workflow 正文声明验证收束阶段经桥生成需求文档（含下沉细则）', () => {
        const body = corpus('iagent_workflow');
        expect(body, 'workflow 未声明验证阶段需求文档桥').toContain('iagent_requirement_doc');
        // 桥细则位于 references/verification-protocol.md（Phase 3 细则下沉）
        const protocol = corpus('iagent_workflow');
        expect(protocol, 'workflow 未声明桥的单次业务约束').toContain('单次业务桥');
        expect(protocol, 'workflow 未声明生成分支状态').toContain('generated');
        expect(protocol, 'workflow 未声明跳过分支状态').toContain('skipped-by-user');
    });

    it('auto-workflow 的 Phase 5 归档步骤枚举含需求文档对齐引用', () => {
        const body = instructions('iagent_auto_workflow');
        expect(body).toContain('需求文档对齐');
        expect(body).toContain('iagent_spec_archive');
        expect(body).toContain('4.8');
    });

    it('状态感知检查点正文唯一：预归档检查点标题只在两个归档技能中定义', () => {
        const owners = skills
            .filter(({ template }) =>
                /4\.8 \*\*归档前需求文档检查点|a\.6 \*\*归档前需求文档检查点/.test(
                    template.instructions
                )
            )
            .map((s) => s.template.name)
            .sort();
        // 锁定：除两个归档技能外，任何技能不得再定义一份分流正文
        expect(owners).toEqual(['iagent_spec_archive', 'iagent_spec_bulk_archive']);
    });

    it('人工域章节提及面受控：非归档侧仅存在于需求文档模板本体与引用/护栏语境', () => {
        const mentions = skills
            .filter(({ template }) => template.instructions.includes('## 八、评审记录'))
            .map((s) => s.template.name)
            .sort();
        // 两个归档技能 = 分流正文持有者；需求文档技能 = 章节骨架持有者；
        // auto-workflow = 归档步骤枚举引用；debug = 人工域保护护栏
        expect(mentions).toEqual([
            'iagent_auto_workflow',
            'iagent_debug',
            'iagent_requirement_doc',
            'iagent_spec_archive',
            'iagent_spec_bulk_archive',
        ]);
        // 引用语境自证：auto-workflow 明示「不复制分支正文、只引用 step 4.8」
        expect(instructions('iagent_auto_workflow')).toContain('MUST NOT 复制该分支规则正文');
        // 护栏语境自证：debug 保护人工撰写字段且桥由用户确认
        const debugBody = instructions('iagent_debug');
        expect(debugBody).toContain('人工撰写字段受保护');
        expect(debugBody).toContain('iagent_requirement_doc');
    });
});

describe('A7 workflow 提案 / 修订重验 / 实现桥出口（N4–N17）', () => {
    const body = corpus('iagent_workflow');

    it('N4 委派 spec-propose 生成制品且不内联生成', () => {
        expect(body).toContain('委派阶段 `iagent_spec_propose`');
        expect(body).toContain('MUST NOT 内联生成提案制品');
    });

    it('N5 FAIL → N6 自动修复并重跑验证，重跑仍失败不进入实现', () => {
        expect(body).toContain('验证失败 → 自动修复并重跑');
        expect(body).toContain('自动重跑验证');
        expect(body).toMatch(/重跑仍失败/);
        expect(body).toContain('无跳过直接 apply 的路径');
    });

    it('N12 实现 + 测试桥三出口：修改 / 拒绝不得调用 apply', () => {
        expect(body).toContain('实现 + 测试桥');
        expect(body).toContain('出口：确认（进入 Phase 4，含条件测试生成）');
        expect(body).toContain('拒绝（记录未确认状态并停止，不进入实现）');
        // 实现桥确认后 apply 以 auto-mode 直通（不追加“是否调用技能”确认）
        expect(body).toContain('auto-mode=true');
        expect(body).toContain('跳过 apply 内部的设计确认门');
    });

    it('N15 实现验证失败回到修复，MUST NOT 进入归档', () => {
        expect(body, 'workflow 未声明实现验证阶段').toContain('MUST 委派 `iagent_spec_verify` 技能验证实现与制品');
        expect(body).toContain('失败 → 回 Phase 4 修复，MUST NOT 进入归档');
    });

    it('N16 归档桥拒绝时回实现、N17 归档携带文档状态', () => {
        expect(body).toContain('归档确认门');
        expect(body).toContain('拒绝（返回 Phase 4 继续实现，不归档）');
        expect(body).toContain('requirementDocStatus');
        expect(body).toContain('archive 亦从变更 `exploration.md` 读取同一状态，跨会话可恢复');
    });

    it('命令派生版保留实现桥出口与文档状态传递（防护语句永不裁剪）', () => {
        const derived = commandContent('workflow');
        expect(derived).toContain('拒绝（记录未确认状态并停止，不进入实现）');
        expect(derived).toContain('requirementDocStatus');
        expect(derived).toContain('FAIL 不出文档桥');
    });
});

describe('A8 auto-workflow 文档桥与自动阶段（N18–N20）', () => {
    const entry = byName.get('iagent_auto_workflow');
    const body = instructions('iagent_auto_workflow');

    it('description 与阶段说明披露唯一文档桥，不再声称该阶段无需确认', () => {
        const description = entry?.template.description ?? '';
        expect(description).toContain('需求文档桥');
        expect(description).toMatch(/除验证阶段的需求文档桥外全自动/);
        expect(description, '自述仍残留“无需任何用户确认”口径').not.toMatch(
            /无需任何用户确认|全自动无停顿/
        );
        expect(body).toContain('该桥是本阶段唯一的流程级阻塞门');
        expect(body).toContain('本阶段唯一的用户业务选择');
    });

    it('桥后直接进入 Phase 4，不追加调用确认', () => {
        expect(body).toContain('不再出现对该阶段技能的调用确认询问');
        expect(body).toContain('Phase 4 无其他用户确认');
    });

    it('N19 测试执行门与实现验证不可跳过，失败按既有预算处理', () => {
        expect(body).toContain('测试执行门');
        expect(body).toContain('范围内测试失败');
        expect(body).toContain('至多 3 次');
        expect(body).toContain('实现验证桥');
        expect(body).toContain('iagent_spec_verify');
    });

    it('N20 自动归档携带文档状态且失败不伪报完成', () => {
        expect(body).toContain('requirementDocStatus');
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

    it('白名单与派生指令均无 Skill(requirement_doc)', () => {
        expect(entries('iagent_spec_propose')).not.toContain('Skill(requirement_doc)');
        const derived = commandContent('spec-propose');
        expect(derived).toContain('独立调用在验证 PASS 后停止');
        expect(derived).not.toMatch(/生成\s*\/\s*跳过桥（⚠️/);
    });
});

describe('A10 归档需求文档状态分流矩阵（单变更与批量同义）', () => {
    const ARCHIVE_SKILLS = ['iagent_spec_archive', 'iagent_spec_bulk_archive'];

    it('文件存在优先：任何状态都走就地对齐且不调用生成器', () => {
        for (const name of ARCHIVE_SKILLS) {
            const body = instructions(name);
            expect(body, `${name} 未声明文件存在优先`).toMatch(/文件(存在|已存在)/);
            expect(body, `${name} 已存在分支仍调用生成技能`).toMatch(
                /本分支\*\*不得调用 `iagent_requirement_doc`/
            );
        }
    });

    it('缺失四支互斥：skip / generation-failed / generated / absent', () => {
        const body = instructions('iagent_spec_archive');
        // B 支：skip 不生成
        expect(body).toMatch(/`skipped-by-user`\*\*：报告"用户已选择跳过需求文档生成"/);
        expect(body).toMatch(/MUST NOT 调用 `iagent_requirement_doc`、MUST NOT 生成/);
        // C 支：generation-failed 仅 WARN
        expect(body).toMatch(/`generation-failed`\*\*：输出含原因的 WARN/);
        expect(body).toContain('MUST NOT 静默重试生成');
        // D 支：generated 缺失不重建
        expect(body).toMatch(/`generated`\*\*：输出 WARN（"曾生成但文件缺失"）/);
        expect(body).toContain('MUST NOT 重新生成');
        // E 支：absent 才走历史兼容生成
        expect(body).toMatch(
            /`absent`（历史兼容）\*\*：以\*\*非交互模式\*\*委派 `iagent_requirement_doc`/
        );
    });

    it('读取 I/O 失败重试一次，不视为 absent、不生成、不阻断归档', () => {
        for (const name of ARCHIVE_SKILLS) {
            const body = instructions(name);
            expect(body, `${name} 未声明重试一次`).toMatch(/重试同一读取\*\*一次\*\*/);
            expect(body, `${name} 未禁止把读取失败当作 absent`).toMatch(
                /MUST NOT (把状态视为 `absent`|视为 `absent`)/
            );
            expect(body, `${name} 未声明读取失败不阻断归档`).toMatch(
                /读取失败 MUST NOT (阻断归档|中止该变更单元或整批)/
            );
        }
    });

    it('单变更与批量归档同义（同一状态模型与人工域保护）', () => {
        const shared = [
            'skipped-by-user',
            'generation-failed',
            'generated',
            'absent',
            '## 基本信息',
            '## 八、评审记录',
            'in-place',
            '重试同一读取**一次**',
        ];
        for (const name of ARCHIVE_SKILLS) {
            for (const token of shared) {
                expect(instructions(name), `${name} 缺少同义约定 ${token}`).toContain(token);
            }
        }
    });

    it('归档失败非阻断：需求文档处理失败仅 WARN 并继续', () => {
        expect(instructions('iagent_spec_archive')).toContain(
            '绝不因本检查点阻塞归档'
        );
        expect(instructions('iagent_spec_bulk_archive')).toMatch(
            /MUST NOT 中止(该变更单元或整批|批次)/
        );
    });
});
