## REMOVED Requirements

### Requirement: workflow 结构化探索阶段
**Reason**: 该需求要求 `iagent_workflow` 以强制 checkpoint 体系**内联**执行探索（强制建探索文件、提示词门、CONTEXT.md、CodeGraph 扫描、L1-L5 grill、聚合一致性门、完成检测），与 `iagent_auto_workflow` Phase 1 及 `iagent_spec_explore` 重复，构成探索阶段的结构性不一致来源。历史内联动机（"无 Skill 委派断层"）经探索确认为可解：断层实质是子技能的阶段推进会中断编排器，可由委派执行模式（`delegated`）让出阶段主权解决。
**Migration**: 探索强制 checkpoint 体系移交 `iagent_spec_explore` 的 `delegated` 模式（见 `spec-workflow-skills / spec-explore 委派执行模式（delegated）契约`）；`workflow` Phase 1 改为委派调用（见新增需求 `workflow 探索阶段委派 spec-explore`）。

## ADDED Requirements

### Requirement: workflow 探索阶段委派 spec-explore

`iagent_workflow` 的 Phase 1 SHALL 经 Skill 工具**委派** `iagent_spec_explore`（传 `mode=delegated`）执行强制 checkpoint 体系探索（强制建探索文件、提示词校验门、CONTEXT.md 检查、CodeGraph 基础扫描含多项目派发与深度分析、L1-L5 grill 追问、功能流程图与流程最终确认门、聚合一致性门、探索完成检测），MUST NOT 内联执行探索逻辑。

委派 SHALL 消费 `spec_explore` 输出的**结构化 handoff**（探索文件路径、提示词基线、流程基准确认状态、Pending 影响符号），并据此推进 Phase 2（Phase 2 由 `spec_propose` 委派承载）。

委派 SHALL 遵守退出守卫：被委派的 `iagent_spec_explore` 完成后 MUST NOT 自行进入提案或实现；阶段完成判定与推进主权归 `iagent_workflow`。`workflow` 的 `allowedTools` MUST 含 `Skill(spec_explore)` 条目。

#### Scenario: 探索阶段委派而非内联

- **WHEN** `iagent_workflow` 启动并进入 Phase 1
- **THEN** 系统经 Skill 工具委派 `iagent_spec_explore`（传 `mode=delegated`），MUST NOT 内联执行建文件/扫描/grill/聚合门等探索逻辑

#### Scenario: 消费结构化 handoff

- **WHEN** 委派的 `spec_explore`（delegated）返回结构化 handoff
- **THEN** `workflow` SHALL 消费 handoff（探索文件路径、提示词基线、流程基准确认状态、Pending 影响符号）并据此推进 Phase 2；流程基准未确认时按既有降级规则（仅凭 exploration.md）推进

#### Scenario: 探索阶段阶段主权归编排器

- **WHEN** 委派的 `spec_explore`（delegated）完成探索
- **THEN** `spec_explore` MUST NOT 自行进入提案或实现；`workflow` 是唯一有权判定 Phase 1 完成并推进 Phase 2 的角色

## MODIFIED Requirements

### Requirement: auto-workflow 全自动管线

技能 `iagent_auto_workflow` SHALL 执行五阶段全自动管线：Phase 1 经 Skill 工具委派 `iagent_spec_explore`（`mode=delegated`）执行强制 checkpoint 体系探索，Phase 2 经 Skill 工具委派 `iagent_spec_propose`（`mode=delegated` + `exploration-file`）生成提案，Phase 3 自动验证（**探索文件迁移后删除源文件**）；Phase 4 验证通过后自动进入 auto-apply（构建 `auto-mode=true` + change-name 上下文，执行 `iagent_spec_apply` 的 Step 6+ 批次调度行为，跳过设计确认门）——**MUST NOT 以需求文档生成为前置**；Phase 5 apply 完成且编译检查通过后自动进入 auto-archive（构建 change-name 上下文跳过变更选择提示，执行 `iagent_spec_archive` 模板全部步骤：delta spec 合并、CONTEXT.md 同步、CodeGraph 检查、探索记忆同步、**需求文档生成（存在性判定 → 委派 `iagent_requirement_doc` 生成 / 就地增量对齐，失败 WARN 非阻断）**、目录移动、需求文档迁移至 devdocs、ARCHIVE-INDEX.md 更新）。错误处理 MUST 遵守：编译检查失败经 3 次自动修复尝试后暂停等待用户指令不进归档；子代理失败自动重试一次、再失败暂停报告；用户中断时完成当前批次、剩余任务标记未完成后暂停；归档 delta spec 冲突带标记自动合并（非阻塞）；CONTEXT.md/探索记忆同步失败 WARN 继续；需求文档生成或对齐失败 WARN 继续；CodeGraph 未初始化跳过继续；归档目标已存在报错建议改名。

委派的 `iagent_spec_explore`（delegated）SHALL 在与 workflow 同构的位置（Phase 1.1.2，探索文件创建之后、CONTEXT.md 检查与代码库扫描之前）执行同一**提示词校验门**（需求六维自检、清晰直通、不明确优化并阻塞确认、软不明确记 `[假设]`、`无需`/`提示词基线` 落盘规则与 workflow 完全一致）。该门是**澄清门（确认 WHAT）**，MUST NOT 因管线的 auto 语义被跳过或静默通过——自动化的起点在 Baseline 确认之后，而非之前。

委派的 `iagent_spec_explore`（delegated）SHALL 在与 workflow 同构的位置（Phase 1.5.5）执行**功能流程图产出（强制）**与**流程最终确认门**（规则与 workflow 1.5.5 完全一致：Mermaid 流程图 + 关键操作节点清单、节点证据追溯、四条出口确认门、流程基准落盘）。该确认门是**确认门**，MUST NOT 因管线的 auto 语义被跳过或静默通过——流程基准的确认是自动化的前置条件，未经用户确认的流程图 MUST NOT 作为 propose 的生成锚点。

委派的 `iagent_spec_propose`（delegated）SHALL 在 Phase 2 的 tasks.md 生成中沿用 `[测试]` 任务标签（含测试层级与优先级子标注）。技能 SHALL 在 Phase 4 的 auto-apply 中继承 `iagent_spec_apply` 的**测试执行关卡**并**自动通关**：变更范围内测试失败时自动修复重试，上限 3 次；仍失败 MUST 暂停并报告用户，MUST NOT 静默通过、MUST NOT 进入归档。

技能 SHALL 在 Phase 1 / Phase 2 委派后遵守退出守卫：被委派的 `iagent_spec_explore` / `iagent_spec_propose` 完成后 MUST NOT 自行进入实现或推进阶段；阶段推进主权归 `iagent_auto_workflow`。技能 `allowedTools` MUST 含 `Skill(spec_explore)` 与 `Skill(spec_propose)` 条目。

#### Scenario: 验证通过直通 apply 与 archive

- **WHEN** Phase 3 验证 Overall ≥90%
- **THEN** 系统宣布进入 Auto-Apply Phase 并以 auto-mode=true 执行实现（不呈现设计确认门），apply 完成且编译检查通过后自动宣布进入 Auto-Archive Phase 执行归档（归档内生成需求文档并迁移至 devdocs），最终输出全 Phase 完成汇总

#### Scenario: Phase 1 委派 spec-explore 探索

- **WHEN** 全自动管线启动进入 Phase 1
- **THEN** 系统经 Skill 工具委派 `iagent_spec_explore`（传 `mode=delegated`）执行强制 checkpoint 体系探索，MUST NOT 内联执行探索逻辑

#### Scenario: Phase 2 委派 spec-propose 生成提案

- **WHEN** 全自动管线完成 Phase 1 探索（消费 handoff）进入 Phase 2
- **THEN** 系统经 Skill 工具委派 `iagent_spec_propose`（传 `mode=delegated` 与 `exploration-file`）生成全部制品，MUST NOT 内联生成提案制品；委派完成后再进入 Phase 3 自动验证

#### Scenario: 探索文件迁移后删除源文件

- **WHEN** Phase 2 探索文件移动为变更目录内 exploration.md 成功且目标文件校验通过
- **THEN** 系统删除 `openspec/explorations/<keyword>-explore-<NNN>.md` 源文件；迁移失败时保留源文件并报告

#### Scenario: 归档阶段生成需求文档

- **WHEN** Phase 5 auto-archive 执行到预归档需求文档检查点
- **THEN** 系统按 `iagent_spec_archive` 模板的同一规则生成需求文档（不存在则非交互委派 `iagent_requirement_doc`；已存在则就地增量对齐保人工域），失败记 WARN 并不阻断归档

#### Scenario: 编译检查持续失败暂停

- **WHEN** Phase 4 中编译检查在 3 次自动修复尝试后仍失败
- **THEN** 系统暂停并等待用户指令，不进入归档阶段

#### Scenario: 澄清门不被 auto 语义跳过

- **WHEN** 用户以含糊输入（对象或范围缺失）调用 `/iagent:auto-workflow`
- **THEN** 委派的 `spec_explore`（delegated）在 Phase 1.1.2 执行提示词优化并阻塞等待用户确认后才继续自动化管线；不因管线为全自动模式而跳过本门或按猜测继续

#### Scenario: 流程图确认门不被 auto 语义跳过

- **WHEN** 全自动管线在 Phase 1.5.5 产出功能流程图与节点清单
- **THEN** 系统停止并等待用户确认流程基准，不因管线为全自动模式而跳过确认或按未确认流程图继续生成提案

#### Scenario: 测试执行关卡自动通关

- **WHEN** Phase 4 auto-apply 运行到测试执行关卡且变更范围内测试全部通过
- **THEN** 系统自动通关并继续收尾，不因 auto 语义跳过该关卡

#### Scenario: 测试失败 3 次后暂停

- **WHEN** Phase 4 测试执行关卡中变更范围内测试失败，且 3 次自动修复尝试后仍失败
- **THEN** 系统暂停并等待用户指令，MUST NOT 静默通过、MUST NOT 进入归档阶段

#### Scenario: Phase 2 产出 [测试] 任务

- **WHEN** 全自动管线在 Phase 2 委派生成 tasks.md
- **THEN** tasks.md 中的可测 Scenario 对应产出带层级与优先级子标注的 `[测试]` 任务，与 spec-propose 的标签口径一致

### Requirement: 提示词校验门共享模块

模板层 SHALL 提供单一源模块 `src/core/templates/prompt-gate.ts` 承载提示词校验门文本，MUST NOT 在各技能模板中重复维护流程文本。该模块 SHALL 导出：清晰度维度类型 `PromptDimension`、需求六维常量 `REQUIREMENT_DIMENSIONS`、bug 五维常量 `BUG_DIMENSIONS`、参数化渲染函数 `buildPromptGateBlock(dimensions)`、以及供手写指令正文复用的压缩渲染 `buildPromptGateCompact(dimensions)`。**探索委派后**，`iagent_spec_explore`（delegated 模式）与 `iagent_debug` 两个技能正文 SHALL 由该单一源内联生成；`iagent_workflow` / `iagent_auto_workflow` SHALL 经 Skill 工具委派 `iagent_spec_explore` 使用该门，MUST NOT 再内联门文本。`spec-explore` 指令正文经 `deriveCommandContent` 自动派生，其门文本 MUST NOT 被 `<!-- CMD:SKIP -->` 标记包裹。`WORKFLOW_PAIRS` SHALL 为 20 组成对注册。

#### Scenario: 门文本单一源内联

- **WHEN** 运行 `pnpm build && pnpm generate:skills` 生成 `skills/` 静态快照
- **THEN** `iagent_spec_explore` 与 `iagent_debug` 的 SKILL.md 均含来自 `prompt-gate.ts` 的门文本（需求版 / bug 版按技能注入），编排技能 `iagent_workflow` / `iagent_auto_workflow` 不再内联门文本，且 `test/skills-parity.test.ts` 的逐字节一致性断言通过

#### Scenario: 技能总数与注册结构

- **WHEN** 检查注册表
- **THEN** `WORKFLOW_PAIRS` 为 20 组成对注册，`test/templates.test.ts` 与 `test/commands.test.ts` 的技能总数断言与之一致

### Requirement: 功能流程图共享模块

模板层 SHALL 提供单一源模块 `src/core/templates/flowchart-gate.ts` 承载「功能流程图」文本，MUST NOT 在各技能模板中重复维护流程文本。该模块 SHALL 导出：节点字段类型 `FlowNodeColumn`、需求版列集常量 `REQUIREMENT_FLOW_COLUMNS`、缺陷链路版列集常量 `FAULT_CHAIN_FLOW_COLUMNS`、参数化渲染函数 `buildFlowchartBlock(columns)`、以及供手写指令正文复用的压缩渲染 `buildFlowchartCompact(columns)`。

**探索委派后**，`iagent_spec_explore`（delegated 模式）与 `iagent_debug` 两个技能正文 SHALL 由该单一源内联生成；`iagent_workflow` / `iagent_auto_workflow` SHALL 经 Skill 工具委派 `iagent_spec_explore` 使用该制品，MUST NOT 再内联流程图文本。`spec-explore` 指令正文经 `deriveCommandContent` 自动派生，其流程图文本 MUST NOT 被 `<!-- CMD:SKIP -->` 标记包裹。`WORKFLOW_PAIRS` SHALL 为 20 组成对注册。

#### Scenario: 流程图文本单一源内联

- **WHEN** 运行 `pnpm build && pnpm generate:skills` 生成 `skills/` 静态快照
- **THEN** `iagent_spec_explore` 与 `iagent_debug` 的 SKILL.md 均含来自 `flowchart-gate.ts` 的流程图文本（需求版 / 缺陷链路版按技能注入），且 `test/skills-parity.test.ts` 的逐字节一致性断言通过

#### Scenario: 节点字段按场景参数化

- **WHEN** 渲染需求版与缺陷链路版的流程图文本
- **THEN** 两版共享「生成 → 用户最终确认 → 落盘」的流程文本，仅节点清单表列集不同（需求版含「触发条件 / 异常路径」，缺陷链路版含「标记」列），MUST NOT 出现两份独立维护的流程文本字符串

### Requirement: 多项目 CodeGraph 扫描单代理化

`iagent_spec_explore`（delegated 模式）的 1.2.1.5（多项目 CodeGraph 扫描）SHALL 由「每个待查项目派发一个子代理」改为「**派发单个子代理，在其内部串行扫描全部待查项目**」。原实现为顺序派发（无并行收益却有 N 次子代理冷启动），单代理化消除 N−1 次冷启动且不降低扫描覆盖。`iagent_workflow` / `iagent_auto_workflow` SHALL 经委派 `iagent_spec_explore` 继承该行为，MUST NOT 各自内联扫描协议。

**降级 MUST 保持项目粒度**：某项目 CodeGraph 未初始化 / 扫描失败 / 超时（>120s）时，仅该项目降级为 Glob/Grep 并记 WARN，其余项目照常；一个项目失败 MUST NOT 影响其他项目。待查项目路径与当前项目相同时 SHALL 跳过扫描。

#### Scenario: 单子代理串行扫描全部项目

- **WHEN** 1.2.1.5 检出 2 个及以上待查项目且这些项目均已初始化 CodeGraph
- **THEN** 技能派发**一个**子代理，该子代理在内部串行扫描全部项目（使用 `projectPath` 参数），MUST NOT 每项目各派发一个子代理

#### Scenario: 单项目降级不影响其他项目

- **WHEN** 某个待查项目的 CodeGraph 未初始化，或其扫描失败 / 超时（>120s）
- **THEN** 仅该项目降级为 Glob/Grep 并记 WARN，其余项目仍由同一子代理完成扫描；整体流程 MUST NOT 被阻断

#### Scenario: 子代理不可用时的降级

- **WHEN** 运行时无法派发子代理（工具不可用或派发失败）
- **THEN** 技能对全部待查项目降级为 Glob/Grep 扫描并记 WARN，扫描结论仍合并写入 exploration.md

#### Scenario: 待查项目与当前项目相同

- **WHEN** 检出的项目路径与当前项目相同
- **THEN** 技能跳过该项目的子代理扫描（1.2.1 基线扫描已覆盖）
