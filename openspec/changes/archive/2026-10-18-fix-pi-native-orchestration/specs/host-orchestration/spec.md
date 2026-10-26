## MODIFIED Requirements

### Requirement: Host capability negotiation

系统 SHALL 在执行严格编排前确认宿主具备工作流声明的能力，包括技能加载、参数传递、子 agent 委派、回执返回、确认门与状态持续能力。对 Pi，子 agent 委派能力 SHALL 以「运行时已安装且所需 `.pi/agents/<subagent_type>.md` 定义可解析」为判定依据，MUST NOT 仅凭 npm 包存在断言。能力检查结果 SHALL 可被用户查看并写入运行诊断元数据。

#### Scenario: Strict host is capable

- **WHEN** 宿主满足当前工作流的全部必需能力
- **THEN** 工作流 SHALL 进入 strict 编排
- **AND** 阶段委派与回执 SHALL 使用宿主原生机制

#### Scenario: Strict host is missing a capability

- **WHEN** 宿主缺少任一必需能力且未选择 degraded 模式
- **THEN** 工作流 SHALL 停止并报告缺失能力、影响阶段与可选补救方式
- **AND** MUST NOT 把当前 agent 的本地执行结果伪装为委派完成

#### Scenario: Pi runtime present but entries unresolvable

- **WHEN** Pi runtime 已安装但编排所需的 agent 定义缺失或不可解析
- **THEN** 系统 SHALL 判定 Pi 缺少子 agent 委派能力并进入 degraded
- **AND** SHALL 报告缺失的 agent 名称与补齐方式

## ADDED Requirements

### Requirement: Pi native delegation entries

当 Pi 被选为编排目标时，系统 SHALL 在项目 `.pi/agents/` 下生成编排器与阶段 agent 定义。每个定义 SHALL 提供 frontmatter `name`（即 `subagent_type`）、`description` 与 `tools`；`tools` MUST 只含上游内置名（`read` / `write` / `edit` / `bash` / `grep` / `find` / `ls`），嵌套委派工具 MUST 由 `allowed_subagents` 授予，`prompt_mode` SHALL 为 `append`。

#### Scenario: 生成编排器与阶段 agent

- **WHEN** `iagent init` / `update` 为 Pi 生成编排类 workflow
- **THEN** SHALL 生成 `.pi/agents/iagent-orchestrator.md` 与 `.pi/agents/iagent-<workflowId>.md`
- **AND** 每个文件的 frontmatter `name` SHALL 等于对应 `subagent_type`

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

### Requirement: Upgrade refresh semantics

`iagent init` SHALL NOT 覆盖已存在的技能与指令产物。升级后刷新既有产物 SHALL 通过 `iagent update` 或 `iagent init --force` 完成，且初始化/更新输出 SHALL 明确提示该区别。

#### Scenario: init 跳过既有产物

- **WHEN** 目标路径已存在技能产物且未传 `--force`
- **THEN** init SHALL 跳过该产物
- **AND** SHALL 在输出中提示使用 `iagent update` 刷新

#### Scenario: update 刷新未手改产物

- **WHEN** 既有产物指纹自洽（未被手改）
- **THEN** update SHALL 以最新模板内容覆盖
- **AND** MUST NOT 需要 `--force`

#### Scenario: 无指纹的历史产物可刷新

- **WHEN** 既有产物缺少 `generatedFingerprint` 且其 `generatedBy` 低于当前版本
- **THEN** update SHALL 判定为可安全刷新并覆盖
- **AND** MUST NOT 要求用户先删除文件
