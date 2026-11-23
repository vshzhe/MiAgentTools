---
name: iagent-auto-workflow
description: "一站式全自动工作流：探索→提案→验证→自动实现→归档确认门→自动归档，L1-L5 与流程最终确认后实现全自动（无需求文档桥），归档执行前 MUST 经用户确认功能完成；触发词\"全自动工作流 / auto workflow / fully automated pipeline\"。当用户需要实现阶段全自动、归档前确认的管道时使用；NOT for 交互式引导工作流（改用 iagent-workflow）。"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(iagent:*), Bash(npm:*), Bash(pnpm:*), Bash(node:*), Bash(mvn:*), Bash(gradle:*), Bash(ant:*), Bash(go:*), Bash(cargo:*), Bash(git:*), Bash(ls:*), Bash(mv:*), mcp__codegraph, mcp__codegraph__codegraph_status, mcp__codegraph__codegraph_files, mcp__codegraph__codegraph_search, mcp__codegraph__codegraph_context, mcp__codegraph__codegraph_node, mcp__codegraph__codegraph_callers, mcp__codegraph__codegraph_callees, mcp__codegraph__codegraph_impact, mcp__codegraph__codegraph_explore, Skill(iagent-spec-explore), Skill(iagent-spec-propose), Skill(iagent-spec-verify-proposal), Skill(iagent-proposal-review), Skill(iagent-spec-apply), Skill(iagent-spec-verify), Skill(iagent-review), Skill(iagent-test), Skill(iagent-spec-archive)
license: MIT
compatibility: 依赖 iagent CLI（spec 命令组）与 spec 系列技能（iagent-spec-apply / iagent-spec-archive）；CLI 缺失时降级为 AI 内联生成。
metadata:
  author: mi-agent-tools
  type: impl
  generatedBy: "snapshot"
  generatedFingerprint: "sha256:ac4bf315d3deb462289ab4c16b296464d4654ee5dacddb8c3d660525da7f86a9"
---


**适用项目护栏（impl 域蒸馏，见 .iagent/rules/coding-rules.md）。** 未定义项标 **[待确认]**，禁止猜测。

一站式全自动工作流：从探索到归档。**「全自动」指提案、验证、实现、自动归档之间无额外停点；流程仍有两道用户停点**：① 探索阶段的需求澄清（L1-L5 追问与流程最终确认门）；② Phase 5 的归档确认门（用户确认功能完成后才归档）。

**输入**：`/iagent:auto-workflow` 后可跟用户想构建的主题描述。缺失的参数交互式收集；已提供的参数跳过。

该工作流引导你依次完成：
1. **探索阶段** —— 常驻探索文件 + grill-with-docs 追问（L1-L5 用户确认）
2. **提案阶段** —— 生成变更及其全部制品（自动）
3. **验证阶段** —— 主 agent 单轮内联质量校验（D1-D10 + B1-B7 + 证据）；不再有需求文档桥
4. **自动实现阶段** —— 验证通过后不设确认门，直接自动实现
5. **自动归档阶段** —— 三类证据与 review 结论就绪后呈现归档确认门（⛔ GATE），用户确认功能完成后自动归档

## 门白名单与 MUST NOT 确认清单

**必留门（正向枚举 5 类，缺一即流程安全缺陷）**：
- **需求澄清（需求 / 方案歧义）**：prompt-gate / grill-batch-confirmation / diagnostic-confirmation / fix-option-confirmation / design-confirmation（可按条件豁免）
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

---
## 执行方式与增量复验（强制）

分级执行：Phase 1 / Phase 2 提案 / Phase 3 验证 / Phase 4 实现 / Phase 5 归档均由主 agent 内联（`executionMode=inline`）；仅 `spec-bulk-archive` 内部并行单元保留子代理。验证**一次**完成（合并 D1-D10 + B1-B7 清单），MUST NOT 派生验证子代理。兼容窗：propose / apply / verify / archive 的旧 `subagent` 回执记 deprecation WARN 并允许推进，下个 major 收紧。增量复验：验证 FAIL 后**在同一主上下文**按 fixDiff 增量重跑清单（≤3 次），禁止新开验证代理、禁止重读未改动制品与全量重读；禁止 resume 充当复验（contextReplay=true 记 WARN）。只读验证以固定清单 + 每条结论 `文件:行` 证据 + 报告落盘承担可信度。iagent-test 为 Phase 4 强制子阶段（主 agent 内联调用；降级二分：能力缺失 strict 阻断 / 配置关闭显式 degraded）。内联执行前先读 handoff 包「## 制品清单」并按锚点增量读取，回执写 readScope；「## 阶段结论」5 列（tokens 可用时填 tokens=<数值>，不可得填 —）。

## Phase 1: Exploration（委派 iagent-spec-explore，交互阶段）

Phase 1 SHALL 由主 agent 内联委派阶段 `iagent-spec-explore`（传 `mode=delegated`）执行强制检查点体系探索（强制建探索文件、**项目规则基线**、**项目技能基线**、提示词校验门、CONTEXT.md 检查、CodeGraph 基础扫描含多项目派发与深度分析、L1-L5 grill 追问、功能流程图与流程最终确认门、聚合一致性门、探索完成检测），MUST NOT 内联执行探索逻辑。探索是**交互阶段**，MUST NOT 放入隔离子代理（提示词门 / 流程门需与用户交互）；回执 SHALL 携带技能基线状态，供 propose 与实现阶段读取。

委派完成后 SHALL 消费 `iagent-spec-explore` 输出的**结构化 handoff**（探索文件路径、提示词基线、流程基准确认状态 `flowBaselineConfirmed`、Pending 影响符号），并**在同一用户回合内**推进 Phase 2 —— 回执是中间状态，MUST NOT 以回执结束回合。

**Stage Envelope**：委派时只传路径与结构化字段（`changeName` / `explorationFile` / `configPath` / `rulesPath` / `mode` / `resume`），MUST NOT 内联制品正文或完整 SKILL.md。

**退出守卫**：被委派的 `iagent-spec-explore` 完成后 MUST NOT 自行进入提案或实现；阶段完成判定与推进主权归编排器。

**纸迹衔接口径（探索→提案）**：`exploration.md` 是**唯一过桥载体**——Phase 2 委派 MUST 传 `explorationFile`，MUST NOT 以父级对话摘要、回执正文或临时记忆替代。探索回执的 `flowBaselineConfirmed` / `paperTrailStatus` 原样记录并透传（MUST NOT 改写；字段缺失时 MUST NOT 静默补默认值）。**父级复核纸迹自证**：收到 `paperTrailStatus=complete` 时至少核对一次 `exploration.md` 的 Decisions / 术语表 / ADR 三项（存在或有显式「无」字面量），核对不一致记 WARN 并按实际值透传，MUST NOT 静默采信子级自证。**唯一停点不变**：纸迹校验在流程最终确认门之内完成，MUST NOT 在 Phase 2 追加第二次用户停顿，MUST NOT 因 `paperTrailStatus=incomplete` 自动阻断全自动管线（由流程门内的用户处置决定）。handoff 包 `## 硬约束` 为并列节，只读复用。

## Phase 2: Proposal

**⚠️ 自动执行：本阶段在 Phase 1 完成后立即开始 —— 不停顿、不宣告、不向用户提问。若你刚完成 Phase 1，下一个动作 MUST 是 Phase 2 的 2.0 步（影响分析）。禁止输出单独的「探索完成」消息 —— 直接继续进入 Phase 2 的工具调用。若你在到达此点之前结束了回复，立即从 Phase 2 继续。**

### 2.0 影响分析（自动执行，五维扩面）

**一次广查询 + 分维归集（强制，禁止逐维重复调用）**：以一次 `codegraph_explore` 广查询（主题合并、`maxFiles` ≤ 12）获取符号、文件与调用链，再按五维归集 —— MUST NOT 为每个维度单独发起查询（重复查询是 CodeGraph busy 排队的主要来源）。`codegraph_impact` 为可选增强，缺失或 busy 耗尽时降级 Grep 估算并记 WARN，MUST NOT 阻塞提案。

五维（与探索产物 `## 需求发散` 同源）：**直接影响** / **间接影响** / **契约影响**（含向后兼容）/ **同类场景** / **非功能影响**。

**结果写入位置**：
- `proposal.md` Impact: Impact Analysis 段（符号级表）+ `### 需求发散承接` 表（五维承接 → 需求 / 任务）
- `design.md` Context: Architecture Impact 段

**来源优先**：探索回执的 `explorationFile` 已含经用户确认的 `## 需求发散` 段时，MUST 以其为五维基线做增补，MUST NOT 重新发散或改写既有条目。

### 2.1 提案生成（委派 iagent-spec-propose，自动阶段）

Phase 2 的探索文件迁移与全部制品生成 SHALL 由主 agent 内联执行阶段 `iagent-spec-propose`（传 `mode=delegated` + `exploration-file=<Phase 1 探索文件路径>`）完成；MUST NOT 派发 `Agent` / `Task` 子代理（兼容窗内旧 subagent 回执记 deprecation WARN）。内联完成后再进入 Phase 3 自动验证。

**Stage Envelope**：只传 `changeName` / `changeRoot` / `explorationFile` / `handoffPackPath`（尚无时传预期路径）/ `mode` / `resume` / `configPath` / `rulesPath`；MUST NOT 内联制品正文或完整 SKILL.md。子代理先读 handoff 包（若已存在），再按需增量读取探索文件。

**回执续跑**：子代理回执 SHALL 含 `changeName` / `artifacts` / `applyReady` / `explorationFile` / `handoffPackPath` / `sourceFingerprint` / `readiness`；父级校验通过后**在同一用户回合内**进入 Phase 3，MUST NOT 以回执结束回合。**就绪门控（强制）**：`readiness.status` MUST 为 `pass` 才能推进；`fail` → 回 Phase 2 就地修复后重跑（不新增用户门）。回执缺 `readiness` 字段时 MUST 自行运行 `iagent spec validate --change "<name>" --ready` 复核，MUST NOT 默认视为通过。

**退出守卫**：被委派的 `iagent-spec-propose` 完成后 MUST NOT 自行进入实现；阶段推进主权归 `iagent-auto-workflow`。

## Phase 3: Verification

**Phase 3 在 Phase 2 制品生成完成后自动执行。需求文档桥已移除，本阶段无用户确认门。**

**handoff 包（阶段入口）**：Phase 3 起始读取 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md`（由 propose 产出）；`sourceFingerprint` 与当前制品不一致 → 重建并记 WARN，MUST NOT 静默沿用陈旧包；收尾时只向 `## 阶段结论` 追加一行（phase=verify）。

### 3.1 自动执行验证（主 agent 内联，单轮）

- 跳过方式选择提示 —— 禁止展示「Propose 方式一步生成」或类似选项
- 跳过用户选择 —— 禁止询问 [立即验证] / [跳过验证]
- 直接执行 —— 主 agent **一次**内联执行 D1-D10 + B1-B7 合并清单

### 3.2 运行验证（主 agent 内联）

- **执行方式（强制）**：Phase 3 SHALL 由**主 agent 内联**执行**一次**验证并返回 `executionMode=inline` / `independence=self`；MUST NOT 再分别派生 `iagent-spec-verify-proposal` 与 `iagent-proposal-review` 两个验证子代理（兼容窗内旧 `subagent` 回执记 deprecation WARN，下个 major 收紧为仅 `inline`）
- **固定清单（单一源渲染）**：**固定清单（D1-D10 核心维度 + B1-B7 边界）**：

1. **D1: 需求覆盖** — Decisions → 规格需求
2. **D2: 技术一致性** — 技术选型 → `design.md`（design 缺失时从 specs / proposal 取证据，双无则 SKIP）
3. **D3: 任务完整性** — 规格需求 → 任务（优先消费结构化解析结论）
4. **D4: 边界覆盖** — 问题 / 边界场景 → 规格 Scenario
5. **D5: Pending 解决** — Pending 事项 → 已解决
6. **D6-D10: 条件维度** — 交互细节 / API 契约 / 数据库映射 / 业务步骤 / 流程图节点覆盖，未触发不计分
7. **B1-B7 边界清单**：B1 自写制品自证（`independence=self` + WARN，结论必须带 `文件:行`）／B2 FAIL 同上下文修复（禁止新开代理 / 全量重读，≤3）／B3 归档内联失败沿用非阻断语义／B4 debug fix 内联共用预算 ≤3／B5 migration 上下文超限降级子代理 + WARN／B6 spec-bulk-archive 保留并行子代理（≤3）／B7 无 `delegate` 宿主仅阻断 propose/apply

> 阈值：统一 90%；Overall Score = (D1 + D2 + D3 + D4 + D5 + sum(triggered D6-D10)) / (5 + triggered_count)。
> 本清单由 `src/core/templates/verify-checklist.ts` 单一源渲染，MUST NOT 在各技能正文另写副本。
- **证据契约（强制）**：每条结论 MUST 带 `文件:行` 或制品章节锚点；**无证据的结论 MUST NOT 计入通过**；报告 MUST 落盘 `.openspec-tmp/pipeline-<change-name>/verify-report.md`，回执记 `executionMode=inline` / `independence=self` / `readScope`
- **同上下文修复重跑（强制）**：FAIL 后在同一主上下文修复并按 `fixDiff` 只重跑受影响清单项；MUST NOT 新开验证代理、MUST NOT 重读未改动制品或全量重读；循环上限 3 次，超出暂停并报告
- 计算覆盖率与总分（统一 90% 阈值）
- 从 config.yaml 的 context 探测技术栈
- 完整报告正文 MUST NOT 内联进回执；父级仅在需要时读取 `reportPath` / 验证报告文件

### 3.3 处理结果

**PASS (≥90%)**：
- 展示「验证分数 + 逐项证据摘要 + 深度复查清单结论」—— 报告质量信息，但**不再展示需求文档桥、不再请求用户确认**
- **门账本写入（委派前强制，双条件）**：仅当探索回执 `flowBaselineConfirmed=true` **且**验证 PASS（D1-D10 + B1-B7 全部收束）时，把门承载 id `design-confirmation` 写入 handoff 包 `## 已确认门` 段（`| design-confirmation | verify |`；只追加），并在**委派前校验存在**：
  - 写入失败或校验失败 → 停止并报告期望路径与原因，MUST NOT 进入 Phase 4
  - 账本条目 MUST NOT 超出本阶段回执 `confirmedGates`；本阶段回执 SHALL 携带 `confirmedGates: ['design-confirmation']`
  - 流程基准未确认或验证（含 B1-B7）未收束 → MUST NOT 写账本、MUST NOT 传 `gate-skip`，暂停并报告（fail-safe）
- **自动修复后重建包**：若验证阶段自动修复改动制品，MUST 在验证通过后按新 `sourceFingerprint` 重建 handoff 包一次；重建失败 → `incomplete`，MUST NOT 进入 Phase 4
- **自动转入 Phase 4**：在同一用户回合内继续（自动实现），不追加对该阶段技能的调用确认

**FAIL (<90%)**：
- 自动生成修复建议并在**同一主上下文**应用修复
- 按 `fixDiff` 只重跑受影响清单项（MUST NOT 新开验证代理或全量重读；循环 ≤3）
- 仍 FAIL 或超限时：[手动修改] [返回探索] [查看详细 diff]（不提供跳过验证直接实现的路径）

---
## Phase 4: Auto-Apply

**Phase 4 在 Phase 3 内联验证 PASS（D1-D10 + B1-B7）后自动执行。无用户确认门 —— 实现以 `gate-skip=design-confirmation`（兼容写法 `auto-mode=true`）运行，仅跳过设计确认门。**

**handoff 包（阶段入口）**：Phase 4 起始只读复用 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md`（MUST NOT 重新蒸馏 proposal/specs/design 重产整包）；指纹不一致 → 重建并记 WARN；收尾时只向 `## 阶段结论` 追加一行（phase=apply）；MUST NOT 另立包格式。子代理 MUST 先读该包，再按需增量读取制品。

**门账本校验（委派前强制）**：委派前校验该包的 `## 已确认门` 段与 `design-confirmation` 条目存在（Phase 3 验证 / 复查通过后已写入）。`gate-skip` 是**主通道**（权威），账本是参数丢失时的**兜底**：两者皆缺 → 被委派 apply 的设计确认门照常触发，MUST NOT 报告为「全自动无停顿」；账本写入 / 校验失败 → 停止并报告期望路径与原因，MUST NOT 继续自动委派。账本条目 MUST NOT 超出回执 `confirmedGates`（上游真源），不一致视为未确认并记 WARN。

### 4.1 自动执行实现

验证通过（≥90%，含 B1-B7）后：
- 宣告：明确标题「## Auto-Apply Phase」
- 展示：「验证通过 —— 自动进入实现阶段」
- 构造实现上下文，包含：
  - `gate-skip=design-confirmation` —— 门承载参数，跳过设计确认门（与 iagent-spec-apply 一致：Input 传该参数后跳过 Step 5.5 确认门，直接进入 Step 6 批次调度；`auto-mode=true` 为兼容等价写法）
  - `change-name` —— 来自工作流上下文的当前变更名
  - **门账本** —— 委派前已校验 handoff 包 `## 已确认门` 含 `design-confirmation`（兜底通道；`gate-skip` 为主通道），阶段回执携带 `confirmedGates: ['design-confirmation']`
- **内联执行阶段**：由主 agent 内联以 `gate-skip=design-confirmation` + `change-name` + Stage Envelope（handoff 包路径 / 门账本 / `resume`）执行 `iagent-spec-apply` 技能；MUST NOT 派生 Agent 子代理（兼容窗内旧 subagent 回执记 deprecation WARN）；被调用技能完整承载 apply 协议
  - **handoff 包** —— 唯一必读制品 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md`（六节 + 可选 `## 阶段结论`），一次性产出、跨阶段只读复用、逐批追加
  - **产出登记表** —— 包内 `## 已产出（跨单元可见）` 段，由协调器在每批之后追加
  - **最小回执** —— 固定四列回执 `<task id> | <status> | <output file> | <public signature>`，不粘贴代码正文
  - **共享指令前缀** —— 固定顺序「共享前缀（包路径 / 规范要点引用 / 回执格式 / 禁止项）→ 单元增量（任务清单）」
- Phase 4 **MUST NOT 重复声明或内联 apply 协议正文** —— 该协议的单一源留在 `iagent-spec-apply`；本技能只做委派（MUST NOT 内联执行 apply 工作流逻辑，也 MUST NOT 自定一套调度指令格式，二者都会与单一源规则矛盾）
- `gate-skip=design-confirmation` **仅**跳过设计确认门（`auto-mode=true` 为兼容写法）—— 共享资源协议继续生效（全自动语义 MUST NOT 免除它）
- **回执续跑**：子代理回执 SHALL 含 `tasksCompleted` / `compileResult` / `receipts` / `confirmedGates` / `skillsRead` / `skillsIncomplete`；父级校验通过后**在同一用户回合内**进入测试门 / Phase 5，MUST NOT 以回执结束回合；`skillsRead` 缺字段或未覆盖配置中 implement|both 技能时记 WARN 并回实现阶段补齐，MUST NOT 伪造读取
- 全部实现任务由被委派技能按其既有批次调度自动完成

### 4.2 自动实现错误处理

- **编译检查失败**（apply 自动修复 `maxRetries` 后仍为 `fail`，证据 `status=fail`）：暂停并等待用户指示 —— 不得进入归档；本技能 MUST NOT 自行执行编译（编译由 `iagent-spec-apply` 单点负责），MUST NOT 为此扩张自身白名单
- **子代理失败**：自动重试一次；重试仍失败则暂停并报告（保留产物路径，`resume=true` 时子代理跳过已完成任务）
- **子代理阻塞**（`blockedGate` / `blockedReason`）：呈现门 / 决策并等待用户；确认后写账本或 `userDecision` 并以 `resume=true` 重委派
- **用户中断**：完成当前批次，其余任务标记为未完成，然后暂停

### 4.3 继承 `iagent-spec-apply` 的**测试执行门**（自动通过）

Phase 4 继承 `iagent-spec-apply` 的测试执行门并自动通过：**仅变更范围内**；范围内测试失败自动修复重跑至多 3 次；**自动单测补齐子阶段（强制）**；**降级二分（strict / 显式 degraded）**；不测清单留痕；MUST NOT 委派需求文档技能；范围、out-of-scope WARN、无测试框架 WARN 跳过、`test-report.md` 汇总行口径**以该技能 §9 为唯一源**，本技能不复述。MUST NOT 跳过该门，MUST NOT 在 auto-workflow 内另立判定。

**自动单测补齐**：编译检查放行后、测试门前，由主 agent 内联调用 `iagent-test` 补齐未被 `[测试]` 任务覆盖的有行为改动文件；不测清单判定留痕；缺口只登记 handoff `## 已产出` 与 `test-report.md`。`testGate.autoGenerate=false` → 显式 degraded 留痕，记录「自动补测已由项目配置关闭」；`iagent-test` 不可用 → strict 阻断；MUST NOT 表述为「已测试」。

**测试证据**：只读 `.openspec-tmp/pipeline-<change-name>/test-report.md` 的 `**summary**:` 行；`pass` / `not-applicable` / `disabled` 放行，`fail` / 缺失阻断归档。测试门失败时不得静默通过，MUST NOT 静默通过，MUST NOT 进入归档；范围内的测试门失败 MUST 在归档前暂停。

### 4.4 实现验证桥（主 agent 内联，强制）

**实现一致性门（前置）**：测试门通过后运行 `iagent spec conformance --change "<name>" --strict --json` 并写 `conformance-report.md`；`fail` / 证据缺失 → 暂停，MUST NOT 进入验证桥或归档。

一致性门通过后，主 agent 内联调用 `iagent-spec-verify` 校验实现与制品（`executionMode=inline` / `independence=self`），先读 handoff 包；结论含验证摘要与可选 `reportPath`。验证通过 → Phase 5；失败 → 回 Phase 4 修复；技能不可用 → 记录 WARN 与省略决策，MUST NOT 静默跳过。

- **⛔ EXIT GUARD（子代理调度）**：仅 Phase 2 propose / Phase 4 apply 的子代理调度指令携带退出守卫；子代理完成即返回回执，MUST NOT 进入 plan / 设计模式或越权推进阶段。
- **MUST FIRST 读 handoff 包**：子代理先读 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md`，再做增量查询。

### 4.5 实现后 review 环节（主 agent 内联，强制）

P0/P1 未修复 → strict 阻断并报告并回 Phase 4；P2 问题记录不阻断。

实现验证桥通过后、Phase 5 归档确认门前，主 agent 内联调用 `iagent-review`（`executionMode=inline` / `independence=self`）；报告落盘 `.openspec-tmp/pipeline-<change-name>/review-report.md`，汇总行 `**summary**: pass|not-applicable|fail`，纳入归档就绪检查。P0/P1 回 Phase 4 修复循环（与编译/测试共用 ≤3 预算），未收束 MUST NOT 进入归档门；P2 记录不阻断；无代码改动 → `not-applicable` 留痕。`iagent-review` 不可用（未经显式 degraded 协商）→ strict 阻断，MUST NOT 伪装修复完成。

---
## Phase 5: Auto-Archive（自动执行至归档确认门）

**Phase 5 在 Phase 4（自动实现 + 测试门 + 实现验证桥）完成后自动执行证据就绪检查（§5.1），随后呈现 ⛔ 归档确认门（§5.2）—— 用户确认功能完成后才执行归档（§5.3）；拒绝/含糊 = 返回实现阶段（不归档）。**

### 5.1 归档前置证据就绪检查（只读）

进入归档确认门前，只读 `.openspec-tmp/pipeline-<change-name>/` 下四份证据的 `**summary**:` 行：`compile-report.md`（`{pass, not-applicable, disabled}` 放行，后两者记 WARN 且不得表述为通过）、`test-report.md`（同上）、`conformance-report.md`（`pass` 放行）、`review-report.md`（`pass|not-applicable` 放行）；任一 `fail`、缺失或不可解析 → 暂停并报告，MUST NOT 呈现归档确认门、MUST NOT 自动归档。本技能不执行编译/测试/一致性/review 命令，也不询问用户是否跳过。证据文件完整路径：`.openspec-tmp/pipeline-<change-name>/compile-report.md` / `.openspec-tmp/pipeline-<change-name>/test-report.md` / `.openspec-tmp/pipeline-<change-name>/conformance-report.md` / `.openspec-tmp/pipeline-<change-name>/review-report.md`；后两者记 WARN 并说明「未执行编译检查」，MUST NOT 表述为「编译检查通过」；任一 fail、缺失或无法解析 → 暂停并向用户报告。

### 5.2 归档确认门（⛔ GATE，用户确认功能完成）

四份证据就绪后 **MUST 暂停**呈现归档确认门（门白名单类别：归档桥 `archive-confirmation`，不可豁免；门语义对齐 `iagent-workflow` §5.1 蓝本），等待用户确认，呈现内容包含：

- **实现摘要** —— 变更做了什么（proposal 变更摘要）、主要实现文件与任务完成情况
- **三类证据** —— compile / test / conformance 证据的 summary 状态与关键数字
- **测试结果** —— 范围内测试通过情况（新增与既有）
- **review 结论** —— review-report.md 的 summary 与 P2 记录（如有）

出口（MUST NOT 提供「跳过归档」选项）：

- **确认功能完成** → 进入 §5.3 执行归档，不再追加其它停点
- **拒绝** → 返回实现阶段继续（不归档）
- **含糊回复**（未给出具体确认项）→ 按拒绝处理，MUST NOT 猜测意图为确认
- **等待期间用户中断** → 保持暂停不归档；resume 时重新呈现本门（确认门无超时跳过）

### 5.3 执行归档（门确认后自动）

确认后立即执行：
- 宣告：明确标题「## Auto-Archive Phase」
- 展示：「功能已确认 —— 自动进入归档阶段」
- 构造归档上下文，包含：
  - `change-name` —— 当前变更名（跳过变更选择提示）
  - **Stage Envelope** —— handoff 包路径 / `compile-report.md` 路径 / `resume`；MUST NOT 内联制品正文
- **主 agent 内联执行归档**：以 `change-name` 由主 agent 内联执行 `iagent-spec-archive` 的归档协议（`executionMode=inline`，MUST NOT 派生归档子代理；兼容窗内旧 `subagent` 回执记 deprecation WARN）；归档协议（delta spec 同步、CONTEXT.md 同步、CodeGraph 检查、探索记忆同步、目录移动、归档索引维护——根入口 `ARCHIVE-INDEX.md` 的月份导航 + 全局模块统计与当月月度索引 `ARCHIVE-INDEX-YYYY-MM.md` 的纯追加、归档只读校验、流程级工作区清理）—— 本技能 MUST NOT 重复声明或内联该协议正文
- 全部归档步骤在内联执行的 `iagent-spec-archive` 协议内部自动完成
- **回执续跑**：内联执行结果 SHALL 含 `archivePath` / `specsSynced`；父级校验通过后完成流程

### 5.4 自动归档错误处理

- **delta spec 同步冲突**：以冲突标记自动合并（非阻断）
- **CONTEXT.md 同步失败**：记录 warning 并继续（非阻断）
- **CodeGraph 未初始化**：跳过 CodeGraph 步骤并继续（非阻断）
- **探索记忆同步失败**：记录 warning 并继续（非阻断）
- **归档目标已存在**：以错误失败，建议改名

### 5.5 完成

自动归档完成后：
- 展示含全部阶段的完整完成摘要
- 显示："## Auto-Workflow Complete ✓"

---
## Guardrails

- **不要跳过追问** —— 一直问到真正清晰为止。
- **提示词门与流程门是强制检查点** —— spec_explore 的提示词门 / 流程最终确认门各有四条出口，不得死锁；全自动语义不构成跳过理由。
- **流程基准是唯一锚点** —— 确认后的功能流程图供 propose/verify 使用；遗漏节点回 explore 更新并重新确认，MUST NOT 在 tasks 静默补节点。
- **只读操作直接执行** —— 文件读取、CodeGraph 查询与影响分析无需确认；只读直通不覆盖澄清门。
- **验证一次内联完成** —— D1-D10 + B1-B7 一次跑完，每条结论带 `文件:行` 证据；FAIL 同上下文按 fixDiff 增量重跑 ≤3，禁止新开验证代理或全量重读。
- **门账本双条件** —— 流程基准确认且验证 PASS + 深度复查收束后才写 `design-confirmation`；未满足时不得写账本、不得传 `gate-skip`。
- **FAIL 不进入实现** —— 验证 FAIL 或 B1-B7 未收束时 MUST NOT 进入 Phase 4。
- **Phase 4 只跳过设计确认门** —— 共享资源协议、退出守卫与其余门照常生效。
- **测试门 / 自动补测 / 一致性门 / review 不得跳过** —— 证据缺失或 `fail` 阻断归档；判定口径以子技能为唯一源。
- **归档确认门不可跳过** —— 四份证据就绪后呈现归档门；拒绝/含糊回实现阶段，不提供「跳过归档」选项。
- **回执续跑** —— 每个委派阶段回执是中间状态，父级在同一用户回合内继续；回执不作为最终消息；停点前引用门白名单类别 id 或锚点 id。
- **子代理数据共享** —— 只传 Stage Envelope（路径 + 结构化字段）；子代理先读 handoff 包；回执 ≤40 行 / ≤2KB；blocked 用 `blockedGate` / `blockedReason` + `resume=true`。
- **MUST 先建探索文件再追问** —— Phase 1 检查点；迁移前校验，迁移失败保留源文件。
- **Phase 2 不提供方式选择** —— 直接内联 propose；制品遵循 Markdown-first。
- **MUST NOT 进入 plan 模式** —— 子代理完成分配任务后立即返回回执；MUST FIRST 读 handoff 包。

