## MODIFIED Requirements

### Requirement: spec-archive 归档技能

spec-archive 技能 SHALL 实现归档工作流：检查 CONTEXT.md 术语同步（不存在则创建）→ 从变更的 exploration.md 提取决策/术语/边界场景并追加到 `openspec/specs/<capability>/explorations.md`（冲突标记"已过时"但保留历史）→ AI 智能合并 delta spec 到主 spec（ADDED/MODIFIED/REMOVED/RENAMED）→ 调用 `iagent spec archive` 移动目录 → CodeGraph **按需**同步（失败仅 WARN、不阻断）→ 向**月度归档索引**追加条目并更新**根索引入口**。

**分片归档索引布局（强制）(D1/D2)**：归档索引 SHALL 由两部分组成 —— ① 根入口 `openspec/changes/archive/ARCHIVE-INDEX.md`（月份导航 + 全局模块统计）；② 月度索引 `openspec/changes/archive/ARCHIVE-INDEX-YYYY-MM.md`（当月归档条目 + 当月模块统计）。月度索引 MUST 采用同目录扁平命名，路径 MUST 为 `openspec/changes/archive/ARCHIVE-INDEX-YYYY-MM.md`。

**月份判定（强制）(D4)**：月份 MUST 取归档目录名 `YYYY-MM-DD-` 前缀前 7 位；MUST NOT 读取本地时间、MUST NOT 做时区换算。目录名无 `YYYY-MM-DD-` 前缀时 SHALL 回退为当前归档日期所在月并输出 WARN。

**月度索引维护（强制）(D5)**：月度索引不存在时 SHALL 按标准结构创建（标题 / 说明 / 当月归档变更列表 / 当月模块统计 / 页脚时间戳）。月度索引 MUST **纯追加**本批条目，MUST NOT 全量重建或整体覆盖；结构损坏时 SHALL 保留原文并仅追加最小条目，同时输出 WARN 提示人工修复，MUST NOT 丢弃既有历史条目。

**根入口维护（强制）(D1)**：根入口 SHALL 只承担月份导航与全局模块统计。归档时根入口 SHALL 仅允许：① 追加缺失的当月月份链接（已存在则跳过）；② 依据全部月度文件确定性重算全局模块统计。根入口 MUST NOT 改写既有月度条目；根入口缺失但存在月度文件时 SHALL 依据月度文件重建入口（月份导航 + 全局统计）并在摘要中报告该次重建；根入口损坏时 SHALL 保留原文并只补缺失月份链接 + WARN，MUST NOT 重建。

**归档写入面（强制）**：归档 SHALL 只能写入 `openspec/specs/**`、`openspec/CONTEXT.md`、`openspec/changes/archive/ARCHIVE-INDEX.md`（仅月份链接与全局统计更新）与 `openspec/changes/archive/ARCHIVE-INDEX-YYYY-MM.md`（纯追加）；`openspec/changes/**` 在归档流程中只允许**整目录移动**，MUST NOT 改写其中任何文件的既有内容。流程级临时工作区 `.openspec-tmp/` 的清理不属于归档写入面（临时产物、不进提交面），见下文「归档收尾清理」。

**归档只读（强制）**：MUST NOT 修改 `openspec/changes/archive/` 下的既有内容——已归档变更是历史事实。整目录移动（`openspec/changes/<name>/` → `openspec/changes/archive/YYYY-MM-DD-<name>/`）SHALL NOT 视为改写；根入口的月份链接/全局统计更新与月度索引的**追加**为该护栏的显式例外。

**失败与跳过不入索引（强制）(D8)**：失败或跳过的变更 MUST NOT 写入任何月度索引，也不得参与统计重算。

**需求文档不再读取或报告**：归档流程 MUST NOT 检查 `需求文档.md` 是否存在、MUST NOT 读取 `requirementDocStatus`、MUST NOT 在摘要中报告需求文档状态。变更目录内若存在 `需求文档.md`，它随目录一起留在 `openspec/changes/archive/` 内；归档 MUST NOT 生成、对齐、迁出或删除它。

**MUST NOT** 调用 `iagent spec reindex` 或任何索引重建（索引已退役，归档不含索引步骤）；任何索引文件 MUST NOT 全量重建。

**CodeGraph 段 SHALL 采用能力探测 + 锁阶梯**：先按「MCP 具名工具 → 可用通道 → CLI `status --json`」探测可用性；需同步时读 `.codegraph/` 下的 `writer.pid` 判存活——**存活则只读复用**既有索引并 MUST NOT 执行 `codegraph unlock`；**不存活才** `codegraph unlock` + 重试一次；仍失败则降级 Glob/Grep 并记录 WARN。仅当确认**无 daemon**（纯 CLI 用户）时才执行一次 `codegraph sync`；daemon 活跃时 MUST NOT 显式 sync（同步责任归 daemon 文件监听）。全流程 MUST NOT 询问用户是否重试（沿用既有「任何错误不询问用户」口径）。

**归档收尾清理（流程级工作区）**：归档成功后技能 SHALL 清理该变更的 `.openspec-tmp/pipeline-<change-name>/`（含 `compile-report.md` 与 `handoff-pack.md`），同时识别旧 `apply-` 前缀；清理 MUST 发生在向 handoff 包追加 `phase=archive` 结论之后。清理失败 SHALL 记 WARN，MUST NOT 阻断归档、MUST NOT 改写已写入的阶段结论。清理 SHALL 经跨平台删除（`node -e "fs.rmSync(...)"`）执行，`allowedTools` 因此 SHALL 含 `Bash(node:*)`。

技能的 `allowedTools` SHALL 覆盖正文实际发起的调用：正文经 Bash 运行 `codegraph` CLI（`status` / `unlock` / 条件 `sync`）时 MUST 含共享常量 `CODEGRAPH_CLI`（`Bash(codegraph:*)`），MUST NOT 只写 MCP 条目。因正文不再委派需求文档技能，`allowedTools` MUST NOT 保留 `Skill(iagent-requirement-doc)` 条目（最小权限）；因 `需求文档.md` 迁移与存在性检查已删除，`Bash(ls:*)` 不再有正文调用，MUST NOT 保留该条目；清理步骤所需的 `Bash(node:*)` SHALL 保留（真实调用支撑），MUST NOT 以 `Bash(rm:*)` 等更宽条目替代。

#### Scenario: 按归档目录名分月写入月度索引

- **WHEN** 变更归档至 `openspec/changes/archive/2026-09-11-add-x/` 且归档成功
- **THEN** 技能向 `openspec/changes/archive/ARCHIVE-INDEX-2026-09.md` 追加该条条目
- **AND** 根入口 `ARCHIVE-INDEX.md` 的月份导航包含 `2026-09` 链接
- **AND** 月份 MUST 取自归档目录名前 7 位，MUST NOT 读取本地时间

#### Scenario: 月度索引首次创建标准结构

- **WHEN** 当月的 `ARCHIVE-INDEX-YYYY-MM.md` 不存在且存在成功归档的变更
- **THEN** 技能按标准结构创建（标题 / 说明 / 当月归档变更列表 / 当月模块统计 / 页脚时间戳）并写入本批条目

#### Scenario: 月度索引纯追加不重建

- **WHEN** 当月月度索引存在但表格结构部分损坏、无法完整解析
- **THEN** 技能保留原文并仅追加本批最小条目，输出 WARN 提示人工修复
- **AND** MUST NOT 重建或覆盖整个月度索引文件，MUST NOT 丢弃既有历史条目

#### Scenario: 根入口只更新月份链接与全局统计

- **WHEN** 根入口 `ARCHIVE-INDEX.md` 已存在且当月链接缺失
- **THEN** 技能追加当月月份链接，并从全部月度文件确定性重算全局模块统计
- **AND** MUST NOT 改写根入口中既有月度条目或既有条目文本

#### Scenario: 根入口缺失时依据月度文件重建

- **WHEN** 根入口 `ARCHIVE-INDEX.md` 不存在但存在 `ARCHIVE-INDEX-YYYY-MM.md` 月度文件
- **THEN** 技能依据现有月度文件重建入口（月份导航 + 全局统计），并在归档摘要中报告该次重建

#### Scenario: 失败或跳过变更不入索引

- **WHEN** 变更归档失败或被跳过
- **THEN** 技能 MUST NOT 向任何月度索引写入条目，MUST NOT 更新任何统计

#### Scenario: 需求文档随变更目录原样保留

- **WHEN** 变更目录内存在 `需求文档.md`
- **THEN** 文件随变更目录移动至 `archive/`，内容与修改时间不变
- **AND** 技能 MUST NOT 读取、报告、生成、对齐、迁出或删除它

#### Scenario: 需求文档缺失时不处理

- **WHEN** 变更目录内不存在 `需求文档.md`
- **THEN** 技能 MUST NOT 生成或报告需求文档，直接继续归档

#### Scenario: 已归档内容只读

- **WHEN** 归档流程任一环节需要访问 `openspec/changes/archive/**` 下既有变更
- **THEN** 只读访问；MUST NOT 改写其中任何文件的既有内容（整目录移动、根入口的月份链接/全局统计更新、月度索引追加除外）

#### Scenario: 归档收尾清理流程级工作区

- **WHEN** 归档成功完成并已追加 `phase=archive` 结论
- **THEN** 技能清理 `.openspec-tmp/pipeline-<change-name>/`（同时识别旧 `apply-` 前缀），清理失败记 WARN 且不阻断归档

#### Scenario: 探索记忆同步

- **WHEN** 变更含 exploration.md 且其 Decisions 与能力级 explorations.md 的既有决策冲突
- **THEN** 旧决策标记为"已过时（由 <change-name> 取代）"保留，新决策追加，历史不被删除

#### Scenario: delta spec 智能合并

- **WHEN** 变更的 specs/<capability>/spec.md 含 ADDED 与 MODIFIED 需求
- **THEN** 技能将 ADDED 需求追加到主 spec、MODIFIED 需求更新对应条目，再执行 iagent spec archive 移动

#### Scenario: MODIFIED 目标在主 spec 缺失

- **WHEN** delta spec 的 `## MODIFIED Requirements` 条目在主 spec 中找不到对应的需求标识
- **THEN** 技能把该需求按新增需求追加到主 spec，并在归档摘要中列出「MODIFIED 目标缺失（已追加）」告警，继续归档；MUST NOT 中止归档、MUST NOT 丢弃该需求

#### Scenario: 归档不含索引重建

- **WHEN** archive 完成目录移动
- **THEN** 流程中 MUST NOT 调用 `iagent spec reindex`，也 MUST NOT 读写任何 `index.db`

#### Scenario: daemon 活跃时不同步也不解锁

- **WHEN** 归档 CodeGraph 段检测到 `writer.pid` 指向的进程仍存活
- **THEN** 技能只读复用既有索引，MUST NOT 执行 `codegraph sync`、MUST NOT 执行 `codegraph unlock`

#### Scenario: 归档目录名缺少日期前缀

- **WHEN** 归档目标目录名不含 `YYYY-MM-DD-` 前缀
- **THEN** 月份回退为当前归档日期所在月并输出 WARN
- **AND** 索引写入继续执行，MUST NOT 因无法解析目录名而中止归档

#### Scenario: 根入口损坏时只补链接不重建

- **WHEN** 根入口 `ARCHIVE-INDEX.md` 存在但结构损坏
- **THEN** 技能保留原文并只补缺失的月份链接，输出 WARN 提示人工修复
- **AND** MUST NOT 全量重建根入口、MUST NOT 改写既有条目

#### Scenario: 同月多次归档链接去重

- **WHEN** 同一月份的根入口月份链接已存在
- **THEN** 技能跳过链接追加，仅向当月月度索引纯追加新条目并重算统计
- **AND** 根入口 MUST NOT 出现重复月份行

#### Scenario: 月份不因时区换算偏移

- **WHEN** 本地时间与归档目录名日期在月末或月初跨月
- **THEN** 月份一律取自归档目录名，MUST NOT 按本地时区或 UTC 换算偏移

## ADDED Requirements

### Requirement: 归档索引历史分片迁移（一次性）

本次变更 SHALL 将既有 `openspec/changes/archive/ARCHIVE-INDEX.md` 的 45 条历史条目按归档日期月份拆分到 `ARCHIVE-INDEX-2026-09.md`（17 条）/ `ARCHIVE-INDEX-2026-10.md`（18 条）/ `ARCHIVE-INDEX-2026-11.md`（10 条），条目文本 MUST 逐字保留（含摘要与 `[含xxx]` 注记）；根入口 SHALL 改写为月份导航 + 全局模块统计。日期无法解析的历史条目 MUST 保留在根入口「历史未归类」区并输出 WARN，MUST NOT 丢弃。

#### Scenario: 历史条目逐字拆分

- **WHEN** 执行一次性历史迁移
- **THEN** 每月月度文件的条目数分别为 17 / 18 / 10，且逐行文本与源表一致
- **AND** 全局模块统计等于三个月度文件统计之和

#### Scenario: 日期无法解析的历史条目不丢弃

- **WHEN** 历史条目的归档日期无法解析出月份
- **THEN** 该条目保留在根入口「历史未归类」区并输出 WARN
- **AND** MUST NOT 丢弃该条目
