## Context

当前编排协议（`src/core/host-orchestration/`）以宿主能力协商（`negotiateCapabilities`）判定 strict / degraded，再以 `evaluatePhaseTransition` 检查「能力 → 门 → 回执」三项。`Receipt` 仅含 `phase` / `status` / `artifact` / `nextAllowed` / `failure` / `blockedGate` / `blockedReason` / `resumeHint` / `reportPath` / `reviewSummary` / `confirmedGates`，不记录本阶段**实际**以何种方式执行。strict 只能证明宿主具备 `delegate` 能力，无法证明阶段真的走了委派；`VERIFY_PHASE.requiredCapabilities` 含 `delegate`，使只读验证即使内联可行也被强制委派。

一次 auto-workflow 实测：8 次子代理调用 923,804 tokens，验证阶段 52.2%；第二轮 resume 复验 20 次工具调用耗 272,621 tokens（13.6k/次），首轮 70 次耗 209,779（3.0k/次），最可能是恢复代理时重放上一轮完整上下文。数据共享面是「摘要包 + 全量重读」：handoff 包 `sourceFingerprint` 无 CLI，父级本次手写 3 次 Node 脚本；包被父级手改 3 次；两个验证代理并行读取同一批文件。

探索文件 `exploration.md` 的 Decisions D1–D9 与边界场景 1–10 已由用户确认，是本设计的唯一语义来源；其 `## 功能流程图` 仅为现状成本分析，不作为流程基准（本次为协议与执行策略调整，无新增业务功能流程）。

## Goals / Non-Goals

**Goals**:

- 让「执行方式」成为可验证、可审计的一等字段：回执显式声明 `executionMode` / `independence`，阶段推进据此校验。
- 为只读验证提供受约束的内联通道（非作者 + 检查清单；`independence=self` 仅作 WARN 例外），消除不必要的子代理开销。
- 修复后用「增量新代理 + fixDiff + 上轮 reportPath」替代 resume 复验，避免上下文重放。
- 提供确定性的数据共享接口：`iagent spec fingerprint` CLI 与 handoff 包 `## 制品清单`，子代理按需读取并回报 `readScope`。
- 串联 verify-proposal → proposal-review，避免重复全量读取；可选记录 `usage` 与 `tokens=`。

**Non-Goals**:

- 不修改门白名单、门预算与业务确认语义（`GATE_WHITELIST` / `GATE_SKIP_IDS` / `confirmedGates` 账本语义不变）。
- 不删除或合并任何技能阶段；不改变 canonical `workflowId` 与产物布局。
- 不新增跨变更索引或 SQLite 依赖（DEC-2 保持）。
- 不在宿主不暴露 token 用量时推导或估算 `usage`。
- 不把 `migration` 的 `source-scan` / `implement-and-check` 纳入本次执行方式改造（保持既有行为；后续可单独采纳）。
- 不新增顶层 `test` 阶段：`iagent_test` 作为 apply / fix 内的条件子阶段，由模板约束。

## Decisions

### D1: 分级执行策略（explore 内联 / 变更类子代理 / 只读验证可内联）

- **选择**: 阶段规格新增「允许的执行方式」声明：`explore` 为 `inline`；`propose` / `apply` / `archive` 在 strict 宿主必须 `subagent`；debug 的 `fix` 按 bug 派发单元必须 `subagent`，`investigate` / `verify-close` 为 `inline`（交互确认与收束职责由主代理承担，收束期内的 verify / review 以嵌套子代理执行）；`iagent_test` 是 apply / fix 内部的条件子阶段，必须 `subagent`；只读验证技能（`iagent_spec_verify_proposal` / `iagent_proposal_review` / `iagent_spec_verify`，运行于 `verify` 阶段）默认 `subagent`，允许 `inline` 但须同时满足「**非作者**（`independence=independent`）+ 逐项检查清单与证据」。作者自证（`independence=self`）允许但记 WARN，不视为合规内联验证。degraded 宿主统一 `local-degraded`。**`PhaseSpec.execution` 只约束阶段所有者；子阶段委派由模板声明，不新增顶层阶段。inline 阶段的 `requiredCapabilities` MUST NOT 含 `delegate`**。
- **理由**: 变更类阶段有写副作用与产物所有权，必须隔离执行；探索、诊断与收束需要与用户交互，必须内联；只读验证无写副作用，独立视角可通过「非作者 + 检查清单」补足，不必强制承担子代理上下文成本。`independence=self` 属例外而非合规内联：保留为可审计的 WARN 通道，避免把它当作"合规"从而系统性自证。
- **备选**: 全部内联（失去隔离与独立视角）或全部子代理（保留现状成本，且使交互阶段无法执行）。二者均被否决。
- **阶段映射**: `verify` 阶段（PhaseSpec id = `verify`）内含 `iagent_spec_verify_proposal` 与 `iagent_proposal_review` 两个技能；阶段规格约束阶段所有者的执行方式，技能级差异（串联、独立性、增量范围）由模板声明。

### D2: 增量复验（fixDiff + 上轮 reportPath，禁止 resume）

- **选择**: 验证 FAIL 并修复后，父级新开一个只读代理，Stage Envelope 只传 `fixDiff`（改动文件 / 章节 / 条目 / 行号范围）与上轮 `reportPath`，要求代理仅验证增量覆盖范围并输出新报告。resume 仅用于阶段续跑（中断恢复）；若对复验使用 resume，回执 MUST 标 `contextReplay=true` 并记 WARN。
- **理由**: 实测 resume 单位调用成本约为首轮 4.5 倍，指向上下文重放；增量输入足以判定修复是否闭合。
- **备选**: 继续 resume（成本不可控）或全量重开（可接受但读取面仍大，由 D6 制品清单缓解）。

### D3: 回执扩展与取值域校验

- **选择**: `Receipt` 增加可选字段 `executionMode`（`subagent` / `inline` / `local-degraded`）、`independence`（`independent` / `self`）、`usage`（`{ tokens?: number; toolCalls?: number; durationMs?: number }`）、`readScope`（字符串数组）、`dependsOn`（字符串数组，通常是上游报告路径）。`validateReceipt` 仅在字段出现时校验形状与取值域；`executionMode` / `independence` 是否**必需**由阶段规格决定，而非全局写死。阶段规格扩展为 `execution?: { allowed: ExecutionMode[]; independence?: 'required' | 'self-allowed' }`：`allowed` 声明 strict 宿主允许的执行方式；`independence` 的映射为——`'required'`：内联回执 MUST 为 `independent`，`self` 记 WARN；`'self-allowed'`：`self` 允许但记 WARN；缺省不校验。`execution` 缺省表示该阶段不校验执行方式（旧阶段兼容）。
- **理由**: 旧产物兼容（字段可选）+ 变更类阶段可强制（阶段规格必需）；取值域校验防止伪造或拼写漂移。
- **备选**: 把新字段放进 `DEFAULT_RECEIPT_FIELDS`（会破坏旧产物兼容并让只读验证阶段也被强制），否决。

### D4: 阶段推进执行方式校验

- **选择**: `evaluatePhaseTransition` 增加执行方式检查：依据 `PhaseSpec.execution.allowed` 校验。变更类阶段（`propose` / `apply` / `archive` / `fix`）在 strict 模式下要求 `executionMode=subagent`，缺失或不匹配 → `invalid-receipt`（或新增 `execution-mode-mismatch` 归入同一阻断集）；交互/收束阶段（`explore` / `investigate` / `verify-close`）允许并优先 `inline`；只读验证技能（运行于 `verify` 阶段）允许 `inline`，按 `execution.independence` 映射处理（`required`：`self` 记 WARN 且不视为合规；`self-allowed`：`self` 允许但记 WARN），父级可要求改派独立子代理；`execution` 缺省不校验。**`verify` 阶段声明 `independence: 'required'`**。degraded 模式只接受 `local-degraded`，声称为 `subagent` 时记 WARN 并按不实声明处理。**inline 阶段的 `requiredCapabilities` MUST NOT 含 `delegate`**，否则能力检查会先于执行方式检查误阻断。
- **理由**: 把「能力存在」与「本次确实使用」分离；边界场景 1（strict 但子代理不可用必须阻断，禁止内联伪装）与 7（degraded 不得声称子代理）由此落地。
- **备选**: 仅在文档层约定（不可验证），否决。

### D5: 指纹 CLI（`iagent spec fingerprint`）

- **选择**: `iagent spec fingerprint --change <name> [--json]` 复算与 handoff 包一致的 `sourceFingerprint`：制品集合 = `proposal.md`、`design.md`（存在时）、`specs/**/*.md`、`tasks.md`；每个文件 `sha256(字节)` 得 `<相对路径>:<sha256hex>`（路径正斜杠），按相对路径字典序排序后**用单个换行连接**为串 `S`（**末尾无换行**），输出 `sha256:` + `sha256(S)` 前 16 位十六进制。文本模式直接打印指纹一行；`--json` 输出 `{ changeName, changeRoot, fingerprint, artifacts: [{ path, size, sha256 }] }`。变更不存在或无制品 → 非零退出并给出诊断。
- **理由**: 消除手工脚本与三处手改；同一算法单一实现供模板、requirement-doc 与消费方复算。**注意**：现有 spec-propose 模板中的参考 bash 脚本对每行都以 `\n` 结尾（含末行），与文档算法的「无末尾换行」不一致，必须以文档算法为准修正参考脚本，使 CLI、模板与消费方三者一致。
- **备选**: 只提供文档算法（继续手写脚本），否决。

### D6: 制品清单 + 读取范围

- **选择**: handoff 包在 `## 契约` 之后、`## 规范要点` 之前新增 `## 制品清单` 节（与六节并列、不计入六节）：每行 `<相对路径> | <字节数> | <sha256 前 12 位> | <章节锚点列表>`。子代理 MUST 先读该节，再按需增量读取被引用的章节；阶段回执 `readScope` 记录实际读取的文件与章节。清单与磁盘不一致（大小或指纹不符）→ 重建清单并 WARN，MUST NOT 沿用陈旧清单。该段落位不改变六节的既有顺序与门账本解析边界（下一个 `##` 即段结束）。
- **理由**: 把「全量重读」变为可核对的确定性读取面，并为 D8 的用量审计提供依据。
- **备选**: 仅在 Stage Envelope 传路径列表（无法发现陈旧与遗漏），否决。

### D7: 验证串联（proposal-review 消费 verify-proposal 报告）

- **选择**: `iagent_proposal_review` 默认读取 `iagent_spec_verify_proposal` 的 `reportPath` 作为输入，回执标 `dependsOn: [<reportPath>]`，并对报告已覆盖的维度只做增量核对；报告缺失或不可读 → 退化为独立全量复查并 WARN。两者视角保持非重叠：verify-proposal 负责 D1-D5/D6-D10 评分门，proposal-review 负责实现合规与覆盖度深探。
- **理由**: 两个代理输入高度重叠但独立视角有价值，不能简单合并；串联可减少重复读取而不牺牲独立性。
- **备选**: 合并两个验证（丢失非重叠维度）或保持完全独立（重复成本），均否决。

### D8: 用量记录

- **选择**: 回执 `usage` 可选（`tokens` / `toolCalls` / `durationMs`），仅当宿主暴露时写入；`## 阶段结论` 表头扩展为 `phase | status | artifact | nextAllowed | tokens`，不可得时填 `—`（MUST NOT 编造）。`## 阶段结论` 仍只追加行、不改写既有行；旧包缺 `tokens` 列时消费者按缺省 `—` 处理。
- **理由**: 让后续成本分析有真实数据，同时守住「不编造」底线（边界场景 9）。
- **备选**: 强制要求 usage（degraded / 旧宿主无法提供，会导致误阻断），否决。

### D9: 修改范围

- **选择**: 仅改 `host-orchestration` 协议 / 阶段推进 / 工作流协议、auto-workflow / debug / workflow 及相关技能模板、spec CLI 与补全、测试与 `skills/` 快照。门白名单与业务确认语义保持不动。
- **理由**: 用户确认的边界，避免把执行方式改造扩散为流程重设计。
- **备选**: 同步调整门预算与确认桥（超出用户确认范围），否决。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 新增回执字段导致旧产物回执被判非法 | 字段可选；变更类阶段缺失按 `invalid-receipt` 阻断、只读验证阶段缺失记 WARN 按 unknown 处理（边界场景 8） |
| 内联验证被作者自证滥用 | 合规内联要求「非作者（`independent`）+ 检查清单」；`self` 仅作 WARN 例外，父级应改派独立复查 |
| 增量复验遗漏跨范围回归 | `fixDiff` 未覆盖的维度由父级按报告中的 residual 清单决定是否追加全量复查；报告必须保留 residual 段 |
| 指纹算法实现与模板参考脚本不一致 | 以文档算法（排序后单换行连接、末尾无换行）为唯一真源，CLI 与模板参考脚本同步修正，测试对同一 fixture 断言一致 |
| 制品清单陈旧导致子代理读错版本 | 清单含大小与 sha256，入口比对不一致即重建并 WARN |
| `usage` 缺失导致成本分析断档 | 明确「宿主可用时记录」，不可用时省略并保持 `## 阶段结论` 可读 |
| 误把 debug 的交互阶段（investigate / verify-close）判为必须子代理 | 执行方式按阶段职责分类：交互/收束阶段 `inline`，`fix` 与子阶段 `test` 才要求 `subagent`；测试断言覆盖该分类 |
| 旧 in-flight 包指纹算法（每行含末尾 `\n`）与新 CLI 不一致 | 以文档算法为唯一真源修正参考脚本；首次复算不一致时消费方重建并 WARN，不阻断流程 |
