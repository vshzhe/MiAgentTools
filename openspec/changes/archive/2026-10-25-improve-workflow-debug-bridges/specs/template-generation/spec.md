## MODIFIED Requirements

### Requirement: 需求文档生成时机

`iagent_workflow`、`iagent_auto_workflow` 与 `iagent_debug` SHALL 在提案验证 PASS 且深度复查收束后，由父编排器提供一次需求文档"生成 / 跳过"业务桥；**用户确认生成后**才以非交互模式委派 `iagent_requirement_doc` 生成到 `openspec/changes/<change-name>/需求文档.md`，用户选择跳过则持久记录 `skipped-by-user`。`iagent_spec_propose` 独立调用 MUST NOT 在本阶段自动生成需求文档（非目标，见「需求文档技能自动调用方扩展」）；`iagent_spec_verify_proposal` SHALL 保持只读验证职责，不生成、询问或委派需求文档。

#### Scenario: 全自动工作流验证通过后经桥决定

- **WHEN** `iagent_auto_workflow` Phase 3 验证通过（≥90%）且深度复查收束
- **THEN** 父编排器呈现一次文档桥（属用户业务选择，不是"是否调用技能"的二次确认）；选择生成 → 非交互委派 `iagent_requirement_doc` 并记录 `generated`，选择跳过 → 记录 `skipped-by-user`；两种结果均继续其既定 auto-mode（进入 Phase 4）

#### Scenario: 引导式工作流验证通过后经桥决定

- **WHEN** `iagent_workflow` Phase 3 验证通过且深度复查收束
- **THEN** 父编排器呈现一次文档桥；生成 → 非交互委派并记录 `generated`（失败记 `generation-failed`），跳过 → 记录 `skipped-by-user`；两种情况均进入 Phase 3.7 实现桥

#### Scenario: spec-propose 独立调用不生成需求文档

- **WHEN** 用户独立执行 `/iagent:spec-propose` 且验证 PASS
- **THEN** 技能 SHALL 停止并输出规划边界结论，MUST NOT 生成需求文档、MUST NOT 呈现生成/跳过桥；用户 MAY 之后手工调用 `iagent_requirement_doc`

#### Scenario: 验证失败不生成

- **WHEN** 提案验证分数低于 90% 或仍处于失败修复循环
- **THEN** MUST NOT 生成需求文档、MUST NOT 呈现文档桥，继续既有修复与重验流程

### Requirement: 归档阶段需求文档行为

归档阶段（`iagent_spec_archive` step 4.8 / `iagent_spec_bulk_archive` a.6）SHALL 以"**文件存在优先、状态裁决缺失分支**"分流：状态取值 `skipped-by-user` / `generation-failed` / `generated`，无显式状态为 `absent`，定义见 `host-orchestration / 需求文档状态跨阶段 handoff`。

#### Scenario: 归档时需求文档已存在则增量对齐

- **WHEN** 归档预检查点（step 4.8 / a.6）检测到 `openspec/changes/<change-name>/需求文档.md` 已存在
- **THEN** 系统 SHALL 执行就地增量对齐——从当前制品（proposal/design/tasks/specs）重新派生章节 一~七
- **AND** SHALL 保留人工域 `## 基本信息` 和 `## 八、评审记录` 逐字不变
- **AND** MUST NOT 调用 `iagent_requirement_doc` skill（避免覆盖人工内容）；该分支不区分状态

#### Scenario: 文档缺失时按状态分流

- **WHEN** 归档预检查点检测到需求文档缺失
- **THEN** `skipped-by-user` → 报告跳过且不生成；`generation-failed` → 输出 WARN 且不重试；`generated` → 输出 WARN（"曾生成但文件缺失"）且不重新生成；`absent` → 非交互委派 `iagent_requirement_doc`（历史兼容，失败 WARN 继续）
- **AND** 四支均 MUST NOT 阻断归档

#### Scenario: 状态读取失败不落入兼容生成

- **WHEN** 预检查点读取需求文档状态首次失败且自动重试一次仍失败
- **THEN** MUST NOT 将状态等同 `absent`、MUST NOT 生成需求文档；文档已存在时仍按已存在分支对齐，缺失时输出含原因的 WARN 与恢复指引并继续归档

### Requirement: 需求文档技能自动调用方扩展

`iagent_requirement_doc` 技能的 Caller note SHALL 声明自动调用方为：三父流程（`iagent_workflow` Phase 3 / `iagent_auto_workflow` Phase 3 / `iagent_debug` Phase 7 `verify-close`）文档桥的"生成"分支，以及归档对 `absent` 缺失文档的兼容生成分支（`iagent_spec_archive` 4.8 / `iagent_spec_bulk_archive` a.6）。`iagent_spec_propose` 独立调用与 `iagent_spec_verify_proposal` MUST NOT 自动调用；debug 的调用 MUST 经用户桥确认。

#### Scenario: 非交互模式调用方识别

- **WHEN** `iagent_requirement_doc` 以非交互模式被调用
- **THEN** 技能 SHALL 接受来自三父流程生成分支或归档 `absent` 分支的调用；行为不变（不询问用户、使用占位符基本信息）；独立手动调用（Standalone 模式）行为不受影响

#### Scenario: spec-propose 不再是自动调用方

- **WHEN** 检查 `iagent_spec_propose` 的正文与 `allowedTools`
- **THEN** 正文 MUST NOT 含自动生成需求文档的动作，`allowedTools` MUST NOT 含 `Skill(requirement_doc)` 条目

### Requirement: 模板正文一致性

所有引用需求文档生成时机的模板正文 SHALL 与新时机一致：三父流程为"文档桥 + 生成分支"，归档为"文件存在优先 + 状态分流"，`iagent_spec_propose` 独立调用不生成。MUST NOT 残留"验证通过后默认自动生成"或"debug 不生成需求文档"一类旧口径。

#### Scenario: debug 归档引用同步

- **WHEN** 检查 `iagent_debug` Phase 7 的文档段
- **THEN** 文本 SHALL 表述"经用户桥确认后生成 / 跳过"，MUST NOT 含"debug MUST NOT 调用 `iagent_requirement_doc`"一类禁令

#### Scenario: migration 引用同步

- **WHEN** `iagent_migration` 引用归档阶段的需求文档行为
- **THEN** 引用文本 SHALL 反映"文件存在优先 + 状态分流"的新口径
- **AND** 若有类似"归档时一律生成"的独立逻辑 SHALL 同步调整

#### Scenario: spec-propose 引用同步

- **WHEN** 检查 `iagent_spec_propose` 的 Phase 3 与 Output 段
- **THEN** MUST NOT 出现生成需求文档的动作或产物行，SHALL 以"验证通过后停止"收束
