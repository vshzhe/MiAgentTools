## Why

VenusAgentTools 的 `spec` 生命周期已有 6 个**单环节**技能（explore / propose / verify-proposal / apply / archive / verify），`tr_` 迁移件已有 3 个（tr-docs-feature-doc / tr-impl-migration-check / tr-impl-auto-migration），但缺少**工作流编排类**能力：把探索→提案→验证串联的一站式引导、验证通过后自动 apply+archive 的全自动管线、bug 调试闭环、变更提案转评审需求文档、提案完整性复查。源项目 OpenSpec 沉淀了这五个技能（workflow 1526 行 / auto-workflow 521 行 / debug 406 行 / create-requirement-doc 241 行 + 用户全局目录的 proposal-review 定制版 979 行），且上次迁移（add-tr-migration-suite）因目标无对应物删除了 `/opsx:requirement-doc`、`/opsx:workflow` 引用——本次补齐后可恢复完整生态。另外 `venus_spec_propose` SKILL.md:138 引用的 `openspec/rules/artifact-generation.md` 共享协议在目标项目中不存在（悬空引用），需一并补齐。

## What Changes

- 新增 5 对「技能+指令」模板（用户裁决命名，均归现有 SkillType，不新增类型）：
  - `venus_tr_impl_workflow` → `/venus:tr-impl-workflow`（引导工作流：结构化探索 checkpoint 体系 → 提案内联生成 → 自动验证 → 深度复查+需求文档；探索文件迁移后**保留源文件**）
  - `venus_tr_impl_auto_workflow` → `/venus:tr-impl-auto-workflow`（全自动管线：Phase 1-3 同构 + auto-apply（auto-mode=true）+ auto-archive）
  - `venus_tr_impl_debug` → `/venus:tr-impl-debug`（一站式调试：强制复现 → CodeGraph 分层排查+根因确认门 → 关联变更判定 → 修复+强制回归测试 → 调试循环 → 汇总编译/同步/验证）
  - `venus_tr_docs_requirement_doc` → `/venus:tr-docs-requirement-doc`（变更提案 → 八章节评审需求文档；双执行模式；归档状态输出路由；伪代码注入规则）
  - `venus_tr_impl_review_proposal` → `/venus:tr-impl-review-proposal`（提案完整性复查：深度代码库探索 + 8 维度完整性检查 + 合规性验证 + 量化评分；语言无关化+保留 Java 专项）
- 正文生态引用替换（零猜测迁移）：`openspec status/instructions/new` → `venus spec status/instructions/new`；`openspec-verify-before-apply` → `venus_spec_verify_proposal`；`openspec-apply-change`/`openspec-archive-change` → `venus_spec_apply`（auto-mode 契约一致）/`venus_spec_archive`；CLI 降级探测命令改为 `venus spec status`
- 验证 PASS 后深度复查对接：调 `venus_tr_impl_review_proposal` 技能（技能为主），技能不可用 fallback 内联深度复查（对齐 venus_spec_propose 既有模式）
- `src/core/templates/registry.ts`：WORKFLOW_PAIRS 注册 5 对
- `src/core/profiles.ts`：DEPS 新增 5 技能依赖注入规则（DEFAULT_WORKFLOWS **不纳入**，与上次迁移一致）
- 新建 `openspec/rules/artifact-generation.md`（迁移源项目共享协议 G1-G3，CLI 命令改为 venus spec；同时修复 venus_spec_propose SKILL.md:138 悬空引用）
- 联动恢复引用：`tr-docs-feature-doc` 与 `tr-impl-auto-migration` 模板中被删除的 `/opsx:requirement-doc`、`/opsx:workflow` 引用 → 指向 `/venus:tr-docs-requirement-doc`、`/venus:tr-impl-workflow`
- 测试同步（skills-parity / templates / allowed-tools / profiles）+ `CHANGELOG.md` 补记

## Capabilities

### New Capabilities
- `tr-workflow-suite-skills`: 5 个工作流类技能的完整行为——tr-impl-workflow（结构化探索 checkpoint 体系 + 内联制品生成 + 自动验证门 + 深度复查与需求文档联动）、tr-impl-auto-workflow（+auto-apply/auto-archive 全自动管线与错误处理规则）、tr-impl-debug（复现-排查-关联-修复-循环-收尾调试闭环）、tr-docs-requirement-doc（八章节映射转换 + 伪代码注入 + 归档状态路由）、tr-impl-review-proposal（8 维度完整性检查 + 合规性验证 + 量化评分）
- `artifact-generation-protocol`: openspec/rules/artifact-generation.md 共享制品生成协议（G1 创建变更目录 → G2 依赖序循环 status/instructions → G3 终态确认；context/rules 为 AI 约束不写入输出；供 tr-impl-workflow / venus_spec_propose 共同引用）

### Modified Capabilities
- `skill-profile`: profiles.ts DEPS 新增依赖注入规则——`tr-impl-auto-workflow ⇒ [tr-impl-workflow, tr-docs-requirement-doc]`、`tr-impl-workflow ⇒ [tr-impl-review-proposal, tr-docs-requirement-doc]`、`tr-impl-debug ⇒ [tr-docs-requirement-doc, spec-verify-proposal]`（漏选依赖时自动补全并提示；DEFAULT_WORKFLOWS 默认集不变）

## Impact

### 直接影响的文件

- `src/core/templates/workflows/tr-impl-workflow.ts`: 新建（技能+指令模板对）
- `src/core/templates/workflows/tr-impl-auto-workflow.ts`: 新建
- `src/core/templates/workflows/tr-impl-debug.ts`: 新建
- `src/core/templates/workflows/tr-docs-requirement-doc.ts`: 新建
- `src/core/templates/workflows/tr-impl-review-proposal.ts`: 新建
- `src/core/templates/registry.ts`: WORKFLOW_PAIRS 注册 5 对 + import
- `src/core/profiles.ts`: DEPS 新增 3 条注入规则
- `openspec/rules/artifact-generation.md`: 新建（共享协议）
- `src/core/templates/workflows/tr-docs-feature-doc.ts`、`src/core/templates/workflows/tr-impl-auto-migration.ts`: 联动恢复 /opsx:requirement-doc、/opsx:workflow 引用
- `test/templates.test.ts`、`test/allowed-tools.test.ts`、`test/profiles.test.ts`: 注册与白名单断言同步
- `CHANGELOG.md`: Unreleased 段补记
- `skills/` 快照 + `.claude/skills/` + `.claude/commands/venus/`: `pnpm build && pnpm generate:skills` 再生成

### 向后兼容

无破坏性变更（**无 BREAKING**）——WORKFLOW_PAIRS 追加条目、DEPS 追加规则均为增量；DEFAULT_WORKFLOWS 不变（现有安装行为不变，新技能经 `.venus/config.yaml` workflows 字段勾选）；venus_spec_propose 的悬空引用修复为向后兼容的正确化。
