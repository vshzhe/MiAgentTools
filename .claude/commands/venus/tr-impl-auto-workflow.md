---
name: "Venus: 全自动工作流"
description: 一站式全自动工作流：探索（L1-L5 确认）→ 自动提案 → 自动验证 → 自动实现（auto-mode）→ 自动归档
allowed-tools: Bash(venus:*)
category: Venus / 实现
tags: [venus, tr_impl, auto-workflow, automation]
---

**Before proceeding, read openspec/rules/ai-coding.md for AI coding guardrails.** Mark undefined items as **[待确认]** and ask the user rather than guessing.

One-stop automated workflow from exploration to archive. **Trigger boundary**: full pipeline only — interactive guided workflow is `venus_tr_impl_workflow`.

**Input**: The argument after the command is the user's topic description (what they want to build). Missing parameters are collected interactively; already-provided parameters are skipped.

---

## Phase 1: Exploration (L1-L5 user confirmation)

Create exploration file at `openspec/explorations/<keyword>-explore-<sequence>.md` (kebab-case keyword, auto sequence; use `path.join()`). Run the mandatory **1.1.2 Prompt Validation Gate（澄清门，确认 WHAT；auto 语义不得跳过或静默通过）**、then the mandatory 1.1.5 CONTEXT.md startup check (load existing 术语表 or mark for creation), initialize the structured format (Background / 提示词基线 / Codebase Findings / Questions / 术语表 / 架构决策 / 边界场景 / Decision Process / Decisions / Scope Changes / Pending), then 1.2.0.5 capability memory injection (scan `openspec/specs/<capability>/explorations.md` and inject historical decisions). Run the mandatory 1.2.1 CodeGraph base scan (`codegraph_status` first; `codegraph_files` + `codegraph_search`; Glob/Grep fallback only after confirmed unavailable) and the conditional 1.2.1.5 multi-project agent scan (spawn sub-agent with `projectPath` for other project paths). Then grill-with-docs questioning (L1 Intent / L2 Solution / L3 Exception / L4 Consistency / L5 Boundary; one question at a time, each with AI recommendation; write answers to exploration.md real-time). Auto-execute keyword-detected analysis (Security / Architecture Flow / Impact Analysis — always run) and `codegraph_impact` (parallel for multiple symbols). Completion check: consistency, L1-L5 coverage, file completeness — if no hard conflicts, proceed to Phase 2 directly (consistency passthrough).

**1.1.2 Prompt Validation Gate (MANDATORY, 澄清门)**:

**Prompt Validation Gate (提示词校验门)**: 探索前强制自检用户输入，维度为 目标 Goal / 对象 Object / 范围 Scope / 约束 Constraints / 验收 Acceptance / 歧义 Ambiguity。
- **清晰**（目标 Goal / 对象 Object / 范围 Scope / 歧义 Ambiguity 均无 `❌` 与实质 `⚠️`）→ 一句话复述理解后直通，不输出校验表、不要求确认
- **不明确**（任一维 `❌` 或实质 `⚠️`）→ 先做提示词优化，输出 `【优化后提示词】`（推断项标 `[推断]`、未知项标 `[待确认]`）与 `【优化说明】`，**阻塞等待用户确认或修改**后才继续；出口四条：确认 / 修改 / 拒绝（按原理解继续）/ 显式授权按推断（推断项记入基线后继续），**不得陷入等待死循环**
- **软不明确**（仅细节级歧义）→ 记 `[假设]` 继续
- 优化**不篡改原始意图**、不增加用户未提出的需求
- 校验结论与基线写入探索产物 `## 提示词基线` 段，作为下游唯一语义来源
- 空输入不校验；输入为变更名时以该变更既有制品为校验对象；上游已产出基线时直接通过

校验对象为用户最终提供的主题描述（未携带主题时先交互收集）；用户确认或修改前 MUST NOT 推进到 1.1.5 及之后的任何步骤。

## Phase 2: Proposal (automated, no mid-flow confirmation)

Auto-execute 2.0 impact analysis (`codegraph_impact` for Pending symbols; parallel for multiple). Migrate exploration file from `openspec/explorations/` to `openspec/changes/<change-name>/exploration.md` — **Preserve the exploration file — do NOT delete it.** Inline artifact generation: `venus spec status --change "<name>" --json` → loop `venus spec instructions <artifact-id> --change "<name>" --json` → Write, in dependency order (proposal → specs → design → tasks). CLI-degraded: if the first `venus spec status` fails with command-not-found signature ("command not found" / "不是内部或外部命令" / "not recognized"), generate in built-in dependency order using embedded rules; do NOT retry CLI mid-flow. Non-command-not-found CLI errors: report, suggest re-running `venus spec status --change "<name>" --json` to locate the first ready artifact and resume generation (no regeneration of completed artifacts), continue next artifact. Tasks type labels: each task includes a type label (`[代码]` / `[DB脚本]` etc.); supplement tasks include `产出:` field; default path `attachments/<filename>`.

## Phase 3: Verification (automated)

Auto-execute D1-D5 verification: invoke the `venus_spec_verify_proposal` skill (Skill tool) for scoring; fallback to AI inline scoring + WARN if unavailable; unified 90% threshold; tech stack detected from config.yaml. **PASS (≥90%)**: auto-execute deep proposal review (`venus_tr_impl_review_proposal` skill; fallback inline deep review + WARN) → auto-generate requirement document (`venus_tr_docs_requirement_doc` skill, non-interactive; output `openspec/changes/<change-name>/需求文档.md`; WARN+continue on failure) → auto-transition to Phase 4. **FAIL (<90%)**: auto-fix and re-run; if still FAIL, offer [Manual edit] / [Return to exploration] / [View detailed diff] (no skip-to-apply path); do NOT generate requirement document until re-verification passes.

## Phase 4: Auto-Apply (automated, auto-mode=true)

After verification passes and requirement document is generated: announce "## Auto-Apply Phase"; construct apply context with `auto-mode=true` (skip design confirmation gate — consistent with venus_spec_apply: Step 5.5 gate skipped in auto-mode, directly Step 6 batch scheduling) and `change-name`; execute apply workflow logic following the venus_spec_apply skill's Step 6+ batch scheduling behavior with auto-mode=true; all tasks implemented automatically with existing batch scheduling. Error handling: compile check fails (after 3 auto-fix attempts) → pause and wait for user, do NOT proceed to archive; sub-agent fails → auto-retry once, then pause and report; user interrupts → complete current batch, mark remaining as incomplete, then pause.

## Phase 5: Auto-Archive (automated)

After apply completes and compile check passes: announce "## Auto-Archive Phase"; construct archive context with `change-name` (skips selection prompt); execute archive workflow logic following the venus_spec_archive skill template; all steps automatic (delta spec sync, CONTEXT.md sync, CodeGraph check, exploration memory sync, directory move, ARCHIVE-INDEX.md update). Error handling: delta spec sync conflict → auto-merge with conflict markers (non-blocking); CONTEXT.md sync fails → WARN, continue; CodeGraph not initialized → skip CodeGraph steps, continue; exploration memory sync fails → WARN, continue; archive target already exists → fail with error, suggest renaming. Completion: display full summary and "## Auto-Workflow Complete ✓".

---

## Guardrails

Don't skip questioning; don't auto-proceed on hard conflict (consistency passthrough only when no hard conflict); read-only operations (file reading, CodeGraph, analysis) run without confirmation but L1-L5 clarification gates still wait; MUST validate prompt before exploring (1.1.2 提示词校验门，清晰直通 / 不明确须优化并确认，未确认不推进); auto semantics never skip the clarification gate; don't deadlock on the confirmation gate (确认 / 修改 / 拒绝 / 授权按推断四条出口); do persist the prompt baseline into `## 提示词基线`; auto-verify after proposal; auto-apply after verification pass with auto-mode=true (venus_spec_apply Step 5.5 skipped); auto-archive after apply complete (venus_spec_archive skill); auto-generate requirement doc after full pass (venus_tr_impl_review_proposal deep review → venus_tr_docs_requirement_doc non-interactive; WARN+continue on failure); MUST create file before questioning; MUST verify file before migration; MUST preserve source on migration failure; MUST NOT offer method selection; do explore codebase before asking; do provide recommendations; do update file real-time; do use structured format; do show quantified scores; do inject capability memory; do scan other projects with CodeGraph; don't lose exploration (file persists). Build all paths with `path.join()`.
