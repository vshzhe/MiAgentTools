## ADDED Requirements

### Requirement: OpenCode 权限翻译完整性

OpenCode V2 的项目级权限 SHALL 覆盖 iagent 技能正文的实际调用面，使同一技能在 OpenCode 与 Claude 上的确认/失败行为一致，MUST NOT 因权限翻译缺口把可执行阶段降级为弹窗或失败。翻译规则：

- **`shell`**：SHALL 由生效技能 `allowedTools` 中实际存在的 `Bash(<cmd>:*)` 条目**按命令前缀派生**（如 `Bash(codegraph:*)` → 资源 `codegraph `），MUST NOT 写入 `bash *` 一类全量放行。资源语法已核实（OpenCode V2 Permissions：动作名 **`shell`**，resource 为命令串，前缀按「命令 + 空格」匹配；核实来源：<https://opencode.ai/v2/docs/permissions>）。若未来版本语法变更，核实失败时 MUST NOT 生成猜测性规则，SHALL 记 WARN 并在诊断中列出未覆盖前缀。
- **worker 的 `skill` 面**：阶段 worker 的 `skill` 权限 SHALL 覆盖「自身技能 + 该阶段实际委派目标」（委派目标取自模板 `Skill(...)` 条目的 canonical ID），使被委派技能在 worker 会话内可加载。
- **worker 的 `subagent` 面**：仅当该阶段模板 `allowedTools` 含派发条目（`Agent` / `Task`）时 SHALL 授予 `subagent`（资源限定 `iagent-*`）；未派发的阶段 MUST NOT 授予（最小权限）。
- **MCP**：iagent MUST NOT 生成猜测性的 MCP 权限规则，也 MUST NOT 覆盖用户既有 MCP 配置；未覆盖时 SHALL 在诊断中显式列出该缺口。

生成结果的权限规则 SHALL 保持幂等：重复 `init` / `update` 不产生重复规则，且 MUST NOT 删除或改写用户自建规则。

#### Scenario: bash 规则按实际命令前缀派生

- **WHEN** 生效技能 `allowedTools` 含 `Bash(codegraph:*)` 且 OpenCode 被纳入工具集
- **THEN** 项目级权限 SHALL 含 `{ action: 'shell', resource: 'codegraph ', effect: 'allow' }`，MUST NOT 出现 `bash *` 全量放行

#### Scenario: bash 资源语法未核实时不猜测

- **WHEN** OpenCode V2 的 `shell` 资源语法无法核实
- **THEN** 系统 MUST NOT 写入猜测性 `shell` 规则，SHALL 记 WARN 并在诊断中列出未覆盖的命令前缀

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

## MODIFIED Requirements

### Requirement: OpenCode 项目级编排配置

`iagent init` SHALL 在项目 `.opencode/` 内生成或增量更新 V2 配置与 agent 定义，以提供 iagent workflow 所需的 `skill`、`subagent`、`shell`、读取、编辑与询问权限。默认 MUST NOT 修改用户根目录的 `opencode.json` 或 `opencode.jsonc`；只有项目级配置无法表达所需能力时才报告需要根目录配置。

`shell` 与 worker 委派面 SHALL 按「OpenCode 权限翻译完整性」的要求派生，MUST NOT 只翻译 `skill` / `subagent` 两类而遗漏技能正文实际使用的命令与委派目标；无法表达的条目 SHALL 记入诊断（WARN），MUST NOT 静默略过。

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

#### Scenario: bash 面不再缺失

- **WHEN** 以 `--tools opencode` 执行 `iagent init` 且生效技能正文含 `codegraph` CLI 调用
- **THEN** 项目级权限 SHALL 表达对应 `bash` 前缀（或记 WARN 列入诊断），MUST NOT 完全缺失该动作类别

#### Scenario: worker 委派面不再缺失

- **WHEN** 某阶段技能正文委派子技能或派发子代理
- **THEN** 该阶段 worker agent 的权限 SHALL 覆盖对应 `skill`（及条件 `subagent`），使 worker 会话内可执行该委派
