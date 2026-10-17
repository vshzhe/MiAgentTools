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
import { getSkillTemplates } from '../src/core/templates/index.js';

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

describe('调用类白名单与委派齐备', () => {
    it('每个 Skill(...) 条目在正文中被提及（无幽灵条目）', () => {
        const offenders: string[] = [];
        for (const { template } of skills) {
            for (const m of template.allowedTools.matchAll(/Skill\(([a-z_]+)\)/g)) {
                const bare = m[1];
                if (!template.instructions.includes(`iagent_${bare}`)) {
                    offenders.push(`${template.name}: Skill(${bare}) 未在正文提及`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('auto-workflow 白名单含委派 apply/archive/verify/test', () => {
        const aw = skills.find((s) => s.template.name === 'iagent_auto_workflow');
        expect(aw).toBeDefined();
        for (const bare of ['spec_apply', 'spec_archive', 'spec_verify', 'test']) {
            expect(aw?.template.allowedTools, `缺 Skill(${bare})`).toContain(`Skill(${bare})`);
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
    it('全部 20 个模板均为 skill 单一源（deriveCommandContent）', () => {
        const derived = fs
            .readdirSync(WORKFLOWS_DIR)
            .filter((f) => f.endsWith('.ts'))
            .filter((f) => fs.readFileSync(path.join(WORKFLOWS_DIR, f), 'utf8').includes('deriveCommandContent'));
        expect(derived.length).toBe(20);
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
