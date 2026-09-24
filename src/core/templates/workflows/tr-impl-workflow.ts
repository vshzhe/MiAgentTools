/**
 * tr_impl 类型技能模板：引导工作流（探索→提案→验证一站式）。
 * 引导式工作流 —— 结构化探索（grill 追问 L1-L5）→ 提案内联生成 → 自动验证门 → 深度复查与需求文档联动。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import {
    buildPromptGateBlock,
    buildPromptGateCompact,
    REQUIREMENT_DIMENSIONS,
} from '../prompt-gate.js';
import {
    buildFlowchartBlock,
    buildFlowchartCompact,
    REQUIREMENT_FLOW_COLUMNS,
} from '../flowchart-gate.js';

/** 需求维度的提示词校验门全文（唯一源渲染，见 prompt-gate.ts） */
const PROMPT_GATE = buildPromptGateBlock(REQUIREMENT_DIMENSIONS);

/** 需求维度的提示词校验门压缩版（斜杠指令正文复用） */
const PROMPT_GATE_COMPACT = buildPromptGateCompact(REQUIREMENT_DIMENSIONS);

/** 需求版功能流程图制品全文（唯一源渲染，见 flowchart-gate.ts） */
const FLOWCHART = buildFlowchartBlock(REQUIREMENT_FLOW_COLUMNS);

/** 需求版功能流程图压缩版（斜杠指令正文复用） */
const FLOWCHART_COMPACT = buildFlowchartCompact(REQUIREMENT_FLOW_COLUMNS);

export function getTrImplWorkflowSkillTemplate(): SkillTemplate {
    return {
        name: 'venus_tr_impl_workflow',
        description: 'One-stop guided workflow from exploration to task generation with verification phase. Creates persistent exploration files, asks clarifying questions until clear (grill-with-docs, L1-L5 per-level confirmation gates), generates all artifacts inline, then auto-verifies before implementation. Use when the user wants a guided workflow with追问 (grill-with-docs) questioning and automatic quality verification (一站式工作流 / guided workflow / workflow from exploration). NOT for fully automated pipeline (use venus_tr_impl_auto_workflow), single-stage exploration (use venus_spec_explore), or debugging (use venus_tr_impl_debug).',
        instructions: `**Before proceeding, read openspec/rules/ai-coding.md for AI coding guardrails.** In Phase 1 (Exploration), follow Section 1 (Zero-Assumption). In Phase 2 (Proposal), follow Section 2 (Design-First). In Phase 3 (Verification), check Sections 3-5 for compliance.

One-stop workflow from exploration to task generation with verification phase.

This workflow guides you through:
1. **Exploration phase** - Persistent file + grill-with-docs questioning
2. **Proposal phase** - Create change with all artifacts
3. **Verification phase** - Automatic quality check before implementation

---

## Phase 1: Exploration

**Input**: User's topic description (what they want to build).

Use the **TodoWrite tool** to initialize tracking: \`[{"content": "Phase 1: Exploration", "status": "in_progress"}, {"content": "Phase 2: Proposal", "status": "pending"}, {"content": "Phase 3: Verification", "status": "pending"}]\`

### 1.1 Create Exploration File (MANDATORY CHECKPOINT)

**⚠️ MANDATORY: File creation checkpoint at Phase 1 start**

When user invokes this command, system MUST create an exploration file before proceeding:

\`\`\`bash
# Determine keyword from user's topic
# Pattern: <keyword>-explore-<sequence>.md
# Example: "add user authentication" -> user-auth-explore-001.md
\`\`\`

**File Creation Process**:

1. **Extract keyword** from user's topic
   - Convert to kebab-case (max 50 chars)
   - Default to "explore" if extraction fails

2. **Determine sequence number**
   - Find highest sequence for that keyword in \`openspec/explorations/\`
   - Increment sequence (001, 002, etc.)

3. **Handle filename collisions**
   - If file exists, increment sequence
   - If collision persists after 3 retries, append timestamp suffix
   - Log collision resolution for transparency

4. **Create file at**: \`openspec/explorations/<keyword>-explore-<sequence>.md\`

5. **Verify file creation**
   - Check file exists and is writable
   - If verification fails, abort and report error
   - Log creation status to user

**Checkpoint Enforcement**:
- System MUST NOT proceed to questioning without valid exploration file
- If file creation fails, system MUST stop and report error
- User MUST be informed of file creation status

Use \`path.join()\` for cross-platform compatibility.

**TodoWrite tracking**: Initialize TodoWrite with Phase 1 items:
\`\`\`
- [ ] Phase 1: 创建探索文件
- [ ] Phase 1: 提示词校验门
- [ ] Phase 1: CONTEXT.md 检查
- [ ] Phase 1: 关键词检测与分析
- [ ] Phase 1: Grill-with-docs 追问
- [ ] Phase 1: 完成检测与确认
\`\`\`

### 1.1.2 Prompt Validation Gate (MANDATORY CHECKPOINT)

**⚠️ MANDATORY: 本门在任何探索动作之前执行，不得跳过。**

**门的校验对象是用户最终提供的需求描述**：调用未携带主题时，先交互收集主题描述，再以收集后的描述执行本门，MUST NOT 对空输入执行校验。

${PROMPT_GATE}

**本技能内的执行要求**：

- 门的位置固定在此处：探索文件已创建（1.1），而 CONTEXT.md 检查（1.1.5）、代码库扫描（1.2.1）与 grill 追问（1.3）均在其后
- 不明确分支的确认门是**澄清门（确认 WHAT）**：用户确认或修改前 MUST NOT 推进到 1.1.5 及之后的任何步骤
- 校验结论（原始提示词 + 确认后的提示词基线）写入探索文件 1.2 结构中的 \`## 提示词基线\` 段

### 1.1.5 CONTEXT.md Startup Check (MANDATORY CHECKPOINT)

**⚠️ MANDATORY: CONTEXT.md check at Phase 1 start — BEFORE questioning begins**

1. **Check if \`openspec/CONTEXT.md\` exists** using Glob or Read tool
2. **If EXISTS**: Read all existing terms and inject them into exploration.md 术语表 section
   - Use existing terminology in all questions (do not re-define)
3. **If NOT EXISTS**: Record "No existing glossary — will create during exploration" in exploration.md 术语表 section
   - Mark TodoWrite: \`- [ ] Phase 1: 创建 CONTEXT.md\`

**Checkpoint Enforcement**:
- System MUST check CONTEXT.md existence before entering Section 1.3 questioning
- If CONTEXT.md exists, terms MUST be loaded into exploration.md before first question

### 1.2 Initialize Structured Format

Write the initial file structure with enhanced sections:

\`\`\`markdown
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
  File: \`openspec/docs/adr/0001-<slug>.md\`

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
\`\`\`

**Section Guidelines**:
- **Codebase Findings**: Records discoveries from exploration (files, symbols, patterns)
- **Decision Process**: Tracks decision evolution with rationale
- **Pending**: Categorized by type for Phase 2 attention

### 1.2.0.5 Capability Exploration Memory Injection (MANDATORY CHECKPOINT)

**⚠️ MANDATORY: Inject capability-level exploration memory before questioning begins**

After structured format initialization:

1. **Infer involved capabilities** from the user's topic
   - Use Glob tool to scan \`openspec/specs/\` directory for module names
   - Match topic keywords against module names (same logic as change naming module identification)

2. **Detect capability memory file**
   - For each involved capability \`<capability>\`, check if \`openspec/specs/<capability>/explorations.md\` exists (use \`path.join()\`)

3. **Inject memory (when file exists)**
   - Read the file and inject historical Decisions, 术语, and 边界场景 into the exploration context
   - Write a summary into exploration.md \`## Codebase Findings\` under a "### Capability Exploration Memory (injected)" subsection
   - Sections marked \`已过时（由 <change-name> 取代）\` serve as historical reference ONLY — the superseding change's decisions are current

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
   - **MUST run \`codegraph_status\` FIRST.** Until it returns unavailable, you MUST NOT use Glob/Grep for file or symbol investigation — the \`codegraph_*\` tools below are the primary path, not an optional one.
   - If available: proceed with CodeGraph tools below
   - If \`codegraph_status\` confirms unavailable (uninitialized or error): ONLY THEN log "CodeGraph not initialized — using Glob/Grep fallback" and skip to the fallback below
   - Grep/Glob is a last resort, permitted ONLY after \`codegraph_status\` confirms unavailability — never as a shortcut to skip CodeGraph

1. **Scan project file structure** using \`codegraph_files\` tool
   - Get full project file tree with metadata
   - Identify relevant directories and files matching exploration topic
   - Write results to \`## Codebase Findings > Discovered Files\`

2. **Search for relevant symbols** using \`codegraph_search\` tool
   - Search for symbols matching exploration topic keywords
   - Record discovered symbols with file:line locations
   - Write results to \`## Codebase Findings > Identified Symbols\`

   **Note**: \`codegraph_context\` is deferred to Section 1.4 (after questioning, when task description is clearer).

3. **Record scan results** in exploration file:
   \`\`\`markdown
   ## Codebase Findings

   ### Discovered Files
   - <file-path>: <relevance-reason>

   ### Identified Symbols
   - <symbol-name> (<file-path>:<line>): <reason>

   ### Pattern Matches
   - <pattern-name>: <example-location>
   \`\`\`

**Fallback (last resort)**: Permitted ONLY after \`codegraph_status\` confirms CodeGraph MCP tools are unavailable (uninitialized or error):
- Fall back to Glob tool for file structure discovery
- Fall back to Grep tool for symbol search
- Record in exploration file: "CodeGraph unavailable — used Glob/Grep fallback"

**Checkpoint Enforcement**:
- System MUST execute base scan before entering Section 1.3 questioning
- If CodeGraph AND Glob/Grep both fail, system MUST warn but NOT block
- Scan results MUST be written to exploration file before proceeding

### 1.2.1.5 Multi-Project CodeGraph Agent Scan (条件触发 — 检测到其他项目路径时执行)

**⚠️ CONDITIONAL: Only executes when exploration context contains other project paths**

After the 1.2.1 base scan (current project), system MUST check if the exploration context contains paths to other projects (e.g., user-specified \`--project-path\`, auto-migration SOURCE_PROJECT/TARGET_PROJECT, or paths confirmed during conversation).

**When other project paths are detected**:

1. **Check CodeGraph initialization** for each other project path:
   - Run Bash \`ls <path>/.codegraph/\` to check whether the target project has a \`.codegraph/\` directory (directory contents listed — including codegraph.db — means CodeGraph is initialized). Do NOT use Glob to check dot-prefixed directories (Glob returns false negatives for them)
   - If initialized (ls succeeds): proceed with Agent scan
   - If not initialized (ls fails — directory does not exist): log WARN "Other project <path> does not have CodeGraph initialized — falling back to Glob/Grep" and fall back to Glob/Grep

2. **Spawn sub-agent** for each other project with CodeGraph initialized:
   - Use the \`Agent\` tool to spawn a sub-agent
   - The sub-agent SHALL use CodeGraph MCP tools with \`projectPath\` parameter pointing to the other project
   - Execute \`codegraph_files\` for file structure, \`codegraph_search\` for symbol search, \`codegraph_context\` for context understanding
   - Limit scan depth: \`maxDepth: 3\`, \`maxNodes: 20\` to prevent excessive results
   - Set sub-agent timeout: 120s (timeout → WARN fallback to Glob/Grep)

3. **Handle multiple project paths**:
   - Spawn sub-agents sequentially (one per project)
   - Each project's scan is independent — failure on one does NOT affect others

4. **Merge results** into exploration.md:
   - Write to \`## Codebase Findings > ### Other Project Findings\` subsection
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

**Purpose**: Determine whether to trigger deep analysis (\`codegraph_explore\` + \`codegraph_impact\`).

**Detection Logic**:
1. **Analyze user input keywords** for modification intent:
   - "modify", "update", "change", "edit", "refactor", "enhance", "优化", "修改", "重构" → triggers deep analysis
   - "add", "create", "new", "introduce", "implement", "新增", "添加" → may skip deep analysis

2. **Cross-reference with CodeGraph findings**:
   - If base scan found relevant existing symbols → likely modifying existing code
   - If base scan found no relevant symbols → likely new feature

3. **Decision**:
   - **Modify existing code detected**: System MUST trigger deep analysis hook
     - Execute \`codegraph_explore\` for deep dive
     - Execute \`codegraph_impact\` for blast radius
     - Record results in \`## Implementation Deep-Dive\` section
   - **Pure new feature**: Skip deep analysis, keep only base scan results
   - **Ambiguous**: Default to trigger deep analysis (safer)

4. **Log decision** in exploration file:
   \`\`\`
   ## Analysis
   ### Deep Analysis Trigger
   - Triggered: Yes/No
   - Reason: <detection rationale>
   - Scope: <affected symbols/files>
   \`\`\`

### 1.2.3 CodeGraph Deep Analysis (Conditional — trigger-based)

**Trigger**: When 1.2.2 detects modification intent OR Scope.Modify keyword detected.

Execute deep analysis when triggered:
1. \`codegraph_explore\` — Deep exploration of specific symbols
2. \`codegraph_impact\` — Blast radius analysis of affected symbols
3. Write results to exploration.md \`## Implementation Deep-Dive\` section

**Scope Control** (by trigger level):
- 🔴 Auto (Scope.Modify): All 6 analysis dimensions, up to 10 core symbols
- 🟡 Prompt (Scope.Add): Rationale + Constraints + Assumptions, up to 10 core symbols
- 🟢 Manual (Depth.Deep): User-selected dimensions

### 1.2.4 Post-Scan Update of Exploration File

After base scan (and deep analysis if triggered):
1. Update \`## Codebase Findings\` section with all discovered files and symbols
2. Update \`## Analysis\` section with architecture and business flow findings
3. Update \`## Pending > For Phase 2 Impact Analysis\` with identified symbols
4. If 1.2.1.5 multi-project Agent scan ran, include its results in the Codebase Findings section under \`### Other Project Findings\`
5. Log: "CodeGraph scan complete — <N> files, <M> symbols found"

### 1.3 Grill-With-Docs Questioning

Apply the full grill-with-docs discipline: grilling primitive (decision tree walk) + domain-modeling (CONTEXT.md glossary, ADRs, code cross-validation, scenario construction).

#### 1.3.1 Decision Tree Building

**Before questioning, build a decision tree**:
- Identify parent-child dependency relationships between decisions
- Order questions by dependency (resolve parent decisions before child decisions)
- Record the decision tree structure in exploration.md

#### 1.3.2 Grilling Primitive

**Trigger conditions** - Ask when:
- Scope is ambiguous (e.g., "add authentication")
- Technical approach unclear (e.g., "use caching")
- Requirement not measurable (e.g., "make it fast")

**Questioning behavior**:
- **Decision tree traversal**: Resolve parent decisions before child decisions
- **Codebase-first**: If question can be answered by exploring code, DO IT instead of asking
- **One at a time**: Ask single question, wait for response
- **Provide recommendation**: Always include "My recommendation: <answer>"
- **Unlimited depth**: Continue until clear, no artificial limits
- **Track progress**: Update exploration file after each exchange

#### 1.3.3 Domain-Modeling Integration

**Terminology sharpening (MANDATORY — execute per exchange)**:
Each time a vague or overloaded term is used, immediately:
1. Propose a precise canonical term with "My recommendation: use '<term>' — definition: <one-sentence>"
2. Wait for user confirmation
3. Once confirmed, **MUST write to \`openspec/CONTEXT.md\` NOW** (not batched, not deferred):
   \`\`\`
   **<Term>**: <one or two sentence definition>
   _Avoid_: <deprecated synonyms>
   \`\`\`
4. MUST also sync to exploration.md 术语表 section (format: \`| <Term> | <definition> | <avoid-list> |\`)
5. If CONTEXT.md does not exist yet, create it lazily at first term write
If user uses a term that conflicts with an existing CONTEXT.md entry, surface the conflict BEFORE accepting the usage.

**Code cross-validation**: When user makes a claim about existing code behavior, read relevant source files to verify. If code contradicts the claim, surface the contradiction immediately.

**Scenario construction**: For each confirmed decision, invent at least 1 boundary scenario to stress-test it (network failure, timeout, invalid input, concurrent access). Write scenarios to exploration.md 边界场景 section.

**ADR creation**: Offer ADR only when all three conditions are met: (1) hard to reverse, (2) surprising without context, (3) result of a real trade-off. ADR file at \`openspec/docs/adr/NNNN-slug.md\`. Create directory lazily.

#### 1.3.4 Implementation Detail Coverage Check

For each confirmed decision, verify coverage across 6 dimensions:
- 术语已精确定义 → CONTEXT.md
- 与现有代码一致 → 交叉验证
- 边界场景已讨论 → ≥1 个场景
- 错误路径已覆盖 → 异常策略
- 状态转换完整 → 所有路径
- 模块契约明确 → 入参/出参

Apply 5-level depth model with **Per-Level Confirmation Gates**. Ask ONE question per level and WAIT for user confirmation before proceeding to the next level:

**L1 — 意图 (What to do?)**:
- Ask: "What exactly should this feature do? My recommendation: <proposal>"
- Wait for user confirmation
- ✅ Confirmed → record in Decisions, proceed to L2

**L2 — 方案 (How to do it?)**:
- Ask: "What technical approach? My recommendation: <approach with rationale>"
- Wait for user confirmation
- ✅ Confirmed → record in Decisions, proceed to L3

**L3 — 异常 (What if it fails?)**:
- Ask: "How should errors be handled? My recommendation: <error strategy>"
- Wait for user confirmation
- ✅ Confirmed → record, proceed to L4 (may be skipped if user says "enough")

**L4 — 一致性 (Is it consistent?)**:
- **Cross-decision consistency check**: Read all recorded Decisions from exploration.md
  - For each decision pair, check for contradictions (e.g., Decision A selects SQLite, Decision B relies on Postgres features)
  - If contradiction found: "Decision A uses <X> but Decision B depends on <Y> which conflicts. Which direction should we follow?"
  - Wait for user confirmation
  - If no contradiction found, auto-mark as consistent (no user prompt needed)
- **Codebase cross-validation**: Cross-validate against existing code patterns (read files, don't ask unless needed)
  - If inconsistency found: "This conflicts with <existing pattern>. Which direction should we follow?"
  - Wait for user confirmation
- ✅ Confirmed → record, proceed to L5

**L5 — 边界 (When does it NOT apply?)**:
- Construct at least 1 boundary scenario and ask: "What about <edge case>? My recommendation: <handling>"
- Wait for user confirmation
- ✅ Confirmed → decision is complete

**Gate rules**:
- Each level = ONE question at a time, NO multi-question batches
- User MUST explicitly confirm (or skip) before next level
- Minimum depth: L3 (L1+L2+L3 all confirmed) before decision can be marked complete
- User can say "skip remaining levels" at any point — record skipped levels in Pending

#### 1.3.5 Artifact Synchronization

Sync grill-with-docs outputs to exploration.md in real-time:
- CONTEXT.md terms → exploration.md 术语表 section
- ADRs → exploration.md 架构决策 section
- Boundary scenarios → exploration.md 边界场景 section

### 1.4 Keyword Detection and Analysis

**Scan user input for keywords** before or during grill-with-docs questioning.

#### Keyword Detection Rules

**Layer 1: Category Keywords** (trigger analysis category)

| Category | Keywords |
|----------|----------|
| Security | security, authentication, auth, login, password, token, session, vulnerability, xss, sql injection, csrf, sanitization, validation, sanitize, escape |
| Architecture | architecture, refactor, restructure, migrate, move, rename, extract, merge, split, component, module, service, api, endpoint, route, call chain, dependency, integration |
| Business | business, workflow, process, flow, state, transition, rule, logic, validation, trigger, event, handler, step, procedure |
| Impact | impact, change, modify, update, delete, remove, add, replace, rename, signature, parameter, return type, breaking |

**Layer 2: Sub-category Keywords** (refine analysis type)

| Sub-category | Keywords |
|--------------|----------|
| Security.InputValidation | input, validate, sanitize, escape, user input, form, request, parameter |
| Security.Authentication | login, signin, authenticate, password, token, jwt, oauth, session |
| Security.DataFlow | data flow, track, trace, source, sink, propagate, tainted |
| Architecture.CallChain | call chain, caller, callee, invocation, dependency, reference, import |
| Architecture.DataFlow | data flow, model, entity, dto, vo, database, query, dao, mapper |
| Architecture.API | api, endpoint, route, handler, controller, request, response |
| Business.StateTransition | state, transition, status, change, trigger, event, condition |
| Business.Validation | validate, rule, check, constraint, requirement, condition |

**Layer 3: Context Modifier Keywords** (adjust analysis scope)

| Modifier | Keywords |
|----------|----------|
| Scope.Modify | modify, update, change, edit, refactor, enhance |
| Scope.Add | add, create, new, introduce, implement |
| Scope.Remove | remove, delete, drop, deprecate |
| Depth.Deep | deep, comprehensive, thorough, full, complete |
| Depth.Targeted | targeted, specific, particular, focused |

#### Detection Logic

\`\`\`
1. Exact match priority: Check exact keyword match first
2. Substring match: If no exact match, check substring presence
3. Case-insensitive: Match regardless of case
4. Multi-category: Allow multiple categories detected simultaneously
\`\`\`

#### Analysis Auto-Execution

**Single or multiple categories detected**:
> "Detected [Security/Architecture/Business] keywords. Running corresponding analyses automatically."

**Modifier detected**:
> "Detected [Modify] scope with [Deep] depth. Running deep analysis automatically."

Analyses execute directly upon keyword detection — do NOT offer run/skip options to the user. The recommended option ("Run all") is the default behavior.

#### Analysis Execution

**Security Analysis (Semgrep)**:
Semgrep MCP 为可选增强：不可用时该分析跳过并记录，不阻塞工作流。

\`\`\`bash
# Use MCP tool for security scanning
mcp__plugin_semgrep_semgrep__semgrep_scan --code-files <paths>

# Or for findings from platform:
mcp__plugin_semgrep_semgrep__semgrep_findings --repos <repo> --issue-type ISSUE_TYPE_SAST
\`\`\`

**Architecture Analysis (CodeGraph)**:
\`\`\`bash
# Use symbols from 1.2.1 base scan results (already searched)
# Find callers/callees for deeper understanding
mcp__codegraph__codegraph_callers --symbol <symbol>
mcp__codegraph__codegraph_callees --symbol <symbol>

# Build context after questioning (task description now clearer)
mcp__codegraph__codegraph_context --task <description>
\`\`\`

**Business Analysis (CodeGraph)**:
\`\`\`bash
# Use symbols from 1.2.1 base scan results (already searched)
# Build context from task description (after questioning, now clearer)
mcp__codegraph__codegraph_context --task <business-flow>

# Deep exploration of business logic
mcp__codegraph__codegraph_explore --query <topic>
\`\`\`

#### Analysis Results in Exploration File

Add Analysis section after Background:

\`\`\`markdown
## Analysis

### Security Findings
- <Vulnerability type>: <Affected area>
  Recommended fix: <Approach>

### Architecture Flow
<ASCII call chain diagram>

### Business Flow
<ASCII business process diagram>

### Identified Symbols
- <Symbol name> (<File location>)
  Reason: <Why identified>
  Priority: <Level>

## Questions
...
\`\`\`

#### Pending Section Enhancement

Add categorized subsections for Phase 2 attention:

\`\`\`markdown
## Pending

### For Phase 2 Impact Analysis
- <Symbol name> (<File location>) - Priority: HIGH

### Security Concerns
- <Vulnerability type>: <Affected area> - Fix: <Approach>

### Business Validation
- <Validation question>: <Context>
\`\`\`

#### Analysis-Driven Follow-Up Questions (NEW)

**After analysis completes**, automatically generate follow-up questions:

\`\`\`
Algorithm: generateFollowUpQuestions(analysisResults)

1. Security Findings → Generate questions:
   - HIGH/CRITICAL: "Fix XSS in <file>:<line>?" (auto-ask)
   - MEDIUM: "Address SQL injection in <file>?" (on request)
   - Include: vulnerability type, file path, fix recommendation

2. Architecture Symbols → Generate questions:
   - HIGH callers: "Update N callers of <symbol>?" (auto-ask)
   - MEDIUM callers: "Check callers of <symbol>?" (on request)
   - Include: call chain, impact scope, migration plan

3. Business Steps → Generate questions:
   - Decision triggers: "Is <trigger> correct?" (auto-ask)
   - State transitions: "Validate transition rules?" (on request)
   - Include: state change, validation rule, edge cases
\`\`\`

**Question Priority Logic**:
- **HIGH priority**: Automatically ask (Security CRITICAL, Architecture breaking changes, Business decisions)
- **MEDIUM/LOW priority**: Ask only when user requests: "Show me all follow-up questions"

**Depth-First Questioning**:
- From discovered vulnerability → ask about related security areas
- From breaking change → ask about migration strategy and deprecation timeline
- From decision point → ask about edge cases and error handling

**Example**:
\`\`\`
After Security analysis finds XSS vulnerability:

AI: "Security analysis found XSS vulnerability in sanitizeInput() at user-utils.ts:45.
    How should we fix it?
    My recommendation: Use DOMPurify for HTML sanitization in this area.

    [Depth-first]
    Should we also check other sanitization points in the authentication flow?
    My recommendation: Yes - review all input validation in auth module."
\`\`\`

### 1.4.5 Implementation Deep-Dive Analysis (NEW)

**Trigger**: When layered trigger mechanism detects Scope.Modify, Scope.Add + existing code touch, or Depth.Deep keywords.

**Purpose**: Go beyond surface analysis ("what calls what") to understand WHY the code is designed this way before making changes.

**Analysis Dimensions**:

| Dimension | Primary Source | Backup Source |
|-----------|---------------|---------------|
| Design Rationale | Code comments, JavaDoc/docstring | ADR docs, README, design docs |
| Constraints | package.json engines, tsconfig, linter configs | .browserslistrc, CI configs |
| Trade-offs | TODO/FIXME/HACK comments | Code review records, benchmarks |
| Pattern Usage | Class/interface structure, naming conventions | Design pattern library matching |
| Historical Context | \`git log --follow\`, \`git blame\` | CHANGELOG.md, version tags |
| Implicit Assumptions | Type guards, default values, missing null checks | Env var dependencies, magic numbers |

**Scope Control** (by trigger level):

| Trigger Level | Dimensions | Max Symbols |
|--------------|------------|-------------|
| 🔴 Auto (Scope.Modify) | All 6 dimensions | 10 core symbols |
| 🟡 Prompt (Scope.Add) | Rationale + Constraints + Assumptions | 10 core symbols |
| 🟢 Manual (Depth.Deep) | User-selected | 10 core symbols |

**Confidence Marking**:
- \`HIGH\`: Found in code comments, ADRs, or design docs — explicitly documented
- \`MEDIUM\`: Inferred from git history, naming patterns, or structural analysis
- \`LOW\`: AI inference from code patterns — MUST generate follow-up question for user confirmation

**Integration with Grill-With-Docs**:
- LOW confidence findings → auto-generate follow-up questions
- Implicit assumptions → always generate confirmation questions
- Trade-offs → ask if they still hold for current requirements

**Output**: Write findings to exploration.md \`## Implementation Deep-Dive\` section.
Sub-sections with no findings are marked \`<!-- No findings -->\`.
The entire section is conditionally shown — only when deep analysis is triggered.

### 1.5 Update Exploration File

**After each exchange, perform these steps in order**:

**Step 1 — Write to CONTEXT.md (MANDATORY if term resolved)**:
- If a term was resolved in this exchange, MUST write to \`openspec/CONTEXT.md\` NOW
- Use format: \`**<Term>**: <definition>\\\\n_Avoid_: <synonyms>\`
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

${FLOWCHART}

**本技能内的执行要求**：

- **强制产出**：把探索发现的业务功能流程固化为探索文件 1.2 结构中的 \`## 功能流程图\` 段（该段已在 1.2 预留）；Mermaid 流程图与节点清单表的节点 id MUST 稳定一致
- **节点证据追溯**：每节点 MUST 填证据位置——既有代码标 \`文件:行\` 或 类.方法，**新建功能**节点标 \`[新建]\` 并写明预期产物（新增哪个类 / 页面 / 接口）；**无法追溯证据的节点 MUST NOT 进入清单**
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

1. **Check if \`openspec/CONTEXT.md\` exists** using Glob or Read tool

2. **If EXISTS**: Validate all terms in exploration.md 术语表 section are written to CONTEXT.md
   - Read CONTEXT.md content
   - Compare with exploration.md 术语表 section
   - If terms missing from CONTEXT.md, auto-sync them (write missing terms)
   - Log: "CONTEXT.md validated — <N> terms synced"

3. **If NOT EXISTS**: Auto-generate CONTEXT.md from exploration.md 术语表 section
   - Create \`openspec/CONTEXT.md\` with all resolved terms
   - Format: \`**<Term>**: <definition>\\\\n_Avoid_: <synonyms>\`
   - Log: "CONTEXT.md created — <N> terms from exploration"

4. **Compatibility check** (Task 12.1, narrowed): If no exploration file exists (e.g., running \`venus:spec-apply\` on existing change):
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

This gate is the backstop for the per-decision L4 check (1.3.4). The L4 check runs incrementally per new decision and auto-marks "no conflict" silently — late Scope Changes can introduce cross-decision contradictions that L4 never re-scans. This gate reads ALL recorded Decisions together and catches such residual contradictions. **This gate is NOT exempt** by the Task 12.1 "no exploration file" skip.

After the 1.6.5 CONTEXT.md checkpoint, system MUST execute the aggregate scan:

1. **Read all Decisions** from exploration.md \`## Decisions\` section

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
   - Record the resolution in exploration.md \`## Scope Changes\` / \`## Decisions\`

5. **If no hard conflict**: log "Aggregate consistency gate passed — <N> decisions scanned, 0 hard conflicts" and proceed to Phase 2

**Checkpoint Enforcement**:
- System MUST execute this gate after 1.6.5 and before 1.7 / Phase 2
- This gate MUST NOT be skipped via the Task 12.1 "no exploration file" exemption (that exemption is CONTEXT.md-only)
- Soft inconsistencies (style, naming) do NOT block; only the three hard-conflict types block

### 1.7 Abandon Exploration Handling

If user says "abandon", "stop", "cancel":
> "Delete exploration file or keep it?"
> [Delete] [Keep]

- **Delete**: Remove file from \`openspec/explorations/\`
- **Keep**: File remains for future reference

---

## Phase 2: Proposal

**TodoWrite tracking**: Add Phase 2 items to TodoWrite:
\`\`\`
- [ ] Phase 2: 预迁移验证
- [ ] Phase 2: 创建变更 + 迁移探索文件
- [ ] Phase 2: proposal.md
- [ ] Phase 2: specs/*.md
- [ ] Phase 2: design.md
- [ ] Phase 2: tasks.md
- [ ] Phase 2: Artifact 验证
\`\`\`

### 2.0 Pre-Migration Verification (MANDATORY CHECKPOINT)

**⚠️ MANDATORY: Migration verification before Phase 2 proceeds**

Before creating change directory and migrating exploration file:

#### Verification Steps

1. **Check exploration file exists**
   \`\`\`bash
   # Read exploration.md from openspec/explorations/
   # If file missing, system MUST warn user
   \`\`\`

2. **CONTEXT.md validation (MANDATORY CHECKPOINT)**
   - Check if \`openspec/CONTEXT.md\` exists
   - If EXISTS: Validate all terms from exploration.md 术语表 are in CONTEXT.md
     - If terms missing, auto-sync them
   - If NOT EXISTS: Auto-generate from exploration.md 术语表 section
     - Create \`openspec/CONTEXT.md\` with all resolved terms
   - **Compatibility (Task 12.1, narrowed)**: If no exploration file exists (after 1 path-resolution retry), log WARN "Skipping CONTEXT.md check: no exploration file" and skip the CONTEXT.md check ONLY. This skip does NOT exempt the 1.6.6 aggregate consistency gate.
   - Log: "CONTEXT.md validated/created — <N> terms"

3. **Validate file content**
   - Check file has minimum required sections (Background, Decisions)
   - If sections missing, warn user and offer recovery options

4. **Handle missing file**
   - **Option A**: Create new file from exploration memory
   - **Option B**: Abort transition and return to exploration
   - User MUST choose before proceeding

#### Migration Failure Recovery

**If migration fails**:
- Preserve source file unchanged
- Clean up partial destination file
- Report error with specific failure reason
- Offer retry or manual migration instructions
- Log failure for user tracking

**Failure Handling Process**:
\`\`\`
1. Source file locked → Unlock or retry
2. Permission denied → Request permissions or manual migration
3. Disk full → Clean up space or manual migration
4. Network error → Retry or manual migration
\`\`\`

**Checkpoint Enforcement**:
- System MUST NOT proceed to artifact generation without valid migration
- If migration fails, system MUST preserve source file
- User MUST be informed of migration status and any errors

#### Impact Trigger Detection

Read exploration.md Pending section:
\`\`\`
If "### For Phase 2 Impact Analysis" section exists AND has symbols:
  Run impact analysis directly (no prompt)
\`\`\`

#### Impact Auto-Execution

> "Found symbols for impact analysis in exploration — running impact analysis automatically. Ensures artifacts include impact context."

Impact analysis always runs when the Pending section contains symbols. No user prompt.

#### Impact Execution

**Use CodeGraph impact tool**:
\`\`\`bash
mcp__codegraph__codegraph_impact --symbol <symbol> --direction upstream --maxDepth 3
\`\`\`

**Parallel execution for multiple symbols**: When two or more impact symbols are identified, issue the impact queries in parallel (multiple tool calls in a single response round) instead of one at a time. Merge all results into the artifact impact sections. A single symbol keeps the existing single-query behavior.

**Impact result structure**:
\`\`\`
{
  risk: "HIGH" | "MEDIUM" | "LOW" | "CRITICAL",
  summary: { directCallers, processesAffected, modulesAffected },
  affected_processes: [...],
  affected_modules: [...],
  byDepth: {
    d1: [direct callers],
    d2: [indirect callers],
    d3: [transitive callers]
  }
}
\`\`\`

#### Store Impact Results

Store results for artifact generation:
- proposal.md: Include ## Impact Analysis section
- design.md: Include ## Architecture Impact section
- tasks.md: Include ### Caller Updates section

#### Impact Skip Handling

If no impact symbols are found:
- Proceed with artifact generation without impact sections
- proposal.md, design.md, tasks.md do not contain Impact sections

#### Direct Transition to Inline Generation (method selection removed)

**⚠️ Complexity assessment and generation-method selection are REMOVED from Phase 2.**

After Phase 2.0 impact analysis completes (or is skipped):
- Proceed DIRECTLY to Phase 2.3 (migrate exploration file) and Phase 2.4 (inline artifact generation)
- Use the propose-style one-step inline generation for ALL changes regardless of scope
- Do NOT compute a complexity score and do NOT display generation-method options
- Step-by-step creation remains available outside this workflow via venus spec new (step-by-step artifact creation)

**Checkpoint Enforcement**:
- System MUST NOT prompt the user to select a generation method
- System MUST NOT display complexity evaluation results
- System MUST proceed directly from Phase 2.0 to Phase 2.3

### 2.3 Migrate Exploration File (MANDATORY CHECKPOINT)

Move exploration file to change directory BEFORE artifact generation:

\`\`\`bash
# Generate kebab-case change name from exploration content
venus spec new "<change-name>"
\`\`\`

The name should reflect actual scope determined during exploration.

\`\`\`
Source: openspec/explorations/<keyword>-explore-<sequence>.md
Destination: openspec/changes/<change-name>/exploration.md
\`\`\`

**Cross-platform**: Use \`path.join()\` for all paths.

**Failure handling**:
- If migration fails, preserve source file
- Report error with specific reason
- Offer retry or manual migration

**Post-Migration: Source File Preservation** (Task 7.1):

After successful migration, system MUST preserve the source exploration file (do NOT delete):

1. **Keep source file** at \`openspec/explorations/<keyword>-explore-<sequence>.md\`
   - Use \`path.join()\` for cross-platform path
   - Source file is retained for reference after migration success

2. **Preservation rules**:
   - **Migration succeeded**: Keep source file, log "Source exploration file preserved: <path>"
   - **Migration failed**: Preserve source file, do NOT delete
   - **Partial migration**: If destination file exists but verification failed, keep source file

3. **Log preservation status**:
   - Success: "✓ Source file preserved (not deleted): <path>"
   - Skipped: "Source file preserved (migration failed): <path>"

**Checkpoint Enforcement**:
- System MUST verify migration success before cleaning up source file
- If migration fails, system MUST preserve source file
- System MUST log preservation action for transparency

**Checkpoint Enforcement**:
- System MUST verify migration success before proceeding to artifact generation
- If migration fails, system MUST preserve source file
- User MUST be informed of migration status and any errors

### 2.4 Artifact Generation (Inline)

**⚠ MANDATORY: Phase 2.4 MUST use inline CLI commands for artifact generation**

After migration, read the exploration.md from the change directory and extract content for each artifact type BEFORE generating inline.

#### Exploration Content Extraction Rules

Read \`openspec/changes/<change-name>/exploration.md\` and extract content per these rules:

| Exploration Section | Extraction Target | Artifact Mapping |
|--------------------|-------------------|------------------|
| **Decisions** | Extracted into proposal.md | Why, What Changes, Capabilities sections |
| **Analysis** (Security, Architecture, Business) | Extracted into design.md | Context, Decisions sections |
| **Questions** | Extracted into specs | Requirement scenarios and boundary conditions |
| **Codebase Findings** | Extracted into tasks.md | Implementation task details and file references |

**Extraction Process**:
1. Read exploration.md from change directory
2. For each section, extract relevant content per the mapping table
3. Use extracted content as context for inline artifact generation
4. Log: "Using exploration content as input for inline artifact generation"

#### Pre-Generation: Rule File Scan (MANDATORY CHECKPOINT)

**⚠️ MANDATORY: Scan project rules files before design.md generation**

Before generating design.md (and any other artifact), system MUST scan project rules files:

1. **Scan \`openspec/rules/ai-coding.md\`** (if exists):
   - Read Section 1 (Zero-Assumption) — apply as constraint during artifact generation
   - Read Section 2 (Design-First) — apply as constraint during design
   - Read Sections 3-5 (Data, Architecture, Frontend rules) — apply as constraints
   - If file does not exist: log "Rules file not found, skipping rule scan" and continue

2. **Scan \`openspec/config.yaml\`**:
   - Read \`context\` field — inject as project context constraint
   - Read \`rules\` field — inject as per-artifact rules constraint
   - Use these as AI constraints for generation, NOT written into artifact files

3. **Result**: Rules are injected as AI constraints (not written to files). If rules were found, log "Rules loaded from <path>". If not found, log "No rules file found" and continue without blocking.

#### Inline Generation (single path, propose-style)

**⚠️ The generation-method branches are REMOVED. All changes use one-step inline generation.**

\`\`\`
WHEN Phase 2.3 migration completes:
THEN execute artifact generation inline following the shared protocol at openspec/rules/artifact-generation.md:
  - venus spec new "<name>" (creates change directory)
  - Loop: venus spec status --json → venus spec instructions --json → write file
  - Continue without intermediate prompts until all applyRequires done

System shows progress: "已创建 proposal.md (1/4)", etc.
System completes when all applyRequires artifacts are done
After all artifacts complete, automatically proceed to validation then Phase 3 verification
\`\`\`

**Artifact Generation Rules**:
- **MUST NOT invoke Skill tool** (no \`Skill("venus:spec-propose")\`; step-by-step creation via \`venus spec new\` is CLI-based, not Skill-based)
- **MUST follow the shared protocol** at \`openspec/rules/artifact-generation.md\`
- **All artifacts generated in one flow**
- **Exploration content passed as context**

#### CLI Command Failure Handling

During inline generation, handle CLI failures:

**CLI availability detection (first-call failure signature)**:

- **First \`venus spec status\` or \`venus spec list\` Bash call fails with a command-not-found error** (e.g., "command not found", "不是内部或外部命令", "not recognized"): conclude the venus CLI is not installed. Tell the user in one line — "venus CLI not found in PATH — switching to CLI-degraded generation mode" — and switch to CLI-degraded generation mode. Do NOT repeat this notice mid-flow.
- **Other errors** (e.g., JSON parse failure, artifact not found): do NOT enter degraded mode; use the failure interactions below.

**CLI-degraded generation mode** (active after command-not-found detection):

- Abandon the \`venus spec status\`/\`venus spec instructions\` loop — do NOT attempt further \`venus spec status\`/\`venus spec instructions\` calls during the flow
- Generate artifacts directly via AI in the template's built-in dependency order (proposal → specs → design → tasks) using the template-embedded structure rules (Phase 2.5 guidelines)
- **Degraded change discovery (when no change name is specified)**: scan \`openspec/changes/*/ \` directories (excluding \`archive/\`) with Glob; when multiple candidates exist, let the user choose via AskUserQuestion
- **Degraded artifact status inference**: infer completion from file existence (\`proposal.md\`, \`specs/\`, \`design.md\`, \`tasks.md\` under the change directory) — an artifact exists when its file is present, without CLI validation
- **Degraded flow end**: state exactly once — "This run used CLI-degraded generation. Installing the venus CLI is recommended for validation and build-order guarantees." Do NOT repeat the reminder elsewhere in the flow

**Other CLI failures** (CLI installed):

- **venus spec new fails**: Display error + options: [重试] [手动修复后继续] [中止]. Preserve exploration file.
- **venus spec instructions fails**: Display artifact ID + error + options: [重试当前artifact] [跳过当前artifact] [中止]. Preserve already-created artifacts.
- **File write fails**: Display path + error reason + options: [重试] [中止]. Do NOT mark artifact as done.
- **Recovery**: On retry, re-run \`venus spec status --json\`, resume from first \`status: "ready"\` artifact. Do NOT regenerate already-completed artifacts.

**Guardrails Against Skill Delegation (artifact generation only)**:
- This guardrail applies ONLY to **artifact generation** (proposal/specs/design/tasks) — those MUST be generated inline using the shared protocol for workflow continuity. Do NOT invoke Skill('venus:spec-propose') to generate artifacts (step-by-step creation via venus spec new is CLI-based, not Skill-based).
- This guardrail does NOT cover **verification** — Phase 3 verification (3.2) MUST invoke the \`venus_spec_verify_proposal\` skill (and, on pass, the \`venus_tr_impl_review_proposal\` skill). Verification-class Skill calls are allowed and required; the inline-only rule above is for artifact generation.
- If workflow attempts artifact generation via Skill tool: STOP
- Warn: "Artifacts MUST be generated inline using the shared protocol for workflow continuity. Do NOT invoke Skill('venus:spec-propose') (step-by-step creation via venus spec new is CLI-based)."
- Do not proceed until inline method is used

### 2.5 Artifact Creation Guidelines

**⚠️ NOTE: Guidelines are enforced by Phase 2.4 inline generation**

The following guidelines are automatically enforced by inline generation:
- Schema compliance handled by inline generation following the shared protocol at \`openspec/rules/artifact-generation.md\`

- Base specs/design/tasks on exploration Decisions section
- Ensure every decision has corresponding artifact content
- Follow schema's \`instruction\` field for each artifact type
- Do NOT copy \`context\`/\`rules\` into files - they're constraints for YOU

#### Include Analysis Results in Artifacts

**If analysis was run**, include results:

| Artifact | Impact Section | Content |
|----------|-------------------------|---------|
| proposal.md | ## Impact Analysis | Affected Components table, Breaking Changes, Migration Path |
| design.md | ## Architecture Impact | Call chain changes, integration points |
| tasks.md | ### Caller Updates | Caller update tasks with risk level |
| tasks.md | ### Security Updates | Security fix tasks from findings |
| tasks.md | ### Business Steps | Business rule update tasks |

**Example proposal.md Impact section**:
\`\`\`markdown
## Impact Analysis

### Affected Components

| Component | Risk | Changes Required |
|-----------|------|------------------|
| AuthService | HIGH | Update login flow |
| SessionManager | MEDIUM | Add token validation |

### Breaking Changes
- Session token format changed (v1 → v2)

### Migration Path
1. Deploy new token service
2. Run migration script
3. Deprecate old tokens
\`\`\`

**Task Type Labels (for tasks.md generation):**
- Each task MUST include a type label: \`- [ ] [代码] N.M ...\` or \`- [ ] [DB脚本] N.M ...\` etc.
- Supplement tasks (non-\`[代码]\`) MUST include \`产出:\` field as indented content
- Default output path: \`attachments/<filename>\` (relative to changeRoot)
- See \`schemas/spec-driven/templates/tasks.md\` template for full label reference

### 2.6 Validate Artifacts (MANDATORY)

**⚠️ MANDATORY: Validate all artifacts conform to schema requirements**

After artifacts are generated, validate:

#### Validation Steps

1. **Validate proposal.md**:
   - Check required sections: Why, What Changes, Capabilities, Impact
   - Check Capabilities lists New or Modified capabilities
   - Warn if sections are empty

2. **Validate specs/*.md**:
   - Check for ADDED/MODIFIED/REMOVED/RENAMED headers
   - Check scenarios use \`#### Scenario:\` format (4 hashtags)
   - Check scenarios use - **WHEN** / - **THEN** / - **AND** format

3. **Validate tasks.md**:
   - Check tasks use \`- [ ] X.Y Task description\` checkbox format
   - Check tasks are grouped under numbered section headers
   - Warn if no checkbox tasks found

#### Validation Report

\`\`\`
## Artifact Validation Report

### Proposal Validation
Status: ✓ PASS
File: openspec/changes/<name>/proposal.md

### Specs Validation
openspec/changes/<name>/specs/auth/spec.md: ✓ PASS
openspec/changes/<name>/specs/session/spec.md: ✗ FAIL
  - [ERROR] Scenarios must use #### Scenario: format (4 hashtags, not 3)

### Tasks Validation
Status: ✓ PASS
File: openspec/changes/<name>/tasks.md

**Overall**: ✗ FAIL - 1 error found

### Options:
[1] Fix errors now
[2] Proceed anyway (with warnings)
[3] Re-generate artifacts
\`\`\`

#### Handling Validation Failures

- **Critical errors** (missing sections, wrong format): MUST fix before proceeding
- **Warnings** (empty sections, non-standard format): Offer to fix or proceed
- User decides: Fix now, Proceed anyway, Re-generate artifacts

---

## Phase 3: Verification

**Phase 3 executes automatically after inline artifact generation completes in Phase 2.4. No Skill delegation gap — workflow context remains active throughout.**

**TodoWrite tracking**: Add Phase 3 items to TodoWrite:
\`\`\`
- [ ] Phase 3: D1 需求覆盖
- [ ] Phase 3: D2 技术一致性
- [ ] Phase 3: D3 任务完整性
- [ ] Phase 3: D4 边界覆盖
- [ ] Phase 3: D5 Pending 解决
- [ ] Phase 3: D6 深度分析覆盖
\`\`\`

After all artifacts are generated and validated in Phase 2.5, automatically enter Phase 3 verification.

### 3.1 Auto-Execute Verification (No User Prompt)

**⚠️ Verification is now AUTOMATIC — no user choice prompt**

After all artifacts are generated and validated in Phase 2.5, system MUST automatically enter Phase 3 verification without asking the user:

1. **Skip method-specific prompt** — Do NOT show "Propose 方式一步生成，建议运行验证" or "已通过逐步迭代创建，验证可选"
2. **Skip user choice** — Do NOT ask [立即验证] / [跳过验证]
3. **Execute directly** — Proceed to 3.2 Verification Execution

### 3.2 Verification Execution

Execute D1-D5 core verification by **invoking the \`venus_spec_verify_proposal\` skill** (NOT a CLI instruction):

\`\`\`bash
# Resolve change status first
venus spec status --change "<name>" --json
# Then invoke the verification skill (venus_spec_verify_proposal is a SKILL name, not a valid
# \`venus spec instructions\` artifact ID — valid artifact IDs are proposal/specs/design/tasks only.
# Running \`venus spec instructions venus_spec_verify_proposal\` errors with "Artifact not found".)
\`\`\`

Invoke the skill: use the Skill tool to call \`venus_spec_verify_proposal\` for change \`<name>\`. The skill performs inline D1-D5 scoring by reading the artifacts and exploration.md; it does not depend on any CLI verify command (none exists — the venus CLI only has \`validate\` for schema-level checks).

**Fallback (skill unavailable)**: If the \`venus_spec_verify_proposal\` skill is not installed or its invocation fails, fall back to AI inline reading of proposal/specs/design/tasks + D1-D5 manual scoring, and emit WARN log: "venus_spec_verify_proposal skill unavailable, degraded to inline scoring". Do NOT silently skip verification.

Execute 5-dimension verification:
1. **D1: Requirement Coverage** — Decisions → spec requirements
2. **D2: Technical Consistency** — Technical choices → design.md
3. **D3: Task Completeness** — Spec requirements → tasks
4. **D4: Boundary Coverage** — Questions/edge cases → spec scenarios
5. **D5: Pending Resolution** — Pending items → resolved
6. **D6: Deep Analysis Coverage** — Deep analysis completeness → Implementation Deep-Dive section

### 3.3 Quantified Score Report

Display verification results with scores:

\`\`\`
## Verification Report

| Dimension | Coverage | Status |
|-----------|----------|--------|
| D1: Requirements | 85% | PASS |
| D2: Technical | 90% | PASS |
| D3: Tasks | 100% | PASS |
| D4: Boundaries | 70% | FAIL |
| D5: Pending | 100% | PASS |
| D6: Deep Analysis | N/A | PASS |

**Overall Score**: 89%
\`\`\`

Score interpretation (unified 90% threshold — the previous 70%/90% dual-band is removed):
- ≥90%: High quality, ready for implementation (PASS — auto-trigger deep review per 3.5)
- <90%: Needs revision before implementation (FAIL — auto-fix per 3.6)

### 3.4 Tech Stack Detection

Detect tech stack from \`openspec/config.yaml\` context field:

\`\`\`bash
# Read config.yaml and parse context field
# Match keywords: TypeScript, Java/JSP, Python, Go, Rust
\`\`\`

If tech stack detected:
> "Detected tech stack: [TypeScript]. Run tech-specific validation?"
> [Yes] [No - basic only]

### 3.5 Verification Pass → Auto-Trigger Deep Review → Auto-Generate Requirement Doc

When ALL dimensions PASS (≥90%):

1. **Auto-execute deep review** — Invoke the \`venus_tr_impl_review_proposal\` **skill** (via Skill tool) — Do NOT ask user, auto-execute (user can interrupt to skip)
2. Deep review scope: codebase deep exploration + multi-dimensional completeness
3. Display results alongside verification report
4. **Fallback (skill unavailable or call fails)**: degrade to main-workflow inline read-only deep review + WARN log — never silently skip

> "Verification passed! All D1-D5 ≥90%. Auto-running venus_tr_impl_review_proposal..."
> [deep review results displayed]

If user wants to skip the deep review, they can interrupt. Otherwise it runs automatically.

5. **Auto-generate requirement document** — After deep review completes, invoke the \`venus_tr_docs_requirement_doc\` **skill** (via Skill tool) in **non-interactive mode**:
   - Markdown format, placeholder basic information (需求编号/需求名称/交付时间 as placeholders)
   - Do NOT ask the user any questions
   - Output: \`openspec/changes/<change-name>/需求文档.md\`
   - Display the generated document path alongside the verification report
   - **Failure handling**: if generation fails or is interrupted, log WARN with the reason and CONTINUE the workflow — the user can re-run the skill standalone later

> "Deep review complete. Auto-generating requirement document..."
> "✓ 需求文档已生成: openspec/changes/<change-name>/需求文档.md"

### 3.6 Verification Fail → Auto-Fix and Re-run

**On FAIL, do NOT generate the requirement document.** Generation happens only after fixes pass re-verification (then 3.5 step 5 runs).

When ANY dimension FAILS (<90%), system MUST auto-fix:

1. **Auto-generate fix suggestions**:
   - For each FAIL dimension, generate specific fixes (missing scenarios, incomplete sections)
   - Example: D4 missing boundary scenario → add scenario to spec

2. **Apply fixes** to artifact files using Edit tool

3. **Auto re-run verification** after fixes applied

4. **Display fix summary**:
   \`\`\`
   ## Auto-Fix Applied
   - D4: Added 2 boundary scenarios to specs/auth/spec.md
   - D1: Added 1 requirement scenario to specs

   Re-running verification...
   \`\`\`

5. **If re-run passes**: Proceed to 3.5 (auto-trigger deep review)
6. **If re-run still fails**: Show remaining issues and offer options (no skip-to-apply path):
   > [1] Manual edit — Fix artifacts yourself
   > [2] Return to exploration — Add missing decisions
   > [3] View detailed diff report

---

## Output During Workflow

### Example 1: Propose Method (Low Complexity)

\`\`\`
## Exploration Phase

**Checkpoint: Creating exploration file**
✓ Created: openspec/explorations/user-auth-explore-001.md
✓ Verified: File exists and is writable
✓ Ready to proceed with exploration

Question 1: What authentication methods?
Your answer: Email/password + OAuth
→ Recorded in Decisions

Question 2: OAuth providers needed?
Your answer: Google, GitHub
→ Recorded in Decisions

[Continues until clear...]

## Exploration Complete ✓

Checks passed — generating proposal directly

## Proposal Phase

**Checkpoint: Pre-migration verification**
✓ Verified: openspec/explorations/user-auth-explore-001.md exists
✓ Validated: File has Background and Decisions sections

**Checkpoint: Direct transition to inline generation (Phase 2.1)**
✓ Skipped complexity evaluation (removed)
✓ Skipped method selection (removed)
✓ Proceeding directly to inline propose-style generation

**Checkpoint: Artifact generation (Phase 2.4)**
✓ Created change directory: openspec/changes/add-user-auth/
✓ Executing inline artifact generation
✓ Generated: proposal.md (1/4)
✓ Generated: specs/auth/spec.md (2/4)
✓ Generated: design.md (3/4)
✓ Generated: tasks.md (4/4)
✓ All artifacts complete

## Verification Phase

Phase 3 验证自动执行，无询问（不因 Propose 方式而询问 [立即验证]/[跳过验证]）

Auto-invoking \`venus_spec_verify_proposal\` skill for D1-D5 scoring...

Running 5-dimension verification...

| Dimension | Coverage | Status |
|-----------|----------|--------|
| D1: Requirements | 85% | PASS |
| D2: Technical | 90% | PASS |
| D3: Tasks | 100% | PASS |
| D4: Boundaries | 70% | FAIL |
| D5: Pending | 100% | PASS |
| D6: Deep Analysis | N/A | PASS |

Overall Score: 89% (<90%, FAIL)

D4 auto-fix: adding missing boundary scenarios to specs/auth/spec.md...
Artifacts updated. Re-running verification...

Re-run Overall Score: 92% (≥90%, PASS) → auto-triggering venus_tr_impl_review_proposal deep check...

[deep review results displayed]

✓ 需求文档已生成: openspec/changes/add-user-auth/需求文档.md

## Verification Complete ✓

All artifacts ready! Run \`/venus:spec-apply\` to implement.
\`\`\`

### Example 2: Direct Pass with Requirement Document Generation

\`\`\`
## Exploration Phase

**Checkpoint: Creating exploration file**
✓ Created: openspec/explorations/complex-refactor-explore-001.md
✓ Verified: File exists and is writable

[Complex exploration with multiple modules...]

## Exploration Complete ✓

Checks passed — generating proposal directly

## Proposal Phase

**Checkpoint: Pre-migration verification**
✓ Verified: exploration.md exists

**Checkpoint: Direct transition to inline generation (Phase 2.1)**
✓ Skipped complexity evaluation (removed)
✓ Skipped method selection (removed)

**Checkpoint: Artifact generation (Phase 2.4)**
✓ Created change: openspec/changes/complex-refactor/
✓ Executing inline artifact generation
✓ Generated: proposal.md (1/4)
✓ Generated: specs/module1/spec.md (2/4)
✓ Generated: specs/module2/spec.md (3/4)
✓ Generated: design.md (4/4)
✓ All artifacts complete

## Verification Phase

Phase 3 验证自动执行，无询问

Auto-invoking \`venus_spec_verify_proposal\` skill for D1-D5 scoring...

Running 5-dimension verification...

| Dimension | Coverage | Status |
|-----------|----------|--------|
| D1: Requirements | 92% | PASS |
| D2: Technical | 95% | PASS |
| D3: Tasks | 100% | PASS |
| D4: Boundaries | 90% | PASS |
| D5: Pending | 100% | PASS |
| D6: Deep Analysis | N/A | PASS |

Overall Score: 95% (≥90%, PASS) → auto-triggering venus_tr_impl_review_proposal deep check...

[deep review results displayed]

Deep review complete. Auto-generating requirement document...
✓ 需求文档已生成: openspec/changes/complex-refactor/需求文档.md

## Verification Complete ✓

All artifacts ready! Run \`/venus:spec-apply\` to implement.
\`\`\`

**Checkpoint Log Format**:
- Each checkpoint shows: ✓/✗ status, file path, verification result
- Failures show: ✗ operation, error reason, recovery options
- All operations logged for transparency

---

## Cross-Platform Considerations

- Always use \`path.join()\` for file paths
- Never hardcode forward/backward slashes
- Test path operations on Windows, macOS, Linux
- Use \`path.resolve()\` for absolute paths when needed

---

## Guardrails

- **Don't skip questioning** - Keep asking until truly clear
- **Don't auto-proceed on conflict** - Phase transitions proceed automatically when the 1.6 consistency checks pass (consistency passthrough); ask the user only when a hard conflict is detected
- **Do execute read-only operations directly** - File reading, CodeGraph queries, and analysis steps (Semgrep, impact analysis) run without asking the user for confirmation
- **Read-only passthrough does not cover clarification gates** - grill L1-L5 requirement-clarification gates still wait for user confirmation
- **Do auto-verify** - Automatically verify after proposal without user prompt
- **Don't lose exploration** - File persists even on abandon (unless deleted)
- **Don't force fixes** - Offer options on verification fail, user decides
- **MUST create file before questioning** - Phase 1 checkpoint is mandatory
- **MUST validate prompt before exploring** - 1.1.2 提示词校验门是强制 checkpoint：清晰输入一句话复述理解后直通（不输出校验表、不要求确认）；不明确输入须先做提示词优化并等待用户确认或修改，未确认前 MUST NOT 推进到 1.1.5 及之后的任何步骤
- **Don't deadlock on the confirmation gate** - 1.1.2 确认门有四条出口（确认 / 修改 / 拒绝后按原理解继续 / 显式授权按推断继续），不得反复要求确认而陷入等待死循环
- **Do persist the prompt baseline** - 原始提示词与确认后的基线一并写入探索文件 \`## 提示词基线\` 段；基线变更 MUST 回到 1.1.2 重新确认
- **MUST produce the functional flowchart** - 1.5.5 是强制 checkpoint：探索分析完成后 MUST 产出探索文件 \`## 功能流程图\` 段（Mermaid + 节点清单）并执行流程最终确认门；用户确认前 MUST NOT 进入 1.6，MUST NOT 把未确认流程图当作提案锚点
- **Don't deadlock on the flowchart gate** - 1.5.5 确认门有四条出口（确认 / 修改 / 拒绝后记录未确认状态并按原理解继续 / 显式授权按推断继续），拒绝时 propose 降级为仅凭 exploration.md、verify 节点覆盖度维度 SKIP，不得反复要求确认
- **MUST NOT silently add nodes in tasks** - 发现遗漏节点 MUST 回到 1.5.5 更新流程图并重新经用户确认，MUST NOT 在 tasks.md 中静默补节点
- **MUST verify file before migration** - Phase 2 checkpoint is mandatory
- **MUST preserve source on migration failure** - Never lose user data
- **MUST NOT offer method selection** - Phase 2 proceeds directly to inline propose-style generation (complexity evaluation and method selection removed)
- **MUST use inline generation for artifacts** - Phase 2.4 uses inline CLI commands following shared protocol, no Skill delegation
- **Do explore codebase** - Before asking, check if codebase answers the question
- **Do provide recommendations** - Every question includes AI's recommendation
- **Do update file real-time** - After each exchange, write to exploration file
- **Do use structured format** - Background, Questions, Decisions, Pending sections
- **Do show quantified scores** - Verification results include coverage percentages
- **Do auto-execute deep review** - After pass, auto-trigger venus_tr_impl_review_proposal skill (user can interrupt to skip); fallback to inline read-only deep review + WARN on skill unavailable or call failure — never silently skip
- **Do log checkpoint status** - Inform user of file creation, verification, migration status
- **Do inject capability memory** - Phase 1 reads specs/<capability>/explorations.md when it exists
- **Do scan other projects with CodeGraph** - When exploration context contains other project paths, spawn sub-agent to scan them using CodeGraph projectPath parameter; fall back to Glob/Grep on failure
- **Do auto-generate requirement doc** - After full pass (D1-D5 + deep review), invoke venus_tr_docs_requirement_doc non-interactively; on FAIL do not generate; on generation failure WARN and continue`,
        allowedTools: 'Read, Write, Edit, Glob, Grep, Bash(venus:*), Bash(git:*), Bash(codegraph:*), Bash(ls:*)',
        type: 'tr_impl',
        license: 'MIT',
        compatibility: '依赖 venus CLI（spec 命令组）；CLI 缺失时降级为 AI 内联生成（CLI-degraded generation）。',
        metadata: { author: 'venus-agent-tools', version: '1.0' },
    };
}

export function getTrImplWorkflowCommandTemplate(): CommandTemplate {
    return {
        name: 'Venus: 引导工作流',
        description: '一站式引导工作流：结构化探索（grill 追问 L1-L5）→ 提案内联生成 → 自动验证门 → 深度复查与需求文档联动',
        category: 'Venus / 实现',
        tags: ['venus', 'tr_impl', 'workflow', 'exploration', 'verification'],
        content: `**Before proceeding, read openspec/rules/ai-coding.md for AI coding guardrails.**

One-stop workflow from exploration to task generation with keyword detection, analysis integration, and automatic verification phase.

This workflow guides you through:
1. **Exploration phase** - Keyword detection + analysis + grill-with-docs questioning
2. **Proposal phase** - Impact analysis + artifact generation
3. **Verification phase** - Automatic quality check before implementation

---

**Input**: The argument after \`/venus:tr-impl-workflow\` is the user's topic description (what they want to build).

---

## Phase 1: Exploration

### 1.1 Create Exploration File

Create file at \`openspec/explorations/<keyword>-explore-<sequence>.md\`:

- Extract keyword from user's topic (kebab-case, max 50 chars)
- Find highest sequence for that keyword
- Increment sequence (001, 002, etc.)
- Default to "explore" if extraction fails

Use \`path.join()\` for cross-platform compatibility.

### 1.1.2 Prompt Validation Gate (MANDATORY CHECKPOINT)

**⚠️ MANDATORY: 本门在任何探索动作之前执行，不得跳过。** 校验对象是用户最终提供的需求描述（未携带主题时先交互收集，再以收集后的描述执行本门，不对空输入校验）。

${PROMPT_GATE_COMPACT}

不明确分支的确认门是**澄清门（确认 WHAT）**：用户确认或修改前 MUST NOT 推进到 1.1.5 及之后的任何步骤。校验结论（原始提示词 + 确认后的基线）写入探索文件的 \`## 提示词基线\` 段。

### 1.1.5 CONTEXT.md Startup Check (MANDATORY CHECKPOINT)

**⚠️ MANDATORY: CONTEXT.md check at Phase 1 start — BEFORE questioning begins**

1. **Check if \`openspec/CONTEXT.md\` exists** using Glob or Read tool
2. **If EXISTS**: Read all existing terms and inject them into exploration.md 术语表 section
   - Use existing terminology in all questions (do not re-define)
3. **If NOT EXISTS**: Record "No existing glossary — will create during exploration" in exploration.md 术语表 section

**Checkpoint Enforcement**:
- System MUST check CONTEXT.md existence before entering questioning
- If CONTEXT.md exists, terms MUST be loaded into exploration.md before first question

### 1.2 Initialize Structured Format

Write the initial file structure with enhanced sections:

\`\`\`markdown
## Background
<User's initial description>

## 功能流程图 (Functional Flowchart)

<!-- 1.5.5 强制产出：Mermaid flowchart TD 承担顺序与分支骨架，节点 id N<序号> 在图中与表中 MUST 稳定一致 -->
<!-- 初始为空；探索分析完成后由 1.5.5 填写并经流程最终确认门确认 -->

| 节点 | 操作 | 触发条件 | 证据位置 | 异常路径 |
| :--- | :--- | :--- | :--- | :--- |
| N1 | <操作> | <前置条件，无则 "—"> | <文件:行 或 类.方法；新建功能标 [新建] + 预期产物> | <失败去向 → N<id>，无则 "—"> |

> 确认后的流程图 = **流程基准**；未经用户确认的流程图 MUST NOT 作为提案的生成锚点。
> 发现遗漏节点 MUST 回到 1.5.5 更新并重新确认，MUST NOT 在 tasks.md 中静默补节点。

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
  File: \`openspec/docs/adr/0001-<slug>.md\`

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
\`\`\`

**Section Guidelines**:
- **Codebase Findings**: Records discoveries from exploration (files, symbols, patterns)
- **Decision Process**: Tracks decision evolution with rationale
- **Pending**: Categorized by type for Phase 2 attention

### 1.2.0.5 Capability Exploration Memory Injection (MANDATORY CHECKPOINT)

**⚠️ MANDATORY: Inject capability-level exploration memory before questioning begins**

After structured format initialization:

1. **Infer involved capabilities** from the user's topic
   - Use Glob tool to scan \`openspec/specs/\` directory for module names
   - Match topic keywords against module names (same logic as change naming module identification)

2. **Detect capability memory file**
   - For each involved capability \`<capability>\`, check if \`openspec/specs/<capability>/explorations.md\` exists (use \`path.join()\`)

3. **Inject memory (when file exists)**
   - Read the file and inject historical Decisions, 术语, and 边界场景 into the exploration context
   - Write a summary into exploration.md \`## Codebase Findings\` under a "### Capability Exploration Memory (injected)" subsection
   - Sections marked \`已过时（由 <change-name> 取代）\` serve as historical reference ONLY — the superseding change's decisions are current

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
   - **MUST run \`codegraph_status\` FIRST.** Until it returns unavailable, you MUST NOT use Glob/Grep for file or symbol investigation — the \`codegraph_*\` tools below are the primary path, not an optional one.
   - If available: proceed with CodeGraph tools below
   - If \`codegraph_status\` confirms unavailable (uninitialized or error): ONLY THEN log "CodeGraph not initialized — using Glob/Grep fallback" and skip to the fallback below
   - Grep/Glob is a last resort, permitted ONLY after \`codegraph_status\` confirms unavailability — never as a shortcut to skip CodeGraph

1. **Scan project file structure** using \`codegraph_files\` tool
   - Get full project file tree with metadata
   - Identify relevant directories and files matching exploration topic
   - Write results to \`## Codebase Findings > Discovered Files\`

2. **Search for relevant symbols** using \`codegraph_search\` tool
   - Search for symbols matching exploration topic keywords
   - Record discovered symbols with file:line locations
   - Write results to \`## Codebase Findings > Identified Symbols\`

   **Note**: \`codegraph_context\` is deferred to Section 1.4 (after questioning, when task description is clearer).

3. **Record scan results** in exploration file:
   \`\`\`markdown
   ## Codebase Findings

   ### Discovered Files
   - <file-path>: <relevance-reason>

   ### Identified Symbols
   - <symbol-name> (<file-path>:<line>): <reason>

   ### Pattern Matches
   - <pattern-name>: <example-location>
   \`\`\`

**Fallback (last resort)**: Permitted ONLY after \`codegraph_status\` confirms CodeGraph MCP tools are unavailable (uninitialized or error):
- Fall back to Glob tool for file structure discovery
- Fall back to Grep tool for symbol search
- Record in exploration file: "CodeGraph unavailable — used Glob/Grep fallback"

**Checkpoint Enforcement**:
- System MUST execute base scan before entering questioning
- If CodeGraph AND Glob/Grep both fail, system MUST warn but NOT block
- Scan results MUST be written to exploration file before proceeding

### 1.2.1.5 Multi-Project CodeGraph Agent Scan (条件触发 — 检测到其他项目路径时执行)

**⚠️ CONDITIONAL: Only executes when exploration context contains other project paths**

After the 1.2.1 base scan (current project), system MUST check if the exploration context contains paths to other projects (e.g., user-specified \`--project-path\`, auto-migration SOURCE_PROJECT/TARGET_PROJECT, or paths confirmed during conversation).

**When other project paths are detected**:

1. **Check CodeGraph initialization** for each other project path:
   - Run Bash \`ls <path>/.codegraph/\` to check whether the target project has a \`.codegraph/\` directory (directory contents listed — including codegraph.db — means CodeGraph is initialized). Do NOT use Glob to check dot-prefixed directories (Glob returns false negatives for them)
   - If initialized (ls succeeds): proceed with Agent scan
   - If not initialized (ls fails — directory does not exist): log WARN "Other project <path> does not have CodeGraph initialized — falling back to Glob/Grep" and fall back to Glob/Grep

2. **Spawn sub-agent** for each other project with CodeGraph initialized:
   - Use the \`Agent\` tool to spawn a sub-agent
   - The sub-agent SHALL use CodeGraph MCP tools with \`projectPath\` parameter pointing to the other project
   - Execute \`codegraph_files\` for file structure, \`codegraph_search\` for symbol search, \`codegraph_context\` for context understanding
   - Limit scan depth: \`maxDepth: 3\`, \`maxNodes: 20\` to prevent excessive results
   - Set sub-agent timeout: 120s (timeout → WARN fallback to Glob/Grep)

3. **Handle multiple project paths**:
   - Spawn sub-agents sequentially (one per project)
   - Each project's scan is independent — failure on one does NOT affect others

4. **Merge results** into exploration.md:
   - Write to \`## Codebase Findings > ### Other Project Findings\` subsection
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

**Purpose**: Determine whether to trigger deep analysis (\`codegraph_explore\` + \`codegraph_impact\`).

**Detection Logic**:
1. **Analyze user input keywords** for modification intent:
   - "modify", "update", "change", "edit", "refactor", "enhance", "优化", "修改", "重构" → triggers deep analysis
   - "add", "create", "new", "introduce", "implement", "新增", "添加" → may skip deep analysis

2. **Cross-reference with CodeGraph findings**:
   - If base scan found relevant existing symbols → likely modifying existing code
   - If base scan found no relevant symbols → likely new feature

3. **Decision**:
   - **Modify existing code detected**: System MUST trigger deep analysis hook
     - Execute \`codegraph_explore\` for deep dive
     - Execute \`codegraph_impact\` for blast radius
     - Record results in \`## Implementation Deep-Dive\` section
   - **Pure new feature**: Skip deep analysis, keep only base scan results
   - **Ambiguous**: Default to trigger deep analysis (safer)

4. **Log decision** in exploration file:
   \`\`\`
   ## Analysis
   ### Deep Analysis Trigger
   - Triggered: Yes/No
   - Reason: <detection rationale>
   - Scope: <affected symbols/files>
   \`\`\`

### 1.2.3 CodeGraph Deep Analysis (Conditional — trigger-based)

**Trigger**: When 1.2.2 detects modification intent OR Scope.Modify keyword detected.

Execute deep analysis when triggered:
1. \`codegraph_explore\` — Deep exploration of specific symbols
2. \`codegraph_impact\` — Blast radius analysis of affected symbols
3. Write results to exploration.md \`## Implementation Deep-Dive\` section

**Scope Control** (by trigger level):
- 🔴 Auto (Scope.Modify): All 6 analysis dimensions, up to 10 core symbols
- 🟡 Prompt (Scope.Add): Rationale + Constraints + Assumptions, up to 10 core symbols
- 🟢 Manual (Depth.Deep): User-selected dimensions

### 1.2.4 Post-Scan Update of Exploration File

After base scan (and deep analysis if triggered):
1. Update \`## Codebase Findings\` section with all discovered files and symbols
2. Update \`## Analysis\` section with architecture and business flow findings
3. Update \`## Pending > For Phase 2 Impact Analysis\` with identified symbols
4. If 1.2.1.5 multi-project Agent scan ran, include its results in the Codebase Findings section under \`### Other Project Findings\`
5. Log: "CodeGraph scan complete — <N> files, <M> symbols found"

### 1.3 Grill-With-Docs Questioning

Apply the full grill-with-docs discipline: grilling primitive (decision tree walk) + domain-modeling (CONTEXT.md glossary, ADRs, code cross-validation, scenario construction).

**Terminology sharpening (MANDATORY)**: Each time a term is resolved, MUST write to \`openspec/CONTEXT.md\` NOW (not deferred). Use format: \`**<Term>**: <definition>\\\\n_Avoid_: <synonyms>\`. If CONTEXT.md does not exist, create lazily.

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
- Security: \`mcp__plugin_semgrep_semgrep__semgrep_scan\` (Semgrep MCP 为可选增强：不可用时该分析跳过并记录，不阻塞工作流)
- Architecture: \`mcp__codegraph__codegraph_context\` (after questioning, task description is clearer), \`mcp__codegraph__codegraph_callers\`, \`mcp__codegraph__codegraph_callees\`
- Business: \`mcp__codegraph__codegraph_context\`, \`mcp__codegraph__codegraph_explore\`

### 1.5 Update File After Each Exchange

**Step 1 — Write to CONTEXT.md (MANDATORY if term resolved)**: If a term was resolved, write to \`openspec/CONTEXT.md\` NOW.

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

### 1.5.5 Functional Flowchart & Flow Final Confirmation Gate (MANDATORY CHECKPOINT)

**⚠️ MANDATORY: 探索分析完成后必须强制产出功能流程图，并经流程最终确认门确认后才进入 1.6。** 本制品不因"本次判定无流程"而跳过，也 MUST NOT 留空；用户确认前 MUST NOT 进入 1.6，MUST NOT 把未确认流程图当作提案锚点。

${FLOWCHART_COMPACT}

**回改规则**：探索或提案阶段发现遗漏节点 MUST 回到本步骤（1.5.5）更新流程图与节点清单并**重新经用户确认**；MUST NOT 在 tasks.md 中静默补节点。确认后的流程图 = **流程基准**，随探索文件迁移（Phase 2.3）一并进入变更目录。

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

**Tool**: \`mcp__codegraph__codegraph_impact --symbol <symbol> --direction upstream\`

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

\`\`\`
Source: openspec/explorations/<keyword>-explore-<sequence>.md
Destination: openspec/changes/<change-name>/exploration.md
\`\`\`

**Cross-platform**: Use \`path.join()\` for all paths.

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

- Execute inline following \`openspec/rules/artifact-generation.md\`
- \`venus spec status --change "<name>" --json\` (get build order)
- \`venus spec instructions <artifact-id> --change "<name>" --json\` (get template)
- Write artifact file inline using Write tool
- All artifacts generated in sequence without intermediate prompts

\`\`\`bash
venus spec status --change "<name>" --json
venus spec instructions <artifact-id> --change "<name>" --json
\`\`\`

Create inline in dependency order until \`applyRequires\` complete.

#### CLI Command Failure Handling

During inline generation, handle CLI failures:

**CLI availability detection (first-call failure signature)**:

- **First \`venus spec status\` or \`venus spec list\` Bash call fails with a command-not-found error** (e.g., "command not found", "不是内部或外部命令", "not recognized"): conclude the venus CLI is not installed. Tell the user in one line — "venus CLI not found in PATH — switching to CLI-degraded generation mode" — and switch to CLI-degraded generation mode. Do NOT repeat this notice mid-flow.
- **Other errors** (e.g., JSON parse failure, artifact not found): do NOT enter degraded mode; use the failure interactions below.

**CLI-degraded generation mode** (active after command-not-found detection):

- Abandon the \`venus spec status\`/\`venus spec instructions\` loop — do NOT attempt further \`venus spec status\`/\`venus spec instructions\` calls during the flow
- Generate artifacts directly via AI in the template's built-in dependency order (proposal → specs → design → tasks) using the template-embedded structure rules (Phase 2.5 guidelines)
- **Degraded change discovery (when no change name is specified)**: scan \`openspec/changes/*/ \` directories (excluding \`archive/\`) with Glob; when multiple candidates exist, let the user choose via AskUserQuestion
- **Degraded artifact status inference**: infer completion from file existence (\`proposal.md\`, \`specs/\`, \`design.md\`, \`tasks.md\` under the change directory) — an artifact exists when its file is present, without CLI validation
- **Degraded flow end**: state exactly once — "This run used CLI-degraded generation. Installing the venus CLI is recommended for validation and build-order guarantees." Do NOT repeat the reminder elsewhere in the flow

**Other CLI failures** (CLI installed):

- **venus spec new fails**: Display error + options: [重试] [手动修复后继续] [中止]. Preserve exploration file.
- **venus spec instructions fails**: Display artifact ID + error + options: [重试当前artifact] [跳过当前artifact] [中止]. Preserve already-created artifacts.
- **File write fails**: Display path + error reason + options: [重试] [中止]. Do NOT mark artifact as done.
- **Recovery**: On retry, re-run \`venus spec status --json\`, resume from first \`status: "ready"\` artifact. Do NOT regenerate already-completed artifacts.

**Include analysis results**:
- If impact run → add Impact sections
- If security run → add Security Updates tasks
- If business run → add Business Steps tasks

**Task Type Labels (for tasks.md generation):**
- Each task MUST include a type label: \`- [ ] [代码] N.M ...\` or \`- [ ] [DB脚本] N.M ...\` etc.
- Supplement tasks (non-\`[代码]\`) MUST include \`产出:\` field as indented content
- Default output path: \`attachments/<filename>\` (relative to changeRoot)
- See \`schemas/spec-driven/templates/tasks.md\` template for full label reference

---

## Phase 3: Verification

**Phase 3 executes automatically after inline artifact generation completes in Phase 2.4. No Skill delegation gap — workflow context remains active throughout. No user choice prompt — verification runs automatically.**

### 3.1 Auto-Execute Verification

- **Skip method-specific prompt** — Do NOT show "Propose 方式一步生成" or "已通过逐步迭代创建"
- **Skip user choice** — Do NOT ask [立即验证] / [跳过验证]
- **Execute directly** — Run D1-D5 verification automatically

### 3.2 Run Verification

- Invoke the \`venus_spec_verify_proposal\` **skill** (via Skill tool) for D1-D5 scoring — \`venus_spec_verify_proposal\` is a skill name, NOT a valid \`venus spec instructions\` artifact ID
- Fallback to AI inline scoring + WARN log if the skill is unavailable; never silently skip
- Calculate coverage rates and overall score (unified 90% threshold)
- Detect tech stack from config.yaml context

### 3.3 Handle Results

**PASS (≥90%)**:
- Auto-execute deep review (\`venus_tr_impl_review_proposal\` skill via Skill tool, no [Yes/No] prompt, user can interrupt to skip; fallback to main-workflow inline read-only deep review + WARN on skill unavailable or call failure — never silently skip)
- Display results alongside verification report
- **Auto-generate requirement document**: after deep review completes, invoke the \`venus_tr_docs_requirement_doc\` skill (via Skill tool) in non-interactive mode (Markdown, placeholder basic info); output to \`openspec/changes/<change-name>/需求文档.md\`; display the document path; on generation failure log WARN and continue

**FAIL (<90%)**:
- Auto-generate fix suggestions and apply fixes
- Re-run verification automatically
- Do NOT generate the requirement document until fixes pass re-verification
- If still FAIL: [Manual edit] [Return to exploration] [View detailed diff] (no skip-to-apply path)

## Output

\`\`\`
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

Ready for \`/venus:spec-apply\`

---

## Output (Full Pass with Requirement Document)

\`\`\`
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

Ready for \`/venus:spec-apply\`
\`\`\`

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
- Must produce the functional flowchart - 1.5.5 强制产出探索文件 \`## 功能流程图\` 段并执行流程最终确认门；确认前不进入 1.6、不把未确认流程图当作提案锚点
- Don't deadlock on the flowchart gate - 四条出口（确认 / 修改 / 拒绝后记录未确认状态并按原理解继续 / 显式授权按推断继续）
- Don't silently add flowchart nodes in tasks - 遗漏节点 MUST 回到 1.5.5 更新并重新确认
- Do show quantified scores`,
    };
}
