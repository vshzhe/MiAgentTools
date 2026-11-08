# Tasks: inline-orchestration-delegation

<!-- 流程基准：exploration.md 的 ## 功能流程图（N1-N13，已确认）。每个任务标注对应节点 id。 -->

## 1. 阶段执行方式声明（N2）

- [x] 1.1 [代码] `PROPOSE_PHASE` 保持 `execution.allowed=['subagent']` 与 `requiredCapabilities` 含 `delegate` [N3]
  - 文件：`src/core/host-orchestration/workflows.ts`
  - 验证：声明未变；`host-orchestration.test.ts` 既有断言通过
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 写阶段必须委派

- [x] 1.2 [代码] `VERIFY_PHASE` 改 `execution.allowed=['inline','subagent']`（兼容窗）、`independence='self-allowed'`，`requiredCapabilities` 移除 `delegate` [N5][N10]
  - 文件：`src/core/host-orchestration/workflows.ts:53-62`
  - 验证：`allowed` 含 `inline` 且不含 `subagent`；移除 `delegate`
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 验证与收尾阶段内联优先

- [x] 1.3 [代码] `ARCHIVE_PHASE` / `AUTO_ARCHIVE_PHASE` 改 `allowed=['inline','subagent']`，移除 `delegate` [N6]
  - 文件：`src/core/host-orchestration/workflows.ts:78-87` / `104-112`
  - 验证：兼容窗声明存在；模板以 inline 为主
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 兼容窗接受旧子代理回执

- [x] 1.4 [代码] `DEBUG_FIX` 改 `allowed=['inline','subagent']`，移除 `delegate` [N7]
  - 文件：`src/core/host-orchestration/workflows.ts:133-142`
  - 验证：声明含 inline；编译 / 测试重试预算不变
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 验证与收尾阶段内联优先

- [x] 1.5 [代码] `MIGRATION_SCAN` / `MIGRATION_CHECK` 改 `allowed=['inline','subagent']`，移除 `delegate` [N8]
  - 文件：`src/core/host-orchestration/workflows.ts:159-178`
  - 验证：声明含 inline；Phase 3 apply 语义仍由模板声明子代理
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 验证与收尾阶段内联优先

- [x] 1.6 [代码] `APPLY_PHASE` / `AUTO_APPLY_PHASE` 保持 `['subagent']` 且含 `delegate` [N4]
  - 文件：`src/core/host-orchestration/workflows.ts:65-75` / `93-101`
  - 验证：声明未变
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 写阶段必须委派

## 2. 阶段推进校验（N11）

- [x] 2.1 [代码] `evaluatePhaseTransition` 支持 `independence='self-allowed'`：`self` 记 WARN 且允许推进 [N11]
  - 文件：`src/core/host-orchestration/transition.ts`
  - 验证：验证阶段 `inline + self` 推进为 true 并带 WARN
  - Spec Ref：host-orchestration / Phase transition validates execution mode
  - Scenario Ref：host-orchestration / Phase transition validates execution mode / 验证内联自证记 WARN 且可推进

- [x] 2.2 [代码] 兼容窗：`archive` / `fix` / `migration` 收到 `executionMode=subagent` 时记 deprecation WARN 并允许推进 [N11]
  - 文件：`src/core/host-orchestration/transition.ts`
  - 验证：WARN 文案含「已改为主代理内联」与「下个 major 收紧」
  - Spec Ref：host-orchestration / Phase transition validates execution mode
  - Scenario Ref：host-orchestration / Phase transition validates execution mode / 兼容窗子代理回执记 deprecation WARN

- [x] 2.3 [代码] 写阶段 `inline` 仍阻断；degraded 非 `local-degraded` 仍按不实声明处理 [N11][N13]
  - 文件：`src/core/host-orchestration/transition.ts`
  - 验证：既有阻断 / WARN 断言通过
  - Spec Ref：host-orchestration / Phase transition validates execution mode
  - Scenario Ref：host-orchestration / Phase transition validates execution mode / 写阶段内联被阻断

- [x] 2.4 [代码] inline 阶段缺 `delegate` 时不阻断；degraded 全阶段 `local-degraded` [N11]
  - 文件：`src/core/host-orchestration/transition.ts`
  - 验证：strict 缺 `delegate` 时 verify / archive / fix / migration 可执行
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 内联阶段不要求 delegate 能力

- [x] 2.5 [代码] 未声明 `execution` 的阶段不校验执行方式（旧阶段兼容） [N11]
  - 文件：`src/core/host-orchestration/transition.ts`
  - 验证：缺省路径不新增阻断
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 阶段规格缺省不校验执行方式

- [x] 2.6 [代码] degraded 宿主回执声称 `subagent` 记 WARN，不视为严格委派 [N11]
  - 文件：`src/core/host-orchestration/transition.ts`
  - 验证：既有 degraded 断言通过
  - Spec Ref：host-orchestration / Phase transition validates execution mode
  - Scenario Ref：host-orchestration / Phase transition validates execution mode / degraded 不得声称子代理

- [x] 2.7 [代码] resume 复验仍记 WARN；复验改为同上下文增量重跑 [N11]
  - 文件：`src/core/host-orchestration/transition.ts`、`src/core/templates/workflows/spec-verify.ts`
  - 验证：`contextReplay=true` WARN 保留；模板不再要求新开代理
  - Spec Ref：host-orchestration / Phase transition validates execution mode
  - Scenario Ref：host-orchestration / Phase transition validates execution mode / 复验使用 resume 记 WARN

## 3. 渲染与宿主面（N2）

- [x] 3.1 [代码] 更新 `render.ts:195` 的分级执行契约文本：verify / archive / fix / migration 内联优先，propose / apply 子代理 [N2]
  - 文件：`src/core/host-orchestration/render.ts`
  - 验证：生成文本与新声明一致；不出现「archive 子代理」旧句
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 验证与收尾阶段内联优先

- [x] 3.2 [代码] 更新 degraded 覆盖声明：内联阶段本地执行仍不构成委派 [N2]
  - 文件：`src/core/host-orchestration/render.ts`
  - 验证：degraded 文本与既有语义一致
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / degraded 宿主统一本地执行

## 4. workflow / auto-workflow 模板（N5 / N6）

- [x] 4.1 [代码] `workflow` Phase 3 验证合并为**一次**主 agent 内联验证（覆盖 verify-proposal 评分与 proposal-review 深探清单），MUST NOT 派生 Agent 子代理 [N5][N10]
  - 文件：`src/core/templates/workflows/workflow.ts`
  - 验证：正文含「一次内联验证」「合并清单」「MUST NOT 派生验证子代理」；验证报告路径
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 验证单轮内联

- [x] 4.2 [代码] `workflow` Phase 5 归档改为 Skill 工具内联执行 [N6]
  - 文件：`src/core/templates/workflows/workflow.ts`
  - 验证：正文含「内联执行归档协议」
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 单变更归档内联

- [x] 4.3 [代码] `auto-workflow` Phase 3 验证改为主 agent 内联 [N5]
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 验证：同 4.1
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 验证单轮内联

- [x] 4.4 [代码] `auto-workflow` Phase 5 归档改为 Skill 工具内联执行 [N6]
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 验证：同 4.2
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 单变更归档内联

- [x] 4.5 [代码] 两个编排技能保持 Phase 2 propose / Phase 4 apply 子代理与 `Agent, Task` 授权 [N3][N4]
  - 文件：`workflow.ts` / `auto-workflow.ts`
  - 验证：委派语句与 allowedTools 仍在
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 写阶段必须委派

- [x] 4.6 [代码] 验证内联契约写入正文：固定清单、`文件:行` 证据、无证据不计分、同上下文修复 ≤3、报告落盘 [N5]
  - 文件：`workflow.ts` / `auto-workflow.ts`
  - 验证：关键词齐备
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 无证据结论不计分

- [x] 4.7 [代码] 同上下文修复重跑契约写入正文 [N5]
  - 文件：`workflow.ts` / `auto-workflow.ts`
  - 验证：含「禁止新开验证代理」「重读未改动制品」
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 同上下文修复重跑

- [x] 4.8 [代码] 兼容窗说明写入正文：旧 subagent 回执 WARN 可推进 [N11]
  - 文件：`workflow.ts` / `auto-workflow.ts`
  - 验证：含「deprecation」「下个 major」
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 兼容窗旧回执

## 5. debug 模板（N7）

- [x] 5.1 [代码] `debug` Phase 4 修复改为内联（修复 + 编译 + 范围内测试），共用重试预算 [N7]
  - 文件：`src/core/templates/workflows/debug.ts`
  - 验证：正文含「内联执行修复」；预算 ≤3
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / debug 修复内联

- [x] 5.2 [代码] `debug` verify-close 内的验证 / 复查改为内联，不再派生嵌套子代理 [N5]
  - 文件：`src/core/templates/workflows/debug.ts`
  - 验证：正文含「内联验证」「MUST NOT 派生嵌套子代理」
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 验证单轮内联

- [x] 5.3 [代码] `debug` allowedTools 移除 `Agent, Task`；保留 `Skill(iagent-test)` 与内联调用的验证技能条目 [N7]
  - 文件：`src/core/templates/workflows/debug.ts`（allowedTools）
  - 验证：不含 `SUBAGENT_DISPATCH`；含 `Skill(iagent-test)`
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 白名单与正文一致

- [x] 5.4 [代码] 批量归档保留并行子代理，`spec-bulk-archive` 正文与授权不改 [N9]
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`
  - 验证：并行声明与 `SUBAGENT_DISPATCH` 仍在
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 批量归档保留并行

- [x] 5.5 [代码] `iagent_test` 作为内联调用的技能（`Skill(...)`）保留，不改为子代理 [N7]
  - 文件：`debug.ts` / `spec-apply.ts`
  - 验证：`Skill(iagent-test)` 条目存在
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 白名单与正文一致

## 6. migration 模板（N8）

- [x] 6.1 [代码] source-scan 改为主 agent 内联 [N8]
  - 文件：`src/core/templates/workflows/migration.ts`
  - 验证：正文含「source-scan 内联」
  - Spec Ref：migration-skills / auto-migration 编排技能模板
  - Scenario Ref：migration-skills / auto-migration 编排技能模板 / 目标规范作为绑定约束

- [x] 6.2 [代码] Phase 4 复查改为主 agent 内联，直接非交互调用 `iagent_migration_check`，结论带 `文件:行` 证据 [N8a]
  - 文件：`src/core/templates/workflows/migration.ts`
  - 验证：不再出现「派发独立复查子代理」
  - Spec Ref：migration-skills / auto-migration 编排技能模板
  - Scenario Ref：migration-skills / auto-migration 编排技能模板 / 内联复查修复循环

- [x] 6.3 [代码] Phase 3 实现保留子代理（apply 语义） [N4]
  - 文件：`src/core/templates/workflows/migration.ts`
  - 验证：每派发单元一子代理的表述保留
  - Spec Ref：migration-skills / auto-migration 编排技能模板
  - Scenario Ref：migration-skills / auto-migration 编排技能模板 / Phase 3 保留子代理

- [x] 6.4 [代码] 阈值降级：计划读取文件数 > 300 或制品行数 > 15k → 子代理 + WARN [N8]
  - 文件：`src/core/templates/workflows/migration.ts`
  - 验证：阈值常量与 WARN 文案存在
  - Spec Ref：migration-skills / auto-migration 编排技能模板
  - Scenario Ref：migration-skills / auto-migration 编排技能模板 / 上下文阈值降级

- [x] 6.5 [代码] 复查失败降级链改为「串行重试一次 → WARN 完成」（主流程直调不再需要） [N8b]
  - 文件：`src/core/templates/workflows/migration.ts`
  - 验证：降级链文案更新
  - Spec Ref：migration-skills / auto-migration 编排技能模板
  - Scenario Ref：migration-skills / auto-migration 编排技能模板 / 复查失败降级链

- [x] 6.6 [代码] 保留既有蒸馏确认门、目标规范绑定、CLI 降级语义不变 [N8]
  - 文件：`src/core/templates/workflows/migration.ts`
  - 验证：三段正文未变
  - Spec Ref：migration-skills / auto-migration 编排技能模板
  - Scenario Ref：migration-skills / auto-migration 编排技能模板 / 蒸馏确认门阻断空清单

- [x] 6.7 [代码] 保留 CLI 降级生成语义不变 [N8]
  - 文件：`src/core/templates/workflows/migration.ts`
  - 验证：command-not-found 声明一次、不重试
  - Spec Ref：migration-skills / auto-migration 编排技能模板
  - Scenario Ref：migration-skills / auto-migration 编排技能模板 / CLI 降级生成

- [x] 6.8 [代码] `migration` allowedTools 与正文一致（Phase 3 子代理保留，Phase 4 内联不需要 `Agent, Task` 之外的扩张） [N8]
  - 文件：`src/core/templates/workflows/migration.ts`
  - 验证：白名单与正文调用一致
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 白名单与正文一致

## 7. 被委派技能模板（N5 / N6 / N9）

- [x] 7.1 [代码] `spec-verify` 声明内联契约：单轮、清单、证据、报告路径、同上下文复跑 [N5]
  - 文件：`src/core/templates/workflows/spec-verify.ts`
  - 验证：关键词齐备；回执字段 `executionMode=inline` / `independence=self` / `readScope`
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 验证单轮内联

- [x] 7.2 [代码] `spec-archive` 声明内联契约（单变更）；非阻断语义不变 [N6]
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - 验证：正文含「主 agent 内联」
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 单变更归档内联

- [x] 7.4 [代码] `spec-verify-proposal` / `proposal-review` 同步内联契约：默认主 agent 内联、`independence=self`、`文件:行` 证据、报告落盘、兼容窗 subagent WARN [N5][N10]
  - 文件：`src/core/templates/workflows/spec-verify-proposal.ts` / `proposal-review.ts`
  - 验证：正文含「主 agent 内联」「无证据不计入通过」「兼容窗」
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 验证单轮内联

- [x] 7.3 [代码] `spec-bulk-archive` 保持并行子代理声明 [N9]
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`
  - 验证：并行单元与 `SUBAGENT_DISPATCH` 仍在
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 批量归档保留并行

## 8. 文档与白名单

- [x] 8.1 [代码] 更新 `AGENTS.md` 的分级执行表述与内联验证证据契约 [N5]
  - 文件：`AGENTS.md`
  - 验证：不再写「verify 默认子代理」「archive 子代理」
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 白名单与正文一致

- [x] 8.2 [代码] 复核共享白名单常量：内联技能移除 `Agent, Task`，保留 `Skill(...)` [N7]
  - 文件：`src/core/templates/tool-whitelist.ts`、各模板 allowedTools
  - 验证：`test/allowed-tools.test.ts` 通过
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 白名单与正文一致

## 9. 测试：host-orchestration

- [x] 9.1 [测试][单元][P0] 断言 `VERIFY_PHASE` 为 inline + self-allowed 且无 `delegate` [N5]
  - 文件：`test/host-orchestration.test.ts`
  - 验证：阶段声明断言
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 验证内联以证据而非非作者约束

- [x] 9.2 [测试][单元][P0] 断言写阶段 `inline` 被阻断、`subagent` 通过 [N4]
  - 文件：`test/host-orchestration.test.ts`
  - 验证：`advance` 与 `blockedBy`
  - Spec Ref：host-orchestration / Phase transition validates execution mode
  - Scenario Ref：host-orchestration / Phase transition validates execution mode / 写阶段内联被阻断

- [x] 9.3 [测试][单元][P0] 断言兼容窗 `subagent` 回执 deprecation WARN 且可推进 [N11]
  - 文件：`test/host-orchestration.test.ts`
  - 验证：WARN 文案与 `advance=true`
  - Spec Ref：host-orchestration / Phase transition validates execution mode
  - Scenario Ref：host-orchestration / Phase transition validates execution mode / 兼容窗子代理回执记 deprecation WARN

- [x] 9.4 [测试][单元][P0] 断言内联阶段缺 `delegate` 仍可执行 [N11]
  - 文件：`test/host-orchestration.test.ts`
  - 验证：strict 缺能力时 verify / archive / fix / migration 不因能力阻断
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 内联阶段不要求 delegate 能力

- [x] 9.5 [测试][单元][P1] 断言缺省 `execution` 不校验执行方式 [N11]
  - 文件：`test/host-orchestration.test.ts`
  - 验证：兼容路径
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 阶段规格缺省不校验执行方式

- [x] 9.6 [测试][单元][P1] 断言 degraded 不得声称 `subagent` [N11]
  - 文件：`test/host-orchestration.test.ts`
  - 验证：既有断言保留
  - Spec Ref：host-orchestration / Phase transition validates execution mode
  - Scenario Ref：host-orchestration / Phase transition validates execution mode / degraded 不得声称子代理

- [x] 9.7 [测试][单元][P1] 断言 resume 复验 WARN 保留 [N11]
  - 文件：`test/host-orchestration.test.ts`
  - 验证：`contextReplay` 断言
  - Spec Ref：host-orchestration / Phase transition validates execution mode
  - Scenario Ref：host-orchestration / Phase transition validates execution mode / 复验使用 resume 记 WARN

- [x] 9.8 [测试][单元][P1] 断言探索阶段内联、写阶段委派、验证/收尾内联优先 [N2]
  - 文件：`test/host-orchestration.test.ts`
  - 验证：阶段声明矩阵断言
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 探索阶段内联

- [x] 9.9 [测试][单元][P1] 断言 degraded 全阶段 `local-degraded` [N11]
  - 文件：`test/host-orchestration.test.ts`
  - 验证：degraded 矩阵
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / degraded 宿主统一本地执行

## 10. 测试：workflow-suite-skills

- [x] 10.1 [测试][单元][P0] 断言验证单轮内联、不派生两个验证子代理 [N5]
  - 文件：`test/stage-continuation.test.ts` / `test/template-consistency.test.ts`
  - 验证：正文不含「前台 Agent 子代理」用于 verify
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 验证单轮内联

- [x] 10.2 [测试][单元][P0] 断言无证据结论不计分 [N5]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：正文含「无证据」「不计入通过」
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 无证据结论不计分

- [x] 10.3 [测试][单元][P0] 断言同上下文修复重跑（禁止新开代理 / 全量重读） [N5]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：关键词与循环上限
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 同上下文修复重跑

- [x] 10.4 [测试][单元][P0] 断言单变更归档内联、批量归档并行保留 [N6][N9]
  - 文件：`test/template-consistency.test.ts`
  - 验证：archive 内联；bulk 并行
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 单变更归档内联

- [x] 10.5 [测试][单元][P1] 断言 debug fix 内联与预算不变 [N7]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：关键词
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / debug 修复内联

- [x] 10.6 [测试][单元][P1] 断言兼容窗旧回执 WARN 文案 [N11]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：deprecation 文案
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 兼容窗旧回执

- [x] 10.7 [测试][单元][P0] 断言白名单与正文一致（内联技能无 `Agent, Task`） [N7]
  - 文件：`test/allowed-tools.test.ts`
  - 验证：debug 不含 `Agent, Task`；保留 `Skill(iagent-test)`
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 白名单与正文一致

- [x] 10.8 [测试][单元][P1] 断言批量归档保留并行子代理 [N9]
  - 文件：`test/template-consistency.test.ts`
  - 验证：bulk 并行断言
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 批量归档保留并行

## 11. 测试：migration-skills

- [x] 11.1 [测试][单元][P0] 断言 Phase 4 内联复查修复循环 [N8a]
  - 文件：`test/templates.test.ts`
  - 验证：正文含「内联复查」「同上下文」
  - Spec Ref：migration-skills / auto-migration 编排技能模板
  - Scenario Ref：migration-skills / auto-migration 编排技能模板 / 内联复查修复循环

- [x] 11.2 [测试][单元][P0] 断言上下文阈值降级（300 文件 / 15k 行 + WARN） [N8]
  - 文件：`test/templates.test.ts`
  - 验证：阈值与 WARN 文案
  - Spec Ref：migration-skills / auto-migration 编排技能模板
  - Scenario Ref：migration-skills / auto-migration 编排技能模板 / 上下文阈值降级

- [x] 11.3 [测试][单元][P0] 断言 Phase 3 保留子代理 [N4]
  - 文件：`test/templates.test.ts`
  - 验证：每单元子代理表述
  - Spec Ref：migration-skills / auto-migration 编排技能模板
  - Scenario Ref：migration-skills / auto-migration 编排技能模板 / Phase 3 保留子代理

- [x] 11.4 [测试][单元][P1] 断言复查失败降级链 [N8b]
  - 文件：`test/templates.test.ts`
  - 验证：串行重试一次 → WARN
  - Spec Ref：migration-skills / auto-migration 编排技能模板
  - Scenario Ref：migration-skills / auto-migration 编排技能模板 / 复查失败降级链

- [x] 11.5 [测试][单元][P1] 保留既有蒸馏确认门 / 目标规范 / CLI 降级断言 [N8]
  - 文件：`test/templates.test.ts`
  - 验证：既有断言不变
  - Spec Ref：migration-skills / auto-migration 编排技能模板
  - Scenario Ref：migration-skills / auto-migration 编排技能模板 / 蒸馏确认门阻断空清单

- [x] 11.6 [测试][单元][P1] 保留目标规范绑定断言 [N8]
  - 文件：`test/templates.test.ts`
  - 验证：既有断言不变
  - Spec Ref：migration-skills / auto-migration 编排技能模板
  - Scenario Ref：migration-skills / auto-migration 编排技能模板 / 目标规范作为绑定约束

- [x] 11.7 [测试][单元][P1] 保留 CLI 降级生成断言 [N8]
  - 文件：`test/templates.test.ts`
  - 验证：既有断言不变
  - Spec Ref：migration-skills / auto-migration 编排技能模板
  - Scenario Ref：migration-skills / auto-migration 编排技能模板 / CLI 降级生成

## 12. 回归与收尾

- [x] 12.1 [测试][功能][P0] 全量回归：`pnpm test` 全绿，重点 `host-orchestration` / `stage-continuation` / `template-consistency` / `allowed-tools` / `templates` [N1][N10][N12][N13]
  - 文件：`test/`
  - 验证：全量通过；无删除断言
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 白名单与正文一致

- [x] 12.2 [代码] `pnpm build && pnpm generate:skills`，并校验 `skill-size-budget` / `skills-parity` [N2]
  - 文件：`skills/`
  - 验证：快照一致；主文件 ≤500 行
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 白名单与正文一致

- [x] 12.3 [代码] 版本递增（由 `node bin/iagent.js version` 判定）并同步 CHANGELOG / README [N2]
  - 文件：`package.json` / `CHANGELOG.md` / `README.md`
  - 验证：版本写回一致
  - Spec Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约
  - Scenario Ref：workflow-suite-skills / 编排执行方式内联优先与验证证据契约 / 白名单与正文一致
