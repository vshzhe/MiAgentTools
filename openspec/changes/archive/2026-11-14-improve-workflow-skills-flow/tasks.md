# Tasks: improve-workflow-skills-flow

<!-- 流程基准节点 id（N1-N9 / H1-H4 / N2A）与 exploration.md §功能流程图 一一对应；MUST NOT 静默补节点 -->
<!-- 测试任务依赖其对应实现任务：6.2-6.5 依赖 2.1-5.1 完成；6.10 依赖全部实现任务完成 -->

## 1. spec-apply 测试口径收紧

- [x] 1.1 [代码] Step 8.11 降级口径收紧（iagent_test 不可用：WARN 继续 → strict 阻断并报告，记录「未发生内联技能调用」，MUST NOT 表述为「已测试」）[N3]
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - 验证：生成快照后正文检索不存在「不可用 → WARN 继续」静默路径表述
  - Spec Ref：workflow-implementation-chain / 实现后测试调用强制子阶段
  - Scenario Ref：iagent_test 不可用时 strict 阻断

- [x] 1.2 [代码] Step 8.11 显式 degraded 口径（testGate.autoGenerate=false：留痕 + WARN「自动补测已由项目配置关闭」，不阻断，MUST NOT 表述为「已测试」）[N3]
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - 验证：同上正文检索 degraded 二分表述存在
  - Spec Ref：workflow-implementation-chain / 实现后测试调用强制子阶段
  - Scenario Ref：项目配置关闭自动补测时显式 degraded

## 2. auto-workflow 模板

- [x] 2.1 [代码] §4.3 测试口径收紧：自动单测补齐为显式强制子阶段；iagent_test 不可用 strict 阻断（替代「WARN + 记录」）；配置关闭显式 degraded；MUST NOT 表述为「已测试」[N3]
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 验证：与 spec-apply Step 8.11 口径逐句一致
  - Spec Ref：workflow-implementation-chain / 实现后测试调用强制子阶段
  - Scenario Ref：有行为改动文件时强制调用 iagent-test

- [x] 2.2 [代码] §4.4 之后新增实现后 review 环节段：实现验证桥通过后主 agent 内联调用 iagent_review；报告落盘 `.openspec-tmp/pipeline-<change>/review-report.md`（summary 行判定）；P0/P1 回实现修复循环（共用 ≤3 预算）；P2 记录不阻断；无代码改动 not-applicable 留痕直通；不可用 strict 阻断 [N6]
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 验证：生成快照后段落存在且含全部四类降级语义
  - Spec Ref：workflow-implementation-chain / 实现后 review 环节
  - Scenario Ref：验证桥通过后执行代码审查

- [x] 2.3 [代码] Phase 5 新增归档确认门段（⛔ GATE）：呈现实现摘要 + 三类证据 + 测试结果 + review 结论；确认 → 执行归档；拒绝/含糊 → 返回实现阶段不归档，不提供跳过归档选项；中断保持暂停；语义对齐 workflow 5.1 蓝本（workflow.ts:383-389）[N7]
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 文件：`src/core/templates/workflows/workflow.ts`
  - 验证：门段四出口（确认/拒绝/含糊/中断）齐备且拒绝出口与 5.1 一致
  - Spec Ref：workflow-implementation-chain / auto-workflow 归档确认门
  - Scenario Ref：用户确认后执行归档

- [x] 2.4 [代码] §5.1 归档前置证据从三类扩为「三类证据 + review 结论」：review-report.md summary ∈ {pass, not-applicable} 放行，fail/缺失阻断（P0/P1 未收束不进归档门）[N7]
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 验证：证据判定表述与设计 D2 一致
  - Spec Ref：workflow-implementation-chain / 实现后 review 环节
  - Scenario Ref：P0 或 P1 未收束时不进入归档门

- [x] 2.5 [代码] skillDelegation 清单追加 review 委派条目 + Guardrails 同步（「实现完成后自动归档」条目改为含归档确认门语义；「自动单测补齐」条目同步降级二分）[N6]
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 验证：生成快照 allowedTools 含 review 委派条目且无通配
  - Spec Ref：workflow-implementation-chain / review 委派白名单同步
  - Scenario Ref：生成快照含 review 委派条目

- [x] 2.6 [代码] description 微调：归档门语义如实呈现（「自动归档」→ 含归档前用户确认），与正文一致 [N7]
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 验证：description 与 Phase 5 门段语义一致
  - Spec Ref：workflow-implementation-chain / auto-workflow 归档确认门
  - Scenario Ref：用户确认后执行归档

## 3. workflow 模板

- [x] 3.1 [代码] 4.3 实现验证桥之后、5.1 归档确认门之前新增 review 环节段（内联 iagent_review；报告落盘 review-report.md；P0/P1/P2 分级；not-applicable；不可用 strict 阻断）；既有 5.1 门不动 [N6]
  - 留痕：因 skill-size-budget 行数预算（生成输出 ≤500），§4.4 细则下沉至新 `references/review-protocol.md`（主文件保留骨架 + Read 指引）；验证桥 4.3 与 5.1 门原文未动
  - 文件：`src/core/templates/workflows/workflow.ts`
  - 验证：生成快照后新段落位于 4.3 与 5.1 之间，5.1 原文未变
  - Spec Ref：workflow-implementation-chain / 实现后 review 环节
  - Scenario Ref：P2 问题记录不阻断

- [x] 3.2 [代码] skillDelegation 清单追加 review 委派条目 [N6]
  - 文件：`src/core/templates/workflows/workflow.ts`
  - 验证：生成快照 allowedTools 含 review 委派条目
  - Spec Ref：workflow-implementation-chain / review 委派白名单同步
  - Scenario Ref：生成快照含 review 委派条目

## 4. debug 模板

- [x] 4.1 [代码] 修复后测试调用口径统一（4.2 强制回归测试 / 5.5 范围内测试）：iagent_test 不可用 strict 阻断（仅显式 degraded 降级并透明记录）；MUST NOT 表述为「已测试」[N3]
  - 留痕：核对 debug.ts 既有 4.2 编写动作与 5.5 口径（480/658 行区段）已是「strict 阻断 + 显式 degraded 二分」，与本变更收紧后口径一致 → 零改动
  - 文件：`src/core/templates/workflows/debug.ts`
  - 验证：生成快照后与 spec-apply 口径一致
  - Spec Ref：workflow-implementation-chain / 实现后测试调用强制子阶段
  - Scenario Ref：iagent_test 不可用时 strict 阻断

- [x] 4.2 [代码] Phase 7 验证收束阶段插入实现后 review 环节（验证与深度复查通过后、收束提示之前）：内联 iagent_review + 报告落盘 + 分级 + not-applicable 留痕；维持 7.3 收束不归档现状（不加归档门）[N6]
  - 留痕：7.3 步骤 2 插入实现后 review（压缩单行 + 细则下沉既有 `references/gates-and-rules.md`）；Output 增 Review 行；Guardrails 增条目；7.4 收束不归档现状未动
  - 文件：`src/core/templates/workflows/debug.ts`
  - 验证：生成快照后 review 段位于收束提示之前且未新增归档门
  - Spec Ref：workflow-implementation-chain / 实现后 review 环节
  - Scenario Ref：无代码改动时 not-applicable 留痕直通

- [x] 4.3 [代码] skillDelegation 清单追加 review 委派条目 [N6]
  - 文件：`src/core/templates/workflows/debug.ts`
  - 验证：生成快照 allowedTools 含 review 委派条目
  - Spec Ref：workflow-implementation-chain / review 委派白名单同步
  - Scenario Ref：生成快照含 review 委派条目

## 5. 共享白名单常量

- [x] 5.1 [代码] 核对/补齐 review 委派共享常量：skillDelegation() 已覆盖 review 则零改动并在任务留痕核对结论；否则在 tool-whitelist.ts 补共享条目（禁逐模板手写、禁通配）[N6]
  - 留痕：核对结论 —— `tool-whitelist.ts` 的 `skillDelegation()` 按注册表派生全部 canonical 条目，`Skill(iagent-review)` 无需新增共享常量即已覆盖；三模板清单均经同一函数派生，零改动
  - 文件：`src/core/templates/tool-whitelist.ts`
  - 验证：三个模板经同一常量派生 review 条目
  - Spec Ref：workflow-implementation-chain / review 委派白名单同步
  - Scenario Ref：生成快照含 review 委派条目

## 6. 生成与回归

- [x] 6.1 [代码] `pnpm build && pnpm generate:skills` 重新生成快照（模板改动强制伴随步骤）[N6]
  - 文件：`skills/`
  - 验证：`test/skills-parity.test.ts` 通过
  - Spec Ref：workflow-implementation-chain / review 委派白名单同步
  - Scenario Ref：生成快照含 review 委派条目

- [x] 6.2 [测试][单元][P0] 新增 test/workflow-implementation-chain.test.ts：断言三模板 allowedTools 含 review 委派条目且无 Skill(*) 通配（依赖 2.5 / 3.2 / 4.3 / 5.1 / 6.1）[N6]
  - 文件：`test/workflow-implementation-chain.test.ts`
  - 验证：`pnpm test -- workflow-implementation-chain`
  - Spec Ref：workflow-implementation-chain / review 委派白名单同步
  - Scenario Ref：生成快照含 review 委派条目

- [x] 6.3 [测试][单元][P0] 同上测试文件：断言 auto-workflow 归档确认门段（⛔ GATE 标记、拒绝出口=返回实现阶段、不提供跳过归档选项、证据呈现含 review 结论）（依赖 2.3 / 6.1）[N7]
  - 文件：`test/workflow-implementation-chain.test.ts`
  - 验证：`pnpm test -- workflow-implementation-chain`
  - Spec Ref：workflow-implementation-chain / auto-workflow 归档确认门
  - Scenario Ref：用户拒绝时返回实现阶段
  - Scenario Ref：用户确认后执行归档
  - Scenario Ref：门等待中断时保持暂停

- [x] 6.4 [测试][单元][P1] 同上测试文件：断言测试降级口径收紧（spec-apply Step 8.11 / auto-workflow §4.3 / debug 三处均无「不可用 → WARN 继续」静默路径表述，且含 strict 阻断或显式 degraded 二分）（依赖 1.1 / 1.2 / 2.1 / 4.1 / 6.1）[N3]
  - 文件：`test/workflow-implementation-chain.test.ts`
  - 验证：`pnpm test -- workflow-implementation-chain`
  - Spec Ref：workflow-implementation-chain / 实现后测试调用强制子阶段
  - Scenario Ref：iagent_test 不可用时 strict 阻断
  - Scenario Ref：有行为改动文件时强制调用 iagent-test
  - Scenario Ref：项目配置关闭自动补测时显式 degraded

- [x] 6.5 [测试][单元][P1] 同上测试文件：断言三模板 review 环节段落（iagent_review 调用、review-report.md 落盘、不可用 strict 阻断表述）（依赖 2.2 / 3.1 / 4.2 / 6.1）[N6]
  - 文件：`test/workflow-implementation-chain.test.ts`
  - 验证：`pnpm test -- workflow-implementation-chain`
  - Spec Ref：workflow-implementation-chain / 实现后 review 环节
  - Scenario Ref：iagent_review 不可用时 strict 阻断
  - Scenario Ref：验证桥通过后执行代码审查
  - Scenario Ref：P0 或 P1 未收束时不进入归档门
  - Scenario Ref：无代码改动时 not-applicable 留痕直通

- [x] 6.6 [测试][单元][P2] 评估：无可测文件 not-applicable 放行为既有行为（spec-apply Step 8.11 既有留痕判定），本变更不改动——回归核对表述未被破坏即可，无需新增测试（依据：既有行为保留）[N2A]
  - 留痕：判定结论 —— workflow-implementation-chain.test.ts「6.6-6.7 既有语义回归核对」用例断言 `not-applicable` 与「不测清单留痕」表述保留，全量回归通过
  - 文件：`test/workflow-implementation-chain.test.ts`
  - 验证：回归通过即留痕判定结论
  - Spec Ref：workflow-implementation-chain / 实现后测试调用强制子阶段
  - Scenario Ref：无可测文件时 not-applicable 放行

- [x] 6.7 [测试][单元][P2] 评估：范围内测试失败修复循环（≤3 耗尽暂停）为既有语义（spec-apply Step 9 / debug 5.5 / auto-workflow §4.3），本变更不改动——回归核对即可，无需新增测试（依据：既有行为保留）[N4]
  - 留痕：判定结论 —— 同上用例断言三模板修复预算表述（`maxRetries` 默认 3 / 至多 3 次 / ≤3 次）保留，全量回归通过
  - 文件：`test/workflow-implementation-chain.test.ts`
  - 验证：回归通过即留痕判定结论
  - Spec Ref：workflow-implementation-chain / 范围内测试失败修复循环与暂停
  - Scenario Ref：测试修复预算耗尽时暂停

- [x] 6.8 [测试][单元][P2] 评估：P2 记录不阻断由 2.2 / 3.1 / 4.2 落地文本承载，6.5 的 review 段断言已覆盖分级表述——判定并入 6.5，无需独立测试（依据：同一断言面）[N6]
  - 留痕：判定结论 —— workflow-implementation-chain.test.ts「P2 记录不阻断、无代码改动 not-applicable 直通」用例断言三模板 `P2 问题` 分级表述
  - 文件：`test/workflow-implementation-chain.test.ts`
  - 验证：6.5 通过即留痕判定结论
  - Spec Ref：workflow-implementation-chain / 实现后 review 环节
  - Scenario Ref：P2 问题记录不阻断

- [x] 6.9 [测试][单元][P2] 评估：门等待中断保持暂停为宿主会话确认门通用语义（B-4），模板门段「中断保持暂停」表述由 2.3 落地并被 6.3 断言覆盖——判定并入 6.3，无需独立测试（依据：宿主语义 + 同一断言面）[N7]
  - 留痕：判定结论 —— workflow-implementation-chain.test.ts「含糊回复按拒绝处理，中断保持暂停、resume 重现门」用例断言 `重新呈现本门` 表述
  - 文件：`test/workflow-implementation-chain.test.ts`
  - 验证：6.3 通过即留痕判定结论
  - Spec Ref：workflow-implementation-chain / auto-workflow 归档确认门
  - Scenario Ref：门等待中断时保持暂停

- [x] 6.10 [测试][单元][P1] 全量回归：`pnpm test`（至少 skills-parity / allowed-tools / skill-size-budget / stage-continuation / codegraph-protocol / command-reference-refs）；既有断言随模板扩展同步更新（仅扩展断言，不改测试语义）（依赖全部实现任务）[N6]
  - 留痕：全量 `pnpm test` 74 文件 / 1639 用例全绿；既有断言同步面 —— tool-whitelist-constants / template-consistency / stage-continuation / host-orchestration / test-evidence-gate / allowed-tools / command-reference-refs（本地条件委派表）/ pi-native（8 处）/ render.ts `CONDITIONAL_DELEGATIONS`（运行时表，workflowId 键）
  - 文件：`test/`（既有测试文件按需同步）
  - 验证：`pnpm test` 全绿
  - Spec Ref：workflow-implementation-chain / review 委派白名单同步
  - Scenario Ref：生成快照含 review 委派条目
