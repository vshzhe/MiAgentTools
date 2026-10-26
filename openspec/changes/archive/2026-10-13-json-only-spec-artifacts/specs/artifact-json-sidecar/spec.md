# Spec Delta

## MODIFIED Requirements

### Requirement: 提案结构化数据 SHALL 合并为单一主产物 `.iagent/change.json`
提案的 proposal / design / specs 三段结构化内容 MUST 合并存储于单一文件 `.iagent/change.json`（schema `iagent/change/v1`）。该三段 MUST 以 JSON 为唯一产物，MUST NOT 生成 proposal.md / design.md / specs/*.md。tasks.json MUST 保持独立（变更目录根，不并入合并文件）。

#### Scenario: proposal 段驱动 proposal.md 渲染
- **WHEN** spec-propose 生成提案
- **THEN** AI SHALL 写入 `.iagent/change.json` 的 `proposal` 段（why / whatChanges / capabilities.new+modified / impact.files+breaking+compatibility）
- **AND** MUST NOT 产出 proposal.md
- **AND** change.json 校验失败时命令 SHALL 报错字段名+原因并退出码非零

#### Scenario: specs 段驱动 specs/*.md 渲染
- **WHEN** specs 内容就绪
- **THEN** AI SHALL 更新 `.iagent/change.json` 的 `specs` 段（数组，每项含 name / path / operations）
- **AND** operations SHALL 支持四种类型：ADDED / MODIFIED（含 description）/ REMOVED（含 reason + migration）/ RENAMED（含 from + to）
- **AND** MUST NOT 产出 specs/<name>/spec.md

#### Scenario: design 段驱动 design.md 渲染
- **WHEN** design 内容就绪
- **THEN** AI SHALL 更新 `.iagent/change.json` 的 `design` 段（context / goals / nonGoals / decisions / risks）
- **AND** MUST NOT 产出 design.md

#### Scenario: 段落可缺省但渲染时报错引导
- **WHEN** 变更的 change.json 无 design 段
- **THEN** `iagent spec status` / `iagent spec instructions` SHALL 将 design 标为未完成并引导写入 change.json 的 `design` 段
- **AND** MUST NOT 以任何命令生成 design.md

## REMOVED Requirements

### Requirement: render*Md SHALL 确定性渲染，同段输入 MUST 产出同 MD
**Reason**: proposal / design / specs 三段改为 JSON-only，`change.json` 为唯一真源，三个 MD 渲染函数（renderProposalMd / renderDesignMd / renderSpecsMd）整体移除，不再产出冗余 MD 副本。
**Migration**: 直接读写 `change.json` 对应段；`iagent spec render` 仅保留 `tasks`（tasks.md 的确定性渲染由 `tasks.json` 结构化任务追踪需求承载）。存量 / 已归档变更的既有 MD 保持只读，可作为降级解析来源。
