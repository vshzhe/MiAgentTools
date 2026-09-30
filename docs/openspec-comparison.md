# Venus spec 工作流 vs OpenSpec v1.12.0 对比分析

> 对比基准：`E:\github\OpenSpec_v1120`（@fission-ai/openspec v1.12.0）
> 对比对象：本项目 `venus_spec_explore / venus_spec_propose / venus_spec_apply / venus_spec_archive` 四个核心技能
> 文档日期：2026-09-15
> 配套文档：[skills-manual.md](skills-manual.md)（技能使用说明书）

---

## 目录

1. [总体架构差异](#1-总体架构差异)
2. [explore：增强功能点](#2-explore增强功能点)
3. [propose：增强功能点](#3-propose增强功能点)
4. [apply：增强功能点](#4-apply增强功能点)
5. [archive：增强功能点](#5-archive增强功能点)
6. [反向差距：OpenSpec 有而 Venus 缺失的机制](#6-反向差距openspec-有而-venus-缺失的机制)
7. [增强点总表](#7-增强点总表)

---

## 1. 总体架构差异

| 维度 | VenusAgentTools | OpenSpec v1.12.0 |
| :--- | :--- | :--- |
| 定位 | AI Agent 技能生成与管理 CLI（生成器） | AI 原生规格驱动开发系统（运行时） |
| 技能总数 | 23（9 个生命周期类型） | 12（core 6 + expanded 6 两个 profile） |
| 命名 | `venus_<type>_<name>` → `/venus:xxx` | `openspec-<verb>-<noun>` → `/opsx:xxx` |
| schema 驱动 | 自研 spec 子命令组，依赖图硬编码，不读外部 schema.yaml（ADR-0001 自包含） | 完全 schema-driven（schema.yaml + templates/*.md），支持自定义 schema |
| 配置 | `.venus/config.yaml`（context + rules 显式 include `rules/` 文件） | `openspec/config.yaml`（schema + context + rules 内联） |
| 语言生态 | 中文正文、中文任务标签、需求文档/术语表等中文交付物 | 英文生态 |
| 自动化 | auto-mode / auto-workflow 端到端全自动流水线 | 无等价全自动编排 |
| 并发 | apply 支持多 sub-agent 批调度 | 单 agent 串行 |

四技能对应关系：

| Venus 技能 | OpenSpec 对应 skill | OpenSpec 源模板 |
| :--- | :--- | :--- |
| venus_spec_explore | openspec-explore | `src/core/templates/workflows/explore.ts` |
| venus_spec_propose | openspec-propose | `src/core/templates/workflows/propose.ts` |
| venus_spec_apply | openspec-apply-change | `src/core/templates/workflows/apply-change.ts` |
| venus_spec_archive | openspec-archive-change | `src/core/templates/workflows/archive-change.ts` |

---

## 2. explore：增强功能点

### 2.1 CodeGraph 知识图谱优先调研（核心增强）

- **Venus**：强制 `codegraph_status` 优先——确认不可用前禁止用 Glob/Grep 调研代码库；
  可用时走 `codegraph_files` + `codegraph_search` 子毫秒级符号查询
- **OpenSpec**：仅普通文件读取（`openspec list --json` + 读源码），无知识图谱集成

### 2.2 深度设计意图分析（6 维度 + 置信度标注）

- **Venus**：修改既有代码时执行 6 维度分析表（Design Rationale / Constraints / Trade-offs /
  Pattern Usage / Historical Context / Implicit Assumptions）；每个结论标注置信度
  HIGH / MEDIUM / LOW，LOW 必须向用户确认并标 ⚠
- **OpenSpec**：无此结构化分析机制

### 2.3 AI 编码护栏前置（ai-coding.md）

- **Venus**：进入探索模式先读 `openspec/rules/ai-coding.md`，全程受 **[待确认] 零猜测** 约束
  （未定义数据库字段/API 参数/业务逻辑禁止猜测）
- **OpenSpec**：无独立编码护栏规则文件（依赖 config.yaml 的 context/rules）

### 2.4 探索记忆体系（与 propose/archive 联动）

- **Venus**：探索结果可保存到 `openspec/explorations/`；归档时进一步沉淀为能力级探索记忆
  `openspec/specs/<capability>/explorations.md`，供后续 propose 注入历史决策
- **OpenSpec**：探索无持久记忆机制——insight 要么进变更制品要么丢失

### 2.5 能力级历史上下文注入（propose 侧配合）

- **Venus**：propose 启动时检测 `specs/<capability>/explorations.md`，存在则注入历史
  Decisions/术语/边界场景到提案上下文，形成"探索→提案→归档→再探索"记忆闭环
- **OpenSpec**：无对应机制

---

## 3. propose：增强功能点

### 3.1 强制命名规范（prefix-module-feature 三段式）

- **Venus**：`{prefix}-{module}-{feature}` 强制格式；10 类 prefix 识别表
  （add/fix/improve/refactor/remove/docs/security/config/perf/sync-{customer}）+
  prefix 优先级表（security > fix > sync > add > ...）+ module 通过 Glob `openspec/specs/` 识别
- **OpenSpec**：仅要求 kebab-case（如 "add user authentication" → `add-user-auth`），无模块归属与类型体系

### 3.2 Phase 3 提案验证门（核心增强，OpenSpec 完全没有）

- **Venus**：制品生成后**强制**调用 `venus_spec_verify_proposal`——
  - D1-D5 核心维度 + D6-D9 条件维度量化评分（技术栈检测后按需启用技术特定检查）
  - 统一 90% 阈值，独立只读 review sub-agent 执行（防自评偏差）
  - FAIL → 自动修复→重跑→仍 FAIL 提供人工路径，**无 skip-to-apply 逃生门**
- **OpenSpec**：propose 生成制品后直接结束，无任何量化验证环节

### 3.3 探索文件关联（Step 0 强制门）

- **Venus**：
  - 检测 `openspec/explorations/*.md`，存在时**必须**让用户选择关联/跳过（不允许静默跳过）
  - 关联后**移动**为 `changes/<name>/exploration.md`（成功即删除源文件，失败保留；不追溯历史文件）
  - 探索内容定向传递：Decisions→proposal / Analysis→design / Questions→specs /
    Codebase Findings→tasks
  - 联动 CONTEXT.md 术语表检查（缺失自动同步/生成）
- **OpenSpec**：无探索输入通道，提案从零开始

### 3.4 并行 delta spec 生成

- **Venus**：多 capability 时派 sub-agent 每 capability 一个并行生成 delta spec；
  单 capability 自动串行回退；sub-agent 失败主工作流串行重试
- **OpenSpec**：严格按依赖顺序串行创建

### 3.5 中文任务类型标签体系

- **Venus**：每个任务强制类型标签 `[代码]` / `[DB脚本]` / `[使用说明]` / `[API文档]` /
  `[配置示例]` / `[部署说明]` / `[测试数据]`；非 `[代码]` 任务必须含 `产出:` 字段
  （默认输出 `attachments/<filename>`），apply 阶段据此路由到不同处理逻辑
- **OpenSpec**：tasks.md 无类型标签，所有任务同质处理

### 3.6 设计蓝图确认

- **Venus**：全部制品创建后显示设计蓝图摘要并等待用户确认，再建议实现
- **OpenSpec**：仅输出制品清单与 "run /openspec-apply-change" 提示

---

## 4. apply：增强功能点

### 4.1 设计确认门（Step 5.5 MANDATORY）

- **Venus**：实现前呈现 📋 设计方案确认——变更概要 / 关键设计决策 / 涉及数据结构 API /
  [待确认] 项目 / **并发执行计划表**（批号|任务|依赖来源|并发串行），等待用户显式回复"确认"
  （支持 `auto-mode=true` 跳过供自动工作流使用）
- **OpenSpec**：读制品后直接开始实现，无确认门

### 4.2 多 sub-agent 并发批调度（核心增强）

- **Venus**：
  - 按 design.md 依赖信息构建并发批处理计划
  - `apply.concurrency`（默认 3）滑动窗口派 sub-agent
  - Pre-dispatch overlap check：跨单元同文件冲突自动拆出串行
  - 失败任务串行重试 1 次，再失败暂停报告
  - tasks.md checkbox 由主 agent 集中管理（sub-agent 禁止改）
- **OpenSpec**：单 agent 逐任务串行（"Working on task 3/7"）

### 4.3 编译检查阶段（Step 8 MANDATORY，OpenSpec 完全没有）

- **Venus**：
  - 技术栈自动检测：TypeScript（tsc --noEmit / pnpm build）/ Java（Maven / Ant / Gradle）/
    Go（go build）/ Rust（cargo build）
  - 后端 lint（eslint / mvn checkstyle）、前端验证（JSP 标签闭合/EL 表达式、Vue/React 组件引用）
  - 自动修复循环：分类可修复性→应用→重跑，最多 `maxRetries`（默认 3）
  - 生成编译检查报告（已修复/需人工处理），失败时提供 [查看详细] [手动修复] [跳过带警告]
- **OpenSpec**：实现完成后无任何编译/构建验证

### 4.4 分层生成顺序与前端四状态规范

- **Venus**：强制 Entity/DTO → Mapper/DAO → Service → Controller → Frontend 分层顺序；
  每个前端数据展示组件必须处理 Loading / Empty / Error / Data 四状态
- **OpenSpec**：无分层与 UI 状态规范

### 4.5 补充文档任务路由

- **Venus**：按任务类型标签路由——代码任务写项目源位置；补充任务（DB脚本/使用说明等）
  读 `产出:` 字段写 `attachments/`（指定 attachments/ 外路径时暂停确认）；
  计划外补充文档需用户确认并追加到 tasks.md
- **OpenSpec**：无补充产物概念

### 4.6 Temp workspace 协议

- **Venus**：`.openspec-tmp/apply-<change-name>/` 隔离工作区（项目本地优先、
  自动加入 `.gitignore`、单次创建单次清理、根不可写回退系统 temp）
- **OpenSpec**：无工作区隔离机制

### 4.7 auto-mode 自动化钩子

- **Venus**：`auto-mode=true` 跳过设计确认门，配合 auto-workflow 实现端到端无人干预
- **OpenSpec**：无自动化模式参数

---

## 5. archive：增强功能点

### 5.1 四个 MANDATORY 归档前检查点

| 检查点 | Venus 行为 | OpenSpec 对应 |
| :--- | :--- | :--- |
| 4.5 CONTEXT.md 术语同步 | 存在则补充缺失术语；不存在则从 proposal（领域术语）+ design（技术术语）自动创建 | 无术语表机制 |
| 4.6 CodeGraph 状态检查 | `codegraph status` 单一检测（禁止 Glob 预检 `.codegraph/`——dot 目录假阴性） | 无 |
| 4.7 探索记忆同步 | 提取变更 exploration.md 的 Decisions/术语/边界场景，追加到 `specs/<capability>/explorations.md`；过时决策标"已过时"不删历史 | 无 |
| 4.8 需求文档生成 | 不存在则委派 tr_docs_requirement_doc 非交互生成；已存在则就地增量对齐（人工域 `## 基本信息` / `## 八、评审记录` 原样保留、一~七节按当前制品重导，此分支不调技能）；失败 WARN 非阻断 | 无 |

### 5.2 CodeGraph 知识图谱同步 + 符号验证

- **Venus**：归档后 `codegraph sync` 增量索引新实现代码，再用 `codegraph_search` 验证
  变更关键 symbols 已入索引（"✓ N symbols verified"）；config-only/doc-only 变更无匹配仅 WARN
- **OpenSpec**：无知识图谱集成

### 5.3 ARCHIVE-INDEX.md 归档索引

- **Venus**：自动维护归档索引——归档变更列表表（日期/名称/模块/摘要≤50字符）+
  模块统计表 + 时间戳 footer；摘要自动追加 `[含DB脚本/使用说明]` 类型标注
  （扫描 tasks.md 类型标签）
- **OpenSpec**：归档目录内无索引文件，变更历史需自行翻目录

### 5.4 需求文档归档生成与归集（devdocs）

- **Venus**：**归档时生成**（不存在则委派 tr_docs_requirement_doc 自动生成；已存在则就地
  增量对齐、保留人工填写的评审记录与基本信息）后**归集**到
  `openspec/devdocs/YYYY-MM-DD-<change-name>-需求文档.md`
  （与 tr_docs_requirement_doc 八章节需求文档技能联动，形成"变更→评审文档"交付链）
- **OpenSpec**：无需求文档概念

### 5.5 归档一步化与防覆盖

- **Venus**：`venus spec archive "<name>" --yes` 状态检查+目录移动一步完成；保留
  `.openspec.yaml` 与 `attachments/`；目标已存在报错禁止覆盖；警告（制品/任务未完成）
  一律 informational-only 不阻塞
- **OpenSpec**：同样保留 `.openspec.yaml`，但制品/任务未完成需用户确认后才继续

### 5.6 自动归档钩子

- **Venus**：auto-workflow 可直传变更名跳过选择提示，实现全自动归档
- **OpenSpec**：无

---

## 6. 反向差距：OpenSpec 有而 Venus 缺失的机制

> 以下为对比中发现的上游优势能力。其中 6.1–6.3 已被进行中变更
> `refactor-spec-workflow-template-single-source` 列入回填计划。

### 6.1 apply 阶段的 scope-creep 防护（OpenSpec #1530）

- **OpenSpec**：任务需要超出 spec 描述的工作，或试图 drop/narrow/defer/接受例外时，
  agent 必须 surface added scope 并暂停，绝不默默吸收；仅当指定行为**完全实现**才勾选
- **Venus 现状**：Guardrails 有"任务模糊暂停询问"，但无显式的范围蔓延暴露条款

### 6.2 propose 的 planning boundary（OpenSpec #1501）

- **OpenSpec**："Do not start implementation in the same response, even if the initial
  request asks for it"——制品完成后强制停止
- **Venus 现状**：以"显示蓝图摘要等待确认"软性实现，无硬性边界声明

### 6.3 explore 的 scope-bound 写入确认门（OpenSpec #1716）

- **OpenSpec**：首次写文件前必须命名目标文件、说明操作、问直接 yes/no、
  等待用户单独消息确认；回答澄清问题不等同于同意写入
- **Venus 现状**：仅"提议保存不自动捕获"，无显式 scope-bound 确认协议

### 6.4 `instructions apply` CLI 命令

- **OpenSpec**：`openspec instructions apply --change <name> --json` 返回 contextFiles
  （artifact ID→文件路径）、进度、任务列表、动态 instruction、context/operationGuidance
- **Venus 现状**：apply 只能直接 Read 变更目录文件（进行中变更将补齐此命令与 `skip_specs` 支持）

### 6.5 主 spec 合并的工程化保障（src/core/specs-apply.ts，1108 行）

OpenSpec 的合并是**确定性代码**而非 AI 内联执行，具备：

- **预校验**：节内重复名、跨节冲突（MODIFIED∩REMOVED 等）、RENAMED 与 FROM/TO 关系冲突
- **early-sync 幂等 no-op**：ADDED 同内容 / REMOVED 源不存在 / RENAMED 源缺失目标存在
  均视为已应用而非报错
- **scenario-drift 检测**：MODIFIED 丢弃场景时要求刷新 change spec；multiplicity-aware
  （同名场景不默默丢弃）
- **fingerprint 防漂移**：确认期间主 spec 被外部编辑可检出，防止 stale retirement 删错 requirement
- **near-miss 检测**：大小写/空白差异的 requirement 名报错提示修正
- **unaccountedContent 审计**：防 authored prose 被默默删除

**Venus 现状**：依赖模板层"遵循 v1.1.20 specs-apply merge 语义"的 AI 内联合并，无上述程序化保障。

### 6.6 retire capability 机制（OpenSpec #1484）

- **OpenSpec**：`.openspec.yaml` 声明 `retire_capabilities: true` 时，清空的 capability
  归档可删除主 spec（含 symlink 防攻击、`--no-validate` 永不 retire 等安全约束）
- **Venus**：无等价机制

### 6.7 早期同步与格式细节

OpenSpec 另有一批 Venus 未对齐的细节修复：双日期前缀防叠加（#1388）、
`## Requirements` 标题周围空行保留（#1640）、fenced code block 内 Markdown 结构忽略（#1151）、
unlabeled scenarios 识别（#1521）、任务声明验证方式（#1660）等。

### 6.8 多 schema 支持

- **OpenSpec**：spec-driven 之外支持 lite / research-first / 自定义 schema
  （`openspec schema init/fork/validate`）
- **Venus**：ADR-0001 决定自包含、依赖图硬编码，单一 spec-driven 流程（有意取舍）

---

## 7. 增强点总表

| # | 增强点 | 所属技能 | OpenSpec 是否有 |
| :--- | :--- | :--- | :--- |
| 1 | CodeGraph 知识图谱优先调研 | explore / archive | ✗ |
| 2 | 6 维度设计意图分析 + 置信度标注 | explore | ✗ |
| 3 | ai-coding.md 零猜测护栏（[待确认]） | 全部 | ✗（仅 config rules） |
| 4 | 探索记忆体系（explorations/ + 能力级记忆） | explore / propose / archive | ✗ |
| 5 | 强制命名规范（prefix-module-feature + 优先级表） | propose | 部分（仅 kebab-case） |
| 6 | Phase 3 提案验证门（D1-D9 量化评分 90% 阈值） | propose | ✗ |
| 7 | 独立 review sub-agent 评分（防自评偏差） | propose | ✗ |
| 8 | 探索文件关联 + 定向内容传递 | propose | ✗ |
| 9 | 并行 delta spec 生成 | propose | ✗ |
| 10 | 中文任务类型标签 + 产出: 字段 | propose / apply / archive | ✗ |
| 11 | 设计确认门（并发计划表 + 显式"确认"） | apply | ✗ |
| 12 | 多 sub-agent 并发批调度（concurrency=3 滑动窗口） | apply | ✗ |
| 13 | 编译检查阶段（技术栈检测 + 自动修复循环） | apply | ✗ |
| 14 | 分层生成顺序 + 前端 UI 四状态 | apply | ✗ |
| 15 | 补充文档任务路由（attachments/） | apply | ✗ |
| 16 | Temp workspace 协议 | apply | ✗ |
| 17 | auto-mode / auto-workflow 全自动流水线 | apply / archive | ✗ |
| 18 | 3 个 MANDATORY 归档前检查点 | archive | ✗（仅 spec 同步检查） |
| 19 | CodeGraph sync + 符号验证 | archive | ✗ |
| 20 | ARCHIVE-INDEX.md 归档索引 + 模块统计 | archive | ✗ |
| 21 | 需求文档归档到 devdocs/ | archive | ✗ |
| 22 | 术语表（CONTEXT.md）自动维护 | propose / archive | ✗ |
| 23 | 一站式工作流编排技能（workflow / auto / debug / migration） | tr_impl 系列 | ✗（无编排层） |
| 24 | 中文交付生态（需求文档八章节、中文标签、中文注释） | 全部 | ✗ |

**一句话总结**：Venus 的增强集中在四个方向——**质量门**（提案 90% 评分 + 编译检查）、
**并发**（sub-agent 批调度 + 并行 delta spec）、**记忆**（探索记忆 + 术语表 + 归档索引的知识沉淀闭环）、
**中文企业交付生态**（任务类型标签 + 需求文档 + 分层架构规范）；
而 OpenSpec 的优势在**合并算法的确定性工程保障**（specs-apply.ts 程序化合并 + fingerprint 防漂移）
与**防护语义的完备性**（scope-creep / planning boundary / 写入确认门）——后者正是进行中重构变更的回填目标。

---

*对比依据：两项目 `skills/*/SKILL.md` 静态快照、OpenSpec `src/core/{archive,specs-apply}.ts` 源码、
两项目 CHANGELOG.md 及 `openspec/changes/` 演进记录。*
