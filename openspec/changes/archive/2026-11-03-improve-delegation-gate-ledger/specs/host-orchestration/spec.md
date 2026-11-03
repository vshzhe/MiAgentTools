## ADDED Requirements

### Requirement: 门账本（gate ledger）与阶段回执确认门字段

系统 SHALL 以「门账本」作为委派门承载的**第二通道**：`gate-skip` 仍是主通道，账本仅在参数丢失时兜底。账本载体为变更级 handoff 包 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md` 的 `## 已确认门` 段（与既有六节并列，MUST NOT 改变六节语义），每行记录一个已确认门 id 与其确认阶段；门 id 取值 MUST 收敛到 `GATE_SKIP_IDS`（`src/core/host-orchestration/delegation-contract.ts`），MUST NOT 另立第二份取值表。

`Receipt` SHALL 增加可选字段 `confirmedGates: string[]`，用于跨阶段交付「该阶段实际已确认的门」。该字段 MUST NOT 进入 `DEFAULT_RECEIPT_FIELDS`（缺失即视为「无账本」，门照常触发，属 fail-safe 方向）。`validateReceipt` SHALL 校验其形状与取值：非数组、元素非字符串、元素为空串、或元素不在 `GATE_SKIP_IDS` 内 → 校验失败并附原因，阶段推进 SHALL 以 `invalid-receipt` 阻断，MUST NOT 静默忽略非法条目。

写入与读取契约：

- **写入时机（U4）**：父级 SHALL 在门确认后**立即**把该门写入账本，并在**委派前校验账本段与条目存在**；写入失败或校验失败（工作区不可写 / 文件写入异常 / 段缺失）→ SHALL 停止并报告期望路径与原因，MUST NOT 委派（禁止出现「既无参数也无账本」的静默跳过）。
- **回执为上游真源**：父级写账本时 SHALL 以该阶段回执的 `confirmedGates` 为准；账本条目 MUST NOT 超出回执声明的已确认门。
- **不一致处置**：消费方发现账本与回执不一致（账本含回执未声明的门）、或账本条目无法与当前变更的确认记录对应（伪造 / 过期）→ SHALL 记 WARN，并将该门视为**未确认**；MUST NOT 把未确认门标记为已确认、MUST NOT 据此跳过任何门。
- **主通道优先**：`gate-skip` 与该账本同时声明同一门时以 `gate-skip` 为准；`gate-skip` 缺失而账本声明该门时按兜底通道跳过该门并记 WARN（说明使用了兜底通道）；两者皆缺失时门 MUST 照常触发。
- **只读与只追加**：被委派技能 SHALL 只读账本，MUST NOT 改写父级已写入的条目，只允许向 `## 阶段结论` 追加行。
- **未知门 id**：解析账本时未知门 id SHALL 被忽略并记 WARN（复用 `resolveDelegationContract` 的 warn/ignore 模式），MUST NOT 按「全部门已确认」处理。
- **语义（门承载，不是父级阶段门）**：账本条目表达的是「该门已由父级承载、被委派方无需再确认」这一事实，取值域为 `GATE_SKIP_IDS`（当前仅 `design-confirmation`）；MUST NOT 把父级的**阶段门 id**（如 `implementation-bridge`、`requirement-doc-bridge`）写入账本，也 MUST NOT 因父级确认了别的门而回填 `design-confirmation`（父子门 id 的对应关系由父级模板显式声明，见 `workflow-suite-skills`）。
- **解析容错**：账本段内的表头行与分隔行（形如 `| 门 id | 确认阶段 |`、`| --- | --- |`）SHALL 被解析器跳过，MUST NOT 作为门 id 处理或产生 WARN。

账本 SHALL NOT 新增门类别：`GATE_WHITELIST` 仍为 5 类、锚点集合逐字不变，账本只是既有门的**传递通道**，MUST NOT 被建模为门。

#### Scenario: 门确认后写账本并在委派前校验存在

- **WHEN** 用户在某一阻塞确认门（实现桥 / 交付桥 / 文档桥）回复确认，父级准备委派下一阶段
- **THEN** 父级 SHALL 立即把该门 id 写入 handoff 包 `## 已确认门`，写入的值 MUST 与阶段回执的 `confirmedGates` 一致
- **AND** 委派前 SHALL 校验该段与该条目存在；缺失、写入失败或校验失败 → 停止并报告期望路径与原因，MUST NOT 委派

#### Scenario: 账本缺失时门仍触发（fail-safe）

- **WHEN** 被委派技能既未收到 `gate-skip`，handoff 包也不存在 `## 已确认门` 段（或段内无该门）
- **THEN** 该门 MUST 照常执行并等待用户确认，MUST NOT 静默跳过、MUST NOT 推断为已确认

#### Scenario: 账本与回执不一致时 WARN 且不视为已确认

- **WHEN** 账本声明某门已确认，但对应阶段回执的 `confirmedGates` 未包含该门（伪造 / 过期 / 人工改写）
- **THEN** 系统 SHALL 记 WARN（含门 id 与不一致原因）并将该门视为未确认
- **AND** MUST NOT 把未确认门标记为已确认、MUST NOT 据此跳过该门

#### Scenario: 回执 confirmedGates 形状非法时阻断推进

- **WHEN** 回执的 `confirmedGates` 不是字符串数组，含空串，或含 `GATE_SKIP_IDS` 之外的门 id
- **THEN** `validateReceipt` SHALL 返回无效并给出原因，阶段推进以 `invalid-receipt` 阻断
- **AND** MUST NOT 把未知 id 视为其它门或忽略后继续推进

#### Scenario: 账本条目表达门承载语义而非父级阶段门

- **WHEN** 父级在确认自己的阶段门（如 `implementation-bridge` / `requirement-doc-bridge`）后写入账本
- **THEN** 账本条目 SHALL 写入 `GATE_SKIP_IDS` 域内的门承载 id（当前为 `design-confirmation`），MUST NOT 写入父级阶段门 id
- **AND** 账本段内的表头行与分隔行 SHALL 被跳过，MUST NOT 被当作门 id 或产生 WARN

#### Scenario: 账本不新增门类别与门预算

- **WHEN** 检查引入账本后的 `GATE_WHITELIST` 与各阶段阻塞门数量
- **THEN** `GATE_WHITELIST` 仍为 5 类且锚点集合不变，每阶段仍至多 1 个阻塞门
- **AND** 账本 MUST NOT 被登记为门，MUST NOT 出现在 `WORKFLOW_PROTOCOLS` 的 `PhaseSpec.gate` 中

## MODIFIED Requirements

### Requirement: auto-workflow 协议阶段门与模板声明一致

`WORKFLOW_PROTOCOLS['auto-workflow']` SHALL 使用 auto-workflow 专用阶段定义，使协议门清单与其模板正文声明一致：APPLY / ARCHIVE 阶段 SHALL NOT 声明阻塞门（模板声明该两阶段除需求文档桥外无用户确认）；VERIFY 阶段 SHALL 显式声明 `requirement-doc-bridge` 阻塞门。

`WORKFLOW_PROTOCOLS['workflow']` SHALL 使其协议门清单与合并后的模板声明一致：VERIFY 阶段 MUST NOT 再声明 `requirement-doc-bridge` —— 需求文档选项由 APPLY 阶段的 `implementation-bridge` 承载（模板以一次「交付桥」呈现「实现方案 + 测试计划预告 + 是否生成需求文档」），故 `workflow` 的验证阶段阻塞门为 0、实现阶段阻塞门为 1（`implementation-bridge`）。

`requirement-doc-bridge` SHALL 继续作为 `requirement-clarification` 白名单类别的锚点存在（**白名单仍为 5 类**），保留给 `auto-workflow` 的 VERIFY 与 `debug` 的 `verify-close`；`PHASE_GATE_CATEGORY['requirement-doc-bridge']` SHALL 保持为 `requirement-clarification`，MUST NOT 因 `workflow` 不再声明该阶段门而删除锚点或类别映射。MUST NOT 因此新增第 6 类、MUST NOT 改变其余 4 类的语义与不可豁免性、MUST NOT 改变 `GateSpec` 形状与条件门语义。

#### Scenario: auto-workflow 的 APPLY 与 ARCHIVE 无阻塞门

- **WHEN** 读取 `WORKFLOW_PROTOCOLS['auto-workflow']` 的 `apply` / `archive` 阶段
- **THEN** 该两阶段 MUST NOT 声明阻塞门，与模板「除文档桥外无用户确认」的声明一致

#### Scenario: auto-workflow 的 VERIFY 声明文档桥门

- **WHEN** 读取 `WORKFLOW_PROTOCOLS['auto-workflow']` 的 `verify` 阶段
- **THEN** 该阶段 SHALL 声明 `requirement-doc-bridge` 阻塞门

#### Scenario: workflow 的 VERIFY 不再声明文档桥门

- **WHEN** 读取 `WORKFLOW_PROTOCOLS['workflow']` 的 `verify` / `apply` 阶段
- **THEN** `verify` MUST NOT 声明 `requirement-doc-bridge`（该阶段无阻塞门）
- **AND** `apply` SHALL 声明 `implementation-bridge` 阻塞门，需求文档选项在该门的模板呈现（交付桥）内承载
- **AND** `debug` 的 `verify-close` SHALL 仍声明 `requirement-doc-bridge`，其阻塞门数量仍为 1

#### Scenario: 白名单仍为 5 类且锚点包含文档桥

- **WHEN** 统计 `GATE_WHITELIST` 类别数并检查锚点集合
- **THEN** 类别数仍为 5，`requirement-doc-bridge` SHALL 出现在 `requirement-clarification` 的 `anchors` 中

#### Scenario: 协议门全部落在白名单锚点内

- **WHEN** 收集 `WORKFLOW_PROTOCOLS` 全部 `PhaseSpec.gate.id` 并对照白名单锚点与 `PHASE_GATE_CATEGORY`
- **THEN** 每个门 id SHALL 命中某个白名单条目的 `anchors` 且 `auditGateWhitelistAlignment()` 返回空数组
- **AND** 出现白名单外的门时一致性测试失败
