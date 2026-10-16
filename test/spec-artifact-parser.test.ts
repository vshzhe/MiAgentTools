import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseSpec } from '../src/core/spec/parser/spec-parser.js';
import { parseTasks } from '../src/core/spec/parser/task-parser.js';
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
