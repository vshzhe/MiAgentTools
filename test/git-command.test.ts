/**
 * iagent git 命令：status / init 的输出契约与只读性。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildGitCommand, runGitStatus, runGitInit } from '../src/commands/git.js';

function makeTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-git-cmd-'));
}

const INSTALLED = () => ({ installed: true, version: '2.42.0' });
const MISSING = () => ({ installed: false });

describe('iagent git status', () => {
    let dir: string;

    beforeEach(() => {
        dir = makeTempDir();
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('Scenario: JSON 输出完整状态', () => {
        fs.mkdirSync(path.join(dir, '.git'));
        const output = runGitStatus(dir, { detect: INSTALLED });
        expect(output).toEqual({
            installed: true,
            version: '2.42.0',
            isRepo: true,
            parentRepo: null,
            installers: [],
        });
    });

    it('Scenario: 未安装 Git（退出码语义为 0，输出 installed=false）', () => {
        const output = runGitStatus(dir, {
            detect: MISSING,
            probInstallers: () => [{ name: 'winget', command: 'winget', args: [], display: 'winget install --id Git.Git -e' }],
        });
        expect(output.installed).toBe(false);
        expect(output.isRepo).toBe(false);
        expect(output.installers.map((item) => item.name)).toEqual(['winget']);
    });

    it('Scenario: 纯只读（不创建 .git）', () => {
        runGitStatus(dir, { detect: INSTALLED });
        expect(fs.existsSync(path.join(dir, '.git'))).toBe(false);
    });

    it('检测到上级仓库时 parentRepo 非空', () => {
        const outer = makeTempDir();
        fs.mkdirSync(path.join(outer, '.git'));
        const inner = path.join(outer, 'p');
        fs.mkdirSync(inner);
        try {
            const output = runGitStatus(inner, { detect: INSTALLED });
            expect(output.isRepo).toBe(false);
            expect(output.parentRepo).toBe(path.resolve(outer));
        } finally {
            fs.rmSync(outer, { recursive: true, force: true });
        }
    });

    it('命令暴露 status / init 子命令', () => {
        const git = buildGitCommand();
        const names = git.commands.map((cmd) => cmd.name());
        expect(names).toEqual(['status', 'init']);
    });
});

describe('iagent git init', () => {
    let dir: string;

    beforeEach(() => {
        dir = makeTempDir();
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('Scenario: 幂等跳过（已是仓库，零改动）', () => {
        fs.mkdirSync(path.join(dir, '.git'));
        const before = fs.readdirSync(dir);
        const output = runGitInit(dir, { detect: INSTALLED });
        expect(output.action).toBe('skipped');
        expect(output.reason).toContain('不覆盖');
        expect(fs.readdirSync(dir)).toEqual(before);
    });

    it('Scenario: 嵌套仓库防护', () => {
        const outer = makeTempDir();
        fs.mkdirSync(path.join(outer, '.git'));
        const inner = path.join(outer, 'p');
        fs.mkdirSync(inner);
        try {
            const output = runGitInit(inner, { detect: INSTALLED });
            expect(output.action).toBe('skipped');
            expect(output.reason).toContain('上级仓库');
            expect(fs.existsSync(path.join(inner, '.git'))).toBe(false);
        } finally {
            fs.rmSync(outer, { recursive: true, force: true });
        }
    });

    it('Git 不可用时 failed', () => {
        const output = runGitInit(dir, { detect: MISSING });
        expect(output.action).toBe('failed');
        expect(output.reason).toContain('Git 不可用');
    });
});
