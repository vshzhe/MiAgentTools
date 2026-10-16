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

