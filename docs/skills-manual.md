# iAgent 技能使用说明书

> 适用版本：4.0.0 ｜ 技能总数：**20** ｜ 类型：**9 类**
> 技能快照来源：`skills/` 目录（由 `pnpm build && pnpm generate:skills` 生成，**禁止手工编辑**）
> 本文是导读索引；每个技能的完整正文以对应 `skills/<name>/SKILL.md` 为准。

---

## 目录

- [第一部分：总览](#第一部分总览)
- [第二部分：spec 核心工作流（7 个）](#第二部分spec-核心工作流7-个)
- [第三部分：一站式工作流与质量门（4 个）](#第三部分一站式工作流与质量门4-个)
- [第四部分：迁移套件（3 个）](#第四部分迁移套件3-个)
- [第五部分：文档交付（1 个）](#第五部分文档交付1-个)
- [第六部分：开发生命周期（4 个）](#第六部分开发生命周期4-个)
- [第七部分：已移除技能（4.0.0）](#第七部分已移除技能400)
- [第八部分：组合使用模式](#第八部分组合使用模式)

---

## 第一部分：总览

MiAgentTools 是 AI Agent 技能生成与管理 CLI，按技能类型生成 `iagent_` 前缀的 SKILL 与斜杠指令，
安装到目标项目的 AI 工具目录（`.claude/`、`.pi/`、`.codex/`）。当前共 **20 个技能**，分为 **9 个类型**：

| 类型 | 中文名 | 技能数 | 技能清单 |
| :--- | :--- | :--- | :--- |
| `init` | 初始化 | 1 | `project-init` |
| `impl` | 实现 | 6 | `workflow` / `auto-workflow` / `debug` / `proposal-review` / `migration` / `migration-check` |
| `test` | 测试 | 1 | `test`（多 schema：Java/Node 自动适配） |
| `commit` | 提交 | 2 | `commit` / `svn-commit` |
| `review` | 审查 | 1 | `review` |
| `docs` | 文档 | 2 | `feature-doc` / `requirement-doc` |
| `spec` | 规格 | 7 | `spec-explore` / `spec-propose` / `spec-apply` / `spec-archive` / `spec-bulk-archive` / `spec-verify` / `spec-verify-proposal` |
| `release` | 版本 | 0 | 保留类型，供 `iagent generate --type release` 扩展 |
| `tools` | 工具 | 0 | 保留类型，供 `iagent generate --type tools` 扩展 |

**命名规则**：技能名 `iagent_<功能名>`（下划线分词）；斜杠指令由技能名派生——去 `iagent_` 前缀、
下划线转连字符，如 `iagent_spec_apply` → `/iagent:spec-apply`。

### 核心变更生命周期全景

```
                       ┌────────────────────────────────────────────────┐
                       │            一站式工作流（编排层）                │
                       │  workflow（引导式，到归档）                     │
                       │  auto-workflow（全自动，L1-L5 后无门到底）      │
                       │  debug（调试循环，逆向进入生命周期）            │
                       └───────────────┬────────────────────────────────┘
                                       │ 编排委派
                                       ▼
[用户想法]        [提案生成]              [验证门]          [实现]           [归档]
     │                 │                     │                │                │
     ▼                 ▼                     ▼                ▼                ▼
  explore  ────▶  propose  ────▶  verify_proposal  ──▶  apply  ──▶ verify ──▶ archive ──▶ bulk_archive
  思考/调研      一步生成制品      D1-D10 评分≥90%     设计门+批调度  实现验证    同步specs+      批量归档+
  (stance)      proposal/design   proposal-review     +编译检查     (report)    知识图谱+        冲突解决
                 specs/tasks       深度复查                                      探索记忆
                                                                                ▼
                                                                        需求文档生成（验证阶段）
```

## 全局通用规范（所有技能共同遵守）

| 规范 | 内容 |
| :--- | :--- |
| **[待确认] 零猜测** | 数据库字段、业务逻辑、API 参数未定义时，必须标记 **[待确认]** 询问用户，禁止猜测 |
| **context/rules 不入文件** | CLI 返回的 context 与 rules 是约束，禁止复制到输出制品 |
| **iagent CLI 驱动** | 变更目录必须由 `iagent spec new` 创建（生成元数据），禁止手工建目录 |
| **CodeGraph 优先** | 必须先 `codegraph_status` 确认可用性；确认不可用前禁止 Glob/Grep 调研代码库 |
| **路径跨平台** | 所有文件路径用 `path.join()` 构建（Windows 盘符 + POSIX 分隔符） |
| **CLI-degraded 降级** | 首次 `iagent spec` 命令未找到 → 切换 AI 内联模板生成，不再中途重试 CLI |
| **评分阈值** | verify_proposal / workflow / debug 统一 90%（≥90% PASS，<90% FAIL，无 skip 路径） |
| **中文正文** | 技能正文、注释使用中文，标识符保留英文 |
| **白名单只免工具级弹窗** | allowed-tools 白名单**只消除工具调用权限弹窗**，不改变任何**对话级确认门**（提示词校验门、功能流程图门、设计确认门、L1-L5 追问门）——确认门仍照常等待用户 |

### 工具调用白名单（allowed-tools）组合规则

技能与斜杠指令的 frontmatter `allowed-tools` 是**权限放行清单**，按**三层**组合：

| 层 | 内容 | 约束 |
| :--- | :--- | :--- |
| 只读检索 | `Read` / `Glob` / `Grep` | 按正文实际使用，不无差别补齐 |
| 调用类 | CodeGraph MCP、`Skill(<裸名>)`、`Agent, Task` | 见四条硬规则 |
| 技能专有 | `Bash(...)` / `Write` / `Edit` | 只增不减地维持现状，不扩大 |

四条硬规则：

1. **MCP 双写**：使用 CodeGraph 的技能同时写入裸服务器形式 `mcp__codegraph` 与 9 个具名工具条目。
2. **委派逐技能枚举**：技能间委派写 `Skill(<裸名>)` 精确条目（裸名 = 技能名去掉 `iagent_` 前缀），**禁用** `Skill(*)`。
3. **派发按实放行**：仅正文确有派发子代理的技能写 `Agent, Task`（新旧工具名双写）。
4. **指令白名单派生自配对技能**：斜杠指令的白名单与其配对技能**完全一致**，不硬编码。

**会话级载体**：`iagent init` / `iagent update` 会把本工具集所需条目**非破坏合并**写入项目
`.claude/settings.json` 的 `permissions.allow`——不删既有条目、不碰 `deny`、过滤 `Bash(*)`，
既有文件非法 JSON 时保留原文件仅告警，幂等。

---

## 第二部分：spec 核心工作流（7 个）

面向「变更制品驱动」的规格工作流，依赖 `iagent spec` 命令组与 `openspec/` 目录。

| 技能 | 斜杠指令 | 作用 | 关键输入 / 输出 |
| :--- | :--- | :--- | :--- |
| `iagent_spec_explore` | `/iagent:spec-explore` | 探索模式：思考、调研、明确需求（grill L1-L5） | 话题 → `openspec/explorations/<kw>-explore-NNN.md` |
| `iagent_spec_propose` | `/iagent:spec-propose` | 一步生成完整提案（proposal/design/specs/tasks） | 需求描述 + 探索文件 → `change.json` + `tasks.json` |
| `iagent_spec_apply` | `/iagent:spec-apply` | 按任务清单实现变更（设计确认门 + 批调度 + 编译检查） | change-name → 代码 + tasks.json 状态 |
| `iagent_spec_verify` | `/iagent:spec-verify` | 实现完成后、归档前验证实现与制品一致 | change-name → 验证报告 |
| `iagent_spec_archive` | `/iagent:spec-archive` | 归档变更：delta 合并主规格、记忆同步、需求文档对齐 | change-name → `archive/` + 主规格 |
| `iagent_spec_bulk_archive` | `/iagent:spec-bulk-archive` | 批量归档多个已完成变更 + 冲突解决 | 变更列表 → 归档批次 |
| `iagent_spec_verify_proposal` | `/iagent:spec-verify-proposal` | 提案验证门：D1-D10 量化评分（阈值 90%） | change-name → 评分报告 |

> 自定义 iagent 流程为 **JSON-only**：新变更只写 `change.json`（proposal/specs/design 三段）+ `tasks.json`；
> `tasks.md` 由 `iagent spec render tasks` 渲染，是唯一 MD 出口。

## 第三部分：一站式工作流与质量门（4 个）

| 技能 | 斜杠指令 | 作用 |
| :--- | :--- | :--- |
| `iagent_workflow` | `/iagent:workflow` | **一站式引导工作流**：内联探索（grill 追问）→ 提案内联生成 → 自动验证门（D1-D6）→ 深度复查收束 + 需求文档 → 实现桥委派 `spec_apply` → 归档桥委派 `spec_archive`。全流程有确认桥。 |
| `iagent_auto_workflow` | `/iagent:auto-workflow` | **全自动管线**：探索→提案→验证→自动实现→自动归档，仅在 L1-L5 用户确认后全自动，无中途确认门。 |
| `iagent_debug` | `/iagent:debug` | **一站式调试**：复现 → CodeGraph + 能力记忆定位根因 → 关联变更 → 修复（强制回归测试）→ 编译检查 → 同步提案 → 验证。 |
| `iagent_proposal_review` | `/iagent:proposal-review` | **提案深度复查**：深度代码库探索 + 8 维度完整性检查 + 合规性验证 + 量化评分与遗漏场景补充。 |

> `workflow` / `auto_workflow` / `debug` 三者的差别是「人在环程度与终点」：`workflow` 引导到归档、
> `auto_workflow` 全自动到归档、`debug` 从缺陷逆向进入生命周期。

## 第四部分：迁移套件（3 个）

| 技能 | 斜杠指令 | 作用 |
| :--- | :--- | :--- |
| `iagent_feature_doc` | `/iagent:feature-doc` | 扫描源项目功能模块，生成功能地图 / 迁移需求文档（框架档案由源项目结构自动探测 + 用户确认，无内置预设） |
| `iagent_migration_check` | `/iagent:migration-check` | 迁移后源/目标功能一致性检查（后端分层、前端页面、SQL、库表） |
| `iagent_migration` | `/iagent:migration` | 一站式自动迁移：源项目蒸馏 → 目标编码规范 → 提案与实现 → 独立复查 + P0/P1 修复闭环 |

## 第五部分：文档交付（1 个）

| 技能 | 斜杠指令 | 作用 |
| :--- | :--- | :--- |
| `iagent_requirement_doc` | `/iagent:requirement-doc` | 把 change.json + tasks.json 转成标准八段式需求文档（人工评审用） |

> `docs` 类型共 2 个技能：`iagent_requirement_doc` 在此，`iagent_feature_doc` 归入第四部分迁移套件。

## 第六部分：开发生命周期（4 个）

| 技能 | 斜杠指令 | 作用 |
| :--- | :--- | :--- |
| `iagent_project_init` | `/iagent:project-init` | 初始化项目：目录结构、配置文件、开发环境 |
| `iagent_test` | `/iagent:test` | 生成测试：多 schema（Java JUnit4/5+Mockito/EasyMock/AssertJ；Node Vitest/Jest/Mocha） |
| `iagent_commit` | `/iagent:commit` | Git 提交：变更检查、规范提交信息、暂存管理 |
| `iagent_svn_commit` | `/iagent:svn-commit` | SVN 交互式提交（四环节确认）+ 提案分类提交 |
| `iagent_review` | `/iagent:review` | 代码审查：正确性/安全性/性能/可维护性/规范，分级报告（只审不改） |

> 版本号管理由 CLI 承担：`iagent --version` 显示工具版本；项目自身版本号与 CHANGELOG 由提交流程维护。
> 查看已装技能用 `iagent list`（`--json` 结构化）；当前目录用 AI 直接执行 `pwd`。

## 第七部分：已移除技能（4.0.0）

4.0.0 精简技能集，以下技能及其斜杠指令已移除；旧装机 `workflows:` 配置由迁移表自动收敛：

| 已移除技能 | 原用途 | 替代 |
| :--- | :--- | :--- |
| `iagent_feature` | 直接实现功能 | `iagent_workflow` 引导生成变更制品后由 `iagent_spec_apply` 实现 |
| `iagent_full_workflow` | 引导式全流程编排 | 并入 `iagent_workflow`（旧 id `full-workflow` / `tr-impl-genfull` → `workflow`） |
| `iagent_frontend` | Venus4A JSP 前端设计与生成 | 移除（Venus4A 专用领域内容） |
| `iagent_package` | Venus4A/SVN 打包校验与升级信息归集 | 移除（含运行时 `vendor/auto-package-svn/`） |
| `iagent_version` | 发布版本（SemVer + 变更日志） | `iagent --version`（工具版本）/ 提交流程维护项目版本 |
| `iagent_pwd` | 查看当前路径 | AI 直接执行 `pwd` |
| `iagent_skills` | 列出可用技能 | `iagent list` |

## 第八部分：组合使用模式

| 场景 | 推荐路径 |
| :--- | :--- |
| 新需求，想全程有人确认 | `/iagent:workflow`（探索→归档，阶段桥确认） |
| 新需求，想全自动到底 | `/iagent:auto-workflow`（L1-L5 确认后全自动） |
| 只做规格与提案 | `/iagent:spec-explore` → `/iagent:spec-propose` → `/iagent:spec-verify-proposal` |
| 已有提案，做实现与归档 | `/iagent:spec-apply` → `/iagent:spec-verify` → `/iagent:spec-archive` |
| 修 bug | `/iagent:debug` |
| 迁移源项目功能 | `/iagent:migration`（内含 `feature-doc` + `migration-check`） |
| 仅生成需求文档 | `/iagent:requirement-doc` |
