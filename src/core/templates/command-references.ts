/**
 * 模板正文指令引用单一源。
 *
 * 模板正文（`SkillTemplate.instructions` 与 `CommandTemplate.content`）中的斜杠指令
 * 引用一律以**规范形** `/iagent:<id>` 书写；`<id>` 为技能名经 `deriveCommandId`
 * 派生的指令 id。生成期由 `rewriteCommandRefs` 按目标工具布局改写：
 *   - `namespace-dir`（Claude Code）：保持 `/iagent:<id>`
 *   - `prefixed-file`（Pi prompts）：改写为 `/iagent-<id>`
 *
 * 改写**仅作用于已知 id**（`getKnownCommandIds()` 派生自注册表），未知名保持原样
 * —— 与上游 OpenSpec 的 `command-references` 同构：不把拼写错误静默改造成另一个
 * 不存在的命令；未知名由 `test/command-reference-refs.test.ts` 在源码侧拦截。
 *
 * 本模块**纯函数、无 registry 依赖**：避免 `registry → 模板 → command-references
 * → registry` 的循环导入；已知 id 集由调用方（生成侧 / 测试）注入。
 */

import type { CommandLayout } from '../config.js';

/** 规范形引用前缀（与 `COMMAND_NAMESPACE` 一致） */
export const COMMAND_REF_PREFIX = '/iagent:';

/** 匹配规范形引用 `/iagent:<id>` 的正则（全局；id 为小写字母与连字符） */
export const COMMAND_REF_RE = /\/iagent:([a-z-]+)/g;

/** prefixed-file 布局的引用形式 `/iagent-<id>` */
export function prefixedCommandRef(id: string): string {
    return `/iagent-${id}`;
}

/**
 * 产出规范形指令引用 `/iagent:<id>`。
 *
 * @param id - 指令 id（如 `spec-apply`）
 * @param knownIds - 可选已知 id 集；提供时对未注册 id 抛错（开发期防呆）
 * @throws 当传入 knownIds 且 id 不在其中
 */
export function commandRef(id: string, knownIds?: ReadonlySet<string>): string {
    if (knownIds !== undefined && !knownIds.has(id)) {
        throw new Error(`未知的指令 id：${id}（commandRef 仅接受已注册指令）`);
    }
    return `${COMMAND_REF_PREFIX}${id}`;
}

/**
 * 生成期按工具布局改写正文中的规范形指令引用。
 *
 * - `namespace-dir` 或未指定：返回原文（规范形即目标形式）
 * - `prefixed-file`：将已知 id 的 `/iagent:<id>` 改写为 `/iagent-<id>`
 *
 * 未知名保持原样（不静默改造）。
 */
export function rewriteCommandRefs(
    text: string,
    layout: CommandLayout | undefined,
    knownIds: ReadonlySet<string>
): string {
    if (layout !== 'prefixed-file') {
        return text;
    }
    return text.replace(COMMAND_REF_RE, (match, id: string) =>
        knownIds.has(id) ? prefixedCommandRef(id) : match
    );
}

/** 提取正文中全部规范形引用的 id（供校验 / 测试使用） */
export function extractCommandRefIds(text: string): string[] {
    return [...text.matchAll(COMMAND_REF_RE)].map((m) => m[1]);
}
