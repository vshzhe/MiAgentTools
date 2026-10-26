## MODIFIED Requirements

### Requirement: workflow 自动验证门与深度复查联动

`iagent_workflow`、`iagent_auto_workflow` 与 `iagent_debug` SHALL 在各自提案验证通过且深度复查收束后，由父编排器提供需求文档“生成 / 跳过”业务桥。独立 `iagent_spec_verify_proposal` SHALL 保持只读验证职责，不生成、询问或委派需求文档。用户选择生成后，父编排器 SHALL 直接以非交互方式委派 `iagent_requirement_doc`，MUST NOT 再询问是否调用该技能；用户选择跳过后 SHALL 持久记录 `skipped-by-user` 并继续原工作流。`auto-workflow` 的该桥是明确的用户业务选择，选择后继续其既定 auto-mode，不得额外询问是否调用 apply。

仅在验证 PASS（统一 90% 阈值）和深度复查完成后展示需求文档桥；FAIL 时继续既有制品修复与重验，MUST NOT 提前展示文档桥。需求文档首次生成失败 SHALL 记录 `generation-failed`、输出 WARN 并继续原流程，MUST NOT 使归档阶段静默重试。

#### Scenario: PASS 与深度复查后由父编排器询问文档选择

- **WHEN** workflow、auto-workflow 或 debug 的提案验证 PASS 且深度复查已收束
- **THEN** 父编排器展示一次“生成 / 跳过”需求文档业务桥；独立 `iagent_spec_verify_proposal` 不生成文档、不持有该桥

#### Scenario: 用户确认生成后直接委派

- **WHEN** 用户在需求文档桥选择“生成”
- **THEN** 父编排器直接非交互委派 `iagent_requirement_doc`，不增加“是否调用该技能”的业务确认；生成失败时记录 `generation-failed`、输出 WARN 并继续原流程

#### Scenario: 用户跳过后继续原流程

- **WHEN** 用户在需求文档桥选择“跳过”
- **THEN** 系统将 `skipped-by-user` 持久化至变更 `exploration.md` 并纳入阶段回执；workflow 继续至实现桥、auto-workflow 继续 auto-apply、debug 继续收束，不因跳过而自动终止

#### Scenario: 验证失败时不展示需求文档桥

- **WHEN** 提案验证分数低于 90% 或仍处于失败修复循环
- **THEN** 工作流继续既有修复与重验流程，MUST NOT 调用需求文档技能或展示生成/跳过桥

### Requirement: 编排技能的委派与派发白名单齐备性

编排类技能（`iagent_workflow` / `iagent_auto_workflow` / `iagent_debug` / `iagent_migration`）的 `allowedTools` SHALL 覆盖其正文的实际调用面——经 Skill 工具委派的每一个子技能写入 `Skill(<裸名>)` 精确条目，派发的子代理写入 `Agent` 与 `Task` 双写条目，调用的 CodeGraph MCP 工具写入 `mcp__codegraph` 与具名工具双写条目。正文不再委派的子技能条目 SHALL 同步剔除，授权面 MUST NOT 因存量条目而虚增。

debug 在本变更后 SHALL 将 `iagent_test` 用作回归测试生成能力的唯一规则源，并直接委派 `iagent_requirement_doc` 处理用户已确认的需求文档生成。debug 的实际委派清单 SHALL 包含 `iagent_spec_verify_proposal`、`iagent_proposal_review`、`iagent_requirement_doc` 和条件委派的 `iagent_test`；相应 Claude 白名单、宿主委派清单及 OpenCode V2 项目权限 SHALL 一致。共享模板 MUST NOT 硬编码 Claude 专属调用机制。

#### Scenario: auto-workflow 委派与派发条目齐备

- **WHEN** 检查 `iagent_auto_workflow` 的 `allowedTools`
- **THEN** 含其正文实际委派的验证、深度复查、需求文档、apply、verify、test 与 archive 技能条目，以及实际派发时所需的 `Agent`、`Task` 条目

#### Scenario: workflow 委派条目齐备

- **WHEN** 检查 `iagent_workflow` 的 `allowedTools`
- **THEN** 含其正文实际委派的 explore、propose、verify-proposal、proposal-review、requirement-doc、apply、verify、test 与 archive 技能条目，以及实际派发时所需的 `Agent`、`Task` 条目

#### Scenario: debug 委派条目齐备且无幽灵项

- **WHEN** 检查 `iagent_debug` 的模板白名单、宿主委派清单与生成权限
- **THEN** 均覆盖其正文的 `spec-verify-proposal`、`proposal-review`、`requirement-doc` 和条件 `test` 委派；没有未使用的技能条目或 `Skill(*)` 通配

#### Scenario: auto-migration 委派条目齐备

- **WHEN** 检查 `iagent_migration` 的 `allowedTools`
- **THEN** 含其正文委派的 `iagent_feature_doc` 与 `iagent_migration_check` 条目

#### Scenario: 调用 CodeGraph 的编排技能含 MCP 条目

- **WHEN** 检查正文引用 `codegraph_*` 工具的编排技能
- **THEN** 含 `mcp__codegraph` 与具名 CodeGraph 工具双写条目

#### Scenario: 白名单无幽灵条目

- **WHEN** 运行编排技能授权一致性检查
- **THEN** 每个宿主的授权条目对应正文真实委派或协议声明的能力，不保留未使用的宿主授权条目

### Requirement: 需求文档技能的手工调用保留与自动调用方变更

技能 `iagent_requirement_doc` 及其配对指令 SHALL 保留独立可调用性：standalone 模式（交互收集可跳过的基本信息、按归档状态路由输出路径）与八章节转换规则、伪代码注入规则、DDL 提取规则均保持不变，用户 MAY 在任何阶段手工调用。自动调用方 SHALL 包括 workflow / auto-workflow / debug 的验证与深度复查通过后的"生成"分支，以及 archive 的兼容缺失文档分支。archive 的显式 skip / generation-failed / generated 状态分支 MUST NOT 调用本技能；既有文档由 archive 就地增量对齐，避免触发生成器的静默覆盖。`iagent_spec_propose` 独立调用 SHALL NOT 自动生成需求文档（非目标）：验证 PASS 后停止并保留手工调用路径；`delegated` 模式下其 Phase 3 本就抑制，文档由父编排器的桥决定。

#### Scenario: 独立指令仍可手工调用

- **WHEN** 用户在任意阶段手工执行需求文档技能
- **THEN** 技能按 standalone 模式运行，保留原有基本信息收集与八章节转换行为

#### Scenario: 三个父工作流可在生成分支调用

- **WHEN** workflow、auto-workflow 或 debug 在验证与深度复查后收到用户“生成”选择
- **THEN** 父流程非交互委派 `iagent_requirement_doc`；该技能不再次询问基本信息或是否执行

#### Scenario: archive 状态分支避免静默覆盖

- **WHEN** archive 发现文档已存在，或显式状态为 `skipped-by-user` / `generation-failed` / `generated`
- **THEN** 已存在文档走人工域保护的就地对齐；显式状态且文档缺失时不调用需求文档技能

#### Scenario: spec-propose 独立调用不自动生成

- **WHEN** 用户独立执行 `/iagent:spec-propose` 且验证 PASS
- **THEN** 技能 SHALL 停止，MUST NOT 生成需求文档、MUST NOT 呈现生成/跳过桥；用户 MAY 之后手工调用 `iagent_requirement_doc`

### Requirement: workflow 提案阶段委派 spec-propose

`iagent_workflow` 的 Phase 2 SHALL 经 Skill 工具**委派** `iagent_spec_propose`（传 `mode=delegated` + `exploration-file=<Phase 1 产出的探索文件路径>`）完成探索文件迁移与全部制品生成，MUST NOT 内联生成提案制品。

编排器 SHALL 保留 Phase 2.0 的**预迁移验证与影响分析**（探索文件存在性校验、CONTEXT.md 同步、Pending 影响符号 → CodeGraph impact）作为其跨阶段编排职责，并把结论作为委派输入传递。

委派完成后 SHALL 保留编排器自身的 Phase 3 验证门（`iagent_spec_verify_proposal` + `iagent_proposal_review` 深度复查 + 需求文档生成/跳过业务桥）——该验证为 `spec_propose` 自身 Phase 3 的超集，`delegated` 模式下 `spec_propose` 已抑制其自身 Phase 3；仅当用户在文档桥选择生成时才委派 `iagent_requirement_doc`。

委派 SHALL 遵守退出守卫：被委派的 `iagent_spec_propose` 完成后 MUST NOT 自行进入实现或推进阶段；阶段完成判定与推进主权归 `iagent_workflow`。`workflow` 的 `allowedTools` MUST 含 `Skill(spec_propose)` 条目。

#### Scenario: 提案阶段委派而非内联

- **WHEN** `iagent_workflow` 完成 Phase 1 探索并进入 Phase 2
- **THEN** 系统经 Skill 工具委派 `iagent_spec_propose`（传 `mode=delegated` 与探索文件路径），MUST NOT 内联生成 proposal.md / specs / design.md / tasks.md

#### Scenario: 预迁移验证与影响分析保留在编排器

- **WHEN** `workflow` 进入 Phase 2.0
- **THEN** 系统仍执行探索文件存在性校验、CONTEXT.md 同步与 Pending 影响符号的 CodeGraph impact 分析，并将结论传给委派的 `spec_propose`

#### Scenario: 验证门仍由编排器执行

- **WHEN** 委派的 `spec_propose`（delegated）完成制品生成并返回
- **THEN** `workflow` SHALL 进入其 Phase 3 执行验证超集（`spec_verify_proposal` + `proposal_review` + 需求文档桥），MUST NOT 依赖 `spec_propose` 的自身 Phase 3（已抑制）；仅桥的生成分支委派 `requirement_doc`

#### Scenario: 阶段主权归编排器

- **WHEN** 委派的 `spec_propose`（delegated）输出结构化回执
- **THEN** `spec_propose` MUST NOT 自行进入实现或推进阶段；`workflow` 是唯一有权判定 Phase 2 完成并推进 Phase 3 的角色

## ADDED Requirements

### Requirement: debug 修复方案确认与回归测试职责

`iagent_debug` SHALL 在复现、排查、根因/缺陷链路确认及变更归属判定后，评估可行修复方案数量。多个可行方案 SHALL 展示方案、影响与建议并等待用户选择；拒绝或修改时 MUST NOT 实现。只有一个明确可行方案且有项目约束及代码证据支持唯一性时，SHALL 说明依据后直通实现；证据不足时 MUST 按多方案处理。既有数据库/schema 变更的独立确认 SHALL 保留。

回归测试生成 SHALL 委派 `iagent_test`，该技能是测试生成规则（框架、项目风格和用例设计）的唯一来源。debug SHALL 向其提供已确认的缺陷链路与测试必要上下文，并在返回后核对每个修复均有修复前失败、修复后通过的回归测试，且覆盖缺陷链路的异常节点与根因节点。debug MUST NOT 再维护与 `iagent_test` 冲突的内联框架检测或测试生成规则。宿主能力缺失时 SHALL 遵守 strict/degraded 协商，不得伪装委派已完成；strict 缺少委派能力时 MUST 阻断，MUST NOT 以"自写 + WARN"绕过。

合并的诊断确认包（根因证据 + 缺陷链路）SHALL 采用一次确认，并按"确认 / 修改 / 拒绝"三出口处理；其中**拒绝 = 终止修复并输出诊断报告**：MUST NOT 自动按推断继续、MUST NOT 进入修复、MUST NOT 标记可归档。该出口不适用探索期流程最终确认门的四出口语义。

Phase 1 复现 MAY 以内联临时测试建立失败证据，但该测试**不构成**回归测试：回归测试 SHALL 由 `iagent_test` 生成或改造落库，debug MUST NOT 将 Phase 1 内联测试直接作为唯一回归测试。无法自动化捕获的缺陷仍按显式步骤复现。

#### Scenario: 高置信根因与链路一次确认

- **WHEN** 排查得到单一高置信根因且缺陷链路节点已知
- **THEN** 系统在同一确认包中呈现根因证据与缺陷链路并等待一次确认；用户修改时更新后重呈，拒绝时不修复

#### Scenario: 多候选根因先选择再确认链路

- **WHEN** 排查得到多个根因候选或置信不足
- **THEN** 系统先列候选证据与建议并等待用户选根因；选定后再呈现据此生成的缺陷链路确认，未完成前不得修复

#### Scenario: 多个可行修复方案须等待选择

- **WHEN** 变更归属明确且有两个或以上可行修复方案
- **THEN** 系统展示方案、影响和建议并等待用户确认其中一项；用户拒绝或要求修改时不得实现

#### Scenario: 唯一方案凭证据直通

- **WHEN** 只有一个明确可行修复方案，且项目约束与代码证据支持其唯一性
- **THEN** 系统说明唯一性依据后进入实现，不新增方案确认停顿；证据不足则转入多方案确认

#### Scenario: 回归测试委派并由 debug 验收

- **WHEN** debug 已确认修复方案并实施修复
- **THEN** debug 委派 `iagent_test` 生成回归测试，并核对修复前失败、修复后通过以及异常节点和根因节点覆盖；不复制测试技能的框架/风格规则

#### Scenario: 数据库/schema 确认仍保留

- **WHEN** 唯一修复方案涉及数据库或 schema 变更
- **THEN** 既有独立 DDL/schema 确认仍须执行，唯一方案直通规则不绕过该确认

#### Scenario: 诊断确认包被拒绝

- **WHEN** 用户在合并的根因/缺陷链路确认包中选择拒绝
- **THEN** debug MUST 终止修复并输出诊断报告（含排查路径与证据），MUST NOT 修改代码、MUST NOT 自动推断继续、MUST NOT 标记可归档

#### Scenario: Phase 1 内联测试不替代回归测试

- **WHEN** debug 在 Phase 1 以临时测试复现了缺陷
- **THEN** Phase 4 SHALL 委派 `iagent_test` 生成或改造正式回归测试（修复前 FAIL、修复后 PASS，覆盖异常节点与根因节点）；MUST NOT 仅以 Phase 1 临时测试充当唯一回归测试

#### Scenario: strict 缺委派能力不降级自写

- **WHEN** strict 模式下无法委派 `iagent_test`
- **THEN** 系统 SHALL 按能力协商阻断并报告，MUST NOT 以"自写 + WARN"绕过；仅显式协商 degraded 后允许本地编写并透明记录未发生的委派

### Requirement: 确认后的下一技能直接调用

当用户启动父工作流，或在业务门明确确认了唯一的下一项技能及其参数后，父编排器 SHALL 直接调用该已授权技能，不得再次询问“是否调用该技能”。该语义只消费当前入口意图或当前门对唯一 `nextAllowed` 动作的授权，不授权后续不同的业务副作用或确认门。共享模板 MUST NOT 假定 Claude、OpenCode 或 Pi 的某种专属调用语法。

此规则 MUST NOT 绕过宿主工具权限审批、strict/degraded 能力检查、回执验证或用户已确认的其他业务门；宿主未授权或能力不足时按宿主策略阻断，或仅在显式协商的 degraded 模式下透明降级。

#### Scenario: 工作流启动授权首个技能

- **WHEN** 用户以 workflow、auto-workflow 或 debug 入口启动流程，且宿主满足所需能力并授权该技能
- **THEN** 编排器直接调用契约指定的首个技能，不额外询问是否调用

#### Scenario: 业务确认授权唯一后继技能

- **WHEN** 用户确认的业务门在回执中指定了唯一 `nextAllowed` 技能与参数
- **THEN** 编排器直接调用该技能，不增加重复的调用确认

#### Scenario: 宿主权限或 strict 能力不足

- **WHEN** 下一技能调用缺少宿主权限，或 strict 模式缺少阶段必需能力
- **THEN** 宿主按既有策略拒绝或阻断并报告原因；业务确认不得覆盖权限拒绝或伪造 strict 委派

### Requirement: auto-workflow 全自动自述与文档桥一致

`iagent_auto_workflow` 的技能 description、Phase 3 与 Phase 4 的阶段说明 SHALL 披露"验证与深度复查后有一次需求文档业务桥"，MUST NOT 声称该阶段"无需任何用户确认"或"L1-L5 后全自动无停顿"。该桥 SHALL 为其验证阶段唯一的流程级阻塞门；桥后 SHALL 继续既定 auto-mode，MUST NOT 追加"是否调用 `spec_apply`"的确认。

#### Scenario: 自述与阶段说明一致

- **WHEN** 检查 `iagent_auto_workflow` 的 description 与 Phase 3 / Phase 4 段落
- **THEN** 均 SHALL 披露需求文档桥的存在，MUST NOT 残留"该阶段无需用户确认"的整体表述

#### Scenario: 桥后不追加确认

- **WHEN** 用户在文档桥选择生成或跳过
- **THEN** 流程 SHALL 直接进入 Phase 4（自动实现），不出现"是否调用 `iagent_spec_apply`"的询问

#### Scenario: 桥不扩大门预算

- **WHEN** 统计 auto-workflow 验证阶段的阻塞确认门
- **THEN** 该阶段 SHALL 仅有文档桥 1 个流程级阻塞门
