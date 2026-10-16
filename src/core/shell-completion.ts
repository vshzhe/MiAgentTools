/**
 * shell 补全的落盘位置与标记块机制（补全安装与遗留迁移共用）。
 *
 * 本模块只负责品牌**无关**的部分：主目录下的 rc / profile 路径解析，
 * 以及 rc 中由起止标记包围的标记块的增删。
 * 带品牌 token 的值（补全脚本文件名、标记块字面量）分属两侧：
 * 现值在 `commands/completion.ts`，旧值在 `core/legacy-migration.ts`。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** 标记块字面量（rc/profile 中由本工具管理的区段） */
export interface CompletionMarkers {
    start: string;
    end: string;
}

/** bash rc 路径：`<home>/.bashrc` */
export function bashRcPath(homeDir: string): string {
    return path.join(homeDir, '.bashrc');
}

/**
 * PowerShell profile 目录：`Documents/PowerShell`，不存在则回退 `Documents/WindowsPowerShell`。
 *
 * 回退是必要的：Windows PowerShell 5.1 用 WindowsPowerShell，PowerShell 7+ 用 PowerShell。
 */
export function powerShellProfileDir(homeDir: string): string {
    const core = path.join(homeDir, 'Documents', 'PowerShell');
    if (fs.existsSync(core)) {
        return core;
    }
    return path.join(homeDir, 'Documents', 'WindowsPowerShell');
}

/** PowerShell profile 脚本路径：`<profileDir>/Microsoft.PowerShell_profile.ps1` */
export function powerShellRcPath(homeDir: string): string {
    return path.join(powerShellProfileDir(homeDir), 'Microsoft.PowerShell_profile.ps1');
}

/**
 * 从 rc 内容中删除标记块（含块尾换行规整，块内内容一并移除）。
 *
 * 只识别成对的起止标记：仅有起始标记时原样返回，调用方据此判定「不成对、不改动文件」。
 *
 * @returns 删除后的内容；未找到成对标记时返回原内容
 */
export function removeMarkerBlock(content: string, markers: CompletionMarkers): string {
    const startIdx = content.indexOf(markers.start);
    if (startIdx === -1) {
        return content;
    }
    const endIdx = content.indexOf(markers.end, startIdx);
    if (endIdx === -1) {
        return content;
    }
    // 删除从 START 行首到 END 行尾（含换行）
    const before = content.slice(0, startIdx);
    const after = content.slice(endIdx + markers.end.length).replace(/^\r?\n/, '');
    return before + after;
}

/** rc 中是否存在成对的起止标记（仅起始标记不成对 → 返回 false） */
export function hasPairedMarkerBlock(content: string, markers: CompletionMarkers): boolean {
    const startIdx = content.indexOf(markers.start);
    return startIdx !== -1 && content.indexOf(markers.end, startIdx) !== -1;
}

/** 在 rc 内容中追加/替换标记块（先移除旧块，再以空行分隔追加新块） */
export function upsertMarkerBlock(content: string, block: string, markers: CompletionMarkers): string {
    const removed = removeMarkerBlock(content, markers);
    const trimmed = removed.trimEnd();
    return `${trimmed}${trimmed ? '\n\n' : ''}${block}\n`;
}
