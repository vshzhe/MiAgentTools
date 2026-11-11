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

    it('CLI：同名变更同日二次归档自动唯一化', () => {
        makeChange(root, 'demo');
        buildProgram().parse(['node', 'iagent', 'spec', 'archive', 'demo', '--yes']);
        const today = new Date().toISOString().slice(0, 10);
        const archiveRoot = path.join(root, 'openspec', 'changes', 'archive');
        expect(fs.existsSync(path.join(archiveRoot, `${today}-demo`))).toBe(true);

        // 重建同名变更后再次归档：目标名冲突 → 唯一化后缀
        makeChange(root, 'demo');
        buildProgram().parse(['node', 'iagent', 'spec', 'archive', 'demo', '--yes']);
        expect(fs.existsSync(path.join(archiveRoot, `${today}-demo-2`))).toBe(true);
        expect(fs.existsSync(path.join(archiveRoot, `${today}-demo`))).toBe(true);
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

/** 只写 proposal.md 的起草期变更（specs/design/tasks 尚未创建） */
function makeProposalOnlyChange(root: string, name = 'draft'): string {
    const dir = path.join(root, 'openspec', 'changes', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'proposal.md'), '# Proposal\n\n## Why\n测试\n\n## What Changes\n- 变更\n\n## Capabilities\n\n### New Capabilities\n- `demo`: 演示\n\n## Impact\n无\n');
    return dir;
}

describe('validate 模式：strict 终检 / --partial / --artifact', () => {
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

    it('Scenario: strict 模式保留终检语义（缺 tasks 报 error，不报 missing-design）', () => {
        const dir = makeChange(root);
        fs.rmSync(path.join(dir, 'tasks.md'));
        fs.rmSync(path.join(dir, 'design.md'));
        const result = runSpecValidate(root, 'demo');
        expect(result.mode).toBe('strict');
        expect(result.artifactId).toBeNull();
        expect(result.valid).toBe(false);
        const codes = result.diagnostics.filter((item) => item.severity === 'error').map((item) => item.code);
        expect(codes).toContain('missing-tasks');
        expect(codes).not.toContain('missing-design');
    });

    it('Scenario: --partial 将缺失制品记为 incomplete（无 error / valid true）', () => {
        makeProposalOnlyChange(root);
        const result = runSpecValidate(root, 'draft', { partial: true });
        expect(result.mode).toBe('partial');
        expect(result.valid).toBe(true);
        expect(result.diagnostics.every((item) => item.severity !== 'error')).toBe(true);
        const incompleteCodes = result.diagnostics
            .filter((item) => item.severity === 'incomplete')
            .map((item) => item.code);
        expect(incompleteCodes).toContain('missing-specs');
        expect(incompleteCodes).toContain('missing-tasks');
    });

    it('Scenario: --partial 仍报告已存在制品的结构错误', () => {
        const dir = makeChange(root);
        fs.writeFileSync(
            path.join(dir, 'tasks.md'),
            '# Tasks\n\n- [ ] [代码] 1.1 任务\n  - 依赖：9.9\n',
            'utf8',
        );
        const result = runSpecValidate(root, 'demo', { partial: true });
        expect(result.valid).toBe(false);
        const errorCodes = result.diagnostics.filter((item) => item.severity === 'error').map((item) => item.code);
        expect(errorCodes).toContain('missing-task-dependency');
    });

    it('Scenario: --artifact 只校验指定制品（不报 missing-proposal / missing-tasks）', () => {
        const dir = path.join(root, 'openspec', 'changes', 'specs-only');
        fs.mkdirSync(path.join(dir, 'specs', 'demo'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'specs', 'demo', 'spec.md'), '## ADDED Requirements\n\n### Requirement: Markdown source\n系统 SHALL 使用 Markdown。\n\n#### Scenario: Read source\n- **WHEN** 读取\n- **THEN** 返回\n');
        const result = runSpecValidate(root, 'specs-only', { artifact: 'specs', partial: true });
        expect(result.artifactId).toBe('specs');
        const codes = result.diagnostics.map((item) => item.code);
        expect(codes).not.toContain('missing-proposal');
        expect(codes).not.toContain('missing-tasks');
        const skipped = result.diagnostics.find((item) => item.code === 'traceability-skipped');
        expect(skipped?.severity).toBe('incomplete');
    });

    it('未知 --artifact id：valid false 并列出合法 id', () => {
        makeChange(root);
        const result = runSpecValidate(root, 'demo', { artifact: 'outline' });
        expect(result.valid).toBe(false);
        const diagnostic = result.diagnostics.find((item) => item.code === 'invalid-artifact-id');
        expect(diagnostic?.message).toContain('proposal / specs / design / tasks');
    });

    it('Scenario: skip_specs 变更不产生 missing-specs 错误', () => {
        const dir = path.join(root, 'openspec', 'changes', 'skip-demo');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, '.openspec.yaml'), 'schema: spec-driven\ncreated: 2026-11-03\nskip_specs: true\n');
        fs.writeFileSync(path.join(dir, 'proposal.md'), '# Proposal\n\n## Why\n测试\n\n## What Changes\n- 变更\n\n## Impact\n无\n');
        fs.writeFileSync(path.join(dir, 'tasks.md'), '# Tasks\n\n- [ ] [代码] 1.1 实现\n');
        const result = runSpecValidate(root, 'skip-demo');
        expect(result.valid).toBe(true);
        expect(result.diagnostics.some((item) => item.code === 'missing-specs')).toBe(false);
    });

    it('Scenario: 文本报告按行输出诊断（无字面 \\n）', () => {
        const dir = makeChange(root);
        fs.rmSync(path.join(dir, 'tasks.md'));
        fs.rmSync(path.join(dir, 'specs'), { recursive: true, force: true });
        const result = runSpecValidate(root, 'demo');
        expect(result.diagnostics.length).toBeGreaterThan(1);
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        buildProgram().parse(['node', 'iagent', 'spec', 'validate', '--change', 'demo']);
        const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
        logSpy.mockRestore();
        expect(output).not.toContain('\\n');
        expect(output.split('\n').length).toBeGreaterThan(result.diagnostics.length);
    });
});

describe('status / instructions apply JSON 契约（D9a / D9b）', () => {
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

    it('Scenario: status JSON 含路径字段', () => {
        const dir = makeChange(root);
        const result = runSpecStatus(root, { change: 'demo', json: true });
        const payload = JSON.parse(result.output);
        expect(payload.planningHome).toBe(path.join(root, 'openspec'));
        expect(payload.artifactPaths.specs.existingOutputPaths).toEqual([path.join(dir, 'specs', 'demo', 'spec.md')]);
        expect(payload.artifactPaths.tasks.resolvedOutputPath).toBe(path.join(dir, 'tasks.md'));
        expect(payload.artifactPaths.specs.resolvedOutputPath).toBe(path.join(dir, 'specs'));
    });

    it('Scenario: 可选 design 缺失时报告 optional', () => {
        const dir = makeChange(root);
        fs.rmSync(path.join(dir, 'design.md'));
        const payload = JSON.parse(runSpecStatus(root, { change: 'demo', json: true }).output);
        const byId = new Map(payload.artifacts.map((artifact: { id: string }) => [artifact.id, artifact]));
        expect(byId.get('design')?.status).toBe('optional');
        expect(byId.get('tasks')?.status).toBe('done');
        expect(payload.isPlanningComplete).toBe(true);
    });

    it('Scenario: apply JSON 返回 artifacts / applyRequires 且与 status 逐项一致', () => {
        makeChange(root);
        const statusPayload = JSON.parse(runSpecStatus(root, { change: 'demo', json: true }).output);
        const apply = getApplyInstructions(root, 'demo');
        expect(apply.applyRequires).toEqual(['tasks']);
        expect(apply.isPlanningComplete).toBe(true);
        expect(apply.planningHome).toBe(path.join(root, 'openspec'));
        expect(apply.artifactPaths.specs.resolvedOutputPath).toBe(path.join(root, 'openspec', 'changes', 'demo', 'specs'));
        expect(apply.artifacts.map((artifact) => ({ id: artifact.id, status: artifact.status })))
            .toEqual(statusPayload.artifacts.map((artifact: { id: string; status: string }) => ({ id: artifact.id, status: artifact.status })));
    });
});

// 覆盖缺口审计（improve-proposal-validation-and-spec-ref）：单制品模式的「未指定制品不报缺失」
// 与「resolvedOutputPath 可直接写入」此前只有字符串级断言，缺少语义级锁定。
describe('单制品模式与可写路径的边界语义', () => {
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

    it('Scenario: --artifact design 对缺失的可选制品不产生缺失诊断（只记录追溯跳过）', () => {
        const dir = makeChange(root);
        fs.rmSync(path.join(dir, 'design.md'));
        const result = runSpecValidate(root, 'demo', { artifact: 'design' });
        expect(result.artifactId).toBe('design');
        expect(result.valid).toBe(true);
        // design 为可选制品：缺失 MUST NOT 产生 missing-design，也 MUST NOT 记 error
        expect(result.diagnostics.some((item) => item.code === 'missing-design')).toBe(false);
        expect(result.diagnostics.every((item) => item.severity !== 'error')).toBe(true);
        // 单制品校验无法执行跨制品追溯 → 显式 incomplete（非 error，不影响 valid）
        const skipped = result.diagnostics.find((item) => item.code === 'traceability-skipped');
        expect(skipped?.severity).toBe('incomplete');
    });

    it('Scenario: --artifact tasks 不因 specs 缺失报 missing-specs（未指定制品的缺失不诊断）', () => {
        const dir = path.join(root, 'openspec', 'changes', 'tasks-only');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, '.openspec.yaml'), 'schema: spec-driven\ncreated: 2026-11-03\n');
        fs.writeFileSync(path.join(dir, 'tasks.md'), '# Tasks\n\n- [ ] [代码] 1.1 实现\n');
        const result = runSpecValidate(root, 'tasks-only', { artifact: 'tasks' });
        const codes = result.diagnostics.map((item) => item.code);
        expect(codes).not.toContain('missing-specs');
        expect(codes).not.toContain('missing-proposal');
        expect(result.valid).toBe(true);
        expect(result.diagnostics.find((item) => item.code === 'traceability-skipped')?.severity)
            .toBe('incomplete');
    });

    it('Scenario: 未匹配引用仅在 specs 未完成时降级为 pending-ref', () => {
        // ① specs 已完成（结构无 error）：--partial 仍按 error 报告引用不匹配
        const dir = makeChange(root);
        fs.writeFileSync(
            path.join(dir, 'tasks.md'),
            '# Tasks\n\n- [ ] [代码] 1.1 实现\n  - Spec Ref：demo / Missing requirement\n',
        );
        const completed = runSpecValidate(root, 'demo', { partial: true });
        expect(completed.valid).toBe(false);
        expect(completed.diagnostics.some((item) => item.code === 'invalid-spec-ref')).toBe(true);
        expect(completed.diagnostics.some((item) => item.code === 'pending-ref')).toBe(false);

        // ② specs 尚未完成（起草期的半成品：缺 Scenario → 结构 error）：同一引用降级为 pending-ref
        const dir2 = path.join(root, 'openspec', 'changes', 'draft-refs');
        fs.mkdirSync(path.join(dir2, 'specs', 'demo'), { recursive: true });
        fs.writeFileSync(path.join(dir2, '.openspec.yaml'), 'schema: spec-driven\ncreated: 2026-11-03\n');
        fs.writeFileSync(path.join(dir2, 'proposal.md'), '# Proposal\n\n## Why\n测试\n\n## What Changes\n- 变更\n\n## Capabilities\n\n### New Capabilities\n- `demo`: 演示\n\n## Impact\n无\n');
        fs.writeFileSync(
            path.join(dir2, 'specs', 'demo', 'spec.md'),
            '## ADDED Requirements\n\n### Requirement: Draft\n正文\n',
        );
        fs.writeFileSync(
            path.join(dir2, 'tasks.md'),
            '# Tasks\n\n- [ ] [代码] 1.1 实现\n  - Spec Ref：demo / Future requirement\n',
        );
        const degraded = runSpecValidate(root, 'draft-refs', { partial: true });
        const pending = degraded.diagnostics.find((item) => item.code === 'pending-ref');
        expect(pending?.severity).toBe('warning');
        expect(pending?.message).toContain('起草期降级');
        expect(degraded.diagnostics.some((item) => item.code === 'invalid-spec-ref')).toBe(false);
    });

    it('Scenario: resolvedOutputPath 可直接写入（落盘后 status 立即识别，无需 glob 展开）', () => {
        const dir = path.join(root, 'openspec', 'changes', 'writable');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, '.openspec.yaml'), 'schema: spec-driven\ncreated: 2026-11-03\n');
        const info = getInstructionsResult(root, 'writable', 'specs');
        expect(info.resolvedOutputPath).toBe(path.join(dir, 'specs'));
        expect(info.resolvedOutputPath).not.toContain('*');

        const target = path.join(info.resolvedOutputPath, 'auth', 'spec.md');
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(
            target,
            '## ADDED Requirements\n\n### Requirement: Auth\n系统 SHALL 认证。\n\n#### Scenario: Login\n- **WHEN** 登录\n- **THEN** 成功\n',
        );

        const payload = JSON.parse(runSpecStatus(root, { change: 'writable', json: true }).output);
        expect(payload.artifactPaths.specs.existingOutputPaths).toEqual([target]);
        expect(payload.artifacts.find((artifact: { id: string }) => artifact.id === 'specs').status).toBe('done');
        // 单文件制品的可写路径同样与 status 一致（无 glob、无目录猜测）
        const tasksInfo = getInstructionsResult(root, 'writable', 'tasks');
        expect(tasksInfo.resolvedOutputPath).toBe(payload.artifactPaths.tasks.resolvedOutputPath);
    });
});
