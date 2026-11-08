## MODIFIED Requirements

### Requirement: grill L1-L5 批量确认（≤2 批）

(D2.3) `iagent_spec_explore` 的 grill-with-docs 追问 MUST 将逐决策增量确认合并为 **≤ 2 批**（L1-L3 一批、L4-L5 一批），并保留最低确认深度 **L3**（L1-L3 全部确认后决策方可标记完成）。两项约束的口径 MUST 表述为：**收敛深度不限**（追问持续到问题清楚为止，不设问题条数、术语条数或决策树层数上限）；**批量轮数受 ≤2 批规则约束**（至多 2 个用户确认轮次；澄清门不计入流程级门预算）。MUST NOT 再把该规则表述为无限定的「深度不限」，也 MUST NOT 表述为「轮数不限」。新增的待澄清问题 SHALL 在已开启的批次内继续收敛，MUST NOT 触发第三个用户确认轮次。若用户表示"够了"，SHALL 允许提前结束并记 `user-shortened`（合法终态，不判失败）。

#### Scenario: 两批确认

- **WHEN** 探索存在跨 L1-L5 的待确认决策
- **THEN** 系统 SHALL 至多发起 2 次批量确认（L1-L3、L4-L5）
- **AND** 每批 SHALL 逐条列出待确认项与 AI 建议

#### Scenario: 最低深度保持

- **WHEN** 用户在 L1-L3 批确认后要求停止
- **THEN** 决策 SHALL 被视为完整（已达最低深度 L3）
- **AND** L4-L5 未确认项 SHALL 记入 Pending 而非静默丢弃

#### Scenario: 收敛深度不设上限

- **WHEN** L4 一致性检查或代码交叉验证发现仍需澄清的新问题
- **THEN** 追问 SHALL 在已开启的批次内继续收敛至问题清楚
- **AND** MUST NOT 因「≤2 批」截断新问题，也 MUST NOT 为此新增第三个用户确认轮次

## ADDED Requirements

### Requirement: 探索纸迹三项校验与回执声明（paperTrailStatus）

(D2.1) `iagent_spec_explore` SHALL 在 1.5.5 流程最终确认门**之前**校验三项纸迹产物的存在性：(1) `exploration.md` 的 `## Decisions` 非空或显式声明「无决策」；(2) 术语表非空或显式声明「无新术语」；(3) `## 架构决策` 有 ADR 记录，或显式声明「无 ADR」并已复核 ADR 三条件。三项「显式『无』」SHALL 使用固定字面量 `无决策` / `无新术语` / `无 ADR` 写在对应段落内，便于机器核对；散文式免责表述 MUST NOT 被视为显式声明。校验结果 MUST 记入探索回执的 `paperTrailStatus` 字段，取值 `complete` / `incomplete` / `skipped`。

纸迹校验 MUST **并入既有的流程最终确认门呈现**：缺失项逐条列出并给出「补写 / 显式声明无」两种处置。MUST NOT 新增阻塞确认门，MUST NOT 改变门白名单与门预算。校验本身 MUST NOT 单独成为一次用户停顿。

#### Scenario: 三项齐备或显式「无」

- **WHEN** Decisions、术语表、ADR 三项均有内容或均有显式「无」声明
- **THEN** 回执 `paperTrailStatus` SHALL 为 `complete`
- **AND** 流程最终确认门的呈现内容 SHALL 包含该结论

#### Scenario: 纸迹缺失并入流程最终确认门

- **WHEN** 任一项纸迹既无内容也无显式「无」声明
- **THEN** 回执 `paperTrailStatus` SHALL 为 `incomplete`
- **AND** 缺失项 SHALL 在流程最终确认门内逐条呈现并给出补写 / 显式声明无的处置
- **AND** MUST NOT 新增第二个阻塞门或用独立停顿呈现校验结果

#### Scenario: 用户提前结束为合法终态

- **WHEN** 用户在 L1-L3 批确认后要求停止（边界 B1）
- **THEN** 未覆盖的 L4-L5 层级 SHALL 在流程最终确认门内显式列出
- **AND** 该情形 SHALL 记为 `user-shortened` 合法终态，MUST NOT 判定为失败或纸迹缺失

#### Scenario: 无探索文件跳过校验

- **WHEN** 在无探索文件的路径执行（旧变更或直接 apply，边界 B2）
- **THEN** 纸迹校验 SHALL 不执行，回执 `paperTrailStatus` 为 `skipped`
- **AND** 系统 SHALL 记录 WARN，MUST NOT 凭猜测补写纸迹

#### Scenario: 存量探索文件无字段契约

- **WHEN** 读取的既有探索文件不含 `D<n>` 或硬约束字段契约（边界 B3）
- **THEN** 系统 SHALL 记 WARN 并视作「无硬约束」
- **AND** 新字段契约 SHALL 只对本次及之后新产出的探索文件强制，MUST NOT 阻塞存量变更

### Requirement: 编排技能纸迹衔接口径

(D1, B7) `iagent_auto_workflow` / `iagent_workflow` SHALL 把 `exploration.md` 作为探索→提案阶段**唯一的过桥载体**：Phase 2 委派 MUST 传 `explorationFile`，MUST NOT 以父级对话摘要、回执正文或临时记忆替代。探索回执的 `flowBaselineConfirmed` 与 `paperTrailStatus` SHALL 由父级原样记录并透传，MUST NOT 被改写，MUST NOT 在缺失时静默补默认值。父级复核（见下方 Scenario）发现自证与实际不一致时，SHALL 以核对到的实际值透传并在回执中记录 WARN 与差异原因——该情形属于复核纠偏，MUST NOT 与「静默改写子级值」混为一谈。

全自动管线 MUST 保持唯一用户停点不变：纸迹校验 MUST 在探索的流程最终确认门之内完成，MUST NOT 在 Phase 2 追加第二次用户停顿，也 MUST NOT 因 `paperTrailStatus=incomplete` 自动阻断全自动管线（由流程门内的用户处置决定）。

#### Scenario: exploration.md 为唯一边界载体

- **WHEN** `auto-workflow` 或 `workflow` 从探索阶段进入提案阶段
- **THEN** 委派 Envelope SHALL 携带 `explorationFile` 路径
- **AND** MUST NOT 用父级对话摘要或回执正文替代该文件

#### Scenario: 回执纸迹字段不被父级改写

- **WHEN** 父编排收到探索回执
- **THEN** `flowBaselineConfirmed` 与 `paperTrailStatus` SHALL 原样记录并透传
- **AND** 字段缺失时 MUST NOT 静默补默认值

#### Scenario: 全自动管线唯一停点不变

- **WHEN** 全自动管线（边界 B7）执行探索阶段
- **THEN** 纸迹校验 SHALL 在流程最终确认门之内完成
- **AND** 管线用户停点数量 MUST NOT 因本变更增加

#### Scenario: 父级复核纸迹自证

- **WHEN** 父编排收到 `paperTrailStatus=complete` 的探索回执
- **THEN** 父级 SHALL 至少核对一次 `exploration.md` 的 Decisions / 术语表 / ADR 三项确实存在或有显式「无」字面量
- **AND** 核对不一致时 SHALL 记 WARN 并按实际值透传，MUST NOT 静默采信子级自证

### Requirement: debug 排查期 grill 纸迹纪律

(D6) `iagent_debug` 的 §2.3 排查期 grill 纪律 SHALL 与 `iagent_spec_explore` 的领域建模三项对齐，MUST NOT 以「缩减版」为由省略任一纪律：

- **术语冲突检测**：写入 `openspec/CONTEXT.md` 前 MUST 读取既有条目；同名术语已存在且定义不一致时，MUST 在接受新用法前指出冲突并显式裁决。
- **ADR 三条件**：仅当难以逆转、脱离上下文令人意外、真实权衡三条件**同时**满足时才写 `openspec/docs/adr/`；不满足时不产出（正常态）。
- **边界场景构造**：对每个已确认的根因决策 MUST 至少构造 1 个边界场景，并写入诊断记录与（可选）探索文件边界场景段。

#### Scenario: 术语冲突检测

- **WHEN** debug 排查中确定一个与 CONTEXT.md 既有条目同名的术语
- **THEN** 系统 SHALL 先比对定义并指出差异
- **AND** 未显式裁决前 MUST NOT 追加第二条同义条目

#### Scenario: ADR 三条件判定

- **WHEN** debug 作出一个根因相关决策
- **THEN** 仅当三条件同时满足时才 SHALL 创建 ADR
- **AND** 不满足时 SHALL 不产出 ADR，MUST NOT 为凑纸迹而写

#### Scenario: 边界场景构造

- **WHEN** 某个根因决策已确认
- **THEN** 系统 SHALL 至少构造 1 个边界场景（网络故障 / 超时 / 非法输入 / 并发访问）
- **AND** 场景 SHALL 写入诊断记录，MUST NOT 只保留在对话中

### Requirement: CONTEXT.md 多写入者漂移防护

(D4) **全部** `CONTEXT.md` 写入者 SHALL 统一遵守写入规则。写入者清单（至少六处，新增写入路径 MUST 一并纳入）：`iagent_spec_explore`（1.3.3 / 1.6.5）、`iagent_debug`（§2.3）、`iagent_spec_archive`（4.5）、`iagent_spec_bulk_archive`（a.5）、`iagent_workflow`（Phase 2.0 CONTEXT.md 同步）、`iagent_spec_propose`（0.5 CONTEXT.md 检查）。`iagent_auto_workflow` 经委派 `propose` 写入，MUST NOT 单独计为写入者（其 Phase 2.0 只做影响分析）。：写入 `openspec/CONTEXT.md` **之前** MUST 先读取现有内容；同名术语已存在时 MUST 比对定义，不一致时 MUST 显式裁决——更新定义，或保留旧定义并标注「已过时（由 <change-name> 取代）」；MUST NOT 静默追加第二条同义条目。

归档类写入者（`spec-archive` / `spec-bulk-archive`）的取词口径 SHALL 收窄为：**只同步变更 `exploration.md` 术语表中已确认的术语**；MUST NOT 从 `proposal.md` / `design.md` / `specs/**` 正文反向抽取术语。`exploration.md` 或术语表缺失时 SHALL 记 WARN 并跳过，MUST NOT 猜测补词。所有写入仍然 MUST NOT 阻塞归档主流程。

#### Scenario: 先读后写

- **WHEN** 任一写入者准备写入 CONTEXT.md
- **THEN** 写入前 SHALL 读取现有内容并比对待写术语
- **AND** MUST NOT 在不读取现有文件的情况下直接追加

#### Scenario: 同名冲突显式裁决

- **WHEN** 待写术语与既有条目同名但定义不一致
- **THEN** 系统 SHALL 显式呈现两种定义并裁决
- **AND** 裁决结果 SHALL 为「更新定义」或「保留旧定义 + 标注已过时（由 <change-name> 取代）」

#### Scenario: 归档取词口径收窄

- **WHEN** `spec-archive` 或 `spec-bulk-archive` 同步 CONTEXT.md
- **THEN** 只 SHALL 取 `exploration.md` 术语表中已确认的术语
- **AND** MUST NOT 从 proposal / design / specs 正文反向抽取术语

#### Scenario: 并行单元写入串行化

- **WHEN** `spec-bulk-archive` 的并行归档单元（≤3）各自执行 a.5 并都要写同一 `openspec/CONTEXT.md`
- **THEN** a.5 的「读取 → 比对 → 写入」步骤 SHALL 串行化（同一批次锁或串行执行）
- **AND** MUST NOT 以「先读后写」为由并发执行该步，MUST NOT 造成丢失更新

### Requirement: 探索硬约束声明

(D2.2) `iagent_spec_explore` SHALL 在 1.5.5 之前把已确认决策中的不可改写片段（顺序保证 / 否定式需求 / 数值型默认值）写入 `exploration.md` 的 `## 硬约束` 段：每行一条，带 `source: D<n>`；确无此类片段时 SHALL 写入固定字面量 `无硬约束`。该段 MUST NOT 留空，MUST NOT 由 propose 从散文反向猜测。存量探索文件含 `D<n>` 但无 `## 硬约束` 段时按边界 B3 处理：记 WARN 并视作无硬约束，只对新产出强制。

#### Scenario: 有硬约束时逐条声明

- **WHEN** 探索确认了顺序保证、否定式需求或数值型默认值
- **THEN** `exploration.md` 的 `## 硬约束` 段 SHALL 逐条列出并带 `source: D<n>`
- **AND** propose 的 handoff `## 硬约束` SHALL 以该段为唯一来源

#### Scenario: 确无硬约束时写字面量

- **WHEN** 探索确无不可改写片段
- **THEN** `exploration.md` 的 `## 硬约束` 段 SHALL 写入固定字面量 `无硬约束`
- **AND** propose SHALL NOT 因此返回 `status=incomplete`

### Requirement: 决策可追溯链路（D<n>）

(D5) 探索文件的 `## Decisions` 每条 MUST 带稳定 id `D<n>`；id 一经分配 MUST NOT 复用、重排或删除后重编号。propose 生成的 `specs/**/spec.md` 与 `design.md` MUST 在对应约束处标注来源 `(D<n>)`；`tasks.md` 的 `[测试]` 任务 MUST 覆盖其所引用的硬约束，并给出可核对的 `Scenario Ref` 或验证依据；handoff 包 `## 硬约束` 每行 MUST 带 `source: D<n>`。

#### Scenario: Decisions 稳定 id

- **WHEN** 探索新增或调整一条决策
- **THEN** 该决策 SHALL 获得唯一的 `D<n>` id
- **AND** 既有 id MUST NOT 被复用或重排

#### Scenario: 制品标注来源

- **WHEN** propose 在 specs 或 design 中写入受某决策约束的内容
- **THEN** 该处 SHALL 标注 `(D<n>)`
- **AND** 未标注来源的硬约束 SHALL 被判为可追溯性缺失

#### Scenario: 测试覆盖硬约束

- **WHEN** 某条硬约束被写入 handoff 包 `## 硬约束`
- **THEN** `tasks.md` SHALL 至少有一个 `[测试]` 任务覆盖该硬约束
- **AND** 该任务的 Scenario Ref 或验证描述 SHALL 能与对应 Spec Requirement 对齐
