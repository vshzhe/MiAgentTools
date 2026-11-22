## ADDED Requirements

### Requirement: rules 命令按类型筛选

`iagent rules` SHALL 支持 `--type <id[,id...]>` 参数，按技能类型筛选规则源：命中 `ruleFileNameFor(type)` 的 `.iagent/rules/*.md` 条目归入结果，常驻基线（`config.yaml` / `CLAUDE.md` / `AGENTS.md`）SHALL 恒含于结果。

无 `--type` 调用时输出 MUST 与现状逐字段一致（向后兼容）。未知 type 值 SHALL 以非零退出码失败并列出合法值。

#### Scenario: 按类型筛选

- **WHEN** 执行 `iagent rules --json --type test`
- **THEN** 输出含常驻基线三项与 `testing-rules.md`
- **AND** MUST NOT 含 `coding-rules.md` 与 `spec.md`（属于其他类型的规则文件）

#### Scenario: 多个类型

- **WHEN** 执行 `iagent rules --json --type impl,test`
- **THEN** 输出含 `coding-rules.md` 与 `testing-rules.md`
- **AND** 常驻基线恒含

#### Scenario: 无参输出不变

- **WHEN** 执行 `iagent rules --json`（不带 `--type`）
- **THEN** 输出的 `sources` 数组 MUST 与改造前逐字段一致（path / kind / exists / bytes / sha256 / lines / rules）

#### Scenario: 未知类型报错

- **WHEN** 执行 `iagent rules --json --type nonexistent`
- **THEN** 命令 SHALL 以非零退出码结束
- **AND** 错误信息 SHALL 列出合法类型 id

### Requirement: skills 命令按阶段与范围筛选

`iagent skills` SHALL 支持 `--phase <design|implement>` 与 `--scope <backend|frontend>` 参数，复用 `selectSkillEntries` 的筛选语义。无参数调用时输出 MUST 与现状逐字段一致。未知 phase 值 SHALL 以非零退出码失败并列出合法值。

#### Scenario: 按阶段筛选

- **WHEN** 执行 `iagent skills --json --phase implement`
- **THEN** 输出仅含 `phases ∈ {implement, both}` 的条目

#### Scenario: 按范围筛选

- **WHEN** 执行 `iagent skills --json --scope backend`
- **THEN** 输出仅含 `scope: backend` 的条目（`scope: null` 的存量条目不排除）

#### Scenario: 无参输出不变

- **WHEN** 执行 `iagent skills --json`
- **THEN** 输出的 `groups` 结构与每项字段 MUST 与改造前一致（含 `validation` 子对象）

#### Scenario: 未知阶段报错

- **WHEN** 执行 `iagent skills --json --phase invalid`
- **THEN** 命令 SHALL 以非零退出码结束并列出合法 phase 值

### Requirement: 新增参数同步补全表

新增的 CLI 参数 MUST 同步到 `src/commands/completion.ts` 的 `IAGENT_COMMANDS` 表，使 shell 补全反映新参数。

#### Scenario: 补全覆盖新参数

- **WHEN** 生成 bash / pwsh 补全脚本
- **THEN** 脚本 SHALL 含 `rules` 的 `--type` 与 `skills` 的 `--phase` / `--scope`
