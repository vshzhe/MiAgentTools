# Proposal: add-tr-migration-suite

> 来源：源项目 `E:\github\OpenSpec`（v1.9.5）三技能迁移；源需求文档见 `attachments/source-feature-doc/迁移技能套件_关联分析.md`；蒸馏核心功能清单（用户已确认）见 `exploration.md`。

## Why

VenusAgentTools 当前 14 个技能（8 个生命周期类型）覆盖项目内开发闭环（初始化/实现/测试/提交/审查/发布/工具/spec 工作流），但缺少**跨项目功能迁移**能力：用户把存量项目（典型为 Java Web 单体）的功能迁到新栈时，没有标准化的「扫描源项目 → 生成需求文档 → 提案 → 实现 → 迁移一致性检查」流水线，只能人工比对。

源项目 OpenSpec（v1.9.5）已有成熟迁移三件套：feature-doc（源项目扫描成需求文档）、migration-check（六层一致性检查）、auto-migration（一站式编排）。本变更经 `/opsx:auto-migration` 流程将三技能迁移入本项目技能体系（迁移需求文档 + 蒸馏清单已获用户确认，命名与语义适配已裁决）。

## What Changes

- **新增技能模板 3 个**（源迁移 + 语言无关化适配，源项目三功能正文行为全部保留）：
  - `venus_tr_docs_feature_doc` → 指令 `tr-docs-feature-doc`（**新增第 9 类型 `tr_docs`「文档」**）
  - `venus_tr_impl_migration_check` → 指令 `tr-impl-migration-check`（归现有 `tr_impl` 类型）
  - `venus_tr_impl_auto_migration` → 指令 `tr-impl-auto-migration`（归现有 `tr_impl` 类型）
- **注册与类型**：`registry.ts` WORKFLOW_PAIRS 注册 3 对；`config.ts` SKILL_TYPES 8 → 9 类（新增 `tr_docs`）
- **依赖注入**：`profiles.ts` DEPS 新增 `tr-impl-auto-migration ⇒ [tr-docs-feature-doc, tr-impl-migration-check]`（编排技能依赖两子技能）
- **正文生态适配**：技能互调名（openspec-* → venus_tr_*）、命令引用（/opsx: → /venus:）、CLI 引用（openspec status/instructions → venus spec status/instructions，ADR-0001 自研命令组）、`/opsx:workflow` 镜像引用改指 spec 工作流链、C11/C12 检查示例语言无关化；内置 3 个 Java 框架档案（Venus4A/Spring MVC/Struts）保留
- **快照与 dogfood**：`skills/` 快照 + `.claude/` 产物经 `pnpm build && pnpm generate:skills` 再生成；CHANGELOG Unreleased 补记
- **DEFAULT_WORKFLOWS 不变**：三技能为可选扩展件（与源项目 CORE_WORKFLOWS 不含三者的定位一致），用户经 `.venus/config.yaml` 的 `workflows` 勾选安装或由依赖注入带入

## Capabilities

### New Capabilities

- `tr-migration-skills`: 迁移三件套技能——源项目功能扫描与需求文档生成（feature-doc）、迁移后六层一致性检查（migration-check）、一站式迁移编排（auto-migration）的模板定义、类型归属、注册与正文适配

### Modified Capabilities

- `skill-profile`: 依赖注入规则表新增 `tr-impl-auto-migration ⇒ [tr-docs-feature-doc, tr-impl-migration-check]`（选编排技能漏选子技能时自动补全）

## Impact

### 直接影响的文件

- `src/core/templates/workflows/tr-docs-feature-doc.ts`: 新建（技能+指令模板对，源 feature-doc-generator 迁移）
- `src/core/templates/workflows/tr-impl-migration-check.ts`: 新建（源 migration-checker 迁移）
- `src/core/templates/workflows/tr-impl-auto-migration.ts`: 新建（源 auto-migration 迁移）
- `src/core/templates/registry.ts`: import 3 对新模板 + WORKFLOW_PAIRS 注册
- `src/core/config.ts`: SKILL_TYPES 新增 `tr_docs` 条目
- `src/core/profiles.ts`: DEPS 新增注入规则
- `skills/venus_tr_docs_feature_doc/`、`skills/venus_tr_impl_migration_check/`、`skills/venus_tr_impl_auto_migration/`: 快照再生成（`pnpm generate:skills`）
- `.claude/skills/`、`.claude/commands/venus/`: dogfood 产物再生成
- `CHANGELOG.md`: Unreleased 段补记
- `test/templates.test.ts`、`test/profiles.test.ts`、`test/allowed-tools.test.ts`、`test/skills-parity.test.ts`: 断言同步（数量/新规则/新技能校验）

### 向后兼容

无破坏性变更。现有 14 个技能、默认集（7 项）、`venus init`/`update` 对既有项目的产物完全不变；新技能不进默认集，未勾选时不生成任何文件。`SKILL_TYPES` 扩展为纯新增（第 9 类），`countSkillsByType` 等遍历逻辑自动兼容。
