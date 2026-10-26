# skill-profile Specification (Delta)

> 修改：`依赖注入` —— ① `spec-archive` / `spec-bulk-archive` **新增**对 `tr-docs-requirement-doc` 的注入（被委派技能必须可得，与 `spec-propose ⇒ spec-verify-proposal` 同构）；② `tr-impl-workflow` / `tr-impl-debug` / `tr-impl-genfull` **剔除**已失效的 `tr-docs-requirement-doc` 依赖（`tr-impl-workflow` 仅剩 `tr-impl-review-proposal`；`tr-impl-debug` 仅剩 `spec-verify-proposal`；`tr-impl-genfull` 由 spec-archive 传递注入）；③ 默认集显式项不变，但因注入补齐，**默认安装集由 8 项变为 9 项**。
>
> MODIFIED 需求须含完整更新内容。

## MODIFIED Requirements

### Requirement: 依赖注入
系统 SHALL 对生效 workflow 集执行依赖注入补全（不动点迭代，连带补全传递依赖）：若集合含 `spec-propose` 但不含 `spec-verify-proposal`，MUST 自动补入 `spec-verify-proposal`；若含 `spec-archive` 或 `spec-bulk-archive` 但不含 `spec-verify`，MUST 自动补入 `spec-verify`（两者均为归档类工作流，verify 职责为实现完成后、归档前验证；spec-bulk-archive 的注入规则与源项目 OpenSpec "bulk-archive 依赖 sync" 的归档同步前置语义对齐）；若含 `spec-archive` 或 `spec-bulk-archive` 但不含 `tr-docs-requirement-doc`，MUST 自动补入 `tr-docs-requirement-doc`（归档的预归档需求文档生成检查点经 Skill 工具委派该技能，被委派技能必须可得——与 `spec-propose ⇒ spec-verify-proposal` 同构）；若含 `tr-impl-auto-migration` 但不含 `tr-docs-feature-doc` 或 `tr-impl-migration-check`，MUST 自动补入缺失的子技能（编排技能的 Phase 1 扫描与 Phase 4 检查依赖两子技能）；若含 `tr-impl-workflow` 但不含 `tr-impl-review-proposal`，MUST 自动补入 `tr-impl-review-proposal`（其 §3.5 需求文档生成已移除，`tr-docs-requirement-doc` 不再由其注入）；若含 `tr-impl-auto-workflow` 但不含 `tr-impl-workflow` 或 `tr-docs-requirement-doc`，MUST 自动补入缺失项（其 Phase 5 内联归档步骤仍委派需求文档技能）；若含 `tr-impl-debug` 但不含 `spec-verify-proposal`，MUST 自动补入 `spec-verify-proposal`（其 Phase 7.3 需求文档分支已移除，`tr-docs-requirement-doc` 不再由其注入）；若含 `tr-impl-genfull` 但不含其 7 个显式阶段技能（`spec-explore` / `spec-propose` / `spec-apply` / `spec-archive` / `tr-impl-frontend` / `tr-test-generate` / `tr-impl-review-proposal`），MUST 自动补入缺失项（`tr-docs-requirement-doc` 不在其显式列表，由 `spec-archive` 传递注入）。`spec-apply` 不触发任何注入。补入项 MUST 在输出中提示用户。

**默认集后果（陈述性）**：`DEFAULT_WORKFLOWS` 显式项仍为 8 项（`tr-init-project` / `tr-test-generate` / spec 全 6）；因 `spec-archive` 在默认集内且其依赖含 `tr-docs-requirement-doc`，**默认安装集实际为 9 个 workflow**（8 显式 + 1 注入），`venus init` 在未配置 `workflows` 时 SHALL 据此安装并输出注入提示。

#### Scenario: 漏选归档前验证
- **WHEN** 用户 `workflows` 含 `spec-archive` 但不含 `spec-verify`
- **THEN** 系统自动补入 `spec-verify`，输出提示"已自动加入依赖 spec-verify"

#### Scenario: 漏选归档需求文档技能
- **WHEN** 用户 `workflows` 含 `spec-archive` 但不含 `tr-docs-requirement-doc`
- **THEN** 系统自动补入 `tr-docs-requirement-doc`，输出提示"已自动加入依赖 tr-docs-requirement-doc"

#### Scenario: 批量归档同时补两依赖
- **WHEN** 用户 `workflows` 仅含 `spec-bulk-archive`
- **THEN** 系统自动补入 `spec-verify` 与 `tr-docs-requirement-doc` 两项，输出对应提示

#### Scenario: 默认集安装 9 项
- **WHEN** 项目未配置 `workflows` 字段并执行 `venus init`
- **THEN** 系统按默认集 8 显式项解析出 9 个生效 workflow（额外注入 `tr-docs-requirement-doc`）并据此安装，输出注入提示

#### Scenario: 漏选提案评分门
- **WHEN** 用户 `workflows` 含 `spec-propose` 但不含 `spec-verify-proposal`
- **THEN** 系统自动补入 `spec-verify-proposal`，输出提示"已自动加入依赖 spec-verify-proposal"

#### Scenario: 漏选迁移子技能
- **WHEN** 用户 `workflows` 含 `tr-impl-auto-migration` 但不含 `tr-docs-feature-doc` 与 `tr-impl-migration-check`
- **THEN** 系统自动补入 `tr-docs-feature-doc` 与 `tr-impl-migration-check` 两项，输出提示"已自动加入依赖 tr-docs-feature-doc、tr-impl-migration-check"

#### Scenario: 仅补缺失项
- **WHEN** 用户 `workflows` 含 `tr-impl-auto-migration` 与 `tr-impl-migration-check` 但不含 `tr-docs-feature-doc`
- **THEN** 系统仅补入 `tr-docs-feature-doc` 一项，已存在的依赖不重复补入

#### Scenario: 失效依赖不再注入
- **WHEN** 用户 `workflows` 仅含 `tr-impl-debug`（不含 `spec-archive`）
- **THEN** 系统仅补入 `spec-verify-proposal`，MUST NOT 补入 `tr-docs-requirement-doc`（debug 已不委派该技能）

#### Scenario: 传递注入仍使 genfull 链路可得
- **WHEN** 用户 `workflows` 仅含 `tr-impl-genfull`
- **THEN** 系统注入其 7 个显式阶段技能，并因 `spec-archive` 的依赖继续传递注入 `tr-docs-requirement-doc` 与 `spec-verify`（前者经 spec-archive，后者同为传递项），使归档阶段的需求文档生成在纯 genfull 安装下仍不失效

#### Scenario: apply 不触发注入
- **WHEN** 用户 `workflows` 仅含 `spec-apply`（无 `spec-propose`、无 `spec-archive`、无 `spec-bulk-archive`）
- **THEN** 不补入任何依赖项
