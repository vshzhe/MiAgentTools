## ADDED Requirements

### Requirement: 编排执行方式内联优先与验证证据契约

(D1, D2, D5) `iagent_workflow` / `iagent_auto_workflow` / `iagent_debug` 的执行方式 SHALL 按以下版图分配：

- **子代理**：`propose`、`apply`、`spec-bulk-archive` 的内部并行单元；
- **主 agent 内联**：`verify`、`archive`（单变更）、`debug fix`、`debug verify-close` 内的验证 / 复查。

`verify` 阶段 SHALL 以**单轮内联**完成，MUST NOT 再分别派生 `iagent_spec_verify_proposal` 与
`iagent_proposal_review` 两个子代理；内联验证 SHALL 使用固定清单（D1-D10 核心维度 + B1-B7 边界），
每条结论 MUST 带 `文件:行` 或制品章节锚点证据，无证据结论 MUST NOT 计入通过。

验证 FAIL 后 SHALL 在同一主上下文内修复并按 `fixDiff` 重跑清单，MUST NOT 新开验证代理或从头全量重读；
循环上限 SHALL 为 3 次，超出 SHALL 暂停并报告。验证结果 SHALL 落盘
`.openspec-tmp/pipeline-<change-name>/verify-report.md`，回执 SHALL 记 `executionMode=inline` /
`independence=self` / `readScope`。

`archive`（单变更）SHALL 由主 agent 内联执行既有归档协议，非阻断语义不变；`spec-bulk-archive` 的并行单元
SHALL 保留子代理（≤3）。`debug fix` SHALL 内联执行修复、编译检查与范围内测试，共用既有重试预算。

各技能的 `allowedTools` SHALL 与正文一致：内联阶段 MUST NOT 保留 `Agent, Task` 授权；仍以 Skill 工具
内联调用的子技能（如 `iagent_test`）SHALL 保留对应 `Skill(...)` 条目。

#### Scenario: 验证单轮内联

- **WHEN** 编排进入 `verify` 阶段
- **THEN** 主 agent SHALL 直接执行固定清单验证并返回 `executionMode=inline`
- **AND** MUST NOT 派生 `iagent_spec_verify_proposal` / `iagent_proposal_review` 子代理

#### Scenario: 无证据结论不计分

- **WHEN** 某维度结论未附 `文件:行` 或章节锚点
- **THEN** 该结论 MUST NOT 计入通过
- **AND** 验证报告 SHALL 将其标为缺证据

#### Scenario: 同上下文修复重跑

- **WHEN** 验证 FAIL 且主 agent 完成修复
- **THEN** 主 agent SHALL 在同一上下文按 `fixDiff` 重跑清单
- **AND** MUST NOT 新开验证代理或重读未改动制品；循环超过 3 次 SHALL 暂停报告

#### Scenario: 单变更归档内联

- **WHEN** 编排进入 `archive` 阶段且为单变更
- **THEN** 主 agent SHALL 默认内联执行归档协议并返回 `executionMode=inline`
- **AND** delta 冲突合并与 CONTEXT 同步失败仍按既有非阻断语义处理
- **AND** 兼容窗内旧 `subagent` 回执按兼容窗处理，MUST NOT 被判违约

#### Scenario: 批量归档保留并行

- **WHEN** 执行 `spec-bulk-archive`
- **THEN** 其内部并行单元 SHALL 保留子代理（≤3）
- **AND** 单元失败隔离语义不变

#### Scenario: debug 修复内联

- **WHEN** debug 进入 `fix` 阶段
- **THEN** 修复、编译检查与范围内测试 SHALL 由主 agent 内联执行
- **AND** 编译 / 测试重试预算 SHALL 与既有约定一致（≤3）

#### Scenario: 兼容窗旧回执

- **WHEN** `archive` / `fix` 回执为 `executionMode=subagent`（旧 in-flight）
- **THEN** 阶段 SHALL 允许推进并记 deprecation WARN
- **AND** MUST NOT 判定为执行方式违约

#### Scenario: 白名单与正文一致

- **WHEN** 技能正文将 `verify` / `archive` / `fix` 改为内联
- **THEN** `allowedTools` MUST NOT 再含 `Agent, Task`
- **AND** 仍以 Skill 工具调用的子技能 SHALL 保留 `Skill(...)` 条目
