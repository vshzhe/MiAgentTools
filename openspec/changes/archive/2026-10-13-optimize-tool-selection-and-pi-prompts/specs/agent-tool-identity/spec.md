# Spec Delta

## MODIFIED Requirements

### Requirement: 指令 id 派生与命名空间
斜杠指令 id SHALL 由技能名去掉技能前缀后将下划线替换为连字符派生。指令文件的落点与调用形式 SHALL 由目标工具的指令布局决定：`namespace-dir` 布局生成到 `<工具指令目录>/<命名空间>/<指令 id>.md`，调用形式为 `/<命名空间>:<指令 id>`；`prefixed-file` 布局生成到 `<工具指令目录>/<命名空间>-<指令 id>.md`（扁平），调用形式为 `/<命名空间>-<指令 id>`。

#### Scenario: 派生功能技能指令 id
- **GIVEN** 技能名 iagent_workflow
- **WHEN** 派生指令 id
- **THEN** 得到 workflow，指令文件为 .claude/commands/iagent/workflow.md，调用形式 /iagent:workflow

#### Scenario: 派生 spec 域指令 id
- **GIVEN** 技能名 iagent_spec_verify_proposal
- **WHEN** 派生指令 id
- **THEN** 得到 spec-verify-proposal，调用形式 /iagent:spec-verify-proposal

#### Scenario: 非前缀技能名报错
- **GIVEN** 技能名不以技能前缀开头
- **WHEN** 调用指令 id 派生
- **THEN** 抛出以技能前缀为说明的错误

#### Scenario: 扁平前缀布局的工具
- **GIVEN** 目标工具的指令布局为 prefixed-file
- **WHEN** 为该工具生成指令 id 为 pwd 的产物
- **THEN** 产物路径为扁平前缀文件（如 .pi/prompts/iagent-pwd.md），MUST NOT 生成命名空间子目录

## ADDED Requirements

### Requirement: Pi prompt 模板布局与格式
Pi 工具 SHALL 从项目的 `.pi/prompts/` 目录以扁平、`iagent-` 前缀文件加载 iagent 指令；Pi 指令产物的 frontmatter MUST NOT 含 `name` / `allowed-tools` / `category` / `tags` 等 Claude 专有字段，但 MUST 保留 iagent 自身的 `metadata.generatedBy` 与 `metadata.generatedFingerprint` 记账字段以支持手改保护。

#### Scenario: Pi 指令生成到 prompts 目录
- **WHEN** 为 Pi 生成指令 id 为 spec-apply 的产物
- **THEN** 路径为 .pi/prompts/iagent-spec-apply.md

#### Scenario: Pi frontmatter 去除 Claude 专有字段
- **WHEN** 检查任一 Pi prompt 产物
- **THEN** frontmatter MUST NOT 含 name、allowed-tools、category、tags

#### Scenario: Pi prompt 保留指纹记账
- **WHEN** 检查任一 Pi prompt 产物的 frontmatter
- **THEN** 含 metadata.generatedFingerprint，且其值与该文件内容自洽（update 可据此识别用户手改）

### Requirement: 指令产物归属识别与清理边界
reconcile 扫描、uninstall 删除与旧产物清理 SHALL 按目标工具的指令布局只识别本工具命名产物：`namespace-dir` 布局仅处理命名空间子目录，`prefixed-file` 布局仅处理 `<命名空间>-` 前缀的 `.md` 文件。系统 MUST NOT 处理同目录下非本命名空间的其它文件，且对 `prefixed-file` 布局 MUST NOT 删除承载目录本身。

#### Scenario: 与同目录其它 prompt 共存
- **GIVEN** `.pi/prompts/` 下同时存在 iagent 产物与 OpenSpec 的 `opsx-apply.md`
- **WHEN** 执行 reconcile 扫描或 uninstall
- **THEN** 仅识别/删除 `iagent-` 前缀文件，`opsx-apply.md` 与用户自建 prompt 均不受影响

#### Scenario: 承载目录保留
- **WHEN** uninstall 删除全部 iagent Pi prompt 产物后检查 `.pi/prompts/`
- **THEN** 目录本身及其它文件保留

#### Scenario: 无指令产物的工具被跳过
- **GIVEN** 某工具的 commandsDir 为空字符串（skills-only，如 codex）
- **WHEN** 执行布局判定或指令侧扫描/清理
- **THEN** 在拼接路径前整体跳过，不做布局解析，项目根下同名目录不受影响

### Requirement: 错误位置旧产物清理
系统 SHALL 在 init 与 update 入口清理早期版本错误生成到 `.pi/commands/iagent/` 的 iagent 指令产物（存在时），清理必须幂等且失败不得阻断主流程。

#### Scenario: 清理旧位置指令文件
- **GIVEN** 项目存在早期生成的 `.pi/commands/iagent/pwd.md`
- **WHEN** 执行 iagent init 或 update
- **THEN** 该目录及其中的 iagent 指令文件被移除，且不产生告警级别的失败

#### Scenario: 无旧位置时不动作
- **GIVEN** 项目不存在 `.pi/commands/iagent/`
- **WHEN** 执行 init 或 update
- **THEN** 无相关删除动作，主流程不受影响
