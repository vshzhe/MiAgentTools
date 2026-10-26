# Proposal: iagent-rebrand

## Why

现命名体系把「品牌前缀 / 生命周期类型段 / 功能名」压进同一个标识符：`venus_tr_impl_feature`。其中 `tr` 段零信息量，功能段又存在 `genfull` 这类完全不可自解释的名字，最长指令达 21 字符。结果是用户看到指令名无法判断其功能，必须查文档。同时配置目录 `.venus/` 与工具品牌耦合，无法随工具改名。需要一次性重构为以功能命名、单一 token 口径的体系，并借机修正类型段与 generate 组合规则。

## What Changes

- **BREAKING** 全局标识 token 迁移到 `iagent` 单一口径：技能名前缀 `venus_` → `iagent_`、CLI 二进制 `venus` → `iagent`、斜杠指令命名空间 `/venus:` → `/iagent:`、工具指令子目录 `.claude/commands/venus/` → `.claude/commands/iagent/`、项目配置目录 `.venus/` → `.iagent/`
- **BREAKING** 27 个技能与 27 条斜杠指令重命名：去掉生命周期类型段（`tr_*`），保留 `spec` 领域段（该段标记「依赖 openspec/ 与 openspec CLI」这一真实差异）。指令 id 由技能名派生的规则不变（去前缀 + 下划线转连字符）
- **BREAKING** 类型体系去 `tr`：`tr_init`/`tr_impl`/`tr_test`/`tr_commit`/`tr_review`/`tr_release`/`tr_tools`/`tr_docs` → `init`/`impl`/`test`/`commit`/`review`/`release`/`tools`/`docs`（`spec` 不变）。连带 `.iagent/rules/<type>.md` 文件名与 config.yaml 的 `rules:` 列表改名
- 修正 `iagent generate` 的名称组合规则：由 `${SKILL_PREFIX}${type}_${name}` 改为 `${SKILL_PREFIX}${name}`。否则技能名已扁平化、而新建技能仍会重新长出类型段，造成新旧不一致。类型此后只写入 frontmatter 的 `metadata.type`
- 27 条指令的展示名 `name: 'Venus: xxx'` 改为 `iAgent: xxx` 口径；27 个 tags 数组中的品牌标签 `venus` 改为 `iagent`、类型标签（`tr_impl` 等）改用去 tr 后的新类型 id；26 个模板显式设置的 `metadata.author` 由 venus-agent-tools 改为 mi-agent-tools
- 新增能力 `agent-tool-identity` 承载身份 token 集、技能命名方案、类型 id 集、指令 id 派生规则与旧→新映射表，使命名契约有单一可引用的需求来源
- `openspec/specs/` 下 4 个自带 `tr-` 的规格 id 改名：`tr-workflow-suite-skills` → `workflow-suite-skills`、`tr-commit-push-skill` → `commit-push-skill`、`tr-migration-skills` → `migration-skills`、`tr-test-generate` → `test-generate`
- 标识重命名的作用域界定：仅替换本工具品牌标识（`venus_` 技能前缀、`.venus/` 配置目录、`venus` CLI 名、`/venus:` 命名空间、`commands/venus` 子目录、`VenusAgentTools` 项目名、tags 中的 `venus` 标签、author 的 venus-agent-tools 取值）。产品与仓库领域名 MUST NOT 被替换：Venus4A（产品名）、Venustech（公司名）、SVN 仓库路径中的 `/svn/venus/` 段、本地项目路径 `E:\WorkSpaces_ahdx\Venus4A`、业务标识符。`vendor/auto-package-svn/` 下的 34 处 venus 命中全部属于后者，本变更 MUST NOT 修改该目录
- 品牌命名的磁盘产物一并改名（实施期发现，共 4 类语义，均非「项目配置目录」）：遗留 sidecar 目录 `openspec/changes/<name>/.venus/`（`SIDECAR_DIR`，@deprecated 的 manifest/decisions/capabilities 布局）与跨变更索引目录 `openspec/changes/archive/.venus/index.db`（`INDEX_DB_PATH`）改用新目录名；shell 补全产物 `~/.venus-completion.sh`、PowerShell profile 下的 `VenusCompletion.ps1`、rc/profile 标记块 `# VENUS-COMPLETION:START/END` 改用 iagent 口径；本机权限条目 `Bash(venus:*)` 由 init/update 会话级合并刷新。旧产物的清理（旧补全脚本与旧 rc 标记块、旧 sidecar 目录、旧 index.db）由伴生变更 iagent-legacy-migration 承担
- 包与仓库标识：`package.json` 的 `name`（`venus-agent-tools` → `mi-agent-tools`）、`description`、`keywords`；`bin/venus.js` → `bin/iagent.js`；frontmatter 默认 `metadata.author`；`LICENSE` 中的项目名；仓库目录 `VenusAgentTools` → `MiAgentTools`
- 同步全部派生与文档产物：`skills/` 静态快照（`pnpm generate:skills`）、26 个测试文件中的名称字面量、13 篇 `docs/` 与 `README.md` / `AGENTS.md` / `CHANGELOG.md`
- 版本号 `1.18.1` → `2.0.0`（BREAKING：删 27 个技能名 + 改 CLI 行为与参数 + 改 frontmatter 契约，按 AGENTS.md 修改守则第 8 条取 major）

## Capabilities

### New Capabilities

- `agent-tool-identity`: 工具的身份标识与命名方案契约：身份 token 集（技能前缀 / 指令命名空间 / 工具指令子目录 / 配置目录 / CLI bin / 包名）、技能命名方案（去生命周期类型段、留 spec 领域段）、类型 id 集、指令 id 派生规则、generate 名称组合规则、旧→新映射表，以及规格 id 的命名约束

### Modified Capabilities


## Impact

### 直接影响的文件

- `src/core/config.ts`: 常量锚点改名：SKILL_PREFIX、COMMAND_NAMESPACE、TOOL_COMMANDS_SUBDIR；SkillType 与 SKILL_TYPES 去 tr 前缀
- `src/core/project-config.ts`: VENUS_DIR_NAME → IAGENT_DIR_NAME；默认 config.yaml 内容（品牌名、rules 列表、workflows 列表）与默认规则文件名随类型改名
- `src/core/templates/registry.ts`: deriveCommandId 文档示例与 27 条 WORKFLOW_PAIRS 注册顺序注释
- `src/core/templates/workflows/`: 26 个模板工厂：技能 name、description、metadata.type、指令展示名、正文内的技能交叉引用与自引用旧名（实测 197 处 / 31 文件）
- `src/core/templates/tool-whitelist.ts`: skillDelegation 的委派条目由 Skill(venus_xxx) 改为 Skill(iagent_xxx)；注释中的裸名约定同步
- `src/core/command-generation/generator.ts`: frontmatter 默认 metadata.author 由 venus-agent-tools 改 mi-agent-tools；SKILL_PREFIX 校验错误文案
- `src/commands/generate.ts`: 技能名组合规则改为 `${SKILL_PREFIX}${name}`，参数 --type 的语义收敛为「只写 metadata.type」
- `src/commands/completion.ts`: VENUS_COMMANDS 补全表与脚本中的 CLI 名改为 iagent
- `src/commands/init.ts`: 输出文案中的目录名与品牌名；--no-scan 说明中的 .venus/scan-baseline.json 路径
- `src/commands/uninstall.ts`: SKILL_PREFIX / TOOL_COMMANDS_SUBDIR 过滤、--purge-config 的目录名与文案
- `src/commands/list.ts`: 按类型分组的展示名与过滤前缀；scanInstalledSkills 的前缀判定
- `src/commands/show.ts`: 前缀剥离逻辑与模糊匹配的候选名展示
- `src/commands/validate.ts`: 命名与类型规范的校验规则（含类型 id 合法性）
- `src/commands/update.ts`: 生成与刷新路径中的前缀、类型与目录名
- `src/commands/spec.ts`: spec 子命令组内引用 .venus/ 与品牌名的文案
- `src/commands/config.ts`: workflow id 列表的展示与写入（id 已随技能名变化）
- `src/commands/onboarding.ts`: 引导提示中的指令名与目录名
- `src/core/project-scan.ts`: SCAN_BASELINE_PATH 由 .venus/scan-baseline.json 改为 .iagent/scan-baseline.json
- `src/core/reconcile.ts`: 孤立产物检测的前缀与指令子目录过滤
- `src/core/command-generation/adapters/claude.ts`: 指令输出目录 .claude/commands/venus/ → .claude/commands/iagent/
- `src/core/command-generation/adapters/pi.ts`: 指令输出目录 .pi/commands/venus/ → .pi/commands/iagent/
- `bin/venus.js`: 改名为 bin/iagent.js，与 package.json 的 bin 字段同步
- `package.json`: name、description、keywords、bin、version（1.18.1 → 2.0.0）
- `.gitignore`: .venus/ → .iagent/；注释中的品牌名与目录说明
- `skills/`: 静态快照全量重生成（27 个技能目录改名 + 54 个文件内容更新）
- `test/`: 26 个测试文件中的技能名/指令名/类型名/目录名字面量，含 skills-parity、allowed-tools、template-derivation 等
- `docs/`: 13 篇文档（skills-manual 195 处、genfull-guide、migration-suite-guide、test-generate-guide 等）与 README.md / AGENTS.md / CHANGELOG.md；部分文档文件名随技能改名
- `openspec/specs/`: 15 个既有规格正文中的标识符字面量替换（.venus/ 目录、venus 命令、tr-* workflow id、tr_* 类型名）；其中 4 个规格 id 本身改名
- `.venus/`: 本机配置目录改名为 .iagent/（内容搬运与类型改名由伴生变更处理）
- `src/core/templates/flowchart-gate.ts`: 注释中列举的 5 个工作流技能名（venus_spec_explore / venus_tr_impl_workflow / venus_tr_impl_auto_workflow / venus_tr_impl_debug / venus_tr_impl_genfull）
- `src/core/templates/prompt-gate.ts`: 注释中的技能名列举与缺陷五维判定段引用的 venus_tr_impl_debug
- `src/core/templates/types.ts`: SkillTemplate.name 的前缀契约说明与指令目录路径契约说明
- `scripts/split-frontend-skill.mjs`: 硬编码的技能名 venus_tr_impl_frontend、metadata.author 与 references 子文件路径示例
- `build.js`: 构建日志中的项目品牌名 VenusAgentTools
- `vendor/auto-package-svn/`: 【MUST NOT 修改】其中 34 处 venus 均为 Venus4A 产品域名与 SVN 仓库路径（/svn/venus/Venus4A/），属产品领域名而非本工具品牌
- `src/cli/index.ts`: Commander 程序名与描述（venus / VenusAgentTools）、init/list/update/completion/uninstall/config/generate 各命令的选项说明文案（含 7 处 .venus/ 路径）；实施期发现此文件原漏列于影响面，由零残留验证（任务 9.1）暴露
- `src/core/spec/sidecar-writer.ts`: SIDECAR_DIR 常量由 '.venus' 改为 '.iagent'（变更目录下的遗留 sidecar 布局，@deprecated）
- `src/core/spec/sqlite-index.ts`: INDEX_DB_PATH 由 'changes/archive/.venus/index.db' 改为新目录名；确保目录存在的逻辑与注释同步
- `src/core/spec/sidecar-schema.ts`: 文件头注释中列举的遗留 sidecar 三个 JSON 路径（openspec/changes/<name>/.venus/*.json）

### 向后兼容

**BREAKING** —— 含破坏性变更。

破坏性变更，不提供兼容层。技能名、指令名、类型 id、配置目录、CLI 二进制名全部改变，既有装机无法直接沿用。旧装机的清理与配置搬运由伴生变更 iagent-legacy-migration 承担（旧 venus_* 技能与指令一律删除，.venus/ 的 context 与 rules 内容按类型映射搬运到 .iagent/）。未执行迁移的旧项目会出现：旧技能既不在更新范围也不在卸载范围（uninstall/reconcile 均按新前缀过滤）成为永久孤儿，且 .venus/ 中用户自写的项目规则静默失效。
