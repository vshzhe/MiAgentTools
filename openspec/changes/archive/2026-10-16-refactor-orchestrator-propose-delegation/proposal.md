## Why

`iagent_workflow`（引导式）与 `iagent_auto_workflow`（全自动）各自**内联**实现了一套提案生成逻辑（预迁移验证 → 探索文件迁移 → 制品生成 → 规则注入 → schema 验证），而 `iagent_spec_propose` 是同一逻辑的第三份真源。三份逻辑改一处须改三处，已构成结构性的**不一致来源**（探索记录见 `openspec/explorations/orchestrator-delegation-explore-001.md`；整体根因见 `skill-system-review-explore-001.md` 的 P2）。

历史内联的动机是"无 Skill 委派断层"——`workflow` 正文明确写着 *"Do NOT invoke `Skill('iagent:spec-propose')` to generate artifacts (…for workflow continuity)"*。经探索确认，"断层"的实质**不是上下文丢失**（Claude Code 的 Skill 调用在会话内加载），而是**子技能自身的规划边界/阶段推进会中断编排器的连续流程**。因此委派可行的关键，是给 `spec_propose` 一个**委派执行模式**，让它让出阶段推进主权。

本项目已有先例：`iagent_spec_apply` 接受 `auto-mode=true`，显式跳过其 Step 5.5 设计确认门（*"This gate CANNOT be skipped when auto-mode is not set"*），编排器据此委派实现阶段而不产生双重确认门。本变更把同一模式推广到提案阶段。

**范围裁决（探索记录 D3）**：本变更**仅委派提案阶段（Phase 2）**。探索阶段（Phase 1）委派**不在范围内**——`iagent_spec_explore` 是"stance, not a workflow"设计、**缺**编排器内联版的强制 checkpoint 体系（强制创建探索文件、CONTEXT.md 启动检查、CodeGraph 基础扫描、L1-L5 grill 追问、聚合一致性门），委派它须先决定是否把这些搬进 `spec_explore`（实质改变其设计哲学），属独立设计取舍，另立变更。

**依赖**：本变更的委派校验（`Skill(...)` 条目、`DEPS` 覆盖）依赖 `improve-template-generation-consistency`（引用单一源 + 死引用回归锁）先落地；若尚未落地，本变更的 tasks 需自建等效校验。

## What Changes

1. **`iagent_spec_propose` 新增 `delegated` 执行模式**（`mode=delegated|interactive`，默认 `interactive`）：
   - 接受 `exploration-file=<path>` 输入 → 跳过 Step 0 的探索文件关联**用户提示**（直接迁移该文件）；
   - 抑制结尾的 "wait for user confirmation before suggesting implementation" 停点（planning boundary 确认交由编排器的阶段桥承载）；
   - 抑制自身 Phase 3 验证（`spec_verify_proposal` + `requirement_doc`）——编排器的 Phase 3 是其**超集**（额外含 `proposal_review` 深度复查），避免重复评分与重复需求文档生成；
   - `interactive`（默认，用户直接调用 `/iagent:spec-propose`）行为**与现状完全一致**。
2. **`iagent_workflow` Phase 2 改为委派**：经 Skill 工具委派 `iagent_spec_propose`（传 `mode=delegated` + `exploration-file`），删除内联提案正文；保留编排器自身的 Phase 2.0 预迁移验证/影响分析（编排职责，见 design D2）与 Phase 3 验证门/深度复查/需求文档。
3. **`iagent_auto_workflow` Phase 2 改为委派**：同构改为委派 `iagent_spec_propose`（`mode=delegated`），删除其"精简版内联提案"副本；Phase 1-3 的"与 workflow 同构"表述更新为"Phase 1 探索保持内联，Phase 2 委派"。
4. **依赖注入与白名单同步**：`DEPS` 增加 `workflow ⇒ spec-propose`、`auto-workflow ⇒ spec-propose`（被委派技能必须随装）；`workflow` / `auto-workflow` 的 `allowedTools` 经 `${skillDelegation(['spec_propose'])}` 补 `Skill(spec_propose)` 条目。
5. **退出守卫统一**：新增/强化 guardrail——被委派的 `spec_propose` 完成后 MUST NOT 自行进入实现阶段；阶段完成判定与推进主权归编排器。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `spec-workflow-skills`: `iagent_spec_propose` 新增 `delegated` 执行模式契约（`mode` 参数、`exploration-file` 输入、抑制停点与自身 Phase 3、`interactive` 默认行为不变）。
- `workflow-suite-skills`: `workflow` 提案阶段由"内联生成"改为"委派 `iagent_spec_propose`"；`auto-workflow` 全自动管线的提案阶段同步改为委派；编排技能的委派白名单齐备性要求补 `Skill(spec_propose)` 条目。
- `skill-profile`: 依赖注入新增 `workflow` / `auto-workflow` ⇒ `spec-propose`。

## Impact

### 直接影响的文件

- `src/core/templates/workflows/spec-propose.ts`: 新增 `delegated` 模式分支（Input 说明、Step 0 跳过、结尾停点抑制、Phase 3 抑制）
- `src/core/templates/workflows/workflow.ts`: Phase 2 内联正文改为委派 `spec_propose`；删除内联制品生成主体
- `src/core/templates/workflows/auto-workflow.ts`: Phase 2 精简内联正文改为委派 `spec_propose`
- `src/core/profiles.ts`: `DEPS` 增加 `workflow` / `auto-workflow` ⇒ `spec-propose`
- 白名单：两编排器 `allowedTools` 补 `Skill(spec_propose)`（经 `skillDelegation`）
- `test/`: 委派与 DEPS 覆盖校验（若 `improve-template-generation-consistency` 未落地则自建）、既有编排测试同步
- `skills/`: 快照重新生成（`pnpm build && pnpm generate:skills`）
- `AGENTS.md` / `docs/skills-manual.md`：编排阶段委派说明同步

### 向后兼容

- **`spec_propose` `interactive` 模式**：用户直接调用 `/iagent:spec-propose` 时行为完全不变（Step 0 提示、自身 Phase 3、结尾停点均在）。
- **编排器行为**：`workflow` / `auto-workflow` 的阶段门（提示词门/流程图门/L1-L5/实现桥/归档桥）保持不变；被委派的 `spec_propose` 不新增/不减少任何对话级确认门。
- **CLI 降级路径**：`spec_propose` 既有的 CLI-degraded 生成路径保留，编排器无需重复实现。
- **[待确认]** Phase 2.0 预迁移验证/影响分析归编排器还是 `spec_propose`（design D2 记录裁决）。
