/**
 * tr_impl 类型技能模板：一站式调试工作流（复现→排查→关联判定→修复循环→编译→同步→验证）。
 * 编排层技能 —— 从复现到提案同步的一站式调试工作流，含 P1-P4 调试循环。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import {
    buildPromptGateBlock,
    buildPromptGateCompact,
    BUG_DIMENSIONS,
} from '../prompt-gate.js';
import {
    buildFlowchartBlock,
    buildFlowchartCompact,
    FAULT_CHAIN_FLOW_COLUMNS,
} from '../flowchart-gate.js';

/** 缺陷五维的提示词校验门全文（唯一源渲染，见 prompt-gate.ts） */
const PROMPT_GATE_BUG = buildPromptGateBlock(BUG_DIMENSIONS);

/** 缺陷五维的提示词校验门压缩版（斜杠指令正文复用） */
const PROMPT_GATE_BUG_COMPACT = buildPromptGateCompact(BUG_DIMENSIONS);

/** 缺陷链路版功能流程图制品全文（唯一源渲染，见 flowchart-gate.ts） */
const FLOWCHART_FAULT = buildFlowchartBlock(FAULT_CHAIN_FLOW_COLUMNS);

/** 缺陷链路版功能流程图压缩版（斜杠指令正文复用） */
const FLOWCHART_FAULT_COMPACT = buildFlowchartCompact(FAULT_CHAIN_FLOW_COLUMNS);

export function getTrImplDebugSkillTemplate(): SkillTemplate {
    return {
        name: 'venus_tr_impl_debug',
        description: '一站式调试工作流 reproduce→investigate root cause with CodeGraph and capability memory→change association→fix with mandatory regression test→compile check→synchronize proposal→verify；触发词"调试 / debug / 修复 bug / bug 报告 / 复现 / 根因"；NOT-for：新功能开发用 venus_tr_impl_feature、工作流编排用 venus_tr_impl_workflow',
        instructions: `**Before proceeding, read openspec/rules/ai-coding.md for AI coding guardrails.** In Phase 1 (Reproduce), follow Section 1 (Zero-Assumption). In Phase 4 (Fix), follow Section 3 (Data & Storage) when schema changes are involved. In Phase 6 (Synchronization), check Sections 2 (Design-First) for the confirmation gate.

One-stop debugging workflow from reproduction to proposal synchronization.

This workflow guides you through:
1. **Reproduction phase** - Failing test or explicit reproduction procedure as acceptance criterion
2. **Investigation phase** - Capability memory injection + CodeGraph root cause analysis + grill-with-docs discipline
3. **Change association phase** - Determine which change owns the bug (in-progress / new fix change / archived origin / non-defect)
4. **Fix phase** - Implement the fix with a mandatory regression test
5. **Debug Loop** - After each fix, ask user if there are more related bugs; if yes, repeat P1-P4; if no, proceed to unified P5-P7
6. **Compile check phase** - Reuse the venus_spec_apply skill's compile check conventions (covers all loop fixes)
7. **Synchronization phase** - Update the change's artifacts and persist all root cause analyses (covers all loop fixes)
8. **Verification phase** - Auto-fix loop on failure; on pass, deep review then requirement document generation (covers all loop fixes)

---

## Startup

**Input**: The argument after the command is the bug description (symptom, error message, or failing behavior).

- If a description is provided, record it and enter Phase 1
- If no description is provided, prompt the user: "Describe the bug: symptom, error message, and reproduction steps if known" — start only after a description is received

### 0. Prompt Validation Gate（缺陷五维，MANDATORY）

**⚠️ MANDATORY: 本门在 Phase 1 强制复现之前执行，不得跳过。**

**执行前置**：用户最初未提供 bug 描述、由本技能提示后补充的，以补充内容为原始提示词执行本门；**MUST NOT 对空输入执行校验**。

${PROMPT_GATE_BUG}

**本技能内的执行要求**：

- 门的位置固定在此处：记录 bug 描述之后、TodoWrite 初始化与 Phase 1 复现之前
- 缺陷版的「复现步骤」维与 Phase 1 的复现要求直接衔接：维度判定出的期望与实际在 Phase 1 成为复现的验收判据
- 不明确分支的确认门是**澄清门（确认 WHAT）**：用户确认或修改前 MUST NOT 进入 Phase 1，**MUST NOT 凭猜测编写失败测试**
- 校验结论（原始提示词 + 确认后的提示词基线）写入诊断记录的 \`## 提示词基线\` 段（Phase 6 随根因分析一并持久化到变更 exploration.md）

Use the **TodoWrite tool** to initialize tracking:
\`\`\`
[{"content": "Bug #1: Phase 1 复现", "status": "in_progress"},
 {"content": "Bug #1: Phase 2 排查定位", "status": "pending"},
 {"content": "Bug #1: Phase 3 关联变更判定", "status": "pending"},
 {"content": "Bug #1: Phase 4 修复 + 回归测试", "status": "pending"},
 {"content": "Phase 5: 编译检查 (汇总所有修复)", "status": "pending"},
 {"content": "Phase 6: 同步提案 (汇总所有修复)", "status": "pending"},
 {"content": "Phase 7: 验证 (覆盖所有修复)", "status": "pending"}]
\`\`\`

**Dynamic bug tracking**: When the debug loop continues to a new bug, append new entries to the TodoWrite list for that bug's P1-P4 phases. Mark each bug's phases as complete when they finish. For example:
\`\`\`
[{"content": "Bug #1: Phase 1 复现", "status": "completed"},
 {"content": "Bug #1: Phase 2 排查定位", "status": "completed"},
 {"content": "Bug #1: Phase 3 关联变更判定", "status": "completed"},
 {"content": "Bug #1: Phase 4 修复 + 回归测试", "status": "completed"},
 {"content": "Bug #2: Phase 1 复现", "status": "in_progress"},
 {"content": "Bug #2: Phase 2 排查定位", "status": "pending"},
 ...]
\`\`\`

---

## Phase 1: Reproduce (复现)

**⚠️ MANDATORY: The bug must be reproduced before any code is modified.**

The reproduction is the acceptance criterion for the fix — do not skip it.

### 1.1 Reproduce via failing test (preferred)

- Locate or write a test that demonstrates the bug
- Run the test and confirm it FAILS for the reported reason (not an unrelated setup error)
- Record: test file path, test name, expected vs. actual outcome

### 1.2 Reproduce via explicit procedure

When the bug cannot be captured by an automated test (e.g., environment-specific behavior, timing, UI-only):

- Record an explicit reproduction procedure: numbered steps, inputs, expected outcome, actual outcome
- Present the procedure to the user and confirm it matches the observed behavior
- No fix is applied until the reproduction is confirmed

**Checkpoint Enforcement**:
- If reproduction cannot be established, report this to the user with what was attempted — do NOT proceed to fixing an unreproducible bug on assumption (Zero-Assumption Policy)
- If the reported behavior cannot be triggered at all, go to Phase 2 and investigate whether this is a non-defect (expected behavior)

Update the diagnosis record (a scratch section in your working notes, later persisted in Phase 6) with the reproduction evidence.

---

## Phase 2: Investigate Root Cause (排查定位)

**⚠️ MANDATORY: Inject capability memory and apply grill-with-docs discipline during investigation.**

### 2.1 Capability exploration memory injection

1. Infer the capability (module) the bug belongs to from the affected code and the bug description
   - Scan \`openspec/specs/\` directory names with the Glob tool and match against the affected area
2. For each involved capability \`<capability>\`, check if \`openspec/specs/<capability>/explorations.md\` exists (use \`path.join()\`)
3. If it exists: read it and inject historical Decisions, terminology, and boundary scenarios into the investigation context
   - Sections marked \`已过时（由 <change-name> 取代）\` serve as historical reference ONLY — the superseding change's decisions are current
   - Historical boundary scenarios are frequent root-cause leads: the bug may be a known edge case that was consciously accepted
4. If no memory file exists: log "无能力级探索记忆 — 全新排查" and proceed

### 2.2 CodeGraph 排查（分层结构）

Adapt the workflow's CodeGraph query system (status check → file scan → symbol + context → call chain + impact → explore + deep-dive) to the debug investigation context. Record all findings to the diagnosis record in real time (after EACH query step, not batched at the end) so Phase 6 can persist the full investigation path.

#### 2.2.0 Status 预检（强制首动作与硬回退）

**MUST run \`codegraph_status\` as the FIRST action of Phase 2.** Until \`codegraph_status\` returns unavailable, you MUST NOT use Grep or Glob for symbol/file investigation — the \`codegraph_*\` tools (2.2.1–2.2.4) are the primary path, not an optional one.

- If initialized (files/nodes > 0): proceed with the CodeGraph tools in 2.2.1–2.2.4
- If \`codegraph_status\` confirms unavailable (uninitialized, error, or tool not mounted): ONLY THEN fall back to Glob (file structure) and Grep (symbol search), record "CodeGraph unavailable — used Glob/Grep fallback" in the diagnosis record

Grep/Glob is a **last resort**, permitted ONLY after \`codegraph_status\` confirms unavailability — never as a shortcut to skip CodeGraph. The fallback MUST NOT block the investigation, but it MUST NOT be taken before the availability check runs.

#### 2.2.1 文件结构扫描（codegraph_files）

- Scan the project file tree with \`codegraph_files\` to identify directories and files relevant to the bug description
- Write findings to the diagnosis record Codebase Findings > Discovered Files as "<file-path>: <relevance-reason>"
- All file paths MUST be constructed with \`path.join()\` for cross-platform compatibility (Windows/macOS/Linux) — never hardcode slashes
- Fallback (when CodeGraph unavailable): Glob for file structure discovery

#### 2.2.2 符号定位与任务级上下文（codegraph_search + codegraph_context）

- \`codegraph_search\` — locate the symbols involved in the failing behavior; record "<symbol-name> (<file-path>:<line>): <reason>" to Codebase Findings > Identified Symbols
- \`codegraph_context --task <bug-description>\` — build comprehensive task-level context around the bug (aggregating entry points, related symbols, key code), turning the bug description into a scoped investigation context
- Fallback (when CodeGraph unavailable): Grep for symbol search

#### 2.2.3 调用链追踪与爆炸半径（codegraph_callers / codegraph_callees / codegraph_impact）

- \`codegraph_callers\` / \`codegraph_callees\` — trace the call chain around the suspected code (upstream callers and downstream callees)
- \`codegraph_impact\` — assess the blast radius of the suspected defect AND of the candidate fix
- Record call chains (ASCII diagrams when helpful) and affected symbols in the diagnosis record for root cause confirmation

#### 2.2.4 深度探索与根因深度分析（条件触发）

**Trigger**: when the regular CodeGraph queries above (2.2.1–2.2.3) cannot locate a single high-confidence root cause (multiple candidates or insufficient confidence). When a high-confidence root cause is already located, SKIP this section to keep simple bugs on a lightweight path.

When triggered:
- \`codegraph_explore\` — deep exploration of the suspected code area
- 6-dimension root cause deep analysis (adapted from workflow Implementation Deep-Dive, repositioned for root cause localization — the root cause often hides in WHY the code was designed this way):
  - **Design Rationale** — why the code was designed this way (code comments, docstrings, ADRs) — root cause may be a violated design intent
  - **Constraints** — hard constraints that shaped the code (config files, linter rules) — root cause may be a constraint that no longer holds
  - **Trade-offs** — multi-option trade-offs consciously accepted (TODO/FIXME/HACK comments) — root cause may be a trade-off that failed under new conditions
  - **Pattern Usage** — design patterns in use (class/interface structure) — root cause may be a pattern misuse
  - **Historical Context** — design evolution (\`git log --follow\`, \`git blame\`) — root cause may be a consciously accepted historical edge case (cross-reference capability memory boundary scenarios)
  - **Implicit Assumptions** — undocumented assumptions (type guards, default values, missing null checks) — root cause frequently hides here
- Write findings to the diagnosis record Implementation Deep-Dive section; dimensions with no findings are marked "<!-- No findings -->"
- Connects to the 2.4 root cause confirmation gate: multiple candidates → STOP and let the user choose; deep-dive insights assist confirmation

#### 记录规范（所有子节共用）

All CodeGraph findings (Discovered Files / Identified Symbols / call chains / blast radius / Implementation Deep-Dive) MUST be structured into the diagnosis record's corresponding subsections and updated in real time after EACH query step (not batched at the end of the investigation). When CodeGraph is unavailable and the Glob/Grep fallback is used, findings still follow the same structure with the fallback noted — investigation traceability MUST NOT be lost due to fallback.

### 2.3 Grill-with-docs discipline during investigation

Apply the full discipline while narrowing down the root cause:

- **One question at a time**: when input from the user is needed, ask a single question and wait
- **Terminology sharpening**: each time a term is resolved during the investigation, write it to \`openspec/CONTEXT.md\` NOW (not deferred). Format: \`**<Term>**: <definition>\n_Avoid_: <synonyms>\`
- **Real-time record updates**: update the diagnosis record (root cause hypothesis, evidence, boundary scenarios) after EVERY questioning exchange — not batched at the end

### 2.4 Root cause confirmation gate (Zero-Assumption)

- **Single high-confidence root cause**: present it with code evidence (call chain, affected symbols, reproduction link), get user acknowledgment, then proceed to Phase 3
- **Multiple candidates or insufficient confidence**: STOP. Present the candidate list with per-candidate evidence and your recommendation. No code is modified until the user selects a candidate
- **Investigation concludes non-defect**: the reported behavior is intended — exit to the non-defect branch (Phase 3.5)

### 2.5 缺陷链路图与流程最终确认门 (MANDATORY CHECKPOINT)

**⚠️ MANDATORY: 根因确认门（2.4）通过后必须强制产出缺陷链路图，并经流程最终确认门确认后才进入 Phase 3。**

触发点：2.4 根因确认门通过（单一高置信根因）之后、Phase 3 关联变更判定之前——异常与根因节点须待根因确认后方可知，故本步骤不得前移。经确认的缺陷链路是 Phase 3 / Phase 4 的**验证口径来源**。

${FLOWCHART_FAULT}

**本技能内的执行要求**：

- **节点范围只覆盖缺陷链路**：前置条件 → 触发 → 异常 → 根因；**MUST NOT 展开被测功能的完整业务流程**（区别于需求版的全流程覆盖，避免与 Phase 1 复现步骤重复）
- **标记**：异常现象节点 MUST 标 \`🔴异常\`、根因节点 MUST 标 \`🟠根因\`，其余节点以 "—" 占位
- **证据追溯**：每节点 MUST 填证据位置（\`文件:行\` 或 类.方法）；无法追溯证据的节点 MUST NOT 进入清单
- **落盘位置**：诊断记录新增的 \`## 功能流程（缺陷链路）\` 段，Phase 6 随根因分析一并持久化到变更 exploration.md
- **四出口确认门**：呈现缺陷链路图与节点清单后停止等待确认，出口四条（确认 / 修改 / 拒绝后记录未确认状态并按原理解继续 / 显式授权按推断继续），**MUST NOT 反复要求确认或陷入等待死锁**
- **验证口径**：修复方案与回归测试 MUST 覆盖该链路的「异常节点 + 根因节点」（见 4.1 / 4.2）；仅覆盖触发节点而未覆盖根因节点时，验证不通过

---

## Phase 3: Change Association Determination (关联变更判定)

Determine which change owns the bug BEFORE fixing.

### 3.1 Bug originates from an in-progress change

- The affected code belongs to a change under \`openspec/changes/\` (not archived)
- → The fix updates THAT change; Phase 4–7 operate on it

### 3.2 Independent bug (no owning change)

- The bug is not attributable to any in-progress change
- → Create a new change named \`fix-{module}-<topic>\` following the change naming convention:
\`\`\`bash
venus spec new "fix-<module>-<topic>"
\`\`\`
- The fix proceeds under the new change

### 3.3 Bug originates from an archived change

- The affected code belongs to a change under \`openspec/changes/archive/\`
- → **NEVER modify the archived directory** — archives are historical fact
- Create a new change and reference the original archived change name in the new change's proposal for traceability

### 3.5 Non-defect exit (诊断报告收尾)

When Phase 2 concluded the behavior is intended:

- Output a diagnosis report: symptom, investigation path, code/test evidence proving intended behavior
- Do NOT create a change and do NOT modify code
- Persist the diagnosis record and inform the user of the conclusion — workflow ends here

---

## Phase 4: Fix (修复)

Implement the fix following the venus_spec_apply skill's task execution norms.

### 4.1 Fix implementation

- Follow \`openspec/rules/ai-coding.md\` (Zero-Assumption, minimal changes, layering)
- Keep the change surgical: every changed line must trace to the root cause
- If the fix requires database/schema changes, output the DDL separately and request explicit confirmation before applying (per guardrails)
- If implementation reveals a design issue, pause and suggest updating the change's artifacts rather than silently deviating
- **验证口径（2.5）**：修复方案 MUST 覆盖该缺陷链路的**「异常节点 + 根因节点」**；仅覆盖触发节点而未覆盖根因节点时，视为修复未完成

### 4.2 Mandatory regression test

- Add (or confirm the Phase 1 test serves as) a regression test that:
  - FAILS before the fix
  - PASSES after the fix
- Add a corresponding task to the change's tasks.md if it is not yet listed
- Run the reproduction from Phase 1 and confirm it now passes
- **回归测试验证口径（2.5）**：回归测试 MUST 覆盖该缺陷链路的**「异常节点 + 根因节点」**；仅覆盖触发节点而未覆盖根因节点时，验证不通过

### 4.3 Debug Loop Confirmation (调试循环确认)

After each fix is complete, ask the user:

> "还有相关 bug 需要修复吗？"
> [有 - 继续修复下一个] [没有 - 进入收尾阶段]

**If user responds "有"**:
- Record the current bug as completed in TodoWrite
- Ask the user to describe the next bug
- Re-enter Phase 1 for the new bug (independent reproduction, investigation, and fix)
- Update TodoWrite: append new Bug #N entries for the new bug's P1-P4 phases

**P3 Simplified for subsequent bugs**:
- Default: the new bug is fixed under the same change (current change from the first bug's Phase 3)
- Present the default association to the user for acknowledgment
- If the user declares this bug should be a separate change:
  - Finalize the current change (enter Phase 5-7 for accumulated fixes)
  - Inform the user: "请用 \`/venus:tr-impl-debug\` 单独处理这个独立 bug"
  - Do NOT create a new change automatically

**Non-defect in loop**: If Phase 2 concludes a bug in the loop is non-defect (expected behavior):
- Follow the non-defect exit path (output diagnosis report, no code change, no change creation)
- Continue the loop: ask "还有相关 bug 需要修复吗？" — the non-defect bug does NOT block other bugs

**Mid-loop exit**: If the user wants to exit the loop during any phase (P1-P4) of a subsequent bug:
- Discard the incomplete current bug's work
- Preserve all previously completed fixes
- Proceed directly to Phase 5-7 for the accumulated fixes

**Long loop advisory**: If the loop reaches 5 or more iterations, advise the user:
> "已连续修复 5 个 bug。建议检查是否应拆分为独立 change。"
- Do NOT force termination — the user decides whether to continue

**If user responds "没有"**:
- Proceed to Phase 5 — all accumulated fixes will be covered by unified compile check, synchronization, and verification

---

## Phase 5: Compile Check (编译检查) — 汇总所有修复

遵循 venus_spec_apply 技能的编译检查约定（Step 8）。This phase runs ONCE covering ALL bugs fixed in the loop.

### 5.1 Load configuration

- Read \`openspec/config.yaml\` for \`compileCheck\` settings
- If \`compileCheck.enabled\` is false or the section is not configured (defaults to disabled), skip to Phase 6

### 5.2 Execute checks

- Detect the tech stack from \`config.yaml\` context (TypeScript, Java, Go, Rust, ...)
- Classify changed files into backend (TypeScript/Java/Go/Rust) and frontend (JSP/Vue/React)
- Execute the compile command per tech stack:
  - TypeScript: \`tsc --noEmit\` or \`pnpm run build\`
  - Java-Maven: \`mvn compile -DskipTests\`
  - Java-Gradle: \`gradle compileJava\`
  - Go: \`go build ./...\`
  - Rust: \`cargo build\`

### 5.3 Auto-fix loop

- If \`autoFix.enabled\` is true: classify issues by fixability, apply fixes to change-scope files, re-run checks (up to \`maxRetries\`, default 3)

### 5.4 Report

- Summarize results (compile, lint, frontend) with fixed vs. remaining issues
- Remaining failures are REPORTED to the user — never proceed silently past a failing check

---

## Phase 6: Synchronize Proposal (同步提案) — 汇总所有修复

**⚠️ MANDATORY: After all fixes in the loop, the change's artifacts must reflect ALL implemented fixes.**

### 6.1 Update artifacts

- **proposal.md**: add root causes and fix descriptions for ALL bugs in the loop (under What Changes, organized per bug)
- **tasks.md**: check off completed tasks for all fixes; add regression test tasks for each bug if missing
- **design.md**: update when any fix changed a documented decision
- **specs/**: update delta specs when any fix changes documented behavior (use \`#### Scenario:\` with WHEN/THEN)

### 6.2 Persist root cause analysis

- Write the full diagnosis records for ALL bugs (prompt baseline, reproduction, investigation path, evidence, root cause, chosen fix rationale) to the change directory's \`exploration.md\`, organized per bug — the \`## 提示词基线\` section is included so the change retains the user-confirmed semantics source, and the \`## 功能流程（缺陷链路）\` section (2.5) carries the confirmed fault chain and node list

### 6.3 Artifact format validation

After synchronization, validate that the update did not break artifact format:

- proposal.md retains required sections: Why, What Changes, Capabilities, Impact
- Delta specs keep the \`#### Scenario:\` format (4 hashtags) with WHEN/THEN structure
- tasks.md keeps the \`- [ ] X.Y\` / \`- [x] X.Y\` checkbox format

Fix any format violation before proceeding — synchronization must not corrupt the artifacts.

Proceed to Phase 7 only after artifacts reflect all implemented fixes.

---

## Phase 7: Verification (验证) — 覆盖所有修复

### 7.1 Invoke the verification skill

Execute verification by **invoking the \`venus_spec_verify_proposal\` skill** (via the Skill tool) for change \`<name>\`:

- \`venus_spec_verify_proposal\` is a SKILL name, NOT a valid \`venus spec instructions\` artifact ID — do not run it as a CLI instruction
- The skill performs D1–D9 scoring by reading the artifacts and exploration.md

**Fallback (skill unavailable)**: If the skill is not installed or its invocation fails, fall back to AI inline reading of the artifacts with manual D1–D9 scoring, and emit WARN: "venus_spec_verify_proposal skill unavailable, degraded to inline scoring". Do NOT silently skip verification.

### 7.2 Verification FAIL → auto-fix loop

When ANY dimension scores below the threshold (<90%):

- Do NOT generate the requirement document while verification fails
- Auto-generate specific fix suggestions for each failed dimension (e.g., missing boundary scenario → add scenario to spec)
- Apply the fixes to the artifact files
- Auto re-run verification after fixes are applied
- Display a fix summary ("Auto-Fix Applied — Re-running verification...")
- If the re-run still fails: present remaining issues with options — [1] Manual edit, [2] Return to exploration, [3] View detailed diff report. **No skip-to-apply path.**

### 7.3 Verification PASS → deep review + requirement document generation

After verification passes:

1. **Auto-invoke the \`venus_tr_impl_review_proposal\` skill** (via Skill tool) for a deep read-only review of the proposal (a deep consistency and coverage audit beyond the D1–D9 scoring). The review runs automatically (no [Yes/No] prompt). User MAY interrupt to skip; otherwise it runs.
   - **Fallback (skill unavailable)**: If the skill is not installed or its invocation fails, fall back to AI inline read-only deep review with a WARN: "venus_tr_impl_review_proposal skill unavailable, degraded to inline review". Do NOT silently skip the deep review.
2. **Auto-invoke the \`venus_tr_docs_requirement_doc\` skill** (via Skill tool) in **non-interactive mode**:
   - Markdown format, placeholder basic information (需求编号/需求名称/交付时间 as placeholders)
   - Do NOT ask the user any questions
   - Output: \`openspec/changes/<change-name>/需求文档.md\`
   - Display the generated document path to the user
3. **Failure handling**: if requirement document generation fails or is interrupted, log WARN with the reason and CONTINUE — the user can re-run the skill standalone later

---

## Output

\`\`\`
## Debug Workflow: <change-name or diagnosis-only>

### Loop Summary
- Total bugs fixed: N
- Non-defect findings: M (diagnosis only)

### Per-Bug Summaries

#### Bug #1: <one-line summary>
- Phase 1: Reproduction: <failing test / procedure> — confirmed ✗/✓
- Phase 2: Root cause: <one-line summary>, Evidence: <call chain / symbols>
- Phase 3: Association: <in-progress change / new fix-{module}-<topic> / archived origin (traced)>
- Phase 4: Fix: <summary>, Regression test: <test reference> — passes ✓

#### Bug #2: <one-line summary>
- ...

### Phase 5: Compile Check (汇总所有修复)
- Compile check: PASS / FAIL(n issues) / SKIPPED(disabled)

### Phase 6: Synchronization (汇总所有修复)
- Artifacts updated: proposal / tasks / design / specs
- All root causes persisted to exploration.md ✓
- Format validation: PASS

### Phase 7: Verification (覆盖所有修复)
- Score: XX% — PASS/FAIL
- Deep review: completed ✓ / WARN (reason)
- Requirement document: openspec/changes/<change-name>/需求文档.md ✓ / WARN (reason)

Ready for \`/venus:spec-apply\` (fixes already applied) or archive.
\`\`\`

---

## Guardrails

- **Validate the bug report before reproducing**: Startup 段的提示词校验门（缺陷五维）是强制前置——清晰描述一句话复述理解后直通；含糊描述须先做提示词优化并等待用户确认或修改，未确认前 MUST NOT 进入 Phase 1，不得凭猜测编写失败测试
- **Don't deadlock on the confirmation gate**: 确认门有四条出口（确认 / 修改 / 拒绝后按原理解继续 / 显式授权按推断继续），不得反复要求确认
- **Do persist the prompt baseline**: 原始提示词与确认后的基线写入诊断记录 \`## 提示词基线\` 段，Phase 6 随根因分析一并持久化
- **MUST produce the fault chain diagram**: 2.5 在根因确认门（2.4）通过后强制产出诊断记录 \`## 功能流程（缺陷链路）\` 段（Mermaid + 节点清单表），节点**只覆盖缺陷链路**（前置条件 → 触发 → 异常 → 根因），异常节点标 \`🔴异常\`、根因节点标 \`🟠根因\`；MUST NOT 展开被测功能的完整业务流程
- **Don't deadlock on the flowchart gate**: 2.5 确认门有四条出口（确认 / 修改 / 拒绝后记录未确认状态并按原理解继续 / 显式授权按推断继续），不得反复要求确认
- **Fix and regression test cover the exception and root cause nodes**: 修复方案与回归测试 MUST 覆盖缺陷链路的「异常节点 + 根因节点」（4.1 / 4.2）；仅覆盖触发节点而未覆盖根因节点时，验证不通过
- **Reproduce first**: no fix without a confirmed reproduction (failing test or user-confirmed procedure) — applies to EVERY bug in the loop
- **Zero-assumption**: multiple candidate root causes → STOP and let the user choose; never guess
- **Archives are read-only**: never modify \`openspec/changes/archive/\`
- **Regression test mandatory**: every fix ships with a test that failed before and passes after — applies to EVERY bug in the loop
- **Proposal sync mandatory**: artifacts must reflect ALL implemented fixes before verification
- **Verification never skipped**: skill → inline fallback with WARN; FAIL → auto-fix loop with no skip path; PASS → deep review (skill → inline fallback with WARN) then requirement document
- **Loop non-defect non-blocking**: non-defect findings in the loop do NOT block other bugs — record diagnosis and continue
- **Loop exit preserves completed work**: exiting mid-loop preserves completed fixes, discards incomplete current bug
- **Independent change separation**: when user declares a bug needs a separate change, finalize current change and prompt separate debug
- **Use \`path.join()\`** for all file paths (cross-platform: macOS/Linux/Windows)
- **Terminology in real time**: resolved terms go to CONTEXT.md immediately during investigation`,
        allowedTools: 'Read, Write, Edit, Glob, Grep, Bash(venus:*), Bash(npm:*), Bash(pnpm:*), Bash(node:*), Bash(git:*), Bash(codegraph:*), Bash(tsc:*), Bash(mvn:*), Bash(gradle:*), Bash(go:*), Bash(cargo:*)',
        type: 'tr_impl',
        license: 'MIT',
        compatibility: '依赖 venus CLI（spec 命令组）与 venus_spec_verify_proposal / venus_tr_docs_requirement_doc 技能；CodeGraph MCP 可选（不可用时降级 Glob/Grep）。',
        metadata: { author: 'venus-agent-tools', version: '1.0' },
    };
}

export function getTrImplDebugCommandTemplate(): CommandTemplate {
    return {
        name: 'Venus: 调试工作流',
        description: '一站式调试：复现 → CodeGraph 排查定位 → 关联变更判定 → 修复+回归测试（调试循环）→ 编译检查 → 同步提案 → 验证',
        category: 'Venus / 实现',
        tags: ['venus', 'tr_impl', 'debug', 'bug-fix', 'root-cause', 'regression'],
        content: `**Before proceeding, read openspec/rules/ai-coding.md for AI coding guardrails.**

One-stop debugging workflow from reproduction to proposal synchronization, with P1-P4 debug loop for multiple bug fixes.

**Input**: The argument after this command is the bug description (symptom, error message, or failing behavior). If omitted, prompt the user to describe the bug before starting.

**门 0 — Prompt Validation Gate（缺陷五维，MANDATORY）**: 记录 bug 描述之后、Phase 1 复现之前强制自检。用户未提供描述、由技能提示后补充的，以补充内容为原始提示词（不对空输入校验）。

${PROMPT_GATE_BUG_COMPACT}

用户确认或修改前 MUST NOT 进入 Phase 1，不得凭猜测编写失败测试。校验结论（原始提示词 + 确认后的基线）写入诊断记录 \`## 提示词基线\` 段，Phase 6 随根因分析持久化到变更 exploration.md。

Use the **TodoWrite tool** to initialize tracking for each bug's phases. Append new Bug #N entries for each additional bug in the loop.

---

## Phase 1: Reproduce (复现) — MANDATORY

Reproduce the bug BEFORE any fix:
- Preferred: locate/write a failing test and confirm it fails for the reported reason
- Otherwise: record an explicit reproduction procedure (steps, expected vs. actual) and confirm it with the user
- No fix is applied until reproduction is confirmed (Zero-Assumption Policy)

## Phase 2: Investigate Root Cause (排查定位)

1. **Capability memory injection**: infer the capability from the affected code; read \`openspec/specs/<capability>/explorations.md\` if it exists and inject historical Decisions/terminology/boundary scenarios (superseded sections are historical reference only). No file → log and proceed.
2. **CodeGraph investigation (layered, adapted from workflow)**:
   - \`codegraph_status\` 预检（**强制首动作**）— MUST run FIRST; until it returns unavailable, MUST NOT use Grep/Glob for symbol/file investigation; only after it confirms unavailable → fall back to Glob/Grep + record "CodeGraph unavailable" (last resort, not a shortcut to skip CodeGraph)
   - \`codegraph_files\` scan file structure → Discovered Files (paths via \`path.join()\` for cross-platform)
   - \`codegraph_search\` + \`codegraph_context --task <bug>\` — locate symbols + task-level context → Identified Symbols (file:line)
   - \`codegraph_callers\`/\`codegraph_callees\` + \`codegraph_impact\` — call chain + blast radius of defect and candidate fix
   - \`codegraph_explore\` + 6-dim root cause deep analysis (Design Rationale/Constraints/Trade-offs/Pattern/Historical Context/Implicit Assumptions) — **条件触发**: only when regular queries can't locate a single high-confidence root cause; skip for simple bugs. Historical Context uses \`git log --follow\`/\`git blame\`.
   - All findings recorded to diagnosis record in real time (Codebase Findings / Implementation Deep-Dive); Glob/Grep fallback keeps the same structure with fallback noted
3. **Grill-with-docs discipline**: one question at a time; resolved terms written to \`openspec/CONTEXT.md\` immediately; diagnosis record updated after every exchange.
4. **Confirmation gate**: single high-confidence root cause → present evidence, get acknowledgment. Multiple candidates → STOP, present candidates + evidence + recommendation, user chooses. Non-defect → Phase 3.5.

## 2.5 缺陷链路图与流程最终确认门 (MANDATORY)

**⚠️ MANDATORY: 根因确认门（2.4）通过后强制产出缺陷链路图，并经流程最终确认门确认后才进入 Phase 3。** 异常与根因节点须待根因确认后方可知，故本步骤不得前移。

${FLOWCHART_FAULT_COMPACT}

**节点范围只覆盖缺陷链路**（前置条件 → 触发 → 异常 → 根因），MUST NOT 展开被测功能的完整业务流程；异常节点标 \`🔴异常\`、根因节点标 \`🟠根因\`；落盘为诊断记录新增的 \`## 功能流程（缺陷链路）\` 段，Phase 6 随根因分析一并持久化到变更 exploration.md。确认后的缺陷链路是 Phase 3 / Phase 4 的**验证口径来源**——修复方案与回归测试 MUST 覆盖「异常节点 + 根因节点」。确认门四出口不得死锁。

## Phase 3: Change Association (关联变更判定)

- In-progress change (\`openspec/changes/\`) → fix updates that change
- Independent bug → create \`fix-{module}-<topic>\` change (\`venus spec new\`)
- Archived change → NEVER modify the archive; create a new change and reference the archived name for traceability
- Non-defect → output diagnosis report with evidence, persist the record, no change, no code modification — workflow ends

## Phase 4: Fix (修复)

- Follow ai-coding.md (zero-assumption, minimal changes); schema changes need separate DDL confirmation
- **Mandatory regression test**: fails before the fix, passes after; add to tasks.md if missing; re-run the Phase 1 reproduction
- **验证口径（2.5）**: 修复方案与回归测试 MUST 覆盖缺陷链路的「异常节点 + 根因节点」；仅覆盖触发节点而未覆盖根因节点时，验证不通过

## Debug Loop (调试循环确认)

After each fix, ask: "还有相关 bug 需要修复吗？" [有] [没有]

- **有**: record completed bug, describe next bug, re-enter P1-P4. P3 simplified: default to current change, user may declare independent change (→ finalize current change, prompt separate debug). Non-defect in loop → record diagnosis, continue loop. Mid-loop exit → preserve completed fixes, discard incomplete, proceed to P5-P7. After 5+ iterations, advise checking whether to split changes (do NOT force).
- **没有**: proceed to P5 — unified compile check, synchronization, and verification cover ALL accumulated fixes

## Phase 5: Compile Check (编译检查) — 汇总所有修复

- Read \`openspec/config.yaml\` \`compileCheck\` settings; skip when disabled or unconfigured
- Execute compile per detected tech stack; run the auto-fix loop when \`autoFix.enabled\`
- Report remaining failures — never proceed silently
- Covers ALL files modified across all bug fixes in the loop

## Phase 6: Synchronize Proposal (同步提案) — 汇总所有修复

- Update proposal.md (root causes + fixes for ALL bugs), tasks.md (checkboxes + regression tasks for each bug), design.md and delta specs when behavior changed
- Persist ALL root cause analyses to the change's \`exploration.md\`, organized per bug
- Validate artifact format after sync: proposal keeps Why/What Changes/Capabilities/Impact; specs keep \`#### Scenario:\` + WHEN/THEN; tasks keep \`- [ ] X.Y\` checkboxes. Fix violations before Phase 7.

## Phase 7: Verification (验证) — 覆盖所有修复

- Invoke the \`venus_spec_verify_proposal\` **skill** (Skill tool — it is a skill name, not a valid \`venus spec instructions\` artifact ID). The skill performs D1–D9 scoring. Fallback: inline D1–D9 scoring + WARN, never silently skipped
- **FAIL**: do NOT generate the requirement document; auto-fix artifacts and re-run; still failing → [1] Manual edit [2] Return to exploration [3] View diff — no skip path
- **PASS**: auto-invoke the \`venus_tr_impl_review_proposal\` **skill** for a deep read-only review (fallback: inline review + WARN), then auto-invoke the \`venus_tr_docs_requirement_doc\` **skill** in non-interactive mode → \`openspec/changes/<change-name>/需求文档.md\`; on failure log WARN and continue

---

## Guardrails

- Validate the bug report first (Startup 的缺陷五维提示词校验门，含糊描述须优化并确认后才进入复现，不得凭猜测编写失败测试)；确认门四条出口不得死锁
- Reproduce first (every bug in loop); zero-assumption on root causes; archives read-only
- MUST produce the fault chain diagram (2.5 在根因确认门通过后强制产出诊断记录 \`## 功能流程（缺陷链路）\` 段；节点只覆盖前置条件 → 触发 → 异常 → 根因，异常节点标 \`🔴异常\`、根因节点标 \`🟠根因\`，MUST NOT 展开被测功能完整业务流程)；确认门四出口不得死锁
- Fix and regression test MUST cover the exception and root cause nodes of the confirmed fault chain (仅覆盖触发节点时验证不通过)
- Regression test mandatory (every bug in loop); proposal sync mandatory (all fixes); verification never skipped
- Loop non-defect non-blocking; loop exit preserves completed work; independent change → finalize + prompt separate debug (\`/venus:tr-impl-debug\`)
- Use \`path.join()\` for file paths (cross-platform)`,
    };
}
