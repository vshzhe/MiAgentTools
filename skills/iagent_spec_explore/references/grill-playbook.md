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
3. Once confirmed, **MUST write to `openspec/CONTEXT.md` NOW** (not batched, not deferred):
   ```
   **<Term>**: <one or two sentence definition>
   _Avoid_: <deprecated synonyms>
   ```
4. MUST also sync to exploration.md 术语表 section (format: `| <Term> | <definition> | <avoid-list> |`)
5. If CONTEXT.md does not exist yet, create it lazily at first term write
If user uses a term that conflicts with an existing CONTEXT.md entry, surface the conflict BEFORE accepting the usage.

**Code cross-validation**: When user makes a claim about existing code behavior, read relevant source files to verify. If code contradicts the claim, surface the contradiction immediately.

**Scenario construction**: For each confirmed decision, invent at least 1 boundary scenario to stress-test it (network failure, timeout, invalid input, concurrent access). Write scenarios to exploration.md 边界场景 section.

**ADR creation**: Offer ADR only when all three conditions are met: (1) hard to reverse, (2) surprising without context, (3) result of a real trade-off. ADR file at `openspec/docs/adr/NNNN-slug.md`. Create directory lazily.

#### 1.3.4 Implementation Detail Coverage Check

For each confirmed decision, verify coverage across 6 dimensions:
- 术语已精确定义 → CONTEXT.md
- 与现有代码一致 → 交叉验证
- 边界场景已讨论 → ≥1 个场景
- 错误路径已覆盖 → 异常策略
- 状态转换完整 → 所有路径
- 模块契约明确 → 入参/出参

Apply the 5-level depth model with **two batch confirmation rounds** (L1-L3 in batch 1, L4-L5 in batch 2). Each round presents the pending items **one per line** with the AI recommendation, then WAIT for user confirmation of the whole batch. This keeps all five dimensions while capping the grill at **≤2 user stops**.

**批量 1 — L1-L3（意图 / 方案 / 异常）**:
- 逐条列出（每条一行，附 AI 建议）：
  - L1 意图 (What to do?): <proposal>
  - L2 方案 (How to do it?): <approach with rationale>
  - L3 异常 (What if it fails?): <error strategy>
- Wait for user confirmation of the batch
- ✅ Confirmed → record all three in Decisions
- 用户可对任一条单独修改后再确认（逐条列出便于逐项裁决）

**批量 2 — L4-L5（一致性 / 边界）**:
- **L4 一致性（cross-decision + codebase）**: Read all recorded Decisions; report 任何矛盾（跨决策矛盾 / 与既有代码模式冲突）；**无矛盾时 SHALL 自动标记一致（non-blocking，无用户提示，不计入停顿）**
- **L5 边界**: 构造 ≥1 边界场景，逐条列出 + 建议
- Wait for user confirmation of the batch（L4 无矛盾时该批仅呈现 L5）
- ✅ Confirmed → decision is complete

**Gate rules**:
- 追问 SHALL 至多 **2 个批量确认轮次**（L1-L3、L4-L5）；每轮内逐条列出待确认项
- **最低深度 L3**: L1+L2+L3 全部确认后 decision 方可标记完成；用户明确“够了”时可提前结束
- L4 无矛盾时 SHALL 自动直通，不作为额外停顿
- 跳过的层级 SHALL 记入 Pending（MUST NOT 静默丢弃）

#### 1.3.5 Artifact Synchronization

Sync grill-with-docs outputs to exploration.md in real-time:
- CONTEXT.md terms → exploration.md 术语表 section
- ADRs → exploration.md 架构决策 section
- Boundary scenarios → exploration.md 边界场景 section

