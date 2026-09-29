/**
 * 会话级权限载体：目标工具设置文件（`.claude/settings.json`）的 permissions.allow 合并。
 *
 * 为什么需要这一载体：技能与指令 frontmatter 的 allowed-tools 授权**仅覆盖调用该
 * 技能/指令的那一轮次**，用户下一条消息即释放，不具备会话级效力。跨轮次的长管线
 * （如全流程编排的 Stage 1→4）仍会被权限弹窗打断，故需要一份会话级放行清单。
 *
 * 三条硬约束（非破坏性）：
 *   1. 不删除、不改写用户既有的任何 allow 条目
 *   2. 不写入 deny / ask 段
 *   3. 过滤全量放行条目（`Bash(*)`、裸 `*`）——这类条目在技能范围内只作用于该技能，
 *      写入会话级载体则放大为整个会话的全局授权，性质完全不同
 *
 * 既有文件非合法 JSON、或 permissions / allow 结构类型不符时，一律**保留原文件不覆盖**
 * 并返回 preserved-invalid，由调用方告警——权限文件的破坏性远大于本次写入的收益。
 */

import * as fs from 'fs';
import path from 'path';
import { ensureDir, readFileIfExists } from '../utils/file-system.js';

/** 会话级载体中禁止写入的全量放行条目 */
const FULL_ACCESS_ENTRIES = new Set(['Bash(*)', '*']);

/** 合并结果状态 */
export type MergeState =
    /** 设置文件原先不存在，本次创建 */
    | 'created'
    /** 设置文件已存在，本次并入新增条目 */
    | 'merged'
    /** 设置文件已存在且已包含全部待写条目，本次无动作（幂等） */
    | 'unchanged'
    /** 设置文件存在但内容/结构不可安全合并，已保留原文件未覆盖 */
    | 'preserved-invalid';

/** 单次合并结果（供调用方输出与测试断言） */
export interface MergeResult {
    /** 设置文件的项目相对路径（正斜杠归一化，供跨平台断言） */
    path: string;
    /** 合并状态 */
    state: MergeState;
    /** 本次新增的条目数 */
    added: number;
    /** 状态说明（非正常路径给出原因） */
    note?: string;
}

/**
 * 从技能白名单列表汇总会话级放行条目。
 *
 * 拆分逗号分隔的规则串、trim、去重（保序），并过滤全量放行条目。
 *
 * @param allowedToolsList - 各技能模板的 allowedTools 取值列表
 * @returns 去重且过滤后的条目数组
 */
export function buildPermissionEntries(allowedToolsList: readonly string[]): string[] {
    const seen = new Set<string>();
    const entries: string[] = [];
    for (const raw of allowedToolsList) {
        for (const piece of raw.split(',')) {
            const entry = piece.trim();
            if (entry === '' || FULL_ACCESS_ENTRIES.has(entry) || seen.has(entry)) {
                continue;
            }
            seen.add(entry);
            entries.push(entry);
        }
    }
    return entries;
}

/** 判断值是否为可安全展开的普通对象（非 null、非数组） */
function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 写回设置文件（JSON 缩进 2 空格 + 行尾换行，符合常见设置文件格式） */
function writeSettings(filePath: string, settings: Record<string, unknown>): void {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

/**
 * 将放行条目非破坏合并进设置文件的 permissions.allow。
 *
 * @param projectRoot - 目标项目根目录
 * @param settingsRelativePath - 设置文件的项目相对路径（如 `.claude/settings.json`）
 * @param entries - 待写入条目（通常来自 buildPermissionEntries）
 */
export function mergePermissions(
    projectRoot: string,
    settingsRelativePath: string,
    entries: readonly string[]
): MergeResult {
    const filePath = path.join(projectRoot, settingsRelativePath);
    const relative = settingsRelativePath.replaceAll('\\', '/');
    const existing = readFileIfExists(filePath);

    // 全新项目：直接创建
    if (existing === undefined) {
        writeSettings(filePath, { permissions: { allow: [...entries] } });
        return { path: relative, state: 'created', added: entries.length };
    }

    // 既有文件必须可安全解析
    let parsed: unknown;
    try {
        parsed = JSON.parse(existing);
    } catch {
        return {
            path: relative,
            state: 'preserved-invalid',
            added: 0,
            note: '既有设置文件不是合法 JSON，已保留原文件未覆盖',
        };
    }
    if (!isPlainObject(parsed)) {
        return {
            path: relative,
            state: 'preserved-invalid',
            added: 0,
            note: '既有设置文件顶层不是 JSON 对象，已保留原文件未覆盖',
        };
    }

    // permissions 段若存在则必须是对象，否则不猜结构、保留原文件
    const rawPermissions = parsed.permissions;
    if (rawPermissions !== undefined && !isPlainObject(rawPermissions)) {
        return {
            path: relative,
            state: 'preserved-invalid',
            added: 0,
            note: '既有设置文件的 permissions 段不是对象，已保留原文件未覆盖',
        };
    }
    const permissions = rawPermissions ?? {};

    // allow 若存在则必须是字符串数组，否则不猜结构、保留原文件
    const rawAllow = permissions.allow;
    if (rawAllow !== undefined && !Array.isArray(rawAllow)) {
        return {
            path: relative,
            state: 'preserved-invalid',
            added: 0,
            note: '既有设置文件的 permissions.allow 不是数组，已保留原文件未覆盖',
        };
    }
    const allow = (rawAllow ?? []).filter((item): item is string => typeof item === 'string');

    // 幂等：无新增条目时不重写文件（避免 mtime 抖动）
    const added = entries.filter((entry) => !allow.includes(entry));
    if (added.length === 0) {
        return { path: relative, state: 'unchanged', added: 0 };
    }

    // 保留顶层其他字段与 permissions 下的其他键（如 deny / ask），仅追加 allow
    writeSettings(filePath, {
        ...parsed,
        permissions: { ...permissions, allow: [...allow, ...added] },
    });
    return { path: relative, state: 'merged', added: added.length };
}

/**
 * 渲染会话级权限载体的合并结果（供 CLI 输出）。
 *
 * @param results - 各目标工具的合并结果
 * @returns 多行输出文本；无结果时返回空串
 */
export function renderPermissionReport(results: readonly MergeResult[]): string {
    if (results.length === 0) {
        return '';
    }
    return results
        .map(({ path: filePath, state, added, note }) => {
            switch (state) {
                case 'created':
                    return `  会话级权限：已创建 ${filePath}（${added} 条放行条目）`;
                case 'merged':
                    return `  会话级权限：已向 ${filePath} 补齐 ${added} 条放行条目`;
                case 'unchanged':
                    return `  会话级权限：${filePath} 已是最新（无变更）`;
                default:
                    return `  ! 会话级权限：${filePath} ${note ?? '未写入'}`;
            }
        })
        .join('\n');
}
