---
name: "Venus: 自动迁移"
description: 一站式自动迁移：源需求文档、变更提案、门控实现与完整性检查（含修复循环）
allowed-tools: Bash(venus:*)
category: Venus / 实现
tags: [venus, tr_impl, auto-migration, migration, automation]
---

**Before proceeding, read openspec/rules/ai-coding.md for AI coding guardrails.** Mark undefined items as **[待确认]** and ask the user rather than guessing.

One-stop automated feature migration from a source project into the current (target) project. **Trigger boundary**: full pipeline only — standalone scanning is `/venus:tr-docs-feature-doc`, standalone comparison is `/venus:tr-impl-migration-check`.

**Input**: optionally provide the source project path and feature entry after the command. Missing parameters are collected interactively; already-provided parameters are skipped.

---

## Phase 1: Source requirement document + distill confirmation (automated)

Determine the change name (project naming convention) and create `openspec/changes/<change-name>/attachments/source-feature-doc/`, then invoke the `venus_tr_docs_feature_doc` skill in non-interactive mode (source project, feature entry, 迁移重构模式, source framework profile, output directory) → document lands in that directory. Resolve **[待确认]** gaps with the user before proceeding. Then distill a core-feature list from the document, present it for user confirmation (user may trim; discrepancies are **[待确认]** user-adjudicated; an empty list BLOCKS — rescan or narrow the feature entry), and write the confirmed list into `exploration.md` (`## 蒸馏核心功能清单`).

## Phase 2: Target spec loading + change proposal (automated, no mid-flow confirmation)

Explore the target project (read-only, auto CodeGraph→Glob/Grep fallback), load the target project coding specs (CLAUDE.md/AGENTS.md/openspec main specs; missing → WARN + inferred conventions marked **[待确认]**), migrate the exploration material (incl. the distilled feature list and `## 目标项目规范要点`) into `exploration.md`, and generate standard artifacts via `venus spec status`/`venus spec instructions` loops (proposal → specs → design → tasks) under the spec-essentials constraints. CLI missing (command-not-found signature) → CLI-degraded generation in the built-in dependency order.

## Phase 3: Implementation confirmation gate (flow gate)

Present the unified implementation plan (change name, task batches, affected files) and ask 是否需要调整:
- 不调整 → implement immediately by the apply protocol (concurrent batches, centrally-managed checkboxes; every dispatch instruction injects the target spec essentials as binding constraints)
- 需要调整 → present artifacts for editing, then re-enter the gate

(Phase 1 distill confirmation is the requirement-clarification gate — two confirmation points in total.)

## Phase 4: Review sub-agent migration check + fix loop

Dispatch an independent review sub-agent (Agent tool) with ALL inputs (confirmed core-feature list, source requirement doc, target implementation scope, both projects, framework profiles) → inside it invoke the `venus_tr_impl_migration_check` skill in non-interactive mode → output to `attachments/migration-check/`, layered with a core-feature coverage matrix (trimmed features excluded). The review sub-agent MUST also perform **B组架构融入检查**: C11 (异常体系融入 — P0), C12 (工具类复用 — P1), C13 (架构一致性 — P2). Sub-agent failure: serial retry once → degrade to main-flow direct invocation → still failing: WARN + complete-with-warning (never silently skip). P0/P1 problems: present list + fix suggestions → user confirms → fix (sync change tasks) → re-check, until none remain, the user stops, or the retry limit is hit (then: snapshot + WARN, complete-with-warning). P2 only: record and finish.

Build all paths with `path.join()`. Guardrails: read-only passthrough for analysis steps; zero-guess (**[待确认]**); sub-skills invoked, not re-implemented. Supplement document routing: SQL → `attachments/sql/`, config → `attachments/config/`, adversarial check reports → `attachments/migration-check/07_对抗检查/`, others → `attachments/`.
