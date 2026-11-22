# 提案：规则与技能的动态加载

## Why

用户原始诉求（`exploration.md` §Background，逐字保留）：

> 分析项目explore、auto-workflow、workflow、debug、update已经其他技能流程时，读取.agent下 rules\skills规则，当前技能使用时会全部加载rules\skills，应该根据实际情况动态加载，不在一开始时全部读取

**现状是结构性的「只能全读」**：技能启动期一律「枚举 → 读取全部 `exists=true`」，没有"先判断相关性"的步骤。探索阶段定位到 12 个全量读取点（`exploration.md` §Codebase Findings L1-L12）与 6 条根因：

1. **R1 枚举即全读**：`spec-explore.ts:100`、`debug.ts:185`、`review.ts:17`、`spec-apply.ts:275`、`spec-verify.ts:25` 五处均为「读取全部 `exists=true` 的源」。
2. **R2 类型映射闲置**：`project-config.ts:396` 的 `RULE_FILE_NAMES` 已定义「技能类型 → 规则文件名」映射（`impl→coding-rules.md`、`test→testing-rules.md`、`spec→spec.md`），但**读取侧从未使用**。
3. **R3 `scope` 字段被解析却不被消费**：`project-skills.ts:66` 解析 `scope`（backend / frontend），`spec-explore.ts:119` 只按 `phases` 筛选，未用 `scope`。
4. **R4 propose 把全量写成硬要求**：`spec-propose.ts:235` 明写「MUST NOT 只蒸馏 `coding-rules.md`」，使无关规则必然进入 handoff 包并跨阶段传递。
5. **R5 CLI 无筛选能力**：`rules.ts:148`、`skills.ts:20` 只有 `--json`，筛选责任全部落在模型身上 → 判定不可复现。
6. **R6 缺「未读声明」契约**：除 `spec-apply` 的 `skillsIncomplete` 外，其余读取点无等价字段 → 无法区分「不需要读」与「漏读」，使「全读」成为唯一的安全默认。

**为什么是现在**：`.iagent/rules/` 当前仅 3 个文件 47 行，代价尚小；但这是**模板策略缺陷**，在规则与技能更多的大项目里代价线性放大。且动态加载所需的抓手（类型映射、`phases`、`scope`、handoff 规范要点）**都已存在**，只差把它们接上。

**反例已存在**：`test.ts:727` 只读 `testing-rules.md` —— 这就是正确形态，可作为统一策略的样板。

## What Changes

### 1. 新增：规则选择内核（`rule-selection`）

新增 `src/core/rule-selection.ts`（纯函数、无 I/O），把规则源按**三层**归类：

| 层级 | 内容 | 判定 |
| :--- | :--- | :--- |
| `always`（常驻基线） | `.iagent/config.yaml` 的 context、`CLAUDE.md`、`AGENTS.md` | 固定集合 |
| `phase`（阶段相关） | `.iagent/rules/<type>.md` 中与技能 `metadata.type` 匹配者 | 走 `RULE_FILE_NAMES` / `ruleFileNameFor` |
| `on-demand`（按需点读） | 与本次变更 / 任务范围相关的其余规则 | 由调用方声明相关性理由 |

对外暴露 `classifyRuleSources(sources, { type, scope })` 与 `selectSkillEntries(entries, { phase, scope })`：
- 技能类型 → 规则文件：复用 `ruleFileNameFor(type)`（`project-config.ts:424`）**单一源**，MUST NOT 另立映射；
- 技能筛选复用既有 `phases` 语义（`project-skills.ts:208`）并**新增消费 `scope`**（BS5：为 `null` 时不参与筛选）；
- 筛选结果为空 → 返回 `always` 集并标记 `fallback: true`（BS3/D7），MUST NOT 回退为全量。

### 2. 新增：CLI 筛选参数（`rule-loading-cli`）

- `iagent rules --json --type <id[,id...]>`：按技能类型筛选规则源，命中 `RULE_FILE_NAMES` 的条目；
- `iagent skills --json --phase <design|implement> --scope <backend|frontend>`：按阶段与范围筛选技能条目；
- **无参调用输出 MUST 逐字段保持不变**（D9 向后兼容）；
- 未知 type / phase 值 → 非零退出码并列出合法值（与既有 `--artifact` 未知 id 的处置一致）；
- 新增参数 MUST 同步 `src/commands/completion.ts` 的 `IAGENT_COMMANDS` 表。

### 3. 修改：三层读取契约写入技能正文（`rule-loading-contract`）

各读取点由「读取全部 `exists=true`」改为三层：

- **常驻基线恒读**（D3）：`config.yaml` context + `CLAUDE.md` + `AGENTS.md`；
- **阶段相关子集**（D5）：`iagent rules --json --type <本技能类型>`；
- **按需点读**（D5 第三层）：先看目录 / 标题，再读正文。

覆盖读取点：`spec-explore`（1.1.1 / 1.1.1.5）、`debug`（2.1.6 / 2.1.7）、`spec-apply`（实现前基线）、`spec-verify`（规则基线）、`review`（规则基线）、`proposal-review`。`test.ts` 的既有最佳实践保持不变并作为范式引用。

**未读声明（强制，D8）**：产物中逐源记录 `| 源 | 相关性 | 读取 | 理由 |`。声明为「需要读」但未读 → `rules-not-read` fail；声明为「不需要读」→ not-fail。

### 4. 修改：handoff `## 规范要点` 按范围蒸馏（D2）

`spec-propose.ts:235` 由「全部存在的规则源」改为：
- 相关性判为 `always` / `phase` 的源 → 蒸馏要点（逐条标注来源）；
- 其余源 → **指针 + 一行摘要**（`<path>` — <该规则的适用域>，需要时回读全文），MUST NOT 静默丢弃；
- `MUST NOT 只蒸馏 coding-rules.md` 的旧约束改为 `MUST NOT 静默丢弃任一存在源`（指针即保留）。

### 5. 修改：一致性门支持「声明为不需要读」豁免（D8）

`src/core/spec/validation/conformance.ts` 的 `rules` 校验（`:171-182`）新增「豁免声明」输入：调用方传入「声明为不需要读的源」列表时，该集合内的未读源不报 `rules-not-read`；未声明且未读的源照常 fail。

**BREAKING**：无。新增 CLI 参数为加法；无参输出不变；存量技能无 `scope` 字段按 `null` 处理；一致性门新增的豁免输入为可选。

## Capabilities

### New Capabilities

- `rule-selection`: 规则与技能的三层归类内核——常驻基线 / 阶段相关 / 按需点读的确定性划分，复用既有类型映射与 `phases` / `scope` 字段，筛选为空时回退常驻基线。
- `rule-loading-cli`: `iagent rules` / `iagent skills` 的筛选参数——按类型、阶段、范围筛选的确定性 CLI 能力，无参行为保持不变。
- `rule-loading-contract`: 技能正文的三层读取契约与未读声明——各阶段读取点按层读取并逐源记录相关性判定，使「不需要读」与「漏读」可区分。

### Modified Capabilities

- `rule-baseline`: handoff `## 规范要点` 由「全部存在源蒸馏」改为「按相关性分层蒸馏 + 指针保留」；规则基线读取由全量改为三层。
- `project-skill-consumption`: 技能消费新增 `scope` 维度（此前只按 `phases` 筛选）；未读判定区分「声明不需要读」与「漏读」。

## Impact

### Impact Analysis

> 逐符号结果源自 `exploration.md` §Codebase Findings 与 Phase 2.0 影响分析（Modify 意图，触发深度分析）。

| 符号 | 位置 | 直接上游影响（调用方 / 依赖方） | 波及的测试面 | 改动要求 |
| :--- | :--- | :--- | :--- | :--- |
| `RULE_FILE_NAMES` / `ruleFileNameFor` | `src/core/project-config.ts:396` / `:424` | 规则文件管理（init / update / doctor）；本变更新增读取侧消费 | `project-config-rules.test.ts` | **零改动**（复用为单一源，MUST NOT 另立映射） |
| `ruleFileTypeFor` | `src/core/project-config.ts:429` | 同上 | `project-config-rules.test.ts` | **零改动**（反向映射复用） |
| `collectRuleSources` | `src/commands/rules.ts:47` | `iagent rules` 命令、`conformance --rules-read` 校验 | `rules-command.test.ts` | 新增筛选入口（保持无参输出不变） |
| `collectProjectSkills` | `src/core/project-skills.ts:318` | `iagent skills` 命令、探索/实现基线 | `skills-command.test.ts`、`project-skills.test.ts` | 新增筛选入口（保持无参输出不变） |
| `parseSkillFrontmatter` | `src/core/project-skills.ts:107` | 同上 | `project-skills.test.ts` | **零改动**（`phases` / `scope` 已解析） |
| `buildConformance` / `ConformanceOptions.rules` | `src/core/spec/validation/conformance.ts:86` / `:60` | `runSpecConformance`（`spec.ts:632`）、apply 收尾一致性门 | `spec-conformance.test.ts` | 新增可选「豁免声明」字段 |
| `getSpecProposeSkillTemplate` | `spec-propose.ts:16` | registry 成对注册 | `stage-continuation.test.ts`、`proposal-readiness-chain.test.ts` | 规范要点按范围蒸馏 |
| `getSpecExploreSkillTemplate` | `spec-explore.ts` | registry | `skill-size-budget.test.ts`、`grill-paper-trail.test.ts` | 三层读取 + 未读声明（注意 500 行 / 20000 字符预算） |
| `getDebugSkillTemplate` | `debug.ts:212` | registry | `codegraph-protocol.test.ts`、`skill-size-budget.test.ts` | 三层读取（同上预算） |
| `getSpecApplySkillTemplate` | `spec-apply.ts` | registry | `test-evidence-gate.test.ts` | 三层读取 |
| `getSpecVerifyChangeSkillTemplate` | `spec-verify.ts:8` | registry | `verify-review-checkpoints.test.ts` | 三层读取 |
| `getReviewSkillTemplate` | `review.ts:5` | registry | `verify-review-checkpoints.test.ts` | 三层读取 |
| `IAGENT_COMMANDS` | `src/commands/completion.ts` | shell 补全生成 | `completion-config.test.ts` | 新增参数说明同步 |

### 影响面小结

- **新增为主**：1 个内核模块（`rule-selection.ts`）、3 个新能力规格、2 个 CLI 参数面。
- **改动为辅**：6 个技能正文、1 个一致性门选项、handoff 规范要点逻辑。
- **回归高危面**：`rules` / `skills` 无参输出契约（D9）；技能尺寸预算（explore 1435 行、debug 583 行已接近/超预算，改动 MUST 走 references 下沉）；`skills-parity` 快照。
- **边界约束**：`RULE_FILE_NAMES` 是唯一映射；筛选由 CLI 确定性计算；筛选为空回退常驻基线而非全量。

### 直接影响的文件

- `src/core/rule-selection.ts`（**新建**）：三层归类 + 技能筛选纯函数。
- `src/commands/rules.ts`：新增 `--type` 筛选。
- `src/commands/skills.ts`：新增 `--phase` / `--scope` 筛选。
- `src/core/spec/validation/conformance.ts`：`rules` 选项新增豁免集合。
- `src/commands/completion.ts`：参数说明同步。
- `src/core/templates/workflows/spec-explore.ts` / `debug.ts` / `spec-apply.ts` / `spec-verify.ts` / `review.ts` / `proposal-review.ts` / `spec-propose.ts`：三层读取契约 + 未读声明 + handoff 按范围蒸馏。
- `openspec/CONTEXT.md`：新增 4 条术语。
- `AGENTS.md`：新增动态加载单一源说明。

### 向后兼容

- `iagent rules --json` / `iagent skills --json` 无参输出 MUST 逐字段保持不变；
- 存量技能无 `scope` 字段 → 视为 `null`，不参与范围筛选；
- 一致性门的豁免输入为可选，不传时行为与现状一致；
- 规则源全缺失 / 技能配置为空 → 既有合法终态不变。
