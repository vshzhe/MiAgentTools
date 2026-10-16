# 迁移套件技能使用说明（含 auto_migration 参数详解与示例）

> 适用技能：iagent_migration / iagent_feature_doc / iagent_migration_check
> 文档日期：2026-09-15
> 依据：`skills/` 下三个 SKILL.md 静态快照原文
> 配套文档：[skills-manual.md](skills-manual.md)（全技能总说明书）

---

## 目录

1. [套件总览与选择决策](#1-套件总览与选择决策)
2. [auto_migration 使用文档](#2-auto_migration-使用文档)
    - [2.1 定位与触发](#21-定位与触发)
    - [2.2 四阶段流程](#22-四阶段流程)
    - [2.3 参数设置详解](#23-参数设置详解)
    - [2.4 调用示例](#24-调用示例)
    - [2.5 三个确认门的行为](#25-三个确认门的行为)
    - [2.6 输出产物结构](#26-输出产物结构)
    - [2.7 常见问题与限制](#27-常见问题与限制)
3. [feature_doc 使用说明](#3-feature_doc-使用说明)
4. [migration_check 使用说明](#4-migration_check-使用说明)
5. [三技能调用边界速查](#5-三技能调用边界速查)

---

# 1. 套件总览与选择决策

迁移套件由三个技能组成，覆盖"扫描源项目 → 变更提案 → 实现 → 迁移对比"完整管道：

```
┌─────────────────────────────────────────────────────────────────────┐
│                     iagent_migration（编排层）           │
│         一站式自动迁移：蒸馏确认门 → 提案 → 实现门 → 评审+修复循环    │
└──────────────┬──────────────────────────────────────┬───────────────┘
               │ Phase 1 内部调用                        │ Phase 4 评审子代理内部调用
               ▼                                        ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ iagent_feature_doc    │        │ iagent_migration_check │
│ 扫描源项目生成功能需求实现文档 │        │ 源/目标六层对比 + C1-C6 对抗   │
│ （迁移唯一真实源）            │        │ 检查 + P0/P1/P2 分级          │
└──────────────────────────────┘        └──────────────────────────────┘
```

**选择决策**：

| 你的需求 | 用哪个技能 |
| :--- | :--- |
| 把源项目的一个功能/模块完整迁移到当前项目（扫描→提案→实现→对比全自动） | `auto_migration` |
| 只想扫描某个项目，产出功能地图/需求实现文档（不迁移） | `feature_doc` |
| 代码已经迁移完（无论谁迁的），要做迁移后一致性对比 | `migration_check` |

**NOT-for 边界（SKILL.md 原文）**：auto_migration 不做独立源项目扫描（属 feature_doc）、
不做独立迁移后对比（属 migration_check）；后两者被 auto_migration 编排调用时均以
**非交互模式**运行（参数注入、不提问）。

---

# 2. auto_migration 使用文档

## 2.1 定位与触发

- **斜杠命令**：`/iagent:migration`
- **触发词**：自动迁移 / 功能迁移 / auto migration / migrate feature to this project
- **description**：一站式自动功能迁移——源项目蒸馏（feature_doc + 用户确认的核心功能清单）、
  加载目标项目编码规范、创建标准 OpenSpec 变更提案、实现门后按规范实现、独立评审子代理
  跨检查源/目标功能并生成带 P0/P1 修复循环的报告
- **allowed-tools**：`Read, Write, Edit, Glob, Grep, Bash(iagent:*), Bash(codegraph:*), mcp__codegraph, mcp__codegraph__codegraph_status, mcp__codegraph__codegraph_files, mcp__codegraph__codegraph_search, mcp__codegraph__codegraph_context, mcp__codegraph__codegraph_node, mcp__codegraph__codegraph_callers, mcp__codegraph__codegraph_callees, mcp__codegraph__codegraph_impact, mcp__codegraph__codegraph_explore, Skill(feature_doc), Skill(migration_check), Agent, Task`
- **依赖**：iagent CLI（spec 命令组）；CLI 缺失时降级为 AI 内联生成（CLI-degraded generation）

## 2.2 四阶段流程

```
Step 0  收集迁移输入（AskUserQuestion，逐项补齐缺失参数）
   │
   ▼
Phase 1  源需求文档生成（自动）
   ├─ 确定变更名（遵循项目命名规范，如 add-<module>-<feature>）
   ├─ 创建 openspec/changes/<change-name>/attachments/source-feature-doc/
   ├─ Skill 调用 feature_doc（非交互：注入源路径/功能入口/迁移重构模式/框架档案/输出目录）
   ├─ 生成的需求文档 = 迁移唯一真实源（缺口保持 [待确认]，Phase 2 前与用户解决）
   └─ ★ 蒸馏确认门：从文档蒸馏核心功能清单 → 用户确认/修剪
        （空清单 BLOCKS 流程；修剪项记录且从 Phase 4 评审范围排除）
   │
   ▼  一致性直通（无确认）
Phase 2  目标探查 + 变更提案生成（自动）
   ├─ 探查材料迁入 exploration.md（保留 "## 蒸馏核心功能清单" 节）
   ├─ CodeGraph 优先扫描目标项目（codegraph_status 首动作；不可用降级 Glob/Grep）
   ├─ ★ 加载目标项目规范：读 CLAUDE.md / AGENTS.md / openspec/specs/
   │    蒸馏为 "## 目标项目规范要点"（无规范文件→从代码结构推断+[待确认]，不阻塞）
   └─ 按 propose 协议生成四制品（proposal → specs → design → tasks；每个派生项可追溯源文档）
   │
   ▼
Phase 3  实现确认门（流程门）
   ├─ 呈现统一实现计划（变更名、任务组/并发批次、受影响文件、迁移范围）
   ├─ 单一问题："是否需要调整？"
   │    不调整 → 立即按 apply 协议实现（批次调度、每单元一子代理、
   │            concurrency 默认 3、子代理指令注入目标规范要点为绑定约束）
   │    需要调整 → 呈现制品供编辑后重新进门
   └─ 失败任务：串行重试一次 → 暂停报告（绝不静默跳过）
   │
   ▼
Phase 4  评审子代理迁移检查 + 修复循环
   ├─ 派独立评审子代理（Agent 工具），内部 Skill 调用 migration_check（非交互）
   │    + B 组架构融入检查（C11 异常体系 / C12 工具类复用 / C13 架构一致性）
   ├─ 评审范围排除用户修剪的功能（绝不报为缺失功能 P0/P1）
   └─ ★ 修复确认门：P0/P1 → 问题清单+修复建议 → 用户确认 → 修复+同步 tasks.md
        → 重跑检查；循环直至无 P0/P1
        用户停止/重试上限 → 快照 + WARN + COMPLETE-WITH-WARNING
        仅 P2 → 记录报告正常结束（P2 绝不阻塞）
```

## 2.3 参数设置详解

auto_migration 没有命令行式的参数语法——**参数通过两种方式设置**：

1. **调用时自然语言内联提供**（推荐）：在斜杠命令后直接描述，AI 解析后跳过对应询问
2. **交互式补齐**：未提供的必填项由 AskUserQuestion 逐项询问（已提供则跳过）

### 完整参数表（Step 0）

| # | 参数 | 必填 | 默认值 | 取值格式 | 校验/行为规则 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `SOURCE_PROJECT`<br>源项目根目录 | **是** | 无 | 目录绝对路径<br>（Windows 盘符 `e:\project` 或 POSIX 均可） | 路径必须存在且可读；**无效路径 → 显式报错 + 重新输入，绝不猜测修正** |
| 2 | 功能入口<br>feature entry | **是** | 无 | 四选一：<br>① 文件路径<br>② URL 路由<br>③ 模块名称<br>④ 全项目 | 识别规则见下表；决定扫描范围 |
| 3 | `TARGET_PROJECT`<br>目标项目根目录 | 否 | **当前项目** | 目录绝对路径 | 同路径校验规则 |
| 4 | 源项目框架档案<br>source framework profile | 否 | 未知框架 | 框架名（自动探测或调用方提供）<br>或完整档案（见 2.3.2）<br>或"未知" | 未知 → 结构自动探测，结论标 **[待确认：框架档案探测]** 供用户确认 |
| 5 | 目标项目框架档案<br>target framework profile | 否 | 未知 | 同上 | 目标架构信息喂给 Phase 2 提案生成 |
| 6 | 迁移范围说明<br>optional scope notes | 否 | 无 | 自然语言约束 | 如"只迁移后端"、"保留数据库表结构"、"不迁前端页面" |

### 2.3.1 功能入口的四种类型（识别规则）

| 入口类型 | 识别规则 | 处理方式 | 示例值 |
| :--- | :--- | :--- | :--- |
| **文件路径** | 含源文件扩展名（`.java` / `.jsp` / `.html` / `.xml` / `.properties`）或包/目录路径 | 读文件提取路由和依赖 → 递归扫描依赖链（Controller → Service → DAO → Bean、相关页面） | `src/com/xxx/web/AccountAction.java` |
| **URL 路由** | 以框架路由后缀结尾的 URL 字符串（`.do` / `.action` 或档案等价物） | 查路由配置定位 Action/Controller 类 → 扫描其依赖链 | `/account/list.do` |
| **模块名称** | 描述性功能名 | 推断包路径 → 扫描模块 Action/Service/DAO/Entity → 匹配相关表和页面 | `账号管理` / `登录功能` |
| **全项目** | "全部" / "整个项目" / "所有模块" / "全景" | 三层全项目流程（最重，慎用） | `全部` |

### 2.3.2 框架档案的字段（可只给框架名，其余可省）

| 档案字段 | 说明 | 示例 |
| :--- | :--- | :--- |
| 框架名 | 框架标识（自动探测或调用方提供） | `Struts2` |
| 路由配置文件 | URL → Controller 映射位置（注解式映射也算配置） | `struts.xml` |
| 前端交互方式清单 | 要扫描的交互通道 | Ajax / Form 提交 / URL 直访 / 反向推送等（按源项目实际） |
| 特有机制清单 | 驱动页面渲染或数据访问的框架特有机制 | 配置驱动的通用 CRUD 页面渲染 |
| 框架标准方法清单（可选） | 框架自动生成/分发的方法（源码中不可见） | 通用 CRUD、递归查询工具 |

> **重要**：本工具不提供内置框架预设——
> 没有用户明确选择、调用方提供或确认的探测证据之前，绝不假设任何框架。
> 选"未知框架"时自动读取 `pom.xml` / `web.xml` / `package.json` / `struts.xml` /
> 源码注解模式探测，结论标 **[待确认]**。

### 2.3.3 参数传递方式对比

```
方式 A（推荐）：调用时一次性内联提供
  /iagent:migration 把 E:\old\Portal 的账号管理模块迁移到当前项目，
  源项目是传统 Java Web 框架，只迁移后端，保留数据库表结构
  → 六个参数全部解析到位，Step 0 零询问直接进 Phase 1

方式 B：最小调用 + 交互补齐
  /iagent:migration 我想迁移一个老项目的功能
  → AI 用 AskUserQuestion 逐项询问：源项目路径 → 功能入口 → 框架档案 → ……
```

## 2.4 调用示例

以下示例路径均为示意（源项目假设为传统 Java Web 老项目，目标为当前项目）。

### 示例 1：最小调用（只给源项目路径，其余交互补齐）

```
用户：/iagent:migration D:\repos\OldPortal
```

AI 解析到 `SOURCE_PROJECT=D:\repos\OldPortal`，其余必填项缺失，发起交互：

```
AI：请提供要迁移的功能入口（文件路径 / URL 路由 / 模块名 / 全项目）？
用户：账号管理

AI：[框架档案] 源项目使用什么框架？
     [自动探测（推荐）] [手动输入框架名]
用户：未知框架-自动探测

AI：检测到 pom.xml 含 struts2-core 依赖、web.xml 配置 StrutsPrepareAndExecuteFilter
     —— [待确认：框架档案探测] 框架为 Struts2，路由配置 struts.xml，是否确认？
用户：确认

AI：是否需要限定迁移范围（如只迁移后端）？[跳过] [说明范围]
用户：跳过
```

此后全自动执行 Phase 1 → 4（仅剩三个确认门的交互，见 2.5）。

### 示例 2：模块名称入口 + 全参数一次性提供（推荐写法）

```
用户：/iagent:migration 帮我把 D:\repos\OldPortal 项目的
      "账号管理"模块迁移到当前项目。源项目是传统 Java Web 框架（XML
      路由，Ajax 交互），目标项目是 Spring Boot。只迁移后端功能，
      数据库表结构保持不变，前端页面后面我们自己写。
```

参数解析结果：

| 参数 | 值 | 来源 |
| :--- | :--- | :--- |
| SOURCE_PROJECT | `D:\repos\OldPortal` | 内联 |
| 功能入口 | `账号管理`（模块名称类型） | 内联 |
| TARGET_PROJECT | 当前项目（默认） | 内联"当前项目" |
| 源框架档案 | Struts2（含路由与交互方式细节） | 内联 |
| 目标框架档案 | Spring Boot | 内联 |
| 迁移范围说明 | 只迁移后端；DB schema 不变；前端页面不迁（后续自研） | 内联 |

Step 0 零询问，直接进 Phase 1。范围说明会体现为：提案 tasks 不含前端任务、
`attachments/sql/` 中的 DDL 仅作参考不强制变更、Phase 4 评审范围不含前端对比。

### 示例 3：URL 路由入口（从单个页面功能迁起）

```
用户：/iagent:migration 源项目在 D:\repos\OldPortal，
      迁移 /account/list.do 这个功能（含它依赖的所有后端逻辑和页面），
      源框架 Struts2。
```

参数解析：功能入口 = `/account/list.do`（URL 路由类型）。Phase 1 扫描时
feature_doc 依据框架档案查路由配置定位 `list.do` 对应的
Action 类，再递归扫描 Controller → Service → DAO → Bean 依赖链与相关页面。

### 示例 4：文件路径入口（精确到一个类）

```
用户：/iagent:migration 从 D:\repos\OldPortal 迁移
      src/com/example/portal/web/AccountAction.java 这个功能，
      连同它调用的 Service、DAO 和相关页面一起。
```

参数解析：功能入口 = `src/com/example/portal/web/AccountAction.java`（文件路径类型）。
注意：文件路径是**入口**而非边界——依赖链上的代码会被递归纳入扫描与迁移范围。

### 示例 5：全项目迁移 + 框架档案指定

```
用户：/iagent:migration 整个 D:\repos\OldPortal 项目全部
      迁移到当前项目，源项目是 Struts 框架。
```

参数解析：功能入口 = `全部`（全项目类型）。**注意**：全项目扫描是三层全项目流程，
Phase 1 需求文档生成耗时最长；建议先在模块级验证流程，再扩大到全项目。

### 示例 6：蒸馏确认门的交互（Phase 1 末尾，必经）

```
AI：## 蒸馏核心功能清单（源自 账号管理模块需求文档）
     1. 账号列表查询（分页、多条件过滤）—— AccountAction.list
     2. 账号新增（含唯一性校验）—— AccountAction.add
     3. 账号修改 / 删除（含关联数据校验）—— AccountAction.update / delete
     4. 账号导入导出（Excel 模板）—— AccountAction.import / export
     5. 账号密码重置 —— AccountAction.resetPwd
     [待确认] 需求文档 3.2 节提到"账号锁定"但源码未发现实现，是否纳入清单？
     请确认清单或修剪条目（被修剪的条目不会迁移，也不会在评审中报缺失）：
     [确认全部] [修剪条目] [重新扫描]
用户：修剪条目，第 4 项导入导出这次不要，"账号锁定"也不纳入
```

修剪结果写入 `exploration.md` 的 `## 蒸馏核心功能清单`；第 4 项与"账号锁定"
被排除出 Phase 2 派生输入和 Phase 4 评审范围。

### 示例 7：实现门的交互（Phase 3）

```
AI：## 📋 实现计划确认
     变更：add-account-module-account-mgmt
     任务组：1. 数据契约（Entity/DTO × 3）→ 2. DAO 层（× 4）
             → 3. Service 层（× 5）→ 4. Controller 层（× 3）
             → 5. DB 脚本 [DB脚本]（产出: attachments/sql/account.sql）
     并发批次：批次1（组1）→ 批次2（组2+3 并行）→ 批次3（组4）→ 批次4（组5）
     受影响文件：约 15 个新增 + 2 个修改
     迁移范围：仅后端；DB schema 不变（SQL 脚本仅参考）
     子代理将注入目标项目规范要点（Spring Boot 三层 + 统一 Result<T> 封装）
     是否需要调整？
     [不调整，开始实现] [需要调整]
用户：不调整，开始实现
```

### 示例 8：修复循环的交互（Phase 4）

```
AI：## 迁移检查报告（第 1 轮）
     P0 × 1：
       #1 [账号修改] 源项目更新前校验关联数据（AccountService.update 第 88 行
            checkRelations()），目标实现缺失该调用 —— 修改可能产生孤儿数据
     P1 × 2：
       #2 [账号删除] 源项目删除含操作日志记录，目标缺失
       #3 [C12-工具类复用] 目标实现重复编写了 DateUtil.format()，
            项目已有 hutool DateUtil 可用
     P2 × 1：（略）
     是否执行修复（修复后自动重跑检查）？
     [确认修复 P0+P1] [仅修复 P0] [停止循环]
用户：确认修复 P0+P1

（AI 应用修复 → 同步 tasks.md 新增/更新任务 → 重跑检查）
AI：## 迁移检查报告（第 2 轮）—— 无 P0/P1，仅 P2 × 1（已记录，不阻塞）
     ## Auto Migration Complete
     **Change**: add-account-module-account-mgmt
     **Tasks**: 17/17 complete
     Ready for /iagent:spec-archive (after review)
```

## 2.5 三个确认门的行为

| 确认门 | 位置 | 性质 | 问什么 | 不确认会怎样 |
| :--- | :--- | :--- | :--- | :--- |
| **蒸馏确认门** | Phase 1 末 | 需求澄清门（WHAT to migrate） | 核心功能清单确认/修剪 | **空清单 BLOCKS 流程**（要求重新扫描或缩小功能入口）；清单与文档/源码差异必须 [待确认] 由用户解决 |
| **实现门** | Phase 3 | 流程门（HOW to implement） | 实现计划是否调整（单一问题） | 需要调整 → 呈现制品编辑后重新进门；不调整 → 立即实现 |
| **修复确认门** | Phase 4 | 用户门控 | P0/P1 问题清单+修复建议是否执行 | 每轮修复都需确认；用户停止或重试上限 → COMPLETE-WITH-WARNING（非失败） |

Phase 2 → 3 之间**无确认**（一致性直通）；只读操作（文件读取、CodeGraph 查询、
分析步骤）直接执行无需确认。

## 2.6 输出产物结构

```
openspec/changes/<change-name>/          ← 变更名遵循项目命名规范（如 add-<module>-<feature>）
├── exploration.md                       ← 含 "## 蒸馏核心功能清单" + "## 目标项目规范要点"
├── proposal.md / specs/ / design.md / tasks.md   ← 标准四制品（每个派生项可追溯源文档）
└── attachments/
    ├── source-feature-doc/              ← Phase 1 源需求文档（feature_doc 产出）
    ├── migration-check/                 ← Phase 4 检查报告（六层对比 + 问题清单 + C1-C6 + 修复建议）
    │   └── 07_对抗检查/
    ├── sql/                             ← SQL 脚本（DDL/DML，类型标签 [DB脚本] + 产出: 路由）
    ├── config/                          ← 配置示例（[配置示例]）
    └── ...                              ← 其他补充文档（[使用说明] 等）
```

最终输出格式：

```
## Auto Migration Complete (or Complete with Warnings)

**Change**: <change-name>
**Source requirement doc**: openspec/changes/<change-name>/attachments/source-feature-doc/...
**Migration check report**: openspec/changes/<change-name>/attachments/migration-check/...
**Tasks**: N/M complete
**Remaining problems**: P0: 0 | P1: 0 | P2: <n> (recorded, non-blocking)

Ready for /iagent:spec-archive (after review)
```

## 2.7 常见问题与限制

| 场景 | 行为 |
| :--- | :--- |
| 源路径无效 / 不可读 | 显式报错 + 要求重新输入，**绝不猜测修正或按假定路径继续** |
| 蒸馏清单为空 | BLOCKS 流程：要求重新扫描源项目或缩小功能入口，绝不可能以空清单继续 |
| 目标项目无规范文件（无 CLAUDE.md/AGENTS.md/openspec/specs/） | WARN + 从目标代码结构推断约定（命名/分层/目录模式）作为替代，推断标 **[待确认]**，绝不阻塞 |
| iagent CLI 未安装 | 首次 `iagent spec status` 报 command-not-found → 切换 CLI-degraded 模式：声明一次结论，按模板内置依赖顺序纯 AI 生成，**流程中不再重试 CLI** |
| CodeGraph 不可用 | `codegraph_status` 确认后自动降级 Glob/Grep 并记录日志 |
| 评审子代理失败 | 降级链（绝不静默跳过评审）：串行重试一次 → 主流程直接调用 migration_check（非交互）→ WARN + COMPLETE-WITH-WARNING |
| 源项目字段/端点/规则未确认 | 标 **[待确认]** 与用户解决——绝不猜测进提案或实现（零猜测护栏） |
| 子技能被误触发交互模式 | 不会发生：auto_migration 始终显式注入非交互参数（子技能触发边界护栏） |

---

# 3. feature_doc 使用说明

## 3.1 定位与参数

- **命令**：`/iagent:feature-doc`；**allowed-tools**：`Read, Write, Edit, Glob, Grep, Bash(codegraph:*), mcp__codegraph, mcp__codegraph__codegraph_status, mcp__codegraph__codegraph_files, mcp__codegraph__codegraph_search, mcp__codegraph__codegraph_context, mcp__codegraph__codegraph_node, mcp__codegraph__codegraph_callers, mcp__codegraph__codegraph_callees, mcp__codegraph__codegraph_impact, mcp__codegraph__codegraph_explore`
- **NOT-for**：把 OpenSpec 变更提案转成评审需求文档（那是 requirement_doc）

**双执行模式**：

| 模式 | 触发 | 行为 |
| :--- | :--- | :--- |
| Standalone（默认） | 用户直接调用 | AskUserQuestion 交互收集参数；每项可跳过或有默认，绝不为缺参阻塞启动 |
| Non-interactive | auto_migration 调用 | 调用方注入参数（源路径/功能入口/输出模式/框架档案/输出目录）；不提问；无效注入 → fail fast 报错而非提示 |

**参数表**：

| 参数 | 必填 | 默认/跳过行为 |
| :--- | :--- | :--- |
| 源项目根目录路径 | 是 | 无默认——必须获得有效路径（无效报错重输，绝不猜测修正） |
| 功能入口 | 是 | 全项目（跳过时） |
| 输出模式 | 否 | 新人上手模式 |
| 框架档案 | 否 | 未知框架 → 自动探测（结论标 [待确认]） |
| 输出目录 | 否 | 按输出路由规则 |

**输出路由**：auto-migration 调用 → `openspec/changes/<change-name>/attachments/source-feature-doc/`；
Standalone → 用户指定目录或默认 `openspec/migration/`。

**文件命名**：单模块 `{功能模块名}_需求文档.md`；全项目 `{项目名}_功能地图.md` + 各模块独立文档；
多相关模块 `{模块集名称}_关联分析.md`。

## 3.2 四种输出模式

| 模式 | 适用场景 | 文档侧重 |
| :--- | :--- | :--- |
| 新人上手（默认） | 新成员快速理解项目 | 功能全景图、代码追踪路径、交互流程 |
| **迁移重构**（auto_migration 固定注入此模式） | 框架升级/技术栈迁移 | 业务逻辑提取、技术实现细节、迁移建议 |
| 设计文档 | 编写正式技术文档 | 规范化格式、完整接口说明、数据库设计 |
| 全景扫描 | 全面了解整个项目 | 全模块地图、交叉依赖、交互全景 |

## 3.3 操作流程（十步）

```
Step 0 确定执行模式 → Step 1 收集参数 → Step 2 收集框架档案（内置三选一或自动探测）
→ Step 3 确定扫描范围（入口类型识别，同 2.3.1 表）
→ Step 4 深度扫描（4.1 后端四层 / 4.2 前端（遍历档案每种交互通道）/
   4.3 配置（路由/web.xml/数据库连接）/ 4.4 数据库（表/字段/索引/枚举值））
→ Step 5 功能层次分解（功能模块→功能组→功能点→子功能→实现点 + Mermaid mindmap/graph）
→ Step 6 跨模块交互全景（模块级依赖/接口级调用/数据流级联动 三层）
→ Step 7 绘制 4 类必选流程图（时序图/接口交互/功能间交互/后端决策——缺任一类文档不合格）
→ Step 8 数据库调用链追踪 → Step 9 生成文档 + 11 项输出验证自检清单
```

## 3.4 反幻觉规则（6 条，最高优先级）

1. 分析结论必须有代码证据——泛化描述必须定位到具体 `类.方法()`
2. 未确认信息必须标记 **[待确认]**（外部依赖/复杂逻辑/配置参数/字段含义）
3. 关键代码必须完整读取（核心算法读到方法结尾；SQL 注入判定基于实际代码）
4. 流程图必须基于实际代码路径（时序图方法名必须能在代码中找到，不得凭常见模式画图）
5. 问题分析必须具体（定位到行号和代码片段）
6. 禁止概括与模糊描述——禁词："等 / 主要包括 / 诸如 / 相关 / 一系列 / 各种 / 某些 / 若干"，
   全文搜索禁词逐个替换或标 [待确认]

---

# 4. migration_check 使用说明

## 4.1 定位与参数

- **命令**：`/iagent:migration-check`；**allowed-tools**：`Read, Write, Edit, Glob, Grep, Bash(codegraph:*), mcp__codegraph, mcp__codegraph__codegraph_status, mcp__codegraph__codegraph_files, mcp__codegraph__codegraph_search, mcp__codegraph__codegraph_context, mcp__codegraph__codegraph_node, mcp__codegraph__codegraph_callers, mcp__codegraph__codegraph_callees, mcp__codegraph__codegraph_impact, mcp__codegraph__codegraph_explore`
- **NOT-for**：独立源项目扫描（用 feature_doc）；本技能做迁移后对比或被 auto_migration 编排调用

**双执行模式与参数**：

| 模式 | 参数收集 |
| :--- | :--- |
| Standalone（默认） | AskUserQuestion 收集三参数（见下）；CHECK_SCOPE 提供常见选项：「全部」+ 从源项目目录结构检测出的模块名（可多选） |
| Non-interactive | 调用方注入（源/目标路径、检查范围、框架档案、输出目录）；缺非阻塞参数记录在最终摘要 gaps 中，**绝不中途阻塞** |

| 参数 | 必填 | 说明 |
| :--- | :--- | :--- |
| `SOURCE_PROJECT` | 是 | 源项目根目录 |
| `TARGET_PROJECT` | 是 | 目标项目根目录（默认当前项目） |
| `CHECK_SCOPE` | 否 | 模块名或功能清单；「全部」= 整个项目 |

**特殊规则**：

- **源/目标路径相同是有效输入**（同框架升级/版本迭代场景）——按版本或目录差异对比，
  绝不因路径相等而拒绝
- CHECK_SCOPE 条目在任一项目无法定位 → 摘要中标 **[待确认]** 而非猜测匹配
- 框架档案（可选）：框架名（唯一必填项）+ 框架标准方法清单（粘贴文本或文件路径）+
  特有机制说明。**提供标准方法清单时**逐个方法按功能映射对比（这些方法源码中不可见）；
  **未提供时**从源码提取实际方法签名逐一对比。本技能不含任何内置方法映射预设

## 4.2 操作流程（七步）与输出

```
Step 1 确定执行模式 → Step 2 验证路径和范围 → Step 3 收集框架档案
→ Step 4 确定输出根目录（工作流 → changes/<name>/attachments/migration-check/；
   独立 → 用户指定或默认 openspec/migration/）
→ Step 5 六层对比（Controller / Service / DAO / 前端 / SQL / 数据库，
   每层 Read 实际代码→深度对比→写文档；TodoWrite 跟踪）
→ Step 6 问题分级 P0/P1/P2（三份清单 + 修复方案汇总 + 检查摘要；
   某级别无问题时文档仍必须写入"未发现该级别问题"，绝不省略）
→ Step 7 写回验证（每份文档写后 Read 回读，确认非空、含真实数据行、非模板）
```

输出目录结构：`00_检查摘要` + `01_后端对比/`（三层）+ `02_前端对比/`（三份）+
`03_SQL对比/` + `04_数据库对比/` + `05_问题清单/`（P0/P1/P2 三份）+
`06_修复建议/` + `07_对抗检查/`（C1-C6 六份）。

**C1-C6 对抗检查**：C1 空实现/硬编码（P2）/ C2 分支逻辑完整性（P0）/
C3 事务边界一致性（P0）/ C4 异常处理完整性（P1）/ C5 精度类型一致性（P1）/
C6 SQL 条件完整性（P0）。

**匹配方法论**：按功能匹配而非名称（重命名通过路由/表名/业务语义关联）；
跨层移动的逻辑必须追踪到目标层对比后才能报"缺失"；**永不仅凭行数或文件大小得出缺失结论**。

---

# 5. 三技能调用边界速查

| 你说 / 你想做 | 正确技能 | 错误技能（NOT-for） |
| :--- | :--- | :--- |
| "把老项目的账号管理迁移过来" | `/iagent:migration` | feature_doc（只扫描不实现） |
| "扫描 E:\old\Proj 生成功能地图" | `/iagent:feature-doc` | auto_migration（会进入实现流程） |
| "新员工要看懂这个项目，生成上手文档" | `/iagent:feature-doc`（新人上手模式） | requirement_doc（那是变更提案转换） |
| "代码已经迁完了，帮我对比有没有丢功能" | `/iagent:migration-check` | auto_migration（会重新走完整管道） |
| "同框架升级，对比两个版本的差异" | `/iagent:migration-check`（源=目标路径合法） | — |
| "把这个变更提案转成需求评审文档" | `/iagent:requirement-doc` | feature_doc（那是源码扫描） |

---

*本文档基于 `skills/iagent_migration/SKILL.md`、`skills/iagent_feature_doc/SKILL.md`、
`skills/iagent_migration_check/SKILL.md` 静态快照编写；技能行为以 SKILL.md 实际内容为准。*
