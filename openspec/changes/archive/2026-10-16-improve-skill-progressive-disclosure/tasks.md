# Tasks: improve-skill-progressive-disclosure

<!-- 任务类型标签：[代码] / [DB脚本] / [使用说明]（默认产出至 attachments/） -->

## 1. 预算测试与目标清单

- [x] 1.1 [测试][单元][P0] 新增尺寸预算测试：断言每个技能主 SKILL.md 行数 ≤ 500（超限失败并列出违例技能）；断言主文件 `Read references/*.md` 引用与 `SkillTemplate.references` 一一对应
  - 文件：`test/skill-size-budget.test.ts`（新建）
  - 验证：以预算实现后运行全绿；重构前运行应列出超限清单（证明测试有效）
  - Spec Ref：`template-generation / SKILL.md 渐进披露与尺寸预算`
  - Scenario Ref：主文件尺寸预算
  - Scenario Ref：references 引用存在

- [x] 1.2 [测试][单元][P1] 新增语义零变化回归：对每个技能断言 `allowedTools`、确认门关键词、阶段编号在分层前后一致（以基线快照或基线哈希对照）
  - 文件：`test/skill-size-budget.test.ts`（扩展）
  - 验证：`pnpm test` 全绿
  - Spec Ref：`template-generation / SKILL.md 渐进披露与尺寸预算`
  - Scenario Ref：语义零变化

## 2. 高体积技能下沉（按行数降序）

- [x] 2.1 [代码] `proposal-review.ts`（832 行）下沉：把 8 维度检查矩阵、评分示例、语言/框架专项检查细则移入 `references/scoring.md`；主文件保留阶段骨架、确认门、Guardrails
  - 文件：`src/core/templates/workflows/proposal-review.ts`
  - 验证：主 SKILL.md ≤ 500 行；行为等价断言通过
  - Spec Ref：`template-generation / SKILL.md 渐进披露与尺寸预算`
  - Scenario Ref：控制流内容保留主文件

- [x] 2.2 [代码] `debug.ts`（571 行）下沉：把 L1-L5 风格排查细则、诊断记录长模板/示例移入 `references/debug-playbook.md`；主文件保留复现门、根因确认门、缺陷链路图门、委派清单
  - 文件：`src/core/templates/workflows/debug.ts`
  - 验证：主 SKILL.md ≤ 500 行；门与委派面不变
  - Spec Ref：`template-generation / SKILL.md 渐进披露与尺寸预算`
  - Scenario Ref：控制流内容保留主文件

- [x] 2.3 [代码] `spec-verify-proposal.ts`（557 行）与 `spec-apply.ts`（525 行）下沉：把 D1-D10 评分细则与示例、批调度长说明移入 `references/*.md`；主文件保留评分阈值、确认门、委派与派发清单
  - 文件：`src/core/templates/workflows/spec-verify-proposal.ts`、`spec-apply.ts`
  - 验证：两者主 SKILL.md ≤ 500 行；行为等价断言通过
  - Spec Ref：`template-generation / SKILL.md 渐进披露与尺寸预算`
  - Scenario Ref：控制流内容保留主文件

- [x] 2.4 [代码] B/B2 后仍超预算的编排技能（`workflow` / `auto-workflow` / `spec-explore`）按其最终正文下沉；若 B/B2 已将主文件降至预算内则跳过并记录
  - 文件：`src/core/templates/workflows/workflow.ts`、`auto-workflow.ts`、`spec-explore.ts`
  - 验证：主 SKILL.md ≤ 500 行（或记录已在预算内）
  - Spec Ref：`template-generation / SKILL.md 渐进披露与尺寸预算`
  - Scenario Ref：主文件尺寸预算
  - Scenario Ref：尺寸预算对被重写技能的最终形态生效

## 3. 快照、文档与回归

- [x] 3.1 [代码] 重新生成快照并人工审查 diff：`pnpm build && pnpm generate:skills`；`git diff skills/` 仅允许"主文件缩短 + references 新增"的位置移动，MUST NOT 含语义删除
  - 文件：`skills/`
  - 验证：`test/skills-parity.test.ts` 通过；diff 审查通过
  - Spec Ref：`template-generation / SKILL.md 渐进披露与尺寸预算`
  - Scenario Ref：语义零变化
  - Scenario Ref：references 随 update 同步无残留

- [x] 3.2 [代码] 文档同步：`AGENTS.md` 补充渐进披露约定（主文件预算 + references 判据）；`docs/skills-manual.md` 视需要说明
  - 文件：`AGENTS.md`、`docs/skills-manual.md`
  - 验证：人工核对与实现一致

- [x] 3.3 [代码] 全量回归与版本收尾：`pnpm build && pnpm test` 全绿；按守则 8 递增 `package.json` 版本（纯重构/文本分层 → patch 或 minor）并归档 `CHANGELOG.md`
  - 文件：`package.json`、`CHANGELOG.md`
  - 验证：`pnpm test` 全绿；CHANGELOG 生成新版本小节
  - Spec Ref：`template-generation / SKILL.md 渐进披露与尺寸预算`
  - Scenario Ref：主文件尺寸预算
