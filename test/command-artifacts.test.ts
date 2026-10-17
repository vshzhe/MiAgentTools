/**
 * 指令产物布局与归属测试。
 *
 * 覆盖 command-artifacts 的两种布局（namespace-dir / prefixed-file）、
 * 归属识别边界（opsx-* 与用户文件不受影响）、空 commandsDir 跳过、旧位置清理幂等，
 * 以及 reconcile 对 Pi prompts 的孤立识别。
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AI_TOOLS } from '../src/core/config.js';
import {
    commandFilePath,
    listManagedCommands,
    removeManagedCommands,
    cleanupMisplacedCommands,
    MISPLACED_COMMANDS_DIR,
} from '../src/core/command-artifacts.js';
import { scanReconcileOrphans } from '../src/core/reconcile.js';

const claude = AI_TOOLS.find((t) => t.value === 'claude')!;
const pi = AI_TOOLS.find((t) => t.value === 'pi')!;
const codex = AI_TOOLS.find((t) => t.value === 'codex')!;
const opencode = AI_TOOLS.find((t) => t.value === 'opencode')!;

function freshRoot(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-cmd-artifacts-'));
}

function write(projectRoot: string, rel: string, content = 'x'): void {
    const abs = path.join(projectRoot, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
}

describe('commandFilePath（布局单点）', () => {
    it('namespace-dir：.claude/commands/iagent/<id>.md', () => {
        expect(commandFilePath('claude', 'pwd').replaceAll('\\', '/')).toBe(
            '.claude/commands/iagent/pwd.md'
        );
    });

    it('prefixed-file：.pi/prompts/iagent-<id>.md', () => {
        expect(commandFilePath('pi', 'spec-apply').replaceAll('\\', '/')).toBe(
            '.pi/prompts/iagent-spec-apply.md'
        );
    });

    it('prefixed-file：.opencode/commands/iagent-<id>.md', () => {
        expect(commandFilePath('opencode', 'spec-apply').replaceAll('\\', '/')).toBe(
            '.opencode/commands/iagent-spec-apply.md'
        );
    });

    it('skills-only 工具（codex）抛错', () => {
        expect(() => commandFilePath('codex', 'pwd')).toThrow(/skills-only/);
    });

    it('未知工具抛错', () => {
        expect(() => commandFilePath('nope', 'pwd')).toThrow(/未知的工具标识/);
    });
});

describe('listManagedCommands（归属识别）', () => {
    it('namespace-dir：取命名空间子目录内全部 .md', () => {
        const root = freshRoot();
        try {
            write(root, '.claude/commands/iagent/pwd.md');
            write(root, '.claude/commands/iagent/feature.md');
            const ids = listManagedCommands(root, claude).map((a) => a.id).sort();
            expect(ids).toEqual(['feature', 'pwd']);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('prefixed-file：仅取 iagent- 前缀 .md，忽略 opsx-*、用户文件与非 md', () => {
        const root = freshRoot();
        try {
            write(root, '.pi/prompts/iagent-pwd.md');
            write(root, '.pi/prompts/iagent-feature.md');
            write(root, '.pi/prompts/opsx-apply.md');
            write(root, '.pi/prompts/user-note.md');
            write(root, '.pi/prompts/iagent-notes.txt', 'not md');
            const artifacts = listManagedCommands(root, pi);
            expect(artifacts.map((a) => a.id).sort()).toEqual(['feature', 'pwd']);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('skills-only 工具返回空数组', () => {
        const root = freshRoot();
        try {
            expect(listManagedCommands(root, codex)).toEqual([]);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('prefixed-file（opencode）：仅取 iagent- 前缀 .md，忽略用户文件与非 md', () => {
        const root = freshRoot();
        try {
            write(root, '.opencode/commands/iagent-workflow.md');
            write(root, '.opencode/commands/my-prompt.md');
            write(root, '.opencode/commands/notes.txt', 'not md');
            const artifacts = listManagedCommands(root, opencode);
            expect(artifacts.map((a) => a.id)).toEqual(['workflow']);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('removeManagedCommands（删除边界）', () => {
    it('namespace-dir：整体删除命名空间子目录', () => {
        const root = freshRoot();
        try {
            write(root, '.claude/commands/iagent/pwd.md');
            write(root, '.claude/commands/other/keep.md');
            const removed = removeManagedCommands(root, claude);
            expect(removed.length).toBe(1);
            expect(fs.existsSync(path.join(root, '.claude/commands/iagent'))).toBe(false);
            expect(fs.existsSync(path.join(root, '.claude/commands/other/keep.md'))).toBe(true);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('prefixed-file：仅删 iagent-* 文件，保留承载目录与 opsx-*', () => {
        const root = freshRoot();
        try {
            write(root, '.pi/prompts/iagent-pwd.md');
            write(root, '.pi/prompts/opsx-apply.md');
            write(root, '.pi/prompts/user-note.md');
            const removed = removeManagedCommands(root, pi);
            expect(removed.map((p) => p.replaceAll('\\', '/'))).toEqual(['.pi/prompts/iagent-pwd.md']);
            expect(fs.existsSync(path.join(root, '.pi/prompts/opsx-apply.md'))).toBe(true);
            expect(fs.existsSync(path.join(root, '.pi/prompts/user-note.md'))).toBe(true);
            expect(fs.existsSync(path.join(root, '.pi/prompts'))).toBe(true);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('prefixed-file（opencode）：仅删 iagent-* 文件，保留用户文件与承载目录', () => {
        const root = freshRoot();
        try {
            write(root, '.opencode/commands/iagent-workflow.md');
            write(root, '.opencode/commands/my-prompt.md');
            const removed = removeManagedCommands(root, opencode);
            expect(removed.map((p) => p.replaceAll('\\', '/'))).toEqual([
                '.opencode/commands/iagent-workflow.md',
            ]);
            expect(fs.existsSync(path.join(root, '.opencode/commands/my-prompt.md'))).toBe(true);
            expect(fs.existsSync(path.join(root, '.opencode/commands'))).toBe(true);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('cleanupMisplacedCommands（旧位置清理）', () => {
    it('删除 .pi/commands/iagent/ 且幂等', () => {
        const root = freshRoot();
        try {
            write(root, path.join(MISPLACED_COMMANDS_DIR, 'pwd.md'));
            const first = cleanupMisplacedCommands(root);
            expect(first.warning).toBeUndefined();
            expect(first.removed.map((p) => p.replaceAll('\\', '/'))).toEqual([
                '.pi/commands/iagent/pwd.md',
            ]);
            expect(fs.existsSync(path.join(root, MISPLACED_COMMANDS_DIR))).toBe(false);
            // 幂等：再次执行无动作
            const second = cleanupMisplacedCommands(root);
            expect(second.removed).toEqual([]);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('不存在时无动作', () => {
        const root = freshRoot();
        try {
            expect(cleanupMisplacedCommands(root).removed).toEqual([]);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('reconcile 指令产物识别', () => {
    it('仅 iagent-* 进入孤立列表，opsx-* 不进入', () => {
        const root = freshRoot();
        try {
            write(root, '.pi/prompts/iagent-feature.md');
            write(root, '.pi/prompts/opsx-apply.md');
            write(root, '.claude/commands/iagent/old-thing.md');
            // 生效集只含 pwd，故 feature 与 old-thing 为孤立
            const orphans = scanReconcileOrphans(root, ['pwd']);
            const commands = orphans.commands.map((p) => p.replaceAll('\\', '/')).sort();
            expect(commands).toContain('.pi/prompts/iagent-feature.md');
            expect(commands).toContain('.claude/commands/iagent/old-thing.md');
            expect(commands.some((p) => p.includes('opsx-apply'))).toBe(false);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
