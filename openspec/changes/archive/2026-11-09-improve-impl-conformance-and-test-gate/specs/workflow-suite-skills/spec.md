## ADDED Requirements

### Requirement: 编排技能消费规则基线、测试证据与一致性证据

`iagent_workflow`、`iagent_auto_workflow` 与 `iagent_debug` SHALL：

- 在探索 / 排查起点委派或内联执行规则基线建立（见 `rule-baseline` 能力），并把 `## 项目规则基线` 纳入阶段输入；
- 在实现后只读 `.openspec-tmp/pipeline-<change-name>/test-report.md` 与 `conformance-report.md` 作为归档前置证据，MUST NOT 自行重新执行测试 / 一致性命令，MUST NOT 另立第二份判定；
- 在任一证据 `status=fail`、缺失或无法解析时 MUST NOT 进入归档，暂停并报告期望路径与原因。

#### Scenario: auto-workflow 归档前置三证据

- **WHEN** auto-workflow Phase 5 准备归档
- **THEN** 读取 `compile-report.md`、`test-report.md` 与 `conformance-report.md` 的汇总行，三者均放行才进入归档

#### Scenario: 证据缺失阻断

- **WHEN** `test-report.md` 或 `conformance-report.md` 缺失
- **THEN** auto-workflow / workflow MUST NOT 归档，暂停并报告缺失路径

### Requirement: debug 范围内测试执行与一致性收束

`iagent_debug` SHALL 在 Phase 5 编译检查之后新增 **Phase 5.5 变更范围内测试执行**（产出 `test-report.md`），并在 Phase 7 验证收束阶段消费 `conformance-report.md`：一致性 `fail` 或证据缺失时 MUST NOT 宣告可归档，回到 Phase 4 修复。

#### Scenario: debug 测试证据

- **WHEN** debug 修复完成且编译检查放行
- **THEN** Phase 5.5 运行变更范围内既有测试与回归测试，并写 `test-report.md`

#### Scenario: debug 一致性失败回修

- **WHEN** Phase 7 读取到一致性证据 `status=fail`
- **THEN** 技能回到 Phase 4 修复，MUST NOT 输出「已可归档」

#### Scenario: 归档来源调试新建变更

- **WHEN** 缺陷来自已归档变更的代码
- **THEN** debug SHALL 新建 `fix-<module>-<topic>` 变更并在该变更上执行一致性门，MUST NOT 修改 `openspec/changes/archive/**`

### Requirement: workflow 实现阶段继承新门

`iagent_workflow` 在委派 `iagent_spec_apply` 的实现阶段 SHALL 继承自动单测补齐、测试证据与实现一致性门，并在交付桥中预告这些门；MUST NOT 在 workflow 正文另立测试 / 一致性判定规则。

#### Scenario: 交付桥预告新门

- **WHEN** workflow 呈现实现 + 测试桥
- **THEN** 桥内说明实现后将执行自动单测补齐、范围内测试与实现一致性门，并提示失败会阻断归档
