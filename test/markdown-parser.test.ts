import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseDesign } from '../src/core/spec/parser/design-parser.js';
import { parseProposal } from '../src/core/spec/parser/proposal-parser.js';
import {
    findMarkdownFiles,
    parseHeadings,
    parseSections,
    readMarkdownDocument,
} from '../src/core/spec/parser/markdown-parser.js';

function withTempMarkdown(content: string, callback: (filePath: string, root: string) => void): void {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-markdown-parser-'));
    const filePath = path.join(root, 'document.md');
    fs.writeFileSync(filePath, content, 'utf8');
    try {
        callback(filePath, root);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

describe('markdown parser', () => {
    it('解析标题和 section，并忽略代码围栏中的伪标题', () => {
        withTempMarkdown(
            '# Title\r\n\r\n## Context\r\n正文\r\n\r\n```md\r\n## Not a section\r\n```\r\n\r\n## Decisions\r\n内容',
            (filePath) => {
                const document = readMarkdownDocument(filePath);
                expect(parseHeadings(document).map((heading) => heading.text)).toEqual([
                    'Title',
                    'Context',
                    'Decisions',
                ]);
                expect(parseSections(document)).toHaveLength(3);
            },
        );
    });

    it('报告 proposal 缺失章节和重复章节', () => {
        withTempMarkdown(
            '# Proposal\n\n## Why\n原因\n\n## Why\n重复\n',
            (filePath) => {
                const parsed = parseProposal(filePath);
                expect(parsed.sections.has('Why')).toBe(true);
                expect(parsed.diagnostics.some((item) => item.code === 'duplicate-section')).toBe(true);
                expect(parsed.diagnostics.filter((item) => item.code === 'missing-section')).toHaveLength(3);
            },
        );
    });

    it('保留 proposal 中的表格、代码块和 Mermaid 内容', () => {
        withTempMarkdown(
            '# Proposal\n\n## Why\n背景\n\n## What Changes\n| A | B |\n|---|---|\n| x | y |\n\n```ts\nconst value = 1;\n```\n\n## Capabilities\n- cap\n\n## Impact\n```mermaid\nflowchart TD\n A --> B\n```\n',
            (filePath) => {
                const parsed = parseProposal(filePath);
                expect(parsed.sections.get('What Changes')?.body).toContain('| A | B |');
                expect(parsed.sections.get('What Changes')?.body).toContain('const value = 1;');
                expect(parsed.sections.get('Impact')?.body).toContain('flowchart TD');
            },
        );
    });

    it('解析 design 决策并报告非结构化 Decisions', () => {
        withTempMarkdown(
            '# Design\n\n## Context\n上下文\n\n## Goals / Non-Goals\n目标\n\n## Decisions\n\n### D1: 选择 Markdown\n- **选择**：直接编辑\n\n## Risks / Trade-offs\n风险\n',
            (filePath) => {
                const parsed = parseDesign(filePath);
                expect(parsed.decisions).toEqual([
                    expect.objectContaining({ id: 'D1', title: '选择 Markdown' }),
                ]);
                expect(parsed.diagnostics).toHaveLength(0);
            },
        );
    });

    it('发现递归 Markdown 文件并排序', () => {
        withTempMarkdown('', (_filePath, root) => {
            fs.mkdirSync(path.join(root, 'nested'), { recursive: true });
            fs.writeFileSync(path.join(root, 'nested', 'b.md'), '# b');
            fs.writeFileSync(path.join(root, 'a.md'), '# a');
            expect(findMarkdownFiles(root).map((filePath) => path.basename(filePath))).toEqual([
                'a.md',
                'document.md',
                'b.md',
            ]);
        });
    });
});
