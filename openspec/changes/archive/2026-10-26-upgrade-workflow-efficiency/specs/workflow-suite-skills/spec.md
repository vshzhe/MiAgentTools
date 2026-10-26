# workflow-suite-skills 增量规格

## ADDED Requirements

### Requirement: 编排技能门白名单与直通句

编排类技能（`iagent_workflow` / `iagent_auto_workflow` / `iagent_debug` / `iagent_migration`）与 spec 阶段技能（`iagent_spec_explore` / `iagent_spec_propose` / `iagent_spec_apply` / `iagent_spec_verify` / `iagent_spec_verify_proposal` / `iagent_spec_archive` / `iagent_spec_bulk_archive`）正文 SHALL 引入**门白名单**段（复用 `prompt-gate.ts` 的共享常量），并满足：

- **必留门（正向枚举 5 类）**：L1-L5 需求澄清、功能流程图门、实现 + 测试桥、归档桥、破坏性改动确认；其中 `iagent_debug` 的「诊断结论确认」与「修复方案选择」（条件门）归入**需求澄清（需求 / 方案歧义）**一类，MUST NOT 因类别名不同而被判为白名单外；
- **MUST NOT 请求确认清单**：阶段宣告、技能委派（含「是否调用 <技能>」）、只读扫描、CodeGraph 查询、状态查询；**只读校验的「是否运行 <校验>？」询问亦属此类**（如现有的「是否运行技术栈专项校验？」[是][否] MUST 改为直接执行并在报告中说明校验项）；`reindex` / 索引重建已随跨变更索引退役（DEC-2），不再作为任何门或动作存在。这些动作 MUST NOT 被实现为停止点；
- **直通句**：`iagent_workflow` 的每处阶段委派点（Phase 1→2、2→3、3→4、4→5）SHALL 含与 `iagent_auto_workflow` 同款的强制语句「本阶段立即开始 —— 不停顿、不宣告、不向用户提问」，MUST NOT 出现「开始委派 X，请确认」类自造停顿；
- **单一源**：门清单与负向清单文本 MUST 经共享常量插值（`GATE_WHITELIST` 定义在协议层 `host-orchestration/protocol.ts`；`GATE_PROTOCOL_PREAMBLE` 与门清单文本渲染在 `prompt-gate.ts`，后者 import 前者），MUST NOT 各模板手写第二份，也 MUST NOT 在 `prompt-gate.ts` 重新定义一份白名单数据；
- **生成期断言**：测试 SHALL 断言编排技能正文含 5 类必留门与 MUST NOT 清单、`iagent_workflow` 含直通句关键字（`不停顿` / `不宣告`），且不含自造门句式（如「是否调用 spec_apply」）。

#### Scenario: workflow 补直通句

- **WHEN** 检查 `iagent_workflow` 的阶段委派段落
- **THEN** 每处含「本阶段立即开始 —— 不停顿、不宣告、不向用户提问」，MUST NOT 出现在委派前等待确认的表述

#### Scenario: 必留门文本齐备

- **WHEN** 检查任一编排技能的正文
- **THEN** 含 L1-L5 需求澄清、功能流程图门、实现 + 测试桥、归档桥、破坏性改动确认五类门的声明

#### Scenario: 负向清单齐备

- **WHEN** 检查任一编排技能的正文
- **THEN** 含「阶段宣告 / 技能委派 / 只读扫描 / CodeGraph 查询 / 状态查询 MUST NOT 请求确认」清单，并声明「只读校验的『是否运行 <校验>？』询问同属 MUST NOT 确认」与「索引重建随 ② 退役、不构成动作」

#### Scenario: 只读校验不请求确认

- **WHEN** 技能准备执行技术栈专项校验等只读校验
- **THEN** 直接执行并在结果中说明校验项，MUST NOT 输出「是否运行 <校验>？」类询问、MUST NOT 暂停等待用户选择

#### Scenario: 自造门句式被拦截

- **WHEN** 模板正文出现「是否调用 <技能>」「是否继续」「是否开始阶段」类询问句
- **THEN** 生成期文本测试失败并要求改为直通表述

#### Scenario: 门协议不弱化

- **WHEN** 检查 `GATE_PROTOCOL_PREAMBLE` 渲染结果
- **THEN** 仍含「门 = 本次响应到此结束」的硬停止语义，新增的负向边界句 MUST NOT 削弱该语义

### Requirement: debug 修复循环的派发形态与回执最小化

`iagent_debug` SHALL 具备子代理派发能力（`allowedTools` 含共享常量 `SUBAGENT_DISPATCH` 的 `Agent` / `Task` 双写条目），并在修复循环（Phase 4）采用与 `iagent_spec_apply` 一致的派发形态：

- **派发单元**：每个待修复 bug 为一个派发单元；同一文件被多个 bug 触及时 MUST 串行执行（从并发组拆出）；同时运行的子代理数 MUST NOT 超过 `apply.concurrency`（缺省 3）；
- **唯一必读制品（批次一降级口径）**：handoff 包存在时，子代理读包（`## 契约` / `## 文件归属表` / `## Codebase 摘要` / `## 已产出`）与其单元的任务清单；**包不存在时（批次一独立实施 / 未跑 propose 的独立 debug）读「`investigation-digest` 摘要 + 本单元 bug 清单 + 文件归属」三件**，MUST NOT 因缺包而拒绝派发，也 MUST NOT 在本技能内自建第二套包格式。两种形态下子代理均 MUST NOT 各自重读完整技能正文或重复已覆盖的 CodeGraph 查询；
- **回执最小化**：回执采用四列格式 `<bug id> | <状态> | <产出文件> | <公开签名>`，MUST NOT 粘贴代码正文；失败单元额外含失败原因摘要；
- **收束归属**：任务状态、回归测试验收与阶段推进由主代理集中管理；子代理 MUST NOT 推进阶段、MUST NOT 修改 `tasks.md`、MUST NOT 标记可归档；
- **退出守卫**：沿用 `⛔ EXIT GUARD`（完成即停、回四列回执），子代理返回后主代理负责核对与后续步骤；
- **降级**：运行时不提供子代理派发工具时 SHALL 降级为串行本地修复并告知用户，MUST NOT 伪装为派发完成；
- **正文瘦身**：主 SKILL 正文 MUST NOT 再内联大段探查过程描述；细节下沉 `references/`，主文件保留触发词、阶段骨架、确认门、委派清单与护栏。

#### Scenario: 修复循环按单元派发

- **WHEN** 调试循环中本轮存在 3 个待修复 bug 且文件无重叠
- **THEN** 技能按 bug 派发子代理（并发 ≤ `apply.concurrency`），每个子代理只读其单元清单
- **AND** handoff 包存在时只读该包；**不存在时只读 `investigation-digest` 摘要 + 本单元 bug 清单 + 文件归属**，MUST NOT 因缺包而放弃派发或自建第二套包格式

#### Scenario: 同文件 bug 串行

- **WHEN** 两个待修复 bug 都会修改同一文件
- **THEN** 两者串行执行，MUST NOT 并发修改同一文件

#### Scenario: 四列回执

- **WHEN** 某修复子代理完成其 bug
- **THEN** 回执为 `<bug id> | <状态> | <产出文件> | <公开签名>` 四列，不含代码正文

#### Scenario: 子代理不推进阶段

- **WHEN** 修复子代理完成修复与回归测试
- **THEN** 子代理停止并返回回执，MUST NOT 进入验证收束或归档，MUST NOT 修改 tasks.md

#### Scenario: 无派发能力时降级

- **WHEN** 运行时不提供子代理派发工具
- **THEN** 技能降级为串行本地修复并告知用户，MUST NOT 声称发生过派发

#### Scenario: 白名单同步

- **WHEN** 检查 `iagent_debug` 的 `allowedTools`
- **THEN** 含 `Agent` 与 `Task`（经 `SUBAGENT_DISPATCH` 产出），既有 CodeGraph MCP 与委派条目不变

## MODIFIED Requirements

### Requirement: auto-workflow 继承共享资源协议

`iagent_auto_workflow` 的 Phase 4（auto-apply）SHALL **显式声明继承** `iagent_spec_apply` 的派发协议与共享资源协议（派发单元 / 并发上限集中管理 / 变更级 handoff 包 / 产出登记表 / 回执最小化 / 共享指令前缀 / 禁止项与缺口回执），MUST NOT 另立一套派发指令格式或重复定义协议文本。

技能正文 SHALL 在 Phase 4 段落中包含继承声明句，使 Phase 4 的派发行为与 `iagent_spec_apply` 单一源保持一致；`auto-mode=true` 只跳过设计确认门，共享资源协议照常生效。若 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md` 已由 propose 阶段产出，Phase 4 SHALL **只读复用**该包（不重产整包），并在阶段收束时向其追加 `## 阶段结论`。

#### Scenario: Phase 4 显式声明继承

- **WHEN** Phase 3 验证 PASS 并进入 Phase 4 auto-apply
- **THEN** 技能正文明确声明 Phase 4 继承 `iagent_spec_apply` 的共享资源协议（含 handoff 包 / 产出登记表 / 回执最小化 / 共享指令前缀四载体），并声明 MUST NOT 另立派发指令格式

#### Scenario: 复用 propose 产出的 handoff 包

- **WHEN** Phase 4 开始时已存在 `pipeline-<change-name>/handoff-pack.md`
- **THEN** Phase 4 只读该包并按单元派发，MUST NOT 重新蒸馏 proposal/specs/design

#### Scenario: auto-mode 下协议照常生效

- **WHEN** Phase 4 以 `auto-mode=true` 执行批次派发
- **THEN** handoff 包复用/产出、产出登记表追加、回执最小化与共享指令前缀均照常生效，不因 auto-mode 而豁免

#### Scenario: 派发失败仍按既有策略处理

- **WHEN** 某子代理在 Phase 4 中派发失败
- **THEN** 自动重试一次；仍失败则暂停并报告（既有错误处理不变，共享资源协议不修改失败语义）

### Requirement: debug 流程级探查摘要共享

`iagent_debug` SHALL 在 Phase 2（排查定位）维护**流程级探查摘要** `investigation-digest.md`，落于流程级临时工作区 `.openspec-tmp/debug-<keyword>/`，用于跨调试循环轮次复用探查结论，避免重跑同一代码区域的 CodeGraph 查询。

`<keyword>` SHALL 为该次调试主题的 **kebab-case 关键词**（与 `openspec/explorations/<keyword>-explore-<sequence>.md` 的关键词同源同规则），MUST NOT 直接使用 bug 描述原文（避免空格与非法字符）。

- **先读后查**：Phase 2 起始 SHALL 先判定摘要是否存在；存在则读取并复用其中命中范围的结论，**同范围已覆盖的 2.2.1–2.2.3 查询 MUST NOT 重复发起**，仅执行增量查询；不存在则初始化空摘要。
- **增量写入**：2.2.1–2.2.4 每步结论 SHALL **增量写入**摘要，与既有「实时写诊断记录」并行（**不替代**诊断记录）。
- **失效规则**：某 bug 的修复改动代码后，摘要中**受影响范围**的结论 SHALL 标记为失效（`> 已失效（由 <bug 标识> 修复改动代码）`）并在下次进入 Phase 2 时重新查询；MUST NOT 复用已失效结论。
- **循环回边**：调试循环（4.3）进入下一个 bug 时 SHALL 同样先读摘要、只做增量查询。
- **作为 handoff 包的前置来源**：`changeName` 确定后，摘要结论 SHALL 作为 `.openspec-tmp/pipeline-<changeName>/handoff-pack.md` 的 `## Codebase 摘要` 节来源之一（语义衔接，不重复探查）；MUST NOT 因此把摘要内容改写为交付物。
- **收尾清理**：Phase 7 收尾 SHALL 统一清理该流程级工作区（含非缺陷退出与中途退出路径）；清理失败记 WARN 且 MUST NOT 阻断。
- **非交付物**：摘要 SHALL 仅为流程内缓存，MUST NOT 替代诊断记录或 Phase 6 对变更 `exploration.md` 的持久化；清理摘要 MUST NOT 影响交付物。

#### Scenario: Phase 2 起始先读摘要

- **WHEN** Phase 2 开始且流程级探查摘要已存在
- **THEN** 技能读取摘要并复用命中范围的结论，仅对摘要未覆盖的范围执行查询

#### Scenario: 不重复已覆盖的查询

- **WHEN** 摘要已覆盖某代码区域的 2.2.1–2.2.3 查询结论
- **THEN** 技能 MUST NOT 对该区域重复发起同类 CodeGraph 查询

#### Scenario: 摘要不存在时初始化

- **WHEN** Phase 2 开始且摘要不存在
- **THEN** 技能初始化空摘要并按常规流程执行 2.2.1–2.2.3 查询，逐步骤增量写入

#### Scenario: 调试循环复用摘要

- **WHEN** 用户在调试循环（4.3）回答「有」并进入下一个 bug
- **THEN** 重新进入 Phase 2 时先读摘要、仅做增量查询，不重跑已覆盖区域

#### Scenario: 工作区关键词派生

- **WHEN** 技能创建 `.openspec-tmp/debug-<keyword>/` 工作区
- **THEN** `<keyword>` 为该次调试主题的 kebab-case 关键词（与探索文件关键词同规则），不使用 bug 描述原文

#### Scenario: 摘要作为 handoff 包 Codebase 摘要来源

- **WHEN** `changeName` 已确定且 handoff 包需要 `## Codebase 摘要` 内容
- **THEN** 技能引用探查摘要的既有结论填入该节，MUST NOT 重新执行已覆盖的探查

#### Scenario: 修复改动后的摘要失效

- **WHEN** 某 bug 的修复改动了某个代码区域，而摘要中已有该区域的探查结论
- **THEN** 该范围的结论被标记为失效，下次进入 Phase 2 时重新查询，MUST NOT 复用已失效结论

#### Scenario: 摘要落盘失败不阻断

- **WHEN** 流程级工作区不可写导致摘要无法落盘
- **THEN** 技能记 WARN 并降级为仅会话内复用，排查与修复流程 MUST NOT 被阻断

#### Scenario: 收尾清理摘要

- **WHEN** Phase 7 收尾（含非缺陷退出与中途退出路径）
- **THEN** 技能统一清理 `.openspec-tmp/debug-<keyword>/` 工作区；清理失败记 WARN 并提示路径，不阻断流程

#### Scenario: 摘要不替代交付物

- **WHEN** 摘要已在流程中使用
- **THEN** 诊断记录与 Phase 6 对变更 `exploration.md` 的持久化仍照常执行；摘要作为流程内缓存被清理 MUST NOT 影响任何交付物

### Requirement: 每阶段至多一个阻塞确认门（门预算）

编排流程 SHALL 满足门预算：**每个阶段（探索 / 提案 / 实现 / 归档）至多一个阻塞确认门**。新增或修改门时 MUST NOT 突破该预算；回归测试 SHALL 以结构断言锁定各阶段的阻塞门数量。

门的**合法性**由 `GATE_WHITELIST`（`src/core/host-orchestration/protocol.ts`，由 `prompt-gate.ts` 反向 import 渲染）裁决：白名单外的动作 MUST NOT 被建成门；「破坏性改动确认」为动作级安全条，不计入任何阶段的阶段门数量（它不是阶段推进门，而是不可逆动作的前置确认）。

#### Scenario: 探索阶段门数不超预算

- **WHEN** 统计委派探索（`iagent_spec_explore` delegated）在正常流程中的阻塞确认门
- **THEN** 其阻塞门 SHALL ≤ 1（提示词门合并入 grill 首批；流程图门为唯一流程级阻塞门；聚合一致性门默认直通）

#### Scenario: 实现阶段单门

- **WHEN** 检查 `iagent_workflow` 实现阶段
- **THEN** 实现确认与测试计划确认 SHALL 合并为单一阻塞门

#### Scenario: 白名单外的门不被计入

- **WHEN** 某技能正文出现「是否继续」「是否调用某技能」类询问
- **THEN** 该询问 MUST NOT 被视为合法门，也 MUST NOT 计入阶段门数量；生成期测试 SHALL 拦截该句式

#### Scenario: 破坏性改动确认不占用阶段门预算

- **WHEN** 某阶段同时存在其阶段门与一次破坏性改动确认
- **THEN** 破坏性改动确认按动作级安全条执行，MUST NOT 被判定为「同阶段第二个阻塞门」
