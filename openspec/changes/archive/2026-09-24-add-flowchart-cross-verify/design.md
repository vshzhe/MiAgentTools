## Context

### 架构现状

VenusAgentTools 技能模板分两条流水线：模板（`src/core/templates/`）→ `pnpm build`（tsc → dist/）→ `pnpm generate:skills`（`skills/` 静态快照）→ `venus init`（目标项目 `.claude/`）。

**同类先例（同日归档 `add-prompt-validation-gate`）**已确立可复用的接入模式：

1. **共享文本块内置**：`src/core/templates/prompt-gate.ts` 作为唯一源，导出参数化渲染函数与维度常量；5 个技能模板 `import` 后在构建期内联进正文。不新增技能（新增技能需同步 6+ 处技能总数断言与依赖注入链，与入口级检查不成比例）。
2. **参数化渲染**：需求版（`REQUIREMENT_DIMENSIONS`）与缺陷版（`BUG_DIMENSIONS`）仅维度表与清晰判据不同，Step 2-5 流程文本共享，以 `buildPromptGateBlock(dimensions)` 渲染。
3. **命令派生双轨制**：`spec-explore` 的 CommandTemplate 经 `deriveCommandContent(instructions)` 自动派生；4 个 tr_impl 技能为手写压缩正文，须手工同步。
4. **探索产物段落式制品**：`## 提示词基线` 段（原始 + 确认后一并落盘），随 `explore → 变更 exploration.md` 迁移自动跟随。

### 本次接入点（已由 CodeGraph 与源码核验）

| 技能 | 探索阶段结构 | 流程图接入点 |
| :--- | :--- | :--- |
| `venus_tr_impl_workflow` | 1.1→1.1.2(门)→1.1.5→1.2→1.2.0.5→1.2.1→1.2.1.5→1.2.2/1.2.3→1.2.4→1.3(grill)→1.4(关键词分析)→1.4.5(深潜)→1.5(更新文件)→1.6(完成检测)→1.6.5(CONTEXT 检查点)→1.6.6(聚合一致性门)→1.7 | **1.5.5**（1.5 之后、1.6 之前，使 1.6.6 聚合一致性门覆盖本制品） |
| `venus_tr_impl_auto_workflow` | 同构精简（1.1→1.1.2→1.1.5→1.2→1.2.0.5→1.2.1→1.2.1.5→1.3→1.4→1.5） | **1.5.5**（同构位置） |
| `venus_tr_impl_debug` | Startup(0.门)→Phase 1 复现→Phase 2 排查(2.4 根因确认门)→Phase 3 关联判定→Phase 4 修复→Phase 5 编译→Phase 6 同步→Phase 7 验证 | **2.5**（2.4 根因确认门之后、Phase 3 之前 —— 异常/根因节点须待根因确认后才可知） |
| `venus_tr_impl_genfull` | Phase 0(0.0 门)→Stage 1 委派 explore→Bridge 1→Stage 1.5→Stage 2→Bridge 2→Stage 3→Bridge 3→Stage 4 | **Bridge 1**（兜底补建 + 并入 Bridge 1 门决策；复用既有「exploration.md 兜底」模式） |
| `venus_spec_explore` | `Input`→(门)→`The Stance`→`What You Might Do`→…→`Ending Discovery`（无固定步骤、无强制产出） | **条件触发**，在探索浮现明确流程时产出（不设固定编号步骤） |

### 消费方现状

- `venus_spec_propose`：按依赖序生成 proposal→specs/design→tasks，是流程基准的**消费方**
- `venus_spec_verify_proposal`：D1-D9 评分（D6-D9 条件触发），总分公式 `(D1+…+D5 + sum(triggered)) / (5 + triggered_count)`（`spec-verify-proposal.ts:309`），阈值 90%。**D9（Business Steps）为"自证"**——检查提案自身是否拆解复杂操作，无外部基准

### 影响链（`codegraph_impact` 结果）

| 符号 | 上游影响 | 处理 |
| :--- | :--- | :--- |
| `deriveCommandContent` | **16 符号**（7 个 spec-* CommandTemplate 全部依赖） | **不修改** |
| `getSpecProposeSkillTemplate` / `getSpecVerifyProposalSkillTemplate` | 各 3 符号 | 编辑正文（派生同步） |
| `getTrImplDebugSkillTemplate` | 2 符号 | 编辑正文 + 手工同步压缩指令版 |
| `getSpecExploreSkillTemplate` / `getTrImplWorkflowSkillTemplate` / `getTrImplAutoWorkflowSkillTemplate` / `getTrImplGenfullSkillTemplate` | 各 2-3 符号 | 编辑正文（spec-explore 派生同步；其余手工同步） |
| 新增 `flowchart-gate.ts` | 无 | 纯新增 |

## Goals / Non-Goals

**Goals**:

- 5 个工作流技能的探索阶段产出**结构化流程制品**（Mermaid 流程图 + 关键操作节点清单），节点可追溯到探索证据
- 制品经**用户最终确认**后成为**流程基准**——独立于提案自身的交叉验证锚点
- propose 以节点为生成锚点（design 引用、tasks 标注节点 id）
- verify 新增「流程图节点覆盖度」维度，量化提案/任务与探索流程的偏差，并能**定位到具体未覆盖节点**
- 完全向后兼容：既有归档变更、纯文档变更、无流程场景均不被误伤

**Non-Goals**:

- 不新增技能（技能总数保持 27）
- 不修改 `deriveCommandContent`（16 符号爆炸半径）
- 不改 D1-D9 既有算法核心（尤其**保留 D9**）
- 不改 `tr-docs-requirement-doc` 的业务流程图（design.md 的下游表达）
- 不改 apply / archive / bulk-archive / review-proposal
- 不新增 CLI 命令
- 不强制 `venus_spec_explore` 固定产出（保持其"stance not workflow"定位）

## Decisions

### D1: 复用方式 —— 共享文本块内置

- **选择**: 新增 `src/core/templates/flowchart-gate.ts` 作为唯一源，构建期内联进 5 个技能正文；不新增技能
- **理由**: 与先例 `prompt-gate.ts` 完全同构，改动面最小；技能总数保持 27，不触碰 `test/templates.test.ts:14` / `test/commands.test.ts` 硬断言；生成的 SKILL.md 仍自包含（安装到目标项目后无跨技能调用往返）
- **备选**: 新增独立技能 `venus_tr_impl_flowchart` 经 Skill 工具委派 —— 可单独调用，但技能总数 27→28 需同步 6+ 处断言与依赖注入链（先例已否决同一方案）；在各技能正文内联重复文本 —— 5 份独立维护，引入漂移风险（先例 `双模板漂移` 教训）

### D2: 产出强度 —— 分级

- **选择**: 4 个流程技能（workflow / auto-workflow / genfull / debug）**强制产出**；`venus_spec_explore` **条件触发**（无流程时记「本次无功能流程」直通）
- **理由**: 流程编排器必然有可描述的流程，强制产出才有意义；explore 的定位是"没有固定步骤、没有强制产出"的思考伙伴，先例 `add-prompt-validation-gate` 的记忆明确记载"不把该模式改造成固定流程"，对 explore 强制将连带要求修订 `spec-workflow-skills` 的 explore 定位
- **备选**: 一律强制（违背先例教训、连带改规格）；一律条件触发（流程编排器可能因判定"无流程"跳过，弱化改造效果）

### D3: genfull 的强制性与 explore 条件触发的冲突消解

- **选择**: genfull 在 **Bridge 1** 增加「功能流程图兜底」步骤——检查 `exploration.md` 是否含 `## 功能流程图` 段，缺失时（Stage 1 委派的 explore 走条件触发分支未产出）由 genfull 依据 exploration.md 的 Decisions / 边界场景 / Codebase Findings **强制补建**，并在 Bridge 1 门决策中一并请用户确认
- **理由**: 既满足 genfull"强制"的语义（genfull 自身保证制品存在），又不违反 explore 的"条件触发"定位（不改造 explore）。复用 Bridge 1 既有的「exploration.md 兜底补建」模式（`genfull` Bridge 1 ①），属同构扩展而非新机制；幂等规则与既有提示词基线幂等一致
- **备选**: 让 genfull 委派时传参强制 explore 产出 —— 破坏 explore 定位；genfull 走条件触发 —— 弱化"强制"语义

### D4: 制品结构 —— Mermaid 图 + 节点清单表

- **选择**: `## 功能流程图` 段 = Mermaid `flowchart TD`（顺序/分支骨架）+ 关键操作节点清单表（节点 / 操作 / 触发条件 / 证据位置 / 异常路径）；节点 id `N<序号>` 在两处稳定一致
- **理由**: verify 的节点覆盖度算法需要**可枚举、可逐一匹配的节点标识**（Mermaid 节点 id 天然胜任，散文不行）；propose 的 tasks 拆解需要**节点级证据位置**才能落位。纯图方案需解析图文本，缺结构化字段
- **备选**: 纯 Mermaid 图（无结构化锚点）；表格优先（复杂分支/回环图形表达力弱）

### D5: 节点定义与证据追溯

- **选择**: 节点粒度 = 可独立验证的业务操作单元（一次用户操作 / 业务判定 / 数据写入 / 外部调用）；每节点 MUST 含证据位置（`文件:行` 或类.方法）；**新建功能**节点标 `[新建]` + 预期产物，不要求预测文件路径；无法追溯证据的节点 MUST NOT 进入清单
- **理由**: 反幻觉是本次的核心安全约束——虚假节点会成为 propose 的生成锚点，把偏差**结构化固化**（比散文偏差更难发现）。分级证据（`[新建]` 标记）解决"新建功能无既有代码"这一最高频场景，避免迫使 AI 编造路径
- **备选**: 严格证据制（新建功能也须给出将新建的文件路径 —— 迫使探索期承诺路径，过早决策）；证据非强制（丢失反幻觉约束）

### D6: 流程最终确认门 —— 四出口模型

- **选择**: 独立阻塞门，复用提示词校验门的四条出口（确认 / 修改 / 拒绝后按原理解继续 / 显式授权按推断继续）；**拒绝出口**下 propose 降级为仅凭 exploration.md、verify 该维度 SKIP
- **理由**: 先例能力记忆明确记载"缺第四条时不愿逐项裁决的用户会把流程永久卡在等待态，比不校验更糟"。拒绝出口必须有降级路径，否则门成为硬阻塞
- **备选**: 仅"确认 / 修改"两条出口（有等待死锁风险）

### D7: 遗漏节点的回改规则

- **选择**: propose/verify 阶段发现遗漏节点时 MUST **回到探索阶段**更新流程图并重新确认；MUST NOT 在 tasks 中静默补节点
- **理由**: 静默补全正是本次要消除的偏差来源。流程基准的约束力来自"基准不可被下游单方面改写"
- **备选**: 允许 tasks 补节点并在 verify 中豁免 —— 基准失去约束力，改造退化为文书工作

### D8: 参数化渲染 —— 需求版 / 缺陷链路版

- **选择**: `buildFlowchartBlock(columns)` 参数化渲染，共享「生成 → 用户最终确认 → 落盘」流程文本，仅节点清单表列集不同（需求版含「触发条件 / 异常路径」；缺陷链路版含「标记」列，标 `🔴异常` / `🟠根因`）；节点范围亦不同（缺陷链路只覆盖前置条件 → 触发 → 异常 → 根因，非功能全流程）
- **理由**: 与 `prompt-gate.ts` 的 `buildPromptGateBlock(dimensions)` 同构，避免两份流程文本漂移；debug 的 Phase 1 强制复现与缺陷链路天然衔接，节点证据在缺陷场景天然充足
- **备选**: 双份独立文本（漂移风险）；缺陷场景复用需求版（与复现步骤重叠、丢失异常/根因标记）

### D9: verify 维度 —— 新增独立维度而非增强既有

- **选择**: 新增「流程图节点覆盖度」维度，与 D1-D9 同权重参与平均分（纳入 `triggered` 集合，复用既有总分公式）；**D9 保留不动**
- **理由**: D9 是"自证"（检查提案是否拆解复杂操作），新维度是"他证"（与外部流程基准比对）——两者语义不同、互补。D9 查"是否拆了"，新维度查"是否拆对/拆全"。增强既有 D1/D3 会稀释评分口径，无法定位偏差来源
- **备选**: 合并进 D9（语义混淆，且无流程图变更会丢失 D9 原有检查）；增强 D1/D3（口径稀释）

### D10: 覆盖度算法与缺失兼容

- **选择**: `覆盖度 = 被覆盖节点数 ÷ 总节点数`；判定**优先按节点 id 显式标注**，未标注时允许 AI **语义等价判定**（同一操作的不同措辞算命中）；无 `## 功能流程图` 段 → 维度 **SKIP**（不计入分母）；FAIL 时列出**未覆盖节点 id 清单**
- **理由**: 严格 id 匹配对措辞差异零容忍（标注遗漏会被判为真偏差）；纯语义匹配可复现性弱——两者结合取长补短。SKIP 机制与 D6-D9 条件维度同构（`spec-verify-proposal.ts:78-92` 既有），无需发明新机制；兼容性硬约束：`archive/` 下 10 个既有变更均无流程图段落，设 FAIL 会使重新验证全部失败
- **备选**: 严格 id 匹配；无流程图即 FAIL（与 D2 的 explore 条件触发自相矛盾）

### D11: 不修改 `deriveCommandContent`

- **选择**: 仅新增模块 + 编辑模板文件，不动派生器
- **理由**: 该函数被 7 个 spec-* 指令模板依赖，`codegraph_impact` 实测影响 16 个符号。本次无需改派生逻辑
- **备选**: 扩展派生器支持流程图裁剪 —— 无必要，且引入 spec 全链回归风险

### D12: 位置选择 —— 不重排既有 checkpoint 语义

- **选择**: 沿用先例的十进制插入法（`1.5.5` / `2.5`），不重排既有编号
- **理由**: 既有编号被规格文本引用（如「Phase 1.1.2」「1.1.5 CONTEXT.md 启动检查」），重排会造成大面积规格改动。workflow / auto-workflow 置于 1.5.5 使 1.6.6 聚合一致性门覆盖本制品；debug 置于 2.5 因异常/根因节点须待 2.4 根因确认后方可知
- **备选**: 重排编号（大面积规格改动，无收益）

### D13: 测试策略

- **选择**: 新增「5 技能正文含功能流程图文本」断言；扩展 `test/template-derivation.test.ts`（spec-explore 派生正文含流程图块）；`pnpm build && pnpm generate:skills` 重生成快照由 `test/skills-parity.test.ts` 守住
- **理由**: 与先例的测试链一致；技能总数断言（27）不变，无需改动
- **备选**: 仅依赖快照一致性测试（无法断言"5 技能都含本制品"这一行为要求）

### D14: 版本号

- **选择**: minor 递增（功能新增），CHANGELOG 归档 `[Unreleased]` 并补条目，随本次功能提交一并提交
- **理由**: AGENTS.md 第 8 条：功能新增或变更 → minor
- **备选**: patch（本次为技能行为新增，非修复，判定为 minor）

## Risks / Trade-offs

| 风险 | 缓解 |
| :--- | :--- |
| **节点虚构成既定前提**（虚假节点成为 propose 锚点，偏差被结构化固化） | 节点强制证据追溯（`文件:行` 或 `[新建]`）；无法追溯的节点 MUST NOT 进入清单；用户最终确认门是最后一道闸 |
| **确认门增加用户打扰**（5 技能每次探索都多一道确认） | 确认门设在探索末尾（用户已投入上下文，确认成本低于打断）；explore 条件触发直通；四条出口避免死锁 |
| **手写压缩指令正文漏同步**（4 个 tr_impl 技能） | 沿用先例的处理：显式列入 tasks 的独立任务项；新增「5 技能正文含流程图文本」断言覆盖 skill 版，压缩版由 tasks 显式核对 |
| **verify 新维度误伤既有变更** | 无流程图段落 → 维度 SKIP、不计入分母；`archive/` 下 10 个变更重新验证不 FAIL |
| **explore 的"无固定步骤"定位被破坏** | 条件触发 + 显式规定"纯概念探讨记「本次无功能流程」直通"；`spec-workflow-skills` 规格中明文写入该约束 |
| **流程基准与探索结论漂移**（探索期确认后发现新节点） | 强制回探索更新并重新确认；禁止 tasks 静默补节点（D7） |
| **语义等价匹配的主观性** | 优先 id 标注（可复现）；语义判定仅作补充；FAIL 时输出未覆盖节点 id 清单使判定可审计 |
| **genfull 兜底与 explore 产出的重复确认** | Bridge 1 兜底幂等：已含经确认的 `## 功能流程图` 段时直接通过 |
| **流程图与提示词基线的一致性** | 两者同属"唯一语义来源"，流程图变更须回确认门；两段落均随 exploration.md 迁移自动跟随 |
| **共享块引入新 Bash 命令致权限拦截**（`tr-impl-workflow` / `tr-impl-genfull` 的 `allowedTools` 不含 pnpm/npm） | 块文本 MUST NOT 含任何 Bash 命令示例；`pnpm build && pnpm generate:skills` 仅出现在本变更 tasks（开发者执行），不写入技能正文（tasks 1.2 专项核对） |
| **verify 技能的只读约束被破坏**（`spec-verify-proposal` 无 Write/Edit） | 新维度保持只读评分，修复建议仅呈现给调用方，技能自身不 Edit 制品（tasks 3.2 专项核对） |
