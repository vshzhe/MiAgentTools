---
name: "Venus: 引导式全流程编排"
description: 引导式全流程编排器：探索→[前端设计]→提案(+verify)→深度复查→需求文档→实现(+条件 frontend 实现/test)→归档，委派阶段 SKILL + 桥梁确认门
allowed-tools: Bash(venus:*)
category: Venus / 实现
tags: [venus, tr_impl, genfull, orchestrator, full-pipeline]
---

**Before proceeding, read openspec/rules/ai-coding.md for AI coding guardrails.** Mark undefined items as **[待确认]** and ask the user rather than guessing.

引导式全流程编排器：贯穿探索→归档，委派阶段 SKILL + 阶段间桥梁门。**Trigger boundary**: 引导式全流程（有桥梁确认门）—— 全自动无门用 `venus_tr_impl_auto_workflow`，止于 verify 用 `venus_tr_impl_workflow`。

**Input**: The argument after the command is the user's topic description (what they want to build). Missing parameters are collected interactively; already-provided parameters are skipped.

---

## Phase 0: 初始化

**0.0 Prompt Validation Gate（MANDATORY，澄清门）**: 在 Stage 1 委派之前强制自检用户主题描述（校验对象为用户最终提供的描述；未携带主题时先交互收集，不对空输入校验）。清晰 → 一句话复述理解后直通；不明确 → 先优化并阻塞等待确认或修改，未确认前不得委派 Stage 1。**幂等**：检测到上游已产出提示词基线（本次会话已确认，或探索产物中已存在 `## 提示词基线` 段）时直接通过，不重复确认。

**Prompt Validation Gate (提示词校验门)**: 探索前强制自检用户输入，维度为 目标 Goal / 对象 Object / 范围 Scope / 约束 Constraints / 验收 Acceptance / 歧义 Ambiguity。
- **清晰**（目标 Goal / 对象 Object / 范围 Scope / 歧义 Ambiguity 均无 `❌` 与实质 `⚠️`）→ 一句话复述理解后直通，不输出校验表、不要求确认
- **不明确**（任一维 `❌` 或实质 `⚠️`）→ 先做提示词优化，输出 `【优化后提示词】`（推断项标 `[推断]`、未知项标 `[待确认]`）与 `【优化说明】`，**阻塞等待用户确认或修改**后才继续；出口四条：确认 / 修改 / 拒绝（按原理解继续）/ 显式授权按推断（推断项记入基线后继续），**不得陷入等待死循环**
- **软不明确**（仅细节级歧义）→ 记 `[假设]` 继续
- 优化**不篡改原始意图**、不增加用户未提出的需求
- 校验结论与基线写入探索产物 `## 提示词基线` 段，作为下游唯一语义来源
- 空输入不校验；输入为变更名时以该变更既有制品为校验对象；上游已产出基线时直接通过

TodoWrite 全阶段+桥梁跟踪。检测 actionContext.mode（`venus spec status --json`，CLI 不可用则 Glob 扫描 `openspec/changes/`）：workspace-planning 模式 → 降级为仅探索+提案+深度复查+需求文档，Bridge 2 前停止。初始化贯穿上下文（change-name / changeRoot / has-frontend / has-java-test / tech-stack / 提示词基线 待各阶段填充）。

## Stage 1: 探索（委派 venus_spec_explore）

via Skill tool 传入 topic + 0.0 确认的提示词基线（explore 检测到既有基线直接通过其校验门，不重复确认）。explore 内部完成探索文件创建、CONTEXT.md 检查、能力记忆注入、CodeGraph 基线扫描、多项目扫描、grill L1-L5 追问、关键词检测分析。完成信号：用户获得清晰需求理解，Decisions / 术语 / 边界沉淀。

## Bridge 1: 探索→提案

①就绪：exploration.md 兜底（explore 不强制产出；缺失则补建最小版汇总 Background/Decisions/术语/边界/Codebase Findings，因 verify_proposal 硬依赖）+ CONTEXT.md 存在性校验；②impact analysis：读 Pending 符号，多符号并行 `mcp__codegraph__codegraph_impact --symbol <symbol> --direction upstream --maxDepth 3`，结果回写 exploration.md；③上下文提取 + 信号判定（has-frontend / has-java-test / tech-stack）；④完整性校验（决策足够供提案）；⑤门：引导模式暂停确认"进入提案"。①.1 功能流程图兜底与确认（见下）在 ⑤ 门内一并确认。

**①.1 功能流程图兜底补建与确认（MANDATORY）**:

**功能流程图（Functional Flowchart）**: 把探索发现的业务功能流程固化为探索产物 `## 功能流程图` 段（Mermaid `flowchart TD` + 关键操作节点清单表）。
- **节点粒度** = 可独立验证的业务操作单元（用户操作 / 业务判定 / 数据写入 / 外部调用）；节点标识在图中与表中 MUST 一致，多流程时全局唯一递增
- **清单列集**：节点 / 操作 / 触发条件 / 证据位置 / 异常路径
- **证据追溯（硬约束）**：每节点 MUST 填 `文件:行` 或 类.方法；新建功能标 `[新建]` + 预期产物；无法追溯证据的节点 MUST NOT 进入清单
- **流程最终确认门（阻塞）**：呈现流程图与清单并等待确认；出口四条：确认 / 修改 / 拒绝（记未确认状态，提案降级 + 验证该维度 SKIP）/ 显式授权按推断（推断节点标 `[推断]`）——不得陷入等待死锁
- **回改规则**：发现遗漏节点 MUST 回探索更新并重新确认，MUST NOT 在任务清单静默补节点
- 节点数超 50 时按子流程分节；本块 MUST NOT 含任何 Bash 命令示例

- **兜底（强制补建）**：exploration.md 缺失 `## 功能流程图` 段时（Stage 1 的 explore 走条件触发分支未产出），由 genfull 依 Decisions / 边界场景 / Codebase Findings 强制补建流程图与节点清单（规则同 tr-impl-workflow 1.5.5：节点证据追溯、`[新建]` 标记 + 预期产物、异常路径），并随 ⑤ 门决策请用户确认流程基准；确认前 MUST NOT 进入 Stage 1.5 / Stage 2，MUST NOT 把未确认流程图当作 propose 的生成锚点
- **幂等**：exploration.md 已含经用户确认的 `## 功能流程图` 段时**直接通过**，MUST NOT 重复产出或再次要求用户确认

## Stage 1.5: 前端设计（条件 has-frontend）

委派 venus_tr_impl_frontend（via Skill tool）**仅执行主 SKILL Phase 1 设计决策**（不读 references、不生成 JSP）：产出页面类型/组件选型/字段-组件映射矩阵/jQuery版本与引入顺序/4种UI状态/交互方式，写入 exploration.md `## 前端设计` 段供 Stage 2 propose 提取到 design.md。设计确认门 = 桥梁点，用户确认后进入提案。references 实现模板（page-templates/component-templates/popup-selectors/action-routing/style-and-security）留待 Stage 3。

## Stage 2: 提案+深度复查+需求文档

2.1 委派 venus_spec_propose（via Skill tool，传 change-name + 关联 exploration）：内部创建变更目录、按依赖序生成 proposal/specs/design/tasks、迁移 exploration.md、同步 CONTEXT.md、**自动调用 venus_spec_verify_proposal**（D1-D9，90% 阈值，FAIL 内部 auto-fix 闭环，仍 FAIL 暂停供决策）。verify PASS 后：2.2 委派 venus_tr_impl_review_proposal（8 维度只读复查；fallback 内联复查 + WARN）；2.3 委派 venus_tr_docs_requirement_doc（非交互，输出 `openspec/changes/<change-name>/需求文档.md`；失败 WARN 继续）。

## Bridge 2: 提案→实现

①就绪：proposal/design/specs/tasks 齐全 + verify PASS + 深度复查完成 + 需求文档已生成 + apply instruction=`ready`（`venus spec instructions apply --change "<name>" --json`；CLI 不可用读 tasks.md 推断）；②workspace-planning 降级在此停止；③门：引导模式暂停确认"进入实现"，呈现提案摘要 + 评分 + 复查结论 + 需求文档路径 + 条件子阶段预告。

## Stage 3: 实现（委派 venus_spec_apply + 条件子阶段）

3.1 委派 venus_spec_apply（via Skill tool，传 change-name + `auto-mode=true` 跳过 Step 5.5，由 Bridge 2 承载确认）：分层代码生成（Entity/DTO → Mapper/DAO → Service → Controller → Frontend）、tasks.md 复选框更新、Step 8 编译检查；后端按 `openspec/rules/ai-coding.md` 架构规则自行处理。3.2 条件（has-frontend）：委派 venus_tr_impl_frontend **仅执行 Phase 2 实现**（基于 Stage 1.5 设计方案读 references 生成 JSP，不重做设计），实现确认门 = 桥梁点，输出 JSP + 安全加固。3.3 条件（has-java-test）：委派 venus_tr_test_generate（多 schema 自动检测 Java 并加载 schema-java.md），测试计划确认门 = 桥梁点，输出 `src/test/java/.../XxxTest.java` + 运行验证。错误处理：编译失败（3 次后）暂停不归档；确认门拒绝回退 Bridge 2；子代理失败 retry 一次。

## Bridge 3: 实现→归档

①就绪：tasks.md 全 `- [x]` + 编译通过 + 条件子阶段完成；②门：引导模式暂停确认"进入归档"，呈现实现摘要 + 编译结果 + 测试通过率 + 条件子阶段产物。

## Stage 4: 归档（委派 venus_spec_archive）

via Skill tool 传 change-name（跳过选择）。archive 内部完成 delta spec 合并主规格、CONTEXT.md 同步、探索记忆同步 `specs/<cap>/explorations.md`、目录迁移 `archive/`、ARCHIVE-INDEX.md 更新、需求文档迁移 `devdocs/`、条件 CodeGraph sync；sync 检查点 non-blocking。记忆闭环：`specs/<cap>/explorations.md` 供下一轮 propose 读取。输出全流程总结。

---

## Guardrails

委派不内联（阶段执行委派对应 SKILL，genfull 只编排 + 桥梁，区别于 venus_tr_impl_workflow）；MUST validate prompt before delegating（0.0 提示词校验门，清晰直通 / 不明确须优化并确认，未确认不委派 Stage 1）且幂等（检测到既有提示词基线直接通过，不重复确认）；确认门四条出口不得死锁；桥梁保证完整性（①上下文交接 ②就绪检查 ③完整性校验 ④门决策）；引导式门控（Bridge 1/2/3 暂停确认，frontend 设计/实现确认门与 test 确认门作桥梁点）；前端设计前置（Stage 1.5 仅设计喂入 propose design.md，Stage 3.2 仅实现读 references 生成 JSP，设计与实现分离）；don't skip questioning（grill L1-L5 由 explore 承载）；read-only operations（文件 / CodeGraph / impact）直接执行但桥梁确认门等待确认；auto-mode to apply（Stage 3 传 auto-mode=true，Bridge 2 承载确认避免 Step 5.5 重复）；pass change-name to archive；deep review + requirement doc after verify PASS（先复查再需求文档，FAIL 不生成）；impact analysis at Bridge 1（explore 只准备符号，Bridge 1 补跑 codegraph_impact）；exploration.md fallback（缺失补建最小版，verify 硬依赖）；do flowchart fallback（Bridge 1 ①.1 缺失 `## 功能流程图` 段时依 Decisions / 边界场景 / Codebase Findings 强制补建并随门决策确认流程基准，确认前不进入 Stage 1.5 / Stage 2）；do flowchart idempotency（已含经用户确认的 `## 功能流程图` 段时直接通过，不重复产出或再次要求确认）；actionContext.mode detection（workspace-planning 降级）；MUST preserve source on migration failure；do explore codebase before asking；do show quantified scores；don't lose exploration。Build all paths with `path.join()`.
