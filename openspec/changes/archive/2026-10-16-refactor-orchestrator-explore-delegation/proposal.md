## Why

`iagent_workflow` 与 `iagent_auto_workflow` 各自**内联**实现了一整套 Phase 1 探索逻辑（强制建探索文件 → 提示词校验门 → CONTEXT.md 检查 → CodeGraph 基础扫描/多项目派发/深度分析 → L1-L5 grill 追问 → 功能流程图门 → 聚合一致性门 → 完成检测），与 `iagent_spec_explore` 的探索能力三处重叠。这是 P2 中**探索阶段**的重复真源（提案 B 已消除**提案阶段**的重复；探索记录见 `openspec/explorations/explore-delegation-explore-001.md`）。

历史内联动机"无 Skill 委派断层"已由 B 确认为可解（用**委派执行模式**让出阶段主权）。探索阶段的额外难点是：`iagent_spec_explore` 是 **"stance, not a workflow"**（`## The Stance`：无固定步骤、无强制产出），而编排器内联版带一套**强制 checkpoint 体系**。

**裁决（最优解）**：`iagent_spec_explore` 采用**双模式**——`delegated` 模式吸收强制 checkpoint 体系并产出结构化 handoff；`interactive` 模式保持立场式且行为不变。据此编排器 Phase 1 改为委派。

**依赖**：本变更与 B（`refactor-orchestrator-propose-delegation`）均修改 `workflow-suite-skills / auto-workflow 全自动管线` 与 `skill-profile / 依赖注入`，B2 的 delta 以 **B 落地后**的形态为准——实现次序 MUST 为 A → B → B2。

## What Changes

1. **`iagent_spec_explore` 新增 `delegated` 执行模式**（`mode=delegated|interactive`，默认 `interactive`）：
   - `interactive`（手动探索）行为**与现状一致**——立场式、无固定步骤、无强制产出；
   - `delegated`（编排器调用）SHALL 执行**强制 checkpoint 体系**：调用即强制创建探索文件（keyword/sequence/冲突重试）、提示词校验门、CONTEXT.md 启动检查、CodeGraph 基础扫描（含多项目派发与深度分析触发）、**L1-L5 grill 追问（逐级确认门）**、功能流程图产出与流程最终确认门、**聚合一致性门**、**探索完成检测**；
   - `delegated` 完成时 SHALL 输出**结构化 handoff**（探索文件路径、提示词基线、流程基准确认状态、Pending 影响符号），并**交回阶段主权**（MUST NOT 自行进入提案/实现）。
2. **`iagent_workflow` Phase 1 改为委派**：经 Skill 工具委派 `iagent_spec_explore`（`mode=delegated`），删除内联 Phase 1 正文；编排器依据 handoff 推进 Phase 2（B 后的委派）。
3. **`iagent_auto_workflow` Phase 1 改为委派**：同构委派（`mode=delegated`）；其"提示词门/流程图门不被 auto 语义跳过"的要求不变（门在 `spec_explore` 内照常等待）。
4. **依赖注入与白名单同步**：`DEPS` 增加 `workflow ⇒ spec-explore`、`auto-workflow ⇒ spec-explore`；两编排器 `allowedTools` 经 `${skillDelegation(['spec_explore'])}` 补条目。
5. **退出守卫统一**：被委派的 `spec_explore` 完成后 MUST NOT 推进阶段；阶段主权归编排器。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `spec-workflow-skills`: `iagent_spec_explore` 新增 `delegated` 执行模式契约（强制 checkpoint 体系 + 结构化 handoff；`interactive` 保持立场式不变）。
- `workflow-suite-skills`: `workflow` 探索阶段由"内联强制 checkpoint 体系"改为"委派 `iagent_spec_explore`"；`auto-workflow` 全自动管线的 Phase 1 同步改为委派。
- `skill-profile`: 依赖注入新增 `workflow` / `auto-workflow` ⇒ `spec-explore`。

## Impact

### 直接影响的文件

- `src/core/templates/workflows/spec-explore.ts`: 新增 `delegated` 模式分支（强制 checkpoint 体系 + 结构化 handoff）
- `src/core/templates/workflows/workflow.ts`: Phase 1 内联正文替换为委派 `spec_explore`（`mode=delegated`）
- `src/core/templates/workflows/auto-workflow.ts`: Phase 1 内联正文替换为委派 `spec_explore`
- `src/core/profiles.ts`: `DEPS` 增加 `workflow` / `auto-workflow` ⇒ `spec-explore`
- 白名单：两编排器 `allowedTools` 补 `Skill(spec_explore)`
- `test/`：委派/DEPS 覆盖校验、编排测试同步
- `skills/`: 快照重新生成（`pnpm build && pnpm generate:skills`）
- `AGENTS.md` / `docs/skills-manual.md`: 编排探索阶段委派说明同步

### 向后兼容

- **`spec_explore` `interactive` 模式**：用户手动 `/iagent:spec-explore` 行为完全不变（立场式）。
- **门语义不变**：提示词校验门、流程最终确认门、L1-L5 追问门在 `delegated` 模式照常等待；`auto-workflow` "门不被 auto 语义跳过"要求不因委派改变。
- **实现次序**：MUST 在 A 与 B 之后（三方共同修改 `auto-workflow 全自动管线` 与 `依赖注入` 需求）。
- **[待确认]** 双模式 vs 共享协议（S3）——已裁决双模式；S3 记为备选。
