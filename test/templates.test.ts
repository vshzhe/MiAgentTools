/**
 * 模板层测试：命名规范、9 类完整性、frontmatter 结构。
 */

import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs';
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

// 任务 2.12：spec-archive 需求文档检查点回归（改 CodeGraph 段时不得削弱既有状态分支）。
describe('2.12 spec-archive 需求文档检查点回归', () => {
    const archive = skillCorpus('iagent_spec_archive');

    it('跳过不补生成 / 已存在则对齐', () => {
        expect(archive).toContain('skipped-by-user');
        expect(archive).toContain('MUST NOT 调用 `iagent_requirement_doc`、MUST NOT 生成');
        expect(archive).toContain('就地增量对齐');
    });

    it('生成失败不重试 / 已生成缺失不重建', () => {
        expect(archive).toContain('generation-failed');
        expect(archive).toContain('MUST NOT 静默重试生成');
        expect(archive).toContain('generated');
        expect(archive).toContain('MUST NOT 重新生成');
    });

    it('读取失败不落入兼容生成（重试一次后停止）', () => {
        expect(archive).toContain('自动重试同一读取**一次**');
        expect(archive).toContain('MUST NOT 进入历史兼容生成分支');
    });

    it('历史无状态兼容（absent 分支）', () => {
        expect(archive).toContain('分支 E');
        expect(archive).toContain('非交互模式');
        expect(archive).toContain('`absent`');
    });

    it('人工域受保护（基本信息与评审记录逐字保留）', () => {
        expect(archive).toContain('人工域');
        expect(archive).toContain('逐字保留');
        expect(archive).toContain('## 八、评审记录');
    });

    it('单独调用读持久状态（文件存在性与状态同读）', () => {
        expect(archive).toContain('检查点同时读取**两件事**');
        expect(archive).toContain('文档文件存在 > 持久状态');
    });

    it('失败不阻断归档', () => {
        expect(archive).toContain('绝不因本检查点阻塞归档');
    });

    it('探索记忆同步与 delta 智能合并仍在', () => {
        expect(archive).toContain('探索记忆同步');
        expect(archive).toContain('ADDED/MODIFIED/REMOVED/RENAMED');
    });

    it('需求文档状态四值语义与 host-orchestration 一致', () => {
        for (const status of ['absent', 'skipped-by-user', 'generation-failed', 'generated']) {
            expect(archive).toContain(status);
        }
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

    it('编译检查（技术栈探测 + 自动修复上限 3 次）', () => {
        expect(apply).toContain('编译检查阶段');
        expect(apply).toContain('最多 3 次');
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
// 需求文档检查点 → 目录迁移 → ARCHIVE-INDEX）。顺序是协议约束，故断言文本相对位置。
describe('7.7 归档步骤序（探索记忆同步 → 需求文档检查点 → 目录迁移 → ARCHIVE-INDEX）', () => {
    const STEPS = [
        '4.7 **归档前探索记忆同步',
        '4.8 **归档前需求文档检查点',
        '5. **执行归档**',
        '7. **更新或创建 ARCHIVE-INDEX.md**',
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
        expect(move).toBeGreaterThan(body.indexOf('4.8 **归档前需求文档检查点'));
        expect(move).toBeLessThan(body.indexOf('7. **更新或创建 ARCHIVE-INDEX.md**'));
        // 两个检查点都显式声明「移动变更目录前」完成（顺序约束的正文依据）
        expect(body).toContain('系统 MUST 在移动变更目录前完成探索记忆同步');
        expect(body).toContain('系统 MUST 在移动变更目录前完成需求文档检查点');
    });
});
