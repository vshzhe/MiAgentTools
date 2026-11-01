## MODIFIED Requirements

### Requirement: auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议

`iagent_auto_workflow` 的 Phase 4（自动实现）与 Phase 5（自动归档）SHALL 经 Skill 工具委派 `iagent_spec_apply`（传 `gate-skip=design-confirmation`；`auto-mode=true` 为等价兼容写法）与 `iagent_spec_archive`（传 `change-name`），MUST NOT 重定义 / 内联复述其派发协议与共享资源协议（context-pack / output ledger / minimal receipt / shared instruction prefix）。`gate-skip=design-confirmation` 仅跳过设计确认门，MUST NOT 免除共享资源协议与退出守卫。

auto-workflow 的阶段门声明 SHALL 与其协议阶段清单一致：验证阶段唯一的流程级阻塞门是需求文档桥，实现与归档阶段除该桥外无其他用户确认；MUST NOT 声明「无门」同时又在协议中要求 `implementation-bridge` / `archive-confirmation`。

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

## ADDED Requirements

### Requirement: 父流程编译证据就绪检查

编排技能（`iagent_workflow` Phase 5.1 归档桥就绪检查、`iagent_auto_workflow` Phase 4.2 错误处理与 Phase 5.1 自动归档前置）SHALL 以 `iagent_spec_apply` 产出的**编译证据文件**作为编译检查通过的唯一判据：读取 `.openspec-tmp/pipeline-<change-name>/compile-report.md` 的 `status` 字段，或读取 handoff 包 `## 阶段结论` 的 `compile` 行（两者不一致时以证据文件为准并记 WARN）。

判定 SHALL 为：`status ∈ {pass, not-applicable, disabled}` 放行进入归档（`not-applicable` 与 `disabled` SHALL 在摘要中记 WARN 并说明原因，MUST NOT 表述为「编译检查通过」）；`status = fail`、证据文件缺失、或证据存在但无法解析出汇总状态 → **阻断归档并回到实现**，输出含期望路径与失败原因的说明。

父流程 MUST NOT 自行执行编译或测试命令（编译与测试由 `iagent_spec_apply` 单点负责），MUST NOT 以「tasks.md 全部勾选」「实现已验证」等替代证据，MUST NOT 因证据缺失而询问用户是否跳过。

**状态词汇与读取位置**：证据的 `status` 取编译终态四值（`pass` / `fail` / `not-applicable` / `disabled`），与结构化回执的 `ReceiptStatus`（`ok` / `failed` / `blocked` / `incomplete`）不是同一套词汇。父流程 SHALL 读取证据文件的 `**summary**:` 汇总行（或 handoff `## 阶段结论` 的 `compile` 行作为辅助），MUST NOT 用表格最后一行的状态代表整个变更，也 MUST NOT 把回执 `status=ok` 当作编译通过。

#### Scenario: workflow 归档桥读取证据

- **WHEN** `iagent_workflow` 执行 Phase 5.1 归档桥就绪检查
- **THEN** 就绪条件包含「编译证据存在且 `status ∈ {pass, not-applicable, disabled}`」；证据缺失或 `fail` 时阻断归档并回到 Phase 4

#### Scenario: auto-workflow 自动归档前置读取证据

- **WHEN** `iagent_auto_workflow` 准备进入 Phase 5 自动归档
- **THEN** 它先读取编译证据；`missing` / `fail` 时 MUST NOT 自动归档，改为暂停并向用户报告

#### Scenario: 证据不可解析等同缺失

- **WHEN** `compile-report.md` 存在但缺少 `**summary**:` 汇总行或字段被截断
- **THEN** 父流程按 `missing` 处理并阻断归档，MUST NOT 因文件存在而放行

#### Scenario: 多命令按汇总行而非末行判定

- **WHEN** 证据表格含多行且汇总行为 `status=fail`
- **THEN** 父流程判 `fail` 并阻断归档，MUST NOT 取最后一行 `pass` 放行

#### Scenario: 编译终态与回执状态词汇不混用

- **WHEN** 父流程读取 handoff 包 `## 阶段结论` 的 `compile` 行
- **THEN** 该行 `status` 按编译四值解读；父流程 MUST NOT 要求其为 `ok` / `failed` 等回执状态，也 MUST NOT 用回执 `status=ok` 代替编译证据

#### Scenario: 父流程不执行编译也不扩权限

- **WHEN** 父流程执行归档就绪检查
- **THEN** 它只读取证据文件，MUST NOT 运行编译 / 测试命令，MUST NOT 因此向自身 `allowedTools` 追加 `Bash(tsc:*)` 一类编译条目

#### Scenario: 编译失败沿用既有暂停语义

- **WHEN** 委派 apply 的编译检查重试耗尽（证据 `status=fail`）
- **THEN** 父流程 SHALL 暂停等待用户指示，MUST NOT 进入归档（与既有「编译检查失败后暂停」语义一致）
