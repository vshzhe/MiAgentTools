---
name: iagent-spec-apply
description: "实现变更。当 openspec/changes/ 下已有变更制品（proposal/specs/design/tasks），需要基于规格驱动实现任务清单时使用；触发词\"实现变更 / apply / 执行任务 / 按规格实现\"；NOT for 无变更制品时直接描述需求（改用 iagent_workflow 引导生成制品后再实现）。"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(iagent:*), Bash(npm:*), Bash(pnpm:*), Bash(node:*), Bash(git:*), Bash(tsc:*), Bash(mvn:*), Bash(ant:*), Bash(gradle:*), Bash(go:*), Bash(cargo:*), Agent, Task
license: MIT
compatibility: 依赖 iagent CLI（spec 命令组）。
metadata:
  author: mi-agent-tools
  type: spec
  generatedBy: "snapshot"
  generatedFingerprint: "sha256:506c575d044e9de55c5ee0e2166eaddafb49036d17f796ede1116675060e672d"
---

**实现前先阅读 openspec/rules/ai-coding.md 的 AI 编码护栏。** 禁止猜测数据库字段、API 参数或业务规则 —— 标 **[待确认]** 并询问用户。

按 openspec/changes/ 下的变更制品（proposal/specs/design/tasks）实现任务。

**Input**: 可选指定变更名；省略时检查能否从对话上下文推断。若含糊或有歧义，MUST 提示可用变更供用户选择。工作流也可能传入 `auto-mode=true` 以跳过设计确认门，实现自动执行。

**Steps**

1. **选择变更**

   已提供名称则直接使用；否则：
   - 用户提到变更时，从对话上下文推断
   - 仅存在一个活动变更时自动选择
   - 若有歧义，运行 `iagent spec status --json` 获取可用变更，并用 **AskUserQuestion tool** 让用户选择

   始终声明"正在使用变更：<name>"，并说明如何覆盖（如 `/iagent:spec-apply <other>`）。

2. **检查状态以了解 schema**
   ```bash
   iagent spec status --change "<name>" --json
   ```
   解析 JSON 以了解：
   - `schemaName`：正在使用的工作流（如 "spec-driven"）
   - `planningHome`、`changeRoot` 与 `actionContext`：规划范围与编辑约束
   - `progress`：任务总数、已完成数、剩余数
   - 哪个制品承载任务（spec-driven 通常为 "tasks"，其他类型以状态输出为准）

   **工作区护栏：** 若状态 JSON 报告 `actionContext.mode: "workspace-planning"` 且 `allowedEditRoots` 为空，说明本切片不支持完整工作区 apply。把关联仓库与目录视为只读上下文，请用户通过显式实现工作流选择受影响区域，并在编辑文件前 STOP。

   **跳过制品（skipped）处理：** 若状态报告某制品为 `skipped`（变更声明了 `skip_specs`），不要把它当作缺失 —— 其依赖视为已满足，其余制品照常实现。此类制品不会在 Step 3 返回的 `instruction` 状态中被标为未完成。

3. **获取任务清单与上下文文件**

   **主路径 —— iagent CLI `instructions apply`（优先）：**
   ```bash
   iagent spec instructions apply --change "<name>" --json
   ```
   解析 JSON 以获得结构化任务上下文：
   - `contextFiles`：制品 → 文件路径映射（proposal/specs/design/tasks → 各自的绝对路径或变更内相对路径）；以此作为权威文件清单，不要假设标准文件名
   - `progress`：任务总数、已完成数、剩余数（用于 Step 5 的进度展示）
   - `taskList`：带勾选状态与分组标签的结构化任务条目（用于 Step 5.5 的批规划）
   - `instruction`：动态三态指令：
     - `"blocked"`：制品缺失或不完整 → 建议先运行 `iagent_spec_verify` 补全制品；实现前 STOP
     - `"ready"`：制品完整且存在待办任务 → 进入 Step 4（读取上下文文件）
     - `"all_done"`：全部任务已完成 → 祝贺并建议归档；STOP

   **Markdown 制品上下文（所有新变更的主源）：**

   直接读取 CLI 返回的 contextFiles 中的 proposal.md、design.md、specs/**/*.md 与 tasks.md。Markdown 是唯一可编辑的真源。历史 JSON-only 变更只作只读兼容输入且 MUST 输出 WARN；apply 期间不得更新它们。

   **任务状态：** 以 tasks.md 的勾选框为唯一权威。完成任务并验证所声明的行为后，只把该任务的勾选框从 `- [ ]` 改为 `- [x]`。不要创建或更新 tasks.json，也不要运行 render 命令。

   **降级路径（不支持 `instructions apply` 的旧 CLI）：**
   - 直接读取 proposal.md、specs/**/*.md、design.md 与 tasks.md。
   - 记录 WARN 说明降级原因。
   - 保持相同的 Markdown 优先语义与任务勾选规则。
   **状态处理（两条路径相同）：**
   - 制品缺失（proposal/specs/design/tasks）：给出提示，建议先用 `iagent_spec_verify` 补全制品
   - 全部任务已完成：祝贺并建议归档
   - 其他情况：进入实现

4. **读取上下文文件**

   遵循 Step 3 的 Markdown 优先规则 —— 直接读取结构化章节：
   - **proposal.md**：Why 与 What Changes
   - **design.md**：Decisions、架构与模块依赖
   - **specs/**/*.md**：delta 需求与 Scenario
   - **tasks.md**：带勾选状态的任务清单

   后续步骤中的 proposal/design/specs/tasks 均指这些 Markdown 制品。

5. **展示当前进度**

   展示：
   - 正在使用的 Schema
   - 进度："N/M tasks complete"
   - 剩余任务概览

**5.5. 设计确认门** ⚠️ 强制

   读完上下文文件后、实现任何任务前，先构建统一并发批计划、展示设计方案摘要，并等待用户确认：

   **auto-mode 检查**：若 apply 以 `auto-mode=true` 调用（来自 workflow 自动 apply 上下文），跳过整个 Step 5.5 确认门 —— 直接进入 Step 6（批调度）。批计划仍在内部构建用于执行，但不向用户展示。

   **先构建统一并发批计划：**
   - iagent CLI 不返回 `batchPlan` —— 需从 design.md 推断所有任务的依赖（架构分层、模块依赖）；无依赖标注的任务视为同组内相互独立
   - 把同组任务（`## N` 标题，取自各任务的 `group` 字段）聚合为派发单元 —— 每个单元一个子代理
   - 若 design.md 显示部分任务存在循环依赖：加入循环依赖告警行，并把这些任务降级为串行执行
   - 若 design.md 缺少依赖信息：按串行执行规划，并在蓝图中注明 "(串行执行 - 无依赖信息)"

   ```
   📋 **设计方案确认**

   **变更**: <change-name> | **Schema**: <schema-name>

   ### 变更概要
   <from proposal Why section>

   ### 关键设计决策
   <from design Decisions section>

   ### 涉及的数据结构 / API
   <from design or specs>

   ### [待确认] 项目
   <list pending items, or "(无 - 已全部解决)">

   ### 任务数: N (0/N 完成)

   ### 并发执行计划
   <"(串行执行 - 无依赖信息)" when no dependency info, otherwise:>
   | 批号 | 任务 | 依赖来源 | 并发/串行 |
   |-----|------|---------|----------|
   | 1 | <task descriptions or ids> | <AI 推断 / 无依赖> | 并发 |
   | 2 | <task descriptions or ids> | <依赖批 1 / AI 推断> | 并发/串行 |
   <if circular deps detected: "⚠️ 循环依赖: <task ids> — 已降级为串行执行">
   <AI-inferred rows MUST be labeled "AI 推断" in the 依赖来源 column>

   ### 补充文档
   <list supplement tasks with their type labels and output paths, or "(无)">

   WAIT for user to explicitly reply "确认" before implementing.
   [确认 ✓] [修改设计] [取消]
   ```

   - 若用户回复 **"确认"**：一次确认覆盖**全部**批 —— 进入 Step 6 开始批调度
   - 若用户回复 **"修改设计"** 或 **"取消"**：STOP 并等待设计更新（不实现任何任务）
   - **auto-mode 覆盖**：`auto-mode=true` 时整道门被跳过 —— 不展示蓝图，直接进入 Step 6。未设置 auto-mode 或其为 false 时**不能**跳过本门。
   - 本门**不能**跳过 —— 未经显式确认不得继续（除非 auto-mode 生效）

   **临时工作区协议（流程级，由主代理管理）：**
   - 用户确认设计后（或 auto-mode 生效时）、派发任何批**之前**，创建一个临时工作区目录 —— **优先项目内**：项目根下的 `.openspec-tmp/apply-<change-name>/`（路径用 path.join 构建以保证跨平台）。若项目 `.gitignore` 中尚无 `.openspec-tmp/` 条目则补上，使该工作区不会污染 git status；清理后保留该条目供后续运行使用。若项目根不可写，降级到系统临时目录 `iagent-apply-<change-name>/` 并记录 WARN 说明降级位置
   - 流程内产生的所有临时文件（编译校验脚本、临时配置、草稿输出）MUST 放在该工作区内 —— 不得把临时文件散落到项目目录各处
   - 工作区在流程开始时创建一次、流程结束时清理一次 —— 不得按任务或按批创建/删除临时目录

> **批调度细则下沉**：Step 6 并发批调度协议（批形态判定、子代理派发、共享资源协议、失败处理）见 `references/batch-scheduling.md`；执行 Step 6 前 MUST 先 `Read` 该文件。

7. **完成或暂停时展示状态**

   展示：
   - 本次会话完成的任务
   - 总体进度："N/M tasks complete"
   - 若全部完成：进入 Step 8（编译检查）
   - 若暂停：说明原因并等待指引

8. **编译检查阶段** ⚠️ 强制

   全部任务完成后，执行自动编译检查：

   **8.1 加载编译检查配置**
   - 读取 `openspec/config.yaml` 的 `compileCheck` 配置
   - 若 `compileCheck.enabled: false`，跳到 Step 9（测试执行门）

   **8.2 探测技术栈**
   - 从 `config.yaml` 的 context 中解析关键词（TypeScript、Java、Go、Rust）
   - 检查项目配置文件（tsconfig.json、pom.xml、go.mod、Cargo.toml）
   - Java：从配置或构建文件判定构建工具（Maven/Ant/Gradle）
   - 未探测到技术栈时，给出告警并跳过编译检查

   **8.3 获取变更范围文件**
   - 从状态 JSON 解析 `allowedEditRoots`
   - 用 `git diff` 识别变更范围内的已修改文件
   - 将文件分为后端（TypeScript/Java/Go/Rust）与前端（JSP/Vue/React）

   **8.4 执行后端编译检查**
   - 按技术栈执行编译命令：
     - TypeScript: `tsc --noEmit` or `pnpm run build` (fallback: `npm run build`)
     - Java-Maven: `mvn compile -DskipTests`
     - Java-Ant: `ant compile`
     - Java-Gradle: `gradle compileJava`
     - Go: `go build ./...`
     - Rust: `cargo build`
   - 捕获错误并解析为结构化格式

   **8.5 执行后端 lint 检查**（若已配置）
   - TypeScript：`eslint`
   - Java：`mvn checkstyle:check`
   - 区分可自动修复与不可自动修复的问题

   **8.6 执行前端校验**（若已配置）
   - JSP 文件：校验标签闭合、EL 表达式、自定义标签定义
   - Vue/React：检查组件引用

   **8.7 自动修复循环**（若已配置）
   - 若 `autoFix.enabled: true`：
     - 按可修复性分类问题（类型标注、未使用变量、import 顺序）
     - 对变更范围内的文件应用修复
     - 重新运行编译/lint 检查
     - 最多重复 `maxRetries` 次（默认 3）

   **8.8 生成编译检查报告**
   - 汇总结果：后端编译、lint、前端
   - 列出所有已修复问题及其 file:line 引用
   - 列出需人工介入的问题

   **8.9 处理检查失败**
   - 若自动修复后仍有失败：
     - 按 `onFailure` 配置展示失败处理选项
     - 选项：[1] 查看详情，[2] 手动修复，[3] 跳过并记录警告
   - 若全部检查通过：进入 Step 9（测试执行门）

9. **测试执行门** ⚠️ 强制（仅限变更范围内）
   - 在编译检查（§8）之后运行。编译失败是硬错误；测试失败属于另一类问题（存量红灯测试、断言不匹配、环境问题）—— 这正是两道门分开、MUST NOT 合并为一道的原因。§8 MUST 保持其 `-DskipTests`/`compile` 语义；测试执行由本门负责。

   **9.1 探测测试命令** —— 基于 §8.2 探测到的同一技术栈：
   - Java-Maven：`mvn test`（仅跑选定类时用 `-Dtest=...` 限定范围）
   - Java-Gradle：`gradle test`
   - Java-Ant：`ant test`
   - TypeScript/Node：`pnpm test` / `npm test`
   - Go：`go test ./...`  |  Rust：`cargo test`
   - 项目中未探测到测试框架 → 记录 WARN，跳过本门并继续（非阻塞）

   **9.2 确定变更范围** —— 需要运行的测试集为：
   - 本变更 `[测试]` 任务产出的测试文件（从 `tasks.md` 读取其 `Spec Ref` / 文件路径）
   - 覆盖本变更所修改文件的既有测试文件（按镜像包路径 / 命名约定匹配，如 `UserServiceImpl` → `UserServiceImplTest`）

   **9.3 运行变更范围测试** —— 只执行 §9.2 的范围。不得把全量测试套件的结果作为通过/失败判据。

   **9.4 判定**
   - **范围内测试全部通过** → 记录并进入 §10
   - **变更范围外的存量失败** → 仅作为 WARN 报告。MUST NOT 计为本变更的失败，MUST NOT 阻塞流程（存量红灯套件很常见；以全量套件为判据会让本门不可用，并促使用户绕过它）
   - **变更范围内的失败** → 进入失败处理分支（§9.5）

   **9.5 范围内失败处理**
   - 自动修复并重跑，最多 3 次（与 §8.7 相同的重试预算）。区分：测试代码有误 → 修测试；生产代码有缺陷 → 修实现（按 `openspec/rules/ai-coding.md`）
   - 3 次后仍有失败：暂停并向用户报告。MUST NOT 把对应任务标为 `[x]`，MUST NOT 进入归档
   - 若必须收窄或简化测试的预期行为才能通过 → 适用范围蔓延护栏：标 **[待确认]**，说明差异并询问用户

   **9.6 测试门报告** —— 汇总：覆盖范围、范围内通过/失败数、范围外存量失败（WARN）、覆盖率工具运行时的覆盖率数据（见 `iagent_test` §5.1）

10. **统一临时工作区清理** ⚠️ 强制
   - 编译检查（§8）与测试执行门（§9）都结束后 —— 无论通过、失败还是跳过 —— 在单次清理中删除整个临时工作区
   - 清理范围**包含**共享上下文包及其产出登记表（二者都在临时工作区内）—— 它们是流程级制品，MUST NOT 遗留
   - 若清理失败（文件被占用、权限不足）：记录 WARN 并给出工作区路径，便于用户手动删除，流程继续、不阻塞

11. **最终状态与归档建议**

   展示：
   - 编译检查结果汇总
   - 测试执行门结果汇总
   - 全部任务完成状态
   - 建议通过 iagent spec archive "<name>" --yes（或 iagent_spec_archive 技能）归档变更

<!-- CMD:SKIP -->
**Output（实现过程中）**

```
## Implementing: <change-name> (schema: <schema-name>)

⏳ Concurrent execution — Batch 2/4
   Dispatching 3 sub-agents (groups: 1. Data contract / 3. Template / 4. Tests)
   Coordinator is centrally managing task checkboxes and failure retries
- Task 3: <task description> → ✓ Task complete (produced: <file list>)
- Task 4: <task description> → ✓ Task complete (produced: <file list>)
- Task 5: <task description> → ✗ failed → serial retry in progress

Batch 3/4: 1 task — serial execution (single-task batch — implemented directly)
Working on task 6/7: <task description>
[...implementation happening...]
✓ Task complete
```

**Output（完成时）**

```
## Implementation Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 7/7 tasks complete ✓

### Completed This Session
- [x] Task 1
- [x] Task 2
...

Starting compile check...

## 编译检查报告

| 检查项 | 状态 | 详情 |
|-------|------|------|
| Backend Compile | ✓ PASS | TypeScript: tsc --noEmit |
| Backend Lint | ✓ PASS | eslint: 0 issues |
| Frontend | ✓ PASS | No JSP files in scope |

**自动修复**: 2 issues fixed (type annotations, import order)

All checks passed! You can archive this change via iagent CLI.
```

**Output（编译检查失败时）**

```
## Implementation Complete

**Change:** <change-name>
**Progress:** 7/7 tasks complete ✓

## 编译检查报告

| 检查项 | 状态 | 详情 |
|-------|------|------|
| Backend Compile | ✗ FAIL | 3 errors |
| Backend Lint | ✓ PASS | eslint: 0 issues |
| Frontend | - SKIPPED | No JSP files |

**自动修复**: Applied 2 fixes, 3 issues remain

### 需人工处理的问题
1. `src/main.ts:45` - Type mismatch: string vs number
2. `src/utils.ts:12` - Cannot find name 'config'
3. `src/api.ts:78` - Missing return type

**处理选项**:
[1] 查看详细错误信息
[2] 手动修复后重新检查
[3] 跳过检查并归档（记录警告）

请选择处理方式？
```

**Output（暂停：遇到问题时）**

```
## Implementation Paused

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 4/7 tasks complete

### Issue Encountered
<description of the issue>

**Options:**
1. <option 1>
2. <option 2>
3. Other approach

What would you like to do?
```

**Output（批任务失败暂停时）**

```
## Implementation Paused — Task Failure

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 4/7 tasks complete

### Failed Task
<task description> (batch N — sub-agent failed, serial retry failed)

### Failure Reason
<description of the failure>

The failed task remains unchecked (`- [ ]`) in tasks.md; confirmed tasks in the same batch have been marked complete.

**Options:**
1. Fix the task manually, then continue with the remaining batches
2. Provide guidance and retry the task
3. Stop the apply workflow

What would you like to do?
```
<!-- /CMD:SKIP -->

**Guardrails**
- 持续推进任务直至完成或被阻塞
- 开始前始终先阅读制品文件（proposal/specs/design/tasks）
- 任务含义不明时暂停，先询问再实现
- 实现暴露问题时暂停，并建议更新制品
- 保持代码改动最小且限定在单个任务范围内
- 集中更新 tasks.md：仅当任务的 spec 行为**完整实现**后才把已确认完成的任务标为 `- [ ]` → `- [x]` —— 部分实现或延后实现 SHALL NOT 勾选；直接实现的任务（串行降级或单任务批）在任务完全做完后立即标记完成
- ⚠️ **范围蔓延护栏**：若实现揭示必须收窄、延后或简化某任务的 spec 行为才能通过，MUST 显式提出该发现 —— 标 **[待确认]**，清楚说明 spec 与实际实现的差异，并询问用户。绝不为让任务勾选通过而静默缩小、延后或简化 spec 行为。用户确认后，MUST 先更新 proposal/specs/design 以反映调整后的范围，再继续实现。
- 遇错误、阻塞或需求不清时暂停 —— 不要猜测
- 绝不编造数据库字段名、类型或 API 端点 —— 对照既有代码核实
- 遵循分层生成顺序：Entity/DTO → Mapper/DAO → Service → Controller → Frontend
- 每个前端数据展示组件都要处理 Loading/Empty/Error/Data 状态
- 实现与既有代码或共享工具签名冲突时立即暂停
- 编译检查前做交付前自检：无猜测字段、API 契约对齐、参数已校验、UI 状态已覆盖
- 直接从变更目录读取制品文件 —— 除标准集合外不要假设具体文件名
- ⚠️ **强制**：全部任务完成后执行 Step 8 编译检查
- ⚠️ **强制**：编译检查后执行 Step 9 测试执行门 —— 范围限定为本次变更（范围内失败阻塞；范围外存量失败仅 WARN 且 MUST NOT 阻塞）
- ⚠️ **强制**：`[测试]` 任务 MUST 内联实现，遵循测试生成规则（框架探测 → 风格对齐 → BCDE 覆盖 → 反模式防护）；MUST NOT 委派给外部技能，MUST NOT 走补充文档的 `产出:` → `attachments/` 规则（放在 attachments/ 下的测试代码无法运行）

- ⚠️ **强制**：子代理派发指令 MUST 携带 EXIT GUARD（子代理退出守卫）—— 完成分配任务后立即停止并返回回执，MUST NOT 进入 plan 模式 / 设计模式，也不得提出后续步骤；编排器是唯一有权判停和推进阶段的角色
- ⚠️ **强制**：子代理 MUST 先读取上下文包，再执行其它任何动作 —— 不得先做其他动作；MUST NOT 重读 proposal/specs/design，MUST NOT 重跑包已覆盖的 CodeGraph 查询；仅做增量查询
- ⚠️ **强制**：给出归档建议前先解析编译错误并提供修复选项

**流畅工作流集成**

本技能支持"对变更的动作"模型：

- **可随时调用**：全部制品完成前（只要有任务存在）、部分实现后、与其他动作交错进行时均可调用
- **允许更新制品**：实现暴露设计问题时，建议更新制品 —— 不受阶段锁定，流畅推进
