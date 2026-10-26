## ADDED Requirements

### Requirement: spec 技能类型注册
VenusAgentTools SHALL 新增第 8 个生命周期类型 `spec`（名称：规格），扩展 SkillType 联合类型与 SKILL_TYPES 注册表；6 个 spec 技能 SHALL 成对（SkillTemplate + CommandTemplate）注册到 WORKFLOW_PAIRS，命名遵循现有派生规则（`venus_spec_<name>` → 指令 `spec-<name>`）。

#### Scenario: init 安装 6 个 spec 技能
- **WHEN** 在全新项目运行 `venus init`
- **THEN** 6 个技能安装到 `.claude/skills/`（venus_spec_explore / venus_spec_propose / venus_spec_apply / venus_spec_archive / venus_spec_verify / venus_spec_verify_proposal），6 个指令安装到 `.claude/commands/venus/`（spec-explore.md ~ spec-verify-proposal.md）

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
spec-explore 技能 SHALL 实现探索立场工作流：CodeGraph 强制首动作（codegraph_status 确认可用前禁止 Glob/Grep 回退）、结构化探索文件持久化（`openspec/explorations/<keyword>-explore-<seq>.md`）、CONTEXT.md 术语表启动检查、只读不写代码。

#### Scenario: CodeGraph 首动作
- **WHEN** spec-explore 技能启动且 CodeGraph MCP 可用
- **THEN** 技能先执行 codegraph_status / codegraph_files / codegraph_search 完成基础扫描，Glob/Grep 仅在 CodeGraph 确认不可用后作为回退

#### Scenario: 探索文件持久化
- **WHEN** 探索过程产出结构化发现（背景/问题/决策/术语）
- **THEN** 写入 `openspec/explorations/<keyword>-explore-<sequence>.md`（sequence 从 001 递增），跨会话可被 spec-propose 关联迁移

#### Scenario: 写入确认守卫
- **WHEN** 探索过程需要执行任何写能力动作（含创建变更）
- **THEN** 技能先命名将修改的文件、以 yes/no 形式向用户确认并等待单独回复后才执行

### Requirement: spec-propose 提案技能
spec-propose 技能 SHALL 实现变更提案工作流：`venus spec new` 创建骨架 → 按 `venus spec status` 依赖序逐 artifact 用 `venus spec instructions` 获取模板生成 → 生成完成后 MUST 调用 spec-verify-proposal 技能执行前置验证门（90% 阈值）。

#### Scenario: 能力记忆注入
- **WHEN** spec-propose 启动且 `openspec/specs/<capability>/explorations.md` 存在
- **THEN** 技能读取该能力的历史 Decisions/术语/边界场景注入提案上下文

#### Scenario: 探索文件关联迁移
- **WHEN** `openspec/explorations/` 存在探索文件且用户确认关联
- **THEN** 探索文件迁移至 `openspec/changes/<name>/exploration.md`

#### Scenario: 前置验证门强制执行
- **WHEN** 全部 artifact（proposal/specs/design/tasks）生成完成
- **THEN** 技能 MUST 自动调用 spec-verify-proposal 执行 D1-D9 评分，不允许跳过直接进入实现

### Requirement: spec-apply 实现技能
spec-apply 技能 SHALL 实现规格驱动实现工作流：读 `venus spec status` 与 instructions apply 获取任务清单 → 实现前呈现设计蓝图等待用户"确认"（设计确认门）→ 按任务标签（[代码]/[DB脚本]/[使用说明]）实现并勾选 tasks.md → 实现后执行编译检查（tech stack 检测 + autoFix 最多 3 次重试）。

#### Scenario: 设计确认门
- **WHEN** spec-apply 获取到待实现任务清单
- **THEN** 技能呈现统一批次计划（任务分组/复杂度/涉及文件）并暂停等待用户显式"确认"后才开始写代码

#### Scenario: 任务勾选推进
- **WHEN** 一个任务实现完成
- **THEN** 对应 tasks.md 条目从 `- [ ]` 更新为 `- [x]`

#### Scenario: 编译检查
- **WHEN** 全部代码任务实现完成
- **THEN** 技能检测 tech stack 并运行对应编译/lint 检查，失败时自动修复重试（上限 3 次），仍失败则呈现 [查看详细]/[手动修复]/[跳过] 选项

### Requirement: spec-archive 归档技能
spec-archive 技能 SHALL 实现归档工作流：检查 CONTEXT.md 术语同步（不存在则创建）→ 从变更的 exploration.md 提取决策/术语/边界场景追加到 `openspec/specs/<capability>/explorations.md`（冲突标"已过时"不删历史）→ AI 智能合并 delta spec 到主 spec（ADDED/MODIFIED/REMOVED/RENAMED）→ 调用 `venus spec archive` 执行目录移动 → CodeGraph 增量同步（codegraph sync + 符号验证，失败仅 WARN 不阻断）。

#### Scenario: 探索记忆同步
- **WHEN** 变更含 exploration.md 且其 Decisions 与能力级 explorations.md 的既有决策冲突
- **THEN** 旧决策标记为"已过时（由 <change-name> 取代）"保留，新决策追加，历史不被删除

#### Scenario: delta spec 智能合并
- **WHEN** 变更的 specs/<capability>/spec.md 含 ADDED 与 MODIFIED 需求
- **THEN** 技能将 ADDED 需求追加到主 spec、MODIFIED 需求更新对应条目，再执行 venus spec archive 移动

#### Scenario: CodeGraph 同步非阻塞
- **WHEN** 归档后 codegraph sync 执行失败
- **THEN** 输出 WARN 日志继续完成归档流程，不回滚

### Requirement: spec-verify 后置验证技能
spec-verify 技能 SHALL 实现实现后验证：三维度（Completeness/Correctness/Coherence）产出 CRITICAL/WARNING/SUGGESTION 分级问题清单与归档就绪评估，report-only 模式不修改任何文件。

#### Scenario: 三维度报告
- **WHEN** spec-verify 对已实现变更执行验证
- **THEN** 输出含 Completeness（tasks 勾选与需求实现）、Correctness（需求→代码映射 file:line）、Coherence（design 决策遵循）的分级问题清单

#### Scenario: 只读不修改
- **WHEN** spec-verify 运行完成
- **THEN** 不修改任何项目文件、不执行归档，仅产出验证报告

### Requirement: spec-verify-proposal 前置验证门技能
spec-verify-proposal 技能 SHALL 实现提案阶段量化评分：D1-D9 维度覆盖率评分（D6-D9 按变更类型条件启用，未启用标"不适用"），总分 ≥90% PASS（可进入实现）、<90% FAIL（生成修复建议并重试）；tech stack 从 openspec/config.yaml context 检测。

#### Scenario: PASS 路径
- **WHEN** 9 维评分总分 ≥90%
- **THEN** 输出 PASS 与各维度覆盖率表，变更获准进入 spec-apply 实现阶段

#### Scenario: FAIL 修复循环
- **WHEN** 评分 <90%
- **THEN** 输出 FAIL 与逐维缺口分析，自动生成修复建议应用后重新评分，仍失败则提供 [手动编辑]/[返回探索]/[查看差异] 选项

#### Scenario: 条件维度跳过
- **WHEN** 变更类型不含交互细节（无 UI 相关 spec）
- **THEN** D6 维度标注"不适用"并从总分计算中排除，不按 0 分拉低总分
