# sqlite-cross-change-index 增量规格

> 本能力整体退役（DEC-2）。下列 6 条 Requirement 全部移除：前 4 条为索引的核心行为（初始化 / 归档写入 / 探索查询 / 提案冲突检测），后 2 条为 `iagent spec reindex` 专属行为（Markdown 主来源、全文结果保留证据）——命令与索引同时在本次变更中删除，保留这两条会使主规格继续要求一个不存在的命令。
>
> 本能力目录下的 `explorations.md`（能力级历史探索记忆）**保留**：它是 `spec-archive` 归档时同步的历史记忆载体，与索引无关，退役后仍作为「读历史决策」的唯一入口（与 `spec-explore` 的 N5B 分支一致）。

## REMOVED Requirements

### Requirement: index.db 初始化

**Reason**: 索引整体退役，`iagent init` 不再创建 `openspec/changes/archive/.iagent/index.db`（`initDatabase` / `isSqlite3Available` / `resolveIndexDb` 随模块删除）。索引在规格中即被定义为可重建缓存，删除不触及任何真源；本工具 MUST NOT 删除用户目录中的历史 `index.db`。

**Migration**: 升级后 init 输出不再含索引创建结果；历史 `index.db` 可保留（只读）或用外部 `sqlite3` 打开；跨变更检索改用 Glob/Grep 与 `openspec/specs/<capability>/explorations.md`。

### Requirement: 归档写入索引

**Reason**: `spec-archive` / `spec-bulk-archive` 归档后的 `iagent spec reindex --force` 步骤删除（实测每次全量重建约 9.8s / 42 变更，且 40 个走 legacy 降级、1 个崩溃）。归档步骤序简化为「delta 合并 → 需求文档检查点 → 目录移动 → 探索记忆同步 →（按需）CodeGraph」。

**Migration**: 归档流程不再需要 `sqlite3` CLI；`spec-archive` / `spec-bulk-archive` 的 sQLite 降级 WARN 分支同步删除。

### Requirement: 探索查询索引

**Reason**: 读路径三重不可达（查询函数零调用点、模板路径与真值不一致、技能白名单无 `Bash(sqlite3:*)`），且探索记忆早已同步至 `openspec/specs/<capability>/explorations.md`（全文检索 4MB/401 文件实测 253ms）。`spec-explore` 的历史记忆检索收敛为**唯一** Glob 分支。

**Migration**: `spec-explore` 直接 Glob `openspec/specs/<capability>/explorations.md`；不再出现 `index.db` 引用与「索引不可用降级」措辞。

### Requirement: 提案冲突检测

**Reason**: 该检索在模板正文中从未实现（`spec-propose` 无 `index.db` 引用），且 `capabilities` 表的写侧随索引一并删除。能力冲突检测改由既有 Glob 扫描 `openspec/changes/*/specs/` 承担（若技能需要该检查），MUST NOT 再依赖索引。

**Migration**: 提案阶段的冲突判断仅依据变更目录内的 delta specs 文件清单；删索引后行为与当前实际行为一致（当前也从未查索引）。

### Requirement: Reindex uses Markdown as the primary source

**Reason**: 本条描述 `iagent spec reindex` 的解析来源优先级；命令与索引模块在本变更中删除，该 Requirement 失去对象。Markdown 作为唯一真源的定位由 `artifact-markdown-source` 能力承担，不受影响。

**Migration**: 无需迁移动作；Markdown 制品仍是唯一可编辑真源，索引侧不再有任何派生缓存。

### Requirement: Full-text results retain Markdown evidence

**Reason**: 本条约束全文索引搜索结果必须携带 Markdown 证据路径；索引删除后不再存在全文搜索结果。改用 Grep/Glob 直接命中 Markdown 原文，天然携带文件路径与行号。

**Migration**: 查询历史决策时直接检索 `openspec/specs/**/explorations.md` 与 `openspec/changes/archive/**`，结果即原文与路径。
