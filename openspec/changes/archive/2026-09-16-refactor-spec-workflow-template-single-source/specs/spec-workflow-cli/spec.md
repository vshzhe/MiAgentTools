# spec-workflow-cli Delta Spec

> 变更：`refactor-spec-workflow-template-single-source`
> 主能力：`openspec/specs/spec-workflow-cli/spec.md`
> 范围声明：本 delta 仅覆盖 `spec-workflow-cli` 能力的新增需求。多 schema 支持不在本次范围（ADR-0001 保持有效：依赖图硬编码、SHALL NOT 读外部 schema.yaml）。模板单一源重构属于 `spec-workflow-skills` 能力，不在本 delta 内。

## ADDED Requirements

### Requirement: venus spec instructions apply 命令

venus CLI SHALL 提供 `venus spec instructions apply --change <name> --json` 子命令，作为 apply 阶段的上下文获取入口。命令 SHALL 基于内置 spec-driven 依赖图（proposal→specs/design→tasks，`apply.requires=[tasks]`，`apply.tracks=tasks.md`）计算当前状态并返回以下 JSON 结构：

- `changeName`、`changeRoot`：与 `venus spec status` 同源的变更标识与绝对路径
- `contextFiles`：artifact id → 文件系统绝对路径映射；键包含 `proposal`、`specs`、`design`、`tasks`；已创建的 artifact 路径 SHALL 指向实际文件，未创建的 SHALL 为空字符串或省略对应键
- `progress`：`{ total, complete, remaining }`，来源于 `tasks.md` 的 `- [ ]` / `- [x]` 勾选项统计；`tasks.md` 不存在时 SHALL 输出 `{ total: 0, complete: 0, remaining: 0 }`，不报错
- `taskList`：`tasks.md` 的解析结果数组，每项 SHALL 含原始行文本、`checked`（布尔）、可选的层级缩进信息；`tasks.md` 不存在时 SHALL 为空数组
- `instruction`：按当前状态返回的动态指导文本，三态：
  - `blocked`：当 `tasks` artifact 未就绪（`specs`/`design` 未完成或 `tasks.md` 不存在）时，SHALL 返回提示依赖未满足的指导，并列出 `missingDeps`
  - `ready`：当 `tasks` 已就绪且存在未完成勾选项时，SHALL 返回"按 `tasks.md` 逐项实现，规格行为完整实现方可勾选"的指导
  - `all_done`：当 `tasks.md` 全部勾选项为 `[x]` 时，SHALL 返回"准备归档（`venus spec archive`）"的指导

命令行为 SHALL NOT 读取外部 `schema.yaml`（ADR-0001 保持有效），SHALL NOT 读取项目代码或非变更目录内文件，SHALL NOT 触发任何写操作。

#### Scenario: apply 阻塞态 - tasks 依赖未满足

- **WHEN** 运行 `venus spec instructions apply --change "<name>" --json` 且变更的 `specs` 或 `design` artifact 未完成（status != done），`tasks.md` 不存在
- **THEN** 命令以零退出码退出，输出 JSON 的 `instruction` 字段为 `blocked` 指导文本（提示依赖未满足并列出 missingDeps 含 `specs` 与/或 `design`），`progress` 为 `{ total: 0, complete: 0, remaining: 0 }`，`taskList` 为空数组，`contextFiles.tasks` 为空字符串

#### Scenario: apply ready 态 - 依赖满足且任务未完成

- **WHEN** 运行 `venus spec instructions apply --change "<name>" --json` 且 `proposal.md`、`specs/`、`design.md`、`tasks.md` 均存在，`tasks.md` 含 5 个 `- [ ]` 与 3 个 `- [x]` 勾选项
- **THEN** 输出 JSON 的 `instruction` 字段为 `ready` 指导文本，`progress` 为 `{ total: 8, complete: 3, remaining: 5 }`，`taskList` 数组含 8 项（3 项 `checked: true`，5 项 `checked: false`），`contextFiles` 含 `proposal`/`specs`/`design`/`tasks` 四键均指向存在的绝对路径

#### Scenario: apply all_done 态 - 全部任务已完成

- **WHEN** 运行 `venus spec instructions apply --change "<name>" --json` 且 `tasks.md` 全部勾选项为 `- [x]`（无 `- [ ]`）
- **THEN** 输出 JSON 的 `instruction` 字段为 `all_done` 指导文本（提示准备归档），`progress.remaining` 为 `0`，`progress.complete` 等于 `progress.total`，`taskList` 所有项 `checked: true`

#### Scenario: 变更不存在

- **WHEN** 运行 `venus spec instructions apply --change "<不存在>" --json`
- **THEN** 命令以非零退出码失败，stderr 输出明确的变更不存在错误，不输出 JSON 主体

### Requirement: skip_specs 状态语义

变更在 `.openspec.yaml` 中声明 `skip_specs: true`（布尔字段，对齐源项目 OpenSpec v1.1.20 语义）时，venus CLI SHALL 将 `specs` artifact 视为 `skipped` 状态——一种满足态（与 `done` 等价地满足下游依赖），但区别于 `done`（表示"已创建 delta spec"）与 `ready`/`blocked`。`skip_specs` 字段缺省值 SHALL 为 `false`。

具体行为：

- `venus spec status` SHALL 在 `artifacts[]` 中将 `specs` 的 `status` 报告为 `skipped`，其 `requires` 仍为 `[proposal]`，`missingDeps` SHALL 为空数组（视为已满足）
- `venus spec instructions <artifact-id>` 对 `specs` artifact（当声明 `skip_specs: true`）SHALL 返回跳过指导而非创建模板：`template` 字段 SHALL 为空字符串或包含明确的 skip guidance 文本（提示"已声明 skip_specs，无需创建 delta spec 文件"），`outputPath` 字段 SHALL 为空字符串或省略
- `venus spec instructions apply` 的 `contextFiles` 中 `specs` 对应路径 SHALL 标记为 skipped 或省略
- 依赖 `specs` 的下游 artifact（`design`、`tasks`）的 `requires` 边 SHALL 将 `skipped` 视为满足——即 `specs` 为 `skipped` 时，`design` 与 `tasks` 的 `missingDeps` SHALL NOT 含 `specs`

未声明 `skip_specs` 字段或声明为 `false` 的变更，所有命令行为 SHALL 与引入该字段前完全一致（向后兼容，无破坏性）。SHALL NOT 读取外部 `schema.yaml`（ADR-0001 保持有效）。

#### Scenario: status 报告 skipped 态

- **WHEN** 运行 `venus spec status --change "<name>" --json` 且变更的 `.openspec.yaml` 含 `skip_specs: true`，`proposal.md` 存在，`specs/` 目录不存在
- **THEN** 输出 JSON 的 `artifacts[]` 中 `specs` 的 `status` 为 `skipped`，`missingDeps` 为 `[]`；`design` 与 `tasks` 的 `missingDeps` 不含 `specs`（仅在它们自身其他依赖未满足时列出对应依赖）

#### Scenario: instructions 对 skipped specs artifact 返回跳过指导

- **WHEN** 运行 `venus spec instructions specs --change "<name>" --json` 且变更声明 `skip_specs: true`
- **THEN** 输出 JSON 的 `template` 字段为空字符串或包含 skip guidance 文本（明确提示"已声明 skip_specs，无需创建 delta spec 文件"），`outputPath` 字段为空字符串或省略；SHALL NOT 返回创建 `specs/` 下 delta spec 文件的模板正文

#### Scenario: apply 必需集将 skipped 视为满足

- **WHEN** 变更声明 `skip_specs: true`，`proposal.md`、`design.md`、`tasks.md` 存在但 `specs/` 目录不存在，运行 `venus spec instructions apply --change "<name>" --json`
- **THEN** 输出 JSON 的 `instruction` 字段 SHALL NOT 将 `specs` 列为 `missingDep`；apply 阶段状态根据 `tasks` 进度判定为 `ready` 或 `all_done`，SHALL NOT 因 `specs` 缺失而判为 `blocked`；`contextFiles.specs` 标记为 skipped 或省略

#### Scenario: 未声明 skip_specs 向后兼容

- **WHEN** 变更的 `.openspec.yaml` 不含 `skip_specs` 字段或值为 `false`
- **THEN** `venus spec status`/`instructions`/`instructions apply` 的行为与未引入 `skip_specs` 字段前完全一致（`specs` 状态仍按 `done`/`ready`/`blocked` 三态判定，`venus spec instructions specs` 返回正常创建模板）

### Requirement: skip_specs 与已存在 specs 文件的冲突处理

当变更声明 `skip_specs: true` 但 `openspec/changes/<name>/specs/` 目录或其下 delta spec 文件仍存在时（用户手动创建），venus CLI SHALL 对齐源项目 OpenSpec v1.1.20 语义：specs 文件 MUST NOT 与 `skip_specs` 声明共存，CLI SHALL 报告冲突警告并要求用户二选一（删除 `specs/` 下文件或移除 `skip_specs` 声明）。

具体行为：

- `venus spec status` SHALL 在输出中将 `specs` artifact 标记为冲突态（`status: conflict`），并在 `warnings` 字段或 stderr 输出冲突说明；`design` 与 `tasks` 的 `missingDeps` SHALL 将 `specs` 视为未满足（因冲突态不视为满足），直到冲突解决
- `venus spec instructions apply` SHALL 在冲突态下返回 `blocked` 指导，提示先解决 `specs` 文件与 `skip_specs` 声明的冲突，SHALL NOT 进入 `ready`/`all_done` 态
- `venus spec instructions <specs>` SHALL 在冲突态下输出冲突警告，SHALL NOT 返回正常创建模板，SHALL NOT 返回 skip guidance（二者均会绕过冲突）

#### Scenario: status 报告冲突警告

- **WHEN** 运行 `venus spec status --change "<name>" --json` 且变更的 `.openspec.yaml` 含 `skip_specs: true`，同时 `openspec/changes/<name>/specs/` 目录下存在 delta spec 文件
- **THEN** 输出 JSON 的 `artifacts[]` 中 `specs` 的 `status` 为 `conflict`，`warnings` 字段或 stderr 含冲突说明（提示删除 `specs/` 下文件或移除 `skip_specs` 声明二选一）；`design` 与 `tasks` 的 `missingDeps` 含 `specs`（视为未满足）

#### Scenario: instructions apply 在冲突态下返回 blocked 指导

- **WHEN** 运行 `venus spec instructions apply --change "<name>" --json` 且变更处于 `skip_specs` 声明与 `specs/` 文件共存的冲突态
- **THEN** 输出 JSON 的 `instruction` 字段为 `blocked` 指导文本，明确提示先解决 `specs` 文件与 `skip_specs` 声明的冲突；SHALL NOT 返回 `ready` 或 `all_done` 指导
