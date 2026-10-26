# Tasks: add-prompt-validation-gate

<!-- 任务类型标签：[代码] 实现代码 / [DB脚本] 数据库脚本 / [使用说明] 补充文档（默认产出至 attachments/） -->

## 1. 共享门模块（唯一源）

- [x] 1.1 [代码] 新增提示词校验门单一源模块，导出维度类型、两套维度常量、参数化渲染函数与指令压缩块
  - 文件：`src/core/templates/prompt-gate.ts`
  - 内容：`PromptDimension` 接口（name / question / escalation / hardBlocking）；`REQUIREMENT_DIMENSIONS` 需求六维（目标/对象/范围/约束/验收/歧义，其中约束与验收不计入硬不明确判据）；`BUG_DIMENSIONS` bug 五维（症状/复现步骤/期望vs实际/环境/歧义，其中环境不计入）；`buildPromptGateBlock(dimensions)` 渲染共享 Step 1–5 流程文本 + 入口形态适配段（清晰判据由 hardBlocking 维度渲染得出）；`buildPromptGateCompact(dimensions)` 指令压缩版
  - 验证：`pnpm build` 通过，模块可被 5 个模板文件 import；渲染出的需求版与 bug 版仅 Step 1 维度表不同

## 2. 技能正文接入校验门

- [x] 2.1 [代码] `venus_spec_explore` 在 `Input` 段之后、`The Stance` 之前插入**条件触发**的门（含糊时激活，清晰直通），保持"stance not workflow"定位；门文本不得包 `<!-- CMD:SKIP -->`
  - 文件：`src/core/templates/workflows/spec-explore.ts`
  - 验证：`deriveCommandContent` 派生出的指令正文中包含门文本；技能描述与既有"无固定步骤、无强制产出"表述未被改动

- [x] 2.2 [代码] `venus_tr_impl_workflow` 新增 `1.1.2 Prompt Validation Gate`（1.1 建探索文件之后、1.1.5 之前），并在 1.2 结构化格式中增加 `## 提示词基线` 段
  - 文件：`src/core/templates/workflows/tr-impl-workflow.ts`
  - 验证：1.1.2 编号介于 1.1 与 1.1.5 之间，既有 checkpoint 编号与语义未被重排；1.2 模板含 `## 提示词基线` 段说明

- [x] 2.3 [代码] `venus_tr_impl_auto_workflow` 新增同构的 Phase 1.1.2 门与 `## 提示词基线` 段，并显式声明澄清门不被 auto 语义跳过
  - 文件：`src/core/templates/workflows/tr-impl-auto-workflow.ts`
  - 验证：门位置与 2.2 同构；正文存在"不得因 auto 语义跳过本门"的明确表述

- [x] 2.4 [代码] `venus_tr_impl_debug` 在 `Startup` 段内、Phase 1 强制复现之前插入 bug 版门（bug 五维），校验结论与基线写入诊断记录 `## 提示词基线` 段
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：门位于 Startup 段内、Phase 1 之前；维度为 bug 五维而非需求六维；含"用户确认前不得进入复现/不得凭猜测编写失败测试"表述

- [x] 2.5 [代码] `venus_tr_impl_genfull` 在 Phase 0 内、Stage 1 委派之前插入门，并增加幂等判定（检测到既有提示词基线时不重复校验或确认）
  - 文件：`src/core/templates/workflows/tr-impl-genfull.ts`
  - 验证：门位于 Phase 0 的 Stage 1 委派之前；含幂等判定表述；Guardrails 增加对应条目

- [x] 2.6 [代码] 门的入口形态适配（贯穿 5 个技能）
  - 文件：`src/core/templates/prompt-gate.ts`（共享块的入口适配段）+ 5 个技能模板各自的入口说明
  - 内容：无输入入口（`spec-explore` 仅进入探索模式）跳过本门；输入为变更名时以该变更既有制品为校验对象而非把变更名当提示词；流程技能参数缺失时先交互收集主题、以收集后的描述为校验对象，不对空输入执行校验
  - 验证：`spec-explore` 正文含"无参数跳过 / 变更名以制品为对象"表述；workflow/auto-workflow/debug 正文含"以收集后的描述为校验对象"表述

- [x] 2.7 [代码] 门的确认分支与死锁防护（贯穿 5 个技能）
  - 文件：`src/core/templates/prompt-gate.ts`（共享块的确认分支段）+ 5 个技能模板
  - 内容：确认分支须覆盖三条出口——用户确认 / 用户修改（以修改版为基线）/ 用户拒绝优化（记录原始提示词按原有理解继续）；并新增"用户显式授权按推断继续"出口（推断项标 `[推断]` 记入基线后继续，不得反复要求确认或死锁）
  - 验证：共享块含三条出口表述；正文明确"MUST NOT 陷入等待确认的死循环"

## 3. 手写指令正文同步（压缩版）

- [x] 3.1 [代码] `tr-impl-workflow` 指令正文插入 `PROMPT_GATE_COMPACT` 压缩版门
  - 文件：`src/core/templates/workflows/tr-impl-workflow.ts`（`getTrImplWorkflowCommandTemplate().content`）
  - 验证：指令正文含门的分级判定与阻塞确认要点；与技能正文语义一致

- [x] 3.2 [代码] `tr-impl-auto-workflow` 指令正文插入压缩版门
  - 文件：`src/core/templates/workflows/tr-impl-auto-workflow.ts`
  - 验证：同上，且含"澄清门不被 auto 跳过"要点

- [x] 3.3 [代码] `tr-impl-debug` 指令正文插入压缩版门（bug 五维）
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：指令正文含 bug 版维度与阻塞确认要点

- [x] 3.4 [代码] `tr-impl-genfull` 指令正文插入压缩版门与幂等要点
  - 文件：`src/core/templates/workflows/tr-impl-genfull.ts`
  - 验证：指令正文含门要点与幂等判定

## 4. 规格、术语与快照同步

- [x] 4.1 [代码] `openspec/CONTEXT.md` 新增术语「提示词校验门」「提示词基线」，并与既有「蒸馏确认门」显式区分
  - 文件：`openspec/CONTEXT.md`
  - 验证：两条术语按既有格式（**术语**：定义 + `_Avoid_:`）插入；蒸馏确认门条目未被破坏

- [x] 4.2 [代码] 重新生成 `skills/` 静态快照
  - 文件：`skills/**/SKILL.md`
  - 验证：`pnpm build && pnpm generate:skills` 执行成功；5 个技能快照中均含门文本

- [x] 4.3 [代码] 全量测试回归
  - 文件：（无文件变更，验证任务）
  - 验证：`pnpm test` 全绿 —— 特别是 `skills-parity`（快照一致性）、`templates` 与 `commands`（技能总数仍为 27）、`allowed-tools`（未引入白名单外命令）、`derive-command`（派生器未被改动）

- [x] 4.4 [代码] 门文本行为抽查（清晰分支零打扰 / 不明确分支阻塞 / 幂等）
  - 文件：（验证任务，抽查 `skills/venus_spec_explore/SKILL.md`、`skills/venus_tr_impl_debug/SKILL.md`、`skills/venus_tr_impl_genfull/SKILL.md`）
  - 验证：清晰分支明确"不输出校验表格、不要求确认"；不明确分支明确"用户确认前 MUST NOT 探索"；genfull 明确幂等不复确认
