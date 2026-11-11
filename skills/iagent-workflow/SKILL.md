---
name: iagent-workflow
description: "一站式引导工作流：从探索到归档。创建持久化探索文件，追问澄清直至明确（grill-with-docs、L1-L5 逐级门），由主 agent 内联执行制品生成（iagent-spec-propose），主 agent 单轮内联验证（D1-D10 + B1-B7 + 证据），再内联实现（iagent-spec-apply）并内联归档（iagent-spec-archive），阶段间以确认桥衔接。当用户需要带追问（grill-with-docs）问答与自动质量验证的引导式端到端管道时使用；触发词\"一站式引导工作流 / guided workflow / workflow from exploration / 引导式全流程\"；NOT for 全自动无门管道（改用 iagent-auto-workflow）、单一阶段探索（改用 iagent-spec-explore）或调试（改用 iagent-debug）。"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(iagent:*), Bash(git:*), Bash(ls:*), mcp__codegraph, mcp__codegraph__codegraph_status, mcp__codegraph__codegraph_files, mcp__codegraph__codegraph_search, mcp__codegraph__codegraph_context, mcp__codegraph__codegraph_node, mcp__codegraph__codegraph_callers, mcp__codegraph__codegraph_callees, mcp__codegraph__codegraph_impact, mcp__codegraph__codegraph_explore, Skill(iagent-spec-explore), Skill(iagent-spec-propose), Skill(iagent-spec-verify-proposal), Skill(iagent-proposal-review), Skill(iagent-spec-apply), Skill(iagent-spec-verify), Skill(iagent-test), Skill(iagent-spec-archive)
license: MIT
compatibility: 依赖 iagent CLI（spec 命令组）与阶段技能（iagent-spec-apply / iagent-spec-archive，条件 iagent-test）；CLI 缺失时探索/提案降级为 AI 内联生成（CLI-degraded generation）。
metadata:
  author: mi-agent-tools
  type: impl
  generatedBy: "snapshot"
  generatedFingerprint: "sha256:113a4ecd2141ef1b587243af70d8be97a0a174d7bcc1a2f79e669cd4d5ea0204"
---


**适用项目护栏（impl 域蒸馏，见 .iagent/rules/coding-rules.md）。** 未定义项标 **[待确认]**，禁止猜测。

一站式引导工作流（探索 → 归档），内置验证与确认桥。

**Input**: `/iagent:workflow` 之后的参数是用户的主题描述（想构建什么）。

本工作流将引导你完成：
1. **探索阶段** - 持久化探索文件 + grill-with-docs 追问
2. **提案阶段** - 创建变更并生成全部制品
3. **验证阶段** - 主 agent 单轮内联质量校验（D1-D10 + B1-B7）+ 证据
4. **实现阶段** - 实现 + 测试桥（实现方案 + 测试计划预告）→ 委派 iagent-spec-apply（条件测试子阶段）
5. **归档阶段** - 确认桥 → 委派 iagent-spec-archive

阶段之间直接推进（无委派断层），验证通过后委派阶段实现与归档，阶段间以确认桥保证完整性。区别于 iagent-auto-workflow（全自动无门）。

## ⛔ GATE PROTOCOL — ACTIVE

本技能包含以 **⛔ GATE:** 标记的**确认门**。每个门都是硬性停止点：
- 走到 ⛔ GATE 时，**本次响应到此结束** —— 输出门内容后立即停止
- 不得执行、描述或预生成门之后的任何步骤
- 用户的下一则消息即为确认信号 —— 仅在其响应后从门之后继续
- **非门动作 MUST NOT 停止，也 MUST NOT 请求确认**：阶段宣告 / 技能委派（含「是否调用 <技能>」）/ 只读扫描 / CodeGraph 查询 / 状态查询 / 只读校验的「是否运行 <校验>？」询问，均不是确认门
- **只有**门白名单（见「门白名单与 MUST NOT 确认清单」段）声明的 5 类门可以阻断推进；白名单外的动作 MUST NOT 被实现为停止点
- **违规**：未经用户确认而执行门之后的步骤，是破坏工作流的严重错误

## 门白名单与 MUST NOT 确认清单

**必留门（正向枚举 5 类，缺一即流程安全缺陷）**：
- **需求澄清（需求 / 方案歧义）**：prompt-gate / grill-batch-confirmation / diagnostic-confirmation / fix-option-confirmation（可按条件豁免）
- **功能流程图门（流程基准确认）**：flow-final-confirmation（不可豁免）
- **实现 + 测试桥**：implementation-bridge（不可豁免）
- **归档桥**：archive-confirmation（不可豁免）
- **破坏性改动确认（动作级，不可豁免：删除目录 / 覆盖既有制品 / 改写版本库跟踪 / 不可逆命令）**（不可豁免）

**MUST NOT 请求确认（非门动作，MUST NOT 被实现为停止点）**：
- 阶段宣告（如「进入 Phase N」「本阶段开始」）
- 技能委派（含「是否调用 <技能>」类询问）—— 已授权的 nextAllowed 技能直接委派
- 只读扫描（Glob / Grep / Read 与只读查询）
- CodeGraph 查询与能力探测（含锁阶梯只读复用）
- 状态查询（`iagent spec status` / `getChangeStatus` 等）
- 只读校验的「是否运行 <校验>？」询问（如技术栈专项校验）—— 直接执行并在报告中说明校验项

> 跨变更索引重建类动作已随索引能力退役（DEC-2），不构成任何门或动作。

**handoff 包（跨阶段只读复用）**：`iagent-spec-propose` 在 Phase 2 定稿时产出 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md`；Phase 3 / 4 / 5 的阶段入口读取该包（`sourceFingerprint` 与制品不一致 → 重建 + WARN），各阶段收尾只向 `## 阶段结论` 追加一行（`phase` / `status` / `artifact` / `nextAllowed`）；MUST NOT 另立包格式或重产整包。`exploration.md` 是探索→提案阶段的**唯一过桥载体**（Phase 2 委派 MUST 传 `explorationFile`，MUST NOT 以对话摘要 / 回执正文替代）；`flowBaselineConfirmed` / `paperTrailStatus` 原样透传（MUST NOT 补默认值），父级复核纸迹自证（MUST NOT 静默采信子级自证）与唯一停点口径见 `references/paper-trail-handoff.md`；包内 `## 硬约束` 为并列节、只读复用。

**执行方式与增量复验（强制）**：分级执行：Phase 1 / Phase 2 提案 / Phase 3 验证 / Phase 4 实现 / Phase 5 归档均由主 agent 内联（`executionMode=inline`）；仅 `spec-bulk-archive` 内部并行单元保留子代理。验证**一次**完成（合并 D1-D10 + B1-B7 清单），MUST NOT 派生验证子代理。兼容窗：propose / apply / verify / archive 的旧 `subagent` 回执记 deprecation WARN 并允许推进，下个 major 收紧。增量复验：验证 FAIL 后**在同一主上下文**按 fixDiff 增量重跑清单（≤3 次），禁止新开验证代理、禁止重读未改动制品与全量重读；禁止 resume 充当复验（contextReplay=true 记 WARN）。只读验证以固定清单 + 每条结论 `文件:行` 证据 + 报告落盘承担可信度。iagent-test 为 Phase 4 条件子阶段（主 agent 内联调用）。内联执行前先读 handoff 包「## 制品清单」并按锚点增量读取，回执写 readScope；「## 阶段结论」5 列（tokens 可用时填 tokens=<数值>，不可得填 —）。

## Phase 1: 探索（委派 iagent-spec-explore，交互阶段）

Phase 1 SHALL 由主 agent 内联委派阶段 `iagent-spec-explore`（传 `mode=delegated`）执行强制检查点体系探索（强制建探索文件、**项目规则基线**、**项目技能基线**、提示词校验门、CONTEXT.md 检查、CodeGraph 基础扫描含多项目派发与深度分析、L1-L5 grill 追问、功能流程图与流程最终确认门、聚合一致性门、探索完成检测），MUST NOT 内联执行探索逻辑。探索是**交互阶段**，MUST NOT 放入隔离子代理（提示词门 / 流程门需与用户交互）；回执 SHALL 携带技能基线状态（`## 项目技能基线` 是否存在 / 完整性），供 propose 与实现阶段读取。

委派完成后 SHALL 消费 `iagent-spec-explore` 输出的**结构化 handoff**（探索文件路径、提示词基线、流程基准确认状态 `flowBaselineConfirmed`、Pending 影响符号），并**在同一用户回合内**推进 Phase 2 —— 回执是中间状态，MUST NOT 以回执结束回合。

**Stage Envelope**：委派时只传路径与结构化字段（`changeName` / `explorationFile` / `configPath` / `rulesPath` / `mode` / `resume`），MUST NOT 内联制品正文或完整 SKILL.md。

**退出守卫**：被委派的 `iagent-spec-explore` 完成后 MUST NOT 自行进入提案或实现；阶段完成判定与推进主权归编排器。

## Phase 2: 提案

**⚠️ Phase 1 完成后本阶段立即开始 —— 不停顿、不宣告、不向用户提问。** 下一个动作 MUST 是 Phase 2.0 预迁移验证，MUST NOT 输出「探索完成」类单独消息等待确认。

**TodoWrite 跟踪**：把 Phase 2 事项加入 TodoWrite：
```
- [ ] Phase 2: 预迁移验证
- [ ] Phase 2: 委派 iagent-spec-propose 生成全部制品
```

### 2.0 预迁移验证（强制检查点）

**⚠️ 强制：Phase 2 推进前必须完成迁移验证**

在创建变更目录并迁移探索文件之前：

#### 验证步骤

1. **检查探索文件是否存在**
   ```bash
   # Read exploration.md from openspec/explorations/
   # If file missing, system MUST warn user
   ```

2. **CONTEXT.md 校验（强制检查点）**
   - 检查 `openspec/CONTEXT.md` 是否存在
   - 已存在时：校验 exploration.md 术语表中的全部术语都在 CONTEXT.md 中
     - 写入前 MUST 先读 CONTEXT.md；同名术语定义不一致时 MUST 显式裁决（更新定义，或保留旧定义并标注「已过时（由 <change-name> 取代）」）；MUST NOT 静默追加第二条同义条目；若有术语缺失，自动同步
   - 不存在时：从 exploration.md 的术语表段自动生成
     - 创建 `openspec/CONTEXT.md`，写全已消解的术语
   - **兼容（Task 12.1，已收窄）**：若探索文件不存在（经 1 次路径解析重试后），记录 WARN 日志"跳过 CONTEXT.md 检查：无探索文件"并**仅**跳过 CONTEXT.md 检查。该跳过不豁免委派的 spec_explore 聚合一致性门。
   - 记录："CONTEXT.md 已校验/已创建 — <N> 个术语"

3. **校验文件内容**
   - 检查文件是否含最低必需小节（Background、Decisions）
   - 若小节缺失，向用户告警并给出恢复选项

4. **处理文件缺失**
   - **选项 A**：依据探索记忆新建文件
   - **选项 B**：中止迁移并返回探索
   - 用户 MUST 先选定再推进

#### 迁移失败恢复

**迁移失败时**：
- 保留源文件（失败路径上 MUST NOT 删除它）
- 清理残缺的目标文件
- 报告错误并给出具体失败原因
- 提供重试或手动迁移指引
- 记录失败以便用户追踪

**失败处理流程**：
```
1. Source file locked → Unlock or retry
2. Permission denied → Request permissions or manual migration
3. Disk full → Clean up space or manual migration
4. Network error → Retry or manual migration
```

**强制检查点**：
- 无有效迁移时，系统 MUST NOT 进入制品生成
- 迁移失败时，系统 MUST 保留源文件
- 用户 MUST 被告知迁移状态与任何错误

#### 影响面触发检测

读取 exploration.md 的 Pending 段：
```
If "### For Phase 2 Impact Analysis" section exists AND has symbols:
  Run impact analysis directly (no prompt)
```

#### 影响分析自动执行

> "在探索文件中发现可做影响分析的符号——自动运行影响分析。确保制品包含影响面上下文。"

Pending 段含符号时，影响分析始终运行，不询问用户。

#### 影响分析执行

**使用 CodeGraph 影响面工具**：
```bash
mcp__codegraph__codegraph_impact --symbol <symbol> --direction upstream --maxDepth 3
```

**多符号并行执行**：识别出两个及以上影响面符号时，把影响面查询并行发起（单轮响应内多个工具调用），而不是逐个串行。全部结果合并进制品的影响面小节；单个符号沿用既有的单次查询行为。

**影响面结果结构**：
```
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
```

#### 落盘影响面结果

为制品生成存好结果：
- `proposal.md` 的 Impact：影响面分析小节
- `design.md` 的 Context：架构影响小节
- tasks.md：包含 ### Caller Updates 小节

#### 影响面跳过处理

若未发现影响面符号：
- 不带影响面小节继续生成制品
- `proposal.md` 的 Impact / `design.md` 与 `tasks.md` 不含 Impact 内容

#### 直接转入委派提案生成

**⚠️ 复杂度评估与生成方式选择已从 Phase 2 移除。**

Phase 2.0 影响面分析完成（或跳过）后：
- 直接进入 Phase 2.3：委派 iagent-spec-propose（`mode=delegated` + exploration-file）完成迁移与制品生成
- 不要计算复杂度评分，也不要展示生成方式选项
- 逐步式创建在本工作流之外仍可用（通过 iagent spec new）

**强制检查点**：
- 系统 MUST NOT 提示用户选择生成方式
- 系统 MUST NOT 展示复杂度评估结果
- 系统 MUST 从 Phase 2.0 直接推进到 Phase 2.3 的委派

### 2.3 提案生成（委派 iagent-spec-propose，自动阶段）

Phase 2.0 预迁移验证与影响分析完成后，探索文件迁移与全部制品生成（proposal.md / specs/**/*.md / design.md / tasks.md）SHALL 由主 agent 内联执行阶段 `iagent-spec-propose`（传 `mode=delegated` + `exploration-file=<Phase 1 探索文件路径>`）完成；MUST NOT 派发 `Agent` / `Task` 子代理（兼容窗内旧 subagent 回执记 deprecation WARN）。制品生成遵循**项目规范** `.iagent/rules/spec.md` 的制品协议要点（Markdown-first 共享协议；该文件缺失时以 spec_propose 的内联要点为准并记 WARN，MUST NOT 阻断）。规则注入、schema 验证与 CLI 降级由 `spec_propose` 承担。

**Stage Envelope**：只传 `changeName` / `changeRoot` / `explorationFile` / `handoffPackPath` / `mode` / `resume` / `configPath` / `rulesPath`；MUST NOT 内联制品正文或完整 SKILL.md。子代理先读 handoff 包（若已存在），再按需增量读取探索文件。

**回执续跑**：子代理回执 SHALL 含 `changeName` / `artifacts` / `applyReady` / `explorationFile` / `handoffPackPath` / `sourceFingerprint`；父级校验通过后**在同一用户回合内**进入 Phase 3。

**退出守卫**：被委派的 `iagent-spec-propose` 完成后 MUST NOT 自行进入实现或推进阶段；阶段推进主权归 `iagent-workflow`。

## Phase 3: 验证（主 agent 内联，单轮）

**⚠️ 提案制品生成完成后本阶段立即开始 —— 不停顿、不宣告、不向用户提问。**

**执行方式（强制）**：Phase 3 SHALL 由**主 agent 内联**执行**一次**验证并返回 `executionMode=inline` / `independence=self`；内联验证**合并两份清单**：D1-D10 核心维度（含 D6-D10 条件维度）+ B1-B7 边界清单。MUST NOT 再分别派生 `iagent-spec-verify-proposal` 与 `iagent-proposal-review` 两个验证子代理；兼容窗内旧的 `subagent` 回执记 deprecation WARN 并允许推进（下个 major 收紧为仅 `inline`）。被委派的 spec_propose 已抑制自身的 Phase 3 以避免重复评分。

**证据与复跑（强制）**：每条结论 MUST 带 `文件:行` 或制品章节锚点，**无证据的结论 MUST NOT 计入通过**；报告 MUST 落盘 `.openspec-tmp/pipeline-<change-name>/verify-report.md`，回执记 `readScope`。FAIL 后在**同一主上下文**按 `fixDiff` 只重跑受影响清单项（≤3），MUST NOT 新开验证代理、重读未改动制品或全量重读；读取范围 MUST FIRST 取 handoff 包「## 制品清单」并按锚点增量读取。

**TodoWrite 跟踪**：把 Phase 3 事项加入 TodoWrite：
```
- [ ] Phase 3: D1-D10 + B1-B7 清单（内联）
- [ ] Phase 3: 逐项证据核对（文件:行 / 章节锚点）
- [ ] Phase 3: 验证报告落盘 verify-report.md
```

全部制品在 Phase 2.5 生成并校验后，自动进入 Phase 3 验证。

> **Phase 3 细则下沉**：自动执行、量化评分、技术栈检测、通过/失败处理见 `references/verification-protocol.md`；执行 Phase 3 前 MUST 先 `Read` 该文件。

## Phase 3.7: 实现 + 测试桥（强制检查点）

**⛔ GATE: 实现 + 测试桥（强制停止，单一阻塞门）** — 内联验证（D1-D10 + B1-B7 清单）收束后，**一次呈现**「提案摘要 + 验证评分与证据摘要 + 深度复查清单结论 + 实现方案 + 测试与一致性门预告」，等待用户**一次确认**后进入实现。预告 MUST 说明：实现后将执行**自动单测补齐**（`testGate.autoGenerate` 默认 true）、范围内测试门、**实现一致性门**与三类证据判定；任一失败会阻断归档。需求文档选项已移除；本桥 MUST NOT 提供文档生成选项，MUST NOT 在实现阶段再设第二个确认门。

- 就绪检查：proposal.md / design.md / specs/**/*.md / tasks.md 齐全；验证 PASS（≥90%）；深度复查清单（B1-B7）完成；apply instruction 状态 = ready（`iagent spec instructions apply --change "<name>" --json`；CLI 不可用读 tasks.md 推断）
- **三出口（一次呈现，禁止拆成多次停顿）**：① 确认 → 进入 Phase 4（含条件测试生成）；② 修改 → 回 Phase 2 调整制品或回 Phase 1 补决策，MUST NOT 进入实现；③ 拒绝 → 记录未确认状态并停止，不进入实现
- **FAIL 不进入实现**：验证 FAIL、重验循环中或深度复查未收束时 MUST NOT 呈现本桥
- 交付桥确认后 MUST 先写门账本再委派（见 Phase 4 首段）

---
## Phase 4: 实现（委派 iagent-spec-apply）

**⚠️ Phase 3.7 交付桥确认后本阶段立即开始 —— 不停顿、不宣告、不向用户提问。** MUST NOT 再输出对该技能的调用确认询问（确认已由 3.7 交付桥承载）。

**门账本写入（U4，委派前强制）**：交付桥确认实现后**立即**把门承载 id `design-confirmation` 写入变更级 handoff 包 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md` 的 `## 已确认门` 段（Markdown 表格行 `| design-confirmation | verify |`；只追加、不改写既有条目），并在**委派前校验该段与条目存在**：

- 写入失败或校验失败（工作区不可写 / 文件写入异常 / 段缺失）→ **停止并报告期望路径与原因，MUST NOT 委派**（禁止出现「既无参数也无账本」的静默跳过）
- 账本条目 MUST NOT 超出本阶段回执 `confirmedGates` 声明的已确认门；本阶段回执 SHALL 携带 `confirmedGates: ['design-confirmation']`
- 条目取值 MUST 收敛到 `GATE_SKIP_IDS`（门承载语义）—— MUST NOT 写入父级阶段门 id（`implementation-bridge` 不在域内，写入即触发 `invalid-receipt`）
- 账本路径由 change-name 确定性派生（`.openspec-tmp/pipeline-<change-name>/handoff-pack.md`），MUST NOT 作为委派参数键传入

**由主 agent 内联执行 `iagent-spec-apply` 技能**实现（MUST NOT 派发 `Agent` / `Task`；兼容窗内旧 subagent 回执记 deprecation WARN）：
- 传入 change-name + Stage Envelope（handoff 包路径 / 门账本 / `resume`）+ `gate-skip=design-confirmation`（门承载参数：跳过 apply 内部的设计确认门——确认已由 Phase 3.7 交付桥承载，避免重复确认；`auto-mode=true` 为兼容等价写法）
- `gate-skip` 是**主通道**（权威），门账本是参数丢失时的**兜底**；两者皆缺时被委派 apply 的设计确认门照常触发，MUST NOT 静默跳过
- 该参数**仅**跳过设计确认门；测试执行门、范围蔓延确认与共享资源协议照常生效
- apply 内部完成：分层代码生成（Entity/DTO → Mapper/DAO → Service → Controller）、tasks.md 勾选更新、编译检查
- 后端架构规则由 apply 按 `.iagent/rules/coding-rules.md` 自行处理，workflow 不干预
- **回执续跑**：子代理回执 SHALL 含 `tasksCompleted` / `compileResult` / `receipts` / `confirmedGates` / `skillsRead` / `skillsIncomplete`；父级校验通过后**在同一用户回合内**进入条件测试 / 实现验证，MUST NOT 以回执结束回合；`skillsRead` 缺字段或未覆盖配置中 implement|both 技能时记 WARN 并回 Phase 4 补齐，MUST NOT 伪造读取

### 4.1 测试与一致性门（由 apply 承载，父级只读证据）

- apply 内部执行 Step 8.11 自动单测补齐（`testGate.autoGenerate` 默认 true；先消费 `[测试]` 任务，只补缺口）、Step 9 测试门与 Step 9.7 一致性门；父级 MUST NOT 另起测试生成、重跑命令或另立判定（计划已在 Phase 3.7 预告，不再设门）
- 只读 `.openspec-tmp/pipeline-<change-name>/test-report.md` 与 `.openspec-tmp/pipeline-<change-name>/conformance-report.md` 的 `**summary**:` 行：测试 `pass` / `not-applicable` / `disabled`、一致性 `status=pass` 放行；`fail` / 缺失 / 无法解析 → 回 Phase 4
- 不测判定、补测关闭与回执 `rulesRead` 覆盖 MUST 留痕；未覆盖规则源按 `fail` 处理

### 4.2 实现错误处理

- 编译失败（apply 自动修复 `maxRetries` 次后仍为 `fail`，证据 `status=fail`）：暂停等待用户，不进入归档
- 测试生成阶段拒绝：回退到 Phase 3.7 实现 + 测试桥重新确认实现范围
- 门账本写入 / 校验失败：停止并报告期望路径与原因，MUST NOT 委派
- 子代理失败：retry 一次，仍失败暂停报告（保留产物路径，`resume=true` 时跳过已完成任务）
- 子代理阻塞（`blockedGate` / `blockedReason`）：呈现门 / 决策并等待用户；确认后写账本或 `userDecision` 并以 `resume=true` 重委派

### 4.3 实现验证桥接（apply → archive 之间，强制）

- 实现与条件测试完成后，MUST 由**主 agent 内联**调用 `iagent-spec-verify` 技能验证实现与制品（specs/tasks/design）一致性（`executionMode=inline` / `independence=self`）；先读 handoff 包，结论含验证结果摘要与可选 `reportPath`；MUST NOT 为新的验证执行派生 Agent 子代理
- 通过 → 在同一用户回合内进入 Phase 5 归档桥；失败 → 回 Phase 4 修复，MUST NOT 进入归档
- **省略声明（fallback）**：若 `iagent-spec-verify` 不可用或项目约定不单独跑实现验证，MUST 在归档桥就绪检查中显式声明「实现验证由 apply 编译检查 + 归档一致性承担」并记录该决策；MUST NOT 静默省略

---
## Phase 5: 归档（委派 iagent-spec-archive）

**⚠️ 实现验证通过后本阶段立即开始 —— 不停顿、不宣告、不向用户提问**，直至 5.1 归档确认门（唯一的归档阻塞门）。

### 5.1 归档桥（强制检查点）

**⛔ GATE: 归档确认门（强制停止）**
- 就绪检查：tasks.md 全部 `- [x]`；**三类证据就绪**（唯一判据：分别读取 `.openspec-tmp/pipeline-<change-name>/compile-report.md`、`.openspec-tmp/pipeline-<change-name>/test-report.md` 与 `.openspec-tmp/pipeline-<change-name>/conformance-report.md` 的 `**summary**:` 行；handoff 包 `## 阶段结论` 仅作辅助，不一致时以证据文件为准并记 WARN）：编译与测试 `status ∈ {pass, not-applicable, disabled}` 放行，其中 `not-applicable` / `disabled` 记 WARN 并说明「未执行编译检查」，MUST NOT 表述为「编译检查通过」；一致性 `status=pass` 放行；证据缺失、`status=fail` 或无法解析出汇总状态 → **阻断归档并回到 Phase 4**（输出含期望路径与失败原因）。自动单测补齐与测试门完成；实现验证（`iagent-spec-verify`）通过或已显式声明省略
- 呈现：实现摘要 + 编译终态与证据路径 + 测试通过率 + 条件子阶段产物
- **父流程 MUST NOT 自行执行编译或测试命令**（编译与测试由被委派的 `iagent-spec-apply` 单点负责），MUST NOT 以「tasks.md 全部勾选」「实现已验证」替代证据，MUST NOT 因证据缺失而询问用户是否跳过
- 出口：确认（进入归档）／拒绝（返回 Phase 4 继续实现，不归档）

### 5.2 内联执行 `iagent-spec-archive`（主 agent，Skill 工具）

- **执行方式（强制）**：单变更归档 SHALL 由**主 agent 内联**由主 agent 内联执行 `iagent-spec-archive` 的归档协议（`executionMode=inline`），MUST NOT 派生归档子代理；兼容窗内旧的 `subagent` 回执记 deprecation WARN 并允许推进（下个 major 收紧为仅 `inline`）
- 传入 change-name（跳过选择提示）+ Stage Envelope（handoff 包路径 / `compile-report.md` 路径 / `resume`）；MUST NOT 传已移除的需求文档状态字段
- archive 内部完成：delta spec 合并主规格、CONTEXT.md 同步、探索记忆同步到 `specs/<cap>/explorations.md`、目录迁移 `archive/`、归档索引维护（根入口 `ARCHIVE-INDEX.md` 的月份导航 + 全局模块统计；当月月度索引 `ARCHIVE-INDEX-YYYY-MM.md` 的纯追加）、归档只读校验、流程级工作区清理
- **回执续跑**：内联执行结果 SHALL 含 `archivePath` / `specsSynced`；父级校验通过后完成流程
- sync 检查点非阻断（失败 WARN 不阻断）

### 5.3 记忆闭环

- archive 写 `specs/<cap>/explorations.md`，供下一轮提案读取
- 输出全流程总结

---
## Output（工作流输出示例）

### 示例 1：提案方式（低复杂度）

```
## Exploration Phase

**检查点：创建探索文件**
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

**检查点：预迁移验证**
✓ Verified: openspec/explorations/user-auth-explore-001.md exists
✓ Validated: File has Background and Decisions sections

**检查点：委派提案生成（Phase 2.3）**
✓ Skipped complexity evaluation (removed)
✓ Skipped method selection (removed)
✓ Delegating iagent-spec-propose (mode=delegated + exploration-file)

**检查点：制品生成（委派 spec_propose）**
✓ Created change directory: openspec/changes/add-user-auth/
✓ Delegated skill generated artifacts
✓ Generated: proposal.md (1/4)
✓ Generated: specs/auth/spec.md (2/4)
✓ Generated: design.md (3/4)
✓ Generated: tasks.md (4/4)
✓ All artifacts complete

## Verification Phase

Phase 3 验证自动执行，无询问（不因 Propose 方式而询问 [立即验证]/[跳过验证]）

Auto-invoking `iagent-spec-verify-proposal` skill for D1-D5 scoring...

Running 5-dimension verification...

| Dimension | Coverage | Status |
|-----------|----------|--------|
| D1: Requirements | 85% | PASS |
| D2: Technical | 90% | PASS |
| D3: Tasks | 100% | PASS |
| D4: Boundaries | 70% | FAIL |
| D5: Pending | 100% | PASS |
| D6-D10: 条件维度 | N/A | SKIP（无触发） |

Overall Score: 89% (<90%, FAIL)

D4 auto-fix: adding missing boundary scenarios to specs/auth/spec.md...
Artifacts updated. Re-running verification...

Re-run Overall Score: 92% (≥90%, PASS) → auto-triggering iagent-proposal-review deep check...

[deep review results displayed]

内联验证（D1-D10 + B1-B7）收束 → 进入实现 + 测试桥（无需求文档桥）

## Verification Complete ✓

All artifacts ready! Proceeding to the Phase 4 implementation bridge...
```

### 示例 2：直接通过（验证后进入实现 + 测试桥）

```
## Exploration Phase

**检查点：创建探索文件**
✓ Created: openspec/explorations/complex-refactor-explore-001.md
✓ Verified: File exists and is writable

[Complex exploration with multiple modules...]

## Exploration Complete ✓

Checks passed — generating proposal directly

## Proposal Phase

**检查点：预迁移验证**
✓ Verified: exploration.md exists

**检查点：委派提案生成（Phase 2.3）**
✓ Skipped complexity evaluation (removed)
✓ Skipped method selection (removed)

**检查点：制品生成（委派 spec_propose）**
✓ Created change: openspec/changes/complex-refactor/
✓ Delegated skill generated artifacts
✓ Generated: proposal.md (1/4)
✓ Generated: specs/module1/spec.md (2/4)
✓ Generated: specs/module2/spec.md (3/4)
✓ Generated: design.md (4/4)
✓ All artifacts complete

## Verification Phase

Phase 3 验证自动执行，无询问

Auto-invoking `iagent-spec-verify-proposal` skill for D1-D5 scoring...

Running 5-dimension verification...

| Dimension | Coverage | Status |
|-----------|----------|--------|
| D1: Requirements | 92% | PASS |
| D2: Technical | 95% | PASS |
| D3: Tasks | 100% | PASS |
| D4: Boundaries | 90% | PASS |
| D5: Pending | 100% | PASS |
| D6-D10: 条件维度 | N/A | SKIP（无触发） |

Overall Score: 95% (≥90%, PASS) → auto-triggering iagent-proposal-review deep check...

[deep review results displayed]

Deep review complete.
内联验证（D1-D10 + B1-B7）收束 → 进入实现 + 测试桥（无需求文档桥）

## Verification Complete ✓

All artifacts ready! Proceeding to the Phase 4 implementation bridge...
```

**检查点日志格式**：
- 每个检查点展示：✓/✗ 状态、文件路径、校验结果
- 失败展示：✗ 操作、错误原因、恢复选项
- 所有操作均记录日志以便追溯

---
## 跨平台注意事项

- 文件路径一律用 `path.join()`
- 不要硬编码正斜杠 / 反斜杠
- 在 Windows、macOS、Linux 上验证路径操作
- 需要绝对路径时用 `path.resolve()`

## Guardrails

- **不要跳过追问** - 一直问到真正清晰为止
- **冲突时不要自动推进** - 1.6 一致性检查通过（一致性直通）时阶段自动推进；仅在检测到硬冲突时才询问用户
- **只读操作直接执行** - 文件读取、CodeGraph 查询与分析步骤（Semgrep、影响面分析）无需征得用户确认即可运行
- **只读直通不覆盖澄清门** - grill L1-L5 需求澄清门仍须等待用户确认
- **自动验证** - 提案完成后自动验证，不询问用户
- **不要丢失探索成果** - 即使用户放弃，探索文件依然保留（除非被删除）
- **不要强制修复** - 验证失败时给出选项，由用户决定
- **MUST 先建文件再追问** - Phase 1 检查点为强制项
- **MUST 先校验提示词再探索** - 委派的 spec_explore（delegated）提示词校验门是强制检查点：清晰输入一句话复述理解后直通（不输出校验表、不要求确认）；不明确输入须先做提示词优化并等待用户确认或修改，未确认前 MUST NOT 推进到后续步骤
- **确认门不要死锁** - 委派的 spec_explore 提示词门有四条出口（确认 / 修改 / 拒绝后按原理解继续 / 显式授权按推断继续），不得反复要求确认而陷入等待死循环
- **落盘提示词基线** - 原始提示词与确认后的基线一并写入探索文件 `## 提示词基线` 段；基线变更 MUST 回到委派的 spec_explore 提示词门重新确认
- **MUST 产出功能流程图** - 委派的 spec_explore 流程最终确认门是强制检查点：探索分析完成后 MUST 产出探索文件 `## 功能流程图` 段（Mermaid + 节点清单）并执行流程最终确认门；用户确认前 MUST NOT 进入完成检测，MUST NOT 把未确认流程图当作提案锚点
- **流程门不要死锁** - 委派的 spec_explore 流程确认门有四条出口（确认 / 修改 / 拒绝后记录未确认状态并按原理解继续 / 显式授权按推断继续），拒绝时 propose 降级为仅凭 exploration.md、verify 节点覆盖度维度 SKIP，不得反复要求确认
- **MUST NOT 在 tasks 中静默补节点** - 发现遗漏节点 MUST 回到委派的 spec_explore 更新流程图并重新经用户确认，MUST NOT 在 tasks.md 中静默补节点
- **MUST 先校验文件再迁移** - Phase 2 检查点为强制项
- **MUST 在迁移失败时保留源文件** - 绝不丢失用户数据
- **MUST NOT 提供生成方式选择** - Phase 2 直接进入委派的 spec_propose 生成（复杂度评估与方式选择已移除）
- **MUST 委派制品生成** - Phase 2.3 委派 `iagent-spec-propose`（`mode=delegated` + exploration-file）生成制品；MUST NOT 内联生成提案制品
- **先探索代码库** - 提问前先确认代码库是否已能回答该问题
- **必须给出建议** - 每个问题都附带 AI 的建议
- **实时更新文件** - 每轮交流后写入探索文件
- **使用结构化格式** - Background、Questions、Decisions、Pending 小节
- **展示量化评分** - 验证结果包含覆盖率百分比
- **自动执行内联验证** - Phase 3 由主 agent 单轮内联完成（D1-D10 + B1-B7 合并清单），每条结论带 `文件:行` 或章节锚点证据、无证据不计分、报告落盘；MUST NOT 派生 iagent-spec-verify-proposal / iagent-proposal-review 子代理（兼容窗旧 subagent 回执记 deprecation WARN）
- **记录检查点状态** - 告知用户文件创建、校验与迁移状态
- **注入能力记忆** - Phase 1 在 specs/<capability>/explorations.md 存在时读取它
- **用 CodeGraph 扫描其他项目** - 探索上下文含其他项目路径时，派发子代理用 CodeGraph 的 projectPath 参数扫描；失败时降级为 Glob/Grep
- **验证收束后进入实现 + 测试桥** - 全量通过（D1-D10 + B1-B7）后进入**实现 + 测试桥**（Phase 3.7：一次呈现「提案摘要 + 验证评分与证据摘要 + 深度复查清单结论 + 实现方案 + 测试计划预告」，一次确认）；本桥 MUST NOT 提供需求文档选项
- **FAIL 不进入实现** - 验证失败或重验循环中 MUST NOT 呈现实现桥、MUST NOT 进入 Phase 4
- **回执续跑** - 每个委派阶段返回有效回执后 MUST 在同一用户回合内继续下一阶段；MUST NOT 以回执结束回合；回执 MUST NOT 作为面向用户的最终消息（用户可见至多一行进度），停点前 MUST 引用门白名单的类别 id 或锚点 id
- **子代理数据共享** - 只传 Stage Envelope（路径 + 结构化字段），MUST NOT 内联制品正文或完整 SKILL.md；子代理先读 handoff 包，回执只含 Stage Receipt（≤40 行 / ≤2KB）
- **委派前写门账本** - 交付桥确认后立即把 `design-confirmation` 写入 handoff 包 `## 已确认门` 并在委派前校验存在；写入 / 校验失败 → 停止并报告期望路径与原因，MUST NOT 委派；阶段回执携带 `confirmedGates: ['design-confirmation']`；`gate-skip` 仍是主通道（权威），账本仅为参数丢失时的兜底
- **对委派执行退出守卫** - 委派的阶段子技能（spec_apply / spec_archive / test）完成后 MUST NOT 自行进入 plan 模式 / 设计模式或推进阶段；workflow 是唯一有权判定阶段完成并推进下一阶段（桥梁）的角色
- **向 apply 传门承载参数** - Phase 4 向 spec_apply 传 `gate-skip=design-confirmation`（兼容写法 `auto-mode=true`），由 Phase 3.7 实现桥承载确认；仅跳过设计确认门，其余门与停点照常生效
- **向 archive 传 change-name** - Phase 5 向 spec_archive 传 change-name 跳过选择
- **条件委派测试** - tasks.md 含 `[测试]` 任务时委派 iagent-test；测试计划已在 Phase 3.7 实现 + 测试桥一次确认，MUST NOT 再设独立门

