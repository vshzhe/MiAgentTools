## MODIFIED Requirements

### Requirement: spec-archive 归档技能

spec-archive 技能 SHALL 实现归档工作流：检查 CONTEXT.md 术语同步（不存在则创建）→ 从变更的 exploration.md 提取决策/术语/边界场景并追加到 `openspec/specs/<capability>/explorations.md`（冲突标记“已过时”但保留历史）→ 执行状态感知的预归档需求文档检查点 → AI 智能合并 delta spec 到主 spec（ADDED/MODIFIED/REMOVED/RENAMED）→ 调用 `iagent spec archive` 移动目录 → 迁移需求文档至 devdocs → CodeGraph 增量同步（失败仅 WARN、不阻断）。

预归档需求文档检查点 SHALL 在探索记忆同步之后、目录移动之前执行，范围仅为变更目录内 `需求文档.md`，并同时读取该变更 `exploration.md` 的 `## 需求文档状态` 段（字段 `requirementDocStatus`，取值 `skipped-by-user` / `generation-failed` / `generated`，无该段为 `absent`；定义见 `host-orchestration / 需求文档状态跨阶段 handoff`）。持久记录用于跨会话 archive；回执缺失时仍须读取持久记录。

- **文档已存在（任何状态）**：对 `## 基本信息` 与 `## 八、评审记录` 人工域逐字保护，对第一至七章按当前制品就地增量对齐；MUST NOT 调用会静默覆盖目标文件的 `iagent_requirement_doc`。文件存在优先于状态，`skipped-by-user` 亦同。
- **状态为 `skipped-by-user` 且文档缺失**：报告用户已选择跳过并继续归档，MUST NOT 自动生成。
- **状态为 `generation-failed` 且文档缺失**：输出 WARN 并继续归档，MUST NOT 静默重试生成。
- **状态为 `generated` 且文档缺失**：输出 WARN（"曾生成但文件缺失"）并继续归档，MUST NOT 重新生成。
- **没有显式需求文档状态（`absent`）的历史变更且文档缺失**：保留既有向后兼容行为，非交互委派 `iagent_requirement_doc`。
- **状态或文档存在性读取 I/O 失败**：MUST 自动重试同一读取一次；仍失败时 MUST NOT 视为 `absent`、MUST NOT 生成文档（文档存在时仍按已存在分支对齐），输出含目标路径与原因的 WARN 与恢复指引并继续归档。
- 生成、对齐或检查失败 SHALL 记录 WARN（含原因）并继续归档；不得因需求文档操作而静默宣称成功。

生成落点仍为变更目录内的 `需求文档.md`；目录归档后由既有迁移步骤原样移动至 `openspec/devdocs/`。

#### Scenario: 用户跳过且文档缺失时不补生成

- **WHEN** archive 读取到 `skipped-by-user` 且变更目录内没有 `需求文档.md`
- **THEN** 输出跳过说明、MUST NOT 调用 `iagent_requirement_doc`，并继续归档

#### Scenario: 用户跳过但文档已存在时对齐

- **WHEN** 状态为 `skipped-by-user` 且变更目录内已有需求文档
- **THEN** archive 就地增量对齐第一至七章，逐字保留 `## 基本信息` 与 `## 八、评审记录`，MUST NOT 调用会覆盖文件的生成技能

#### Scenario: 生成失败状态不静默重试

- **WHEN** archive 读取到 `generation-failed` 且需求文档缺失
- **THEN** 输出 WARN 并继续归档，MUST NOT 再次委派 `iagent_requirement_doc`

#### Scenario: 已生成状态但文档缺失不重建

- **WHEN** 状态为 `generated` 且变更目录内不存在 `需求文档.md`
- **THEN** 输出含原因的 WARN（"曾生成但文件缺失"）并继续归档，MUST NOT 重新委派 `iagent_requirement_doc`

#### Scenario: 状态读取重试一次后失败不落入兼容生成

- **WHEN** 检查点读取 `## 需求文档状态` 首次失败且自动重试一次仍失败
- **THEN** 系统 MUST NOT 按 `absent` 处理、MUST NOT 委派生成；文档缺失时输出 WARN 与恢复指引并继续归档

#### Scenario: 历史变更无状态时兼容生成

- **WHEN** 既有历史变更没有显式需求文档状态且需求文档缺失
- **THEN** archive 保留既有兼容行为，非交互委派 `iagent_requirement_doc`；失败记录 WARN 后继续

#### Scenario: 文档存在时人工域受保护

- **WHEN** archive 对任一状态的变更发现需求文档已存在
- **THEN** `## 基本信息` 与 `## 八、评审记录` 逐字不变，第一至七章按当前制品增量对齐，不删除章节（仅制品已移除的内容可删）

#### Scenario: archive 单独调用时读取持久状态

- **WHEN** 用户在另一个会话或稍后单独调用 archive，调用回执未携带文档选择状态
- **THEN** archive 从变更 `exploration.md` 读取持久状态并按其分流，不因新会话而退回历史兼容生成分支

#### Scenario: 需求文档处理失败不阻断归档

- **WHEN** 需求文档增量对齐或历史兼容生成失败
- **THEN** 技能输出包含原因的 WARN 并继续目录归档，MUST NOT 丢失归档结果或伪报文档已对齐

#### Scenario: 探索记忆同步

- **WHEN** 变更含 exploration.md 且其 Decisions 与能力级 explorations.md 的既有决策冲突
- **THEN** 旧决策标记为"已过时（由 <change-name> 取代）"保留，新决策追加，历史不被删除

#### Scenario: delta spec 智能合并

- **WHEN** 变更的 specs/<capability>/spec.md 含 ADDED 与 MODIFIED 需求
- **THEN** 技能将 ADDED 需求追加到主 spec、MODIFIED 需求更新对应条目，再执行 iagent spec archive 移动

#### Scenario: CodeGraph 同步非阻塞

- **WHEN** 归档后 codegraph sync 执行失败
- **THEN** 输出 WARN 日志继续完成归档流程，不回滚
