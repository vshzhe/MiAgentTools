## MODIFIED Requirements

### Requirement: 归档单元执行序列

每个归档派发单元 SHALL 对其变更串行执行以下序列（顺序固定）：a) **spec 同步**——delta specs 存在时执行内联 AI 合并（ADDED/MODIFIED/REMOVED/RENAMED 四类操作直接应用到主规格 `openspec/specs/<capability>/spec.md`，遵循 v1.1.20 specs-apply 合并语义，冲突按解决顺序应用）；a.5) **CONTEXT.md 检查**（对齐本项目归档链强制检查点）——`openspec/CONTEXT.md` 存在则读 proposal.md/design.md 自动补充缺失术语，不存在则从变更制品创建，无制品则跳过并记录，失败不阻塞；a.6) **需求文档只读报告**（预归档检查点，位于目录移动**之前**）——判定范围 SHALL **仅** `openspec/changes/<change-name>/需求文档.md`（`path.join()` 构造），可同时读取该变更 `exploration.md` 的 `## 需求文档状态` 段（字段 `requirementDocStatus`）用于跨会话追溯，结果**只进入该变更的摘要报告**；MUST NOT 生成、MUST NOT 就地增量对齐、MUST NOT 委派 `iagent_requirement_doc`（`requirementDocStatus` 任一取值均只用于报告）；读取失败 SHALL 输出含路径与原因的 WARN 并继续，MUST NOT 视为需要生成；b) **执行归档**——运行 `iagent spec archive "<name>" --yes`（CLI 完成状态检查与目录移动至 `openspec/changes/archive/YYYY-MM-DD-<name>/`，保留 `.openspec.yaml` 与 `attachments/`）；b.5) **探索记忆同步**——变更目录存在 `exploration.md` 且有 delta specs 时，对每个涉及 capability 追加 `## <change-name>（归档日期 YYYY-MM-DD）` 节至 `openspec/specs/<capability>/explorations.md`（提取 Decisions/术语表/边界场景/Codebase Findings 要点，不含过程性内容；新决策与旧矛盾时以 `> 已过时（由 <change-name> 取代）` 标注而非删除；失败 WARN 继续）；c) **归档只读校验**——确认本单元未改写 `openspec/changes/archive/**` 下既有内容（本单元自身的整目录移动与 ARCHIVE-INDEX 追加除外），亦未向 `openspec/devdocs/` 写入或迁移任何 `需求文档.md`，结果记入该变更摘要；**本单元成功后清理该变更的流程级工作区**（`.openspec-tmp/pipeline-<change-name>/`，同时识别旧 `apply-` 前缀；清理失败 WARN 不中止批次；失败或跳过的单元保留工作区供诊断）；d) **结果跟踪**——记录 Success / Failed / Skipped。单元内任一步骤失败 MUST NOT 中止批次。

**归档写入面与只读护栏（强制）**：批量归档 SHALL 只能写入 `openspec/specs/**`、`openspec/CONTEXT.md` 与 `openspec/changes/archive/ARCHIVE-INDEX.md`（追加式）；`openspec/changes/**` 只允许整目录移动，MUST NOT 改写其中任何文件的既有内容。MUST NOT 修改 `openspec/changes/archive/` 下的已归档内容——整目录移动 SHALL NOT 视为改写，`ARCHIVE-INDEX.md` 的**追加**为该护栏的显式例外。流程级临时工作区 `.openspec-tmp/` 的清理不属于归档写入面（临时产物、不进提交面）。

技能的 `allowedTools` SHALL 覆盖正文实际发起的调用类别，并 MUST NOT 保留正文不再发起的条目：正文**不再委派** `iagent_requirement_doc`，故其 `allowedTools` MUST NOT 含 `Skill(iagent-requirement-doc)`（最小权限；条目存在但正文不调用属授权面虚增）；单元成功后清理流程级工作区所需的 `Bash(node:*)` SHALL 保留（真实调用支撑），MUST NOT 以 `Bash(rm:*)` 等更宽条目替代；批量并行的子代理派发条目 SHALL 经共享常量 `SUBAGENT_DISPATCH` 构造，MUST NOT 使用通配。

#### Scenario: 完整单元序列

- **WHEN** 归档单元处理变更 add-oauth（含 delta specs、exploration.md、无需求文档）
- **THEN** 依次执行：specs 内联合并 → CONTEXT.md 检查 → 需求文档只读报告（缺失 → 仅报告）→ `iagent spec archive "add-oauth" --yes` → 探索记忆同步至 specs/auth/explorations.md → 归档只读校验 → 记录 Success

#### Scenario: 需求文档存在时只报告

- **WHEN** 单元执行到 a.6 且该变更目录内已存在 `需求文档.md`（含人工填写的评审记录）
- **THEN** 摘要记录「需求文档：已存在（未改写）」，文件内容逐字不变，MUST NOT 就地增量对齐、MUST NOT 调用 `iagent_requirement_doc`

#### Scenario: 需求文档缺失时不生成

- **WHEN** 单元执行到 a.6 且该变更目录内不存在 `需求文档.md`（任一无状态或 `absent` / `generated` / `generation-failed` / `skipped-by-user`）
- **THEN** 摘要记录「需求文档：缺失」，MUST NOT 委派生成，继续 b → b.5 → c → d，MUST NOT 中止批次

#### Scenario: 不再迁出 devdocs

- **WHEN** 批次中某变更归档目录内存在 `需求文档.md`
- **THEN** `openspec/devdocs/` 不新增该文件，文件随变更目录留在 `archive/` 内，摘要中标注其保留位置

#### Scenario: 已归档内容只读

- **WHEN** 单元任一环节访问 `openspec/changes/archive/**` 下既有变更
- **THEN** 只读访问；MUST NOT 改写其既有内容（本单元整目录移动与索引追加除外），并在 c 步校验通过后记录

#### Scenario: 只读校验发现越界时告警

- **WHEN** c 步校验发现本单元改写了已归档内容或向 `devdocs/` 迁移了需求文档
- **THEN** 记录含变更名与路径的 WARN 并继续处理剩余变更，MUST NOT 中止整批，MUST NOT 静默忽略

#### Scenario: 单元成功后清理流程级工作区

- **WHEN** 某单元成功归档且 d 步记录 Success
- **THEN** 技能清理该变更的 `.openspec-tmp/pipeline-<change-name>/`（同时识别旧 `apply-` 前缀）；失败单元保留工作区供诊断，清理失败记 WARN 且不中止批次

#### Scenario: 状态读取失败不中止批次

- **WHEN** a.6 读取 `## 需求文档状态` 或检查文件存在性失败
- **THEN** 输出含路径与原因的 WARN，摘要记「状态不可读」，继续 b → b.5 → c → d，其余变更照常执行

#### Scenario: 探索记忆同步跳过

- **WHEN** 变更目录无 exploration.md
- **THEN** 记录 "Skipping exploration memory sync: no exploration file"，继续后续步骤

### Requirement: 批量索引单点更新

全部归档操作完成后（success/failed/skipped 确定），主代理 SHALL 单点更新 `openspec/changes/archive/ARCHIVE-INDEX.md`（子代理禁止）：文件不存在时按标准结构创建（归档变更列表表：归档日期/变更名称/所属模块/主要内容；模块统计表；页脚时间戳）；存在时为每个成功归档变更**追加**条目——归档日期取目录名 `YYYY-MM-DD-` 前缀、变更名取前缀后段、模块按 `{prefix}-{module}-{feature}` 模式提取（不匹配用 general）、摘要取 proposal.md 首段（≤50 字符，空则用标题）并按本项目惯例扫描 tasks.md 非 `[代码]` 类型标签追加 `[含<type1>/<type2>]` 注记；更新模块统计与页脚时间戳。

**纯追加、禁止重建（强制）**：`ARCHIVE-INDEX.md` 是追加式元数据索引，MUST NOT 被全量重建或整体覆盖。结构损坏时 SHALL 尽力解析既有条目、保留原文，并仅追加本批成功变更的最小条目，同时输出 WARN 提示人工修复（含损坏位置线索）；MUST NOT 以「无法解析」为由丢弃既有历史条目。failed/skipped 变更 MUST NOT 入索引。

#### Scenario: 索引追加与注记

- **WHEN** 成功归档变更 add-auth-pay（tasks.md 含 `[DB脚本]`、`[使用说明]` 类型任务）
- **THEN** ARCHIVE-INDEX.md 归档列表新增一行，摘要后附 `[含DB脚本/使用说明]`，模块统计相应更新

#### Scenario: 失败变更不入索引

- **WHEN** 批次中 some-change 归档失败
- **THEN** ARCHIVE-INDEX.md 不含该变更条目，失败信息在汇总中单独展示

#### Scenario: 结构损坏时只追加不重建

- **WHEN** `ARCHIVE-INDEX.md` 存在但表格结构部分损坏、无法完整解析
- **THEN** 主代理保留原文并追加本批最小条目，输出 WARN 提示人工修复，MUST NOT 重建整个文件、MUST NOT 丢弃既有历史条目
