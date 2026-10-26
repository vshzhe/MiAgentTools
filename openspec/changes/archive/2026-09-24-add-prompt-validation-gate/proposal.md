## Why

工作流类技能（explore / workflow / auto-workflow / debug / genfull）当前**直接以用户原始输入为起点**进入探索分析：`venus_tr_impl_workflow` 在 1.1 建探索文件后立即进入 CONTEXT.md 检查与 grill L1-L5 追问，`venus_tr_impl_debug` 在 Startup 段记录 bug 描述后直接进入强制复现，`venus_spec_explore` 更是刻意不设固定步骤。

这带来一个系统性偏差源：**用户提示词本身的含糊没有被显式校验**。当用户输入是"优化一下导出"、"那个页面有问题"这类缺少目标/对象/范围/验收的表述时，AI 会把**自己的猜测**当作既定前提展开探索，并把猜测固化进探索文件的 Background、Decisions，进而传导到 proposal / design / specs / tasks —— 后续所有阶段都在错误基线之上工作，而偏差直到实现阶段甚至归档后才暴露。

既有资产中已有两块可复用的基础，但均未被用在入口处：

1. `docs/prompt.md` 定义了「提示词优化器」：分析 → 补全缺失要素（任务目标/角色/输出格式/限制/验收标准）→ 输出 `【优化后提示词】` + `【优化说明】`，且明确规则"不篡改用户原始意图，只做结构化、补全约束"。
2. `venus_spec_explore` 的 Guardrails 已确立歧义分级阈值：实质歧义（范围 / 行为契约 / 向后兼容 / 验收标准）必须上报 `[待确认]`，细节级歧义可合理假设并记录 —— 该阈值可直接作为本门的判定基线，无需新造标准。

因此本变更在 5 个技能的**入口处**统一加入「提示词校验门」，把偏差拦截在探索开始之前。

## What Changes

**新增共享模块**

- 新增 `src/core/templates/prompt-gate.ts` 作为唯一源：导出参数化渲染函数 `buildPromptGateBlock(dimensions)`（共享 Step 1–5 流程文本，仅维度表按场景注入）、需求六维常量 `REQUIREMENT_DIMENSIONS`、bug 五维常量 `BUG_DIMENSIONS`、指令压缩版 `PROMPT_GATE_COMPACT`。

**5 个技能加入校验门（分级门）**

- `venus_spec_explore`：`Input` 段之后、`The Stance` 之前插入**条件触发**的门（含糊时激活，清晰则直接进入思考伙伴模式）—— 不改变其"stance not workflow"定位
- `venus_tr_impl_workflow`：新增 `1.1.2 Prompt Validation Gate`（1.1 建探索文件之后、1.1.5 之前），强制
- `venus_tr_impl_auto_workflow`：新增 Phase 1.1.2（同构），强制，澄清门不得被 auto 语义跳过
- `venus_tr_impl_debug`：`Startup` 段内、Phase 1 强制复现之前，强制，维度换为 bug 五维（症状 / 复现步骤 / 期望 vs 实际 / 环境 / 歧义）
- `venus_tr_impl_genfull`：`Phase 0` 内、Stage 1 委派 explore 之前，强制

**门的行为（分级）**

- **清晰**（目标/对象/范围/歧义四维无 ❌⚠）：一句话复述理解后直接进入探索 —— 不输出校验表、不要求确认
- **不明确**（任一维 ❌ 或实质 ⚠）：执行提示词优化，输出 `【优化后提示词】`（含 `[推断]` / `[待确认]` 标注）与 `【优化说明】`，**阻塞等待用户确认或修改**
- **软不明确**（仅细节级歧义）：记 `[假设]` 继续，不阻断（沿用 explore 既有 Guardrails 阈值）
- 用户拒绝优化时记录原始提示词、按其原有理解继续，不强制改写

**落盘与幂等**

- 探索产物新增 `## 提示词基线` 段，同时记录「原始提示词」与「确认后的提示词基线」，下游以基线为唯一语义来源
- genfull Phase 0 已产出基线时，Stage 1 委派的 explore 检测到后不重复确认（幂等）

**规格与术语同步**

- `tr-workflow-suite-skills`：MODIFIED workflow / auto-workflow / debug 的需求；**新增 genfull 需求**（补齐既有规格缺口）
- `spec-workflow-skills`：MODIFIED explore 需求
- `openspec/CONTEXT.md`：新增术语「提示词校验门」「提示词基线」，并与既有「蒸馏确认门」显式区分

**不修改** `deriveCommandContent`（16 符号爆炸半径，7 个 spec-* 指令依赖）；技能总数保持 27，不改 `commands.test.ts` / `templates.test.ts` 硬断言。

## Capabilities

### New Capabilities

（无 —— 本变更以既有能力的行为增补形式落地）

### Modified Capabilities

- `tr-workflow-suite-skills`: tr-impl-workflow / tr-impl-auto-workflow / tr-impl-debug 三个技能在入口处新增强制「提示词校验门」（六维清晰度自检 → 分级判定 → 不明确分支的提示词优化与阻塞确认门 → `## 提示词基线` 落盘）；debug 采用 bug 五维；**并新增 tr-impl-genfull 需求**（补齐既有规格缺口）
- `spec-workflow-skills`: venus_spec_explore 在探索前新增**条件触发**的提示词校验门（含糊时激活，清晰则直通），不改变其"无固定步骤、无强制产出"定位

## Impact

### 直接影响的文件

- `src/core/templates/prompt-gate.ts`: 新增 —— 门文本唯一源（渲染函数 + 两套维度常量 + 指令压缩版）
- `src/core/templates/workflows/spec-explore.ts`: instructions 插入条件触发的门（指令正文经 `deriveCommandContent` 自动派生，块不得包 `<!-- CMD:SKIP -->`）
- `src/core/templates/workflows/tr-impl-workflow.ts`: 新增 1.1.2 章节 + 1.2 结构化格式增补 `## 提示词基线` 段；`getTrImplWorkflowCommandTemplate().content` 手工同步压缩版
- `src/core/templates/workflows/tr-impl-auto-workflow.ts`: 新增 Phase 1.1.2 + 结构化格式同步；指令正文手工同步
- `src/core/templates/workflows/tr-impl-debug.ts`: Startup 段插入门（bug 五维）；指令正文手工同步
- `src/core/templates/workflows/tr-impl-genfull.ts`: Phase 0 插入门 + 幂等判定；指令正文手工同步
- `openspec/specs/tr-workflow-suite-skills/spec.md`: delta 合并 —— 3 条 MODIFIED + 1 条 ADDED（genfull）
- `openspec/specs/spec-workflow-skills/spec.md`: delta 合并 —— 1 条 MODIFIED（explore）
- `openspec/CONTEXT.md`: 新增 2 条术语
- `skills/**/SKILL.md`: `pnpm build && pnpm generate:skills` 重生成静态快照（防漂移测试要求）

### 向后兼容

无破坏性变更。门为**增量入口步骤**：既有阶段、编号、checkpoint 语义、注册结构、技能总数、`allowed-tools` 白名单均不变；清晰输入路径零打扰（不引入用户可感知的额外确认）。既有已归档变更与在途探索文件不受影响（`## 提示词基线` 段缺失时按"门尚未执行"处理，不报错）。
