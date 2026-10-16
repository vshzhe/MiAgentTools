/**
 * impl 类型技能模板：全自动工作流（探索→提案→验证→自动实现→自动归档）。
 * 编排层技能 —— 一站式全自动工作流，L1-L5 用户确认后全自动化。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { buildPromptGateBlock, REQUIREMENT_DIMENSIONS } from '../prompt-gate.js';
import { buildFlowchartBlock, REQUIREMENT_FLOW_COLUMNS } from '../flowchart-gate.js';
import { CODEGRAPH_MCP, SUBAGENT_DISPATCH, skillDelegation } from '../tool-whitelist.js';

/** 提示词校验门全文（写入 references/prompt-gate.md，AI 在 Gate 触发时按需读取） */
const PROMPT_GATE_FULL = buildPromptGateBlock(REQUIREMENT_DIMENSIONS);

/** 功能流程图全文（写入 references/flowchart-gate.md，AI 在流程生成时按需读取） */
const FLOWCHART_FULL = buildFlowchartBlock(REQUIREMENT_FLOW_COLUMNS);

export function getAutoWorkflowSkillTemplate(): SkillTemplate {
    return {
        name: 'iagent_auto_workflow',
        description: 'One-stop automated workflow exploration→proposal→verification→auto-apply→auto-archive, L1-L5 user confirmation then full automation; triggers: 全自动工作流 / auto workflow / fully automated pipeline. Use when the user wants a fully automated pipeline without manual apply/archive steps. NOT for interactive guided workflow (use iagent_workflow).',
        instructions: `
**适用 openspec/rules/ai-coding.md 全域护栏。** 未定义项标 **[待确认]**，禁止猜测。

One-stop automated workflow from exploration to archive.

This workflow guides you through:
1. **Exploration phase** - Persistent file + grill-with-docs questioning (L1-L5 user confirmation)
2. **Proposal phase** - Create change with all artifacts (automated)
3. **Verification phase** - Automatic quality check (automated)
4. **Auto-Apply phase** - Automatic implementation without confirmation gate
5. **Auto-Archive phase** - Automatic archiving on completion

## ⛔ GATE PROTOCOL — ACTIVE

This skill contains **CONFIRMATION GATES** marked with **⛔ GATE:**. Each gate is a HARD STOP:
- When you reach a ⛔ GATE, **YOUR RESPONSE ENDS THERE** — output the gate content, then STOP
- Do NOT execute, describe, or pre-generate steps beyond the gate
- The user's next message is the confirmation signal — resume from AFTER the gate only when they respond
- **VIOLATION**: executing beyond a gate without user confirmation is a critical error that corrupts the workflow

---
## Phase 1: Exploration（委派 iagent_spec_explore）

Phase 1 SHALL 经 Skill 工具委派 \`iagent_spec_explore\`（传 \`mode=delegated\`）执行强制 checkpoint 体系探索（强制建探索文件、提示词校验门、CONTEXT.md 检查、CodeGraph 基础扫描含多项目派发与深度分析、L1-L5 grill 追问、功能流程图与流程最终确认门、聚合一致性门、探索完成检测），MUST NOT 内联执行探索逻辑。

委派完成后 SHALL 消费 \`iagent_spec_explore\` 输出的**结构化 handoff**（探索文件路径、提示词基线、流程基准确认状态、Pending 影响符号）并据此推进 Phase 2。

**退出守卫**：被委派的 \`iagent_spec_explore\` 完成后 MUST NOT 自行进入提案或实现；阶段完成判定与推进主权归编排器。

## Phase 2: Proposal

**⚠️ AUTO-EXECUTE: This phase begins immediately after Phase 1 completion — no pause, no announcement, no user prompt. If you just completed Phase 1, your next action MUST be Phase 2 step 2.0 (impact analysis). Do NOT output a separate "Exploration Complete" message — continue directly into Phase 2 tool calls. If you ended a response before this point, resume with Phase 2 immediately.**

### 2.0 Impact Analysis (Auto-Execute)

If Pending section contains symbols, run impact analysis for each symbol:
\`\`\`bash
mcp__codegraph__codegraph_impact --symbol <symbol> --direction upstream
\`\`\`

**Parallel execution for multiple symbols**: When two or more impact symbols are identified, issue the impact queries in parallel (multiple tool calls in a single response round). Merge all results into the artifact impact sections; a single symbol keeps the existing single-query behavior.

**Results stored for**:
- \`proposal.md\` Impact: Impact Analysis section
- \`design.md\` Context: Architecture Impact section

### 2.1 提案生成（委派 iagent_spec_propose）

Phase 2 的探索文件迁移与全部制品生成 SHALL 经 Skill 工具委派 \`iagent_spec_propose\`（传 \`mode=delegated\` + \`exploration-file=<Phase 1 探索文件路径>\`）完成，MUST NOT 内联生成提案制品。委派完成后再进入 Phase 3 自动验证。

**退出守卫**：被委派的 \`iagent_spec_propose\` 完成后 MUST NOT 自行进入实现；阶段推进主权归 \`iagent_auto_workflow\`。

## Phase 3: Verification

**Phase 3 executes automatically after Phase 2 artifact generation completes. No user confirmation needed.**

### 3.1 Auto-Execute Verification

- Skip method-specific prompt — Do NOT show "Propose 方式一步生成" or similar
- Skip user choice — Do NOT ask [立即验证] / [跳过验证]
- Execute directly — Run D1-D5 verification automatically

### 3.2 Run Verification

- Invoke the \`iagent_spec_verify_proposal\` **skill** (via Skill tool) for D1-D5 scoring
- Fallback to AI inline scoring + WARN log if the skill is unavailable; never silently skip
- Calculate coverage rates and overall score (unified 90% threshold)
- Detect tech stack from config.yaml context

### 3.3 Handle Results

**PASS (≥90%)**:
- Auto-execute deep proposal review: invoke the \`iagent_proposal_review\` skill (via Skill tool) for deep review (no [Yes/No] prompt); fallback to AI inline deep review + WARN log if the skill is unavailable; never silently skip
- Display results alongside verification report
- **Converge — generate the requirement document**: after the deep review converges, invoke \`iagent_requirement_doc\` in non-interactive mode (via Skill tool) to generate the requirement document at \`openspec/changes/<change-name>/需求文档.md\`. The document is generated from the CURRENT artifacts (proposal/specs/design/tasks) before implementation begins — the user can review it during the apply phase. Generation failure is non-blocking (WARN log + continue). MUST NOT ask the user for document basic information
- **Auto-transition to Phase 4**: after requirement document generation completes (or fails), automatically enter Phase 4 (auto-apply)

**FAIL (<90%)**:
- Auto-generate fix suggestions and apply fixes
- Re-run verification automatically
- If still FAIL: [Manual edit] [Return to exploration] [View detailed diff] (no skip-to-apply path)

---
## Phase 4: Auto-Apply

**Phase 4 executes automatically after Phase 3 verification passes. No user confirmation needed — the apply runs with auto-mode=true to skip the design confirmation gate.**

### 4.1 Auto-Execute Apply

After verification passes (≥90%) and the deep review has converged:
- Announce: "## Auto-Apply Phase" with a clear header
- Display: "Verification passed — automatically entering apply phase"
- Construct the apply context with:
  - \`auto-mode=true\` — to skip the design confirmation gate (consistent with iagent_spec_apply: Input passes auto-mode=true; Step 5.5 confirmation gate is skipped in auto-mode, directly entering Step 6 batch scheduling)
  - \`change-name\` — the current change name from the workflow context
- Execute the apply workflow logic (following the iagent_spec_apply skill's Step 6+ batch scheduling behavior with auto-mode=true)
- **Inherit the dispatch protocol and shared-resource protocol of \`iagent_spec_apply\`** — Phase 4 inherits both protocols in full and reuses the same four carriers:
  - **shared context pack**（共享上下文包）— the single must-read artifact \`context-pack.md\` (six sections), produced once and appended per batch
  - **output ledger**（产出登记表）— the pack's \`## 已产出（跨单元可见）\` section, appended by the coordinator after each batch
  - **minimal receipt**（回执最小化）— the fixed four-column receipt \`<task id> | <status> | <output file> | <public signature>\`, with no code body pasted
  - **shared instruction prefix**（共享指令前缀）— the fixed order "shared prefix (pack path / spec-points reference / receipt format / prohibitions) → unit delta (task list)"
- Phase 4 **MUST NOT define a separate dispatch-instruction format or re-declare the protocol text** — the protocol's single source stays in \`iagent_spec_apply\`; this skill only references it
- \`auto-mode=true\` **only** skips the design confirmation gate — the shared-resource protocol stays in effect (auto semantics MUST NOT waive it)
- All apply tasks are implemented automatically with the existing batch scheduling

### 4.2 Auto-Apply Error Handling

- **Compile check fails** (after 3 auto-fix attempts): pause and wait for user instructions — do NOT proceed to archive
- **Sub-agent fails**: auto-retry once; if retry fails, pause and report
- **User interrupts**: complete current batch, mark remaining tasks as incomplete, then pause

### 4.3 Test Execution Gate (inherited from iagent_spec_apply §9, auto-pass)

Phase 4 inherits \`iagent_spec_apply\`'s **test execution gate** and passes it **automatically** — the auto-pipeline MUST NOT skip the gate, and MUST NOT treat it as "no confirmation needed, therefore no test run":

- Scope: **change scope only** — tests produced by this change's \`[测试]\` tasks plus existing tests covering the changed files
- **In-scope tests pass** → auto-pass and continue to Phase 5
- **Pre-existing failures outside the change scope** → report as WARN only; MUST NOT count as this change's failure, MUST NOT block
- **In-scope tests fail** → auto-fix and re-run, up to 3 attempts (same budget as the compile check)
- **Still failing after 3 attempts** → pause and report to the user. MUST NOT silently pass, MUST NOT proceed to archive
- No test framework in the project → log a WARN, skip the gate, continue

---
## Phase 5: Auto-Archive

**Phase 5 executes automatically after Phase 4 (auto-apply) completes and compile check passes. No user confirmation needed.**

### 5.1 Auto-Execute Archive

After apply completes and compile check passes:
- Announce: "## Auto-Archive Phase" with a clear header
- Display: "Apply complete — automatically entering archive phase"
- Construct the archive context with:
  - \`change-name\` — the current change name (skips the change selection prompt)
- Execute the archive workflow logic (following the iagent_spec_archive skill template)
- All archive steps execute automatically: delta spec sync, CONTEXT.md sync, CodeGraph check, exploration memory sync, **requirement document alignment (if present; if absent, generate for backward compat — the document was already generated by Phase 3 for new-flow changes)**, directory move, requirement document migration to devdocs, ARCHIVE-INDEX.md update
- **Requirement document alignment (single-source rule)**: this step is NOT re-defined here — it follows the SAME rule as \`iagent_spec_archive\` step 4.8: BEFORE the directory move, check whether \`openspec/changes/<change-name>/需求文档.md\` exists; if present, perform an in-place incremental alignment (人工域 \`## 基本信息\` and \`## 八、评审记录\` preserved verbatim, sections 一~七 re-derived) and MUST NOT call the skill; if absent (backward compat — the change was created before the Phase 3 generation rule), non-interactively delegate \`iagent_requirement_doc\` to generate it. The document then migrates to \`openspec/devdocs/\` via the existing step 6. MUST NOT copy the branch rule text here — reference the archive skill's step 4.8.

### 5.2 Auto-Archive Error Handling

- **Delta spec sync conflict**: auto-merge with conflict markers (non-blocking)
- **CONTEXT.md sync fails**: log warning, continue (non-blocking)
- **CodeGraph not initialized**: skip CodeGraph steps, continue (non-blocking)
- **Exploration memory sync fails**: log warning, continue (non-blocking)
- **Requirement document generation or alignment fails**: log warning (target path + reason), continue (non-blocking)
- **Archive target already exists**: fail with error, suggest renaming

### 5.3 Completion

After auto-archive completes:
- Display the full completion summary with all phases
- Show: "## Auto-Workflow Complete ✓"

---
## Guardrails

- **Don't skip questioning** - Keep asking until truly clear
- **MUST validate prompt before exploring** - 委派的 spec_explore（delegated）提示词校验门是强制 checkpoint：清晰输入一句话复述理解后直通；不明确输入须先做提示词优化并等待用户确认或修改，未确认前 MUST NOT 推进到后续步骤
- **Auto semantics never skip the clarification gate** - 委派的 spec_explore 提示词门是澄清门（确认 WHAT），管线为全自动不构成跳过理由；基线确认是自动化的起点
- **Don't deadlock on the confirmation gate** - 委派的 spec_explore 提示词门有四条出口（确认 / 修改 / 拒绝后按原理解继续 / 显式授权按推断继续），不得反复要求确认
- **Do persist the prompt baseline** - 原始提示词与确认后的基线一并写入探索文件 \`## 提示词基线\` 段；基线变更 MUST 回到委派的 spec_explore 提示词门重新确认
- **MUST produce the functional flowchart** - 委派的 spec_explore 流程最终确认门是强制 checkpoint：探索分析完成后 MUST 产出探索文件 \`## 功能流程图\` 段（Mermaid + 节点清单）并执行流程最终确认门；确认前 MUST NOT 进入完成检测，MUST NOT 把未确认流程图当作 propose 锚点
- **Auto semantics never skip the flowchart confirmation gate** - 委派的 spec_explore 流程最终确认门是确认门（确认流程基准），管线为全自动不构成跳过理由；流程基准的确认是自动化的前置条件
- **Don't deadlock on the flowchart gate** - 委派的 spec_explore 流程确认门有四条出口（确认 / 修改 / 拒绝后记录未确认状态并按原理解继续 / 显式授权按推断继续），拒绝时 propose 降级为仅凭 exploration.md、verify 节点覆盖度维度 SKIP，不得反复要求确认
- **MUST NOT silently add flowchart nodes in tasks** - 发现遗漏节点 MUST 回到委派的 spec_explore 更新流程图并重新经用户确认，MUST NOT 在 tasks.md 中静默补节点
- **Don't auto-proceed on conflict** - Phase transitions proceed automatically when the 1.6 consistency checks pass (consistency passthrough); ask the user only when a hard conflict is detected
- **Do execute read-only operations directly** - File reading, CodeGraph queries, and analysis steps (impact analysis) run without asking the user for confirmation
- **Read-only passthrough does not cover clarification gates** - grill L1-L5 requirement-clarification gates still wait for user confirmation
- **Do auto-verify** - automatically verify after proposal without user prompt
- **Do auto-apply after verification pass** - Phase 4 executes automatically with auto-mode=true (iagent_spec_apply Step 5.5 gate skipped)
- **Do auto-archive after apply complete** - Phase 5 executes automatically with change name passed from context (following the iagent_spec_archive skill template)
- **Do inherit and auto-pass the test execution gate** - Phase 4 runs iagent_spec_apply §9 limited to the change scope; in-scope failures auto-retry up to 3 times, then pause and report; pre-existing out-of-scope failures are WARN only; no test framework → WARN and skip
- **Don't silently pass a failing test gate** - a failing in-scope test gate MUST pause before archive; auto semantics never justify skipping the gate or the archive block
- **Do converge after the deep review** - After full pass, invoke \`iagent_proposal_review\` for deep review (fallback inline deep review + WARN), then generate the requirement document (non-interactive \`iagent_requirement_doc\`; failure is non-blocking WARN), then auto-transition to Phase 4
- **MUST create file before questioning** - Phase 1 checkpoint is mandatory
- **MUST verify file before migration** - Phase 2 checkpoint is mandatory
- **MUST preserve source on migration failure** - Never lose user data
- **MUST NOT offer method selection** - Phase 2 proceeds directly to inline propose-style generation
- **MUST follow the Markdown-first protocol in Phase 2** - Inline generation MUST follow \`openspec/rules/artifact-generation.md\`: write the Markdown source of truth (proposal.md / specs/**/*.md / design.md / tasks.md) → \`iagent spec validate --change "<name>"\` → on validation failure fix the Markdown and re-run; validation unavailable produces WARN
- **Do explore codebase** - Before asking, check if codebase answers the question
- **Do provide recommendations** - Every question includes AI's recommendation
- **Do update file real-time** - After each exchange, write to exploration file
- **Do use structured format** - Background, Questions, Decisions, Pending sections
- **Do show quantified scores** - Verification results include coverage percentages
- **Do inject capability memory** - Phase 1 reads specs/<capability>/explorations.md when it exists
- **Do scan other projects with CodeGraph** - When exploration context contains other project paths, spawn sub-agent to scan them using CodeGraph projectPath parameter; fall back to Glob/Grep on failure
- **Don't lose exploration** - File persists even on abandon (unless deleted)
`,
        allowedTools: `Read, Write, Edit, Glob, Grep, Bash(iagent:*), Bash(npm:*), Bash(pnpm:*), Bash(node:*), Bash(mvn:*), Bash(gradle:*), Bash(ant:*), Bash(go:*), Bash(cargo:*), Bash(git:*), Bash(ls:*), Bash(mv:*), ${CODEGRAPH_MCP}, ${skillDelegation(['spec_explore', 'spec_propose', 'spec_verify_proposal', 'proposal_review', 'requirement_doc'])}, ${SUBAGENT_DISPATCH}`,
        type: 'impl',
        license: 'MIT',
        compatibility: '依赖 iagent CLI（spec 命令组）与 spec 系列技能（iagent_spec_apply / iagent_spec_archive）；CLI 缺失时降级为 AI 内联生成。',
        metadata: { author: 'mi-agent-tools', version: '1.0' },
        references: [
            { path: 'references/prompt-gate.md', content: PROMPT_GATE_FULL },
            { path: 'references/flowchart-gate.md', content: FLOWCHART_FULL },
        ],
    };
}

export function getAutoWorkflowCommandTemplate(): CommandTemplate {
    return {
        name: 'iAgent: 全自动工作流',
        description: '一站式全自动工作流：探索（L1-L5 确认）→ 自动提案 → 自动验证 → 自动实现（auto-mode）→ 自动归档',
        category: 'iAgent / 实现',
        tags: ['iagent', 'impl', 'auto-workflow', 'automation'],
        content: `**适用 openspec/rules/ai-coding.md 全域护栏。** 未定义项标 **[待确认]**，禁止猜测。

One-stop automated workflow from exploration to archive. **Trigger boundary**: full pipeline only — interactive guided workflow is \`iagent_workflow\`.

**Input**: The argument after the command is the user's topic description (what they want to build). Missing parameters are collected interactively; already-provided parameters are skipped.

---
## Phase 1: Exploration（委派 iagent_spec_explore）

Phase 1 SHALL 经 Skill 工具委派 \`iagent_spec_explore\`（传 \`mode=delegated\`）执行强制 checkpoint 体系探索（强制建探索文件、提示词校验门、CONTEXT.md 检查、CodeGraph 基础扫描含多项目派发与深度分析、L1-L5 grill 追问、功能流程图与流程最终确认门、聚合一致性门、探索完成检测），MUST NOT 内联执行探索逻辑。

委派完成后 SHALL 消费 \`iagent_spec_explore\` 输出的**结构化 handoff**（探索文件路径、提示词基线、流程基准确认状态、Pending 影响符号）并据此推进 Phase 2。

**退出守卫**：被委派的 \`iagent_spec_explore\` 完成后 MUST NOT 自行进入提案或实现；阶段完成判定与推进主权归编排器。

## Phase 2: Proposal（委派 iagent_spec_propose）

Phase 2 经 Skill 工具委派 \`iagent_spec_propose\`（\`mode=delegated\` + \`exploration-file\`）生成全部制品，MUST NOT 内联生成提案制品。

## Phase 3: Verification (automated)

Auto-execute D1-D5 verification: invoke the \`iagent_spec_verify_proposal\` skill (Skill tool) for scoring; fallback to AI inline scoring + WARN if unavailable; unified 90% threshold; tech stack detected from config.yaml. **PASS (≥90%)**: auto-execute deep proposal review (\`iagent_proposal_review\` skill; fallback inline deep review + WARN) → converge → generate requirement document (non-interactive \`iagent_requirement_doc\`; failure non-blocking WARN) → auto-transition to Phase 4. **FAIL (<90%)**: auto-fix and re-run; if still FAIL, offer [Manual edit] / [Return to exploration] / [View detailed diff] (no skip-to-apply path).

## Phase 4: Auto-Apply (automated, auto-mode=true)

After verification passes and the deep review has converged: announce "## Auto-Apply Phase"; construct apply context with \`auto-mode=true\` (skip design confirmation gate — consistent with iagent_spec_apply: Step 5.5 gate skipped in auto-mode, directly Step 6 batch scheduling) and \`change-name\`; execute apply workflow logic following the iagent_spec_apply skill's Step 6+ batch scheduling behavior with auto-mode=true; Phase 4 inherits the dispatch protocol and the shared-resource protocol of \`iagent_spec_apply\` (shared context pack / output ledger / minimal receipt / shared instruction prefix) and MUST NOT define its own dispatch-instruction format or re-declare the protocol text; auto-mode=true only skips the design confirmation gate — the shared-resource protocol stays in effect; all tasks implemented automatically with existing batch scheduling. **Test execution gate inherited from iagent_spec_apply §9 and auto-passed**: change-scope tests only; in-scope failures auto-retry up to 3 times then pause and report; pre-existing out-of-scope failures are WARN only and must not block; no test framework → WARN and skip; a failing in-scope gate MUST pause before archive. Error handling: compile check fails (after 3 auto-fix attempts) → pause and wait for user, do NOT proceed to archive; in-scope test gate still failing after 3 attempts → pause and report, MUST NOT silently pass, MUST NOT proceed to archive; sub-agent fails → auto-retry once, then pause and report; user interrupts → complete current batch, mark remaining as incomplete, then pause.

- **⛔ EXIT GUARD (MANDATORY)**: every sub-agent dispatch instruction MUST carry the exit guard — 完成分配任务后立即停止返回回执，MUST NOT enter plan mode / design mode / propose next steps / continue beyond assigned scope；编排器是唯一有权判停、汇总、推进阶段的角色；子代理 MUST NOT 越权替代编排器做阶段收尾决策
- **MUST FIRST read pack**: sub-agent dispatch instruction MUST enforce that the sub-agent reads the context pack FIRST before any other action — MUST NOT re-read proposal/specs/design or re-run CodeGraph queries already covered by the pack；仅做增量查询
## Phase 5: Auto-Archive (automated)

After apply completes and compile check passes: announce "## Auto-Archive Phase"; construct archive context with \`change-name\` (skips selection prompt); execute archive workflow logic following the iagent_spec_archive skill template; all steps automatic (delta spec sync, CONTEXT.md sync, CodeGraph check, exploration memory sync, **requirement document alignment (if present; if absent, generate for backward compat — the document was already generated by Phase 3 for new-flow changes; same single-source rule as archive step 4.8: present → in-place incremental alignment preserving 人工域, MUST NOT call the skill; absent → non-interactively delegate iagent_requirement_doc)**, directory move, requirement document migration to devdocs, ARCHIVE-INDEX.md update). Error handling: delta spec sync conflict → auto-merge with conflict markers (non-blocking); CONTEXT.md sync fails → WARN, continue; CodeGraph not initialized → skip CodeGraph steps, continue; exploration memory sync fails → WARN, continue; requirement document generation/alignment fails → WARN (target path + reason), continue; archive target already exists → fail with error, suggest renaming. Completion: display full summary and "## Auto-Workflow Complete ✓".

---
## Guardrails

- **MUST NOT enter plan mode**: 子代理（Agent/Task）完成分配任务后 MUST NOT enter plan mode / design mode / propose next steps；Phase 4 auto-mode 仅跳过设计确认门，MUST NOT 免除退出守卫或共享资源协议
- **MUST FIRST read shared context**: 子代理 MUST 先读共享上下文包再做增量查询；MUST NOT 绕过包重读 proposal/specs/design 或重跑已覆盖的 CodeGraph 查询
Don't skip questioning; don't auto-proceed on hard conflict (consistency passthrough only when no hard conflict); read-only operations (file reading, CodeGraph, analysis) run without confirmation but L1-L5 clarification gates still wait; MUST validate prompt before exploring (委派的 spec_explore（delegated）提示词校验门，清晰直通 / 不明确须优化并确认，未确认不推进); auto semantics never skip the clarification gate; don't deadlock on the confirmation gate (确认 / 修改 / 拒绝 / 授权按推断四条出口); do persist the prompt baseline into \`## 提示词基线\`; MUST produce the functional flowchart (委派的 spec_explore 强制产出探索文件 \`## 功能流程图\` 段并执行流程最终确认门，确认前不进入完成检测、不把未确认流程图当作 propose 锚点); auto semantics never skip the flowchart confirmation gate; don't deadlock on the flowchart gate (确认 / 修改 / 拒绝记录未确认状态 / 授权按推断四条出口); don't silently add flowchart nodes in tasks (遗漏节点回委派的 spec_explore 更新并重新确认); auto-verify after proposal; auto-apply after verification pass with auto-mode=true (iagent_spec_apply Step 5.5 skipped); auto-archive after apply complete (iagent_spec_archive skill); auto-inherit the test execution gate from iagent_spec_apply §9 with auto-pass (in-scope failures auto-retry 3 times then pause and report; pre-existing out-of-scope failures WARN only; no test framework → WARN and skip); never silently pass a failing in-scope test gate (pause before archive); do converge after the deep review (iagent_proposal_review deep review → generate requirement document non-interactively → auto-transition to Phase 4; requirement document failure is non-blocking WARN); MUST create file before questioning; MUST verify file before migration; MUST preserve source on migration FAILURE only (on success the source is deleted — exactly one resident copy); MUST follow the Markdown-first shared protocol in Phase 2 (\`openspec/rules/artifact-generation.md\`: write the Markdown source of truth → \`iagent spec validate\` → fix the Markdown on validation failure / inline checks + WARN); MUST NOT offer method selection; do explore codebase before asking; do provide recommendations; do update file real-time; do use structured format; do show quantified scores; do inject capability memory; do scan other projects with CodeGraph; don't lose exploration (file persists). Build all paths with \`path.join()\`.
`,
    };
}
