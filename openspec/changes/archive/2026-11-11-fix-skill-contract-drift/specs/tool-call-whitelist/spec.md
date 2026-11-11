## ADDED Requirements

### Requirement: Dispatch authorization is bidirectional

`allowedTools` 与模板正文的派发动作 SHALL 双向一致：正文要求派发 `Agent` / `Task` / 子代理时，`allowedTools` MUST 含 `Agent, Task`；`allowedTools` 含 `Agent, Task` 时，正文 MUST 存在真实派发动作。测试 MUST 同时校验两个方向。

#### Scenario: 正文派发但未授权则失败

- **WHEN** 某技能正文含「经前台 Agent 子代理执行」但 `allowedTools` 不含 `Agent, Task`
- **THEN** 双向一致性测试 SHALL 失败
- **AND** 失败信息 SHALL 指明技能 id 与缺失条目

#### Scenario: 授权但无派发动作则失败

- **WHEN** 某技能 `allowedTools` 含 `Agent, Task` 但正文无派发动作
- **THEN** 双向一致性测试 SHALL 失败
- **AND** 失败信息 SHALL 指明技能 id

#### Scenario: 真实派发技能保持授权

- **WHEN** 检查 `migration` 与 `spec-bulk-archive`
- **THEN** 两者 SHALL 同时具备 `Agent, Task` 与真实派发正文
- **AND** 其余编排技能 MUST NOT 因兼容窗被误判为派发技能

### Requirement: Generated orchestration section never exceeds declared dispatch permission

生成期追加的宿主编排段 SHALL 与技能的 `allowedTools` 一致：若生成文本含 `Agent` 子代理指令，该技能的 `allowedTools` MUST 含 `Agent, Task`。生成器 MUST NOT 为内联阶段输出子代理指令。

#### Scenario: 生成物不越权派发

- **WHEN** 对全部技能执行 Claude 宿主渲染
- **THEN** 含「经前台 Agent 子代理执行」的产物所对应技能 SHALL 含 `Agent, Task`
- **AND** 不含该授权的技能产物 MUST NOT 出现该文本

#### Scenario: 内联阶段渲染为内联

- **WHEN** 渲染 propose / apply / verify / archive / test / verify-proposal / proposal-review 等内联阶段
- **THEN** 生成文本 SHALL 表达为 Skill 或内联调用
- **AND** MUST NOT 表达为 Agent 子代理
