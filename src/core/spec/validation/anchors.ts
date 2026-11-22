/**
 * 验证锚点单一源（`spec-verify-anchors`）。
 *
 * 生成侧（`src/core/spec/templates/index.ts` 的模板）与验证侧
 * （`spec-verify-proposal` 的影响面判定、D10 节点覆盖）共同引用本模块，
 * 消除「生成侧不产出、验证侧却要求」的结构错配。
 *
 * 锚点集合（契约见 `openspec/specs/spec-verify-anchors/spec.md`）：
 * - `### Impact Analysis` —— proposal.md 的 `## Impact` 之下
 * - `### 架构影响`        —— design.md 的 `## Context` 之下
 * - `### Caller Updates`  —— tasks.md 的任务分组
 * - `[N<id>]`             —— 任务行的流程图节点标注
 *
 * MUST NOT 在模板或技能正文中另写这些字符串字面量。
 */

/** 影响面三制品锚点（标题文本，不含 `#` 前缀与缩进） */
export const VERIFY_ANCHORS = {
    /** proposal.md 的 `## Impact` 之下：影响面分析小节 */
    impactAnalysis: 'Impact Analysis',
    /** design.md 的 `## Context` 之下：架构影响小节 */
    architectureImpact: '架构影响',
    /** tasks.md 的任务分组：调用方更新承接小节 */
    callerUpdates: 'Caller Updates',
} as const;

/** 影响面三锚点所在制品（用于诊断消息） */
export const ANCHOR_ARTIFACTS = {
    impactAnalysis: 'proposal.md',
    architectureImpact: 'design.md',
    callerUpdates: 'tasks.md',
} as const;

/** 三级标题形态的锚点（Markdown 渲染用） */
export function renderAnchorHeading(anchor: string): string {
    return `### ${anchor}`;
}

/**
 * 任务行流程图节点标注 `[N<数字>]`。
 *
 * 全局标志用于一次提取一行中的全部标注（一个任务可承载多个流程节点）。
 * MUST NOT 匹配 `[N]`（无数字）或 `[Nx]`（非纯数字）一类形似写法。
 */
export const NODE_REF_PATTERN = /\[N(\d+)\]/g;

/**
 * 提取文本中全部流程图节点标注，保持出现顺序并去重。
 *
 * @param text - 待扫描文本（通常为一条任务的原始行）
 * @returns 形如 `['N4', 'N8']`；无标注时返回空数组
 */
export function extractNodeRefs(text: string): string[] {
    const result: string[] = [];
    const seen = new Set<string>();
    // 每次调用重建正则状态，避免 lastIndex 在全局标志下跨调用泄漏（纯函数语义）
    const pattern = new RegExp(NODE_REF_PATTERN.source, NODE_REF_PATTERN.flags);
    for (const match of text.matchAll(pattern)) {
        const id = `N${match[1]}`;
        if (seen.has(id)) continue;
        seen.add(id);
        result.push(id);
    }
    return result;
}

/**
 * 从文本中剥离全部节点标注（标注不属于任务描述）。
 *
 * @param text - 原始文本
 * @returns 剥离后的文本（连续空白折叠为单个空格并 trim）
 */
export function stripNodeRefs(text: string): string {
    const pattern = new RegExp(NODE_REF_PATTERN.source, NODE_REF_PATTERN.flags);
    return text.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
}
