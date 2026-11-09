## ADDED Requirements

### Requirement: 实现一致性三层判定

系统 SHALL 提供实现一致性判定，覆盖三个层次：**规划层**（每个 Requirement 至少一个任务覆盖，每个 Scenario 至少一个任务与至少一个 `[测试]` 任务覆盖）、**实现层**（每个已勾选的 `[代码]` 任务具备可核验的产出文件或 `文件:行` 证据）、**测试层**（每个可测 Scenario 至少一个 `[测试]` 任务，且其测试证据在测试门中被执行）。

判定 MUST 基于 tasks.md 的 `Spec Ref` / `Scenario Ref` 与复选框状态，MUST NOT 用任务描述的关键词语义猜测替代缺失的追溯引用。

#### Scenario: 任务已勾选但缺少产出证据

- **WHEN** 某 `[代码]` 任务标记为 `- [x]`，但在 `git diff`、`产出:` 字段与 handoff 包 `## 已产出` 中均找不到对应文件
- **THEN** 判定输出 `missing-implementation-evidence`，一致性结果为 `fail`，报告列出任务 id 与期望产出

#### Scenario: Scenario 缺少测试任务

- **WHEN** 某 `#### Scenario:` 有实现任务覆盖，但没有任何带该 `Scenario Ref` 的 `[测试]` 任务
- **THEN** 判定输出 `scenario-without-test`，一致性结果为 `fail`（严格模式）或 warning（默认模式）

#### Scenario: 三层全部覆盖

- **WHEN** 所有 Requirement / Scenario 均有任务与测试任务覆盖，且所有已勾选代码任务的产出证据可解析
- **THEN** 一致性结果为 `pass`，矩阵逐行记录 Requirement / Scenario / 覆盖任务 / 任务状态 / 证据位置

#### Scenario: 缺少追溯引用不猜测

- **WHEN** 某任务描述在语义上覆盖某 Requirement，但该任务没有 `Spec Ref`
- **THEN** 判定 MUST NOT 按语义判为覆盖，输出 `requirement-without-task`（或 `scenario-without-test`）并要求补追溯引用

#### Scenario: 大变更矩阵分批

- **WHEN** 变更任务数超过 50
- **THEN** 判定 SHALL 分批生成矩阵并完整落盘到证据文件，MUST NOT 因上下文限制截断或静默跳过条目

### Requirement: iagent spec conformance 覆盖矩阵命令

系统 SHALL 提供 `iagent spec conformance --change <name> [--json] [--strict]` 子命令，输出 Requirement / Scenario 到覆盖任务（含任务类型与复选框状态）的覆盖矩阵与缺失项清单。命令 MUST 复用既有 Markdown 解析与追溯能力，MUST NOT 另立第二套 specs / tasks 解析器。

- `--json` SHALL 返回结构化对象（`changeName` / `changeRoot` / `mode` / `valid` / `matrix` / `findings`）。
- `--strict` SHALL 在存在任何未覆盖项或缺失产出证据时以非零退出码结束；不带 `--strict` 时只报告并以 0 退出。
- 变更声明 `skip_specs` 时 SHALL 跳过 specs 侧判定并在输出中显式标注 `specs: not-applicable`，MUST NOT 报失败。
- 历史 JSON-only 变更 SHALL 以只读降级方式处理并记 WARN，MUST NOT 把 JSON 当作新流程真源。

#### Scenario: JSON 覆盖矩阵输出

- **WHEN** 运行 `iagent spec conformance --change add-x --json`
- **THEN** 输出含 `matrix`（逐 Requirement / Scenario 行）与 `findings`（缺失项）的结构化 JSON，缺失项带 `file:line` 或任务 id

#### Scenario: 严格模式非零退出

- **WHEN** 运行 `iagent spec conformance --change add-x --strict` 且存在未覆盖 Scenario
- **THEN** 命令以非零退出码结束，并输出未覆盖项清单

#### Scenario: skip_specs 变更不误报

- **WHEN** 变更声明 `skip_specs: true` 且 specs 目录为空
- **THEN** 命令输出 `specs: not-applicable` 并以 0 退出，MUST NOT 报缺失 specs

#### Scenario: 历史 JSON-only 变更降级

- **WHEN** 变更只有历史 `change.json`、没有 specs Markdown
- **THEN** 命令以只读方式读取历史 JSON 并记 WARN，输出 `legacy-json-degraded`，MUST NOT 把 JSON 当作新流程真源

### Requirement: iagent spec validate --conformance 严格模式

`iagent spec validate` SHALL 新增可选 `--conformance` 选项，把 `untested-scenario` 等覆盖缺口从 warning 升级为 error；不带该选项时 SHALL 保持现有默认行为（未覆盖场景为 warning，`valid` 不受影响）。

#### Scenario: 默认行为不变

- **WHEN** 运行 `iagent spec validate --change <name>`（不带 `--conformance`）且存在未覆盖 Scenario
- **THEN** 诊断中该场景仍为 warning，`valid` 仍为 `true`（与既有行为一致）

#### Scenario: 严格模式升级为错误

- **WHEN** 运行 `iagent spec validate --change <name> --conformance` 且存在未覆盖 Scenario
- **THEN** 该诊断升级为 error，`valid` 为 `false`，退出码非零

### Requirement: 实现一致性证据契约

apply SHALL 在测试门之后执行实现一致性门，并把结果写入 `.openspec-tmp/pipeline-<change-name>/conformance-report.md`。证据文件 MUST 含固定列 `change` / `requirement` / `scenario` / `coveringTasks` / `taskStatus` / `implementationEvidence` / `testEvidence` / `status` / `reason`，并以 `**summary**: status=<pass|fail>, requirements=<n>, scenarios=<n>, findings=<n>` 行汇总。

`status=fail`、证据缺失或汇总行无法解析时，父流程 MUST NOT 进入归档。证据文件 MUST 保留至归档收尾。

#### Scenario: apply 产出一致性证据

- **WHEN** apply 完成测试门并进入一致性门
- **THEN** `conformance-report.md` 存在且含固定列与 `**summary**:` 行，handoff 包 `## 阶段结论` 追加 `conformance` 行

#### Scenario: 一致性失败阻断归档

- **WHEN** `conformance-report.md` 的汇总行 `status=fail`
- **THEN** auto-workflow / workflow / debug MUST NOT 进入归档，暂停并向用户报告失败项
