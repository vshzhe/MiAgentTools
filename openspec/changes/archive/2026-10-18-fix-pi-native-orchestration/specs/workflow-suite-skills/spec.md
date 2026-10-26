## MODIFIED Requirements

### Requirement: workflow 探索阶段委派 spec-explore

`iagent_workflow` 的 Phase 1 SHALL 经当前宿主的原生编排适配器委派 `iagent-spec-explore`，并传递 `mode=delegated`。Claude Code 使用 Skill 工具，OpenCode V2 使用 `skill` / `subagent` 与项目 agent，Pi strict 使用已安装的 Pi Extension 并通过 `.pi/agents/` 下的 agent 定义以 `Agent({ subagent_type })` 形态发起委派；MUST NOT 要求所有宿主直接执行 Claude 专属 `Skill(...)`。委派 SHALL 执行强制 checkpoint 体系，并返回探索文件路径、提示词基线、流程基准确认状态与 Pending 影响符号。

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
- **THEN** SHALL 以 `Agent({ subagent_type })` 委派对应 `.pi/agents/` 定义执行探索
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

## ADDED Requirements

### Requirement: Pi delegation renders executable agent invocation

Pi 产物中的阶段委派 SHALL 渲染为可执行的 agent 调用形态（`Agent({ subagent_type, prompt })` 或等价），其中 `subagent_type` SHALL 对应已生成的 `.pi/agents/<name>.md`。MUST NOT 只写“委派某阶段”的自然语言。

#### Scenario: strict 产物含可执行委派

- **WHEN** Pi 编排状态为 `strict`
- **THEN** 编排类技能正文 SHALL 含与 `.pi/agents/` 定义匹配的 `subagent_type`
- **AND** SHALL NOT 使用无法解析的自定义类型名

#### Scenario: degraded 明确不构成委派

- **WHEN** Pi 编排状态为 `degraded`
- **THEN** 正文 SHALL 标记本地执行且不构成委派
- **AND** MUST NOT 声称已通过 Extension 完成阶段委派

### Requirement: Command descriptions reflect delegation

指令模板的 `description` SHALL 与正文实际行为一致；正文已改为委派生成时，description MUST NOT 仍表述为“内联生成”。

#### Scenario: 工作流指令描述一致

- **WHEN** 检查 `iagent-workflow` / `iagent-auto-workflow` 等编排指令的 description
- **THEN** 描述 SHALL 表述为委派生成或与正文一致的阶段编排
- **AND** 命中“内联生成”矛盾表述时 SHALL 视为不一致并修正
