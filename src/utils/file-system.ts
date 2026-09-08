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
