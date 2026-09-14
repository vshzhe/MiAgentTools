---
name: "Venus: 需求文档生成"
description: 变更提案（proposal/design/tasks/specs）转八章节评审需求文档
allowed-tools: Bash(venus:*)
category: Venus / 文档
tags: [venus, tr_docs, requirement-doc, documentation, review]
---

**Before proceeding, read openspec/rules/ai-coding.md for AI coding guardrails.** Mark undefined items as **[待确认]** and ask the user rather than guessing.

Convert an OpenSpec change proposal (proposal/design/tasks/specs) into a standard eight-section requirement document for human review. **Trigger boundary**: change-proposal → requirement doc only — source-project feature scanning for a migration requirement doc is `/venus:tr-docs-feature-doc`.

**Input**: optionally specify a change name after `/venus:tr-docs-requirement-doc` (e.g., `/venus:tr-docs-requirement-doc add-auth`). If omitted, infer from conversation context; if ambiguous, ask the user.

---

## Step 1: Locate the change proposal files

Search in order: active `openspec/changes/{change-name}/` → archived `openspec/changes/archive/{date}-{change-name}/` → user-specified path. Use `path.join()` for all paths. Optionally run `venus spec status --json` to enumerate active changes (CLI-degraded: fall back to directory search if unavailable). Record the archive status — it determines the output path in Step 6.

## Step 2: Choose execution mode

**Standalone** (default when invoked directly): collect basic info interactively via AskUserQuestion (需求编号 REQ-YYYY-XXX / 需求名称 / 交付时间 YYYY-MM-DD / 原始需求 — all skippable, skipped fields use placeholders). **Non-interactive** (workflow verification phase): no questions, Markdown format with placeholder basic info; user can re-run standalone later to fill in details.

## Step 3: Read the change artifacts

Read in priority order (skip missing gracefully): `proposal.md` (primary — Why/What Changes/Capabilities/Impact) → `design.md` (decisions/context/goals) → `tasks.md` (task groups/page-table-schedule details) → `specs/*.md` (delta specs — REQUIREMENTS/Interfaces).

## Step 4: Map content to requirement document sections

| 需求文档章节 | 信息来源 | 转换规则 |
|--------------|----------|----------|
| **基本信息** | 用户交互（独立模式）/ 占位符（非交互模式） | 跳过项用占位符 |
| **一、原始需求** | proposal.md → Why + 用户输入 | 合并 Why 背景 + 用户提供的原文 |
| **二、需求分析 → 需求理解** | proposal.md + design.md | 按功能场景分组（见场景分组规则），每个场景独立子章节 |
| **二、需求分析 → 非本期范围** | design.md → Non-Goals | 仅填写明确不做、超出边界、无实现计划的内容（有 Phase 计划的功能在场景中呈现） |
| **二、需求分析 → 需求拆解** | proposal.md → What Changes | 功能项 → 需求拆解表格；复杂业务规则按伪代码注入规则补充伪代码块 |
| **三、技术框架** | design.md → 架构设计 + Decisions | 架构图/组件关系图 + 关键技术决策表格 + 接口设计，同一章节呈现完整技术设计；算法/数据流转/接口逻辑按伪代码注入规则补充伪代码块 |
| **四、业务流程** | design.md + tasks.md | Decisions → 流程图；Context → 流程说明；流程判定逻辑按伪代码注入规则补充伪代码块 |
| **五、页面设计** | tasks.md + specs + design.md | 页面变更信息 + 功能设计交互图（仅有页面交互设计时生成） |
| **六、表结构设计** | design.md → Decisions（数据库设计） + tasks.md | 提取完整 DDL（含建表、索引、序列、预置数据） |
| **七、影响分析** | proposal.md → Impact | 直接映射模块/客户/调度影响 |
| **八、评审记录** | 空模板 | 待评审后填写 |

## Step 5: Tech stack detection + scenario/diagram/pseudocode/DDL rules

Tech-stack agnostic. Read `openspec/config.yaml` `context` field, corroborate with project files (package.json/pom.xml/go.mod/Cargo.toml), use stack-appropriate conventions for 接口设计/表结构设计/页面设计. **Non-applicable sections**: when the change involves no database, no UI pages, or no interfaces, output a short "本变更不涉及" note — NEVER emit empty tables.

**Scenario grouping** (4 types): 管理配置场景 (规则管理/CRUD/配置页面/权限控制) · 业务使用场景 (运行时调用/查询导出/API集成) · 后台任务场景 (定时任务/批量处理/异步调度) · AI/智能场景 (AI模式/ML接入/算法预留). Rules: Phase 标注仅表计划时间，功能仍在场景中列出；预留接口属架构设计，须列出并说明设计意图；仅明确不做/超出边界/无实现计划的归入非本期范围；单场景功能点 >8 时拆分子场景；无实际内容的场景类型不生成；功能点写业务逻辑不写技术细节。

**Diagram**: ASCII box-and-arrow (`┌ ┐ └ ┘ ──▶ ▼`) for 业务流程图 (design Decisions+Context) / 功能设计交互图 (only when page interaction flows exist) / 技术框架图 (only when design.md has architecture section). Omit when no corresponding design. Name nodes with business semantics. Annotate triggers/conditions on arrows.

**Pseudocode** (inject into 二、需求分析/三、技术框架/四、业务流程 when artifacts contain derivable logic): ```pseudocode fenced block, language-neutral (IF/THEN/ELSE/END IF/FOR EACH) + Chinese business-semantic object.attribute expressions. Placement: immediately after the corresponding table/diagram/decision point, first comment line cites artifact source (`// 来源: design.md 决策 #2`). NEVER use real class/method/field names. Gap handling: derivable skeleton but missing branch/condition details → mark inline **[待确认]**; no derivable logic → no block, no empty block. Length: ≤15 lines/block, ≤3 blocks/section; when exceeded keep multi-branch decision logic first, core algorithm/data-flow second, loop/batch third. Skip: do not generate for decision points already clearly expressed in surrounding plain text/tables.

**DDL extraction**: primary source = design.md → Decisions → database design (complete CREATE TABLE/indexes/sequences/seed data); supplement = tasks.md → database change task groups. Use dialect matching detected tech stack; do not invent tables/columns — mark gaps as **[待确认]**. Generate 涉及表 summary table from extracted DDL.

## Step 6: Generate the document

Output structure (Markdown, eight sections):

````markdown
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

```pseudocode
// 来源: proposal.md What Changes — 仅有可推导的复杂业务规则时生成
FUNCTION 校验输入(表单数据)
    IF 表单数据.名称为空 THEN 返回错误("名称必填")
    IF 表单数据.类型 NOT IN 支持类型列表 THEN 返回错误("类型不支持")
END FUNCTION
```

## 三、技术框架
### 3.1 总体技术框架 {架构图，如有}
### 3.2 关键技术决策
| 决策点 | 选择方案 | 原因 |
### 3.3 接口设计 {如有}

```pseudocode
// 来源: design.md 决策 #N — 核心算法/数据流转逻辑
FOR EACH 记录 IN 待处理数据集
    IF 记录.状态 = "已变更" THEN 加入同步队列
END FOR
```

## 四、业务流程
### 流程图
### 流程说明
| 步骤 | 操作说明 | 异常处理 |

```pseudocode
// 来源: design.md Context — 流程判定逻辑
IF 变更目录已存在 THEN
    走更新分支（追加缺失文档）
ELSE
    创建新变更目录
END IF
```

## 五、页面设计
{本变更不涉及 或 页面/交互信息}

## 六、表结构设计
{本变更不涉及 或 涉及表 + DDL}

## 七、影响分析
### 模块影响 / 客户影响 / 调度影响 / 无影响项

## 八、评审记录
> **评审状态**: 待评审
````

**Output path** — routed by the archive status recorded in Step 1:

| Change location | Output path |
|-----------------|-------------|
| Active change directory `openspec/changes/{change-name}/` | `openspec/changes/{change-name}/需求文档.md` |
| Archived change directory `openspec/changes/archive/{date}-{change-name}/` | `openspec/devdocs/{date}-{change-name}-需求文档.md` |
| User-specified path containing an archive segment | `openspec/devdocs/{date}-{change-name}-需求文档.md` |
| User-specified path without an archive segment | `需求文档.md` in the directory containing the proposal files |

Routing rules: `{date}` prefix matches the archive command's `YYYY-MM-DD-` naming (parse from archive directory name); no parseable prefix → fall back to `openspec/devdocs/{change-name}-需求文档.md`; create target directory if missing via `path.join()`; overwrite existing target file silently (regeneration is idempotent, no blocking questions).

## Output verification

After generation, check: [1] 文档结构完整（基本信息 + 8 个编号章节）; [2] 需求理解按功能场景分组，每个场景含场景描述句和功能点列表; [3] 功能点描述关注业务逻辑，Phase 计划功能已标注; [4] 非本期范围仅含明确不做/超出边界的内容; [5] 需求拆解表格与场景功能点对应一致; [6] 无内容章节输出「本变更不涉及」而非空表格; [7] 图表使用 ASCII 字符可正确渲染; [8] 伪代码块使用 ```pseudocode 语法且块首标注 artifacts 来源; [9] 伪代码无真实类名/方法名/字段名（语言无关中文业务语义）; [10] 伪代码行数（≤15 行/块）与块数（≤3 块/章节）符合上限; [11] 伪代码缺失细节处已标 **[待确认]**，无虚构逻辑; [12] 文件保存至按归档状态判定的输出路径成功.

**Guardrails**: never invent DB tables/API endpoints/business rules not in artifacts — mark **[待确认]**; pseudocode restates only artifact logic — never invent branches/conditions, mark derivation gaps as **[待确认]**; non-interactive mode never blocks on questions (use placeholders); generation failure from workflow integration is non-blocking (log warning, user can re-run standalone); use `path.join()` for all file paths.
