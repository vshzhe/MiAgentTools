import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildProgram } from '../src/cli/index.js';
import { getApplyInstructions, getInstructionsResult, runSpecStatus, runSpecValidate } from '../src/commands/spec.js';

function makeProject(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-markdown-cli-'));
}

function makeChange(root: string, name = 'demo'): string {
    const dir = path.join(root, 'openspec', 'changes', name);
    fs.mkdirSync(path.join(dir, 'specs', 'demo'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.openspec.yaml'), 'schema: spec-driven\ncreated: 2026-10-16\n');
    fs.writeFileSync(path.join(dir, 'proposal.md'), '# Proposal\n\n## Why\n测试\n\n## What Changes\n- 变更\n\n## Capabilities\n\n### New Capabilities\n- `demo`: 演示\n\n## Impact\n无\n');
    fs.writeFileSync(path.join(dir, 'design.md'), '# Design\n\n## Context\n上下文\n\n## Goals / Non-Goals\n\n## Decisions\n\n### D1: 方案\n选择 Markdown\n\n## Risks / Trade-offs\n无\n');
    fs.writeFileSync(path.join(dir, 'specs', 'demo', 'spec.md'), '## ADDED Requirements\n\n### Requirement: Markdown source\n系统 SHALL 使用 Markdown。\n\n#### Scenario: Read source\n- **WHEN** 读取\n- **THEN** 返回\n');
    fs.writeFileSync(path.join(dir, 'tasks.md'), '# Tasks\n\n## 1. Core\n\n- [ ] [代码] 1.1 实现\n  - Spec Ref：demo / Markdown source\n  - Scenario Ref：demo / Markdown source / Read source\n  - 验证：pnpm test\n');
    return dir;
}

describe('Markdown-first spec CLI', () => {
    let root: string;
    let cwd: string;

    beforeEach(() => {
        root = makeProject();
        cwd = process.cwd();
        process.chdir(root);
    });

    afterEach(() => {
        process.chdir(cwd);
        process.exitCode = 0;
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('status 从 Markdown 判定 artifact 和 tasks 进度', () => {
        const dir = makeChange(root);
        const result = runSpecStatus(root, { change: 'demo', json: true });
        const payload = JSON.parse(result.output);
        expect(result.exitCode).toBe(0);
        expect(payload.artifacts.every((artifact: { status: string }) => artifact.status === 'done')).toBe(true);
        expect(payload.progress).toEqual({ total: 1, complete: 0, remaining: 1 });
        expect(fs.existsSync(path.join(dir, 'change.json'))).toBe(false);
        expect(fs.existsSync(path.join(dir, 'tasks.json'))).toBe(false);
    });

    it('非法 spec 报告 invalid 和诊断行号', () => {
        const dir = makeChange(root);
        fs.writeFileSync(path.join(dir, 'specs', 'demo', 'spec.md'), '## ADDED Requirements\n\n### Requirement: Broken\n缺少 Scenario\n');
        const result = runSpecStatus(root, { change: 'demo', json: true });
        const payload = JSON.parse(result.output);
        const specs = payload.artifacts.find((artifact: { id: string }) => artifact.id === 'specs');
        expect(specs.status).toBe('invalid');
        expect(specs.diagnostics[0].line).toBeGreaterThan(0);
    });

    it('instructions 和 apply 上下文返回 Markdown 路径', () => {
        const dir = makeChange(root);
        const info = getInstructionsResult(root, 'demo', 'tasks');
        expect(info.outputPath).toBe('tasks.md');
        expect(info.template).toContain('- [ ]');
        expect('jsonTemplate' in info).toBe(false);

        const apply = getApplyInstructions(root, 'demo');
        expect(apply.contextFiles.proposal).toContain('proposal.md');
        expect(apply.contextFiles.specs).toContain(`${path.sep}specs`);
        expect(apply.contextFiles.design).toContain('design.md');
        expect(apply.contextFiles.tasks).toContain('tasks.md');
        expect(apply.taskList[0].text).toContain('1.1');
        expect(fs.existsSync(path.join(dir, 'change.json'))).toBe(false);
    });

    it('validate 命令对合法 Markdown 返回有效', () => {
        makeChange(root);
        const result = runSpecValidate(root, 'demo');
        expect(result.valid).toBe(true);
    });

    it('CLI --json 只输出状态，不生成 JSON artifact', () => {
        const dir = makeChange(root);
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        buildProgram().parse(['node', 'iagent', 'spec', 'status', '--change', 'demo', '--json']);
        logSpy.mockRestore();
        expect(fs.existsSync(path.join(dir, 'change.json'))).toBe(false);
        expect(fs.existsSync(path.join(dir, 'tasks.json'))).toBe(false);
    });
});
