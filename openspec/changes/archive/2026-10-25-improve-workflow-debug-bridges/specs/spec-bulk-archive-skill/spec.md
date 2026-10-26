## MODIFIED Requirements

### Requirement: 归档单元执行序列

每个归档派发单元 SHALL 对其变更串行执行以下序列（顺序固定）：a) **spec 同步**——delta specs 存在时执行内联 AI 合并（ADDED/MODIFIED/REMOVED/RENAMED 四类操作直接应用到主规格 `openspec/specs/<capability>/spec.md`，遵循 v1.1.20 specs-apply 合并语义，冲突按解决顺序应用）；a.5) **CONTEXT.md 检查**（对齐本项目归档链强制检查点）——`openspec/CONTEXT.md` 存在则读 proposal.md/design.md 自动补充缺失术语，不存在则从变更制品创建，无制品则跳过并记录，失败不阻塞；a.6) **需求文档检查点**（预归档检查点，在目录移动**之前**执行）——判定范围 SHALL **仅** `openspec/changes/<change-name>/需求文档.md`（`path.join()` 构造），并同时读取该变更 `exploration.md` 的 `## 需求文档状态` 段（字段 `requirementDocStatus`，取值 `skipped-by-user` / `generation-failed` / `generated`，无该段为 `absent`；语义与优先级见 `host-orchestration / 需求文档状态跨阶段 handoff`）：**文档已存在（任何状态）** → 执行**就地增量对齐更新**（`## 基本信息` 与 `## 八、评审记录` 为人工域 MUST NOT 覆盖，`一~七` 章节按当前制品重新派生；本分支 MUST NOT 调用该技能，其"静默覆盖"规则会抹掉人工内容；就地对齐 MUST NOT 删除章节，格式破损时补建并记 WARN）；**文档缺失且 `skipped-by-user`** → 记录跳过并继续，MUST NOT 委派生成；**缺失且 `generation-failed`** → 输出 WARN 且不重试；**缺失且 `generated`** → 输出 WARN（"曾生成但文件缺失"）且不重新生成；**缺失且 `absent`** → 经 Skill 工具非交互委派 `iagent_requirement_doc` 生成（历史兼容）；**状态或文件存在性读取 I/O 失败** → MUST 自动重试同一读取一次，仍失败时 MUST NOT 视为 `absent`、MUST NOT 生成（文档存在时仍按已存在分支对齐），输出含路径与原因的 WARN 与恢复指引；上述各分支失败均 SHALL 记录 WARN（含原因）并**继续该变更的后续步骤**，MUST NOT 中止批次；b) **执行归档**——运行 `iagent spec archive "<name>" --yes`（CLI 完成状态检查与目录移动至 `openspec/changes/archive/YYYY-MM-DD-<name>/`，保留 `.openspec.yaml` 与 `attachments/`）；b.5) **探索记忆同步**——变更目录存在 `exploration.md` 且有 delta specs 时，对每个涉及 capability 追加 `## <change-name>（归档日期 YYYY-MM-DD）` 节至 `openspec/specs/<capability>/explorations.md`（提取 Decisions/术语表/边界场景/Codebase Findings 要点，不含过程性内容；新决策与旧矛盾时以 `> 已过时（由 <change-name> 取代）` 标注而非删除；失败 WARN 继续）；c) **需求文档迁移**——归档后存在 `需求文档.md` 则移动至 `openspec/devdocs/YYYY-MM-DD-<change-name>-需求文档.md`（目录名无日期前缀时回退无时间戳路径；目标存在则覆盖；失败 WARN 继续；不存在则静默跳过）；d) **结果跟踪**——记录 Success / Failed / Skipped。单元内任一步骤失败 MUST NOT 中止批次。

技能的 `allowedTools` SHALL 覆盖正文实际发起的调用类别；由于正文经 Skill 工具委派 `iagent_requirement_doc`，其 `allowedTools` MUST 含精确条目 `Skill(requirement_doc)`（**裸技能名**，去 `iagent_` 前缀；MUST NOT 使用 `Skill(*)` 通配）。

#### Scenario: 完整单元序列
- **WHEN** 归档单元处理变更 add-oauth（含 delta specs、exploration.md、无需求文档、状态为 `absent`）
- **THEN** 依次执行：specs 内联合并 → CONTEXT.md 检查 → 需求文档检查点（`absent` 缺失 → 生成）→ `iagent spec archive "add-oauth" --yes` → 探索记忆同步至 specs/auth/explorations.md → 需求文档迁移至 devdocs → 记录 Success

#### Scenario: 归档时生成需求文档
- **WHEN** 单元执行到 a.6 且该变更目录内不存在 `需求文档.md`，状态为 `absent`
- **THEN** 子代理非交互委派 `iagent_requirement_doc` 生成该文档，随后 b 步目录移动、c 步迁移至 `openspec/devdocs/YYYY-MM-DD-<change-name>-需求文档.md`

#### Scenario: 已存在的需求文档就地增量对齐
- **WHEN** 单元执行到 a.6 且该变更目录内已存在 `需求文档.md`（含人工填写的评审记录）
- **THEN** 子代理保留 `## 基本信息` 与 `## 八、评审记录` 逐字不变、按当前制品重新派生 `一~七` 章节，MUST NOT 调用 `iagent_requirement_doc` 覆盖；该分支不区分状态

#### Scenario: 用户跳过后不补生成
- **WHEN** a.6 读到状态 `skipped-by-user` 且变更目录内不存在 `需求文档.md`
- **THEN** 单元记录跳过说明并继续 b → b.5 → c → d，MUST NOT 委派 `iagent_requirement_doc`，MUST NOT 中止批次

#### Scenario: 生成失败或已生成状态不重试
- **WHEN** a.6 读到 `generation-failed` 或 `generated` 且 `需求文档.md` 缺失
- **THEN** 单元输出含原因的 WARN 并继续后续步骤，MUST NOT 重新生成

#### Scenario: 生成失败不中止批次
- **WHEN** 某变更的 a.6 生成或对齐失败
- **THEN** 输出 WARN 记录原因并继续该变更的 b→b.5→c→d，其余变更照常执行，批次不被中止

#### Scenario: 探索记忆同步跳过
- **WHEN** 变更目录无 exploration.md
- **THEN** 记录 "Skipping exploration memory sync: no exploration file"，继续后续步骤
