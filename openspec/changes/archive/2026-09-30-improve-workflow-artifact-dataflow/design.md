## Context

本变更是 **VenusAgentTools 自身技能模板**的流程内制品路由调整，技术真源为 `src/core/templates/workflows/*.ts`（模板工厂），非目标项目的业务代码。

**相关架构现状**

- **模板分层**：`spec-*.ts` 为**单一定义源**（`instructions` 持有全文，`getSpecXxxCommandTemplate()` 经 `deriveCommandContent()` 剥离 `<!-- CMD:SKIP -->` 段落后派生指令版）；`tr-*.ts` 为 skill/command **手工双处**（指令版是压缩改写，非逐字派生）→ 改动须双处同步。
- **注册与分发**：`registry.ts` 的 `WORKFLOW_PAIRS` → `generate`/`init`/`update` 生成 SKILL.md 与 `.claude/commands/venus/*.md`；`skills/` 为随仓库提交的静态快照（`test/skills-parity.test.ts` 防漂移）；`test/allowed-tools.test.ts` 断言指令白名单与配对技能逐字节一致。
- **安装面**：`profiles.ts` 的 `DEFAULT_WORKFLOWS`（8 项显式）与 `DEPS`（不动点迭代注入）；`permissions.ts` 的 `buildPermissionEntries` 把**全部已安装技能**的 `allowedTools` 聚合为会话级 `permissions.allow`。
- **两条待改链路**（探索阶段实测，见 `exploration.md` §Codebase Findings）：
  - **探索文件**：`spec-propose.ts:73-79`、`tr-impl-workflow.ts:1036-1077`、`tr-impl-auto-workflow.ts:458-463` 三处独立文本；后两处明文"保留源件不删除"。
  - **需求文档**：生成于提案校验 PASS 后（`tr-impl-workflow.ts:1391`、`tr-impl-auto-workflow.ts:517-518`、`tr-impl-genfull.ts:270-286`、`tr-impl-debug.ts:484-499`）；归档侧仅"存在则迁移 devdocs"（`spec-archive.ts:171-183`、`spec-bulk-archive.ts:215-222`）。
- **历史方法论（能力记忆注入）**：① **单一定义源**——共享协议正文只写一处，其余"显式声明继承、不复制文本"（`spec-workflow-skills/explorations.md` D1，本能力有"双模板漂移"实录）；② **fail-safe 降级**——机制失效只让指令更长，绝不缺失防护；③ **不可测指标转结构断言**——验收以可断言的模板文本结构指标承载。

**流程基准**：`exploration.md` §功能流程图 三条流程、17 个节点（已获用户确认）。

## 流程节点覆盖（流程基准 → 落点）

流程基准的 19 个节点（N1–N7 / M1–M8 / K1–K4）逐节点落点如下；标"维持现状"者为**本变更不触碰**的既有行为，已在 tasks 组 7 显式登记，使"未改动"与"漏改动"可区分。

| 节点 | 操作 | 落点 |
|------|------|------|
| N1 | 创建暂存探索文件 | 维持现状（只改"离开暂存区"的语义，不改创建行为） |
| N2 | 移动入变更目录 | 任务 1.1 / 1.2 / 1.3 |
| N3 | 删除源文件 | 任务 1.1 / 1.2 / 1.3 |
| N4 | 迁移失败保留源件 | 任务 1.1 / 1.2 / 1.3（D6 安全网） |
| N5 | 制品生成消费 exploration.md | 维持现状 |
| N6 | 归档随迁 exploration.md | 维持现状 |
| N7 | 归档抽取能力记忆 | 维持现状（"extraction copies, not moves" 语义保留） |
| M1 | 校验后收束（不再生成） | 任务 3.1 / 3.2 / 3.3 / 3.4 |
| M2 | 实现（apply） | 维持现状 |
| M3 | 归档生成判定 | 任务 2.1 / 2.2 |
| M4 | 委派生成 | 任务 2.1 / 2.2 / 2.3 |
| M5 | 就地增量对齐 | 任务 2.1 / 2.2 / 3.3（能力整体迁移） |
| M6 | 归档目录移动 | 维持现状 |
| M7 | 步骤 6 迁移 devdocs | 任务 2.1（显式"保持不动"）/ 2.2 |
| M8 | 失败降级 WARN | 任务 2.1 / 2.2 |
| K1 | 单一行为源 spec-archive | 任务 2.1 |
| K2 | auto-workflow 内联继承 | 任务 2.3 |
| K3 | genfull 委派继承 | 任务 3.4 |
| K4 | bulk-archive 平行副本 | 任务 2.2 |

## Goals / Non-Goals

**Goals**:

- 探索文件在提案生成时**移动**入变更目录并**删除源件**（失败保留），使同一探索内容在流程中只保留一份。
- 需求文档的生成时机由"提案校验后"改为**归档时**（预归档检查点），并**保留**调试阶段原有的双分支能力（不存在→委派生成 / 已存在→就地增量对齐保人工域）。
- 在 4 个同构技能（workflow / auto-workflow / genfull / debug）与 2 个归档技能（archive / bulk-archive）间保持**同一规则的单一口径**，不留漂移面。
- 白名单、DEPS、测试、快照与 `CONTEXT.md` 术语与正文改动**逐项同步**，使 CI 与运行时行为一致。

**Non-Goals**:

- 不清理 `openspec/explorations/` 下 9 个历史探索文件（保留可追溯）。
- 不改造 `/venus:spec-propose` **指令版**（其 Step 0 位于 `CMD:SKIP` 内，指令版本就不含迁移步骤）。
- 不改 `tr-impl-auto-migration`（探索文件直建变更目录，无暂存层）与 `tr-impl-debug` 的探索文件逻辑（无 `openspec/explorations/` 落点）。
- 不改 `DEFAULT_WORKFLOWS` 显式集合、`registry.ts` 注册结构、技能名/类型/总数（27 不变）、`derive-command.ts` 派生器、`prompt-gate.ts` / `flowchart-gate.ts` 共享模块。
- 不改任何确认门语义（提示词校验门 / 流程图确认门 / 设计确认门 / L1-L5 追问门）。

## Decisions

### D1: 探索文件移动语义**就地反转**，不新建共享载体

- **选择**: 在 3 处既有独立文本（`spec-propose.ts` Step 0.6、`tr-impl-workflow.ts` Phase 2.3、`tr-impl-auto-workflow.ts` Phase 2）各自改写为"移动 + 成功删源 + 失败保留"；`tr-impl-workflow.ts` 的 **"Post-Migration: Source File Preservation (Task 7.1)" 整段删除**。
- **理由**: 三处文本**本就独立存在**（非本次新增复制）；`tr-impl-auto-workflow` 的 Phase 2 内联生成**不引用** `openspec/rules/artifact-generation.md`，把规则上移到该文件需同时新增引用并依赖目标项目自持文件存在——反而引入新的失效面。历史 D1 的"单一定义源"针对的是**新增**共享协议正文，不适用于就地纠正既有重复文本。
- **备选**: ①把迁移规则写入 `openspec/rules/artifact-generation.md` —— 否决（该文件非 venus 分发产物，`venus init` 不创建，缺失即静默失效）；②抽 `exploration-migration.ts` 共享内联模块 —— 否决（3 处语义相同但上下文各异，抽象收益低于漂移成本）。

### D2: 需求文档生成 = **单一定义源 `spec-archive.ts`**，其余显式声明继承

- **选择**: 生成步骤（存在性判定 → 委派生成 / 就地增量对齐 → 失败 WARN）只定义在 `spec-archive.ts` 新步骤 **4.8**；`tr-impl-genfull` Stage 4 **委派** archive 技能 → 零文本改动继承；`tr-impl-auto-workflow` Phase 5 **内联执行**归档步骤 → 在既有步骤清单里**追加引用**（一句话指向 archive 的同一规则），**不复制**双分支正文；`spec-bulk-archive` a.6 为**平行同语义**（其自持归档流程，非继承）。
- **理由**: 严格延续历史 D1；`auto-workflow` Phase 5 本就是"内联执行 archive 模板步骤"的既有设计，追加一条引用即达成同步，复制正文会造出第 4 条漂移面。
- **备选**: 每个编排技能各写一份生成规则 —— 否决（3 份副本 + 双处压缩版 = 6 个漂移面）；让 `auto-workflow` Phase 5 改为委派 `venus_spec_archive` 技能 —— 否决（改变既有执行模型，超出本变更范围）。

### D3: debug 的双分支能力**整体迁移**而非删除

- **选择**: `tr-impl-debug` Phase 7.3 的「不存在→生成 / 已存在→就地增量对齐（人工域逐字保留）」整段移入 `spec-archive` 4.8；debug 侧改为明确禁令（MUST NOT 生成 / 对齐 / 委派），并新增"准备归档"收尾。
- **理由**: 人工域保护是**能力**而非调试专属；直接删除会使 `CONTEXT.md` 的「人工域」「就地增量对齐」成为死词，且归档时若文档已被人工编辑就会被静默覆盖。时机后移到归档后该分支**更必要**（文档存续期更长、被编辑概率更高）。
- **备选**: 保留 debug 分支（两处都生成）—— 否决（双重生成路径，与"提案校验后不再生成"直接冲突）；直接删除不迁移 —— 否决（丢失人工域保护，术语成死词）。

### D4: DEPS 补齐 + 失效项剔除，接受默认安装集 8 → 9

- **选择**: `DEPS` 中 `spec-archive` / `spec-bulk-archive` 各加 `tr-docs-requirement-doc`；`tr-impl-workflow` 收窄为 `['tr-impl-review-proposal']`、`tr-impl-debug` 为 `['spec-verify-proposal']`、`tr-impl-genfull` 显式列表剔一项（传递注入仍可得）；`tr-impl-auto-workflow` 保留（Phase 5 内联归档仍委派）。**`DEFAULT_WORKFLOWS` 显式项不改**。
- **理由**: 被委派技能必须可得（与 `spec-propose ⇒ spec-verify-proposal` 同构）；剔除失效项符合最小权限（正文不调用却保留条目属授权面虚增）。默认集因 `spec-archive` 在集内而**实际安装 9 项**——已与用户确认接受。
- **备选**: 不加 DEPS、未装则 WARN 跳过生成 —— 否决（默认安装下"跳过"会成为常态而非例外，需求文档名存实亡）；不加 DEPS、降级内联生成 —— 否决（八章节映射规则被复制进 archive 正文，违反 D2）。

### D5: 白名单随委派面**同增同减**；嵌套委派归会话级载体

- **选择**: `spec-archive` / `spec-bulk-archive` 各加 `Skill(venus_tr_docs_requirement_doc)`；`tr-impl-workflow` / `tr-impl-debug` / `tr-impl-genfull` 剔除该条目；`tr-impl-auto-workflow` 保留。嵌套委派（genfull → archive → requirement-doc）由 `permissions.allow` 覆盖，外层不写内层条目。
- **理由**: `tool-call-whitelist` 规格要求"白名单 MUST 覆盖正文实际会发起的调用"且"未覆盖即在 Claude Code 中被权限拦截"；等价地，正文已不调用而条目仍在属授权虚增。`buildPermissionEntries` 聚合**全部已安装技能**的条目写会话级 `allow`，故嵌套链路在技能已安装时必然放行。
- **备选**: genfull 保留 `Skill(venus_tr_docs_requirement_doc)` 以求稳 —— 否决（正文不直接委派，违反最小权限与"散文提及不构成委派"的反向约束；且测试会因未使用条目产生告警噪声）。

### D6: 失败安全网方向**不变**，仅对成功路径收紧

- **选择**: 迁移失败 → 保留源件 + 报错（沿用既有 guardrail）；生成/对齐失败 → WARN + 继续归档（沿用归档非阻断哲学："Do NOT block archive on sync failure"）。
- **理由**: "不保留原件"是对**成功路径**的去冗余，不是对失败路径的破坏；归档链路上所有既有检查点均为 non-blocking，新增检查点不应成为首个阻断点。
- **备选**: 生成失败即阻断归档 —— 否决（与归档既有哲学冲突，且归档是终态操作，阻断代价高于产出缺失）。

### D7: 验收以**结构指标断言 + 全量回归**承载

- **选择**: 新增结构断言（探索文件移动含删源断句且不含"保留源件"断句；archive/bulk-archive 正文含需求文档生成步骤；四条提案链路不含自动生成调用；双分支断句存在于归档侧；DEPS/白名单条目精确匹配），配合 `pnpm build && pnpm generate:skills` 与 `pnpm vitest run` 全量回归。
- **理由**: "制品在流程中只保留一份""生成时机在归档"属**流程时序语义**，无法在单元测试中直接观测；转译为可断言的模板文本结构指标是历史方法论（`improve-workflow-subagent-resource-sharing` 的 A1–A4）。
- **备选**: 端到端跑一遍真实工作流 —— 否决（需真实目标项目与多轮 LLM 交互，不进 CI）。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| `tr-impl-*` 为**手工双处**，skill 版改而 command 版漏改 → 两版语义冲突 | 逐技能"双处同步"列为独立任务；新增结构断言分别扫描 skill 正文与 command 正文；`test/templates.test.ts` 既有本地化断言复核 |
| 默认安装集 8 → 9 造成存量项目 `venus update` 后多装一个技能 | 属预期变更，`DEFAULT_WORKFLOWS` 显式集不变、`update` 按内容指纹升级；`test/commands.test.ts` 显式断言 9 项与注入提示，使变更**显式可见**而非静默 |
| `test/profiles.test.ts` 的注入**顺序**断言因不动点迭代顺序变化而失败 | 实现时以 `resolveWorkflows` 实际输出锁定期望序列（genfull 的 `tr-docs-requirement-doc` 由显式项变为传递项，位置移到尾部） |
| 删除 `tr-impl-workflow` §3.5 后用户直接跑 workflow 却发现"没有需求文档" | 在 workflow/auto-workflow 的完成摘要中显式提示"需求文档将于归档时生成"，使其成为**已知预期**而非缺失 |
| 归档时需求文档生成失败被 WARN 掩盖，用户以为已产出 | WARN MUST 含目标路径与失败原因；归档完成摘要中列出"需求文档：生成 / 就地增量对齐 / WARN（原因）"三态（对齐既有 `Exploration Memory` 摘要口径） |
| 会话级 `permissions.allow` 未及时刷新导致嵌套委派被拦截 | `venus update` 的"新增白名单条目三处刷新"已由既有需求覆盖（技能 frontmatter / 指令 frontmatter / `permissions.allow`）；测试断言三处一致 |
| 历史 9 个探索文件在新规则下成为"无主残留" | 已与用户确认**不清理**；`CONTEXT.md` 术语改为"暂存区"语义后，历史文件归属归档变更的事实可由 ARCHIVE-INDEX 与变更目录内的 `exploration.md` 共同溯源 |
