/**
 * spec-readiness-gate：确定性就绪门（四类判定 + 存量兼容 + 与 partial 互斥）。
 *
 * 覆盖能力 `spec-readiness-gate` 的全部 Scenario。
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    buildReadiness,
    isNewChange,
    READINESS_EFFECTIVE_DATE,
} from '../src/core/spec/validation/readiness.js';
import { parseProposal } from '../src/core/spec/parser/proposal-parser.js';
import { parseDesign } from '../src/core/spec/parser/design-parser.js';
import { parseSpec } from '../src/core/spec/parser/spec-parser.js';
import { parseTasks } from '../src/core/spec/parser/task-parser.js';
import type { ParsedChange } from '../src/core/spec/model/artifact-model.js';

function makeTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-readiness-'));
}

const PROPOSAL_OK = `# 提案

## Why

需要变更。

## What Changes

- 新增能力 alpha

## Capabilities

### New Capabilities

- \`alpha\`: 第一个能力

## Impact

### Impact Analysis

| 符号 | 位置 |
| :--- | :--- |
| \`x\` | \`a.ts:1\` |
`;

const DESIGN_OK = `## Context

### 架构影响

| 受影响模块 | 职责 |
| :--- | :--- |
| \`m\` | 模块 |

## Goals / Non-Goals

**Goals**:
- 目标

## Decisions

### D1: 决策

- **选择**: A

## Risks / Trade-offs

| 风险 | 缓解 |
| :--- | :--- |
| r | m |
`;

const SPECS_OK = `## ADDED Requirements

### Requirement: 能力

描述 SHALL 有效。

#### Scenario: 场景一

- **WHEN** 条件
- **THEN** 结果
`;

const TASKS_OK = `## 1. 实现

- [ ] 1.1 [代码] 实现能力 [N1]
  - 文件：\`src/a.ts\`
  - Spec Ref：alpha / 能力
  - Scenario Ref：alpha / 能力 / 场景一

- [ ] 1.2 [测试][单元][P0] 测试能力 [N1]
  - Spec Ref：alpha / 能力
  - Scenario Ref：alpha / 能力 / 场景一

### Caller Updates

| 影响模块 | 承接任务 |
| :--- | :--- |
| \`m\` | 1.1 |
`;

interface Fixture {
    dir: string;
    proposalFile?: string;
    designFile?: string;
    specFiles?: string[];
    tasksFile?: string;
}

function writeFixture(opts: {
    proposal?: string;
    design?: string;
    specs?: Array<{ capability: string; body: string }>;
    tasks?: string;
}): Fixture {
    const dir = makeTempDir();
    const fixture: Fixture = { dir };
    if (opts.proposal !== undefined) {
        fixture.proposalFile = path.join(dir, 'proposal.md');
        fs.writeFileSync(fixture.proposalFile, opts.proposal, 'utf8');
    }
    if (opts.design !== undefined) {
        fixture.designFile = path.join(dir, 'design.md');
        fs.writeFileSync(fixture.designFile, opts.design, 'utf8');
    }
    if (opts.specs !== undefined) {
        fixture.specFiles = opts.specs.map(({ capability, body }) => {
            const specDir = path.join(dir, 'specs', capability);
            fs.mkdirSync(specDir, { recursive: true });
            const file = path.join(specDir, 'spec.md');
            fs.writeFileSync(file, body, 'utf8');
            return file;
        });
    }
    if (opts.tasks !== undefined) {
        fixture.tasksFile = path.join(dir, 'tasks.md');
        fs.writeFileSync(fixture.tasksFile, opts.tasks, 'utf8');
    }
    return fixture;
}

function toModel(fixture: Fixture, changeName = 'add-alpha'): ParsedChange {
    return {
        changeName,
        changeRoot: fixture.dir,
        proposal: fixture.proposalFile === undefined ? undefined : parseProposal(fixture.proposalFile),
        design: fixture.designFile === undefined ? undefined : parseDesign(fixture.designFile),
        specs: (fixture.specFiles ?? []).map((file) => parseSpec(file)),
        tasks: fixture.tasksFile === undefined ? undefined : parseTasks(fixture.tasksFile),
        diagnostics: [],
        warnings: [],
    };
}

const NEW_CHANGE = { created: '2099-01-01' };
const LEGACY_CHANGE = { created: '2020-01-01' };

describe('isNewChange 判定', () => {
    it('created 晚于生效日期为新变更', () => {
        expect(isNewChange(READINESS_EFFECTIVE_DATE)).toBe(true);
        expect(isNewChange('2099-12-31')).toBe(true);
    });

    it('created 早于生效日期为存量变更', () => {
        expect(isNewChange('2020-01-01')).toBe(false);
    });

    it('created 缺失或不可解析按新变更（fail-safe）', () => {
        expect(isNewChange(undefined)).toBe(true);
        expect(isNewChange('')).toBe(true);
        expect(isNewChange('not-a-date')).toBe(true);
    });
});

describe('就绪门：四类判定', () => {
    afterEach(() => {
        // 每个用例自建 fixture，统一在 finally 清理见各用例
    });

    it('全部判定通过', () => {
        const fixture = writeFixture({
            proposal: PROPOSAL_OK,
            design: DESIGN_OK,
            specs: [{ capability: 'alpha', body: SPECS_OK }],
            tasks: TASKS_OK,
        });
        try {
            const result = buildReadiness(toModel(fixture), NEW_CHANGE);
            expect(result.valid).toBe(true);
            expect(result.checks.map((check) => check.id)).toEqual(['structure', 'coverage', 'anchors', 'capabilities']);
            expect(result.checks.every((check) => check.status === 'pass')).toBe(true);
            expect(result.diagnostics).toHaveLength(0);
        } finally {
            fs.rmSync(fixture.dir, { recursive: true, force: true });
        }
    });

    it('覆盖不足时逐条定位', () => {
        const tasksMissingTest = `## 1. 实现

- [ ] 1.1 [代码] 实现能力
  - 文件：\`src/a.ts\`
  - Spec Ref：alpha / 能力
  - Scenario Ref：alpha / 能力 / 场景一

### Caller Updates

| 影响模块 | 承接任务 |
| :--- | :--- |
| \`m\` | 1.1 |
`;
        const fixture = writeFixture({
            proposal: PROPOSAL_OK,
            design: DESIGN_OK,
            specs: [{ capability: 'alpha', body: SPECS_OK }],
            tasks: tasksMissingTest,
        });
        try {
            const result = buildReadiness(toModel(fixture), NEW_CHANGE);
            expect(result.valid).toBe(false);
            const coverage = result.checks.find((check) => check.id === 'coverage');
            expect(coverage?.status).toBe('fail');
            const finding = result.diagnostics.find((item) => item.code === 'scenario-without-test');
            expect(finding).toBeDefined();
            // 逐条可定位：消息含全路径、带 filePath 与 line
            expect(finding?.message).toContain('alpha / 能力 / 场景一');
            expect(finding?.filePath).toContain('spec.md');
            expect(finding?.line).toBeGreaterThan(0);
        } finally {
            fs.rmSync(fixture.dir, { recursive: true, force: true });
        }
    });

    it('能力声明与 specs 目录不一致：双向差集', () => {
        const proposal = PROPOSAL_OK.replace('- `alpha`: 第一个能力', '- `alpha`: 第一个能力\n- `gamma`: 只有声明');
        const fixture = writeFixture({
            proposal,
            design: DESIGN_OK,
            specs: [
                { capability: 'alpha', body: SPECS_OK },
                { capability: 'delta', body: SPECS_OK },
            ],
            tasks: TASKS_OK,
        });
        try {
            const result = buildReadiness(toModel(fixture), NEW_CHANGE);
            expect(result.valid).toBe(false);
            const capabilities = result.checks.find((check) => check.id === 'capabilities');
            expect(capabilities?.status).toBe('fail');
            const codes = result.diagnostics.map((item) => item.code);
            expect(codes).toContain('capability-without-spec');
            expect(codes).toContain('spec-without-capability');
            expect(result.diagnostics.find((item) => item.code === 'capability-without-spec')?.message).toContain('gamma');
            expect(result.diagnostics.find((item) => item.code === 'spec-without-capability')?.message).toContain('delta');
        } finally {
            fs.rmSync(fixture.dir, { recursive: true, force: true });
        }
    });
});

describe('就绪门：存量/新变更严格度分支', () => {
    it('存量变更缺锚点不阻断（warning + skipped）', () => {
        const proposalNoAnchor = PROPOSAL_OK.replace('### Impact Analysis', '### 其他');
        const tasksNoAnchor = TASKS_OK.replace('### Caller Updates', '### 其他');
        const fixture = writeFixture({
            proposal: proposalNoAnchor,
            design: DESIGN_OK.replace('### 架构影响', '### 其他'),
            specs: [{ capability: 'alpha', body: SPECS_OK }],
            tasks: tasksNoAnchor,
        });
        try {
            const result = buildReadiness(toModel(fixture), LEGACY_CHANGE);
            const anchors = result.checks.find((check) => check.id === 'anchors');
            expect(anchors?.status).toBe('skipped');
            expect(result.valid).toBe(true);
            expect(result.skipped).toContain('anchors');
            expect(result.legacyWarnings.some((item) => item.code === 'missing-verify-anchor')).toBe(true);
            // 存量缺失记 warning，MUST NOT 出现在阻断性 diagnostics 中
            expect(result.diagnostics.some((item) => item.severity === 'error' && item.code === 'missing-verify-anchor')).toBe(false);
        } finally {
            fs.rmSync(fixture.dir, { recursive: true, force: true });
        }
    });

    it('新变更缺锚点阻断（error）', () => {
        const fixture = writeFixture({
            proposal: PROPOSAL_OK.replace('### Impact Analysis', '### 其他'),
            design: DESIGN_OK,
            specs: [{ capability: 'alpha', body: SPECS_OK }],
            tasks: TASKS_OK,
        });
        try {
            const result = buildReadiness(toModel(fixture), NEW_CHANGE);
            expect(result.valid).toBe(false);
            const anchors = result.checks.find((check) => check.id === 'anchors');
            expect(anchors?.status).toBe('fail');
            expect(result.diagnostics.some((item) => item.severity === 'error' && item.code === 'missing-verify-anchor')).toBe(true);
        } finally {
            fs.rmSync(fixture.dir, { recursive: true, force: true });
        }
    });

    it('created 缺失按新变更处理', () => {
        const fixture = writeFixture({
            proposal: PROPOSAL_OK.replace('### Impact Analysis', '### 其他'),
            design: DESIGN_OK,
            specs: [{ capability: 'alpha', body: SPECS_OK }],
            tasks: TASKS_OK,
        });
        try {
            const result = buildReadiness(toModel(fixture), {});
            expect(result.valid).toBe(false);
            expect(result.checks.find((check) => check.id === 'anchors')?.status).toBe('fail');
        } finally {
            fs.rmSync(fixture.dir, { recursive: true, force: true });
        }
    });

    it('skip_specs 豁免能力对齐', () => {
        const fixture = writeFixture({
            proposal: PROPOSAL_OK.replace('- `alpha`: 第一个能力', '- `ghost`: 未建目录'),
            design: DESIGN_OK,
            specs: [{ capability: 'alpha', body: SPECS_OK }],
            tasks: TASKS_OK,
        });
        try {
            const result = buildReadiness(toModel(fixture), { ...NEW_CHANGE, skipSpecs: true });
            const capabilities = result.checks.find((check) => check.id === 'capabilities');
            expect(capabilities?.status).toBe('skipped');
            expect(result.skipped).toContain('capabilities');
            expect(result.diagnostics.some((item) => item.code === 'capability-without-spec')).toBe(false);
        } finally {
            fs.rmSync(fixture.dir, { recursive: true, force: true });
        }
    });

    it('design 缺失时不因架构影响锚点阻断', () => {
        const fixture = writeFixture({
            proposal: PROPOSAL_OK,
            specs: [{ capability: 'alpha', body: SPECS_OK }],
            tasks: TASKS_OK,
        });
        try {
            const result = buildReadiness(toModel(fixture), NEW_CHANGE);
            const anchors = result.checks.find((check) => check.id === 'anchors');
            expect(anchors?.status).toBe('pass');
        } finally {
            fs.rmSync(fixture.dir, { recursive: true, force: true });
        }
    });

    it('legacyJson：锚点判定 SKIP', () => {
        const fixture = writeFixture({});
        try {
            const model: ParsedChange = {
                changeName: 'legacy',
                changeRoot: fixture.dir,
                specs: [],
                diagnostics: [],
                warnings: [],
            };
            const result = buildReadiness(model, { legacyJson: true, created: '2099-01-01' });
            expect(result.checks.find((check) => check.id === 'anchors')?.status).toBe('skipped');
        } finally {
            fs.rmSync(fixture.dir, { recursive: true, force: true });
        }
    });
});
