## ADDED Requirements

### Requirement: 生成产物的自然语言默认使用中文

技能模板生成的 `SKILL.md`、`references/*.md` 以及目标工具指令正文中的普通解释性自然语言 MUST 使用中文。该规则适用于现有 20 个内置技能及其派生指令，不得只修复静态快照而保留模板源文本中的英文混用。

#### Scenario: 内置技能生成中文正文

- **WHEN** 使用任一内置 `SkillTemplate` 生成 `SKILL.md`
- **THEN** 普通说明句、阶段说明、操作步骤、错误提示和自然语言约束以中文输出
- **AND** `Prompt Validation Gate`、`Functional Flowchart`、`Checkpoint Enforcement`、`hard conflict` 等普通解释性术语使用已约定的中文表达

#### Scenario: 参考文件生成中文正文

- **WHEN** 技能模板声明 `references/*.md` 并生成附加参考文件
- **THEN** 参考文件中的普通解释性自然语言遵循与 `SKILL.md` 相同的中文规则
- **AND** 参考文件不得成为未被语言回归测试覆盖的英文正文旁路

### Requirement: 技术契约与规范术语保持稳定

语言中文化 MUST NOT 修改会影响执行、解析、权限、路由或验收的固定内容，包括命令、路径、标识符、协议字段、工具名、代码块、占位符、`Input`、`Output`、`Phase`、`Step`、`Guardrails`、`MUST`、`MUST NOT`、`SHALL`、状态等级和结构化标记。

语言回归测试的英文保留白名单 MUST 至少覆盖：反引号与代码围栏内容、命令和路径、`/iagent:*` 与 `$ARGUMENTS` 等占位符、工具/API/协议名称、`Input`/`Output`/`Phase`/`Step`/`Guardrails`、`MUST`/`MUST NOT`/`SHALL`、`CRITICAL`/`WARNING`/`SUGGESTION`、英文触发词及 `NOT for`。

#### Scenario: 代码与命令内容不被翻译

- **WHEN** 生成内容包含命令、路径、代码块、正则、JSON/YAML、API 字段或 `$ARGUMENTS` 等占位符
- **THEN** 这些内容与模板定义保持一致
- **AND** 中文化过程不得改变反引号内容、代码块内容或命令引用

#### Scenario: 技能描述保留触发与排歧契约

- **WHEN** 生成技能 frontmatter 的 `description`
- **THEN** 保留英文触发关键词及 `NOT for` 排歧结构
- **AND** 不自动翻译用户通过 `iagent generate --desc` 提供的自定义描述

#### Scenario: 自定义描述保持原文

- **WHEN** 用户通过 `iagent generate --desc` 传入包含英文或中英混合内容的自定义描述
- **THEN** 生成结果中的 `description` 与用户输入保持一致
- **AND** 生成器不得对该值执行自动翻译或词典替换

### Requirement: 生成结果具备语言回归校验

测试 MUST 以生成结果为对象，检查内置技能正文、参考文件和目标工具指令正文的语言边界；代码块、固定协议术语和已批准的英文保留项 MUST 从自然语言检查中排除。

#### Scenario: 英文自然描述回归被拦截

- **WHEN** 内置模板或公共文本重新引入英文自然描述句
- **THEN** 语言一致性测试失败并指出技能或指令标识及对应文本位置
- **AND** 测试不得仅依赖 `skills/` 快照扫描而漏掉模板源文本

#### Scenario: 合法英文保留项不产生误报

- **WHEN** 生成结果包含命令、标识符、协议固定词、代码块、英文触发词或 `NOT for`
- **THEN** 语言一致性测试允许这些内容存在
- **AND** 快照一致性、指令引用、白名单和指纹相关测试继续按原契约执行
