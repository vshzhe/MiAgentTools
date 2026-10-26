# tr-workflow-suite-skills Specification (Delta)

> 修改：① `tr-impl-workflow 提案内联生成阶段` —— 探索文件迁移改为**移动并删除源件**（失败保留）；② `tr-impl-workflow 自动验证门与深度复查联动` —— 移除验证 PASS 后的需求文档生成；③ `tr-impl-auto-workflow 全自动管线` —— 探索文件迁移删源 + Phase 3 生成移除 + Phase 5 内联归档步骤追加需求文档生成；④ `tr-impl-debug 关联变更判定与调试循环` —— Phase 7.3 需求文档双分支整段移除（能力迁至归档）；⑤ `tr-impl-genfull 引导式全流程编排` —— Stage 2.3 生成移除、Bridge 2 就绪检查与 workspace-planning 降级描述同步、Stage 4 继承归档生成；⑥ `编排技能的委派与派发白名单齐备性` —— 白名单条目随委派面变化同步。
>
> 新增：`需求文档技能的手工调用保留与自动调用方变更` —— 明确独立技能与独立指令仍可手工调用，自动调用方由提案/调试链路改为归档链路。
>
> MODIFIED 需求须含完整更新内容。

## ADDED Requirements

### Requirement: 需求文档技能的手工调用保留与自动调用方变更

技能 `venus_tr_docs_requirement_doc` 及其配对指令 `/venus:tr-docs-requirement-doc` SHALL **保留**其独立可调用性：standalone 模式（AskUserQuestion 收集基本信息、按归档状态路由输出路径）与其八章节转换规则、伪代码注入规则、DDL 提取规则**均不变**，用户 MAY 在任何阶段手工调用它生成或更新需求文档。

变更的只是**工作流内的自动调用方**：自动生成时机由提案校验后 / 调试收尾迁移至**归档的预归档需求文档生成检查点**（`venus_spec_archive` 步骤 4.8、`venus_spec_bulk_archive` 步骤 a.6）；`venus_tr_impl_workflow` / `venus_tr_impl_auto_workflow` / `venus_tr_impl_debug` / `venus_tr_impl_genfull` MUST NOT 再自动调用本技能。技能自身的"目标文件已存在时静默覆盖（幂等）"规则**保持不变**——其防护职责由调用方承担：归档检查点在**已存在**分支 MUST NOT 调用本技能，改走就地增量对齐以保人工域。

#### Scenario: 独立指令仍可手工调用

- **WHEN** 用户在任意阶段手工执行 `/venus:tr-docs-requirement-doc`
- **THEN** 技能按 standalone 模式运行（收集可跳过的基本信息、按归档状态路由输出路径），行为与本变更前一致

#### Scenario: 自动调用方唯一化为归档

- **WHEN** 检查 `venus_tr_impl_workflow` / `venus_tr_impl_auto_workflow` / `venus_tr_impl_debug` / `venus_tr_impl_genfull` 的正文
- **THEN** 四者均不含自动调用 `venus_tr_docs_requirement_doc` 生成需求文档的步骤；唯一自动调用方为归档侧（`venus_spec_archive` 4.8 与 `venus_spec_bulk_archive` a.6 的不存在分支）

#### Scenario: 静默覆盖规则保留但由调用方规避

- **WHEN** 归档检查点判定变更目录内已存在需求文档
- **THEN** 检查点走就地增量对齐而**不调用**本技能，使本技能"目标已存在则静默覆盖"规则不会抹掉人工填写的评审记录

## MODIFIED Requirements

### Requirement: tr-impl-workflow 提案内联生成阶段

技能 SHALL 执行预迁移验证（探索文件存在、CONTEXT.md 校验同步、最少节 Background+Decisions 验证；缺失文件时呈现 Option A 从探索记忆新建 / Option B 中止返回探索由用户必选）、Pending 含影响符号时自动执行影响分析（`codegraph_impact` upstream maxDepth 3，≥2 个符号并行发出查询）、经 `venus spec new "<change-name>"` 创建变更并以**移动**语义把探索文件迁移为 `openspec/changes/<change-name>/exploration.md`（**迁移成功且目标文件校验通过后 MUST 删除 `openspec/explorations/` 下的源文件，不留原件**；迁移失败或目标文件校验未通过时 MUST 保留源文件并报告错误——"不留原件"只适用于成功路径）、遵循 `openspec/rules/artifact-generation.md` 共享协议内联生成全部制品（探索内容按映射表提取：Decisions→proposal、Analysis→design、Questions→specs、Codebase Findings→tasks；生成前扫描规则文件并将 context/rules 注入为 AI 约束不写入输出；禁止 Skill 委托生成制品）、CLI 降级（首个 `venus spec status` 调用 command-not-found 签名失败→一次声明进入降级模式：内置依赖顺序 proposal→specs→design→tasks、文件存在性状态推断、流内不重试 CLI）、生成后执行制品 schema 验证（proposal 四节、specs 的 `#### Scenario:` 4 hashtags + WHEN/THEN/AND、tasks checkbox；关键错误必修复，警告用户可选现在修/带警告继续/重新生成）。

#### Scenario: CLI 缺失时降级生成

- **WHEN** 首个 `venus spec status` Bash 调用失败且错误含 "command not found"/"不是内部或外部命令"/"not recognized" 之一
- **THEN** 系统一行告知 "venus CLI not found in PATH — switching to CLI-degraded generation mode" 后按内置依赖顺序纯 AI 生成全部制品，流程内不再尝试 `venus spec status`/`venus spec instructions`，结束时声明恰好一次降级提示

#### Scenario: 探索文件迁移后删除源文件

- **WHEN** 变更目录创建完成、探索文件移动为变更目录内 exploration.md 成功且目标文件校验通过
- **THEN** `openspec/explorations/<keyword>-explore-<NNN>.md` 源文件被删除，`openspec/explorations/` 不再保留同一探索的第二份副本（该目录退化为"探索中"暂存区）

#### Scenario: 迁移失败保留源文件

- **WHEN** 探索文件移动失败，或目标文件已存在但校验未通过
- **THEN** 系统保留 `openspec/explorations/` 下的源文件、删除未通过校验的目标副本（若为本技能所写），报告错误原因并提供重试或手工迁移选项

### Requirement: tr-impl-workflow 自动验证门与深度复查联动

技能 SHALL 在全部 applyRequires 制品完成后自动进入验证（跳过 [立即验证]/[跳过验证] 选择）、先运行 `venus spec status --change "<name>" --json` 解析状态再经 Skill 工具调用 `venus_spec_verify_proposal` 技能评分（技能不可用时 fallback AI 内联评分并 WARN，绝不静默跳过）、按统一 90% 阈值处理：PASS 后自动调用 `venus_tr_impl_review_proposal` 技能执行深度复查（技能为主；技能不可用 fallback 主工作流内联只读深度复查并 WARN），复查完成后收束验证阶段——**MUST NOT 在提案校验后生成需求文档**（需求文档由归档阶段生成，见 `spec-archive 归档技能`）；FAIL 时逐失败维度自动生成修复建议并 Edit 应用后自动重跑验证，仍失败呈现三选项（手动编辑/返回探索/查看 diff），无跳过到实现的路径。

#### Scenario: 验证通过后技能链联动

- **WHEN** 验证评分 Overall ≥90%（全维度 PASS）
- **THEN** 系统自动调用 `venus_tr_impl_review_proposal` 技能深度复查并汇总复查结论，MUST NOT 生成需求文档，等待用户发起实现（spec-apply）

#### Scenario: 验证失败自动修复循环

- **WHEN** 任一维度评分 <90%
- **THEN** 系统自动生成该维度的具体修复（如 D4 缺边界场景→补充场景）、Edit 应用到制品文件、自动重跑验证并显示修复汇总；重跑仍失败时呈现 [1] 手动编辑 [2] 返回探索 [3] 查看详细 diff 三选项

### Requirement: tr-impl-auto-workflow 全自动管线

技能 `venus_tr_impl_auto_workflow` SHALL 执行五阶段全自动管线：Phase 1-3 与 tr-impl-workflow 同构（精简版探索 + 内联提案生成 + 自动验证，**探索文件迁移后删除源文件**）；Phase 4 验证通过后自动进入 auto-apply（构建 `auto-mode=true` + change-name 上下文，执行 `venus_spec_apply` 的 Step 6+ 批次调度行为，跳过设计确认门）——**MUST NOT 以需求文档生成为前置**；Phase 5 apply 完成且编译检查通过后自动进入 auto-archive（构建 change-name 上下文跳过变更选择提示，执行 `venus_spec_archive` 模板全部步骤：delta spec 合并、CONTEXT.md 同步、CodeGraph 检查、探索记忆同步、**需求文档生成（存在性判定 → 委派 `venus_tr_docs_requirement_doc` 生成 / 就地增量对齐，失败 WARN 非阻断）**、目录移动、需求文档迁移至 devdocs、ARCHIVE-INDEX.md 更新）。错误处理 MUST 遵守：编译检查失败经 3 次自动修复尝试后暂停等待用户指令不进归档；子代理失败自动重试一次、再失败暂停报告；用户中断时完成当前批次、剩余任务标记未完成后暂停；归档 delta spec 冲突带标记自动合并（非阻塞）；CONTEXT.md/探索记忆同步失败 WARN 继续；需求文档生成或对齐失败 WARN 继续；CodeGraph 未初始化跳过继续；归档目标已存在报错建议改名。

技能 SHALL 在与 tr-impl-workflow 同构的位置（Phase 1.1.2，探索文件创建之后、CONTEXT.md 检查与代码库扫描之前）执行同一**提示词校验门**（需求六维自检、清晰直通、不明确优化并阻塞确认、软不明确记 `[假设]`、`无需`/`提示词基线` 落盘规则与 tr-impl-workflow 完全一致）。该门是**澄清门（确认 WHAT）**，MUST NOT 因管线的 auto 语义被跳过或静默通过——自动化的起点在 Baseline 确认之后，而非之前。

技能 SHALL 在与 tr-impl-workflow 同构的位置（Phase 1.5.5）执行**功能流程图产出（强制）**与**流程最终确认门**（规则与 tr-impl-workflow 1.5.5 完全一致：Mermaid 流程图 + 关键操作节点清单、节点证据追溯、四条出口确认门、流程基准落盘）。该确认门是**确认门**，MUST NOT 因管线的 auto 语义被跳过或静默通过——流程基准的确认是自动化的前置条件，未经用户确认的流程图 MUST NOT 作为 propose 的生成锚点。

技能 SHALL 在 Phase 2 的 tasks.md 生成中沿用与 spec-propose 一致的 `[测试]` 任务标签（含测试层级与优先级子标注）。技能 SHALL 在 Phase 4 的 auto-apply 中继承 `venus_spec_apply` 的**测试执行关卡**并**自动通关**：变更范围内测试失败时自动修复重试，上限 3 次；仍失败 MUST 暂停并报告用户，MUST NOT 静默通过、MUST NOT 进入归档。

#### Scenario: 验证通过直通 apply 与 archive

- **WHEN** Phase 3 验证 Overall ≥90%
- **THEN** 系统宣布进入 Auto-Apply Phase 并以 auto-mode=true 执行实现（不呈现设计确认门），apply 完成且编译检查通过后自动宣布进入 Auto-Archive Phase 执行归档（归档内生成需求文档并迁移至 devdocs），最终输出全 Phase 完成汇总

#### Scenario: 探索文件迁移后删除源文件

- **WHEN** Phase 2 探索文件移动为变更目录内 exploration.md 成功且目标文件校验通过
- **THEN** 系统删除 `openspec/explorations/<keyword>-explore-<NNN>.md` 源文件；迁移失败时保留源文件并报告

#### Scenario: 归档阶段生成需求文档

- **WHEN** Phase 5 auto-archive 执行到预归档需求文档检查点
- **THEN** 系统按 `venus_spec_archive` 模板的同一规则生成需求文档（不存在则非交互委派 `venus_tr_docs_requirement_doc`；已存在则就地增量对齐保人工域），失败记 WARN 并不阻断归档

#### Scenario: 编译检查持续失败暂停

- **WHEN** Phase 4 中编译检查在 3 次自动修复尝试后仍失败
- **THEN** 系统暂停并等待用户指令，不进入归档阶段

#### Scenario: 澄清门不被 auto 语义跳过

- **WHEN** 用户以含糊输入（对象或范围缺失）调用 `/venus:tr-impl-auto-workflow`
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

- **WHEN** 全自动管线在 Phase 2 生成 tasks.md
- **THEN** tasks.md 中的可测 Scenario 对应产出带层级与优先级子标注的 `[测试]` 任务，与 spec-propose 的标签口径一致

### Requirement: tr-impl-debug 关联变更判定与调试循环

技能 SHALL 在修复前判定 bug 归属：受影响代码属于 `openspec/changes/` 进行中变更→修复更新该变更；独立 bug→经 `venus spec new "fix-{module}-<topic>"` 新建修复变更；属于 `openspec/changes/archive/`→绝不修改归档目录，新建变更并在 proposal 引用原归档名溯源；调查结论非缺陷→输出诊断报告（症状/排查路径/代码测试证据），不建变更不改代码，工作流结束。修复 MUST 附带强制回归测试（修复前 FAIL、修复后 PASS，tasks.md 缺失则补加，重跑 Phase 1 复现确认）。

回归测试的**编写动作** SHALL 委派 `venus_tr_test_generate` 技能执行（传测试层级与优先级，并传入缺陷链路图作为覆盖口径），MUST NOT 在 debug 内另立一套测试编写规则；委派不可用时 SHALL 降级为自行编写并记录 WARN。技能 SHALL 保留 debug 特有的两条硬要求，MUST NOT 因委派而放松：① 回归测试 MUST 覆盖该缺陷链路的「异常节点 + 根因节点」；② 回归测试 MUST 修复前 FAIL、修复后 PASS。

调试循环：每完成一个修复询问"还有相关 bug 需要修复吗？"，继续则重入 Phase 1（后续 bug 默认同变更修复并呈现关联获认可；用户声明独立变更时收尾当前变更并提示单独调用 debug，不自动新建）；循环中非缺陷发现不阻塞其他 bug；中途退出保留已完成修复、丢弃未完成 bug；连续 ≥5 次迭代建议检查拆分但不强制终止；结束后 Phase 5 编译检查、Phase 6 同步提案、Phase 7 验证各执行一次覆盖全部累计修复。

**需求文档不在 debug 范围内（MANDATORY）**：Phase 7 SHALL 在验证通过、深度复查完成后收束工作流（输出"准备归档"提示），**MUST NOT 生成需求文档、MUST NOT 就地增量对齐既有需求文档、MUST NOT 委派 `venus_tr_docs_requirement_doc`**——需求文档由归档阶段生成（见 `spec-archive 归档技能` 的预归档需求文档生成检查点），其人工域保护与就地增量对齐语义一并由该阶段承载。

#### Scenario: 归档变更来源的 bug 只读溯源

- **WHEN** 受影响代码属于 `openspec/changes/archive/` 下的归档变更
- **THEN** 系统不修改归档目录任何文件，新建变更并在其 proposal.md 中引用原归档变更名以保持可追溯性

#### Scenario: 调试循环汇总收尾

- **WHEN** 用户在循环确认中回答"没有"（无更多相关 bug）
- **THEN** 系统执行一次覆盖全部累计修复的编译检查（`openspec/config.yaml` compileCheck 配置驱动，禁用或未配置默认跳过）、同步提案（proposal 按bug组织根因与修复、tasks 勾选与回归任务、design/specs 按需更新、全部根因分析持久化到 exploration.md、格式校验）、调用 `venus_spec_verify_proposal` 验证（FAIL 自动修复循环；PASS 后经深度复查收束工作流并提示准备归档，MUST NOT 生成需求文档）

#### Scenario: debug 不生成需求文档

- **WHEN** Phase 7 验证 PASS 且深度复查完成，无论 `openspec/changes/<change-name>/需求文档.md` 是否存在
- **THEN** 系统不调用 `venus_tr_docs_requirement_doc`、不做就地增量对齐，直接输出"准备归档"提示；需求文档的生成与人工域保护由归档阶段负责

#### Scenario: 技能与配套指令正文语义一致

- **WHEN** 本变更改了 `venus_tr_impl_debug` 的 skill 正文（分级节 / 2.2.4 触发条件 / Phase 7 收尾）
- **THEN** 其配套指令正文 SHALL 手工同步同一语义（压缩允许删减，MUST NOT 冲突）——该技能指令正文为手写压缩版，MUST NOT 假设经 `deriveCommandContent` 自动派生

#### Scenario: 回归测试委派测试生成技能

- **WHEN** 进入 Phase 4.2 编写强制回归测试
- **THEN** 技能委派 `venus_tr_test_generate`（传测试层级与优先级 + 缺陷链路图作为覆盖口径）生成回归测试，不在 debug 内自行实现测试编写规则

#### Scenario: 委派不可用时降级

- **WHEN** `venus_tr_test_generate` 技能不可用（未安装或调用失败）
- **THEN** 技能降级为自行编写回归测试并记录 WARN，MUST NOT 因降级而放松「异常节点 + 根因节点」覆盖口径与「修复前 FAIL、修复后 PASS」要求

#### Scenario: 委派后两条硬要求仍生效

- **WHEN** 回归测试由 `venus_tr_test_generate` 委派生成
- **THEN** 技能仍 MUST 校验该回归测试覆盖缺陷链路的「异常节点 + 根因节点」且修复前 FAIL、修复后 PASS；仅覆盖触发节点时验证不通过

### Requirement: tr-impl-genfull 引导式全流程编排

技能 `venus_tr_impl_genfull` SHALL 以**委派 + 桥梁**模型编排探索→归档的完整流程，MUST NOT 内联 explore / propose / apply 的阶段逻辑（区别于 tr-impl-workflow）。Phase 0 SHALL 执行全阶段 TodoWrite 跟踪初始化、`actionContext.mode` 检测（workspace-planning 模式降级为仅探索+提案+深度复查，并在 Bridge 2 前停止）与贯穿上下文初始化（change-name / changeRoot / has-frontend / has-java-test / tech-stack 待各阶段填充）。

Phase 0 SHALL 在 Stage 1 委派之前执行**提示词校验门**（需求六维，规则与 tr-impl-workflow 一致：清晰直通、不明确优化并阻塞确认、软不明确记 `[假设]`）。该门 SHALL 具备**幂等性**：当检测到上游已产出提示词基线（本次会话 Phase 0 已确认，或传入的探索产物中已存在 `## 提示词基线` 段）时，MUST NOT 重复执行校验或再次要求确认。

各阶段 SHALL 经 Skill 工具委派执行：Stage 1 委派 `venus_spec_explore`（交互式 grill L1-L5 由 explore 承载）；Stage 1.5（条件 has-frontend）委派 `venus_tr_impl_frontend` **仅执行设计决策**（页面类型 / 组件选型 / 字段-组件映射矩阵 / jQuery 版本与引入顺序 / 4 种 UI 状态 / 前后端交互方式），产出写入 exploration.md `## 前端设计` 段供 propose 提取，references 实现模板留待 Stage 3；Stage 2 委派 `venus_spec_propose`（内部自动调用 `venus_spec_verify_proposal`，D1-D9 评分 90% 阈值），PASS 后委派 `venus_tr_impl_review_proposal` 深度复查（不可用则内联只读复查 + WARN）——**MUST NOT 在 Stage 2 生成需求文档**；Stage 3 委派 `venus_spec_apply` 并传 `auto-mode=true` 跳过 Step 5.5 设计确认门（由 Bridge 2 承载），条件子阶段 3a 委派 frontend 仅执行实现（读 references 生成 JSP）、3b 委派 `venus_tr_test_generate`；Stage 4 委派 `venus_spec_archive` 并传 change-name（**需求文档由归档阶段生成并迁移至 devdocs**）。

Bridge 1/2/3 SHALL 各自执行四件事：①上下文交接 ②前置就绪检查（Bridge 1：exploration.md 兜底补建 + CONTEXT.md 存在性校验 + impact analysis 并行执行并回写；Bridge 2：proposal/design/specs/tasks 齐全 + verify PASS + 深度复查完成 + apply instruction 为 `ready`；Bridge 3：tasks.md 全 `- [x]` + 编译通过 + 条件子阶段完成）③后置完整性校验 ④门决策（引导模式暂停等待用户确认）。错误处理 MUST 遵守：apply 编译失败 3 次自动修复后暂停且不进入归档；frontend/test 确认门拒绝时回退 Bridge 2；子代理失败自动重试一次、仍失败暂停报告；探索文件迁移失败时保留源文件（迁移成功时按 `venus_tr_impl_workflow` 同一规则删除源文件）。

Bridge 1 SHALL 增加**功能流程图兜底与确认**步骤：检查 exploration.md 是否含 `## 功能流程图` 段；**缺失时**（Stage 1 委派的 explore 走条件触发分支未产出）由 genfull 依据 exploration.md 的 Decisions / 边界场景 / Codebase Findings **强制补建**流程图与节点清单（规则同 tr-impl-workflow 1.5.5：节点证据追溯、`[新建]` 标记、异常路径），并在 Bridge 1 门决策中一并请用户确认流程基准。该步骤 SHALL 具备**幂等性**：exploration.md 已含经确认的 `## 功能流程图` 段时直接通过，MUST NOT 重复产出或再次要求确认。探索文件已存在但流程图未获用户确认时，propose MUST NOT 将其作为生成锚点。

#### Scenario: Phase 0 校验门与下游幂等

- **WHEN** 用户以含糊输入调用 `/venus:tr-impl-genfull`，Phase 0 执行提示词校验门并获用户确认后生成提示词基线
- **THEN** Stage 1 委派的 `venus_spec_explore` 检测到已存在的提示词基线后直接进入探索，不重复执行校验或再次要求确认

#### Scenario: 委派而非内联

- **WHEN** genfull 进入 Stage 1 探索
- **THEN** 系统经 Skill 工具委派 `venus_spec_explore` 执行，genfull 自身不内联探索文件创建、CONTEXT.md 检查、能力记忆注入、CodeGraph 扫描与 grill L1-L5 追问等探索逻辑

#### Scenario: Stage 2 不生成需求文档

- **WHEN** 深度复查完成、Bridge 2 就绪检查执行
- **THEN** 系统 MUST NOT 委派 `venus_tr_docs_requirement_doc`，就绪检查不含"需求文档已生成"项；需求文档由 Stage 4 委派的 `venus_spec_archive` 在归档阶段生成

#### Scenario: workspace-planning 降级在 Bridge 2 前停止

- **WHEN** Phase 0 检测到 `actionContext.mode === "workspace-planning"`
- **THEN** 系统提示 workspace-planning 变更不支持 apply/archive，流程降级为仅探索+提案+深度复查，并在 Bridge 2 的就绪检查处停止，不进入 Stage 3

#### Scenario: Bridge 1 缺失流程图时强制补建

- **WHEN** Stage 1 委派的 `venus_spec_explore` 按条件触发分支未产出 `## 功能流程图` 段（exploration.md 中存在该段缺失）
- **THEN** genfull 在 Bridge 1 依据 exploration.md 的 Decisions / 边界场景 / Codebase Findings 强制补建流程图与节点清单（节点证据追溯、`[新建]` 标记、异常路径），并在 Bridge 1 门决策中请用户确认流程基准；用户确认前不进入 Stage 1.5 / Stage 2

#### Scenario: 流程图兜底幂等

- **WHEN** exploration.md 已含经用户确认的 `## 功能流程图` 段（Stage 1 委派的 explore 已产出并确认，或本次会话 Bridge 1 已确认）
- **THEN** Bridge 1 直接通过该步骤，不重复产出流程图或再次要求用户确认

### Requirement: 编排技能的委派与派发白名单齐备性

编排类技能（`venus_tr_impl_workflow` / `venus_tr_impl_auto_workflow` / `venus_tr_impl_genfull` / `venus_tr_impl_debug` / `venus_tr_impl_auto_migration`）的 `allowedTools` SHALL 覆盖其正文的实际调用面——**经 Skill 工具委派的每一个子技能**写入 `Skill(<技能名>)` 精确条目，**派发的子代理**写入 `Agent` 与 `Task` 双写条目，**调用的 CodeGraph MCP 工具**写入 `mcp__codegraph` 与具名工具双写条目。**正文不再委派的子技能条目 SHALL 同步剔除**（最小权限），授权面 MUST NOT 因存量条目而虚增。

本要求是既有委派需求的**可执行性前提**：正文要求经 Skill 工具委派、而白名单无对应条目时，委派在 Claude Code 中被权限拦截，编排流程无法执行——委派需求在纸面成立而运行时失效；反之，正文已不委派而条目仍在，则授权面虚增。

嵌套委派（编排技能 → 归档类技能 → 需求文档技能）SHALL 由**会话级权限载体**（`permissions.allow`，聚合全部已安装技能的 `allowedTools` 条目）覆盖，编排技能自身的 `allowedTools` MUST NOT 因而写入非本轮实际委派的条目。

#### Scenario: auto-workflow 派发条目缺口修复

- **WHEN** 检查 `venus_tr_impl_auto_workflow` 的 `allowedTools`
- **THEN** 含 `Agent` 与 `Task` 条目，与正文 1.2.1.5 多项目扫描及 Phase 4 批调度的派发要求一致

#### Scenario: auto-workflow 委派条目齐备

- **WHEN** 检查 `venus_tr_impl_auto_workflow` 的 `allowedTools`
- **THEN** 含其正文经 Skill 工具委派的全部子技能条目（`venus_spec_verify_proposal` / `venus_tr_impl_review_proposal` / `venus_tr_docs_requirement_doc` / `venus_spec_apply` / `venus_spec_archive`）——其 Phase 5 内联归档步骤仍委派需求文档技能，故该条目保留

#### Scenario: genfull 阶段委派条目齐备

- **WHEN** 检查 `venus_tr_impl_genfull` 的 `allowedTools`
- **THEN** 含其四个 Stage 经 Skill 工具委派的全部子技能条目（`venus_spec_explore` / `venus_tr_impl_frontend` / `venus_spec_propose` / `venus_tr_impl_review_proposal` / `venus_spec_apply` / `venus_tr_test_generate` / `venus_spec_archive`），**不含** `venus_tr_docs_requirement_doc`（Stage 2 已不委派它；归档阶段的需求文档生成由 `venus_spec_archive` 自身委派，经会话级权限载体覆盖）

#### Scenario: 需求文档生成移除后条目同步剔除

- **WHEN** 检查 `venus_tr_impl_workflow` 与 `venus_tr_impl_debug` 的 `allowedTools`
- **THEN** 两者均**不含** `venus_tr_docs_requirement_doc`（前者 §3.5、后者 Phase 7.3 的需求文档生成已移除，正文不再委派该技能）

#### Scenario: debug 委派条目齐备

- **WHEN** 检查 `venus_tr_impl_debug` 的 `allowedTools`
- **THEN** 含其正文委派的 `venus_tr_test_generate` 条目

#### Scenario: auto-migration 委派条目齐备

- **WHEN** 检查 `venus_tr_impl_auto_migration` 的 `allowedTools`
- **THEN** 含其正文委派的 `venus_tr_docs_feature_doc` 与 `venus_tr_impl_migration_check` 条目

#### Scenario: 调用 CodeGraph 的编排技能含 MCP 条目

- **WHEN** 检查正文引用 `codegraph_*` 工具的编排技能（如 `venus_tr_impl_workflow` / `venus_tr_impl_debug`）的 `allowedTools`
- **THEN** 含 `mcp__codegraph` 与具名 CodeGraph 工具双写条目
