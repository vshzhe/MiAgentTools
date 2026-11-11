## ADDED Requirements

### Requirement: Orchestrator continuation prompt

编排器身份提示词（OpenCode V2 primary agent 与 Pi orchestrator agent）SHALL 声明续跑语义：收到 `status=ok` 回执并校验通过后 MUST 立即继续下一阶段；停点 SHALL 只允许门白名单内的确认门，且停点前 SHALL 引用合法门 id（类别 id 或锚点 id）。

提示词 MUST NOT 包含授权「收到回执后停止」的表述（如「汇总回执后再决定推进、回退或停止」），MUST NOT 把回执汇总本身描述为决策终态。

委派语句渲染 SHALL 跨宿主一致地携带续跑子句：Claude 的自动阶段分支、OpenCode 的 `subagent` 分支与 Pi strict 的 `Agent` 分支 SHALL 均声明「完成后按续跑契约继续」，MUST NOT 只有 Claude 分支具备退出守卫。

#### Scenario: 编排器提示词不含停止授权

- **WHEN** 生成 OpenCode 或 Pi 的编排器 agent 定义
- **THEN** 正文 SHALL 声明「`status=ok` 即续跑，停点须引用门白名单 id」
- **AND** MUST NOT 出现「再决定推进、回退或停止」一类授权停止的表述

#### Scenario: 跨宿主委派子句一致

- **WHEN** 为任一 strict 宿主渲染阶段委派语句
- **THEN** 语句 SHALL 含「完成后按续跑契约继续」子句
- **AND** MUST NOT 只有 Claude 分支具备该子句

### Requirement: Receipt persistence and next-phase resolution

系统 SHALL 提供回执落盘路径派生与读写能力：路径为 `.openspec-tmp/pipeline-<change>/receipts/<phase>.json`（`path.join` 构造，不硬编码分隔符）。编排器 SHALL 在收到阶段回执后落盘再校验，使续跑判定具有客观对象。

系统 SHALL 提供纯函数 `resolveNextPhase(protocol, phaseId, nextAllowed)`：在给定工作流协议中解析 `nextAllowed` 指向的阶段；不可解析时返回不可解析结果，由调用方按 `invalid-receipt` 处理。该函数 MUST NOT 修改协议或回执，MUST NOT 依赖会话状态。

#### Scenario: 回执路径可确定性派生

- **WHEN** 给定变更名与阶段 id
- **THEN** 系统 SHALL 返回 `.openspec-tmp/pipeline-<change>/receipts/<phase>.json`
- **AND** 路径分隔符 SHALL 由 `path.join` 生成，MUST NOT 硬编码

#### Scenario: nextAllowed 解析到下一阶段

- **WHEN** `nextAllowed` 等于协议中存在的阶段 id
- **THEN** `resolveNextPhase` SHALL 返回该阶段
- **AND** MUST NOT 修改协议或回执对象

#### Scenario: nextAllowed 不可解析

- **WHEN** `nextAllowed` 不存在于当前工作流协议
- **THEN** `resolveNextPhase` SHALL 返回不可解析结果
- **AND** 调用方 SHALL 按 `invalid-receipt` 处理
