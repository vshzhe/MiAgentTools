## REMOVED Requirements

### Requirement: workflow 提案内联生成阶段
**Reason**: 该需求要求 `iagent_workflow` 内联生成全部提案制品并明令"禁止 Skill 委托生成制品"，导致提案生成逻辑在 `workflow` / `iagent_auto_workflow` / `iagent_spec_propose` 三处重复，成为结构性不一致来源。历史内联动机（"无 Skill 委派断层"）经探索确认为可解：断层实质是子技能的规划边界中断编排器，可由委派执行模式（`delegated`）让出阶段主权解决。
**Migration**: 提案生成职责移交 `iagent_spec_propose` 的 `delegated` 模式（见 `spec-workflow-skills / spec-propose 委派执行模式（delegated）契约`）；`workflow` 的 Phase 2.0 预迁移验证与影响分析保留在编排器，迁移与制品生成改由委派调用完成（见新增需求 `workflow 提案阶段委派 spec-propose`）。

## ADDED Requirements

### Requirement: workflow 提案阶段委派 spec-propose

`iagent_workflow` 的 Phase 2 SHALL 经 Skill 工具**委派** `iagent_spec_propose`（传 `mode=delegated` + `exploration-file=<Phase 1 产出的探索文件路径>`）完成探索文件迁移与全部制品生成，MUST NOT 内联生成提案制品。

编排器 SHALL 保留 Phase 2.0 的**预迁移验证与影响分析**（探索文件存在性校验、CONTEXT.md 同步、Pending 影响符号 → CodeGraph impact）作为其跨阶段编排职责，并把结论作为委派输入传递。

委派完成后 SHALL 保留编排器自身的 Phase 3 验证门（`iagent_spec_verify_proposal` + `iagent_proposal_review` 深度复查 + 非交互 `iagent_requirement_doc`）——该验证为 `spec_propose` 自身 Phase 3 的超集，`delegated` 模式下 `spec_propose` 已抑制其自身 Phase 3。

委派 SHALL 遵守退出守卫：被委派的 `iagent_spec_propose` 完成后 MUST NOT 自行进入实现或推进阶段；阶段完成判定与推进主权归 `iagent_workflow`。`workflow` 的 `allowedTools` MUST 含 `Skill(spec_propose)` 条目。

#### Scenario: 提案阶段委派而非内联

- **WHEN** `iagent_workflow` 完成 Phase 1 探索并进入 Phase 2
- **THEN** 系统经 Skill 工具委派 `iagent_spec_propose`（传 `mode=delegated` 与探索文件路径），MUST NOT 内联生成 proposal.md / specs / design.md / tasks.md

#### Scenario: 预迁移验证与影响分析保留在编排器

- **WHEN** `workflow` 进入 Phase 2.0
- **THEN** 系统仍执行探索文件存在性校验、CONTEXT.md 同步与 Pending 影响符号的 CodeGraph impact 分析，并将结论传给委派的 `spec_propose`

#### Scenario: 验证门仍由编排器执行

- **WHEN** 委派的 `spec_propose`（delegated）完成制品生成并返回
- **THEN** `workflow` SHALL 进入其 Phase 3 执行验证超集（`spec_verify_proposal` + `proposal_review` + 非交互 `requirement_doc`），MUST NOT 依赖 `spec_propose` 的自身 Phase 3（已抑制）

#### Scenario: 阶段主权归编排器

- **WHEN** 委派的 `spec_propose`（delegated）输出结构化回执
- **THEN** `spec_propose` MUST NOT 自行进入实现或推进阶段；`workflow` 是唯一有权判定 Phase 2 完成并推进 Phase 3 的角色

## MODIFIED Requirements

### Requirement: auto-workflow 全自动管线

技能 `iagent_auto_workflow` SHALL 执行五阶段全自动管线：Phase 1-3 与 workflow 同构（探索保持内联 + **Phase 2 经 Skill 工具委派 `iagent_spec_propose`（`mode=delegated` + `exploration-file`）生成提案** + 自动验证，**探索文件迁移后删除源文件**）；Phase 4 验证通过后自动进入 auto-apply（构建 `auto-mode=true` + change-name 上下文，执行 `iagent_spec_apply` 的 Step 6+ 批次调度行为，跳过设计确认门）——**MUST NOT 以需求文档生成为前置**；Phase 5 apply 完成且编译检查通过后自动进入 auto-archive（构建 change-name 上下文跳过变更选择提示，执行 `iagent_spec_archive` 模板全部步骤：delta spec 合并、CONTEXT.md 同步、CodeGraph 检查、探索记忆同步、**需求文档生成（存在性判定 → 委派 `iagent_requirement_doc` 生成 / 就地增量对齐，失败 WARN 非阻断）**、目录移动、需求文档迁移至 devdocs、ARCHIVE-INDEX.md 更新）。错误处理 MUST 遵守：编译检查失败经 3 次自动修复尝试后暂停等待用户指令不进归档；子代理失败自动重试一次、再失败暂停报告；用户中断时完成当前批次、剩余任务标记未完成后暂停；归档 delta spec 冲突带标记自动合并（非阻塞）；CONTEXT.md/探索记忆同步失败 WARN 继续；需求文档生成或对齐失败 WARN 继续；CodeGraph 未初始化跳过继续；归档目标已存在报错建议改名。

技能 SHALL 在与 workflow 同构的位置（Phase 1.1.2，探索文件创建之后、CONTEXT.md 检查与代码库扫描之前）执行同一**提示词校验门**（需求六维自检、清晰直通、不明确优化并阻塞确认、软不明确记 `[假设]`、`无需`/`提示词基线` 落盘规则与 workflow 完全一致）。该门是**澄清门（确认 WHAT）**，MUST NOT 因管线的 auto 语义被跳过或静默通过——自动化的起点在 Baseline 确认之后，而非之前。

技能 SHALL 在与 workflow 同构的位置（Phase 1.5.5）执行**功能流程图产出（强制）**与**流程最终确认门**（规则与 workflow 1.5.5 完全一致：Mermaid 流程图 + 关键操作节点清单、节点证据追溯、四条出口确认门、流程基准落盘）。该确认门是**确认门**，MUST NOT 因管线的 auto 语义被跳过或静默通过——流程基准的确认是自动化的前置条件，未经用户确认的流程图 MUST NOT 作为 propose 的生成锚点。

技能 SHALL 在 Phase 2 的 tasks.md 生成中沿用与 spec-propose 一致的 `[测试]` 任务标签（含测试层级与优先级子标注）。技能 SHALL 在 Phase 4 的 auto-apply 中继承 `iagent_spec_apply` 的**测试执行关卡**并**自动通关**：变更范围内测试失败时自动修复重试，上限 3 次；仍失败 MUST 暂停并报告用户，MUST NOT 静默通过、MUST NOT 进入归档。

技能 SHALL 在 Phase 2 委派 `iagent_spec_propose`（`mode=delegated`）后遵守退出守卫：被委派技能 MUST NOT 自行进入实现或推进阶段；阶段推进主权归 `iagent_auto_workflow`。技能 `allowedTools` MUST 含 `Skill(spec_propose)` 条目。

#### Scenario: 验证通过直通 apply 与 archive

- **WHEN** Phase 3 验证 Overall ≥90%
- **THEN** 系统宣布进入 Auto-Apply Phase 并以 auto-mode=true 执行实现（不呈现设计确认门），apply 完成且编译检查通过后自动宣布进入 Auto-Archive Phase 执行归档（归档内生成需求文档并迁移至 devdocs），最终输出全 Phase 完成汇总

#### Scenario: Phase 2 委派 spec-propose 生成提案

- **WHEN** 全自动管线完成 Phase 1 探索进入 Phase 2
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
- **THEN** 系统在 Phase 1.1.2 执行提示词优化并阻塞等待用户确认后才继续自动化管线；不因管线为全自动模式而跳过本门或按猜测继续

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
