## MODIFIED Requirements

### Requirement: 编排适配注入面按模板委派派生

需要注入宿主编排适配段的技能集合 SHALL 由**模板单一源派生**：某技能模板的 `allowedTools` 含 `Skill(...)`（即正文存在委派动作）即视为编排技能；其委派清单 SHALL 取该模板 `Skill(...)` 条目的 canonical 目标集合（保序去重）。MUST NOT 维护第二份硬编码 workflow 清单作为真源。

派生函数 SHALL 接受模板列表作为入参（纯函数），MUST NOT 通过「模板模块 → 注册表 → 模板模块」的循环导入获取清单。条件委派表（`CONDITIONAL_DELEGATIONS`）属语义声明，MUST 保持显式维护，MUST NOT 由白名单推导。

`renderDelegationList` SHALL 渲染委派条目的 `mode` / `gate-skip` 参数，使宿主委派清单与正文参数口径一致；**参数来源 SHALL 为显式参数表**（如 `DELEGATION_PARAMETERS`，目标仍由 `allowedTools` 派生），MUST NOT 由白名单推断，参数表未声明时 MUST NOT 凭空填充模式参数。

条件委派表 `CONDITIONAL_DELEGATIONS` SHALL 覆盖全部「正文已声明 fallback / degraded 路径」的委派，含派生后新纳入编排面的 `project-init → feature-doc`；否则默认安装（`DEFAULT_WORKFLOWS` 含 `project-init` 但不含 `feature-doc`）会把可降级委派误判为无条件必需缺口。

Pi 的 `allowed_subagents` 与 OpenCode worker 的委派面 SHALL 以同一派生清单为真源，MUST NOT 另立第二份委派目标表。

**归档类退出编排面**：`iagent_spec_archive` / `iagent_spec_bulk_archive` 的正文不再委派任何技能后，其 `allowedTools` 不含 `Skill(...)` 条目，故 SHALL NOT 再被派生为编排技能 —— 不得注入宿主编排适配段、不得为它们生成 `allowed_subagents`；这是「有委派即注入、无委派不注入」的直接结果，MUST NOT 为保留其编排身份而虚增委派条目。

#### Scenario: 有委派即注入

- **WHEN** 某技能模板 `allowedTools` 含 `Skill(iagent-test)`
- **THEN** 该技能的宿主产物 SHALL 注入宿主编排适配段与委派清单，其委派目标含 `test`

#### Scenario: 无委派不注入

- **WHEN** 某技能模板 `allowedTools` 不含任何 `Skill(...)` 条目
- **THEN** 该技能产物 MUST NOT 注入宿主编排适配段，MUST NOT 生成 `allowed_subagents`（归档类技能在本变更后即属此类）

#### Scenario: 委派清单携带参数

- **WHEN** 显式参数表为某委派目标声明 `mode=delegated` 与 `gate-skip=design-confirmation`
- **THEN** 渲染出的委派清单条目 SHALL 含 `mode=delegated` 与 `gate-skip=design-confirmation`，与正文参数一致
- **AND** 未在参数表声明的目标 MUST NOT 被填充任何模式参数

#### Scenario: 可降级委派不被误报为必需缺口

- **WHEN** 派生后 `project-init` 被识别为编排技能而 `feature-doc` 未安装
- **THEN** `CONDITIONAL_DELEGATIONS` SHALL 含 `project-init → feature-doc`
- **AND** Pi 诊断 SHALL 按条件委派的降级路径记 WARN，MUST NOT 判为「无条件必需委派缺口」并按能力阻断该阶段

#### Scenario: 派生结果覆盖既有委派技能

- **WHEN** 以全部技能模板运行派生
- **THEN** 结果 SHALL 至少覆盖 `auto-workflow` / `debug` / `migration` / `project-init` / `spec-apply` / `spec-propose` / `workflow`，且每个技能的委派目标与其 `Skill(...)` 条目逐一对应
- **AND** `spec-archive` / `spec-bulk-archive` 在本变更后不再含 `Skill(...)` 条目，故不属于派生结果；断言 MUST NOT 再把两者列为「至少覆盖」项

#### Scenario: 归档类无 Skill 委派面

- **WHEN** 以 Pi 或 OpenCode 生成 `iagent-spec-archive` / `iagent-spec-bulk-archive` 的阶段 agent
- **THEN** 其定义 MUST NOT 含 `allowed_subagents`（该字段只取 `Skill(...)` 委派清单）；`spec-bulk-archive` 的 `Agent, Task` 派发授权仍保留（属子代理派发，不是 Skill 委派，OpenCode 因此仍可获得 `action: subagent`），二者 MUST NOT 混为一谈
