/**
 * 验证清单单一源（`verify-checklist-single-source`）。
 *
 * D1-D10 核心/条件维度与 B1-B7 边界清单的**唯一正文源**。
 * 以下五处 MUST 以插值引用本模块，MUST NOT 各自手写清单正文：
 *   - spec-verify-proposal.ts / spec-verify.ts / workflow.ts / auto-workflow.ts / debug.ts
 *
 * 维度编号（D1-D10）、90% 统一阈值与总分公式 MUST NOT 因本模块的抽取而改变
 * （`test/verify-checklist-single-source.test.ts` 守护）。
 */

/** 渲染变体 */
export type VerifyChecklistVariant =
    /** 完整清单：父编排 / 验证技能使用 */
    | 'orchestrator'
    /** propose 压缩自检：确定性可判子集，不构成用户停门 */
    | 'propose-selfcheck';

export interface VerifyChecklistOptions {
    variant?: VerifyChecklistVariant;
}

/** 核心维度与条件维度的定义（D1-D10） */
export const VERIFY_DIMENSIONS = [
    { id: 'D1', label: '需求覆盖', description: 'Decisions → 规格需求' },
    { id: 'D2', label: '技术一致性', description: '技术选型 → `design.md`（design 缺失时从 specs / proposal 取证据，双无则 SKIP）' },
    { id: 'D3', label: '任务完整性', description: '规格需求 → 任务（优先消费结构化解析结论）' },
    { id: 'D4', label: '边界覆盖', description: '问题 / 边界场景 → 规格 Scenario' },
    { id: 'D5', label: 'Pending 解决', description: 'Pending 事项 → 已解决' },
    {
        id: 'D6-D10',
        label: '条件维度',
        description: '交互细节 / API 契约 / 数据库映射 / 业务步骤 / 流程图节点覆盖，未触发不计分',
    },
] as const;

/** B1-B7 边界清单（单条文本） */
export const VERIFY_BOUNDARY_RULES = [
    'B1 自写制品自证（`independence=self` + WARN，结论必须带 `文件:行`）',
    'B2 FAIL 同上下文修复（禁止新开代理 / 全量重读，≤3）',
    'B3 归档内联失败沿用非阻断语义',
    'B4 debug fix 内联共用预算 ≤3',
    'B5 migration 上下文超限降级子代理 + WARN',
    'B6 spec-bulk-archive 保留并行子代理（≤3）',
    'B7 无 `delegate` 宿主仅阻断 propose/apply',
] as const;

/** 阈值（单一源；改动须单独显式确认） */
export const VERIFY_THRESHOLD = 90;

/** 总分公式（单一源） */
export const VERIFY_SCORE_FORMULA =
    'Overall Score = (D1 + D2 + D3 + D4 + D5 + sum(triggered D6-D10)) / (5 + triggered_count)';

/** propose 压缩自检的确定性可判子集（不依赖 AI 语义） */
export const PROPOSE_SELF_CHECK_ITEMS = [
    '每个 Requirement 至少有一个承接任务（`Spec Ref` 为全路径 `<capability> / <Requirement>`）',
    '每个 Scenario 至少有一个 `[测试]` 任务覆盖（`Scenario Ref` 为全路径或由同任务 Spec Ref 补全）',
    '影响面三锚点齐备：`### Impact Analysis` / `### 架构影响` / `### Caller Updates`',
    '`proposal` 声明的能力 ↔ `specs/<capability>/` 目录逐一对应',
    '每个任务标注对应的流程图节点 `[N<id>]`（变更含功能流程图时）',
] as const;

/**
 * 渲染验证清单正文。
 *
 * @param options - 变体（默认 `orchestrator`）
 * @returns Markdown 正文（可被技能模板插值）
 */
export function renderVerifyChecklist(options: VerifyChecklistOptions = {}): string {
    const variant = options.variant ?? 'orchestrator';
    if (variant === 'propose-selfcheck') {
        return renderProposeSelfCheck();
    }
    return renderOrchestratorChecklist();
}

function renderOrchestratorChecklist(): string {
    const dimensionLines = VERIFY_DIMENSIONS.map(
        (dimension) => `**${dimension.id}: ${dimension.label}** — ${dimension.description}`,
    );
    return [
        '**固定清单（D1-D10 核心维度 + B1-B7 边界）**：',
        '',
        ...dimensionLines.map((line, index) => `${index + 1}. ${line}`),
        `${dimensionLines.length + 1}. **B1-B7 边界清单**：${VERIFY_BOUNDARY_RULES.join('／')}`,
        '',
        `> 阈值：统一 ${VERIFY_THRESHOLD}%；${VERIFY_SCORE_FORMULA}。`,
        '> 本清单由 `src/core/templates/verify-checklist.ts` 单一源渲染，MUST NOT 在各技能正文另写副本。',
    ].join('\n');
}

function renderProposeSelfCheck(): string {
    return [
        '**压缩自检清单（与验证清单同源的确定性可判子集，不构成用户停门）**：',
        '',
        ...PROPOSE_SELF_CHECK_ITEMS.map((item, index) => `${index + 1}. ${item}`),
        '',
        '> 本清单由 `src/core/templates/verify-checklist.ts` 的 `propose-selfcheck` 变体渲染。',
        '> FAIL 时自动修复并重跑（≤3）；超限后走既有三出口，MUST NOT 新增确认门。',
    ].join('\n');
}
