## MODIFIED Requirements

### Requirement: 编排执行方式内联优先与验证证据契约

(D1, D2, D3) `iagent_workflow` / `iagent_auto_workflow` / `iagent_debug` 的执行方式 SHALL 按以下版图分配：

- **子代理**：仅 `spec-bulk-archive` 的内部并行单元（≤3）；
- **主 agent 内联**：`propose`、`apply`、`verify`、`archive`、`debug fix`、`migration`（source-scan 与 Phase 3 / Phase 4）；
- `migration` 的上下文阈值（300 文件 / 15k 行）是唯一保留的动态降级逃生口。

`propose` / `apply` SHALL 由主 agent 内联执行。`apply` SHALL 采用**单 agent 分批调度**：同一 `group` 的任务聚为单元；
批内独立**只读**调用可并行发起；写同一文件 SHALL 串行；进度 SHALL 落盘
`.openspec-tmp/pipeline-<change>/apply-progress.md`；`apply.concurrency` 语义为「每批单元数」软上限，MUST NOT 再约束子代理。
「单 agent 并行」MUST NOT 被表述为独立上下文的并行代码生成。

`verify` 阶段 SHALL 以**单轮内联**完成，MUST NOT 派生 `iagent_spec_verify_proposal` / `iagent_proposal_review` 子代理；
内联验证 SHALL 使用固定清单（D1-D10 + B1-B7），每条结论 MUST 带 `文件:行` 或章节锚点证据，无证据结论 MUST NOT 计入通过。
验证 FAIL 后 SHALL 在同一主上下文按 `fixDiff` 重跑清单（≤3 次），MUST NOT 新开验证代理或全量重读；
报告 SHALL 落盘 `.openspec-tmp/pipeline-<change>/verify-report.md`。

各技能的 `allowedTools` SHALL 与正文一致：`workflow` / `auto-workflow` / `debug` MUST NOT 保留 `Agent, Task`；
`migration`（Phase 3 已内联）与 `spec-bulk-archive` 保留；以 Skill 工具内联调用的子技能 SHALL 保留 `Skill(...)` 条目。

#### Scenario: propose / apply 内联

- **WHEN** 编排进入 `propose` / `apply` 阶段
- **THEN** 主 agent SHALL 直接执行并返回 `executionMode=inline`
- **AND** MUST NOT 派生 propose / apply 子代理

#### Scenario: apply 单 agent 分批与批内并行只读

- **WHEN** apply 批次含多个单元
- **THEN** 主 agent SHALL 按批推进，批内独立只读调用可并行发起
- **AND** 写同一文件 SHALL 串行；进度 SHALL 落盘 `apply-progress.md`

#### Scenario: 单 agent 并行语义

- **WHEN** 规格或报告描述 apply 的并行
- **THEN** MUST 表述为「同回合并行只读 + 批内交错」
- **AND** MUST NOT 声称独立上下文的并行代码生成

#### Scenario: 验证单轮内联

- **WHEN** 编排进入 `verify` 阶段
- **THEN** 主 agent SHALL 直接执行固定清单验证并返回 `executionMode=inline`
- **AND** MUST NOT 派生 `iagent_spec_verify_proposal` / `iagent_proposal_review` 子代理

#### Scenario: 无证据结论不计分

- **WHEN** 某维度结论未附 `文件:行` 或章节锚点
- **THEN** 该结论 MUST NOT 计入通过
- **AND** 验证报告 SHALL 将其标为缺证据

#### Scenario: 同上下文修复重跑

- **WHEN** 验证 FAIL 且主 agent 完成修复
- **THEN** 主 agent SHALL 在同一上下文按 `fixDiff` 重跑清单
- **AND** MUST NOT 新开验证代理或重读未改动制品；循环超过 3 次 SHALL 暂停报告

#### Scenario: 批量归档保留并行

- **WHEN** 执行 `spec-bulk-archive`
- **THEN** 其内部并行单元 SHALL 保留子代理（≤3）
- **AND** 单元失败隔离语义不变

#### Scenario: 白名单与正文一致

- **WHEN** 技能正文将 propose / apply / verify / archive / fix 改为内联
- **THEN** `workflow` / `auto-workflow` / `debug` 的 `allowedTools` MUST NOT 再含 `Agent, Task`
- **AND** `migration` 与 `spec-bulk-archive` SHALL 保留；仍以 Skill 工具调用的子技能 SHALL 保留 `Skill(...)`

### Requirement: 编排技能的委派与派发白名单齐备性

编排类技能（`iagent_workflow` / `iagent_auto_workflow` / `iagent_debug` / `iagent_migration`）的 `allowedTools` SHALL 覆盖其正文的实际调用面——经 Skill 工具内联或委派的每一个子技能写入 `Skill(<裸名>)` 精确条目；**仅当正文实际派发子代理时**才写入 `Agent` 与 `Task` 双写条目；调用的 CodeGraph MCP 工具写入 `mcp__codegraph` 与具名工具双写条目。正文不再派发的子代理条目 SHALL 同步剔除，授权面 MUST NOT 因存量条目而虚增。

`workflow` / `auto-workflow` / `debug` 的正文已全部内联（propose / apply / verify / archive / fix），其 `allowedTools` MUST NOT 含 `Agent` / `Task`。`migration` 仅在上下文阈值降级时使用子代理，SHALL 保留 `Agent` / `Task`；`iagent_spec_bulk_archive` 仍并行派发单元，SHALL 保留 `Agent` / `Task`。

#### Scenario: auto-workflow 无子代理条目

- **WHEN** 检查 `iagent_auto_workflow` 的 `allowedTools`
- **THEN** 含其正文实际调用的 explore / propose / verify / proposal-review / apply / verify / test / archive 技能条目
- **AND** MUST NOT 含 `Agent` / `Task` / `Skill(iagent-requirement-doc)` 条目

#### Scenario: workflow 无子代理条目

- **WHEN** 检查 `iagent_workflow` 的 `allowedTools`
- **THEN** 含其正文实际调用的技能条目
- **AND** MUST NOT 含 `Agent` / `Task` / `Skill(iagent-requirement-doc)` 条目

#### Scenario: debug 无子代理条目

- **WHEN** 检查 `iagent_debug` 的模板白名单、宿主委派清单与生成权限
- **THEN** 覆盖其正文的 `spec-verify-proposal`、`proposal-review` 与条件 `test` 调用
- **AND** MUST NOT 含 `Agent` / `Task`；没有未使用的技能条目或 `Skill(*)` 通配

#### Scenario: migration 与批量归档保留子代理

- **WHEN** 检查 `iagent_migration` / `iagent_spec_bulk_archive`
- **THEN** 其正文仍派发子代理的条目 SHALL 保留 `Agent` / `Task`
- **AND** 不得把已内联的步骤继续标记为子代理

#### Scenario: 调用 CodeGraph 的编排技能含 MCP 条目

- **WHEN** 检查正文引用 `codegraph_*` 工具的编排技能
- **THEN** 含 `mcp__codegraph` 与具名 CodeGraph 工具双写条目

#### Scenario: 白名单无幽灵条目

- **WHEN** 运行编排技能授权一致性检查
- **THEN** 每个宿主的授权条目对应正文真实调用或协议声明的能力，不保留未使用的宿主授权条目

### Requirement: 编排技能 SHALL 委派其声明的全部子技能且齐备授权

编排技能正文与宿主适配产物 SHALL 对每个实际调用目标声明可执行的宿主原生能力。Claude Code 的调用类白名单 SHALL 覆盖 `Skill(<裸名>)`；**仅正文实际派发子代理时**才要求 `Agent` / `Task`；CodeGraph MCP 仍双写。OpenCode V2 SHALL 使用 `skill`（仅实际使用 `subagent` 时增加对应权限）；Pi SHALL 使用 Extension 提供的对应工具。授权缺失时 strict 编排 MUST 阻断，不得静默转为本地执行。

#### Scenario: Claude whitelist remains complete

- **WHEN** Claude Code 检查编排技能授权
- **THEN** 其 `allowedTools` SHALL 覆盖正文实际调用与 MCP 调用
- **AND** 不得产生幽灵或缺失条目

#### Scenario: OpenCode V2 permissions are complete

- **WHEN** OpenCode V2 检查 workflow orchestrator agent
- **THEN** 其项目权限 SHALL 覆盖实际 `skill` 目标
- **AND** 仅在实际派发子代理时要求 `subagent` 权限；缺失时报告能力缺失

#### Scenario: Pi strict runtime is complete

- **WHEN** Pi strict 执行编排技能
- **THEN** Extension SHALL 提供协议所需的调用、回执与门控工具
- **AND** 工具缺失时 SHALL 进入 strict 阻断或由用户选择 degraded

#### Scenario: auto-workflow 内联阶段白名单齐备

- **WHEN** auto-workflow 内联执行 apply / archive 阶段
- **THEN** Claude 适配器 SHALL 含对应 `Skill(...)` 条目
- **AND** MUST NOT 要求 `Agent` / `Task`；OpenCode V2 / Pi 适配器含等价能力

#### Scenario: 白名单无幽灵条目（auto-workflow 授权）

- **WHEN** 运行编排技能授权一致性检查
- **THEN** 每个宿主的授权条目 SHALL 对应正文真实调用或协议声明的能力
- **AND** 不得保留未使用的宿主授权条目

### Requirement: auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议

`iagent_auto_workflow` 的 Phase 4（自动实现）与 Phase 5（自动归档）SHALL 经 **Skill 工具内联**执行 `iagent_spec_apply`（传 `gate-skip=design-confirmation`；`auto-mode=true` 为等价兼容写法）与 `iagent_spec_archive`（传 `change-name`），MUST NOT 派生 Agent 子代理，也 MUST NOT 重定义 / 内联复述其派发协议与共享资源协议。`gate-skip=design-confirmation` 仅跳过设计确认门，MUST NOT 免除共享资源协议与退出守卫。

**门账本写入**：流程基准确认后、执行前，父级 SHALL 把 `design-confirmation` 写入 handoff 包 `## 已确认门` 段并在执行前校验存在；阶段回执 SHALL 携带 `confirmedGates: ['design-confirmation']`。两者皆缺时被调用 apply 的设计门 SHALL 照常触发（MUST NOT 静默跳过）。账本写入 / 校验失败 → 停止并报告。

auto-workflow 的阶段门声明 SHALL 与其协议阶段清单一致：验证 / 实现 / 归档阶段 MUST NOT 声明阻塞门；`requirementDocStatus` 已整体移除，MUST NOT 出现。

#### Scenario: Phase 4 内联而非子代理

- **WHEN** auto-workflow 验证通过后进入 Phase 4
- **THEN** SHALL 经 Skill 工具内联执行 `iagent_spec_apply`（`gate-skip=design-confirmation`）
- **AND** MUST NOT 派生 Agent 子代理

#### Scenario: Phase 5 内联而非子代理

- **WHEN** auto-workflow 实现、编译检查与测试门完成后进入 Phase 5
- **THEN** SHALL 经 Skill 工具内联执行 `iagent_spec_archive`（`change-name`）
- **AND** MUST NOT 派生 Agent 子代理；MUST NOT 传递 `requirementDocStatus`

#### Scenario: 测试执行门继承

- **WHEN** auto-workflow 的内联 apply 进入测试执行门
- **THEN** SHALL 复用 `iagent_spec_apply` §9 的门（change scope、in-scope 失败重试 3 次后暂停、out-of-scope 仅 WARN）
- **AND** MUST NOT 在 auto-workflow 内另立第二份测试门定义

#### Scenario: 门账本兜底

- **WHEN** 内联执行时 `gate-skip` 参数未传达，但账本已声明 `design-confirmation` 且与回执一致
- **THEN** 被调用 apply SHALL 经账本兜底跳过 Step 5.5 并记 WARN
- **AND** 其余门与停点 MUST 照常生效

#### Scenario: 两者皆缺时设计门照常触发

- **WHEN** 内联执行既未传 `gate-skip`，账本段也缺失或无该条目
- **THEN** 被调用 apply 的设计确认门 MUST 照常执行，MUST NOT 静默跳过

### Requirement: auto-workflow 全自动管线 SHALL 经宿主适配器复用 apply/archive 协议

`iagent_auto_workflow` 的自动实现与自动归档 SHALL 经宿主适配器以 **Skill 工具内联**执行 `iagent-spec-apply` 与 `iagent-spec-archive`，不得把 Claude 的 Agent/Task 调用字面量作为跨宿主实现。`gate-skip=design-confirmation`（`auto-mode=true` 为等价兼容写法）只跳过设计确认门，不得豁免共享资源、回执、失败重试与退出守卫。

在 Codex 等 skills-only 宿主下，auto-workflow 的自动阶段 SHALL 按显式 degraded 路径由当前 agent 本地执行并声明「不构成委派」，MUST NOT 伪装为严格的子代理回执或空洞地满足阶段门。

#### Scenario: 全宿主 apply 内联

- **WHEN** OpenCode V2 / Pi / Codex 的 auto-workflow 进入实现或归档阶段
- **THEN** SHALL 以 Skill 工具内联执行对应技能
- **AND** MUST NOT 要求子代理权限或伪造子代理回执

#### Scenario: Pi degraded auto workflow

- **WHEN** Pi 未安装 strict Extension 且用户显式选择 degraded
- **THEN** 系统 SHALL 标记阶段为 `local-degraded`
- **AND** 不得把当前 agent 本地实现标记为子 agent 完成

#### Scenario: Codex 自动管线显式本地执行

- **WHEN** codex 被纳为生效工具且 auto-workflow 进入 Phase 4
- **THEN** 产物 SHALL 显式声明该阶段由当前 agent 本地执行、不构成委派
- **AND** MUST NOT 声称已获得宿主原生阶段回执

#### Scenario: Failure remains blocking

- **WHEN** 内联执行、回执或测试执行失败
- **THEN** workflow SHALL 保留失败状态并报告恢复路径
- **AND** MUST NOT 静默推进归档
