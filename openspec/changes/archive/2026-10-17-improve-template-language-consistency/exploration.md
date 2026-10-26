# Exploration: improve-template-language-consistency

## 提示词基线

### 原始需求

分析当前项目内容，修复指令技能中英文混合问题，在生成技能时，除了特定描述外，其他内容把英文转为中文。

### 确认后的基线

以模板源文本为中文化真源，不在生成器中引入动态翻译。代码、命令、路径、标识符、协议字段、工具名、代码块和其他具有机器契约或规范语义的内容保留英文；普通解释性自然语言翻译为中文。`Input`、`Output`、`Phase`、`Step`、`Guardrails`、`MUST`、`MUST NOT`、`SHALL` 等协议性固定词保留英文。`Prompt Validation Gate`、`Functional Flowchart`、`Checkpoint Enforcement`、`hard conflict` 等普通解释性术语翻译为中文。技能描述中的英文触发词和 `NOT for` 排歧结构保留；用户自定义 `--desc` 原文不自动翻译。

剩余手工双写模板逐步迁移为 skill 正文单一来源，最终全部 20 个内置 skill/command 配对使用 `deriveCommandContent()` 派生，必要的 skill 专属内容使用 `CMD:SKIP` 标记。

## 当前实现发现

- `src/core/command-generation/generator.ts` 直接输出 `SkillTemplate.instructions` 与 `CommandContent.body`，没有语言转换层。
- `scripts/generate-skills.mjs` 根据模板生成 `skills/` 静态快照，`test/skills-parity.test.ts` 锁定快照一致性。
- 当前共有 20 个内置技能。
- `project-init` 与 7 个 `spec-*` 模板已经使用 `deriveCommandContent()`。
- `migration-check`、`migration`、`workflow`、`auto-workflow`、`debug`、`proposal-review`、`test`、`commit`、`svn-commit`、`review`、`feature-doc`、`requirement-doc` 仍有手工双写 command 正文。
- `prompt-gate.ts`、`flowchart-gate.ts` 和多个工作流模板含有英文自然语言段落。
- `test/description-format.test.ts` 明确要求保留英文触发关键词与 `NOT for`。
- 当前工作区存在 OpenCode 工具适配相关未提交变更，本变更不覆盖这些无关修改。

## 设计决策

1. 不使用在线翻译、运行时翻译或通用正则翻译；直接修改模板源文本。
2. 普通解释句中文化，机器契约和规范性固定词保留英文。
3. 所有内置 command 正文最终从 skill 正文派生。
4. `CMD:SKIP` 只裁剪参考性内容，未标记内容默认保留，以维持 fail-safe 防护。
5. 语言测试检查模板生成结果、参考文件和指令正文，并排除合法英文保留项。

## 范围与验收

- 覆盖技能模板、公共门控文本、参考文件、Claude/Pi/OpenCode 指令正文和静态快照。
- 不改变命令 id、命令引用、工具白名单、参数占位符、frontmatter、指纹和工具目录布局。
- 20 个模板配对均通过单一来源派生测试。
- 普通英文自然描述重新出现时语言回归测试失败。
- `pnpm build`、`pnpm test`、`pnpm lint` 通过。

## 本次无业务功能流程

本次变更是模板文本与生成链路一致性调整，没有独立的业务功能操作流程；仅存在技术生成管线，不产出业务功能流程图。

## 待确认项

无。协议性固定词范围、普通解释性术语范围、单一来源迁移范围和自定义描述处理方式均已确认。
