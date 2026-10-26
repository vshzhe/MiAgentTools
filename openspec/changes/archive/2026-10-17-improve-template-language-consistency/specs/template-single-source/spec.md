## ADDED Requirements

### Requirement: 技能正文作为内置指令的唯一维护源

每个内置技能与其配对指令 MUST 以 `SkillTemplate.instructions` 作为正文唯一维护源。`CommandTemplate.content` MUST 通过 `deriveCommandContent()` 派生，不得继续维护第二份完整正文字符串。

#### Scenario: 手工双写模板迁移为派生模板

- **WHEN** 维护任一当前仍手工双写的内置技能模板
- **THEN** 其 command 模板通过对应 skill 模板调用 `deriveCommandContent()` 生成
- **AND** command 模板不再包含独立的完整 Markdown 正文

#### Scenario: 20 个内置配对均完成单一来源迁移

- **WHEN** 查询全部内置技能与指令模板注册项
- **THEN** 20 个配对均满足 skill 正文到 command 正文的可验证派生关系
- **AND** 模板注册顺序、技能名称、指令 id、frontmatter 和目标工具适配器行为保持不变

### Requirement: 派生正文支持技能版与指令版差异

当技能版需要比指令版承载更多参考性内容时，模板 MUST 使用成对的 `<!-- CMD:SKIP -->` 与 `<!-- /CMD:SKIP -->` 标记裁剪仅技能版内容；未标记内容默认保留到指令版，Guardrails 和执行必需的防护语句不得被裁剪。

#### Scenario: 仅技能版内容被安全裁剪

- **WHEN** skill 正文包含成对 `CMD:SKIP` 标记的参考性段落
- **THEN** `deriveCommandContent()` 从 command 正文移除该段及标记本身
- **AND** skill 正文仍保留该段内容

#### Scenario: 关键防护语句在指令版保留

- **WHEN** skill 正文包含未标记的 Guardrails、参数契约、确认门或安全约束
- **THEN** 派生 command 正文保留这些内容
- **AND** 派生结果不泄漏 `CMD:SKIP` 标记

#### Scenario: 异常裁剪标记按 fail-safe 处理

- **WHEN** skill 正文包含未闭合起始标记、孤立结束标记或嵌套/乱序标记
- **THEN** 派生结果遵循 `deriveCommandContent()` 的 fail-safe 规则，不因异常标记丢失正文或防护语句
- **AND** 输出正文不包含任何 `CMD:SKIP` 标记行

### Requirement: 模板派生关系和快照同步可验证

测试 MUST 覆盖所有内置模板的 skill/command 派生关系，并保证模板变更后重新生成的 `skills/` 快照与当前模板完全一致。

#### Scenario: 任一配对出现第二份手工正文时失败

- **WHEN** 任一 command 模板脱离 skill 正文重新维护完整内容
- **THEN** 模板派生一致性测试失败
- **AND** 测试报告对应的技能名或 command id

#### Scenario: 模板中文化后快照同步

- **WHEN** 模板正文或公共文本发生语言调整
- **THEN** 执行构建和技能快照生成后，`skills/` 中的 `SKILL.md` 与参考文件和模板生成结果一致
- **AND** 不产生旧英文正文或多余技能目录
