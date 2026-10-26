# Spec Delta

## MODIFIED Requirements

### Requirement: 技能命名方案

技能的 canonical `workflowId` SHALL 使用既有 commandId 的 kebab-case 形式（例如 `spec-explore`）。宿主外部技能 ID 与目录名 SHALL 由 `iagent-<workflowId>` 派生，且符合 Agent Skills 的小写字母、数字与单连字符约束。既有 `iagent_<name>` 仅作为 legacy alias 解析，不得作为新宿主产物的 canonical ID。功能名 MUST NOT 包含生命周期类型段；承载规格驱动语义的 ID SHALL 保留 `spec-` 领域段。

#### Scenario: Canonical workflow identity

- **GIVEN** 内置技能 `iagent_spec_explore`
- **WHEN** 系统取得其 canonical workflow identity
- **THEN** canonical `workflowId` 为 `spec-explore`
- **AND** 该值 SHALL 与 config workflows、依赖注入与指令 id 使用的 commandId 一致

#### Scenario: Host skill name uses kebab-case

- **GIVEN** canonical workflowId 为 `spec-explore`
- **WHEN** 为任一 Agent Skills 兼容宿主生成技能
- **THEN** 外部技能目录与 frontmatter name SHALL 为 `iagent-spec-explore`
- **AND** MUST NOT 新生成 `iagent_spec_explore` 作为 canonical 目录或 name

#### Scenario: Legacy alias remains resolvable

- **GIVEN** 用户通过旧名 `iagent_spec_explore` 查询已安装技能或已有配置
- **WHEN** 系统执行 show、迁移、更新或依赖解析
- **THEN** 系统 SHALL 将其解析到 canonical workflowId `spec-explore`

#### Scenario: 功能技能不带类型段

- **GIVEN** 实现类功能技能
- **WHEN** 确定其 canonical workflowId 与宿主技能 ID
- **THEN** 名称 SHALL 不包含生命周期类型段

#### Scenario: spec 域技能保留领域段

- **GIVEN** 规格驱动工作流的提案技能
- **WHEN** 确定其 canonical workflowId
- **THEN** ID SHALL 为 `spec-propose`，保留 `spec-` 领域段

#### Scenario: 名字自解释性

- **GIVEN** 任一 canonical workflowId
- **WHEN** 仅阅读其名称
- **THEN** 可推断该技能的功能用途，不得使用无法推断用途的缩写

## ADDED Requirements

### Requirement: Legacy underscore artifact migration

`iagent init` 与 `iagent update` SHALL 自动识别并迁移本工具管理的 `iagent_<name>` 技能目录到对应的 `iagent-<name>` canonical 目录。迁移 SHALL 覆盖 Claude Code、Pi、OpenCode 与 Codex 的技能产物，保留用户规则与非 iagent 产物，并输出迁移明细与失败告警。

#### Scenario: Migrate managed skill directory

- **WHEN** 工具目录存在内容指纹自洽的 `iagent_spec_explore` 技能目录
- **THEN** init/update SHALL 将其迁移为 `iagent-spec-explore`
- **AND** 新文件的 frontmatter、指纹与宿主 ID SHALL 使用 canonical kebab-case

#### Scenario: Preserve unrelated artifacts

- **WHEN** 同一技能根目录存在用户自建技能或非 iagent 文件
- **THEN** 迁移 SHALL 仅处理可识别的 iagent legacy 产物
- **AND** MUST NOT 删除、重命名或覆盖非 iagent 产物

#### Scenario: Migration failure is reported

- **WHEN** legacy 产物无法迁移或目标路径冲突
- **THEN** init/update SHALL 保留可恢复的源文件、记录失败原因并继续处理其他工具与技能
- **AND** SHALL 将该技能标记为未完成迁移
