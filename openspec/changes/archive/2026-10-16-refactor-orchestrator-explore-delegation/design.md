## Context

- **Phase 1 内联重复**：`workflow.ts` Phase 1（`### 1.1`–`### 1.7`，含 1.1 强制建文件 / 1.1.2 提示词门 / 1.1.5 CONTEXT.md / 1.2.x CodeGraph 扫描+多项目派发+深度分析 / 1.3 L1-L5 grill / 1.4.x 关键词分析 / 1.5.5 流程图门 / 1.6 完成检测 / 1.6.6 聚合一致性门）与 `auto-workflow.ts` Phase 1（同构精简版）重复。
- **`spec_explore` 现状**：`spec-workflow-skills / spec-explore 探索技能` 已要求 CodeGraph 强制首动作、探索文件持久化、CONTEXT.md 术语表检查、提示词校验门（prompt-gate 单一源）、功能流程图（flowchart-gate 单一源）、写入确认门、re-read、材料性歧义划分；**缺** L1-L5 grill、多项目扫描/深度分析、聚合一致性门、完成检测。模板 `spec-explore.ts` 为立场式（`## The Stance`）。
- **B 的成果**：`spec_propose` 已有 `mode=delegated|interactive` 契约先例（B 引入）；`spec_apply` 有 `auto-mode=true` 先例。
- **次序**：B 与 B2 均改 `auto-workflow 全自动管线` 与 `依赖注入`；B2 delta 以 B 后形态为准。

## Goals / Non-Goals

**Goals**:
- `iagent_spec_explore` 新增 `delegated` 模式（吸收强制 checkpoint 体系 + 结构化 handoff），`interactive` 保持立场式不变；
- `workflow` / `auto-workflow` Phase 1 改为委派 `spec_explore`（`mode=delegated`），删除内联探索正文；
- `DEPS`/白名单同步 + 退出守卫统一；
- 与 B 共同构成"编排层全阶段委派"。

**Non-Goals**:
- **不改 `auto-workflow` Phase 4/5 的 apply/archive 委派快照**（另立变更）。
- **不改任何对话级确认门语义**：提示词门、L1-L5 追问门、流程最终确认门、实现桥、归档桥一律不变；`auto` 语义不跳过这些门。
- **不改 `spec_explore` 的 `interactive` 行为**：手动探索零变化。
- **不引入 `openspec/rules/exploration-protocol.md` 共享协议**（S3 备选）：本变更走委派（S1，用户已选），共享协议作为未来可选收敛路径记录。

## Decisions

### D1: `spec_explore` 双模式（`interactive` 立场 / `delegated` 强制流程）
- **选择**：`delegated` 模式执行强制 checkpoint 体系并产出结构化 handoff；`interactive`（默认）保持立场式。二者在同一模板内以模式分支隔离。
- **理由**：同时保住立场式体验（手动探索）与委派单源（编排器）；与 `spec_propose`/`spec_apply` 的 `mode` 契约一致，形成统一"委派执行模式"家族。
- **备选**：①强制全量（摧毁立场，弃）；②共享协议引用（S3，非委派路线，用户未选，记为备选）；③不委派（不治 P2，弃）。

### D2: 编排器 Phase 1 委派 + 阶段主权
- **选择**：`workflow` / `auto-workflow` Phase 1 经 Skill 工具委派 `iagent_spec_explore`（`mode=delegated`）；编排器消费 handoff 并独占阶段推进。
- **理由**：消除探索阶段重复真源；"断层"由模式契约与退出守卫解决。
- **备选**：保留部分编排器专属逻辑（如多项目派发）在内联——若 `spec_explore` delegated 已吸收则无须，弃。

### D3: 结构化 handoff 契约
- **选择**：`delegated` 完成时输出结构化结果块：探索文件路径、提示词基线（原始 + 确认版）、流程基准确认状态（确认/未确认降级）、Pending 影响符号（供 Phase 2 影响分析）。编排器据此推进。
- **理由**：给"无完成语义的立场式技能"一个 delegated 下的明确完成契约；衔接 Phase 2 影响分析（B 保留在编排器）。
- **备选**：复用 `iagent spec status --json`（探索产物非变更制品，无对应 CLI 状态，弃）。

### D4: `auto-workflow` 门不被 auto 语义跳过——委派后仍成立
- **选择**：提示词门 / L1-L5 追问门 / 流程最终确认门在 `spec_explore` delegated 内照常等待；`auto-workflow` 的 auto 语义仅影响**阶段间自动推进**，不影响门。
- **理由**：保留既有"澄清门/流程图门不被 auto 语义跳过"的硬要求；委派不改变门语义。
- **备选**：delegated 模式跳过门以加速（违反既有要求，弃）。

### D5: DEPS/白名单/次序
- **选择**：`DEPS` 增加 `workflow ⇒ spec-explore`、`auto-workflow ⇒ spec-explore`；白名单经 `${skillDelegation(['spec_explore'])}`；实现次序 **A → B → B2**。
- **理由**：委派目标必须随装；三方共同修改的需求以先行变更为基线。

## Architecture Mapping

```
变更前（B 之后）                                变更后（B2）
───────                                        ──────
workflow  Phase1 内联探索 ①                     workflow  Phase1 ─ Skill(spec_explore/delegated) ─┐
          Phase2 ├ Skill(spec_propose)                                                     │
auto-wf   Phase1 内联探索 ②                     auto-wf   Phase1 ─ Skill(spec_explore/delegated) ─┤
spec_explore 立场式（无强制流程）③               spec_explore ◄── mode=delegated ────────────────┘
                                              interactive: 立场式（不变）
                                              delegated: 强制 checkpoint + 结构化 handoff（唯一源）
```

## Risks / Trade-offs

| 风险 | 缓解 |
| :--- | :--- |
| 双模式使 `spec_explore` 主文件膨胀（与 C 的尺寸预算冲突） | 强制 checkpoint 体系与 `interactive` 共用 prompt/flowchart 单一源；长细则下沉 `references/`（C 兜底） |
| delegated 模式漏搬某个强制 checkpoint（行为弱化） | 探索记录列 deltas 清单逐项对照；测试断言 delegated 正文含各 checkpoint 关键词 |
| `auto-workflow` 门被委派"顺带跳过" | D4 + 既有"门不被 auto 语义跳过"要求 + 场景断言 |
| 与 B 需求重叠导致应用冲突 | 次序 A→B→B2；B2 delta 以 B 后形态为准；实现前先确认 B 已归档/合并 |
| 结构化 handoff 格式在编排器与技能间漂移 | handoff 为 `spec_explore` 单方产出、编排器单向消费；测试断言关键字段 |
| `interactive` 行为被模式分支误改 | 回归断言：interactive 正文含 `## The Stance` 与"无固定步骤"表述 |

## Open Questions

- **[待确认]** 结构化 handoff 是否落盘为探索文件内的 `## 委派回执` 段（便于编排器 Read）还是仅会话内输出——design 倾向落盘段（可追溯、与 `## 提示词基线`/`## 功能流程图` 同模式）。
- **[待确认]** `spec_explore` delegated 的多项目派发是否继承 `SUBAGENT_DISPATCH`（`Agent, Task`）——若继承，白名单需加派发条目（当前 `spec_explore` 白名单无 `Agent/Task`）。
