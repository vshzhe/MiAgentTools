## MODIFIED Requirements

### Requirement: workflow 自动验证门与深度复查联动

`iagent_workflow`、`iagent_auto_workflow` 与 `iagent_debug` SHALL 在各自提案验证通过且深度复查收束后**直接继续其下一阶段**，不再提供需求文档“生成 / 跳过”业务桥：`workflow` 进入 Phase 3.7「实现 + 测试桥」，`auto-workflow` 进入自动实现，`debug` 进入 `verify-close` 收束。独立 `iagent_spec_verify_proposal` SHALL 保持只读验证职责，不生成、询问或委派需求文档。

验证与深度复查 SHALL 以结构化回执收束；回执 `status=ok` 且在父编排中校验通过后，父编排 MUST 在同一用户回合内继续下一阶段的首个动作。验证 FAIL 时 SHALL 继续既有制品修复与重验，MUST NOT 提前推进；重验耗尽后暂停并报告。

#### Scenario: PASS 与深度复查后直接续跑

- **WHEN** workflow、auto-workflow 或 debug 的提案验证 PASS 且深度复查已收束
- **THEN** 父编排 SHALL 在同一用户回合内进入下一阶段（workflow 实现桥 / auto-workflow 自动实现 / debug verify-close）
- **AND** MUST NOT 展示需求文档桥、MUST NOT 委派 `iagent_requirement_doc`

#### Scenario: 验证失败时不推进

- **WHEN** 提案验证分数低于 90% 或仍处于失败修复循环
- **THEN** 工作流继续既有修复与重验流程，MUST NOT 进入下一阶段

#### Scenario: 独立验证器保持只读

- **WHEN** 单独调用 `iagent_spec_verify_proposal`
- **THEN** 技能只评分与报告，不生成需求文档、不委派其他生成技能

### Requirement: 需求文档技能的手工调用保留与自动调用方变更

技能 `iagent_requirement_doc` 及其配对指令 SHALL 保留独立可调用性：standalone 模式（交互收集可跳过的基本信息、按归档状态路由输出路径）与八章节转换规则、伪代码注入规则、DDL 提取规则均保持不变，用户 MAY 在任何阶段手工调用。

自动调用方 SHALL 为空：workflow / auto-workflow / debug MUST NOT 再委派该技能；archive / bulk-archive MUST NOT 读取或报告需求文档；`iagent_spec_propose` 独立调用与 delegated 调用均 MUST NOT 生成需求文档。该技能不再随三个父流程自动注入安装；用户需要时 SHALL 在 `workflows` 中显式选择并在手工调用后使用。

#### Scenario: 独立指令仍可手工调用

- **WHEN** 用户在任意阶段手工执行需求文档技能
- **THEN** 技能按 standalone 模式运行，保留原有基本信息收集与八章节转换行为

#### Scenario: 三个父工作流不再调用

- **WHEN** workflow、auto-workflow 或 debug 完成验证与深度复查
- **THEN** 父流程 MUST NOT 委派 `iagent_requirement_doc`、MUST NOT 展示生成/跳过桥

#### Scenario: 归档侧不再读取或报告

- **WHEN** archive 或 bulk-archive 处理变更
- **THEN** 技能 MUST NOT 读取 `需求文档.md` 或 `requirementDocStatus`、MUST NOT 在摘要中报告需求文档状态
- **AND** 文件随变更目录原样保留，不生成、不对齐、不迁出

#### Scenario: spec-propose 独立调用不自动生成

- **WHEN** 用户独立执行 `/iagent:spec-propose` 且验证 PASS
- **THEN** 技能 SHALL 停止，MUST NOT 生成需求文档、MUST NOT 呈现生成/跳过桥；用户 MAY 之后手工调用 `iagent_requirement_doc`

### Requirement: workflow 提案阶段委派 spec-propose

`iagent_workflow` 的 Phase 2 SHALL 经**前台 Agent 子代理**委派 `iagent_spec_propose`（传 `mode=delegated` + `exploration-file=<Phase 1 产出的探索文件路径>`）完成探索文件迁移与全部制品生成，MUST NOT 内联生成提案制品。Claude 宿主使用前台 `Agent`；OpenCode / Pi 按其原生 subagent / Agent 机制；Codex 按显式 degraded 本地执行。

编排器 SHALL 保留 Phase 2.0 的**预迁移验证与影响分析**（探索文件存在性校验、CONTEXT.md 同步、Pending 影响符号 → CodeGraph impact）作为其跨阶段编排职责，并把结论作为委派输入传递。

委派完成后 SHALL 保留编排器自身的 Phase 3 验证（`iagent_spec_verify_proposal` + `iagent_proposal_review` 深度复查），但 MUST NOT 再包含需求文档桥。`delegated` 模式下 `spec_propose` 已抑制其自身 Phase 3；编排器收到其结构化回执后 MUST 在同一用户回合内进入 Phase 3。

#### Scenario: 提案阶段委派而非内联

- **WHEN** `iagent_workflow` 完成 Phase 1 探索并进入 Phase 2
- **THEN** 系统经前台 Agent 子代理委派 `iagent_spec_propose`（传 `mode=delegated` 与探索文件路径），MUST NOT 内联生成 proposal.md / specs / design.md / tasks.md

#### Scenario: 预迁移验证与影响分析保留在编排器

- **WHEN** `workflow` 进入 Phase 2.0
- **THEN** 系统仍执行探索文件存在性校验、CONTEXT.md 同步与 Pending 影响符号的 CodeGraph impact 分析，并将结论传给委派的 `spec_propose`

#### Scenario: 回执后直接进入验证

- **WHEN** 委派的 `spec_propose`（delegated）完成制品生成并返回有效回执
- **THEN** `workflow` SHALL 在同一用户回合内进入 Phase 3 执行验证超集（`spec_verify_proposal` + `proposal_review`），MUST NOT 等待用户再发消息

#### Scenario: 阶段主权归编排器

- **WHEN** 委派的 `spec_propose`（delegated）输出结构化回执
- **THEN** `spec_propose` MUST NOT 自行进入实现或推进阶段；`workflow` 是唯一有权判定 Phase 2 完成并推进 Phase 3 的角色

### Requirement: 实现桥合并（实现确认 + 测试计划）

`iagent_workflow` 的实现确认桥（Phase 3.7）与条件测试计划确认门 SHALL 合并为单一「**实现 + 测试桥**」（交付桥）：一次呈现「提案摘要 + 验证评分 + 深度复查结论 + 实现方案 + 测试计划预告」，一次确认。需求文档选项已移除，MUST NOT 在该桥内呈现「是否生成需求文档」。

合并**只合并确认面，不删除门**：`implementation-bridge` 仍是实现阶段唯一阻塞门（不可豁免）。验证 FAIL、重验循环中或深度复查未收束时 MUST NOT 呈现该桥。

交付桥出口 SHALL 为：

- **确认** → 进入实现（含条件测试生成），并以 `gate-skip=design-confirmation` 委派 `iagent_spec_apply`；
- **修改** → 回 Phase 2 / Phase 1 调整制品，MUST NOT 进入实现；
- **拒绝** → 记录未确认状态并停止。

桥确认后 MUST 立即写门账本 `design-confirmation` 并在委派前校验存在；回执 SHALL 携带 `confirmedGates: ['design-confirmation']`。MUST NOT 再写入或传递 `requirementDocStatus`。

#### Scenario: 单门呈现实现与测试计划

- **WHEN** 提案验证通过、深度复查收束、准备进入实现
- **THEN** 系统 SHALL 以单一「实现 + 测试桥」呈现「提案摘要 + 验证评分 + 深度复查结论 + 实现方案 + 测试计划预告」
- **AND** 用户确认一次即进入实现（含条件测试生成），MUST NOT 在实现阶段再设第二个确认门

#### Scenario: 三出口

- **WHEN** 用户在该门选择确认 / 修改 / 拒绝
- **THEN** 分别进入实现、回 Phase 2 或 1 调整、停止
- **AND** MUST NOT 存在「仅生成文档」出口

#### Scenario: 门账本写入与续跑

- **WHEN** 用户在实现 + 测试桥确认
- **THEN** 系统 SHALL 写入门账本 `design-confirmation` 并在委派前校验存在
- **AND** 在同一用户回合内委派 `spec-apply`，不追加调用确认

### Requirement: 确认后的下一技能直接调用

当用户启动父工作流，或在业务门明确确认了唯一的下一项技能及其参数后，父编排器 SHALL 直接调用该已授权技能，不得再次询问“是否调用该技能”。委派阶段返回 `status=ok` 且回执校验通过后，父编排器 SHALL 在同一用户回合内继续下一阶段，MUST NOT 以回执结束回合。该语义只消费当前入口意图或当前门对唯一 `nextAllowed` 动作的授权，不授权后续不同的业务副作用或确认门。

此规则 MUST NOT 绕过宿主工具权限审批、strict/degraded 能力检查、回执验证或用户已确认的其他业务门；宿主未授权或能力不足时按宿主策略阻断，或仅在显式协商的 degraded 模式下透明降级。

#### Scenario: 工作流启动授权首个技能

- **WHEN** 用户以 workflow、auto-workflow 或 debug 入口启动流程，且宿主满足所需能力并授权该技能
- **THEN** 编排器直接调用契约指定的首个技能，不额外询问是否调用

#### Scenario: 业务确认授权唯一后继技能

- **WHEN** 用户确认的业务门在回执中指定了唯一 `nextAllowed` 技能与参数
- **THEN** 编排器直接调用该技能，不增加重复的调用确认

#### Scenario: 回执后同回合续跑

- **WHEN** 被委派阶段返回有效回执
- **THEN** 编排器 SHALL 在同一用户回合内继续下一阶段
- **AND** MUST NOT 输出“阶段完成，是否继续”类停点

#### Scenario: 宿主权限或 strict 能力不足

- **WHEN** 下一技能调用缺少宿主权限，或 strict 模式缺少阶段必需能力
- **THEN** 宿主按既有策略拒绝或阻断并报告原因；业务确认不得覆盖权限拒绝或伪造 strict 委派

### Requirement: auto-workflow 全自动自述与文档桥一致

`iagent_auto_workflow` 的技能 description、Phase 3 与 Phase 4 的阶段说明 SHALL 与**无需求文档桥**的现状一致：MUST NOT 披露需求文档桥、MUST NOT 声称验证阶段存在文档选择门。其唯一用户停点 SHALL 为探索阶段的 L1-L5 澄清门与功能流程图门；此后 Phase 2-5 SHALL 连续执行，MUST NOT 追加“是否调用 `spec_apply`”或“是否继续”的确认。编译失败、测试失败与实现验证失败仍是硬暂停点（不是用户确认门）。验证分数与深度复查结论 SHALL 在阶段报告与最终完成摘要中呈现，使“没有用户门”不等于“没有质量信息”。

`auto-workflow` SHALL 在探索回执声明流程基准已确认、**且验证 PASS + 深度复查收束**后，把门承载 id `design-confirmation` 写入 handoff 包 `## 已确认门` 段（流程最终确认 + 已验证设计构成设计基线确认），并在委派 apply 前校验存在；流程基准未确认或验证 / 深度复查未收束时 MUST NOT 写入该门、MUST NOT 以 `gate-skip` 跳过设计确认门（fail-safe）。

#### Scenario: 自述与阶段说明一致

- **WHEN** 检查 `iagent_auto_workflow` 的 description 与 Phase 3 / Phase 4 段落
- **THEN** MUST NOT 出现需求文档桥或“是否生成需求文档”的表述
- **AND** SHALL 声明 L1-L5 与流程最终确认门是唯一用户停点
- **AND** SHALL 声明验证分数与深度复查结论会呈现

#### Scenario: 流程基准确认且验证通过后写门账本

- **WHEN** 探索回执声明 `flowBaselineConfirmed=true`，且验证 PASS + 深度复查收束
- **THEN** 父编排 SHALL 写入 `design-confirmation` 并在委派前校验存在
- **AND** 阶段回执 SHALL 携带 `confirmedGates: ['design-confirmation']`

#### Scenario: 流程基准未确认或验证未通过时不跳过设计门

- **WHEN** 探索回执声明流程基准未确认，或验证 FAIL / 深度复查未收束
- **THEN** 父编排 MUST NOT 写入 `design-confirmation` 账本、MUST NOT 传 `gate-skip=design-confirmation`
- **AND** MUST 暂停并报告，不得把未确认的设计当作已确认

#### Scenario: 自动阶段连续执行

- **WHEN** 用户确认流程基准后进入 Phase 2
- **THEN** Phase 2-5 SHALL 连续执行，不追加调用确认
- **AND** 编译 / 测试 / 实现验证失败时按既有预算暂停并报告
- **AND** 验证分数与深度复查结论 SHALL 在报告中呈现

### Requirement: auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议

`iagent_auto_workflow` 的 Phase 4（自动实现）与 Phase 5（自动归档）SHALL 经**前台 Agent 子代理**委派 `iagent_spec_apply`（传 `gate-skip=design-confirmation`；`auto-mode=true` 为等价兼容写法）与 `iagent_spec_archive`（传 `change-name`），MUST NOT 重定义 / 内联复述其派发协议与共享资源协议（context-pack / output ledger / minimal receipt / shared instruction prefix）。`gate-skip=design-confirmation` 仅跳过设计确认门，MUST NOT 免除共享资源协议与退出守卫。

**门账本写入**：流程基准确认后、委派前，父级 SHALL 把 `design-confirmation` 写入 handoff 包 `## 已确认门` 段并在委派前校验存在；阶段回执 SHALL 携带 `confirmedGates: ['design-confirmation']`。`gate-skip` 继续随委派传递（主通道），账本为参数丢失时的兜底；两者皆缺失时被委派 apply 的设计门 SHALL 照常触发（MUST NOT 静默跳过）。账本写入 / 校验失败 → 停止并报告，MUST NOT 继续自动委派。

auto-workflow 的阶段门声明 SHALL 与其协议阶段清单一致：验证 / 实现 / 归档阶段 MUST NOT 声明阻塞门；`requirementDocStatus` 已整体移除，MUST NOT 出现在委派参数、回执或归档描述中。

#### Scenario: Phase 4 委派而非内联

- **WHEN** auto-workflow 验证通过后进入 Phase 4
- **THEN** SHALL 经前台 Agent 子代理委派 `iagent_spec_apply`（`gate-skip=design-confirmation`）
- **AND** MUST NOT 出现 “Execute the apply workflow logic” 式的内联执行描述

#### Scenario: Phase 5 委派而非内联

- **WHEN** auto-workflow 实现、编译检查与测试门完成后进入 Phase 5
- **THEN** SHALL 经前台 Agent 子代理委派 `iagent_spec_archive`（`change-name`）
- **AND** MUST NOT 传递 `requirementDocStatus`，归档侧 MUST NOT 读取或报告需求文档

#### Scenario: 测试执行门继承

- **WHEN** auto-workflow 的委派 apply 进入测试执行门
- **THEN** SHALL 复用 `iagent_spec_apply` §9 的门（change scope、in-scope 失败重试 3 次后暂停、out-of-scope 仅 WARN）
- **AND** MUST NOT 在 auto-workflow 内另立第二份测试门定义

#### Scenario: 门账本兜底

- **WHEN** 自动委派时 `gate-skip` 参数未传达，但账本已声明 `design-confirmation` 且与回执一致
- **THEN** 被委派 apply SHALL 经账本兜底跳过 Step 5.5 并记 WARN
- **AND** 其余门与停点 MUST 照常生效

#### Scenario: 两者皆缺时设计门照常触发

- **WHEN** 自动委派既未传 `gate-skip`，账本段也缺失或无该条目
- **THEN** 被委派 apply 的设计确认门 MUST 照常执行，MUST NOT 静默跳过

### Requirement: 编排技能门白名单与直通句

编排类技能（`iagent_workflow` / `iagent_auto_workflow` / `iagent_debug` / `iagent_migration`）与 spec 阶段技能（`iagent_spec_explore` / `iagent_spec_propose` / `iagent_spec_apply` / `iagent_spec_verify` / `iagent_spec_verify_proposal` / `iagent_spec_archive` / `iagent_spec_bulk_archive`）正文 SHALL 引入**门白名单**段（复用 `prompt-gate.ts` 的共享常量），并满足：

- **必留门（正向枚举 5 类）**：L1-L5 需求澄清、功能流程图门、实现 + 测试桥、归档桥、破坏性改动确认；其中 `iagent_debug` 的「诊断结论确认」与「修复方案选择」（条件门）归入**需求澄清（需求 / 方案歧义）**一类，MUST NOT 因类别名不同而被判为白名单外；需求文档桥已移除，MUST NOT 再作为锚点或门出现；
- **MUST NOT 请求确认清单**：阶段宣告、技能委派（含「是否调用 <技能>」）、只读扫描、CodeGraph 查询、状态查询；**只读校验的「是否运行 <校验>？」询问亦属此类**；这些动作 MUST NOT 被实现为停止点；
- **直通句**：`iagent_workflow` 的每处阶段委派点（Phase 1→2、2→3、3→4、4→5）SHALL 含与 `iagent_auto_workflow` 同款的强制语句「本阶段立即开始 —— 不停顿、不宣告、不向用户提问」；
- **返回边界续跑句**：每个委派点 SHALL 声明「收到有效回执后 MUST 在同一用户回合内继续下一阶段；MUST NOT 以回执结束回合」；
- **单一源**：门清单与负向清单文本 MUST 经共享常量插值，MUST NOT 各模板手写第二份；
- **生成期断言**：测试 SHALL 断言编排技能正文含 5 类必留门与 MUST NOT 清单、直通句关键字与返回边界续跑句，且不含自造门句式。

#### Scenario: workflow 补直通句与续跑句

- **WHEN** 检查 `iagent_workflow` 的阶段委派段落
- **THEN** 每处含「本阶段立即开始 —— 不停顿、不宣告、不向用户提问」与返回边界续跑句
- **AND** MUST NOT 出现在委派前等待确认的表述

#### Scenario: 必留门文本齐备

- **WHEN** 检查任一编排技能的正文
- **THEN** 含 L1-L5 需求澄清、功能流程图门、实现 + 测试桥、归档桥、破坏性改动确认五类门的声明
- **AND** MUST NOT 含需求文档桥

#### Scenario: 负向清单齐备

- **WHEN** 检查任一编排技能的正文
- **THEN** 含「阶段宣告 / 技能委派 / 只读扫描 / CodeGraph 查询 / 状态查询 MUST NOT 请求确认」清单

#### Scenario: 自造门句式被拦截

- **WHEN** 模板正文出现「是否调用 <技能>」「是否继续」「是否开始阶段」类询问句
- **THEN** 生成期文本测试失败并要求改为直通/续跑表述

#### Scenario: 门协议不弱化

- **WHEN** 检查 `GATE_PROTOCOL_PREAMBLE` 渲染结果
- **THEN** 仍含「门 = 本次响应到此结束」的硬停止语义，续跑句 MUST NOT 削弱该语义

### Requirement: Receipt-based phase transition

阶段推进 SHALL 以结构化 receipt 为依据，而不是以模型自然语言宣称完成为依据。receipt 至少 SHALL 包含阶段标识、状态、产物或结果位置、下一步允许动作与失败原因（如有）。receipt SHALL 被视为**中间状态**：父编排在 `status=ok` 且校验通过后 MUST 在同一用户回合内继续下一阶段；只有门白名单内的确认门是合法停点。

#### Scenario: Valid receipt advances

- **WHEN** 阶段 receipt 通过字段与状态校验
- **THEN** 编排器 SHALL 允许进入协议定义的下一阶段
- **AND** SHALL 在同一用户回合内发起下一阶段的首个动作

#### Scenario: Missing receipt blocks

- **WHEN** 阶段仅输出自然语言而未返回必需 receipt
- **THEN** 编排器 SHALL 标记阶段不完整
- **AND** 不得自动推进或宣称流程完成

#### Scenario: Invalid receipt blocks

- **WHEN** receipt 缺少必需字段、状态非法或 `confirmedGates` 非法
- **THEN** 编排器 SHALL 以 `invalid-receipt` 阻断并报告具体原因
