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
   - **2.2.3.5 排查深度分级（新增·事前选路径）**: 三条客观信号任一命中即深度路径 —— (a) 爆炸半径：depth ≤ 2 受影响符号数 ≥ 5 **或** 受影响文件数 ≥ 3；(b) 跨 ≥ 2 个模块 / 目录；(c) 2.2.2 未能一步定位单一高置信根因。**轻量路径 A** 止步不做 6 维；**深度路径 B** 进 `codegraph_explore`。信号取值 MUST 可追溯实测结果；信号缺失或阈值边界 MUST 取深度路径。CodeGraph 不可用时信号 (a) 降级为 Grep 文件数代理指标、(b)(c) 照常，分级仍生效并标注「信号降级」。分级与 2.5 缺陷链路图解耦（后者恒强制）
   - `codegraph_explore` + 6-dim root cause deep analysis (Design Rationale/Constraints/Trade-offs/Pattern/Historical Context/Implicit Assumptions) — **触发条件**：分级为深度路径 **或** 轻量路径未定位单一高置信根因（升级兜底）；**仅当**轻量路径且已定位根因时 SKIP。Historical Context uses `git log --follow`/`git blame`. 兜底是**触发条件**不是独立步骤（2.2.4 内容与编号不变）
   - All findings recorded to diagnosis record in real time (Codebase Findings / Implementation Deep-Dive); Glob/Grep fallback keeps the same structure with fallback noted
3. **Grill-with-docs discipline**: one question at a time; resolved terms written to `openspec/CONTEXT.md` immediately; diagnosis record updated after every exchange.
4. **Confirmation gate**: single high-confidence root cause → present evidence, get acknowledgment. Multiple candidates → STOP, present candidates + evidence + recommendation, user chooses. Non-defect → Phase 3.5.

## 2.5 缺陷链路图与流程最终确认门 (MANDATORY)

**⚠️ MANDATORY: 根因确认门（2.4）通过后强制产出缺陷链路图，并经流程最终确认门确认后才进入 Phase 3。** 异常与根因节点须待根因确认后方可知，故本步骤不得前移。

**功能流程图（Functional Flowchart）**: 把探索发现的业务功能流程固化为探索产物 `## 功能流程图` 段（Mermaid `flowchart TD` + 关键操作节点清单表）。
- **节点粒度** = 可独立验证的业务操作单元（用户操作 / 业务判定 / 数据写入 / 外部调用）；节点标识在图中与表中 MUST 一致，多流程时全局唯一递增
- **清单列集**：节点 / 操作 / 证据位置 / 标记
- **证据追溯（硬约束）**：每节点 MUST 填 `文件:行` 或 类.方法；新建功能标 `[新建]` + 预期产物；无法追溯证据的节点 MUST NOT 进入清单
- **流程最终确认门（阻塞）**：呈现流程图与清单并等待确认；出口四条：确认 / 修改 / 拒绝（记未确认状态，提案降级 + 验证该维度 SKIP）/ 显式授权按推断（推断节点标 `[推断]`）——不得陷入等待死锁
- **回改规则**：发现遗漏节点 MUST 回探索更新并重新确认，MUST NOT 在任务清单静默补节点
- 节点数超 50 时按子流程分节；本块 MUST NOT 含任何 Bash 命令示例

**节点范围只覆盖缺陷链路**（前置条件 → 触发 → 异常 → 根因），MUST NOT 展开被测功能的完整业务流程；异常节点标 `🔴异常`、根因节点标 `🟠根因`；落盘为诊断记录新增的 `## 功能流程（缺陷链路）` 段，Phase 6 随根因分析一并持久化到变更 exploration.md。确认后的缺陷链路是 Phase 3 / Phase 4 的**验证口径来源**——修复方案与回归测试 MUST 覆盖「异常节点 + 根因节点」。确认门四出口不得死锁。

## Phase 3: Change Association (关联变更判定)

- In-progress change (`openspec/changes/`) → fix updates that change
- Independent bug → create `fix-{module}-<topic>` change (`venus spec new`)
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

- Read `openspec/config.yaml` `compileCheck` settings; skip when disabled or unconfigured
- Execute compile per detected tech stack; run the auto-fix loop when `autoFix.enabled`
- Report remaining failures — never proceed silently
- Covers ALL files modified across all bug fixes in the loop

## Phase 6: Synchronize Proposal (同步提案) — 汇总所有修复

- Update proposal.md (root causes + fixes for ALL bugs), tasks.md (checkboxes + regression tasks for each bug), design.md and delta specs when behavior changed
- Persist ALL root cause analyses to the change's `exploration.md`, organized per bug — 含每个 bug 的**分级判定结果**（三条信号取值 / 所选路径 / 是否降级）
- Validate artifact format after sync: proposal keeps Why/What Changes/Capabilities/Impact; specs keep `#### Scenario:` + WHEN/THEN; tasks keep `- [ ] X.Y` checkboxes. Fix violations before Phase 7.

## Phase 7: Verification (验证) — 覆盖所有修复

- Invoke the `venus_spec_verify_proposal` **skill** (Skill tool — it is a skill name, not a valid `venus spec instructions` artifact ID). The skill performs D1–D9 scoring. Fallback: inline D1–D9 scoring + WARN, never silently skipped
- **FAIL**: do NOT generate the requirement document; auto-fix artifacts and re-run; still failing → [1] Manual edit [2] Return to exploration [3] View diff — no skip path
- **PASS**: auto-invoke the `venus_tr_impl_review_proposal` **skill** for a deep read-only review (fallback: inline review + WARN), then **判定需求文档是否已存在**（范围仅 `openspec/changes/<change-name>/需求文档.md`，`path.join()`；目录不可读记 WARN 按不存在处理）：**不存在** → 调 `venus_tr_docs_requirement_doc` **skill** 非交互生成（既有行为）；**已存在** → **就地增量对齐更新**（`## 基本信息` 与 `## 八、评审记录` 为人工域 MUST NOT 覆盖、含占位符状态；`一~七` 按 Phase 6 后的制品重新派生；MUST NOT 删除章节，格式破损补建 + WARN；**MUST NOT 调该 skill** —— 其"静默覆盖"规则会抹掉人工内容）。两条分支失败均记 WARN 继续

---

## Guardrails

- Validate the bug report first (Startup 的缺陷五维提示词校验门，含糊描述须优化并确认后才进入复现，不得凭猜测编写失败测试)；确认门四条出口不得死锁
- Reproduce first (every bug in loop); zero-assumption on root causes; archives read-only
- MUST produce the fault chain diagram (2.5 在根因确认门通过后强制产出诊断记录 `## 功能流程（缺陷链路）` 段；节点只覆盖前置条件 → 触发 → 异常 → 根因，异常节点标 `🔴异常`、根因节点标 `🟠根因`，MUST NOT 展开被测功能完整业务流程)；确认门四出口不得死锁
- Fix and regression test MUST cover the exception and root cause nodes of the confirmed fault chain (仅覆盖触发节点时验证不通过)
- Regression test mandatory (every bug in loop); proposal sync mandatory (all fixes); verification never skipped
- 分级按范围而非按便利（2.2.3.5）：信号取值 MUST 可追溯实测结果，MUST NOT 编造"半径小"走轻量路径；信号缺失或阈值边界 MUST 取深度路径；CodeGraph 不可用时分级仍生效并标注「信号降级」
- 分级与 2.5 缺陷链路图解耦：轻量路径同样**强制产出**缺陷链路图并经确认门，MUST NOT 豁免；升级兜底是 2.2.4 的**触发条件**，MUST NOT 新建独立章节或编号
- 需求文档分支强制（Phase 7.3）：判定范围仅 active 变更目录；已存在时 MUST 就地增量对齐并 MUST NOT 调 `venus_tr_docs_requirement_doc`；`## 基本信息` 与 `## 八、评审记录` 为人工域 MUST NOT 覆盖；MUST NOT 删除章节
- Loop non-defect non-blocking; loop exit preserves completed work; independent change → finalize + prompt separate debug (`/venus:tr-impl-debug`)
- Use `path.join()` for file paths (cross-platform)
