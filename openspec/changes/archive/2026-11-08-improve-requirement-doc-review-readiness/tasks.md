# Tasks: improve-requirement-doc-review-readiness

> 流程基准：`exploration.md` 的 `## 功能流程图`（N1–N12，2026-11-08 已确认）。每个任务标注对应节点标识。
> 模板唯一源为 skill 版正文，command 版由 `deriveCommandContent()` 派生，MUST NOT 另写手工 command 正文。

## 1. 模板正文改造（评审导向结构）

- [x] 1.1 [代码] 新增「评审摘要」派生规则与输出骨架（无编号块，位于基本信息之后、一、原始需求之前；含结论 / 范围 / Top3 风险 / 待拍板问题 / 评审要点建议 / 待确认计数；派生来源：结论←Why 目标句+What Changes 概括、范围←Capabilities+Impact 模块、待拍板←7.7 阻塞项+Decisions 未定权衡、计数←7.7 行数与阻塞数、要点≤5 条；风险等级仅在 design 明示时使用，否则「未分级」，MUST NOT 自行评级；缺 Risks 或待确认项时标 [待确认]） [N6]
  - 文件：`src/core/templates/workflows/requirement-doc.ts`
  - 验证：正文含「评审摘要」段落与派生规则；`iagent spec validate --change improve-requirement-doc-review-readiness` 通过
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 评审摘要存在且位于基本信息之后

- [x] 1.2 [代码] 需求拆解表新增「验收标准」「来源」两列：验收标准优先取自 specs 的 Requirement / Scenario（WHEN/THEN），`tasks.md` 的 `[测试]` 任务作补充，无 specs 时整列标 [待确认]；来源使用短 ID（`proposal:WC2` / `spec:<cap>:S1` / `task:T3.2`） [N7]
  - 文件：`src/core/templates/workflows/requirement-doc.ts`
  - 验证：拆解表头含两列；正文给出短 ID 示例与无 specs 降级规则
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 需求拆解含验收标准与来源列

- [x] 1.3 [代码] 新增 7.6「风险」与 7.7「待确认」集中表：7.6 映射 `design.md` 的 Risks「风险 | 缓解」，等级仅在 design 明示时填写、否则「未分级」；design 无 Risks 时写「制品未声明风险」；7.7 列出制品缺口与阻塞性，超过 10 条时表格完整列出、摘要只显示计数与阻塞数 [N9]
  - 文件：`src/core/templates/workflows/requirement-doc.ts`
  - 验证：正文含 7.6 / 7.7 小节定义与「不编造 / 不截断」护栏
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 风险映射与待确认集中表

- [x] 1.4 [代码] 八、评审记录由空白模板改为结构化骨架（评审日期 / 参与人 / 评审结论 / 遗留事项与处置表），并在标题下新增生成元信息块（生成时间 / 来源变更 / 制品指纹 / 文档版本）；制品指纹取自 handoff 包 `sourceFingerprint`（存在且 `change:` 匹配时），否则「未提供」；文档版本固定 `v1`；元信息块不入人工域 [N2][N11]
  - 文件：`src/core/templates/workflows/requirement-doc.ts`
  - 验证：输出结构示例含元信息块与结构化评审记录；元信息块显式声明非人工域；指纹规则不自行计算
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 文档元信息块存在且不入人工域
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 结构化评审记录骨架

- [x] 1.5 [代码] 伪代码降噪：仅当表格或流程图无法表达判定逻辑时使用，≤2 块/文档、≤12 行/块；删除伪代码专项强制校验项，仅保留 1 条按需校验 [N8]
  - 文件：`src/core/templates/workflows/requirement-doc.ts`
  - 验证：伪代码规则段与产出校验段同步更新；无 15 行/块或 3 块/章节残留
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 伪代码上限

## 2. 重生成保护与产出校验

- [x] 2.1 [代码] 将「目标文件已存在时静默覆盖」改为解析并保留人工域：`## 基本信息` 已填值（占位符不保留）+ `## 八、评审记录` 全文（保留至**文件末尾**，八为最后一章）；按当前制品重建一~七章后回填 [N10][N10A]
  - 文件：`src/core/templates/workflows/requirement-doc.ts`
  - 验证：正文删除静默覆盖规则并含人工域保留与增量对齐步骤；MUST NOT 残留「静默覆盖」表述；MUST NOT 残留 `requirement-doc.ts:226` 的「MUST NOT 弱化 / 不做就地增量对齐 / 调用方职责」整段
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 人工域保护与增量对齐

- [x] 2.2 [代码] 新增解析失败与写入失败分支：人工域解析失败（表格破损 / 章节缺失）时不写入、保留原文件并报告期望路径与原因；只读 / IO 写入失败同样保留原文件并报错；失败 MUST NOT 以「非阻断 WARN」跳过 [N10B]
  - 文件：`src/core/templates/workflows/requirement-doc.ts`
  - 验证：正文含失败分支与报错要求；MUST NOT 声称生成成功；无「非阻断」失败口径
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 解析失败不写入
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 失败必须报错而非非阻断 WARN

- [x] 2.3 [代码] 清理与新契约冲突的存量口径：删除 Step 2「非交互模式（由工作流调用时）」中「绝不因提问阻塞」的旧语义，改为「无自动调用方；若被外部脚本非交互调用，基本信息用占位符，失败 MUST 报错且不写入」；删除 Guardrails「工作流集成下的生成失败为非阻断：记 WARNING」，改为失败必须报错 [N2][N10B]
  - 文件：`src/core/templates/workflows/requirement-doc.ts`
  - 验证：正文不含「生成失败为非阻断」「非阻断 WARN」失败口径与「绝不因提问阻塞」；仍保留占位符规则；JSON 历史降级的 WARN 不受影响
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 失败必须报错而非非阻断 WARN

- [x] 2.4 [代码] 更新产出校验清单：结构完整、评审摘要、验收标准与来源、风险与待确认集中表、伪代码上限（1 条按需）、人工域保留；删除伪代码专项强制项与旧的「需求拆解列集」口径 [N12]
  - 文件：`src/core/templates/workflows/requirement-doc.ts`
  - 验证：校验清单逐项对应新增契约；无失效校验项
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 重复运行幂等

## 3. 规格 delta 与生成快照

- [x] 3.1 [代码] 核对 delta spec 与模板正文一致（`## MODIFIED` 保留「仅手工调用、无自动调用方」，废止「八章节 / 伪代码规则保持不变」，并**明确 DDL 提取规则保持不变**；`## ADDED` 承载评审结构与内容契约）；若实现期间出现偏离，同步修正 delta spec。主规格 `openspec/specs/workflow-suite-skills/spec.md:353,358,363,368,491-494` 的存量漂移（仍写自动生成 / 委派）不在本变更范围，归档时若仍存在记 WARN；`openspec/CONTEXT.md` 的「人工域」「就地增量对齐」条目在归档同步时按本技能语境更新（不改写 archive 历史说明）
  - 文件：`openspec/changes/improve-requirement-doc-review-readiness/specs/workflow-suite-skills/spec.md`
  - 验证：`iagent spec validate --change improve-requirement-doc-review-readiness` 无错误
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档技能的手工调用保留与自动调用方变更 / 独立指令仍可手工调用

- [x] 3.2 [代码] 重新生成 `skills/` 静态快照（`pnpm build && pnpm generate:skills`），确认 `skills/iagent-requirement-doc/SKILL.md` 与模板正文一致且行数 ≤500
  - 文件：`skills/iagent-requirement-doc/SKILL.md`
  - 验证：`pnpm build && pnpm generate:skills` 成功；`test/skills-parity.test.ts` 与 `test/skill-size-budget.test.ts` 通过
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 评审摘要存在且位于基本信息之后

## 4. 测试

- [x] 4.1 [测试][单元][P0] 断言正文含无编号「评审摘要」块及其位置（基本信息之后、一、原始需求之前）与派生字段清单 [N6]
  - 文件：`test/requirement-doc-review-readiness.test.ts`
  - 验证：模板正文含「评审摘要」「待拍板问题」「评审要点建议」「待确认计数」与五条派生来源；位置描述可匹配
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 评审摘要存在且位于基本信息之后

- [x] 4.2 [测试][单元][P0] 断言需求拆解表含「验收标准」「来源」列、短 ID 形式与无 specs 时的 [待确认] 降级 [N7]
  - 文件：`test/requirement-doc-review-readiness.test.ts`
  - 验证：正文含两列表头、`proposal:WC2` / `spec:<cap>:S1` / `task:T3.2` 示例与降级规则
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 需求拆解含验收标准与来源列

- [x] 4.3 [测试][单元][P0] 断言 7.6 风险映射与 7.7 待确认集中表存在，且含「制品未声明风险」与 >10 条不截断规则 [N9]
  - 文件：`test/requirement-doc-review-readiness.test.ts`
  - 验证：正文含 7.6 / 7.7、「制品未声明风险」、>10 条不截断，以及「等级仅在 design 明示时使用，否则未分级」规则
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 风险映射与待确认集中表

- [x] 4.4 [测试][单元][P1] 断言无 specs 时验收标准整列 [待确认] 且缺口计入 7.7 与摘要计数 [N7][N9]
  - 文件：`test/requirement-doc-review-readiness.test.ts`
  - 验证：正文含无 specs 降级分支与覆盖自检 SKIP 记 WARN
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 无 specs 时验收标准标待确认

- [x] 4.5 [测试][单元][P0] 断言伪代码上限为 ≤2 块/文档、≤12 行/块，且产出校验仅保留 1 条按需校验 [N8]
  - 文件：`test/requirement-doc-review-readiness.test.ts`
  - 验证：正文含新上限；不含「15 行」「3 块/章节」与伪代码专项强制校验项
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 伪代码上限

- [x] 4.6 [测试][单元][P0] 断言人工域保护规则（基本信息已填值 + 八、评审记录全文，保留至**文件末尾**）与增量对齐步骤存在，且旧「静默覆盖」表述与「MUST NOT 弱化」整段已移除 [N10][N10A]
  - 文件：`test/requirement-doc-review-readiness.test.ts`
  - 验证：正文含人工域与增量对齐关键词；不含静默覆盖规则与「MUST NOT 弱化」
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 人工域保护与增量对齐

- [x] 4.7 [测试][单元][P0] 断言解析失败不写入、保留原文件并报告路径与原因 [N10B]
  - 文件：`test/requirement-doc-review-readiness.test.ts`
  - 验证：正文含解析失败分支与报错要求
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 解析失败不写入

- [x] 4.8 [测试][单元][P1] 断言只读 / 写入 IO 失败时保留原文件并报错，MUST NOT 声称成功
  - 文件：`test/requirement-doc-review-readiness.test.ts`
  - 验证：正文含写入失败分支
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 目标文件只读或写入失败

- [x] 4.9 [测试][单元][P1] 断言重复运行幂等口径（除生成时间外一致；生成时间变化不视为内容漂移）
  - 文件：`test/requirement-doc-review-readiness.test.ts`
  - 验证：正文含幂等声明
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 重复运行幂等

- [x] 4.10 [测试][单元][P0] 断言「仅手工调用、无自动调用方」口径不变：`test/template-consistency.test.ts` 与 `test/stage-continuation.test.ts` 的既有断言继续通过，且命令版派生正文保留新关键词 [N10][边界场景 10]
  - 文件：`test/template-consistency.test.ts`、`test/stage-continuation.test.ts`、`test/requirement-doc-review-readiness.test.ts`
  - 验证：`pnpm test -- template-consistency stage-continuation requirement-doc-review-readiness` 通过
  - Spec Ref：workflow-suite-skills / 需求文档技能的手工调用保留与自动调用方变更
  - Scenario Ref：workflow-suite-skills / 需求文档技能的手工调用保留与自动调用方变更 / 独立指令仍可手工调用

- [x] 4.11 [测试][单元][P1] 断言 command 版由 skill 版派生且派生后仍含评审摘要 / 验收标准 / 人工域保护关键词 [边界场景 10]
  - 文件：`test/template-derivation.test.ts`
  - 验证：`getRequirementDocCommandTemplate().content` 含新关键词且不含 `requirementDocStatus`；若新增 `CMD:SKIP` 标记，须同步 `test/template-derivation.test.ts:42` 的硬编码集合（默认不新增）
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 无自动调用方不变

- [x] 4.12 [测试][功能][P1] 生成产物端到端：`pnpm build && pnpm generate:skills` 后 `skills/iagent-requirement-doc/SKILL.md` 与 `generateSkillContent(模板, 'snapshot')` 一致（比较时忽略 `generatedBy` / `generatedFingerprint` 等版本元数据行），且含新结构关键词
  - 文件：`test/requirement-doc-review-readiness.test.ts`
  - 验证：先 `pnpm build && pnpm generate:skills` 再运行该用例；MUST NOT 使用 `node bin/iagent.js generate`（仅产骨架）
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 文档元信息块存在且不入人工域

- [x] 4.13 [测试][单元][P0] 断言 workflow / auto-workflow / debug 不委派 `iagent_requirement_doc` 且不展示生成 / 跳过桥
  - 文件：`test/stage-continuation.test.ts`
  - 验证：既有断言继续通过；模板正文与 `allowedTools` 均无该技能条目
  - Spec Ref：workflow-suite-skills / 需求文档技能的手工调用保留与自动调用方变更
  - Scenario Ref：workflow-suite-skills / 需求文档技能的手工调用保留与自动调用方变更 / 三个父工作流不再调用

- [x] 4.14 [测试][单元][P0] 断言 archive / bulk-archive 不读取 `需求文档.md`、不读取或报告 `requirementDocStatus`
  - 文件：`test/stage-continuation.test.ts`
  - 验证：既有断言继续通过；正文无需求文档状态与生成 / 对齐 / 迁出动作
  - Spec Ref：workflow-suite-skills / 需求文档技能的手工调用保留与自动调用方变更
  - Scenario Ref：workflow-suite-skills / 需求文档技能的手工调用保留与自动调用方变更 / 归档侧不再读取或报告

- [x] 4.15 [测试][单元][P1] 断言 `iagent_spec_propose` 独立调用在验证 PASS 后停止，不生成需求文档、不展示生成 / 跳过桥
  - 文件：`test/stage-continuation.test.ts`
  - 验证：propose 模板正文无需求文档生成 / 委派条目
  - Spec Ref：workflow-suite-skills / 需求文档技能的手工调用保留与自动调用方变更
  - Scenario Ref：workflow-suite-skills / 需求文档技能的手工调用保留与自动调用方变更 / spec-propose 独立调用不自动生成

- [x] 4.16 [测试][单元][P1] 断言生成元信息块（含指纹取 handoff 包规则）、结构化评审记录骨架与「失败必须报错而非非阻断 WARN」三项契约
  - 文件：`test/requirement-doc-review-readiness.test.ts`
  - 验证：正文含 `sourceFingerprint` 取值规则、「未提供」降级、文档版本 `v1` 定义、评审记录结构化字段与失败报错口径；不含「生成失败为非阻断」失败口径（JSON 降级 WARN 不受影响）
  - Spec Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 结构化评审记录骨架
  - Scenario Ref：workflow-suite-skills / 需求文档面向人工评审的结构与内容契约 / 失败必须报错而非非阻断 WARN
