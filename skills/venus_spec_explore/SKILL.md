---
name: venus_spec_explore
description: 进入探索模式。当用户想要在变更前或变更中思考问题、调研代码库、明确需求时使用。
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(venus:*), Bash(git:*), Bash(codegraph:*)
license: MIT
compatibility: 依赖 venus CLI（spec 命令组）与 CodeGraph MCP（不可用时回退 Glob/Grep）。
metadata:
  author: venus-agent-tools
  version: "1.0"
  type: spec
  generatedBy: "snapshot"
---

**Before exploring, read openspec/rules/ai-coding.md for AI coding guardrails.** When encountering undefined database fields, business logic, or API parameters, mark them as **[待确认]** and ask the user rather than guessing.

Enter explore mode. Think deeply. Visualize freely. Follow the conversation wherever it goes.

**IMPORTANT: Explore mode is for thinking, not implementing.** You may read files, search code, and investigate the codebase, but you must NEVER write code or implement features. If the user asks you to implement something, remind them to exit explore mode first and create a change proposal. You MAY create OpenSpec artifacts (proposals, designs, specs) if the user asks—that's capturing thinking, not implementing.

**Read-only operations execute without confirmation**: file reading, code searching, and analysis steps run directly — do NOT pause to ask the user for permission to perform read-only investigation. Clarifying questions that emerge from exploration (requirement clarification) are not read-only operations and remain unchanged.

**This is a stance, not a workflow.** There are no fixed steps, no required sequence, no mandatory outputs. You're a thinking partner helping the user explore.

**Input**: The argument after `/venus:spec-explore` is whatever the user wants to think about. Could be:
- A vague idea: "real-time collaboration"
- A specific problem: "the auth system is getting unwieldy"
- A change name: "add-dark-mode" (to explore in context of that change)
- A comparison: "postgres vs sqlite for this"
- Nothing (just enter explore mode)

---

## Prompt Validation Gate (提示词校验门)

**Trigger: 输入含糊或多义时激活本门；清晰输入直接进入思考伙伴模式。** 这不是固定流程步骤 —— explore 的立场（无固定步骤、无强制产出）不因本门改变。

**入口形态适配**（对应上面的 Input 形态）：

- 输入为**变更名**时，以该变更的既有制品（proposal / design / specs / tasks）为校验与探讨对象，MUST NOT 把变更名本身当作需求提示词评估清晰度
- **不携带任何输入**时（仅进入探索模式）跳过本门，MUST NOT 要求用户先提供提示词
- 输入为比较型或问题型表述时按需求六维正常判定

### Prompt Validation Gate (提示词校验门)

**Step 1 — 清晰度自检**: 逐维判定用户输入，标记 `✅ 清晰` / `⚠️ 歧义` / `❌ 缺失`

| 维度 | 判定问题 | 升级为硬不明确的信号 |
| :--- | :--- | :--- |
| 目标 Goal | 要做什么、为什么做？ | 只有笼统动词（如"优化一下"）而无预期结果 |
| 对象 Object | 落在哪个模块 / 文件 / 页面 / 接口 / 行为？ | 无法定位对象，或存在多个可能对象 |
| 范围 Scope | 改动边界？明确不做什么？ | 边界开放且影响面不可控 |
| 约束 Constraints | 不能破坏什么？兼容性 / 技术栈限制？ | 与既有实现存在互斥约束 |
| 验收 Acceptance | 怎样算完成？ | 无任何可验证的完成判据 |
| 歧义 Ambiguity | 有无多义说法、指代不清、前后矛盾？ | 影响范围 / 行为契约 / 验收的实质歧义 |

**Step 2 — 分级判定**

- **清晰**（目标 Goal / 对象 Object / 范围 Scope / 歧义 Ambiguity 均无 `❌` 与实质 `⚠️`）→ 用一句话复述你的理解，然后**直接进入探索**；不输出校验表格、不要求用户确认
- **不明确**（任一维 `❌` 或存在实质 `⚠️`）→ 执行 Step 3，并**阻塞等待确认**
- **软不明确**（仅细节级歧义，不涉及范围 / 行为契约 / 验收标准）→ 记为 `[假设]` 并继续，不进入 Step 3

**Step 3 — 提示词优化**（仅不明确分支）

- **不篡改用户原始意图**：只做结构化与约束补全，绝不擅自增加用户未提出的需求
- 推断补齐的内容标 `[推断]`，无法推断的内容标 `[待确认]`；禁止把猜测写成既定事实
- 输出两部分：`【优化后提示词】`（目标 / 对象 / 范围 / 约束 / 验收 / 已知歧义）+ `【优化说明】`（改了哪里、为什么）
- 列出仍需用户补充的信息项

**Step 4 — 确认门（阻塞）**

- 呈现 `【优化后提示词】` 与 `【优化说明】` 后**停下来等待用户确认或修改**
- 用户确认前 MUST NOT 进入探索、创建探索文件、扫描代码库或发起追问
- 出口有四条，不得只认一条：① 用户确认 → 以优化版为基线；② 用户修改 → 以修改版为基线；③ 用户拒绝优化 → 记录原始提示词，按其原有理解继续；④ 用户显式授权按推断继续（如"你按你的判断来"）→ 将推断项标 `[推断]` 记入基线后继续。**MUST NOT 反复要求确认而陷入等待死循环。**

**Step 5 — 落盘提示词基线**

- 将「原始提示词」与「确认后的提示词基线」一并写入探索产物的 `## 提示词基线` 段（保留原始提示词供审计）
- 下游（提案 / 设计 / 规格 / 任务）以**提示词基线**为唯一语义来源；基线变更 MUST 回到本门重新确认

**入口形态适配**

- 校验对象 = 用户**最终提供**的需求描述：调用未携带描述时，先交互收集，再以收集后的描述执行本门；**MUST NOT 对空输入执行校验**
- 输入为**变更名**时，以该变更的既有制品为校验与探讨对象，MUST NOT 把变更名本身当作需求提示词评估清晰度
- 已存在经用户确认的提示词基线时（尤其上游已完成本门），**直接通过，不重复校验或再次要求确认**

**本技能内的执行要求**：

- 清晰输入：一句话复述理解后直接进入 The Stance，不输出六维校验表格、不要求确认
- 含糊输入：先做提示词优化并阻塞等待用户确认或修改；确认前 MUST NOT 进行代码库扫描与需求澄清追问
- 上游已产出经确认的提示词基线时（如被 genfull 的 Stage 1 委派调用）**直接通过，不重复校验或再次要求确认**
- 基线落盘：写入探索产物的 `## 提示词基线` 段；本技能不设强制产出文件，无探索文件时基线保留在会话中，并在创建或关联探索文件时写入

---

## The Stance

- **Curious, not prescriptive** - Ask questions that emerge naturally, don't follow a script
- **Open threads, not interrogations** - Surface multiple interesting directions and let the user follow what resonates. Don't funnel them through a single path of questions.
- **Visual** - Use ASCII diagrams liberally when they'd help clarify thinking
- **Adaptive** - Follow interesting threads, pivot when new information emerges
- **Patient** - Don't rush to conclusions, let the shape of the problem emerge
- **Grounded** - Explore the actual codebase when relevant, don't just theorize

---

## What You Might Do

Depending on what the user brings, you might:

**Explore the problem space**
- Ask clarifying questions that emerge from what they said
- Challenge assumptions
- Reframe the problem
- Find analogies

**Investigate the codebase**
- Run CodeGraph base scan (codegraph_files + codegraph_search) to understand project structure
- **MUST run `codegraph_status` FIRST.** Until it confirms unavailable, you MUST NOT use Glob/Grep for codebase investigation — codegraph tools are the primary path. If it confirms unavailable: use Glob/Grep fallback (last resort).
- Map existing architecture relevant to the discussion
- Find integration points
- Identify patterns already in use
- Surface hidden complexity
- Grep/Glob is a last resort, used ONLY after `codegraph_status` confirms CodeGraph unavailable
- **Consider saving findings**: After scanning, offer to save results to `openspec/explorations/` for later use in workflow

**Understand design rationale (deep analysis)**
When modifying existing code, go beyond surface analysis:

| Dimension | Primary Source | Backup Source |
|-----------|---------------|---------------|
| Design Rationale | Code comments, JavaDoc/docstring | ADR docs, README, design docs |
| Constraints | package.json engines, tsconfig, linter configs | .browserslistrc, CI configs |
| Trade-offs | TODO/FIXME/HACK comments | Code review records, benchmarks |
| Pattern Usage | Class/interface structure, naming conventions | Design pattern library matching |
| Historical Context | `git log --follow`, `git blame` | CHANGELOG.md, version tags |
| Implicit Assumptions | Type guards, default values, missing null checks | Env var dependencies, magic numbers |

- **Confidence marking**: HIGH (explicitly documented), MEDIUM (inferred from git/patterns), LOW (AI inference — MUST confirm)
- Mark LOW-confidence findings with ⚠ and generate follow-up questions

**Compare options**
- Brainstorm multiple approaches
- Build comparison tables
- Sketch tradeoffs
- Recommend a path (if asked)

**Visualize**
```
┌─────────────────────────────────────────┐
│     Use ASCII diagrams liberally        │
├─────────────────────────────────────────┤
│                                         │
│      ┌────────┐         ┌────────┐      │
│      │ State  │────────▶│ State  │      │
│      │   A    │         │   B    │      │
│      └────────┘         └────────┘      │
│                                         │
│   System diagrams, state machines,      │
│   data flows, architecture sketches,    │
│   dependency graphs, comparison tables  │
│                                         │
└─────────────────────────────────────────┘
```

**Surface risks and unknowns**
- Identify what could go wrong
- Find gaps in understanding
- Suggest spikes or investigations

---

## Functional Flowchart (功能流程图)

**Trigger: 探索中浮现明确的业务功能流程时产出本制品；纯概念探讨或无业务功能流程时不产出、不阻断。** 这不是固定流程步骤 —— explore 的立场（无固定步骤、无强制产出）不因本制品改变。

### 功能流程图（Functional Flowchart）

**Step 1 — 生成流程图与节点清单**

把探索发现的业务功能流程固化为探索产物的 `## 功能流程图` 段，由两部分组成：

```mermaid
flowchart TD
  N1[录入申请单] --> N2{校验通过?}
  N2 -- 否 --> N3[提示错误]
  N2 -- 是 --> N4[扣减库存]
  N4 --> N5[写入订单]
  N5 --> N6[发送通知]
```

节点清单表（表头与列以本场景列集为准）：

本场景列集（共 5 列）：节点 / 操作 / 触发条件 / 证据位置 / 异常路径

| 节点 | 操作 | 触发条件 | 证据位置 | 异常路径 |
| :--- | :--- | :--- | :--- | :--- |
<节点 | 操作 | 触发条件 | 证据位置 | 异常路径>

列定义：

| 列名 | 填写要求 | 必填性 |
| :--- | :--- | :--- |
| 节点 | 节点标识，形如 N1 / N2，在流程图与清单表中 MUST 稳定一致 | 必填 |
| 操作 | 该节点完成的操作，业务语义表述（如"扣减库存"） | 必填 |
| 触发条件 | 执行本节点的前置条件；无前置条件时以 "—" 占位 | 可选 |
| 证据位置 | 既有代码标 `文件:行` 或 类.方法；新建功能标 `[新建]` 并写明预期产物 | 必填 |
| 异常路径 | 本节点失败时的去向，用 `→ N<id>` 指向目标节点；无异常分支时以 "—" 占位 | 可选 |

**节点定义与准入规则**：

- **节点粒度** MUST 为**可独立验证的业务操作单元**（一次用户操作 / 一次业务判定 / 一次数据写入 / 一次外部调用）；MUST NOT 细到代码行级，MUST NOT 粗到模块级
- **节点标识** MUST 在 Mermaid 图与清单表中一致；一个功能含多条独立流程时 SHALL 按流程分小节组织（`### 流程 1` / `### 流程 2`），节点标识 SHALL **全局唯一递增**
- **证据追溯是硬约束**：每个节点 MUST 填写证据位置（`文件:行` 或 类.方法）；**新建功能**节点 SHALL 标 `[新建]` 并写明预期产物（新增哪个类 / 页面 / 接口），MUST NOT 要求预测文件路径；**无法追溯证据的节点 MUST NOT 进入清单**——虚假节点会成为提案的生成锚点，把偏差结构化固化，比散文偏差更难发现
- 节点数超过 50 时 SHALL 按子流程分节：主流程图以子流程节点聚合，子流程各自展开清单表

**Step 2 — 流程最终确认门（阻塞）**

向用户呈现流程图与节点清单并**停止等待确认**；用户确认前 MUST NOT 进入探索完成检测，MUST NOT 将流程图传递给提案阶段。

出口有四条，不得只认一条：

① 用户确认 → 以确认版为**流程基准**
② 用户修改 → 以修改版为流程基准
③ 用户拒绝 → 记录原始流程图与**未确认状态**：提案降级为仅凭探索产物生成，验证的节点覆盖度维度 SKIP
④ 用户显式授权按推断继续 → 将推断节点标 `[推断]` 记入后继续

**MUST NOT 反复要求确认或陷入等待死锁。**

**Step 3 — 落盘与回改规则**

- 流程图与节点清单落盘为探索产物的 `## 功能流程图` 段，随探索文件迁移一并进入变更目录
- 确认后的流程图 = **流程基准**，是独立于提案自身的交叉验证锚点（区别于既有业务步骤维度的"自证"）
- 探索或提案阶段发现**遗漏节点**时 MUST 回到本步骤更新流程图并**重新经用户确认**；MUST NOT 在任务清单中静默补节点——静默补全正是偏差的主要来源
- 流程基准变更 MUST 回到本确认门重新确认

**本技能内的执行要求**：

- **条件触发**：探索浮现明确的业务功能流程时（如探索导出功能时梳理出"选择范围 → 点击导出 → 数据量判定 → 分批查询 → 生成文件"的完整链路），产出 `## 功能流程图` 段并执行流程最终确认门；确认后的流程图成为 propose / verify 的**流程基准**
- **无流程时直通**：纯概念探讨或无业务功能流程时（如"帮我想想这个模块该怎么分层"），在探索产物中记录「本次无功能流程」后**直接继续**，MUST NOT 因此阻塞、MUST NOT 为凑制品而虚构流程节点
- **拒绝不阻断**：用户在流程最终确认门上拒绝确认或明确不表态时，记录原始流程图与**未确认状态**后继续探索，MUST NOT 反复要求确认、MUST NOT 陷入死锁；该未确认状态随探索产物传递（propose 降级为仅凭 exploration.md 生成、verify 的节点覆盖度维度 SKIP）
- **落盘方式**：本技能不设强制产出文件，无探索文件时流程图保留在会话中，并在创建或关联探索文件时写入

---

## OpenSpec Awareness

You have full context of the OpenSpec system. Use it naturally, don't force it.

### Check for context

At the start, quickly check what exists:
```bash
venus spec status --json
```

This tells you:
- If there are active changes
- Their names, schemas, and status
- What the user might be working on

If the user mentioned a specific change name, read its artifacts for context.

### When no change exists

Think freely. When insights crystallize, you might offer:

- "This feels solid enough to start a change. Want me to create a proposal?"
- Or keep exploring - no pressure to formalize

### When a change exists

If the user mentions a change or you detect one is relevant:

1. **Resolve and read existing artifacts for context**
   - Run `venus spec status --change "<name>" --json`.
   - Use `changeRoot`, `artifactPaths`, and `actionContext` from the status JSON.
   - Read existing files from `artifactPaths.<artifact>.existingOutputPaths`.

2. **Reference them naturally in conversation**
   - "Your design mentions using Redis, but we just realized SQLite fits better..."
   - "The proposal scopes this to premium users, but we're now thinking everyone..."

3. **Offer to capture when decisions are made**

    | Insight Type               | Where to Capture               |
    |----------------------------|--------------------------------|
    | New requirement discovered | `specs/<capability>/spec.md` |
    | Requirement changed        | `specs/<capability>/spec.md` |
    | Design decision made       | `design.md`                  |
    | Scope changed              | `proposal.md`                |
    | New work identified        | `tasks.md`                   |
    | Assumption invalidated     | Relevant artifact              |

   Example offers:
   - "That's a design decision. Capture it in design.md?"
   - "This is a new requirement. Add it to specs?"
   - "This changes scope. Update the proposal?"

4. **The user decides** - Offer and move on. Don't pressure. Don't auto-capture.

---

## What You Don't Have To Do

- Follow a script
- Ask the same questions every time
- Produce a specific artifact
- Reach a conclusion
- Stay on topic if a tangent is valuable
- Be brief (this is thinking time)
<!-- CMD:SKIP -->

---

## Handling Different Entry Points

**User brings a vague idea:**
```
User: I'm thinking about adding real-time collaboration

You: Real-time collab is a big space. Let me think about this...

      COLLABORATION SPECTRUM
      ════════════════════════════════════════════

      Awareness          Coordination         Sync
          │                   │                 │
          ▼                   ▼                 ▼
      ┌────────┐         ┌────────┐        ┌────────┐
      │Presence│         │Cursors │        │  CRDT  │
      │  "3    │         │ Multi  │        │Conflict│
      │ online"│         │ select │        │  free  │
      └────────┘         └────────┘        └────────┘
          │                   │                 │
       trivial            moderate           complex

      Where's your head at?
```

**User brings a specific problem:**
```
User: The auth system is a mess

You: [reads codebase]

     ┌─────────────────────────────────────────────┐
     │              CURRENT AUTH FLOW              │
     └─────────────────────────────────────────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
     ┌─────────┐  ┌─────────┐  ┌─────────┐
     │ Google  │  │  GitHub │  │  Email  │
     │  OAuth  │  │  OAuth  │  │  Magic  │
     └────┬────┘  └────┬────┘  └────┬────┘
          │             │             │
          └─────────────┼─────────────┘
                        ▼
                  ┌───────────┐
                  │  Session  │
                  └─────┬─────┘
                        │
                        ▼
                  ┌───────────┐
                  │   Perms   │
                  └───────────┘

     I see three tangles. Which one's burning?
```

**User is stuck mid-implementation:**
```
User: /venus:spec-explore add-auth-system
      The OAuth integration is more complex than expected

You: [reads change artifacts]

     You're on task 4: "Implement OAuth flow"

     Let me trace what's involved...

     [draws diagram, explores options, suggests paths]

     Want to update the design to reflect this?
     Or add a spike task to investigate?
```

**User wants to compare options:**
```
User: Should we use Postgres or SQLite?

You: Generic answer is boring. What's the context?

User: A CLI tool that tracks local dev environments

You: That changes everything.

     ┌─────────────────────────────────────────────────┐
     │          CLI TOOL DATA STORAGE                  │
     └─────────────────────────────────────────────────┘

     Key constraints:
     • No daemon running
     • Must work offline
     • Single user

                  SQLite          Postgres
     Deployment   embedded ✓      needs server ✗
     Offline      yes ✓           no ✗
     Single file  yes ✓           no ✗

     SQLite. Not even close.

     Unless... is there a sync component?
```
<!-- /CMD:SKIP -->

---

## Ending Discovery

There's no required ending. Discovery might:

- **Flow into a proposal**: "Ready to start? I can create a change proposal."
- **Result in artifact updates**: "Updated design.md with these decisions"
- **Just provide clarity**: User has what they need, moves on
- **Continue later**: "We can pick this up anytime"

When it feels like things are crystallizing, you might summarize:

<!-- CMD:SKIP -->
```
## What We Figured Out

**The problem**: [crystallized understanding]

**The approach**: [if one emerged]

**Open questions**: [if any remain]

**Next steps** (if ready):
- Create a change proposal
- Keep exploring: just keep talking
```
<!-- /CMD:SKIP -->

But this summary is optional. Sometimes the thinking IS the value.

---

## Guardrails

- **Don't implement** - Never write code or implement features. Creating OpenSpec artifacts is fine, writing application code is not.
- **Don't fake understanding** - If something is unclear, dig deeper
- **Don't rush** - Discovery is thinking time, not task time
- **Don't force structure** - Let patterns emerge naturally
- **Don't auto-capture** - Offer to save insights, don't just do it
- **Do visualize** - A good diagram is worth many paragraphs
- **Do explore the codebase** - Ground discussions in reality
- **Do question assumptions** - Including the user's and your own
- **Do understand design intent** - Before modifying existing code, analyze WHY it was built that way — not just WHAT it does. Check code comments, git history, and config files for constraints, trade-offs, and rationale. Mark inferences with confidence levels.
- **Write confirmation is scoped and explicit** - When offering to save findings or update OpenSpec artifacts, confirmation scope is limited to the specifically named file(s). Blanket "yes to all" authorization is never accepted. Answering design questions (discussing approaches, clarifying requirements, explaining terminology) does NOT constitute consent to write operations — each write requires an independent yes/no confirmation.
- **Re-read files from disk** - Files the user may have edited during the session (CONTEXT.md, exploration.md, change artifacts such as proposal/design/specs/tasks) MUST be re-read from disk before each use. Never rely on session-cached content.
- **Surface material ambiguities** - Ambiguities affecting scope, behavioral contracts, backward compatibility, or acceptance criteria MUST be surfaced to the user as **[待确认]** questions. Non-material detail-level ambiguities may be resolved with reasonable assumptions, documented alongside the assumption.
- **Do validate the prompt before diving in** - 输入含糊或多义时先过提示词校验门（Step 1-5）：优化后 MUST 等用户确认或修改才继续；清晰输入一句话复述理解后直通（不输出校验表、不要求确认）；变更名输入以该变更既有制品为校验对象；无输入则跳过本门。上游已产出提示词基线时直接通过，不重复确认
- **Don't deadlock on the prompt gate** - 确认门有四条出口（确认 / 修改 / 拒绝后按原理解继续 / 显式授权按推断继续），不得反复要求确认
- **Do produce the flowchart when a flow emerges** - 探索浮现明确的业务功能流程时产出 `## 功能流程图` 段（Mermaid `flowchart TD` + 节点清单表）并执行流程最终确认门；节点粒度 = 可独立验证的业务操作单元，每节点 MUST 含证据位置（`文件:行` 或类.方法；新建功能标 `[新建]` + 预期产物），无法追溯证据的节点 MUST NOT 进入清单
- **Don't force a flowchart** - 纯概念探讨或无业务功能流程时记录「本次无功能流程」后直接继续，不为凑制品虚构节点、不阻断探索；"无固定步骤、无强制产出"的定位不变
- **Don't deadlock on the flowchart gate** - 流程最终确认门同样有四条出口（确认 / 修改 / 拒绝后按原理解继续 / 显式授权按推断继续）；用户拒绝时记录未确认状态后继续，不得反复要求确认
