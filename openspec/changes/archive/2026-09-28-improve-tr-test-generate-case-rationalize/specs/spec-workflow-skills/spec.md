## MODIFIED Requirements

### Requirement: spec-propose 提案技能

spec-propose 技能 SHALL 实现变更提案工作流：`venus spec new` 创建骨架 → 按 `venus spec status` 依赖序逐 artifact 用 `venus spec instructions` 获取模板生成 → 生成完成后 MUST 调用 spec-verify-proposal 技能执行前置验证门（90% 阈值）；用户请求授权的范围是规划而非实现，artifacts 全部生成并 PASS 后 MUST 停止、等待用户发起新请求才进入实现；applyRequires 集合 SHALL 按 requires 边构建传递闭包作为必需集（防 tasks done 而 specs 未写早停）；用户可能已编辑的依赖 artifact MUST 在使用前 re-read from disk；材料性歧义（影响范围/行为/兼容性/验收）MUST 必问，小细节可合理假设并记录。

当关联的 `exploration.md` 含经用户确认的 `## 功能流程图` 段时，技能 SHALL 以该流程图为**生成锚点**：`design.md` SHALL 引用流程图与关键操作节点清单（MUST NOT 在 design 中重新发明一套流程）；`tasks.md` 的每个任务 SHALL 标注其对应的节点 id（`[N4]` 形），实现节点 → 任务的可追溯映射，使每个流程节点在任务清单中可被逐一核对。探索期流程图缺失或**未获用户确认**时，技能 SHALL 降级为仅凭 exploration.md 生成，MUST NOT 把未确认的流程图当作既定前提，并 SHALL 在生成报告中标注该降级。

技能 SHALL 在生成 `tasks.md` 时执行**测试规划判定**：逐个 specs Scenario 评估是否可测，可测的 Scenario MUST 产出对应的 `[测试]` 任务。技能 MUST 以"已评估、判定无需测试"的 `[测试]` 任务记录否定结论，使"没写测试"与"没评估过"可区分；`[测试]` 任务 MUST 标注测试层级（`[单元]`/`[功能]`）与优先级（`[P0]`/`[P1]`/`[P2]`）。

#### Scenario: 能力记忆注入
- **WHEN** spec-propose 启动且 `openspec/specs/<capability>/explorations.md` 存在
- **THEN** 技能读取该能力的历史 Decisions/术语/边界场景注入提案上下文

#### Scenario: 探索文件关联迁移
- **WHEN** `openspec/explorations/` 存在探索文件且用户确认关联
- **THEN** 探索文件迁移至 `openspec/changes/<name>/exploration.md`

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

### Requirement: spec-apply 实现技能

spec-apply 技能 SHALL 实现规格驱动实现工作流：优先通过 `venus spec instructions apply --change <name> --json` 获取任务上下文（contextFiles / progress / 动态 instruction），命令不可用（旧版 CLI）时回退直接读变更目录文件 → 实现前呈现设计蓝图等待用户 "确认"（设计确认门）→ 按任务标签（[代码]/[测试]/[DB脚本]/[使用说明]）实现并勾选 tasks.md（仅当规格行为完整实现才可勾选 `- [x]`，部分完成或推迟不算）→ 实现后执行编译检查（tech stack 检测 + autoFix 最多 3 次重试）→ 编译检查通过后执行**测试执行关卡**；发现需要缩小/推迟/简化规格行为以让任务通过时 MUST 表面化并询问，禁止默默缩减。

`[测试]` 任务 SHALL 委派 `venus_tr_test_generate` 技能生成测试代码，MUST NOT 在 apply 内另立一套测试规则。测试任务与实现任务存在依赖时 MUST 串行执行（测试依赖实现完成）。

**测试执行关卡**：技能 SHALL 在编译检查之后运行本次变更范围内的测试——`[测试]` 任务产出的测试文件加上变更文件的对应既有测试。存量失败测试 MUST NOT 阻塞流程，仅以 WARN 展示；变更范围内的测试失败 MUST 进入失败处置分支。项目无测试框架时关卡 SHALL 降级为 WARN 并跳过，MUST NOT 阻塞流程。

#### Scenario: 设计确认门
- **WHEN** spec-apply 获取到待实现任务清单
- **THEN** 技能呈现统一批次计划（任务分组/复杂度/涉及文件）并暂停等待用户显式 "确认" 后才开始写代码

#### Scenario: 任务上下文获取
- **WHEN** spec-apply 启动并需要获取任务清单与上下文
- **THEN** 技能优先运行 `venus spec instructions apply --change <name> --json`，从返回的 contextFiles（artifact→文件路径映射）/ progress / 动态 instruction 获取结构化任务上下文；命令不存在或执行失败（旧版 CLI 不支持）时回退为直接读变更目录文件（tasks.md / proposal.md / specs/ / design.md），并在日志记录回退原因；删除 "The venus CLI does not provide an instructions apply command" 类让步性说明

#### Scenario: 任务勾选推进
- **WHEN** 一个任务的规格行为完整实现（不是部分完成或推迟）
- **THEN** 对应 tasks.md 条目从 `- [ ]` 更新为 `- [x]`；部分完成或推迟的实现 SHALL NOT 勾选 `- [x]`

#### Scenario: scope-creep 防护
- **WHEN** 实现过程中发现需要缩小、推迟或简化规格行为才能让某任务通过
- **THEN** 技能 MUST 将发现表面化（标记 `[待确认]` 并说明差异）向用户询问，SHALL NOT 默默缩小/推迟/简化规格行为以让任务勾选通过；用户确认后须同步更新 proposal/specs/design 才可继续

#### Scenario: 编译检查
- **WHEN** 全部代码任务实现完成
- **THEN** 技能检测 tech stack 并运行对应编译/lint 检查，失败时自动修复重试（上限 3 次），仍失败则呈现 [查看详细]/[手动修复]/[跳过] 选项

#### Scenario: [测试] 任务委派测试生成技能
- **WHEN** 批次命中带 `[测试]` 标签的任务
- **THEN** 技能委派 `venus_tr_test_generate`（传测试层级与优先级）生成测试代码，不在 apply 内自行实现测试规则

#### Scenario: [测试] 任务不按补充文档路由

- **WHEN** 处理带 `[测试]` 标签的任务
- **THEN** 技能 MUST NOT 将其归入补充文档类别，MUST NOT 按 `产出:` 默认路由把测试文件写入 `<changeRoot>/attachments/`；测试代码 SHALL 由测试生成技能按项目测试目录结构落盘

#### Scenario: 未标注任务仍按代码实现处理

- **WHEN** 任务无任何类型标签
- **THEN** 技能沿用既有行为按代码实现处理（向后兼容不变）

#### Scenario: 测试执行关卡运行变更范围
- **WHEN** 编译检查通过且变更范围内存在测试
- **THEN** 技能运行变更范围测试（`[测试]` 任务产出 + 变更文件的既有测试），通过后进入收尾

#### Scenario: 存量失败测试不阻塞
- **WHEN** 测试执行关卡中变更范围外的既有测试失败
- **THEN** 技能仅输出 WARN 展示该类失败，不计入本次失败，不阻塞流程

#### Scenario: 变更范围测试失败处置
- **WHEN** 变更范围内的测试失败
- **THEN** 技能进入失败处置分支（自动修复重试上限 3 次）；仍失败则暂停并报告用户，MUST NOT 勾选对应任务、MUST NOT 进入归档

#### Scenario: 项目无测试框架时降级
- **WHEN** 项目未配置任何测试框架
- **THEN** 测试执行关卡降级为 WARN 并跳过，不阻塞流程

#### Scenario: 测试任务与实现任务的依赖串行
- **WHEN** 某 `[测试]` 任务的被测实现属于同批次另一任务
- **THEN** 技能将该 `[测试]` 任务置于实现任务之后的批次串行执行，MUST NOT 与实现任务并发

## ADDED Requirements

### Requirement: 归档摘要补充标注的标签白名单识别

spec-archive 与 spec-bulk-archive 在生成归档条目摘要时，SHALL 读取 `tasks.md` 并识别**已知任务类型标签白名单**——`[代码]` / `[测试]` / `[DB脚本]` / `[使用说明]`，把其中**非 `[代码]`** 的类型收集起来追加 `[含<type1>/<type2>/...]` 标注。

标签识别 MUST 基于该白名单，MUST NOT 采用"收集所有方括号内容"的实现——`[测试]` 任务允许带层级与优先级子标注（`[测试][单元][P0]`），"收集所有方括号"会把 `单元`、`P0` 等**非类型标签**误收为类型，产生 `[含测试/单元/P0]` 一类噪音与语义错误。

白名单外的未知标签 SHALL 被忽略（不阻断归档），并 MAY 记录 WARN 以便发现新标签未登记的情况。

#### Scenario: [测试] 任务被正确标注
- **WHEN** 归档一个含 `[测试][单元][P0]` 任务的变更
- **THEN** 摘要追加 `[含测试]`，MUST NOT 出现 `[含测试/单元/P0]` 或把 `单元`、`P0` 当作独立类型

#### Scenario: 多类型并存时的标注
- **WHEN** 归档一个含 `[测试]`、`[DB脚本]`、`[使用说明]` 三类补充任务的变更
- **THEN** 摘要追加 `[含测试/DB脚本/使用说明]`

#### Scenario: 未知标签被忽略
- **WHEN** tasks.md 中出现白名单外的标签（如 `[临时]`）
- **THEN** 该标签不进入摘要标注，归档流程不被阻断，并 MAY 记录 WARN

#### Scenario: 仅代码任务时跳过标注
- **WHEN** 变更的 tasks.md 仅含 `[代码]` 任务
- **THEN** 摘要不追加补充标注（既有行为不变）
