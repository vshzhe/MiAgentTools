---
name: venus_spec_apply
description: 实现变更。当 openspec/changes/ 下已有变更制品（proposal/specs/design/tasks），需要基于规格驱动实现任务清单时使用；用户直接描述需求而无变更制品时，应使用 venus_tr_impl_feature 直接实现。
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(venus:*), Bash(npm:*), Bash(pnpm:*), Bash(node:*), Bash(git:*), Bash(tsc:*), Bash(mvn:*), Bash(ant:*), Bash(gradle:*), Bash(go:*), Bash(cargo:*)
license: MIT
compatibility: 依赖 venus CLI（spec 命令组）。
metadata:
  author: venus-agent-tools
  version: "1.0"
  type: spec
  generatedBy: "snapshot"
---

**Before implementing, read openspec/rules/ai-coding.md for AI coding guardrails.** Never guess database fields, API params, or business rules — mark as **[待确认]** and ask the user.

Implement tasks from a change's artifacts (proposal/specs/design/tasks) under openspec/changes/.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes. The workflow may also pass `auto-mode=true` to skip the design confirmation gate for automated execution.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `venus spec status --json` to get available changes and use the **AskUserQuestion tool** to let the user select

   Always announce: "Using change: <name>" and how to override (e.g., `/venus:spec-apply <other>`).

2. **Check status to understand the schema**
   ```bash
   venus spec status --change "<name>" --json
   ```
   Parse the JSON to understand:
   - `schemaName`: The workflow being used (e.g., "spec-driven")
   - `planningHome`, `changeRoot`, and `actionContext`: planning scope and edit constraints
   - `progress`: total, complete, remaining task counts
   - Which artifact contains the tasks (typically "tasks" for spec-driven, check status for others)

   **Workspace guard:** If status JSON reports `actionContext.mode: "workspace-planning"` and `allowedEditRoots` is empty, explain that full workspace apply is not supported in this slice. Treat linked repos and folders as read-only context, ask the user to select an affected area through an explicit implementation workflow, and STOP before editing files.

   **Skipped artifacts handling:** If status reports any artifact with `skipped` state (the change declares `skip_specs`), do NOT treat it as missing — its dependencies are considered satisfied, and implementation proceeds normally for the remaining artifacts. Such artifacts are not flagged as incomplete in the `instruction` state returned by Step 3.

3. **Get task list and context files**

   **Primary path — venus CLI `instructions apply` (preferred):**
   ```bash
   venus spec instructions apply --change "<name>" --json
   ```
   Parse the JSON to obtain structured task context:
   - `contextFiles`: artifact → file path mapping (proposal/specs/design/tasks → their absolute or change-relative paths); use these as the authoritative file list instead of assuming standard file names
   - `progress`: total, complete, remaining task counts (used for progress display in Step 5)
   - `taskList`: structured task entries with checkbox state and group labels (used for batch planning in Step 5.5)
   - `instruction`: dynamic three-state directive:
     - `"blocked"`: artifacts missing or incomplete → suggest running `venus_spec_verify` to complete artifacts first; STOP before implementing
     - `"ready"`: artifacts complete and tasks pending → proceed to Step 4 (read context files)
     - `"all_done"`: all tasks already complete → congratulate, suggest archive; STOP

   **Fallback path (old CLI without `instructions apply`):**
   - If the `venus spec instructions apply` command does not exist (unrecognized subcommand) or exits non-zero (older CLI version that does not support the structured apply context contract), fall back to directly reading the change directory's artifact files:
     - `openspec/changes/<name>/proposal.md` — proposal (Why, What changes)
     - `openspec/changes/<name>/specs/` — delta specs (requirements)
     - `openspec/changes/<name>/design.md` — design (Decisions, architecture, dependencies)
     - `openspec/changes/<name>/tasks.md` — task list with checkboxes
   - Log a WARN stating the fallback reason (e.g., "command not found" or "non-zero exit code <N>") so the user knows structured context was unavailable
   - Task completion status is read directly from the tasks.md checkboxes (`- [x]` = complete, `- [ ]` = pending) in fallback mode

   **Handle states (both paths):**
   - If artifacts are missing (proposal/specs/design/tasks): show message, suggest using `venus_spec_verify` to complete the artifacts first
   - If all tasks are already complete: congratulate, suggest archive
   - Otherwise: proceed to implementation

4. **Read context files**

   Read every artifact file under the change directory:
   - **proposal.md**: Why and What
   - **specs/**: delta requirement specs
   - **design.md**: Decisions, architecture, module dependencies (used to infer task batch plan)
   - **tasks.md**: task list with status checkboxes

5. **Show current progress**

   Display:
   - Schema being used
   - Progress: "N/M tasks complete"
   - Remaining tasks overview

**5.5. Design Confirmation Gate** ⚠️ MANDATORY

   After reading context files and BEFORE implementing any task, build the unified concurrent batch plan, present a design blueprint summary, and WAIT for user confirmation:

   **Auto-mode check**: If the apply was invoked with `auto-mode=true` (from workflow auto-apply context), skip the entire Step 5.5 confirmation gate — proceed directly to Step 6 (batch scheduling). The batch plan is still built internally for execution but is NOT presented to the user.

   **Build the unified concurrent batch plan first:**
   - The venus CLI does not return a `batchPlan` — infer dependencies for all tasks from design.md (architecture layering, module dependencies); tasks with no dependency annotations are treated as independent within their group
   - Cluster same-group tasks (`## N` headings, from each task's `group` field) into dispatch units — one sub-agent per unit
   - If design.md reveals circular dependencies among some tasks: include a circular-dependency warning line; degrade those tasks to serial execution
   - If design.md lacks dependency info: plan serial execution and note "(串行执行 - 无依赖信息)" in the blueprint

   ```
   📋 **设计方案确认**

   **变更**: <change-name> | **Schema**: <schema-name>

   ### 变更概要
   <from proposal Why section>

   ### 关键设计决策
   <from design Decisions section>

   ### 涉及的数据结构 / API
   <from design or specs>

   ### [待确认] 项目
   <list pending items, or "(无 - 已全部解决)">

   ### 任务数: N (0/N 完成)

   ### 并发执行计划
   <"(串行执行 - 无依赖信息)" when no dependency info, otherwise:>
   | 批号 | 任务 | 依赖来源 | 并发/串行 |
   |-----|------|---------|----------|
   | 1 | <task descriptions or ids> | <AI 推断 / 无依赖> | 并发 |
   | 2 | <task descriptions or ids> | <依赖批 1 / AI 推断> | 并发/串行 |
   <if circular deps detected: "⚠️ 循环依赖: <task ids> — 已降级为串行执行">
   <AI-inferred rows MUST be labeled "AI 推断" in the 依赖来源 column>

   ### 补充文档
   <list supplement tasks with their type labels and output paths, or "(无)">

   WAIT for user to explicitly reply "确认" before implementing.
   [确认 ✓] [修改设计] [取消]
   ```

   - If user replies **"确认"**: one confirmation covers ALL batches — proceed to Step 6 and start batch scheduling
   - If user replies **"修改设计"** or **"取消"**: STOP and wait for design updates (no task is implemented)
   - **Auto-mode override**: When `auto-mode=true`, the gate is skipped entirely — the blueprint is NOT shown, and execution proceeds directly to Step 6. This gate CANNOT be skipped when auto-mode is not set or is false.
   - This gate CANNOT be skipped — do NOT proceed without explicit confirmation (unless auto-mode is active)

   **Temp workspace protocol (flow-scoped, managed by the main agent):**
   - After the user confirms the design (or when auto-mode is active) and BEFORE dispatching any batch, create a single temp workspace directory — **project-local first**: `.openspec-tmp/apply-<change-name>/` under the project root (build the path with path.join for cross-platform safety). Add `.openspec-tmp/` to the project's `.gitignore` if not already present, so the workspace never pollutes git status; leave the entry in place after cleanup for future runs. If the project root is not writable, fall back to the system temp directory named `venus-apply-<change-name>/` and log a WARN stating the fallback location
   - ALL temporary files created during the flow (compile verification scripts, temporary configs, scratch outputs) MUST be placed inside this workspace — do NOT scatter temp files across the project directory
   - Create the workspace once at flow start and clean it up once at flow end — do NOT create or remove temp directories per task or per batch

6. **Implement tasks (batch scheduling loop until done or blocked)**

   **Load the concurrency limit before dispatching:**
   - Read `openspec/config.yaml` for `apply.concurrency` (a positive integer)
   - If not configured: use the default limit of 3
   - If the value is invalid (non-positive or non-integer): warn the user and fall back to the default of 3
   - This limit bounds how many sub-agents (dispatch units) run simultaneously within a batch; it does NOT split or reorder batches

   **Load adjacent merge config:**
   - Read `openspec/config.yaml` for `apply.mergeAdjacent` (boolean)
   - If not configured: default to true (adjacent simple tasks are merged into one dispatch unit)
   - If false: skip merge behavior at the template level

   **Load incremental check config:**
   - Read `openspec/config.yaml` for `apply.incrementalCheck` (boolean)
   - If not configured: default to true
   - If true: after each batch, run incremental compile check (see Step 8 for details)
   - If false: skip incremental checks, only run final full check at Step 8

   **Batch scheduling loop** (follow the unified batch plan confirmed at Step 5.5, batch by batch):

   1. **Single-task batch**: implement the task directly yourself — do NOT dispatch a sub-agent and do NOT emit a concurrent-execution notice; indicate serial execution (single-task batch); show which task is being worked on, make the code changes required, keep changes minimal and focused
   2. **Multi-unit batch — concurrent state notice**: BEFORE dispatching a batch containing multiple dispatch units, output a prominent notice stating the batch position (Batch N/M), the number of sub-agents being dispatched (= the number of dispatch units), the task groups involved (the `group` labels of the batch's `dispatchUnits`; use task ids for units without a group label), and a reminder that task checkbox updates and failure retries are centrally managed by the coordinator
   3. **Pre-dispatch overlap check (cross-unit fallback)**: inspect the target files of the batch's tasks across dispatch units (from task descriptions, Spec Ref, and `产出:` declarations); tasks in different units that would modify the same file MUST be split out of the concurrent group and executed serially — tasks within one unit are implemented serially by the same sub-agent, so same-group files are never edited concurrently
   4. **Concurrent dispatch — one sub-agent per dispatch unit**: dispatch one sub-agent per remaining dispatch unit (Agent/Task tool); the unit's tasks are implemented by that sub-agent serially in task order; the number of simultaneously running sub-agents (dispatch units) within the batch MUST NOT exceed the concurrency limit; use sliding-window dispatch — as soon as one sub-agent finishes, immediately dispatch the next pending dispatch unit of the same batch
   5. **Sub-agent dispatch instruction MUST contain**:
      - The dispatch unit's task list in order, with each task's full details (description, requirements, Spec Ref), and the instruction to implement the unit's tasks serially in that order
      - The context file list (the change's artifact files plus the source files relevant to the tasks)
      - A summary of the key AI coding guardrails from openspec/rules/ai-coding.md (never guess DB fields, API params, or business rules — mark **[待确认]**; layered generation order; minimal scoped changes)
      - An explicit prohibition: **禁止修改 tasks.md** — the sub-agent MUST NOT edit task checkboxes
      - The temp workspace path, with the constraint: sub-agents ONLY write files into the workspace — they MUST NOT delete the workspace and MUST NOT run their own per-task temp directory creation/cleanup cycles
      - A unit-level completion report requirement: report the completion status of each task in the unit plus the list of produced files for the whole unit
   6. **After the whole batch returns**: verify each sub-agent's result against the task requirements → update tasks.md centrally yourself (`- [ ]` → `- [x]`, only for confirmed-complete tasks) → proceed to the next batch
   7. **Failed task**: retry the failed task serially yourself once → if the retry fails again, pause and report to the user (leave the task unchecked `- [ ]`)

   **Environment fallback (no sub-agent capability):**
   - If the runtime provides no sub-agent dispatch tool (Task/Agent class tools), fall back to serial implementation of all tasks by yourself and inform the user of the fallback

   **Serial fallback (no dependency info):**
   - If Step 5.5 could not infer a batch plan from design.md (no dependency annotations available): keep serial behavior: for each pending task — show which task is being worked on, make the code changes, mark complete in the tasks file (`- [ ]` → `- [x]`), continue to the next task

   **Supplement Document Handling Rules:**

   When implementing tasks, distinguish between two output types:

   **Code Implementation** (tasks with `[代码]` label or unlabeled):
   - Create/modify files at the appropriate project source locations
   - Follow normal implementation flow

   **Supplement Documents** (tasks with `[DB脚本]`, `[使用说明]`, `[API文档]`, `[配置示例]`, `[部署说明]`, `[测试数据]` labels):
   - Read the `产出:` field from the task to determine the output path
   - Default path: `<changeRoot>/attachments/<filename>`
   - Create the file at the default `attachments/` location WITHOUT asking
   - If the `产出:` field specifies a path outside `attachments/`, or if you determine a different location is more appropriate, MUST pause and ask the user for confirmation before placing the file
   - Upon user approval of a different location, update the `产出:` field in `tasks.md` to reflect the actual path
   - Mark the task complete after file creation

   **Unplanned Supplement Documents:**

   If during implementation the AI identifies a need for a supplementary document not listed in `tasks.md`:
   - Pause the current task
   - Describe the needed document and reason to the user
   - Wait for user confirmation
   - If user confirms: add a new task to `tasks.md` with appropriate type label and `产出:` path, execute it, then continue with remaining tasks
   - If user declines: record the decision, continue without creating

   **Pause if:**
   - Task is unclear → ask for clarification
   - Implementation reveals a design issue → suggest updating artifacts
   - Error or blocker encountered → report and wait for guidance
   - User interrupts → complete current batch, mark remaining tasks as incomplete, then pause
   - Implementation reveals a task's spec behavior must be narrowed, delayed, or simplified to pass → mark **[待确认]** with the difference explanation, ask the user, and after confirmation update proposal/specs/design before continuing (see Scope-creep guard in Guardrails)

7. **On completion or pause, show status**

   Display:
   - Tasks completed this session
   - Overall progress: "N/M tasks complete"
   - If all done: proceed to Step 8 (compile check)
   - If paused: explain why and wait for guidance

8. **Compile Check Phase** ⚠️ MANDATORY

   After all tasks are complete, execute automatic compile check:

   **8.1 Load compile check configuration**
   - Read `openspec/config.yaml` for `compileCheck` settings
   - If `compileCheck.enabled: false`, skip to Step 8.10

   **8.2 Detect tech stack**
   - Parse `config.yaml` context for keywords (TypeScript, Java, Go, Rust)
   - Check project config files (tsconfig.json, pom.xml, go.mod, Cargo.toml)
   - For Java: determine build tool (Maven/Ant/Gradle) from config or build files
   - If no tech stack detected, warn and skip compile check

   **8.3 Get change-scope files**
   - Parse `allowedEditRoots` from status JSON
   - Use `git diff` to identify modified files in change scope
   - Classify files into backend (TypeScript/Java/Go/Rust) and frontend (JSP/Vue/React)

   **8.4 Execute backend compile check**
   - Execute compile command per tech stack:
     - TypeScript: `tsc --noEmit` or `pnpm run build` (fallback: `npm run build`)
     - Java-Maven: `mvn compile -DskipTests`
     - Java-Ant: `ant compile`
     - Java-Gradle: `gradle compileJava`
     - Go: `go build ./...`
     - Rust: `cargo build`
   - Capture errors and parse into structured format

   **8.5 Execute backend lint check** (if configured)
   - TypeScript: `eslint`
   - Java: `mvn checkstyle:check`
   - Identify fixable vs non-fixable issues

   **8.6 Execute frontend validation** (if configured)
   - JSP files: validate tag closure, EL expressions, custom tag definitions
   - Vue/React: check component references

   **8.7 Auto-fix loop** (if configured)
   - If `autoFix.enabled: true`:
     - Classify issues by fixability (type annotation, unused variable, import order)
     - Apply fixes to change-scope files
     - Re-run compile/lint checks
     - Repeat up to `maxRetries` (default 3)

   **8.8 Generate compile check report**
   - Summarize results: backend compile, lint, frontend
   - List all fixed issues with file:line references
   - List issues requiring manual intervention

   **8.9 Handle check failures**
   - If failures remain after auto-fix:
     - Display failure options per `onFailure` config
     - Options: [1] View details, [2] Manual fix, [3] Skip with warning
   - If all checks pass: proceed to archive suggestion

   **8.10 Unified temp workspace cleanup** ⚠️ MANDATORY
   - After the compile check phase has finished — whether it passed, failed, or was skipped — delete the entire temp workspace in a single cleanup step
   - If the cleanup fails (file locked, permission denied): log a WARN with the workspace path so the user can remove it manually, and continue the flow without blocking

9. **Final status and archive suggestion**

   Display:
   - Compile check results summary
   - All tasks complete status
   - Suggest archiving the change via venus spec archive "<name>" --yes (or the venus_spec_archive skill)

<!-- CMD:SKIP -->
**Output During Implementation**

```
## Implementing: <change-name> (schema: <schema-name>)

⏳ Concurrent execution — Batch 2/4
   Dispatching 3 sub-agents (groups: 1. Data contract / 3. Template / 4. Tests)
   Coordinator is centrally managing task checkboxes and failure retries
- Task 3: <task description> → ✓ Task complete (produced: <file list>)
- Task 4: <task description> → ✓ Task complete (produced: <file list>)
- Task 5: <task description> → ✗ failed → serial retry in progress

Batch 3/4: 1 task — serial execution (single-task batch — implemented directly)
Working on task 6/7: <task description>
[...implementation happening...]
✓ Task complete
```

**Output On Completion**

```
## Implementation Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 7/7 tasks complete ✓

### Completed This Session
- [x] Task 1
- [x] Task 2
...

Starting compile check...

## 编译检查报告

| 检查项 | 状态 | 详情 |
|-------|------|------|
| Backend Compile | ✓ PASS | TypeScript: tsc --noEmit |
| Backend Lint | ✓ PASS | eslint: 0 issues |
| Frontend | ✓ PASS | No JSP files in scope |

**自动修复**: 2 issues fixed (type annotations, import order)

All checks passed! You can archive this change via venus CLI.
```

**Output On Compile Check Failure**

```
## Implementation Complete

**Change:** <change-name>
**Progress:** 7/7 tasks complete ✓

## 编译检查报告

| 检查项 | 状态 | 详情 |
|-------|------|------|
| Backend Compile | ✗ FAIL | 3 errors |
| Backend Lint | ✓ PASS | eslint: 0 issues |
| Frontend | - SKIPPED | No JSP files |

**自动修复**: Applied 2 fixes, 3 issues remain

### 需人工处理的问题
1. `src/main.ts:45` - Type mismatch: string vs number
2. `src/utils.ts:12` - Cannot find name 'config'
3. `src/api.ts:78` - Missing return type

**处理选项**:
[1] 查看详细错误信息
[2] 手动修复后重新检查
[3] 跳过检查并归档（记录警告）

请选择处理方式？
```

**Output On Pause (Issue Encountered)**

```
## Implementation Paused

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 4/7 tasks complete

### Issue Encountered
<description of the issue>

**Options:**
1. <option 1>
2. <option 2>
3. Other approach

What would you like to do?
```

**Output On Batch Task Failure Pause**

```
## Implementation Paused — Task Failure

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 4/7 tasks complete

### Failed Task
<task description> (batch N — sub-agent failed, serial retry failed)

### Failure Reason
<description of the failure>

The failed task remains unchecked (`- [ ]`) in tasks.md; confirmed tasks in the same batch have been marked complete.

**Options:**
1. Fix the task manually, then continue with the remaining batches
2. Provide guidance and retry the task
3. Stop the apply workflow

What would you like to do?
```
<!-- /CMD:SKIP -->

**Guardrails**
- Keep going through tasks until done or blocked
- Always read artifact files (proposal/specs/design/tasks) before starting
- If task is ambiguous, pause and ask before implementing
- If implementation reveals issues, pause and suggest artifact updates
- Keep code changes minimal and scoped to each task
- Update tasks.md centrally: mark confirmed-complete tasks (`- [ ]` → `- [x]`) ONLY when the task's spec behavior is fully implemented — partial or delayed implementations SHALL NOT be checked; for directly implemented tasks (serial fallback or single-task batch), mark complete immediately after the task is fully done
- ⚠️ **Scope-creep guard**: If implementation reveals that a task's spec behavior must be narrowed, delayed, or simplified to pass, MUST surface the finding — mark it **[待确认]** with a clear explanation of the difference between the spec and the actual implementation, and ask the user. Never silently shrink, delay, or simplify spec behavior to make a task checkmark pass. After user confirmation, MUST update proposal/specs/design to reflect the adjusted scope before continuing implementation.
- Pause on errors, blockers, or unclear requirements - don't guess
- Never fabricate database field names, types, or API endpoints — verify against existing code
- Follow layered generation order: Entity/DTO → Mapper/DAO → Service → Controller → Frontend
- Handle Loading/Empty/Error/Data states for every frontend data-display component
- Pause immediately when implementation conflicts with existing code or shared utility signatures
- Before compile check, perform pre-delivery self-check: no guessed fields, API contract aligned, params validated, UI states covered
- Read artifact files directly from the change directory — don't assume specific file names beyond the standard set
- ⚠️ **MANDATORY**: Execute Step 8 Compile Check after all tasks complete
- ⚠️ **MANDATORY**: Parse compile errors and offer fix options before suggesting archive

**Fluid Workflow Integration**

This skill supports the "actions on a change" model:

- **Can be invoked anytime**: Before all artifacts are done (if tasks exist), after partial implementation, interleaved with other actions
- **Allows artifact updates**: If implementation reveals design issues, suggest updating artifacts - not phase-locked, work fluidly
