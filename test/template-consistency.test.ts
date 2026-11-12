/**
 * 跨切面一致性回归锁（变更 improve-skill-orchestration-consistency）。
 *
 * 锁定四项不变量，防止同类漂移再次逃逸：
 *   1. 调用类白名单与正文委派双向一致（无幽灵条目、编排技能委派齐备）
 *   2. 门控导言单一源（字面量仅存于 prompt-gate.ts）
 *   3. references 无孤儿（声明即被正文引用）
 *   4. 提案验证维度契约唯一（无 D1-D6 / D1-D9 子集表述）
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getSkillTemplates, getCommandTemplates } from '../src/core/templates/index.js';

const WORKFLOWS_DIR = path.join(process.cwd(), 'src', 'core', 'templates', 'workflows');
const PROMPT_GATE_FILE = path.join(process.cwd(), 'src', 'core', 'templates', 'prompt-gate.ts');

const skills = getSkillTemplates();

function skillBody(name: string): string {
    const entry = skills.find((s) => s.template.name === name);
    if (!entry) {
        throw new Error(`技能模板缺失: ${name}`);
    }
    return entry.template.instructions;
}

describe('提案链路路径字段与起草状态来源（D9a / D9b）', () => {
    it('spec-propose 技能版与指令版均不引用 actionContext', () => {
        const skill = skillBody('iagent_spec_propose');
        const command = getCommandTemplates().find((entry) => entry.id === 'spec-propose');
        expect(command, 'spec-propose 指令未注册').toBeDefined();
        for (const content of [skill, command!.template.content]) {
            expect(content).not.toContain('actionContext');
        }
    });

    it('spec-propose 不把独立 status --json 当作起草期状态来源', () => {
        for (const content of [skillBody('iagent_spec_propose'), getCommandTemplates().find((entry) => entry.id === 'spec-propose')!.template.content]) {
            expect(content).not.toContain('iagent spec status --change "<name>" --json');
        }
    });
});

describe('调用类白名单与委派齐备', () => {
    it('每个 Skill(...) 条目在正文中被提及（无幽灵条目）', () => {
        const offenders: string[] = [];
        for (const { template } of skills) {
            for (const m of template.allowedTools.matchAll(/Skill\(([a-zA-Z0-9:-]+)\)/g)) {
                const canonical = m[1];
                const internal = `iagent_${canonical.replace(/^iagent-/, '').replaceAll('-', '_')}`;
                if (!template.instructions.includes(internal)) {
                    offenders.push(`${template.name}: Skill(${canonical}) 未在正文提及（${internal}）`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('auto-workflow 白名单含委派 apply/archive/verify/test', () => {
        const aw = skills.find((s) => s.template.name === 'iagent_auto_workflow');
        expect(aw).toBeDefined();
        for (const [bare, canonical] of [
            ['spec_apply', 'iagent-spec-apply'],
            ['spec_archive', 'iagent-spec-archive'],
            ['spec_verify', 'iagent-spec-verify'],
            ['test', 'iagent-test'],
        ] as const) {
            expect(aw?.template.allowedTools, `缺 Skill(${canonical})`).toContain(`Skill(${canonical})`);
            expect(aw?.template.instructions, `正文未提及 iagent_${bare}`).toContain(`iagent_${bare}`);
        }
    });

    it('auto-workflow 正文委派 apply/archive，无内联执行表述', () => {
        const body = skillBody('iagent_auto_workflow');
        expect(body).toContain('iagent_spec_apply');
        expect(body).toContain('iagent_spec_archive');
        expect(body).not.toContain('Execute the apply workflow logic');
        expect(body).not.toMatch(/execute the archive workflow logic/i);
        expect(body).not.toContain('MUST NOT define its own dispatch-instruction format');
    });

    it('workflow 正文无 stale inline generation 残留', () => {
        const body = skillBody('iagent_workflow');
        expect(body).not.toContain('inline generation for artifacts');
        expect(body).not.toContain('Executing inline artifact generation');
        expect(body).not.toContain('no Skill delegation');
        expect(body).not.toContain('Direct transition to inline generation');
    });
});

describe('门控导言单一源', () => {
    it('GATE PROTOCOL 字面量仅出现于 prompt-gate.ts', () => {
        const literal = 'GATE PROTOCOL — ACTIVE';
        const offenders = fs
            .readdirSync(WORKFLOWS_DIR)
            .filter((f) => f.endsWith('.ts'))
            .filter((f) => fs.readFileSync(path.join(WORKFLOWS_DIR, f), 'utf8').includes(literal));
        expect(offenders).toEqual([]);
        expect(fs.readFileSync(PROMPT_GATE_FILE, 'utf8')).toContain(literal);
    });
});

describe('references 无孤儿', () => {
    it('每个声明的 references 文件均被正文或同级 references 引用', () => {
        const offenders: string[] = [];
        for (const { template } of skills) {
            const refs = template.references ?? [];
            const corpus = template.instructions + '\n' + refs.map((r) => r.content).join('\n');
            for (const ref of refs) {
                if (!corpus.includes(ref.path)) {
                    offenders.push(`${template.name}: ${ref.path} 声明未引用`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });
});

describe('提案验证维度契约唯一', () => {
    it('全模板无 D1-D6 / D1-D9 子集表述', () => {
        const offenders: string[] = [];
        for (const { template } of skills) {
            if (/D1[-–]D6|D1[-–]D9/.test(template.instructions)) {
                offenders.push(`${template.name}: 含不一致的维度子集表述`);
            }
        }
        expect(offenders).toEqual([]);
    });

    it('spec-verify-proposal 持有唯一维度契约', () => {
        const body = skillBody('iagent_spec_verify_proposal');
        expect(body).toContain('D1-D5');
        expect(body).toContain('D6-D10');
    });
});

describe('指令正文派生覆盖度可观测', () => {
    it('全部 22 个模板均为 skill 单一源（deriveCommandContent）', () => {
        const derived = fs
            .readdirSync(WORKFLOWS_DIR)
            .filter((f) => f.endsWith('.ts'))
            .filter((f) => fs.readFileSync(path.join(WORKFLOWS_DIR, f), 'utf8').includes('deriveCommandContent'));
        expect(derived.length).toBe(22);
    });
});

// 变更 fix-multi-agent-skill-command-generation / 任务 1.3 / 1.4：
// frontmatter 元数据不含游离 version（产物版本由 metadata.generatedBy 承载）。
describe('frontmatter 元数据无游离 version', () => {
    it('全部 22 个技能模板的 metadata 不含 version 字段', () => {
        const offenders = skills
            .filter(({ template }) => template.metadata !== undefined && 'version' in template.metadata)
            .map(({ template }) => template.name);
        expect(offenders).toEqual([]);
    });
});

function exploreRefContent(relPath: string): string {
    const explore = skills.find((s) => s.template.name === 'iagent_spec_explore');
    const ref = (explore?.template.references ?? []).find((r) => r.path === relPath);
    return ref?.content ?? '';
}

describe('探索内容分层、门预算与门合并', () => {
    it('spec_explore 主文件声明门预算且 grill ≤2 批量轮次', () => {
        const body = skillBody('iagent_spec_explore');
        expect(body).toContain('门预算');
        expect(body).toMatch(/≤\s*2 批量轮次/);
        expect(body).toContain('默认直通');
    });

    it('grill 合并为 ≤2 批量确认且保留最低深度 L3', () => {
        const g = exploreRefContent('references/grill-playbook.md');
        expect(g).toContain('批量 1');
        expect(g).toContain('批量 2');
        expect(g).toContain('最低深度 L3');
        expect(g).not.toContain('NO multi-question batches');
    });

    it('grill 口径消解：收敛深度不限 + 批量轮数受 ≤2 批规则约束', () => {
        const g = exploreRefContent('references/grill-playbook.md');
        expect(g).toContain('收敛深度不限');
        expect(g).toContain('批量轮数受 ≤2 批规则约束（澄清门不计入流程级门预算）');
        expect(g).not.toContain('不设人为上限');
        expect(g).not.toContain('轮数不限');
        expect(g).toContain('MUST NOT 为此新增第三个用户确认轮次');
    });

    it('聚合一致性门默认直通且未被删除', () => {
        const proto = exploreRefContent('references/exploration-protocol.md');
        expect(proto).toContain('1.6.6');
        expect(proto).toContain('默认直通语义');
        expect(proto).toContain('硬冲突');
    });

    it('workflow 实现阶段单门（实现 + 测试桥）', () => {
        const body = skillBody('iagent_workflow');
        expect(body).toContain('实现 + 测试桥');
        expect(body).toContain('单一阻塞门');
        // 交付桥合并：需求文档选项并入同一门，验证阶段不再单独停一次
        expect(body).toContain('交付桥');
        expect(body).not.toContain('测试计划确认门 = 桥梁点');
    });

    it('spec_explore 专有断言不因下沉丢失', () => {
        const body = skillBody('iagent_spec_explore');
        expect(body).toContain('GATE PROTOCOL');
        expect(body).toContain('提示词校验门');
        expect(body).toContain('功能流程图');
        expect(body).toContain('强制检查点体系');
        expect(body).toContain('references/exploration-protocol.md');
    });

    it('探索指南标注上游来源', () => {
        expect(exploreRefContent('references/exploration-guidance.md')).toContain('openspec-explore');
    });
});

describe('需求文档时机跨模板一致（4.1 / 4.3）', () => {
    /** 全部技能正文 + references 的合并语料 */
    const corpus = skills
        .map(({ template }) => {
            const refs = (template.references ?? []).map((ref) => ref.content).join('\n');
            return `${template.name}\n${template.instructions}\n${refs}`;
        })
        .join('\n');

    it('requirement-doc 的调用方说明声明无自动调用方（仅手工调用）', () => {
        const body = skillBody('iagent_requirement_doc');
        for (const name of [
            'iagent_workflow',
            'iagent_auto_workflow',
            'iagent_debug',
            'iagent_spec_propose',
            'iagent_spec_archive',
            'iagent_spec_bulk_archive',
        ]) {
            expect(body, `调用方说明未列 ${name}`).toContain(name);
        }
        expect(body).toContain('无自动调用方');
        expect(body).toContain('MUST NOT 自动调用本技能');
        expect(body).toContain('只由用户手工调用');
        expect(body).toContain('不再随三父流程自动注入安装');
    });

    it('无残留「debug 不生成需求文档」旧口径', () => {
        for (const stale of [
            '需求文档不在范围内（强制禁止）',
            '需求文档不属于本工作流',
            'Phase 7 MUST NOT 生成需求文档',
            'debug 技能 MUST NOT 生成',
        ]) {
            expect(corpus, `模板仍残留旧口径「${stale}」`).not.toContain(stale);
        }
    });

    it('无残留「验证通过后默认自动生成」旧口径', () => {
        expect(corpus).not.toMatch(/验证通过后[^\n]*自动生成需求文档/);
        expect(corpus).not.toMatch(/无需用户确认[^\n]*需求文档/);
    });

    it('migration 不声明归档阶段一律生成需求文档', () => {
        const body = skillBody('iagent_migration');
        expect(body).not.toMatch(/归档[^\n]*需求文档[^\n]*生成/);
        expect(body).not.toMatch(/需求文档[^\n]*归档[^\n]*一律生成/);
    });

    it('三父流程均不再持有需求文档状态（四值模型整体移除）', () => {
        for (const name of ['iagent_workflow', 'iagent_auto_workflow', 'iagent_debug']) {
            const body = `${skillBody(name)}\n${(skills.find((s) => s.template.name === name)?.template.references ?? [])
                .map((ref) => ref.content)
                .join('\n')}`;
            expect(body, `${name} 仍持有 requirementDocStatus`).not.toContain(
                'requirementDocStatus'
            );
            expect(body, `${name} 仍残留 skipped-by-user`).not.toContain('skipped-by-user');
            expect(body, `${name} 仍残留 generation-failed`).not.toContain('generation-failed');
        }
    });
});

// ---------------------------------------------------------------------------
// 变更 improve-orchestration-execution-mode / 任务 5.9
// ---------------------------------------------------------------------------

describe('增量复验、串联回退与用量记录（任务 5.9）', () => {
    it('编排模板要求复验同上下文增量重跑且禁止 resume 充当复验', () => {
        for (const name of ['iagent_auto_workflow', 'iagent_workflow', 'iagent_debug']) {
            const text = skillBody(name);
            expect(text, `${name} 未禁止新开验证代理`).toContain('禁止新开验证代理');
            expect(text, `${name} 未禁止 resume 充当复验`).toContain('禁止 resume 充当复验');
        }
    });

    it('验证类模板标记 contextReplay=true 记 WARN（resume 仅续跑）', () => {
        for (const name of [
            'iagent_spec_verify',
            'iagent_spec_apply',
            'iagent_spec_verify_proposal',
        ]) {
            expect(skillBody(name), `${name} 缺 contextReplay WARN`).toContain(
                'contextReplay=true 记 WARN'
            );
        }
    });

    it('深度复查报告缺失时退化为独立全量复查并记 WARN', () => {
        const review = skillBody('iagent_proposal_review');
        expect(review).toContain('报告缺失');
        expect(review).toMatch(/退化为独立全量复查[^\n]*WARN/);
        expect(review).toContain('dependsOn');
    });

    it('tokens 列恒存在：可用记录、不可得填 —', () => {
        // Given: 写入阶段结论的模板
        for (const name of ['iagent_spec_propose', 'iagent_spec_apply', 'iagent_spec_archive']) {
            expect(skillBody(name), `${name} 缺 tokens 列`).toContain('tokens');
        }
        // Then: 不可得分支以 — 占位且禁止编造
        for (const name of ['iagent_spec_propose', 'iagent_spec_archive']) {
            expect(skillBody(name), `${name} 缺不可得填 —`).toMatch(/tokens[^\n]{0,20}—/);
        }
        expect(skillBody('iagent_spec_propose')).toContain('MUST NOT 编造');
    });
});

// ---------------------------------------------------------------------------
// 变更 inline-orchestration-delegation / 任务 10.4 / 10.8
// 单变更归档内联、批量归档保留并行。
// ---------------------------------------------------------------------------
describe('10.4 / 10.8 归档执行方式（单变更内联 / 批量并行）', () => {
    it('单变更归档内联：workflow / auto-workflow / spec-archive 声明主 agent 内联', () => {
        for (const name of ['iagent_workflow', 'iagent_auto_workflow', 'iagent_spec_archive']) {
            const body = skillBody(name);
            expect(body, `${name} 未声明归档内联`).toContain('主 agent 内联');
            expect(body, `${name} 未标注 executionMode=inline`).toContain('executionMode=inline');
        }
        // 兼容窗：旧 subagent 回执记 deprecation WARN
        expect(skillBody('iagent_workflow')).toContain('下个 major 收紧为仅 `inline`');
        expect(skillBody('iagent_spec_archive')).toContain('deprecation WARN');
    });

    it('批量归档保留并行子代理（≤3 单元，失败隔离）', () => {
        const bulk = skillBody('iagent_spec_bulk_archive');
        expect(bulk).toContain('同时最多 3 个归档子代理');
        expect(bulk).toContain('并行');
        expect(bulk).toContain('失败隔离');
        const template = skills.find((s) => s.template.name === 'iagent_spec_bulk_archive')!;
        expect(template.template.allowedTools).toContain('Agent, Task');
    });

    it('spec-bulk-archive 不由编排技能内联化（正文保持不变）', () => {
        const bulk = skillBody('iagent_spec_bulk_archive');
        expect(bulk).not.toContain('主 agent 内联归档');
    });
});

// 变更 fix-skill-contract-drift / D5：宿主中立与规则基线。
describe('宿主中立与规则基线（fix-skill-contract-drift）', () => {
    it('模板正文不含宿主专属工具名', () => {
        for (const { template } of skills) {
            expect(template.instructions, template.name).not.toContain('AskUserQuestion');
            expect(template.instructions, template.name).not.toContain('Task 工具');
            expect(template.instructions, template.name).not.toContain('Skill 工具');
        }
    });

    it('生成期替换 {{ASK_USER}} 且无残留', async () => {
        const { generateSkillContent } = await import('../src/core/command-generation/index.js');
        for (const { template } of skills) {
            for (const hostId of ['claude', 'pi', 'opencode', 'codex', undefined]) {
                const generated = generateSkillContent(
                    template,
                    'test',
                    hostId === undefined ? {} : { hostId }
                );
                expect(generated.fileContent, `${template.name}/${hostId ?? 'neutral'}`).not.toContain(
                    '{{ASK_USER}}'
                );
            }
        }
    });

    it('review / test 读取项目规则基线', () => {
        const review = skillBody('iagent_review');
        expect(review).toContain('iagent rules --json');
        expect(review).toContain('.iagent/rules/*.md');

        const test = skillBody('iagent_test');
        expect(test).toContain('iagent rules --json');
        expect(test).toContain('.iagent/rules/testing-rules.md');
    });

    it('无相邻重复短语', () => {
        for (const { template } of skills) {
            for (const phrase of ['由主 agent 内联由主 agent 内联', '由主 agent 由主 agent']) {
                expect(template.instructions, `${template.name} 含重复短语「${phrase}」`).not.toContain(
                    phrase
                );
            }
        }
    });

    it('零门技能不出现「本技能包含 GATE」导言', () => {
        for (const name of [
            'iagent_spec_propose',
            'iagent_spec_verify',
            'iagent_spec_archive',
            'iagent_spec_bulk_archive',
        ]) {
            expect(skillBody(name), name).not.toContain(
                '本技能包含以 **⛔ GATE:** 标记的**确认门**'
            );
        }
    });

    it('独立归档技能标注豁免且父流程仍承载', () => {
        for (const name of ['iagent_spec_archive', 'iagent_spec_bulk_archive']) {
            const body = skillBody(name);
            expect(body, name).toContain('独立调用');
            expect(body, name).toContain('archive-confirmation');
            expect(body, name).toContain('父工作流');
        }
    });

    it('spec-apply 设计门使用 ⛔ GATE 标记', () => {
        expect(skillBody('iagent_spec_apply')).toContain('⛔ GATE: 5.5 设计确认门');
    });
});
