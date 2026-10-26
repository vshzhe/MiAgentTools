# commit-push-skill 增量规格

## ADDED Requirements

### Requirement: Git 提交技能的提案制品纳入

Git 侧提交技能 `iagent_commit` SHALL 在提交前检测活跃变更，并把该变更的**提案制品**纳入提交范围，与 SVN 侧 `iagent_svn_commit` 的提案分类提交对齐：

- **检测**：`openspec/changes/` 下存在活跃变更（排除 `archive/`）时，唯一则直接采用，多个则列出供用户选择；无活跃变更时退化为普通提交，不附加溯源标注。
- **范围**：默认清单固定为 `openspec/changes/<change-name>/` 下的 `proposal.md`、`design.md`、`tasks.md`、`exploration.md`、`.openspec.yaml` 与 `specs/**/*.md`；MUST NOT 纳入 `attachments/**` 与 `需求文档.md`。`.openspec.yaml` 是变更的 schema 声明（`iagent spec status` 读它判定 schema），随制品提交以保证跨机可复现。
- **暂存**：MUST 逐条执行 `git add <精确路径>` 并逐条校验前缀 `openspec/changes/<change-name>/`；MUST NOT 使用 `git add -A` / `git add openspec` / `git add openspec/changes`。
- **溯源**：提交信息主体保持 Conventional Commits 一行式，另起**尾行** `提案: <change-name>`（与 `svn-commit.ts` 既有格式一致）。
- **人工闸**：既有「首次执行前向用户展示将要提交的文件与提交信息，确认后再执行」约束**不豁免**，MUST NOT 改为自动提交。
- **降级**：仓库未跟踪 `openspec/`（路径不存在或未纳管）、无活跃变更、暂存失败时 SHALL 只记录 WARN 并提示手动处理，MUST NOT 阻断提交主流程，MUST NOT 静默把制品混入提交。

技能的 `allowedTools` SHALL 已覆盖上述动作所需命令（既有 `git status` / `git diff` / `git add` / `git commit` / `git log` 与只读检索），MUST NOT 因本能力新增未使用的授权。

#### Scenario: 单活跃变更的提案制品随提交

- **WHEN** 仓库存在唯一活跃变更 `upgrade-workflow-efficiency`，用户执行 `/iagent:commit` 并确认提交
- **THEN** 技能按固定清单精确暂存该变更的 proposal / design / tasks / exploration / specs 文件，提交信息尾行为 `提案: upgrade-workflow-efficiency`

#### Scenario: 多活跃变更时由用户选择

- **WHEN** `openspec/changes/` 下存在 2 个及以上活跃变更
- **THEN** 技能列出候选供用户选择，MUST NOT 自行决定纳入哪一个

#### Scenario: 无活跃变更退化为普通提交

- **WHEN** `openspec/changes/` 下无活跃变更
- **THEN** 技能按普通提交处理，MUST NOT 附加 `提案:` 尾行，MUST NOT 报错

#### Scenario: 不使用全量暂存

- **WHEN** 技能构造暂存动作
- **THEN** MUST NOT 出现 `git add -A`、`git add openspec` 或目录级 `git add`
- **AND** 每条暂存路径前缀均为 `openspec/changes/<change-name>/`

#### Scenario: 提交前仍需人工确认

- **WHEN** 技能完成变更检查并生成提交信息
- **THEN** 先向用户展示将要提交的文件清单与提交信息并等待确认，确认前 MUST NOT 执行 `git commit`

#### Scenario: 纳管缺失时降级不阻断

- **WHEN** `openspec/` 未被版本控制跟踪或暂存命令失败
- **THEN** 技能输出 WARN 并提示手动处理，代码提交仍可正常完成

### Requirement: openspec 变更制品的纳管策略

系统 SHALL 采用「提案制品纳入 VCS 跟踪」的仓库约定：`openspec/changes/**` 下的 Markdown 制品（proposal / design / tasks / exploration / specs）与变更元数据 `.openspec.yaml` **进入版本控制**；以下仍 MUST 保持忽略：

- `.iagent/`（配置与本机缓存）
- `openspec/changes/archive/.iagent/`（历史索引与 manifest 缓存）
- `openspec/changes/**/attachments/**`（变更附件；MUST 在 `.gitignore` 层面排除，MUST NOT 只依赖提交清单）
- `.openspec-tmp/`（流程级临时工作区，含 handoff 包）
- `openspec/explorations/**`、`openspec/specs/**`、`openspec/devdocs/**`、`openspec/rules/**`、`openspec/config.yaml` 与 `openspec/CONTEXT.md`（仓库级语义产物与本机状态；本策略的纳管范围仅限 `changes/**`）
- `.codegraph/`、`.claude/`、`.pi/`、`.codex/`、`.opencode/` 等 dogfood 与本地索引产物

**规则链约束**：`.gitignore` MUST 采用「先通配排除 `openspec/*`、再逐目录放行（`!openspec/changes/`）、最后逐个再排除缓存目录」的形态。MUST NOT 保留 `openspec/` 整目录排除的同时用 `!openspec/changes/**` 放行 —— git 不会列出被排除的父目录，该写法放行不生效（且不会有任何测试报错，只会表现为「提交清单为空」）。

`iagent init` MAY 在首次初始化时**提示**该纳管策略与其收益（提案随代码可追溯），MUST NOT 擅自写入或改写业务 `.gitignore` 条目；`.openspec-tmp/` 的补条目行为沿用既有模式。SVN 项目不受本策略影响：`svn-commit` 仍按「未纳管的 `openspec/` 制品默认不提交，用户点名时方可纳入」执行。

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

#### Scenario: SVN 侧语义不变

- **WHEN** SVN 项目中 `openspec/changes/<name>/` 的制品处于未纳管（`?`）状态
- **THEN** `svn-commit` 仍默认不提交，仅在用户明确点名时纳入并归文档类
