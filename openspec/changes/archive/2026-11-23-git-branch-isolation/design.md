## Context

实现期写操作当前直接落在用户所在分支。以 `spec-apply` 为例：Step 5.5 设计确认门通过后立即进入 Step 6 批调度，逐批写文件；收尾 Step 10.5 只做 `git add` 精确暂存，不做提交。`iagent_spec_archive` 的 Step 7.5 才 commit + push。

这意味着从「开始实现」到「归档完成」之间的所有代码改动与用户既有未提交改动**共享同一个工作区**。三项后果：

1. 实现失败或中断时，回滚边界不清晰（无法用一次分支操作回滚）；
2. 用户在主分支上的既有改动被实现期改动混淆，`git diff` 无法区分；
3. 归档前的合并动作缺失 —— 目前只有 commit + push，没有「先验证、再合并」的隔离层。

### 架构影响

| 受影响模块 | 模块职责 | 本变更的影响 | 断裂风险 |
| :--- | :--- | :--- | :--- |
| `src/core/git-capability.ts` | Git 检测与执行内核（注入 runner） | 新增分支创建 / 合并 / 删除 / 工作区检测（约 +120 行）；检测函数仍纯只读 | 中：新函数若绕过 runner 直接 `fs` 或直调进程，会破坏可测性（测试需 real git）。规避：全部经 `GitCommandRunner` |
| `src/commands/git.ts` | `iagent git` 子命令组（status / init） | 新增 `branch` / `merge` 子命令 | 低：既有子命令契约不动；补全表需同步（守则 3） |
| `src/commands/completion.ts` | 补全脚本数据源 | `git` 条目补子命令与参数 | 低：漏改会让补全缺新子命令（`test/completion-config.test.ts` 拦截） |
| `src/core/templates/workflows/spec-apply.ts` | 实现阶段协议（Step 1–11） | Step 5.5 后插分支准入；Step 10.5 语义按 `branchMode` 分叉；细则下沉 references | **高**：模板已 583 行源 / 353 行快照，预算 500 行；新增段 MUST 下沉 references，否则 `test/skill-size-budget.test.ts` 失败 |
| `src/core/templates/workflows/spec-archive.ts` | 归档协议（Step 1–10） | Step 7.5 后插合并门 + merge + 删分支 | **高**：模板 415 行源 / 436 行快照，接近预算；合并段 MUST 精简（≤ 30 行正文 + references） |
| `src/core/templates/workflows/debug.ts` | 调试全流程（Phase 1–7） | Phase 7 自动合并；2.2.3.5 加分信号 | **高**：579 行源 / 410 行快照，接近预算；合并段下沉 references |
| `src/core/templates/workflows/spec-update.ts` | 修订闭环（Step 0–9） | Step 8 PASS 后自动合并 | 低：198 行，有预算余量 |
| `src/core/templates/workflows/spec-explore.ts` | 探索强制检查点（1.1–1.8） | 新增 1.5.6 需求发散 | **高**：1449 行源 / 169 行快照（协议已全部下沉 references）；新增段写入 references，主文件只留 3 行指针 |
| `src/core/templates/workflows/spec-propose.ts` | 制品生成 | 映射发散结论到 `### 需求发散承接` | 低：372 行，有预算余量 |
| `src/core/templates/workflows/workflow.ts` / `auto-workflow.ts` | 父编排 Phase 1–5 | Phase 2.0 五维扩面 | 中：488 / 263 行源；扩面段 MUST 替换而非追加 |
| `src/core/spec/validation/readiness.ts` | 就绪门四判定（纯函数） | 新增第 5 判定 `divergence` | 中：`ReadinessResult.checks` 从 4 项变 5 项，消费方若硬编码长度会崩。规避：消费方均按 `id` 查找或 `every()` 迭代（已核实 `buildReadiness` 内部与 CLI 输出无长度断言） |
| `src/core/spec/templates/index.ts` | 四类制品模板 | `## Impact` 下新增 `### 需求发散承接` | 低：追加小节，不改既有锚点 |
| `src/core/templates/verify-checklist.ts` | D1-D10 + B1-B7 单一源 | propose 自检加 1 条 | 低：**不改维度编号与阈值公式**（`test/verify-checklist-single-source.test.ts` 守护） |
| `src/core/templates/tool-whitelist.ts` | 白名单共享常量 | 复用 `GIT_CLI`，不新增 | 低：新技能无新增工具类别 |
| `openspec/specs/*` | 能力规格 | 3 新增 + 5 修改 | 低：归档时 delta spec 合并 |
| `openspec/CONTEXT.md` / `AGENTS.md` | 术语与仓库地图 | 各 +4 条 / +1 节 | 低 |

**跨切面风险**：`spec-apply` / `spec-archive` / `debug` 三个模板同时受「分支协议」与「尺寸预算」双重约束，且三者被 3 个父编排交叉消费。任何一处语义漂移都会通过 `test/branch-isolated-workflow.test.ts` 的跨模板一致性断言暴露 —— 该测试是本次的核心回归锁。

## Goals / Non-Goals

### Goals

1. 实现期写操作与基分支隔离，验证通过后可一次性合并，失败可整体丢弃。
2. 归档点（以及 debug / update 的验证收束点）提供确定性的合并动作与失败处置。
3. 探索与提案阶段强制产出可验证的需求发散结论，并被就绪门与验证维度消费。
4. 全部新增能力在无 Git 项目中降级为零行为变化。

### Non-Goals

- **不覆盖 SVN**：SVN 项目由 `iagent_svn_commit` 承担，分支语义不适用；技能正文 MUST 显式声明非目标。
- **不实现自动冲突解决**：冲突一律暂停由用户处置。
- **不改 `spec-bulk-archive`**：批量归档沿用「整批一次提交」，本次不纳入分支能力（记 WARN 说明）。
- **不引入远端分支管理**：不 `push` 工作分支、不创建 PR、不删除远端分支。
- **不新增门白名单类别、不扩张 `GATE_SKIP_IDS`**。
- **不改 D1-D10 维度编号与 90% 阈值公式**。

## Decisions

### DD1 分支粒度 = 每变更一条工作分支

`iagent/<change-name>`；debug 用 `iagent/debug-<keyword>`，update 用 `iagent/update-<change>`，独立 apply（无变更目录）用 `iagent/apply-<timestamp>`。

**理由**：与既有工作单元（变更）对齐；归档点即合并点；分支名可追溯。备选「每会话一条」会让多变更混杂，无法按变更合并。

### DD2 分支创建点 = apply Step 5.5 之后、Step 6 之前

**理由**：apply 可独立调用，编排层创建无法覆盖；「首次写文件之前」是唯一能保证隔离的时点。设计确认门之后创建，避免用户取消设计时空建分支。

### DD3 分支准入必须先检查工作区

`git status --porcelain` 非空 → 暂停，三出口：提交 / stash / 取消。**MUST NOT 自动 stash**、**MUST NOT 带脏工作区切换**。

**理由**：用户原话「防止已有代码修改出现异常」。自动 stash 在实现改动交错时会增加冲突概率，且 `stash pop` 失败后恢复路径复杂。

### DD4 基分支取自创建时所在分支，写入 handoff 包

handoff 包新增并列节 `## 分支状态`（`branch` / `baseBranch` / `branchMode` / `createdAt`），与六节并列、不计入六节。

**理由**：MUST NOT 硬编码 `main`（实际可能是 `master` / `develop` / 受保护分支）；沿用既有 handoff 包载体，不新造状态文件。

### DD5 合并点与合并策略

- apply → archive：`spec-archive` Step 7.5（提交）之后、Step 8（摘要）之前。
- debug → Phase 7 验证 PASS 后自动合并；spec-update → Step 8 PASS 后自动合并。
- 策略：`git merge --no-ff`（保留拓扑，便于回溯）。冲突 → 暂停 + 冲突清单，**MUST NOT 自动 abort**。

**理由**：`--ff-only` 在工作分支落后基分支时必然拒绝；`--no-ff` 是隔离实现的标准做法。不 abort 保证实现产出不丢失。

### DD6 合并门归属与自动合并的授权链

- **归档路径**：归 `destructive-change`（不可豁免、不可被 `gate-skip` 跳过），与推送门在**同一步内一次呈现**（合并 + 推送同一次确认），不新增停点。
- **debug / update 自动路径**：授权来自父流程验证 PASS 回执，MUST 写入 handoff 包 `## 已确认门` 账本条目（值为门承载 id），但**不作为新门 id** 进入 `GATE_SKIP_IDS`。

**理由**：门白名单 5 类不可扩张是硬约束；自动合并与「验证通过」是同一语义链，账本留痕即可审计。

**待定**：账本条目具体用哪个 id（见 tasks 3.1 的显式裁决点）。

### DD7 降级路径

无 Git / 非仓库 / detached HEAD / 工作区不可写 → `branchMode=none` + WARN，实现与归档照常。

**理由**：`project-init` 的 Git 检查已是非阻断；分支能力不能成为新的硬依赖。

### DD8 分支能力实现层 = 内核 + CLI

`git-capability.ts` 新增函数 + `iagent git branch|merge` 子命令；技能正文确定性调用。

**理由**：`commands/git.ts` 头注释已确立「供技能正文确定性调用，避免模型自行拼命令」；8 个模板各自拼 `git checkout -b` 会产生不可测的第二真源。

### DD9 需求发散 = 五维 + 就绪门第 5 判定

- 五维：直接影响 / 间接影响 / 契约影响 / 同类场景 / 非功能影响。
- 落盘：探索产物 `## 需求发散` 段；proposal `## Impact` 下 `### 需求发散承接` 表。
- 校验：`readiness.ts` 第 5 判定 `divergence`（段存在 + 五维非空或显式「无」）。
- **不新增验证维度编号 D11**（守则：D1-D10 编号契约不变）。

**理由**：当前 `### Impact Analysis` 表只有符号级上游，缺「同类场景」与「非功能」两个最容易漏的维度；无确定性校验时，发散段会退化为无人消费的散文。

### DD10 发散消费者的查询成本控制

`workflow` / `auto-workflow` Phase 2.0：**一次广查询 + 分维归集**，不逐维调 `codegraph_impact`；CodeGraph 不可用或 busy 耗尽 → Grep 估算 + WARN。

**理由**：5 次 `codegraph_impact` 会触发 busy 阶梯甚至耗尽；现有协议已明确「一次广查询优先」。

### DD11 模板尺寸纪律

新增正文段一律 ≤ 30 行，其余下沉 `references/branch-isolation.md` / `references/divergence-analysis.md`；主文件只留指针 + 硬约束。

**理由**：`spec-apply` / `spec-archive` / `debug` / `spec-explore` 四个模板已接近或达到预算；`test/skill-size-budget.test.ts` 是硬门。

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
| :--- | :--- | :--- |
| 分支协议在三模板间漂移 | 合并语义不一致，行为不可预测 | `test/branch-isolated-workflow.test.ts` 跨模板一致性与关键短语断言 |
| 模板尺寸超预算 | `pnpm test` 失败 | DD11 尺寸纪律 + 新增段走 references |
| 实现期自动提交被误读为扩张归档窄通道 | 破坏「MUST NOT 自动 commit」约束 | 限缩为**仅分支模式**（`branchMode=work-branch`）；`commit.ts` 显式声明该模式属实现期而非归档期，且 MUST 展示拟暂存清单 |
| 合并冲突发生在归档之后 | 用户面对半合并状态 | 归档结果不回滚；冲突清单 + 不 abort；文档明确「合并失败 ≠ 归档失败」 |
| 存量变更因第 5 判定失败 | 阻断既有工作 | 沿用 `isNewChange` 严格度：存量记 WARN + `skipped` |
| 无 Git 项目静默丢失隔离能力 | 用户以为有隔离 | 回执显式携带 `branchMode=none` + WARN，摘要可见 |

**Trade-offs**：

- 选择「分支模式自动提交实现期改动」换取「合并可行」，代价是打破「apply 不 commit」的既有简化语义 —— 通过限定作用域（仅分支模式）与展示清单对冲。
- 选择「归档合并门 + 推送门同一步呈现」减少停点，代价是一次确认覆盖两个动作（合并与推送语义不同）；通过呈现内容逐项列出对冲。
- 选择「就绪门新增判定而非新增验证维度」保住编号契约，代价是 divergence 不进入 90% 评分分母，只是硬门 —— 这是刻意的：它是「有没有做」的确定性判定，不是「做得好不好」的语义评分。

## Migration Plan

1. 内核与 CLI 先行（可独立测试，不影响任何技能）。
2. 模板改动分批：apply → archive → debug / update → explore / propose / workflow / auto-workflow。
3. 每次模板改动后 `pnpm build && pnpm generate:skills`（否则 `test/skills-parity.test.ts` 失败）。
4. 存量变更（`created < 2026-11-22`）在就绪门新增判定下记 WARN，不需要迁移动作。
5. `.claude/` dogfood 产物不入库，刷新与否不影响提交。

## Open Questions

无未决问题（原「合并门的账本条目 id」已收敛）：

- **裁决**：合并授权**不写** handoff 包 `## 已确认门` 段 —— 该段取值域收敛到 `GATE_SKIP_IDS`（当前仅 `design-confirmation`），写入域外 id 会触发 `invalid-receipt`。合并授权属「验证通过」派生的**动作授权**，SHALL 以阶段回执字段 `mergeAuthorized: true` / `mergeResult` 表达，语义更准确且不污染门账本。
- 已落入 `specs/branch-isolated-workflow/spec.md` 的「debug 与 spec-update 的验证后自动合并」需求与 `specs/workflow-suite-skills/spec.md`。
