# Design

## Context

当前 iagent 的 spec 工作流以 `change.json`（proposal/design/specs）和 `tasks.json` 为结构化真源，`tasks.md` 只是渲染结果。该设计解决了机器校验和索引问题，但偏离 OpenSpec 的 Markdown artifact 约定，使 Agent 必须整文件维护嵌套 JSON，并在多个技能中重复处理 JSON schema。当前仓库的归档变更同时存在 Markdown-only、JSON-only 和混合格式，不能通过隐式合并消除差异。

本设计将变更制品恢复为 OpenSpec Markdown-first，同时保留 iagent CLI 的确定性状态机和 SQLite 跨变更索引。核心边界是：Markdown 是唯一可编辑真源；解析后的 TypeScript 对象只在运行时存在；CLI `--json` 是响应格式；SQLite 是可删除、可重建缓存；历史 JSON 只读兼容并通过显式迁移转换。

## Goals / Non-Goals

**Goals:**

- 新变更使用标准 `proposal.md`、`design.md`、`specs/**/*.md` 和 `tasks.md`。
- 提供确定性的 Markdown 解析、结构校验、任务依赖校验和规格到任务的追溯。
- 让 `status`、`instructions`、`instructions apply`、`archive` 和 `reindex` 统一使用 Markdown 读取口径。
- 保留 `--json` CLI 输出，向 Agent 提供精简的路径、状态、进度和诊断摘要。
- 让 spec、workflow、auto-workflow、debug、proposal-review 和 requirement-doc 技能直接处理 Markdown。
- 通过共享 `context-pack.md`、内容指纹和 SQLite 索引减少重复读取和 CodeGraph 查询。
- 对历史 JSON 变更提供无破坏的只读兼容和显式迁移路径。

**Non-Goals:**

- 不修改上游 OpenSpec CLI 的行为或 schema 机制。
- 不把 Markdown 全量转换成 JSON 后再由 JSON 驱动流程。
- 不在本变更中自动迁移、删除或覆盖已有归档 JSON 文件。
- 不把 SQLite 索引变成新的制品真源；索引丢失时必须能从 Markdown 重建。
- 不改变探索文件移动、提示词门、流程图确认门和子代理派发的既有语义，只调整其制品读写来源。

## Decisions

### D1: Markdown 是唯一持久化真源

- **选择**：新变更只维护 OpenSpec Markdown artifact。
- **理由**：兼容 OpenSpec 标准，适合 AI 和人工审阅，支持自然语言、表格、代码块和流程图，避免 JSON 与 Markdown 双真源。
- **备选**：继续使用合并 `change.json` 并渲染 Markdown。
- **否决理由**：会继续要求 Agent 维护嵌套结构，并保留渲染副本与源文件的漂移风险。

### D2: 使用解析器和运行时类型模型，而不是持久化 JSON 镜像

- **选择**：新增 Markdown parser、validator 和统一 `ParsedChange` 运行时模型。
- **理由**：程序仍能获得严格结构和字段校验，但不增加用户需要维护的文件格式。
- **解析边界**：
  - proposal/design 保留原 Markdown，并按稳定标题提取章节；
  - specs 严格解析 delta section、Requirement、Scenario、WHEN/THEN；
  - tasks 解析 checkbox、编号、标签、依赖、Spec Ref/Scenario Ref；
  - 所有诊断保留文件路径和行号。
- **备选**：用正则散文解析并直接驱动各个技能。
- **否决理由**：重复实现、错误不可定位，且不同技能会形成不一致的解析口径。

### D3: CLI JSON 只作为轻量交换协议

- **选择**：`status --json`、`instructions --json` 和 `instructions apply --json` 继续输出 JSON，但只返回状态、路径、进度、任务摘要和诊断。
- **理由**：Agent 和 shell 工具适合消费小型 JSON；完整需求和设计仍从 Markdown 读取，避免把 JSON 响应误当作真源。
- **约束**：CLI JSON 不写回变更目录；`instructions` 移除 `jsonTemplate` 主路径；apply 的 contextFiles 指向 Markdown。

### D4: tasks.md 直接维护任务状态

- **选择**：`tasks.md` 中的 `- [ ]` / `- [x]` 是唯一任务状态。
- **理由**：任务状态本身就是 OpenSpec 标准 Markdown 体验，AI 可以局部 Edit，避免整份 tasks.json 重写。
- **机器字段**：任务编号、类型标签、依赖、文件、Spec Ref、Scenario Ref 和验证命令使用稳定文本标记；其余描述保留自然语言。
- **备选**：保留 tasks.json，再由渲染器更新 tasks.md。
- **否决理由**：会再次产生任务状态双写和渲染链路。

### D5: 规格到任务采用可读引用

- **选择**：任务使用 `Spec Ref: <capability> / <requirement>` 和可选 `Scenario Ref: <scenario>`。
- **理由**：引用对人和 Agent 都可读，能够生成覆盖矩阵，又不引入隐藏 JSON ID。
- **校验**：解析器检查 capability、Requirement 和 Scenario 是否存在；失效引用报告错误，不自动猜测替换。

### D6: 状态判定从文件存在升级为解析有效性

- **选择**：状态增加 `invalid`，文件存在但结构不合法不能视为 done。
- **理由**：文件存在不代表 Agent 可以准确执行；在 apply 前暴露格式错误能避免错误实现。
- **状态语义**：`done` 表示文件存在且通过结构校验；`ready` 表示依赖满足；`blocked` 表示依赖未满足；`invalid` 表示文件存在但不可可靠解析；`skipped/conflict` 保留 skip_specs 语义。

### D7: SQLite 只做可重建索引

- **选择**：reindex 优先解析 Markdown，写入现有 SQLite 表；查询结果携带源文件路径和标题/行号。
- **理由**：历史决策和规格全文搜索需要索引，但索引可以删除、重建，不应成为第二真源。
- **缓存失效**：使用文件路径、mtime 和内容 hash 判断增量更新；`--force` 从 Markdown 全量重建。
- **证据规则**：索引摘要只能用于定位，Agent 必须回读原始 Markdown 作为最终证据。

### D8: 历史 JSON 采用显式迁移，不做隐式合并

- **选择**：Markdown 优先；只有 JSON 的历史变更只读兼容并告警；新增显式迁移入口（建议 `iagent spec migrate --from-json`）。
- **理由**：自动合并两种来源会掩盖冲突，导致 Agent 依据不确定数据实现。
- **迁移规则**：目标 Markdown 已存在时拒绝覆盖；迁移成功先保留 JSON；删除旧文件必须由独立显式选项触发。

### D9: 保留共享上下文包优化多 Agent 执行

- **选择**：协调 Agent 从 Markdown 和代码扫描结果一次性生成 `context-pack.md`，子 Agent 只接收共享包和本单元任务清单。
- **理由**：Markdown 真源不意味着每个子 Agent 都要完整重读；共享包降低上下文消耗和重复查询。
- **约束**：context-pack 是蒸馏视图，不是新真源；包缺口必须回读 Markdown 并回报，任务勾选由协调 Agent 集中完成。

### D10: 依赖顺序和验证门保持不变

- **选择**：保留 proposal → specs/design → tasks、提案验证门、设计确认门、测试执行关卡、归档确认桥和失败重试策略。
- **理由**：本变更只替换数据载体，不降低既有流程防护。
- **变化点**：所有门的证据来源改为 Markdown parser/model；不再要求 JSON schema 校验或 Markdown 渲染成功作为有效性依据。

## Architecture Mapping

建议新增或重构的实现边界：

```text
src/core/spec/
├── model/artifact-model.ts       # ParsedChange、ParsedSpec、ParsedTask 等运行时类型
├── parser/markdown-parser.ts     # Markdown 入口与公共标题/行号处理
├── parser/proposal-parser.ts
├── parser/design-parser.ts
├── parser/spec-parser.ts
├── parser/task-parser.ts
├── validation/artifact-validator.ts
├── validation/traceability.ts   # Scenario -> Task 覆盖关系
├── status.ts                     # 基于 parser/validator
├── instructions.ts               # Markdown 模板和路径
├── migration.ts                  # 显式 JSON -> Markdown 转换
└── sqlite-index.ts               # Markdown 主链路、JSON 兼容降级
```

现有 `sidecar-schema.ts` / `sidecar-writer.ts` 不应继续承担新制品写入主流程。历史 JSON 类型可暂时保留在兼容模块，避免历史归档读取被破坏；新 Markdown parser 不应依赖 sidecar writer。

## Migration Plan

1. 先落地 Markdown model/parser/validator，并为 proposal/design/spec/tasks 建立单元测试。
2. 将 `status` 和 `instructions` 改为 Markdown 路径和解析状态，增加 `invalid` 与行号诊断。
3. 将 apply、verify、archive、requirement-doc、debug 和 proposal-review 改为 Markdown 读写。
4. 将共享 `artifact-generation.md` 和全部相关技能模板切换为 Markdown-first。
5. 将 reindex 主链路切换为 Markdown，保留历史 JSON 降级并记录 WARN。
6. 增加显式 JSON 到 Markdown 迁移命令和冲突保护。
7. 刷新技能快照、更新 AGENTS/README/CHANGELOG，运行构建、测试、lint 和 Markdown 回归测试。

回滚时可保留历史 JSON 读取模块和旧归档文件；新变更格式的切换属于 BREAKING 行为，需要主版本递增并在 CHANGELOG 中说明。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| Markdown 结构被 Agent 写坏 | 确定性 parser/validator、路径+行号诊断、进入下一阶段前阻断 invalid |
| 自由文本解析不稳定 | 仅对标题、Scenario、checkbox、引用和依赖使用严格语法；proposal/design 其余内容原样保留 |
| Markdown 解析增加运行成本 | 对文件内容做 hash 缓存；status 只解析变更目录；归档搜索使用 SQLite |
| 历史 JSON 与 Markdown 内容冲突 | Markdown 优先且禁止自动合并；JSON-only 变更只读告警，写入前要求显式迁移 |
| 删除 tasks.json 影响旧脚本 | 保留兼容读取和明确错误提示；迁移前不删除旧文件；CLI JSON 响应继续可用 |
| 多 Agent 重复阅读 Markdown | 复用 context-pack、文件归属表和最小回执协议；包缺口回读真实制品 |
| 现有技能快照与模板不一致 | 所有模板改动后执行 `pnpm build && pnpm generate:skills`，增加 JSON-only 残留回归扫描 |

## Open Questions

无。历史 JSON 的自动迁移已明确排除，后续实现阶段只需确定迁移命令的具体参数命名，不改变本变更的制品真源和兼容边界。
