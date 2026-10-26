# Tasks: refactor-orchestrator-explore-delegation

<!-- 任务类型标签：[代码] / [DB脚本] / [使用说明]（默认产出至 attachments/） -->

## 1. spec-explore 委派执行模式（delegated）

- [x] 1.1 [代码] `spec-explore.ts` 新增 `mode` 契约：Input 增加 `mode=interactive|delegated`（默认 interactive）；`interactive` 明确声明保持 `## The Stance` 立场式（无固定步骤/无强制探索文件时机/无 L1-L5/无聚合门）
  - 文件：`src/core/templates/workflows/spec-explore.ts`
  - 验证：正文含 `mode` 说明；interactive 段落保留 `## The Stance` 与"无固定步骤"表述
  - Spec Ref：`spec-workflow-skills / spec-explore 委派执行模式（delegated）契约`
  - Scenario Ref：interactive 保持立场式不变

- [x] 1.2 [代码] `spec-explore.ts` 实现 delegated 分支的强制 checkpoint 体系：调用即强制建探索文件（keyword/sequence/冲突重试）→ 提示词校验门 → CONTEXT.md 检查 → CodeGraph 基础扫描（含多项目派发与深度分析触发）→ **L1-L5 grill 追问（逐级确认门，最低 L3，跳过记 Pending）** → 功能流程图与流程最终确认门 → **聚合一致性门（三类硬冲突 + vacuity-pass）** → 探索完成检测；补 `Agent/Task` 派发白名单（多项目扫描）
  - 文件：`src/core/templates/workflows/spec-explore.ts`
  - 验证：正文含各 checkpoint 关键词；L1-L5 与聚合门为 delegated 新增；派发条目按需补
  - Spec Ref：`spec-workflow-skills / spec-explore 委派执行模式（delegated）契约`
  - Scenario Ref：delegated 强制 checkpoint 体系
  - Scenario Ref：delegated 的 L1-L5 追问门逐级等待
  - Scenario Ref：delegated 的聚合一致性门拦截硬冲突
  - Spec Ref：`workflow-suite-skills / 提示词校验门共享模块`
  - Scenario Ref：门文本单一源内联
  - Spec Ref：`workflow-suite-skills / 功能流程图共享模块`
  - Scenario Ref：流程图文本单一源内联
  - Spec Ref：`workflow-suite-skills / 多项目 CodeGraph 扫描单代理化`
  - Scenario Ref：单子代理串行扫描全部项目
  - Scenario Ref：单项目降级不影响其他项目
  - Scenario Ref：子代理不可用时的降级
  - Scenario Ref：待查项目与当前项目相同

- [x] 1.3 [代码] `spec-explore.ts` 实现**结构化 handoff**：delegated 完成时输出探索文件路径、提示词基线、流程基准确认状态、Pending 影响符号；并声明不跳过任何确认门、不推进阶段
  - 文件：`src/core/templates/workflows/spec-explore.ts`
  - 验证：正文含 handoff 字段；`grep` 断言 delegated 段落声明"不跳过提示词门/L1-L5/流程图门"
  - Spec Ref：`spec-workflow-skills / spec-explore 委派执行模式（delegated）契约`
  - Scenario Ref：delegated 产出结构化 handoff 并交回主权
  - Scenario Ref：delegated 不跳过确认门
  - Scenario Ref：探索文件缺失时 handoff 报告异常

- [x] 1.4 [代码] `spec-explore.ts` 长细则下沉 `references/`（L1-L5 问句库、聚合门矩阵等），控主文件体积（与 C 的尺寸预算协同）
  - 文件：`src/core/templates/workflows/spec-explore.ts`
  - 验证：主 SKILL.md ≤ 500 行（或记录与 C 的协同）；references 引用存在
  - Spec Ref：`spec-workflow-skills / spec-explore 委派执行模式（delegated）契约`

## 2. workflow 探索阶段委派

- [x] 2.1 [代码] `workflow.ts` Phase 1 内联探索正文（1.1–1.7）替换为委派调用：经 Skill 工具委派 `iagent_spec_explore`（`mode=delegated`）；删除内联建文件/扫描/grill/聚合门/完成检测正文
  - 文件：`src/core/templates/workflows/workflow.ts`
  - 验证：Phase 1 段落不再含内联探索步骤；含 `Skill` 委派 `spec_explore` 调用描述
  - Spec Ref：`workflow-suite-skills / workflow 探索阶段委派 spec-explore`
  - Scenario Ref：探索阶段委派而非内联

- [x] 2.2 [代码] `workflow.ts` 消费结构化 handoff 并补退出守卫：明确 handoff 字段消费与阶段主权归属（`spec_explore` 不推进阶段）
  - 文件：`src/core/templates/workflows/workflow.ts`
  - 验证：Guardrails 含"阶段主权归编排器"与 handoff 消费说明
  - Spec Ref：`workflow-suite-skills / workflow 探索阶段委派 spec-explore`
  - Scenario Ref：消费结构化 handoff
  - Scenario Ref：探索阶段阶段主权归编排器

## 3. auto-workflow 探索阶段委派

- [x] 3.1 [代码] `auto-workflow.ts` Phase 1 内联探索正文替换为委派 `iagent_spec_explore`（`mode=delegated`）；保留"提示词门/流程图门不被 auto 语义跳过"表述（归属改为委派的 spec_explore）；补退出守卫
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 验证：Phase 1 不再内联；委派调用与门归属表述正确；退出守卫存在
  - Spec Ref：`workflow-suite-skills / auto-workflow 全自动管线`
  - Scenario Ref：Phase 1 委派 spec-explore 探索
  - Scenario Ref：澄清门不被 auto 语义跳过
  - Scenario Ref：流程图确认门不被 auto 语义跳过

## 4. 依赖注入与白名单

- [x] 4.1 [代码] `profiles.ts` 的 `DEPS` 增加 `'workflow': [...现有, 'spec-explore']` 与 `'auto-workflow': [...现有, 'spec-explore']`（与 B 的 `spec-propose` 条目并存）；确认不动点迭代
  - 文件：`src/core/profiles.ts`
  - 验证：`resolveWorkflows(['workflow'])` 含 `spec-explore`；`resolveWorkflows(['auto-workflow'])` 含 `spec-explore`
  - Spec Ref：`skill-profile / 依赖注入`
  - Scenario Ref：编排器委派探索技能随装
  - Scenario Ref：workflow 阶段技能传递注入

- [x] 4.2 [代码] 两编排器 `allowedTools` 经 `${skillDelegation(['spec_explore'])}` 补 `Skill(spec_explore)` 条目
  - 文件：`src/core/templates/workflows/workflow.ts`、`auto-workflow.ts`
  - 验证：二者 `allowedTools` 含 `Skill(spec_explore)`；无 `Skill(*)`
  - Spec Ref：`workflow-suite-skills / workflow 探索阶段委派 spec-explore`

## 5. 测试、文档与回归

- [x] 5.1 [测试][单元][P0] 新增/更新测试：① `resolveWorkflows` 的 `spec-explore` 注入；② 两编排器 `allowedTools` 含 `Skill(spec_explore)`；③ `spec_explore` delegated 分支存在且 interactive 保留 `## The Stance`；④ 编排器正文声明退出守卫与 handoff 消费；⑤ delegated 正文含 L1-L5 与聚合门关键词
  - 文件：`test/orchestrator-delegation.test.ts`（扩展）/ `test/templates.test.ts` / `test/profiles.test.ts`
  - 验证：`pnpm test` 全绿
  - Spec Ref：`workflow-suite-skills / workflow 探索阶段委派 spec-explore`
  - Scenario Ref：探索阶段委派而非内联
  - Scenario Ref：探索阶段阶段主权归编排器
  - Scenario Ref：技能总数与注册结构
  - Scenario Ref：节点字段按场景参数化

- [x] 5.2 [代码] 重新生成快照并人工审查 diff：`pnpm build && pnpm generate:skills`；`git diff skills/` 预期为两编排器 Phase 1 大幅缩短、`spec_explore` 增 delegated 分支；确认门与 Phase 2/4/5 委派未变
  - 文件：`skills/`、`.claude/commands/iagent/`、`.pi/prompts/`
  - 验证：`test/skills-parity.test.ts` 通过；diff 仅含预期差异
  - Spec Ref：`workflow-suite-skills / workflow 探索阶段委派 spec-explore`

- [x] 5.3 [代码] 文档同步：AGENTS.md（编排全阶段委派约定）、`docs/skills-manual.md` 更新
  - 文件：`AGENTS.md`、`docs/skills-manual.md`
  - 验证：人工核对与实现一致

- [x] 5.4 [代码] 全量回归与版本收尾：`pnpm build && pnpm test` 全绿；按守则 8 递增 `package.json` 版本并归档 `CHANGELOG.md`（**须在 A、B 之后**实施）
  - 文件：`package.json`、`CHANGELOG.md`
  - 验证：`pnpm test` 全绿；CHANGELOG 生成新版本小节

- [x] 5.5 [测试][单元][P1] 既有行为回归断言：确认未改动的既有场景不退化（DEPS 既有规则、auto-workflow 非探索阶段行为）
  - 文件：`test/profiles.test.ts` / `test/templates.test.ts`
  - 验证：`pnpm test` 全绿
  - Spec Ref：`skill-profile / 依赖注入`
  - Scenario Ref：漏选归档前验证
  - Scenario Ref：漏选归档需求文档技能
  - Scenario Ref：批量归档同时补两依赖
  - Scenario Ref：默认集安装 9 项
  - Scenario Ref：漏选提案评分门
  - Scenario Ref：漏选迁移子技能
  - Scenario Ref：仅补缺失项
  - Scenario Ref：失效依赖不再注入
  - Scenario Ref：编排器委派提案技能随装
  - Scenario Ref：apply 不触发注入
  - Spec Ref：`workflow-suite-skills / auto-workflow 全自动管线`
  - Scenario Ref：验证通过直通 apply 与 archive
  - Scenario Ref：Phase 2 委派 spec-propose 生成提案
  - Scenario Ref：探索文件迁移后删除源文件
  - Scenario Ref：归档阶段生成需求文档
  - Scenario Ref：编译检查持续失败暂停
  - Scenario Ref：测试执行关卡自动通关
  - Scenario Ref：测试失败 3 次后暂停
  - Scenario Ref：Phase 2 产出 [测试] 任务
