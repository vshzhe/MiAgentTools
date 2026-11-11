## ADDED Requirements

### Requirement: Blocking confirmation gates use the gate marker

技能内的阻塞确认门 SHALL 使用统一的 `⛔ GATE:` 标记，MUST NOT 仅以 `⚠️ 强制` 或自然语言标题表达。至少覆盖 `spec-apply` 的 `design-confirmation` 与 `migration` Phase 3 的 `implementation-bridge`。

#### Scenario: spec-apply 设计门使用标记

- **WHEN** 生成 `spec-apply` 技能或指令正文
- **THEN** `5.5 设计确认门` SHALL 含 `⛔ GATE:`
- **AND** 该门 SHALL 保留「主通道 gate-skip → 账本兜底 → 门照常执行」三级链

#### Scenario: migration 实现门使用标记

- **WHEN** 生成 `migration` 技能或指令正文
- **THEN** Phase 3 实现确认门 SHALL 含 `⛔ GATE:`
- **AND** 该门 SHALL 仍只询问一次「是否需要调整计划 / 制品」

### Requirement: Template text hygiene

技能模板正文 MUST NOT 含相邻重复短语（如「由主 agent 内联由主 agent 内联」）；新增/删除阶段时 MUST 同步修正引用。

#### Scenario: 重复短语测试拦截

- **WHEN** 扫描全部模板正文
- **THEN** MUST NOT 出现「由主 agent 内联由主 agent 内联」「由主 agent 由主 agent」等相邻重复
- **AND** 命中时测试 SHALL 失败并输出技能 id 与行号

### Requirement: Review and test skills consume project rule baseline

`review` 与 `test` 技能 SHALL 在开始检查/生成前读取项目规则基线（`iagent rules --json` 枚举的 `exists=true` 源），MUST NOT 只依赖 `CLAUDE.md`。`review` 的 `allowedTools` SHALL 含 `Bash(iagent:*)` 以执行枚举。

#### Scenario: review 技能读取规则基线

- **WHEN** 执行 `/iagent:review`
- **THEN** 技能 SHALL 读取 `.iagent/config.yaml` 与 `.iagent/rules/*.md` 中存在的规则源
- **AND** MUST NOT 把 `CLAUDE.md` 作为唯一规范来源

#### Scenario: test 技能读取测试规则

- **WHEN** 执行 `/iagent:test`
- **THEN** 技能 SHALL 读取 `.iagent/rules/testing-rules.md`（存在时）
- **AND** 生成的测试 SHALL 遵循其中的框架与目录约定

### Requirement: Documentation counts reflect actual project state

`README.md` / `AGENTS.md` / `docs/skills-manual.md` SHALL 使用与当前仓库实际一致的测试文件数、用例数与 package 版本，MUST NOT 保留历史计数或历史版本。

#### Scenario: 文档计数与实测一致

- **WHEN** 更新文档中的计数或版本
- **THEN** 测试文件数与用例数 SHALL 与 `pnpm test` 输出一致
- **AND** 版本号 SHALL 与 `package.json` 的 `version` 一致
