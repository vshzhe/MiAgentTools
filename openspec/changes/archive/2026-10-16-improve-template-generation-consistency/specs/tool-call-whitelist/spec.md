## ADDED Requirements

### Requirement: 调用类白名单条目 SHALL 经共享常量构造

含"调用类"白名单条目（CodeGraph MCP、技能委派 `Skill(...)`、子代理派发 `Agent`/`Task`）的技能模板 MUST 经 `src/core/templates/tool-whitelist.ts` 的共享常量构造其 `allowedTools`——CodeGraph MCP 条目经 `${CODEGRAPH_MCP}`、技能委派条目经 `${skillDelegation([...])}`、派发条目经 `${SUBAGENT_DISPATCH}`；MUST NOT 逐个模板手写字面量。

测试 MUST 断言：任一含 CodeGraph MCP 条目的技能，其 `allowedTools` 包含 `CODEGRAPH_MCP` 常量值；任一含派发条目的技能包含 `SUBAGENT_DISPATCH` 常量值；任一含委派条目的技能的 `Skill(...)` 条目均可由 `skillDelegation(...)` 常量产出。该强制 MUST NOT 改变授权面（只统一来源，MUST NOT 新增未使用的条目）。

#### Scenario: 编排技能白名单经共享常量构造

- **WHEN** 检查 `iagent_workflow` / `iagent_auto_workflow` / `iagent_debug` 的 `allowedTools`
- **THEN** 其 CodeGraph MCP 条目 SHALL 由 `${CODEGRAPH_MCP}` 产出、技能委派条目 SHALL 由 `${skillDelegation([...])}` 产出、派发条目 SHALL 由 `${SUBAGENT_DISPATCH}` 产出，MUST NOT 为手写字面量

#### Scenario: 常量变更自动跟随

- **WHEN** `tool-whitelist.ts` 的 `CODEGRAPH_MCP` 新增一个具名工具条目
- **THEN** 所有使用 `${CODEGRAPH_MCP}` 的技能白名单 SHALL 在下次生成时自动包含该条目，无需逐模板手工同步

#### Scenario: 授权面不因来源统一而扩大

- **WHEN** 将手写字面量改为共享常量
- **THEN** 改前改后的 `allowedTools` 值 SHALL 逐条等价（仅来源统一），MUST NOT 新增任何原本不存在的条目；测试断言改后值等于共享常量构造结果
