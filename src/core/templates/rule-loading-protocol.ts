/**
 * 规则与技能三层动态加载的共用细则（单一源）。
 *
 * 各技能模板的 `references/dynamic-rule-loading.md` 由本常量渲染，
 * MUST NOT 在多个模板中手写同一份细则（避免判据漂移）。
 *
 * 契约见 `openspec/specs/rule-loading-contract/spec.md`。
 */

export const DYNAMIC_RULE_LOADING_FULL = `# 规则与技能的三层动态加载（细则）

> 本文件是各技能「规则基线 / 技能基线」三层读取的共用细则。主 SKILL.md 只保留三层定义与读取要求，
> 需要判断某个 \`on-demand\` 源是否相关、或需要写未读声明时 MUST 先读本文件。

## 1. 三层定义

| 层 | 内容 | 判定依据 | 读取要求 |
| :--- | :--- | :--- | :--- |
| \`always\`（常驻基线） | \`.iagent/config.yaml\` 的 context、\`CLAUDE.md\`、\`AGENTS.md\` | 源类型（config / claude-md / agents-md） | **恒读**，MUST NOT 参与筛选 |
| \`phase\`（阶段相关） | \`.iagent/rules/<type>.md\` 中与技能类型匹配者 | \`iagent rules --json --type <本技能类型>\` 的 \`classification.phase\` | **MUST 读** |
| \`on-demand\`（按需点读） | 其余存在的规则源 | \`classification.onDemand\` | 与本阶段工作相关时读，否则显式声明不需要读 |

CLI 返回结构（单类型）：

\`\`\`json
{
  "sources": [ /* 全部枚举到的源（含 exists=false） */ ],
  "classification": {
    "type": "spec",
    "always": [".iagent/config.yaml", "AGENTS.md"],
    "phase": [".iagent/rules/spec.md"],
    "onDemand": [".iagent/rules/coding-rules.md", ".iagent/rules/testing-rules.md"],
    "fallback": false
  }
}
\`\`\`

## 2. 读取顺序（MUST NOT 重排）

1. \`always\` 层逐个读（缺失记「不存在」）
2. \`phase\` 层读（\`--type\` 命中者）
3. 判断 \`onDemand\` 层各源是否与本阶段工作相关：
   - 相关 → 读，并在声明中记 \`相关性: on-demand / 读取: 已读\`
   - 不相关 → **不读**，并在声明中记 \`相关性: on-demand / 读取: 未读\` + 一句理由

## 3. 何时把 \`on-demand\` 源判为相关（判据）

| 判据 | 示例 |
| :--- | :--- |
| 该源的主题与本阶段要产出的内容直接相关 | 实现阶段要改测试 → \`testing-rules.md\` 相关 |
| 该源包含本阶段必须遵守的禁止项 / 硬约定 | 要改模板 → \`coding-rules.md\` 的「模板唯一源」相关 |
| 变更涉及该源所辖的领域 | 变更只动 CLI → \`spec.md\` 相关、\`testing-rules.md\` 视是否加测试 |

**不确定时**：宁读勿漏 —— 读取并在声明中记理由。代价是多读一份，而非漏掉硬约束。

## 4. 未读声明格式（强制）

\`\`\`markdown
| 源 | 相关性 | 存在 | 读取 | 关键约束摘要 / 不需要读的理由 |
| :--- | :--- | :--- | :--- | :--- |
| \`.iagent/config.yaml\` | always | 是 | 已读 | <摘要> |
| \`.iagent/rules/spec.md\` | phase | 是 | 已读 | <摘要> |
| \`.iagent/rules/testing-rules.md\` | on-demand | 是 | 未读 | 本次不涉测试改动 |
| \`CLAUDE.md\` | always | 否 | — | 不存在 |
\`\`\`

**声明为「需要读」但未读 → 一致性门报 \`rules-not-read\` 并 fail；声明「不需要读」→ not-fail。**

## 5. 与一致性门的衔接

- 回执 \`rulesRead\`：实际读取的源路径列表
- 回执 \`rulesSkipped\`：声明为不需要读的源路径列表
- 一致性门：\`iagent spec conformance --change <name> --strict --rules-read "<...>" --rules-skip "<...>"\`

\`--rules-skip\` 中列出的源不参与漏读判定；未列入且未读的源照常 fail。

## 6. 技能侧（\`iagent skills\`）

| 参数 | 语义 |
| :--- | :--- |
| \`--phase design\` | 只取 \`phases\` 含 \`design\` 或 \`both\` |
| \`--phase implement\` | 只取 \`phases\` 含 \`implement\` 或 \`both\` |
| \`--scope backend\` / \`--scope frontend\` | 只取该范围；\`scope\` 为空的存量技能**不排除** |

**范围收窄是条件动作**：只有变更范围已明确时才传 \`--scope\`，未明确时 MUST NOT 传（禁止猜范围）。

## 7. fallback 处置

\`classification.fallback === true\` 表示 \`phase\` 层为空（该技能类型无对应规则文件）：

- 按 \`always\` 层继续，**MUST NOT 回退为全量读取**
- 在产物中记 WARN 一行：\`规则基线：技能类型 <type> 无对应规则文件，已回退常驻基线\`

## 8. 与 handoff 规范要点的关系

\`iagent_spec_propose\` 生成 handoff \`## 规范要点\` 时：

- \`always\` / \`phase\` 层 → 蒸馏要点，逐条标注来源路径
- \`onDemand\` 层 → 以「指针 + 一行摘要」保留（\`<path>\` — <该规则的适用域>），需要时回读全文
- **MUST NOT 静默丢弃任一存在源** —— 指针即保留

下游（apply / verify / archive）只读复用，MUST NOT 重新枚举或重产整包。
`;
