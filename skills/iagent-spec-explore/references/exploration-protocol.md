## 强制检查点体系（delegated 模式）

**Input**: 用户的主题描述（想构建什么）。

用 **TodoWrite 工具** 初始化跟踪：`[{"content": "Phase 1: Exploration", "status": "in_progress"}, {"content": "Phase 2: Proposal", "status": "pending"}, {"content": "Phase 3: Verification", "status": "pending"}, {"content": "Phase 4: Implementation", "status": "pending"}, {"content": "Phase 5: Archive", "status": "pending"}]`

### 1.1 创建探索文件（强制检查点）

**⚠️ 强制：Phase 1 开始时执行文件创建检查点**

用户调用本命令时，系统 MUST 先创建探索文件再继续：

```bash
# Determine keyword from user's topic
# Pattern: <keyword>-explore-<sequence>.md
# Example: "add user authentication" -> user-auth-explore-001.md
```

**文件创建过程**：

1. 从用户主题中**提取关键词**
   - 转为 kebab-case（最多 50 字符）
   - 提取失败时默认用 "explore"

2. **确定序号**
   - 在 `openspec/explorations/` 中查找该关键词的最大序号
   - 序号递增（001、002 等）

3. **处理文件名冲突**
   - 文件已存在时序号递增
   - 重试 3 次后仍冲突时追加时间戳后缀
   - 记录冲突解决过程以便追溯

4. **创建文件于**：`openspec/explorations/<keyword>-explore-<sequence>.md`

5. **校验文件创建结果**
   - 检查文件存在且可写
   - 校验失败时中止并报告错误
   - 向用户记录创建状态

**强制检查点**：
- 没有有效探索文件时，系统 MUST NOT 进入追问环节
- 文件创建失败时，系统 MUST 停止并报告错误
- 系统 MUST 告知用户文件创建状态

使用 `path.join()` 保证跨平台兼容。

**TodoWrite 跟踪**：用 Phase 1 的条目初始化 TodoWrite：
```
- [ ] Phase 1: 创建探索文件
- [ ] Phase 1: 提示词校验门
- [ ] Phase 1: CONTEXT.md 检查
- [ ] Phase 1: 关键词检测与分析
- [ ] Phase 1: Grill-with-docs 追问
- [ ] Phase 1: 完成检测与确认
```

### 1.1.2 提示词校验门（强制检查点）

**⚠️ 强制：本门在任何探索动作之前执行，不得跳过。**

**门的校验对象是用户最终提供的需求描述**：调用未携带主题时，先交互收集主题描述，再以收集后的描述执行本门，MUST NOT 对空输入执行校验。

**提示词校验门**: 探索前强制自检用户输入，维度为 目标 Goal / 对象 Object / 范围 Scope / 约束 Constraints / 验收 Acceptance / 歧义 Ambiguity。
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

### 1.1.5 CONTEXT.md 启动检查（强制检查点）

**⚠️ 强制：Phase 1 开始时、追问开始之前执行 CONTEXT.md 检查**

1. 用 Glob 或 Read 工具**检查 `openspec/CONTEXT.md` 是否存在**
2. **若存在**：读取全部既有术语并注入 exploration.md 术语表 段
   - 所有提问沿用既有术语（不重新定义）
3. **若不存在**：在 exploration.md 术语表 段记录"无既有术语表 — 将在探索中创建"
   - 标记 TodoWrite：`- [ ] Phase 1: 创建 CONTEXT.md`

**强制检查点**：
- 进入 1.3 追问之前，系统 MUST 检查 CONTEXT.md 是否存在
- CONTEXT.md 存在时，MUST 在首次提问前把术语载入 exploration.md

### 1.2 初始化结构化格式

写入含增强段的初始文件结构：

```markdown
## Background

<User's initial description and context>

## 提示词基线 (Prompt Baseline)

**原始提示词**: <用户最初提供的原文，未经改写>

**确认后的提示词基线**: <经 1.1.2 校验门确认的版本；清晰输入时即原始提示词本身>

> 下游（提案 / 设计 / 规格 / 任务）以提示词基线为唯一语义来源；基线若变更 MUST 回到 1.1.2 重新确认。

## 功能流程图

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

**分节指南**：
- **Codebase Findings**：记录探索所得（文件、符号、模式）
- **Decision Process**：跟踪决策演进及其理由
- **Pending**：按类型归类，供 Phase 2 关注

### 1.2.0.5 能力级探索记忆注入（强制检查点）

**⚠️ 强制：追问开始之前注入能力级探索记忆**

结构化格式初始化之后：

1. 从用户主题**推断涉及的能力**
   - 用 Glob 工具扫描 `openspec/specs/` 目录获取模块名
   - 把主题关键词与模块名匹配（与变更命名时的模块识别同一逻辑）

2. **检测能力记忆文件**
   - 对每个涉及的能力 `<capability>`，检查 `openspec/specs/<capability>/explorations.md` 是否存在（用 `path.join()`）

3. **注入记忆（文件存在时）**
   - 读取该文件，把历史 Decisions、术语 与 边界场景 注入探索上下文
   - 把摘要写入 exploration.md 的 `## Codebase Findings` 段下 "### Capability Exploration Memory (injected)" 子段
   - 标有 `已过时（由 <change-name> 取代）` 的段落仅作历史参考 — 取代它的变更的决策才是当前有效决策

4. **无记忆文件时**
   - 记录："无能力级探索记忆 — 全新探索"
   - 按常规探索继续

**强制检查点**：
- 进入追问之前，系统 MUST 执行能力记忆检测
- 首次提问前，注入的记忆 MUST 反映到 exploration.md

### 1.2.1 强制 CodeGraph 基础扫描（强制检查点）

**⚠️ 强制：追问开始之前执行 CodeGraph 基础扫描**

结构化格式初始化之后，系统 MUST 执行强制的 CodeGraph 基础扫描：

0. **检查 CodeGraph 可用性（强制的首个动作）**：
   - **MUST 先运行 `codegraph_status`。** 在它返回不可用之前，MUST NOT 用 Glob/Grep 做文件或符号调查 —— 下面的 `codegraph_*` 工具才是主路径，而非可选路径。
   - 可用时：继续使用下面的 CodeGraph 工具
   - `codegraph_status` 确认不可用（未初始化或报错）时：**只有此时**才记录 "CodeGraph 未初始化 — 降级到 Glob/Grep" 并跳到下面的降级路径
   - Grep/Glob 是最后手段，**只有**在 `codegraph_status` 确认不可用后才允许使用 —— 绝不作为跳过 CodeGraph 的捷径

1. 用 `codegraph_files` 工具**扫描项目文件结构**
   - 获取带元数据的完整项目文件树
   - 识别与探索主题相关的目录与文件
   - 把结果写入 `## Codebase Findings > Discovered Files`

2. 用 `codegraph_search` 工具**检索相关符号**
   - 检索与探索主题关键词匹配的符号
   - 记录发现的符号及其 file:line 位置
   - 把结果写入 `## Codebase Findings > Identified Symbols`

   **注意**：`codegraph_context` 延后到 1.4（追问之后、任务描述更清晰时）。

3. 在探索文件中**记录扫描结果**：
   ```markdown
   ## Codebase Findings

   ### Discovered Files
   - <file-path>: <relevance-reason>

   ### Identified Symbols
   - <symbol-name> (<file-path>:<line>): <reason>

   ### Pattern Matches
   - <pattern-name>: <example-location>
   ```

**降级（回退，最后手段）**：**只有**在 `codegraph_status` 确认 CodeGraph MCP 工具不可用（未初始化或报错）后才允许：
- 文件结构发现降级到 Glob 工具
- 符号检索降级到 Grep 工具
- 在探索文件中记录："CodeGraph 不可用 — 已用 Glob/Grep 降级"

**强制检查点**：
- 进入 1.3 追问之前，系统 MUST 执行基础扫描
- CodeGraph 与 Glob/Grep 都失败时，系统 MUST 告警但不阻塞
- 继续之前 MUST 把扫描结果写入探索文件

### 1.2.1.5 多项目 CodeGraph 子代理扫描（条件触发 — 检测到其他项目路径时执行）

> 完整细则见 `references/multi-project-scan.md`；检测到其他项目路径时 MUST 先 `Read` 该文件。

### 1.2.2 智能判定：新增功能 vs 修改既有代码

**目的**：判断是否触发深度分析（`codegraph_explore` + `codegraph_impact`）。

**判定逻辑**：
1. **分析用户输入关键词**中的修改意图：
   - "modify"、"update"、"change"、"edit"、"refactor"、"enhance"、"优化"、"修改"、"重构" → 触发深度分析
   - "add"、"create"、"new"、"introduce"、"implement"、"新增"、"添加" → 可跳过深度分析

2. **与 CodeGraph 发现结果交叉核对**：
   - 基础扫描找到相关既有符号 → 很可能是修改既有代码
   - 基础扫描未找到相关符号 → 很可能是新增功能

3. **判定**：
   - **检测到修改既有代码**：系统 MUST 触发深度分析钩子
     - 执行 `codegraph_explore` 做深潜
     - 执行 `codegraph_impact` 分析影响半径
     - 把结果记入 `## Implementation Deep-Dive` 段
   - **纯新增功能**：跳过深度分析，仅保留基础扫描结果
   - **无法确定**：默认触发深度分析（更安全）

4. 在探索文件中**记录判定**：
   ```
   ## Analysis
   ### Deep Analysis Trigger
   - Triggered: Yes/No
   - Reason: <detection rationale>
   - Scope: <affected symbols/files>
   ```

### 1.2.3 CodeGraph 深度分析（条件触发 — 基于触发器）

**触发**：1.2.2 检测到修改意图，或检测到 Scope.Modify 关键词时。

触发后执行深度分析：
1. `codegraph_explore` — 对具体符号做深度探索
2. `codegraph_impact` — 分析受影响符号的影响半径
3. 把结果写入 exploration.md 的 `## Implementation Deep-Dive` 段

**范围控制**（按触发级别）：
- 🔴 自动（Scope.Modify）：全部 6 个分析维度，最多 10 个核心符号
- 🟡 提示（Scope.Add）：理由 + 约束 + 假设，最多 10 个核心符号
- 🟢 手动（Depth.Deep）：由用户选定维度

### 1.2.4 扫描后更新探索文件

基础扫描（以及触发时的深度分析）之后：
1. 用发现的所有文件与符号更新 `## Codebase Findings` 段
2. 用架构与业务流发现更新 `## Analysis` 段
3. 用识别出的符号更新 `## Pending > For Phase 2 Impact Analysis`
4. 若执行了 1.2.1.5 多项目子代理扫描，把其结果并入 Codebase Findings 段的 `### Other Project Findings` 下
5. 记录："CodeGraph 扫描完成 — 发现 <N> 个文件、<M> 个符号"

### 1.3 Grill-With-Docs 追问

> 完整 grill 问题库与 L1-L5 细则（含批量确认规则）见 `references/grill-playbook.md`；执行 1.3 前 MUST 先 `Read` 该文件。

### 1.4 关键词检测与分析

> 完整关键词分析与实现深潜细则见 `references/deep-analysis.md`；执行 1.4 前 MUST 先 `Read` 该文件。

### 1.5 更新探索文件

**每轮交流之后，按顺序执行以下步骤**：

**Step 1 — 写入 CONTEXT.md（术语已定则强制）**：
- 本轮若敲定某术语，MUST 立即写入 `openspec/CONTEXT.md`
- 使用格式：`**<Term>**: <definition>\\n_Avoid_: <synonyms>`
- CONTEXT.md 不存在时，此时惰性创建

**Step 2 — 更新 exploration.md 各段**：

| 内容类型 | 段落 |
|--------------|---------|
| 用户原始输入 | Background |
| 分析结果（若已运行） | Analysis |
| 已定术语（来自 CONTEXT.md） | 术语表 |
| AI 提问 + 用户回答 | Questions |
| 新建的 ADR | 架构决策 |
| 构造的边界场景 | 边界场景 |
| 已确认的选择 | Decisions |
| 未决项 | Pending |

使用 Markdown 格式，语法规范。

### 1.5.5 功能流程图与流程最终确认门（强制检查点）

**⚠️ 强制：探索分析完成后必须强制产出功能流程图，并经流程最终确认门确认后才进入 1.6。**

触发点：1.3 grill L1-L5 与 1.4 关键词分析均已执行、1.5 探索文件已更新之后。本制品是**强制产出**——不因"本次判定无流程"而跳过，也 MUST NOT 留空。

**功能流程图**：把探索发现的业务功能流程固化为探索产物 `## 功能流程图` 段（Mermaid `flowchart TD` + 关键操作节点清单表）。
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

### 1.6 探索完成检测

所有歧义都消解时：
- Pending 段为空，或所有条目都有答案
- 用户确认已清晰（或表示 "that's enough"）

**一致性直通（取代过渡确认提示）**：

1. 执行 1.6.5 的 CONTEXT.md 检查点与 1.6.6 的聚合一致性门
2. **两者均通过（决策之间无硬冲突）**：宣告 "校验通过 — 直接生成提案" 并立即进入 Phase 2 —— 不得问 "准备好进入提案了吗？"
3. **检测到硬冲突**：呈现冲突的决策（列出冲突决策对）并询问用户按哪个方向走；冲突解决后才继续
4. grill L1-L5 需求澄清门（1.3.4）仍需等待用户确认；1.7 放弃处理（用户主动停止）保留

### 1.6.5 CONTEXT.md 检查点 — Phase 1 收尾（强制检查点）

**⚠️ 强制：Phase 1 结束前校验 CONTEXT.md**

用户确认探索完成后，系统 MUST 校验 CONTEXT.md：

1. 用 Glob 或 Read 工具**检查 `openspec/CONTEXT.md` 是否存在**

2. **若存在**：校验 exploration.md 术语表 段的全部术语均已写入 CONTEXT.md
   - 读取 CONTEXT.md 内容
   - 与 exploration.md 术语表 段比对
   - 有术语缺失于 CONTEXT.md 时自动同步（补写缺失术语）
   - 记录："CONTEXT.md 已校验 — 同步 <N> 个术语"

3. **若不存在**：从 exploration.md 术语表 段自动生成 CONTEXT.md
   - 用全部已定术语创建 `openspec/CONTEXT.md`
   - 格式：`**<Term>**: <definition>\\n_Avoid_: <synonyms>`
   - 记录："CONTEXT.md 已创建 — 来自探索的 <N> 个术语"

4. **兼容性检查**（Task 12.1，已收窄）：无探索文件时（如在既有变更上运行 `iagent:spec-apply`）：
   - 在宣告"无探索文件"之前，至少重试一次路径解析（处理可能被误判为缺失的瞬时路径解析失败）
   - 确认确实无探索文件时：该跳过**仅适用于 CONTEXT.md 检查** —— 记录 WARN（不得静默按 info）："WARN: 跳过 CONTEXT.md 检查：无探索文件"
   - 该跳过**不**扩展到 1.6.6 聚合一致性门（不可豁免的处理见 1.6.6）
   - 不得因该检查点阻塞工作流

**强制检查点**：
- 允许 Phase 1→Phase 2 转换之前，系统 MUST 执行 CONTEXT.md 检查
- CONTEXT.md 缺失且无探索文件时，CONTEXT.md 检查可跳过并记 WARN 日志（非阻塞）；1.6.6 聚合一致性门不可豁免
- 记录全部动作（含跳过）以便追溯

### 1.6.6 聚合一致性门 — Phase 1 收尾（强制检查点）

**⚠️ 强制：Phase 1 结束前做跨决策聚合一致性扫描**

**默认直通语义（非阻断）**: 本门是兜底门——**无硬冲突时自动直通**（记录日志后继续，**不计入用户停顿**），仅在检测到硬冲突时暂停呈现。该门 MUST NOT 被删除（它是 1.3.4 增量 L4 检查的兜底）。

本门是逐决策 L4 检查（1.3.4）的兜底。L4 检查随每个新决策增量执行，并静默标记"无冲突"—— 后期出现的 Scope Changes 可能引入 L4 从未重扫的跨决策矛盾。本门把全部已记录 Decisions 一并读取，捕获这类残留矛盾。**本门不豁免**于 Task 12.1 的"无探索文件"跳过。

1.6.5 的 CONTEXT.md 检查点之后，系统 MUST 执行聚合扫描：

1. 从 exploration.md 的 `## Decisions` 段**读取全部 Decisions**

2. **exploration.md 缺失或 Decisions 段为空时**：
   - 记录 WARN："聚合一致性门：exploration.md/Decisions 为空 — 无可扫描，按空集通过"
   - 不得静默跳过（与 CONTEXT.md 的跳过不同）—— 显式记录"空集通过"
   - 进入 Phase 2

3. **Decisions 非空时**：逐对扫描全部决策，检查三类硬冲突：
   - **技术选型冲突**：如 Decision A 选 SQLite，Decision B 依赖 Postgres 专有特性
   - **依赖方向冲突**：如 Decision A 依赖 B 的产出，而 Decision B 又依赖 A 的产出（循环）
   - **约束互斥**：如 Decision A 要求兼容 IE（不用 ES6+），Decision B 要求 ES6+ 语法

4. **发现硬冲突时**：
   - 暂停并向用户呈现冲突："Decision A <X> 与 Decision B <Y> 冲突 — 按哪个方向走？"
   - MUST NOT 自动裁决或静默继续
   - 把裁决结果记入 exploration.md 的 `## Scope Changes` / `## Decisions`

5. **无硬冲突时**：记录"聚合一致性门通过 — 扫描 <N> 个决策，0 个硬冲突"，并进入 Phase 2

**强制检查点**：
- 系统 MUST 在 1.6.5 之后、1.7 / Phase 2 之前执行本门
- 本门 MUST NOT 借 Task 12.1 的"无探索文件"豁免跳过（该豁免仅限 CONTEXT.md）
- 软不一致（风格、命名）不阻塞；仅上述三类硬冲突阻塞

### 1.7 放弃探索处理

用户说 "abandon"、"stop"、"cancel" 时：
> "删除探索文件还是保留？"
> [删除] [保留]

- **删除**：从 `openspec/explorations/` 移除文件
- **保留**：文件保留以备后用

---

