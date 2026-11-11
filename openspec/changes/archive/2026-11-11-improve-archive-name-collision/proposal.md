## Why

归档目标名固定为 `openspec/changes/archive/YYYY-MM-DD-<change-name>`，一旦该名字被占用（同日对同名变更二次归档、把归档目录复制回工作区继续改、变更名本身已带日期前缀），CLI 直接抛错「归档目标已存在，拒绝覆盖」。单变更技能只能建议「重命名既有归档 / 删除重复 / 换日期」，批量归档则把该单元标为 Failed —— 用户因此**无法完成归档**，且被推向手工改动归档历史（破坏「已归档内容是历史事实」的只读护栏）。

同名复用在本仓库是真实路径（`openspec/changes/archive/` 已有 60+ 条归档、按日累积），缺一个确定性的冲突消解规则就会反复阻断归档流程。

## What Changes

- **归档目标名唯一化**：`iagent spec archive` 在候选目标名被占用时追加数字后缀 `-2`、`-3`…（自 2 起递增）直至不冲突；**绝不覆盖、绝不删除既有归档**。
- **单一真源**：唯一化在 `resolveTargetPath` 内完成，`previewArchive` 与 `executeArchive` 使用同一结果（预览展示的目标即最终目标）。
- **上限保护**：尝试 99 次仍冲突时报错并列出候选路径，避免无限循环。
- **spec-archive 技能**：删除「同名即失败 + 建议改名/删除/换日期」分支，改为报告实际归档路径；月度索引「变更名称」列取**实际目录名去掉 `YYYY-MM-DD-` 前缀**（含后缀）。
- **spec-bulk-archive 技能**：同名冲突不再使归档单元标 Failed（复用同一 CLI 行为）；其余失败隔离语义不变；索引命名口径与单变更一致。
- **不新增** CLI 严格模式开关；**不修改** 索引文件结构；**不放宽** 归档只读护栏。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `spec-workflow-cli`: 归档目标命名新增「占用时唯一化后缀」语义、上限保护，且预览与执行路径一致
- `spec-workflow-skills`: spec-archive 技能的归档执行步骤、失败分支与索引条目命名口径随唯一化行为调整
- `spec-bulk-archive-skill`: 批量归档单元的归档步骤不再因同名冲突失败，索引条目命名口径同步

## Impact

### 直接影响的文件

- `src/core/spec/archive.ts`: `resolveTargetPath` 唯一化分支 + 上限保护；`previewArchive` / `executeArchive` 共用结果
- `src/commands/spec.ts`: 输出实际归档路径（含后缀）；无新选项
- `src/core/templates/workflows/spec-archive.ts`: Step 5 冲突分支、Output/Guardrails 与索引条目命名口径
- `src/core/templates/workflows/spec-bulk-archive.ts`: 单元 b) 失败语义、摘要与索引命名口径
- `test/spec-commands.test.ts`: 将「归档目标已存在：拒绝覆盖」改写为唯一化用例，并补后缀递增/上限用例
- `skills/**`：技能快照（由 `pnpm build && pnpm generate:skills` 生成，不手改）

### 向后兼容

无破坏性变更：既有归档目录名与索引结构保持不变；仅在目标名冲突时产生 `-2`/`-3` 新命名；`archivedPath` 字段语义不变（仍为实际归档路径）。
