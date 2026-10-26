# Design: iagent-rebrand

## Context

现状是三层命名耦合：`venus_tr_impl_feature` 一个标识符同时编码品牌前缀（`venus_`，Agent Skills 规范要求目录名 == frontmatter name，故前缀不可省）、生命周期类型段（`tr_impl`）与功能段（`feature`）。关键事实是：类型其实已有独立载体——frontmatter 的 `metadata.type`、`.venus/rules/<type>.md` 文件名、config.yaml 的 `rules:` 列表、`venus list` 分组、`venus generate --type` 五项，因此从名字中去掉类型段并不需要动类型体系。

实现结构上，命名有 4 个常量锚点构成单点真源（src/core/config.ts 的 SKILL_PREFIX / COMMAND_NAMESPACE / TOOL_COMMANDS_SUBDIR，src/core/project-config.ts 的 VENUS_DIR_NAME），指令 id 由 deriveCommandId 从技能名派生。但字面量散布极广：全仓 `venus`（不分大小写）2221 处 / 146 文件，`venus_` 技能名 514 处 / 57 文件，模板正文内交叉引用 197 处 / 31 文件。

定名规则（27 项，本变更的权威映射表）：

无 spec 段（20 项）：
  venus_tr_init_project           -> iagent_project_init          /iagent:project-init
  venus_tr_impl_feature           -> iagent_feature               /iagent:feature
  venus_tr_impl_workflow          -> iagent_workflow              /iagent:workflow
  venus_tr_impl_genfull           -> iagent_full_workflow         /iagent:full-workflow
  venus_tr_impl_auto_workflow     -> iagent_auto_workflow         /iagent:auto-workflow
  venus_tr_impl_debug             -> iagent_debug                 /iagent:debug
  venus_tr_impl_frontend          -> iagent_frontend              /iagent:frontend
  venus_tr_impl_migration_check   -> iagent_migration_check       /iagent:migration-check
  venus_tr_impl_auto_migration    -> iagent_migration             /iagent:migration
  venus_tr_impl_review_proposal   -> iagent_proposal_review       /iagent:proposal-review
  venus_tr_test_generate          -> iagent_test                  /iagent:test
  venus_tr_commit_change          -> iagent_commit                /iagent:commit
  venus_tr_commit_push            -> iagent_svn_commit            /iagent:svn-commit
  venus_tr_review_code            -> iagent_review                /iagent:review
  venus_tr_release_version        -> iagent_version               /iagent:version
  venus_release_package           -> iagent_package               /iagent:package
  venus_tr_tools_pwd              -> iagent_pwd                   /iagent:pwd
  venus_tr_tools_list             -> iagent_skills                /iagent:skills
  venus_tr_docs_feature_doc       -> iagent_feature_doc           /iagent:feature-doc
  venus_tr_docs_requirement_doc   -> iagent_requirement_doc       /iagent:requirement-doc

spec 领域段（7 项，保留 spec_ 前缀）：
  venus_spec_explore              -> iagent_spec_explore          /iagent:spec-explore
  venus_spec_propose              -> iagent_spec_propose          /iagent:spec-propose
  venus_spec_apply                -> iagent_spec_apply            /iagent:spec-apply
  venus_spec_archive              -> iagent_spec_archive          /iagent:spec-archive
  venus_spec_bulk_archive         -> iagent_spec_bulk_archive     /iagent:spec-bulk-archive
  venus_spec_verify               -> iagent_spec_verify           /iagent:spec-verify
  venus_spec_verify_proposal      -> iagent_spec_verify_proposal  /iagent:spec-verify-proposal

类型 id（9 项）：tr_init/tr_impl/tr_test/tr_commit/tr_review/tr_release/tr_tools/tr_docs/spec -> init/impl/test/commit/review/release/tools/docs/spec

同时借本次改名修正三处不可自解释的历史遗留：`genfull` → `full-workflow`（原名义完全无法推断「引导式全流程编排」）；`tr-impl-workflow` / `tr-impl-auto-workflow` / `tr-impl-genfull` 三者的差别是产出终点（前者只到规划制品，后两者到归档）与人在环程度，新名以 `workflow` / `full-workflow` / `auto-workflow` 词根统一；`tr-impl-review-proposal` 与 `spec-verify-proposal` 原名近乎不可区分（前者是 8 维度完整性深查，后者是 10 维度量化评分门禁），新名以 `proposal-review`（域外深查）与 `spec-verify-proposal`（spec 域评分门）区分。另在 `tr-commit-push` → `svn-commit` 中补上原名缺失的 SVN 差异。

模板正文内的旧标识引用分四类，各自计数（26 个模板文件内共 27 个技能模板，其中 tools.ts 含 pwd 与 skills 两个技能）：技能名交叉引用与自引用 `venus_` 197 处（重灾区 full-workflow 38、auto-workflow 25、workflow 24、debug 21、tools 10、migration 9）；指令名引用 `/venus:` 49 处；配置目录路径引用 `.venus/` 34 处，分布在 8 个模板（frontend 12、release-package 6、proposal-review 6、project-init 4、requirement-doc 3、spec-archive / spec-bulk-archive / spec-explore 各 1）；tags 数组中的品牌与类型标签 27 处（每模板形如 ['venus', 'tr_impl', ...]）；metadata.author 26 处（每模板显式覆盖为 venus-agent-tools）。四类 MUST NOT 合并为一次笼统替换，需分别收口。

作用域界定（本变更最关键的约束）：全仓 `venus` 2221 处检索面内混有产品与仓库领域名，与本次重命名无关且 MUST NOT 被替换 —— Venus4A（产品名，skills/** 内 74 处）、Venustech（公司名）、SVN 仓库路径 `/svn/venus/`、本地项目路径 `E:\WorkSpaces_ahdx\Venus4A`。`vendor/auto-package-svn/` 下 34 处命中全部属于此类。替换 MUST 按标识符边界精确匹配（`venus_` / `.venus` / `/venus:` / `commands/venus` / `VenusAgentTools`），MUST NOT 使用不分大小写的裸 `venus` 模式。

另有一处既有实现隐患需在本变更内顺带加守卫：工具适配配置中 codex 的 commandsDir 为空字符串，而 uninstall.ts 与 reconcile.ts 均以 `path.join(projectRoot, tool.commandsDir, TOOL_COMMANDS_SUBDIR)` 定位指令目录，空串拼接会得到项目根下的 `venus/` 路径。当前因前缀不匹配侥幸未触发，但本变更改名前缀后该路径的语义会变化，且伴生变更的迁移遍历若照抄该模式会真删项目根下的同名目录。

## Goals / Non-Goals

**Goals**:
- 全局收敛到单一 token 口径 `iagent`：技能前缀 iagent_、CLI bin iagent、指令命名空间 /iagent:、配置目录 .iagent、包名 mi-agent-tools
- 技能名以功能命名并自解释：去掉零信息量的 tr 生命周期类型段，保留有实义的 spec 领域段
- 类型与名字解耦：类型只存在于 metadata.type / rules 文件名 / config rules / --type 参数，不再进入技能名
- 可验证的重命名：结束后全仓对旧 token 零残留（映射表与迁移代码除外），且既有测试全绿
- 修正三类不可自解释或不可区分的历史命名（genfull、workflow 三兄弟、两个提案检查）

**Non-Goals**:
- 不改变任何技能的流程逻辑、阶段划分、白名单能力或触发语义——本变更是纯标识符重命名
- 不合并、拆分或新增技能；27 个技能与 27 条指令保持一对一
- 不实现旧装机自动迁移（由伴生变更 iagent-legacy-migration 承担），本变更只保证新口径自洽
- 不引入新的 CLI 参数或改变命令的语义行为（除 generate 的名称组合规则这一必要修正）
- 不调整工具适配范围（claude / pi / codex 三者不变）

## Decisions

### D1: 命名形状：去 tr 段、保留 spec 领域段
- **选择**: 技能名去掉生命周期类型段，保留 `spec_` 领域段：`iagent_feature` 与 `iagent_spec_propose` 并存
- **理由**: `tr` 三字母零信息量（正是痛点的来源），`spec` 有实义且承载真实的依赖差异。只砍掉零信息量的那一段，保留承载信息的段落。
- **备选**: 全扁平（spec 段也去掉）——被否决：`spec` 段标记「该指令依赖 openspec/ 与 openspec CLI」，是真实能力差异而非冗余；去掉后 /iagent:propose 与已装的 /opsx:propose 语义并列、用户无法区分；保留类型段仅缩短（如 trex）——被否决：仍是无信息量的段，未解决根因

### D2: 单一 token 口径 iagent（含包名与目录）
- **选择**: 技能前缀 iagent_、CLI bin iagent、命名空间 /iagent:、工具指令子目录 iagent、配置目录 .iagent、包名 mi-agent-tools
- **理由**: 技能名前缀、CLI、命名空间、目录四者由同一个词 iagent 承担，避免用户面对多套口径。包名保留 mi-agent-tools 以匹配仓库目录 MiAgentTools。
- **备选**: 技能前缀用更短的 mi_（与包名 mi-agent-tools 一致）——被否决：会在同一项目内并存 mi 与 iagent 两个词，取舍时自解释优先于最短；配置目录用 .mi（与包名一致）——被否决：用户已明确要求目录为 .iagent

### D3: 工作流三兄弟定名：workflow / full-workflow / auto-workflow
- **选择**: `iagent_workflow`（引导式，只到规划制品）、`iagent_full_workflow`（引导式全流程，到归档，含前端阶段）、`iagent_auto_workflow`（全自动，到归档）
- **理由**: 三者的真实差别有二：是否走到归档（发出规划制品 vs 实现并归档）、人在环程度。统一 workflow 词根 + 修饰词，使三者的关系无需文档即可推断。取舍上自解释优先于更短的名字。
- **备选**: workflow / pipeline / auto——被否决：pipeline 与 workflow 的区别仍需查文档；plan / pipeline / auto——被否决：plan 与 pipeline 词形过近易误敲；guided / full / auto——被否决：`full` 无法说明与 guided 的差别

### D4: 两个提案检查定名：spec-verify-proposal / proposal-review
- **选择**: `iagent_spec_verify_proposal`（spec 域 10 维度量化评分门禁）与 `iagent_proposal_review`（域外 8 维度完整性深查）
- **理由**: 保留 spec 族命名一致性，让「域内门禁」与「域外深查」的差别由 domain 段承担，同时消除原名（verify_proposal vs review_proposal）近乎不可区分的问题。
- **备选**: spec-gate / proposal-review——被否决：spec 族内其余 6 项均为 spec-<动词> 结构，spec-gate 破坏族内一致性；spec-verify-proposal / proposal-audit——被否决：audit 与 review 的差异对本项目语境无明显增益，且原技能描述已用「复查」表述

### D5: 类型体系去 tr，且 generate 组合规则同步修正
- **选择**: 类型 id 改为 init/impl/test/commit/review/release/tools/docs/spec；generate 的名称组合由 `${SKILL_PREFIX}${type}_${name}` 改为 `${SKILL_PREFIX}${name}`
- **理由**: 类型文件名与 config rules 列表本就要随配置目录迁移而改写（.venus/ → .iagent/ 是同一批文件），顺手改类型名几乎不增加边际成本；generate 规则不修正则新旧命名不自洽。
- **备选**: 类型保持 tr_* 不动、只改技能名——被否决：用户编辑 .iagent/rules/tr_impl.md 时仍面对零信息量的 tr，只做了一半；且 generate 会重新拼出类型段，与已扁平的 27 个内置技能不一致；取消类型体系、只留 spec 域标记——被否决：类型承载 list 分组、rules 注入、generate --type 三项功能，删除会连带改动这三处功能，超出重命名范围

### D6: spec 领域段与类型段同名 spec 的处理
- **选择**: `spec` 既是类型 id 也是技能名中的领域段，两者保持一致，不另立别名
- **理由**: `iagent_spec_propose` 的类型就是 `spec`，命名与类型自洽，无需额外映射。
- **备选**: 把类型 spec 改名为 workflow——被否决：spec-driven 是本项目沿用的术语，改名反而增加理解成本

### D7: openspec 规格 id 连带去 tr
- **选择**: 4 个自带 tr- 的规格 id 改名：tr-workflow-suite-skills / tr-commit-push-skill / tr-migration-skills / tr-test-generate → 去 tr 前缀
- **理由**: 规格 id 与技能名同属对外标识，一并去 tr 才能让约定完整；改名应在本变更内一次完成，避免遗留两套口径。
- **备选**: 保留规格 id 不动——被否决：规格 id 是本项目对外可见的持久标识，保留 tr 会使「不再使用 tr 命名」的约定在规格层自相矛盾

### D8: 规格 delta 深度：只建新能力，既有规格的标识符替换列作任务
- **选择**: 本变更只声明新能力 `agent-tool-identity`；15 个既有规格正文中的标识符替换作为带零残留验证的任务执行，不逐条写 MODIFIED delta
- **理由**: 新命名契约是真正新增的规格级行为，归入新能力 agent-tool-identity；既有规格的变化是同一契约下的标识符替换，用任务 + 验证（旧标识符零残留）保证落实，比逐条 delta 更可核查。
- **备选**: 15 个既有能力全部写 MODIFIED delta——被否决：纯重命名不改任何行为契约，只改被需求正文引用的标识符字面量；逐个重现需求全文（其中 tr-workflow-suite-skills 单文件含 231 处标识符）制品量极大而信息增益为零；skip_specs: true 不产生规格变更——被否决：会使 openspec/specs/ 中长期保留 .venus/config.yaml、tr-init-project 等陈旧描述，后续变更读规格时得到错误事实

### D9: 版本号取 major
- **选择**: 1.18.1 → 2.0.0
- **理由**: 按 AGENTS.md 修改守则第 8 条的递增表，删技能、改 CLI 行为或参数、改 frontmatter 契约均判 major；取舍歧义时取较大位。
- **备选**: minor（1.19.0）——被否决：本变更删除 27 个技能名、改变 CLI 二进制名与 generate 行为、改变 frontmatter 契约，全部落入 BREAKING 判据

### D10: 作用域界定：品牌标识与产品领域名的区分
- **选择**: 替换范围严格限定为标识符边界精确匹配的 5 类品牌 token（`venus_` / `.venus` / `/venus:` / `commands/venus` / `VenusAgentTools`）加 tags 品牌标签与 author 取值；产品与仓库领域名（Venus4A、Venustech、`/svn/venus/`、`E:\WorkSpaces_ahdx\Venus4A`）一律不动；`vendor/auto-package-svn/` 整个目录 MUST NOT 修改
- **理由**: 本工具品牌名与目标产品名共用 venus 词根（Venus 公司产品线），全仓 2221 处命中里两者混杂。区分规则必须显式写入需求，否则实现者按最省事的方式做全局替换即造成不可逆破坏。
- **备选**: 全仓不分大小写替换裸 venus —— 被否决：会把 34 处 Venus4A 产品域名与 SVN 仓库路径改坏，且这些是打包脚本的运行时依赖，属不可逆破坏；只改 src/ 与 skills/，不管 vendor 与 docs —— 被否决：docs 中的 `venus init` 示例必须改，而 vendor 必须不改，两者不能一刀切，仍需逐类界定

### D11: 空 commandsDir 的指令侧遍历守卫
- **选择**: 对 commandsDir 为空字符串的工具，指令侧遍历（uninstall 删除、reconcile 扫描、迁移清理）一律跳过，不参与路径拼接
- **理由**: codex 为 skills-invocable 模式、commandsDir 为空，指令侧本就不存在产物。跳过是最小且语义正确的修正，同时消除伴生变更的误删入口。
- **备选**: 维持现状不改 —— 被否决：路径拼接会落到项目根下的同名目录，本变更改名前缀后语义变化，且伴生变更的迁移遍历照抄即会误删用户目录；为无适配器工具补一个空适配器 —— 被否决：引入无意义抽象，且与「无适配器即 skills-only」的既有设计相冲突

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 委派白名单改错名：tool-whitelist 的 Skill(iagent_xxx) 条目若与模板正文实际委派的技能不一致，该工具在 Claude Code 中永不授权，且属静默失效 | 按 AGENTS.md 修改守则第 2 条，委派清单必须逐条读模板正文核准，MUST NOT 采信 grep 结果；test/allowed-tools.test.ts 会拦截「Skill(X) 对应未注册技能」的错误条目 |
| 模板正文内 197 处交叉引用漏改或误改（重灾区 tr-impl-genfull 38 处、tr-impl-auto-workflow 25 处、tr-impl-workflow 24 处、tr-impl-debug 21 处） | 以映射表为唯一依据做替换，完成后执行旧 token 零残留验证（全仓检索 venus_ / .venus / tr_ / tr- 应仅命中映射表与迁移代码），并跑通全量测试 |
| skills/ 静态快照与模板不一致：test/skills-parity.test.ts 做字节级比较，漏跑快照生成即失败 | 严格执行 AGENTS.md 第 1 条顺序：改模板后依次 pnpm build && pnpm generate:skills |
| 破坏性升级使既有用户的装机中断：旧技能孤儿化且 .venus/ 用户规则静默失效 | 由伴生变更 iagent-legacy-migration 在 init/update 入口提供一次性自动迁移；本变更的发布说明必须显式指向该迁移 |
| 短名引发歧义：iagent_test / iagent_skills / iagent_pwd / iagent_version 等极短名在列表中出现时可能被误读 | 27 个新名已逐个对照职能复核唯一性（映射表见 design.context）；指令展示名保留完整中文说明，用户在 /iagent: 补全列表中同时看到名称与描述 |
| spec 领域段与类型段同名造成理解混淆 | 在 agent-tool-identity 能力的需求正文中显式记录「spec 兼具类型 id 与名字段两重身份且取值一致」 |
| 产品领域名被误改（不可逆）：全仓 2221 处 venus 命中里混有 Venus4A 产品名、Venustech 公司名、SVN 仓库路径 /svn/venus/ 与本地项目路径，一旦被替换会破坏 vendor/auto-package-svn/ 下打包脚本的运行时依赖与技能正文的产品语境 | 作用域界定写入需求（D10）并以标识符边界精确匹配约束替换模式，MUST NOT 使用不分大小写的裸 venus；验证任务显式检查 vendor/ 与产品域名零改动 |
| 空 commandsDir 拼接导致越界操作：codex 的 commandsDir 为空字符串，path.join 后得到项目根下的 venus/ 路径，指令侧遍历会指向项目根的无关目录 | 本变更内为 uninstall 与 reconcile 补跳过守卫（D11），并在规格中以「空指令目录工具的安全遍历」需求固化；伴生变更的迁移遍历沿用同一约束 |
