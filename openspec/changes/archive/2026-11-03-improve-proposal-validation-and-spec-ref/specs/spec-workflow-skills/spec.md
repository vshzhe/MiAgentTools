## MODIFIED Requirements

### Requirement: spec-propose 提案技能

spec-propose 技能 SHALL 实现变更提案工作流：`iagent spec new` 创建骨架 → 以 `iagent spec instructions apply --json` 做**初检**（`artifacts` / `applyRequires` / `artifactPaths` / `planningHome` / `instruction.state`），按 `applyRequires` 必需依赖的传递闭包逐 artifact 用 `iagent spec instructions <id>` 获取模板生成 → 起草期允许 `specs` / `design` / `tasks` **并行**（proposal 完成且 Capabilities 清单稳定后），每次写入后运行 `iagent spec validate --partial`，已存在但 `invalid` 的制品 MUST 修复而非直接覆盖 → 全部定稿后以 strict `iagent spec validate` 终检，并以 `iagent spec instructions apply --json` 复核 `instruction.state`（`blocked` 时按 `missingDeps` 继续生成，MUST NOT 直接进入验证门）→ MUST NOT 以独立 `iagent spec status --json` 作为起草期状态来源 → 生成完成后 MUST 调用 spec-verify-proposal 技能执行前置验证门（90% 阈值）；用户请求授权的范围是规划而非实现，artifacts 全部生成并 PASS 后 MUST 停止、等待用户发起新请求才进入实现；applyRequires 集合 SHALL 按 requires 边构建传递闭包作为必需集（可选依赖 `id?` MUST NOT 计入闭包，防 tasks done 而 specs 未写早停）；用户可能已编辑的依赖 artifact MUST 在使用前 re-read from disk；材料性歧义（影响范围/行为/兼容性/验收）MUST 必问，小细节可合理假设并记录。

技能 SHALL 以**移动**语义迁移关联的探索文件：将 `openspec/explorations/<keyword>-explore-<sequence>.md` 移动至 `openspec/changes/<change-name>/exploration.md`（`path.join()` 构造，跨平台）；**迁移成功且目标文件校验通过后 MUST 删除源文件**，使同一探索内容在流程中只保留变更目录内的一份（`openspec/explorations/` 退化为"探索中"暂存区）；迁移失败或目标文件存在但校验失败时 MUST 保留源文件并报告错误（"不留原件"只适用于成功路径）。技能 MUST NOT 在迁移成功后于 `openspec/explorations/` 留存副本。

该规则**只作用于本次迁移**：技能 MUST NOT 追溯清理或搬迁 `openspec/explorations/` 下的**既有历史文件**（本规则生效前产生的探索文件保留原位以供溯源，其归属变更可由 `openspec/changes/archive/` 与 ARCHIVE-INDEX.md 佐证）。

当关联的 `exploration.md` 含经用户确认的 `## 功能流程图` 段时，技能 SHALL 以该流程图为**生成锚点**：`design.md` SHALL 引用流程图与关键操作节点清单（MUST NOT 在 design 中重新发明一套流程）；`tasks.md` 的每个任务 SHALL 标注其对应的节点 id（`[N4]` 形），实现节点 → 任务的可追溯映射，使每个流程节点在任务清单中可被逐一核对。探索期流程图缺失或**未获用户确认**时，技能 SHALL 降级为仅凭 exploration.md 生成，MUST NOT 把未确认的流程图当作既定前提，并 SHALL 在生成报告中标注该降级。

技能 SHALL 在生成 `tasks.md` 时执行**测试规划判定**：逐个 specs Scenario 评估是否可测，可测的 Scenario MUST 产出对应的 `[测试]` 任务。技能 MUST 以"已评估、判定无需测试"的 `[测试]` 任务记录否定结论，使"没写测试"与"没评估过"可区分；`[测试]` 任务 MUST 标注测试层级（`[单元]`/`[功能]`）与优先级（`[P0]`/`[P1]`/`[P2]`）。

**路径与状态来源**：技能的路径 SHALL 来自 CLI 返回字段（`changeRoot`、`planningHome`、`artifactPaths.<id>.existingOutputPaths`、`instructions` 的 `resolvedOutputPath`），MUST NOT 臆断或自行拼接仓库路径；状态 SHALL 来自 `instructions apply` 的 `artifacts` / `applyRequires`，MUST NOT 依赖不存在的 `actionContext` 字段。

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

- **WHEN** 检查 `/iagent:spec-propose` 斜杠指令的正文（由 `deriveCommandContent` 从技能正文派生）
- **THEN** 该正文不含探索文件检测与迁移段（该段位于 `<!-- CMD:SKIP -->` 标记内，仅技能版可见），迁移只由技能版执行；此行为与变更前一致，MUST NOT 为对齐而把该段移出标记（交互式文件选择属技能版职责）

#### Scenario: 前置验证门强制执行
- **WHEN** 全部必需 artifact（proposal/specs/tasks，design 可选）生成完成
- **THEN** 技能 MUST 自动调用 spec-verify-proposal 执行评分，不允许跳过直接进入实现

#### Scenario: Planning Boundary
- **WHEN** 用户在 propose 阶段请求 "实现它" 或 "开始编码"
- **THEN** 技能继续完成规划工件（proposal/design/specs/tasks）+ 前置验证门，artifacts 全部生成并 PASS 后停止，输出 "准备就绪，告知我即可开始执行任务"，等待用户发起独立新请求（spec-apply）才进入实现；spec-propose 技能本身 SHALL NOT 启动代码实现

#### Scenario: 依赖文件 re-read from disk
- **WHEN** spec-propose 在生成新 artifact 时需要读取已完成的依赖 artifact（如生成 design 时读 proposal.md）
- **THEN** 技能从磁盘重新读取依赖文件的最新内容（用户可能在会话期间手工编辑），不依赖会话缓存

#### Scenario: required set 传递闭包
- **WHEN** spec-propose 通过 `iagent spec instructions apply --json` 获取 applyRequires 与 artifacts 依赖图
- **THEN** 技能按 requires 边（可选依赖 `id?` 不计入）构建 applyRequires 的传递闭包作为必需集（即 applyRequires ∪ 其必需传递依赖），所有必需 artifact 均 `status: "done"` 才视为 "apply-ready"，防止 tasks 已 done 而 specs 未写时因 applyRequires 只列 tasks 而早停

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
- **THEN** 技能产出对应的 `[测试]` 任务，标注测试层级与优先级（如 `- [ ] [测试][单元][P0] 3.1 覆盖订单金额校验的边界场景 [A4]`），并声明测试文件路径

#### Scenario: 判定无需测试时留痕
- **WHEN** 某个 specs Scenario 为不可测的纯文档/配置变更
- **THEN** 技能仍产出 `[测试]` 任务记录该判定与依据，MUST NOT 静默省略测试任务

#### Scenario: 起草循环以 instructions apply 初检与终检

- **WHEN** spec-propose 进入制品起草循环
- **THEN** 技能 SHALL 以 `iagent spec instructions apply --change "<name>" --json` 取得 `artifacts` / `applyRequires` / `artifactPaths` 作为状态来源
- **AND** 全部制品定稿后 SHALL 以同一命令终检：`instruction.state` 为 `blocked` 时按 `missingDeps` 继续生成，MUST NOT 直接进入 Phase 3 验证
- **AND** MUST NOT 在每个制品写入后重复调用 `status --json`

#### Scenario: 并行起草 specs / design / tasks

- **WHEN** proposal.md 完成且 proposal 的 Capabilities 清单稳定
- **THEN** 技能 SHALL 允许 `specs` / `design` / `tasks` 并行起草（可派发子代理），每次写入后运行 `iagent spec validate --partial`
- **AND** 起草收束后 SHALL 以 strict `iagent spec validate` 统一终检，追溯与结构错误 MUST 在终检前修复

#### Scenario: design 可选不阻塞 apply-ready

- **WHEN** 变更为纯配置/文档变更且无跨切面设计
- **THEN** 技能 MUST NOT 强制创建 `design.md`
- **AND** `tasks` 与 apply-ready 判定 MUST NOT 因 design 缺失被阻塞

#### Scenario: 路径字段来自 CLI

- **WHEN** 技能需要定位制品文件
- **THEN** SHALL 使用 `changeRoot`、`planningHome`、`artifactPaths.<id>.existingOutputPaths` 或 `instructions` 的 `resolvedOutputPath`
- **AND** MUST NOT 臆断路径，MUST NOT 引用 CLI 不返回的 `actionContext`

### Requirement: Spec-to-task traceability is mandatory

spec-propose SHALL 为每个可测 Scenario 生成对应的测试或实现任务，并使用规范形态的 `Spec Ref`（`<capability> / <Requirement>`）或 `Scenario Ref`（`<capability> / <Requirement> / <Scenario>`）关联 capability、Requirement 和 Scenario。spec-verify-proposal 的 D3 覆盖检查与 spec-verify SHALL 使用同一规范形态解析（含 HTML 注释式与一行双引用），并 SHALL 报告未覆盖或失效的引用；仅写 capability 的引用 MUST NOT 计为 Requirement 覆盖，并 SHALL 以「缺少 Requirement」报告。

#### Scenario: Scenario has an implementation task
- **WHEN** specs 中存在可实现的 Scenario
- **THEN** tasks.md SHALL 包含关联任务及其 Spec Ref/Scenario Ref

#### Scenario: Scenario has no test
- **WHEN** Scenario 被判断为不可测
- **THEN** SHALL 生成带 `[测试]` 标签的记录任务，说明已评估且无需测试的依据
- **AND** MUST NOT 静默省略评估

#### Scenario: D3 按规范形态匹配

- **WHEN** tasks.md 以 HTML 注释式或一行同时含 Spec + Scenario 的形式书写追溯
- **THEN** D3 覆盖检查 SHALL 视其与两行规范写法等价，覆盖率 MUST NOT 因书写形态下降

#### Scenario: 仅 capability 引用不计为覆盖

- **WHEN** tasks.md 的 Spec Ref 只写 capability
- **THEN** D3 SHALL 将其计为未覆盖并报告「缺少 Requirement」
- **AND** MUST NOT 把该引用匹配到任一 Requirement

### Requirement: spec-verify-proposal SHALL 为提案验证维度的唯一真源

`iagent_spec_verify_proposal` SHALL 定义并唯一维护提案验证维度契约（D1-D5 核心维度 + D6-D10 条件维度，统一 90% 阈值）。其它技能引用提案验证时 MUST 引用该契约，MUST NOT 另立维度数（如 `D1-D6` / `D1-D9`）。D3（任务完整性）维度的检查口径 SHALL 与 `artifact-markdown-source` 的 Spec Ref / Scenario Ref 规范形态一致，并 SHALL 明确 capability-only 引用不计为覆盖、缺失 Requirement 的诊断文案。

#### Scenario: 维度定义集中于 verify-proposal

- **WHEN** 检查提案验证维度的定义位置
- **THEN** D1-D5 核心维度与 D6-D10 条件维度 SHALL 在 `iagent_spec_verify_proposal` 中有唯一定义
- **AND** 该技能主文件 SHALL 明确 D6-D10 见 `references/conditional-dimensions.md`

#### Scenario: 消费方只引用不重定义

- **WHEN** `iagent_workflow` / `iagent_auto_workflow` / `iagent_debug` / `iagent_spec_propose` 引用提案验证
- **THEN** 其表述 SHALL 与唯一契约一致（引用 `spec_verify_proposal` 技能）
- **AND** MUST NOT 出现不一致的维度子集表述

#### Scenario: D3 维度声明规范引用形态与缺失诊断

- **WHEN** 检查 `iagent_spec_verify_proposal` 的 Dimension 3 说明
- **THEN** SHALL 声明 `Spec Ref = capability / Requirement`、`Scenario Ref = capability / Requirement / Scenario`
- **AND** SHALL 声明只写 capability 的引用不计为覆盖，并给出「缺少 Requirement」的诊断示例
