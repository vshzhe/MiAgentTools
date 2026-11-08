/**
 * 变更制品指纹算法回归（变更 improve-orchestration-execution-mode / 任务 4.4）。
 *
 * 固定 fixture 断言「相对路径字典序 + 单换行连接 + 末尾无换行」，
 * 并对照 `iagent spec fingerprint` CLI 输出证明单一算法源。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
    collectFingerprintFiles,
    computeChangeFingerprint,
    resolveChangeRoot,
} from '../src/core/spec/fingerprint.js';

const CHANGE_NAME = 'fingerprint-fixture';
const binPath = fileURLToPath(new URL('../bin/iagent.js', import.meta.url));

/** 与实现无关的独立 sha256 计算（按 spec 算法复算期望值） */
function sha256Hex(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/** 按 spec 算法从「相对路径 + 内容」复算期望指纹（末尾无换行） */
function expectedFingerprint(entries: Array<{ path: string; content: string }>): string {
    const sorted = [...entries].sort((left, right) =>
        left.path < right.path ? -1 : left.path > right.path ? 1 : 0
    );
    const joined = sorted.map((entry) => `${entry.path}:${sha256Hex(entry.content)}`).join('\n');
    return `sha256:${sha256Hex(joined).slice(0, 16)}`;
}

/** 固定 fixture 制品（含嵌套 specs 目录） */
const FIXTURE: Array<{ path: string; content: string }> = [
    { path: 'proposal.md', content: '# Proposal\n\n## Why\n测试原因\n' },
    { path: 'design.md', content: '# Design\n\n## Context\n上下文\n' },
    { path: 'specs/host-orchestration/spec.md', content: '## ADDED Requirements\n\n### Requirement: A\n' },
    { path: 'specs/spec-workflow-cli/spec.md', content: '## ADDED Requirements\n\n### Requirement: B\n' },
    { path: 'tasks.md', content: '# Tasks\n\n- [ ] 1.1 实现\n' },
];

let projectRoot: string;
let changeRoot: string;

/** 写入 fixture 文件（自动建父目录） */
function writeFixture(entries: Array<{ path: string; content: string }>): void {
    for (const entry of entries) {
        const fullPath = path.join(changeRoot, ...entry.path.split('/'));
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, entry.content, 'utf8');
    }
}

beforeEach(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-fingerprint-'));
    changeRoot = path.join(projectRoot, 'openspec', 'changes', CHANGE_NAME);
    fs.mkdirSync(changeRoot, { recursive: true });
});

afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
});

describe('computeChangeFingerprint 算法（4.4）', () => {
    it('固定 fixture：按相对路径字典序排序 + 单换行连接 + 末尾无换行', () => {
        writeFixture(FIXTURE);

        const result = computeChangeFingerprint(CHANGE_NAME, changeRoot);

        expect(resolveChangeRoot(CHANGE_NAME, projectRoot)).toBe(changeRoot);
        expect(result.changeName).toBe(CHANGE_NAME);
        expect(result.fingerprint).toBe(expectedFingerprint(FIXTURE));

        const expectedPaths = FIXTURE.map((entry) => entry.path).sort();
        expect(result.artifacts.map((artifact) => artifact.path)).toEqual(expectedPaths);
        // 路径统一正斜杠
        for (const artifact of result.artifacts) {
            expect(artifact.path).not.toContain('\\');
        }
        // 每个制品的 sha256 / size 与磁盘字节一致
        for (const artifact of result.artifacts) {
            const entry = FIXTURE.find((item) => item.path === artifact.path)!;
            expect(artifact.sha256).toBe(sha256Hex(entry.content));
            expect(artifact.size).toBe(Buffer.byteLength(entry.content, 'utf8'));
        }

        // 末尾无换行：追加换行的旧算法会得到不同指纹
        const sorted = [...FIXTURE].sort((left, right) => (left.path < right.path ? -1 : 1));
        const joined = sorted.map((entry) => `${entry.path}:${sha256Hex(entry.content)}`).join('\n');
        expect(result.fingerprint).not.toBe(`sha256:${sha256Hex(`${joined}\n`).slice(0, 16)}`);
    });

    it('制品集合不含 exploration.md 与 attachments/', () => {
        writeFixture([
            { path: 'proposal.md', content: '# Proposal\n' },
            { path: 'tasks.md', content: '# Tasks\n' },
            { path: 'exploration.md', content: '# Exploration\n' },
            { path: 'specs/demo/attachments/note.md', content: '# Attachment\n' },
        ]);

        const result = computeChangeFingerprint(CHANGE_NAME, changeRoot);

        expect(result.artifacts.map((artifact) => artifact.path)).toEqual(['proposal.md', 'tasks.md']);
        expect(collectFingerprintFiles(changeRoot).map((file) => path.relative(changeRoot, file).split(path.sep).join('/'))).toEqual([
            'proposal.md',
            'tasks.md',
        ]);
    });

    it('任一制品内容改动后指纹变化', () => {
        writeFixture(FIXTURE);
        const before = computeChangeFingerprint(CHANGE_NAME, changeRoot).fingerprint;

        for (const entry of FIXTURE) {
            const fullPath = path.join(changeRoot, ...entry.path.split('/'));
            const original = fs.readFileSync(fullPath, 'utf8');
            fs.writeFileSync(fullPath, `${original}\n<!-- changed -->\n`, 'utf8');
            const after = computeChangeFingerprint(CHANGE_NAME, changeRoot).fingerprint;
            expect(after, `${entry.path} 改动未反映到指纹`).not.toBe(before);
            fs.writeFileSync(fullPath, original, 'utf8');
        }

        // 内容还原后指纹恢复（确定性）
        expect(computeChangeFingerprint(CHANGE_NAME, changeRoot).fingerprint).toBe(before);
    });

    it('仅时间戳变化不影响指纹', () => {
        writeFixture(FIXTURE);
        const before = computeChangeFingerprint(CHANGE_NAME, changeRoot);
        const later = new Date(Date.now() + 60_000);

        for (const artifact of before.artifacts) {
            const fullPath = path.join(changeRoot, ...artifact.path.split('/'));
            fs.utimesSync(fullPath, later, later);
        }

        const after = computeChangeFingerprint(CHANGE_NAME, changeRoot);
        expect(after.fingerprint).toBe(before.fingerprint);
    });

    it('与 `iagent spec fingerprint` CLI 文本输出一致', () => {
        writeFixture(FIXTURE);
        const expected = computeChangeFingerprint(CHANGE_NAME, changeRoot).fingerprint;

        const cli = spawnSync(
            process.execPath,
            [binPath, 'spec', 'fingerprint', '--change', CHANGE_NAME],
            { cwd: projectRoot, encoding: 'utf8', env: { ...process.env } }
        );

        expect(cli.status).toBe(0);
        expect(cli.stdout.trim()).toBe(expected);
    });
});
