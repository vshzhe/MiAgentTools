## ADDED Requirements

### Requirement: 模板定义与注册
系统 SHALL 提供批量归档工作流模板 `src/core/templates/workflows/spec-bulk-archive.ts`，导出成对工厂函数 `getSpecBulkArchiveSkillTemplate()`（返回 SkillTemplate：name `venus_spec_bulk_archive`、type `'spec'`、含 allowedTools 白名单）与 `getSpecBulkArchiveCommandTemplate()`（返回 CommandTemplate：name `Venus: 批量归档`）。两者正文 MUST 为同一份 11 步批量归档工作流指令文本。系统 SHALL 在 `registry.ts` 的 `WORKFLOW_PAIRS` 中注册该成对模板（spec-archive 之后），skill 名 `venus_spec_bulk_archive` 经 `deriveCommandId` 自动派生命令 id `spec-bulk-archive`。

#### Scenario: 注册后自动纳入全链路
- **WHEN** `WORKFLOW_PAIRS` 注册 `venus_spec_bulk_archive` 成对模板后运行 `listAllWorkflowIds()`
- **THEN** 返回列表包含 `spec-bulk-archive`；`venus init` / `venus update` 在生效集含该项时生成对应 SKILL.md 与 `.claude/commands/venus/spec-bulk-archive.md`

#### Scenario: 指令 id 派生正确
- **WHEN** 对技能名 `venus_spec_bulk_archive` 执行 `deriveCommandId`
- **THEN** 派生结果为 `spec-bulk-archive`（下划线转连字符，去 venus 前缀）

### Requirement: 活跃变更发现与 CLI 降级
工作流 SHALL 通过 `venus spec status --json`（无 --change 参数，列全部活跃变更）获取待归档候选；无活跃变更时 SHALL 提示用户并停止。CLI 调用失败时 SHALL 按错误签名分类处理：命令未找到签名（"command not found" / "不是内部或外部命令" / "not recognized"）MUST 进入 CLI 降级模式（Glob 扫描 `openspec/changes/*/` 排除 `archive/` 发现候选 + 按文件存在推断制品状态，批量归档本体照常执行，流程结束一次性提醒安装 CLI）；其他错误（如 JSON 解析失败）MUST 报错并停止，不进入降级。

#### Scenario: 正常获取活跃变更
- **WHEN** 工作流步骤 1 执行 `venus spec status --json` 且存在 3 个活跃变更
- **THEN** 候选列表为该 3 个变更（排除已归档项）

#### Scenario: 无活跃变更
- **WHEN** `venus spec status --json` 返回空变更列表
- **THEN** 提示"No active changes"并停止流程

#### Scenario: CLI 未安装降级
- **WHEN** `venus` 命令调用失败且错误为命令未找到签名
- **THEN** 以一行提示进入降级模式：Glob 扫描 `openspec/changes/*/`（排除 `archive/`）发现候选变更，由用户继续多选，归档本体（目录移动、spec 同步、索引更新）正常执行，流程结束提醒一次建议安装 CLI

#### Scenario: 其他错误不降级
- **WHEN** CLI 调用失败且错误为 JSON 解析失败（非命令未找到签名）
- **THEN** 报告错误并停止，不进入降级模式

### Requirement: 用户多选
工作流 SHALL 使用 AskUserQuestion 工具（multi-select）让用户选择要归档的变更：展示每个变更的 schema、提供"All changes"选项、允许任意数量选择（1+ 可用，2+ 为典型场景）。系统 MUST NOT 自动选择。

#### Scenario: 多选交互
- **WHEN** 流程进入变更选择步骤
- **THEN** 以 multi-select 呈现全部候选变更（含 schema 标注与"All changes"选项），等待用户显式勾选，不预选任何变更

### Requirement: CodeGraph 批量预检
批量验证前工作流 SHALL 执行 status-first 检测：运行 `codegraph status`（Bash）作为唯一检测步骤，MUST NOT 用 Glob 预检 `.codegraph/` 目录（点前缀目录返回假阴性）。检测成功 SHALL 记录当前索引统计（file/node 数）供后续对比；检测失败（CLI 不在 PATH 或任何错误）SHALL 自动跳过全部 CodeGraph 步骤（本次预检与步骤 11 的批量同步）并记录 WARN，MUST NOT 询问用户是否重试。

#### Scenario: 预检成功
- **WHEN** `codegraph status` 调用成功
- **THEN** 记录索引统计，继续批量验证，后续批量同步步骤启用

#### Scenario: 预检失败自动跳过
- **WHEN** `codegraph status` 调用失败（CLI 不在 PATH）
- **THEN** 记录 WARN 并跳过全部 CodeGraph 步骤（预检 + 步骤 11 同步），直接继续批量归档，不向用户询问

### Requirement: 批量状态收集
对每个选中变更，工作流 SHALL 收集三项状态：a) 制品状态（`venus spec status --change "<name>" --json`，解析 `schemaName`/`artifacts`/`planningHome`/`changeRoot`/`artifactPaths`/`actionContext`，标注 done 与非 done）；b) 任务完成度（读 tasks 文件，统计 `- [ ]` 与 `- [x]` 计数，无文件记 "No tasks"）；c) delta specs（列 capability 规格清单，提取 `### Requirement: <name>` 需求名）。任何选中变更报告 `actionContext.mode: "workspace-planning"` 时 SHALL 解释 workspace 批量归档不支持并停止。2+ 变更且运行时支持子代理时 SHOULD 每变更派发一个只读验证子代理（最多 3 个并发）；子代理仅读文件与查询状态，失败时主代理串行补收该变更状态。

#### Scenario: 三要素收集
- **WHEN** 对选中变更 add-oauth 执行状态收集
- **THEN** 输出包含制品状态（如 4/4 done）、任务计数（如 5/5）、delta specs 清单（如 specs/auth/spec.md 含 2 个 Requirement）

#### Scenario: workspace 变更停止
- **WHEN** 任一选中变更的 `actionContext.mode` 为 `"workspace-planning"`
- **THEN** 解释 workspace 批量归档在本切片不支持，停止（不做 spec 同步、不移动变更）

#### Scenario: 并行验证派发
- **WHEN** 选中 4 个变更且运行时支持子代理
- **THEN** 派发只读验证子代理（并发上限 3），全部返回后合并为统一状态表

#### Scenario: 子代理失败补收
- **WHEN** 某变更的验证子代理失败
- **THEN** 主代理串行收集该变更状态，批次不中止

### Requirement: spec 冲突检测与智能解决
工作流 SHALL 构建 `capability -> [changes]` 映射：2+ 选中变更的 delta specs 触碰同一 capability 即为冲突。对每个冲突，SHALL 读取各冲突变更的 delta specs 理解其新增/修改声明，并搜索代码库实现证据（实现文件、函数、测试）后三分支裁决：仅一方实现 → 只同步该变更的 specs；双方都实现 → 按时间顺序应用（旧先新后，新者覆盖）；都未实现 → 跳过 spec 同步并警告用户。每次裁决 SHALL 记录：应用哪个变更的 specs、顺序（若双实现）、代码库证据理由。2+ 独立冲突且可派子代理时 SHOULD 每冲突派发一个只读调查子代理并行执行，失败时主代理串行补查。

#### Scenario: 冲突检测
- **WHEN** add-oauth 与 add-jwt 的 delta specs 均触碰 specs/auth/spec.md
- **THEN** capability auth 标记为冲突，进入智能解决流程

#### Scenario: 仅一方实现
- **WHEN** 冲突调查发现 add-oauth 有实现证据（src/auth/oauth.ts 存在）而 add-jwt 无实现
- **THEN** 仅同步 add-oauth 的 specs，add-jwt 跳过同步

#### Scenario: 双实现按时间序
- **WHEN** 冲突双方 add-rest-api（创建 2026-01-10）与 add-graphql（创建 2026-01-15）均有实现证据
- **THEN** 先应用 add-rest-api 再应用 add-graphql（新者覆盖旧者）

#### Scenario: 都未实现
- **WHEN** 冲突双方均未在代码库找到实现证据
- **THEN** 跳过该 capability 的 spec 同步并向用户发出警告

### Requirement: 合并状态表与直接执行
状态收集与冲突解决完成后，工作流 SHALL 显示合并状态表（列：Change / Artifacts / Tasks / Specs / Conflicts / Status），冲突项标注解决方案，不完整变更标注警告。展示后 SHALL 直接进入批量执行，MUST NOT 再次请求确认（步骤 2 的多选即用户的范围决策）。不完整变更 SHALL 带警告归档（警告仅为提示，不构成跳过选中变更的理由）。

#### Scenario: 状态表展示后直接执行
- **WHEN** 合并状态表展示完成
- **THEN** 不出现二次确认提示，直接进入批量执行

#### Scenario: 不完整变更带警告归档
- **WHEN** 选中变更 add-verify-skill 有 1 个未完成制品与 3 个未完成任务
- **THEN** 状态表标注 Warn，该变更仍被归档并在汇总中列出警告

### Requirement: 三阶段分层并行归档执行
批量执行 SHALL 按冲突检测结果分组：无共享 capability 的变更构成并行组（组内每变更一个归档子代理作为完整派发单元）；共享 capability 的变更构成串行链（按解决的时间顺序执行）。并发归档子代理上限为 3（固定值）。单变更选择时直接执行不派发；全部共享同一 capability 时为单串行链。运行时不支持子代理时 SHALL 降级为全串行执行并告知用户。子代理 MUST NOT 更新 ARCHIVE-INDEX.md 且 MUST NOT 运行 `codegraph sync`（两者均为主代理单点操作）。单变更失败（含子代理失败或超时）SHALL 记录 WARN 并继续剩余变更（失败隔离，绝不中止批次）；串行链前驱失败时后继仍执行（每变更独立合并主规格）。

#### Scenario: 并行组执行
- **WHEN** 3 个选中变更无共享 capability 且支持子代理
- **THEN** 3 个归档子代理并发执行（各含 specs 同步 → 探索记忆 → CLI 归档 → 需求文档迁移）

#### Scenario: 串行链执行
- **WHEN** 2 个变更共享 capability auth（已裁决按时间序）
- **THEN** 该两变更串行执行（先裁决序在前者）

#### Scenario: 失败隔离
- **WHEN** 某变更归档失败（如归档目标目录已存在）
- **THEN** 该变更记为 Failed，其余变更继续执行，批次不中止

### Requirement: 归档单元执行序列
每个归档派发单元 SHALL 对其变更串行执行以下序列（顺序固定）：a) **spec 同步**——delta specs 存在时执行内联 AI 合并（ADDED/MODIFIED/REMOVED/RENAMED 四类操作直接应用到主规格 `openspec/specs/<capability>/spec.md`，遵循 v1.1.20 specs-apply 合并语义，冲突按解决顺序应用）；a.5) **CONTEXT.md 检查**（对齐本项目归档链强制检查点）——`openspec/CONTEXT.md` 存在则读 proposal.md/design.md 自动补充缺失术语，不存在则从变更制品创建，无制品则跳过并记录，失败不阻塞；b) **执行归档**——运行 `venus spec archive "<name>" --yes`（CLI 完成状态检查与目录移动至 `openspec/changes/archive/YYYY-MM-DD-<name>/`，保留 `.openspec.yaml` 与 `attachments/`）；b.5) **探索记忆同步**——变更目录存在 `exploration.md` 且有 delta specs 时，对每个涉及 capability 追加 `## <change-name>（归档日期 YYYY-MM-DD）` 节至 `openspec/specs/<capability>/explorations.md`（提取 Decisions/术语表/边界场景/Codebase Findings 要点，不含过程性内容；新决策与旧矛盾时以 `> 已过时（由 <change-name> 取代）` 标注而非删除；失败 WARN 继续）；c) **需求文档迁移**——归档后存在 `需求文档.md` 则移动至 `openspec/devdocs/YYYY-MM-DD-<change-name>-需求文档.md`（目录名无日期前缀时回退无时间戳路径；目标存在则覆盖；失败 WARN 继续；不存在则静默跳过）；d) **结果跟踪**——记录 Success / Failed / Skipped。单元内任一步骤失败 MUST NOT 中止批次。

#### Scenario: 完整单元序列
- **WHEN** 归档单元处理变更 add-oauth（含 delta specs、exploration.md、需求文档.md）
- **THEN** 依次执行：specs 内联合并 → CONTEXT.md 检查 → `venus spec archive "add-oauth" --yes` → 探索记忆同步至 specs/auth/explorations.md → 需求文档迁移至 devdocs → 记录 Success

#### Scenario: 探索记忆同步跳过
- **WHEN** 变更目录无 exploration.md
- **THEN** 记录 "Skipping exploration memory sync: no exploration file"，继续后续步骤

### Requirement: 批量索引单点更新
全部归档操作完成后（success/failed/skipped 确定），主代理 SHALL 单点更新 `openspec/changes/archive/ARCHIVE-INDEX.md`（子代理禁止）：文件不存在时按标准结构创建（归档变更列表表：归档日期/变更名称/所属模块/主要内容；模块统计表；页脚时间戳）；存在时为每个成功归档变更追加条目——归档日期取目录名 `YYYY-MM-DD-` 前缀、变更名取前缀后段、模块按 `{prefix}-{module}-{feature}` 模式提取（不匹配用 general）、摘要取 proposal.md 首段（≤50 字符，空则用标题）并按本项目惯例扫描 tasks.md 非 `[代码]` 类型标签追加 `[含<type1>/<type2>]` 注记；更新模块统计与页脚时间戳。结构损坏时 SHALL 尝试解析既有条目，完全失败则重建（含本批全部成功变更）。failed/skipped 变更 MUST NOT 入索引。

#### Scenario: 索引追加与注记
- **WHEN** 成功归档变更 add-auth-pay（tasks.md 含 `[DB脚本]`、`[使用说明]` 类型任务）
- **THEN** ARCHIVE-INDEX.md 归档列表新增一行，摘要后附 `[含DB脚本/使用说明]`，模块统计相应更新

#### Scenario: 失败变更不入索引
- **WHEN** 批次中 some-change 归档失败
- **THEN** ARCHIVE-INDEX.md 不含该变更条目，失败信息在汇总中单独展示

### Requirement: CodeGraph 批量同步与验证
当且仅当批量预检确认 CodeGraph 可用且至少一个变更成功归档时，主代理 SHALL 在索引更新后执行单次项目级 `codegraph sync`（MUST NOT 逐变更同步——知识图谱数据库需免并发写），随后以 MCP `codegraph_search` 单次查询本批成功变更的变更名与关键符号（取自各变更 tasks.md/design.md）验证索引，显示匹配计数；无匹配时 WARN（非代码变更可预期）。同步失败（CLI 错误、超时、不在 PATH）SHALL 记录警告且 MUST NOT 阻塞批量归档。部分成功（≥1 成功）仍触发同步。

#### Scenario: 单次项目级同步
- **WHEN** 预检通过且 3 个变更全部成功归档
- **THEN** 主代理运行 `codegraph sync` 恰一次，随后单次 `codegraph_search` 验证并显示 "✓ symbols verified in index"

#### Scenario: 同步失败不阻塞
- **WHEN** `codegraph sync` 执行超时
- **THEN** 记录 WARN，批量归档汇总与索引更新不受影响

### Requirement: 批量归档汇总输出
全部步骤完成后工作流 SHALL 显示汇总：成功归档清单（变更 → 归档路径）、跳过清单（含原因）、失败清单（含错误）、spec 同步摘要（同步数、冲突解决数）、探索记忆摘要（同步/跳过/失败计数）、并行执行统计（并行组数/串行链数）、CodeGraph 状态（✓ Synced / Not initialized — skipped / Sync skipped due to error）。无活跃变更时输出 "No Changes to Archive"。

#### Scenario: 成功汇总
- **WHEN** 3 个变更全部成功归档且 1 个冲突已解决
- **THEN** 汇总含 3 条归档路径、spec 同步摘要（含 1 conflict resolved）、探索记忆摘要、CodeGraph 状态行
