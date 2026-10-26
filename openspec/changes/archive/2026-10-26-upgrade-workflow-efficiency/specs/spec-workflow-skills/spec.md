# spec-workflow-skills 增量规格

## MODIFIED Requirements

### Requirement: spec-explore 探索技能

spec-explore 技能 SHALL 实现探索立场工作流：CodeGraph **能力优先探测**（任一通道可用即视为可用：MCP 具名工具 → `codegraph_explore` 的时效横幅 → CLI `status --json`；「工具名缺失」≠「索引不可用」；三条通道均不可用时才回退 Glob/Grep）、结构化探索文件持久化（`openspec/explorations/<keyword>-explore-<seq>.md`）、CONTEXT.md 术语表启动检查、只读不写代码；首次写操作前 MUST 以 yes/no 形式向用户单独确认（确认范围仅限命名的文件、回答设计问题≠同意写入）；用户可能已编辑的依赖文件 MUST 在使用前 re-read from disk；材料性歧义（影响范围/行为/兼容性/验收）MUST 必问，小细节可合理假设并记录。

技能 SHALL 在**历史探索记忆检索**时使用**唯一路径**：Glob `openspec/specs/<capability>/explorations.md`，读取能力级历史 Decisions / 术语 / 边界场景 / Codebase Findings。MUST NOT 查询任何 SQLite 索引或 `index.db`（跨变更索引已退役），MUST NOT 因该文件缺失而阻塞探索（记录「无能力级探索记忆」后继续）。

技能 SHALL 在 `Input` 段之后、进入思考伙伴立场（`The Stance`）之前接入**提示词校验门**，且 MUST 以**条件触发**方式接入——本门的加入 MUST NOT 把该技能改造为固定步骤流程，其"没有固定步骤、没有强制产出"的定位保持不变。触发条件与行为：输入清晰（目标、对象、范围均明确且无实质歧义）时，MUST NOT 输出校验表格、MUST NOT 要求确认，直接进入思考伙伴模式；输入含糊或多义（对象不可定位、存在多个候选对象、只有笼统动词、或存在影响范围/行为契约/验收的实质歧义）时，SHALL 执行提示词优化——遵守"不篡改用户原始意图"（只做结构化与约束补全，MUST NOT 擅自增加用户未提出的需求）、推断内容标 `[推断]`、无法推断内容标 `[待确认]`、输出 `【优化后提示词】` 与 `【优化说明】`，并**阻塞等待用户确认或修改**后才继续探索；用户拒绝优化时记录原始提示词按其原有理解继续；用户在门上明确授权按推断继续时，将全部推断项标 `[推断]` 并记入基线后继续探索，MUST NOT 反复要求确认或陷入等待确认的死循环。本门复用 `src/core/templates/prompt-gate.ts` 单一源（见 workflow-suite-skills 的「提示词校验门共享模块」需求），维度取需求六维（目标/对象/范围/约束/验收/歧义），软不明确（仅细节级歧义）沿用本技能既有的"合理假设并记录"处理，不进入优化分支。校验产出的提示词基线 SHALL 在探索产物中落盘为 `## 提示词基线` 段（含原始提示词与确认后的基线）；本技能不设强制产出文件，无探索文件时基线仅保留在会话中，并在创建/关联探索文件时写入。

门的入口适配 MUST 覆盖本技能的不同入口形态：**无输入**（仅进入探索模式，无可校验提示词）时 SHALL 跳过本门并直接进入探索立场，MUST NOT 因缺少输入而要求用户先提供提示词；**输入为变更名**（如 `/iagent:spec-explore <change-name>`）时 SHALL 以该变更的既有制品（proposal / design / specs / tasks）为校验对象，MUST NOT 把变更名本身当作需求提示词评估清晰度；**输入为比较型或问题型表述**时按需求六维正常判定。

技能 SHALL 以**条件触发**方式产出**功能流程图**，MUST NOT 因本制品的加入把该技能改造为固定步骤流程：探索中浮现**明确的业务功能流程**时，SHALL 将流程固化为探索产物的 `## 功能流程图` 段——Mermaid 流程图（`flowchart TD`）加关键操作节点清单表（节点 / 操作 / 触发条件 / 证据位置 / 异常路径），节点 id（`N<序号>`）在两处 MUST 稳定一致；节点 SHALL 为可独立验证的业务操作单元，每节点 MUST 含证据位置（既有代码标 `文件:行`，新建功能标 `[新建]` + 预期产物），MUST NOT 让无法追溯证据的节点进入清单。产出后 SHALL 执行**流程最终确认门**（四出口模型：确认 / 修改 / 拒绝后按原理解继续 / 显式授权按推断继续，MUST NOT 死锁），确认后成为 propose / verify 的**流程基准**。探索为**纯概念探讨或无业务功能流程**时，SHALL 在探索产物中记录「本次无功能流程」并**直接继续**，MUST NOT 因此阻塞探索。本制品复用 `src/core/templates/flowchart-gate.ts` 单一源（见 workflow-suite-skills 的「功能流程图共享模块」需求）。

本技能的**只读动作**（CodeGraph 探测与查询、历史记忆检索、Glob/Grep/Read 扫描、`iagent spec status` 查询）MUST NOT 请求用户确认，MUST NOT 以「是否继续探索」类询问打断流程；确认只发生在提示词门、流程图门与首次写操作三类点。

#### Scenario: CodeGraph 能力探测先于回退

- **WHEN** spec-explore 技能启动基础扫描
- **THEN** 技能按「MCP 具名工具 → `codegraph_explore` 时效横幅 → CLI `status --json`」顺序探测，任一通道可用即使用 CodeGraph，全部不可用才回退 Glob/Grep/Read 并记录降级说明

#### Scenario: 工具名缺失不判定索引不可用

- **WHEN** 宿主只挂载 `codegraph_explore` 而未提供 `codegraph_status`
- **THEN** 技能 MUST NOT 判定 CodeGraph 不可用，也 MUST NOT 因缺少某具名工具而中止探测；改用可用通道继续

#### Scenario: 历史记忆仅走能力文件

- **WHEN** 探索涉及既有能力且需要检索历史探索记忆
- **THEN** 技能 Glob `openspec/specs/<capability>/explorations.md` 读取历史要点，MUST NOT 查询 SQLite 索引或 `index.db`

#### Scenario: 能力记忆文件缺失不阻塞

- **WHEN** `openspec/specs/<capability>/explorations.md` 不存在
- **THEN** 技能记录「无能力级探索记忆」并继续探索，MUST NOT 因此中止或反复询问

#### Scenario: 探索文件持久化

- **WHEN** 探索过程产出结构化发现（背景/问题/决策/术语）
- **THEN** 写入 `openspec/explorations/<keyword>-explore-<sequence>.md`（sequence 从 001 递增），跨会话可被 spec-propose 关联迁移

#### Scenario: 写入确认守卫

- **WHEN** 探索过程需要执行任何写能力动作（含创建变更、修改 artifact、保存探索文件）
- **THEN** 技能先命名将修改的文件、以 yes/no 形式向用户确认并等待单独回复后才执行；确认范围仅限已命名的文件，不允许 "全部同意" 式笼统授权；用户回答设计问题（讨论方案、澄清需求、解释术语等）不构成对写入操作的同意，写入仍需独立的 yes/no 确认

#### Scenario: 只读动作不请求确认

- **WHEN** 技能执行 CodeGraph 查询、历史记忆检索或 `iagent spec status` 查询
- **THEN** MUST NOT 输出确认询问、MUST NOT 暂停等待用户回复

#### Scenario: 依赖文件 re-read from disk

- **WHEN** 探索过程需要读取用户可能在会话期间编辑过的文件（如 CONTEXT.md、exploration.md、变更 artifact）
- **THEN** 技能在每次使用前重新从磁盘读取最新内容，不依赖会话开始时缓存的版本，避免基于过时内容决策

#### Scenario: 材料性歧义划分

- **WHEN** 探索过程遇到歧义
- **THEN** 影响范围/行为契约/向后兼容性/验收标准的歧义 MUST 表面化并向用户提问（标记 `[待确认]`）；不影响上述方面的细节性歧义可做合理假设并记录假设，避免无限追问

#### Scenario: 条件触发保持探索立场

- **WHEN** 用户以清晰输入进入探索（如"帮我看看 OrderService 的导出逻辑能否支持大数据量"——对象与范围明确、无实质歧义）
- **THEN** 技能不输出六维校验表格、不要求确认、不生成 `【优化后提示词】`，直接以思考伙伴身份进入探索；技能既有的"无固定步骤、无强制产出"定位不变

#### Scenario: 入口形态适配

- **WHEN** 用户不携带任何参数直接进入探索模式（无提示词可校验），或携带变更名进入（如 `/iagent:spec-explore add-auth-system`）
- **THEN** 无参数时技能跳过本门直接进入探索立场，不要求用户先提供提示词；携带变更名时技能先读取该变更的既有制品作为校验与探讨对象，不把变更名当作需求提示词评估清晰度

#### Scenario: 含糊输入激活门并阻塞确认

- **WHEN** 用户以含糊输入进入探索（如"看看能不能优化一下"——目标与对象均不可定位）
- **THEN** 技能先执行提示词优化并输出 `【优化后提示词】`（含 `[推断]` / `[待确认]` 标注）与 `【优化说明】`，阻塞等待用户确认或修改后才开始探索；在用户确认前不进行代码库扫描与需求澄清追问

#### Scenario: 浮现业务功能流程时产出并确认

- **WHEN** 探索中浮现明确的业务功能流程（如探索导出功能时梳理出"选择范围 → 点击导出 → 数据量判定 → 分批查询 → 生成文件"的完整链路）
- **THEN** 技能产出 `## 功能流程图` 段（Mermaid 流程图 + 节点清单表，节点 id 稳定一致、每节点含证据位置），并执行流程最终确认门等待用户确认；确认后该流程图成为流程基准

#### Scenario: 无业务功能流程时直通不阻断

- **WHEN** 探索为纯概念探讨或未浮现明确的业务功能流程（如"帮我想想这个模块该怎么分层"）
- **THEN** 技能在探索产物中记录「本次无功能流程」并直接继续探索，MUST NOT 因此阻塞、MUST NOT 为凑制品而虚构流程节点

#### Scenario: 流程最终确认门不陷入死锁

- **WHEN** 用户在流程最终确认门上拒绝确认或明确不表态
- **THEN** 技能记录原始流程图与未确认状态后继续探索，MUST NOT 反复要求确认；该未确认状态随探索产物传递，propose 降级为仅凭 exploration.md、verify 节点覆盖度维度 SKIP

### Requirement: spec-archive 归档技能

spec-archive 技能 SHALL 实现归档工作流：检查 CONTEXT.md 术语同步（不存在则创建）→ 从变更的 exploration.md 提取决策/术语/边界场景并追加到 `openspec/specs/<capability>/explorations.md`（冲突标记"已过时"但保留历史）→ 执行状态感知的预归档需求文档检查点 → AI 智能合并 delta spec 到主 spec（ADDED/MODIFIED/REMOVED/RENAMED）→ 调用 `iagent spec archive` 移动目录 → 迁移需求文档至 devdocs → CodeGraph **按需**同步（失败仅 WARN、不阻断）。

**MUST NOT** 调用 `iagent spec reindex` 或任何索引重建（索引已退役，归档不含索引步骤）。

**CodeGraph 段 SHALL 采用能力探测 + 锁阶梯**：先按「MCP 具名工具 → 可用通道 → CLI `status --json`」探测可用性；需同步时读 `.codegraph/` 下的 `writer.pid` 判存活——**存活则只读复用**既有索引并 MUST NOT 执行 `codegraph unlock`；**不存活才** `codegraph unlock` + 重试一次；仍失败则降级 Glob/Grep 并记录 WARN。仅当确认**无 daemon**（纯 CLI 用户）时才执行一次 `codegraph sync`；daemon 活跃时 MUST NOT 显式 sync（同步责任归 daemon 文件监听）。全流程 MUST NOT 询问用户是否重试（沿用既有「任何错误不询问用户」口径）。

预归档需求文档检查点 SHALL 在探索记忆同步之后、目录移动之前执行，范围仅为变更目录内 `需求文档.md`，并同时读取该变更 `exploration.md` 的 `## 需求文档状态` 段（字段 `requirementDocStatus`，取值 `skipped-by-user` / `generation-failed` / `generated`，无该段为 `absent`；定义见 `host-orchestration / 需求文档状态跨阶段 handoff`）。持久记录用于跨会话 archive；回执缺失时仍须读取持久记录。

- **文档已存在（任何状态）**：对 `## 基本信息` 与 `## 八、评审记录` 人工域逐字保护，对第一至七章按当前制品就地增量对齐；MUST NOT 调用会静默覆盖目标文件的 `iagent_requirement_doc`。文件存在优先于状态，`skipped-by-user` 亦同。
- **状态为 `skipped-by-user` 且文档缺失**：报告用户已选择跳过并继续归档，MUST NOT 自动生成。
- **状态为 `generation-failed` 且文档缺失**：输出 WARN 并继续归档，MUST NOT 静默重试生成。
- **状态为 `generated` 且文档缺失**：输出 WARN（"曾生成但文件缺失"）并继续归档，MUST NOT 重新生成。
- **没有显式需求文档状态（`absent`）的历史变更且文档缺失**：保留既有向后兼容行为，非交互委派 `iagent_requirement_doc`。
- **状态或文档存在性读取 I/O 失败**：MUST 自动重试同一读取一次；仍失败时 MUST NOT 视为 `absent`、MUST NOT 生成文档（文档存在时仍按已存在分支对齐），输出含目标路径与原因的 WARN 与恢复指引并继续归档。
- 生成、对齐或检查失败 SHALL 记录 WARN（含原因）并继续归档；不得因需求文档操作而静默宣称成功。

生成落点仍为变更目录内的 `需求文档.md`；目录归档后由既有迁移步骤原样移动至 `openspec/devdocs/`。

技能的 `allowedTools` SHALL 覆盖正文实际发起的调用：正文经 Bash 运行 `codegraph` CLI（`status` / `unlock` / 条件 `sync`）时 MUST 含共享常量 `CODEGRAPH_CLI`（`Bash(codegraph:*)`），MUST NOT 只写 MCP 条目。

#### Scenario: 用户跳过且文档缺失时不补生成

- **WHEN** archive 读取到 `skipped-by-user` 且变更目录内没有 `需求文档.md`
- **THEN** 输出跳过说明、MUST NOT 调用 `iagent_requirement_doc`，并继续归档

#### Scenario: 用户跳过但文档已存在时对齐

- **WHEN** 状态为 `skipped-by-user` 且变更目录内已有需求文档
- **THEN** archive 就地增量对齐第一至七章，逐字保留 `## 基本信息` 与 `## 八、评审记录`，MUST NOT 调用会覆盖文件的生成技能

#### Scenario: 生成失败状态不静默重试

- **WHEN** archive 读取到 `generation-failed` 且需求文档缺失
- **THEN** 输出 WARN 并继续归档，MUST NOT 再次委派 `iagent_requirement_doc`

#### Scenario: 已生成状态但文档缺失不重建

- **WHEN** 状态为 `generated` 且变更目录内不存在 `需求文档.md`
- **THEN** 输出含原因的 WARN（"曾生成但文件缺失"）并继续归档，MUST NOT 重新委派 `iagent_requirement_doc`

#### Scenario: 状态读取重试一次后失败不落入兼容生成

- **WHEN** 检查点读取 `## 需求文档状态` 首次失败且自动重试一次仍失败
- **THEN** 系统 MUST NOT 按 `absent` 处理、MUST NOT 委派生成；文档缺失时输出 WARN 与恢复指引并继续归档

#### Scenario: 历史变更无状态时兼容生成

- **WHEN** 既有历史变更没有显式需求文档状态且需求文档缺失
- **THEN** archive 保留既有兼容行为，非交互委派 `iagent_requirement_doc`；失败记录 WARN 后继续

#### Scenario: 文档存在时人工域受保护

- **WHEN** archive 对任一状态的变更发现需求文档已存在
- **THEN** `## 基本信息` 与 `## 八、评审记录` 逐字不变，第一至七章按当前制品增量对齐，不删除章节（仅制品已移除的内容可删）

#### Scenario: archive 单独调用时读取持久状态

- **WHEN** 用户在另一个会话或稍后单独调用 archive，调用回执未携带文档选择状态
- **THEN** archive 从变更 `exploration.md` 读取持久状态并按其分流，不因新会话而退回历史兼容生成分支

#### Scenario: 需求文档处理失败不阻断归档

- **WHEN** 需求文档增量对齐或历史兼容生成失败
- **THEN** 技能输出包含原因的 WARN 并继续目录归档，MUST NOT 丢失归档结果或伪报文档已对齐

#### Scenario: 探索记忆同步

- **WHEN** 变更含 exploration.md 且其 Decisions 与能力级 explorations.md 的既有决策冲突
- **THEN** 旧决策标记为"已过时（由 <change-name> 取代）"保留，新决策追加，历史不被删除

#### Scenario: delta spec 智能合并

- **WHEN** 变更的 specs/<capability>/spec.md 含 ADDED 与 MODIFIED 需求
- **THEN** 技能将 ADDED 需求追加到主 spec、MODIFIED 需求更新对应条目，再执行 iagent spec archive 移动

#### Scenario: 归档不含索引重建

- **WHEN** archive 完成目录移动与需求文档迁移
- **THEN** 流程中 MUST NOT 调用 `iagent spec reindex`，也 MUST NOT 读写任何 `index.db`

#### Scenario: daemon 活跃时不同步也不解锁

- **WHEN** 归档 CodeGraph 段检测到 `writer.pid` 指向的进程仍存活
- **THEN** 技能只读复用既有索引，MUST NOT 执行 `codegraph sync`、MUST NOT 执行 `codegraph unlock`

#### Scenario: 无 daemon 时按需同步一次

- **WHEN** 归档检测到无 daemon 且需要在归档后更新索引
- **THEN** 技能经 CLI 执行 `codegraph sync` 恰一次；失败仅 WARN，不阻断归档

#### Scenario: 锁阶梯失败降级 Grep

- **WHEN** `writer.pid` 不存在、`codegraph unlock` 后重试一次仍失败
- **THEN** 技能降级为 Glob/Grep 并记录 WARN，继续完成归档，MUST NOT 询问用户

#### Scenario: CodeGraph 同步失败非阻塞

- **WHEN** CodeGraph 任一步骤执行失败
- **THEN** 输出 WARN 日志继续完成归档流程，不回滚

### Requirement: spec-apply 实现技能

spec-apply 技能 SHALL 实现规格驱动实现工作流：优先通过 `iagent spec instructions apply --change <name> --json` 获取任务上下文（contextFiles / progress / dynamic instruction），命令不可用（旧版 CLI）时回退直接读变更目录文件 → 实现前呈现设计蓝图等待用户 "确认"（设计确认门）→ 按任务标签（[代码]/[测试]/[DB脚本]/[使用说明]）实现并勾选 tasks.md（仅当规格行为完整实现才可勾选 `- [x]`，部分完成或推迟不算）→ 实现后执行编译检查（tech stack 检测 + autoFix 最多 3 次重试）→ 编译检查通过后执行**测试执行关卡**；发现需要缩小/推迟/简化规格行为以让任务通过时 MUST 表面化并询问，禁止默默缩减。

`[测试]` 任务 SHALL 委派 `iagent_test` 技能生成测试代码，MUST NOT 在 apply 内另立一套测试规则。测试任务与实现任务存在依赖时 MUST 串行执行（测试依赖实现完成）。

**测试执行关卡**：技能 SHALL 在编译检查之后运行本次变更范围内的测试——`[测试]` 任务产出的测试文件加上变更文件的对应既有测试。存量失败测试 MUST NOT 阻塞流程，仅以 WARN 展示；变更范围内的测试失败 MUST 进入失败处置分支。项目无测试框架时关卡 SHALL 降级为 WARN 并跳过，MUST NOT 阻塞流程。

**完成段（提案制品暂存）**：全部任务完成并通过测试关卡后，技能 SHALL 检测活跃变更并对**提案制品**执行**精确暂存**——清单固定为该变更目录下的 `proposal.md` / `design.md` / `tasks.md` / `exploration.md` / `specs/**/*.md`，逐条校验前缀 `openspec/changes/<change-name>/`，MUST NOT 使用 `git add -A` 或 `git add openspec`，MUST NOT 纳入 `attachments/**` 与 `需求文档.md`。暂存后 SHALL **提示**用户提案制品已暂存并给出建议的提交信息尾行 `提案: <change-name>`，MUST NOT 自动执行 `git commit`（人工闸保留）。仓库未跟踪 `openspec/` 或暂存失败时 SHALL 只记录 WARN 并提示手动处理，MUST NOT 阻断实现收尾。

#### Scenario: 设计确认门

- **WHEN** spec-apply 获取到待实现任务清单
- **THEN** 技能呈现统一批次计划（任务分组/复杂度/涉及文件）并暂停等待用户显式 "确认" 后才开始写代码

#### Scenario: 任务上下文获取

- **WHEN** spec-apply 启动并需要获取任务清单与上下文
- **THEN** 技能优先运行 `iagent spec instructions apply --change <name> --json`，从返回的 contextFiles（artifact→文件路径映射）/ progress / 动态 instruction 获取结构化任务上下文；命令不存在或执行失败（旧版 CLI 不支持）时回退为直接读变更目录文件（tasks.md / proposal.md / specs/ / design.md），并在日志记录回退原因

#### Scenario: 任务勾选推进

- **WHEN** 一个任务的规格行为完整实现（不是部分完成或推迟）
- **THEN** 对应 tasks.md 条目从 `- [ ]` 更新为 `- [x]`；部分完成或推迟的实现 SHALL NOT 勾选 `- [x]`

#### Scenario: scope-creep 防护

- **WHEN** 实现过程中发现需要缩小、推迟或简化规格行为才能让某任务通过
- **THEN** 技能 MUST 将发现表面化（标记 `[待确认]` 并说明差异）向用户询问，SHALL NOT 默默缩小/推迟/简化规格行为以让任务勾选通过；用户确认后须同步更新 proposal/specs/design 才可继续

#### Scenario: 编译检查

- **WHEN** 全部代码任务实现完成
- **THEN** 技能检测 tech stack 并运行对应编译/lint 检查，失败时自动修复重试（上限 3 次），仍失败则呈现 [查看详细]/[手动修复]/[跳过] 选项

#### Scenario: [测试] 任务委派测试生成技能

- **WHEN** 批次命中带 `[测试]` 标签的任务
- **THEN** 技能委派 `iagent_test`（传测试层级与优先级）生成测试代码，不在 apply 内自行实现测试规则

#### Scenario: [测试] 任务不按补充文档路由

- **WHEN** 处理带 `[测试]` 标签的任务
- **THEN** 技能 MUST NOT 将其归入补充文档类别，MUST NOT 按 `产出:` 默认路由把测试文件写入 `<changeRoot>/attachments/`；测试代码 SHALL 由测试生成技能按项目测试目录结构落盘

#### Scenario: 未标注任务仍按代码实现处理

- **WHEN** 任务无任何类型标签
- **THEN** 技能沿用既有行为按代码实现处理（向后兼容不变）

#### Scenario: 测试执行关卡运行变更范围

- **WHEN** 编译检查通过且变更范围内存在测试
- **THEN** 技能运行变更范围测试（`[测试]` 任务产出 + 变更文件的既有测试），通过后进入收尾

#### Scenario: 存量失败测试不阻塞

- **WHEN** 测试执行关卡中变更范围外的既有测试失败
- **THEN** 技能仅输出 WARN 展示该类失败，不计入本次失败，不阻塞流程

#### Scenario: 变更范围测试失败处置

- **WHEN** 变更范围内的测试失败
- **THEN** 技能进入失败处置分支（自动修复重试上限 3 次）；仍失败则暂停并报告用户，MUST NOT 勾选对应任务、MUST NOT 进入归档

#### Scenario: 项目无测试框架时降级

- **WHEN** 项目未配置任何测试框架
- **THEN** 测试执行关卡降级为 WARN 并跳过，不阻塞流程

#### Scenario: 测试任务与实现任务的依赖串行

- **WHEN** 某 `[测试]` 任务的被测实现属于同批次另一任务
- **THEN** 技能将该 `[测试]` 任务置于实现任务之后的批次串行执行，MUST NOT 与实现任务并发

#### Scenario: 完成段精确暂存提案制品

- **WHEN** apply 全部任务完成并通过测试关卡
- **THEN** 技能对 `openspec/changes/<change-name>/` 下的 proposal / design / tasks / exploration / specs 逐条执行 `git add <精确路径>`，并提示建议提交信息尾行 `提案: <change-name>`

#### Scenario: 暂存不使用全量添加

- **WHEN** 技能构造暂存清单
- **THEN** MUST NOT 使用 `git add -A` / `git add openspec`，MUST NOT 纳入 `attachments/**` 与 `需求文档.md`

#### Scenario: 暂存后不自动提交

- **WHEN** 提案制品暂存成功
- **THEN** 技能 MUST NOT 执行 `git commit`，人工确认与提交动作仍由用户（或 commit 技能）发起

#### Scenario: 暂存失败不阻断收尾

- **WHEN** 仓库未跟踪 `openspec/` 或暂存命令失败
- **THEN** 技能记录 WARN 并提示手动处理，实现收尾与后续归档 MUST NOT 被阻断

### Requirement: spec-apply 派发协议与共享资源协议

`iagent_spec_apply` SHALL 在批次调度中建立**共享资源协议**，使每个子代理的上下文消耗与派发单元数解耦：协调者一次性产出共享制品，子代理只读共享制品而非各自重读变更制品。

**派发协议（补齐既有规格缺口）**：批次由**派发单元**构成 —— 同一 `group` 标签的任务聚为一个单元，单元内任务由同一子代理按序串行实现。技能 SHALL 每单元派发一个子代理（Agent/Task 工具），同时运行的子代理数 MUST NOT 超过 `openspec/config.yaml` 的 `apply.concurrency`（缺省 3，非法值回退 3 并告警），并 SHALL 采用滑动窗口派发。跨派发单元会修改同一文件的任务 MUST 从并发组拆出串行执行。运行时不提供子代理分派工具时 SHALL 降级为全串行实现并告知用户。任务勾选与失败重试 SHALL 由协调者集中管理，子代理 MUST NOT 修改 tasks.md。

**共享资源协议（四载体）**：

- **变更级 handoff 包**：协调者 SHALL 在**首次派发前**确保流程级工作区 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md` 存在。该包由 propose 阶段产出（跨阶段共享）；独立调用 apply 且包不存在时，技能 SHALL 按同一六节协议产出**一次**。六节为 —— `## 变更摘要`（proposal Why/What 蒸馏）、`## 契约`（接口签名 / 数据结构 / 表字段，由 specs + design 蒸馏）、`## 规范要点`（**项目侧** `.iagent/rules/coding-rules.md` 的关键防护摘要，协调者蒸馏一次；该文件为 `openspec/rules/ai-coding.md` 要点经 `iagent init` 蒸馏的产物）、`## 文件归属表`（派发单元 → 允许改动的文件）、`## Codebase 摘要`（协调者预扫描结论；`debug` 场景可复用 `investigation-digest` 结论）、`## 已产出（跨单元可见）`。handoff 包是子代理的**唯一必读制品**；产出后 MUST NOT 整包重产，只允许向 `## 已产出` 与 `## 阶段结论` 追加。
- **产出登记表**：每批完成后协调者 SHALL 向 `## 已产出（跨单元可见）` 节**追加**该批产出文件与公开签名，使后续批次子代理无需重扫代码即可获知前序产出。
- **回执最小化**：子代理回执 SHALL 采用固定格式 `<任务 id> | <状态> | <产出文件> | <公开签名>`，MUST NOT 粘贴代码正文；失败任务回执仍 MUST 含失败原因摘要。协调者 SHALL 据回执更新 tasks.md 与登记表。**「公开签名」定义**：该单元产出中**可被其他单元引用**的符号签名 —— 函数 / 方法 / 类型 / 接口 / 导出常量 / CLI 命令（含参数与返回类型）的声明行；无此类产出时记「无」。
- **共享指令前缀**：调度指令 SHALL 采用固定顺序「共享前缀（包路径 / 规范要点引用 / 回执格式 / 禁止项）→ 单元差异（本单元任务清单）」，使前缀在同一流程内跨派发字节一致。

**调度指令瘦身**：调度指令 MUST 含「handoff 包路径 + 本单元任务清单（含每任务全量细节与 Spec Ref）+ 回执格式 + 禁止项」，MUST NOT 再内联 coding 规范摘要全文（改引用包 `## 规范要点` 节）。任务细节 MUST 保持在指令内联，使子代理无需读 tasks.md。

**禁止项与包缺口回执**：子代理 MUST NOT 重读 proposal/specs/design（包已覆盖）与重跑包已覆盖的 CodeGraph 查询；MAY 查询包未覆盖内容，但回执 MUST 附**包缺口回执**（缺什么、补查了什么），协调者 SHALL 据此回填包，回填失败记 WARN 且 MUST NOT 阻断。包是制品的**蒸馏视图**而非替代品：包缺项时子代理 MUST 补查制品本身，MUST NOT 凭包内容猜测字段或契约。

**一致性校验**：阶段入口 SHALL 比对 handoff 包头部的制品指纹与当前制品；不一致（用户手改制品 / 包陈旧）时 SHALL 重建并记录 WARN，MUST NOT 静默沿用陈旧包。

**工作区生命周期**：`.openspec-tmp/pipeline-<change-name>/` 为**流程级**工作区 —— propose 产出、verify/apply/archive 只读追加、流程收尾统一清理；清理逻辑 MUST 同时识别 `pipeline-` 与旧 `apply-` 前缀（迁移期兼容），清理失败 SHALL 记 WARN 且 MUST NOT 阻断或改变已写入的阶段结论。独立调用 apply 时由该技能自建并在收尾清理。

**fail-safe 降级**：工作区不可写 / 包产出失败 / **项目无 `.iagent/rules/coding-rules.md`** 时，技能 SHALL **退化为既有内联注入行为**并记 WARN，MUST NOT 阻断实现；流程级临时工作区不可写时先回退系统临时目录，再失败方退化。

**批次形态豁免**：批次含少于 2 个派发单元时，协调者 SHALL 直接实现，MUST NOT 派发子代理且 MUST NOT 新产出包（已有 handoff 包仍可只读复用）。`auto-mode=true` 只跳过设计确认门，共享资源协议 SHALL 照常生效。

#### Scenario: 跨阶段复用 propose 产出的包

- **WHEN** apply 被父流程调用且 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md` 已由 propose 产出
- **THEN** 技能直接只读该包并按单元派发，MUST NOT 重新蒸馏 proposal/specs/design，MUST NOT 重产整包

#### Scenario: 独立调用时按同一协议产出包

- **WHEN** 独立调用 spec-apply 且 handoff 包不存在、批次含 ≥2 派发单元
- **THEN** 技能在 `.openspec-tmp/pipeline-<change-name>/` 产出 `handoff-pack.md`（六节齐全）后派发，格式与本协议一致

#### Scenario: 上下文包一次性产出

- **WHEN** 批次含 2 个及以上派发单元且即将首次派发
- **THEN** 协调者确保流程级工作区中存在 `handoff-pack.md`，含变更摘要 / 契约 / 规范要点 / 文件归属表 / Codebase 摘要 / 已产出六节；后续批次 MUST NOT 重产整包

#### Scenario: 流程级工作区收尾清理

- **WHEN** 流程走到 archive 收尾（或 apply 独立调用收尾）
- **THEN** 技能清理 `.openspec-tmp/pipeline-<change-name>/`，并同时识别旧 `apply-<change-name>/` 前缀；清理失败记 WARN，MUST NOT 改写既有阶段结论、MUST NOT 阻断归档

#### Scenario: 指纹不一致时重建

- **WHEN** 阶段入口发现 handoff 包头部指纹与当前 proposal/design/specs/tasks 不一致
- **THEN** 技能重建包并记录 WARN，MUST NOT 静默使用陈旧包

#### Scenario: 阶段结论只追加

- **WHEN** apply 阶段收束
- **THEN** 技能向包追加 `## 阶段结论` 一节（含 phase / status / artifact / nextAllowed），MUST NOT 改写其它阶段已写入的结论

#### Scenario: 调度指令瘦身与唯一必读制品

- **WHEN** 协调者构造某派发单元的调度指令
- **THEN** 指令含包路径、本单元任务清单、回执格式与禁止项，**不含** coding 规范摘要全文；子代理按「读包 + 本单元任务清单」即可开工，无需读 proposal/specs/design

#### Scenario: 产出登记表跨批共享

- **WHEN** 一批的多个派发单元全部返回且协调者完成校验
- **THEN** 协调者把该批产出文件与公开签名追加进包 `## 已产出（跨单元可见）` 节；下一批子代理读包即可获知前序产出，无需重扫代码

#### Scenario: 回执最小化

- **WHEN** 子代理完成其派发单元
- **THEN** 回执为 `<任务 id> | <状态> | <产出文件> | <公开签名>` 四列格式，不含代码正文；失败任务额外含失败原因摘要

#### Scenario: 共享指令前缀字节一致

- **WHEN** 同一流程向内多次派发不同派发单元
- **THEN** 各次调度指令的共享前缀部分（包路径 / 规范要点引用 / 回执格式 / 禁止项）字节一致，仅单元差异部分不同

#### Scenario: 禁止重读与禁止重跑已覆盖查询

- **WHEN** 子代理收到含 handoff 包的调度指令
- **THEN** 子代理 MUST NOT 重读 proposal/specs/design，MUST NOT 重跑包已覆盖的 CodeGraph 查询

#### Scenario: 空值处置不留空不编造

- **WHEN** 变更不涉及接口 / 数据结构 / 表字段，或某派发单元无可被其他单元引用的符号
- **THEN** 包 `## 契约` 节相应位置与回执「公开签名」列记「无」，MUST NOT 留空、MUST NOT 编造签名

#### Scenario: 包缺口回执与回填

- **WHEN** 子代理发现 handoff 包未覆盖其所需信息
- **THEN** 子代理 MAY 补查，但回执 MUST 附包缺口回执（缺什么、补查了什么）；协调者据此回填包，回填失败记 WARN 且不阻断流程

#### Scenario: 包机制失效 fail-safe 降级

- **WHEN** 临时工作区不可写、包产出失败，或项目无 `.iagent/rules/coding-rules.md`
- **THEN** 技能退化为既有内联注入行为并记 WARN，实现流程 MUST NOT 被阻断

#### Scenario: 单任务批次不新产出包

- **WHEN** 批次含少于 2 个派发单元且不存在既有 handoff 包
- **THEN** 协调者直接实现该任务，不派发子代理，不新产出包

#### Scenario: auto-mode 不豁免共享资源协议

- **WHEN** 技能以 `auto-mode=true` 被调用（如 auto-workflow Phase 4）
- **THEN** 设计确认门被跳过，但 handoff 包复用/产出、产出登记表、回执最小化与共享指令前缀均照常生效

#### Scenario: 派发单元与并发上限

- **WHEN** 批次含多个派发单元
- **THEN** 技能每单元派发一个子代理，同时运行数不超过 `apply.concurrency`（缺省 3），并采用滑动窗口派发；`apply.concurrency` 非法（非正整数）时告警并回退为 3

#### Scenario: 跨单元同文件拆出并发组

- **WHEN** 不同派发单元的任务会修改同一文件
- **THEN** 该任务从并发组拆出、串行执行；文件归属表须反映该拆分结果

#### Scenario: 无子代理能力的运行时降级

- **WHEN** 运行时不提供子代理分派工具
- **THEN** 技能降级为全串行实现并告知用户

#### Scenario: 任务勾选与失败重试由协调者集中管理

- **WHEN** 某个派发单元返回
- **THEN** 协调者按任务要求校验结果后集中更新 tasks.md 勾选（仅确认完整实现者勾选），子代理 MUST NOT 修改 tasks.md；某任务失败时协调者串行重试一次，仍失败则暂停并报告
