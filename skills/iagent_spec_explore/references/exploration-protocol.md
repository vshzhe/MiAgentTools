## 强制 checkpoint 体系（delegated 模式）

**Input**: User's topic description (what they want to build).

Use the **TodoWrite tool** to initialize tracking: `[{"content": "Phase 1: Exploration", "status": "in_progress"}, {"content": "Phase 2: Proposal", "status": "pending"}, {"content": "Phase 3: Verification", "status": "pending"}, {"content": "Phase 4: Implementation", "status": "pending"}, {"content": "Phase 5: Archive", "status": "pending"}]`

### 1.1 Create Exploration File (MANDATORY CHECKPOINT)

**⚠️ MANDATORY: File creation checkpoint at Phase 1 start**

When user invokes this command, system MUST create an exploration file before proceeding:

```bash
# Determine keyword from user's topic
# Pattern: <keyword>-explore-<sequence>.md
# Example: "add user authentication" -> user-auth-explore-001.md
```

**File Creation Process**:

1. **Extract keyword** from user's topic
   - Convert to kebab-case (max 50 chars)
   - Default to "explore" if extraction fails

2. **Determine sequence number**
   - Find highest sequence for that keyword in `openspec/explorations/`
   - Increment sequence (001, 002, etc.)

3. **Handle filename collisions**
   - If file exists, increment sequence
   - If collision persists after 3 retries, append timestamp suffix
   - Log collision resolution for transparency

4. **Create file at**: `openspec/explorations/<keyword>-explore-<sequence>.md`

5. **Verify file creation**
   - Check file exists and is writable
   - If verification fails, abort and report error
   - Log creation status to user

**Checkpoint Enforcement**:
- System MUST NOT proceed to questioning without valid exploration file
- If file creation fails, system MUST stop and report error
- User MUST be informed of file creation status

Use `path.join()` for cross-platform compatibility.

**TodoWrite tracking**: Initialize TodoWrite with Phase 1 items:
```
- [ ] Phase 1: 创建探索文件
- [ ] Phase 1: 提示词校验门
- [ ] Phase 1: CONTEXT.md 检查
- [ ] Phase 1: 关键词检测与分析
- [ ] Phase 1: Grill-with-docs 追问
- [ ] Phase 1: 完成检测与确认
```

### 1.1.2 Prompt Validation Gate (MANDATORY CHECKPOINT)

**⚠️ MANDATORY: 本门在任何探索动作之前执行，不得跳过。**

**门的校验对象是用户最终提供的需求描述**：调用未携带主题时，先交互收集主题描述，再以收集后的描述执行本门，MUST NOT 对空输入执行校验。

**Prompt Validation Gate (提示词校验门)**: 探索前强制自检用户输入，维度为 目标 Goal / 对象 Object / 范围 Scope / 约束 Constraints / 验收 Acceptance / 歧义 Ambiguity。
- **清晰**（目标 Goal / 对象 Object / 范围 Scope / 歧义 Ambiguity 均无 `❌` 与实质 `⚠️`）→ 一句话复述理解后直通，不输出校验表、不要求确认
- **不明确**（任一维 `❌` 或实质 `⚠️`）→ 先做提示词优化，输出 `【优化后提示词】`（推断项标 `[推断]`、未知项标 `[待确认]`）与 `【优化说明】`，**⛔ GATE: 立即结束本次响应并等待用户确认或修改**（本次响应到此结束，收到用户响应后继续；出口：确认 / 修改 / 拒绝 / 显式授权按推断），**不得陷入等待死循环**
- **软不明确**（仅细节级歧义）→ 记 `[假设]` 继续
- 优化**不篡改原始意图**、不增加用户未提出的需求
- 校验结论与基线写入探索产物 `## 提示词基线` 段，作为下游唯一语义来源
- 空输入不校验；输入为变更名时以该变更既有制品为校验对象；上游已产出基线时直接通过

> **完整门细则**见 references/prompt-gate.md。**仅在 Gate 实际触发时**（输入不明确、进入 Step 3 优化流程）读取全文细则；清晰输入直接通过，无需读取。

**本技能内的执行要求**：

- 门的位置固定在此处：探索文件已创建（1.1），而 CONTEXT.md 检查（1.1.5）、代码库扫描（1.2.1）与 grill 追问（1.3）均在其后
- 不明确分支的确认门是**澄清门（确认 WHAT）**：用户确认或修改前 MUST NOT 推进到 1.1.5 及之后的任何步骤
- 校验结论（原始提示词 + 确认后的提示词基线）写入探索文件 1.2 结构中的 `## 提示词基线` 段

### 1.1.5 CONTEXT.md Startup Check (MANDATORY CHECKPOINT)

**⚠️ MANDATORY: CONTEXT.md check at Phase 1 start — BEFORE questioning begins**

1. **Check if `openspec/CONTEXT.md` exists** using Glob or Read tool
2. **If EXISTS**: Read all existing terms and inject them into exploration.md 术语表 section
   - Use existing terminology in all questions (do not re-define)
3. **If NOT EXISTS**: Record "No existing glossary — will create during exploration" in exploration.md 术语表 section
   - Mark TodoWrite: `- [ ] Phase 1: 创建 CONTEXT.md`

**Checkpoint Enforcement**:
- System MUST check CONTEXT.md existence before entering Section 1.3 questioning
- If CONTEXT.md exists, terms MUST be loaded into exploration.md before first question

### 1.2 Initialize Structured Format

Write the initial file structure with enhanced sections:

```markdown
## Background

<User's initial description and context>

## 提示词基线 (Prompt Baseline)

**原始提示词**: <用户最初提供的原文，未经改写>

**确认后的提示词基线**: <经 1.1.2 校验门确认的版本；清晰输入时即原始提示词本身>

> 下游（提案 / 设计 / 规格 / 任务）以提示词基线为唯一语义来源；基线若变更 MUST 回到 1.1.2 重新确认。

## 功能流程图 (Functional Flowchart)

<!-- 1.5.5 强制产出：Mermaid flowchart TD 承担顺序与分支骨架，节点 id N<序号> 在图中与表中 MUST 稳定一致 -->
<!-- 初始为空；探索分析完成后由 1.5.5 填写并经流程最终确认门确认 -->

| 节点 | 操作 | 触发条件 | 证据位置 | 异常路径 |
| :--- | :--- | :--- | :--- | :--- |
| N1 | <操作> | <前置条件，无则 "—"> | <文件:行 或 类.方法；新建功能标 [新建] + 预期产物> | <失败去向 → N<id>，无则 "—"> |

> 确认后的流程图 = **流程基准**（独立于提案自身的交叉验证锚点）；未经用户确认的流程图 MUST NOT 作为提案的生成锚点。
> 提案 / 验证阶段发现遗漏节点 MUST 回到 1.5.5 更新并重新确认，MUST NOT 在 tasks.md 中静默补节点。

## Analysis (optional - if analysis run)

### Security Findings
<Security vulnerabilities from Semgrep>

### Architecture Flow
<Call chains and symbols from CodeGraph>

### Business Flow
<Process steps from CodeGraph>

### Identified Symbols
<Symbols for Phase 2 Impact Analysis>

## Codebase Findings (NEW)

### Discovered Files
- <file-path>: <relevance-reason>

### Identified Symbols
- <symbol-name> (<file-path>:<line>): <reason>

### Pattern Matches
- <pattern-name>: <example-location>

## Questions

<Empty initially - accumulates Q&A>

## 术语表 (NEW)

| 术语 | 定义 | 避免使用 |
|------|------|---------|
<!-- Terms resolved during grilling and written to CONTEXT.md -->

## 架构决策 (NEW)

<!-- ADRs created during exploration -->
- ADR-0001: <title> — <summary>
  File: `openspec/docs/adr/0001-<slug>.md`

## 边界场景 (NEW)

<!-- Boundary scenarios constructed for each decision -->
- [ ] <scenario description>

## Decision Process (NEW)

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

## Scope Changes (NEW)

<!-- Tracks scope changes during exploration -->
| 变更时间 | 变更类型 | 变更描述 | 原因 |
|---------|---------|---------|------|
| <!-- expand/shrink/pivot --> | <!-- description --> | <!-- reason --> |

## Pending (enhanced)

### For Phase 2 Impact Analysis
- <Symbol name> (<File location>) - Priority: HIGH
- <Other project symbols from 1.2.1.5 Agent scan, prefixed with project path> - Priority: MEDIUM

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
- System MUST execute base scan before entering Section 1.3 questioning
- If CodeGraph AND Glob/Grep both fail, system MUST warn but NOT block
- Scan results MUST be written to exploration file before proceeding

### 1.2.1.5 Multi-Project CodeGraph Agent Scan（条件触发 — 检测到其他项目路径时执行）

> 完整细则见 `references/multi-project-scan.md`；检测到其他项目路径时 MUST 先 `Read` 该文件。

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

> 完整 grill 问题库与 L1-L5 细则（含批量确认规则）见 `references/grill-playbook.md`；执行 1.3 前 MUST 先 `Read` 该文件。

### 1.4 Keyword Detection and Analysis

> 完整关键词分析与实现深潜细则见 `references/deep-analysis.md`；执行 1.4 前 MUST 先 `Read` 该文件。

### 1.5 Update Exploration File

**After each exchange, perform these steps in order**:

**Step 1 — Write to CONTEXT.md (MANDATORY if term resolved)**:
- If a term was resolved in this exchange, MUST write to `openspec/CONTEXT.md` NOW
- Use format: `**<Term>**: <definition>\\n_Avoid_: <synonyms>`
- If CONTEXT.md does not exist, create it lazily now

**Step 2 — Update exploration.md sections**:

| Content type | Section |
|--------------|---------|
| User's original input | Background |
| Analysis results (if run) | Analysis |
| Resolved terminology (from CONTEXT.md) | 术语表 |
| AI's questions + user answers | Questions |
| ADRs created | 架构决策 |
| Constructed boundary scenarios | 边界场景 |
| Confirmed choices | Decisions |
| Unresolved items | Pending |

Use markdown format with proper syntax.

### 1.5.5 Functional Flowchart & Flow Final Confirmation Gate (MANDATORY CHECKPOINT)

**⚠️ MANDATORY: 探索分析完成后必须强制产出功能流程图，并经流程最终确认门确认后才进入 1.6。**

触发点：1.3 grill L1-L5 与 1.4 关键词分析均已执行、1.5 探索文件已更新之后。本制品是**强制产出**——不因"本次判定无流程"而跳过，也 MUST NOT 留空。

**功能流程图（Functional Flowchart）**: 把探索发现的业务功能流程固化为探索产物 `## 功能流程图` 段（Mermaid `flowchart TD` + 关键操作节点清单表）。
- **节点粒度** = 可独立验证的业务操作单元（用户操作 / 业务判定 / 数据写入 / 外部调用）；节点标识在图中与表中 MUST 一致，多流程时全局唯一递增
- **清单列集**：节点 / 操作 / 触发条件 / 证据位置 / 异常路径
- **证据追溯（硬约束）**：每节点 MUST 填 `文件:行` 或 类.方法；新建功能标 `[新建]` + 预期产物；无法追溯证据的节点 MUST NOT 进入清单
- **⛔ GATE: 流程最终确认门（强制停止）**：呈现流程图与清单并立即结束本次响应，等待确认；出口：确认 / 修改 / 拒绝（记未确认状态，提案降级 + 验证该维度 SKIP）/ 显式授权按推断（推断节点标 `[推断]`）——不得陷入等待死锁
- **回改规则**：发现遗漏节点 MUST 回探索更新并重新确认，MUST NOT 在任务清单静默补节点
- 节点数超 50 时按子流程分节；本块 MUST NOT 含任何 Bash 命令示例

> **完整流程图细则**见 references/flowchart-gate.md。**仅在流程浮现时**读取全文细则。

**本技能内的执行要求**：

- **强制产出**：把探索发现的业务功能流程固化为探索文件 1.2 结构中的 `## 功能流程图` 段（该段已在 1.2 预留）；Mermaid 流程图与节点清单表的节点 id MUST 稳定一致
- **节点证据追溯**：每节点 MUST 填证据位置——既有代码标 `文件:行` 或 类.方法，**新建功能**节点标 `[新建]` 并写明预期产物（新增哪个类 / 页面 / 接口）；**无法追溯证据的节点 MUST NOT 进入清单**
- **四出口确认门**：呈现流程图与节点清单后停止等待确认，出口四条（确认 / 修改 / 拒绝后记录未确认状态并按原理解继续 / 显式授权按推断继续），**MUST NOT 反复要求确认或陷入等待死锁**
- **回改规则**：探索或提案阶段发现**遗漏节点**时 MUST 回到本步骤（1.5.5）更新流程图与节点清单并**重新经用户确认**；MUST NOT 在 tasks.md 中静默补节点——静默补全正是偏差的主要来源
- **节点数超 50**：按子流程分节，主流程图以子流程节点聚合、子流程各自展开清单表
- **确认前不得推进**：用户确认前 MUST NOT 进入 1.6 探索完成检测，MUST NOT 向提案阶段传递流程基准
- **流程基准用途**：确认后的流程图 = **流程基准**，随探索文件迁移（Phase 2.3）一并进入变更目录，由 1.6.6 聚合一致性门与下游 propose / verify 共同消费

### 1.6 Exploration Completion Detection

When all ambiguities resolved:
- Pending section empty OR all items have answers
- User confirms clarity (or says "that's enough")

**Consistency passthrough (replaces the transition confirmation prompt)**:

1. Run the 1.6.5 CONTEXT.md checkpoint and the 1.6.6 aggregate consistency gate
2. **Both pass (no hard conflicts across decisions)**: announce "Checks passed — generating proposal directly" and enter Phase 2 immediately — do NOT ask "Ready to proceed to proposal?"
3. **Hard conflict detected**: present the conflicting decisions (list the conflicting decision pair) and ask the user which direction to follow; continue only after the conflict is resolved
4. grill L1-L5 requirement-clarification gates (1.3.4) still wait for user confirmation; 1.7 abandon handling (user-initiated stop) is preserved

### 1.6.5 CONTEXT.md Checkpoint — Phase 1 End (MANDATORY CHECKPOINT)

**⚠️ MANDATORY: CONTEXT.md validation before Phase 1 ends**

After user confirms exploration complete, system MUST validate CONTEXT.md:

1. **Check if `openspec/CONTEXT.md` exists** using Glob or Read tool

2. **If EXISTS**: Validate all terms in exploration.md 术语表 section are written to CONTEXT.md
   - Read CONTEXT.md content
   - Compare with exploration.md 术语表 section
   - If terms missing from CONTEXT.md, auto-sync them (write missing terms)
   - Log: "CONTEXT.md validated — <N> terms synced"

3. **If NOT EXISTS**: Auto-generate CONTEXT.md from exploration.md 术语表 section
   - Create `openspec/CONTEXT.md` with all resolved terms
   - Format: `**<Term>**: <definition>\\n_Avoid_: <synonyms>`
   - Log: "CONTEXT.md created — <N> terms from exploration"

4. **Compatibility check** (Task 12.1, narrowed): If no exploration file exists (e.g., running `iagent:spec-apply` on existing change):
   - Before declaring "no exploration file", retry path resolution at least once (handle transient path-resolution failures that could falsely indicate absence)
   - If genuinely no exploration file: this skip applies **ONLY to the CONTEXT.md check** — log WARN (not silent info): "WARN: Skipping CONTEXT.md check: no exploration file"
   - This skip does **NOT** extend to the 1.6.6 aggregate consistency gate (see 1.6.6 for no-exemption handling)
   - Do NOT block the workflow at this checkpoint

**Checkpoint Enforcement**:
- System MUST execute CONTEXT.md check before allowing Phase 1→Phase 2 transition
- If CONTEXT.md is missing and no exploration file, the CONTEXT.md check may be skipped with a WARN log (not a blocker); the 1.6.6 aggregate consistency gate is NOT exempt
- Log all actions (including skips) for transparency

### 1.6.6 Aggregate Consistency Gate — Phase 1 End (MANDATORY CHECKPOINT)

**⚠️ MANDATORY: Cross-decision aggregate consistency scan before Phase 1 ends**

**默认直通语义（non-blocking）**: 本门是兜底门——**无硬冲突时自动直通**（记录日志后继续，**不计入用户停顿**），仅在检测到硬冲突时暂停呈现。该门 MUST NOT 被删除（它是 1.3.4 增量 L4 检查的兜底）。

This gate is the backstop for the per-decision L4 check (1.3.4). The L4 check runs incrementally per new decision and auto-marks "no conflict" silently — late Scope Changes can introduce cross-decision contradictions that L4 never re-scans. This gate reads ALL recorded Decisions together and catches such residual contradictions. **This gate is NOT exempt** by the Task 12.1 "no exploration file" skip.

After the 1.6.5 CONTEXT.md checkpoint, system MUST execute the aggregate scan:

1. **Read all Decisions** from exploration.md `## Decisions` section

2. **If exploration.md missing or Decisions section empty**:
   - Log WARN: "Aggregate consistency gate: exploration.md/Decisions empty — nothing to scan, gate passed by vacuity"
   - Do NOT silently skip (distinct from the CONTEXT.md skip) — record the vacuity-pass explicitly
   - Proceed to Phase 2

3. **If Decisions present**: scan every decision pair for three hard-conflict types:
   - **Technical-selection conflict**: e.g., Decision A selects SQLite, Decision B relies on Postgres-specific features
   - **Dependency-direction conflict**: e.g., Decision A depends on B's output, but Decision B depends on A's output (circular)
   - **Constraint mutual exclusion**: e.g., Decision A mandates IE compatibility (no ES6+), Decision B requires ES6+ syntax

4. **If a hard conflict is found**:
   - Pause and surface the conflict to the user: "Decision A <X> conflicts with Decision B <Y> — which direction should we follow?"
   - MUST NOT auto-resolve or silently proceed
   - Record the resolution in exploration.md `## Scope Changes` / `## Decisions`

5. **If no hard conflict**: log "Aggregate consistency gate passed — <N> decisions scanned, 0 hard conflicts" and proceed to Phase 2

**Checkpoint Enforcement**:
- System MUST execute this gate after 1.6.5 and before 1.7 / Phase 2
- This gate MUST NOT be skipped via the Task 12.1 "no exploration file" exemption (that exemption is CONTEXT.md-only)
- Soft inconsistencies (style, naming) do NOT block; only the three hard-conflict types block

### 1.7 Abandon Exploration Handling

If user says "abandon", "stop", "cancel":
> "Delete exploration file or keep it?"
> [Delete] [Keep]

- **Delete**: Remove file from `openspec/explorations/`
- **Keep**: File remains for future reference

---

