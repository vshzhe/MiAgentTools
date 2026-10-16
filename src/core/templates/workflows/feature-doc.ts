/**
 * docs 类型技能模板：功能需求文档生成（源项目功能扫描与功能地图）。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { CODEGRAPH_MCP } from '../tool-whitelist.js';

export function getFeatureDocSkillTemplate(): SkillTemplate {
    return {
        name: 'iagent_feature_doc',
        description: 'Scan a source project\'s feature modules and generate a feature requirement implementation document (feature map) covering frontend implementation, backend methods, field-level API contracts, database call chains, and cross-module interactions, driven by a framework profile detected from the source project (auto-detected from project structure files and confirmed with the user, or supplied by the caller). Use when the user wants to scan feature modules of a source project, analyze feature implementation from code, build a project feature map (项目功能地图 / 功能地图), or generate a migration requirement document (迁移需求文档) for framework migration or refactoring. NOT for converting an OpenSpec change proposal into a review requirement document — that is iagent_requirement_doc.',
        allowedTools: `Read, Write, Edit, Glob, Grep, ${CODEGRAPH_MCP}`,
        type: 'docs',
        instructions: `**适用 openspec/rules/ai-coding.md 全域护栏。** 未定义项标 **[待确认]**，禁止猜测。

Scan a source project's feature modules and generate a complete feature requirement implementation document covering frontend implementation, backend implementation, field-level API contracts, database call chains, and cross-module interactions.

**Trigger boundary**: This skill scans SOURCE PROJECT CODE to produce feature requirement implementation documents or project feature maps ("scan feature", "扫描功能", "analyze feature implementation", "项目功能地图", "迁移需求文档").

---

## Step 0: Determine execution mode

**Standalone mode (default when invoked directly)**:
- Collect parameters interactively using the **AskUserQuestion tool**
- Every parameter is skippable or has a default — never block startup on missing parameters
- Skip parameters already provided in the invocation; collect only missing ones

**Non-interactive mode (when invoked from the auto-migration workflow)**:
- The caller injects parameters (source project path, feature entry, output mode, framework profile, output directory)
- Do NOT ask any questions; skip provided parameters and use defaults for the rest
- Invalid injected input → fail fast with a clear error report instead of prompting

## Step 1: Collect parameters

| 参数 | 必填 | 默认/跳过行为 |
|------|------|---------------|
| 源项目根目录路径 | 是 | 无默认 — 必须获得有效路径 |
| 功能入口 | 是 | 全项目（跳过时） |
| 输出模式 | 否 | 新人上手模式 |
| 框架档案 | 否 | 未知框架 → 自动探测（Step 2） |
| 输出目录 | 否 | 按输出路由规则（见 Output routing） |

**Path validation**: verify the source project path exists and is readable before scanning (Windows drive paths like \`e:\\project\\src\` and POSIX paths are both valid input). If the path is invalid, report the error explicitly and ask the user to re-enter it — NEVER guess-correct, silently normalize, or proceed on a presumed path.

### 输出模式 (output modes)

| 模式 | 适用场景 | 文档侧重 | 输出范围 |
|------|----------|----------|----------|
| **新人上手模式** | 新成员快速理解项目 | 功能全景图、代码追踪路径、交互流程 | 全项目功能地图 + 指定模块详情 |
| **迁移重构模式** | 框架升级/技术栈迁移 | 业务逻辑提取、技术实现细节、迁移建议 | 指定模块深度分析 |
| **设计文档模式** | 编写正式技术文档 | 规范化格式、完整接口说明、数据库设计 | 指定模块规范文档 |
| **全景扫描模式** | 全面了解整个项目 | 全模块地图、交叉依赖、交互全景 | 全项目所有模块 |

## Step 2: Collect the framework profile (框架档案)

The framework profile parameterizes the source project's framework-specific development knowledge. Fields:

| 档案字段 | 说明 |
|----------|------|
| 框架名 | Framework identity detected from the source project |
| 路由配置文件 | Where URL → Controller mappings live (annotation-based mapping counts as config) |
| 前端交互方式清单 | Interaction channels observed in the source project (Ajax / form submit / URL direct / reverse push / ...) |
| 特有机制清单 | Framework-specific mechanisms that drive page rendering or data access |
| 框架标准方法清单（可选） | Standard methods the framework generates or dispatches, if documented |

**No built-in framework presets.** The profile MUST be derived from the **actual source project** (auto-detection + user confirmation) or supplied by the caller — never hardcoded. A caller-provided profile always wins over detection. Never assume any framework without confirmed detection evidence.

**Unknown framework (自动探测降级)** — when the user selects 未知框架 or provides no profile:
1. Read project structure files (\`pom.xml\` / \`build.gradle\`, \`web.xml\`, \`package.json\`, \`application.properties\`, \`struts.xml\`, annotation patterns in source) to detect the framework type and routing configuration
2. Present the detection conclusion as **[待确认：框架档案探测]** — the user must confirm before scanning continues
3. In non-interactive mode, record the detection conclusion in the output report; a caller-provided profile always wins over detection

## Step 3: Determine scan scope (入口类型识别)

| 入口类型 | 识别规则 | 处理方式 |
|----------|----------|----------|
| **文件路径** | Contains source file extensions (\`.java\`, \`.jsp\`, \`.html\`, \`.xml\`, \`.properties\`, ...) or a package/directory path | Read the file(s), extract routes and dependencies, recursively scan the dependency chain (Controller → Service → DAO → Bean, related pages) |
| **URL路由** | A URL string ending in the framework's route suffix (\`.do\`, \`.action\`, or the profile's equivalent) | Look up the routing config from the profile, locate the Action/Controller class, scan its dependency chain |
| **模块名称** | A descriptive feature name (e.g., "账号管理", "登录功能") | Infer the package path from the name, scan the module's Action/Service/DAO/Entity, match related tables and pages |
| **全项目** | "全部", "整个项目", "所有模块", "全景" | Layered full-project flow (see 全项目扫描模式) |

## Step 4: Deep scan the feature implementation

### 4.1 Backend scan

- **Controller layer**: class inheritance, all public method signatures, request dispatch logic (method-parameter routing or annotation mapping), parameter acquisition (\`request.getParameter()\`, form binding), return handling (setAttribute + forward / JSON write / redirect); locate URL mappings in the profile's routing config
- **Service layer**: per-method business logic (计算/转换/判断/校验), transaction control, permission checks, external service calls (WebService / MQ / SSH), async processing
- **DAO layer**: every SQL (SELECT/INSERT/UPDATE/DELETE); parameterization (\`?\` placeholders vs string concatenation — SQL injection risk MUST be judged from actual code); return types; connection handling; involved tables and fields
- **Entity layer**: field names, types, table mappings

### 4.2 Frontend scan

- Identify page types (主页面/详情页/弹窗页/嵌套页); record form fields, validation rules, buttons and their bound JavaScript functions, navigation logic
- Analyze data fetch and display through EVERY interaction channel listed in the framework profile — never limit the scan to one channel
- Record field-level request parameters and response handling per interaction (Principle B)

### 4.3 Config scan

Read the profile's routing config and other key configs (\`web.xml\`, DWR config, database connection config, workflow config) to build the global view.

### 4.4 Database scan

Extract tables and fields from SQL statements and entities; obtain full table structures (types, lengths, defaults, comments); analyze indexes, constraints, logical relations, and enum field values.

## Step 5: Build the feature hierarchy decomposition

Decompose the scanned feature: 功能模块 → 功能组 → 功能点 → 子功能 → 实现点 (implementation points reference concrete classes/methods/pages).

Generate:
1. A Mermaid **mindmap** of the hierarchy down to implementation points
2. A Mermaid **graph** of feature relations inside the module (which features call or depend on each other)

## Step 6: Build the cross-module interaction panorama

Analyze at three levels:
- **Level 1 模块级依赖**: package import dependencies, cross-module config references → dependency matrix
- **Level 2 接口级调用**: cross-module Action/Service calls, call style (method call / WebService / MQ / HTTP), data format
- **Level 3 数据流级联动**: cascading table operations, state synchronization, consistency maintenance

Generate the module interaction panorama graph and, for each cross-module interaction, a detail table: 源模块 / 目标模块 / 交互场景 / 调用链（类→方法→类→方法）/ 数据传递 / 数据库联动 / 状态同步 / 异常处理 / 事务边界.

## Step 7: Draw the 4 mandatory diagram types

**⚠️ All 4 types are mandatory outputs. A document missing any type is unqualified.**

### 7.1 前后端业务交互时序图 (per core feature point)

Trace: 用户 → 前端JS → HTTP请求 → Controller → Service → Util → DAO → DB → 响应 → 前端渲染.
Requirements: every node annotated with \`文件名:行号\` or \`类名.方法名()\`; HTTP method + URL; frontend encryption/serialization; backend return type; frontend DOM operations in callbacks. At minimum cover: main business operations, list queries, import/export chains.

\`\`\`mermaid
sequenceDiagram
    autonumber
    participant U as 用户
    participant F as 前端(页面:行号)
    participant C as Controller(类:行号)
    participant S as Service(类:行号)
    participant UT as Util(类:行号)
    participant D as DAO(类:行号)
    participant DB as 数据库(表名)

    Note over U,DB: 业务场景: {场景名}
    U->>F: 用户操作(点击按钮/输入表单)
    F->>F: 前端逻辑(数据收集/加密/校验)
    F->>C: Ajax POST {URL} Data: {参数列表}
    Note over C: Controller.方法名() [行号]
    C->>C: 权限校验/参数接收
    C->>S: Service.方法()
    S->>UT: Util.方法()
    S->>D: DAO.方法()
    D->>DB: SQL: SELECT/INSERT/...
    DB-->>D: 返回结果
    D-->>S: 返回数据
    S-->>C: 返回处理结果
    C-->>F: JSON响应 {code, msg, data}
    F->>F: 前端渲染(DOM操作/刷新/提示)
\`\`\`

### 7.2 接口交互流程图 (per Controller / route entry)

Show how frontend buttons/links map to dispatch parameters, Controller methods, return types, and frontend handling of each return type.

\`\`\`mermaid
flowchart TD
    subgraph 前端页面
        BTN1[按钮: 操作1] -->|Ajax POST| M1["method=op1"]
        BTN2[链接: 操作2] -->|URL GET| M2["method=op2"]
    end
    subgraph Controller分发
        M1 --> F1[方法1:行号]
        M2 --> F2[方法2:行号]
    end
    subgraph 返回值处理
        F1 --> R1[JSON响应→前端回调渲染]
        F2 --> R2[forward JSP→页面渲染]
    end
\`\`\`

### 7.3 功能间交互流程图 (mandatory when 2+ Controllers or 3+ tables are involved)

Show cross-feature call chains, shared utilities, table dependencies, and async trigger points.

\`\`\`mermaid
flowchart LR
    subgraph 功能A["功能A (ControllerA)"]
        A1[入口方法] --> A2[ServiceA]
    end
    subgraph 功能B["功能B (ControllerB)"]
        B1[入口方法] --> B2[ServiceB]
    end
    subgraph 共享工具
        U1[工具类X]
    end
    subgraph 数据层
        T1[(表1)]
        T2[(表2)]
    end
    A2 --> U1
    A2 -->|调用| B2
    A2 --> T1
    B2 --> T2
\`\`\`

### 7.4 后端决策流程图 (mandatory for methods with if/else over 3 levels or switch over 3 cases)

Every condition node must come from actual if statements; every branch shows its real logic, DB operations, and exception paths.

\`\`\`mermaid
flowchart TD
    A[开始: 方法名() 行号] --> B{判断条件1<br/>来自实际if语句}
    B -->|是| C[处理分支1 具体逻辑]
    B -->|否| D{判断条件2}
    D -->|是| E[处理分支2]
    D -->|否| F[异常/默认处理]
    C --> G[DB操作/返回结果]
    E --> G
    F --> H[记录日志/返回错误]
\`\`\`

### Step 7 self-check

- [ ] 7.1 时序图: 每个核心功能点都有？
- [ ] 7.2 接口交互流程图: 每个 Controller 的分发都有？
- [ ] 7.3 功能间交互: 多 Controller/多表操作时有？
- [ ] 7.4 决策流程: 所有复杂 if/else/switch 都有？
- [ ] 所有图中的方法名能在源码中找到？URL/参数与前端代码一致？

## Step 8: Database call chain tracing

Per feature point:
1. **数据库操作汇总表**: 步骤 / SQL类型 / 表名 / 操作说明 / 关键字段 / 调用位置（类.方法():行号）
2. **数据变换追踪**: 前端表单数据 → Controller 参数 → Service 变换（加密/转换/计算）→ SQL 参数 → 数据库存储值, layer by layer with concrete values and transformations

## Anti-hallucination rules (6 rules — highest priority)

### 规则1: 分析结论必须有代码证据

| 禁止行为 | 错误示例 | 正确做法 |
|----------|----------|----------|
| 猜测算法原理 | "使用Levenshtein编辑距离算法" | **必须读取源码确认**实际计算逻辑 |
| 猜测技术栈 | "使用Redis缓存" | **必须** Grep 搜索确认是否存在 |
| 猜测数据库操作 | "可能使用了事务" | **必须** 搜索事务控制语句确认 |
| 猜测第三方库 | "使用Apache Commons" | **必须** 读取 import 语句确认 |
| 泛化描述 | "对数据进行加密" | **必须** 定位到具体的 类.方法()，记录算法与密钥来源 |

### 规则2: 未确认的信息必须标记 [待确认]

- 代码调用了外部 jar 或不在当前项目中的类 → \`[待确认：外部依赖]\`
- 算法或逻辑过于复杂无法完全理解 → \`[待确认：需进一步分析]\`
- 配置文件中的参数含义不明确 → \`[待确认：配置参数含义]\`
- 数据库表的某些字段含义不明确 → \`[待确认：字段含义]\`

### 规则3: 关键代码必须完整读取

核心算法类、Service 核心方法必须读到方法结尾，不得只看前几十行就下结论；SQL 注入风险判定必须基于实际代码（参数化 vs 拼接）。

### 规则4: 流程图必须基于实际代码路径

时序图中的每个方法名必须能在实际代码中找到；分支流程图的每个条件必须对应实际的 if/else/switch 语句；不得凭"常见模式"画图。

### 规则5: 问题分析必须具体

安全/性能/规范问题必须定位到具体行号和代码片段、具体循环位置和数据量、实际命名或结构。

### 规则6: 禁止概括与模糊描述（Zero-Vagueness）

| 禁止的概括词汇 | 必须替换为 |
|----------------|-----------|
| "等"、"等等" | 完整列出所有项 |
| "主要包括" | 完整列出全部内容 |
| "诸如"、"例如" | 明确是全部还是举例；举例必须标注"（共N项，示例X项）" |
| "相关"、"一系列"、"各种" | 具体说明是什么（列出具体文件名/配置名） |
| "处理"、"操作" | 说清楚什么处理/操作，调用哪个类的哪个方法 |
| "某些"、"一些"、"若干" | 给出具体数量或列表 |

**验证方法**: 全文搜索禁止词汇，每个命中点必须被替换或标注为 \`[待确认]\`。

## Detail-level mandates (A-G)

> Purpose: the document must be detailed enough that a migration team can re-implement the feature from this document alone, without guessing any implementation detail.

### 原则A: 每个前端页面独立文档化

Each page gets: 页面名称 / 页面类型（列表页/表单页/详情页/弹窗页/嵌套页）/ 路由入口 / 触发方式, plus:
- **完整字段列表**（每个字段一行，不允许"等"省略）: 字段名 / 数据库字段 / UI组件类型 / 是否只读 / 校验规则 / 默认值来源 / 事件绑定
- **组件交互逻辑**: 字段联动/级联/显隐关系，按钮点击后的完整链路
- **页面JavaScript函数列表**: 函数名 / 触发时机 / 功能 / 调用的后端URL

### 原则B: 前后端字段级契约

Each frontend-backend interaction gets: 操作名称 / 触发页面:行号 / 触发方式（Ajax POST / Form提交 / URL跳转 / 框架特有方式）, plus:
- **请求参数-字段级**: 参数名 / 来源字段或JS变量 / 类型 / 是否必填 / 前端处理（加密/编码/默认值）/ 后端接收方式
- **响应处理-字段级**: 响应字段 / 类型 / 前端使用方式 / DOM操作目标

### 原则C: 后端每个方法独立文档化

Each Controller/Service/Util method gets: 方法名 / 类 / 代码位置（行号范围）/ 功能 / 返回值类型, plus:
- **处理步骤**（逐步骤标注代码行）
- **数据库操作**表（SQL语句 / 表名 / 操作类型 / 执行位置）
- **调用的工具类/其他模块**表（类名 / 方法 / 调用位置 / 用途）

### 原则D: 迁移可执行性验证

Self-ask after generation: 如果只给这份文档，一个不了解项目的人能否完整重新实现该功能？Coverage required: 每个页面的所有字段及组件类型、每个字段的前端校验、每个按钮/链接触发的具体 URL 和方法、每个后端方法的入参列表和来源、每张表的字段列表和类型、每条 SQL 的操作类型和条件、每个 if/else 分支的判断条件。

### 原则E: 框架驱动页面的分组文档化

When many pages are rendered by the same framework/template mechanism (per the profile's 特有机制):
1. One "框架通用机制" subsection explaining how the framework renders pages (关键类和方法、配置→组件映射规则、页面如何读取数据)
2. Grouped page tables: 页面文件列表（全部列出，不可省略）、共同使用的配置来源、差异点
3. Each group references the complete field tables (chapter 2) instead of repeating them

Forbidden: 只列少数页面其余用"等"省略；对每个同模板页面重复抄写相同字段表；完全不提其余页面的存在。

### 原则F: 所有方法覆盖（public + private 全覆盖）

Every method of each scanned Controller/Service/Util class must be documented, including private methods:
- **复杂方法**（>10行或含分支/循环）→ 逐步骤描述（步骤编号/代码行/操作内容/调用的方法）
- **简单方法**（≤10行且无分支）→ 方法签名 + 代码行范围 + 一句话功能描述
- **纯委托方法** → 标注"委托父类{父类名}.{方法名}()"或"返回{字段名}"

**验证**: grep 每个扫描类的所有方法签名（含 private），确认文档中都有出现；遗漏任何 private 方法即文档不合格。

### 原则G: 工具类引用全覆盖

Every imported non-JDK class referenced by the feature gets an independent subsection: 类名 / 来源（项目内/第三方库/框架基础类）/ 引用者, plus a table of ALL used methods: 被使用的方法 / 调用行号（调用者:行号）/ 本功能中的用途 / 方法功能描述.

**验证**: 从每个类的 import 语句反向检查 — 导入的每个非 JDK 类都有独立小节，代码中调用的每个方法都在方法清单中。禁止"使用了XxxUtil进行类型转换"式的笼统描述。

## Step 9: Generate the document

**输出结构**（以下章节不可缺失，不可使用概括性描述）:

\`\`\`markdown
# {功能模块名称} - 功能需求实现文档

## 1. 功能概述与层次分解
   1.1 功能定位（是什么、做什么、为什么）
   1.2 功能-子功能层次分解图（Mermaid mindmap，分解到实现点级别 ★必选）
## 2. 数据库设计（每表独立小节，全字段列出；索引/约束；数据字典）
## 3. 前端页面实现（页面总览表；框架通用渲染机制；每页独立小节；分组清单）
## 4. API接口设计（每个接口独立小节：字段级请求参数+响应+调用示例）
## 5. 前后端业务交互流程（4类流程图 ★必选）
## 6. 后端功能实现（Controller/Service/工具类层，所有方法 public+private 全覆盖）
## 7. 数据库调用链追踪
## 8. 跨模块交互分析
## 9. 特殊功能点实现方式
## 10. 问题分析与建议
## 11. 迁移建议

## 附录
   A. 完整文件清单  B. 前端页面全矩阵  C. 前后端接口全契约
   D. 工具类引用全清单（每个 import 的类独立列出所有被使用方法+用途+调用行号）
   E. 建表SQL
\`\`\`

**特殊功能点**（第9章）: 安全相关（加密算法/权限校验/SQL注入防护）、性能优化（缓存/分页/批量/异步）、复杂业务逻辑（递归/事务/工作流/定时任务）、系统集成（WebService/SSH/消息通知/SSO）— each documented with 实现位置 / 实现原理 / 关键技术点 / 依赖关系 / 迁移建议.

**Naming**:
- 单模块: \`{功能模块名}_需求文档.md\`
- 全项目: \`{项目名}_功能地图.md\` + 各模块独立文档
- 多个相关模块: \`{模块集名称}_关联分析.md\`

## 全项目扫描模式 (panorama mode / whole-project entry)

Three layers:
1. **项目总体结构扫描**: read all routing mappings from the profile's routing config, scan all top-level module packages and page directories → 模块总览表 + 模块依赖拓扑图
2. **模块级分析** (per module, feature-point level — not per-method): 模块名称/包路径、Controller 列表、页面列表、涉及的数据库表、对外提供的接口和依赖的其他模块
3. **模块交互分析**: Step 6 → 全项目模块交互全景图

Output: 项目功能地图.md（整体架构图、所有模块列表及功能概述、模块交互全景图、每模块清单、全局配置说明）+ optional per-module detail documents.

## Output routing

| 执行上下文 | 输出路径 |
|------------|----------|
| Change context (called by auto-migration, \`openspec/changes/<change-name>/\` exists) | \`openspec/changes/<change-name>/attachments/source-feature-doc/\` |
| Standalone, user-specified output directory | user-specified directory |
| Standalone, no directory specified | \`openspec/migration/\` |

- Use \`path.join()\` to build all output paths (cross-platform: Windows drive letters + POSIX separators)
- Create the target directory if missing
- Non-interactive mode always uses the change-context route

## CodeGraph strategy

Prefer CodeGraph tools when the source project has an index:

| 分析目标 | CodeGraph 工具 |
|----------|----------------|
| 查找符号 | \`codegraph_search\` |
| 功能上下文 | \`codegraph_context\` |
| 谁调用了此方法 | \`codegraph_callers\` |
| 此方法调用了谁 | \`codegraph_callees\` |
| 修改影响范围 | \`codegraph_impact\` |
| 符号源码 | \`codegraph_node\` |

**Degradation**: if the source project has no CodeGraph index, automatically degrade to Glob/Grep/Read manual scanning and record the degradation in the document header (e.g., "扫描方式: Glob/Grep 手动扫描（CodeGraph 不可用）"). Do NOT block or ask the user. In standalone mode, optionally suggest initializing CodeGraph after the document is generated.

## Special scenarios

- **前后端分离架构**: scan the backend API (Controller classes, route annotations) and the frontend project directory (Vue/React etc.) separately; analyze the API contract (request params, response format)
- **多模块关联扫描**: scan each module → analyze cross dependencies → interaction analysis document → merge into a unified report
- **交互方式以档案为准**: never assume interaction channels — scan exactly the channels listed in the framework profile, plus any channels evidenced in code

## Output verification

After generation, self-check:

- [ ] 每条技术描述可追溯到具体代码文件与行号（规则1）
- [ ] 无法确认的信息已标 **[待确认：...]**，无推测性描述（规则2）
- [ ] 无「等 / 主要包括 / 诸如 / 相关」类概括省略（规则6）
- [ ] 7.1 时序图覆盖每个核心功能点；7.2 覆盖每个 Controller；7.3 覆盖多功能/多表；7.4 覆盖复杂分支
- [ ] 流程图中所有方法名可在源码找到，URL/参数与前端代码一致（规则4）
- [ ] 每个页面有独立字段-组件映射表，或按原则 E 分组覆盖
- [ ] 每个前后端交互有字段级请求/响应清单（原则 B）
- [ ] 所有方法（public + private）有描述（原则 F）
- [ ] 所有 import 的工具类有独立小节（原则 G）
- [ ] 迁移可执行性：只读此文档能完整重新实现该功能（原则 D）
- [ ] 文件保存至按执行上下文路由的输出路径（path.join() 构建）

**Guardrails**
- Never invent algorithms, libraries, tables, endpoints, or business rules — read the code first; mark gaps as **[待确认]**
- Never assume a framework or interaction channels — the framework profile (selected, provided, or confirmed after detection) is the only source of framework knowledge
- Invalid paths are reported and re-collected, never guess-corrected
- Non-interactive mode never blocks on questions; standalone mode never blocks startup on skippable parameters
- Use \`path.join()\` for all file paths`,
        license: 'MIT',
        compatibility: 'CodeGraph MCP 可选；无索引时自动降级为 Glob/Grep/Read 手动扫描。',
        metadata: { author: 'mi-agent-tools', version: '1.0' },
    };
}

export function getFeatureDocCommandTemplate(): CommandTemplate {
    return {
        name: 'iAgent: 生成功能需求文档',
        description: '扫描源项目功能模块，生成功能需求实现文档（功能地图）',
        category: 'iAgent / 文档',
        tags: ['iagent', 'docs', 'feature-doc', 'documentation', 'analysis'],
        content: `**适用 openspec/rules/ai-coding.md 全域护栏。** 未定义项标 **[待确认]**，禁止猜测。

Scan a source project's feature modules and generate a feature requirement implementation document. **Trigger boundary**: this command scans source project code (feature map / 项目功能地图 / 迁移需求文档).

**Input**: optionally provide the source project path and feature entry after the command. Missing parameters are collected interactively; already-provided parameters are skipped. When invoked from the auto-migration workflow (non-interactive), use the injected parameters without asking.

---

## Step 1: Collect parameters

- **源项目根目录路径**: validate existence/readability first (Windows drive paths and POSIX paths both valid). Invalid path → report the error and ask for re-input — never guess-correct a path
- **功能入口**: 文件路径 / URL路由 / 模块名称 / 全项目
- **输出模式**: 新人上手（默认）/ 迁移重构 / 设计文档 / 全景扫描
- **框架档案**: auto-detect the framework profile from the source project structure files (\`pom.xml\`, \`web.xml\`, \`package.json\`, \`struts.xml\`, annotation patterns, ...) → present the conclusion as **[待确认：框架档案探测]** and confirm before scanning. No built-in presets — never assume any framework without confirmed detection evidence or a caller-provided profile
- **输出目录**: optional (see routing below)

## Step 2: Deep scan (entry-type driven)

- **Backend**: Controller dispatch logic → Service business logic → DAO SQL (parameterization vs concatenation → SQL injection risk from actual code) → entities
- **Frontend**: every page (fields/components/validation/JS functions), every interaction channel listed in the framework profile, field-level contracts
- **Config + database**: routing config, full table structures, indexes, enum values

## Step 3: Analysis artifacts (all mandatory)

- **功能-子功能层次分解**: Mermaid mindmap down to implementation points (类.方法() / 页面)
- **跨模块交互全景**: 模块依赖 → 接口调用 → 数据流联动, with a detail table per interaction
- **4 类流程图**（缺一不可）: 前后端交互时序图（每核心功能点）/ 接口交互流程图（每 Controller）/ 功能间交互流程图（多 Controller/多表时）/ 后端决策流程图（if/else 超3层或 switch 超3个 case 时）— every method name and condition traceable to actual code
- **数据库调用链追踪**: 操作汇总表 + 数据变换追踪（前端表单 → Controller 参数 → Service 变换 → SQL 参数 → 存储值）

## Step 4: Generate the document

11-section structure + appendix: 功能概述与层次分解 / 数据库设计（每表全字段）/ 前端页面实现 / API接口设计（字段级契约）/ 4类流程图 / 后端功能实现 / 数据库调用链 / 跨模块交互分析 / 特殊功能点实现方式 / 问题分析与建议 / 迁移建议；附录（文件清单、页面全矩阵、接口全契约、工具类引用全清单、建表SQL）.

Follow the anti-hallucination rules: every conclusion traceable to 文件:行号; unconfirmed information marked **[待确认：...]**; no vague summaries ("等", "主要包括", "相关" — list everything concretely). Follow the detail mandates A-G: per-page field tables, field-level frontend-backend contracts, per-method documentation (public + private 全覆盖), migration executability (re-implementable from the document alone), framework-driven page grouping, utility-class full coverage (every imported class listed with all used methods).

**Naming**: 单模块 \`{功能模块名}_需求文档.md\`; 全项目 \`{项目名}_功能地图.md\` + per-module docs; 多模块 \`{模块集名称}_关联分析.md\`.

**Output routing** (build all paths with \`path.join()\`):

| 执行上下文 | 输出路径 |
|------------|----------|
| Change context (auto-migration) | \`openspec/changes/<change-name>/attachments/source-feature-doc/\` |
| Standalone + user-specified directory | user-specified directory |
| Standalone, none specified | \`openspec/migration/\` |

**CodeGraph**: prefer CodeGraph tools (\`codegraph_search\` / \`codegraph_callers\` / \`codegraph_callees\` / \`codegraph_impact\`); if the source project has no index, automatically degrade to Glob/Grep/Read, record the degradation in the document header, and continue — never block or ask the user.

## Self-check

- [ ] 每条描述可追溯（文件:行号）；未确认信息已标 **[待确认]**
- [ ] 无「等/主要包括/相关」概括省略；字段/页面/方法/工具类全部完整列出
- [ ] 4 类流程图齐全且基于实际代码路径
- [ ] public + private 方法全覆盖；工具类引用全覆盖
- [ ] 只读此文档能完整重新实现该功能
- [ ] 文档保存至按上下文路由的输出路径

**Guardrails**
- Never invent algorithms, libraries, tables, or endpoints — read the code first
- Never assume a framework — profile (selected/provided/detected-and-confirmed) is the only source
- Invalid paths are re-collected, never guess-corrected
- Non-interactive mode never blocks on questions
- Use \`path.join()\` for all file paths`,
    };
}
