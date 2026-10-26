# Spec Delta

## Purpose

定义 OpenSpec Markdown 变更制品的权威格式与机器可验证边界，使 AI Agent 和人工直接维护同一份文档，同时让 CLI 能通过确定性解析执行状态、校验、任务追踪和迁移。

## ADDED Requirements

### Requirement: Markdown artifacts are the sole editable source of truth
新建变更的 proposal、design、specs 和 tasks SHALL 以 OpenSpec 约定的 Markdown 文件为唯一可编辑真源：`proposal.md`、可选 `design.md`、`specs/<capability>/spec.md`、`tasks.md`。系统 MUST NOT 为这些制品创建或更新平行的 JSON 真源或渲染副本。CLI 的 `--json` 输出、运行时解析对象和可重建索引不属于持久化制品。

#### Scenario: 创建新变更制品
- **WHEN** Agent 按 spec-driven 依赖生成一个新变更
- **THEN** proposal、适用的 design、spec delta 和任务直接写入对应 Markdown 文件
- **AND** MUST NOT 创建 `change.json` 或 `tasks.json` 作为新变更的权威数据

#### Scenario: Markdown 与 CLI JSON 输出共存
- **WHEN** 用户运行 `iagent spec status --json`
- **THEN** CLI SHALL 从 Markdown 读取数据并输出 JSON 响应
- **AND** 该响应 MUST NOT 被写回变更目录或取代 Markdown 制品

### Requirement: OpenSpec Markdown structure is preserved and machine-readable
Markdown 制品 SHALL 遵循 OpenSpec 的文件布局与标题约定。Specs SHALL 使用 `## ADDED Requirements`、`## MODIFIED Requirements`、`## REMOVED Requirements` 或 `## RENAMED Requirements` 操作分节；需求使用 `### Requirement: <name>`，场景使用 `#### Scenario: <name>`，场景正文使用可识别的 `WHEN` / `THEN` 条目。Tasks SHALL 使用 `- [ ]` / `- [x]` checkbox 和稳定任务编号。解析 MUST 保留文档中未定义为机器字段的 Markdown 内容。

#### Scenario: 解析标准 delta spec
- **WHEN** spec 文件包含 ADDED Requirements 下的 Requirement 与 Scenario
- **THEN** 解析器 SHALL 提取操作类型、需求标题、需求正文、场景标题及 WHEN/THEN 内容
- **AND** 原 Markdown 文件保持为唯一编辑来源

#### Scenario: 允许自由内容而不丢失
- **WHEN** proposal 或 design 含表格、代码块、列表或 Mermaid 图
- **THEN** 解析与校验 SHALL 保留其原始 Markdown 内容，不得为规范化而重写或丢弃

### Requirement: Markdown parsing and validation produce actionable diagnostics
系统 SHALL 将制品解析为运行时类型化模型，并以确定性规则校验结构、必需字段、任务编号/依赖、重复引用及 specs 场景。错误和警告 SHALL 提供文件路径、行号和可定位的问题描述。解析失败 SHALL 保留原文件，不得自动重写、修复或降级为另一份真源。

#### Scenario: 规格缺少场景
- **WHEN** spec 文件中的 Requirement 没有 Scenario
- **THEN** 校验结果 SHALL 标为 invalid，并指出文件路径、Requirement 标题和行号

#### Scenario: 任务依赖引用不存在
- **WHEN** `tasks.md` 中任务依赖了不存在的任务编号
- **THEN** 校验 SHALL 报告该任务及缺失编号，且 MUST NOT 静默忽略依赖

#### Scenario: 文件语法损坏
- **WHEN** Markdown 结构无法被可靠解析
- **THEN** CLI SHALL 返回含路径和行号的诊断，MUST NOT 覆盖或自动格式化源文件

### Requirement: Tasks maintain explicit traceability to requirements
任务 SHALL 支持以稳定、可读的 `Spec Ref` 和可选 `Scenario Ref` 将实现与测试任务关联到能力规格及场景。校验器 SHALL 检查引用目标存在；缺失或失效引用 SHALL 可被报告，不能通过推测自动绑定。

#### Scenario: 有效规格引用
- **WHEN** 任务引用存在的 capability、Requirement 和 Scenario
- **THEN** 校验器 SHALL 将该任务与对应规格节点关联，供 verify 和 apply 上下文使用

#### Scenario: 失效规格引用
- **WHEN** 任务引用的 Requirement 或 Scenario 不存在
- **THEN** 校验器 SHALL 报告失效引用并保留原任务文本，不得自动改写引用

### Requirement: Legacy JSON artifacts require explicit migration
历史 `change.json`、`tasks.json` 与旧 sidecar SHALL 被视为兼容输入而非新真源。若相应 Markdown 已存在，Markdown SHALL 优先且系统 MUST NOT 合并 JSON 内容；若只有 JSON，读取方 MAY 以只读兼容方式提供状态和索引并发出 WARN，写操作 SHALL 引导先执行显式迁移。迁移 SHALL 不覆盖已有 Markdown，且默认 MUST NOT 删除 JSON。

#### Scenario: 历史 JSON-only 变更只读检查
- **WHEN** status 或 reindex 检查只有 JSON 制品的历史变更
- **THEN** 系统 MAY 读取 JSON 生成兼容状态或索引并记录 WARN
- **AND** 普通查询 MUST NOT 修改 JSON 或生成隐式 Markdown 副本

#### Scenario: Markdown 与历史 JSON 并存
- **WHEN** 同一变更同时存在 Markdown 制品和对应 JSON 数据
- **THEN** Markdown SHALL 是唯一权威来源，JSON MUST NOT 覆盖、补全或与 Markdown 自动合并

#### Scenario: 显式迁移遇到已存在目标文件
- **WHEN** 用户对 JSON-only 变更运行显式迁移且目标 Markdown 文件已存在
- **THEN** 迁移 SHALL 拒绝覆盖并报告冲突路径，除非用户先显式处理该冲突

#### Scenario: 显式迁移成功
- **WHEN** 用户显式请求 JSON 到 Markdown 迁移且目标文件均不存在
- **THEN** 系统 SHALL 生成 OpenSpec Markdown 并校验其结构
- **AND** JSON 源文件 SHALL 保留，只有再次显式指定删除选项且校验成功后才可删除
