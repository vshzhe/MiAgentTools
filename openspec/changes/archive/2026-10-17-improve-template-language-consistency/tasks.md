# Tasks: improve-template-language-consistency

<!-- 任务类型标签：
     [代码] 实现代码 / [测试] 测试代码 / [DB脚本] 数据库脚本 / [使用说明] 补充文档
     [测试] 必须带层级 [单元]/[功能] 与优先级 [P0]/[P1]/[P2]
     每个任务均标注 Spec Ref / Scenario Ref，测试任务覆盖可验证场景。 -->

## 1. 明确并落地语言边界

- [x] [代码] 1.1 中文化公共门控文本与共享说明
  - 文件：`src/core/templates/prompt-gate.ts`、`src/core/templates/flowchart-gate.ts`
  - 内容：将普通解释性英文翻译为中文；保留 `Input`、`Output`、`Phase`、`Step`、`Guardrails`、`MUST`、`MUST NOT`、`SHALL` 等固定术语；同步处理 `Prompt Validation Gate`、`Functional Flowchart`、`Checkpoint Enforcement`、`hard conflict`。
  - 验证：检查 compact/full 两种渲染结果及所有引用方。
  - Spec Ref：`skill-template-language / 生成产物的自然语言默认使用中文`
  - Scenario Ref：内置技能生成中文正文
  - Scenario Ref：参考文件生成中文正文

- [x] [代码] 1.2 中文化 spec 与 project-init 模板源文本
  - 文件：`src/core/templates/workflows/spec-*.ts`、`src/core/templates/workflows/project-init.ts`
  - 内容：翻译普通说明句、自然语言标题和解释段，保留命令、路径、标识符、协议字段、代码块与规范性固定词。
  - 验证：确认现有单一来源模板的 skill 与 command 派生结果仍一致。
  - Spec Ref：`skill-template-language / 生成产物的自然语言默认使用中文`
  - Spec Ref：`skill-template-language / 技术契约与规范术语保持稳定`
  - Scenario Ref：内置技能生成中文正文
  - Scenario Ref：代码与命令内容不被翻译

- [x] [代码] 1.3 中文化编排与迁移模板源文本
  - 文件：`src/core/templates/workflows/workflow.ts`、`auto-workflow.ts`、`debug.ts`、`migration.ts`、`migration-check.ts`、`proposal-review.ts`
  - 内容：翻译自然语言流程、阶段说明、错误处理和解释性术语；保留协议性英文标题、工具名、命令、路径、标识符和固定状态值。
  - 验证：逐模板核对门控、委派、回执、参数注入和 Guardrails 语义未改变。
  - Spec Ref：`skill-template-language / 生成产物的自然语言默认使用中文`
  - Spec Ref：`skill-template-language / 技术契约与规范术语保持稳定`
  - Scenario Ref：内置技能生成中文正文
  - Scenario Ref：代码与命令内容不被翻译

- [x] [代码] 1.4 中文化普通功能模板与技能描述
  - 文件：`src/core/templates/workflows/test.ts`、`commit.ts`、`svn-commit.ts`、`review.ts`、`feature-doc.ts`、`requirement-doc.ts` 及其余模板的 `description`
  - 内容：普通说明中文化；保留英文触发关键词和 `NOT for` 排歧结构；不改变用户自定义 `--desc` 的原文。
  - 验证：运行 description 结构、长度、触发词、排歧和自定义 `--desc` 原文保持测试。
  - Spec Ref：`skill-template-language / 技术契约与规范术语保持稳定`
  - Scenario Ref：技能描述保留触发与排歧契约

## 2. 收束 skill/command 单一来源

- [x] [代码] 2.1 迁移编排与迁移类手工双写模板
  - 文件：`src/core/templates/workflows/migration-check.ts`、`migration.ts`、`workflow.ts`、`auto-workflow.ts`、`debug.ts`、`proposal-review.ts`
  - 内容：将 command 正文改为从对应 skill 正文调用 `deriveCommandContent()` 派生；对仅 skill 版参考内容增加成对 `CMD:SKIP` 标记。
  - 验证：逐模板确认 command 不再维护独立完整正文，并核对 Guardrails、确认门、参数契约和委派约束均保留。
  - Spec Ref：`template-single-source / 技能正文作为内置指令的唯一维护源`
  - Spec Ref：`template-single-source / 派生正文支持技能版与指令版差异`
  - Scenario Ref：手工双写模板迁移为派生模板
  - Scenario Ref：仅技能版内容被安全裁剪
  - Scenario Ref：关键防护语句在指令版保留
  - Scenario Ref：异常裁剪标记按 fail-safe 处理

- [x] [代码] 2.2 迁移普通功能类手工双写模板
  - 文件：`src/core/templates/workflows/test.ts`、`commit.ts`、`svn-commit.ts`、`review.ts`、`feature-doc.ts`、`requirement-doc.ts`
  - 内容：将 `CommandTemplate.content` 改为 skill 正文派生；command 只保留 `name`、`description`、`category`、`tags` 等元数据，不再维护独立完整 Markdown 正文。
  - 验证：确认指令正文仍包含原有入口、约束、报告格式和安全规则。
  - Spec Ref：`template-single-source / 技能正文作为内置指令的唯一维护源`
  - Scenario Ref：手工双写模板迁移为派生模板
  - Scenario Ref：20 个内置配对均完成单一来源迁移

- [x] [代码] 2.3 审计全部 20 个模板的派生关系
  - 文件：`src/core/templates/registry.ts`、`src/core/templates/workflows/*.ts`
  - 内容：确认每个注册的 skill/command 配对均由 skill 正文派生，注册顺序、技能名、command id、frontmatter 和工具适配器调用不变。
  - 验证：建立全量配对清单，禁止新增独立 command 完整正文。
  - Spec Ref：`template-single-source / 技能正文作为内置指令的唯一维护源`
  - Spec Ref：`template-single-source / 模板派生关系和快照同步可验证`
  - Scenario Ref：20 个内置配对均完成单一来源迁移
  - Scenario Ref：任一配对出现第二份手工正文时失败

## 3. 增加回归测试

- [x] [测试][单元][P0] 3.1 新增生成产物语言边界测试
  - 文件：`test/template-language.test.ts`
  - 内容：生成并检查全部技能正文、参考文件及 Claude、Pi、OpenCode 三类 command 正文；使用明确白名单过滤代码块、反引号内容、命令、路径、标识符、固定协议词、英文触发词和 `NOT for`；发现英文自然描述时报告技能名、文件和行内容。
  - 验证：加入英文自然句回归样例应失败，合法保留项应通过。
  - Spec Ref：`skill-template-language / 生成结果具备语言回归校验`
  - Scenario Ref：英文自然描述回归被拦截
  - Scenario Ref：合法英文保留项不产生误报

- [x] [测试][单元][P0] 3.2 扩展全量模板单一来源测试
  - 文件：`test/template-derivation.test.ts`、`test/template-consistency.test.ts`
  - 内容：将派生一致性覆盖从当前基线扩展到全部 20 个模板；验证 command 无 `CMD:SKIP` 泄漏，Guardrails、确认门、输入契约等关键语句按模板保留，并补充未闭合、孤立结束、嵌套/乱序标记的 fail-safe 测试。
  - 验证：构造独立 command 正文或删除派生调用时测试失败。
  - Spec Ref：`template-single-source / 模板派生关系和快照同步可验证`
  - Spec Ref：`template-single-source / 派生正文支持技能版与指令版差异`
  - Scenario Ref：任一配对出现第二份手工正文时失败
  - Scenario Ref：关键防护语句在指令版保留
  - Scenario Ref：异常裁剪标记按 fail-safe 处理

- [x] [测试][单元][P1] 3.3 回归技术契约、描述和工具适配测试
  - 文件：`test/generation.test.ts`、`test/description-format.test.ts`、`test/command-reference-refs.test.ts`、`test/allowed-tools.test.ts`
  - 内容：确保中文化不改变 YAML frontmatter、英文触发词、`NOT for`、command 引用、工具白名单、参数占位符和指纹；逐项检查 Claude、Pi、OpenCode 三类产物。
  - 验证：执行相关测试并检查 Claude、Pi、OpenCode 三类产物。
  - Spec Ref：`skill-template-language / 技术契约与规范术语保持稳定`
  - Scenario Ref：代码与命令内容不被翻译
  - Scenario Ref：技能描述保留触发与排歧契约

- [x] [测试][单元][P1] 3.5 验证用户自定义 description 不被翻译
  - 文件：`test/generation.test.ts`、`src/commands/generate.ts`
  - 内容：使用包含英文和中英混合内容的 `--desc` 生成技能，断言 frontmatter `description` 与输入完全一致。
  - 验证：测试失败时不得通过放宽语言白名单解决，必须保持生成器不转换用户输入。
  - Spec Ref：`skill-template-language / 技术契约与规范术语保持稳定`
  - Scenario Ref：自定义描述保持原文

- [x] [测试][功能][P1] 3.4 验证静态快照和参考文件同步
  - 文件：`test/skills-parity.test.ts`、`test/skill-size-budget.test.ts`
  - 内容：确认模板、`skills/` 快照和 `references/` 文件字节一致，且中文化未突破现有技能尺寸预算。
  - 验证：运行快照、参考文件和尺寸预算测试。
  - Spec Ref：`template-single-source / 模板派生关系和快照同步可验证`
  - Scenario Ref：模板中文化后快照同步

## 4. 生成产物与交付验证

- [x] [代码] 4.1 重新生成技能快照并检查目标工具产物
  - 文件：`skills/`、必要的生成产物检查范围
  - 内容：执行 `pnpm build && pnpm generate:skills`，确认静态快照、参考文件和已配置工具产物反映模板最新内容。
  - 验证：确认无旧英文自然正文、无多余技能目录，并逐项检查 Claude、Pi、OpenCode 的命令引用和参数注入正常。
  - Spec Ref：`skill-template-language / 生成产物的自然语言默认使用中文`
  - Spec Ref：`template-single-source / 模板派生关系和快照同步可验证`
  - Scenario Ref：内置技能生成中文正文
  - Scenario Ref：模板中文化后快照同步

- [x] [测试][功能][P1] 4.2 执行完整构建、测试和静态检查
  - 文件：无新增文件；验证 `src/`、`test/`、`skills/` 全部变更
  - 内容：运行 `pnpm build`、`pnpm test`、`pnpm lint`，记录并处理由本变更引起的失败。
  - 验证：构建、测试和 lint 全部通过；现有未相关失败必须单独记录，不得静默忽略。
  - Spec Ref：`skill-template-language / 生成结果具备语言回归校验`
  - Spec Ref：`template-single-source / 模板派生关系和快照同步可验证`
  - Scenario Ref：英文自然描述回归被拦截
  - Scenario Ref：20 个内置配对均完成单一来源迁移

- [x] [使用说明] 4.3 更新版本和变更日志
  - 文件：`package.json`、`CHANGELOG.md`、项目中必要的版本示例
  - 产出：版本号与本次功能变更对应的变更日志条目
  - 内容：按项目版本规则将当前 `6.3.0` 递增为 `6.4.0`，归档 `[Unreleased]` 中已累积条目，并说明模板中文化、单一来源迁移和回归测试覆盖范围。
  - 验证：确认版本引用、变更日志链接和生成产物版本元数据一致。
  - Spec Ref：`skill-template-language / 生成结果具备语言回归校验`
  - Spec Ref：`template-single-source / 模板派生关系和快照同步可验证`
  - Scenario Ref：模板中文化后快照同步
