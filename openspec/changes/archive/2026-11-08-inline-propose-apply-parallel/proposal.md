## Why

上一次完整流程实测中，12 次子代理调用约 1,620,515 tokens；其中 `propose` 119,949、`apply` 252,585，
合计约 23%，且 `apply` 单次 101 次工具调用。用户要求把 `propose` / `apply` 也改为主 agent 内联，
并以「单 agent 分批 + 批内并行只读」替代子代理调度，进一步压低 token 消耗。

这与刚归档的 `inline-orchestration-delegation` D1（propose / apply 保留子代理）相反，本变更显式 supersede 该决策；
理由是该决策基于「apply 内联会撑大主上下文」，而本次改为**分批执行 + 进度落盘 + 批内并行只读**，
前提已变。

## What Changes

- **propose 内联（D1）**：`PROPOSE_PHASE` 改 `execution.allowed=['inline','subagent']`（兼容窗），
  移除 `delegate` 能力；探索文件迁移、制品依赖序生成、handoff 包产出均由主 agent 执行。
- **apply 内联 + 单 agent 分批（D2）**：`APPLY_PHASE` / `AUTO_APPLY_PHASE` 同改；
  `spec-apply` 的派发协议重写为「主 agent 分批循环」——同一 `group` 聚为单元，批内独立**只读**调用可并行，
  写同一文件串行；进度落盘 `.openspec-tmp/pipeline-<change>/apply-progress.md`；
  `apply.concurrency` 语义改为「每批单元数」软上限。
- **单 agent 并行定义（D3）**：并行 = 同一回合并行发起独立只读工具调用 + 批内交错推进；
  MUST NOT 承诺独立上下文的并行代码生成。
- **迁移 Phase 3 同步内联（D4）**：apply 语义变化后，`migration` 的 Phase 3 实现也改内联；
  上下文阈值（300 文件 / 15k 行）保留为降级逃生口；`spec-bulk-archive` 并行单元仍保留子代理。
- **白名单与编排口径（D5）**：`workflow` / `auto-workflow` 的 `allowedTools` 移除 `Agent, Task`
  （propose / apply / archive / verify 均内联）；`migration`（Phase 3）与 `spec-bulk-archive` 保留；
  `auto-workflow` 的「委派 apply/archive」改为 Skill 工具内联执行。
- **兼容窗**：propose / apply 同时接受 `inline` / `subagent`，`subagent` 记 deprecation WARN，下个 major 收紧。

**不在范围内**：门白名单 / 门预算 / 业务确认语义；`spec-bulk-archive` 的并行单元；CLI 与产物布局。

## Capabilities

### Modified Capabilities

- `host-orchestration`: propose / apply 执行方式与能力声明
- `workflow-suite-skills`: 编排执行方式版图、白名单、auto-workflow 内联口径
- `spec-workflow-skills`: `spec-apply` 派发协议改为单 agent 分批
- `migration-skills`: Phase 3 内联与阈值保留

## Impact

### 直接影响的文件

- `src/core/host-orchestration/workflows.ts`：`PROPOSE_PHASE` / `APPLY_PHASE` / `AUTO_APPLY_PHASE` 声明
- `src/core/host-orchestration/transition.ts`：兼容窗覆盖 propose/apply；写阶段 inline 不再阻断
- `src/core/host-orchestration/render.ts`：分级执行文本
- `src/core/templates/workflows/spec-propose.ts` / `spec-apply.ts`：内联契约与单 agent 分批调度
- `src/core/templates/workflows/workflow.ts` / `auto-workflow.ts`：阶段说明、allowedTools
- `src/core/templates/workflows/migration.ts`：Phase 3 内联
- `src/core/templates/workflows/spec-bulk-archive.ts`：仅确认保留并行
- `openspec/specs/{host-orchestration,workflow-suite-skills,spec-workflow-skills,migration-skills}/spec.md`
- `test/host-orchestration.test.ts` / `stage-continuation.test.ts` / `template-consistency.test.ts` / `allowed-tools.test.ts` / `templates.test.ts`
- `skills/`、`AGENTS.md`、`package.json` / `CHANGELOG.md` / `README.md`

### Impact Analysis

| 符号 / 锚点 | 位置 | 影响面 |
| :--- | :--- | :--- |
| `PROPOSE_PHASE` / `APPLY_PHASE` / `AUTO_APPLY_PHASE` | `workflows.ts:40/66/95` | 执行方式与能力声明 |
| `evaluateExecutionMode` | `transition.ts:145` | 兼容窗与写阶段阻断 |
| `spec-apply 派发协议与共享资源协议` | `spec-workflow-skills/spec.md:629` | 子代理派发 → 单 agent 分批 |
| 编排白名单 | `workflow-suite-skills/spec.md:349/518` | `Agent, Task` 移除范围 |
| auto-workflow 委派口径 | `workflow-suite-skills/spec.md:552/719` | 子代理委派 → Skill 内联 |

### 向后兼容

- 协议字段沿用；兼容窗接受旧 subagent 回执。
- 已安装旧技能在 `iagent update` 前不感知新执行方式。
- 门与业务确认语义不变。
