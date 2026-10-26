/**
 * spec 类型技能模板：探索。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { deriveCommandContent } from '../derive-command.js';
import { buildPromptGateBlock, buildPromptGateCompact, GATE_PROTOCOL_PREAMBLE, renderGateWhitelistSection, REQUIREMENT_DIMENSIONS } from '../prompt-gate.js';
import { buildFlowchartBlock, buildFlowchartCompact, REQUIREMENT_FLOW_COLUMNS } from '../flowchart-gate.js';
import { CODEGRAPH_CLI, CODEGRAPH_MCP } from '../tool-whitelist.js';
import { renderCodegraphProbeOrder } from '../codegraph-protocol.js';

/** 需求维度的提示词校验门紧凑版（技能正文内联）；全文细则见 references/prompt-gate.md */
const PROMPT_GATE = buildPromptGateCompact(REQUIREMENT_DIMENSIONS);

/** 需求版功能流程图紧凑版（技能正文内联）；全文细则见 references/flowchart-gate.md */
const FLOWCHART = buildFlowchartCompact(REQUIREMENT_FLOW_COLUMNS);

/** 提示词校验门全文（写入 references/prompt-gate.md，AI 在 Gate 触发时按需读取） */
const PROMPT_GATE_FULL = buildPromptGateBlock(REQUIREMENT_DIMENSIONS);

/** 功能流程图全文（写入 references/flowchart-gate.md，AI 在流程生成时按需读取） */
const FLOWCHART_FULL = buildFlowchartBlock(REQUIREMENT_FLOW_COLUMNS);

/** 探索强制检查点体系全文（写入 references/exploration-protocol.md，delegated 模式按需读取） */
const EXPLORATION_PROTOCOL_FULL = `## 强制检查点体系（delegated 模式）

**Input**: 用户的主题描述（想构建什么）。

用 **TodoWrite 工具** 初始化跟踪：\`[{"content": "Phase 1: Exploration", "status": "in_progress"}, {"content": "Phase 2: Proposal", "status": "pending"}, {"content": "Phase 3: Verification", "status": "pending"}, {"content": "Phase 4: Implementation", "status": "pending"}, {"content": "Phase 5: Archive", "status": "pending"}]\`

### 1.1 创建探索文件（强制检查点）

**⚠️ 强制：Phase 1 开始时执行文件创建检查点**

用户调用本命令时，系统 MUST 先创建探索文件再继续：

\`\`\`bash
# Determine keyword from user's topic
# Pattern: <keyword>-explore-<sequence>.md
# Example: "add user authentication" -> user-auth-explore-001.md
\`\`\`

**文件创建过程**：

1. 从用户主题中**提取关键词**
   - 转为 kebab-case（最多 50 字符）
   - 提取失败时默认用 "explore"

2. **确定序号**
   - 在 \`openspec/explorations/\` 中查找该关键词的最大序号
   - 序号递增（001、002 等）

3. **处理文件名冲突**
   - 文件已存在时序号递增
   - 重试 3 次后仍冲突时追加时间戳后缀
   - 记录冲突解决过程以便追溯

4. **创建文件于**：\`openspec/explorations/<keyword>-explore-<sequence>.md\`

5. **校验文件创建结果**
   - 检查文件存在且可写
   - 校验失败时中止并报告错误
   - 向用户记录创建状态

**强制检查点**：
- 没有有效探索文件时，系统 MUST NOT 进入追问环节
- 文件创建失败时，系统 MUST 停止并报告错误
- 系统 MUST 告知用户文件创建状态

使用 \`path.join()\` 保证跨平台兼容。

**TodoWrite 跟踪**：用 Phase 1 的条目初始化 TodoWrite：
\`\`\`
- [ ] Phase 1: 创建探索文件
- [ ] Phase 1: 提示词校验门
- [ ] Phase 1: CONTEXT.md 检查
- [ ] Phase 1: 关键词检测与分析
- [ ] Phase 1: Grill-with-docs 追问
- [ ] Phase 1: 完成检测与确认
\`\`\`

### 1.1.2 提示词校验门（强制检查点）

**⚠️ 强制：本门在任何探索动作之前执行，不得跳过。**

**门的校验对象是用户最终提供的需求描述**：调用未携带主题时，先交互收集主题描述，再以收集后的描述执行本门，MUST NOT 对空输入执行校验。

**提示词校验门**: 探索前强制自检用户输入，维度为 目标 Goal / 对象 Object / 范围 Scope / 约束 Constraints / 验收 Acceptance / 歧义 Ambiguity。
- **清晰**（目标 Goal / 对象 Object / 范围 Scope / 歧义 Ambiguity 均无 \`❌\` 与实质 \`⚠️\`）→ 一句话复述理解后直通，不输出校验表、不要求确认
- **不明确**（任一维 \`❌\` 或实质 \`⚠️\`）→ 先做提示词优化，输出 \`【优化后提示词】\`（推断项标 \`[推断]\`、未知项标 \`[待确认]\`）与 \`【优化说明】\`，**⛔ GATE: 立即结束本次响应并等待用户确认或修改**（本次响应到此结束，收到用户响应后继续；出口：确认 / 修改 / 拒绝 / 显式授权按推断），**不得陷入等待死循环**
- **软不明确**（仅细节级歧义）→ 记 \`[假设]\` 继续
- 优化**不篡改原始意图**、不增加用户未提出的需求
- 校验结论与基线写入探索产物 \`## 提示词基线\` 段，作为下游唯一语义来源
- 空输入不校验；输入为变更名时以该变更既有制品为校验对象；上游已产出基线时直接通过

> **完整门细则**见 references/prompt-gate.md。**仅在 Gate 实际触发时**（输入不明确、进入 Step 3 优化流程）读取全文细则；清晰输入直接通过，无需读取。

**本技能内的执行要求**：

- 门的位置固定在此处：探索文件已创建（1.1），而 CONTEXT.md 检查（1.1.5）、代码库扫描（1.2.1）与 grill 追问（1.3）均在其后
- 不明确分支的确认门是**澄清门（确认 WHAT）**：用户确认或修改前 MUST NOT 推进到 1.1.5 及之后的任何步骤
- 校验结论（原始提示词 + 确认后的提示词基线）写入探索文件 1.2 结构中的 \`## 提示词基线\` 段

### 1.1.5 CONTEXT.md 启动检查（强制检查点）

**⚠️ 强制：Phase 1 开始时、追问开始之前执行 CONTEXT.md 检查**

1. 用 Glob 或 Read 工具**检查 \`openspec/CONTEXT.md\` 是否存在**
2. **若存在**：读取全部既有术语并注入 exploration.md 术语表 段
   - 所有提问沿用既有术语（不重新定义）
3. **若不存在**：在 exploration.md 术语表 段记录"无既有术语表 — 将在探索中创建"
   - 标记 TodoWrite：\`- [ ] Phase 1: 创建 CONTEXT.md\`

**强制检查点**：
- 进入 1.3 追问之前，系统 MUST 检查 CONTEXT.md 是否存在
- CONTEXT.md 存在时，MUST 在首次提问前把术语载入 exploration.md

### 1.2 初始化结构化格式

写入含增强段的初始文件结构：

\`\`\`markdown
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

**分节指南**：
- **Codebase Findings**：记录探索所得（文件、符号、模式）
- **Decision Process**：跟踪决策演进及其理由
- **Pending**：按类型归类，供 Phase 2 关注

### 1.2.0.5 能力级探索记忆注入（强制检查点）

**⚠️ 强制：追问开始之前注入能力级探索记忆**

结构化格式初始化之后：

1. 从用户主题**推断涉及的能力**
   - 用 Glob 工具扫描 \`openspec/specs/\` 目录获取模块名
   - 把主题关键词与模块名匹配（与变更命名时的模块识别同一逻辑）

2. **检测能力记忆文件**
   - 对每个涉及的能力 \`<capability>\`，检查 \`openspec/specs/<capability>/explorations.md\` 是否存在（用 \`path.join()\`）

3. **注入记忆（文件存在时）**
   - 读取该文件，把历史 Decisions、术语 与 边界场景 注入探索上下文
   - 把摘要写入 exploration.md 的 \`## Codebase Findings\` 段下 "### Capability Exploration Memory (injected)" 子段
   - 标有 \`已过时（由 <change-name> 取代）\` 的段落仅作历史参考 — 取代它的变更的决策才是当前有效决策

4. **无记忆文件时**
   - 记录："无能力级探索记忆 — 全新探索"
   - 按常规探索继续

**强制检查点**：
- 进入追问之前，系统 MUST 执行能力记忆检测
- 首次提问前，注入的记忆 MUST 反映到 exploration.md

### 1.2.1 强制 CodeGraph 基础扫描（强制检查点）

**⚠️ 强制：追问开始之前执行 CodeGraph 基础扫描**

结构化格式初始化之后，系统 MUST 执行强制的 CodeGraph 基础扫描：

0. **探测 CodeGraph 可用性（能力探测顺序，不是单一工具硬约束）**：

   ${renderCodegraphProbeOrder({ withCli: true })}

   可用时：继续使用下面的 CodeGraph 工具。
   三通道全部不可用 → 记录 "CodeGraph 不可用 — 降级到 Glob/Grep" 并跳到下面的降级路径。
   Grep/Glob 是最后手段，**只有**在能力探测三通道全部失败后才允许使用 —— 绝不作为跳过 CodeGraph 的捷径。

1. 用 \`codegraph_files\` 工具**扫描项目文件结构**
   - 获取带元数据的完整项目文件树
   - 识别与探索主题相关的目录与文件
   - 把结果写入 \`## Codebase Findings > Discovered Files\`

2. 用 \`codegraph_search\` 工具**检索相关符号**
   - 检索与探索主题关键词匹配的符号
   - 记录发现的符号及其 file:line 位置
   - 把结果写入 \`## Codebase Findings > Identified Symbols\`

   **注意**：\`codegraph_context\` 延后到 1.4（追问之后、任务描述更清晰时）。

3. 在探索文件中**记录扫描结果**：
   \`\`\`markdown
   ## Codebase Findings

   ### Discovered Files
   - <file-path>: <relevance-reason>

   ### Identified Symbols
   - <symbol-name> (<file-path>:<line>): <reason>

   ### Pattern Matches
   - <pattern-name>: <example-location>
   \`\`\`

**降级（回退，最后手段）**：**只有**在能力探测三通道全部不可用（未初始化或报错）后才允许：
- 文件结构发现降级到 Glob 工具
- 符号检索降级到 Grep 工具
- 在探索文件中记录："CodeGraph 不可用 — 已用 Glob/Grep 降级"

**强制检查点**：
- 进入 1.3 追问之前，系统 MUST 执行基础扫描
- CodeGraph 与 Glob/Grep 都失败时，系统 MUST 告警但不阻塞
- 继续之前 MUST 把扫描结果写入探索文件

### 1.2.1.5 多项目 CodeGraph 子代理扫描（条件触发 — 检测到其他项目路径时执行）

> 完整细则见 \`references/multi-project-scan.md\`；检测到其他项目路径时 MUST 先 \`Read\` 该文件。

### 1.2.2 智能判定：新增功能 vs 修改既有代码

**目的**：判断是否触发深度分析（\`codegraph_explore\` + \`codegraph_impact\`）。

**判定逻辑**：
1. **分析用户输入关键词**中的修改意图：
   - "modify"、"update"、"change"、"edit"、"refactor"、"enhance"、"优化"、"修改"、"重构" → 触发深度分析
   - "add"、"create"、"new"、"introduce"、"implement"、"新增"、"添加" → 可跳过深度分析

2. **与 CodeGraph 发现结果交叉核对**：
   - 基础扫描找到相关既有符号 → 很可能是修改既有代码
   - 基础扫描未找到相关符号 → 很可能是新增功能

3. **判定**：
   - **检测到修改既有代码**：系统 MUST 触发深度分析钩子
     - 执行 \`codegraph_explore\` 做深潜
     - 执行 \`codegraph_impact\` 分析影响半径
     - 把结果记入 \`## Implementation Deep-Dive\` 段
   - **纯新增功能**：跳过深度分析，仅保留基础扫描结果
   - **无法确定**：默认触发深度分析（更安全）

4. 在探索文件中**记录判定**：
   \`\`\`
   ## Analysis
   ### Deep Analysis Trigger
   - Triggered: Yes/No
   - Reason: <detection rationale>
   - Scope: <affected symbols/files>
   \`\`\`

### 1.2.3 CodeGraph 深度分析（条件触发 — 基于触发器）

**触发**：1.2.2 检测到修改意图，或检测到 Scope.Modify 关键词时。

触发后执行深度分析：
1. \`codegraph_explore\` — 对具体符号做深度探索
2. \`codegraph_impact\` — 分析受影响符号的影响半径
3. 把结果写入 exploration.md 的 \`## Implementation Deep-Dive\` 段

**范围控制**（按触发级别）：
- 🔴 自动（Scope.Modify）：全部 6 个分析维度，最多 10 个核心符号
- 🟡 提示（Scope.Add）：理由 + 约束 + 假设，最多 10 个核心符号
- 🟢 手动（Depth.Deep）：由用户选定维度

### 1.2.4 扫描后更新探索文件

基础扫描（以及触发时的深度分析）之后：
1. 用发现的所有文件与符号更新 \`## Codebase Findings\` 段
2. 用架构与业务流发现更新 \`## Analysis\` 段
3. 用识别出的符号更新 \`## Pending > For Phase 2 Impact Analysis\`
4. 若执行了 1.2.1.5 多项目子代理扫描，把其结果并入 Codebase Findings 段的 \`### Other Project Findings\` 下
5. 记录："CodeGraph 扫描完成 — 发现 <N> 个文件、<M> 个符号"

### 1.3 Grill-With-Docs 追问

> 完整 grill 问题库与 L1-L5 细则（含批量确认规则）见 \`references/grill-playbook.md\`；执行 1.3 前 MUST 先 \`Read\` 该文件。

### 1.4 关键词检测与分析

> 完整关键词分析与实现深潜细则见 \`references/deep-analysis.md\`；执行 1.4 前 MUST 先 \`Read\` 该文件。

### 1.5 更新探索文件

**每轮交流之后，按顺序执行以下步骤**：

**Step 1 — 写入 CONTEXT.md（术语已定则强制）**：
- 本轮若敲定某术语，MUST 立即写入 \`openspec/CONTEXT.md\`
- 使用格式：\`**<Term>**: <definition>\\\\n_Avoid_: <synonyms>\`
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

**功能流程图**：把探索发现的业务功能流程固化为探索产物 \`## 功能流程图\` 段（Mermaid \`flowchart TD\` + 关键操作节点清单表）。
- **节点粒度** = 可独立验证的业务操作单元（用户操作 / 业务判定 / 数据写入 / 外部调用）；节点标识在图中与表中 MUST 一致，多流程时全局唯一递增
- **清单列集**：节点 / 操作 / 触发条件 / 证据位置 / 异常路径
- **证据追溯（硬约束）**：每节点 MUST 填 \`文件:行\` 或 类.方法；新建功能标 \`[新建]\` + 预期产物；无法追溯证据的节点 MUST NOT 进入清单
- **⛔ GATE: 流程最终确认门（强制停止）**：呈现流程图与清单并立即结束本次响应，等待确认；出口：确认 / 修改 / 拒绝（记未确认状态，提案降级 + 验证该维度 SKIP）/ 显式授权按推断（推断节点标 \`[推断]\`）——不得陷入等待死锁
- **回改规则**：发现遗漏节点 MUST 回探索更新并重新确认，MUST NOT 在任务清单静默补节点
- 节点数超 50 时按子流程分节；本块 MUST NOT 含任何 Bash 命令示例

> **完整流程图细则**见 references/flowchart-gate.md。**仅在流程浮现时**读取全文细则。

**本技能内的执行要求**：

- **强制产出**：把探索发现的业务功能流程固化为探索文件 1.2 结构中的 \`## 功能流程图\` 段（该段已在 1.2 预留）；Mermaid 流程图与节点清单表的节点 id MUST 稳定一致
- **节点证据追溯**：每节点 MUST 填证据位置——既有代码标 \`文件:行\` 或 类.方法，**新建功能**节点标 \`[新建]\` 并写明预期产物（新增哪个类 / 页面 / 接口）；**无法追溯证据的节点 MUST NOT 进入清单**
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

1. 用 Glob 或 Read 工具**检查 \`openspec/CONTEXT.md\` 是否存在**

2. **若存在**：校验 exploration.md 术语表 段的全部术语均已写入 CONTEXT.md
   - 读取 CONTEXT.md 内容
   - 与 exploration.md 术语表 段比对
   - 有术语缺失于 CONTEXT.md 时自动同步（补写缺失术语）
   - 记录："CONTEXT.md 已校验 — 同步 <N> 个术语"

3. **若不存在**：从 exploration.md 术语表 段自动生成 CONTEXT.md
   - 用全部已定术语创建 \`openspec/CONTEXT.md\`
   - 格式：\`**<Term>**: <definition>\\\\n_Avoid_: <synonyms>\`
   - 记录："CONTEXT.md 已创建 — 来自探索的 <N> 个术语"

4. **兼容性检查**（Task 12.1，已收窄）：无探索文件时（如在既有变更上运行 \`iagent:spec-apply\`）：
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

1. 从 exploration.md 的 \`## Decisions\` 段**读取全部 Decisions**

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
   - 把裁决结果记入 exploration.md 的 \`## Scope Changes\` / \`## Decisions\`

5. **无硬冲突时**：记录"聚合一致性门通过 — 扫描 <N> 个决策，0 个硬冲突"，并进入 Phase 2

**强制检查点**：
- 系统 MUST 在 1.6.5 之后、1.7 / Phase 2 之前执行本门
- 本门 MUST NOT 借 Task 12.1 的"无探索文件"豁免跳过（该豁免仅限 CONTEXT.md）
- 软不一致（风格、命名）不阻塞；仅上述三类硬冲突阻塞

### 1.7 放弃探索处理

用户说 "abandon"、"stop"、"cancel" 时：
> "删除探索文件还是保留？"
> [删除] [保留]

- **删除**：从 \`openspec/explorations/\` 移除文件
- **保留**：文件保留以备后用

---

`;

const MULTI_PROJECT_SCAN_FULL = `### 1.2.1.5 多项目 CodeGraph 子代理扫描（条件触发 — 检测到其他项目路径时执行）

**⚠️ 条件触发：仅当探索上下文含其他项目路径时执行**

1.2.1 基础扫描（当前项目）之后，系统 MUST 检查探索上下文是否含其他项目的路径（如用户指定的 \`--project-path\`、自动迁移的 SOURCE_PROJECT/TARGET_PROJECT，或对话中确认的路径）。

**检测到其他项目路径时**：

1. 对每个其他项目路径**检查 CodeGraph 初始化情况**：
   - 运行 Bash \`ls <path>/.codegraph/\` 检查目标项目是否有 \`.codegraph/\` 目录（能列出目录内容 —— 含 codegraph.db —— 即表示 CodeGraph 已初始化）。不得用 Glob 检查点号前缀目录（Glob 对它们会返回假阴性）
   - 已初始化（ls 成功）：继续子代理扫描
   - 未初始化（ls 失败 —— 目录不存在）：记录 WARN "其他项目 <path> 未初始化 CodeGraph — 降级到 Glob/Grep"，并降级到 Glob/Grep

2. **对所有检测到的项目用单个子代理串行扫描**：
   - 只派发**一个**子代理，让其在自身内部**串行**扫描全部检测到的项目；系统 MUST NOT 为每个项目路径各派一个子代理（这样可避免 N 次重复冷启动）
   - 子代理 SHALL 对每个项目各调用一次 CodeGraph MCP 工具，每次调用把 \`projectPath\` 参数切到该项目路径
   - 对每个项目执行 \`codegraph_files\` 获取文件结构、\`codegraph_search\` 检索符号、\`codegraph_context\` 理解上下文
   - 限制扫描深度：\`maxDepth: 3\`、\`maxNodes: 20\`，避免结果过多
   - 子代理 MUST NOT 修改任何文件

   - **⛔ EXIT GUARD（退出守卫）**：子代理扫描完所有项目后 MUST 立即停止并返回发现 —— MUST NOT 进入 plan 模式 / 设计模式 / 提出后续步骤 / 建议实现；子代理只是扫描器，其唯一产出是按项目分组的结构化发现；流程推进只由编排器掌握
   - **MUST 只做增量查询**：子代理 MUST 只扫描 1.2.1 基础扫描未覆盖的部分；MUST NOT 重新推导当前项目探索文件中已有的信息
   - 每个项目施加 120s 预算（超预算 → 该项目按 WARN 降级到 Glob/Grep）

3. **按项目降级（项目粒度）**：
   - 某项目 CodeGraph 未初始化、其扫描失败或超出 120s 预算时：**只有该项目**按 WARN 日志降级到 Glob/Grep —— 其他项目照常扫描
   - 单个项目失败 MUST NOT 影响其他项目
   - 某其他项目路径与当前项目路径相同时，子代理 SHALL 跳过该项目
   - 运行时完全不提供子代理能力时：全部项目按 WARN 日志降级到 Glob/Grep

4. 把结果**合并**进 exploration.md：
   - 写入 \`## Codebase Findings > ### Other Project Findings\` 子段
   - 结果加项目路径前缀，便于归属清晰
   - 结果含：发现的文件、识别出的符号与调用链

5. **未检测到其他项目路径时**：
   - 不触发多项目子代理扫描
   - 按既有 1.2.2 流程不变继续

**降级（回退）**：子代理派发失败、子代理超时，或目标项目未初始化 CodeGraph 时：
- 按 WARN 记录具体失败原因
- 该项目降级到 Glob/Grep
- 不重试失败的子代理扫描
- 该降级不影响当前项目的扫描结果

**强制检查点**：
- 系统 MUST 在 1.2.1 基础扫描完成后执行本检查
- 存在其他项目路径时，系统 MUST 尝试子代理扫描（含降级路径）
- 进入 1.2.2 之前 MUST 把结果写入 exploration.md
- 本检查 MUST NOT 阻塞主流程 —— 失败时优雅降级

`;

const GRILL_PLAYBOOK_FULL = `### 1.3 Grill-With-Docs 追问

完整执行 grill-with-docs 纪律：grilling 原语（决策树遍历）+ 领域建模（CONTEXT.md 术语表、ADR、代码交叉验证、场景构造）。

#### 1.3.1 决策树构建

**追问之前先构建决策树**：
- 识别决策之间的父子依赖关系
- 按依赖排序问题（先解父决策再解子决策）
- 把决策树结构记入 exploration.md

#### 1.3.2 Grilling 原语

**触发条件** —— 以下情形应提问：
- 范围含糊（如"加个认证"）
- 技术方案不清楚（如"用缓存"）
- 需求不可度量（如"弄快点"）

**提问行为**：
- **决策树遍历**：先解父决策，再解子决策
- **代码库优先**：能通过探查代码回答的问题，直接去查而不要问
- **一次一个**：一次只问一个问题，等回答
- **给建议**：始终附上 "我的建议：<answer>"
- **深度不限**：直到问清楚为止，不设人为上限
- **跟踪进展**：每轮交流后更新探索文件

#### 1.3.3 领域建模集成

**术语精确化（强制 —— 每轮交流都执行）**：
每次出现含糊或含义过载的术语时，立即：
1. 提出精确的规范术语："我的建议：用 '<term>' —— 定义：<one-sentence>"
2. 等待用户确认
3. 确认后**立即写入 \`openspec/CONTEXT.md\`**（不批量、不延后）：
   \`\`\`
   **<Term>**: <one or two sentence definition>
   _Avoid_: <deprecated synonyms>
   \`\`\`
4. MUST 同时同步到 exploration.md 术语表 段（格式：\`| <Term> | <definition> | <avoid-list> |\`）
5. CONTEXT.md 尚不存在时，在首次写入术语时惰性创建
用户使用的术语与 CONTEXT.md 既有条目冲突时，在接受该用法**之前**先指出冲突。

**代码交叉验证**：用户对既有代码行为做出断言时，读取相关源文件核实。代码与断言矛盾时，立即指出矛盾。

**场景构造**：对每个已确认的决策，至少构造 1 个边界场景做压力测试（网络故障、超时、非法输入、并发访问）。把场景写入 exploration.md 边界场景 段。

**ADR 创建**：仅当三个条件同时满足时才提议 ADR：(1) 难以逆转，(2) 脱离上下文会令人意外，(3) 是真实权衡的结果。ADR 文件位于 \`openspec/docs/adr/NNNN-slug.md\`。目录惰性创建。

#### 1.3.4 实现细节覆盖检查

对每个已确认的决策，检查 6 个维度的覆盖：
- 术语已精确定义 → CONTEXT.md
- 与现有代码一致 → 交叉验证
- 边界场景已讨论 → ≥1 个场景
- 错误路径已覆盖 → 异常策略
- 状态转换完整 → 所有路径
- 模块契约明确 → 入参/出参

应用 5 级深度模型，配**两轮批量确认**（批量 1 为 L1-L3，批量 2 为 L4-L5）。每轮**每行一条**列出待确认项并附 AI 建议，然后等待用户对整批确认。这样既保留五个维度，又把 grill 控制在**≤2 次用户停顿**。

**批量 1 — L1-L3（意图 / 方案 / 异常）**:
- 逐条列出（每条一行，附 AI 建议）：
  - L1 意图（做什么？）: <提案>
  - L2 方案（怎么做？）: <方案与理由>
  - L3 异常（失败怎么办？）: <错误处理策略>
- 等待用户对该批确认
- ✅ 已确认 → 把三条全部记入 Decisions
- 用户可对任一条单独修改后再确认（逐条列出便于逐项裁决）

**批量 2 — L4-L5（一致性 / 边界）**:
- **L4 一致性（跨决策 + 代码库）**: 读取全部已记录 Decisions；报告任何矛盾（跨决策矛盾 / 与既有代码模式冲突）；**无矛盾时 SHALL 自动标记一致（非阻断，无用户提示，不计入停顿）**
- **L5 边界**: 构造 ≥1 边界场景，逐条列出 + 建议
- 等待用户对该批确认（L4 无矛盾时该批仅呈现 L5）
- ✅ 已确认 → decision 完成

**门规则**：
- 追问 SHALL 至多 **2 个批量确认轮次**（L1-L3、L4-L5）；每轮内逐条列出待确认项
- **最低深度 L3**: L1+L2+L3 全部确认后 decision 方可标记完成；用户明确“够了”时可提前结束
- L4 无矛盾时 SHALL 自动直通，不作为额外停顿
- 跳过的层级 SHALL 记入 Pending（MUST NOT 静默丢弃）

#### 1.3.5 制品同步

把 grill-with-docs 的产出实时同步到 exploration.md：
- CONTEXT.md 术语 → exploration.md 术语表 段
- ADR → exploration.md 架构决策 段
- 边界场景 → exploration.md 边界场景 段

`;

const DEEP_ANALYSIS_FULL = `### 1.4 关键词检测与分析

在 grill-with-docs 追问之前或期间**扫描用户输入中的关键词**。

#### 关键词检测规则

**Layer 1: 类目关键词**（触发分析类目）

| 类目 | 关键词 |
|----------|----------|
| Security | security, authentication, auth, login, password, token, session, vulnerability, xss, sql injection, csrf, sanitization, validation, sanitize, escape |
| Architecture | architecture, refactor, restructure, migrate, move, rename, extract, merge, split, component, module, service, api, endpoint, route, call chain, dependency, integration |
| Business | business, workflow, process, flow, state, transition, rule, logic, validation, trigger, event, handler, step, procedure |
| Impact | impact, change, modify, update, delete, remove, add, replace, rename, signature, parameter, return type, breaking |

**Layer 2: 子类目关键词**（细化分析类型）

| 子类目 | 关键词 |
|--------------|----------|
| Security.InputValidation | input, validate, sanitize, escape, user input, form, request, parameter |
| Security.Authentication | login, signin, authenticate, password, token, jwt, oauth, session |
| Security.DataFlow | data flow, track, trace, source, sink, propagate, tainted |
| Architecture.CallChain | call chain, caller, callee, invocation, dependency, reference, import |
| Architecture.DataFlow | data flow, model, entity, dto, vo, database, query, dao, mapper |
| Architecture.API | api, endpoint, route, handler, controller, request, response |
| Business.StateTransition | state, transition, status, change, trigger, event, condition |
| Business.Validation | validate, rule, check, constraint, requirement, condition |

**Layer 3: 上下文修饰关键词**（调整分析范围）

| 修饰符 | 关键词 |
|----------|----------|
| Scope.Modify | modify, update, change, edit, refactor, enhance |
| Scope.Add | add, create, new, introduce, implement |
| Scope.Remove | remove, delete, drop, deprecate |
| Depth.Deep | deep, comprehensive, thorough, full, complete |
| Depth.Targeted | targeted, specific, particular, focused |

#### 检测逻辑

\`\`\`
1. Exact match priority: Check exact keyword match first
2. Substring match: If no exact match, check substring presence
3. Case-insensitive: Match regardless of case
4. Multi-category: Allow multiple categories detected simultaneously
\`\`\`

#### 分析自动执行

**检测到单个或多个类目**：
> "检测到 [Security/Architecture/Business] 关键词，自动运行相应分析。"

**检测到修饰词**：
> "检测到 [Modify] 范围与 [Deep] 深度，自动运行深度分析。"

关键词一经检测即直接执行分析 —— 不得向用户提供运行/跳过选项。推荐选项（"全部运行"）即默认行为。

#### 分析执行

**安全分析（Semgrep）**：
Semgrep MCP 为可选增强：不可用时该分析跳过并记录，不阻塞工作流。

\`\`\`bash
# Use MCP tool for security scanning
mcp__plugin_semgrep_semgrep__semgrep_scan --code-files <paths>

# Or for findings from platform:
mcp__plugin_semgrep_semgrep__semgrep_findings --repos <repo> --issue-type ISSUE_TYPE_SAST
\`\`\`

**架构分析（CodeGraph）**:
\`\`\`bash
# Use symbols from 1.2.1 base scan results (already searched)
# Find callers/callees for deeper understanding
mcp__codegraph__codegraph_callers --symbol <symbol>
mcp__codegraph__codegraph_callees --symbol <symbol>

# Build context after questioning (task description now clearer)
mcp__codegraph__codegraph_context --task <description>
\`\`\`

**业务分析（CodeGraph）**:
\`\`\`bash
# Use symbols from 1.2.1 base scan results (already searched)
# Build context from task description (after questioning, now clearer)
mcp__codegraph__codegraph_context --task <business-flow>

# Deep exploration of business logic
mcp__codegraph__codegraph_explore --query <topic>
\`\`\`

#### 分析结果写入探索文件

在 Background 之后加入 Analysis 段：

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

#### Pending 段增强

加入按类型归类的子段，供 Phase 2 关注：

\`\`\`markdown
## Pending

### For Phase 2 Impact Analysis
- <Symbol name> (<File location>) - Priority: HIGH

### Security Concerns
- <Vulnerability type>: <Affected area> - Fix: <Approach>

### Business Validation
- <Validation question>: <Context>
\`\`\`

#### 分析驱动的跟进问题（NEW）

**分析完成后**，自动生成跟进问题：

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

**问题优先级逻辑**：
- **HIGH 优先级**：自动提问（安全 CRITICAL、架构破坏性变更、业务决策）
- **MEDIUM/LOW 优先级**：仅在用户要求时提问："展示全部跟进问题"

**深度优先追问**：
- 从发现的漏洞 → 追问相关安全领域
- 从破坏性变更 → 追问迁移策略与弃用时间线
- 从决策点 → 追问边界场景与错误处理

**示例**：
\`\`\`
After Security analysis finds XSS vulnerability:

AI: "Security analysis found XSS vulnerability in sanitizeInput() at user-utils.ts:45.
    How should we fix it?
    My recommendation: Use DOMPurify for HTML sanitization in this area.

    [Depth-first]
    Should we also check other sanitization points in the authentication flow?
    My recommendation: Yes - review all input validation in auth module."
\`\`\`

### 1.4.5 实现深潜分析（NEW）

**触发**：分层触发机制检测到 Scope.Modify、Scope.Add + 触及既有代码，或 Depth.Deep 关键词时。

**目的**：超越表层分析（"谁调用谁"），在动手改动前理解代码**为什么**这样设计。

**分析维度**：

| 维度 | 主要来源 | 备用来源 |
|-----------|---------------|---------------|
| 设计理由 | 代码注释、JavaDoc/docstring | ADR 文档、README、设计文档 |
| 约束 | package.json engines、tsconfig、linter 配置 | .browserslistrc、CI 配置 |
| 权衡取舍 | TODO/FIXME/HACK 注释 | 代码评审记录、基准测试 |
| 模式使用 | 类/接口结构、命名约定 | 设计模式库匹配 |
| 历史背景 | \`git log --follow\`、\`git blame\` | CHANGELOG.md、版本标签 |
| 隐含假设 | 类型守卫、默认值、缺失的空值检查 | 环境变量依赖、魔法数字 |

**范围控制**（按触发级别）：

| 触发级别 | 维度 | 符号上限 |
|--------------|------------|-------------|
| 🔴 自动（Scope.Modify） | 全部 6 个维度 | 10 个核心符号 |
| 🟡 提示（Scope.Add） | 理由 + 约束 + 假设 | 10 个核心符号 |
| 🟢 手动（Depth.Deep） | 用户选定 | 10 个核心符号 |

**置信度标记**：
- \`HIGH\`：见于代码注释、ADR 或设计文档 —— 有明确记载
- \`MEDIUM\`：由 git 历史、命名模式或结构分析推断
- \`LOW\`：AI 从代码模式推断 —— MUST 生成跟进问题请用户确认

**与 Grill-With-Docs 的集成**：
- LOW 置信度的发现 → 自动生成跟进问题
- 隐含假设 → 一律生成确认问题
- 权衡取舍 → 询问在当前需求下是否仍成立

**产出**：把发现写入 exploration.md 的 \`## Implementation Deep-Dive\` 段。
无发现的子段标记 \`<!-- No findings -->\`。
整段为条件显示 —— 仅在触发深度分析时显示。

`;



const EXPLORATION_GUIDANCE = `> 探索指南（派生自上游 OpenSpec \`openspec-explore\`，供探索阶段参考；iagent 专有门控见主 SKILL.md）

## 立场

- **好奇，而非规定** —— 提问应自然浮现，不照脚本走
- **展开线索，而非审问** —— 浮现多个有意思的方向，让用户跟随有共鸣的那个。不要把它们挤进单一路径的问题串。
- **可视化** —— 有助于厘清思路时，多加使用 ASCII 图
- **自适应** —— 跟随有意思的线索，新信息出现时及时转向
- **耐心** —— 不急于下结论，让问题的轮廓自然浮现
- **落地** —— 相关时就去探查真实代码库，不要只做空想

---

## 可以做的事

视用户带来的内容而定，你可能：

**探索问题空间**
- 顺着用户所说，提出澄清性问题
- 挑战假设
- 重新表述问题
- 寻找类比

**调研代码库**
- 运行 CodeGraph 基础扫描（codegraph_files + codegraph_search）以理解项目结构
- 先按能力探测顺序确认可用性（MCP 具名工具 → codegraph_explore 时效横幅 → CLI status --json，任一成功即可用；见 delegated 模式的探测段）；三通道全部不可用才用 Glob/Grep 降级（最后手段）
- 梳理与讨论相关的既有架构
- 寻找集成点
- 识别已在使用的模式
- 揭示隐藏的复杂度
- Grep/Glob 是最后手段，**只有**在能力探测三通道全部失败后才使用
- **考虑保存发现**：扫描之后，可提议把结果保存到 \`openspec/explorations/\`，供后续工作流使用

**理解设计理由（深度分析）**
修改既有代码时，要超越表层分析：

| 维度 | 主要来源 | 备用来源 |
|-----------|---------------|---------------|
| 设计理由 | 代码注释、JavaDoc/docstring | ADR 文档、README、设计文档 |
| 约束 | package.json engines、tsconfig、linter 配置 | .browserslistrc、CI 配置 |
| 权衡取舍 | TODO/FIXME/HACK 注释 | 代码评审记录、基准测试 |
| 模式使用 | 类/接口结构、命名约定 | 设计模式库匹配 |
| 历史背景 | \`git log --follow\`、\`git blame\` | CHANGELOG.md、版本标签 |
| 隐含假设 | 类型守卫、默认值、缺失的空值检查 | 环境变量依赖、魔法数字 |

- **置信度标记**：HIGH（有明确记载）、MEDIUM（由 git / 模式推断）、LOW（AI 推断 —— MUST 确认）
- 把 LOW 置信度的发现标上 ⚠ 并生成跟进问题

**比较方案**
- 头脑风暴多种方案
- 构建对比表
- 勾画取舍
- 推荐一条路径（被要求时）

**可视化**
\`\`\`
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
\`\`\`

**揭示风险与未知**
- 识别可能出问题的地方
- 找出理解上的缺口
- 建议做技术预研或调查

## OpenSpec 感知

你完整掌握 OpenSpec 体系。自然使用它，不要硬套。

### 检查上下文

开始时，快速查看现有什么：
\`\`\`bash
iagent spec status --json
\`\`\`

### 检查历史（能力级探索记忆文件）

探索某个能力时，读取能力级探索记忆文件获取历史上下文（唯一通道，跨变更索引已退役）：
- 用 Glob 定位 \`openspec/specs/<capability>/explorations.md\`
- 文件存在 → 读取其中既往决策 / 术语 / 边界场景；标为 \`已过时（由 <change-name> 取代）\` 的段落仅作历史参考
- 文件缺失 → 记录「无能力级探索记忆 — 全新探索」，按常规探索继续（MUST NOT 因此阻塞）
- 把找到的历史决策 / 术语注入探索上下文

这能告诉你：
- 是否有活跃变更
- 它们的名称、schema 与状态
- 用户可能正在做的事

用户提到具体变更名时，读取其制品作为上下文。

### 无变更时

自由思考。当认识逐渐清晰时，你可以提议：

- "这听起来已经足够扎实，可以开始一个变更了。要我创建提案吗？"
- 或继续探索 —— 不必急于形式化

### 有变更时

用户提到某个变更，或你发现某个变更相关时：

1. **定位并读取既有制品作为上下文**
   - 运行 \`iagent spec status --change "<name>" --json\`。
   - 使用状态 JSON 中的 \`changeRoot\`、\`artifactPaths\` 与 \`actionContext\`。
   - 从 \`artifactPaths.<artifact>.existingOutputPaths\` 读取既有文件。

2. **在对话中自然地引用它们**
   - "你的设计里提到用 Redis，但我们刚意识到 SQLite 更合适……"
   - "提案把范围限定在付费用户，但我们现在想覆盖所有人……"

3. **在决策形成时提议落地**

    | 洞察类型                   | 落地位置                           |
    |----------------------------|------------------------------------|
    | 发现新需求                 | \`specs/<capability>/spec.md\`      |
    | 需求变更                   | \`specs/<capability>/spec.md\`      |
    | 形成设计决策               | \`design.md\` 的 Decisions 段        |
    | 范围变更                   | \`proposal.md\` 的 What Changes 段   |
    | 识别出新工作               | \`tasks.md\`                        |
    | 假设被推翻                 | 相关制品                           |

   示例提议：
   - "这是一个设计决策。记到 \`design.md\` 的 Decisions 段？"
   - "这是一条新需求。加到 specs 里？"
   - "这改变了范围。更新提案？"

4. **由用户决定** —— 提议后就此打住。不要施压。不要自动落地。

---

## 不必做的事

- 照脚本走
- 每次问同样的问题
- 产出某个指定制品
- 得出结论
- 有价值的岔路出现时仍死守原题
- 保持简短（这是思考时间）

---

## 处理不同入口形态

**用户带来一个模糊想法：**
\`\`\`
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
\`\`\`

**用户带来一个具体问题：**
\`\`\`
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
\`\`\`

**用户卡在实现中途：**
\`\`\`
User: /iagent:spec-explore add-auth-system
      The OAuth integration is more complex than expected

You: [reads change artifacts]

     You're on task 4: "Implement OAuth flow"

     Let me trace what's involved...

     [draws diagram, explores options, suggests paths]

     Want to update the design to reflect this?
     Or add a spike task to investigate?
\`\`\`

**用户想比较方案：**
\`\`\`
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
\`\`\`

---

## 结束探索

没有强制的收尾方式。探索可能：

- **流入提案**："可以开始了吗？我来创建一个变更提案。"
- **落到制品更新**："已把这些决策更新到 \`design.md\` 的 Decisions 段"
- **只提供清晰度**：用户拿到了所需的答案，继续往前走
- **以后再继续**："随时都可以接着聊"

当感觉一切正在凝练时，你可以做个小结：

\`\`\`
## What We Figured Out

**The problem**: [crystallized understanding]

**The approach**: [if one emerged]

**Open questions**: [if any remain]

**Next steps** (if ready):
- Create a change proposal
- Keep exploring: just keep talking
\`\`\`

但这个小结是可选的。有时思考本身就是价值。
`;

export function getSpecExploreSkillTemplate(): SkillTemplate {
    return {
        name: 'iagent_spec_explore',
        description: '进入探索模式。当用户想要在变更前或变更中思考问题、调研代码库、明确需求时使用；触发词"探索 / explore / 调研 / 思考 / 明确需求"；NOT for 一站式引导全流程（改用 iagent_workflow）或缺陷根因排查（改用 iagent_debug）。',
        allowedTools: `Read, Write, Edit, Glob, Grep, Bash(iagent:*), Bash(git:*), ${CODEGRAPH_CLI}, ${CODEGRAPH_MCP}`,
        type: 'spec',
        instructions: `**适用项目护栏（impl 域蒸馏，见 .iagent/rules/coding-rules.md）。** 未定义项标 **[待确认]**，禁止猜测。

进入探索模式。深度思考。自由可视化。让对话自然流淌。

**重要：探索模式用于思考，而非实现。** 你可以读文件、搜代码、调研代码库，但绝不能写代码或实现功能。用户要求你实现时，提醒其先退出探索模式并创建变更提案。用户要求时你**可以**创建 OpenSpec 制品（proposal、design、specs）—— 那是把思考落下来，不是实现。

**只读操作无需确认即可执行**：读文件、搜代码与分析步骤直接执行 —— 不得停下来请求用户许可去做只读调研。探索中浮现的澄清性问题（需求澄清）不属于只读操作，规则不变。

**这是一种立场，不是工作流。** 没有固定步骤、没有必需顺序、没有强制产出。你是帮助用户探索的思考伙伴。

**Input**: \`/iagent:spec-explore\` 之后的参数就是用户想思考的内容，可以是：
- 模糊想法："实时协作"
- 具体问题："认证系统越来越难维护"
- 变更名："add-dark-mode"（在该变更的上下文中探索）
- 对比："这个场景用 postgres 还是 sqlite"
- 什么都不带（仅进入探索模式）

${GATE_PROTOCOL_PREAMBLE}

${renderGateWhitelistSection()}

---

## 提示词校验门

**Trigger: 输入含糊或多义时激活本门；清晰输入直接进入思考伙伴模式。** 这不是固定流程步骤 —— explore 的立场（无固定步骤、无强制产出）不因本门改变。

**入口形态适配**（对应上面的 Input 形态）：

- 输入为**变更名**时，以该变更的既有制品（proposal / design / specs / tasks）为校验与探讨对象，MUST NOT 把变更名本身当作需求提示词评估清晰度
- **不携带任何输入**时（仅进入探索模式）跳过本门，MUST NOT 要求用户先提供提示词
- 输入为比较型或问题型表述时按需求六维正常判定

${PROMPT_GATE}

> **完整门细则**见 references/prompt-gate.md。**仅在 Gate 实际触发时**（输入不明确、进入 Step 3 优化流程）读取全文细则；清晰输入一句话复述理解后直通，无需读取。

**本技能内的执行要求**：

- 清晰输入：一句话复述理解后直接进入立场模式，不输出六维校验表格、不要求确认
- 含糊输入：先做提示词优化并阻塞等待用户确认或修改；确认前 MUST NOT 进行代码库扫描与需求澄清追问
- 上游已产出经确认的提示词基线时（如被 full-workflow 的 Stage 1 委派调用）**直接通过，不重复校验或再次要求确认**
- 基线落盘：写入探索产物的 \`## 提示词基线\` 段；本技能不设强制产出文件，无探索文件时基线保留在会话中，并在创建或关联探索文件时写入

---

## 探索指南（立场 / 可以做的事 / OpenSpec 感知 / 不必做的事 / 处理不同入口形态 / 结束探索）

> 完整探索指南见 \`references/exploration-guidance.md\`；进入思考伙伴模式前按需 \`Read\`。

---

## 功能流程图

**Trigger: 探索中浮现明确的业务功能流程时产出本制品；纯概念探讨或无业务功能流程时不产出、不阻断。** 这不是固定流程步骤 —— explore 的立场（无固定步骤、无强制产出）不因本制品改变。

${FLOWCHART}

> **完整流程图细则**见 references/flowchart-gate.md。**仅在流程浮现时**（探索中浮现明确的业务功能流程）读取全文细则；纯概念探讨或无流程时直通，无需读取。

**本技能内的执行要求**：

- **条件触发**：探索浮现明确的业务功能流程时（如探索导出功能时梳理出"选择范围 → 点击导出 → 数据量判定 → 分批查询 → 生成文件"的完整链路），产出 \`## 功能流程图\` 段并执行流程最终确认门；确认后的流程图成为 propose / verify 的**流程基准**
- **无流程时直通**：纯概念探讨或无业务功能流程时（如"帮我想想这个模块该怎么分层"），在探索产物中记录「本次无功能流程」后**直接继续**，MUST NOT 因此阻塞、MUST NOT 为凑制品而虚构流程节点
- **拒绝不阻断**：用户在流程最终确认门上拒绝确认或明确不表态时，记录原始流程图与**未确认状态**后继续探索，MUST NOT 反复要求确认、MUST NOT 陷入死锁；该未确认状态随探索产物传递（propose 降级为仅凭 exploration.md 生成、verify 的节点覆盖度维度 SKIP）
- **落盘方式**：本技能不设强制产出文件，无探索文件时流程图保留在会话中，并在创建或关联探索文件时写入

---

## 强制检查点体系（delegated 模式）

**delegated 模式**（编排器传入 \`mode=delegated\`）SHALL 执行强制检查点体系（不可跳过）：调用即强制创建探索文件 → 提示词校验门 → CONTEXT.md 检查 → CodeGraph 基础扫描（含多项目派发与深度分析）→ L1-L5 grill 追问 → 功能流程图与流程最终确认门 → 聚合一致性门 → 探索完成检测。**完整协议见 \`references/exploration-protocol.md\`——执行 delegated 探索前 MUST 先 \`Read\` 该文件并逐步执行。**

（interactive 模式保持立场式，不强制上述序列。）

## 门预算（Gate Budget）

每个阶段至多 **1 个流程级阻塞确认门**：

- **探索阶段**：**功能流程图门**为唯一流程级阻塞门；提示词校验门仅在输入不明确时触发，且其确认 SHALL 与 grill 批量 1 合并为同一轮；grill 追问 SHALL ≤2 批量轮次（L1-L3、L4-L5）；聚合一致性门默认直通（仅硬冲突时暂停，非阻断）
- **提案阶段**：无阻塞门（验证自动执行）
- **实现阶段**：单一「实现 + 测试桥」
- **归档阶段**：归档确认门

## Guardrails

- **不要实现** - 绝不写代码或实现功能。创建 OpenSpec 制品没问题，写应用代码不行。
- **不要假装理解** - 有不清楚的地方就深挖
- **不要急于推进** - 发现阶段是思考时间，不是任务时间
- **不要强求结构** - 让模式自然浮现
- **不要自动捕捉** - 提议保存洞察，不要直接替用户做
- **要可视化** - 一幅好图胜过千言万语
- **要探索代码库** - 让讨论落在现实之上
- **要质疑假设** - 包括用户的，也包括你自己的
- **要理解设计意图** - 修改既有代码之前，分析它**为什么**这样构建 —— 而不只是它做了什么。查看代码注释、git 历史与配置文件，找出约束、权衡与理由。推断结论要标注置信度。
- **写操作确认限定范围且须显式** - 提议保存发现或更新 OpenSpec 制品时，确认范围仅限明确点名的文件。绝不接受一揽子 "全部同意" 式授权。回答设计问题（讨论方案、澄清需求、解释术语）**不构成**写操作的同意 —— 每次写都需独立的同意/拒绝确认。
- **从磁盘重新读取文件** - 用户在会话中可能改过的文件（CONTEXT.md、exploration.md、proposal/design/specs/tasks 等变更制品）每次使用前 MUST 从磁盘重新读取。绝不依赖会话缓存的内容。
- **实质性歧义要表面化** - 影响范围、行为契约、向后兼容或验收标准的歧义 MUST 以 **[待确认]** 问题形式提给用户。非实质性的细节级歧义可用合理假设解决，并把假设一并记录。
- **要执行退出纪律** - 探索结束后 MUST NOT 自动进入 plan 模式 / 提案模式 / 设计模式；仅在用户显式要求时进入下一阶段；explore 的立场是思考伙伴，流程推进由用户驱动
- **子代理扫描要强制共享数据** - 如果探索中派发了 CodeGraph 多项目扫描子代理，子代理扫描指令 MUST 包含退出守卫（完成扫描即停止返回结果，MUST NOT 进入 plan 模式）
- **深入前要校验提示词** - 输入含糊或多义时先过提示词校验门（Step 1-5）：优化后 MUST 等用户确认或修改才继续；清晰输入一句话复述理解后直通（不输出校验表、不要求确认）；变更名输入以该变更既有制品为校验对象；无输入则跳过本门。上游已产出提示词基线时直接通过，不重复确认
- **不要在提示词门上死锁** - 确认门有四条出口（确认 / 修改 / 拒绝后按原理解继续 / 显式授权按推断继续），不得反复要求确认
- **流程浮现时要产出功能流程图** - 探索浮现明确的业务功能流程时产出 \`## 功能流程图\` 段（Mermaid \`flowchart TD\` + 节点清单表）并执行流程最终确认门；节点粒度 = 可独立验证的业务操作单元，每节点 MUST 含证据位置（\`文件:行\` 或类.方法；新建功能标 \`[新建]\` + 预期产物），无法追溯证据的节点 MUST NOT 进入清单
- **不要强求流程图** - 纯概念探讨或无业务功能流程时记录「本次无功能流程」后直接继续，不为凑制品虚构节点、不阻断探索；"无固定步骤、无强制产出"的定位不变
- **不要在流程最终确认门上死锁** - 流程最终确认门同样有四条出口（确认 / 修改 / 拒绝后按原理解继续 / 显式授权按推断继续）；用户拒绝时记录未确认状态后继续，不得反复要求确认`,
        license: 'MIT',
        compatibility: '依赖 iagent CLI（spec 命令组）与 CodeGraph MCP（不可用时回退 Glob/Grep）。',
        metadata: { author: 'mi-agent-tools', version: '1.0' },
        references: [
            { path: 'references/prompt-gate.md', content: PROMPT_GATE_FULL },
            { path: 'references/flowchart-gate.md', content: FLOWCHART_FULL },
            {
                path: 'references/exploration-protocol.md',
                content: EXPLORATION_PROTOCOL_FULL,
            },
            { path: 'references/exploration-guidance.md', content: EXPLORATION_GUIDANCE },
            { path: 'references/multi-project-scan.md', content: MULTI_PROJECT_SCAN_FULL },
            { path: 'references/grill-playbook.md', content: GRILL_PLAYBOOK_FULL },
            { path: 'references/deep-analysis.md', content: DEEP_ANALYSIS_FULL },
        ],
    };
}

export function getSpecExploreCommandTemplate(): CommandTemplate {
    return {
        name: 'iAgent: 探索',
        description: '进入探索模式 —— 思考问题、调研代码库、明确需求',
        category: 'iAgent / 规格',
        tags: ['iagent', 'spec', 'explore', 'codegraph'],
        content: deriveCommandContent(getSpecExploreSkillTemplate().instructions),
    };
}
