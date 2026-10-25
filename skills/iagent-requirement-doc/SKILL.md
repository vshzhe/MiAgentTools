---
name: iagent-requirement-doc
description: "把变更制品（proposal.md / design.md / specs/**/*.md + tasks.md）转换为标准八章节需求文档（requirement document）供人工评审。当用户要生成需求文档 / 需求单 / 转换提案为需求文档时使用；触发词\"需求文档 / requirement document / 需求单 / 提案转文档\"；NOT for 扫描源项目生成迁移需求文档——那用 iagent_feature_doc。"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(iagent:*)
license: MIT
compatibility: 纯文件读取与生成，无 CLI 硬依赖（iagent spec status 为可选加载方式）；支持独立交互与非交互工作流集成双模式。
metadata:
  author: mi-agent-tools
  type: docs
  generatedBy: "snapshot"
  generatedFingerprint: "sha256:f30ab61a7776810f22c937db8930b7cde75c77928343cd885f5bbd6ce7525c26"
---

**适用项目护栏（impl 域蒸馏，见 .iagent/rules/coding-rules.md）。** 未定义项标 **[待确认]**，禁止猜测。

把 OpenSpec 变更提案转换为标准需求文档，供人工评审。

**输入**：`/iagent:requirement-doc` 后可指定变更名（如 `/iagent:requirement-doc add-auth`）；若省略，则判断能否从对话上下文推断；若仍有歧义，询问用户。

---

## Step 1: 定位变更提案文件

按顺序查找：

1. **活跃变更目录**：`openspec/changes/{change-name}/`
2. **已归档变更目录**：`openspec/changes/archive/{date}-{change-name}/`
3. **用户指定路径**

变更名未知时询问用户。所有路径使用 `path.join()`（跨平台）。可选地运行 `iagent spec status --json` 枚举活跃变更（CLI 降级：命令不可用时回退到上述目录查找）。

记录找到提案文件所在位置的归档状态 —— 它决定 Step 6 的输出路径：活跃（位于 `openspec/changes/` 下）、已归档（位于 archive 目录下，或包含 archive 段的用户指定路径）、或不含 archive 段的用户指定路径。

## Step 2: 选择执行模式

**独立模式（直接调用时的默认模式）**：
- 使用 **AskUserQuestion 工具**交互式收集基本信息 —— 每个问题都可跳过：
  - 需求编号（格式：REQ-YYYY-XXX）
  - 需求名称
  - 交付时间（格式：YYYY-MM-DD）
  - 原始需求（原始需求文本，可选粘贴）
- 跳过的字段使用占位符，用户可稍后填写。

**非交互模式（由工作流调用时）**：
- MUST NOT 提问。
- 使用 Markdown 格式，基本信息用占位符。
- 用户稍后可独立重跑本技能以补全细节。
- **调用方说明（自动调用方为验证阶段 + 归档）**：自动调用本技能的工作流是验证阶段（`iagent_auto_workflow` Phase 3 / `iagent_workflow` Phase 3.5）与归档阶段（`iagent_spec_archive` 归档前检查点步骤 4.8，及其在 `iagent_spec_bulk_archive` 中的并行步骤）。`iagent_debug` MUST NOT 调用本技能。**任何阶段都可手工调用** —— 下述独立模式保持不变。

## Step 3: 读取变更制品

按优先级顺序读取（缺失文件优雅跳过）：

1. `proposal.md` / `design.md` / `specs/**/*.md` —— OpenSpec Markdown 主真源：Why / What Changes / Capabilities / Impact；Context / Goals / Non-Goals / Decisions / Risks；Requirement + Scenario
2. `tasks.md`（位于变更目录根）—— 任务分组、页面/表/排期细节
3. **历史 JSON 降级（WARN，仅存量 / 已归档变更）**：历史 `change.json` / `tasks.json` —— 仅在 Markdown 制品缺失时使用；记 WARN（非阻断）

历史 JSON sidecar（`.iagent/decisions.json`）已废弃 —— MUST NOT 依赖。

## Step 4: 把内容映射到需求文档章节

| 需求文档章节 | 信息来源 | 转换规则 |
|--------------|----------|----------|
| **基本信息** | 用户交互（独立模式）/ 占位符（非交互模式） | 跳过项用占位符 |
| **一、原始需求** | proposal.md → Why + 用户输入 | 合并 why 背景 + 用户提供的原文 |
| **二、需求分析 → 需求理解** | proposal.md + design.md | 按功能场景分组（见场景分组规则），每个场景独立子章节 |
| **二、需求分析 → 非本期范围** | design.md → Non-Goals | 仅填写明确不做、超出边界、无实现计划的内容（有 Phase 计划的功能在场景中呈现） |
| **二、需求分析 → 需求拆解** | proposal.md → What Changes | 功能项 → 需求拆解表格；复杂业务规则按伪代码注入规则补充伪代码块 |
| **三、技术框架** | design.md（Decisions + Context） | 架构图/组件关系图 + 关键技术决策表格（直接遍历 design.decisions[] 渲染，不做散文推断）+ 接口设计，同一章节呈现完整技术设计；算法/数据流转/接口逻辑按伪代码注入规则补充伪代码块 |
| **四、业务流程** | design.md Decisions + Context | decisions → 流程图；context → 流程说明；流程判定逻辑按伪代码注入规则补充伪代码块 |
| **五、页面设计** | tasks.md + specs/**/*.md + design.md | 页面变更信息 + 功能设计交互图（仅有页面交互设计时生成） |
| **六、表结构设计** | design.md（数据库设计） + tasks.md | 提取完整 DDL（含建表、索引、序列、预置数据） |
| **七、影响分析** | proposal.md → Impact | 直接映射模块/客户/调度影响 |
| **八、评审记录** | 空模板 | 待评审后填写 |

**Markdown 优先提取**：从 OpenSpec Markdown 制品读取结构化数据：
- `design.decisions[]` → 渲染为「关键技术决策」表，逐条一行，列为：决策编号(id) / 决策项(title) / 选择方案(choice) / 理由(rationale) / 风险(risks)（不做散文推断）
- `tasks.md` → 结构化任务数据，用于需求拆解 / 页面设计 / 表结构设计
- `proposal.capabilities` + `specs[].operations[].scenarios` → capability→scenario 映射，用于场景分组
- Markdown 制品缺失 → 回退到历史 JSON，只读（WARN，非阻断）

## Step 5: 技术栈探测（通用规则）

本技能与技术栈无关。MUST NOT 假定特定技术栈：

1. 读取 `openspec/config.yaml` 的 `context` 字段获取声明的技术栈（如 TypeScript、Java、Python、Go）。
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

## 图表生成规则

对以下内容使用 ASCII 框线与箭头字符（`┌ ┐ └ ┘ ──▶ ▼`）：
- **业务流程图**：来自 design.decisions + design.context
- **功能设计交互图**：仅当 design/tasks 中存在页面交互流程时
- **技术框架图**：仅当设计章节包含架构设计时

制品中没有对应设计时省略图表小节。节点用业务语义命名，而非文件名。在箭头上标注触发/条件。

## 伪代码注入规则

当制品含可推导逻辑时，向二、需求分析、三、技术框架、四、业务流程章节注入语言无关的中文伪代码，使复杂规则更易评审：

- **语法**：使用 ```pseudocode 围栏块，采用语言无关的构造（IF/THEN/ELSE/END IF/FOR EACH）与中文业务语义的 object.attribute 表达式（如 `IF 规则.名称为空 THEN 返回错误("名称必填")`）
- **位置**：块紧跟在对应的表、图或决策点之后；首行注释标注来源章节（如 `// 来源: design.decisions #2`），便于评审追溯
- **标识符约束**：MUST NOT 使用真实类名、方法名或字段名 —— 只用中文业务语义
- **缺口处理**：骨架可推导但分支/条件细节缺失时，就地用 **[待确认]** 标注缺失细节（与 DDL 规则一致）；某章节制品无可推导逻辑时不输出伪代码块，也不留空块
- **长度上限**：每块至多 15 行，每章节至多 3 块；超出时只保留最高优先级逻辑 —— 多分支决策逻辑优先，核心算法/数据流次之，循环/批量处理再次
- **跳过规则**：对周围正文或表格已清晰表达的决策点，不生成伪代码

## DDL 提取规则

- **主来源**：design.decisions → 数据库设计决策（完整的 CREATE TABLE、索引、序列、预置数据）
- **补充**：tasks.md → 数据库变更任务分组（表名、用途、变更类型）
- 使用与探测到的技术栈相符的方言；MUST NOT 杜撰制品中不存在的表或列 —— 缺口标 **[待确认]**
- 从提取的 DDL 生成涉及表汇总表

## Step 6: 生成文档

输出结构（Markdown）：

````markdown
# 需求文档: {变更名称}

## 基本信息
| 项目 | 内容 |
|------|------|
| 需求编号 | REQ-YYYY-XXX 或占位符 |
| 需求名称 | {功能名称} |
| 交付时间 | YYYY-MM-DD 或占位符 |

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
| 需求项 | 功能描述 | 优先级 | 类型 |

```pseudocode
// 来源: proposal.whatChanges — 仅有可推导的复杂业务规则时生成
FUNCTION 校验输入(表单数据)
    IF 表单数据.名称为空 THEN 返回错误("名称必填")
    IF 表单数据.类型 NOT IN 支持类型列表 THEN 返回错误("类型不支持")
END FUNCTION
```

## 三、技术框架
### 3.1 总体技术框架 {架构图，如有}
### 3.2 关键技术决策
| 决策点 | 选择方案 | 原因 |
### 3.3 接口设计 {如有}

```pseudocode
// 来源: design.decisions #N — 核心算法/数据流转逻辑
FOR EACH 记录 IN 待处理数据集
    IF 记录.状态 = "已变更" THEN 加入同步队列
END FOR
```

## 四、业务流程
### 流程图
### 流程说明
| 步骤 | 操作说明 | 异常处理 |

```pseudocode
// 来源: design.context — 流程判定逻辑
IF 变更目录已存在 THEN
    走更新分支（追加缺失文档）
ELSE
    创建新变更目录
END IF
```

## 五、页面设计
{本变更不涉及 或 页面/交互信息}

## 六、表结构设计
{本变更不涉及 或 涉及表 + DDL}

## 七、影响分析
### 模块影响 / 客户影响 / 调度影响 / 无影响项

## 八、评审记录
> **评审状态**: 待评审
````

**输出路径** —— 按 Step 1 记录的归档状态路由：

| 变更位置 | 输出路径 |
|-----------------|-------------|
| 活跃变更目录 `openspec/changes/{change-name}/` | `openspec/changes/{change-name}/需求文档.md` |
| 已归档变更目录 `openspec/changes/archive/{date}-{change-name}/` | `openspec/devdocs/{date}-{change-name}-需求文档.md` |
| 含 archive 段的用户指定路径 | `openspec/devdocs/{date}-{change-name}-需求文档.md` |
| 不含 archive 段的用户指定路径 | 提案文件所在目录下的 `需求文档.md` |

路由规则：
- `{date}` 前缀与归档命令的目录命名逻辑一致（`YYYY-MM-DD-`）；从归档目录名解析
- 归档目录名没有可解析的 `YYYY-MM-DD-` 前缀时，回退到不带时间戳的 `openspec/devdocs/{change-name}-需求文档.md`
- 目标目录缺失时创建（devdocs 或变更目录），使用 `path.join()`
- 目标文件已存在时静默覆盖 —— 重新生成是幂等的，MUST NOT 因提问阻塞
- **此静默覆盖规则是有意为之，MUST NOT 弱化**：保护人工撰写内容是用**调用方**的职责。可能面对已评审文档的调用方（归档检查点）MUST 自行探测已存在文件，改走就地对齐分支，而非调用本技能 —— 见 `iagent_spec_archive` 步骤 4.8。因此本技能保持为纯粹的「产出文档」原语。

## 产出校验

生成后检查：
- [ ] 文档结构完整（基本信息 + 8 个编号章节）
- [ ] 需求理解按功能场景分组，每个场景含场景描述句和功能点列表
- [ ] 功能点描述关注业务逻辑，Phase 计划功能已标注
- [ ] 非本期范围仅含明确不做/超出边界的内容
- [ ] 需求拆解表格与场景功能点对应一致
- [ ] 无内容章节输出「本变更不涉及」而非空表格
- [ ] 图表使用 ASCII 字符可正确渲染
- [ ] 伪代码块使用 ```pseudocode 语法且块首标注 artifacts 来源
- [ ] 伪代码无真实类名/方法名/字段名（语言无关中文业务语义）
- [ ] 伪代码行数（≤15 行/块）与块数（≤3 块/章节）符合上限
- [ ] 伪代码缺失细节处已标 **[待确认]**，无虚构逻辑
- [ ] 文件保存至按归档状态判定的输出路径成功

**Guardrails**
- MUST NOT 杜撰制品中不存在的数据库表、API 端点或业务规则 —— 标 **[待确认]**
- 伪代码只能重述制品中已有的逻辑 —— MUST NOT 杜撰分支或条件；推导缺口标 **[待确认]**
- 非交互模式（工作流集成）：绝不因提问阻塞；使用占位符
- 工作流集成下的生成失败为非阻断：记 WARNING，用户可独立重跑
- 所有文件路径使用 `path.join()`
