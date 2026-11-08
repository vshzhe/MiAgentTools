/**
 * docs 类型技能模板：变更提案转评审需求文档（面向人工评审的八章节映射转换）。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { deriveCommandContent } from '../derive-command.js';

export function getRequirementDocSkillTemplate(): SkillTemplate {
    return {
        name: 'iagent_requirement_doc',
        description: '把变更制品（proposal.md / design.md / specs/**/*.md + tasks.md）转换为标准八章节需求文档（requirement document）供人工评审。当用户要生成需求文档 / 需求单 / 转换提案为需求文档时使用；触发词"需求文档 / requirement document / 需求单 / 提案转文档"；NOT for 扫描源项目生成迁移需求文档——那用 iagent_feature_doc。',
        instructions: `**适用项目护栏（impl 域蒸馏，见 .iagent/rules/coding-rules.md）。** 未定义项标 **[待确认]**，禁止猜测。

把 OpenSpec 变更提案转换为面向人工评审的标准需求文档：评审者可快速定位结论、风险与待拍板问题，每条需求可验证、可追溯，制品缺口集中呈现，重生成不破坏人工填写内容。

**输入**：\`/iagent:requirement-doc\` 后可指定变更名（如 \`/iagent:requirement-doc add-auth\`）；若省略，则判断能否从对话上下文推断；若仍有歧义，询问用户。

---

## Step 1: 定位变更提案文件

按顺序查找：

1. **活跃变更目录**：\`openspec/changes/{change-name}/\`
2. **已归档变更目录**：\`openspec/changes/archive/{date}-{change-name}/\`
3. **用户指定路径**

变更名未知时询问用户。所有路径使用 \`path.join()\`（跨平台）。可选地运行 \`iagent spec status --json\` 枚举活跃变更（CLI 降级：命令不可用时回退到上述目录查找）。

记录找到提案文件所在位置的归档状态 —— 它决定 Step 6 的输出路径：活跃（位于 \`openspec/changes/\` 下）、已归档（位于 archive 目录下，或包含 archive 段的用户指定路径）、或不含 archive 段的用户指定路径。

## Step 2: 选择执行模式

**独立模式（直接调用时的默认模式）**：
- 使用 **AskUserQuestion 工具**交互式收集基本信息 —— 每个问题都可跳过：
  - 需求编号（格式：REQ-YYYY-XXX）
  - 需求名称
  - 交付时间（格式：YYYY-MM-DD）
  - 原始需求（原始需求文本，可选粘贴）
- 跳过的字段使用占位符，用户可稍后填写。

**非交互模式（无自动调用方）**：
- MUST NOT 提问；基本信息用占位符。
- 用户稍后可独立重跑本技能以补全细节。
- **调用方说明（无自动调用方）**：需求文档桥已随 \`skill-bridge-optimize\` 整体移除；\`iagent_workflow\` / \`iagent_auto_workflow\` / \`iagent_debug\` / \`iagent_spec_propose\` / \`iagent_spec_archive\` / \`iagent_spec_bulk_archive\` MUST NOT 自动调用本技能。本技能只由用户手工调用（standalone 模式）；不再随三父流程自动注入安装。**任何阶段都可手工调用** —— 上述独立模式保持不变。
- 若被外部脚本非交互调用，基本信息用占位符；任何失败 MUST 报错且不写入目标文件。

## Step 3: 读取变更制品

按优先级顺序读取（缺失文件优雅跳过）：

1. \`proposal.md\` / \`design.md\` / \`specs/**/*.md\` —— OpenSpec Markdown 主真源：Why / What Changes / Capabilities / Impact；Context / Goals / Non-Goals / Decisions / Risks；Requirement + Scenario
2. \`tasks.md\`（位于变更目录根）—— 任务分组、页面/表/排期细节
3. **历史 JSON 降级（WARN，仅存量 / 已归档变更）**：历史 \`change.json\` / \`tasks.json\` —— 仅在 Markdown 制品缺失时使用；记 WARN，不影响主流程
4. **文档元信息指纹（可选）**：\`.openspec-tmp/pipeline-<change-name>/handoff-pack.md\` 的 \`sourceFingerprint\` —— 仅当文件存在且其 \`change:\` 与当前变更一致时用于文档元信息块；不可得时写「未提供」，MUST NOT 自行计算

历史 JSON sidecar（\`.iagent/decisions.json\`）已废弃 —— MUST NOT 依赖。

## Step 4: 把内容映射到需求文档章节

| 需求文档章节 | 信息来源 | 转换规则 |
|--------------|----------|----------|
| **基本信息** | 用户交互（独立模式）/ 占位符（非交互模式） | 跳过项用占位符；已填值属人工域（见 Step 7） |
| **评审摘要（无编号）** | proposal + design + 7.7 | 结论 / 范围 / Top3 风险 / 待拍板问题 / 评审要点建议 / 待确认计数（见评审摘要规则） |
| **一、原始需求** | proposal.md → Why + 用户输入 | 合并 why 背景 + 用户提供的原文 |
| **二、需求分析 → 需求理解** | proposal.md + design.md | 按功能场景分组（见场景分组规则），每个场景独立子章节 |
| **二、需求分析 → 非本期范围** | design.md → Non-Goals | 仅填写明确不做、超出边界、无实现计划的内容（有 Phase 计划的功能在场景中呈现） |
| **二、需求分析 → 需求拆解** | proposal.md → What Changes + specs + tasks | 六列表格（含验收标准与来源，见需求拆解规则） |
| **三、技术框架** | design.md（Decisions + Context） | 架构图/组件关系图 + 关键技术决策表格（直接遍历 design.decisions[] 渲染，不做散文推断）+ 接口设计，同一章节呈现完整技术设计 |
| **四、业务流程** | design.md Decisions + Context | decisions → 流程图；context → 流程说明 |
| **五、页面设计** | tasks.md + specs/**/*.md + design.md | 页面变更信息 + 功能设计交互图（仅有页面交互设计时生成） |
| **六、表结构设计** | design.md（数据库设计） + tasks.md | 提取完整 DDL（含建表、索引、序列、预置数据） |
| **七、影响分析** | proposal.md → Impact + design.md → Risks + 全篇缺口 | 7.1–7.5 影响映射；7.6 风险；7.7 待确认集中表（见集中表规则） |
| **八、评审记录** | 结构化骨架 | 评审日期 / 参与人 / 评审结论 / 遗留事项与处置表；整章为人工域 |

**Markdown 优先提取**：从 OpenSpec Markdown 制品读取结构化数据：
- \`design.decisions[]\` → 渲染为「关键技术决策」表，逐条一行，列为：决策编号(id) / 决策项(title) / 选择方案(choice) / 理由(rationale) / 风险(risks)（不做散文推断）
- \`tasks.md\` → 结构化任务数据，用于需求拆解 / 页面设计 / 表结构设计
- \`proposal.capabilities\` + \`specs[].operations[].scenarios\` → capability→scenario 映射，用于场景分组与验收标准
- Markdown 制品缺失 → 回退到历史 JSON，只读（记 WARN）

## Step 5: 技术栈探测（通用规则）

本技能与技术栈无关。MUST NOT 假定特定技术栈：

1. 读取 \`openspec/config.yaml\` 的 \`context\` 字段获取声明的技术栈（如 TypeScript、Java、Python、Go）。
2. 检查项目文件以佐证（package.json、pom.xml、go.mod、Cargo.toml）。
3. 对接口设计（路径格式）、表结构设计（DDL 方言）、页面设计（组件类型）采用与技术栈相符的约定。
4. **不适用章节**：当变更不涉及数据库、UI 页面或接口时，为该章节输出简短的「本变更不涉及」说明。MUST NOT 输出空表格。

## 需求理解 —— 场景分组规则

把 proposal/design 中的功能点归入场景：

| 场景类型 | 识别依据 |
|----------|----------|
| **管理配置场景** | 规则管理、CRUD操作、配置页面、权限控制 |
| **业务使用场景** | 运行时调用、查询/导出/页面展示、API集成 |
| **后台任务场景** | 定时任务、批量处理、异步调度 |
| **AI/智能场景** | AI模式、智能识别、ML/LLM接入、算法预留 |

规则：
- Phase 标注（如 Phase 2/3）仅表示实现时间计划，功能仍应在场景中列出并标注计划时间
- 预留接口/预留能力属于架构设计，应在场景中列出并说明设计意图
- 仅当功能明确不做、超出边界或无实现计划时，才归入「非本期范围」
- 单个场景功能点超过 8 个时拆分为子场景；提案中无实际内容的场景类型不生成
- 功能点描述业务逻辑而非技术细节（不写类名/方法名/字段名），用户视角表达
- 无匹配场景类型时按业务语义归类并注明归类依据

## 评审摘要规则（无编号块）

位置：\`## 基本信息\` 之后、\`## 一、原始需求\` 之前，输出**无编号**「评审摘要」块。全部内容由制品派生，MUST NOT 编造：

- **结论**：取自 \`proposal.md\` 的 Why 目标句与 What Changes 概括，一句话说明本变更要达成什么。
- **范围**：取自 Capabilities 与 Impact 的模块清单，列出受影响的能力 / 模块。
- **风险（Top3）**：取自 7.6 风险表，按制品顺序取前 3 条；等级仅在 \`design.md\` 明示时使用，否则写「未分级」，MUST NOT 自行评级；design 无 Risks 时写 \`[待确认]\`。
- **待拍板问题**：取自 7.7 阻塞项与 \`design.md\` Decisions 中未定的权衡；无则写「无」。
- **评审要点建议**：由风险与待确认项派生，至多 5 条，MUST NOT 复制章节正文。
- **待确认计数**：\`待确认 N 条（阻塞 M 条）\`，取自 7.7 的行数与阻塞数；无缺口时写「待确认 0 条（阻塞 0 条）」。

摘要只放结论与待决策项，细节留在二~七章。

## 需求拆解 —— 验收标准与来源

需求拆解表列为：需求项 / 功能描述 / 优先级 / 类型 / 验收标准 / 来源。

- **验收标准**：优先取自 \`specs/**/*.md\` 的 Requirement / Scenario（WHEN/THEN 语义，可压缩为「WHEN … THEN …」）；\`tasks.md\` 的 \`[测试]\` 任务 MAY 作补充；\`specs/\` 缺失时整列标 \`[待确认]\`，MUST NOT 编造。
- **来源**：使用短 ID 形式 —— \`proposal:WC2\`（What Changes 第 2 项）/ \`spec:<cap>:S1\`（能力名与场景序号）/ \`task:T3.2\`（任务编号），MUST NOT 使用完整路径或仅章节名。
- **无 specs 降级**：验收标准列全部标 \`[待确认]\`，覆盖自检跳过并记 WARN；该缺口计入 7.7 与摘要待确认计数。

## 风险与待确认集中表

七、影响分析 MUST 含以下两小节：

### 7.6 风险

映射 \`design.md\` 的 Risks（风险与缓解两列），列为「风险 / 缓解 / 等级」：
- 等级仅在 \`design.md\` 明示时填写，否则写「未分级」，MUST NOT 自行评级。
- design 无 Risks 时写「制品未声明风险」，摘要风险等级标 \`[待确认]\`。

### 7.7 待确认

集中列出全篇缺口与阻塞性，列为「缺口 / 所在章节 / 阻塞性 / 处置建议」：
- 阻塞性只能标「阻塞」或「不阻塞」，依据是否阻断实现或评审拍板。
- 待确认项多于 10 条时表格 MUST 完整列出，MUST NOT 截断；摘要只显示计数与阻塞数。

## 人工域定义

下列内容为人工域，重生成时必须逐字保留（详见 Step 7）：
- \`## 基本信息\` 表中已填写的值（占位符不视为已填值）。
- \`## 八、评审记录\` 整章，保留至**文件末尾**（八为最后一章，自定义子小节一并保留）。

生成元信息块、评审摘要与一~七章均为派生内容，重生成时随制品刷新，MUST NOT 归入人工域。

## 图表生成规则

对以下内容使用 ASCII 框线与箭头字符（\`┌ ┐ └ ┘ ──▶ ▼\`）：
- **业务流程图**：来自 design.decisions + design.context
- **功能设计交互图**：仅当 design/tasks 中存在页面交互流程时
- **技术框架图**：仅当设计章节包含架构设计时

制品中没有对应设计时省略图表小节。节点用业务语义命名，而非文件名。在箭头上标注触发/条件。

## 伪代码注入规则

仅当表格或流程图无法表达判定逻辑时，才向二、需求分析、三、技术框架、四、业务流程章节注入语言无关的中文伪代码：

- **语法**：使用 \`\`\`pseudocode 围栏块，采用语言无关的构造（IF/THEN/ELSE/END IF/FOR EACH）与中文业务语义的 object.attribute 表达式（如 \`IF 规则.名称为空 THEN 返回错误("名称必填")\`）
- **位置**：块紧跟在对应的表、图或决策点之后；首行注释标注来源章节（如 \`// 来源: design.decisions #2\`），便于评审追溯
- **标识符约束**：MUST NOT 使用真实类名、方法名或字段名 —— 只用中文业务语义
- **缺口处理**：骨架可推导但分支/条件细节缺失时，就地用 **[待确认]** 标注缺失细节（与 DDL 规则一致）；某章节制品无可推导逻辑时不输出伪代码块，也不留空块
- **上限**：≤2 块/文档、≤12 行/块；超出时只保留最高优先级逻辑 —— 多分支决策优先，核心算法/数据流次之
- **跳过规则**：对周围正文或表格已清晰表达的决策点，不生成伪代码

## DDL 提取规则

- **主来源**：design.decisions → 数据库设计决策（完整的 CREATE TABLE、索引、序列、预置数据）
- **补充**：tasks.md → 数据库变更任务分组（表名、用途、变更类型）
- 使用与探测到的技术栈相符的方言；MUST NOT 杜撰制品中不存在的表或列 —— 缺口标 **[待确认]**
- 从提取的 DDL 生成涉及表汇总表

## Step 6: 生成文档

输出结构（Markdown）：

\`\`\`\`markdown
# 需求文档: {变更名称}

> **生成元信息**（生成器独占，非人工域，重生成时刷新）
> - 生成时间：YYYY-MM-DD HH:mm
> - 来源变更：{change-name}
> - 制品指纹：{sourceFingerprint 或「未提供」}
> - 文档版本：v1

## 基本信息
| 项目 | 内容 |
|------|------|
| 需求编号 | REQ-YYYY-XXX 或占位符 |
| 需求名称 | {功能名称} |
| 交付时间 | YYYY-MM-DD 或占位符 |

## 评审摘要
- **结论**：{Why 目标句 + What Changes 概括}
- **范围**：{Capabilities + Impact 模块清单}
- **风险（Top3）**：{7.6 前 3 条及等级；无则 [待确认]}
- **待拍板问题**：{7.7 阻塞项 + 未定决策权衡；无则「无」}
- **评审要点建议**：{至多 5 条派生要点}
- **待确认**：{N} 条（阻塞 {M} 条）

## 一、原始需求
{需求单原文 / proposal Why 背景}

## 二、需求分析
### 需求理解
{整体概述}
#### 场景一: {场景名称}
{一句话核心目标}
需要实现的功能点：
- {功能点}: {功能说明，涉及模块}

### 非本期范围
| 范围项 | 说明 | 原因 |

### 需求拆解
| 需求项 | 功能描述 | 优先级 | 类型 | 验收标准 | 来源 |
|--------|----------|--------|------|----------|------|
| {功能项} | {功能描述} | 高/中/低 | 新增/修改 | WHEN … THEN … 或 [待确认] | proposal:WC2 / spec:<cap>:S1 / task:T3.2 |

## 三、技术框架
### 3.1 总体技术框架 {架构图，如有}
### 3.2 关键技术决策
| 决策点 | 选择方案 | 原因 |
### 3.3 接口设计 {如有}

## 四、业务流程
### 流程图
### 流程说明
| 步骤 | 操作说明 | 异常处理 |

## 五、页面设计
{本变更不涉及 或 页面/交互信息}

## 六、表结构设计
{本变更不涉及 或 涉及表 + DDL}

## 七、影响分析
### 7.1 模块影响
### 7.2 客户影响
### 7.3 调度影响
### 7.4 兼容性影响
### 7.5 无影响项
### 7.6 风险
| 风险 | 缓解 | 等级 |
|------|------|------|
| {design Risks 行} | {缓解措施} | 未分级 / design 明示等级 |

### 7.7 待确认
| 缺口 | 所在章节 | 阻塞性 | 处置建议 |

## 八、评审记录
| 项目 | 内容 |
|------|------|
| 评审日期 | YYYY-MM-DD 或占位符 |
| 参与人 | 占位符 |
| 评审结论 | 通过 / 有条件通过 / 不通过 |

### 遗留事项与处置
| 序号 | 遗留事项 | 处置方式 | 责任人 | 状态 |
|------|----------|----------|--------|------|
\`\`\`\`

## 输出路径 —— 按 Step 1 记录的归档状态路由

| 变更位置 | 输出路径 |
|-----------------|-------------|
| 活跃变更目录 \`openspec/changes/{change-name}/\` | \`openspec/changes/{change-name}/需求文档.md\` |
| 已归档变更目录 \`openspec/changes/archive/{date}-{change-name}/\` | \`openspec/devdocs/{date}-{change-name}-需求文档.md\` |
| 含 archive 段的用户指定路径 | \`openspec/devdocs/{date}-{change-name}-需求文档.md\` |
| 不含 archive 段的用户指定路径 | 提案文件所在目录下的 \`需求文档.md\` |

路由规则：
- \`{date}\` 前缀与归档命令的目录命名逻辑一致（\`YYYY-MM-DD-\`）；从归档目录名解析
- 归档目录名没有可解析的 \`YYYY-MM-DD-\` 前缀时，回退到不带时间戳的 \`openspec/devdocs/{change-name}-需求文档.md\`
- 目标目录缺失时创建（devdocs 或变更目录），使用 \`path.join()\`

## Step 7: 写出文档与人工域保护

1. **目标不存在**：直接写出 Step 6 生成的完整文档。
2. **目标已存在**：先解析人工域，按增量对齐方式重建后写入。
   - 解析 \`## 基本信息\` 表：逐行取「项目 / 内容」；占位符不保留（按未填写处理），缺失的行按占位符处理。
   - 解析 \`## 八、评审记录\`：从该标题起逐字保留至**文件末尾**（八为最后一章），含自定义子小节。
   - 按当前制品重建评审摘要与一~七章，回填人工域后写出。
   - 生成元信息块由生成器独占，重生成时刷新，MUST NOT 从人工域恢复。
3. **解析失败不写入**：人工域表格破损或章节缺失时，MUST NOT 写入目标文件；保留原文件并报告期望路径与解析失败原因。
4. **写入失败**：目标文件只读或写入发生 IO 错误时，保留原文件并报错，MUST NOT 声称生成成功。
5. **幂等**：除生成时间外，重复运行产出内容一致；生成时间变化 MUST NOT 视为内容漂移。

## 产出校验

生成后检查：
- [ ] 文档结构完整（基本信息 + 评审摘要 + 8 个编号章节）
- [ ] 评审摘要位于基本信息之后、一、原始需求之前，六个字段齐全且可追溯至制品
- [ ] 需求拆解表含「验收标准」「来源」列，无 specs 时验收标准整列 [待确认]
- [ ] 风险与待确认集中表（7.6 / 7.7）完整，等级未自行评级，超过 10 条未截断
- [ ] 人工域保留正确（重生成路径）：基本信息已填值与八、评审记录全文回填
- [ ] 伪代码按需使用且符合上限（≤2 块/文档、≤12 行/块）
- [ ] 需求理解按功能场景分组，功能点描述关注业务逻辑并标注 Phase 计划
- [ ] 非本期范围仅含明确不做/超出边界的内容
- [ ] 无内容章节输出「本变更不涉及」而非空表格
- [ ] 图表使用 ASCII 字符可正确渲染
- [ ] 文件保存至按归档状态判定的输出路径成功

**Guardrails**
- MUST NOT 杜撰制品中不存在的数据库表、API 端点或业务规则 —— 标 **[待确认]**
- 伪代码只能重述制品中已有的逻辑 —— MUST NOT 杜撰分支或条件；推导缺口标 **[待确认]**
- 非交互模式：MUST NOT 提问；基本信息用占位符；失败 MUST 报错且不写入
- 生成或写入失败 MUST 报错并保留原文件，MUST NOT 降级为告警或声称生成成功
- 所有文件路径使用 \`path.join()\``,
        allowedTools: 'Read, Write, Edit, Glob, Grep, Bash(iagent:*)',
        type: 'docs',
        license: 'MIT',
        compatibility: '纯文件读取与生成，无 CLI 硬依赖（iagent spec status 为可选加载方式）；支持独立交互与外部脚本非交互调用双模式。',
        metadata: { author: 'mi-agent-tools' },
    };
}

export function getRequirementDocCommandTemplate(): CommandTemplate {
    return {
        name: 'iAgent: 需求文档生成',
        description: '变更提案（proposal/design/tasks/specs）转八章节评审需求文档',
        category: 'iAgent / 文档',
        tags: ['iagent', 'docs', 'requirement-doc', 'documentation', 'review'],
        content: deriveCommandContent(getRequirementDocSkillTemplate().instructions),
    };
}
