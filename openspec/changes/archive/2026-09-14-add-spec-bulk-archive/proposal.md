# 变更提案：add-spec-bulk-archive

> 从 E:\github\OpenSpec 迁移 bulk-archive 批量归档工作流模板到本项目（完整链路迁移）。
> 事实来源：[源需求文档](attachments/source-feature-doc/bulk-archive_需求文档.md) + 用户确认的蒸馏核心功能清单（19 项，见 [exploration.md](exploration.md)）。

## Why

spec 生命周期现有 `venus:spec-archive` 仅支持单变更归档（spec-archive.ts:20-29 单选提示）。并行开发场景下（本项目自身 dogfood 即有多个并行变更），逐一归档效率低，且多个变更触碰同一 capability 时主规格合并存在冲突风险（手工逐个归档无法全局检测跨变更冲突）。

源项目 OpenSpec 已实现成熟的批量归档工作流模板（`src/core/templates/workflows/bulk-archive-change.ts`，793 行，11 步指令含冲突智能解决、三阶段分层并行、失败隔离、索引单点更新），本项目 tr-impl-* 系列即由此前同源迁移而来。本变更将该模板完整迁移至本项目模板体系，对齐 venus CLI 与本项目归档惯例（CLI 归档命令、内联 AI 合并、CONTEXT.md 检查点、索引注记）。

## What Changes

1. **新增工作流模板** `src/core/templates/workflows/spec-bulk-archive.ts`：`getSpecBulkArchiveSkillTemplate()` + `getSpecBulkArchiveCommandTemplate()` 成对工厂，skill 名 `venus_spec_bulk_archive`（自动派生命令 id `spec-bulk-archive`，即 `venus:spec-bulk-archive`）。指令文本迁移源项目 11 步批量归档工作流并按目标项目适配：
   - 变更发现：`venus spec status --json`（无 --change 时列全部活跃变更）
   - 归档执行：`venus spec archive "<name>" --yes`（替代源 mkdir+mv，对齐目标惯例）
   - spec 同步：内联 AI 合并（ADDED/MODIFIED/REMOVED/RENAMED，v1.1.20 specs-apply 语义，对齐 spec-archive 步骤 4）
   - 新增目标项目强制检查点：CONTEXT.md Sync（对齐 spec-archive 4.5）
   - ARCHIVE-INDEX 条目增加 `[含<type>]` 补充注记（对齐目标惯例）
   - 保留源核心语义：CLI 降级检测、CodeGraph status-first 预检、批量状态收集（并行只读子代理 ≤3）、冲突检测与智能解决（代码库证据三分支）、三阶段分层并行归档（≤3 并发、失败隔离）、探索记忆同步、索引主代理单点更新、CodeGraph 项目级单次同步
2. **注册**：`src/core/templates/registry.ts` 的 `WORKFLOW_PAIRS` 在 spec-archive 行后插入成对注册（本项目唯一登记点，config/reconcile/init/update 自动派生）
3. **依赖注入**：`src/core/profiles.ts` 的 `DEPS` 新增 `'spec-bulk-archive': ['spec-verify']`（对齐 spec-archive 的归档前验证依赖，即源项目"bulk-archive 依赖 sync"的目标等价物）；DEFAULT_WORKFLOWS 不变（忠实源项目"非核心工作流"定位）
4. **测试同步**：`test/templates.test.ts`（计数 22→23、commandId 派生断言）、`test/profiles.test.ts`（DEPS 注入断言）、`skills/venus_spec_bulk_archive/SKILL.md` 快照（`pnpm build && pnpm generate:skills`）
5. **Dogfood**：`.venus/config.yaml` workflows 增补 `spec-bulk-archive`，`.claude/` 产物同步生成

## Capabilities

### New Capabilities

- `spec-bulk-archive-skill`: 批量归档工作流技能——单次操作批量归档多个已完成变更（多选、批量状态收集、spec 冲突智能解决、并行归档、索引更新、CodeGraph 同步）

### Modified Capabilities

- `skill-profile`: DEPS 依赖注入规则表新增 `spec-bulk-archive ⇒ spec-verify` 注入条目（漏选归档前验证时自动补全）

## Impact

### 直接影响的文件

- `src/core/templates/workflows/spec-bulk-archive.ts`: 新增（模板定义，约 700+ 行，含成对工厂）
- `src/core/templates/registry.ts`: WORKFLOW_PAIRS 新增 1 行注册 + import
- `src/core/profiles.ts`: DEPS 表新增 1 条目（含注释同步）
- `test/templates.test.ts`: 计数断言与派生断言更新
- `test/profiles.test.ts`: DEPS 注入测试新增
- `skills/venus_spec_bulk_archive/SKILL.md`: 新增（generate:skills 生成）
- `.venus/config.yaml`: workflows 增补 1 项
- `.claude/skills/venus_spec_bulk_archive/` 与 `.claude/commands/venus/spec-bulk-archive.md`: dogfood 产物生成

### 向后兼容

无破坏性变更。新增技能与注册项均为增量；DEFAULT_WORKFLOWS 不变故未配置 workflows 的项目行为不变；现有 22 个技能的注册顺序不受影响（新条目插在 spec 区段末尾）。
