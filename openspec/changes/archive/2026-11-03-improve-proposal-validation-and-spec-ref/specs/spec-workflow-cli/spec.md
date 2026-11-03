## ADDED Requirements

### Requirement: iagent spec validate 支持部分校验与单制品校验

`iagent spec validate` SHALL 支持两种校验模式与单制品定位：

- **默认（strict）**：apply-ready / 归档前的全量终检语义 —— `proposal.md`、`specs/**/*.md`、`tasks.md` 缺失 SHALL 记为 `error`（`missing-proposal` / `missing-specs` / `missing-tasks`）；`design.md` SHALL 按可选制品处理，仅当文件存在时校验，缺失 MUST NOT 产生 `missing-design`。
- **`--partial`**：起草期模式 —— 缺失制品 SHALL 以 `incomplete` 严重度记录（`missing-proposal` / `missing-specs` / `missing-tasks` 的 `severity` 改为 `incomplete`），MUST NOT 记为 `error`，MUST NOT 使 `valid` 变为 false，命令退出码 SHALL 为 0；已存在但结构无效的制品 SHALL 仍记为 `error` 并使 `valid` 为 false。
- **`--artifact <id>`**：只校验指定制品（`proposal` / `specs` / `design` / `tasks`）—— 未指定制品的缺失 MUST NOT 产生任何缺失诊断；未知 id SHALL 以非零退出码失败并列出合法 id。跨制品追溯（Spec Ref / Scenario Ref 匹配）SHALL 仅在 `tasks` 与 `specs` 同时可用时执行，否则 SHALL 记录一条 `incomplete` 严重度的 `traceability-skipped` 诊断说明原因。

`skip_specs` 豁免 SHALL 与 `design` 的可选语义一致：当变更 `.openspec.yaml` 声明 `skip_specs: true` 且 `specs/` 下无 delta spec 文件时，strict 模式 MUST NOT 产生 `missing-specs` 的 `error`（该制品视为已声明跳过），MUST NOT 因此使 `valid` 为 false 或退出码非零；`skip_specs: true` 与 `specs/` 下存在文件共存的冲突态 SHALL 仍按既有 skip_specs 冲突语义报告。

`--partial` 与 `--artifact` SHALL 可组合使用。

JSON 输出 SHALL 含 `mode`（`strict` / `partial`）与 `artifactId`（未指定时为 `null`）；`diagnostics[].severity` SHALL 支持 `error` / `warning` / `incomplete` 三值，且 `incomplete` MUST NOT 参与 `valid` 判定（`valid` 仅由 `error` 决定）。

#### Scenario: strict 模式保留终检语义

- **WHEN** 运行 `iagent spec validate --change "<name>"`（不带 `--partial`），变更含有效 proposal.md 与 specs，但缺少 tasks.md 与 design.md
- **THEN** 输出 SHALL 含 `missing-tasks` 的 `error` 诊断，`valid` SHALL 为 false，退出码非零
- **AND** MUST NOT 输出 `missing-design` 诊断

#### Scenario: --partial 将缺失制品记为 incomplete

- **WHEN** 运行 `iagent spec validate --change "<name>" --partial --json`，变更只含有效 proposal.md
- **THEN** 输出 SHALL 为 specs 与 tasks 各含一条 `severity: "incomplete"` 的诊断，`diagnostics` 中 MUST NOT 出现 `severity: "error"`，`valid` SHALL 为 true，退出码 SHALL 为 0
- **AND** 输出 SHALL 含 `"mode": "partial"`

#### Scenario: --partial 仍报告已存在制品的结构错误

- **WHEN** 运行 `iagent spec validate --change "<name>" --partial`，且 tasks.md 存在但任务依赖了不存在的任务编号
- **THEN** 该结构问题 SHALL 以 `severity: "error"` 报告，`valid` SHALL 为 false，退出码非零
- **AND** 缺失的其他制品仍 SHALL 记为 `incomplete`

#### Scenario: --artifact 只校验指定制品

- **WHEN** 运行 `iagent spec validate --change "<name>" --artifact specs --partial --json`，变更只含 specs 目录
- **THEN** 输出 SHALL 只报告 specs 相关诊断，MUST NOT 报告 `missing-proposal` 或 `missing-tasks`
- **AND** `artifactId` SHALL 为 `"specs"`；因 tasks 缺失而产生的追溯校验 SHALL 以 `incomplete` 的 `traceability-skipped` 记录

#### Scenario: 文本报告按行输出诊断

- **WHEN** 运行 `iagent spec validate --change "<name>"`（非 `--json`）且存在两条以上诊断
- **THEN** 每条诊断 SHALL 独占一行（行间为真实换行符），MUST NOT 出现字面量 `\n` 字符序列

#### Scenario: skip_specs 变更不产生 missing-specs 错误

- **WHEN** 变更声明 `skip_specs: true` 且 `specs/` 下无 delta spec 文件，其余制品（proposal / tasks）有效
- **THEN** strict `iagent spec validate --change "<name>"` MUST NOT 输出 `missing-specs` 的 `error` 诊断，`valid` SHALL 为 true，退出码 SHALL 为 0
- **AND** `skip_specs: true` 与 `specs/` 下文件共存的冲突态 SHALL 仍被报告（沿用既有 skip_specs 冲突语义）

### Requirement: 内置任务模板提供 Spec Ref / Scenario Ref 示例

`iagent spec instructions tasks` 分发的 `TASKS_TEMPLATE` SHALL 含可复制的追溯示例，并声明规范形态：

- `Spec Ref`：`<capability> / <Requirement>`
- `Scenario Ref`：`<capability> / <Requirement> / <Scenario>`

模板 MUST 至少给出**两行规范形态**示例（一行 `- Spec Ref：...`、一行 `- Scenario Ref：...`）；MAY 附带 HTML 注释式示例（`<!-- Spec Ref: <capability> → Requirement: "<R>" → Scenario: "<S>" -->`）；MUST 声明「只写 capability 不是有效 Spec Ref，必须包含 Requirement」。

模板的示例 MUST 能被当前解析器解析且不产生 `invalid-spec-ref` / `invalid-scenario-ref`（示例值本身可指向占位能力名，但形态必须合规）。

#### Scenario: tasks 模板含规范两行示例

- **WHEN** 运行 `iagent spec instructions tasks --change "<name>" --json`
- **THEN** 返回的 `template` SHALL 含形如 `- Spec Ref：<capability> / <Requirement>` 与 `- Scenario Ref：<capability> / <Requirement> / <Scenario>` 的示例行
- **AND** SHALL 以注释或说明文字声明这两个规范形态

#### Scenario: 模板声明 capability-only 引用无效

- **WHEN** 审阅 `iagent spec instructions tasks` 返回的 `template` 全文
- **THEN** 模板 SHALL 明确说明仅写 capability 不构成有效 Spec Ref，必须补 Requirement 名称

## MODIFIED Requirements

### Requirement: iagent spec status validates Markdown artifacts

`iagent spec status` SHALL 基于 OpenSpec Markdown 文件和确定性解析结果输出 artifact 状态。`proposal` 对应 `proposal.md`，`design` 对应 `design.md`，`specs` 对应 `specs/**/*.md`，`tasks` 对应 `tasks.md`。状态至少支持 `done`、`ready`、`blocked` 和 `invalid`；文件存在但结构校验失败时 MUST 为 `invalid`，并返回带文件路径和行号的诊断。此外：

- 可选制品（`design`）缺失时 SHALL 报告 `optional`（可生成但不阻塞下游）—— MUST NOT 报告为 `ready`，以免消费方把可选制品当作必需项反复生成，也 MUST NOT 报告为 `blocked`。
- `skip_specs` 相关状态 `skipped` / `conflict` 语义保持不变。
- `--json` SHALL 输出机器可消费的状态摘要，并 MUST 含以下路径字段（均为绝对路径）：
  - `planningHome`：规划根目录（`<projectRoot>/openspec`）；
  - `artifactPaths`：以 artifact id 为键的映射，每项含 `outputPath`（相对变更目录的声明路径）、`resolvedOutputPath`（绝对路径，`specs` 为绝对目录）与 `existingOutputPaths`（当前已存在的绝对文件路径数组，缺失时为空数组）。
- 消费方 SHALL 直接使用上述字段，MUST NOT 通过拼接或猜测推导制品路径。

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

#### Scenario: 可选 design 缺失时报告 optional
- **WHEN** 变更含有效 proposal.md 与 specs，但不含 design.md
- **THEN** `artifacts[]` 中 `design` 的 `status` SHALL 为 `optional`
- **AND** `tasks` MUST NOT 因 `design` 缺失而 `blocked`

#### Scenario: status JSON 含路径字段
- **WHEN** 运行 `iagent spec status --change "<name>" --json`
- **THEN** 输出 SHALL 含 `planningHome` 与 `artifactPaths`
- **AND** `artifactPaths.specs.existingOutputPaths` SHALL 列出 `specs/` 下已存在的 spec 文件绝对路径，`artifactPaths.tasks.resolvedOutputPath` SHALL 为 `<changeRoot>/tasks.md` 的绝对路径

### Requirement: Markdown paths drive the built-in dependency graph

内置依赖图 SHALL 保持 proposal → specs/design → tasks 和 apply.requires=[tasks] 的逻辑，但 artifact 输出路径 SHALL 使用 `proposal.md`、`specs/**/*.md`、`design.md` 和 `tasks.md`。`tasks.requires` SHALL 声明为 `['specs', 'design?']`——`?` 后缀表示**可选依赖**：可选依赖缺失时 MUST NOT 出现在 `missingDeps` 中、MUST NOT 使 `tasks` 变为 `blocked`；存在时 SHALL 参与该制品的结构校验。

- 依赖判定的单一源 SHALL 是 schema 的可选依赖标记：`getBuildOrder`、`getChangeStatus`、`instructions` 的 `dependencies` / `unlocks`、`instructions apply` 与 `previewArchive` MUST 共用同一 helper 解析 `id` 与 `id?`，MUST NOT 各自实现前缀判断。
- `getBuildOrder` SHALL 只按必需依赖做拓扑排序，构建序仍为 `proposal → specs → design → tasks`（可选依赖 MUST NOT 造成阻塞或环）。
- `isPlanningComplete` SHALL 定义为 `applyRequires` 的必需依赖传递闭包全部完成（`skip_specs` 下 `specs` 视为满足）—— MUST NOT 要求可选制品 `design` 完成。
- `skip_specs` 仍 SHALL 允许无 spec-level 行为的变更跳过 specs，并与现有冲突语义兼容。

#### Scenario: Markdown paths drive dependencies

- **WHEN** proposal.md 已完成而 specs 尚未完成、design.md 不存在
- **THEN** specs SHALL 为 `ready`，design SHALL 为 `optional`，tasks SHALL 为 `blocked`
- **AND** tasks 的 `missingDeps` SHALL 只含 `specs`，MUST NOT 含 `design`

#### Scenario: design 可选不阻塞 tasks

- **WHEN** proposal.md 与 specs 均有效，变更不创建 design.md
- **THEN** tasks SHALL 为 `ready`
- **AND** `iagent spec instructions apply --json` 的 `instruction.state` MUST NOT 因 design 缺失而为 `blocked`

#### Scenario: isPlanningComplete 不要求 design

- **WHEN** proposal.md、specs 与 tasks 全部有效，design.md 缺失
- **THEN** `iagent spec status --json` 的 `isPlanningComplete` SHALL 为 true

### Requirement: Markdown task instructions and apply context

`iagent spec instructions tasks` SHALL 返回 `tasks.md` 模板、解析规则和任务标签约束；`instructions apply` SHALL 返回 Markdown 路径、解析后的 taskList 和进度摘要，不得要求 Agent 写 tasks.json。

`instructions apply --json` SHALL 另行返回起草期状态语义（内部复用 `getChangeStatus` + `adjustStatusForSkipSpecs`，MUST NOT 另行实现一套状态判定）：

- `artifacts[]`：每个 artifact 的 `id` / `outputPath` / `status`（`done` / `ready` / `blocked` / `invalid` / `optional` / `skipped` / `conflict`）/ `requires` / `missingDeps?` / `diagnostics?`；
- `applyRequires[]` 与 `isPlanningComplete`；
- `planningHome` 与 `artifactPaths`（形状与 `status --json` 一致）。

两处命令返回的 `artifacts` / `applyRequires` / `skip_specs` 语义 MUST 一致；技能 MUST 能用 `instructions apply --json` 替代独立 `status --json` 作为起草期状态来源。

`instructions <artifact-id> --json` 的 `resolvedOutputPath` SHALL 指向**可直接写入的目标**：`specs` SHALL 为 `<changeRoot>/specs` 目录（MUST NOT 含 `**/*.md` 一类 glob 片段），其余制品 SHALL 为单文件绝对路径；该字段与 `status --json` 的 `artifactPaths.<id>.resolvedOutputPath` SHALL 语义一致，技能据此写入时 MUST NOT 再做 glob 展开或路径猜测。

#### Scenario: Task instructions use Markdown
- **WHEN** 用户请求 tasks instructions
- **THEN** outputPath SHALL 为 `tasks.md`，template SHALL 是 OpenSpec Markdown 模板
- **AND** instruction SHALL 要求直接维护 checkbox、依赖、Spec Ref 和验证信息

#### Scenario: Apply context uses Markdown
- **WHEN** Agent 获取 apply 上下文
- **THEN** contextFiles SHALL 指向 proposal.md、design.md、specs 目录和 tasks.md
- **AND** taskList SHALL 从 tasks.md 解析生成

#### Scenario: apply JSON 返回 artifacts 与 applyRequires

- **WHEN** 运行 `iagent spec instructions apply --change "<name>" --json`
- **THEN** 输出 SHALL 含 `artifacts`（数组，每项含 `id` / `status` / `requires`）、`applyRequires`、`planningHome` 与 `artifactPaths`
- **AND** `artifacts` 中每一项的 `status` SHALL 与同一变更的 `iagent spec status --json` 结果一致

#### Scenario: apply 与 status 的 skip_specs 语义一致

- **WHEN** 变更声明 `skip_specs: true` 且 `specs/` 下无文件
- **THEN** `instructions apply --json` 的 `artifacts` 中 `specs` 的 `status` SHALL 为 `skipped`
- **AND** 该结果 SHALL 与 `iagent spec status --json` 的 `artifacts[specs].status` 相同

#### Scenario: instructions 的 resolvedOutputPath 可直接写入

- **WHEN** 运行 `iagent spec instructions specs --change "<name>" --json`
- **THEN** `resolvedOutputPath` SHALL 为 `<changeRoot>/specs` 目录绝对路径，MUST NOT 含 `**/*.md` glob 片段
- **AND** 对 `proposal` / `design` / `tasks` 运行同一命令时，`resolvedOutputPath` SHALL 为对应单文件绝对路径
- **AND** 同一制品的 `status --json` 的 `artifactPaths.<id>.resolvedOutputPath` SHALL 与之语义一致
