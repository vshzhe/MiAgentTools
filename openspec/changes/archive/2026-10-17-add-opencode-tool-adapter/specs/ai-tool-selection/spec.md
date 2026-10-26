## MODIFIED Requirements

### Requirement: 目标工具集解析优先级
系统 SHALL 按 `--tools` CLI 参数 > `.iagent/config.yaml` 的 `tools` 字段 > **默认工具集**的优先级解析生效工具集，CLI 参数以逗号或空白分隔。默认工具集 = 全部已注册工具中**排除 opt-in 工具**后的集合（当前为 claude / pi / codex；opencode 为 opt-in，仅在显式指定时纳入）。

#### Scenario: CLI 参数覆盖配置
- **WHEN** `config.yaml` 的 `tools` 为 `[claude]`，执行 `iagent init --tools pi`
- **THEN** 本次生效工具集为 `[pi]`，MUST NOT 安装 claude 产物

#### Scenario: 无 CLI 参数时读取配置
- **WHEN** `config.yaml` 的 `tools` 为 `[claude, pi]`，执行 `iagent update` 且不带 `--tools`
- **THEN** 生效工具集为 `[claude, pi]`

#### Scenario: 未配置时用默认工具集
- **WHEN** `.iagent/config.yaml` 不存在或其 `tools` 字段为空，执行且不带 `--tools`
- **THEN** 生效工具集为默认工具集（排除 opt-in 工具），MUST NOT 包含 opt-in 工具

#### Scenario: 显式指定 opt-in 工具
- **WHEN** 执行 `iagent init --tools opencode` 或 `config.yaml` 的 `tools` 含 `opencode`
- **THEN** 生效工具集包含 opencode，并生成 `.opencode/` 产物

## ADDED Requirements

### Requirement: 可选（opt-in）工具

`AIToolOption` SHALL 提供可选布尔字段 `optIn` 以标记 opt-in 工具。未声明或 `optIn !== true` 的工具 SHALL 视为默认工具集成员；`optIn === true` 的工具 MUST 被排除在「未配置回退」之外，仅在 `--tools` 显式指定或 `config.yaml` 的 `tools` 显式列出时纳入生效集。OpenCode SHALL 标记为 opt-in。

`iagent generate` 的安装目标 SHALL 经同一 `resolveActiveTools` 解析，使 opt-in 语义对生成骨架同样成立，MUST NOT 无条件安装到全部 `AI_TOOLS`。

#### Scenario: 未配置不生成 opt-in 产物
- **WHEN** 项目无 `.iagent/config.yaml` 且执行 `iagent init`
- **THEN** 生效工具集不含 opencode，`.opencode/` 目录 MUST NOT 被创建

#### Scenario: 显式配置才生成 opt-in 产物
- **WHEN** `config.yaml` 的 `tools` 含 `opencode` 且执行 `iagent update`
- **THEN** opencode 产物按 OpenCode 布局生成

#### Scenario: generate 尊重 opt-in
- **WHEN** 在未配置 opencode 的项目执行 `iagent generate --type tools --name env-check`
- **THEN** 仅安装到默认工具集目录，MUST NOT 写入 `.opencode/skills/`
