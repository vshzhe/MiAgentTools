# artifact-json-sidecar 增量规格

> 本 delta 只做**措辞收口**：跨变更索引（`iagent spec reindex`）随本变更整体退役后，该 Requirement 中「索引操作」一类消费方不再存在，若保留会让主规格继续指向一个已删除的命令。

## MODIFIED Requirements

### Requirement: 历史 JSON 只能只读兼容并通过显式迁移

历史 `change.json`、`tasks.json`、manifest.json、decisions.json 与 capabilities.json MUST NOT 被常规查询、实现或归档操作隐式覆盖或删除。消费方 SHALL 优先读取对应 OpenSpec Markdown；仅当对应 Markdown 缺失时，**`status` 等只读查询** MAY 只读解析历史 JSON 并记录 WARN。系统 MUST NOT 自动合并 Markdown 与 JSON；对 JSON-only 变更的写入操作 SHALL 要求先执行显式迁移。

「索引操作」一类消费方已随 `sqlite-cross-change-index` 能力退役（见 `spec-workflow-cli / reindex 子命令已移除`），本 Requirement MUST NOT 再以 `reindex` / 索引重建作为只读兼容的入口。

#### Scenario: Markdown 与 JSON 并存

- **WHEN** 变更同时存在 Markdown artifact 和对应历史 JSON
- **THEN** 消费方 SHALL 以 Markdown 为准，MUST NOT 让 JSON 覆盖或补充 Markdown 内容

#### Scenario: JSON-only 历史变更读取

- **WHEN** `status` 等只读查询遇到无 Markdown、但存在历史 JSON 的变更
- **THEN** MAY 只读解析可支持的 JSON 数据并输出 WARN，MUST NOT 写回 JSON 或自动生成 Markdown
- **AND** MUST NOT 依赖任何索引重建命令（该命令已删除）

#### Scenario: 写入操作遇到 JSON-only 历史变更

- **WHEN** apply、verify 修复或其他写入操作发现变更只有 JSON 制品
- **THEN** SHALL 提示先运行显式迁移，并在迁移前保持源文件不变

#### Scenario: 历史 sidecar 迁移

- **WHEN** 用户显式请求将历史 JSON 变更迁移为 Markdown
- **THEN** 系统 SHALL 校验迁移结果并保留 JSON 源文件，除非用户另行明确请求删除且校验已通过
