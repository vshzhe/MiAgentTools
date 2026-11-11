/**
 * spec 命令核心逻辑测试：new-change 创建 / archive 归档生命周期。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createChange } from '../src/core/spec/new-change.js';
import { executeArchive, previewArchive } from '../src/core/spec/archive.js';
import { getArtifactInstructions } from '../src/core/spec/instructions.js';
import { runSpecValidate } from '../src/commands/spec.js';
import { TASKS_TEMPLATE } from '../src/core/spec/templates/index.js';

/** 创建临时项目根目录 */
function makeTempProject(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-spec-cmd-'));
}

describe('iagent spec new（createChange）', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('正常创建：目录 + .openspec.yaml 含 schema/created/goal', () => {
        const result = createChange(projectRoot, 'add-auth-login', { goal: '添加登录' });
        expect(fs.existsSync(result.changeDir)).toBe(true);
        const metadata = fs.readFileSync(result.metadataPath, 'utf8');
        expect(metadata).toContain('schema: spec-driven');
        expect(metadata).toMatch(/^created: \d{4}-\d{2}-\d{2}$/m);
        expect(metadata).toContain('goal: "添加登录"');
    });

    it('目标项目无 openspec 目录：自动创建骨架（含 archive/）', () => {
        const result = createChange(projectRoot, 'first-change');
        expect(fs.existsSync(path.join(projectRoot, 'openspec', 'changes', 'archive'))).toBe(true);
        expect(fs.existsSync(result.changeDir)).toBe(true);
    });

    it('同名变更已存在：报错不覆盖', () => {
        createChange(projectRoot, 'dup-change');
        expect(() => createChange(projectRoot, 'dup-change')).toThrowError(/已存在/);
    });

    it('非 kebab-case 变更名：报错', () => {
        expect(() => createChange(projectRoot, 'Invalid_Name')).toThrowError(/kebab-case/);
    });

    it('goal 含双引号：元数据转义正确', () => {
        const result = createChange(projectRoot, 'quote-change', { goal: '含"引号"的目标' });
        const metadata = fs.readFileSync(result.metadataPath, 'utf8');
        expect(metadata).toContain('goal: "含\\"引号\\"的目标"');
    });
});

describe('iagent spec archive（previewArchive / executeArchive）', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('预览：未完成任务与未完成制品均产出警告', () => {
        const { changeDir } = createChange(projectRoot, 'incomplete-change');
        // 仅创建 change.json proposal 段，不写 specs/design/tasks（未完成）
        fs.writeFileSync(path.join(changeDir, 'change.json'), JSON.stringify({
            $schema: 'iagent/change/v1', changeName: 'incomplete-change',
            createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
            phase: 'proposal',
            proposal: { why: '测试', whatChanges: ['变更'], capabilities: { new: [], modified: [] }, impact: { files: [], breaking: false, compatibility: '兼容' } },
        }, null, 2));
        fs.writeFileSync(path.join(changeDir, 'tasks.json'), JSON.stringify({
            $schema: 'iagent/tasks/v1',
            tasks: [{ id: '1', label: '代码', description: '待办任务', status: 'pending', dependencies: [], files: [] }],
            progress: { total: 1, complete: 0, remaining: 1 },
        }, null, 2));
        const preview = previewArchive(projectRoot, 'incomplete-change');
        expect(preview.warnings.some((w) => w.includes('未完成的规划制品'))).toBe(true);
        expect(preview.tasksRemaining).toBe(1);
        // 预览不执行移动
        expect(fs.existsSync(changeDir)).toBe(true);
    });

    it('执行：变更目录移动至 archive/<日期前缀>-<名称>', () => {
        const { changeDir } = createChange(projectRoot, 'done-change');
        fs.writeFileSync(path.join(changeDir, 'change.json'), JSON.stringify({
            $schema: 'iagent/change/v1', changeName: 'done-change',
            createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
            phase: 'proposal',
            proposal: { why: '测试', whatChanges: ['变更'], capabilities: { new: [], modified: [] }, impact: { files: [], breaking: false, compatibility: '兼容' } },
            specs: [{ name: 'auth', path: 'specs/auth/spec.md', operations: [] }],
            design: { context: '上下文', goals: [], nonGoals: [], decisions: [], risks: [] },
        }, null, 2));
        fs.writeFileSync(path.join(changeDir, 'tasks.json'), JSON.stringify({
            $schema: 'iagent/tasks/v1',
            tasks: [{ id: '1', label: '代码', description: '完成', status: 'done', dependencies: [], files: [] }],
            progress: { total: 1, complete: 1, remaining: 0 },
        }, null, 2));
        const result = executeArchive(projectRoot, 'done-change');
        expect(fs.existsSync(result.archivedPath)).toBe(true);
        expect(path.basename(result.archivedPath)).toMatch(/^\d{4}-\d{2}-\d{2}-done-change$/);
        expect(fs.existsSync(changeDir)).toBe(false);
    });

    it('名称已含日期前缀：不叠加', () => {
        const { changeDir } = createChange(projectRoot, '2026-01-01-named-change');
        fs.writeFileSync(path.join(changeDir, 'change.json'), JSON.stringify({
            $schema: 'iagent/change/v1', changeName: '2026-01-01-named-change',
            createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
            phase: 'proposal',
            proposal: { why: '测试', whatChanges: ['变更'], capabilities: { new: [], modified: [] }, impact: { files: [], breaking: false, compatibility: '兼容' } },
            specs: [{ name: 'auth', path: 'specs/auth/spec.md', operations: [] }],
            design: { context: '上下文', goals: [], nonGoals: [], decisions: [], risks: [] },
        }, null, 2));
        fs.writeFileSync(path.join(changeDir, 'tasks.json'), JSON.stringify({
            $schema: 'iagent/tasks/v1',
            tasks: [{ id: '1', label: '代码', description: '完成', status: 'done', dependencies: [], files: [] }],
            progress: { total: 1, complete: 1, remaining: 0 },
        }, null, 2));
        const result = executeArchive(projectRoot, '2026-01-01-named-change');
        expect(path.basename(result.archivedPath)).toBe('2026-01-01-named-change');
    });

    it('归档目标已存在：追加唯一化后缀 -2（不覆盖既有归档）', () => {
        const today = new Date().toISOString().slice(0, 10);
        createChange(projectRoot, 'target-change');
        const conflictDir = path.join(projectRoot, 'openspec', 'changes', 'archive', `${today}-target-change`);
        fs.mkdirSync(conflictDir, { recursive: true });
        fs.writeFileSync(path.join(conflictDir, 'proposal.md'), '# 历史归档\n', 'utf8');
        const result = executeArchive(projectRoot, 'target-change');
        expect(path.basename(result.archivedPath)).toBe(`${today}-target-change-2`);
        expect(fs.existsSync(result.archivedPath)).toBe(true);
        // 既有归档目录与其内容保持不变
        expect(fs.readFileSync(path.join(conflictDir, 'proposal.md'), 'utf8')).toBe('# 历史归档\n');
    });

    it('-2 也已存在：递增到 -3', () => {
        const today = new Date().toISOString().slice(0, 10);
        createChange(projectRoot, 'target-change');
        const archiveRoot = path.join(projectRoot, 'openspec', 'changes', 'archive');
        fs.mkdirSync(path.join(archiveRoot, `${today}-target-change`), { recursive: true });
        fs.mkdirSync(path.join(archiveRoot, `${today}-target-change-2`), { recursive: true });
        const result = executeArchive(projectRoot, 'target-change');
        expect(path.basename(result.archivedPath)).toBe(`${today}-target-change-3`);
    });

    it('预览与执行目标一致（含唯一化后缀）', () => {
        const today = new Date().toISOString().slice(0, 10);
        createChange(projectRoot, 'preview-change');
        fs.mkdirSync(
            path.join(projectRoot, 'openspec', 'changes', 'archive', `${today}-preview-change`),
            { recursive: true },
        );
        const preview = previewArchive(projectRoot, 'preview-change');
        const result = executeArchive(projectRoot, 'preview-change');
        expect(preview.targetPath).toBe(result.archivedPath);
        expect(path.basename(result.archivedPath)).toBe(`${today}-preview-change-2`);
    });

    it('自带日期前缀且同名归档已存在：追加后缀且不叠加今日日期', () => {
        const { changeDir } = createChange(projectRoot, '2026-01-01-named-dup');
        expect(fs.existsSync(changeDir)).toBe(true);
        fs.mkdirSync(path.join(projectRoot, 'openspec', 'changes', 'archive', '2026-01-01-named-dup'), {
            recursive: true,
        });
        const result = executeArchive(projectRoot, '2026-01-01-named-dup');
        expect(path.basename(result.archivedPath)).toBe('2026-01-01-named-dup-2');
    });

    it('唯一化尝试超限：报错且源目录保留', () => {
        const today = new Date().toISOString().slice(0, 10);
        const { changeDir } = createChange(projectRoot, 'limit-change');
        const archiveRoot = path.join(projectRoot, 'openspec', 'changes', 'archive');
        const base = `${today}-limit-change`;
        fs.mkdirSync(path.join(archiveRoot, base), { recursive: true });
        for (let suffix = 2; suffix <= 100; suffix += 1) {
            fs.mkdirSync(path.join(archiveRoot, `${base}-${suffix}`), { recursive: true });
        }
        expect(() => executeArchive(projectRoot, 'limit-change')).toThrowError(/唯一化尝试超限/);
        expect(fs.existsSync(changeDir)).toBe(true);
    });

    it('变更不存在：报错', () => {
        expect(() => previewArchive(projectRoot, 'ghost-change')).toThrowError(/不存在/);
    });

    it('无 design 的完整变更：归档预览不报「未完成规划制品」', () => {
        const changeDir = path.join(projectRoot, 'openspec', 'changes', 'no-design-change');
        fs.mkdirSync(path.join(changeDir, 'specs', 'auth'), { recursive: true });
        fs.writeFileSync(path.join(changeDir, 'proposal.md'), '# Proposal\n\n## Why\n原因\n\n## What Changes\n- 变更\n\n## Impact\n无\n');
        fs.writeFileSync(path.join(changeDir, 'specs', 'auth', 'spec.md'), '## ADDED Requirements\n\n### Requirement: Auth\n系统 SHALL 认证。\n\n#### Scenario: Login\n- **WHEN** 登录\n- **THEN** 成功\n');
        fs.writeFileSync(path.join(changeDir, 'tasks.md'), '# Tasks\n\n- [x] [代码] 1.1 实现\n  - Spec Ref：auth / Auth\n  - Scenario Ref：auth / Auth / Login\n');
        const preview = previewArchive(projectRoot, 'no-design-change');
        expect(preview.artifactsIncomplete).toEqual([]);
        expect(preview.warnings.some((warning) => warning.includes('未完成的规划制品'))).toBe(false);
    });
});

/** 写一个最小可用的标记变更（proposal + specs 可选 + tasks 可选，无 design） */
function writeMarkdownChange(
    projectRoot: string,
    name: string,
    options: { proposal?: boolean; specs?: boolean; tasks?: boolean },
): string {
    const changeDir = path.join(projectRoot, 'openspec', 'changes', name);
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, '.openspec.yaml'), 'schema: spec-driven\ncreated: 2026-11-03\n');
    if (options.proposal !== false) {
        fs.writeFileSync(path.join(changeDir, 'proposal.md'), '# Proposal\n\n## Why\n测试\n\n## What Changes\n- 变更\n\n## Capabilities\n\n### New Capabilities\n- `demo`: 演示\n\n## Impact\n无\n');
    }
    if (options.specs) {
        fs.mkdirSync(path.join(changeDir, 'specs', 'demo'), { recursive: true });
        fs.writeFileSync(path.join(changeDir, 'specs', 'demo', 'spec.md'), '## ADDED Requirements\n\n### Requirement: Markdown source\n系统 SHALL 使用 Markdown。\n\n#### Scenario: Valid input\n- **WHEN** 读取\n- **THEN** 返回\n');
    }
    if (options.tasks) {
        fs.writeFileSync(path.join(changeDir, 'tasks.md'), '# Tasks\n\n- [ ] [代码] 1.1 实现\n  - Spec Ref：demo / Markdown source\n  - Scenario Ref：demo / Markdown source / Valid input\n');
    }
    return changeDir;
}

describe('instructions 可选依赖与可写路径（D2 / D9a）', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('tasks 的 dependencies 标记 design 为 optional，unlocks 只含必需边', () => {
        writeMarkdownChange(projectRoot, 'instruct-change', { proposal: true });
        const info = getArtifactInstructions(projectRoot, 'instruct-change', 'tasks');
        const byId = new Map(info.dependencies.map((dependency) => [dependency.id, dependency]));
        expect(byId.get('design')?.optional).toBe(true);
        expect(byId.get('specs')?.optional).toBe(false);
        expect(info.dependencies.map((dependency) => dependency.id)).toEqual(['specs', 'design']);
    });

    it('resolvedOutputPath 可直接写入：specs 为目录，其余为单文件（不含 glob）', () => {
        const changeDir = writeMarkdownChange(projectRoot, 'paths-change', { proposal: true });
        const specs = getArtifactInstructions(projectRoot, 'paths-change', 'specs');
        expect(specs.resolvedOutputPath).not.toContain('**');
        expect(specs.resolvedOutputPath).toBe(path.join(changeDir, 'specs'));
        for (const artifactId of ['proposal', 'design', 'tasks']) {
            const info = getArtifactInstructions(projectRoot, 'paths-change', artifactId);
            expect(info.resolvedOutputPath).toBe(path.join(changeDir, info.outputPath));
            expect(info.resolvedOutputPath).not.toContain('*');
        }
    });
});

describe('TASKS_TEMPLATE 示例自身可解析', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('模板含规范两行示例（Scenario Ref 为叶子名）并声明能力/歧义诊断', () => {
        expect(TASKS_TEMPLATE).toContain('- Spec Ref：<capability> / <Requirement>');
        expect(TASKS_TEMPLATE).toContain('- Scenario Ref：<Scenario>');
        expect(TASKS_TEMPLATE).toContain('场景叶子名');
        expect(TASKS_TEMPLATE).toContain('只写 <capability> 不是有效 Spec Ref');
        expect(TASKS_TEMPLATE).toContain('spec-ref-missing-requirement');
        expect(TASKS_TEMPLATE).toContain('scenario-ref-missing-context');
        expect(TASKS_TEMPLATE).toContain('ambiguous-scenario-ref');
        expect(TASKS_TEMPLATE).toContain('→ Requirement:');
    });

    it('示例填入占位值后校验不产生 invalid-spec-ref / invalid-scenario-ref', () => {
        const changeDir = writeMarkdownChange(projectRoot, 'template-change', { proposal: true, specs: true });
        const filled = TASKS_TEMPLATE
            .replaceAll('<capability>', 'demo')
            .replaceAll('<Requirement>', 'Markdown source')
            .replaceAll('<Scenario>', 'Valid input');
        fs.writeFileSync(path.join(changeDir, 'tasks.md'), filled, 'utf8');
        const result = runSpecValidate(projectRoot, 'template-change');
        const codes = result.diagnostics.map((item) => item.code);
        expect(codes).not.toContain('invalid-spec-ref');
        expect(codes).not.toContain('invalid-scenario-ref');
        expect(result.valid).toBe(true);
    });
});

describe('spec validate CLI 端到端（起草期 / 终检 / 文本报告）', () => {
    const binPath = fileURLToPath(new URL('../bin/iagent.js', import.meta.url));
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    function execCli(args: string[]): { status: number | null; stdout: string; stderr: string } {
        const result = spawnSync(process.execPath, [binPath, ...args], {
            cwd: projectRoot,
            encoding: 'utf8',
            env: { ...process.env },
        });
        return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
    }

    it('Scenario: --partial 退出码 0、strict 退出码非零', () => {
        writeMarkdownChange(projectRoot, 'draft-change', { proposal: true });
        const partial = execCli(['spec', 'validate', '--change', 'draft-change', '--partial', '--json']);
        expect(partial.status).toBe(0);
        const payload = JSON.parse(partial.stdout);
        expect(payload.mode).toBe('partial');
        expect(payload.valid).toBe(true);

        const strict = execCli(['spec', 'validate', '--change', 'draft-change', '--json']);
        expect(strict.status).not.toBe(0);
        expect(JSON.parse(strict.stdout).valid).toBe(false);
    });

    it('Scenario: 并行起草（proposal + specs 无 tasks）--partial 通过、strict 报 missing-tasks', () => {
        writeMarkdownChange(projectRoot, 'parallel-change', { proposal: true, specs: true });
        expect(execCli(['spec', 'validate', '--change', 'parallel-change', '--partial']).status).toBe(0);
        const strict = execCli(['spec', 'validate', '--change', 'parallel-change', '--json']);
        expect(strict.status).not.toBe(0);
        expect(JSON.parse(strict.stdout).diagnostics.some((item: { code?: string }) => item.code === 'missing-tasks')).toBe(true);
    });

    it('Scenario: design 可选变更 apply-ready（strict 通过 + apply state ready）', () => {
        writeMarkdownChange(projectRoot, 'no-design-ready', { proposal: true, specs: true, tasks: true });
        expect(execCli(['spec', 'validate', '--change', 'no-design-ready']).status).toBe(0);
        const apply = execCli(['spec', 'instructions', 'apply', '--change', 'no-design-ready', '--json']);
        const payload = JSON.parse(apply.stdout);
        expect(payload.instruction.state).toBe('ready');
        expect(payload.isPlanningComplete).toBe(true);
        expect(payload.artifacts.find((item: { id: string }) => item.id === 'design').status).toBe('optional');
    });

    it('Scenario: 文本报告按行输出诊断（无字面 \\n）', () => {
        writeMarkdownChange(projectRoot, 'text-report', { proposal: true });
        const result = execCli(['spec', 'validate', '--change', 'text-report']);
        expect(result.status).not.toBe(0);
        expect(result.stdout).not.toContain('\\n');
        expect(result.stdout.trim().split('\n').length).toBeGreaterThan(1);
    });
});

// 变更 improve-orchestration-execution-mode / 任务 4.5：fingerprint CLI 端到端。
describe('iagent spec fingerprint CLI 端到端（4.5）', () => {
    const binPath = fileURLToPath(new URL('../bin/iagent.js', import.meta.url));
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    function execCli(args: string[]): { status: number | null; stdout: string; stderr: string } {
        const result = spawnSync(process.execPath, [binPath, ...args], {
            cwd: projectRoot,
            encoding: 'utf8',
            env: { ...process.env },
        });
        return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
    }

    /** 目录树快照（相对路径 → 文件内容），用于断言命令不写文件 */
    function snapshotTree(root: string): string[] {
        const snapshot: string[] = [];
        const walk = (dir: string): void => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(fullPath);
                    continue;
                }
                const relative = path.relative(root, fullPath).split(path.sep).join('/');
                snapshot.push(`${relative}:${fs.readFileSync(fullPath, 'utf8')}`);
            }
        };
        walk(root);
        return snapshot.sort();
    }

    it('文本模式仅输出一行 sha256:<16 位>', () => {
        writeMarkdownChange(projectRoot, 'fingerprint-text', { proposal: true, specs: true, tasks: true });

        const result = execCli(['spec', 'fingerprint', '--change', 'fingerprint-text']);

        expect(result.status).toBe(0);
        const lines = result.stdout.trim().split('\n');
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatch(/^sha256:[0-9a-f]{16}$/);
    });

    it('JSON 模式含 fingerprint 与按路径字典序的 artifacts[]', () => {
        writeMarkdownChange(projectRoot, 'fingerprint-json', { proposal: true, specs: true, tasks: true });
        const text = execCli(['spec', 'fingerprint', '--change', 'fingerprint-json']);

        const result = execCli(['spec', 'fingerprint', '--change', 'fingerprint-json', '--json']);

        expect(result.status).toBe(0);
        const payload = JSON.parse(result.stdout) as {
            changeName: string;
            changeRoot: string;
            fingerprint: string;
            artifacts: Array<{ path: string; size: number; sha256: string }>;
        };
        expect(payload.changeName).toBe('fingerprint-json');
        expect(payload.fingerprint).toBe(text.stdout.trim());
        expect(Array.isArray(payload.artifacts)).toBe(true);
        const paths = payload.artifacts.map((artifact) => artifact.path);
        expect(paths).toEqual([...paths].sort());
        for (const artifact of payload.artifacts) {
            expect(artifact.path).not.toContain('\\');
            expect(typeof artifact.size).toBe('number');
            expect(artifact.sha256).toMatch(/^[0-9a-f]{64}$/);
        }
    });

    it('变更不存在时非零退出且不输出伪造指纹', () => {
        const result = execCli(['spec', 'fingerprint', '--change', 'ghost-change']);

        expect(result.status).not.toBe(0);
        const output = `${result.stdout}\n${result.stderr}`;
        expect(output).toContain('指纹复算失败');
        expect(output).not.toMatch(/sha256:[0-9a-f]{16}/);
    });

    it('文本与 JSON 两次调用都不写入或修改任何文件', () => {
        writeMarkdownChange(projectRoot, 'fingerprint-readonly', { proposal: true, specs: true, tasks: true });
        const before = snapshotTree(projectRoot);

        execCli(['spec', 'fingerprint', '--change', 'fingerprint-readonly']);
        execCli(['spec', 'fingerprint', '--change', 'fingerprint-readonly', '--json']);

        expect(snapshotTree(projectRoot)).toEqual(before);
    });
});
