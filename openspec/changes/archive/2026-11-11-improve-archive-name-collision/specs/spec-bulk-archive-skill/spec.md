## MODIFIED Requirements

### Requirement: 三阶段分层并行归档执行

批量执行 SHALL 按冲突检测结果分组：无共享 capability 的变更构成并行组（组内每变更一个归档子代理作为完整派发单元）；共享 capability 的变更构成串行链（按解决的时间顺序执行）。并发归档子代理上限为 3（固定值）。单变更选择时直接执行不派发；全部共享同一 capability 时为单串行链。运行时不支持子代理时 SHALL 降级为全串行执行并告知用户。子代理 MUST NOT 更新 ARCHIVE-INDEX.md 且 MUST NOT 运行 `codegraph sync`（两者均为主代理单点操作）。单变更失败（含子代理失败或超时）SHALL 记录 WARN 并继续剩余变更（失败隔离，绝不中止批次）；串行链前驱失败时后继仍执行（每变更独立合并主规格）。**归档目标名冲突 SHALL NOT 构成失败**：CLI 唯一化后该单元 SHALL 记为 Success，并以实际归档目录（含 `-2` / `-3` 后缀）为后续索引与摘要的事实来源。

#### Scenario: 并行组执行

- **WHEN** 3 个选中变更无共享 capability 且支持子代理
- **THEN** 3 个归档子代理并发执行（各含 specs 同步 → CONTEXT.md 检查 → CLI 归档 → 探索记忆同步）

#### Scenario: 串行链执行

- **WHEN** 2 个变更共享 capability auth（已裁决按时间序）
- **THEN** 该两变更串行执行（先裁决序在前者）

#### Scenario: 失败隔离

- **WHEN** 某变更归档因命名冲突以外的原因失败（如子代理超时、目录不可写）
- **THEN** 该变更记为 Failed，其余变更继续执行，批次不中止

#### Scenario: 同名冲突不构成失败

- **WHEN** 批次中某变更的归档目标名已存在，CLI 返回唯一化后的 `<今日>-<name>-2`
- **THEN** 该单元 SHALL 记为 Success 并记录实际归档路径
- **AND** MUST NOT 记为 Failed，MUST NOT 中止该单元后续步骤（探索记忆同步 / 只读校验 / 清理）

## ADDED Requirements

### Requirement: 唯一化后缀归档条目的一致记录

批量索引 SHALL 对带 `-<数字>` 唯一化后缀的归档目录按同一口径记录：「变更名称」列 MUST 取目录名去掉 `YYYY-MM-DD-` 前缀后的全段（含后缀）；按 `{prefix}-{module}-{feature}` 提取模块前 MUST 先剥离尾部 `-<数字>` 后缀。

#### Scenario: 带后缀条目入索引

- **WHEN** 成功归档目录名为 `<YYYY-MM-DD>-improve-x-2`
- **THEN** 月度索引「变更名称」列 SHALL 记录 `improve-x-2`
- **AND** 「归档日期」SHALL 取前 10 位，「模块」SHALL 按剥离后缀后的 `improve-x` 提取

#### Scenario: 后缀不影响统计重算

- **WHEN** 根入口从月度文件确定性重算全局模块统计
- **THEN** 带后缀条目的模块归属 SHALL 与不带后缀的同名条目一致
- **AND** MUST NOT 因后缀产生新的模块行
