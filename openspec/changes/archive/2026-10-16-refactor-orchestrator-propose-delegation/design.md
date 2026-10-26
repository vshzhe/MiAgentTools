## Context

- **三份提案逻辑**：`workflow.ts` Phase 2（内联，2016 行主文件的一部分）、`auto-workflow.ts` Phase 2（"精简版内联"）、`spec-propose.ts`（真源）各自实现预迁移验证→探索文件迁移→制品生成→规则注入→schema 验证。
- **内联动机**：`workflow.ts` 正文写明 *"Do NOT invoke `Skill('iagent:spec-propose')`…for workflow continuity"*；探索确认"断层"= 子技能的规划边界/阶段推进中断编排器，**非上下文丢失**。
- **委派先例**：`spec_apply.ts` 的 `auto-mode=true`（Input 声明 + Step 5.5 显式检测跳过设计门，注释 *"This gate CANNOT be skipped when auto-mode is not set"*）。
- **`spec_propose` 现状**：Step 0 探索文件关联（**用户提示** [关联] / [跳过] + 迁移语义）；Steps 1-5 制品生成；Step 6 Phase 3 自动验证（委派 `spec_verify_proposal` + `requirement_doc`）；Guardrails 含 *"After all artifacts are created, display a design blueprint summary and wait for user confirmation before suggesting implementation."*。
- **编排器 Phase 3**：`workflow` / `auto-workflow` 的 Phase 3 = `spec_verify_proposal` + `proposal_review`（深度复查）+ `requirement_doc`（非交互）——为 `spec_propose` 自身 Phase 3 的**超集**。
- **`spec_explore` 现状**：立场式（`## The Stance`、`## What You Might Do`、无固定步骤），**缺**编排器的强制 checkpoint 体系（强制建文件 / CONTEXT.md / CodeGraph 基础扫描 / L1-L5 grill / 1.6.6 聚合一致性门）。
- **依赖校验基线**：`workflow-suite-skills` 的"编排技能的委派与派发白名单齐备性"要求编排技能 `allowedTools` 覆盖其实际委派面；`skill-profile` 的"依赖注入"要求被委派技能随装（`DEPS`）。

## Goals / Non-Goals

**Goals**:
- `iagent_spec_propose` 新增 `delegated` 执行模式（`mode` 参数 + `exploration-file` 输入 + 抑制停点/自身 Phase 3），`interactive` 默认行为不变；
- `workflow` / `auto-workflow` Phase 2 改为委派 `iagent_spec_propose`（`mode=delegated`），删除两份内联提案真源；
- `DEPS` 与白名单同步（`spec-propose` 随装 + `Skill(spec_propose)` 条目）；
- 阶段主权与退出守卫统一。

**Non-Goals**:
- **不委派 Phase 1（探索）**：`spec_explore` 是立场式设计且缺强制 checkpoint 体系；委派它须先决定是否把强制 checkpoint 搬入 `spec_explore`（改变其"无固定步骤"哲学），属独立设计取舍，另立变更 `refactor-orchestrator-explore-delegation`（暂名）。
- **不改 `auto-workflow` Phase 4 的 apply 委派快照**：其"内联复用 apply Step 6+ 逻辑"的进一步委派化另立变更（依赖本变更确立的阶段主权模型）。
- **不改任何对话级确认门语义**：提示词门/流程图门/L1-L5/实现桥/归档桥/流程最终确认门一律不变。
- **不改 `spec_propose` 的 `interactive` 行为**：用户直接调用的路径零变化。

## Decisions

### D1: 统一执行模式契约 `mode=delegated|interactive`（`auto-mode` 保留为别名）
- **选择**：`spec_propose` Input 新增 `mode` 参数，取值 `interactive`（默认）| `delegated`。`delegated` 语义 = "由编排器调用：让出阶段推进主权与重复步骤，保留交互确认门"。`spec_apply` 既有 `auto-mode=true` **保留为 `mode=delegated` 的等价别名**（避免破坏既有正文与目标项目表述），并在文档注明二者等价。
- **理由**：`auto-mode` 语义过窄（仅"跳过设计门"），三技能（explore/propose/apply）的委派行为需要用统一词汇表达；保留别名兼顾向后兼容。
- **备选**：①为 `spec_propose` 直接复用 `auto-mode=true`（语义不符——propose 要抑制的不是"设计门"而是"停点 + 自身 Phase 3"，易混淆，弃）；②三技能全部改用新参数、废弃 `auto-mode`（破坏既有正文与更广的兼容面，弃）。

### D2: Phase 2.0 预迁移验证与影响分析——归编排器
- **选择**：`workflow` 的 Phase 2.0（探索文件存在性校验、CONTEXT.md 同步、Pending 影响符号 → CodeGraph impact）**保留在编排器**；`spec_propose`（delegated）从其 Step 0 起接管"迁移 → 制品生成"。编排器把结论以结构化输入传给 `spec_propose`。
- **理由**：影响分析是"探索产物 → 提案上下文"的桥接，依赖 Phase 1 探索文件的 Pending 段，属编排器的跨阶段编排职责；`spec_propose` 在 delegated 模式下应聚焦制品生成单一职责。
- **备选**：全部移交 `spec_propose`（Step 0.7 已含探索内容映射，但影响分析用 CodeGraph 属探索侧能力，移交会使 `spec_propose` 依赖 CodeGraph 且与其 interactive 路径行为分叉，弃）。

### D3: Phase 3 验证归属——编排器独占，`spec_propose` delegated 抑制自身 Phase 3
- **选择**：`delegated` 模式下，`spec_propose` 完成制品生成后**不执行**自身 Step 6 Phase 3；由编排器的 Phase 3 执行（`spec_verify_proposal` + `proposal_review` + `requirement_doc` 超集）。`interactive` 模式保留自身 Phase 3。
- **理由**：避免 `spec_verify_proposal` 重复评分与 `requirement_doc` 重复生成（编排器本就多做一次 `proposal_review` 深度复查）；验证归属单一化，消除"到底以哪次评分为准"的歧义。
- **备选**：`delegated` 模式保留自身 Phase 3、编排器 Phase 3 仅补 `proposal_review`（`spec_verify_proposal` 运行两次，评分可能不一致，弃）。

### D4: 阶段主权与退出守卫
- **选择**：新增/强化 guardrail——被委派的 `spec_propose`（delegated）完成后 **MUST NOT** 自行进入实现或推进阶段；阶段完成判定与推进主权归编排器（唯一有权判定阶段完成并推进下一阶段的角色）。`spec_propose` delegated 完成时输出结构化回执（change-name、生成的制品清单、apply-ready 状态）。
- **理由**：这正是"断层"的正解——用模式契约显式让出主权，而非靠内联规避。与 `spec_apply` 既有退出守卫先例一致。
- **备选**：无守卫、依赖模型自觉（不可靠，弃）。

### D5: DEPS 注入与白名单同步
- **选择**：`profiles.ts` 的 `DEPS` 增加 `'workflow': [...existing, 'spec-propose']`、`'auto-workflow': [...existing, 'spec-propose']`（不动点闭包连带补全）；两编排器 `allowedTools` 经 `${skillDelegation(['spec_propose'])}` 补条目。
- **理由**：委派目标必须随装，否则死引用；白名单须覆盖实际委派面（既有"齐备性"要求）。
- **备选**：不改 DEPS，靠运行时 fallback（正是本次要消除的中断来源，弃）。

### D6: Phase 1 委派显式 Non-Goal
- **选择**：本变更不委派探索阶段；探索记录与 proposal 明确记录前置设计取舍（`spec_explore` 是否吸收强制 checkpoint）。
- **理由**：`spec_explore` 的立场式设计（`## The Stance`：无固定步骤、无强制产出）与编排器内联版的强制 checkpoint 体系（1.1 强制建文件 / 1.3 L1-L5 grill / 1.6.6 聚合一致性门）哲学冲突；强行委派会要么削弱编排器门、要么摧毁 `spec_explore` 立场，二者皆需用户裁决。
- **备选**：同变更内一并委派（范围过大、混入设计取舍、风险不可控，弃）。

## Architecture Mapping

```
变更前                                          变更后
──────                                         ──────
workflow ─┬─ Phase1 内联探索                    workflow ─┬─ Phase1 内联探索（不变）
          ├─ Phase2 内联提案 ①                          ├─ Phase2 ─ Skill(spec_propose) ─┐
          ├─ Phase3 验证门                              ├─ Phase3 验证门（超集）          │
          └─ Phase4/5 委派 apply/archive               └─ Phase4/5 委派（不变）          │
auto-wf ───┬─ Phase1 内联探索                    auto-wf ─┬─ Phase1 内联探索（不变）      │
           ├─ Phase2 精简内联提案 ②                        ├─ Phase2 ─ Skill(spec_propose) ─┤
           └─ Phase4 内联 apply ③                          └─ Phase4 内联 apply（暂不变）   │
spec_propose 提案真源 + 自身 Phase3              spec_propose ◄── mode=delegated ─────────┘
                                                （interactive 默认不变；delegated 抑制停点/自身Phase3）
```

## Migration Plan

1. `spec-propose.ts` 增加 `mode` 契约分支（Input、Step 0 跳过、结尾停点抑制、Phase 3 抑制、回执）。
2. `workflow.ts` Phase 2 内联正文替换为委派调用（保留 2.0 影响分析）；补 `Skill(spec_propose)` 白名单 + 退出守卫。
3. `auto-workflow.ts` Phase 2 精简内联替换为委派调用；同步白名单/守卫；更新 Phase 1-3 描述。
4. `profiles.ts` DEPS 增加两项；补/更新测试（DEPS 覆盖 + 委派白名单齐备）。
5. `pnpm build && pnpm generate:skills`；`git diff skills/` 人工审查（预期：两编排器 Phase 2 大幅缩短、spec_propose 增 delegated 分支）。
6. 全量 `pnpm test`；版本号递增（行为变更 → minor 或 major，design 收尾裁决：CLI/技能参数新增属功能变更，取 minor；若判定"改 CLI 行为/参数"则 major）。

## Risks / Trade-offs

| 风险 | 缓解 |
| :--- | :--- |
| `delegated` 模式抑制了 `spec_propose` 的 Phase 3 后，编排器忘跑验证 | 编排器 Phase 3 为既有强制门（`workflow 自动验证门与深度复查联动`），本变更不动；补测试/正文断言 delegated 完成后编排器必进 Phase 3 |
| `spec_propose` delegated 与 interactive 行为分叉导致 interactive 退化 | `interactive` 分支零改动；新增测试断言 interactive 正文仍含 Step 0 提示与结尾停点 |
| 编排器与 `spec_propose` 对"探索文件迁移"的职责重叠（都做迁移） | D2 明确迁移归 `spec_propose`（delegated）；编排器 2.3 删除，仅传 `exploration-file` 路径 |
| DEPS 未补导致 `spec_propose` 未随装 | 沿用"依赖注入"既有机制 + 死引用校验测试（依赖 `improve-template-generation-consistency`） |
| auto-workflow 的"零交互直通"被 `spec_propose` 的 Step 0 提示破坏 | delegated 模式跳过 Step 0 用户提示（D1），行为保持零交互（确认门仅在 Phase 1，不受影响） |
| `auto-mode` 别名与新 `mode` 语义漂移 | 文档注明二者等价；实现期统一在两个编排器正文使用 `mode=delegated` |

## Open Questions

- **[待确认]** 版本递增位：本变更改技能参数（新增 `mode`）与编排行为，按守则 8 可能触发 major（"改 frontmatter 契约/CLI 行为或参数"）或 minor（"功能新增或变更"）——收尾时取较大者裁决。
- **[待确认]** `delegated` 模式是否需要独立的完成回执模式（结构化块）还是复用 `iagent spec status --json`（design 倾向复用，减自定义格式）。
