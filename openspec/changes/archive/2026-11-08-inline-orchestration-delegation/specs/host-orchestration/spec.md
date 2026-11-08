## MODIFIED Requirements

### Requirement: Stage execution mode contract

编排协议 SHALL 把「阶段实际执行方式」建模为一等契约，并以阶段规格声明各阶段允许的执行方式：

- `explore` SHALL 允许 `inline`（主代理内联）；
- 写阶段（`propose` / `apply`）与并行批量归档（`spec-bulk-archive` 的内部单元）SHALL 要求 `subagent`；
- 交互 / 收束类阶段（`explore` / `investigate` / `verify-close`）SHALL 允许并优先 `inline`；
- `verify` / `archive` / `fix` / `migration` SHALL 允许并**优先** `inline`：只读验证与收尾类阶段由主代理直接执行，
  MUST NOT 为其启动子代理；迁移实现（Phase 3，apply 语义）与批量归档单元除外；
- `iagent_test` SHALL 作为 `apply` / `fix` 内的**条件子阶段**按模板声明执行，MUST NOT 新增顶层 `test` 阶段；
- 只读验证（`iagent_spec_verify_proposal` / `iagent_proposal_review` / `iagent_spec_verify`，运行于 `verify` 阶段）
  SHALL 以 `inline` 为默认执行方式；内联时 `execution.independence` SHALL 为 `self-allowed`，
  回执 `independence=self` SHALL 记 WARN；验证可信度 SHALL 由**固定检查清单 + 每条结论带 `文件:行` 证据 +
  报告落盘**承担，MUST NOT 要求为非作者；
- degraded 宿主的全部阶段 SHALL 为 `local-degraded`，MUST NOT 声称 `subagent`。

阶段级执行方式 SHALL 由 `PhaseSpec.execution.allowed` 声明，只约束阶段所有者；子阶段委派（如 `iagent_test`）由模板声明，MUST NOT 为其新增顶层阶段。`execution` **缺省时 SHALL NOT 校验执行方式**（旧阶段兼容）。**兼容窗**：`verify` / `archive` / `fix` / `migration` 的 `allowed` SHALL 为 `['inline', 'subagent']`，模板只指示 `inline`；回执为 `subagent` 时 SHALL 记 deprecation WARN 并允许推进，下一个 major SHALL 收紧为 `['inline']`。**inline 阶段的 `requiredCapabilities` MUST NOT 含 `delegate`**：否则 strict 宿主缺少委派能力时，内联阶段会被能力检查误阻断；只有写阶段 SHALL 要求 `delegate`。执行方式 SHALL 由宿主适配器按能力协商结果与阶段声明渲染，MUST NOT 由模型自然语言宣称决定；strict 宿主缺少 `delegate` 能力时 SHALL 阻断写阶段，MUST NOT 以内联执行伪装为委派完成。

#### Scenario: 探索阶段内联

- **WHEN** strict 宿主执行 `explore` 阶段
- **THEN** 阶段 SHALL 以 `inline` 执行并返回 `executionMode=inline`
- **AND** MUST NOT 为该阶段启动子代理

#### Scenario: 写阶段必须委派

- **WHEN** strict 宿主进入 `propose` / `apply` 阶段
- **THEN** 阶段 SHALL 经子代理执行并返回 `executionMode=subagent`
- **AND** 以 `inline` 完成并声称成功时 SHALL 被判定为执行方式违约

#### Scenario: 验证与收尾阶段内联优先

- **WHEN** strict 宿主执行 `verify` / `archive` / `fix` / `migration` 阶段
- **THEN** 阶段 SHALL **默认**由主代理内联执行并返回 `executionMode=inline`
- **AND** MUST NOT 为新的执行启动子代理；兼容窗内旧 in-flight 回执按「兼容窗接受旧子代理回执」处理，MUST NOT 被判违约

#### Scenario: 验证内联以证据而非非作者约束

- **WHEN** 只读验证以 `inline` 执行
- **THEN** 回执 SHALL 为 `executionMode=inline`、`independence=self`，并记 WARN
- **AND** 验证报告 SHALL 逐项给出 `PASS` / `FAIL` / `N/A` 与 `文件:行` 或章节锚点证据
- **AND** 无证据的结论 MUST NOT 计入通过

#### Scenario: 兼容窗接受旧子代理回执

- **WHEN** `verify` / `archive` / `fix` / `migration` 阶段回执为 `executionMode=subagent`（兼容窗）
- **THEN** 阶段 SHALL 允许推进
- **AND** SHALL 记 deprecation WARN：「该阶段已改为主代理内联，子代理回执将在下个 major 收紧」

#### Scenario: 阶段规格缺省不校验执行方式

- **WHEN** 某阶段的 `PhaseSpec.execution` 未声明
- **THEN** `evaluatePhaseTransition` SHALL NOT 因 `executionMode` 缺失或不匹配而阻断
- **AND** 其余能力 / 门 / 回执校验保持既有行为

#### Scenario: 内联阶段不要求 delegate 能力

- **WHEN** strict 宿主缺少 `delegate` 能力
- **THEN** `explore` / `investigate` / `verify-close` / `verify` / `archive` / `fix` / `migration` 等 inline 阶段 SHALL 仍可执行
- **AND** 仅写阶段（`propose` / `apply`）SHALL 以 `missing-capabilities` 阻断

#### Scenario: degraded 宿主统一本地执行

- **WHEN** 宿主能力协商结果为 degraded（Codex 或 Pi degraded）
- **THEN** 全部阶段 SHALL 返回 `executionMode=local-degraded`
- **AND** MUST NOT 声称获得子代理回执或严格门通过

### Requirement: Phase transition validates execution mode

`evaluatePhaseTransition` SHALL 在既有「能力 → 门 → 回执」检查之外校验执行方式与独立性：

- strict 模式的写阶段：`executionMode` MUST 属于 `PhaseSpec.execution.allowed`（`propose` / `apply` 为 `['subagent']`）；缺失或不匹配 SHALL 归入 `invalid-receipt`（或等价的 `execution-mode-mismatch` 阻断原因）并阻止推进；
- 交互 / 收束 / 验证 / 归档 / 修复 / 迁移阶段：`allowed` 含 `inline`，`executionMode=inline` SHALL 通过；声称为 `subagent` 时 SHALL 记 WARN（兼容窗内为 deprecation WARN 并允许推进；窗口外按不匹配处理）；
- 只读验证（运行于 `verify` 阶段）：允许 `executionMode=inline`；按 `execution.independence` 映射——`self-allowed` 时 `self` SHALL 记 WARN，`required` 时 `self` SHALL 记 WARN 且不视为合规（兼容旧阶段声明）；缺省不校验；
- degraded 模式：`executionMode` 非 `local-degraded` 时 SHALL 记 WARN 并按不实声明处理，MUST NOT 推进为 strict 语义；
- 使用 resume 执行复验时 `contextReplay=true` SHALL 记 WARN。

#### Scenario: 写阶段内联被阻断

- **WHEN** strict 宿主对 `apply` 阶段返回 `executionMode=inline`
- **THEN** `evaluatePhaseTransition` SHALL 返回 `advance=false`
- **AND** `blockedBy` SHALL 含执行方式相关阻断原因

#### Scenario: 验证内联自证记 WARN 且可推进

- **WHEN** 验证阶段返回 `executionMode=inline` 且 `independence=self`
- **THEN** 结果 SHALL 含 WARN「内联验证由作者自证」
- **AND** `advance` SHALL 为 true（证据约束由验证报告承担）

#### Scenario: 兼容窗子代理回执记 deprecation WARN

- **WHEN** `verify` / `archive` / `fix` / `migration` 阶段回执为 `executionMode=subagent`
- **THEN** 结果 SHALL 含 deprecation WARN 并允许推进
- **AND** MUST NOT 视为执行方式违约

#### Scenario: degraded 不得声称子代理

- **WHEN** degraded 宿主回执声称 `executionMode=subagent`
- **THEN** 结果 SHALL 记 WARN 并按不实声明处理
- **AND** MUST NOT 视为严格委派完成

#### Scenario: 复验使用 resume 记 WARN

- **WHEN** 修复后复验回执带 `contextReplay=true`
- **THEN** 结果 SHALL 记 WARN 并提示改用同上下文增量复跑
- **AND** 该复验结果 MUST NOT 被当作合规的增量复验
