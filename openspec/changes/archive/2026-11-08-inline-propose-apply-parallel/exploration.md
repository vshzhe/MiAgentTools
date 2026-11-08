# propose / apply 内联化与并行化探索

## Background

用户要求在活跃变更 `inline-orchestration-delegation` 的上下文中**重新调整执行方式**：

- 把 `propose` / `apply` 也改为**主 agent 内联**，不再走子代理；
- `propose` / `apply` 在实现时改为**并行处理**，不再走子代理；
- 动机：当前走子代理解 token 消耗异常高。

现状（`src/core/host-orchestration/workflows.ts`）：`PROPOSE_PHASE` / `APPLY_PHASE` / `AUTO_APPLY_PHASE`
均为 `execution.allowed=['subagent']` 且 `requiredCapabilities` 含 `delegate`；其余阶段已在 4.3.0 改为内联优先。
活跃变更 `inline-orchestration-delegation` 的 69 个任务已全部完成并提交（`bfe51c1`），尚未归档。

## 提示词基线 (Prompt Baseline)

**原始提示词**：`inline-orchestration-delegation 重新调整把propose/apply也调整为内联，不再走子agent，当前走子agent token消耗异常高，可以重新设计propose、apply在实现时进行并行处理，不再走子agent处理`

**确认后的提示词基线**（待 grill 确认）：把 `propose` / `apply` 改为主 agent 内联执行；在不使用子代理的前提下，
通过**同一回合并行工具调用 + 批内交错调度**实现「并行处理」；需判定是扩展现有活跃变更还是归档后另起变更。

> `[假设]`（软不明确）：「并行」在单 agent 内不可能实现真正的并行代码生成；可执行的形态是
> 「一批独立工具调用并行发起 + 多任务在同一回合内交错推进」。该假设将在 grill 中确认。

## 代码库扫描结果

### Discovered Files

- `src/core/host-orchestration/workflows.ts` — `PROPOSE_PHASE:40` / `APPLY_PHASE:66` / `AUTO_APPLY_PHASE:95`
- `src/core/host-orchestration/transition.ts` — `evaluateExecutionMode:145`（执行方式校验）
- `src/core/host-orchestration/protocol.ts` — `PhaseExecutionSpec:171` / `PhaseSpec:193`
- `src/core/templates/workflows/spec-propose.ts` / `spec-apply.ts` — 被内联化的两个技能正文
- `src/core/templates/workflows/workflow.ts` / `auto-workflow.ts` — 编排入口与阶段说明
- `openspec/changes/inline-orchestration-delegation/` — 当前活跃变更（已实现未归档）

### Identified Symbols

- `WORKFLOW_PROTOCOLS`（`workflows.ts:190`）— 5 个工作流协议
- `PROPOSE_PHASE`（`workflows.ts:40`）/ `APPLY_PHASE`（`workflows.ts:66`）/ `AUTO_APPLY_PHASE`（`workflows.ts:95`）
- `evaluateExecutionMode`（`transition.ts:145`）— `allowed` / `independence` / 兼容窗
- `PhaseExecutionSpec`（`protocol.ts:171`）— `allowed` + `independence`

### Capability Exploration Memory (injected)

- **归档 D1（improve-orchestration-execution-mode）**：propose / apply 必须子代理（写副作用与隔离）。
- **本会话 D1（inline-orchestration-delegation）**：验证与收尾内联，**propose / apply 保留子代理**（apply 实测 252k tokens / 101 次调用，内联会撑大主上下文）。
- **本会话实测成本**：12 次子代理约 1.62M tokens；其中 propose 120k、apply 253k，合计约 23%。

## Analysis

### Deep Analysis Trigger

- **Triggered**: Yes（修改既有协议与两个写阶段模板）
- **Scope**: `workflows.ts` 的 propose/apply 声明、`spec-propose.ts` / `spec-apply.ts` 正文、编排模板的阶段说明、测试与规格

### 关键张力

1. **与本次刚归档决策相邻的 D1 再次反转**：4.3.0 的 D1 明确保留 propose/apply 子代理，理由是「写阶段单次成本可控、内联会撑大主上下文（apply 252k/101 次调用）」。本次要反转它，需要给出新的证据或改变前提（例如改为分批内联 + 上下文预算控制）。
2. **单 agent 的「并行」语义**：真正的并行代码生成需要独立上下文（子代理）。主 agent 能做的并行是：同一回合发起多个独立工具调用、批内交错任务；写同一文件仍需串行。
3. **变更归属**：现有活跃变更已实现并提交，直接扩展会改写已完成的制品与规格；归档后另起变更则保留历史清晰。

## Questions

（L1-L5 grill 进行中）

## 术语表

| 术语 | 定义 | 避免使用 |
|------|------|---------|
| 主 agent 内联 | 阶段由当前主 agent 直接执行，不产生子代理上下文 | 本地执行（degraded 专用） |
| 单 agent 并行 | 同一回合并行发起独立工具调用 + 批内交错推进；不是独立上下文并行 | 真并行、并发实现 |
| 写阶段 | `propose`（写制品）/ `apply`（写代码） | 变更阶段（过宽） |

## 架构决策

（待定）

## 边界场景

（待 grill 补全）

## Decisions

（待 grill 确认）

## Scope Changes

| 变更时间 | 变更类型 | 变更描述 | 原因 |
|---------|---------|---------|------|
| 2026-11-08 | expand | 在活跃变更上追加 propose/apply 内联化 | 用户要求降低子代理 token |

## Pending

### For Phase 2 Impact Analysis

- `PROPOSE_PHASE` / `APPLY_PHASE` / `AUTO_APPLY_PHASE`（`workflows.ts:40/66/95`）- Priority: HIGH
- `evaluateExecutionMode`（`transition.ts:145`）- Priority: HIGH
- `spec-propose.ts` / `spec-apply.ts` 模板 - Priority: HIGH
- `workflow.ts` / `auto-workflow.ts` 阶段说明与 allowedTools - Priority: MEDIUM

### Unresolved Decisions

- 扩展现有变更 vs 归档后另起变更
- 「并行」的可执行形态
- 是否需要上下文预算 / 分批控制
