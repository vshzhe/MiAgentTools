# 探索：SKILL 模板 + Artifact 数据层 双层优化

## 提示词基线

### 原始提示词
> 分析项目中探索、提案生成、需求文档等指令、当前生成的是md文档，如果把部分文档调整记录到json文件或者db文件中，效果和速度会不会有优化或者提升，有没有好的方案可以在当前项目基础上减少token消耗的同时，增加探索结果、实现功能准确性
>
> 需要检查其他指令 SKILL 实现，是否存在相同问题，是否都需要调整
>
> 再次检查是否还存在异常点，生成从Phase 1-3完整实现方案和计划，同时需要考虑功能更新后，项目init初始化情况，历史数据处理情况
>
> 需要把针对变更提案、索引能力json\db方案也要加入

### 确认后基线
（本探索产物即为最终方案基线）

---

## 总览：双层优化架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    双层优化全景                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Layer A: SKILL 指令层 (模板文本)          Layer B: Artifact 数据层 (变更制品)│
│  ═══════════════════════════════          ═══════════════════════════════════│
│  问题：模板正文 12,000 行                问题：下游 MD 全文解析慢/不准         │
│  方案：Compact + references              方案：JSON Sidecar + SQLite 索引     │
│  效果：Token -23%，速度不变              效果：Token -40% 在 apply/verify     │
│                                          + 准确性 ↑（结构化对比替代散文解析） │
│                                                                             │
│  两者互补：                                                                  │
│  A 减少 AI 读入的指令量                    B 减少 AI 需要解析的数据量           │
│  A 让每次 SKILL 调用更轻                  B 让跨阶段数据传递更精确             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part A: SKILL 指令层优化

### A.1 现状：全部 26 个模板

| 层级 | 行数 | 模板数 | 总计行数 | 代表 |
|:---|:---|:---|:---|:---|
| 超重型 | 1000+ | 4 | 7,201 | workflow, frontend, release-package, review-proposal |
| 重型 | 500~1000 | 4 | 3,098 | test, debug, migration-check, auto-workflow |
| 中型 | 200~550 | 11 | 4,509 | verify-proposal, apply, archive, explore, propose... |
| 轻型 | <200 | 7 | 882 | verify, auto-migration, tools, commit... |
| **合计** | | **26** | **~15,690** | |

### A.2 发现的关键异常

1. **Compact Gate 闲置**：`prompt-gate.ts` 已有 `buildPromptGateCompact()` (12行) 和 `buildFlowchartCompact()` (8行)，5个 Skill 模板仍用全文版 (320行)
2. **references 机制闲置**：`SkillReference[]` 类型、`writeSkillReferences` 函数、`update.ts` 的 `syncReferences` 全部就位，但仅 `tr-init.ts` 1 个模板使用
3. **Guardrails 重复**：20 个模板开头重复同样的护栏 (~10行/个)
4. **输出示例冗余**：5 个模板含大段 ASCII 输出示例 (~345行)
5. **大体积内联**：review-proposal 检查矩阵 600 行，frontend 模板 800+ 行

### A.3 Optimizations (Phase 1-3)

#### Phase 1: 立即 (1-2天, -2,113行, -13.5%)

| 编号 | 措施 | 涉及模板 | 节省 |
|:---|:---|:---|:---|
| A1.1 | Gate Compact + references | 5 | -1,560 |
| A1.2 | Guardrails 单行化 | 26 | -208 |
| A1.3 | 输出示例移 references | 5 | -345 |

#### Phase 2: 短期 (2-3天, -1,350行, -8.6%)

| 编号 | 措施 | 涉及模板 | 节省 |
|:---|:---|:---|:---|
| A2.1 | 检查矩阵结构化 | 1 | -400 |
| A2.2 | 前端组件模板拆分 | 1 | -800 |
| A2.3 | D1-D10 维度压缩 | 1 | -150 |

#### Phase 3: 长期 (按需, -150行)

| 编号 | 措施 |
|:---|:---|
| A3.1 | Gate 双态渲染接口统一 |
| A3.2 | 共享资源协议分层化 |

---

## Part B: Artifact 数据层优化（JSON Sidecar + SQLite 索引）

### B.1 当前数据流瓶颈分析

```
当前：所有 artifact 都是 Markdown，下游 SKILL 必须全文解析

┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ spec-propose │       │ spec-apply   │       │ spec-verify   │
│              │       │              │       │              │
│ 写 proposal  │       │ 读 proposal  │       │ 读 tasks.md  │
│ 写 design    │       │ 读 design    │       │ 解析 checkbox │
│ 写 specs     │       │ 读 specs     │       │ 读 specs     │
│ 写 tasks     │       │ 读 tasks     │       │ 解析散文     │
│              │       │ 解析 checkbox│       │              │
└──────┬───────┘       └──────┬───────┘       └──────┬───────┘
       │                      │                      │
       ▼                      ▼                      ▼
  ┌──────────┐          ┌──────────┐          ┌──────────┐
  │ ~300 行  │          │ ~300 行  │          │ ~200 行  │
  │ MD 写入  │          │ MD 读入  │          │ MD 读入  │
  └──────────┘          └──────────┘          └──────────┘

问题：
  1. spec-apply 需要解析 tasks.md 的 markdown checkbox 来判断任务状态
     → 全文读入 → 正则匹配 `- [ ]` vs `- [x]` → 误差风险
  2. spec-verify 需要从 tasks.md 提取任务列表 + 从 specs 提取需求列表
     → 两次全文解析 → token 浪费
  3. tr-docs-requirement-doc 需要从 design.md 提取决策表
     → 散文→结构化表格的 AI 推理 → 可能出错
  4. spec-explore 需要搜索历史探索记忆
     → Glob 扫描所有 capability 目录 + Read 每个 exploration.md → O(n) token
```

### B.2 方案：JSON Sidecar + SQLite Index

```
优化后：MD 仍是人类评审入口；JSON 是机器消费加速层

                    Layer 1: Markdown（人类评审真源）
                    ═══════════════════════════════
                    openspec/changes/<name>/
                    ├── proposal.md
                    ├── design.md
                    ├── specs/*.md
                    └── tasks.md

                    生成时自动提取
                         │
                         ▼
                    Layer 2: JSON Sidecar（结构化元数据）
                    ═══════════════════════════════
                    openspec/changes/<name>/.venus/
                    ├── manifest.json      ← 变更元信息
                    ├── tasks.json         ← 结构化任务
                    ├── decisions.json     ← 结构化决策
                    └── capabilities.json  ← 能力→需求映射

                    归档时写入
                         │
                         ▼
                    Layer 3: SQLite Index（跨变更搜索）
                    ═══════════════════════════════
                    openspec/.venus/index.db
                    ├── changes             ← 变更索引
                    ├── capabilities        ← 能力→变更映射
                    ├── decisions           ← 决策全文搜索
                    └── requirements        ← 需求关键词索引
```

### B.3 JSON Sidecar 详细设计

#### B.3.1 manifest.json — 变更元信息

```jsonc
{
  "$schema": "venus/manifest/v1",
  "changeName": "add-export-excel",
  "createdAt": "2026-10-10T10:00:00Z",
  "updatedAt": "2026-10-10T12:00:00Z",
  "capabilities": ["export"],
  "impactAreas": ["前端页面", "后端Service", "数据库"],
  "phase": "proposal"  // proposal | apply | archive
}
```

**产生时机**：spec-propose 创建 proposal.md 时自动生成
**消费方**：spec-status（快速读取变更摘要，无需解析 proposal.md）

#### B.3.2 tasks.json — 结构化任务

```jsonc
{
  "$schema": "venus/tasks/v1",
  "tasks": [
    {
      "id": "1.1",
      "label": "代码",
      "description": "创建 ExportService 类",
      "status": "pending",           // pending | done
      "dependencies": [],            // 依赖的 task id 列表
      "nodeRef": "N4",               // 流程图节点引用
      "specRef": "specs/export/spec.md#REQ-001",
      "files": ["src/service/ExportService.ts"],
      "batchGroup": "2. 数据层"
    },
    {
      "id": "2.2",
      "label": "测试",
      "subLabel": "单元",
      "priority": "P0",
      "description": "ExportService 导出逻辑测试",
      "status": "pending",
      "dependencies": ["1.1"],
      "specRef": "specs/export/spec.md#Scenario-export-large"
    }
  ],
  "progress": { "total": 12, "complete": 0, "remaining": 12 }
}
```

**产生时机**：spec-propose 创建 tasks.md 时同步生成
**更新时机**：spec-apply 完成每个任务后更新 status 字段
**消费方**：
- spec-apply：读 tasks.json → 精确知道哪些任务 pending、依赖关系、batch 分组
- spec-verify：读 tasks.json → 结构化对比任务完成 vs 需求覆盖

**Token 节省**：spec-apply 不再需解析 100 行 tasks.md，直接读 30 行 tasks.json（-70%）

#### B.3.3 decisions.json — 结构化决策

```jsonc
{
  "$schema": "venus/decisions/v1",
  "decisions": [
    {
      "id": "D1",
      "title": "Excel 导出使用 Apache POI",
      "choice": "Apache POI 5.x + SXSSFWorkbook",
      "alternatives": ["JExcelApi", "EasyExcel"],
      "rationale": "POI 对 Excel 格式支持最完整，SXSSFWorkbook 支持流式写入避免 OOM",
      "risks": ["大数据量导出时内存可能不足，需设置 rowAccessWindowSize"],
      "relatedFiles": ["pom.xml:45", "src/main/java/.../ExportService.java:30"]
    }
  ]
}
```

**产生时机**：spec-propose 创建 design.md 时同步生成
**消费方**：
- tr-docs-requirement-doc：读 decisions.json → 直接渲染"关键技术决策"表格
- spec-verify：读 decisions.json → 检查设计决策是否被实现遵循

**准确性提升**：需求文档的决策表不再靠 AI 从 design.md 散文中"猜测"，直接从 JSON 渲染

#### B.3.4 capabilities.json — 能力映射

```jsonc
{
  "$schema": "venus/capabilities/v1",
  "capabilities": [
    {
      "name": "export",
      "operations": [
        {
          "type": "ADDED",
          "requirement": "导出Excel",
          "scenarios": [
            {
              "name": "用户点击导出按钮",
              "given": "用户有导出权限",
              "when": "点击导出Excel按钮",
              "then": "生成Excel文件并下载"
            }
          ]
        }
      ]
    }
  ]
}
```

**产生时机**：spec-propose 创建 specs/*.md 时同步生成
**消费方**：
- spec-verify：读 capabilities.json → 逐需求/scenario 对比实现
- spec-bulk-archive：读 capabilities.json → 检测跨变更 capability 冲突

### B.4 SQLite 索引设计

#### B.4.1 表结构

```sql
-- 变更索引表
CREATE TABLE changes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    archive_date TEXT,           -- YYYY-MM-DD，未归档为 NULL
    module      TEXT,
    summary     TEXT,            -- 从 proposal.md Why 提取，max 200 字符
    status      TEXT DEFAULT 'active',  -- active | archived
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- 能力表
CREATE TABLE capabilities (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,    -- 能力名（如 "export"）
    change_id   INTEGER NOT NULL REFERENCES changes(id),
    operation   TEXT NOT NULL,    -- ADDED | MODIFIED | REMOVED | RENAMED
    UNIQUE(name, change_id)
);

-- 需求表（全文搜索）
CREATE VIRTUAL TABLE requirements USING fts5(
    requirement_name,
    scenario_text,
    change_name,
    capability_name
);

-- 决策表（全文搜索）
CREATE VIRTUAL TABLE decisions USING fts5(
    title,
    choice,
    rationale,
    change_name
);

-- 探索记忆表
CREATE TABLE exploration_memory (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    capability  TEXT NOT NULL,
    change_name TEXT NOT NULL,
    memory_type TEXT NOT NULL,   -- decision | term | edge_case | finding
    content     TEXT NOT NULL,
    archived_at TEXT NOT NULL,
    superseded_by TEXT           -- 被哪个变更取代
);
CREATE INDEX idx_exploration_capability ON exploration_memory(capability);
```

#### B.4.2 读写时机

```
写入：
  spec-archive → 归档变更时：
    1. 插入 changes 表
    2. 读取 capabilities.json → 插入 capabilities 表
    3. 读取 decisions.json → 插入 decisions FTS 表
    4. 读取 specs/*.md → 插入 requirements FTS 表
    5. 读取 exploration.md → 插入 exploration_memory 表

查询：
  spec-explore → 搜索历史探索记忆：
    SELECT * FROM exploration_memory WHERE capability = 'export'
    ORDER BY archived_at DESC
    → 替代 Glob openspec/specs/*/explorations.md

  spec-propose → 检测 capability 冲突：
    SELECT c.name, ch.name FROM capabilities c
    JOIN changes ch ON c.change_id = ch.id
    WHERE c.name IN ('export', 'auth') AND ch.status = 'active'
    → 替代 Glob + Grep 全文搜索

  spec-verify-proposal → 查找相关决策：
    SELECT * FROM decisions WHERE decisions MATCH '导出 Excel'
    → 替代 Grep 全文搜索 design.md
```

#### B.4.3 索引文件位置

```
openspec/.venus/index.db          ← SQLite 数据库
openspec/.venus/index.db-wal      ← WAL 日志
openspec/.venus/index.db-shm      ← 共享内存

.gitignore 中已有 .venus/ → 索引不入库，每台机器本地生成
```

### B.5 JSON Sidecar 与现有 Markdown 的关系

**核心原则：Markdown 是唯一真源，JSON 是只读加速层。**

```
┌─────────────────────────────────────────────────────────────────┐
│                     权威层级                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Markdown (proposal.md / design.md / specs / tasks.md)         │
│          ↑ 唯一真源 —— 人类编写/审阅/修改的入口                    │
│          │                                                       │
│          │ 自动提取（生成/更新时触发）                              │
│          │                                                       │
│   JSON (.venus/manifest.json / tasks.json / decisions.json)     │
│          ↑ 机器消费加速层 —— 从 MD 派生，不独立存在                │
│          │ 如果 JSON 与 MD 不一致，以 MD 为准                      │
│          │                                                       │
│   SQLite (openspec/.venus/index.db)                              │
│          ↑ 跨变更搜索索引 —— 从 JSON 派生，归档时写入              │
│                                                                 │
│   规则：                                                          │
│   - JSON 缺失 → 从 MD 重新解析（降级，无阻断）                      │
│   - JSON 与 MD 不一致 → 以 MD 为准 + WARN 日志                     │
│   - SQLite 不可用 → Glob/Grep 降级（同现有行为）                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### B.6 具体实施方案

#### Phase 2B: JSON Sidecar 生成与消费 (与 A.2 并列，2-3天)

| 编号 | 措施 | 涉及 | 说明 |
|:---|:---|:---|:---|
| B2.1 | JSON Schema 定义 | `src/core/spec/sidecar-schema.ts` (新文件) | 定义 manifest/tasks/decisions/capabilities 的 TS 接口 + JSON Schema |
| B2.2 | tasks.json 生成 | spec-propose + spec-apply | propose 阶段从 tasks.md 提取生成；apply 阶段更新 status |
| B2.3 | tasks.json 消费 | spec-apply + spec-verify | apply 不再解析 markdown checkbox；verify 结构化对比 |
| B2.4 | decisions.json 生成 | spec-propose | 从 design.md 提取 Decisions 章节 |
| B2.5 | decisions.json 消费 | tr-docs-requirement-doc | 直接渲染决策表，不再 AI 推理 |
| B2.6 | capabilities.json 生成 | spec-propose | 从 specs/*.md 提取 capability→requirement→scenario 映射 |

**SKILL 模板改动**（关键——这是 SKILL 指令文本层面的变更）：

在 `spec-propose.ts`、`spec-apply.ts`、`spec-verify.ts`、`tr-docs-requirement-doc.ts` 的 instructions 中增加 JSON sidecar 的生成/消费指令。

**改动量估算**：
- 每个 SKILL 新增 ~15-25 行 JSON sidecar 指令
- 同时移除 ~20-30 行"解析 markdown"指令（被 JSON 替代）
- 净变化：~0 到 -10 行/模板

#### Phase 3B: SQLite 索引 (长远，3-4天)

| 编号 | 措施 | 涉及 | 说明 |
|:---|:---|:---|:---|
| B3.1 | index.db 初始化 | `venus init` 新增步骤 | init 时创建空 SQLite 数据库和表结构 |
| B3.2 | 归档时写入索引 | spec-archive + spec-bulk-archive | 归档后读取 .venus/ JSON → INSERT/UPDATE SQLite |
| B3.3 | 探索时查询索引 | spec-explore | 查询 exploration_memory 表替代 Glob |
| B3.4 | 提案时冲突检测 | spec-propose | 查询 capabilities 表替代 Glob+Grep |
| B3.5 | CLI 查询命令 | `venus spec search` (新命令) | 全文搜索需求/决策/变更历史 |

### B.7 init/update/历史数据 兼容性

#### B.7.1 init 影响

```
venus init 现有步骤：
  1. 生成 SKILL.md + references
  2. 生成斜杠指令
  3. 写入 settings.json
  4. 创建 .venus/config.yaml + rules/

新增步骤（B.3.1）：
  5. 创建 openspec/.venus/index.db（空库 + 建表 DDL）
     → 文件不存在时创建；已存在时跳过（不覆盖用户数据）
     → 失败时 WARN（非阻断，与 scan-baseline 同策略）
```

#### B.7.2 update 影响

```
venus update：
  - 不影响 artifact 数据层（只刷新 SKILL 模板 + 指令）
  - 不需要迁移 index.db（新建/重建由 init 或手动触发）
  - JSON sidecar 生成指令随 SKILL 模板更新自动生效
```

#### B.7.3 历史数据迁移

```
场景 1: 存量项目（有 openspec/ 但无 .venus/ sidecar）
  → 下次 spec-propose 时自动生成 JSON sidecar（新行为）
  → 下次 spec-archive 时自动写入 SQLite（新行为）
  → 无需手动迁移，渐进式覆盖

场景 2: 存量项目（无 index.db）
  → 下次 venus init（或单独的命令）创建空库
  → 存量已归档变更可通过 "重建索引" 命令批量导入：
    venus spec reindex  ← 扫描 openspec/changes/archive/ 全部变更
                       → 解析各变更的 .venus/*.json → 写入 index.db

场景 3: JSON sidecar 缺失但 MD 存在（降级）
  → spec-apply: tasks.json 不存在 → 回退到解析 tasks.md checkbox（WARN）
  → spec-verify: decisions.json 不存在 → 回退到解析 design.md 散文（WARN）
  → 降级行为透明，不阻断流程

场景 4: SQLite 不可用（降级）
  → spec-explore: index.db 不可用 → Glob/Grep 降级（同现有行为）
  → spec-propose: index.db 不可用 → Glob/Grep 降级（同现有行为）
```

---

## Part C: 集成路线图

```
┌───────────────────────────────────────────────────────────────────────────┐
│                        INTEGRATED ROADMAP                                  │
├──────────┬────────────────────────────────────────────────────────────────┤
│ Sprint   │ 内容                                                           │
├──────────┼────────────────────────────────────────────────────────────────┤
│          │                                                                │
│ Sprint 1 │ PART A — Phase 1: SKILL 模板瘦身                                │
│ (1-2天)  │ A1.1 Gate Compact + references (5模板, -1,560行)                │
│          │ A1.2 Guardrails 单行化 (26模板, -208行)                         │
│          │ A1.3 输出示例移 references (5模板, -345行)                       │
│          │ ↓ 可独立交付：pnpm test 全部通过                                 │
│          │                                                                │
│ Sprint 2 │ PART A — Phase 2: SKILL 模板结构优化                             │
│ (2-3天)  │ A2.1 检查矩阵结构化 (review-proposal, -400行)                    │
│          │ A2.2 前端组件拆分 (frontend, -800行)                             │
│          │ A2.3 D1-D10 压缩 (verify-proposal, -150行)                      │
│          │ ↓ 可独立交付：pnpm test 全部通过                                 │
│          │                                                                │
│ Sprint 3 │ PART B — Phase 2B: JSON Sidecar 生成与消费                       │
│ (2-3天)  │ B2.1 JSON Schema 定义 (新文件 sidecar-schema.ts)                │
│          │ B2.2 tasks.json 生成/消费 (propose + apply + verify)            │
│          │ B2.3 decisions.json 生成/消费 (propose + requirement-doc)       │
│          │ B2.4 capabilities.json 生成/消费 (propose + bulk-archive)       │
│          │ B2.5 manifest.json 生成/消费 (propose + status)                 │
│          │ ↓ 可独立交付：新增 test/sidecar-schema.test.ts                 │
│          │                                                                │
│ Sprint 4 │ PART B — Phase 3B: SQLite 索引 + 搜索                            │
│ (3-4天)  │ B3.1 index.db 初始化 (venus init 新步骤)                        │
│          │ B3.2 归档写入索引 (archive + bulk-archive)                      │
│          │ B3.3 探索查询索引 (explore)                                      │
│          │ B3.4 提案冲突检测 (propose)                                      │
│          │ B3.5 重建索引命令 (venus spec reindex)                           │
│          │ ↓ 可独立交付：新增 test/sqlite-index.test.ts                   │
│          │                                                                │
│ Sprint 5 │ 收尾                                                           │
│ (1天)    │ CHANGELOG, 文档更新, 全面集成测试                                 │
│          │                                                                │
├──────────┼────────────────────────────────────────────────────────────────┤
│ 总计     │ ~10-13 天，5 个可独立交付的 Sprint                                 │
└──────────┴────────────────────────────────────────────────────────────────┘
```

### 预估收益汇总

```
┌───────────────────────────────────────────────────────────────────────────┐
│                         ESTIMATED BENEFITS                                 │
├──────────────────────────────────┬──────────┬───────────┬─────────────────┤
│ 维度                              │ 措施      │ 节省幅度   │ 波及范围         │
├──────────────────────────────────┼──────────┼───────────┼─────────────────┤
│ SKILL 加载 token                 │ A Phase 1│ -13.5%    │ 26 模板          │
│ SKILL 加载 token                 │ A Phase 2│ -8.6%     │ 3 模板           │
│ SKILL 加载 token (合计)           │ A 全阶段  │ -23%      │ 26 模板          │
├──────────────────────────────────┼──────────┼───────────┼─────────────────┤
│ spec-apply tasks 解析 token      │ B tasks.json │ -70%   │ apply/verify     │
│ spec-verify 对比 token           │ B tasks.json │ -60%   │ verify           │
│ requirement-doc 决策表准确性      │ B decisions.json│ ↑↑   │ requirement-doc  │
│ spec-explore 历史搜索 token      │ B SQLite      │ -80%   │ explore          │
│ spec-propose 冲突检测 token      │ B SQLite      │ -70%   │ propose/bulk     │
├──────────────────────────────────┼──────────┼───────────┼─────────────────┤
│ 全链路（探索→提案→实现→验证→归档）│ A+B 全方案 │ -35~45%  │ 全流程           │
│ 关键节点准确性                    │ B JSON     │ ↑ 显著   │ apply/verify/    │
│                                   │            │          │ requirement-doc │
└──────────────────────────────────┴──────────┴───────────┴─────────────────┘
```

---

## 实施优先级判定

```
紧急且重要 → Sprint 1 (A.1 Gate Compact + Guardrails)
  理由：最大收益最低风险，基础设施已就绪

重要不紧急 → Sprint 2 (A.2 模板结构优化)
  理由：收益中等，需验证 AI 对 references 的按需读取行为

重要不紧急 → Sprint 3 (B JSON Sidecar)
  理由：准确性提升显著，Schema 设计需审核

重要不紧急 → Sprint 4 (B SQLite Index)
  理由：跨变更搜索价值高但依赖前序 sprint 的 JSON 数据就位

轻量收尾 → Sprint 5
```

---

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|:---|:---|:---|:---|
| AI 不读 references 文件 | 低 | 中 | 指令显式提示；tr-init 已成功验证 |
| JSON 与 MD 不同步 | 中 | 中 | MD 为唯一真源；JSON 缺失时降级解析 MD |
| SQLite 文件锁 (Windows) | 中 | 低 | WAL 模式；写入失败降级 Glob/Grep |
| 增量实施导致碎片化 | 低 | 低 | 每个 Sprint 独立可交付；pnpm test 保证回归 |
| Compact 丢失关键规则 | 极低 | 高 | compact 函数与 full 同源参数化渲染 |

---

## 不纳入范围

| 项目 | 原因 |
|:---|:---|
| release-package.ts (1,749行) | 外部独立技能 |
| Markdown→JSON 自动双向转换 | JSON 是只读加速层；反向同步引入复杂性和不一致风险 |
| 实时 JSON schema 校验 | 离线生成；运行时只做降级容错 |
| index.db 多机同步 | 不入库，本地生成 |