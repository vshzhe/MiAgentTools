## MODIFIED Requirements

### Requirement: 依赖注入

系统 SHALL 对生效 workflow 集执行依赖注入补全（不动点迭代，连带补全传递依赖）：若集合含 `spec-propose` 但不含 `spec-verify-proposal`，MUST 自动补入 `spec-verify-proposal`；若含 `spec-archive` 或 `spec-bulk-archive` 但不含 `spec-verify`，MUST 自动补入 `spec-verify`（两者均为归档类工作流，verify 职责为实现完成后、归档前验证）；若含 `migration` 但不含 `feature-doc` 或 `migration-check`，MUST 自动补入缺失的子技能（编排技能的 Phase 1 扫描与 Phase 4 检查依赖两子技能）；若含 `workflow` 但不含其阶段技能（`spec-explore` / `spec-propose` / `spec-verify-proposal` / `proposal-review` / `spec-apply` / `spec-archive`），MUST 自动补入缺失项（探索与提案生成、验证评分门与深度复查经 Skill 工具委派；实现与归档经 Skill 工具委派，`spec-verify` 由 `spec-archive` 传递注入）；若含 `workflow` 但不含 `requirement-doc`，MUST 自动补入 `requirement-doc`（Phase 3 文档桥的生成分支**无条件委派**该技能，被委派技能必须可得）；若含 `auto-workflow` 但不含 `workflow`、`spec-explore`、`spec-propose` 或 `requirement-doc`，MUST 自动补入缺失项（Phase 1 探索经 Skill 工具委派 `spec-explore`、Phase 2 提案经 Skill 工具委派 `spec-propose`，验证后的文档桥生成分支无条件委派 `requirement-doc`）；若含 `debug` 但不含 `spec-verify-proposal`，MUST 自动补入 `spec-verify-proposal`（P7 验证调用）；若含 `debug` 但不含 `requirement-doc`，MUST 自动补入 `requirement-doc`（debug 的文档桥在用户确认生成后**无条件委派**该技能，被委派技能必须可得）。`spec-apply` 不注入 `requirement-doc`；其既有 `spec-apply ⇒ test` 注入保持不变。

**归档类不再注入需求文档技能**：`spec-archive` 与 `spec-bulk-archive` MUST NOT 注入 `requirement-doc`——两者正文已不再委派该技能（归档只做需求文档存在性报告，不生成 / 不对齐 / 不迁出），注入会形成指向未使用技能的多余安装并改变默认安装集语义。

**默认集后果（陈述性）**：`DEFAULT_WORKFLOWS` 显式项为 8 项（`project-init` / `test` / spec 全 6），且因归档类不再注入 `requirement-doc`，**默认安装集为 8 个 workflow**（无注入项）；`iagent init` 在未配置 `workflows` 时 SHALL 据此安装且不输出需求文档注入提示。与之相对，选择 `workflow` / `auto-workflow` / `debug` 的项目仍会显式或补入 `requirement-doc`，其实际安装集不因本次收敛而缩小。补入项 MUST 在输出中提示用户。

#### Scenario: 漏选归档前验证

- **WHEN** 用户 `workflows` 含 `spec-archive` 但不含 `spec-verify`
- **THEN** 系统自动补入 `spec-verify`，输出提示"已自动加入依赖 spec-verify"

#### Scenario: 归档类不注入需求文档技能

- **WHEN** 用户 `workflows` 含 `spec-archive` 或 `spec-bulk-archive` 但不含 `requirement-doc`
- **THEN** 系统 MUST NOT 补入 `requirement-doc`，生效集只含该归档技能与其 `spec-verify` 依赖

#### Scenario: 批量归档仅补归档前验证

- **WHEN** 用户 `workflows` 仅含 `spec-bulk-archive`
- **THEN** 系统自动补入 `spec-verify` 一项，输出对应提示；MUST NOT 出现 `requirement-doc`

#### Scenario: 默认集安装 8 项

- **WHEN** 项目未配置 `workflows` 字段并执行 `iagent init`（首轮读取配置早于 `defaultConfigFileContent()` 写入）
- **THEN** 生效 workflow 集合为 `DEFAULT_WORKFLOWS` 的 8 项且无注入项，据此安装 8 个技能模板与 8 个指令模板（每工具）
- **AND** 首轮 init 写回的默认 `config.yaml` 仍列举 7 项显式 workflow（不含 `test`）；后续轮次由 `spec-apply ⇒ test` 注入补足，安装总数同为 8 —— 该差异属默认配置内容的既有形态，不属于「默认安装集」定义，MUST NOT 据此把默认集改为 7 项

#### Scenario: 漏选提案评分门

- **WHEN** 用户 `workflows` 含 `spec-propose` 但不含 `spec-verify-proposal`
- **THEN** 系统自动补入 `spec-verify-proposal`，输出提示"已自动加入依赖 spec-verify-proposal"

#### Scenario: 漏选迁移子技能

- **WHEN** 用户 `workflows` 含 `migration` 但不含 `feature-doc` 与 `migration-check`
- **THEN** 系统自动补入 `feature-doc` 与 `migration-check` 两项，输出提示"已自动加入依赖 feature-doc、migration-check"

#### Scenario: 仅补缺失项

- **WHEN** 用户 `workflows` 含 `migration` 与 `migration-check` 但不含 `feature-doc`
- **THEN** 系统仅补入 `feature-doc` 一项，已存在的依赖不重复补入

#### Scenario: debug 注入需求文档技能

- **WHEN** 用户 `workflows` 含 `debug` 但不含 `requirement-doc`
- **THEN** 系统自动补入 `requirement-doc`，输出提示"已自动加入依赖 requirement-doc"（debug 文档桥的生成分支经 Skill 工具委派该技能，被委派技能必须可得）

#### Scenario: debug 注入结果稳定

- **WHEN** 用户 `workflows` 仅含 `debug`
- **THEN** 生效集 SHALL 为 `debug` + `spec-verify-proposal` + `requirement-doc`；`test` 属条件委派，不触发注入

#### Scenario: workflow 阶段技能传递注入

- **WHEN** 用户 `workflows` 仅含 `workflow`
- **THEN** 系统补入 `spec-explore` / `spec-propose` / `spec-verify-proposal` / `proposal-review` / `spec-apply` / `spec-archive` / `requirement-doc`，并因 `spec-archive` 的依赖继续传递注入 `spec-verify`；需求文档技能由 `workflow` 自身声明（文档桥生成分支无条件委派），不再依赖 `spec-archive` 传递

#### Scenario: 编排器委派探索技能随装

- **WHEN** 用户 `workflows` 含 `workflow` 或 `auto-workflow` 但不含 `spec-explore`
- **THEN** 系统自动补入 `spec-explore`，输出提示"已自动加入依赖 spec-explore"（Phase 1 探索经 Skill 工具委派该技能，被委派技能必须可得）

#### Scenario: 编排器委派提案技能随装

- **WHEN** 用户 `workflows` 含 `workflow` 或 `auto-workflow` 但不含 `spec-propose`
- **THEN** 系统自动补入 `spec-propose`，输出提示"已自动加入依赖 spec-propose"（Phase 2 提案经 Skill 工具委派该技能，被委派技能必须可得）

#### Scenario: apply 不注入需求文档技能

- **WHEN** 用户 `workflows` 仅含 `spec-apply`（无 `spec-propose`、无 `spec-archive`、无 `spec-bulk-archive`）
- **THEN** 系统仅按既有规则注入 `test`（`spec-apply ⇒ test`），MUST NOT 注入 `requirement-doc`

### Requirement: iagent config show

`iagent config show` SHALL 非交互打印当前 `config.yaml` 配置摘要与解析后的生效 workflow 列表（含依赖注入补全项及来源标注），并 SHALL 展示生效的 `compileCheck` 编译检查配置（`enabled` / `command` / `incremental` / `timeoutMs` / `autoFix` / `maxRetries`）及其来源（用户配置或默认值）。

#### Scenario: 查看默认集生效

- **WHEN** config.yaml 未配置 `workflows`，运行 `iagent config show`
- **THEN** 输出"生效 workflow（来源：默认集）：<8 项>"

#### Scenario: 查看用户配置生效

- **WHEN** config.yaml 配置了 `workflows`，运行 `iagent config show`
- **THEN** 输出"生效 workflow（来源：用户配置 + 依赖注入）：<最终列表>"

#### Scenario: 查看编译检查配置

- **WHEN** config.yaml 不含 `compileCheck` 段，运行 `iagent config show`
- **THEN** 输出 `compileCheck` 的默认生效值并标注来源为默认值（`enabled=true` / `command=(自动探测)` / `incremental=true` / `timeoutMs=600000` / `autoFix=true` / `maxRetries=3`）

#### Scenario: 查看用户覆盖的编译检查配置

- **WHEN** config.yaml 声明 `compileCheck.enabled: false`
- **THEN** 输出 `enabled=false` 并标注来源为用户配置，使「编译门被关闭」可被用户直接看到
