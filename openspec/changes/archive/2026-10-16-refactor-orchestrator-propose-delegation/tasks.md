# Tasks: refactor-orchestrator-propose-delegation

<!-- 任务类型标签：[代码] / [DB脚本] / [使用说明]（默认产出至 attachments/） -->

## 1. spec-propose 委派执行模式（delegated）

- [x] 1.1 [代码] `spec-propose.ts` 新增 `mode` 契约：Input 增加 `mode=interactive|delegated`（默认 interactive）与 `exploration-file=<path>`；文档化 `spec_apply` 的 `auto-mode=true` 为 `mode=delegated` 等价别名
  - 文件：`src/core/templates/workflows/spec-propose.ts`
  - 验证：正文含 `mode` 与 `exploration-file` 说明；interactive 路径表述不变
  - Spec Ref：`spec-workflow-skills / spec-propose 委派执行模式（delegated）契约`
  - Scenario Ref：interactive 默认行为不变

- [x] 1.2 [代码] `spec-propose.ts` 实现 delegated 分支：Step 0 跳过用户提示（直接迁移 `exploration-file`，成功后删源）；结尾抑制规划边界停点，改为输出结构化回执（change-name / 制品清单 / apply-ready）；抑制自身 Phase 3（不调用 `spec_verify_proposal`、不生成需求文档）
  - 文件：`src/core/templates/workflows/spec-propose.ts`
  - 验证：正文含三分支条件判断；`grep` 断言 delegated 段落声明"不跳过任何对话级确认门"
  - Spec Ref：`spec-workflow-skills / spec-propose 委派执行模式（delegated）契约`
  - Scenario Ref：delegated 模式跳过 Step 0 用户提示
  - Scenario Ref：delegated 模式抑制自身 Phase 3
  - Scenario Ref：delegated 模式抑制结尾停点
  - Scenario Ref：delegated 不改变确认门

## 2. workflow 提案阶段委派

- [x] 2.1 [代码] `workflow.ts` Phase 2 内联制品生成主体替换为委派调用：经 Skill 工具委派 `iagent_spec_propose`（`mode=delegated` + `exploration-file`）；保留 Phase 2.0 预迁移验证与影响分析（CodeGraph impact）；删除内联制品生成与规则注入正文（改由 `spec_propose` 承担）
  - 文件：`src/core/templates/workflows/workflow.ts`
  - 验证：Phase 2.4 段落不再含内联生成指令；含 `Skill` 委派 `spec_propose` 的调用描述；2.0 影响分析仍在
  - Spec Ref：`workflow-suite-skills / workflow 提案阶段委派 spec-propose`
  - Scenario Ref：提案阶段委派而非内联
  - Scenario Ref：预迁移验证与影响分析保留在编排器

- [x] 2.2 [代码] `workflow.ts` 补退出守卫与验证门衔接：明确 delegated 完成回执后由编排器进入 Phase 3 验证超集（`spec_verify_proposal` + `proposal_review` + `requirement_doc`）；被委派的 `spec_propose` MUST NOT 推进阶段
  - 文件：`src/core/templates/workflows/workflow.ts`
  - 验证：Guardrails 含"阶段主权归编排器"与"验证门由编排器执行"表述
  - Spec Ref：`workflow-suite-skills / workflow 提案阶段委派 spec-propose`
  - Scenario Ref：验证门仍由编排器执行
  - Scenario Ref：阶段主权归编排器

## 3. auto-workflow 提案阶段委派

- [x] 3.1 [代码] `auto-workflow.ts` Phase 2 精简内联替换为委派 `iagent_spec_propose`（`mode=delegated` + `exploration-file`）；更新 Phase 1-3 "与 workflow 同构"表述为"Phase 1 探索保持内联 + Phase 2 委派"；补退出守卫
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 验证：Phase 2 不再含内联生成指令；含委派调用与退出守卫；Phase 1 门（提示词门/流程图门）表述不变
  - Spec Ref：`workflow-suite-skills / auto-workflow 全自动管线`
  - Scenario Ref：Phase 2 委派 spec-propose 生成提案
  - Scenario Ref：澄清门不被 auto 语义跳过
  - Scenario Ref：流程图确认门不被 auto 语义跳过

## 4. 依赖注入与白名单

- [x] 4.1 [代码] `profiles.ts` 的 `DEPS` 增加 `'workflow': [...现有, 'spec-propose']` 与 `'auto-workflow': [...现有, 'spec-propose']`；确认不动点迭代连带补全（`spec-propose ⇒ spec-verify-proposal`）
  - 文件：`src/core/profiles.ts`
  - 验证：`resolveWorkflows(['workflow'])` 结果含 `spec-propose` 与 `spec-verify-proposal`；`resolveWorkflows(['auto-workflow'])` 含 `spec-propose`
  - Spec Ref：`skill-profile / 依赖注入`
  - Scenario Ref：编排器委派提案技能随装
  - Scenario Ref：workflow 阶段技能传递注入
  - Scenario Ref：漏选提案评分门
  - Scenario Ref：apply 不触发注入

- [x] 4.2 [代码] 两编排器 `allowedTools` 经 `${skillDelegation(['spec_propose'])}` 补 `Skill(spec_propose)` 条目（`workflow` 原列表追加；`auto-workflow` 原列表追加）
  - 文件：`src/core/templates/workflows/workflow.ts`、`auto-workflow.ts`
  - 验证：二者 `allowedTools` 含 `Skill(spec_propose)`；无 `Skill(*)`
  - Spec Ref：`spec-workflow-skills / spec-propose 委派执行模式（delegated）契约`

## 5. 测试、文档与回归

- [x] 5.1 [测试][单元][P0] 新增/更新测试：① `resolveWorkflows` 的 `spec-propose` 注入（含传递闭包）；② 两编排器 `allowedTools` 含 `Skill(spec_propose)`；③ `spec_propose` delegated 分支存在且 interactive 分支保留 Step 0 提示与结尾停点（正文字符串断言）；④ 编排器正文声明退出守卫
  - 文件：`test/templates.test.ts` / `test/profiles.test.ts` / 新建 `test/orchestrator-delegation.test.ts`
  - 验证：`pnpm test` 全绿
  - Spec Ref：`workflow-suite-skills / workflow 提案阶段委派 spec-propose`
  - Scenario Ref：提案阶段委派而非内联
  - Scenario Ref：阶段主权归编排器

- [x] 5.2 [代码] 重新生成快照并人工审查 diff：`pnpm build && pnpm generate:skills`；`git diff skills/` 预期为两编排器 Phase 2 大幅缩短、`spec_propose` 增 delegated 分支；确认 Phase 1 门与 Phase 4/5 委派未变
  - 文件：`skills/`、`.claude/commands/iagent/`、`.pi/prompts/`
  - 验证：`test/skills-parity.test.ts` 通过；diff 仅含预期差异
  - Spec Ref：`workflow-suite-skills / workflow 提案阶段委派 spec-propose`

- [x] 5.3 [代码] 文档同步：AGENTS.md（仓库地图/编排委派约定）、`docs/skills-manual.md`（编排阶段委派说明）更新
  - 文件：`AGENTS.md`、`docs/skills-manual.md`
  - 验证：人工核对与实现一致

- [x] 5.4 [代码] 全量回归与版本收尾：`pnpm build && pnpm test` 全绿；按守则 8 递增 `package.json` 版本（技能参数新增 + 编排行为变更，取较大递增位）并归档 `CHANGELOG.md`
  - 文件：`package.json`、`CHANGELOG.md`
  - 验证：`pnpm test` 全绿；CHANGELOG 生成新版本小节
  - Spec Ref：`spec-workflow-skills / spec-propose 委派执行模式（delegated）契约`

- [x] 5.5 [测试][单元][P1] 既有行为回归断言：确认未改动的既有场景不因本变更退化（DEPS 既有注入规则、auto-workflow 非提案阶段行为）
  - 文件：`test/profiles.test.ts` / `test/templates.test.ts`
  - 验证：`pnpm test` 全绿
  - Spec Ref：`skill-profile / 依赖注入`
  - Scenario Ref：漏选归档前验证
  - Scenario Ref：漏选归档需求文档技能
  - Scenario Ref：批量归档同时补两依赖
  - Scenario Ref：默认集安装 9 项
  - Scenario Ref：漏选迁移子技能
  - Scenario Ref：仅补缺失项
  - Scenario Ref：失效依赖不再注入
  - Spec Ref：`workflow-suite-skills / auto-workflow 全自动管线`
  - Scenario Ref：验证通过直通 apply 与 archive
  - Scenario Ref：探索文件迁移后删除源文件
  - Scenario Ref：归档阶段生成需求文档
  - Scenario Ref：编译检查持续失败暂停
  - Scenario Ref：测试执行关卡自动通关
  - Scenario Ref：测试失败 3 次后暂停
  - Scenario Ref：Phase 2 产出 [测试] 任务
