# 设计：提升变更提案生成的一次完成度

## Context

### 现状与架构位置

本变更是**工具自身**（iagent CLI + 技能模板）的改造，位于三层架构的模板层与规格驱动域：

- 模板层：`src/core/templates/workflows/`（技能正文单一源）
- 规格驱动域：`src/core/spec/`（Markdown 唯一真源 + 确定性校验）
- 命令层：`src/commands/spec.ts`（`validate` / `conformance` 子命令）

### 架构影响

当前「生成侧」与「验证侧」是两个互不感知的子系统，这是本变更要修复的结构性问题：

```
生成侧                                验证侧
─────────────                        ─────────────
templates/index.ts                    spec-verify-proposal.ts
  PROPOSAL_TEMPLATE                     D1-D5 / D6-D10 维度
  DESIGN_TEMPLATE          ✗ 不共享     影响面三锚点（手写）
  TASKS_TEMPLATE          ← 锚点 →     B1-B7（5 处手写副本）
       ↓                                    ↑
  spec-propose.ts 终检                  workflow/auto-workflow/debug
  （仅 partial + strict）               各自手写同一份清单
```

改造后：

```
生成侧 ─── anchors.ts（单一源）─── 验证侧
   │                                  │
   ├─ templates/index.ts              ├─ spec-verify-proposal.ts
   ├─ readiness.ts（确定性就绪门）      ├─ verify-checklist.ts（单一源）
   └─ spec-propose.ts 终检             └─ 4 个编排技能插值引用
```

关键结构性判断：**把判定前移为确定性**，而不是在验证阶段加强 AI 审查。原因见下节 Decisions DD1。

### 约束来源

- 项目规则（`.iagent/rules/coding-rules.md`、`AGENTS.md`）：单一源优先、派生而非复制、模板正文唯一源、`allowedTools` 走共享常量、改模板后 `pnpm build && pnpm generate:skills`
- 项目技能（`.iagent/skills/backend-design.md`）：单一真源优先、扩展点接口化、委派 fail-safe、配置写入非破坏
- 探索决策：D1-D10（`exploration.md` §Decisions）
- 硬约束 10 条（`exploration.md` §硬约束）

## Goals / Non-Goals

**Goals**:
- 消除「模板不产出验证侧要求的锚点」这一结构错配
- 让 propose 收束时即具备确定性的覆盖自证，使 Phase 3 首轮可 PASS
- 把 D1-D10 / B1-B7 清单收敛为单一源，消除判据漂移
- 让 D1 / D3 / D10 的关键判定从 AI 语义变为可复现的确定性判定
- 全程保持 90% 阈值、维度编号、门结构不变

**Non-Goals**:
- 不改变验证的分值算法与阈值
- 不新增用户确认门
- 不改动 `detectCompleted`（制品 done 判定与覆盖校验职责分离）
- 不重构 `spec/` 的既有解析管线（只增量扩展解析器）
- 不引入新的外部依赖或数据库

## Decisions

### DD1: 判定前移为确定性，而非加强验证侧 AI 审查

- **选择**: 新增 CLI 就绪门（确定性纯函数）+ 锚点单一源 + 解析器结构化，让缺口在 propose 阶段即可发现并确定性判定。
- **理由**: 「重复验证」的现象根源之一是同一问题每轮可判不同结论（R4：`proposal-parser.ts:12` 不解析 What Changes，`artifact-model.ts:103-120` 无 `nodeRef`）。加强 AI 审查只会让每轮结论仍不稳定；确定性判定可复现，天然消除「同题多判」。同时验证技能无 `Write` 权限（R6），在验证侧加强只意味着更多回流。
- **备选**: ① 只补模板锚点（方案 D）：改动最小，但 D1/D2/D10 仍靠语义，问题只减轻；② 在 propose 中内联复制一份完整 D1-D10 评分：与验证侧产生第二份真源，正是 R7 要消除的漂移。

### DD2: 就绪门作为 `validate` 的选项而非新命令

- **选择**: `iagent spec validate --ready`，与 `--partial` 互斥。
- **理由**: `validate` 已是制品校验的单一入口（`spec.ts:219`），新增顶层命令会让「校验」这一概念分裂为两个入口，且需同步 `completion.ts` 的 `IAGENT_COMMANDS` 表（AGENTS.md 规则）。选项形式复用既有诊断结构（`ArtifactDiagnostic`）与输出格式。
- **备选**: 新增 `iagent spec ready` 顶层子命令 —— 语义更清晰，但增加命令面与补全维护成本，收益不抵。

### DD3: 锚点常量放在 `src/core/spec/validation/anchors.ts` 而非 `src/core/templates/`

- **选择**: 放在规格驱动域（`spec/validation/`）。
- **理由**: 锚点是**验证侧的消费契约**，而 `parseProposal` / `parseDesign` / `parseTasks`（同在 `spec/`）也要产出这些锚点。放在 `templates/` 会造成 `spec/` 反向依赖模板层，违反分层（coding-rules「严格分层，禁止跨层调用」）。模板层引用 `spec/validation/anchors.ts` 是同向依赖（模板层 → 规格域），符合既有 `prompt-gate.ts` 依赖 `host-orchestration/protocol.ts` 的先例。
- **备选**: 放在 `templates/` —— 会导致 `src/core/spec/**` 依赖 `src/core/templates/**`，形成层间环。

### DD4: 清单单一源模块放在 `src/core/templates/verify-checklist.ts`

- **选择**: 放在模板层顶层（与 `prompt-gate.ts` / `tool-whitelist.ts` 同级）。
- **理由**: 该模块只服务模板正文渲染，消费方全在 `templates/workflows/`；与 `prompt-gate.ts` / `flowchart-gate.ts` 同类。放 `spec/` 会让纯渲染逻辑混入规格域。
- **备选**: 放进 `templates/workflows/_shared.ts` —— 但 `workflows/` 目录语义是「每个技能一个文件」，共享模块放同级更符合既有约定（`prompt-gate.ts` 先例）。

### DD5: 存量/新变更的判定依据用 `.openspec.yaml` 的 `created`

- **选择**: `readiness.ts` 读取 `.openspec.yaml` 的 `created` 字段，与就绪门能力生效日期（常量 `READINESS_EFFECTIVE_DATE = '2026-11-22'`）比较。
- **理由**: `created` 由 `iagent spec new` 写入，是变更创建时间的确定性事实（`new-change.ts`）。依据制品内容猜测（如"有无锚点"）会让存量变更加上锚点后免除严格度，形成规避路径。
- **备选**: 依据「制品是否含锚点」判定 —— 可被规避，不受采纳。
- **边界**: `created` 缺失（手工创建的变更目录）→ 按**新变更**处理（fail-safe：更严格）。

### DD6: 能力对齐判定的能力名来源

- **选择**: 从 `parseProposal` 解析的 `### New Capabilities` / `### Modified Capabilities` 的 `` - `<name>`: <描述> `` 列表取能力名；`specs/<dir>/` 的目录名视为声明能力。
- **理由**: proposal 的 Capabilities 小节是生成 specs 的输入（`schema.ts:63` 的 instruction 即如此要求），是最自然的对齐锚点。
- **备选**: 从 `## What Changes` 反推能力 —— 变更项描述是散文，不可靠。

### DD7: D2 的 design 缺失分支

- **选择**: 从 `specs` + `proposal` 的 Capabilities / Impact 取证据；双无 → SKIP 排除分母。
- **理由**: `design` 在 schema 中是可选依赖（`schema.ts:78` `requires: ['specs', 'design?']`），但 D2 当前无 SKIP 分支（R5）。SKIP 口径与 D10 / 影响面检查的既有先例同构（缺失向后兼容，脱节才惩罚）。
- **备选**: 强制要求 design 存在 —— 与 schema 的可选语义冲突。

### DD8: propose 终检顺序固定为 partial → ready → strict → handoff

- **选择**: 固定四步顺序。
- **理由**: 就绪门需要四类制品都存在才能判定覆盖，故在 partial 之后；handoff 包的 `sourceFingerprint` 覆盖制品内容，必须在 strict 终检修复完之后才产出，否则指纹与定稿内容不一致。
- **备选**: 就绪门放最后 —— 会导致已产出的 handoff 包在就绪门 FAIL 后作废，浪费且易漏重建。

## Risks / Trade-offs

| 风险 | 缓解 |
| :--- | :--- |
| 新增 `--ready` 改变 `validate` 的参数空间，可能影响既有脚本 | 与 `--partial` 互斥并显式报冲突诊断；不传 `--ready` 时行为完全不变；由 `validate-update.test.ts` / `spec-commands.test.ts` 断言 |
| 模板新增锚点小节会改变 `skills-parity` 快照与 `spec-commands.test.ts` 的文本断言 | 按 AGENTS.md 规则运行 `pnpm build && pnpm generate:skills`；同步更新断言；断言指向 `anchors.ts` 插值结果而非硬编码串 |
| 解析器扩展可能影响 `detectCompleted` / `inspectArtifact` 的既有行为 | 只增字段不增诊断；`ParsedProposal` / `ParsedTask` 的既有字段语义不变；由 `spec-status.test.ts` / `markdown-parser.test.ts` 回归 |
| 锚点强制可能让存量变更无法通过新就绪门 | DD5 的 `created` 日期判定 + D3 的 SKIP + WARN；存量变更走 warning |
| 能力对齐可能误报（proposal 声明能力但有意不建 spec 目录） | `skip_specs: true` 时豁免；其余情形报可定位诊断，由用户在 propose 阶段修正 |
| 清单抽取可能让某一技能丢失既有语义细节 | 抽取时逐技能比对既有文本；`verify-review-checkpoints.test.ts` 的既有断言全部保留并继续通过 |
| 一次性改动 6 个技能模板 + 3 个 CLI 模块，回归面较大 | 分阶段实施：先 anchors + templates（第 1 组），再 readiness + CLI（第 2 组），再清单抽取（第 3 组），再 propose/verify/debug 正文（第 4 组），每阶段跑相关测试 |

## 评估记录

| 评估对象 | 结论 | 依据 |
| :--- | :--- | :--- |
| 90% 统一阈值 | **不改** | 用户裁决 Q2 未要求；阈值调整属独立决策，须单独显式确认（D4） |
| 维度编号 D1-D10 | **不改** | 新检查点并入既有维度或作为独立确定性校验，避免既有报告与测试口径漂移（D4） |
| 总分公式 | **不改** | 同上；SKIP 语义沿用既有「排除分母」先例 |
| 门白名单 5 类 | **不改** | 就绪门是阶段内部确定性校验，不是用户停点（D10） |
| `detectCompleted` | **不改** | 制品 done 判定（存在且结构无 error）与覆盖校验职责分离；把覆盖塞进 done 判定会让 status 语义膨胀且影响 archive |
| `spec-update` 技能 | **不改** | 本变更不涉修订闭环；`spec-update` 后续可消费就绪门，但不在本次范围 |
