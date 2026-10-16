/**
 * docs 类型技能模板：变更提案转评审需求文档（八章节映射转换）。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';

export function getRequirementDocSkillTemplate(): SkillTemplate {
    return {
        name: 'iagent_requirement_doc',
        description: '把变更制品（proposal.md / design.md / specs/**/*.md + tasks.md）转换为标准八章节需求文档（requirement document）供人工评审。当用户要生成需求文档 / 需求单 / 转换提案为需求文档时使用。NOT for 扫描源项目生成迁移需求文档——那用 iagent_feature_doc。',
        instructions: `**适用 openspec/rules/ai-coding.md 全域护栏。** 未定义项标 **[待确认]**，禁止猜测。

Convert an OpenSpec change proposal into a standard requirement document for human review.

**Input**: The user's request should include a change name. If omitted, check if it can be inferred from conversation context. If ambiguous, ask the user.

---

## Step 1: Locate the change proposal files

Search in order:

1. **Active change directory**: \`openspec/changes/{change-name}/\`
2. **Archived change directory**: \`openspec/changes/archive/{date}-{change-name}/\`
3. **User-specified path**

If the change name is unknown, ask the user. Use \`path.join()\` for all paths (cross-platform). Optionally, run \`iagent spec status --json\` to enumerate active changes (CLI-degraded: if the command is unavailable, fall back to the directory search above).

Record the archive status from where the proposal files are found — it determines the output path in Step 6: active (under \`openspec/changes/\`), archived (under the archive directory, or a user-specified path containing an archive segment), or user-specified without an archive segment.

## Step 2: Choose execution mode

**Standalone mode (default when invoked directly)**:
- Collect basic information interactively using the **AskUserQuestion tool** — every question is skippable:
  - 需求编号 (format: REQ-YYYY-XXX)
  - 需求名称
  - 交付时间 (format: YYYY-MM-DD)
  - 原始需求 (original requirement text, optional paste)
- Skipped fields use placeholders the user can fill in later.

**Non-interactive mode (when invoked from a workflow)**:
- Do NOT ask any questions.
- Use Markdown format, placeholder basic information.
- The user can re-run this skill standalone later to fill in details.
- **Caller note (自动调用方为验证阶段 + 归档)**: the workflows that automatically invoke this skill are the VERIFICATION phase (\`iagent_auto_workflow\` Phase 3 / \`iagent_workflow\` Phase 3.5) and the ARCHIVE phase (\`iagent_spec_archive\` pre-archive checkpoint step 4.8, plus its parallel step in \`iagent_spec_bulk_archive\`). \`iagent_debug\` MUST NOT invoke it. **Manual invocation stays available at any stage** — standalone mode below is unchanged.

## Step 3: Read the change artifacts

Read in priority order (skip missing files gracefully):

1. \`proposal.md\` / \`design.md\` / \`specs/**/*.md\` — OpenSpec Markdown primary source: Why / What Changes / Capabilities / Impact; Context / Goals / Non-Goals / Decisions / Risks; Requirement + Scenario
2. \`tasks.md\` (at the change directory root) — task groups, page/table/schedule details
3. **Legacy JSON fallback (WARN, 仅存量 / 已归档变更)**: historical \`change.json\` / \`tasks.json\` — used only when the Markdown artifacts are missing; log a WARN (non-blocking)

Legacy JSON sidecars (\`.iagent/decisions.json\`) are deprecated — never rely on them.

## Step 4: Map content to requirement document sections

| 需求文档章节 | 信息来源 | 转换规则 |
|--------------|----------|----------|
| **基本信息** | 用户交互（独立模式）/ 占位符（非交互模式） | 跳过项用占位符 |
| **一、原始需求** | proposal.md → Why + 用户输入 | 合并 why 背景 + 用户提供的原文 |
| **二、需求分析 → 需求理解** | proposal.md + design.md | 按功能场景分组（见场景分组规则），每个场景独立子章节 |
| **二、需求分析 → 非本期范围** | design.md → Non-Goals | 仅填写明确不做、超出边界、无实现计划的内容（有 Phase 计划的功能在场景中呈现） |
| **二、需求分析 → 需求拆解** | proposal.md → What Changes | 功能项 → 需求拆解表格；复杂业务规则按伪代码注入规则补充伪代码块 |
| **三、技术框架** | design.md（Decisions + Context） | 架构图/组件关系图 + 关键技术决策表格（直接遍历 design.decisions[] 渲染，不做散文推断）+ 接口设计，同一章节呈现完整技术设计；算法/数据流转/接口逻辑按伪代码注入规则补充伪代码块 |
| **四、业务流程** | design.md Decisions + Context | decisions → 流程图；context → 流程说明；流程判定逻辑按伪代码注入规则补充伪代码块 |
| **五、页面设计** | tasks.md + specs/**/*.md + design.md | 页面变更信息 + 功能设计交互图（仅有页面交互设计时生成） |
| **六、表结构设计** | design.md（数据库设计） + tasks.md | 提取完整 DDL（含建表、索引、序列、预置数据） |
| **七、影响分析** | proposal.md → Impact | 直接映射模块/客户/调度影响 |
| **八、评审记录** | 空模板 | 待评审后填写 |

**Markdown-first extraction**: Read structured data from the OpenSpec Markdown artifacts:
- \`design.decisions[]\` → render the 关键技术决策 table directly by iterating entries (no AI inference from prose)
- \`tasks.md\` → structured task data for 需求拆解 / 页面设计 / 表结构设计
- \`proposal.capabilities\` + \`specs[].operations[].scenarios\` → capability→scenario mapping for 场景分组
- Markdown artifact missing → fall back to legacy JSON, read-only (WARN, non-blocking)

## Step 5: Tech stack detection (generic rules)

This skill is tech-stack agnostic. Do NOT assume a specific stack:

1. Read \`openspec/config.yaml\` \`context\` field for declared tech stack (e.g., TypeScript, Java, Python, Go).
2. Check project files for corroboration (package.json, pom.xml, go.mod, Cargo.toml).
3. Use stack-appropriate conventions for 接口设计 (path formats), 表结构设计 (DDL dialect), 页面设计 (component types).
4. **Non-applicable sections**: when the change involves no database, no UI pages, or no interfaces, output a short "本变更不涉及" note for that section. NEVER emit empty tables.

## Requirement understanding — scenario grouping rules

Group functional points from proposal/design into scenarios:

| 场景类型 | 识别依据 |
|----------|----------|
| **管理配置场景** | 规则管理、CRUD操作、配置页面、权限控制 |
| **业务使用场景** | 运行时调用、查询/导出/页面展示、API集成 |
| **后台任务场景** | 定时任务、批量处理、异步调度 |
| **AI/智能场景** | AI模式、智能识别、ML/LLM接入、算法预留 |

Rules:
- Phase 标注（如 Phase 2/3）仅表示实现时间计划，功能仍应在场景中列出并标注计划时间
- 预留接口/预留能力属于架构设计，应在场景中列出并说明设计意图
- 仅当功能明确不做、超出边界或无实现计划时，才归入「非本期范围」
- 单个场景功能点超过 8 个时拆分为子场景；提案中无实际内容的场景类型不生成
- 功能点描述业务逻辑而非技术细节（不写类名/方法名/字段名），用户视角表达

## Diagram generation rules

Use ASCII box-and-arrow characters (\`┌ ┐ └ ┘ ──▶ ▼\`) for:
- **业务流程图**: from design.decisions + design.context
- **功能设计交互图**: only when page interaction flows exist in design/tasks
- **技术框架图**: only when the design section contains an architecture design

Omit diagram subsections when the artifacts contain no corresponding design. Name nodes with business semantics, not file names. Annotate triggers/conditions on arrows.

## Pseudocode injection rules

Inject language-neutral Chinese pseudocode into the 二、需求分析, 三、技术框架, and 四、业务流程 sections when the artifacts contain derivable logic, to make complex rules easier to review:

- **Syntax**: use a \`\`\`pseudocode fenced block with language-neutral constructs (IF/THEN/ELSE/END IF/FOR EACH) and Chinese business-semantic object.attribute expressions (e.g., \`IF 规则.名称为空 THEN 返回错误("名称必填")\`)
- **Placement**: the block sits immediately after the corresponding table, diagram, or decision point; the first comment line cites the source section (e.g., \`// 来源: design.decisions #2\`) so reviewers can trace it back
- **Identifier constraint**: NEVER use real class names, method names, or field names — Chinese business semantics only
- **Gap handling**: when the skeleton is derivable but branch/condition details are missing, mark the missing detail inline as **[待确认]** (aligned with the DDL rules); when the artifacts contain no derivable logic for a section, do not emit a pseudocode block and leave no empty block
- **Length limits**: at most 15 lines per block and at most 3 blocks per section; when exceeded, keep only the highest-priority logic — multi-branch decision logic first, core algorithm/data-flow second, loop/batch-processing third
- **Skip rule**: do not generate pseudocode for decision points already clearly expressed in the surrounding plain text or tables

## DDL extraction rules

- **Primary source**: design.decisions → database design decisions (complete CREATE TABLE, indexes, sequences, seed data)
- **Supplement**: tasks.md → database change task groups (table names, purpose, change type)
- Use the dialect matching the detected tech stack; do not invent tables or columns not present in the artifacts — mark gaps as **[待确认]**
- Generate the 涉及表 summary table from extracted DDL

## Step 6: Generate the document

Output structure (Markdown):

\`\`\`\`markdown
# 需求文档: {变更名称}

## 基本信息
| 项目 | 内容 |
|------|------|
| 需求编号 | REQ-YYYY-XXX 或占位符 |
| 需求名称 | {功能名称} |
| 交付时间 | YYYY-MM-DD 或占位符 |

## 一、原始需求
{需求单原文 / proposal Why 背景}

## 二、需求分析
### 需求理解
{整体概述}
#### 场景一: {场景名称}
{一句话核心目标}
需要实现的功能点：
- {功能点}: {功能说明，涉及模块}

### 非本期范围
| 范围项 | 说明 | 原因 |

### 需求拆解
| 需求项 | 功能描述 | 优先级 | 类型 |

\`\`\`pseudocode
// 来源: proposal.whatChanges — 仅有可推导的复杂业务规则时生成
FUNCTION 校验输入(表单数据)
    IF 表单数据.名称为空 THEN 返回错误("名称必填")
    IF 表单数据.类型 NOT IN 支持类型列表 THEN 返回错误("类型不支持")
END FUNCTION
\`\`\`

## 三、技术框架
### 3.1 总体技术框架 {架构图，如有}
### 3.2 关键技术决策
| 决策点 | 选择方案 | 原因 |
### 3.3 接口设计 {如有}

\`\`\`pseudocode
// 来源: design.decisions #N — 核心算法/数据流转逻辑
FOR EACH 记录 IN 待处理数据集
    IF 记录.状态 = "已变更" THEN 加入同步队列
END FOR
\`\`\`

## 四、业务流程
### 流程图
### 流程说明
| 步骤 | 操作说明 | 异常处理 |

\`\`\`pseudocode
// 来源: design.context — 流程判定逻辑
IF 变更目录已存在 THEN
    走更新分支（追加缺失文档）
ELSE
    创建新变更目录
END IF
\`\`\`

## 五、页面设计
{本变更不涉及 或 页面/交互信息}

## 六、表结构设计
{本变更不涉及 或 涉及表 + DDL}

## 七、影响分析
### 模块影响 / 客户影响 / 调度影响 / 无影响项

## 八、评审记录
> **评审状态**: 待评审
\`\`\`\`

**Output path** — routed by the archive status recorded in Step 1:

| Change location | Output path |
|-----------------|-------------|
| Active change directory \`openspec/changes/{change-name}/\` | \`openspec/changes/{change-name}/需求文档.md\` |
| Archived change directory \`openspec/changes/archive/{date}-{change-name}/\` | \`openspec/devdocs/{date}-{change-name}-需求文档.md\` |
| User-specified path containing an archive segment | \`openspec/devdocs/{date}-{change-name}-需求文档.md\` |
| User-specified path without an archive segment | \`需求文档.md\` in the directory containing the proposal files |

Routing rules:
- The \`{date}\` prefix matches the archive command's directory naming logic (\`YYYY-MM-DD-\`); parse it from the archive directory name
- When the archive directory name has no parseable \`YYYY-MM-DD-\` prefix, fall back to \`openspec/devdocs/{change-name}-需求文档.md\` without a timestamp
- Create the target directory if missing (devdocs or change directory), using \`path.join()\`
- When the target file already exists, overwrite it silently — regeneration is idempotent and must not block on questions
- **This silent-overwrite rule is intentional and MUST NOT be softened**: protecting human-authored content is the CALLER's duty. Callers that may face an already-reviewed document (the archive checkpoints) MUST detect the existing file themselves and take the in-place alignment branch instead of calling this skill — see \`iagent_spec_archive\` step 4.8. This skill therefore stays a pure "produce the document" primitive.

## Output verification

After generation, check:
- [ ] 文档结构完整（基本信息 + 8 个编号章节）
- [ ] 需求理解按功能场景分组，每个场景含场景描述句和功能点列表
- [ ] 功能点描述关注业务逻辑，Phase 计划功能已标注
- [ ] 非本期范围仅含明确不做/超出边界的内容
- [ ] 需求拆解表格与场景功能点对应一致
- [ ] 无内容章节输出「本变更不涉及」而非空表格
- [ ] 图表使用 ASCII 字符可正确渲染
- [ ] 伪代码块使用 \`\`\`pseudocode 语法且块首标注 artifacts 来源
- [ ] 伪代码无真实类名/方法名/字段名（语言无关中文业务语义）
- [ ] 伪代码行数（≤15 行/块）与块数（≤3 块/章节）符合上限
- [ ] 伪代码缺失细节处已标 **[待确认]**，无虚构逻辑
- [ ] 文件保存至按归档状态判定的输出路径成功

**Guardrails**
- Never invent database tables, API endpoints, or business rules not present in the artifacts — mark as **[待确认]**
- Pseudocode must restate only logic present in the artifacts — never invent branches or conditions; mark derivation gaps as **[待确认]**
- Non-interactive mode (workflow integration): never block on questions; use placeholders
- Generation failure from workflow integration is non-blocking: log a warning, the user can re-run standalone
- Use \`path.join()\` for all file paths`,
        allowedTools: 'Read, Write, Edit, Glob, Grep, Bash(iagent:*)',
        type: 'docs',
        license: 'MIT',
        compatibility: '纯文件读取与生成，无 CLI 硬依赖（iagent spec status 为可选加载方式）；支持 standalone 交互与非交互工作流集成双模式。',
        metadata: { author: 'mi-agent-tools' },
    };
}

export function getRequirementDocCommandTemplate(): CommandTemplate {
    return {
        name: 'iAgent: 需求文档生成',
        description: '变更提案（proposal/design/tasks/specs）转八章节评审需求文档',
        category: 'iAgent / 文档',
        tags: ['iagent', 'docs', 'requirement-doc', 'documentation', 'review'],
        content: `**适用 openspec/rules/ai-coding.md 全域护栏。** 未定义项标 **[待确认]**，禁止猜测。

Convert an OpenSpec change proposal (proposal/design/tasks/specs) into a standard eight-section requirement document for human review. **Trigger boundary**: change-proposal → requirement doc only — source-project feature scanning for a migration requirement doc is \`/iagent:feature-doc\`.

**Input**: optionally specify a change name after \`/iagent:requirement-doc\` (e.g., \`/iagent:requirement-doc add-auth\`). If omitted, infer from conversation context; if ambiguous, ask the user.

---

## Step 1: Locate the change proposal files

Search in order: active \`openspec/changes/{change-name}/\` → archived \`openspec/changes/archive/{date}-{change-name}/\` → user-specified path. Use \`path.join()\` for all paths. Optionally run \`iagent spec status --json\` to enumerate active changes (CLI-degraded: fall back to directory search if unavailable). Record the archive status — it determines the output path in Step 6.

## Step 2: Choose execution mode

**Standalone** (default when invoked directly): collect basic info interactively via AskUserQuestion (需求编号 REQ-YYYY-XXX / 需求名称 / 交付时间 YYYY-MM-DD / 原始需求 — all skippable, skipped fields use placeholders). **Non-interactive** (workflow verification phase): no questions, Markdown format with placeholder basic info; user can re-run standalone later to fill in details.

## Step 3: Read the change artifacts

Read in priority order (skip missing gracefully):

1. \`proposal.md\` / \`design.md\` / \`specs/**/*.md\` (OpenSpec Markdown primary source)
2. \`tasks.md\` (at the change directory root — task groups/page-table-schedule details)
3. **Legacy JSON fallback (WARN, 仅存量 / 已归档变更)**: historical \`change.json\` / \`tasks.json\` — used only when Markdown is missing (log WARN, non-blocking)

**Decisions table rendering rule**: render the "关键技术决策" table in section 三 by iterating over \`design.decisions[]\` entries — one row per entry with columns: 决策编号(id) / 决策项(title) / 选择方案(choice) / 理由(rationale) / 风险(risks). No AI inference from prose is needed. The legacy \`.iagent/decisions.json\` sidecar is deprecated (absorbed into \`design.decisions\`) — never rely on it.

## Step 4: Map content to requirement document sections

| 需求文档章节 | 信息来源 | 转换规则 |
|--------------|----------|----------|
| **基本信息** | 用户交互（独立模式）/ 占位符（非交互模式） | 跳过项用占位符 |
| **一、原始需求** | proposal.md → Why + 用户输入 | 合并 why 背景 + 用户提供的原文 |
| **二、需求分析 → 需求理解** | proposal.md + design.md | 按功能场景分组（见场景分组规则），每个场景独立子章节 |
| **二、需求分析 → 非本期范围** | design.md → Non-Goals | 仅填写明确不做、超出边界、无实现计划的内容（有 Phase 计划的功能在场景中呈现） |
| **二、需求分析 → 需求拆解** | proposal.md → What Changes | 功能项 → 需求拆解表格；复杂业务规则按伪代码注入规则补充伪代码块 |
| **三、技术框架** | design.md（Decisions + Context） | 架构图/组件关系图 + 关键技术决策表格（直接遍历 design.decisions[] 渲染，不做散文推断）+ 接口设计，同一章节呈现完整技术设计；算法/数据流转/接口逻辑按伪代码注入规则补充伪代码块 |
| **四、业务流程** | design.md Decisions + Context | decisions → 流程图；context → 流程说明；流程判定逻辑按伪代码注入规则补充伪代码块 |
| **五、页面设计** | tasks.md + specs/**/*.md + design.md | 页面变更信息 + 功能设计交互图（仅有页面交互设计时生成） |
| **六、表结构设计** | design.md（数据库设计） + tasks.md | 提取完整 DDL（含建表、索引、序列、预置数据） |
| **七、影响分析** | proposal.md → Impact | 直接映射模块/客户/调度影响 |
| **八、评审记录** | 空模板 | 待评审后填写 |

## Step 5: Tech stack detection + scenario/diagram/pseudocode/DDL rules

Tech-stack agnostic. Read \`openspec/config.yaml\` \`context\` field, corroborate with project files (package.json/pom.xml/go.mod/Cargo.toml), use stack-appropriate conventions for 接口设计/表结构设计/页面设计. **Non-applicable sections**: when the change involves no database, no UI pages, or no interfaces, output a short "本变更不涉及" note — NEVER emit empty tables.

**Scenario grouping** (4 types): 管理配置场景 (规则管理/CRUD/配置页面/权限控制) · 业务使用场景 (运行时调用/查询导出/API集成) · 后台任务场景 (定时任务/批量处理/异步调度) · AI/智能场景 (AI模式/ML接入/算法预留). Rules: Phase 标注仅表计划时间，功能仍在场景中列出；预留接口属架构设计，须列出并说明设计意图；仅明确不做/超出边界/无实现计划的归入非本期范围；单场景功能点 >8 时拆分子场景；无实际内容的场景类型不生成；功能点写业务逻辑不写技术细节。

**Diagram**: ASCII box-and-arrow (\`┌ ┐ └ ┘ ──▶ ▼\`) for 业务流程图 (design.decisions + design.context) / 功能设计交互图 (only when page interaction flows exist) / 技术框架图 (only when the design section has an architecture design). Omit when no corresponding design. Name nodes with business semantics. Annotate triggers/conditions on arrows.

**Pseudocode** (inject into 二、需求分析/三、技术框架/四、业务流程 when artifacts contain derivable logic): \`\`\`pseudocode fenced block, language-neutral (IF/THEN/ELSE/END IF/FOR EACH) + Chinese business-semantic object.attribute expressions. Placement: immediately after the corresponding table/diagram/decision point, first comment line cites the source section (\`// 来源: design.decisions #2\`). NEVER use real class/method/field names. Gap handling: derivable skeleton but missing branch/condition details → mark inline **[待确认]**; no derivable logic → no block, no empty block. Length: ≤15 lines/block, ≤3 blocks/section; when exceeded keep multi-branch decision logic first, core algorithm/data-flow second, loop/batch third. Skip: do not generate for decision points already clearly expressed in surrounding plain text/tables.

**DDL extraction**: primary source = design.decisions → database design (complete CREATE TABLE/indexes/sequences/seed data); supplement = tasks.md → database change task groups. Use dialect matching detected tech stack; do not invent tables/columns — mark gaps as **[待确认]**. Generate 涉及表 summary table from extracted DDL.

## Step 6: Generate the document

Output structure (Markdown, eight sections):

\`\`\`\`markdown
# 需求文档: {变更名称}

## 基本信息
| 项目 | 内容 |
|------|------|
| 需求编号 | REQ-YYYY-XXX 或占位符 |
| 需求名称 | {功能名称} |
| 交付时间 | YYYY-MM-DD 或占位符 |

## 一、原始需求
{需求单原文 / proposal Why 背景}

## 二、需求分析
### 需求理解
{整体概述}
#### 场景一: {场景名称}
{一句话核心目标}
需要实现的功能点：
- {功能点}: {功能说明，涉及模块}

### 非本期范围
| 范围项 | 说明 | 原因 |

### 需求拆解
| 需求项 | 功能描述 | 优先级 | 类型 |

\`\`\`pseudocode
// 来源: proposal.whatChanges — 仅有可推导的复杂业务规则时生成
FUNCTION 校验输入(表单数据)
    IF 表单数据.名称为空 THEN 返回错误("名称必填")
    IF 表单数据.类型 NOT IN 支持类型列表 THEN 返回错误("类型不支持")
END FUNCTION
\`\`\`

## 三、技术框架
### 3.1 总体技术框架 {架构图，如有}
### 3.2 关键技术决策
| 决策点 | 选择方案 | 原因 |
### 3.3 接口设计 {如有}

\`\`\`pseudocode
// 来源: design.decisions #N — 核心算法/数据流转逻辑
FOR EACH 记录 IN 待处理数据集
    IF 记录.状态 = "已变更" THEN 加入同步队列
END FOR
\`\`\`

## 四、业务流程
### 流程图
### 流程说明
| 步骤 | 操作说明 | 异常处理 |

\`\`\`pseudocode
// 来源: design.context — 流程判定逻辑
IF 变更目录已存在 THEN
    走更新分支（追加缺失文档）
ELSE
    创建新变更目录
END IF
\`\`\`

## 五、页面设计
{本变更不涉及 或 页面/交互信息}

## 六、表结构设计
{本变更不涉及 或 涉及表 + DDL}

## 七、影响分析
### 模块影响 / 客户影响 / 调度影响 / 无影响项

## 八、评审记录
> **评审状态**: 待评审
\`\`\`\`

**Output path** — routed by the archive status recorded in Step 1:

| Change location | Output path |
|-----------------|-------------|
| Active change directory \`openspec/changes/{change-name}/\` | \`openspec/changes/{change-name}/需求文档.md\` |
| Archived change directory \`openspec/changes/archive/{date}-{change-name}/\` | \`openspec/devdocs/{date}-{change-name}-需求文档.md\` |
| User-specified path containing an archive segment | \`openspec/devdocs/{date}-{change-name}-需求文档.md\` |
| User-specified path without an archive segment | \`需求文档.md\` in the directory containing the proposal files |

Routing rules: \`{date}\` prefix matches the archive command's \`YYYY-MM-DD-\` naming (parse from archive directory name); no parseable prefix → fall back to \`openspec/devdocs/{change-name}-需求文档.md\`; create target directory if missing via \`path.join()\`; overwrite existing target file silently (regeneration is idempotent, no blocking questions — human-content protection is the CALLER's duty: the archive checkpoints detect an existing document themselves and align it in place via \`iagent_spec_archive\` step 4.8 instead of calling this skill).<br>**自动调用方为验证阶段 + 归档**：本技能的自动调用方是验证阶段（\`iagent_auto_workflow\` Phase 3 / \`iagent_workflow\` Phase 3.5）与归档阶段（\`iagent_spec_archive\` 步骤 4.8 与 \`iagent_spec_bulk_archive\` 的 a.6）；\`iagent_debug\` MUST NOT 自动调用本技能。**手工独立调用不受影响**。

## Output verification

After generation, check: [1] 文档结构完整（基本信息 + 8 个编号章节）; [2] 需求理解按功能场景分组，每个场景含场景描述句和功能点列表; [3] 功能点描述关注业务逻辑，Phase 计划功能已标注; [4] 非本期范围仅含明确不做/超出边界的内容; [5] 需求拆解表格与场景功能点对应一致; [6] 无内容章节输出「本变更不涉及」而非空表格; [7] 图表使用 ASCII 字符可正确渲染; [8] 伪代码块使用 \`\`\`pseudocode 语法且块首标注 artifacts 来源; [9] 伪代码无真实类名/方法名/字段名（语言无关中文业务语义）; [10] 伪代码行数（≤15 行/块）与块数（≤3 块/章节）符合上限; [11] 伪代码缺失细节处已标 **[待确认]**，无虚构逻辑; [12] 文件保存至按归档状态判定的输出路径成功.

**Guardrails**: never invent DB tables/API endpoints/business rules not in artifacts — mark **[待确认]**; pseudocode restates only artifact logic — never invent branches/conditions, mark derivation gaps as **[待确认]**; non-interactive mode never blocks on questions (use placeholders); generation failure from workflow integration is non-blocking (log warning, user can re-run standalone); use \`path.join()\` for all file paths.`,
    };
}
