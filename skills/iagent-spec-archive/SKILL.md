---
name: iagent-spec-archive
description: "归档变更。当用户要归档已实现完成的变更、结束变更工作流时使用；触发词\"归档 / archive / 结束变更\"；NOT for 一次归档多个变更（改用 iagent_spec_bulk_archive）。"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(iagent:*), Bash(ls:*), Bash(codegraph:*), mcp__codegraph, mcp__codegraph__codegraph_status, mcp__codegraph__codegraph_files, mcp__codegraph__codegraph_search, mcp__codegraph__codegraph_context, mcp__codegraph__codegraph_node, mcp__codegraph__codegraph_callers, mcp__codegraph__codegraph_callees, mcp__codegraph__codegraph_impact, mcp__codegraph__codegraph_explore, Skill(requirement_doc)
license: MIT
compatibility: 依赖 iagent CLI（spec 命令组）与 CodeGraph CLI（可选）。
metadata:
  author: mi-agent-tools
  type: spec
  generatedBy: "snapshot"
  generatedFingerprint: "sha256:6cf0c2b743745afd8a3fcf90f245c7f036de9d314ffc133a5db5e225132d3837"
---

**适用项目护栏（impl 域蒸馏，见 .iagent/rules/coding-rules.md）。** 未定义项标 **[待确认]**，禁止猜测。

在变更工作流中归档一个已完成的变更。

**handoff 包（只读 + 追加）**：若 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md` 存在，本技能**只读**该包并在收尾时只向 `## 阶段结论` 追加一行（`phase=archive` / `status` / `artifact` / `nextAllowed`）；MUST NOT 重产整包。包缺失时按需直接读取制品；`sourceFingerprint` 与当前制品不一致时记 WARN 并以磁盘制品为准。

## 门白名单与 MUST NOT 确认清单

**必留门（正向枚举 5 类，缺一即流程安全缺陷）**：
- **需求澄清（需求 / 方案歧义）**：prompt-gate / grill-batch-confirmation / diagnostic-confirmation / fix-option-confirmation（可按条件豁免）
- **功能流程图门（流程基准确认）**：flow-final-confirmation（不可豁免）
- **实现 + 测试桥**：implementation-bridge（不可豁免）
- **归档桥**：archive-confirmation（不可豁免）
- **破坏性改动确认（动作级，不可豁免：删除目录 / 覆盖既有制品 / 改写版本库跟踪 / 不可逆命令）**（不可豁免）

**MUST NOT 请求确认（非门动作，MUST NOT 被实现为停止点）**：
- 阶段宣告（如「进入 Phase N」「本阶段开始」）
- 技能委派（含「是否调用 <技能>」类询问）—— 已授权的 nextAllowed 技能直接委派
- 只读扫描（Glob / Grep / Read 与只读查询）
- CodeGraph 查询与能力探测（含锁阶梯只读复用）
- 状态查询（`iagent spec status` / `getChangeStatus` 等）
- 只读校验的「是否运行 <校验>？」询问（如技术栈专项校验）—— 直接执行并在报告中说明校验项

> 跨变更索引重建类动作已随索引能力退役（DEC-2），不构成任何门或动作。

**Input**: 可选指定变更名；省略时检查能否从对话上下文推断。若含糊或有歧义，MUST 提示可用变更供用户选择。工作流也可能为自动执行直接传入变更名。

**Steps**

1. **未提供变更名时提示选择**

   若已提供变更名（来自 workflow 自动归档上下文），跳过选择提示，直接进入 Step 2（制品完成度检查）。

   否则运行 `iagent spec status --json` 获取可用变更，用 **AskUserQuestion tool** 让用户选择。

   只展示活动变更（尚未归档的）。
   可用时附带每个变更使用的 schema。

   **IMPORTANT**：不得猜测或自动选择变更。仅当变更名由工作流上下文显式提供时才跳过选择。

2. **检查制品完成状态**

   运行 `iagent spec status --change "<name>" --json` 检查制品完成度。

   解析 JSON 以了解：
   - `schemaName`：正在使用的工作流
   - `planningHome`、`changeRoot`、`artifactPaths` 与 `actionContext`：路径与范围上下文
   - `artifacts`：制品清单及其状态（`done` 或其他）

   若状态报告 `actionContext.mode: "workspace-planning"`，说明本切片不支持工作区归档并 STOP。不得把工作区变更移入仓库内归档目录，也不得编辑关联仓库。

   **若有制品状态不是 `done`：**
   - 展示告警并列出未完成的制品
   - 直接继续归档 —— 不提示确认（告警仅供参考）

3. **检查任务完成状态**

   读取任务文件（通常为 `tasks.md`）以检查未完成任务。

   统计标记为 `- [ ]`（未完成）与 `- [x]`（已完成）的任务数。

   **若发现未完成任务：**
   - 展示告警并给出未完成任务数
   - 直接继续归档 —— 不提示确认（告警仅供参考）

   **若不存在任务文件：** 继续，不做任务相关告警。

4. **评估 delta spec 同步状态并执行 AI 合并**

   **Markdown 源**：读取 `<changeRoot>/specs/<capability>/spec.md` 下的每个 delta spec 并直接应用其操作。按章节标题 `## ADDED Requirements` / `## MODIFIED Requirements` / `## REMOVED Requirements` / `## RENAMED Requirements` 对操作分类；REMOVED 携带 Reason/Migration，RENAMED 携带 FROM/TO。不得读取 JSON 镜像。

   **历史 JSON 降级（WARN）**：若 delta spec Markdown 缺失、只存在历史 `change.json`，记录 WARN（"delta spec Markdown 缺失 —— 降级到历史 JSON 的 specs 段"）并只读其 `specs` 段。主 Markdown 路径把每个 delta spec（`specs/<capability>/spec.md`）与主规格 `openspec/specs/<capability>/spec.md` 比对，并按类型分类操作：
     - **ADDED**：delta 中新增、主规格中不存在的需求/Scenario
     - **MODIFIED**：delta 中文本/细节已变更的需求或 Scenario
     - **REMOVED**：delta 中已删除的需求/Scenario
     - **RENAMED**：delta 中已改名的需求标识

   **若两个来源都没有 delta spec**：不做同步继续。

   **若存在 delta spec：**
   - 展示将要应用的合并摘要（ADDED/MODIFIED/REMOVED/RENAMED 各自计数）
   - 直接执行 AI 合并 —— 不提示同步选项（"Sync now" 即默认行为）
   - **内联 AI 合并流程**（不单独调用技能）：对每个 capability，把操作直接应用到主规格 `openspec/specs/<capability>/spec.md`：
     - ADDED → 在主规格的正确章节追加新需求（描述 + Scenario）
     - MODIFIED → 在主规格中就地替换对应的需求/Scenario
     - REMOVED → 从主规格中删除对应需求（`reason` / `migration` 值可在归档摘要中引用）
     - RENAMED → 更新主规格中的需求标识及所有交叉引用
   - 冲突解决与章节放置遵循 v1.1.20 specs-apply 合并语义
   - 记录日志："delta specs 已合并 —— 应用 <N> 个操作（A 新增 / M 修改 / R 删除 / N 重命名）"（附加 `[source: delta spec Markdown]` 或 `[source: legacy JSON fallback]` 以便追溯）

   **若已同步**：跳过同步并继续归档。

   **若同步失败**：记录告警并继续归档（非阻塞）。

4.5 **归档前 CONTEXT.md 同步（强制检查点）**

   **⚠️ 强制：归档前 MUST 检查 CONTEXT.md**

   归档前，系统 MUST 校验 CONTEXT.md 已包含全部变更相关术语：

   1. **检查 `openspec/CONTEXT.md` 是否存在**（用 Glob 或 Read 工具）

   2. **若已存在**：读取 CONTEXT.md，并扫描变更目录中应被记录的术语
      - 读取 `proposal.md` 获取关键领域术语（历史 JSON-only 降级时只读 change.json）
      - 读取 `design.md` 获取技术术语与决策（历史 JSON-only 降级时只读 change.json）
      - 与 CONTEXT.md 交叉比对 —— 若有术语缺失则自动补全
      - 记录日志："CONTEXT.md 已同步 —— 新增 <N> 个术语"

   3. **若不存在**：用变更中的关键术语创建 `openspec/CONTEXT.md`
      - 从 `proposal.md` 的 Why 提取领域术语
      - 从 `design.md` 的 Decisions 提取技术术语
      - 格式：`**<Term>**: <definition>\n_Avoid_: <synonyms>`
      - 记录日志："CONTEXT.md 已创建 —— 来自变更制品的 <N> 个术语"

   4. **兼容性检查**：若变更既无 Markdown 制品也无历史 JSON，跳过并记录日志：
      "跳过 CONTEXT.md 同步：未找到变更制品"

   **强制检查点**：
   - 系统 MUST 在执行归档前完成 CONTEXT.md 检查
   - CONTEXT.md 缺失时，从变更制品自动创建
   - 不得因检查失败而阻塞归档 —— 记录日志并继续

4.6 **归档前 CodeGraph 能力探测（强制检查点）**

   **⚠️ 强制：归档前 MUST 探测 CodeGraph 是否可用**

   归档前按能力探测顺序判定可用性（任一通道成功即视为可用）：

   **CodeGraph 能力探测（按顺序尝试，三条通道任一成功即视为可用）**：
1. 先调用 MCP 具名工具（`codegraph_explore` / `codegraph_status` 等）——能返回结果即视为可用；
2. 若 MCP 具名工具未暴露，改看 `codegraph_explore` 返回的**时效横幅**（含索引构建/滞后提示）——横幅存在即视为可用；
3. 若前两条通道均不可得，再经 Bash 运行 `codegraph status --json`——命令成功并返回 JSON 即视为可用。
- **工具名缺失 ≠ 索引不可用**：某一通道在当前宿主不存在，只说明该通道不可用，MUST NOT 据此断言索引未初始化。
- MUST NOT 用「`.codegraph/` 目录是否存在」判定索引可用性（点号目录的 Glob 存在假阴性）；目录存在性不构成可用性判据。

   **CodeGraph 锁阶梯（读锁优先；误删活跃锁会损坏索引）**：
1. **读取** `.codegraph/writer.pid`（用 `path.join()` 构造显式路径）：文件缺失或为空 → 视为**无 daemon**，可进入 unlock 分支；
2. **解析**：该文件为 **JSON**（形如 `{"pid":19488,"mode":"daemon","startedAt":<ms>,"ready":true}`），MUST NOT 假定为裸数字；JSON 解析失败 / `pid` 非正整数 / `ready:false` → 视为**不可判定 = 存活**：MUST NOT `codegraph unlock`、MUST NOT 显式 `codegraph sync`，只读复用索引，查询失败则降级 Glob / Grep 并记 WARN，且 MUST NOT 删除该文件；
3. **存活判定**：`pid` 可用时以只读、无副作用的方式探测进程是否存在（`process.kill(pid, 0)` 语义或平台等价的只读探测）——MUST NOT 执行任何终止动作；
4. **存活 → 只读复用既有索引**：daemon 是合法写者，MUST NOT 执行 `codegraph unlock`、MUST NOT 显式 `codegraph sync`；
5. **不存活 → 执行一次 `codegraph unlock`**，随后重试读取一次；仍失败 → 降级 Glob / Grep 并记 WARN；
6. **仅确认无 daemon（纯 CLI 用户）时**才按需执行一次 `codegraph sync`；同步失败只记 WARN，不阻断流程；
7. 判 daemon 存活是显式路径读取（失败即视为无 daemon），与「MUST NOT 用目录存在性判索引可用性」是两条独立判据，MUST NOT 混用。

   **强制检查点**：
   - 系统 MUST 在执行归档前完成能力探测（三条通道任一成功即视为可用）
   - 三条通道全部失败 → 自动跳过**全部** CodeGraph 步骤（本 4.6 检查 + 6.5 同步），记录 WARN 说明当前不可用且已跳过，继续归档 —— 不得询问用户是否重试或继续
   - MUST NOT 用「`.codegraph/` 目录是否存在」判定可用性（点号目录的 Glob 假阴性会把 CodeGraph 误判为未初始化）
   - 不得因探测失败而阻塞归档 —— 记录日志并继续
   - 与 4.5 的 CONTEXT.md 检查点理念保持一致

4.7 **归档前探索记忆同步（强制检查点）**

   **⚠️ 强制：归档前 MUST 把探索记忆同步到能力规格**

   在 delta spec 同步评估之后、把变更目录移入归档**之前**执行：

   1. **检查变更目录中的探索文件**（`exploration.md`）
      - 缺失时：记录日志"跳过探索记忆同步：无探索文件"，并跳过本检查点

   2. **确定能力归属**
      - 从 `specs/<capability>/` 子目录枚举能力（历史 JSON-only 降级时只读 change.json 的 specs 段）
      - 若变更没有 delta spec：无法确定能力归属 —— 记录日志"跳过探索记忆同步：无 delta spec"并跳过

   3. **对每个涉及的能力 `<capability>`**：
      - 目标文件：`openspec/specs/<capability>/explorations.md`（用 `path.join()`）
      - 文件不存在时：创建它，并写一句简短说明，指出该文件承载此能力的累积探索记忆
      - 从变更的 exploration.md 提取关键记忆：Decisions、术语表、边界场景、Codebase Findings 要点 —— 不得复制过程性内容（逐题问答、Decision Process）
      - 追加新章节 `## <change-name>（归档日期 YYYY-MM-DD）`，写入提取出的记忆
      - 若新决策与同一文件中先前变更的决策冲突：用 `> 已过时（由 <change-name> 取代）` 标记过时章节 —— 不得删除历史内容

   4. **失败处理（非阻塞）**：
      - 若记忆同步失败（如目标目录不可写）：记录告警，不阻塞归档

   **强制检查点**：
   - 系统 MUST 在移动变更目录前完成探索记忆同步
   - 变更的 exploration.md 仍随变更一起移入归档目录（提取是复制，不是移动）
   - 不得因同步失败而阻塞归档 —— 记录日志并继续

4.8 **归档前需求文档检查点（强制检查点，状态感知）**

   **⚠️ 强制：确保需求文档在归档移动之前已存在并对齐，且尊重父流程已持久化的文档决定**

   在探索记忆同步（4.7）之后、移动变更目录（5）**之前**执行。检查点同时读取**两件事**：

   - 变更目录内 `需求文档.md` 是否存在（`openspec/changes/<change-name>/需求文档.md`，用 `path.join()` 构建）
   - 该变更 `exploration.md` 的 `## 需求文档状态` 段（字段 `requirementDocStatus`）

   **优先级（强制）：文档文件存在 > 持久状态** —— 文件存在时无论状态为何都走"已存在"分支（就地增量对齐）；状态只裁决"文件缺失"分支。

   **状态取值（四值模型）**：

   | 取值 | 含义 | 文档缺失时的处理 |
   |------|------|------------------|
   | `absent` | 该段缺失或取值非法（**不落盘**） | 历史兼容：以非交互模式委派 `iagent_requirement_doc` |
   | `skipped-by-user` | 用户在父流程文档桥明确选择跳过 | 报告跳过并继续归档，MUST NOT 生成 |
   | `generation-failed` | 父流程文档桥委派生成失败 | 输出 WARN 并继续，MUST NOT 静默重试 |
   | `generated` | 父流程文档桥生成成功（终态） | 输出 WARN（"曾生成但文件缺失"）并继续，MUST NOT 重建 |

   **执行步骤（顺序固定）**：

   1. **读取状态与文件存在性**（一次读取）：读 `exploration.md` 的 `## 需求文档状态` 段 + 检查 `需求文档.md` 是否存在

   2. **I/O 失败语义（强制）**：读取失败 → 自动重试同一读取**一次** → 仍失败即停止（MUST NOT 第二次或无限重试）：
      - MUST NOT 把状态视为 `absent` —— MUST NOT 进入历史兼容生成分支
      - MUST NOT 生成需求文档
      - 文档已存在时仍按"文档已存在"分支对齐；文档缺失时输出含目标路径与原因的 WARN 与恢复指引
      - 读取失败 MUST NOT 阻断归档

   3. **分支 A —— 文档已存在（任何状态，含 `skipped-by-user`）**：对该文件执行 **in-place（就地）增量对齐更新**。`## 基本信息`（需求编号 / 需求名称 / 交付时间，含占位符状态）与 `## 八、评审记录` 属**人工域**，MUST NOT 覆盖 —— 逐字保留；`一~七` 章节 SHALL 从**当前** Markdown 源（`proposal.md` / `design.md` / `specs/**/*.md` / `tasks.md`）重新推导。本分支**不得调用 `iagent_requirement_doc`** —— 该技能自身规则是"目标文件已存在时静默覆盖"，会抹掉人工撰写的评审内容。对齐 MUST NOT 删除章节（仅可丢弃制品中已移除的内容）；若文档结构已损坏，重建缺失章节并记录 WARN

   4. **分支 B —— 文档缺失且 `skipped-by-user`**：报告"用户已选择跳过需求文档生成"并继续归档；MUST NOT 调用 `iagent_requirement_doc`、MUST NOT 生成

   5. **分支 C —— 文档缺失且 `generation-failed`**：输出含原因的 WARN（用户曾确认生成但首次委派失败），继续归档；MUST NOT 静默重试生成（用户可手工重跑需求文档技能）

   6. **分支 D —— 文档缺失且 `generated`**：输出 WARN（"曾生成但文件缺失"），继续归档；MUST NOT 重新生成

   7. **分支 E —— 文档缺失且 `absent`（历史兼容）**：以**非交互模式**委派 `iagent_requirement_doc` 技能并传入变更名 —— 不向用户提问，基本信息用占位符；文档写入 `openspec/changes/<change-name>/需求文档.md`

   8. **失败处理（非阻塞）**：若生成、对齐或检查失败，记录 WARN（含目标路径与原因），然后继续归档 —— 绝不因本检查点阻塞归档，也绝不静默宣称成功

   **强制检查点**：
   - 系统 MUST 在移动变更目录前完成需求文档检查点
   - 显式状态（`skipped-by-user` / `generation-failed` / `generated`）与文档存在性共同裁决分支，MUST NOT 一律走旧生成行为
   - 生成的文档留在变更目录内并随其移动；随后既有 Step 6 会把它迁移到 `openspec/devdocs/`
   - 不得因生成或对齐失败而阻塞归档 —— 记录日志并继续


5. **执行归档**

   运行 iagent CLI 归档命令 —— 它一步完成状态检查与目录移动：
   ```bash
   iagent spec archive "<name>" --yes
   ```

   若 `openspec/changes/` 下不存在 `archive` 目录则创建它，生成带日期的目标名 `YYYY-MM-DD-<change-name>`，并把 `changeRoot` 移动到 `openspec/changes/archive/YYYY-MM-DD-<name>/`。

   **若命令因目标归档目录已存在而失败**：报告该错误，并建议重命名既有归档、若为重复则删除、或改到另一个日期。不得覆盖。

   保留 `.openspec.yaml` 与 `attachments/` 子目录 —— 它们会随变更目录自动移动。

6. **把需求文档移入 devdocs（若存在）**

   变更目录移入归档后，检查归档后的变更是否含已生成的需求文档：

   ```bash
   ls "openspec/changes/archive/YYYY-MM-DD-<name>/需求文档.md"
   ```

   - **若文件存在**：把它移动到 `openspec/devdocs/YYYY-MM-DD-<change-name>-需求文档.md`
     - `YYYY-MM-DD` 前缀取自同一归档目录名（与归档命令的目录命名逻辑一致）
     - 若归档目录名不含可解析的 `YYYY-MM-DD-` 前缀，降级为不带时间戳的 `openspec/devdocs/<change-name>-需求文档.md`
     - devdocs 目录不存在则创建（用 `path.join()`）；目标已存在则覆盖
   - **若文件不存在**：静默跳过本步骤 —— 不报错、不告警，继续归档流程

6.5 **归档后 CodeGraph 同步 + 验证（条件执行，daemon 感知）**

   **仅当 Step 4.6 判定 CodeGraph 可用时才执行。** 若 Step 4.6 三通道全部失败，整体跳过本步骤。

   1. **先判 daemon 存活**（读取 `.codegraph/writer.pid`，判据见 Step 4.6 的锁阶梯）：
      - **daemon 存活（含 `ready:false` / 解析失败等不可判定态）** → MUST NOT 执行 `codegraph sync`、MUST NOT 执行 `codegraph unlock`；直接只读复用既有索引，进入第 2 步验证
      - **确认无 daemon（纯 CLI 用户）** → 经 Bash 执行 `codegraph sync` **恰一次**，增量索引刚归档变更已实现的代码；运行前展示 "CodeGraph：正在同步已实现的代码..."

   2. 同步（或只读复用）后**验证一致性**：
      - 用 MCP `codegraph_search` 查询变更名，以及变更 `tasks.md` 与 `design.md` 中提到的关键符号
      - 确认已实现的符号现已被索引
      - 展示 "CodeGraph：✓ 索引中已校验 N 个符号"，无匹配时告警
      - 若未找到符号（如仅配置或仅文档变更），记录告警 —— 不要视为失败

   3. **失败处理**（非阻塞）：
      - `codegraph sync` 失败（CLI 错误、超时或 CLI 不在 PATH）：记录告警，不阻塞归档
      - 锁冲突按 Step 4.6 的锁阶梯处置：存活只读复用；不存活 `unlock` 一次 + 重试读取一次；仍失败降级 Glob / Grep 并记 WARN
      - 验证查询失败或返回空：记录告警，不阻塞归档
      - CodeGraph 同步独立于 `--skip-specs` / `--no-validate` / 跳过校验的选择执行

7. **更新或创建 ARCHIVE-INDEX.md**

   **IMPORTANT**：workspace 范围的变更（actionContext.mode: "workspace-planning"）跳过本步骤。

   归档索引文件位于 `openspec/changes/archive/ARCHIVE-INDEX.md`。

   **文件不存在时创建它**：
<!-- CMD:SKIP -->
   ```markdown
   # OpenSpec 变更归档索引

   > 本文档记录所有已归档的变更提案，便于历史追溯和查阅

   ---

   ## 归档变更列表

   | 归档日期 | 变更名称 | 所属模块 | 主要内容 |
   |----------|----------|----------|----------|
   | YYYY-MM-DD | change-name | module | description |

   ---

   ## 模块统计

   | 模块 | 归档数量 | 变更列表 |
   |------|----------|----------|

   ---

   *更新时间: YYYY-MM-DD*
   ```
<!-- /CMD:SKIP -->

   **文件已存在时追加新条目**：
<!-- CMD:SKIP -->

   a. 提取条目信息：
      - **归档日期**：取自归档目录名 `YYYY-MM-DD-{change-name}`
      - **变更名称**：取自目录名（日期前缀之后）
      - **模块**：从变更名模式 `{prefix}-{module}-{feature}` 提取，无法判断时用 "general"
      - **摘要**：`proposal.md` Why 的首段（历史 JSON-only 降级时只读 change.json；最多 50 字符）
      - **补充标注**：读取变更目录中的 `tasks.md`（历史 JSON-only 降级时只读 tasks.json），通过**匹配固定标签白名单**收集补充任务类型 `[测试]` / `[DB脚本]` / `[使用说明]`（排除 `[代码]`），并把 `[含<type1>/<type2>/...]` 追加到摘要（如 `[含测试/DB脚本]`）。只按白名单匹配 —— 不得收集"所有方括号内容"：`[测试]` 任务带层级/优先级子标注（`[测试][单元][P0]`），其中 `[单元]`/`[P0]` 不是任务类型，收集它们会产生 `[含测试/单元/P0]` 噪声。白名单之外的标签一律忽略（非阻塞；MAY 记录 WARN）。若无补充任务，跳过标注。

   b. 向 "归档变更列表" 表新增一行：
      `| {date} | {change-name} | {module} | {summary} |`

   c. 更新 "模块统计" 表：
      - 已有模块计数 +1
      - 新模块新增一行（计数：1）

   d. 把页脚时间戳更新为当前日期
<!-- /CMD:SKIP -->

   **跨平台说明**：Windows 上用 `path.join()` 构建路径。检查文件是否存在时注意大小写敏感性差异。

8. **展示摘要**

   展示归档完成摘要，包含：
   - 变更名称
   - 使用的 Schema
   - 归档位置
   - 规格是否已同步（如适用）
   - 归档索引更新状态
   - CodeGraph 同步状态（已同步 / 跳过 —— 未初始化或出错）
   - 探索记忆同步状态（已同步 / 跳过 —— 无探索文件或无 delta spec / 失败 —— 已记录告警）
   - 需求文档状态（就地已对齐 / 用户已跳过未生成 / 生成失败 WARN 未重试 / 曾生成但文件缺失 WARN 未重建 / 历史兼容已生成 / 状态读取失败 WARN 未生成 —— 均附原因）
   - 关于任何告警的说明（未完成的制品/任务）

**Output（成功）**

```
## Archive Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** openspec/changes/archive/YYYY-MM-DD-<name>/
**Specs:** ✓ Synced to main specs (or "No delta specs" or "Sync failed — warning logged" or "主规格未同步（skip_specs 声明）")
**Archive Index:** ✓ Updated ARCHIVE-INDEX.md
**Exploration Memory:** ✓ Synced to specs/<capability>/explorations.md (or "Skipped — no exploration file" or "Skipped — no delta specs" or "Failed — warning logged")
**Requirement Document:** ✓ Generated → openspec/devdocs/YYYY-MM-DD-<name>-需求文档.md (or "✓ Aligned in place (人工域 preserved)" / "Skipped — user chose to skip" / "WARN: generation previously failed — not retried" / "WARN: previously generated but file missing — not rebuilt" / "WARN: status unreadable — not generated" / "Failed — warning logged: <reason>")
**CodeGraph:** ✓ Synced (or "Not initialized — skipped" or "Sync skipped due to error")

All artifacts complete. All tasks complete.
```

<!-- CMD:SKIP -->
**Output（成功但含告警）**

```
## Archive Complete (with warnings)

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** openspec/changes/archive/YYYY-MM-DD-<name>/
**Specs:** ✓ Synced to main specs

**Warnings:**
- Archived with 2 incomplete artifacts
- Archived with 3 incomplete tasks

Review the archive if this was not intentional.
```

**Output（出错：归档已存在）**

```
## Archive Failed

**Change:** <change-name>
**Target:** openspec/changes/archive/YYYY-MM-DD-<name>/

Target archive directory already exists.

**Options:**
1. Rename the existing archive
2. Delete the existing archive if it's a duplicate
3. Wait until a different date to archive
```
<!-- /CMD:SKIP -->

**Guardrails**
- 未提供变更时始终提示选择（除非变更名由工作流上下文显式传入）
- 用制品图（iagent spec status --json）做完成度检查
- 不要因告警阻塞归档 —— 仅告知（无需确认）
- 移入归档时保留 .openspec.yaml（它随目录一起移动）
- 保留 `attachments/` 子目录 —— 它随变更目录自动移动
- 为 ARCHIVE-INDEX.md 提取摘要时，扫描 `tasks.md` 的补充类型标签，并把 `[含xxx]` 标注追加到摘要
- 归档移动前，为每个涉及的能力把探索记忆同步到 specs/<capability>/explorations.md；exploration.md 或 delta spec 缺失时跳过（并记日志）；绝不因同步失败阻塞归档
- 预归档检查点（4.8）按“文件存在优先 + 状态裁决缺失分支”分流：已存在 → 就地增量对齐并逐字保留人工域（`## 基本信息` / `## 八、评审记录`），该分支绝不调用生成技能；缺失时 `skipped-by-user` 不生成、`generation-failed` 与 `generated` 仅 WARN 不重试、仅 `absent` 走历史兼容生成；状态或文件存在性读取失败重试一次仍失败时不视为 `absent`、不生成（文档存在仍对齐）；绝不因生成或对齐失败阻塞归档
- 当变更声明 `skip_specs`（状态报告 specs 为 skipped）时，归档摘要 MUST 注明 "主规格未同步（skip_specs 声明）"，避免用户误以为规格同步被遗漏
- 清晰展示发生了什么
- 若存在 delta spec，执行同步评估、展示合并摘要，并直接执行内联 AI 合并（ADDED/MODIFIED/REMOVED/RENAMED → 主规格，遵循 v1.1.20 specs-apply 语义）
- 归档流程不含任何索引重建：跨变更 SQLite 索引能力已退役，MUST NOT 出现索引重建类步骤
