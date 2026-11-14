## ADDED Requirements

### Requirement: 实现后测试调用强制子阶段

三个父编排技能（`iagent_workflow` / `iagent_auto_workflow` / `iagent_debug`）在实现阶段完成后 MUST 存在显式强制测试子阶段：主 agent 内联调用 `iagent-test` 技能，对变更范围内未被 `[测试]` 任务覆盖的有行为改动文件补齐单测并执行；不测清单判定 MUST 留痕（「没写测试」与「没评估过」可区分）。降级路径 MUST 收紧（D1/D4/D9）：

- `iagent_test` 不可用（宿主不支持内联调用）→ strict 阻断并报告，MUST NOT 静默跳过、MUST NOT 表述为「已测试」，记录「未发生内联技能调用」；仅显式 degraded 协商才允许降级并透明记录（D9）。
- `testGate.autoGenerate=false`（项目配置显式关闭）→ 显式 degraded：留痕 + WARN「自动补测已由项目配置关闭」，不阻断；MUST NOT 表述为「已测试」（B-2）。
- 变更范围内无任何有行为改动文件（纯文档/纯配置）→ 自动单测补齐判定「无可测文件」，不测清单留痕 + 测试门 `not-applicable` 放行，不阻断归档（B-1）。

#### Scenario: 有行为改动文件时强制调用 iagent-test

- **WHEN** 实现阶段完成且变更范围存在有行为改动的文件
- **THEN** 主 agent 内联调用 `iagent-test` 补齐缺口单测并执行范围内测试，调用为显式强制子阶段而非条件分支

#### Scenario: iagent_test 不可用时 strict 阻断

- **WHEN** 内联调用 `iagent_test` 的宿主能力缺失且未经显式 degraded 协商
- **THEN** 阻断并报告，记录「未发生内联技能调用」，MUST NOT 继续后续阶段且 MUST NOT 表述为「已测试」

#### Scenario: 项目配置关闭自动补测时显式 degraded

- **WHEN** `testGate.autoGenerate=false`
- **THEN** 留痕 + WARN「自动补测已由项目配置关闭」，不阻断后续阶段，且 MUST NOT 表述为「已测试」

#### Scenario: 无可测文件时 not-applicable 放行

- **WHEN** 变更范围内无任何有行为改动的文件
- **THEN** 不测清单留痕 + 测试门 `not-applicable` 放行，不阻断归档

### Requirement: 范围内测试失败修复循环与暂停

范围内测试执行门失败时 MUST 自动修复并重跑（与编译检查共用 ≤3 次预算）；3 次尝试后仍失败 MUST 暂停并向用户报告，MUST NOT 静默通过、MUST NOT 进入 review 环节或归档（既有 Step 9 / debug §5.5 / auto-workflow §4.3 语义统一收口）。

#### Scenario: 测试修复预算耗尽时暂停

- **WHEN** 范围内测试失败且自动修复重跑已达 3 次
- **THEN** 暂停并报告失败详情，MUST NOT 进入 review 环节、实现验证桥或归档

### Requirement: 实现后 review 环节

三个父编排技能 MUST 在实现验证桥（`spec_verify` 一致性）通过后、归档门之前插入 `iagent_review` 代码审查环节（D2/D5），检查功能实现完整度：

- review 报告 MUST 落盘并纳入归档就绪检查（D5）。
- P0/P1 问题 MUST 回实现阶段修复循环（与编译/测试共用既有 ≤3 重试预算）；review 未收束（P0/P1 未修复）MUST NOT 进入归档门（D7/B-6）。
- P2 问题记录不阻断（D7）。
- 变更范围无代码改动（纯制品/文档）→ review `not-applicable` 留痕直通，不阻断（B-3）。
- `iagent_review` 不可用（宿主不支持内联调用）→ strict 阻断并报告；仅显式 degraded 协商才允许降级并透明记录「未发生内联技能调用」（D9）。

#### Scenario: 验证桥通过后执行代码审查

- **WHEN** 实现验证桥（spec_verify）通过且变更范围存在代码改动
- **THEN** 主 agent 内联调用 `iagent_review` 执行代码审查，报告落盘并纳入归档就绪检查

#### Scenario: P0 或 P1 未收束时不进入归档门

- **WHEN** review 产出 P0 或 P1 问题且修复循环未收束
- **THEN** 回实现阶段修复（共用 ≤3 预算），MUST NOT 进入归档门；3 次耗尽仍未收束时暂停并报告

#### Scenario: P2 问题记录不阻断

- **WHEN** review 产出仅 P2 问题
- **THEN** 记录到 review 报告，不阻断流程推进

#### Scenario: 无代码改动时 not-applicable 留痕直通

- **WHEN** 变更范围无代码改动（纯制品/文档）
- **THEN** review 环节判定 `not-applicable` 并留痕，直接进入后续阶段

#### Scenario: iagent_review 不可用时 strict 阻断

- **WHEN** 内联调用 `iagent_review` 的宿主能力缺失且未经显式 degraded 协商
- **THEN** 阻断并报告，记录「未发生内联技能调用」，MUST NOT 静默跳过 review 环节

### Requirement: auto-workflow 归档确认门

`iagent_auto_workflow` 的 Phase 5 MUST 在自动归档执行前插入归档确认门（⛔ GATE，D3/D6）：呈现「实现摘要 + 三类证据（compile/test/conformance）+ 测试结果」，等待用户确认功能完成后才执行归档；语义复用 `iagent_workflow` 5.1 归档确认门蓝本，位置在测试门与实现验证桥通过之后。

- 拒绝出口：拒绝 = 返回实现阶段继续（不归档），与 `iagent_workflow` 5.1 出口一致；MUST NOT 提供「跳过归档」选项（D8）。
- 含糊回复（未给具体项）→ 按拒绝出口处理，MUST NOT 猜测意图为确认（fail-safe 取保守侧，B-5）。
- 门等待期间用户中断 → 保持暂停不归档；确认门无超时跳过，resume 时重新呈现门（B-4）。
- `iagent_workflow` 既有 5.1 门与 `iagent_debug` 的收束提示（不归档）不受本需求影响（D3 范围边界）。

#### Scenario: 用户确认后执行归档

- **WHEN** 测试门与实现验证桥通过且用户在归档确认门确认功能完成
- **THEN** 执行归档（spec_archive 内联），不再追加其它停点

#### Scenario: 用户拒绝时返回实现阶段

- **WHEN** 用户在归档确认门拒绝（或回复含糊未给出具体项）
- **THEN** 返回实现阶段继续（不归档），MUST NOT 归档且 MUST NOT 提供跳过归档选项

#### Scenario: 门等待中断时保持暂停

- **WHEN** 归档确认门等待期间用户中断会话
- **THEN** 保持暂停不归档；resume 时重新呈现该门

### Requirement: review 委派白名单同步

三个父编排技能模板的 `skillDelegation([...])` 委派清单 MUST 同步追加 review 委派条目（canonical 宿主技能 ID），使实现后 review 环节在宿主权限层可放行；条目经共享常量派生，MUST NOT 逐模板手写字面量、MUST NOT 使用通配（D2/项目护栏）。

#### Scenario: 生成快照含 review 委派条目

- **WHEN** 模板改动后执行 `pnpm build && pnpm generate:skills` 重新生成快照
- **THEN** 三个父编排技能的 allowedTools 委派清单均含 review 委派条目，且无通配条目
