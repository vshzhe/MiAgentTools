## ADDED Requirements

### Requirement: spec-explore 委派执行模式（delegated）契约

`iagent_spec_explore` SHALL 支持两种执行模式，由 Input 参数 `mode` 选择：`interactive`（默认）与 `delegated`。

`interactive` 模式行为 MUST 与引入本契约前完全一致：保持立场式设计（`## The Stance`——无固定步骤、无强制产出、无强制探索文件创建时机；提示词校验门与功能流程图门仍为条件触发），MUST NOT 因本契约把手动探索改造为固定步骤流程。

`delegated` 模式为**编排器调用**而设，SHALL 执行编排器内联版曾承载的**强制 checkpoint 体系**（不可跳过），并产出结构化 handoff：

1. **调用即强制创建探索文件**：`openspec/explorations/<keyword>-explore-<NNN>.md`（keyword 取自主题 kebab-case、同 keyword 序号递增、冲突重试后加时间戳），先于 CONTEXT.md 检查与任何代码库扫描/提问；
2. **提示词校验门**（复用 `prompt-gate.ts` 单一源）：清晰直通 / 不明确阻塞确认 / 软不明确记 `[假设]`；基线落盘 `## 提示词基线`；
3. **CONTEXT.md 启动检查**（既有要求保留）；
4. **CodeGraph 强制首动作**：`codegraph_status` 确认可用前禁止 Glob/Grep 回退；包含**多项目路径派发扫描**与**深度分析触发**；
5. **L1-L5 grill 追问**（**新增**）：L1 意图 → L2 方案 → L3 异常 → L4 一致性 → L5 边界，逐级确认门，一次一问，最低深度 L3，跳过级别记入 Pending；
6. **功能流程图产出与流程最终确认门**（复用 `flowchart-gate.ts` 单一源，四出口模型）；
7. **聚合一致性门**（**新增**）：逐对扫描技术选型冲突 / 依赖方向冲突 / 约束互斥三类硬冲突，发现则暂停呈请用户裁决，禁止自动解决；空 Decisions 显式记录 vacuity-pass；
8. **探索完成检测**（**新增**）与**结构化 handoff**：输出探索文件路径、提示词基线、流程基准确认状态（确认 / 未确认降级）、Pending 影响符号（供 Phase 2 影响分析）。

`delegated` 模式 SHALL 保留全部**对话级确认门**（提示词门、L1-L5 追问门、流程最终确认门）——auto 语义 MUST NOT 使其被跳过。`delegated` 完成后 MUST NOT 自行进入提案或实现；阶段推进主权归编排器。

#### Scenario: interactive 保持立场式不变

- **WHEN** 用户以 `/iagent:spec-explore <主题>` 手动调用（未传 `mode`）
- **THEN** 技能以 `interactive` 模式运行：不强制探索文件创建时机、无 L1-L5 强制追问、无聚合一致性门；`## The Stance` 的"无固定步骤"定位不变

#### Scenario: delegated 强制 checkpoint 体系

- **WHEN** 编排器以 `mode=delegated` 委派技能
- **THEN** 技能调用即创建探索文件，依次执行提示词校验门、CONTEXT.md 检查、CodeGraph 基础扫描（含多项目派发与深度分析触发）、L1-L5 grill 追问、功能流程图与流程最终确认门、聚合一致性门、探索完成检测

#### Scenario: delegated 的 L1-L5 追问门逐级等待

- **WHEN** `delegated` 模式进入 L1-L5 grill
- **THEN** 逐级一次一问并在每级等待用户确认，最低深度 L3；跳过的级别记入 Pending；未获确认时不进入下一级

#### Scenario: delegated 的聚合一致性门拦截硬冲突

- **WHEN** 探索产出的 Decisions 中存在决策 A 选 SQLite 且决策 B 依赖 Postgres 特有功能
- **THEN** 技能暂停并呈现冲突决策对与方向询问，用户裁决前不输出完成 handoff；空 Decisions 时显式记录 vacuity-pass 后继续

#### Scenario: delegated 产出结构化 handoff 并交回主权

- **WHEN** `delegated` 模式探索完成
- **THEN** 技能 MUST 输出结构化 handoff（探索文件路径、提示词基线、流程基准确认状态、Pending 影响符号），并 MUST NOT 自行进入提案/实现；由编排器消费 handoff 并推进阶段

#### Scenario: delegated 不跳过确认门

- **WHEN** 审阅 `spec_explore` 的 `delegated` 模式正文
- **THEN** 正文 MUST NOT 声明 `delegated` 跳过提示词校验门、L1-L5 追问门或流程最终确认门；`delegated` 仅使强制 checkpoint 体系生效，不让出确认门

#### Scenario: 探索文件缺失时 handoff 报告异常

- **WHEN** `delegated` 模式下探索文件未能创建或其内容校验未通过
- **THEN** 结构化 handoff SHALL 报告缺失/异常状态（MUST NOT 产出伪造的流程基准），编排器按既有恢复路径处理（重试或终止返回探索），MUST NOT 静默继续到提案阶段
