# Spec Delta

## MODIFIED Requirements

### Requirement: OpenCode 工具注册与产物布局

系统 SHALL 在 `AI_TOOLS` 中注册 OpenCode V2 目标工具，字段为 `value='opencode'`、`name='OpenCode'`、`skillsDir='.opencode'`、`commandsDir='.opencode/commands'`、`commandsLayout='prefixed-file'`。技能产物 SHALL 生成到 `.opencode/skills/iagent-<workflowId>/SKILL.md`，指令产物 SHALL 生成到 `.opencode/commands/iagent-<workflowId>.md`，调用形式为 `/iagent-<workflowId>`。系统 MUST NOT 生成 `.opencode/command/` 单数目录或命名空间子目录。

#### Scenario: V2 skill installation path

- **WHEN** 为 canonical workflowId `spec-explore` 生成 OpenCode V2 技能
- **THEN** 产物 SHALL 位于 `.opencode/skills/iagent-spec-explore/SKILL.md`
- **AND** skill ID SHALL 按路径解析为 `iagent-spec-explore`

#### Scenario: V2 command installation path

- **WHEN** 为 canonical workflowId `spec-explore` 生成 OpenCode V2 指令
- **THEN** 产物 SHALL 位于 `.opencode/commands/iagent-spec-explore.md`
- **AND** 调用形式 SHALL 为 `/iagent-spec-explore`

#### Scenario: User files remain isolated

- **WHEN** `.opencode/commands/` 同时含 iagent 文件与用户自建 Markdown
- **THEN** reconcile/uninstall SHALL 只识别 `iagent-` 前缀文件
- **AND** MUST 保留用户文件与承载目录

#### Scenario: 工具条目字段正确

- **WHEN** 读取 `AI_TOOLS` 中 `value==='opencode'` 的条目
- **THEN** `skillsDir` 为 `.opencode`、`commandsDir` 为 `.opencode/commands`、`commandsLayout` 为 `prefixed-file`

#### Scenario: 技能安装路径

- **WHEN** 对 OpenCode V2 生成 canonical workflowId 为 `workflow` 的技能
- **THEN** 产物 SHALL 位于 `.opencode/skills/iagent-workflow/SKILL.md`

#### Scenario: 指令安装路径与调用形式

- **WHEN** 对 OpenCode V2 生成 canonical workflowId 为 `spec-apply` 的指令
- **THEN** 产物路径为 `.opencode/commands/iagent-spec-apply.md`，调用形式为 `/iagent-spec-apply`

#### Scenario: 与用户文件共目录时的删除边界

- **WHEN** `.opencode/commands/` 同时含 iagent 文件与用户自建 `my-prompt.md`
- **THEN** 清理只删除 iagent 前缀文件，保留 `my-prompt.md` 与承载目录

### Requirement: OpenCode 指令 frontmatter 与参数注入

OpenCode V2 指令 frontmatter SHALL 仅使用 V2 支持的 `description`、`agent`、`model`、`subagent` 与 iagent 记账 metadata。MUST NOT 写 Claude 专有的 `name`、`allowed-tools`、`category`、`tags`。当正文需要参数且没有占位符时，适配器 SHALL 注入 `$ARGUMENTS`；既有占位符或 `None required` 时 MUST NOT 重复注入。

#### Scenario: V2 command selects orchestrator

- **WHEN** 生成需要编排的 workflow command
- **THEN** frontmatter SHALL 指定项目级 primary orchestrator agent
- **AND** SHALL 明确 `subagent: false`，除非该 command 本身声明为后台子 agent

#### Scenario: V2 command delegates worker

- **WHEN** 生成阶段 worker command
- **THEN** frontmatter MAY 指定对应 agent 与 `subagent: true`
- **AND** 运行结果 SHALL 返回到父 session

#### Scenario: Arguments are preserved

- **WHEN** command 正文没有 `$ARGUMENTS` 或 `$1`..`$n` 且 Input 契约需要参数
- **THEN** 生成内容 SHALL 注入 `**Provided arguments**: $ARGUMENTS`

#### Scenario: Claude fields are absent

- **WHEN** 检查任一 OpenCode V2 command frontmatter
- **THEN** MUST NOT 含 `name`、`allowed-tools`、`category`、`tags`

#### Scenario: 指纹自洽

- **WHEN** 生成任一 OpenCode V2 command 产物
- **THEN** `generatedFingerprint` SHALL 与完整文件内容重算结果一致

#### Scenario: 极简 frontmatter 且去 Claude 专有字段

- **WHEN** 生成任一 OpenCode V2 指令产物
- **THEN** frontmatter 含 `description`，MUST NOT 含 `name` / `allowed-tools` / `category` / `tags`

#### Scenario: 参数占位符注入

- **WHEN** 指令正文的 `**Input**:` 契约声明需要用户参数且正文无参数占位符
- **THEN** 适配器 SHALL 在该段落后注入 `**Provided arguments**: $ARGUMENTS`

#### Scenario: 无参数指令不注入

- **WHEN** 指令正文的 `**Input**:` 声明为 `None required`
- **THEN** 产物 MUST NOT 出现 `**Provided arguments**: $ARGUMENTS`

#### Scenario: 已含占位符不重复注入

- **WHEN** 指令正文已含 `$ARGUMENTS` 或 `$1` 形式的占位符
- **THEN** 适配器 MUST NOT 追加第二处参数注入

### Requirement: OpenCode 会话级权限载体不适用

OpenCode V2 的权限 SHALL 通过项目级 `permissions` 配置与 agent permissions 表达。`iagent init` / `iagent update` MUST NOT 生成 `.opencode/settings.json`，也 MUST NOT 把 Claude 的 `permissions.allow` 条目写入 OpenCode。需要 strict workflow 的 iagent permissions SHALL 写入项目 `.opencode/opencode.jsonc` 或对应项目 agent 定义，并保持用户已有非 iagent 配置不变。

#### Scenario: OpenCode V2 不生成 Claude 权限载体

- **WHEN** 以 `--tools opencode` 执行 `iagent init`
- **THEN** `.opencode/settings.json` MUST NOT 被创建
- **AND** MUST NOT 写入 Claude 风格 `permissions.allow`

#### Scenario: OpenCode V2 项目权限生成

- **WHEN** OpenCode strict workflow 需要 `skill` 或 `subagent`
- **THEN** 相关权限 SHALL 写入项目级 V2 `permissions` 结构
- **AND** 权限资源 SHALL 限定到 iagent 生成的 skill/agent ID

#### Scenario: Existing user config preserved

- **WHEN** `.opencode/opencode.jsonc` 已存在用户配置
- **THEN** iagent SHALL 增量加入自己的权限与配置
- **AND** MUST 保留非 iagent 字段、agent 与权限规则

#### Scenario: OpenCode 不生成权限载件

- **WHEN** 以 `--tools opencode` 执行 `iagent init`
- **THEN** `.opencode/settings.json` MUST NOT 被创建
- **AND** `permissionSettings` MUST NOT 写入 Claude 风格权限条目

#### Scenario: 既有工具权限载体不变

- **WHEN** 以默认工具集执行 `iagent init`
- **THEN** Claude、Pi 与 Codex 的既有权限载体行为 SHALL 保持不变

## ADDED Requirements

### Requirement: OpenCode 项目级编排配置

`iagent init` SHALL 在项目 `.opencode/` 内生成或增量更新 V2 配置与 agent 定义，以提供 iagent workflow 所需的 `skill`、`subagent`、读取、编辑与询问权限。默认 MUST NOT 修改用户根目录的 `opencode.json` 或 `opencode.jsonc`；只有项目级配置无法表达所需能力时才报告需要根目录配置。

#### Scenario: Project-local V2 config

- **WHEN** OpenCode 被显式选中且项目需要 strict workflow
- **THEN** 系统 SHALL 生成或更新 `.opencode/opencode.jsonc`
- **AND** SHALL 保留用户已有配置字段与非 iagent 权限规则

#### Scenario: Native skill permission

- **WHEN** iagent workflow 需要加载 iagent skill
- **THEN** 项目级权限 SHALL 允许对应 `skill` resource
- **AND** MUST NOT 通过 Claude 风格 `allowed-tools` 伪造该授权

#### Scenario: Native subagent permission

- **WHEN** iagent orchestrator 需要启动 iagent worker
- **THEN** 项目级或 orchestrator agent 权限 SHALL 允许对应 `subagent` resource
- **AND** 未授权时 SHALL 报告能力缺失而不是静默本地执行

### Requirement: OpenCode V2 project agents

系统 SHALL 为需要 strict 编排的 workflow 生成项目级 primary orchestrator 与 subagent agent 定义。orchestrator 负责阶段推进与回执汇总；worker 负责单阶段任务并返回协议规定的 receipt。子 agent 深度与可委派范围 SHALL 可被项目配置约束。

#### Scenario: Orchestrator owns phase progression

- **WHEN** workflow command 在 OpenCode V2 中启动
- **THEN** 其当前 agent SHALL 负责 gate、handoff、receipt 与阶段推进
- **AND** worker agent MUST NOT 自行推进父 workflow 阶段

#### Scenario: Worker returns bounded result

- **WHEN** worker agent 完成被分配阶段
- **THEN** SHALL 返回协议所需的状态、产物与公开签名
- **AND** MUST NOT 执行未分配阶段

### Requirement: OpenCode V2 native delegation references

OpenCode V2 生成的 workflow 正文 SHALL 使用宿主适配后的 `skill` 与 `subagent` 语义，MUST NOT 出现要求模型调用 Claude 专属 `Skill(...)`、`Agent` 或 `Task` 的不可执行指令。

#### Scenario: Skill reference is V2-compatible

- **WHEN** workflow 需要加载 `iagent-spec-explore`
- **THEN** 生成正文或 agent prompt SHALL 指向 V2 的 `skill` 工具与准确 ID
- **AND** MUST NOT 使用下划线 legacy ID 作为新产物的唯一入口

#### Scenario: Delegation reference is V2-compatible

- **WHEN** workflow 需要启动阶段 worker
- **THEN** 生成正文 SHALL 指向 V2 `subagent` 与项目 agent ID
- **AND** MUST NOT 依赖 `Agent, Task` 字面白名单来创建委派能力
