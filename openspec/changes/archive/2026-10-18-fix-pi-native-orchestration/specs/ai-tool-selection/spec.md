## MODIFIED Requirements

### Requirement: Pi strict runtime detection

当 Pi 被选为目标工具且项目启用需要严格编排的 workflow 时，`iagent init` SHALL 检测 Pi 版本、默认 npm runtime、已加载的编排能力，以及原生委派入口（`.pi/agents/<subagent_type>.md`）是否齐备。默认 runtime 为 `@tintinweb/pi-subagents` 的 npm latest 版本；检测结果 SHALL 包含请求版本、实际解析版本、Pi 兼容性与可用能力。仅当版本兼容、runtime 已安装且所需原生委派入口全部可解析时 SHALL 标记 `strict`；否则 SHALL 标记 `degraded` 并列出缺失项。

#### Scenario: Compatible runtime is installed

- **WHEN** Pi 版本满足 runtime 要求、runtime 已安装并可加载，且所需原生委派入口齐备
- **THEN** 初始化结果 SHALL 将 Pi 编排状态标记为 `strict`
- **AND** SHALL 生成 strict 所需的 Pi 产物

#### Scenario: Runtime is missing

- **WHEN** Pi 被选中但默认 runtime 不存在
- **THEN** init SHALL 默认尝试通过 Pi 的项目级 npm package 安装机制安装该 runtime
- **AND** SHALL 输出安装动作与目标包信息

#### Scenario: Runtime installed but native entries missing

- **WHEN** runtime 已安装但所需 `.pi/agents/<subagent_type>.md` 缺失，或其 frontmatter 无法解析
- **THEN** 编排状态 SHALL 为 `degraded`
- **AND** 诊断 SHALL 列出缺失或不可解析的 agent 名称

## ADDED Requirements

### Requirement: Pi session permissions carrier not applicable

`iagent init` / `iagent update` SHALL NOT 向 `.pi/settings.json` 写入 Claude 风格的 `permissions.allow`。Pi 的能力控制走 `defaultTools` 等 Pi 原生设置；写入不被读取的权限段会误导用户。

#### Scenario: Pi settings 不含 Claude 权限段

- **WHEN** 以 `--tools pi` 执行 `iagent init`
- **THEN** `.pi/settings.json` MUST NOT 含 `permissions.allow`
- **AND** MUST NOT 仅因权限载体而创建该文件

#### Scenario: Claude 权限载体行为不变

- **WHEN** 以默认工具集执行 `iagent init`
- **THEN** Claude 的 `.claude/settings.json` 仍按既有规则合并且行为不变

### Requirement: Pi runtime diagnostics include native entry status

Pi 运行时诊断 SHALL 包含原生委派入口状态（所需 agent 定义是否齐备、缺失项名称），与版本、安装状态、冲突一并写入 `.iagent/pi-runtime.json`。

#### Scenario: 诊断可区分缺包与缺定义

- **WHEN** 用户查看 `.iagent/pi-runtime.json`
- **THEN** SHALL 能区分「运行时未安装」与「运行时已安装但 agent 定义缺失」
- **AND** `orchestration` 字段 SHALL 与诊断结论一致
