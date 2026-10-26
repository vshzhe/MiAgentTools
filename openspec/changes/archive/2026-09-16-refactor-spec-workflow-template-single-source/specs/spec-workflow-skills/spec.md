## ADDED Requirements

### Requirement: 模板单一源派生规则

VenusAgentTools 的 `src/core/templates/workflows/spec-*.ts` 中每个 spec 工作流模板正文 SHALL 仅维护 `SkillTemplate.instructions` 一份作为唯一源；`CommandTemplate.content` SHALL 由代码派生函数从 `instructions` 生成（派生策略：段落级 HTML 注释标记裁剪——以成对注释标记 `<!-- CMD:SKIP -->` / `<!-- /CMD:SKIP -->` 划定仅 skill 版可见的段落，未标记段落默认保留进 command 版；禁用 LLM 生成与模板变量替换引擎），不再手工双写两份 markdown 字符串。派生规则 SHALL fail-safe：派生函数处理 `instructions` 时遇到未显式标记为 skill-only 的段落，该段落默认进入 command 版（即默认双向可见），防止漏标导致防护语句在 command 版缺失（既有漂移的直接教训）。

#### Scenario: command content 由派生函数生成

- **WHEN** spec-*.ts 工作流模板注册到 WORKFLOW_PAIRS
- **THEN** `SkillTemplate.instructions` 作为唯一源手工维护，`CommandTemplate.content` SHALL 由代码派生函数从 `instructions` 生成；不存在两份独立维护的 markdown 字符串

#### Scenario: fail-safe 默认（未标记段落进入 command 版）

- **WHEN** 派生函数处理 `SkillTemplate.instructions` 时遇到未显式标记为 `skill-only` 的段落
- **THEN** 该段落默认进入 command 版（默认双向可见），防止漏标导致防护语句在 command 版缺失

#### Scenario: 唯一源修改后 command 版自动同步

- **WHEN** `SkillTemplate.instructions` 的某段正文被修改（如新增防护语句）
- **THEN** 下次 `pnpm build && pnpm generate:skills` 重新生成技能快照时 `CommandTemplate.content` MUST 自动反映该修改，无需手工同步 command 版字符串；模板派生一致性测试（替代人工双写核对）MUST 通过

### Requirement: 漂移修复验收

VenusAgentTools SHALL 在单一源落地时消除 2026-09-14 实测发现的 4 处历史漂移：explore Visualize 图表、propose 蓝图确认句、propose Step 0 编号、archive 步骤 6.5 错序。每处漂移的修复 MUST 在迁移到唯一源前按"防护语句优先保留"原则裁决源内容（既非简单采用 skill 版也非简单采用 command 版）。

#### Scenario: explore Visualize 图表漂移消除

- **WHEN** spec-explore 模板以单一源生成 skill 与 command 版
- **THEN** Visualize 示例 ASCII 图表在两版中渲染一致，右边框无错位（既有 `spec-explore.ts:90` skill 版右边框与内容行拼接错位 MUST 在迁移到单一源前修复为完好的闭合边框样式）

#### Scenario: propose 蓝图确认句漂移消除

- **WHEN** spec-propose 模板以单一源生成 skill 与 command 版
- **THEN** Guardrails 段在两版中均含 "After all artifacts are created, display a design blueprint summary and wait for user confirmation before suggesting implementation"（既有 `spec-propose.ts` command 版缺失 MUST 在迁移到单一源前从 skill 版回填，防止防护语句缺口）

#### Scenario: propose Step 0 编号漂移消除

- **WHEN** spec-propose 模板以单一源生成 skill 与 command 版
- **THEN** Step 0 子编号（0.1-0.6）与主步骤（1-6）编号不混排，子编号 MUST 嵌套在 Step 0 内部，主步骤 1-6 接续排列（既有 skill 版编号 0-6 与主步骤 1-6 混排 MUST 在迁移到单一源前修正）

#### Scenario: archive 步骤 6.5 编号错序消除

- **WHEN** spec-archive 模板以单一源生成 skill 与 command 版
- **THEN** 归档执行步骤按 "CONTEXT.md 同步 → 探索记忆合并 → delta spec AI 合并 → venus spec archive 目录移动 → CodeGraph 同步" 顺序排列，子步骤 6.5 MUST 紧随主步骤 6 之后，不允许排在步骤 7 之后（既有顺序 4.7 → 5 → 6 → 7 → 6.5 → 8 MUST 修正为 6 → 6.5 → 7 → 8）

## MODIFIED Requirements

### Requirement: spec 技能类型注册
VenusAgentTools SHALL 新增第 8 个生命周期类型 `spec`（名称：规格），扩展 SkillType 联合类型与 SKILL_TYPES 注册表；6 个 spec 技能 SHALL 成对（SkillTemplate + CommandTemplate）注册到 WORKFLOW_PAIRS，命名遵循现有派生规则（`venus_spec_<name>` → 指令 `spec-<name>`）。成对注册中的 `CommandTemplate.content` SHALL 由派生函数从对应 `SkillTemplate.instructions`（唯一源）生成，SHALL NOT 以独立维护的字符串形式存在（消除"两份模板均为手工维护一等制品"的历史读法）。

#### Scenario: init 安装 6 个 spec 技能
- **WHEN** 在全新项目运行 `venus init`
- **THEN** 6 个技能安装到 `.claude/skills/`（venus_spec_explore / venus_spec_propose / venus_spec_apply / venus_spec_archive / venus_spec_verify / venus_spec_verify_proposal），6 个指令安装到 `.claude/commands/venus/`（spec-explore.md ~ spec-verify-proposal.md），指令正文为派生生成的 command content

#### Scenario: 成对注册与单一源派生共存
- **WHEN** spec-*.ts 的模板对注册到 WORKFLOW_PAIRS
- **THEN** 注册结构仍为 { skill: SkillTemplate, command: CommandTemplate } 成对形式，但 command 的 content 字段在注册时即由派生函数从 skill.instructions 生成，源码中不存在第二份手工维护的同名正文字符串

#### Scenario: list 分组展示
- **WHEN** 运行 `venus list`
- **THEN** 输出含"规格"分组，展示 6 个 spec 技能，与现有 7 类 tr_* 分组并列

#### Scenario: validate 校验 spec 类型
- **WHEN** 运行 `venus validate` 且 spec 技能已安装
- **THEN** 6 个技能通过类型校验（frontmatter metadata.type=spec 属于合法类型）

#### Scenario: 指令 id 派生
- **WHEN** 技能名为 venus_spec_verify_proposal
- **THEN** deriveCommandId 派生指令 id 为 spec-verify-proposal（下划线转连字符、去 venus 前缀）

#### Scenario: init 生成 spec 规则文件
- **WHEN** 首次运行 `venus init`（配置刚创建）
- **THEN** `.venus/rules/` 下生成 `spec_propose.md` 规则文件（spec 类型项目规则，与 tr_* 类型规则文件同模式）

#### Scenario: 与 tr_impl 技能触发区分
- **WHEN** 用户请求实现功能且技能需要被选择
- **THEN** tr_impl 适用于用户直接描述需求的即时代码实现；spec_apply 适用于 openspec/changes/ 下已有变更制品（proposal/specs/design/tasks）的规格驱动实现，两者的 description MUST 明确表达该边界

### Requirement: spec-explore 探索技能

spec-explore 技能 SHALL 实现探索立场工作流：CodeGraph 强制首动作（codegraph_status 确认可用前禁止 Glob/Grep 回退）、结构化探索文件持久化（`openspec/explorations/<keyword>-explore-<seq>.md`）、CONTEXT.md 术语表启动检查、只读不写代码；首次写操作前 MUST 以 yes/no 形式向用户单独确认（确认范围仅限命名的文件、回答设计问题不构成同意写入）；用户可能已编辑的依赖文件 MUST 在使用前 re-read from disk；材料性歧义（影响范围/行为/兼容性/验收）MUST 必问，小细节可合理假设并记录。

#### Scenario: CodeGraph 首动作

- **WHEN** spec-explore 技能启动且 CodeGraph MCP 可用
- **THEN** 技能先执行 codegraph_status / codegraph_files / codegraph_search 完成基础扫描，Glob/Grep 仅在 CodeGraph 确认不可用后作为回退

#### Scenario: 探索文件持久化

- **WHEN** 探索过程产出结构化发现（背景/问题/决策/术语）
- **THEN** 写入 `openspec/explorations/<keyword>-explore-<sequence>.md`（sequence 从 001 递增），跨会话可被 spec-propose 关联迁移

#### Scenario: 写入确认守卫

- **WHEN** 探索过程需要执行任何写能力动作（含创建变更、修改 artifact、保存探索文件）
- **THEN** 技能先命名将修改的文件、以 yes/no 形式向用户确认并等待单独回复后才执行；确认范围仅限已命名的文件，不允许 "全部同意" 式笼统授权；用户回答设计问题（讨论方案、澄清需求、解释术语等）不构成对写入操作的同意，写入仍需独立的 yes/no 确认

#### Scenario: 依赖文件 re-read from disk

- **WHEN** 探索过程需要读取用户可能在会话期间编辑过的文件（如 CONTEXT.md、exploration.md、变更 artifact）
- **THEN** 技能在每次使用前重新从磁盘读取最新内容，不依赖会话开始时缓存的版本，避免基于过时内容决策

#### Scenario: 材料性歧义划分

- **WHEN** 探索过程遇到歧义
- **THEN** 影响范围/行为契约/向后兼容性/验收标准的歧义 MUST 表面化并向用户提问（标记 `[待确认]`）；不影响上述方面的细节性歧义可做合理假设并记录假设，避免无限追问

### Requirement: spec-propose 提案技能

spec-propose 技能 SHALL 实现变更提案工作流：`venus spec new` 创建骨架 → 按 `venus spec status` 依赖序逐 artifact 用 `venus spec instructions` 获取模板生成 → 生成完成后 MUST 调用 spec-verify-proposal 技能执行前置验证门（90% 阈值）；用户请求授权的范围是规划而非实现，artifacts 全部生成并 PASS 后 MUST 停止、等待用户发起新请求才进入实现；applyRequires 集合 SHALL 按 requires 边构建传递闭包作为必需集（防 tasks done 而 specs 未写早停）；用户可能已编辑的依赖 artifact MUST 在使用前 re-read from disk；材料性歧义（影响范围/行为/兼容性/验收）MUST 必问，小细节可合理假设并记录。

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

### Requirement: spec-apply 实现技能

spec-apply 技能 SHALL 实现规格驱动实现工作流：优先通过 `venus spec instructions apply --change <name> --json` 获取任务上下文（contextFiles / progress / 动态 instruction），命令不可用（旧版 CLI）时回退直接读变更目录文件 → 实现前呈现设计蓝图等待用户 "确认"（设计确认门）→ 按任务标签（[代码]/[DB脚本]/[使用说明]）实现并勾选 tasks.md（仅当规格行为完整实现才可勾选 `- [x]`，部分完成或推迟不算）→ 实现后执行编译检查（tech stack 检测 + autoFix 最多 3 次重试）；发现需要缩小/推迟/简化规格行为以让任务通过时 MUST 表面化并询问，禁止默默缩减。

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
