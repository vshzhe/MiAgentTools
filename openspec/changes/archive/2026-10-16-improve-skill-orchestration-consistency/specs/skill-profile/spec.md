## ADDED Requirements

### Requirement: auto-workflow 依赖注入面 SHALL 与其委派面一致

`DEPS['auto-workflow']` SHALL 覆盖 `iagent_auto_workflow` 正文实际委派的全部无条件子技能（`spec-explore` / `spec-propose` / `spec-verify-proposal` / `proposal-review` / `spec-apply` / `spec-archive` / `requirement-doc`，以及条件委派的 `test`）。MUST NOT 包含正文从不委派的技能（如 `workflow`）。

#### Scenario: 移除冗余 workflow 依赖

- **WHEN** 用户 `workflows` 仅含 `auto-workflow`
- **THEN** 系统 MUST NOT 因 auto-workflow 而自动补入 `workflow`
- **AND** SHALL 补入 auto-workflow 实际委派的阶段技能

#### Scenario: 委派面与依赖面一致

- **WHEN** 运行回归锁比对 `DEPS` 与各编排技能正文的委派集合
- **THEN** 每个无条件委派 SHALL 被对应 `DEPS` 条目覆盖
- **AND** 命中"依赖声明但正文从不委派"的冗余项时 SHALL 以告警或失败报告

#### Scenario: 既有装机的无删除保证

- **WHEN** 项目此前已因旧 DEPS 安装了 `workflow`，升级后新 DEPS 不再注入它
- **THEN** `reconcile` SHALL 保留既有 `workflow` 产物不删（既有"遗留保留"策略）
- **AND** 仅在输出中提示其不在当前生效 workflow 集内
