/**
 * 模板派生一致性测试（全模板单一源）。
 *
 * 保证全部 20 个技能模板的 command content 由 skill instructions（唯一源）经
 * deriveCommandContent 派生生成，防止双模板手工双写回归（2026-09-14 漂移教训）：
 *   1. command.content === deriveCommandContent(skill.instructions) —— 派生关系锁定
 *   2. 派生输出非空且无 CMD:SKIP 标记泄漏
 *   3. instructions 含标记时派生必须实际裁剪（标记生效性抽检）
 */

import { describe, it, expect } from 'vitest';
import { getSkillTemplates, getCommandTemplates } from '../src/core/templates/registry.js';
import { deriveCommandContent } from '../src/core/templates/derive-command.js';

describe('模板派生一致性（全模板单一源）', () => {
    const skillEntries = getSkillTemplates();
    const commandEntries = getCommandTemplates();
    const commandById = new Map(commandEntries.map(({ template, id }) => [id, template]));

    it('技能与指令成对注册且均为 20 个', () => {
        expect(skillEntries.length).toBe(20);
        expect(commandEntries.length).toBe(20);
    });

    for (const { template: skill, commandId } of skillEntries) {
        it(`${skill.name} 的 command content 由 skill instructions 派生`, () => {
            const command = commandById.get(commandId);
            expect(command).toBeDefined();
            // 派生关系锁定：正文出现第二份手工维护内容时（content 被改为独立字符串）断言失败
            expect(command?.content).toBe(deriveCommandContent(skill.instructions));
            // 派生输出非空且无标记泄漏
            expect(command?.content.length ?? 0).toBeGreaterThan(0);
            expect(command?.content).not.toContain('CMD:SKIP');
        });
    }

    it('唯一源含 CMD:SKIP 标记的模板派生后必须变短（标记生效性抽检）', () => {
        // 至少 explore/apply/propose/archive 四个模板带标记（漂移修复与裁剪迁移），全部校验
        const marked = skillEntries.filter(({ template }) => template.instructions.includes('<!-- CMD:SKIP -->'));
        expect(marked.length).toBeGreaterThanOrEqual(4);
        for (const { template } of marked) {
            const derived = deriveCommandContent(template.instructions);
            expect(derived.length).toBeLessThan(template.instructions.length);
        }
    });

    it('所有 spec instructions 均含防护语句锚点（fail-safe 抽检：Guardrails 段保留进 command）', () => {
        for (const { template: skill, commandId } of skillEntries) {
            if (!skill.instructions.includes('Guardrails')) {
                continue;
            }
            // 含 Guardrails 段的模板，其派生输出必须保留该段（防护语句永不裁剪）
            expect(commandById.get(commandId)?.content).toContain('Guardrails');
        }
    });

    it('spec-explore 的功能流程图块不被 CMD:SKIP 裁掉（指令版同样需要本制品）', () => {
        const explore = skillEntries.find((e) => e.template.name === 'iagent_spec_explore');
        expect(explore).toBeDefined();
        const instructions = explore?.template.instructions ?? '';
        const derived = commandById.get(explore?.commandId ?? '')?.content ?? '';

        // 唯一源含本制品
        expect(instructions).toContain('功能流程图');
        // 派生输出必须保留：块若被 <!-- CMD:SKIP --> 包裹，此断言失败
        expect(derived).toContain('功能流程图');
        // 关键约束语句随块一并保留
        expect(derived).toContain('流程最终确认门');
        expect(derived).toContain('[新建]');
    });
});

describe('模板派生一致性（project-init 迁移后的代表性回归）', () => {
    // 作用域说明（变更 improve-template-language-consistency 后已全量扩张）：
    // 上方「全模板单一源」块已锁定全部 20 个技能/指令对均由 deriveCommandContent 派生。
    // 本块保留 project-init 的**代表性细粒度断言** —— 它是功能命名家族首个纳入派生的模板
    // （增量迁移先例），其「双模板漂移已消除」「关键防护语句全部保留」「未标记 CMD:SKIP」
    // 三条断言验证派生改造未丢失任何步骤或防护语句，作为回归样例长期保留。

    const initSkill = getSkillTemplates('init')[0];
    const initCommand = getCommandTemplates('init')[0];

    it('project-init 技能与指令成对注册', () => {
        expect(initSkill?.template.name).toBe('iagent_project_init');
        expect(initSkill?.commandId).toBe('project-init');
        expect(initCommand?.id).toBe('project-init');
    });

    it('project-init 的 command content 由 skill instructions 派生', () => {
        // 派生关系锁定：content 被改回独立手工字符串时断言失败
        expect(initCommand?.template.content).toBe(
            deriveCommandContent(initSkill?.template.instructions ?? '')
        );
    });

    it('project-init 派生输出非空且无 CMD:SKIP 标记泄漏', () => {
        const derived = initCommand?.template.content ?? '';
        expect(derived.length).toBeGreaterThan(0);
        expect(derived).not.toContain('CMD:SKIP');
    });

    it('project-init 双模板漂移已消除：指令版承载全部 9 步（不再是旧 4 步骨架版）', () => {
        const derived = initCommand?.template.content ?? '';
        const stepHeadings = [
            '### 1. 读取扫描基线',
            '### 2. 技术框架语义扫描',
            '### 3. 委派 `iagent_feature_doc`',
            '### 4. 安全规范扫描',
            '### 5. 已存在文档逐份确认',
            '### 6. 增量对齐与人工域标记',
            '### 7. 五类文档与索引落盘',
            '### 8. `AGENTS.md` 生成 / 对齐',
            '### 9. `context` 回写',
        ];
        for (const heading of stepHeadings) {
            expect(derived, `指令版缺少步骤：${heading}`).toContain(heading);
        }
        // 旧手工双写版的正文特征（改造前 command 版独有、skill 版没有的 4 步骨架措辞）
        expect(derived).not.toContain('**输出初始化蓝图**');
    });

    it('project-init 关键防护语句全部保留进指令版（fail-safe：未标记段落默认双向可见）', () => {
        const derived = initCommand?.template.content ?? '';
        const protectiveStatements = [
            // 非阻断
            '非阻断',
            // 敏感值零外泄
            'MUST NOT 记录任何取值',
            // 框架判定不得仅凭 jar 存在
            'MUST NOT 仅凭 jar',
            // 版本不得编造
            'MUST NOT 编造版本',
            // YAML 不得重序列化
            'MUST NOT 重新序列化整个 YAML',
            // 人工域破损取保留侧
            'MUST NOT 猜测闭合位置',
            // 不生成空壳文档
            '空壳文档',
        ];
        for (const statement of protectiveStatements) {
            expect(derived, `指令版缺失防护语句：${statement}`).toContain(statement);
        }
    });

    it('project-init 未标记任何 CMD:SKIP 段落（刻意选择，非疏漏）', () => {
        // project-init 不存在「仅技能版职责」的交互段落，全部防护语句在指令版同样必需。
        // 本断言把「不标记」这一决策固化为可验证事实：若后续有人为裁剪而加标记，
        // 该断言失败，迫使其先复核防护语句是否被一并裁掉。
        expect(initSkill?.template.instructions ?? '').not.toContain('<!-- CMD:SKIP -->');
    });
});

describe('模板派生一致性（文档桥 / debug 决策护栏）', () => {
    const commandById = new Map(
        getCommandTemplates().map(({ template, id }) => [id, template])
    );

    it('debug 指令版保留诊断拒绝出口与 iagent_test 委派护栏', () => {
        const derived = commandById.get('debug')?.content ?? '';
        for (const statement of [
            '| 拒绝 | **终止修复**并输出诊断报告',
            'MUST NOT 自动按推断继续、MUST NOT 标记可归档',
            '强制回归测试（委派 `iagent_test`）',
            'Phase 1 内联临时测试的边界',
            'MUST NOT 仅以 Phase 1 临时测试充当唯一回归测试',
            '没有跳过直接实现的路径',
        ]) {
            expect(derived, `debug 指令版缺失护栏：${statement}`).toContain(statement);
        }
    });

    it('workflow 指令版保留文档状态 handoff 与 FAIL 不出桥护栏', () => {
        const derived = commandById.get('workflow')?.content ?? '';
        expect(derived).toContain('FAIL 不出文档桥');
        expect(derived).toContain('文档状态跨阶段传递');
        expect(derived).toContain('skipped-by-user');
        expect(derived).toContain('requirementDocStatus');
    });

    it('auto-workflow 指令版保留唯一文档桥与测试门护栏', () => {
        const derived = commandById.get('auto-workflow')?.content ?? '';
        expect(derived).toContain('该桥是本阶段唯一的流程级阻塞门');
        expect(derived).toContain('测试门失败时不得静默通过');
        expect(derived).toContain('FAIL 不出文档桥');
    });

    it('spec-propose 指令版在验证 PASS 后停止且无生成动作', () => {
        const derived = commandById.get('spec-propose')?.content ?? '';
        expect(derived).toContain('独立调用在验证 PASS 后停止');
        expect(derived).not.toMatch(/收束 —— 需求文档桥/);
    });

    it('派生内容不残留旧口径（debug 生成禁令 / 验证阶段默认生成）', () => {
        const all = getCommandTemplates()
            .map(({ template }) => template.content)
            .join('\n');
        expect(all).not.toContain('需求文档不在范围内（强制禁止）');
        expect(all).not.toContain('Phase 7 MUST NOT 生成需求文档');
    });
});
