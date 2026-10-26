## MODIFIED Requirements

### Requirement: profiles.ts DEPS 依赖注入

`src/core/profiles.ts` 的 `DEPS` 映射表 SHALL 在既有规则（`spec-propose ⇒ spec-verify-proposal`、`spec-archive ⇒ spec-verify`、`tr-impl-auto-migration ⇒ [tr-docs-feature-doc, tr-impl-migration-check]`）基础上新增三条注入规则：`tr-impl-workflow ⇒ [tr-impl-review-proposal, tr-docs-requirement-doc]`、`tr-impl-auto-workflow ⇒ [tr-impl-workflow, tr-docs-requirement-doc]`、`tr-impl-debug ⇒ [tr-docs-requirement-doc, spec-verify-proposal]`。用户在 `.venus/config.yaml` 的 `workflows` 字段勾选任一左侧技能而漏选右侧依赖时，`venus init`/`venus update` MUST 自动补全依赖项的技能与指令并向用户输出补全提示。`DEFAULT_WORKFLOWS` 默认集 MUST 保持不变（7 项：tr-init-project + spec 全 6）——5 个新技能不纳入默认集，仅经 workflows 字段显式勾选安装。

#### Scenario: 勾选 auto-workflow 自动补全依赖

- **WHEN** 用户在 `.venus/config.yaml` 的 workflows 仅勾选 `tr-impl-auto-workflow`
- **THEN** `venus init`/`venus update` 安装 `tr-impl-auto-workflow` 并自动补全 `tr-impl-workflow` 与 `tr-docs-requirement-doc`（后者进一步连带补全 `tr-impl-workflow` 已有的依赖），输出补全提示

#### Scenario: 默认安装集不含新技能

- **WHEN** 用户未配置 `workflows` 字段执行 `venus init`
- **THEN** 安装的生效集为 DEFAULT_WORKFLOWS 7 项（tr-init-project、spec-explore、spec-propose、spec-apply、spec-archive、spec-verify、spec-verify-proposal），不含 5 个新技能
