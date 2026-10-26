# Tasks: improve-tr-impl-debug-orchestration

<!-- 任务类型标签：[代码] 实现代码 / [DB脚本] 数据库脚本 / [使用说明] 补充文档（默认产出至 attachments/） -->

## 1. 探索与提案制品（已完成）

- [x] 1.1 [使用说明] 探索产物与流程基准：`## 提示词基线`（门 0 校验结论 + 优化后提示词 + 3 项门内裁决）、`## 功能流程图`（16 节点流程基准：流程 1 排查深度分级链路 N1–N10、流程 2 需求文档更新分支链路 N11–N16）、Codebase Findings、D1–D9 架构决策、边界场景、Pending；经 1.5.5 流程最终确认门确认
  - 产出：`openspec/changes/improve-tr-impl-debug-orchestration/exploration.md`（源文件 `openspec/explorations/debug-skill-optimize-explore-001.md` 保留）
  - 验证：文件含全部 12 个必备段落；16 节点均通过证据追溯校验（既有节点 `文件:行`、新增节点 `[新建]` + 预期产物）
- [x] 1.2 [使用说明] 提案制品：proposal.md（Why / What Changes / Capabilities / Impact）、design.md（Context / Goals-NonGoals / D1–D9 / Risks）、本 tasks.md
  - 产出：`openspec/changes/improve-tr-impl-debug-orchestration/` 下三文件
  - 验证：proposal 含 4 个必备段；design 含 D1–D9 决策与风险表；tasks 格式为 `- [ ] N.M` 可勾选

## 2. Phase 2 排查深度分级（核心改动）

- [x] 2.1 [代码] `venus_tr_impl_debug` Phase 2 新增 **`2.2.3.5` 排查深度分级** 节，置于 2.2.3 之后、2.2.4 之前：声明三条客观信号与阈值（(a) `codegraph_impact` depth ≤ 2 受影响符号数 ≥ 5 或受影响文件数 ≥ 3；(b) 跨 ≥ 2 个模块/目录；(c) 2.2.2 未能一步定位单一高置信根因；任一命中即深度路径）、两条路径（轻量 A 止步 / 深度 B 进入 2.2.4）、信号取值 MUST 可追溯实测结果、阈值边界取保守（深度路径） [N5]
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：正文含 `2.2.3.5` 编号与三条信号（含具体数值阈值）；含"信号 MUST 可追溯、MUST NOT 编造"约束；含阈值边界取深度路径规则
- [x] 2.2 [代码] **扩展 2.2.4 触发条件**为「分级为深度路径 **∨** 轻量路径未定位单一高置信根因」；2.2.4 的**内容与编号保持不变**；正文明文"升级兜底是**触发条件**，MUST NOT 表现为独立步骤或新增编号" [N6][N7][N8]
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：2.2.4 编号未变、6 维分析内容未删；触发条件为"或"关系；正文含"不是独立步骤"明文（防误建僵尸步骤）
  - **具体落点（深度复查实测）**：`:171` 的 Trigger 句需加入 2.2.3.5 的分级结论（现文为 "the regular CodeGraph queries above (2.2.1–2.2.3) cannot locate a single high-confidence root cause ... When a high-confidence root cause is already located, SKIP this section"——须改为「深度信号 ∨ 未定位根因」且保留"已定位根因仍可能因分级走深度路径"）
  - **范围式引用核对（深度复查实测）**：`:143` 与 `:145` 含范围引用 `codegraph_* tools (2.2.1–2.2.4)`——插入 `2.2.3.5` 后该区间**语义仍有效**（区间包含新步骤），故**无需改写**；实现时 MUST 复核确认，MUST NOT 盲目改写成 `2.2.1–2.2.3.5–2.2.4` 之类破坏可读性的写法
- [x] 2.3 [代码] 分级**信号降级**规则：`codegraph_status` 确认不可用时分级仍生效——信号 (a) 降级为 Grep 代理指标（受影响文件数阈值），(b)(c) 照常判定；诊断记录标注「信号降级」；MUST NOT 因降级跳过分级 [N5]
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：正文含降级分支与"分级仍生效"明文；与既有 2.2.0 降级段语义连续（不重复定义降级本身）
- [x] 2.4 [代码] 核对 2.2.0 / 2.2.1 / 2.2.2 / 2.2.3 **既有编号与语义零改动**（十进制插入不重排惯例） [N1][N2][N3][N4]
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：四节编号与标题均未变；2.2.0 仍为强制首动作；无遗漏的引用性改动
- [x] 2.5 [代码] 明文**分级与 2.5 解耦**：分级结果只影响 2.2.4 是否执行，2.5 缺陷链路图与流程最终确认门对两条路径均强制产出；轻量路径 MUST NOT 豁免 [N6][N7][N9][N10]
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：2.5 与 Guardrails 段均含"与分级解耦、维持强制"表述；`🟠根因` 标记口径未被改动（`test/templates.test.ts:116` 断言）
- [x] 2.6 [代码] 同步 1.2 结构化格式与诊断记录段：分级判定结果（信号取值 + 判定路径 + 是否降级）须落诊记录，供 Phase 6 持久化到变更 exploration.md [N5]
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：Phase 6 §6.2 持久化清单含分级判定结果；诊断记录字段与分级节声明的字段一致

## 3. Phase 7.3 需求文档分支

- [x] 3.1 [代码] Phase 7.3 在深度复查（`venus_tr_impl_review_proposal`）之后、生成之前插入**需求文档存在性判定**：范围仅 `openspec/changes/<change-name>/需求文档.md`（`path.join()` 构造）；目录不可读时记 WARN 并按"不存在"处理 [N13]
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：判定位置正确（在复查后、生成前）；路径用 `path.join()`；含 IO 异常分支
- [x] 3.2 [代码] 实现**已存在 → 就地增量对齐更新**分支：`## 基本信息`（需求编号/需求名称/交付时间，含占位符状态）与 `## 八、评审记录` 为**人工域 MUST NOT 覆盖**；`一~七` 章节按 Phase 6 同步后的制品重新派生；MUST NOT 调 `venus_tr_docs_requirement_doc`（规避其"目标已存在则静默覆盖"规则）；格式破损时补建缺失章节 + WARN；MUST NOT 删除章节 [N15]
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：正文含人工域白名单（明确到章节名）；含"不调 skill"明文；含补建章节 + WARN 规则；含"不丢章节"约束
- [x] 3.3 [代码] 保留**不存在 → 调 `venus_tr_docs_requirement_doc` skill 非交互生成**分支（既有行为不变，含失败 WARN + 继续） [N14]
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：既有生成调用与降级语义未被破坏；非交互模式与占位符要求保留
- [x] 3.4 [代码] 保留**输出文档路径提示**收尾（两条分支共用） [N16]
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：两条分支均以路径提示收尾
- [x] 3.5 [代码] 核对 Phase 7.1 验证门（D1–D9 评分）与 7.2 失败自动修复循环**零改动**（含"无跳过路径"约束） [N11][N12]
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：7.1 / 7.2 文本未变；FAIL 时不生成需求文档的约束保留

## 4. 手写 command 正文同步

- [x] 4.1 [代码] `getTrImplDebugCommandTemplate().content` 同步 Phase 2 分级压缩描述：`2.2.3.5` 三条信号 + 两条路径 + 2.2.4 触发条件"或"关系 + 兜底非独立步骤 [N5][N6][N7][N8]
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：command 正文含分级步骤编号与信号；语义与 skill 正文一致（压缩允许删减，MUST NOT 冲突）
- [x] 4.2 [代码] command 正文同步 Phase 7.3 分支压缩描述：存在性判定 + 人工域白名单 + 就地对齐 + 不存在时调 skill + 失败 WARN 继续 [N13][N14][N15][N16]
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：command 正文含两条分支与人工域保护；语义与 skill 正文一致
- [x] 4.3 [代码] Guardrails 段增补（skill 版）：分级信号可追溯（不得编造）、阈值边界取深度、与 2.5 解耦、人工域 MUST NOT 覆盖、MUST NOT 表现为新增兜底步骤；command 版 Guardrails 同步精简版
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：两版 Guardrails 均含上述硬约束；措辞与 spec 的 MUST 语句对齐

## 5. 规格与术语同步（已完成）

- [x] 5.1 [使用说明] delta spec：`tr-workflow-suite-skills` 两条 MODIFIED 需求（「tr-impl-debug 强制复现与根因确认门」含分级节 + 触发条件扩展 + 5 条新增 Scenario；「tr-impl-debug 关联变更判定与调试循环」含 Phase 7.3 分支 + 5 条新增 Scenario）
  - 产出：`openspec/changes/improve-tr-impl-debug-orchestration/specs/tr-workflow-suite-skills/spec.md`
  - 验证：MODIFIED 含完整更新内容；每条需求至少一个 `#### Scenario`（WHEN/THEN 格式）
- [x] 5.2 [使用说明] 术语同步：`openspec/CONTEXT.md` 新增 6 条术语（排查深度分级 / 轻量路径 / 深度路径 / 升级兜底 / 人工域 / 就地增量对齐），含 `_Avoid_` 划界
  - 产出：`openspec/CONTEXT.md`
  - 验证：6 条术语均可检索；与既有「缺陷链路」「功能流程图」术语无冲突

## 6. 验证与交付

- [x] 6.1 [代码] 重建生成产物快照：`pnpm build && pnpm generate:skills`（改模板后必须执行，否则 `test/skills-parity.test.ts` 失败）
  - 文件：`skills/**/SKILL.md`、`skills/**/commands/*.md`
  - 验证：命令成功；快照中 debug 技能正文含 2.2.3.5 节与 7.3 分支
- [x] 6.2 [代码] 全量测试：`pnpm test`（含 `skills-parity` / `allowed-tools` / `templates` / `commands` / `profiles`）
  - 文件：`test/*.test.ts`
  - 验证：全绿；本方案未新增命令，`allowed-tools.test.ts` 无需改白名单；技能总数 27 断言不变
- [x] 6.3 [代码] 核对 `test/templates.test.ts`（`:116` `scenarioMark: '🟠根因'`、`:134` 读 instructions）与 `test/allowed-tools.test.ts`（`:56` / `:68`）断言是否受正文增补影响，必要时按新行为更新断言（MUST NOT 削弱既有断言强度）
  - 文件：`test/templates.test.ts`、`test/allowed-tools.test.ts`
  - 验证：断言与正文实际内容一致；无被删除的既有断言
- [x] 6.4 [代码] 版本号与变更日志：`package.json` 版本按守则 8 递增（**minor**，功能行为变更）；`CHANGELOG.md` 将 `[Unreleased]` 归档为新版本小节（`### Changed` 记录两处编排逻辑变更 + 已知落差），保留空的 `## [Unreleased]`，同步底部链接引用定义；`README.md` 若含 `venus --version` 输出示例则同步
  - 文件：`package.json`、`CHANGELOG.md`、`README.md`
  - 验证：三处版本号一致；CHANGELOG 小节日期正确、链接定义完整
- [x] 6.5 [使用说明] 记录**已知落差**至 CHANGELOG 或变更注释：另三处同构"PASS 后生成需求文档"逻辑（`tr-impl-workflow.ts:1382,2191`、`tr-impl-auto-workflow.ts:510,591,648`、`tr-impl-genfull.ts:193`）未同步，仍会覆盖人工内容——建议后续单独变更处理
  - 产出：`CHANGELOG.md` 变更说明或 `openspec/changes/improve-tr-impl-debug-orchestration/` 下注记
  - 验证：落差被显式记录且不表现为疏漏；不含 TODO 标记（守则：不确定内容立即解决，不推迟）
- [x] 6.6 [代码] **刷新 `.claude/` dogfood 产物**（深度复查发现的遗漏项）：`.claude/` 已入库（65 文件），AGENTS.md 守则 8 仅豁免「版本号单独递增」场景——本次为**内容变更**，故 dogfood 产物须同步刷新（`venus update`，必要时 `--force`：手改保护在 `generatedBy` 版本未变时判否）
  - 文件：`.claude/skills/venus_tr_impl_debug/SKILL.md`、`.claude/commands/venus/tr-impl-debug.md`
  - 验证：dogfood 版 skill 与指令含 2.2.3.5 节与 Phase 7.3 分支；与 `skills/` 快照、模板三者一致
  - **注意**：`.claude/` 无测试硬断言（`test/commands.test.ts` 用临时目录），属**规约一致性**要求而非测试拦截项
