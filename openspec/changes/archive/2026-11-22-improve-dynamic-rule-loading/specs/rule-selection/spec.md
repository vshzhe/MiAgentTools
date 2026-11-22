## ADDED Requirements

### Requirement: 规则源三层归类

系统 SHALL 在 `src/core/rule-selection.ts` 提供纯函数 `classifyRuleSources(sources, options)`，把规则源分为三层：`always`（常驻基线）、`phase`（阶段相关）、`on-demand`（按需点读）。该函数 MUST 为纯函数（无 I/O），证据由调用方注入。

分层判定：

| 层 | 内容 | 判定依据 |
| :--- | :--- | :--- |
| `always` | `.iagent/config.yaml` 的 context、`CLAUDE.md`、`AGENTS.md` | kind ∈ {config, claude-md, agents-md} |
| `phase` | `.iagent/rules/<type>.md` 中与技能类型匹配者 | `ruleFileNameFor(type)`（`project-config.ts` 单一源） |
| `on-demand` | 其余存在的规则源 | 默认归属 |

#### Scenario: 按技能类型归类

- **WHEN** 以 `type: 'test'` 调用 `classifyRuleSources`，项目含 `coding-rules.md` / `testing-rules.md` / `spec.md`
- **THEN** `always` 含 config / `CLAUDE.md` / `AGENTS.md`，`phase` 含 `testing-rules.md`，`on-demand` 含其余两份

#### Scenario: 类型映射走单一源

- **WHEN** 归类任一技能类型对应的规则文件
- **THEN** 判定 MUST 调用 `ruleFileNameFor(type)` / `ruleFileTypeFor(fileName)`
- **AND** MUST NOT 在 `rule-selection.ts` 内另立类型到文件名的映射表

#### Scenario: 常驻基线不受类型影响

- **WHEN** 以任意 `type` 调用归类
- **THEN** `always` 集合 SHALL 恒含 `.iagent/config.yaml`、`CLAUDE.md`、`AGENTS.md`（存在时）
- **AND** 三者 MUST NOT 出现在 `phase` 或 `on-demand`

### Requirement: 技能条目按阶段与范围筛选

系统 SHALL 提供 `selectSkillEntries(entries, { phase, scope })`，按 `phases` 与 `scope` 筛选项目技能条目。`phase` 取值 `design` / `implement`，匹配规则沿用既有语义（`design` → `phases ∈ {design, both}`；`implement` → `phases ∈ {implement, both}`）。`scope` 为可选过滤，为 `null` 或未提供时 MUST NOT 排除任何条目。

#### Scenario: 按阶段筛选

- **WHEN** 以 `phase: 'implement'` 调用且配置含 `phases: design` 与 `phases: implement` 各一条
- **THEN** 结果 SHALL 只含 `implement` 与 `both` 的条目

#### Scenario: 按范围筛选

- **WHEN** 以 `scope: 'backend'` 调用且配置含 `scope: backend` 与 `scope: frontend` 各一条
- **THEN** 结果 SHALL 只含 `backend` 条目

#### Scenario: 存量技能无 scope 字段

- **WHEN** 技能条目 `scope` 为 `null` 且调用方传了 `scope` 过滤
- **THEN** 该条目 MUST NOT 被排除（向后兼容）
- **AND** 结果中保留且不标记为不匹配

### Requirement: 筛选为空时回退常驻基线

当 `phase` 层筛选结果为空时，函数 SHALL 返回 `always` 集合并标记 `fallback: true` 与原因，MUST NOT 回退为全量读取，MUST NOT 抛错。

#### Scenario: 无匹配规则文件

- **WHEN** 技能类型为 `commit`（`RULE_FILE_NAMES` 无映射，回退名 `commit.md` 不存在）
- **THEN** `phase` 层为空、`fallback=true`，调用方据 `always` 继续
- **AND** 输出 SHALL 含 WARN 级提示说明已回退

#### Scenario: 回退不扩大为全量

- **WHEN** 发生 `fallback`
- **THEN** 结果 MUST NOT 包含 `on-demand` 层的全部条目
- **AND** `on-demand` 仍须由调用方显式声明相关性后才读取
