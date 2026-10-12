---
name: venus_spec_propose
description: 创建变更提案。当用户要快速描述想构建的内容并一步生成包含设计、规格和任务的完整提案时使用。
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(venus:*), Skill(spec_verify_proposal), Agent, Task
license: MIT
compatibility: 依赖 venus CLI（spec 命令组）与 CodeGraph MCP（可选）。
metadata:
  author: venus-agent-tools
  version: "1.0"
  type: spec
  generatedBy: "snapshot"
  generatedFingerprint: "sha256:ac06b312dd4c6a1e8cc1fad4a7acf81ca54cff716cf985fd77317f83c9ee1243"
---

Propose a new change - create the change and generate all artifacts in one step.

**Planning Boundary**: 触发此工作流的用户请求授权的是规划——即使请求要求"实现它"或"开始编码"，也只完成规划 artifacts（不编辑项目代码）；全部 artifacts 生成且 Phase 3 验证通过后停止，等待用户发起新请求（/venus:spec-apply）才进入实现；本工作流不启动代码实现。

I'll create a change with artifacts:
- proposal.md (what & why)
- design.md (how)
- tasks.md (implementation steps)

准备好实现时，告知我即可开始执行任务。

---

**适用 openspec/rules/ai-coding.md 全域护栏。** 未定义项标 **[待确认]**，禁止猜测。

---

**Input**: The user's request should include a change name (kebab-case) OR a description of what they want to build.

**Steps**

**Step 0: 探索文件检测**

在创建变更前，MUST 扫描并关联探索文件：

0.1. **能力级探索记忆检测（Capability Exploration Memory Injection）**
   - 从用户描述/变更名推断涉及的 capability（参照 Naming Convention 的 Module Identification：Glob `openspec/specs/` 匹配模块关键词）
   - 对每个涉及的 capability，检测 `openspec/specs/<capability>/explorations.md` 是否存在
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

0.5. **CONTEXT.md 检查（MANDATORY CHECKPOINT）**
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
     - 读取 `exploration.md` 中的 Decisions 章节 → 填充 proposal.md
     - 读取 Analysis 章节 → 填充 design.md
     - 读取 Questions 章节 → 填充 specs
     - 读取 Codebase Findings 章节 → 填充 tasks.md
<!-- /CMD:SKIP -->

1. **If no clear input provided, ask what they want to build**

   Use the **AskUserQuestion tool** (open-ended, no preset options) to ask:
   > "What change do you want to work on? Describe what you want to build or fix."

   From their description, derive a kebab-case name following the naming convention below.

   **IMPORTANT**: Do NOT proceed without understanding what the user wants to build.

**Naming Convention**

Apply the following naming rules when deriving a change name:

**Format**: `{prefix}-{module}-{feature}` (or `{prefix}-{feature}` if module unknown)

**Prefix Recognition** (keyword → prefix):
| Keywords | Prefix |
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
| 定制, 适配, sync + customer name | `sync-{customer}-` |

**Prefix Priority** (when multiple keywords match): security > fix > sync > add > remove > improve > refactor > perf > config > docs

**Module Identification**:
- Use Glob tool to scan `openspec/specs/` directory for module names
- Match user description keywords against module names
<!-- CMD:SKIP -->
- Common module keywords: archive→cli-archive, artifact/workflow→cli-artifact-workflow, validate→cli-validate, workspace→workspace-foundation, change→change-creation
<!-- /CMD:SKIP -->
- If no module matches, use simplified format `{prefix}-{feature}`

**Example Transformations**:
| User Input | Generated Name |
|------------|----------------|
| "新增归档索引功能" | `add-cli-archive-index` |
| "修复 artifact graph 解析问题" | `fix-artifact-graph-parsing` |
| "优化 workspace 查询性能" | `perf-workspace-foundation-query` |
| "修复登录安全漏洞" | `security-auth-login-vulnerability` |

**User-provided name**: If user provides a valid name, use it. If it has correct prefix but missing module, add module identifier.

2. **Create the change directory**
   ```bash
   venus spec new "<name>"
   ```
   This creates a scaffolded change in the planning home resolved by the CLI with `.openspec.yaml`.

   **按 `openspec/rules/artifact-generation.md` 协议执行 artifact 生成。**

3. **Get the artifact build order**
   ```bash
   venus spec status --change "<name>" --json
   ```
   Parse the JSON to get:
   - `applyRequires`: array of artifact IDs needed before implementation (e.g., `["tasks"]`)
   - `artifacts`: list of all artifacts with their status and dependencies (resolved as transitive closure of `applyRequires` ∪ `requires`)
   - `planningHome`, `changeRoot`, `artifactPaths`, and `actionContext`: path and scope context. Use these instead of assuming repo-local paths.

4. **Create artifacts in sequence until apply-ready**

   Use the **TodoWrite tool** to track progress through the artifacts.

   Loop through artifacts in dependency order (artifacts with no pending dependencies first):

   a. **For each artifact that is `ready` (dependencies satisfied)**:
      - Get instructions:
        ```bash
        venus spec instructions <artifact-id> --change "<name>" --json
        ```
      - The instructions JSON includes:
        - `jsonTemplate`: JSON 真源结构示例（机器源）— 写 change.json 段 / tasks.json 时按其字段与约束执行
        - `instruction`: Schema-specific guidance for this artifact type
        - `template`: MD 结构参考（仅渲染不可用降级手写时参照；正常路径由渲染器产出）
        - `resolvedOutputPath`: 渲染产物的目标路径（venus spec render 自动写入，供核对）
        - `dependencies`: Completed artifacts to read for context
      - **Re-read dependency artifacts from disk**: 生成新 artifact 需读取已完成的依赖 artifact 时，从磁盘重新读取最新内容（用户可能在会话期间手工编辑），不依赖会话缓存
      - Read any completed dependency files for context
      - **Write JSON truth source**: proposal/specs/design → 更新 `.venus/change.json` 对应段（整文件 Write，保留已有段与根字段现值）；tasks → 写 `tasks.json`（JSON-first 完整步骤见 `openspec/rules/artifact-generation.md` Step G2）
      - **Render MD**: `venus spec render <artifact-id> --change "<name>"` — 校验失败（报错含字段路径）修正 JSON 后重跑；命令不可用时降级以 `template` 为结构手写 MD（WARN，不阻断）
      - Show brief progress: "Created <artifact-id>"

   b. **Continue until all required artifacts are complete (apply-ready = applyRequires 传递闭包)**
      - 停止条件：按 requires 边构建 applyRequires 的传递闭包作为必需集（applyRequires ∪ 其传递依赖），所有必需 artifact 均 status "done" 才视为 apply-ready
      - 防止早停：tasks 已 done 而 specs 未写时，applyRequires 只列 tasks 不能视为完成；闭包展开后 specs 也属必需
      - After creating each artifact, re-run `venus spec status --change "<name>" --json`
      - Check if every artifact ID in the transitive closure of `applyRequires` has `status: "done"` in the artifacts array
      - Stop when all required artifacts (closure) are done

   c. **If an artifact requires user input** (unclear context):
      - Use **AskUserQuestion tool** to clarify
      - Then continue with creation

   d. **Parallel delta spec generation (multi-capability only)**:
      - When the `specs` artifact is ready for generation AND the change involves two or more capabilities (per the proposal's Capabilities section): dispatch one sub-agent per capability (Task tool) to generate that capability's delta spec in parallel — every sub-agent takes the completed `proposal.md` as its input
      - Merge all generated delta specs before proceeding to the next artifact in the dependency order (the proposal → specs → design → tasks chain is unchanged)
      - For a single-capability change: generate the delta spec directly in the artifact loop (automatic serial fallback, no dispatch)
      - On a sub-agent failure: the main workflow regenerates that capability's delta spec serially

   e. **Skipped artifacts handling (skipped 联动)**:
      - status 报告 `skipped` 状态的 artifact（如变更声明 `skip_specs` 后的 specs）不创建文件
      - 其依赖视为满足，继续推进后续 artifact
      - 在 TodoWrite 中标记该 artifact 为 skipped 而非 done

5. **Show final status**
   ```bash
   venus spec status --change "<name>"
   ```

6. **Phase 3 Verification (auto — MANDATORY, no skip)**
   After all `applyRequires` artifacts are done, automatically enter Phase 3 verification (do NOT end the workflow at "Ready for implementation" before verification):
   - Invoke the `venus_spec_verify_proposal` **skill** (via Skill tool) for D1-D5 scoring. (`venus_spec_verify_proposal` is a skill name, NOT a valid `venus spec instructions` artifact ID — do not run it as a CLI instruction.)
   - **Verification review sub-agent**: dispatch an independent read-only review sub-agent (Task tool, subagent_type: "general-purpose") to perform the D1-D5 scoring — the sub-agent reads the change's artifacts without modifying them. On sub-agent dispatch failure: fall back to main-workflow inline scoring with a WARN log (never silently skip verification).
   - **PASS (≥90%)**: 验证通过后可对提案做一次内联深度复查（由主工作流在通过后直接执行一次 read-only 复查，不依赖专门技能名）。
   - **FAIL (<90%)**: auto-generate fixes, apply, re-run; if still FAIL, offer [Manual edit] / [Return to exploration (/venus:spec-explore)] / [View diff] (no skip-to-apply).
   - Fallback if skill unavailable: AI inline D1-D5 scoring + WARN log; never silently skip.
   - 验证使用 90% 通过阈值。

**Output**

After completing all artifacts AND Phase 3 verification passes:
- Change name and location
- List of artifacts created with brief descriptions
- Verification result: "Phase 3 verification passed (≥90%). Inline deep review completed."
- **Downgrade note (if applicable)**: 流程基准缺失或未获用户确认时标注 "流程基准不可用：已降级为仅凭 exploration.md 生成（未确认的流程图未被当作既定前提）"
- What's ready: "All artifacts created and verified! Ready for implementation."
- Prompt: "告知我即可开始执行任务。"

**Artifact Creation Guidelines**

- Follow the `instruction` field from `venus spec instructions` for each artifact type
- The schema defines what each artifact should contain - follow it
- Read dependency artifacts for context before creating new ones
- **JSON-first**: 先写 JSON 真源（change.json 段 / tasks.json），再 `venus spec render <type>` 渲染；`template` 仅在渲染不可用的降级路径中作为手写 MD 的结构参考
- **IMPORTANT**: `context` and `rules` are constraints for YOU, not content for the file
  - Do NOT copy `<context>`, `<rules>`, `<project_context>` blocks into the artifact
  - These guide what you write, but should never appear in the output

**Task Type Labels (for tasks.md generation):**
- Each task MUST include a type label: `- [ ] [代码] N.M ...` / `- [ ] [测试][单元][P0] N.M ...` / `- [ ] [DB脚本] N.M ...` etc.
- Four parallel label types: `[代码]` (implementation) / `[测试]` (test code) / `[DB脚本]` (database scripts) / `[使用说明]` (supplement docs)
- `[测试]` tasks MUST carry sub-annotations: **level** (`[单元]` unit / `[功能]` functional) + **priority** (`[P0]`/`[P1]`/`[P2]`)
- Supplement tasks (non-`[代码]` **and** non-`[测试]`) MUST include `产出:` field as indented content — `[测试]` tasks MUST NOT use the `产出:` → `attachments/` routing, because test code belongs in the project's test source tree
- Default output path: `attachments/<filename>` (relative to changeRoot)
- See `schemas/spec-driven/templates/tasks.md` template for full label reference

**Test Planning (测试规划判定, for tasks.md generation):**
- Walk the `specs/*.md` scenarios one by one and judge whether each is testable
- **Testable scenario** → MUST produce a `[测试]` task carrying level + priority
- **Untestable scenario** (pure documentation / configuration change with no verifiable behavior) → MUST STILL produce a `[测试]` task recording the verdict and its rationale, e.g. `- [ ] [测试][单元][P2] 4.2 评估：纯文档变更，无需测试（依据：无可验证行为）`
  - Rationale: a recorded verdict makes "no tests written" distinguishable from "never evaluated" — the same principle as the no-test gate in `venus_tr_test_generate`
- Test tasks depend on their implementation tasks — when a test task covers behavior implemented by another task, note the dependency in the task description so apply schedules them serially

**流程基准消费规则（Flowchart Basis Consumption）**

当关联的 `exploration.md` 含**经用户确认**的 `## 功能流程图` 段时，该流程图即**流程基准**，本技能 MUST 以其为**生成锚点**：

- **design.md 引用而非重建**：design.md MUST 引用该流程图（Mermaid `flowchart TD`）与**关键操作节点清单**（节点 / 操作 / 触发条件 / 证据位置 / 异常路径）；
  MUST NOT 在 design 中**重新发明一套流程**——重写流程即偏差引入点
- **tasks.md 标注节点 id（节点 → 任务的可追溯映射）**：tasks.md 的**每个任务** MUST 标注其对应的节点标识（`[N4]` 形，节点标识与流程图 / 节点清单表保持一致），
  使每个流程节点在任务清单中可被逐一核对
  - 例：`- [ ] [代码] 2.3 实现分批查询 [N4]`
- **MUST NOT 静默补节点**：任务拆解中发现流程图遗漏的节点时，MUST 回到探索阶段更新流程图并**重新经用户确认**；
  MUST NOT 在本技能中静默补节点后继续——静默补全正是偏差的主要来源
- **缺失或未确认时降级**：`exploration.md` 不含 `## 功能流程图` 段，或该段存在但**未获用户确认**（用户在流程最终确认门上拒绝或未表态）时，
  本技能 SHALL 降级为**仅凭 exploration.md** 生成提案；MUST NOT 把未确认的流程图当作既定前提（不据此生成 design 的流程引用与 tasks 的节点标注），
  并 SHALL 在**生成报告**中标注该降级

**Guardrails**
- Create ALL artifacts needed for implementation (as defined by schema's `apply.requires`)
- Always read dependency artifacts before creating a new one
- If context is critically unclear, mark as **[待确认]** and ask the user. Never guess!
- **Material ambiguity划分**: 影响范围/行为契约/向后兼容性/验收标准的歧义 MUST 表面化并向用户提问（标记 [待确认]）；细节性歧义可做合理假设并记录到 planning artifacts
- After all artifacts are created, display a design blueprint summary and wait for user confirmation before suggesting implementation.
- If a change with that name already exists, ask if user wants to continue it or create a new one
- Verify each artifact file exists after writing before proceeding to next

## JSON Sidecar Generation (MANDATORY — JSON-first 合并主产物，显式 Write/Bash 步骤)

**JSON 是结构化数据真源，Markdown 制品由渲染器确定性产出；以下为显式 tool-call 步骤，不是散文期望。唯一源：`openspec/rules/artifact-generation.md` 的 Step G2（JSON-first）——本段仅为快速把握的浓缩要点，冲突时以唯一源为准。**

### 1. JSON 真源写入（proposal / specs / design → change.json）

- proposal / specs / design 三段写入 `<changeRoot>/.venus/change.json`，按 proposal → specs → design 依赖序累积
- 每次更新 MUST 整文件 Write，并保留已有段与根字段现值（`changeName` / `createdAt` / `phase`），`updatedAt` 刷新为当前时间
- 字段结构以 `venus spec instructions` 返回的 `jsonTemplate` 为机器源——MUST NOT 增删字段或改名
- 可选骨架（也可跳过，直接写全 JSON）：`venus spec sidecar init --change "<name>"`——创建 change.json / tasks.json 空骨架，已存在不覆盖（幂等）

### 2. tasks.json（PRIMARY task artifact — AI 写结构化 JSON，代码渲染 tasks.md）

**tasks.json 是权威任务清单；AI 写结构化 JSON，tasks.md 由 `venus spec render tasks` 渲染供人工评审。**

1. 用 Write 工具写 `<changeRoot>/tasks.json`（不是 tasks.md）：
   - `label` 值**不带方括号**（渲染器自动包裹）：`代码` | `测试` | `DB脚本` | `使用说明`
   - `测试` 任务 MUST 带 `subLabel`（`单元` | `功能`）与 `priority`（`P0` | `P1` | `P2`）
   - 字段结构以 `venus spec instructions` 返回的 `jsonTemplate`（`venus/tasks/v1`）为机器源：`id` / `description` / `status` / `dependencies` / `files` / `batchGroup`
2. 写后 MUST 渲染，用户在渲染出的 tasks.md 上确认任务拆解：
   ```bash
   venus spec render tasks --change "<name>"
   ```

### 3. 渲染 MD（每个 artifact 写完后）

```bash
venus spec render <type> --change "<name>"   # type = proposal | specs | design | tasks
```

### 4. 失败处置

- **校验失败（阻断）**：CLI 报错含字段路径（如 `proposal.whatChanges 必须为数组`）→ 按报错修正 JSON 真源后重跑渲染；不得为绕过校验而手改 MD
- **渲染命令不可用（降级）**：CLI 缺失或执行失败 → AI 手写对应 MD（以 `template` 为结构、内容与 JSON 真源一致），记 WARN，不阻断后续 artifact
- tasks.json 是 apply 阶段主执行路径的真源——其缺失会使下游 spec-apply 降级为解析 tasks.md 复选框
