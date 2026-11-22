/**
 * spec-verify-anchors：验证锚点单一源 + 解析器结构化扩展。
 *
 * 覆盖能力 `spec-verify-anchors` 的全部 Scenario。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    VERIFY_ANCHORS,
    ANCHOR_ARTIFACTS,
    NODE_REF_PATTERN,
    extractNodeRefs,
    stripNodeRefs,
    renderAnchorHeading,
} from '../src/core/spec/validation/anchors.js';
import {
    PROPOSAL_TEMPLATE,
    DESIGN_TEMPLATE,
    TASKS_TEMPLATE,
} from '../src/core/spec/templates/index.js';
import { parseProposal } from '../src/core/spec/parser/proposal-parser.js';
import { parseTasks } from '../src/core/spec/parser/task-parser.js';
import { getSpecVerifyProposalSkillTemplate } from '../src/core/templates/workflows/spec-verify-proposal.js';

function makeTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-anchors-'));
}

describe('锚点单一源：常量定义', () => {
    it('锚点常量为预期文本', () => {
        expect(VERIFY_ANCHORS.impactAnalysis).toBe('Impact Analysis');
        expect(VERIFY_ANCHORS.architectureImpact).toBe('架构影响');
        expect(VERIFY_ANCHORS.callerUpdates).toBe('Caller Updates');
    });

    it('锚点归属制品正确', () => {
        expect(ANCHOR_ARTIFACTS.impactAnalysis).toBe('proposal.md');
        expect(ANCHOR_ARTIFACTS.architectureImpact).toBe('design.md');
        expect(ANCHOR_ARTIFACTS.callerUpdates).toBe('tasks.md');
    });

    it('renderAnchorHeading 生成三级标题', () => {
        expect(renderAnchorHeading(VERIFY_ANCHORS.impactAnalysis)).toBe('### Impact Analysis');
    });
});

describe('锚点单一源：生成模板产出全部锚点', () => {
    it('PROPOSAL_TEMPLATE 含 Impact Analysis', () => {
        expect(PROPOSAL_TEMPLATE).toContain(renderAnchorHeading(VERIFY_ANCHORS.impactAnalysis));
    });

    it('DESIGN_TEMPLATE 的 Context 下含架构影响', () => {
        expect(DESIGN_TEMPLATE).toContain(renderAnchorHeading(VERIFY_ANCHORS.architectureImpact));
    });

    it('TASKS_TEMPLATE 含 Caller Updates 与节点标注示例', () => {
        expect(TASKS_TEMPLATE).toContain(renderAnchorHeading(VERIFY_ANCHORS.callerUpdates));
        expect(TASKS_TEMPLATE).toMatch(/\[N<id>\]/);
    });
});

describe('锚点单一源：验证侧复用同一常量', () => {
    it('spec-verify-proposal 正文引用 anchors 常量而非硬编码', () => {
        const instructions = getSpecVerifyProposalSkillTemplate().instructions;
        // 影响面存在性判定仍描述三锚点，但 MUST 通过常量渲染（三级标题形态一致）
        expect(instructions).toContain(VERIFY_ANCHORS.impactAnalysis);
        expect(instructions).toContain(VERIFY_ANCHORS.architectureImpact);
        expect(instructions).toContain(VERIFY_ANCHORS.callerUpdates);
    });
});

describe('锚点单一源：锚点常量与解析器一致', () => {
    let dir: string;

    beforeEach(() => {
        dir = makeTempDir();
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('parseProposal 产出 whatChanges 与 capabilities', () => {
        const file = path.join(dir, 'proposal.md');
        fs.writeFileSync(file, [
            '# 提案',
            '',
            '## Why',
            '',
            '需要变更。',
            '',
            '## What Changes',
            '',
            '- 新增能力 A',
            '- 修改能力 B',
            '',
            '## Capabilities',
            '',
            '### New Capabilities',
            '',
            '- `alpha`: 第一个能力',
            '',
            '### Modified Capabilities',
            '',
            '- `beta`: 第二个能力',
            '',
            '## Impact',
            '',
            '### Impact Analysis',
            '',
            '| 符号 | 位置 |',
            '| :--- | :--- |',
            '| `x` | `a.ts:1` |',
        ].join('\n'), 'utf8');
        const parsed = parseProposal(file);
        expect(parsed.whatChanges).toEqual(['新增能力 A', '修改能力 B']);
        expect(parsed.capabilities.map((item) => item.name)).toEqual(['alpha', 'beta']);
        expect(parsed.capabilities[0].kind).toBe('new');
        expect(parsed.capabilities[1].kind).toBe('modified');
        expect(parsed.capabilities[0].description).toBe('第一个能力');
    });

    it('parseProposal 的 whatChanges 不含 HTML 注释行', () => {
        const file = path.join(dir, 'proposal.md');
        fs.writeFileSync(file, [
            '## What Changes',
            '',
            '<!-- 说明注释 -->',
            '- 真实条目',
            '',
            '## Capabilities',
            '',
            '### New Capabilities',
            '',
            '- `a`: b',
        ].join('\n'), 'utf8');
        const parsed = parseProposal(file);
        expect(parsed.whatChanges).toEqual(['真实条目']);
    });
});

describe('任务节点标注：extractNodeRefs / stripNodeRefs', () => {
    it('提取单个节点', () => {
        expect(extractNodeRefs('实现分批查询 [N4]')).toEqual(['N4']);
    });

    it('提取多个节点并保持顺序', () => {
        expect(extractNodeRefs('实现 [N3][N8]')).toEqual(['N3', 'N8']);
    });

    it('无标注返回空数组', () => {
        expect(extractNodeRefs('普通任务')).toEqual([]);
    });

    it('形似写法不匹配（无数字 / 非纯数字）', () => {
        expect(extractNodeRefs('任务 [N] 与 [Nx]')).toEqual([]);
    });

    it('重复标注去重', () => {
        expect(extractNodeRefs('任务 [N4] 再次 [N4]')).toEqual(['N4']);
    });

    it('stripNodeRefs 剥离并折叠空白', () => {
        expect(stripNodeRefs('实现分批查询   [N4]')).toBe('实现分批查询');
        expect(stripNodeRefs('实现 [N3][N8]')).toBe('实现');
    });

    it('NODE_REF_PATTERN 为全局标志（供 matchAll 复用）', () => {
        expect(NODE_REF_PATTERN.flags).toContain('g');
    });
});

describe('任务节点标注：parseTasks 集成', () => {
    let dir: string;

    beforeEach(() => {
        dir = makeTempDir();
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('解析节点标注：nodeRefs + nodeRef + 描述剥离', () => {
        const file = path.join(dir, 'tasks.md');
        fs.writeFileSync(file, [
            '## 1. 实现',
            '',
            '- [ ] 1.1 [代码] 实现分批查询 [N4]',
            '  - 文件：`src/a.ts`',
        ].join('\n'), 'utf8');
        const parsed = parseTasks(file);
        expect(parsed.tasks[0].nodeRefs).toEqual(['N4']);
        expect(parsed.tasks[0].nodeRef).toBe('N4');
        expect(parsed.tasks[0].description).not.toContain('[N4]');
        expect(parsed.tasks[0].description).toContain('实现分批查询');
    });

    it('无标注任务不报错', () => {
        const file = path.join(dir, 'tasks.md');
        fs.writeFileSync(file, [
            '## 1. 实现',
            '',
            '- [ ] 1.1 [代码] 普通任务',
        ].join('\n'), 'utf8');
        const parsed = parseTasks(file);
        expect(parsed.tasks[0].nodeRefs).toBeUndefined();
        expect(parsed.tasks[0].nodeRef).toBeUndefined();
        expect(parsed.diagnostics).toHaveLength(0);
    });

    it('单任务多节点标注', () => {
        const file = path.join(dir, 'tasks.md');
        fs.writeFileSync(file, [
            '## 1. 实现',
            '',
            '- [ ] 1.1 [代码] 覆盖两个节点 [N3][N8]',
        ].join('\n'), 'utf8');
        const parsed = parseTasks(file);
        expect(parsed.tasks[0].nodeRefs).toEqual(['N3', 'N8']);
        expect(parsed.tasks[0].nodeRef).toBe('N3');
        expect(parsed.tasks[0].description).not.toContain('[N3]');
        expect(parsed.tasks[0].description).not.toContain('[N8]');
    });
});
