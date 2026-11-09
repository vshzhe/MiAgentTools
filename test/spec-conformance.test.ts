/**
 * spec-conformance：三层实现一致性判定、conformance 子命令与 validate --conformance。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createChange } from '../src/core/spec/new-change.js';
import { parseSpec } from '../src/core/spec/parser/spec-parser.js';
import { parseTasks } from '../src/core/spec/parser/task-parser.js';
import { buildConformance, renderConformanceReport } from '../src/core/spec/validation/conformance.js';
import { runSpecConformance, runSpecValidate } from '../src/commands/spec.js';

function makeTempProject(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-conformance-'));
}

function writeSpec(changeRoot: string, capability: string, scenarios: string[]): string {
    const dir = path.join(changeRoot, 'specs', capability);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'spec.md');
    const body = [
        '## ADDED Requirements',
        '',
        '### Requirement: 登录',
        '登录 SHALL 校验用户名与密码。',
        '',
        ...scenarios.flatMap((name) => [
            `#### Scenario: ${name}`,
            '- **WHEN** 用户提交凭据',
            '- **THEN** 返回登录结果',
            '',
        ]),
    ].join('\n');
    fs.writeFileSync(file, body, 'utf8');
    return file;
}

function writeTasks(changeRoot: string, body: string): string {
    const file = path.join(changeRoot, 'tasks.md');
    fs.writeFileSync(file, body, 'utf8');
    return file;
}

const TASKS_WITH_TEST = `## 1. 实现

- [x] 1.1 [代码] 实现登录
  - 文件：\`src/login.ts\`
  - Spec Ref：auth / 登录
  - Scenario Ref：成功登录

- [ ] 1.2 [测试][单元][P0] 登录测试
  - Spec Ref：auth / 登录
  - Scenario Ref：成功登录
`;

describe('buildConformance 三层判定', () => {
    let projectRoot: string;
    let changeRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
        changeRoot = path.join(projectRoot, 'openspec', 'changes', 'add-login');
        fs.mkdirSync(changeRoot, { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('三层全部覆盖：pass', () => {
        const specFile = writeSpec(changeRoot, 'auth', ['成功登录']);
        const tasksFile = writeTasks(changeRoot, TASKS_WITH_TEST);
        const result = buildConformance(
            [parseSpec(specFile)],
            parseTasks(tasksFile).tasks,
            { tasksFilePath: tasksFile, outputByTask: { '1.1': ['src/login.ts'] } },
        );
        expect(result.valid).toBe(true);
        expect(result.matrix).toHaveLength(1);
        expect(result.matrix[0].status).toBe('covered');
        expect(result.matrix[0].testEvidence).toEqual(['1.2']);
    });

    it('Requirement 无任务覆盖：requirement-without-task', () => {
        const specFile = writeSpec(changeRoot, 'auth', ['成功登录']);
        const tasksFile = writeTasks(changeRoot, `## 1. 实现\n\n- [ ] 1.1 [代码] 其他任务\n  - Spec Ref：auth / 其他需求\n`);
        const result = buildConformance([parseSpec(specFile)], parseTasks(tasksFile).tasks, { tasksFilePath: tasksFile });
        expect(result.valid).toBe(false);
        expect(result.findings.map((item) => item.code)).toContain('requirement-without-task');
    });

    it('Scenario 无 [测试] 任务：scenario-without-test', () => {
        const specFile = writeSpec(changeRoot, 'auth', ['成功登录']);
        const tasksFile = writeTasks(changeRoot, `## 1. 实现\n\n- [x] 1.1 [代码] 实现登录\n  - 文件：\`src/login.ts\`\n  - Spec Ref：auth / 登录\n  - Scenario Ref：成功登录\n`);
        const result = buildConformance([parseSpec(specFile)], parseTasks(tasksFile).tasks, {
            tasksFilePath: tasksFile,
            outputByTask: { '1.1': ['src/login.ts'] },
        });
        expect(result.valid).toBe(false);
        expect(result.findings.map((item) => item.code)).toContain('scenario-without-test');
    });

    it('已勾选任务缺少产出证据：missing-implementation-evidence', () => {
        const specFile = writeSpec(changeRoot, 'auth', ['成功登录']);
        const tasksFile = writeTasks(
            changeRoot,
            TASKS_WITH_TEST.replace('  - 文件：`src/login.ts`\n', ''),
        );
        const result = buildConformance([parseSpec(specFile)], parseTasks(tasksFile).tasks, { tasksFilePath: tasksFile });
        expect(result.valid).toBe(false);
        expect(result.findings.map((item) => item.code)).toContain('missing-implementation-evidence');
    });

    it('未勾选任务不要求产出证据', () => {
        const specFile = writeSpec(changeRoot, 'auth', ['成功登录']);
        const tasksFile = writeTasks(changeRoot, TASKS_WITH_TEST.replace('- [x] 1.1', '- [ ] 1.1'));
        const result = buildConformance([parseSpec(specFile)], parseTasks(tasksFile).tasks, { tasksFilePath: tasksFile });
        expect(result.findings.map((item) => item.code)).not.toContain('missing-implementation-evidence');
    });

    it('skip_specs：不报失败并给出 notice', () => {
        const result = buildConformance([], [], { skipSpecs: true });
        expect(result.valid).toBe(true);
        expect(result.notices.join('\n')).toContain('skip_specs');
    });

    it('历史 JSON-only：只读降级并给出 notice', () => {
        const result = buildConformance([], [], { legacyJson: true });
        expect(result.valid).toBe(true);
        expect(result.notices.join('\n')).toContain('历史 JSON-only');
    });

    it('规则源未读：rules-not-read', () => {
        const result = buildConformance([], [], {
            rules: { required: ['CLAUDE.md', '.iagent/rules/coding-rules.md'], read: ['CLAUDE.md'] },
        });
        expect(result.valid).toBe(false);
        expect(result.findings.map((item) => item.code)).toContain('rules-not-read');
    });

    it('证据报告含九列与 summary 行', () => {
        const specFile = writeSpec(changeRoot, 'auth', ['成功登录']);
        const tasksFile = writeTasks(changeRoot, TASKS_WITH_TEST);
        const result = buildConformance([parseSpec(specFile)], parseTasks(tasksFile).tasks, {
            tasksFilePath: tasksFile,
            outputByTask: { '1.1': ['src/login.ts'] },
        });
        const report = renderConformanceReport('add-login', result);
        for (const column of ['change', 'requirement', 'scenario', 'coveringTasks', 'taskStatus', 'implementationEvidence', 'testEvidence', 'status', 'reason']) {
            expect(report).toContain(column);
        }
        expect(report).toContain('**summary**: status=pass');
    });
});

describe('runSpecConformance', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
        createChange(projectRoot, 'add-login');
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('JSON 覆盖矩阵输出与 strict/报告模式', () => {
        const changeRoot = path.join(projectRoot, 'openspec', 'changes', 'add-login');
        writeSpec(changeRoot, 'auth', ['成功登录']);
        writeTasks(changeRoot, TASKS_WITH_TEST.replace('- [x] 1.1', '- [ ] 1.1'));
        const report = runSpecConformance(projectRoot, 'add-login');
        expect(report.output.mode).toBe('report');
        expect(report.output.matrix).toHaveLength(1);
        expect(report.output.matrix[0]).toHaveProperty('coveringTasks');
        expect(report.output.matrix[0]).toHaveProperty('testEvidence');
        const strict = runSpecConformance(projectRoot, 'add-login', { strict: true });
        expect(strict.output.mode).toBe('strict');
    });

    it('skip_specs 变更不误报', () => {
        const changeRoot = path.join(projectRoot, 'openspec', 'changes', 'add-login');
        fs.writeFileSync(path.join(changeRoot, '.openspec.yaml'), 'schema: spec-driven\nskip_specs: true\n', 'utf8');
        const result = runSpecConformance(projectRoot, 'add-login', { strict: true });
        expect(result.output.valid).toBe(true);
        expect(result.output.notices.join('\n')).toContain('skip_specs');
    });

    it('严重缺失返回 findings 与 valid=false', () => {
        const changeRoot = path.join(projectRoot, 'openspec', 'changes', 'add-login');
        writeSpec(changeRoot, 'auth', ['成功登录']);
        writeTasks(changeRoot, `## 1. 实现\n\n- [ ] 1.1 [代码] 其他任务\n  - Spec Ref：auth / 其他需求\n`);
        const result = runSpecConformance(projectRoot, 'add-login', { strict: true });
        expect(result.output.valid).toBe(false);
        expect(result.output.findings.length).toBeGreaterThan(0);
    });
});

describe('validate --conformance 严格模式', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
        createChange(projectRoot, 'add-login');
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('默认模式：未覆盖 Scenario 仅为 warning，valid 不变', () => {
        const changeRoot = path.join(projectRoot, 'openspec', 'changes', 'add-login');
        writeSpec(changeRoot, 'auth', ['成功登录']);
        writeTasks(changeRoot, `## 1. 实现\n\n- [ ] 1.1 [代码] 其他任务\n  - Spec Ref：auth / 其他需求\n`);
        const result = runSpecValidate(projectRoot, 'add-login');
        const untested = result.diagnostics.filter((item) => item.code === 'untested-scenario');
        expect(untested.length).toBeGreaterThan(0);
        expect(untested.every((item) => item.severity === 'warning')).toBe(true);
    });

    it('严格模式：未覆盖 Scenario 升级为 error', () => {
        const changeRoot = path.join(projectRoot, 'openspec', 'changes', 'add-login');
        writeSpec(changeRoot, 'auth', ['成功登录']);
        writeTasks(changeRoot, `## 1. 实现\n\n- [ ] 1.1 [代码] 其他任务\n  - Spec Ref：auth / 其他需求\n`);
        const result = runSpecValidate(projectRoot, 'add-login', { conformance: true });
        expect(result.valid).toBe(false);
        const codes = result.diagnostics.map((item) => item.code);
        expect(codes).toContain('untested-scenario');
        expect(codes).toContain('requirement-without-task');
    });
});
