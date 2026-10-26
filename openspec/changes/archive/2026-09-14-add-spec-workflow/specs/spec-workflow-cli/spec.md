## ADDED Requirements

### Requirement: venus spec new 创建变更骨架
venus CLI SHALL 提供 `venus spec new "<name>"` 子命令，在 `openspec/changes/<name>/` 下创建变更骨架目录，并写入 `.openspec.yaml` 兼容元数据（`schema: spec-driven`、`created: <ISO 日期>`、可选 `goal`）。

#### Scenario: 正常创建变更
- **WHEN** 运行 `venus spec new "add-auth-login"` 且目标项目存在 openspec/changes/ 目录
- **THEN** 创建 `openspec/changes/add-auth-login/` 目录与 `.openspec.yaml`（含 `schema: spec-driven` 和 `created` 字段），输出创建结果

#### Scenario: 目标项目无 openspec 目录
- **WHEN** 运行 `venus spec new "<name>"` 且目标项目不存在 `openspec/` 目录
- **THEN** 自动创建 `openspec/changes/archive/` 必要骨架后再创建变更目录，不报错

#### Scenario: 变更名已存在
- **WHEN** 运行 `venus spec new "<name>"` 且 `openspec/changes/<name>/` 已存在
- **THEN** 命令以非零退出码失败，输出错误信息，不覆盖已有目录

### Requirement: venus spec status 状态校验
venus CLI SHALL 提供 `venus spec status --change <name> [--json]` 子命令，基于内置 spec-driven 依赖图输出每个 artifact 的状态（`done`/`ready`/`blocked`）、`applyRequires`、tasks 进度统计（total/complete/remaining）。

#### Scenario: JSON 契约完整输出
- **WHEN** 运行 `venus spec status --change "<name>" --json` 且变更存在
- **THEN** 输出 JSON 含 `changeName`、`changeRoot`、`artifacts[]`（每项含 `id`、`status`、`requires`、`missingDeps`）、`applyRequires`、`progress` 字段

#### Scenario: 依赖图驱动状态判定
- **WHEN** 变更目录仅有 proposal.md 而无 specs/design/tasks 文件
- **THEN** proposal 状态为 `done`，specs 与 design 状态为 `ready`（requires=[proposal] 已满足），tasks 状态为 `blocked`（missingDeps 含 specs 与 design）

#### Scenario: tasks 进度统计
- **WHEN** 变更的 tasks.md 含 5 个 `- [ ]` 与 3 个 `- [x]` 勾选项
- **THEN** progress 输出 `total: 8`、`complete: 3`、`remaining: 5`

#### Scenario: tasks.md 无可识别勾选项
- **WHEN** 变更的 tasks.md 存在但不含任何 `- [ ]` 或 `- [x]` 格式条目
- **THEN** progress 输出 `total: 0`、`complete: 0`、`remaining: 0`，不报错（apply 状态按无任务处理）

#### Scenario: 变更不存在
- **WHEN** 运行 `venus spec status --change "<不存在>"` 
- **THEN** 命令以非零退出码失败，输出明确的变更不存在错误

### Requirement: 内置 spec-driven 依赖图
venus CLI SHALL 在源码中硬编码 spec-driven 依赖图：proposal（requires: []）、specs（requires: [proposal]）、design（requires: [proposal]）、tasks（requires: [specs, design]）、apply.requires=[tasks]、apply.tracks=tasks.md，SHALL NOT 读取外部 schema.yaml。

#### Scenario: 依赖图常量定义
- **WHEN** 检查 src/core/spec/ 下的 schema 定义模块
- **THEN** 依赖图以常量形式导出，proposal→specs/design→tasks 关系与 apply 门槛（requires=[tasks]、tracks=tasks.md）可被 status/new/instructions/archive 四个命令共享引用

#### Scenario: 非标准 schema 元数据容错
- **WHEN** 变更的 .openspec.yaml 中 schema 字段值不是 spec-driven
- **THEN** status 输出 WARN 提示并按内置 spec-driven 依赖图继续处理，不中断

### Requirement: venus spec instructions 模板分发
venus CLI SHALL 提供 `venus spec instructions <artifact-id> --change <name> [--json]` 子命令，返回该 artifact 的内置模板内容、输出路径（outputPath/resolvedOutputPath）与依赖信息（dependencies/unlocks）。

#### Scenario: 获取 proposal 模板
- **WHEN** 运行 `venus spec instructions proposal --change "<name>" --json`
- **THEN** 输出 JSON 含 `template`（proposal 模板全文）、`outputPath: proposal.md`、`resolvedOutputPath`（绝对路径）、`dependencies: []`、`unlocks`（含 design 与 specs）

#### Scenario: 无效 artifact id
- **WHEN** 运行 `venus spec instructions <非法id> --change "<name>"`
- **THEN** 命令以非零退出码失败，错误信息列出全部合法 artifact id（proposal/specs/design/tasks）

### Requirement: venus spec archive 归档移动
venus CLI SHALL 提供 `venus spec archive <name> --yes` 子命令：校验变更存在、检查 artifact 完成度（未完成时输出警告）、将变更目录移动至 `openspec/changes/archive/YYYY-MM-DD-<name>/`（名称已含日期前缀则不叠加）。delta spec → 主 spec 的合并 SHALL 由 spec-archive 技能（AI）执行，CLI SHALL NOT 实现合并逻辑。

#### Scenario: 完成变更归档
- **WHEN** 运行 `venus spec archive "<name>" --yes` 且变更全部 artifact 完成
- **THEN** 变更目录移动至 `openspec/changes/archive/<今日日期>-<name>/`（目录不存在时先创建），输出归档结果

#### Scenario: 未完成变更归档警告
- **WHEN** 运行 `venus spec archive "<name>" --yes` 且 tasks 存在未勾选项
- **THEN** 输出未完成任务警告（含剩余数量）后执行移动（--yes 视为显式确认）

#### Scenario: 缺少 --yes 确认
- **WHEN** 运行 `venus spec archive "<name>"`（无 --yes）
- **THEN** 命令预览将归档的内容与警告后以非零退出码退出，不执行移动
