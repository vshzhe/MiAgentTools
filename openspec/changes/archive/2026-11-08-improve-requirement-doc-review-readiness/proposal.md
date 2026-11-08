# 需求文档评审可用性优化

## Why

`iagent-requirement-doc`（`src/core/templates/workflows/requirement-doc.ts`，docs 类型，约 240 行）是变更制品（proposal / design / specs / tasks）转换为八章节评审需求文档的唯一入口。探索（`exploration.md`，提示词基线 2026-11-08 确认）以「人工评审可直接使用」为目标，发现了 11 项带证据的缺陷：

- `design.md` 的 Risks 完全没有映射到需求文档任何章节（`requirement-doc.ts:59-71` 无 Risks 行）；
- 需求拆解无「验收标准」与「来源」列，评审无法判定「怎样算做完」，也无法核对 proposal / spec / tasks 的覆盖与遗漏（`requirement-doc.ts:162`）；
- `[待确认]` 只散落在伪代码 / DDL 内部，无集中清单与阻塞性标记（`requirement-doc.ts:122,130`）；
- 八、评审记录为空模板，真实文档需人工补「评审要点建议」（样例 `需求文档.md:268-274`）；
- 场景分组硬编码 4 类，实际归类可疑（`requirement-doc.ts:90-97`）；
- 无文档元数据，无法判断评审的是哪一版（`requirement-doc.ts:137-145`）；
- 影响分析无兼容性 / 破坏性变更 / 数据迁移 / 回滚方案（`requirement-doc.ts:205-206`）；
- **目标文件已存在时静默覆盖，会抹掉「八、评审记录」与人工填写的基本信息**（`requirement-doc.ts:225-226`；debug 曾因此禁用生成分支）；
- 伪代码规则占用大量篇幅与校验项，评审价值低于验收 / 风险 / 追溯（`requirement-doc.ts:115-124,164-197,238-241`）；
- 无「评审摘要 / 决策请求」，评审者需读完八章才能找到要拍板什么。

为什么是现在：`skill-bridge-optimize` 已把该技能收敛为**仅手工调用、无自动调用方**（能力 `workflow-suite-skills` 的既有 Requirement）。手工重跑正是「静默覆盖抹人工内容」与「评审结构不足」的实际暴露路径，且现有能力规格把「八章节 / 伪代码 / DDL 规则」整体声明为保持不变，与本变更目标冲突，必须同步以 delta spec 废止该表述（其中 DDL 提取规则本次仍保持不变）。

## What Changes

- **结构**：保持八章节编号与顺序不变；新增**无编号「评审摘要」块**，位于「基本信息」之后、一、原始需求之前。摘要含结论、范围、Top3 风险、待拍板问题、评审要点建议与待确认计数，全部从制品派生，MUST NOT 编造。派生来源：结论 ← proposal Why 目标句 + What Changes 概括；范围 ← Capabilities + Impact 模块清单；待拍板问题 ← 7.7 阻塞项 + design Decisions 未定权衡（无则「无」）；计数 ← 7.7 行数与阻塞数；评审要点建议 ← Risks + 待确认项（≤5 条）。**风险等级仅在 design 明示时使用，否则标「未分级」，不自行评级。**
- **内容增强**：需求拆解表新增「验收标准」「来源」两列——验收标准优先来自 specs 的 Requirement / Scenario（WHEN/THEN），无 specs 时标 `[待确认]`，`tasks.md` 的 `[测试]` 任务作补充；来源使用短 ID（`proposal:WC2` / `spec:<cap>:S1` / `task:T3.2`）。
- **风险与缺口集中呈现**：七、影响分析新增 7.6「风险」与 7.7「待确认」集中表；7.6 映射 `design.md` 的 Risks「风险 | 缓解」（当前完全丢失），等级仅在 design 明示时填写、否则「未分级」，MUST NOT 自行评级；design 无 Risks 时写「制品未声明风险」。
- **评审记录结构化**：八、评审记录由空白模板改为结构化骨架（评审日期 / 参与人 / 结论 / 遗留事项），属人工域。
- **文档元数据**：标题下生成元信息块（生成时间 / 来源变更 / 制品指纹 / 文档版本），不入人工域。制品指纹 SHALL 取自 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md` 的 `sourceFingerprint`（存在且 `change:` 匹配时）；不存在时写「未提供」，MUST NOT 自行计算或编造（`Bash(iagent:*)` 白名单内无指纹命令）。
- **伪代码降噪**：仅当表格 / 流程图无法表达判定逻辑时使用，≤2 块/文档、≤12 行/块；删除伪代码专项强制校验项，保留 1 条按需校验。
- **重生成保护**：目标文件已存在时，解析并保留人工域（`## 基本信息` 已填值 + `## 八、评审记录` 全文至文件末尾，八为最后一章），按当前制品重建一~七章；**解析失败不写入**，保留原文件并报错。
- **失败语义**：生成 / 写入失败 MUST 报错并保留原文件，废止旧的「非阻断 WARN / 工作流集成下生成失败非阻断」口径；本技能无自动调用方，非交互调用同样 MUST NOT 静默降级。
- **DDL 规则不变**：`六、表结构设计` 的提取规则（主来源 design 决策、方言随技术栈、缺口标 `[待确认]`）保持不变，仅伪代码规则降噪。
- **能力规格**：以 delta spec 显式修改 `workflow-suite-skills` 既有 Requirement「需求文档技能的手工调用保留与自动调用方变更」中「八章节 / 伪代码 / DDL 规则保持不变」的表述，并新增「需求文档面向人工评审的结构与内容契约」Requirement。

不改变：手工调用定位（无自动调用方）、输出路径路由、技术栈通用性、八章节编号与顺序。

## Capabilities

### New Capabilities

无（本变更不新增能力，仅修改既有技能行为与其能力规格）。

### Modified Capabilities

- `workflow-suite-skills`: 修改既有 Requirement「需求文档技能的手工调用保留与自动调用方变更」，保留「仅手工调用、无自动调用方」语义；章节内容规则与伪代码规则改为按评审导向契约执行，**DDL 提取规则明确保持不变**；新增 Requirement「需求文档面向人工评审的结构与内容契约」。

## Impact

### 直接影响的文件

- `src/core/templates/workflows/requirement-doc.ts`: 技能模板唯一源——新增评审摘要、验收标准 / 来源列、7.6 / 7.7 集中表、结构化评审记录、生成元信息块、伪代码降噪、人工域保护与增量对齐；command 版由 `deriveCommandContent()` 派生（不另立手工正文）。
- `src/core/templates/registry.ts`: `getRequirementDocSkillTemplate` / `getRequirementDocCommandTemplate` 的注册与派生消费点（`WORKFLOW_PAIRS` / `countSkillsByType` / `getSkillTemplates` / `getCommandTemplates` / `getKnownCommandIds`）；注册结构与技能总数不变。
- `src/commands/generate.ts`: docs 类型枚举消费（不改行为）。
- `skills/iagent-requirement-doc/SKILL.md`: 生成快照（`pnpm build && pnpm generate:skills` 重建）。
- `test/template-consistency.test.ts`: 「无自动调用方」口径断言须继续通过。
- `test/stage-continuation.test.ts`: `standalone-only` 断言须继续通过。
- `test/template-derivation.test.ts`: command 版由 skill 版派生的一致性断言须继续通过；该测试硬编码了 `CMD:SKIP` 标记模板集合（`test/template-derivation.test.ts:42`），本变更**默认不新增标记**；若实现期需要标记，须同步该集合。
- `test/skill-size-budget.test.ts`: 主 SKILL.md ≤500 行预算守卫。
- `test/description-format.test.ts` / `test/allowed-tools.test.ts`: description 结构与白名单守卫。
- `openspec/specs/workflow-suite-skills/spec.md`: 主规格（归档时由 delta 同步）。

### 向后兼容

无破坏性变更。技能仍为手工调用、输出路径路由与技术栈通用性不变；八章节编号与顺序不变。对既有需求文档重跑时改为保留人工域并重建其余章节（替代静默覆盖）；人工域解析失败时拒绝写入，属更安全的行为变化，用户可手工备份后重试。能力规格的 MODIFIED 仅废止「规则保持不变」的表述，不改变调用方语义。
