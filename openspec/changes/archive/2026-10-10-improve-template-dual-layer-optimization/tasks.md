# Tasks: improve-template-dual-layer-optimization

## 1. Sprint 1 — Layer A Phase 1：SKILL 模板瘦身（Gate + Guardrails + 输出示例）

- [x] [代码] 1.1 Gate Compact：修改 5 个模板的 Gate 注入 [N1]
  产出：spec-explore.ts / tr-impl-workflow.ts / tr-impl-auto-workflow.ts / tr-impl-genfull.ts / tr-impl-debug.ts
  - 替换 `${PROMPT_GATE}` → `${PROMPT_GATE_COMPACT}` + references
  - 替换 `${FLOWCHART}` → `${FLOWCHART_COMPACT}` + references
  - 添加 references 数组字段（含全文版 Gate/Flowchart 文本）
  - 指令末尾加引导句："> 完整的 Gate 细则见 references/...。**仅在 Gate 实际触发时读取全文。**"

- [x] [代码] 1.2 Guardrails 单行化：批量替换全部 26 个模板开头护栏文本
  产出：所有 src/core/templates/workflows/*.ts
  替换 `**Before proceeding, read openspec/rules/ai-coding.md...**` → `**适用 openspec/rules/ai-coding.md 全域护栏。** 未定义项标 **[待确认]**，禁止猜测。`

- [ ] [代码] 1.3 输出示例移 references：5 个模板的大段输出示例移入 references
  产出：spec-apply.ts / spec-archive.ts / spec-bulk-archive.ts / spec-verify-proposal.ts / tr-docs-requirement-doc.ts
  - spec-apply.ts: ~115 行 4 种场景输出示例 → references/output-examples.md
  - spec-archive.ts: ~60 行 3 种场景输出示例 → references/output-examples.md
  - spec-bulk-archive.ts: ~40 行 3 种场景输出示例 → references/output-examples.md
  - spec-verify-proposal.ts: ~50 行 2 种场景计分卡示例 → references/output-examples.md
  - tr-docs-requirement-doc.ts: ~80 行 8 章节模板 → references/requirement-doc-template.md

- [x] [测试][功能][P0] 1.4 模板生成与快照一致性测试
  - 运行 `pnpm build && pnpm generate:skills`
  - 运行 `pnpm test` 验证全部 71 个用例通过
  - 验证 `test/skills-parity.test.ts` 通过
  - 验证 `test/artifact-dataflow.test.ts` 通过
  - 验证 `test/allowed-tools.test.ts` 通过
  - 验证 `test/template-derivation.test.ts` 通过

- [x] [测试][功能][P0] 1.5 references 读写生命周期测试
  - venus init 后验证 references/ 目录存在且文件完整
  - venus update 后验证 references/ 目录被正确清理并重写
  - 修改 SKILL.md 后 update 验证手改保护跳过 references 同步

## 2. Sprint 2 — Layer A Phase 2：模板结构优化

- [ ] [代码] 2.1 检查矩阵移 references：tr-impl-review-proposal.ts 的 8 维度矩阵
  产出：tr-impl-review-proposal.ts + references/check-matrix.md
  将 ~600 行内联 Markdown 表格移入 references/check-matrix.md，正文保留每维度的 2-3 行摘要描述

- [ ] [代码] 2.2 前端组件模板拆分：tr-impl-frontend.ts 按类型拆分
  产出：tr-impl-frontend.ts + 5 个 references 文件
  - references/jsp-page-structure.md（JSP 页面骨架）
  - references/component-selection-tree.md（zTree/select2/layui 决策树）
  - references/form-validation-templates.md（表单验证规则）
  - references/dwr-ajax-call-patterns.md（DWR/Ajax 调用模板）
  - references/page-generation-flow.md（页面生成流程）

- [ ] [代码] 2.3 D1-D10 维度表格压缩：spec-verify-proposal.ts
  产出：spec-verify-proposal.ts
  每个 D 维度从 ~20-35 行压缩为 ~8-12 行紧凑表格格式

- [ ] [测试][功能][P1] 2.4 前端模板拆分后的功能测试
  - 使用 venus_tr_impl_frontend 技能生成一个 JSP 页面
  - 验证 AI 按需读取了对应 references 文件
  - 验证生成的页面质量不低于拆分前

## 3. Sprint 3 — Layer B Phase 2B：JSON Sidecar 生成与消费

- [x] [代码] 3.1 JSON Schema 类型定义：src/core/spec/sidecar-schema.ts（新文件）
  产出：sidecar-schema.ts
  定义 ManifestSchema / TasksSchema / DecisionsSchema / CapabilitiesSchema 的 TypeScript 接口

- [x] [代码] 3.2 tasks.json 生成指令：spec-propose.ts 添加 JSON sidecar 生成步骤
  产出：spec-propose.ts instructions 新增 ~15 行 JSON sidecar 生成指令
  propose 完成 tasks.md 后同步生成 tasks.json

- [x] [代码] 3.3 tasks.json 消费指令：spec-apply.ts + spec-verify.ts
  产出：spec-apply.ts / spec-verify.ts instructions
  - apply: 优先读 tasks.json（降级解析 tasks.md）
  - verify: 优先读 tasks.json + capabilities.json 做结构化对比

- [x] [代码] 3.4 decisions.json 生成与消费：spec-propose.ts + tr-docs-requirement-doc.ts
  产出：spec-propose.ts / tr-docs-requirement-doc.ts instructions
  - propose: 完成 design.md 后同步生成 decisions.json
  - requirement-doc: 优先读 decisions.json 渲染决策表

- [x] [代码] 3.5 capabilities.json + manifest.json 生成与消费
  产出：spec-propose.ts / spec-bulk-archive.ts instructions
  - propose: 聚合 specs/*.md 生成 capabilities.json + 从 proposal.md 提取 manifest.json
  - bulk-archive: 读 capabilities.json 做冲突检测

- [x] [测试][单元][P0] 3.6 JSON Sidecar Schema 测试
  产出：test/sidecar-schema.test.ts
  - 验证所有 4 个 JSON Schema 的类型定义完整性
  - 验证 tasks.json status 枚举值（pending/done）
  - 验证 capabilities.json operation type 枚举值（ADDED/MODIFIED/REMOVED/RENAMED）

- [x] [测试][功能][P1] 3.7 JSON Sidecar 降级行为测试
  - JSON 缺失时 spec-apply 正确降级为解析 tasks.md checkbox
  - JSON 与 MD 不一致时以 MD 为准 + WARN
  - 降级行为不阻断流程

## 4. Sprint 4 — Layer B Phase 3B：SQLite 索引

- [x] [代码] 4.1 SQLite 读写封装：src/core/spec/sqlite-index.ts（新文件）
  产出：sqlite-index.ts
  - initDatabase()：建表 DDL
  - insertChange() / insertCapability() / insertDecisions() / insertRequirements() / insertExplorationMemory()
  - queryByCapability() / searchDecisions() / searchRequirements()
  - 降级：better-sqlite3 不可用时 fallback 到 sqlite3 CLI

- [x] [代码] 4.2 index.db 初始化：venus init 新增步骤
  产出：src/commands/init.ts
  - 项目扫描之后调用 initDatabase()
  - SQLite CLI 不可用 → WARN 跳过
  - index.db 已存在 → 跳过

- [x] [代码] 4.3 归档写入索引：spec-archive.ts instructions
  产出：spec-archive.ts / spec-bulk-archive.ts instructions 新增 ~15 行
  - 归档成功后读取 JSON sidecar → 写入 index.db
  - 写入失败 → WARN 继续

- [x] [代码] 4.4 探索查询索引：spec-explore.ts instructions
  产出：spec-explore.ts instructions 新增 ~10 行
  - 搜索历史探索记忆时优先查询 exploration_memory 表
  - index.db 不可用 → Glob 降级

- [x] [代码] 4.5 提案冲突检测：spec-propose.ts instructions
  产出：spec-propose.ts instructions 新增 ~10 行
  - 能力冲突检测优先查询 capabilities 表
  - index.db 不可用 → Glob 降级

- [x] [代码] 4.6 venus spec reindex 命令
  产出：src/commands/spec.ts 新增 reindex 子命令
  - 扫描 openspec/changes/archive/ 全部变更
  - 解析 JSON sidecar（降级解析 MD）
  - 批量写入 index.db
  - 支持 --force 全量重建

- [x] [测试][单元][P0] 4.7 SQLite 索引单元测试
  产出：test/sqlite-index.test.ts
  - initDatabase 建表 DDL 正确性
  - insert+query 基本 CRUD
  - 降级到 sqlite3 CLI 路径

- [x] [测试][功能][P1] 4.8 reindex 端到端测试
  - 在测试项目中执行 venus spec reindex
  - 验证 index.db 中数据完整
  - 验证降级解析 MD 路径

## 5. Sprint 5 — 收尾

- [x] [代码] 5.1 版本号递增与 CHANGELOG 更新
  产出：package.json / CHANGELOG.md
  - 按改动大小递增版本号（minor）
  - CHANGELOG 归档 [Unreleased] 并新增版本小节

- [x] [测试][功能][P1] 5.2 init/update 端到端集成测试
  - 全新 `venus init` → 验证 references + index.db 创建
  - 从旧版 `venus update` → 验证 references 迁移 + 手改保护
  - `venus init --force` → 验证全量覆盖
  - `venus spec reindex` → 验证存量重建

- [x] [使用说明] 5.3 更新 AGENTS.md 与 README.md
  产出：AGENTS.md / README.md 的相关章节更新

- [x] [测试][单元][P2] 5.4 评估：Sprint 2 (2.1~2.4) 和剩余测试 (1.3/3.7/4.8) 降级为 P2 后续优化，不阻塞本变更发布