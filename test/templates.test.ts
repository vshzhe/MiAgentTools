/**
 * 模板层测试：命名规范、9 类完整性、frontmatter 结构。
 */

import { describe, it, expect } from 'vitest';
import { getSkillTemplates, getCommandTemplates, deriveCommandId, countSkillsByType } from '../src/core/templates/index.js';
import { SKILL_PREFIX, SKILL_TYPE_IDS, isSkillType } from '../src/core/config.js';
import {
    buildFlowchartBlock,
    buildFlowchartCompact,
    REQUIREMENT_FLOW_COLUMNS,
    FAULT_CHAIN_FLOW_COLUMNS,
} from '../src/core/templates/flowchart-gate.js';

describe('模板注册表', () => {
    const skills = getSkillTemplates();
    const commands = getCommandTemplates();

    it('内置 20 个技能（9 类类型；release/tools 当前无内置技能）', () => {
        expect(skills.length).toBe(20);
    });

    it('全部技能名以 iagent_ 开头', () => {
        for (const { template } of skills) {
            expect(template.name.startsWith(SKILL_PREFIX)).toBe(true);
        }
    });

    it('技能类型均为合法类型（允许存在暂无技能的类型）', () => {
        const coveredTypes = new Set(skills.map((s) => s.template.type));
        for (const t of coveredTypes) {
            expect(SKILL_TYPE_IDS).toContain(t);
        }
        // release / tools 类型当前无内置技能，但类型仍保留以支持 iagent generate
        expect(coveredTypes.has('release')).toBe(false);
        expect(coveredTypes.has('tools')).toBe(false);
    });

    it('技能名以功能命名：不含生命周期类型段，spec 族保留 spec_ 领域段', () => {
        for (const { template } of skills) {
            // 名字格式：iagent_ + 小写/数字/下划线
            expect(template.name, template.name).toMatch(/^iagent_[a-z0-9_]+$/);
            if (template.type === 'spec') {
                // spec 族以领域段标记「依赖 openspec/ 与 openspec CLI」
                expect(template.name.startsWith(`${SKILL_PREFIX}spec_`), template.name).toBe(true);
            } else {
                // 非 spec 族 MUST NOT 把类型作为名字段出现（类型只写入 metadata.type）
                expect(
                    template.name.startsWith(`${SKILL_PREFIX}${template.type}_`),
                    `${template.name} 不应含类型段 ${template.type}_`
                ).toBe(false);
            }
        }
    });

    it('每个技能均有描述与正文', () => {
        for (const { template } of skills) {
            expect(template.description.length).toBeGreaterThan(10);
            expect(template.instructions.length).toBeGreaterThan(50);
        }
    });

    it('iagent_workflow 技能存在且属于 impl 类型', () => {
        const wf = skills.find((s) => s.template.name === 'iagent_workflow');
        expect(wf).toBeDefined();
        expect(wf?.template.type).toBe('impl');
    });

    it('指令数量与技能一一对应', () => {
        expect(commands.length).toBe(skills.length);
        expect(commands.map((c) => c.id)).toEqual(skills.map((s) => s.commandId));
    });

    it('指令 id 派生规则：iagent_spec_apply → spec-apply', () => {
        expect(deriveCommandId('iagent_spec_apply')).toBe('spec-apply');
        expect(deriveCommandId('iagent_project_init')).toBe('project-init');
    });

    it('迁移套件三新模板的 commandId 派生正确', () => {
        expect(deriveCommandId('iagent_migration_check')).toBe('migration-check');
        expect(deriveCommandId('iagent_migration')).toBe('migration');
        expect(deriveCommandId('iagent_feature_doc')).toBe('feature-doc');
    });

    it('非法前缀的技能名在派生时抛错', () => {
        expect(() => deriveCommandId('openspec_explore')).toThrow(/iagent_/);
    });

    it('按类型过滤生效', () => {
        expect(getSkillTemplates('commit').map((s) => s.template.name)).toEqual([
            'iagent_commit',
            'iagent_svn_commit',
        ]);
        expect(getCommandTemplates('init').map((c) => c.id)).toEqual(['project-init']);
    });

    it('类型统计覆盖全部 9 类', () => {
        const counts = countSkillsByType();
        expect(counts.size).toBe(9);
        expect(counts.get('tools')).toBe(0);
        expect(counts.get('release')).toBe(0);
        expect(counts.get('init')).toBe(1);
        expect(counts.get('impl')).toBe(4);
        expect(counts.get('review')).toBe(3);
        expect(counts.get('test')).toBe(1);
        expect(counts.get('docs')).toBe(2);
        expect(counts.get('spec')).toBe(7);
    });

    it('isSkillType 校验', () => {
        expect(isSkillType('init')).toBe(true);
        expect(isSkillType('tr_unknown')).toBe(false);
    });
});

describe('功能流程图制品内联', () => {
    const skills = getSkillTemplates();

    /** 接入本制品的技能 → 期望的场景列集特征（探索委派后 workflow/auto-workflow 正文不再内联，门归 spec_explore） */
    const FLOWCHART_SKILLS: ReadonlyArray<{ name: string; scenarioMark: string }> = [
        { name: 'iagent_spec_explore', scenarioMark: '异常路径' },
        // 调试技能用缺陷链路变体：列集以「标记」+ 根因标记语义区分
        { name: 'iagent_debug', scenarioMark: '🟠根因' },
    ];

    it('接入本制品的技能正文均内联来自 flowchart-gate.ts 的功能流程图文本', () => {
        for (const { name } of FLOWCHART_SKILLS) {
            const skill = skills.find((s) => s.template.name === name);
            expect(skill, `技能 ${name} 未注册`).toBeDefined();
            expect(skill?.template.instructions).toContain('功能流程图');
        }
    });

    it('节点清单表列集按场景注入（需求版 vs 缺陷链路版）', () => {
        for (const { name, scenarioMark } of FLOWCHART_SKILLS) {
            const instructions = skills.find((s) => s.template.name === name)?.template.instructions ?? '';
            expect(instructions, `${name} 缺少场景列集特征 ${scenarioMark}`).toContain(scenarioMark);
        }
        // 需求版必须含「触发条件 / 异常路径」两列，缺陷链路版不含「异常路径」列
        const debugInstructions =
            skills.find((s) => s.template.name === 'iagent_debug')?.template.instructions ?? '';
        const exploreInstructions =
            skills.find((s) => s.template.name === 'iagent_spec_explore')?.template.instructions ?? '';
        expect(exploreInstructions).toContain('异常路径');
        expect(debugInstructions).not.toContain('| 异常路径 |');
    });

    it('流程图文本不含 Bash 命令示例（防 allowed-tools 权限拦截）', () => {
        // 直接断言唯一源渲染产物：块文本本身不得含命令，否则被内联进
        // workflow（白名单无 pnpm）时会被权限拦截
        const commandPattern = /\b(pnpm|npm|npx|yarn|tsc|mvn|gradle|cargo)\b/;
        const blocks = [
            buildFlowchartBlock(REQUIREMENT_FLOW_COLUMNS),
            buildFlowchartBlock(FAULT_CHAIN_FLOW_COLUMNS),
            buildFlowchartCompact(REQUIREMENT_FLOW_COLUMNS),
            buildFlowchartCompact(FAULT_CHAIN_FLOW_COLUMNS),
        ];
        for (const block of blocks) {
            expect(commandPattern.test(block)).toBe(false);
        }
    });
});

describe('workflowFilter 过滤', () => {
    it('workflowFilter 按派生 id 过滤技能', () => {
        expect(getSkillTemplates(undefined, ['spec-explore']).map((s) => s.template.name)).toEqual([
            'iagent_spec_explore',
        ]);
        expect(getCommandTemplates(undefined, ['project-init']).map((c) => c.id)).toEqual([
            'project-init',
        ]);
    });

    it('workflowFilter 多项过滤保持注册顺序', () => {
        const ids = getSkillTemplates(undefined, ['workflow', 'spec-apply', 'debug']).map(
            (s) => s.commandId
        );
        // 注册顺序：workflow 在 debug 前，spec-apply 在其后
        expect(ids).toEqual(['workflow', 'debug', 'spec-apply']);
    });

    it('workflowFilter 与 typeFilter 正交叠加', () => {
        // spec 类中只保留 spec-propose
        expect(
            getSkillTemplates('spec', ['spec-propose', 'workflow']).map((s) => s.commandId)
        ).toEqual(['spec-propose']);
        // commit 类中保留 svn-commit
        expect(
            getCommandTemplates('commit', ['svn-commit']).map((c) => c.id)
        ).toEqual(['svn-commit']);
    });

    it('空数组 workflowFilter 结果为空（显式配置空集）', () => {
        expect(getSkillTemplates(undefined, [])).toEqual([]);
        expect(getCommandTemplates(undefined, [])).toEqual([]);
    });
});

describe('对话级确认门未被白名单改动侵蚀', () => {
    const skills = getSkillTemplates();

    /** 接入两个确认门的 4 个工作流技能 */
    const GATED_SKILLS = [
        'iagent_spec_explore',
        'iagent_debug',
    ];

    /** 提示词校验门关键标识句（优化输出、四条出口） */
    const PROMPT_GATE_MARKS = [
        '提示词校验门',
        '【优化后提示词】',
        '优化说明',
        // 紧凑版门文本（buildPromptGateCompact）的四条出口措辞，
        // 与全文版（buildPromptGateBlock）的"出口有四条，不得只认一条"等价
        '出口：确认 / 修改 / 拒绝 / 显式授权按推断',
        '显式授权按推断',
    ];

    /** 功能流程图门关键标识句（段落要求、最终确认门、节点清单） */
    const FLOWCHART_GATE_MARKS = [
        '## 功能流程图',
        '功能流程图',
        // 内联版流程门措辞为"（强制停止）"；"出口有四条，不得只认一条"仅存在于流程图全文版
        '流程最终确认门（强制停止）',
        '出口：确认 / 修改 / 拒绝',
        '节点清单',
    ];

    /** 断言判据：正文含提示词校验门的全部关键标识句 */
    function expectPromptGate(name: string, instructions: string): void {
        for (const mark of PROMPT_GATE_MARKS) {
            expect(instructions, `${name} 提示词校验门标识句缺失：${mark}`).toContain(mark);
        }
    }

    /** 断言判据：正文含功能流程图门的全部关键标识句 */
    function expectFlowchartGate(name: string, instructions: string): void {
        for (const mark of FLOWCHART_GATE_MARKS) {
            expect(instructions, `${name} 功能流程图门标识句缺失：${mark}`).toContain(mark);
        }
    }

    it('4 个含门技能的提示词校验门与功能流程图门标识句仍然存在', () => {
        expect(GATED_SKILLS.length).toBe(2);
        for (const name of GATED_SKILLS) {
            const skill = skills.find((s) => s.template.name === name);
            expect(skill, `技能 ${name} 未注册`).toBeDefined();
            const instructions = skill?.template.instructions ?? '';
            expectPromptGate(name, instructions);
            expectFlowchartGate(name, instructions);
        }
    });

    it('判据拦截力：门标识句被改动后判定失败', () => {
        const instructions =
            skills.find((s) => s.template.name === 'iagent_spec_explore')?.template.instructions ?? '';
        // 未改动时判据通过（排除判据恒失败造成的假保护）
        expect(() => expectPromptGate('iagent_spec_explore', instructions)).not.toThrow();
        expect(() => expectFlowchartGate('iagent_spec_explore', instructions)).not.toThrow();
        // 优化输出标识被篡改 / 最终确认门被删除 → 对应判据必须失败
        // （标识句在全文可出现多次，故用 replaceAll 全量改写后再验证判据）
        expect(() =>
            expectPromptGate(
                'iagent_spec_explore',
                instructions.replaceAll('【优化后提示词】', '【提示词】')
            )
        ).toThrow();
        expect(() =>
            expectFlowchartGate(
                'iagent_spec_explore',
                instructions.replaceAll('流程最终确认门（强制停止）', '流程确认门')
            )
        ).toThrow();
    });
});
