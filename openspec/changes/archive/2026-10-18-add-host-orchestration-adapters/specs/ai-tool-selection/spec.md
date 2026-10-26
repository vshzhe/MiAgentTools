# Spec Delta

## ADDED Requirements

### Requirement: Pi strict runtime detection

当 Pi 被选为目标工具且项目启用需要严格编排的 workflow 时，`iagent init` SHALL 检测 Pi 版本、默认 npm runtime 与已加载的编排能力。默认 runtime 为 `@tintinweb/pi-subagents` 的 npm latest 版本；检测结果 SHALL 包含请求版本、实际解析版本、Pi 兼容性与可用能力。

#### Scenario: Compatible runtime is installed

- **WHEN** Pi 版本满足 runtime 要求且 runtime 已安装并可加载
- **THEN** 初始化结果 SHALL 将 Pi 编排状态标记为 `strict`
- **AND** SHALL 生成 strict 所需的 Pi 产物

#### Scenario: Runtime is missing

- **WHEN** Pi 被选中但默认 runtime 不存在
- **THEN** init SHALL 默认尝试通过 Pi 的项目级 npm package 安装机制安装该 runtime
- **AND** SHALL 输出安装动作与目标包信息

### Requirement: Pi installation failure fallback

Pi runtime 安装失败、版本不兼容或加载检测失败时，`iagent init` SHALL 继续生成 Pi 的 degraded 产物，不得阻断其他工具的初始化。结果 SHALL 标记 degraded、记录失败原因并列出 strict 能力缺口。

#### Scenario: Install fails

- **WHEN** `pi install npm:@tintinweb/pi-subagents --local` 返回失败
- **THEN** init SHALL 继续生成 Pi skills 与 prompt templates
- **AND** SHALL 将 Pi 编排状态标记为 `degraded`
- **AND** SHALL 输出可复制的手动安装与重试建议

#### Scenario: Incompatible runtime

- **WHEN** npm 包已存在但不满足当前 Pi 版本要求
- **THEN** init SHALL 不启用 strict 编排
- **AND** SHALL 继续生成 degraded 产物并报告版本冲突

### Requirement: Runtime status persistence

Pi runtime 的请求版本、解析版本、安装状态、能力状态与失败原因 SHALL 写入项目级可诊断元数据。该元数据 MUST NOT 覆盖用户已有的非 iagent 配置内容。

#### Scenario: Diagnose current mode

- **WHEN** 用户查看 init/update 结果或项目工具状态
- **THEN** SHALL 能区分 Pi 的 `strict`、`degraded`、`not-selected` 与 `failed` 状态
- **AND** SHALL 显示最近一次解析版本与失败原因（如有）

### Requirement: Future Pi runtime provider replacement

Pi runtime 的包名与安装逻辑 SHALL 可替换。替换为 iagent 自有 npm 包时，用户配置、共享 workflowId 与宿主产物契约 SHALL 保持兼容。

#### Scenario: Replace runtime provider

- **WHEN** 项目配置将 Pi runtime provider 切换到 iagent 自有 npm 包
- **THEN** init SHALL 使用新 provider 执行检测与安装
- **AND** SHALL 保持 strict/degraded 状态语义与诊断结构不变
