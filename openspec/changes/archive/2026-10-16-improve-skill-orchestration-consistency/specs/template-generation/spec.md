## ADDED Requirements

### Requirement: 模板正文 SHALL 无 Markdown-first 主产物残留

全部技能模板与斜杠指令正文（`SkillTemplate.instructions`、`CommandTemplate.content`、`SkillTemplate.references[].content`）MUST NOT 指示把 `change.json` / `tasks.json` 作为**新变更**的写目标或重渲染来源。仅允许出现于明确的"历史 / 已归档变更只读降级"语境（含 `WARN` / `legacy` / `只读` 限定词）。

#### Scenario: migration 修复任务状态不再回写 JSON

- **WHEN** `iagent_migration` Phase 4 修复循环更新任务状态
- **THEN** 正文 SHALL 指示直接编辑 `tasks.md`（勾选 / 新增任务）
- **AND** MUST NOT 指示 `sync the change tasks.json` 或 `re-render tasks.md`

#### Scenario: 回归锁扫描全部模板

- **WHEN** 运行跨切面一致性回归锁
- **THEN** 测试 SHALL 扫描全部技能模板、指令模板与 references 正文
- **AND** 命中 `tasks.json` / `change.json` 的写动词（`sync` / `write` / `re-render` / `update`）且不在 legacy 只读白名单内时 SHALL 失败

### Requirement: 门控导言与调用类白名单 SHALL 单一源

含确认门的技能模板 MUST 通过共享常量引入门控导言 `GATE_PROTOCOL_PREAMBLE`；调用类白名单条目（CodeGraph MCP、`Skill(...)`、`Agent, Task`）MUST 经 `tool-whitelist.ts` 共享常量构造。同一文本 / 条目 MUST NOT 在多个模板各写一份字面量。

#### Scenario: 六个含门技能均使用共享导言

- **WHEN** 检查 `iagent_spec_explore` / `iagent_spec_propose` / `iagent_migration` / `iagent_workflow` / `iagent_auto_workflow` / `iagent_debug`
- **THEN** 各模板 SHALL 引用 `GATE_PROTOCOL_PREAMBLE` 常量
- **AND** MUST NOT 内联手写该导言文本

#### Scenario: 门控导言字面量唯一

- **WHEN** 运行回归锁扫描模板源码
- **THEN** `GATE PROTOCOL — ACTIVE` 字面量 SHALL 仅出现于 `prompt-gate.ts` 常量定义处
- **AND** 其它模板源码命中该字面量时 SHALL 失败

### Requirement: references 文件 SHALL 无孤儿

每个 `SkillTemplate.references[]` 声明的文件 MUST 在主 `SKILL.md` 正文中被显式引用（形如 `references/<topic>.md`）。声明但从未被引用的 reference 文件 MUST NOT 存在。

#### Scenario: 孤儿 references 被拦截

- **WHEN** 运行回归锁扫描技能模板
- **THEN** 每个 references 路径 SHALL 在主正文中被引用
- **AND** 命中孤儿（声明未引用）时 SHALL 失败

#### Scenario: workflow / auto-workflow 清理孤儿门控文件

- **WHEN** 检查 `iagent_workflow` 与 `iagent_auto_workflow` 的 references
- **THEN** 二者 MUST NOT 携带未被引用的 `references/prompt-gate.md` / `references/flowchart-gate.md`
- **AND** 其门控语义 SHALL 经委派的 `iagent_spec_explore` 提供（workflow 另保留被引用的 `verification-protocol.md`）

### Requirement: 指令正文派生覆盖 SHALL 可度量

从技能唯一源派生指令压缩版（`deriveCommandContent`）的模板数量 SHALL 随本变更提升；未派生的手写指令正文 MUST 与配对技能在"阶段骨架 / 确认门 / 委派清单"上保持一致，差异 MUST 被漂移测试或评审记录覆盖。

#### Scenario: 编排技能指令与技能骨架一致

- **WHEN** 比较 `iagent_workflow` 技能版与指令版的阶段标题
- **THEN** 指令版 SHALL 覆盖技能版的全部阶段骨架与确认门
- **AND** MUST NOT 出现技能版有而指令版缺失的关键阶段（如 Phase 2.0 预迁移验证）

#### Scenario: 派生覆盖度可观测

- **WHEN** 运行测试统计指令正文派生覆盖
- **THEN** 使用 `deriveCommandContent` 的模板数 SHALL ≥ 8（既有基线）
- **AND** 手写指令清单 SHALL 在测试中以快照或清单形式锁定，新增手写项触发评审

### Requirement: 技能命名与注释一致性

模板源码中的技能清单（如 `prompt-gate.ts` / `flowchart-gate.ts` 文档注释）MUST 与实际使用该模块的技能集合一致；`proposal-review` 等技能的阶段编号 MUST 连续。

#### Scenario: 注释不重复计数

- **WHEN** 检查 `prompt-gate.ts` / `flowchart-gate.ts` 文档注释列出的技能
- **THEN** 每个技能名 SHALL 只出现一次
- **AND** 列表 SHALL 与实际导入该模块的模板集合一致

#### Scenario: Phase 编号连续

- **WHEN** 检查 `iagent_proposal_review` 主 SKILL.md 的阶段标题
- **THEN** Phase 编号 SHALL 连续
- **AND** 下沉至 references 的阶段 SHALL 在主文件以明确指针标注（如"Phase 5-8 见 references/detail-checks.md"）

## REMOVED Requirements

### Requirement: `iagent spec instructions` SHALL 输出 jsonTemplate 字段
**Reason**: 与 Markdown-first 契约冲突——`iagent spec instructions` 已不再输出 `jsonTemplate`（`test/markdown-first-regression.test.ts` 断言其不存在），JSON 段落不再是新变更真源。
**Migration**: `template`（Markdown 模板）字段为唯一指令来源；历史 JSON 变更经 `iagent spec migrate --from-json` 显式迁移。

### Requirement: 生成协议 SHALL 单一源，模板正文引用不复制
**Reason**: 该需求以 JSON-first 生成步骤（写段 → render）为前提，已被 Markdown-first 制品生成协议取代。
**Migration**: 制品生成协议单一源改为 `openspec/rules/artifact-generation.md`（Markdown-first），由 `artifact-generation-protocol` 能力承载。

### Requirement: JSON-first 模板改动 SHALL 同步白名单与快照
**Reason**: 以 JSON 读写与 `iagent spec render` 为前提，Markdown-first 下不再适用。
**Migration**: 模板改动仍须同步白名单与快照（见本能力「模板正文 SHALL 无 Markdown-first 主产物残留」与 `tool-call-whitelist`），触发条件改为 Markdown 制品改动。
