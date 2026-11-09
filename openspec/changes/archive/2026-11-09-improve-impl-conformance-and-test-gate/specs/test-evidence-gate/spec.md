## ADDED Requirements

### Requirement: 自动单测补齐

apply SHALL 在编译检查通过后、测试执行门之前，对本次变更范围内「有行为」的生产文件补齐单元测试：先消费 tasks.md 中已规划的 `[测试]` 任务，只对未被覆盖的改动文件生成测试。补齐 SHALL 由主 agent 内联调用 `iagent_test` 完成，MUST NOT 在 apply 内复制框架检测、用例设计或测试生成规则。

「有行为」判定 SHALL 沿用 `iagent_test` 的「该不该测闸门 / 不测清单」：纯数据类、无分支转发方法、私有方法、框架生命周期回调与自动生成代码 MUST NOT 生成测试，且 MUST 在测试证据或报告中留痕「已评估、判定不生成」及依据。

自动补齐 MUST NOT 静默增删 tasks.md 任务；缺口测试只登记到 handoff 包 `## 已产出（跨单元可见）` 与 `test-report.md`。默认开启；项目无测试框架时 SHALL 记录 WARN 并跳过，不阻塞流程。

#### Scenario: 未规划 [测试] 任务时补齐

- **WHEN** 变更的 tasks.md 不含 `[测试]` 任务，且变更范围内存在有行为的生产文件改动
- **THEN** apply SHALL 内联调用 `iagent_test` 为这些文件生成单元测试，并登记到 handoff 包与测试证据

#### Scenario: 已覆盖文件不重复生成

- **WHEN** 某改动文件已有 `[测试]` 任务产出的测试且覆盖其 Scenario
- **THEN** 补齐步骤 MUST NOT 为同一 Scenario 重复生成测试

#### Scenario: 不测清单留痕

- **WHEN** 改动文件仅为纯数据类或无分支转发方法
- **THEN** 报告 MUST 记录「已评估、判定不生成」与依据，MUST NOT 静默跳过

#### Scenario: 项目无测试框架

- **WHEN** 项目未探测到任何测试框架
- **THEN** 自动补齐记录 WARN 并跳过，测试证据标注 `not-applicable`，流程继续

#### Scenario: iagent_test 不可用

- **WHEN** `iagent_test` 技能缺失或宿主为 degraded，无法完成内联调用
- **THEN** 技能 MUST 记录 WARN 与「本阶段未发生内联技能调用」的省略决策，MUST NOT 伪装为已生成测试；测试门仍运行既有范围内测试

### Requirement: 测试证据文件契约

apply 与 debug SHALL 在测试执行后写入 `.openspec-tmp/pipeline-<change-name>/test-report.md`。证据文件 MUST 含固定列 `change` / `command` / `exitCode` / `passCount` / `failCount` / `status` / `scope` / `timestamp` / `reason`，并以 `**summary**: status=<pass|fail|not-applicable|disabled>, commands=<n>, totalPass=<n>, totalFail=<n>` 行汇总。

非执行终态（`not-applicable` / `disabled`）MUST 使用 `-` 占位并写明固定原因「未探测到测试框架」；MUST NOT 留空或用自由文本变体。证据文件 MUST 保留至归档收尾。

#### Scenario: 测试证据产出

- **WHEN** apply 或 debug 完成测试执行
- **THEN** `test-report.md` 存在且含固定列与 `**summary**:` 行，handoff 包 `## 阶段结论` 追加 `test` 行

#### Scenario: 无框架记不适用

- **WHEN** 项目未配置测试框架
- **THEN** 证据记录 `status=not-applicable` 与固定原因，MUST NOT 表述为「测试通过」

### Requirement: 测试门与归档前只读判定

auto-workflow / workflow / debug SHALL 只读 `test-report.md` 的 `**summary**:` 行作为测试门证据，MUST NOT 自行重新执行测试命令或另立第二份判定。`status ∈ {pass, not-applicable, disabled}` 放行；`fail`、缺失或无法解析时 MUST NOT 进入归档。

#### Scenario: 证据放行

- **WHEN** `test-report.md` 汇总状态为 `pass` / `not-applicable` / `disabled`
- **THEN** 归档前置判定放行；`not-applicable` / `disabled` 记 WARN 并说明未执行测试

#### Scenario: 证据失败阻断

- **WHEN** `test-report.md` 汇总状态为 `fail` 或文件缺失
- **THEN** 父流程 MUST NOT 进入归档，暂停并报告期望路径与原因

### Requirement: debug 变更范围内测试执行

debug SHALL 在 Phase 5 编译检查之后新增一次「变更范围内既有测试执行」，范围为本次修复改动文件的对应既有测试与 4.2 生成的回归测试。范围内失败 SHALL 进入与编译检查相同的自动修复重试预算（≤3）；范围外存量失败仅记 WARN。debug MUST NOT 因本步骤额外生成单测（新增测试由 4.2 回归测试承担）。

#### Scenario: 回归测试后运行范围内既有测试

- **WHEN** debug 修复完成且编译检查放行
- **THEN** 技能运行改动文件对应的既有测试与回归测试，并写入 `test-report.md`

#### Scenario: 范围内失败重试后暂停

- **WHEN** 变更范围内测试失败且自动修复 3 次后仍失败
- **THEN** 技能暂停并报告失败项，MUST NOT 进入 Phase 6 / 归档

### Requirement: 自动管线的测试计划门处置

当 `iagent_test` 由 apply / debug 在自动管线（`mode=delegated` 或门承载参数生效）中内联调用时，其测试计划确认门 SHALL 自动采用推荐计划并将计划写入测试证据，MUST NOT 阻塞管线；技能 MUST 记 WARN 说明「测试计划未经用户逐项确认」。交互式独立调用时该门 SHALL 保持既有阻塞行为不变。

#### Scenario: 自动管线不阻塞

- **WHEN** apply 在 delegated 管线中调用 `iagent_test` 生成补齐测试
- **THEN** 测试计划门自动通过，计划写入证据并记 WARN，不等待用户确认

#### Scenario: 独立调用保持阻塞

- **WHEN** 用户直接调用 `/iagent:test` 且存在多方案测试计划
- **THEN** 技能仍呈现计划确认门并等待用户确认
