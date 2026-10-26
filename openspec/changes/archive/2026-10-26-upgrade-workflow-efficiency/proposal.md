# 变更提案：upgrade-workflow-efficiency

> 语义来源：`openspec/explorations/iagent-workflow-efficiency-upgrade-explore-001.md`（explore-001，含已确认流程基准 N1–N11 与裁决 DEC-1…DEC-6）。
> 阶段：Phase 2.3 提案生成（delegated）。本文件只描述**计划**，不含实现。

## Why

对 `iagent` 工具链的六处效率 / 能力瓶颈做一次性收口。六项均有实测证据（证据位置取自 explore-001 的「代码事实基线」与「Pending」影响面表），且已由用户逐项裁决（DEC-1…DEC-6）：

1. **扫描上限制造静默漏采（①）**：`MAX_SCAN_DEPTH = 8` / `MAX_SCAN_FILES = 2000`（`src/core/project-scan.ts:21`、`:24`）在 `walkDir`（`:543`）里以 `continue` 静默丢弃。实测：构造深度 10 的 `db.properties` → `config: []`，唯一提示是 `limits.detail`（`:717`）；而本仓库全扫 218 文件仅 **11ms** —— 上限是**臆造的截断**而非性能保护。更糟的是 `limits.hit/detail` **没有任何消费方**（`project-init` 只读 `signals`/`candidates`/`failures`，`project-init.ts:167-173`），于是「没扫到」被技能当成「项目没有」——正是 `init-project-scan` 规格明令禁止的失败模式。
2. **跨变更 SQLite 索引是净成本（②）**：写侧全经 `sqlite3` CLI 子进程、每条语句一次进程（`sqlite-index.ts:136-147`），单变更 5–6 次（`markdown-index.ts`）；归档每次强制全量 `reindex --force` 实测 **9.8s / 42 变更**，其中 40 个走 legacy sidecar 降级、1 个直接抛 `Cannot read properties of undefined (reading 'replace')`。读侧三重不可达：`queryExplorationByCapability` / `queryCapabilityConflicts` / `searchDecisions`（`sqlite-index.ts:326/:339/:359`）**零调用点**；`spec-explore.ts:994-999` 指向的 `openspec/.iagent/index.db` 与真值路径不一致；该技能 `allowedTools` 又无 `Bash(sqlite3:*)`。`sql.js` 是声明未用的死依赖。同类检索已有更快的替代：4MB / 401 个 Markdown 全文检索 **253ms**，且探索记忆早已被 `spec-archive` 同步进 `openspec/specs/<cap>/explorations.md`。
3. **提案制品与代码脱节（③）**：本仓库 `.gitignore` **整体排除 `openspec/`**，所以「提交提案文档」当前是空操作；Git 侧 `commit.ts` 完全无提案感知（只有 `git status`/`diff`/`add`/`commit`），而 SVN 侧 `svn-commit.ts:49-88` 早已有分类提交 + 尾行 `提案: <name>` 溯源。同一需求两套体验。
4. **CodeGraph 使用逻辑自伤（④）**：模板强制「`codegraph_status` 必须是首个动作」，但宿主工具面可能只挂 `codegraph_explore`（本会话实测），把「探测」变成「失败源」；同时技能内**无条件显式 `codegraph sync`** 与 daemon 的 writer 争同一 DB 写锁（`daemon.log`：`File watcher active … auto-sync on changes`）→ 即用户所见的「sync 因数据库被进程锁定而跳过」。归档类技能正文要求经 Bash 跑 `codegraph status`/`sync`，`allowedTools` 却**没有 `Bash(codegraph:*)`**（正文与权限面不同步）；`codegraph unlock` 存在但零引用。
5. **模型自造确认门（⑤）**：`GATE_PROTOCOL_PREAMBLE`（`prompt-gate.ts:115-121`）把「门 = 硬停止」写进 4 个技能，却**没有**负向边界，模型极易把停顿泛化到任何位置 —— 用户实测的「Phase 1: 探索阶段 / 开始委派 iagent-spec-explore…」后停住在全仓库**无对应文案**，属自造停顿。`auto-workflow.ts:41` 有「不停顿、不宣告、不向用户提问」直通句，`workflow.ts` 没有。另 `.iagent/rules/coding-rules.md` 的「设计先行 … 过确认门后再改码」会与 Phase 3.7 实现桥重复确认。
6. **跨阶段重复蒸馏（⑥）**：`spec-apply` 的 `context-pack` 协议只在 apply 内生效（`spec-apply.ts:8-75`），propose / verify / archive 各自重读 30–60KB 制品。量化：单变更制品 45KB ≈ 25k tokens，跨 6 次阶段加载 ≈ **150k**；`debug.ts` 无 `SUBAGENT_DISPATCH`（`:562`），46KB 正文全内联，修复循环全部压在主上下文上，长循环压缩风险最高。

## What Changes

### ① 扫描基线：完全不设上限 + 忽略清单 + 软超时（DEC-1，N1–N4F）

- **删除上限语义**：移除 `MAX_SCAN_DEPTH` / `MAX_SCAN_FILES` 常量与 `walkDir` 的深度、文件数截断分支（`project-scan.ts:21`、`:24`、`:569-572`、`:585-588`），`ScanSink` 的 `limits.maxDepth/maxFiles`、`depthLimited`、`filesLimited` 一并删除。
- **固定忽略清单扩充**：`EXCLUDED_DIR_NAMES`（`:55-76`）补 `.next` / `.venv` / `__pycache__` 等；`openspec` 仍保留在清单内（纳管 `openspec/changes/**` 不改变「扫描不把 iagent 自身产物当项目信号」）。
- **新增忽略规则解析模块**（`src/core/scan-ignore.ts`）：解析项目 `.gitignore`（含嵌套）与自定义 ignore 文件，支持 `!` 否定规则与目录层级继承；命中即跳过并计入 `skipped.ignored`。解析失败 **fail-open**（不过滤 + WARN），可经 `iagent init --no-scan-ignore` 关闭（`config.yaml` 不新增 `scan` 段）。
- **软超时（默认 30s）**：遍历超预算即停止，**不算失败**（退出码保持 0），记 `softTimeout.exceeded=true` 与 `skipped.timeout`，并在**终端报告与基线 JSON 双写提示**，不得静默。预算可经 `IAGENT_SCAN_SOFT_TIMEOUT_MS` 覆盖（否则软超时的 e2e 验收无注入路径）；`skipped.timeout` 采用「停止点起至本层枚举结束」的可判定口径（不递归统计未展开子树）。
- **`limits` schema 升 v2**：`{ version: 2, scannedAt, scope, limits: { hit, detail, reasons[], softTimeout: { ms, exceeded }, skipped: { ignored, timeout, unreadable } }, signals, candidates, failures }`；`reasons` 取值 `ignored` / `soft-timeout` / `unreadable`；`hit` 语义由「触及上限」变为「发生任一跳过」，`detail` 保留人读文案。**BREAKING**（产物契约变更）。
- **消费侧闭环**：`project-init` 技能（`project-init.ts:167-173`）新增硬要求 —— `limits.skipped` 与 `failures` **必须**在报告中呈现，`skipped` 全零时才可省略；使「没扫到」≠「没有」。
- 骨架 / 文档探测去掉隐式的 `SKELETON_PROBE_DEPTH` 上限或与新遍历语义对齐（`probeSkeleton` / `containsJavaWithin` / `probeDocs`）。

### ② 移除跨变更 SQLite 索引（DEC-2，N5 / N9；**BREAKING**）

- **整文件删除**：`src/core/spec/sqlite-index.ts`、`markdown-index.ts`、`index-cache.ts`、`sqlite-memory-backend.ts`。
- **命令删除**：`iagent spec reindex`（`src/commands/spec.ts:272` 起的命令体与全部辅助 `indexChangeJsonEntry` / `indexSpecsMdFallback` / `indexDesignMdFallback` / `indexExplorationMdFallback` 等），CLI 注册与补全表（`src/commands/completion.ts` 的 `IAGENT_COMMANDS.spec.subcommands`）同步移除。
- **init 段删除**：`src/commands/init.ts:39` 的 import、`:317-333` 的 SQLite 初始化、`InitResult` 的 `indexDbStatus` 字段与终端输出。
- **归档步骤简化**：`spec-archive.ts:394`、`spec-bulk-archive.ts:367` 的 `reindex --force` 调用删除（N9 变为「记忆同步 →（按需）CodeGraph」）。
- **探索记忆检索收窄**：`spec-explore.ts:994-999` 删除索引分支，**仅保留** N5B（Glob `openspec/specs/<capability>/explorations.md`）；N5A 退役。
- **依赖删除**：`package.json` 的 `sql.js`。
- **能力退役**：`sqlite-cross-change-index` 的 6 条 Requirement 全部 REMOVED（4 条核心行为 + 2 条 reindex 专属：Markdown 主来源、全文结果保留证据 —— 二者描述的对象随命令一并消失，保留即产生规格漂移）。
- **不做的两件事**：不提供 `spec reindex` 弃用桩（保留命令名会与「源码零残留引用」回归锁冲突）；**不删除**用户目录里既有的 `index.db`（升级只停止写入，`docs/upgrade-guide.md` 明示可外部打开）。
- **旧装机迁移与测试面收口**：`legacy-migration.ts` 中「旧索引库已删除，可用 `iagent spec reindex` 重建」的提示改中性（旧品牌 `.venus/` 缓存清理语义保留，MUST NOT 指向已删命令），**并同步 MODIFY `legacy-install-migration` 主规格的「旧版品牌产物清理」Requirement 与其 4 条 Scenario**（主规格原文明确要求「报告提示可用 reindex 重建」，不改即与实现互相矛盾）；`test/spec-commands.test.ts` 的 `iagent spec reindex（内存后端…）` 段与 `MemoryBackend` import 同批删除（它是 `sqlite-memory-backend.ts` 的最后一个引用方），`test/legacy-migration.test.ts` 的 `reindex` 提示断言同步改中性。
- **残留字样收口**：`src/cli/index.ts:14`（注释含 `reindex`）与 `src/core/child-process.ts:30`（注释含 `sqlite3`）随 ② 一并清理 —— 二者是 7.5「`src/**` 零命中」回归锁的硬前置。
- **非索引能力的措辞收口**：`artifact-json-sidecar` / `artifact-markdown-source`（历史 JSON 只读兼容不再以「索引操作 / 生成索引」为出口）与 `agent-tool-identity`（不再列举「跨变更索引目录」待改名产物）三处主规格同步 MODIFIED，避免归档后主规格继续指向已删命令与已删常量。

### ③ 提案制品提交：纳管 + 精确暂存 + 不自动 commit（DEC-3，N10–N11）

- **`.gitignore` 纳管（必须写成规则链）**：`openspec/*`（通配排除）→ `!openspec/changes/`（放行）→ `openspec/changes/archive/.iagent/`、`openspec/changes/**/attachments/`（逐个再排除）；`.iagent/`、`.openspec-tmp/` 既有条目不动。**MUST NOT** 保留 `openspec/` 整目录排除的同时写 `!openspec/changes/**` —— git 不列出被排除的父目录，该写法放行不生效（且不会报错，只表现为「提交清单为空」）。
- **范围的三项显式取舍**：① `openspec/changes/archive/**` **一并纳管**（历史 42 个变更 / 312 个 Markdown 制品 / 约 3.8MB 首次成为未跟踪项，是「归档后规格合并结果（`openspec/specs/**` 仍忽略）仍可追溯」的唯一来源）；② `attachments/**`（59 文件 / 约 0.45MB）与 `.openspec-tmp/**` 在 `.gitignore` 层面排除（不只靠提交清单，防 `git add -A` 与 IDE 全量暂存）；③ `openspec/explorations/**`、`openspec/specs/**`、`openspec/devdocs/**`、`openspec/rules/**`、`openspec/config.yaml`、`openspec/CONTEXT.md` **保持忽略**（DEC-3 的「含 `exploration.md`」指**变更目录内**的 `exploration.md`）。
- **Git `commit` 技能新增「提案制品纳入」段**（`commit.ts:11`、`:19-58`）：检测活跃变更 → 生成**精确暂存清单**（`openspec/changes/<name>/{proposal.md,design.md,tasks.md,exploration.md,.openspec.yaml,specs/**/*.md}`，排除 `attachments/**` 与需求文档）→ `git add <精确路径>` → 提交信息尾行 `提案: <name>`（与 `svn-commit.ts:72-80` 同格式）。**MUST NOT** `git add -A`。
- **apply 完成段追加「暂存并提示」**（`spec-apply.ts` 完成段 / Guardrails）：apply 收尾对提案制品执行精确暂存并提示，**不 commit**；失败只 WARN 并提示手动处理。
- **人工闸保留**：`commit.ts:54-58`「首次执行前展示将要提交的文件与提交信息」**不豁免** —— 明确**不改为自动提交**。
- **`iagent init` 可选提示**：首次 init 时提示纳管策略（对齐 `spec-apply.ts:263` 既有的 `.openspec-tmp/` 补条目模式），不擅自写 `.gitignore` 业务条目。
- SVN 侧 `svn-commit` 的「未纳管 `openspec/` 制品默认不提交」语义**不变**（其纳管判断基于 SVN 版本控制，与 Git 的 `.gitignore` 策略互不影响）。

### ④ CodeGraph：去 sync + 能力探测 + 锁阶梯 + 白名单补齐（DEC-4，N6 / N9）

- **白名单单一源新增 `CODEGRAPH_CLI`**（`tool-whitelist.ts`，`Bash(codegraph:*)`，含 `status` / `unlock` 语义），供 `spec-archive` / `spec-bulk-archive` / `spec-explore` / `debug` / `project-init` 引用（正文确需跑 CLI 者）。
- **能力探测顺序替代「先跑 status」**：MCP 具名工具 → `codegraph_explore` 的时效横幅 → CLI `status --json`；**「工具名缺失」≠「索引不可用」**。
- **锁阶梯**：需同步时先读 `writer.pid`（**JSON**：`{pid, mode, startedAt, ready}`）判存活 → **存活则只读复用**（WAL 读者不阻塞，**禁止 unlock**）→ 不存活才 `codegraph unlock` + 重试一次 → 仍失败降级 Grep + WARN；解析失败 / `ready:false` 按「不可判定 = 存活」处理（宁可少做一次修复，也不误删活跃锁）。
- **删除技能内无条件显式 `codegraph sync`**：同步责任交还 daemon 文件监听；仅「确认无 daemon（纯 CLI 用户）」时按需 sync 一次。
- **口径单一源**：探测顺序与锁阶梯文案收敛到一个共享模块（`src/core/templates/codegraph-protocol.ts`），以**同一函数两形态**渲染（`withCli: true|false`，避免「插值即等于声明 CLI 调用」与 `migration` 不持 CLI 权限的冲突），5～6 个技能模板插值引用，MUST NOT 各自手写（防第二份真源）；`migration` 用 `withCli: false`（该技能不跑 CLI，不加 `CODEGRAPH_CLI`）。
- **保留既有护栏**：MUST NOT 用「`.codegraph/` 目录是否存在」判索引可用性（点号目录 Glob 假阴性）；读取 `writer.pid` 判 daemon 存活属另一判据，不受该护栏限制。
- 归档段删除「任何错误一律跳过全部 CodeGraph 步骤」的粗粒度分支（`spec-archive.ts:123`、`spec-bulk-archive.ts:47`）。

### ⑤ 确认门白名单化（DEC-5，N6 / N7）

- **必留 5 类阻塞门**：L1-L5 需求澄清 / 功能流程图门 / 实现 + 测试桥（Phase 3.7）/ 归档桥（Phase 5）/ 破坏性改动确认。
- **MUST NOT 请求确认**：阶段宣告、技能委派、只读扫描、CodeGraph 查询、状态查询（reindex 已随 ② 消失）。
- **既有只读校验询问收口**：`spec-verify-proposal` / `workflow` 正文及其参考协议（`references/verification-protocol.md` 3.4）的「是否运行技术栈专项校验？」[是][否] 属只读校验，改为**自动执行并在报告中说明**；三处文本同批改写，MUST NOT 只改模板留下参考文件内的旧询问。
- **`workflow.ts` 补直通句**：抄 `auto-workflow.ts:41` 同款「本阶段立即开始 —— 不停顿、不宣告、不向用户提问」，覆盖 Phase 1→2、2→3、3→4、4→5 的委派点。
- **`GATE_PROTOCOL_PREAMBLE` 增负向边界句**（`prompt-gate.ts:115-121`，单一源）：明确「非门动作 MUST NOT 停止」，门协议本身不弱化。
- **门白名单常量单一源**：`GATE_WHITELIST` 定义在**协议层** `host-orchestration/protocol.ts`（与 `GateSpec` 同源，5 类 + `anchors` 锚点集合），`prompt-gate.ts` 反向 import 它渲染文本并插值到全部编排技能；生成期测试断言。
- **宿主编排门清单对齐**（`host-orchestration/workflows.ts`、`protocol.ts`）：以常量映射声明「阶段门 ↔ 白名单类别」，`evaluatePhaseTransition`（`transition.ts:59`）判定语义**不变**；MUST NOT 因对齐新增阶段阻塞门（破坏门预算）。`PhaseSpec` / `GateSpec` 结构不变（`anchors` 只存在于 `GateWhitelistEntry`，不是 `GateSpec` 的字段）。
- **`.iagent/rules/coding-rules.md` 豁免口径**：父编排已完成实现桥 → 子技能不再重复确认（**仅在 tasks 中列为任务，本阶段不写规则文件**）。
- `auto-workflow` / `debug` / `migration` / `spec-*` 补「MUST NOT 确认清单」段。

### ⑥ 多 agent 数据共享：同变更两批次（DEC-6，N8）

**批次一（低风险、补最大空白）**

- `debug` 补派发能力（`SUBAGENT_DISPATCH`）；修复循环改为**按派发单元并发**（每 bug 一个修复单元，同文件重叠串行），回执改为四列 `<bug id> | <状态> | <产出文件> | <公开签名>`。
- 46KB 内联探查摘要**升格为 handoff 包的前置来源**：`investigation-digest` 作为包 `## Codebase 摘要` 节的来源，语义衔接而非重复探查。
- 沿用既有 `⛔ EXIT GUARD`（完成即停、四列回执），子代理 MUST NOT 推进阶段。

**批次二（token 收益最大）**

- `context-pack` 泛化为**变更级 handoff 包**：`.openspec-tmp/pipeline-<change-name>/handoff-pack.md`（`gitignore` 已覆盖，**不进入提交面**）。
- **propose 产出**（制品定稿后一次性），verify / apply / archive **只读并追加 `## 阶段结论`**；六节不变（变更摘要 / 契约 / 规范要点 / 文件归属表 / Codebase 摘要 / 已产出）。
- **指纹校验**：包头部记录制品指纹，阶段入口比对；不一致即重建（不得静默使用陈旧包）。
- `spec-apply` 工作区语义由「apply 级」改为「流程级」：独立调用 apply 时若无包，按同一六节协议产出一次；`.openspec-tmp/` 清理逻辑同时识别 `pipeline-` 与旧 `apply-` 前缀（迁移期兼容）。
- `auto-workflow` / `workflow` / `migration` 改为**引用** handoff 包，删除各自的重复内联；`.iagent/rules/spec.md` 第 8 条扩写（**任务项，本阶段不改规则文件**）。
- 目标：跨阶段 6 × 45KB ≈ 150k → ≈ 37k tokens。

### 版本与配套（**BREAKING**）

- `package.json` `version` **1.0.2 → 2.0.0**（依据 `AGENTS.md` 版本递增表：删命令 / 删依赖 / 删能力 / 改产物契约 → major）。
- `CHANGELOG.md` 把 `[Unreleased]` 归档为 `## [2.0.0] - 2026-10-26`（含 `### BREAKING`、`### Added`、`### Changed`），保留空 `[Unreleased]`，同步底部链接引用。
- `README.md` 版本引用（`:18`、`:25`、`:76`）同步；`AGENTS.md` 仓库地图与项目约定同步（删 `sql.js` / `sqlite-index` / `markdown-index` / `index-cache` / `reindex` 条目，更新扫描语义、commit 纳管、SQLite 索引相关段落）；`docs/upgrade-guide.md` 补索引退役清理指引。

## Capabilities

### 受影响的能力

| 能力 | 变更类型 | 内容摘要 |
| :--- | :--- | :--- |
| `init-project-scan` | MODIFIED + ADDED + REMOVED | 扫描遍历去上限、忽略清单与 `.gitignore` 解析、30s 软超时与 `skipped` 计数、基线 v2 `limits`、消费侧必须呈现；移除 `index.db 初始化步骤` |
| `sqlite-cross-change-index` | REMOVED（6 条） | 整能力退役：索引初始化 / 归档写入 / 探索查询 / 提案冲突检测 / reindex Markdown 主来源 / 全文结果保留证据 |
| `legacy-install-migration` | MODIFIED（1 条） | 「旧版品牌产物清理」的索引提示改中性（不再指向已删 `reindex`），旧品牌索引库清理与报告语义保留 |
| `artifact-json-sidecar` | MODIFIED（1 条） | 历史 JSON 只读兼容的入口收窄为 `status` 等只读查询（索引操作随 ② 退役） |
| `artifact-markdown-source` | MODIFIED（1 条） | 同上（「生成索引」不再作为只读兼容的产出去向） |
| `agent-tool-identity` | MODIFIED（1 条） | 「品牌命名的磁盘产物」由四类收窄为三类（跨变更索引目录随 ② 退役） |
| `spec-workflow-cli` | MODIFIED + ADDED | `iagent spec reindex` 子命令移除与补全表同步；新增「命令已移除」的 BREAKING 语义（历史 `index.db` 不删除），回归锁范围限定为 `src/**` + `skills/**` 并给出精确白名单 |
| `spec-workflow-skills` | MODIFIED（4 条） | `spec-explore` 能力探测 + 记忆检索仅 N5B；`spec-archive` 按需同步 + 锁阶梯、删除 reindex；`spec-apply` 完成段精确暂存；派发协议改用变更级 handoff 包 |
| `commit-push-skill` | ADDED（2 条） | Git `commit` 技能的提案制品纳入（精确暂存 + 尾行溯源 + 不自动 commit）；`openspec/changes/**` 纳管策略 |
| `tool-call-whitelist` | ADDED + MODIFIED（2 条） | `CODEGRAPH_CLI` 共享常量；调用类条目必须经共享常量构造；对话级确认门改为白名单化口径 |
| `spec-bulk-archive-skill` | MODIFIED（2 条） | 批量预检改能力探测；批量同步改按需 + 锁阶梯（删除无条件 sync） |
| `host-orchestration` | MODIFIED + ADDED | 「Gate and receipt enforcement」增非门直通边界；新增「确认门白名单与门清单对齐」（`evaluatePhaseTransition` 语义不变） |
| `workflow-suite-skills` | MODIFIED（3 条）+ ADDED（2 条） | 门预算与白名单对齐；`auto-workflow`/`migration` 引用 handoff 包；`debug` 流程级摘要升格包来源；新增门白名单 + 直通句；新增 debug 派发与四列回执 |
| `migration-skills` | MODIFIED（1 条） | `migration` 规范要点写入 handoff 包口径 |

**显式不涉及**：`skill-template-language` —— 本变更新增正文全部为中文，未引入英文自然描述句，既有语言回归口径无需调整（无 delta）。

## Impact

### 影响面分析（ADR 风格）

**决策**：六项按「各自可独立 revert」的六个改动簇推进，但 ②（索引移除）与 ④（归档 CodeGraph 段）落在**同一归档段落**，必须同批提交以避免不可运行的中间态。契约面收口在三处单一源：`project-scan.ts`（扫描契约 + v2 `limits`）、`tool-whitelist.ts` + `codegraph-protocol.ts`（白名单与 CodeGraph 口径）、`prompt-gate.ts`（门白名单与门协议文本）。风险定级：② 为 **HIGH**（删代码 + 删依赖 + 删能力），①④⑤ 为 **MEDIUM**（契约与授权面变更，下游需核对），③⑥ 为 **MEDIUM/LOW**（模板正文与新增临时制品）。

**d1 直接调用方（按编排器实测口径的调用点计数，逐项处置见 tasks「Caller Updates」）**

| 改动簇 | 调用点 | 说明 / 处置 |
| :--- | :--- | :--- |
| ② 索引移除（HIGH） | `initDatabase` **7 调用**（`src/commands/spec.ts`、`src/commands/init.ts`、`sqlite-index.ts` 内部 `recreateDatabase`、`test/sqlite-index.test.ts` ×4、`test/markdown-index.test.ts`）；`CapabilityIndexEntry` **8**、`ChangeIndexEntry` **5**、`RequirementIndexEntry` 调用集中在 `spec.ts`；`indexChangeJsonEntry` **1 调用**；测试 `test/sqlite-index.test.ts`、`test/markdown-index.test.ts`、`test/spec-commands.test.ts`（`MemoryBackend` 唯一剩余引用方）；`legacy-migration.ts` 的 `reindex` 提示文案 | 被调函数整模块删除 → 调用点**全部删除**；`recreateDatabase` / `isSqlite3Available` / `resolveIndexDb` 同批清除；三个测试文件/段删除或改写（`spec-commands` 只删 reindex 段）；旧装机提示改中性 |
| ① 扫描（MEDIUM） | `scanProject` **4 调用**（`src/commands/init.ts`）、`renderScanReport` **3**（`src/cli/index.ts`）、`writeScanBaseline` **2**、`walkDir` **1**；`SCAN_BASELINE_FILE` **3 调用，含 `src/core/legacy-migration.ts`** | 函数签名保留（`options` 去掉 `maxDepth`/`maxFiles`，新增 `softTimeoutMs` / `respectIgnoreFiles`）；`renderScanReport` 改 v2 渲染；**`legacy-migration.ts` 的基线搬移只依赖文件名常量，改名前必须核对**（本变更**不改** `SCAN_BASELINE_FILE` 文件名，仅改内容 schema，故迁移逻辑不需改，需加断言测试） |
| ⑤ 确认门（MEDIUM） | `WORKFLOW_PROTOCOLS` / `GateSpec` **2 调用**（`src/core/host-orchestration/index.ts`）；测试 `test/allowed-tools.test.ts`、`test/claude-host-adapter.test.ts`、`test/host-orchestration.test.ts`；`evaluatePhaseTransition` **3**、`renderHostOrchestrationSection` **3**、`renderDelegate` **4** | 协议**只增常量与映射**，`PhaseSpec` 结构不变、`evaluatePhaseTransition` 判定不变；渲染函数签名不变，新增段落文本 |
| ④ CodeGraph（MEDIUM） | `CODEGRAPH_MCP` **11 调用**、`skillDelegation` **17**、`SUBAGENT_DISPATCH` **7**（`test/tool-whitelist-constants.test.ts` 守护）；`CODEGRAPH_PACKAGE` 在 `src/core/dependencies.ts` | 新增 `CODEGRAPH_CLI` 常量与引用；`CODEGRAPH_PACKAGE`（依赖安装口径）**不变**；白名单条目只增不删（除 debug 新增派发条目） |
| ⑥ 数据共享（LOW） | `BATCH_SCHEDULING_FULL` **1 定义 + 1 引用**（`spec-apply.ts:8` / `:533`）；**既有断言在 `test/subagent-resource-sharing.test.ts:43-63`（A1 硬断言 `context-pack.md` + `apply-<change-name>`）与 `test/markdown-first-regression.test.ts:52-59`（硬断言 `context-pack.md`）** | 正文改写（包路径 + 新增 `## 阶段结论` 节）；**两个测试文件的既有断言必须同批改写**（任务 6.10 / 6.12），否则 8.1 必红 |
| ⑤⑥ 规则常量（本轮补充） | `RULE_CONSTANT_LINES.impl`（`project-config.ts:202`「设计先行」）/ `.spec`（`:216` `context-pack` 行） | init/update 用这两个常量**重组** `.iagent/rules/*.md` 的常量块（`composeRuleFileContent`），且 `.iagent/` 已被 gitignore → 只改本地规则文件会在下次 init/update 被覆盖、对用户零生效；MUST 改常量（任务 4.5 / 6.8） |

**其它契约点**：

- **产物契约**：`scan-baseline.json` 由 `version: 1` → `2`；旧消费方只读 `signals`/`candidates`/`failures` 与 `hit`/`detail` → 兼容；读 `maxDepth`/`maxFiles` 者失效（本仓库无此消费方，`project-init` 现未读 `limits`）。
- **CLI 面**：`iagent spec` 子命令由 9 项降至 8 项（`new` / `status` / `migrate` / `validate` / `instructions` / `archive` / `render` / `sidecar`），补全表与 `AGENTS.md` 命令清单同步。
- **依赖面**：`sql.js` 移除；`node_modules` 树变化，`pnpm install` 需重跑（发布前验证）。
- **仓库约定**：`openspec/changes/**` 从忽略转为纳管（`.gitignore` 由 `openspec/` 整目录改为「`openspec/*` + `!openspec/changes/` + 缓存目录再排除」的规则链；`archive/**` 一并纳管、`attachments/**` 与 `.openspec-tmp/**` 排除、`explorations/**` 与 `specs/**` 等保持忽略），`AGENTS.md`「项目约定」段与白名单三层表同步。
- **临时制品**：新增 `.openspec-tmp/pipeline-<change>/`（已忽略，不入提交面）；清理逻辑同时识别旧 `apply-` 前缀。
- **本机产物边界**：`.iagent/`、`skills/` 快照、dogfood 产物不入库规则不变；`skills/` 快照须重生成（`pnpm build && pnpm generate:skills`）。
- **探索文件位置**：`openspec/explorations/iagent-workflow-efficiency-upgrade-explore-001.md` **保持原位**（`delegated` 模式下探索文件路径由父编排持有并作为回执字段，迁移会破坏其可寻址性；制品内以「语义来源」引用该路径，不复制第二份真源）。

### 版本递增与发布处置

**BREAKING**（删除 `iagent spec reindex` 命令、删除 `sql.js` 依赖、删除 `sqlite-cross-change-index` 能力、扫描基线产物契约 v1→v2、`openspec/changes/**` 纳管约定变更）→ **major：1.0.2 → 2.0.0**。

- `CHANGELOG.md`：`[Unreleased]` 归档为 `## [2.0.0] - 2026-10-26`，`### BREAKING` 逐条明示三删一改；底部链接引用同步。
- `README.md`：`iagent --version` 示例与 `npx mi-agent-tools@<version>` / `npm install --save-dev mi-agent-tools@<version>` 三处版本号同步。
- `docs/upgrade-guide.md`：新增「索引退役」小节（历史 `index.db` 不删除、如何外部打开、何时可安全清理）。
- `AGENTS.md`：仓库地图删 4 个索引文件条目**并新增 `scan-ignore.ts` / `codegraph-protocol.ts` 条目**、删 `sql.js` 与 `reindex` 提及；修改守则第 2 条的**白名单三层表**（`Bash(codegraph:*)` 归入「调用类」，经 `CODEGRAPH_CLI` 共享常量构造 —— 否则与「技能专有 `Bash(...)` MUST NOT 扩大」冲突）；项目约定更新扫描语义、commit 纳管（含 `.gitignore` 规则链）、handoff 包与 Markdown-first 段落中的索引描述。
- `docs/project/**` 与根 `CONTEXT.md`：知识文档与术语表删除 `sql.js` / `sqlite-index.ts` / `sqlite-memory-backend.ts` / `MAX_SCAN_DEPTH` 的现存描述（任务 7.9）。

### 风险与回滚（摘录，完整表见 design）

| 簇 | 破坏性 | 等级 | 回滚 |
| :--- | :--- | :--- | :--- |
| ② | 删命令 / 删依赖 / 删能力 | **BREAKING** | `git revert` 整批；历史 `index.db` 不在删除范围 |
| ① | 基线 v1→v2 | **BREAKING**（产物契约） | 按 `version` 判别回退读取；完全回滚 = 恢复两个常量与 `depthLimited`/`filesLimited` 分支（改动集中单文件） |
| ③ | 纳管 `openspec/changes/**` | **BREAKING**（仓库约定） | 恢复 `.gitignore` + `git rm -r --cached openspec/changes` |
| ④ | 去 sync / unlock 误删活跃锁 | MEDIUM / HIGH | 保留「无 daemon 按需 sync」条件句；`writer.pid` 存活禁止 unlock |
| ⑤ | 白名单写漏致业务门消失 | HIGH（流程安全） | 正向枚举 + 生成期文本断言（写漏只会多留门） |
| ⑥ | 包陈旧致下游失真 | MEDIUM | 指纹校验 + 包缺口回执（包是蒸馏视图非替代品） |

### 非目标

- 不改 `SKILL_TYPES`（9 类不变）、不改 `parseProjectConfig` 契约、不引入新的技能类型或技能数量（仍 20 个）。
- 不恢复 `git-first` 枚举（Q1=D 已否决该方案）。
- 不把任何确认门改成自动通过：5 类必留门与 `commit` 人工闸均保留。
- **不生成需求文档**（文档桥属父流程）、**不修改 `.iagent/rules/*`**（规则文件与 `AGENTS.md`、CHANGELOG、README 为 apply 阶段任务）。
- 不做 `skill-template-language` 调整（无语言一致性影响）。
