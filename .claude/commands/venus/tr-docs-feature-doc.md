---
name: "Venus: 生成功能需求文档"
description: 扫描源项目功能模块，生成功能需求实现文档（功能地图）
allowed-tools: Bash(venus:*)
category: Venus / 文档
tags: [venus, tr_docs, feature-doc, documentation, analysis]
---

**Before proceeding, read openspec/rules/ai-coding.md for AI coding guardrails.** Mark undefined items as **[待确认]** and ask the user rather than guessing.

Scan a source project's feature modules and generate a feature requirement implementation document. **Trigger boundary**: this command scans source project code (feature map / 项目功能地图 / 迁移需求文档).

**Input**: optionally provide the source project path and feature entry after the command. Missing parameters are collected interactively; already-provided parameters are skipped. When invoked from the auto-migration workflow (non-interactive), use the injected parameters without asking.

---

## Step 1: Collect parameters

- **源项目根目录路径**: validate existence/readability first (Windows drive paths and POSIX paths both valid). Invalid path → report the error and ask for re-input — never guess-correct a path
- **功能入口**: 文件路径 / URL路由 / 模块名称 / 全项目
- **输出模式**: 新人上手（默认）/ 迁移重构 / 设计文档 / 全景扫描
- **框架档案**: quick-select a built-in profile (Venus4A / Spring MVC / Struts) or 未知框架 → auto-detect from project structure files (`pom.xml`, `web.xml`, `package.json`, ...) → present the conclusion as **[待确认：框架档案探测]** and confirm before scanning. Built-in profiles are selectable examples, never default assumptions
- **输出目录**: optional (see routing below)

## Step 2: Deep scan (entry-type driven)

- **Backend**: Controller dispatch logic → Service business logic → DAO SQL (parameterization vs concatenation → SQL injection risk from actual code) → entities
- **Frontend**: every page (fields/components/validation/JS functions), every interaction channel listed in the framework profile, field-level contracts
- **Config + database**: routing config, full table structures, indexes, enum values

## Step 3: Analysis artifacts (all mandatory)

- **功能-子功能层次分解**: Mermaid mindmap down to implementation points (类.方法() / 页面)
- **跨模块交互全景**: 模块依赖 → 接口调用 → 数据流联动, with a detail table per interaction
- **4 类流程图**（缺一不可）: 前后端交互时序图（每核心功能点）/ 接口交互流程图（每 Controller）/ 功能间交互流程图（多 Controller/多表时）/ 后端决策流程图（if/else 超3层或 switch 超3个 case 时）— every method name and condition traceable to actual code
- **数据库调用链追踪**: 操作汇总表 + 数据变换追踪（前端表单 → Controller 参数 → Service 变换 → SQL 参数 → 存储值）

## Step 4: Generate the document

11-section structure + appendix: 功能概述与层次分解 / 数据库设计（每表全字段）/ 前端页面实现 / API接口设计（字段级契约）/ 4类流程图 / 后端功能实现 / 数据库调用链 / 跨模块交互分析 / 特殊功能点实现方式 / 问题分析与建议 / 迁移建议；附录（文件清单、页面全矩阵、接口全契约、工具类引用全清单、建表SQL）.

Follow the anti-hallucination rules: every conclusion traceable to 文件:行号; unconfirmed information marked **[待确认：...]**; no vague summaries ("等", "主要包括", "相关" — list everything concretely). Follow the detail mandates A-G: per-page field tables, field-level frontend-backend contracts, per-method documentation (public + private 全覆盖), migration executability (re-implementable from the document alone), framework-driven page grouping, utility-class full coverage (every imported class listed with all used methods).

**Naming**: 单模块 `{功能模块名}_需求文档.md`; 全项目 `{项目名}_功能地图.md` + per-module docs; 多模块 `{模块集名称}_关联分析.md`.

**Output routing** (build all paths with `path.join()`):

| 执行上下文 | 输出路径 |
|------------|----------|
| Change context (auto-migration) | `openspec/changes/<change-name>/attachments/source-feature-doc/` |
| Standalone + user-specified directory | user-specified directory |
| Standalone, none specified | `openspec/migration/` |

**CodeGraph**: prefer CodeGraph tools (`codegraph_search` / `codegraph_callers` / `codegraph_callees` / `codegraph_impact`); if the source project has no index, automatically degrade to Glob/Grep/Read, record the degradation in the document header, and continue — never block or ask the user.

## Self-check

- [ ] 每条描述可追溯（文件:行号）；未确认信息已标 **[待确认]**
- [ ] 无「等/主要包括/相关」概括省略；字段/页面/方法/工具类全部完整列出
- [ ] 4 类流程图齐全且基于实际代码路径
- [ ] public + private 方法全覆盖；工具类引用全覆盖
- [ ] 只读此文档能完整重新实现该功能
- [ ] 文档保存至按上下文路由的输出路径

**Guardrails**
- Never invent algorithms, libraries, tables, or endpoints — read the code first
- Never assume a framework — profile (selected/provided/detected-and-confirmed) is the only source
- Invalid paths are re-collected, never guess-corrected
- Non-interactive mode never blocks on questions
- Use `path.join()` for all file paths
