## ADDED Requirements

### Requirement: handoff 包门账本段（已确认门）

变更级 handoff 包 SHALL 支持 `## 已确认门` 段作为门账本载体：该段与既有六节（`## 变更摘要` / `## 契约` / `## 规范要点` / `## 文件归属表` / `## Codebase 摘要` / `## 已产出（跨单元可见）`）并列，MUST NOT 计入六节、MUST NOT 改变六节的语义与相对顺序，也 MUST NOT 改变 `## 阶段结论` 只追加的语义。

段内容约束：

- 每行 SHALL 记录一个门 id + 其确认阶段（写入方阶段标识），门 id MUST 收敛到 `GATE_SKIP_IDS`；条目格式 SHALL 为 Markdown 表格行（形如 `| <门 id> | <确认阶段> |`），解析 MUST 剥离首尾 `|` 与空白，MUST NOT 依赖列宽对齐，且 SHALL 跳过表头行与分隔行（`| 门 id | 确认阶段 |` / `| --- | --- |`）；
- MUST NOT 记录业务决策正文（提案取舍、设计方案、需求文档内容）—— 账本只解决「哪个门已确认」，不承载决策内容（复杂度边界）；
- 写入方 SHALL 在门确认后立即写、委派前校验存在；读取方 SHALL 只读，MUST NOT 改写既有条目；
- 未知门 id SHALL 被忽略并记 WARN，MUST NOT 按「全部门已确认」处理；
- 段缺失 SHALL 视为「无账本」，门照常触发（fail-safe）。

账本段的**唯一路径** SHALL 由 change-name 确定性派生（`.openspec-tmp/pipeline-<change-name>/handoff-pack.md`），MUST NOT 作为新的委派参数键传入 —— 委派参数仍只允许 `mode` / `gate-skip`（`auto-mode` 为兼容写法），MUST NOT 新增第三轴或未知参数键。

#### Scenario: 六节语义与顺序不变

- **WHEN** handoff 包同时包含六节、`## 已确认门` 与 `## 阶段结论`
- **THEN** 六节内容与相对顺序 MUST 与引入账本前一致，`## 已确认门` SHALL 作为独立段存在
- **AND** 六节计数 MUST NOT 因账本段变为七节（账本不是新的内容节）

#### Scenario: 账本只记录门 id 与确认阶段

- **WHEN** 父级在门确认后写入 `## 已确认门`
- **THEN** 该段 SHALL 只含门 id（`GATE_SKIP_IDS` 内取值）与确认阶段
- **AND** MUST NOT 出现提案 / 设计 / 需求文档的业务决策正文

#### Scenario: 跨阶段只读复用且不改写账本

- **WHEN** 被委派技能（`spec-apply` / `spec-verify` / `spec-archive`）读取已含 `## 已确认门` 的 handoff 包
- **THEN** 技能 SHALL 只读该段，收尾只向 `## 阶段结论` 追加行
- **AND** MUST NOT 重产整包、MUST NOT 改写或删除父级已写入的账本条目

## MODIFIED Requirements

### Requirement: spec-apply 门承载参数契约

`iagent_spec_apply` SHALL 接受 `gate-skip=design-confirmation` 作为门承载参数，并继续接受 `auto-mode=true` 作为其**兼容等价写法**（语义相同：只跳过设计确认门）。

技能 SHALL 按以下**降级链**判定设计确认门是否已由父级承载（顺序强制）：

1. **主通道 `gate-skip`**：传入 `gate-skip=design-confirmation`（或兼容写法 `auto-mode=true`）时，跳过 Step 5.5 设计确认门整道门（批计划仍在内部构建用于执行，但不向用户展示）。
2. **兜底通道门账本**：未传 `gate-skip` 时，技能 SHALL 只读 handoff 包 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md` 的 `## 已确认门` 段；段内声明 `design-confirmation` 时跳过 Step 5.5，并记 WARN 说明「使用了门账本兜底通道」。账本条目 MUST 与父级阶段回执的 `confirmedGates` 一致；不一致或条目过期 → 记 WARN 并视为**未确认**（门照常执行）。
3. **两者皆缺失**：既无 `gate-skip` 也无账本条目时，Step 5.5 设计确认门 MUST 照常执行（fail-safe），MUST NOT 静默跳过、MUST NOT 以「父流程不会重复确认」推断为已确认。

主通道存在时 MUST NOT 读取账本作覆盖（`gate-skip` 是唯一权威）。除设计确认门外，其余停点与门（测试执行门、范围蔓延确认、编译失败处理、批次派发协议、共享资源协议、退出守卫）MUST 照常生效，MUST NOT 因任一通道被豁免。

#### Scenario: gate-skip 跳过设计确认门

- **WHEN** apply 以 `gate-skip=design-confirmation` 被调用
- **THEN** Step 5.5 设计确认门整道跳过（批计划仍在内部构建但不向用户展示），直接进入批次调度

#### Scenario: auto-mode 兼容写法行为一致

- **WHEN** 分别以 `auto-mode=true` 与 `gate-skip=design-confirmation` 调用 apply
- **THEN** 两者行为逐条一致（同一道门被跳过，其余门与停点相同）

#### Scenario: 账本兜底跳过设计确认门

- **WHEN** apply 未收到 `gate-skip`，但 handoff 包 `## 已确认门` 声明 `design-confirmation` 且与父级回执的 `confirmedGates` 一致
- **THEN** 技能 SHALL 跳过 Step 5.5 设计确认门并记 WARN 说明使用兜底通道
- **AND** 其余门与停点 MUST 照常生效

#### Scenario: 账本缺失时 Step 5.5 仍执行

- **WHEN** apply 既未收到 `gate-skip`，handoff 包也不存在 `## 已确认门` 段或段内无 `design-confirmation`
- **THEN** 技能 MUST 执行 Step 5.5 设计确认门并等待用户显式确认
- **AND** MUST NOT 静默跳过、MUST NOT 报告「设计已确认」

#### Scenario: 账本与回执不一致时视为未确认

- **WHEN** 账本声明 `design-confirmation`，但父级回执的 `confirmedGates` 未包含该门（伪造 / 过期）
- **THEN** 技能 SHALL 记 WARN 并视为未确认，Step 5.5 照常执行
- **AND** MUST NOT 把该门标记为已确认

#### Scenario: 其余门与停点不被豁免

- **WHEN** apply 以 `gate-skip=design-confirmation`（或经账本兜底）运行并遇到测试失败或范围蔓延
- **THEN** 对应门与停点 SHALL 照常生效，MUST NOT 以「门已跳过」为由继续推进
