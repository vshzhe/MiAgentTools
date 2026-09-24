---
name: "Venus: 调试工作流"
description: 一站式调试：复现 → CodeGraph 排查定位 → 关联变更判定 → 修复+回归测试（调试循环）→ 编译检查 → 同步提案 → 验证
allowed-tools: Bash(venus:*)
category: Venus / 实现
tags: [venus, tr_impl, debug, bug-fix, root-cause, regression]
---

**Before proceeding, read openspec/rules/ai-coding.md for AI coding guardrails.**

One-stop debugging workflow from reproduction to proposal synchronization, with P1-P4 debug loop for multiple bug fixes.

**Input**: The argument after this command is the bug description (symptom, error message, or failing behavior). If omitted, prompt the user to describe the bug before starting.

**门 0 — Prompt Validation Gate（缺陷五维，MANDATORY）**: 记录 bug 描述之后、Phase 1 复现之前强制自检。用户未提供描述、由技能提示后补充的，以补充内容为原始提示词（不对空输入校验）。

**Prompt Validation Gate (提示词校验门)**: 探索前强制自检用户输入，维度为 症状 Symptom / 复现步骤 Repro / 期望 vs 实际 Expected vs Actual / 环境 Environment / 歧义 Ambiguity。
- **清晰**（症状 Symptom / 复现步骤 Repro / 期望 vs 实际 Expected vs Actual / 歧义 Ambiguity 均无 `❌` 与实质 `⚠️`）→ 一句话复述理解后直通，不输出校验表、不要求确认
- **不明确**（任一维 `❌` 或实质 `⚠️`）→ 先做提示词优化，输出 `【优化后提示词】`（推断项标 `[推断]`、未知项标 `[待确认]`）与 `【优化说明】`，**阻塞等待用户确认或修改**后才继续；出口四条：确认 / 修改 / 拒绝（按原理解继续）/ 显式授权按推断（推断项记入基线后继续），**不得陷入等待死循环**
- **软不明确**（仅细节级歧义）→ 记 `[假设]` 继续
- 优化**不篡改原始意图**、不增加用户未提出的需求
- 校验结论与基线写入探索产物 `## 提示词基线` 段，作为下游唯一语义来源
- 空输入不校验；输入为变更名时以该变更既有制品为校验对象；上游已产出基线时直接通过

用户确认或修改前 MUST NOT 进入 Phase 1，不得凭猜测编写失败测试。校验结论（原始提示词 + 确认后的基线）写入诊断记录 `## 提示词基线` 段，Phase 6 随根因分析持久化到变更 exploration.md。

Use the **TodoWrite tool** to initialize tracking for each bug's phases. Append new Bug #N entries for each additional bug in the loop.

---

## Phase 1: Reproduce (复现) — MANDATORY

Reproduce the bug BEFORE any fix:
- Preferred: locate/write a failing test and confirm it fails for the reported reason
- Otherwise: record an explicit reproduction procedure (steps, expected vs. actual) and confirm it with the user
- No fix is applied until reproduction is confirmed (Zero-Assumption Policy)

## Phase 2: Investigate Root Cause (排查定位)

1. **Capability memory injection**: infer the capability from the affected code; read `openspec/specs/<capability>/explorations.md` if it exists and inject historical Decisions/terminology/boundary scenarios (superseded sections are historical reference only). No file → log and proceed.
2. **CodeGraph investigation (layered, adapted from workflow)**:
   - `codegraph_status` 预检（**强制首动作**）— MUST run FIRST; until it returns unavailable, MUST NOT use Grep/Glob for symbol/file investigation; only after it confirms unavailable → fall back to Glob/Grep + record "CodeGraph unavailable" (last resort, not a shortcut to skip CodeGraph)
   - `codegraph_files` scan file structure → Discovered Files (paths via `path.join()` for cross-platform)
   - `codegraph_search` + `codegraph_context --task <bug>` — locate symbols + task-level context → Identified Symbols (file:line)
   - `codegraph_callers`/`codegraph_callees` + `codegraph_impact` — call chain + blast radius of defect and candidate fix
   - `codegraph_explore` + 6-dim root cause deep analysis (Design Rationale/Constraints/Trade-offs/Pattern/Historical Context/Implicit Assumptions) — **条件触发**: only when regular queries can't locate a single high-confidence root cause; skip for simple bugs. Historical Context uses `git log --follow`/`git blame`.
   - All findings recorded to diagnosis record in real time (Codebase Findings / Implementation Deep-Dive); Glob/Grep fallback keeps the same structure with fallback noted
3. **Grill-with-docs discipline**: one question at a time; resolved terms written to `openspec/CONTEXT.md` immediately; diagnosis record updated after every exchange.
4. **Confirmation gate**: single high-confidence root cause → present evidence, get acknowledgment. Multiple candidates → STOP, present candidates + evidence + recommendation, user chooses. Non-defect → Phase 3.5.

## Phase 3: Change Association (关联变更判定)

- In-progress change (`openspec/changes/`) → fix updates that change
- Independent bug → create `fix-{module}-<topic>` change (`venus spec new`)
- Archived change → NEVER modify the archive; create a new change and reference the archived name for traceability
- Non-defect → output diagnosis report with evidence, persist the record, no change, no code modification — workflow ends

## Phase 4: Fix (修复)

- Follow ai-coding.md (zero-assumption, minimal changes); schema changes need separate DDL confirmation
- **Mandatory regression test**: fails before the fix, passes after; add to tasks.md if missing; re-run the Phase 1 reproduction

## Debug Loop (调试循环确认)

After each fix, ask: "还有相关 bug 需要修复吗？" [有] [没有]

- **有**: record completed bug, describe next bug, re-enter P1-P4. P3 simplified: default to current change, user may declare independent change (→ finalize current change, prompt separate debug). Non-defect in loop → record diagnosis, continue loop. Mid-loop exit → preserve completed fixes, discard incomplete, proceed to P5-P7. After 5+ iterations, advise checking whether to split changes (do NOT force).
- **没有**: proceed to P5 — unified compile check, synchronization, and verification cover ALL accumulated fixes

## Phase 5: Compile Check (编译检查) — 汇总所有修复

- Read `openspec/config.yaml` `compileCheck` settings; skip when disabled or unconfigured
- Execute compile per detected tech stack; run the auto-fix loop when `autoFix.enabled`
- Report remaining failures — never proceed silently
- Covers ALL files modified across all bug fixes in the loop

## Phase 6: Synchronize Proposal (同步提案) — 汇总所有修复

- Update proposal.md (root causes + fixes for ALL bugs), tasks.md (checkboxes + regression tasks for each bug), design.md and delta specs when behavior changed
- Persist ALL root cause analyses to the change's `exploration.md`, organized per bug
- Validate artifact format after sync: proposal keeps Why/What Changes/Capabilities/Impact; specs keep `#### Scenario:` + WHEN/THEN; tasks keep `- [ ] X.Y` checkboxes. Fix violations before Phase 7.

## Phase 7: Verification (验证) — 覆盖所有修复

- Invoke the `venus_spec_verify_proposal` **skill** (Skill tool — it is a skill name, not a valid `venus spec instructions` artifact ID). The skill performs D1–D9 scoring. Fallback: inline D1–D9 scoring + WARN, never silently skipped
- **FAIL**: do NOT generate the requirement document; auto-fix artifacts and re-run; still failing → [1] Manual edit [2] Return to exploration [3] View diff — no skip path
- **PASS**: auto-invoke the `venus_tr_impl_review_proposal` **skill** for a deep read-only review (fallback: inline review + WARN), then auto-invoke the `venus_tr_docs_requirement_doc` **skill** in non-interactive mode → `openspec/changes/<change-name>/需求文档.md`; on failure log WARN and continue

---

## Guardrails

- Validate the bug report first (Startup 的缺陷五维提示词校验门，含糊描述须优化并确认后才进入复现，不得凭猜测编写失败测试)；确认门四条出口不得死锁
- Reproduce first (every bug in loop); zero-assumption on root causes; archives read-only
- Regression test mandatory (every bug in loop); proposal sync mandatory (all fixes); verification never skipped
- Loop non-defect non-blocking; loop exit preserves completed work; independent change → finalize + prompt separate debug (`/venus:tr-impl-debug`)
- Use `path.join()` for file paths (cross-platform)
