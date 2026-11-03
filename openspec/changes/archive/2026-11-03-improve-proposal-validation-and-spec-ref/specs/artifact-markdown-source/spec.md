## MODIFIED Requirements

### Requirement: Tasks maintain explicit traceability to requirements

任务 SHALL 支持以稳定、可读的 `Spec Ref` 与 `Scenario Ref` 将实现与测试任务关联到能力规格及场景。

**规范形态（canonical）**：

- `Spec Ref`：`<capability> / <Requirement>`
- `Scenario Ref`：`<capability> / <Requirement> / <Scenario>`

解析器 SHALL 同时接受以下等价书写，且 MUST NOT 因书写形态不同而判定引用失效：

- 行式：`- Spec Ref：<值>` / `- Scenario Ref：<值>`（半角 `:` 与全角 `：` 均可，允许 `-` / `*` 前缀与缩进）；
- HTML 注释式：`<!-- Spec Ref: <值> -->`（可带 `→` 分隔与 `Requirement:` / `Scenario:` 标签，如 `<!-- Spec Ref: <capability> → Requirement: "<R>" → Scenario: "<S>" -->`）；
- 同一行同时含 Spec 与 Scenario：解析结果 SHALL 同时产出 `specRef` 与 `scenarioRef` 各一条，但 canonical 仍推荐拆成两行；
- 历史形态：`<capability> / <requirement>` 与裸 requirement / scenario 名（既有 tasks.md 兼容）。

校验器 SHALL 检查引用目标存在，缺失或失效引用 SHALL 被报告，MUST NOT 通过推测自动绑定：

- 引用只到 capability（缺少 Requirement）时 SHALL 报告 `spec-ref-missing-requirement`，消息 MUST 明确写出「缺少 Requirement」并给出期望形态 `capability / Requirement`；
- `Scenario Ref` 只到 Requirement（缺少 Scenario）时 SHALL 报告 `scenario-ref-missing-scenario`，消息 MUST 给出期望形态 `capability / Requirement / Scenario`；
- 引用目标在 specs 中不存在时 SHALL 报 `invalid-spec-ref` / `invalid-scenario-ref`。

部分校验（`--partial`）下，当 specs artifact 尚未完成（缺文件或因结构无效未 done）时，未匹配引用 SHALL 降级为 `pending-ref` 的 `warning`（起草期正常中间态）；specs 已完成时未匹配引用 MUST NOT 降级，仍为 `error`。

#### Scenario: 有效规格引用

- **WHEN** 任务以规范形态引用存在的 capability、Requirement 与 Scenario
- **THEN** 校验器 SHALL 将该任务与对应规格节点关联，供 verify 和 apply 上下文使用
- **AND** MUST NOT 产生 `invalid-spec-ref` / `invalid-scenario-ref`

#### Scenario: 失效规格引用

- **WHEN** 任务引用的 Requirement 或 Scenario 不存在
- **THEN** 校验器 SHALL 报告失效引用并保留原任务文本，不得自动改写引用

#### Scenario: HTML 注释式引用被解析

- **WHEN** tasks.md 含 `<!-- Spec Ref: portal-workorderno-validation → Requirement: "工单号前端格式校验" → Scenario: "空工单号" -->`
- **THEN** 解析结果 SHALL 为 `specRef = portal-workorderno-validation / 工单号前端格式校验` 与 `scenarioRef = portal-workorderno-validation / 工单号前端格式校验 / 空工单号`
- **AND** MUST NOT 因 `<!--` 包裹或引号 / 箭头分隔产生解析失败诊断

#### Scenario: 一行同时包含 Spec Ref 与 Scenario Ref

- **WHEN** 任务的同一行同时含 Spec 与 Scenario 信息（HTML 注释式或 `→` 链式）
- **THEN** 该任务 SHALL 同时获得一条 `specRef` 与一条 `scenarioRef`
- **AND** 追溯校验与 D3 覆盖检查 SHALL 视其与两行写法等价

#### Scenario: 仅 capability 的引用给出缺失 Requirement 诊断

- **WHEN** 任务的 `Spec Ref` 只写了 capability（如 `- Spec Ref：portal-workorderno-validation`），且该值匹配某个已存在的 capability
- **THEN** 校验 SHALL 报告 `spec-ref-missing-requirement`，消息含「缺少 Requirement」与期望形态 `capability / Requirement`
- **AND** MUST NOT 只给出泛化的「无法匹配」消息

#### Scenario: 旧行式与裸名引用保持兼容

- **WHEN** 既有 tasks.md 使用 `- Spec Ref：<capability> / <requirement>` 或裸 requirement / scenario 名
- **THEN** 校验 SHALL 与引入本契约前一致地匹配成功
- **AND** 历史归档变更的 tasks.md MUST NOT 因新契约产生新的 error

#### Scenario: 起草期未匹配引用降级为 pending-ref

- **WHEN** 运行 `iagent spec validate --change "<name>" --partial`，specs 制品尚未完成而 tasks.md 已引用未来 Requirement
- **THEN** 该未匹配引用 SHALL 以 `severity: "warning"` 的 `pending-ref` 报告，`valid` SHALL 保持 true
- **AND** 同一引用在 specs 完成后运行 strict 校验时 SHALL 为 `error`
