## ADDED Requirements

### Requirement: tr-impl-auto-workflow 继承共享资源协议

`venus_tr_impl_auto_workflow` 的 Phase 4（auto-apply）SHALL **显式声明继承** `venus_spec_apply` 的派发协议与共享资源协议（派发单元 / 并发上限集中管理 / 上下文包 / 产出登记表 / 回执最小化 / 共享指令前缀 / 禁止项与缺口回执），MUST NOT 另立一套派发指令格式或重复定义协议文本。

技能正文 SHALL 在 Phase 4 段落中包含继承声明句，使 Phase 4 的派发行为与 `venus_spec_apply` 单一源保持一致；`auto-mode=true` 只跳过设计确认门，共享资源协议照常生效。

#### Scenario: Phase 4 显式声明继承

- **WHEN** Phase 3 验证 PASS 并进入 Phase 4 auto-apply
- **THEN** 技能正文明确声明 Phase 4 继承 `venus_spec_apply` 的共享资源协议（含上下文包 / 产出登记表 / 回执最小化 / 共享指令前缀四载体），并声明 MUST NOT 另立派发指令格式

#### Scenario: auto-mode 下协议照常生效

- **WHEN** Phase 4 以 `auto-mode=true` 执行批次派发
- **THEN** 上下文包产出、产出登记表追加、回执最小化与共享指令前缀均照常生效，不因 auto-mode 而豁免

#### Scenario: 派发失败仍按既有策略处理

- **WHEN** 某子代理在 Phase 4 中派发失败
- **THEN** 自动重试一次；仍失败则暂停并报告（既有错误处理不变，共享资源协议不修改失败语义）

### Requirement: 多项目 CodeGraph 扫描单代理化

`venus_tr_impl_auto_workflow` 与 `venus_tr_impl_workflow` 的 1.2.1.5（多项目 CodeGraph 扫描）SHALL 由「每个待查项目派发一个子代理」改为「**派发单个子代理，在其内部串行扫描全部待查项目**」。原实现为顺序派发（无并行收益却有 N 次子代理冷启动），单代理化消除 N−1 次冷启动且不降低扫描覆盖。

**降级 MUST 保持项目粒度**：某项目 CodeGraph 未初始化 / 扫描失败 / 超时（>120s）时，仅该项目降级为 Glob/Grep 并记 WARN，其余项目照常；一个项目失败 MUST NOT 影响其他项目。待查项目路径与当前项目相同时 SHALL 跳过扫描。

#### Scenario: 单子代理串行扫描全部项目

- **WHEN** 1.2.1.5 检出 2 个及以上待查项目且这些项目均已初始化 CodeGraph
- **THEN** 技能派发**一个**子代理，该子代理在内部串行扫描全部项目（使用 `projectPath` 参数），MUST NOT 每项目各派发一个子代理

#### Scenario: 单项目降级不影响其他项目

- **WHEN** 某个待查项目的 CodeGraph 未初始化，或其扫描失败 / 超时（>120s）
- **THEN** 仅该项目降级为 Glob/Grep 并记 WARN，其余项目仍由同一子代理完成扫描；整体流程 MUST NOT 被阻断

#### Scenario: 子代理不可用时的降级

- **WHEN** 运行时无法派发子代理（工具不可用或派发失败）
- **THEN** 技能对全部待查项目降级为 Glob/Grep 扫描并记 WARN，扫描结论仍合并写入 exploration.md

#### Scenario: 待查项目与当前项目相同

- **WHEN** 检出的项目路径与当前项目相同
- **THEN** 技能跳过该项目的子代理扫描（1.2.1 基线扫描已覆盖）

### Requirement: tr-impl-debug 流程级探查摘要共享

`venus_tr_impl_debug` SHALL 在 Phase 2（排查定位）维护**流程级探查摘要** `investigation-digest.md`，落于流程级临时工作区 `.openspec-tmp/debug-<keyword>/`，用于跨调试循环轮次复用探查结论，避免重跑同一代码区域的 CodeGraph 查询。

`<keyword>` SHALL 为该次调试主题的 **kebab-case 关键词**（与 `openspec/explorations/<keyword>-explore-<sequence>.md` 的关键词同源同规则），MUST NOT 直接使用 bug 描述原文（避免空格与非法字符）。

- **先读后查**：Phase 2 起始 SHALL 先判定摘要是否存在；存在则读取并复用其中命中范围的结论，**同范围已覆盖的 2.2.1–2.2.3 查询 MUST NOT 重复发起**，仅执行增量查询；不存在则初始化空摘要。
- **增量写入**：2.2.1–2.2.4 每步结论 SHALL **增量写入**摘要，与既有「实时写诊断记录」并行（**不替代**诊断记录）。
- **失效规则**：某 bug 的修复改动代码后，摘要中**受影响范围**的结论 SHALL 标记为失效（`> 已失效（由 <bug 标识> 修复改动代码）`）并在下次进入 Phase 2 时重新查询；MUST NOT 复用已失效结论。
- **循环回边**：调试循环（4.3）进入下一个 bug 时 SHALL 同样先读摘要、只做增量查询。
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
