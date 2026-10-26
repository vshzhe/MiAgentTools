## MODIFIED Requirements

### Requirement: 依赖注入
系统 SHALL 对生效 workflow 集执行依赖注入补全（不动点迭代，连带补全传递依赖）：若集合含 `spec-propose` 但不含 `spec-verify-proposal`，MUST 自动补入 `spec-verify-proposal`；若含 `spec-archive` 或 `spec-bulk-archive` 但不含 `spec-verify`，MUST 自动补入 `spec-verify`（两者均为归档类工作流，verify 职责为实现完成后、归档前验证）；若含 `spec-archive` 或 `spec-bulk-archive` 但不含 `requirement-doc`，MUST 自动补入 `requirement-doc`（归档的预归档需求文档生成检查点经 Skill 工具委派该技能，被委派技能必须可得）；若含 `migration` 但不含 `feature-doc` 或 `migration-check`，MUST 自动补入缺失的子技能（编排技能的 Phase 1 扫描与 Phase 4 检查依赖两子技能）；若含 `workflow` 但不含其阶段技能（`spec-propose` / `spec-verify-proposal` / `proposal-review` / `spec-apply` / `spec-archive`），MUST 自动补入缺失项（提案生成、验证评分门与深度复查经 Skill 工具委派；实现与归档经 Skill 工具委派，`requirement-doc` 与 `spec-verify` 由 `spec-archive` 传递注入）；若含 `auto-workflow` 但不含 `workflow`、`spec-propose` 或 `requirement-doc`，MUST 自动补入缺失项（Phase 1-3 与引导工作流同构，Phase 2 提案经 Skill 工具委派 `spec-propose`，Phase 5 内联归档步骤仍委派需求文档技能）；若含 `debug` 但不含 `spec-verify-proposal`，MUST 自动补入 `spec-verify-proposal`（需求文档不在 debug 范围内，不注入 `requirement-doc`）。`spec-apply` 不触发任何注入。补入项 MUST 在输出中提示用户。

**默认集后果（陈述性）**：`DEFAULT_WORKFLOWS` 显式项为 8 项（`project-init` / `test` / spec 全 6）；因 `spec-archive` 在默认集内且其依赖含 `requirement-doc`，**默认安装集实际为 9 个 workflow**（8 显式 + 1 注入），`iagent init` 在未配置 `workflows` 时 SHALL 据此安装并输出注入提示。

#### Scenario: 漏选归档前验证
- **WHEN** 用户 `workflows` 含 `spec-archive` 但不含 `spec-verify`
- **THEN** 系统自动补入 `spec-verify`，输出提示"已自动加入依赖 spec-verify"

#### Scenario: 漏选归档需求文档技能
- **WHEN** 用户 `workflows` 含 `spec-archive` 但不含 `requirement-doc`
- **THEN** 系统自动补入 `requirement-doc`，输出提示"已自动加入依赖 requirement-doc"

#### Scenario: 批量归档同时补两依赖
- **WHEN** 用户 `workflows` 仅含 `spec-bulk-archive`
- **THEN** 系统自动补入 `spec-verify` 与 `requirement-doc` 两项，输出对应提示

#### Scenario: 默认集安装 9 项
- **WHEN** 项目未配置 `workflows` 字段并执行 `iagent init`
- **THEN** 系统按默认集 8 显式项解析出 9 个生效 workflow（额外注入 `requirement-doc`）并据此安装，输出注入提示

#### Scenario: 漏选提案评分门
- **WHEN** 用户 `workflows` 含 `spec-propose` 但不含 `spec-verify-proposal`
- **THEN** 系统自动补入 `spec-verify-proposal`，输出提示"已自动加入依赖 spec-verify-proposal"

#### Scenario: 漏选迁移子技能
- **WHEN** 用户 `workflows` 含 `migration` 但不含 `feature-doc` 与 `migration-check`
- **THEN** 系统自动补入 `feature-doc` 与 `migration-check` 两项，输出提示"已自动加入依赖 feature-doc、migration-check"

#### Scenario: 仅补缺失项
- **WHEN** 用户 `workflows` 含 `migration` 与 `migration-check` 但不含 `feature-doc`
- **THEN** 系统仅补入 `feature-doc` 一项，已存在的依赖不重复补入

#### Scenario: 失效依赖不再注入
- **WHEN** 用户 `workflows` 仅含 `debug`（不含 `spec-archive`）
- **THEN** 系统仅补入 `spec-verify-proposal`，MUST NOT 补入 `requirement-doc`（debug 不委派该技能）

#### Scenario: workflow 阶段技能传递注入
- **WHEN** 用户 `workflows` 仅含 `workflow`
- **THEN** 系统补入 `spec-propose` / `spec-verify-proposal` / `proposal-review` / `spec-apply` / `spec-archive`，并因 `spec-archive` 的依赖继续传递注入 `spec-verify` 与 `requirement-doc`，使归档阶段的需求文档生成在纯 workflow 安装下仍可得

#### Scenario: 编排器委派提案技能随装
- **WHEN** 用户 `workflows` 含 `workflow` 或 `auto-workflow` 但不含 `spec-propose`
- **THEN** 系统自动补入 `spec-propose`，输出提示"已自动加入依赖 spec-propose"（Phase 2 提案经 Skill 工具委派该技能，被委派技能必须可得）

#### Scenario: apply 不触发注入
- **WHEN** 用户 `workflows` 仅含 `spec-apply`（无 `spec-propose`、无 `spec-archive`、无 `spec-bulk-archive`）
- **THEN** 不补入任何依赖项
