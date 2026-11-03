## Why

提案生成链路的**正常中间态被当成错误**，导致生成循环提前收敛、模型被迫先补 design 才能写 tasks：

- `tasks.requires` 把 `design` 当硬依赖（`src/core/spec/schema.ts:75`），但同一份 schema 的 `design.description` 写着「跨切面变更时创建」（`schema.ts:64-69`）——纯配置/文档变更永远无法 apply-ready；`validate` 还额外报 `missing-design`（`src/commands/spec.ts:419-421`）。
- 每次写入后只跑全量 `validate`，`missing-tasks` / `missing-design` 一律 `error`（`spec.ts:416-424`），起草期无法区分「还没写」与「写错了」。
- `Spec Ref` 有三种互不一致的形态：用户示例是 HTML 注释式，模板 `TASKS_TEMPLATE` 完全没有示例（`src/core/spec/templates/index.ts:76-92`），解析器 `readField` 只认 `- 字段：` 行式且不识别 `<!--`（`src/core/spec/parser/task-parser.ts:189-196`）；引用只写 capability 时抛出泛化的「无法匹配」（`src/core/spec/validation/traceability.ts:28-45`），模型无法定位缺失项。
- 起草循环用 `status --json` 获取状态并**每写一个制品重复调用一次**（`src/core/templates/workflows/spec-propose.ts:160-167`、`:193`），而 `instructions` 已能给出依赖完成度；重复调用不增加信息量。
- 7 个技能模板要求模型读取 `planningHome` / `artifactPaths`（其中 6 个还要求读取 `actionContext`：`spec-propose.ts:167`、`spec-explore.ts:1031`、`spec-verify.ts:46`、`spec-archive.ts:45,48,224`、`spec-bulk-archive.ts:69,72,289`、`spec-apply.ts:309,313`），但 `ChangeStatusResult`（`src/core/spec/status.ts:33-42`）与 `ApplyInstructionsResult`（`src/commands/spec.ts:78-91`）**从未返回**这些字段——模型只能猜路径。
- `formatValidationResult` 用 `lines.join('\\n')`（字面反斜杠 + n，`src/commands/spec.ts:436`），文本报告把所有诊断挤在一行。

## What Changes

- **`iagent spec validate` 增加起草期模式**：`--partial` 把缺失制品记为 `incomplete`（不记 error、`valid` 仍为 true），`--artifact <id>` 只校验单个制品；默认 strict 保留 apply-ready / 归档前终检语义（proposal / specs / tasks 缺失仍为 error，design 按可选规则处理）。
- **`design` 从硬依赖改为可选依赖**：`tasks.requires` 变为 `['specs', 'design?']`；`status` 对缺失的可选制品报告新状态 `optional`；`isPlanningComplete` 改为 `applyRequires` 必需闭包全部完成（design 不参与）；`validate` 仅在 `design.md` 存在时校验。
- **Spec Ref / Scenario Ref 契约**：规范形态 `capability / Requirement` 与 `capability / Requirement / Scenario`；解析器兼容行式与 `<!-- 字段: ... -->` HTML 注释式、`→` 与 `Requirement:` / `Scenario:` 标签；支持一行同时含 Spec + Scenario（canonical 仍推荐两行）；补齐 `TASKS_TEMPLATE` 示例；`spec-propose` 与 `spec-verify-proposal` 的 D3 覆盖检查同步；仅 capability 时给出「缺少 Requirement」明确诊断。
- **起草循环改用 `instructions apply`，去除独立 `status --json`**：`iagent spec instructions apply --json` 扩展返回 `artifacts`（含 status / requires）与 `applyRequires`（内部复用 `getChangeStatus` + `adjustStatusForSkipSpecs`）；`spec-propose` 改为「`instructions apply` 初检 → 每制品 `instructions` → `instructions apply` 终检」，起草期放开 `specs` / `design` / `tasks` 并行，最终 strict `validate` 兜底。
- **补齐路径字段契约**：`status --json` 与 `instructions apply --json` 增加 `planningHome` / `artifactPaths`（含 `existingOutputPaths`）；`actionContext` 经查证无规划范围语义，从 7 个模板删除引用（含其 workspace 护栏句），MUST NOT 让模型猜路径。
- **修正文本报告换行**：`formatValidationResult` 的 `lines.join('\\n')` 改为真实换行符，诊断逐行输出。

## Capabilities

### New Capabilities

- 无（本变更全部为既有能力的契约修正与扩展）

### Modified Capabilities

- `spec-workflow-cli`: `validate` 新增 `--partial` / `--artifact` 与 `incomplete` 严重度；`design` 可选依赖与 `optional` 状态；`isPlanningComplete` 改为必需闭包语义；`instructions apply --json` 新增 `artifacts` / `applyRequires` / `planningHome` / `artifactPaths`；`TASKS_TEMPLATE` 补 Spec Ref / Scenario Ref 示例。
- `artifact-markdown-source`: `Spec Ref` / `Scenario Ref` 的规范形态、可接受书写形态（行式 / HTML 注释式 / 箭头标签式 / 一行双引用 / 历史裸名）、缺失 Requirement 与缺失 Scenario 的专用诊断，以及起草期 `pending-ref` 降级。
- `spec-workflow-skills`: `spec-propose` 起草循环改为 `instructions apply` 初检 + 并行起草 + `--partial` 校验 + strict 终检，禁止独立 `status --json`、禁止猜路径；`Spec-to-task traceability` 与 `spec-verify-proposal` 的 D3 覆盖检查使用同一规范形态。

## Impact

### 直接影响的文件

- `src/commands/spec.ts`: `runSpecValidate`（`:386`）新增 `partial` / `artifact` 选项与 `missing-specs` 诊断；`formatValidationResult`（`:428-437`）修正换行；`ApplyInstructionsResult`（`:78-91`）与 `getApplyInstructions`（`:621-687`）扩展 JSON 契约；`adjustStatusForSkipSpecs`（`:492-554`）改用必需依赖 helper；`validate` 子命令注册（`:169-179`）新增选项。
- `src/core/spec/schema.ts`: `SPEC_DRIVEN_SCHEMA`（`:44-84`）的 `tasks.requires` 改为 `['specs', 'design?']`；新增可选依赖解析 / 必需闭包 helper；`getBuildOrder`（`:87-106`）与 `unlocks` 计算改用 helper。
- `src/core/spec/status.ts`: `ChangeStatusResult`（`:33-42`）增加 `planningHome` / `artifactPaths`；`ArtifactStatus` 增加 `optional` 状态；`getChangeStatus`（`:101-166`）的 `missingDeps` 只用必需依赖、`isPlanningComplete` 改为必需闭包。
- `src/core/spec/instructions.ts`: `ArtifactDependency` 增加 `optional` 标记；`getArtifactInstructions`（`:63-105`）的 `dependencies` / `unlocks` 改用 helper。
- `src/core/spec/parser/task-parser.ts`: `parseTaskFields`（`:152-187`）与 `readField`（`:189-196`）支持 HTML 注释式 / 箭头标签式 / 一行双引用；`parseTaskBlock`（`:119`）传递新诊断。
- `src/core/spec/validation/traceability.ts`: `buildTraceability`（`:17-75`）新增 `spec-ref-missing-requirement` / `scenario-ref-missing-scenario` / `pending-ref` 诊断；`findRequirement` / `findScenario` / `normalizeRef` 按规范形态归一。
- `src/core/spec/validation/artifact-validator.ts`: `validateParsedChange`（`:15-35`）接受校验模式上下文（partial / 单制品）。
- `src/core/spec/model/artifact-model.ts`: `DiagnosticSeverity`（`:7`）扩展 `incomplete`。
- `src/core/spec/templates/index.ts`: `TASKS_TEMPLATE`（`:76-92`）补 `Spec Ref` / `Scenario Ref` 规范示例。
- `src/core/spec/archive.ts`: `previewArchive`（`:38-55`）的未完成制品清单排除可选制品。
- `src/core/templates/workflows/spec-propose.ts`: Step 3 / 4 / `:160-195` 起草循环改写，Step 4 并行与 `--partial`，Step 5.5 前终检；`:167` 路径字段与 `actionContext` 清理。
- `src/core/templates/workflows/spec-verify-proposal.ts`: D3 维度（`:313-327`）与 `:549` 路径说明同步规范引用形态。
- `src/core/templates/workflows/{spec-explore,spec-verify,spec-archive,spec-bulk-archive,spec-apply}.ts`: 删除 `actionContext` 引用与 workspace 护栏句，改用 `planningHome` / `artifactPaths` / `changeRoot`。
- `src/core/project-config.ts`: 默认 spec 域规则行（`:405`）由「按依赖序生成」改为「允许并行起草 + 终检按依赖序」。

### 调用方（CodeGraph 实测）

- `runSpecValidate`（`src/commands/spec.ts:386`）：CLI 注册点 `:174` 与 `test/markdown-spec-cli.test.ts:78`；模板消费方为 `spec-propose`（起草期）、`debug`（同步提案校验）、`spec-archive`（归档前校验）。
- `SPEC_DRIVEN_SCHEMA`（`src/core/spec/schema.ts:44`）：9 处消费点，集中在 `status.ts`（`:53`/`:115`/`:147`/`:161`/`:163`）、`instructions.ts`（`:76`/`:82`/`:90`）、`archive.ts`（`:45`）、`spec.ts`（`:537`）。
- `buildTraceability`（`src/core/spec/validation/traceability.ts:17`）：2 个调用方 —— `artifact-validator.ts:26` 与 `traceability.ts` 自身导出。
- `parseTasks` / `parseTaskFields`（`src/core/spec/parser/task-parser.ts:13` / `:152`）：9 处调用，含 `status.ts`（`:95`/`:198`）、`migration.ts`、`src/commands/spec.ts`。
- `getChangeStatus`（`src/core/spec/status.ts:101`）：3 个调用方（`spec.ts:344`/`:362`/新增 apply 初检），测试 `test/spec-status.test.ts`。
- `getApplyInstructions`（`src/commands/spec.ts:621`）：测试 `test/markdown-spec-cli.test.ts`、`test/spec-instructions-apply.test.ts`。
- `TASKS_TEMPLATE`（`src/core/spec/templates/index.ts:76`）：1 个调用方（`instructions.ts` 的 `TEMPLATES` 映射）。
- `previewArchive`（`src/core/spec/archive.ts:38`）：`src/commands/spec.ts:228` 归档预览。

### 向后兼容

- **不破坏既有制品**：`design.md` 继续被接受并在存在时校验；`Spec Ref` / `Scenario Ref` 的历史行式写法与裸 requirement / scenario 名保持可解析；historic `change.json` / `tasks.json` 只读兼容路径不变。
- **不改变 apply 门槛**：`apply.requires` 仍为 `['tasks']`，`isPlanningComplete` 仍要求 `specs`（除非 `skip_specs`）——只是不再要求 `design`。
- **JSON 新增字段为追加语义**：`planningHome` / `artifactPaths` / `artifacts` / `applyRequires`（apply 输出）均为新增字段，既有消费方读取旧字段不受影响；`diagnostics[].severity` 新增 `incomplete` 取值，仅 `--partial` 模式产生。
- **strict 行为收紧一处**：strict 下缺失 `specs` 由「静默通过」变为 `missing-specs` error，与既有 `missing-tasks` / `missing-proposal` 一致；由于 `apply.requires` 已是 `tasks`，该收紧不改变任何 apply-ready 判定结果。
- **无破坏性变更**（不需要 **BREAKING** 标注）。
