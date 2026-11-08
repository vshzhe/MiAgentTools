/**
 * 变更制品内容指纹（`sourceFingerprint`）的单一实现。
 *
 * 变更 improve-orchestration-execution-mode：模板、`iagent spec fingerprint`
 * 与 handoff 包消费方共用同一算法，消除手写一次性脚本。
 *
 * 算法（MUST NOT 追加末尾换行）：
 *   1. 制品集合 = `proposal.md`、`design.md`（存在时）、`specs/**\/*.md`、`tasks.md`；
 *   2. 每个文件计算 `sha256(字节内容)`，得到 `<相对路径>:<sha256hex>`（路径正斜杠）；
 *   3. 按相对路径字典序排序，用单个换行连接为串 `S`（**末尾无换行**）；
 *   4. 指纹 = `sha256:` + `sha256(S)` 十六进制前 16 字符。
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/** 单个制品的指纹信息 */
export interface FingerprintArtifact {
    /** 相对 changeRoot 的正斜杠路径 */
    path: string;
    /** 文件字节数 */
    size: number;
    /** 完整 sha256 十六进制 */
    sha256: string;
}

/** 变更指纹结果 */
export interface ChangeFingerprint {
    changeName: string;
    changeRoot: string;
    fingerprint: string;
    /** 按相对路径字典序 */
    artifacts: FingerprintArtifact[];
}

/** 计算字节内容的 sha256 十六进制 */
function sha256Hex(content: Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex');
}

/** 递归收集目录下的 `*.md`（不进入 attachments） */
function collectMarkdownFiles(dir: string, acc: string[]): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'attachments') {
            continue;
        }
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectMarkdownFiles(fullPath, acc);
        } else if (entry.name.endsWith('.md')) {
            acc.push(fullPath);
        }
    }
}

/**
 * 收集参与指纹的制品文件（绝对路径）。
 *
 * 只包含 proposal / design(可选) / specs 下 Markdown / tasks，MUST NOT 纳入
 * `exploration.md`、`attachments/` 或 `.openspec.yaml`。
 */
export function collectFingerprintFiles(changeRoot: string): string[] {
    const files: string[] = [];
    for (const name of ['proposal.md', 'design.md']) {
        const candidate = path.join(changeRoot, name);
        if (fs.existsSync(candidate)) {
            files.push(candidate);
        }
    }
    const specsRoot = path.join(changeRoot, 'specs');
    if (fs.existsSync(specsRoot)) {
        collectMarkdownFiles(specsRoot, files);
    }
    const tasks = path.join(changeRoot, 'tasks.md');
    if (fs.existsSync(tasks)) {
        files.push(tasks);
    }
    return files;
}

/**
 * 计算变更制品指纹。
 *
 * @throws 变更目录不存在或制品集合为空
 */
export function computeChangeFingerprint(
    changeName: string,
    changeRoot: string
): ChangeFingerprint {
    if (!fs.existsSync(changeRoot)) {
        throw new Error(`变更目录不存在：${changeRoot}`);
    }
    const files = collectFingerprintFiles(changeRoot);
    if (files.length === 0) {
        throw new Error(`变更 ${changeName} 没有可参与指纹的制品（proposal / design / specs / tasks）`);
    }
    const artifacts: FingerprintArtifact[] = files
        .map((file) => {
            const content = fs.readFileSync(file);
            return {
                path: path.relative(changeRoot, file).split(path.sep).join('/'),
                size: content.length,
                sha256: sha256Hex(content),
            };
        })
        .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
    const joined = artifacts.map((artifact) => `${artifact.path}:${artifact.sha256}`).join('\n');
    const fingerprint = `sha256:${sha256Hex(Buffer.from(joined, 'utf8')).slice(0, 16)}`;
    return { changeName, changeRoot, fingerprint, artifacts };
}

/**
 * 从项目根解析变更目录。
 *
 * 先查活跃变更 `openspec/changes/<name>`，再按 `<date>-<name>` 后缀匹配归档目录。
 *
 * @throws 两处均未找到
 */
export function resolveChangeRoot(changeName: string, projectRoot: string): string {
    const active = path.join(projectRoot, 'openspec', 'changes', changeName);
    if (fs.existsSync(active)) {
        return active;
    }
    const archive = path.join(projectRoot, 'openspec', 'changes', 'archive');
    if (fs.existsSync(archive)) {
        const match = fs
            .readdirSync(archive, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .find((name) => name === changeName || name.endsWith(`-${changeName}`));
        if (match !== undefined) {
            return path.join(archive, match);
        }
    }
    throw new Error(
        `未找到变更 ${changeName}（查找：openspec/changes/${changeName} 与 archive/*-${changeName}）`
    );
}
