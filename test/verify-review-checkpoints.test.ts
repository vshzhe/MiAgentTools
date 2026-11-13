/**
 * 检查点单测（变更 improve-verify-review）。
 *
 * 锁定三个审查类技能模板的检查点扩展与配套制品留痕（内容断言，模板工厂为纯函数无需 mock）：
 *   1. spec-verify-proposal：D3「待实现功能覆盖」检查点 + N3/N5「影响范围一致性」检查（任务 1.4 / 1.5）
 *   2. 检查能力点评估结论留痕：design.md 评估记录与 tasks 评估执行任务（任务 1.6）
 *
 * 后续批次向本文件追加：spec-verify 影响面对比 / 双语义（2.3-2.5）、review 变更关联 /
 * 一致性（3.3 / 3.4）、改动边界守护（4.3）。
 *
 * 制品文件断言经「归档安全路径解析」：变更归档后目录迁移至
 * openspec/changes/archive/<日期>-<name>/，断言不得因归档失效。
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getSpecVerifyProposalSkillTemplate } from '../src/core/templates/workflows/spec-verify-proposal.js';
import { getSpecVerifyChangeSkillTemplate } from '../src/core/templates/workflows/spec-verify.js';
import { getReviewSkillTemplate } from '../src/core/templates/workflows/review.js';

const CHANGE_NAME = 'improve-verify-review';

/**
 * 归档安全解析：优先活跃变更目录，回退 openspec/changes/archive/<日期>-<name>/。
 * 均未命中时返回活跃路径，让存在性断言的报错指向清晰位置。
 */
function resolveChangeArtifact(fileName: string): string {
    const root = process.cwd();
    const active = path.join(root, 'openspec', 'changes', CHANGE_NAME, fileName);
    if (fs.existsSync(active)) {
        return active;
    }
    const archiveRoot = path.join(root, 'openspec', 'changes', 'archive');
    if (fs.existsSync(archiveRoot)) {
        for (const entry of fs.readdirSync(archiveRoot, { withFileTypes: true })) {
            if (entry.isDirectory() && entry.name.endsWith(`-${CHANGE_NAME}`)) {
                const candidate = path.join(archiveRoot, entry.name, fileName);
                if (fs.existsSync(candidate)) {
                    return candidate;
                }
            }
        }
    }
    return active;
}

/** 断言制品存在后读取（缺失时报错指向解析路径而非裸 ENOENT）。 */
function readChangeArtifact(fileName: string): string {
    const resolved = resolveChangeArtifact(fileName);
    expect(fs.existsSync(resolved), `制品缺失：${resolved}`).toBe(true);
    return fs.readFileSync(resolved, 'utf8');
}

describe('spec-verify-proposal：待实现功能覆盖检查点（并入 D3，不新增维度编号）', () => {
    const template = getSpecVerifyProposalSkillTemplate();
    const instructions = template.instructions;

    it('声明项逐级有承接：链路核查步骤与链路完整标注口径存在', () => {
        // 检查点标题明确「并入」语义
        expect(instructions).toContain('**待实现功能覆盖检查点（并入本维度，不新增维度编号）**');
        // 逐级链路：What Changes 声明项 → specs Requirement → tasks 承接任务
        expect(instructions).toContain('对 `proposal.md` What Changes 的每个声明项执行**链路核查**');
        expect(instructions).toContain(
            'What Changes 变更项 → `specs/**/*.md` 对应 Requirement → `tasks.md` 承接任务'
        );
        // 链路完整标注口径（链路完整 → 计入 D3 已覆盖）
        expect(instructions).toContain(
            '报告标注「待实现功能覆盖：链路完整（What Changes → <capability>/<Requirement> → <task id>）」'
        );
        expect(instructions).toContain('该声明项计入 D3 已覆盖');
    });

    it('声明项无任务承接：缺口逐条可定位且注明断链层级', () => {
        // 断链两种形态（specs 缺 Requirement / tasks 无承接任务）均可定位
        expect(instructions).toContain('**缺口可定位**：声明项断链（specs 缺 Requirement，或 tasks 无承接任务）');
        // 断链层级定位口径
        expect(instructions).toContain('指明断在 specs 级还是 tasks 级');
        // 逐条输出而非笼统百分比
        expect(instructions).toContain('逐条列出缺口链路');
        expect(instructions).toContain('MUST NOT 仅给出百分比');
    });

    it('检查点位于 Dimension 3 内部且维度编号集合不变', () => {
        // 归属锚点：检查点插在 Dimension 3 与 Dimension 4 之间
        const d3 = instructions.indexOf('### Dimension 3: 任务完整性');
        const d4 = instructions.indexOf('### Dimension 4: 边界覆盖');
        const checkpoint = instructions.indexOf('待实现功能覆盖检查点');
        expect(d3).toBeGreaterThan(-1);
        expect(d4).toBeGreaterThan(d3);
        expect(checkpoint).toBeGreaterThan(d3);
        expect(checkpoint).toBeLessThan(d4);
        // 「并入而非并列」的护栏语句
        expect(instructions).toContain('检查点为 D3 内部的增量核查步骤（报告仍按 D3 口径输出覆盖率）');
        expect(instructions).toContain('MUST NOT 触碰总分公式与维度编号');
        // 不新增维度编号：主正文维度标题仍为 D1-D5 集合不变，且无检查点伪装成维度
        // （D6-D10 为条件维度，下沉在 conditional-dimensions 细则文件中，见下方断言）
        const dimensionHeads = instructions.match(/^### Dimension .+$/gm) ?? [];
        expect(dimensionHeads).toEqual([
            '### Dimension 1: 需求覆盖',
            '### Dimension 2: 技术一致性',
            '### Dimension 3: 任务完整性',
            '### Dimension 4: 边界覆盖',
            '### Dimension 5: 待办消解',
        ]);
        for (const head of dimensionHeads) {
            expect(head).not.toContain('待实现功能覆盖');
            expect(head).not.toContain('影响范围');
        }
        // 条件维度细则文件同样不新增编号（D6-D10 共 5 个标题）
        const condRef = template.references?.find((r) => r.path === 'references/conditional-dimensions.md');
        expect(condRef, 'references 数组缺少 conditional-dimensions.md 条目').toBeDefined();
        expect((condRef?.content.match(/^### Dimension .+$/gm) ?? []).length).toBe(5);
    });
});

describe('spec-verify-proposal：影响范围一致性检查（N3 存在性 / N5 对齐）', () => {
    const instructions = getSpecVerifyProposalSkillTemplate().instructions;

    it('三制品存在且对齐：N3 锚点矩阵 + N5 三条对齐核查 + 细则读取引导', () => {
        // N3 存在性判定（三制品小节锚点）
        expect(instructions).toContain('## 影响面制品存在性判定（条件检查点，流程节点 N3）');
        expect(instructions).toContain('`proposal.md` 影响面 | `## Impact` 下的影响面分析小节');
        expect(instructions).toContain('`design.md` 影响面 | `## Context` 下的架构影响小节');
        expect(instructions).toContain('`tasks.md` 影响面 | `### Caller Updates` 小节');
        // N5 对齐核查三条
        expect(instructions).toContain('## 影响范围一致性检查（条件检查点，并入 D2/D3，流程节点 N5）');
        expect(instructions).toContain('**proposal Impact ↔ design 架构影响**');
        expect(instructions).toContain('**proposal Impact ↔ tasks 承接**');
        expect(instructions).toContain('**design 架构影响 ↔ specs 范围**');
        // 全部对齐的处置口径
        expect(instructions).toContain('全部对齐 → 影响范围一致性 **PASS**，D2/D3 评分计入该结论');
        // 细则下沉后的读取引导（SKILL 正文保留）
        expect(instructions).toContain(
            '细则见 `references/impact-consistency.md`，评分前 MUST 先 `Read` 该文件'
        );
    });

    it('有制品但与 tasks 脱节：计入 FAIL 且逐条列出偏差模块与断裂点', () => {
        expect(instructions).toContain('任一不一致（脱节）→ 计入评分 **FAIL**，逐条列出偏差模块');
        // 断裂点三形态可定位
        expect(instructions).toContain('模块名 + 断裂点：tasks 缺承接 / design 矛盾 / specs 越界');
        expect(instructions).toContain('MUST NOT 仅给出百分比');
        // 语义等价不误伤（措辞不同但指向同一目标 MAY 计为对齐）
        expect(instructions).toContain('MUST NOT 笼统放行');
    });

    it('无影响面制品：SKIP 排除分母，不按 0 分拉低、不判 FAIL', () => {
        // 触发范围：含独立 spec-propose 路径未产影响面小节
        expect(instructions).toContain('**任一缺失**（影响分析未触发，含独立 spec-propose 路径未产影响面小节）');
        // SKIP 处置：排除分母（不计入 triggered_count）
        expect(instructions).toContain('标 **SKIP** 并从总分分母排除（不计入 triggered_count）');
        expect(instructions).toContain('MUST NOT 按 0 分拉低总分');
        // 与 D10 缺失处理先例同构
        expect(instructions).toContain('MUST NOT 据此判 FAIL（对齐 D10 缺失处理先例）');
    });

    it('存量 JSON-only 降级：SKIP + WARN 且不阻断评分', () => {
        expect(instructions).toContain('**存量 JSON-only 降级**（Markdown 缺失且仅有历史 JSON）→ **SKIP + WARN**');
        expect(instructions).toContain('MUST NOT 阻断评分，验证报告注明该处置');
    });

    it('references/impact-consistency.md 细则条目存在且含判定矩阵三节', () => {
        const template = getSpecVerifyProposalSkillTemplate();
        const ref = template.references?.find((r) => r.path === 'references/impact-consistency.md');
        expect(ref, 'references 数组缺少 references/impact-consistency.md 条目').toBeDefined();
        // 细则三节：存在性判定矩阵 / 对齐核查规则 / 评分并入与处置
        expect(ref?.content).toContain('## 1. 存在性判定矩阵（N3）');
        expect(ref?.content).toContain('## 2. 对齐核查规则（N5）');
        expect(ref?.content).toContain('## 3. 评分并入与处置（D2/D3）');
        // 处置口径与主文件一致（SKIP 排除分母 / SKIP + WARN / 语义等价）
        expect(ref?.content).toContain('从总分分母排除（不计入 triggered_count）');
        expect(ref?.content).toContain('MUST NOT 按 0 分拉低总分');
        expect(ref?.content).toContain('SKIP + WARN');
        expect(ref?.content).toContain('MUST NOT 笼统放行');
        // 主文件优先级声明（细则与主 SKILL 的冲突消解）
        expect(ref?.content).toContain('主 SKILL 正文是唯一执行顺序');
    });
});

describe('检查能力点评估结论留痕（design.md 评估记录）', () => {
    /** 评估记录表：评估对象 → 结论（「不改」行须留痕，「调整」行须有对应实现任务）。 */
    const EVAL_ROWS: Array<[string, string]> = [
        ['总分公式', '不改'],
        ['90% 统一阈值', '不改'],
        ['D9 自证职责', '不改'],
        ['spec-verify.ts:36-45 执行方式表述', '调整'],
        ['review 五维度', '不改'],
        ['review allowedTools', '不改'],
        ['维度名枚举消费点', '不改'],
        ['CLI 校验代码', '不改'],
    ];

    /** 截取评估记录节内的表格行（该节为 design.md 最后一节）。 */
    function evalRecordLines(): string[] {
        const design = readChangeArtifact('design.md');
        const start = design.indexOf('## 评估记录');
        expect(start, 'design.md 缺少「## 评估记录」节').toBeGreaterThan(-1);
        const rest = design.slice(start);
        const next = rest.indexOf('\n## ', 1);
        const body = next === -1 ? rest : rest.slice(0, next);
        return body.split('\n').filter((line) => line.startsWith('|'));
    }

    it('评估记录段存在且八行结论逐条留痕（不改 / 调整）', () => {
        const lines = evalRecordLines();
        expect(lines.length).toBeGreaterThanOrEqual(EVAL_ROWS.length);
        for (const [label, conclusion] of EVAL_ROWS) {
            const line = lines.find((l) => l.includes(label));
            expect(line, `评估记录缺少评估对象行：${label}`).toBeDefined();
            expect(line ?? '').toContain(conclusion);
        }
    });

    it('结论为「调整」的行与实际改动对应（spec-verify 执行方式显式化任务）', () => {
        const lines = evalRecordLines();
        const adjusted = lines.filter((l) => l.includes('| 调整'));
        // 本次唯一「调整」对象：spec-verify 执行方式表述（对应任务 2.2）
        expect(adjusted).toHaveLength(1);
        expect(adjusted[0]).toContain('spec-verify.ts:36-45 执行方式表述');
    });

    it('tasks 存在对应评估执行任务（4.1 再分析评估与复核）', () => {
        const tasks = readChangeArtifact('tasks.md');
        const taskLine = tasks.split('\n').find((l) => l.includes('4.1') && l.includes('执行再分析评估'));
        expect(taskLine, 'tasks.md 缺少评估执行任务 4.1').toBeDefined();
        expect(taskLine ?? '').toContain('评估记录');
    });
});

describe('spec-verify：Correctness 并入实现影响面对比（N12）', () => {
    const instructions = getSpecVerifyChangeSkillTemplate().instructions;

    it('对比步骤存在且声明影响面锚点与既有口径一致', () => {
        expect(instructions).toContain('**实现影响面 vs 提案声明影响面对比**（流程节点 N12，并入本维度）：');
        // 声明影响面来源锚点（与 spec-verify-proposal N3 三制品锚点同口径）
        expect(instructions).toContain('读 `proposal.md` 的 `## Impact` 下影响面分析小节（标题锚点：影响面分析 / Impact Analysis）');
        // 实现改动文件集来源（受只读权限约束：Glob / Read 检索）
        expect(instructions).toContain('汇总「需求实现映射」收集的 `文件:行` 实现证据与 tasks.md 完成任务涉及的文件（Glob / Read 检索）');
    });

    it('实现越出声明影响面：WARNING 逐条列出且 MUST NOT 判 CRITICAL（BS-4）', () => {
        expect(instructions).toContain('实现越出声明影响面（改动文件不在声明影响面内）→ 添加 WARNING 并逐条列出');
        expect(instructions).toContain('"实现越出声明影响面：<file>（提案影响面未声明）"');
        expect(instructions).toContain('（BS-4）；MUST NOT 判 CRITICAL 阻断归档');
    });

    it('提案无影响面制品：对比检查点 SKIP + WARN 且三维度其余检查照常（BS-5）', () => {
        expect(instructions).toContain('proposal.md 无影响面分析小节（影响分析未触发或存量 JSON-only 降级无对应字段）');
        expect(instructions).toContain('本对比检查点 SKIP + WARN（注明原因），三维度其余检查照常，MUST NOT 判 CRITICAL（BS-5）');
    });

    it('结构层分工明确：conformance 承担结构拦截，本检查点不重复结构校验（D2/D4）', () => {
        expect(instructions).toContain('**结构层分工**：结构层拦截由 `iagent spec conformance`（conformance-report.md 的 `**summary**:` 行）承担');
        expect(instructions).toContain('本检查点为语义层对比，MUST NOT 重复执行结构校验（D2/D4）');
    });
});

describe('spec-verify：执行方式双语义显式化（N10）', () => {
    const instructions = getSpecVerifyChangeSkillTemplate().instructions;

    it('父编排内联合并清单模式：判定信号 + 合并清单关键词 + 回执字段 + 报告落盘', () => {
        // 判定信号（编排上下文 / pipeline 工作区存在性）
        expect(instructions).toContain('存在**编排上下文** → 合并清单模式；否则 → 三维度 report-only 模式');
        expect(instructions).toContain('工作区标志为 `.openspec-tmp/pipeline-<change-name>/` 下已存在 handoff 包等编排产物');
        // 合并清单关键词
        expect(instructions).toContain('**父编排内联合并清单模式**：**主 agent 内联**，一次合并执行 D1-D10 核心维度 + B1-B7 边界清单');
        // 回执字段与报告落盘
        expect(instructions).toContain('`executionMode=inline`、`independence=self`');
        expect(instructions).toContain('验证报告 MUST 落盘 `.openspec-tmp/pipeline-<change-name>/verify-report.md`');
        expect(instructions).toContain('合并清单模式回执写 `readScope`');
    });

    it('独立调用三维度模式：判定信号 + 三维度关键词 + 不要求合并清单产物路径', () => {
        expect(instructions).toContain('**独立调用三维度 report-only 模式**：用户独立调用（无编排上下文、无 pipeline 工作区）');
        expect(instructions).toContain('按执行步骤 4-8 的 Completeness / Correctness / Coherence 三维度执行 report-only 验证');
        expect(instructions).toContain('不要求合并清单产物路径');
        expect(instructions).toContain('MUST NOT 写 pipeline 工作区');
    });
});

describe('report-only 权限边界（验证不改文件，零新增权限）', () => {
    it('spec-verify 的 allowedTools 字面量与既有完全一致', () => {
        expect(getSpecVerifyChangeSkillTemplate().allowedTools).toBe('Bash(iagent:*), Read, Glob, Grep');
    });

    it('review 的 allowedTools 字面量与既有完全一致', () => {
        expect(getReviewSkillTemplate().allowedTools).toBe(
            'Bash(iagent:*), Bash(git diff:*), Bash(git log:*), Bash(git status:*), Read, Glob, Grep'
        );
    });

    it('report-only 语义表述保留（spec-verify 不改文件不归档 / review 只审查不改码）', () => {
        expect(getSpecVerifyChangeSkillTemplate().instructions).toContain(
            '**报告语义**：report-only —— 不修改任何文件、不执行归档'
        );
        expect(getReviewSkillTemplate().instructions).toContain('只审查不改码：发现问题列出报告，修复需用户确认后衔接 `iagent_workflow`');
    });
});

describe('review：变更关联检测（N17 触发矩阵）', () => {
    const instructions = getReviewSkillTemplate().instructions;

    it('检测步骤存在：活跃变更枚举与求交口径', () => {
        expect(instructions).toContain('2. **变更关联检测（条件步骤，流程节点 N17）**');
        expect(instructions).toContain('枚举活跃变更：`openspec/changes/` 下非 `archive` 的变更目录');
        // 声明影响面 / tasks 涉及文件与审查范围求交
        expect(instructions).toContain('读取 `proposal.md` 声明影响面（`## Impact` 下影响面分析小节 / `### 直接影响的文件` 小节）与 `tasks.md` 涉及文件（任务正文出现的文件路径），与本次审查范围求交');
        // 检测只读
        expect(instructions).toContain('MUST NOT 为此修改任何文件');
    });

    it('检测到变更关联：触发一致性检查并标注关联变更名', () => {
        expect(instructions).toContain('**相交**（声明影响面或 tasks 涉及文件与审查范围有交集）→ 触发步骤 5 的「提案与实现一致性检查」，并在报告中标注关联的变更名');
    });

    it('无变更关联：一致性检查点不触发且五维度行为保持不变（BS-3）', () => {
        expect(instructions).toContain('**不相交 / 无活跃变更** → 一致性检查点不触发，按既有五维度审查输出报告，五维度行为保持不变（BS-3）');
    });

    it('既有五维度清单文本不被改写（逐条锁定）', () => {
        for (const head of [
            '1. **正确性**：逻辑错误、边界条件遗漏、空指针风险、异常分支缺失',
            '2. **安全性**：SQL 注入（${} 拼接）、未校验输入入库、敏感信息泄露、越权访问',
            '3. **性能**：循环内数据库/Redis 请求、重复计算、集合未指定初始容量、不必要的对象创建',
            '4. **可维护性**：命名见名知意、方法职责单一、重复代码、魔法数字',
            '5. **规范符合度**：分层是否越界（Controller 直接调 DAO）、对象是否混用（Entity 直接返回前端）、过期 API 使用',
        ]) {
            expect(instructions, `五维度清单被改写：${head}`).toContain(head);
        }
    });
});

describe('review：提案与实现一致性检查（N19）', () => {
    const instructions = getReviewSkillTemplate().instructions;

    it('三类语义核对关键词存在且为语义层能力', () => {
        expect(instructions).toContain('5. **提案与实现一致性检查（条件步骤，流程节点 N19，仅步骤 2 检出变更关联时执行）**');
        expect(instructions).toContain('对实现产出做**语义层**核对，三类核对：');
        expect(instructions).toContain('**设计决策遵循**：对照 `design.md` 的 Decisions（决策 / 选择 / 理由）');
        expect(instructions).toContain('**场景实现情况**：对照 `specs/**/*.md` 的 `#### Scenario:` 标记');
        expect(instructions).toContain('**影响面越界**：对照 `proposal.md` 声明影响面');
    });

    it('设计决策未遵循：WARNING 或 CRITICAL（按影响）+ 决策条目与实现证据（文件:行）', () => {
        expect(instructions).toContain('决策在实现中被违背（选型 / 分层与决策相反）→ 报 WARNING 或 CRITICAL（按影响），逐条列出决策条目与实现证据（`文件:行`）及触发场景');
    });

    it('影响面越界：WARNING 逐条（BS-4 口径）且结构层拦截不重复执行', () => {
        expect(instructions).toContain('实现改动越出声明影响面 → 报 WARNING 并逐条列出越面文件（BS-4 口径）；结构层拦截由 `iagent spec conformance` 承担，本检查点不重复执行');
    });

    it('分级与证据口径：CRITICAL/WARNING/SUGGESTION + 制品锚点 + 文件:行', () => {
        expect(instructions).toContain('分级沿用输出报告的 CRITICAL / WARNING / SUGGESTION');
        expect(instructions).toContain('每条发现 MUST 给出制品锚点（哪个制品哪个小节）与实现证据（`文件:行`）');
    });

    it('引用结构层证据：只读 conformance **summary** 行且不重跑结构校验（D5）', () => {
        expect(instructions).toContain('**结构层证据分工（D5）**：`.openspec-tmp/pipeline-<change-name>/conformance-report.md` 存在时');
        expect(instructions).toContain('只读其 `**summary**:` 行作为结构层证据输入，语义层结论与结构层结论并列呈现，MUST NOT 重跑结构校验命令');
    });

    it('结构层证据缺失：非阻断标注且不伪装已引用、不扩权', () => {
        expect(instructions).toContain('标注「结构层证据缺失（非阻断）」并继续语义层检查');
        expect(instructions).toContain('MUST NOT 伪装已引用、MUST NOT 为此扩权执行写操作');
    });
});

describe('改动边界守护（D1 / D2 / D3 硬约束）', () => {
    /** 本次新增的检查点语义关键词（结构校验代码与维度枚举消费点 MUST NOT 承载） */
    const NEW_CHECKPOINT_KEYWORDS = [
        '待实现功能覆盖检查点',
        '影响范围一致性检查',
        '实现影响面 vs 提案声明影响面对比',
        '变更关联检测',
        '提案与实现一致性检查',
        'IMPACT_CONSISTENCY_FULL',
    ];

    /** 递归收集目录下全部 .ts 文件（绝对路径）。 */
    function collectTsFiles(dir: string): string[] {
        const out: string[] = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                out.push(...collectTsFiles(full));
            } else if (entry.name.endsWith('.ts')) {
                out.push(full);
            }
        }
        return out;
    }

    it('src/core/spec/** 不含新增检查点语义（D1：CLI 结构校验代码零改动）', () => {
        const files = collectTsFiles(path.join(process.cwd(), 'src', 'core', 'spec'));
        expect(files.length, 'src/core/spec 目录为空？').toBeGreaterThan(0);
        const offenders: string[] = [];
        for (const file of files) {
            const text = fs.readFileSync(file, 'utf8');
            for (const keyword of NEW_CHECKPOINT_KEYWORDS) {
                if (text.includes(keyword)) {
                    offenders.push(`${file} 含 ${keyword}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('维度名枚举消费点零新增维度编号、零检查点语义（D2：扩展不改名）', () => {
        const consumers = [
            'src/core/host-orchestration/workflows.ts',
            'src/core/templates/workflows/auto-workflow.ts',
            'src/core/templates/workflows/debug.ts',
            'src/core/templates/workflows/proposal-review.ts',
        ];
        const offenders: string[] = [];
        for (const rel of consumers) {
            const text = fs.readFileSync(path.join(process.cwd(), ...rel.split('/')), 'utf8');
            for (const keyword of NEW_CHECKPOINT_KEYWORDS) {
                if (text.includes(keyword)) {
                    offenders.push(`${rel} 含 ${keyword}`);
                }
            }
            // 无新增维度编号（D11+ / 维度 11+ 编号不得出现）
            if (/\bDimension 1[1-9]\b/.test(text) || /维度 1[1-9]/.test(text)) {
                offenders.push(`${rel} 出现新增维度编号`);
            }
        }
        expect(offenders).toEqual([]);
    });

    it('auto-workflow 固定维度清单枚举未被改写（扩展不改名）', () => {
        const auto = fs.readFileSync(
            path.join(process.cwd(), 'src', 'core', 'templates', 'workflows', 'auto-workflow.ts'),
            'utf8'
        );
        expect(auto).toContain(
            'D1-D10 核心维度（D1 需求覆盖 / D2 技术一致性 / D3 任务完整性 / D4 边界覆盖 / D5 Pending 解决 / D6-D10 条件维度）'
        );
    });

    it('总分公式与 90% 统一阈值字符串未被改写（D2 / D3）', () => {
        const instructions = getSpecVerifyProposalSkillTemplate().instructions;
        expect(instructions).toContain(
            'Overall Score = (D1 + D2 + D3 + D4 + D5 + sum(triggered D6-D10)) / (5 + triggered_count)'
        );
        expect(instructions).toContain('Threshold interpretation (unified 90% — the previous 70%/90% dual-band is removed):');
    });
});
