## MODIFIED Requirements

### Requirement: `venus spec instructions` SHALL 输出 jsonTemplate 字段
`venus spec instructions <artifact-id> --json` 的输出 MUST 新增 `jsonTemplate` 字段——该 artifact 对应 JSON 段落（proposal/specs/design → change.json 段；tasks → tasks.json）的 schema 模板字符串，供 AI 写入结构化数据时使用。MD 模板（`template` 字段）保留（降级手写用）。

#### Scenario: proposal 的 jsonTemplate
- **WHEN** 运行 `venus spec instructions proposal --change <name> --json`
- **THEN** 输出 SHALL 含 `jsonTemplate`，为 proposal 段的 JSON schema 示例（why / whatChanges / capabilities / impact 字段齐全）
- **AND** `template`（MD 模板）字段保持存在

#### Scenario: 字段为新增，向后兼容
- **WHEN** 既有解析方读取 instructions 输出
- **THEN** 新增字段 MUST NOT 改变既有字段的语义与存在性

### Requirement: 生成协议 SHALL 单一源，模板正文引用不复制
JSON-first 生成步骤（写段 → render → 失败修正/降级）MUST 维护于 `openspec/rules/artifact-generation.md` 一份；spec-propose / tr-impl-workflow / tr-impl-auto-workflow 的正文引用该协议，MUST NOT 各自复制完整步骤。

#### Scenario: 模板引用协议
- **WHEN** 检查三个生成路径模板的 JSON 生成段
- **THEN** 各自的 JSON-first 步骤描述 MUST 指向 `openspec/rules/artifact-generation.md`
- **AND** 复制性描述仅允许为简短摘要（不构成第二份维护源）

### Requirement: JSON-first 模板改动 SHALL 同步白名单与快照
涉及模板正文变更时，allowedTools MUST 覆盖新增的 JSON 读写与 render 调用；改动后 MUST 运行 `pnpm build && pnpm generate:skills` 刷新快照。

#### Scenario: allowedTools 覆盖新增调用
- **WHEN** spec-propose / spec-apply / tr-impl-debug 等模板新增 JSON Write/Edit 与 `venus spec render` 调用
- **THEN** 各模板 allowedTools SHALL 包含对应条目（`Bash(venus spec render:*)`、JSON 路径的 Write/Edit）
- **AND** 白名单组合 MUST 遵循三层规则与共享常量（tool-whitelist.ts）

#### Scenario: 产物快照刷新与测试
- **WHEN** 运行 `pnpm build && pnpm generate:skills`
- **THEN** `skills/` 与 `.claude/commands/venus/` 快照 SHALL 含更新后的 JSON-first 指令
- **AND** `pnpm test`（skills-parity / allowed-tools / template-derivation 等）SHALL 全部通过