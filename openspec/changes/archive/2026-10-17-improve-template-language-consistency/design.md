## Context

当前生成链路把模板文本原样写入产物：`generateSkillContent()` 输出 `SkillTemplate.instructions`，`generateCommand()` 输出 `CommandContent.body`，`scripts/generate-skills.mjs` 再生成 `skills/` 静态快照。生成层没有翻译能力，也不应在构建时依赖在线服务。

仓库共有 20 个内置技能。`project-init` 与 7 个 `spec-*` 模板已经使用 `deriveCommandContent()`，其余 12 个模板仍分别维护 skill 正文和 command 正文。现有 `deriveCommandContent()` 已支持成对的 `CMD:SKIP` 标记、未标记内容默认保留和未闭合标记的 fail-safe 规则，适合作为剩余模板迁移的基础。

当前工作区还包含 OpenCode 工具适配相关的未提交变更。本设计不改变工具选择、OpenCode 目录布局、适配器 frontmatter 或权限行为，只处理模板文本与 skill/command 正文来源。

## Goals / Non-Goals

**Goals**:

- 使内置技能、参考文件和指令正文中的普通解释性自然语言统一为中文。
- 明确并测试英文保留边界，避免翻译命令、路径、标识符、协议字段、工具名、代码块和规范性固定词。
- 将全部 20 个内置 skill/command 配对收束为 skill 正文单一来源。
- 使用 `CMD:SKIP` 保留 skill 完整版与 command 压缩版之间的必要差异。
- 保持命令引用、权限白名单、参数注入、frontmatter、指纹、目录布局和静态快照契约不变。

**Non-Goals**:

- 不在 `generateSkillContent()` 或 CLI 中引入通用运行时翻译器。
- 不翻译用户通过 `iagent generate --desc` 提供的自定义文本。
- 不修改 OpenCode、Pi、Claude Code 的工具适配协议。
- 不重构技能业务流程、门控语义、工具白名单或参考文件分层策略。
- 不在本变更中修改已有主规格；本变更新增两个能力规格。

## Decisions

### D1: 以模板源文本作为中文化真源

- **选择**：直接修改 `src/core/templates/` 中的模板源文本，再使用既有生成器生成产物。
- **理由**：构建结果确定、可审查、离线可复现，不会因机器翻译误改命令或协议语义。
- **备选**：在生成器中做正则替换或接入在线翻译；前者无法处理自然句，后者引入网络、凭据、成本和不可复现风险，因此不采用。

### D2: 采用显式英文保留边界

- **选择**：普通解释句翻译为中文；语言测试明确排除以下白名单：反引号与代码围栏内容、命令和路径、`/iagent:*` 与 `$ARGUMENTS` 等占位符、工具/API/协议名称、`Input`、`Output`、`Phase`、`Step`、`Guardrails`、`MUST`、`MUST NOT`、`SHALL`、`CRITICAL`、`WARNING`、`SUGGESTION`、英文触发词和 `NOT for`。
- **理由**：这些内容承担机器解析、权限执行、规范约束或技能匹配职责，不能按普通散文翻译。
- **备选**：按所有 ASCII 单词一律翻译；会破坏代码、命令和已有 description 契约，因此不采用。

### D3: 普通解释性术语统一中文化

- **选择**：`Prompt Validation Gate`、`Functional Flowchart`、`Checkpoint Enforcement`、`hard conflict` 及同类普通说明术语改为中文；只有在代码、测试契约或固定协议字段中必须保留时才维持英文。
- **理由**：这些词在当前模板中主要作为面向 AI 的解释性散文，不是必须保留的命令或字段。
- **备选**：所有术语中英并列；会继续制造中英混排，且无法满足正文中文化目标，因此不采用。

### D4: skill 正文是唯一维护源

- **选择**：将剩余 12 个手工双写模板的 `CommandTemplate.content` 改为调用对应的 `deriveCommandContent(getXxxSkillTemplate().instructions)`。command 仍可独立声明 `name`、`description`、`category`、`tags` 等元数据，但不得再声明独立的完整 Markdown 正文。
- **理由**：消除语言修订、护栏修订和流程修订时的双模板漂移；与现有 8 个模板已经验证的模式一致。
- **备选**：继续手工同步两份正文；已有漂移历史且无法由测试可靠证明未来不会分叉，因此不采用。

### D5: 使用 `CMD:SKIP` 表达版本差异

- **选择**：skill 专属的长篇参考说明、示例或交互细节用成对 `<!-- CMD:SKIP -->` / `<!-- /CMD:SKIP -->` 标记；未标记内容默认进入 command。
- **理由**：现有派生函数是 fail-safe：漏标只会让 command 变长，不会静默丢失防护语句；Guardrails 和执行契约可自然保留。
- **备选**：为 skill 和 command 增加第二个可配置正文字段；会重新引入双源漂移，因此不采用。

异常标记继续沿用 `deriveCommandContent()` 的既有 fail-safe 规则：未闭合起始标记保留缓冲正文并剥离标记行，孤立结束标记只剥离自身，嵌套或乱序不导致正文静默丢失。

### D6: 分批迁移模板，但本变更完成全量收束

- **选择**：按公共文本、spec/project-init、编排与迁移、普通功能模板分批实施；最终以下 20 个配对全部满足单一来源测试：`project-init`、`migration-check`、`migration`、`workflow`、`auto-workflow`、`debug`、`proposal-review`、`test`、`commit`、`svn-commit`、`review`、`feature-doc`、`requirement-doc`、`spec-explore`、`spec-propose`、`spec-apply`、`spec-archive`、`spec-bulk-archive`、`spec-verify`、`spec-verify-proposal`。
- **理由**：降低单次翻译和语义复核风险，同时避免“逐步”变成永久保留手工双写模板。
- **备选**：只迁移高风险模板，保留其余 12 个手工双写；无法满足长期防漂移目标，因此不采用。

### D7: 语言测试检查生成结果并排除合法保留项

- **选择**：新增语言回归测试，读取模板生成的 skill、references 和 Claude、Pi、OpenCode 三类 command 内容；代码块、固定协议词、命令、标识符、英文触发词和 `NOT for` 使用显式排除或白名单，并单独断言用户自定义 `--desc` 原文不变。
- **理由**：最终问题发生在生成产物，同时测试也必须能发现模板源文本重新引入英文自然句的回归。
- **备选**：只扫描 `skills/` 快照；无法阻止模板源与快照暂时不一致，也无法覆盖 command 产物，因此不采用。

### D8: 保持现有版本与快照发布流程

- **选择**：模板和测试完成后执行 `pnpm build && pnpm generate:skills`，按当前功能变更基线将版本从 `6.3.0` 递增到 `6.4.0`，同步更新 `CHANGELOG.md` 和必要的版本引用。
- **理由**：这是仓库对模板快照和功能变更的既有交付约束。
- **备选**：只修改源模板、不更新快照；会触发 `skills-parity` 失败，因此不采用。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 英文保留规则过宽，中文化效果不足 | 以生成产物为对象增加回归测试，并逐文件复核自然语言句子 |
| 英文保留规则过窄，破坏命令或协议契约 | 代码块、反引号内容、固定字段和工具标识使用明确白名单；保留现有契约测试 |
| 将 skill 专属段误标为 `CMD:SKIP` 导致 command 缺少防护 | 未标记默认保留；新增派生测试核对 Guardrails、确认门和参数契约 |
| 20 个模板一次性迁移导致快照差异较大 | 按模板家族分批处理，并在每批执行模板派生、语言和快照测试 |
| 现有断言依赖英文展示文本 | 只更新面向展示文本的断言；不改变命令 id、协议字段和机器契约断言 |
| 当前工作区存在其他未提交变更 | 实施时仅修改本变更列出的模板、测试、快照、版本和日志文件，禁止覆盖无关工作区修改 |
