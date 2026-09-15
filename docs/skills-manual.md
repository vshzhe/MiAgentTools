# Venus 技能使用说明书（完整版）

> 适用版本：Unreleased（基于 v0.1.0 + spec 工作流扩展）
> 文档日期：2026-09-15
> 覆盖范围：全部 23 个技能
> 技能快照来源：`skills/` 目录（由 `pnpm build && pnpm generate:skills` 生成，禁止手工编辑）

---

## 目录

- [第一部分：总览](#第一部分总览)
- [第二部分：spec 核心工作流（4 个）](#第二部分spec-核心工作流4-个)
    - [2.1 venus_spec_explore 探索模式](#21-venus_spec_explore探索模式)
    - [2.2 venus_spec_propose 创建变更提案](#22-venus_spec_propose创建变更提案)
    - [2.3 venus_spec_apply 实现变更](#23-venus_spec_apply实现变更)
    - [2.4 venus_spec_archive 归档变更](#24-venus_spec_archive归档变更)
- [第三部分：质量门与验证（4 个）](#第三部分质量门与验证4-个)
    - [3.1 venus_spec_verify_proposal 提案验证门](#31-venus_spec_verify_proposal提案验证门)
    - [3.2 venus_spec_verify 实现验证](#32-venus_spec_verify实现验证)
    - [3.3 venus_tr_impl_review_proposal 提案深度复查](#33-venus_tr_impl_review_proposal提案深度复查)
    - [3.4 venus_spec_bulk_archive 批量归档](#34-venus_spec_bulk_archive批量归档)
- [第四部分：一站式工作流（3 个）](#第四部分一站式工作流3-个)
    - [4.1 venus_tr_impl_workflow 引导式工作流](#41-venus_tr_impl_workflow引导式工作流)
    - [4.2 venus_tr_impl_auto_workflow 全自动工作流](#42-venus_tr_impl_auto_workflow全自动工作流)
    - [4.3 venus_tr_impl_debug 调试工作流](#43-venus_tr_impl_debug调试工作流)
- [第五部分：迁移套件（3 个）](#第五部分迁移套件3-个)
    - [5.1 venus_tr_docs_feature_doc 功能地图生成](#51-venus_tr_docs_feature_doc功能地图生成)
    - [5.2 venus_tr_impl_migration_check 迁移一致性检查](#52-venus_tr_impl_migration_check迁移一致性检查)
    - [5.3 venus_tr_impl_auto_migration 一站式自动迁移](#53-venus_tr_impl_auto_migration一站式自动迁移)
- [第六部分：文档交付（1 个）](#第六部分文档交付1-个)
    - [6.1 venus_tr_docs_requirement_doc 变更转需求文档](#61-venus_tr_docs_requirement_doc变更转需求文档)
- [第七部分：直接实现（1 个）](#第七部分直接实现1-个)
    - [7.1 venus_tr_impl_feature 直接实现功能](#71-venus_tr_impl_feature直接实现功能)
- [第八部分：开发生命周期（5 个）](#第八部分开发生命周期5-个)
- [第九部分：工具类（2 个）](#第九部分工具类2-个)
- [第十部分：组合使用模式](#第十部分组合使用模式)
- [第十一部分：使用情况](#第十一部分使用情况)
- [第十二部分：已知问题与限制](#第十二部分已知问题与限制)

---

# 第一部分：总览

VenusAgentTools 是 AI Agent 技能生成与管理 CLI，按生命周期类型生成 `venus_` 前缀的 SKILL 与斜杠指令，
安装到目标项目的 `.claude/` 目录。当前共 **23 个技能**，分为 **9 个生命周期类型**：

| 类型 | 中文名 | 技能数 | 技能清单 |
| :--- | :--- | :--- | :--- |
| `spec` | 规格 | 7 | explore / propose / apply / archive / verify / verify_proposal / bulk_archive |
| `tr_impl` | 实现 | 7 | feature / workflow / auto_workflow / debug / review_proposal / migration_check / auto_migration |
| `tr_docs` | 文档 | 2 | feature_doc / requirement_doc |
| `tr_init` | 初始化 | 1 | init_project |
| `tr_test` | 测试 | 1 | test_generate |
| `tr_commit` | 提交 | 1 | commit_change |
| `tr_review` | 审查 | 1 | review_code |
| `tr_release` | 版本 | 1 | release_version |
| `tr_tools` | 工具 | 2 | tools_pwd / tools_list |

**命名规则**：技能名 `venus_<type>_<name>`（下划线分段）；斜杠指令由技能名派生——去 `venus_` 前缀、
下划线转连字符，如 `venus_tr_impl_debug` → `/venus:tr-impl-debug`。

## 核心变更生命周期全景

```
                        ┌────────────────────────────────────────────────┐
                        │            一站式工作流（编排层）                │
                        │  workflow（引导式） / auto_workflow（全自动）    │
                        │  debug（调试循环，逆向进入生命周期）              │
                        └───────────────┬────────────────────────────────┘
                                        │ 编排调用
                                        ▼
[用户想法]        [提案生成]              [验证门]          [实现]              [归档]
     │                 │                     │                │                   │
     ▼                 ▼                     ▼                ▼                   ▼
  explore  ────▶  propose  ────▶  verify_proposal  ──▶  apply  ──▶ verify ──▶ archive ──▶ bulk_archive
  思考/调研      一步生成制品      D1-D9 评分≥90%      设计门+批调度  实现验证    同步specs+      批量归档+
  (stance)      proposal/design   review_proposal     +编译检查     (report)    知识图谱+        冲突解决
                 specs/tasks       深度复查                                      探索记忆
                                        ▼
                                 requirement_doc（需求文档交付）
```

## 全局通用规范（所有技能共同遵守）

| 规范 | 内容 |
| :--- | :--- |
| **[待确认] 零猜测** | 数据库字段、业务逻辑、API 参数未定义时，必须标记 **[待确认]** 询问用户，禁止猜测 |
| **context/rules 不入文件** | CLI 返回的 context 与 rules 是约束，禁止复制到输出制品 |
| **venus CLI 驱动** | 变更目录必须由 `venus spec new` 创建（生成 `.openspec.yaml` 元数据），禁止手工建目录 |
| **CodeGraph 优先** | 必须先 `codegraph_status` 确认可用性；确认不可用前禁止 Glob/Grep 调研代码库 |
| **路径跨平台** | 所有文件路径用 `path.join()` 构建（Windows 盘符 + POSIX 分隔符） |
| **CLI-degraded 降级** | 首次 `venus spec` 命令未找到 → 切换 AI 内联模板生成，不再中途重试 CLI |
| **评分阈值** | verify_proposal / workflow / debug 统一 90%（≥90% PASS，<90% FAIL，无 skip 路径） |
| **中文正文** | 技能正文、注释使用中文，标识符保留英文 |

---

# 第二部分：spec 核心工作流（4 个）

## 2.1 venus_spec_explore（探索模式）

### 定位与触发

- **斜杠命令**：`/venus:spec-explore`
- **description**：进入探索模式。当用户想要在变更前或变更中思考问题、调研代码库、明确需求时使用
- **allowed-tools**：`Read, Write, Edit, Glob, Grep, Bash(venus:*), Bash(git:*), Bash(codegraph:*)`
- **核心立场**："This is a stance, not a workflow"——无固定步骤、无必需序列、无强制输出

### 输入

| 输入项 | 说明 |
| :--- | :--- |
| 模糊想法 | 如"我在考虑加一个实时协作功能" |
| 具体问题 | 如"认证系统太乱了，帮我理一理" |
| 变更 ID | 中途卡住时：`/venus:spec-explore add-auth-system` |
| 方案对比请求 | 多个技术选型的利弊分析 |

无前置条件，可在变更任意阶段进入；变更已存在时读 `venus spec status --json` 的
`changeRoot`、`artifactPaths`、`actionContext` 作上下文。

### 输出

无强制输出。可选产出：

| 输出形态 | 路径 | 说明 |
| :--- | :--- | :--- |
| 探索记忆 | `openspec/explorations/` | 扫描后主动提议保存（不自动写） |
| 捕获到现有变更 | `specs/<capability>/spec.md`（新需求）、`design.md`（设计决策）、`proposal.md`（范围变更）、`tasks.md`（新工作） | 仅在用户确认时 |
| 无文件输出 | — | "Sometimes the thinking IS the value" |

### 操作手册

```
1. 进入探索模式
   ├─ 读 openspec/rules/ai-coding.md（AI 编码护栏）
   └─ venus spec status --json 检查上下文

2. 代码库调研（CodeGraph 优先）
   ├─ MUST 先运行 codegraph_status
   ├─ 可用：codegraph_files + codegraph_search
   └─ 不可用：回退 Glob/Grep（last resort）

3. 深度设计意图分析（修改既有代码时）
   ├─ 6 维度分析表：Design Rationale / Constraints / Trade-offs /
   │  Pattern Usage / Historical Context / Implicit Assumptions
   └─ 置信度标注：HIGH / MEDIUM / LOW（LOW 必须确认并标 ⚠）

4. 可视化 + 多线程展开（纯 ASCII 绘图：+ - | --> ^ v）

5. 捕获决策（仅提议，不自动捕获；提议后即继续，不施压）

6. 结束（可选）：流入提案 / 更新制品 / 仅提供清晰结论
```

**交互点**：只读操作直接执行不暂停；仅在"提议保存/捕获"时询问用户。

### 初步规范

- **CodeGraph 优先级**：确认不可用前禁止 Glob/Grep
- **置信度标注**：LOW 置信度必须向用户确认并标 ⚠
- **[待确认] 标记**：未定义的数据库字段/API 参数/业务逻辑禁止猜测

### 使用情况与问题

- **NOT-for**：探索模式只思考不实现——可创建制品捕获思考，但**永不写代码**；用户要实现时提醒先创建变更提案
- **Guardrails（7 条）**：不实现 / 不假装理解 / 不急躁 / 不强加结构 / 不自动捕获 / 可视化 / 质疑假设
- **依赖**：venus CLI、CodeGraph MCP（不可用降级 Glob/Grep）、`openspec/rules/ai-coding.md`

---

## 2.2 venus_spec_propose（创建变更提案）

### 定位与触发

- **斜杠命令**：`/venus:spec-propose`
- **description**：创建变更提案。当用户要快速描述想构建的内容并一步生成包含设计、规格和任务的完整提案时使用
- **allowed-tools**：`Read, Write, Edit, Glob, Grep, Bash(venus:*)`

### 输入

| 输入项 | 必需 | 说明 |
| :--- | :--- | :--- |
| 变更名或描述 | 是 | kebab-case 变更名，或一段自然语言描述（自动推导命名） |
| 探索上下文 | 否 | 检测到 `openspec/explorations/` 有文件时，必须让用户选择关联或跳过（不允许静默跳过） |

无明确输入时开放式提问；**禁止在未理解用户意图前推进**。

### 输出

在 `openspec/changes/<change-name>/` 下生成：

| 文件 | 内容 |
| :--- | :--- |
| `proposal.md` | 变更的 what & why（必需段：Why / What Changes / Capabilities / Impact） |
| `design.md` | how——决策、架构、依赖（含并发分组信息） |
| `specs/<capability>/spec.md` | delta 规格（ADDED/MODIFIED/REMOVED/RENAMED 头；`#### Scenario:` 4 井号 + WHEN/THEN/AND） |
| `tasks.md` | 带类型标签的任务清单（`- [ ] X.Y` 复选框格式） |
| `exploration.md` | （可选）用户选择关联时从 `openspec/explorations/` 迁移而来 |

**任务类型标签**：`[代码]` / `[DB脚本]` / `[使用说明]` / `[API文档]` / `[配置示例]` / `[部署说明]` / `[测试数据]`；
非 `[代码]` 任务必须含 `产出:` 字段（默认输出 `attachments/<filename>`）。

### 操作手册

```
Step 0: 探索文件检测（MANDATORY 前置）
  0. 能力级探索记忆检测：检查 openspec/specs/<capability>/explorations.md，
     存在则注入历史 Decisions/术语/边界场景到上下文
  1. Glob openspec/explorations/*.md；有文件 → MUST 提示用户 [关联] / [跳过]
  2. CONTEXT.md 术语表检查（缺失自动同步/生成）
  3. 关联 → 迁移到 changes/<name>/exploration.md
  4. 探索内容定向传递：Decisions→proposal / Analysis→design /
     Questions→specs / Codebase Findings→tasks

Step 1: 输入与命名（kebab-case 推导）
  命名规范：{prefix}-{module}-{feature}
  Prefix：add- / fix- / improve- / refactor- / remove- / docs- / security- / config- /
    perf- / sync-{customer}-
  优先级：security > fix > sync > add > remove > improve > refactor > perf > config > docs
  Module：Glob openspec/specs/ 匹配模块关键词

Step 2: 创建变更目录 —— venus spec new "<name>"

Step 3: 获取制品构建顺序 —— venus spec status --change "<name>" --json

Step 4: 按依赖顺序创建制品（TodoWrite 跟踪）
  对每个 ready 的 artifact：
    a. venus spec instructions <artifact-id> --change ... --json
    b. 读依赖制品文件作上下文
    c. 用 template 作结构写到 resolvedOutputPath
  ⚠ 并行 delta spec 生成（多 capability）：派 sub-agent 每 capability 一个；
    单 capability 自动串行回退；sub-agent 失败串行重试

Step 5: 显示最终状态 —— venus spec status --change "<name>"

Step 6: Phase 3 验证（auto — MANDATORY，不可跳过）
  ├─ 调用 venus_spec_verify_proposal skill（Skill 工具，非 CLI 指令）
  ├─ 派独立只读 review sub-agent 评分；失败回退内联评分 + WARN
  ├─ PASS (≥90%)：可做内联只读深度复查
  └─ FAIL (<90%)：自动修复→重跑→仍 FAIL 提供
     [手动编辑] / [返回探索] / [查看差异]（无 skip-to-apply 路径）

全部制品创建后：显示设计蓝图摘要，等待用户确认后再建议实现。
```

### 初步规范

- **命名规范（强制）**：`{prefix}-{module}-{feature}` 三段式
- **90% 验证阈值**：统一阈值（旧 70%/90% 双带已移除）
- **同名变更已存在**：询问用户继续 or 新建
- **每个制品写后验证存在**再继续

### 使用情况与问题

- **Guardrails**：创建所有 `apply.requires` 制品；始终先读依赖制品；严重不清标 **[待确认]**
- **已知约束**：依赖项目侧提供 `openspec/rules/ai-coding.md`、`artifact-generation.md`、
  `schemas/spec-driven/templates/tasks.md`——不在 skill 目录内
- **降级路径**：sub-agent 失败回退串行；verify_proposal 不可用回退内联评分（WARN）

---

## 2.3 venus_spec_apply（实现变更）

### 定位与触发

- **斜杠命令**：`/venus:spec-apply`
- **description**：实现变更。当 `openspec/changes/` 下已有变更制品（proposal/specs/design/tasks），
  需要基于规格驱动实现任务清单时使用；**用户直接描述需求而无变更制品时，应使用 venus_tr_impl_feature 直接实现**
- **allowed-tools**：`Read, Write, Edit, Glob, Grep, Bash(venus:*), Bash(npm:*), Bash(pnpm:*), Bash(node:*)`

### 输入

| 输入项 | 必需 | 说明 |
| :--- | :--- | :--- |
| 变更名 | 否 | 省略时推断；唯一活跃变更自动选；模糊时 AskUserQuestion |
| 变更制品 | 是 | proposal/specs/design/tasks（缺失时建议先补全） |
| auto-mode | 否 | `auto-mode=true` 跳过设计确认门（自动化工作流使用） |

### 输出

- **代码文件**：在 `allowedEditRoots` 范围内的项目源代码（按分层架构生成）
- **补充文档**：`<changeRoot>/attachments/<filename>`（默认），或 `产出:` 字段指定路径
- **tasks.md 更新**：`- [ ]` → `- [x]`（主 agent 集中管理，sub-agent 禁止改）
- **编译检查报告**：Step 8 强制生成

### 操作手册

```
Step 1: 选择变更（始终宣布 "Using change: <name>"）

Step 2: 检查状态理解 schema —— venus spec status --change "<name>" --json
  ⚠ Workspace guard：actionContext.mode = "workspace-planning" 且
    allowedEditRoots 为空 → STOP（不支持全 workspace apply）

Step 3-5: 读制品 + 显示进度（制品缺失→建议补全；全部完成→建议归档）

Step 5.5: 设计确认门 ⚠ MANDATORY
  ├─ auto-mode=true → 跳过整门直接进 Step 6
  ├─ 否则呈现：📋 设计方案确认
  │    变更 / Schema / 变更概要 / 关键设计决策 / 涉及数据结构API /
  │    [待确认] 项目 / 任务数 / 并发执行计划表（批号|任务|依赖来源|并发串行）/ 补充文档
  ├─ WAIT 用户显式回复 "确认"（[确认 ✓] [修改设计] [取消]）
  └─ Temp workspace 协议：.openspec-tmp/apply-<change-name>/
     （项目本地优先、加入 .gitignore、单次创建单次清理）

Step 6: 实现任务（批调度循环）
  Load 配置：apply.concurrency（默认 3）、mergeAdjacent（默认 true）、
    incrementalCheck（默认 true）
  批调度循环：
    1. 单任务批：主 agent 直接实现，不派 sub-agent
    2. 多单元批：输出并发通知（Batch N/M、sub-agent 数、组标签）
    3. Pre-dispatch overlap check：跨单元同文件冲突 → 拆出串行
    4. 并发派 sub-agent（≤concurrency 上限，滑动窗口）
    5. sub-agent 指令必含：单元任务详情 / 上下文文件 / ai-coding.md 护栏摘要 /
       禁止修改 tasks.md / temp workspace 路径 / 完成报告要求
    6. 批返回后：验证结果 → 主 agent 集中更新 tasks.md
    7. 失败任务：串行重试 1 次 → 再失败暂停报告用户
  补充文档处理：
    ├─ 代码任务：项目源位置
    ├─ 补充任务：读 产出: 字段；默认 attachments/ 直接创建；
    │  指定 attachments/ 外路径 MUST 暂停确认
    └─ 计划外补充文档：暂停 → 确认 → 加任务到 tasks.md → 执行
  环境回退：无 sub-agent → 全串行；design.md 无依赖信息 → 串行执行并标注

Step 7: 完成或暂停显示状态（本次完成 / 总进度 N/M）

Step 8: 编译检查阶段 ⚠ MANDATORY
  8.1 读 config：compileCheck.enabled=false → 跳到 8.10
  8.2 检测技术栈（TypeScript / Java-Maven / Java-Ant / Java-Gradle / Go / Rust）
  8.3 获取变更范围文件（allowedEditRoots + git diff），分类 backend/frontend
  8.4 后端编译：tsc --noEmit | mvn compile -DskipTests | ant compile |
      gradle compileJava | go build ./... | cargo build
  8.5 后端 lint（如配置）：eslint / mvn checkstyle:check
  8.6 前端验证：JSP 标签闭合/EL 表达式；Vue/React 组件引用
  8.7 自动修复循环：最多 maxRetries（默认 3）
  8.8 生成编译检查报告（已修复 / 需人工处理）
  8.9 处理失败：[查看详细] [手动修复] [跳过带警告]
  8.10 统一 temp workspace 清理 ⚠ MANDATORY（失败 WARN 不阻塞）

Step 9: 最终状态 + 归档建议
```

### 初步规范

- **分层生成顺序（强制）**：Entity/DTO → Mapper/DAO → Service → Controller → Frontend
- **前端 UI 四状态**：每个数据展示组件必须处理 Loading / Empty / Error / Data
- **checkbox 集中管理**：sub-agent 禁止改 tasks.md

### 使用情况与问题

- **NOT-for**：无变更制品的直接需求 → 用 `venus_tr_impl_feature`；workspace-planning 模式 → STOP
- **核心 Guardrails**：任务模糊暂停询问禁止猜测；禁止伪造数据库字段/类型/API 端点；
  仅当任务指定行为**完全实现**才勾选 `- [x]`
- **已知降级路径**：无 sub-agent → 串行；无依赖信息 → 串行标注；技术栈无法检测 → 跳过编译检查（WARN）

**与 venus_tr_impl_feature 的分工**：

| 维度 | venus_spec_apply | venus_tr_impl_feature |
| :--- | :--- | :--- |
| 输入 | 已有四制品 | 用户直接描述需求，无制品 |
| 流程 | 9 步 + 设计确认门 + 批调度 + 编译检查 | 4 阶段轻量流程 |
| 并发 | sub-agent 批调度 | 单 agent 串行 |
| 验证 | Step 8 强制编译检查 | 编码规范自检 |

---

## 2.4 venus_spec_archive（归档变更）

### 定位与触发

- **斜杠命令**：`/venus:spec-archive`
- **description**：归档变更。当用户要归档已实现完成的变更、结束变更工作流时使用
- **allowed-tools**：`Read, Write, Edit, Glob, Grep, Bash(venus:*), Bash(codegraph:*)`

### 输入

| 输入项 | 必需 | 说明 |
| :--- | :--- | :--- |
| 变更名 | 否 | 省略时推断；模糊时 AskUserQuestion（仅展示活跃变更 + schema） |
| 工作流传名 | 否 | auto-workflow 上下文直传变更名，跳过选择提示 |

制品/任务未完成仅显示警告（informational only），不阻塞归档。

### 输出

| 产物 | 路径 | 说明 |
| :--- | :--- | :--- |
| 归档目录 | `openspec/changes/archive/YYYY-MM-DD-<change-name>/` | CLI `venus spec archive "<name>" --yes` 创建并移动 |
| 主规格同步 | `openspec/specs/<capability>/spec.md` | delta spec 内联 AI merge（ADDED/MODIFIED/REMOVED/RENAMED） |
| 探索记忆 | `openspec/specs/<capability>/explorations.md` | 能力级探索记忆，新建或追加章节 |
| 术语表 | `openspec/CONTEXT.md` | 术语同步或新建 |
| 需求文档 | `openspec/devdocs/YYYY-MM-DD-<change-name>-需求文档.md` | 变更含需求文档时移入 |
| 归档索引 | `openspec/changes/archive/ARCHIVE-INDEX.md` | 归档变更列表 + 模块统计表 |
| 知识图谱 | CodeGraph 索引 | `codegraph sync` 增量索引 + symbol 验证 |

### 操作手册

```
Step 1:   未提供变更名时提示选择（禁止猜测，除非工作流传名）
Step 2:   检查制品完成状态（未完成仅警告不确认）
          ⚠ workspace-planning 模式 → STOP
Step 3:   检查任务完成状态（读 tasks.md 统计；未完成仅警告）
Step 4:   评估 delta spec 同步 + 执行 AI merge
          ├─ 用 artifactPaths.specs.existingOutputPaths 检查 delta（唯一来源）
          ├─ 分类 ADDED/MODIFIED/REMOVED/RENAMED，显示合并摘要
          └─ 直接执行 AI merge（默认行为）；遵循 v1.1.20 specs-apply merge 语义
Step 4.5: Pre-Archive CONTEXT.md 同步 ⚠ MANDATORY
          存在 → 补充缺失术语；不存在 → 从 proposal（领域术语）+
          design（技术术语）自动创建；失败不阻塞
Step 4.6: Pre-Archive CodeGraph 状态检查 ⚠ MANDATORY
          ├─ Bash 运行 codegraph status（单一检测）
          ├─ ⚠ 禁止用 Glob 预检 .codegraph/（dot 前缀目录假阴性）
          └─ 失败 → 跳过所有 CodeGraph 步骤（4.6 + 6.5），WARN
Step 4.7: Pre-Archive 探索记忆同步 ⚠ MANDATORY
          ├─ 检查变更目录 exploration.md（缺失跳过）
          ├─ 对每个 capability：openspec/specs/<capability>/explorations.md
          │   提取 Decisions/术语/边界场景/Codebase Findings 要点
          │   （不复制过程性内容），追加 "## <change-name>（归档日期）" 章节
          └─ 新旧决策矛盾 → 旧段标 "> 已过时（由 <change-name> 取代）"，不删历史
Step 5:   执行归档 —— venus spec archive "<name>" --yes
          （目标已存在报错禁止覆盖；保留 .openspec.yaml 与 attachments/）
Step 6:   移动需求文档到 devdocs（若存在 需求文档.md）
Step 7:   更新或创建 ARCHIVE-INDEX.md
          （追加行：日期/变更名/Module/摘要≤50字符 + [含DB脚本/使用说明] 类型标注；
           更新模块统计表与时间戳）
Step 6.5: Post-Archive CodeGraph 同步 + 验证（仅当 4.6 确认启用）
          ├─ codegraph sync 增量索引新实现代码
          └─ MCP codegraph_search 验证关键 symbols 已入索引
Step 8:   显示摘要
```

**交互点**：仅 Step 1 可能询问用户；4.5/4.6/4.7/5/6/7/6.5 全部自动执行。

### 初步规范

- **3 个 MANDATORY CHECKPOINT**：4.5 CONTEXT.md 同步、4.6 CodeGraph 状态检查、4.7 探索记忆同步
- **归档目录命名**：`YYYY-MM-DD-<change-name>`；目标已存在禁止覆盖
- **CONTEXT.md 条目格式**：`**<Term>**: <definition>` + `_Avoid_: <synonyms>`

### 使用情况与问题

- **NOT-for**：workspace-scoped 变更归档（STOP）
- **设计原则**：所有 checkpoint 失败均 non-blocking——归档总能完成（WARN + 继续）
- **降级路径**：CodeGraph 未初始化/CLI 不可用 → 跳过；探索记忆同步失败 → WARN

---

# 第三部分：质量门与验证（4 个）

## 3.1 venus_spec_verify_proposal（提案验证门）

### 定位与触发

- **斜杠命令**：`/venus:spec-verify-proposal`
- **description**：在变更提案生成后、实现开始前，对制品做量化评分（D1-D5 核心维度 + D6-D9 条件维度，
  统一 90% 阈值），检测技术栈并按需执行技术特定检查
- **allowed-tools**：`Read, Glob, Grep, Bash(venus:*)`
- **调用方**：由 propose / workflow / auto_workflow / debug 在验证阶段通过 Skill 工具自动调用，也可手动调用
- **前置条件**：必须有 `exploration.md`，否则报告 "No exploration file found, cannot verify" 并退出

### 输入

| 文件 | 用途 |
| :--- | :--- |
| `openspec/changes/<name>/exploration.md` | 探索结果（Decisions/Questions/Pending 的评分基准） |
| `proposal.md` / `design.md` / `specs/*.md` / `tasks.md` | 被验证制品 |
| `openspec/config.yaml` | 技术栈检测（context 字段关键字） |

### 输出

验证报告：摘要计分卡表格（D1-D9 各维度 Coverage/Status/Issues）+ Core Score + Overall Score +
维度详情 + Legacy Warnings。**不修改文件**（FAIL 时的自动修复由调用方执行）。

### 操作手册

```
1. Prerequisites：检查必需文件（无 exploration.md 则退出）
2. Tech Stack Detection：解析 config.yaml context
   交互点：检测到技术栈时询问是否运行技术特定检查 [Yes] [No]
3. Change Type Auto-Detection：扫描 design/specs 检测变更类型，决定 D6-D9 触发
4. 9 维度评分（见下方维度表）
5. 输出报告：
   ├─ ≥90% PASS → 自动触发内联只读深度复查（无提示，用户可中断）
   └─ <90% FAIL → 调用方自动修复重跑；仍 FAIL 呈现
      [手动编辑] / [返回探索] / [查看差异]（无 skip-to-apply 路径）
```

### 评分维度（核心）

**D1-D5 核心维度（必评，统一 90% 阈值）**：

| 维度 | 检查内容 | 公式 |
| :--- | :--- | :--- |
| D1 需求覆盖 | exploration Decisions → 对应 spec 需求 | matched decisions / total |
| D2 技术一致性 | exploration 技术选择 → design.md 反映 | matched tech choices / total |
| D3 任务完整性 | 每 spec 需求 → 至少一个任务 | requirements with tasks / total |
| D4 边界覆盖 | exploration Questions → specs 场景覆盖 | addressed questions / total |
| D5 Pending 解决 | Pending 项提案前解决（空=100%） | resolved items / total |

**D6-D9 条件维度（按变更类型自动触发）**：

| 维度 | 触发关键字 | 检查矩阵 | 阈值 |
| :--- | :--- | :--- | :--- |
| D6 交互细节 | page/component/UI/表单/页面 | 4 个标准矩阵（字段-组件映射/API契约/表-字段映射/UI状态） | ≥70% |
| D7 API 契约 | endpoint/route/API/request/response | 每端点含 Method/URL/Request/Response/≥2 错误码 | ≥80% |
| D8 数据库映射 | table/column/DDL/表/字段/SQL | 每表字段含 name/type/constraints/default/业务含义 | ≥80% |
| D9 业务步骤 | 流程/状态机/事务/workflow | 复杂操作含编号步骤+层标+错误路径+事务边界 | ≥80% |

**评分计算**：Overall = (D1..D5 + 已触发 D6-D9 之和) / (5 + 触发数)；未触发维度标"不适用"并跳过。

**技术特定检查**：TypeScript（ESM import / path.join）/ Java-JSP（DataStore 列名小写 / 分页标签结构 /
IE 兼容无 ES6+）/ Python（import 顺序 / 类型注解 / f-string）/ Go / Rust。

### 使用情况与问题

- **WARNING vs FAIL**：旧变更缺交互细节段 → WARNING（不阻塞）；新变更有矩阵但不完整 → FAIL
- **降级**：skill 不可用时调用方降级 AI 内联评分 + WARN，绝不静默跳过

---

## 3.2 venus_spec_verify（实现验证）

### 定位与触发

- **斜杠命令**：`/venus:spec-verify`
- **description**：验证变更。当用户要在实现完成后、归档前验证实现与变更制品（specs/tasks/design）是否一致时使用
- **allowed-tools**：`Bash(venus:*), Read, Glob, Grep`
- **报告语义**：report-only——不修改任何文件、不执行归档

### 输入

变更名（可选；省略时推断；模糊时 `venus spec status --json` + AskUserQuestion，禁止猜测）。

### 输出

验证报告：三维度摘要计分卡 + 按优先级分组的问题列表（每条含 `file.ts:123` 引用 + 具体可操作建议）。

### 操作手册

```
Step 1: 选择变更（展示含 tasks 制品的变更，未完成标 "In Progress"）
Step 2: 查询状态理解 schema
Step 3: 读制品文件
Step 4: 初始化报告结构
Step 5: 验证 Completeness（完整性）
        ├─ 任务完成：tasks.md 复选框统计（未完成 → CRITICAL）
        └─ Spec 覆盖：### Requirement: 需求逐项检索实现证据（未实现 → CRITICAL）
Step 6: 验证 Correctness（正确性）
        ├─ 需求实现映射：偏离 → WARNING
        └─ 场景覆盖：#### Scenario: 逐个检查（未覆盖 → WARNING）
Step 7: 验证 Coherence（一致性）
        ├─ 设计遵循：Decision:/Approach: 验证（矛盾 → WARNING）
        ├─ 代码模式一致性（偏离 → SUGGESTION）
        ├─ 数据结构：未定义字段/参数 → CRITICAL
        ├─ 架构分层：跨层调用违规 → WARNING
        ├─ 交互契约：API 响应/UI 字段名不匹配 → WARNING；步骤缺失 → CRITICAL
        └─ 前端 UI 四状态（缺失 → SUGGESTION）
Step 8: 生成报告 + 最终评估
        ├─ 有 CRITICAL："发现 X 个 critical 问题，修复后再归档。"
        ├─ 仅 WARNING："可归档（建议修复 noted 项）。"
        └─ 全过："所有检查通过。可归档。"
```

### 初步规范

- **问题分级**：CRITICAL（归档前必须修复）/ WARNING（应修复）/ SUGGESTION（可改进）
- **假阳性处理**：不确定时优先 SUGGESTION > WARNING > CRITICAL
- **优雅降级**：仅 tasks.md → 只验任务完成；tasks+specs → 验完整性+正确性；全制品 → 三维全验；
  始终说明跳过了哪些检查及原因

### 使用情况与问题

- 只读验证步骤无需确认即可执行；禁止"考虑审查"等模糊建议

---

## 3.3 venus_tr_impl_review_proposal（提案深度复查）

### 定位与触发

- **斜杠命令**：`/venus:tr-impl-review-proposal`
- **description**：检查变更提案完整性与实现合规性——深度代码库探索、8 维度完整性检查、
  合规性验证、量化评分与遗漏场景补充
- **allowed-tools**：`Read, Write, Edit, Glob, Grep, Bash(venus:*)`
- **调用方**：在 spec_propose / workflow / auto_workflow / debug 验证通过后自动调用，也可手动调用
- **强制前置**：读 `openspec/rules/ai-coding.md`

### 输入

变更名（通过 `venus spec status --change "<name>" --json` 加载）；前置条件：提案已通过验证门。

### 输出

10 节检查报告（深度探索发现 / 多维度完整性检查 / 实现合规性验证 / 量化评分 / 页面设计检查 /
逻辑实现细节检查 / 建议补充的 Scenario / 遗漏 Scenario / 修正建议汇总）+ 直接更新
`specs/*.md`、`design.md`、`tasks.md` 补充遗漏场景。

### 操作手册（九阶段）

```
Phase 1 加载变更提案（proposal/design/specs/tasks）
Phase 2 深度代码库探索
        2.1 调用链分析（Grep + Read）—— 必须实际阅读代码，不依赖提案描述
        2.2 数据流分析
        2.3 现有实现模式分析
Phase 3 8 维度完整性检查（见下表）
Phase 4 实现合规性验证（技术栈/架构分层/命名规范/数据库操作）
Phase 5 特殊功能场景检查（导出/导入/外部回调/并发安全/搜索条件，如涉及）
Phase 6 页面设计细节检查（7 子项，如涉及前端）
Phase 7 逻辑实现细节检查（业务完整性/数据一致性/编辑场景/缓存/定时任务/批量/权限）
Phase 8 量化评分 ⚠ 评分门
        ├─ ≥90%：可直接进入实现
        ├─ 70%-90%：建议补充 P0 遗漏项
        └─ <70%：需重新完善提案
Phase 9 发现遗漏时更新文档（按 P0/P1/P2 优先级更新 specs/design/tasks）
```

### 8 维度完整性检查

| 维度 | 检查点数 | 关键内容 |
| :--- | :--- | :--- |
| 3.1 参数配置 | 6 场景 | true/false/未配置/大小写变体/非法格式/查询异常 |
| 3.2 输入输出 | 7 场景 | 空/空格/超长/特殊字符/格式错误；输出空/超量 |
| 3.3 数据库操作 | 6 项 | SQL 参数化/事务边界/并发更新/批量/迁移/索引 |
| 3.4 前端交互 | 6 项 | 权限/表单验证/分页标签/数据绑定/兼容/错误提示 |
| 3.5 错误处理 | 5 项 | 业务异常/系统异常/DAO 异常/外部调用/异常恢复 |
| 3.6 日志记录 | 5 项 | 级别/格式/Logger/敏感信息脱敏/异常日志 |
| 3.7 安全性 | 6 项 | SQL 注入/XSS/CSRF/权限/密码处理/敏感操作 |
| 3.8 兼容性 | 4 项 | 语言运行时/浏览器/数据库/配置 |

### Java/Venus4A 专项检查（检测到 `pom.xml`、`src/cn/`、JSP、`.java` 时触发）

A. 包名 `cn.com.venustech.venus4a.{module}.{layer}` 全小写；B. JDK 7 特性约束（避免
Lambda/Stream/Optional）；C. Log4j 1.2.x 日志规范；D. DataStore/DataObject ORM 规范
（小写列名、`executePage` 分页、序列 NEXTVAL）；E. 三类异常体系（Validate/System/
DataNotFoundException）；F. JSP 前端 IE 兼容（禁 ES6+）；G. Oracle 11g 方言（NVL/SYSDATE/ROWNUM）。

### 使用情况与问题

- **NOT-for**：实现代码（用 impl_feature）；实现后验证（用 spec_verify）
- **常见高频遗漏速查表**：编辑场景未删除旧数据（高频）/ 分页标签结构不完整（高频）/
  隐藏字段缺失（高频）/ 列名大小写（中频）/ 权限检查缺请求参数（中频）等
- **注意**：本技能评分用 90%/70% 双轨（与 verify_proposal 的统一 90% 不同），见第十二部分已知问题

---

## 3.4 venus_spec_bulk_archive（批量归档）

### 定位与触发

- **斜杠命令**：`/venus:spec-bulk-archive`
- **description**：批量归档变更。当用户要一次归档多个已完成变更时使用
- **allowed-tools**：`Read, Write, Edit, Glob, Grep, Bash(venus:*), Bash(codegraph:*), Task`

### 输入

无需参数；Step 2 提示多选（显示每变更 schema，含"All changes"选项；**禁止自动选择**）。1+ 变更可工作，2+ 为典型。

### 输出

批量归档结果（Archived/Skipped/Failed 三段）+ spec 同步摘要（N delta specs synced / M conflicts
resolved）+ 探索记忆统计（X synced / Y skipped / Z failed）+ CodeGraph 状态 + 并行执行统计（并行组数/串行链数）。

### 操作手册

```
Step 1: 获取 active changes —— venus spec status --json
        CLI 不可用 → CLI-degraded 模式（Glob 扫描 + 文件存在性推断）
Step 2: 提示变更选择（AskUserQuestion 多选，禁止自动选择）
Step 2.5: Pre-Batch CodeGraph 状态检查（codegraph status 单检测）
        失败 → 跳过所有 CodeGraph 步骤（含 Step 11）
Step 3: Batch validation（并行验证分发：2+ 变更派只读验证子代理，最多 3 并发）
        a. 制品状态  b. 任务完成  c. delta specs 需求名提取
Step 4: 检测 spec 冲突 —— capability → [changes] 映射；2+ 变更命中同一 capability 即冲突
Step 5: 解决冲突（agentically）
        a. 读 delta specs 理解 add/modify
        b. 搜索代码库查找实现证据
        c. 决议：仅一个实现→同步那个；都实现→时间顺序（旧先新覆盖）；
           都未实现→跳过 spec sync 警告用户
        d. 记录决议（哪个变更的 specs 应用/顺序/理由）
Step 6: 显示汇总状态表（含冲突决议 + 不完整变更警告）
Step 7: 直接进入批量执行（Step 2 多选即用户的明确范围决定，不再提示批量确认）
Step 8: 执行归档（three-phase layered parallelism）
        ├─ 分组：无共享 capability → 并行组（每组最多 3 子代理）；
        │  共享 capability → 串行链按决议顺序
        └─ 每变更执行：a. Sync specs（内联 AI 合并，按决议顺序）
            a.5. CONTEXT.md 同步（MANDATORY CHECKPOINT）
            b. venus spec archive "<name>" --yes
            b.5. 探索记忆同步 + 需求文档迁移到 devdocs
            c. 跟踪结果（Success/Failed/Skipped）
        失败隔离：单变更失败记录 WARN 继续剩余，永不放弃整批
Step 9: 显示汇总（含并行执行统计）
Step 10: Batch Index Update（主代理单点，绝不子代理）
        ARCHIVE-INDEX.md 追加成功变更（跳过 Failed/Skipped）
Step 11: Batch CodeGraph Sync + Verification（条件：2.5 确认启用且 ≥1 变更成功）
        单次项目级 sync + 单次验证查询（非每变更）
```

### 初步规范

- **子代理约束**：子代理禁止更新 ARCHIVE-INDEX.md、禁止运行 codegraph sync（两者主代理单点）
- **workspace-scoped**：任一选中变更为 workspace-planning → 同步前停止
- **幂等性**：目标目录已存在 → 该变更标 Failed 继续，不覆盖

### 使用情况与问题

- **NOT-for**：单变更归档（用 venus_spec_archive）；workspace 变更批量归档不支持
- **CLI 降级提醒**：流程末尾提醒一次建议安装 venus CLI

---

# 第四部分：一站式工作流（3 个）

## 4.1 venus_tr_impl_workflow（引导式工作流）

### 定位与触发

- **斜杠命令**：`/venus:tr-impl-workflow`
- **description**：一站式引导工作流：结构化探索（grill 追问 L1-L5 逐级确认）→ 提案内联生成 →
  自动验证门 → 深度复查与需求文档联动
- **allowed-tools**：`Read, Write, Edit, Glob, Grep, Bash(venus:*), Bash(git:*), Bash(codegraph:*)`
- **NOT-for**：全自动流水线（用 auto_workflow）；单阶段探索（用 venus_spec_explore）；
  调试（用 venus_tr_impl_debug）

### 输入

| 输入项 | 说明 |
| :--- | :--- |
| 话题描述 | 用户想构建的内容（Phase 1 起点） |
| 前置条件 | 项目根有 `openspec/` 目录结构（CONTEXT.md、rules/、config.yaml、specs/、changes/、explorations/） |

必须先行阅读 `openspec/rules/ai-coding.md`。

### 输出

| 产物 | 路径 |
| :--- | :--- |
| 探索文件 | `openspec/explorations/<keyword>-explore-<sequence>.md`（kebab-case ≤50 字符，序号 001/002） |
| 变更目录 | `openspec/changes/<change-name>/`（exploration.md + proposal.md + specs/ + design.md + tasks.md） |
| 需求文档 | `openspec/changes/<change-name>/需求文档.md`（Phase 3 PASS 后自动生成） |
| 术语表 | `openspec/CONTEXT.md`（按术语解析实时追加） |
| ADR | `openspec/docs/adr/NNNN-slug.md`（三条件：难逆转/无上下文惊讶/真实权衡） |

**终点**：需求文档生成完毕，提示 "All artifacts ready! Run `/venus:spec-apply` to implement."
（实现与归档由用户手动执行——这是与 auto_workflow 的核心区别）。

### 操作手册（三阶段）

```
┌─────────────────── Phase 1: Exploration ────────────────────┐
│ 1.1   创建探索文件（MANDATORY）                              │
│ 1.1.5 CONTEXT.md 启动检查（MANDATORY）                       │
│       存在→注入术语；不存在→TodoWrite 挂"创建 CONTEXT.md"     │
│ 1.2   初始化结构化格式（Background/Codebase Findings/         │
│       Questions/术语表/架构决策/边界场景/Decision Process/   │
│       Decisions/Scope Changes/Pending/Implementation         │
│       Deep-Dive）                                            │
│ 1.2.0.5 能力探索记忆注入（MANDATORY）                        │
│       检查 specs/<capability>/explorations.md，             │
│       存在→注入历史 Decisions/术语/边界场景                   │
│ 1.2.1 CodeGraph 基础扫描（MANDATORY，强制首动作）             │
│ 1.2.1.5 多项目 CodeGraph Agent 扫描（条件：上下文含其他项目   │
│       路径；派子代理 projectPath 指向对方项目）               │
│ 1.2.2 智能检测：新功能 vs 修改现有代码                        │
│       （modify/update/refactor→深度分析；add/new→可能跳过；   │
│        歧义默认触发深度分析）                                 │
│ 1.2.3 CodeGraph 深度分析（条件触发：codegraph_explore +       │
│       codegraph_impact）                                     │
│ 1.3   Grill-With-Docs 提问（核心交互阶段）                    │
│  1.3.1 决策树构建（父子依赖排序）                              │
│  1.3.2 Grilling 基元：Codebase-first（先查代码再问）、        │
│        一次一问、必含 "My recommendation: <answer>"           │
│  1.3.3 领域建模集成：                                        │
│        - 术语精化（强制）：每解析一术语立即写 CONTEXT.md       │
│        - 代码交叉验证：用户声明 vs 源码，矛盾立即暴露          │
│        - 场景构造：每确认决策 ≥1 个边界场景                    │
│        - ADR 创建（三条件同时满足）                            │
│  1.3.4 实现细节覆盖检查 + L1-L5 逐级确认门：                  │
│        L1 意图   "What exactly should this feature do?"     │
│        L2 方案   "What technical approach?"                  │
│        L3 异常   "How should errors be handled?"             │
│        L4 一致性 跨决策矛盾检查 + 代码库交叉验证              │
│        L5 边界   "What about <edge case>?"                   │
│        门规则：每级一问无批量；最低深度 L3；                   │
│        用户可 "skip remaining levels"（记入 Pending）         │
│ 1.4   关键词检测与分析（自动执行）                             │
│       Security（Semgrep 可选）/ Architecture（callers/callees）│
│       / Business（context/explore）/ Impact 准备              │
│ 1.4.5 实现深度分析（条件触发，6 维度+置信度）                 │
│ 1.5   每次交换后更新探索文件                                  │
│ 1.6   探索完成检测 → 一致性直通                               │
│ 1.6.5 CONTEXT.md 检查点（强制）                               │
│ 1.6.6 聚合一致性门（强制不可豁免）：扫描三类硬冲突             │
│       （技术选型冲突/依赖方向冲突/约束互斥）                   │
│ 1.7   放弃处理（[Delete] [Keep]）                             │
└──────────────────────────────────────────────────────────────┘
                          │ 一致性直通（不问 "Ready to proceed?"）
                          ▼
┌─────────────────── Phase 2: Proposal ───────────────────────┐
│ 2.0 预迁移验证（MANDATORY）：文件存在 + CONTEXT.md +         │
│     Impact 触发检测（Pending 有符号→codegraph_impact）       │
│ 2.3 迁移探索文件（强制保留源文件不删除）                      │
│ 2.4 内联制品生成（遵循 artifact-generation.md 共享协议）：    │
│     venus spec new → 循环 status --json → instructions      │
│     --json → 写文件；进度 "已创建 proposal.md (1/4)"         │
│     ⚠ 制品生成禁用 Skill 工具（不得 Skill("venus:spec-      │
│     propose")）；Phase 3 验证必须用 Skill                    │
│     CLI 失败：命令未找到→CLI-degraded 模式；                 │
│     其他错误→[重试][手动修复][中止]                           │
│ 2.6 验证制品（格式检查：proposal 必需段/specs Scenario 格式/ │
│     tasks 复选框）                                            │
└──────────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────── Phase 3: Verification（自动）────────────┐
│ 3.2 Skill 调用 venus_spec_verify_proposal（D1-D5+D6）        │
│ 3.5 PASS ≥90% → 自动调用 venus_tr_impl_review_proposal      │
│     深度复查（可中断）→ 自动调用 venus_tr_docs_requirement_  │
│     doc（非交互）生成需求文档                                 │
│ 3.6 FAIL <90% → 自动修复重跑；仍 FAIL 提供                   │
│     [手动编辑][返回探索][查看 diff]（无跳过路径）             │
└──────────────────────────────────────────────────────────────┘
```

**交互点汇总**：L1-L5 逐级确认（Phase 1 核心）；硬冲突时暂停让用户选方向；
放弃时 [Delete]/[Keep]。其余（CodeGraph 扫描、分析、验证、修复）自动执行。

### 初步规范

- **MANDATORY CHECKPOINT（10 个）**：1.1 文件创建 / 1.1.5 CONTEXT.md 启动检查 /
  1.2.0.5 能力记忆注入 / 1.2.1 CodeGraph 基础扫描 / 1.6.5 CONTEXT.md 检查 /
  1.6.6 聚合一致性门 / 2.0 预迁移验证 / 2.3 迁移 / 2.4 规则文件扫描 / 2.6 验证制品
- **探索文件命名**：`<keyword>-explore-<sequence>.md`（kebab-case ≤50 字符，序号 001/002，
  冲突 3 次后加时间戳）
- **迁移保留源文件**：成功迁移后不删除源文件

### 使用情况与问题

- **依赖编排**：verify_proposal（Phase 3.2）→ review_proposal（Phase 3.5）→
  requirement_doc（Phase 3.5），均 Skill 工具调用
- **降级路径**：CodeGraph→Glob/Grep；CLI→CLI-degraded；各验证技能→AI 内联 + WARN
- **护栏**：不跳过提问；冲突不自动前进；L1-L5 等用户确认；不丢失探索文件

---

## 4.2 venus_tr_impl_auto_workflow（全自动工作流）

### 定位与触发

- **斜杠命令**：`/venus:tr-impl-auto-workflow`
- **description**：一站式全自动工作流 exploration→proposal→verification→auto-apply→auto-archive，
  L1-L5 用户确认后全自动化
- **allowed-tools**：比 workflow 多 `Bash(npm:*), Bash(pnpm:*), Bash(node:*)`（Phase 4 编译检查需要）
- **NOT-for**：交互式引导工作流（用 venus_tr_impl_workflow）

### 输入

同 workflow：话题描述 + `openspec/` 目录结构 + `compileCheck` 配置（可选）。

### 输出

同 workflow 的全部产物，**额外**：归档目录 `openspec/changes/archive/<change-name>/` +
归档同步全套（主 specs / CONTEXT.md / 探索记忆 / ARCHIVE-INDEX.md / CodeGraph）。

**终点**："## Auto-Workflow Complete ✓"——全流程闭环到归档，无需用户后续操作。

### 操作手册（五阶段）

```
Phase 1: Exploration —— workflow 的简化版
  ├─ 1.1 / 1.1.5 / 1.2 / 1.2.0.5 / 1.2.1 / 1.2.1.5 同 workflow
  ├─ 1.3 Grill 提问简化版（L1-L5 类型列表，无决策树/ADR 细节）：
  │    L1 Intent（"Do I understand correctly?"）
  │    L2 Solution（"Which approach fits?"）
  │    L3 Exception（"How should errors be handled?"）
  │    L4 Consistency（"Does this conflict with existing code?"）
  │    L5 Boundary（"What about edge cases?"）
  ├─ 1.4 分析（Security/Architecture/Impact 恒跑）
  ├─ 1.5 影响分析（自动：codegraph_impact upstream maxDepth 3）
  └─ 1.6 完成检测：一致性直通（无硬冲突直接进 Phase 2）

Phase 2: Proposal（自动，无用户确认）
  ├─ 2.0 影响分析（自动）
  ├─ 2.1 迁移探索文件（保留源文件）
  └─ 2.2 内联制品生成（CLI-degraded：不中途重试；
      CLI 调用失败（非命令未找到）→ 恢复语义：找首个 status:"ready" 恢复）

Phase 3: Verification（自动，无用户确认）
  ├─ PASS → 自动深度复查 + 自动需求文档 + 自动转入 Phase 4
  └─ FAIL → 自动修复重跑；仍 FAIL 给三选项（无跳过路径）

Phase 4: Auto-Apply（自动——apply 用 auto-mode=true 跳过设计确认门）
  ├─ 构造 apply 上下文：auto-mode=true + change-name
  ├─ 执行 venus_spec_apply 的 Step 6+ 批量调度行为
  └─ 错误处理：
      编译检查失败（3 次自动修复后仍失败）→ 暂停等用户，不进归档
      子代理失败 → 自动重试一次；再失败暂停报告
      用户中断 → 完成当前批次，剩余标未完成，暂停

Phase 5: Auto-Archive（自动——archive 用 change-name 跳过选择提示）
  ├─ 构造 archive 上下文：change-name
  ├─ 执行 venus_spec_archive 模板（全套同步自动）
  └─ 错误处理：各同步步骤失败均非阻塞 WARN 继续；归档目标已存在→失败报错
```

### 与 workflow 的关键差异

| 维度 | workflow | auto_workflow |
| :--- | :--- | :--- |
| Phase 1 grill 提问 | 完整版（决策树/领域建模/ADR/场景构造/5 级门） | 简化版 L1-L5 类型列表 |
| Phase 3 验证通过 | 结束工作流，等用户手动 apply | **自动转入 Phase 4** |
| Phase 4 Apply | 无此阶段 | **自动执行**（auto-mode=true 跳过 Step 5.5 设计门） |
| Phase 5 Archive | 无此阶段 | **自动执行**（change-name 跳过选择提示） |
| allowed-tools | 无 npm/pnpm/node | 有（编译检查需要） |
| 输出终点 | 需求文档完毕，等手动 apply/archive | 全流程闭环到归档 |

### 使用情况与问题

- **护栏**：L1-L5 需求澄清门**仍等用户确认**（自动化的前提是需求已澄清）；编译失败 3 次暂停
- **依赖编排**：verify_proposal → review_proposal → requirement_doc → spec_apply（auto-mode）→
  spec_archive

---

## 4.3 venus_tr_impl_debug（调试工作流）

### 定位与触发

- **斜杠命令**：`/venus:tr-impl-debug`
- **description**：一站式调试工作流 reproduce→investigate root cause with CodeGraph and
  capability memory→change association→fix with mandatory regression test→compile check→
  synchronize proposal→verify
- **触发词**：调试 / debug / 修复 bug / bug 报告 / 复现 / 根因
- **allowed-tools**：`Read, Write, Edit, Glob, Grep, Bash(venus:*), Bash(npm:*), Bash(pnpm:*),
  Bash(node:*), Bash(git:*), Bash(codegraph:*)`
- **NOT-for**：新功能开发（用 venus_tr_impl_feature）；工作流编排（用 venus_tr_impl_workflow）

### 输入

**命令后的参数即 bug 描述**（症状、错误消息或失败行为）；未提供则提示
"Describe the bug: symptom, error message, and reproduction steps if known"。

前置条件：项目有 `openspec/` 目录；`compileCheck` 配置可选（无则 Phase 5 跳过）。

### 输出

| 产物 | 说明 |
| :--- | :--- |
| 诊断记录 | 工作笔记 scratch 段，Phase 6 持久化到变更目录 `exploration.md` |
| 变更目录 | `openspec/changes/<fix-{module}-<topic>>/`（独立 bug）或归属已有变更 |
| 更新产物 | proposal.md（按 bug 组织的 What Changes）/ tasks.md（勾选+回归测试任务）/ design.md（仅当改了文档化决策）/ specs/（仅当改了文档化行为） |
| 需求文档 | Phase 7 通过后非交互生成 |

**最终输出**：Loop Summary（Total bugs fixed / Non-defect findings）+ Per-Bug Summaries
（每 bug 的 Phase 1-4 结果）+ Phase 5/6/7 汇总 + "Ready for archive (fixes already applied)"。

### 操作手册（七阶段 + 调试循环）

```
┌───────── Phase 1: Reproduce 复现（强制先复现才能改代码）─────┐
│ 1.1 失败测试复现（首选）：定位或写一个能演示 bug 的测试；      │
│     确认它因报告的原因失败（非无关 setup 错误）               │
│ 1.2 显式流程复现（无法自动化时）：编号步骤/输入/期望/实际；   │
│     呈现给用户确认与观察行为一致（未确认前不修复）            │
│ ⚠ 无法建立复现 → 报告尝试内容，禁止按假设修复                 │
│   （Zero-Assumption）；完全无法触发 → Phase 2 调查非缺陷      │
└──────────────────────────────────────────────────────────────┘
                          ▼
┌───────── Phase 2: Investigate Root Cause 排查定位 ──────────┐
│ 2.1 能力探索记忆注入：检查 specs/<capability>/explorations.md│
│     ⚠ 历史边界场景常是根因线索：bug 可能是当初被有意接受的   │
│     已知边界在新条件下失效                                    │
│ 2.2 CodeGraph 排查（分层，所有发现实时记入诊断记录）：         │
│     2.2.0 状态预检（强制首动作 codegraph_status）             │
│     2.2.1 文件结构扫描（codegraph_files）                     │
│     2.2.2 符号定位 + 任务级上下文                             │
│           （codegraph_search + codegraph_context --task）     │
│     2.2.3 调用链追踪 + 爆炸半径                               │
│           （callers/callees/impact：评估可疑缺陷与候选修复）   │
│     2.2.4 深度探索 + 6 维根因深度分析（条件触发：常规查询    │
│           无法定位单一高置信根因时）                           │
│           Design Rationale（被违反的设计意图）                │
│           Constraints（已失效的约束）                         │
│           Trade-offs（新条件下失败的权衡，TODO/FIXME/HACK）   │
│           Pattern Usage（模式误用）                           │
│           Historical Context（git log/blame，与能力记忆       │
│             边界场景交叉引用——有意接受的历史边界）            │
│           Implicit Assumptions（未文档化假设，根因高频藏此）   │
│ 2.3 grill 纪律：一次一问；术语精化（解析即写 CONTEXT.md）；   │
│     每次交换后实时更新诊断记录                                 │
│ 2.4 根因确认门（Zero-Assumption）：                           │
│     单一高置信根因→呈现证据获用户确认；                       │
│     多候选→停下让用户选（选择前不改代码）；                   │
│     结论非缺陷→Phase 3.5 出口                                │
└──────────────────────────────────────────────────────────────┘
                          ▼
┌───────── Phase 3: Change Association 关联变更判定 ───────────┐
│ 3.1 源自进行中变更 → 修复更新该变更                           │
│ 3.2 独立 bug → 创建新变更 venus spec new "fix-<module>-<topic>"│
│ 3.3 源自已归档变更 → 永不修改归档目录；创建新变更并在         │
│     proposal 中引用原归档变更名以追溯                         │
│ 3.5 非缺陷出口 → 输出诊断报告（症状/调查路径/预期行为证据）；  │
│     不创建变更不改代码；工作流结束                            │
└──────────────────────────────────────────────────────────────┘
                          ▼
┌───────── Phase 4: Fix 修复 + 回归测试 ──────────────────────┐
│ 4.1 修复实现：外科手术式改动（每行可追溯至根因）；            │
│     涉及 schema → 单独输出 DDL 并修复前显式确认               │
│ 4.2 强制回归测试：修复前 FAIL、修复后 PASS；                 │
│     重跑 Phase 1 复现确认通过                                 │
│ 4.3 调试循环（Debug Loop）：                                 │
│     "还有相关 bug 需要修复吗？" [有] [没有]                   │
│     有 → 新 bug 重入 Phase 1-4（P3 简化：默认同一变更）；     │
│           非缺陷不阻塞其他 bug；循环中退出保留已完成修复；     │
│           ≥5 个 bug 建议拆分独立 change（不强制）             │
│     没有 → 进入汇总 P5-P7                                    │
└──────────────────────────────────────────────────────────────┘
                          ▼
┌───────── Phase 5: Compile Check 编译检查（汇总所有修复）────┐
│ 遵循 venus_spec_apply Step 8：config 加载→技术栈检测→        │
│ 编译命令→自动修复循环（≤maxRetries 默认 3）→报告；           │
│ 剩余失败报告给用户，绝不静默越过                               │
└──────────────────────────────────────────────────────────────┘
                          ▼
┌───────── Phase 6: Synchronize Proposal 同步提案（汇总）─────┐
│ proposal.md 加所有 bug 根因与修复；tasks.md 勾选+回归任务；  │
│ design/specs 仅当改了文档化决策/行为时更新；                 │
│ 完整诊断记录持久化到 exploration.md（按 bug 组织）；          │
│ 制品格式验证（同步不得损坏产物）                              │
└──────────────────────────────────────────────────────────────┘
                          ▼
┌───────── Phase 7: Verification 验证（覆盖所有修复）─────────┐
│ 7.1 Skill 调用 venus_spec_verify_proposal（D1-D9 评分）      │
│ 7.2 FAIL → 自动修复循环（无跳过路径）                        │
│ 7.3 PASS → 自动深度复查（review_proposal）+ 自动需求文档     │
│     （requirement_doc 非交互）                                │
└──────────────────────────────────────────────────────────────┘
```

### 初步规范

- **强制检查点**：Phase 1 复现（先复现再修复）/ 2.1 能力记忆注入 / 2.2.0 CodeGraph 预检 /
  2.4 根因确认门（多候选必停）/ Phase 3 归档只读（**永不修改 openspec/changes/archive/**）/
  4.2 强制回归测试 / Phase 6 同步强制 / Phase 7 验证永不静默跳过
- **命名**：独立 bug 新变更 `fix-{module}-<topic>`

### 使用情况与问题

- **能力记忆（capability memory）机制**：存储于 `openspec/specs/<capability>/explorations.md`，
  归档时写入、探索/调试时读出注入。debug 的特殊用法——历史边界场景是**根因线索**：
  判断当前 bug 是否为当初有意接受的边界在新条件下失效；也可证明行为预期（支持非缺陷出口）
- **降级路径**：CodeGraph→Glob/Grep（仍按相同结构记录保可追溯性）；验证/复查/需求文档
  技能→AI 内联 + WARN；编译失败→maxRetries 后报告用户
- **长循环**：≥5 bug 建议拆分但不强制终止

---

# 第五部分：迁移套件（3 个）

## 5.1 venus_tr_docs_feature_doc（功能地图生成）

### 定位与触发

- **斜杠命令**：`/venus:tr-docs-feature-doc`
- **description**：扫描源项目功能模块，生成功能需求实现文档（功能地图），覆盖前端实现、
  后端方法、字段级 API 契约、数据库调用链、跨模块交互
- **allowed-tools**：`Read, Write, Edit, Glob, Grep, Bash(codegraph:*)`
- **NOT-for**：将变更提案转为评审需求文档（用 venus_tr_docs_requirement_doc）

### 输入

| 参数 | 必填 | 默认/说明 |
| :--- | :--- | :--- |
| 源项目根目录路径 | 是 | 无效路径报错重输，绝不猜测修正 |
| 功能入口 | 是 | 文件路径 / URL 路由 / 模块名 / 全项目 |
| 输出模式 | 否 | 新人上手模式（默认） |
| 框架档案 | 否 | 未知框架自动探测（结论标 [待确认]） |
| 输出目录 | 否 | 按执行上下文路由 |

两种执行模式：**Standalone**（交互式收集，每项可跳过）/ **Non-interactive**（auto-migration
调用方注入参数，无效输入 fail fast）。

### 输出

**输出路由**：auto-migration 调用 → `openspec/changes/<change-name>/attachments/source-feature-doc/`；
Standalone 默认 → `openspec/migration/`。

**文件命名**：单模块 `{功能模块名}_需求文档.md`；全项目 `{项目名}_功能地图.md` + 各模块独立文档；
多相关模块 `{模块集名称}_关联分析.md`。

**文档结构（11 章节 + 附录，不可缺失、不可概括性描述）**：

```
1. 功能概述与层次分解（含 Mermaid mindmap ★必选）
2. 数据库设计（每表独立小节，全字段列出）
3. 前端页面实现（页面总览表 + 框架通用渲染机制 + 每页独立小节）
4. API接口设计（每接口独立小节：字段级请求参数+响应+调用示例）
5. 前后端业务交互流程（4 类流程图 ★必选）
6. 后端功能实现（Controller/Service/工具类，public+private 全覆盖）
7. 数据库调用链追踪
8. 跨模块交互分析
9. 特殊功能点实现方式
10. 问题分析与建议
11. 迁移建议
附录 A-E（完整文件清单/页面全矩阵/接口全契约/工具类引用全清单/建表SQL）
```

### 操作手册（十步）

```
Step 0 确定执行模式（Standalone / Non-interactive）
Step 1 收集参数（验证路径有效性）
Step 2 收集框架档案（内置 Venus4A / Spring MVC / Struts，或自动探测）
       ⚠ 内置档案是可选示例不是默认值——无确认前绝不假设框架
Step 3 确定扫描范围（入口类型识别：文件路径→递归依赖链；
       URL路由→查路由配置定位 Action/Controller；模块名→推断包路径；全项目→三层扫描）
Step 4 深度扫描功能实现（后端四层 / 前端 / 配置 / 数据库）
Step 5 构建功能层次分解（功能模块→功能组→功能点→子功能→实现点）+ Mermaid 图
Step 6 构建跨模块交互全景图（模块级/接口级/数据流级三层）
Step 7 绘制 4 类必选流程图
       （7.1 前后端时序图 / 7.2 接口交互流程图 / 7.3 功能间交互流程图 / 7.4 后端决策流程图）
       + 自检（时序图方法名必须能在代码中找到）
Step 8 数据库调用链追踪（操作汇总表 + 数据变换追踪）
Step 9 生成文档 + 输出验证自检清单（11 项）
```

### 初步规范

**四种输出模式**：

| 模式 | 适用场景 | 侧重 |
| :--- | :--- | :--- |
| 新人上手（默认） | 新成员快速理解项目 | 功能全景图、代码追踪路径 |
| 迁移重构 | 框架升级/技术栈迁移 | 业务逻辑提取、迁移建议 |
| 设计文档 | 编写正式技术文档 | 规范化格式、完整接口说明 |
| 全景扫描 | 全面了解整个项目 | 全模块地图、交叉依赖 |

**三种扫描入口**：文件路径（递归依赖链 Controller→Service→DAO→Bean）/ URL 路由
（`.do`/`.action` 后缀查路由配置）/ 模块名称（推断包路径）。

**内置框架档案**：Venus4A（action_mappings.xml + DWR 反向 Ajax + 配置驱动 CRUD 渲染）/
Spring MVC（@RequestMapping + 拦截器 + @Transactional）/ Struts（struts.xml + ActionForm）。

**反幻觉规则（6 条，最高优先级）**：

1. 分析结论必须有代码证据（泛化描述必须定位到具体类.方法()）
2. 未确认信息必须标记 [待确认]
3. 关键代码必须完整读取（读到方法结尾）
4. 流程图必须基于实际代码路径（不得凭常见模式画图）
5. 问题分析必须具体（定位到行号和代码片段）
6. 禁止概括与模糊描述——禁词："等/主要包括/诸如/相关/一系列/各种/某些/若干"，
   全文搜索禁词逐个替换或标 [待确认]

**Detail-level mandates（A-G 七原则）**：每页面独立文档化 / 字段级契约 / 每方法独立文档化 /
迁移可执行性验证（"只读此文档能否完整重新实现该功能"）/ 框架驱动页面分组文档化 /
public+private 全覆盖 / 工具类引用全覆盖。

### 使用情况与问题

- **降级**：无 CodeGraph 索引 → Glob/Grep/Read 手动扫描，文档头部记录
  "扫描方式: Glob/Grep 手动扫描（CodeGraph 不可用）"
- **特殊场景**：前后端分离架构（分开扫描+API 契约分析）；多模块关联扫描（独立扫描→跨依赖→合并）

---

## 5.2 venus_tr_impl_migration_check（迁移一致性检查）

### 定位与触发

- **斜杠命令**：`/venus:tr-impl-migration-check`
- **description**：检查源项目迁移到目标项目后的功能一致性——识别丢失功能、不一致实现、
  框架差异问题（后端三层/前端/SQL/数据库）
- **allowed-tools**：`Read, Write, Edit, Glob, Grep, Bash(codegraph:*)`
- **NOT-for**：独立源项目扫描（用 feature_doc）；本技能做独立迁移后对比或被 auto-migration 调用

### 输入

| 模式 | 触发 | 输入方式 |
| :--- | :--- | :--- |
| 独立模式（默认） | 用户直接调用 | AskUserQuestion 交互收集 |
| 工作流调用模式 | auto-migration 调用 | 调用方注入参数（不询问） |

**三个参数**：`SOURCE_PROJECT`（源项目根目录，必填）/ `TARGET_PROJECT`（目标项目根目录，必填，
默认当前项目）/ `CHECK_SCOPE`（检查范围：模块名或功能清单，"全部"= 整个项目）。

可选**框架档案**：框架名 + 框架标准方法清单（框架自动提供的方法，源码不可见）+ 框架特有机制说明。

特殊规则：源目标路径相同是有效输入（同框架升级场景）；CHECK_SCOPE 无法定位标 `[待确认]`。

### 输出

**输出根目录**：工作流模式 → `openspec/changes/{change-name}/attachments/migration-check/`；
独立模式 → 用户指定或默认 `openspec/migration/`。

```
{OUTPUT_ROOT}/
├── 00_检查摘要.md
├── 01_后端对比/（01_Controller层 / 02_Service层 / 03_DAO层）
├── 02_前端对比/（01_页面文件 / 02_表单字段 / 03_JavaScript函数）
├── 03_SQL对比/（01_SQL语句对比）
├── 04_数据库对比/（01_表结构对比）
├── 05_问题清单/（01_严重问题P0 / 02_重要问题P1 / 03_一般问题P2）
├── 06_修复建议/（01_修复方案汇总）
└── 07_对抗检查/（C1-C6 六份文档）
```

### 操作手册（七步）

```
Step 1 确定执行模式（独立：交互收集三参数 / 工作流：注入）
Step 2 验证路径和范围（无效路径报错重输；相同路径有效）
Step 3 收集框架档案（独立模式询问；工作流模式使用注入档案）
Step 4 确定输出根目录
Step 5 六层对比 + 对抗检查（每层 Read 实际代码→深度对比→写文档）
       Layer 1 Controller 层（方法存在性/签名/路由映射/权限校验/返回类型）
       Layer 2 Service 层（方法对比 + 交叉检查：事务/日志审计/数据隔离；
              CodeGraph 验证调用链）
       Layer 3 DAO 层（表名/字段/WHERE/JOIN/ORDER BY/参数绑定）
       Layer 4 前端对比（页面清单/表单字段/JS 函数/AJAX URL）
       Layer 5 SQL 对比（SELECT 完整性/WHERE/JOIN/LIKE/别名）
       Layer 6 数据库对比（表/列/类型/可空/默认值/索引/审计列）
Step 6 问题分级 P0/P1/P2（三份清单 + 修复方案汇总 + 检查摘要）
Step 7 写回验证（强制）：每份文档写后 Read 回读，确认非空、含真实数据行、非模板
```

### 初步规范

**C1-C6 对抗检查（跨层维度）**：

| 检查 | 关联层 | 分级 | 内容 |
| :--- | :--- | :--- | :--- |
| C1 空实现/硬编码 | 全局 | P2 | `return null;` / `// TODO` / 占位注释 / 硬编码桩值 |
| C2 分支逻辑完整性 | Service | P0 | 源有 N 分支目标更少 → 报告缺失分支 |
| C3 事务边界一致性 | Service | P0 | 写操作缺事务管理 |
| C4 异常处理完整性 | 全局 | P1 | 空 catch 或源有目标无 try-catch |
| C5 精度/类型一致性 | DAO+Service | P1 | BigDecimal vs double 等精度丢失 |
| C6 SQL 条件完整性 | SQL | P0 | WHERE/JOIN 条件缺失 |

**P0/P1/P2 分级**：P0 严重（功能完全缺失/核心逻辑错误/数据风险/安全漏洞，立即修复）/
P1 重要（功能部分缺失/日志不完整/权限配置，尽快修复）/ P2 一般（规范/注释/命名，建议）。

**强制规则**：某级别无问题时文档仍必须写入并声明"未发现该级别问题"，绝不省略；
匹配按功能而非名称（重命名通过路由/表名/业务语义关联）；永不发明方法/字段/表/差异；
永不仅凭行数或文件大小得出"缺失"结论。

### 使用情况与问题

- **降级**：CodeGraph 不可用 → Glob/Grep（记录日志）；框架档案未提供 → fallback 从源码提取
  实际方法签名逐个对比；工作流模式缺失非阻塞参数 → 记录 gaps 不阻塞

---

## 5.3 venus_tr_impl_auto_migration（一站式自动迁移）

### 定位与触发

- **斜杠命令**：`/venus:tr-impl-auto-migration`
- **description**：一站式自动功能迁移——源项目蒸馏、变更提案、门控实现、完整性检查（含修复循环）
- **触发词**：自动迁移 / 功能迁移 / auto migration / migrate feature to this project
- **allowed-tools**：`Read, Write, Edit, Glob, Grep, Bash(venus:*), Bash(codegraph:*)`
- **NOT-for**：独立源项目扫描（用 feature_doc）；独立迁移后对比（用 migration_check）；
  本技能编排完整迁移管道（扫描→提案→实现→对比）

### 输入（Step 0，AskUserQuestion，缺失则询问）

| 输入 | 必填 | 说明 |
| :--- | :--- | :--- |
| SOURCE_PROJECT | 是 | 源项目根目录（无效路径显式报错，绝不猜测纠正） |
| 功能入口 | 是 | 文件路径 / URL 路由 / 模块名 / 整个项目 |
| TARGET_PROJECT | 否 | 默认当前项目 |
| 源/目标框架档案 | 否 | 未知框架 → 自动检测 + [待确认] |
| 迁移范围说明 | 否 | 用户约束（如仅后端、保留 DB schema） |

### 输出

变更目录 `openspec/changes/<change-name>/`：
`attachments/source-feature-doc/`（源需求文档）+ `exploration.md`（蒸馏核心功能清单 +
目标项目规范要点）+ 标准四制品 + `attachments/migration-check/`（检查报告）+
`attachments/sql/` + `attachments/config/`。

**最终输出**：Change / 源需求文档路径 / 检查报告路径 / Tasks N/M / 剩余问题
（P0: 0 | P1: 0 | P2: n，记录非阻塞）+ "Ready for /venus:spec-archive (after review)"。

### 操作手册（四阶段 + 两个确认门）

```
Step 0 收集迁移输入（6 项，AskUserQuestion）

Phase 1 源需求文档生成（自动）
  1. 确定变更名（add-<module>-<feature> 等规范）
  2. Skill 调用 venus_tr_docs_feature_doc（非交互模式）
  3. 需求文档作为迁移唯一真实源
  4. ★ 蒸馏确认门（需求澄清门——确认 WHAT to migrate）：
     从需求文档蒸馏核心功能清单（核心功能/业务规则/API 契约要点）；
     呈现给用户确认修剪；差异标 [待确认]；
     空清单 BLOCKS 流程（要求重新扫描或缩小入口）；
     用户修剪的条目记录并从 Phase 4 评审范围排除

Phase 2 目标探查 + 变更提案生成（自动，一致性直通无确认）
  1. 迁移探查材料到 exploration.md（保留蒸馏清单节）
  2. CodeGraph 优先扫描目标项目
  3. ★ 加载目标项目规范：读 CLAUDE.md / AGENTS.md / openspec/specs/
     蒸馏规范要点写入 exploration.md "## 目标项目规范要点"
     （无规范文件→WARN 从代码结构推断，标 [待确认]，绝不阻塞）
  4. 按 propose 协议生成四制品（CLI 失败→CLI-degraded）
  5. 每个派生项可追溯到源文档（反幻觉）

Phase 3 实现确认门（流程门——确认 HOW to implement）
  1. 呈现统一实现计划（变更名、任务组/并发批次、受影响文件、迁移范围）
  2. AskUserQuestion 单一问题："是否需要调整？"
     不调整 → 立即按 apply 协议实现（批次调度循环、每调度单元一子代理、
     concurrency 默认 3、每个子代理指令必须注入目标规范要点作为绑定约束）
     需要调整 → 呈现制品供编辑后重新进入此门

Phase 4 评审子代理迁移检查 + 修复循环
  1. 派发独立评审子代理（Agent 工具），子代理内部 Skill 调用
     venus_tr_impl_migration_check（非交互）；指令显式注入全部输入
     （核心功能清单/源需求文档/目标实现范围/双方框架档案/输出目录）
  2. B 组架构融入检查（C11-C13，子代理必须执行）：
     C11 异常体系融入：残留源项目错误处理构造 → P0
     C12 工具类复用：重新实现目标已有工具 → P1
     C13 架构一致性：不遵循目标分层/包命名/目录约定 → P2
  3. ★ 修复确认门：P0/P1 发现 → 呈现问题清单+修复建议 → 用户确认修复 →
     应用修复（更新代码 AND 同步 tasks.md）→ 重跑检查；循环直至无 P0/P1
     用户停止或达重试上限 → 问题快照 + WARN + COMPLETE-WITH-WARNING
     仅 P2 → 记录报告正常结束（P2 绝不阻塞）
```

### 初步规范

- **两个确认门的区别**：蒸馏确认（Phase 1，WHAT to migrate）/ 实现门（Phase 3，HOW to implement）
- **技能委派护栏**：Phase 1 和 Phase 4 必须调用子技能而非内联重实现；不让子技能回落到交互模式
- **评审子代理失败降级链**（绝不静默跳过评审）：串行重试一次 → 主流程直接调用
  migration_check（非交互）→ WARN + COMPLETE-WITH-WARNING
- **完成状态**：Complete（无 P0/P1）/ Complete with Warnings（用户停止/重试上限/降级链耗尽）

---

# 第六部分：文档交付（1 个）

## 6.1 venus_tr_docs_requirement_doc（变更转需求文档）

### 定位与触发

- **斜杠命令**：`/venus:tr-docs-requirement-doc`
- **description**：将变更提案（proposal/design/tasks/specs）转为八章节评审需求文档
- **触发词**：生成需求文档 / 需求单 / 转换提案为需求文档
- **allowed-tools**：`Read, Write, Edit, Glob, Grep, Bash(venus:*)`
- **NOT-for**：源项目功能扫描生成迁移需求文档（用 feature_doc）

### 输入

| 输入 | 说明 |
| :--- | :--- |
| 变更名 | 省略时推断；模糊时询问（可 `venus spec status --json` 枚举，CLI 不可用回退目录搜索） |
| 执行模式 | Standalone（默认，交互收集基本信息）/ Non-interactive（工作流调用，占位符） |

**Standalone 基本信息交互**（每项可跳过）：需求编号（REQ-YYYY-XXX）/ 需求名称 /
交付时间（YYYY-MM-DD）/ 原始需求文本。

### 输出

**八章节需求文档**（Markdown）：

| 章节 | 信息来源 |
| :--- | :--- |
| 基本信息 | 用户交互/占位符 |
| 一、原始需求 | proposal Why + 用户原文 |
| 二、需求分析（需求理解/非本期范围/需求拆解） | proposal + design（按场景分组；复杂规则按伪代码注入） |
| 三、技术框架（总体框架/关键技术决策/接口设计） | design 架构 + Decisions |
| 四、业务流程（流程图/流程说明） | design Decisions + Context |
| 五、页面设计 | tasks + specs + design（无则"本变更不涉及"） |
| 六、表结构设计 | design 数据库决策 + tasks（完整 DDL） |
| 七、影响分析 | proposal Impact（模块/客户/调度影响） |
| 八、评审记录 | 空模板（待评审） |

**输出路径路由**：活跃变更 → `openspec/changes/{change-name}/需求文档.md`；归档变更 →
`openspec/devdocs/{date}-{change-name}-需求文档.md`；目标已存在静默覆盖（幂等）。

### 操作手册（六步）

```
Step 1 定位变更提案文件（active → archive → 用户指定路径，按顺序搜索）
Step 2 选择执行模式（Standalone 交互 / Non-interactive 占位）
Step 3 读取变更制品（proposal 主源 → design → tasks → specs，缺失优雅跳过）
Step 4 内容到章节的映射（按映射规则转换）
Step 5 技术栈检测（config.yaml context + 项目文件佐证；
       不适用章节输出 "本变更不涉及"，绝不发空表）
Step 6 生成文档（八章节 + 路由输出）
```

### 初步规范

- **场景分组四类型**：管理配置（规则/CRUD/配置页面/权限）/ 业务使用（运行时调用/查询导出/API）/
  后台任务（定时/批量/异步）/ AI 智能（AI 模式/ML 接入/算法预留）
- **伪代码注入规则**：```pseudocode 块，语言无关结构（IF/THEN/ELSE/FOR EACH），中文业务语义
  对象.属性表达式；永不使用真实类名/方法名；每块 ≤15 行、每章节 ≤3 块；缺口标 [待确认]
- **DDL 提取规则**：从 design 数据库决策提取完整 CREATE TABLE/索引/序列/预置数据；
  不发明不存在的表或列
- **图表规则**：ASCII 框-箭头字符（┌ ┐ └ ┘ ──▶ ▼）；节点用业务语义命名

---

# 第七部分：直接实现（1 个）

## 7.1 venus_tr_impl_feature（直接实现功能）

### 定位与触发

- **斜杠命令**：`/venus:tr-impl-feature`
- **description**：实现功能。当用户要开发新功能、修改业务逻辑或对接接口，需要按分层架构
  编写代码时使用（无变更制品的直接路径）
- **allowed-tools**：`Read, Write, Edit, Glob, Grep, Bash(pnpm:*), Bash(npm:*), Bash(node:*)`
- **规划边界**：开始编码前必须先与用户就技术方案达成一致

### 输入

用户需求描述（自然语言）；无显式参数；不明确处打 `[待确认]` 求证。

### 输出

直接修改项目源码（无独立报告文件）；完成后输出"实现后总结"：
新增/修改文件列表 + 职责 + 验证方式（编译、运行、调用入口）+ 配套测试建议（衔接 test_generate）。

### 操作手册（四阶段）

```
阶段 1 理解需求与探查代码
  ├─ 重述需求要点；不明确处标 [待确认]
  ├─ 检索项目相似实现、统一异常处理、工具类与编码风格
  └─ ★ 方案概要确认门：跨文件修改或新功能先输出技术方案
     （涉及文件、分层、接口契约），获用户确认后才能动手

阶段 2 按分层架构实现（严格 Controller → Service → DAO（Mapper））
  ├─ Controller：接收请求、参数校验（JSR-380）、统一封装 Result<T>，不写业务逻辑
  ├─ Service：核心业务逻辑、事务控制（@Transactional）、复杂业务拆子方法
  ├─ DAO/Mapper：仅数据访问；优先条件构造器，禁止 ${} 拼接 SQL
  └─ 对象分离：ReqDTO（入参+校验注解）/ VO（响应，隐去敏感字段）/ Entity（库表映射）严格分离

阶段 3 编码规范自检（每完成一个代码块立即自检）
  命名规范 / 空catch禁止 / 魔法数字禁止 / 循环中数据库请求禁止 / LocalDateTime 优先

阶段 4 实现后总结（文件清单+职责+验证方式+测试建议）
```

### 初步规范

- **最小修改原则**：只改与需求直接相关的代码，不顺手重构无关内容
- **冲突暂停**：与现有代码库逻辑/技术栈冲突时立即暂停确认

### 使用情况与问题

- **NOT-for**：已有变更制品时应使用 `venus_spec_apply`（规格驱动路径）
- **衔接**：完成后主动提示衔接 `venus_tr_test_generate`

---

# 第八部分：开发生命周期（5 个）

## 8.1 venus_tr_init_project（初始化项目）

- **命令**：`/venus:tr-init-project`；**allowed-tools**：`Bash(ls:*), Bash(pwd:*), Read, Write, Glob, Grep`
- **输入**（缺失时一次一个聚焦问题提问）：项目类型（Web 服务/CLI/库）+ 技术栈偏好（JDK、框架、数据库）
- **输出**：目录骨架（按技术栈社区惯例，如 Maven `src/main/java` 分层）+ `package.json`（含
  build/test 脚本）+ `README.md` + 实际创建文件清单 + 下一步建议
- **流程**：明确目标（交互）→ 环境探查（`ls -la` 检查目录/标志文件/git）→ 输出初始化蓝图
  （树形清单，**等用户确认后再动手**）→ 创建骨架
- **规范**：最小可用原则（不引入未要求的功能与依赖）；**禁止覆盖既有文件**（发现同名停下询问）；
  每步可验证（创建后能直接构建运行）

## 8.2 venus_tr_test_generate（生成测试）

- **命令**：`/venus:tr-test-generate`；**allowed-tools**：`Read, Write, Edit, Glob, Grep, Bash(pnpm:*), Bash(npm:*), Bash(node:*)`
- **输入**：被测目标（方法/类/模块，必填）+ 测试范围（未指定时列方法清单请确认）
- **输出**：测试源文件（遵循项目既有测试目录约定）+ 运行结果（通过数/总数）
- **流程**：确定范围 → 设计用例（每方法至少四类：**正常路径/边界条件/异常分支/业务规则**）→
  编写（given-when-then 结构；测试方法名描述场景；一个测试只验证一个行为；外部依赖
  DB/Redis/MQ 用 mock 或测试容器）→ 运行修复（失败时先区分"测试写错"还是"代码有 bug"，
  代码 bug 衔接 impl_feature）
- **规范**：禁止无断言的"空转测试"；测试可重复（不依赖执行顺序/外部状态）；
  不修改被测代码迁就测试（除非确有 bug 且说明）；框架跟随项目既有风格（JUnit5/Vitest/pytest）
- **问题**：未显式声明覆盖率百分比目标（以四类场景完整性替代）；allowed-tools 只预授权
  pnpm/npm/node，纯 Maven 项目 `mvn test` 需额外授权

## 8.3 venus_tr_commit_change（提交变更）

- **命令**：`/venus:tr-commit-change`；**allowed-tools**：`Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git log:*), Read, Glob, Grep`
- **输入**（可选）：本次提交意图、指定文件范围
- **输出**：精确暂存（`git add <files>`）→ `git commit` → 展示提交信息、commit hash、文件数
- **流程**：检查变更（`git status` + `git diff --stat`；发现无关变更询问拆分/一并；
  临时文件/调试代码/含密钥文件提醒**禁止直接提交**）→ 核对 diff（确认无格式化风暴/无关文件）→
  生成提交信息 → 暂存提交（**首次执行前展示文件与提交信息，确认后再执行**）
- **提交信息规范**：一行式 Conventional Commits `type(scope): subject`；type 前缀：
  feat/fix/docs/style/refactor/test/chore；subject 祈使句不加句号 **50 字符内**；
  示例：`feat(auth): 添加用户登录接口`
- **规范**：禁止提交密钥/`.env`/构建产物；禁止无差别 `git add -A`；一次提交只做一件事
- **问题**：push 不在 allowed-tools 中（仅本地提交）；不支持多行 body/footer（BREAKING CHANGE 标注需扩展）

## 8.4 venus_tr_review_code（审查代码）

- **命令**：`/venus:tr-review-code`；**allowed-tools**：`Bash(git diff:*), Bash(git log:*), Bash(git status:*), Read, Glob, Grep`
- **输入**（可选）：文件路径 / 分支 / PR 范围；未指定时审查未提交变更（`git diff` / `--cached`），
  工作区干净时提示指定范围
- **输出**：审查报告——按 CRITICAL / WARNING / SUGGESTION 三级分组，每条含
  文件:行号、问题描述、触发场景、修复建议；**不直接改码**（修复需确认后衔接 impl_feature）
- **审查维度（顺序即优先级）**：
  1. 正确性（逻辑错误/边界遗漏/空指针/异常分支缺失）
  2. 安全性（SQL 注入 `${}` 拼接/未校验输入/敏感信息泄露/越权）
  3. 性能（循环内数据库/Redis 请求/重复计算/集合未指定容量）
  4. 可维护性（命名/职责单一/重复代码/魔法数字）
  5. 规范符合度（分层越界/对象混用/过期 API）
- **规范**：只报告能指出具体行号+触发场景的问题；拿不准标"待验证"；
  不报告纯风格偏好（除非项目规范明确要求）；对照项目自身规范（CLAUDE.md）而非个人偏好

## 8.5 venus_tr_release_version（发布版本）

- **命令**：`/venus:tr-release-version`；**allowed-tools**：`Bash(git log:*), Bash(git tag:*), Bash(git push:*), Bash(git status:*), Bash(pnpm:*), Bash(npm:*), Read, Write, Edit, Glob, Grep`
- **输入**（可选）：目标版本号、发布起点（上次 tag 或 CHANGELOG 最近版本）；未提供时
  根据变更内容建议版本号并说明理由，等用户确认
- **输出**：更新版本号（`package.json`/`pom.xml`）+ CHANGELOG.md 顶部追加（含日期）+
  打 tag（`git tag -a v<version>`）+ 构建发布产物 + 推送分支与 tag
- **版本号规则（SemVer）**：MAJOR（不兼容 API 变更）/ MINOR（向下兼容功能新增）/
  PATCH（向下兼容缺陷修复）
- **流程**：收集变更（`git log <last-tag>..HEAD --oneline` 按 feat/fix/docs/refactor/chore 分组）→
  确认版本号（交互）→ 更新版本与日志（无 CHANGELOG 按 Keep a Changelog 新建）→ 发布前检查
  （提醒运行完整测试；列发布动作清单**逐项确认**）→ 执行发布（tag→构建→推送，
  外向操作需用户最终确认）
- **规范**：版本号变更必须先于发布动作完成并核对；发布失败时明确说明停在哪一步、
  已产生哪些影响，不静默继续
- **问题**：纯 Maven/Gradle 项目构建命令未预授权

---

# 第九部分：工具类（2 个）

## 9.1 venus_tr_tools_pwd（查看路径）

- **命令**：`/venus:tr-tools-pwd`；**allowed-tools**：`Bash(pwd:*), Bash(echo %CD%:*), Read, Glob`
- **输入**：无需输入
- **输出**：当前工作目录绝对路径（清晰格式呈现）；可选补充路径下关键标志文件
- **规范**：只读操作，不切换目录不修改文件；始终报告命令实际返回的路径，不做推断

## 9.2 venus_tr_tools_list（列出技能）

- **命令**：`/venus:tr-tools-list`；**allowed-tools**：`Bash(venus:*), Read, Glob`
- **输入**：无需输入（可选 JSON 结构化数据）
- **输出**：已安装 venus 技能列表，按生命周期类型分组呈现；可选补充斜杠指令形式与
  `venus generate` 用法
- **规范**：只读；输出以命令实际返回为准，不凭记忆罗列
- **问题**：分组展示基于 CLI 返回，若 CLI 快照滞后会显示 7 类而非实际 9 类

---

# 第十部分：组合使用模式

## 模式 A：标准规格驱动（推荐新手）

```
/venus:spec-explore    →  思考调研（可选）
/venus:spec-propose    →  一步生成提案 + 自动验证门（≥90%）
（用户确认设计蓝图）
/venus:spec-apply      →  设计确认门 → 批调度实现 → 编译检查
/venus:spec-verify     →  实现验证（可选但推荐）
/venus:spec-archive    →  同步主 specs + 知识图谱 + 索引 + 探索记忆
```

## 模式 B：引导式工作流（含 grill 追问）

```
/venus:tr-impl-workflow
  Phase 1 探索（grill L1-L5 逐级确认 + CodeGraph + 能力记忆）
  → Phase 2 内联提案 → Phase 3 验证门 + 深度复查 + 需求文档
（终点：等用户手动 /venus:spec-apply + /venus:spec-archive）
```

## 模式 C：全自动流水线

```
/venus:tr-impl-auto-workflow
  L1-L5 用户确认 → 自动提案 → 自动验证 → 自动实现（auto-mode 跳设计门）
  → 自动编译检查 → 自动归档（全流程闭环）
```

## 模式 D：调试修复

```
/venus:tr-impl-debug "<bug 描述>"
  Phase 1 复现 → Phase 2 CodeGraph 根因排查（+能力记忆）→ Phase 3 关联变更判定
  → Phase 4 修复 + 强制回归测试 →（调试循环：还有 bug？）
  → Phase 5 编译检查 → Phase 6 同步提案 → Phase 7 验证 + 需求文档
```

## 模式 E：跨项目功能迁移

```
/venus:tr-impl-auto-migration
  Step 0 收集输入 → Phase 1 源需求文档 + 蒸馏确认门（WHAT）
  → Phase 2 目标探查 + 提案（自动）→ Phase 3 实现门（HOW）→ 批调度实现
  → Phase 4 评审子代理（migration_check + C11-C13）+ P0/P1 修复循环
```

## 模式 F：轻量直编（无规格）

```
/venus:tr-impl-feature → 方案确认 → 分层实现 → 自检 → 总结
（适合小改动；无变更制品、无验证门、无归档）
```

## 模式 G：日常开发循环

```
/venus:tr-impl-feature（或 spec 系列）→ /venus:tr-test-generate
→ /venus:tr-review-code → /venus:tr-commit-change → /venus:tr-release-version
```

---

# 第十一部分：使用情况

## 11.1 项目自身 dogfood

VenusAgentTools 项目自身使用 OpenSpec 工作流管理演进，已归档 **5 个变更**：

| 归档日期 | 变更 | 内容 |
| :--- | :--- | :--- |
| 2026-09-11 | add-config-profile | workflows 字段 + profile 机制（BREAKING：init 默认 14→7） |
| 2026-09-11 | add-tr-migration-suite | 迁移三技能，新增第 9 类 tr_docs |
| 2026-09-14 | add-spec-bulk-archive | 批量归档技能（第 23 个技能） |
| 2026-09-14 | add-spec-workflow | 第 8 类 spec + 6 个 spec 技能 + venus CLI spec 命令组 |
| 2026-09-14 | add-tr-workflow-suite | 5 个工作流编排技能 |

进行中变更 1 个：`refactor-spec-workflow-template-single-source`（模板单一来源重构）。

## 11.2 测试覆盖

`test/` 下 13 个 vitest 文件，含技能质量保障三件套：

- `skills-parity.test.ts`——`skills/` 静态快照与模板一致性（防漂移）
- `allowed-tools.test.ts`——allowed-tools 白名单与正文命令一致性
- `spec-status.test.ts` / `spec-commands.test.ts`——venus spec 子命令组与依赖图状态机

## 11.3 安装配置

- 默认安装集 7 项：tr-init-project + spec 全 6（`venus init`，BREAKING 变更）
- 全量安装：`.venus/config.yaml` 的 `workflows` 字段声明（本项目 dogfood 全量 18 项）
- 依赖注入自动补全：声明 workflow 时自动补全传递依赖（不动点迭代）

---

# 第十二部分：已知问题与限制

## 12.1 模板双写漂移（结构性问题，重构进行中）

spec 工作流模板存在 skill 指令版与 command 内容版两份 90% 相同的模板字符串，靠手工双写维护，
**已实际漂移 4 处**（见 `openspec/changes/refactor-spec-workflow-template-single-source/proposal.md`）：
explore 图表损坏 / propose 蓝图确认句缺口 / propose Step 0 编号混排 / archive 步骤 6.5 排在 7 之后。

## 12.2 v1.1.20 防护语句缺失（待回填）

相对上游 OpenSpec v1.12.0，以下防护语句在迁移时丢失，重构变更计划回填：

- apply 的 scope-creep 防护（任务需超出 spec 的工作时必须暂停暴露，不默默吸收）
- propose 的 planning boundary（制品完成后必须停止，不在同一响应启动实现）
- explore 的写入 scope-bound 确认门（首次写文件前需用户显式确认）

## 12.3 CLI 能力缺口

- 缺 `venus spec instructions apply --change <name> --json` 命令（OpenSpec 已有），apply/debug
  只能直接 Read 变更目录文件；进行中变更将补齐
- 主 spec 合并依赖模板层遵循 "v1.1.20 specs-apply merge 语义" 的 AI 内联执行，无 fingerprint
  防漂移校验（确认期间主 spec 被外部编辑可能导致 stale 决策）

## 12.4 评分阈值不一致

- `venus_spec_verify_proposal` / workflow / debug：**统一 90%**（旧 70%/90% 双轨已移除）
- `venus_tr_impl_review_proposal` Phase 8：仍用 **≥90% / 70%-90% / <70% 三档**
  （两技能经常先后执行，阈值口径不统一）

## 12.5 allowed-tools 与编译检查命令不匹配

apply / debug / auto_workflow 的 Step 8（或 Phase 5）编译检查逻辑支持 Maven（`mvn compile`）/
Ant（`ant compile`）/ Gradle（`gradle compileJava`）/ Go（`go build`）/ Rust（`cargo build`），
但 allowed-tools 均未预授权 `Bash(mvn:*)`、`Bash(ant:*)`、`Bash(gradle:*)`、`Bash(go:*)`、
`Bash(cargo:*)`——纯 Java/Go/Rust 项目执行编译检查时需用户逐条授权。
test_generate / release_version 同理（仅预授权 pnpm/npm/node）。

## 12.6 功能限制

- **workspace-planning 模式**：apply 与 archive 均不支持（workspace guard STOP）
- **retire capability**：不支持通过 marker 删除主 spec（OpenSpec 有 `retire_capabilities: true`）
- **早期同步 no-op**：delta 已在主 spec 中时无幂等跳过检测

## 12.7 文档与展示滞后

- README.md 仍描述"7 类分类体系"，实际已 9 类（spec + tr_docs 未更新）
- tools_list 分组基于 CLI 返回，快照滞后时显示 7 类
- 测试用例数描述滞后（README 记 57，AGENTS.md 记 71，持续增长中）

## 12.8 降级路径较多（设计取舍）

各技能均有降级路径（sub-agent 失败回退串行、CodeGraph 不可用跳过、skill 不可用内联评分、
CLI-degraded 模式等），保证流程总能走通，但降级发生时的质量差异仅以 WARN 日志体现，
未显式告知用户。

---

*本文档基于 `skills/` 全部 23 个 SKILL.md 静态快照与 `openspec/changes/` 演进记录编写；
技能行为以 SKILL.md 实际内容为准。对比分析见 [openspec-comparison.md](openspec-comparison.md)。*
