# Spec Delta

## REMOVED Requirements

### Requirement: iagent spec status 状态校验
**Reason**: 原状态机只按 JSON artifact 或文件存在判定，无法表达 Markdown 结构 invalid。
**Migration**: 状态改由 OpenSpec Markdown parser/validator 驱动，保留依赖图和 CLI JSON 响应。

### Requirement: 内置 spec-driven 依赖图
**Reason**: 原依赖图绑定 change.json/tasks.json 输出路径。
**Migration**: 保留 proposal→specs/design→tasks 关系，但输出路径改为标准 Markdown。

### Requirement: iagent spec instructions 模板分发
**Reason**: 原要求 JSON schema template 为机器源。
**Migration**: 返回 Markdown template 和路径；JSON 只作为 CLI 响应封装。

### Requirement: iagent spec archive 归档移动
**Reason**: 原归档只检查 JSON/文件完成度，未把 Markdown invalid 作为独立状态。
**Migration**: 归档前运行 Markdown 校验并处理历史 JSON-only 变更的显式迁移边界。

### Requirement: iagent spec instructions apply 命令
**Reason**: 原 apply 上下文指向 change.json/tasks.json。
**Migration**: 上下文改为 proposal.md、design.md、specs/**/*.md 和 tasks.md。

### Requirement: iagent spec reindex 重建索引
**Reason**: 原 reindex 以 change.json 为主链路。
**Migration**: reindex 以 Markdown 为主来源，历史 JSON 仅只读降级。

### Requirement: iagent spec render 仅支持 tasks
**Reason**: tasks.md 不再由 tasks.json 渲染。
**Migration**: 直接编辑和校验 tasks.md；旧 render 调用只返回兼容提示，不覆盖任务文件。

## ADDED Requirements

### Requirement: iagent spec status validates Markdown artifacts
`iagent spec status` SHALL 基于 OpenSpec Markdown 文件和确定性解析结果输出 artifact 状态。`proposal` 对应 `proposal.md`，`design` 对应 `design.md`，`specs` 对应 `specs/**/*.md`，`tasks` 对应 `tasks.md`。状态至少支持 `done`、`ready`、`blocked` 和 `invalid`；文件存在但结构校验失败时 MUST 为 `invalid`，并返回带文件路径和行号的诊断。`--json` 仍 SHALL 输出机器可消费的状态摘要。

#### Scenario: Markdown 文件存在且有效
- **WHEN** 变更包含有效的 proposal.md、spec delta、design.md 和 tasks.md
- **THEN** 对应 artifact SHALL 报告为 `done`
- **AND** progress SHALL 从 tasks.md checkbox 统计

#### Scenario: 文件存在但格式无效
- **WHEN** spec 或 tasks Markdown 存在但解析失败
- **THEN** 对应 artifact SHALL 报告为 `invalid`
- **AND** 状态响应 SHALL 包含文件路径、行号和修复建议

#### Scenario: status JSON is not a source artifact
- **WHEN** 用户运行 `iagent spec status --json`
- **THEN** CLI SHALL 从 Markdown 解析后输出 JSON
- **AND** MUST NOT 创建或更新 change.json/tasks.json

### Requirement: Markdown paths drive the built-in dependency graph
内置依赖图 SHALL 保持 proposal → specs/design → tasks 和 apply.requires=[tasks] 的逻辑，但 artifact 输出路径 SHALL 使用 `proposal.md`、`specs/**/*.md`、`design.md` 和 `tasks.md`。`skip_specs` 仍 SHALL 允许无 spec-level 行为的变更跳过 specs，并与现有冲突语义兼容。

#### Scenario: Markdown paths drive dependencies
- **WHEN** proposal.md 已完成而 specs/design 尚未完成
- **THEN** specs 和 design SHALL 为 `ready`，tasks SHALL 为 `blocked`

### Requirement: Markdown task instructions and apply context
`iagent spec instructions tasks` SHALL 返回 `tasks.md` 模板、解析规则和任务标签约束；`instructions apply` SHALL 返回 Markdown 路径、解析后的 taskList 和进度摘要，不得要求 Agent 写 tasks.json。

#### Scenario: Task instructions use Markdown
- **WHEN** 用户请求 tasks instructions
- **THEN** outputPath SHALL 为 `tasks.md`，template SHALL 是 OpenSpec Markdown 模板
- **AND** instruction SHALL 要求直接维护 checkbox、依赖、Spec Ref 和验证信息

#### Scenario: Apply context uses Markdown
- **WHEN** Agent 获取 apply 上下文
- **THEN** contextFiles SHALL 指向 proposal.md、design.md、specs 目录和 tasks.md
- **AND** taskList SHALL 从 tasks.md 解析生成

### Requirement: Archive validates Markdown before moving
`iagent spec archive` SHALL 在移动目录前运行 Markdown 结构校验，并对 invalid artifact 输出警告或阻止归档；delta spec 到主 spec 的语义合并仍由 spec-archive 技能执行。历史 JSON-only 变更 SHALL 要求显式迁移或按只读兼容策略处理。

#### Scenario: Archive valid Markdown change
- **WHEN** 变更的 Markdown artifacts 有效且用户提供 `--yes`
- **THEN** CLI SHALL 按日期移动变更目录

#### Scenario: Archive invalid Markdown change
- **WHEN** 任一 artifact 为 `invalid`
- **THEN** CLI SHALL 在预览和执行结果中报告具体诊断，不得将 invalid 状态静默视为 done
