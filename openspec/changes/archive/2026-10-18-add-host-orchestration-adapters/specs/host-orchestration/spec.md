# Spec Delta

## Purpose

为同一套 iagent 工作流提供跨 Claude Code、OpenCode V2 与 Pi 的可验证编排契约。该能力把阶段、委派、回执、门控与能力缺失行为统一描述，再由各宿主使用自身支持的原生编排能力执行。

## ADDED Requirements

### Requirement: Shared workflow protocol

系统 SHALL 为每个可编排工作流定义稳定的 canonical `workflowId`、阶段序列、输入契约、阶段 handoff、回执字段、确认门语义、重试策略与所需宿主能力。共享协议 MUST NOT 要求调用某一宿主专属的 Skill、Agent、Task 或工具名称。

#### Scenario: Stable workflow identity

- **WHEN** 同一工作流被生成到 Claude Code、OpenCode V2 与 Pi
- **THEN** 三个宿主产物 SHALL 使用同一个 canonical `workflowId`
- **AND** 宿主可见的 skill、agent、command 名称 SHALL 由该 ID 按宿主规则派生

#### Scenario: Structured handoff

- **WHEN** 一个阶段完成并进入下一阶段
- **THEN** 委派结果 SHALL 包含协议声明的 handoff 字段
- **AND** 缺少必需字段时 SHALL 被判定为阶段失败或不完整，不得静默推进

### Requirement: Host capability negotiation

系统 SHALL 在执行严格编排前确认宿主具备工作流声明的能力，包括技能加载、参数传递、子 agent 委派、回执返回、确认门与状态持续能力。能力检查结果 SHALL 可被用户查看并写入运行诊断元数据。

#### Scenario: Strict host is capable

- **WHEN** 宿主满足当前工作流的全部必需能力
- **THEN** 工作流 SHALL 进入 strict 编排
- **AND** 阶段委派与回执 SHALL 使用宿主原生机制

#### Scenario: Strict host is missing a capability

- **WHEN** 宿主缺少任一必需能力且未选择 degraded 模式
- **THEN** 工作流 SHALL 停止并报告缺失能力、影响阶段与可选补救方式
- **AND** MUST NOT 把当前 agent 的本地执行结果伪装为委派完成

### Requirement: Explicit degraded mode

系统 SHALL 将 degraded 模式作为显式运行状态。degraded 模式 SHALL 明确列出未提供的能力，并禁止把本地串行执行、普通 prompt 展开或模型自行推理标记为 strict 委派、子 agent 回执或严格 gate 已完成。

#### Scenario: User selects degraded mode

- **WHEN** 用户明确选择 degraded 模式
- **THEN** 系统 SHALL 生成或运行降级工作流，并在输出与元数据中标记 `degraded`
- **AND** 每个被跳过的委派、回执或门控能力 SHALL 记录原因

#### Scenario: Installation failure falls back to degraded

- **WHEN** Pi strict 运行时安装失败且初始化流程继续
- **THEN** 系统 SHALL 继续生成 degraded 产物
- **AND** SHALL 输出安装失败告警与 degraded 限制

### Requirement: Native host orchestration mapping

系统 SHALL 将共享协议映射到宿主原生编排能力：Claude Code 使用 Skill/Agent/询问与 hooks；OpenCode V2 使用 `skill`、`subagent`、agents、commands 与 `permissions`；Pi 使用已安装的 Extension/Package 提供的 Agent、workflow、状态与门控工具。共享正文 MUST NOT 直接假设任一映射存在于全部宿主。

#### Scenario: OpenCode V2 delegation

- **WHEN** OpenCode V2 执行一个需要委派的阶段
- **THEN** SHALL 通过 V2 `subagent` 能力启动配置的项目级 agent
- **AND** 技能加载 SHALL 使用 V2 `skill` 能力与 canonical skill ID

#### Scenario: Pi delegation

- **WHEN** Pi strict 运行时已安装并通过能力检查
- **THEN** SHALL 通过已安装 npm Extension 提供的委派/工作流能力执行阶段
- **AND** 不得仅依赖 SKILL.md 中的自然语言委派指令

### Requirement: Gate and receipt enforcement

系统 SHALL 将共享确认门和回执契约映射为宿主可执行的检查点。门未通过时 SHALL 阻止后续阶段；回执未通过校验时 SHALL 阻止自动推进，并报告恢复路径。

#### Scenario: Gate blocks transition

- **WHEN** 当前阶段到达需要用户确认的 gate 且用户尚未确认
- **THEN** 宿主 SHALL 停止推进后续阶段
- **AND** 下一阶段不得在同一运行中被预执行

#### Scenario: Invalid receipt blocks transition

- **WHEN** 下游阶段返回缺失字段、状态失败或不匹配的 receipt
- **THEN** 编排器 SHALL 停止阶段推进并报告失败原因
- **AND** SHALL 保留重试、修复或显式 degraded 的选择

### Requirement: Runtime provider replacement

Pi 编排运行时 SHALL 通过可替换的 provider 语义接入，当前默认 provider 为 npm 包 `@tintinweb/pi-subagents` 的 latest 版本。未来替换为 iagent 自有 npm 包时，SHALL NOT 改变共享工作流协议、canonical workflowId 或其他宿主适配契约。

#### Scenario: Resolve latest provider

- **WHEN** `iagent init` 为 Pi 尝试安装默认运行时
- **THEN** SHALL 请求 npm 包的 latest 版本并记录实际解析版本
- **AND** SHALL 检查 Pi 版本与运行时兼容性

#### Scenario: Provider can be replaced

- **WHEN** 未来配置 iagent 自有 Pi npm provider
- **THEN** strict/degraded 判断、能力报告与共享协议 SHALL 保持不变
