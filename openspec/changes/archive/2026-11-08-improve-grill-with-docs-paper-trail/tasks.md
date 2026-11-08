# Tasks: improve-grill-with-docs-paper-trail

<!-- 流程基准：exploration.md 的 ## 功能流程图（N1-N16，已确认）。每个任务标注对应节点 id。 -->

## 1. 探索技能纸迹校验（N10 / N11 / N12）

- [x] 1.1 [代码] 在 1.5.5 流程最终确认门**之前**新增纸迹三项校验：Decisions 非空或显式「无」、术语表非空或显式「无」、ADR 存在或显式「无」 [N10]
  - 文件：`src/core/templates/workflows/spec-explore.ts`（1.5.5 前置）
  - 验证：生成的 `iagent-spec-explore` 正文含三项校验与「显式『无』」处置
  - Spec Ref：workflow-suite-skills / 探索纸迹三项校验与回执声明（paperTrailStatus）
  - Scenario Ref：workflow-suite-skills / 探索纸迹三项校验与回执声明（paperTrailStatus） / 三项齐备或显式「无」

- [x] 1.2 [代码] 把校验结论并入既有流程最终确认门的呈现内容，MUST NOT 新增阻塞门或独立停顿 [N10][N11]
  - 文件：`src/core/templates/workflows/spec-explore.ts`（1.5.5）
  - 验证：正文明确「并入既有门」「MUST NOT 新增阻塞门」；门白名单未变
  - Spec Ref：workflow-suite-skills / 探索纸迹三项校验与回执声明（paperTrailStatus）
  - Scenario Ref：workflow-suite-skills / 探索纸迹三项校验与回执声明（paperTrailStatus） / 纸迹缺失并入流程最终确认门

- [x] 1.3 [代码] 在 1.8 探索回执新增 `paperTrailStatus`（`complete` / `incomplete` / `skipped`）字段与取值约束 [N12]
  - 文件：`src/core/templates/workflows/spec-explore.ts`（1.8）
  - 验证：回执字段清单含 `paperTrailStatus` 且给出三枚举值
  - Spec Ref：workflow-suite-skills / 探索纸迹三项校验与回执声明（paperTrailStatus）
  - Scenario Ref：workflow-suite-skills / 探索纸迹三项校验与回执声明（paperTrailStatus） / 三项齐备或显式「无」

- [x] 1.4 [代码] 实现无探索文件时 `skipped` + WARN、存量探索文件无字段契约时 WARN 降级的兼容路径 [N10]
  - 文件：`src/core/templates/workflows/spec-explore.ts`（1.5.5 / 1.6.5 兼容段）
  - 验证：正文含「无探索文件 → 不执行校验并记 WARN」「存量文件 → 视作无硬约束」
  - Spec Ref：workflow-suite-skills / 探索纸迹三项校验与回执声明（paperTrailStatus）
  - Scenario Ref：workflow-suite-skills / 探索纸迹三项校验与回执声明（paperTrailStatus） / 无探索文件跳过校验

- [x] 1.5 [代码] 用户提前结束时记 `user-shortened` 合法终态，并在流程最终确认门内列出未覆盖层级 [N8][N10]
  - 文件：`src/core/templates/workflows/spec-explore.ts`（1.3.4 / 1.5.5）
  - 验证：正文含 `user-shortened` 与「未覆盖层级显式列出」
  - Spec Ref：workflow-suite-skills / 探索纸迹三项校验与回执声明（paperTrailStatus）
  - Scenario Ref：workflow-suite-skills / 探索纸迹三项校验与回执声明（paperTrailStatus） / 用户提前结束为合法终态

- [x] 1.7 [代码] 探索文件结构新增 `## 硬约束` 段；1.5.5 前把已确认决策中的不可改写片段逐条写入（带 `source: D<n>`），确无时写固定字面量 `无硬约束`，MUST NOT 留空 [N10]
  - 文件：`src/core/templates/workflows/spec-explore.ts`（1.2 结构 / 1.5.5）
  - 验证：正文含 `## 硬约束` 段、`source: D<n>`、固定字面量 `无硬约束`、「MUST NOT 留空」
  - Spec Ref：workflow-suite-skills / 探索硬约束声明
  - Scenario Ref：workflow-suite-skills / 探索硬约束声明 / 确无硬约束时写字面量

- [x] 1.6 [代码] 三项「显式『无』」使用固定字面量 `无决策` / `无新术语` / `无 ADR`（散文式免责不算）；并在 `EXPLORE_PHASE.handoff` 登记 `paperTrailStatus` [N10][N12]
  - 文件：`src/core/templates/workflows/spec-explore.ts`（1.5.5）、`src/core/host-orchestration/workflows.ts:33`
  - 验证：正文含三个字面量；`workflows.ts` 的 `EXPLORE_PHASE.handoff` 字段列表含 `paperTrailStatus`
  - Spec Ref：workflow-suite-skills / 探索纸迹三项校验与回执声明（paperTrailStatus）
  - Scenario Ref：workflow-suite-skills / 探索纸迹三项校验与回执声明（paperTrailStatus） / 三项齐备或显式「无」

## 2. 批量口径消解（N6 / N8）

- [x] 2.1 [代码] 改写 `GRILL_PLAYBOOK_FULL` 1.3.2 的「深度不限」为「收敛深度不限，批量轮数受 ≤2 批规则约束（澄清门不计入流程级门预算）」 [N6]
  - 文件：`src/core/templates/workflows/spec-explore.ts`（`GRILL_PLAYBOOK_FULL` 1.3.2）
  - 验证：正文不再出现无限定的「深度不限」单句；出现「收敛深度不限」「批量轮数受 ≤2 批规则约束」
  - Spec Ref：workflow-suite-skills / grill L1-L5 批量确认（≤2 批）
  - Scenario Ref：workflow-suite-skills / grill L1-L5 批量确认（≤2 批） / 收敛深度不设上限

- [x] 2.2 [代码] 同步 1.3.4 门规则措辞：新增问题在已开启批次内收敛，不得触发第三个确认轮次 [N8]
  - 文件：`src/core/templates/workflows/spec-explore.ts`（`GRILL_PLAYBOOK_FULL` 1.3.4 门规则）
  - 验证：正文含「至多 2 个用户确认轮次」与「新增问题不触发第三轮」
  - Spec Ref：workflow-suite-skills / grill L1-L5 批量确认（≤2 批）
  - Scenario Ref：workflow-suite-skills / grill L1-L5 批量确认（≤2 批） / 收敛深度不设上限

- [x] 2.3 [代码] 同步主规格口径：确认 delta 的 MODIFIED 需求标题与 `openspec/specs/workflow-suite-skills/spec.md` 的 Requirement 标题完全一致（归档时替换命中；实现期不直接编辑主规格） [N6]
  - 文件：`openspec/changes/improve-grill-with-docs-paper-trail/specs/workflow-suite-skills/spec.md`
  - 验证：标题逐字一致；主规格归档合并日志命中 MODIFIED
  - Spec Ref：workflow-suite-skills / grill L1-L5 批量确认（≤2 批）
  - Scenario Ref：workflow-suite-skills / grill L1-L5 批量确认（≤2 批） / 两批确认

- [x] 2.4 [代码] 同步 `test/template-consistency.test.ts:167-180` 的断言口径（保留 `≤ 2 批量轮次` / `批量 1` / `批量 2` / `最低深度 L3`，MUST NOT 删除断言） [N6]
  - 文件：`test/template-consistency.test.ts`
  - 验证：既有四个断言关键字仍在；新增口径断言通过
  - Spec Ref：workflow-suite-skills / grill L1-L5 批量确认（≤2 批）
  - Scenario Ref：workflow-suite-skills / grill L1-L5 批量确认（≤2 批） / 最低深度保持

## 3. debug 纪律补齐（N7 / N9）

- [x] 3.1 [代码] `debug.ts` §2.3 补术语冲突检测：写 CONTEXT.md 前先读、同名定义不一致先指出再裁决 [N7]
  - 文件：`src/core/templates/workflows/debug.ts`（§2.3）
  - 验证：正文含「先读」「同名冲突」「显式裁决」
  - Spec Ref：workflow-suite-skills / debug 排查期 grill 纸迹纪律
  - Scenario Ref：workflow-suite-skills / debug 排查期 grill 纸迹纪律 / 术语冲突检测

- [x] 3.2 [代码] `debug.ts` §2.3 补 ADR 三条件判定（难以逆转 / 脱离上下文意外 / 真实权衡） [N9]
  - 文件：`src/core/templates/workflows/debug.ts`（§2.3）
  - 验证：正文含三条件同时满足才写 ADR、不满足不产出
  - Spec Ref：workflow-suite-skills / debug 排查期 grill 纸迹纪律
  - Scenario Ref：workflow-suite-skills / debug 排查期 grill 纸迹纪律 / ADR 三条件判定

- [x] 3.3 [代码] `debug.ts` §2.3 补边界场景构造：每个已确认根因决策至少 1 个边界场景并写入诊断记录 [N7]
  - 文件：`src/core/templates/workflows/debug.ts`（§2.3）
  - 验证：正文含「≥1 边界场景」「写入诊断记录」
  - Spec Ref：workflow-suite-skills / debug 排查期 grill 纸迹纪律
  - Scenario Ref：workflow-suite-skills / debug 排查期 grill 纸迹纪律 / 边界场景构造

- [x] 3.4 [代码] 尺寸兜底：`skills/iagent-debug/SKILL.md` 当前 499 行（上限 500）；若 3.1-3.3 使主文件超限，则把 §2.3 全文下沉至 `references/grill-discipline.md`，主文件仅保留 `Read references/grill-discipline.md` 指引 [N7][N9]
  - 文件：`src/core/templates/workflows/debug.ts`、`references/grill-discipline.md`
  - 验证：`pnpm build` 后主文件 ≤500 行，`test/skill-size-budget.test.ts` 通过且 references 齐备
  - Spec Ref：workflow-suite-skills / debug 排查期 grill 纸迹纪律
  - Scenario Ref：workflow-suite-skills / debug 排查期 grill 纸迹纪律 / 边界场景构造

## 4. CONTEXT.md 多写入者漂移防护（N7 / N16）

- [x] 4.1 [代码] 统一 `spec-explore` 写入规则措辞：先读 CONTEXT.md、同名冲突显式裁决、MUST NOT 静默追加第二条 [N7]
  - 文件：`src/core/templates/workflows/spec-explore.ts`（1.3.3 / 1.6.5）
  - 验证：正文含「先读」「显式裁决」「MUST NOT 静默追加」
  - Spec Ref：workflow-suite-skills / CONTEXT.md 多写入者漂移防护
  - Scenario Ref：workflow-suite-skills / CONTEXT.md 多写入者漂移防护 / 先读后写

- [x] 4.2 [代码] `debug` 写入规则对齐（先读 + 冲突裁决） [N7]
  - 文件：`src/core/templates/workflows/debug.ts`（§2.3）
  - 验证：正文与 explore 使用同一裁决措辞
  - Spec Ref：workflow-suite-skills / CONTEXT.md 多写入者漂移防护
  - Scenario Ref：workflow-suite-skills / CONTEXT.md 多写入者漂移防护 / 同名冲突显式裁决

- [x] 4.3 [代码] `spec-archive` 4.5 收窄取词口径：只同步变更 `exploration.md` 术语表，禁止从 proposal / design / specs 正文反向抽取 [N16]
  - 文件：`src/core/templates/workflows/spec-archive.ts`（4.5）
  - 验证：正文不再出现「读取 proposal.md 获取术语」「读取 design.md 获取术语」的取词路径
  - Spec Ref：workflow-suite-skills / CONTEXT.md 多写入者漂移防护
  - Scenario Ref：workflow-suite-skills / CONTEXT.md 多写入者漂移防护 / 归档取词口径收窄

- [x] 4.4 [代码] `spec-bulk-archive` a.5 同步同一取词口径与先读后写规则 [N16]
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`（a.5）
  - 验证：与 4.3 同口径；缺失 exploration.md 时 WARN 跳过
  - Spec Ref：workflow-suite-skills / CONTEXT.md 多写入者漂移防护
  - Scenario Ref：workflow-suite-skills / CONTEXT.md 多写入者漂移防护 / 归档取词口径收窄

- [x] 4.6 [代码] 补齐另外两个写入者：`workflow` Phase 2.0 的 CONTEXT.md 同步与 `spec-propose` 0.5 的 CONTEXT.md 检查，均改为「先读 → 同名冲突显式裁决 → 写」，MUST NOT 静默追加（`auto-workflow` 经委派 propose 写入，不单独改） [N13][N14]
  - 文件：`src/core/templates/workflows/workflow.ts`（Phase 2.0）、`spec-propose.ts`（0.5）
  - 验证：两处正文均含「先读」「同名冲突显式裁决」「MUST NOT 静默追加」
  - Spec Ref：workflow-suite-skills / CONTEXT.md 多写入者漂移防护
  - Scenario Ref：workflow-suite-skills / CONTEXT.md 多写入者漂移防护 / 先读后写

- [x] 4.5 [代码] 并行归档单元的 a.5 写入串行化：`读取 → 比对 → 写入` 三步不得与其他并行单元并发写同一 `CONTEXT.md`（同一批次锁或排队） [N16]
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`（a.5）
  - 验证：正文含「串行化」「MUST NOT 并发写同一文件」「丢失更新」
  - Spec Ref：workflow-suite-skills / CONTEXT.md 多写入者漂移防护
  - Scenario Ref：workflow-suite-skills / CONTEXT.md 多写入者漂移防护 / 并行单元写入串行化

## 5. 决策可追溯与硬约束载体（N14 / N15）

- [x] 5.1 [代码] `spec-propose` 生成指南补「Decisions 带稳定 `D<n>`」「spec / design 约束处标 `(D<n>)`」 [N14]
  - 文件：`src/core/templates/workflows/spec-propose.ts`
  - 验证：正文含 `D<n>` 稳定 id 与 `(D<n>)` 标注要求
  - Spec Ref：workflow-suite-skills / 决策可追溯链路（D<n>）
  - Scenario Ref：workflow-suite-skills / 决策可追溯链路（D<n>） / 制品标注来源

- [x] 5.2 [代码] `spec-propose` 5.5 补 handoff `## 硬约束` 并列节：一行一条、逐字保留、每行带 `source: D<n>`、不计入六节 [N15]
  - 文件：`src/core/templates/workflows/spec-propose.ts`（5.5）
  - 验证：正文含 `## 硬约束`、`source: D<n>`、「并列不计入六节」、≤120 行预算
  - Spec Ref：skill-stage-continuation / handoff 包硬约束并列节
  - Scenario Ref：skill-stage-continuation / handoff 包硬约束并列节 / 产出并列节

- [x] 5.3 [代码] 缺节或无法从探索文件确定时回执 `status=incomplete` + `failure`，MUST NOT 猜测补写 [N15][N15a]
  - 文件：`src/core/templates/workflows/spec-propose.ts`（5.5）
  - 验证：正文含 incomplete + failure 与「MUST NOT 猜测补写」
  - Spec Ref：skill-stage-continuation / handoff 包硬约束并列节
  - Scenario Ref：skill-stage-continuation / handoff 包硬约束并列节 / 缺失则回执 incomplete

- [x] 5.4 [代码] 补存量包无该节 WARN 降级、模糊回答禁止伪造、与代码矛盾以代码为准三条边界规则 [N15][N16]
  - 文件：`src/core/templates/workflows/spec-propose.ts`（5.5）
  - 验证：正文含三条边界规则关键字（B3 / B4 / B5）
  - Spec Ref：skill-stage-continuation / handoff 包硬约束并列节
  - Scenario Ref：skill-stage-continuation / handoff 包硬约束并列节 / 存量 handoff 包无该节

- [x] 5.5 [代码] `spec-propose` 测试规划规则补「`[测试]` 任务覆盖 handoff `## 硬约束`」 [N14]
  - 文件：`src/core/templates/workflows/spec-propose.ts`（测试规划判定段）
  - 验证：正文含「测试任务覆盖相关硬约束」
  - Spec Ref：workflow-suite-skills / 决策可追溯链路（D<n>）
  - Scenario Ref：workflow-suite-skills / 决策可追溯链路（D<n>） / 测试覆盖硬约束

## 6. 编排口径（N12 / N13 / N16）

- [x] 6.1 [代码] `auto-workflow` Phase 1→2 明确 `exploration.md` 为唯一过桥载体，原样透传 `flowBaselineConfirmed` / `paperTrailStatus` [N12][N13]
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 验证：正文含「唯一过桥载体」「原样透传」「MUST NOT 补默认值」
  - Spec Ref：workflow-suite-skills / 编排技能纸迹衔接口径
  - Scenario Ref：workflow-suite-skills / 编排技能纸迹衔接口径 / exploration.md 为唯一边界载体

- [x] 6.2 [代码] `workflow` 同步同一衔接口径，并保持唯一用户停点不变；`skills/iagent-workflow/SKILL.md` 当前 499 行，新增内容 MUST 等行数压缩（合并重复护栏句，不删保护语句）；无法压到 500 行以内时，允许下沉 `references/paper-trail-handoff.md` 并在主文件保留 Read 指引 [N12][N13]
  - 文件：`src/core/templates/workflows/workflow.ts`、`references/paper-trail-handoff.md`（按需）
  - 验证：与 6.1 同口径；正文不含新增停顿；主文件 ≤500 行（或新增内容完全下沉 references）
  - Spec Ref：workflow-suite-skills / 编排技能纸迹衔接口径
  - Scenario Ref：workflow-suite-skills / 编排技能纸迹衔接口径 / 全自动管线唯一停点不变

- [x] 6.3 [代码] verify / apply / archive 补「只读复用 `## 硬约束`」；`## 阶段结论` 追加只由有 `Write` 权限的 apply / archive 执行，verify 只读、不声称已追加 [N16]
  - 文件：`src/core/templates/workflows/spec-verify.ts`、`spec-apply.ts`、`spec-archive.ts`（均含 handoff 段）
  - 验证：三处正文含「只读复用」；verify 正文不含「已追加阶段结论」类表述；MUST NOT 新增 grill 纸迹校验或术语写入逻辑；`spec-apply` 的 `references/batch-scheduling.md` 章节枚举同步，MUST NOT 只改主文件
  - Spec Ref：skill-stage-continuation / handoff 包硬约束并列节
  - Scenario Ref：skill-stage-continuation / handoff 包硬约束并列节 / 产出并列节

- [x] 6.4 [代码] 父级复核纸迹自证：`paperTrailStatus=complete` 时父编排至少核对一次 `exploration.md` 三项（存在或有字面量「无」），不一致记 WARN 并按实际值透传 [N12]
  - 文件：`src/core/templates/workflows/auto-workflow.ts`、`workflow.ts`
  - 验证：正文含「父级复核」「MUST NOT 静默采信子级自证」
  - Spec Ref：workflow-suite-skills / 编排技能纸迹衔接口径
  - Scenario Ref：workflow-suite-skills / 编排技能纸迹衔接口径 / 父级复核纸迹自证

## 7. 构建、快照与版本（交付收尾）

- [x] 7.1 [代码] 模板改动后先跑规模预检，再执行 `pnpm build && pnpm generate:skills` 刷新 `skills/` 静态快照 [N10][N14][N15]
  - 文件：`skills/`（生成产物）、`test/skill-size-budget.test.ts`（验证入口）
  - 验证：`pnpm build` 后 `test/skill-size-budget.test.ts` 通过（debug / workflow 主文件 ≤500 行）；随后 `test/skills-parity.test.ts` 通过
  - Spec Ref：workflow-suite-skills / 决策可追溯链路（D<n>）
  - Scenario Ref：workflow-suite-skills / 决策可追溯链路（D<n>） / 制品标注来源

- [x] 7.2 [代码] 按 **minor** 递增版本（4.1.0 → 4.2.0），同步 CHANGELOG / README [N15]
  - 文件：`package.json`、`CHANGELOG.md`、`README.md`
  - 验证：`node bin/iagent.js version bump --level minor` 写回 4.2.0，CHANGELOG 归档 `[Unreleased]`，README 版本示例同步（**不得**仅用 `node bin/iagent.js version` 判定——基线无提交时它默认 patch）
  - Spec Ref：workflow-suite-skills / 决策可追溯链路（D<n>）
  - Scenario Ref：workflow-suite-skills / 决策可追溯链路（D<n>） / Decisions 稳定 id

- [x] 7.3 [代码] 同步 `AGENTS.md` 中 handoff 消费方表述：verify 无 `Write`、不追加阶段结论；`## 阶段结论` 仅由 apply / archive 追加 [N16]
  - 文件：`AGENTS.md`（「跨阶段上下文」相关段落）
  - 验证：表述与本变更 delta 一致，MUST NOT 再写「verify / apply / archive 只读并只追加阶段结论」
  - Spec Ref：skill-stage-continuation / handoff 包硬约束并列节
  - Scenario Ref：skill-stage-continuation / handoff 包硬约束并列节 / 产出并列节

- [x] 7.4 [代码] 同步既有测试中的消费方表述：`test/subagent-resource-sharing.test.ts:245`、`test/markdown-first-regression.test.ts:279` 不再断言 verify「追加阶段结论」 [N16]
  - 文件：`test/subagent-resource-sharing.test.ts`、`test/markdown-first-regression.test.ts`
  - 验证：断言口径与 delta 一致，MUST NOT 删除回归保护点（只同步表述）
  - Spec Ref：skill-stage-continuation / handoff 包硬约束并列节
  - Scenario Ref：skill-stage-continuation / handoff 包硬约束并列节 / 产出并列节

## 8. 测试：workflow-suite-skills

- [x] 8.1 [测试][单元][P1] 断言两批确认：至多 2 次批量确认且每批逐条列出待确认项与建议 [N6][N8]
  - 文件：`test/grill-paper-trail.test.ts`（新增）
  - 验证：生成正文含「批量 1」「批量 2」「≤ 2」「逐条列出」
  - Spec Ref：workflow-suite-skills / grill L1-L5 批量确认（≤2 批）
  - Scenario Ref：workflow-suite-skills / grill L1-L5 批量确认（≤2 批） / 两批确认

- [x] 8.2 [测试][单元][P1] 断言最低深度 L3 保持，未确认 L4-L5 记入 Pending [N6]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：正文含「最低深度 L3」「Pending」
  - Spec Ref：workflow-suite-skills / grill L1-L5 批量确认（≤2 批）
  - Scenario Ref：workflow-suite-skills / grill L1-L5 批量确认（≤2 批） / 最低深度保持

- [x] 8.3 [测试][单元][P1] 断言「收敛深度不限」与「批量轮数受 ≤2 批规则约束（澄清门不计入流程级门预算）」共存，且无无限定「深度不限」 [N6][N8]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：新增口径关键字存在；旧矛盾句「不设人为上限」按**精确句匹配**不存在（避免「深度不限」子串误判）
  - Spec Ref：workflow-suite-skills / grill L1-L5 批量确认（≤2 批）
  - Scenario Ref：workflow-suite-skills / grill L1-L5 批量确认（≤2 批） / 收敛深度不设上限

- [x] 8.4 [测试][单元][P0] 断言三项纸迹齐备或显式「无」时 `paperTrailStatus=complete` [N10]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：正文含「Decisions / 术语表 / ADR」「显式『无』」「paperTrailStatus」
  - Spec Ref：workflow-suite-skills / 探索纸迹三项校验与回执声明（paperTrailStatus）
  - Scenario Ref：workflow-suite-skills / 探索纸迹三项校验与回执声明（paperTrailStatus） / 三项齐备或显式「无」

- [x] 8.5 [测试][单元][P0] 断言纸迹缺失并入流程最终确认门且 MUST NOT 新增阻塞门 [N10][N11]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：正文含「并入」「MUST NOT 新增阻塞门」；门白名单类别数仍为 5
  - Spec Ref：workflow-suite-skills / 探索纸迹三项校验与回执声明（paperTrailStatus）
  - Scenario Ref：workflow-suite-skills / 探索纸迹三项校验与回执声明（paperTrailStatus） / 纸迹缺失并入流程最终确认门

- [x] 8.6 [测试][单元][P1] 断言 `user-shortened` 为合法终态且未覆盖层级显式列出 [N8][N10]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：正文含 `user-shortened` 与「未覆盖层级」
  - Spec Ref：workflow-suite-skills / 探索纸迹三项校验与回执声明（paperTrailStatus）
  - Scenario Ref：workflow-suite-skills / 探索纸迹三项校验与回执声明（paperTrailStatus） / 用户提前结束为合法终态

- [x] 8.7 [测试][单元][P1] 断言无探索文件时校验跳过并记 WARN [N10]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：正文含「无探索文件」「WARN」「skipped」
  - Spec Ref：workflow-suite-skills / 探索纸迹三项校验与回执声明（paperTrailStatus）
  - Scenario Ref：workflow-suite-skills / 探索纸迹三项校验与回执声明（paperTrailStatus） / 无探索文件跳过校验

- [x] 8.8 [测试][单元][P1] 断言存量探索文件无字段契约时 WARN 视作无硬约束 [N10]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：正文含「存量」「视作无硬约束」「只对新产出强制」
  - Spec Ref：workflow-suite-skills / 探索纸迹三项校验与回执声明（paperTrailStatus）
  - Scenario Ref：workflow-suite-skills / 探索纸迹三项校验与回执声明（paperTrailStatus） / 存量探索文件无字段契约

- [x] 8.9 [测试][单元][P0] 断言 `exploration.md` 为唯一边界载体，Envelope 携带 `explorationFile` [N12][N13]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：auto-workflow / workflow 正文含「唯一过桥载体」「explorationFile」
  - Spec Ref：workflow-suite-skills / 编排技能纸迹衔接口径
  - Scenario Ref：workflow-suite-skills / 编排技能纸迹衔接口径 / exploration.md 为唯一边界载体

- [x] 8.10 [测试][单元][P0] 断言父级不改写回执纸迹字段、缺失不补默认值 [N12]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：正文含「原样透传」「MUST NOT 补默认值」
  - Spec Ref：workflow-suite-skills / 编排技能纸迹衔接口径
  - Scenario Ref：workflow-suite-skills / 编排技能纸迹衔接口径 / 回执纸迹字段不被父级改写

- [x] 8.11 [测试][单元][P0] 断言全自动管线唯一停点不变、纸迹校验在流程门内完成 [N12]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：auto-workflow 正文含「唯一停点」「在流程最终确认门之内」
  - Spec Ref：workflow-suite-skills / 编排技能纸迹衔接口径
  - Scenario Ref：workflow-suite-skills / 编排技能纸迹衔接口径 / 全自动管线唯一停点不变

- [x] 8.12 [测试][单元][P0] 断言 debug §2.3 含术语冲突检测（主文件或其 `references/grill-discipline.md`） [N7]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：debug 主文件与 references 合并语料含「先读」「同名」「显式裁决」
  - Spec Ref：workflow-suite-skills / debug 排查期 grill 纸迹纪律
  - Scenario Ref：workflow-suite-skills / debug 排查期 grill 纸迹纪律 / 术语冲突检测

- [x] 8.13 [测试][单元][P1] 断言 debug §2.3 含 ADR 三条件（主文件或其 `references/grill-discipline.md`） [N9]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：debug 主文件与 references 合并语料含三条 ADR 条件关键字
  - Spec Ref：workflow-suite-skills / debug 排查期 grill 纸迹纪律
  - Scenario Ref：workflow-suite-skills / debug 排查期 grill 纸迹纪律 / ADR 三条件判定

- [x] 8.14 [测试][单元][P1] 断言 debug §2.3 含边界场景构造（主文件或其 `references/grill-discipline.md`） [N7]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：debug 主文件与 references 合并语料含「≥1 边界场景」「写入诊断记录」
  - Spec Ref：workflow-suite-skills / debug 排查期 grill 纸迹纪律
  - Scenario Ref：workflow-suite-skills / debug 排查期 grill 纸迹纪律 / 边界场景构造

- [x] 8.15 [测试][单元][P0] 断言六处写入者均「先读 CONTEXT.md 再写」 [N7][N16]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：explore / debug / archive / bulk-archive / workflow Phase 2.0 / propose 0.5 正文均含「先读」
  - Spec Ref：workflow-suite-skills / CONTEXT.md 多写入者漂移防护
  - Scenario Ref：workflow-suite-skills / CONTEXT.md 多写入者漂移防护 / 先读后写

- [x] 8.16 [测试][单元][P0] 断言同名冲突显式裁决（更新或标注已过时） [N7][N16]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：六处正文含「显式裁决」「已过时（由 <change-name> 取代）」
  - Spec Ref：workflow-suite-skills / CONTEXT.md 多写入者漂移防护
  - Scenario Ref：workflow-suite-skills / CONTEXT.md 多写入者漂移防护 / 同名冲突显式裁决

- [x] 8.17 [测试][单元][P0] 断言归档取词口径收窄为仅 `exploration.md` 术语表 [N16]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：archive / bulk-archive 正文含「只同步」「exploration.md 术语表」且不含制品反向抽取
  - Spec Ref：workflow-suite-skills / CONTEXT.md 多写入者漂移防护
  - Scenario Ref：workflow-suite-skills / CONTEXT.md 多写入者漂移防护 / 归档取词口径收窄

- [x] 8.18 [测试][单元][P1] 断言 Decisions 带稳定 `D<n>` 且不复用 / 重排 [N14]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：spec-propose 正文含「D<n>」「MUST NOT 复用或重排」
  - Spec Ref：workflow-suite-skills / 决策可追溯链路（D<n>）
  - Scenario Ref：workflow-suite-skills / 决策可追溯链路（D<n>） / Decisions 稳定 id

- [x] 8.19 [测试][单元][P1] 断言 spec / design 在约束处标注 `(D<n>)` [N14]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：spec-propose 正文含 `(D<n>)` 标注要求
  - Spec Ref：workflow-suite-skills / 决策可追溯链路（D<n>）
  - Scenario Ref：workflow-suite-skills / 决策可追溯链路（D<n>） / 制品标注来源

- [x] 8.20 [测试][单元][P1] 断言 `[测试]` 任务覆盖 handoff 硬约束 [N14][N15]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：spec-propose 正文含「测试任务覆盖相关硬约束」
  - Spec Ref：workflow-suite-skills / 决策可追溯链路（D<n>）
  - Scenario Ref：workflow-suite-skills / 决策可追溯链路（D<n>） / 测试覆盖硬约束

- [x] 8.21 [测试][单元][P1] 断言 `version-minor` 硬约束有测试守护：版本相对基线 4.1.0 为 **minor 递增**（major 不变、minor 更大），且 CHANGELOG 含对应版本小节 [N15]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：动态读取 `package.json` 与 `CHANGELOG.md`，断言 minor 递增与对应小节存在；**MUST NOT 硬编码具体次版本号**（否则下次版本递增必失败）
  - Spec Ref：workflow-suite-skills / 决策可追溯链路（D<n>）
  - Scenario Ref：workflow-suite-skills / 决策可追溯链路（D<n>） / 测试覆盖硬约束

- [x] 8.22 [测试][单元][P1] 断言 `apply-exclusion` 硬约束有测试守护：`spec-apply` 正文不含 grill 纸迹校验 / 术语写入 / ADR 判定的新增逻辑，仅允许只读复用 `## 硬约束` [N16]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：对 `iagent-spec-apply` 正文做否定断言（不出现 `paperTrailStatus` / `CONTEXT.md` 写入规则）
  - Spec Ref：workflow-suite-skills / 决策可追溯链路（D<n>）
  - Scenario Ref：workflow-suite-skills / 决策可追溯链路（D<n>） / 测试覆盖硬约束

- [x] 8.23 [测试][单元][P0] 断言父级复核纸迹自证：`paperTrailStatus=complete` 时父级核对三项且不一致记 WARN [N12]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：auto-workflow / workflow 正文含「父级复核」「MUST NOT 静默采信子级自证」
  - Spec Ref：workflow-suite-skills / 编排技能纸迹衔接口径
  - Scenario Ref：workflow-suite-skills / 编排技能纸迹衔接口径 / 父级复核纸迹自证

- [x] 8.24 [测试][单元][P0] 断言并行单元 a.5 写入串行化 [N16]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：bulk-archive 正文含「串行化」「MUST NOT 并发写同一文件」
  - Spec Ref：workflow-suite-skills / CONTEXT.md 多写入者漂移防护
  - Scenario Ref：workflow-suite-skills / CONTEXT.md 多写入者漂移防护 / 并行单元写入串行化

- [x] 8.25 [测试][单元][P0] 断言探索硬约束声明：`## 硬约束` 段逐条带 `source: D<n>`，确无时写 `无硬约束` [N10]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：spec-explore 正文含 `## 硬约束`、`source: D<n>`、`无硬约束`、「MUST NOT 留空」
  - Spec Ref：workflow-suite-skills / 探索硬约束声明
  - Scenario Ref：workflow-suite-skills / 探索硬约束声明 / 有硬约束时逐条声明

- [x] 8.26 [测试][单元][P0] 断言全部 CONTEXT.md 写入者（六处）均「先读后写 + 同名冲突显式裁决」 [N7][N13][N14][N16]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：explore / debug / archive / bulk-archive / workflow Phase 2.0 / propose 0.5 六处均命中同一裁决措辞（`auto-workflow` 不单独断言）
  - Spec Ref：workflow-suite-skills / CONTEXT.md 多写入者漂移防护
  - Scenario Ref：workflow-suite-skills / CONTEXT.md 多写入者漂移防护 / 同名冲突显式裁决

## 9. 测试：skill-stage-continuation

- [x] 9.1 [测试][单元][P0] 断言 `## 硬约束` 为并列节且不计入六节 [N15]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：spec-propose 正文含「`## 硬约束`」「并列」「不计入六节」
  - Spec Ref：skill-stage-continuation / handoff 包硬约束并列节
  - Scenario Ref：skill-stage-continuation / handoff 包硬约束并列节 / 产出并列节

- [x] 9.2 [测试][单元][P0] 断言逐字保留与 `source: D<n>` 锚点，禁止整段复制 [N15]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：正文含「逐字保留」「source: D<n>」「MUST NOT 整段复制」
  - Spec Ref：skill-stage-continuation / handoff 包硬约束并列节
  - Scenario Ref：skill-stage-continuation / handoff 包硬约束并列节 / 逐字保留与来源锚点

- [x] 9.3 [测试][单元][P0] 断言缺节时回执 `incomplete` + `failure` [N15][N15a]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：正文含「status=incomplete」「failure」
  - Spec Ref：skill-stage-continuation / handoff 包硬约束并列节
  - Scenario Ref：skill-stage-continuation / handoff 包硬约束并列节 / 缺失则回执 incomplete

- [x] 9.4 [测试][单元][P1] 断言存量包无该节时 WARN 降级且不判整包无效 [N15][N16]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：正文含「WARN」「无硬约束」「MUST NOT 判定整包无效」
  - Spec Ref：skill-stage-continuation / handoff 包硬约束并列节
  - Scenario Ref：skill-stage-continuation / handoff 包硬约束并列节 / 存量 handoff 包无该节

- [x] 9.5 [测试][单元][P0] 断言模糊回答禁止伪造硬约束（B4） [N15]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：正文含「[待确认]」「MUST NOT 伪造硬约束」
  - Spec Ref：skill-stage-continuation / handoff 包硬约束并列节
  - Scenario Ref：skill-stage-continuation / handoff 包硬约束并列节 / 禁止伪造硬约束

- [x] 9.6 [测试][单元][P1] 断言硬约束与代码矛盾时以代码为准并在流程门呈现（B5） [N15][N11]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：正文含「代码事实优先」「矛盾在流程最终确认门呈现」
  - Spec Ref：skill-stage-continuation / handoff 包硬约束并列节
  - Scenario Ref：skill-stage-continuation / handoff 包硬约束并列节 / 硬约束与既有代码矛盾

- [x] 9.7 [测试][单元][P1] 断言 `## 硬约束` 节 ≤120 行且不计入六节 [N15]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：正文含「≤ 120 行」且与六节预算措辞一致
  - Spec Ref：skill-stage-continuation / handoff 包硬约束并列节
  - Scenario Ref：skill-stage-continuation / handoff 包硬约束并列节 / 硬约束节受每节预算约束

- [x] 9.8 [测试][单元][P1] 断言 `无硬约束` 为合法终态（空节不判 incomplete），且与包写入失败（WARN 继续）区分 [N15]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：正文含「无硬约束」「MUST NOT 因此返回 status=incomplete」「包写入失败」「WARN」
  - Spec Ref：skill-stage-continuation / handoff 包硬约束并列节
  - Scenario Ref：skill-stage-continuation / handoff 包硬约束并列节 / 显式无硬约束为合法终态

- [x] 9.9 [测试][单元][P1] 断言包写入失败按 WARN 继续、不与缺硬约束内容的 `incomplete` 混用 [N15]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：正文含「包写入失败」「WARN 继续」「MUST NOT 混用」
  - Spec Ref：skill-stage-continuation / handoff 包硬约束并列节
  - Scenario Ref：skill-stage-continuation / handoff 包硬约束并列节 / 包写入失败与内容缺失区分

## 10. 回归与快照

- [x] 10.1 [测试][功能][P0] 全量回归：`pnpm test` 全绿，重点 `template-consistency` / `stage-continuation` / `skill-size-budget` / `skills-parity` / `template-derivation` / `grill-paper-trail` / `spec-workflow-contract` [N10][N14][N15]
  - 文件：`test/`
  - 验证：全量测试通过；无删除断言的 diff
  - Spec Ref：workflow-suite-skills / 决策可追溯链路（D<n>）
  - Scenario Ref：workflow-suite-skills / 决策可追溯链路（D<n>） / 测试覆盖硬约束

## 11. 测试：spec-bulk-archive-skill

- [x] 11.1 [测试][单元][P0] 断言 a.5 取词口径收窄：只同步 `exploration.md` 术语表，禁止从 proposal / design / specs 反向抽取 [N16]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：bulk-archive 正文含「只同步」「exploration.md 术语表」；不含「读 proposal.md/design.md 自动补充」
  - Spec Ref：spec-bulk-archive-skill / 归档单元执行序列
  - Scenario Ref：spec-bulk-archive-skill / 归档单元执行序列 / a.5 取词口径收窄

- [x] 11.2 [测试][单元][P0] 断言 a.5 先读后写与同名冲突显式裁决 [N16]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：bulk-archive 正文含「写入前 MUST 先读」「显式裁决」「已过时（由 <change-name> 取代）」
  - Spec Ref：spec-bulk-archive-skill / 归档单元执行序列
  - Scenario Ref：spec-bulk-archive-skill / 归档单元执行序列 / 完整单元序列

- [x] 11.3 [测试][单元][P0] 断言并行单元 a.5 写入串行化且不丢失更新 [N16]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：bulk-archive 正文含「串行化」「MUST NOT 与其他并行单元的 a.5 并发写同一文件」
  - Spec Ref：spec-bulk-archive-skill / 归档单元执行序列
  - Scenario Ref：spec-bulk-archive-skill / 归档单元执行序列 / 并行单元 a.5 写入串行化

- [x] 11.4 [测试][单元][P0] 断言 a.6 **已移除**：无只读报告、无写入分支、无 `iagent_requirement_doc` 委派；`需求文档.md` 随目录原样移动 [N16]
  - 文件：`test/templates.test.ts:954-963`（既有断言，保留并扩展）
  - 验证：正文命中「a.6 **（已移除）**」「整体移除」「不再读取」；不含「需求文档：已存在」「需求文档：缺失」
  - Spec Ref：spec-bulk-archive-skill / 归档单元执行序列
  - Scenario Ref：spec-bulk-archive-skill / 归档单元执行序列 / a.6 已移除

- [x] 11.5 [测试][单元][P1] 保留既有行为断言：不向 devdocs 迁出需求文档 [N16]
  - 文件：`test/templates.test.ts`（既有断言，保留）
  - 验证：既有断言仍在且通过
  - Spec Ref：spec-bulk-archive-skill / 归档单元执行序列
  - Scenario Ref：spec-bulk-archive-skill / 归档单元执行序列 / 不再迁出 devdocs

- [x] 11.6 [测试][单元][P1] 保留既有行为断言：已归档内容只读 [N16]
  - 文件：`test/templates.test.ts`（既有断言，保留）
  - 验证：既有断言仍在且通过
  - Spec Ref：spec-bulk-archive-skill / 归档单元执行序列
  - Scenario Ref：spec-bulk-archive-skill / 归档单元执行序列 / 已归档内容只读

- [x] 11.7 [测试][单元][P1] 保留既有行为断言：只读校验发现越界时告警且不中止整批 [N16]
  - 文件：`test/templates.test.ts`（既有断言，保留）
  - 验证：既有断言仍在且通过
  - Spec Ref：spec-bulk-archive-skill / 归档单元执行序列
  - Scenario Ref：spec-bulk-archive-skill / 归档单元执行序列 / 只读校验发现越界时告警

- [x] 11.8 [测试][单元][P1] 保留既有行为断言：单元成功后清理流程级工作区、失败单元保留 [N16]
  - 文件：`test/templates.test.ts`（既有断言，保留）
  - 验证：既有断言仍在且通过
  - Spec Ref：spec-bulk-archive-skill / 归档单元执行序列
  - Scenario Ref：spec-bulk-archive-skill / 归档单元执行序列 / 单元成功后清理流程级工作区

- [x] 11.9 [测试][单元][P1] 保留既有行为断言：无 exploration.md 时跳过探索记忆同步 [N16]
  - 文件：`test/templates.test.ts`（既有断言，保留）
  - 验证：既有断言仍在且通过
  - Spec Ref：spec-bulk-archive-skill / 归档单元执行序列
  - Scenario Ref：spec-bulk-archive-skill / 归档单元执行序列 / 探索记忆同步跳过

- [x] 11.10 [测试][单元][P0] 断言 `CONTEXT.md` 不存在时仅从 `exploration.md` 术语表创建，术语表缺失则 WARN 跳过 [N16]
  - 文件：`test/grill-paper-trail.test.ts`
  - 验证：bulk-archive 正文含「CONTEXT.md 不存在」「exploration.md 术语表创建」「MUST NOT 从制品正文创建」
  - Spec Ref：spec-bulk-archive-skill / 归档单元执行序列
  - Scenario Ref：spec-bulk-archive-skill / 归档单元执行序列 / CONTEXT.md 不存在时仅从 exploration 创建
