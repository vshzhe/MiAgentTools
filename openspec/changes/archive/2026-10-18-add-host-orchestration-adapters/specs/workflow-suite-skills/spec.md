# Spec Delta

## MODIFIED Requirements

### Requirement: workflow 探索阶段委派 spec-explore

`iagent_workflow` 的 Phase 1 SHALL 经当前宿主的原生编排适配器委派 `iagent-spec-explore`，并传递 `mode=delegated`。Claude Code 使用 Skill 工具，OpenCode V2 使用 `skill` / `subagent` 与项目 agent，Pi strict 使用已安装的 Pi Extension；MUST NOT 要求所有宿主直接执行 Claude 专属 `Skill(...)`。委派 SHALL 执行强制 checkpoint 体系，并返回探索文件路径、提示词基线、流程基准确认状态与 Pending 影响符号。

#### Scenario: Claude Code realization

- **WHEN** Claude Code 执行 workflow Phase 1
- **THEN** SHALL 通过 Claude 原生 Skill/Agent 能力委派探索
- **AND** SHALL 消费结构化 handoff 后推进 Phase 2

#### Scenario: OpenCode V2 realization

- **WHEN** OpenCode V2 执行 workflow Phase 1
- **THEN** SHALL 通过 V2 `skill` 与项目级 subagent agent 委派探索
- **AND** SHALL 消费结构化 handoff 后推进 Phase 2

#### Scenario: Pi realization

- **WHEN** Pi strict 执行 workflow Phase 1
- **THEN** SHALL 通过已安装 Extension 的原生委派能力执行探索
- **AND** Pi degraded 模式 SHALL 显式标记未发生 strict 委派

#### Scenario: 探索阶段委派而非内联

- **WHEN** `iagent_workflow` 启动并进入 Phase 1
- **THEN** 系统 SHALL 通过当前宿主的原生编排适配器委派 `iagent-spec-explore`
- **AND** MUST NOT 由主 workflow 正文内联执行完整探索 checkpoint 体系

#### Scenario: 消费结构化 handoff

- **WHEN** 委派的探索阶段返回 handoff
- **THEN** `workflow` SHALL 消费探索文件路径、提示词基线、流程基准确认状态与 Pending 影响符号
- **AND** SHALL 据此决定是否推进 Phase 2

#### Scenario: 探索阶段阶段主权归编排器

- **WHEN** 委派的探索阶段完成
- **THEN** worker MUST NOT 自行进入提案或实现
- **AND** 阶段完成判定与推进主权 SHALL 归 workflow orchestrator

### Requirement: 编排技能 SHALL 委派其声明的全部子技能且齐备授权

编排技能正文与宿主适配产物 SHALL 对每个实际委派目标声明可执行的宿主原生能力。Claude Code 的调用类白名单仍 SHALL 覆盖 `Skill(<裸名>)`、`Agent`、`Task` 与 CodeGraph MCP；OpenCode V2 SHALL 使用 `skill`、`subagent` 与 `permissions`；Pi SHALL 使用 Extension 提供的对应工具。授权缺失时 strict 编排 MUST 阻断，不得静默转为本地执行。

#### Scenario: Claude whitelist remains complete

- **WHEN** Claude Code 检查编排技能授权
- **THEN** 其 `allowedTools` SHALL 覆盖正文实际委派与 MCP 调用
- **AND** 不得产生幽灵或缺失委派条目

#### Scenario: OpenCode V2 permissions are complete

- **WHEN** OpenCode V2 检查 workflow orchestrator agent
- **THEN** 其项目权限 SHALL 覆盖实际 `skill` 与 `subagent` 目标
- **AND** 缺失权限时 SHALL 报告能力缺失

#### Scenario: Pi strict runtime is complete

- **WHEN** Pi strict 执行编排技能
- **THEN** Extension SHALL 提供协议所需的委派、回执与门控工具
- **AND** 工具缺失时 SHALL 进入 strict 阻断或由用户选择 degraded

#### Scenario: auto-workflow 委派 apply/archive 时白名单齐备

- **WHEN** auto-workflow 委派 apply/archive 阶段
- **THEN** Claude 适配器 SHALL 含对应 `Skill(...)` 与 `Agent` / `Task` 条目
- **AND** OpenCode V2 / Pi 适配器 SHALL 含等价的 native permission/tool capability

#### Scenario: 白名单无幽灵条目

- **WHEN** 运行编排技能授权一致性检查
- **THEN** 每个宿主的授权条目 SHALL 对应正文真实委派或协议声明的能力
- **AND** 不得保留未使用的宿主授权条目

## ADDED Requirements

### Requirement: auto-workflow 全自动管线 SHALL 经宿主适配器复用 apply/archive 协议

`iagent_auto_workflow` 的自动实现与自动归档 SHALL 经宿主适配器委派 `iagent-spec-apply` 与 `iagent-spec-archive`，不得把 Claude 的 Skill/Agent/Task 调用字面量作为跨宿主唯一实现。`auto-mode=true` 只跳过设计确认门，不得豁免共享资源、回执、失败重试与退出守卫。

#### Scenario: OpenCode V2 auto apply

- **WHEN** OpenCode V2 auto-workflow 通过验证进入实现阶段
- **THEN** SHALL 使用 V2 subagent/agent 执行 apply
- **AND** SHALL 汇总其 receipt 后才进入归档

#### Scenario: Pi degraded auto workflow

- **WHEN** Pi 未安装 strict Extension 且用户显式选择 degraded
- **THEN** 系统 SHALL 标记自动委派未执行
- **AND** 不得把当前 agent 本地实现标记为子 agent 完成

#### Scenario: Failure remains blocking

- **WHEN** 委派、回执或测试执行失败
- **THEN** workflow SHALL 保留失败状态并报告恢复路径
- **AND** MUST NOT 静默推进归档

### Requirement: Workflow phase capability declaration

每个需要宿主编排的阶段 SHALL 声明其所需能力集合。初始化、命令启动与阶段推进时 SHALL 将实际宿主能力与该集合比较，并生成可诊断结果。

#### Scenario: Phase is runnable

- **WHEN** 当前宿主满足阶段所需能力
- **THEN** 阶段 SHALL 允许启动
- **AND** SHALL 记录使用的宿主原生编排路径

#### Scenario: Phase is blocked

- **WHEN** 当前宿主缺少阶段所需能力且 workflow 为 strict
- **THEN** 阶段 SHALL 阻断
- **AND** SHALL 说明缺少的能力与安装/配置建议

### Requirement: Gates use host-native checkpoints

工作流的提示词校验、流程确认、实现确认与归档确认 SHALL 映射到宿主可执行的用户交互或 Extension checkpoint。纯文本 `⛔ GATE` 不得被视为已完成的运行时门控。

#### Scenario: Gate not confirmed

- **WHEN** 用户尚未确认当前 gate
- **THEN** workflow SHALL 不得进入后续阶段
- **AND** 不得提前生成、描述或执行后续阶段动作

#### Scenario: Gate result persisted

- **WHEN** 用户确认、修改或拒绝 gate
- **THEN** gate 结果 SHALL 写入当前 workflow 状态
- **AND** 后续阶段 SHALL 按确认结果选择推进、回退或停止

### Requirement: Receipt-based phase transition

阶段推进 SHALL 以结构化 receipt 为依据，而不是以模型自然语言宣称完成为依据。receipt 至少 SHALL 包含阶段标识、状态、产物或结果位置、下一步允许动作与失败原因（如有）。

#### Scenario: Valid receipt advances

- **WHEN** 阶段 receipt 通过字段与状态校验
- **THEN** 编排器 SHALL 允许进入协议定义的下一阶段

#### Scenario: Missing receipt blocks

- **WHEN** 阶段仅输出自然语言而未返回必需 receipt
- **THEN** 编排器 SHALL 标记阶段不完整
- **AND** 不得自动推进或宣称流程完成
