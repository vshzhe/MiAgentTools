---
name: venus_tr_impl_auto_migration
description: One-stop automated feature migration — distill the source project (via venus_tr_docs_feature_doc + user-confirmed core-feature list), load the target project coding specs, create a standard OpenSpec change proposal and implement it under those specs after the implementation gate, then an independent review agent cross-checks source vs target functionality and generates a report with a P0/P1 fix loop (via venus_tr_impl_migration_check). Use when the user wants to migrate a feature or module from a source project into the current (target) project automatically (自动迁移 / 功能迁移 / auto migration / migrate feature to this project). NOT for standalone source-project scanning (use venus_tr_docs_feature_doc) or standalone post-migration comparison (use venus_tr_impl_migration_check).
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(venus:*), Bash(codegraph:*)
license: MIT
compatibility: 依赖 venus CLI（spec 命令组）；CLI 缺失时降级为 AI 内联生成（CLI-degraded generation）。
metadata:
  author: venus-agent-tools
  version: "1.0"
  type: tr_impl
  generatedBy: "snapshot"
  generatedFingerprint: "sha256:0adc86a3a07be283d318ffea3fb91240c61cbd8f5cc7a0a52e2e4593c4ad16b6"
---

**Before proceeding, read openspec/rules/ai-coding.md for AI coding guardrails.** Mark undefined items as **[待确认]** and ask the user rather than guessing.

One-stop automated feature migration across four phases: source requirement document generation with distilled core-feature confirmation → target-project exploration (incl. target coding-spec loading) + change proposal generation → implementation confirmation gate → review sub-agent migration check with fix loop. The flow structure mirrors the spec-driven workflow (`/venus:spec-explore` → `/venus:spec-propose` → `/venus:spec-apply`) and the one-stop guided workflow `/venus:tr-impl-workflow` (exploration → proposal → verification); exploration and proposal generation run automatically (consistency passthrough). Two mid-flow confirmation points, distinct in nature: the **distill confirmation** in Phase 1 (requirement-clarification gate — confirms WHAT to migrate) and the **implementation gate** in Phase 3 (flow gate — confirms HOW to implement); the Phase 2→3 consistency passthrough is unaffected.

**Trigger boundary**: this skill orchestrates the FULL migration pipeline (扫描源项目 → 变更提案 → 实现 → 迁移对比). Standalone source-project scanning belongs to `venus_tr_docs_feature_doc`; standalone post-migration comparison belongs to `venus_tr_impl_migration_check`.

---

## Step 0: Collect migration inputs

Collect (AskUserQuestion, every missing item; skip already-provided ones):

| 输入 | 必填 | 说明 |
|------|------|------|
| SOURCE_PROJECT (源项目根目录) | 是 | Path must exist and be readable — invalid path → explicit error + re-entry, NEVER guess-correct |
| 功能入口 (feature entry) | 是 | File path / URL route / module name / whole project |
| TARGET_PROJECT (目标项目根目录) | 否 | Defaults to the current project |
| 源项目框架档案 (source framework profile) | 否 | Unknown framework → structure auto-detection, result presented as **[待确认]** for user confirmation (same rules as venus_tr_docs_feature_doc) |
| 目标项目框架档案 (target framework profile) | 否 | Same collection rules; target architecture info feeds Phase 2 |
| 迁移范围说明 (optional scope notes) | 否 | Constraints from the user (e.g., only backend, keep DB schema) |

All paths MUST be built with `path.join()` (cross-platform: Windows drive letters + POSIX separators).

## Phase 1: Source requirement document generation (automated)

1. Determine the change name FIRST (follow the project's change naming convention, e.g., `add-<module>-<feature>` for a feature migration) and create `openspec/changes/<change-name>/attachments/source-feature-doc/` with `path.join()` — all Phase 1 outputs land there directly, no staging or moving.
2. Invoke the **venus_tr_docs_feature_doc** skill (Skill tool) in **non-interactive mode**: inject SOURCE_PROJECT, feature entry, output mode = 迁移重构模式, source framework profile, and the output directory from step 1.
3. The generated requirement document is the single source of truth for the migration. Gaps in it stay marked **[待确认]** — resolve them with the user BEFORE Phase 2, do not guess.
4. **Distill and confirm core features (蒸馏确认)**: distill a core-feature list from the requirement document (core features, business rules, API-contract essentials — distilled, not the full document). Present the list to the user for confirmation (AskUserQuestion; the user may trim entries). Discrepancies between the list and the document/source code are marked **[待确认]** and resolved by the user (correct the list OR update the document) — never guessed. An EMPTY list BLOCKS the flow: ask the user to rescan the source project or narrow the feature entry — never continue with an empty list. After confirmation, write the list into `openspec/changes/<change-name>/exploration.md` under a `## 蒸馏核心功能清单` section (create the file at the end of Phase 1; Phase 2 step 1 keeps this section when consolidating exploration material). The confirmed list is the derivation input for Phase 2 proposal AND the review-scope baseline for Phase 4; user-trimmed entries are recorded in exploration.md and EXCLUDED from the Phase 4 review scope (never reported as missing-function P0/P1).

## Phase 2: Target exploration + change proposal generation (automated, no mid-flow confirmation)

1. The change directory already exists (created in Phase 1). Migrate the exploration material (source requirement document summary + target exploration findings) into `openspec/changes/<change-name>/exploration.md` — PRESERVE the `## 蒸馏核心功能清单` section written in Phase 1.
2. Explore the TARGET project (and optionally SOURCE_PROJECT) with CodeGraph-first scanning (per the codegraph_status-first rule): run `codegraph_status` first to confirm the index, then use the codegraph tools as the primary investigation path; CodeGraph queries, file reading, config parsing execute directly without confirmation per the read-only passthrough principle; CodeGraph unavailable → auto-fallback to Glob/Grep with a log line.
3. **Load target-project coding specs (目标项目规范加载)**: read the TARGET project's coding-spec files — CLAUDE.md, AGENTS.md, and the openspec main specs (`openspec/specs/`) — and distill the spec essentials (naming/layering/directory conventions, mandatory rules) into `exploration.md` under a `## 目标项目规范要点` section. These essentials are BINDING constraints for design/tasks derivation (step 4) and for the Phase 3 sub-agent dispatch instructions. When no spec files exist: log a WARN, infer conventions from the target code structure (naming/layering/directory patterns) as the substitute, present the inference as **[待确认]**, and continue — never block.
4. Generate standard OpenSpec change artifacts by the propose protocol:
   - `venus spec status --change "<name>" --json` → `venus spec instructions <artifact-id> --change "<name>" --json` → Write the artifact file; loop in dependency order (proposal → specs → design → tasks).
   - **CLI-degraded generation**: if the first `venus spec status` call fails with a command-not-found signature ("command not found" / "不是内部或外部命令" / "not recognized"), state the conclusion once and generate all artifacts purely by AI in the template's built-in dependency order; do NOT retry CLI calls mid-flow.
   - Spec scenarios, design decisions, and tasks MUST be derived from the source requirement document + the confirmed core-feature list + target architecture + the target coding-spec essentials; every derived item traces back to the source document (anti-hallucination: no invented fields, endpoints, or business rules).
5. No confirmation prompt between exploration and proposal (consistency passthrough) — proceed straight to Phase 3.

## Phase 3: Implementation confirmation gate (flow gate)

1. Present the unified implementation plan: change name, task groups / concurrent batches, affected files, and the migration scope.
2. Ask ONE question (AskUserQuestion): 是否需要调整 (adjust the plan / artifacts)?
   - **不调整 (proceed)** → implement immediately by the apply protocol: batch scheduling loop, one sub-agent per dispatch unit, concurrency limit from `openspec/config.yaml` (`apply.concurrency`, default 3); task checkboxes updated centrally by the coordinator. On entering the implementation stage, FIRST determine whether the shared context pack (`context-pack.md`, per the apply protocol) is available:
     - **Pack available** → the target coding-spec essentials (`exploration.md` → `## 目标项目规范要点`) MUST be written into the context pack's `## 规范要点` section, merged with the `openspec/rules/ai-coding.md` essentials as an additional source; the target-project essentials remain BINDING constraints, so the migrated code conforms to the TARGET project's conventions.
     - **Pack unavailable** → degrade to per-sub-agent inline injection (the pre-existing behavior: every dispatch instruction inlines the essentials) + a WARN; the migration implementation MUST NOT be blocked.
     - **No target-project spec essentials** (the target project has no spec files AND Phase 2 distilled nothing) → record `no target-project spec essentials` in the pack's `## 规范要点` section + a WARN, and continue — never block the flow.
     - Every sub-agent dispatch instruction MUST NOT inline the spec essentials in full — it references the pack's `## 规范要点` section instead.
   - **需要调整 (adjust)** → present the artifacts for editing; after the user's edits, re-enter this gate (one question again).
3. Failed tasks follow the apply retry rules (serial retry once → pause and report). Implementation failures pause the flow; they never silently skip a task.

## Phase 4: Review sub-agent migration check + fix loop

1. **Dispatch an independent review sub-agent** (Agent tool) to cross-check source vs target functionality and generate the report. The dispatch instruction MUST inject ALL inputs explicitly: the confirmed core-feature list (exploration.md path), the source requirement document path, the target implementation scope, SOURCE_PROJECT, TARGET_PROJECT, both framework profiles, and the output directory `openspec/changes/<change-name>/attachments/migration-check/`. Inside the sub-agent: invoke the **venus_tr_impl_migration_check** skill (Skill tool) in **non-interactive mode** with those parameters (skill delegation — do NOT re-implement the compare logic inline), then layer a core-feature cross-check on top of the comparison result (feature coverage matrix + discrepancy notes) to produce the final review report. The review scope EXCLUDES user-trimmed features (never reported as missing-function P0/P1).

   **B组架构融入检查 (group-B architecture checks)**: The review sub-agent MUST also perform 3 architecture-consistency checks on top of the migration-checker result:
   - **C11 — 异常体系融入检查**: scan the target migration code for residual source-project error-handling constructs (e.g., source-specific exception classes, empty catch blocks swallowing errors). Residual source error-handling constructs are P0 issues.
   - **C12 — 工具类复用检查**: check whether the migration code re-implements utility or helper functionality that already exists in the target project (e.g., duplicating existing helper functions or utilities). Duplicates are P1 issues.
   - **C13 — 架构一致性检查**: verify that the migration code follows the target project's layering, package naming, and directory conventions. Architecture inconsistencies are P2 issues.

   The B组 findings MUST be merged into the same final review report as the migration-checker results, with the same P0/P1/P2 classification.
2. **Review-sub-agent failure degradation chain** (never silently skip the review): serial retry once → still failing, degrade to invoking venus_tr_impl_migration_check directly from the main flow (non-interactive, same injected parameters) → still failing, output WARN and end the flow as COMPLETE-WITH-WARNING.
3. Read the check report (P0/P1/P2 problem lists).
4. Fix loop:
    - **P0/P1 found** → present the problem list + fix suggestions → ask the user to confirm the fixes → apply fixes (update code AND sync the change tasks.md with new/updated tasks) → re-run the migration check (back to step 1 of this phase). Repeat until no P0/P1 remain.
    - **User stops the loop or the retry limit is reached** → output the current problem-list snapshot, log a WARN, and end the flow as COMPLETE-WITH-WARNING (not a failure).
    - **Only P2 found** → record the problems in the report and end the flow normally; P2 never blocks.
5. Final output: change name, implemented task summary, source requirement document path, migration check report path, remaining P2 problems (if any).

---

## Output

```
## Auto Migration Complete (or Complete with Warnings)

**Change**: <change-name>
**Source requirement doc**: openspec/changes/<change-name>/attachments/source-feature-doc/...
**Migration check report**: openspec/changes/<change-name>/attachments/migration-check/...
**Tasks**: N/M complete
**Remaining problems**: P0: 0 | P1: 0 | P2: <n> (recorded, non-blocking)

Ready for /venus:spec-archive (after review)
```

## Guardrails

- **Read-only passthrough**: file reading, CodeGraph queries, and analysis steps execute directly without confirmation; the confirmation points are the distill confirmation (Phase 1, requirement-clarification gate), the implementation gate (Phase 3), and fix confirmation (Phase 4).
- **Zero-guess**: any unconfirmed field/endpoint/rule from the source project is marked **[待确认]** and resolved with the user — never guessed into the proposal or the implementation.
- **Cross-platform**: build every path with `path.join()`; accept Windows drive-letter and POSIX inputs.
- **Skill delegation**: Phase 1 and Phase 4 MUST invoke the two sub-skills rather than re-implementing their scan/compare logic inline — in Phase 4 the invocation happens INSIDE the review sub-agent (or, on degradation, directly from the main flow).
- **Sub-skill trigger boundary**: do not let the sub-skill invocations fall back to interactive mode — always inject the non-interactive parameters explicitly.
- **Fix loop is user-gated**: every fix round needs user confirmation before applying; the loop ends on "no P0/P1", user stop, or retry limit — never silently.
- **产物路由规则 (migration artifact routing)**: all supplement documents generated during the migration flow MUST be placed under the change directory's `attachments/` subtree. Follow the apply's Supplement Document Handling rules: use type labels (`[DB脚本]`, `[配置示例]`, `[使用说明]`, etc.) in tasks and specify the output path via the `产出:` field. Default routing:
  - SQL scripts (DDL/DML) → `attachments/sql/`
  - Config examples → `attachments/config/`
  - Adversarial check reports → `attachments/migration-check/07_对抗检查/`
  - Other supplement documents → `attachments/`
  Build every path with `path.join()` (cross-platform).
