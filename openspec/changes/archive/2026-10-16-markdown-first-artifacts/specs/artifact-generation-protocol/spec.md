# Spec Delta

## REMOVED Requirements

### Requirement: 共享制品生成协议文件
**Reason**: 现有协议要求写入 JSON 并渲染 Markdown，与 OpenSpec 标准及新的 Markdown 真源策略冲突。
**Migration**: 将 G1-G3 改为直接创建、读取和校验 OpenSpec Markdown；保留同一协议文件作为 workflow 与 spec-propose 的唯一共享流程来源。

## ADDED Requirements

### Requirement: Shared Markdown artifact generation protocol
项目 SHALL 在 `openspec/rules/artifact-generation.md` 提供供 `iagent_spec_propose`、`iagent_workflow` 和 `iagent_auto_workflow` 共用的 Markdown-first 生成协议。协议 SHALL 按 proposal → specs/design → tasks 的依赖顺序创建 Markdown 文件，写入后运行确定性校验，并在每个 artifact 后重新读取最新文件。协议 MUST 明确 context/rules 是 AI 约束，不得复制进制品。

#### Scenario: Generate artifacts in dependency order
- **WHEN** workflow 或 spec-propose 进入制品生成阶段
- **THEN** SHALL 创建 `proposal.md`，再创建对应 specs/design Markdown，最后创建 `tasks.md`
- **AND** 每个文件写入后 SHALL 运行结构校验并重新读取文件

#### Scenario: Generation protocol is shared
- **WHEN** workflow、auto-workflow 和 spec-propose 生成制品
- **THEN** 三条路径 SHALL 引用同一份 `artifact-generation.md`
- **AND** MUST NOT 分别维护冲突的生成步骤或 JSON 真源规则

#### Scenario: Validation failure is actionable
- **WHEN** Markdown artifact 校验失败
- **THEN** 协议 SHALL 要求根据文件路径、行号和错误内容修复源 Markdown 后重试
- **AND** MUST NOT 自动生成另一份 JSON 或静默跳过错误

### Requirement: Generation protocol supports structured CLI summaries
共享协议 MAY 使用 `iagent spec status --json` 和 `iagent spec instructions --json` 获取状态、路径和模板摘要，但这些 JSON SHALL 仅作为运行时交换数据。协议 MUST 指示 Agent 直接读取和编辑 Markdown 制品。

#### Scenario: Read status summary
- **WHEN** Agent 获取当前 artifact 状态
- **THEN** CLI JSON 响应 SHALL 提供状态、路径、依赖和诊断摘要
- **AND** Agent SHALL 从对应 Markdown 文件读取语义内容

#### Scenario: No JSON artifact is generated
- **WHEN** 协议完成一轮制品生成
- **THEN** 变更目录 SHALL 只包含 OpenSpec Markdown 制品及元数据
- **AND** 不得创建 `change.json` 或 `tasks.json` 作为新真源
