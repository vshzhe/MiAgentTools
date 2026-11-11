---
name: iagent-auto-workflow
description: "一站式全自动工作流：探索→提案→验证→自动实现→自动归档，L1-L5 与流程最终确认后全自动（无需求文档桥）；触发词\"全自动工作流 / auto workflow / fully automated pipeline\"。当用户需要完全自动化、无需手工 apply/archive 步骤的管道时使用；NOT for 交互式引导工作流（改用 iagent-workflow）。"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(iagent:*), Bash(npm:*), Bash(pnpm:*), Bash(node:*), Bash(mvn:*), Bash(gradle:*), Bash(ant:*), Bash(go:*), Bash(cargo:*), Bash(git:*), Bash(ls:*), Bash(mv:*), mcp__codegraph, mcp__codegraph__codegraph_status, mcp__codegraph__codegraph_files, mcp__codegraph__codegraph_search, mcp__codegraph__codegraph_context, mcp__codegraph__codegraph_node, mcp__codegraph__codegraph_callers, mcp__codegraph__codegraph_callees, mcp__codegraph__codegraph_impact, mcp__codegraph__codegraph_explore, Skill(iagent-spec-explore), Skill(iagent-spec-propose), Skill(iagent-spec-verify-proposal), Skill(iagent-proposal-review), Skill(iagent-spec-apply), Skill(iagent-spec-verify), Skill(iagent-test), Skill(iagent-spec-archive)
license: MIT
compatibility: 依赖 iagent CLI（spec 命令组）与 spec 系列技能（iagent-spec-apply / iagent-spec-archive）；CLI 缺失时降级为 AI 内联生成。
metadata:
  author: mi-agent-tools
  type: impl
  generatedBy: "snapshot"
  generatedFingerprint: "sha256:5e923d9654e244aa876fdb6a246f35f33799e5d6f67e5bc3ee04b3b83e908e7b"
---


**适用项目护栏（impl 域蒸馏，见 .iagent/rules/coding-rules.md）。** 未定义项标 **[待确认]**，禁止猜测。

一站式全自动工作流：从探索到归档。

**输入**：`/iagent:auto-workflow` 后可跟用户想构建的主题描述。缺失的参数交互式收集；已提供的参数跳过。

该工作流引导你依次完成：
1. **探索阶段** —— 常驻探索文件 + grill-with-docs 追问（L1-L5 用户确认）
2. **提案阶段** —— 生成变更及其全部制品（自动）
3. **验证阶段** —— 主 agent 单轮内联质量校验（D1-D10 + B1-B7 + 证据）；不再有需求文档桥
4. **自动实现阶段** —— 验证通过后不设确认门，直接自动实现
5. **自动归档阶段** —— 完成后自动归档

## 门白名单与 MUST NOT 确认清单

**本技能不承载阻塞阶段门；以下为父流程门白名单，仅负向清单对本技能停点生效**：
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

分级执行：Phase 1 / Phase 2 提案 / Phase 3 验证 / Phase 4 实现 / Phase 5 归档均由主 agent 内联（`executionMode=inline`）；仅 `spec-bulk-archive` 内部并行单元保留子代理。验证**一次**完成（合并 D1-D10 + B1-B7 清单），MUST NOT 派生验证子代理。兼容窗：propose / apply / verify / archive 的旧 `subagent` 回执记 deprecation WARN 并允许推进，下个 major 收紧。增量复验：验证 FAIL 后**在同一主上下文**按 fixDiff 增量重跑清单（≤3 次），禁止新开验证代理、禁止重读未改动制品与全量重读；禁止 resume 充当复验（contextReplay=true 记 WARN）。只读验证以固定清单 + 每条结论 `文件:行` 证据 + 报告落盘承担可信度。iagent-test 为 Phase 4 条件子阶段（主 agent 内联调用）。内联执行前先读 handoff 包「## 制品清单」并按锚点增量读取，回执写 readScope；「## 阶段结论」5 列（tokens 可用时填 tokens=<数值>，不可得填 —）。

## Phase 1: Exploration（委派 iagent-spec-explore，交互阶段）

Phase 1 SHALL 由主 agent 内联委派阶段 `iagent-spec-explore`（传 `mode=delegated`）执行强制检查点体系探索（强制建探索文件、**项目规则基线**、**项目技能基线**、提示词校验门、CONTEXT.md 检查、CodeGraph 基础扫描含多项目派发与深度分析、L1-L5 grill 追问、功能流程图与流程最终确认门、聚合一致性门、探索完成检测），MUST NOT 内联执行探索逻辑。探索是**交互阶段**，MUST NOT 放入隔离子代理（提示词门 / 流程门需与用户交互）；回执 SHALL 携带技能基线状态，供 propose 与实现阶段读取。

委派完成后 SHALL 消费 `iagent-spec-explore` 输出的**结构化 handoff**（探索文件路径、提示词基线、流程基准确认状态 `flowBaselineConfirmed`、Pending 影响符号），并**在同一用户回合内**推进 Phase 2 —— 回执是中间状态，MUST NOT 以回执结束回合。

**Stage Envelope**：委派时只传路径与结构化字段（`changeName` / `explorationFile` / `configPath` / `rulesPath` / `mode` / `resume`），MUST NOT 内联制品正文或完整 SKILL.md。

**退出守卫**：被委派的 `iagent-spec-explore` 完成后 MUST NOT 自行进入提案或实现；阶段完成判定与推进主权归编排器。

**纸迹衔接口径（探索→提案）**：`exploration.md` 是**唯一过桥载体**——Phase 2 委派 MUST 传 `explorationFile`，MUST NOT 以父级对话摘要、回执正文或临时记忆替代。探索回执的 `flowBaselineConfirmed` / `paperTrailStatus` 原样记录并透传（MUST NOT 改写；字段缺失时 MUST NOT 静默补默认值）。**父级复核纸迹自证**：收到 `paperTrailStatus=complete` 时至少核对一次 `exploration.md` 的 Decisions / 术语表 / ADR 三项（存在或有显式「无」字面量），核对不一致记 WARN 并按实际值透传，MUST NOT 静默采信子级自证。**唯一停点不变**：纸迹校验在流程最终确认门之内完成，MUST NOT 在 Phase 2 追加第二次用户停顿，MUST NOT 因 `paperTrailStatus=incomplete` 自动阻断全自动管线（由流程门内的用户处置决定）。handoff 包 `## 硬约束` 为并列节，只读复用。

## Phase 2: Proposal

**⚠️ 自动执行：本阶段在 Phase 1 完成后立即开始 —— 不停顿、不宣告、不向用户提问。若你刚完成 Phase 1，下一个动作 MUST 是 Phase 2 的 2.0 步（影响分析）。禁止输出单独的「探索完成」消息 —— 直接继续进入 Phase 2 的工具调用。若你在到达此点之前结束了回复，立即从 Phase 2 继续。**

### 2.0 影响分析（自动执行）

Pending 段含符号时，逐个符号运行影响分析：
```bash
mcp__codegraph__codegraph_impact --symbol <symbol> --direction upstream
```

**多符号并行执行**：识别出两个及以上影响符号时，在单轮回复中并行发起影响查询（多个工具调用）。全部结果合并写入制品的对应影响段；单个符号维持现有的单次查询行为。

**结果写入位置**：
- `proposal.md` Impact: Impact Analysis 段
- `design.md` Context: Architecture Impact 段

### 2.1 提案生成（委派 iagent-spec-propose，自动阶段）

Phase 2 的探索文件迁移与全部制品生成 SHALL 由主 agent 内联执行阶段 `iagent-spec-propose`（传 `mode=delegated` + `exploration-file=<Phase 1 探索文件路径>`）完成；MUST NOT 派发 `Agent` / `Task` 子代理（兼容窗内旧 subagent 回执记 deprecation WARN）。内联完成后再进入 Phase 3 自动验证。

**Stage Envelope**：只传 `changeName` / `changeRoot` / `explorationFile` / `handoffPackPath`（尚无时传预期路径）/ `mode` / `resume` / `configPath` / `rulesPath`；MUST NOT 内联制品正文或完整 SKILL.md。子代理先读 handoff 包（若已存在），再按需增量读取探索文件。

**回执续跑**：子代理回执 SHALL 含 `changeName` / `artifacts` / `applyReady` / `explorationFile` / `handoffPackPath` / `sourceFingerprint`；父级校验通过后**在同一用户回合内**进入 Phase 3，MUST NOT 以回执结束回合。

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
- **固定清单**：D1-D10 核心维度（D1 需求覆盖 / D2 技术一致性 / D3 任务完整性 / D4 边界覆盖 / D5 Pending 解决 / D6-D10 条件维度）+ B1-B7 边界清单（自证 WARN、同上下文修复、归档非阻断、fix 预算、migration 阈值、bulk 并行、无 delegate 宿主边界）
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

### 4.3 测试执行门（继承自 iagent-spec-apply §9，自动通过）

Phase 4 继承 `iagent-spec-apply` 的**测试执行门**并**自动**通过 —— 全自动管线 MUST NOT 跳过该门，也 MUST NOT 把它当作「无需确认因此无需跑测试」：

- 范围：**仅变更范围内** —— 本次变更 `[测试]` 任务产出的测试，以及覆盖被改文件的既有测试
- **范围内测试通过** → 自动通过并进入 Phase 5
- **变更范围外的既有失败** → 仅报告 WARN；MUST NOT 计入本次变更的失败，MUST NOT 阻断
- **范围内测试失败** → 自动修复并重跑，至多 3 次尝试（与编译检查同一预算）
- **3 次尝试后仍失败** → 暂停并向用户报告。MUST NOT 静默通过，MUST NOT 进入归档
- 项目无测试框架 → 记录 WARN，跳过该门，继续

**自动单测补齐子阶段（强制，受 `testGate.autoGenerate` 控制）**：编译检查放行后、测试执行门前，由主 agent 内联调用 `iagent-test` 对变更范围内未被 `[测试]` 任务覆盖的有行为改动文件补齐单测（不测清单判定 MUST 留痕；自动管线中其测试计划门自动采用推荐计划并记 WARN）。MUST NOT 静默增删 `tasks.md` 任务；缺口测试只登记到 handoff 包 `## 已产出`。`testGate.autoGenerate=false` 时跳过并记录配置关闭；`iagent-test` 不可用 → WARN + 记录「未发生内联技能调用」，MUST NOT 伪装。内联调用返回后 MUST 在同一用户回合内继续测试门判定。

**测试证据**：测试门结束后只读 `.openspec-tmp/pipeline-<change-name>/test-report.md` 的 `**summary**:` 行（`pass` / `not-applicable` / `disabled` 放行；`fail` / 缺失阻断归档），MUST NOT 在 auto-workflow 内另立判定。

### 4.4 实现验证桥（主 agent 内联，强制）

**实现一致性门（前置，强制）**：测试门通过后，主 agent MUST 运行 `iagent spec conformance --change "<name>" --strict --json` 并写 `conformance-report.md`；校验三层覆盖（Requirement/Scenario→任务、勾选任务→产出证据、Scenario→`[测试]` 任务）与回执 `rulesRead` 对规则源 `exists=true` 集合的覆盖。`fail` / 证据缺失 → 暂停并报告，MUST NOT 进入验证桥或归档。

一致性门通过后，MUST 由**主 agent 内联**调用 `iagent-spec-verify` skill 校验实现与制品（specs/tasks/design）的一致性（`executionMode=inline` / `independence=self`）；先读 handoff 包，结论含验证结果摘要与可选 `reportPath`；MUST NOT 为新的验证执行派生 Agent 子代理：

- **验证通过** → 在同一用户回合内进入 Phase 5（自动归档）
- **验证失败** → 回到 Phase 4 修复；MUST NOT 进入归档
- **降级（`iagent-spec-verify` 不可用）**：记录 WARN 并显式记录省略决策（「实现验证由 apply 编译检查 + 归档一致性承担」）—— MUST NOT 静默跳过

- **⛔ EXIT GUARD (强制 — 子代理退出守卫)**：每条**子代理**调度指令（仅 Phase 2 propose / Phase 4 apply）MUST 携带退出守卫 —— 完成分配任务后立即停止并返回回执，MUST NOT 进入 plan 模式 / 设计模式 / 提出后续步骤 / 超出分配范围继续；编排器是唯一有权判停、汇总、推进阶段的角色；子代理 MUST NOT 越权替代编排器做阶段收尾决策
- **MUST FIRST 先读取 handoff 包**：子代理调度指令 MUST 强制子代理在任何其他动作之前先读 handoff 包（`.openspec-tmp/pipeline-<change-name>/handoff-pack.md`）—— MUST NOT 重读 proposal/specs/design 或重跑包已覆盖的 CodeGraph 查询；仅做增量查询

---
## Phase 5: Auto-Archive

**Phase 5 在 Phase 4（自动实现）完成、编译证据放行（§5.1）、测试门通过、且实现验证桥（§4.4）通过或已显式省略后自动执行。无额外用户确认。**

### 5.1 自动归档前置（只读编译证据）与执行归档

**证据就绪（唯一判据，强制）**：进入归档前读取 `.openspec-tmp/pipeline-<change-name>/` 下三份证据的 `**summary**:` 行（handoff 包 `## 阶段结论` 的 `compile` / `test` / `conformance` 行仅作辅助，不一致时以证据文件为准并记 WARN）：

- `.openspec-tmp/pipeline-<change-name>/compile-report.md`：`status ∈ {pass, not-applicable, disabled}` → 放行；后两者记 WARN 并说明「未执行编译检查」，MUST NOT 表述为「编译检查通过」
- `.openspec-tmp/pipeline-<change-name>/test-report.md`：`status ∈ {pass, not-applicable, disabled}` → 放行；后两者记 WARN 并说明未执行测试
- `.openspec-tmp/pipeline-<change-name>/conformance-report.md`：`status=pass` → 放行
- 任一证据 `fail`、缺失或汇总行无法解析 → **MUST NOT 自动归档**：暂停并向用户报告（含期望路径与失败原因），回到 Phase 4 修复
- 本技能 MUST NOT 自行执行编译、测试或一致性命令，MUST NOT 因证据缺失而询问用户是否跳过

就绪（验证桥通过或已显式省略）后：
- 宣告：明确标题「## Auto-Archive Phase」
- 展示：「实现完成 —— 自动进入归档阶段」
- 构造归档上下文，包含：
  - `change-name` —— 当前变更名（跳过变更选择提示）
  - **Stage Envelope** —— handoff 包路径 / `compile-report.md` 路径 / `resume`；MUST NOT 内联制品正文
- **主 agent 内联执行归档**：以 `change-name` 由主 agent 内联执行 `iagent-spec-archive` 的归档协议（`executionMode=inline`，MUST NOT 派生归档子代理；兼容窗内旧 `subagent` 回执记 deprecation WARN）；归档协议（delta spec 同步、CONTEXT.md 同步、CodeGraph 检查、探索记忆同步、目录移动、归档索引维护——根入口 `ARCHIVE-INDEX.md` 的月份导航 + 全局模块统计与当月月度索引 `ARCHIVE-INDEX-YYYY-MM.md` 的纯追加、归档只读校验、流程级工作区清理）—— 本技能 MUST NOT 重复声明或内联该协议正文
- 全部归档步骤在内联执行的 `iagent-spec-archive` 协议内部自动完成
- **回执续跑**：内联执行结果 SHALL 含 `archivePath` / `specsSynced`；父级校验通过后完成流程

### 5.2 自动归档错误处理

- **delta spec 同步冲突**：以冲突标记自动合并（非阻断）
- **CONTEXT.md 同步失败**：记录 warning 并继续（非阻断）
- **CodeGraph 未初始化**：跳过 CodeGraph 步骤并继续（非阻断）
- **探索记忆同步失败**：记录 warning 并继续（非阻断）
- **归档目标已存在**：以错误失败，建议改名

### 5.3 完成

自动归档完成后：
- 展示含全部阶段的完整完成摘要
- 显示："## Auto-Workflow Complete ✓"

---
## Guardrails

- **不要跳过追问** —— 一直问到真正清晰为止
- **MUST 在探索前校验提示词** —— 委派的 spec_explore（delegated）提示词校验门是强制检查点：清晰输入一句话复述理解后直通；不明确输入须先做提示词优化并等待用户确认或修改，未确认前 MUST NOT 推进到后续步骤
- **全自动语义不得跳过澄清门** —— 委派的 spec_explore 提示词门是澄清门（确认 WHAT），管线为全自动不构成跳过理由；基线确认是自动化的起点
- **不得在确认门上死锁** —— 委派的 spec_explore 提示词门有四条出口（确认 / 修改 / 拒绝后按原理解继续 / 显式授权按推断继续），不得反复要求确认
- **持久化提示词基线** —— 原始提示词与确认后的基线一并写入探索文件 `## 提示词基线` 段；基线变更 MUST 回到委派的 spec_explore 提示词门重新确认
- **MUST 产出功能流程图** —— 委派的 spec_explore 流程最终确认门是强制检查点：探索分析完成后 MUST 产出探索文件 `## 功能流程图` 段（Mermaid + 节点清单）并执行流程最终确认门；确认前 MUST NOT 进入完成检测，MUST NOT 把未确认流程图当作 propose 锚点
- **全自动语义不得跳过流程确认门** —— 委派的 spec_explore 流程最终确认门是确认门（确认流程基准），管线为全自动不构成跳过理由；流程基准的确认是自动化的前置条件
- **不得在流程门上死锁** —— 委派的 spec_explore 流程确认门有四条出口（确认 / 修改 / 拒绝后记录未确认状态并按原理解继续 / 显式授权按推断继续），拒绝时 propose 降级为仅凭 exploration.md、verify 节点覆盖度维度 SKIP，不得反复要求确认
- **MUST NOT 在 tasks 中静默补流程图节点** —— 发现遗漏节点 MUST 回到委派的 spec_explore 更新流程图并重新经用户确认，MUST NOT 在 tasks.md 中静默补节点
- **硬冲突时不得自动推进** —— 1.6 一致性检查通过时阶段自动推进（一致性直通）；仅在检测到硬冲突时询问用户
- **只读操作直接执行** —— 文件读取、CodeGraph 查询与分析步骤（影响分析）无需用户确认即可运行
- **只读直通不覆盖澄清门** —— grill L1-L5 需求澄清门仍等待用户确认
- **自动验证** —— 提案后无需用户提示即自动验证
- **验证通过后自动实现** —— Phase 4 以 `gate-skip=design-confirmation` 自动执行（跳过 iagent-spec-apply Step 5.5 门；`auto-mode=true` 为兼容写法）
- **实现完成后自动归档** —— Phase 5 自动执行，变更名由上下文传入（遵循 iagent-spec-archive 技能模板）
- **继承并自动通过测试执行门** —— Phase 4 执行 iagent-spec-apply §9 且仅限变更范围内；范围内失败自动重试至多 3 次，随后暂停并报告；既有的变更范围外失败仅 WARN；项目无测试框架 → WARN 并跳过
- **自动单测补齐不得跳过** —— 测试门前 MUST 对未被 `[测试]` 任务覆盖的有行为改动文件补齐单测（`testGate.autoGenerate` 默认 true）；不测清单判定 MUST 留痕，MUST NOT 静默增删 tasks.md 任务
- **实现一致性门不得跳过** —— 测试门后 MUST 运行 `iagent spec conformance --strict` 并校验 `rulesRead`；`fail` / 证据缺失 MUST NOT 进入验证桥或归档
- **三类证据缺失即阻断** —— 归档前 MUST 读取 `compile-report.md` / `test-report.md` / `conformance-report.md` 的汇总行；任一缺失或 `fail` MUST NOT 归档
- **测试门失败时不得静默通过** —— 范围内的测试门失败 MUST 在归档前暂停；全自动语义绝不构成跳过该门或跳过归档阻断的理由
- **深度复查后直接续跑** —— 全部通过后内联调用 `iagent-proposal-review` 做深度复查（不可用则本地深度复查 + WARN），展示「验证分数 + 复查结论」后**在同一用户回合内**自动转入 Phase 4；MUST NOT 展示需求文档桥、MUST NOT 委派需求文档技能
- **验证阶段无阻塞门** —— 三父流程的需求文档桥已整体移除；验证阶段 MUST NOT 声明阻塞门，MUST NOT 追加对下一阶段技能的调用确认（宿主权限与 strict/degraded 检查仍独立生效）
- **门账本双条件** —— 仅在流程基准确认 **且** 验证 PASS + 深度复查收束后写 `design-confirmation`；未满足时 MUST NOT 写账本、MUST NOT 传 `gate-skip`，暂停并报告
- **FAIL 不进入实现** —— 验证 FAIL 或 B1-B7 未收束时 MUST NOT 进入 Phase 4
- **回执续跑** —— 每个委派阶段返回有效回执后 MUST 在同一用户回合内继续下一阶段；MUST NOT 以回执结束回合；回执 MUST NOT 作为面向用户的最终消息（用户可见至多一行进度），停点前 MUST 引用门白名单的类别 id 或锚点 id
- **子代理数据共享** —— 只传 Stage Envelope（路径 + 结构化字段），MUST NOT 内联制品正文或完整 SKILL.md；子代理先读 handoff 包，回执只含 Stage Receipt（≤40 行 / ≤2KB）；blocked 时用 `blockedGate` / `blockedReason` + `resume=true`
- **MUST 先建探索文件再追问** —— Phase 1 检查点为强制
- **MUST 迁移前校验文件** —— Phase 2 检查点为强制
- **MUST 迁移失败时保留源文件** —— 绝不丢失用户数据
- **MUST NOT 提供方式选择** —— Phase 2 直接委派 propose 生成
- **Phase 2 MUST 遵循 Markdown-first 协议** —— 内联生成 MUST 遵循项目侧制品协议 `.iagent/rules/spec.md`（缺失时以本步内联要点为准并记 WARN，MUST NOT 阻断）：写入 Markdown 真源（proposal.md / specs/**/*.md / design.md / tasks.md）→ `iagent spec validate --change "<name>"` → 校验失败则修正 Markdown 并重跑；校验不可用则产出 WARN
- **先探索代码库** —— 提问前先看代码库能否回答该问题
- **给出推荐** —— 每个问题都附 AI 的推荐
- **实时更新文件** —— 每轮交互后即时写入探索文件
- **使用结构化格式** —— Background、Questions、Decisions、Pending 段
- **展示量化评分** —— 验证结果包含覆盖率百分比
- **注入能力记忆** —— Phase 1 在存在时读取 specs/<capability>/explorations.md
- **用 CodeGraph 扫描其他项目** —— 探索上下文含其他项目路径时，由探索阶段主 agent 用 CodeGraph 的 projectPath 参数串行扫描；失败时降级为 Glob/Grep
- **不丢失探索内容** —— 即使放弃探索文件也保留（除非被删除）
- **MUST NOT 进入 plan 模式** —— 子代理完成分配任务后 MUST NOT 进入 plan 模式 / 设计模式 / 提出后续步骤；Phase 4 的门承载参数仅跳过设计确认门，MUST NOT 免除退出守卫或共享资源协议
- **MUST FIRST 读取共享 handoff 包** —— 子代理 MUST 先读 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md` 再做增量查询；MUST NOT 绕过包重读 proposal/specs/design 或重跑已覆盖的 CodeGraph 查询

