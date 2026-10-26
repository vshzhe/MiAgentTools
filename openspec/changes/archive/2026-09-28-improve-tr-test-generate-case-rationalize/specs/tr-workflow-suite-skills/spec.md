## MODIFIED Requirements

### Requirement: tr-impl-auto-workflow 全自动管线

技能 `venus_tr_impl_auto_workflow` SHALL 执行五阶段全自动管线：Phase 1-3 与 tr-impl-workflow 同构（精简版探索 + 内联提案生成 + 自动验证，探索文件迁移保留源文件）；Phase 4 验证通过且需求文档生成后自动进入 auto-apply（构建 `auto-mode=true` + change-name 上下文，执行 `venus_spec_apply` 的 Step 6+ 批次调度行为，跳过设计确认门）；Phase 5 apply 完成且编译检查通过后自动进入 auto-archive（构建 change-name 上下文跳过变更选择提示，执行 `venus_spec_archive` 模板全部步骤：delta spec 合并、CONTEXT.md 同步、CodeGraph 检查、探索记忆同步、目录移动、ARCHIVE-INDEX.md 更新）。错误处理 MUST 遵守：编译检查失败经 3 次自动修复尝试后暂停等待用户指令不进归档；子代理失败自动重试一次、再失败暂停报告；用户中断时完成当前批次、剩余任务标记未完成后暂停；归档 delta spec 冲突带标记自动合并（非阻塞）；CONTEXT.md/探索记忆同步失败 WARN 继续；CodeGraph 未初始化跳过继续；归档目标已存在报错建议改名。

技能 SHALL 在与 tr-impl-workflow 同构的位置（Phase 1.1.2，探索文件创建之后、CONTEXT.md 检查与代码库扫描之前）执行同一**提示词校验门**（需求六维自检、清晰直通、不明确优化并阻塞确认、软不明确记 `[假设]`、`无需`/`提示词基线` 落盘规则与 tr-impl-workflow 完全一致）。该门是**澄清门（确认 WHAT）**，MUST NOT 因管线的 auto 语义被跳过或静默通过——自动化的起点在 Baseline 确认之后，而非之前。

技能 SHALL 在与 tr-impl-workflow 同构的位置（Phase 1.5.5）执行**功能流程图产出（强制）**与**流程最终确认门**（规则与 tr-impl-workflow 1.5.5 完全一致：Mermaid 流程图 + 关键操作节点清单、节点证据追溯、四条出口确认门、流程基准落盘）。该确认门是**确认门**，MUST NOT 因管线的 auto 语义被跳过或静默通过——流程基准的确认是自动化的前置条件，未经用户确认的流程图 MUST NOT 作为 propose 的生成锚点。

技能 SHALL 在 Phase 2 的 tasks.md 生成中沿用与 spec-propose 一致的 `[测试]` 任务标签（含测试层级与优先级子标注）。技能 SHALL 在 Phase 4 的 auto-apply 中继承 `venus_spec_apply` 的**测试执行关卡**并**自动通关**：变更范围内测试失败时自动修复重试，上限 3 次；仍失败 MUST 暂停并报告用户，MUST NOT 静默通过、MUST NOT 进入归档。

#### Scenario: 验证通过直通 apply 与 archive

- **WHEN** Phase 3 验证 Overall ≥90% 且需求文档生成完成
- **THEN** 系统宣布进入 Auto-Apply Phase 并以 auto-mode=true 执行实现（不呈现设计确认门），apply 完成且编译检查通过后自动宣布进入 Auto-Archive Phase 执行归档，最终输出全 Phase 完成汇总

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

**Phase 7.3 需求文档分支判定**：Phase 7 SHALL 在验证通过、深度复查完成**之后**、生成需求文档**之前**执行**需求文档存在性判定**，判定范围 SHALL **仅** `openspec/changes/<change-name>/需求文档.md`（`path.join()` 构造；debug 只操作 active 变更，归档变更会新建变更故其目录必无该文件）。**不存在**时 SHALL 调 `venus_tr_docs_requirement_doc` skill 非交互生成（既有行为）；**已存在**时 SHALL 执行**就地增量对齐更新**——`## 基本信息` 与 `## 八、评审记录` 为**人工域**，MUST NOT 覆盖（含占位符状态），`一~七` 章节 SHALL 按更新后的制品重新派生；已存在分支 MUST NOT 调用 `venus_tr_docs_requirement_doc`（其侧既有规则为目标文件已存在时静默覆盖，会抹掉人工内容）。就地对齐 MUST NOT 删除章节（仅制品已移除的内容可删）；文档格式破损时 SHALL 补建缺失章节并记录 WARN；目录不可读时 SHALL 记录 WARN 并按"不存在"处理。生成或更新失败时 SHALL 记录 WARN 并继续（不阻断工作流）。

#### Scenario: 归档变更来源的 bug 只读溯源

- **WHEN** 受影响代码属于 `openspec/changes/archive/` 下的归档变更
- **THEN** 系统不修改归档目录任何文件，新建变更并在其 proposal.md 中引用原归档变更名以保持可追溯性

#### Scenario: 调试循环汇总收尾

- **WHEN** 用户在循环确认中回答"没有"（无更多相关 bug）
- **THEN** 系统执行一次覆盖全部累计修复的编译检查（`openspec/config.yaml` compileCheck 配置驱动，禁用或未配置默认跳过）、同步提案（proposal 按bug组织根因与修复、tasks 勾选与回归任务、design/specs 按需更新、全部根因分析持久化到 exploration.md、格式校验）、调用 `venus_spec_verify_proposal` 验证（FAIL 自动修复循环；PASS 后经深度复查再按 Phase 7.3 分支产出需求文档——不存在则调 `venus_tr_docs_requirement_doc` 生成，已存在则就地增量对齐更新）

#### Scenario: 需求文档不存在时调 skill 生成

- **WHEN** Phase 7 验证 PASS 且深度复查完成，`openspec/changes/<change-name>/需求文档.md` 不存在
- **THEN** 系统调 `venus_tr_docs_requirement_doc` skill 非交互生成需求文档至该路径并输出路径提示（既有行为不变）

#### Scenario: 需求文档已存在时就地对齐更新

- **WHEN** Phase 7 验证 PASS 且深度复查完成，`openspec/changes/<change-name>/需求文档.md` 已存在（如来自 tr-impl-workflow / tr-impl-auto-workflow 的先前产出）
- **THEN** 系统放弃覆盖式重生成，改为就地增量对齐更新：`一~七` 章节按 Phase 6 同步后的制品重新派生，并输出更新后的文档路径

#### Scenario: 人工域不被覆盖

- **WHEN** 系统对已存在的需求文档执行就地增量对齐更新
- **THEN** `## 基本信息`（需求编号 / 需求名称 / 交付时间，含占位符状态）与 `## 八、评审记录` MUST NOT 被覆盖，逐字保留人工填写内容；且 MUST NOT 调用 `venus_tr_docs_requirement_doc`（避免其"目标已存在则静默覆盖"规则抹掉人工内容）

#### Scenario: 就地对齐不丢章节且容忍格式破损

- **WHEN** 既有需求文档缺少某个编号章节（格式破损）
- **THEN** 系统补建该缺失章节并记录 WARN，不静默放过；就地对齐过程 MUST NOT 删除既有章节（仅制品已移除的内容可删）

#### Scenario: 目录不可读时按不存在处理

- **WHEN** 判定阶段无法读取变更目录（IO 异常）
- **THEN** 系统记录 WARN 并按"需求文档不存在"处理，调 skill 生成分支继续，不阻断工作流

#### Scenario: 变更新建后恒走生成分支

- **WHEN** bug 为独立缺陷（不属于任何进行中变更），系统在 Phase 3 经 `venus spec new "fix-{module}-<topic>"` 新建变更目录后进入 Phase 7.3
- **THEN** 新建变更目录下必无 `需求文档.md`，判定恒为"不存在"，系统调 `venus_tr_docs_requirement_doc` skill 非交互生成——不出现"已存在"分支的空转

#### Scenario: 技能与配套指令正文语义一致

- **WHEN** 本变更改了 `venus_tr_impl_debug` 的 skill 正文（分级节 / 2.2.4 触发条件 / Phase 7.3 分支）
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

## ADDED Requirements

### Requirement: tr-impl-workflow 测试接入

技能 `venus_tr_impl_workflow` SHALL 在其内联提案生成阶段沿用与 spec-propose 一致的 `[测试]` 任务标签（含测试层级与优先级子标注）与测试规划判定（不可测 Scenario 仍产出 `[测试]` 任务记录"已评估、判定无需测试"的依据）。

范畴限定：该技能为 **explore → propose → verify 三阶段技能，止于规划与验证，不执行代码实现**。故本技能**不含实现阶段**，测试执行关卡不由本技能承担——任务清单交由 `venus_spec_apply` 实现时，其测试执行关卡由 apply 自身承担（见「spec-apply 实现技能」需求）。本技能 SHALL 在正文中显式声明该职责边界，MUST NOT 声称自己执行测试关卡。

该技能的 skill 版与 command 版正文为**双份手工维护**（未经 `deriveCommandContent()` 派生），两版正文 MUST 同步本次测试标签与职责边界语义，MUST NOT 只改其一导致两版行为不一致。

#### Scenario: 内联提案产出 [测试] 任务

- **WHEN** tr-impl-workflow 生成内联提案的 tasks.md
- **THEN** 可测 Scenario 对应产出带层级与优先级子标注的 `[测试]` 任务，标签口径与 spec-propose 一致

#### Scenario: 不可测 Scenario 仍留痕

- **WHEN** 内联提案中某 Scenario 为不可测的纯文档/配置变更
- **THEN** 技能仍产出 `[测试]` 任务记录该判定与依据，MUST NOT 静默省略测试任务

#### Scenario: 声明职责边界（不含实现阶段）

- **WHEN** 审阅 `venus_tr_impl_workflow` 正文的测试相关内容
- **THEN** 正文声明测试执行关卡由 `venus_spec_apply` 承担、本技能只负责规划 `[测试]` 任务；MUST NOT 出现"本技能运行测试关卡"一类与三阶段范畴矛盾的表述

#### Scenario: skill 版与 command 版正文同步

- **WHEN** 本变更修改了 tr-impl-workflow 的测试标签语义或职责边界表述
- **THEN** skill 版与 command 版两处正文均同步该语义，两版对 `[测试]` 标签与职责边界的描述不冲突
