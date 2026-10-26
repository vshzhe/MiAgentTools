# Proposal: improve-artifact-full-json-primary

## Why

提案制品当前存在**双层断裂**：结构化数据既没有完整的 JSON 主产物，下游消费者（需求文档生成、归档主 spec 同步）又依赖散文 MD 解析：

| 制品 | 当前 JSON | 完整度 |
|------|----------|--------|
| proposal.md | manifest.json（仅 changeName/timestamps/capabilities 列表） | 15% |
| design.md | decisions.json（仅 Decisions 段，缺 Context/Goals/Risks） | 30% |
| specs/*.md | capabilities.json（能力→场景，缺 REMOVED/RENAMED 完整字段） | 60% |
| tasks.md | tasks.json ✅（唯一 JSON-primary 产物） | 100% |

**三个核心问题**：

1. **生成侧碎片化**：4 个 JSON 文件分离（manifest/tasks/decisions/capabilities），写方需维护多文件同步，读方需多文件探测；且 `manifest.json` 名不达意（元信息 vs 提案全文）
2. **需求文档生成靠散文解析**：`tr-docs-requirement-doc` 从 proposal.md/design.md 散文中 AI 推理提取章节内容——"关键技术决策"表靠从 design.md 散文"猜测"，准确性无保障
3. **归档主 spec 同步靠散文解析**：`spec-archive` / `spec-bulk-archive` 的 delta spec → 主 spec 合并，从 specs/*.md 散文中 AI 分类 ADDED/MODIFIED/REMOVED/RENAMED 操作——分类误差直接写入主 spec

**为什么是现在**：
- `tasks.json → renderTasksMd()` 的 JSON-primary 模式已在工作区验证（`venus spec tasks render` 已实现）
- 代码基础设施（sidecar-schema.ts / sidecar-writer.ts / sqlite-index.ts）完整就位
- 不统一则每个生成路径损失 ~40 行散文化 JSON 指令（AI 实际不执行），且下游每次消费都在做有损的散文解析

## What Changes

### 核心架构：单一合并 JSON 主产物 + 全链路 JSON 消费

```
旧（碎片 + 散文消费）：                新（合并 + 结构化消费）：
proposal.json   (薄)                  .venus/change.json  ← proposal + design + specs 三段合并
design.json     (薄)                    ├── proposal 段
specs.json      (薄)                    ├── design 段
tasks.json ✅                        └── specs 段
                                      tasks.json ✅ (保持独立)

生成：AI 写 change.json 段 → 代码渲染对应 MD
消费：需求文档 / 归档同步 / 验证评分 / 调试同步 → 一律优先读 change.json
```

### 具体变更

1. **合并 JSON 主产物**（`.venus/change.json`，schema `venus/change/v1`）
   - `proposal` 段：why / whatChanges / capabilities(new+modified) / impact(files+breaking+compatibility)
   - `design` 段：context / goals / nonGoals / decisions / risks
   - `specs` 段：specs[{ name, path, operations[{ type, requirement, description, scenarios, reason?, migration?, from?, to? }] }]
   - 根字段：changeName / createdAt / updatedAt / phase（吸收旧 manifest.json）
   - tasks.json 保持独立（change 目录根，不变）

2. **代码级渲染**：`venus spec render <type>`（type = proposal/specs/design/tasks）从 JSON 确定性渲染对应 MD；替换现行 `venus spec tasks render`

3. **需求文档生成从 JSON 获取**：`tr-docs-requirement-doc` 从 change.json（+tasks.json）结构化读取章节来源，MD 仅作降级回退

4. **归档主 spec 同步从 JSON 获取**：`spec-archive` / `spec-bulk-archive` 的 delta spec → 主 spec 合并，操作分类读 change.json 的 specs 段（结构化），MD 仅作降级回退

5. **生成协议单一源**：`openspec/rules/artifact-generation.md`（共享协议）新增 JSON-first 步骤——spec-propose / tr-impl-workflow / tr-impl-auto-workflow 三条生成路径统一生效

6. **消费侧全链路 JSON 优先**（遗漏检查发现的 5 处）：
   - `openspec/rules/artifact-generation.md` 共享协议（工作流内联生成路径此前完全绕过 JSON）
   - `tr-impl-debug` Phase 6 同步提案（此前直接改 MD，会造成 JSON/MD 分叉）
   - `tr-impl-review-proposal` 复查 + 缺漏修复（此前读写 MD）
   - `spec-verify` / `spec-verify-proposal` 验证评分（此前散文解析）
   - `venus spec instructions` 输出新增 `jsonTemplate` 字段（AI 写 JSON 时不再猜 schema）

### 不变项

- tasks.json 与 renderTasksMd() 逻辑不变
- SQLite index.db 表结构不变
- 旧 manifest/decisions/capabilities 在存量变更中保留不删（降级回退链继续可读）
- 手改保护（fingerprint）不变
- 降级原则不变：JSON 缺失时回退 MD 解析（WARN 不阻断）

## Capabilities

### Modified Capabilities

- `artifact-json-sidecar`: 从"4 独立薄文件"改为"1 合并完整主产物（proposal/design/specs 三段）+ tasks 独立"
- `spec-workflow-skills`: proposal/apply/verify/archive/bulk-archive 技能 + tr-docs-requirement-doc + tr-impl-debug + tr-impl-review-proposal + tr-impl-auto-workflow 的 JSON 读写指令更新
- `template-generation`: 生成协议单一源（artifact-generation.md）+ `venus spec instructions` 的 jsonTemplate 契约
- `sqlite-cross-change-index`: reindex 读取链更新为 change.json → 旧 3 文件 → MD

## Impact

### 直接影响的文件

| 文件 | 变更说明 |
|------|---------|
| `src/core/spec/sidecar-schema.ts` | 新增合并 `ChangeSchema`（proposal/design/specs 三段）；旧 3 schema 标 `@deprecated`（保留降级读取） |
| `src/core/spec/sidecar-writer.ts` | 新增 `readChangeJson` / `writeChangeJson` / `initChangeJson` + `renderProposalMd` / `renderDesignMd` / `renderSpecsMd`；validateSidecar 支持 'change' |
| `src/core/spec/templates/index.ts` | 新增 JSON schema 模板常量（变更合并 schema 分段） |
| `src/core/spec/instructions.ts` | 输出新增 `jsonTemplate` 字段 |
| `src/core/spec/schema.ts` | artifact instruction 文案更新（JSON-first） |
| `src/commands/spec.ts` | 新增 `venus spec render <type>`（替换 `spec tasks render`）；`sidecar init` 产出 change.json 骨架；移除 `sidecar manifest`；reindex 读取链更新 |
| `src/commands/completion.ts` | 命令表同步 |
| `openspec/rules/artifact-generation.md` | G2 重写为 JSON-first 协议（单一源） |
| `src/core/templates/workflows/spec-propose.ts` | 合并 JSON 生成段重写（引用协议） |
| `src/core/templates/workflows/spec-apply.ts` | change.json 上下文优先读取 |
| `src/core/templates/workflows/spec-verify.ts` | change.json 优先读取 |
| `src/core/templates/workflows/spec-archive.ts` | 主 spec 同步从 change.json specs 段 |
| `src/core/templates/workflows/spec-bulk-archive.ts` | 同步段同口径 |
| `src/core/templates/workflows/tr-docs-requirement-doc.ts` | 需求文档从 change.json 获取 |
| `src/core/templates/workflows/tr-impl-debug.ts` | Phase 6 同步提案 JSON-first |
| `src/core/templates/workflows/spec-verify-proposal.ts` | 评分优先读 JSON |
| `src/core/templates/workflows/tr-impl-review-proposal.ts` | 复查/修复优先读 JSON |
| `src/core/templates/workflows/tr-impl-auto-workflow.ts` | Phase 2 内联生成引用协议（JSON-first 继承） |
| `test/sidecar-schema.test.ts` / `test/sidecar-writer.test.ts` | 合并 schema 测试（段更新保留、渲染幂等、校验） |
| `test/artifact-dataflow.test.ts` | 数据流断言核验 |
| `README.md` / `AGENTS.md` | 侧车描述同步（若有相关段落） |
| `skills/*.md` + `.claude/commands/venus/*.md` | pnpm generate:skills 刷新 |
| `package.json` / `CHANGELOG.md` | 版本与变更日志 |

### 向后兼容

- **无破坏性变更**（对外）：JSON 缺失时所有消费方降级 MD（与当前一致）
- `spec tasks render` / `sidecar manifest` 为未发布的在途命令（fix-spec-sidecar-primary-artifact 待完成态），由本变更统一取代，不构成对外破坏
- 存量变更：旧 3 sidecar 文件保留可读；下次 spec-propose 增量更新或 reindex 时渐进覆盖
- index.db 不可用 → 降级 Glob/Grep（不变）
- 版本号：minor 递增（功能新增与重构）
