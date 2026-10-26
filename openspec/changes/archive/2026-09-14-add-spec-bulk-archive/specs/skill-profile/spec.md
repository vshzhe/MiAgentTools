## MODIFIED Requirements

### Requirement: 依赖注入
系统 SHALL 对生效 workflow 集执行依赖注入补全（不动点迭代，连带补全传递依赖）：若集合含 `spec-propose` 但不含 `spec-verify-proposal`，MUST 自动补入 `spec-verify-proposal`；若含 `spec-archive` 或 `spec-bulk-archive` 但不含 `spec-verify`，MUST 自动补入 `spec-verify`（两者均为归档类工作流，verify 职责为实现完成后、归档前验证；spec-bulk-archive 的注入规则与源项目 OpenSpec "bulk-archive 依赖 sync" 的归档同步前置语义对齐）；若含 `tr-impl-auto-migration` 但不含 `tr-docs-feature-doc` 或 `tr-impl-migration-check`，MUST 自动补入缺失的子技能（编排技能的 Phase 1 扫描与 Phase 4 检查依赖两子技能）；若含 `tr-impl-workflow` 但不含 `tr-impl-review-proposal` 或 `tr-docs-requirement-doc`，MUST 自动补入缺失项；若含 `tr-impl-auto-workflow` 但不含 `tr-impl-workflow` 或 `tr-docs-requirement-doc`，MUST 自动补入缺失项；若含 `tr-impl-debug` 但不含 `tr-docs-requirement-doc` 或 `spec-verify-proposal`，MUST 自动补入缺失项。`spec-apply` 不触发任何注入。补入项 MUST 在输出中提示用户。

#### Scenario: 漏选归档前验证
- **WHEN** 用户 `workflows` 含 `spec-archive` 但不含 `spec-verify`
- **THEN** 系统自动补入 `spec-verify`，输出提示"已自动加入依赖 spec-verify"

#### Scenario: 漏选批量归档的验证依赖
- **WHEN** 用户 `workflows` 含 `spec-bulk-archive` 但不含 `spec-verify`
- **THEN** 系统自动补入 `spec-verify`，输出提示"已自动加入依赖 spec-verify"

#### Scenario: 批量归档与验证齐备时不重复注入
- **WHEN** 用户 `workflows` 含 `spec-bulk-archive` 与 `spec-verify`
- **THEN** 不产生新注入项

#### Scenario: 漏选提案评分门
- **WHEN** 用户 `workflows` 含 `spec-propose` 但不含 `spec-verify-proposal`
- **THEN** 系统自动补入 `spec-verify-proposal`，输出提示"已自动加入依赖 spec-verify-proposal"

#### Scenario: 漏选迁移子技能
- **WHEN** 用户 `workflows` 含 `tr-impl-auto-migration` 但不含 `tr-docs-feature-doc` 与 `tr-impl-migration-check`
- **THEN** 系统自动补入 `tr-docs-feature-doc` 与 `tr-impl-migration-check` 两项，输出提示"已自动加入依赖 tr-docs-feature-doc、tr-impl-migration-check"

#### Scenario: 仅补缺失项
- **WHEN** 用户 `workflows` 含 `tr-impl-auto-migration` 与 `tr-impl-migration-check` 但不含 `tr-docs-feature-doc`
- **THEN** 系统仅补入 `tr-docs-feature-doc` 一项，已存在的依赖不重复补入

#### Scenario: apply 不触发注入
- **WHEN** 用户 `workflows` 仅含 `spec-apply`（无 `spec-propose`、无 `spec-archive`、无 `spec-bulk-archive`）
- **THEN** 不补入任何依赖项
