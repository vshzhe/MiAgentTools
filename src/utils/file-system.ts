/**
 * 文件系统工具函数。
 */

import * as fs from 'fs';
import * as path from 'path';

/** 递归创建目录（已存在则跳过） */
export function ensureDir(dirPath: string): void {
    fs.mkdirSync(dirPath, { recursive: true });
}

/** 将内容写入文件（自动创建父目录，不覆盖已有文件除非 force） */
export function writeFile(filePath: string, content: string, options: { force?: boolean } = {}): void {
    if (fs.existsSync(filePath) && !options.force) {
        throw new Error(`文件已存在（使用 --force 覆盖）：${filePath}`);
    }
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, 'utf8');
}

/** 读取文件内容（不存在返回 undefined） */
export function readFileIfExists(filePath: string): string | undefined {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch {
        return undefined;
    }
}

/** 列出目录下的直接子目录名（目录不存在返回空数组） */
export function listSubdirectories(dirPath: string): string[] {
    if (!fs.existsSync(dirPath)) {
        return [];
    }
    return fs
        .readdirSync(dirPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
}

/** 判断路径是否存在 */
export function pathExists(filePath: string): boolean {
    return fs.existsSync(filePath);
}

/**
 * 写入技能附加参考文件（references/*.md 等）。
 * 将 generated.references 各项写到 skillDir 下对应相对路径，自动创建父目录。
 * 不主动清理旧文件——调用方需在 references 列表缩减时自行清理（如 update 命令）。
 */
export function writeSkillReferences(
    skillDir: string,
    references: Array<{ path: string; content: string }> | undefined
): void {
    if (!references || references.length === 0) {
        return;
    }
    for (const ref of references) {
        const refPath = path.join(skillDir, ref.path);
        ensureDir(path.dirname(refPath));
        fs.writeFileSync(refPath, ref.content, 'utf8');
    }
}

/** 递归删除目录（不存在则跳过） */
export function removeDir(dirPath: string): void {
    fs.rmSync(dirPath, { recursive: true, force: true });
}
