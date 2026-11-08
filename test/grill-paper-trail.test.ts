/**
 * 回归锁（变更 improve-grill-with-docs-paper-trail）。
 *
 * 覆盖 workflow-suite-skills / skill-stage-continuation / spec-bulk-archive-skill 三份 delta：
 *   1. 探索纸迹三项校验与 paperTrailStatus
 *   2. 批量口径消解（收敛深度不限 + ≤2 批规则）
 *   3. debug 排查期 grill 纸迹纪律
 *   4. 六处 CONTEXT.md 写入者漂移防护与归档取词口径收窄
 *   5. 决策可追溯（D<n>）与 handoff `## 硬约束`
 *   6. 编排纸迹衔接（唯一过桥载体 / 父级复核 / 唯一停点）
 *   7. 批量归档 a.5 / a.6 语义
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getSkillTemplates } from '../src/core/templates/index.js';
import { GATE_WHITELIST } from '../src/core/host-orchestration/protocol.js';

const skills = getSkillTemplates();

function entry(name: string) {
    const found = skills.find((s) => s.template.name === name);
    if (!found) {
        throw new Error(`技能模板缺失: ${name}`);
    }
    return found.template;
}

/** 主文件正文（不含 references） */
function body(name: string): string {
    return entry(name).instructions;
}

/** 合并语料：主文件 + 该技能全部 references（渐进披露下沉后仍应被断言覆盖） */
function corpus(name: string): string {
    const template = entry(name);
    return [template.instructions, ...(template.references ?? []).map((ref) => ref.content)].join('\n');
}

const EXPLORE = 'iagent_spec_explore';
const DEBUG = 'iagent_debug';
const ARCHIVE = 'iagent_spec_archive';
const BULK = 'iagent_spec_bulk_archive';
const WORKFLOW = 'iagent_workflow';
const AUTO = 'iagent_auto_workflow';
const PROPOSE = 'iagent_spec_propose';
const APPLY = 'iagent_spec_apply';

describe('1. 批量口径消解（N6 / N8）', () => {
    it('两批确认：至多 2 次批量确认且每批逐条列出待确认项与建议', () => {
        const text = corpus(EXPLORE);
        expect(text).toContain('批量 1');
        expect(text).toContain('批量 2');
        expect(text).toContain('至多 **2 个批量确认轮次**');
        expect(text).toContain('逐条列出');
    });

    it('最低深度 L3 保持，未确认 L4-L5 记入 Pending', () => {
        const text = corpus(EXPLORE);
        expect(text).toContain('最低深度 L3');
        expect(text).toContain('Pending');
    });

    it('收敛深度不限与 ≤2 批规则共存，且无无限定旧口径', () => {
        const text = corpus(EXPLORE);
        expect(text).toContain('收敛深度不限');
        expect(text).toContain('批量轮数受 ≤2 批规则约束（澄清门不计入流程级门预算）');
        // 旧矛盾句按精确句匹配，避免「深度不限」子串误判
        expect(text).not.toContain('不设人为上限');
        expect(text).not.toContain('轮数不限');
        // 新增问题不得触发第三个确认轮次
        expect(text).toContain('MUST NOT 为此新增第三个用户确认轮次');
    });
});

describe('2. 探索纸迹三项校验与回执声明（N10 / N11 / N12）', () => {
    it('三项齐备或显式「无」时 paperTrailStatus=complete', () => {
        const text = corpus(EXPLORE);
        expect(text).toContain('Decisions');
        expect(text).toContain('术语表');
        expect(text).toContain('ADR');
        expect(text).toContain('无决策');
        expect(text).toContain('无新术语');
        expect(text).toContain('无 ADR');
        expect(text).toContain('paperTrailStatus');
        expect(text).toContain('complete');
    });

    it('纸迹缺失并入流程最终确认门且 MUST NOT 新增阻塞门', () => {
        const text = corpus(EXPLORE);
        expect(text).toContain('并入既有的流程最终确认门呈现');
        expect(text).toContain('MUST NOT 新增阻塞确认门');
        expect(GATE_WHITELIST).toHaveLength(5);
    });

    it('用户提前结束为 user-shortened 合法终态且未覆盖层级显式列出', () => {
        const text = corpus(EXPLORE);
        expect(text).toContain('user-shortened');
        expect(text).toContain('未覆盖的 L4-L5 层级');
    });

    it('无探索文件时校验跳过并记 WARN', () => {
        const text = corpus(EXPLORE);
        expect(text).toContain('无探索文件');
        expect(text).toContain('WARN');
        expect(text).toContain('skipped');
    });

    it('存量探索文件无字段契约时 WARN 视作无硬约束', () => {
        const text = corpus(EXPLORE);
        expect(text).toContain('存量探索文件');
        expect(text).toContain('视作「无硬约束」');
        expect(text).toContain('只对本次及之后新产出');
    });

    it('EXPLORE_PHASE.handoff 登记 paperTrailStatus', async () => {
        const { getWorkflowProtocol } = await import('../src/core/host-orchestration/workflows.js');
        const explore = getWorkflowProtocol('workflow')!.phases.find((p) => p.id === 'explore')!;
        expect(explore.handoff).toContain('paperTrailStatus');
    });
});

describe('3. 编排技能纸迹衔接口径（N12 / N13）', () => {
    it('exploration.md 为唯一过桥载体，Envelope 携带 explorationFile', () => {
        for (const name of [AUTO, WORKFLOW]) {
            const text = corpus(name);
            expect(text, `${name} 缺唯一过桥载体`).toContain('唯一过桥载体');
            expect(text, `${name} 缺 explorationFile`).toContain('explorationFile');
        }
    });

    it('父级不改写回执纸迹字段、缺失不补默认值', () => {
        for (const name of [AUTO, WORKFLOW]) {
            const text = corpus(name);
            expect(text, `${name} 缺原样透传`).toContain('原样');
            expect(text, `${name} 缺 MUST NOT 静默补默认值`).toContain(
                'MUST NOT 静默补默认值'
            );
        }
    });

    it('全自动管线唯一停点不变，纸迹校验在流程门内完成', () => {
        const text = corpus(AUTO);
        expect(text).toContain('唯一停点');
        expect(text).toContain('流程最终确认门之内');
    });

    it('父级复核纸迹自证，MUST NOT 静默采信子级自证', () => {
        for (const name of [AUTO, WORKFLOW]) {
            const text = corpus(name);
            expect(text, `${name} 缺父级复核`).toContain('父级复核');
            expect(text, `${name} 缺 MUST NOT 静默采信子级自证`).toContain(
                'MUST NOT 静默采信子级自证'
            );
        }
    });
});

describe('4. debug 排查期 grill 纸迹纪律（N7 / N9）', () => {
    it('术语冲突检测：先读 + 同名冲突 + 显式裁决', () => {
        const text = corpus(DEBUG);
        expect(text).toContain('先读');
        expect(text).toContain('同名');
        expect(text).toContain('显式裁决');
    });

    it('ADR 三条件判定', () => {
        const text = corpus(DEBUG);
        for (const keyword of ['难以逆转', '脱离上下文', '真实权衡']) {
            expect(text, `debug 缺 ADR 条件 ${keyword}`).toContain(keyword);
        }
        expect(text).toContain('MUST NOT 为凑纸迹而写');
    });

    it('边界场景构造写入诊断记录', () => {
        const text = corpus(DEBUG);
        expect(text).toContain('≥1 边界场景');
        expect(text).toContain('写入诊断记录');
    });
});

describe('5. CONTEXT.md 多写入者漂移防护（N7 / N16）', () => {
    const WRITERS = [EXPLORE, DEBUG, ARCHIVE, BULK, WORKFLOW, PROPOSE];

    it('六处写入者均先读 CONTEXT.md 再写', () => {
        for (const name of WRITERS) {
            const text = corpus(name);
            expect(text, `${name} 缺先读后写`).toContain('先读');
            expect(text, `${name} 缺先读 CONTEXT.md`).toContain('CONTEXT.md');
        }
    });

    it('同名冲突显式裁决（更新 / 标注已过时）', () => {
        for (const name of WRITERS) {
            const text = corpus(name);
            expect(text, `${name} 缺显式裁决`).toContain('显式裁决');
            expect(text, `${name} 缺已过时标注`).toContain(
                '已过时（由 <change-name> 取代）'
            );
        }
    });

    it('归档取词口径收窄为仅 exploration.md 术语表', () => {
        for (const name of [ARCHIVE, BULK]) {
            const text = body(name);
            expect(text, `${name} 缺只同步`).toContain('只同步');
            expect(text, `${name} 缺 exploration.md 术语表`).toContain(
                'exploration.md` 术语表'
            );
            expect(text, `${name} 仍从制品反向抽取`).not.toContain(
                '获取关键领域术语'
            );
            expect(text, `${name} 仍从 design 抽取`).not.toContain('获取技术术语与决策');
        }
    });

    it('并行单元 a.5 写入串行化', () => {
        const text = body(BULK);
        expect(text).toContain('串行化');
        expect(text).toContain('MUST NOT 并发写同一文件');
        expect(text).toContain('MUST NOT 与其他并行单元的 a.5 并发写同一文件');
    });
});

describe('6. 决策可追溯（D<n>）与 handoff 硬约束（N14 / N15）', () => {
    it('Decisions 带稳定 D<n> 且不复用 / 重排', () => {
        const text = body(PROPOSE);
        expect(text).toContain('D<n>');
        expect(text).toContain('MUST NOT 复用');
        expect(text).toContain('重排');
    });

    it('spec / design 在约束处标注 (D<n>)', () => {
        expect(body(PROPOSE)).toContain('(D<n>)');
    });

    it('[测试] 任务覆盖相关硬约束', () => {
        expect(body(PROPOSE)).toContain('测试任务覆盖相关硬约束');
    });

    it('探索硬约束声明：source: D<n> / 无硬约束 / MUST NOT 留空', () => {
        const text = corpus(EXPLORE);
        expect(text).toContain('## 硬约束');
        expect(text).toContain('source: D<n>');
        expect(text).toContain('无硬约束');
        expect(text).toContain('MUST NOT 留空');
    });

    it('version-minor 硬约束有测试守护（不硬编码具体次版本号）', () => {
        const pkg = JSON.parse(
            fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
        ) as { version: string };
        const changelog = fs.readFileSync(path.join(process.cwd(), 'CHANGELOG.md'), 'utf8');
        const [major, minor] = pkg.version.split('.').map(Number);
        // 基线 4.1.0：major 不变、minor 递增
        expect(major).toBe(4);
        expect(minor).toBeGreaterThan(1);
        expect(changelog).toContain(`## [${pkg.version}]`);
    });

    it('apply-exclusion 硬约束有测试守护：spec-apply 无新增 grill 纸迹逻辑', () => {
        const text = body(APPLY);
        expect(text).toContain('## 硬约束');
        expect(text).toContain('只读复用');
        expect(text).not.toContain('paperTrailStatus');
        expect(text).not.toMatch(/CONTEXT\.md[^\n]*(写入|追加|同步)/);
    });
});

describe('7. spec-bulk-archive a.5 / a.6（N16）', () => {
    const bulk = body(BULK);
    const a6Start = bulk.indexOf('a.6 **（已移除）**');
    const a6 = bulk.slice(a6Start, bulk.indexOf('b. **执行归档**'));

    it('a.5 取词口径收窄：只同步 exploration.md 术语表', () => {
        expect(bulk).toContain('只同步');
        expect(bulk).toContain('MUST NOT 从 `proposal.md` / `design.md` / `specs/**` 正文反向抽取');
    });

    it('a.5 先读后写与同名冲突显式裁决', () => {
        expect(bulk).toContain('写入前 MUST 先读');
        expect(bulk).toContain('已过时（由 <change-name> 取代）');
    });

    it('a.5 并行单元写入串行化且不丢失更新', () => {
        expect(bulk).toContain('串行化');
        expect(bulk).toContain('丢失更新');
    });

    it('CONTEXT.md 不存在时仅从 exploration 术语表创建', () => {
        expect(bulk).toContain('CONTEXT.md` 不存在');
        expect(bulk).toContain('exploration.md` 术语表创建');
        expect(bulk).toContain('MUST NOT 从制品正文创建');
    });

    it('a.6 已移除：无只读报告、无需求文档分支', () => {
        expect(a6Start).toBeGreaterThanOrEqual(0);
        expect(a6).toContain('整体移除');
        expect(a6).toContain('不再读取');
        expect(a6).not.toContain('需求文档：已存在');
        expect(a6).not.toContain('需求文档：缺失');
    });
});
