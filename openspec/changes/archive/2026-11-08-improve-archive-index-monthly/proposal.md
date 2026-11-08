## Why

归档索引当前只有单一文件 `openspec/changes/archive/ARCHIVE-INDEX.md`：78 行 / 42 KB / 45 条历史条目，单行摘要很长，随归档次数增长会持续膨胀，逐步难以检索与阅读。需要把索引按月份分片，使单个文件有界，同时保留一个可发现的统一入口。

## What Changes

- 根入口 `openspec/changes/archive/ARCHIVE-INDEX.md` 改为**索引入口**：承担月份导航 + 全局模块统计；仅允许更新月份链接与统计，既有条目不改写（D1）。
- 新增月度索引 `openspec/changes/archive/ARCHIVE-INDEX-YYYY-MM.md`（同目录扁平）：承载当月归档条目与当月模块统计，**纯追加**（D2、D5）。
- 月份取归档目录名 `YYYY-MM-DD-` 前缀前 7 位；批量归档按每个成功变更各自目录名分组；不读本地时间、不做时区换算（D4）。
- 异常处置：月度文件缺失按标准结构创建；月度文件损坏保留原文 + 最小追加 + WARN；根入口损坏只补缺失月份链接 + WARN；任何索引文件 MUST NOT 全量重建（D5）。
- 历史 45 条按归档日期拆为 `2026-09`(17) / `2026-10`(18) / `2026-11`(10) 三个月度文件，条目文本逐字保留；根文件改写为入口 + 全局统计（D3，一次性仓库维护）。
- 更新模板：`spec-archive` Step 7、`spec-bulk-archive` Step 10 及写入面/只读护栏、`workflow` / `auto-workflow` 的归档协议引用措辞（D6、D7）。
- debug 不写索引、不改归档逻辑，记录「无需改动」（D6）。
- `docs/openspec-comparison.md` 不改（D7）。

## Capabilities

### New Capabilities

<!-- 无新增能力：本变更是在既有归档能力上扩展分片存储 -->

- 无

### Modified Capabilities

- `spec-workflow-skills`: 单变更归档的写入面、只读护栏与索引维护要求由单文件扩展为「根入口 + 月度分片」。
- `spec-bulk-archive-skill`: 批量归档的主代理单点索引更新由单文件扩展为按月份分组写入多个月度文件并更新根入口。
- `workflow-suite-skills`: workflow / auto-workflow 归档阶段对索引协议的引用措辞同步；debug 维持无索引写入。

## Impact

### 直接影响的文件

- `openspec/changes/archive/ARCHIVE-INDEX.md`: 改写为索引入口（月份导航 + 全局模块统计）。
- `openspec/changes/archive/ARCHIVE-INDEX-2026-09.md`: 新建，承载 2026-09 的 17 条历史条目。
- `openspec/changes/archive/ARCHIVE-INDEX-2026-10.md`: 新建，承载 2026-10 的 18 条历史条目。
- `openspec/changes/archive/ARCHIVE-INDEX-2026-11.md`: 新建，承载 2026-11 的 10 条历史条目。
- `src/core/templates/workflows/spec-archive.ts`: Step 7 索引维护改为月度分片 + 根入口更新；Guardrails 同步。
- `src/core/templates/workflows/spec-bulk-archive.ts`: Step 10 批量索引更新改为按月份分组；写入面/只读护栏同步。
- `src/core/templates/workflows/workflow.ts`: 归档阶段对索引协议的引用措辞同步。
- `src/core/templates/workflows/auto-workflow.ts`: 自动归档阶段对索引协议的引用措辞同步。
- `skills/iagent-spec-archive/SKILL.md`、`skills/iagent-spec-bulk-archive/SKILL.md` 等: 由 `pnpm generate:skills` 重新生成快照（不手编）。
- `test/templates.test.ts`: 更新既有索引断言并补月度索引规则断言。
- `test/template-derivation.test.ts`: 更新指令版派生断言。
- `openspec/specs/spec-workflow-skills/spec.md`、`openspec/specs/spec-bulk-archive-skill/spec.md`、`openspec/specs/workflow-suite-skills/spec.md`: 归档落地时同步（由归档流程合并 delta）。

### 向后兼容

无 BREAKING。根入口 `ARCHIVE-INDEX.md` 路径保持不变，既有引用不断链；历史 45 条条目逐字保留，仅按月份迁移到月度文件；索引仍为 AI 技能维护的 Markdown，不存在代码消费方。
