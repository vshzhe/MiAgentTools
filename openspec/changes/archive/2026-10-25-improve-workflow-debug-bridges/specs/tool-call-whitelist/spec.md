## ADDED Requirements

### Requirement: debug 文档与回归测试委派授权齐备

当 `iagent_debug` 正文委派需求文档或回归测试技能时，其 `allowedTools` SHALL 使用共享 `skillDelegation([...])` 为 `requirement_doc` 与 `test` 添加精确裸名条目；MUST NOT 使用 `Skill(*)`、带 `iagent_` 前缀的死条目或 Claude 专属委派语法作为跨宿主唯一机制。新增委派还 SHALL 同步宿主 `ORCHESTRATION_DELEGATIONS` / OpenCode V2 项目权限及对应一致性测试；不改变既有写类工具或 Bash 授权面。

debug 实际使用的 `spec_verify_proposal`、`proposal_review`、`requirement_doc` 与条件 `test` 委派必须与生成的宿主能力声明一致。`iagent_test` 负责测试生成规则；debug 的授权仅允许按其正文中的真实委派使用测试技能，不得因正文只提及技能名而扩展授权。

#### Scenario: debug 正文真实委派获得精确条目

- **WHEN** `iagent_debug` 正文在验证后调用 `iagent_requirement_doc`，并在修复阶段条件调用 `iagent_test`
- **THEN** `allowedTools` 包含 `Skill(requirement_doc)` 与 `Skill(test)`，由 `skillDelegation(['requirement_doc', 'test'])` 等共享常量形式生成

#### Scenario: debug 授权与宿主委派表一致

- **WHEN** 生成 Claude、OpenCode V2 或 Pi 的 debug 宿主产物
- **THEN** 所需子技能均出现在相应宿主的授权/委派能力中，严格能力缺失时按既有策略阻断；不得依靠共享正文绕过宿主权限

#### Scenario: 最小权限保持

- **WHEN** 更新 debug 的需求文档与测试委派授权
- **THEN** 不新增 `Skill(*)`、不新增无真实正文调用的技能条目、不扩大 `Write` / `Edit` / `Bash(...)` 授权面

## MODIFIED Requirements

### Requirement: 归档技能的需求文档委派条目

归档类技能（`iagent_spec_archive` / `iagent_spec_bulk_archive`）的 `allowedTools` SHALL 覆盖其**预归档需求文档生成检查点**的实际调用面：两者正文均经 Skill 工具非交互委派 `iagent_requirement_doc`（缺失且状态为 `absent` 的兼容分支）与就地增量对齐（已存在分支，不调用技能），故两者的 `allowedTools` MUST 含精确条目 `Skill(requirement_doc)`（**裸技能名**，即去掉 `iagent_` 前缀；写成 `Skill(iagent_requirement_doc)` 会产出永不放行的死条目），MUST NOT 使用 `Skill(*)` 通配。

**嵌套委派的权限归属**：编排技能（如 `iagent_workflow`）经 Skill 工具委派归档技能、归档技能再委派需求文档技能时，**内层委派的放行归属会话级权限载体**——`permissions.allow` 由 `iagent_spec_archive` 自身的白名单聚合而来（`buildPermissionEntries` 接收全部已安装技能的 `allowedTools`），故外层编排技能的 `allowedTools` MUST NOT 为其非本轮实际委派的技能写入条目。

配套约束：归档技能正文新增委派后，其**配对斜杠指令**的 `allowed-tools` MUST 经既有派生链继承同一取值（`spec-*.ts` 走 `deriveCommandContent` 派生；MUST NOT 手工维护指令侧白名单），且正文 ↔ 白名单一致性测试 SHALL 覆盖该新增委派。

#### Scenario: spec-archive 具备需求文档委派条目

- **WHEN** 检查 `iagent_spec_archive` 的 `allowedTools`
- **THEN** 含 `Skill(requirement_doc)`（裸名），与其预归档需求文档检查点（`absent` 缺失分支委派该技能）一致

#### Scenario: spec-bulk-archive 具备需求文档委派条目

- **WHEN** 检查 `iagent_spec_bulk_archive` 的 `allowedTools`
- **THEN** 含 `Skill(requirement_doc)`（裸名），与其 a.6 需求文档检查点的 `absent` 缺失分支一致

#### Scenario: 指令侧白名单同步派生

- **WHEN** 重新生成 `iagent_spec_archive` / `iagent_spec_bulk_archive` 的配对斜杠指令
- **THEN** 其 frontmatter `allowed-tools` 与配对技能模板的 `allowedTools` 完全一致（含新增的 `Skill(requirement_doc)` 条目），无需手工维护指令侧

#### Scenario: 嵌套委派不使外层白名单虚增

- **WHEN** `iagent_workflow` 的 `allowedTools` 在其 Phase 5 委派 `iagent_spec_archive`（后者将再委派需求文档技能）后被检查
- **THEN** `iagent_workflow` MUST NOT 因该嵌套链路额外写入 `Skill(requirement_doc)`（其条目仅来自 workflow 本轮 Phase 3 文档桥生成分支的实际委派）；内层委派由会话级 `permissions.allow` 放行

#### Scenario: 未使用条目被剔除

- **WHEN** 某编排技能正文不再委派某技能（如 `iagent_migration` 不委派 `requirement-doc`）
- **THEN** 其 `allowedTools` MUST NOT 继续保留该技能的 `Skill(...)` 条目（最小权限；条目存在但正文不调用属授权面虚增）
