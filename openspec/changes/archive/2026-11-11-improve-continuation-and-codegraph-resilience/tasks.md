# Tasks: improve-continuation-and-codegraph-resilience

<!-- 任务类型标签：[代码] / [测试][单元|功能][P0|P1|P2] / [DB脚本] / [使用说明] -->
<!-- 追溯引用规范形态：Spec Ref = capability / Requirement；Scenario Ref = capability / Requirement / Scenario -->

> **实现顺序**：第 1 组（续跑单一源与宿主提示词）与第 2 组（回执落盘与推进判定）互相独立，可并行；第 3 组（CodeGraph 单一源）依赖 `codegraph-protocol.ts`，与 1/2 无冲突；第 4 组为快照与回归，必须最后执行。

## 1. 续跑协议单一源与宿主提示词

- [x] 1.1 [代码] 在 `render.ts` 新增 `renderContinuationContract()`：输出「`status=ok` 后 `nextAllowed` 即本回合下一动作（先工具调用后文字）/ 只有 5 类门可停 / 停点前门自检接受类别 id 或锚点 id / 回执内部化（至多一行进度）/ 非法回执自动重试一次（仅 `blockedBy == ['invalid-receipt']`）/ 能力缺失与未知门为阻断非停点」；`renderHostOrchestrationSection` 以引用方式使用该段，删除重复散文
  - 文件：`src/core/host-orchestration/render.ts`
  - 验证：strict 与 degraded 两种协商均输出该段；既有「回执是**中间状态**」「同一用户回合内继续下一阶段」断言仍成立
  - Spec Ref：skill-stage-continuation / Continuation contract after delegated receipt
  - Scenario Ref：skill-stage-continuation / Continuation contract after delegated receipt / 回执后在同一用户回合继续
  - Scenario Ref：skill-stage-continuation / Continuation contract after delegated receipt / 停点前必须引用合法门 id

- [x] 1.2 [代码] 在 `renderDelegate` 的 OpenCode 与 Pi strict 分支补「完成后按续跑契约继续（回执为中间状态，停点须引用门白名单 id）」子句，与 Claude 分支对齐 [N2][N4]
  - 文件：`src/core/host-orchestration/actions.ts`
  - 验证：三分支文本均含续跑子句；Codex degraded 分支仍显式声明「不构成委派」
  - Spec Ref：host-orchestration / Orchestrator continuation prompt
  - Scenario Ref：host-orchestration / Orchestrator continuation prompt / 跨宿主委派子句一致

- [x] 1.3 [代码] 修正 OpenCode 编排器身份提示词：删除「汇总 worker 回执后再决定推进、回退或停止」，改为「收到 `status=ok` 并校验通过后 MUST 立即继续下一阶段；停点须引用门白名单 id」 [N3]
  - 文件：`src/core/opencode-v2.ts`
  - 验证：生成文本不含「再决定推进、回退或停止」；含续跑与停点条款
  - Spec Ref：host-orchestration / Orchestrator continuation prompt
  - Scenario Ref：host-orchestration / Orchestrator continuation prompt / 编排器提示词不含停止授权

- [x] 1.4 [代码] 修正 Pi 编排器身份提示词（同上语义），保留 `allowed_subagents` 与 degraded 声明 [N3]
  - 文件：`src/core/pi-native.ts`
  - 验证：`test/pi-native.test.ts` 断言新文本；`allowed_subagents` 生成不回归
  - Spec Ref：host-orchestration / Orchestrator continuation prompt
  - Scenario Ref：host-orchestration / Orchestrator continuation prompt / 编排器提示词不含停止授权

- [x] 1.5 [代码] 把 `auto-workflow` / `workflow` / `spec-propose` 正文中重复的「回执续跑」散文改为引用续跑契约表述，并显式声明「回执 MUST NOT 作为面向用户的最终消息」 [N1][N12]
  - 文件：`src/core/templates/workflows/auto-workflow.ts`、`workflow.ts`、`spec-propose.ts`
  - 验证：三份模板仍含「回执是中间状态」「MUST NOT 以回执结束回合」；新增回执内部化条款；无第二份手写门清单
  - Spec Ref：skill-stage-continuation / Continuation contract after delegated receipt
  - Scenario Ref：skill-stage-continuation / Continuation contract after delegated receipt / 回执不作为面向用户的最终消息

- [x] 1.6 [测试][单元][P0] 扩展 `test/stage-continuation.test.ts`：续跑断言存在、编排器提示词不含停止授权、三分支委派子句一致、回执内部化条款存在 [N2][N3][N12]
  - 文件：`test/stage-continuation.test.ts`
  - 验证：`pnpm vitest run test/stage-continuation.test.ts`
  - Spec Ref：skill-stage-continuation / Continuation contract after delegated receipt
  - Scenario Ref：skill-stage-continuation / Continuation contract after delegated receipt / 回执后在同一用户回合继续
  - Scenario Ref：skill-stage-continuation / Continuation contract after delegated receipt / 确认门是合法停点
  - Scenario Ref：skill-stage-continuation / Continuation contract after delegated receipt / 失败回执不触发续跑
  - Scenario Ref：skill-stage-continuation / Continuation contract after delegated receipt / 回执不作为面向用户的最终消息
  - Scenario Ref：skill-stage-continuation / Continuation contract after delegated receipt / 停点前必须引用合法门 id
  - Scenario Ref：skill-stage-continuation / Continuation contract after delegated receipt / 用户「继续」直接续跑
  - Spec Ref：host-orchestration / Orchestrator continuation prompt
  - Scenario Ref：host-orchestration / Orchestrator continuation prompt / 编排器提示词不含停止授权
  - Scenario Ref：host-orchestration / Orchestrator continuation prompt / 跨宿主委派子句一致

## 2. 回执落盘与推进判定

- [x] 2.1 [代码] 新建 `receipt-store.ts`：导出 `receiptStorePath(changeName, phaseId)`（`path.join` 构造 `.openspec-tmp/pipeline-<change>/receipts/<phase>.json`）与读写函数；写入失败返回可诊断结果（调用方 WARN 继续） [N5]
  - 文件：`src/core/host-orchestration/receipt-store.ts`、`src/core/host-orchestration/index.ts`
  - 验证：Windows / POSIX 分隔符由 `path.join` 生成；写入失败不抛未捕获异常
  - Spec Ref：host-orchestration / Receipt persistence and next-phase resolution
  - Scenario Ref：host-orchestration / Receipt persistence and next-phase resolution / 回执路径可确定性派生

- [x] 2.2 [代码] 在 `transition.ts` 新增纯函数 `resolveNextPhase(protocol, phaseId, nextAllowed)`：命中返回目标阶段，未命中返回不可解析结果；不修改入参；并在文件注释固定判定顺序「能力 → 门 → 回执」与「门优先、自动重试仅限纯回执非法」 [N5][N11]
  - 文件：`src/core/host-orchestration/transition.ts`
  - 验证：命中 / 未命中 / 不改原对象三类用例通过；既有 `evaluatePhaseTransition` 行为不变
  - Spec Ref：host-orchestration / Receipt persistence and next-phase resolution
  - Scenario Ref：host-orchestration / Receipt persistence and next-phase resolution / nextAllowed 解析到下一阶段

- [x] 2.3 [代码] 在续跑协议段补齐回执校验条款：落盘后校验、`nextAllowed` 不可解析即 `invalid-receipt`、自动重试一次不询问用户、门优先、能力缺失与未知门为阻断 [N6][N7][N9][N13]
  - 文件：`src/core/host-orchestration/render.ts`
  - 验证：文本含「`blockedBy` 恰为 `['invalid-receipt']`」「门优先」「阻断并报告，不停点」
  - Spec Ref：skill-stage-continuation / Receipt validation and failure handling
  - Scenario Ref：skill-stage-continuation / Receipt validation and failure handling / 门优先于回执重试
  - Scenario Ref：skill-stage-continuation / Receipt validation and failure handling / 缺字段回执被阻断
  - Scenario Ref：skill-stage-continuation / Receipt validation and failure handling / 参数与账本皆缺时 blocked

- [x] 2.4 [代码] 补齐停点门自检条款：接受门白名单**类别 id 或锚点 id**，`destructive-change` 只认类别 id；无法引用合法 id 时 MUST NOT 停点 [N8][N14]
  - 文件：`src/core/host-orchestration/render.ts`
  - 验证：文本明确类别 id 与 `destructive-change` 例外；与 `GATE_WHITELIST` 常量取值一致
  - Spec Ref：skill-stage-continuation / Continuation contract after delegated receipt
  - Scenario Ref：skill-stage-continuation / Continuation contract after delegated receipt / 停点前必须引用合法门 id

- [x] 2.5 [测试][单元][P0] 新增回执落盘与 `resolveNextPhase` 单测（路径派生、命中、未命中、不可变） [N5][N11]
  - 文件：`test/receipt-store.test.ts`
  - 验证：`pnpm vitest run test/receipt-store.test.ts`
  - Spec Ref：host-orchestration / Receipt persistence and next-phase resolution
  - Scenario Ref：host-orchestration / Receipt persistence and next-phase resolution / 回执路径可确定性派生
  - Scenario Ref：host-orchestration / Receipt persistence and next-phase resolution / nextAllowed 解析到下一阶段
  - Scenario Ref：host-orchestration / Receipt persistence and next-phase resolution / nextAllowed 不可解析

- [x] 2.6 [测试][单元][P0] 扩展回执校验与判定顺序单测：缺字段阻断、非法 `confirmedGates`、重试耗尽、门优先不触发重试、`nextAllowed` 不可解析 [N9][N10][N13]
  - 文件：`test/host-orchestration.test.ts`
  - 验证：`pnpm vitest run test/host-orchestration.test.ts`
  - Spec Ref：skill-stage-continuation / Receipt validation and failure handling
  - Scenario Ref：skill-stage-continuation / Receipt validation and failure handling / 缺字段回执被阻断
  - Scenario Ref：skill-stage-continuation / Receipt validation and failure handling / 非法 confirmedGates 被阻断
  - Scenario Ref：skill-stage-continuation / Receipt validation and failure handling / 重试耗尽后暂停
  - Scenario Ref：skill-stage-continuation / Receipt validation and failure handling / 回执落盘后可校验
  - Scenario Ref：skill-stage-continuation / Receipt validation and failure handling / 门优先于回执重试
  - Scenario Ref：skill-stage-continuation / Receipt validation and failure handling / 参数与账本皆缺时 blocked
  - Scenario Ref：skill-stage-continuation / Receipt validation and failure handling / nextAllowed 不可解析即非法回执

## 3. CodeGraph 调用协议

- [x] 3.1 [代码] 在 `codegraph-protocol.ts` 新增三段单一源导出：`CODEGRAPH_CALL_DISCIPLINE`（主通道 `codegraph_explore`、可选通道清单、串行、`maxFiles` ≤ 12）、`CODEGRAPH_BUSY_LADDER`（5–10s 重试 ≤2 次 → 降级 WARN；不判索引不可用、不 unlock/sync）、`CODEGRAPH_CLI_BOUNDARY`（仅 `status` / `unlock` / `sync`；`unknown command` 改 MCP） [N16][N17][N18]
  - 文件：`src/core/templates/codegraph-protocol.ts`
  - 验证：三段文本可被模板导入插值；与 `CODEGRAPH_LOCK_LADDER` 语义不冲突
  - Spec Ref：codegraph-call-protocol / CodeGraph primary channel and optional channels
  - Scenario Ref：codegraph-call-protocol / CodeGraph primary channel and optional channels / 宿主仅暴露主通道时扫描仍完成
  - Spec Ref：codegraph-call-protocol / Serial call discipline and busy ladder
  - Scenario Ref：codegraph-call-protocol / Serial call discipline and busy ladder / 禁止并行发起 CodeGraph 调用
  - Spec Ref：codegraph-call-protocol / CLI subcommand boundary
  - Scenario Ref：codegraph-call-protocol / CLI subcommand boundary / 未知子命令改用 MCP

- [x] 3.2 [代码] `spec-explore` 1.2.1 扫描段改为「主通道 `codegraph_explore` + 可选通道」表述，移除对 `codegraph_files` / `codegraph_search` 的硬依赖，插入 busy 阶梯与 CLI 边界引用 [N16][N20]
  - 文件：`src/core/templates/workflows/spec-explore.ts`
  - 验证：正文不再把 `codegraph_files` / `codegraph_search` 写成必需步骤；`Codebase Findings` 写回步骤保留
  - Spec Ref：codegraph-call-protocol / CodeGraph primary channel and optional channels
  - Scenario Ref：codegraph-call-protocol / CodeGraph primary channel and optional channels / 宿主仅暴露主通道时扫描仍完成
  - Scenario Ref：codegraph-call-protocol / CodeGraph primary channel and optional channels / 可选通道存在时增强而非替代

- [x] 3.3 [代码] `debug` 2.2.1–2.2.4 工具映射改写：调用链与影响半径以 `codegraph_explore` 的返回结构表达，`impact` / `callers` / `callees` 标注为可选通道；保留排查深度分级信号语义 [N16][N18]
  - 文件：`src/core/templates/workflows/debug.ts`
  - 验证：分级阈值与路径选择语义不变；不再要求不存在的工具名
  - Spec Ref：codegraph-call-protocol / CodeGraph primary channel and optional channels
  - Scenario Ref：codegraph-call-protocol / CodeGraph primary channel and optional channels / 可选通道存在时增强而非替代
  - Spec Ref：codegraph-call-protocol / CLI subcommand boundary
  - Scenario Ref：codegraph-call-protocol / CLI subcommand boundary / CLI 不越权执行写操作

- [x] 3.4 [代码] 其余引用模板（`migration` / `project-init` / `spec-archive` / `spec-bulk-archive`）在探测段后接入 `CODEGRAPH_CALL_DISCIPLINE` 与 `CODEGRAPH_BUSY_LADDER`，不改变各自流程 [N15][N17][N18]
  - 文件：`src/core/templates/workflows/migration.ts`、`project-init.ts`、`spec-archive.ts`、`spec-bulk-archive.ts`
  - 验证：各模板仍引用探测顺序单一源；新增 busy 与 CLI 边界段；工具白名单不扩大
  - Spec Ref：codegraph-call-protocol / Serial call discipline and busy ladder
  - Scenario Ref：codegraph-call-protocol / Serial call discipline and busy ladder / 首次 busy 后重试成功
  - Scenario Ref：codegraph-call-protocol / Serial call discipline and busy ladder / 重试耗尽后本步骤降级

- [x] 3.5 [测试][单元][P0] 新建 `test/codegraph-protocol.test.ts`：三段文本存在且互不矛盾、模板引用一致性、busy 阶梯数值（≤2 次 / 5–10s）、CLI 子命令白名单 [N16][N17][N18][N19]
  - 文件：`test/codegraph-protocol.test.ts`
  - 验证：`pnpm vitest run test/codegraph-protocol.test.ts`
  - Spec Ref：codegraph-call-protocol / CodeGraph primary channel and optional channels
  - Scenario Ref：codegraph-call-protocol / CodeGraph primary channel and optional channels / 探测失败才降级内置工具
  - Spec Ref：codegraph-call-protocol / Serial call discipline and busy ladder
  - Scenario Ref：codegraph-call-protocol / Serial call discipline and busy ladder / 首次 busy 后重试成功
  - Scenario Ref：codegraph-call-protocol / Serial call discipline and busy ladder / 重试耗尽后本步骤降级
  - Scenario Ref：codegraph-call-protocol / Serial call discipline and busy ladder / 禁止并行发起 CodeGraph 调用
  - Spec Ref：codegraph-call-protocol / CLI subcommand boundary
  - Scenario Ref：codegraph-call-protocol / CLI subcommand boundary / 未知子命令改用 MCP
  - Scenario Ref：codegraph-call-protocol / CLI subcommand boundary / CLI 不越权执行写操作

- [x] 3.6 [测试][单元][P1] 模板硬绑定回归：断言 `spec-explore` / `debug` 正文不把缺失工具列为必需步骤，且不出现把 MCP 工具名当 CLI 子命令的示例 [N16]
  - 文件：`test/codegraph-protocol.test.ts`
  - 验证：`pnpm vitest run test/codegraph-protocol.test.ts`
  - Spec Ref：codegraph-call-protocol / CodeGraph primary channel and optional channels
  - Scenario Ref：codegraph-call-protocol / CodeGraph primary channel and optional channels / 宿主仅暴露主通道时扫描仍完成
  - Scenario Ref：codegraph-call-protocol / CodeGraph primary channel and optional channels / 可选通道存在时增强而非替代

## 4. 快照与回归

- [x] 4.1 [代码] 重建生成快照与宿主产物：`pnpm build && pnpm generate:skills`（模板改动必须同步快照，否则 `skills-parity` 失败） [N1][N2]
  - 文件：`skills/`、`dist/`
  - 验证：`git status` 中 `skills/` 变更与模板改动一一对应
  - Spec Ref：host-orchestration / Orchestrator continuation prompt
  - Scenario Ref：host-orchestration / Orchestrator continuation prompt / 编排器提示词不含停止授权

- [x] 4.2 [测试][功能][P0] 全量回归：`pnpm test`，重点覆盖 `skills-parity`、`allowed-tools`、`template-derivation`、`stage-continuation`、`opencode-v2`、`pi-native` [N1][N3]
  - 文件：`test/`
  - 验证：`pnpm test` 全绿；无新增 WARN 来源（除既有 WARN）
  - Spec Ref：host-orchestration / Orchestrator continuation prompt
  - Scenario Ref：host-orchestration / Orchestrator continuation prompt / 跨宿主委派子句一致
