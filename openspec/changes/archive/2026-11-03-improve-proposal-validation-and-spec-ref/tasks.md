# Tasks: improve-proposal-validation-and-spec-ref

<!-- 任务类型标签（并列四类）：
     [代码] 实现代码 / [测试] 测试代码 / [DB脚本] 数据库脚本 / [使用说明] 补充文档（默认产出至 attachments/）
     [测试] 子标注：层级 [单元]/[功能] + 优先级 [P0]/[P1]/[P2]，形如 `- [ ] [测试][单元][P0] 1.2 <任务描述>`
     补充文档类（非 [代码]/[测试]）MUST 含 `产出:` 字段指定输出路径 -->

> 流程基准：`exploration.md` 的「功能流程图 → A. 提案生成与 Spec Ref 追溯」已确认（`status: confirmed`，节点 N1–N13 + N37/N38）。
> 每个任务标注对应节点 id；MUST NOT 静默新增节点。B（N14–N26）与 C（N27–N36）链路不在本变更范围。

## 1. 校验器：部分校验与单制品校验

- [x] 1.1 [代码] 为 `runSpecValidate` 增加 `partial` / `artifact` 选项并在 `validate` 子命令注册 `--partial` / `--artifact <id>` [N9] [N10]
  - 文件：`src/commands/spec.ts`
  - 验证：`node bin/iagent.js spec validate --help` 列出两个新选项；未知 id 退出码非零并列出合法 id

- [x] 1.2 [代码] 扩展 `DiagnosticSeverity` 为 `error | warning | incomplete`，`validateParsedChange` 透传严重度且 `incomplete` 不参与 `valid` 判定 [N10]
  - 文件：`src/core/spec/model/artifact-model.ts`、`src/core/spec/validation/artifact-validator.ts`
  - 验证：`--partial` 下缺失诊断 `severity: "incomplete"` 且 `valid: true`

- [x] 1.3 [代码] 新增 `missing-specs` 与 `traceability-skipped` 诊断；`design` 仅在文件存在时校验；`--artifact` 只解析目标制品；`missing-specs` 沿用既有 `readSkipSpecs(changeRoot)` 豁免（`skip_specs: true` 且 `specs/` 无文件时 MUST NOT 报 error） [N6] [N7] [N9] [N10]
  - 文件：`src/commands/spec.ts`
  - 验证：strict 缺 specs 报 `missing-specs` error；`--artifact specs` 不报 `missing-tasks`；`skip_specs: true` 且无 `specs/` 的变更 `valid: true`、退出码 0
  - Spec Ref：spec-workflow-cli / iagent spec validate 支持部分校验与单制品校验
  - Scenario Ref：spec-workflow-cli / iagent spec validate 支持部分校验与单制品校验 / skip_specs 变更不产生 missing-specs 错误

- [x] 1.4 [代码] 修正 `formatValidationResult` 的字面 `\n`（`lines.join('\\n')` → `lines.join('\n')`） [N9]
  - 文件：`src/commands/spec.ts`
  - 验证：多诊断文本输出逐行，`grep -c '\\n' 输出` 为 0
  - Spec Ref：spec-workflow-cli / iagent spec validate 支持部分校验与单制品校验
  - Scenario Ref：spec-workflow-cli / iagent spec validate 支持部分校验与单制品校验 / 文本报告按行输出诊断

- [x] 1.5 [测试][单元][P0] 校验模式单测：strict 终检、`--partial` 记 `incomplete`、结构错误仍 error、`--artifact` 单制品 [N9] [N10]
  - 文件：`test/markdown-spec-cli.test.ts`
  - 验证：`pnpm test -- markdown-spec-cli`
  - Spec Ref：spec-workflow-cli / iagent spec validate 支持部分校验与单制品校验
  - Scenario Ref：spec-workflow-cli / iagent spec validate 支持部分校验与单制品校验 / strict 模式保留终检语义
  - Scenario Ref：spec-workflow-cli / iagent spec validate 支持部分校验与单制品校验 / --partial 将缺失制品记为 incomplete
  - Scenario Ref：spec-workflow-cli / iagent spec validate 支持部分校验与单制品校验 / --partial 仍报告已存在制品的结构错误
  - Scenario Ref：spec-workflow-cli / iagent spec validate 支持部分校验与单制品校验 / --artifact 只校验指定制品
  - Scenario Ref：spec-workflow-cli / iagent spec validate 支持部分校验与单制品校验 / skip_specs 变更不产生 missing-specs 错误

- [x] 1.6 [测试][功能][P1] CLI 端到端：`bin/iagent.js spec validate --partial` 退出码 0、strict 退出码非零 [N9]
  - 文件：`test/spec-commands.test.ts`
  - 验证：子进程断言 exitCode
  - Spec Ref：spec-workflow-cli / iagent spec validate 支持部分校验与单制品校验
  - Scenario Ref：spec-workflow-cli / iagent spec validate 支持部分校验与单制品校验 / --partial 将缺失制品记为 incomplete
  - Scenario Ref：spec-workflow-cli / iagent spec validate 支持部分校验与单制品校验 / strict 模式保留终检语义

## 2. design 可选与依赖图

- [x] 2.1 [代码] `schema.ts` 增加可选依赖解析 helper（`depIdOf` / `isOptionalDep` / `requiredDeps` / `optionalDeps` / `requiredClosure`），`tasks.requires` 改为 `['specs', 'design?']`，`getBuildOrder` 改用必需依赖 [N4] [N7]
  - 文件：`src/core/spec/schema.ts`
  - 验证：`getBuildOrder()` 仍为 `['proposal','specs','design','tasks']`；`requiredClosure(['tasks'])` 不含 `design`

- [x] 2.2 [代码] `status.ts` 增加 `optional` 状态：缺失的可选制品报 `optional`；`missingDeps` 只算必需依赖；`isPlanningComplete` 改为 `requiredClosure(applyRequires)` 全部完成 [N2] [N7]
  - 文件：`src/core/spec/status.ts`
  - 验证：无 design 时 design=`optional`、tasks=`ready`、`isPlanningComplete=true`

- [x] 2.3 [代码] `instructions.ts` 的 `dependencies` 增加 `optional` 标记、`unlocks` 改用 helper 解析 `design?`；`resolvedOutputPath` 归一化（`specs` 为 `<changeRoot>/specs` 目录，其余为单文件绝对路径，MUST NOT 输出 `**/*.md` glob 片段） [N4]
  - 文件：`src/core/spec/instructions.ts`
  - 验证：`instructions tasks` 的 dependencies 中 design 项 `optional: true`；`instructions specs` 的 `resolvedOutputPath` 不含 `**/*.md`
  - Spec Ref：spec-workflow-cli / Markdown task instructions and apply context
  - Scenario Ref：spec-workflow-cli / Markdown task instructions and apply context / instructions 的 resolvedOutputPath 可直接写入

- [x] 2.4 [测试][单元][P0] 依赖图与状态测试，同步更新 `test/spec-status.test.ts:101-126` 的既有断言（design 由 `ready` 改 `optional`、tasks `missingDeps` 只含 specs） [N4] [N7]
  - 文件：`test/spec-status.test.ts`
  - 验证：`pnpm test -- spec-status`
  - Spec Ref：spec-workflow-cli / Markdown paths drive the built-in dependency graph
  - Scenario Ref：spec-workflow-cli / Markdown paths drive the built-in dependency graph / Markdown paths drive dependencies
  - Scenario Ref：spec-workflow-cli / Markdown paths drive the built-in dependency graph / design 可选不阻塞 tasks
  - Scenario Ref：spec-workflow-cli / Markdown paths drive the built-in dependency graph / isPlanningComplete 不要求 design
  - Spec Ref：spec-workflow-cli / iagent spec status validates Markdown artifacts
  - Scenario Ref：spec-workflow-cli / iagent spec status validates Markdown artifacts / 可选 design 缺失时报告 optional

- [x] 2.5 [测试][单元][P1] `instructions` 的 optional 标记与 unlocks 测试 [N4]
  - 文件：`test/spec-commands.test.ts`
  - 验证：断言 `dependencies[design].optional === true`；`resolvedOutputPath` 形态断言
  - Spec Ref：spec-workflow-cli / Markdown paths drive the built-in dependency graph
  - Scenario Ref：spec-workflow-cli / Markdown paths drive the built-in dependency graph / Markdown paths drive dependencies
  - Spec Ref：spec-workflow-cli / Markdown task instructions and apply context
  - Scenario Ref：spec-workflow-cli / Markdown task instructions and apply context / instructions 的 resolvedOutputPath 可直接写入

## 3. Spec Ref / Scenario Ref 解析与追溯

- [x] 3.1 [代码] `parseTaskFields` / `readField` 支持行式、`<!-- 字段: ... -->` HTML 注释式、`→` 与 `Requirement:` / `Scenario:` 标签、一行双引用；保留裸名兼容 [N13]
  - 文件：`src/core/spec/parser/task-parser.ts`
  - 验证：示例字符串解析出 specRef 与 scenarioRef 各一条

- [x] 3.2 [代码] `buildTraceability` 增加 `spec-ref-missing-requirement` / `scenario-ref-missing-scenario` 专用诊断（消息含「缺少 Requirement」与期望形态）与 `--partial` 下的 `pending-ref` 降级（仅 specs 未完成时） [N12] [N13]
  - 文件：`src/core/spec/validation/traceability.ts`、`src/core/spec/validation/artifact-validator.ts`
  - 验证：capability-only 引用报专用诊断；specs done 后同一引用仍为 error

- [x] 3.3 [代码] `TASKS_TEMPLATE` 补 `Spec Ref` / `Scenario Ref` 规范两行示例与 HTML 注释式样例，并声明 capability-only 无效 [N7] [N13]
  - 文件：`src/core/spec/templates/index.ts`
  - 验证：`iagent spec instructions tasks --json` 的 template 含两行示例
  - Spec Ref：spec-workflow-cli / 内置任务模板提供 Spec Ref / Scenario Ref 示例
  - Scenario Ref：spec-workflow-cli / 内置任务模板提供 Spec Ref / Scenario Ref 示例 / tasks 模板含规范两行示例
  - Scenario Ref：spec-workflow-cli / 内置任务模板提供 Spec Ref / Scenario Ref 示例 / 模板声明 capability-only 引用无效

- [x] 3.4 [测试][单元][P0] 解析器多形态测试：HTML 注释式、一行双引用、旧行式与裸名兼容 [N13]
  - 文件：`test/spec-artifact-parser.test.ts`
  - 验证：`pnpm test -- spec-artifact-parser`
  - Spec Ref：artifact-markdown-source / Tasks maintain explicit traceability to requirements
  - Scenario Ref：artifact-markdown-source / Tasks maintain explicit traceability to requirements / HTML 注释式引用被解析
  - Scenario Ref：artifact-markdown-source / Tasks maintain explicit traceability to requirements / 一行同时包含 Spec Ref 与 Scenario Ref
  - Scenario Ref：artifact-markdown-source / Tasks maintain explicit traceability to requirements / 旧行式与裸名引用保持兼容

- [x] 3.5 [测试][单元][P0] 追溯诊断测试：有效引用、失效引用、capability-only 专用诊断、起草期 `pending-ref` 降级 [N12] [N13]
  - 文件：`test/spec-artifact-parser.test.ts`
  - 验证：`pnpm test -- spec-artifact-parser`
  - Spec Ref：artifact-markdown-source / Tasks maintain explicit traceability to requirements
  - Scenario Ref：artifact-markdown-source / Tasks maintain explicit traceability to requirements / 有效规格引用
  - Scenario Ref：artifact-markdown-source / Tasks maintain explicit traceability to requirements / 失效规格引用
  - Scenario Ref：artifact-markdown-source / Tasks maintain explicit traceability to requirements / 仅 capability 的引用给出缺失 Requirement 诊断
  - Scenario Ref：artifact-markdown-source / Tasks maintain explicit traceability to requirements / 起草期未匹配引用降级为 pending-ref

- [x] 3.6 [测试][单元][P1] 模板示例自身可解析：把 `TASKS_TEMPLATE` 示例写入临时 tasks.md 后校验不产生 invalid-ref [N13]
  - 文件：`test/spec-commands.test.ts`
  - 验证：断言诊断中无 `invalid-spec-ref` / `invalid-scenario-ref`
  - Spec Ref：spec-workflow-cli / 内置任务模板提供 Spec Ref / Scenario Ref 示例
  - Scenario Ref：spec-workflow-cli / 内置任务模板提供 Spec Ref / Scenario Ref 示例 / tasks 模板含规范两行示例

## 4. JSON 契约（status / instructions apply）

- [x] 4.1 [代码] `ChangeStatusResult` 增加 `planningHome` 与 `artifactPaths`（`outputPath` / `resolvedOutputPath` / `existingOutputPaths`），由单一 builder 生成 [N38]
  - 文件：`src/core/spec/status.ts`
  - 验证：`status --json` 含两字段；specs 的 `existingOutputPaths` 列出实际文件

- [x] 4.2 [代码] `getApplyInstructions` 复用 `getChangeStatus` + `adjustStatusForSkipSpecs` 计算状态，并返回 `artifacts` / `applyRequires` / `isPlanningComplete` / `planningHome` / `artifactPaths` [N37] [N38]
  - 文件：`src/commands/spec.ts`
  - 验证：`instructions apply --json` 的 `artifacts` 与 `status --json` 逐项一致

- [x] 4.3 [代码] `adjustStatusForSkipSpecs` 改用必需依赖 helper 与 `satisfied` 闭包计算 `missingDeps` / `isPlanningComplete` [N2] [N7]
  - 文件：`src/commands/spec.ts`
  - 验证：`skip_specs` 变更的 planning complete 与 apply state 保持既有行为

- [x] 4.4 [测试][单元][P0] status JSON 契约测试：有效/无效制品、`status` 不作为真源、`optional` 状态、路径字段 [N38]
  - 文件：`test/markdown-spec-cli.test.ts`
  - 验证：`pnpm test -- markdown-spec-cli`
  - Spec Ref：spec-workflow-cli / iagent spec status validates Markdown artifacts
  - Scenario Ref：spec-workflow-cli / iagent spec status validates Markdown artifacts / Markdown 文件存在且有效
  - Scenario Ref：spec-workflow-cli / iagent spec status validates Markdown artifacts / 文件存在但格式无效
  - Scenario Ref：spec-workflow-cli / iagent spec status validates Markdown artifacts / status JSON is not a source artifact
  - Scenario Ref：spec-workflow-cli / iagent spec status validates Markdown artifacts / status JSON 含路径字段

- [x] 4.5 [测试][单元][P0] apply JSON 契约测试：artifacts / applyRequires / 路径字段 / skip_specs 一致性 / taskList [N37] [N38]
  - 文件：`test/spec-instructions-apply.test.ts`
  - 验证：`pnpm test -- spec-instructions-apply`
  - Spec Ref：spec-workflow-cli / Markdown task instructions and apply context
  - Scenario Ref：spec-workflow-cli / Markdown task instructions and apply context / Task instructions use Markdown
  - Scenario Ref：spec-workflow-cli / Markdown task instructions and apply context / Apply context uses Markdown
  - Scenario Ref：spec-workflow-cli / Markdown task instructions and apply context / apply JSON 返回 artifacts 与 applyRequires
  - Scenario Ref：spec-workflow-cli / Markdown task instructions and apply context / apply 与 status 的 skip_specs 语义一致

## 5. 技能模板

- [x] 5.1 [代码] `spec-propose` 起草循环改写：`instructions apply` 初检 → 每制品 `instructions` →（`specs`/`design`/`tasks` 可并行）→ `validate --partial` → strict `validate` + `instructions apply` 终检；删除 `status --json` 与每制品重复调用 [N2] [N4] [N8] [N37]
  - 文件：`src/core/templates/workflows/spec-propose.ts`
  - 验证：模板正文不再含 `iagent spec status --change "<name>" --json` 调用（步骤「展示变更状态」的非 JSON 文本展示 MAY 保留）；含 `--partial` 与终检段
  - Spec Ref：spec-workflow-skills / spec-propose 提案技能
  - Scenario Ref：spec-workflow-skills / spec-propose 提案技能 / 起草循环以 instructions apply 初检与终检
  - Scenario Ref：spec-workflow-skills / spec-propose 提案技能 / 并行起草 specs / design / tasks
  - Scenario Ref：spec-workflow-skills / spec-propose 提案技能 / design 可选不阻塞 apply-ready

- [x] 5.2 [代码] `spec-propose` 路径字段改为 `changeRoot` / `planningHome` / `artifactPaths` / `resolvedOutputPath`，删除 `actionContext` 引用 [N38]
  - 文件：`src/core/templates/workflows/spec-propose.ts`
  - 验证：正文 `grep actionContext` 为 0

- [x] 5.3 [代码] `spec-verify-proposal` 的 D3 维度与路径说明同步规范形态：capability-only 不计覆盖、给出「缺少 Requirement」诊断示例；`artifactPaths` 用法替代猜测 [N12]
  - 文件：`src/core/templates/workflows/spec-verify-proposal.ts`
  - 验证：Dimension 3 段含两种 ref 规范形态与 capability-only 反例

- [x] 5.4 [代码] `project-config.ts` 默认 spec 域规则行改为「允许 proposal 完成后并行起草，终检按依赖序」，并同步本机 `.iagent/rules/spec.md`（本机配置不入库） [N8]
  - 文件：`src/core/project-config.ts`
  - 验证：`iagent init` 生成的 spec.md 规则行不再强制串行

- [x] 5.5 [测试][单元][P1] 模板断言：D3 文案、`actionContext` 已清除、propose 无独立 `status --json` 调用 [N12] [N38]
  - 文件：`test/templates.test.ts`、`test/template-consistency.test.ts`
  - 验证：`pnpm test -- templates template-consistency`
  - Spec Ref：spec-workflow-skills / spec-propose 提案技能
  - Scenario Ref：spec-workflow-skills / spec-propose 提案技能 / 起草循环以 instructions apply 初检与终检
  - Scenario Ref：spec-workflow-skills / spec-propose 提案技能 / 路径字段来自 CLI

- [x] 5.6 [测试][单元][P2] 回归确认 `spec-propose` 既有行为不变（能力记忆注入、探索文件迁移、流程基准锚点、测试规划判定、规划边界） [N1] [N3] [N5] [N11]
  - 文件：`test/spec-workflow-contract.test.ts`
  - 验证：`pnpm test -- spec-workflow-contract`
  - Spec Ref：spec-workflow-skills / spec-propose 提案技能
  - Scenario Ref：spec-workflow-skills / spec-propose 提案技能 / 能力记忆注入
  - Scenario Ref：spec-workflow-skills / spec-propose 提案技能 / 探索文件关联迁移
  - Scenario Ref：spec-workflow-skills / spec-propose 提案技能 / 迁移失败保留源文件
  - Scenario Ref：spec-workflow-skills / spec-propose 提案技能 / 历史探索文件不被追溯清理
  - Scenario Ref：spec-workflow-skills / spec-propose 提案技能 / 配对指令版不含迁移步骤（维持现状）
  - Scenario Ref：spec-workflow-skills / spec-propose 提案技能 / 前置验证门强制执行
  - Scenario Ref：spec-workflow-skills / spec-propose 提案技能 / Planning Boundary
  - Scenario Ref：spec-workflow-skills / spec-propose 提案技能 / 依赖文件 re-read from disk
  - Scenario Ref：spec-workflow-skills / spec-propose 提案技能 / required set 传递闭包
  - Scenario Ref：spec-workflow-skills / spec-propose 提案技能 / 材料性歧义划分
  - Scenario Ref：spec-workflow-skills / spec-propose 提案技能 / 以流程基准为生成锚点
  - Scenario Ref：spec-workflow-skills / spec-propose 提案技能 / 流程图缺失或未确认时降级
  - Scenario Ref：spec-workflow-skills / spec-propose 提案技能 / 测试规划判定产出 [测试] 任务
  - Scenario Ref：spec-workflow-skills / spec-propose 提案技能 / 判定无需测试时留痕

- [x] 5.7 [测试][单元][P1] 追溯契约表述测试：技能正文与 D3 维度使用同一规范形态，未覆盖/失效引用被报告 [N12] [N13]
  - 文件：`test/spec-workflow-contract.test.ts`、`test/templates.test.ts`
  - 验证：断言正文含 `capability / Requirement / Scenario` 与 capability-only 反例
  - Spec Ref：spec-workflow-skills / Spec-to-task traceability is mandatory
  - Scenario Ref：spec-workflow-skills / Spec-to-task traceability is mandatory / Scenario has an implementation task
  - Scenario Ref：spec-workflow-skills / Spec-to-task traceability is mandatory / Scenario has no test
  - Scenario Ref：spec-workflow-skills / Spec-to-task traceability is mandatory / D3 按规范形态匹配
  - Scenario Ref：spec-workflow-skills / Spec-to-task traceability is mandatory / 仅 capability 引用不计为覆盖
  - Spec Ref：spec-workflow-skills / spec-verify-proposal SHALL 为提案验证维度的唯一真源
  - Scenario Ref：spec-workflow-skills / spec-verify-proposal SHALL 为提案验证维度的唯一真源 / 维度定义集中于 verify-proposal
  - Scenario Ref：spec-workflow-skills / spec-verify-proposal SHALL 为提案验证维度的唯一真源 / 消费方只引用不重定义
  - Scenario Ref：spec-workflow-skills / spec-verify-proposal SHALL 为提案验证维度的唯一真源 / D3 维度声明规范引用形态与缺失诊断

## 6. 调用方同步

### Caller Updates

- [x] 6.1 [代码] `previewArchive` 的未完成制品清单排除可选制品（`design?`），避免无 design 变更归档时误报 [N7]
  - 文件：`src/core/spec/archive.ts`
  - 验证：无 design 的完整变更归档预览无「未完成规划制品」警告

- [x] 6.2 [代码] 清理其余 5 个模板的 `actionContext` 引用与 workspace 护栏句（行号为 `grep -n actionContext src/core/templates/workflows/*.ts` 实测命中行，须逐条清干净）：`spec-explore.ts:1031`、`spec-verify.ts:46`、`spec-archive.ts:45,48,224`、`spec-bulk-archive.ts:69,72,289`、`spec-apply.ts:309,313` [N38]
  - 文件：`src/core/templates/workflows/spec-explore.ts`、`spec-verify.ts`、`spec-archive.ts`、`spec-bulk-archive.ts`、`spec-apply.ts`
  - 验证：`grep -rn actionContext src/` 为 0 命中；`spec-archive.ts:224` 与 `spec-bulk-archive.ts:289` 的「workspace 范围的变更…跳过本步骤」IMPORTANT 句同批删除（否则上述 grep 断言必失败）
  - 备注：`spec-verify-proposal.ts:549` 只引用 `artifactPaths`（无 `actionContext`），不在本任务删除面，其路径口径由任务 5.3 覆盖
  - Spec Ref：spec-workflow-skills / spec-propose 提案技能
  - Scenario Ref：spec-workflow-skills / spec-propose 提案技能 / 路径字段来自 CLI

- [x] 6.3 [代码] 重新生成产物快照：`pnpm build && pnpm generate:skills` [N38]
  - 文件：`skills/iagent-spec-propose/SKILL.md`、`skills/iagent-spec-verify-proposal/SKILL.md`、`skills/iagent-spec-apply/SKILL.md`、`skills/iagent-spec-explore/SKILL.md`、`skills/iagent-spec-verify/SKILL.md`、`skills/iagent-spec-archive/SKILL.md`、`skills/iagent-spec-bulk-archive/SKILL.md`
  - 验证：`pnpm test -- skills-parity` 通过
  - Spec Ref：spec-workflow-skills / spec-propose 提案技能
  - Scenario Ref：spec-workflow-skills / spec-propose 提案技能 / 起草循环以 instructions apply 初检与终检

- [x] 6.4 [测试][单元][P0] 既有断言同步：`test/spec-status.test.ts`（design 可选 / planning complete）、`test/markdown-spec-cli.test.ts`（validate 选项与 apply 字段）、`test/spec-instructions-apply.test.ts`（contextFiles 不变）、`test/spec-artifact-parser.test.ts`（裸名兼容） [N2] [N7] [N13]
  - 文件：`test/spec-status.test.ts`、`test/markdown-spec-cli.test.ts`、`test/spec-instructions-apply.test.ts`、`test/spec-artifact-parser.test.ts`
  - 验证：`pnpm test -- spec-status markdown-spec-cli spec-instructions-apply spec-artifact-parser`
  - Spec Ref：artifact-markdown-source / Tasks maintain explicit traceability to requirements
  - Scenario Ref：artifact-markdown-source / Tasks maintain explicit traceability to requirements / 旧行式与裸名引用保持兼容
  - Spec Ref：spec-workflow-cli / iagent spec status validates Markdown artifacts
  - Scenario Ref：spec-workflow-cli / iagent spec status validates Markdown artifacts / Markdown 文件存在且有效
  - Spec Ref：spec-workflow-cli / Markdown paths drive the built-in dependency graph
  - Scenario Ref：spec-workflow-cli / Markdown paths drive the built-in dependency graph / design 可选不阻塞 tasks

## 7. 收尾验证

- [x] 7.1 [测试][功能][P1] 端到端回归：并行起草场景（`--partial` 通过、strict 仍报 missing-tasks）、design 可选变更 apply-ready、文本报告逐行输出 [N8] [N9] [N10] [N11]
  - 文件：`test/spec-commands.test.ts`
  - 验证：`pnpm test -- spec-commands`
  - Spec Ref：spec-workflow-cli / iagent spec validate 支持部分校验与单制品校验
  - Scenario Ref：spec-workflow-cli / iagent spec validate 支持部分校验与单制品校验 / --partial 将缺失制品记为 incomplete
  - Scenario Ref：spec-workflow-cli / iagent spec validate 支持部分校验与单制品校验 / strict 模式保留终检语义
  - Scenario Ref：spec-workflow-cli / iagent spec validate 支持部分校验与单制品校验 / 文本报告按行输出诊断

- [x] 7.2 [测试][单元][P0] 全量测试：`pnpm test` [N11]
  - 文件：`test/`（全量）
  - 验证：全绿，无新增 skip
  - Spec Ref：spec-workflow-cli / Markdown task instructions and apply context
  - Scenario Ref：spec-workflow-cli / Markdown task instructions and apply context / apply JSON 返回 artifacts 与 applyRequires

- [x] 7.3 [代码] 版本号与变更日志：`node bin/iagent.js version` 只读判定后 `version bump`，随功能提交一并提交 [N11]
  - 文件：`package.json`、`CHANGELOG.md`、`README.md`
  - 验证：`version` 输出的等级与 `feat` 变更一致（预期 minor）
