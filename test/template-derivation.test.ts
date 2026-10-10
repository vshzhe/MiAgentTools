/**
 * 模板派生一致性测试（spec 工作流单一源）。
 *
 * 保证 7 个 spec 工作流的 command content 由 skill instructions（唯一源）经
 * deriveCommandContent 派生生成，防止双模板手工双写回归（2026-09-14 漂移教训）：
 *   1. command.content === deriveCommandContent(skill.instructions) —— 派生关系锁定
 *   2. 派生输出非空且无 CMD:SKIP 标记泄漏
 *   3. instructions 含标记时派生必须实际裁剪（标记生效性抽检）
 */

import { describe, it, expect } from 'vitest';
import { getSkillTemplates, getCommandTemplates } from '../src/core/templates/registry.js';
import { deriveCommandContent } from '../src/core/templates/derive-command.js';

describe('模板派生一致性（spec 工作流单一源）', () => {
    const skillEntries = getSkillTemplates('spec');
    const commandEntries = getCommandTemplates('spec');
    const commandById = new Map(commandEntries.map(({ template, id }) => [id, template]));

    it('spec 工作流数量为 7（skill 与 command 成对）', () => {
        expect(skillEntries.length).toBe(7);
        expect(commandEntries.length).toBe(7);
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
        const explore = skillEntries.find((e) => e.template.name === 'venus_spec_explore');
        expect(explore).toBeDefined();
        const instructions = explore?.template.instructions ?? '';
        const derived = commandById.get(explore?.commandId ?? '')?.content ?? '';

        // 唯一源含本制品
        expect(instructions).toContain('功能流程图（Functional Flowchart）');
        // 派生输出必须保留：块若被 <!-- CMD:SKIP --> 包裹，此断言失败
        expect(derived).toContain('功能流程图（Functional Flowchart）');
        // 关键约束语句随块一并保留
        expect(derived).toContain('流程最终确认门');
        expect(derived).toContain('[新建]');
    });
});

describe('模板派生一致性（tr-init 单一源）', () => {
    // 作用域说明（任务 5.3 的「已评估、判定无需测试」结论）：
    // 本块只覆盖 tr-init.ts —— 它是 tr-* 家族纳入派生的第一步（增量迁移，沿用 2026-09-14
    // 只改 spec-* 的先例）。其余 17 个 tr-*.ts 模板（tr-impl* / tr-test / tr-commit* /
    // tr-review / tr-release / tr-tools / tr-docs-*）**不在本规则作用域内**，仍以手工双写
    // 形式存在，其产物 MUST NOT 因本次改造而变动，故不为其新增派生断言：
    // 为未改动的文件补断言属无效覆盖（断言必然通过且不锁定任何本次行为），且会把
    // 「作用域边界」这一待后续变更处理的决策伪装成已覆盖。作用域扩张须由独立变更实施
    // 并同步扩写本块。

    const initSkill = getSkillTemplates('tr_init')[0];
    const initCommand = getCommandTemplates('tr_init')[0];

    it('tr-init 技能与指令成对注册', () => {
        expect(initSkill?.template.name).toBe('venus_tr_init_project');
        expect(initSkill?.commandId).toBe('tr-init-project');
        expect(initCommand?.id).toBe('tr-init-project');
    });

    it('tr-init 的 command content 由 skill instructions 派生', () => {
        // 派生关系锁定：content 被改回独立手工字符串时断言失败
        expect(initCommand?.template.content).toBe(
            deriveCommandContent(initSkill?.template.instructions ?? '')
        );
    });

    it('tr-init 派生输出非空且无 CMD:SKIP 标记泄漏', () => {
        const derived = initCommand?.template.content ?? '';
        expect(derived.length).toBeGreaterThan(0);
        expect(derived).not.toContain('CMD:SKIP');
    });

    it('tr-init 双模板漂移已消除：指令版承载全部 9 步（不再是旧 4 步骨架版）', () => {
        const derived = initCommand?.template.content ?? '';
        const stepHeadings = [
            '### 1. 读取扫描基线',
            '### 2. 技术框架语义扫描',
            '### 3. 委派 `venus_tr_docs_feature_doc`',
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

    it('tr-init 关键防护语句全部保留进指令版（fail-safe：未标记段落默认双向可见）', () => {
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

    it('tr-init 未标记任何 CMD:SKIP 段落（刻意选择，非疏漏）', () => {
        // tr-init 不存在「仅技能版职责」的交互段落，全部防护语句在指令版同样必需。
        // 本断言把「不标记」这一决策固化为可验证事实：若后续有人为裁剪而加标记，
        // 该断言失败，迫使其先复核防护语句是否被一并裁掉。
        expect(initSkill?.template.instructions ?? '').not.toContain('<!-- CMD:SKIP -->');
    });
});
