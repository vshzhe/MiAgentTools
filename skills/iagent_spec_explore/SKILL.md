---
name: iagent_spec_explore
description: "进入探索模式。当用户想要在变更前或变更中思考问题、调研代码库、明确需求时使用；触发词\"探索 / explore / 调研 / 思考 / 明确需求\"；NOT for 一站式引导全流程（改用 iagent_workflow）或缺陷根因排查（改用 iagent_debug）。"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(iagent:*), Bash(git:*), mcp__codegraph, mcp__codegraph__codegraph_status, mcp__codegraph__codegraph_files, mcp__codegraph__codegraph_search, mcp__codegraph__codegraph_context, mcp__codegraph__codegraph_node, mcp__codegraph__codegraph_callers, mcp__codegraph__codegraph_callees, mcp__codegraph__codegraph_impact, mcp__codegraph__codegraph_explore
license: MIT
compatibility: 依赖 iagent CLI（spec 命令组）与 CodeGraph MCP（不可用时回退 Glob/Grep）。
metadata:
  author: mi-agent-tools
  type: spec
  generatedBy: "snapshot"
  generatedFingerprint: "sha256:f0923687637708c771976c5161478dfd52cad9cee12d707df8bc269d3ea4bc86"
---

**适用 openspec/rules/ai-coding.md 全域护栏。** 未定义项标 **[待确认]**，禁止猜测。

Enter explore mode. Think deeply. Visualize freely. Follow the conversation wherever it goes.

**IMPORTANT: Explore mode is for thinking, not implementing.** You may read files, search code, and investigate the codebase, but you must NEVER write code or implement features. If the user asks you to implement something, remind them to exit explore mode first and create a change proposal. You MAY create OpenSpec artifacts (proposals, designs, specs) if the user asks—that's capturing thinking, not implementing.

**Read-only operations execute without confirmation**: file reading, code searching, and analysis steps run directly — do NOT pause to ask the user for permission to perform read-only investigation. Clarifying questions that emerge from exploration (requirement clarification) are not read-only operations and remain unchanged.

**This is a stance, not a workflow.** There are no fixed steps, no required sequence, no mandatory outputs. You're a thinking partner helping the user explore.

**Input**: The argument after `/iagent:spec-explore` is whatever the user wants to think about. Could be:
- A vague idea: "real-time collaboration"
- A specific problem: "the auth system is getting unwieldy"
- A change name: "add-dark-mode" (to explore in context of that change)
- A comparison: "postgres vs sqlite for this"
- Nothing (just enter explore mode)

## ⛔ GATE PROTOCOL — ACTIVE

This skill contains **CONFIRMATION GATES** marked with **⛔ GATE:**. Each gate is a HARD STOP:
- When you reach a ⛔ GATE, **YOUR RESPONSE ENDS THERE** — output the gate content, then STOP
- Do NOT execute, describe, or pre-generate steps beyond the gate
- The user's next message is the confirmation signal — resume from AFTER the gate only when they respond
- **VIOLATION**: executing beyond a gate without user confirmation is a critical error that corrupts the workflow

---

## Prompt Validation Gate (提示词校验门)

**Trigger: 输入含糊或多义时激活本门；清晰输入直接进入思考伙伴模式。** 这不是固定流程步骤 —— explore 的立场（无固定步骤、无强制产出）不因本门改变。

**入口形态适配**（对应上面的 Input 形态）：

- 输入为**变更名**时，以该变更的既有制品（proposal / design / specs / tasks）为校验与探讨对象，MUST NOT 把变更名本身当作需求提示词评估清晰度
- **不携带任何输入**时（仅进入探索模式）跳过本门，MUST NOT 要求用户先提供提示词
- 输入为比较型或问题型表述时按需求六维正常判定

**Prompt Validation Gate (提示词校验门)**: 探索前强制自检用户输入，维度为 目标 Goal / 对象 Object / 范围 Scope / 约束 Constraints / 验收 Acceptance / 歧义 Ambiguity。
- **清晰**（目标 Goal / 对象 Object / 范围 Scope / 歧义 Ambiguity 均无 `❌` 与实质 `⚠️`）→ 一句话复述理解后直通，不输出校验表、不要求确认
- **不明确**（任一维 `❌` 或实质 `⚠️`）→ 先做提示词优化，输出 `【优化后提示词】`（推断项标 `[推断]`、未知项标 `[待确认]`）与 `【优化说明】`，**⛔ GATE: 立即结束本次响应并等待用户确认或修改**（本次响应到此结束，收到用户响应后继续；出口：确认 / 修改 / 拒绝 / 显式授权按推断），**不得陷入等待死循环**
- **软不明确**（仅细节级歧义）→ 记 `[假设]` 继续
- 优化**不篡改原始意图**、不增加用户未提出的需求
- 校验结论与基线写入探索产物 `## 提示词基线` 段，作为下游唯一语义来源
- 空输入不校验；输入为变更名时以该变更既有制品为校验对象；上游已产出基线时直接通过

> **完整门细则**见 references/prompt-gate.md。**仅在 Gate 实际触发时**（输入不明确、进入 Step 3 优化流程）读取全文细则；清晰输入一句话复述理解后直通，无需读取。

**本技能内的执行要求**：

- 清晰输入：一句话复述理解后直接进入 The Stance，不输出六维校验表格、不要求确认
- 含糊输入：先做提示词优化并阻塞等待用户确认或修改；确认前 MUST NOT 进行代码库扫描与需求澄清追问
- 上游已产出经确认的提示词基线时（如被 full-workflow 的 Stage 1 委派调用）**直接通过，不重复校验或再次要求确认**
- 基线落盘：写入探索产物的 `## 提示词基线` 段；本技能不设强制产出文件，无探索文件时基线保留在会话中，并在创建或关联探索文件时写入

---

## 探索指南（The Stance / What You Might Do / OpenSpec Awareness / What You Don't Have To Do / Handling Different Entry Points / Ending Discovery）

> 完整探索指南见 `references/exploration-guidance.md`；进入思考伙伴模式前按需 `Read`。

---

## Functional Flowchart (功能流程图)

**Trigger: 探索中浮现明确的业务功能流程时产出本制品；纯概念探讨或无业务功能流程时不产出、不阻断。** 这不是固定流程步骤 —— explore 的立场（无固定步骤、无强制产出）不因本制品改变。

**功能流程图（Functional Flowchart）**: 把探索发现的业务功能流程固化为探索产物 `## 功能流程图` 段（Mermaid `flowchart TD` + 关键操作节点清单表）。
- **节点粒度** = 可独立验证的业务操作单元（用户操作 / 业务判定 / 数据写入 / 外部调用）；节点标识在图中与表中 MUST 一致，多流程时全局唯一递增
- **清单列集**：节点 / 操作 / 触发条件 / 证据位置 / 异常路径
- **证据追溯（硬约束）**：每节点 MUST 填 `文件:行` 或 类.方法；新建功能标 `[新建]` + 预期产物；无法追溯证据的节点 MUST NOT 进入清单
- **⛔ GATE: 流程最终确认门（强制停止）**：呈现流程图与清单并立即结束本次响应，等待确认；出口：确认 / 修改 / 拒绝（记未确认状态，提案降级 + 验证该维度 SKIP）/ 显式授权按推断（推断节点标 `[推断]`）——不得陷入等待死锁
- **回改规则**：发现遗漏节点 MUST 回探索更新并重新确认，MUST NOT 在任务清单静默补节点
- 节点数超 50 时按子流程分节；本块 MUST NOT 含任何 Bash 命令示例

> **完整流程图细则**见 references/flowchart-gate.md。**仅在流程浮现时**（探索中浮现明确的业务功能流程）读取全文细则；纯概念探讨或无流程时直通，无需读取。

**本技能内的执行要求**：

- **条件触发**：探索浮现明确的业务功能流程时（如探索导出功能时梳理出"选择范围 → 点击导出 → 数据量判定 → 分批查询 → 生成文件"的完整链路），产出 `## 功能流程图` 段并执行流程最终确认门；确认后的流程图成为 propose / verify 的**流程基准**
- **无流程时直通**：纯概念探讨或无业务功能流程时（如"帮我想想这个模块该怎么分层"），在探索产物中记录「本次无功能流程」后**直接继续**，MUST NOT 因此阻塞、MUST NOT 为凑制品而虚构流程节点
- **拒绝不阻断**：用户在流程最终确认门上拒绝确认或明确不表态时，记录原始流程图与**未确认状态**后继续探索，MUST NOT 反复要求确认、MUST NOT 陷入死锁；该未确认状态随探索产物传递（propose 降级为仅凭 exploration.md 生成、verify 的节点覆盖度维度 SKIP）
- **落盘方式**：本技能不设强制产出文件，无探索文件时流程图保留在会话中，并在创建或关联探索文件时写入

---

## 强制 checkpoint 体系（delegated 模式）

**delegated 模式**（编排器传入 `mode=delegated`）SHALL 执行强制 checkpoint 体系（不可跳过）：调用即强制创建探索文件 → 提示词校验门 → CONTEXT.md 检查 → CodeGraph 基础扫描（含多项目派发与深度分析）→ L1-L5 grill 追问 → 功能流程图与流程最终确认门 → 聚合一致性门 → 探索完成检测。**完整协议见 `references/exploration-protocol.md`——执行 delegated 探索前 MUST 先 `Read` 该文件并逐步执行。**

（interactive 模式保持立场式，不强制上述序列。）

## 门预算（Gate Budget）

每个阶段至多 **1 个流程级阻塞确认门**：

- **探索阶段**：**功能流程图门**为唯一流程级阻塞门；提示词校验门仅在输入不明确时触发，且其确认 SHALL 与 grill 批量 1 合并为同一轮；grill 追问 SHALL ≤2 批量轮次（L1-L3、L4-L5）；聚合一致性门默认直通（仅硬冲突时暂停，non-blocking）
- **提案阶段**：无阻塞门（验证自动执行）
- **实现阶段**：单一「实现 + 测试桥」
- **归档阶段**：归档确认门

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
- **Do enforce exit discipline** - 探索结束后 MUST NOT auto-enter plan mode / propose mode / design mode；仅在用户显式要求时进入下一阶段；explore 的立场是思考伙伴，流程推进由用户驱动
- **Do enforce data sharing for any sub-agent scan** - 如果探索中派发了 CodeGraph 多项目扫描子代理，子代理扫描指令 MUST 包含退出守卫（完成扫描即停止返回结果，MUST NOT enter plan mode）
- **Do validate the prompt before diving in** - 输入含糊或多义时先过提示词校验门（Step 1-5）：优化后 MUST 等用户确认或修改才继续；清晰输入一句话复述理解后直通（不输出校验表、不要求确认）；变更名输入以该变更既有制品为校验对象；无输入则跳过本门。上游已产出提示词基线时直接通过，不重复确认
- **Don't deadlock on the prompt gate** - 确认门有四条出口（确认 / 修改 / 拒绝后按原理解继续 / 显式授权按推断继续），不得反复要求确认
- **Do produce the flowchart when a flow emerges** - 探索浮现明确的业务功能流程时产出 `## 功能流程图` 段（Mermaid `flowchart TD` + 节点清单表）并执行流程最终确认门；节点粒度 = 可独立验证的业务操作单元，每节点 MUST 含证据位置（`文件:行` 或类.方法；新建功能标 `[新建]` + 预期产物），无法追溯证据的节点 MUST NOT 进入清单
- **Don't force a flowchart** - 纯概念探讨或无业务功能流程时记录「本次无功能流程」后直接继续，不为凑制品虚构节点、不阻断探索；"无固定步骤、无强制产出"的定位不变
- **Don't deadlock on the flowchart gate** - 流程最终确认门同样有四条出口（确认 / 修改 / 拒绝后按原理解继续 / 显式授权按推断继续）；用户拒绝时记录未确认状态后继续，不得反复要求确认
