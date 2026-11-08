import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseSpec } from '../src/core/spec/parser/spec-parser.js';
import { parseTasks } from '../src/core/spec/parser/task-parser.js';
import { isLeafScenarioRef, resolveScenarioRefs } from '../src/core/spec/parser/reference-resolver.js';
import { validateParsedChange } from '../src/core/spec/validation/artifact-validator.js';
import type { ParsedChange } from '../src/core/spec/model/artifact-model.js';

function makeRoot(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-artifact-parser-'));
}

function write(root: string, relative: string, content: string): string {
    const filePath = path.join(root, relative);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
}

describe('spec/task parser and validator', () => {
    it('解析四级 Scenario、WHEN/THEN 以及 REMOVED 字段', () => {
        const root = makeRoot();
        try {
            const filePath = write(root, 'specs/demo/spec.md', `# Spec Delta\n\n## ADDED Requirements\n\n### Requirement: Markdown source\n系统 SHALL 使用 Markdown。\n\n#### Scenario: Valid input\n- **GIVEN** 文件存在\n- **WHEN** 读取文件\n- **THEN** 返回内容\n\n## REMOVED Requirements\n\n### Requirement: Legacy source\n**Reason**: 重复\n**Migration**: 使用 Markdown\n`);
            const parsed = parseSpec(filePath, 'demo');
            expect(parsed.requirements).toHaveLength(2);
            expect(parsed.requirements[0].scenarios[0]).toMatchObject({
                name: 'Valid input',
                given: '文件存在',
                when: '读取文件',
                then: '返回内容',
            });
            expect(parsed.requirements[1]).toMatchObject({
                operation: 'REMOVED',
                reason: '重复',
                migration: '使用 Markdown',
            });
            expect(parsed.diagnostics.filter((item) => item.severity === 'error')).toHaveLength(0);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('解析 tasks 标签、依赖和可读引用', () => {
        const root = makeRoot();
        try {
            const filePath = write(root, 'tasks.md', `# Tasks\n\n## 1. Core\n\n- [ ] [代码] 1.1 实现解析器\n  - 文件：\`src/parser.ts\`\n  - Spec Ref：demo / Markdown source\n  - Scenario Ref：demo / Markdown source / Valid input\n  - 验证：pnpm test\n\n- [x] [测试][单元][P0] 1.2 增加测试\n  - 依赖：1.1\n  - 文件：\`test/parser.test.ts\`\n`);
            const parsed = parseTasks(filePath);
            expect(parsed.tasks).toHaveLength(2);
            expect(parsed.tasks[0]).toMatchObject({
                id: '1.1',
                checked: false,
                kind: '代码',
                files: ['src/parser.ts'],
                specRefs: ['demo / Markdown source'],
                scenarioRefs: ['demo / Markdown source / Valid input'],
                verification: 'pnpm test',
            });
            expect(parsed.tasks[1]).toMatchObject({
                id: '1.2',
                checked: true,
                kind: '测试',
                testLevel: '单元',
                priority: 'P0',
                dependencies: ['1.1'],
            });
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('报告空 Scenario、失效依赖和失效引用，并保留文件行号', () => {
        const root = makeRoot();
        try {
            const specPath = write(root, 'specs/demo/spec.md', `## ADDED Requirements\n\n### Requirement: Empty\n正文\n`);
            const tasksPath = write(root, 'tasks.md', `# Tasks\n\n- [ ] [未知标签] 1.1 任务\n  - 依赖：9.9\n  - Spec Ref：demo / Missing\n`);
            const spec = parseSpec(specPath, 'demo');
            const tasks = parseTasks(tasksPath);
            const change: ParsedChange = {
                changeName: 'demo',
                changeRoot: root,
                specs: [spec],
                tasks,
                diagnostics: [],
                warnings: [],
            };
            const result = validateParsedChange(change);
            expect(result.valid).toBe(false);
            expect(result.diagnostics.some((item) => item.code === 'missing-scenario')).toBe(true);
            expect(result.diagnostics.some((item) => item.code === 'missing-task-dependency')).toBe(true);
            expect(result.diagnostics.some((item) => item.code === 'invalid-spec-ref')).toBe(true);
            expect(result.diagnostics.every((item) => item.line > 0 && item.filePath.length > 0)).toBe(true);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('检测任务循环依赖并支持 CRLF 与 Unicode', () => {
        const root = makeRoot();
        try {
            const tasksPath = write(root, 'tasks.md', '# 任务\r\n\r\n- [ ] 1.1 处理中文数据\r\n  - 依赖：1.2\r\n\r\n- [ ] 1.2 处理边界\r\n  - 依赖：1.1\r\n');
            const parsed = parseTasks(tasksPath);
            expect(parsed.tasks.map((task) => task.description)).toEqual(['处理中文数据', '处理边界']);
            expect(parsed.diagnostics.some((item) => item.code === 'cyclic-task-dependency')).toBe(true);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

/** 写一个能力规格（供追溯测试复用） */
function writeDemoSpec(root: string): string {
    return write(root, 'specs/demo/spec.md', `## ADDED Requirements\n\n### Requirement: Markdown source\n系统 SHALL 使用 Markdown。\n\n#### Scenario: Valid input\n- **WHEN** 读取文件\n- **THEN** 返回内容\n`);
}

/** 用 demo 单能力规格与 tasks.md 构造 ParsedChange */
function buildChange(root: string, tasksContent: string): ParsedChange {
    const spec = parseSpec(writeDemoSpec(root));
    const tasks = parseTasks(write(root, 'tasks.md', tasksContent));
    return { changeName: 'demo', changeRoot: root, specs: [spec], tasks, diagnostics: [], warnings: [] };
}

describe('Spec Ref / Scenario Ref 多形态解析（D3）', () => {
    it('Scenario: HTML 注释式引用被解析', () => {
        const root = makeRoot();
        try {
            const tasksPath = write(
                root,
                'tasks.md',
                '# Tasks\n\n- [ ] [代码] 1.1 实现\n  <!-- Spec Ref: demo → Requirement: "Markdown source" → Scenario: "Valid input" -->\n',
            );
            const parsed = parseTasks(tasksPath);
            expect(parsed.tasks[0].specRefs).toEqual(['demo / Markdown source']);
            expect(parsed.tasks[0].scenarioRefs).toEqual(['demo / Markdown source / Valid input']);
            expect(parsed.diagnostics).toHaveLength(0);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('Scenario: 一行同时包含 Spec Ref 与 Scenario Ref', () => {
        const root = makeRoot();
        try {
            const tasksPath = write(
                root,
                'tasks.md',
                '# Tasks\n\n- [ ] [代码] 1.1 实现\n  <!-- Spec Ref: demo → Requirement: "Markdown source" → Scenario: "Valid input" -->\n',
            );
            const parsed = parseTasks(tasksPath);
            expect(parsed.tasks[0].specRefs).toHaveLength(1);
            expect(parsed.tasks[0].scenarioRefs).toHaveLength(1);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('Scenario: 旧行式与裸名引用保持兼容', () => {
        const root = makeRoot();
        try {
            const tasksPath = write(
                root,
                'tasks.md',
                '# Tasks\n\n- [ ] [代码] 1.1 实现\n  - Spec Ref：demo / Markdown source\n  - Scenario Ref：Valid input\n\n- [ ] [代码] 1.2 实现\n  * Scenario Ref: demo / Markdown source / Valid input\n',
            );
            const parsed = parseTasks(tasksPath);
            expect(parsed.tasks[0].specRefs).toEqual(['demo / Markdown source']);
            expect(parsed.tasks[0].scenarioRefs).toEqual(['Valid input']);
            expect(parsed.tasks[1].scenarioRefs).toEqual(['demo / Markdown source / Valid input']);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('Scenario: 行式（非 HTML 注释）箭头引用同样被解析', () => {
        const root = makeRoot();
        try {
            const tasksPath = write(
                root,
                'tasks.md',
                '# Tasks\n\n- [ ] [代码] 1.1 实现\n  - Spec Ref: demo → Requirement: "Markdown source" → Scenario: "Valid input"\n',
            );
            const parsed = parseTasks(tasksPath);
            expect(parsed.tasks[0].specRefs).toEqual(['demo / Markdown source']);
            expect(parsed.tasks[0].scenarioRefs).toEqual(['demo / Markdown source / Valid input']);
            expect(parsed.diagnostics).toHaveLength(0);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('Scenario: Scenario 标签行只到 Requirement 时同时产出 Spec Ref（一行双引用等价形态）', () => {
        const root = makeRoot();
        try {
            const tasksPath = write(
                root,
                'tasks.md',
                '# Tasks\n\n- [ ] [代码] 1.1 实现\n  - Scenario Ref: demo → Requirement: "Markdown source"\n',
            );
            const parsed = parseTasks(tasksPath);
            // 规范形态残缺 → Scenario Ref 保留原值（由语义层报 scenario-ref-missing-scenario），
            // 同时产出等价的 Spec Ref，避免消费者把整行误判为「仅 Scenario 覆盖」
            expect(parsed.tasks[0].specRefs).toEqual(['demo / Markdown source']);
            expect(parsed.tasks[0].scenarioRefs).toHaveLength(1);
            expect(parsed.tasks[0].scenarioRefs[0]).toContain('demo');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('追溯诊断分层（D3 / pending-ref）', () => {
    it('Scenario: 有效规格引用不产生 invalid 诊断', () => {
        const root = makeRoot();
        try {
            const change = buildChange(
                root,
                '# Tasks\n\n- [ ] [代码] 1.1 实现\n  - Spec Ref：demo / Markdown source\n  - Scenario Ref：demo / Markdown source / Valid input\n',
            );
            const result = validateParsedChange(change);
            expect(result.diagnostics.some((item) => item.code === 'invalid-spec-ref')).toBe(false);
            expect(result.diagnostics.some((item) => item.code === 'invalid-scenario-ref')).toBe(false);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('Scenario: 失效规格引用报 invalid-spec-ref', () => {
        const root = makeRoot();
        try {
            const change = buildChange(root, '# Tasks\n\n- [ ] [代码] 1.1 实现\n  - Spec Ref：demo / Missing requirement\n');
            const result = validateParsedChange(change);
            expect(result.valid).toBe(false);
            const diagnostic = result.diagnostics.find((item) => item.code === 'invalid-spec-ref');
            expect(diagnostic?.severity).toBe('error');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('Scenario: 仅 capability 的引用给出缺失 Requirement 诊断', () => {
        const root = makeRoot();
        try {
            const change = buildChange(root, '# Tasks\n\n- [ ] [代码] 1.1 实现\n  - Spec Ref：demo\n');
            const result = validateParsedChange(change);
            const diagnostic = result.diagnostics.find((item) => item.code === 'spec-ref-missing-requirement');
            expect(diagnostic?.message).toContain('缺少 Requirement');
            expect(diagnostic?.message).toContain('<capability> / <Requirement>');
            expect(diagnostic?.severity).toBe('error');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('Scenario Ref 只到 Requirement：报 scenario-ref-missing-scenario', () => {
        const root = makeRoot();
        try {
            const change = buildChange(root, '# Tasks\n\n- [ ] [代码] 1.1 实现\n  - Scenario Ref：demo / Markdown source\n');
            const result = validateParsedChange(change);
            const diagnostic = result.diagnostics.find((item) => item.code === 'scenario-ref-missing-scenario');
            expect(diagnostic?.message).toContain('缺少 Scenario');
            expect(diagnostic?.severity).toBe('error');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('Scenario: 起草期未匹配引用降级为 pending-ref', () => {
        const root = makeRoot();
        try {
            const change = buildChange(root, '# Tasks\n\n- [ ] [代码] 1.1 实现\n  - Spec Ref：demo / Future requirement\n');
            const result = validateParsedChange(change, { degradeUnmatchedRefs: true });
            expect(result.valid).toBe(true);
            const diagnostic = result.diagnostics.find((item) => item.code === 'pending-ref');
            expect(diagnostic?.severity).toBe('warning');
            expect(diagnostic?.message).toContain('pending-ref');
            // 同一引用在 specs 完成后（不降级）仍为 error
            const strict = validateParsedChange(change);
            expect(strict.valid).toBe(false);
            expect(strict.diagnostics.some((item) => item.code === 'invalid-spec-ref')).toBe(true);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

// ── improve-task-ref-dedup：场景叶子名 + 同任务 Spec Ref 补全（D2 / D3） ──

type SpecInput = { capability: string; content: string };

/** 用多个能力规格与 tasks.md 构造 ParsedChange（供跨 capability 用例复用） */
function buildMultiSpecChange(root: string, specs: SpecInput[], tasksContent: string): ParsedChange {
    const parsedSpecs = specs.map(({ capability, content }) =>
        parseSpec(write(root, `specs/${capability}/spec.md`, content), capability));
    const tasks = parseTasks(write(root, 'tasks.md', tasksContent));
    return { changeName: 'demo', changeRoot: root, specs: parsedSpecs, tasks, diagnostics: [], warnings: [] };
}

const TWO_SCENARIO_SPEC = `## ADDED Requirements

### Requirement: Markdown source
系统 SHALL 使用 Markdown。

#### Scenario: Valid input
- **WHEN** 读取文件
- **THEN** 返回内容

#### Scenario: Invalid input
- **WHEN** 文件缺失
- **THEN** 报错
`;

describe('场景叶子名补全与跨边界匹配（D2）', () => {
    it('补全模块为纯函数：叶子名判定 / 同任务补全 / 缺失 / 歧义', () => {
        expect(isLeafScenarioRef('Valid input')).toBe(true);
        expect(isLeafScenarioRef('  Valid input  ')).toBe(true);
        expect(isLeafScenarioRef('demo / Markdown source / Valid input')).toBe(false);
        expect(isLeafScenarioRef('demo → Requirement: "Markdown source"')).toBe(false);

        expect(resolveScenarioRefs(['demo / Markdown source'], ['Valid input'])).toEqual([
            { kind: 'leaf-resolved', ref: 'Valid input', resolved: 'demo / Markdown source / Valid input' },
        ]);
        expect(resolveScenarioRefs([], ['Valid input'])[0]).toEqual({
            kind: 'missing-context',
            ref: 'Valid input',
        });
        expect(resolveScenarioRefs(['a / R1', 'b / R2'], ['S'])[0]).toMatchObject({
            kind: 'ambiguous',
            specRefCount: 2,
        });
        // 同一 Spec Ref 重复书写不构成歧义
        expect(resolveScenarioRefs(['a / R1', 'a / R1'], ['S'])[0].kind).toBe('leaf-resolved');
    });

    it('Scenario: 场景叶子名由同任务 Spec Ref 补全', () => {
        const root = makeRoot();
        try {
            const change = buildChange(
                root,
                '# Tasks\n\n- [ ] [代码] 1.1 实现\n  - Spec Ref：demo / Markdown source\n  - Scenario Ref：Valid input\n',
            );
            const result = validateParsedChange(change);
            const codes = result.diagnostics.map((item) => item.code);
            expect(result.valid).toBe(true);
            expect(codes).not.toContain('invalid-scenario-ref');
            expect(codes).not.toContain('scenario-ref-missing-context');
            expect(codes).not.toContain('ambiguous-scenario-ref');
            expect(codes).not.toContain('untested-scenario');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('Scenario: 同一任务多场景各自补全', () => {
        const root = makeRoot();
        try {
            const change = buildMultiSpecChange(root, [{ capability: 'demo', content: TWO_SCENARIO_SPEC }], [
                '# Tasks',
                '',
                '- [ ] [代码] 1.1 实现',
                '  - Spec Ref：demo / Markdown source',
                '  - Scenario Ref：Valid input',
                '  - Scenario Ref：Invalid input',
                '',
            ].join('\n'));
            const result = validateParsedChange(change);
            const codes = result.diagnostics.map((item) => item.code);
            expect(result.valid).toBe(true);
            expect(codes).not.toContain('invalid-scenario-ref');
            expect(codes).not.toContain('untested-scenario');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('Scenario: 引用值含分隔符视为全路径，不做叶子补全', () => {
        const root = makeRoot();
        try {
            const change = buildChange(
                root,
                '# Tasks\n\n- [ ] [代码] 1.1 实现\n  - Scenario Ref：demo / Markdown source / Valid input\n',
            );
            const result = validateParsedChange(change);
            const codes = result.diagnostics.map((item) => item.code);
            expect(result.valid).toBe(true);
            expect(codes).not.toContain('invalid-scenario-ref');
            expect(codes).not.toContain('scenario-ref-missing-context');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('Scenario: 叶子名不得跨 Requirement 匹配', () => {
        const root = makeRoot();
        try {
            const change = buildMultiSpecChange(root, [{
                capability: 'demo',
                content: `## ADDED Requirements

### Requirement: Markdown source
系统 SHALL 使用 Markdown。

#### Scenario: Valid input
- **WHEN** 读取文件
- **THEN** 返回内容

### Requirement: Other requirement
正文。

#### Scenario: Other scenario
- **WHEN** 其它
- **THEN** 其它
`,
            }], '# Tasks\n\n- [ ] [代码] 1.1 实现\n  - Spec Ref：demo / Markdown source\n  - Scenario Ref：Other scenario\n');
            const result = validateParsedChange(change);
            const diagnostic = result.diagnostics.find((item) => item.code === 'invalid-scenario-ref');
            expect(result.valid).toBe(false);
            expect(diagnostic?.severity).toBe('error');
            // 不得匹配到另一 Requirement 的同名场景 → 该场景仍未被覆盖
            expect(result.diagnostics.some(
                (item) => item.code === 'untested-scenario' && item.message.includes('Other scenario'),
            )).toBe(true);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('Scenario: 跨 capability 同名场景按 Spec Ref 绑定', () => {
        const root = makeRoot();
        try {
            const sharedSpec = (capability: string) => `## ADDED Requirements

### Requirement: Shared requirement
${capability} 正文。

#### Scenario: Shared scenario
- **WHEN** 触发
- **THEN** 响应
`;
            const change = buildMultiSpecChange(root, [
                { capability: 'alpha', content: sharedSpec('alpha') },
                { capability: 'beta', content: sharedSpec('beta') },
            ], '# Tasks\n\n- [ ] [代码] 1.1 实现\n  - Spec Ref：alpha / Shared requirement\n  - Scenario Ref：Shared scenario\n');
            const result = validateParsedChange(change);
            const untested = result.diagnostics.filter((item) => item.code === 'untested-scenario');
            expect(result.valid).toBe(true);
            // alpha 被绑定覆盖；beta 的同名场景不得被误计 → 仍报未覆盖
            expect(untested.some((item) => item.message.startsWith('Scenario 尚未关联任务：alpha'))).toBe(false);
            expect(untested.some((item) => item.message.startsWith('Scenario 尚未关联任务：beta'))).toBe(true);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('场景叶子名诊断分层与起草期降级（D3 / pending-ref）', () => {
    it('Scenario: 叶子名缺少上下文报诊断且不猜测归属', () => {
        const root = makeRoot();
        try {
            const change = buildChange(root, '# Tasks\n\n- [ ] [代码] 1.1 实现\n  - Scenario Ref：Valid input\n');
            const result = validateParsedChange(change);
            const diagnostic = result.diagnostics.find((item) => item.code === 'scenario-ref-missing-context');
            expect(result.valid).toBe(false);
            expect(diagnostic?.severity).toBe('error');
            expect(diagnostic?.message).toContain('缺少上下文');
            expect(diagnostic?.message).toContain('<capability> / <Requirement> / <Scenario>');
            // 不猜测归属 → 场景仍未被覆盖
            expect(result.diagnostics.some((item) => item.code === 'untested-scenario')).toBe(true);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('Scenario: 多条 Spec Ref 且场景为叶子名报歧义', () => {
        const root = makeRoot();
        try {
            const change = buildMultiSpecChange(root, [{ capability: 'demo', content: TWO_SCENARIO_SPEC }], [
                '# Tasks',
                '',
                '- [ ] [代码] 1.1 实现',
                '  - Spec Ref：demo / Markdown source',
                '  - Spec Ref：demo / Markdown source',
                '  - Scenario Ref：Valid input',
                '',
            ].join('\n'));
            // 两条相同 Spec Ref 去重后仍只有 1 条 → 不构成歧义
            expect(validateParsedChange(change).diagnostics.some(
                (item) => item.code === 'ambiguous-scenario-ref',
            )).toBe(false);

            const ambiguous = buildMultiSpecChange(root, [{ capability: 'demo', content: TWO_SCENARIO_SPEC }], [
                '# Tasks',
                '',
                '- [ ] [代码] 1.2 实现',
                '  - Spec Ref：demo / Markdown source',
                '  - Spec Ref：demo / Unknown requirement',
                '  - Scenario Ref：Valid input',
                '',
            ].join('\n'));
            const result = validateParsedChange(ambiguous);
            const diagnostic = result.diagnostics.find((item) => item.code === 'ambiguous-scenario-ref');
            expect(result.valid).toBe(false);
            expect(diagnostic?.message).toContain('歧义');
            expect(diagnostic?.message).toContain('<capability> / <Requirement> / <Scenario>');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('Scenario: 混合写法覆盖计数一次且不产生重复诊断', () => {
        const root = makeRoot();
        try {
            const covered = buildChange(root, [
                '# Tasks',
                '',
                '- [ ] [代码] 1.1 实现',
                '  - Spec Ref：demo / Markdown source',
                '  - Scenario Ref：demo / Markdown source / Valid input',
                '  - Scenario Ref：Valid input',
                '',
            ].join('\n'));
            const coveredResult = validateParsedChange(covered);
            expect(coveredResult.valid).toBe(true);
            expect(coveredResult.diagnostics.filter((item) => item.code === 'untested-scenario')).toHaveLength(0);

            // 两种写法都指向不存在的场景 → 同一目标只报一次
            const invalid = buildChange(root, [
                '# Tasks',
                '',
                '- [ ] [代码] 1.2 实现',
                '  - Spec Ref：demo / Markdown source',
                '  - Scenario Ref：demo / Markdown source / Ghost scenario',
                '  - Scenario Ref：Ghost scenario',
                '',
            ].join('\n'));
            const invalidResult = validateParsedChange(invalid);
            expect(invalidResult.diagnostics.filter((item) => item.code === 'invalid-scenario-ref')).toHaveLength(1);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('Scenario: 起草期两类新诊断降级为 pending-ref warning', () => {
        const root = makeRoot();
        try {
            const missingContext = buildChange(root, '# Tasks\n\n- [ ] [代码] 1.1 实现\n  - Scenario Ref：Valid input\n');
            const partial = validateParsedChange(missingContext, { degradeUnmatchedRefs: true });
            expect(partial.valid).toBe(true);
            expect(partial.diagnostics.some(
                (item) => item.code === 'pending-ref'
                    && item.severity === 'warning'
                    && item.message.includes('缺少上下文'),
            )).toBe(true);
            expect(partial.diagnostics.some((item) => item.code === 'scenario-ref-missing-context')).toBe(false);

            const strict = validateParsedChange(missingContext);
            expect(strict.valid).toBe(false);
            expect(strict.diagnostics.some((item) => item.code === 'scenario-ref-missing-context')).toBe(true);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('Scenario: 历史 HTML 注释式与一行双引用与两行写法等价', () => {
        const root = makeRoot();
        try {
            const htmlComment = buildChange(
                root,
                '# Tasks\n\n- [ ] [代码] 1.1 实现\n  <!-- Spec Ref: demo → Requirement: "Markdown source" → Scenario: "Valid input" -->\n',
            );
            const htmlResult = validateParsedChange(htmlComment);
            expect(htmlResult.valid).toBe(true);
            expect(htmlResult.diagnostics.filter((item) => item.code === 'untested-scenario')).toHaveLength(0);

            const oneLine = buildChange(
                root,
                '# Tasks\n\n- [ ] [代码] 1.2 实现\n  - Spec Ref: demo → Requirement: "Markdown source" → Scenario: "Valid input"\n',
            );
            const oneLineResult = validateParsedChange(oneLine);
            expect(oneLineResult.valid).toBe(true);
            expect(oneLineResult.diagnostics.filter((item) => item.code === 'untested-scenario')).toHaveLength(0);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
