/**
 * 门账本（gate ledger）回归锁（变更 improve-delegation-gate-ledger，任务 1.5 / 1.8 / 7.1）。
 *
 * 锁定：
 *   - 段存在 / 段缺失（fail-safe）/ 未知门 id + WARN / 表头与分隔行被跳过；
 *   - 条目只表达门承载语义（`GATE_SKIP_IDS`），父级阶段门 id 不得写入；
 *   - 回执是上游真源：条目超出回执 / 回执缺失 → 视为未确认（WARN）；
 *   - 账本与六节并列、不计入六节，跨阶段只读不改写。
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import {
    GATE_LEDGER_SECTION,
    GATE_SKIP_IDS,
    WORKFLOW_PROTOCOLS,
    gateLedgerPath,
    getWorkflowProtocol,
    parseGateLedger,
    renderGateLedgerEntry,
    renderGateLedgerSection,
    resolveGateLedgerConfirmation,
} from '../src/core/host-orchestration/index.js';

const CHANGED = 'improve-delegation-gate-ledger';

/** 六节顺序（协议固定；账本与阶段结论均不计入） */
const SIX_SECTIONS = [
    '## 变更摘要',
    '## 契约',
    '## 规范要点',
    '## 文件归属表',
    '## Codebase 摘要',
    '## 已产出（跨单元可见）',
];

/** 构造含六节 + 账本 + 阶段结论的 handoff 包正文 */
function packMarkdown(ledgerRows: readonly string[]): string {
    return [
        'change: demo',
        'producedBy: propose',
        '',
        ...SIX_SECTIONS.flatMap((section) => [section, '', `- ${section} 内容`, '']),
        GATE_LEDGER_SECTION,
        '| 门 id | 确认阶段 |',
        '| --- | --- |',
        ...ledgerRows,
        '',
        '## 阶段结论',
        '- propose: PASS',
    ].join('\n');
}

describe('门账本路径与渲染', () => {
    it('gateLedgerPath 由 change-name 确定性派生（path.join，不新增参数键）', () => {
        expect(gateLedgerPath(CHANGED)).toBe(
            path.join('.openspec-tmp', `pipeline-${CHANGED}`, 'handoff-pack.md')
        );
        // 与模板正文声明的唯一路径一致（`/` 归一化后比对）
        expect(gateLedgerPath(CHANGED).replaceAll('\\', '/')).toBe(
            `.openspec-tmp/pipeline-${CHANGED}/handoff-pack.md`
        );
    });

    it('renderGateLedgerEntry 只接受门承载 id（父级阶段门 id 直接拒绝）', () => {
        expect(renderGateLedgerEntry('design-confirmation', 'verify')).toBe(
            '| design-confirmation | verify |'
        );
        for (const stageGate of ['implementation-bridge', 'requirement-doc-bridge']) {
            expect(() => renderGateLedgerEntry(stageGate, 'apply')).toThrow(/门承载 id/);
        }
    });

    it('renderGateLedgerSection → parseGateLedger 往返一致（表头/分隔行不被当作条目）', () => {
        const section = renderGateLedgerSection([{ gate: GATE_SKIP_IDS[0], phase: 'verify' }]);
        const parsed = parseGateLedger(section);
        expect(parsed.present).toBe(true);
        expect(parsed.gates).toEqual(['design-confirmation']);
        expect(parsed.entries).toEqual([{ gate: 'design-confirmation', phase: 'verify' }]);
        expect(parsed.warnings).toEqual([]);
    });
});

describe('parseGateLedger 容错', () => {
    it('段存在：表头与分隔行被跳过，无 WARN（不依赖列宽对齐）', () => {
        const parsed = parseGateLedger(packMarkdown(['| design-confirmation | verify |']));
        expect(parsed.present).toBe(true);
        expect(parsed.gates).toEqual(['design-confirmation']);
        expect(parsed.warnings).toEqual([]);
    });

    it('列宽不对齐 / 无外层竖线同样可解析', () => {
        const parsed = parseGateLedger(
            packMarkdown(['|design-confirmation|verify|', 'design-confirmation | apply'])
        );
        expect(parsed.gates).toEqual(['design-confirmation']);
        expect(parsed.warnings).toEqual([]);
    });

    it('段缺失 → present:false + 空集且不产生 WARN（无账本属合法 fail-safe 状态）', () => {
        const parsed = parseGateLedger('## 变更摘要\n\n- 内容\n');
        expect(parsed.present).toBe(false);
        expect(parsed.gates).toEqual([]);
        expect(parsed.warnings).toEqual([]);
    });

    it('未知门 id 只产生 WARN，不回填（父级阶段门 id 不得被当作已确认门）', () => {
        const parsed = parseGateLedger(
            packMarkdown(['| implementation-bridge | verify |', '| requirement-doc-bridge | verify |'])
        );
        expect(parsed.gates).toEqual([]);
        expect(parsed.warnings).toHaveLength(2);
        expect(parsed.warnings.join('\n')).toContain('implementation-bridge');
        expect(parsed.warnings.join('\n')).toContain('MUST NOT 视为已确认');
    });

    it('重复条目去重且保留首个阶段标识', () => {
        const parsed = parseGateLedger(
            packMarkdown([
                '| design-confirmation | verify |',
                '| design-confirmation | apply |',
            ])
        );
        expect(parsed.gates).toEqual(['design-confirmation']);
        expect(parsed.entries).toEqual([{ gate: 'design-confirmation', phase: 'verify' }]);
    });
});

describe('账本与回执一致性（回执为上游真源）', () => {
    it('条目与回执一致 → 可视为已确认', () => {
        const parsed = parseGateLedger(packMarkdown(['| design-confirmation | verify |']));
        const result = resolveGateLedgerConfirmation('design-confirmation', parsed, [
            'design-confirmation',
        ]);
        expect(result.confirmed).toBe(true);
        expect(result.warnings).toEqual([]);
    });

    it('条目超出回执（伪造 / 过期）→ WARN 且不视为已确认', () => {
        const parsed = parseGateLedger(packMarkdown(['| design-confirmation | verify |']));
        const result = resolveGateLedgerConfirmation('design-confirmation', parsed, []);
        expect(result.confirmed).toBe(false);
        expect(result.warnings.join('\n')).toContain('视为未确认');
    });

    it('回执未携带 confirmedGates → 无法核对 → WARN 且不视为已确认', () => {
        const parsed = parseGateLedger(packMarkdown(['| design-confirmation | verify |']));
        const result = resolveGateLedgerConfirmation('design-confirmation', parsed, undefined);
        expect(result.confirmed).toBe(false);
        expect(result.warnings.join('\n')).toContain('无法核对');
    });

    it('账本缺失 / 段内无该门 → 未确认且不产生 WARN（门照常执行）', () => {
        const missing = parseGateLedger('## 变更摘要\n');
        expect(resolveGateLedgerConfirmation('design-confirmation', missing, ['design-confirmation']))
            .toEqual({ confirmed: false, warnings: [] });
        const empty = parseGateLedger(packMarkdown([]));
        expect(resolveGateLedgerConfirmation('design-confirmation', empty, ['design-confirmation']))
            .toEqual({ confirmed: false, warnings: [] });
    });

    it('父级阶段门 id 不在门承载域内 → 未确认 + WARN', () => {
        const parsed = parseGateLedger(packMarkdown(['| design-confirmation | verify |']));
        const result = resolveGateLedgerConfirmation('implementation-bridge', parsed, [
            'implementation-bridge',
        ]);
        expect(result.confirmed).toBe(false);
        expect(result.warnings.join('\n')).toContain('不承载');
    });
});

describe('账本段与六节并列（不计入六节、只读不改写）', () => {
    it('六节顺序不变，账本段位于六节之后且独立于六节计数', () => {
        const markdown = packMarkdown(['| design-confirmation | verify |']);
        const indices = SIX_SECTIONS.map((section) => markdown.indexOf(section));
        expect(indices.every((index) => index >= 0)).toBe(true);
        expect([...indices].sort((a, b) => a - b)).toEqual(indices);
        // 六节 + 账本段 + 阶段结论：账本不是第七个内容节
        const parsed = parseGateLedger(markdown);
        expect(parsed.present).toBe(true);
        expect(markdown.split(GATE_LEDGER_SECTION).length - 1).toBe(1);
        expect(SIX_SECTIONS.some((section) => section === GATE_LEDGER_SECTION)).toBe(false);
    });

    it('条目只含门 id + 确认阶段（不承载业务决策正文）', () => {
        const parsed = parseGateLedger(packMarkdown(['| design-confirmation | verify |']));
        for (const entry of parsed.entries) {
            expect(Object.keys(entry).sort()).toEqual(['gate', 'phase']);
            expect((GATE_SKIP_IDS as readonly string[]).includes(entry.gate)).toBe(true);
        }
    });

    it('解析为纯函数：只读输入，跨阶段不改写账本', () => {
        const markdown = packMarkdown(['| design-confirmation | verify |']);
        const before = markdown;
        parseGateLedger(markdown);
        parseGateLedger(markdown);
        expect(markdown).toBe(before);
    });
});

// 覆盖缺口审计：段终止边界、不可解析行与「账本不是门」此前无断言。
describe('账本解析的段边界与不可解析行', () => {
    it('缺确认阶段列的行产生 WARN 且不入账（MUST NOT 静默吞掉）', () => {
        const parsed = parseGateLedger(packMarkdown(['design-confirmation']));
        expect(parsed.gates).toEqual([]);
        expect(parsed.entries).toEqual([]);
        expect(parsed.warnings).toHaveLength(1);
        expect(parsed.warnings[0]).toContain('无法解析');
        expect(parsed.warnings[0]).toContain('确认阶段');
    });

    it('账本段在下一个标题处结束（后续段落的表格样行不被解析）', () => {
        const markdown = [
            GATE_LEDGER_SECTION,
            '| 门 id | 确认阶段 |',
            '| --- | --- |',
            '| design-confirmation | verify |',
            '',
            '## 阶段结论',
            '- design-confirmation | apply',
        ].join('\n');
        const parsed = parseGateLedger(markdown);
        expect(parsed.gates).toEqual(['design-confirmation']);
        expect(parsed.entries).toEqual([{ gate: 'design-confirmation', phase: 'verify' }]);
        expect(parsed.warnings).toEqual([]);
    });

    it('非字符串输入视为无账本（fail-safe，不抛错）', () => {
        const parsed = parseGateLedger(undefined as unknown as string);
        expect(parsed).toEqual({ present: false, gates: [], entries: [], warnings: [] });
    });
});

describe('账本不进入门模型（门承载 ≠ 阶段门）', () => {
    it('任何阶段门 id 都不落在门承载取值域内（账本不会被登记为门）', () => {
        for (const [workflowId, protocol] of Object.entries(WORKFLOW_PROTOCOLS)) {
            for (const phase of protocol.phases) {
                const gateId = phase.gate?.id;
                if (gateId === undefined) {
                    continue;
                }
                expect(
                    (GATE_SKIP_IDS as readonly string[]).includes(gateId),
                    `${workflowId}/${phase.id} 把门承载 id ${gateId} 登记为阶段门`
                ).toBe(false);
            }
        }
    });

    it('apply 阶段 handoff 交付 confirmedGates（账本事实随回执交付下游）', () => {
        const apply = getWorkflowProtocol('workflow')!.phases.find((phase) => phase.id === 'apply')!;
        expect(apply.handoff).toContain('confirmedGates');
        // 字段语义为「门承载事实」，不是父级阶段门 id
        expect(apply.gate?.id).toBe('implementation-bridge');
        expect((GATE_SKIP_IDS as readonly string[]).includes(apply.gate!.id)).toBe(false);
    });
});
