## Why

propose 阶段的语义来源当前有两处——探索产物（`exploration.md` 的 Decisions / 术语表 / 边界场景）与能力探索记忆（`openspec/specs/<cap>/explorations.md`）。**二者均为自然语言散文**，缺少结构化的流程骨架，由此产生三个具体缺口：

1. **Decisions 是离散结论，不是流程**：无法表达"操作节点 N4 必须先于 N5""条件 N2 不成立时走 N3"这类**顺序与分支约束**。提案作者只能凭散文**重构**流程，重构过程即偏差引入点。
2. **任务拆解无锚点**：`tasks.md` 由 AI 从散文重构流程生成，没有"应覆盖哪些节点"的显式清单可比对。漏掉一个异常分支，在散文中不可见。
3. **验证无法定位偏差**：`venus_spec_verify_proposal` 的 D1 只统计「已匹配决策数 / 总决策数」——散文比对面宽判不细，命中 80% 决策却漏掉关键分支仍可能 PASS。而 D9（Business Steps）检查的是提案**自身**是否拆解复杂操作，属**自证**：拆解是否完整，目前只能由 AI 自己证明，**没有独立于提案的外部基准**。

既有资产中已有两块可直接复用的基础：

1. **共享文本块模式**（同日归档的 `add-prompt-validation-gate`）：`src/core/templates/prompt-gate.ts` 作为唯一源，构建期内联进 5 个技能正文，不新增技能、不动 27 技能总数断言。本变更沿用同一模式落地「功能流程图」。
2. **探索产物段落式制品**：`## 提示词基线` 段已确立"探索阶段产出 + 用户确认 + 落盘为下游唯一语义来源"的范式，`explore → 变更 exploration.md` 的迁移链路可自动跟随。

因此本变更把**探索发现的功能流程固化为结构化制品（Mermaid 流程图 + 关键操作节点清单）**，经用户最终确认后作为 propose / verify 的**流程基准**——即独立于提案自身的**他证**锚点。

## What Changes

**新增共享模块**

- 新增 `src/core/templates/flowchart-gate.ts` 作为唯一源：导出参数化渲染函数（共享流程文本，仅节点字段表按场景注入）、需求版与缺陷链路版两套常量，以及指令压缩版渲染函数。

**5 个技能新增「功能流程图」产出（分级强度）**

- `venus_tr_impl_workflow` / `venus_tr_impl_auto_workflow` / `venus_tr_impl_genfull` / `venus_tr_impl_debug`：**强制产出**功能流程图 + 流程最终确认门
- `venus_spec_explore`：**条件触发**（探索中浮现明确业务功能流程时产出并确认；无流程时记"本次无功能流程"直通，不阻断）—— 不改变其"stance not workflow"定位
- `venus_tr_impl_debug` 采用**缺陷链路变体**：只列缺陷相关节点（前置条件 → 触发 → 异常 → 根因），新增 `🔴异常` / `🟠根因` 标记列

**制品形态（探索产物 `## 功能流程图` 段）**

- **Mermaid 流程图**（`flowchart TD`）承担顺序 / 分支骨架，节点 id 形如 `N<序号>`
- **关键操作节点清单表**承担可验证字段：`节点 | 操作 | 触发条件 | 证据位置 | 异常路径`
- **节点粒度** = 可独立验证的业务操作单元（一次用户操作 / 业务判定 / 数据写入 / 外部调用）
- **证据追溯（强制反幻觉）**：每节点必须有 `证据位置`（`文件:行`）；**新建功能**节点标 `[新建]` 并写明预期产物，**不要求预测文件路径**；无法追溯的节点 MUST NOT 进入清单

**流程最终确认门**

- 独立阻塞门，置于代码库探索与 grill L1-L5 之后、探索阶段结束之前
- **复用提示词校验门的四条出口模型**（确认 / 修改 / 拒绝后按原理解继续 / 显式授权按推断继续），MUST NOT 陷入等待死锁
- **探索后发现遗漏节点** → MUST 回到探索更新流程图并**重新确认**；**禁止在 tasks 中静默补节点**（偏差的主要来源正是静默补全）

**propose 消费（`venus_spec_propose`）**

- `design.md` 引用流程图与节点清单
- `tasks.md` 每个任务**标注对应节点 id**（`[N4]` 形），实现节点 → 任务的可追溯映射

**verify 交叉验证（`venus_spec_verify_proposal`）**

- 新增独立维度「**流程图节点覆盖度**」：`覆盖度 = 被 design/tasks 覆盖的节点数 ÷ 流程图总节点数`
- 判定**优先按节点 id 显式标注**；未标注时允许 **AI 语义等价判定**（同一操作的不同措辞算命中）
- 纳入 90% 统一阈值、**与现有维度同权重**，复用既有总分公式 `(D1+…+D5 + sum(triggered)) / (5 + triggered_count)`，**不改算法核心**
- **无 `## 功能流程图` 段落 → 维度 SKIP**（不计入分母），复用 D6-D9 条件维度机制；`archive/` 下既有变更**不 FAIL**
- **D9 保留不动**（继续检查提案自证拆解）；`tr-docs-requirement-doc` 的业务流程图**不改**（它是 design.md 的下游表达）

**规格与术语同步**

- `tr-workflow-suite-skills`：MODIFIED workflow / auto-workflow / debug / genfull 的需求 + **新增「功能流程图共享模块」需求**
- `spec-workflow-skills`：MODIFIED explore / propose / verify-proposal 的需求
- `openspec/CONTEXT.md`：新增 6 条术语（功能流程图 / 关键操作节点 / 流程最终确认门 / 节点覆盖度 / 流程基准 / 缺陷链路），与既有「提示词基线」「业务流程图」「D9」显式划界

**不修改** `deriveCommandContent`（16 符号爆炸半径，7 个 spec-* 指令依赖）；技能总数保持 27，不改 `commands.test.ts` / `templates.test.ts` 硬断言。

## Capabilities

### New Capabilities

（无 —— 本变更以既有能力的行为增补形式落地）

### Modified Capabilities

- `tr-workflow-suite-skills`: tr-impl-workflow / tr-impl-auto-workflow / tr-impl-genfull 三个技能在探索阶段新增强制「功能流程图」产出与流程最终确认门（Mermaid 流程图 + 关键操作节点清单 + 证据追溯 + 四条出口确认门）；tr-impl-debug 采用缺陷链路变体（异常 / 根因节点标记）；**新增「功能流程图共享模块」需求**（唯一源 + 参数化渲染 + 指令压缩版）
- `spec-workflow-skills`: venus_spec_explore 新增**条件触发**的功能流程图产出（无流程时直通，不改变其"无固定步骤、无强制产出"定位）；venus_spec_propose 新增以节点 id 标注任务的产出要求；venus_spec_verify_proposal 新增「流程图节点覆盖度」维度（含缺失 SKIP 兼容规则）

## Impact

### 直接影响的文件

- `src/core/templates/flowchart-gate.ts`: 新增 —— 功能流程图文本唯一源（渲染函数 + 需求版/缺陷链路版常量 + 指令压缩版）
- `src/core/templates/workflows/spec-explore.ts`: instructions 插入**条件触发**的流程图产出与确认门（指令正文经 `deriveCommandContent` 自动派生；块**不得**包 `<!-- CMD:SKIP -->`）
- `src/core/templates/workflows/tr-impl-workflow.ts`: 探索阶段新增流程图章节 + 结构化格式增补 `## 功能流程图` 段；`getTrImplWorkflowCommandTemplate().content` **手工同步**压缩版
- `src/core/templates/workflows/tr-impl-auto-workflow.ts`: 同构新增 + 结构化格式同步；指令正文**手工同步**
- `src/core/templates/workflows/tr-impl-debug.ts`: 新增缺陷链路变体（异常/根因标记）+ Startup/Phase 1 衔接；指令正文**手工同步**
- `src/core/templates/workflows/tr-impl-genfull.ts`: Phase 0 / Bridge 1 插入流程图产出 + 幂等判定（上游已确认则直通）；指令正文**手工同步**
- `src/core/templates/workflows/spec-propose.ts`: tasks 生成要求标注节点 id（正文经派生同步）
- `src/core/templates/workflows/spec-verify-proposal.ts`: 新增节点覆盖度维度 + SKIP 规则 + 总分公式纳入（正文经派生同步）
- `openspec/specs/tr-workflow-suite-skills/spec.md`: delta 合并 —— 4 条 MODIFIED + 1 条 ADDED（共享模块）
- `openspec/specs/spec-workflow-skills/spec.md`: delta 合并 —— 3 条 MODIFIED（explore / propose / verify-proposal）
- `openspec/CONTEXT.md`: 新增 6 条术语
- `test/*.test.ts`: 新增「5 技能含功能流程图段落」断言；派生一致性测试扩展
- `skills/**/SKILL.md`: `pnpm build && pnpm generate:skills` 重生成静态快照（防漂移测试要求）

### 向后兼容

无破坏性变更。全部为**增量探索步骤 + 增量验证维度**：既有阶段编号、checkpoint 语义、注册结构、技能总数（27）、`allowed-tools` 白名单、D1-D9 既有算法均不变。

- **既有变更兼容**：`archive/` 下 10 个变更与在途变更无 `## 功能流程图` 段 → verify 新维度 **SKIP**，不 FAIL
- **新建功能场景**：节点证据位置标 `[新建]`，不强制预测文件路径，避免迫使 AI 编造路径
- **用户拒绝确认**：记录未确认状态，propose 降级为仅凭 exploration.md，verify SKIP —— 不阻塞流程
- **幂等**：genfull Phase 0 已确认流程图后，Stage 1 委派的 explore 检测到既有流程基准时直接通过，不重复确认
