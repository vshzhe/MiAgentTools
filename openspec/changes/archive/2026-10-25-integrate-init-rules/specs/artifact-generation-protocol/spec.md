# artifact-generation-protocol 增量规格

## MODIFIED Requirements

### Requirement: Shared Markdown artifact generation protocol

项目 SHALL 在 `openspec/rules/artifact-generation.md` 提供供 `iagent_spec_propose`、`iagent_workflow` 和 `iagent_auto_workflow` 共用的 Markdown-first 生成协议。协议 SHALL 按 proposal → specs/design → tasks 的依赖顺序创建 Markdown 文件，写入后运行确定性校验，并在每个 artifact 后重新读取最新文件。协议 MUST 明确 context/rules 是 AI 约束，不得复制进制品。

**真源与投影的关系**：`openspec/rules/artifact-generation.md`（源仓文件）仍是本协议的**唯一真源**；其要点经 `iagent init` 蒸馏进目标项目的 `.iagent/rules/spec.md`（项目侧规则文件）。生成模板在**目标项目**运行时的协议引用 SHALL 指向项目侧 `.iagent/rules/spec.md`，MUST NOT 假设目标项目存在 `openspec/rules/` 目录；项目侧文件缺失时 SHALL 降级为内联协议要点并记 WARN，MUST NOT 阻断制品生成。

#### Scenario: Generate artifacts in dependency order

- **WHEN** workflow 或 spec-propose 进入制品生成阶段
- **THEN** SHALL 创建 `proposal.md`，再创建对应 specs/design Markdown，最后创建 `tasks.md`
- **AND** 每个文件写入后 SHALL 运行结构校验并重新读取文件

#### Scenario: Generation protocol is shared

- **WHEN** workflow、auto-workflow 和 spec-propose 生成制品
- **THEN** 三条路径 SHALL 引用同一份协议（源仓 `openspec/rules/artifact-generation.md` 为真源，目标项目侧投影为 `.iagent/rules/spec.md`）
- **AND** MUST NOT 分别维护冲突的生成步骤或 JSON 真源规则

#### Scenario: 目标项目缺项目侧协议文件时降级

- **WHEN** 目标项目无 `.iagent/rules/spec.md`
- **THEN** 生成路径 SHALL 使用内联协议要点并记 WARN，制品生成 MUST NOT 被阻断

#### Scenario: Validation failure is actionable

- **WHEN** Markdown artifact 校验失败
- **THEN** 协议 SHALL 要求根据文件路径、行号和错误内容修复源 Markdown 后重试
- **AND** MUST NOT 自动生成另一份 JSON 或静默跳过错误
