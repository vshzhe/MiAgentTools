# spec-workflow-skills Specification (Delta)

> 修改：① `spec-propose 提案技能` —— 探索文件迁移明确为**移动并删除源件**（失败保留）；② `spec-archive 归档技能` —— 新增**预归档需求文档生成**检查点（存在性判定 → 委派生成 / 就地增量对齐 → 失败 WARN 非阻断），并声明生成落点为变更目录、由既有步骤 6 迁移至 devdocs。
>
> MODIFIED 需求须含完整更新内容（下同）。

## MODIFIED Requirements

### Requirement: spec-propose 提案技能

spec-propose 技能 SHALL 实现变更提案工作流：`venus spec new` 创建骨架 → 按 `venus spec status` 依赖序逐 artifact 用 `venus spec instructions` 获取模板生成 → 生成完成后 MUST 调用 spec-verify-proposal 技能执行前置验证门（90% 阈值）；用户请求授权的范围是规划而非实现，artifacts 全部生成并 PASS 后 MUST 停止、等待用户发起新请求才进入实现；applyRequires 集合 SHALL 按 requires 边构建传递闭包作为必需集（防 tasks done 而 specs 未写早停）；用户可能已编辑的依赖 artifact MUST 在使用前 re-read from disk；材料性歧义（影响范围/行为/兼容性/验收）MUST 必问，小细节可合理假设并记录。

技能 SHALL 以**移动**语义迁移关联的探索文件：将 `openspec/explorations/<keyword>-explore-<sequence>.md` 移动至 `openspec/changes/<change-name>/exploration.md`（`path.join()` 构造，跨平台）；**迁移成功且目标文件校验通过后 MUST 删除源文件**，使同一探索内容在流程中只保留变更目录内的一份（`openspec/explorations/` 退化为"探索中"暂存区）；迁移失败或目标文件存在但校验失败时 MUST 保留源文件并报告错误（"不留原件"只适用于成功路径）。技能 MUST NOT 在迁移成功后于 `openspec/explorations/` 留存副本。

该规则**只作用于本次迁移**：技能 MUST NOT 追溯清理或搬迁 `openspec/explorations/` 下的**既有历史文件**（本规则生效前产生的探索文件保留原位以供溯源，其归属变更可由 `openspec/changes/archive/` 与 ARCHIVE-INDEX.md 佐证）。

当关联的 `exploration.md` 含经用户确认的 `## 功能流程图` 段时，技能 SHALL 以该流程图为**生成锚点**：`design.md` SHALL 引用流程图与关键操作节点清单（MUST NOT 在 design 中重新发明一套流程）；`tasks.md` 的每个任务 SHALL 标注其对应的节点 id（`[N4]` 形），实现节点 → 任务的可追溯映射，使每个流程节点在任务清单中可被逐一核对。探索期流程图缺失或**未获用户确认**时，技能 SHALL 降级为仅凭 exploration.md 生成，MUST NOT 把未确认的流程图当作既定前提，并 SHALL 在生成报告中标注该降级。

技能 SHALL 在生成 `tasks.md` 时执行**测试规划判定**：逐个 specs Scenario 评估是否可测，可测的 Scenario MUST 产出对应的 `[测试]` 任务。技能 MUST 以"已评估、判定无需测试"的 `[测试]` 任务记录否定结论，使"没写测试"与"没评估过"可区分；`[测试]` 任务 MUST 标注测试层级（`[单元]`/`[功能]`）与优先级（`[P0]`/`[P1]`/`[P2]`）。

#### Scenario: 能力记忆注入
- **WHEN** spec-propose 启动且 `openspec/specs/<capability>/explorations.md` 存在
- **THEN** 技能读取该能力的历史 Decisions/术语/边界场景注入提案上下文

#### Scenario: 探索文件关联迁移
- **WHEN** `openspec/explorations/` 存在探索文件且用户确认关联
- **THEN** 探索文件移动至 `openspec/changes/<name>/exploration.md`，迁移成功且目标文件校验通过后删除 `openspec/explorations/` 下的源文件

#### Scenario: 迁移失败保留源文件
- **WHEN** 探索文件移动失败，或目标文件已存在但校验未通过
- **THEN** 技能保留 `openspec/explorations/` 下的源文件、删除未通过校验的目标副本（若为本技能所写），并报告错误原因与重试/手工迁移选项

#### Scenario: 历史探索文件不被追溯清理
- **WHEN** 本规则生效后执行一次提案，`openspec/explorations/` 下同时存在本次的暂存文件与规则生效前的既有历史文件
- **THEN** 技能仅移动并删除**本次**的暂存文件，既有历史文件保留原位，MUST NOT 被读取、搬迁或删除

#### Scenario: 配对指令版不含迁移步骤（维持现状）

- **WHEN** 检查 `/venus:spec-propose` 斜杠指令的正文（由 `deriveCommandContent` 从技能正文派生）
- **THEN** 该正文不含探索文件检测与迁移段（该段位于 `<!-- CMD:SKIP -->` 标记内，仅技能版可见），迁移只由技能版执行；此行为与变更前一致，MUST NOT 为对齐而把该段移出标记（交互式文件选择属技能版职责）

#### Scenario: 前置验证门强制执行
- **WHEN** 全部 artifact（proposal/specs/design/tasks）生成完成
- **THEN** 技能 MUST 自动调用 spec-verify-proposal 执行 D1-D9 评分，不允许跳过直接进入实现

#### Scenario: Planning Boundary
- **WHEN** 用户在 propose 阶段请求 "实现它" 或 "开始编码"
- **THEN** 技能继续完成规划工件（proposal/design/specs/tasks）+ 前置验证门，artifacts 全部生成并 PASS 后停止，输出 "准备就绪，告知我即可开始执行任务"，等待用户发起独立新请求（spec-apply）才进入实现；spec-propose 技能本身 SHALL NOT 启动代码实现

#### Scenario: 依赖文件 re-read from disk
- **WHEN** spec-propose 在生成新 artifact 时需要读取已完成的依赖 artifact（如生成 design 时读 proposal.md）
- **THEN** 技能从磁盘重新读取依赖文件的最新内容（用户可能在会话期间手工编辑），不依赖会话缓存

#### Scenario: required set 传递闭包
- **WHEN** spec-propose 通过 `venus spec status --json` 获取 applyRequires 与 artifacts 依赖图
- **THEN** 技能按 requires 边构建 applyRequires 的传递闭包作为必需集（即 applyRequires ∪ 其传递依赖），所有必需 artifact 均 `status: "done"` 才视为 "apply-ready"，防止 tasks 已 done 而 specs 未写时因 applyRequires 只列 tasks 而早停

#### Scenario: 材料性歧义划分
- **WHEN** spec-propose 在 artifact 生成中遇到歧义
- **THEN** 影响范围/行为契约/向后兼容性/验收标准的歧义 MUST 表面化并向用户提问（标记 `[待确认]`），不擅自决策；不影响上述方面的细节性歧义可做合理假设并记录假设

#### Scenario: 以流程基准为生成锚点
- **WHEN** 关联的 exploration.md 含经用户确认的 `## 功能流程图` 段
- **THEN** design.md 引用该流程图与节点清单（不重新发明流程），tasks.md 的每个任务标注对应节点 id（如 `- [ ] 实现分批查询 [N4]`），使流程节点可在任务清单中被逐一核对

#### Scenario: 流程图缺失或未确认时降级
- **WHEN** exploration.md 不含 `## 功能流程图` 段，或该段存在但未获用户确认
- **THEN** 技能降级为仅凭 exploration.md 生成提案，不把未确认流程图当作既定前提，并在生成报告中标注该降级

#### Scenario: 测试规划判定产出 [测试] 任务
- **WHEN** spec-propose 生成 tasks.md 且某个 specs Scenario 可被测
- **THEN** 技能产出对应的 `[测试]` 任务，标注测试层级与优先级（如 `- [ ] [测试][单元][P0] 3.1 覆盖订单金额校验的边界场景 [A4]`），并声明 `产出:` 测试文件路径

#### Scenario: 判定无需测试时留痕
- **WHEN** 某个 specs Scenario 为不可测的纯文档/配置变更
- **THEN** 技能仍产出 `[测试]` 任务记录该判定与依据，MUST NOT 静默省略测试任务

### Requirement: spec-archive 归档技能

spec-archive 技能 SHALL 实现归档工作流：检查 CONTEXT.md 术语同步（不存在则创建）→ 从变更的 exploration.md 提取决策/术语/边界场景追加到 `openspec/specs/<capability>/explorations.md`（冲突标"已过时"不删历史）→ **生成需求文档（预归档检查点）** → AI 智能合并 delta spec 到主 spec（ADDED/MODIFIED/REMOVED/RENAMED）→ 调用 `venus spec archive` 执行目录移动 → 迁移需求文档至 devdocs → CodeGraph 增量同步（codegraph sync + 符号验证，失败仅 WARN 不阻断）。

**预归档需求文档生成检查点（MANDATORY）SHALL 在探索记忆同步之后、目录移动之前执行**，判定范围 SHALL **仅** `openspec/changes/<change-name>/需求文档.md`（`path.join()` 构造）：

- **不存在** → 经 Skill 工具**非交互**委派 `venus_tr_docs_requirement_doc` 技能生成该文档（使用占位符基本信息，不问任何问题）
- **已存在** → 执行**就地增量对齐更新**：`## 基本信息` 与 `## 八、评审记录` 为**人工域**，MUST NOT 覆盖（含占位符状态）；`一~七` 章节 SHALL 按当前制品重新派生；已存在分支 MUST NOT 调用 `venus_tr_docs_requirement_doc`（其侧规则为目标文件已存在时静默覆盖，会抹掉人工内容）。就地对齐 MUST NOT 删除章节（仅制品已移除的内容可删）；格式破损时 SHALL 补建缺失章节并记录 WARN
- **目录不可读** → 记录 WARN 并按"不存在"处理
- **两分支失败（生成或对齐）** → SHALL 记录 WARN（含原因）并**继续归档**，MUST NOT 阻断归档流程

生成落点 SHALL 为变更目录内的 `需求文档.md`，随后由既有的**需求文档迁移步骤**（归档目录移动之后）原样迁移至 `openspec/devdocs/`，使 devdocs 产出路径与历史归档保持一致。

#### Scenario: 探索记忆同步
- **WHEN** 变更含 exploration.md 且其 Decisions 与能力级 explorations.md 的既有决策冲突
- **THEN** 旧决策标记为"已过时（由 <change-name> 取代）"保留，新决策追加，历史不被删除

#### Scenario: 归档时生成需求文档
- **WHEN** 归档流程进入预归档检查点且变更目录内不存在 `需求文档.md`
- **THEN** 技能非交互委派 `venus_tr_docs_requirement_doc` 生成该文档，随后目录移动并把文档迁移至 `openspec/devdocs/YYYY-MM-DD-<name>-需求文档.md`

#### Scenario: 归档时就地增量对齐已存在的需求文档
- **WHEN** 归档流程进入预归档检查点且变更目录内已存在 `需求文档.md`（含人工填写的评审记录）
- **THEN** 技能保留人工域（`## 基本信息` 与 `## 八、评审记录`）逐字不变、按当前制品重新派生 `一~七` 章节，MUST NOT 调用 `venus_tr_docs_requirement_doc` 覆盖

#### Scenario: 生成失败不阻断归档
- **WHEN** 需求文档生成或就地增量对齐失败
- **THEN** 技能输出 WARN 日志记录原因并继续执行目录移动，归档流程不被阻断

#### Scenario: delta spec 智能合并
- **WHEN** 变更的 specs/<capability>/spec.md 含 ADDED 与 MODIFIED 需求
- **THEN** 技能将 ADDED 需求追加到主 spec、MODIFIED 需求更新对应条目，再执行 venus spec archive 移动

#### Scenario: CodeGraph 同步非阻塞
- **WHEN** 归档后 codegraph sync 执行失败
- **THEN** 输出 WARN 日志继续完成归档流程，不回滚
