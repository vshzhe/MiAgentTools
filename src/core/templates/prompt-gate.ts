/**
 * 提示词校验门文本唯一源。
 *
 * 4 个工作流技能（iagent_spec_explore / iagent_workflow /
 * iagent_auto_workflow / iagent_debug）
 * 在探索动作之前统一执行本门：按维度自检用户输入清晰度，清晰则零打扰直通，
 * 不明确则先做提示词优化并阻塞等待用户确认，确认后的「提示词基线」成为
 * 下游唯一语义来源。
 *
 * 需求版与缺陷版仅维度表与清晰判据不同，Step 2-5 的流程文本完全共享，
 * 故以 buildPromptGateBlock(dimensions) 参数化渲染，避免流程文本重复维护；
 * 手写指令正文使用 buildPromptGateCompact(dimensions) 压缩渲染。
 */

/** 一个清晰度维度 */
export interface PromptDimension {
    /** 维度名（中英并列，如 "目标 Goal"） */
    name: string;
    /** 判定问题（用户视角的追问） */
    question: string;
    /** 该维出现何种情况时升级为硬不明确（阻断探索） */
    escalation: string;
    /** 是否计入硬不明确判据：清晰判定要求该维无 ❌ 与实质 ⚠️ */
    hardBlocking: boolean;
}

/** 需求六维：适用于需求 / 主题描述类输入 */
export const REQUIREMENT_DIMENSIONS: PromptDimension[] = [
    {
        name: '目标 Goal',
        question: '要做什么、为什么做？',
        escalation: '只有笼统动词（如"优化一下"）而无预期结果',
        hardBlocking: true,
    },
    {
        name: '对象 Object',
        question: '落在哪个模块 / 文件 / 页面 / 接口 / 行为？',
        escalation: '无法定位对象，或存在多个可能对象',
        hardBlocking: true,
    },
    {
        name: '范围 Scope',
        question: '改动边界？明确不做什么？',
        escalation: '边界开放且影响面不可控',
        hardBlocking: true,
    },
    {
        name: '约束 Constraints',
        question: '不能破坏什么？兼容性 / 技术栈限制？',
        escalation: '与既有实现存在互斥约束',
        hardBlocking: false,
    },
    {
        name: '验收 Acceptance',
        question: '怎样算完成？',
        escalation: '无任何可验证的完成判据',
        hardBlocking: false,
    },
    {
        name: '歧义 Ambiguity',
        question: '有无多义说法、指代不清、前后矛盾？',
        escalation: '影响范围 / 行为契约 / 验收的实质歧义',
        hardBlocking: true,
    },
];

/** 缺陷五维：适用于 bug 描述类输入（iagent_debug） */
export const BUG_DIMENSIONS: PromptDimension[] = [
    {
        name: '症状 Symptom',
        question: '现象是什么？在哪个功能 / 页面上出现？',
        escalation: '只有笼统断言（如"导出有 bug"）而无现象描述',
        hardBlocking: true,
    },
    {
        name: '复现步骤 Repro',
        question: '怎样触发？前置条件是什么？',
        escalation: '无任何复现线索，无法判断触发场景',
        hardBlocking: true,
    },
    {
        name: '期望 vs 实际 Expected vs Actual',
        question: '以为会发生什么？实际发生了什么？',
        escalation: '两者混淆或只给出其一，无法确立验收判据',
        hardBlocking: true,
    },
    {
        name: '环境 Environment',
        question: '版本 / 部署形态 / 数据条件？',
        escalation: '环境差异导致无法判断是否为缺陷',
        hardBlocking: false,
    },
    {
        name: '歧义 Ambiguity',
        question: '有无"时好时坏"类不确定描述、指代不清、前后矛盾？',
        escalation: '影响复现或验收的实质歧义',
        hardBlocking: true,
    },
];

/** 渲染维度判定表 */
function renderDimensionTable(dimensions: PromptDimension[]): string {
    const rows = dimensions.map((d) => `| ${d.name} | ${d.question} | ${d.escalation} |`);
    return ['| 维度 | 判定问题 | 升级为硬不明确的信号 |', '| :--- | :--- | :--- |', ...rows].join('\n');
}

/** 渲染清晰的判据（由计入硬不明确判据的维度名拼出） */
function renderClearCriterion(dimensions: PromptDimension[]): string {
    const blocking = dimensions.filter((d) => d.hardBlocking).map((d) => d.name);
    return `${blocking.join(' / ')} 均无 \`❌\` 与实质 \`⚠️\``;
}

/** 门控协议导言：告知 AI Agent 在遇到 ⛔ GATE 标记时必须停止响应的行为契约。
 * 所有含确认门的技能模板应在正文开头引入此段，以建立"门控 = 硬停止"的行为基线。 */
export const GATE_PROTOCOL_PREAMBLE = `## ⛔ GATE PROTOCOL — ACTIVE

This skill contains **CONFIRMATION GATES** marked with **⛔ GATE:**. Each gate is a HARD STOP:
- When you reach a ⛔ GATE, **YOUR RESPONSE ENDS THERE** — output the gate content, then STOP
- Do NOT execute, describe, or pre-generate steps beyond the gate
- The user\'s next message is the confirmation signal — resume from AFTER the gate only when they respond
- **VIOLATION**: executing beyond a gate without user confirmation is a critical error that corrupts the workflow`;

/**
 * 渲染完整提示词校验门文本（Step 1-5 + 入口形态适配）。
 *
 * @param dimensions - 场景维度集（需求六维或缺陷五维）
 * @returns 可直接内联进技能正文的 Markdown 门文本
 */
export function buildPromptGateBlock(dimensions: PromptDimension[]): string {
    return `### Prompt Validation Gate (提示词校验门)

**Step 1 — 清晰度自检**: 逐维判定用户输入，标记 \`✅ 清晰\` / \`⚠️ 歧义\` / \`❌ 缺失\`

${renderDimensionTable(dimensions)}

**Step 2 — 分级判定**

- **清晰**（${renderClearCriterion(dimensions)}）→ 用一句话复述你的理解，然后**直接进入探索**；不输出校验表格、不要求用户确认
- **不明确**（任一维 \`❌\` 或存在实质 \`⚠️\`）→ 执行 Step 3，并在 Step 4 **强制停止等待确认**
- **软不明确**（仅细节级歧义，不涉及范围 / 行为契约 / 验收标准）→ 记为 \`[假设]\` 并继续，不进入 Step 3

**Step 3 — 提示词优化**（仅不明确分支）

- **不篡改用户原始意图**：只做结构化与约束补全，绝不擅自增加用户未提出的需求
- 推断补齐的内容标 \`[推断]\`，无法推断的内容标 \`[待确认]\`；禁止把猜测写成既定事实
- 输出两部分：\`【优化后提示词】\`（目标 / 对象 / 范围 / 约束 / 验收 / 已知歧义）+ \`【优化说明】\`（改了哪里、为什么）
- 列出仍需用户补充的信息项

**Step 4 — ⛔ GATE: 确认门（强制停止）**

> **THIS IS A CONFIRMATION GATE. Your response MUST END here. Do NOT continue to any subsequent steps.**

- 呈现 \`【优化后提示词】\` 与 \`【优化说明】\` 后**立即结束本次响应**
- 用户确认前 MUST NOT 进入探索、创建探索文件、扫描代码库或发起追问
- 出口有四条，不得只认一条：① 用户确认 → 以优化版为基线；② 用户修改 → 以修改版为基线；③ 用户拒绝优化 → 记录原始提示词，按其原有理解继续；④ 用户显式授权按推断继续（如"你按你的判断来"）→ 将推断项标 \`[推断]\` 记入基线后继续。**MUST NOT 反复要求确认而陷入等待死循环。**

**Step 5 — 落盘提示词基线**

- 将「原始提示词」与「确认后的提示词基线」一并写入探索产物的 \`## 提示词基线\` 段（保留原始提示词供审计）
- 下游（提案 / 设计 / 规格 / 任务）以**提示词基线**为唯一语义来源；基线变更 MUST 回到本门重新确认

**入口形态适配**

- 校验对象 = 用户**最终提供**的需求描述：调用未携带描述时，先交互收集，再以收集后的描述执行本门；**MUST NOT 对空输入执行校验**
- 输入为**变更名**时，以该变更的既有制品为校验与探讨对象，MUST NOT 把变更名本身当作需求提示词评估清晰度
- 已存在经用户确认的提示词基线时（尤其上游已完成本门），**直接通过，不重复校验或再次要求确认**`;
}

/**
 * 渲染压缩版提示词校验门文本（供手写斜杠指令正文复用）。
 *
 * @param dimensions - 场景维度集（需求六维或缺陷五维）
 * @returns 压缩后的 Markdown 门文本
 */
export function buildPromptGateCompact(dimensions: PromptDimension[]): string {
    const dimensionNames = dimensions.map((d) => d.name).join(' / ');
    return `**Prompt Validation Gate (提示词校验门)**: 探索前强制自检用户输入，维度为 ${dimensionNames}。
- **清晰**（${renderClearCriterion(dimensions)}）→ 一句话复述理解后直通，不输出校验表、不要求确认
- **不明确**（任一维 \`❌\` 或实质 \`⚠️\`）→ 先做提示词优化，输出 \`【优化后提示词】\`（推断项标 \`[推断]\`、未知项标 \`[待确认]\`）与 \`【优化说明】\`，**⛔ GATE: 立即结束本次响应并等待用户确认或修改**（本次响应到此结束，收到用户响应后继续；出口：确认 / 修改 / 拒绝 / 显式授权按推断），**不得陷入等待死循环**
- **软不明确**（仅细节级歧义）→ 记 \`[假设]\` 继续
- 优化**不篡改原始意图**、不增加用户未提出的需求
- 校验结论与基线写入探索产物 \`## 提示词基线\` 段，作为下游唯一语义来源
- 空输入不校验；输入为变更名时以该变更既有制品为校验对象；上游已产出基线时直接通过`;
}
