## Why

一次 auto-workflow 实测显示 8 次子代理调用共 923,804 tokens，其中验证阶段占 52.2%；修复后的 resume 复验（20 次工具调用）耗 272,621 tokens，单位调用成本是首轮的 4.5 倍，高度指向恢复代理时重放上一轮完整上下文。同时，当前编排协议无法证明「阶段实际以何种方式执行」：`Receipt` 只有 `phase` / `status` / `artifact` / `nextAllowed` 等字段，strict 能力协商只能证明宿主**具备**委派能力，不能证明本阶段**确实**委派；只读验证被 `VERIFY_PHASE.requiredCapabilities` 强制要求 `delegate`，内联仅作为技能不可用的降级路径。数据共享面同样是「摘要包 + 全量重读」：子代理仍全量读 4 个制品，指纹无 CLI、父级手工写 Node 脚本计算，handoff 包被父级手改多次。

因此需要把**执行方式**提升为可验证的一等公民，并给出只读验证的内联通道与修复后增量复验路径，同时补齐数据共享的确定性接口。

## What Changes

- **D1 分级执行策略**：探索与 debug 的 investigate / verify-close 由主代理内联（交互门与收束职责）；propose / apply / archive 在 strict 宿主必须子代理；debug 的 fix 阶段按 bug 派发单元经子代理执行；`iagent_test` 是 apply / fix 内部的条件子阶段，必须子代理；verify-proposal / proposal-review / spec-verify 默认子代理，允许内联但须满足「**非作者**（`independence=independent`）+ 逐项检查清单与证据」；作者自证（`independence=self`）允许但记 WARN 且不视为合规内联验证，父级 SHOULD 改派独立子代理；degraded 宿主统一 `executionMode=local-degraded`。**阶段级执行方式与子阶段委派分离建模**：`PhaseSpec.execution` 只约束阶段所有者，子阶段由模板声明，不新增顶层阶段。**inline 阶段 MUST NOT 要求 `delegate` 能力**（仅变更类阶段要求）。
- **D2 增量复验**：验证 FAIL 并修复后，改为**新开只读代理**，只传 `fixDiff`（改动文件 / 章节 / 条目 / 行号范围）与上轮 `reportPath`，要求只验证增量；禁止以 resume 重放上下文代替复验。
- **D3 回执扩展**：`Receipt` 增加 `executionMode` / `independence` / `usage?` / `readScope?` / `dependsOn?`；`validateReceipt` 校验取值域与形状。
- **D4 阶段推进校验**：`evaluatePhaseTransition` 依据 `PhaseSpec.execution.allowed` 校验——变更类阶段（propose / apply / archive / fix）要求 `executionMode=subagent`（strict）；交互/收束类阶段（explore / investigate / verify-close）允许并优先 `inline`；`execution.independence='required'` 时内联 MUST 为 `independent`，`self` 记 WARN；`'self-allowed'` 时 `self` 允许但记 WARN；缺省不校验。**inline 阶段的能力声明 MUST NOT 含 `delegate`**，否则 strict 缺委派能力时会把内联阶段误阻断。
- **D5 指纹 CLI**：新增 `iagent spec fingerprint --change <name> [--json]`，算法与 handoff 包 `sourceFingerprint` 完全一致（排序后单换行连接、**末尾无换行**）；模板与 requirement-doc 规则改为「优先 CLI，缺失回退 handoff 包」。**既有 spec-propose 参考脚本按每行 `\n` 结尾（含末行）实现，需一次性修正**；在途旧包首次复算可能不一致，由消费方重建并记 WARN。
- **D6 制品清单 + 读取范围**：handoff 包在 `## 契约` 之后、`## 规范要点` 之前新增 `## 制品清单`（路径 / 大小 / sha256 / 章节锚点），作为**并列段不计入六节**；子代理先读清单再按需增量读取；阶段回执写 `readScope`。
- **D7 串联验证**：proposal-review 默认读取 verify-proposal 的 `reportPath` 作为输入并在回执标 `dependsOn`；报告缺失时退化为独立复查并 WARN。
- **D8 用量记录**：回执可选 `usage`（tokens / toolCalls / durationMs）；`## 阶段结论` 表头扩展为 `phase | status | artifact | nextAllowed | tokens`，不可得时填 `—`（宿主可用时记录，MUST NOT 编造）；只追加行、不改写既有行。
- **D9 范围**：仅修改 host-orchestration 协议 / 阶段推进 / 工作流协议、auto-workflow / debug / workflow 等模板、spec CLI 与补全、测试与技能快照；**不改门白名单与业务确认语义**。

## Capabilities

### New Capabilities

无新增能力。

### Modified Capabilities

- `host-orchestration`: 阶段回执新增执行方式 / 独立性 / 用量 / 读取范围 / 依赖字段并做取值域校验；阶段推进校验执行方式；新增分级执行契约与增量复验契约。
- `spec-workflow-cli`: 新增 `iagent spec fingerprint` 子命令（参数、输出、算法、降级）并同步 shell 补全表。
- `workflow-suite-skills`: auto-workflow / debug / workflow 的模板声明分级执行方式、增量复验、验证串联与制品清单读取范围；`## 阶段结论` 记录 tokens。

## Impact

### 直接影响的文件

- `src/core/host-orchestration/protocol.ts`: `Receipt` 新字段、`validateReceipt` 取值域校验、执行方式 / 独立性取值域常量。
- `src/core/host-orchestration/transition.ts`: `evaluatePhaseTransition` 接收并校验执行方式与独立性，新增 `execution-mode-mismatch` 类阻断 / WARN。
- `src/core/host-orchestration/workflows.ts`: 阶段规格声明允许的执行方式（变更类必须 `subagent`，只读验证允许 `inline`）。
- `src/core/host-orchestration/render.ts`: 宿主渲染段注入分级执行与增量复验契约文本（strict / degraded 分形态）。
- `src/core/host-orchestration/index.ts`: 导出新常量与校验函数。
- `src/commands/spec.ts`: 新增 `fingerprint` 子命令（`--change` / `--json`）。
- `src/cli/index.ts`: 注册 `spec fingerprint`。
- `src/commands/completion.ts`: `IAGENT_COMMANDS` 的 `spec` 子命令列表与描述同步。
- `src/core/templates/workflows/auto-workflow.ts`: 分级执行、增量复验、验证串联、制品清单、`## 阶段结论` tokens 记录。
- `src/core/templates/workflows/debug.ts`: 同上执行方式与增量复验约束。
- `src/core/templates/workflows/workflow.ts`: 同上。
- `src/core/templates/workflows/spec-propose.ts`: 指纹优先 CLI、handoff 包新增 `## 制品清单`、阶段结论记 tokens。
- `src/core/templates/workflows/spec-verify.ts` / `spec-verify-proposal.ts` / `proposal-review.ts` / `spec-apply.ts` / `spec-archive.ts`: 只读验证内联约束、`dependsOn` 串联、`readScope`、增量复验。
- `src/core/templates/workflows/requirement-doc.ts`: 指纹来源改为「优先 `iagent spec fingerprint`，缺失回退 handoff 包」。
- `test/`: 回执字段校验、阶段推进执行方式、fingerprint CLI、模板关键词 / 结构断言。
- `skills/`: 模板变更后重新生成的静态快照。

### 向后兼容

保持向后兼容：新回执字段均为**可选**（`executionMode` / `independence` 由 `PhaseSpec.execution` 按需要求；旧回执仅在声明了要求的阶段缺失时按 `invalid-receipt` 阻断，只读验证阶段记 WARN 并按 unknown 处理），`iagent spec fingerprint` 为纯新增子命令。既有门白名单、业务确认语义与 `confirmedGates` 门账本语义不变。旧版本 CLI 无 `fingerprint` 时回退 handoff 包 `sourceFingerprint` 并记 WARN；旧 in-flight 包若用「每行含末尾 `\n`」算法计算，首次复算会不一致，由消费方重建并 WARN。已安装的旧技能在 `iagent update` 重新生成前不感知新字段要求。
