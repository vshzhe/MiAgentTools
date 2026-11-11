## MODIFIED Requirements

### Requirement: Continuation contract after delegated receipt

委派阶段的回执 SHALL 被视为**中间状态**，而非终态回复。父编排在收到 `status=ok` 且回执校验通过后 MUST 在同一用户回合内继续下一阶段的首个动作，MUST NOT 以回执或“阶段完成”消息结束回合。只有门白名单内的确认门是合法停点；其他动作（阶段宣告、技能委派、只读扫描、状态查询）MUST NOT 成为停点。

回执 SHALL 至少包含 `phase` / `status` / `artifact` / `nextAllowed`；失败时 SHALL 包含 `failure`。父编排 MUST 依据 `nextAllowed` 与阶段协议推进；`nextAllowed` 缺失或与下一阶段不匹配时 MUST NOT 推进。

**续跑断言（执行侧）**：`status=ok` 且校验通过后，回执的 `nextAllowed`（阶段 id）SHALL 即本回合的下一动作——编排器 MUST 先解析该阶段并执行其委派 / 内联工具调用，再输出任何文字 (D3)。回执 SHALL 内部化：MUST NOT 把回执正文作为面向用户的最终消息，用户可见输出至多一行进度 (D4)。

**停点门自检**：任何停点之前，编排器 SHALL 引用门白名单的**类别 id 或锚点 id**；`destructive-change` 无阶段锚点，SHALL 只认其类别 id (D3)。无法引用任一合法 id 时 MUST NOT 停点，SHALL 继续续跑。

**中断恢复**：用户在阶段之间发来「继续」类指令时，编排器 SHALL 直接执行上一回执的 `nextAllowed`，MUST NOT 重新询问，MUST NOT 重跑已确认的门 (D3)。

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

#### Scenario: 回执不作为面向用户的最终消息

- **WHEN** 阶段以 `status=ok` 收束
- **THEN** 编排器 SHALL 只输出至多一行进度，并已在同一回合发起下一阶段动作
- **AND** MUST NOT 把回执字段表、阶段小结或「等待确认」作为该回合最终消息

#### Scenario: 停点前必须引用合法门 id

- **WHEN** 编排器准备停止并等待用户
- **THEN** SHALL 引用门白名单类别 id 或锚点 id（`destructive-change` 用类别 id）
- **AND** 无法引用任一合法 id 时 MUST NOT 停点，SHALL 继续 `nextAllowed`

#### Scenario: 用户「继续」直接续跑

- **WHEN** 阶段之间用户发来「继续」类指令
- **THEN** 编排器 SHALL 直接执行上一回执的 `nextAllowed`
- **AND** MUST NOT 重新询问是否继续或重跑已确认的门

### Requirement: Receipt validation and failure handling

父编排 SHALL 在推进前校验阶段回执。以下任一情形 SHALL 以 `invalid-receipt` 阻断：缺少 `phase` / `status` / `artifact` / `nextAllowed`；`status` 取值不在 `ok` / `failed` / `blocked` / `incomplete` 内；`status != ok` 但缺少 `failure`；`confirmedGates` 非字符串数组、含空串或含未知门 id。

**回执落盘**：编排器 SHALL 在收到阶段回执后写入 `.openspec-tmp/pipeline-<change>/receipts/<phase>.json` 再读取校验；SHALL NOT 要求无 `Write` 权限的阶段（如 `spec-verify`）新增写入权，MUST NOT 为此新增 CLI 命令。存量场景无落盘文件时，SHALL 按会话回执自检并记 WARN，MUST NOT 判为失败。

**推进判定顺序**：SHALL 为「能力（生成期协商结果 + `requiredCapabilities` 静态比对）→ 门（白名单）→ 回执（`validateReceipt` + `resolveNextPhase`）」。**门优先**：回执非法与门未确认同时出现时，SHALL 先处理门。

**自动重试条件**：`invalid-receipt` 时 SHALL 以相同参数自动重试该阶段一次；重试仅当 `blockedBy` 恰为 `['invalid-receipt']` 时适用，MUST NOT 因门未确认或能力缺失触发自动重试。重试仍失败 SHALL 暂停并报告缺失字段与失败原因，MUST NOT 询问「是否继续」。

**能力缺失与未知门**：SHALL 以阻断并报告处理，MUST NOT 作为面向用户的停点 (D11)。

**门承载参数缺失**：`gate-skip` 与 handoff 包 `## 已确认门` 账本**皆缺**时，被委派方 SHALL 返回 `status=blocked` 并中止，MUST NOT 询问用户是否继续 (D9)。

`nextAllowed` SHALL 保持阶段 id 语义；`resolveNextPhase(protocol, phaseId, nextAllowed)` 不可解析时 SHALL 视为 `invalid-receipt` (D12)。

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

#### Scenario: 回执落盘后可校验

- **WHEN** 阶段返回回执
- **THEN** 编排器 SHALL 写入 `.openspec-tmp/pipeline-<change>/receipts/<phase>.json` 并读取校验
- **AND** MUST NOT 要求该阶段技能新增 `Write` 权限，MUST NOT 新增 CLI 命令

#### Scenario: 门优先于回执重试

- **WHEN** 回执非法且阶段门未确认（`blockedBy` 同时含 `gate-unconfirmed` 与 `invalid-receipt`）
- **THEN** 编排器 SHALL 先处理门
- **AND** MUST NOT 因该情形触发阶段自动重试

#### Scenario: nextAllowed 不可解析即非法回执

- **WHEN** `nextAllowed` 不是当前工作流协议中的可解析阶段 id
- **THEN** `resolveNextPhase` SHALL 返回不可解析并以 `invalid-receipt` 处理
- **AND** 重试一次仍不可解析时 SHALL 暂停并报告

#### Scenario: 参数与账本皆缺时 blocked

- **WHEN** `gate-skip` 未传入且 handoff 包 `## 已确认门` 无对应条目
- **THEN** 被委派方 SHALL 返回 `status=blocked` 并中止
- **AND** MUST NOT 询问用户是否继续
