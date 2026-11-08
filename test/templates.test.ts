/**
 * 模板层测试：命名规范、9 类完整性、frontmatter 结构。
 */

import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getSkillTemplates, getCommandTemplates, deriveCommandId, countSkillsByType } from '../src/core/templates/index.js';
import { SKILL_PREFIX, SKILL_TYPE_IDS, isSkillType } from '../src/core/config.js';
import {
    buildFlowchartBlock,
    buildFlowchartCompact,
    REQUIREMENT_FLOW_COLUMNS,
    FAULT_CHAIN_FLOW_COLUMNS,
} from '../src/core/templates/flowchart-gate.js';
import { GATE_MUST_NOT_CONFIRM_ITEMS } from '../src/core/templates/prompt-gate.js';
import { GATE_WHITELIST } from '../src/core/host-orchestration/protocol.js';

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

describe('需求文档桥已移除（4.1）', () => {
    it('三父流程均声明桥已移除且不追加调用确认', () => {
        for (const name of ['iagent_workflow', 'iagent_auto_workflow', 'iagent_debug']) {
            const body = skillCorpus(name);
            expect(body, `${name} 未声明需求文档桥已移除`).toMatch(
                /需求文档桥[^\n]*移除|无需求文档桥/
            );
            expect(body, `${name} 未声明直接续跑（不追加确认）`).toMatch(
                /不追加[^\n]*调用确认|不再出现[^\n]*询问|不追加"是否调用该技能"确认|直接续跑|自动转入 Phase 4|同一用户回合内继续/
            );
        }
    });

    it('workflow 交付桥三出口：无文档选项、无第二次文档停点', () => {
        const body = skillCorpus('iagent_workflow');
        expect(body).toContain('交付桥');
        expect(body).toContain('实现 + 测试桥');
        expect(body).toContain('三出口');
        expect(body).toContain('MUST NOT 提供文档生成选项');
        expect(body).not.toContain('是否生成需求文档');
        expect(body).not.toContain('仅生成文档');
        // 旧的两段式停点已消失（验证阶段不再单独停一次文档桥）
        expect(body).not.toContain('收束 —— 需求文档桥（⚠️ 单次业务桥，强制）');
        // 拒绝回退范围在同一门内显式
        expect(body).toContain('拒绝 → 记录未确认状态并停止');
    });

    it('debug 不再持有需求文档桥确认面', () => {
        const body = allSkills.find((s) => s.template.name === 'iagent_debug')?.template.instructions ?? '';
        expect(body).not.toContain('debug 唯一的文档确认面');
        expect(body).not.toContain('不是"是否调用该技能"的二次确认');
        expect(body).toContain('MUST NOT 展示需求文档桥');
        // 手工调用路径仍保留提示
        expect(body).toContain('请按需单独调用 iagent-requirement-doc');
    });

    it('验证 FAIL 或复查未收束时三父流程均无跳过直接实现的路径', () => {
        for (const name of ['iagent_workflow', 'iagent_auto_workflow', 'iagent_debug']) {
            const body = skillCorpus(name);
            expect(body, `${name} 缺少 FAIL 不跳过的护栏`).toMatch(
                /FAIL 不进入实现|无跳过直接|不提供跳过直接|没有跳过直接/
            );
        }
    });
});

describe('debug 决策与回归测试职责（4.3）', () => {
    const debug = skillCorpus('iagent_debug');
    const debugMain = allSkills.find((s) => s.template.name === 'iagent_debug')?.template.instructions ?? '';

    it('双轨入口：复现契约四状态五证据类型，默认复现优先', () => {
        // 复现契约字段与取值（D7 / U3）
        expect(debugMain).toContain('reproductionStatus');
        for (const status of ['`reproduced`', '`not-reproduced`', '`intermittent`', '`static-only`']) {
            expect(debugMain, `复现状态缺失：${status}`).toContain(status);
        }
        expect(debugMain).toContain(
            '`failing-test` / `manual-steps` / `log-trace` / `static-proof` / `review-finding`'
        );
        // 默认轨道与联合判定
        expect(debugMain).toContain('默认轨道 = 复现优先');
        expect(debugMain).toContain('无法判定时默认复现优先');
        expect(debugMain).toContain('复现确认之前不应用任何修复');
        // 旧的无条件「不可复现一律停止」口径已被证据门槛取代（双轨落地后互斥）
        expect(debugMain).not.toContain('在修改任何代码之前必须复现该 bug');
        expect(debugMain).not.toContain('MUST NOT 在假设下修复一个不可复现的 bug');
    });

    it('证据优先轨道仅在无复现条件时启用，且须满足证据门槛', () => {
        expect(debugMain).toContain('### 1.3 证据优先轨道（仅在无复现条件时启用）');
        expect(debugMain).toContain('仅在无复现条件时启用');
        expect(debugMain).toContain('`文件:行`');
        expect(debugMain).toContain('至少一条**可重复**的证据');
        expect(debugMain).toContain('MUST NOT 凭单次偶然现象进入修复');
    });

    it('无证据时只报告候选并停止，且与非缺陷退出语义区分', () => {
        expect(debugMain).toContain('只报告**候选根因 / 候选缺陷**');
        expect(debugMain).toContain('MUST NOT 修改代码');
        expect(debugMain).toContain('不凭假设修复');
        expect(debugMain).toContain('与 1.3 证据不足出口的区别');
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

    it('2.4 是「诊断 + 方案」单包：一次确认同时确认根因与方案，拒绝即终止修复', () => {
        expect(debugMain).toContain('### 2.4 根因与修复方案诊断确认包');
        expect(debugMain).toContain('「诊断 + 方案」单一确认包');
        expect(debugMain).toContain('**同一个**确认包中一次呈现，等待**一次**确认');
        expect(debugMain).toContain('MUST NOT 再停一次方案确认门');
        // 包内必备四部分：根因证据 / 缺陷链路 / 修复方案 / 变更归属
        expect(debugMain).toContain('**修复方案**（唯一方案须给出唯一性证据');
        expect(debugMain).toContain('`changeName` + `affectedSymbols`');
        expect(debugMain).toContain('| 拒绝 | **终止修复**并输出诊断报告');
        expect(debugMain).toContain('MUST NOT 自动按推断继续、MUST NOT 标记可归档');
    });

    it('Phase 3 变更归属前移到 2.4 之前（顺序回归锁）', () => {
        const association = debugMain.indexOf('### 2.3.5 变更归属判定');
        const pkg = debugMain.indexOf('### 2.4 根因与修复方案诊断确认包');
        expect(association).toBeGreaterThan(-1);
        expect(pkg).toBeGreaterThan(association);
        // 3.6 收束（产出 changeName / affectedSymbols / fixDecision）整体在 2.4 之前
        expect(debugMain.indexOf('#### 3.6 变更归属收束')).toBeLessThan(pkg);
        // 回退条件原句
        expect(debugMain).toContain('多变更候选');
        expect(debugMain).toContain('归档来源追溯');
        expect(debugMain).toContain('范围待定');
        expect(debugMain).toContain('仅在存在多个可行方案时');
    });

    it('多候选根因先选根因，再在同一包内确认链路与方案', () => {
        expect(debugMain).toContain('先 STOP，呈现候选清单');
        expect(debugMain).toContain('同一**确认包内呈现据此生成的缺陷链路与修复方案');
        expect(debugMain).toContain('未完成前 MUST NOT 修改任何代码');
    });

    it('合并包已含方案时不停 4.0；回退路径下多方案阻塞、唯一证据方案直通', () => {
        expect(debugMain).toContain('### 4.0 可行修复方案数量判定（回退路径条件门）');
        expect(debugMain).toContain('仅在**回退路径**下生效，且仅存在多个可行方案时触发');
        expect(debugMain).toContain('修复方案确认门（强制停止）');
        expect(debugMain).toContain('说明唯一性依据后**直通实现**');
        expect(debugMain).toContain('唯一性证据不足');
        expect(debugMain).toContain('MUST 按多方案处理');
        expect(debugMain).toContain('唯一方案直通规则 MUST NOT 绕过该确认');
    });

    it('回归测试内联调用 iagent_test 并由 debug 验收 fail-before / pass-after 与节点覆盖', () => {
        expect(debugMain).toContain('强制回归测试（内联调用 `iagent_test`）');
        expect(debugMain).toContain('**唯一来源**');
        expect(debugMain).toContain('修复前 FAIL、修复后 PASS');
        expect(debugMain).toContain('异常节点 + 根因节点');
        expect(debugMain).toContain('MUST NOT 报告测试验收通过');
    });

    it('strict 缺调用能力阻断而非自写，仅显式 degraded 允许本地', () => {
        expect(debugMain).toContain('strict 模式无法调用 `iagent_test`（Skill 工具不可用）时 SHALL 按能力协商**阻断并报告**');
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

    it('N35 自造门：概览为非阻塞提示，正文无该停点', () => {
        // 概览第 5 条降级为非阻塞提示
        expect(debugMain).toContain('非阻塞提示，不构成确认门');
        expect(debugMain).not.toContain('每次修复后询问用户是否还有相关 bug');
        // 正文收束小节显式声明非门
        expect(debugMain).toContain('### 4.3 修复后收束（调试循环的非阻塞出口）');
        expect(debugMain).toContain('不构成确认门');
        expect(debugMain).toContain('MUST NOT 作为停点');
        // Guardrails 禁止声明白名单外确认门
        expect(debugMain).toContain('MUST NOT 声明门白名单之外的确认门');
    });

    it('证据优先轨道的回归测试为 characterization test', () => {
        expect(debugMain).toContain('characterization test');
        expect(debugMain).toContain('无法建立可执行断言时');
        // 两轨共用分级（分级在证据优先轨道不得跳过）
        expect(debug).toContain('两轨同等生效');
        expect(debug).toContain('MUST NOT 改变分级信号、路径选择或排查步骤');
    });

    it('Guardrails 与双轨 / 合并包口径一致（P0 护栏改写）', () => {
        // 不再含无条件「没有确认的复现就不修复」
        expect(debugMain).not.toContain('没有确认的复现（失败测试或用户确认的步骤）就不修复');
        expect(debugMain).toContain('**默认复现优先、证据优先须硬证据（双轨）**');
        expect(debugMain).toContain('MUST NOT 凭假设修复');
        // 4.0 阻塞仅限回退路径 + 多方案
        expect(debugMain).not.toContain('4.0 的修复方案确认门 MUST 阻塞并等待用户确认');
        expect(debugMain).toContain('**方案在 2.4 合并包内一次确认**');
        expect(debugMain).toContain('4.0 的修复方案确认门才 MUST 阻塞并等待用户确认');
        // 唯一方案证据的生效位置为 2.4 合并包
        expect(debugMain).toContain('**唯一方案需证据（生效位置为 2.4 合并包）**');
        expect(debugMain).toContain('唯一性证据 MUST 随 2.4 合并包一并呈现');
        // 未在本次范围内改动的护栏仍在（零猜测 / 归档只读 / 循环出口）
        expect(debugMain).toContain('- **零猜测**：多个候选根因 → STOP 并让用户选择；绝不猜测');
        expect(debugMain).toContain('- **归档只读**：MUST NOT 修改 `openspec/changes/archive/`');
        expect(debugMain).toContain('- **循环退出保留已完成工作**');
    });
});

// 任务 2.11：spec-explore 既有探索协议回归（MODIFIED 需求整体重写后逐条守护）。
describe('2.11 spec-explore 既有探索协议回归', () => {
    const explore = skillCorpus('iagent_spec_explore');
    const exploreMain = allSkills.find((s) => s.template.name === 'iagent_spec_explore')?.template.instructions ?? '';

    it('探索文件持久化（强制创建检查点与命名规则）', () => {
        expect(explore).toContain('创建探索文件（强制检查点）');
        expect(explore).toContain('openspec/explorations/<keyword>-explore-<sequence>.md');
        expect(explore).toContain('没有有效探索文件时，系统 MUST NOT 进入追问环节');
    });

    it('写入确认守卫（范围限定 + 显式同意）', () => {
        expect(explore).toContain('写操作确认限定范围且须显式');
        expect(explore).toContain('每次写都需独立的同意/拒绝确认');
    });

    it('依赖文件 re-read from disk（不依赖会话缓存）', () => {
        expect(explore).toContain('从磁盘重新读取文件');
        expect(explore).toContain('MUST 从磁盘重新读取');
        expect(explore).toContain('绝不依赖会话缓存的内容');
    });

    it('材料性歧义划分（实质性 vs 细节级）', () => {
        expect(explore).toContain('实质性歧义要表面化');
        expect(explore).toContain('非实质性的细节级歧义可用合理假设解决');
    });

    it('条件触发保持探索立场（非固定流程步骤）', () => {
        expect(exploreMain).toContain('这不是固定流程步骤');
        expect(exploreMain).toContain('不因本门改变');
    });

    it('入口形态适配（最终输入 / 变更名 / 已有基线）', () => {
        expect(explore).toContain('入口形态适配');
        expect(explore).toContain('MUST NOT 对空输入执行校验');
        expect(explore).toContain('上游已产出提示词基线时直接通过');
    });

    it('含糊输入激活门并阻塞确认', () => {
        expect(explore).toContain('输入含糊或多义时激活本门');
        expect(explore).toContain('确认前 MUST NOT 进行代码库扫描与需求澄清追问');
    });

    it('浮现业务功能流程时产出并确认', () => {
        expect(explore).toContain('流程浮现时要产出功能流程图');
        expect(explore).toContain('流程最终确认门（强制停止）');
    });

    it('无业务功能流程时直通不阻断', () => {
        expect(explore).toContain('本次无功能流程');
        expect(explore).toContain('不阻断探索');
    });

    it('流程最终确认门不死锁（四出口）', () => {
        expect(explore).toContain('不要在流程最终确认门上死锁');
        expect(explore).toContain('拒绝后按原理解继续');
    });

    it('探索阶段阻塞门仍 ≤1（门预算段存在）', () => {
        expect(explore).toContain('每个阶段至多 **1 个流程级阻塞确认门**');
        expect(explore).toContain('探索阶段**：**功能流程图门**为唯一流程级阻塞门');
    });
});

// 任务 4.7：spec-archive 归档只读 + 需求文档只读报告回归（写入分支与 devdocs 迁移已删除）。
describe('4.7 spec-archive 归档只读与只读报告', () => {
    const archive = skillCorpus('iagent_spec_archive');

    it('4.8 已移除：不生成 / 不对齐 / 不委派 / 不再读取报告', () => {
        expect(archive).toContain('4.8 **（已移除）**');
        expect(archive).not.toMatch(/4\.8 \*\*归档前需求文档只读报告/);
        expect(archive).not.toContain('该报告失败 MUST NOT 阻断归档');
        // 存在性报告不再作为步骤契约（成功输出样例中的旧行不构成读取契约）
        expect(archive).not.toContain('需求文档：缺失');
        expect(archive).toContain('MUST NOT 读取');
        expect(archive).not.toMatch(/in-place|就地增量对齐更新/);
        expect(archive).not.toMatch(/委派 `iagent_requirement_doc` 技能/);
        // 旧的四值分流分支已删除
        for (const token of ['分支 A', '分支 B', '分支 E', 'generation-failed', 'skipped-by-user']) {
            expect(archive, `残留旧分流分支 ${token}`).not.toContain(token);
        }
    });

    it('Step 6 删除：需求文档不再迁出 devdocs，文件随目录留在 archive/', () => {
        expect(archive).not.toContain('把需求文档移入 devdocs');
        expect(archive).not.toContain('devdocs/YYYY-MM-DD');
        expect(archive).not.toContain('MUST NOT 迁出到 `openspec/devdocs/`');
        // 新语义：文件随目录原样保留，不读取、不处理
        expect(archive).toMatch(/原样保留|随目录一起移动/);
    });

    it('归档只读护栏存在（整目录移动不属于改写）', () => {
        expect(archive).toContain('**归档只读**');
        expect(archive).toContain('MUST NOT 修改 `openspec/changes/archive/`');
        expect(archive).toContain('整目录移动');
        expect(archive).toContain('月度索引 `ARCHIVE-INDEX-YYYY-MM.md` 的**追加**是显式例外');
        expect(archive).toContain('归档只读护栏自检');
    });

    it('索引纯追加：结构损坏时只追加不重建', () => {
        expect(archive).toContain('纯追加');
        expect(archive).toContain('保留原文');
        expect(archive).toContain('MUST NOT 全量重建');
        expect(archive).toContain('提示人工修复');
        expect(archive).not.toContain('重建该文件');
        expect(archive).not.toContain('重建整个文件');
    });

    it('delta spec 智能合并仍在（ADDED/MODIFIED/REMOVED/RENAMED）', () => {
        expect(archive).toContain('ADDED/MODIFIED/REMOVED/RENAMED');
        expect(archive).toContain('delta specs 已合并');
    });

    it('MODIFIED 目标在主 spec 缺失时按 ADDED 追加并告警（不中止、不丢弃）', () => {
        expect(archive).toContain('目标需求标识在主 spec 中缺失');
        expect(archive).toContain('按 ADDED 追加该需求');
        expect(archive).toContain('MODIFIED 目标缺失（已追加）');
        expect(archive).toContain('MUST NOT 中止归档');
        expect(archive).toContain('MUST NOT 丢弃该需求');
    });

    it('归档收尾清理流程级工作区（phase=archive 之后，失败仅 WARN）', () => {
        expect(archive).toContain('归档收尾清理（流程级工作区）');
        expect(archive).toContain('phase=archive');
        // 顺序强制：清理在阶段结论追加之后
        expect(archive).toContain('顺序强制');
        expect(archive).toContain('.openspec-tmp/pipeline-<change-name>/');
        expect(archive).toContain('apply-<change-name>/');
        expect(archive).toContain('node -e "fs.rmSync(');
        expect(archive).toContain('MUST NOT 阻断归档');
        expect(archive).toContain('流程级工作区清理结果');
    });
});

// 任务 2.10：spec-apply 编译硬门模板断言（无跳过出口 / 终态四值 / 配置载体 / 范围降级链）。
describe('2.10 spec-apply 编译硬门', () => {
    const apply = skillCorpus('iagent_spec_apply');

    it('硬门无会话级跳过出口（正文与 Output）', () => {
        expect(apply).toContain('编译检查阶段（硬门）');
        expect(apply).not.toContain('跳过检查并归档');
        expect(apply).not.toContain('跳过并记录警告');
        expect(apply).not.toContain('[3] 跳过');
        expect(apply).toContain('无会话级跳过出口');
    });

    it('终态四值齐备且非通过终态不得表述为通过', () => {
        for (const status of ['pass', 'fail', 'not-applicable', 'disabled']) {
            expect(apply, `缺少终态 ${status}`).toContain(`\`${status}\``);
        }
        expect(apply).toContain('MUST NOT 表述为「通过」');
        expect(apply).toContain('未执行编译检查（无可编译产物 / 项目级显式禁用）');
    });

    it('配置载体为 .iagent/config.yaml，缺段经 iagent config show 取默认值', () => {
        expect(apply).toContain('.iagent/config.yaml');
        expect(apply).toContain('iagent config show');
        expect(apply).toContain('enabled=true');
        expect(apply).toContain('maxRetries=3');
        // 旧位置仅 WARN，不双源
        expect(apply).toContain('openspec/config.yaml');
        expect(apply).toContain('MUST NOT 采用其取值');
    });

    it('不再是 allowedEditRoots 的必需消费者（Step 2 与 Step 8 两处）', () => {
        expect(apply).toContain('**均非必需字段**');
        expect(apply).toContain('MUST NOT 依赖 `allowedEditRoots`');
        expect(apply).not.toContain('从状态 JSON 解析 `allowedEditRoots`');
        // 变更范围走降级链并记 WARN
        expect(apply).toContain('降级链');
        for (const source of ['`git diff`（含未跟踪文件）', '`contextFiles` / `changeRoot`', 'project-root']) {
            expect(apply, `范围降级链缺少 ${source}`).toContain(source);
        }
    });

    it('批后增量检查收敛到 compileCheck.incremental 且不再读 apply.incrementalCheck', () => {
        expect(apply).toContain('compileCheck.incremental');
        expect(apply).toContain('批后编译检查');
        expect(apply).toContain('复用收尾全量所用的**同一条命令**');
        // 旧配置只在弃用语境出现（不作为生效来源）
        const occurrences = apply.split('apply.incrementalCheck').length - 1;
        expect(occurrences).toBeGreaterThan(0);
        expect(apply).toContain('`apply.incrementalCheck` 一类字段');
        expect(apply).not.toMatch(/从 `openspec\/config.yaml` 读取 `apply.incrementalCheck`/);
    });

    it('命令运行时判定且不固化本项目命令', () => {
        const main = allSkills.find(({ template }) => template.name === 'iagent_spec_apply')?.template.instructions ?? '';
        expect(main).toContain('构建描述符');
        expect(main).toContain('MUST NOT 把本项目命令固化为唯一命令');
        expect(main).toContain('MUST NOT 用 `npm run build` 当万能回退');
        // 主文件 MUST NOT 固化本仓库命令（细则文件中的描述符矩阵属允许形态）
        expect(main).not.toContain('node build.js');
    });

    it('显式命令优先且 monorepo 按描述符归组、去重后逐条执行', () => {
        expect(apply).toContain('`compileCheck.command` 非空 → 直接使用，不追加任何探测命令');
        expect(apply).toContain('monorepo 按描述符归组、去重后逐条执行');
        // 逐条执行时命令 / 退出码 / 范围分别记录
        expect(apply).toContain('`command` / `exitCode` / `scope`');
    });

    it('描述符矩阵覆盖非本仓库生态（pom / lockfile / tsconfig）', () => {
        for (const row of [
            '`pom.xml` | `mvn compile -DskipTests`',
            '`tsc --noEmit`',
            '`pnpm-lock.yaml` | `pnpm run build`',
            '`package-lock.json` | `npm run build`',
            '`yarn.lock` | `yarn build`',
        ]) {
            expect(apply, `描述符矩阵缺少 ${row}`).toContain(row);
        }
    });

    it('超时与缺依赖计为失败，MUST NOT 归为 not-applicable', () => {
        expect(apply).toContain('命令超时、依赖未安装');
        expect(apply).toContain('command not found');
        expect(apply).toContain('缺 `node_modules`');
        expect(apply).toContain('一律计为失败');
        expect(apply).toContain('MUST NOT 归类为 `not-applicable`');
    });

    it('重试耗尽后暂停：不进入测试门、不给归档建议', () => {
        expect(apply).toContain('MUST NOT 进入 Step 9');
        expect(apply).toContain('MUST NOT 给出归档建议');
        expect(apply).toContain('含 `file:line`');
    });

    it('旧配置位置只读一次 WARN 且不合并 / 不回退', () => {
        expect(apply).toContain('只读一次并 WARN');
        expect(apply).toContain('MUST NOT 在两文件间合并或回退');
    });

    it('autoFix=false 首次失败即 fail；lint / 前端辅助项保留', () => {
        expect(apply).toContain('`autoFix=false` 时**首次失败即**');
        expect(apply).toContain('辅助检查');
        expect(apply).toContain('lint');
        expect(apply).toContain('前端校验');
        expect(apply).toContain('SHALL NOT 参与四值终态');
    });

    it('描述符矩阵 ↔ allowedTools 一致性（每类编译命令均有授权）', () => {
        const entry = allSkills.find(({ template }) => template.name === 'iagent_spec_apply');
        expect(entry).toBeDefined();
        const tools = (entry?.template.allowedTools ?? '').split(',').map((item) => item.trim());
        const detail =
            (entry?.template.references ?? []).find((ref) => ref.path === 'references/compile-check.md')
                ?.content ?? '';

        // 双向校验：矩阵声明了该命令 ⇔ 白名单具备对应 Bash 授权
        const matrix: Array<[string, string]> = [
            ['pnpm run build', 'Bash(pnpm:*)'],
            ['npm run build', 'Bash(npm:*)'],
            ['yarn build', 'Bash(yarn:*)'],
            ['tsc --noEmit', 'Bash(tsc:*)'],
            ['node build.js', 'Bash(node:*)'],
            ['mvn compile -DskipTests', 'Bash(mvn:*)'],
            ['ant compile', 'Bash(ant:*)'],
            ['gradle compileJava', 'Bash(gradle:*)'],
            ['go build ./...', 'Bash(go:*)'],
            ['cargo build', 'Bash(cargo:*)'],
        ];
        for (const [command, allowed] of matrix) {
            expect(detail, `描述符矩阵缺少命令 ${command}`).toContain(command);
            expect(tools, `白名单缺少 ${allowed}（正文命令 ${command} 将无法执行）`).toContain(allowed);
        }
    });

    it('细则下沉 references/compile-check.md 且保留内联兜底', () => {
        expect(apply).toContain('references/compile-check.md');
        expect(apply).toContain('MUST 先 `Read` `references/compile-check.md`');
        expect(apply).toContain('MUST NOT 因此跳过编译检查');
    });
});

// 任务 2.11：spec-apply 编译证据契约与生命周期断言。
describe('2.11 spec-apply 编译证据', () => {
    const apply = skillCorpus('iagent_spec_apply');
    const refs = new Map(
        (getSkillTemplates().find(({ template }) => template.name === 'iagent_spec_apply')?.template.references ?? []).map(
            (ref) => [ref.path, ref.content]
        )
    );

    it('九个证据字段名齐全且每次执行一行', () => {
        for (const column of [
            'change',
            'command',
            'exitCode',
            'errorCount',
            'fixedCount',
            'status',
            'scope',
            'timestamp',
            'reason',
        ]) {
            expect(apply, `证据缺少字段 ${column}`).toContain(`\`${column}\``);
        }
        expect(apply).toContain('.openspec-tmp/pipeline-<change-name>/compile-report.md');
        expect(apply).toContain('每次执行一行');
    });

    it('summary 汇总行与「任一 fail → fail」优先级', () => {
        expect(apply).toContain('**summary**: status=<...>');
        expect(apply).toContain('任一命令行 `fail` → `fail`');
        expect(apply).toContain('零命令时只能是 `not-applicable` 或 `disabled`');
    });

    it('非执行终态使用固定占位（- / 0）且不得留空或 N/A', () => {
        expect(apply).toContain('记 `-`');
        expect(apply).toContain('`errorCount` / `fixedCount` 记 `0`');
        expect(apply).toContain('MUST NOT 留空');
        expect(apply).toContain('`N/A`');
    });

    it('非执行终态的 reason 使用固定文案（不适用 / 显式禁用）', () => {
        expect(apply).toContain('`reason` 分别写');
        expect(apply).toContain('未探测到可编译产物');
        expect(apply).toContain('项目级显式禁用');
    });

    it('handoff 包追加 compile 行且使用编译四值（非回执状态）', () => {
        expect(apply).toContain('| compile | <编译四值> | <证据路径> | <nextAllowed> |');
        expect(apply).toContain('该行 status 使用编译四值');
        expect(apply).toContain('MUST NOT 写成回执状态');
    });

    it('四终态均写证据；Step 10 保留证据与 handoff 包至归档收尾', () => {
        expect(apply).toContain('四终态均须产出');
        expect(apply).toContain('统一临时工作区清理（保留编译证据与 handoff 包）');
        expect(apply).toContain('MUST 保留');
        expect(apply).toContain('compile-report.md');
        expect(apply).toContain('handoff-pack.md');
        expect(apply).toContain('父流程归档收尾');
        expect(apply).toContain('清理对象**只限临时脚本与草稿**');
        // 独立调用不得强制删除，须报告证据路径
        expect(apply).toContain('**独立调用（无父流程）**');
        expect(apply).toContain('在完成摘要中报告证据文件路径');
    });

    it('references 含证据模板与终态判定表', () => {
        const detail = refs.get('references/compile-check.md') ?? '';
        expect(detail).toContain('**summary**: status=');
        // 九列固定表头（父流程按固定列解析）
        expect(detail).toContain(
            '| change | command | exitCode | errorCount | fixedCount | status | scope | timestamp | reason |'
        );
        expect(detail).toContain('终态判定表');
        expect(detail).toContain('monorepo 归组与去重');
    });
});

// 任务 3.3：父流程编译证据就绪检查（只读、不执行编译、不扩权限）。
describe('3.3 父流程编译证据就绪检查', () => {
    const PARENTS = ['iagent_workflow', 'iagent_auto_workflow'];

    it('两端均读取证据文件与 summary 行，含放行/阻断判定', () => {
        for (const name of PARENTS) {
            const body = skillCorpus(name);
            expect(body, `${name} 未读取证据路径`).toContain(
                '.openspec-tmp/pipeline-<change-name>/compile-report.md'
            );
            expect(body, `${name} 未读取汇总行`).toContain('**summary**:');
            expect(body, `${name} 未声明放行集合`).toContain('{pass, not-applicable, disabled}');
            expect(body, `${name} 未声明阻断条件`).toMatch(/status=fail/);
            expect(body, `${name} 未声明证据缺失阻断`).toMatch(/证据缺失|missing/);
        }
    });

    it('not-applicable / disabled 记 WARN 且不得写成「编译检查通过」', () => {
        for (const name of PARENTS) {
            const body = skillCorpus(name);
            expect(body, `${name} 缺少 WARN 措辞`).toContain('未执行编译检查');
            expect(body, `${name} 允许写成「编译检查通过」`).toContain('MUST NOT 表述为「编译检查通过」');
        }
    });

    it('不可解析等同缺失（不得因文件存在就放行）', () => {
        for (const name of PARENTS) {
            const body = skillCorpus(name);
            expect(body, `${name} 未声明不可解析的处理`).toMatch(/无法解析(出汇总状态)?/);
        }
    });

    it('父流程不执行编译也不扩权限', () => {
        const auto = getSkillTemplates().find(({ template }) => template.name === 'iagent_auto_workflow');
        expect(auto?.template.allowedTools).not.toContain('Bash(tsc:*)');
        for (const name of PARENTS) {
            const body = skillCorpus(name);
            expect(body, `${name} 未声明不自行编译`).toContain('MUST NOT 自行执行编译');
        }
    });

    it('均不含已移除的归档写入描述', () => {
        for (const name of PARENTS) {
            const body = skillCorpus(name);
            expect(body, `${name} 残留 4.8 引用`).not.toContain('4.8');
            expect(body, `${name} 残留 devdocs 迁移描述`).not.toContain('迁移至 devdocs');
        }
    });

    it('workflow 不含已移除的归档分流语义（仅保留否定式声明）', () => {
        const body = skillCorpus('iagent_workflow');
        // 旧的「文件存在优先 / 状态裁决缺失分支 / 兼容生成」正向结论零命中
        expect(body).not.toContain('archive 以文件存在优先');
        expect(body).not.toContain('状态裁决缺失分支，不因新会话');
        expect(body).not.toContain('兼容生成');
        // 新语义：不再传递 / 读取 / 报告需求文档状态
        expect(body).not.toContain('仅把它当作报告输入');
        expect(body).toContain('MUST NOT 传已移除的需求文档状态字段');
        expect(body).toContain('需求文档桥已整体移除');
    });

    it('编译终态与回执状态词汇不混用', () => {
        const apply = skillCorpus('iagent_spec_apply');
        expect(apply).toContain('编译四值');
        expect(apply).toContain('MUST NOT 写成回执状态');
        for (const name of PARENTS) {
            expect(skillCorpus(name)).not.toMatch(/status=ok 即视为编译/);
        }
    });

    it('编译失败沿用既有暂停语义', () => {
        const workflowBody = skillCorpus('iagent_workflow');
        expect(workflowBody).toContain('阻断归档并回到 Phase 4');
        const autoBody = skillCorpus('iagent_auto_workflow');
        expect(autoBody).toContain('MUST NOT 自动归档');
        expect(autoBody).toContain('暂停并向用户报告');
    });
});

// 任务 7.1：debug 仅共享 compileCheck 的 enabled 与缺省启用语义（字段作用域声明）。
describe('7.1 debug 共享编译检查缺省语义与作用域声明', () => {
    const debug = skillCorpus('iagent_debug');

    it('载体为 .iagent/config.yaml 且缺省启用（不再出现「默认禁用」）', () => {
        expect(debug).toContain('.iagent/config.yaml');
        expect(debug).toContain('compileCheck');
        expect(debug).toContain('缺省启用');
        expect(debug).not.toContain('默认禁用');
    });

    it('两技能均声明字段作用域：仅 enabled 与缺省语义共享', () => {
        // debug 侧显式声明不消费 command / timeoutMs / maxRetries / autoFix / incremental
        expect(debug).toContain('仅约束 `iagent_spec_apply`');
        expect(debug).toContain('只共享 `enabled`');
        // apply 侧同一口径（细则段声明仅约束本技能）
        expect(skillCorpus('iagent_spec_apply')).toContain('仅约束本技能');
    });
});

// 任务 5.6：spec-bulk-archive 归档只读与只读报告断言。
describe('5.6 spec-bulk-archive 归档只读', () => {
    const bulk = skillCorpus('iagent_spec_bulk_archive');
    const a6Start = bulk.indexOf('a.6 **（已移除）**');
    const a6 = bulk.slice(a6Start, bulk.indexOf('b. **执行归档**'));
    const b5 = bulk.slice(bulk.indexOf('b.5 **探索记忆同步**'), bulk.indexOf('c. **归档只读校验'));

    it('a.6 已移除：无只读报告、无写入分支、无生成技能委派', () => {
        expect(a6Start).toBeGreaterThanOrEqual(0);
        expect(a6).toContain('整体移除');
        expect(a6).toContain('不再读取');
        expect(a6).not.toContain('需求文档：已存在（未改写）');
        expect(a6).not.toContain('需求文档：缺失');
        expect(a6).not.toContain('in-place');
        expect(a6).not.toMatch(/委派 `iagent_requirement_doc` 技能/);
        expect(a6).not.toContain('MUST NOT 中止该变更单元');
    });

    it('b.5 仅保留探索记忆同步（不再迁出 devdocs）', () => {
        expect(b5).toContain('探索记忆同步');
        // 缺失探索文件 / 无 delta spec 时记录日志并继续（不中止批次）
        expect(b5).toContain('跳过探索记忆同步：无探索文件');
        expect(b5).toContain('无 delta spec');
        expect(b5).not.toContain('devdocs');
        expect(b5).not.toContain('需求文档迁移');
    });

    it('10.g 结构损坏只追加不重建', () => {
        const g = bulk.slice(bulk.indexOf('g. **损坏索引文件的处置'), bulk.indexOf('h. **跳过失败与已跳过的变更**'));
        expect(g).toContain('保留原文');
        expect(g).toContain('仅追加本批成功变更的最小条目');
        expect(g).toContain('MUST NOT 全量重建');
        expect(g).toContain('提示人工修复');
        expect(g).not.toContain('重建该文件');
        expect(bulk).not.toContain('用正确结构重建');
    });

    it('完整单元序列顺序固定（a → a.5 → a.6 → b → b.5 → c → d）', () => {
        const STEPS = [
            'a. **同步规格**',
            'a.5 **CONTEXT.md 同步',
            'a.6 **（已移除）**',
            'b. **执行归档**',
            'b.5 **探索记忆同步**',
            'c. **归档只读校验 + 流程级工作区清理**',
            'd. **记录结果**',
        ];
        const positions = STEPS.map((step) => bulk.indexOf(step));
        STEPS.forEach((step, index) => {
            expect(positions[index], `缺少步骤「${step}」`).toBeGreaterThanOrEqual(0);
        });
        // 七个不同位置（防止同一处文本被重复计为多个步骤）
        expect(new Set(positions).size).toBe(STEPS.length);
        expect(positions).toEqual([...positions].sort((left, right) => left - right));
    });

    it('只读护栏 + c 步只读校验 + 单元清理存在', () => {
        expect(bulk).toContain('**归档只读**');
        expect(bulk).toContain('MUST NOT 修改 `openspec/changes/archive/`');
        expect(bulk).toContain('c. **归档只读校验 + 流程级工作区清理**');
        expect(bulk).toContain('单元成功后清理流程级工作区');
        expect(bulk).toContain('失败或跳过的单元保留工作区');
        expect(bulk).toContain('node -e "fs.rmSync(');
        // 越界告警不中止批次，也不静默忽略
        expect(bulk).toContain('记录含变更名与路径的 WARN');
        expect(bulk).toContain('MUST NOT 中止整批');
        expect(bulk).toContain('MUST NOT 静默忽略');
    });

    it('MODIFIED 目标在主 spec 缺失时按 ADDED 追加并告警（与单变更同义）', () => {
        expect(bulk).toContain('目标需求标识在主 spec 中缺失');
        expect(bulk).toContain('按 ADDED 追加该需求');
        expect(bulk).toContain('MODIFIED 目标缺失（已追加）');
        expect(bulk).toContain('MUST NOT 中止该变更单元或整批');
        expect(bulk).toContain('MUST NOT 丢弃该需求');
    });

    it('摘要模板含只读校验与清理结果', () => {
        expect(bulk).toContain('Archive read-only check');
        expect(bulk).toContain('Pipeline workspace cleanup');
        // 需求文档报告已移除：摘要模板不再含该行
        expect(bulk).not.toContain('Requirement document report');
    });

    it('SUBAGENT_DISPATCH 保留（批量并行仍属子代理派发）', () => {
        const template = getSkillTemplates().find(({ template }) => template.name === 'iagent_spec_bulk_archive')
            ?.template;
        const entries = (template?.allowedTools ?? '').split(',').map((entry) => entry.trim());
        expect(entries).toContain('Agent');
        expect(entries).toContain('Task');
    });
});


// 任务 3.5：spec-apply 既有实现流程回归（MODIFIED 需求整体重写后逐条守护）。
describe('3.5 spec-apply 既有实现流程回归', () => {
    const apply = skillCorpus('iagent_spec_apply');

    it('设计确认门（批次计划 + 显式确认）', () => {
        expect(apply).toContain('设计确认');
        expect(apply).toMatch(/批次计划|批计划/);
        expect(apply).toContain('确认');
    });

    it('任务上下文获取（优先 CLI，失败降级直接读变更目录）', () => {
        expect(apply).toContain('iagent spec instructions apply --change');
        expect(apply).toContain('contextFiles');
        expect(apply).toContain('降级');
    });

    it('任务勾选推进（完整实现才勾选）', () => {
        expect(apply).toContain('以 tasks.md 的勾选框为唯一权威');
        expect(apply).toContain('部分实现或延后实现 SHALL NOT 勾选');
    });

    it('scope-creep 防护（表面化并同步制品）', () => {
        expect(apply).toContain('范围蔓延护栏');
        expect(apply).toContain('MUST 先更新 proposal/specs/design');
    });

    it('编译检查（硬门：配置载体 + 终态四值 + 自动修复上限）', () => {
        expect(apply).toContain('编译检查阶段');
        expect(apply).toContain('.iagent/config.yaml');
        for (const status of ['`pass`', '`fail`', '`not-applicable`', '`disabled`']) {
            expect(apply, `缺少终态 ${status}`).toContain(status);
        }
        expect(apply).toMatch(/最多 `maxRetries` 次（默认 3）/);
    });

    it('[测试] 任务委派 iagent_test，不另立测试规则', () => {
        expect(apply).toContain('MUST 委派 `iagent_test`');
        expect(apply).toContain('MUST NOT 在 apply 内另立一套测试规则');
    });

    it('[测试] 任务不按补充文档路由（不走 attachments）', () => {
        expect(apply).toContain('MUST NOT 走 `产出:` → `attachments/` 规则');
        expect(apply).toContain('`[测试]` 任务 MUST NOT 当作补充文档处理');
    });

    it('未标注任务仍按代码实现处理', () => {
        expect(apply).toContain('带 `[代码]` 标签或无标签的任务');
    });

    it('测试执行关卡运行变更范围', () => {
        expect(apply).toContain('测试执行门');
        expect(apply).toContain('变更范围');
    });

    it('存量失败不阻塞 / 变更范围失败处置', () => {
        expect(apply).toContain('变更范围外的存量失败');
        expect(apply).toContain('范围内失败处理');
        expect(apply).toContain('MUST NOT 把对应任务标为 `[x]`');
    });

    it('无测试框架时降级为 WARN 不阻塞', () => {
        expect(apply).toContain('未探测到测试框架');
        expect(apply).toContain('跳过本门并继续（非阻塞）');
    });

    it('测试任务与实现任务的依赖串行', () => {
        expect(apply).toContain('MUST NOT 与其实现任务并发运行');
    });

    it('完成段精确暂存提案制品（不 commit、不全量添加）', () => {
        expect(apply).toContain('提案制品精确暂存');
        expect(apply).toContain('MUST NOT 执行 `git commit`');
        expect(apply).toContain('MUST NOT 使用 `git add -A`');
        expect(apply).toContain('提案: <change-name>');
    });

    it('实现阶段阻塞门仍为单门（唯一设计确认门）', () => {
        // 门预算的跨技能断言在 4.6（workflow 正文）；本技能只保留单一设计确认门
        expect(apply).toContain('设计确认');
        expect(apply).toContain('auto-mode');
    });
});

// 任务 4.6：编排技能门白名单与直通句（DEC-5）。
describe('4.6 编排技能门白名单与直通句', () => {
    /** 需引入门白名单段的编排 / 阶段技能（与 workflow-suite-skills 需求一致） */
    const GATE_SKILLS = [
        'iagent_workflow',
        'iagent_auto_workflow',
        'iagent_debug',
        'iagent_migration',
        'iagent_spec_explore',
        'iagent_spec_propose',
        'iagent_spec_apply',
        'iagent_spec_verify',
        'iagent_spec_verify_proposal',
        'iagent_spec_archive',
        'iagent_spec_bulk_archive',
    ];

    it('每个编排技能正文含 5 类必留门文本（由 GATE_WHITELIST 渲染）', () => {
        expect(GATE_WHITELIST.length).toBe(5);
        for (const name of GATE_SKILLS) {
            const body = skillCorpus(name);
            for (const entry of GATE_WHITELIST) {
                expect(body, `${name} 缺少必留门 ${entry.id}`).toContain(`**${entry.label}**`);
            }
        }
    });

    it('负向清单齐备（非门动作 + 只读校验询问 + 索引退役声明）', () => {
        for (const name of GATE_SKILLS) {
            const body = skillCorpus(name);
            expect(body, `${name} 缺少负向清单`).toContain('MUST NOT 请求确认');
            for (const item of GATE_MUST_NOT_CONFIRM_ITEMS) {
                expect(body, `${name} 缺少负向项「${item.slice(0, 20)}」`).toContain(item);
            }
            expect(body).toContain('索引');
            expect(body).toContain('退役');
        }
    });

    it('workflow 四处阶段委派点含直通句（不停顿、不宣告、不向用户提问）', () => {
        const body = skillCorpus('iagent_workflow');
        const passes = body.match(/本阶段立即开始 —— 不停顿、不宣告、不向用户提问/g) ?? [];
        expect(passes.length).toBeGreaterThanOrEqual(4);
        expect(body).toContain('不停顿');
        expect(body).toContain('不宣告');
    });

    it('不含自造门句式（是否调用某技能 / 是否继续 / 是否开始阶段）', () => {
        for (const name of GATE_SKILLS) {
            const body = skillCorpus(name);
            expect(body, `${name} 含自造门`).not.toMatch(/是否调用\s*`?(iagent_)?spec_apply/);
            expect(body, `${name} 含自造门`).not.toMatch(/是否继续/);
            expect(body, `${name} 含自造门`).not.toMatch(/是否开始阶段/);
        }
    });

    // workflow-suite-skills / 「编排技能门白名单与直通句」：只读校验直接执行，不再以「是否运行 … 校验？」询问。
    it('只读校验询问无具体校验名（仅保留 <校验> 占位负向示例）', () => {
        for (const name of GATE_SKILLS) {
            const body = skillCorpus(name);
            const tails = [...body.matchAll(/是否运行([^「」\n]*)/g)].map((match) => match[1]);
            // 负向清单中的占位示例仍在（非空证明：不是「一个都没匹配」的恒真断言）
            expect(tails.length, `${name} 缺少只读校验负向项`).toBeGreaterThan(0);
            for (const tail of tails) {
                expect(tail.startsWith(' <校验>'), `${name} 出现具体校验询问：是否运行${tail}`).toBe(true);
            }
            // 具体询问句式（真实校验名 + 问号）零命中
            expect(body, `${name} 含具体只读校验询问`).not.toMatch(/是否运行(?!\s*<校验>)[^\n？]*校验？/);
        }
    });

    it('门协议不弱化（硬停止语义仍在）', () => {
        const body = skillCorpus('iagent_workflow');
        expect(body).toContain('本次响应到此结束');
        expect(body).toContain('非门动作 MUST NOT 停止');
    });

    it('门预算：实现阶段仍为单一阻塞门', () => {
        const body = skillCorpus('iagent_workflow');
        expect(body).toContain('实现 + 测试桥（强制停止，单一阻塞门）');
        expect((body.match(/⛔ GATE: 实现 \+ 测试桥/g) ?? []).length).toBe(1);
    });
});

// 任务 4.1 / 4.9：门协议导言与只读校验询问收口。
describe('4.1 / 4.9 门协议导言与只读校验收口', () => {
    it('PREAMBLE 仍含硬停止语义与负向边界句', () => {
        const body = skillCorpus('iagent_workflow');
        expect(body).toContain('本次响应到此结束');
        expect(body).toContain('非门动作 MUST NOT 停止');
    });

    it('分层方向：协议层不 import 模板层', () => {
        const protocolFile = fileURLToPath(
            new URL('../src/core/host-orchestration/protocol.ts', import.meta.url)
        );
        const workflowsFile = fileURLToPath(
            new URL('../src/core/host-orchestration/workflows.ts', import.meta.url)
        );
        for (const file of [protocolFile, workflowsFile]) {
            const source = fs.readFileSync(file, 'utf8');
            expect(source).not.toContain("from '../templates/");
            expect(source).not.toContain('templates/');
        }
    });

    it('只读校验询问已收口（全模板零「是否运行技术栈专项校验」）', () => {
        const bodies = [
            ...getSkillTemplates().flatMap(({ template }) => [
                template.name,
                template.instructions,
                ...(template.references ?? []).map((ref) => ref.content),
            ]),
            ...getCommandTemplates().map(({ template }) => template.content),
        ].join('\n');
        expect(bodies).not.toContain('是否运行技术栈专项校验');
        expect(bodies).toContain('直接执行技术栈专项校验');
    });
});

// 任务 7.7：归档步骤序回归（无 reindex / daemon 感知同步）。
describe('7.7 归档步骤序回归', () => {
    const archive = skillCorpus('iagent_spec_archive');
    const bulk = skillCorpus('iagent_spec_bulk_archive');

    it('归档不含索引重建（零 reindex / 零索引重建步骤）', () => {
        for (const body of [archive, bulk]) {
            expect(body).not.toContain('reindex');
            expect(body).toContain('不含任何索引重建');
        }
    });

    it('daemon 活跃 → 不同步也不解锁（两技能）', () => {
        for (const body of [archive, bulk]) {
            expect(body).toContain('daemon 存活');
            expect(body).toContain('MUST NOT 执行 `codegraph sync`');
            expect(body).toContain('MUST NOT 执行 `codegraph unlock`');
        }
    });

    it('无 daemon → 按需同步一次（两技能）', () => {
        for (const body of [archive, bulk]) {
            expect(body).toContain('确认无 daemon');
            expect(body).toMatch(/恰(好)?一次/);
        }
    });

    it('锁阶梯写入协议单一源（两技能引用同一常量渲染）', () => {
        for (const body of [archive, bulk]) {
            expect(body).toContain('writer.pid');
            expect(body).toContain('ready:false');
            expect(body).toContain('不可判定 = 存活');
        }
    });
});

// spec-workflow-skills / 「spec-archive 归档技能」：归档步骤序（探索记忆同步 →
// 需求文档只读报告已移除 → 目录迁移 → ARCHIVE-INDEX）。顺序是协议约束，故断言文本相对位置。
describe('7.7 归档步骤序（探索记忆同步 → 需求文档报告已移除 → 目录迁移 → ARCHIVE-INDEX）', () => {
    const STEPS = [
        '4.7 **归档前探索记忆同步',
        '4.8 **（已移除）**',
        '5. **执行归档**',
        '7. **更新分片归档索引（月度纯追加 + 根入口维护）**',
    ];

    it('技能版与指令版正文的相对位置一致且严格递增', () => {
        const command = getCommandTemplates().find((entry) => entry.id === 'spec-archive');
        expect(command, 'spec-archive 指令未注册').toBeDefined();

        for (const body of [skillCorpus('iagent_spec_archive'), command?.template.content ?? '']) {
            const positions = STEPS.map((step) => body.indexOf(step));
            STEPS.forEach((step, index) => {
                expect(positions[index], `缺少步骤「${step}」`).toBeGreaterThanOrEqual(0);
            });
            // 四个不同位置（防止同一处文本被重复计为多个步骤）
            expect(new Set(positions).size).toBe(STEPS.length);
            expect(positions).toEqual([...positions].sort((left, right) => left - right));
        }
    });

    it('目录迁移位于两个检查点之后、ARCHIVE-INDEX 之前（顺序约束语义）', () => {
        const body = skillCorpus('iagent_spec_archive');
        const move = body.indexOf('把 `changeRoot` 移动到');

        expect(move).toBeGreaterThan(body.indexOf('4.7 **归档前探索记忆同步'));
        expect(move).toBeGreaterThan(body.indexOf('4.8 **（已移除）**'));
        expect(move).toBeLessThan(body.indexOf('7. **更新分片归档索引（月度纯追加 + 根入口维护）**'));
        // 探索记忆同步仍是移动前的强制检查点；需求文档只读报告已移除
        expect(body).toContain('系统 MUST 在移动变更目录前完成探索记忆同步');
        expect(body).not.toContain('系统 MUST 在移动变更目录前完成需求文档只读报告');
    });
});

// ── improve-archive-index-monthly：分片归档索引（根入口 + 月度索引）──
describe('分片归档索引：spec-archive 月度落点与根入口边界', () => {
    const archive = skillCorpus('iagent_spec_archive');

    it('月份落点取自归档目录名前 7 位（不读本地时间、不做时区换算）', () => {
        expect(archive).toContain('ARCHIVE-INDEX-YYYY-MM.md');
        expect(archive).toContain('月份 MUST 取自归档目录名');
        expect(archive).toContain('MUST NOT 读取本地时间');
        expect(archive).toContain('MUST NOT 做时区换算');
        expect(archive).toContain('回退为本次归档日期所在月');
    });

    it('月度索引创建 / 纯追加 / 损坏只追加不重建', () => {
        expect(archive).toContain('月度索引维护（强制，纯追加）');
        expect(archive).toContain('不存在时 SHALL 按标准结构创建');
        expect(archive).toContain('仅向「归档变更列表」表末追加本批条目');
        expect(archive).toContain('月度索引损坏处置（强制，纯追加不重建）');
        expect(archive).toContain('保留原文');
        expect(archive).toContain('仅追加本批最小条目');
        expect(archive).toContain('MUST NOT 丢弃既有历史条目');
    });

    it('根入口只更新月份链接与全局统计（不改写既有条目、缺失重建、损坏只补链接）', () => {
        expect(archive).toContain('根入口维护（强制，只更新链接与统计）');
        expect(archive).toContain('追加缺失的当月月份链接');
        expect(archive).toContain('确定性重算');
        expect(archive).toContain('MUST NOT 使用增量累加');
        expect(archive).toContain('MUST NOT 改写既有月度条目与既有条目文本');
        expect(archive).toContain('根入口缺失但存在月度文件时 SHALL 依据月度文件重建入口');
        expect(archive).toContain('根入口损坏时 SHALL 保留原文 + 只补缺失月份链接');
        expect(archive).toContain('已存在则跳过');
    });

    it('写入面 / 只读例外 / 失败不入索引 / 摘要措辞同步', () => {
        expect(archive).toContain('归档写入面（强制）');
        expect(archive).toContain('失败与跳过不入索引（强制）');
        expect(archive).toContain('月度索引 `ARCHIVE-INDEX-YYYY-MM.md` 的**追加**是显式例外');
        expect(archive).toContain('任何索引文件 MUST NOT 全量重建');
        expect(archive).toContain('根入口月份链接与全局统计维护结果');
        // 不得残留单一文件全量追加的旧表述
        expect(archive).not.toContain('更新或创建 ARCHIVE-INDEX.md');
    });
});

describe('分片归档索引：spec-bulk-archive 跨月分组与单点更新', () => {
    const bulk = skillCorpus('iagent_spec_bulk_archive');

    it('跨月分组：按成功变更归档目录名前 7 位分别写入各自月度文件', () => {
        expect(bulk).toContain('按月份分组（强制）');
        expect(bulk).toContain('月份 MUST 取其归档目录名');
        expect(bulk).toContain('分别写入各自月度文件');
        expect(bulk).not.toContain('归档索引文件位于 `openspec/changes/archive/ARCHIVE-INDEX.md`。');
    });

    it('根入口单点更新、统计确定性重算、失败不入索引、损坏只追加', () => {
        expect(bulk).toContain('子代理 MUST NOT 向任何索引文件写入');
        expect(bulk).toContain('根入口维护（强制，单点）');
        expect(bulk).toContain('确定性重算');
        expect(bulk).toContain('MUST NOT 使用增量累加');
        expect(bulk).toContain('failed/skipped 变更 MUST NOT 入索引');
        expect(bulk).toContain('任何索引文件 MUST NOT 全量重建');
        expect(bulk).toContain('若月度索引或根入口存在但结构已损坏');
        expect(bulk).toContain('先完成全部月度索引的创建/追加，再单点更新一次根入口');
        expect(bulk).toContain('Archive index summary');
    });
});

describe('编排技能归档阶段引用分片归档索引协议', () => {
    it('workflow 含根入口 + 月度索引两部分表述且不复述协议', () => {
        const workflow = skillCorpus('iagent_workflow');
        expect(workflow).toContain('根入口 `ARCHIVE-INDEX.md` 的月份导航 + 全局模块统计');
        expect(workflow).toContain('当月月度索引 `ARCHIVE-INDEX-YYYY-MM.md` 的纯追加');
        expect(workflow).not.toContain('ARCHIVE-INDEX.md 纯追加');
        expect(workflow).not.toMatch(/月份 MUST 取|确定性重算|按标准结构创建/);
    });

    it('auto-workflow 自动归档阶段含两部分表述且不重复声明协议', () => {
        const auto = skillCorpus('iagent_auto_workflow');
        expect(auto).toContain('根入口 `ARCHIVE-INDEX.md` 的月份导航 + 全局模块统计');
        expect(auto).toContain('当月月度索引 `ARCHIVE-INDEX-YYYY-MM.md` 的纯追加');
        expect(auto).toContain('本技能 MUST NOT 重复声明或内联该协议正文');
        expect(auto).not.toMatch(/月份 MUST 取|确定性重算|按标准结构创建/);
    });

    it('debug 不写索引且归档逻辑不变', () => {
        const debug = skillCorpus('iagent_debug');
        expect(debug).not.toContain('ARCHIVE-INDEX');
        expect(debug).toContain('归档只读');
        expect(debug).toContain('/iagent:spec-archive');
    });
});

// ── improve-proposal-validation-and-spec-ref：D3 追溯规范形态 / D9a 起草循环 / D9b 路径字段 ──
describe('提案链路契约：D3 规范形态与 D9b 路径字段', () => {
    /** 取技能正文（缺失即失败，避免静默跳过） */
    function bodyOf(commandId: string): string {
        const entry = allSkills.find((item) => item.commandId === commandId);
        expect(entry, `技能模板缺失：${commandId}`).toBeDefined();
        return entry!.template.instructions;
    }

    it('spec-propose 起草循环以 instructions apply 初检与终检，无独立 status --json', () => {
        const body = bodyOf('spec-propose');
        expect(body).not.toContain('iagent spec status --change "<name>" --json');
        expect(body).toContain('iagent spec instructions apply --change "<name>" --json');
        expect(body).toContain('初检');
        expect(body).toContain('strict 终检');
        expect(body).toContain('--partial');
    });

    it('spec-propose 允许并行起草且声明 design 可选', () => {
        const body = bodyOf('spec-propose');
        expect(body).toContain('可并行起草');
        expect(body).toContain('design 可选');
        expect(body).toContain('optional');
    });

    it('spec-propose 路径字段来自 CLI（changeRoot / planningHome / artifactPaths / resolvedOutputPath）', () => {
        const body = bodyOf('spec-propose');
        for (const field of ['changeRoot', 'planningHome', 'artifactPaths', 'resolvedOutputPath']) {
            expect(body, `缺少路径字段 ${field}`).toContain(field);
        }
        expect(body).not.toContain('actionContext');
    });

    it('src 内 actionContext 已彻底清除（含 workspace 护栏句）', () => {
        const offenders: string[] = [];
        const walk = (dir: string): void => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const entryPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(entryPath);
                } else if (entry.isFile() && entry.name.endsWith('.ts')) {
                    if (fs.readFileSync(entryPath, 'utf8').includes('actionContext')) {
                        offenders.push(path.relative(process.cwd(), entryPath));
                    }
                }
            }
        };
        walk(path.join(process.cwd(), 'src'));
        expect(offenders).toEqual([]);
    });

    it('spec-verify-proposal 的 D3 声明规范形态与 capability-only 反例', () => {
        const body = bodyOf('spec-verify-proposal');
        expect(body).toContain('Spec Ref = <capability> / <Requirement>');
        expect(body).toContain('Scenario Ref = <capability> / <Requirement> / <Scenario>');
        expect(body).toContain('缺少 Requirement');
        expect(body).toContain('不计覆盖');
        // 不再把维度定义散落到其它技能（唯一真源）
        expect(body).toContain('唯一真源');
    });

    it('spec-propose 的追溯契约与 D3 使用同一规范形态', () => {
        const body = bodyOf('spec-propose');
        expect(body).toContain('capability / Requirement / Scenario');
        expect(body).toContain('spec-ref-missing-requirement');
        expect(body).toContain('缺少 Requirement');
    });

    it('归档类技能声明 optional 制品不构成未完成', () => {
        for (const commandId of ['spec-archive']) {
            expect(bodyOf(commandId)).toContain('optional');
        }
    });
});

// ── feat-debug-dual-track-entry 覆盖缺口：轨道联合判定 / 证据门槛按状态分层 / 两轨共用标准 ──
describe('debug 双轨判定与证据门槛（缺口补齐）', () => {
    const debugMain =
        allSkills.find((s) => s.template.name === 'iagent_debug')?.template.instructions ?? '';

    it('轨道判定 MUST 联合两个信号，MUST NOT 只看 reproductionStatus', () => {
        expect(debugMain).toContain('MUST 联合两个信号');
        expect(debugMain).toContain('MUST NOT 只看其中一个');
        // 两个信号：提示词校验门的复现步骤维 + reproductionStatus
        const section = debugMain.slice(
            debugMain.indexOf('**默认轨道 = 复现优先。**'),
            debugMain.indexOf('### 1.1'),
        );
        expect(section).toContain('复现步骤 Repro');
        expect(section).toContain('reproductionStatus');
    });

    it('证据门槛按状态分层：not-reproduced / static-only 同一门槛，intermittent 另需可重复证据', () => {
        const start = debugMain.indexOf('**证据门槛**');
        expect(start).toBeGreaterThanOrEqual(0);
        const gate = debugMain.slice(start, debugMain.indexOf('**无证据出口**'));
        // 两类「无复现」状态并入同一硬证据门槛
        expect(gate).toContain('`not-reproduced` / `static-only` MUST 具备');
        expect(gate).toContain('`文件:行`');
        // 时好时坏另立要求：至少一条可重复证据 + 记录复现条件
        expect(gate).toContain('`intermittent`');
        expect(gate).toContain('至少一条**可重复**的证据');
        expect(gate).toContain('记录复现条件');
    });

    it('证据优先轨道启用条件为「无复现条件」且「有硬证据」同时满足', () => {
        const start = debugMain.indexOf('**启用条件（同时满足）**');
        expect(start).toBeGreaterThanOrEqual(0);
        const condition = debugMain.slice(start, debugMain.indexOf('**证据门槛**'));
        expect(condition).toContain('不存在可执行的复现条件');
        expect(condition).toContain('硬证据');
        expect(condition).toContain('文件:行');
    });

    it('两轨共用分级 / 2.4 合并包 / 回归口径，轨道只决定证据形态', () => {
        const start = debugMain.indexOf('两条轨道 MUST 共用');
        expect(start).toBeGreaterThanOrEqual(0);
        const shared = debugMain.slice(start, debugMain.indexOf('### 1.1'));
        for (const sharedItem of ['2.2.3.5', '2.4「诊断 + 方案」确认包', '4.2 回归测试口径']) {
            expect(shared, `两轨共用项缺失：${sharedItem}`).toContain(sharedItem);
        }
        expect(shared).toContain('轨道只决定证据形态');
        expect(shared).toContain('MUST NOT 改变排查与验收标准');
    });
});

// ---------------------------------------------------------------------------
// 变更 inline-orchestration-delegation / 任务 11.1 - 11.7
// auto-migration 执行方式：source-scan / Phase 4 内联，Phase 3 保留子代理，阈值降级。
// ---------------------------------------------------------------------------
describe('11.1-11.7 auto-migration 内联复查与上下文阈值', () => {
    const migration = skillCorpus('iagent_migration');

    it('11.1 Phase 4 内联复查修复循环（同上下文、带证据）', () => {
        expect(migration).toContain('主 agent 内联复查');
        expect(migration).toContain('内联复查');
        expect(migration).toContain('在同一上下文');
        expect(migration).toContain('文件:行');
        expect(migration).not.toContain('派发独立复查子代理');
    });

    it('11.2 上下文阈值降级（300 文件 / 15k 行 + WARN）', () => {
        expect(migration).toContain('300');
        expect(migration).toContain('15k');
        expect(migration).toContain('降级为子代理');
        expect(migration).toContain('WARN');
        expect(migration).toContain('上下文阈值');
    });

    it('11.3 Phase 3 保留子代理（apply 语义）', () => {
        expect(migration).toContain('每个派发单元一个子代理');
        expect(migration).toContain('Phase 3 实现保留子代理');
        expect(migration).toContain('语义等同 apply');
    });

    it('11.4 复查失败降级链（串行重试一次 → WARN 完成）', () => {
        expect(migration).toContain('串行重试一次');
        expect(migration).toContain('COMPLETE-WITH-WARNING');
    });

    it('11.5 蒸馏确认门阻断空清单（既有断言保留）', () => {
        expect(migration).toContain('清单**为空即阻断**');
        expect(migration).toContain('绝不允许带着空清单继续');
    });

    it('11.6 目标规范作为绑定约束（既有断言保留）', () => {
        expect(migration).toContain('## 目标项目规范要点');
        expect(migration).toContain('约束性');
    });

    it('11.7 CLI 降级生成（command-not-found 声明一次、不重试）', () => {
        expect(migration).toContain('command not found');
        expect(migration).toContain('流程中途不得重试 CLI 调用');
    });

    it('source-scan 内联且不派生扫描子代理', () => {
        expect(migration).toContain('source-scan 由主 agent 内联执行');
        expect(migration).toContain('MUST NOT 派生源扫描子代理');
    });
});
