## ADDED Requirements

### Requirement: Stage execution mode contract

编排协议 SHALL 把「阶段实际执行方式」建模为一等契约，并以阶段规格声明各阶段允许的执行方式：

- `explore` SHALL 允许 `inline`（主代理内联）；
- 变更类阶段（`propose` / `apply` / `archive` / `fix`）在 strict 宿主 SHALL 要求 `subagent`；
- 交互 / 收束类阶段（`explore` / `investigate` / `verify-close`）SHALL 允许并优先 `inline`；`investigate` / `verify-close` 内的验证 / 复查以**嵌套子代理**执行，不改变阶段所有者的 `inline` 属性；
- `iagent_test` SHALL 作为 `apply` / `fix` 内的**条件子阶段**要求 `subagent`，MUST NOT 新增顶层 `test` 阶段；
- 只读验证技能（`iagent_spec_verify_proposal` / `iagent_proposal_review` / `iagent_spec_verify`，运行于 `verify` 阶段）SHALL 默认 `subagent`，并允许 `inline`，但内联时 MUST 同时满足「**非作者**（回执 `independence=independent`）+ 检查清单（逐项 `PASS` / `FAIL` / `N/A` + 证据）」；作者自证（`independence=self`）SHALL 允许但记 WARN，MUST NOT 视为合规内联验证；
- degraded 宿主的全部阶段 SHALL 为 `local-degraded`，MUST NOT 声称 `subagent`。

阶段级执行方式 SHALL 由 `PhaseSpec.execution.allowed` 声明，只约束阶段所有者；子阶段委派（如 `iagent_test`）由模板声明，MUST NOT 为其新增顶层阶段。`execution` **缺省时 SHALL NOT 校验执行方式**（旧阶段兼容）；`verify` 阶段的 `execution.independence` SHALL 为 `required`（内联必须非作者）。**inline 阶段的 `requiredCapabilities` MUST NOT 含 `delegate`**：否则 strict 宿主缺少委派能力时，内联阶段会被能力检查误阻断；只有变更类阶段 SHALL 要求 `delegate`。执行方式 SHALL 由宿主适配器按能力协商结果与阶段声明渲染，MUST NOT 由模型自然语言宣称决定；strict 宿主缺少 `delegate` 能力时 SHALL 阻断变更类阶段，MUST NOT 以内联执行伪装为委派完成。

#### Scenario: 探索阶段内联

- **WHEN** strict 宿主执行 `explore` 阶段
- **THEN** 阶段 SHALL 以 `inline` 执行并返回 `executionMode=inline`
- **AND** MUST NOT 为该阶段启动子代理

#### Scenario: 变更类阶段必须委派

- **WHEN** strict 宿主进入 `propose` / `apply` / `archive` / `fix` 阶段
- **THEN** 阶段 SHALL 经子代理执行并返回 `executionMode=subagent`
- **AND** 以 `inline` 完成并声称成功时 SHALL 被判定为执行方式违约

#### Scenario: 交互与收束阶段内联

- **WHEN** strict 宿主执行 `investigate` 或 `verify-close` 阶段
- **THEN** 阶段 SHALL 由主代理内联执行并返回 `executionMode=inline`
- **AND** 其内部的验证 / 复查子阶段 MAY 以嵌套子代理执行，但 MUST NOT 把阶段所有者标记为 `subagent`

#### Scenario: test 是子阶段而非顶层阶段

- **WHEN** `apply` 或 `fix` 需要生成变更范围测试
- **THEN** `iagent_test` SHALL 作为条件子阶段经子代理执行
- **AND** 工作流协议 MUST NOT 新增顶层 `test` 阶段

#### Scenario: 只读验证允许内联但受非作者约束

- **WHEN** 只读验证技能选择内联执行
- **THEN** 回执 SHALL 同时满足 `executionMode=inline`、`independence=independent`（非作者），且正文含逐项检查清单与证据
- **AND** 缺少任一条件时 MUST NOT 视为合法内联验证
- **AND** 作者自证（`independence=self`）SHALL 允许但记 WARN，不视为合规内联验证

#### Scenario: 阶段规格缺省不校验执行方式

- **WHEN** 某阶段的 `PhaseSpec.execution` 未声明
- **THEN** `evaluatePhaseTransition` SHALL NOT 因 `executionMode` 缺失或不匹配而阻断
- **AND** 其余能力 / 门 / 回执校验保持既有行为

#### Scenario: verify 阶段独立性为 required

- **WHEN** `verify` 阶段选择内联执行
- **THEN** `execution.independence` SHALL 为 `required`，回执 `independence` MUST 为 `independent`
- **AND** `independence=self` SHALL 记 WARN 且不视为合规内联验证

#### Scenario: 内联阶段不要求 delegate 能力

- **WHEN** strict 宿主缺少 `delegate` 能力
- **THEN** `explore` / `investigate` / `verify-close` 等 inline 阶段 SHALL 仍可执行
- **AND** 仅变更类阶段 SHALL 以 `missing-capabilities` 阻断

#### Scenario: degraded 宿主统一本地执行

- **WHEN** 宿主能力协商结果为 degraded（Codex 或 Pi degraded）
- **THEN** 全部阶段 SHALL 返回 `executionMode=local-degraded`
- **AND** MUST NOT 声称获得子代理回执或严格门通过

#### Scenario: strict 缺少委派能力时阻断

- **WHEN** strict 宿主缺少 `delegate` 能力却需执行变更类阶段
- **THEN** 阶段 SHALL 以 `missing-capabilities` 阻断
- **AND** MUST NOT 以内联执行替代并标记为完成

### Requirement: Receipt execution and data-sharing fields

阶段回执 SHALL 扩展以下**可选**字段，并在出现时由 `validateReceipt` 校验形状与取值域：

- `executionMode`：`subagent` / `inline` / `local-degraded`；
- `independence`：`independent` / `self`；
- `usage`：对象，可选键 `tokens`（非负数）/ `toolCalls`（非负整数）/ `durationMs`（非负数），未知键 MUST NOT 导致校验失败但 MUST NOT 被消费；
- `readScope`：非空字符串数组，记录实际读取的文件与章节；
- `dependsOn`：非空字符串数组，记录上游输入（如上一验证报告路径）；
- `contextReplay`：布尔值，标记本次是否为 resume 上下文重放。

字段是否**必需** SHALL 由阶段规格决定，MUST NOT 全局写入 `DEFAULT_RECEIPT_FIELDS`（保持旧产物兼容）。取值域非法（如 `executionMode=agent`、`independence=partial`、`usage.tokens` 为负）SHALL 以 `invalid-receipt` 阻断推进；字段缺失时变更类阶段按 `invalid-receipt` 阻断，只读验证阶段记 WARN 并按 unknown 处理（fail-safe）。

#### Scenario: 合法扩展字段通过校验

- **WHEN** 回执含 `executionMode=subagent`、`independence=independent`、`usage={tokens: 1200, toolCalls: 8}`、`readScope=["proposal.md#Why"]`
- **THEN** `validateReceipt` SHALL 判定有效
- **AND** 既有字段校验行为保持不变

#### Scenario: 非法执行方式被阻断

- **WHEN** 回执 `executionMode` 取值为 `agent` / 空串 / 非字符串
- **THEN** `validateReceipt` SHALL 返回 invalid 并附取值域说明
- **AND** 阶段推进 SHALL 以 `invalid-receipt` 阻断

#### Scenario: 旧产物缺失新字段

- **WHEN** 变更类阶段回执不含 `executionMode` 或 `independence`
- **THEN** 阶段推进 SHALL 以 `invalid-receipt` 阻断并报告缺失字段
- **AND** 只读验证阶段 SHALL 记 WARN 并按 unknown 处理，MUST NOT 静默视为独立验证

#### Scenario: usage 不可得时省略

- **WHEN** 宿主不暴露 token 用量
- **THEN** 回执 SHALL 省略 `usage`
- **AND** MUST NOT 编造或估算 `tokens` 数值

### Requirement: Phase transition validates execution mode

`evaluatePhaseTransition` SHALL 在既有「能力 → 门 → 回执」检查之外校验执行方式与独立性：

- strict 模式的变更类阶段：`executionMode` MUST 属于 `PhaseSpec.execution.allowed`（变更类通常为 `['subagent']`）；缺失或不匹配 SHALL 归入 `invalid-receipt`（或等价的 `execution-mode-mismatch` 阻断原因）并阻止推进；
- 交互 / 收束阶段：`allowed` 含 `inline`，`executionMode=inline` SHALL 通过；声称为 `subagent` 但未实际嵌套委派时记 WARN；
- 只读验证技能（运行于 `verify` 阶段）：允许 `executionMode=inline`；按 `execution.independence` 映射——`required` 时 `self` SHALL 记 WARN 且不视为合规，`self-allowed` 时 `self` SHALL 记 WARN，缺省不校验；父级 MAY 要求改派独立子代理；
- degraded 模式：`executionMode` 非 `local-degraded` 时 SHALL 记 WARN 并按不实声明处理，MUST NOT 推进为 strict 语义；
- 使用 resume 执行复验时 `contextReplay=true` SHALL 记 WARN。

#### Scenario: 变更类阶段内联被阻断

- **WHEN** strict 宿主对 `apply` 阶段返回 `executionMode=inline`
- **THEN** `evaluatePhaseTransition` SHALL 返回 `advance=false`
- **AND** `blockedBy` SHALL 含执行方式相关阻断原因

#### Scenario: 只读验证自证记 WARN 但可推进

- **WHEN** 只读验证阶段返回 `executionMode=inline` 且 `independence=self`
- **THEN** 结果 SHALL 含 WARN「内联验证由作者自证」
- **AND** `advance` MAY 为 true，父级 MAY 要求独立复查

#### Scenario: degraded 不得声称子代理

- **WHEN** degraded 宿主回执声称 `executionMode=subagent`
- **THEN** 结果 SHALL 记 WARN 并按不实声明处理
- **AND** MUST NOT 视为严格委派完成

#### Scenario: 复验使用 resume 记 WARN

- **WHEN** 修复后复验回执带 `contextReplay=true`
- **THEN** 结果 SHALL 记 WARN 并提示改用增量新代理
- **AND** 该复验结果 MUST NOT 被当作 D2 的合规增量复验

### Requirement: Incremental re-verification contract

验证 FAIL 并完成修复后，父编排 SHALL 新开一个**只读验证代理**执行增量复验，Stage Envelope SHALL 只包含 `changeName`、`fixDiff`（改动文件 / 章节 / 条目 / 行号范围）、上轮 `reportPath` 与验证检查清单，MUST NOT 携带完整制品正文或要求复读全部制品。复验代理 SHALL 仅验证 `fixDiff` 覆盖范围，并对范围外残留风险列出 residual 清单；回执 SHALL 含新的 `reportPath`、`readScope` 与 `dependsOn: [<上轮 reportPath>]`。

MUST NOT 以 resume 重放上下文代替增量复验；resume 仅用于阶段续跑（中断恢复）。若确因中断续跑而 resume，回执 SHALL 标 `contextReplay=true` 并记 WARN。

#### Scenario: 修复后新开增量复验代理

- **WHEN** 验证 FAIL、父级完成修复并触发复验
- **THEN** 父级 SHALL 新开只读代理并只传 `fixDiff` 与上轮 `reportPath`
- **AND** MUST NOT 使用 resume 恢复上一验证代理

#### Scenario: 复验只覆盖增量

- **WHEN** 增量复验代理执行
- **THEN** 报告 SHALL 逐条覆盖 `fixDiff` 条目并给出 `PASS` / `FAIL` / `N/A` 与证据
- **AND** 对未覆盖范围 SHALL 输出 residual 清单而非静默视为通过

#### Scenario: resume 仅用于阶段续跑

- **WHEN** 阶段因中断需要恢复执行
- **THEN** SHALL 使用 resume 并标 `contextReplay=true`
- **AND** 该调用 MUST NOT 被计为复验通过
