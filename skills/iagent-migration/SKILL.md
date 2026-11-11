---
name: iagent-migration
description: "一站式自动化功能迁移（auto migration / 功能迁移）：经 feature_doc 蒸馏源项目 + 用户确认核心功能清单 → 加载目标项目编码规范 → 生成标准 OpenSpec 变更提案 → 实现门后按规范实现 → 主 agent 内联调用 iagent-migration-check 交叉核对源/目标功能并产出带证据的复查报告 + P0/P1 修复循环（超上下文阈值时降级子代理 + WARN）。当用户要把源项目的功能或模块自动迁移到当前（目标）项目时使用；触发词\"功能迁移 / auto migration / 迁移功能 / 源项目迁移\"；NOT for 单独的源项目扫描（用 iagent-feature-doc）或单独迁移后对比（用 iagent-migration-check）。"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(iagent:*), mcp__codegraph, mcp__codegraph__codegraph_status, mcp__codegraph__codegraph_files, mcp__codegraph__codegraph_search, mcp__codegraph__codegraph_context, mcp__codegraph__codegraph_node, mcp__codegraph__codegraph_callers, mcp__codegraph__codegraph_callees, mcp__codegraph__codegraph_impact, mcp__codegraph__codegraph_explore, Skill(iagent-feature-doc), Skill(iagent-migration-check), Agent, Task
license: MIT
compatibility: 依赖 iagent CLI（spec 命令组）；CLI 缺失时降级为 AI 内联生成（CLI-degraded generation）。
metadata:
  author: mi-agent-tools
  type: impl
  generatedBy: "snapshot"
  generatedFingerprint: "sha256:9f73d25b91f14c7c433d6fe3409317425bff1ad56c86ac49be0767c8f3c06274"
---

**适用项目护栏（impl 域蒸馏，见 .iagent/rules/coding-rules.md）。** 未定义项标 **[待确认]**，禁止猜测。

一站式自动功能迁移，四阶段推进：生成源需求文档并蒸馏确认核心功能 → 探索目标项目（含目标编码规范加载）+ 生成变更提案 → 实现确认门 → 主 agent 内联复查并进入修复循环。流程结构与规格驱动工作流（`/iagent:spec-explore` → `/iagent:spec-propose` → `/iagent:spec-apply`）及一站式引导工作流 `/iagent:workflow`（探索 → 提案 → 验证）一致；探索与提案生成自动进行（一致性直通）。流程中有两个性质不同的中途确认点：Phase 1 的**蒸馏确认**（需求澄清门 —— 确认迁移什么 WHAT）与 Phase 3 的**实现门**（流程门 —— 确认如何实现 HOW）；Phase 2→3 的一致性直通不受影响。

**输入**：源项目路径与待迁移的目标模块描述（可选；缺失项在 Step 0 交互式收集，已提供的跳过）。

**Trigger boundary**：本技能编排**完整**迁移管线（扫描源项目 → 变更提案 → 实现 → 迁移对比）。单独的源项目扫描属于 `iagent-feature-doc`；单独的迁移后对比属于 `iagent-migration-check`。

## ⛔ GATE PROTOCOL — ACTIVE

本技能包含以 **⛔ GATE:** 标记的**确认门**。每个门都是硬性停止点：
- 走到 ⛔ GATE 时，**本次响应到此结束** —— 输出门内容后立即停止
- 不得执行、描述或预生成门之后的任何步骤
- 用户的下一则消息即为确认信号 —— 仅在其响应后从门之后继续
- **非门动作 MUST NOT 停止，也 MUST NOT 请求确认**：阶段宣告 / 技能委派（含「是否调用 <技能>」）/ 只读扫描 / CodeGraph 查询 / 状态查询 / 只读校验的「是否运行 <校验>？」询问，均不是确认门
- **只有**门白名单（见「门白名单与 MUST NOT 确认清单」段）声明的 5 类门可以阻断推进；白名单外的动作 MUST NOT 被实现为停止点
- **违规**：未经用户确认而执行门之后的步骤，是破坏工作流的严重错误

## 门白名单与 MUST NOT 确认清单

**必留门（正向枚举 5 类，缺一即流程安全缺陷）**：
- **需求澄清（需求 / 方案歧义）**：prompt-gate / grill-batch-confirmation / diagnostic-confirmation / fix-option-confirmation / design-confirmation（可按条件豁免）
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

---

## Step 0: 收集迁移输入

收集（用户提问 逐个询问缺失项；已提供的跳过）：

| 输入 | 必填 | 说明 |
|------|------|------|
| SOURCE_PROJECT (源项目根目录) | 是 | 路径必须存在且可读 —— 无效路径 → 明确报错并要求重新输入，绝不猜测修正 |
| 功能入口 | 是 | 文件路径 / URL 路由 / 模块名 / 整个项目 |
| TARGET_PROJECT (目标项目根目录) | 否 | 默认取当前项目 |
| 源项目框架档案 | 否 | 框架未知 → 自动探测结构，结果以 **[待确认]** 呈现给用户确认（规则同 iagent-feature-doc） |
| 目标项目框架档案 | 否 | 收集规则相同；目标架构信息供 Phase 2 使用 |
| 迁移范围说明 | 否 | 用户给出的约束（例如仅后端、保留数据库 schema） |

所有路径 MUST 用 `path.join()` 拼接（跨平台：Windows 盘符 + POSIX 分隔符）。

## Phase 1: 生成源需求文档（自动）

1. 先确定变更名（遵循项目的变更命名约定，例如功能迁移用 `add-<module>-<feature>`），并用 `path.join()` 创建 `openspec/changes/<change-name>/attachments/source-feature-doc/` —— Phase 1 的全部产出直接落在该目录，不做暂存或搬运。
2. 以**非交互模式**委派 **iagent-feature-doc** 技能：注入 SOURCE_PROJECT、功能入口、输出模式 = 迁移重构模式、源项目框架档案，以及第 1 步的输出目录。
3. 生成的需求文档是本次迁移的唯一真源。其中缺口保持 **[待确认]** 标记 —— 在 Phase 2 之前与用户确认解决，不得猜测。
4. **蒸馏并确认核心功能（蒸馏确认）**：从需求文档中蒸馏出核心功能清单（核心功能、业务规则、API 契约要点 —— 蒸馏产物，不是整份文档）。将清单提交用户确认（用户提问；用户可删减条目）。清单与文档/源码不一致处标 **[待确认]** 并由用户裁决（修正清单或更新文档）—— 不得猜测。清单**为空即阻断**流程：请用户重新扫描源项目或收窄功能入口 —— 绝不允许带着空清单继续。确认后把清单写入 `openspec/changes/<change-name>/exploration.md` 的 `## 蒸馏核心功能清单` 段（该文件在 Phase 1 末尾创建；Phase 2 第 1 步合并探索材料时保留此段）。确认后的清单既是 Phase 2 提案的派生输入，也是 Phase 4 的复查范围基线；用户删减的条目记录在 exploration.md 中，并**排除**在 Phase 4 复查范围之外（绝不计为功能缺失 P0/P1）。

## Phase 2: 目标项目探索 + 变更提案生成（自动，无中途确认）

1. 变更目录已存在（Phase 1 创建）。把探索材料（源需求文档摘要 + 目标项目探索发现）迁移进 `openspec/changes/<change-name>/exploration.md` —— 保留 Phase 1 写入的 `## 蒸馏核心功能清单` 段。
2. **source-scan 由主 agent 内联执行**：以 CodeGraph 优先的方式探索 TARGET 项目（可选含 SOURCE_PROJECT）：按下面的能力探测顺序判定可用性（任一通道成功即可用），再以 CodeGraph 工具作为主要调查路径；按只读直通原则，CodeGraph 查询、文件读取、配置解析无需确认直接执行；CodeGraph 不可用 → 自动降级为 Glob/Grep 并记录一行日志。source-scan MUST NOT 派生源扫描子代理。

   **CodeGraph 能力探测（本技能不执行 CLI：仅两通道，任一成功即视为可用）**：
1. 先调用 MCP 具名工具（`codegraph_explore` / `codegraph_status` 等）——能返回结果即视为可用；
2. 若 MCP 具名工具未暴露，改看 `codegraph_explore` 返回的**时效横幅**（含索引构建/滞后提示）——横幅存在即视为可用。
- 本技能不执行 CLI：第三通道（CLI 状态查询）不适用，MUST NOT 据其判定索引不可用。
- **工具名缺失 ≠ 索引不可用**：某一通道在当前宿主不存在，只说明该通道不可用，MUST NOT 据此断言索引未初始化。
- MUST NOT 用「`.codegraph/` 目录是否存在」判定索引可用性（点号目录的 Glob 存在假阴性）；目录存在性不构成可用性判据。

   **CodeGraph 调用纪律（主通道优先，串行执行）**：
1. **主通道**是 `codegraph_explore`（文件结构发现 / 符号定位 / 任务级上下文均可用一次自然语言查询完成）；`codegraph_impact` 为**可选增强**；
2. `codegraph_files` / `codegraph_search` / `codegraph_context` / `codegraph_node` / `codegraph_callers` / `codegraph_callees` 为「**宿主暴露时可选**」通道：缺失时改用主通道，MUST NOT 记为「索引不可用」，MUST NOT 反复调用缺失工具；
3. **一次广查询优先**：多符号或多主题合并为一次 `codegraph_explore`；单次查询 `maxFiles` 默认不超过 12；
4. **串行**：同一时刻只发一个 CodeGraph 调用；需要多次查询时串行执行，MUST NOT 并行发起多个调用（并发正是 busy 排队的来源）。

   **CodeGraph busy 阶梯（排队不是错误，也不是索引不可用）**：
1. 识别 `busy serving other concurrent requests` 一类排队文案时，**等待 5–10 秒**；
2. 重试**同一调用**（同一查询参数），至多 **2 次**；
3. 仍 busy → 在**本步骤**降级为内置工具（Glob / Grep）并记 WARN，随后继续流程；
4. MUST NOT 因 busy 判「索引不可用」，MUST NOT 执行 `codegraph unlock` 或显式 `codegraph sync`。

3. **上下文阈值判定（source-scan 后，强制）**：source-scan 完成后判定**计划读取文件数**与**制品总行数**：计划读取文件数 > **300** 或制品总行数 > **15000（15k）** 时，后续内联阶段（Phase 2 探索 / 制品生成与 Phase 4 复查）SHALL 降级为子代理执行并记 WARN（`migration-context-threshold-degraded`）；MUST NOT 在上下文不足时静默继续内联。阈值是初始可调常量，降级事实 MUST 在最终报告中可见。

4. **加载目标项目编码规范（目标项目规范加载）**：读取 TARGET 项目的规范文件 —— CLAUDE.md、AGENTS.md 与 openspec 主规格（`openspec/specs/`）—— 把规范要点（命名/分层/目录约定、强制规则）蒸馏进 `exploration.md` 的 `## 目标项目规范要点` 段。这些要点是 design/tasks 派生（第 5 步）与 Phase 3 实现的**约束性**要求。无规范文件时：记录 WARN，改由目标代码结构（命名/分层/目录模式）推断约定作为替代，推断结果标 **[待确认]**，并继续推进 —— 不阻断。
5. 按 propose 协议生成标准 OpenSpec 变更制品：
   - `iagent spec status --change "<name>" --json` → `iagent spec instructions <artifact-id> --change "<name>" --json` → 写入制品文件；按依赖顺序循环（proposal → specs → design → tasks）。
   - **CLI 降级生成**：首次 `iagent spec status` 调用以命令不存在特征失败（"command not found" / "不是内部或外部命令" / "not recognized"）时，一次性说明结论，改为纯 AI 按模板内置依赖顺序生成全部制品；流程中途不得重试 CLI 调用。
   - spec 场景、design 决策与 tasks MUST 派生自源需求文档 + 已确认核心功能清单 + 目标架构 + 目标项目规范要点；每一项派生都能回溯到源文档（反幻觉：不编造字段、接口或业务规则）。
6. 探索与提案之间不设确认提示（一致性直通）—— 直接进入 Phase 3。

## Phase 3: 实现确认门（流程门）

**⛔ GATE: 实现确认门（强制停止）**

1. 呈现统一实现计划：变更名、任务分组 / 并发批次、受影响文件与迁移范围。
2. 只问一个问题（用户提问）：是否需要调整（调整计划 / 制品）？
   - **不调整（继续）** → 立即按 apply 协议实现：**由主 agent 单 agent 分批实现**（不再派发子代理），每批单元数取自 `openspec/config.yaml`（`apply.concurrency`，默认 3）；批内独立只读可并行、写同一文件串行；任务 checkbox 由主 agent 集中更新。进入实现阶段时，先判断 handoff 包（`.openspec-tmp/pipeline-<change-name>/handoff-pack.md`，见 apply 协议）是否可用：
     - **包可用** → 目标项目规范要点（`exploration.md` → `## 目标项目规范要点`）MUST 写入 handoff 包的 `## 规范要点` 段，与 `.iagent/rules/coding-rules.md` 要点合并作为附加来源；目标项目要点仍是**约束性**要求，确保迁移代码符合 TARGET 项目约定。
     - **包不可用** → 降级为内联注入（每次实现前内联规范要点）+ WARN；迁移实现 MUST NOT 被阻断。
     - **无目标项目规范要点**（目标项目既无规范文件，Phase 2 也未蒸馏出内容）→ 在包的 `## 规范要点` 段记录 `no target-project spec essentials` + WARN，并继续推进 —— 不阻断流程。
     - 每次实现 MUST NOT 全文内联规范要点 —— 改为引用 handoff 包的 `## 规范要点` 段。
   - **需要调整（调整）** → 呈现制品供编辑；用户修改后重新进入本门（再问一次）。
3. 失败任务遵循 apply 重试规则（串行重试一次 → 暂停并报告）。实现失败即暂停流程；绝不静默跳过任务。

## Phase 4: 主 agent 内联复查 + 修复循环

1. **主 agent 内联复查**：由**主 agent 内联**交叉核对源/目标功能并产出报告（`executionMode=inline`），MUST NOT 为复查启动子代理。**直接非交互调用 iagent-migration-check 技能**（由主 agent 内联），显式注入全部输入：已确认核心功能清单（exploration.md 路径）、源需求文档路径、目标实现范围、SOURCE_PROJECT、TARGET_PROJECT、双方框架档案，以及输出目录 `openspec/changes/<change-name>/attachments/migration-check/`。技能委派 —— 不得内联重实现对比逻辑；在对比结果之上叠加核心功能交叉核对（功能覆盖矩阵 + 差异说明），产出最终复查报告。**每条结论 MUST 带 `文件:行` 证据**（无证据结论 MUST NOT 计入通过）。复查范围**排除**用户删减的功能（绝不计为功能缺失 P0/P1）。**上下文阈值**：若 source-scan 后判定超阈（> 300 文件或 > 15k 行），本步 SHALL 降级为子代理执行并记 WARN；未超阈时 MUST 内联。

   **B组架构融入检查**：内联复查 MUST 在迁移检查结果之上再执行 3 项架构一致性检查：
   - **C11 — 异常体系融入检查**：扫描目标迁移代码中残留的源项目异常处理构造（例如源项目专有异常类、吞掉错误的空 catch 块）。残留的源项目错误处理构造属 P0 问题。
   - **C12 — 工具类复用检查**：检查迁移代码是否重复实现了目标项目已有的工具类或辅助功能（例如重复造已有的 helper 函数或工具类）。重复实现属 P1 问题。
   - **C13 — 架构一致性检查**：核对迁移代码是否遵循目标项目的分层、包命名与目录约定。架构不一致属 P2 问题。

   B组检查发现 MUST 与迁移检查结果合并进同一份最终复查报告，使用相同的 P0/P1/P2 分级。
2. **复查失败降级链**（绝不静默跳过复查）：**串行重试一次** → 仍失败，输出 WARN 并以 COMPLETE-WITH-WARNING 结束流程（主流程已直接内联调用，不再需要「主流程直调」降级环节）。
3. 读取检查报告（P0/P1/P2 问题清单）。
4. 修复循环：
    - **发现 P0/P1** → 呈现问题清单 + 修复建议 → 请用户确认修复 → 应用修复（同时改代码 AND 直接编辑变更 `tasks.md` —— 勾选已完成任务并追加新增/更新任务；MUST NOT 写入或重新渲染 `tasks.json`）→ **在同一上下文**重跑迁移检查（回到本阶段第 1 步，按修复增量覆盖受影响范围；MUST NOT 新开复查代理或全量重读）。重复直到无 P0/P1。
    - **用户中止循环或达到重试上限** → 输出当前问题清单快照，记录 WARN，并以 COMPLETE-WITH-WARNING 结束流程（不是失败）。
    - **仅有 P2** → 在报告中记录问题并正常结束流程；P2 从不阻断。
5. 最终输出：变更名、已完成任务摘要、源需求文档路径、迁移检查报告路径、剩余 P2 问题（如有）。

---

## Output

```
## Auto Migration Complete (or Complete with Warnings)

**Change**: <change-name>
**Source requirement doc**: openspec/changes/<change-name>/attachments/source-feature-doc/...
**Migration check report**: openspec/changes/<change-name>/attachments/migration-check/...
**Tasks**: N/M complete
**遗留问题**：P0: 0 | P1: 0 | P2: <n>（已记录，非阻断）

Ready for /iagent:spec-archive (after review)
```

## Guardrails

- **只读直通**：文件读取、CodeGraph 查询与分析步骤无需确认直接执行；确认点是蒸馏确认（Phase 1，需求澄清门）、实现门（Phase 3）与修复确认（Phase 4）。
- **零猜测**：源项目中任何未确认的字段/接口/规则标 **[待确认]** 并与用户确认解决 —— 绝不猜进提案或实现。
- **跨平台**：所有路径用 `path.join()` 拼接；接受 Windows 盘符与 POSIX 输入。
- **技能调用**：Phase 1 与 Phase 4 MUST 调用两个子技能，而不是内联重实现其扫描/对比逻辑 —— Phase 4 由**主 agent 内联**直接非交互调用 `iagent-migration-check`（不再嵌套复查子代理；上下文超阈时降级子代理 + WARN）。
- **上下文阈值**：source-scan 后判定「计划读取文件数 > 300 或制品总行数 > 15k」时，后续内联阶段 MUST 降级为子代理并记 WARN；MUST NOT 在上下文不足时静默继续内联。
- **子技能触发边界**：不得让子技能调用退回交互模式 —— 始终显式注入非交互参数。
- **修复循环由用户把关**：每一轮修复应用前都需用户确认；循环以「无 P0/P1」、用户中止或达到重试上限结束 —— 绝不静默结束。
- **产物路由规则**：迁移流程中生成的全部补充文档 MUST 放在变更目录的 `attachments/` 子树下。遵循 apply 的补充文档处理规则：任务中使用类型标签（`[DB脚本]`、`[配置示例]`、`[使用说明]` 等），并通过 `产出:` 字段指定输出路径。默认路由：
  - SQL 脚本（DDL/DML）→ `attachments/sql/`
  - 配置示例 → `attachments/config/`
  - 对抗检查报告 → `attachments/migration-check/07_对抗检查/`
  - 其他补充文档 → `attachments/`
  所有路径用 `path.join()` 拼接（跨平台）。
