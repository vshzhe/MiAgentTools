## ADDED Requirements

### Requirement: 归档目标名冲突时确定性唯一化

`iagent spec archive` 解析归档目标名时 SHALL 采用确定性唯一化：候选名 `archive/YYYY-MM-DD-<change-name>` 已被占用时，依次追加 `-2`、`-3`…（自 2 起递增）直至目标不存在。唯一化 MUST 在目标名解析的单一真源（`resolveTargetPath`）内完成，`previewArchive` 与 `executeArchive` MUST 使用同一结果。CLI MUST NOT 覆盖、删除、合并或改写既有归档目录。变更名已含 `YYYY-MM-DD-` 前缀时 MUST NOT 叠加日期前缀。唯一化尝试上限为 99 次，超出 SHALL 抛错并给出最后一个候选路径。

#### Scenario: 目标未占用时保持既有命名

- **WHEN** `openspec/changes/archive/<今日>-improve-x/` 不存在且变更名为 `improve-x`
- **THEN** CLI SHALL 归档至 `openspec/changes/archive/<今日>-improve-x/`
- **AND** 返回的 `archivedPath` SHALL 等于该路径

#### Scenario: 目标已占用时追加数字后缀

- **WHEN** `openspec/changes/archive/<今日>-improve-x/` 已存在
- **THEN** CLI SHALL 归档至 `openspec/changes/archive/<今日>-improve-x-2/`
- **AND** 若 `-2` 也已存在 SHALL 递增至 `-3`，以此类推
- **AND** 既有 `-2` / `-3` 目录内容 MUST NOT 被修改或删除

#### Scenario: 变更名自带日期前缀时冲突仍可归档

- **WHEN** 变更名为 `2026-11-01-improve-x` 且 `archive/2026-11-01-improve-x/` 已存在
- **THEN** CLI MUST NOT 叠加今日日期前缀，而 SHALL 归档至 `archive/2026-11-01-improve-x-2/`

#### Scenario: 预览与执行目标一致

- **WHEN** 目标名冲突存在且调用方先 `previewArchive` 再 `executeArchive`
- **THEN** 预览返回的 `targetPath` SHALL 等于实际移动到的路径（含唯一化后缀）

#### Scenario: 唯一化尝试超限时报错

- **WHEN** `-2` 至 `-100` 全部被占用
- **THEN** CLI SHALL 抛错并列出最后一个候选路径
- **AND** MUST NOT 移动变更目录，源目录保留

#### Scenario: 既有归档只读

- **WHEN** 唯一化过程中遇到已存在的归档目录
- **THEN** CLI SHALL 仅探测其存在性，MUST NOT 写入、清空或删除其中任何文件
