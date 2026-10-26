# spec-workflow-skills Specification (Delta)

> 修改：`模板单一源派生规则` —— 其**作用域由 `src/core/templates/workflows/spec-*.ts` 扩为 `spec-*.ts` + `tr-init.ts`**。实测 `deriveCommandContent` 目前仅被 7 个 `spec-*.ts` 使用，全部 18 个 `tr-*.ts` 模板均为手工双写；本次仅将 `tr-init.ts` 纳入派生（增量迁移第二步，沿用 2026-09-14 只改 spec-* 的先例），其余 17 个 `tr-*.ts` 仍为手工双写、留待后续变更。新增场景覆盖非 spec 前缀模板的派生一致性。
>
> MODIFIED 需求须含完整更新内容。

## MODIFIED Requirements

### Requirement: 模板单一源派生规则

VenusAgentTools 的 `src/core/templates/workflows/spec-*.ts` 中每个 spec 工作流模板正文，**以及 `src/core/templates/workflows/tr-init.ts`**，SHALL 仅维护 `SkillTemplate.instructions` 一份作为唯一源；`CommandTemplate.content` SHALL 由代码派生函数从 `instructions` 生成（派生策略：段落级 HTML 注释标记裁剪——以成对注释标记 `<!-- CMD:SKIP -->` / `<!-- /CMD:SKIP -->` 划定仅 skill 版可见的段落，未标记段落默认保留进 command 版；禁用 LLM 生成与模板变量替换引擎），不再手工双写两份 markdown 字符串。派生规则 SHALL fail-safe：派生函数处理 `instructions` 时遇到未显式标记为 skill-only 的段落，该段落默认进入 command 版（即默认双向可见），防止漏标导致防护语句在 command 版缺失（既有漂移的直接教训）。

**作用域说明（陈述性）**：本规则的作用域为 `spec-*.ts` **加 `tr-init.ts`** 共 8 个模板。其余 17 个 `tr-*.ts` 模板（`tr-impl*` / `tr-test` / `tr-commit*` / `tr-review` / `tr-release` / `tr-tools` / `tr-docs-*`）在本规则约束范围之外，仍以手工双写形式存在；将其纳入派生须由独立的后续变更实施，MUST NOT 由本规则的实施顺带扩大。

#### Scenario: command content 由派生函数生成
- **WHEN** spec-*.ts 或 tr-init.ts 工作流模板注册到 WORKFLOW_PAIRS
- **THEN** `SkillTemplate.instructions` 作为唯一源手工维护，`CommandTemplate.content` SHALL 由代码派生函数从 `instructions` 生成；不存在两份独立维护的 markdown 字符串

#### Scenario: fail-safe 默认（未标记段落进入 command 版）
- **WHEN** 派生函数处理 `SkillTemplate.instructions` 时遇到未显式标记为 `skill-only` 的段落
- **THEN** 该段落默认进入 command 版（默认双向可见），防止漏标导致防护语句在 command 版缺失

#### Scenario: 唯一源修改后 command 版自动同步
- **WHEN** `SkillTemplate.instructions` 的某段正文被修改（如新增防护语句）
- **THEN** 下次 `pnpm build && pnpm generate:skills` 重新生成技能快照时 `CommandTemplate.content` MUST 自动反映该修改，无需手工同步 command 版字符串；模板派生一致性测试（替代人工双写核对）MUST 通过

#### Scenario: 非 spec 前缀模板纳入派生
- **WHEN** `tr-init.ts` 的模板注册到 WORKFLOW_PAIRS
- **THEN** 其 `CommandTemplate.content` SHALL 由派生函数从 `SkillTemplate.instructions` 生成；派生一致性测试 SHALL 覆盖该模板，源码中 MUST NOT 存在第二份手工维护的同名正文字符串

#### Scenario: 未纳入派生的 tr-* 模板不受影响
- **WHEN** 实施本规则后检查其余 17 个 `tr-*.ts` 模板
- **THEN** 它们仍以既有手工双写形式存在，其正文与产物 MUST NOT 因本规则的实施而被改动

## ADDED Requirements

无。

## REMOVED Requirements

无。

## RENAMED Requirements

无。
