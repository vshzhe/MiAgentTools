## MODIFIED Requirements

### Requirement: Shared Markdown artifact generation protocol

项目 SHALL 在 `.iagent/rules/spec.md`（目标项目侧投影）与源仓协议文件提供供 `iagent_spec_propose`、`iagent_workflow` 和 `iagent_auto_workflow` 共用的 Markdown-first 生成协议。协议 SHALL 按 proposal → specs/design → tasks 的依赖顺序创建 Markdown 文件，写入后运行确定性校验，并在每个 artifact 后重新读取最新文件。协议 MUST 明确 context/rules 是 AI 约束，不得复制进制品。

**锚点产出（新增）**：协议 SHALL 要求生成的制品包含验证侧消费的全部锚点（`### Impact Analysis` / `## Context` 下 `### 架构影响` / `### Caller Updates` / 任务 `[N<id>]` 标注），锚点定义 MUST 来自单一源（见 `spec-verify-anchors` 能力）。

**终检顺序（新增，MUST NOT 重排）**：`validate --partial`（逐制品）→ `validate --ready`（就绪门）→ strict `validate` → handoff 包产出。

**真源与投影的关系**：协议要点经 `iagent init` 蒸馏进目标项目的 `.iagent/rules/spec.md`。生成模板在**目标项目**运行时的协议引用 SHALL 指向项目侧 `.iagent/rules/spec.md`，MUST NOT 假设目标项目存在 `openspec/rules/` 目录；项目侧文件缺失时 SHALL 降级为内联协议要点并记 WARN，MUST NOT 阻断制品生成。

#### Scenario: Generate artifacts in dependency order

- **WHEN** workflow 或 spec-propose 进入制品生成阶段
- **THEN** SHALL 创建 `proposal.md`，再创建对应 specs/design Markdown，最后创建 `tasks.md`
- **AND** 每个文件写入后 SHALL 运行结构校验并重新读取文件

#### Scenario: 制品包含验证锚点

- **WHEN** 生成 `proposal.md` / `design.md` / `tasks.md`
- **THEN** 三者 SHALL 分别包含 `### Impact Analysis` / `### 架构影响` / `### Caller Updates` 与任务 `[N<id>]` 标注
- **AND** 锚点文本 SHALL 与 `anchors.ts` 常量一致

#### Scenario: 终检按固定顺序执行

- **WHEN** 全部 `applyRequires` 制品定稿
- **THEN** 执行顺序 SHALL 为 partial 校验 → 就绪门 → strict 终检 → handoff 包
- **AND** 就绪门 FAIL 时 MUST NOT 产出 handoff 包，MUST NOT 向后阶段传递 applyReady

#### Scenario: Generation protocol is shared

- **WHEN** workflow、auto-workflow 和 spec-propose 生成制品
- **THEN** 三条路径 SHALL 引用同一份协议
- **AND** MUST NOT 分别维护冲突的生成步骤或 JSON 真源规则

#### Scenario: 目标项目缺项目侧协议文件时降级

- **WHEN** 目标项目无 `.iagent/rules/spec.md`
- **THEN** 生成路径 SHALL 使用内联协议要点并记 WARN，制品生成 MUST NOT 被阻断

#### Scenario: Validation failure is actionable

- **WHEN** Markdown artifact 校验失败
- **THEN** 协议 SHALL 要求根据文件路径、行号和错误内容修复源 Markdown 后重试
- **AND** MUST NOT 自动生成另一份 JSON 或静默跳过错误
