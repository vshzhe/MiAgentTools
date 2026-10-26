# artifact-json-sidecar Specification

## Purpose

变更制品 JSON 加速层：从 Markdown artifact（proposal.md / design.md / specs / tasks.md）自动提取结构化元数据，写入 `.venus/` 子目录下的 JSON sidecar 文件（manifest.json / tasks.json / decisions.json / capabilities.json），供下游 SKILL 精确消费，替代散文解析。

## Requirements

### Requirement: manifest.json 变更元信息提取
spec-propose SHALL 在生成 proposal.md 后同步生成 `.venus/manifest.json`，含 `changeName`、`capabilities` 列表、`impactAreas`、`phase` 字段。manifest.json 缺失时下游 MUST 降级为解析 proposal.md 全文，不得阻断。

#### Scenario: propose 阶段自动生成 manifest.json
- **WHEN** spec-propose 完成 proposal.md 的写入
- **THEN** 同步生成 `openspec/changes/<name>/.venus/manifest.json`，字段从 proposal.md 的 Capabilities / Impact 章节提取

#### Scenario: manifest.json 缺失降级
- **WHEN** spec-status 读取变更状态时 manifest.json 不存在
- **THEN** 回退到从 proposal.md 解析变更信息，记录 WARN "manifest.json 缺失，已降级解析 proposal.md"

### Requirement: tasks.json 结构化任务追踪
spec-propose SHALL 在生成 tasks.md 后同步生成 `.venus/tasks.json`，含 `tasks[]` 数组（每项含 `id`、`label`、`description`、`status`、`dependencies`、`nodeRef`、`specRef`、`files`、`batchGroup`）与 `progress` 统计。spec-apply SHALL 完成每个任务后更新对应 task 的 `status` 为 `done` 并重算 `progress`。

#### Scenario: propose 阶段生成 tasks.json
- **WHEN** spec-propose 完成 tasks.md 的写入
- **THEN** 同步生成 `openspec/changes/<name>/.venus/tasks.json`，全部 task status 为 `pending`

#### Scenario: apply 阶段更新 task 状态
- **WHEN** spec-apply 完成任务 1.1（创建 ExportService）
- **THEN** 更新 tasks.json 中 id=1.1 的 status 为 `done`，progress.complete++，progress.remaining--

#### Scenario: tasks.json 缺失降级
- **WHEN** spec-apply 读取 tasks.json 不存在
- **THEN** 回退到解析 tasks.md 的 checkbox（`- [ ]` / `- [x]`），记录 WARN

### Requirement: decisions.json 结构化决策提取
spec-propose SHALL 在生成 design.md 后同步生成 `.venus/decisions.json`，含 `decisions[]` 数组（每项含 `id`、`title`、`choice`、`alternatives`、`rationale`、`risks`、`relatedFiles`）。tr-docs-requirement-doc SHALL 优先从 decisions.json 渲染决策表。

#### Scenario: propose 阶段生成 decisions.json
- **WHEN** spec-propose 完成 design.md 的写入
- **THEN** 从 design.md 的 Decisions 章节提取决策点，生成 `openspec/changes/<name>/.venus/decisions.json`

#### Scenario: 需求文档结构化渲染决策表
- **WHEN** tr-docs-requirement-doc 生成需求文档的「关键技术决策」章节
- **THEN** 优先读取 decisions.json 直接渲染表格，不需要 AI 从 design.md 散文推理决策点

### Requirement: capabilities.json 能力映射
spec-propose SHALL 在生成 specs/*.md 后同步生成 `.venus/capabilities.json`，含 `capabilities[]` 数组（每项含 `name`、`operations[]`，每个 operation 含 `type`（ADDED/MODIFIED/REMOVED/RENAMED）、`requirement`、`scenarios[]`）。

#### Scenario: propose 阶段生成 capabilities.json
- **WHEN** spec-propose 完成所有 specs/*.md 的写入
- **THEN** 聚合所有 delta spec 的能力操作，生成 `openspec/changes/<name>/.venus/capabilities.json`

#### Scenario: verify 阶段结构化对比
- **WHEN** spec-verify 执行需求覆盖检查
- **THEN** 读取 capabilities.json 获取需求→场景映射，替代从 specs/*.md 正则提取 `### Requirement:` 和 `#### Scenario:`

### Requirement: JSON Sidecar 仅从 MD 派生
JSON sidecar SHALL 为 Markdown 的只读加速层——MD 是唯一真源。JSON 与 MD 不一致时 SHALL 以 MD 为准。JSON 缺失时不阻断流程（降级解析 MD）。不存在 JSON→MD 的反向同步路径。

#### Scenario: MD 与 JSON 不一致以 MD 为准
- **WHEN** tasks.md 中某任务标记 `[x]` 但 tasks.json 中对应的 status 为 `pending`
- **THEN** 以 tasks.md 的 `[x]` 为准，同步修正 tasks.json（自动修复不一致）

#### Scenario: 无 JSON→MD 反向同步
- **WHEN** 用户或 SKILL 修改了 tasks.json 的 task 状态
- **THEN** 系统 MUST NOT 自动更新 tasks.md 的 checkbox——需显式更新 tasks.md 后才同步 JSON