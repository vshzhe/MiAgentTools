## ADDED Requirements

### Requirement: 委托模式双轴词汇单一源

技能间的委托参数 SHALL 拆为两个正交轴，词汇取值 MUST 收敛到单一常量源（`src/core/host-orchestration/delegation-contract.ts`），模板正文 MUST 插值引用该常量，MUST NOT 手写第二份取值表：

- **轴一 `mode`（执行归属）**：`interactive`（默认）| `delegated`。`delegated` 语义 = 抑制结尾停点、抑制被委派技能自身验证、输出结构化回执、禁止输出「等待用户确认」停点。该轴 MUST NOT 豁免任何业务确认门。
- **轴二（`gate-policy` 轴，参数 `gate-skip=<gate-id>`）门承载**：声明哪些业务门已由父级确认。`gate-policy` 仅为该轴的**概念轴名**，MUST NOT 作为参数键被解析或渲染；唯一传参形式为 `gate-skip=<gate-id>`。当前唯一合法取值 `design-confirmation`；未知 gate id MUST 被拒绝或忽略并记 WARN，MUST NOT 静默按「全部门已跳过」处理。

`auto-mode=true` SHALL 仅映射到**轴二**（等价 `gate-skip=design-confirmation`），`mode` 保持调用方原值；MUST NOT 把 `auto-mode=true` 视为 `mode=delegated` 的等价别名，MUST NOT 由它抑制停点、抑制自验证或免除此外的门。

正文与文档 MUST 将 `mode` 显式限定为「委托模式（delegation mode）」，与宿主原生 `mode` 字段（OpenCode agent frontmatter 的 `primary|subagent`、Claude Code 的权限模式）区分，MUST NOT 要求模型把技能正文的 `mode` 解释为宿主权限或执行模式。

#### Scenario: 模板词汇由常量产出

- **WHEN** 检索任一技能模板中的委托参数取值（`interactive` / `delegated` / `gate-skip` / `design-confirmation`）
- **THEN** 该取值 SHALL 来自 `delegation-contract.ts` 的常量或渲染函数，MUST NOT 出现与常量不一致的手写副本

#### Scenario: auto-mode 仅映射门承载轴

- **WHEN** 解析 `auto-mode=true`
- **THEN** 结果 SHALL 为「`gate-skip` 含 `design-confirmation`、`mode` 保持原值」，MUST NOT 附带 `delegated` 的停点抑制或自验证抑制

#### Scenario: 两个轴不可互换

- **WHEN** 仅传 `mode=delegated`（未传 `gate-skip`）
- **THEN** 设计确认门等业务门 SHALL 照常触发，MUST NOT 因 `mode=delegated` 被跳过

#### Scenario: 未知 gate id 不被静默接受

- **WHEN** 传入 `gate-skip=<未知门 id>`
- **THEN** 系统 SHALL 拒绝该取值或忽略并记 WARN，MUST NOT 据此跳过任何门

#### Scenario: 词汇与宿主原生 mode 字段区分

- **WHEN** 审阅任一技能正文中 `mode` 的说明
- **THEN** 正文 SHALL 明确其为「委托模式」并与宿主原生 `mode`（OpenCode agent 的 `primary|subagent`、Claude 权限模式）区分

### Requirement: spec-apply 门承载参数契约

`iagent_spec_apply` SHALL 接受 `gate-skip=design-confirmation` 作为门承载参数，并继续接受 `auto-mode=true` 作为其**兼容等价写法**（语义相同：只跳过设计确认门）。

除设计确认门外，其余停点与门（测试执行门、范围蔓延确认、编译失败处理、批次派发协议、共享资源协议、退出守卫）MUST 照常生效，MUST NOT 因该参数被豁免。

#### Scenario: gate-skip 跳过设计确认门

- **WHEN** apply 以 `gate-skip=design-confirmation` 被调用
- **THEN** Step 5.5 设计确认门整道跳过（批计划仍在内部构建但不向用户展示），直接进入批次调度

#### Scenario: auto-mode 兼容写法行为一致

- **WHEN** 分别以 `auto-mode=true` 与 `gate-skip=design-confirmation` 调用 apply
- **THEN** 两者行为逐条一致（同一道门被跳过，其余门与停点相同）

#### Scenario: 其余门与停点不被豁免

- **WHEN** apply 以 `gate-skip=design-confirmation` 运行并遇到测试失败或范围蔓延
- **THEN** 对应门与停点 SHALL 照常生效，MUST NOT 以「门已跳过」为由继续推进

## MODIFIED Requirements

### Requirement: spec-propose 委派执行模式（delegated）契约

`iagent_spec_propose` SHALL 支持两种执行模式，由 Input 参数 `mode` 选择：`interactive`（默认）与 `delegated`。

`interactive` 模式行为 MUST 与引入本契约前完全一致：保留 Step 0 探索文件关联的**用户提示**（[关联] / [跳过]）、自身 Step 6 Phase 3 验证（委派 `iagent_spec_verify_proposal` + `iagent_requirement_doc`）、以及结尾 “display a design blueprint summary and wait for user confirmation before suggesting implementation” 的规划边界停点。

`delegated` 模式为**编排器调用**而设，SHALL 让出阶段推进主权与编排器已承担的重复步骤，同时保留一切交互确认门：

1. **接受 `exploration-file=<path>` 输入**：跳过 Step 0 的用户提示，直接对该文件执行迁移语义（移入变更目录为 `exploration.md`，成功后删除源文件）；
2. **抑制结尾规划边界停点**：制品完成后不输出 “等待用户确认” 停点，改为输出**结构化回执**（change-name、生成制品清单、apply-ready 状态），控制权交回编排器；
3. **抑制自身 Phase 3 验证**：不调用 `spec_verify_proposal`、不生成需求文档（编排器的 Phase 3 为其超集，含 `proposal_review` 深度复查）；
4. **保留全部对话级确认门语义**：`delegated` 模式 MUST NOT 新增、跳过或放宽任何对话级确认门（delegated 仅涉及阶段主权，不涉及确认门）。

`iagent_spec_apply` 的 `auto-mode=true` SHALL **仅**被文档化为门承载轴的兼容写法（等价 `gate-skip=design-confirmation`），MUST NOT 被声明为 `mode=delegated` 的等价别名 —— 二者分属不同轴、不可互换。两编排器正文 SHALL 使用 `mode=delegated` 表述委派执行归属、使用 `gate-skip=design-confirmation` 表述门承载。

#### Scenario: interactive 默认行为不变

- **WHEN** 用户直接以 `/iagent:spec-propose <描述>` 调用技能（未传 `mode`）
- **THEN** 技能以 `interactive` 模式运行：Step 0 呈现探索文件关联提示、自身 Phase 3 验证照常、结尾输出规划边界停点；行为与引入本契约前一致

#### Scenario: delegated 模式跳过 Step 0 用户提示

- **WHEN** 编排器以 `mode=delegated` + `exploration-file=openspec/explorations/<f>.md` 委派技能
- **THEN** 技能跳过探索文件关联的用户提示，直接迁移该文件为变更目录内 `exploration.md`（成功后删除源文件），并在回执中报告迁移结果

#### Scenario: delegated 模式抑制自身 Phase 3

- **WHEN** `delegated` 模式下全部 applyRequires 制品生成完成
- **THEN** 技能 MUST NOT 调用 `iagent_spec_verify_proposal`、MUST NOT 生成需求文档，直接输出结构化回执交回编排器；由编排器的 Phase 3 执行验证超集

#### Scenario: delegated 模式抑制结尾停点

- **WHEN** `delegated` 模式制品生成完成
- **THEN** 技能 MUST NOT 输出 “wait for user confirmation before suggesting implementation” 停点，改为输出结构化回执

#### Scenario: delegated 不改变确认门

- **WHEN** 审阅 `spec_propose` 的 `delegated` 模式正文
- **THEN** 正文 MUST NOT 声明 `delegated` 跳过任何对话级确认门（如提示词校验门、流程最终确认门、材料性歧义询问）；`delegated` 仅让出阶段推进主权与重复步骤

#### Scenario: auto-mode 不被声明为 delegated 的等价别名

- **WHEN** 审阅 `spec_propose` 的 Input 段与正文
- **THEN** MUST NOT 出现「`auto-mode=true` 为 `mode=delegated` 的等价别名」一类断言；SHALL 说明其仅等价 `gate-skip=design-confirmation`

### Requirement: spec-explore 委派执行模式（delegated）契约

`iagent_spec_explore` SHALL 支持两种执行模式，由 Input 参数 `mode` 选择：`interactive`（默认）与 `delegated`。其 `**Input**` 段 SHALL 显式声明该参数（含 `mode=interactive|delegated` 与 `gate-skip` 的可选说明），MUST NOT 仅在正文深处的 delegated 段落提及，使同一条委托链上的被委派技能契约粒度一致。

`interactive` 模式行为 MUST 与引入本契约前完全一致：保持立场式设计（`## The Stance`——无固定步骤、无强制产出、无强制探索文件创建时机；提示词校验门与功能流程图门仍为条件触发），MUST NOT 因本契约把手动探索改造为固定步骤流程。

`delegated` 模式为**编排器调用**而设，SHALL 执行编排器内联版曾承载的**强制 checkpoint 体系**（不可跳过），并产出结构化 handoff：

1. **调用即强制创建探索文件**：`openspec/explorations/<keyword>-explore-<NNN>.md`（keyword 取自主题 kebab-case、同 keyword 序号递增、冲突重试后加时间戳），先于 CONTEXT.md 检查与任何代码库扫描/提问；
2. **提示词校验门**（复用 `prompt-gate.ts` 单一源）：清晰直通 / 不明确阻塞确认 / 软不明确记 `[假设]`；基线落盘 `## 提示词基线`；
3. **CONTEXT.md 启动检查**（既有要求保留）；
4. **CodeGraph 强制首动作**：`codegraph_status` 确认可用前禁止 Glob/Grep 回退；包含**多项目路径派发扫描**与**深度分析触发**；
5. **L1-L5 grill 追问**：L1 意图 → L2 方案 → L3 异常 → L4 一致性 → L5 边界，逐级确认门，一次一问，最低深度 L3，跳过级别记入 Pending；
6. **功能流程图产出与流程最终确认门**（复用 `flowchart-gate.ts` 单一源，四出口模型）；
7. **聚合一致性门**：逐对扫描技术选型冲突 / 依赖方向冲突 / 约束互斥三类硬冲突，发现则暂停呈请用户裁决，禁止自动解决；空 Decisions 显式记录 vacuity-pass；
8. **探索完成检测**与**结构化 handoff**：输出探索文件路径、提示词基线、流程基准确认状态（确认 / 未确认降级）、Pending 影响符号（供 Phase 2 影响分析），回执字段 SHALL 与编排协议一致（`phase` / `status` / 产物位置 / 下一步允许动作 / 失败原因）。

`delegated` 模式 SHALL 保留全部**对话级确认门**（提示词门、L1-L5 追问门、流程最终确认门）——auto 语义 MUST NOT 使其被跳过。`delegated` 完成后 MUST NOT 自行进入提案或实现；阶段推进主权归编排器。

#### Scenario: interactive 保持立场式不变

- **WHEN** 用户以 `/iagent:spec-explore <主题>` 手动调用（未传 `mode`）
- **THEN** 技能以 `interactive` 模式运行：不强制探索文件创建时机、无 L1-L5 强制追问、无聚合一致性门；`## The Stance` 的“无固定步骤”定位不变

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

#### Scenario: Input 段声明模式契约

- **WHEN** 审阅 `iagent_spec_explore` 的 `**Input**` 段
- **THEN** 该段 SHALL 显式声明 `mode=interactive|delegated`（与 `spec-propose` 同等粒度）与回执字段要求，MUST NOT 把模式契约只写在正文深处的 delegated 段落
