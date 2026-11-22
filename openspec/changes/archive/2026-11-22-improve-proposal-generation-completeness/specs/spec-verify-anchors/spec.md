## ADDED Requirements

### Requirement: 验证锚点单一常量源

系统 SHALL 在 `src/core/spec/validation/anchors.ts` 提供验证锚点的唯一常量源，覆盖影响面三制品锚点与任务节点标注。生成侧（`src/core/spec/templates/index.ts` 的模板）与验证侧（`iagent_spec_verify_proposal` 正文及其影响面检查）MUST 共同引用该常量源；MUST NOT 在任一侧另写锚点字符串字面量。

锚点集合（缺失其一即不满足本需求）：

| 锚点 | 承载制品 | 常量语义 |
| :--- | :--- | :--- |
| `### Impact Analysis` | `proposal.md` 的 `## Impact` 之下 | 影响面分析小节 |
| `### 架构影响` | `design.md` 的 `## Context` 之下 | 架构影响小节 |
| `### Caller Updates` | `tasks.md` 的任务分组 | 调用方更新承接小节 |
| `[N<id>]` | 任务行尾 | 功能流程图节点标注 |

#### Scenario: 生成模板产出全部锚点

- **WHEN** `iagent spec instructions <artifact-id>` 返回模板
- **THEN** `PROPOSAL_TEMPLATE` SHALL 含 `### Impact Analysis`，`DESIGN_TEMPLATE` 的 `## Context` SHALL 含 `### 架构影响`，`TASKS_TEMPLATE` SHALL 含 `### Caller Updates` 分组与 `[N<id>]` 标注示例
- **AND** 模板中的锚点文本 SHALL 由 `anchors.ts` 插值，MUST NOT 为模板内联字面量

#### Scenario: 验证侧复用同一常量

- **WHEN** `spec-verify-proposal` 执行影响面三制品存在性判定
- **THEN** 判定所依据的标题锚点 SHALL 来自 `anchors.ts`
- **AND** MUST NOT 在技能正文中硬编码与 `anchors.ts` 重复的锚点字符串

#### Scenario: 锚点常量与解析器一致

- **WHEN** `parseProposal` / `parseDesign` / `parseTasks` 解析上述锚点
- **THEN** 解析结果（`sections` 索引 / `ParsedTask.nodeRef`）SHALL 与 `anchors.ts` 的锚点定义一致
- **AND** 两侧不一致 SHALL 由测试拦截（单一源测试）

### Requirement: 任务节点标注的 Markdown 真源

`parseTasks` SHALL 解析任务行中出现的全部 `[N<id>]` 标注并写入 `ParsedTask.nodeRefs: string[]`；`ParsedTask.nodeRef`（单值）SHALL 保留为 `nodeRefs[0]`，用于与遗留 JSON sidecar 的 `nodeRef` 字段同名兼容。Markdown SHALL 为新真源，遗留 JSON 保持只读兼容。标注缺失 MUST NOT 产生诊断（节点标注为可选，仅在变更含功能流程图时由 tasks 生成侧强制）；同一任务标注多个节点时 SHALL 全部解析（一个任务可承载多个流程节点）。

#### Scenario: 解析节点标注

- **WHEN** `tasks.md` 含 `- [ ] [代码] 2.3 实现分批查询 [N4]`
- **THEN** `parseTasks` 返回的对应任务 SHALL 含 `nodeRefs: ['N4']` 与 `nodeRef: 'N4'`
- **AND** 任务描述 MUST NOT 残留 `[N4]` 文本

#### Scenario: 无标注任务不报错

- **WHEN** 任务行不含 `[N<id>]` 标注
- **THEN** `ParsedTask.nodeRefs` SHALL 为空数组或 `undefined`，且 `diagnostics` MUST NOT 新增条目

#### Scenario: 单任务多节点标注

- **WHEN** 任务行含 `[N3][N8]` 两个标注
- **THEN** `ParsedTask.nodeRefs` SHALL 为 `['N3', 'N8']`（保持出现顺序）
- **AND** 两个标注均 MUST 从任务描述中剥离
