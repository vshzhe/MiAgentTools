## Why

五条编排流程（`workflow` / `auto-workflow` / `debug` / `spec-explore` / `spec-propose`）存在两类可复现的协议缺陷：

1. **非预期停点**：阶段返回结构化回执后，编排器有时不再推进，需人工确认。根因不在「模型偶发」——
   - 编排器身份提示词显式授权停止：「汇总 worker 回执后再决定推进、回退或停止」（`src/core/opencode-v2.ts:160`、`src/core/pi-native.ts:187`）；
   - OpenCode / Pi 的委派语句缺少 Claude 分支已有的退出守卫子句（`src/core/host-orchestration/actions.ts:92` vs `:95`、`:101-103`）；
   - 回执不落盘，且 `evaluatePhaseTransition` 在生产代码中无调用点（仅测试调用），`N5` 的「回执校验」实际退化为模型自检 —— 没有客观对象时，模型的默认行为是汇报后停；
   - 停点判据（5 类门）只在散文里重复出现，未定义「门自检」形式，且 `destructive-change` 的 `anchors` 为空（`src/core/host-orchestration/protocol.ts:128-133`），动作级停点无法通过仅认锚点的自检。

2. **CodeGraph 调用不韧性**：`codegraph_explore` 返回 `busy serving other concurrent requests` 时无固定处置；模板硬绑定 `codegraph_files` / `codegraph_search` / `codegraph_context`（共 27 处引用），而本宿主只暴露 `codegraph_explore`；`Bash(codegraph:*)` 放行任意子命令，实测 `codegraph search` → `unknown command 'search'`。现有 `codegraph-protocol.ts` 只覆盖「能力可用性 + 写锁争用」，未覆盖 busy、并发与 CLI 子命令边界。

## What Changes

### A. 续跑与停点（不改门白名单语义，只补执行侧条款）

- **续跑断言单一源**：新增 `renderContinuationContract()`（`src/core/host-orchestration/render.ts`），把「`status=ok` 后 `nextAllowed` 即本回合下一动作、先工具调用后文字、只有 5 类门可停、停点前门自检」收敛为唯一渲染源；`renderHostOrchestrationSection` 引用它。
- **修正编排器身份提示词**：`renderOrchestratorAgent`（`src/core/opencode-v2.ts:160`）与 `renderPiOrchestratorAgent`（`src/core/pi-native.ts:187`）把「再决定推进、回退或停止」改为「收到 `status=ok` 即续跑；停点须引用门白名单 id」。
- **委派语句补退出守卫**：`renderDelegate` 的 OpenCode / Pi 分支补「完成后按续跑契约继续」子句（与 Claude 分支对齐）。
- **回执落盘**：新增 `receipt-store.ts`（路径派生 + 读写），编排器把阶段回执写入 `.openspec-tmp/pipeline-<change>/receipts/<phase>.json` 后再校验；`spec-verify` 等无 `Write` 权限的阶段不改权限。
- **可校验的推进判定**：新增纯函数 `resolveNextPhase(protocol, phaseId, nextAllowed)`（`transition.ts`），`nextAllowed` 不可解析即 `invalid-receipt`；固定判定顺序「能力 → 门 → 回执」，**门优先**，自动重试仅当 `blockedBy` 恰为 `['invalid-receipt']`。
- **门自检接受类别 id**：`destructive-change` 无阶段锚点，停点自检规则改为「类别 id **或** 锚点 id」。

### B. CodeGraph 调用韧性（收敛到主通道）

- `codegraph-protocol.ts` 新增三段单一源：`CODEGRAPH_CALL_DISCIPLINE`（主通道 + 串行 + 有界查询）、`CODEGRAPH_BUSY_LADDER`（busy 阶梯）、`CODEGRAPH_CLI_BOUNDARY`（CLI 仅 `status` / `unlock` / `sync`）。
- `spec-explore` / `debug` 的扫描段改为「`codegraph_explore` 主通道 + 可选通道」表述，不再把 `codegraph_files` / `codegraph_search` 写成硬依赖。
- busy 处置：串行、间隔 5–10s 重试 ≤2 次、仍忙则本步骤降级内置工具 + WARN；MUST NOT 判索引不可用、MUST NOT `unlock` / `sync`。

### C. 防漂移

- 新增生成期断言测试（`test/stage-continuation.test.ts` 扩展 + 新建 `test/codegraph-protocol.test.ts`），锁定：编排器提示词不含「再决定…或停止」、三段 CodeGraph 单一源被各模板引用、回执落盘路径派生、`resolveNextPhase` 边界。

## Capabilities

### New Capabilities

- `codegraph-call-protocol`: CodeGraph 调用的跨宿主协议 —— 主通道 / 可选通道、busy 阶梯、串行纪律、CLI 子命令边界与降级条件。

### Modified Capabilities

- `skill-stage-continuation`: 续跑契约补充执行侧条款 —— 续跑断言、回执内部化与落盘、门自检（类别 id 或锚点 id）、非法回执自动重试一次的边界与「门优先」重试条件。
- `host-orchestration`: 编排器身份提示词与委派语句的续跑语义、回执落盘路径、`resolveNextPhase` 推进判定与判定顺序。

## Impact

### 直接影响的文件

- `src/core/host-orchestration/render.ts`: 新增续跑断言单一源渲染；`renderHostOrchestrationSection` 引用
- `src/core/host-orchestration/actions.ts`: OpenCode / Pi 委派分支补退出守卫子句
- `src/core/host-orchestration/receipt-store.ts`: 新建（回执落盘路径派生与读写）
- `src/core/host-orchestration/transition.ts`: 新增 `resolveNextPhase`；注释固定判定顺序与重试条件
- `src/core/opencode-v2.ts`: `renderOrchestratorAgent` 续跑语义修正
- `src/core/pi-native.ts`: `renderPiOrchestratorAgent` 续跑语义修正
- `src/core/templates/codegraph-protocol.ts`: 新增调用纪律 / busy 阶梯 / CLI 边界三段单一源
- `src/core/templates/workflows/spec-explore.ts` / `debug.ts`: 扫描段改用主通道表述
- `src/core/templates/workflows/auto-workflow.ts` / `workflow.ts` / `spec-propose.ts`: 续跑与停点条款改为引用单一源表述
- `test/stage-continuation.test.ts`: 扩展续跑断言回归锁
- `test/codegraph-protocol.test.ts`: 新建（三段单一源 / 模板引用一致性）
- `skills/`: `pnpm build && pnpm generate:skills` 重新生成快照

### 向后兼容

无破坏性变更。不新增 / 删除 CLI 命令，不改变 5 类门白名单与 `PhaseSpec` 形状，不改变既有回执字段的合法性判定（新字段与落盘均为附加）。存量产物：未落盘时按会话回执自检并记 WARN，不阻断；`nextAllowed` 仍为阶段 id 语义，旧回执照常解析。
