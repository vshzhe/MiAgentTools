## MODIFIED Requirements

### Requirement: 归档单元执行序列

每个归档派发单元 SHALL 对其变更串行执行以下序列（顺序固定）：a) **spec 同步**——delta specs 存在时执行内联 AI 合并（ADDED/MODIFIED/REMOVED/RENAMED 四类操作直接应用到主规格 `openspec/specs/<capability>/spec.md`，遵循 v1.1.20 specs-apply 合并语义，冲突按解决顺序应用）；a.5) **CONTEXT.md 检查**（对齐本项目归档链强制检查点，(D4)）——写入前 MUST 先读 `openspec/CONTEXT.md`；同名术语定义不一致时 MUST 显式裁决（更新定义，或保留旧定义并标注 `已过时（由 <change-name> 取代）`），MUST NOT 静默追加第二条；取词源 SHALL 仅为该变更 `exploration.md` 术语表中已确认的术语，MUST NOT 从 proposal.md / design.md / specs 正文反向抽取；`openspec/CONTEXT.md` 不存在时，SHALL 仅用 `exploration.md` 术语表创建，术语表缺失则跳过并记 WARN，MUST NOT 从制品正文创建；`exploration.md` 或术语表缺失时跳过并记录 WARN，失败不阻塞；该步的「读取 → 比对 → 写入」SHALL 串行化，MUST NOT 与其他并行单元的 a.5 并发写同一文件；a.6) **（已移除）**：需求文档桥与只读报告已随 `skill-bridge-optimize` 整体移除；本技能不再读取、报告、生成、对齐或迁出 `需求文档.md`，该文件随变更目录原样移动；b) **执行归档**——运行 `iagent spec archive "<name>" --yes`（CLI 完成状态检查与目录移动至 `openspec/changes/archive/YYYY-MM-DD-<name>/`，保留 `.openspec.yaml` 与 `attachments/`）；b.5) **探索记忆同步**——变更目录存在 `exploration.md` 且有 delta specs 时，对每个涉及 capability 追加 `## <change-name>（归档日期 YYYY-MM-DD）` 节至 `openspec/specs/<capability>/explorations.md`（提取 Decisions/术语表/边界场景/Codebase Findings 要点，不含过程性内容；新决策与旧矛盾时以 `> 已过时（由 <change-name> 取代）` 标注而非删除；失败 WARN 继续）；c) **归档只读校验**——确认本单元未改写 `openspec/changes/archive/**` 下既有内容（本单元自身的整目录移动与 ARCHIVE-INDEX 追加除外），亦未向 `openspec/devdocs/` 写入或迁移任何 `需求文档.md`，结果记入该变更摘要；**本单元成功后清理该变更的流程级工作区**（`.openspec-tmp/pipeline-<change-name>/`，同时识别旧 `apply-` 前缀；清理失败 WARN 不中止批次；失败或跳过的单元保留工作区供诊断）；d) **结果跟踪**——记录 Success / Failed / Skipped。单元内任一步骤失败 MUST NOT 中止批次。

**归档写入面与只读护栏（强制）**：批量归档 SHALL 只能写入 `openspec/specs/**`、`openspec/CONTEXT.md` 与 `openspec/changes/archive/ARCHIVE-INDEX.md`（追加式）；`openspec/changes/**` 只允许整目录移动，MUST NOT 改写其中任何文件的既有内容。MUST NOT 修改 `openspec/changes/archive/` 下的已归档内容——整目录移动 SHALL NOT 视为改写，`ARCHIVE-INDEX.md` 的**追加**为该护栏的显式例外。流程级临时工作区 `.openspec-tmp/` 的清理不属于归档写入面（临时产物、不进提交面）。

技能的 `allowedTools` SHALL 覆盖正文实际发起的调用类别，并 MUST NOT 保留正文不再发起的条目：正文**不再委派** `iagent_requirement_doc`，故其 `allowedTools` MUST NOT 含 `Skill(iagent-requirement-doc)`（最小权限；条目存在但正文不调用属授权面虚增）；单元成功后清理流程级工作区所需的 `Bash(node:*)` SHALL 保留（真实调用支撑），MUST NOT 以 `Bash(rm:*)` 等更宽条目替代；批量并行的子代理派发条目 SHALL 经共享常量 `SUBAGENT_DISPATCH` 构造，MUST NOT 使用通配。

#### Scenario: 完整单元序列

- **WHEN** 归档单元处理变更 add-oauth（含 delta specs、exploration.md、无需求文档）
- **THEN** 依次执行：specs 内联合并 → CONTEXT.md 检查 → `iagent spec archive "add-oauth" --yes` → 探索记忆同步至 specs/auth/explorations.md → 归档只读校验 → 记录 Success

#### Scenario: a.6 已移除

- **WHEN** 单元执行到 a.6
- **THEN** 该步 SHALL 仅为「已移除」声明，不读取、不报告、不生成、不对齐、不迁出 `需求文档.md`
- **AND** `需求文档.md` SHALL 随变更目录原样移动，MUST NOT 委派 `iagent_requirement_doc`

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

#### Scenario: 探索记忆同步跳过

- **WHEN** 变更目录无 exploration.md
- **THEN** 记录 "Skipping exploration memory sync: no exploration file"，继续后续步骤

#### Scenario: CONTEXT.md 不存在时仅从 exploration 创建

- **WHEN** 归档单元执行 a.5 且 `openspec/CONTEXT.md` 不存在
- **THEN** SHALL 仅用该变更 `exploration.md` 术语表创建
- **AND** 术语表缺失时 SHALL 跳过并记 WARN，MUST NOT 从 proposal / design / specs 正文创建

#### Scenario: a.5 取词口径收窄

- **WHEN** 归档单元执行 a.5 且该变更的 proposal.md / design.md 中存在 exploration.md 术语表未收录的技术词
- **THEN** 该词 MUST NOT 被写入 `openspec/CONTEXT.md`
- **AND** 仅 `exploration.md` 术语表中已确认的术语 SHALL 被同步

#### Scenario: 并行单元 a.5 写入串行化

- **WHEN** 批次中 2 个以上并行归档单元的 a.5 都要写同一 `openspec/CONTEXT.md`
- **THEN** 这些 a.5 写入步 SHALL 串行执行（同一批次锁或排队）
- **AND** MUST NOT 因并发导致任一单元的术语写入丢失或被覆盖
