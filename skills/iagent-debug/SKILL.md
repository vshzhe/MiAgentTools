---
name: iagent-debug
description: "一站式调试工作流：复现→用 CodeGraph 与能力记忆调查根因→变更关联→带强制回归测试的修复→编译检查→同步提案→验证；触发词\"调试 / debug / 修复 bug / bug 报告 / 复现 / 根因\"；NOT for：新功能开发用 iagent_workflow、单一阶段探索用 iagent_spec_explore"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(iagent:*), Bash(npm:*), Bash(pnpm:*), Bash(node:*), Bash(git:*), Bash(tsc:*), Bash(mvn:*), Bash(gradle:*), Bash(go:*), Bash(cargo:*), mcp__codegraph, mcp__codegraph__codegraph_status, mcp__codegraph__codegraph_files, mcp__codegraph__codegraph_search, mcp__codegraph__codegraph_context, mcp__codegraph__codegraph_node, mcp__codegraph__codegraph_callers, mcp__codegraph__codegraph_callees, mcp__codegraph__codegraph_impact, mcp__codegraph__codegraph_explore, Skill(spec_verify_proposal), Skill(proposal_review)
license: MIT
compatibility: 依赖 iagent CLI（spec 命令组）与 iagent_spec_verify_proposal / iagent_proposal_review 技能；CodeGraph MCP 可选（不可用时降级 Glob/Grep）。
metadata:
  author: mi-agent-tools
  type: impl
  generatedBy: "snapshot"
  generatedFingerprint: "sha256:3aa6638c6011ba8ff50be5884b7d6061d1d700fc99d177b977491bb91e5ac74a"
---


**适用 openspec/rules/ai-coding.md 全域护栏。** 未定义项标 **[待确认]**，禁止猜测。

从复现到提案同步的一站式调试工作流。

本工作流引导你依次完成：
1. **复现阶段** —— 以失败测试或显式复现步骤作为验收判据
2. **排查阶段** —— 能力记忆注入 + CodeGraph 根因分析 + 排查深度分级（2.2.3.5：按影响半径 / 跨模块 / 根因清晰度选轻量或深度路径）+ grill-with-docs 纪律
3. **关联变更判定阶段** —— 判定 bug 归属哪个变更（进行中 / 新建修复变更 / 已归档来源 / 非缺陷）
4. **修复阶段** —— 实现修复并附强制回归测试
5. **调试循环** —— 每次修复后询问用户是否还有相关 bug；有则重复 P1-P4，没有则进入统一的 P5-P7
6. **编译检查阶段** —— 复用 iagent_spec_apply 技能的编译检查约定（覆盖所有循环修复）
7. **同步阶段** —— 更新变更制品并持久化所有根因分析（覆盖所有循环修复）
8. **验证阶段** —— 失败时自动修复循环；通过后先深度复查再收束（需求文档由 ARCHIVE 阶段生成，绝不在此处）（覆盖所有循环修复）

## ⛔ GATE PROTOCOL — ACTIVE

本技能包含以 **⛔ GATE:** 标记的**确认门**。每个门都是硬性停止点：
- 走到 ⛔ GATE 时，**本次响应到此结束** —— 输出门内容后立即停止
- 不得执行、描述或预生成门之后的任何步骤
- 用户的下一则消息即为确认信号 —— 仅在其响应后从门之后继续
- **违规**：未经用户确认而执行门之后的步骤，是破坏工作流的严重错误

---
## Startup

**Input**: 命令后的参数为 bug 描述（症状、错误信息或失败行为）。

- 提供了描述时，记录之并进入 Phase 1
- 未提供描述时，提示用户：「请描述该 bug：症状、错误信息，以及（如已知）复现步骤」—— 收到描述后才开始

### 0. 提示词校验门（缺陷五维，强制）

**⚠️ 强制: 本门在 Phase 1 强制复现之前执行，不得跳过。**

**执行前置**：用户最初未提供 bug 描述、由本技能提示后补充的，以补充内容为原始提示词执行本门；**MUST NOT 对空输入执行校验**。

**提示词校验门**: 探索前强制自检用户输入，维度为 症状 Symptom / 复现步骤 Repro / 期望 vs 实际 Expected vs Actual / 环境 Environment / 歧义 Ambiguity。
- **清晰**（症状 Symptom / 复现步骤 Repro / 期望 vs 实际 Expected vs Actual / 歧义 Ambiguity 均无 `❌` 与实质 `⚠️`）→ 一句话复述理解后直通，不输出校验表、不要求确认
- **不明确**（任一维 `❌` 或实质 `⚠️`）→ 先做提示词优化，输出 `【优化后提示词】`（推断项标 `[推断]`、未知项标 `[待确认]`）与 `【优化说明】`，**⛔ GATE: 立即结束本次响应并等待用户确认或修改**（本次响应到此结束，收到用户响应后继续；出口：确认 / 修改 / 拒绝 / 显式授权按推断），**不得陷入等待死循环**
- **软不明确**（仅细节级歧义）→ 记 `[假设]` 继续
- 优化**不篡改原始意图**、不增加用户未提出的需求
- 校验结论与基线写入探索产物 `## 提示词基线` 段，作为下游唯一语义来源
- 空输入不校验；输入为变更名时以该变更既有制品为校验对象；上游已产出基线时直接通过

> **完整门细则**见 references/prompt-gate.md。**仅在 Gate 实际触发时**读取全文细则。

**本技能内的执行要求**：

**本技能内的执行要求**：

- 门的位置固定在此处：记录 bug 描述之后、TodoWrite 初始化与 Phase 1 复现之前
- 缺陷版的「复现步骤」维与 Phase 1 的复现要求直接衔接：维度判定出的期望与实际在 Phase 1 成为复现的验收判据
- 不明确分支的确认门是**澄清门（确认 WHAT）**：用户确认或修改前 MUST NOT 进入 Phase 1，**MUST NOT 凭猜测编写失败测试**
- 校验结论（原始提示词 + 确认后的提示词基线）写入诊断记录的 `## 提示词基线` 段（Phase 6 随根因分析一并持久化到变更 exploration.md）

使用 **TodoWrite 工具**初始化跟踪：
```
[{"content": "Bug #1: Phase 1 复现", "status": "in_progress"},
 {"content": "Bug #1: Phase 2 排查定位", "status": "pending"},
 {"content": "Bug #1: Phase 3 关联变更判定", "status": "pending"},
 {"content": "Bug #1: Phase 4 修复 + 回归测试", "status": "pending"},
 {"content": "Phase 5: 编译检查 (汇总所有修复)", "status": "pending"},
 {"content": "Phase 6: 同步提案 (汇总所有修复)", "status": "pending"},
 {"content": "Phase 7: 验证 (覆盖所有修复)", "status": "pending"}]
```

**动态 bug 跟踪**：调试循环继续到新 bug 时，向 TodoWrite 列表追加该 bug 的 P1-P4 阶段条目。每个 bug 的各阶段完成时标记为完成。例如：
```
[{"content": "Bug #1: Phase 1 复现", "status": "completed"},
 {"content": "Bug #1: Phase 2 排查定位", "status": "completed"},
 {"content": "Bug #1: Phase 3 关联变更判定", "status": "completed"},
 {"content": "Bug #1: Phase 4 修复 + 回归测试", "status": "completed"},
 {"content": "Bug #2: Phase 1 复现", "status": "in_progress"},
 {"content": "Bug #2: Phase 2 排查定位", "status": "pending"},
 ...]
```

---
## Phase 1: 复现

**⚠️ 强制: 在修改任何代码之前必须复现该 bug。**

复现是修复的验收判据 —— 不得跳过。

### 1.1 经失败测试复现（首选）

- 定位或编写一个能演示该 bug 的测试
- 运行该测试并确认其因所报原因 FAIL（而非无关的环境搭建错误）
- 记录：测试文件路径、测试名、期望与实际结果

### 1.2 经显式步骤复现

当 bug 无法用自动化测试捕获时（例如环境相关行为、时序、仅 UI）：

- 记录显式复现步骤：编号步骤、输入、期望结果、实际结果
- 向用户呈现该步骤并确认其与观察到的行为一致
- 复现确认之前不应用任何修复

**强制检查点**：
- 无法建立复现时，向用户报告并说明已尝试的动作 —— MUST NOT 在假设下修复一个不可复现的 bug（零猜测原则）
- 所报行为完全无法触发时，进入 Phase 2 排查其是否属于非缺陷（预期行为）

将复现证据更新到诊断记录（工作笔记中的草稿段，Phase 6 再持久化）。

---
## Phase 2: 排查定位

**⚠️ 强制: 排查期间注入能力记忆并应用 grill-with-docs 纪律。**

### 2.1 能力探索记忆注入

1. 由受影响代码与 bug 描述推断 bug 所属的能力（模块）
   - 用 Glob 工具扫描 `openspec/specs/` 下的目录名并与受影响区域匹配
2. 对每个涉及的能力 `<capability>`，检查 `openspec/specs/<capability>/explorations.md` 是否存在（用 `path.join()`）
3. 若存在：读取并将历史 Decisions、术语与边界场景注入排查上下文
   - 标记为 `已过时（由 <change-name> 取代）` 的段落**仅**作历史参考 —— 取代它的变更的决策才是当前有效
   - 历史边界场景常是根因线索：bug 可能是被有意接受的已知边界情形
4. 无记忆文件时：记录「无能力级探索记忆 — 全新排查」并继续

#### 2.1.5 流程级探查摘要（investigation-digest）

**⚠️ 强制: 本步在 2.1 能力记忆注入之后、2.2 CodeGraph 排查之前执行。**

**载体**：`.openspec-tmp/debug-<keyword>/investigation-digest.md` —— 以 `path.join()` 构造（跨平台）。

**`<keyword>` 规则**：为该次调试主题的 **kebab-case 关键词**，与 `openspec/explorations/<keyword>-explore-<sequence>.md` 的关键词**同源同规则**（小写、连字符分隔、剔除非法字符，上限 50 字符）；**MUST NOT 直接使用 bug 描述原文**（避免空格与非法字符导致路径不可用）。

**三分支（先做存在性判定，再决定查询与写入策略）**：

1. **摘要存在** → **先读摘要**，复用其中**命中范围**的结论，**仅在摘要未覆盖的范围执行查询**（增量查询）；MUST NOT 重跑已覆盖区域
2. **摘要不存在** → 初始化空摘要，按常规流程执行 2.2.1–2.2.3，并在每步完成后**逐步骤增量写入**结论
3. **工作区不可写（落盘失败）** → 降级为「仅会话内复用」+ WARN（记录失败原因与目标路径）；排查与修复流程 **MUST NOT 被阻断**

**非交付物划界（强制）**：摘要**仅为流程内缓存**，MUST NOT 替代诊断记录，MUST NOT 替代 Phase 6 对变更 `exploration.md` 的持久化；清理摘要 MUST NOT 影响任何交付物。

**失效规则**：某 bug 的修复改动了代码后，摘要中**受影响范围**的结论 SHALL 标记为失效，标记格式逐字如下：

> 已失效（由 <bug 标识> 修复改动代码）

并在**下次进入 Phase 2 时重新查询**该范围；MUST NOT 复用已失效结论。

> **排查细则下沉**：CodeGraph 分层排查协议与 2.2.3.5 排查深度分级见 `references/investigation-protocol.md`；执行 2.2 前 MUST 先 `Read` 该文件。

### 2.3 排查期间的 grill-with-docs 纪律

在收敛根因时应用完整纪律：

- **一次一个问题**：需要用户输入时，只问一个问题并等待
- **术语收敛**：排查中每确定一个术语，立即（不延后）写入 `openspec/CONTEXT.md`。格式：`**<Term>**: <definition>
_Avoid_: <synonyms>`
- **实时更新记录**：每次问答交换后都更新诊断记录（根因假设、证据、边界场景）—— 不得在末尾批量补写

### 2.4 根因确认门（零猜测原则）

- **单一高置信根因**：附代码证据（调用链、受影响符号、复现关联）呈现，获得用户确认后进入 Phase 3
- **多个候选或置信不足**：STOP。呈现候选清单及每个候选的证据与你的建议。用户选定候选之前不修改任何代码
- **排查结论为非缺陷**：所报行为为预期 —— 转入非缺陷分支（Phase 3.5）

### 2.5 缺陷链路图与流程最终确认门（强制检查点）

**⚠️ 强制: 根因确认门（2.4）通过后必须强制产出缺陷链路图，并经流程最终确认门确认后才进入 Phase 3。**

触发点：2.4 根因确认门通过（单一高置信根因）之后、Phase 3 关联变更判定之前——异常与根因节点须待根因确认后方可知，故本步骤不得前移。经确认的缺陷链路是 Phase 3 / Phase 4 的**验证口径来源**。

**功能流程图**: 把探索发现的业务功能流程固化为探索产物 `## 功能流程图` 段（Mermaid `flowchart TD` + 关键操作节点清单表）。
- **节点粒度** = 可独立验证的业务操作单元（用户操作 / 业务判定 / 数据写入 / 外部调用）；节点标识在图中与表中 MUST 一致，多流程时全局唯一递增
- **清单列集**：节点 / 操作 / 证据位置 / 标记
- **证据追溯（硬约束）**：每节点 MUST 填 `文件:行` 或 类.方法；新建功能标 `[新建]` + 预期产物；无法追溯证据的节点 MUST NOT 进入清单
- **⛔ GATE: 流程最终确认门（强制停止）**：呈现流程图与清单并立即结束本次响应，等待确认；出口：确认 / 修改 / 拒绝（记未确认状态，提案降级 + 验证该维度 SKIP）/ 显式授权按推断（推断节点标 `[推断]`）——不得陷入等待死锁
- **回改规则**：发现遗漏节点 MUST 回探索更新并重新确认，MUST NOT 在任务清单静默补节点
- 节点数超 50 时按子流程分节；本块 MUST NOT 含任何 Bash 命令示例

> **完整流程图细则**见 references/flowchart-gate.md。**仅在流程浮现时**读取全文细则。

**本技能内的执行要求**：

- **节点范围只覆盖缺陷链路**：前置条件 → 触发 → 异常 → 根因；**MUST NOT 展开被测功能的完整业务流程**（区别于需求版的全流程覆盖，避免与 Phase 1 复现步骤重复）
- **标记**：异常现象节点 MUST 标 `🔴异常`、根因节点 MUST 标 `🟠根因`，其余节点以 "—" 占位
- **证据追溯**：每节点 MUST 填证据位置（`文件:行` 或 类.方法）；无法追溯证据的节点 MUST NOT 进入清单
- **落盘位置**：诊断记录新增的 `## 功能流程（缺陷链路）` 段，Phase 6 随根因分析一并持久化到变更 exploration.md
- **与分级解耦**：2.2.3.5 的排查深度分级结果 MUST NOT 影响本步产出 —— **轻量路径（路径 A）同样强制产出**缺陷链路图并经本门确认；分级只决定 2.2.4 是否执行，不决定是否产出缺陷链路（轻量 ≠ 不验证）
- **四出口确认门**：呈现缺陷链路图与节点清单后停止等待确认，出口四条（确认 / 修改 / 拒绝后记录未确认状态并按原理解继续 / 显式授权按推断继续），**MUST NOT 反复要求确认或陷入等待死锁**
- **验证口径**：修复方案与回归测试 MUST 覆盖该链路的「异常节点 + 根因节点」（见 4.1 / 4.2）；仅覆盖触发节点而未覆盖根因节点时，验证不通过

---
## Phase 3: 关联变更判定

在修复之前先判定 bug 归属哪个变更。

### 3.1 bug 来自进行中的变更

- 受影响代码属于 `openspec/changes/` 下的某个变更（未归档）
- → 修复更新**该**变更；Phase 4–7 针对它运作

### 3.2 独立 bug（无归属变更）

- 该 bug 不属于任何进行中的变更
- → **自动创建，不询问用户**：立即执行 `iagent spec new "fix-<module>-<topic>"`（从受影响代码路径推导 module，用 kebab-case）—— MUST NOT 提示「是否新建变更？」或等待确认
- 修复在新变更下进行

### 3.3 bug 来自已归档变更

- 受影响代码属于 `openspec/changes/archive/` 下的某个变更
- → **绝不可修改已归档目录** —— 归档是历史事实
- 新建变更并在新变更的 proposal 中引用原归档变更名，以保持可追溯

### 3.5 非缺陷退出（诊断报告收尾）

当 Phase 2 结论为行为符合预期时：

- 输出诊断报告：症状、排查路径、证明行为符合预期的代码/测试证据
- MUST NOT 新建变更，MUST NOT 修改代码
- 持久化诊断记录并告知用户结论 —— 工作流到此结束

---
## Phase 4: 修复

按 iagent_spec_apply 技能的任务执行规范实现修复。

### 4.1 修复实现

- 遵循 `openspec/rules/ai-coding.md`（零猜测原则、最小改动、分层）
- 保持改动外科手术般精准：每一行改动都必须能追溯到根因
- 修复涉及数据库/schema 变更时，单独输出 DDL 并在应用前请求显式确认（依护栏）
- 实现中暴露设计问题时，暂停并建议更新变更制品，而非静默偏离
- **验证口径（2.5）**：修复方案 MUST 覆盖该缺陷链路的**「异常节点 + 根因节点」**；仅覆盖触发节点而未覆盖根因节点时，视为修复未完成

### 4.2 强制回归测试

- 新增（或确认 Phase 1 的测试即为）一个回归测试，其：
  - 修复前 FAIL
  - 修复后 PASS
- 若变更的 `tasks.md` 尚未列出对应任务则补上（回归测试任务用 `[测试]` 标签并带级别/优先级，如 `[测试][单元][P0]`）；保留 `Spec Ref`/`Scenario Ref`
- 运行 Phase 1 的复现并确认其现已通过
- **回归测试验证口径（2.5）**：回归测试 MUST 覆盖该缺陷链路的**「异常节点 + 根因节点」**；仅覆盖触发节点而未覆盖根因节点时，验证不通过

**编写动作（内联实现，不再委派）**

回归测试 MUST 由 debug 工作流**直接内联实现**，MUST NOT 委派 `iagent_test` 或任何其他技能：

- **框架检测**：从项目构建文件检测测试框架（`pom.xml` → JUnit 4/5 + Mockito；`build.gradle` → JUnit 4/5 + Mockito；`package.json` → Vitest / Jest / Mocha），对齐既有测试风格（注解、断言、命名约定）——不另立新风格
- **覆盖口径**（2.5 产出）：回归测试 MUST 覆盖缺陷链路的「异常节点 + 根因节点」——仅覆盖触发节点而未覆盖根因节点时，验证不通过
- **BCDE 边界**：Boundary（极值、空集合）、Condition（null、缺失字段）、Default（默认值、未设置枚举）、Error（非法输入、异常抛出）
- **反模式防护**：禁止无断言的永真测试、禁止 Thread.sleep() 等时序依赖、禁止测试间执行顺序依赖、外部依赖（DB/HTTP/文件 IO）MUST mock
- **结构**：一个生产类对应一个测试类（`<ClassName>Test` Java / `<className>.test.<ext>` Node），每个测试方法覆盖一个逻辑场景，Arrange-Act-Assert 三段式
- 委派动机（框架复用、风格对齐、BCDE、反模式）现由**内联规则直接覆盖**，无需经外部技能中转——避免委派链路断裂导致流程丢失

### 4.3 调试循环确认

每次修复完成后询问用户：

> "还有相关 bug 需要修复吗？"
> [有 - 继续修复下一个] [没有 - 进入收尾阶段]

**若用户回答「有」**：
- 在 TodoWrite 中将当前 bug 记为已完成
- 请用户描述下一个 bug
- 对新 bug 重新进入 Phase 1（独立复现、排查与修复）
- **回边复用（重入 Phase 2）**: 进入 Phase 2 时先读摘要（**先读摘要**，见 2.1.5），仅做**增量查询**（**仅增量查询**），MUST NOT 重跑已覆盖区域
- 更新 TodoWrite：为新 bug 的 P1-P4 阶段追加新的 Bug #N 条目

**后续 bug 的 P3 简化**：
- 默认：新 bug 在同一变更下修复（首个 bug Phase 3 确定的当前变更）
- 将默认关联呈现给用户确认
- 若用户声明该 bug 应为独立变更：
  - 收尾当前变更（对累积的修复进入 Phase 5-7）
  - 告知用户：「请用 `/iagent:debug` 单独处理这个独立 bug」
  - MUST NOT 自动新建变更

**循环中的非缺陷**：若 Phase 2 结论为循环中某 bug 属非缺陷（预期行为）：
- 走非缺陷退出路径（输出诊断报告，不改代码，不新建变更）
- 继续循环：询问「还有相关 bug 需要修复吗？」—— 非缺陷 bug MUST NOT 阻塞其他 bug

**中途退出**：若用户在后续 bug 的任一阶段（P1-P4）想退出循环：
- 丢弃未完成的当前 bug 的工作
- 保留此前所有已完成的修复
- 对累积的修复直接进入 Phase 5-7

**长循环提示**：循环达到 5 次或以上时，提示用户：
> "已连续修复 5 个 bug。建议检查是否应拆分为独立 change。"
- MUST NOT 强制终止 —— 是否继续由用户决定

**若用户回答「没有」**：
- 进入 Phase 5 —— 所有累积修复将被统一的编译检查、同步与验证覆盖

---
## Phase 5: 编译检查 — 汇总所有修复

遵循 iagent_spec_apply 技能的编译检查约定（Step 8）。本阶段只运行**一次**，覆盖循环中修复的**所有** bug。

### 5.1 加载配置

- 读取 `openspec/config.yaml` 的 `compileCheck` 设置
- 若 `compileCheck.enabled` 为 false 或该段未配置（默认禁用），跳到 Phase 6

### 5.2 执行检查

- 从 `config.yaml` 的 context 探测技术栈（TypeScript、Java、Go、Rust……）
- 将变更文件分类为后端（TypeScript/Java/Go/Rust）与前端（JSP/Vue/React）
- 按技术栈执行编译命令：
  - TypeScript: `tsc --noEmit` 或 `pnpm run build`
  - Java-Maven: `mvn compile -DskipTests`
  - Java-Gradle: `gradle compileJava`
  - Go: `go build ./...`
  - Rust: `cargo build`

### 5.3 自动修复循环

- 若 `autoFix.enabled` 为 true：按可修复性分类问题，对变更范围内文件应用修复，重跑检查（最多 `maxRetries` 次，默认 3）

### 5.4 报告

- 汇总结果（编译、lint、前端），区分已修复与遗留问题
- 遗留失败**报告**给用户 —— MUST NOT 静默越过失败检查

---
## Phase 6: 同步提案 — 汇总所有修复

**⚠️ 强制: 循环中所有修复完成后，变更制品必须反映所有已实现的修复。**

### 6.1 更新制品（Markdown 优先）

Markdown 是唯一真源 —— 直接更新 OpenSpec Markdown 制品；不得创建或更新 JSON 镜像：

- **proposal**：把循环中**所有** bug 的根因与修复说明追加到 `proposal.md` 的 What Changes 下（每个 bug 追加一条）
- **specs**：任一修复改变已记录行为时，用 ADDED/MODIFIED/REMOVED/RENAMED 更新对应的 `specs/<capability>/spec.md` Requirement/Scenario
- **design**：任一修复改变已记录决策时，更新 `design.md` 的 Decisions
- **tasks**：更新 `tasks.md` 的 checkbox，必要时追加回归测试任务；保留 `Spec Ref`/`Scenario Ref`
- **Validate**：Markdown 编辑后运行 `iagent spec validate --change "<name>"` 并修正路径/行号诊断
- **仅遗留 JSON 的变更**：只读兼容；写操作须先显式迁移

### 6.2 持久化根因分析

- 把**所有** bug 的完整诊断记录（提示词基线、复现、排查路径、证据、根因、所选修复理由）写入变更目录的 `exploration.md`，按 bug 组织 —— 包含 `## 提示词基线` 段，使变更保留用户确认的语义来源；`## 功能流程（缺陷链路）` 段（2.5）承载确认后的缺陷链路与节点清单
- **分级判定结果**（2.2.3.5）：每个 bug 的排查深度分级结论 MUST 一并持久化 —— 三条信号取值、所选路径（轻量 A / 深度 B）、是否信号降级；即"为什么这个缺陷走了这条排查路径"须可追溯，避免事后无法复盘排查深度是否合理

### 6.3 Markdown 校验

同步后校验 Markdown 制品：

- `iagent spec validate --change "<name>"` 通过；失败时报出文件路径与行号
- `proposal.md` 含 Why / What Changes / Capabilities / Impact；`specs/**/*.md` 含 `### Requirement:` + `#### Scenario:`；`design.md` 含 Context / Decisions / Risks；`tasks.md` 任务带类型标签与 checkbox 状态

继续之前先修复任何违规 —— 同步不得损坏 Markdown 真源。

仅当制品反映所有已实现的修复后，才进入 Phase 7。

---
## Phase 7: 验证 — 覆盖所有修复

### 7.1 调用验证技能

对变更 `<name>`，通过 **调用 `iagent_spec_verify_proposal` 技能**执行验证：

- `iagent_spec_verify_proposal` 是技能名，不是有效的 `iagent spec instructions` 制品 ID —— MUST NOT 将其作为 CLI 指令运行
- 该技能通过读取制品与 exploration.md 执行 D1-D5 核心 + D6-D10 条件评分

**降级（回退）（技能不可用）**：技能未安装或调用失败时，降级为 AI 内联读取制品并手动执行 D1-D5 核心 + D6-D10 条件评分，并发出 WARN："iagent_spec_verify_proposal 技能不可用，降级为内联评分"。MUST NOT 静默跳过验证。

### 7.2 验证 FAIL → 自动修复循环

当任一维度得分低于阈值（<90%）时：

- 为每个未通过维度自动生成具体修复建议（如缺边界场景 → 向 spec 补场景）
- 将修复应用到制品文件
- 应用修复后自动重跑验证
- 显示修复摘要（「已应用自动修复 —— 重新运行验证……」）
- 重跑仍失败时：呈现遗留问题与选项 —— [1] 手动编辑，[2] 返回探索，[3] 查看详细差异报告。**没有跳过直接实现的路径。**

### 7.3 验证 PASS → 深度复查与收束（需求文档不在 debug 范围内）

验证通过后：

1. **自动调用 `iagent_proposal_review` 技能**对提案做只读深度复查（超出 D1-D5 核心 + D6-D10 条件评分的深度一致性与覆盖率审计）。复查自动运行（不弹 [Yes/No] 提示）。用户 MAY 中断以跳过；否则照常运行。
   - **降级（回退）（技能不可用）**：技能未安装或调用失败时，降级为 AI 内联只读深度复查并 WARN："iagent_proposal_review 技能不可用，降级为内联复查"。MUST NOT 静默跳过深度复查。
2. **收束 —— 需求文档不属于本工作流（⚠️ 强制禁止）**：深度复查完成后收束调试工作流，并报告该变更已可归档。本技能 MUST NOT：
   - 生成需求文档（无论 `openspec/changes/<change-name>/需求文档.md` 是否存在），
   - 对既有需求文档做就地增量对齐，
   - 以任何目的调用 `iagent_requirement_doc`。
   需求文档现由**验证**阶段生成（workflow / auto-workflow / full-workflow 流水线的 Phase 3 / Stage 2）。ARCHIVE 阶段（依 `iagent_spec_archive` 步骤 4.8）对既有文档做就地对齐 —— 文档缺失时（遗留变更）为向后兼容生成一份。
3. **报告**：显示验证结果、深度复查结论，以及：

> 「调试完成。需求文档已在验证阶段生成；归档阶段仅做对齐 —— 运行 /iagent:spec-archive。」
> 「已可归档。」

### 7.4 清理流程级调试工作区（强制）

验证收尾后 MUST **清理调试工作区** —— 统一清理 `.openspec-tmp/debug-<keyword>/`（以 `path.join()` 构造），覆盖**所有退出路径**：

- **正常收尾**：Phase 7 验证（含深度复查）完成后清理
- **非缺陷退出路径（3.5）**：诊断报告输出、工作流结束后同样清理
- **中途退出路径**：用户中途退出调试循环（Phase 5-7 收尾）时同样清理

**容错**：清理失败（目录不可删 / 权限不足）→ 记 WARN 并**提示残留路径**，**MUST NOT 阻断流程**（清理为收尾动作，不得使已完成的修复与验证失效）。

---
## Output

```
## Debug Workflow: <change-name or diagnosis-only>

### Loop Summary
- Total bugs fixed: N
- Non-defect findings: M (diagnosis only)

### Per-Bug Summaries

#### Bug #1: <one-line summary>
- Phase 1: Reproduction: <failing test / procedure> — confirmed ✗/✓
- Phase 2: 分级: <轻量路径 A / 深度路径 B —— 信号 (a)(b)(c) 取值、是否降级 yes/no>；根因: <一行摘要>；证据: <调用链 / 符号>
- Phase 3: Association: <in-progress change / new fix-{module}-<topic> / archived origin (traced)>
- Phase 4: Fix: <summary>, Regression test: <test reference> — passes ✓

#### Bug #2: <one-line summary>
- ...

### Phase 5: Compile Check (汇总所有修复)
- Compile check: PASS / FAIL(n issues) / SKIPPED(disabled)

### Phase 6: Synchronization (汇总所有修复)
- Markdown updated: proposal.md / design.md / specs/**/*.md / tasks.md — validated with `iagent spec validate`
- All root causes persisted to exploration.md ✓
- JSON validation: PASS

### Phase 7: Verification (覆盖所有修复)
- Score: XX% — PASS/FAIL
- Deep review: completed ✓ / WARN (reason)
- Requirement document: generated during verification; archive only aligns an existing document (per iagent_spec_archive step 4.8)

Ready for `/iagent:spec-apply` (fixes already applied) or archive.
```

---
## Guardrails

- **复现前先校验 bug 报告**：Startup 段的提示词校验门（缺陷五维）是强制前置——清晰描述一句话复述理解后直通；含糊描述须先做提示词优化并等待用户确认或修改，未确认前 MUST NOT 进入 Phase 1，不得凭猜测编写失败测试
- **确认门不得死锁**：确认门有四条出口（确认 / 修改 / 拒绝后按原理解继续 / 显式授权按推断继续），不得反复要求确认
- **必须持久化提示词基线**：原始提示词与确认后的基线写入诊断记录 `## 提示词基线` 段，Phase 6 随根因分析一并持久化
- **MUST 产出缺陷链路图**：2.5 在根因确认门（2.4）通过后强制产出诊断记录 `## 功能流程（缺陷链路）` 段（Mermaid + 节点清单表），节点**只覆盖缺陷链路**（前置条件 → 触发 → 异常 → 根因），异常节点标 `🔴异常`、根因节点标 `🟠根因`；MUST NOT 展开被测功能的完整业务流程
- **流程图门不得死锁**：2.5 确认门有四条出口（确认 / 修改 / 拒绝后记录未确认状态并按原理解继续 / 显式授权按推断继续），不得反复要求确认
- **修复与回归测试须覆盖异常节点与根因节点**：修复方案与回归测试 MUST 覆盖缺陷链路的「异常节点 + 根因节点」（4.1 / 4.2）；仅覆盖触发节点而未覆盖根因节点时，验证不通过
- **先复现**：没有确认的复现（失败测试或用户确认的步骤）就不修复 —— 适用于循环中的**每个** bug
- **按影响半径分级，而非按便利**：2.2.3.5 的分级信号取值 MUST 可追溯至实测查询结果（`codegraph_impact` / `codegraph_files`，降级时为 Grep）；MUST NOT 编造"半径小"以走轻量路径；信号缺失或阈值边界 MUST 取深度路径
- **分级与缺陷链路图解耦**：分级只决定 2.2.4 是否执行，2.5 缺陷链路图与流程最终确认门对轻量路径同样**强制产出**，MUST NOT 豁免
- **升级兜底是触发条件，不是独立步骤**：升级兜底即 2.2.4 扩展后的触发条件之一，MUST NOT 为其新建独立章节或编号（2.2.4 的内容与编号不变）
- **分级在 CodeGraph 降级时仍生效**：CodeGraph 不可用时分级仍生效（信号 (a) 降级为文件数代理指标，(b)(c) 照常）；MUST NOT 因降级跳过分级，诊断记录 MUST 标注「信号降级」
- **需求文档不在范围内（强制禁止）**：Phase 7 MUST NOT 生成需求文档，MUST NOT 就地增量对齐既有文档，MUST NOT 调用 `iagent_requirement_doc` —— 文档在**验证**阶段生成；ARCHIVE 阶段（`iagent_spec_archive` 步骤 4.8）做就地对齐（缺失时为向后兼容生成）
- **人工撰写字段受保护**：就地增量对齐时 `## 基本信息`（需求编号/需求名称/交付时间，含占位符状态）与 `## 八、评审记录` MUST NOT 覆盖；MUST NOT 删除章节（仅制品已移除的内容可删）
- **零猜测**：多个候选根因 → STOP 并让用户选择；绝不猜测
- **归档只读**：MUST NOT 修改 `openspec/changes/archive/`
- **回归测试强制**：每个修复都附带一个修复前失败、修复后通过的测试 —— 适用于循环中的**每个** bug
- **委派回归测试编写**：编写动作 MUST 委派给 `iagent_test`（传入测试级别/优先级与缺陷链路作为覆盖依据），使回归测试匹配项目既有框架与风格；仅当委派不可用时降级为自写 + WARN
- **委派绝不放松两条硬要求**：回归测试 MUST 仍覆盖缺陷链路的「异常节点 + 根因节点」，且 MUST 仍修复前 FAIL / 修复后 PASS —— 委派返回后自行核对两者
- **提案同步强制**：验证前制品必须反映**所有**已实现的修复
- **验证绝不跳过**：技能 → 内联降级（回退）+ WARN；FAIL → 自动修复循环，无跳过路径；PASS → 深度复查（技能 → 内联降级（回退）+ WARN）后收束 —— 需求文档不在此处产出（由 ARCHIVE 阶段生成）
- **循环中非缺陷不阻塞**：循环中的非缺陷发现 MUST NOT 阻塞其他 bug —— 记录诊断并继续
- **循环退出保留已完成工作**：中途退出保留已完成修复，丢弃未完成的当前 bug
- **独立变更分离**：用户声明某 bug 需要独立变更时，收尾当前变更并提示单独调试
- **使用 `path.join()`** 处理所有文件路径（跨平台：macOS/Linux/Windows）
- **术语实时收敛**：排查中确定的术语立即写入 CONTEXT.md

