# Spec Delta

## Purpose

定义 `iagent` 目标 AI 工具集的选择、解析与持久化语义：用户通过 `--tools` 参数或
`.iagent/config.yaml` 的 `tools` 字段声明要为哪些工具生成产物，选择在初始化后保持稳定，
后续更新不再静默改变已排除的工具。

## ADDED Requirements

### Requirement: 目标工具集解析优先级
系统 SHALL 按 `--tools` CLI 参数 > `.iagent/config.yaml` 的 `tools` 字段 > 全部已注册工具的
优先级解析生效工具集，CLI 参数以逗号或空白分隔。

#### Scenario: CLI 参数覆盖配置
- **WHEN** `config.yaml` 的 `tools` 为 `[claude]`，执行 `iagent init --tools pi`
- **THEN** 本次生效工具集为 `[pi]`，MUST NOT 安装 claude 产物

#### Scenario: 无 CLI 参数时读取配置
- **WHEN** `config.yaml` 的 `tools` 为 `[claude, pi]`，执行 `iagent update` 且不带 `--tools`
- **THEN** 生效工具集为 `[claude, pi]`

#### Scenario: 未配置时用全部工具
- **WHEN** `.iagent/config.yaml` 不存在或其 `tools` 字段为空，执行且不带 `--tools`
- **THEN** 生效工具集为全部已注册工具

### Requirement: 未知工具标识报错
系统 SHALL 在解析到未注册的工具标识时抛出错误，错误信息 MUST 同时给出该非法标识与全部合法标识。

#### Scenario: 非法工具 id
- **WHEN** 执行 `iagent init --tools not-a-tool`
- **THEN** 解析抛错，错误信息包含 `not-a-tool` 与全部合法工具 id

### Requirement: init 持久化工具选择
`iagent init` SHALL 将本次解析出的生效工具集回写 `.iagent/config.yaml` 的 `tools` 字段，
使选择在后续不带 `--tools` 的命令中保持稳定。

#### Scenario: 显式选择后持久化
- **WHEN** 新项目执行 `iagent init --tools claude`
- **THEN** `config.yaml` 的 `tools` 写入 `[claude]`，且本次仅安装 claude 产物

#### Scenario: 未指定时保持稳定
- **WHEN** `config.yaml` 的 `tools` 为 `[claude]`，再次执行不带 `--tools` 的 `iagent init`
- **THEN** `tools` 字段仍为 `[claude]`，MUST NOT 被扩展为全部工具

#### Scenario: 初始化后更新不复活已排除工具
- **WHEN** `iagent init --tools claude` 之后执行不带 `--tools` 的 `iagent update`
- **THEN** 仅刷新 claude 产物，MUST NOT 安装此前排除的 pi、codex 产物

### Requirement: update 仅在显式指定时回写
`iagent update` SHALL 仅在显式传入 `--tools` 时回写 `.iagent/config.yaml` 的 `tools` 字段；
未传入时 MUST 只读不写，避免常规刷新意外改动持久选择。

#### Scenario: 常规刷新不改配置
- **WHEN** `config.yaml` 的 `tools` 为 `[claude]`，执行 `iagent update`
- **THEN** `config.yaml` 内容不变

#### Scenario: 显式重新选择时回写
- **WHEN** `config.yaml` 的 `tools` 为 `[claude]`，执行 `iagent update --tools claude,pi`
- **THEN** `tools` 写入 `[claude, pi]`，后续不带 `--tools` 的命令按该集合生效

### Requirement: 缺省配置的可见性
首次创建 `.iagent/config.yaml` 时，系统 SHALL 在其中显式列出 `tools` 字段（含注释说明其作用），
使生效的工具选择可被用户查看与编辑。

#### Scenario: 首次初始化生成 tools 段
- **WHEN** 项目无 `.iagent/` 并执行 `iagent init`
- **THEN** 生成的 `config.yaml` 含 `tools` 段，列出本次生效的工具，并带用途注释
