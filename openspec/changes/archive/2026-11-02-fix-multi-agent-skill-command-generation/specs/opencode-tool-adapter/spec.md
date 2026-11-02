## MODIFIED Requirements

### Requirement: OpenCode V2 project agents

系统 SHALL 为需要 strict 编排的 workflow 生成项目级 primary orchestrator 与 subagent agent 定义。orchestrator 负责阶段推进与回执汇总；worker 负责单阶段任务并返回协议规定的 receipt。子 agent 深度与可委派范围 SHALL 可被项目配置约束。

每个阶段 worker agent（`.opencode/agents/iagent-<workflowId>.md`）的生成与生命周期管理 SHALL 满足：
- frontmatter 的 `description` SHALL 经 `normalizeHostSkillRefs` 归一化内部 `iagent_<id>` 引用并经 `escapeYamlValue` 安全转义；
- 正文 SHALL 包含启动时通过 `skill` 工具加载对应 `iagent-<workflowId>`（`.opencode/skills/iagent-<workflowId>/SKILL.md`）完整阶段规程的明确引导指令；
- 当生效 `workflows` 集合缩小时，`writeOpenCodeProjectArtifacts` SHALL 自动清理 `.opencode/agents/` 下不再属于生效集的 `iagent-*.md` orphan 文件（保留 `iagent-orchestrator.md` 与非 `iagent-` 前缀的用户自建 agent）；
- `scanReconcileOrphans` SHALL 同步扫描 `.opencode/agents/` 下的孤立 `iagent-*.md` 文件并纳入孤立产物报告。

#### Scenario: Orchestrator owns phase progression

- **WHEN** workflow command 在 OpenCode V2 中启动
- **THEN** 其当前 agent SHALL 负责 gate、handoff、receipt 与阶段推进
- **AND** worker agent MUST NOT 自行推进父 workflow 阶段

#### Scenario: Worker returns bounded result and loads skill instructions

- **WHEN** 生成阶段 worker agent `.opencode/agents/iagent-<workflowId>.md`
- **THEN** frontmatter 的 `description` SHALL 经 `normalizeHostSkillRefs` 归一化且经 `escapeYamlValue` 安全转义
- **AND** 正文 SHALL 指示启动时加载 `iagent-<workflowId>` 技能规程，并在完成被分配阶段后返回协议所需的状态、产物与公开签名

#### Scenario: OpenCode orphan agent 清理与 reconcile 扫描

- **WHEN** `.iagent/config.yaml` 的生效 `workflows` 集合缩小并执行 `iagent init` / `iagent update` 或运行 `scanReconcileOrphans`
- **THEN** `writeOpenCodeProjectArtifacts` SHALL 清理 `.opencode/agents/` 下已移出生效集的 `iagent-<id>.md`（保留 `iagent-orchestrator.md` 与用户自建非 `iagent-` 文件），且 `scanReconcileOrphans` SHALL 识别 `.opencode/agents/` 中孤立的 `iagent-*.md`

### Requirement: OpenCode 权限翻译完整性

OpenCode V2 的项目级权限与阶段 worker 权限 SHALL 覆盖 iagent 技能正文的实际调用面并遵循最小权限原则，使同一技能在 OpenCode 与 Claude 上的确认/失败行为一致：

- **`shell`**：SHALL 由生效技能 `allowedTools` 中实际存在的 `Bash(<cmd>:*)` 条目**按命令前缀派生**，同时支持单词命令（如 `Bash(codegraph:*)` → 资源 `"codegraph "`）与含空格的多词子命令（如 `Bash(git status:*)` → 资源 `"git status "`），MUST NOT 写入 `bash *` 一类全量放行。`isIagentRule` 的归属识别 SHALL 同步覆盖单/多词 `shell` 前缀规则。若未来版本语法变更，核实失败时 MUST NOT 生成猜测性规则，SHALL 记 WARN 并在诊断中列出未覆盖前缀。
- **worker 的 `edit` 与 `question` 面**：`renderWorkerPermissions` SHALL 仅在阶段技能模板的 `allowedTools` 包含 `Write` 或 `Edit` 时授予 `action: edit, resource: "*", effect: "allow"`；对只读技能（如 `review`、`proposal-review`、`spec-verify`、`spec-verify-proposal`）MUST NOT 授予 `action: edit`。所有阶段 worker SHALL 授予 `action: question, resource: "*", effect: "allow"` 以支持门控与澄清交互。
- **worker 的 `skill` 面**：阶段 worker 的 `skill` 权限 SHALL 覆盖「自身技能 + 该阶段实际委派目标」（委派目标取自模板 `Skill(...)` 条目的 canonical ID），使被委派技能在 worker 会话内可加载。
- **worker 的 `subagent` 面**：仅当该阶段模板 `allowedTools` 含派发条目（`Agent` / `Task`）时 SHALL 授予 `subagent`（资源限定 `iagent-*`）；未派发的阶段 MUST NOT 授予（最小权限）。
- **MCP**：iagent MUST NOT 生成猜测性的 MCP 权限规则，也 MUST NOT 覆盖用户既有 MCP 配置；未覆盖时 SHALL 在诊断中显式列出该缺口。
- **JSONC 解析与卸载安全**：`mergeOpenCodeProjectConfig` 与 `removeOpenCodeProjectArtifacts` SHALL 统一使用状态机 `stripJsonc` 剥离注释与尾逗号，确保含 `"$schema": "https://opencode.ai/config.json"` URL、行注释或块注释的 `.opencode/opencode.jsonc` 在 `iagent uninstall` 时能被正确解析并精确移除 `iagent` 管理的权限规则（无剩余用户规则与自定义字段时删除文件，有用户规则或自定义字段时保留文件）。

生成结果的权限规则 SHALL 保持幂等：重复 `init` / `update` 不产生重复规则，且 MUST NOT 删除或改写用户自建规则。

#### Scenario: bash 规则按单/多词实际命令前缀派生

- **WHEN** 生效技能 `allowedTools` 含 `Bash(codegraph:*)` 与 `Bash(git status:*)` 且 OpenCode 被纳入工具集
- **THEN** 项目级权限 SHALL 含 `{ action: 'shell', resource: 'codegraph ', effect: 'allow' }` 与 `{ action: 'shell', resource: 'git status ', effect: 'allow' }`，MUST NOT 出现 `bash *` 全量放行

#### Scenario: bash 资源语法未核实时不猜测

- **WHEN** OpenCode V2 的 `shell` 资源语法无法核实
- **THEN** 系统 MUST NOT 写入猜测性 `shell` 规则，SHALL 记 WARN 并在诊断中列出未覆盖的命令前缀

#### Scenario: 只读与可写 worker 的 edit 及 question 最小权限边界

- **WHEN** 为只读技能（如 `review`、`proposal-review`、`spec-verify`、`spec-verify-proposal`，`allowedTools` 不含 `Write`/`Edit`）与可写技能（如 `spec-apply`，含 `Write`/`Edit`）生成阶段 worker agent
- **THEN** 只读 worker 的 `permissions` MUST NOT 含 `action: edit`，可写 worker SHALL 含 `action: edit`，且两类 worker 均 SHALL 含 `action: question`

#### Scenario: 含 schema URL 与注释的 opencode.jsonc 卸载清理

- **WHEN** `.opencode/opencode.jsonc` 含有 `"$schema": "https://opencode.ai/config.json"`、JSONC 注释与 `iagent` 权限规则并执行 `removeOpenCodeProjectArtifacts`（如 `iagent uninstall`）
- **THEN** 系统 SHALL 使用 `stripJsonc` 正常解析配置并精确移除全部 `iagent` 权限规则（含多词 `shell` 规则），不因 URL 中的 `//` 抛错跳过；若文件仅含默认 `$schema` 且无剩余用户规则或自定义键则删除该文件，若有用户自定义规则则保留用户规则

#### Scenario: worker 获得其实际委派目标的 skill

- **WHEN** 为 `spec-apply` 阶段生成 worker agent（其模板委派 `iagent-test`）
- **THEN** 该 worker 的 `skill` 权限 MUST 含 `iagent-spec-apply` 与 `iagent-test`

#### Scenario: 派发型 worker 获得 subagent

- **WHEN** 某阶段模板 `allowedTools` 含 `Agent` / `Task`
- **THEN** 该阶段 worker 的权限 SHALL 含 `subagent`（资源限定 `iagent-*`）

#### Scenario: 无派发 worker 不获 subagent

- **WHEN** 某阶段模板 `allowedTools` 不含派发条目
- **THEN** 该阶段 worker 的权限 MUST NOT 含 `subagent`

#### Scenario: MCP 缺口显式诊断

- **WHEN** 生效技能使用 CodeGraph MCP 但 iagent 未生成 MCP 权限规则
- **THEN** 产物生成 SHALL 在诊断中列出该缺口，MUST NOT 静默视为已覆盖

#### Scenario: 权限规则幂等且不覆盖用户配置

- **WHEN** 对同一项目连续两次执行 `iagent update`（OpenCode 纳入）
- **THEN** 项目级权限规则集合一致（无重复），用户既有规则与字段保持不变
