## MODIFIED Requirements

### Requirement: Spec-to-task traceability is mandatory

spec-propose SHALL 为每个可测 Scenario 生成对应的测试或实现任务，并使用规范形态的 `Spec Ref`
（`<capability> / <Requirement>`）与 `Scenario Ref`（**场景叶子名** `<Scenario>`）关联 capability、Requirement 和
Scenario（D2）。校验层 SHALL 用同一任务的 `Spec Ref` 补全叶子名全路径后再做覆盖判定；Requirement / Scenario
两级覆盖语义不变（D1）。

spec-verify-proposal 的 D3 覆盖检查与 spec-verify SHALL 使用同一规范形态解析（含 HTML 注释式与一行双引用、
历史全路径与裸名写法），并 SHALL 报告未覆盖或失效的引用；仅写 capability 的引用 MUST NOT 计为 Requirement 覆盖，
并 SHALL 以「缺少 Requirement」报告（D3）。

**上下文缺失与歧义（D3）**：任务无 `Spec Ref` 却写叶子名 `Scenario Ref` 时 SHALL 报「缺少上下文」；任务有 ≥2 条
`Spec Ref` 且场景为叶子名时 SHALL 报「歧义」；两种情况 MUST 要求写全路径，MUST NOT 猜测归属。

**格式真源单点（D4）**：追溯引用的规范形态 SHALL 只在 `TASKS_TEMPLATE`、`spec-propose` 与 `spec-verify-proposal`
维护；`workflow` / `auto-workflow` / `debug` 正文 MUST NOT 新增第二份格式声明，其行为经委派或继承自动生效。

#### Scenario: tasks.md 使用场景叶子名形态

- **WHEN** spec-propose 为任务生成追溯引用
- **THEN** `Spec Ref` SHALL 写 `<capability> / <Requirement>`，`Scenario Ref` SHALL 写场景叶子名
- **AND** MUST NOT 在 `Scenario Ref` 重复 `capability / Requirement` 前缀

#### Scenario: propose 为每个 Scenario 生成关联任务

- **WHEN** specs 中存在可实现的 Scenario
- **THEN** tasks.md SHALL 包含关联任务及其 `Spec Ref` / `Scenario Ref`
- **AND** 该 Scenario Ref SHALL 按叶子名形态书写

#### Scenario: 不可测 Scenario 留痕

- **WHEN** Scenario 被判断为不可测
- **THEN** SHALL 生成带 `[测试]` 标签的记录任务，说明已评估且无需测试的依据
- **AND** MUST NOT 静默省略评估

#### Scenario: D3 按规范形态匹配

- **WHEN** tasks.md 以叶子名（经同一任务 Spec Ref 补全）、HTML 注释式或一行同时含 Spec + Scenario 的形式书写追溯
- **THEN** D3 覆盖检查 SHALL 视其与两行全路径写法等价，覆盖率 MUST NOT 因书写形态下降

#### Scenario: 仅 capability 引用不计为覆盖

- **WHEN** tasks.md 的 Spec Ref 只写 capability
- **THEN** D3 SHALL 将其计为未覆盖并报告「缺少 Requirement」
- **AND** MUST NOT 把该引用匹配到任一 Requirement

#### Scenario: propose 模板声明上下文缺失与歧义诊断

- **WHEN** 检查 `spec-propose` 与 `spec-verify-proposal` 的正文规范形态说明
- **THEN** 正文 SHALL 声明「缺少上下文」与「歧义」两类诊断及「写全路径」的 fail-safe 要求
- **AND** MUST 与解析器的诊断口径一致

#### Scenario: 格式真源单点

- **WHEN** 检查 `workflow` / `auto-workflow` / `debug` 技能正文
- **THEN** 三者 MUST NOT 新增第二份追溯引用的规范形态声明
- **AND** 其 tasks.md 引用行为 SHALL 通过委派 `spec-propose` 或继承既有引用自动生效
