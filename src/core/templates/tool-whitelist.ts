/**
 * 技能/指令白名单的「调用类」条目共享真源。
 *
 * 背景：iagent 生成的技能与斜杠指令在 Claude Code 中运行时，除对话级确认门之外的
 * 每次工具调用都会触发权限弹窗，把全自动管线切成碎片。三类缺口均属「调用类」条目
 * （不涉及任何文件读写授权面）：
 *   ① CodeGraph MCP 工具（`mcp__codegraph__*`）与 CLI 形态 `Bash(codegraph:*)` ——
 *      二者是两套不同的工具名，互不覆盖；
 *   ② 技能间经 Skill 工具的委派（如 workflow 委派 spec_apply / spec_archive 等子技能）；
 *   ③ 子代理派发（多项目扫描、批调度）。
 *
 * 本模块把这三类条目收敛为单点真源，避免在各模板中重复硬编码而产生第二份真源与漂移。
 *
 * 技能委派条目形态（变更 fix-mode-delegation-host-parity）：`Skill(iagent-<workflowId>)`
 * —— 与技能目录名 / frontmatter `name`（`deriveSkillId`）逐字一致；入参仍为裸名
 * （`spec_apply` / `spec-apply` 等价），由 `skillDelegation()` 统一归一化。
 */

import { SKILL_ID_PREFIX } from '../skill-id.js';

/**
 * CodeGraph MCP 条目：裸服务器形式 + 9 个具名工具，逗号分隔，共 10 条。
 *
 * 为何双写：服务器级裸形式 `mcp__codegraph` 存在失效报告（不同版本/环境下对服务器级
 * 通配的解析不一致，可能不放行任何具名工具），而逐工具全名 `mcp__codegraph__<tool>`
 * 被稳定支持；二者是两套不同的权限条目名称。故同时写入，任一形态生效即可放行。
 */
export const CODEGRAPH_MCP: string =
    'mcp__codegraph, mcp__codegraph__codegraph_status, mcp__codegraph__codegraph_files, ' +
    'mcp__codegraph__codegraph_search, mcp__codegraph__codegraph_context, mcp__codegraph__codegraph_node, ' +
    'mcp__codegraph__codegraph_callers, mcp__codegraph__codegraph_callees, ' +
    'mcp__codegraph__codegraph_impact, mcp__codegraph__codegraph_explore';

/**
 * CodeGraph CLI 条目（`Bash(codegraph:*)`）。
 *
 * 与 MCP 条目是**两套不同的工具名**，互不覆盖：正文确有经 Bash 运行 `codegraph`
 * 子命令（`status` / `unlock` / 条件 `sync` 等）的技能 MUST 同时具备本条目；
 * 只有 MCP 条目的技能 MUST NOT 因本条目存在而删除 MCP 条目。
 *
 * 授权面仅限 `codegraph` 子命令（非任意 shell），MUST NOT 扩展为 `Bash(*)`。
 * 模板 MUST 以 `${CODEGRAPH_CLI}` 引用，MUST NOT 手写字面量。
 */
export const CODEGRAPH_CLI: string = 'Bash(codegraph:*)';

/**
 * 子代理派发条目：`Agent, Task`。
 *
 * 为何双写：派发工具在旧版 Claude Code 中名为 `Task`，新版更名为 `Agent`；二者是两套
 * 不同的工具名，同时写入以兼容不同运行时（旧运行时只认 Task，新运行时只认 Agent）。
 */
export const SUBAGENT_DISPATCH: string = 'Agent, Task';

/**
 * 归一化被委派技能名为 **canonical 宿主技能 ID**（`iagent-<workflowId>`）。
 *
 * 入参接受裸名（`spec_apply` / `spec-apply`）或已带内部前缀的写法
 * （`iagent_spec_apply` / `iagent-spec-apply`），统一收敛为 kebab-case
 * canonical 形态 —— 与技能目录名及 SKILL.md frontmatter `name`（`deriveSkillId`
 * 的结果）逐字一致。宿主按完整技能名匹配授权，裸名条目永不放行。
 *
 * @throws 空名 / 星号通配 / 非法字符（授权面过宽或死条目均属安全缺陷）
 */
export function normalizeDelegationSkillId(name: string): string {
    const trimmed = name.trim();
    if (trimmed === '') {
        throw new Error('技能委派条目 MUST NOT 为空');
    }
    if (trimmed.includes('*')) {
        throw new Error(`技能委派条目 MUST NOT 使用星号通配：${name}`);
    }
    const withoutPlugin = trimmed.startsWith('plugin:') ? trimmed.slice('plugin:'.length) : trimmed;
    const bare = withoutPlugin.replace(/^iagent[_-]/, '');
    if (!/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(bare)) {
        throw new Error(`技能委派条目名称非法（需小写字母 / 数字 / 连字符）：${name}`);
    }
    return `${SKILL_ID_PREFIX}${bare.replaceAll('_', '-')}`;
}

/**
 * 生成技能委派的精确条目，产出 `Skill(iagent-a), Skill(iagent-b)` 形式
 * （逗号 + 空格分隔）。
 *
 * 技能名入参为**裸名**（`spec_apply` / `spec-apply` 等价）或已带前缀的写法，
 * 内部统一归一化为 canonical `iagent-<workflowId>` —— 与宿主技能 ID 逐字一致，
 * 宿主按完整技能名匹配授权。MUST NOT 产出裸名条目（永不放行），MUST NOT 双写
 * 裸名与 canonical 两种形态（授权面翻倍且残留死条目），MUST NOT 使用星号通配
 * （授权面过宽属安全问题）；调用方 MUST 逐技能显式列举。
 *
 * @param names 被委派技能的裸名列表（`spec_apply` / `spec-apply` 等价）
 * @returns 逗号 + 空格分隔的 `Skill(iagent-...)` 条目串；空数组返回空串
 */
export function skillDelegation(names: readonly string[]): string {
    return names.map((name) => `Skill(${normalizeDelegationSkillId(name)})`).join(', ');
}
