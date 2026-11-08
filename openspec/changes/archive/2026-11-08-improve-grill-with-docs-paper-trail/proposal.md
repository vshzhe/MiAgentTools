## Why

iagent 对 grill-with-docs 的集成是**自持实现**（`GRILL_PLAYBOOK_FULL` 等模板正文），而非调用上游技能；但上游点名的两类最严重问题在本仓库同样成立：

1. **访谈照常运行，纸迹静默缺失**：CONTEXT.md 有检查点，`Decisions` 为空、术语表为空、ADR 缺失却按空集直通，管线继续推进（`spec-explore.ts` 1.6.6 / 1.6.5）。上游明确记录该模式为**已知未修复缺陷**。
2. **精确回答被下游稀释**：手交子代理后，顺序保证、否定式需求、数值型默认值易被 proposal / spec 软化成散文；handoff 包六节无承载硬约束的位置，回答与规格 / 测试之间没有可核对链路。

此外还有三处同轴缺口：同一技能内「深度不限」与「≤2 批量轮次」自相矛盾（`spec-explore.ts` 1.3.2 vs 1.3.4，且被 `openspec/specs/workflow-suite-skills/spec.md` 与 `test/template-consistency.test.ts` 锁死）；`debug` 的缩减版 grill 纪律缺术语冲突检测、ADR 三条件与边界场景构造；`CONTEXT.md` 的六个写入者中只有 explore 做冲突检测，archive 还从变更制品正文反向抽取术语，正是上游点名的「多人写入导致漂移」成因。

现在做的原因：用户已完成 grill 追问并确认 D1-D5 与流程基准 N1-N16（`openspec/changes/improve-grill-with-docs-paper-trail/exploration.md`），优化范围已收敛为**定点修补纸迹保真**，不再与已归档的门预算决策冲突。

## What Changes

- **纸迹三项校验**：在 `iagent_spec_explore` 的 1.5.5 前置校验「Decisions / 术语表 / ADR」三项存在性或显式「无」，结果记入探索回执 `paperTrailStatus`；**并入既有流程最终确认门呈现，MUST NOT 新增阻塞门**。(D2.1)
- **硬约束载体**：propose 产出的 handoff 包新增并列节 `## 硬约束`，顺序保证 / 否定式需求 / 数值默认值逐字保留，每行带 `source: D<n>`；缺失则回执 `incomplete`。(D2.2, D5)
- **批量口径消解**：把 1.3.2「深度不限」改写为「收敛深度不限，批量轮数受 ≤2 批规则约束（澄清门不计入流程级门预算）」，并同步 `openspec/specs/workflow-suite-skills/spec.md` 与 `test/template-consistency.test.ts` 的口径（MUST NOT 删除断言）。(D2.3, D3)
- **多写入者漂移防护**：六处写入者（`spec-explore` / `debug` / `spec-archive` / `spec-bulk-archive` / `workflow` Phase 2.0 / `spec-propose` 0.5）统一「先读 CONTEXT.md 再写、同名冲突显式裁决」；archive 类只同步变更 `exploration.md` 术语表，禁止从 proposal / design / specs 正文反向抽取。(D4)
- **决策可追溯**：探索 `## Decisions` 带稳定 id `D<n>`；proposal / spec / design 在约束处标 `(D<n>)`；tasks 的 `[测试]` 覆盖相关硬约束。(D5)
- **debug 纪律补齐**：`debug.ts` §2.3 补术语冲突检测、ADR 三条件、边界场景构造三项。(D6)
- **编排口径**：`auto-workflow` / `workflow` 明确 `exploration.md` 为唯一过桥载体，透传 `paperTrailStatus` / `flowBaselineConfirmed`，不新增用户停顿。(D1, B7)

**不在范围内**：全面对齐上游（轮数不限 / 技能拆分 / `GLOSSARY-MAP`）；术语表内容规范（除 D4 的最小取词口径）；**在 `apply` 中新增任何 grill 纸迹逻辑**（`apply` / `verify` 仅作为 handoff `## 硬约束` 的只读消费方，见 D1 澄清）；新增确认门或修改门白名单 / 门预算。

## Capabilities

### New Capabilities

- 无（本变更只修改既有能力的规格行为）

### Modified Capabilities

- `workflow-suite-skills`: 批量口径消解、探索纸迹三项校验与回执声明、编排纸迹衔接口径、debug 排查期 grill 纸迹纪律、CONTEXT.md 多写入者漂移防护、决策可追溯链路
- `skill-stage-continuation`: handoff 包 `## 硬约束` 并列节及其产出 / 消费契约
- `spec-bulk-archive-skill`: 《归档单元执行序列》a.5 的取词口径收窄（原要求读取 proposal.md / design.md 补充术语，与 D4 冲突）

## Impact

### 直接影响的文件

- `src/core/templates/workflows/spec-explore.ts`: 1.3.2 口径改写、1.5.5 前置纸迹校验、1.6.x 术语写入规则、1.8 回执字段
- `src/core/templates/workflows/debug.ts`: §2.3 补三项 grill 纸迹纪律
- `src/core/templates/workflows/auto-workflow.ts` / `workflow.ts`: 探索→提案纸迹衔接口径
- `src/core/templates/workflows/spec-propose.ts`: handoff `## 硬约束` 节、制品 `(D<n>)` 标注、`incomplete` 回执
- `src/core/templates/workflows/spec-archive.ts` / `spec-bulk-archive.ts`: 先读后写、取词口径收窄、并发写入串行化
- `src/core/templates/workflows/spec-verify.ts` / `spec-apply.ts`: **只读消费** handoff `## 硬约束`（不新增 grill 纸迹逻辑；无 Write 权限的 verify 不追加阶段结论）
- `src/core/host-orchestration/workflows.ts`: `EXPLORE_PHASE.handoff` 增加 `paperTrailStatus` 字段声明
- `openspec/specs/workflow-suite-skills/spec.md` / `skill-stage-continuation/spec.md` / `spec-bulk-archive-skill/spec.md`: 需求口径与新增 / 修改需求
- `test/template-consistency.test.ts` / `test/stage-continuation.test.ts` / `test/skill-size-budget.test.ts` / `test/grill-paper-trail.test.ts`: 断言口径同步与新增回归锁
- `skills/`: 重新生成的静态快照（`pnpm build && pnpm generate:skills`）
- `package.json` / `CHANGELOG.md` / `README.md`: minor 版本递增（4.1.0 → 4.2.0）

### Impact Analysis（Phase 2.0 CodeGraph）

| 符号 / 锚点 | 位置 | 影响面 |
| :--- | :--- | :--- |
| `GRILL_PLAYBOOK_FULL` | `src/core/templates/workflows/spec-explore.ts:608` | 1 处内部调用，派生 `references/grill-playbook.md`；1.3.2 口径改写落点 |
| `getSpecExploreSkillTemplate` | `spec-explore.ts:1205` | registry 注册 + 派生指令；`test/template-derivation.test.ts` 覆盖 |
| `getDebugSkillTemplate` | `src/core/templates/workflows/debug.ts:126` | 5 处调用；`test/stage-continuation.test.ts` 覆盖 |
| `getAutoWorkflowSkillTemplate` | `auto-workflow.ts:16` | 5 处调用；`test/stage-continuation.test.ts` 覆盖 |
| `getWorkflowSkillTemplate` | `workflow.ts:136` | 5 处调用；`test/stage-continuation.test.ts` 覆盖 |
| `EXPLORE_PHASE.handoff` | `src/core/host-orchestration/workflows.ts:33` | 阶段回执字段声明；`paperTrailStatus` 需同步登记 |
| `spec-verify` 阶段模板 | `src/core/templates/workflows/spec-verify.ts` | 只读消费方；无 `Write` 权限，阶段结论由 apply / archive 追加 |

关联锁（改动 MUST 同步口径，MUST NOT 删除断言）：

- `test/template-consistency.test.ts:167-180`（`≤ 2 批量轮次` / `批量 1` / `批量 2` / `最低深度 L3`）
- `test/skill-size-budget.test.ts:65-74`（`spec_explore` references 齐备且被引用）
- `skills/` 静态快照（`pnpm generate:skills` 生成）
- `openspec/specs/workflow-suite-skills/spec.md:650-663`（grill ≤2 批需求）
- `openspec/specs/host-orchestration/spec.md:525`（handoff 六节语义不变；新增 `## 硬约束` 为并列节，不改六节）

### 向后兼容

- **无破坏性行为变更**。纸迹校验并入既有流程最终确认门，门数量与门预算不变。
- 存量探索文件不含 `D<n>` / `## 硬约束` 字段契约时记 WARN、按「无硬约束」处理；存量回执不含 `paperTrailStatus` 时父级记 WARN 并按 `skipped` 处理；仅对新产出强制（边界 B3）。
- 存量 handoff 包无 `## 硬约束` 节时，消费方记 WARN 并按无硬约束处理；propose 只对新产出强制（边界 B3 / B6）。
- 无探索文件的路径（旧变更 / 直接 apply）不执行纸迹校验，沿用既有 WARN 跳过（边界 B2）。
- 技能正文变更经 `iagent update` 刷新，方法为内容指纹保护下的安全升级；版本递增按 **minor**（D3）。
