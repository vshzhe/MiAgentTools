## MODIFIED Requirements

### Requirement: Tasks maintain explicit traceability to requirements

任务 SHALL 支持以稳定、可读的 `Spec Ref` 与 `Scenario Ref` 将实现与测试任务关联到能力规格及场景。Requirement
与 Scenario 两级覆盖判定语义 MUST 保持不变，本契约只规定引用书写形态与上下文补全规则（D1）。

**规范形态（canonical，D2）**：

- `Spec Ref`：`<capability> / <Requirement>`
- `Scenario Ref`：`<Scenario>`（**场景叶子名**，只写 `#### Scenario:` 的名称，不重复 `capability / Requirement` 前缀）

解析/校验层 SHALL 用**同一任务**的 `Spec Ref` 把叶子名补全为 `capability / Requirement / Scenario` 全路径后再参与
覆盖校验；MUST 只使用同一任务的 Spec Ref，MUST NOT 跨任务或跨 capability 推断（D2）。

解析器 SHALL 同时接受以下等价书写，且 MUST NOT 因书写形态不同而判定引用失效：

- 行式：`- Spec Ref：<值>` / `- Scenario Ref：<值>`（半角 `:` 与全角 `：` 均可，允许 `-` / `*` 前缀与缩进）；
- HTML 注释式：`<!-- Spec Ref: <值> -->`（可带 `→` 分隔与 `Requirement:` / `Scenario:` 标签，如 `<!-- Spec Ref: <capability> → Requirement: "<R>" → Scenario: "<S>" -->`）；
- 同一行同时含 Spec 与 Scenario：解析结果 SHALL 同时产出 `specRef` 与 `scenarioRef` 各一条，但 canonical 仍推荐拆成两行；
- 历史形态（D3）：`<capability> / <requirement> / <scenario>` 全路径、`<capability> / <requirement>` 与裸 requirement /
  scenario 名（既有 tasks.md 兼容）。

**叶子名判定（D2）**：`Scenario Ref` 值不含 `/` 且不含 `→` 时视为场景叶子名；值本身含 `/` 或 `→` 时 MUST 视为
全路径 / 链式形态，MUST NOT 再做叶子补全（避免场景名含分隔符时误判）。

**上下文补全与 fail-safe（D2 / D3）**：

- 任务恰好 1 条 `Spec Ref` 且场景为叶子名：用该 Spec Ref 补全 `capability / Requirement / Scenario`；
- 任务无 `Spec Ref` 但存在叶子名 `Scenario Ref`：SHALL 报 `scenario-ref-missing-context`，消息 MUST 明确写出
  「缺少上下文」并给出期望形态全路径；MUST NOT 猜测归属；
- 任务有 ≥2 条 `Spec Ref` 且场景为叶子名：SHALL 报 `ambiguous-scenario-ref`，消息 MUST 明确写出「歧义」并要求
  写全路径；MUST NOT 任选其一。

校验器 SHALL 检查引用目标存在，缺失或失效引用 SHALL 被报告，MUST NOT 通过推测自动绑定：

- 引用只到 capability（缺少 Requirement）时 SHALL 报告 `spec-ref-missing-requirement`，消息 MUST 明确写出「缺少 Requirement」并给出期望形态 `capability / Requirement`；
- `Scenario Ref` 只到 Requirement（缺少 Scenario）时 SHALL 报告 `scenario-ref-missing-scenario`，消息 MUST 给出期望形态 `capability / Requirement / Scenario`；
- 引用目标在 specs 中不存在时 SHALL 报 `invalid-spec-ref` / `invalid-scenario-ref`；
- 叶子名补全后场景在该 `capability / Requirement` 下不存在时 SHALL 报 `invalid-scenario-ref`，MUST NOT 跨 Requirement
  或跨 capability 匹配到同名场景。

覆盖计数（D1）：同一 Scenario 被多行引用（含全路径与叶子名混写）时 SHALL 只计一次覆盖，MUST NOT 重复计。

部分校验（`--partial`）下，当 specs artifact 尚未完成（缺文件或因结构无效未 done）时，未匹配引用 SHALL 降级为
`pending-ref` 的 `warning`（起草期正常中间态）；`scenario-ref-missing-context` 与 `ambiguous-scenario-ref` 同样降级；
specs 已完成时未匹配引用 MUST NOT 降级，仍为 `error`。

#### Scenario: 场景叶子名由同任务 Spec Ref 补全

- **WHEN** 任务有 1 条 `Spec Ref：<capability> / <Requirement>` 且 `Scenario Ref` 写场景叶子名
- **THEN** 校验器 SHALL 补全为 `capability / Requirement / Scenario` 并匹配到对应场景
- **AND** MUST NOT 产生 `scenario-ref-missing-context` / `ambiguous-scenario-ref` / `invalid-scenario-ref`

#### Scenario: 同一任务多场景各自补全

- **WHEN** 任务在同一 Requirement 下用两行 `Scenario Ref` 引用两个不同场景叶子名
- **THEN** 两行 SHALL 各自用同一 `Spec Ref` 补全并分别匹配到对应场景
- **AND** MUST NOT 合并、丢失或只保留其中一条

#### Scenario: 叶子名缺少上下文报诊断

- **WHEN** 任务只有叶子名 `Scenario Ref` 而没有 `Spec Ref`
- **THEN** 校验 SHALL 报告 `scenario-ref-missing-context`，消息含「缺少上下文」与期望全路径
- **AND** MUST NOT 猜测该场景的归属

#### Scenario: 多条 Spec Ref 叶子名报歧义

- **WHEN** 任务有 ≥2 条 `Spec Ref` 且 `Scenario Ref` 为场景叶子名
- **THEN** 校验 SHALL 报告 `ambiguous-scenario-ref`，消息含「歧义」并要求写全路径
- **AND** MUST NOT 任选其中一条 Spec Ref 完成补全

#### Scenario: 叶子名不得跨 Requirement 匹配

- **WHEN** 任务引用 1 条 Spec Ref，叶子场景名在该 Requirement 下不存在，但全局另一 Requirement 有同名场景
- **THEN** 校验 SHALL 报 `invalid-scenario-ref`（绑定失败）
- **AND** MUST NOT 匹配到另一 Requirement 的同名场景

#### Scenario: 跨 capability 同名场景按 Spec Ref 绑定

- **WHEN** 两个 capability 存在同名场景，任务用 1 条 `Spec Ref` + 叶子名引用
- **THEN** 校验 SHALL 按该 `Spec Ref` 的 capability 绑定
- **AND** MUST NOT 匹配到另一 capability 的同名场景

#### Scenario: 引用值含分隔符视为全路径

- **WHEN** `Scenario Ref` 值本身含 `/` 或 `→`
- **THEN** 校验 SHALL 将其视为全路径 / 链式形态，不做叶子补全
- **AND** MUST NOT 因场景名含分隔符而误判为叶子名

#### Scenario: 历史全路径与裸名引用保持兼容

- **WHEN** 既有 tasks.md 使用 `- Spec Ref：<capability> / <requirement>` 与全路径 `Scenario Ref` 或裸 requirement /
  scenario 名
- **THEN** 校验 SHALL 与引入本契约前一致地匹配成功
- **AND** 历史归档变更的 tasks.md MUST NOT 因新契约产生新的 error

#### Scenario: 混合写法覆盖计数一次

- **WHEN** 同一 Scenario 同时被全路径写法和叶子名写法引用
- **THEN** 覆盖计数 SHALL 只计一次
- **AND** MUST NOT 因多行引用产生重复覆盖或重复诊断

#### Scenario: HTML 注释式与一行双引用等价

- **WHEN** tasks.md 含 `<!-- Spec Ref: demo → Requirement: "R" → Scenario: "S" -->` 或一行同时给出 Spec + Scenario
- **THEN** 解析结果 SHALL 产出等价的 `specRef` 与全路径 `scenarioRef`
- **AND** 追溯校验 SHALL 视其与两行规范写法等价

#### Scenario: 仅 capability 的 Spec Ref 报缺失 Requirement

- **WHEN** 任务的 `Spec Ref` 只写了 capability（如 `- Spec Ref：demo`），且该值匹配某个已存在的 capability
- **THEN** 校验 SHALL 报告 `spec-ref-missing-requirement`，消息含「缺少 Requirement」与期望形态 `capability / Requirement`
- **AND** MUST NOT 只给出泛化的「无法匹配」消息

#### Scenario: Scenario Ref 只到 Requirement 报缺失 Scenario

- **WHEN** `Scenario Ref` 只写到 `capability / Requirement`（缺少 Scenario 段）
- **THEN** 校验 SHALL 报告 `scenario-ref-missing-scenario`，消息含期望形态 `capability / Requirement / Scenario`
- **AND** MUST NOT 尝试补全为任意场景

#### Scenario: 起草期未匹配引用降级 pending-ref

- **WHEN** 运行 `iagent spec validate --change "<name>" --partial`，specs 制品尚未完成而 tasks.md 已引用未来 Requirement
- **THEN** 该未匹配引用 SHALL 以 `severity: "warning"` 的 `pending-ref` 报告，`valid` SHALL 保持 true
- **AND** 同一引用在 specs 完成后运行 strict 校验时 SHALL 为 `error`

#### Scenario: 有效规格引用

- **WHEN** 任务以规范形态引用存在的 capability、Requirement 与 Scenario（全路径或叶子名补全后）
- **THEN** 校验器 SHALL 将该任务与对应规格节点关联，供 verify 和 apply 上下文使用
- **AND** MUST NOT 产生 `invalid-spec-ref` / `invalid-scenario-ref`

#### Scenario: 失效规格引用

- **WHEN** 任务引用的 Requirement 或 Scenario 不存在
- **THEN** 校验器 SHALL 报告失效引用并保留原任务文本，不得自动改写引用
