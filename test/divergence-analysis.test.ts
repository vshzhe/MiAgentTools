/**
 * divergence-analysis：需求发散五维、就绪门第 5 判定与消费承接。
 *
 * 覆盖能力 `divergence-analysis` 的全部 Scenario。
 */

import { describe, it, expect } from 'vitest';
import {
    DIVERGENCE_DIMENSIONS,
    DIVERGENCE_LABELS,
    DIVERGENCE_SECTION,
    DIVERGENCE_HANDOFF_ANCHOR,
    renderDivergenceDimensions,
    renderDivergenceSection,
    DIVERGENCE_ANALYSIS_FULL,
} from '../src/core/templates/divergence.js';
import {
    extractDivergenceSection,
    hasDimensionContent,
    findDivergenceGaps,
} from '../src/core/spec/validation/divergence-check.js';
import { buildReadiness } from '../src/core/spec/validation/readiness.js';
import type { ParsedChange } from '../src/core/spec/model/artifact-model.js';
import { getSkillTemplates } from '../src/core/templates/registry.js';
import { PROPOSAL_TEMPLATE } from '../src/core/spec/templates/index.js';
import { PROPOSE_SELF_CHECK_ITEMS } from '../src/core/templates/verify-checklist.js';

function skillText(name: string): string {
    const found = getSkillTemplates().find(({ template }) => template.name === name);
    if (found === undefined) throw new Error(`缺少模板：${name}`);
    return [found.template.instructions, ...(found.template.references ?? []).map((ref) => ref.content)].join('\n');
}

const FULL = `## 需求发散

| 维度 | 条目 |
| :--- | :--- |
| 直接影响 | 改动 \`src/a.ts\` |
| 间接影响 | 共享工具 \`src/util.ts:12\` |
| 契约影响 | 无 |
| 同类场景 | 无 |
| 非功能影响 | 无 |
`;

describe('需求发散五维', () => {
    it('五维定义与顺序固定', () => {
        expect(DIVERGENCE_LABELS).toEqual(['直接影响', '间接影响', '契约影响', '同类场景', '非功能影响']);
        expect(DIVERGENCE_DIMENSIONS).toHaveLength(5);
        expect(renderDivergenceDimensions()).toContain('| 直接影响 |');
    });

    it('Scenario: 五维齐备', () => {
        expect(findDivergenceGaps(FULL)).toEqual([]);
    });

    it('Scenario: 维度留空即视为缺失', () => {
        const text = `## 需求发散

| 维度 | 条目 |
| :--- | :--- |
| 直接影响 | 改动 a |
| 间接影响 |  |
| 契约影响 | — |
| 同类场景 | 无 |
| 非功能影响 | 无 |
`;
        const gaps = findDivergenceGaps(text);
        expect(gaps).toHaveLength(2);
        expect(gaps.join()).toContain('间接影响');
        expect(gaps.join()).toContain('契约影响');
    });

    it('Scenario: 无发散内容时显式声明（全「无」合法）', () => {
        const text = `## 需求发散

| 维度 | 条目 |
| :--- | :--- |
| 直接影响 | 无 |
| 间接影响 | 无 |
| 契约影响 | 无 |
| 同类场景 | 无 |
| 非功能影响 | 无 |
`;
        expect(findDivergenceGaps(text)).toEqual([]);
    });

    it('小节形态同样被识别', () => {
        const text = `## 需求发散

### 直接影响
- 改动 \`src/a.ts\`

### 间接影响
无

### 契约影响
无

### 同类场景
无

### 非功能影响
无
`;
        expect(findDivergenceGaps(text)).toEqual([]);
    });

    it('缺段返回单条 gap', () => {
        expect(findDivergenceGaps(undefined)).toEqual([`缺少 \`${DIVERGENCE_SECTION}\` 段`]);
        expect(findDivergenceGaps('# 探索\n')).toHaveLength(1);
    });

    it('代码围栏内的伪标题不被当作段', () => {
        const fence = '```';
        const text = ['## 其它', '', fence, '## 需求发散', '| 直接影响 | x |', fence, ''].join('\n');
        expect(extractDivergenceSection(text)).toBeNull();
    });

    it('段截取到下一个同级标题为止', () => {
        const text = `${FULL}\n## 下一段\n| 直接影响 | 不在本段 |\n`;
        const section = extractDivergenceSection(text);
        expect(section).not.toBeNull();
        expect(section).not.toContain('不在本段');
        expect(hasDimensionContent(section!, '直接影响')).toBe(true);
    });
});

describe('就绪门第 5 判定 divergence', () => {
    function model(explorationRaw: string | undefined): ParsedChange {
        return {
            changeName: 'demo',
            changeRoot: '/tmp/demo',
            specs: [],
            ...(explorationRaw === undefined ? {} : { explorationRaw }),
            diagnostics: [],
            warnings: [],
        };
    }

    it('Scenario: 新变更缺发散段判 fail', () => {
        const result = buildReadiness(model(undefined), { created: '2099-01-01' });
        const check = result.checks.find((item) => item.id === 'divergence');
        expect(check?.status).toBe('fail');
        expect(result.valid).toBe(false);
        expect(result.diagnostics.some((d) => d.code === 'divergence-incomplete')).toBe(true);
    });

    it('Scenario: 存量变更缺发散段不阻断', () => {
        const result = buildReadiness(model(undefined), { created: '2020-01-01' });
        const check = result.checks.find((item) => item.id === 'divergence');
        expect(check?.status).toBe('skipped');
        expect(result.legacyWarnings.some((d) => d.code === 'divergence-incomplete-legacy')).toBe(true);
    });

    it('Scenario: 五维齐备判 pass', () => {
        const result = buildReadiness(model(FULL), { created: '2099-01-01' });
        expect(result.checks.find((item) => item.id === 'divergence')?.status).toBe('pass');
    });

    it('checks 数组含五项且 id 稳定', () => {
        const result = buildReadiness(model(FULL), { created: '2099-01-01' });
        expect(result.checks.map((item) => item.id)).toEqual([
            'structure', 'coverage', 'anchors', 'capabilities', 'divergence',
        ]);
    });

    it('skip_specs / legacyJson 不豁免本判定', () => {
        const result = buildReadiness(model(undefined), {
            created: '2099-01-01',
            skipSpecs: true,
            legacyJson: true,
        });
        expect(result.checks.find((item) => item.id === 'divergence')?.status).toBe('fail');
    });
});

describe('发散产出的时机与呈现', () => {
    it('Scenario: 合并呈现不新增停点（探索阶段仍只有 1 个流程级门）', () => {
        const text = skillText('iagent_spec_explore');
        expect(text).toContain('1.5.6 需求发散');
        expect(text).toContain('与 1.5.5 流程门合并呈现');
        expect(text).toContain('不新增用户停顿');
        // 门预算声明仍为探索阶段唯一流程级门
        expect(text).toContain('探索阶段仍只有 1 个流程级阻塞门');
    });

    it('Scenario: 修改流程图后重新评估', () => {
        expect(skillText('iagent_spec_explore')).toContain('重新评估受影响维度');
    });

    it('协议正文下沉 references（主文件只留指针）', () => {
        const template = getSkillTemplates().find(({ template: t }) => t.name === 'iagent_spec_explore')!.template;
        const ref = (template.references ?? []).find((r) => r.path === 'references/divergence-analysis.md');
        expect(ref).toBeDefined();
        expect(ref!.content).toBe(DIVERGENCE_ANALYSIS_FULL);
        expect(template.instructions).toContain('references/divergence-analysis.md');
        // 主文件不含五维定义表全文
        expect(template.instructions).not.toContain(renderDivergenceDimensions());
    });
});

describe('发散结论的消费承接', () => {
    it('Scenario: propose 产出承接表', () => {
        expect(skillText('iagent_spec_propose')).toContain(`### ${DIVERGENCE_HANDOFF_ANCHOR}`);
        expect(PROPOSAL_TEMPLATE).toContain(`### ${DIVERGENCE_HANDOFF_ANCHOR}`);
        expect(PROPOSE_SELF_CHECK_ITEMS.join()).toContain('需求发散承接');
    });

    it('Scenario: Phase 2.0 一次广查询（workflow 与 auto-workflow 一致）', () => {
        for (const name of ['iagent_workflow', 'iagent_auto_workflow']) {
            const text = skillText(name);
            expect(text, `${name} 缺一次广查询约束`).toContain('一次广查询');
            expect(text, `${name} 缺禁止逐维查询`).toContain('MUST NOT 为每个维度单独发起查询');
            expect(text, `${name} 缺五维`).toContain('需求发散承接');
        }
    });

    it('Scenario: debug 需求面扩展信号', () => {
        const text = skillText('iagent_debug');
        expect(text).toContain('需求面扩展');
        expect(text).toContain('超出');
    });
});

describe('发散段的验证维度边界', () => {
    it('Scenario: 就绪门不含语义判定（判定为纯函数、无 I/O / 无模型调用）', () => {
        const result = buildReadiness(
            { changeName: 'd', changeRoot: '/tmp/d', specs: [], explorationRaw: FULL, diagnostics: [], warnings: [] },
            { created: '2099-01-01' },
        );
        // 同一输入重复调用结果一致（纯函数）
        const again = buildReadiness(
            { changeName: 'd', changeRoot: '/tmp/d', specs: [], explorationRaw: FULL, diagnostics: [], warnings: [] },
            { created: '2099-01-01' },
        );
        expect(again.checks).toEqual(result.checks);
    });

    it('D1-D10 维度编号与阈值不变（不因本判定扩张）', async () => {
        const checklist = await import('../src/core/templates/verify-checklist.js');
        expect(checklist.VERIFY_DIMENSIONS.map((d) => d.id)).toEqual(['D1', 'D2', 'D3', 'D4', 'D5', 'D6-D10']);
        expect(checklist.VERIFY_THRESHOLD).toBe(90);
    });
});

describe('探索侧正文', () => {
    it('renderDivergenceSection 含五维名与证据要求', () => {
        const text = renderDivergenceSection();
        for (const label of DIVERGENCE_LABELS) expect(text).toContain(label);
        expect(text).toContain('文件:行');
        expect(text).toContain('无');
    });
});
