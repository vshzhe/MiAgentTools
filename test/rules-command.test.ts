/**
 * rule-baseline：iagent rules 枚举规则源（存在性 / sha256 / 排除 openspec/rules）。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { collectRuleSources, renderRulesText } from '../src/commands/rules.js';

function makeTempProject(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-rules-'));
}

describe('collectRuleSources', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('枚举存在的规则源并计算 sha256 / rules 列表', () => {
        fs.mkdirSync(path.join(projectRoot, '.iagent', 'rules'), { recursive: true });
        fs.writeFileSync(
            path.join(projectRoot, '.iagent', 'config.yaml'),
            'context: |\n  项目背景\nrules:\n  - impl\n  - test\n',
            'utf8',
        );
        fs.writeFileSync(path.join(projectRoot, '.iagent', 'rules', 'coding-rules.md'), '零猜测\n', 'utf8');
        fs.writeFileSync(path.join(projectRoot, 'CLAUDE.md'), '# claude\n', 'utf8');
        fs.writeFileSync(path.join(projectRoot, 'AGENTS.md'), '# agents\n', 'utf8');

        const output = collectRuleSources(projectRoot);
        const byPath = new Map(output.sources.map((source) => [source.path, source]));
        expect(byPath.get('.iagent/config.yaml')?.exists).toBe(true);
        expect(byPath.get('.iagent/config.yaml')?.rules).toEqual(['impl', 'test']);
        expect(byPath.get('.iagent/rules/coding-rules.md')?.exists).toBe(true);
        expect(byPath.get('.iagent/rules/coding-rules.md')?.sha256).toHaveLength(12);
        expect(byPath.get('CLAUDE.md')?.exists).toBe(true);
        expect(byPath.get('AGENTS.md')?.exists).toBe(true);
    });

    it('规则源缺失：exists=false 且 sha256=null', () => {
        const output = collectRuleSources(projectRoot);
        const claude = output.sources.find((source) => source.path === 'CLAUDE.md');
        expect(claude?.exists).toBe(false);
        expect(claude?.sha256).toBeNull();
        const config = output.sources.find((source) => source.path === '.iagent/config.yaml');
        expect(config?.exists).toBe(false);
    });

    it('不枚举 openspec/rules', () => {
        fs.mkdirSync(path.join(projectRoot, 'openspec', 'rules'), { recursive: true });
        fs.writeFileSync(path.join(projectRoot, 'openspec', 'rules', 'ai-coding.md'), '旧规则\n', 'utf8');
        const output = collectRuleSources(projectRoot);
        expect(output.sources.some((source) => source.path.startsWith('openspec/rules'))).toBe(false);
    });

    it('文本渲染列出存在与缺失', () => {
        fs.writeFileSync(path.join(projectRoot, 'CLAUDE.md'), '# claude\n', 'utf8');
        const text = renderRulesText(collectRuleSources(projectRoot));
        expect(text).toContain('CLAUDE.md');
        expect(text).toContain('CLAUDE.md（');
        expect(text).toContain('AGENTS.md（不存在）');
    });
});

describe('rules --type：按技能类型筛选并分层', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
        fs.mkdirSync(path.join(projectRoot, '.iagent', 'rules'), { recursive: true });
        fs.writeFileSync(path.join(projectRoot, '.iagent', 'config.yaml'), 'rules:\n  - coding-rules\n', 'utf8');
        fs.writeFileSync(path.join(projectRoot, '.iagent', 'rules', 'coding-rules.md'), '# impl\n', 'utf8');
        fs.writeFileSync(path.join(projectRoot, '.iagent', 'rules', 'testing-rules.md'), '# test\n', 'utf8');
        fs.writeFileSync(path.join(projectRoot, '.iagent', 'rules', 'spec.md'), '# spec\n', 'utf8');
        fs.writeFileSync(path.join(projectRoot, 'AGENTS.md'), '# agents\n', 'utf8');
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('Scenario: 按类型筛选（test）', () => {
        const output = collectRuleSources(projectRoot, ['test']);
        expect(output.classification).toBeDefined();
        expect(output.classification!.type).toBe('test');
        expect(output.classification!.phase).toEqual(['.iagent/rules/testing-rules.md']);
        // 常驻基线恒含
        expect(output.classification!.always).toContain('.iagent/config.yaml');
        expect(output.classification!.always).toContain('AGENTS.md');
        // 其他类型的规则文件进 onDemand，不丢失
        expect(output.classification!.onDemand).toContain('.iagent/rules/coding-rules.md');
        expect(output.classification!.onDemand).toContain('.iagent/rules/spec.md');
    });

    it('Scenario: 多个类型（impl,test）', () => {
        const output = collectRuleSources(projectRoot, ['impl', 'test']);
        expect(output.classifications).toHaveLength(2);
        expect(output.classifications![0].phase).toEqual(['.iagent/rules/coding-rules.md']);
        expect(output.classifications![1].phase).toEqual(['.iagent/rules/testing-rules.md']);
    });

    it('Scenario: 无参输出不变（不含 classification）', () => {
        const output = collectRuleSources(projectRoot);
        expect(Object.keys(output)).toEqual(['sources']);
        expect(output.sources.every((source) => 'path' in source && 'kind' in source)).toBe(true);
    });

    it('Scenario: 无匹配类型时 fallback 且不扩为全量', () => {
        const output = collectRuleSources(projectRoot, ['commit']);
        expect(output.classification!.fallback).toBe(true);
        expect(output.classification!.phase).toEqual([]);
        expect(output.classification!.fallbackReason).toContain('commit');
        expect(output.classification!.always.length).toBeGreaterThan(0);
    });
});
