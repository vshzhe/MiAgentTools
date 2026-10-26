## ADDED Requirements

### Requirement: 编排技能 SHALL 委派其声明的全部子技能且齐备授权

编排技能正文中所有"经 Skill 工具委派 `<skill>`"的动作 MUST 在 `allowedTools` 中声明 `Skill(<裸名>)`，且该无条件委派 MUST 由 `DEPS` 覆盖（随装）。MUST NOT 出现"正文要求委派但白名单未授权"或"白名单声明但正文从不委派"的双向不一致。

#### Scenario: auto-workflow 委派 apply/archive 时白名单齐备

- **WHEN** `iagent_auto_workflow` Phase 4/5 委派 `iagent_spec_apply` / `iagent_spec_archive`
- **THEN** 其 `allowedTools` SHALL 含 `Skill(spec_apply)`、`Skill(spec_archive)`
- **AND** 条件委派 `iagent_test` 时 SHALL 含 `Skill(test)`
- **AND** `DEPS['auto-workflow']` SHALL 覆盖这些依赖

#### Scenario: 白名单无幽灵条目

- **WHEN** 运行回归锁扫描全部技能
- **THEN** 每个 `Skill(<裸名>)` 条目 SHALL 在正文中被引用为委派或被文档化为例外
- **AND** 命中幽灵条目时 SHALL 失败

### Requirement: auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议

`iagent_auto_workflow` 的 Phase 4（自动实现）与 Phase 5（自动归档）SHALL 经 Skill 工具委派 `iagent_spec_apply`（传 `auto-mode=true`）与 `iagent_spec_archive`（传 `change-name`），MUST NOT 重定义 / 内联复述其派发协议与共享资源协议（context-pack / output ledger / minimal receipt / shared instruction prefix）。`auto-mode=true` 仅跳过设计确认门，MUST NOT 免除共享资源协议与退出守卫。

#### Scenario: Phase 4 委派而非内联

- **WHEN** auto-workflow 验证通过后进入 Phase 4
- **THEN** SHALL 委派 `iagent_spec_apply`（`auto-mode=true`）
- **AND** MUST NOT 出现"Execute the apply workflow logic"式的内联执行描述
- **AND** MUST NOT 声明"MUST NOT re-declare the protocol text"却同时内联执行（自相矛盾）

#### Scenario: Phase 5 委派而非内联

- **WHEN** auto-workflow 实现与编译检查完成后进入 Phase 5
- **THEN** SHALL 委派 `iagent_spec_archive`（`change-name`）
- **AND** 需求文档对齐 SHALL 沿用 archive 步骤 4.8 的单一源规则（present → 就地对齐；absent → 非交互委派 `requirement-doc`）

#### Scenario: 测试执行门继承

- **WHEN** auto-workflow 的委派 apply 进入测试执行门
- **THEN** SHALL 复用 `iagent_spec_apply` §9 的门（change scope、in-scope 失败重试 3 次后暂停、out-of-scope 仅 WARN）
- **AND** MUST NOT 在 auto-workflow 内另立第二份测试门定义

### Requirement: 编排技能正文 SHALL 无被移除阶段的 stale 残留

当某阶段已由"内联生成"改为"委派子技能"后，编排技能正文中的旧执行描述（Examples、Guardrails、Checkpoint 日志）MUST 同步更新；MUST NOT 同时存在"委派"与"no Skill delegation / inline generation"两种相互矛盾的指令。

#### Scenario: workflow 正文委派一致

- **WHEN** 检查 `iagent_workflow` 正文
- **THEN** Phase 2.3 委派 `iagent_spec_propose` 的声明 SHALL 与 Guardrails / Examples 一致
- **AND** MUST NOT 残留 `MUST use inline generation for artifacts` 或 `Executing inline artifact generation` 等与委派相矛盾的文本

### Requirement: 实现验证桥接 SHALL 与 DEPS 一致

编排技能在 apply 与 archive 之间 SHALL 执行实现验证（`iagent_spec_verify`）或在正文显式声明省略理由；编排器行为 MUST 与 `DEPS`（`spec-archive ⇒ spec-verify`）保持一致。

#### Scenario: workflow 实现验证桥接

- **WHEN** `iagent_workflow` Phase 4 实现完成、准备进入 Phase 5 归档
- **THEN** SHALL 委派 `iagent_spec_verify`（或在归档桥就绪检查中显式声明由 apply 编译检查 + 归档一致性承担、并记录该省略决策）
- **AND** 归档桥就绪检查 SHALL 反映该决策

### Requirement: 提案验证契约 SHALL 唯一且双门非重叠

提案质量验证的维度契约（D1-D5 核心 + D6-D10 条件，统一 90% 阈值）MUST 只有一份定义（`iagent_spec_verify_proposal`），其他技能 MUST 只引用该契约，MUST NOT 使用 `D1-D6` / `D1-D9` 等不一致的子集表述。`iagent_proposal_review` SHALL 定位为 `spec_verify_proposal` PASS 之后的**非重叠深度层**，MUST NOT 重复同一套评分。

#### Scenario: 维度表述唯一

- **WHEN** 运行回归锁扫描全部技能模板
- **THEN** 提案验证维度的契约串 SHALL 与 `iagent_spec_verify_proposal` 的定义一致
- **AND** 命中 `D1-D6` / `D1-D9` 等不一致表述时 SHALL 失败

#### Scenario: 双门职责非重叠

- **WHEN** workflow / auto-workflow / debug 在 PASS 后触发 `iagent_proposal_review`
- **THEN** 其定位 SHALL 为评分门之后的深度一致性 / 覆盖度复查
- **AND** MUST NOT 被描述为"再跑一次 D1-DN 评分"
