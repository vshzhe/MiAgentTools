# tool-call-whitelist Delta Spec

## MODIFIED Requirements

### Requirement: 白名单组合规则
原需求不变。新增约束：使用 references 机制的技能（spec-explore / tr-impl-workflow / tr-impl-auto-workflow / tr-impl-genfull / tr-impl-debug）MUST 确保 `allowedTools` 中的 `Read` 条目覆盖 references 文件读取场景。现有 whitelist 已含 `Read`，无需新增条目。

#### Scenario: references 读取不需新增白名单
- **WHEN** 某技能的 allowedTools 已含 `Read`
- **THEN** 该白名单已覆盖 `references/*.md` 的按需读取，无需因启用 references 机制而修改白名单