---
name: "Venus: 归档变更"
description: 归档变更 —— 归档已实现完成的变更并同步主规格与知识图谱
allowed-tools: Bash(venus:*)
category: Venus / 规格
tags: [venus, spec, archive]
---

**Before proceeding, read openspec/rules/ai-coding.md for AI coding guardrails.**

Archive a completed change in the change workflow.

**Input**: Optionally specify a change name after `/venus:spec-archive` (e.g., `/venus:spec-archive add-auth`). If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **If no change name provided, prompt for selection**: If a change name was already provided (from workflow auto-archive context), skip selection and proceed to Step 2. Otherwise, run `venus spec status --json` to get available changes. Use the **AskUserQuestion tool** to let the user select. Show only active changes. Do NOT guess or auto-select.

2. **Check artifact completion status**: Run `venus spec status --change "<name>" --json`. Parse `schemaName`, `planningHome`, `changeRoot`, `artifactPaths`, `actionContext`, `artifacts`. If `actionContext.mode: "workspace-planning"`, STOP. If artifacts not `done`, display warning and proceed (no confirmation).

3. **Check task completion status**: Read `tasks.md`, count `- [ ]` vs `- [x]`. If incomplete tasks found, display warning and proceed. If no tasks file, proceed without warning.

4. **Assess delta spec sync state and execute AI merge**: Use `artifactPaths.specs.existingOutputPaths` to check for delta specs. If none, skip sync. If delta specs exist:
   - Compare each delta spec with main spec at `openspec/specs/<capability>/spec.md`
   - Classify changes: **ADDED** / **MODIFIED** / **REMOVED** / **RENAMED**
   - Show combined summary, execute the AI merge directly (no prompt)
   - **Inline merge** (no separate skill): ADDED → append; MODIFIED → replace in place; REMOVED → delete; RENAMED → update identifier + cross-refs. Follow v1.1.20 specs-apply merge semantics.
   - If already synced: skip. If sync fails: log warning, proceed (non-blocking).

4.5 **Pre-Archive CONTEXT.md Sync (MANDATORY)**: Check `openspec/CONTEXT.md` exists. If yes: read it + `proposal.md` + `design.md`, auto-supplement missing terms. If no: create from change artifacts (domain terms from Why, technical terms from Decisions). Skip if no artifacts. Do NOT block archive on failure.

4.6 **Pre-Archive CodeGraph Status Check (MANDATORY)**: Run `codegraph status` (single detection step — do NOT pre-check `.codegraph/` with Glob). If succeeds: record stats, proceed. If fails (CLI not in PATH or any error): skip ALL CodeGraph steps (4.6 + 6.5) with WARN, proceed — never prompt user.

4.7 **Pre-Archive Exploration Memory Sync (MANDATORY)**: Check change dir for `exploration.md`. If missing: skip. Determine capabilities from delta specs (`specs/<capability>/spec.md`). If no delta specs: skip. For each capability: target `openspec/specs/<capability>/explorations.md` (create if missing), extract Decisions/术语表/边界场景/Codebase Findings (not process Q&A), append `## <change-name>（归档日期 YYYY-MM-DD）`. If new decisions contradict earlier ones: mark old with `> 已过时（由 <change-name> 取代）` — never delete history. Non-blocking on failure.

5. **Perform the archive**: Run `venus spec archive "<name>" --yes` — performs state check + directory move (creates `openspec/changes/archive/`, names target `YYYY-MM-DD-<change-name>`, moves `changeRoot`). If target exists: fail with options (rename / delete duplicate / wait). Preserve `.openspec.yaml` and `attachments/`.

6. **Move requirement document to devdocs (if present)**: Check `ls "openspec/changes/archive/YYYY-MM-DD-<name>/需求文档.md"`. If exists: move to `openspec/devdocs/YYYY-MM-DD-<change-name>-需求文档.md` (fallback no timestamp if no date prefix; create devdocs dir if needed; overwrite existing). If not exists: skip silently.

7. **Update or create ARCHIVE-INDEX.md**: Skip for workspace-scoped changes. File at `openspec/changes/archive/ARCHIVE-INDEX.md`. If not exists: create with header + tables + footer. If exists: append entry — extract date/name/module/summary from `proposal.md`; scan `tasks.md` for non-`[代码]` type labels, append `[含xxx]` to summary; update "归档变更列表" and "模块统计" tables; update footer timestamp. Use `path.join()` on Windows.

6.5 **Post-Archive CodeGraph Sync + Verification (conditional)**: Only if 4.6 confirmed CodeGraph enabled. Run `codegraph sync` to index implemented code. Verify with MCP `codegraph_search` for change name + key symbols from `tasks.md`/`design.md`. Display "✓ N symbols verified" or warn. Non-blocking on failure (log warning, don't block archive).

8. **Display summary**: Change name, schema, archive location, spec sync status, archive index status, CodeGraph sync status, exploration memory sync status, any warnings.

**Output On Success**

```
## Archive Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** openspec/changes/archive/YYYY-MM-DD-<name>/
**Specs:** ✓ Synced to main specs
**Archive Index:** ✓ Updated ARCHIVE-INDEX.md
**Exploration Memory:** ✓ Synced to specs/<capability>/explorations.md (or skip/failed variants)
**CodeGraph:** ✓ Synced (or "Not initialized — skipped" or "Sync skipped due to error")

All artifacts complete. All tasks complete.
```

**Guardrails**
- Always prompt for change selection if not provided (unless from workflow context)
- Use artifact graph (venus spec status --json) for completion checking
- Don't block archive on warnings - just inform
- Preserve .openspec.yaml and `attachments/` — they move with the change directory
- Scan `tasks.md` for supplement type labels, append `[含xxx]` to ARCHIVE-INDEX summary
- Sync exploration memory before archive move; skip with log when missing; never block on failure
- If delta specs exist, run sync assessment and execute inline AI merge directly (ADDED/MODIFIED/REMOVED/RENAMED → main spec, v1.1.20 specs-apply semantics)
