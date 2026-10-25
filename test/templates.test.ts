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

/** 全量技能模板（模块级共用，供跨 describe 的契约断言使用） */
const allSkills = getSkillTemplates();

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

/** 技能正文 + references（正文下沉的协议细则同样是模板契约） */
function skillCorpus(name: string): string {
    const entry = allSkills.find((s) => s.template.name === name);
    expect(entry, `技能 ${name} 未注册`).toBeDefined();
    const refs = (entry?.template.references ?? []).map((ref) => ref.content).join('\n');
    return `${entry?.template.instructions ?? ''}\n${refs}`;
}

describe('文档桥单一确认面（4.1）', () => {
    it('三父流程均声明「单次业务桥」且不追加调用确认', () => {
        for (const name of ['iagent_workflow', 'iagent_auto_workflow', 'iagent_debug']) {
            const body = skillCorpus(name);
            expect(body, `${name} 未声明单次业务桥`).toMatch(/单次业务桥/);
            expect(body, `${name} 桥未声明直接委派（不追加确认）`).toMatch(
                /不追加[^\n]*调用确认|不再出现[^\n]*询问|不追加"是否调用该技能"确认/
            );
        }
    });

    it('debug 的文档桥是唯一文档确认面（不重复询问是否调用技能）', () => {
        const body = allSkills.find((s) => s.template.name === 'iagent_debug')?.template.instructions ?? '';
        expect(body).toContain('debug 唯一的文档确认面');
        expect(body).toContain('不是"是否调用该技能"的二次确认');
    });

    it('验证 FAIL 或复查未收束时三父流程均禁止展示桥', () => {
        for (const name of ['iagent_workflow', 'iagent_auto_workflow', 'iagent_debug']) {
            const body = skillCorpus(name);
            const failGuard = body
                .split('\n')
                .filter((line) => line.includes('FAIL') && line.includes('MUST NOT 展示'));
            expect(failGuard.length, `${name} 缺少 FAIL 不出桥护栏`).toBeGreaterThan(0);
        }
    });
});

describe('debug 决策与回归测试职责（4.3）', () => {
    const debug = skillCorpus('iagent_debug');
    const debugMain = allSkills.find((s) => s.template.name === 'iagent_debug')?.template.instructions ?? '';

    it('输入校验与复现闸门：不可复现不得修改代码', () => {
        expect(debugMain).toContain('在修改任何代码之前必须复现该 bug');
        expect(debugMain).toContain('无法建立复现时');
        expect(debugMain).toContain('MUST NOT 在假设下修复一个不可复现的 bug');
        expect(debugMain).toContain('复现确认之前不应用任何修复');
    });

    it('非缺陷分支：输出诊断报告且不新建变更、不修改代码', () => {
        expect(debugMain).toContain('3.5 非缺陷退出（诊断报告收尾）');
        expect(debugMain).toContain('MUST NOT 新建变更，MUST NOT 修改代码');
    });

    it('CodeGraph 不可用时显式降级并标注信号降级', () => {
        expect(debug).toContain('CodeGraph 不可用 —— 使用 Glob/Grep 降级');
        expect(debug).toContain('MUST NOT 因 CodeGraph 不可用而跳过分级');
        expect(debug).toContain('信号降级');
        expect(debug).toContain('MUST NOT 作为跳过 CodeGraph 的捷径');
    });

    it('诊断确认包合并根因与链路并只确认一次，拒绝即终止修复', () => {
        expect(debugMain).toContain('根因与缺陷链路诊断确认包');
        expect(debugMain).toContain('**同一个**确认包中一次呈现，等待**一次**确认');
        expect(debugMain).toContain('| 拒绝 | **终止修复**并输出诊断报告');
        expect(debugMain).toContain('MUST NOT 自动按推断继续、MUST NOT 标记可归档');
    });

    it('多候选根因先选根因再确认链路，未完成前不改代码', () => {
        expect(debugMain).toContain('先 STOP，呈现候选清单');
        expect(debugMain).toContain('选定后再呈现据此生成的缺陷链路确认包');
        expect(debugMain).toContain('未完成前 MUST NOT 修改任何代码');
    });

    it('多方案阻塞、唯一证据方案直通，DB/schema 确认保留', () => {
        expect(debugMain).toContain('4.0 可行修复方案数量判定');
        expect(debugMain).toContain('修复方案确认门（强制停止）');
        expect(debugMain).toContain('说明唯一性依据后**直通实现**');
        expect(debugMain).toContain('唯一性证据不足');
        expect(debugMain).toContain('MUST 按多方案处理');
        expect(debugMain).toContain('唯一方案直通规则 MUST NOT 绕过该确认');
    });

    it('回归测试委派 iagent_test 并由 debug 验收 fail-before / pass-after 与节点覆盖', () => {
        expect(debugMain).toContain('强制回归测试（委派 `iagent_test`）');
        expect(debugMain).toContain('**唯一来源**');
        expect(debugMain).toContain('修复前 FAIL、修复后 PASS');
        expect(debugMain).toContain('异常节点 + 根因节点');
        expect(debugMain).toContain('MUST NOT 报告测试验收通过');
    });

    it('strict 缺委派能力阻断而非自写，仅显式 degraded 允许本地', () => {
        expect(debugMain).toContain('strict 模式无法委派 `iagent_test` 时 SHALL 按能力协商**阻断并报告**');
        expect(debugMain).toContain('MUST NOT 以"自写 + WARN"绕过');
        expect(debugMain).toContain('显式协商 degraded 时才允许本地编写');
    });

    it('Phase 1 临时测试不构成回归测试（职责边界无冲突）', () => {
        expect(debugMain).toContain('不构成回归测试');
        expect(debugMain).toContain('MUST NOT 仅以 Phase 1 临时测试充当唯一回归测试');
        // 旧的内联框架检测/生成规则已移除（唯一来源归 iagent_test）
        expect(debugMain).toContain('debug MUST NOT 再维护与之冲突的内联框架检测或测试生成规则');
    });

    it('N36 重验仍 FAIL 时无跳过路径', () => {
        expect(debugMain).toContain('重跑仍失败时');
        expect(debugMain).toContain('没有跳过直接实现的路径');
        expect(debugMain).toContain('[1] 手动编辑，[2] 返回探索，[3] 查看详细差异报告');
    });
});
