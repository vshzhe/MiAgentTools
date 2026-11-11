## ADDED Requirements

### Requirement: Gate whitelist covers skill-internal blocking gates

`GATE_WHITELIST` SHALL 是全部阻塞确认门的单一来源，锚点集合 MUST 同时覆盖阶段门与技能内动作。`design-confirmation` SHALL 作为 `requirement-clarification` 类别的锚点，且 `PHASE_GATE_CATEGORY` 对其的映射 SHALL 可解析。

对齐审计 SHALL 扩展为三方校验：模板正文中的 `⛔ GATE: <id>`、`GATE_SKIP_IDS` 的全部取值、`WORKFLOW_PROTOCOLS` 的全部 `PhaseSpec.gate.id`，三者 MUST 均为白名单锚点（动作级 `destructive-change` 除外，只认类别 id）。

#### Scenario: 设计确认门被白名单收录

- **WHEN** 查询 `isWhitelistedGate('design-confirmation')`
- **THEN** 结果 SHALL 为 `true`
- **AND** `requirement-clarification` 类别的锚点集合 SHALL 含 `design-confirmation`

#### Scenario: 未知门被对齐审计拦截

- **WHEN** 某协议阶段声明了不在白名单锚点内的门 id
- **THEN** `auditGateWhitelistAlignment()` SHALL 返回违规描述
- **AND** 违规描述 SHALL 指明工作流 id、阶段 id 与门 id

#### Scenario: 账本门 id 与白名单一致

- **WHEN** `GATE_SKIP_IDS` 含某门 id
- **THEN** 该 id SHALL 出现在 `GATE_WHITELIST` 的某个 `anchors` 内

### Requirement: Archive confirmation is layered by invocation context

归档确认门 SHALL 按调用上下文分层：父工作流（`workflow`）的 `archive-confirmation` MUST 保持阻塞；独立技能 `spec-archive` / `spec-bulk-archive` SHALL 被显式豁免该门（用户直接调用即视为意图），MUST NOT 在独立技能正文中无条件声明该门「不可豁免」。

#### Scenario: 父工作流归档仍阻塞

- **WHEN** `workflow` Phase 5 进入归档
- **THEN** `archive-confirmation` SHALL 为阻塞门
- **AND** 未经用户确认 MUST NOT 推进归档

#### Scenario: 独立归档不新增停点

- **WHEN** 用户直接调用 `/iagent:spec-archive` 或 `/iagent:spec-bulk-archive`
- **THEN** 该技能 MUST NOT 要求额外的归档确认门
- **AND** 技能正文 MUST NOT 声明 `archive-confirmation` 对其无条件不可豁免

#### Scenario: 白名单渲染反映豁免

- **WHEN** 为独立归档技能渲染门策略块
- **THEN** 该块 SHALL 标注「独立调用不承载 archive-confirmation」
- **AND** MUST NOT 使用「必留门，缺一即流程安全缺陷」的绝对表述

### Requirement: Delegation rendering follows execution policy

`renderDelegate` SHALL 按委派目标的执行策略渲染：仅当目标策略为 `subagent` 时输出 `Agent` / `Task` 子代理指令；内联目标 SHALL 输出 Skill/内联调用指令。委派执行策略 SHALL 有单一来源，MUST NOT 由各宿主分支各自推断。

#### Scenario: 内联目标不渲染子代理

- **WHEN** 为 Claude 渲染 `spec-apply` → `iagent-test` 的委派
- **THEN** 生成文本 MUST NOT 含「经前台 Agent 子代理执行」
- **AND** SHALL 表达为 Skill/内联调用

#### Scenario: 子代理目标保留派发

- **WHEN** 为 Claude 渲染 `migration` 的超阈降级派发或 `spec-bulk-archive` 的并行单元
- **THEN** 生成文本 SHALL 含 `Agent` / `Task` 子代理指令
- **AND** 对应技能 `allowedTools` SHALL 含 `Agent, Task`
