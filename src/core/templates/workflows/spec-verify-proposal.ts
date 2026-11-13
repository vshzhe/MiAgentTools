/**
 * spec 类型技能模板：提案验证门（实现前量化评分）。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { deriveCommandContent } from '../derive-command.js';
import { renderGateWhitelistSection } from '../prompt-gate.js';

const CONDITIONAL_DIMENSIONS_FULL = `### Dimension 6: 交互细节完整性 [由前端关键词自动触发]

**Trigger**：在 design.md 或 specs/**/*.md 中检测到前端关键词。

**Check**：design.md 包含标准化的交互细节矩阵分节：
- **字段-UI组件映射矩阵**：把每个数据字段映射到 UI 组件、校验规则与交互行为
- **API 交互契约**：每个端点 —— Method、URL、Request/Response、错误码
- **数据库表-字段映射**：每张表 —— 列名、类型、约束、默认值、业务含义
- **UI 状态覆盖**：每个数据展示组件 —— Loading/Empty/Error/Data 状态

**PASS 条件**：
- 四个矩阵分节齐备且已填充（不是空表模板）
- 每个分节至少有一行具体数据
- 覆盖率 ≥ 70%

**覆盖率计算**：
\`\`\`
D6 Score = (populated sections / 4) * 100%
Each section counts fully populated if it has ≥ 1 non-placeholder row
\`\`\`

**存量处理**（向后兼容）：
- 若 design.md 不含交互细节矩阵分节（检查分节标题）：
  - 报告 WARNING（而非 FAIL）："交互细节矩阵缺失。建议补充以提升实现质量。"
  - WARNING 不阻断 apply 工作流
- 若 design.md 含这些分节但内容不完整（新变更）：
  - 报告 FAIL（阻断 apply）："交互细节矩阵不完整。请补充缺失内容。"

**FAIL 示例**：
- "D6 FAIL: 字段-UI组件映射矩阵为空 —— 需要列出字段与组件的对应关系"
- "D6 WARNING: 交互细节矩阵缺失。建议补充以提升实现质量。"

**FAIL 处理**：
> 交互细节矩阵缺失或不完整。
> [1] 在 design.md 补充交互细节 [2] 确认有意跳过 [3] 返回设计阶段

### Dimension 7: API 契约完整性 [由 API 关键词自动触发]

**Trigger**：在 design.md 或 specs/**/*.md 中检测到 API 关键词。

**Check**：design.md 中列出的每个 API 端点都有完整契约定义：
- Method（GET/POST/PUT/DELETE）
- URL 路径
- 带类型的 Request body/params
- 带类型的 Response body 结构
- 错误码（至少：200、400、404、500）

**PASS 条件**：
- ≥ 80% 的已检测端点有完整契约
- 每个端点包含：Method、URL、Request、Response，至少 2 个错误码

**覆盖率计算**：
\`\`\`
D7 Score = (endpoints with complete contracts / total endpoints) * 100%
\`\`\`

**存量处理**：
- 若 design.md 未找到 API 契约分节：WARNING，而非 FAIL
- WARNING 提示："API 交互契约缺失。建议补充端点定义。"

**FAIL 示例**：
- "D7 FAIL: POST /api/v1/orders 缺少 Response body 定义"
- "D7 WARNING: API 交互契约缺失。建议补充端点定义。"

### Dimension 8: 数据库映射完整性 [由 DB 关键词自动触发]

**Trigger**：在 design.md 或 specs/**/*.md 中检测到数据库关键词。

**Check**：每个被引用的数据库表都有完整字段映射：
- 字段名
- 类型（VARCHAR、INT 等）
- 约束（NOT NULL、UNIQUE 等）
- 默认值
- 业务含义

**PASS 条件**：
- ≥ 80% 的已检测表有完整字段映射
- 每个字段至少包含：名称、类型、约束

**覆盖率计算**：
\`\`\`
D8 Score = (tables with complete mappings / total tables) * 100%
\`\`\`

**存量处理**：
- 若未找到 DB 映射分节：WARNING，而非 FAIL
- WARNING 提示："数据库表-字段映射缺失。建议补充字段定义以避免实现时猜测。"

**FAIL 示例**：
- "D8 FAIL: orders 表字段定义不完整 —— amount 字段缺少类型和约束"
- "D8 WARNING: 数据库表-字段映射缺失。建议补充字段定义以避免实现时猜测。"

### Dimension 9: 业务步骤完整性 [由业务关键词自动触发]

**Trigger**：在 design.md 或 specs/**/*.md 中检测到业务流程关键词。

**Check**：tasks.md 中的复杂业务操作（3 步以上或含条件分支）有显式步骤拆解：
- 步骤按顺序编号
- 每个步骤标注执行层 [前端]/[后端]/[API]/[DB]
- 每个步骤记录异常路径
- 标注事务边界

**PASS 条件**：
- ≥ 80% 的已检测复杂操作有步骤拆解
- 每份拆解包含：编号步骤、层级标注、异常路径

**覆盖率计算**：
\`\`\`
D9 Score = (complex ops with decomposition / total complex ops) * 100%
\`\`\`

**存量处理**：
- 若未检测到复杂操作：标记为 "不适用"，跳过
- 若检测到复杂操作但未拆解：FAIL（无 WARNING —— 这是新行为）
- FAIL 提示："复杂业务操作 X 需要步骤拆解。请添加前端→API→后端→DB 步骤标注。"

**FAIL 示例**：
- "D9 FAIL: 用户下单流程 (4步骤, 含事务) 未拆解 —— 需要标注执行层和异常路径"

### Dimension 10: 功能流程图节点覆盖度 [由 功能流程图 段自动触发]

**Trigger**：探索产物 \`exploration.md\` 含 \`## 功能流程图\` 段时触发（该段由探索阶段产出并经流程最终确认门确认）。

**Check**：\`## 功能流程图\` 段的**关键操作节点清单**中的每个节点，是否被 \`design\` 段（节点清单引用 / 关键操作节点描述）或 \`tasks.md\`（任务标注的节点 id）覆盖
—— 检查提案与**外部流程基准**的偏差，而非提案自身的完整性（JSON 缺失降级 MD 解析时按对应 MD 制品读取，WARN）。

**覆盖率计算**：
\`\`\`
D10 Score = (被 design/tasks 覆盖的节点数 / 流程图总节点数) * 100%
\`\`\`

**覆盖判定（两级，优先显式标注）**:
1. **显式标注匹配（优先，可复现）**：\`tasks.md\` 任务标注了对应节点 id（\`[N4]\` 形）即视为该节点被覆盖；\`design\` 段显式引用该节点 id 或节点操作名亦计入
2. **语义等价判定（补充）**：节点未被显式标注时，MAY 以 AI **语义等价判定**补充 —— 同一操作的**不同措辞**算命中（如节点"扣减库存"与任务"库存预占"视为同一操作）；
   语义判定 MUST 能指出具体对应之处，MUST NOT 笼统放行

**PASS 条件**：覆盖度 ≥ 90%（与统一阈值一致）。

**纳入既有总分（triggered 集合）**：本维度纳入既有总分公式的 \`triggered\` 集合，与 D1-D5 核心维度、D6-D10 条件维度**同权重**参与平均分：
\`Overall Score = (D1 + … + D5 + sum(triggered)) / (5 + triggered_count)\`。既有核心+条件维度累加的算法核心与公式本身 MUST NOT 被本维度改动。

**与 D9 的职责分离（自证与他证）**：D9（Business Steps）检查提案**自身**是否拆解复杂操作（**自证**，SHALL 保留不动，MUST NOT 被本维度替换或缩窄）；
本维度检查提案与**外部流程基准**（经用户确认的功能流程图）的偏差（**他证**）。两者互补：D9 查"是否拆了"，本维度查"是否拆对 / 拆全"。

**缺失处理（SKIP，向后兼容）**：无 \`## 功能流程图\` 段（含该段存在但**未获用户确认**）时，本维度 SHALL 标 **SKIP** 并从总分**分母中排除**（不计入 \`triggered_count\`），
MUST NOT 按 0 分拉低总分、MUST NOT 据此判 FAIL —— 保证归档期既有变更、纯文档 / 纯配置变更不被误伤。

**FAIL 输出（偏差可定位）**：本维度低于阈值时，报告 MUST **逐条列出未被 design/tasks 覆盖的节点标识与操作名**（如 \`N5 分批查询 — 无对应任务\`），
使偏差定位到具体节点，MUST NOT 仅给出覆盖度百分比。

**只读约束**：本维度为**只读评分** —— 本技能 \`allowedTools\` 为 \`Read, Glob, Grep, Bash(iagent:*)\`（无 Write/Edit），MUST NOT 要求本技能自行编辑 design.md / specs/**/*.md / tasks.md 修复；
修复建议仅呈现给调用方，由 propose 阶段或用户处置。

**FAIL 示例**：
- "D10 FAIL: 节点 N5 分批查询 未被 design/tasks 覆盖（覆盖度 83% = 5/6）"

---

`;

const IMPACT_CONSISTENCY_FULL = `# 影响范围一致性检查细则（提案验证门）

> 本文件是「影响面制品存在性判定」（流程节点 N3）与「影响范围一致性检查」（流程节点 N5，并入 D2/D3）的细则展开。主 SKILL 正文是唯一执行顺序；冲突时以主文件为准。

## 1. 存在性判定矩阵（N3）

| 制品 | 判定锚点 | 缺失处置 |
| :--- | :--- | :--- |
| \`proposal.md\` 影响面 | \`## Impact\` 下影响面分析小节（影响面分析 / Impact Analysis） | 检查点 SKIP 排除分母 |
| \`design.md\` 影响面 | \`## Context\` 下架构影响小节（架构影响 / Architecture Impact） | 同上 |
| \`tasks.md\` 影响面 | \`### Caller Updates\` 小节 | 同上 |

- 判定以**小节标题锚点**为准；语义等价标题（不同措辞指向同一内容）MAY 计为存在，MUST 能指出对应之处，拿不准标「待验证」且 MUST NOT 据此判 FAIL
- 生成侧来源：三制品由 workflow / auto-workflow 影响分析产出；独立 \`iagent-spec-propose\` 路径可能无影响面小节 —— 属「影响分析未触发」，合法 SKIP
- 存量 JSON-only 降级（Markdown 缺失且仅有历史 \`change.json\` / \`tasks.json\`）→ SKIP + WARN，不阻断评分，验证报告注明

## 2. 对齐核查规则（N5）

| # | 对齐关系 | 核查内容 | 不一致判据 |
| :--- | :--- | :--- | :--- |
| 1 | proposal Impact ↔ design 架构影响 | Impact 声明的影响模块在架构影响小节有对应描述 | 模块名无对应或描述矛盾 |
| 2 | proposal Impact ↔ tasks 承接 | 每个影响模块在 tasks 有对应任务（Caller Updates 条目或直接改动该模块的任务） | 模块无任何任务承接 |
| 3 | design 架构影响 ↔ specs 范围 | 架构影响声明与 specs 能力范围一致 | 声明越出 specs 覆盖范围 |

- **语义等价**：模块措辞不同但指向同一目标 MAY 计为对齐（如「库存服务」与「inventory 模块」），MUST 指出具体对应之处，MUST NOT 笼统放行
- **只报能定位的偏差**：每条不一致输出「模块名 + 断裂点（tasks 缺承接 / design 矛盾 / specs 越界）」，MUST NOT 仅给出百分比

## 3. 评分并入与处置（D2/D3）

| 情形 | 处置 |
| :--- | :--- |
| 三制品均存在且全部对齐 | 影响范围一致性 PASS；D2/D3 评分计入该结论（报告标注各制品对齐状态） |
| 三制品均存在但任一脱节 | 计入评分 **FAIL**，逐条列出偏差模块 |
| 任一制品缺失（影响分析未触发） | 检查点 **SKIP**，从总分分母排除（不计入 triggered_count），MUST NOT 按 0 分拉低总分、MUST NOT 判 FAIL |
| 存量 JSON-only 降级 | **SKIP + WARN**（注明降级原因），验证报告注明该处置 |

- 缺失处置与 D10 缺失处理（SKIP 排除分母）同构：缺失向后兼容，脱节才惩罚
- 本检查点为**只读评分**（本技能无 Write/Edit），修复建议仅呈现给调用方，由 propose 阶段或用户处置
`;

export function getSpecVerifyProposalSkillTemplate(): SkillTemplate {
    return {
        name: 'iagent_spec_verify_proposal',
        description: '提案验证门。在变更提案生成后、实现开始前，对制品做量化评分（D1-D5 核心维度 + D6-D10 条件维度，统一 90% 阈值），检测技术栈并按需执行技术特定检查，通过后可做内联只读深度复查。用于确保提案质量后再进入实现。触发词"提案验证 / verify proposal / 评分门 / D1-D10"；NOT for 实现完成后的实现验证（改用 iagent_spec_verify）。',
        allowedTools: 'Read, Glob, Grep, Bash(iagent:*)',
        type: 'spec',
        instructions: `**验证前先阅读 .iagent/rules/coding-rules.md 中的验证标准。**

实现前，对照探索结果验证制品。

本技能执行增强的 10 维度验证，含量化评分与技术栈检测。

**输入**：待验证评分的变更名称（kebab-case，可选）。

${renderGateWhitelistSection()}

**只读验证步骤无需确认即可执行**：读取制品、扫描文件、CodeGraph 查询与 D1-D10 评分分析直接运行，无需中途确认提示。仅验证报告（以及真正属于用户决策的选择，例如 FAIL 判定后选择修复路径）呈现给用户。

---

## 执行方式与复验（强制）

- 默认由**主 agent 内联**执行，回执声明 executionMode=inline / independence=self（self 记 WARN；可信度由逐项检查清单 + 每条 \`文件:行\` 证据 + 报告落盘承担，MUST NOT 要求非作者）。**无证据的结论 MUST NOT 计入通过**。
- 兼容窗内旧的 subagent 回执记 deprecation WARN 并允许推进（下个 major 收紧为仅 inline）。
- 回执 SHALL 含 executionMode / independence / readScope / dependsOn；inline 阶段不要求 delegate。
- **增量复验**：FAIL 修复后在同一主上下文按 fixDiff + 上轮 reportPath + 检查清单增量重跑；禁止新开验证代理或全量重读；禁止以 resume 充当复验（contextReplay=true 记 WARN）。

## 前置条件

**必需文件**：
- \`openspec/changes/<change-name>/proposal.md\` / \`design.md\` / \`specs/**/*.md\` —— OpenSpec Markdown 主真源
- \`openspec/changes/<change-name>/tasks.md\` —— 结构化任务清单（specRef / 节点标注）
- \`openspec/changes/<change-name>/exploration.md\` —— 探索结果
- \`openspec/config.yaml\` —— 项目配置（用于技术栈检测）

**存量 JSON（WARN，非阻断，仅存量 / 已归档变更）** —— 仅当 Markdown 制品缺失时：历史 \`change.json\` / \`tasks.json\` JSON 文件。

**若无 exploration.md**：报告 "未找到探索文件，无法验证" 并退出。

---

## 证据读取（Markdown-first）

以下所有维度检查均从 OpenSpec Markdown 制品读取评分证据：

- \`proposal.md\`（变更目录）—— 真源：Why / What Changes / Capabilities
- \`design.md\`：Context / Goals / Non-Goals / Decisions / Risks
- \`specs/**/*.md\`：Requirement（\`### Requirement:\`）+ Scenario（\`#### Scenario:\` / WHEN / THEN）
- \`tasks.md\`（变更目录根）—— 带 \`specRef\` 与流程图节点标注的任务条目

**存量 JSON 降级（WARN，仅存量 / 已归档变更）**：若 Markdown 制品缺失且仅有历史 \`change.json\` / \`tasks.json\`，记录 WARN（"Markdown 制品缺失 —— 降级为历史 JSON 解析"）并只读读取。对新变更而言，Markdown 是唯一真源。降级非阻断，但 MUST 在验证报告中注明。

---

## 技术栈检测

### 检测方法

解析 \`openspec/config.yaml\` 的 context 字段以匹配关键词：

| 技术栈 | 检测关键词 |
|------------|---------------------|
| TypeScript | "TypeScript" |
| Java/JSP | "Java", "JSP" |
| Python | "Python" |
| Go | "Go", "Golang" |
| Rust | "Rust" |

### 技术栈提示

若检测到技术栈 → **直接执行技术栈专项校验**（MUST NOT 就只读校验向用户提问），并在报告中说明校验项：
> 例：「技术栈专项校验：已执行（TypeScript）」

### 技术栈专项检查

**TypeScript**：
- ESM import 模式（\`import ... from ...\`）
- 文件操作使用 \`path.join()\`
- specs 中的跨平台路径处理

**Java/JSP**：
- 数据访问列名/字段名大小写与项目既有实现一致
- 分页标签结构与既有页面一致
- 浏览器兼容级别按项目声明（兼容旧浏览器时不使用其不支持的语法）

**Python**：
- import 语句顺序
- 类型标注是否齐全
- f-string 使用一致性

---

## 变更类型自动检测

执行 D6-D10 前，通过扫描 design.md 与 specs/**/*.md 检测变更类型：

**检测规则**（扫描 design.md 与 specs/**/*.md 的关键词）：

| 触发维度 | 关键词 | 命中后 |
|-------------------|----------|-------------|
| D6: 交互细节 | page, component, UI, Vue, React, JSP, template, field, component, 表单, 页面 | 执行 D6 |
| D7: API 契约 | endpoint, route, handler, controller, POST, GET, PUT, DELETE, API, request, response | 执行 D7 |
| D8: 数据库映射 | table, column, schema, DDL, migration, 表, 字段, 数据库, database, SQL | 执行 D8 |
| D9: 业务步骤 | 流程, 状态机, 多步骤, 条件分支, 事务, transaction, workflow, state machine, conditional | 执行 D9 |
| D10: 流程图节点覆盖度 | 探索产物含 \`## 功能流程图\` 段 | 执行 D10 |

**检测输出**：
\`\`\`
Detected Change Type: [Full-Stack / Backend-Only / Frontend-Only / DB-Schema]
Enabled Dimensions: D6 [✓/✗], D7 [✓/✗], D8 [✓/✗], D9 [✓/✗], D10 [✓/✗]
\`\`\`

未触发的维度标记为 "不适用" 并在评分中跳过。

---

## 影响面制品存在性判定（条件检查点，流程节点 N3）

执行 D1-D10 评分前，先对**影响面三制品**做存在性判定（决定「影响范围一致性检查点」是否激活）：

| 制品 | 存在判定锚点 |
| :--- | :--- |
| \`proposal.md\` 影响面 | \`## Impact\` 下的影响面分析小节（标题锚点：影响面分析 / Impact Analysis） |
| \`design.md\` 影响面 | \`## Context\` 下的架构影响小节（标题锚点：架构影响 / Architecture Impact） |
| \`tasks.md\` 影响面 | \`### Caller Updates\` 小节 |

**判定结果与处置**：

- 三制品**均存在**（影响分析已触发）→ 执行「影响范围一致性检查」，结论并入 D2/D3 评分
- **任一缺失**（影响分析未触发，含独立 spec-propose 路径未产影响面小节）→ 影响范围一致性检查标 **SKIP** 并从总分分母排除（不计入 triggered_count），MUST NOT 按 0 分拉低总分、MUST NOT 据此判 FAIL（对齐 D10 缺失处理先例）
- **存量 JSON-only 降级**（Markdown 缺失且仅有历史 JSON）→ **SKIP + WARN**（注明降级原因），MUST NOT 阻断评分，验证报告注明该处置

---

## 影响范围一致性检查（条件检查点，并入 D2/D3，流程节点 N5）

三制品均存在时，对以下对齐关系核查（细则见 \`references/impact-consistency.md\`，评分前 MUST 先 \`Read\` 该文件）：

1. **proposal Impact ↔ design 架构影响**：Impact 声明的影响模块在架构影响小节有对应描述；模块缺失或描述矛盾 → 不一致
2. **proposal Impact ↔ tasks 承接**：Impact 声明的每个影响模块在 tasks.md 有对应任务（Caller Updates 条目或直接改动该模块的任务）；无任何承接 → 不一致
3. **design 架构影响 ↔ specs 范围**：架构影响声明与 specs 能力范围一致；越出 specs 覆盖范围 → 不一致

**处置**：

- 全部对齐 → 影响范围一致性 **PASS**，D2/D3 评分计入该结论，报告标注各制品对齐状态
- 任一不一致（脱节）→ 计入评分 **FAIL**，逐条列出偏差模块（模块名 + 断裂点：tasks 缺承接 / design 矛盾 / specs 越界），MUST NOT 仅给出百分比
- 语义等价判定：模块措辞不同但指向同一目标时 MAY 计为对齐，MUST 能指出具体对应之处，MUST NOT 笼统放行

---

## 带评分的维度验证（D1-D10）

### Dimension 1: 需求覆盖

**Check**：\`proposal.md\`（Why / What Changes / Capabilities）中每个声明的变更项 → \`specs/**/*.md\` 中对应的需求。

**PASS 条件**：
- 每个决策有匹配的 spec 需求
- 决策特性在 specs 中被完整覆盖

**覆盖率计算**：
\`\`\`
D1 Score = (matched decisions / total decisions) * 100%
\`\`\`

**FAIL 示例**：
- "缺失：'使用邮箱验证' 决策无对应 spec 需求"
- "部分覆盖：'OAuth + email' 决策在 specs 中仅覆盖 email"

### Dimension 2: 技术一致性

**Check**：技术选型 → 在 \`design.md\`（Context / Goals / Decisions）中体现。

**PASS 条件**：
- 所有技术决策都出现在 design 中
- 探索与 design 之间无冲突

**覆盖率计算**：
\`\`\`
D2 Score = (matched tech choices / total tech choices) * 100%
\`\`\`

**FAIL 示例**：
- "冲突：探索决定使用 'SQLite'，design 指定 'Redis caching'"
- "缺失：探索选择 'email/password auth'，design 未提及认证"

### Dimension 3: 任务完整性

**Check**：\`specs/**/*.md\` 中每条需求 → \`tasks.md\` 中至少有一个**规范形态** \`Spec Ref\` 与其匹配的任务。

**规范引用形态**（与 \`artifact-markdown-source\` 的 Spec-to-task 追溯契约同一口径，本维度为提案验证侧的唯一真源）：
- \`Spec Ref = <capability> / <Requirement>\`
- \`Scenario Ref = <Scenario>\`（场景叶子名：只写 \`#### Scenario:\` 的名称，由同一任务的 Spec Ref 补全 \`capability / Requirement / Scenario\` 全路径后匹配）

**上下文缺失与歧义（fail-safe）**：任务无 \`Spec Ref\` 却写叶子名 \`Scenario Ref\` → 报「缺少上下文」（\`scenario-ref-missing-context\`）；任务有 ≥2 条 \`Spec Ref\` 且场景为叶子名 → 报「歧义」（\`ambiguous-scenario-ref\`）；两者 MUST 要求写全路径 \`<capability> / <Requirement> / <Scenario>\`，MUST NOT 猜测归属。

等价写法（**与两行写法等价计分**，覆盖率 MUST NOT 因书写形态下降）：叶子名（经同一任务 Spec Ref 补全）、HTML 注释式 \`<!-- Spec Ref: <capability> → Requirement: "<R>" → Scenario: "<S>" -->\`、一行同时给出 Spec + Scenario、历史全路径场景名与裸 Requirement / Scenario 名。

**capability-only 不计覆盖**：只写 capability（如 \`- Spec Ref：checkout-flow\`）的引用 MUST NOT 匹配到任一 Requirement，也不计入覆盖；应报告「缺少 Requirement」诊断，示例：

\`\`\`
D3 FAIL：'checkout-flow' 缺少 Requirement（期望形态 checkout-flow / <Requirement>），不计入覆盖
\`\`\`

**PASS 条件**：
- 每条 spec 需求都有规范形态引用它的任务
- 所有场景都被任务覆盖

**覆盖率计算**：
\`\`\`
D3 Score = (requirements with tasks / total requirements) * 100%
\`\`\`

**FAIL 示例**：
- "缺失任务：'用户可导出数据' 需求没有实现任务"
- "缺 Requirement：\`- Spec Ref：checkout-flow\` 只到 capability，无法计入覆盖"

**待实现功能覆盖检查点（并入本维度，不新增维度编号）**：

在既有「需求 → 任务」覆盖核查之上，对 \`proposal.md\` What Changes 的每个声明项执行**链路核查**（What Changes 变更项 → \`specs/**/*.md\` 对应 Requirement → \`tasks.md\` 承接任务）：

- **链路完整**：声明项在 specs 有对应 Requirement 且 tasks 有带规范形态 \`Spec Ref\` 的承接任务 → 报告标注「待实现功能覆盖：链路完整（What Changes → <capability>/<Requirement> → <task id>）」，该声明项计入 D3 已覆盖
- **缺口可定位**：声明项断链（specs 缺 Requirement，或 tasks 无承接任务）→ 在 D3 报告中逐条列出缺口链路，指明断在 specs 级还是 tasks 级，覆盖率下降并计入 FAIL 输出，MUST NOT 仅给出百分比

检查点为 D3 内部的增量核查步骤（报告仍按 D3 口径输出覆盖率），MUST NOT 触碰总分公式与维度编号。

### Dimension 4: 边界覆盖

**Check**：边界问题 / 边缘场景 → 由 \`specs/**/*.md\` 中的 \`#### Scenario:\` 块处理。

**PASS 条件**：
- 每个问题都有 spec 场景覆盖
- 探索中的错误条件在 specs 中被覆盖

**覆盖率计算**：
\`\`\`
D4 Score = (addressed questions / total questions) * 100%
\`\`\`

**FAIL 示例**：
- "未处理：'email 验证失败时会怎样？' 没有对应 spec 场景"

### Dimension 5: 待办消解

**Check**：探索 Pending 段中的条目 → 在提案前消解。

**PASS 条件**：
- Pending 段为空，或全部条目都有已确认的答案
- 答案体现在 Decisions 段

**覆盖率计算**：
\`\`\`
D5 Score = (resolved items / total pending items) * 100%
If pending section empty: D5 Score = 100%
\`\`\`

> **D6-D10 条件维度下沉**：完整细则见 \`references/conditional-dimensions.md\`；评分前 MUST 先 \`Read\` 该文件。

## 总分计算

\`\`\`
Core D1-D5 Score = (D1 + D2 + D3 + D4 + D5) / 5
Interaction D6-D10 Score = average of triggered dimensions only
Non-triggered dimensions excluded from calculation

Overall Score = (D1 + D2 + D3 + D4 + D5 + sum(triggered D6-D10)) / (5 + triggered_count)

Threshold interpretation (unified 90% — the previous 70%/90% dual-band is removed):
- ≥90%: High quality, ready for implementation (PASS — auto-trigger inline deep review per "Pass Handling")
- <90%: Needs revision before implementation (FAIL — auto-fix and re-run; no skip-to-apply path)
\`\`\`

**WARNING 与 FAIL 的区别**：
- **WARNING**：存量变更缺少交互细节分节 → 不计入评分、不阻断 apply
- **FAIL**：新变更的交互细节分节不完整 → 计入评分并阻断 apply

---

<!-- CMD:SKIP -->
## 评分报告输出

\`\`\`
## Verification Report

**Change**: <change-name>
**Change Type**: Full-Stack (auto-detected)
**Tech Stack**: TypeScript (detected)

| Dimension | Coverage | Status | Issues |
|-----------|----------|--------|--------|
| D1: Requirements | 85% | PASS | 0 |
| D2: Technical | 90% | PASS | 0 |
| D3: Tasks | 100% | PASS | 0 |
| D4: Boundaries | 70% | FAIL | 2 |
| D5: Pending | 100% | PASS | 0 |

**Core Score (D1-D5)**: 89% (Good quality)

### Interaction Detail Verification (Auto-triggered)

| Dimension | Coverage | Status | Issues |
|-----------|----------|--------|--------|
| D6: Interaction Detail | 75% | PASS | 0 |
| D7: API Contract | 80% | PASS | 0 |
| D8: Database Mapping | N/A | SKIP | — |
| D9: Business Steps | 100% | PASS | 0 |

**Overall Score (with triggered D6-D10)**: 87% (Good quality)

### D4 Details (FAIL)
- Missing: "Email verification timeout" scenario
- Missing: "Network failure handling" scenario

### Legacy Warnings (not blocking)
- (none)
\`\`\`

### 带存量告警的报告

\`\`\`
## Verification Report

**Change**: legacy-change
**Change Type**: Full-Stack (auto-detected)

| Dimension | Coverage | Status |
|-----------|----------|--------|
| D1-D5 (Core) | ... | ... |
| D6: Interaction Detail | — | WARNING |
| D7: API Contract | — | WARNING |

### Legacy Warnings (not blocking apply)
- ⚠ D6 WARNING: 交互细节矩阵缺失。建议补充以提升实现质量。
- ⚠ D7 WARNING: API 交互契约缺失。建议补充端点定义。
\`\`\`
<!-- /CMD:SKIP -->

---

## PASS 处理：内联只读深度复查

当所有维度 PASS（≥90%）时：

> "验证通过！总分：XX%"
> "自动运行内联只读深度复查……"

评分 PASS 后，对提案执行一次内联只读深度复查（不依赖专门的技能名）。深度复查自动运行（无 [Yes/No] 提示）。用户 MAY 中断以跳过；否则照常运行。

### 内联深度复查步骤

内联运行额外的只读检查（不调用技能）：
- 代码库探索（调用链、数据流）
- 多维完整性（8 个维度）
- 实现合规性（技术栈、架构、命名）
- 特殊功能场景（导出/导入、并发）
- 页面设计细节（JSP 结构、表单元素）
- 逻辑实现（业务规则、数据一致性）
- 带 P0/P1/P2 建议的量化评分

---

## FAIL 处理：带选项的自动修复循环

当任一维度 FAIL 时：

### Step 1: 自动修复并重新评分

AI 自动生成具体修复建议、应用，然后重新运行验证：

\`\`\`
## Suggested Fixes for D4

1. Add scenario to specs/auth/spec.md:
   #### Scenario: Email verification timeout
   - WHEN verification takes longer than 30 seconds
   - THEN system shows retry option

2. Add scenario to specs/auth/spec.md:
   #### Scenario: Network failure handling
   - WHEN network connection lost during auth
   - THEN system queues request for retry
\`\`\`

修复应用后重新运行验证。若仍 FAIL，进入 Step 2。

### Step 2: 选项（自动修复后仍 FAIL 时）

\`\`\`
## Verification Failed (after auto-fix)

**Overall Score**: XX% (still below threshold)

### Options (no skip-to-apply path):
[1] 手动编辑 - Fix artifacts yourself
[2] 返回探索 - Return to exploration, add missing decisions
[3] 查看差异 - View diff between artifacts and exploration
\`\`\`

---

<!-- CMD:SKIP -->
## 验证输出

\`\`\`
## Verification Report

**Change**: <change-name>

### Scores

| Dimension | Coverage | Status |
|-----------|----------|--------|
| D1: Requirement Coverage | XX% | PASS/FAIL |
| D2: Technical Consistency | XX% | PASS/FAIL |
| D3: Task Completeness | XX% | PASS/FAIL |
| D4: Boundary Coverage | XX% | PASS/FAIL |
| D5: Pending Resolution | XX% | PASS/FAIL |

**Overall Score**: XX%

### Threshold (unified 90%)
- ≥90%: High quality ✓ (PASS — auto-run inline deep review)
- <90%: Needs revision ✗ (FAIL — auto-fix and re-run)

---

**Result**: ALL PASS ✓ / FAILED [X]

[If passed]: Auto-run inline read-only deep review
[If failed]: Auto-fix → re-score → if still FAIL, present options [1-3]
\`\`\`

---

## 调用

\`\`\`bash
# Resolve change name
iagent spec status --json

# Read config for tech stack detection (use Read tool on openspec/config.yaml)

# If user specified change:
iagent spec status --change "<name>" --json
\`\`\`

使用 status 的 \`changeRoot\` / \`artifactPaths\`（\`artifactPaths.<id>.existingOutputPaths\`）在变更目录中定位 \`exploration.md\` 与各制品，MUST NOT 自行拼接或猜测路径。
先读取结构化证据：\`<change-dir>/proposal.md\`、\`design.md\`、\`specs/**/*.md\` 与 \`tasks.md\`；缺失时降级为存量 JSON 并记 WARN。
<!-- /CMD:SKIP -->

---

## Guardrails

- **量化评分**：每个维度都有覆盖率百分比
- **技术栈检测**：解析 openspec/config.yaml 的 context 字段
- **内联深度复查**：通过后内联运行只读深度检查（不使用专门技能）
- **自动修复循环**：FAIL 时自动生成并应用修复、重新评分；若仍 FAIL，提供 [手动编辑]/[返回探索]/[查看差异]
- **Markdown-first 证据**：读取 proposal.md / design.md / specs/**/*.md / tasks.md；Markdown 缺失时降级为存量 JSON 只读读取并记 WARN（非阻断）
- **无探索文件**：无法验证，报告并退出
- **跨平台**：文件路径使用 \`path.join()\``,
        license: 'MIT',
        compatibility: '依赖 iagent CLI（spec 命令组）。',
        metadata: { author: 'mi-agent-tools' },
        references: [
            { path: 'references/conditional-dimensions.md', content: CONDITIONAL_DIMENSIONS_FULL },
            { path: 'references/impact-consistency.md', content: IMPACT_CONSISTENCY_FULL },
        ],
    };
}

export function getSpecVerifyProposalCommandTemplate(): CommandTemplate {
    return {
        name: 'iAgent: 提案验证门',
        description: '提案验证门 —— 用量化评分校验制品，10 维度检查 + 技术栈检测',
        category: 'iAgent / 规格',
        tags: ['iagent', 'spec', 'verify', 'proposal'],
        content: deriveCommandContent(getSpecVerifyProposalSkillTemplate().instructions),
    };
}
