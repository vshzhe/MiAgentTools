/**
 * 需求发散判定实现（变更 `git-branch-isolation`）。
 *
 * 就绪门第 5 判定 `divergence` 的**纯函数**实现：只做确定性存在性校验
 * （段存在 + 五维小节非空或固定字面量「无」），MUST NOT 含 AI 语义判定。
 *
 * 五维定义来自 `src/core/templates/divergence.ts`（单一源）。
 * 契约见 `openspec/specs/divergence-analysis/spec.md`。
 */

import { DIVERGENCE_LABELS, DIVERGENCE_SECTION } from '../../templates/divergence.js';

/** 虚线段标题文本（去掉 `## ` 前缀） */
const SECTION_TITLE = DIVERGENCE_SECTION.replace(/^#+\s*/, '');

/** 正则元字符转义 */
export function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 从原文中截取 `## 需求发散` 段正文（至下一个同级或更高级标题为止）。
 *
 * @param raw - `exploration.md` 全文；`undefined` 视为无段
 * @returns 段正文；段不存在时 `null`
 */
export function extractDivergenceSection(raw: string | undefined): string | null {
    if (raw === undefined) return null;
    const lines = raw.split(/\r?\n/);
    let fenced = false;
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (/^(```|~~~)/.test(trimmed)) {
            fenced = !fenced;
            continue;
        }
        if (fenced) continue;
        const match = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[i]);
        if (match === null) continue;
        if (start === -1) {
            if (match[1].length === 2 && match[2].trim() === SECTION_TITLE) start = i + 1;
            continue;
        }
        if (match[1].length <= 2) return lines.slice(start, i).join('\n');
    }
    return start === -1 ? null : lines.slice(start).join('\n');
}

/**
 * 判断某维度在段内是否有内容。
 *
 * 视为「有内容」的三种形态：
 *   1. `### <label>` 小节下存在非空行（读到下一个同级或更高级标题为止）；
 *   2. 表格行 `| <label> | ... |` 的其余列至少一列非空（`—` / `-` 不算）；
 *   3. 列表行 `- **<label>**：...` / `- <label>：...` 冒号后非空。
 */
export function hasDimensionContent(section: string, label: string): boolean {
    const lines = section.split(/\r?\n/);
    const escaped = escapeRegExp(label);

    const headingPattern = new RegExp(`^#{3,6}\\s*${escaped}\\s*$`);
    const tablePattern = new RegExp(`^\\|\\s*\\**${escaped}\\**\\s*\\|(.+)$`);
    const listPattern = new RegExp(`^[-*]\\s*\\**${escaped}\\**\\s*[:：]\\s*(.*)$`);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        const tableMatch = tablePattern.exec(line);
        if (tableMatch !== null) {
            const cells = tableMatch[1].split('|').map((cell) => cell.trim());
            if (cells.some((cell) => cell !== '' && cell !== '—' && cell !== '-')) return true;
            continue;
        }

        const listMatch = listPattern.exec(line);
        if (listMatch !== null) {
            const value = listMatch[1].replace(/^\*\*|\*\*$/g, '').trim();
            if (value !== '' && value !== '—') return true;
            continue;
        }

        if (!headingPattern.test(line)) continue;
        for (let j = i + 1; j < lines.length; j++) {
            const inner = lines[j].trim();
            const heading = /^(#{1,6})\s+/.exec(inner);
            if (heading !== null && heading[1].length <= 3) break;
            if (inner !== '' && inner !== '—' && inner !== '-') return true;
        }
        return false;
    }
    return false;
}

/** 判定结果：缺失项清单（空数组 = 齐备） */
export function findDivergenceGaps(raw: string | undefined): string[] {
    const section = extractDivergenceSection(raw);
    if (section === null) return [`缺少 \`${DIVERGENCE_SECTION}\` 段`];
    const gaps: string[] = [];
    for (const label of DIVERGENCE_LABELS) {
        if (!hasDimensionContent(section, label)) {
            gaps.push(`维度「${label}」为空（无内容且未写固定字面量「无」）`);
        }
    }
    return gaps;
}
