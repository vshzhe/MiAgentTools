## MODIFIED Requirements

### Requirement: SKILL.md 渐进披露与尺寸预算

技能主 `SKILL.md` SHALL 遵循渐进披露，并同时满足**双重体积预算**：

1. 行数 MUST ≤ **500 行**；
2. 生成后 `SKILL.md` 全文字符数（含 frontmatter，按 `fileContent.length` 计）MUST ≤ **20,000 字符**。

两个预算并行生效，以更严格者为准。超出任一预算的技能 MUST 将参考性内容下沉至 `references/*.md`（经 `SkillTemplate.references`），或删除与子技能协议重复的正文，直至同时满足双预算；主文件以一行 `Read references/<topic>.md` 引导按需加载。

主文件 MUST 保留「看到即需执行」的**控制流内容**：触发条件、阶段骨架、确认门、阶段顺序、委派清单、Guardrails 与 CLI 契约要点。参考性内容 MUST 下沉：评分维度细则与检查矩阵、评分示例、L1-L5 问句库、长代码/模板示例、字段级表格、检查点日志示例。子技能协议的正文（如 apply 的测试门 / 编译门 / 冲突处理）MUST 留在子技能，编排技能 MUST NOT 复述。

下沉 MUST 复用既有 `references` 机制（`writeSkillReferences` / `syncReferences`），MUST NOT 引入新语法或改 `SkillReference` 契约。本要求 MUST NOT 改变任何技能的行为语义（确认门、阶段、委派面、`allowedTools` 白名单）。

#### Scenario: 主文件双重预算

- **WHEN** 生成或检查任一技能的主 `SKILL.md`
- **THEN** 其行数 MUST ≤ 500，且全文字符数 MUST ≤ 20,000
- **AND** 超出任一预算的技能 MUST 通过下沉 references 或删除重复正文收敛至双预算内

#### Scenario: 字符预算测量口径固定

- **WHEN** 测试计算主 `SKILL.md` 的体积
- **THEN** 字符数 SHALL 取生成后全文（含 frontmatter）的 `string.length`
- **AND** MUST NOT 以字节数、UTF-8 编码长度或仅正文长度替代该口径

#### Scenario: 控制流内容保留主文件

- **WHEN** 拆分某超预算技能
- **THEN** 其触发条件、阶段骨架、确认门、阶段顺序、委派清单与 Guardrails MUST 仍在主文件
- **AND** 被下沉的 MUST 仅为参考性内容（评分细则/矩阵/示例/问句库/长样例/检查点日志）

#### Scenario: references 引用存在

- **WHEN** 主 `SKILL.md` 正文引用 `Read references/<topic>.md`
- **THEN** 该 `<topic>.md` MUST 存在于 `SkillTemplate.references`（并经生成写入技能目录）
- **AND** 测试 MUST 断言引用与文件一一对应

#### Scenario: 语义零变化

- **WHEN** 审阅内容分层后的技能
- **THEN** 其 `allowedTools`、确认门关键词、阶段编号与委派面 MUST 与分层前一致
- **AND** 仅文本位置与工具词表述发生变化（主文件缩短 + `references/` 新增）

#### Scenario: references 随 update 同步无残留

- **WHEN** `iagent update` 刷新含 references 的技能
- **THEN** `syncReferences` 先删除旧 `references/` 再写入新文件，无旧文件残留（既有行为回归）

#### Scenario: 尺寸预算对最终形态生效

- **WHEN** 对 `workflow` / `auto-workflow` / `spec-explore` 等编排技能执行内容下沉
- **THEN** 下沉 SHALL 以当前最终正文为基线，尺寸预算测试对最终形态生效
- **AND** MUST NOT 对将被重写的旧正文先行下沉再返工

### Requirement: Template bodies are host-neutral

技能模板正文（`SkillTemplate.instructions` 与 `SkillTemplate.references[].content`）MUST NOT 硬编码宿主专属工具名或机制名，包括但不限于 `AskUserQuestion`、`Task 工具`、`Skill 工具`、`TodoWrite`、`mcp__codegraph__*`、`mcp__plugin_semgrep_*`。用户提问、阶段委派与工具调用机制 SHALL 由生成期按宿主渲染（如 `renderAskUser()` / `renderDelegate()`），或使用宿主中立名（如 `codegraph_explore` / `codegraph_impact` /「宿主待办工具（可用时）」）。

模板正文需要引用 CodeGraph 或 Semgrep 时 SHALL 使用不带 `mcp__` 前缀的工具名，并注明「宿主暴露时使用」；MUST NOT 把某一宿主的 MCP 全名写成跨宿主硬约束。回归测试 MUST 扫描全部模板正文，命中禁用工具词时失败并输出技能 id 与行号。

#### Scenario: 模板正文无宿主工具名

- **WHEN** 扫描 `src/core/templates/workflows/*.ts` 的模板正文与 references 内容
- **THEN** MUST NOT 出现 `AskUserQuestion`、`Task 工具`、`TodoWrite`
- **AND** MUST NOT 出现 `mcp__codegraph__` / `mcp__plugin_semgrep_` 字面量（`tool-whitelist.ts` 白名单常量除外）

#### Scenario: 生成期注入宿主机制

- **WHEN** 为 Claude 生成技能产物
- **THEN** 用户提问 SHALL 渲染为宿主可用的提问机制
- **AND** 为 Codex / Pi degraded 生成时 MUST NOT 出现不可用的宿主工具名

#### Scenario: 宿主工具词回归锁

- **WHEN** 任一模板新增 `TodoWrite` / `mcp__*` 字面量
- **THEN** 回归测试 SHALL 失败并指出技能 id 与行号
- **AND** 允许清单 SHALL 仅包含 `tool-whitelist.ts` 中的白名单常量

### Requirement: 技能命名与注释一致性

模板源码中的技能清单（如 `prompt-gate.ts` / `flowchart-gate.ts` 文档注释）MUST 与实际使用该模块的技能集合一致；`proposal-review` 等技能的阶段编号 MUST 连续。模块注释中的技能数量、技能名与阶段编号 MUST 与当前注册表及模板实际导入集合一致，MUST NOT 保留历史数量。

#### Scenario: 注释不重复计数

- **WHEN** 检查 `prompt-gate.ts` / `flowchart-gate.ts` 文档注释列出的技能
- **THEN** 每个技能名 SHALL 只出现一次
- **AND** 列表 SHALL 与实际导入该模块的模板集合一致

#### Scenario: 门协议导言使用集合与注释一致

- **WHEN** 检查 `prompt-gate.ts` 中 `GATE_PROTOCOL_PREAMBLE` 的文档注释
- **THEN** 注释列出的技能集合 SHALL 等于实际引用该常量的模板集合（当前为 `debug` / `migration` / `spec-explore` / `spec-update` / `workflow`）
- **AND** 数量表述 MUST NOT 保留历史值（如「4 个」）

#### Scenario: Phase 编号连续

- **WHEN** 检查 `iagent_proposal_review` 主 SKILL.md 的阶段标题
- **THEN** Phase 编号 SHALL 连续
- **AND** 下沉至 references 的阶段 SHALL 在主文件以明确指针标注（如"Phase 5-8 见 references/detail-checks.md"）
