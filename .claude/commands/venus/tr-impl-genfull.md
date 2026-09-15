---
name: "Venus: 引导式全流程编排"
description: 引导式全流程编排器：探索→[前端设计]→提案(+verify)→深度复查→需求文档→实现(+条件 frontend 实现/gentest)→归档，委派阶段 SKILL + 桥梁确认门
allowed-tools: Bash(venus:*)
category: Venus / 实现
tags: [venus, tr_impl, genfull, orchestrator, full-pipeline]
---

**Before proceeding, read openspec/rules/ai-coding.md for AI coding guardrails.** Mark undefined items as **[待确认]** and ask the user rather than guessing.

引导式全流程编排器：贯穿探索→归档，委派阶段 SKILL + 阶段间桥梁门。**Trigger boundary**: 引导式全流程（有桥梁确认门）—— 全自动无门用 `venus_tr_impl_auto_workflow`，止于 verify 用 `venus_tr_impl_workflow`。

**Input**: The argument after the command is the user's topic description (what they want to build). Missing parameters are collected interactively; already-provided parameters are skipped.

---

## Phase 0: 初始化

TodoWrite 全阶段+桥梁跟踪。检测 actionContext.mode（`venus spec status --json`，CLI 不可用则 Glob 扫描 `openspec/changes/`）：workspace-planning 模式 → 降级为仅探索+提案+深度复查+需求文档，Bridge 2 前停止。初始化贯穿上下文（change-name / changeRoot / has-frontend / has-java-test / tech-stack 待各阶段填充）。

## Stage 1: 探索（委派 venus_spec_explore）

via Skill tool 传入 topic。explore 内部完成探索文件创建、CONTEXT.md 检查、能力记忆注入、CodeGraph 基线扫描、多项目扫描、grill L1-L5 追问、关键词检测分析。完成信号：用户获得清晰需求理解，Decisions / 术语 / 边界沉淀。

## Bridge 1: 探索→提案

①就绪：exploration.md 兜底（explore 不强制产出；缺失则补建最小版汇总 Background/Decisions/术语/边界/Codebase Findings，因 verify_proposal 硬依赖）+ CONTEXT.md 存在性校验；②impact analysis：读 Pending 符号，多符号并行 `mcp__codegraph__codegraph_impact --symbol <symbol> --direction upstream --maxDepth 3`，结果回写 exploration.md；③上下文提取 + 信号判定（has-frontend / has-java-test / tech-stack）；④完整性校验（决策足够供提案）；⑤门：引导模式暂停确认"进入提案"。

## Stage 1.5: 前端设计（条件 has-frontend）

委派 venus_tr_impl_frontend（via Skill tool）**仅执行主 SKILL Phase 1 设计决策**（不读 references、不生成 JSP）：产出页面类型/组件选型/字段-组件映射矩阵/jQuery版本与引入顺序/4种UI状态/交互方式，写入 exploration.md `## 前端设计` 段供 Stage 2 propose 提取到 design.md。设计确认门 = 桥梁点，用户确认后进入提案。references 实现模板（page-templates/component-templates/popup-selectors/action-routing/style-and-security）留待 Stage 3。

## Stage 2: 提案+深度复查+需求文档

2.1 委派 venus_spec_propose（via Skill tool，传 change-name + 关联 exploration）：内部创建变更目录、按依赖序生成 proposal/specs/design/tasks、迁移 exploration.md、同步 CONTEXT.md、**自动调用 venus_spec_verify_proposal**（D1-D9，90% 阈值，FAIL 内部 auto-fix 闭环，仍 FAIL 暂停供决策）。verify PASS 后：2.2 委派 venus_tr_impl_review_proposal（8 维度只读复查；fallback 内联复查 + WARN）；2.3 委派 venus_tr_docs_requirement_doc（非交互，输出 `openspec/changes/<change-name>/需求文档.md`；失败 WARN 继续）。

## Bridge 2: 提案→实现

①就绪：proposal/design/specs/tasks 齐全 + verify PASS + 深度复查完成 + 需求文档已生成 + apply instruction=`ready`（`venus spec instructions apply --change "<name>" --json`；CLI 不可用读 tasks.md 推断）；②workspace-planning 降级在此停止；③门：引导模式暂停确认"进入实现"，呈现提案摘要 + 评分 + 复查结论 + 需求文档路径 + 条件子阶段预告。

## Stage 3: 实现（委派 venus_spec_apply + 条件子阶段）

3.1 委派 venus_spec_apply（via Skill tool，传 change-name + `auto-mode=true` 跳过 Step 5.5，由 Bridge 2 承载确认）：分层代码生成（Entity/DTO → Mapper/DAO → Service → Controller → Frontend）、tasks.md 复选框更新、Step 8 编译检查；后端按 `openspec/rules/ai-coding.md` 架构规则自行处理。3.2 条件（has-frontend）：委派 venus_tr_impl_frontend **仅执行 Phase 2 实现**（基于 Stage 1.5 设计方案读 references 生成 JSP，不重做设计），实现确认门 = 桥梁点，输出 JSP + 安全加固。3.3 条件（has-java-test）：委派 venus_tr_test_gentest_java，Phase 3 测试计划确认门 = 桥梁点，输出 `src/test/java/.../XxxTest.java` + 运行验证。错误处理：编译失败（3 次后）暂停不归档；确认门拒绝回退 Bridge 2；子代理失败 retry 一次。

## Bridge 3: 实现→归档

①就绪：tasks.md 全 `- [x]` + 编译通过 + 条件子阶段完成；②门：引导模式暂停确认"进入归档"，呈现实现摘要 + 编译结果 + 测试通过率 + 条件子阶段产物。

## Stage 4: 归档（委派 venus_spec_archive）

via Skill tool 传 change-name（跳过选择）。archive 内部完成 delta spec 合并主规格、CONTEXT.md 同步、探索记忆同步 `specs/<cap>/explorations.md`、目录迁移 `archive/`、ARCHIVE-INDEX.md 更新、需求文档迁移 `devdocs/`、条件 CodeGraph sync；sync 检查点 non-blocking。记忆闭环：`specs/<cap>/explorations.md` 供下一轮 propose 读取。输出全流程总结。

---

## Guardrails

委派不内联（阶段执行委派对应 SKILL，genfull 只编排 + 桥梁，区别于 venus_tr_impl_workflow）；桥梁保证完整性（①上下文交接 ②就绪检查 ③完整性校验 ④门决策）；引导式门控（Bridge 1/2/3 暂停确认，frontend 设计/实现确认门与 gentest 确认门作桥梁点）；前端设计前置（Stage 1.5 仅设计喂入 propose design.md，Stage 3.2 仅实现读 references 生成 JSP，设计与实现分离）；don't skip questioning（grill L1-L5 由 explore 承载）；read-only operations（文件 / CodeGraph / impact）直接执行但桥梁确认门等待确认；auto-mode to apply（Stage 3 传 auto-mode=true，Bridge 2 承载确认避免 Step 5.5 重复）；pass change-name to archive；deep review + requirement doc after verify PASS（先复查再需求文档，FAIL 不生成）；impact analysis at Bridge 1（explore 只准备符号，Bridge 1 补跑 codegraph_impact）；exploration.md fallback（缺失补建最小版，verify 硬依赖）；actionContext.mode detection（workspace-planning 降级）；MUST preserve source on migration failure；do explore codebase before asking；do show quantified scores；don't lose exploration。Build all paths with `path.join()`.
