---
name: venus_tr_impl_genfull
description: "Guided full-pipeline orchestrator: explore→[frontend-design]→propose(+verify)→deep-review→apply(+conditional frontend-impl/test)→archive (which aligns the requirement document), delegating stage SKILLs with bridge gates between stages to ensure each process completeness. Frontend design (Phase 1) is front-loaded to proposal stage; frontend impl (Phase 2) stays in apply. Triggers: 全流程编排 / genfull / 引导式全流程 / coupled stage workflow. Use when the user wants a guided end-to-end pipeline through archive with per-stage confirmation bridges (coupling explore/frontend/propose/apply/test/archive SKILLs). NOT for inline single-SKILL workflow (use venus_tr_impl_workflow), fully-automated no-gate pipeline (use venus_tr_impl_auto_workflow), or debugging (use venus_tr_impl_debug)."
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(venus:*), Bash(git:*), mcp__codegraph, mcp__codegraph__codegraph_status, mcp__codegraph__codegraph_files, mcp__codegraph__codegraph_search, mcp__codegraph__codegraph_context, mcp__codegraph__codegraph_node, mcp__codegraph__codegraph_callers, mcp__codegraph__codegraph_callees, mcp__codegraph__codegraph_impact, mcp__codegraph__codegraph_explore, Skill(spec_explore), Skill(tr_impl_frontend), Skill(spec_propose), Skill(tr_impl_review_proposal), Skill(tr_docs_requirement_doc), Skill(spec_apply), Skill(tr_test_generate), Skill(spec_archive)
license: MIT
compatibility: 依赖 venus CLI（spec 命令组）与阶段技能（venus_spec_explore/propose/apply/archive + venus_tr_impl_review_proposal + venus_tr_impl_frontend + venus_tr_test_generate）；需求文档技能由验证阶段和归档阶段调用（经 spec-archive 的依赖注入与会话级权限放行），本技能 Stage 2.3 直接调用；CLI 缺失时各阶段技能各自降级。
metadata:
  author: venus-agent-tools
  version: "1.0"
  type: tr_impl
  generatedBy: "snapshot"
  generatedFingerprint: "sha256:3265063d31d7b6b8df4cf93af08a99e874f0d09a5211dfebd85a81bae19da395"
---

**适用 openspec/rules/ai-coding.md 全域护栏。** 未定义项标 **[待确认]**，禁止猜测。

引导式全流程编排器 —— 贯穿探索→归档，委派阶段 SKILL + 阶段间桥梁门。

区别于 `venus_tr_impl_workflow`（单一 SKILL 内联 explore/propose/verify，止于 verify）与 `venus_tr_impl_auto_workflow`（全自动无门）：genfull **委派各阶段 SKILL** 执行，阶段间以桥梁（上下文交接 + 就绪检查 + 完整性校验 + 人工确认门）保证每个流程的完整性，贯穿到归档。

This orchestrator guides you through:
1. **Phase 0: 初始化** - TodoWrite 全阶段跟踪 + actionContext.mode 检测
2. **Stage 1: 探索** - 委派 venus_spec_explore（交互式 grill L1-L5）
3. **Bridge 1** - exploration.md 兜底 + impact analysis + 信号判定 + 确认门
4. **Stage 1.5: 前端设计**（条件 has-frontend）- 委派 venus_tr_impl_frontend 仅设计，产出喂入 propose
5. **Stage 2: 提案** - 委派 venus_spec_propose（内部自动 verify_proposal）→ 深度复查 → 收束 + 需求文档生成
6. **Bridge 2** - 就绪校验 + 确认门
7. **Stage 3: 实现** - 委派 venus_spec_apply（auto-mode）+ 条件 frontend 实现/test
8. **Bridge 3** - 完整性校验 + 确认门
9. **Stage 4: 归档** - 委派 venus_spec_archive（需求文档生成 + 记忆闭环）

## ⛔ GATE PROTOCOL — ACTIVE

This skill contains **CONFIRMATION GATES** marked with **⛔ GATE:**. Each gate is a HARD STOP:
- When you reach a ⛔ GATE, **YOUR RESPONSE ENDS THERE** — output the gate content, then STOP
- Do NOT execute, describe, or pre-generate steps beyond the gate
- The user's next message is the confirmation signal — resume from AFTER the gate only when they respond
- **VIOLATION**: executing beyond a gate without user confirmation is a critical error that corrupts the workflow

---

## Phase 0: 初始化

**Input**: User's topic description (what they want to build).

Use the **TodoWrite tool** to initialize tracking:
`[{"content":"Phase 0: 初始化","status":"in_progress"},{"content":"Stage 1: 探索（venus_spec_explore）","status":"pending"},{"content":"Bridge 1: 探索→提案","status":"pending"},{"content":"Stage 1.5: 前端设计（条件 has-frontend）","status":"pending"},{"content":"Stage 2: 提案+深度复查","status":"pending"},{"content":"Bridge 2: 提案→实现","status":"pending"},{"content":"Stage 3: 实现（含条件 frontend/test）","status":"pending"},{"content":"Bridge 3: 实现→归档","status":"pending"},{"content":"Stage 4: 归档","status":"pending"}]`

### 0.0 Prompt Validation Gate (MANDATORY)

**⚠️ MANDATORY: 本门在 Stage 1 委派之前执行，不得跳过。**

**门的校验对象是用户最终提供的需求描述**：调用未携带主题时，先交互收集主题描述，再以收集后的描述执行本门，MUST NOT 对空输入执行校验。

**Prompt Validation Gate (提示词校验门)**: 探索前强制自检用户输入，维度为 目标 Goal / 对象 Object / 范围 Scope / 约束 Constraints / 验收 Acceptance / 歧义 Ambiguity。
- **清晰**（目标 Goal / 对象 Object / 范围 Scope / 歧义 Ambiguity 均无 `❌` 与实质 `⚠️`）→ 一句话复述理解后直通，不输出校验表、不要求确认
- **不明确**（任一维 `❌` 或实质 `⚠️`）→ 先做提示词优化，输出 `【优化后提示词】`（推断项标 `[推断]`、未知项标 `[待确认]`）与 `【优化说明】`，**⛔ GATE: 立即结束本次响应并等待用户确认或修改**（本次响应到此结束，收到用户响应后继续；出口：确认 / 修改 / 拒绝 / 显式授权按推断），**不得陷入等待死循环**
- **软不明确**（仅细节级歧义）→ 记 `[假设]` 继续
- 优化**不篡改原始意图**、不增加用户未提出的需求
- 校验结论与基线写入探索产物 `## 提示词基线` 段，作为下游唯一语义来源
- 空输入不校验；输入为变更名时以该变更既有制品为校验对象；上游已产出基线时直接通过

> **完整门细则**见 references/prompt-gate.md。**仅在 Gate 实际触发时**读取全文细则。

**本技能内的执行要求**：

**本技能内的执行要求**：

- 门的位置固定在此处：Phase 0 初始化内、Stage 1 委派 `venus_spec_explore` 之前
- 不明确分支的确认门是**澄清门（确认 WHAT）**：用户确认或修改前 MUST NOT 委派 Stage 1，也不得进入 Stage 1.5 / Stage 2
- **幂等**：若检测到上游已产出经用户确认的提示词基线（本次会话 Phase 0 已确认，或传入的探索产物中已存在 `## 提示词基线` 段），**直接通过，不重复校验或再次要求用户确认**——避免委派链上同一提示词被连续确认两次
- 校验结论（原始提示词 + 确认后的提示词基线）随 Stage 1 委派一并交给 `venus_spec_explore`，由 explore 写入探索产物的 `## 提示词基线` 段

### 0.1 actionContext.mode 检测

- 读取 `openspec/config.yaml` 与当前变更状态（`venus spec status --json`；CLI 不可用则 Glob 扫描 `openspec/changes/`）
- 若检测到 workspace-planning 模式（`actionContext.mode === "workspace-planning"`）：提示"workspace-planning 变更不支持 apply/archive，genfull 将在 Bridge 2 前停止"，降级为仅探索+提案+深度复查
- 否则：全流程贯通到归档

### 0.2 贯穿上下文初始化

- change-name / changeRoot：待 Stage 2 propose 确定
- has-frontend / has-java-test / tech-stack：待 Bridge 1 判定

---

## Stage 1: 探索

**委派 `venus_spec_explore` 技能**（via Skill tool）执行交互式探索：

- 传入用户 topic + 0.0 产出并经用户确认的**提示词基线**
- explore 检测到既有基线后直接通过其提示词校验门，**不重复校验或再次要求确认**（幂等）
- explore 技能内部完成：探索文件创建、CONTEXT.md 检查、能力记忆注入、CodeGraph 基线扫描、多项目扫描、grill L1-L5 追问、关键词检测分析
- explore 是交互式思考伙伴，需求澄清类追问由 explore 承载（genfull 不内联）

**完成信号**：explore 结束时，用户获得清晰的需求理解，Decisions / 术语 / 边界场景已沉淀。

---

## Bridge 1: 探索 → 提案

桥梁统一模型 = ①上下文交接 ②前置就绪检查 ③后置完整性校验 ④门决策（引导模式暂停确认）

### ① 就绪检查：exploration.md 兜底（硬依赖）

- 检查 `openspec/explorations/*.md` 是否存在（explore 不强制产出固定文件）
- **若不存在**：补建最小版本 exploration.md —— 汇总 explore 过程中的 Background / Decisions / 术语表 / 边界场景 / Codebase Findings
- **原因**：`venus_spec_verify_proposal` 无 exploration.md 则报错退出，这是硬依赖
- 记录兜底动作到 TodoWrite

### ①.1 功能流程图兜底补建与确认（硬依赖）

- 检查 exploration.md 是否含 `## 功能流程图` 段——Stage 1 委派的 `venus_spec_explore` 走**条件触发**分支（纯概念探讨 / 未浮现明确业务功能流程）时可能未产出
- **若缺失（强制补建）**：由 genfull 依据 exploration.md 的 **Decisions / 边界场景 / Codebase Findings** 强制补建流程图与节点清单并写入该段——规则与 tr-impl-workflow 1.5.5 完全一致（节点证据追溯、`[新建]` 标记 + 预期产物、异常路径）
- **并入 ⑥ 门决策**：补建完成后随 Bridge 1 门决策一并请用户确认**流程基准**；用户确认前 MUST NOT 进入 Stage 1.5 / Stage 2，MUST NOT 把未确认流程图当作 propose 的生成锚点
- **幂等**：exploration.md 已含**经用户确认**的 `## 功能流程图` 段时（Stage 1 的 explore 已产出并确认，或本次会话 Bridge 1 已确认）**直接通过本步骤**，MUST NOT 重复产出或再次要求用户确认
- 记录补建 / 直通动作到 TodoWrite

**补建规则（生成 → 用户最终确认 → 落盘）**：

**功能流程图（Functional Flowchart）**: 把探索发现的业务功能流程固化为探索产物 `## 功能流程图` 段（Mermaid `flowchart TD` + 关键操作节点清单表）。
- **节点粒度** = 可独立验证的业务操作单元（用户操作 / 业务判定 / 数据写入 / 外部调用）；节点标识在图中与表中 MUST 一致，多流程时全局唯一递增
- **清单列集**：节点 / 操作 / 触发条件 / 证据位置 / 异常路径
- **证据追溯（硬约束）**：每节点 MUST 填 `文件:行` 或 类.方法；新建功能标 `[新建]` + 预期产物；无法追溯证据的节点 MUST NOT 进入清单
- **⛔ GATE: 流程最终确认门（强制停止）**：呈现流程图与清单并立即结束本次响应，等待确认；出口：确认 / 修改 / 拒绝（记未确认状态，提案降级 + 验证该维度 SKIP）/ 显式授权按推断（推断节点标 `[推断]`）——不得陷入等待死锁
- **回改规则**：发现遗漏节点 MUST 回探索更新并重新确认，MUST NOT 在任务清单静默补节点
- 节点数超 50 时按子流程分节；本块 MUST NOT 含任何 Bash 命令示例

> **完整流程图细则**见 references/flowchart-gate.md。**仅在流程浮现时**读取全文细则。

### ② CONTEXT.md 存在性校验

- 检查 `openspec/CONTEXT.md` 存在；缺失则从 exploration.md 术语表补建

### ③ impact analysis（对齐 workflow Phase 1.5/2.0）

- 读取 exploration.md 的 `### For Phase 2 Impact Analysis` 符号清单
- **多符号并行**：两个及以上符号时，同一轮次并行调用 `mcp__codegraph__codegraph_impact --symbol <symbol> --direction upstream --maxDepth 3`
- 结果回写 exploration.md 的 `## Analysis` 段（供 propose 消费）
- 无符号则跳过并记录

### ④ 上下文提取 + 信号判定

- 提取 Decisions / 术语 / 边界场景 / Codebase Findings
- 判定贯穿信号：
  - `has-frontend`：探索决策是否涉及前端页面/JSP（Venus4A 项目）
  - `has-java-test`：是否为 Java 项目（`pom.xml` / `build.gradle`）且需单元测试
  - `tech-stack`：从 `openspec/config.yaml` context 检测

### ⑤ 完整性校验

- 决策是否足够供提案（Decisions 非空、L1-L5 至少到 L3）

### ⑥ 门决策（引导模式）

- 暂停并向用户呈现：探索摘要 + 信号判定结果 + impact 摘要
- **流程基准确认**：若 ①.1 补建了 `## 功能流程图` 段，一并呈现流程图与节点清单请用户确认流程基准；已含经用户确认的流程图时不再重复确认（幂等）
- 等待用户确认"进入提案"
- 用户可回退继续探索

---

## Stage 1.5: 前端设计（条件 has-frontend=true）

**委派 venus_tr_impl_frontend 技能**（via Skill tool）执行**仅设计**部分：

- 传入探索期的页面类型 / 功能模块 / 字段列表
- 指令：**仅执行主 SKILL 的 Phase 1 设计决策**，不读 references 实现模板、不生成 JSP 代码
- 设计产出（写入 exploration.md 的 `## 前端设计` 段，供 Stage 2 propose 提取到 design.md）：
  - 页面类型（list/add/edit/detail/tree）
  - 组件选型（zTree/select2/calendar/ECharts/ymPrompt/DWR 等，基于决策表 + 先查已有实现原则）
  - 字段-组件映射矩阵（字段名 → UI 组件 → 校验/交互规则）
  - jQuery 版本与标准引入顺序
  - 4 种 UI 状态处理（Loading / Empty / Error / Data）
  - 前端-后端交互方式（DWR / form / ajax）
- **设计确认门 = 桥梁点**：用户确认设计方案后进入提案
- references 实现模板（page-templates / component-templates / popup-selectors / action-routing / style-and-security）留待 Stage 3 实现

---

## Stage 2: 提案 + 深度复查

### 2.1 委派 venus_spec_propose（via Skill tool）

- 传入 change-name（或由 topic 推导）+ 关联的 exploration 文件
- propose 内部完成：创建变更目录、按依赖序生成 proposal/specs/design/tasks、迁移 exploration.md、同步 CONTEXT.md
- **propose 内部自动调用 `venus_spec_verify_proposal`**（Phase 3 强制，D1-D9 评分，90% 阈值）
- verify FAIL：propose 内部 auto-fix 回路闭环；仍 FAIL 则暂停供用户决策（[手动编辑] / [返回探索] / [查看差异]）
- verify PASS（≥90%）后继续 2.2

### 2.2 深度复查（委派 venus_tr_impl_review_proposal，via Skill tool）

- 8 维度完整性只读复查（codebase 深度探索 + 合规性验证）
- **fallback**：技能不可用或调用失败 → 降级为编排器内联只读复查 + WARN 日志（不静默跳过）
- 用户可打断跳过

### 2.3 收束（生成需求文档）

- 深度复查完成后收束 Stage 2；以非交互模式调用 `venus_tr_docs_requirement_doc`（via Skill tool）**生成需求文档**到 `openspec/changes/<change-name>/需求文档.md`
- 生成失败非阻断（WARN 记录 + 继续）
- 原因：在提案制品质量最高时生成需求文档，便于用户在实现阶段对照排查；Stage 4 归档阶段对已存在的需求文档做就地增量对齐

---

## Bridge 2: 提案 → 实现

### ① 就绪检查

- proposal.md / design.md / specs/*.md / tasks.md 齐全（Glob 确认）
- verify_proposal PASS（≥90%）
- 深度复查已完成
- （需求文档已在 Stage 2.3 生成——Bridge 2 不将其作为阻塞项）
- apply instruction 状态：`venus spec instructions apply --change "<name>" --json` 返回 `ready`（非 `blocked` / `all_done`）；CLI 不可用则读 tasks.md 推断

### ② workspace-planning 降级

- 若 0.1 检测到 workspace-planning：在此停止，输出"探索+提案+深度复查完成，workspace-planning 不进入实现"

### ③ 门决策（引导模式）

- 暂停并呈现：提案摘要 + 验证评分 + 深度复查结论 + 条件子阶段预告（has-frontend / has-java-test）
- 等待用户确认"进入实现"

---

## Stage 3: 实现

### 3.1 委派 venus_spec_apply（via Skill tool，传 auto-mode=true）

- 传入 change-name + `auto-mode=true`
- **auto-mode=true 跳过 apply 的 Step 5.5 设计确认门**（由 Bridge 2 承载确认，避免重复）
- apply 内部完成：分层代码生成（Entity/DTO → Mapper/DAO → Service → Controller → Frontend）、tasks.md 复选框更新、Step 8 编译检查
- **后端**：按 `openspec/rules/ai-coding.md` 架构规则自行处理（apply 内部分层生成，genfull 不干预）

### 3.2 条件子阶段 3a：前端实现（has-frontend=true）

- 委派 `venus_tr_impl_frontend`（via Skill tool）执行**仅实现**部分
- 传入：前端设计方案（来自 design.md / exploration.md 的 `## 前端设计` 段，由 Stage 1.5 产出）
- 指令：**基于设计方案读 references 实现模板，执行 Phase 2 生成 JSP 代码**（不重做设计决策）
- 读 references：page-templates / component-templates / popup-selectors / action-routing / style-and-security
- 输出 JSP 页面文件 + 安全加固（StringUtils.htmlEncode / 分页参数兼容 / 权限检查）
- **实现确认门 = 桥梁点**：用户确认生成代码后完成

### 3.3 条件子阶段 3b：Java 单元测试（has-java-test=true）

- 委派 `venus_tr_test_generate`（via Skill tool，多 schema 自动检测 Java 并加载 schema-java.md）
- 传入被测类 / 功能描述
- **测试计划确认门 = 桥梁点**：用户确认计划后生成代码（schema-java.md J5.3）
- 输出 `src/test/java/.../XxxTest.java` + 运行验证

### 3.4 实现错误处理

- apply 编译失败（3 次自动修复后）：暂停等待用户，不进归档
- frontend/test 确认门拒绝：回退到 Bridge 2 重新确认
- 子代理失败：auto-retry 一次，仍失败暂停报告

---

## Bridge 3: 实现 → 归档

### ① 就绪检查

- tasks.md 全 `- [x]`（读 tasks.md 确认）
- 编译检查通过（apply Step 8）
- 条件子阶段完成（has-frontend → frontend 已完成；has-java-test → test 已完成）

### ② 门决策（引导模式）

- 暂停并呈现：实现摘要 + 编译结果 + 测试通过率 + 条件子阶段产物
- 等待用户确认"进入归档"

---

## Stage 4: 归档

### 4.1 委派 venus_spec_archive（via Skill tool）

- 传入 change-name（跳过选择 prompt）
- archive 内部完成：delta spec 合并到主规格、CONTEXT.md 同步、探索记忆同步到 `specs/<cap>/explorations.md`、**需求文档对齐（步骤 4.8：已存在则就地增量对齐保人工域；不存在则委派生成——后向兼容存量变更；失败 WARN 非阻断）**、目录迁移到 `archive/`、ARCHIVE-INDEX.md 更新、需求文档迁移到 `devdocs/`
- 所有 sync 检查点 non-blocking（失败 WARN 不阻断）
- 条件性 CodeGraph sync

### 4.2 记忆闭环

- archive 写 `openspec/specs/<cap>/explorations.md`，供下一轮 propose 读取
- 提示用户记忆已沉淀

---

## 完成

显示全流程总结：

```
## Genfull 全流程完成 ✓
Stage 1 探索 → Bridge 1 → [Stage 1.5 前端设计（条件）] → Stage 2 提案+深度复查 → Bridge 2 → Stage 3 实现（含条件 frontend 实现/test）→ Bridge 3 → Stage 4 归档（含需求文档生成）
变更: <change-name>
产物: proposal/design/specs/tasks + 代码 + 测试 + 归档 + 需求文档.md（验证阶段生成）
记忆: specs/<cap>/explorations.md 已更新
```

---

## Guardrails

- **委派不内联** - 阶段执行委派对应 SKILL，genfull 只做编排与桥梁；不内联 explore/propose/apply 的逻辑（区别于 venus_tr_impl_workflow）
- **MUST validate prompt before delegating** - 0.0 提示词校验门是强制 checkpoint：清晰输入一句话复述理解后直通；不明确输入须先做提示词优化并等待用户确认或修改，未确认前 MUST NOT 委派 Stage 1
- **Do prompt-gate idempotency** - 检测到上游已产出提示词基线（本次会话已确认，或探索产物中已存在 `## 提示词基线` 段）时直接通过，不重复校验或再次要求确认
- **Don't deadlock on the confirmation gate** - 0.0 确认门有四条出口（确认 / 修改 / 拒绝后按原理解继续 / 显式授权按推断继续），不得反复要求确认
- **桥梁保证完整性** - 每个桥梁执行 ①上下文交接 ②就绪检查 ③完整性校验 ④门决策，确保每个流程完整
- **引导式门控** - Bridge 1/2/3 在引导模式下暂停确认；frontend 设计/实现确认门与 test 确认门作为桥梁点
- **前端设计前置** - Stage 1.5 委派 venus_tr_impl_frontend 仅执行主 SKILL Phase 1 设计（产出喂入 propose design.md），Stage 3.2 仅执行 Phase 2 实现（读 references 生成 JSP）；设计与实现分离，避免 apply 阶段重做设计
- **Don't skip questioning** - explore 阶段的 grill L1-L5 由 venus_spec_explore 承载，不跳过
- **Do execute read-only operations directly** - 文件读取、CodeGraph、impact analysis 无需确认直接执行
- **Read-only passthrough does not cover clarification gates** - 桥梁确认门与 grill 门仍等待用户确认
- **Do auto-mode to apply** - Stage 3 向 apply 传 auto-mode=true，由 Bridge 2 承载实现确认门，避免 Step 5.5 重复
- **Do pass change-name to archive** - Stage 4 传 change-name 跳过选择
- **Do converge after verify PASS** - verify PASS 后做深度复查并收束，然后生成需求文档（非交互调用 venus_tr_docs_requirement_doc；失败非阻断 WARN）
- **Do impact analysis at Bridge 1** - explore 只准备符号，Bridge 1 补跑 codegraph_impact 传给 propose
- **Do exploration.md fallback** - explore 不强制产出，Bridge 1 缺失时补建最小版（verify 硬依赖）
- **Do flowchart fallback** - Bridge 1 ①.1 检查 exploration.md 是否含 `## 功能流程图` 段；**缺失时**依 Decisions / 边界场景 / Codebase Findings 强制补建流程图与节点清单（规则同 tr-impl-workflow 1.5.5：节点证据追溯、`[新建]` 标记、异常路径），并随 ⑥ 门决策请用户确认流程基准；确认前不进入 Stage 1.5 / Stage 2
- **Do flowchart idempotency** - exploration.md 已含经用户确认的 `## 功能流程图` 段时**直接通过**，不重复产出流程图或再次要求用户确认
- **Do actionContext.mode detection** - workspace-planning 降级，Bridge 2 前停止
- **MUST preserve source on migration failure** - 探索文件迁移失败保留源文件
- **Do explore codebase before asking** - 桥梁判定基于代码探索
- **Do show quantified scores** - verify 评分展示
- **Don't lose exploration** - 文件持久化
- Build all paths with `path.join()`
