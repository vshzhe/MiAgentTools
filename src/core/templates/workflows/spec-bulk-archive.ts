/**
 * spec 类型技能模板：批量归档变更。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { deriveCommandContent } from '../derive-command.js';
import { CODEGRAPH_MCP, SUBAGENT_DISPATCH, skillDelegation } from '../tool-whitelist.js';

export function getSpecBulkArchiveSkillTemplate(): SkillTemplate {
    return {
        name: 'iagent_spec_bulk_archive',
        description: '批量归档变更。当用户要一次归档多个已完成变更时使用。',
        allowedTools: `Read, Write, Edit, Glob, Grep, Bash(iagent:*), ${CODEGRAPH_MCP}, ${skillDelegation(['requirement_doc'])}, ${SUBAGENT_DISPATCH}`,
        type: 'spec',
        instructions: `**适用 openspec/rules/ai-coding.md 全域护栏。** 未定义项标 **[待确认]**，禁止猜测。

Archive multiple completed changes in a single operation.

This skill allows you to batch-archive changes, handling spec conflicts intelligently by checking the codebase to determine what's actually implemented.

**Input**: None required (prompts for selection)

**Steps**

1. **Get active changes**

   Run \`iagent spec status --json\` (no \`--change\` parameter) to get all active changes. The output contains a \`changes\` array listing every active change.

   If no active changes exist, inform user and stop.

   **CLI availability detection (first-call failure signature)**: If the \`iagent spec status --json\` call (or the \`iagent spec status --change\` calls in step 3) fails with a command-not-found error signature (e.g., "command not found", "不是内部或外部命令", "not recognized"), conclude the iagent CLI is not installed. Tell the user in one line — "iagent CLI not found in PATH — continuing in CLI-degraded mode" — and continue in CLI-degraded mode (do NOT repeat this notice mid-flow):
   - **Degraded change discovery**: discover candidate changes by Glob-scanning \`openspec/changes/*/\` (excluding \`archive/\`); still let the user choose via the **AskUserQuestion tool**
   - **Degraded artifact status inference**: infer artifact completion from \`proposal.md\` / \`design.md\` / \`specs/**/*.md\` / \`tasks.md\` file existence — without CLI validation; the batch archive itself (directory moves, spec sync, index update) proceeds normally
   - Other errors (e.g., JSON parse failure): report the error and stop — do NOT enter degraded mode
   - At the end of the flow, remind the user exactly once: this run used CLI-degraded mode and installing the iagent CLI is recommended for validation and build-order guarantees

2. **Prompt for change selection**

   Use **AskUserQuestion tool** with multi-select to let user choose changes:
   - Show each change with its schema
   - Include an option for "All changes"
   - Allow any number of selections (1+ works, 2+ is the typical use case)

   **IMPORTANT**: Do NOT auto-select. Always let the user choose.

2.5 **Pre-Batch CodeGraph Status Check**

   Before batch validation, check whether CodeGraph is enabled for the project using status-first detection:

   1. **Run \`codegraph status\` (via Bash) as the single detection step** — do NOT pre-check \`.codegraph/\` directory existence with Glob (dot-prefixed directories return false negatives, causing CodeGraph to be wrongly treated as uninitialized)
   2. **If the call succeeds**: CodeGraph is initialized and the index is healthy — record the current index statistics (file/node count) reported by the call for later comparison and proceed with batch validation
   3. **If the call fails** (codegraph CLI not in PATH — command-not-found error signature — or any other error, including CodeGraph not initialized): automatically skip ALL CodeGraph steps for the entire batch (this 2.5 check and the step 11 sync), log a WARN noting the codegraph CLI is unavailable and batch sync was skipped, and proceed with batch archiving — do NOT ask the user whether to retry or continue

   **Note**: CodeGraph sync is project-scoped, not per-change. The batch runs a single sync after all changes are archived (step 11).

3. **Batch validation - gather status for all selected changes**

   For each selected change, collect:

   a. **Artifact status** - Run \`iagent spec status --change "<name>" --json\`
      - Parse \`schemaName\`, \`artifacts\`, \`planningHome\`, \`changeRoot\`, \`artifactPaths\`, and \`actionContext\`
      - Note which artifacts are \`done\` vs other states

      If any selected change reports \`actionContext.mode: "workspace-planning"\`, explain that workspace bulk archive is not supported in this slice and STOP before syncing specs or moving changes. Do not fall back to repo-local paths or edit linked repos.

   b. **Task completion** - Read \`artifactPaths.tasks.existingOutputPaths\` from status JSON
      - Count \`- [ ]\` (incomplete) vs \`- [x]\` (complete)
      - If no tasks file exists, note as "No tasks"

   c. **Delta specs** - Check \`artifactPaths.specs.existingOutputPaths\` from status JSON
      - List which capability specs exist
      - For each, extract requirement names (lines matching \`### Requirement: <name>\`)

   d. **Parallel validation dispatch (multi-change, read-only)**:
      - When 2+ changes are selected AND the runtime supports sub-agent dispatch: dispatch one read-only validation sub-agent per change (Task tool, at most 3 running at the same time) — each sub-agent collects items a-c for its assigned change; sub-agents ONLY read files and run status queries, NEVER write
      - Merge per-change results into the consolidated status table when all sub-agents return
      - Single-change batch or no sub-agent capability: gather status serially (existing behavior); if the environment cannot dispatch sub-agents, inform the user of the serial fallback
      - On a sub-agent failure: the main agent gathers that change's status serially (never blocks the batch)

4. **Detect spec conflicts**

   Build a map of \`capability -> [changes that touch it]\`:

   \`\`\`
   auth -> [change-a, change-b]  <- CONFLICT (2+ changes)
   api  -> [change-c]            <- OK (only 1 change)
   \`\`\`

   A conflict exists when 2+ selected changes have delta specs for the same capability.

5. **Resolve conflicts agentically**

   **For each conflict**, investigate the codebase:

   a. **Read the delta specs** from each conflicting change to understand what each claims to add/modify

   b. **Search the codebase** for implementation evidence:
      - Look for code implementing requirements from each delta spec
      - Check for related files, functions, or tests

   c. **Determine resolution**:
      - If only one change is actually implemented -> sync that one's specs
      - If both implemented -> apply in chronological order (older first, newer overwrites)
      - If neither implemented -> skip spec sync, warn user

   d. **Record resolution** for each conflict:
      - Which change's specs to apply
      - In what order (if both)
      - Rationale (what was found in codebase)

   **Parallel conflict investigation**: When 2+ independent conflicts are detected AND sub-agent dispatch is available, dispatch one read-only investigation sub-agent per conflict in parallel (each reads the conflicting delta specs and gathers codebase evidence, NEVER writes); the main agent merges all resolutions into the execution plan. On a sub-agent failure: the main agent investigates that conflict serially.

6. **Show consolidated status table**

   Display a table summarizing all changes:

   \`\`\`
   | Change              | Artifacts | Tasks | Specs   | Conflicts | Status |
   |---------------------|-----------|-------|---------|-----------|--------|
   | schema-management   | Done      | 5/5   | 2 delta | None      | Ready  |
   | project-config      | Done      | 3/3   | 1 delta | None      | Ready  |
   | add-oauth           | Done      | 4/4   | 1 delta | auth (!)  | Ready* |
   | add-verify-skill    | 1 left    | 2/5   | None    | None      | Warn   |
   \`\`\`

   For conflicts, show the resolution:
   \`\`\`
   * Conflict resolution:
     - auth spec: Will apply add-oauth then add-jwt (both implemented, chronological order)
   \`\`\`

   For incomplete changes, show warnings:
   \`\`\`
   Warnings:
   - add-verify-skill: 1 incomplete artifact, 3 incomplete tasks
   \`\`\`

7. **Proceed to batch execution**

   After displaying the consolidated status table, proceed directly to batch execution — do NOT prompt for batch confirmation (the multi-select in step 2 is the user's explicit scope decision).

   If there are incomplete changes, make clear in the status table that they will be archived with warnings (warnings are informational only, never a reason to skip a selected change).

8. **Execute archive for each selected change (three-phase layered parallelism)**

   **Execution grouping** — before dispatching, group the selected changes by the step 4 conflict detection results:
   - Changes with no shared capability form parallel groups — within a group, each change is executed by one sub-agent as a complete archive dispatch unit (the a → a.5 → a.6 → b → b.5 sequence below)
   - Changes sharing a capability form a serial chain executed in resolved (chronological) order
   - At most 3 archive sub-agents run at the same time (fixed limit, no configuration item)
   - Single selected change: execute directly without dispatch (equivalent to existing serial behavior)
   - All changes share one capability: the grouping produces a single serial chain — execute serially (existing behavior)
   - No sub-agent capability in the runtime: fall back to serial execution of all changes and inform the user of the fallback
   - Sub-agents MUST NOT update ARCHIVE-INDEX.md and MUST NOT run \`codegraph sync\` — both remain main-agent single-point operations (step 10 and step 11)
   - **Failure isolation**: when a change fails (including sub-agent failure or timeout), log a WARN and CONTINUE with the remaining changes — never abort the batch; when the failed change is the predecessor of a same-capability serial chain, the subsequent change still executes (each change merges into main specs independently)
   - The sub-agent dispatch instruction MUST embed the full archive checkpoint text below (same source as the main agent serial version)

   Each archive dispatch unit executes the following sequence for its change (serially, in task order):

   a. **Sync specs** if delta specs exist (inline AI merge, no separate skill invocation):
      - **Markdown source**: Read each delta spec at \`<changeRoot>/specs/<capability>/spec.md\` and apply its operations directly to the main spec at \`openspec/specs/<capability>/spec.md\`. Classify operations by \`## ADDED/MODIFIED/REMOVED/RENAMED Requirements\`; do NOT read a JSON mirror.
      - **Legacy JSON fallback (WARN)**: If delta spec Markdown is missing and only historical \`change.json\` exists, log a WARN ("delta spec Markdown missing — falling back to legacy JSON specs section") and read its \`specs\` section read-only; otherwise proceed without sync. The primary Markdown path compares each delta spec with the main spec at \`openspec/specs/<capability>/spec.md\`, classifying operations by kind:
        - **ADDED**: new requirements/scenarios present in delta but not in main spec
        - **MODIFIED**: requirement or scenario text/details changed in delta
        - **REMOVED**: requirements/scenarios deleted in delta
        - **RENAMED**: requirement identifiers renamed in delta
      - If neither source yields delta specs: proceed without sync
      - Show a combined summary of what will be applied (counts per ADDED/MODIFIED/REMOVED/RENAMED)
      - Execute the AI merge directly (do NOT prompt for sync options)
      - **Inline AI merge procedure**: for each capability, apply the operations directly to the main \`openspec/specs/<capability>/spec.md\`:
        - ADDED → append the new requirement (description + scenarios) in the correct section of the main spec
        - MODIFIED → replace the corresponding requirement/scenario in place within the main spec
        - REMOVED → remove the corresponding requirement from the main spec (the \`reason\` / \`migration\` values may be quoted in the archive summary)
        - RENAMED → update the requirement identifier and any cross-references within the main spec
      - Follow v1.1.20 specs-apply merge semantics for conflict resolution and section placement
      - For conflicts, apply in resolved order (step 5 resolution)
      - Log: "Delta specs merged — <N> operations applied (A added / M modified / R removed / N renamed)" (append \`[source: delta spec Markdown]\` or \`[source: legacy JSON fallback]\` for traceability)
      - Track if sync was done

   a.5 **CONTEXT.md Sync (MANDATORY CHECKPOINT, pre-archive)**:
      - **Check if \`openspec/CONTEXT.md\` exists** using Glob or Read tool
      - **If EXISTS**: Read CONTEXT.md and scan change artifacts for terms that should be recorded
        - Read \`proposal.md\` for key domain terms（历史 JSON-only 降级时只读 change.json）
        - Read \`design.md\` for technical terms and decisions（历史 JSON-only 降级时只读 change.json）
        - Cross-reference with CONTEXT.md — if any terms are missing, auto-supplement
        - Log: "CONTEXT.md synced — <N> terms added"
      - **If NOT EXISTS**: Create \`openspec/CONTEXT.md\` from change artifacts
        - Extract domain terms from \`proposal.md\` Why
        - Extract technical terms from \`design.md\` Decisions
        - Format: \`**<Term>**: <definition>\\\\n_Avoid_: <synonyms>\`
        - Log: "CONTEXT.md created — <N> terms from change artifacts"
      - **Compatibility check**: If the change has neither Markdown artifacts nor legacy JSON, skip and log:
        "Skipping CONTEXT.md sync: no change artifacts found"
      - **Failure handling (non-blocking)**: Do NOT block archive on check failure — log and proceed

   a.6 **Pre-archive requirement document generation (MANDATORY CHECKPOINT, before the directory move)**:
      - **Decision scope**: ONLY \`openspec/changes/<change-name>/需求文档.md\` (use \`path.join()\`)
      - **If the change directory is not readable** (IO error): log a WARN and treat the document as absent — proceed to the not-exists branch
      - **Not exists** → invoke the \`iagent_requirement_doc\` skill (Skill tool) in **non-interactive mode** with this change name (no questions, placeholder basic information); output to \`openspec/changes/<change-name>/需求文档.md\`
      - **Already exists** → perform an **in-place incremental alignment update**: \`## 基本信息\` and \`## 八、评审记录\` are the **人工域** and MUST NOT be overwritten (preserve verbatim, including placeholder states); sections \`一~七\` SHALL be re-derived from the CURRENT Markdown sources — \`proposal.md\` / \`design.md\` / \`specs/**/*.md\` / \`tasks.md\`. **Do NOT invoke \`iagent_requirement_doc\`** in this branch — its own rule is "when the target file already exists, overwrite it silently", which would erase human-authored review content. The alignment MUST NOT delete sections (only content removed from the artifacts may be dropped); if the document is structurally broken, rebuild the missing sections and log a WARN
      - **Failure handling (non-blocking)**: if generation or alignment fails, log a WARN with the target path and the reason and CONTINUE with this change's remaining steps — a failure here MUST NOT abort the change unit and MUST NOT abort the batch
      - The generated document stays in the change directory, moves with it in step b, and is migrated to \`openspec/devdocs/\` by step c

   b. **Perform the archive**:
      Run the iagent CLI archive command — it performs the state check and directory move in one step:
      \`\`\`bash
      iagent spec archive "<name>" --yes
      \`\`\`
      This creates the \`archive\` directory under \`openspec/changes/\` if it does not exist, generates the dated target name \`YYYY-MM-DD-<change-name>\`, and moves \`changeRoot\` to \`openspec/changes/archive/YYYY-MM-DD-<name>/\`. Preserve \`.openspec.yaml\` and \`attachments/\` subdirectory — they move with the change directory automatically.

      **If the command fails because the target archive directory already exists**: mark this change as Failed and continue with the remaining changes in the batch (failure isolation). Do NOT overwrite.

   b.5 **Exploration memory sync + requirement document migration** (both read from the archived directory after the CLI archive move):
      - **Exploration memory sync** (extraction copies, not moves):
        - Check whether \`openspec/changes/archive/YYYY-MM-DD-<name>/exploration.md\` exists (the CLI has already moved the change directory; read from the archive location)
        - If missing: log "Skipping exploration memory sync: no exploration file" for this change and continue
        - Enumerate capabilities from the \`specs/<capability>/\` subdirectories（历史 JSON-only 降级时只读 change.json specs 段）
        - If the change has no delta specs: log "Skipping exploration memory sync: no delta specs" and continue
        - For each involved capability \`<capability>\`:
          - Target file: \`openspec/specs/<capability>/explorations.md\` (use \`path.join()\`)
          - Create the file with a purpose header if it does not exist
          - Extract key memories (Decisions, 术语表, 边界场景, Codebase Findings 要点 — NOT process-oriented content)
          - Append a \`## <change-name>（归档日期 YYYY-MM-DD）\` section
          - If new decisions contradict an earlier section: mark the outdated section with \`> 已过时（由 <change-name> 取代）\` instead of deleting
        - On sync failure for one change: log a WARN and CONTINUE with the remaining changes (never abort the batch)
      - **Requirement document migration** (same rule as single-change archive):
        - Check whether \`openspec/changes/archive/YYYY-MM-DD-<name>/需求文档.md\` exists in the archived directory
        - If it exists: move it to \`openspec/devdocs/YYYY-MM-DD-<change-name>-需求文档.md\`
          - The \`YYYY-MM-DD\` prefix comes from that change's own archive directory name (consistent with the archive command's directory naming logic)
          - If the archive directory name has no parseable \`YYYY-MM-DD-\` prefix, fall back to \`openspec/devdocs/<change-name>-需求文档.md\` without a timestamp
          - Create the devdocs directory if it does not exist (use \`path.join()\`); overwrite the target if it already exists
        - If it does not exist: skip for this change without an additional warning — a.6 has already logged a WARN when generation failed, so there is nothing left to report here; continue with the batch
        - A document move failure must never abort the batch: log a WARN and continue with the remaining changes

   c. **Track outcome** for each change:
      - Success: archived successfully
      - Failed: error during archive (record error)
      - Skipped: user chose not to archive (if applicable)

9. **Display summary**

   The main agent collects all archive sub-agent results and displays the final summary (including parallel execution stats: number of parallel groups / serial chains):

   Show final results:

   \`\`\`
   ## Bulk Archive Complete

   Archived 3 changes:
   - schema-management-cli -> archive/2026-01-19-schema-management-cli/
   - project-config -> archive/2026-01-19-project-config/
   - add-oauth -> archive/2026-01-19-add-oauth/

   Skipped 1 change:
   - add-verify-skill (user chose not to archive incomplete)

   Spec sync summary:
   - 4 delta specs synced to main specs
   - 1 conflict resolved (auth: applied both in chronological order)

   Exploration memory summary:
   - 3 changes synced to capability memory files
   - 1 skipped (no exploration file)

   Parallel execution:
   - 2 parallel groups, 1 serial chain
   \`\`\`

   If any failures:
   \`\`\`
   Failed 1 change:
   - some-change: Archive directory already exists
   \`\`\`

10. **Batch Index Update**

   **IMPORTANT**: Skip this step for workspace-scoped changes (actionContext.mode: "workspace-planning").

   The archive index file is located at \`openspec/changes/archive/ARCHIVE-INDEX.md\`.

   After all archive operations complete (success/failed/skipped determined), the main agent performs this single-point update — never a sub-agent:

   a. **Check index file existence**:
      - If file does not exist, create it with standard structure

   b. **Create new index file** (if not exists):
      \`\`\`markdown
      # OpenSpec 变更归档索引

      > 本文档记录所有已归档的变更提案，便于历史追溯和查阅

      ---

      ## 归档变更列表

      | 归档日期 | 变更名称 | 所属模块 | 主要内容 |
      |----------|----------|----------|----------|

      ---

      ## 模块统计

      | 模块 | 归档数量 | 变更列表 |
      |------|----------|----------|

      ---

      *更新时间: YYYY-MM-DD*
      \`\`\`

   c. **Append entries for successfully archived changes**:
      - For each successfully archived change, extract entry information:
        - **Archive date**: from directory name prefix \`YYYY-MM-DD-{change-name}\`
        - **Change name**: from directory name (after date prefix)
        - **Module**: extract from change name pattern \`{prefix}-{module}-{feature}\`, use "general" if not matched
        - **Summary**: first paragraph of \`proposal.md\` Why（历史 JSON-only 降级时只读 change.json；max 50 chars）
        - **Supplement annotation**: read \`tasks.md\` in the archived change directory（历史 JSON-only 降级时只读 tasks.json）, collect **supplement task types by matching a fixed label whitelist** \`[测试]\` / \`[DB脚本]\` / \`[使用说明]\` (\`[代码]\` excluded), and append \`[含<type1>/<type2>/...]\` to the summary (e.g., \`[含测试/DB脚本]\`). Match on the whitelist ONLY — do NOT collect "all bracketed content": \`[测试]\` tasks carry level/priority sub-annotations (\`[测试][单元][P0]\`) whose \`[单元]\`/\`[P0]\` are NOT task types, and collecting them would produce \`[含测试/单元/P0]\` noise. Labels outside the whitelist are ignored (non-blocking; a WARN MAY be logged). If no supplement task found, skip annotation.

   d. **Add rows to "归档变更列表" table**:
      \`| {date} | {change-name} | {module} | {summary} |\`

   e. **Update "模块统计" table**:
      - Increment count for existing modules
      - Add new row for new modules (count: 1)
      - Append change name to module's change list

   f. **Update footer timestamp** to current date \`YYYY-MM-DD\`

   g. **Index recovery for corrupted file**:
      - If ARCHIVE-INDEX.md exists but structure is corrupted, attempt to parse existing entries
      - If parsing fails completely, recreate file with proper structure
      - Include all successfully archived changes from current batch

   h. **Skip failed and skipped changes**:
      - Do not add entries for failed or skipped changes to the index
      - Display separate summary for failed/skipped changes

   **Cross-platform note**: Use \`path.join()\` for path construction on Windows. Handle case sensitivity differences when checking for existing files.

11. **Batch CodeGraph Sync + Verification (conditional)**

   **Only execute if step 2.5 confirmed CodeGraph is enabled AND at least one change was successfully archived.** If step 2.5 skipped (CodeGraph not initialized), skip this step entirely. Runs AFTER step 10 (Batch Index Update) so all archiving is finalized first. Executed by the main agent only — never inside archive sub-agents (the single project-wide sync keeps the knowledge graph DB free of concurrent writes).

   1. **Single project-wide sync** (NOT per-change — CodeGraph sync is project-scoped):
      - Run \`codegraph sync\` exactly ONCE (via Bash) to incrementally index all newly implemented code from the archived changes
      - Display "CodeGraph: syncing implemented code for N archived changes..." before running
      - Log the sync result after completion

   2. **Single verification** after sync completes successfully:
      - Use MCP \`codegraph_search\` once, querying key terms from the successfully archived changes (change names + key symbols from each change's \`tasks.md\` and \`design.md\`)
      - Display "CodeGraph: ✓ symbols verified in index" with matched count
      - Warn if no matches found (may be expected for non-code changes)
      - Verification queries ONLY successfully archived changes (not failed/skipped)

   3. **Failure handling** (non-blocking):
      - If batch \`codegraph sync\` fails (CLI error, timeout, or CLI not in PATH): log warning, do NOT block the batch archive
      - Still proceed to display the bulk archive summary (step 9) and batch index update (step 10) — sync runs after these
      - Partial batch success (some changes failed/skipped) still triggers sync if ≥1 change archived

12. **Batch SQLite Reindex (auto, after CodeGraph sync)**

   After step 11 (CodeGraph sync), auto-run SQLite index rebuild:
   - **MUST run**: \`iagent spec reindex --force\` (via Bash) — rebuilds full index from all archived changes
   - On success: log "SQLite index rebuilt — N changes indexed"
   - On failure (sqlite3 CLI unavailable): log WARN and continue (non-blocking)
   - Only execute if ≥1 change was successfully archived

**Conflict Resolution Examples**

Example 1: Only one implemented
\`\`\`
Conflict: specs/auth/spec.md touched by [add-oauth, add-jwt]

Checking add-oauth:
- Delta adds "OAuth Provider Integration" requirement
- Searching codebase... found src/auth/oauth.ts implementing OAuth flow

Checking add-jwt:
- Delta adds "JWT Token Handling" requirement
- Searching codebase... no JWT implementation found

Resolution: Only add-oauth is implemented. Will sync add-oauth specs only.
\`\`\`

Example 2: Both implemented
\`\`\`
Conflict: specs/api/spec.md touched by [add-rest-api, add-graphql]

Checking add-rest-api (created 2026-01-10):
- Delta adds "REST Endpoints" requirement
- Searching codebase... found src/api/rest.ts

Checking add-graphql (created 2026-01-15):
- Delta adds "GraphQL Schema" requirement
- Searching codebase... found src/api/graphql.ts

Resolution: Both implemented. Will apply add-rest-api specs first,
then add-graphql specs (chronological order, newer takes precedence).
\`\`\`

**Output On Success**

\`\`\`
## Bulk Archive Complete

Archived N changes:
- <change-1> -> archive/YYYY-MM-DD-<change-1>/
- <change-2> -> archive/YYYY-MM-DD-<change-2>/

Spec sync summary:
- N delta specs synced to main specs
- No conflicts (or: M conflicts resolved)
Exploration memory: X synced / Y skipped (no exploration file or no delta specs) / Z failed (warning logged)
CodeGraph: ✓ Synced (or "Not initialized — skipped" or "Sync skipped due to error")
\`\`\`

**Output On Partial Success**

\`\`\`
## Bulk Archive Complete (partial)

Archived N changes:
- <change-1> -> archive/YYYY-MM-DD-<change-1>/

Skipped M changes:
- <change-2> (user chose not to archive incomplete)

Failed K changes:
- <change-3>: Archive directory already exists
\`\`\`

**Output When No Changes**

\`\`\`
## No Changes to Archive

No active changes found. Create a new change to get started.
\`\`\`

**Guardrails**
- Allow any number of changes (1+ is fine, 2+ is the typical use case)
- Always prompt for selection, never auto-select
- Detect spec conflicts early and resolve by checking codebase
- When both changes are implemented, apply specs in chronological order
- Skip spec sync only when implementation is missing (warn user)
- Show clear per-change status before executing
- Track and report all outcomes (success/skip/fail)
- Sync exploration memory per change (step b.5); a failure in one change logs a warning and never aborts the batch
- Sync CONTEXT.md per change (step a.5); missing artifacts skip with log, never block the batch
- Generate the requirement document per change (step a.6, before the directory move) from the FINAL artifacts: not exists → delegate iagent_requirement_doc non-interactively; already exists → in-place alignment preserving the 人工域 (## 基本信息 / ## 八、评审记录) and never calling the skill in that branch; a failure logs a warning and never aborts the change unit or the batch
- Preserve .openspec.yaml when moving to archive (CLI guarantees this)
- Archive directory target uses current date: YYYY-MM-DD-<name>
- If archive target exists, fail that change but continue with others
- Update ARCHIVE-INDEX.md after all archives complete (step 10)
- Only record successfully archived changes in index
- Skip workspace-scoped changes from index update`,
        license: 'MIT',
        compatibility: '依赖 iagent CLI（spec 命令组）与 CodeGraph CLI（可选）。',
        metadata: { author: 'mi-agent-tools' },
    };
}

export function getSpecBulkArchiveCommandTemplate(): CommandTemplate {
    return {
        name: 'iAgent: 批量归档',
        description: '批量归档变更 —— 单次操作批量归档多个已完成变更（含冲突智能解决与并行执行）',
        category: 'iAgent / 规格',
        tags: ['iagent', 'spec', 'archive', 'bulk'],
        content: deriveCommandContent(getSpecBulkArchiveSkillTemplate().instructions),
    };
}
