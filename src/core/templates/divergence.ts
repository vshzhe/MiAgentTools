/**
 * 需求发散（divergence analysis）的单一源（变更 `git-branch-isolation`）。
 *
 * 五维定义、落盘形态与就绪门判定口径在这里维护一次，供：
 *   - `spec-explore`（1.5.6 产出）
 *   - `spec-propose`（映射到 proposal `## Impact` 的承接表）
 *   - `workflow` / `auto-workflow`（Phase 2.0 五维扩面）
 *   - `readiness.ts`（第 5 判定）
 * 引用；MUST NOT 在各模板内各写一份副本。
 *
 * 契约见 `openspec/specs/divergence-analysis/spec.md`。
 */

/** 探索产物中的段落名 */
export const DIVERGENCE_SECTION = '## 需求发散';

/** proposal 中的承接表小节名 */
export const DIVERGENCE_HANDOFF_ANCHOR = '需求发散承接';

/** 五维定义（顺序即呈现顺序） */
export const DIVERGENCE_DIMENSIONS = [
    {
        key: 'direct',
        label: '直接影响',
        question: '需求字面涉及的功能与文件有哪些？',
    },
    {
        key: 'indirect',
        label: '间接影响',
        question: '哪些共享工具 / 数据模型 / 配置 / 公共组件 / 既有调用方会被牵动？',
    },
    {
        key: 'contract',
        label: '契约影响',
        question: 'API / CLI / 事件 / DB schema / 文件格式是否变化？向后兼容性如何？',
    },
    {
        key: 'sibling',
        label: '同类场景',
        question: '同一模式还有哪些调用点？同类功能是否需要同步改动？',
    },
    {
        key: 'nonfunctional',
        label: '非功能影响',
        question: '性能 / 并发 / 权限 / 可观测性 / 多语言与多平台是否受影响？',
    },
] as const;

/** 五个维度标签（顺序固定） */
export const DIVERGENCE_LABELS: readonly string[] = DIVERGENCE_DIMENSIONS.map((d) => d.label);

/**
 * 渲染五维清单（Markdown 表格）。
 *
 * 供探索正文与 references 共用；维度定义只在这里维护。
 */
export function renderDivergenceDimensions(): string {
    const rows = DIVERGENCE_DIMENSIONS.map((d) => `| ${d.label} | ${d.question} |`);
    return ['| 维度 | 追问 |', '| :--- | :--- |', ...rows].join('\n');
}

/**
 * 渲染探索侧的需求发散段（主文件精简版 + references 指针）。
 */
export function renderDivergenceSection(): string {
    return `**需求发散（1.5.6，强制；细则见 \`references/divergence-analysis.md\`）**

在 1.5.5 功能流程图之后产出探索产物 \`${DIVERGENCE_SECTION}\` 段，覆盖五维：${DIVERGENCE_LABELS.join(' / ')}。每条 MUST 带 \`文件:行\` 或 \`[推断]\` / \`[新建]\`；维度确无内容时写固定字面量 \`无\`（MUST NOT 留空）。**与 1.5.5 流程最终确认门合并呈现，不新增用户停顿**（门预算不变：探索阶段仍只有 1 个流程级阻塞门）；用户修改流程图时 MUST 重新评估受影响维度。

**为什么要做**：只覆盖「被点名的那一块」是最常见的漏项来源 —— 共享工具、契约、同类调用点、非功能影响靠临场记性，漏项到验证阶段才暴露。五维把「想到哪里」变成可核对产物，并由就绪门第 5 判定 \`divergence\` 做确定性校验（段存在 + 五维非空），避免退化为无人消费的散文。`;
}

/** 需求发散协议全文（写入 `references/divergence-analysis.md`） */
export const DIVERGENCE_ANALYSIS_FULL = `## 需求发散协议

### 五维定义

${renderDivergenceDimensions()}

### 证据与留痕

- 每条 MUST 带证据位置：\`文件:行\` 或 类.方法；**新建**项标 \`[新建]\` 并写明预期产物；**推断**项标 \`[推断]\`
- 无法追溯证据且非新建/推断的条目 MUST NOT 进入段内
- 维度确无内容时写固定字面量 \`无\` —— 留空视为缺失（就绪门判 fail）

### 产出时机与呈现（探索阶段）

- 位置：1.5.5 功能流程图之后、1.6 探索完成检测之前
- 呈现：与 1.5.5 的流程最终确认门**合并呈现**，用户一次确认覆盖两者
- 用户修改流程图 → MUST 重新评估受影响维度的条目，MUST NOT 保持陈旧结论
- **门预算不变**：探索阶段仍只有 1 个流程级阻塞门（flow-final-confirmation）

### 下游承接

| 消费方 | 承接形态 |
| :--- | :--- |
| \`iagent_spec_propose\` | proposal \`## Impact\` 下产出 \`### ${DIVERGENCE_HANDOFF_ANCHOR}\` 表：能力 / 影响类别 → 影响条目 → 承接需求 / 任务 |
| \`iagent_workflow\` / \`iagent_auto_workflow\` Phase 2.0 | 影响分析扩为五维归集；**一次广查询 + 分维归集**，MUST NOT 逐维调 CodeGraph；CodeGraph 不可用 / busy 耗尽 → Grep 估算 + WARN，不阻塞提案 |
| \`iagent_debug\` 2.2.3.5 | 分级信号 (d)「需求面扩展」：受影响模块超出原需求声明面时倾向深度路径 |
| \`iagent_spec_verify_proposal\` D2/D3 | 影响范围一致性检查以承接表为证据源之一 |
| \`readiness.ts\` | 第 5 判定 \`divergence\`：段存在 + 五维非空（纯确定性，无 AI 语义判定） |

### 就绪门判定口径

- 新变更（\`created >= 2026-11-22\`）缺段 / 空维度 → \`fail\`（\`valid=false\`）
- 存量变更 → \`skipped\` + WARN（不阻断）
- \`skip_specs\` / 历史 JSON-only → **不豁免**本判定（发散段与 specs 无关）
`;
