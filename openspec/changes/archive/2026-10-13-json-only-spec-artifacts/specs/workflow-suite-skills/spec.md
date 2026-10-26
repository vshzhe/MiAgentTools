# Spec Delta

## ADDED Requirements

### Requirement: 编排技能 MUST NOT 生成或依赖 proposal/design/specs MD

`iagent_workflow` / `iagent_auto_workflow` / `iagent_debug` / `iagent_full_workflow` MUST NOT 生成、渲染或要求 proposal.md / design.md / specs/*.md 作为变更制品。其制品读写 MUST 以 `change.json`（proposal / design / specs 段）+ `tasks.json` 为准；仅在处理存量 / 已归档变更（无 `change.json`）时 MAY 只读降级解析既有 MD 并记 WARN。`tasks.md` 仅由 `iagent spec render tasks` 产出。

#### Scenario: debug Phase 6 不以 MD 为同步目标
- **WHEN** `iagent_debug` Phase 6 同步提案
- **THEN** SHALL 只更新 `change.json` 的 proposal 段与 `tasks.json`，并运行 `iagent spec render tasks`
- **AND** MUST NOT 运行 `iagent spec render proposal|design|specs`，MUST NOT 编辑或生成对应 MD

#### Scenario: full-workflow Bridge 2 就绪检查以 JSON 为准
- **WHEN** `iagent_full_workflow` Bridge 2 检查制品就绪
- **THEN** 就绪判定 SHALL 依据 `change.json` 的 proposal / design / specs 段 + `tasks.json` 的存在与完整
- **AND** MUST NOT 以 proposal.md / design.md / specs/*.md / tasks.md 文件齐全作为就绪条件

#### Scenario: auto-workflow 读取结构化来源
- **WHEN** `iagent_auto_workflow` 读取提案的 Impact Analysis / design 内容
- **THEN** SHALL 读 `change.json` 对应段，MUST NOT 依赖 proposal.md / design.md 的段落标题

#### Scenario: workflow 内联生成不落 MD
- **WHEN** `iagent_workflow` Phase 2 内联生成制品
- **THEN** SHALL 只写 `change.json` + `tasks.json`（tasks.md 由渲染命令产出），MUST NOT 手写 proposal/design/specs MD

#### Scenario: 存量变更只读降级
- **WHEN** 编排技能处理无 `change.json` 的存量 / 已归档变更
- **THEN** MAY 只读降级解析既有 MD 并记 WARN，MUST NOT 回写或重渲染这些 MD
