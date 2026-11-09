## ADDED Requirements

### Requirement: 归档未提交提案检测与纳入

技能 SHALL 在提交前同时检测两类提案候选：`openspec/changes/` 下的活跃变更，以及 `openspec/changes/archive/` 下存在未提交制品的归档提案。归档候选 MUST 在候选中标注「已归档」；活跃与归档同名并存时 MUST 分别列出，MUST NOT 合并为单一候选；归档提案仅部分制品已提交时 MUST 只纳入未提交部分；归档提案无任何 VCS 变更时 MUST NOT 列为候选，用户点名时提示「无需提交」并终止；存在多个归档候选时 MUST 全部列出由用户选择（D3 / D6）。

归档提案的溯源尾行 MUST 使用去掉日期前缀的变更名（`YYYY-MM-DD-<name>` → `<name>`）；归档目录名不符合日期前缀约定时 MUST 原样使用目录名（D5）。

SVN 侧当归档提案被选中或点名时，其未纳管（`?`）的 `openspec/` 制品 MUST 经环节 2 清单确认后 auto `svn add` 并归入文档类；MUST NOT 静默 auto add，MUST NOT 扩展到其他未点名的未纳管制品（D4）。

#### Scenario: 活跃与归档同名提案并存
- **WHEN** 提交前检测同时发现活跃变更 `add-audit-alert` 与归档目录 `2026-11-08-add-audit-alert`，两者均有未提交制品
- **THEN** 两个候选分别列出并标注「活跃」与「已归档」，MUST NOT 合并为单一候选

#### Scenario: 归档提案部分制品已提交
- **WHEN** 归档提案 `2026-11-08-add-audit-alert` 的 `proposal.md` 已提交，`tasks.md` 未提交
- **THEN** 只把 `tasks.md` 纳入提交范围，已提交的 `proposal.md` 不重复提交

#### Scenario: 归档提案无 VCS 变更
- **WHEN** 用户点名归档提案且其目录下所有制品均已提交
- **THEN** 提示「该归档提案无需提交」并终止，不生成空提交计划

#### Scenario: 多个归档候选
- **WHEN** 两个及以上归档提案存在未提交制品
- **THEN** 全部列出供用户选择，MUST NOT 自行决定纳入哪一个

#### Scenario: 溯源尾行去日期前缀
- **WHEN** 提交归档提案 `2026-11-08-improve-orchestration-execution-mode` 的制品
- **THEN** 提交信息尾行为 `提案: improve-orchestration-execution-mode`

#### Scenario: 非日期前缀归档目录
- **WHEN** 归档目录名为 `legacy-change`（无 `YYYY-MM-DD-` 前缀）
- **THEN** 溯源尾行原样使用 `提案: legacy-change`，不做裁剪

#### Scenario: SVN 归档提案未纳管制品
- **WHEN** 用户点名归档提案，其 `proposal.md` / `tasks.md` 处于 `?` 未纳管状态
- **THEN** 制品出现在环节 2 清单中，用户确认后 auto `svn add` 并归入文档类；其他未点名未纳管属性仍默认排除

### Requirement: 三类提交说明统一规范

提案分类提交的每一笔提交说明 MUST 同时写清「改动对象 + 改动内容」两要素（D2）：

- **功能代码 / 测试代码**：沿用【前缀: 一级菜单-二级菜单: 业务描述】或【前缀: 业务描述】格式，其中「一级菜单-二级菜单」或接口名承担改动对象，「业务描述」承担改动内容；
- **文档**：MUST 点名具体文档、规格能力或变更制品作为改动对象，并写明内容变化；MUST NOT 单独使用「更新文档 / 修改文档 / 更新提案 / 补充说明」等泛化表述；
- 三类说明 MUST NOT 因类别不同而降低明确性要求；无法确定具体对象时 MUST 使用文件路径或能力名兜底，仍无法确定时 MUST 询问用户。

Git 侧 `iagent_commit` 的 Conventional Commits 说明同步该要求：`docs` 类 subject MUST 写明文档对象与内容变化（D7）。

#### Scenario: 文档类泛化表述
- **WHEN** 文档类候选只生成出 `docs: 更新文档`
- **THEN** 该说明不通过校验，必须改写为点名对象与内容的形式，如 `docs: 审计告警批量处理: 更新接口文档与规格`

#### Scenario: 三类说明同等明确
- **WHEN** 同一提案产出功能代码、测试代码、文档三笔提交
- **THEN** 三笔说明均同时包含改动对象与改动内容，不存在仅文档类缺少对象的情况

#### Scenario: 文档对象无法定位
- **WHEN** 文档类仅有一个新文件且无法映射到业务菜单
- **THEN** 使用文件路径或能力名作为对象兜底（如 `docs: openspec/audit-alert: 新增告警规格`），仍无法确定时询问用户

## MODIFIED Requirements

### Requirement: 显式触发与三环节强制确认

技能 iagent_svn_commit SHALL 仅由显式指令 /iagent:svn-commit 触发（普通文本提交请求不触发），且 MUST 按三环节强制确认推进：环节 1 提交范围确定 → 环节 2 提交内容清单与功能描述确认 → 环节 3 最终确认。任何环节未经用户确认不得推进，最终确认通过前绝不执行提交；用户明确终止时立即停止不执行任何提交（D1）。

#### Scenario: 普通文本提交请求不触发
- **WHEN** 用户以普通对话文本请求"帮我提交代码"而未调用 /iagent:svn-commit
- **THEN** 技能不触发，不进入任何环节

#### Scenario: 环节未确认不得推进
- **WHEN** 环节 2 展示清单与功能描述后用户尚未答复
- **THEN** 不进入环节 3，不执行任何提交动作

#### Scenario: 不再询问知识库推送
- **WHEN** 任一环节的确认流程执行完毕
- **THEN** MUST NOT 出现知识库推送询问、知识库推送清单或 llm-wiki 调用

### Requirement: 提交范围确定（四场景）

技能 SHALL 按四种场景确定提交候选集：场景 1 指定 SVN changelist（校验列表存在，候选集 = 列表成员，不存在时列出可用列表供选）；场景 2 均未指定（先自动检测提案候选——存在活跃或归档未提交提案时进入提案分类提交流程；无候选时询问是否提交全部变更，不提交全部时请用户指定列表或文件，仍无法确定则终止）；场景 3 直接点名文件（候选集 = 点名文件）；场景 4 提案点名（读取点名提案后进入提案分类提交流程，归档提案同样适用）。候选集 MUST 先经「提交范围排除」过滤再进入环节 2（D3）。

#### Scenario: 指定的变更列表不存在
- **WHEN** 用户执行 /iagent:svn-commit 提交 not-exist-list 列表且该列表不存在
- **THEN** 列出 svn status 中当前可用的变更列表供用户选择

#### Scenario: 场景 4 提案点名
- **WHEN** 用户执行 /iagent:svn-commit 提交 add-audit-alert 提案且该提案存在于 openspec/changes/
- **THEN** 技能读取该提案的 proposal/design/tasks，进入提案分类提交流程

#### Scenario: 未指定时自动检测到归档提案
- **WHEN** 用户执行 /iagent:svn-commit 且无活跃变更，但 archive/ 下某提案存在未提交制品
- **THEN** 该归档提案作为候选并标注「已归档」，进入提案分类提交流程

### Requirement: 提交范围排除（最高优先级）

技能 SHALL 将 target 目录（含 classes、test-classes、surefire-reports、generated-sources）、*.class 编译产物、surefire-reports、*.log、.idea、docs、本地脚本等未纳管非源码文件排除出提交范围（不进入清单、不参与注释提炼、永不 svn add），本排除规则优先级高于「被引用则 add」；未纳管（?）的 openspec/ 变更制品默认不提交，**但被选中/点名的归档提案的未提交制品例外**——经环节 2 清单确认后纳入并归文档类（D4）。src/test/java 测试源码不在排除范围。排除项按状态处理：?（未纳管）直接忽略；A（已被 svn add）为危险项——不提交、不 revert、改用过滤后显式路径提交并提示用户手动 revert；M（已版本化）不提交、不改动、汇报中建议 svn delete。用户明确点名要求提交排除项时以用户指令为准。

#### Scenario: 排除项被提交集内文件引用
- **WHEN** 提交集内文件引用了 target/classes 下某 *.class 文件
- **THEN** 该文件不被自动纳入（排除优先于「被引用则 add」），不计为引用缺漏

#### Scenario: 排除项已被 svn add 调度
- **WHEN** 候选集内存在处于 A 状态的 target/ 下文件
- **THEN** 不提交该文件、不 revert，改用过滤后的显式路径提交，汇报中提示用户手动 svn revert

#### Scenario: 全部变更均被排除
- **WHEN** 过滤后无剩余变更
- **THEN** 不生成注释、不执行提交，说明全部变更均被排除并统计排除数量

#### Scenario: 归档提案未纳管制品例外
- **WHEN** 选中的归档提案下存在 `?` 状态的 proposal/design/tasks
- **THEN** 这些制品不被排除，经环节 2 清单确认后纳入并归文档类；未点名的其他 `openspec/` 未纳管制品仍默认排除

### Requirement: 提案分类提交（三类自动分类）

提案场景 4 下技能 SHALL 将过滤后的工作区变更自动归类为三类：测试代码（src/test/**、test/** 下任何文件含 *.md 测试说明，及独立测试文件 *Test.java、*Tests.java、*.test.*）；文档（已纳管版本化的 docs/** 下任何文件，其余位置 *.md，已版本化纳管的 openspec/ 变更制品，以及经确认纳入的归档提案制品）；功能代码（其余产出：源码、页面、SQL 脚本、配置文件）。分类规则 MUST 路径优先——目录语义覆盖扩展名判定；提案 tasks.md 任务类型标签作为交叉校验辅助。技能 MUST 生成 N 笔分类提交计划（每笔一个类别、一个前缀：功能代码类按变更性质判定 feat/fix/refactor/perf 等，测试代码固定 test，文档固定 docs），某类为空时跳过该笔并在计划中说明。文档类提交说明 MUST 遵守「三类提交说明统一规范」（D2）。

#### Scenario: 测试目录下文档随测试类
- **WHEN** 变更含 src/test/java/.../AlertTest.java 与 src/test/resources/测试说明.md
- **THEN** 两个文件均归入测试代码类，同笔以 test 前缀提交

#### Scenario: 某类为空跳过该笔
- **WHEN** 提案场景下归类结果为功能代码 3 个文件、测试代码 0 个、文档 1 个
- **THEN** 生成 2 笔提交计划（功能代码笔 + 文档笔），计划中说明测试代码类为空已跳过

#### Scenario: 提案产出命中排除规则
- **WHEN** 提案 tasks 列出的产出文件命中提交范围排除规则（如编译产物）
- **THEN** 排除规则优先——该文件不提交，汇报中说明

#### Scenario: openspec 制品未纳管
- **WHEN** 提案场景下 openspec/changes/&lt;提案名&gt;/ 的制品（proposal/design/tasks 等）处于 ? 未纳管状态，且该提案为活跃变更
- **THEN** 该文件默认不提交（遵循提交范围排除规则，不自动 svn add），用户明确点名要求提交时以用户指令为准纳入并归文档类

#### Scenario: 归档提案制品归文档类
- **WHEN** 归档提案被选中且其制品经确认纳入
- **THEN** 这些 Markdown 制品归入文档类，以 docs 前缀提交

### Requirement: 提案溯源标注

提案分类提交的每笔提交信息 MUST 保持主体单行源 SKILL 前缀格式，另起尾行以 `提案: <变更名>` 标注来源提案。非提案场景（场景 1/2/3 及场景 4 退化）MUST 不附加溯源标注。归档提案的 `<变更名>` MUST 使用去掉日期前缀的目录名（D5）。

#### Scenario: 每笔独立标注
- **WHEN** 提案 add-audit-alert 产出三笔分类提交（功能/测试/文档）
- **THEN** 三笔提交信息各自尾行均带 `提案: add-audit-alert`

#### Scenario: 归档提案尾行去日期前缀
- **WHEN** 归档提案目录为 `2026-11-08-add-audit-alert`
- **THEN** 尾行为 `提案: add-audit-alert`，不带 `2026-11-08-` 前缀

### Requirement: 提案状态边界处理

技能 MUST 按以下边界处理提案状态：未点名提案时自动检测活跃变更与归档未提交提案——唯一候选时直接采用并提示，多个候选时列出供选（活跃与归档分别标注），无候选时退化为场景 2（询问是否提交全部，无溯源标注）；点名的提案不存在于 changes/ 与 archive/ 时列出候选供选；点名提案已归档（在 archive/ 不在 changes/）时 MUST 正常读取归档制品并按分类提交流程推进，同时在环节 1 提示「提案已归档，按提案内容检查未提交变更」（D3 / D6）。

#### Scenario: 未点名且无候选退化
- **WHEN** 用户执行 /iagent:svn-commit 且活跃变更与归档未提交提案均为空
- **THEN** 退化为场景 2 询问是否提交全部变更，提交不带溯源标注

#### Scenario: 点名已归档提案
- **WHEN** 用户点名的提案存在于 openspec/changes/archive/ 而非 changes/
- **THEN** 技能读取归档提案内容并按分类提交流程推进，环节 1 提示「提案已归档」

### Requirement: 提交汇报

提交流程结束后技能 MUST 汇报：版本号、作者、路径数（M/A/D 分项）、使用的变更列表名（如有）、双验证结论、排除的本地文件清单（含数量统计）。提案分类提交场景 MUST 额外汇报：各笔分类明细（类别、前缀、文件数、溯源标注）、失败笔与未执行笔（如有）。汇报 MUST NOT 包含知识库提交结果（D1）。

#### Scenario: 提案分类提交完整汇报
- **WHEN** 提案场景三笔提交全部成功
- **THEN** 汇报含每笔的类别/前缀/文件数/`提案: <变更名>`标注、各笔版本号、双验证结论、排除清单

#### Scenario: 汇报不含知识库结果
- **WHEN** 提交流程完成
- **THEN** 汇报 MUST NOT 出现 submission_id、审核状态或知识库推送结论

### Requirement: Git 提交技能的提案制品纳入

Git 侧提交技能 `iagent_commit` SHALL 在提交前检测提案候选，并把该变更的**提案制品**纳入提交范围，与 SVN 侧 `iagent_svn_commit` 的提案分类提交对齐：

- **检测**：同时检测 `openspec/changes/` 下的活跃变更与 `openspec/changes/archive/` 下存在未提交制品的归档变更；唯一候选则直接采用，多个候选则列出供用户选择（归档项标注「已归档」）；无候选时退化为普通提交，不附加溯源标注（D3）。
- **范围**：默认清单固定为 `openspec/changes/<change-path>/` 下的 `proposal.md`、`design.md`、`tasks.md`、`exploration.md`、`.openspec.yaml` 与 `specs/**/*.md`；归档提案的 `<change-path>` 为 `archive/YYYY-MM-DD-<name>`；MUST NOT 纳入 `attachments/**` 与 `需求文档.md`。`.openspec.yaml` 是变更的 schema 声明（`iagent spec status` 读它判定 schema），随制品提交以保证跨机可复现。
- **暂存**：MUST 逐条执行 `git add <精确路径>` 并逐条校验前缀 `openspec/changes/<change-path>/`；MUST NOT 使用 `git add -A` / `git add openspec` / `git add openspec/changes`。
- **溯源**：提交信息主体保持 Conventional Commits 一行式，另起**尾行** `提案: <change-name>`（归档提案使用去掉日期前缀的变更名，与 `svn-commit.ts` 完全同格式）。
- **说明明确性**：`docs` 类 subject MUST 写明文档对象与内容变化，MUST NOT 只写「更新文档」（D7）。
- **人工闸**：既有「首次执行前向用户展示将要提交的文件与提交信息，确认后再执行」约束**不豁免**，MUST NOT 改为自动提交。
- **降级**：仓库未跟踪 `openspec/`（路径不存在或未纳管）、无候选、暂存失败时 SHALL 只记录 WARN 并提示手动处理，MUST NOT 阻断提交主流程，MUST NOT 静默把制品混入提交。

技能的 `allowedTools` SHALL 已覆盖上述动作所需命令（既有 `git status` / `git diff` / `git add` / `git commit` / `git log` 与只读检索），MUST NOT 因本能力新增未使用的授权。

#### Scenario: 单活跃变更的提案制品随提交
- **WHEN** 仓库存在唯一活跃变更 `upgrade-workflow-efficiency`，用户执行 `/iagent:commit` 并确认提交
- **THEN** 技能按固定清单精确暂存该变更的 proposal / design / tasks / exploration / specs 文件，提交信息尾行为 `提案: upgrade-workflow-efficiency`

#### Scenario: 归档未提交提案被自动检测
- **WHEN** `openspec/changes/` 无活跃变更，但 `openspec/changes/archive/2026-11-08-add-x/` 下存在未提交制品
- **THEN** 该归档提案作为候选并标注「已归档」，暂存路径前缀为 `openspec/changes/archive/2026-11-08-add-x/`，尾行为 `提案: add-x`

#### Scenario: 多候选时由用户选择
- **WHEN** 存在 2 个及以上活跃/归档候选
- **THEN** 技能列出候选供用户选择，MUST NOT 自行决定纳入哪一个

#### Scenario: 无候选退化为普通提交
- **WHEN** 活跃变更与归档未提交提案均为空
- **THEN** 技能按普通提交处理，MUST NOT 附加 `提案:` 尾行，MUST NOT 报错

#### Scenario: 不使用全量暂存
- **WHEN** 技能构造暂存动作
- **THEN** MUST NOT 出现 `git add -A`、`git add openspec` 或目录级 `git add`
- **AND** 每条暂存路径前缀均为 `openspec/changes/<change-path>/`

#### Scenario: 提交前仍需人工确认
- **WHEN** 技能完成变更检查并生成提交信息
- **THEN** 先向用户展示将要提交的文件清单与提交信息并等待确认，确认前 MUST NOT 执行 `git commit`

#### Scenario: 纳管缺失时降级不阻断
- **WHEN** `openspec/` 未被版本控制跟踪或暂存命令失败
- **THEN** 技能输出 WARN 并提示手动处理，代码提交仍可正常完成

#### Scenario: docs 类说明不得泛化
- **WHEN** 提交内容仅含文档变更
- **THEN** 提交信息必须写明文档对象与内容变化，如 `docs(openspec): 更新告警接口规格与测试说明`，MUST NOT 只写 `docs: 更新文档`

### Requirement: openspec 变更制品的纳管策略

系统 SHALL 采用「提案制品纳入 VCS 跟踪」的仓库约定：`openspec/changes/**` 下的 Markdown 制品（proposal / design / tasks / exploration / specs）与变更元数据 `.openspec.yaml` **进入版本控制**；以下仍 MUST 保持忽略：

- `.iagent/`（配置与本机缓存）
- `openspec/changes/archive/.iagent/`（历史索引与 manifest 缓存）
- `openspec/changes/**/attachments/**`（变更附件；MUST 在 `.gitignore` 层面排除，MUST NOT 只依赖提交清单）
- `.openspec-tmp/`（流程级临时工作区，含 handoff 包）
- `openspec/explorations/**`、`openspec/specs/**`、`openspec/devdocs/**`、`openspec/rules/**`、`openspec/config.yaml` 与 `openspec/CONTEXT.md`（仓库级语义产物与本机状态；本策略的纳管范围仅限 `changes/**`）
- `.codegraph/`、`.claude/`、`.pi/`、`.codex/`、`.opencode/` 等 dogfood 与本地索引产物

**规则链约束**：`.gitignore` MUST 采用「先通配排除 `openspec/*`、再逐目录放行（`!openspec/changes/`）、最后逐个再排除缓存目录」的形态。MUST NOT 保留 `openspec/` 整目录排除的同时用 `!openspec/changes/**` 放行 —— git 不会列出被排除的父目录，该写法放行不生效（且不会有任何测试报错，只会表现为「提交清单为空」）。

`iagent init` MAY 在首次初始化时**提示**该纳管策略与其收益（提案随代码可追溯），MUST NOT 擅自写入或改写业务 `.gitignore` 条目；`.openspec-tmp/` 的补条目行为沿用既有模式。SVN 项目不受本策略影响：`svn-commit` 仍按「未纳管的 `openspec/` 制品默认不提交」执行，**唯一例外**是被选中/点名的归档提案制品经确认后纳入并归文档类（D4）。

#### Scenario: 变更制品可被提交
- **WHEN** 仓库已按本策略纳管 `openspec/changes/**`
- **THEN** `git status` 可见活跃变更的 Markdown 制品为待提交项，`git add` 指定路径后进入暂存区

#### Scenario: 归档变更制品同样被纳管
- **WHEN** 仓库已按本策略纳管 `openspec/changes/**` 且 `openspec/changes/archive/` 下有历史变更
- **THEN** 历史变更的 Markdown 制品同样可见于 `git status`（属一次性纳管成本），`archive/.iagent/` 下的缓存文件 MUST 仍不可见

#### Scenario: 本机缓存仍被忽略
- **WHEN** 活跃变更目录下存在 `attachments/` 或仓库存在 `.openspec-tmp/pipeline-<change>/`
- **THEN** 这些内容 MUST NOT 出现在默认提交清单中，且 MUST NOT 出现在 `git status` 的未跟踪列表中（`attachments/**` 与临时工作区均在 `.gitignore` 层面排除）

#### Scenario: 放行写法在 git 语义下真实生效
- **WHEN** 执行 `git status --porcelain` 检查纳管结果
- **THEN** 至少一个 `openspec/changes/<name>/proposal.md` 出现在未跟踪或已修改列表中
- **AND** 若清单为空，则说明规则链写法无效（父目录仍被排除），实现 MUST 修正规则链而不是把该场景判为通过

#### Scenario: init 只提示不改写
- **WHEN** 首次执行 `iagent init` 且仓库未纳管 `openspec/changes/**`
- **THEN** 输出提示说明纳管策略，MUST NOT 自动修改业务 `.gitignore` 规则

#### Scenario: SVN 侧归档提案例外
- **WHEN** SVN 项目中归档提案被选中，其 `openspec/changes/archive/<dir>/` 制品处于未纳管（`?`）状态
- **THEN** 经环节 2 清单确认后纳入提交并归文档类；未被选中的其他未纳管制品仍默认不提交

## REMOVED Requirements

### Requirement: 知识库推送（可选环节）

**Reason**: 用户要求提交技能只进行代码、测试、文档提交（D1）。llm-wiki MCP 工具未列入 `allowedTools`，实际执行会触发权限弹窗；知识库推送不属于提交技能的核心职责，保留会增加交互负担与失败面。

**Migration**: 需要知识库推送的使用者改用独立的 llm-wiki 工具或手工调用；`iagent_svn_commit` 不再询问知识库推送、不再生成推送清单、不再执行 `llm_wiki_import_sources`，汇报中也不再包含 submission_id 与审核状态。
