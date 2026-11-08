# workflow-suite-skills 规格增量

## MODIFIED Requirements

### Requirement: 需求文档技能的手工调用保留与自动调用方变更

技能 `iagent_requirement_doc` 及其配对指令 SHALL 保留独立可调用性：standalone 模式（交互收集可跳过的基本信息）与输出路径按归档状态路由的规则保持不变，跨技术栈通用性保持不变，用户 MAY 在任何阶段手工调用。八章节编号与顺序 SHALL 保持不变；其**章节内容规则与伪代码规则** SHALL 按「需求文档面向人工评审的结构与内容契约」执行，MUST NOT 再声明为与改造前一致的不变规则；**DDL 提取规则 SHALL 保持不变**（主来源 `design.md` 决策、方言随技术栈、缺口标 `[待确认]`）。

自动调用方 SHALL 为空：workflow / auto-workflow / debug MUST NOT 再委派该技能；archive / bulk-archive MUST NOT 读取或报告需求文档；`iagent_spec_propose` 独立调用与 delegated 调用均 MUST NOT 生成需求文档。该技能不再随三个父流程自动注入安装；用户需要时 SHALL 在 `workflows` 中显式选择并在手工调用后使用。

#### Scenario: 独立指令仍可手工调用

- **WHEN** 用户在任意阶段手工执行需求文档技能
- **THEN** 技能按 standalone 模式运行，保留基本信息收集与输出路径按归档状态路由的行为
- **AND** 八章节编号与顺序保持不变，章节内容按「需求文档面向人工评审的结构与内容契约」派生

#### Scenario: 三个父工作流不再调用

- **WHEN** workflow、auto-workflow 或 debug 完成验证与深度复查
- **THEN** 父流程 MUST NOT 委派 `iagent_requirement_doc`、MUST NOT 展示生成/跳过桥

#### Scenario: 归档侧不再读取或报告

- **WHEN** archive 或 bulk-archive 处理变更
- **THEN** 技能 MUST NOT 读取 `需求文档.md` 或 `requirementDocStatus`、MUST NOT 在摘要中报告需求文档状态
- **AND** 文件随变更目录原样保留，不生成、不对齐、不迁出

#### Scenario: spec-propose 独立调用不自动生成

- **WHEN** 用户独立执行 `/iagent:spec-propose` 且验证 PASS
- **THEN** 技能 SHALL 停止，MUST NOT 生成需求文档、MUST NOT 呈现生成/跳过桥；用户 MAY 之后手工调用 `iagent_requirement_doc`

## ADDED Requirements

### Requirement: 需求文档面向人工评审的结构与内容契约

技能 `iagent_requirement_doc` SHALL 以「人工评审可直接使用」为目标生成需求文档，保持八章节编号与顺序不变，并满足以下结构与内容契约：

- **评审摘要**：SHALL 在「基本信息」之后、一、原始需求之前输出**无编号**「评审摘要」块，含结论、范围、Top3 风险、待拍板问题、评审要点建议与待确认计数。摘要内容 MUST 全部由制品派生，MUST NOT 编造；缺 Risks 或待确认项时 SHALL 标 `[待确认]`。派生来源 SHALL 为：结论 ← `proposal.md` Why 目标句与 What Changes 概括；范围 ← Capabilities 与 Impact 模块清单；待拍板问题 ← 7.7 阻塞项与 `design.md` Decisions 中未定权衡（无则写「无」）；计数 ← 7.7 行数与阻塞数；评审要点建议 ← 风险与待确认项（至多 5 条），MUST NOT 复制章节正文。**风险等级仅在 `design.md` 明示时使用，否则标「未分级」，MUST NOT 自行评级。**
- **验收标准与来源列**：需求拆解表 SHALL 新增「验收标准」与「来源」两列。验收标准 SHALL 优先来自 specs 的 Requirement / Scenario（WHEN/THEN 语义），`tasks.md` 的 `[测试]` 任务 MAY 作补充；`specs/` 缺失时整列 SHALL 标 `[待确认]`，MUST NOT 编造。来源 SHALL 使用短 ID 形式（`proposal:WC2` / `spec:<cap>:S1` / `task:T3.2`），MUST NOT 使用完整路径或仅章节名。
- **风险与待确认集中表**：七、影响分析 SHALL 含 7.6「风险」与 7.7「待确认」集中表。7.6 SHALL 映射 `design.md` 的 Risks「风险 | 缓解」；**等级仅在 `design.md` 明示时填写，否则标「未分级」，MUST NOT 自行评级**；优先级为：design 无 Risks → 摘要标 `[待确认]`；design 有 Risks 但未声明等级 → 7.6 与摘要标「未分级」；design 声明等级 → 使用该等级。design 无 Risks 时 7.6 SHALL 写「制品未声明风险」。7.7 SHALL 集中列出制品缺口及阻塞性；待确认项多于 10 条时表格 SHALL 完整列出，摘要只显示计数与阻塞数，MUST NOT 截断表格。
- **文档元信息块**：标题下 SHALL 输出生成元信息块（生成时间 / 来源变更 / 制品指纹 / 文档版本），该块 MUST NOT 归入人工域。制品指纹 SHALL 取自 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md` 的 `sourceFingerprint`（仅当文件存在且其 `change:` 与当前变更一致）；不可得时 SHALL 写「未提供」，MUST NOT 自行计算或编造。
- **结构化评审记录**：`## 八、评审记录` SHALL 提供结构化骨架（评审日期 / 参与人 / 评审结论 / 遗留事项与处置表），整章 SHALL 为人工域。
- **伪代码上限**：伪代码 SHALL 仅在表格或流程图无法表达判定逻辑时使用，且 MUST 满足 ≤2 块/文档、≤12 行/块；伪代码专项强制校验项 SHALL 删除，仅保留 1 条按需校验。
- **人工域保护与增量对齐**：目标文件已存在时，技能 SHALL 解析并保留人工域——`## 基本信息` 中已填写的值（占位符 MUST NOT 保留，缺行按占位符处理）与 `## 八、评审记录` 全文（保留至**文件末尾**，八为最后一章）——并按当前制品重建一~七章后回填，MUST NOT 静默覆盖。
- **解析失败不写入**：人工域解析失败（表格破损 / 章节缺失）时，技能 MUST NOT 写入目标文件，SHALL 保留原文件并报告期望路径与失败原因。
- **失败语义**：生成或写入失败 MUST 报错并保留原文件，MUST NOT 以「非阻断 WARN」跳过；本技能无自动调用方，非交互调用同样 MUST NOT 静默降级。
- **重复运行幂等**：除生成时间外，重复运行 SHALL 产出一致内容；生成时间变化 MUST NOT 视为内容漂移。
- **自动调用方不变**：本契约 MUST NOT 引入任何自动调用方，技能仍 SHALL 保持「仅手工调用、无自动调用方」。

#### Scenario: 评审摘要存在且位于基本信息之后

- **WHEN** 技能完成制品读取与章节映射并生成文档
- **THEN** 文档 SHALL 在「基本信息」之后、一、原始需求之前含无编号「评审摘要」块
- **AND** 摘要含结论、范围、Top3 风险、待拍板问题、评审要点建议与待确认计数，且全部可追溯至制品
- **AND** 风险等级仅在 `design.md` 明示时使用，否则标「未分级」，MUST NOT 自行评级

#### Scenario: 需求拆解含验收标准与来源列

- **WHEN** 技能生成二、需求分析的「需求拆解」表
- **THEN** 表头 SHALL 含「验收标准」与「来源」两列
- **AND** 验收标准 SHALL 来自 specs 的 Requirement / Scenario 或标的 `[待确认]`；来源 SHALL 为短 ID 形式

#### Scenario: 风险映射与待确认集中表

- **WHEN** 技能生成七、影响分析
- **THEN** SHALL 输出 7.6 风险表（映射 `design.md` 的 Risks「风险 | 缓解」）与 7.7 待确认集中表（含阻塞性）
- **AND** 风险等级仅在 `design.md` 明示时填写，否则标「未分级」，MUST NOT 自行评级
- **AND** design 无 Risks 时 7.6 写「制品未声明风险」且摘要风险等级标 `[待确认]`，MUST NOT 编造

#### Scenario: 无 specs 时验收标准标待确认

- **WHEN** 变更缺少 `specs/**/*.md`（skip_specs 或纯文档变更）
- **THEN** 「验收标准」列 SHALL 全部标 `[待确认]`，覆盖自检 SHALL 跳过并记 WARN
- **AND** 缺口 SHALL 计入 7.7 与摘要待确认计数

#### Scenario: 伪代码上限

- **WHEN** 技能判断某章节需要伪代码表达表格或流程图无法承载的判定逻辑
- **THEN** 伪代码 MUST 满足 ≤2 块/文档、≤12 行/块
- **AND** 产出校验 MUST NOT 再含伪代码专项强制校验项，仅保留 1 条按需校验

#### Scenario: 人工域保护与增量对齐

- **WHEN** 目标 `需求文档.md` 已存在且人工域解析成功
- **THEN** 技能 SHALL 逐字保留 `## 基本信息` 的已填值与 `## 八、评审记录` 全文，并重建一~七章后回填
- **AND** 人工域中的占位符 MUST NOT 保留；`## 八、评审记录` 保留至**文件末尾**（八为最后一章），自定义子小节一并保留

#### Scenario: 解析失败不写入

- **WHEN** 目标文件表格破损或人工域章节缺失导致解析失败
- **THEN** 技能 MUST NOT 写入目标文件，SHALL 保留原文件并报告期望路径与解析失败原因

#### Scenario: 目标文件只读或写入失败

- **WHEN** 目标文件只读或写入发生 IO 错误
- **THEN** 技能 SHALL 保留原文件并报错，MUST NOT 声称生成成功

#### Scenario: 重复运行幂等

- **WHEN** 技能对同一制品集合重复运行
- **THEN** 除生成时间外文档内容保持一致；生成时间变化 MUST NOT 视为内容漂移

#### Scenario: 文档元信息块存在且不入人工域

- **WHEN** 技能生成文档标题与基本信息
- **THEN** 标题下 SHALL 含生成元信息块（生成时间 / 来源变更 / 制品指纹 / 文档版本）
- **AND** 制品指纹取自 handoff 包 `sourceFingerprint`（存在且 `change:` 匹配时），否则写「未提供」，MUST NOT 自行计算
- **AND** 该块 MUST NOT 归入人工域，重生成时随文档刷新

#### Scenario: 结构化评审记录骨架

- **WHEN** 技能生成 `## 八、评审记录`
- **THEN** 该章节 SHALL 含评审日期 / 参与人 / 评审结论 / 遗留事项与处置表的结构化骨架
- **AND** 整章 SHALL 为人工域，重生成时逐字保留至文件末尾

#### Scenario: 失败必须报错而非非阻断 WARN

- **WHEN** 生成或写入过程发生失败
- **THEN** 技能 MUST 报错并保留原文件，MUST NOT 以「非阻断 WARN」跳过或声称生成成功
- **AND** 非交互调用同样 MUST NOT 静默降级

#### Scenario: 无自动调用方不变

- **WHEN** 检查技能调用方
- **THEN** workflow / auto-workflow / debug / spec-propose MUST NOT 委派该技能，archive / bulk-archive MUST NOT 读取或报告需求文档
- **AND** 技能仍为「仅手工调用、无自动调用方」，不随三父流程自动注入安装
