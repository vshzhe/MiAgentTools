## ADDED Requirements

### Requirement: spec-update 技能注册与形态

新增独立 spec 类技能 `iagent_spec_update`，canonical workflowId / 指令 id 为 `spec-update`，宿主技能 ID 为 `iagent-spec-update`，生命周期类型为 `spec`。该技能 SHALL 以「技能模板 + 指令模板」成对注册进 `WORKFLOW_PAIRS`（`src/core/templates/registry.ts`），其中 skill 版正文为**唯一源**，command 版正文 SHALL 由 `deriveCommandContent()`（`src/core/templates/derive-command.ts`）从 skill 版正文派生，MUST NOT 存在第二份手工维护的同名正文（D1）。

该技能 MUST NOT 进入 `DEFAULT_WORKFLOWS`（`src/core/profiles.ts`），也 MUST NOT 进入 `WORKFLOW_PROTOCOLS`（`src/core/host-orchestration/workflows.ts`）—— 与 `spec-explore` / `spec-propose` / `spec-apply` / `spec-verify` / `spec-archive` 同层（该层均不在协议表内）（D6）。是否把 `spec-update` 纳入默认集属**破坏性面**，SHALL 在提案中单列为待用户确认项，默认不纳入（D6）。

技能 `description` SHALL 含三向排歧：NOT for 新建变更提案（改用 `iagent_spec_propose`）、NOT for 实现未完成的变更（改用 `iagent_spec_apply`）、NOT for 孤立缺陷的根因排查（改用 `iagent_debug`）；`iagent_debug` 的 description SHOULD 补反向排歧句（NOT for 已实现变更的提案修订，改用 `iagent-spec-update`），该反向排歧仅改路由描述文本，MUST NOT 改变 `iagent_debug` 的既有行为（D1 / ADR-0003）。

`allowedTools` SHALL 走共享常量派生：`${CODEGRAPH_MCP}` 与 `${CODEGRAPH_CLI}` 双写（正文确有 CodeGraph 检索与 CLI 探测），技能委派条目 MUST 经 `skillDelegation([...])` 生成，MUST NOT 手写 `Skill(...)` 字面量，MUST NOT 使用 `Skill(*)` 通配（D1 / 项目护栏）。

新增该技能时 SHALL 同步旧标识映射表：在 `LEGACY_WORKFLOW_ID_MAP`（`src/core/legacy-migration.ts`）登记**同名透传**条目 `'spec-update': 'spec-update'`（与 `frontend-skill-gen` / `backend-skill-gen` 这类「新增能力（无旧前身）」的登记先例同构），以保持「映射目标集合 == 注册表指令 id 集」不变量（`test/legacy-migration.test.ts` 回归锁）；MUST NOT 为不存在的历史 id 编造映射，MUST NOT 改动既有映射条目。

#### Scenario: 新技能同步旧标识映射表

- **WHEN** 新增 `spec-update` 技能后核对 `LEGACY_WORKFLOW_ID_MAP` 的目标 id 集合
- **THEN** 表中登记 `'spec-update': 'spec-update'` 同名透传条目，映射目标集合与注册表指令 id 集完全一致，映射不变量断言通过

#### Scenario: 指令 id 派生为 spec-update

- **WHEN** 注册表按 `deriveCommandId()` 从技能名 `iagent_spec_update` 派生指令 id
- **THEN** 派生出 `spec-update`，与既有 `spec-apply` / `spec-verify` 的派生规则一致

#### Scenario: 技能与指令成对注册

- **WHEN** 新技能对登记进 `WORKFLOW_PAIRS`
- **THEN** 技能模板与指令模板同时存在，指令正文由 skill 版正文经 `deriveCommandContent()` 派生，源码中不存在第二份手工维护的同名正文字符串

#### Scenario: 不进入默认集与阶段协议表

- **WHEN** 核对 `DEFAULT_WORKFLOWS` 与 `WORKFLOW_PROTOCOLS` 两张表
- **THEN** 两表中均无 `spec-update` 项，默认安装集规模不变，且 `spec-update` 不引入阶段迁移判定负担

#### Scenario: description 排歧区分相邻技能

- **WHEN** 检查 `spec-update` 的技能 description
- **THEN** 其中含指向 `iagent_spec_propose` / `iagent_spec_apply` / `iagent_debug` 的三向 `NOT for` 排歧句，路由语义与既有技能不重叠

### Requirement: update 前置校验与实现未完成阻断

技能启动后 SHALL 先做前置校验：目标变更 MUST 存在；且目标变更的 `tasks.md` MUST 全部勾选（判据：`iagent spec status --change "<name>" --json` 返回的 `progress.remaining === 0`，来源 `src/core/spec/status.ts` 的 `getChangeStatus`）。任一条件不满足时 MUST 阻断并提示先走 `spec-apply`，MUST NOT 进入修订环节，MUST NOT 写入或修改任何制品（D10 / BS4）。

阻断出口 MUST NOT 提供「继续修订」或「跳过检查」一类出口；阻断时应给出可执行的下一步（完成剩余任务 / 先执行 `spec-apply`），MUST NOT 以模糊建议代替。

#### Scenario: 实现未完成时阻断

- **WHEN** 目标变更的 `tasks.md` 仍有未勾选任务（`progress.remaining !== 0`）
- **THEN** 技能阻断并提示先走 `spec-apply`，MUST NOT 改写任何制品，MUST NOT 提供跳过出口

#### Scenario: 目标变更不存在时阻断

- **WHEN** 用户给出的变更名在 `openspec/changes/` 下不存在
- **THEN** 技能阻断并报告变更不存在，MUST NOT 自建变更目录后继续

#### Scenario: 任务全部勾选时放行

- **WHEN** 目标变更存在且 `progress.remaining === 0`
- **THEN** 技能进入归档态判定环节，不触发前置阻断

### Requirement: 已归档变更的复活复制

前置校验通过后，技能 SHALL 判定目标变更是否已归档。已归档时 MUST 先复制为新变更 `update-<原名>-<YYYYMMDD>` 再继续修订流程；**原归档目录 MUST 保持不动**（MUST NOT 改写、移动或删除其中任何文件）—— 已归档变更是历史事实（D9 / BS1）。

复制 MUST 经跨平台方式执行（`node -e "fs.cpSync(...)"` 递归复制，MUST NOT 依赖 `cp -r` / `xcopy` 等平台专有命令）；复制失败时 MUST 阻断并报 WARN，终止本轮，MUST NOT 继续后续环节（D9）。

#### Scenario: 已归档变更复制为新变更

- **WHEN** 前置校验通过且目标变更位于 `openspec/changes/archive/` 下
- **THEN** 技能将其复制为 `openspec/changes/update-<原名>-<YYYYMMDD>/`，并在该新变更上继续后续流程

#### Scenario: 原归档目录保持不动

- **WHEN** 复制完成
- **THEN** 原归档目录内的任何文件内容、路径与修改时间均不变

#### Scenario: 复制失败时阻断

- **WHEN** 递归复制过程失败
- **THEN** 技能阻断并报 WARN，终止本轮，MUST NOT 在残缺副本上继续修订

### Requirement: 双轨根因定位与降级委派

根因定位 SHALL 按**双轨**执行（ADR-0003）：默认执行**轻量差异定位** —— 比对「变更制品 ↔ 实际实现 ↔ 用户测试现象」三方；轻量定位得出结论时直接进入根因结论产出。轻量定位**无结论**时 MUST 降级委派 `iagent_debug` 做深度根因分析（D4）。

降级委派 MUST 显式且诚实：委派**未真正发生**（宿主能力缺失）时 MUST NOT 被表述为「委派完成」，MUST 按「根因未定位」处置。两者皆无结论时 SHALL 输出「根因未定位」报告并停在探索阶段出口，MUST NOT 修改任何制品，MUST NOT 进入修订清单生成环节（D4 / BS3）。

#### Scenario: 轻量定位得出根因

- **WHEN** 轻量三方差异定位得到单一高置信根因
- **THEN** 技能直接产出根因与影响面结论，MUST NOT 额外发起 debug 委派

#### Scenario: 轻量无结论时降级委派 debug

- **WHEN** 轻量差异定位未能得出根因
- **THEN** 技能降级委派 `iagent_debug` 执行深度根因分析，并在结果中标注本次走的是降级路径

#### Scenario: 降级委派未完成时如实报告

- **WHEN** 降级委派因宿主能力缺失而未真正发生
- **THEN** 技能 MUST NOT 把该次执行表述为「委派完成」，MUST 按「根因未定位」处置

#### Scenario: 根因未定位时不修改任何制品

- **WHEN** 轻量定位与降级委派均未得出根因
- **THEN** 技能输出「根因未定位」报告并停在探索阶段出口，MUST NOT 改写任何制品，MUST NOT 生成修订清单

### Requirement: 破坏性改动确认门

在原地改写既有制品**之前**，技能 MUST 生成修订清单（改哪些制品、改哪些段）并呈现给用户，经**破坏性改动确认门**确认后才可改写（D11）。该门 MUST 归入既有门白名单第 5 类 `destructive-change`（动作级、不可豁免），MUST NOT 自造第 6 类门（D11 / 硬约束）。

用户拒绝时 MUST 记录拒绝并停在「更新提案」阶段，MUST NOT 改写任何制品，MUST NOT 提供「跳过门继续」一类出口（D11 / 门护栏）。

#### Scenario: 呈现修订清单并确认后改写

- **WHEN** 修订清单已生成且用户在破坏性改动确认门确认
- **THEN** 技能进入原地改写环节，改写范围与修订清单一致

#### Scenario: 用户拒绝时不改任何制品

- **WHEN** 用户在破坏性改动确认门拒绝
- **THEN** 技能记录拒绝并停在「更新提案」阶段，MUST NOT 改写任何制品，MUST NOT 提供跳过出口

#### Scenario: 确认门不新增门类别

- **WHEN** 核对门白名单 `GATE_WHITELIST` 与 `GateWhitelistId`
- **THEN** 两者仍为既有 5 类，破坏性改动确认门归入 `destructive-change`，MUST NOT 出现第 6 类

### Requirement: 原地改写与修订记录追加

通过确认门后，技能 MUST 在**同一变更身份**内原地改写既有变更的 Markdown 制品（`proposal.md` / `specs/**` / `design.md` / `tasks.md`），MUST NOT 把修订分叉到一条平行的新变更 —— 已归档变更的「复活复制」是同一变更的延续，不属分叉（D2）。

改写 MUST NOT 引入 `change.json` / `tasks.json`（JSON 制品已弃用），Markdown 为唯一真源（硬约束）。改写成功后 MUST 在变更目录内追加 `revision.md`（修订记录）：单条条目字段固定为「问题现象 → 根因 → 修订点 → 影响制品 → 来源（轻量定位 / debug 降级）」；`revision.md` MUST **追加**写入，MUST NOT 覆盖历史修订记录（D8 / BS6）。

#### Scenario: 原地改写既有制品并追加修订记录

- **WHEN** 用户确认修订清单且改写全部成功
- **THEN** 既有制品在同一变更目录内被改写，`revision.md` 追加一条含问题现象 / 根因 / 修订点 / 影响制品 / 来源的条目

#### Scenario: 连续多次 update 追加而非覆盖

- **WHEN** 同一变更已存在历史 `revision.md` 条目且再次执行 update
- **THEN** 新条目追加在既有条目之后，历史修订记录保持原样

#### Scenario: 不引入 JSON 制品

- **WHEN** 修订流程写入制品
- **THEN** 只写 Markdown 制品，MUST NOT 创建或更新 `change.json` / `tasks.json`

### Requirement: 改写失败回滚

改写 MUST 采用「写前内存副本 + 逐制品写入 + 失败整体回滚」：改写前逐个读取目标制品原文存入内存副本；任一制品写入失败时 MUST 用内存副本逐个还原已改写制品，报 WARN，停在「更新提案」阶段，MUST NOT 留下半改写状态，MUST NOT 进入实现环节（D10 / BS2）。

#### Scenario: 改写部分失败时回滚

- **WHEN** 改写过程中某个制品写入失败
- **THEN** 技能用改写前的内存副本还原全部已改写制品并报 WARN

#### Scenario: 回滚后停在更新提案阶段

- **WHEN** 回滚完成
- **THEN** 技能停在「更新提案」阶段，MUST NOT 进入再实现优化环节，MUST NOT 委派 `spec-apply`

### Requirement: 再实现优化与能力测试对比

改写成功后，技能 MUST 委派 `spec-apply` 执行再实现优化（承接修订后的任务清单调度 + 编译检查 + 测试执行关卡）；委派 MUST 走 `Skill(iagent-spec-apply)` 精确条目，MUST NOT 使用通配（D7）。

实现完成后 MUST 产出**能力测试对比**制品 `capability-comparison.md`（能力 → 修复前表现 → 修复后表现 → 证据位置 → 结论），并委派 `spec-verify` 做三维度一致性验证（D5）。能力测试对比 MUST NOT 替代或复用 `spec-verify` 的三维度口径（Completeness / Correctness / Coherence）—— 两者互补而非同一口径（D5 / 硬约束）。

对比结论为 FAIL（修复引入新缺陷、回归测试失败）时 MUST 在对比表中标 FAIL 并列出新引入的问题，MUST NOT 进入归档出口（D5 / BS5）。

#### Scenario: 委派 apply 实现优化

- **WHEN** 原地改写全部成功
- **THEN** 技能委派 `spec-apply` 执行再实现优化，委派走精确技能条目

#### Scenario: 产出能力测试对比制品

- **WHEN** 再实现优化完成
- **THEN** 变更目录内存在 `capability-comparison.md`，含能力、修复前表现、修复后表现、证据位置与结论的对比表

#### Scenario: 对比口径与 spec-verify 互补不混用

- **WHEN** 检查能力测试对比制品与 `spec-verify` 的口径
- **THEN** 对比制品按「修复前 vs 修复后」能力表现组织，MUST NOT 复用三维度（Completeness / Correctness / Coherence）口径

#### Scenario: 对比结论 FAIL 时不进入归档出口

- **WHEN** 能力测试对比结论为 FAIL
- **THEN** 技能在对比表中标 FAIL 并列出新引入的问题，MUST NOT 进入归档出口

### Requirement: 四环节编排形态与结构化回执

技能 SHALL 以**单技能内联编排**承载四环节修复闭环，四环节顺序固定为「探索分析 → 更新提案 → 再实现优化 → 能力测试对比」，MUST NOT 重排、跳过或颠倒（D3 / D7）。实现环节 MUST 委派 `spec-apply`、验证环节 MUST 委派 `spec-verify`，其余环节在本技能内联执行；委派 MUST 走精确技能条目，MUST NOT 使用通配。

流程收束时 SHALL 输出结构化阶段回执（字段：`phase` / `status` / `artifact` / `nextAllowed`，来源 `src/core/host-orchestration/protocol.ts` 的 `DEFAULT_RECEIPT_FIELDS`），MUST NOT 以面向用户的会话小结替代回执。

#### Scenario: 四环节顺序不可重排

- **WHEN** 检查技能正文的四环节段序
- **THEN** 顺序为探索分析 → 更新提案 → 再实现优化 → 能力测试对比，MUST NOT 出现重排或跳过某一环节的出口

#### Scenario: 输出结构化回执

- **WHEN** 能力测试对比结论为 PASS 且流程收束
- **THEN** 技能输出含 `phase` / `status` / `artifact` / `nextAllowed` 的结构化回执，MUST NOT 只给会话小结

### Requirement: 新增变更级制品的归档边界

`revision.md` 与 `capability-comparison.md` 是变更过程留痕，MUST NOT 登记进 `SPEC_DRIVEN_SCHEMA.artifacts`（`src/core/spec/schema.ts`），因此 MUST NOT 被 `iagent spec status` / `instructions` / `archive` 的**主 spec 合并范围**收录（D5 / 硬约束）。二者 MUST 随变更目录整体移动进入归档目录（`executeArchive` 的整目录移动语义天然满足），内容与修改时间不变（D5）。

#### Scenario: 新增制品不进入主 spec 合并范围

- **WHEN** 核对 `SPEC_DRIVEN_SCHEMA.artifacts` 与归档技能的 delta spec 合并范围
- **THEN** 两表中均无 `revision.md` / `capability-comparison.md`，二者不被合并进主 spec

#### Scenario: 归档时随变更目录整体移动

- **WHEN** 变更归档执行
- **THEN** `revision.md` 与 `capability-comparison.md` 随变更目录整体移动到 `openspec/changes/archive/` 下，内容不变

### Requirement: 依赖注入与随装补全

系统 SHALL 对生效 workflow 集执行依赖注入补全（不动点迭代，连带补全传递依赖）：若集合含 `spec-update` 但不含 `spec-apply` / `spec-verify` / `test` / `debug`，MUST 自动补入缺失项 —— `spec-apply`（再实现优化）、`spec-verify`（三维度一致性验证）、`test`（能力测试对比的用例生成与执行）、`debug`（降级深度根因分析）均为 `spec-update` 正文实际委派的目标，被委派技能必须可得，MUST NOT 形成死引用（D6）。

`DEPS['spec-update']` 的声明 MUST 与 `spec-update` 正文的委派面逐条一致 —— 声明了但正文从不委派的冗余项属依赖注入缺陷（与 `skill-profile` 既有「委派面与依赖面一致」回归锁同口径）。补入项 MUST 在输出中提示用户。

#### Scenario: 漏选 update 依赖时随装补全

- **WHEN** 用户 `workflows` 含 `spec-update` 但不含 `spec-apply` / `spec-verify` / `test` / `debug`
- **THEN** 系统自动补入缺失项并输出对应提示

#### Scenario: update 依赖齐备时不重复注入

- **WHEN** 用户 `workflows` 已含 `spec-update` 与其四项依赖
- **THEN** 不产生新的注入项

#### Scenario: 委派面与依赖面一致

- **WHEN** 比对 `DEPS['spec-update']` 与 `spec-update` 正文实际委派的技能集合
- **THEN** 二者完全一致：正文委派集合无缺项（无死引用），`DEPS` 无冗余项（不指向正文从不委派的技能）
