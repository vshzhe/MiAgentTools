# Proposal

## Why

当前自定义变更流程以 `change.json` 和 `tasks.json` 为真源，与 OpenSpec 的 Markdown 制品格式不一致；技能、CLI、索引与测试均围绕 JSON 建模，增加了 AI 编辑成本，并造成 Markdown/JSON 双格式及历史兼容边界复杂。将 OpenSpec Markdown 恢复为唯一可编辑真源，同时以确定性解析、校验和可重建索引提供机器处理能力，可提升 Agent 编辑与验证准确度，避免重复存储，并减少上下文和重复扫描开销。

## What Changes

- **BREAKING**：新变更统一以 `proposal.md`、`design.md`、`specs/<capability>/spec.md` 和 `tasks.md` 作为制品真源；停止生成和维护 `change.json`、`tasks.json`。
- 保留 `iagent spec` 工作流和 `--json` CLI 响应，但 CLI 从 Markdown 解析状态、任务和规格；JSON 仅用于机器交换，不再作为持久化主产物。
- 引入共享 Markdown 解析与校验模型，提供带文件路径和行号的错误；校验 Requirement/Scenario、任务状态/依赖及规格到任务的追溯关系。
- 统一生成、实现、验证、复查、归档及需求文档技能，直接读写 OpenSpec Markdown；共享制品生成协议只维护一份。
- 保留 SQLite 作为从 Markdown 重建的索引缓存；历史 JSON 不自动覆盖、合并或删除，并提供显式迁移路径。
- 更新项目指令、技能模板、文档与回归测试，删除 JSON-only 约束及 JSON 渲染任务的主流程。

## Capabilities

### New Capabilities
- `artifact-markdown-source`: 规定 OpenSpec Markdown 制品的唯一真源、结构解析/校验、任务关联与历史 JSON 的显式迁移边界。

### Modified Capabilities
- `artifact-json-sidecar`: 将现有 JSON 主产物契约收敛为历史格式兼容规则，不再要求新变更写入 JSON。
- `artifact-generation-protocol`: 共享生成协议改为按依赖序直接创建和校验 Markdown 制品。
- `spec-workflow-cli`: status、instructions、apply 上下文和 reindex 改为基于 Markdown；保留 JSON 格式的 CLI 响应。
- `spec-workflow-skills`: propose/apply/verify/archive 等技能直接维护 Markdown 制品。
- `workflow-suite-skills`: workflow、auto-workflow、debug、proposal-review、requirement-doc 等消费者统一读取或更新 Markdown。
- `sqlite-cross-change-index`: reindex 以 Markdown 为主来源，SQLite 保持可重建缓存。

## Impact

影响 `src/core/spec/` 的 schema、状态检测、指令分发、sidecar 写入/渲染与索引逻辑，`src/commands/spec.ts`，相关 CLI 和技能模板，生成协议 `openspec/rules/artifact-generation.md`，`AGENTS.md`、用户文档及相关测试。历史 JSON 变更、现有归档目录及 SQLite 数据不得在常规 status/apply/archive 操作中被隐式改写或删除；转换须通过显式、可校验的迁移流程执行。