# 全流程编排技能使用说明（genfull 阶段流程与桥梁门详解）

> 适用技能：venus_tr_impl_genfull
> 文档日期：2026-09-16
> 依据：`skills/venus_tr_impl_genfull/SKILL.md` 静态快照原文
> 配套文档：[skills-manual.md](skills-manual.md)（全技能总说明书）

---

## 目录

1. [技能定位与选择决策](#1-技能定位与选择决策)
2. [定位与触发](#2-定位与触发)
3. [全流程详解（Phase 0 + Stage 1-4）](#3-全流程详解phase-0--stage-1-4)
4. [三座桥梁与确认门的行为](#4-三座桥梁与确认门的行为)
5. [条件子阶段与触发信号](#5-条件子阶段与触发信号)
6. [调用示例](#6-调用示例)
7. [输出产物结构](#7-输出产物结构)
8. [常见问题与限制](#8-常见问题与限制)

---

# 1. 技能定位与选择决策

genfull 是**引导式全流程编排器**——把 OpenSpec 生命周期（探索→提案→实现→归档）的各阶段
**委派给对应 SKILL** 执行，阶段间以**桥梁门**（上下文交接 + 就绪检查 + 完整性校验 + 人工确认）
保证每个流程的完整性，贯穿到归档。

```
┌─────────────────────────────────────────────────────────────────┐
│                venus_tr_impl_genfull（编排层）                  │
│  引导式全流程：委派阶段 SKILL + Bridge 1-3 桥梁门，贯穿到归档   │
└──────────────────────────────────────────────────────────┬──────┘
                                                           │ Skill 工具委派（8 个阶段技能）
                                                           ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│Stage 1       │ │Stage 1.5     │ │Stage 2       │ │Stage 3       │
│spec_explore  │ │impl_frontend │ │spec_propose  │ │spec_apply    │
│探索 grill    │ │（仅设计）    │ │提案（内含    │ │实现 auto-    │
│L1-L5         │ │（条件）      │ │验证+复查+    │ │mode 分层+    │
│              │ │              │ │需求文档）    │ │编译检查      │
└──────────────┘ └──────────────┘ └──────────────┘ └───────┬──────┘
                                                         3.2/3.3 条件
                                               ┌───────────┴─────────┐
                                               ▼                     ▼
                                       ┌──────────────┐      ┌──────────────┐
                                       │impl_frontend │      │test_generate │
                                       │（仅实现）    │      │（Java 单测） │
                                       │（条件）      │      │（条件）      │
                                       └──────────────┘      └──────────────┘
Stage 4：spec_archive（归档 + 记忆闭环），由 Bridge 3 确认进入
```

## 1.1 与 workflow / auto_workflow 的选择决策

三者都覆盖"探索→提案"前段，差异在**执行方式**与**终点**：

| 你的需求 | 用哪个技能 |
| :--- | :--- |
| 想从想法到归档全流程走完，**每个阶段有人工确认门**，且各阶段由专门 SKILL 执行 | `genfull`（本文档） |
| 想在**单个 SKILL 内**完成探索 + 提案 + 验证（止于 verify，apply/archive 手动执行） | `venus_tr_impl_workflow` |
| 想全自动无门直接跑到归档（L1-L5 澄清后不再确认） | `venus_tr_impl_auto_workflow` |
| 只想执行某个单独阶段（只探索 / 只提案 / 只实现 / 只归档） | 对应单技能（`venus_spec_explore` 等） |

## 1.2 三编排器关键差异

| 维度 | workflow | auto_workflow | genfull |
| :--- | :--- | :--- | :--- |
| 执行方式 | 单 SKILL 内联 | 单 SKILL 全自动 | **委派各阶段 SKILL** |
| 阶段门 | L1-L5 grill 门 | L1-L5 后全自动无门 | Bridge 1/2/3 + 子阶段确认门 |
| 前端设计 | 无专门阶段 | 无 | **Stage 1.5 前端设计前置到 proposal** |
| 条件子阶段 | 无 | 无 | has-frontend → frontend 实现；has-java-test → test |
| 终点 | 需求文档完毕，等手动 apply/archive | 全流程闭环到归档（无门） | 全流程闭环到归档（每阶段桥梁确认） |

## 1.3 NOT-for 边界（SKILL.md 原文）

- inline 单 SKILL 工作流 → 用 `venus_tr_impl_workflow`
- 全自动无门流水线 → 用 `venus_tr_impl_auto_workflow`
- 调试 bug → 用 `venus_tr_impl_debug`

---

# 2. 定位与触发

- **斜杠命令**：`/venus:tr-impl-genfull`
- **触发词**：全流程编排 / genfull / 引导式全流程 / coupled stage workflow
- **description**：引导式全流程编排器 explore→[frontend-design]→propose(+verify)→deep-review→requirement-doc→apply(+conditional frontend-impl/test)→archive，委派阶段 SKILL 并在阶段间设桥梁门，确保每个流程完整
- **allowed-tools**：`Read, Write, Edit, Glob, Grep, Bash(venus:*), Bash(git:*), Bash(codegraph:*), mcp__codegraph, mcp__codegraph__codegraph_status, mcp__codegraph__codegraph_files, mcp__codegraph__codegraph_search, mcp__codegraph__codegraph_context, mcp__codegraph__codegraph_node, mcp__codegraph__codegraph_callers, mcp__codegraph__codegraph_callees, mcp__codegraph__codegraph_impact, mcp__codegraph__codegraph_explore, Skill(spec_explore), Skill(tr_impl_frontend), Skill(spec_propose), Skill(tr_impl_review_proposal), Skill(tr_docs_requirement_doc), Skill(spec_apply), Skill(tr_test_generate), Skill(spec_archive)`
- **依赖**：venus CLI（spec 命令组）+ 8 个阶段技能（explore / frontend / propose / apply / archive /
  review_proposal / requirement_doc / test_generate）；CLI 缺失时各阶段技能各自降级

## 2.1 前置条件

| 条件 | 说明 |
| :--- | :--- |
| `openspec/` 目录结构 | 项目根需有 CONTEXT.md、rules/、config.yaml、specs/、changes/、explorations/ |
| AI 编码护栏 | 执行前先读 `openspec/rules/ai-coding.md`——Stage 1 遵 Section 1（零猜测）、Stage 2 遵 Section 2（设计先行）、Stage 3 查 Sections 3-5（合规） |
| 输入 | 用户的话题描述（topic），即想构建的内容 |

---

# 3. 全流程详解（Phase 0 + Stage 1-4）

```
Phase 0  初始化
   ├─ TodoWrite 全阶段跟踪（9 项：Phase0 / Stage1 / Bridge1 / Stage1.5 /
   │   Stage2 / Bridge2 / Stage3 / Bridge3 / Stage4）
   ├─ 0.1 actionContext.mode 检测（venus spec status --json；CLI 不可用
   │   则 Glob 扫描 openspec/changes/）
   │   workspace-planning → 降级为"仅探索+提案+深度复查+需求文档"（Bridge 2 前停止）
   └─ 0.2 贯穿上下文初始化：change-name / has-frontend / has-java-test /
       tech-stack（待 Bridge 1 判定）
   │
   ▼
Stage 1  探索 —— 委派 venus_spec_explore（Skill 工具）
   ├─ 传入 topic；explore 内部完成：探索文件创建、CONTEXT.md 检查、能力记忆注入、
   │   CodeGraph 基线扫描、多项目扫描、grill L1-L5 追问、关键词检测分析
   └─ 完成信号：Decisions / 术语 / 边界场景已沉淀（需求澄清类追问由 explore 承载，
       genfull 不内联）
   │
   ▼
Bridge 1  探索 → 提案（详见第 4 章）
   │
   ▼
Stage 1.5  前端设计（条件 has-frontend=true）—— 委派 venus_tr_impl_frontend 仅设计
   ├─ 传入探索期页面类型 / 功能模块 / 字段列表
   ├─ 指令：仅执行主 SKILL 的 Phase 1 设计决策，不读 references、不生成 JSP
   ├─ 设计产出写入 exploration.md 的 "## 前端设计" 段（供 Stage 2 提取到 design.md）
   └─ 设计确认门 = 桥梁点：用户确认设计方案后进入提案
   │
   ▼
Stage 2  提案 + 深度复查 + 需求文档
   2.1 委派 venus_spec_propose：创建变更目录、按依赖序生成四制品、
       迁移 exploration.md、同步 CONTEXT.md；
       propose 内部自动调用 venus_spec_verify_proposal（D1-D9 评分，90% 阈值）——
       FAIL 走内部 auto-fix 回路，仍 FAIL 暂停供用户决策（[手动编辑]/[返回探索]/[查看差异]）
   2.2 委派 venus_tr_impl_review_proposal：8 维度完整性只读复查
       （不可用时降级为编排器内联复查 + WARN，不静默跳过；用户可打断）
   2.3 委派 venus_tr_docs_requirement_doc（非交互）：生成 需求文档.md
       （失败/打断 → WARN 记录原因并继续）
   │
   ▼
Bridge 2  提案 → 实现（详见第 4 章）
   │
   ▼
Stage 3  实现
   3.1 委派 venus_spec_apply（auto-mode=true）
       ├─ auto-mode 跳过 apply 的 Step 5.5 设计确认门（由 Bridge 2 承载，避免重复）
       └─ apply 内部：分层代码生成（Entity/DTO→DAO→Service→Controller→Frontend）、
           tasks.md 复选框更新、Step 8 编译检查
   3.2 条件 3a 前端实现（has-frontend=true）—— 委派 venus_tr_impl_frontend 仅实现
       ├─ 传入 Stage 1.5 的前端设计方案；基于设计读 references 实现模板，
       │   执行 Phase 2 生成 JSP（不重做设计决策）
       └─ 实现确认门 = 桥梁点
   3.3 条件 3b Java 单元测试（has-java-test=true）—— 委派 venus_tr_test_generate（多 schema 自动检测 Java）
       └─ 测试计划确认门 = 桥梁点（schema-java.md J5.3）；输出 src/test/java/.../XxxTest.java + 运行验证
   3.4 错误处理：apply 编译失败 3 次自动修复后仍失败 → 暂停等用户，不进归档；
       frontend/test 确认门拒绝 → 回退 Bridge 2 重新确认；
       子代理失败 → auto-retry 一次，仍失败暂停报告
   │
   ▼
Bridge 3  实现 → 归档（详见第 4 章）
   │
   ▼
Stage 4  归档 —— 委派 venus_spec_archive（传 change-name 跳过选择）
   ├─ archive 内部：delta spec 合并主规格、CONTEXT.md 同步、探索记忆同步
   │   specs/<cap>/explorations.md、目录迁移 archive/、ARCHIVE-INDEX.md 更新、
   │   需求文档迁移 devdocs/、条件 CodeGraph sync（全部 non-blocking，失败 WARN）
   └─ 记忆闭环：归档写入的能力记忆供下一轮 propose 读取
```

---

# 4. 三座桥梁与确认门的行为

桥梁统一模型 = **①上下文交接 ②前置就绪检查 ③后置完整性校验 ④门决策**（引导模式暂停确认）。

## 4.1 Bridge 1：探索 → 提案

| 步骤 | 检查项 | 行为 |
| :--- | :--- | :--- |
| ① 就绪检查 | `openspec/explorations/*.md` 是否存在 | explore 不强制产出固定文件；**缺失时补建最小版**（汇总 Background / Decisions / 术语表 / 边界场景 / Codebase Findings）。原因：verify_proposal 无 exploration.md 会报错退出，这是硬依赖。兜底动作记录到 TodoWrite |
| ② 存在性校验 | `openspec/CONTEXT.md` | 缺失则从 exploration.md 术语表补建 |
| ③ impact analysis | exploration 的 `### For Phase 2 Impact Analysis` 符号清单 | **多符号并行**调用 `codegraph_impact --direction upstream --maxDepth 3`；结果回写 exploration.md 的 `## Analysis` 段供 propose 消费；无符号跳过并记录 |
| ④ 信号判定 | 贯穿信号 | `has-frontend`（决策是否涉及前端/JSP）/ `has-java-test`（Java 项目且需单测）/ `tech-stack`（config.yaml context）——决定 Stage 1.5 与 3.2/3.3 是否触发 |
| ⑤ 完整性校验 | 决策充分性 | Decisions 非空、L1-L5 至少到 L3 |
| ⑥ 门决策 | 人工确认 | 暂停呈现：探索摘要 + 信号判定结果 + impact 摘要；等用户确认"进入提案"；可回退继续探索 |

## 4.2 Bridge 2：提案 → 实现

| 步骤 | 检查项 | 行为 |
| :--- | :--- | :--- |
| ① 就绪检查 | 提案完整性 | proposal.md / design.md / specs/*.md / tasks.md 齐全（Glob 确认）+ verify PASS（≥90%）+ 深度复查已完成 + 需求文档已生成（或 WARN 跳过）+ apply instruction 状态 ready（`venus spec instructions apply --json`；CLI 不可用读 tasks.md 推断） |
| ② 降级停止 | workspace-planning | Phase 0 检测到 workspace-planning 模式 → 在此停止，输出"探索+提案+深度复查+需求文档完成，不进入实现" |
| ③ 门决策 | 人工确认 | 暂停呈现：提案摘要 + 验证评分 + 深度复查结论 + 需求文档路径 + 条件子阶段预告（has-frontend / has-java-test）；等用户确认"进入实现" |

## 4.3 Bridge 3：实现 → 归档

| 步骤 | 检查项 | 行为 |
| :--- | :--- | :--- |
| ① 就绪检查 | 实现完整性 | tasks.md 全 `- [x]` + 编译检查通过（apply Step 8）+ 条件子阶段完成（has-frontend → frontend 已完成；has-java-test → test 已完成） |
| ② 门决策 | 人工确认 | 暂停呈现：实现摘要 + 编译结果 + 测试通过率 + 条件子阶段产物；等用户确认"进入归档" |

## 4.4 三个子阶段确认门

除三座桥梁外，委派的阶段技能内部各有一个**桥梁点级**确认门：

| 确认门 | 位置 | 问什么 |
| :--- | :--- | :--- |
| **前端设计确认门** | Stage 1.5 末 | 页面类型 / 组件选型 / 字段-组件映射 / UI 状态方案是否确认 |
| **前端实现确认门** | Stage 3.2 末 | 生成的 JSP 代码是否确认 |
| **test 计划确认门** | Stage 3.3 中 | 测试任务矩阵（被测类 / 场景 / 生成位置）是否确认 |

> 只读操作（文件读取、CodeGraph 查询、impact analysis、内联只读复查）无需确认直接执行；
> 桥梁确认门与 grill 门仍等待用户确认。

---

# 5. 条件子阶段与触发信号

Bridge 1 判定的三个贯穿信号决定流程分支：

| 信号 | 判定规则 | 触发的子阶段 |
| :--- | :--- | :--- |
| `has-frontend` | 探索决策涉及前端页面/JSP（Venus4A 项目） | Stage 1.5（仅设计）+ Stage 3.2（仅实现） |
| `has-java-test` | 为 Java 项目（`pom.xml` / `build.gradle`）且需单元测试 | Stage 3.3（test_generate 多 schema 检测 Java） |
| `tech-stack` | 从 `openspec/config.yaml` context 检测 | 影响各阶段技能的技术栈适配 |

## 5.1 前端设计/实现分离架构

venus_tr_impl_frontend 拆分为两部分，genfull 分别在不同阶段委派：

| 阶段 | 委派内容 | 输入 | 产出 |
| :--- | :--- | :--- | :--- |
| Stage 1.5（提案前） | **仅设计**：主 SKILL 的 Phase 1 设计决策 | 探索期页面类型/模块/字段 | exploration.md 的 `## 前端设计` 段（页面类型、组件选型、字段-组件映射矩阵、jQuery 版本与引入顺序、4 种 UI 状态、前后端交互方式）——由 Stage 2 提取到 design.md |
| Stage 3.2（实现中） | **仅实现**：读 5 个 references 实现模板执行 Phase 2 | Stage 1.5 的设计方案 | JSP 页面文件 + 安全加固（StringUtils.htmlEncode / 分页参数兼容 / 权限检查） |

分离的价值：**前端设计进入提案制品（design.md）接受验证与深度复查，实现阶段只执行设计**，
避免 apply 阶段重做设计决策。

---

# 6. 调用示例

以下示例均为示意（假设 Venus4A 风格 Java 项目 + OpenSpec 目录就绪）。

## 示例 1：最小调用（后端功能，无前端）

```
用户：/venus:tr-impl-genfull 给用户管理模块加操作日志审计功能，
      记录谁在什么时间对哪些资源做了什么操作
```

流程走向：

```
Phase 0  TodoWrite 建 9 项跟踪；venus spec status --json 检测为 project 模式
         → 全流程贯通到归档
Stage 1  进入 explore 交互（grill 追问由 venus_spec_explore 承载）：
         L1 意图（记录哪些操作类型？）→ L2 方案（AOP 切面 vs 拦截器？）
         → L3 异常（日志写失败是否阻断业务？）→ L5 边界（批量操作记一条还是 N 条？）
Bridge 1 AI：## Bridge 1：探索 → 提案
              探索摘要：4 条 Decisions / 2 个新术语已入 CONTEXT.md / 3 个边界场景
              信号判定：has-frontend=false（纯后端）/ has-java-test=true（检测到 pom.xml）
              Impact：UserService 5 个写方法为上游符号，爆炸半径 2 层
              确认进入提案？[确认] [回退继续探索]
         用户：确认
Stage 2  propose 生成四制品（内部 verify 92% PASS）→ 深度复查 → 需求文档
Bridge 2 AI：## Bridge 2：提案 → 实现
              变更：add-user-module-audit-log / 验证：D1-D9 Overall 92%（PASS）
              深度复查：8 维度通过，补充 2 个遗漏 Scenario 已入 specs
              需求文档：openspec/changes/add-user-module-audit-log/需求文档.md
              条件子阶段预告：3b Java 单测（has-java-test=true）
              确认进入实现？[确认] [修改提案]
         用户：确认
Stage 3  3.1 apply（auto-mode）：分层生成 + 编译检查
         3.3 test_generate（Java schema，计划门确认后生成 AuditLogServiceTest）
Bridge 3 AI：## Bridge 3：实现 → 归档
              Tasks 17/17 / 编译通过 / 测试 12/12 通过
              确认进入归档？[确认] [继续处理]
         用户：确认
Stage 4  archive 归档 + 全套同步 + 记忆沉淀
```

## 示例 2：含前端页面的功能（触发 Stage 1.5 + 3.2）

```
用户：/venus:tr-impl-genfull 做一个操作日志查询页面，支持时间范围、
      操作人、资源类型筛选，分页展示
```

Bridge 1 判定 `has-frontend=true` → 触发 Stage 1.5：

```
AI：## 前端设计方案（Stage 1.5，仅设计）
     页面类型：list（查询列表页）
     组件选型：html:vectorobject 数据表格 / html:page 分页 / calendar.js 时间范围（起止两个）
              / 原生 select 资源类型下拉 / ymPrompt 消息提示 / DWR 异步查询
     jQuery：v1.8.3（IE8 兼容）
     字段-组件映射：
       | 字段 | UI 组件 | 校验/交互 |
       | operation_time | calendar.js ×2 | 起止时间，起 ≤ 止 |
       | operator | util:Text + 选择器弹窗 | 支持回传 |
       | resource_type | 原生 select | 全部/账号/角色/策略 |
     UI 状态：Loading（查询遮罩）/ Empty（空数据提示）/ Error（ymPrompt.error）/ Data（表格）
     确认设计方案？[确认] [调整]
用户：确认
```

设计写入 `exploration.md` 的 `## 前端设计` 段，Stage 2 提取到 design.md 一并接受
验证与深度复查。Stage 3.2 时委派 frontend **仅实现**——读 references 实现模板
（page-templates / component-templates / popup-selectors / action-routing /
style-and-security）生成 JSP，不重做设计决策。

## 示例 3：Stage 3.3 测试计划确认门（桥梁点）

```
AI：## 待确认：测试计划（test_generate / schema-java）
     | 被测类 | 计划方法数 | 覆盖场景 | 依赖 |
     |--------|----------|---------|------|
     | AuditLogService | 5 | 正常3+边界4+异常3 | AuditLogDao, UserManager |
     测试风格对齐：JUnit 4 + Mockito（与项目现有风格一致）
     生成位置：src/test/java/cn/com/venustech/user/service/AuditLogServiceTest.java
     👉 回复"确认"后开始生成代码。
用户：确认
```

## 示例 4：workspace-planning 降级场景

```
用户：/venus:tr-impl-genfull 重构整个配置中心的存储层
AI：（Phase 0 检测到 actionContext.mode = "workspace-planning"）
    workspace-planning 变更不支持 apply/archive，genfull 将在 Bridge 2 前停止，
    降级为仅：探索 + 提案 + 深度复查 + 需求文档。
```

降级流程仍执行 Stage 1 → Bridge 1 → Stage 2，在 Bridge 2 输出完成摘要后停止，
不进入实现与归档。

## 示例 5：verify FAIL 时的处理（Stage 2 内部）

```
AI：（propose 内部 verify_proposal 评分 78% < 90%，FAIL）
    自动修复中：补充 D4 边界覆盖 2 个 Scenario、D6 字段-组件映射矩阵缺失项……
    （重跑 verify）
    评分 91% ≥ 90%，PASS，继续深度复查。
```

若两轮修复后仍 FAIL：propose 暂停供用户决策 `[手动编辑] / [返回探索] / [查看差异]`
（无 skip-to-apply 路径）。

---

# 7. 输出产物结构

```
openspec/
├── explorations/                        ← Stage 1 explore 产出（缺失时 Bridge 1 补建）
├── changes/<change-name>/               ← Stage 2 propose 创建
│   ├── exploration.md                   ← 含 "## 前端设计" 段（条件 has-frontend）
│   ├── proposal.md / specs/ / design.md / tasks.md   ← 标准四制品
│   └── 需求文档.md                       ← Stage 2.3 产出
├── changes/archive/YYYY-MM-DD-<change-name>/   ← Stage 4 归档迁移
│   └── （delta spec 已合并主规格，需求文档迁移 devdocs/）
├── specs/<capability>/
│   ├── spec.md                          ← 主规格（归档时合并 delta）
│   └── explorations.md                  ← 记忆闭环：归档写入，供下一轮读取
└── CONTEXT.md                           ← 术语同步
```

源代码：apply 分层生成（Entity/DTO → DAO → Service → Controller）+
条件 frontend JSP 页面 + 条件 `src/test/java/.../XxxTest.java`。

最终输出格式：

```
## Genfull 全流程完成 ✓
Stage 1 探索 → Bridge 1 → [Stage 1.5 前端设计（条件）] → Stage 2 提案+深度复查+需求文档
→ Bridge 2 → Stage 3 实现（含条件 frontend 实现/test）→ Bridge 3 → Stage 4 归档
变更: <change-name>
产物: proposal/design/specs/tasks + 需求文档.md + 代码 + 测试 + 归档
记忆: specs/<cap>/explorations.md 已更新
```

---

# 8. 常见问题与限制

| 场景 | 行为 |
| :--- | :--- |
| venus CLI 未安装 | 各阶段技能各自降级（CLI-degraded 内联生成）；genfull 编排逻辑不受影响 |
| explore 未产出探索文件 | Bridge 1 兜底补建最小版 exploration.md（verify_proposal 的硬依赖），动作记录到 TodoWrite |
| review_proposal 技能不可用 | 降级为编排器内联只读复查 + WARN 日志（**不静默跳过**）；用户可打断跳过 |
| requirement_doc 生成失败/被打断 | WARN 记录原因并继续（用户可后续单独运行 `/venus:tr-docs-requirement-doc`） |
| apply 编译检查失败 | 3 次自动修复后仍失败 → 暂停等待用户，**不进入归档** |
| frontend/test 确认门被拒绝 | 回退到 Bridge 2 重新确认 |
| 子代理/阶段技能失败 | auto-retry 一次，仍失败暂停报告用户 |
| workspace-planning 变更 | Bridge 2 前停止（apply/archive 不支持 workspace 范围） |
| 探索文件迁移失败 | 保留源文件不删除（MUST preserve source） |
| CodeGraph 不可用 | 阶段技能各自降级 Glob/Grep（genfull 的 impact analysis 相应降级并记录） |
| Bridge 确认未响应 | 流程暂停等待——引导式门控不超时自动前进 |

---

*本文档基于 `skills/venus_tr_impl_genfull/SKILL.md` 静态快照编写；
技能行为以 SKILL.md 实际内容为准。*
