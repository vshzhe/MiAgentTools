---
name: "Venus: 引导工作流"
description: 一站式引导工作流：结构化探索（grill 追问 L1-L5）→ 提案内联生成 → 自动验证门 → 深度复查与需求文档联动
allowed-tools: Bash(venus:*)
category: Venus / 实现
tags: [venus, tr_impl, workflow, exploration, verification]
---

**Before proceeding, read openspec/rules/ai-coding.md for AI coding guardrails.**

One-stop workflow from exploration to task generation with keyword detection, analysis integration, and automatic verification phase.

This workflow guides you through:
1. **Exploration phase** - Keyword detection + analysis + grill-with-docs questioning
2. **Proposal phase** - Impact analysis + artifact generation
3. **Verification phase** - Automatic quality check before implementation

---

**Input**: The argument after `/venus:tr-impl-workflow` is the user's topic description (what they want to build).

---

## Phase 1: Exploration

### 1.1 Create Exploration File

Create file at `openspec/explorations/<keyword>-explore-<sequence>.md`:

- Extract keyword from user's topic (kebab-case, max 50 chars)
- Find highest sequence for that keyword
- Increment sequence (001, 002, etc.)
- Default to "explore" if extraction fails

Use `path.join()` for cross-platform compatibility.

### 1.1.5 CONTEXT.md Startup Check (MANDATORY CHECKPOINT)

**⚠️ MANDATORY: CONTEXT.md check at Phase 1 start — BEFORE questioning begins**

1. **Check if `openspec/CONTEXT.md` exists** using Glob or Read tool
2. **If EXISTS**: Read all existing terms and inject them into exploration.md 术语表 section
   - Use existing terminology in all questions (do not re-define)
3. **If NOT EXISTS**: Record "No existing glossary — will create during exploration" in exploration.md 术语表 section

**Checkpoint Enforcement**:
- System MUST check CONTEXT.md existence before entering questioning
- If CONTEXT.md exists, terms MUST be loaded into exploration.md before first question

### 1.2 Initialize Structured Format

Write the initial file structure with enhanced sections:

```markdown
## Background
<User's initial description>

## Analysis (optional - if analysis run)
### Security Findings
<Security vulnerabilities from Semgrep>

### Architecture Flow
<Call chains and symbols from CodeGraph>

### Business Flow
<Process steps from CodeGraph>

### Identified Symbols
<Symbols for Phase 2 Impact Analysis>

## Codebase Findings

### Discovered Files
- <file-path>: <relevance-reason>

### Identified Symbols
- <symbol-name> (<file-path>:<line>): <reason>

### Pattern Matches
- <pattern-name>: <example-location>

## Questions
<Empty initially - accumulates Q&A>

## 术语表

| 术语 | 定义 | 避免使用 |
|------|------|---------|
<!-- Terms resolved during grilling and written to CONTEXT.md -->

## 架构决策

<!-- ADRs created during exploration -->
- ADR-0001: <title> — <summary>
  File: `openspec/docs/adr/0001-<slug>.md`

## 边界场景

<!-- Boundary scenarios constructed for each decision -->
- [ ] <scenario description>

## Decision Process

### Decision: <topic>
**Options Considered**:
- Option A: <description>
- Option B: <description>

**Pros/Cons**:
- Option A: <pros> vs <cons>
- Option B: <pros> vs <cons>

**Chosen**: Option A
**Rationale**: <reason>

## Decisions
<Empty initially - accumulates confirmed choices>

## Scope Changes
| 变更时间 | 变更类型 | 变更描述 | 原因 |
|---------|---------|---------|------|
| <!-- expand/shrink/pivot --> | <!-- description --> | <!-- reason --> |

## Pending
### For Phase 2 Impact Analysis
- <Symbol name> (<File location>) - Priority: HIGH

### Security Concerns
- <Vulnerability type>: <Affected area> - Fix: <Approach>

### Business Validation
- <Validation question>: <Context>

### Unresolved Decisions
- <Decision pending confirmation>

## Implementation Deep-Dive (条件性显示 — 深度分析触发时出现)

### Design Rationale
<!-- Why this implementation was chosen — from code comments, ADRs, design docs -->
<!-- No findings -->

### Constraints
<!-- Hard constraints that shaped the design — from config files, linter rules -->
<!-- No findings -->

### Trade-offs
<!-- Multi-option trade-off analysis — from TODO/FIXME/HACK comments -->
<!-- No findings -->

### Pattern Usage
<!-- Design patterns in use — from class/interface structure -->
<!-- No findings -->

### Historical Context
<!-- Design evolution — from git log --follow, git blame, CHANGELOG -->
<!-- No historical data available -->

### Implicit Assumptions
<!-- Undocumented assumptions — from type guards, default values, missing null checks -->
<!-- No findings -->
```

**Section Guidelines**:
- **Codebase Findings**: Records discoveries from exploration (files, symbols, patterns)
- **Decision Process**: Tracks decision evolution with rationale
- **Pending**: Categorized by type for Phase 2 attention

### 1.2.0.5 Capability Exploration Memory Injection (MANDATORY CHECKPOINT)

**⚠️ MANDATORY: Inject capability-level exploration memory before questioning begins**

After structured format initialization:

1. **Infer involved capabilities** from the user's topic
   - Use Glob tool to scan `openspec/specs/` directory for module names
   - Match topic keywords against module names (same logic as change naming module identification)

2. **Detect capability memory file**
   - For each involved capability `<capability>`, check if `openspec/specs/<capability>/explorations.md` exists (use `path.join()`)

3. **Inject memory (when file exists)**
   - Read the file and inject historical Decisions, 术语, and 边界场景 into the exploration context
   - Write a summary into exploration.md `## Codebase Findings` under a "### Capability Exploration Memory (injected)" subsection
   - Sections marked `已过时（由 <change-name> 取代）` serve as historical reference ONLY — the superseding change's decisions are current

4. **No memory file**
   - Log: "无能力级探索记忆 — 全新探索"
   - Proceed with normal exploration

**Checkpoint Enforcement**:
- System MUST execute capability memory detection before entering questioning
- Injected memory MUST be reflected in exploration.md before the first question

### 1.2.1 Mandatory CodeGraph Base Scan (MANDATORY CHECKPOINT)

**⚠️ MANDATORY: CodeGraph base scan before questioning begins**

After structured format initialization, system MUST execute mandatory CodeGraph base scan:

0. **Check CodeGraph availability (mandatory first action)**:
   - **MUST run `codegraph_status` FIRST.** Until it returns unavailable, you MUST NOT use Glob/Grep for file or symbol investigation — the `codegraph_*` tools below are the primary path, not an optional one.
   - If available: proceed with CodeGraph tools below
   - If `codegraph_status` confirms unavailable (uninitialized or error): ONLY THEN log "CodeGraph not initialized — using Glob/Grep fallback" and skip to the fallback below
   - Grep/Glob is a last resort, permitted ONLY after `codegraph_status` confirms unavailability — never as a shortcut to skip CodeGraph

1. **Scan project file structure** using `codegraph_files` tool
   - Get full project file tree with metadata
   - Identify relevant directories and files matching exploration topic
   - Write results to `## Codebase Findings > Discovered Files`

2. **Search for relevant symbols** using `codegraph_search` tool
   - Search for symbols matching exploration topic keywords
   - Record discovered symbols with file:line locations
   - Write results to `## Codebase Findings > Identified Symbols`

   **Note**: `codegraph_context` is deferred to Section 1.4 (after questioning, when task description is clearer).

3. **Record scan results** in exploration file:
   ```markdown
   ## Codebase Findings

   ### Discovered Files
   - <file-path>: <relevance-reason>

   ### Identified Symbols
   - <symbol-name> (<file-path>:<line>): <reason>

   ### Pattern Matches
   - <pattern-name>: <example-location>
   ```

**Fallback (last resort)**: Permitted ONLY after `codegraph_status` confirms CodeGraph MCP tools are unavailable (uninitialized or error):
- Fall back to Glob tool for file structure discovery
- Fall back to Grep tool for symbol search
- Record in exploration file: "CodeGraph unavailable — used Glob/Grep fallback"

**Checkpoint Enforcement**:
- System MUST execute base scan before entering questioning
- If CodeGraph AND Glob/Grep both fail, system MUST warn but NOT block
- Scan results MUST be written to exploration file before proceeding

### 1.2.1.5 Multi-Project CodeGraph Agent Scan (条件触发 — 检测到其他项目路径时执行)

**⚠️ CONDITIONAL: Only executes when exploration context contains other project paths**

After the 1.2.1 base scan (current project), system MUST check if the exploration context contains paths to other projects (e.g., user-specified `--project-path`, auto-migration SOURCE_PROJECT/TARGET_PROJECT, or paths confirmed during conversation).

**When other project paths are detected**:

1. **Check CodeGraph initialization** for each other project path:
   - Run Bash `ls <path>/.codegraph/` to check whether the target project has a `.codegraph/` directory (directory contents listed — including codegraph.db — means CodeGraph is initialized). Do NOT use Glob to check dot-prefixed directories (Glob returns false negatives for them)
   - If initialized (ls succeeds): proceed with Agent scan
   - If not initialized (ls fails — directory does not exist): log WARN "Other project <path> does not have CodeGraph initialized — falling back to Glob/Grep" and fall back to Glob/Grep

2. **Spawn sub-agent** for each other project with CodeGraph initialized:
   - Use the `Agent` tool to spawn a sub-agent
   - The sub-agent SHALL use CodeGraph MCP tools with `projectPath` parameter pointing to the other project
   - Execute `codegraph_files` for file structure, `codegraph_search` for symbol search, `codegraph_context` for context understanding
   - Limit scan depth: `maxDepth: 3`, `maxNodes: 20` to prevent excessive results
   - Set sub-agent timeout: 120s (timeout → WARN fallback to Glob/Grep)

3. **Handle multiple project paths**:
   - Spawn sub-agents sequentially (one per project)
   - Each project's scan is independent — failure on one does NOT affect others

4. **Merge results** into exploration.md:
   - Write to `## Codebase Findings > ### Other Project Findings` subsection
   - Prefix results with project path for clear attribution
   - Results include: discovered files, identified symbols, and call chains

5. **When no other project paths detected**:
   - Do NOT trigger the multi-project Agent scan
   - Proceed with the existing 1.2.2 flow unchanged

**Fallback**: If Agent spawn fails, sub-agent times out, or CodeGraph is not initialized in the target project:
- WARN log with specific failure reason
- Fall back to Glob/Grep for that project
- Do NOT retry the failed Agent scan
- This fallback does NOT affect the current project's scan results

**Checkpoint Enforcement**:
- System MUST execute this check after 1.2.1 base scan completes
- If other project paths exist, system MUST attempt Agent scan (with fallback)
- Results MUST be written to exploration.md before proceeding to 1.2.2
- This check MUST NOT block the main workflow — failures degrade gracefully

### 1.2.2 Smart Detection: New Feature vs Modify Existing Code

**Purpose**: Determine whether to trigger deep analysis (`codegraph_explore` + `codegraph_impact`).

**Detection Logic**:
1. **Analyze user input keywords** for modification intent:
   - "modify", "update", "change", "edit", "refactor", "enhance", "优化", "修改", "重构" → triggers deep analysis
   - "add", "create", "new", "introduce", "implement", "新增", "添加" → may skip deep analysis

2. **Cross-reference with CodeGraph findings**:
   - If base scan found relevant existing symbols → likely modifying existing code
   - If base scan found no relevant symbols → likely new feature

3. **Decision**:
   - **Modify existing code detected**: System MUST trigger deep analysis hook
     - Execute `codegraph_explore` for deep dive
     - Execute `codegraph_impact` for blast radius
     - Record results in `## Implementation Deep-Dive` section
   - **Pure new feature**: Skip deep analysis, keep only base scan results
   - **Ambiguous**: Default to trigger deep analysis (safer)

4. **Log decision** in exploration file:
   ```
   ## Analysis
   ### Deep Analysis Trigger
   - Triggered: Yes/No
   - Reason: <detection rationale>
   - Scope: <affected symbols/files>
   ```

### 1.2.3 CodeGraph Deep Analysis (Conditional — trigger-based)

**Trigger**: When 1.2.2 detects modification intent OR Scope.Modify keyword detected.

Execute deep analysis when triggered:
1. `codegraph_explore` — Deep exploration of specific symbols
2. `codegraph_impact` — Blast radius analysis of affected symbols
3. Write results to exploration.md `## Implementation Deep-Dive` section

**Scope Control** (by trigger level):
- 🔴 Auto (Scope.Modify): All 6 analysis dimensions, up to 10 core symbols
- 🟡 Prompt (Scope.Add): Rationale + Constraints + Assumptions, up to 10 core symbols
- 🟢 Manual (Depth.Deep): User-selected dimensions

### 1.2.4 Post-Scan Update of Exploration File

After base scan (and deep analysis if triggered):
1. Update `## Codebase Findings` section with all discovered files and symbols
2. Update `## Analysis` section with architecture and business flow findings
3. Update `## Pending > For Phase 2 Impact Analysis` with identified symbols
4. If 1.2.1.5 multi-project Agent scan ran, include its results in the Codebase Findings section under `### Other Project Findings`
5. Log: "CodeGraph scan complete — <N> files, <M> symbols found"

### 1.3 Grill-With-Docs Questioning

Apply the full grill-with-docs discipline: grilling primitive (decision tree walk) + domain-modeling (CONTEXT.md glossary, ADRs, code cross-validation, scenario construction).

**Terminology sharpening (MANDATORY)**: Each time a term is resolved, MUST write to `openspec/CONTEXT.md` NOW (not deferred). Use format: `**<Term>**: <definition>\\n_Avoid_: <synonyms>`. If CONTEXT.md does not exist, create lazily.

**Trigger when**:
- Scope ambiguous
- Technical approach unclear
- Requirement not measurable

**Behavior**:
- **Decision tree traversal**: Resolve parent decisions before child decisions
- **Codebase-first**: Explore code instead of asking when possible
- **One at a time**: Single question, wait for response
- **Provide recommendation**: Always include "My recommendation: <answer>"
- **Unlimited depth**: Continue until clear
- **Per-Level Confirmation Gate**: Progress through L1→L5 with explicit confirmation at each level:
  - L1 (意图): Ask what, wait for confirm
  - L2 (方案): Ask how, wait for confirm
  - L3 (异常): Ask error handling, wait for confirm
  - L4 (一致性): Cross-validate against code, ask if conflict found
  - L5 (边界): Construct boundary scenario, ask for handling
  - Each level = ONE question, MUST confirm before next. Minimum L3.

### 1.4 Keyword Detection and Analysis

**Scan user input for keywords** during or after grill-with-docs questioning.

| Category | Keywords |
|----------|----------|
| Security | security, auth, login, password, token, xss, sql injection |
| Architecture | architecture, refactor, api, endpoint, call chain |
| Business | business, workflow, process, flow, state, transition |
| Impact | impact, change, modify, update, delete, rename |

**Auto-execute analysis**:
> "Detected [Security] keywords. Running Semgrep analysis automatically."
> Analysis runs directly upon detection — no run/skip prompt.

**Tools**:
- Security: `mcp__plugin_semgrep_semgrep__semgrep_scan` (Semgrep MCP 为可选增强：不可用时该分析跳过并记录，不阻塞工作流)
- Architecture: `mcp__codegraph__codegraph_context` (after questioning, task description is clearer), `mcp__codegraph__codegraph_callers`, `mcp__codegraph__codegraph_callees`
- Business: `mcp__codegraph__codegraph_context`, `mcp__codegraph__codegraph_explore`

### 1.5 Update File After Each Exchange

**Step 1 — Write to CONTEXT.md (MANDATORY if term resolved)**: If a term was resolved, write to `openspec/CONTEXT.md` NOW.

**Step 2 — Update exploration.md**:

| Content | Section |
|---------|---------|
| Original input | Background |
| Analysis results | Analysis |
| Resolved terminology (from CONTEXT.md) | 术语表 |
| Q&A pairs | Questions |
| ADRs created | 架构决策 |
| Constructed boundary scenarios | 边界场景 |
| Confirmed choices | Decisions |
| Unresolved | Pending |

### 1.6 Completion Detection

When all clear, apply consistency passthrough (replaces the confirmation prompt):

⚠ Before transitioning to Phase 2, the system MUST pass the mandatory Phase 1 end checkpoints from the detailed flow above: **1.6.5 CONTEXT.md Checkpoint** and **1.6.6 Aggregate Consistency Gate** (cross-decision hard-conflict scan — NOT exempt by the "no exploration file" skip). Do not transition to Phase 2 on completion detection alone.

- **Both checks pass (no hard conflicts)**: announce "Checks passed — generating proposal directly" and enter Phase 2 immediately — do NOT ask "Ready to proceed to proposal?"
- **Hard conflict detected**: present the conflicting decisions (list the conflicting decision pair) and ask which direction to follow; continue only after the conflict is resolved
- grill L1-L5 clarification gates still wait for user confirmation; 1.7 abandon handling is preserved

### 1.7 Abandon Handling

If user stops:
> "Delete exploration file or keep it?"
[Delete] [Keep]

---

## Phase 2: Proposal

### 2.0 Pre-Artifact Impact Analysis

**Check for impact symbols** in Pending "For Phase 2 Impact Analysis".

If symbols exist:
**Auto-execute impact analysis**:
> "Found symbols for impact analysis. Running impact analysis automatically."

**Tool**: `mcp__codegraph__codegraph_impact --symbol <symbol> --direction upstream`

**Parallel execution for multiple symbols**: When two or more impact symbols are identified, issue the impact queries in parallel (multiple tool calls in a single response round). Merge all results into the artifact impact sections; a single symbol keeps the existing single-query behavior.

**Results stored for**:
- proposal.md: Impact Analysis section
- design.md: Architecture Impact section
- tasks.md: Caller Updates section

### 2.1 Direct Transition to Inline Generation

**⚠️ Complexity assessment and generation-method selection are REMOVED.**

After Phase 2.0 impact analysis (completed or skipped):
- Proceed directly to Phase 2.3 (migrate exploration file) and Phase 2.4 (inline artifact generation)
- Use propose-style one-step inline generation for ALL changes
- Do NOT compute complexity score or display method options
- Step-by-step creation remains available via venus spec new (step-by-step artifact creation)

### 2.3 Migrate Exploration File

Move exploration file to change directory BEFORE artifact generation:

```
Source: openspec/explorations/<keyword>-explore-<sequence>.md
Destination: openspec/changes/<change-name>/exploration.md
```

**Cross-platform**: Use `path.join()` for all paths.

**Post-Migration**: Source file is preserved (not deleted) — consistent with venus_tr_impl_auto_workflow behavior.

### 2.4 Artifact Generation (Inline)

**Read exploration.md first**, then extract content per mapping rules:

| Exploration Section | Artifact Mapping |
|--------------------|------------------|
| Decisions | → proposal.md |
| Analysis | → design.md |
| Questions | → specs |
| Codebase Findings | → tasks.md |

**Inline generation (single path)**:

- Execute inline following `openspec/rules/artifact-generation.md`
- `venus spec status --change "<name>" --json` (get build order)
- `venus spec instructions <artifact-id> --change "<name>" --json` (get template)
- Write artifact file inline using Write tool
- All artifacts generated in sequence without intermediate prompts

```bash
venus spec status --change "<name>" --json
venus spec instructions <artifact-id> --change "<name>" --json
```

Create inline in dependency order until `applyRequires` complete.

#### CLI Command Failure Handling

During inline generation, handle CLI failures:

**CLI availability detection (first-call failure signature)**:

- **First `venus spec status` or `venus spec list` Bash call fails with a command-not-found error** (e.g., "command not found", "不是内部或外部命令", "not recognized"): conclude the venus CLI is not installed. Tell the user in one line — "venus CLI not found in PATH — switching to CLI-degraded generation mode" — and switch to CLI-degraded generation mode. Do NOT repeat this notice mid-flow.
- **Other errors** (e.g., JSON parse failure, artifact not found): do NOT enter degraded mode; use the failure interactions below.

**CLI-degraded generation mode** (active after command-not-found detection):

- Abandon the `venus spec status`/`venus spec instructions` loop — do NOT attempt further `venus spec status`/`venus spec instructions` calls during the flow
- Generate artifacts directly via AI in the template's built-in dependency order (proposal → specs → design → tasks) using the template-embedded structure rules (Phase 2.5 guidelines)
- **Degraded change discovery (when no change name is specified)**: scan `openspec/changes/*/ ` directories (excluding `archive/`) with Glob; when multiple candidates exist, let the user choose via AskUserQuestion
- **Degraded artifact status inference**: infer completion from file existence (`proposal.md`, `specs/`, `design.md`, `tasks.md` under the change directory) — an artifact exists when its file is present, without CLI validation
- **Degraded flow end**: state exactly once — "This run used CLI-degraded generation. Installing the venus CLI is recommended for validation and build-order guarantees." Do NOT repeat the reminder elsewhere in the flow

**Other CLI failures** (CLI installed):

- **venus spec new fails**: Display error + options: [重试] [手动修复后继续] [中止]. Preserve exploration file.
- **venus spec instructions fails**: Display artifact ID + error + options: [重试当前artifact] [跳过当前artifact] [中止]. Preserve already-created artifacts.
- **File write fails**: Display path + error reason + options: [重试] [中止]. Do NOT mark artifact as done.
- **Recovery**: On retry, re-run `venus spec status --json`, resume from first `status: "ready"` artifact. Do NOT regenerate already-completed artifacts.

**Include analysis results**:
- If impact run → add Impact sections
- If security run → add Security Updates tasks
- If business run → add Business Steps tasks

**Task Type Labels (for tasks.md generation):**
- Each task MUST include a type label: `- [ ] [代码] N.M ...` or `- [ ] [DB脚本] N.M ...` etc.
- Supplement tasks (non-`[代码]`) MUST include `产出:` field as indented content
- Default output path: `attachments/<filename>` (relative to changeRoot)
- See `schemas/spec-driven/templates/tasks.md` template for full label reference

---

## Phase 3: Verification

**Phase 3 executes automatically after inline artifact generation completes in Phase 2.4. No Skill delegation gap — workflow context remains active throughout. No user choice prompt — verification runs automatically.**

### 3.1 Auto-Execute Verification

- **Skip method-specific prompt** — Do NOT show "Propose 方式一步生成" or "已通过逐步迭代创建"
- **Skip user choice** — Do NOT ask [立即验证] / [跳过验证]
- **Execute directly** — Run D1-D5 verification automatically

### 3.2 Run Verification

- Invoke the `venus_spec_verify_proposal` **skill** (via Skill tool) for D1-D5 scoring — `venus_spec_verify_proposal` is a skill name, NOT a valid `venus spec instructions` artifact ID
- Fallback to AI inline scoring + WARN log if the skill is unavailable; never silently skip
- Calculate coverage rates and overall score (unified 90% threshold)
- Detect tech stack from config.yaml context

### 3.3 Handle Results

**PASS (≥90%)**:
- Auto-execute deep review (`venus_tr_impl_review_proposal` skill via Skill tool, no [Yes/No] prompt, user can interrupt to skip; fallback to main-workflow inline read-only deep review + WARN on skill unavailable or call failure — never silently skip)
- Display results alongside verification report
- **Auto-generate requirement document**: after deep review completes, invoke the `venus_tr_docs_requirement_doc` skill (via Skill tool) in non-interactive mode (Markdown, placeholder basic info); output to `openspec/changes/<change-name>/需求文档.md`; display the document path; on generation failure log WARN and continue

**FAIL (<90%)**:
- Auto-generate fix suggestions and apply fixes
- Re-run verification automatically
- Do NOT generate the requirement document until fixes pass re-verification
- If still FAIL: [Manual edit] [Return to exploration] [View detailed diff] (no skip-to-apply path)

## Output

```
## Exploration Phase
Created: openspec/explorations/<topic>-explore-001.md
[Questioning until clear...]

## Exploration Complete ✓
Checks passed — generating proposal directly

## Proposal Phase
Created change: <name>
Migrated: exploration.md
Generated: proposal.md, design.md, specs/*.md, tasks.md

## Verification Phase
Auto-verification running...

| Dimension | Coverage | Status |
|-----------|----------|--------|
| D1: Requirements | 85% | PASS |
| D2: Technical | 90% | PASS |
| D3: Tasks | 100% | PASS |
| D4: Boundaries | 70% | FAIL |
| D5: Pending | 100% | PASS |
| D6: Deep Analysis | N/A | PASS |

Overall: 89%

[Options on fail or deep check prompt on pass]

Ready for `/venus:spec-apply`

---

## Output (Full Pass with Requirement Document)

```
## Verification Phase

| Dimension | Coverage | Status |
|-----------|----------|--------|
| D1: Requirements | 95% | PASS |
| D2: Technical | 100% | PASS |
| D3: Tasks | 100% | PASS |
| D4: Boundaries | 100% | PASS |
| D5: Pending | 100% | PASS |

Overall: 99% → deep review complete →
✓ 需求文档已生成: openspec/changes/<change-name>/需求文档.md

Ready for `/venus:spec-apply`
```

---

## Guardrails

- Don't skip questioning - ask until truly clear
- Don't auto-proceed on conflict - phase transitions proceed automatically when the 1.6 consistency checks pass (consistency passthrough); ask the user only when a hard conflict is detected
- Do execute read-only operations directly - file reading, CodeGraph queries, and analysis steps (Semgrep, impact analysis) run without asking the user for confirmation
- Read-only passthrough does not cover clarification gates - grill L1-L5 clarification gates still wait for user confirmation
- Don't offer method selection - Phase 2 proceeds directly to inline propose-style generation
- Do auto-verify - automatically verify after proposal
- Do auto-generate requirement doc - after full pass, invoke venus_tr_docs_requirement_doc non-interactively; never generate on FAIL; WARN and continue on generation failure
- Do inject capability memory - Phase 1 reads specs/<capability>/explorations.md when it exists
- Do scan other projects with CodeGraph - When exploration context contains other project paths, spawn sub-agent to scan them using CodeGraph projectPath parameter; fall back to Glob/Grep on failure
- Don't lose exploration - file persists
- Do explore codebase before asking
- Do provide recommendations
- Do update file real-time
- Do use structured format
- Do show quantified scores
