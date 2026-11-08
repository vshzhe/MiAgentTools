## Why

一次完整 auto-workflow 实测显示：12 次子代理调用共约 **1,620,515 tokens**，其中验证 / 复查占 **69.3%**
（verify-proposal 7 次 755,292；proposal-review 2 次 367,541）。成本集中在「每轮修复 → 新开验证代理 →
重新全量读取制品」，且子代理之间对同一批制品给出不一致结论（同一变更先后被判 100% 与 fail），
父级需要手工调和。写阶段（propose / apply / archive）各只执行一次，成本可控。

归档变更 `improve-orchestration-execution-mode` 的 D1 以「隔离与独立视角」为由否决了全部内联；
本次以实测成本结构为依据做**分级反转**：只读验证与收尾类阶段改由主 agent 内联，写阶段继续隔离。

## What Changes

- **执行方式重分配（D1）**：子代理保留 `propose` / `apply` / `spec-bulk-archive`（并行 ≤3）；
  `verify` / `archive` / `debug fix` / `migration source-scan` 与迁移 Phase 4 复查改为主 agent 内联。
- **验证内联契约（D2）**：单轮内联，固定清单（D1-D10 + B1-B7），每条结论 MUST 带 `文件:行` 或章节锚点；
  无证据结论不计分；FAIL 后同上下文修复并重跑清单（≤3），禁止新开代理或从头全量重读；
  回执记 `executionMode=inline` / `independence=self` / `readScope`，验证报告落盘
  `.openspec-tmp/pipeline-<change>/verify-report.md`。
- **迁移内部划分与阈值（D3）**：source-scan 内联；Phase 3 实现保留子代理（apply 语义）；
  Phase 4 复查改内联；计划读取文件数 > 300 或制品总行数 > 15k → 降级子代理并记 WARN。
- **覆盖归档 D1（D4）**：显式 supersede「全部内联否决 / verify 须非作者」；保留写阶段隔离理由。
- **协议与兼容窗（D5）**：`VERIFY_PHASE.independence` 改 `self-allowed`；`archive` / `fix` / `migration`
  的 `execution.allowed` 为 `['inline', 'subagent']`（模板只指示 inline，`subagent` 记 deprecation WARN，
  下个 major 收紧）；inline 阶段 `requiredCapabilities` 移除 `delegate`；同步 `render.ts` 分级执行文本
  与各技能 `allowedTools`（内联阶段移除 `Agent, Task`，`Skill(iagent-test)` 保留）。

**不在范围内**：门白名单 / 门预算 / 业务确认语义；`propose` / `apply` / `spec-bulk-archive` 的执行方式；
CLI 命令与产物布局；`iagent_test` 作为 apply / fix 子阶段的定位。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `host-orchestration`: 阶段执行方式声明与阶段推进校验的独立性 / 兼容窗语义
- `workflow-suite-skills`: 编排执行方式内联优先与验证证据契约
- `migration-skills`: 迁移执行方式、Phase 4 内联复查与上下文阈值降级

## Impact

### 直接影响的文件

- `src/core/host-orchestration/workflows.ts`：`PROPOSE_PHASE` / `VERIFY_PHASE` / `APPLY_PHASE` / `ARCHIVE_PHASE` / `AUTO_*` / `DEBUG_FIX` / `MIGRATION_*` 的 `execution` 与 `requiredCapabilities`
- `src/core/host-orchestration/transition.ts`：`independence` 映射与 deprecation WARN
- `src/core/host-orchestration/render.ts:195`：分级执行契约文本
- `src/core/templates/workflows/workflow.ts` / `auto-workflow.ts`：Phase 3 验证与 Phase 5 归档改内联；执行方式段
- `src/core/templates/workflows/debug.ts`：Phase 4 修复内联；verify-close 复查内联；allowedTools
- `src/core/templates/workflows/migration.ts`：source-scan / Phase 4 内联、阈值降级、Phase 3 保留子代理
- `src/core/templates/workflows/spec-verify.ts` / `spec-archive.ts`：内联执行契约与验证报告
- `src/core/templates/workflows/spec-verify-proposal.ts` / `proposal-review.ts`：只读验证技能默认内联、证据与兼容窗声明
- `src/core/templates/workflows/spec-bulk-archive.ts`：仅确认保留并行子代理（无行为变更）
- `openspec/specs/host-orchestration/spec.md` / `workflow-suite-skills/spec.md` / `migration-skills/spec.md`
- `test/host-orchestration.test.ts` / `test/stage-continuation.test.ts` / `test/template-consistency.test.ts` / `test/allowed-tools.test.ts`
- `skills/`：重新生成的静态快照；`AGENTS.md` 的分级执行表述

### Impact Analysis（Phase 2.0 CodeGraph）

| 符号 / 锚点 | 位置 | 影响面 |
| :--- | :--- | :--- |
| `WORKFLOW_PROTOCOLS` / `PhaseSpec.execution` | `src/core/host-orchestration/workflows.ts:27-200` | 5 个工作流协议、全部阶段的执行方式声明 |
| `evaluatePhaseTransition` | `src/core/host-orchestration/transition.ts` | 阶段推进阻断 / WARN；`host-orchestration.test.ts` 覆盖 |
| 分级执行渲染段 | `src/core/host-orchestration/render.ts:195` | 生成产物的执行契约文本；宿主适配器 |
| `getWorkflowSkillTemplate` / `getAutoWorkflowSkillTemplate` | `workflow.ts` / `auto-workflow.ts` | 各 5 处调用；`stage-continuation.test.ts` 覆盖 |
| `getDebugSkillTemplate` | `debug.ts:126` | 5 处调用；`stage-continuation.test.ts` 覆盖 |
| `getMigrationSkillTemplate` | `migration.ts` | 迁移编排正文与 allowedTools |
| `PhaseExecutionSpec` / `EXECUTION_MODES` | `src/core/host-orchestration/protocol.ts:153-174` | 取值域与独立性；`allowed-tools` / `claude-host-adapter` 等测试 |

### 向后兼容

- 新执行方式声明沿用既有 `PhaseSpec.execution` 机制，无新增回执字段。
- **兼容窗**：`archive` / `fix` / `migration` 同时接受 `inline` 与 `subagent`；旧 in-flight 回执不被判非法，
  `subagent` 记 deprecation WARN；下个 major 收紧为仅 `inline`。
- `propose` / `apply` / `spec-bulk-archive` 行为不变。
- 已安装的旧技能在 `iagent update` 前不感知新执行方式；协议校验对旧回执保持兼容。
