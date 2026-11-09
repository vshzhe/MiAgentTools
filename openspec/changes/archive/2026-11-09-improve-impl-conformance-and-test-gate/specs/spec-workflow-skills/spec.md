## ADDED Requirements

### Requirement: spec-apply 自动单测补齐与实现一致性门

`iagent_spec_apply` SHALL 在既有 Step 8 编译检查与 Step 9 测试门之间新增 **Step 8.11 自动单测补齐**，并在 Step 9 之后新增 **Step 9.7 实现一致性门**：

- Step 8.11 SHALL 按 `test-evidence-gate` 能力的「自动单测补齐」要求，对变更范围内未被 `[测试]` 任务覆盖的有行为生产文件内联调用 `iagent_test` 生成测试；不测清单判定 Must 留痕。
- Step 9 SHALL 在运行范围内测试后写入 `test-report.md` 测试证据（列与经济契约见 `test-evidence-gate`）。
- Step 9.7 SHALL 运行 `iagent spec conformance --change <name> --strict` 并写 `conformance-report.md`；`fail` 时暂停，MUST NOT 进入 Step 10 / 归档。
- Step 10 清理 MUST NOT 删除 `compile-report.md` / `test-report.md` / `conformance-report.md` / handoff 包。

#### Scenario: 补齐发生在测试门之前

- **WHEN** 编译检查放行且变更范围内存在未被测试覆盖的有行为改动文件
- **THEN** 技能先生成补齐测试，再执行 Step 9 范围内测试

#### Scenario: 一致性门失败暂停

- **WHEN** Step 9.7 的 `conformance-report.md` 汇总为 `fail`
- **THEN** 技能暂停并报告缺失项，MUST NOT 给出归档建议

#### Scenario: 证据文件保留

- **WHEN** Step 10 清理临时脚本
- **THEN** 三类证据文件与 handoff 包仍存在

### Requirement: spec-verify 消费一致性与测试证据

`iagent_spec_verify` SHALL 只读消费 `.openspec-tmp/pipeline-<change-name>/conformance-report.md` 与 `test-report.md`（存在时），把一致性缺失、测试失败或证据缺失判为 CRITICAL；不得以语义匹配通过替代证据缺失。report-only 语义不变（不修改文件、不执行归档）。

#### Scenario: 一致性证据缺失判 CRITICAL

- **WHEN** spec-verify 运行且 `conformance-report.md` 缺失
- **THEN** 报告包含 CRITICAL「实现一致性证据缺失」，归档就绪评估为不可归档

#### Scenario: 证据通过不重复推断

- **WHEN** 一致性证据 `status=pass` 且测试证据 `status=pass`
- **THEN** 技能以其为输入复核，不再把已覆盖项重新做语义猜测

### Requirement: spec-propose 多源规范要点与任务配对

`iagent_spec_propose` SHALL 按 `rule-baseline` 能力要求，把 handoff 包 `## 规范要点` 扩为全部存在规则源的多源蒸馏并标注来源；tasks.md 中每个 `[代码]` 任务若对应可测 Scenario，MUST 有至少一个 `[测试]` 任务以 `Scenario Ref` 覆盖。

#### Scenario: 多源规范要点写入 handoff

- **WHEN** 提案生成 handoff 包
- **THEN** `## 规范要点` 逐条标注来源（`.iagent/rules/*.md` / `CLAUDE.md` / `AGENTS.md`）

#### Scenario: 可测场景缺测试任务

- **WHEN** tasks.md 中某可测 Scenario 只有 `[代码]` 任务
- **THEN** 提案自检输出 `scenario-without-test` 并补齐 `[测试]` 任务（或按不测清单留痕）
