---
name: iagent_spec_propose
description: "创建变更提案。当用户要快速描述想构建的内容并一步生成包含设计、规格和任务的完整提案时使用；触发词\"提案 / propose / 创建变更 / 生成规格\"；NOT for 直接实现变更（改用 iagent_spec_apply）或一站式引导全流程（改用 iagent_workflow）。"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(iagent:*), Skill(spec_verify_proposal), Skill(requirement_doc), Agent, Task
license: MIT
compatibility: 依赖 iagent CLI（spec 命令组）与 CodeGraph MCP（可选）。
metadata:
  author: mi-agent-tools
  type: spec
  generatedBy: "snapshot"
  generatedFingerprint: "sha256:90d63f79ecc6b012d7351c7d29d0d080c4620fb76a9d5c5afb936efecb49c014"
---

提出新变更 —— 一步创建变更并生成全部制品。

**规划边界（Planning Boundary）**: 触发此工作流的用户请求授权的是规划——即使请求要求"实现它"或"开始编码"，也只完成规划制品（不编辑项目代码）；全部制品生成且 Phase 3 验证通过后停止，等待用户发起新请求（/iagent:spec-apply）才进入实现；本工作流不启动代码实现。

我将以 OpenSpec Markdown 制品创建一个变更：
- proposal.md / design.md / specs/<capability>/spec.md
- tasks.md（实现步骤与 checkbox 状态）

准备好实现时，告知我即可开始执行任务。

---

**适用 openspec/rules/ai-coding.md 全域护栏。** 未定义项标 **[待确认]**，禁止猜测。

---

**Input**: 用户请求应包含变更名（kebab-case）或对想构建内容的描述。编排器可传 `mode=delegated`（委派执行模式）与 `exploration-file=<path>`：delegated 模式下**跳过 Step 0 的用户选择提示**（直接迁移 `exploration-file`）、**抑制结尾规划边界停点**、**抑制自身 Phase 3 验证**（由编排器的验证超集承担），并输出**结构化回执**。默认 `mode=interactive` 行为与既有完全一致（保留 Step 0 提示、自身 Phase 3、结尾停点）。`iagent_spec_apply` 既有的 `auto-mode=true` 为 `mode=delegated` 的等价别名。

## ⛔ GATE PROTOCOL — ACTIVE

本技能包含以 **⛔ GATE:** 标记的**确认门**。每个门都是硬性停止点：
- 走到 ⛔ GATE 时，**本次响应到此结束** —— 输出门内容后立即停止
- 不得执行、描述或预生成门之后的任何步骤
- 用户的下一则消息即为确认信号 —— 仅在其响应后从门之后继续
- **违规**：未经用户确认而执行门之后的步骤，是破坏工作流的严重错误

**Steps**

**Step 0: 探索文件检测**

> **delegated 模式分支**：若以 `mode=delegated` + `exploration-file=<path>` 被编排器委派，**跳过下面的用户选择提示**，直接对该文件执行迁移语义（移入变更目录为 `exploration.md`，成功后删除源文件），并在回执中报告迁移结果；`interactive` 模式保留下面的提示流程。

在创建变更前，MUST 扫描并关联探索文件：

0.1. **能力级探索记忆检测**
   - 从用户描述/变更名推断涉及的能力（参照命名规范的模块识别：Glob `openspec/specs/` 匹配模块关键词）
   - 对每个涉及的能力，检测 `openspec/specs/<capability>/explorations.md` 是否存在
   - 存在：读取该文件，将历史 Decisions、术语、边界场景注入探索与提案生成上下文
     - 标注「已过时（由 <change-name> 取代）」的分节仅作历史参考，以取代变更的决策为准
   - 不存在：记录 "无能力级探索记忆 — 全新探索"，正常流程

<!-- CMD:SKIP -->
0.2. **扫描探索文件目录**
   - MUST 使用 Glob 工具扫描 `openspec/explorations/*.md`
   - 获取所有探索文件列表

0.3. **判断探索文件状态**
   - 如果无探索文件：继续正常流程，记录为 "无探索上下文"
   - 如果有探索文件：MUST 提示用户选择（不允许静默跳过）

0.4. **提示用户（当存在探索文件时）**
   > 检测到探索文件:
   > - {filename-1} (修改时间: {time})
   > - {filename-2} (修改时间: {time})
   >
   > 是否关联探索文件到此变更？
   > [关联选择的文件] [跳过]

0.5. **CONTEXT.md 检查（强制检查点）**
   - 如果用户选择关联探索文件，在迁移前检查 `openspec/CONTEXT.md`
   - 如果 CONTEXT.md 存在：
     - 验证所有探索文件术语表条目已写入
     - 如果缺失，自动同步
   - 如果 CONTEXT.md 不存在：
     - 从探索文件术语表自动生成初始 CONTEXT.md
   - 如果无探索文件：跳过检查，记录 "无探索上下文，跳过 CONTEXT.md 检查"
   - 日志：记录 CONTEXT.md 状态

0.6. **用户选择处理**
   - **关联**：将探索文件**移动**到变更目录（不留原件）
     - 源路径: `openspec/explorations/{filename}`
     - 目标路径: `openspec/changes/{change-name}/exploration.md`
     - 使用 `path.join()` 确保跨平台兼容
     - **成功后删除源文件**：移动成功且目标文件校验通过后，MUST 删除 `openspec/explorations/` 下的源文件，使同一探索内容只保留变更目录内的一份
     - **失败时保留源文件**：移动失败或目标文件校验未通过时，MUST 保留源文件并报告错误原因（"不留原件"只适用于成功路径）
     - **只作用于本次**：MUST NOT 追溯搬迁或删除 `openspec/explorations/` 下的既有历史文件（本规则生效前产生的探索文件保留原位以供溯源）
     - 迁移后读取探索内容作为提案生成的上下文
   - **跳过**：继续正常流程，记录为 "无探索上下文"

0.7. **探索内容传递给提案生成**
   - 如果用户选择关联探索文件：
     - 读取 `exploration.md` 中的 Decisions 章节 → 生成 proposal.md/design.md
     - 读取 Analysis 章节 → 生成 design.md
     - 读取 Questions 章节 → 生成 specs/<capability>/spec.md
     - 读取 Codebase Findings 章节 → 生成 tasks.md
<!-- /CMD:SKIP -->

1. **若未提供清晰输入，询问用户想构建什么**

   使用 **AskUserQuestion tool**（开放式、不预设选项）提问：
   > "你想处理哪个变更？描述你想构建或修复的内容。"

   根据其描述，按下方命名规范派生 kebab-case 名称。

   **IMPORTANT**：未理解用户想构建什么之前，不得继续。

**命名规范**

派生变更名时应用以下命名规则：

**格式**：`{prefix}-{module}-{feature}`（模块未知时用 `{prefix}-{feature}`）

**前缀识别**（关键词 → 前缀）：
| 关键词 | 前缀 |
|----------|--------|
| 新增, 添加, 增加, add | `add-` |
| 修复, bug, 问题, fix | `fix-` |
| 优化, 改进, 提升, improve | `improve-` |
| 重构, 调整, refactor | `refactor-` |
| 删除, 移除, remove | `remove-` |
| 文档, README, docs | `docs-` |
| 安全, 漏洞, 权限, security | `security-` |
| 配置, 参数, config | `config-` |
| 性能, 加速, perf | `perf-` |
| 定制, 适配, sync + 客户名 | `sync-{customer}-` |

**前缀优先级**（多个关键词同时命中时）：security > fix > sync > add > remove > improve > refactor > perf > config > docs

**模块识别**：
- 使用 Glob 工具扫描 `openspec/specs/` 目录获取模块名
- 将用户描述中的关键词与模块名匹配
<!-- CMD:SKIP -->
- 常见模块关键词：archive→cli-archive, artifact/workflow→cli-artifact-workflow, validate→cli-validate, workspace→workspace-foundation, change→change-creation
<!-- /CMD:SKIP -->
- 若无模块匹配，使用简化格式 `{prefix}-{feature}`

**示例转换**：
| 用户输入 | 生成的名称 |
|------------|----------------|
| "新增归档索引功能" | `add-cli-archive-index` |
| "修复 artifact graph 解析问题" | `fix-artifact-graph-parsing` |
| "优化 workspace 查询性能" | `perf-workspace-foundation-query` |
| "修复登录安全漏洞" | `security-auth-login-vulnerability` |

**用户提供的名称**：若用户提供了合法名称，直接使用。若其前缀正确但缺少模块，补上模块标识。

2. **创建变更目录**
   ```bash
   iagent spec new "<name>"
   ```
   这会在 CLI 依据 `.openspec.yaml` 解析出的 planning home 中创建脚手架化变更。

   **按 `openspec/rules/artifact-generation.md` 协议执行制品生成。**

3. **获取制品构建顺序**
   ```bash
   iagent spec status --change "<name>" --json
   ```
   解析 JSON 以获取：
   - `applyRequires`：实现前所需的制品 ID 数组（例如 `["tasks"]`）
   - `artifacts`：全部制品及其状态与依赖列表（解析为 `applyRequires` ∪ `requires` 的传递闭包）
   - `planningHome`、`changeRoot`、`artifactPaths` 与 `actionContext`：路径与范围上下文。使用这些字段，不得臆断仓库本地路径。

4. **按顺序创建制品直至 apply-ready**

   使用 **TodoWrite tool** 跟踪制品创建进度。

   按依赖顺序遍历制品（无待办依赖的制品优先）：

   a. **对每个 `ready`（依赖已满足）的制品**：
      - 获取指令：
        ```bash
        iagent spec instructions <artifact-id> --change "<name>" --json
        ```
      - instructions JSON 包含：
        - `template`：OpenSpec Markdown 结构模板
        - `outputPath` / `resolvedOutputPath`：当前制品的 Markdown 路径
        - `dependencies`：需要重新读取的已完成制品
      - **从磁盘重新读取依赖制品**：生成新制品需读取已完成的依赖制品时，从磁盘重新读取最新内容，不依赖会话缓存
      - 读取任何已完成的依赖文件作为上下文
      - **写入 Markdown 真源**：proposal → proposal.md；specs → specs/<capability>/spec.md；design → design.md；tasks → tasks.md
      - 写入后运行 `iagent spec validate --change "<name>"`，修复路径/行号诊断；MUST NOT 通过生成 JSON 副本绕过校验
      - 简要展示进度："已创建 <artifact-id>"

   b. **持续直到全部必需制品完成（apply-ready = applyRequires 传递闭包）**
      - 停止条件：按 requires 边构建 applyRequires 的传递闭包作为必需集（applyRequires ∪ 其传递依赖），所有必需制品状态均为 "done" 才视为 apply-ready
      - 防止早停：tasks 已 done 而 specs 未写时，applyRequires 只列 tasks 不能视为完成；闭包展开后 specs 也属必需
      - 每创建一个制品后重新运行 `iagent spec status --change "<name>" --json`
      - 检查 `applyRequires` 传递闭包中的每个制品 ID 在 artifacts 数组中的状态是否为 `"done"`
      - 必需制品（闭包）全部 done 时停止

   c. **若某制品需要用户输入**（上下文不清晰）：
      - 使用 **AskUserQuestion tool** 澄清
      - 然后继续创建

   d. **并行生成 delta spec（仅多能力）**：
      - 当 `specs` 制品可供生成，且变更涉及两个及以上能力（依据提案的 Capabilities 段）时：为每个能力派发一个子代理（Task 工具）并行生成该能力的 delta spec —— 每个子代理以已完成的 proposal.md 与能力上下文为输入
      - 在按依赖顺序推进到下一制品前，合并所有已生成的 delta spec（proposal → specs → design → tasks 链路不变）
      - 单能力变更：在制品循环中直接生成 delta spec（自动串行降级，不派发）
      - 子代理失败时：主工作流串行重新生成该能力的 delta spec

   e. **skipped 制品处理（skipped 联动）**：
      - 状态报告为 `skipped` 的制品（如变更声明 `skip_specs` 后的 specs）不创建文件
      - 其依赖视为满足，继续推进后续制品
      - 在 TodoWrite 中标记该制品为 skipped 而非 done

5. **展示最终状态**
   ```bash
   iagent spec status --change "<name>"
   ```

6. **Phase 3 验证（自动 —— 强制，不可跳过）**
   > **delegated 模式分支**：若 `mode=delegated`，**抑制本节**——不调用 `iagent_spec_verify_proposal`、不生成需求文档（编排器的 Phase 3 为其超集，含 `proposal_review` 深度复查），直接输出结构化回执交回编排器。`interactive` 模式照常执行本节。
   全部 `applyRequires` 制品完成后，自动进入 Phase 3 验证（不得在验证前以 "准备就绪，可进入实现" 结束工作流）：
   - 调用 `iagent_spec_verify_proposal` **skill**（通过 Skill 工具）执行 D1-D5 评分。（`iagent_spec_verify_proposal` 是技能名，而非合法的 `iagent spec instructions` 制品 ID —— 不得把它当作 CLI 指令运行。）
   - **验证复查子代理**：派发一个独立的只读复查子代理（Task 工具，subagent_type: "general-purpose"）执行 D1-D5 评分 —— 该子代理读取变更制品但不修改。子代理派发失败时：降级（回退）到主工作流内联评分并记录 WARN 日志（绝不静默跳过验证）。
   - **PASS (≥90%)**：验证通过后可对提案做一次内联深度复查（由主工作流在通过后直接执行一次只读复查，不依赖专门技能名）。深度复查收束后，以非交互模式调用 `iagent_requirement_doc` 生成需求文档于 `openspec/changes/<change-name>/需求文档.md`。生成失败不阻塞（WARN + 继续）。
   - **FAIL (<90%)**：自动生成修复、应用、重跑；若仍 FAIL，提供 [手动编辑] / [返回探索 (/iagent:spec-explore)] / [查看差异]（无跳过直接实现的通道）。
   - 技能不可用时降级（回退）：AI 内联 D1-D5 评分 + WARN 日志；绝不静默跳过。
   - 验证使用 90% 通过阈值。

**Output**

> **delegated 模式分支**：若 `mode=delegated`，输出**结构化回执**（change-name、生成制品清单、apply-ready 状态、探索文件迁移结果），MUST NOT 输出"等待用户确认"停点——阶段推进主权归编排器。下述 interactive 输出仅适用于默认模式。

全部制品完成且 Phase 3 验证通过后：
- 变更名与位置
- 已创建制品的清单与简要说明
- 验证结果："Phase 3 验证通过（≥90%）。内联深度复查已完成。"
- 需求文档：生成于 `openspec/changes/<change-name>/需求文档.md`（非交互调用 iagent_requirement_doc；生成失败 WARN 非阻断）
- **降级说明（如适用）**：流程基准缺失或未获用户确认时标注 "流程基准不可用：已降级为仅凭 exploration.md 生成（未确认的流程图未被当作既定前提）"
- 就绪状态："全部制品已创建并验证！准备就绪，可进入实现。"
- 提示语："告知我即可开始执行任务。"

**制品创建指南**

- 对每种制品类型，遵循 `iagent spec instructions` 的 `instruction` 字段
- schema 定义了每个制品应包含的内容 —— 遵循它
- 创建新制品前先读取依赖制品作为上下文
- **Markdown-first**：直接写 proposal.md、design.md、specs/**/*.md 和 tasks.md；使用 `iagent spec validate` 校验，不创建 JSON 真源或渲染副本
- **IMPORTANT**：`context` 与 `rules` 是对你的约束，而不是文件内容
  - 不得把 `<context>`、`<rules>`、`<project_context>` 块复制进制品
  - 它们指导你写什么，但绝不应出现在输出中

**任务类型标签（用于 tasks.md 生成）：**
- 每个任务 MUST 附带类型标签：`- [ ] [代码] N.M ...` / `- [ ] [测试][单元][P0] N.M ...` / `- [ ] [DB脚本] N.M ...` 等。
- 四类并列标签：`[代码]`（实现）/ `[测试]`（测试代码）/ `[DB脚本]`（数据库脚本）/ `[使用说明]`（补充文档）
- `[测试]` 任务 MUST 带子标注：**层级**（`[单元]` 单元 / `[功能]` 功能）+ **优先级**（`[P0]`/`[P1]`/`[P2]`）
- 补充类任务（非 `[代码]` **且** 非 `[测试]`）MUST 以缩进内容包含 `产出:` 字段 —— `[测试]` 任务 MUST NOT 使用 `产出:` → `attachments/` 路由，因为测试代码属于项目的测试源码树
- 默认输出路径：`attachments/<filename>`（相对于 changeRoot）
- 完整标签参考见 `schemas/spec-driven/templates/tasks.md` 模板

**测试规划判定（用于 tasks.md 生成）：**
- 逐个遍历 `specs/**/*.md` 的 Requirement/Scenario 块，判定每个是否可测（历史 JSON-only 变更仅只读降级）
- **可测场景** → MUST 生成一个带层级 + 优先级的 `[测试]` 任务
- **不可测场景**（无可验证行为的纯文档 / 配置变更）→ MUST 仍然生成一个记录判定结论及其依据的 `[测试]` 任务，例如 `- [ ] [测试][单元][P2] 4.2 评估：纯文档变更，无需测试（依据：无可验证行为）`
  - 理由：留痕的判定结论使"未编写测试"可与"从未评估"区分 —— 与 `iagent_test` 的不测闸门同一原则
- 测试任务依赖其对应的实现任务 —— 当某测试任务覆盖由另一任务实现的行为时，在任务描述中标注依赖，使 apply 串行调度它们

**流程基准消费规则**

当关联的 `exploration.md` 含**经用户确认**的 `## 功能流程图` 段时，该流程图即**流程基准**，本技能 MUST 以其为**生成锚点**：

- **design 引用而非重建**：design.md MUST 引用该流程图（Mermaid `flowchart TD`）与**关键操作节点清单**（节点 / 操作 / 触发条件 / 证据位置 / 异常路径）；
  MUST NOT 在 design 中**重新发明一套流程**——重写流程即偏差引入点
- **tasks 标注节点 id（节点 → 任务的可追溯映射）**：tasks.md 的**每个任务** MUST 标注其对应的节点标识（`[N4]` 形，节点标识与流程图 / 节点清单表保持一致），
  使每个流程节点在任务清单中可被逐一核对
  - 例：`- [ ] [代码] 2.3 实现分批查询 [N4]`
- **MUST NOT 静默补节点**：任务拆解中发现流程图遗漏的节点时，MUST 回到探索阶段更新流程图并**重新经用户确认**；
  MUST NOT 在本技能中静默补节点后继续——静默补全正是偏差的主要来源
- **缺失或未确认时降级**：`exploration.md` 不含 `## 功能流程图` 段，或该段存在但**未获用户确认**（用户在流程最终确认门上拒绝或未表态）时，
  本技能 SHALL 降级为**仅凭 exploration.md** 生成提案；MUST NOT 把未确认的流程图当作既定前提（不据此生成 design 的流程引用与 tasks 的节点标注），
  并 SHALL 在**生成报告**中标注该降级

**Guardrails**
- 创建实现所需的全部制品（由 schema 的 `apply.requires` 定义）
- 创建新制品前始终读取依赖制品
- 若上下文严重不清晰，标记为 **[待确认]** 并询问用户。绝不猜测！
- **实质性歧义划分**：影响范围/行为契约/向后兼容性/验收标准的歧义 MUST 表面化并向用户提问（标记 [待确认]）；细节性歧义可做合理假设并记录到规划制品
- 全部制品创建后，展示设计蓝图摘要并等待用户确认，之后才建议实现。（**delegated 模式例外**：抑制该停点，改输出结构化回执并交回主权）
- 若同名变更已存在，询问用户是要继续它还是新建一个
- 每次写入后确认制品文件存在，再继续下一个

## Markdown 制品生成（强制 —— Markdown-first）

严格引用 `openspec/rules/artifact-generation.md` 的 G1-G7 协议：

- proposal / specs / design 直接写入 OpenSpec Markdown，tasks 直接写入 tasks.md。
- 使用 `iagent spec status --change "<name>" --json` 和 `iagent spec instructions <artifact-id> --change "<name>" --json` 获取状态、路径和模板摘要。
- 不创建或更新 `change.json` / `tasks.json` 作为新变更真源；CLI JSON 仅为运行时响应。
- 每次写入后运行 `iagent spec validate --change "<name>"`，按文件路径和行号修正 invalid。
- 每个可测 Scenario 必须在 tasks.md 有实现或测试任务，并标注 `Spec Ref` / `Scenario Ref`。
- 依赖文件必须从磁盘重新读取；context/rules 只作为本技能约束，不复制进制品。

**任务类型标签**：`[代码]` / `[测试][单元|功能][P0|P1|P2]` / `[DB脚本]` / `[使用说明]`。补充文档任务写 `产出:`，测试任务不走 attachments 路径。

**测试规划**：逐个读取 specs Markdown 的 Scenario；可测场景生成 [测试] 任务，不可测场景也生成记录“已评估、无需测试”的任务。测试任务依赖被测实现任务。

**流程基准**：若 exploration.md 含经确认的功能流程图，design.md 引用原流程，tasks.md 标注节点 id；未确认流程图不得作为既定前提并在报告中记录降级。
