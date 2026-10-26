# Proposal: improve-template-dual-layer-optimization

## Why

VenusAgentTools 的 SKILL 模板体系存在两层 token 浪费问题：

**Layer A — SKILL 指令层**：26 个模板的 `instructions` 正文合计 ~12,000 行。5 个使用 Gate 注入的模板每个内联 ~320 行重复的提示词校验门和功能流程图文本；约 20 个模板重复同样的护栏套话；多个模板包含大段仅用于参考的输出示例。同时 `SkillTemplate.references` 机制（将大体积参考文本拆分为独立文件、AI 按需读取）已经完全就位，但仅 `tr-init.ts` 一个模板在使用——基础设施闲置。

**Layer B — Artifact 数据层**：变更制品（proposal.md / design.md / specs / tasks.md）全部是 Markdown。下游 SKILL 每次消费时必须全文解析散文来提取结构化信息——`spec-apply` 解析 checkbox 状态、`spec-verify` 解析需求列表、`tr-docs-requirement-doc` 从散文中 AI 推理决策表。每次重新解析消耗 token 且引入散文→结构化转译偏差。同时跨变更搜索（探索时查找历史记忆、提案时检测能力冲突）依赖 Glob + Grep 扫描全部目录，O(n) 复杂度。

**为什么是现在**：
1. Compact Gate 函数已存在但未被 Skill 模板使用——改动成本极低
2. references 基础设施完整就位——26 个模板中仅 1 个在用
3. JSON sidecar 可以不影响 Markdown 唯一真源的前提下渐进添加——降级安全
4. 模板数量还在增长，问题会持续放大

## What Changes

### Layer A: SKILL 模板指令文本瘦身

- **MODIFIED** 5 个 Gate 注入模板：SKILL 版改用 `buildPromptGateCompact` + `buildFlowchartCompact`（~20 行），全文版移入 `references/prompt-gate.md` + `references/flowchart-gate.md`
- **MODIFIED** 26 个模板：开头护栏文本压缩为单行统一引用
- **MODIFIED** 5 个模板：大段 ASCII 输出示例移入 `references/output-examples.md`
- **MODIFIED** `tr-impl-review-proposal.ts`：8 维度检查矩阵从内联 Markdown 表格转为 `references/check-matrix.md`
- **MODIFIED** `tr-impl-frontend.ts`：JSP 模板、组件决策树拆分为 5 个 `references/*.md`
- **MODIFIED** `spec-verify-proposal.ts`：D1-D10 维度定义用更紧凑的表格格式

### Layer B: Artifact 数据层结构化加速

- **NEW** JSON Sidecar 定义 (`src/core/spec/sidecar-schema.ts`)：manifest/tasks/decisions/capabilities 的 TypeScript 接口
- **MODIFIED** `spec-propose` 模板：生成 MD artifact 时同步生成对应 JSON sidecar（`.venus/manifest.json` / `tasks.json` / `decisions.json` / `capabilities.json`）
- **MODIFIED** `spec-apply` 模板：优先读取 `tasks.json` 获取结构化任务状态（JSON 缺失时降级解析 tasks.md）
- **MODIFIED** `spec-verify` 模板：使用 `tasks.json` + `capabilities.json` 做结构化对比
- **MODIFIED** `tr-docs-requirement-doc` 模板：从 `decisions.json` 直接渲染决策表
- **NEW** SQLite 索引初始化：`venus init` 创建 `openspec/.venus/index.db`
- **MODIFIED** `spec-archive` / `spec-bulk-archive` 模板：归档时写入 SQLite 索引
- **MODIFIED** `spec-explore` 模板：优先查询 SQLite 获取历史探索记忆
- **MODIFIED** `spec-propose` 模板：优先查询 SQLite 检测能力冲突
- **NEW** `venus spec reindex` CLI 命令：存量归档变更批量重建索引

## Capabilities

### New Capabilities

- `artifact-json-sidecar`: 变更制品 JSON 加速层——从 MD 提取结构化元数据供下游 SKILL 精确消费
- `sqlite-cross-change-index`: SQLite 跨变更索引——归档时写入、探索/提案时查询，替代 Glob+Grep 全文扫描

### Modified Capabilities

- `spec-workflow-skills`: 7 个 spec-* SKILL + workspace/workflow/frontend/debug 等模板的 instructions 压缩与 references 机制启用
- `tool-call-whitelist`: 新增 Bash(sqlite3:*) 等工具条目以支持 SQLite 操作（references 的 Read 已在白名单，不新增）
- `init-project-scan`: venus init 新增 index.db 创建步骤
- `spec-workflow-cli`: 新增 `venus spec reindex` 命令

## Impact

### 直接影响的文件

- `src/core/templates/workflows/spec-explore.ts`: Gate compact + references
- `src/core/templates/workflows/spec-propose.ts`: JSON sidecar 生成指令 + SQLite 冲突检测
- `src/core/templates/workflows/spec-apply.ts`: JSON sidecar 消费 + 输出示例移 references
- `src/core/templates/workflows/spec-verify.ts`: JSON sidecar 消费
- `src/core/templates/workflows/spec-verify-proposal.ts`: 维度表格压缩
- `src/core/templates/workflows/spec-archive.ts`: SQLite 索引写入 + 输出示例移 references
- `src/core/templates/workflows/spec-bulk-archive.ts`: SQLite 索引写入 + 输出示例移 references
- `src/core/templates/workflows/tr-impl-workflow.ts`: Gate compact + references
- `src/core/templates/workflows/tr-impl-auto-workflow.ts`: Gate compact + references
- `src/core/templates/workflows/tr-impl-genfull.ts`: Gate compact + references
- `src/core/templates/workflows/tr-impl-debug.ts`: Gate compact + references
- `src/core/templates/workflows/tr-impl-review-proposal.ts`: 检查矩阵移 references
- `src/core/templates/workflows/tr-impl-frontend.ts`: 组件模板拆分 references
- `src/core/templates/workflows/tr-docs-requirement-doc.ts`: JSON sidecar 消费 + 模板移 references
- `src/core/templates/prompt-gate.ts`: 双态渲染接口（可选）
- `src/core/templates/flowchart-gate.ts`: 双态渲染接口（可选）
- `src/core/spec/sidecar-schema.ts` (**NEW**): JSON schema 定义
- `src/core/spec/sqlite-index.ts` (**NEW**): SQLite 读写封装
- `src/commands/spec.ts`: 新增 reindex 子命令
- `src/commands/init.ts`: 新增 index.db 创建步骤
- `test/`: 新增 sidecar-schema / sqlite-index 测试文件
- `skills/`: 重新生成快照（pnpm generate:skills）
- 其余 ~15 个模板：护栏文本单行化（1 行/模板）

### 向后兼容

- **无破坏性变更**
- JSON sidecar 缺失时所有消费方自动降级为解析 Markdown（与现有行为完全一致）
- SQLite 不可用时自动降级为 Glob + Grep（与现有行为完全一致）
- 手改保护（fingerprint）机制不变：用户手改过的 SKILL.md 不会被 update 覆盖
- references 文件随 SKILL.md 同步升级/降级（update 的 syncReferences 先清空再重写）
- 存量无 JSON sidecar 的变更目录不受影响——下次 propose 时自然生成，已归档变更可通过 `venus spec reindex` 批量重建