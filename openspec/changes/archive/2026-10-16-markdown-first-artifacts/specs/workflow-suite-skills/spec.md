# Spec Delta

## REMOVED Requirements

### Requirement: 编排技能 MUST NOT 生成或依赖 proposal/design/specs MD
**Reason**: 新策略要求 OpenSpec Markdown 是新变更的唯一制品真源。
**Migration**: workflow、auto-workflow 和 debug SHALL 直接生成或读取 proposal.md、design.md、specs/**/*.md 和 tasks.md；仅对历史 JSON-only 变更提供只读兼容。

### Requirement: workflow 端到端引导管线（实现与归档委派）
**Reason**: 原管线以 tasks.json 和 JSON artifact 作为阶段数据。
**Migration**: 保留确认桥、委派、编译和归档语义，阶段状态改从 Markdown parser 获取。

### Requirement: auto-workflow 全自动管线
**Reason**: 原全自动管线依赖 JSON artifact 和 tasks.json。
**Migration**: 保留五阶段管线和共享资源协议，规划与任务状态改从 Markdown 获取。

### Requirement: requirement-doc 双执行模式与八章节转换
**Reason**: 原章节来源以 change.json/tasks.json 为主。
**Migration**: 使用 proposal.md、design.md、specs/**/*.md 和 tasks.md；历史 JSON-only 仅只读降级。

### Requirement: debug 关联变更判定与调试循环
**Reason**: 原 Phase 6 将修复同步到 JSON 后再渲染 Markdown。
**Migration**: 保留复现、根因确认和回归测试，直接更新 Markdown 制品。

### Requirement: proposal-review 提案完整性复查
**Reason**: 原复查以 JSON 作为主来源。
**Migration**: 直接读取和更新 Markdown，并通过 parser/validator 取得结构化证据。

## ADDED Requirements

### Requirement: Orchestration skills use Markdown artifacts
`iagent_workflow`、`iagent_auto_workflow`、`iagent_debug`、`iagent_requirement_doc` 和 `iagent_proposal_review` SHALL 将 proposal.md、design.md、specs/**/*.md 和 tasks.md 作为新变更的读写契约。技能 MAY 使用 CLI JSON 摘要和 context-pack，但 MUST NOT 创建或更新 JSON 真源。

#### Scenario: Workflow plans with Markdown
- **WHEN** workflow 生成内联提案
- **THEN** SHALL 直接生成并校验 OpenSpec Markdown 制品
- **AND** Phase 4 SHALL 以 Markdown 任务状态为实现上下文

#### Scenario: Auto workflow uses Markdown artifacts
- **WHEN** auto-workflow 进入 auto-apply
- **THEN** SHALL 从 Markdown 解析任务、需求和设计上下文
- **AND** 完成任务后 SHALL 更新 tasks.md，不创建或更新 tasks.json

#### Scenario: Generate requirement document from Markdown
- **WHEN** workflow 或 archive 非交互生成需求文档
- **THEN** SHALL 从当前 Markdown 制品生成八章节文档
- **AND** MUST NOT 依赖 change.json/tasks.json

#### Scenario: Debug syncs Markdown
- **WHEN** 调试循环完成累计修复
- **THEN** debug SHALL 将根因、修复行为和回归任务写入 Markdown 制品
- **AND** MUST NOT 通过 JSON 更新后渲染 Markdown

#### Scenario: Review finds a missing scenario
- **WHEN** 深度代码探索发现提案遗漏行为
- **THEN** 复查 SHALL 报告缺漏并在用户允许修复时补充对应 Markdown Scenario
- **AND** SHALL 更新关联 tasks.md 任务

### Requirement: Orchestration gates retain existing safety behavior
workflow、auto-workflow、debug 和 proposal-review SHALL 保留现有的提示词校验、流程确认、根因确认、测试委派、编译检查、失败重试和归档确认语义；仅替换制品数据来源为 Markdown parser/model。

#### Scenario: Existing confirmation gates remain active
- **WHEN** 编排技能处理 Markdown-first 变更
- **THEN** 既有确认门和失败处置 SHALL 继续执行
- **AND** 不得因移除 JSON artifact 而静默跳过验证或实现确认
