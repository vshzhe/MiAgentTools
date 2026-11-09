## ADDED Requirements

### Requirement: 自动补测调用语义

`iagent_test` SHALL 接受自动管线（`mode=delegated` 或门承载参数生效）的调用语义：

- 接收调用方传入的变更范围（改动文件清单）与已覆盖 Scenario 清单，只为未覆盖的有行为目标设计用例；
- 测试计划确认门 SHALL 自动采用推荐计划并写入调用方测试证据，MUST NOT 阻塞自动管线；调用方 MUST 记 WARN 说明计划未经用户逐项确认；
- 交互式独立调用 MUST 保持既有测试计划确认门与 P2 用例显式确认行为不变。

#### Scenario: 自动管线补测

- **WHEN** apply 以 delegated 语义调用 `iagent_test` 并传入改动文件与已覆盖 Scenario
- **THEN** 技能只为未覆盖目标生成用例，自动采用测试计划并返回用例清单与覆盖映射

#### Scenario: 独立调用行为不变

- **WHEN** 用户独立调用 `/iagent:test`
- **THEN** 测试计划确认门与 P2 用例显式确认仍按既有行为阻塞
