## MODIFIED Requirements

### Requirement: 批量索引单点更新

全部归档操作完成后（success/failed/skipped 确定），主代理 SHALL 单点更新**分片归档索引**（子代理禁止 (D8)）：按每个成功变更的归档目录名 `YYYY-MM-DD-` 前缀前 7 位分组，分别更新对应的月度索引 `openspec/changes/archive/ARCHIVE-INDEX-YYYY-MM.md`，并在完成后更新根入口 `openspec/changes/archive/ARCHIVE-INDEX.md` 的月份导航与全局模块统计 (D1/D2/D4)。

**月度索引写入规则（强制）**：月度索引不存在时 SHALL 按标准结构创建（当月归档变更列表表：归档日期/变更名称/所属模块/主要内容；当月模块统计表；页脚时间戳）；存在时为每个成功归档变更**追加**条目——归档日期取目录名 `YYYY-MM-DD-` 前缀、变更名取前缀后段、模块按 `{prefix}-{module}-{feature}` 模式提取（不匹配用 general）、摘要取 proposal.md 首段（≤50 字符，空则用标题）并按本项目惯例扫描 tasks.md 非 `[代码]` 类型标签追加 `[含<type1>/<type2>]` 注记；更新当月模块统计与页脚时间戳。

**根入口写入规则（强制）(D1)**：根入口 SHALL 仅追加缺失的月份链接（已存在则跳过），并依据全部月度文件确定性重算全局模块统计；MUST NOT 改写根入口既有条目。根入口缺失但存在月度文件时 SHALL 依据月度文件重建入口并在批量汇总中报告；根入口损坏时 SHALL 保留原文并只补缺失月份链接 + WARN。

**纯追加、禁止重建（强制）(D5)**：任何索引文件（根入口与月度索引）MUST NOT 被全量重建或整体覆盖。月度索引结构损坏时 SHALL 尽力解析既有条目、保留原文，并仅追加本批成功变更的最小条目，同时输出 WARN 提示人工修复（含损坏位置线索）；MUST NOT 以「无法解析」为由丢弃既有历史条目。failed/skipped 变更 MUST NOT 入索引，也不得参与统计重算。

#### Scenario: 跨月批量归档分别写入各自月度文件

- **WHEN** 同一批次成功归档的变更分别位于 `2026-09-11-add-a/` 与 `2026-10-10-add-b/`
- **THEN** 主代理分别向 `ARCHIVE-INDEX-2026-09.md` 与 `ARCHIVE-INDEX-2026-10.md` 追加各自条目
- **AND** 根入口月份导航包含 `2026-09` 与 `2026-10` 两个链接

#### Scenario: 月度索引追加与注记

- **WHEN** 成功归档变更 add-auth-pay（tasks.md 含 `[DB脚本]`、`[使用说明]` 类型任务）
- **THEN** 该月 `ARCHIVE-INDEX-YYYY-MM.md` 归档列表新增一行，摘要后附 `[含DB脚本/使用说明]`，当月模块统计相应更新

#### Scenario: 失败变更不入索引

- **WHEN** 批次中 some-change 归档失败或被跳过
- **THEN** 任何月度索引均不含该变更条目，失败信息在汇总中单独展示，统计不包含该变更

#### Scenario: 月度索引结构损坏时只追加不重建

- **WHEN** 当月 `ARCHIVE-INDEX-YYYY-MM.md` 存在但表格结构部分损坏、无法完整解析
- **THEN** 主代理保留原文并追加本批最小条目，输出 WARN 提示人工修复，MUST NOT 重建整个文件、MUST NOT 丢弃既有历史条目

#### Scenario: 全局统计由月度文件确定性重算

- **WHEN** 根入口需要更新全局模块统计
- **THEN** 主代理只读全部 `ARCHIVE-INDEX-*.md` 月度文件并确定性重算统计，不使用增量累加
- **AND** 某个月度文件不可解析时跳过该月并记 WARN
