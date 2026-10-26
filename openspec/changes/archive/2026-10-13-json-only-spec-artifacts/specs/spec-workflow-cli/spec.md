# Spec Delta

## ADDED Requirements

### Requirement: iagent spec render 仅支持 tasks

`iagent spec render` SHALL 仅接受 `tasks` 类型，从 `tasks.json` 确定性渲染 `tasks.md`。系统 MUST NOT 支持 `proposal` / `specs` / `design` 类型；对这些类型命令 MUST 拒绝并退出码非零，MUST NOT 写出任何 MD 文件。

#### Scenario: 渲染 tasks 成功

- **WHEN** 运行 `iagent spec render tasks --change <name>` 且 tasks.json 存在
- **THEN** 从 tasks.json 渲染 tasks.md 并退出码为 0

#### Scenario: 拒绝 proposal/specs/design

- **WHEN** 运行 `iagent spec render proposal`（或 `specs` / `design`）
- **THEN** 命令报错说明仅支持 `tasks` 并退出码非零，MUST NOT 生成对应 MD 文件

#### Scenario: 合法类型清单收窄

- **WHEN** CLI 校验 render 类型
- **THEN** 合法清单 SHALL 仅含 `tasks`；非法类型的报错信息 MUST NOT 再把 `proposal` / `specs` / `design` 列为可选值

## MODIFIED Requirements

### Requirement: iagent spec instructions 模板分发
iagent CLI SHALL 提供 `iagent spec instructions <artifact-id> --change <name> [--json]` 子命令，返回该 artifact 的生成指令与 JSON schema 模板（`jsonTemplate`，机器源）、输出路径（outputPath/resolvedOutputPath）与依赖信息（dependencies/unlocks）。`template`（MD 结构参考）SHALL 仅作为存量 / 降级参考保留，MUST NOT 作为新变更的生成目标。

#### Scenario: 获取 proposal 模板
- **WHEN** 运行 `iagent spec instructions proposal --change "<name>" --json`
- **THEN** 输出 JSON 含 `jsonTemplate`（proposal 段 schema 示例）、`outputPath: change.json`、`resolvedOutputPath`（绝对路径）、`dependencies: []`、`unlocks`（含 design 与 specs）
- **AND** `template` 若存在仅为存量 / 降级参考，命令 MUST NOT 指示生成 proposal.md

#### Scenario: 无效 artifact id
- **WHEN** 运行 `iagent spec instructions <非法id> --change "<name>"`
- **THEN** 命令以非零退出码失败，错误信息列出全部合法 artifact id（proposal/specs/design/tasks）

### Requirement: iagent spec reindex 重建索引
iagent CLI SHALL 提供 `iagent spec reindex [--force] [--json]` 子命令：扫描 `openspec/changes/archive/` 下全部已归档变更目录，**主链路解析各变更的 `change.json`（结构化真源）**，批量导入到 `openspec/changes/archive/.iagent/index.db`。`change.json` 缺失时 SHALL 降级解析旧 JSON sidecar（`.iagent/*.json`），再缺失时降级解析 `proposal.md`（WARN）。`--force` 时 SHALL 删除现有 index.db 后全量重建。index.db 不存在或损坏（无表）时 SHALL 先执行建表 DDL 再导入。

#### Scenario: 存量项目批量重建
- **WHEN** 存量项目执行 `iagent spec reindex --force`
- **THEN** 扫描 archive/ 下全部变更，逐个优先解析 `change.json`（降级旧 sidecar / MD），写入 index.db 全部表

#### Scenario: 部分变更无 JSON sidecar 降级
- **WHEN** archive 下某变更目录无 `change.json`
- **THEN** 降级解析其旧 `.iagent/*.json`；仍无则降级解析 `proposal.md` 提取基本信息，记录 WARN

#### Scenario: archive 目录为空
- **WHEN** `openspec/changes/archive/` 下无任何变更目录
- **THEN** 输出 "无已归档变更可索引"，退出码 0

### Requirement: iagent spec instructions apply 命令
iagent CLI SHALL 提供 `iagent spec instructions apply --change <name> --json` 子命令，作为 apply 阶段的上下文获取入口。命令 SHALL 基于内置 spec-driven 依赖图（proposal→specs/design→tasks，`apply.requires=[tasks]`，`apply.tracks=tasks.json`）计算当前状态并返回以下 JSON 结构：

- `changeName`、`changeRoot`：与 `iagent spec status` 同源的变更标识与绝对路径
- `contextFiles`：artifact id → 文件系统绝对路径映射；键包含 `proposal`、`specs`、`design`、`tasks`；proposal / specs / design SHALL 指向 `change.json`，tasks SHALL 指向 `tasks.json`；未创建的 SHALL 为空字符串或省略对应键
- `progress`：`{ total, complete, remaining }`，来源于 `tasks.json` 的 `status` 字段统计；`tasks.json` 不存在时 SHALL 输出 `{ total: 0, complete: 0, remaining: 0 }`，不报错
- `taskList`：`tasks.json` 的解析结果数组，每项 SHALL 含任务文本与 `checked`（`status === "done"`）；`tasks.json` 不存在时 SHALL 为空数组
- `instruction`：按当前状态返回的动态指导文本，三态：
  - `blocked`：当 `tasks` artifact 未就绪（`specs`/`design` 未完成或 `tasks.json` 不存在）时，SHALL 返回提示依赖未满足的指导，并列出 `missingDeps`
  - `ready`：当 `tasks` 已就绪且存在未完成任务时，SHALL 返回"按 tasks.json 逐项实现，规格行为完整实现方可标记 done"的指导
  - `all_done`：当 `tasks.json` 全部任务 `status === "done"` 时，SHALL 返回"准备归档（`iagent spec archive`）"的指导

命令行为 SHALL NOT 读取外部 `schema.yaml`（ADR-0001 保持有效），SHALL NOT 读取项目代码或非变更目录内文件，SHALL NOT 触发任何写操作。

#### Scenario: apply 阻塞态 - tasks 依赖未满足
- **WHEN** 运行 `iagent spec instructions apply --change "<name>" --json` 且变更的 `specs` 或 `design` artifact 未完成（status != done），`tasks.json` 不存在
- **THEN** 命令以零退出码退出，输出 JSON 的 `instruction` 字段为 `blocked` 指导文本（提示依赖未满足并列出 missingDeps 含 `specs` 与/或 `design`），`progress` 为 `{ total: 0, complete: 0, remaining: 0 }`，`taskList` 为空数组，`contextFiles.tasks` 为空字符串

#### Scenario: apply ready 态 - 依赖满足且任务未完成
- **WHEN** 运行 `iagent spec instructions apply --change "<name>" --json` 且 `change.json` 的 proposal/specs/design 段与 `tasks.json` 均存在，`tasks.json` 含 5 个 `pending` 与 3 个 `done` 任务
- **THEN** 输出 JSON 的 `instruction` 字段为 `ready` 指导文本，`progress` 为 `{ total: 8, complete: 3, remaining: 5 }`，`taskList` 数组含 8 项（3 项 `checked: true`，5 项 `checked: false`），`contextFiles` 含 `proposal`/`specs`/`design` 指向 `change.json`、`tasks` 指向 `tasks.json`

#### Scenario: apply all_done 态 - 全部任务已完成
- **WHEN** 运行 `iagent spec instructions apply --change "<name>" --json` 且 `tasks.json` 全部任务 `status` 为 `done`
- **THEN** 输出 JSON 的 `instruction` 字段为 `all_done` 指导文本（提示准备归档），`progress.remaining` 为 `0`，`progress.complete` 等于 `progress.total`，`taskList` 所有项 `checked: true`

#### Scenario: 变更不存在
- **WHEN** 运行 `iagent spec instructions apply --change "<不存在>" --json`
- **THEN** 命令以非零退出码失败，stderr 输出明确的变更不存在错误，不输出 JSON 主体
