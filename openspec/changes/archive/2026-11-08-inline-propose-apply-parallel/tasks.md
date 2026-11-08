# Tasks: inline-propose-apply-parallel

<!-- 流程基准：exploration.md 的 ## 功能流程图（N0-N20，已确认）。每个任务标注对应节点 id。 -->

## 1. 阶段执行方式声明（N2）

- [x] 1.1 [代码] `PROPOSE_PHASE` 改 `allowed=['inline','subagent']`（兼容窗），移除 `delegate` [N1][N3][N10]
  - 文件：`src/core/host-orchestration/workflows.ts:40`
  - 验证：声明含 inline；`requiredCapabilities` 不含 `delegate`
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 探索与写阶段内联

- [x] 1.2 [代码] `APPLY_PHASE` 改 `allowed=['inline','subagent']`，移除 `delegate` [N6][N10]
  - 文件：`src/core/host-orchestration/workflows.ts:66`
  - 验证：声明含 inline；不含 `delegate`
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 探索与写阶段内联

- [x] 1.3 [代码] `AUTO_APPLY_PHASE` 同步 1.2 [N6][N10]
  - 文件：`src/core/host-orchestration/workflows.ts:95`
  - 验证：与 APPLY 一致
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 探索与写阶段内联

- [x] 1.4 [代码] 确认 `spec-bulk-archive` 内部并行单元仍要求子代理（阶段声明不吸收该子阶段） [N9]
  - 文件：`src/core/host-orchestration/workflows.ts`、`src/core/templates/workflows/spec-bulk-archive.ts`
  - 验证：批量归档并行声明与 `SUBAGENT_DISPATCH` 保留
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 批量归档保留并行

## 2. 阶段推进校验（N17）

- [x] 2.1 [代码] 兼容窗覆盖 propose / apply：`subagent` 回执记 deprecation WARN 且允许推进 [N17][N20]
  - 文件：`src/core/host-orchestration/transition.ts:145`
  - 验证：WARN 文案与 `advance=true`
  - Spec Ref：host-orchestration / Phase transition validates execution mode
  - Scenario Ref：host-orchestration / Phase transition validates execution mode / 兼容窗子代理回执记 deprecation WARN

- [x] 2.2 [代码] 写阶段 `inline` 不再阻断；`requiredCapabilities` 缺 `delegate` 不再阻断 [N17][N18][N19]
  - 文件：`src/core/host-orchestration/transition.ts`
  - 验证：propose / apply inline 回执推进为 true
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 内联阶段不要求 delegate 能力

- [x] 2.3 [代码] 缺省 `execution` 不校验、验证 self WARN、degraded、resume WARN 保持 [N17]
  - 文件：`src/core/host-orchestration/transition.ts`
  - 验证：既有断言与新增断言通过
  - Spec Ref：host-orchestration / Phase transition validates execution mode
  - Scenario Ref：host-orchestration / Phase transition validates execution mode / 验证内联自证记 WARN 且可推进

- [x] 2.4 [代码] 确认 degraded 统一 `local-degraded` 语义未变 [N17]
  - 文件：`src/core/host-orchestration/transition.ts`
  - 验证：degraded 断言通过
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / degraded 宿主统一本地执行

- [x] 2.5 [代码] 确认 `contextReplay=true` WARN 保留 [N17]
  - 文件：`src/core/host-orchestration/transition.ts`
  - 验证：断言通过
  - Spec Ref：host-orchestration / Phase transition validates execution mode
  - Scenario Ref：host-orchestration / Phase transition validates execution mode / 复验使用 resume 记 WARN

- [x] 2.6 [代码] 确认「缺省 execution 不校验」与「degraded 不得声称子代理」保持 [N17]
  - 文件：`src/core/host-orchestration/transition.ts`
  - 验证：断言通过
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 阶段规格缺省不校验执行方式

## 3. 渲染（N2）

- [x] 3.1 [代码] 更新 `render.ts` 分级执行文本：propose / apply 内联，仅 bulk 并行保留子代理 [N2]
  - 文件：`src/core/host-orchestration/render.ts`
  - 验证：生成文本不再出现「propose / apply 子代理」
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 验证与收尾阶段内联优先

- [x] 3.2 [代码] 更新验证段：单轮内联 + 证据 + 报告 [N2]
  - 文件：`src/core/host-orchestration/render.ts`
  - 验证：关键词齐备
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 验证内联以证据而非非作者约束

## 4. spec-propose 内联（N3 / N4）

- [x] 4.1 [代码] `spec-propose` 声明主 agent 内联执行：迁移探索文件 + 依赖序生成 + handoff 包 [N3][N4][N5]
  - 文件：`src/core/templates/workflows/spec-propose.ts`
  - 验证：正文含「主 agent 内联」「不派发子代理」
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / propose / apply 内联

- [x] 4.2 [代码] 保留 delegated 契约与 handoff 包产出规则不变 [N5]
  - 文件：`src/core/templates/workflows/spec-propose.ts`
  - 验证：既有 handoff/回执断言通过
  - Spec Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 跨阶段复用 propose 产出的包

## 5. spec-apply 单 agent 分批（N6-N11）

- [x] 5.1 [代码] 重写派发协议为「主 agent 分批循环」：同 group 聚单元、逐批推进 [N6][N7][N12]
  - 文件：`src/core/templates/workflows/spec-apply.ts`、`references/batch-scheduling.md`
  - 验证：正文不再出现「每单元派发一个子代理」；含「主 agent 分批」
  - Spec Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 主 agent 分批实现

- [x] 5.2 [代码] 批内并行只读：独立 Read/Grep/CodeGraph 调用可同回合发起 [N8]
  - 文件：`src/core/templates/workflows/spec-apply.ts`、`references/batch-scheduling.md`
  - 验证：含「并行只读」「不是独立上下文并行」
  - Spec Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 批内并行只读

- [x] 5.3 [代码] 写同一文件串行、不同文件可并行；文件归属表反映拆分 [N9][N10][N11]
  - 文件：同上
  - 验证：含「同一文件串行」
  - Spec Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 同文件串行写入

- [x] 5.4 [代码] 进度登记表 `apply-progress.md` 替代子代理回执；四列语义保留 [N10]
  - 文件：同上
  - 验证：含路径、四列、MUST NOT 粘贴代码
  - Spec Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 进度表跨批共享

- [x] 5.5 [代码] `apply.concurrency` 语义改为每批单元数软上限 [N7]
  - 文件：同上
  - 验证：不再约束子代理并发
  - Spec Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 主 agent 分批实现

- [x] 5.6 [代码] 保留 handoff 包复用/自建、指纹校验、阶段结论只追加、fail-safe、单任务直做、auto-mode 不豁免 [N5][N7]
  - 文件：同上
  - 验证：既有断言 + 新断言通过
  - Spec Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 独立调用时按同一协议产出包

- [x] 5.7 [代码] 空值处置：无契约/无签名记「无」，不编造 [N10]
  - 文件：同上
  - 验证：关键词
  - Spec Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 空值处置不留空不编造

- [x] 5.8 [代码] 指纹不一致重建 + WARN；阶段结论只追加 [N5][N16]
  - 文件：同上
  - 验证：关键词
  - Spec Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 指纹不一致时重建

- [x] 5.9 [代码] fail-safe 降级与单任务直做、auto-mode 规则保留 [N7]
  - 文件：同上
  - 验证：关键词
  - Spec Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 包机制失效 fail-safe 降级

- [x] 5.10 [代码] 阶段结论追加与单任务批次规则保留 [N16]
  - 文件：同上
  - 验证：关键词
  - Spec Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 阶段结论只追加

- [x] 5.11 [代码] 单任务批次直接实现、auto-mode 不豁免共享资源协议 [N7]
  - 文件：同上
  - 验证：关键词
  - Spec Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 单任务批次直接实现

- [x] 5.12 [代码] auto-mode 仍执行 handoff/进度/阶段结论规则 [N7]
  - 文件：同上
  - 验证：关键词
  - Spec Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议 / auto-mode 不豁免共享资源协议

## 6. 编排模板与白名单（N2 / N16）

- [x] 6.1 [代码] `workflow` 的 propose / apply 改 Skill 工具内联；阶段说明更新 [N3][N6]
  - 文件：`src/core/templates/workflows/workflow.ts`
  - 验证：正文不再「前台 Agent 子代理执行 propose/apply」
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / propose / apply 内联

- [x] 6.2 [代码] `auto-workflow` 的 Phase 2 propose / Phase 4 apply 改 Skill 内联；Phase 5 归档同步 [N3][N6]
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 验证：正文与门账本规则同步
  - Spec Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议
  - Scenario Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / Phase 4 内联而非子代理

- [x] 6.3 [代码] `workflow` / `auto-workflow` 的 allowedTools 移除 `Agent, Task` [N16]
  - 文件：两模板 allowedTools
  - 验证：不含 `SUBAGENT_DISPATCH`
  - Spec Ref：workflow-suite-skills / 编排技能的委派与派发白名单齐备性
  - Scenario Ref：workflow-suite-skills / 编排技能的委派与派发白名单齐备性 / auto-workflow 无子代理条目

- [x] 6.4 [代码] `debug` 的 allowedTools 移除 `Agent, Task`（已内联） [N16]
  - 文件：`src/core/templates/workflows/debug.ts`
  - 验证：不含 `Agent, Task`；保留 `Skill(iagent-test)`
  - Spec Ref：workflow-suite-skills / 编排技能的委派与派发白名单齐备性
  - Scenario Ref：workflow-suite-skills / 编排技能的委派与派发白名单齐备性 / debug 无子代理条目

- [x] 6.5 [代码] `migration` 保留 `Agent, Task`（仅上下文阈值降级逃生口使用），并保留 `Skill(iagent_migration_check)` [N16]
  - 文件：`src/core/templates/workflows/migration.ts`
  - 验证：正文说明 Agent/Task 仅用于阈值降级；常规 Phase 3 不派发
  - Spec Ref：workflow-suite-skills / 编排技能的委派与派发白名单齐备性
  - Scenario Ref：workflow-suite-skills / 编排技能的委派与派发白名单齐备性 / migration 与批量归档保留子代理

- [x] 6.6 [代码] `spec-bulk-archive` 保留 `Agent, Task` 与并行单元 [N9]
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`
  - 验证：授权与并行声明保留
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 批量归档保留并行

- [x] 6.7 [代码] `workflow` / `auto-workflow` / `debug` 的 Skill 条目齐备、无幽灵 [N16]
  - 文件：三模板
  - 验证：`Skill(...)` 与正文一致
  - Spec Ref：workflow-suite-skills / 编排技能 SHALL 委派其声明的全部子技能且齐备授权
  - Scenario Ref：workflow-suite-skills / 编排技能 SHALL 委派其声明的全部子技能且齐备授权 / Claude whitelist remains complete

- [x] 6.8 [代码] `auto-workflow` 门账本与 `gate-skip` 规则保留 [N16]
  - 文件：`auto-workflow.ts`
  - 验证：关键词
  - Spec Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议
  - Scenario Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / 门账本兜底

- [x] 6.9 [代码] 测试执行门继承规则保留 [N13]
  - 文件：`auto-workflow.ts`
  - 验证：关键词
  - Spec Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议
  - Scenario Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / 测试执行门继承

- [x] 6.10 [代码] 两端皆缺时设计门照常触发 [N16]
  - 文件：`auto-workflow.ts`
  - 验证：关键词
  - Spec Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议
  - Scenario Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / 两者皆缺时设计门照常触发

- [x] 6.11 [代码] 全宿主内联口径（OpenCode / Pi / Codex） [N2]
  - 文件：`auto-workflow.ts` + 宿主适配文档
  - 验证：MUST NOT 要求子代理权限
  - Spec Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经宿主适配器复用 apply/archive 协议
  - Scenario Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经宿主适配器复用 apply/archive 协议 / 全宿主 apply 内联

- [x] 6.12 [代码] CodeGraph MCP 双写条目保留 [N2]
  - 文件：编排模板
  - 验证：MCP 条目
  - Spec Ref：workflow-suite-skills / 编排技能的委派与派发白名单齐备性
  - Scenario Ref：workflow-suite-skills / 编排技能的委派与派发白名单齐备性 / 调用 CodeGraph 的编排技能含 MCP 条目

## 7. migration Phase 3 内联

- [x] 7.1 [代码] Phase 3 实现改主 agent 分批内联，不再派发子代理 [N4]
  - 文件：`src/core/templates/workflows/migration.ts`
  - 验证：正文不再「每个派发单元一个子代理」
  - Spec Ref：migration-skills / auto-migration 编排技能模板
  - Scenario Ref：migration-skills / auto-migration 编排技能模板 / Phase 3 内联分批

- [x] 7.2 [代码] 保留阈值降级（300 文件 / 15k 行）与 Phase 4 内联复查 [N8]
  - 文件：同上
  - 验证：关键词
  - Spec Ref：migration-skills / auto-migration 编排技能模板
  - Scenario Ref：migration-skills / auto-migration 编排技能模板 / 上下文阈值降级

## 8. 测试与回归

- [x] 8.1 [测试][单元][P0] 断言 propose / apply 声明为 inline + 兼容窗且无 `delegate` [N2]
  - 文件：`test/host-orchestration.test.ts`
  - 验证：阶段声明断言
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 探索与写阶段内联

- [x] 8.2 [测试][单元][P0] 断言写阶段 inline 推进、subagent 兼容窗 WARN [N17]
  - 文件：`test/host-orchestration.test.ts`
  - 验证：`advance` 与 WARN
  - Spec Ref：host-orchestration / Phase transition validates execution mode
  - Scenario Ref：host-orchestration / Phase transition validates execution mode / 兼容窗子代理回执记 deprecation WARN

- [x] 8.3 [测试][单元][P1] 断言验证证据、缺省、degraded、resume 语义保持 [N17]
  - 文件：`test/host-orchestration.test.ts`
  - 验证：断言通过
  - Spec Ref：host-orchestration / Phase transition validates execution mode
  - Scenario Ref：host-orchestration / Phase transition validates execution mode / degraded 不得声称子代理

- [x] 8.4 [测试][单元][P0] 断言 apply 单 agent 分批、批内并行只读、同文件串行 [N7-N11]
  - 文件：`test/stage-continuation.test.ts` / `test/template-consistency.test.ts`
  - 验证：关键词不存在旧子代理派发
  - Spec Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 主 agent 分批实现

- [x] 8.5 [测试][单元][P0] 断言进度表与四列回执语义 [N10]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：关键词
  - Spec Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 进度表跨批共享

- [x] 8.6 [测试][单元][P0] 断言 workflow / auto-workflow / debug 无 `Agent, Task`；migration / bulk 保留 [N16]
  - 文件：`test/allowed-tools.test.ts`
  - 验证：授权矩阵
  - Spec Ref：workflow-suite-skills / 编排技能的委派与派发白名单齐备性
  - Scenario Ref：workflow-suite-skills / 编排技能的委派与派发白名单齐备性 / 白名单无幽灵条目

- [x] 8.7 [测试][单元][P1] 断言单 agent 并行语义与禁止表述 [N8]
  - 文件：`test/template-consistency.test.ts`
  - 验证：关键词
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 单 agent 并行语义

- [x] 8.8 [测试][单元][P2] 断言 auto-workflow 内联与门账本、测试门继承 [N16]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：关键词
  - Spec Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议
  - Scenario Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / Phase 5 内联而非子代理

- [x] 8.9 [测试][单元][P1] 断言 migration Phase 3 内联与阈值保留 [N8]
  - 文件：`test/templates.test.ts`
  - 验证：关键词
  - Spec Ref：migration-skills / auto-migration 编排技能模板
  - Scenario Ref：migration-skills / auto-migration 编排技能模板 / 内联复查修复循环

- [x] 8.10 [测试][单元][P1] 保留 migration 既有断言（蒸馏门 / 目标规范 / CLI 降级 / 失败链） [N4]
  - 文件：`test/templates.test.ts`
  - 验证：既有断言不变
  - Spec Ref：migration-skills / auto-migration 编排技能模板
  - Scenario Ref：migration-skills / auto-migration 编排技能模板 / 蒸馏确认门阻断空清单

- [x] 8.11 [测试][功能][P0] 全量回归 `pnpm test` 全绿 [N14][N18][N19]
  - 文件：`test/`
  - 验证：全量通过；无删除断言
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 白名单与正文一致

## 9. 收尾

- [x] 9.1 [代码] `pnpm build && pnpm generate:skills`；校验 `skill-size-budget` / `skills-parity` [N2]
  - 文件：`skills/`
  - 验证：快照一致
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 白名单与正文一致

- [x] 9.3 [代码] 确认归档内联契约不变（单变更内联、批量并行保留） [N15]
  - 文件：`src/core/templates/workflows/spec-archive.ts` / `spec-bulk-archive.ts`
  - 验证：既有断言通过
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 批量归档保留并行

- [x] 9.2 [代码] 版本递增并同步 CHANGELOG / README / AGENTS.md [N2]
  - 文件：`package.json` / `CHANGELOG.md` / `README.md` / `AGENTS.md`
  - 验证：版本写回一致
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 白名单与正文一致

## 10. 补充断言（场景覆盖）

- [x] 10.1 [测试][单元][P1] 兼容窗旧子代理回执判定 [N20]
  - 文件：`test/host-orchestration.test.ts`
  - 验证：WARN + 推进
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 兼容窗接受旧子代理回执

- [x] 10.2 [测试][单元][P1] 目标规范绑定约束保留 [N4]
  - 文件：`test/templates.test.ts`
  - 验证：既有断言
  - Spec Ref：migration-skills / auto-migration 编排技能模板
  - Scenario Ref：migration-skills / auto-migration 编排技能模板 / 目标规范作为绑定约束

- [x] 10.3 [测试][单元][P1] CLI 降级生成保留 [N4]
  - 文件：`test/templates.test.ts`
  - 验证：既有断言
  - Spec Ref：migration-skills / auto-migration 编排技能模板
  - Scenario Ref：migration-skills / auto-migration 编排技能模板 / CLI 降级生成

- [x] 10.4 [测试][单元][P1] 复查失败降级链保留 [N4]
  - 文件：`test/templates.test.ts`
  - 验证：既有断言
  - Spec Ref：migration-skills / auto-migration 编排技能模板
  - Scenario Ref：migration-skills / auto-migration 编排技能模板 / 复查失败降级链

- [x] 10.5 [测试][单元][P0] apply 单 agent 分批与批内并行只读 [N7][N8]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：关键词
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / apply 单 agent 分批与批内并行只读

- [x] 10.6 [测试][单元][P0] 验证单轮内联 [N5]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：关键词
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 验证单轮内联

- [x] 10.7 [测试][单元][P0] 无证据结论不计分 [N5]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：关键词
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 无证据结论不计分

- [x] 10.8 [测试][单元][P0] 同上下文修复重跑 ≤3 [N5]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：关键词
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 同上下文修复重跑

- [x] 10.9 [测试][单元][P0] workflow 无 `Agent, Task` [N16]
  - 文件：`test/allowed-tools.test.ts`
  - 验证：授权矩阵
  - Spec Ref：workflow-suite-skills / 编排技能的委派与派发白名单齐备性
  - Scenario Ref：workflow-suite-skills / 编排技能的委派与派发白名单齐备性 / workflow 无子代理条目

- [x] 10.10 [测试][单元][P1] OpenCode V2 权限齐备 [N16]
  - 文件：`test/opencode-v2.test.ts`
  - 验证：skill 权限；无多余 subagent
  - Spec Ref：workflow-suite-skills / 编排技能 SHALL 委派其声明的全部子技能且齐备授权
  - Scenario Ref：workflow-suite-skills / 编排技能 SHALL 委派其声明的全部子技能且齐备授权 / OpenCode V2 permissions are complete

- [x] 10.11 [测试][单元][P1] Pi strict 运行时齐备 [N16]
  - 文件：`test/pi-native.test.ts`
  - 验证：既有断言
  - Spec Ref：workflow-suite-skills / 编排技能 SHALL 委派其声明的全部子技能且齐备授权
  - Scenario Ref：workflow-suite-skills / 编排技能 SHALL 委派其声明的全部子技能且齐备授权 / Pi strict runtime is complete

- [x] 10.12 [测试][单元][P1] auto-workflow 内联阶段白名单齐备 [N16]
  - 文件：`test/allowed-tools.test.ts`
  - 验证：Skill 条目；无 Agent
  - Spec Ref：workflow-suite-skills / 编排技能 SHALL 委派其声明的全部子技能且齐备授权
  - Scenario Ref：workflow-suite-skills / 编排技能 SHALL 委派其声明的全部子技能且齐备授权 / auto-workflow 内联阶段白名单齐备

- [x] 10.13 [测试][单元][P1] auto-workflow 白名单无幽灵条目 [N16]
  - 文件：`test/allowed-tools.test.ts`
  - 验证：授权一致性
  - Spec Ref：workflow-suite-skills / 编排技能 SHALL 委派其声明的全部子技能且齐备授权
  - Scenario Ref：workflow-suite-skills / 编排技能 SHALL 委派其声明的全部子技能且齐备授权 / 白名单无幽灵条目（auto-workflow 授权）

- [x] 10.14 [测试][单元][P1] Pi degraded auto workflow [N2]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：local-degraded 声明
  - Spec Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经宿主适配器复用 apply/archive 协议
  - Scenario Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经宿主适配器复用 apply/archive 协议 / Pi degraded auto workflow

- [x] 10.15 [测试][单元][P1] Codex 显式本地执行 [N2]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：不伪装委派
  - Spec Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经宿主适配器复用 apply/archive 协议
  - Scenario Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经宿主适配器复用 apply/archive 协议 / Codex 自动管线显式本地执行

- [x] 10.16 [测试][单元][P1] 失败保持阻断 [N13]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：失败不推进归档
  - Spec Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经宿主适配器复用 apply/archive 协议
  - Scenario Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经宿主适配器复用 apply/archive 协议 / Failure remains blocking
