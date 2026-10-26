## ADDED Requirements

### Requirement: 默认 workflow 集
系统 SHALL 维护一个默认 workflow 集 `DEFAULT_WORKFLOWS`，包含 `tr-init-project` 及 spec 全 6 个核心工作流（`spec-explore` / `spec-propose` / `spec-apply` / `spec-archive` / `spec-verify` / `spec-verify-proposal`）。当项目配置未声明 `workflows` 字段时，系统 MUST 使用该默认集作为生效集。

#### Scenario: 未配置 workflows 字段
- **WHEN** `.venus/config.yaml` 不含 `workflows` 字段或 `.venus/` 不存在
- **THEN** 生效 workflow 集合为 `DEFAULT_WORKFLOWS`（7 项）

### Requirement: 用户配置优先
当 `.venus/config.yaml` 声明了 `workflows` 字段时，系统 SHALL 使用用户声明的列表作为生效 workflow 集，完全覆盖默认集（非合并）。

#### Scenario: 用户显式配置子集
- **WHEN** `config.yaml` 含 `workflows: [tr-impl-feature, spec-explore]`
- **THEN** 生效集合为该两项目，不含默认集其余 5 项

### Requirement: 依赖注入
系统 SHALL 对生效 workflow 集执行依赖注入补全：若集合含 `spec-propose` 但不含 `spec-verify-proposal`，MUST 自动补入 `spec-verify-proposal`；若含 `spec-archive` 但不含 `spec-verify`，MUST 自动补入 `spec-verify`。`spec-apply` 不触发任何注入。补入项 MUST 在输出中提示用户。

#### Scenario: 漏选提案评分门
- **WHEN** 用户 `workflows` 含 `spec-propose` 但不含 `spec-verify-proposal`
- **THEN** 系统自动补入 `spec-verify-proposal`，输出提示"已自动加入依赖 spec-verify-proposal"

#### Scenario: 漏选归档前验证
- **WHEN** 用户 `workflows` 含 `spec-archive` 但不含 `spec-verify`
- **THEN** 系统自动补入 `spec-verify`，输出提示"已自动加入依赖 spec-verify"

#### Scenario: apply 不触发注入
- **WHEN** 用户 `workflows` 仅含 `spec-apply`（无 `spec-propose`、无 `spec-archive`）
- **THEN** 不补入任何依赖项

### Requirement: init 过滤生成
`venus init` SHALL 仅生成生效 workflow 集内的技能（SKILL.md）与斜杠指令，跳过集合外的项。生成的技能与指令数量由生效集大小决定。

#### Scenario: 默认集初始化新项目
- **WHEN** 新项目运行 `venus init` 且 `.venus/config.yaml` 未配置 `workflows`
- **THEN** 仅安装默认集 7 个技能与对应 7 个指令，非默认的 7 个不被安装

#### Scenario: 用户配置集初始化
- **WHEN** 项目 `workflows` 配置为 3 项，运行 `venus init`
- **THEN** 仅安装该 3 项（含依赖注入补全后的最终集）

### Requirement: update 过滤刷新
`venus update` SHALL 仅刷新生效 workflow 集内的技能与指令，现有手改保护逻辑（`generatedBy` 版本对比）不变。

#### Scenario: update 限定配置集
- **WHEN** 已配置 `workflows` 为 3 项，运行 `venus update`
- **THEN** 仅对该 3 项（含依赖注入补全项）做内容对比与刷新，其余项不动

### Requirement: reconcile 检测与保留
`venus init` / `venus update` SHALL 扫描 `.claude/` 下已安装但不在生效 workflow 集内的 venus 技能与指令，MUST 保留不删除，并在输出中列出提示用户手工处理。

#### Scenario: 配置缩小后遗留
- **WHEN** 生效集从 14 项缩为 7 项，`.claude/` 下仍有 7 项不在集中
- **THEN** 这 7 项保留不删，输出"以下 N 个技能不在当前 workflows 配置中，保留未删：... 如需移除：venus uninstall 或手动删除"

#### Scenario: 全新项目无遗留
- **WHEN** 新项目首次 `venus init`，`.claude/` 下无既有 venus 产物
- **THEN** 不输出 reconcile 提示

### Requirement: venus config 交互式配置
`venus config` SHALL 通过 `@inquirer/prompts` 提供 checkbox 交互式勾选全部 14 个 workflow，默认勾选当前生效集，用户确认后写回 `.venus/config.yaml` 的 `workflows` 字段。写回时 SHALL 总是写入显式列表（无论是否等于默认集），保证配置可见可复现。

#### Scenario: 交互式增删 workflow
- **WHEN** 运行 `venus config`，用户在 checkbox 中增删后回车确认
- **THEN** config.yaml 的 `workflows` 字段更新为用户最终勾选列表

#### Scenario: 取消操作
- **WHEN** 运行 `venus config`，用户按取消/中断
- **THEN** config.yaml 不变，输出"未修改"

### Requirement: venus config show
`venus config show` SHALL 非交互打印当前 `config.yaml` 配置摘要与解析后的生效 workflow 列表（含依赖注入补全项及来源标注）。

#### Scenario: 查看默认集生效
- **WHEN** config.yaml 未配置 `workflows`，运行 `venus config show`
- **THEN** 输出"生效 workflow（来源：默认集）：<7 项>"

#### Scenario: 查看用户配置生效
- **WHEN** config.yaml 配置了 `workflows`，运行 `venus config show`
- **THEN** 输出"生效 workflow（来源：用户配置 + 依赖注入）：<最终列表>"

### Requirement: venus config --set 非交互设置
`venus config --set <comma-list>` SHALL 非交互地将指定 workflow 列表写入 config.yaml 的 `workflows` 字段，不进入交互界面，供脚本/CI 使用。非法 workflow id MUST 报错并退出非零。

#### Scenario: 脚本化设置子集
- **WHEN** 运行 `venus config --set tr-init-project,spec-explore`
- **THEN** config.yaml 的 `workflows` 写入该两项，无交互

#### Scenario: 非法 id 报错
- **WHEN** 运行 `venus config --set foo-bar`
- **THEN** 报错"未知 workflow id：foo-bar"，退出码非零，config.yaml 不变
