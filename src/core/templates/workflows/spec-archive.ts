/**
 * spec 类型技能模板：归档变更。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { deriveCommandContent } from '../derive-command.js';
import { CODEGRAPH_MCP, skillDelegation } from '../tool-whitelist.js';

export function getSpecArchiveChangeSkillTemplate(): SkillTemplate {
    return {
        name: 'venus_spec_archive',
        description: '归档变更。当用户要归档已实现完成的变更、结束变更工作流时使用。',
        allowedTools: `Read, Write, Edit, Glob, Grep, Bash(venus:*), Bash(codegraph:*), Bash(ls:*), ${CODEGRAPH_MCP}, ${skillDelegation(['tr_docs_requirement_doc'])}`,
        type: 'spec',
        instructions: `**Before proceeding, read openspec/rules/ai-coding.md for AI coding guardrails.**

Archive a completed change in the change workflow.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes. The workflow may also pass a change name directly for automated execution.

**Steps**

1. **If no change name provided, prompt for selection**

   If a change name was already provided (from workflow auto-archive context), skip the selection prompt and proceed directly to Step 2 (artifact completion check).

   Otherwise, run \`venus spec status --json\` to get available changes. Use the **AskUserQuestion tool** to let the user select.

   Show only active changes (not already archived).
   Include the schema used for each change if available.

   **IMPORTANT**: Do NOT guess or auto-select a change. Only skip selection when a change name was explicitly provided from the workflow context.

2. **Check artifact completion status**

   Run \`venus spec status --change "<name>" --json\` to check artifact completion.

   Parse the JSON to understand:
   - \`schemaName\`: The workflow being used
   - \`planningHome\`, \`changeRoot\`, \`artifactPaths\`, and \`actionContext\`: path and scope context
   - \`artifacts\`: List of artifacts with their status (\`done\` or other)

   If status reports \`actionContext.mode: "workspace-planning"\`, explain that workspace archive is not supported in this slice and STOP. Do not move workspace changes into repo-local archives or edit linked repos.

   **If any artifacts are not \`done\`:**
   - Display warning listing incomplete artifacts
   - Proceed with archiving directly — do NOT prompt for confirmation (warning is informational only)

3. **Check task completion status**

   Read the tasks file (typically \`tasks.md\`) to check for incomplete tasks.

   Count tasks marked with \`- [ ]\` (incomplete) vs \`- [x]\` (complete).

   **If incomplete tasks found:**
   - Display warning showing count of incomplete tasks
   - Proceed with archiving directly — do NOT prompt for confirmation (warning is informational only)

   **If no tasks file exists:** Proceed without task-related warning.

4. **Assess delta spec sync state and execute AI merge**

   Use \`artifactPaths.specs.existingOutputPaths\` from status JSON to check for delta specs. If none exist, proceed without sync.

   **If delta specs exist:**
   - Compare each delta spec with its corresponding main spec at \`openspec/specs/<capability>/spec.md\`
   - Classify the changes by operation kind:
     - **ADDED**: new requirements/scenarios present in delta but not in main spec
     - **MODIFIED**: requirement or scenario text/details changed in delta
     - **REMOVED**: requirements/scenarios deleted in delta
     - **RENAMED**: requirement identifiers renamed in delta
   - Show a combined summary of what will be applied (ADDED/MODIFIED/REMOVED/RENAMED)
   - Execute the AI merge directly — do NOT prompt for sync options ("Sync now" is the default behavior)
   - **Inline AI merge procedure** (no separate skill invocation): for each delta spec, apply the classified operations directly to the main \`openspec/specs/<capability>/spec.md\`:
     - ADDED → append the new requirements/scenarios in the correct section of the main spec
     - MODIFIED → replace the corresponding requirement/scenario text in place within the main spec
     - REMOVED → remove the corresponding requirement/scenario from the main spec
     - RENAMED → update the identifier and any cross-references within the main spec
   - Follow v1.1.20 specs-apply merge semantics for conflict resolution and section placement
   - Log: "Delta specs merged — <N> operations applied (A added / M modified / R removed / N renamed)"

   **If already synced**: skip the sync and proceed with archiving.

   **If sync fails**: log a warning and proceed with archiving (non-blocking).

4.5 **Pre-Archive CONTEXT.md Sync (MANDATORY CHECKPOINT)**

   **⚠️ MANDATORY: CONTEXT.md check before archiving**

   Before archiving, system MUST validate CONTEXT.md contains all change-related terms:

   1. **Check if \`openspec/CONTEXT.md\` exists** using Glob or Read tool

   2. **If EXISTS**: Read CONTEXT.md and scan change directory for terms that should be recorded
      - Read \`proposal.md\` for key domain terms
      - Read \`design.md\` for technical terms and decisions
      - Cross-reference with CONTEXT.md — if any terms are missing, auto-supplement
      - Log: "CONTEXT.md synced — <N> terms added"

   3. **If NOT EXISTS**: Create \`openspec/CONTEXT.md\` with key terms from the change
      - Extract domain terms from \`proposal.md\` Why section
      - Extract technical terms from \`design.md\` Decisions section
      - Format: \`**<Term>**: <definition>\\n_Avoid_: <synonyms>\`
      - Log: "CONTEXT.md created — <N> terms from change artifacts"

   4. **Compatibility check**: If no change artifacts exist (proposal.md or design.md missing), skip and log:
      "Skipping CONTEXT.md sync: no change artifacts found"

   **Checkpoint Enforcement**:
   - System MUST execute CONTEXT.md check before performing archive
   - If CONTEXT.md is missing, auto-create from change artifacts
   - Do NOT block archive on check failure — log and proceed

4.6 **Pre-Archive CodeGraph Status Check (MANDATORY CHECKPOINT)**

   **⚠️ MANDATORY: CodeGraph status check before archiving**

   Before archiving, check whether CodeGraph is enabled for the project using status-first detection:

   1. **Run \`codegraph status\` (via Bash) as the single detection step** — do NOT pre-check \`.codegraph/\` directory existence with Glob (dot-prefixed directories return false negatives, causing CodeGraph to be wrongly treated as uninitialized)
   2. **If the call succeeds**: CodeGraph is initialized and the index is healthy — record the current index statistics (file/node count) reported by the call and proceed to archiving
   3. **If the call fails** (codegraph CLI not in PATH — command-not-found error signature — or any other error, including CodeGraph not initialized): automatically skip ALL CodeGraph steps (this 4.6 check and the 6.5 sync), log a WARN noting the codegraph CLI is unavailable and sync was skipped, and proceed with archiving — do NOT ask the user whether to retry or continue

   **Checkpoint Enforcement**:
   - System MUST execute CodeGraph status check before performing archive
   - If CodeGraph is not initialized, skip ALL CodeGraph steps (this 4.6 check + the 6.5 sync)
   - If the codegraph CLI is unavailable or the status check fails, skip ALL CodeGraph steps automatically with a WARN — never prompt the user
   - Do NOT block archive on check failure — log and proceed
   - Consistent with step 4.5 CONTEXT.md checkpoint philosophy

4.7 **Pre-Archive Exploration Memory Sync (MANDATORY CHECKPOINT)**

   **⚠️ MANDATORY: Sync exploration memory to capability specs before archiving**

   Executes after delta spec sync assessment, BEFORE moving the change directory to archive:

   1. **Check for exploration file** in the change directory (\`exploration.md\`)
      - If missing: log "Skipping exploration memory sync: no exploration file" and skip this checkpoint

   2. **Determine capability ownership**
      - Enumerate capabilities from the change's delta specs (\`specs/<capability>/spec.md\` subdirectories of the change directory)
      - If the change has no delta specs: capability ownership cannot be determined — log "Skipping exploration memory sync: no delta specs" and skip

   3. **For each involved capability \`<capability>\`**:
      - Target file: \`openspec/specs/<capability>/explorations.md\` (use \`path.join()\`)
      - If the file does not exist: create it with a short header explaining it holds cumulative exploration memory for this capability
      - Extract key memories from the change's exploration.md: Decisions, 术语表, 边界场景, Codebase Findings 要点 — do NOT copy process-oriented content (per-question Q&A, Decision Process)
      - Append a new section \`## <change-name>（归档日期 YYYY-MM-DD）\` with the extracted memories
      - If new decisions contradict an earlier change's decisions in the same file: mark the outdated section with \`> 已过时（由 <change-name> 取代）\` — do NOT delete historical content

   4. **Failure handling (non-blocking)**:
      - If memory sync fails (e.g., target directory not writable): log a warning, do NOT block the archive

   **Checkpoint Enforcement**:
   - System MUST execute exploration memory sync before moving the change directory
   - The change's exploration.md still moves to the archive directory with the change (extraction copies, not moves)
   - Do NOT block archive on sync failure — log and proceed

4.8 **Pre-Archive Requirement Document Generation (MANDATORY CHECKPOINT)**

   **⚠️ MANDATORY: generate the requirement document from the FINAL artifacts BEFORE the archive move**

   Executes after the exploration memory sync (4.7) and BEFORE moving the change directory (5). Rationale: the document is a review artifact derived from the change's artifacts; generating it at proposal-verification time (the previous behavior) froze a document that the implementation phase immediately invalidated.

   **Decision scope**: ONLY \`openspec/changes/<change-name>/需求文档.md\` (build with \`path.join()\`).

   1. **If the change directory is not readable** (IO error): log a WARN and treat the document as absent — proceed to branch 2
   2. **Branch A — the document does NOT exist**: invoke the \`venus_tr_docs_requirement_doc\` skill (Skill tool) in **non-interactive mode** with the change name — no questions to the user, placeholder basic information; the document is written to \`openspec/changes/<change-name>/需求文档.md\`
   3. **Branch B — the document ALREADY exists** (e.g. generated by a standalone run and then completed by hand): perform an **in-place incremental alignment update** on that file. \`## 基本信息\` (需求编号 / 需求名称 / 交付时间, including placeholder states) and \`## 八、评审记录\` are the **人工域** and MUST NOT be overwritten — preserve them verbatim; sections \`一~七\` SHALL be re-derived from the CURRENT artifacts. **Do NOT invoke \`venus_tr_docs_requirement_doc\`** in this branch — its own rule is "when the target file already exists, overwrite it silently", which would erase human-authored review content. The alignment MUST NOT delete sections (only content removed from the artifacts may be dropped); if the document is structurally broken, rebuild the missing sections and log a WARN
   4. **Failure handling (non-blocking)**: if generation or alignment fails, log a WARN with the target path and the reason, then CONTINUE the archive — never block the archive on this checkpoint

   **Checkpoint Enforcement**:
   - System MUST execute the requirement document checkpoint before moving the change directory
   - The generated document stays in the change directory and moves with it; the existing step 6 then migrates it to \`openspec/devdocs/\`
   - Do NOT block archive on generation or alignment failure — log and proceed

5. **Perform the archive**

   Run the venus CLI archive command — it performs the state check and directory move in one step:
   \`\`\`bash
   venus spec archive "<name>" --yes
   \`\`\`

   This creates the \`archive\` directory under \`openspec/changes/\` if it does not exist, generates the dated target name \`YYYY-MM-DD-<change-name>\`, and moves \`changeRoot\` to \`openspec/changes/archive/YYYY-MM-DD-<name>/\`.

   **If the command fails because the target archive directory already exists**: report the error and suggest renaming the existing archive, deleting it if it is a duplicate, or waiting until a different date. Do NOT overwrite.

   Preserve \`.openspec.yaml\` and \`attachments/\` subdirectory — they move with the change directory automatically.

6. **Move requirement document to devdocs (if present)**

   After the change directory has been moved into the archive, check whether the archived change contains a generated requirement document:

   \`\`\`bash
   ls "openspec/changes/archive/YYYY-MM-DD-<name>/需求文档.md"
   \`\`\`

   - **If the file exists**: move it to \`openspec/devdocs/YYYY-MM-DD-<change-name>-需求文档.md\`
     - The \`YYYY-MM-DD\` prefix comes from the same archive directory name (consistent with the archive command's directory naming logic)
     - If the archive directory name has no parseable \`YYYY-MM-DD-\` prefix, fall back to \`openspec/devdocs/<change-name>-需求文档.md\` without a timestamp
     - Create the devdocs directory if it does not exist (use \`path.join()\`); overwrite the target if it already exists
   - **If the file does not exist**: skip this step silently — no error, no warning, continue with the archive process

6.5 **Post-Archive CodeGraph Sync + Verification (conditional)**

   **Only execute if step 4.6 confirmed CodeGraph is enabled.** If step 4.6 skipped (CodeGraph not initialized), skip this step entirely.

   1. **Sync the CodeGraph knowledge graph** with the just-archived change's implemented code:
      - Run \`codegraph sync\` (via Bash) to incrementally index the newly implemented code
      - Display "CodeGraph: syncing implemented code..." before running
      - Log the sync result after completion

   2. **Verify consistency** after sync completes successfully:
      - Use MCP \`codegraph_search\` to query the change name plus key symbols mentioned in the change's \`tasks.md\` and \`design.md\`
      - Confirm the implemented symbols are now indexed
      - Display "CodeGraph: ✓ N symbols verified in index" or warn if no matches
      - If no symbols found (e.g., config-only or doc-only change), log warning — do NOT treat as failure

   3. **Failure handling** (non-blocking):
      - If \`codegraph sync\` fails (CLI error, timeout, or CLI not in PATH): log warning, do NOT block archive
      - If verification query fails or returns no matches: log warning, do NOT block archive
      - CodeGraph sync runs independent of \`--skip-specs\` / \`--no-validate\` / validation skip choices

7. **Update or create ARCHIVE-INDEX.md**

   **IMPORTANT**: Skip this step for workspace-scoped changes (actionContext.mode: "workspace-planning").

   The archive index file is located at \`openspec/changes/archive/ARCHIVE-INDEX.md\`.

   **If file does not exist, create it**:
<!-- CMD:SKIP -->
   \`\`\`markdown
   # OpenSpec 变更归档索引

   > 本文档记录所有已归档的变更提案，便于历史追溯和查阅

   ---

   ## 归档变更列表

   | 归档日期 | 变更名称 | 所属模块 | 主要内容 |
   |----------|----------|----------|----------|
   | YYYY-MM-DD | change-name | module | description |

   ---

   ## 模块统计

   | 模块 | 归档数量 | 变更列表 |
   |------|----------|----------|

   ---

   *更新时间: YYYY-MM-DD*
   \`\`\`
<!-- /CMD:SKIP -->

   **If file exists, append new entry**:
<!-- CMD:SKIP -->

   a. Extract entry information:
      - **Archive date**: from archive directory name \`YYYY-MM-DD-{change-name}\`
      - **Change name**: from directory name (after date prefix)
      - **Module**: extract from change name pattern \`{prefix}-{module}-{feature}\`, or use "general" if unknown
      - **Summary**: first paragraph of \`proposal.md\` (max 50 chars), or proposal title if empty
      - **Supplement annotation**: read \`tasks.md\` in the change directory, collect **supplement task types by matching a fixed label whitelist** \`[测试]\` / \`[DB脚本]\` / \`[使用说明]\` (\`[代码]\` excluded), and append \`[含<type1>/<type2>/...]\` to the summary (e.g., \`[含测试/DB脚本]\`). Match on the whitelist ONLY — do NOT collect "all bracketed content": \`[测试]\` tasks carry level/priority sub-annotations (\`[测试][单元][P0]\`) whose \`[单元]\`/\`[P0]\` are NOT task types, and collecting them would produce \`[含测试/单元/P0]\` noise. Labels outside the whitelist are ignored (non-blocking; a WARN MAY be logged). If no supplement task found, skip annotation.

   b. Add new row to "归档变更列表" table:
      \`| {date} | {change-name} | {module} | {summary} |\`

   c. Update "模块统计" table:
      - Increment count for existing module
      - Add new row for new module (count: 1)

   d. Update footer timestamp to current date
<!-- /CMD:SKIP -->

   **Cross-platform note**: Use \`path.join()\` for path construction on Windows. Handle case sensitivity differences when checking for existing files.

8. **Display summary**

   Show archive completion summary including:
   - Change name
   - Schema that was used
   - Archive location
   - Whether specs were synced (if applicable)
   - Archive index updated status
   - CodeGraph sync status (synced / skipped — not initialized or error)
   - Exploration memory sync status (synced / skipped — no exploration file or no delta specs / failed — warning logged)
   - Requirement document status (generated / aligned in place / failed — warning logged with reason)
   - Note about any warnings (incomplete artifacts/tasks)

**Output On Success**

\`\`\`
## Archive Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** openspec/changes/archive/YYYY-MM-DD-<name>/
**Specs:** ✓ Synced to main specs (or "No delta specs" or "Sync failed — warning logged" or "主规格未同步（skip_specs 声明）")
**Archive Index:** ✓ Updated ARCHIVE-INDEX.md
**Exploration Memory:** ✓ Synced to specs/<capability>/explorations.md (or "Skipped — no exploration file" or "Skipped — no delta specs" or "Failed — warning logged")
**Requirement Document:** ✓ Generated → openspec/devdocs/YYYY-MM-DD-<name>-需求文档.md (or "✓ Aligned in place (人工域 preserved)" or "Failed — warning logged: <reason>")
**CodeGraph:** ✓ Synced (or "Not initialized — skipped" or "Sync skipped due to error")

All artifacts complete. All tasks complete.
\`\`\`

<!-- CMD:SKIP -->
**Output On Success With Warnings**

\`\`\`
## Archive Complete (with warnings)

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** openspec/changes/archive/YYYY-MM-DD-<name>/
**Specs:** ✓ Synced to main specs

**Warnings:**
- Archived with 2 incomplete artifacts
- Archived with 3 incomplete tasks

Review the archive if this was not intentional.
\`\`\`

**Output On Error (Archive Exists)**

\`\`\`
## Archive Failed

**Change:** <change-name>
**Target:** openspec/changes/archive/YYYY-MM-DD-<name>/

Target archive directory already exists.

**Options:**
1. Rename the existing archive
2. Delete the existing archive if it's a duplicate
3. Wait until a different date to archive
\`\`\`
<!-- /CMD:SKIP -->

**Guardrails**
- Always prompt for change selection if not provided (unless change name was explicitly passed from workflow context)
- Use artifact graph (venus spec status --json) for completion checking
- Don't block archive on warnings - just inform (no confirmation needed)
- Preserve .openspec.yaml when moving to archive (it moves with the directory)
- Preserve \`attachments/\` subdirectory — it moves with the change directory automatically
- When extracting summary for ARCHIVE-INDEX.md, scan \`tasks.md\` for supplement type labels and append \`[含xxx]\` annotation to the summary
- Sync exploration memory to specs/<capability>/explorations.md for every involved capability before the archive move; skip (with log) when exploration.md or delta specs are missing; never block the archive on sync failure
- Generate the requirement document at the pre-archive checkpoint (4.8) from the FINAL artifacts: absent → delegate venus_tr_docs_requirement_doc non-interactively; present → in-place alignment preserving the 人工域 (\`## 基本信息\` / \`## 八、评审记录\`) and never calling the skill in that branch; never block the archive on generation or alignment failure
- When the change declares \`skip_specs\` (status reports specs as skipped), the archive summary MUST note "主规格未同步（skip_specs 声明）" to prevent users from mistaking it as a spec sync omission
- Show clear summary of what happened
- If delta specs exist, run the sync assessment, show the combined summary, and execute the inline AI merge directly (ADDED/MODIFIED/REMOVED/RENAMED → main spec, following v1.1.20 specs-apply semantics)`,
        license: 'MIT',
        compatibility: '依赖 venus CLI（spec 命令组）与 CodeGraph CLI（可选）。',
        metadata: { author: 'venus-agent-tools', version: '1.0' },
    };
}

export function getSpecArchiveChangeCommandTemplate(): CommandTemplate {
    return {
        name: 'Venus: 归档变更',
        description: '归档变更 —— 归档已实现完成的变更并同步主规格与知识图谱',
        category: 'Venus / 规格',
        tags: ['venus', 'spec', 'archive'],
        content: deriveCommandContent(getSpecArchiveChangeSkillTemplate().instructions),
    };
}
