---
name: iagent_spec_apply
description: 实现变更。当 openspec/changes/ 下已有变更制品（proposal/specs/design/tasks），需要基于规格驱动实现任务清单时使用；用户直接描述需求而无变更制品时，应使用 iagent_workflow 引导生成变更制品后再实现。
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(iagent:*), Bash(npm:*), Bash(pnpm:*), Bash(node:*), Bash(git:*), Bash(tsc:*), Bash(mvn:*), Bash(ant:*), Bash(gradle:*), Bash(go:*), Bash(cargo:*), Agent, Task
license: MIT
compatibility: 依赖 iagent CLI（spec 命令组）。
metadata:
  author: mi-agent-tools
  version: "1.0"
  type: spec
  generatedBy: "snapshot"
  generatedFingerprint: "sha256:8f9bca90a151a2eae29841bf1e59ba6e18967fba5a7dcf008e7c7e6c611bd71f"
---

**Before implementing, read openspec/rules/ai-coding.md for AI coding guardrails.** Never guess database fields, API params, or business rules — mark as **[待确认]** and ask the user.

Implement tasks from a change's artifacts (proposal/specs/design/tasks) under openspec/changes/.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes. The workflow may also pass `auto-mode=true` to skip the design confirmation gate for automated execution.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `iagent spec status --json` to get available changes and use the **AskUserQuestion tool** to let the user select

   Always announce: "Using change: <name>" and how to override (e.g., `/iagent:spec-apply <other>`).

2. **Check status to understand the schema**
   ```bash
   iagent spec status --change "<name>" --json
   ```
   Parse the JSON to understand:
   - `schemaName`: The workflow being used (e.g., "spec-driven")
   - `planningHome`, `changeRoot`, and `actionContext`: planning scope and edit constraints
   - `progress`: total, complete, remaining task counts
   - Which artifact contains the tasks (typically "tasks" for spec-driven, check status for others)

   **Workspace guard:** If status JSON reports `actionContext.mode: "workspace-planning"` and `allowedEditRoots` is empty, explain that full workspace apply is not supported in this slice. Treat linked repos and folders as read-only context, ask the user to select an affected area through an explicit implementation workflow, and STOP before editing files.

   **Skipped artifacts handling:** If status reports any artifact with `skipped` state (the change declares `skip_specs`), do NOT treat it as missing — its dependencies are considered satisfied, and implementation proceeds normally for the remaining artifacts. Such artifacts are not flagged as incomplete in the `instruction` state returned by Step 3.

3. **Get task list and context files**

   **Primary path — iagent CLI `instructions apply` (preferred):**
   ```bash
   iagent spec instructions apply --change "<name>" --json
   ```
   Parse the JSON to obtain structured task context:
   - `contextFiles`: artifact → file path mapping (proposal/specs/design/tasks → their absolute or change-relative paths); use these as the authoritative file list instead of assuming standard file names
   - `progress`: total, complete, remaining task counts (used for progress display in Step 5)
   - `taskList`: structured task entries with checkbox state and group labels (used for batch planning in Step 5.5)
   - `instruction`: dynamic three-state directive:
     - `"blocked"`: artifacts missing or incomplete → suggest running `iagent_spec_verify` to complete artifacts first; STOP before implementing
     - `"ready"`: artifacts complete and tasks pending → proceed to Step 4 (read context files)
     - `"all_done"`: all tasks already complete → congratulate, suggest archive; STOP

   **Markdown artifact context (PRIMARY source for all new changes):**

   Read proposal.md, design.md, specs/**/*.md and tasks.md directly from the contextFiles returned by the CLI. Markdown is the only editable source of truth. Historical JSON-only changes may be read-only compatibility inputs and MUST emit a WARN; do not update them during apply.

   **Task state:** tasks.md checkboxes are authoritative. After completing a task, edit only its checkbox from `- [ ]` to `- [x]` after verifying the specified behavior. Do not create or update tasks.json and do not run a render command.

   **Fallback path (old CLI without `instructions apply`):**
   - Read proposal.md, specs/**/*.md, design.md and tasks.md directly.
   - Log a WARN stating the fallback reason.
   - Preserve the same Markdown-first semantics and task checkbox rules.
   **Handle states (both paths):**
   - If artifacts are missing (proposal/specs/design/tasks): show message, suggest using `iagent_spec_verify` to complete the artifacts first
   - If all tasks are already complete: congratulate, suggest archive
   - Otherwise: proceed to implementation

4. **Read context files**

   Follow the Markdown-first rule from Step 3 — read the structured sections directly:
   - **proposal.md**: Why and What Changes
   - **design.md**: Decisions, architecture and module dependencies
   - **specs/**/*.md**: delta requirements and scenarios
   - **tasks.md**: task list with checkbox status

   Throughout the remaining steps, proposal/design/specs/tasks refer to these Markdown artifacts.

5. **Show current progress**

   Display:
   - Schema being used
   - Progress: "N/M tasks complete"
   - Remaining tasks overview

**5.5. Design Confirmation Gate** ⚠️ MANDATORY

   After reading context files and BEFORE implementing any task, build the unified concurrent batch plan, present a design blueprint summary, and WAIT for user confirmation:

   **Auto-mode check**: If the apply was invoked with `auto-mode=true` (from workflow auto-apply context), skip the entire Step 5.5 confirmation gate — proceed directly to Step 6 (batch scheduling). The batch plan is still built internally for execution but is NOT presented to the user.

   **Build the unified concurrent batch plan first:**
   - The iagent CLI does not return a `batchPlan` — infer dependencies for all tasks from design.md (architecture layering, module dependencies); tasks with no dependency annotations are treated as independent within their group
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
   - After the user confirms the design (or when auto-mode is active) and BEFORE dispatching any batch, create a single temp workspace directory — **project-local first**: `.openspec-tmp/apply-<change-name>/` under the project root (build the path with path.join for cross-platform safety). Add `.openspec-tmp/` to the project's `.gitignore` if not already present, so the workspace never pollutes git status; leave the entry in place after cleanup for future runs. If the project root is not writable, fall back to the system temp directory named `iagent-apply-<change-name>/` and log a WARN stating the fallback location
   - ALL temporary files created during the flow (compile verification scripts, temporary configs, scratch outputs) MUST be placed inside this workspace — do NOT scatter temp files across the project directory
   - Create the workspace once at flow start and clean it up once at flow end — do NOT create or remove temp directories per task or per batch

6. **Implement tasks (batch scheduling loop until done or blocked)**

   **Shared context pack (flow-scoped, produced once):**

   - After the design is confirmed (or when auto-mode is active) and BEFORE the first dispatch, the coordinator produces ONE shared context pack at `context-pack.md` inside the flow-scoped temp workspace (`.openspec-tmp/apply-<change-name>/` under the project root, built with path.join) — produced ONCE before the first dispatch, NOT re-produced per batch and NOT re-produced per unit
   - The pack is the sub-agent's ONLY required artifact: each sub-agent reads the pack plus its own unit task list and nothing else from the change directory
   - After production the coordinator MUST NOT re-produce the whole pack — it only APPENDS to the pack's `## 已产出（跨单元可见）` section (see the post-batch step)
   - The pack has exactly six sections, in this order:
     - `## 变更摘要` — the change distilled from proposal.md (why/whatChanges): what this change does and why
     - `## 契约` — interface signatures / data structures / table fields, distilled from specs + design
     - `## 规范要点` — the key guardrails of `openspec/rules/ai-coding.md` distilled by the coordinator ONCE (never distilled by each sub-agent separately)
     - `## 文件归属表` — dispatch unit → the files that unit is allowed to modify
     - `## Codebase 摘要` — the coordinator's pre-scan conclusions (layering / dependency facts a sub-agent would otherwise re-derive)
     - `## 已产出（跨单元可见）` — the output ledger: produced files + public signatures, appended after each batch

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

   **Batch dispatch form determination (explicit, MANDATORY at the start of every batch):**
   - Batch contains **≥2** dispatch units → produce the shared context pack (if not yet produced) and dispatch sub-agents (see items 2–5)
   - Batch contains **<2** dispatch units → the coordinator implements the tasks directly itself, and MUST NOT produce the context pack (single-task batches never produce a pack)

   1. **Single-task batch**: implement the task directly yourself — do NOT dispatch a sub-agent and do NOT emit a concurrent-execution notice; indicate serial execution (single-task batch); show which task is being worked on, make the code changes required, keep changes minimal and focused
   2. **Multi-unit batch — concurrent state notice**: BEFORE dispatching a batch containing multiple dispatch units, output a prominent notice stating the batch position (Batch N/M), the number of sub-agents being dispatched (= the number of dispatch units), the task groups involved (the `group` labels of the batch's `dispatchUnits`; use task ids for units without a group label), and a reminder that task checkbox updates and failure retries are centrally managed by the coordinator
   3. **Pre-dispatch overlap check (cross-unit fallback)**: inspect the target files of the batch's tasks across dispatch units (from task descriptions, Spec Ref, and `产出:` declarations); tasks in different units that would modify the same file MUST be split out of the concurrent group and executed serially — tasks within one unit are implemented serially by the same sub-agent, so same-group files are never edited concurrently
   4. **Concurrent dispatch — one sub-agent per dispatch unit**: dispatch one sub-agent per remaining dispatch unit (Agent/Task tool); the unit's tasks are implemented by that sub-agent serially in task order; the number of simultaneously running sub-agents (dispatch units) within the batch MUST NOT exceed the concurrency limit; use sliding-window dispatch — as soon as one sub-agent finishes, immediately dispatch the next pending dispatch unit of the same batch
   5. **Sub-agent dispatch instruction MUST contain** (the shared instruction prefix first, then the unit-specific difference):
      - The context pack path — the sub-agent's ONLY required artifact (the pack lives in the flow-scoped temp workspace)；**MUST FIRST read the pack before any other action** — the pack carries the distilled contract / summary / file-ownership table so the sub-agent MUST NOT re-derive that information by re-reading proposal/specs/design or re-running CodeGraph queries already covered by the pack
      - A reference to the pack's `## 规范要点` section for the AI coding guardrails (never guess DB fields, API params, or business rules — mark **[待确认]**) — the instruction MUST NOT inline the full guardrail summary
      - The receipt format and the prohibition list (see the shared resource protocol below)
      - The dispatch unit's task list in order, with each task's full details (description, requirements, Spec Ref), and the instruction to implement the unit's tasks serially in that order — the task details MUST stay inline in the instruction so the sub-agent needs NO read of tasks.md
      - The source-file list relevant to the tasks — the change's artifact files (proposal/specs/design) are covered by the pack and MUST NOT be listed for re-reading
      - The temp workspace path, with the constraint: sub-agents ONLY write files into the workspace — they MUST NOT delete the workspace and MUST NOT run their own per-task temp directory creation/cleanup cycles
      - An explicit prohibition: **禁止修改 tasks.md** — the sub-agent MUST NOT edit task checkboxes
      - **⛔ EXIT GUARD (MANDATORY — 子代理退出守卫)**: 完成本单元分配的全部任务后 MUST **立即停止并提交回执**给编排器；MUST NOT enter plan mode / design mode / propose next steps / continue beyond the assigned task scope / suggest archiving or verification steps；唯一职责 = 实现本单元分配的任务清单、产出回执的四个字段并返回；编排器是唯一有权判停、汇总、推进阶段的角色——子代理 MUST NOT 越权替代编排器做阶段收尾决策
   6. **After the whole batch returns**: verify each sub-agent's result against the task requirements → update tasks.md centrally yourself (`- [ ]` → `- [x]`, only for confirmed-complete tasks) → append the batch's produced files and public signatures to the pack's `## 已产出（跨单元可见）` section → proceed to the next batch
   7. **Failed task**: retry the failed task serially yourself once → if the retry fails again, pause and report to the user (leave the task unchecked `- [ ]`)

   **Shared resource protocol — sub-agent duties and receipts:**

   - **Receipt (回执最小化)**: the sub-agent reports back with a fixed four-column receipt, one row per task — `<任务 id> | <状态> | <产出文件> | <公开签名>`. The receipt MUST NOT paste code bodies. A failed task's receipt MUST still carry a failure-reason summary.
   - 「公开签名」 definition: the signatures of the symbols in this unit's output that other units may reference — functions / methods / types / interfaces / exported constants / CLI commands, including their parameters and return types. If the unit exposes nothing referenceable, record 「无」.
   - **Empty values**: where the pack's `## 契约` section has no corresponding entry, record 「无」 in the pack and in the receipt's 公开签名 column. MUST NOT leave blank / MUST NOT fabricate.
   - **Shared instruction prefix**: every dispatch instruction is assembled in a fixed order — shared prefix (context pack path / `## 规范要点` reference / receipt format / prohibitions) → unit-specific difference (this unit's task list). The shared prefix MUST be byte-identical across every dispatch of the same flow.
   - **Prohibitions** (every dispatch instruction MUST carry them): the sub-agent MUST NOT re-read proposal/specs/design; the sub-agent MUST NOT re-run CodeGraph queries already covered by the pack. It MAY run supplementary queries for content the pack does not cover, but then the receipt MUST include a **包缺口回执** (what was missing, what was queried); the coordinator backfills the pack from it — if the backfill fails, log a WARN, and MUST NOT block implementation.
   - **Anti-hallucination**: the pack is a distilled view, NOT a substitute for the artifacts. When the pack lacks an item, the sub-agent MUST consult the artifact itself and MUST NOT guess fields or contracts.

   **Shared resource protocol — fail-safe degradation:**

   - If the temp workspace is not writable: fall back to the system temp directory first (`iagent-apply-<change-name>/`, the existing fallback); if that also fails, degrade as below
   - If the context pack cannot be produced, OR the project has no `openspec/rules/ai-coding.md`: degrade to the existing inline-injection behavior and log a WARN — MUST NOT block implementation. Degradation only makes the instruction longer; it NEVER drops a guardrail
   - `auto-mode=true` only skips the Step 5.5 design confirmation gate — the shared resource protocol MUST NOT be exempted by auto-mode and still applies

   **Environment fallback (no sub-agent capability):**
   - If the runtime provides no sub-agent dispatch tool (Task/Agent class tools), fall back to serial implementation of all tasks by yourself and inform the user of the fallback

   **Serial fallback (no dependency info):**
   - If Step 5.5 could not infer a batch plan from design.md (no dependency annotations available): keep serial behavior: for each pending task — show which task is being worked on, make the code changes, set the task checkbox to `- [x]` in tasks.md, continue to the next task

   **Task Output Handling Rules:**

   When implementing tasks, distinguish between **three** output types by task label:

   **Code Implementation** (tasks with `[代码]` label or unlabeled):
   - Create/modify files at the appropriate project source locations
   - Follow normal implementation flow

   **Test Code** (tasks with `[测试]` label):
       - **MUST implement inline** (NO delegation to an external skill) — the apply workflow directly owns test generation and MUST NOT delegate to `iagent_test` or any other skill；the entire test-writing logic runs inside the same sub-agent that implements the corresponding production code
       - **Framework detection**: detect the project’s test framework from build files (`pom.xml` → JUnit 4/5 + Mockito；`build.gradle` → JUnit 4/5 + Mockito；`package.json` → Vitest / Jest / Mocha) and structural cues (existing test files under `src/test/` or `test/`)；align with the EXISTING test style (annotations, assertions, naming conventions) — do NOT invent a new style
       - **Coverage scope** (minimum): ① spec scenarios — write one test per `#### Scenario:` referenced in the task’s `Spec Ref`；② BCDE boundaries — Boundary (min/max values, empty collections), Condition (null inputs, missing fields), Default (default-constructed objects, unset enums), Error (invalid inputs, exceptions thrown)；③ if any scenario is evaluated as untestable, record the verdict in the test file as a comment so “not written” stays distinguishable from “never evaluated”
       - **Test structure**: one test class per production class under test, named `<ClassName>Test` (Java) or `<className>.test.<ext>` (Node)；each test method covers ONE logical scenario with an `@Test` (JUnit) / `it(...)` (Vitest/Jest/Mocha) annotation；use the Arrange-Act-Assert (AAA) pattern
       - **Anti-pattern protection**: MUST NOT write tests that always pass (no assertions)、MUST NOT use `Thread.sleep()` for async (use `await` / `CompletableFuture`)、MUST NOT depend on test execution order (each test isolated)、MUST mock external dependencies (DB / HTTP / file I/O) with the framework’s mock library
       - Landing location follows the project’s test directory structure (e.g. `src/test/java/...`, `test/...`) — `[测试]` tasks MUST NOT be routed through the `产出:` → `attachments/` rule, because test code placed under `attachments/` cannot be executed
       - `[测试]` tasks MUST NOT be treated as supplement documents
       - Test tasks depend on their implementation tasks: when a test task’s subject behavior is implemented by another task, schedule the test task in a later batch — MUST NOT run it concurrently with its implementation task
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
   - If `compileCheck.enabled: false`, skip to Step 9 (test execution gate)

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
   - If all checks pass: proceed to Step 9 (test execution gate)

9. **Test Execution Gate** ⚠️ MANDATORY (only the change scope)
   - Runs AFTER the compile check (§8). Compile failure is a hard error; test failure is a different class of problem (pre-existing red tests, assertion mismatches, environment issues) — that is why the two gates are separate and MUST NOT be merged into one. §8 MUST keep its `-DskipTests`/`compile` semantics; this gate owns test execution.

   **9.1 Detect the test command** — from the same tech stack detected in §8.2:
   - Java-Maven: `mvn test` (scope by `-Dtest=...` when running selected classes)
   - Java-Gradle: `gradle test`
   - Java-Ant: `ant test`
   - TypeScript/Node: `pnpm test` / `npm test`
   - Go: `go test ./...`  |  Rust: `cargo test`
   - No test framework detected in the project → log a WARN, skip the gate, continue (non-blocking)

   **9.2 Determine the change scope** — the test set to run is:
   - Test files produced by this change's `[测试]` tasks (read their `Spec Ref` / file paths from `tasks.md`)
   - Existing test files that cover the files modified by this change (match by mirrored package path / naming convention, e.g. `UserServiceImpl` → `UserServiceImplTest`)

   **9.3 Run the change-scope tests** — execute only the scope from §9.2. Do NOT run the full suite as a pass/fail criterion.

   **9.4 Verdict**
   - **All in-scope tests pass** → record and proceed to §10
   - **Pre-existing failures OUTSIDE the change scope** → report as WARN only. These MUST NOT count as this change's failure and MUST NOT block the flow (projects with an already-red suite are common; a full-suite criterion would make this gate unusable and push users to bypass it)
   - **Failures INSIDE the change scope** → enter the failure-handling branch (§9.5)

   **9.5 In-scope failure handling**
   - Auto-fix and re-run, up to 3 attempts (same retry budget as §8.7). Distinguish: test code wrong → fix the test; production code defective → fix the implementation (per `openspec/rules/ai-coding.md`)
   - If failures remain after 3 attempts: pause and report to the user. MUST NOT mark the corresponding task `[x]`, MUST NOT proceed to archiving
   - If a test's expected behavior must be narrowed or simplified to pass → apply the scope-creep guard: mark **[待确认]**, explain the difference, ask the user

   **9.6 Test gate report** — summarize: scope covered, in-scope pass/fail counts, out-of-scope pre-existing failures (WARN), coverage figure if the coverage tool ran (see `iagent_test` §5.1)

10. **Unified temp workspace cleanup** ⚠️ MANDATORY
   - After BOTH the compile check (§8) and the test execution gate (§9) have finished — whether they passed, failed, or were skipped — delete the entire temp workspace in a single cleanup step
   - The cleanup scope INCLUDES the shared context pack and its output ledger (both live inside the temp workspace) — they are flow-scoped artifacts and MUST NOT be left behind
   - If the cleanup fails (file locked, permission denied): log a WARN with the workspace path so the user can remove it manually, and continue the flow without blocking

11. **Final status and archive suggestion**

   Display:
   - Compile check results summary
   - Test execution gate results summary
   - All tasks complete status
   - Suggest archiving the change via iagent spec archive "<name>" --yes (or the iagent_spec_archive skill)

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

All checks passed! You can archive this change via iagent CLI.
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
- ⚠️ **MANDATORY**: Execute Step 9 Test Execution Gate after the compile check — scope limited to the change (in-scope failures block; pre-existing out-of-scope failures are WARN only and MUST NOT block)
- ⚠️ **MANDATORY**: `[测试]` tasks MUST be implemented inline following the test generation rules (framework detection → style alignment → BCDE coverage → anti-pattern protection); MUST NOT be delegated to an external skill and MUST NOT be routed through the supplement-document `产出:` → `attachments/` rule (test code under attachments/ cannot run)

- ⚠️ **MANDATORY**: Sub-agent dispatch instruction MUST carry the EXIT GUARD (子代理退出守卫) — 完成分配任务后立即停止并返回回执，MUST NOT enter plan mode / design mode / propose next steps；编排器是唯一有权判停和推进阶段的角色
- ⚠️ **MANDATORY**: Sub-agent MUST FIRST read the context pack before any other action — MUST NOT re-read proposal/specs/design or re-run CodeGraph queries already covered by the pack；仅做增量查询
- ⚠️ **MANDATORY**: Parse compile errors and offer fix options before suggesting archive

**Fluid Workflow Integration**

This skill supports the "actions on a change" model:

- **Can be invoked anytime**: Before all artifacts are done (if tasks exist), after partial implementation, interleaved with other actions
- **Allows artifact updates**: If implementation reveals design issues, suggest updating artifacts - not phase-locked, work fluidly
