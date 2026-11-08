## MODIFIED Requirements

### Requirement: spec-explore 委派执行模式（delegated）契约

`iagent_spec_explore` SHALL 支持两种执行模式，由 Input 参数 `mode` 选择：`interactive`（默认）与 `delegated`。其 `**Input**` 段 SHALL 显式声明该参数（含 `mode=interactive|delegated` 与 `gate-skip` 的可选说明），MUST NOT 仅在正文深处的 delegated 段落提及，使同一条委托链上的被委派技能契约粒度一致。

`interactive` 模式行为 MUST 与引入本契约前完全一致：保持立场式设计（`## The Stance`——无固定步骤、无强制产出、无强制探索文件创建时机；提示词校验门与功能流程图门仍为条件触发），MUST NOT 因本契约把手动探索改造为固定步骤流程。

`delegated` 模式为**编排器调用**而设，SHALL 执行编排器内联版曾承载的**强制 checkpoint 体系**（不可跳过），并产出结构化 handoff：

1. **调用即强制创建探索文件**：`openspec/explorations/<keyword>-explore-<NNN>.md`（keyword 取自主题 kebab-case、同 keyword 序号递增、冲突重试后加时间戳），先于 CONTEXT.md 检查与任何代码库扫描/提问；
2. **提示词校验门**（复用 `prompt-gate.ts` 单一源）：清晰直通 / 不明确阻塞确认 / 软不明确记 `[假设]`；基线落盘 `## 提示词基线`；
3. **CONTEXT.md 启动检查**（既有要求保留）；
4. **CodeGraph 强制首动作**：能力探测三通道（MCP 具名工具 → 时效横幅 → CLI）确认可用前禁止 Glob/Grep 回退；包含**多项目路径派发扫描**与**深度分析触发**；
5. **L1-L5 grill 追问**：L1 意图 → L2 方案 → L3 异常 → L4 一致性 → L5 边界，按两轮批量确认（L1-L3、L4-L5），最低深度 L3，跳过级别记入 Pending；
6. **功能流程图产出与流程最终确认门**（复用 `flowchart-gate.ts` 单一源，四出口模型）；
7. **聚合一致性门**：逐对扫描技术选型冲突 / 依赖方向冲突 / 约束互斥三类硬冲突，发现则暂停呈请用户裁决，禁止自动解决；空 Decisions 显式记录 vacuity-pass；
8. **探索完成检测**与**结构化 handoff**：输出探索文件路径、提示词基线、流程基准确认状态（确认 / 未确认降级）、Pending 影响符号（供 Phase 2 影响分析），回执字段 SHALL 与编排协议一致（`phase` / `status` / 产物位置 / 下一步允许动作 / 失败原因）。

`delegated` 模式 SHALL 保留全部**对话级确认门**（提示词门、L1-L5 追问门、流程最终确认门）——auto 语义 MUST NOT 使其被跳过。`delegated` 完成后 MUST NOT 自行进入提案或实现；但其回执 SHALL 被视为**中间状态**：当编排器与探索在同一 agent 上下文执行时，探索收束后 MUST 在同一用户回合内继续编排器的下一阶段；MUST NOT 以回执作为终态消息结束回合。阶段推进主权归编排器。

#### Scenario: interactive 保持立场式不变

- **WHEN** 用户以 `/iagent:spec-explore <主题>` 手动调用（未传 `mode`）
- **THEN** 技能以 `interactive` 模式运行：不强制探索文件创建时机、无 L1-L5 强制追问、无聚合一致性门；`## The Stance` 的"无固定步骤"定位不变

#### Scenario: delegated 强制 checkpoint 体系

- **WHEN** 编排器以 `mode=delegated` 委派技能
- **THEN** 技能调用即创建探索文件，依次执行提示词校验门、CONTEXT.md 检查、CodeGraph 基础扫描（含多项目派发与深度分析触发）、L1-L5 grill 追问、功能流程图与流程最终确认门、聚合一致性门、探索完成检测

#### Scenario: delegated 的 L1-L5 追问按批量确认

- **WHEN** `delegated` 模式进入 L1-L5 grill
- **THEN** 按两轮批量确认（L1-L3、L4-L5）呈现，最低深度 L3；跳过的级别记入 Pending；未获确认时不进入下一级

#### Scenario: delegated 的聚合一致性门拦截硬冲突

- **WHEN** 探索产出的 Decisions 中存在决策 A 选 SQLite 且决策 B 依赖 Postgres 特有功能
- **THEN** 技能暂停并呈现冲突决策对与方向询问，用户裁决前不输出完成 handoff；空 Decisions 时显式记录 vacuity-pass 后继续

#### Scenario: delegated 产出 handoff 后同回合续跑

- **WHEN** `delegated` 模式探索完成并输出结构化 handoff
- **THEN** 技能 MUST 输出探索文件路径、提示词基线、流程基准确认状态与 Pending 影响符号
- **AND** 当编排器与探索在同一 agent 上下文执行时 MUST 在同一用户回合内继续编排器的下一阶段，MUST NOT 以回执结束回合
- **AND** 若编排器为独立子代理上下文，则回执返回父级后由父级继续

#### Scenario: delegated 不跳过确认门

- **WHEN** 审阅 `spec_explore` 的 `delegated` 模式正文
- **THEN** 正文 MUST NOT 声明 `delegated` 跳过提示词校验门、L1-L5 追问门或流程最终确认门；`delegated` 仅使强制 checkpoint 体系生效，不让出确认门

#### Scenario: 探索文件缺失时 handoff 报告异常

- **WHEN** `delegated` 模式下探索文件未能创建或其内容校验未通过
- **THEN** 结构化 handoff SHALL 报告缺失/异常状态（MUST NOT 产出伪造的流程基准），编排器按既有恢复路径处理（重试或终止返回探索），MUST NOT 静默继续到提案阶段

#### Scenario: Input 段声明模式契约

- **WHEN** 审阅 `iagent_spec_explore` 的 `**Input**` 段
- **THEN** 该段 SHALL 显式声明 `mode=interactive|delegated`（与 `spec-propose` 同等粒度）与回执字段要求，MUST NOT 把模式契约只写在正文深处的 delegated 段落

### Requirement: spec-propose 委派执行模式（delegated）契约

`iagent_spec_propose` SHALL 支持两种执行模式，由 Input 参数 `mode` 选择：`interactive`（默认）与 `delegated`。

`interactive` 模式行为 MUST 与引入本契约前一致：保留 Step 0 探索文件关联的**用户提示**（[关联] / [跳过]）、自身 Phase 3 验证（委派 `iagent_spec_verify_proposal`；**不生成需求文档、不委派 `iagent_requirement_doc`**）、以及结尾 "display a design blueprint summary and wait for user confirmation before suggesting implementation" 的规划边界停点。

`delegated` 模式为**编排器调用**而设，SHALL 让出阶段推进主权与编排器已承担的重复步骤，同时保留一切交互确认门：

1. **接受 `exploration-file=<path>` 输入**：跳过 Step 0 的用户提示，直接对该文件执行迁移语义（移入变更目录为 `exploration.md`，成功后删除源文件）；
2. **抑制结尾规划边界停点**：制品完成后不输出 "等待用户确认" 停点，改为输出**结构化回执**（change-name、生成制品清单、apply-ready 状态）；
3. **抑制自身 Phase 3 验证**：不调用 `spec_verify_proposal`、不生成需求文档（编排器的 Phase 3 为其超集，含 `proposal_review` 深度复查）；
4. **保留全部对话级确认门语义**：`delegated` 模式 MUST NOT 新增、跳过或放宽任何对话级确认门（delegated 仅涉及阶段主权，不涉及确认门）。

`delegated` 回执 SHALL 被视为**中间状态**：回执返回后，父编排 MUST 在同一用户回合内继续验证阶段；`spec_propose` MUST NOT 输出"等待用户确认"停点或结束父级回合。

`iagent_spec_apply` 的 `auto-mode=true` SHALL **仅**被文档化为门承载轴的兼容写法（等价 `gate-skip=design-confirmation`），MUST NOT 被声明为 `mode=delegated` 的等价别名 —— 二者分属不同轴、不可互换。两编排器正文 SHALL 使用 `mode=delegated` 表述委派执行归属、使用 `gate-skip=design-confirmation` 表述门承载。

#### Scenario: interactive 默认行为不变且不生成文档

- **WHEN** 用户直接以 `/iagent:spec-propose <描述>` 调用技能（未传 `mode`）
- **THEN** 技能以 `interactive` 模式运行：Step 0 呈现探索文件关联提示、自身 Phase 3 验证照常、结尾输出规划边界停点
- **AND** MUST NOT 生成需求文档、MUST NOT 委派 `iagent_requirement_doc`

#### Scenario: delegated 模式跳过 Step 0 用户提示

- **WHEN** 编排器以 `mode=delegated` + `exploration-file=openspec/explorations/<f>.md` 委派技能
- **THEN** 技能跳过探索文件关联的用户提示，直接迁移该文件为变更目录内 `exploration.md`（成功后删除源文件），并在回执中报告迁移结果

#### Scenario: delegated 模式抑制自身 Phase 3

- **WHEN** `delegated` 模式下全部 applyRequires 制品生成完成
- **THEN** 技能 MUST NOT 调用 `iagent_spec_verify_proposal`、MUST NOT 生成需求文档，直接输出结构化回执交回编排器；由编排器的 Phase 3 执行验证超集

#### Scenario: delegated 模式抑制结尾停点并续跑

- **WHEN** `delegated` 模式制品生成完成
- **THEN** 技能 MUST NOT 输出 "wait for user confirmation before suggesting implementation" 停点，改为输出结构化回执
- **AND** 父编排 SHALL 在同一用户回合内继续验证阶段，MUST NOT 等待用户再发消息

#### Scenario: delegated 不改变确认门

- **WHEN** 审阅 `spec_propose` 的 `delegated` 模式正文
- **THEN** 正文 MUST NOT 声明 `delegated` 跳过任何对话级确认门（如提示词校验门、流程最终确认门、材料性歧义询问）；`delegated` 仅让出阶段推进主权与重复步骤

#### Scenario: auto-mode 不被声明为 delegated 的等价别名

- **WHEN** 审阅 `spec_propose` 的 Input 段与正文
- **THEN** MUST NOT 出现「`auto-mode=true` 为 `mode=delegated` 的等价别名」一类断言；SHALL 说明其仅等价 `gate-skip=design-confirmation`

### Requirement: spec-archive 归档技能

spec-archive 技能 SHALL 实现归档工作流：检查 CONTEXT.md 术语同步（不存在则创建）→ 从变更的 exploration.md 提取决策/术语/边界场景并追加到 `openspec/specs/<capability>/explorations.md`（冲突标记"已过时"但保留历史）→ AI 智能合并 delta spec 到主 spec（ADDED/MODIFIED/REMOVED/RENAMED）→ 调用 `iagent spec archive` 移动目录 → CodeGraph **按需**同步（失败仅 WARN、不阻断）→ 追加 ARCHIVE-INDEX 条目。

**归档写入面（强制）**：归档 SHALL 只能写入 `openspec/specs/**`、`openspec/CONTEXT.md` 与 `openspec/changes/archive/ARCHIVE-INDEX.md`（追加式）；`openspec/changes/**` 在归档流程中只允许**整目录移动**，MUST NOT 改写其中任何文件的既有内容。流程级临时工作区 `.openspec-tmp/` 的清理不属于归档写入面（临时产物、不进提交面），见下文「归档收尾清理」。

**归档只读（强制）**：MUST NOT 修改 `openspec/changes/archive/` 下的既有内容——已归档变更是历史事实。整目录移动（`openspec/changes/<name>/` → `openspec/changes/archive/YYYY-MM-DD-<name>/`）SHALL NOT 视为改写；`ARCHIVE-INDEX.md` 的**追加**为该护栏的显式例外。

**需求文档不再读取或报告**：归档流程 MUST NOT 检查 `需求文档.md` 是否存在、MUST NOT 读取 `requirementDocStatus`、MUST NOT 在摘要中报告需求文档状态。变更目录内若存在 `需求文档.md`，它随目录一起留在 `openspec/changes/archive/` 内；归档 MUST NOT 生成、对齐、迁出或删除它。

**MUST NOT** 调用 `iagent spec reindex` 或任何索引重建（索引已退役，归档不含索引步骤）；`ARCHIVE-INDEX.md` 的维护方式为**纯追加本批条目**，结构损坏时 MUST NOT 全量重建。

**CodeGraph 段 SHALL 采用能力探测 + 锁阶梯**：先按「MCP 具名工具 → 可用通道 → CLI `status --json`」探测可用性；需同步时读 `.codegraph/` 下的 `writer.pid` 判存活——**存活则只读复用**既有索引并 MUST NOT 执行 `codegraph unlock`；**不存活才** `codegraph unlock` + 重试一次；仍失败则降级 Glob/Grep 并记录 WARN。仅当确认**无 daemon**（纯 CLI 用户）时才执行一次 `codegraph sync`；daemon 活跃时 MUST NOT 显式 sync（同步责任归 daemon 文件监听）。全流程 MUST NOT 询问用户是否重试（沿用既有「任何错误不询问用户」口径）。

**归档收尾清理（流程级工作区）**：归档成功后技能 SHALL 清理该变更的 `.openspec-tmp/pipeline-<change-name>/`（含 `compile-report.md` 与 `handoff-pack.md`），同时识别旧 `apply-` 前缀；清理 MUST 发生在向 handoff 包追加 `phase=archive` 结论之后。清理失败 SHALL 记 WARN，MUST NOT 阻断归档、MUST NOT 改写已写入的阶段结论。清理 SHALL 经跨平台删除（`node -e "fs.rmSync(...)"`）执行，`allowedTools` 因此 SHALL 含 `Bash(node:*)`。

技能的 `allowedTools` SHALL 覆盖正文实际发起的调用：正文经 Bash 运行 `codegraph` CLI（`status` / `unlock` / 条件 `sync`）时 MUST 含共享常量 `CODEGRAPH_CLI`（`Bash(codegraph:*)`），MUST NOT 只写 MCP 条目。因正文不再委派需求文档技能，`allowedTools` MUST NOT 保留 `Skill(iagent-requirement-doc)` 条目（最小权限）；因 `需求文档.md` 迁移与存在性检查已删除，`Bash(ls:*)` 不再有正文调用，MUST NOT 保留该条目；清理步骤所需的 `Bash(node:*)` SHALL 保留（真实调用支撑），MUST NOT 以 `Bash(rm:*)` 等更宽条目替代。

#### Scenario: 需求文档随变更目录原样保留

- **WHEN** 变更目录内存在 `需求文档.md`
- **THEN** 文件随变更目录移动至 `archive/`，内容与修改时间不变
- **AND** 技能 MUST NOT 读取、报告、生成、对齐、迁出或删除它

#### Scenario: 需求文档缺失时不处理

- **WHEN** 变更目录内不存在 `需求文档.md`
- **THEN** 技能 MUST NOT 生成或报告需求文档，直接继续归档

#### Scenario: 已归档内容只读

- **WHEN** 归档流程任一环节需要访问 `openspec/changes/archive/**` 下既有变更
- **THEN** 只读访问；MUST NOT 改写其中任何文件的既有内容（整目录移动与 ARCHIVE-INDEX 追加除外）

#### Scenario: 索引纯追加不重建

- **WHEN** `ARCHIVE-INDEX.md` 存在但结构部分损坏
- **THEN** 技能仅追加本批最小条目并输出 WARN 提示人工修复，MUST NOT 重建或覆盖整个文件

#### Scenario: 归档收尾清理流程级工作区

- **WHEN** 归档成功完成并已追加 `phase=archive` 结论
- **THEN** 技能清理 `.openspec-tmp/pipeline-<change-name>/`（同时识别旧 `apply-` 前缀），清理失败记 WARN 且不阻断归档

#### Scenario: 探索记忆同步

- **WHEN** 变更含 exploration.md 且其 Decisions 与能力级 explorations.md 的既有决策冲突
- **THEN** 旧决策标记为"已过时（由 <change-name> 取代）"保留，新决策追加，历史不被删除

#### Scenario: delta spec 智能合并

- **WHEN** 变更的 specs/<capability>/spec.md 含 ADDED 与 MODIFIED 需求
- **THEN** 技能将 ADDED 需求追加到主 spec、MODIFIED 需求更新对应条目，再执行 iagent spec archive 移动

#### Scenario: MODIFIED 目标在主 spec 缺失

- **WHEN** delta spec 的 `## MODIFIED Requirements` 条目在主 spec 中找不到对应的需求标识
- **THEN** 技能把该需求按新增需求追加到主 spec，并在归档摘要中列出「MODIFIED 目标缺失（已追加）」告警，继续归档；MUST NOT 中止归档、MUST NOT 丢弃该需求

#### Scenario: 归档不含索引重建

- **WHEN** archive 完成目录移动
- **THEN** 流程中 MUST NOT 调用 `iagent spec reindex`，也 MUST NOT 读写任何 `index.db`

#### Scenario: daemon 活跃时不同步也不解锁

- **WHEN** 归档 CodeGraph 段检测到 `writer.pid` 指向的进程仍存活
- **THEN** 技能只读复用既有索引，MUST NOT 执行 `codegraph sync`、MUST NOT 执行 `codegraph unlock`

#### Scenario: 无 daemon 时按需同步一次

- **WHEN** 归档检测到无 daemon 且需要在归档后更新索引
- **THEN** 技能经 CLI 执行 `codegraph sync` 恰一次；失败仅 WARN，不阻断归档

#### Scenario: 锁阶梯失败降级 Grep

- **WHEN** `writer.pid` 不存在、`codegraph unlock` 后重试一次仍失败
- **THEN** 技能降级为 Glob/Grep 并记录 WARN，继续完成归档，MUST NOT 询问用户

#### Scenario: CodeGraph 同步失败非阻塞

- **WHEN** CodeGraph 任一步骤执行失败
- **THEN** 输出 WARN 日志继续完成归档流程，不回滚

### Requirement: 委托模式双轴词汇单一源

技能间的委托参数 SHALL 拆为两个正交轴，词汇取值 MUST 收敛到单一常量源（`src/core/host-orchestration/delegation-contract.ts`），模板正文 MUST 插值引用该常量，MUST NOT 手写第二份取值表：

- **轴一 `mode`（执行归属）**：`interactive`（默认）| `delegated`。`delegated` 语义 = 抑制结尾停点、抑制被委派技能自身验证、输出结构化回执、**回执后父编排在同一用户回合内继续**、禁止输出「等待用户确认」停点。该轴 MUST NOT 豁免任何业务确认门。
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

#### Scenario: delegated 回执后继续

- **WHEN** 被委派技能以 `mode=delegated` 运行并输出结构化回执
- **THEN** 父编排 SHALL 在同一用户回合内继续下一阶段
- **AND** MUST NOT 把回执解释为终态完成

#### Scenario: 未知 gate id 不被静默接受

- **WHEN** 传入 `gate-skip=<未知门 id>`
- **THEN** 系统 SHALL 拒绝该取值或忽略并记 WARN，MUST NOT 据此跳过任何门

#### Scenario: 词汇与宿主原生 mode 字段区分

- **WHEN** 审阅任一技能正文中 `mode` 的说明
- **THEN** 正文 SHALL 明确其为「委托模式」并与宿主原生 `mode`（OpenCode agent 的 `primary|subagent`、Claude 权限模式）区分
