# Tasks: add-spec-bulk-archive

> 任务派生自 specs（spec-bulk-archive-skill / skill-profile delta）+ design 决策 D1-D10。
> 实现约束（exploration.md「目标项目规范要点」为绑定规范）：4 空格缩进、中文注释、venus_ 前缀、allowedTools 同步、模板改动后 build + generate:skills。

## 1. 模板文件移植

- [x] 1.1 [代码] 新建批量归档工作流模板：成对工厂 `getSpecBulkArchiveSkillTemplate()`（name `venus_spec_bulk_archive`、type `'spec'`、中文 description、allowedTools 含 Task 派发权限，D9）与 `getSpecBulkArchiveCommandTemplate()`（name `Venus: 批量归档`、tags `['venus', 'spec', 'archive', 'bulk']`），正文为同一份 11 步批量归档指令（源需求文档 6.1 节逐步骤表格为事实来源），按 D1-D5、D8 适配：变更发现 `venus spec status --json`、归档执行 `venus spec archive "<name>" --yes`、内联 AI 合并（ADDED/MODIFIED/REMOVED/RENAMED）、归档单元序列 a→a.5(CONTEXT.md)→b(CLI 归档)→b.5(探索记忆+需求文档迁移)、ARCHIVE-INDEX `[含<type>]` 注记、CLI 降级检测、CodeGraph status-first 预检与单次同步、三阶段分层并行（≤3 并发、失败隔离、子代理禁写索引/禁 sync）
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`（新增）
  - 验证：`pnpm build` 通过；文件头中文注释与 spec-archive.ts 风格一致；逐项对照源需求文档 6.1 节 11 步表格无遗漏
- [x] 1.2 [代码] 注册成对模板：import 新工厂并在 `WORKFLOW_PAIRS` 的 spec-archive 行后插入注册（含分组注释同步，若 spec 区段注释有数量描述则更新）
  - 文件：`src/core/templates/registry.ts`
  - 验证：`node bin/venus.js list` 输出包含 `venus_spec_bulk_archive`；`pnpm test -- templates` 派生断言通过
- [x] 1.3 [代码] DEPS 依赖注入新增 `'spec-bulk-archive': ['spec-verify']`（含表头注释同步：归档类工作流含 spec-archive 与 spec-bulk-archive，D6）
  - 文件：`src/core/profiles.ts`
  - 验证：`resolveWorkflows(['spec-bulk-archive'])` 返回含 `spec-verify` 的注入结果

## 2. 构建与快照

- [x] 2.1 [代码] 构建并生成 skills/ 静态快照（AGENTS.md 守则 1：改模板后必须执行）
  - 命令：`pnpm build && pnpm generate:skills`
  - 验证：`skills/venus_spec_bulk_archive/SKILL.md` 生成且 frontmatter 含 name/description/allowed-tools/metadata.type=spec；`pnpm test -- skills-parity` 通过

## 3. 测试同步

- [x] 3.1 [代码] 更新模板注册表测试：内置技能计数 22→23（spec 类 6→7）、新增 `venus_spec_bulk_archive` 的 commandId 派生断言（`spec-bulk-archive`）
  - 文件：`test/templates.test.ts`
  - 验证：`pnpm test -- templates` 全部通过
- [x] 3.2 [代码] 新增 DEPS 注入测试：`spec-bulk-archive` 注入 `spec-verify`、与 `spec-verify` 齐备时不重复注入
  - 文件：`test/profiles.test.ts`
  - 验证：`pnpm test -- profiles` 全部通过
- [x] 3.3 [代码] 核对 allowed-tools 回归：确认新模板 allowedTools 覆盖正文命令（含 Task 派发，D9 待确认项在此闭环——若 Task 不在测试允许清单则按测试规则调整字段）
  - 文件：`test/allowed-tools.test.ts`（若清单需扩展则更新，否则仅验证）
  - 验证：`pnpm test -- allowed-tools` 通过

## 4. Dogfood 接入

- [x] 4.1 [代码] `.venus/config.yaml` 的 workflows 列表增补 `spec-bulk-archive`（D10）
  - 文件：`.venus/config.yaml`
  - 验证：`node bin/venus.js config show` 生效集含 `spec-bulk-archive` 且含注入项 `spec-verify`
- [x] 4.2 [代码] 生成 dogfood 产物至 `.claude/`（skills 目录 + 命令文件）
  - 命令：`node bin/venus.js update`（或等价 init 路径）
  - 验证：`.claude/skills/venus_spec_bulk_archive/SKILL.md` 与 `.claude/commands/venus/spec-bulk-archive.md` 存在且与快照一致

## 5. 全量验证

- [x] 5.1 [代码] 全量测试 + lint
  - 命令：`pnpm test && pnpm lint`
  - 验证：全部用例通过、无 lint 错误
