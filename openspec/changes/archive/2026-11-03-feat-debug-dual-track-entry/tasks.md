# Tasks: feat-debug-dual-track-entry

<!-- 任务类型标签（并列四类）：
     [代码] 实现代码 / [测试] 测试代码 / [DB脚本] 数据库脚本 / [使用说明] 补充文档（默认产出至 attachments/）
     [测试] 子标注：层级 [单元]/[功能] + 优先级 [P0]/[P1]/[P2]，形如 `- [ ] [测试][单元][P0] 1.2 <任务描述>`
     补充文档类（非 [代码]/[测试]）MUST 含 `产出:` 字段指定输出路径 -->

> 流程基准：`exploration.md` 的「功能流程图」链路 C 已确认（`status: confirmed`，节点 N27–N36，继承主探索 2026-11-03 流程最终确认门）。
> 每个任务标注对应节点 id；MUST NOT 静默新增节点。链路 A（N1–N13 + N37/N38）与链路 B（N14–N26）不在本变更范围。
> 规划边界：本变更只提案，不实现。实施顺序在变更 ②（`improve-delegation-gate-ledger`）之后。

## 1. 双轨入口与复现契约（Phase 1）

- [x] 1.1 [代码] Phase 1 引入复现契约与默认轨道联合判定（U3）：`reproductionStatus`（`reproduced` / `not-reproduced` / `intermittent` / `static-only`）与 `evidenceType`（`failing-test` / `manual-steps` / `log-trace` / `static-proof` / `review-finding`）写入诊断记录；默认轨道由「复现步骤 Repro」维判定与 `reproductionStatus` 联合判定，冲突或无法判定时默认复现优先 [N27] [N28]
  - 文件：`src/core/templates/workflows/debug.ts`（Phase 1 `:203-226`；Startup 提示词门 `:155-178` 衔接句）
  - 验证：正文含四个状态值与五个证据类型原句；含「无法判定时默认复现优先」
  - Spec Ref：workflow-suite-skills / debug 强制复现与根因确认门
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 双轨默认判定取复现优先
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / bug 维度场景检查项可映射到复现与验证

- [x] 1.2 [代码] 证据优先轨道的启用条件与证据门槛：仅无复现条件时启用；`not-reproduced` / `static-only` 须 `文件:行` 或日志 / 测试证据；`intermittent` 须至少一条可重复证据并记录复现条件 [N28]
  - 文件：`src/core/templates/workflows/debug.ts`（Phase 1 新增 `1.3 证据优先轨道` 小节）
  - 验证：正文含「仅在无复现条件时启用」「`文件:行`」「至少一条**可重复**的证据」
  - Spec Ref：workflow-suite-skills / debug 强制复现与根因确认门
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 证据优先轨道允许修复无复现缺陷
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 间歇性缺陷需至少一条可重复证据

- [x] 1.3 [代码] 无证据出口改写：把「无法建立复现时一律报告并停止」改为「无硬证据时只报告候选并停止」（零假设保留），并与 3.5 非缺陷退出区分语义 [N29]
  - 文件：`src/core/templates/workflows/debug.ts`（`:224-226` 强制检查点；Output 段 `:501` 的 `Phase 1: Reproduction` 行）
  - 验证：正文含「只报告候选」「MUST NOT 修改代码」「不凭假设修复」；不再把「不可复现」直接等同于「停止」
  - Spec Ref：workflow-suite-skills / debug 强制复现与根因确认门
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 无法复现时不修复
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 证据不足时只报告候选

- [x] 1.4 [测试][单元][P0] 双轨契约断言：四种复现状态、五种证据类型、默认复现优先、证据门槛、无证据只报告候选 [N28] [N29]
  - 文件：`test/templates.test.ts`（`debug 决策与回归测试职责（4.3）` describe 内的「输入校验与复现闸门」用例改写 + 新增双轨用例）
  - 验证：`pnpm test -- templates`
  - Spec Ref：workflow-suite-skills / debug 强制复现与根因确认门
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 双轨默认判定取复现优先
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 证据优先轨道允许修复无复现缺陷
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 间歇性缺陷需至少一条可重复证据
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 无法复现时不修复
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 证据不足时只报告候选

## 2. 「诊断 + 方案」合并包与阶段顺序（2.4 / Phase 3 / 4.0）

- [x] 2.1 [代码] Phase 3 变更归属判定前移到 2.4 之前，先产出 `changeName` 与 `affectedSymbols` 再进入确认包；回退判定条件写明（多变更候选 / 归档来源追溯 / 范围待定）[N32]
  - 文件：`src/core/templates/workflows/debug.ts`（Phase 3 段 `:310-343` 前移；2.4 段 `:278` 前插入顺序说明）
  - 验证：正文顺序为「3.x 归属 → 2.4 合并包」；含回退条件原句
  - Spec Ref：workflow-suite-skills / debug 强制复现与根因确认门
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 变更归属依赖根因外上下文时退回两次停点

- [x] 2.2 [代码] 2.4 扩为「诊断 + 方案」合并包：包内必备「根因证据 + 缺陷链路图 + 修复方案」；唯一方案给唯一性证据后随包确认，多方案逐项给做法 / 影响 / 建议并一次选定；三出口（确认 / 修改重呈 / 拒绝终止并输出诊断报告）逐条保留 [N31] [N33]
  - 文件：`src/core/templates/workflows/debug.ts`（2.4 `:278-307`）
  - 验证：正文含「诊断 + 方案」「一次确认」「同一确认包」；含 `🔴异常` / `🟠根因` 标记列与节点列集（节点 / 操作 / 证据位置 / 标记）
  - Spec Ref：workflow-suite-skills / debug 强制复现与根因确认门
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 诊断与方案单次确认
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 多候选根因时停止等待选择
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 缺陷链路图只含异常与根因节点
  - Spec Ref：workflow-suite-skills / debug 修复方案确认与回归测试职责
  - Scenario Ref：workflow-suite-skills / debug 修复方案确认与回归测试职责 / 高置信根因、链路与方案一次确认
  - Scenario Ref：workflow-suite-skills / debug 修复方案确认与回归测试职责 / 多候选根因先选择再确认链路与方案
  - Scenario Ref：workflow-suite-skills / debug 修复方案确认与回归测试职责 / 诊断确认包被拒绝

- [x] 2.3 [代码] 4.0 降级为回退路径条件门：合并包已含方案时不再停；仅回退路径且多方案时阻塞；唯一方案直通与数据库 / schema 独立确认保留 [N33]
  - 文件：`src/core/templates/workflows/debug.ts`（4.0 `:350-356`）
  - 验证：正文含「回退路径」条件描述与「仅存在多个可行方案时触发」；保留「唯一方案直通规则 MUST NOT 绕过该确认」
  - Spec Ref：workflow-suite-skills / debug 强制复现与根因确认门
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 变更归属依赖根因外上下文时退回两次停点
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 诊断与方案单次确认
  - Spec Ref：workflow-suite-skills / debug 修复方案确认与回归测试职责
  - Scenario Ref：workflow-suite-skills / debug 修复方案确认与回归测试职责 / 多个可行修复方案须等待选择
  - Scenario Ref：workflow-suite-skills / debug 修复方案确认与回归测试职责 / 唯一方案凭证据直通
  - Scenario Ref：workflow-suite-skills / debug 修复方案确认与回归测试职责 / 数据库/schema 确认仍保留

- [x] 2.4 [测试][单元][P0] 合并包与顺序断言：单包一次确认、Phase 3 前移、回退两次停点、4.0 仅多方案触发、三出口保留 [N31] [N32] [N33]
  - 文件：`test/templates.test.ts`（「诊断确认包合并根因与链路并只确认一次」「多候选根因先选根因再确认链路」「多方案阻塞、唯一证据方案直通」三个用例改写）
  - 验证：`pnpm test -- templates`
  - Spec Ref：workflow-suite-skills / debug 强制复现与根因确认门
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 诊断与方案单次确认
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 多候选根因时停止等待选择
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 变更归属依赖根因外上下文时退回两次停点

## 3. 自造门删除（概览 ↔ 正文落差）

- [x] 3.1 [代码] 概览第 5 条（`debug.ts:136`）的「每次修复后询问」降级为非阻塞提示，并在正文 Phase 4 收束与 Guardrails 显式声明「不构成确认门、MUST NOT 作为停点」 [N35]
  - 文件：`src/core/templates/workflows/debug.ts`（`:136`、Guardrails `:527-557`）
  - 验证：正文含「非阻塞提示」与「不构成确认门」；概览不再出现「询问用户是否还有相关 bug」的停点式表述
  - Spec Ref：workflow-suite-skills / debug 强制复现与根因确认门
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 概览不得声明未落地的确认门

- [x] 3.2 [测试][单元][P1] 自造门回归断言：概览为非阻塞表述、正文无该停点、Guardrails 含禁止声明白名单外确认门的句子 [N35]
  - 文件：`test/templates.test.ts`（新增 debug 概览与 Guardrails 用例）
  - 验证：`pnpm test -- templates`
  - Spec Ref：workflow-suite-skills / debug 强制复现与根因确认门
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 概览不得声明未落地的确认门

- [x] 3.3 [代码] Guardrails 条目与双轨 / 合并包语义同步（**原清单遗漏**，逐条改写，避免正文与护栏互斥）：`:535`「先复现：没有确认的复现就不修复」→ 双轨口径（复现优先轨道用复现作判据；证据优先轨道用 `文件:行` / 日志 / 测试硬证据作判据；无任一证据 → 只报告候选）；`:544`「多方案必须确认…4.0 的修复方案确认门 MUST 阻塞」→ 改为「方案在 2.4 合并包内一次确认；仅回退路径且多方案时 4.0 阻塞」；`:545`「唯一方案需证据…直通」→ 明确其生效位置为 2.4 合并包（唯一性证据随包呈现） [N28] [N31] [N33]
  - 文件：`src/core/templates/workflows/debug.ts`（Guardrails `:527-557`，命中行 `:535` / `:544` / `:545`）
  - 验证：Guardrails 不再含「没有确认的复现…就不修复」的无条件表述与「4.0…MUST 阻塞」的无条件表述；`:543`（零猜测）、`:546-557`（归档只读 / 回归测试 / 循环出口等）MUST NOT 被改动
  - Spec Ref：workflow-suite-skills / debug 强制复现与根因确认门
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 证据优先轨道允许修复无复现缺陷
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 诊断与方案单次确认
  - Spec Ref：workflow-suite-skills / debug 修复方案确认与回归测试职责
  - Scenario Ref：workflow-suite-skills / debug 修复方案确认与回归测试职责 / 多个可行修复方案须等待选择

## 4. 两轨共用的排查口径与回归测试

- [x] 4.1 [代码] 口径对齐：2.2.3.5 分级、2.2.4 触发条件与「与缺陷链路图解耦」段统一引用 2.4（正文当前已 0 处 `2.5`，本任务把它作为回归锁固定，不引入新表述），并声明分级与排查在两轨下同等生效 [N30]
  - 文件：`src/core/templates/workflows/debug.ts`（2.2.3.5 `:55-82`、2.2.4 `:84-105`）、`references/investigation-protocol.md`（`INVESTIGATION_PROTOCOL_FULL` `:18-117`）
  - 验证：`grep -n "2\.5" src/core/templates/workflows/debug.ts` 为 0 命中（实测当前已 0 命中，本任务把 `2.4` 口径作为**回归锁**固定；正文自始无 2.5 章节，与 design 现状事实一致）；分级段含「两条轨道均同等生效」
  - Spec Ref：workflow-suite-skills / debug 强制复现与根因确认门
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 大范围 bug 一步定位根因仍走深度路径
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 轻量路径未定位根因时升级兜底
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 分级信号必须可追溯
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / CodeGraph 不可用时分级仍生效
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 阈值边界取深度路径
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 轻量路径仍强制产出缺陷链路图

- [x] 4.2 [代码] 4.2 回归测试口径扩展：证据优先轨道的回归测试为 characterization test，仍须修复前 FAIL / 修复后 PASS 且覆盖异常 + 根因节点；无法建立可执行断言时回到「只报告候选」 [N34]
  - 文件：`src/core/templates/workflows/debug.ts`（4.2 `:377-393`）、Guardrails（回归测试相关条目）
  - 验证：正文含 `characterization test` 与「无法建立可执行断言」
  - Spec Ref：workflow-suite-skills / debug 强制复现与根因确认门
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 证据优先轨道的回归测试为 characterization test
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 修复与回归测试按异常与根因节点验证
  - Spec Ref：workflow-suite-skills / debug 修复方案确认与回归测试职责
  - Scenario Ref：workflow-suite-skills / debug 修复方案确认与回归测试职责 / 回归测试委派并由 debug 验收
  - Scenario Ref：workflow-suite-skills / debug 修复方案确认与回归测试职责 / Phase 1 内联测试不替代回归测试

- [x] 4.3 [测试][单元][P1] 排查与测试口径回归：分级解耦、两轨共用分级、characterization test、节点覆盖、提示词门与轨道衔接 [N30] [N34]
  - 文件：`test/templates.test.ts`（分级与回归测试用例）、`test/spec-workflow-contract.test.ts`（如存在 debug 语义断言则同步）
  - 验证：`pnpm test -- templates spec-workflow-contract`
  - Spec Ref：workflow-suite-skills / debug 强制复现与根因确认门
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 缺陷链路图只含异常与根因节点
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 修复与回归测试按异常与根因节点验证
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 证据优先轨道的回归测试为 characterization test
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / bug 描述含糊时先优化再复现
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 轻量路径仍强制产出缺陷链路图
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / CodeGraph 不可用时分级仍生效
  - Spec Ref：workflow-suite-skills / debug 修复方案确认与回归测试职责
  - Scenario Ref：workflow-suite-skills / debug 修复方案确认与回归测试职责 / strict 缺委派能力不降级自写

## 5. 规范同步（U9）

- [x] 5.1 [代码] 规范对齐核对：delta 的 MODIFIED Requirement 名与主规范 `openspec/specs/workflow-suite-skills/spec.md:35` 逐字一致；场景「无法复现时不修复」（`:56-59`）保留名称并收紧 `WHEN`；既有 12 条场景随包重发不丢失；`:84`/`:106-109` 的「2.5」口径统一为 2.4 [N28] [N29] [N31] [N33]
  - 文件：`openspec/changes/feat-debug-dual-track-entry/specs/workflow-suite-skills/spec.md`
  - 验证：逐条比对主规范 Requirement 名与 delta 名；`grep -c "#### Scenario:"` 的 delta 数 ≥ 主规范原数（12 条 + 新增 8 条）
  - Spec Ref：workflow-suite-skills / debug 强制复现与根因确认门
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 无法复现时不修复
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 缺陷链路图只含异常与根因节点

- [x] 5.2 [代码] `host-orchestration` 规范对齐：MODIFY「debug host protocol 拆分 fix 与 verify-close」，`investigate.handoff` 增补 `fixDecision`，写入「合并确认面不改变 5 类白名单 / 锚点集合 / 每阶段 1 个阻塞门」；既有 7 条场景随包重发（其中「多方案门阻止 fix 阶段推进」改写为「回退路径下多方案仍阻塞 fix」），另新增 2 条场景 [N31] [N33]
  - 文件：`openspec/changes/feat-debug-dual-track-entry/specs/host-orchestration/spec.md`
  - 验证：Requirement 名与主规范 `openspec/specs/host-orchestration/spec.md:244` 逐字一致；场景数 ≥ 7
  - Spec Ref：host-orchestration / debug host protocol 拆分 fix 与 verify-close
  - Scenario Ref：host-orchestration / debug host protocol 拆分 fix 与 verify-close / investigate 交付 fix 所需输入
  - Scenario Ref：host-orchestration / debug host protocol 拆分 fix 与 verify-close / 合并确认面不改变门白名单与阶段门预算

- [x] 5.3 [代码] `debug 修复方案确认与回归测试职责` 规范对齐：MODIFY 该 Requirement（主规范 `:736`）—— 方案评估前移到 2.4 合并包内、回退路径改为 4.0 仅多方案触发、回归测试口径补 characterization test；既有 9 条场景随包重发（「高置信根因与链路一次确认」扩为含方案，「多候选根因先选择再确认链路」扩为含方案，「多个可行修复方案须等待选择」补「只确认一次」） [N31] [N33] [N34]
  - 文件：`openspec/changes/feat-debug-dual-track-entry/specs/workflow-suite-skills/spec.md`
  - 验证：Requirement 名与主规范 `:736` 逐字一致；该 Requirement 的场景数 ≥ 9
  - Spec Ref：workflow-suite-skills / debug 修复方案确认与回归测试职责
  - Scenario Ref：workflow-suite-skills / debug 修复方案确认与回归测试职责 / 高置信根因、链路与方案一次确认
  - Scenario Ref：workflow-suite-skills / debug 修复方案确认与回归测试职责 / 多个可行修复方案须等待选择
  - Scenario Ref：workflow-suite-skills / debug 修复方案确认与回归测试职责 / strict 缺委派能力不降级自写

- [x] 5.4 [测试][单元][P2] 规范可合并性验证：`iagent spec validate feat-debug-dual-track-entry` 0 诊断；MODIFIED 需求名可在主规范定位（无孤儿需求），场景名无重复 [N28] [N29] [N31] [N33]
  - 文件：`openspec/changes/feat-debug-dual-track-entry/specs/**/*.md`
  - 验证：`node bin/iagent.js spec validate feat-debug-dual-track-entry --json` → `valid: true`、`diagnostics: []`
  - Spec Ref：workflow-suite-skills / debug 强制复现与根因确认门
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 无法复现时不修复
  - Spec Ref：host-orchestration / debug host protocol 拆分 fix 与 verify-close
  - Scenario Ref：host-orchestration / debug host protocol 拆分 fix 与 verify-close / debug 阶段顺序与单一技能保持

## 6. 协议声明与调用方同步

### Caller Updates

- [x] 6.1 [代码] `DEBUG_INVESTIGATE.handoff` 追加 `fixDecision`（保留既有四项、不重排），并在注释记录「合并包在 investigate 内产出修复方案决策」；`DEBUG_FIX` 门声明（`fix-option-confirmation` + `condition: multiple-fix-options`）与 `protocol.ts` 的 `GATE_WHITELIST` / `PHASE_GATE_CATEGORY` **零改动** [N31] [N33]
  - 文件：`src/core/host-orchestration/workflows.ts`（`:127-147`）
  - 验证：`DEBUG_INVESTIGATE.handoff` 为五项且前四项顺序不变；对 `src/core/host-orchestration/protocol.ts` 的**符号级**核对：`GATE_WHITELIST`（`:94-131`）、`GATE_WHITELIST_ANCHORS`（`:134-136`）与 `PHASE_GATE_CATEGORY` 的 diff 为空（注：变更 ② 会修改同文件的 `Receipt` / `validateReceipt`，该改动属预期前置，MUST NOT 被判为本变更失败；因此验证口径为符号级 diff 而非整文件 `git diff` 为空）
  - Spec Ref：host-orchestration / debug host protocol 拆分 fix 与 verify-close
  - Scenario Ref：host-orchestration / debug host protocol 拆分 fix 与 verify-close / investigate 交付 fix 所需输入
  - Scenario Ref：host-orchestration / debug host protocol 拆分 fix 与 verify-close / 合并包使 fix 方案门不再二次阻塞
  - Scenario Ref：host-orchestration / debug host protocol 拆分 fix 与 verify-close / 合并确认面不改变门白名单与阶段门预算

- [x] 6.2 [测试][单元][P0] host-orchestration 断言同步与扩展：阶段顺序与单一技能、`investigate.handoff` 含 `fixDecision`、合并包使 `fix` 门不适用、回退路径多方案仍阻塞、白名单 5 类与锚点映射不变、`auditGateWhitelistAlignment()` 为空、条件门默认行为不变、`verify-close` 消费 fix 结果、strict/degraded 不变 [N31] [N33]
  - 文件：`test/host-orchestration.test.ts`（`:306-330`、`:360-390`、`:620-660`）
  - 验证：`pnpm test -- host-orchestration`
  - Spec Ref：host-orchestration / debug host protocol 拆分 fix 与 verify-close
  - Scenario Ref：host-orchestration / debug host protocol 拆分 fix 与 verify-close / debug 阶段顺序与单一技能保持
  - Scenario Ref：host-orchestration / debug host protocol 拆分 fix 与 verify-close / 合并包使 fix 方案门不再二次阻塞
  - Scenario Ref：host-orchestration / debug host protocol 拆分 fix 与 verify-close / 回退路径下多方案仍阻塞 fix
  - Scenario Ref：host-orchestration / debug host protocol 拆分 fix 与 verify-close / 合并确认面不改变门白名单与阶段门预算
  - Scenario Ref：host-orchestration / debug host protocol 拆分 fix 与 verify-close / 唯一证据充分方案不被静态门阻塞
  - Scenario Ref：host-orchestration / debug host protocol 拆分 fix 与 verify-close / 条件门适用性与旧门默认行为
  - Scenario Ref：host-orchestration / debug host protocol 拆分 fix 与 verify-close / verify-close 消费 fix 结果
  - Scenario Ref：host-orchestration / debug host protocol 拆分 fix 与 verify-close / 缺少宿主委派能力时遵循 strict/degraded

- [x] 6.3 [代码] 重建产物快照：`pnpm build && pnpm generate:skills`（模板单一源，MUST NOT 手工编辑 `skills/`） [N28] [N31] [N34] [N35]
  - 文件：`skills/iagent-debug/SKILL.md`、`skills/iagent-debug/references/*.md`、对应指令版产物
  - 验证：`pnpm test -- skills-parity`
  - Spec Ref：workflow-suite-skills / debug 强制复现与根因确认门
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 证据优先轨道允许修复无复现缺陷

- [x] 6.4 [测试][单元][P0] `test/templates.test.ts` 既有断言同步：改写与双轨互斥的旧断言（「在修改任何代码之前必须复现该 bug」「MUST NOT 在假设下修复一个不可复现的 bug」按新语义重写），保留流程图契约（不得含 `| 异常路径 |`、必须含 `功能流程图` 与 `🟠根因`），新增 characterization test、自造门与 Guardrails 双轨/合并包断言（任务 3.3 的护栏改写须有对应断言） [N28] [N34] [N35]
  - 文件：`test/templates.test.ts`（`:123-169`、`:320-391`）
  - 验证：`pnpm test -- templates template-language`
  - Spec Ref：workflow-suite-skills / debug 强制复现与根因确认门
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 无法复现时不修复
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 概览不得声明未落地的确认门
  - Scenario Ref：workflow-suite-skills / debug 强制复现与根因确认门 / 证据优先轨道的回归测试为 characterization test

## 7. 收尾验证

- [x] 7.1 [测试][功能][P1] 端到端回归：`iagent spec validate` 0 诊断、`pnpm test` 全绿、`skills-parity` 逐字节一致、`template-language` 无英文形残留（`Functional Flowchart` 等禁用短语 0 命中） [N36]
  - 文件：`test/`（全量）
  - 验证：`pnpm lint && pnpm test`
  - Spec Ref：host-orchestration / debug host protocol 拆分 fix 与 verify-close
  - Scenario Ref：host-orchestration / debug host protocol 拆分 fix 与 verify-close / debug 阶段顺序与单一技能保持

- [x] 7.2 [代码] 版本号与变更日志：`node bin/iagent.js version` 只读判定后 `version bump`，随功能提交一并提交 [N36]
  - 文件：`package.json`、`CHANGELOG.md`、`README.md`
  - 验证：判定等级与 `feat` 提交一致（预期 minor）
