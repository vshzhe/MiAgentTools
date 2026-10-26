# Tasks: streamline-explore-size-and-gates

## 1. spec_explore 主文件下沉

- [x] 1.1 [代码] 把 `iagent_spec_explore` 主 SKILL.md 的上游衍生散文（The Stance / What You Might Do / OpenSpec Awareness / Handling Different Entry Points / Ending Discovery / What We Figured Out）移入 `references/exploration-guidance.md`，主文件保留一行指针
  - 文件：`src/core/templates/workflows/spec-explore.ts`
  - 验证：主文件行数 ≤ 250；`references/exploration-guidance.md` 存在且非空
  - Spec Ref：`spec-workflow-skills / spec-explore 主文件渐进披露与预算`
  - Scenario Ref：主文件在预算内
  - Scenario Ref：衍生指南独立可读且被引用

- [x] 1.2 [测试][单元][P1] 收紧 `test/skill-size-budget.test.ts`：spec_explore 主文件预算 250 行 + references 存在性/引用一致性
  - 文件：`test/skill-size-budget.test.ts`
  - 验证：断言通过
  - Spec Ref：`spec-workflow-skills / spec-explore 主文件渐进披露与预算`
  - Scenario Ref：主文件在预算内

## 2. 探索协议分层

- [x] 2.1 [代码] 把 `references/exploration-protocol.md`（874 行）拆为协议主 + 子 references：`multi-project-scan.md`（1.2.1.5）、`grill-playbook.md`（1.3 与 L1-L5）、`deep-analysis.md`（1.4 与分析深潜）
  - 文件：`src/core/templates/workflows/spec-explore.ts`
  - 验证：四个文件存在且非空；主协议在对应步骤以 `Read references/<x>.md` 引导
  - Spec Ref：`spec-workflow-skills / 探索协议按关注点分层`
  - Scenario Ref：拆分后子文件齐备
  - Scenario Ref：主协议按需引用子文件

- [x] 2.2 [测试][单元][P1] 断言 spec-explore 拆分后的子 references 齐备且被主协议引用
  - 文件：`test/skill-size-budget.test.ts`
  - 验证：断言通过
  - Spec Ref：`spec-workflow-skills / 探索协议按关注点分层`
  - Scenario Ref：拆分后子文件齐备

## 3. 上游来源标注与漂移防护

- [x] 3.1 [代码] `references/exploration-guidance.md` 头部标注上游来源（openspec-explore）
  - 文件：`src/core/templates/workflows/spec-explore.ts`
  - 验证：文件头部含来源标注
  - Spec Ref：`spec-workflow-skills / 上游衍生内容来源标注与漂移防护`
  - Scenario Ref：衍生内容标注来源

- [x] 3.2 [测试][功能][P1] 回归测试：spec_explore 主文件仍含 GATE PROTOCOL 引用、提示词校验门、功能流程图门、强制 checkpoint 体系指针
  - 文件：`test/template-consistency.test.ts`
  - 验证：断言通过
  - Spec Ref：`spec-workflow-skills / 上游衍生内容来源标注与漂移防护`
  - Scenario Ref：专有断言不因下沉丢失

## 4. 门预算与 grill 合并

- [x] 4.1 [代码] `iagent_spec_explore` 的 grill L1-L5 改为批量确认（L1-L3 一批、L4-L5 一批），保留最低深度 L3，用户"够了"可提前结束
  - 文件：`src/core/templates/workflows/spec-explore.ts`
  - 验证：grill 正文至多 2 次批量确认；最低深度 L3 保留
  - Spec Ref：`workflow-suite-skills / grill L1-L5 批量确认（≤2 批）`
  - Scenario Ref：两批确认
  - Scenario Ref：最低深度保持

- [x] 4.2 [代码] 定义门预算（每阶段 ≤1 阻塞确认门）并在 spec_explore 正文落实（提示词门并入 grill 首批或作为探索阶段唯一条件门；流程图门为流程级唯一阻塞门）
  - 文件：`src/core/templates/workflows/spec-explore.ts`
  - 验证：探索阶段阻塞门 ≤ 1
  - Spec Ref：`workflow-suite-skills / 每阶段至多一个阻塞确认门（门预算）`
  - Scenario Ref：探索阶段门数不超预算

- [x] 4.3 [测试][功能][P1] 门预算结构断言：按阶段统计阻塞门数量并锁定上限
  - 文件：`test/template-consistency.test.ts`
  - 验证：断言通过
  - Spec Ref：`workflow-suite-skills / 每阶段至多一个阻塞确认门（门预算）`
  - Scenario Ref：探索阶段门数不超预算

## 5. 实现桥合并

- [x] 5.1 [代码] `iagent_workflow` 把实现确认桥（3.7）与测试计划确认门（4.1）合并为单一「实现 + 测试桥」，一次呈现实现方案 + 测试计划，拒绝时同门给出回退选项
  - 文件：`src/core/templates/workflows/workflow.ts`
  - 验证：实现阶段仅一个阻塞门；拒绝出口含回退选项
  - Spec Ref：`workflow-suite-skills / 实现桥合并（实现确认 + 测试计划）`
  - Scenario Ref：单门呈现实现与测试计划
  - Scenario Ref：拒绝回退范围明确

- [x] 5.2 [代码] 复核 `iagent_auto_workflow`：其实现阶段为自动管线、无独立测试计划门（grep test plan / 测试计划 = 0），无需改动（N/A）
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 验证：auto-workflow 不再描述独立的测试计划门
  - Spec Ref：`workflow-suite-skills / 实现桥合并（实现确认 + 测试计划）`
  - Scenario Ref：实现阶段单门

- [x] 5.3 [测试][功能][P1] 断言 workflow 实现阶段阻塞门数量 ≤ 1
  - 文件：`test/template-consistency.test.ts`
  - 验证：断言通过
  - Spec Ref：`workflow-suite-skills / 每阶段至多一个阻塞确认门（门预算）`
  - Scenario Ref：实现阶段单门

## 6. 聚合一致性门直通语义

- [x] 6.1 [代码] `iagent_spec_explore` 的聚合一致性门（1.6.6）显式声明"无硬冲突自动直通（non-blocking），仅硬冲突暂停"
  - 文件：`src/core/templates/workflows/spec-explore.ts`
  - 验证：正文含直通语义；门未被删除
  - Spec Ref：`workflow-suite-skills / 聚合一致性门直通语义`
  - Scenario Ref：无冲突直通
  - Scenario Ref：硬冲突暂停

- [x] 6.2 [测试][功能][P1] 断言聚合一致性门仍存在且含直通语义
  - 文件：`test/template-consistency.test.ts`
  - 验证：断言通过
  - Spec Ref：`workflow-suite-skills / 聚合一致性门直通语义`
  - Scenario Ref：无冲突直通

## 7. 版本与快照

- [x] 7.1 [代码] `package.json` 版本递增至 6.2.0（技能模板行为变更 → minor）；`CHANGELOG.md` 归档 `[Unreleased]` 为 `## [6.2.0]` 并同步链接
  - 文件：`package.json`、`CHANGELOG.md`
  - 验证：版本与变更日志一致

- [x] 7.2 [代码] 运行 `pnpm build && pnpm generate:skills` 刷新 `skills/` 快照；`pnpm test` 全绿
  - 文件：`skills/`、`dist/`
  - 验证：`skills-parity` / `skill-size-budget` / 新增断言全部通过
  - Spec Ref：`spec-workflow-skills / spec-explore 主文件渐进披露与预算`
  - Scenario Ref：主文件在预算内

## 8. 已评估、判定无需运行时测试

- [x] 8.1 [测试][功能][P2] 评估：门合并（grill 批量、实现桥合并、聚合门直通）为运行时对话编排行为，仓库内无可驱动的运行时执行体（无 CLI 入口、无 HTTP 端点），无法在 vitest 中驱动。替代防线：以结构指标断言锁定门数量与关键词（4.3 / 5.3 / 6.2）。依据：纯 prompt 模板改造，与 `subagent-resource-sharing.test.ts` 既有判定同构。
  - Spec Ref：`workflow-suite-skills / 每阶段至多一个阻塞确认门（门预算）`
  - Scenario Ref：实现阶段单门
