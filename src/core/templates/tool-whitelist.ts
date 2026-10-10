/**
 * 技能/指令白名单的「调用类」条目共享真源。
 *
 * 背景：venus 生成的技能与斜杠指令在 Claude Code 中运行时，除对话级确认门之外的
 * 每次工具调用都会触发权限弹窗，把全自动管线切成碎片。三类缺口均属「调用类」条目
 * （不涉及任何文件读写授权面）：
 *   ① CodeGraph MCP 工具（`mcp__codegraph__*`）—— 白名单里只有 CLI 形态 `Bash(codegraph:*)`，
 *      二者是两套不同的工具名；
 *   ② 技能间经 Skill 工具的委派（如 genfull 委派 8 个子技能）；
 *   ③ 子代理派发（多项目扫描、批调度）。
 *
 * 本模块把这三类条目收敛为单点真源，避免在各模板中重复硬编码而产生第二份真源与漂移。
 */

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
 * 子代理派发条目：`Agent, Task`。
 *
 * 为何双写：派发工具在旧版 Claude Code 中名为 `Task`，新版更名为 `Agent`；二者是两套
 * 不同的工具名，同时写入以兼容不同运行时（旧运行时只认 Task，新运行时只认 Agent）。
 */
export const SUBAGENT_DISPATCH: string = 'Agent, Task';

/**
 * 生成技能委派的精确条目，产出 `Skill(a), Skill(b)` 形式（逗号 + 空格分隔）。
 *
 * 技能名取**去掉 `venus_` 前缀的裸名**（如 `spec_apply`、`tr_docs_feature_doc`），
 * 也**不带** `plugin:` 前缀 —— 即传 `venus_spec_apply` 是错误的，会产出
 * `Skill(venus_spec_apply)` 这一永不放行的死条目（测试按「`Skill(X)` 对应已注册技能
 * `venus_X`」校验，会判为委派了未注册技能）。调用方 MUST NOT 使用星号通配
 * （授权面过宽属安全问题），MUST 逐技能显式列举。
 *
 * @param names 被委派技能的**裸名**列表（不含 `venus_` 前缀）
 * @returns 逗号 + 空格分隔的 `Skill(...)` 条目串；空数组返回空串
 */
export function skillDelegation(names: readonly string[]): string {
    return names.map((name) => `Skill(${name})`).join(', ');
}
