## Why

当前内置技能模板同时存在中文自然语言、英文自然语言和中英混排内容。生成器会原样输出模板正文，因此混用会扩散到 `skills/` 静态快照以及 Claude Code、Pi、OpenCode 的指令产物，降低技能可读性与中文项目中的使用一致性。

此外，20 个内置技能中仍有一批模板分别维护 `SkillTemplate.instructions` 与 `CommandTemplate.content`。同一规则在技能与指令之间重复维护，后续中文化或规则修订容易造成内容漂移和防护语句缺失。

## What Changes

- 将内置技能模板中的普通解释性英文翻译为中文，覆盖技能正文、公共门控文本和生成的参考文件内容。
- 保留具有机器契约或规范语义的英文内容，包括命令、路径、标识符、协议字段、工具名、代码块、`Input`、`Output`、`Phase`、`Step`、`Guardrails`、`MUST`、`MUST NOT`、`SHALL` 等。
- 将 `Prompt Validation Gate`、`Functional Flowchart`、`Checkpoint Enforcement`、`hard conflict` 等普通解释性术语改为中文。
- 保留技能描述中用于触发与排歧的英文关键词及 `NOT for` 结构。
- 将剩余手工双写模板逐步迁移为 skill 正文单一来源，使用 `deriveCommandContent()` 派生指令正文，并通过 `CMD:SKIP` 标记控制仅技能版内容。
- 增加生成产物语言一致性与模板派生一致性测试，覆盖 `SKILL.md`、参考文件和指令正文。
- 重新生成 `skills/` 静态快照；不引入在线翻译服务或运行时翻译依赖。

## Capabilities

### New Capabilities

- `skill-template-language`: 规定技能与指令生成产物的中文自然语言边界，以及必须保留的技术契约和规范术语。
- `template-single-source`: 将技能正文作为唯一维护源，并从中派生指令正文，防止技能与指令内容漂移。

### Modified Capabilities

无。当前 `openspec/specs/` 未发现可直接修改的主能力规格，本变更新增上述能力规格。

## Impact

### 直接影响的文件

- `src/core/templates/workflows/*.ts`: 翻译普通解释性文本，并逐步移除手工双写的指令正文。
- `src/core/templates/prompt-gate.ts`: 中文化普通门控说明，保留协议性英文术语。
- `src/core/templates/flowchart-gate.ts`: 中文化普通流程图说明，保留必要的协议与格式标识。
- `src/core/templates/derive-command.ts`: 复用现有派生机制；如验证发现能力不足，仅做兼容性增强。
- `test/`: 新增语言一致性测试，扩展模板单一来源与快照一致性测试。
- `skills/`: 由模板重新生成静态技能快照及 `references/` 文件。
- `CHANGELOG.md`、`package.json` 及必要的版本引用：按项目版本规则同步更新。

### 向后兼容

无命令行参数或运行时数据格式破坏性变更。生成产物的自然语言会发生预期变化；命令引用、工具白名单、参数占位符、frontmatter 契约、指纹机制和目标工具目录布局保持不变。

用户自定义 `iagent generate --desc` 输入不自动翻译，保留用户原文。
