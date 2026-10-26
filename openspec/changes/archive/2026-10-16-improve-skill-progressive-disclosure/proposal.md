## Why

20 个技能的 SKILL.md 合计 497 KB，其中 `iagent_workflow` 单文件 **81.9 KB / 1660 行**、`iagent_proposal_review` 832 行、`iagent_auto_workflow` 644 行——触发一次即全量占用上下文，与 Agent Skills 的**渐进披露**（主文件精炼、明细按需 `Read`）设计相悖（探索记录见 `openspec/explorations/progressive-disclosure-explore-001.md`，整体根因见 `skill-system-review-explore-001.md` 的 P1）。

现有 `spec-workflow-skills / SKILL 模板 references 机制启用` 只要求 **spec-*** 技能把 **>50 行**的独立文本段移入 `references/`，且**无主文件尺寸预算、无回归测试**。本变更把渐进披露推广到全部技能，并建立可测试的尺寸预算。

**次序**：本变更的尺寸预算对 B（`refactor-orchestrator-propose-delegation`）与 B2（`refactor-orchestrator-explore-delegation`）之后的技能形态生效——建议实现次序 **A → B → B2 → C**，避免 B/B2 重写已下沉的正文造成返工。

## What Changes

1. **主 SKILL.md 尺寸预算**：主文件行数 SHALL ≤ **500 行**（软预算）。超限技能 MUST 在本变更内重构至预算内。
2. **内容分层判据**：主文件 MUST 保留"看到即需执行"的**控制流内容**（触发条件 / 阶段骨架 / 确认门 / 委派清单 / Guardrails）；参考性内容（评分维度细则、检查矩阵与评分示例、L1-L5 问句库、长代码/模板示例、字段级表格）MUST 下沉 `references/<topic>.md`，主文件以一行 `Read references/<topic>.md` 引导按需加载。
3. **落地既有机制**：下沉走 `SkillTemplate.references`（`references/*.md`），复用既有 `writeSkillReferences` / `syncReferences`（随 `init`/`update` 同步），MUST NOT 引入新机制。
4. **尺寸预算与 references 存在性测试**：断言主 SKILL.md ≤ 预算；断言主文件引用的每个 `references/*.md` 实际存在；断言 references 随 `update` 无残留同步。
5. **语义零变化**：MUST NOT 改动任何技能的 allowedTools 白名单、确认门、阶段行为或委派面；仅移动文本位置。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `template-generation`: 新增"主 SKILL.md 尺寸预算与渐进披露"要求——主文件保留控制流、明细下沉 `references/`、预算可测试；推广既有 spec-* 的 references 机制到全部技能。

## Impact

### 直接影响的文件

- `src/core/templates/workflows/*.ts`: 超预算技能（`proposal_review` / `debug` / `spec_verify_proposal` / `spec_apply`；`workflow` / `auto_workflow` 视 B/B2 后尺寸）拆分 `instructions`，新增 `references`
- `test/`: 尺寸预算与 references 存在性测试
- `skills/`: 快照重新生成（`pnpm build && pnpm generate:skills`）
- 文档：`docs/skills-manual.md`/`AGENTS.md` 可能需说明分层约定

### 向后兼容

- **行为零变化**：仅文本位置从主文件移到 `references/`，技能语义、确认门、白名单、委派面不变。
- **`iagent update`**：既有 `syncReferences` 先删旧 `references/` 再写新，无残留；手改保护基于内容指纹，不受影响。
- **[待确认]** 预算量纲（500 行 vs 20 KB）与临界技能（`spec_bulk_archive` 455 行）是否纳入——默认仅纳入超预算者。
