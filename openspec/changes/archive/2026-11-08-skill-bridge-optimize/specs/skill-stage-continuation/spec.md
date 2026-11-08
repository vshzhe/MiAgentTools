## ADDED Requirements

### Requirement: Stage delegation mechanism

系统 SHALL 按阶段类型选择委派机制：**交互阶段**（当前仅 `spec-explore`）SHALL 由主 agent 经宿主技能加载机制内联执行；**自动阶段**（`spec-propose` / `spec-verify-proposal` / `proposal-review` / `test` / `spec-apply` / `spec-verify` / `spec-archive`）SHALL 由前台子代理执行。Claude Code 的交互阶段 SHALL 使用 `Skill` 工具，自动阶段 SHALL 使用前台 `Agent`（兼容 `Task`）子代理；MUST NOT 把交互阶段放入隔离子代理。

子代理 MUST 在开始阶段工作前载入对应技能规程：优先经 `Skill(iagent-<workflowId>)` 加载；子代理工具面不支持 Skill 时 SHALL 降级为读取**宿主提供的技能路径**（Claude 为 `.claude/skills/iagent-<workflowId>/SKILL.md`，OpenCode / Pi 使用其各自技能目录）并按其执行。两种方式均不可用时 MUST 返回 `status=blocked` 并说明原因，MUST NOT 伪造阶段回执。

#### Scenario: 交互阶段保持内联以支持确认门

- **WHEN** `workflow` / `auto-workflow` 进入探索阶段
- **THEN** 主 agent SHALL 经 `Skill` 内联加载 `spec-explore`，提示词校验门与功能流程图门 SHALL 可向用户呈现
- **AND** MUST NOT 把 `spec-explore` 放入 Agent 子代理

#### Scenario: 自动阶段使用前台子代理

- **WHEN** 探索阶段完成，父编排进入提案、验证、实现或归档阶段
- **THEN** 对应阶段 SHALL 经前台 `Agent` 子代理执行，父级 SHALL 收到子代理最终消息作为 `tool_result`
- **AND** MUST NOT 使用后台 Agent 模式替代（后台结果在后续回合到达，破坏背靠背管线）

#### Scenario: 子代理载入失败报告 blocked

- **WHEN** 子代理既不能经 Skill 载入技能，也不能读取技能 SKILL.md
- **THEN** 子代理 SHALL 返回 `status=blocked` 与失败原因
- **AND** 父级 MUST NOT 把该阶段标记为完成或伪造回执

### Requirement: Continuation contract after delegated receipt

委派阶段的回执 SHALL 被视为**中间状态**，而非终态回复。父编排在收到 `status=ok` 且回执校验通过后 MUST 在同一用户回合内继续下一阶段的首个动作，MUST NOT 以回执或“阶段完成”消息结束回合。只有门白名单内的确认门是合法停点；其他动作（阶段宣告、技能委派、只读扫描、状态查询）MUST NOT 成为停点。

回执 SHALL 至少包含 `phase` / `status` / `artifact` / `nextAllowed`；失败时 SHALL 包含 `failure`。父编排 MUST 依据 `nextAllowed` 与阶段协议推进；`nextAllowed` 缺失或与下一阶段不匹配时 MUST NOT 推进。

#### Scenario: 回执后在同一用户回合继续

- **WHEN** 子代理返回 `status=ok` 且 `phase` / `artifact` / `nextAllowed` 有效
- **THEN** 父编排 SHALL 立即发起下一阶段的首个工具调用
- **AND** MUST NOT 输出“阶段完成，继续吗？”一类停点或结束回合

#### Scenario: 确认门是合法停点

- **WHEN** 下一阶段的首个动作是门白名单内的确认门（如实现 + 测试桥、归档桥）
- **THEN** 父编排 SHALL 呈现门并结束回合等待用户确认
- **AND** 用户确认后 SHALL 从门之后继续，不重新询问是否继续

#### Scenario: 失败回执不触发续跑

- **WHEN** 子代理返回 `status=failed` / `blocked` / `incomplete`
- **THEN** 父编排 MUST NOT 继续下一阶段；SHALL 按阶段重试策略处理，耗尽后暂停并报告 `failure`

### Requirement: Receipt validation and failure handling

父编排 SHALL 在推进前校验阶段回执。以下任一情形 SHALL 以 `invalid-receipt` 阻断：缺少 `phase` / `status` / `artifact` / `nextAllowed`；`status` 取值不在 `ok` / `failed` / `blocked` / `incomplete` 内；`status != ok` 但缺少 `failure`；`confirmedGates` 非字符串数组、含空串或含未知门 id。校验失败时 MUST NOT 自动推进，SHALL 报告缺失字段与恢复路径。

阶段重试 SHALL 遵守协议声明的 `maxAttempts` 与 `on` 类别；重试耗尽后 SHALL 暂停并保留失败原因。MUST NOT 把本地串行执行、伪造回执或过期回执表述为委派完成。

#### Scenario: 缺字段回执被阻断

- **WHEN** 子代理回执缺少 `nextAllowed`
- **THEN** 父编排 SHALL 以 `invalid-receipt` 阻断，列出缺失字段
- **AND** MUST NOT 继续下一阶段

#### Scenario: 非法 confirmedGates 被阻断

- **WHEN** 回执的 `confirmedGates` 含未知门 id 或空串
- **THEN** 校验 SHALL 失败并报告具体条目
- **AND** MUST NOT 把该门视为已确认

#### Scenario: 重试耗尽后暂停

- **WHEN** 阶段失败并按重试策略耗尽 `maxAttempts`
- **THEN** 父编排 SHALL 暂停并报告最后失败原因与已尝试次数
- **AND** MUST NOT 自动进入下一阶段

### Requirement: Cross-host delegation consistency

续跑语义 SHALL 跨宿主一致：OpenCode SHALL 使用 V2 `subagent` 与项目级 agent；Pi strict SHALL 使用已安装运行时提供的 Agent 能力；Codex SHALL 显式按 degraded 本地执行且不构成委派。所有宿主 SHALL 注入同一「回执是中间状态、门是合法停点」契约文本；MUST NOT 为某一宿主伪造另一宿主的机制或回执。

#### Scenario: OpenCode / Pi / Codex 的机制与续跑语义

- **WHEN** 为 OpenCode、Pi strict 或 Codex 生成编排段落
- **THEN** 段落 SHALL 声明该宿主的原生委派机制（或显式 degraded）并含续跑契约
- **AND** Codex MUST NOT 声称获得子代理回执或严格 gate 通过

#### Scenario: 跨宿主文本不硬编码 Claude 专属机制

- **WHEN** 审阅共享模板正文
- **THEN** MUST NOT 出现「经 Skill 工具」「Agent 工具」一类 Claude 专属机制词
- **AND** 机制词 SHALL 由生成期按宿主渲染

### Requirement: Authorization and permissions

续跑契约 SHALL NOT 绕过宿主工具权限、会话级权限、strict/degraded 能力协商或回执校验。业务门确认只授权当前门指定的动作，不授权后续不同副作用的动作。子代理可使用的工具 SHALL 受其宿主 agent 配置与父级授权的约束。

#### Scenario: 权限拒绝仍阻断

- **WHEN** 子代理调用被宿主权限策略拒绝
- **THEN** 子代理 SHALL 返回 `status=blocked` 及原因
- **AND** 父编排 MUST NOT 把业务门确认当作工具权限许可

#### Scenario: 已确认门的授权范围有限

- **WHEN** 用户在实现 + 测试桥确认实现动作
- **THEN** 续跑 SHALL 只授权该门指定的实现动作
- **AND** 后续归档或破坏性改动仍 SHALL 按其各自的门处理

### Requirement: Stage context envelope and data completeness

父编排 SHALL 在委派自动阶段时传递 **Stage Envelope**：`changeName` / `changeRoot` / `phase` / `workflowId` / `mode` / `gateSkips` / `confirmedGates` / `explorationFile` / `handoffPackPath` / `compileReportPath`（适用时）/ `upstreamReceipt` / `sourceFingerprint` / `rulesPath` / `configPath` / `resume`。Envelope MUST 只含路径与结构化字段，MUST NOT 内联制品正文或完整 `SKILL.md`。

子代理 SHALL 先读取 handoff 包，再按需增量读取制品；MUST NOT 重读包已覆盖的 proposal / specs / design，MUST NOT 重跑包已覆盖的 CodeGraph 查询。包未覆盖所需信息时，子代理 SHALL 补查制品并在回执中回报「缺什么、补查了什么」（包缺口回执）。

任一必需输入缺失、不可读或 `sourceFingerprint` 不一致且重建失败时，子代理 SHALL 返回 `status=incomplete` + `failure`，MUST NOT 凭猜测继续。父编排 MUST 在委派前做一次指纹校验；不一致 → 重建 handoff 包一次 + WARN；重建失败 → 不委派。

#### Scenario: 完整 Envelope 允许阶段执行

- **WHEN** 子代理收到含全部必需路径、上游回执与 `sourceFingerprint` 的 Envelope
- **THEN** 子代理先读 handoff 包，再按需增量读取制品并执行阶段
- **AND** MUST NOT 把制品正文或完整 SKILL.md 内联进 prompt

#### Scenario: 缺少必需路径时不猜测

- **WHEN** Envelope 缺少 `handoffPackPath` 或其他阶段必需路径
- **THEN** 子代理 SHALL 返回 `status=incomplete` + `failure` 说明缺失项
- **AND** MUST NOT 自行猜测路径或凭父级会话推断内容

#### Scenario: 陈旧 handoff 包

- **WHEN** `sourceFingerprint` 与当前制品不一致
- **THEN** 父编排 SHALL 重建 handoff 包一次并记 WARN
- **AND** 重建失败时 MUST NOT 委派，返回 `incomplete`

#### Scenario: 包缺口回执

- **WHEN** 子代理发现 handoff 包未覆盖其所需信息
- **THEN** 子代理 SHALL 补查制品并在回执中列出缺口与补查内容
- **AND** MUST NOT 凭包猜测字段或契约

### Requirement: Token budget and context isolation

阶段委派 SHALL 遵守 token 预算：Stage Envelope ≤ 2KB（不含子代理自行加载的技能正文）；Stage Receipt ≤ 40 行 / ≤ 2KB；handoff 包每节 ≤ 120 行；handoff 包是**蒸馏视图而非制品副本**，细节以路径引用。子代理最终消息 MUST 只含 Stage Receipt，MUST NOT 粘贴代码、制品正文或长分析；细节写入文件。对于 `proposal-review` / `spec-verify` 等需要完整报告的阶段，回执 MAY 携带 `reportPath` 与 ≤ 2KB 的 `reviewSummary`；完整报告写入 `attachments/` 或流程级工作区，MUST NOT 内联进回执。

同一阶段 MUST 只使用一个前台子代理；MUST NOT 使用后台 Agent。需要独立复查的 `verify-proposal` 与 `proposal-review` MAY 各自使用子代理，但 MUST 复用同一 handoff 包，MUST NOT 各自重产。阶段默认串行；MUST NOT 为同一制品启动两个以上读取同一全量制品的并行子代理，除非显式说明独立性收益。

#### Scenario: 回执保持在预算内

- **WHEN** 子代理完成阶段并返回最终消息
- **THEN** 最终消息 SHALL 是 Stage Receipt，且 ≤ 40 行 / ≤ 2KB
- **AND** MUST NOT 包含代码正文、完整制品或长篇分析

#### Scenario: 不内联制品与技能正文

- **WHEN** 父编排构造 Agent prompt
- **THEN** prompt MUST 只含 Envelope 与委派约束，MUST NOT 内联 proposal / specs / design / tasks 正文或完整 SKILL.md
- **AND** 子代理自行经 Skill / Read 加载技能规程

#### Scenario: handoff 包每节有界

- **WHEN** propose 产出或消费方重建 handoff 包
- **THEN** 每节 SHALL ≤ 120 行并以路径引用细节
- **AND** MUST NOT 把整份制品复制进包

#### Scenario: 禁止后台子代理

- **WHEN** 父编排委派自动阶段
- **THEN** MUST 使用前台 Agent，等待 `tool_result` 后再继续
- **AND** MUST NOT 使用后台 Agent 使结果延后到后续回合

### Requirement: Blocked stage resume protocol

子代理遇到门白名单内的用户门时，SHALL 返回 `status=blocked` + `blockedGate`（门 id）+ `failure`（阻塞原因）；遇到**非门类用户决策**（范围蔓延、材料性歧义、方案选择）时，SHALL 返回 `status=blocked` + `blockedReason`（自由文本）+ `failure`。MUST NOT 自行假装确认或继续。

父编排 SHALL 呈现门或决策并等待用户确认/选择：门类确认写入门账本；非门类决策写入 Envelope 的 `userDecision`。随后以 `resume=true` 重新委派同一阶段；子代理 SHALL 依据 handoff 包与 `tasks.md` 跳过已完成工作（幂等），MUST NOT 从头重做或重复写入。

若 `blockedGate` 与 `blockedReason` 均缺失，父编排 SHALL 停止并报告，MUST NOT 重新委派或静默继续。若阶段在部分写入后 `failed`，父编排 SHALL 先检查回执声明的产物路径，再以 `resume=true` 重试；子代理 SHALL 识别并跳过已完成的批次/任务。

#### Scenario: 阶段内门阻塞后恢复

- **WHEN** 子代理返回 `status=blocked` 且 `blockedGate=implementation-bridge`
- **THEN** 父编排 SHALL 呈现该门并等待确认
- **AND** 确认后写入门账本并以 `resume=true` 重新委派同一阶段
- **AND** 子代理 SHALL 跳过已完成工作

#### Scenario: 非门类用户决策后恢复

- **WHEN** 子代理在实现中检测到范围蔓延并返回 `status=blocked` + `blockedReason`
- **THEN** 父编排 SHALL 呈现该决策并等待用户选择
- **AND** 选择结果写入 Envelope `userDecision` 后以 `resume=true` 重新委派
- **AND** 子代理 MUST NOT 在未获得决策前继续实现

#### Scenario: 部分写入后的失败重试

- **WHEN** 子代理在部分任务完成后返回 `status=failed`
- **THEN** 父编排 SHALL 检查产物路径并按重试策略以 `resume=true` 重试
- **AND** 子代理 MUST NOT 重复已完成任务或覆盖已完成产物

#### Scenario: 无阻塞标识时停止

- **WHEN** 子代理返回 `status=blocked` 但 `blockedGate` 与 `blockedReason` 均缺失
- **THEN** 父编排 SHALL 停止并报告
- **AND** MUST NOT 重新委派、MUST NOT 视为已确认
