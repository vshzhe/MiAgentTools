## ADDED Requirements

### Requirement: workflow 实现桥承载 apply 设计门

`iagent_workflow` 的 Phase 4 SHALL 向 `iagent_spec_apply` 传入 `gate-skip=design-confirmation`（表示设计确认已由其 Phase 3.7 实现 + 测试桥承载），MUST NOT 依赖 `auto-mode=true` 这一旧名称作为唯一表达方式。

传入该参数 MUST NOT 使 apply 的其他门、停点、共享资源协议或退出守卫失效；实现桥本身 MUST 保持为不可豁免门。

#### Scenario: workflow 以门承载参数委派 apply

- **WHEN** workflow 通过实现桥进入 Phase 4
- **THEN** 委派 `iagent-spec-apply` 时 SHALL 传 `gate-skip=design-confirmation`
- **AND** MUST NOT 因此跳过测试执行门、范围蔓延确认或批调度协议

#### Scenario: 实现桥缺失时门仍生效

- **WHEN** workflow 未取得实现桥确认即试图进入 Phase 4
- **THEN** 实现 + 测试桥 SHALL 阻塞推进，MUST NOT 以「已传 gate-skip」为由绕过

## MODIFIED Requirements

### Requirement: auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议

`iagent_auto_workflow` 的 Phase 4（自动实现）与 Phase 5（自动归档）SHALL 经 Skill 工具委派 `iagent_spec_apply`（传 `gate-skip=design-confirmation`；`auto-mode=true` 为等价兼容写法）与 `iagent_spec_archive`（传 `change-name`），MUST NOT 重定义 / 内联复述其派发协议与共享资源协议（context-pack / output ledger / minimal receipt / shared instruction prefix）。`gate-skip=design-confirmation` 仅跳过设计确认门，MUST NOT 免除共享资源协议与退出守卫。

auto-workflow 的阶段门声明 SHALL 与其协议阶段清单一致：验证阶段唯一的流程级阻塞门是需求文档桥，实现与归档阶段除该桥外无其他用户确认；MUST NOT 声明「无门」同时又在协议中要求 `implementation-bridge` / `archive-confirmation`。

#### Scenario: Phase 4 委派而非内联

- **WHEN** auto-workflow 验证通过后进入 Phase 4
- **THEN** SHALL 委派 `iagent_spec_apply`（`gate-skip=design-confirmation`）
- **AND** MUST NOT 出现 “Execute the apply workflow logic” 式的内联执行描述
- **AND** MUST NOT 声明 “MUST NOT re-declare the protocol text” 却同时内联执行（自相矛盾）

#### Scenario: Phase 5 委派而非内联

- **WHEN** auto-workflow 实现与编译检查完成后进入 Phase 5
- **THEN** SHALL 委派 `iagent_spec_archive`（`change-name`）
- **AND** 需求文档对齐 SHALL 沿用 archive 步骤 4.8 的单一源规则（present → 就地对齐；absent → 非交互委派 `requirement-doc`）

#### Scenario: 测试执行门继承

- **WHEN** auto-workflow 的委派 apply 进入测试执行门
- **THEN** SHALL 复用 `iagent_spec_apply` §9 的门（change scope、in-scope 失败重试 3 次后暂停、out-of-scope 仅 WARN）
- **AND** MUST NOT 在 auto-workflow 内另立第二份测试门定义

#### Scenario: 阶段门声明与协议一致

- **WHEN** 对比 auto-workflow 模板正文的阶段确认声明与其 `WORKFLOW_PROTOCOLS` 阶段门
- **THEN** 验证阶段的唯一阻塞门 SHALL 是需求文档桥；实现与归档阶段 MUST NOT 声明阻塞门
- **AND** 模板 MUST NOT 出现「本阶段完全无任何用户确认」与协议存在阻塞门并存的自相矛盾表述

### Requirement: auto-workflow 全自动管线 SHALL 经宿主适配器复用 apply/archive 协议

`iagent_auto_workflow` 的自动实现与自动归档 SHALL 经宿主适配器委派 `iagent-spec-apply` 与 `iagent-spec-archive`，不得把 Claude 的 Skill/Agent/Task 调用字面量作为跨宿主唯一实现。`gate-skip=design-confirmation`（`auto-mode=true` 为等价兼容写法）只跳过设计确认门，不得豁免共享资源、回执、失败重试与退出守卫。

在 Codex 等 skills-only 宿主下，auto-workflow 的自动阶段 SHALL 按显式 degraded 路径由当前 agent 本地执行并声明「不构成委派」，MUST NOT 伪装为严格的子代理回执或空洞地满足阶段门。

#### Scenario: OpenCode V2 auto apply

- **WHEN** OpenCode V2 auto-workflow 通过验证进入实现阶段
- **THEN** SHALL 使用 V2 subagent/agent 执行 apply
- **AND** SHALL 汇总其 receipt 后才进入归档

#### Scenario: Pi degraded auto workflow

- **WHEN** Pi 未安装 strict Extension 且用户显式选择 degraded
- **THEN** 系统 SHALL 标记自动委派未执行
- **AND** 不得把当前 agent 本地实现标记为子 agent 完成

#### Scenario: Codex 自动管线显式本地执行

- **WHEN** codex 被纳为生效工具且 auto-workflow 进入 Phase 4
- **THEN** 产物 SHALL 显式声明该阶段由当前 agent 本地执行、不构成委派
- **AND** MUST NOT 声称已获得宿主原生阶段回执

#### Scenario: Failure remains blocking

- **WHEN** 委派、回执或测试执行失败
- **THEN** workflow SHALL 保留失败状态并报告恢复路径
- **AND** MUST NOT 静默推进归档
