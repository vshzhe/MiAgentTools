## ADDED Requirements

### Requirement: 需求文档状态跨阶段 handoff

workflow / auto-workflow 的验证阶段 SHALL 将需求文档桥结果持久化于变更 `exploration.md`，并通过 verify → apply → archive 的 handoff 传递；debug 的 `verify-close` 回执 SHALL 同样携带该状态供后续 archive 使用。archive SHALL 在独立调用或新会话时读取持久记录，不得仅依赖易丢失的会话状态。

持久形态 SHALL 为变更 `exploration.md` 的 `## 需求文档状态` 段，字段 `requirementDocStatus`，取值仅 `skipped-by-user` / `generation-failed` / `generated`；该段缺失或取值非法时状态为 `absent`（不落盘）。`generated` 为终态；`generation-failed` 与 `skipped-by-user` 可在用户再次经桥并显式选择时被改写。叶技能 `iagent_requirement_doc` MUST NOT 写改该状态（其"目标已存在则静默覆盖"原语保持不变）。

**优先级**：文档文件存在 > 持久状态。文件存在时无论状态如何均由 archive 就地增量对齐；状态只裁决"文件缺失"分支。

**I/O 语义**：状态写入与读取均 SHALL 采用"失败 → 自动重试同一操作一次 → 仍失败即停止"（MUST NOT 第二次或无限重试）。写入仍失败时：MUST NOT 报告状态已持久化或阶段完成；MUST NOT 委派 `iagent_requirement_doc`；MUST NOT 进入依赖该状态的下一阶段；SHALL 输出含目标路径与原因的 WARN 及恢复指引。读取仍失败时：MUST NOT 将状态视为 `absent`（不得进入历史兼容生成分支）、MUST NOT 自动生成文档；文档已存在时仍按已存在分支对齐，缺失时输出 WARN 与恢复指引；读取失败 MUST NOT 阻断归档。

#### Scenario: 桥写入四种结果

- **WHEN** 用户在文档桥选择跳过、选择生成后委派成功、或选择生成后委派失败
- **THEN** 状态分别写为 `skipped-by-user` / `generated` / `generation-failed`，并在回执中携带同一结果；状态写入成功前 MUST NOT 报告阶段完成

#### Scenario: 状态写入重试一次后失败

- **WHEN** 状态写入首次失败且自动重试一次仍失败
- **THEN** 系统 MUST 停止该文档桥（不委派生成、不进入依赖该状态的下一阶段），输出 WARN 与恢复指引；MUST NOT 报告状态已持久化，MUST NOT 发起第二次重试

#### Scenario: 状态读取重试一次后失败

- **WHEN** archive 或父流程读取状态首次失败且自动重试一次仍失败
- **THEN** 系统 MUST NOT 把状态视为 `absent`、MUST NOT 自动生成需求文档；文档已存在时仍按已存在分支对齐，缺失时输出 WARN 与恢复指引并继续归档

#### Scenario: 状态穿过 guided apply 到 archive

- **WHEN** workflow 的文档状态为 `skipped-by-user` / `generation-failed` / `generated` 并进入 apply、随后 archive
- **THEN** apply handoff 保留该状态，archive 输入收到同一状态，且持久记录可用于跨会话恢复

#### Scenario: auto-workflow 状态穿过自动 apply 到 archive

- **WHEN** auto-workflow 完成文档桥并进入 auto-apply 与 auto-archive
- **THEN** 无额外“是否调用技能”确认地传递文档状态；strict/degraded 能力、回执与宿主权限检查仍按协议执行

#### Scenario: debug 后续独立 archive 恢复状态

- **WHEN** debug 的 `verify-close` 收束并在稍后单独 archive
- **THEN** debug 回执包含状态，archive 即使未收到该回执也从变更 `exploration.md` 恢复状态

#### Scenario: 历史变更无状态保持兼容

- **WHEN** archive 输入和变更 `exploration.md` 均没有显式需求文档状态
- **THEN** 按既有历史兼容策略处理，不把"没有状态"误判为用户跳过或生成成功

### Requirement: debug host protocol 拆分 fix 与 verify-close

debug 仍是单一 `iagent_debug` 全流程 SKILL；宿主无关 `WORKFLOW_PROTOCOLS.debug` SHALL 将阶段表达为 `investigate` → `fix` → `verify-close`，使修复方案决策/实施与编译、同步、提案验证、深度复查和文档桥收束职责分开。`investigate` SHALL 交付 `rootCause` / `defectChain` / `changeName` / `affectedSymbols`；变更归属判定（`changeName` 的产生）SHALL 属于 `investigate` 的收束动作。`fix` SHALL 以 `rootCause` / `defectChain` / `changeName` / `fixDecision` 为必需输入，handoff 修复结果与回归测试结果；`verify-close` 消费修复结果并交付验证/收束结果及文档状态。

修复方案确认门 SHALL 仅在存在多个可行方案时阻塞；单一明确可行且证据充分的方案须记录其证据并直通。该条件门 SHALL 以宿主无关契约表达：`GateSpec` 增加可选 `condition`（首个取值 `'multiple-fix-options'`），`PhaseTransitionInput` 增加可选 `gateConditions?: Record<string, boolean>`。`evaluatePhaseTransition` 的判定为：门的 `condition` 未设置 → 保持现有静态门行为；`gateConditions[condition] === false` → 该门不适用并跳过门确认要求（即使 `gateConfirmed` 为 false 也不得以 `gate-unconfirmed` 阻塞）；`=== true` 或该键未提供 → 门适用，仍按 `gateConfirmed` 要求确认（fail-safe）。`debug` 的 `fix` 阶段门绑定 `'multiple-fix-options'`：多个可行方案置 `true`，唯一且证据充分方案置 `false`。Claude / OpenCode V2 / Pi 适配 SHALL 共享同一判定语义；任何既有未声明 `condition` 的门行为 MUST NOT 改变。`verify-close` 内仍只保留确认后的文档生成/跳过桥；strict 缺少必要能力时阻断，degraded 必须明确标记，不得伪装为成功委派。

#### Scenario: debug 阶段顺序与单一技能保持

- **WHEN** 宿主读取 debug 工作流协议
- **THEN** 阶段顺序为 `investigate`、`fix`、`verify-close`；用户仍只调用一个 `iagent_debug` 全流程技能

#### Scenario: 多方案门阻止 fix 阶段推进

- **WHEN** `fix` 阶段判定有多个可行修复方案且用户尚未确认所选方案
- **THEN** 条件修复门阻止实现或后续阶段推进，并要求有效回执

#### Scenario: 唯一证据充分方案不被静态门阻塞

- **WHEN** `fix` 阶段证明仅有一个明确可行方案且记录项目约束/代码证据
- **THEN** 修复方案确认门不适用，阶段可在能力与回执有效后推进，不制造额外用户停顿

#### Scenario: 条件门适用性与旧门默认行为

- **WHEN** 阶段门声明或不声明 `condition` 并调用 `evaluatePhaseTransition`
- **THEN** `gateConditions['multiple-fix-options'] === false` → 该门不适用，跳过门确认要求（即使 `gateConfirmed` 为 false 也 MUST NOT 以 `gate-unconfirmed` 阻塞）
- **AND** `gateConditions['multiple-fix-options'] === true` 或该键未提供 → 门适用，`gateConfirmed` 为 false 时 MUST 以 `gate-unconfirmed` 阻塞（fail-safe）
- **AND** 未声明 `condition` 且 `blocking` 未设置或为 `true` 的既有门 MUST 保持现有静态行为（`gateConfirmed` 为 false 时阻塞），本变更 MUST NOT 改变其判定
- **AND** 未声明 `condition` 且 `blocking: false` 的既有门 MUST 保持旧行为（不阻塞），MUST NOT 被新条件门逻辑改变

#### Scenario: verify-close 消费 fix 结果

- **WHEN** `fix` 阶段成功返回修复与回归测试结果
- **THEN** `verify-close` 消费这些结果并负责汇总验证、同步与需求文档状态；缺失或无效回执阻止自动推进

#### Scenario: investigate 交付 fix 所需输入

- **WHEN** `investigate` 阶段收束
- **THEN** 其 handoff MUST 含 `rootCause`、`defectChain`、`changeName`、`affectedSymbols`；缺失任一必需字段时 `fix` MUST NOT 启动，并按回执校验规则报告不完整

#### Scenario: 缺少宿主委派能力时遵循 strict/degraded

- **WHEN** 当前宿主无法提供阶段所需的技能委派、门或状态能力
- **THEN** strict 模式阻断；仅在显式协商 degraded 后允许透明降级，并记录未发生的委派/能力，不把本地执行伪装成 strict 完成

### Requirement: 已授权技能推进不增加重复业务确认

宿主适配器 SHALL 将父工作流入口意图或明确业务门对唯一 `nextAllowed` 技能/参数的确认映射为直接技能委派，不额外插入“是否调用该技能”的业务确认。该规则只授权当前明确指定的下一动作，不替代其他业务确认门，也不得绕过宿主工具权限、能力协商、门状态、回执或 strict/degraded 安全行为。

#### Scenario: 已授权的下一技能直接调用

- **WHEN** 当前入口或已确认门指定唯一下一项技能和参数，且宿主具备并授权所需能力
- **THEN** 适配器直接启动该委派，不添加重复的业务调用确认

#### Scenario: 宿主权限拒绝仍然有效

- **WHEN** 技能白名单、项目 permissions 或宿主工具策略拒绝该调用
- **THEN** 适配器按宿主规则停止并报告，不得把业务门确认视为工具权限许可

#### Scenario: 非法回执或未确认的其他门阻止推进

- **WHEN** 当前阶段回执缺少协议要求字段，或后续动作属于尚未确认的另一业务门
- **THEN** 编排器阻止推进；直接调用契约不得覆盖回执或其他门的检查

### Requirement: Pi 编排阶段 agent 的嵌套委派授予

当 Pi 被选为编排目标时，编排类阶段 agent 的定义 SHALL 生成 `allowed_subagents`，取值为该 workflow 的委派清单（`ORCHESTRATION_DELEGATIONS[<workflowId>]`）与实际已安装 stages 的交集，按 `iagent-<id>` 形态列出；声明但未安装的目标 SHALL 记入诊断缺口（`nestingGaps`）并输出 WARN。缺口处置 SHALL 区分两类：**无条件必需委派**的缺口按能力阻断（strict 下不得推进该阶段）；**条件委派**（该技能正文已声明 fallback / degraded 路径，如 `debug → proposal-review` 的内联只读复查、`debug → test` 的显式 degraded 本地编写）的缺口 SHALL 按正文声明的降级路径执行并记录 WARN，MUST NOT 因 Pi 文本被一律阻断；其中 `test` 仅在显式协商 degraded 时允许本地编写。两类情形均 MUST NOT 将本地执行表述为委派完成，MUST NOT 声称该委派在 strict 下可用。非编排阶段 agent MUST NOT 生成 `allowed_subagents`。本变更 MUST NOT 新增按 workflow 粒度的 strict 降级判定（strict 仍由既有 host 级能力协商决定）。

#### Scenario: 编排阶段 agent 可嵌套委派

- **WHEN** `iagent init` / `update` 为 Pi 生成 `debug` 阶段 agent 且 `requirement-doc` 已安装
- **THEN** 该定义 frontmatter 的 `allowed_subagents` MUST 含 `iagent-requirement-doc`，且 `test/pi-native.test.ts` 断言其存在

#### Scenario: 委派目标未安装时不伪装严格可用

- **WHEN** 委派清单声明的目标技能未安装
- **THEN** 该目标 MUST NOT 出现在 `allowed_subagents`；系统 SHALL 记录 `nestingGaps` 并输出 WARN
- **AND** 若该委派为无条件必需委派 → 阶段 SHALL 按能力阻断，MUST NOT 以本地执行替代
- **AND** 若该委派为条件委派且正文已声明降级路径 → SHALL 按该降级路径执行并记录 WARN（`test` 仅在显式协商 degraded 时允许本地编写），MUST NOT 被一律阻断
- **AND** 两类情形下阶段 agent 正文均 MUST NOT 声称该委派在 strict 下可用
