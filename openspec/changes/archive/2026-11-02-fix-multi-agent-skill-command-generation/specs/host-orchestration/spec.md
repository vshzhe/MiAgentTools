## MODIFIED Requirements

### Requirement: Pi native delegation entries

当 Pi 被选为编排目标时，系统 SHALL 在项目 `.pi/agents/` 下生成编排器与阶段 agent 定义。每个定义 SHALL 提供 frontmatter `name`（即 `subagent_type`）、`description`（经 `normalizeHostSkillRefs` 归一化内部 `iagent_<id>` 引用并经 `escapeYamlValue` 安全转义）与 `tools`；`tools` MUST 只含上游内置名（`read` / `write` / `edit` / `bash` / `grep` / `find` / `ls`），嵌套委派工具 MUST 由 `allowed_subagents` 授予，`prompt_mode` SHALL 为 `append`。每个阶段 agent（`.pi/agents/iagent-<workflowId>.md`）的正文 SHALL 显式包含启动时读取 `.pi/skills/iagent-<workflowId>/SKILL.md` 完整阶段规程的引导指令。

Pi strict 档案声称的 `gate` 能力 SHALL 显式限定为**阻塞回执形态**（阶段以 `status='blocked'` 回执上报未满足的门，由父级/用户在下一次交互中确认），MUST NOT 声称具备与 Claude/OpenCode 等价的交互式门工具；该限定 SHALL 出现在协商 notes 与生成的编排段文本中。MUST NOT 通过向 `tools` 注入扩展工具名来伪造交互式门能力。

#### Scenario: 生成编排器与阶段 agent 含技能规程读取引导与归一化描述

- **WHEN** `iagent init` / `update` 为 Pi 生成编排类 workflow
- **THEN** SHALL 生成 `.pi/agents/iagent-orchestrator.md` 与 `.pi/agents/iagent-<workflowId>.md`
- **AND** 每个文件的 frontmatter `name` SHALL 等于对应 `subagent_type`，`description` MUST NOT 残留 `iagent_<id>` 下划线技能名
- **AND** 每个阶段 agent 正文 SHALL 含读取 `.pi/skills/iagent-<workflowId>/SKILL.md` 的明确指令

#### Scenario: 用户自建 agent 不被覆盖

- **WHEN** `.pi/agents/` 已存在非 iagent 命名的 agent
- **THEN** 生成与清理 SHALL 只处理 `iagent-` 前缀文件
- **AND** MUST NOT 覆盖或删除用户自建 agent

#### Scenario: frontmatter 契约与上游可解析

- **WHEN** 检查生成的 agent 定义
- **THEN** `tools` SHALL 只含内置名，MUST NOT 出现 `Agent` / `get_subagent_result` 等扩展工具名
- **AND** 编排器的嵌套派发能力 SHALL 由 `allowed_subagents` 枚举提供

#### Scenario: agent 定义为纯生成物

- **WHEN** 重复执行 `iagent update`
- **THEN** `.pi/agents/iagent-*.md` SHALL 按最新模板重建（不设手改保护）
- **AND** 用户自建的其它 agent 文件 SHALL 保持不变

#### Scenario: 生效集缩小后清理 orphan

- **WHEN** 生效 workflow 集缩小，某些 `iagent-` 前缀 agent 不再需要
- **THEN** init/update SHALL 清理这些 orphan 定义
- **AND** SHALL 在输出中报告清理数量

#### Scenario: gate 能力限定为阻塞回执形态

- **WHEN** 读取 Pi strict 的协商结果与生成的编排段
- **THEN** `gate` 的说明 SHALL 明确其为阻塞回执形态（非交互式门工具），且 `tools` 未被注入扩展工具名

### Requirement: 编排适配注入面按模板委派派生

需要注入宿主编排适配段的技能集合 SHALL 由**模板单一源派生**：某技能模板的 `allowedTools` 含 `Skill(...)`（即正文存在委派动作）即视为编排技能；其委派清单 SHALL 取该模板 `Skill(...)` 条目的 canonical 目标集合（保序去重）。MUST NOT 维护第二份硬编码 workflow 清单作为真源。

派生函数 SHALL 接受模板列表作为入参（纯函数），MUST NOT 通过「模板模块 → 注册表 → 模板模块」的循环导入获取清单。`iagent init` 与 `iagent update` 在生成技能正文与指令正文时，SHALL 将基于当前生效技能集（`activeSkillTemplates`）计算的 `orchestration` 对象显式传给 `adaptSkillContentForHost(content, negotiation, workflowId, orchestration)`，确保 `workflows` 配置裁剪时注入的编排适配段与生效集严格一致。条件委派表（`CONDITIONAL_DELEGATIONS`）属语义声明，MUST 保持显式维护，MUST NOT 由白名单推导。

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

#### Scenario: init 与 update 透传生效集 orchestration

- **WHEN** `.iagent/config.yaml` 的 `workflows` 裁剪了部分技能并执行 `iagent init` 或 `iagent update`
- **THEN** `init` 与 `update` 在生成技能与指令时 SHALL 将基于 `activeSkillTemplates` 派生的 `orchestration` 传入 `adaptSkillContentForHost`，不在被裁剪掉的 workflow 上回退使用全量模块级默认表

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
