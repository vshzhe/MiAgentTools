# Spec Delta

## REMOVED Requirements

### Requirement: 提案结构化数据 SHALL 合并为单一主产物 `.iagent/change.json`
**Reason**: OpenSpec 的 proposal、design 和 specs 标准制品是 Markdown；将 JSON 设为唯一真源导致非标准工作流及重复维护负担。
**Migration**: 新变更直接使用 `proposal.md`、`design.md` 和 `specs/<capability>/spec.md`。历史 JSON 由显式迁移工具转换，常规操作不删除原文件。

### Requirement: change.json 写入 MUST 累积保留已有段落
**Reason**: 新流程不再将多个 artifact 合并写入 `change.json`。
**Migration**: proposal、specs 和 design 分别维护在标准 OpenSpec Markdown 文件中；保留历史文件供只读兼容或显式迁移。

### Requirement: validateSidecar SHALL 支持合并 schema，旧类型保持校验
**Reason**: `change.json` 不再是新变更的权威制品，合并 JSON schema 校验不再代表制品有效性。
**Migration**: 对新变更使用 Markdown 结构校验；历史 JSON 的迁移校验由显式迁移流程执行。

### Requirement: tasks.json 结构化任务追踪
**Reason**: JSON 与渲染出的 `tasks.md` 形成双份状态；OpenSpec 的任务清单应直接维护为 Markdown。
**Migration**: 新变更直接在 `tasks.md` 更新 checkbox 状态。历史 `tasks.json` 默认保留，只能经显式迁移流程转换。

### Requirement: 旧 JSON Sidecar 文件 SHALL 保留可读，读方按降级链回退
**Reason**: 新流程需要明确 Markdown 优先和 JSON-only 只读兼容边界，不能继续把旧 JSON 描述为普通主链路降级。
**Migration**: Markdown 优先；只有 JSON 的历史变更仅供 status/reindex 只读使用，写入前必须显式迁移。

## ADDED Requirements

### Requirement: 历史 JSON 只能只读兼容并通过显式迁移
历史 `change.json`、`tasks.json`、manifest.json、decisions.json 与 capabilities.json MUST NOT 被常规查询、实现或归档操作隐式覆盖或删除。消费方 SHALL 优先读取对应 OpenSpec Markdown；仅当对应 Markdown 缺失时，status 与索引操作 MAY 只读解析历史 JSON 并记录 WARN。系统 MUST NOT 自动合并 Markdown 与 JSON；对 JSON-only 变更的写入操作 SHALL 要求先执行显式迁移。

#### Scenario: Markdown 与 JSON 并存
- **WHEN** 变更同时存在 Markdown artifact 和对应历史 JSON
- **THEN** 消费方 SHALL 以 Markdown 为准，MUST NOT 让 JSON 覆盖或补充 Markdown 内容

#### Scenario: JSON-only 历史变更读取
- **WHEN** status 或 reindex 遇到无 Markdown、但存在历史 JSON 的变更
- **THEN** MAY 只读解析可支持的 JSON 数据并输出 WARN，MUST NOT 写回 JSON 或自动生成 Markdown

#### Scenario: 写入操作遇到 JSON-only 历史变更
- **WHEN** apply、verify 修复或其他写入操作发现变更只有 JSON 制品
- **THEN** SHALL 提示先运行显式迁移，并在迁移前保持源文件不变

#### Scenario: 历史 sidecar 迁移
- **WHEN** 用户显式请求将历史 JSON 变更迁移为 Markdown
- **THEN** 系统 SHALL 校验迁移结果并保留 JSON 源文件，除非用户另行明确请求删除且校验已通过
