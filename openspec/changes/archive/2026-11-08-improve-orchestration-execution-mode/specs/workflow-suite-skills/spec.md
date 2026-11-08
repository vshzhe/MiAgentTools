## ADDED Requirements

### Requirement: 编排阶段按分级策略选择执行方式

`iagent_workflow`、`iagent_auto_workflow` 与 `iagent_debug` SHALL 按分级策略选择阶段执行方式，并在阶段回执中以 `executionMode` 声明实际执行方式：

- 探索阶段 SHALL 内联（`inline`）；
- 提案 / 实现 / 归档等变更类阶段 SHALL 经子代理执行（`subagent`）；debug 的 `fix` 阶段按 bug 派发单元经子代理执行；
- debug 的 `investigate` / `verify-close` 与探索阶段 SHALL 由主代理内联（`inline`）；其内部的验证 / 复查子阶段以嵌套子代理执行，阶段所有者仍为 `inline`；
- `iagent_test` SHALL 作为 apply / fix 内的条件子阶段要求 `subagent`，MUST NOT 新增顶层 `test` 阶段；
- 提案验证（`iagent_spec_verify_proposal`）、深度复查（`iagent_proposal_review`）与实现验证（`iagent_spec_verify`）运行于 `verify` 阶段，SHALL 默认子代理，允许内联但 MUST 同时满足「**非作者**（回执 `independence=independent`）+ 逐项检查清单与证据」；作者自证（`independence=self`）SHALL 允许但记 WARN，不视为合规内联验证；
- degraded 宿主 SHALL 全部标记 `local-degraded`，模板 MUST NOT 声称子代理完成。

模板 MUST 声明：strict 宿主缺少委派能力时阻断变更类阶段，MUST NOT 用内联执行伪装委派；内联验证后父级 MAY 要求改派独立子代理复查。

#### Scenario: auto-workflow 变更类阶段使用子代理

- **WHEN** strict 宿主的 auto-workflow 执行 Phase 2 提案、Phase 4 实现或 Phase 5 归档
- **THEN** 模板 SHALL 要求该阶段经子代理执行并在回执声明 `executionMode=subagent`
- **AND** MUST NOT 以主代理内联执行并视为阶段完成

#### Scenario: 探索阶段内联

- **WHEN** workflow / auto-workflow 执行 Phase 1 探索
- **THEN** 模板 SHALL 以内联方式执行该阶段
- **AND** MUST NOT 为探索启动子代理

#### Scenario: 只读验证内联受非作者约束

- **WHEN** 编排流程对提案验证或深度复查选择内联
- **THEN** 模板 SHALL 要求「非作者（`independence=independent`）+ 逐项检查清单与证据」同时满足
- **AND** 缺任一条件时 MUST NOT 视为合规内联，SHALL 改派独立子代理
- **AND** 作者自证（`independence=self`）SHALL 允许但记 WARN

#### Scenario: debug 修复阶段不得内联伪装

- **WHEN** debug 的 fix 阶段需要修改代码与测试
- **THEN** 该阶段 SHALL 经子代理执行并声明 `executionMode=subagent`
- **AND** 主代理内联修改后 MUST NOT 声称委派完成
- **AND** `iagent_test` 作为 fix 内的子阶段同样经子代理执行

#### Scenario: debug 交互与收束阶段内联

- **WHEN** debug 执行 investigate（诊断 + 方案确认）或 verify-close（编译 / 验证 / 复查收束）
- **THEN** 阶段所有者 SHALL 为主代理 `inline`
- **AND** 其内部的验证 / 复查 MAY 以嵌套子代理执行，MUST NOT 把阶段所有者标记为 `subagent`

#### Scenario: degraded 宿主显式本地执行

- **WHEN** 编排技能在 Codex 或 Pi degraded 宿主运行
- **THEN** 回执 SHALL 声明 `executionMode=local-degraded`
- **AND** 每个被跳过的委派 SHALL 记录原因

### Requirement: 修复后增量复验

编排流程在验证 FAIL 并完成修复后 SHALL 使用**增量复验**：新开只读验证代理，Stage Envelope 只传 `changeName`、`fixDiff`、上轮 `reportPath` 与检查清单，要求其仅验证增量覆盖范围并输出新的 `reportPath`、`readScope` 与 `dependsOn`。父级 MUST NOT 使用 resume 恢复上一验证代理来充当复验；resume 仅用于阶段中断续跑，且回执 MUST 标 `contextReplay=true` 并记 WARN。

自动修复若改动制品，父级 SHALL 在验证通过后按新指纹重建 handoff 包一次；重建失败 SHALL 记为 `incomplete` 并阻止进入实现。

#### Scenario: 复验新开代理

- **WHEN** auto-workflow / workflow 的提案验证 FAIL 且父级完成自动修复
- **THEN** 父级 SHALL 新开只读代理并只传 `fixDiff` 与上轮 `reportPath`
- **AND** MUST NOT 以 resume 恢复上一验证代理执行复验

#### Scenario: 增量范围与残留清单

- **WHEN** 增量复验代理执行
- **THEN** 报告 SHALL 逐条覆盖 `fixDiff` 条目并给出结论与证据
- **AND** 对未覆盖范围 SHALL 输出 residual 清单供父级决定是否追加全量复查

#### Scenario: 修复后重建 handoff 包

- **WHEN** 自动修复改动了 proposal / design / specs / tasks
- **THEN** 验证通过后父级 SHALL 按新 `sourceFingerprint` 重建 handoff 包一次
- **AND** 重建失败时 SHALL 以 `incomplete` 阻止进入实现

#### Scenario: resume 只用于续跑

- **WHEN** 阶段因中断需要恢复
- **THEN** SHALL 使用 resume 并在回执标 `contextReplay=true` 与 WARN
- **AND** 该结果 MUST NOT 计为复验通过

### Requirement: 提案验证串联 proposal-review

`iagent_proposal_review` SHALL 默认读取 `iagent_spec_verify_proposal` 的回执 `reportPath` 作为输入，并在自身回执中标记 `dependsOn: [<reportPath>]`；对报告已覆盖的维度 SHALL 只做增量核对，MUST NOT 重复全量读取全部制品。报告缺失或不可读时 SHALL 退化为独立全量复查并记 WARN。串联模式下两步 SHALL **顺序执行**（先 verify-proposal、后 proposal-review），MUST NOT 并行启动后再串联。

两者职责 SHALL 保持非重叠：`iagent_spec_verify_proposal` 负责 D1-D5 核心维度与 D6-D10 条件维度的评分门（90% 阈值），`iagent_proposal_review` 负责实现合规与覆盖度深探，MUST NOT 重跑同一套评分。

#### Scenario: 复查消费验证报告

- **WHEN** workflow / auto-workflow 的提案验证 PASS 后触发 `iagent_proposal_review`
- **THEN** 复查 SHALL 读取验证报告路径作为输入并标 `dependsOn`
- **AND** 回执 `readScope` SHALL 反映实际读取的增量范围

#### Scenario: 报告缺失时独立复查

- **WHEN** `reportPath` 缺失、不可读或不属于当前变更
- **THEN** `iagent_proposal_review` SHALL 退化为独立全量复查
- **AND** SHALL 记 WARN 说明串联失效原因

#### Scenario: 双门职责不重叠

- **WHEN** 两个验证代理先后执行
- **THEN** 深度复查 MUST NOT 重复 D1-D10 评分
- **AND** 验证器 MUST NOT 承担实现合规深探

### Requirement: handoff 包制品清单与读取范围

handoff 包 SHALL 在 `## 契约` 之后、`## 规范要点` 之前新增 `## 制品清单` 节（与六节并列、不计入六节）：每行形如 `<相对路径> | <字节数> | <sha256 前 12 位> | <章节锚点列表>`，覆盖 proposal / design / specs / tasks。子代理 MUST 先读取该节，再按需增量读取被引用的文件与章节；MUST NOT 未经清单直接全量重读全部制品。阶段回执 SHALL 以 `readScope` 记录实际读取的文件与章节。该段落位 MUST NOT 改变六节既有顺序与门账本解析边界。

清单与磁盘不一致（文件缺失、大小或 sha256 不符）时 SHALL 重建清单并记 WARN，MUST NOT 沿用陈旧清单。指纹来源 SHALL 优先 `iagent spec fingerprint --change <name>`；子命令不可用时回退 handoff 包 `sourceFingerprint` 并记 WARN。

#### Scenario: 子代理先读清单再增量读取

- **WHEN** auto-workflow / workflow 委派阶段子代理
- **THEN** 子代理 MUST FIRST 读取 handoff 包 `## 制品清单`
- **AND** 只按清单条目与章节锚点增量读取，MUST NOT 全量重读四类制品

#### Scenario: 回执记录读取范围

- **WHEN** 子代理完成阶段并返回回执
- **THEN** 回执 SHALL 含 `readScope`（文件 + 章节）
- **AND** 未读取的制品 MUST NOT 出现在 `readScope`

#### Scenario: 制品清单不破坏六节与门账本解析

- **WHEN** handoff 包在 `## 契约` 后插入 `## 制品清单`
- **THEN** 六节的既有顺序与门账本段解析边界（下一个 `##` 即段结束）SHALL 保持不变
- **AND** MUST NOT 把制品清单计入六节或门账本

#### Scenario: 清单陈旧时重建

- **WHEN** 制品清单中的大小或 sha256 与磁盘不一致
- **THEN** 父级 SHALL 重建清单并记 WARN
- **AND** MUST NOT 让子代理按陈旧清单继续读取

#### Scenario: 指纹优先走 CLI

- **WHEN** 模板需要复算制品指纹
- **THEN** SHALL 优先调用 `iagent spec fingerprint --change <name>`
- **AND** 子命令不可用时 SHALL 回退 handoff 包 `sourceFingerprint` 并记 WARN

### Requirement: 阶段结论记录用量

handoff 包 `## 阶段结论` SHALL 使用表头 `phase | status | artifact | nextAllowed | tokens`，在宿主暴露 token 用量时填入 `tokens=<数值>`；不可得时填 `—`，MUST NOT 编造或估算；`usage` 字段同样遵循该约束。该表保持**只追加行、不改写既有行**；旧包缺 `tokens` 列时消费者按 `—` 处理。

#### Scenario: 可用时记录 tokens

- **WHEN** 阶段回执含 `usage.tokens` 且宿主暴露该数值
- **THEN** 父级 SHALL 在 `## 阶段结论` 追加行中含 `tokens=<数值>`
- **AND** MUST NOT 改写既有行

#### Scenario: 不可用时填 —

- **WHEN** 宿主不暴露 token 用量
- **THEN** `## 阶段结论` 的 `tokens` 列 SHALL 填 `—`
- **AND** MUST NOT 写入估算值或占位数字
