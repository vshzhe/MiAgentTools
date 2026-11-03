## MODIFIED Requirements

### Requirement: 实现桥合并（实现确认 + 测试计划）

`iagent_workflow` 的实现确认桥（Phase 3.7）、同一阶段内的需求文档桥（Phase 3.5）与条件测试计划确认门 SHALL 合并为单一「**交付桥**」：一次呈现「提案摘要 + 验证评分 + 深度复查结论 + 实现方案 + 测试计划预告 + 是否生成需求文档」，一次确认；拒绝时回退范围（回探索 / 回提案 / 回实现范围）SHALL 在同一门内显式。

合并**只合并确认面，不删除门**：`implementation-bridge` 仍是实现阶段唯一阻塞门（不可豁免），需求文档的「生成 / 跳过」只是该门内的一个选项，MUST NOT 因此在验证阶段与实现阶段之间保留第二个停点。验证 FAIL、重验循环中或深度复查未收束时 MUST NOT 呈现该桥。

交付桥出口 SHALL 为：

- **确认（实现 + 生成文档）** → 委派 `iagent_requirement_doc` 后进入实现；
- **确认（仅实现，跳过文档）** → 文档状态写 `skipped-by-user`，进入实现；
- **仅生成文档** → 委派生成文档、状态写 `generated`，**不进入实现**，停在规划边界（可随后由用户单独发起 `/iagent:spec-apply`）；
- **修改** → 回 Phase 2 / Phase 1 调整制品，MUST NOT 进入实现；
- **拒绝** → 记录未确认状态并停止。

需求文档状态的持久化与回执交付语义 SHALL 保持不变：状态写入变更 `exploration.md` 的 `## 需求文档状态` 段（取值 `skipped-by-user` / `generation-failed` / `generated`），并同时写入阶段回执的 `requirementDocStatus`；写入失败（重试一次后仍失败）→ MUST NOT 委派生成、MUST NOT 进入实现，输出含目标路径与原因的 WARN 与恢复指引。

合并 SHALL 保留既有的**可断言术语与护栏**，MUST NOT 因改名造成既有回归面失效：「实现 + 测试桥」这一桥名、`单次业务桥`（一次确认）语义与「FAIL 不出文档桥」护栏句 MUST 继续出现在 `iagent_workflow` 正文中（可与「交付桥」并列表述）；既有回归断言 MUST 在实现后通过 —— 允许同步更新断言口径，MUST NOT 以删除断言代替同步。

#### Scenario: 单门呈现实现与测试计划

- **WHEN** 提案验证通过、深度复查收束、准备进入实现
- **THEN** 系统 SHALL 以单一「交付桥」呈现「提案摘要 + 验证评分 + 深度复查结论 + 实现方案 + 测试计划预告 + 是否生成需求文档」
- **AND** 用户确认一次即进入实现（含条件测试生成），MUST NOT 在实现阶段再设第二个确认门

#### Scenario: 拒绝回退范围明确

- **WHEN** 用户在该门拒绝
- **THEN** 门内 SHALL 提供回退选项（修改提案 / 回探索补决策 / 仅调整测试计划）
- **AND** MUST NOT 进入实现

#### Scenario: 交付桥承载文档选项且不再二次停顿

- **WHEN** 验证通过且深度复查收束
- **THEN** 文档「生成 / 跳过」选项 SHALL 与实现方案在同一门内一次呈现
- **AND** MUST NOT 在验证阶段先单独停一次文档桥、再在实现阶段停第二次

#### Scenario: 仅生成文档停在规划边界

- **WHEN** 用户在交付桥选择「仅生成文档」
- **THEN** 系统 SHALL 生成需求文档并把 `requirementDocStatus` 写为 `generated`
- **AND** MUST NOT 进入实现（不委派 `iagent_spec_apply`），停在规划边界
- **AND** 后续实现 MUST 由用户单独发起请求触发

#### Scenario: 文档状态持久化失败不进入实现

- **WHEN** 交付桥收束后写入 `## 需求文档状态` 失败（重试一次仍失败）
- **THEN** 系统 MUST NOT 报告阶段完成、MUST NOT 进入实现，输出含目标路径与原因的 WARN 与恢复指引

#### Scenario: 合并不破坏既有可断言术语与护栏

- **WHEN** 审查合并后的 `iagent_workflow` 正文（含 `references/*.md` 与指令派生版）
- **THEN** 正文 SHALL 仍含「实现 + 测试桥」桥名、`单次业务桥` 语义与「FAIL 不出文档桥」护栏句（可与「交付桥」并列）
- **AND** 受影响的既有回归断言（`test/artifact-dataflow.test.ts` / `test/template-consistency.test.ts` / `test/template-derivation.test.ts` 中针对上述术语的断言）SHALL 在实现后通过，MUST NOT 以删除断言代替同步

### Requirement: workflow 实现桥承载 apply 设计门

`iagent_workflow` 的 Phase 4 SHALL 向 `iagent_spec_apply` 传入 `gate-skip=design-confirmation`（表示设计确认已由其 Phase 3.7 交付桥承载），MUST NOT 依赖 `auto-mode=true` 这一旧名称作为唯一表达方式。

**委派前写门账本（U4）**：交付桥确认后、委派前，父级 SHALL 把 `design-confirmation` 写入 handoff 包 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md` 的 `## 已确认门` 段，并在委派前**校验该段与条目存在**；写入失败或校验失败 → SHALL 停止并报告期望路径与原因，MUST NOT 委派。阶段回执 SHALL 携带 `confirmedGates: ['design-confirmation']`，账本条目 MUST NOT 超出回执声明。

参数与账本构成**主通道 + 兜底**：`gate-skip` 仍随委派传递（主通道），账本仅在参数丢失时生效；两者皆缺失时被委派 apply 的设计确认门 SHALL 照常触发（MUST NOT 静默跳过）。

传入该参数或使用账本兜底 MUST NOT 使 apply 的其他门、停点、共享资源协议或退出守卫失效；实现桥（交付桥）本身 MUST 保持为不可豁免门。

#### Scenario: workflow 以门承载参数委派 apply

- **WHEN** workflow 通过交付桥进入 Phase 4
- **THEN** 委派 `iagent-spec-apply` 时 SHALL 传 `gate-skip=design-confirmation`
- **AND** MUST NOT 因此跳过测试执行门、范围蔓延确认或批调度协议

#### Scenario: 实现桥缺失时门仍生效

- **WHEN** workflow 未取得交付桥确认即试图进入 Phase 4
- **THEN** 交付桥 SHALL 阻塞推进，MUST NOT 以「已传 gate-skip」为由绕过

#### Scenario: 委派前写账本并校验存在

- **WHEN** 用户在交付桥确认实现
- **THEN** 父级 SHALL 立即把 `design-confirmation` 写入 `## 已确认门` 并在委派前校验存在
- **AND** 阶段回执 SHALL 携带 `confirmedGates: ['design-confirmation']`

#### Scenario: 账本写入失败时停止不委派

- **WHEN** `## 已确认门` 写入失败或委派前校验失败（工作区不可写 / 段缺失）
- **THEN** 父级 SHALL 停止并报告期望路径与原因，MUST NOT 委派 `iagent_spec_apply`

#### Scenario: 账本缺失时设计门仍由 apply 触发

- **WHEN** 委派时 `gate-skip` 丢失且账本条目缺失
- **THEN** 被委派 apply 的 Step 5.5 设计确认门 SHALL 照常执行，MUST NOT 静默跳过

### Requirement: auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议

`iagent_auto_workflow` 的 Phase 4（自动实现）与 Phase 5（自动归档）SHALL 经 Skill 工具委派 `iagent_spec_apply`（传 `gate-skip=design-confirmation`；`auto-mode=true` 为等价兼容写法）与 `iagent_spec_archive`（传 `change-name`），MUST NOT 重定义 / 内联复述其派发协议与共享资源协议（context-pack / output ledger / minimal receipt / shared instruction prefix）。`gate-skip=design-confirmation` 仅跳过设计确认门，MUST NOT 免除共享资源协议与退出守卫。

**文档桥后写门账本**：需求文档桥收束（`generated` / `skipped-by-user` / `generation-failed`）后、委派前，父级 SHALL 把 `design-confirmation` 写入 handoff 包 `## 已确认门` 段并在委派前校验存在；阶段回执 SHALL 携带 `confirmedGates: ['design-confirmation']`。`gate-skip` 继续随委派传递（主通道），账本为参数丢失时的兜底；两者皆缺失时被委派 apply 的设计门 SHALL 照常触发（MUST NOT 静默跳过）。账本写入 / 校验失败 → 停止并报告，MUST NOT 继续自动委派。

auto-workflow 的阶段门声明 SHALL 与其协议阶段清单一致：验证阶段唯一的流程级阻塞门是需求文档桥（本变更**保留**该桥为 auto-workflow 的唯一门，MUST NOT 与 workflow 一并合并），实现与归档阶段除该桥外无其他用户确认；MUST NOT 声明「无门」同时又在协议中要求 `implementation-bridge` / `archive-confirmation`。

**Phase 5 归档描述 SHALL 与 archive 技能的当前写入面一致**：正文对归档步骤的枚举 MUST NOT 出现「需求文档就地增量对齐（step 4.8）」「需求文档迁移至 devdocs」等已被移除的写入分支；`requirementDocStatus` 仅作为传给 archive 的报告输入（跨会话追溯），MUST NOT 被描述为触发归档侧生成 / 对齐 / 迁移的依据。auto-workflow 自身 MUST NOT 生成、对齐或迁移 `需求文档.md`。

#### Scenario: Phase 4 委派而非内联

- **WHEN** auto-workflow 验证通过后进入 Phase 4
- **THEN** SHALL 委派 `iagent_spec_apply`（`gate-skip=design-confirmation`）
- **AND** MUST NOT 出现 “Execute the apply workflow logic” 式的内联执行描述
- **AND** MUST NOT 声明 “MUST NOT re-declare the protocol text” 却同时内联执行（自相矛盾）

#### Scenario: Phase 5 委派而非内联

- **WHEN** auto-workflow 实现、编译检查与测试门完成后进入 Phase 5
- **THEN** SHALL 委派 `iagent_spec_archive`（`change-name` + 可选 `requirementDocStatus`）
- **AND** 归档侧对需求文档只做**存在性报告**（不生成 / 不对齐 / 不迁出），auto-workflow MUST NOT 复制或补充该分支规则

#### Scenario: Phase 5 正文无已移除分支残留

- **WHEN** 检查 auto-workflow 正文对归档步骤的枚举
- **THEN** MUST NOT 出现「4.8」「需求文档迁移至 devdocs」「就地增量对齐」一类已移除步骤的描述；`requirementDocStatus` 若出现，SHALL 仅作报告输入说明

#### Scenario: 测试执行门继承

- **WHEN** auto-workflow 的委派 apply 进入测试执行门
- **THEN** SHALL 复用 `iagent_spec_apply` §9 的门（change scope、in-scope 失败重试 3 次后暂停、out-of-scope 仅 WARN）
- **AND** MUST NOT 在 auto-workflow 内另立第二份测试门定义

#### Scenario: 阶段门声明与协议一致

- **WHEN** 对比 auto-workflow 模板正文的阶段确认声明与其 `WORKFLOW_PROTOCOLS` 阶段门
- **THEN** 验证阶段的唯一阻塞门 SHALL 是需求文档桥；实现与归档阶段 MUST NOT 声明阻塞门
- **AND** 模板 MUST NOT 出现「本阶段完全无任何用户确认」与协议存在阻塞门并存的自相矛盾表述

#### Scenario: 文档桥仍是 auto-workflow 唯一流程级阻塞门

- **WHEN** 统计 auto-workflow 验证 / 实现 / 归档阶段的阻塞确认门
- **THEN** 验证阶段 SHALL 仅有需求文档桥 1 个流程级阻塞门，实现与归档阶段 MUST NOT 新增阻塞门
- **AND** auto-workflow MUST NOT 复用 workflow 的「交付桥合并」语义（文档桥在本链保留为独立门）

#### Scenario: 文档桥后写账本

- **WHEN** 需求文档桥收束后准备自动委派 apply
- **THEN** 父级 SHALL 把 `design-confirmation` 写入 `## 已确认门` 并在委派前校验存在
- **AND** 阶段回执 SHALL 携带 `confirmedGates: ['design-confirmation']`

#### Scenario: gate-skip 丢失时账本兜底

- **WHEN** 自动委派时 `gate-skip` 参数未传达，但账本已声明 `design-confirmation` 且与回执一致
- **THEN** 被委派 apply SHALL 经账本兜底跳过 Step 5.5 并记 WARN
- **AND** 其余门与停点 MUST 照常生效

#### Scenario: 两者皆缺时设计门照常触发

- **WHEN** 自动委派既未传 `gate-skip`，账本段也缺失或无该条目
- **THEN** 被委派 apply 的设计确认门 MUST 照常执行，MUST NOT 静默跳过
- **AND** auto-workflow MUST NOT 把该情形报告为「全自动无停顿」
