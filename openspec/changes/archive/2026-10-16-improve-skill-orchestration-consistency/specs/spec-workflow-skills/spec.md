## ADDED Requirements

### Requirement: spec-explore 制品捕获目标 SHALL 为 Markdown

`iagent_spec_explore` 在 "Offer to capture when decisions are made" 一节的捕获映射 SHALL 指向 OpenSpec Markdown 制品（`proposal.md` / `design.md` / `specs/<capability>/spec.md` / `tasks.md`）。MUST NOT 指向历史 JSON 制品（`change.json` / `tasks.json`）作为新变更的写目标。

#### Scenario: 捕获映射为 Markdown

- **WHEN** 检查 `iagent_spec_explore` 主 SKILL.md 的捕获表
- **THEN** "Design decision made" 目标 SHALL 为 `design.md`
- **AND** "Scope changed" 目标 SHALL 为 `proposal.md`
- **AND** MUST NOT 出现 `change.json 的 design/proposal 段`

#### Scenario: 结尾摘要不引用 JSON

- **WHEN** 检查 `iagent_spec_explore` 的 Ending Discovery 小结示例
- **THEN** 制品更新示例 SHALL 为 Markdown 制品
- **AND** MUST NOT 出现 `Updated change.json 的 design 段`

### Requirement: spec-verify-proposal SHALL 为提案验证维度的唯一真源

`iagent_spec_verify_proposal` SHALL 定义并唯一维护提案验证维度契约（D1-D5 核心维度 + D6-D10 条件维度，统一 90% 阈值）。其它技能引用提案验证时 MUST 引用该契约，MUST NOT 另立维度数（如 `D1-D6` / `D1-D9`）。

#### Scenario: 维度定义集中于 verify-proposal

- **WHEN** 检查提案验证维度的定义位置
- **THEN** D1-D5 核心维度与 D6-D10 条件维度 SHALL 在 `iagent_spec_verify_proposal` 中有唯一定义
- **AND** 该技能主文件 SHALL 明确 D6-D10 见 `references/conditional-dimensions.md`

#### Scenario: 消费方只引用不重定义

- **WHEN** `iagent_workflow` / `iagent_auto_workflow` / `iagent_debug` / `iagent_spec_propose` 引用提案验证
- **THEN** 其表述 SHALL 与唯一契约一致（引用 `spec_verify_proposal` 技能）
- **AND** MUST NOT 出现不一致的维度子集表述
