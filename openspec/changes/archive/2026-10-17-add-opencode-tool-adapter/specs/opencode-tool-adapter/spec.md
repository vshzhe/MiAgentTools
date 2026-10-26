## ADDED Requirements

### Requirement: OpenCode 工具注册与产物布局

系统 SHALL 在 `AI_TOOLS` 中注册 OpenCode 目标工具，字段为 `value='opencode'`、`name='OpenCode'`、`skillsDir='.opencode'`、`commandsDir='.opencode/commands'`、`commandsLayout='prefixed-file'`。

技能产物 SHALL 生成到 `.opencode/skills/<技能名>/SKILL.md`（`skillsDir` 追加 `skills` 子目录）。指令产物 SHALL 生成到 `.opencode/commands/iagent-<指令 id>.md`，调用形式为 `/iagent-<指令 id>`，MUST NOT 生成 `.opencode/command/` 单数目录或命名空间子目录（`.opencode/commands/iagent/`）。

指令落点 MUST 经布局单点 `commandFilePath('opencode', id)` 解析，归属识别与删除（reconcile / uninstall）MUST 复用 `listManagedCommands` / `removeManagedCommands`，在 `.opencode/commands/` 下仅识别与删除 `iagent-` 前缀的 `.md`，MUST NOT 影响同目录的用户文件。

#### Scenario: 工具条目字段正确

- **WHEN** 读取 `AI_TOOLS` 中 `value==='opencode'` 的条目
- **THEN** `skillsDir` 为 `.opencode`、`commandsDir` 为 `.opencode/commands`、`commandsLayout` 为 `prefixed-file`

#### Scenario: 技能安装路径

- **WHEN** 对 OpenCode 生成技能 `iagent_workflow`
- **THEN** 产物落在 `.opencode/skills/iagent_workflow/SKILL.md`

#### Scenario: 指令安装路径与调用形式

- **WHEN** 对 OpenCode 生成指令 id 为 `spec-apply` 的产物
- **THEN** 产物路径为 `.opencode/commands/iagent-spec-apply.md`，调用形式为 `/iagent-spec-apply`

#### Scenario: 与用户文件共目录时的删除边界

- **WHEN** `.opencode/commands/` 同时含 `iagent-workflow.md` 与用户自建 `my-prompt.md`
- **THEN** `removeManagedCommands` 仅删除 `iagent-workflow.md`，保留 `my-prompt.md` 与承载目录

### Requirement: OpenCode 指令 frontmatter 与参数注入

OpenCode 指令产物的 YAML frontmatter SHALL 遵循 OpenCode 官方最小契约：仅含 `description`（展示用）与本工具的记账字段 `metadata.generatedBy` / `metadata.generatedFingerprint`；MUST NOT 写 Claude 专有的 `name` / `allowed-tools` / `category` / `tags` 字段。

当指令正文不含 `$ARGUMENTS` 或 `$1`..`$n` 参数占位符、且其 `**Input**:` 契约未声明 `None required` 时，适配器 SHALL 在 `**Input**:` 段落之后注入一行 `**Provided arguments**: $ARGUMENTS`，使 OpenCode 能把用户输入的参数传入指令。正文已含占位符或声明 `None required` 时 MUST NOT 注入。

frontmatter 的 `description` 值（含冒号/引号时）MUST 经 YAML 转义。产物 MUST 写入自洽的内容指纹，使 `iagent update` 的手改保护对 OpenCode 指令生效。

#### Scenario: 极简 frontmatter 且去 Claude 专有字段

- **WHEN** 生成任一 OpenCode 指令产物
- **THEN** frontmatter 含 `description`，MUST NOT 含 `name` / `allowed-tools` / `category` / `tags`

#### Scenario: 参数占位符注入

- **WHEN** 指令正文的 `**Input**:` 段落声明需要用户参数且正文无参数占位符
- **THEN** 适配器在该段落之后注入 `**Provided arguments**: $ARGUMENTS`

#### Scenario: 无参数指令不注入

- **WHEN** 指令正文的 `**Input**:` 声明为 `None required`
- **THEN** 产物 MUST NOT 出现 `**Provided arguments**: $ARGUMENTS`

#### Scenario: 已含占位符不重复注入

- **WHEN** 指令正文已含 `$ARGUMENTS` 或 `$1` 形式的占位符
- **THEN** 适配器 MUST NOT 追加第二处参数注入

#### Scenario: 指纹自洽

- **WHEN** 生成任一 OpenCode 指令产物
- **THEN** `readGeneratedFingerprint` 读得的指纹与 `fingerprintOf` 重算结果一致

### Requirement: OpenCode 会话级权限载体不适用

会话级权限载体的写入 SHALL 按目标工具的 `sessionPermissions` 能力开关控制。OpenCode 的 `sessionPermissions` SHALL 为 `false`：其权限走 `opencode.json` 的 `permission` 段（与 Claude 的 `permissions.allow` 语法不同）且默认宽松，写 `.opencode/settings.json` 为不被读取的惰性文件。`iagent init` / `iagent update` MUST 跳过 `sessionPermissions === false` 的工具，MUST NOT 生成 `.opencode/settings.json`。

未声明 `sessionPermissions` 或其为 `true` 的工具（claude / pi / codex）行为 MUST 保持不变，继续合并写 `<skillsDir>/settings.json`。

#### Scenario: OpenCode 不生成权限载件

- **WHEN** 以 `--tools opencode` 执行 `iagent init`
- **THEN** `.opencode/settings.json` MUST NOT 被创建，`permissionSettings` 不含 opencode 项

#### Scenario: 既有工具权限载体不变

- **WHEN** 以默认工具集执行 `iagent init`
- **THEN** claude / pi / codex 各自的 `<skillsDir>/settings.json` 仍被合并且结果与变更前一致

### Requirement: OpenCode 扫描排除与旧装机边界

项目预扫描的目录排除清单 SHALL 包含 `.opencode`，使生成的 OpenCode 产物不被误报为项目信号。旧装机迁移的旧指令根映射 SHALL 为 `opencode` 提供显式空值（OpenCode 无旧 `venus` 品牌产物），使迁移遍历的键集完整且不误删 `.opencode` 下内容。`.gitignore` SHALL 排除 `.opencode/`（本机 dogfood 产物不入库）。

#### Scenario: 预扫描排除 OpenCode 产物

- **WHEN** 项目含 `.opencode/skills/iagent_workflow/SKILL.md` 并执行项目预扫描
- **THEN** `.opencode` 内容不被采集为项目信号

#### Scenario: 旧装机迁移不误删 OpenCode 内容

- **WHEN** `.opencode/commands/user-file.md` 存在且执行旧装机迁移
- **THEN** 迁移 MUST NOT 删除该文件（旧指令根为空值）
