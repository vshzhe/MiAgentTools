## ADDED Requirements

### Requirement: Command-form references resolve to installed skill references

指令产物（`namespace-dir` 与 `prefixed-file` 两种布局）SHALL 把正文中的 `references/<file>` 重写为配对技能目录下可解析的路径，路径 SHALL 由宿主 `skillsDir` 与 canonical 技能 ID 派生。指令产物 MUST NOT 保留指向 `<commandsDir>/references/...` 的裸相对路径。

#### Scenario: Claude 指令重写 references

- **WHEN** 生成 `.claude/commands/iagent/spec-apply.md`
- **THEN** 其中的 `references/compile-check.md` SHALL 指向 `.claude/skills/iagent-spec-apply/references/compile-check.md`
- **AND** 该路径 SHALL 与 `iagent init` / `iagent update` 实际写入的技能参考文件一致

#### Scenario: Pi prompt 重写 references

- **WHEN** 生成 `.pi/prompts/iagent-spec-explore.md`
- **THEN** 其中的 `references/*.md` SHALL 指向 `.pi/skills/iagent-spec-explore/references/*.md`
- **AND** MUST NOT 指向 `.pi/prompts/references/...`

#### Scenario: 指令 references 可解析测试

- **WHEN** 对所有指令模板执行引用解析检查
- **THEN** 每个 `references/*.md` 引用 SHALL 能映射到某个技能模板声明的 `references` 路径
- **AND** 存在不可解析引用时测试 SHALL 失败并列出指令 id 与路径

### Requirement: Gate policy block matches skill gate reality

门策略块 SHALL 按技能实际承载渲染：含 `⛔ GATE:` 的技能使用「有门」变体；零门技能使用「仅负向清单」变体；只读技能使用「只读、不承载阶段门」变体。`GATE PROTOCOL — ACTIVE` 导言 MUST NOT 出现在零门技能中。

#### Scenario: 零门技能无 GATE 导言

- **WHEN** 生成 `spec-propose` / `spec-verify` / `spec-archive` 的技能或指令产物
- **THEN** 产物 MUST NOT 含「本技能包含以 ⛔ GATE: 标记的确认门」
- **AND** SHALL 含按实际承载选择的门策略变体

#### Scenario: 有门技能保留导言

- **WHEN** 生成 `workflow` / `debug` / `spec-explore` 的产物
- **THEN** 产物 SHALL 含 `GATE PROTOCOL — ACTIVE`
- **AND** SHALL 含对应 `⛔ GATE:` 标记

### Requirement: Template bodies are host-neutral

技能模板正文 MUST NOT 硬编码宿主专属工具名（`AskUserQuestion`、`Task 工具`、`Skill 工具` 等）。用户提问与阶段委派机制 SHALL 由生成期按宿主渲染（如 `renderAskUser()` / `renderDelegate()`）。

#### Scenario: 模板正文无宿主工具名

- **WHEN** 扫描 `src/core/templates/workflows/*.ts` 的模板正文
- **THEN** MUST NOT 出现 `AskUserQuestion`
- **AND** MUST NOT 出现 `Task 工具`

#### Scenario: 生成期注入宿主机制

- **WHEN** 为 Claude 生成技能产物
- **THEN** 用户提问 SHALL 渲染为宿主可用的提问机制
- **AND** 为 Codex / Pi degraded 生成时 MUST NOT 出现不可用的宿主工具名
