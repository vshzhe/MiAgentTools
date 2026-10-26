# Changelog

本项目的全部显著变更记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [2.0.0] - 2026-10-26

### BREAKING

- 移除 `iagent spec reindex` 子命令与跨变更 SQLite 索引能力（`sqlite-cross-change-index` 整体退役）：
  索引模块 / 命令与全部索引辅助 / `init` 建库段 / 归档索引重建步骤 / shell 补全候选一并删除，
  `sql.js` 依赖移除；历史 `index.db` 不由本工具删除（清理指引见 `docs/upgrade-guide.md`）
- 扫描基线产物升级为 v2（`limits` 改为 `hit` / `detail` / `reasons` / `softTimeout` / `skipped`）：
  删除目录深度与文件数上限，有界性改由「固定忽略清单 + `.gitignore`/自定义 ignore + 30s 软超时」承担；
  v1 基线仍可只读解析（读取侧按 `version` 分支），`iagent init` 写入恒为 v2
- `openspec/changes/**` 提案制品纳入版本控制（`.gitignore` 规则链 `openspec/*` → `!openspec/changes/`
  → 逐个排除缓存目录）；`openspec/specs/**` / `explorations/**` / `config.yaml` 等仓库级产物仍保持忽略
- CodeGraph 探测不再绑定单一工具名（MCP 具名工具 → 时效横幅 → CLI `status --json` 三通道），
  锁阶梯读 `.codegraph/writer.pid`；daemon 存活时不再显式 `sync` / `unlock`

### Added

- 扫描跳过分类统计（`limits.skipped` 的 `ignored` / `timeout` / `unreadable`）与终端报告「跳过」段；
  新增 `IAGENT_SCAN_SOFT_TIMEOUT_MS` 与 `iagent init --no-scan-ignore` 注入 / 逃生路径
- 新模块 `src/core/scan-ignore.ts`（忽略规则解析，fail-open）与
  `src/core/templates/codegraph-protocol.ts`（探测顺序 + 锁阶梯单一源）
- `CODEGRAPH_CLI` 白名单常量；`spec-archive` / `spec-bulk-archive` / `spec-explore` / `debug` /
  `project-init` 引用 CLI 条目（`migration` 仅两通道、不持 CLI 权限）
- 确认门白名单 `GATE_WHITELIST`（5 类 + `anchors` + `conditional`）与「MUST NOT 请求确认」负向清单；
  `workflow` 四处阶段委派点补直通句
- Git 侧提案制品纳管：`commit` 按固定清单精确暂存并加尾行 `提案: <change-name>`；
  `spec-apply` 收尾提示暂存（不自动提交）
- debug 修复循环按 bug 派发子代理（四列回执 + EXIT GUARD）；变更级 handoff 包
  `.openspec-tmp/pipeline-<change-name>/handoff-pack.md`（propose 产出，verify/apply/archive 只读并追加阶段结论）

### Changed

- 调用类白名单条目统一经 `tool-whitelist.ts` 共享常量构造（MCP / CLI / 技能委派 / 子代理派发）
- `spec-apply` 的 `[测试]` 任务改为委派 `iagent_test`（不再在 apply 内另立测试规则）
- `iagent init` 提示提案制品纳管策略（只提示，不改写业务 `.gitignore`）

### Fixed

- 归档链路删除与 daemon 争锁的无条件 `codegraph sync`；锁冲突按阶梯处置，失败降级 Grep + WARN
- `sqlite3` / `reindex` / `index.db` 残留字样清理（`src/**` 与生成快照零引用，白名单限迁移说明）

## [1.0.2] - 2026-10-26

### Fixed

- 修复 Windows 下执行外部命令时出现 Node DEP0190 弃用告警（`Passing args to a child process with
  shell option true ...`）：`init` 的依赖自检与 Pi 运行时安装原先以 `spawnSync(cmd, args, { shell: true })`
  调用 npm / claude / pi 等 `.cmd` shim，现统一走 `src/core/child-process.ts` 的 `spawnCommand`
  ——Windows 上自行拼装并按 cmd.exe 规则转义命令行，其它平台不启用 shell，语义不变且不再触发告警

## [1.0.1] - 2026-10-25

### Changed

- 包元信息：`package.json` 补 `repository` / `homepage` / `bugs` 指向 GitHub 仓库，
  npm 包页面显示源码仓库与 issue 入口
- 文档：README 安装章节以 npm 全局安装（`npm install -g mi-agent-tools`）为首选方式，新增 `npx` 免安装
  试用与"从 npm 安装固定版本"的项目内依赖用法；原源码 `pnpm link --global` 顺延为方式二

## [1.0.0] - 2026-10-25

npm 公开首发版本。版本号自此重新起算为 1.0.0（此前 8.x 为内部开发期版本号，
历史记录见下方小节，不随后续发布递增）。

### Added

- 全部 20 个内置技能：`iagent_workflow` / `iagent_auto_workflow` / `iagent_debug` /
  `iagent_project_init` / `iagent_test` / `iagent_commit` / `iagent_svn_commit` / `iagent_review` /
  `iagent_feature_doc` / `iagent_requirement_doc` / `iagent_migration` / `iagent_migration_check` /
  `iagent_proposal_review` 与 7 个 `iagent_spec_*` 规格驱动技能，每条技能同时生成配套斜杠指令
- 多宿主产物生成：Claude Code（`.claude/`）、Pi（`.pi/`，含原生 agent 定义与 strict/degraded 编排）、
  Codex（`.codex/`，skills-only）、OpenCode V2（`.opencode/`，opt-in）
- CLI 11 个命令：`init` / `list` / `show` / `validate` / `update` / `generate` / `uninstall` /
  `completion` / `spec` / `config` / `--version`，含 shell 补全与 `.iagent/` 项目级配置（`config.yaml` + `rules/`）
- 宿主原生编排协议：共享阶段/回执/门/能力模型 + 宿主适配器，能力缺失时按 strict 阻断、degraded 显式降级
- Markdown-first 规格工作流：`proposal.md` / `design.md` / `specs/<capability>/spec.md` / `tasks.md`
  为唯一可编辑真源，SQLite 索引与渲染为派生能力

## [8.1.1] - 2026-10-25

### Changed

- 仓库卫生：`.github/workflows/` 解除 Git 跟踪并加入 `.gitignore` —— 工作流仅保留在本机，
  不随仓库分发或推送（`git rm -r --cached .github/workflows`）
- 文档：README 移除旧 `.venus` 品牌升级章节及其全部指引链接，按新项目使用说明改写；
  "工程保障"段由 GitHub Actions CI 描述改为本地校验链（`build` → `lint` → `test`）

## [8.1.0] - 2026-10-25

### Added

- 需求文档业务桥：`iagent_workflow`（Phase 3.5）、`iagent_auto_workflow`（Phase 3）与
  `iagent_debug`（Phase 7.3 verify-close）在提案验证 PASS **且**深度复查收束后，各展示**一次**
  "生成 / 跳过"桥；确认生成后直接非交互委派 `iagent_requirement_doc`（不再追问是否调用该技能），
  跳过后继续原流程。独立 `iagent_spec_verify_proposal` 仍只做只读验证
- 需求文档四值状态模型 `absent` / `skipped-by-user` / `generation-failed` / `generated`：
  持久写入变更 `exploration.md` 的 `## 需求文档状态` 段（字段 `requirementDocStatus`），
  经 verify → apply → archive 的 handoff 传递；`VERIFY_PHASE` / `APPLY_PHASE` / `ARCHIVE_PHASE` 与
  debug `verify-close` 回执携带同一状态。`protocol.ts` 新增
  `RequirementDocStatus` / `normalizeRequirementDocStatus` / `PERSISTED_REQUIREMENT_DOC_STATUSES` /
  `REQUIREMENT_DOC_STATUS_IO_ATTEMPTS`（语义为"失败 → 重试同一操作一次 → 停止"）
- 条件确认门：`GateSpec.condition`（首个取值 `multiple-fix-options`）与
  `PhaseTransitionInput.gateConditions`；`evaluatePhaseTransition` 在 `condition` 未声明时保持既有静态门行为，
  `gateConditions[condition] === false` 视为门不适用（跳过门确认要求），`true`/缺失视为适用（fail-safe）
- debug 宿主协议拆为 `investigate` → `fix` → `verify-close` 三阶段（仍为单一 `iagent_debug` 技能）；
  `investigate` handoff 增补 `defectChain` / `changeName`，`fix` 门绑定条件 `multiple-fix-options`
- Pi 编排阶段 agent 生成 `allowed_subagents`（= 该 workflow 的委派清单 ∩ 已安装阶段），
  声明但未安装的目标记入 `nestingGaps` 并 WARN；`CONDITIONAL_DELEGATIONS` 单点声明"正文已声明
  fallback / degraded 路径"的条件委派，无条件必需委派缺口按能力阻断

### Changed

- debug 流程：高置信根因与缺陷链路**合并为一次诊断确认包**（多候选仍先选根因再确认链路，
  拒绝 = 终止修复并输出诊断报告）；变更归属收束明确 `changeName`；新增可行修复方案数量判定 ——
  多方案必须等待确认、唯一且证据充分时说明依据后直通（数据库/schema 独立确认保留）
- debug 回归测试编写统一**委派 `iagent_test`**（测试规则唯一来源），debug 只提供缺陷链路/复现上下文并
  验收"修复前 FAIL、修复后 PASS + 异常/根因节点覆盖"；Phase 1 内联临时测试不构成回归测试；
  strict 缺委派能力阻断，仅显式 degraded 允许本地编写
- debug 白名单补 `Skill(requirement_doc)` 与 `Skill(test)` 精确条目（共享 `skillDelegation`）；
  `DEPS.debug` 补 `requirement-doc`（无条件委派随装，消除死引用）；
  `ORCHESTRATION_DELEGATIONS.debug` 补齐 `proposal-review` / `requirement-doc` / `test`
- `iagent_spec_archive` 4.8 与 `iagent_spec_bulk_archive` a.6 改为**文件存在优先 + 状态裁决缺失分支**：
  已存在（任何状态）就地增量对齐并保护人工域；缺失时 `skipped-by-user` 不生成、
  `generation-failed` 与 `generated` 仅 WARN 不重试/不重建、仅 `absent` 走历史兼容生成；
  状态或文件存在性读取失败重试一次仍失败时不视为 `absent`、不生成、不阻断归档
- `iagent_spec_propose` 独立调用在验证 PASS 后**停止**：不再自动生成需求文档、不提供文档桥，
  白名单移除 `Skill(requirement_doc)`；`iagent_requirement_doc` 的 Caller note 改为
  "三父流程文档桥生成分支 + 归档 `absent` 兼容分支"
- `iagent_auto_workflow` 的 description 与 Phase 3 / Phase 4 说明披露唯一的需求文档桥，
  不再声称该阶段"无需任何用户确认"


## [8.0.0] - 2026-10-25

### BREAKING

- `.iagent/rules/` 规则文件名改为**类型→语义名映射**：`impl` → `coding-rules.md`、
  `test` → `testing-rules.md`、`spec` → `spec.md`（映射外类型仍回退 `<type>.md`，如
  `commit.md`）。读取链、列表函数、旧装机迁移落点与重建/修复路径统一经同一派生函数取名，
  MUST NOT 再直拼文件名
- 旧名规则文件 `.iagent/rules/impl.md` / `test.md` 由 `iagent init` / `iagent update`
  **整体删除**（不做兼容读取、不合并内容），删除时逐文件输出丢失风险 WARN。升级前请把旧名
  文件里的手写规则迁入新名文件的人工域标记区间
- `iagent init` 不再对已存在的规则文件「一律跳过」：`config.yaml` 已存在时规则文件转入
  **重建/修复**语义（缺失重建、旧版常量对齐、旧名清理）；created 分支也不进入常量对齐，
  既有语义名文件字节不变但记 WARN 提示改用 `iagent update` 修复

### Added

- `src/core/project-config.ts` 新增规则文件契约层：`RULE_FILE_NAMES` / `ruleFileNameFor` /
  `ruleFileTypeFor` / `LEGACY_RULE_FILE_NAMES` / `MANUAL_DOMAIN_MARKS` 单一源常量，
  `removeLegacyRuleFiles` 旧名删除单步，以及幂等的
  `repairRuleFiles(projectRoot, { preservePaths })`（`RuleRepairReport`：
  removedOldName / created / aligned / preserved / warnings）
- 规则文件**人工域**：`<!-- 人工域:开始 -->` / `<!-- 人工域:结束 -->` 区间内容由自动更新
  逐字保留；常量域（头注释 + 蒸馏规则行）由 init/update 确定性维护；读取链过滤标记行本身，
  区间内规则行照常注入
- `defaultRuleFileContent` 重写为蒸馏基线：`coding-rules.md` 蒸馏零猜测 / 设计先行 + 确认门 /
  数据与分层 / UI 四状态 / 生成交付要点；`spec.md` 蒸馏 Markdown-first 制品协议要点
  （真源 / 依赖序 / 写后校验循环 / JSON 弃用 / 评分门）；`testing-rules.md` 为占位兜底并保留
  人工域骨架
- `iagent update` 新增 0.3 规则重建/修复步骤（legacy 迁移之后、读 config 之前）；`InitResult`
  与 `UpdateResult` 新增 `ruleRepair`，CLI 按「新建 / 对齐 / 保留迁移内容 / 删除旧名」渲染
  明细（四类全零时输出「规则文件已是最新」）
- 旧装机迁移报告新增机读字段 `movedRules`：搬运落点直达语义名（`tr_impl.md` →
  `coding-rules.md`、`tr_test.md` → `testing-rules.md`），内容逐字保留；本轮迁移产物按
  `preservePaths` 跳过常量对齐、只登记 `preserved`，并提示移入人工域
- 项目预扫描新增第六维信号 `signals.tests`：测试目录探针（`test/` / `tests/` /
  `__tests__/` / `e2e/` / `spec/`）与测试文件名模式计数（`*.test.*` / `*.spec.*` /
  `*Test.java` / `*Tests.java` / `*_test.go`），只记事实、不读内容、不推断框架
- `iagent_project_init` 技能新增第 10 步「实现与测试规则蒸馏」：以基线 signals / candidates、
  五类文档、`AGENTS.md` 与 `config.yaml` 为输入，把项目特异性约定写入两个语义名规则文件的
  人工域区间（目标文件缺失则补建、无人工域区间则追加骨架，失败 WARN 非阻断）

### Changed

- 15 个技能模板共 25 处 `openspec/rules/ai-coding.md` / `openspec/rules/artifact-generation.md`
  引用改为项目侧 `.iagent/rules/coding-rules.md` / `.iagent/rules/spec.md`：目标项目无需
  `openspec/` 目录即得护栏基线，文件缺失时沿用内联要点降级 + WARN
- `listRuleFiles` 改为双形态识别（语义名 + 映射外类型回退名）；`readProjectConfig` 与写入
  路径统一走映射，`missingRuleFiles` 不因语义名生效而误报
- `ensureProjectConfig(projectRoot, { preservePaths })` 返回体扩展 `ruleRepair`，两分支均
  透传本轮迁移产物的跳过集合

## [7.1.0] - 2026-10-18

### Added

- Pi 原生编排产物 `src/core/pi-native.ts`：`init` / `update` 生成
  `.pi/agents/iagent-orchestrator.md` 与 `.pi/agents/iagent-<workflowId>.md`，使
  `@tintinweb/pi-subagents` 的 `Agent` 能按 `subagent_type` 解析阶段委派；`tools` 只写
  上游内置名，嵌套派发由 `allowed_subagents` 授予，`prompt_mode: append`。
- Pi strict 判定收紧为「版本兼容 + 运行时已安装 + 所需 agent 定义可解析」；
  `.iagent/pi-runtime.json` 新增 `nativeEntries`（`required` / `resolvable` / `missing` /
  `invalid` / `issues`），诊断码区分 `runtime-missing` / `runtime-incompatible` /
  `entry-missing` / `entry-invalid`。
- `.pi/agents/` 纳入 uninstall 与 reconcile：只处理 `iagent-` 前缀，清理生效集缩小后的
  orphan，用户自建 agent 不受影响。

### Changed

- Pi 的 `sessionPermissions` 设为 `false`，不再向 `.pi/settings.json` 写入 Claude 风格的
  `permissions.allow`（Pi 不读取该段）。
- Pi strict 的阶段委派改为可执行形态 `Agent({ subagent_type, prompt })`，类型名与生成的
  agent 定义一致。
- `init` 跳过既有产物时输出刷新提示（指向 `iagent update`）；README / AGENTS 补充升级刷新
  语义与 `.pi/agents/` 说明。

### Fixed

- 修正 `iagent-workflow` 指令 description 中“提案内联生成”的过期表述。
- Pi degraded 诊断保留安装尝试的手动命令，修复 `init` 复检后丢失 `pi install` 提示的问题。

## [7.0.1] - 2026-10-18

### Changed

- 新增 `.npmignore` 并收紧 `package.json` 的 `files` 负向清单：发布包剔除 `dist/**/*.js.map` 与
  `*.d.ts.map`（source map 指向未随包发布的 `src/*.ts`），包体由 283 个文件 / 441 kB 降至
  190 个文件 / 377 kB；`.npmignore` 同时排除源码、测试、CI、文档与本机产物目录
  （`.iagent/`、`.claude/`、`.pi/`、`.opencode/`、`.codegraph/`、`openspec/` 等）。
  注：npm 的 `files` 白名单优先级高于根 `.npmignore`，故产物侧剔除必须写在 `files` 的 `!` 条目中。
- 整理 `.gitignore`：按「依赖/构建产物、iagent 本机产物、运行与发布临时产物、日志、环境变量、编辑器与系统文件」
  分区分组，新增 `*.tgz`（npm pack 产物）、`coverage/` 与 `.nyc_output/`、`*.orig` / `*.rej`（补丁与合并残留）、
  `.env` / `.env.*`（保留 `!.env.example`）、`.idea/` / `*.iml` / `._*` / `.Spotlight-V100/` / `.Trashes/` /
  `ehthumbs.db` / `desktop.ini` 等预防性条目；已跟踪文件无一被新规则误伤（`git ls-files -i -c` 为空）。

## [7.0.0] - 2026-10-18

### BREAKING

- 宿主技能 ID 由下划线形态 `iagent_<name>` 改为 canonical kebab-case `iagent-<workflowId>`
  （目录名与 frontmatter `name`，如 `iagent-spec-explore`）。canonical `workflowId` 沿用既有指令 id
  （`spec-explore`）。旧下划线形态仅作兼容解析，`iagent init` / `update` 在生成前自动迁移既有产物
  （冲突保留不覆盖），旧名查询经 `list` / `show` / `validate` 仍可解析。
- 共享工作流模板正文不再硬编码 Claude 专属委派机制词（`经 Skill 工具` / `Agent 工具` 等）；
  委派机制由生成期按目标宿主原生渲染。

### Added

- 新增宿主无关工作流协议 `src/core/host-orchestration/`：阶段/能力/回执/门契约（`protocol.ts`，
  `validateReceipt`）、宿主能力协商与 strict/degraded（`hosts.ts`，`negotiateCapabilities` /
  `negotiationForHost`）、阶段推进判定（`transition.ts`，`evaluatePhaseTransition`）、
  协议动作宿主渲染与适配段注入（`render.ts` / `actions.ts`）。
- 新增技能 ID 单一源 `src/core/skill-id.ts`（`deriveSkillId` / `isManagedSkillDirName` /
  `toCanonicalSkillId` / `skillIdToWorkflowId`）与迁移模块 `src/core/skill-id-migration.ts`。
- 新增 OpenCode V2 项目级编排产物 `src/core/opencode-v2.ts`：生成 `.opencode/agents/`
  （primary orchestrator + 阶段 subagent）与项目级 `.opencode/opencode.jsonc` 的 V2 `permissions`
  （动作 `skill` / `subagent`）；指令 frontmatter 含 `agent` / `subagent` 元数据。
- 新增 Pi 编排运行时 provider `src/core/pi-runtime.ts`：默认 npm 包 `@tintinweb/pi-subagents`（latest），
  版本兼容检测、项目级安装、失败降级与 `.iagent/pi-runtime.json` 诊断；provider 可替换为未来 iagent 自有包。
- Pi 指令适配器新增 `$ARGUMENTS` 参数注入（修复 `/iagent-xxx <参数>` 主题参数丢失）。
- 新增回归测试：`test/skill-id-migration.test.ts`、`test/host-orchestration.test.ts`、
  `test/opencode-v2.test.ts`、`test/pi-runtime.test.ts`、`test/claude-host-adapter.test.ts`、
  `test/host-smoke.test.ts`（跨宿主冒烟）。

## [6.4.0] - 2026-10-17

### Added

- 新增语言回归锁 `test/template-language.test.ts`：扫描全部技能正文、references 与 Claude/Pi/OpenCode 三类适配器产物的指令正文，扣除白名单（围栏/行内代码、标识符、路径、协议词、固定标记、英文触发词）后，同一行出现 ≥3 个连续英文单词即判违规；并附「已定中文译法术语禁止残留英文形」的禁用短语表。
- `test/template-derivation.test.ts` 的派生一致性覆盖由 7 个 spec 模板扩展至**全部 20 个**配对；`test/template-consistency.test.ts` 的派生调用计数断言提升为 `= 20`。
- `test/generation.test.ts` 新增用户自定义 `--desc` 原文保持测试（中英混排逐字写入 frontmatter，生成器不翻译用户输入）。

### Changed

- 全部 20 个内置技能模板的生成产物改为**中文自然语言**：普通解释性英文（流程说明、阶段与错误处理描述、解释性术语）翻译为中文，仅保留承载契约与机器语义的「特定描述」—— 命令、路径、文件名、标识符、`/iagent:<id>`、`$ARGUMENTS`、工具/协议名（`OpenSpec`/`CodeGraph`/`MCP`/`Skill`）、规范词（`MUST`/`MUST NOT`/`SHALL`）、制品标记（`ADDED`/`MODIFIED`/`REMOVED`/`RENAMED`）、协议标题（`Input`/`Output`/`Phase`/`Step`/`Guardrails`）、英文触发词与 `NOT for`、代码块/正则/JSON-YAML 示例。
- 统一并固化重复术语译法：`Prompt Validation Gate` → 提示词校验门、`Functional Flowchart` → 功能流程图、`Checkpoint Enforcement` / `MANDATORY CHECKPOINT` → 强制检查点、`hard conflict` → 硬冲突、`Standalone mode` → 独立模式、`Non-interactive mode` → 非交互模式、`output ledger` → 产出登记表、`minimal receipt` → 最小回执、`Pre-Archive ... Checkpoint` → 归档前...检查点 等。
- 其余 12 个手工双写模板（`auto-workflow`、`workflow`、`debug`、`migration`、`migration-check`、`proposal-review`、`test`、`commit`、`svn-commit`、`review`、`feature-doc`、`requirement-doc`）的指令正文改为经 `deriveCommandContent()` 从技能正文派生，command 不再维护独立完整正文，只保留 `name`/`description`/`category`/`tags` 元数据 —— 至此全部 20 个内置配对均为 **skill 单一源**；仅技能版内容以成对 `CMD:SKIP` 标记安全裁剪（未标记段落默认进入指令版）。
- 技能 `description`（`iagent_auto_workflow`、`iagent_workflow`、`iagent_debug`）改为中文用途表述，保留英文触发关键词与 `NOT for` 排歧结构。

## [6.3.0] - 2026-10-17

### Added

- 新增 **OpenCode** 目标工具适配（`opencode`）：技能生成到 `.opencode/skills/<name>/SKILL.md`，斜杠指令生成到 `.opencode/commands/iagent-<id>.md`（扁平前缀，调用形式 `/iagent-<id>`）。
- 新增 `opencodeAdapter`（`src/core/command-generation/adapters/opencode.ts`）：frontmatter 仅 OpenCode 官方契约的 `description` + 记账 `metadata`；正文在无参数占位符且 `**Input**:` 非 `None required` 时注入 `**Provided arguments**: $ARGUMENTS`（移植自 OpenSpec 的 OpenCode 适配器）。
- 新增 `AIToolOption.optIn` 与 `AIToolOption.sessionPermissions` 两个能力开关；OpenCode 标记为可选（opt-in）且不写会话级权限载体。
- 新增回归测试：OpenCode 适配器路径/frontmatter/参数注入/指纹、opt-in 默认回退与显式启用、指令产物归属与删除边界。

### Changed

- `resolveActiveTools` 的未配置回退改为**默认工具集**（排除 opt-in 工具）；`iagent generate` 的安装目标改用 `resolveActiveTools`，使 opt-in 语义对生成骨架同样生效。
- `iagent init` / `iagent update` 的会话级权限合并按 `sessionPermissions` 跳过 OpenCode（其权限走 `opencode.json` 的 `permission` 段且默认宽松，`.opencode/settings.json` 为不被读取的惰性文件）。
- `project-scan` 排除清单增 `.opencode`；`LEGACY_COMMAND_DIRS` 增 `opencode: ''`；`.gitignore` 增 `.opencode/`；CLI `--tools` 帮助文案与 `config.yaml` 注释区分默认工具集与可选工具。
- 文档（README / AGENTS.md）同步 OpenCode 布局、opt-in 语义与适配器清单。

## [6.2.0] - 2026-10-16

### Added

- `iagent_spec_explore` 新增 `references/exploration-guidance.md`（上游衍生的探索指南）与三个协议子 references（`multi-project-scan.md` / `grill-playbook.md` / `deep-analysis.md`）；主协议按需 `Read` 加载。
- 新增回归锁定：探索主文件 ≤ 250 行、分层 references 齐备且被引用、门预算与门合并、专有断言不因下沉丢失、探索指南标注上游来源。

### Changed

- `iagent_spec_explore` 主 SKILL.md 渐进披露：上游衍生探索散文下沉 `references/exploration-guidance.md`，主文件从 409 行缩减至 ≤ 250 行（实际 125 行）。
- `exploration-protocol.md` 按关注点分层：多项目 CodeGraph 扫描 / grill 问题库 / 深度分析 拆为独立子 references。
- grill L1-L5 由逐决策增量门合并为 **≤ 2 批量确认轮次**（L1-L3、L4-L5），保留最低确认深度 L3；L4 无矛盾时自动直通。
- 定义门预算：每阶段至多 1 个流程级阻塞确认门；探索阶段以功能流程图门为唯一流程级阻塞门。
- `iagent_workflow` 实现确认桥与测试计划确认门合并为单一「实现 + 测试桥」（含 `Implementation + Test Bridge` 标题）；实现阶段仅一个阻塞门。
- 聚合一致性门（1.6.6）显式声明默认直通（non-blocking）：无硬冲突自动通过并继续，仅硬冲突暂停；门保留作为 L4 增量检查的兜底。

### Fixed

- 消除探索协议单文件巨石（874 行）与主 SKILL.md 上游散文复制面带来的上下文膨胀与静默漂移风险。

## [6.1.0] - 2026-10-16

### Added

- 新增跨切面一致性回归锁 `test/template-consistency.test.ts`：锁定「调用类白名单与正文委派双向一致」「门控导言单一源」「references 无孤儿」「提案验证维度契约唯一」。
- 加宽 `test/markdown-first-regression.test.ts`：扫描全部技能模板、指令模板与 references 正文中 `tasks.json` / `change.json` 的写动词（legacy 只读句式白名单豁免）。

### Changed

- `iagent_auto_workflow` Phase 4/5 由内联执行改为经 Skill 工具委派 `iagent_spec_apply`（`auto-mode=true`）/ `iagent_spec_archive`（`change-name`），条件委派 `iagent_test`；白名单补齐 `Skill(spec_apply/spec_archive/spec_verify/test)`。
- `DEPS['auto-workflow']` 移除冗余 `workflow` 依赖，改为直接列出其阶段技能；`auto-workflow` 不再连带安装 `workflow`。
- 提案验证维度契约统一为 `iagent_spec_verify_proposal` 唯一源（D1-D5 核心 + D6-D10 条件，统一 90% 阈值）；删除 `workflow` / `debug` 等技能中的 `D1-D6` / `D1-D9` 子集表述。
- `iagent_proposal_review` 定位为评分门 PASS 后的非重叠深度层；Phase 5-8 下沉 references 的指针明确化。
- `iagent_workflow` / `iagent_auto_workflow` / `iagent_debug` 的门控导言改用共享 `GATE_PROTOCOL_PREAMBLE` 常量。
- `iagent_workflow` / `iagent_auto_workflow` 增加实现验证桥接：apply→archive 之间委派 `iagent_spec_verify`，不可用时显式声明省略理由。
- 全部技能 description 统一为「中文用途 + 触发词（中英）+ `NOT for` 排歧」结构。
- `docs/skills-manual.md` 版本号（4.0.0 → 6.1.0）、类型表（impl 4 / review 3 / docs 2 / spec 7）与 workflow 描述同步。

### Fixed

- 修复 `iagent_migration` Phase 4 修复循环把 `tasks.json` 当任务真源并重渲染的反 Markdown-first 残留：改为直接编辑 `tasks.md`。
- 修复 `iagent_spec_explore` 残留的 JSON 捕获指引：制品捕获目标由 `change.json 的 design/proposal 段` 改为 `design.md` / `proposal.md`。
- 修复 `iagent_workflow` 与 Phase 2.3 委派相矛盾的 stale Examples 与 Guardrail（`MUST use inline generation for artifacts` / `Executing inline artifact generation`）。
- 修复 `prompt-gate.ts` / `flowchart-gate.ts` 文档注释把 `iagent_workflow` 重复计两次的 typo。
- 修复 `iagent spec` shell 补全缺 `migrate` / `validate` 子命令。

### Removed

- 删除 `iagent_workflow` / `iagent_auto_workflow` 携带但从未被正文引用的孤儿 `references/prompt-gate.md` / `references/flowchart-gate.md`。

## [6.0.0] - 2026-10-16

### BREAKING

- 移除产物 frontmatter 的遗留字段 `metadata.version`（只写不读）：产物版本统一由 `metadata.generatedBy`
  承担；`iagent update` 的手改保护基于内容指纹，存量产物升级无需 `--force`。
- 检查类技能的 `metadata.type` 由 `impl` 归位为 `review`（`iagent_proposal_review` / `iagent_migration_check`）；
  `review` 类型语义扩展为「审查 / 检查」。

### Added

- 新增模板正文指令引用单一源 `src/core/templates/command-references.ts`（`commandRef` / `KNOWN_COMMAND_IDS` /
  `rewriteCommandRefs`）：引用以规范形 `/iagent:<id>` 书写，生成期按工具布局改写（Claude 保持不变、Pi 改写为
  `/iagent-<id>`），仅改写已知 id，未知名原样保留。
- 新增死引用回归锁 `test/command-reference-refs.test.ts`：未注册指令 id、未注册委派技能、无条件委派未经 `DEPS`
  覆盖均失败。
- 新增 `test/tool-whitelist-constants.test.ts`（调用类白名单条目必须经共享常量构造）、
  `test/description-format.test.ts`（description 结构与长度约束）、`test/skill-type-taxonomy.test.ts`。
- 新增 `test/skill-size-budget.test.ts`（主 SKILL.md ≤ 500 行 + references 引用存在性）。
- `SkillTypeMeta` 新增 `reserved` 标记，`release` / `tools` 标为预留类型。
- `iagent_spec_propose` 新增 `delegated` 执行模式：跳过 Step 0 用户提示（直接迁移 `exploration-file`）、
  抑制自身 Phase 3 验证（由编排器超集承担）、抑制结尾规划边界停点并输出结构化回执；`interactive` 默认行为不变。
- `DEPS` 注入 `workflow` / `auto-workflow` ⇒ `spec-propose` 与 `spec-explore`；两编排器白名单补 `Skill(spec_propose)`。
- `iagent_spec_explore` 新增 `delegated` 执行模式，承接 Phase 1 强制 checkpoint 体系（强制建探索文件、提示词校验门、
  CONTEXT.md 检查、CodeGraph 基础扫描含多项目派发与深度分析、L1-L5 grill 追问、功能流程图与流程最终确认门、
  聚合一致性门、探索完成检测）与结构化 handoff；`interactive` 保持立场式。

### Changed

- 渐进披露：6 个技能主 `SKILL.md` 下沉细则至 `references/`（`spec_explore` 探索协议、`proposal_review` 细节检查与报告模板、
  `debug` 排查协议、`spec_verify_proposal` D6-D10 条件维度、`spec_apply` 批调度协议、`workflow` 验证协议），
  主文件均 ≤ 500 行；主文件保留触发/阶段骨架/确认门/委派清单/护栏，以 `Read references/<topic>.md` 引导按需加载。
- `iagent_workflow` / `iagent_auto_workflow` 的 Phase 2（提案生成）改为经 Skill 工具委派 `iagent_spec_propose`
  （`mode=delegated` + `exploration-file`），删除两份内联提案生成真源；编排器保留 Phase 2.0 预迁移验证与影响分析、
  Phase 3 验证超集（`spec_verify_proposal` + `proposal_review` + 非交互 `requirement_doc`）。
- `iagent_workflow` / `iagent_auto_workflow` 的 Phase 1（探索）改为经 Skill 工具委派 `iagent_spec_explore`
  （`mode=delegated`），删除两份内联探索真源；强制 checkpoint 体系（强制建探索文件 / 多项目 CodeGraph 扫描 /
  L1-L5 grill / 聚合一致性门 / 完成检测）统一由 `iagent_spec_explore` 的 delegated 模式承载。
- `workflow` / `auto-workflow` / `debug` 的调用类白名单条目改经 `tool-whitelist.ts` 共享常量构造（值等价，
  消除手写字面量漂移）。
- 4 个纯英文技能 description（feature-doc / migration / migration-check / requirement-doc）规范化为中文优先并
  保留英文触发关键词。
- `iagent validate` 非法类型文案区分在用 / 预留类型。

### Fixed

- 修复两处指令引用断链：`commit` 指令正文 `/iagent:commit-change` → `/iagent:commit`；`review` 指令正文
  `/iagent:review-code` → `/iagent:review`（旧品牌改名遗留）。

### Removed

- 移除 `metadata.version`（`SkillTemplate.metadata` 不再含该字段；生成器不再写入）。

## [5.0.0] - 2026-10-16

### BREAKING

- 变更制品由 JSON-first 切换为 **Markdown-first**：新变更以 `proposal.md` / `design.md` /
  `specs/<capability>/spec.md` / `tasks.md` 为唯一可编辑真源，不再创建 `change.json` / `tasks.json`。
- `iagent spec render` 不再生成或覆盖 `tasks.md`（仅保留兼容提示）；`iagent spec` 新增
  `validate` 与 `migrate` 子命令。
- `iagent spec status` 新增 `invalid` 状态与文件路径 / 行号诊断。

### Added

- `iagent spec validate --change <name>`：校验 Markdown 结构、任务依赖与 Scenario→Task 追溯。
- `iagent spec migrate --from-json --change <name>`：显式将历史 JSON 制品转换为 OpenSpec Markdown
  （默认保留 JSON，`--delete-legacy` 才删除）。
- Markdown 解析层（parser / model / validation）与 Markdown→SQLite 索引（含内容指纹缓存）。

### Changed

- 生成 / 实现 / 验证 / 复查 / 归档 / 需求文档技能与共享生成协议统一改为直接读写 OpenSpec Markdown。
- `iagent spec reindex` 以 Markdown 为主来源，历史 JSON 仅只读降级并 WARN。

### Removed

- 移除 `json-only-artifacts` 回归锁，新增 `markdown-first-regression.test.ts`。

## [1.17.0] - 2026-10-12

### Changed

- **Commands 指纹保护**：`venus update` 指令生成循环从 2 路判定（相同跳过/不同覆盖）
  扩展为完整 6 路指纹决策树（对齐 SKILL.md 保护），用户手动修改的 `.claude/commands/`
  文件不再被静默覆盖。存量无指纹指令文件首次升级时自动获得指纹。
- **writeJsonFile 原子写入**：`change.json` 写入从裸 `fs.writeFileSync` 改为原子五步法
  （序列化 try-catch → 写 .tmp → 验证 JSON.parse → 备份 .bak → rename 原子替换），
  写入失败不损坏原文件。`readChangeJson` 增加 .bak 自动回退恢复。

### Fixed

- **spec-propose 模板 render 指令矛盾**：Step 4.a 第 3 节 Bash 命令从 `venus spec render <type>`
  （枚举全部 4 种类型）修正为仅 `venus spec render tasks`，消除 AI agent 误调用
  产生多余 .md 副本，对齐正文"仅 tasks 渲染 MD"约束。
- **initChangeJson TOCTOU 竞态**：写入失败时重新读取已有文件，避免并发场景下丢失数据。
- **`venus spec render` 非 tasks 类型提示**：添加非阻断提示，告知 change.json 才是
  proposal/specs/design 的唯一结构化真源。

### Added

- **`UpdateResult.commandsSkippedModified`**：新增字段记录因用户手改而跳过的指令文件路径。
- **`.bak` 备份恢复**：writeJsonFile 原子写入前自动创建 .bak 备份，readChangeJson
  损坏时自动回退恢复。

## [1.16.0] - 2026-10-12

### Added

- **spec-propose 需求文档生成**：`venus_spec_propose` 提案校验通过（≥90%）后，深度复查收束后
  自动以非交互模式调用 `venus_tr_docs_requirement_doc` 生成需求文档到
  `openspec/changes/<change-name>/需求文档.md`。生成失败不阻塞（WARN + 继续）。

### Fixed

- **tr-impl-workflow / tr-impl-auto-workflow 探索→提案自动过渡修复**：Phase 1 完成检测段
  缺少显式"立即执行 Phase 2"指令，AI 在探索完成后宣布完成即停止而不自动进入提案生成。
  - auto-workflow：1.6 step 4 从 `ANNOUNCE` 改为 `AUTO-PROCEED (MUST NOT pause)`，
    Phase 2 头部增加 `AUTO-EXECUTE: MUST begin immediately...in the SAME response` 强约束；
    command 模板 completion check 同步强化。
  - workflow：移除 1.6 `Do not transition to Phase 2 on completion detection alone` 矛盾句，
    改为 `Run both checkpoints, then auto-transition...do NOT stop between phases`；
    Phase 2 进入指令从 `enter Phase 2 immediately` 强化为 `immediately execute all Phase 2 steps...in the SAME response`。
- **tr-impl-debug Phase 3 自动创建变更**：Phase 3.2 独立 bug 分支从 `Create a new change`
  改为 `AUTO-CREATE without asking the user`，防止 AI 在关联合适变更后暂停询问而非自动创建；
  command 模板同步强化。
- **tr-impl-workflow 需求文档生成矛盾修复**：Guardrails 与输出示例中的"需求文档延迟到归档阶段"
  表述与 Phase 3.5 Step 5 实际执行"验证通过后立即生成"矛盾，已统一改为验证阶段生成；
  输出示例同步修正。
- **tr-impl-genfull 需求文档生成矛盾修复**：command 模板 Stage 2.3 声明
  `MUST NOT 生成需求文档`，与 skill 模板 Stage 2.3 实际生成需求文档矛盾，且与同模板
  Bridge 2 的"需求文档已在 Stage 2.3 生成"自相矛盾，统一改为验证后生成、归档阶段对齐。
  同步修正 description 与 Guardrails 中的过时表述。

## [1.15.0] - 2026-07-16

### Changed

- **门控协议导言（Gate Protocol Preamble）**：在全部含确认门的技能模板正文开头引入
  `⛔ GATE PROTOCOL` 行为契约段，明确告知 AI Agent 门控标记 `⛔ GATE:` 为强制停止点，
  必须结束响应并等待用户输入。覆盖 7 个模板：`tr-impl-auto-workflow`、`tr-impl-workflow`、
  `tr-impl-genfull`、`tr-impl-debug`、`tr-impl-auto-migration`、`spec-explore`、`spec-propose`。
- **提示词校验门与流程图确认门标记强化**：`buildPromptGateBlock` / `buildPromptGateCompact` /
  `buildFlowchartBlock` / `buildFlowchartCompact` 中的确认门文本从"阻塞等待"改为
  `⛔ GATE:` 强制停止标记，增加 `THIS IS A CONFIRMATION GATE. Your response MUST END here.`
  块引用提示，消除 Agent 跨门控继续执行的"执行分离"问题。

## [1.14.0] - 2026-10-12

### Added

- **Pi/Codex 多工具适配**：`AI_TOOLS` 新增 `pi`（pi.dev）和 `codex`（OpenAI Codex CLI）工具条目，
  `venus init` / `venus update` 现在为三种工具统一生成技能文件（`.claude/skills/`、`.pi/skills/`、
  `.codex/skills/`），Pi 额外生成指令文件（`.pi/commands/venus/`），Codex 为 skills-invocable 模式
  不生成指令文件。
- **Pi 指令适配器**：新建 `piAdapter`（`src/core/command-generation/adapters/pi.ts`），
  格式与 `claudeAdapter` 同构，写入 `.pi/commands/venus/<id>.md`。

### Changed

- **技能-指令生成解耦**：`init.ts` 和 `update.ts` 将技能生成与指令生成分离为独立循环，
  技能遍历全部 `AI_TOOLS` 生成，指令仅遍历有适配器的工具生成。`list.ts`、`validate.ts`、
  `show.ts` 的扫描逻辑加入多工具间去重。

## [1.10.0] - 2026-10-10

### Changed

- **`venus_tr_commit_push` 放宽归档提案提交限制**：提案已在 `openspec/changes/archive/`
  （归档）时不再报错拒绝，改为同样读取归档提案内容并按分类提交流程推进；归档提案关联
  文件仍有未提交变更时可正常提交（溯源标注不变），无变更时提示无需提交并终止。
  消除「提案已归档但内容尚未提交」的阻断死锁。

## [1.12.0] - 2026-10-10

### Changed

- **需求文档生成时机前移**：需求文档生成从归档阶段（Phase 5 / Stage 4）提前到提案验证通过后
  （Phase 3 / Stage 2 收束阶段），使用户在实现开始前就能获得结构化需求文档便于对照排查。
  涉及 8 个模板文件。归档阶段改为"对齐为主"（已存在则增量对齐保留人工域，
  不存在则后向兼容生成）。同步更新 artifact-dataflow.test.ts 测试断言。

## [1.12.1] - 2026-10-10

### Added

- **SKILL 模板 references 机制启用**：5 个 Gate 注入模板（spec-explore / tr-impl-workflow /
  tr-impl-auto-workflow / tr-impl-genfull / tr-impl-debug）的提示词校验门和功能流程图从内联
  全文（~320 行/个）改为 compact 紧凑版（~20 行）+ references 引用文件（`references/prompt-gate.md`、
  `references/flowchart-gate.md`），AI 在 Gate 实际触发时按需读取全文细则。其余模板同步启用
  references 机制。`venus init` / `venus update` 自动管理 references 文件生命周期。
- **JSON Sidecar schema 类型定义**：`src/core/spec/sidecar-schema.ts`（新文件），定义
  manifest / tasks / decisions / capabilities 四类 JSON sidecar 的 TypeScript 接口，
  为后续 artifact 结构化加速奠定基础。

### Changed

- **Guardrails 护栏文本统一化**：全部 26 个模板的开头护栏从多行 "Before proceeding..." 改为
  单行 "适用 openspec/rules/ai-coding.md 全域护栏。未定义项标 [待确认]，禁止猜测。"
- **Compact Gate 语言一致性**：`buildPromptGateCompact` 与 `buildFlowchartCompact` 中的
  "出口四条" 统一为 "出口有四条"，与全文版表述对齐。

### Fixed

- 修复 Gate 紧凑版缺失"出口有四条"关键标识句导致 `templates.test.ts` 的
  "对话级确认门未被白名单改动侵蚀" 测试失败
- **JSON sidecar 数据流接通**：`improve-template-dual-layer-optimization` 提案的 Layer B
  （JSON Sidecar + SQLite 索引）代码基础设施已就位但从未实际生效——模板用散文指令驱动 AI 产出
  JSON，AI 从不执行。本次修复将 JSON sidecar 从"AI 散文指令驱动"改为"代码级主产物 + AI 内容填充"：
  - **NEW** `src/core/spec/sidecar-writer.ts`：代码级 JSON sidecar 写入/校验/渲染函数
  - **CHANGED** `spec-propose.ts`：JSON 侧车生成从 ~20 行散文改为显式 Write + Bash 步骤；
    tasks.json 成为主任务产物，tasks.md 由 `venus spec tasks render` 代码渲染
  - **CHANGED** `spec-apply.ts`：消费 tasks.json（结构化 status）替代解析 tasks.md checkbox
  - **CHANGED** `spec-archive.ts`：归档后 MUST 运行 `Bash(venus spec reindex --force)` 重建索引
  - **CHANGED** `tr-docs-requirement-doc.ts`：优先读取 decisions.json 渲染决策表
  - **NEW** `venus spec tasks render` / `venus spec sidecar init` / `venus spec sidecar manifest`
    三个 CLI 子命令，实现代码级 JSON 文件管理与 MD 确定性渲染
  - **NEW** `test/sidecar-writer.test.ts`：26 个测试用例覆盖写入/校验/渲染全路径

## [1.13.0] - 2026-10-12

### Added

- **合并 JSON 主产物 `.venus/change.json`**（schema `venus/change/v1`）：proposal / design / specs
  三段结构化数据合并存储（吸收旧 manifest / decisions / capabilities 侧车字段），
  `src/core/spec/sidecar-schema.ts` 新增 `ChangeSchema` / `ProposalSection` / `DesignSection` /
  `SpecsSection` 类型与 `createEmptyChange` 工厂；旧 3 类 schema 标 `@deprecated` 保留降级读取；
  tasks.json 保持独立（变更目录根）。
- **统一渲染命令 `venus spec render <type>`**（type = proposal / specs / design / tasks）：从 JSON
  真源确定性渲染对应 MD（`renderProposalMd` / `renderDesignMd` / `renderSpecsMd` 与 `renderTasksMd`
  并列，纯函数）；读取时校验，失败报字段路径且退出码非零；`venus spec sidecar init` 改为生成
  change.json 骨架（幂等），移除 `spec sidecar manifest`（信息吸收进 change.json 根字段）。
- **`venus spec instructions` 新增 `jsonTemplate` 字段**：按 artifact 返回 JSON 段 schema 示例
  （机器源），AI 写 JSON 不猜字段；MD `template` 保留供降级手写参照。

### Changed

- **JSON-first 生成协议单一源**：`openspec/rules/artifact-generation.md` G2 重写为 JSON-first 步骤
  （写 change.json 段 / tasks.json → `venus spec render` → 失败修正 / 降级手写 MD + WARN），
  由 spec-propose / tr-impl-workflow / tr-impl-auto-workflow 三条生成路径共享；spec-propose 与
  tr-impl-auto-workflow 的 JSON 生成段同步重写并显式引用协议。
- **下游消费全链路 JSON 优先**（均保留 change.json 缺失时 MD 降级 + WARN）：需求文档生成章节映射
  改 change.json 段 + tasks.json（决策表直接遍历 `design.decisions[]`）；归档主 spec 同步按结构化
  operations 应用（spec-archive / spec-bulk-archive，含 REMOVED 的 reason/migration 与 RENAMED 的
  from/to）；验证与复查结构化对比（spec-verify / spec-verify-proposal / tr-impl-review-proposal）；
  调试同步改 JSON 真源 + 重渲染（tr-impl-debug）。
- **`reindex` 读取链更新**：优先 change.json（changes / capabilities / requirements_fts /
  decisions_fts / exploration_memory 全表填充）→ 旧 3 文件 → MD 散文降级解析（新增 specs/*.md /
  design.md / exploration.md 降级解析，存量变更全量可检索）。

### Fixed

- 修复 `reindex` 归档目录扫描误把 `.venus/` 点目录当变更条目、导致命令恒 exit 1 的缺陷。
- 修复 `renderTasksMd` 对带方括号 label（存量 `"[代码]"` 写法）渲染出 `[[代码]]` 的问题：
  渲染前归一化剥离括号（新 jsonTemplate 约定 label 值不带方括号）。
- 修复 `test/sqlite-index.test.ts` 清理逻辑在临时路径含正斜杠时越界指向系统目录的缺陷。

## [Unreleased]

## [4.0.0] - 2026-10-13

### BREAKING

- **技能集精简：27 → 20 个技能**。移除 `iagent_feature`（直接实现，由 `iagent_workflow` /
  `iagent_spec_apply` 引导路径覆盖）、`iagent_pwd`（AI 直接执行 `pwd`）、`iagent_skills`（改用
  `iagent list`）、`iagent_version`（改用 `iagent --version`）与 `iagent_package`（Venus4A 专用打包）；
  同名斜杠指令与工作流条目一并移除。
- **`iagent_full_workflow` 并入 `iagent_workflow`**：保留单一引导式端到端技能
  （探索→提案→验证→实现→归档）。旧配置中的 `full-workflow` 与 `tr-impl-genfull` 经
  `LEGACY_WORKFLOW_ID_MAP` 迁移到 `workflow`。
- **移除 Venus4A 专用领域内容**：`iagent_frontend`（JSP 前端）、`iagent_package` 及其运行时
  `vendor/auto-package-svn/`、`.iagent/config.yaml` 的 `auto_package` 段全部删除。
- **框架专项检查去 Venus4A 硬编码**：`iagent_feature_doc` 移除内置框架档案预设（改为源项目结构
  自动探测 + 用户确认）；`iagent_proposal_review` / `iagent_spec_verify_proposal` 的语言/框架专项检查
  改为**运行时按项目实际信息**判定（读 `.iagent/config.yaml` 的 context/rules 与既有源码 / 构建文件，
  探测结论标 [待确认] 后写回 context），移除硬编码包名、JDK 7 / Log4j / Oracle 11g / IE / DataStore /
  DWR 等特定框架模板，**不内置任何框架预设**。

### Changed

- **`iagent_workflow` 扩展为端到端引导管线**：内联探索/提案/验证保持不变，验证收束后新增
  Phase 3.7 实现桥、Phase 4 委派 `iagent_spec_apply`（`[测试]` 任务存在时条件委派 `iagent_test`）、
  Phase 5 委派 `iagent_spec_archive` 与归档桥。依赖注入同步更新为
  `spec-verify-proposal + proposal-review + spec-apply + spec-archive`。
- `release` / `tools` 类型保留在类型体系中（供 `iagent generate --type` 扩展），当前无内置技能；
  `iagent list` 不再输出空类型分组。
- 文档与测试同步：README / AGENTS.md / 技能说明书 / 各测试断言对齐 20 个技能。

### Removed

- 技能模板文件：`workflows/feature.ts`、`workflows/tools.ts`、`workflows/version.ts`、
  `workflows/package.ts`、`workflows/frontend.ts`、`workflows/full-workflow.ts`，
  以及一次性拆分脚本 `scripts/split-frontend-skill.mjs`。

## [3.0.0] - 2026-10-13

### BREAKING

- **移除 `iagent spec render proposal|specs|design`**：`render` 仅支持 `tasks`（从 `tasks.json` 渲染
  `tasks.md`）。删除 `renderChangeSection` 与 `renderProposalMd` / `renderDesignMd` / `renderSpecsMd`；
  调用这三个类型的脚本/自动化将报错并退出码非零。

### Changed

- **自定义 iagent 流程 JSON-only**：新变更仅产出 `<changeRoot>/change.json`（proposal / specs / design
  三段）+ `tasks.json`；`tasks.md` 仍由 `iagent spec render tasks` 渲染，是唯一 MD 出口。
- **单一源协议重写** `openspec/rules/artifact-generation.md`：旧 CLI 名 `venus` → `iagent`（含 schema id
  `venus/change|tasks/v1` → `iagent/...`），并明示 proposal / design / specs 无 MD 产物、无 MD 降级。
- **读取侧 JSON-first**：实现（apply）/ 一致性校验（verify）/ 归档（archive）/ reindex / 需求文档统一读
  `change.json` + `tasks.json`；MD 降级**仅限存量 / 已归档变更**（只读 + WARN）。
- **状态判定**：`detectCompleted` 的 specs 以 `change.json` 段为主，`specs/**/*.md` 仅作**存量变更识别**
  （无 `change.json` 时）；`skip_specs` 冲突检测改用独立的 `hasDeltaSpecFiles` 信号，与完成判定**解耦**；
  `iagent spec instructions` / `instructions apply` 口径对齐 JSON（outputPath 指向
  `change.json`、contextFiles 指向 `change.json`/`tasks.json`、progress/taskList 来自 `tasks.json`）。
- **模板归零**：debug / proposal-review / spec-verify / spec-verify-proposal / workflow / auto-workflow /
  full-workflow / spec-archive / spec-bulk-archive / spec-apply / spec-explore / package / svn-commit /
  migration / requirement-doc 不再指示渲染或依赖 proposal / design / specs MD。

### Added

- **`test/json-only-artifacts.test.ts`**：模板回归锁（正文不得含 `iagent spec render proposal|specs|design`）、
  CLI render 类型收窄、`detectCompleted` / `instructions` / `apply` 的 JSON 口径。
- 同步主规格 `spec-workflow-cli`（render 仅 tasks；instructions / apply / reindex 以 JSON 为准）、
  `artifact-json-sidecar`（仅 tasks.md 渲染）、`artifact-generation-protocol`、`spec-workflow-skills`、
  `workflow-suite-skills`（编排技能 MD 禁令）。

## [2.1.0] - 2026-10-13

### Added

- **指令产物布局单一源**：新增 `src/core/command-artifacts.ts`，统一「落点解析 / 归属识别 / 删除」
  （`namespace-dir` 与 `prefixed-file` 两种布局），供适配器、reconcile、uninstall 与旧位置清理复用。
- **Pi prompt 布局适配**：Pi 指令产物从 `.pi/commands/iagent/<id>.md` 改为 Pi 实际加载的
  `.pi/prompts/iagent-<id>.md`（扁平、命名空间前缀，与同目录 OpenSpec 的 `opsx-*` 同构）；
  frontmatter 去除 Claude 专有字段（name/allowed-tools/category/tags），保留 `description` 与
  iagent 记账字段（`metadata.generatedBy`/`generatedFingerprint`，保证 update 手改保护）。
- **`ai-tool-selection` 能力规格**：工具选择解析与持久化语义（见 openspec 规格）。

### Changed

- **工具选择持久化**：`iagent init` 将本次生效工具集回写 `.iagent/config.yaml` 的 `tools` 字段；
  `iagent update` 仅在显式传入 `--tools` 时回写，避免常规刷新意外改动持久选择。
- **reconcile / uninstall 布局感知**：按工具布局只识别本工具命名产物；Pi 场景仅处理 `iagent-` 前缀
  文件，保留同目录 `opsx-*` 与用户自建 prompt，不删除承载目录。
- **旧装机迁移定位解耦**：`legacy-migration.ts` 用显式旧指令根常量（claude→`.claude/commands`、
  pi→`.pi/commands`）取代对当前 `commandsDir` 的依赖，Pi 目录变更后旧 venus 产物清理仍生效。

### Fixed

- **旧位置 Pi 指令清理**：`init` / `update` 顺带清理早期版本错误生成到 `.pi/commands/iagent/` 的
  产物（幂等、失败仅告警）。
- **config.yaml 回写尾部空行累积**：段替换统一以单个换行结尾，修复每次回写累积一个空行、破坏
  幂等的既有缺陷。

## [2.0.0] - 2026-10-12

### BREAKING

- **工具与品牌全面改名**：项目名 `VenusAgentTools` → `MiAgentTools`，包名 `venus-agent-tools` →
  `mi-agent-tools`，CLI 二进制 `venus` → `iagent`，技能名前缀 `venus_` → `iagent_`，
  斜杠指令命名空间 `/venus:` → `/iagent:`，工具指令子目录 `commands/venus/` → `commands/iagent/`。
- **27 个技能与 27 条斜杠指令重命名**：去掉生命周期类型段（`tr_*`），改为以功能命名，
  保留 `spec_` 领域段用于标记「依赖 openspec/ 与 openspec CLI」这一真实差异。
  指令 id 派生规则不变（去前缀 + 下划线转连字符）。
- **类型体系去 `tr`**：`tr_init` / `tr_impl` / `tr_test` / `tr_commit` / `tr_review` / `tr_release` /
  `tr_tools` / `tr_docs` → `init` / `impl` / `test` / `commit` / `review` / `release` / `tools` / `docs`
  （`spec` 不变）。连带 `.iagent/rules/<type>.md` 文件名与 config.yaml 的 `rules:` 列表改名。
- **项目配置目录 `.venus/` → `.iagent/`**。
- **`iagent generate` 名称组合规则变更**：由 `${SKILL_PREFIX}${type}_${name}` 改为
  `${SKILL_PREFIX}${name}`；`--type` 仅写入 frontmatter `metadata.type`，不再进入技能名。
- **旧装机需执行一次迁移**：`iagent init` / `iagent update` 内置一次性迁移（搬运旧配置内容并做类型
  与 workflow id 改名、删除全部旧 `venus_*` 技能与指令、清理旧补全产物），详见伴生变更
  `iagent-legacy-migration` 与 [旧装机升级指引](docs/upgrade-guide.md)。

### Changed

- 技能与指令元数据：27 条指令展示名 `Venus: xxx` 改为 `iAgent: xxx`；tags 的品牌标签与类型标签
  改用新名；模板 `metadata.author` 改为 `mi-agent-tools`。
- 品牌命名的磁盘产物随工具改名：变更目录下的遗留 sidecar 目录、跨变更索引库
  （`changes/archive/.iagent/index.db`）、补全脚本（`~/.iagent-completion.sh`、
  `IagentCompletion.ps1`）与 rc/profile 标记块（`IAGENT-COMPLETION:START/END`）。
- 产物 `$schema` 标识由 `venus/change|tasks|manifest|decisions|capabilities/v1` 改为 `iagent/...`。
- 4 个自带 `tr-` 前缀的规格 id 改名（`workflow-suite-skills`、`commit-push-skill`、
  `migration-skills`、`test-generate`）。

### Added

- **旧装机一次性迁移**（伴生变更 `iagent-legacy-migration`）：`iagent init` / `iagent update` 入口
  最先执行，自动完成升级。
  - 配置搬运：`.venus/` → `.iagent/`，`context` 多行块、自写规则行、注释行、未知段与自定义字段
    逐字保留（逐行段替换，不重新序列化 YAML）；`rules:` 列表与 `rules/*.md` 文件名按类型映射成对
    改名，`workflows:` 列表按旧→新指令 id 映射改名（旧 id 无法匹配任何技能模板，不改名则升级后
    首次 init 装 0 个技能），扫描基线随目录搬移；内容全部搬运完成后旧目录移除
  - 旧产物清理：各工具目录下 `venus_*` 技能与 `commands/venus/` 指令一律删除（含手工修改过的），
    另清理旧补全脚本与 rc/profile 旧标记块、变更目录下旧 sidecar 目录、旧跨变更索引库
    （提示可用 `iagent spec reindex` 重建）；非旧前缀产物完全不触碰
  - 迁移报告：搬运项 / 删除项 / 跳过项三段计数与明细 + 删除破坏性告警、未搬运原因、标记块不成对
    告警；无旧物时静默跳过，重复执行无副作用（幂等依据取「旧物是否存在」，不维护状态文件）
  - `--no-migrate`（`init` / `update`）：跳过迁移，零搬运零删除且不输出报告
  - 安全边界：删除前校验目标位于工具目录对应子目录之下、不跟随符号链接、空 `commandsDir` 工具
    跳过指令侧清理；迁移任何异常降级为告警，不阻断主流程
  - 详见 [docs/upgrade-guide.md](docs/upgrade-guide.md)（自动行为、告警含义、升级前动作、边界场景）
- **读取端兼容旧 `$schema` 值**：`iagent/...` 与历史 `venus/...` 均通过校验，历史变更文件无需改写。

### Fixed

- **空 `commandsDir` 的指令侧越界**：`iagent uninstall` 与 reconcile 对 `commandsDir` 为空的工具
  （codex，skills-only 模式）跳过指令侧遍历 —— 原先 `path.join` 会退化为项目根下的同名目录，
  改名后该语义变化会放大为误删用户目录的风险；同时为删除目标增加「必须位于该工具 skills 子目录
  之下」的边界校验。
- **文档不准确修正**：AGENTS.md 中委派白名单条目写法由 `Skill(iagent_xxx)` 更正为 `Skill(<裸名>)`
  （写成全名会产出永不放行的死条目）。

## [1.18.1] - 2026-10-12

### Changed

- **`.gitignore` 补齐 AI 工具产物目录**：新增 `.pi/`、`.codex/`（原先仅忽略 `.claude/`），
  与「本机产物均不入库」的约定一致。

### Fixed

- **文档与技能模板中的机器专有路径**：`README.md` 安装指引（3 处）与 `venus_tr_tools_pwd`
  技能模板示例输出中硬编码的 `E:\github\VenusAgentTools` 替换为通用占位符 —— 前者会把读者
  带向本机不存在的路径，后者与技能自身「始终报告命令实际返回的路径，不做推断」的约束矛盾。
- **README 全局链接前置条件缺失**：补充 `pnpm link --global` 要求 `PNPM_HOME` 已设置且在
  PATH 中，以及必须重开终端 / 编辑器才能让新写入的环境变量生效（否则分别报
  `ERR_PNPM_NO_GLOBAL_BIN_DIR` 与 `The configured global bin directory ... is not in PATH`）。
- **门标识句测试判据与内联门文本脱节**：`test/templates.test.ts` 的提示词校验门 / 功能流程图门
  判据仍要求全文版字面量（`出口有四条`、`流程最终确认门（阻塞）`），而内联进 5 个技能的是
  紧凑版文本（`出口：确认 / 修改 / 拒绝 ...`、`流程最终确认门（强制停止）`），导致 2 个用例恒失败；
  标识句改为紧凑版实际措辞（同时修正判据拦截力用例的篡改目标串），保留四条出口与最终确认门的语义校验。

## [1.18.0] - 2026-10-12

### Changed

- **多 Agent 模式四项优化**：对 explore / workflow / auto-workflow / debug / apply
  五个流程模板统一实施四项改进，降低 token 消耗、消除委派链路断裂风险：
  - **子代理退出守卫**（防 Plan 模式）：所有子代理派发指令末尾强制加入 EXIT GUARD，
    完成分配任务后 MUST 立即停止返回回执，MUST NOT enter plan mode / design mode /
    propose next steps；编排器是唯一有权判停与推进阶段的角色。
  - **数据共享强制执行**：子代理 MUST FIRST 读共享上下文包再做增量查询，
    MUST NOT 绕过包重读 proposal/specs/design 或重跑已覆盖的 CodeGraph 查询；
    `tr-impl-debug.ts` 的调查摘要从可选提升为强制优先读。
  - **测试内联实现**（裁 `venus_tr_test_generate` 委派）：apply 与 debug 中的
    `[测试]` 任务不再委派外部技能，改为内联测试编写规则（框架检测 → 风格对齐 →
    BCDE 边界覆盖 → 反模式防护），消除委派链路断裂导致流程丢失的风险。
    `venus_tr_test_generate` 技能保留供独立手动调用。
  - **allowedTools 同步修订**：`spec-apply.ts` 移除 `skillDelegation(['tr_test_generate'])`；
    `tr-impl-debug.ts` 同步移除；测试回归锁更新。
  - **移除 `Bash(codegraph:*)` 白名单误导**（10 个模板）：CodeGraph 仅有 MCP 工具形态，
    不存在 CLI 命令；`Bash(codegraph:*)` 在 allowedTools 中的存在暗示 AI agent
    可使用不存在的 Bash 命令，导致 MCP 工具异常时误回退到永远失败的 CLI 路径。
    全数替换为已有的 `mcp__codegraph` MCP 双写覆盖；测试断言同步更新。
  - **Auto-workflow 过渡指令防跳过**：Phase 1→Phase 2 的 "Announce then execute" 措辞
    改为 "Execute first, announce later"，消除宣告作为响应自然终止点导致 Phase 2
    被跳过的风险。skill 版与 command 版同步修订。

## [1.9.0] - 2026-09-30

### Added

- **`venus init` 确定性预扫描**（变更 `improve-init-project-scan`，新增模块
  `src/core/project-scan.ts`）：`venus init` 新增由纯 Node 代码执行的**确定性预扫描**，
  提取机器可判定事实（标志文件 / 构建设施 / 目录骨架 / 依赖清单 / 配置键名 / 路由声明位置），
  导出 `scanProject()` 与 `renderScanReport()`，在 `runInit()` 中于依赖自检语义位置之后接入，
  报告与 `renderDependencyReport()` 并列打印。新增 `--no-scan` 逃生阀
  （Commander 的 `--no-scan` → `scan: false`）；`InitResult` 追加 `scanReport` 字段
  （`--json` 契约无破坏）。**非阻断**：扫描任何失败仅 WARN + 记入 `failures`，
  MUST NOT 抛异常中断 init、MUST NOT 使退出码非零。
- **扫描基线 `.venus/scan-baseline.json`**：确定性预扫描的落盘产物（本机产物，不入库，
  整体覆盖写），含 `version` / `scannedAt` / `scope` / `limits` / `signals` / `candidates` /
  `failures`。定位为**给技能读的脚手架** —— 免去技能重复机械探测，非交付物；
  写入失败只落入 `failures` + WARN 文本，不抛异常。
- **`venus_tr_init_project` 项目知识文档生成能力**：技能正文扩写为
  「读基线 → 五类语义扫描 → 逐份确认 → 落盘 → 回写 context」；五类文档落
  `docs/project/<类型>/`（中文文件名：技术框架 / 模块与功能点 / 数据库 / API规范 / 安全规范）
  + 索引 `docs/project/README.md`；某类无内容则**不生成**该文档，索引仍列出全部五类并对
  未生成者标「不适用 + 探测依据」。委派 `venus_tr_docs_feature_doc`（可选降级，
  **不注入 DEPS**，默认安装集维持 **9 项**）。
- **`writeContextToConfig()`**（`src/core/project-config.ts`）：只替换 `context:` 段
  （`context: |` + 缩进块），其余逐行保留；MUST NOT 重新序列化整个 YAML（会丢注释与未知段）；
  与 `writeWorkflowsToConfig()` 共用抽出的段替换实现。
- **能力规格 `init-project-scan`**：为上述能力链新增规格，锁定契约 C1–C5 ——
  `ProjectScanReport` 形状、CLI 增量契约、五类文档路径契约、人工域标记契约与
  「信号 / 候选」判定层级。
- **人工域标记契约**：`<!-- 人工域:开始 -->` … `<!-- 人工域:结束 -->` 成对注释界定文档中
  逐字保留的段落，未标记段落一律可重派生；机制与 `derive-command.ts` 的 `<!-- CMD:SKIP -->`
  同构。破损情形一律取**保留侧**（未闭合保留至文末、嵌套乱序保留最外层最大连续区间，均记 WARN）。
- **`CONTEXT.md` 术语**（`openspec/CONTEXT.md`）：新增 6 条 —— 项目扫描 / 确定性预扫描 /
  扫描基线 / 信号与候选 / 人工域标记 / 不适用类。

### Changed

- **`tr-init.ts` 的 command content 改为单一源派生**：由手工双写改为
  `deriveCommandContent()` 按 `<!-- CMD:SKIP -->` 标记从 skill instructions 派生，
  消除「双模板漂移」在该技能上的最后一处存量；7 个 `spec-*.ts` 已用同一机制。
- **白名单随委派面同增**：`venus_tr_init_project` 写入 `CODEGRAPH_MCP`（裸服务器 + 9 具名
  工具）与 `Skill(venus_tr_docs_feature_doc)`；**禁用 `Skill(*)`**，**不加**
  `SUBAGENT_DISPATCH`（正文无派发动作）。两处回归锁同步：CodeGraph 技能数 10 → 11、
  经 `Skill` 委派的技能清单 9 项 → 10 项。
- **敏感值零外泄与框架结论不外推**（硬约束）：`signals.config` 条目**只有 `keys` 无 value
  字段**（类型层杜绝取值外泄，提取函数内即丢弃取值）；jar / 依赖只进 `candidates`
  并带「候选」note，MUST NOT 进 `signals` ——「jar 存在 ≠ 框架在用」（实测某项目有
  spring jar 但源码仅 1 处 import，机械判定必误报）。排除清单含 venus 自身产物目录
  （`.claude/` / `.venus/` / `.codegraph/` / `openspec/` / `node_modules/` / `dist/` 等），
  否则 `.claude/skills/` 下 27 个技能目录会被误报为项目信号。
- 版本号 1.8.0 → 1.9.0

### 说明

- **非破坏性，无迁移动作**：`venus init` 既有 option（`--tools` / `--force` / `--no-deps` /
  `--onboarding`）行为**逐字不变**；默认安装集维持 9 项（8 显式 + 1 注入），**无 BREAKING**。
  既有项目执行一次 `venus init` 即可获得扫描基线与项目知识文档骨架。

## [1.8.0] - 2026-09-30

### Changed

- **探索文件改为提案生成时移动并删除源件**（变更 `improve-workflow-artifact-dataflow`）：
  `openspec/explorations/*.md` 由「持久化探索记录」改为探索期的**暂存**文件 —— 提案生成
  时**移动**（非复制）为变更目录的 `exploration.md`，移动成功且目标校验通过后删除暂存区
  源件，**流程中只保留一份**；移动失败保留源件。规则**不追溯**搬迁或删除生效前的历史文件。
- **评审需求文档改为归档时生成**：`需求文档.md` 不再由提案校验后的各工作流生成，改由
  `venus_spec_archive` 的**预归档检查点（步骤 4.8）**与 `venus_spec_bulk_archive` 的
  平行步骤（a.6）从**最终制品**生成，随后随归档目录迁移至 `openspec/devdocs/`。原 4 条
  「校验通过后生成」链路（`tr-impl-workflow` / `tr-impl-auto-workflow` / `tr-impl-genfull` /
  `tr-impl-debug`）全部移除；故提案校验通过、甚至实现完成后该文件可能尚不存在，属预期行为。
- **调试侧「生成 / 就地增量对齐」双分支能力整体迁移至归档侧**：原 `venus_tr_impl_debug`
  Phase 7.3 的存在性判定与**人工域保护**（`## 基本信息` 与 `## 八、评审记录` 逐字保留，
  一~七按当前制品重新派生）迁为归档生成的「已存在」分支，调试流程不再触碰需求文档。
- **依赖注入调整，默认生效集由 8 项变为 9 项**：`spec-archive` / `spec-bulk-archive` 新增
  依赖 `tr-docs-requirement-doc`，故 `resolveWorkflows()` 在默认显式集（8 项）之外注入
  该技能，生效集为 **9 项**。未配置 `workflows` 的项目执行 `venus update` 后自动补齐并提示。
- **白名单随委派面同增同减**：`spec-archive` / `spec-bulk-archive` 各补
  `Skill(tr_docs_requirement_doc)`；`tr-impl-workflow` / `tr-impl-debug` /
  `tr-impl-genfull` 剔除该条目；`tr-impl-auto-workflow` 因 Phase 5 内联归档步骤仍委派而保留。
- **术语同步**（`openspec/CONTEXT.md`）：「探索文件」「人工域」「就地增量对齐」
  「工作流技能套件」改写触发主体与语义，新增「归档生成制品」。

## [1.7.0] - 2026-09-28

### Added

- **工具调用白名单的调用类扩展**（变更 `improve-skills-tool-whitelist`）：技能与指令在
  Claude Code 中运行时，除对话级确认门之外的调用不再逐次弹权限窗 —— 补齐了三类此前完全
  缺失的放行条目，管线可连续自动执行。
- **CodeGraph MCP 条目双写**：使用 CodeGraph 的 10 个技能同时写入裸服务器形式
  `mcp__codegraph` 与 9 个具名工具条目。此前白名单只有 CLI 形态 `Bash(codegraph:*)`，
  而正文实际调用的是 MCP 工具 —— **两者是两套工具名，互不覆盖**。整服务器形式存在
  「不自动放行」的失效报告，双写使任一路径生效。
- **技能间委派条目**：7 个技能写入 `Skill(venus_xxx)` 精确条目（genfull 8 个、debug 4 个、
  auto-workflow / workflow 各 3 个、auto-migration 2 个、spec-propose / spec-apply 各 1 个）。
  **禁用 `Skill(*)` 通配**（不可靠且会一次性放行全部技能）。
- **子代理派发条目**：6 个确有派发动作的技能写入 `Agent, Task`（新旧工具名双写，兼容
  派发工具更名）。授权面向子代理传递，故**不整类放行** —— 仅错误处理段落提及「子代理失败」
  不构成派发。
- **会话级权限载体**（`src/core/permissions.ts`）：`venus init` / `venus update` 额外把本工具集
  条目**非破坏合并**进 `.claude/settings.json` 的 `permissions.allow`。存在的理由：frontmatter
  的授权**仅覆盖调用当轮**、用户下一条消息即释放，跨轮次长管线需要会话级放行。语义为
  「不删既有条目、不碰 `deny`、过滤 `Bash(*)` 一类全量放行条目、既有文件非法 JSON 时保留原文件
  仅告警、幂等」；写入失败不阻断安装。
- **白名单共享常量模块**（`src/core/templates/tool-whitelist.ts`）：`CODEGRAPH_MCP` /
  `SUBAGENT_DISPATCH` / `skillDelegation()`，供模板以拼接方式引用，避免 27 份手写漂移。

### Changed

- **指令白名单由硬编码改为派生自配对技能**（**核心修复**）：适配器此前对全部 27 个斜杠指令
  一律写死 `allowed-tools: Bash(venus:*)`，无视配对技能已有的完整白名单 —— 经 `/venus:*`
  执行时文件读取、检索、图谱查询、技能委派全部弹窗。现由 `getCommandTemplates()` 单点回填
  配对技能的白名单（`CommandTemplate.allowedTools` 为**可选**，因 27 个指令模板工厂彼此不知道
  配对技能、设必填会迫使白名单复制 27 份；`CommandContent.allowedTools` 为**必填**，作为
  「白名单必须存在」的强制点）。删除 `VENUS_CLI_ALLOWED_TOOLS` 常量。
- **存量漂移修复**：`venus_tr_impl_auto_workflow` 正文的 1.2.1.5 多项目扫描与 Phase 4 批调度
  均要求派发子代理，白名单却无对应条目（历史决策已与实际产物脱节）—— 随本版修复。
- **`venus_spec_bulk_archive`**：由仅 `Task` 改为 `Agent, Task` 双写。
- **术语修正**：`openspec/CONTEXT.md` 的 workflow 计数 23 → 27（实测值）；补入「工具调用白名单」
  与「会话级权限载体」两条术语，并与「归档标签白名单」明确区分。
- **文档同步**：`docs/skills-manual.md`（25 处白名单列举 + 新增白名单组合规则小节）、
  `docs/genfull-guide.md`、`docs/migration-suite-guide.md`、`AGENTS.md` 修改守则与仓库地图。

### 说明

- **非破坏性，无迁移动作**：frontmatter 字段名与语法格式完全沿用，仅值域扩大；下游消费方
  （`show` 详情展示、`validate` 字段校验）不受影响。存量项目执行一次 `venus update` 即可获得
  新白名单，**无需 `--force`**（手改保护由「文件内记录指纹 vs 文件内容指纹」判定，模板变更不触发误判）。
- **明确不做**：`src/commands/generate.ts` 骨架技能的裸 `Bash` 白名单（等价全量放行）维持现状，
  属存量行为，留作后续单独评估；本次**不扩大**任何技能的 `Write` / `Edit` / `Bash(...)` 授权面。

## [1.6.0] - 2026-09-28

### Changed

- **多子代理派发的共享资源协议**（变更 `improve-workflow-subagent-resource-sharing`）：
  派发多子代理时的 token 消耗从「随派发单元数成倍放大」改为「与单元数解耦」——
  协调者一次性产出共享制品，子代理只读共享制品而非各自重读全量变更制品。
- **共享上下文包**（`spec-apply.ts` Steps 6，单一源）：首次派发前**一次性**产出
  `context-pack.md` 于流程级临时工作区，含六节 —— `## 变更摘要` / `## 契约` /
  `## 规范要点` / `## 文件归属表` / `## Codebase 摘要` / `## 已产出（跨单元可见）`；
  此后每批**只追加**产出登记，不重产整包。包是子代理的**唯一必读制品**。
- **产出登记表**：每批完成后协调者把该批产出文件与公开签名追加进包，使后续批次子代理
  无需重扫代码库即可获知前序产出（消除跨波次重复探索）。
- **回执最小化**：子代理回执固定四列 `<任务 id> | <状态> | <产出文件> | <公开签名>`，
  **MUST NOT 粘贴代码正文**（失败任务仍须含失败原因摘要）；「公开签名」定义为该单元产出中
  可被其他单元引用的符号签名，无则记「无」（不留空、不编造）。
- **共享指令前缀**：调度指令固定为「共享前缀（包路径 / 规范要点引用 / 回执格式 / 禁止项）
  → 单元差异（本单元任务清单）」，同一流程内前缀**字节一致**。
- **调度指令瘦身**：`ai-coding.md` 规范摘要从指令内联**移出**（改引用包 `## 规范要点` 节）；
  任务细节**保持内联**（使子代理无需读 tasks.md）。分界为「跨单元不变量共享、单元变量内联」。
- **禁止项与包缺口回执**：子代理 MUST NOT 重读 proposal/specs/design、MUST NOT 重跑包已覆盖的
  CodeGraph 查询；MAY 对包未覆盖内容补查，但回执 MUST 附**包缺口回执**，协调者据此回填。
  包是制品的**蒸馏视图而非替代品** —— 缺项时须补查制品本身，MUST NOT 凭包猜测字段或契约。
- **派发协议规格化**（补齐既有规格缺口）：派发单元 / 并发上限（缺省 3、非法值回退）/ 滑动窗口
  派发 / 跨单元同文件拆出并发组 / 任务勾选与失败重试由协调者集中管理 / 无子代理能力时全串行降级 ——
  首次写入规格。
- **批次形态豁免与 auto-mode**：批次含 <2 派发单元时协调者直接实现且**不产出包**；
  `auto-mode=true` 只跳过设计确认门，共享资源协议**不豁免**。
- **fail-safe 降级**：工作区不可写 → 回退系统临时目录；包产出失败或项目无
  `openspec/rules/ai-coding.md` → **退化为既有内联注入 + WARN，绝不阻断实现**。
- **多项目扫描单代理化**：`venus_tr_impl_auto_workflow` 与 `venus_tr_impl_workflow` 的 1.2.1.5
  由「每项目一个子代理」改为「**单个子代理内串行扫描全部待查项目**」——原实现为顺序派发
  （无并行收益却有 N 次子代理冷启动），合并为 1 次为严格改进；降级仍保持**项目粒度**。
- **auto-workflow 显式继承声明**：Phase 4 明文声明继承 `venus_spec_apply` 的派发与共享资源
  协议四载体，MUST NOT 另立派发指令格式或重复协议文本。
- **debug 流程级探查摘要**（`venus_tr_impl_debug`）：新增
  `.openspec-tmp/debug-<keyword>/investigation-digest.md`（keyword 为调试主题的 kebab-case
  关键词，与探索文件同规则）；Phase 2 起始**先读复用**、仅做**增量查询**、逐步骤**增量写入**；
  新增**失效规则**（修复改动代码后受影响范围标记失效并重新查询）；调试循环回边同样先读；
  Phase 7 收尾**统一清理**（含非缺陷与中途退出路径）。摘要**仅为流程内缓存**，不替代诊断记录
  与 Phase 6 对 `exploration.md` 的持久化。
- **auto-migration 规范要点改写入包**（`venus_tr_impl_auto_migration`）：Phase 3 由「每个子代理
  指令内联注入目标项目规范要点」改为「**写入包的 `## 规范要点` 节**」（BINDING 约束地位不变）；
  包不可用时退化为内联注入 + WARN。
- **结构指标断言**：新增 `test/subagent-resource-sharing.test.ts`（18 用例）锁定 A1–A8 —— 包六节
  与路径、一次性产出与追加规则、规范摘要移出、禁止项与缺口回执、共享前缀字节一致、两技能
  四处单代理化、debug 七串两处、auto-migration 三串两处；并含反向断言（旧内联表述与
  「每项目一个子代理」残留不得回归）。

### 已知落差

- `venus_spec_propose`（按能力派发子代理生成 delta spec）与 `venus_spec_bulk_archive`
  （按变更派发子代理）存在同类冗余，但派发粒度不同，**本次未同步**，待后续单独变更处理。
- 真实 token 计量无法在自动化测试中复现，本次以**可断言的结构指标**替代，未追加实测比对。

## [1.5.0] - 2026-09-28

### Added

- **测试用例生成能力优化与四模式接入**（变更 `improve-tr-test-generate-case-rationalize`）：
  `venus_tr_test_generate` 从"独立可用"升级为"被编排链路消费"。
- **测试层级路由**（`tr-test.ts` 阶段一 1.3）：在语言/框架 schema 路由之外新增**测试层级**
  维度（单元测试 / 功能级测试），二者正交；按被测对象粒度与变更性质自动判定；项目缺功能级
  工具链时降级为单元测试并提示（MUST NOT 生成无法运行的测试代码）。`SCHEMA_JAVA` 新增
  J6.5 功能级小节（`@SpringBootTest` / `@WebMvcTest` + 模板 G），`SCHEMA_NODE` 新增 N2.5
  功能级小节（supertest）。
- **该不该测闸门与不测清单**（阶段二 2.1）：纯数据类的取值读写方法、无分支的转发方法、
  私有方法、框架生命周期回调、自动生成的代码不进入场景设计；落入清单必须输出"已评估、
  判定不生成"的结论与依据，**不得静默跳过**——使"没写测试"与"没评估过"可区分。
- **用例优先级分级**（阶段二 2.4）：P0 核心业务链路必生成 / P1 默认生成 / P2 边界补充
  需显式确认才生成；分级**影响生成决策**，而非仅作标注。
- **用例去重与合并规则**（阶段二 2.5）：同构输入强制合并为参数化用例，跨方法重复断言
  提取为共享断言。
- **FIRST 原则补回**（「强制约束」区）：Fast / Independent / Repeatable / Self-validating /
  Timely 五要素及违例特征。该约束在能力 spec 中已声明为 SHALL，但 v3.0 重构时实现丢失
  （`grep -c FIRST` 结果为 0），本次补回实现。
- **覆盖度度量**（阶段五 5.1）：优先实测（Java JaCoCo / Node c8 或 `--coverage`），
  无工具链时降级为「规格场景 → 用例」静态映射矩阵并**强制标注"未实测覆盖度"**；
  两种方式都必须列出未覆盖清单，不得仅给百分比。
- **`[测试]` 任务类型标签**（并列第五类）：`TASKS_TEMPLATE` 与 tasks artifact 生成指令
  扩为并列四类（`[代码]` / `[测试]` / `[DB脚本]` / `[使用说明]`），`[测试]` 带层级
  （`[单元]`/`[功能]`）与优先级（`[P0]`/`[P1]`/`[P2]`）子标注。`tr-commit-push` 早已按
  该标签工作，但此前没有任何模板会产出它——三处口径不齐本次拉通。
- **apply 测试执行关卡**（`spec-apply.ts` 新增 Step 9）：编译检查之后独立运行，**仅限
  变更范围**（`[测试]` 任务产出 + 变更文件的既有测试）；范围内失败自动修复重试上限 3 次后
  暂停且不进入归档；**范围外存量失败仅 WARN 不阻塞**（存量测试已红的项目很常见，全量判定
  会让关卡不可用而促使用户绕过）；项目无测试框架时降级 WARN 跳过。
- **任务输出类型扩为三类**（apply）：代码实现 / **测试代码** / 补充文档。`[测试]` 任务
  委派 `venus_tr_test_generate`，且 **MUST NOT 走补充文档的 `产出:` → `attachments/`
  路由**（测试代码落在 attachments/ 下无法执行）。
- **propose 测试规划判定**：逐个 specs Scenario 评估可测性——可测者产出带层级与优先级的
  `[测试]` 任务；不可测者仍产出 `[测试]` 任务记录"已评估、判定无需测试"的依据。
- **auto-workflow 自动通关测试关卡**（Phase 4.3）：继承 apply 的 §9 并 auto-pass；
  3 次修复后仍失败则暂停报告，**不得静默通过、不得进入归档**。
- **debug 回归测试委派**（4.2）：编写动作改为委派 `venus_tr_test_generate`（复用框架检测与
  既有风格对齐），同时**保留** debug 的两条硬要求——回归测试 MUST 覆盖缺陷链路的
  「异常节点 + 根因节点」，且 MUST 修复前 FAIL、修复后 PASS；委派不可用时降级自研并 WARN。
- **能力规格漂移修订**（`specs/tr-test-generate/spec.md`）：分层测试编写指南原以
  Vitest `vi.mock()` / `test.each` 写死单一语言，与 v3.0 多 schema 定位冲突，改为语言无关表述。

### Changed

- **BCDE 场景矩阵标注自洽修正**（`tr-test.ts` 阶段二）：示例原把「参数为 null → 抛异常」、
  「空集合入参」标为 `B`（正常路径），但按 BCDE 自身定义（Boundary：Null、空值）应为
  `Boundary`。示例是 AI 生成用例时的模仿对象，错误标注会使覆盖度评估失真。同步新增
  **标注自洽硬约束**：null/空集合/空字符串/零值/极值/临界值 MUST 标 `Boundary`。
- **废除固定场景数量配额**（阶段二 2.3）：原「每个方法至少 1-2 正常 + 2-3 边界 + 1-2 业务
  规则 + 1-2 异常」对每个方法一律适用，**无"该方法是否值得测"的前置判定**，直接驱动为凑配额
  生成低价值用例。改为场景数量由**分支复杂度**与**用例优先级分级**共同决定，并明确禁止凑数。
- **分层测试策略语言无关化**（阶段三）：移除绑定单一语言的表述，Mock 与参数化 API 一律按
  检测到的语言从 `schema-*.md` 取用；补充代码层次与测试层级的关系说明。
- **归档摘要补充标注改为标签白名单识别**（`spec-archive.ts` / `spec-bulk-archive.ts`）：
  原逻辑为"收集**所有非 `[代码]`** 的类型"，会把 `[测试][单元][P0]` 中的 `单元`、`P0`
  误收为任务类型（产出 `[含测试/单元/P0]`）。改为只识别白名单 `[测试]`/`[DB脚本]`/
  `[使用说明]`，白名单外忽略并可 WARN。
- **`tr-impl-workflow` 职责边界显式化**：实现期核实该技能为 explore → propose → verify
  三阶段、**不含代码实现**，故测试执行关卡不由其承担。正文新增声明"测试关卡由 apply 承担，
  本技能只规划 `[测试]` 任务"，避免误读。skill 版与 command 版双份正文同步。
- `tr-impl-auto-workflow` 的 `allowedTools` 补录 `mvn` / `gradle` / `ant` / `go` / `cargo`
  ——该技能继承测试关卡后会在 Java/Go/Rust 项目执行测试命令，原白名单只有 `npm`/`pnpm`/
  `node`，会被权限拦截。
- 版本号 1.3.1 → 1.5.0

## [1.3.1] - 2026-09-28

### Changed

- **本机产物统一改为不入库**：`.gitignore` 的 `.venus/` 条目扩展为覆盖 `.claude/`
  （dogfood 产物）—— 原规则只忽略 `.claude/` 下 openspec 相关部分，venus 产物入库
  65 个文件，与 `AGENTS.md` 项目约定「`.venus/` 与 `.claude/` 都提交到 git」一致，
  但该约定与 `.gitignore` 实际行为**互相矛盾**（`.venus/` 被忽略且历史上从未纳管）
- 本次按「本机状态不入库」统一：`.venus/`（本项目配置）、`.claude/`（dogfood 产物）、
  `openspec/`（本地产物）、`.codegraph/`（索引）全部由 `.gitignore` 排除；
  **可提交的模板真源是 `skills/` 静态快照**（CI 的 `skills-parity` 漂移检查只针对它，
  实测不依赖 `.claude/`；`test/` 亦只用临时目录中的 `.claude/`）
- `git rm -r --cached .claude` 移除已跟踪的 65 个文件（工作区文件保留不动）
- `.gitignore` 随之清理三个被 `.claude/` 整目录条目涵盖的冗余条目：
  `.claude/skills/openspec-*/`、`.claude/commands/opsx/`、`.claude/settings.local.json`
- 影响面：本仓库不再有「模板 → 快照 → dogfood」三层一致性中的 dogfood 入库层。
  `AGENTS.md` 守则 8 与项目约定、`README.md` 工程保障段同步改写（明确"不入库"与
  可提交真源）。本机刷新约定不变：`pnpm generate:skills` 刷快照、`venus update` 刷 dogfood
- 版本号 1.3.0 → 1.3.1

## [1.3.0] - 2026-09-28

### Changed

- **`venus update` 手改保护判定改用内容指纹**：原实现只用 frontmatter `generatedBy`
  版本号一个信号推断产物是否被手改，存在两个方向的错误 ——
  (1) **模板正文变更而版本号未递增时**，产物被误判为"用户手改"而无法升级，只能加
  `--force`，而 `--force` 会连带覆盖**真正手改过**的产物、失去保护（该顺序依赖曾于
  1.2.0 作为操作约束写入 `AGENTS.md` 守则 8）；
  (2) **包版本号一旦递增**，被手改的旧版本产物反被判为"可升级"而**静默覆盖**
  （`isFromEarlierVersion` 实现为 `!==` 而非"早于"，名实不符），`skippedModified`
  完全不触发。
  根因是判定信号不足：版本号未递增时，"未改动的旧产物"与"被手改的产物"在信息上
  不可区分。修复为在产物 frontmatter 记录 `metadata.generatedFingerprint`
  （新增模块 `src/core/command-generation/fingerprint.ts`）：指纹由产物内容派生
  （先置空指纹行打断自引用、归一化行尾为 LF 后取 sha256），生成时两趟拼装回填。
  判定改为「指纹自洽 ⇒ 自上次由 venus 写入后未被改动 ⇒ 安全升级」，**独立于版本号**
- 判定分支与归入：未安装 → 安装；内容与内置一致 → 幂等跳过（不重写）；
  **指纹自洽 → 升级**（核心修复）；**无指纹字段的存量产物 → 回退原版本号判定**
  （行为与旧版完全一致，零回归；一经升级即带上指纹，保护转为精确）；`--force` → 覆盖；
  其余（指纹失配 ⇒ 被改动）→ 跳过并列出。`isFromEarlierVersion` 更名为
  `isLegacyVersionMismatched` 并订正注释，明示"版本号不一致"而非"早于"，且仅供存量回退
- `generatedBy`（版本号）**不再参与**手改保护判定，仅保留供 `venus show` 展示；
  `AGENTS.md` 守则 8 的"先递增版本号再 update"约束随之**整条删除**
- 连带修复：CRLF 行尾污染不再被误判为手改（指纹计算归一化行尾，`show` / `update`
  的 frontmatter 解析容忍 `\r`）；`update` 与 `show` 各自复制的 `generatedBy` 正则
  收敛到指纹模块的 `readGeneratedBy`，消除格式漂移导致两处行为静默分叉的隐患
- 版本号 1.2.0 → 1.3.0；全部生成产物随指纹字段重生成（`skills/` 快照与 `.claude/`
  dogfood 产物）

### Added

- `test/validate-update.test.ts` 新增 6 条用例，覆盖此前**零覆盖**的"旧版本自动升级"
  分支：指纹确定性、模板变更而版本号未递增仍能升级（本题核心）、被手改的旧版本产物
  不再被静默覆盖（反向缺陷）、存量产物回退（无指纹 × 版本不一致 / 版本一致）、
  CRLF 行尾污染不误判 —— 其中 5 条已在旧实现上验证为失败（真回归测试）

## [1.2.0] - 2026-09-28

### Changed

- **调试技能排查深度分级**（`venus_tr_impl_debug`）：排查阶段新增**事前分级**步骤
  （编号 `2.2.3.5`，十进制插入以**不重排既有编号**）—— 位于常规查询（文件结构 →
  符号定位 → 调用链与爆炸半径）之后、深度探索之前，按三条客观信号选定排查路径：
  (a) 爆炸半径（`codegraph_impact` depth ≤ 2 受影响符号数 ≥ 5 或受影响文件数 ≥ 3）；
  (b) 跨 ≥ 2 个模块 / 目录；(c) 未能一步定位单一高置信根因。任一命中即**深度路径**，
  否则走**轻量路径**（止步于常规查询，不执行 6 维根因深度分析）。信号取值 MUST
  可追溯至实测查询结果（MUST NOT 编造「半径小」以走轻量路径）；信号缺失或落在
  阈值边界时取深度路径（宁可多查不漏）
- 深度探索（原 2.2.4）的**内容与编号保持不变**，仅**触发条件扩展**为「分级为深度路径
  **或** 轻量路径未定位单一高置信根因」—— 原事后触发保留为**升级兜底**。兜底是
  **触发条件**而非独立步骤（MUST NOT 新建独立章节或编号），由此大范围缺陷即便已
  一步定位根因仍执行 6 维分析，同时轻量路径不会因分级判错而卡死
- 分级与缺陷链路图**解耦**：分级只决定深度探索是否执行；2.5 缺陷链路图与流程最终
  确认门对两条路径**均强制**产出（轻量 ≠ 不验证），不使既有流程图规格失效
- **信号降级**：CodeGraph 不可用时分级**仍生效** —— 信号 (a) 降级为 Grep 文件数
  代理指标，(b)(c) 照常判定，诊断记录标注「信号降级」；与既有 `2.2.0` 降级路径
  语义连续（降级改取证工具，不改能力）
- 分级判定结果（三条信号取值 / 所选路径 / 是否降级）随根因分析一并持久化到变更
  `exploration.md`，使「为何走这条排查路径」可事后复盘
- **需求文档更新分支**（`venus_tr_impl_debug` Phase 7.3）：深度复查之后、生成之前新增
  **存在性判定**（范围仅 `openspec/changes/<change-name>/需求文档.md`）——**不存在**时
  调 `venus_tr_docs_requirement_doc` 非交互生成（既有行为不变）；**已存在**时改为
  **就地增量对齐更新**：`## 基本信息`（需求编号 / 需求名称 / 交付时间，含占位符状态）
  与 `## 八、评审记录` 为**人工域 MUST NOT 覆盖**，`一~七` 章节按同步后的制品重新派生；
  MUST NOT 调用该 skill（其「目标已存在则静默覆盖」规则会抹掉人工内容）；MUST NOT
  删除章节，格式破损时补建缺失章节并记录 WARN，目录不可读时记 WARN 按不存在处理
- 技能正文与其**手写压缩指令正文**双处同步（该技能指令正文为手写压缩版，非经
  `deriveCommandContent` 派生）；`openspec/CONTEXT.md` 新增 6 条术语（排查深度分级 /
  轻量路径 / 深度路径 / 升级兜底 / 人工域 / 就地增量对齐）
- `AGENTS.md` 守则 8 补充**执行顺序**约束：需刷新 `.claude/` dogfood 时
  **先递增版本号、再执行 `venus update`** —— `update` 的升级判定是「已装 `generatedBy`
  版本**早于**当前包版本」，版本号未变时该判定为否、产物被当作"用户手改"跳过，
  此时只能加 `--force` 覆盖，而 `--force` 会连带覆盖**真正手改过**的产物、失去手改保护
  （该顺序在本次交付中由遗漏发现并验证）
  —— **本条已于 1.3.0 消除**：手改保护改用内容指纹，不再依赖版本号与操作顺序

### 已知落差

- 另三处同构的「验证通过后生成需求文档」逻辑（`tr-impl-workflow` /
  `tr-impl-auto-workflow` / `tr-impl-genfull`）**本次未同步**，仍会在需求文档已存在时
  覆盖人工填写内容 —— 建议后续单独变更处理

## [1.1.1] - 2026-09-24

### Added

- 新增 `.gitattributes`：`* text=auto eol=lf` 统一仓库行尾为 LF。修复的环境问题：
  `core.autocrlf=true` 且无 `.gitattributes` 时，checkout/merge 会把工作区中内容有变化的
  文件转为 CRLF，而 `skills/**` 静态快照与模板生成结果恒为 LF（vite 转换 TS 时归一行尾），
  `skills-parity` 的字节级比较随即误报漂移（实测 13 个快照失配）。显式声明后任何 clone /
  checkout 都产出 LF，该测试与环境配置解耦
- `.gitignore` 补充预防性条目：`coverage/`、`*.tsbuildinfo`、`.eslintcache`、
  `.claude/settings.local.json`（当前仓库中均不存在）

### Changed

- `vitest.config.ts` 配置 `testTimeout: 20000`：默认 5s 对 shell 调用外部 CLI 的用例
  （`spec-commands` 的 venus↔openspec 互认校验，单跑约 3.9s）余量不足，全量并发下会间歇性
  超时失败（先例 commit `5ed5f20` 亦记录过同一现象）

### 核验澄清

- 本次**未改动任何已提交内容**：经 `git cat-file -p` 逐字节核实，仓库全部 blob 本就以 LF
  存储（`vendor/auto-package-svn/*` 与 `skills/venus_release_package/scripts/*.sh` 的 CR 字节
  数为 0），`git add --renormalize .` 亦无内容变更。此前观察到的 CRLF 仅存在于**工作区副本**
  （checkout 经 `core.autocrlf=true` 转换所致）—— 故本次新增 `.gitattributes` 属**行为性声明**
  （此后 checkout 产出 LF），非内容规范化。注意 `git show <rev>:<path>` 会应用行尾转换，
  测量 blob 行尾须用 `git cat-file -p`

## [1.1.0] - 2026-09-24

### Added

- **功能流程图制品与提案交叉验证**：5 个工作流技能（explore / workflow /
  auto-workflow / debug / genfull）在探索阶段产出结构化流程制品
  （Mermaid 流程图 + 关键操作节点清单），经**流程最终确认门**确认后成为
  propose / verify 的**流程基准** —— 独立于提案自身的交叉验证锚点
- 新增模板层唯一源模块 `src/core/templates/flowchart-gate.ts`：承载制品文本与
  两套场景列集（需求版 / 缺陷链路版），以 `buildFlowchartBlock(columns)` 参数化
  渲染、`buildFlowchartCompact(columns)` 压缩渲染，构建期内联进各技能正文
  （不新增技能，技能总数保持 27）
- 产出强度分级：4 个流程类技能（workflow / auto-workflow / genfull / debug）
  **强制产出**；`venus_spec_explore` **条件触发**（无业务功能流程时记录
  「本次无功能流程」直通），不改变其「无固定步骤、无强制产出」定位
- 节点准入规则：节点粒度 = 可独立验证的业务操作单元；每节点 MUST 可追溯代码
  证据（`文件:行`），**新建功能**节点标 `[新建]` + 预期产物（不要求预测文件路径），
  无法追溯证据的节点 MUST NOT 进入清单（反幻觉）
- 调试技能缺陷链路变体：只覆盖缺陷相关节点（前置条件 → 触发 → 异常 → 根因），
  新增 `🔴异常` / `🟠根因` 标记；Phase 4 验证口径改为覆盖「异常节点 + 根因节点」
- 编排技能（genfull）Bridge 1 新增流程图**兜底补建 + 确认**步骤（探索阶段未产出时
  依探索产物强制补建，并入桥梁门决策），并具备幂等性
- 提案技能以流程基准为生成锚点：设计引用流程图与节点清单；任务逐个标注对应节点
  标识（`[N4]` 形）；流程图缺失或未获确认时降级为仅凭探索产物生成并标注降级
- 提案验证技能新增维度 **D10 流程图节点覆盖度**：`覆盖度 = 被覆盖节点数 ÷ 总节点数`，
  与既有维度同权重纳入 90% 统一阈值；优先按节点标识显式标注匹配、未标注时辅以
  语义等价判定；无 `## 功能流程图` 段时该维度 SKIP（不计入分母、不判 FAIL）；
  评分不足时逐条列出未覆盖节点标识与操作名
- 与既有 D9（Business Steps）职责分离互补：D9 检查提案自身是否拆解复杂操作
  （自证），D10 与外部流程基准比对（他证）；D9 保留不动
- `openspec/CONTEXT.md` 新增 6 条术语：功能流程图 / 关键操作节点 / 流程最终确认门 /
  节点覆盖度 / 流程基准 / 缺陷链路，并与既有「提示词基线」「业务流程图」「D9」显式划界

### Changed

- `venus_spec_verify_proposal` 维度数由 9 增至 10（描述、章节标题、总分公式的
  维度区间与触发维度表同步更新）

## [1.0.1] - 2026-09-24

### Added

- `AGENTS.md` 新增「修改守则」第 8 条：**版本号更新规则** —— 完成功能变更时按 SemVer
  三段（BREAKING → major / 功能新增或变更 → minor / 修复·文档·重构·测试·构建 → patch）
  递增 `package.json` 的 `version`，把 `[Unreleased]` 归档为对应版本小节并同步底部链接引用，
  二者**随本次功能提交一并提交**（不再单独提交 `chore: 版本号`）
- `README.md` 安装验证示例中的 `venus --version` 输出同步为当前版本号

## [1.0.0] - 2026-09-24

### BREAKING

- `venus init` 默认行为变化：从全量安装 14 个技能改为安装默认集 7 个
  （`tr-init-project` + spec 全 6：explore/propose/apply/archive/verify/verify-proposal）。
  已安装的产物不会被自动删除（reconcile 仅提示），需恢复全量可执行
  `venus config --set tr-init-project,tr-impl-feature,tr-test-generate,tr-commit-change,tr-review-code,tr-release-version,tr-tools-pwd,tr-tools-list,spec-explore,spec-propose,spec-apply,spec-archive,spec-verify,spec-verify-proposal`

### Added

- profile 配置机制：`.venus/config.yaml` 新增 `workflows` 字段声明本项目要安装的
  workflow，`venus init` / `venus update` 据此过滤生成；字段缺失时使用默认集（7 项）
- 依赖注入自动补全：选了 `spec-propose` 自动补 `spec-verify-proposal`
  （提案评分门），选了 `spec-archive` 自动补 `spec-verify`（归档前验证），
  补入项在输出中提示
- `venus config` 命令三模式：交互式勾选（@inquirer/prompts checkbox）/
  `--show` 打印生效集（含来源与注入标注）/ `--set <list>` 非交互设置（脚本/CI 用，
  非法 id 报错退出非零）
- reconcile 检测提示：init/update 扫描已安装但不在配置集内的 venus 产物，
  保留不删，输出清单提示手工处理（`venus uninstall` 或手动删除）
- onboarding 引导按生效 workflow 集动态过滤（默认集 7 项）
- 新增运行依赖 `@inquirer/prompts`（交互式 checkbox）
- 迁移技能套件三技能（源自 OpenSpec 项目 auto-migration/feature-doc/migration-check
  三功能，语言无关化适配）：
  - `venus_tr_docs_feature_doc`（指令 `tr-docs-feature-doc`，新增第 9 类 `tr_docs` 文档类）：
    扫描源项目功能模块生成功能需求实现文档（4 种输出模式 / 框架档案 / 4 类流程图 /
    反幻觉规则 / CodeGraph 优先自动降级）
  - `venus_tr_impl_migration_check`（指令 `tr-impl-migration-check`）：迁移后源/目标
    六层一致性检查（Controller/Service/DAO/前端/SQL/数据库）+ C1-C6 对抗检查 +
    P0/P1/P2 分级 + 写回验证
  - `venus_tr_impl_auto_migration`（指令 `tr-impl-auto-migration`）：一站式自动迁移编排
    （蒸馏确认门 → 规范加载与提案 → 实现确认门 → 评审子代理与修复循环）
  - 依赖注入：选 `tr-impl-auto-migration` 自动补 `tr-docs-feature-doc` 与
    `tr-impl-migration-check`（编排技能依赖两子技能）
  - 三技能均不入默认集（可选扩展件），经 `.venus/config.yaml` 的 `workflows` 勾选安装

- 工作流技能套件五技能（源自 OpenSpec 项目 workflow/auto-workflow/debug/
  create-requirement-doc 四功能 + 用户级 openspec-proposal-review 定制版，
  语言无关化适配）：
  - `venus_tr_impl_workflow`（指令 `tr-impl-workflow`）：一站式引导工作流
    （结构化探索 checkpoint 体系 + grill 追问 L1-L5 → 提案内联生成 + CLI 降级 →
    自动验证门 → 深度复查与需求文档联动）
  - `venus_tr_impl_auto_workflow`（指令 `tr-impl-auto-workflow`）：全自动管线
    （探索 → 提案 → 验证 → auto-apply（auto-mode=true）→ auto-archive 五阶段）
  - `venus_tr_impl_debug`（指令 `tr-impl-debug`）：一站式调试工作流
    （强制复现 → CodeGraph 分层排查 + 根因确认门 → 关联变更判定 →
    修复 + 强制回归测试调试循环 → 编译检查 → 同步提案 → 验证）
  - `venus_tr_docs_requirement_doc`（指令 `tr-docs-requirement-doc`）：变更提案转
    八章节评审需求文档（双执行模式 / 场景分组 / 伪代码注入规则 / 归档状态输出路由）
  - `venus_tr_impl_review_proposal`（指令 `tr-impl-review-proposal`）：提案完整性复查
    （深度代码库探索 + 8 维度完整性检查 + 合规性验证 + 量化评分；
    Java/Venus4A 专项检查按项目特征触发）
  - 依赖注入（不动点迭代，连带补全传递依赖）：选 `tr-impl-workflow` 自动补
    `tr-impl-review-proposal` 与 `tr-docs-requirement-doc`；选
    `tr-impl-auto-workflow` 自动补 `tr-impl-workflow` 与 `tr-docs-requirement-doc`
    （并连带其依赖）；选 `tr-impl-debug` 自动补 `tr-docs-requirement-doc` 与
    `spec-verify-proposal`
  - 五技能均不入默认集（可选扩展件），经 `.venus/config.yaml` 的 `workflows` 勾选安装

- 共享制品生成协议：新增 `openspec/rules/artifact-generation.md`
  （G1 创建变更 → G2 status/instructions 依赖序循环 → G3 终态确认），
  供 `venus_tr_impl_workflow` 与 `venus_spec_propose` 共同引用，
  同时修复 `venus_spec_propose` 正文对该路径的悬空引用

- 生态引用闭环：`tr-docs-feature-doc` 恢复 NOT-for 边界引用指向
  `tr-docs-requirement-doc`；`tr-impl-auto-migration` 补充
  `/venus:tr-impl-workflow` 完整工作流选项引用（上次迁移因无对应物删除）

- `venus init` 依赖自检与自动安装：检测 codegraph CLI / 用户级 MCP 注册、
  openspec CLI / 项目 `openspec/` 目录，缺失时自动执行
  （`npm install -g`、`claude mcp add codegraph -s user`、`openspec init --tools claude`），
  作为后续功能集成的基础；已存在的依赖只检测不升级，
  安装失败仅警告不阻断主流程，`--no-deps` 可跳过

- 新增技能 `venus_tr_commit_push`（指令 `tr-commit-push`，迁移自源 SKILL tr-commit-push 并新增
  提案分类提交）：SVN 交互式提交——四环节强制确认（提交范围 → 内容清单与功能描述 →
  知识库推送询问 → 最终确认，缺一不可）、提交范围排除（target/、*.class 等编译产物永不提交，
  优先级最高）、UTF-8 无 BOM 注释落盘 + `--encoding UTF-8 -F`、SVN 证书/凭据处理
  （E230001/E215004，密码仅内存与 stdin）、提交后双验证（svn status + svn log --xml）、
  知识库推送（llm-wiki MCP 逐项确认，单次最多 5 个文件分批）；核心增量提案分类提交——
  `/venus:tr-commit-push 提交 <提案名> 提案` 按提案将变更自动归类功能代码/测试代码/文档三类
  （src/test/**、test/**、*Test.java、*Tests.java、*.test.* 归测试；已纳管 docs/**、其余 *.md、
  已纳管 openspec/ 制品归文档；其余归功能代码），N 笔分类分批提交，每笔提交信息尾行标注
  `提案: <变更名>` 溯源，提案关联校验不阻断由用户裁决，任一笔失败即停不回滚已成功笔。
  现有 `venus_tr_commit_change`（Git 版）行为零变更，两技能按 VCS 划分职责（SVN 项目用
  tr-commit-push、Git 项目用 tr-commit-change）；不入默认集，经 `.venus/config.yaml` 的
  `workflows` 勾选 `tr-commit-push` 安装


## [0.1.0] - 2026-09-08

首个可用版本：按生命周期类型（`tr_*`）分类生成与管理 `venus_` 前缀的 Agent 技能。

### Added

**核心功能**
- 7 类生命周期分类体系：`tr_init`（初始化）/ `tr_impl`（实现）/ `tr_test`（测试）/
  `tr_commit`（提交）/ `tr_review`（审查）/ `tr_release`（版本）/ `tr_tools`（工具）
- 8 个内置中文技能（每类 1 个，`tr_tools` 含 `venus_tr_tools_pwd` 查看当前路径等 2 个）
- 同步生成 Claude Code 斜杠指令（`.claude/commands/venus/<type>-<name>.md`）
- `venus init`：生成全部技能与指令到目标项目，含首次 onboarding 引导
- `venus list`：按类型分组列出已安装技能（`--json` 结构化输出）
- `venus show <query>`：查看技能详情（frontmatter / 类型 / 工具白名单 / 正文预览），
  支持前缀与片段模糊匹配，多命中列出候选
- `venus generate --type <tr_*> --name <kebab>`：按类型生成新技能骨架并安装
- `venus validate`：校验技能规范符合性（`venus_` 前缀 / name=目录名 / 必填字段 /
  类型合法），CRITICAL 时退出码 1，可接入 CI
- `venus update`：升级已安装技能到内置模板最新版，手改保护
  （内容一致幂等跳过 / 旧版本自动升级 / 用户手改跳过并提示，`--force` 覆盖）
- `venus uninstall`：干净移除 venus 管理的技能与指令
  （非 venus 技能不碰；`.venus/` 配置默认保留，`--purge-config` 一并删除）
- `venus completion install|uninstall`：shell 补全（bash 的 compgen +
  PowerShell 的 Register-ArgumentCompleter），标记块管理 rc/profile

**项目配置**
- `.venus/config.yaml`：项目背景（context）+ 规则引用（rules 显式 include）
- `.venus/rules/<type>.md`：按类型的规则文件（每行一条，`#` 注释），
  config 引用顺序即注入顺序，删除引用即停用
- `venus generate` 自动将 context 与对应类型 rules 注入骨架正文

**工程保障**
- 三层架构（模板层 → 生成层 → 命令层），`ToolCommandAdapter` 预留多工具扩展
- 每技能按正文实际命令声明 `allowed-tools` 白名单（防止权限拦截）
- `skills/` 静态快照 + parity 防漂移测试（模板变更未重新生成即失败）
- GitHub Actions CI：Ubuntu + Windows 双平台，build → lint → test → 快照一致性
- eslint（typescript-eslint）
- MIT LICENSE、README（安装/使用/架构）、AGENTS.md、docs/getting-started.md

### Changed

- 项目配置从单文件 `venus.config.yaml` 重构为 `.venus/` 目录结构
  （`config.yaml` 显式引用 `rules/` 下规则文件），重复 init 保留用户全部修改

[4.0.0]: https://github.com/mi-agent-tools/compare/v3.0.0...v4.0.0
[3.0.0]: https://github.com/mi-agent-tools/compare/v2.1.0...v3.0.0
[2.1.0]: https://github.com/mi-agent-tools/compare/v2.0.0...v2.1.0
[1.18.1]: https://github.com/mi-agent-tools/compare/v1.18.0...v1.18.1
[1.18.0]: https://github.com/mi-agent-tools/compare/v1.17.0...v1.18.0
[Unreleased]: https://github.com/mi-agent-tools/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/mi-agent-tools/compare/v1.0.2...v2.0.0
[1.0.2]: https://github.com/mi-agent-tools/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/mi-agent-tools/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/mi-agent-tools/releases/tag/v1.0.0
[8.1.1]: https://github.com/mi-agent-tools/compare/v8.1.0...v8.1.1
[8.1.0]: https://github.com/mi-agent-tools/compare/v8.0.0...v8.1.0
[8.0.0]: https://github.com/mi-agent-tools/compare/v7.1.0...v8.0.0
[7.1.0]: https://github.com/mi-agent-tools/compare/v7.0.1...v7.1.0
[7.0.1]: https://github.com/mi-agent-tools/compare/v7.0.0...v7.0.1
[7.0.0]: https://github.com/mi-agent-tools/compare/v6.4.0...v7.0.0
[6.4.0]: https://github.com/mi-agent-tools/compare/v6.3.0...v6.4.0
[6.3.0]: https://github.com/mi-agent-tools/compare/v6.2.0...v6.3.0
[6.2.0]: https://github.com/mi-agent-tools/compare/v6.1.0...v6.2.0
[6.1.0]: https://github.com/mi-agent-tools/compare/v6.0.0...v6.1.0
[6.0.0]: https://github.com/mi-agent-tools/compare/v5.0.0...v6.0.0
[5.0.0]: https://github.com/mi-agent-tools/compare/v4.0.0...v5.0.0
[1.17.0]: https://github.com/mi-agent-tools/compare/v1.16.0...v1.17.0
[1.16.0]: https://github.com/mi-agent-tools/compare/v1.15.0...v1.16.0
[1.15.0]: https://github.com/mi-agent-tools/compare/v1.14.0...v1.15.0
[1.14.0]: https://github.com/mi-agent-tools/compare/v1.13.0...v1.14.0
[1.13.0]: https://github.com/mi-agent-tools/compare/v1.12.1...v1.13.0
[1.12.1]: https://github.com/mi-agent-tools/compare/v1.12.0...v1.12.1
[1.12.0]: https://github.com/mi-agent-tools/compare/v1.10.0...v1.12.0
[1.10.0]: https://github.com/mi-agent-tools/compare/v1.9.0...v1.10.0
[1.9.0]: https://github.com/mi-agent-tools/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/mi-agent-tools/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/mi-agent-tools/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/mi-agent-tools/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/mi-agent-tools/compare/v1.3.1...v1.5.0
[1.3.1]: https://github.com/mi-agent-tools/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/mi-agent-tools/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/mi-agent-tools/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/mi-agent-tools/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/mi-agent-tools/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/mi-agent-tools/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/mi-agent-tools/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/mi-agent-tools/releases/tag/v0.1.0
