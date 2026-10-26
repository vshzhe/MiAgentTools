# Tasks: add-tr-migration-suite

> 批次依赖：批 1 → 批 2（3 任务并发）→ 批 3（2 任务并发）→ 批 4（2 任务并发）→ 批 5（串行）。
> 全部任务遵循 `exploration.md` → `## 目标项目规范要点`（BINDING）：4 空格缩进、行宽 ≤120、双引号、分号、中文注释、方法间空行。

## 1. 类型体系扩展

- [x] 1.1 [代码] SKILL_TYPES 新增第 9 类 `tr_docs`
  - 文件：`src/core/config.ts`
  - 内容：`SkillType` 联合类型加 `'tr_docs'`；`SKILL_TYPES` 注册表在 `tr_tools` 后插入 `{ id: 'tr_docs', name: '文档', description: '文档生成：源项目扫描、功能需求文档、功能地图' }`
  - 验证：`pnpm build` 编译通过；`SKILL_TYPE_IDS` 含 9 项

## 2. 三技能模板文件（迁移核心，3 任务并发）

- [x] 2.1 [代码] 新建 feature-doc 技能模板（源 feature-doc-generator.ts 迁移）
  - 文件：`src/core/templates/workflows/tr-docs-feature-doc.ts`（新建）
  - 内容：导出 `getTrDocsFeatureDocSkillTemplate()`（name `venus_tr_docs_feature_doc`、type `tr_docs`、allowedTools 见 design D6、license MIT、正文=源 instructions 逐段迁移+适配）与 `getTrDocsFeatureDocCommandTemplate()`（name 目标风格、category Workflow、tags 沿用、content=源命令正文迁移+适配）。适配项：`openspec-feature-doc-generator` 引用按上下文改写、`/opsx:requirement-doc` NOT-for 引用删除（design Non-Goals）、CodeGraph 工具名保留
  - 验证：`pnpm build` 编译通过；全文无 `openspec-` 前缀技能名、无 `/opsx:` 引用残留
- [x] 2.2 [代码] 新建 migration-check 技能模板（源 migration-checker.ts 迁移）
  - 文件：`src/core/templates/workflows/tr-impl-migration-check.ts`（新建）
  - 内容：导出 `getTrImplMigrationCheckSkillTemplate()`（name `venus_tr_impl_migration_check`、type `tr_impl`）与 `getTrImplMigrationCheckCommandTemplate()`。正文=源 instructions/content 逐段迁移；C1-C6 对抗检查、六层对比、报告树 14 文档、P0/P1/P2 分级、写回验证全部保留；输出路由中 change 上下文路径保留
  - 验证：`pnpm build` 编译通过；无 `openspec-` / `/opsx:` 残留
- [x] 2.3 [代码] 新建 auto-migration 技能模板（源 auto-migration.ts 迁移）
  - 文件：`src/core/templates/workflows/tr-impl-auto-migration.ts`（新建）
  - 内容：导出 `getTrImplAutoMigrationSkillTemplate()`（name `venus_tr_impl_auto_migration`、type `tr_impl`）与 `getTrImplAutoMigrationCommandTemplate()`。正文四阶段全部保留；适配：子技能名改 `venus_tr_docs_feature_doc` / `venus_tr_impl_migration_check`、CLI 循环改 `venus spec status` / `venus spec instructions`、`/opsx:workflow` 镜像引用改 spec 工作流链、C11/C12 语言无关化（design D4）、B组检查保留
  - 验证：`pnpm build` 编译通过；蒸馏清单 4 项能力在正文逐项可对应；无 `openspec-` / `/opsx:` 残留

## 3. 注册与依赖注入

- [x] 3.1 [代码] registry 注册三对模板
  - 文件：`src/core/templates/registry.ts`
  - 内容：import 三个新模板文件的 6 个导出函数；WORKFLOW_PAIRS 在 `tr_tools` 组之后、spec 组之前按类型分区插入三对（design D9）
  - 验证：`getSkillTemplates()` 返回 17 项；`deriveCommandId('venus_tr_docs_feature_doc') === 'tr-docs-feature-doc'`
- [x] 3.2 [代码] DEPS 新增 auto-migration 依赖注入
  - 文件：`src/core/profiles.ts`
  - 内容：DEPS 表加 `'tr-impl-auto-migration': ['tr-docs-feature-doc', 'tr-impl-migration-check']`，注释标注 Phase 1/4 依赖来源；DEFAULT_WORKFLOWS 不动
  - 验证：`resolveWorkflows(['tr-impl-auto-migration'])` 返回 3 项含 2 注入项

## 4. 测试同步

- [x] 4.1 [代码] templates/allowed-tools 测试断言同步
  - 文件：`test/templates.test.ts`、`test/allowed-tools.test.ts`（按现有断言结构）
  - 内容：注册表数量/新 commandId 派生/新技能 allowedTools 非空与格式断言；SKILL_TYPES 9 类断言（若有硬编码数量）
  - 验证：`pnpm test -- templates` 相关用例通过
- [x] 4.2 [代码] profiles 注入规则测试用例
  - 文件：`test/profiles.test.ts`
  - 内容：新增用例——漏选两子技能全注入 / 已含一项仅补缺失项 / 无 auto-migration 不注入
  - 验证：`pnpm test -- profiles` 通过

## 5. 构建、快照与收尾（串行）

- [x] 5.1 [代码] 全量构建 + 快照再生成 + dogfood
  - 命令：`pnpm build && pnpm generate:skills`
  - 产出：`skills/venus_tr_docs_feature_doc/`、`skills/venus_tr_impl_migration_check/`、`skills/venus_tr_impl_auto_migration/` 快照 + `.claude/` dogfood 产物
  - 验证：`pnpm test` 全绿（重点 skills-parity / allowed-tools / templates / profiles）；`git status` 显示新快照目录
- [x] 5.2 [使用说明] CHANGELOG Unreleased 补记
  - 文件：`CHANGELOG.md`
  - 内容：Added 段记录三技能迁移（命名、类型、DEPS 注入、非默认集说明）
  - 验证：人工核对格式与既有条目一致

## 6. 迁移检查修复轮（Phase 4，用户已确认）

- [x] 6.1 [代码] P1-1 修复：替换源机制名残留
  - 文件：`src/core/templates/workflows/tr-impl-auto-migration.ts` + 快照再生成
  - 内容：「1.2.1.5 Multi-Project CodeGraph Agent Scan」→「CodeGraph-first scanning (per the codegraph_status-first rule)」表述（exploration.md 决策补执行）
  - 验证：grep 无 1.2.1.5 / Multi-Project 残留
- [x] 6.2 [代码] P2-1 修复：CLI 降级签名删除不存在的 `venus spec list` 引用
  - 文件：同上 + 快照再生成
  - 内容：降级探测仅保留 `venus spec status`
  - 验证：grep 无「spec list」残留；`pnpm build && pnpm generate:skills` 后快照一致、全量测试绿
