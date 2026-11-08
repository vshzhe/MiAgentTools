## Context

本变更同时触及两个层面：

1. **技能编排层**：`workflow` / `auto-workflow` / `debug` 通过宿主机制委派阶段子技能。当前 Claude 宿主只经 `Skill` 工具委派；`Skill` 是同上下文注入，被委派技能输出回执后，模型没有"返回边界"可依赖，回合自然结束，父编排的下一阶段不被触发。现有"直通句"只约束阶段入口，不约束委派返回边界。
2. **需求文档耦合**：三父流程各自持有一次"生成 / 跳过"桥、`requirementDocStatus` 跨阶段持久化、`spec-archive` / `spec-bulk-archive` 只读报告、协议门 `requirement-doc-bridge`、回执字段、DEPS 注入与白名单条目。需求文档成为主流程的额外停点与耦合面。

探索阶段已确认流程基准（见 `exploration.md` 的 `## 功能流程图`）：交互阶段（`spec-explore`）保留 `Skill` 内联；自动阶段改为前台 `Agent` 子代理；取消所有需求文档桥与状态传递。

### 流程基准覆盖（节点 → 实现 / 既有）

| 节点 | 操作 | 处置 | 任务 |
| :--- | :--- | :--- | :--- |
| N1 | 用户输入主题 | 既有入口 | — |
| N2 | 父编排内联加载 | 续跑契约 | 1.1 / 1.2 |
| N3 | 委派 `spec-explore`（Skill 内联） | 混合委派 | 2.1 / 2.7 |
| N4 | 提示词门 / 流程最终确认门 | 既有 | — |
| N5 | 探索回执（inline） | 续跑契约 | 1.2 / 2.3 / 2.7 |
| N6 | 委派 `spec-propose`（Agent） | 混合委派 | 1.1 / 2.1 / 2.4 / 2.8 |
| N7 | 回执校验 | 新增校验契约 | 1.3 / 1.4 / 1.5 |
| N7E | 重试 / 暂停 | 失败处理 | 1.4 / 1.6 |
| N8 | 委派 verify-proposal + proposal-review（Agent） | 混合委派 | 1.1 / 2.1 / 2.6 |
| N9 | workflow 实现 + 测试桥 | 三出口 | 2.4 |
| N10 | 委派 `spec-apply`（Agent，gate-skip） | 混合委派 | 1.1 / 2.1 / 2.2 / 2.3 |
| N11 | 编译与测试证据 | 既有（apply） | — |
| N12 | 委派 `spec-verify`（Agent） | 混合委派 | 1.1 / 2.1 |
| N13 | workflow 归档桥 | 移除文档状态 | 2.4 / 2.5 |
| N14 | 委派 `spec-archive`（Agent） | 混合委派 | 1.1 / 2.1 / 2.2 |
| N15 | 完成摘要 | 更新表述 | 2.2 / 2.5 |
| M1 | 用户 bug 描述 | 既有 | — |
| M2 | 提示词门 | 既有 | — |
| M3 | 复现 / 证据轨 | 既有 | — |
| M4 | 排查定位 | 既有 | — |
| M5 | 诊断 + 方案包 | 既有 | — |
| M6 | 修复 + 委派 `iagent-test`（Agent） | 混合委派 | 1.1 / 2.6 |
| M7 | 编译检查 | 既有 | — |
| M8 | 同步提案 | 既有 | — |
| M9 | 委派 verify-proposal（Agent） | 混合委派 | 1.1 / 2.6 |
| M10 | 深度复查 proposal-review（Agent） | 混合委派 | 1.1 / 2.6 |
| M11 | verify-close 收束 | 移除文档桥 | 2.6 |
| M12 | 清理工作区 | 既有 | — |
| P1 | 三父流程不再展示文档桥 | 移除 | 2.2 / 2.4 / 2.6 |
| P2 | 不再委派 requirement-doc | 移除 | 2.2 / 2.5 / 2.6 / 3.4 |
| P3 | archive / bulk 不再只读报告 | 移除 | 3.1 / 3.2 |
| P4 | 独立技能手工调用 | 保留 | 3.4 |
| P5 | DEPS 与白名单移除 | 移除 | 1.2 / 3.3 / 3.5 / 3.6 / 3.7 |

运行时事实（claude-code-guide 核对）：`Skill` 注入当前上下文、无返回控制 API；前台 `Agent` 隔离上下文并以 `tool_result` 返回最终消息，父级在同一用户回合继续。这是选择混合委派的直接依据。

### 实现步骤拆解（复杂操作 → 执行层 / 异常路径）

1. **[共享层] 阶段分类与续跑契约**：`actions.ts` 增加 `isInteractiveStage` 并渲染 Skill / Agent；`render.ts` 与 `delegation-contract.ts` 注入续跑契约；`protocol.ts` 复用回执校验。
   - 异常：分类错误 → `spec-explore` 被放入子代理，交互门不可用；子代理载入技能失败 → `status=blocked`；回执非法 → `invalid-receipt` 阻断。
2. **[模板层] 三父流程接入**：`auto-workflow.ts` / `workflow.ts` / `debug.ts` 的阶段委派改为 Agent、增加返回边界续跑句、移除文档桥与状态；`auto-workflow` 的门账本来源改为流程基准确认。
   - 异常：流程基准未确认 → 不写账本、不传 `gate-skip` 并暂停；账本写入失败 → 停止委派；测试 / 编译失败 → 按预算暂停。
3. **[协议层] 需求文档逻辑移除**：`workflows.ts` / `protocol.ts` / `index.ts` / `gate-ledger.ts` 删除 `RequirementDocStatus`、`requirement-doc-bridge`、`STATUS_RECEIPT`、`VERIFY_WITH_BRIDGE`；`profiles.ts` 移除 DEPS；`render.ts` 移除条件委派。
   - 异常：导出残留 → 编译失败；白名单锚点残留 → `auditGateWhitelistAlignment()` 非空；DEPS 残留 → 安装集断言失败。
4. **[模板层] spec 技能收敛**：`spec-explore` / `spec-propose` 增补续跑；`spec-archive` / `spec-bulk-archive` 删除只读报告；`spec-apply` 移除门账本文档提及；`requirement-doc` 改为无自动调用方。
   - 异常：模板与快照不一致 → `skills-parity` 失败；command 派生不一致 → `template-derivation` 失败。
5. **[测试层] 验证与发布**：更新受影响的 16 个测试文件；`pnpm build && pnpm generate:skills && pnpm test`；版本递增（major）并同步 CHANGELOG / README / 文档。
   - 异常：测试遗漏 → 全量回归暴露；版本等级冲突 → 由 `iagent version` 取较大者；快照未重建 → parity 失败。

## Goals / Non-Goals

**Goals**:

- 消除 auto-workflow / debug（以及同构 workflow）在委派回执后停住的问题，使无门阶段自动连续执行。
- 建立单一「续跑契约」：回执是中间状态；只有门白名单内的确认门是合法停点。
- 需求文档生成逻辑从三父流程、proposal、archive、bulk-archive、协议、DEPS 与白名单中彻底移除；仅保留独立 `iagent-requirement-doc` 技能。
- 保持跨宿主一致性：OpenCode / Pi / Codex 不伪造机制，统一注入续跑契约。
- 更新生成期产物、快照、测试与版本文档。

**Non-Goals**:

- 不改变门白名单的 5 类语义、不新增门、不改变 `GateSpec` / 条件门判定。
- 不改变 `spec-apply` 的测试执行门、编译检查、范围蔓延确认与共享资源协议。
- 不删除 `iagent-requirement-doc` 技能本体或其八章节转换规则。
- 不改变 `migration` 的"源需求文档"与 `feature-doc` 的"迁移需求实现文档"语义。
- 不引入 `context: fork` 的编排器（会破坏交互门）。

## Decisions### D1: Claude 采用混合委派（交互 Skill + 自动 Agent）

- **选择**: `spec-explore` 由主 agent 经 `Skill` 内联执行；`spec-propose` / `spec-verify-proposal` / `proposal-review` / `test` / `spec-apply` / `spec-verify` / `spec-archive` 由前台 `Agent`（兼容 `Task`）子代理执行。
- **理由**: 交互门（提示词门 / 流程最终确认门）必须与用户交互，不能放进隔离子代理；自动阶段需要真实结果边界，Agent 的 `tool_result` 使父级自然续跑。与 `HOST_PROFILES.claude.native.delegation = 'Skill / Agent 子代理'` 的既有声明一致。
- **备选**: 纯文本续跑（可靠性不足，用户实测直通句仍停）；统一 Agent（交互门不可用）；先文本后按需 Agent（返工风险）。

### D2: 续跑契约落在共享渲染层

- **选择**: 在 `render.ts` / `delegation-contract.ts` 增加共享「续跑契约」文本，由 `renderHostOrchestrationSection` 与 `renderDelegationModeContract` 注入所有编排与被委派技能；父模板的阶段入口直通句保留，并新增返回边界续跑句。
- **理由**: 模板保持宿主无关，机制词生成期渲染；避免逐模板手写第二份契约造成漂移。
- **备选**: 仅在三个父模板内联（会与 spec-* 子技能契约漂移）；仅改子技能（父级仍可能停）。

### D3: 阶段分类单一源

- **选择**: 在 `actions.ts` 维护 `INTERACTIVE_STAGE_WORKFLOW_IDS = ['spec-explore']`（或等价的 `isInteractiveStage(workflowId)` 纯函数）；`renderDelegate` 依据分类选择 Skill / Agent。`allowedTools` 中的 `Skill(...)` 条目继续作为委派目标声明保留，供 `deriveOrchestrationDelegations` 派生与权限兜底。
- **理由**: 委派清单派生已有单一源（`parseDelegationTargets`）；新增分类只解决"机制选择"，不产生第二份目标表。
- **备选**: 在每个模板手写机制（漂移）；新增 `AgentTarget(...)` 声明（改动面大且测试/派生需重写）。

### D4: 子代理载入技能与退出守卫

- **选择**: Agent prompt 要求子代理优先经 `Skill(iagent-<workflowId>)` 加载阶段技能；不支持 Skill 时降级为读取**宿主提供的技能路径**（Claude `.claude/skills/iagent-<workflowId>/SKILL.md`；OpenCode / Pi 使用各自技能目录）。子代理 MUST 返回结构化回执并携带 EXIT GUARD（完成即停、不推进阶段、不提出后续步骤）。阶段内部再委派（如 `spec-apply → iagent-test`）同样适用续跑契约：返回后 MUST 继续批次调度，MUST NOT 停在子技能回执。
- **理由**: 复用既有技能加载机制；`SKILL.md` 是生成产物，始终存在；宿主路径由适配器提供，避免硬编码 Claude 目录。EXIT GUARD 防止子代理越权推进；内部委派续跑防止“子代理里再停住”。
- **备选**: 父级把完整 SKILL.md 内联进 prompt（上下文膨胀且易过期）；仅处理阶段级委派、忽略阶段内部委派（会留下同类停点）。

### D5: 回执校验与失败暂停

- **选择**: 父编排在推进前校验 `phase` / `status` / `artifact` / `nextAllowed` / `failure` / `confirmedGates`；`status=ok` 且校验通过才续跑；`blocked` / `failed` / `incomplete` 按阶段重试策略处理，耗尽后暂停。
- **理由**: 续跑不能以"看起来完成"为依据；失败必须有可报告的失败原因。
- **备选**: 仅在 `status=ok` 时续跑但不校验字段（无法区分伪造 / 过期回执）。

### D6: 需求文档逻辑彻底移除

- **选择**: 删除三父流程的文档桥与状态持久化；删除 `spec-propose` 的桥引用；删除 `spec-archive` / `spec-bulk-archive` 的只读报告与状态读取；删除 `RequirementDocStatus` 及 helper、`Receipt.requirementDocStatus`、`STATUS_RECEIPT`、`VERIFY_WITH_BRIDGE`、`DOC_BRIDGE_GATE`、`GATE_WHITELIST` 的 `requirement-doc-bridge` 锚点与 `PHASE_GATE_CATEGORY` 映射；从 DEPS 与三父流程 `allowedTools` 移除 `requirement-doc`。
- **理由**: 用户裁决"彻底移除"；需求文档只由独立技能按需生成。移除后父流程少一次用户停点，且协议/回执/DEPS 不再有死字段。
- **备选**: 保留 archive 只读报告（留下状态字段与死代码面）；保留状态兼容（与目标最远）。

### D7: auto-workflow 的门账本来源改为流程最终确认

- **选择**: 需求文档桥移除后，auto-workflow 的唯一用户门是探索阶段的 L1-L5 澄清与功能流程图门。父编排在探索回执声明 `flowBaselineConfirmed=true` **且验证 PASS + 深度复查收束**后，把 `design-confirmation` 写入 handoff 包 `## 已确认门`；未确认或验证/复查未收束时 MUST NOT 写账本、MUST NOT 传 `gate-skip=design-confirmation`，暂停报告。
- **理由**: 流程基准确认 + 已验证设计共同构成设计基线确认；仅凭流程门跳过设计门会把未验证的设计当作已确认。验证分数与复查结论仍须在报告中呈现（无用户门 ≠ 无质量信息）。
- **备选**: 新增自动实现确认桥（违背"减少干预"）；让 apply 的设计门照常触发（自动管线会停）。

### D8: 提交 / 暂存排除保留

- **选择**: `spec-apply` / `commit` 对 `需求文档.md` 的暂存排除保留。
- **理由**: 独立技能仍可能产出该文件；排除是提交安全规则，不是生成逻辑。移除它会让人工评审产物被自动混入提交。

### D9: 跨宿主一致性

- **选择**: 仅 Claude 使用 Agent 子代理；OpenCode 保持 V2 `subagent`、Pi strict 保持 Extension Agent、Codex 保持显式 degraded 本地执行。三者统一注入续跑契约文本；Codex MUST NOT 声称委派完成。
- **理由**: 各宿主机制不同，但"回执是中间状态、门是合法停点"的语义应一致。
- **备选**: 为每个宿主实现同等 Agent 语义（受宿主能力限制，做不到）。

### D10: 测试、快照与版本

- **选择**: 按 AGENTS.md 守则执行 `pnpm build && pnpm generate:skills`；同步受影响测试；版本按实现影响面判定（预期 major），提交信息使用 `feat!:` / `BREAKING CHANGE:`。
- **理由**: 变更删除既有行为与默认注入，属破坏性变更；快照与断言必须与模板同步。

### D11: 子代理数据共享与 token 预算

- **选择**:
  - 父级向子代理传递 **Stage Envelope**（紧凑结构化文本，不含制品正文）：`changeName` / `changeRoot` / `phase` / `workflowId` / `mode` / `gateSkips` / `confirmedGates` / `explorationFile` / `handoffPackPath` / `compileReportPath`（archive 与归档前检查）/ `upstreamReceipt` / `sourceFingerprint` / `rulesPath` / `configPath` / `resume`。MUST 只传路径与结构化字段，MUST NOT 内联制品正文或完整 `SKILL.md`。
  - 子代理 MUST 先读 handoff 包（唯一必读制品），再按需增量读取制品；MUST NOT 重读包已覆盖的 proposal / specs / design，MUST NOT 重跑包已覆盖的 CodeGraph 查询；包缺口走「包缺口回执」。
  - 子代理最终消息 MUST 只是 **Stage Receipt**：`phase` / `status` / `artifact` / `nextAllowed` / `failure` / `confirmedGates` / `blockedGate` / `blockedReason` / `resumeHint` / `reportPath` / `reviewSummary` + 阶段特定字段；MUST NOT 粘贴代码或制品正文；细节写文件。`blockedGate` 用于门白名单内的门，`blockedReason` 用于非门类用户决策（范围蔓延、材料性歧义、方案选择）；两者均缺失时父级停止。**新增字段均为可选，MUST NOT 进入 `DEFAULT_RECEIPT_FIELDS`**；`validateReceipt` 仅在字段出现时校验其形状，保持 fail-safe。
  - **Token 预算**：Stage Envelope ≤ 2KB（不含子代理自行加载的技能正文）；Stage Receipt ≤ 40 行 / ≤ 2KB；`reportPath` 可指向完整复查 / 验证报告（放在 `attachments/` 或流程级工作区），`reviewSummary` ≤ 2KB；handoff 包每节 ≤ 120 行；包是**蒸馏视图而非制品副本**（细节以路径引用）；同一阶段只允许一个前台子代理（禁止后台 Agent）；需要独立复查的阶段可单独子代理，但 MUST 复用同一 handoff 包，不得各自重产。
  - **Staleness 与重建**：父级在委派前校验 `sourceFingerprint`；不一致 → 重建一次 + WARN；重建失败 → `incomplete`，MUST NOT 以陈旧包委派。验证阶段自动修复改动制品后，父级 MUST 按新指纹**重建 handoff 包一次**再进入实现。
  - **Blocked resume**：子代理遇到门白名单内的门 → `status=blocked` + `blockedGate`；遇到非门类用户决策 → `status=blocked` + `blockedReason`。父级呈现门/决策；门确认写入账本，非门决策写入 Envelope `userDecision`；随后以 `resume=true` 重新委派同一阶段；子代理据 handoff 包 / `tasks.md` 跳过已完成工作（幂等），MUST NOT 从头重做。
  - **并发**：阶段默认串行；需要独立复查的 `verify-proposal` 与 `proposal-review` 可各自子代理，但两者都必须先读同一 handoff 包；MUST NOT 为同一制品启动两个以上读取同一全量制品的并行子代理（除非显式说明独立性收益）。
- **理由**: 子代理上下文隔离意味着数据必须显式传递；若不设预算，每个阶段重复读制品、子代理回执膨胀，父级 context 与 token 成本会失控；blocked 无 resume 会导致重复实现或数据丢失。
- **备选**: 内联制品正文（token 高、易过期）；每个子代理自行重读全部制品（重复读）；后台 Agent（结果延后、破坏管线）；无 resume 直接重跑（重复工作、可能重复写入）。

#### 阶段数据共享矩阵

| 阶段 | 必需输入（Envelope / 文件） | 输出（Receipt / 文件） | 读取约束 |
| :--- | :--- | :--- | :--- |
| `explore`（inline） | topic、config/rules | exploration.md（基线 / 流程图 / Pending）、handoff 字段 | 与用户交互，保留门 |
| `propose` | exploration.md、config/rules、CONTEXT.md | proposal/design/specs/tasks、handoff 包 | 读 exploration；产包一次 |
| `verify-proposal` | 制品、handoff 包、rules | score / deep review / receipt | 先读包，再增量读制品 |
| `proposal-review` | 制品、handoff 包、rules | 复查报告 / receipt | 独立子代理，但复用同一包 |
| `apply` | handoff 包、tasks.md、specs/design、rules、compileCheck、门账本 | tasks 勾选、compile-report.md、receipts、confirmedGates | 先读包；按批增量读 |
| `test` | 变更范围、tasks、test rules、handoff 包 | 测试文件、运行结果 | 条件阶段；先读包 |
| `verify` | handoff 包、制品、compile-report.md | verification result / receipt | 只读；先读包 |
| `archive` | handoff 包、compile-report.md、变更目录、门账本 | archivePath、specsSynced、receipt | 只读包；只追加阶段结论 |

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 子代理无法加载技能（工具面 / 权限） | 优先 `Skill`，降级 `Read SKILL.md`；仍失败返回 `status=blocked`，父级暂停并报告 |
| 阶段分类错误（交互阶段被放入子代理） | `INTERACTIVE_STAGE_WORKFLOW_IDS` 单一源 + 生成期测试断言 `spec-explore` 渲染为 Skill |
| 续跑仍被模型中断 | Agent 提供真实结果边界；父模板加入返回边界续跑句；测试断言文本存在 |
| 门账本无真实确认却跳过设计门 | 仅 `flowBaselineConfirmed=true` 时写账本；未确认即暂停（fail-safe） |
| 需求文档状态移除破坏外部消费 | BREAKING 版本；历史 `需求文档.md` 与 `## 需求文档状态` 原样保留；独立技能保留 |
| 子代理上下文隔离导致缺信息 | 父级传递 change-name / exploration-file / handoff 包路径；子代理从磁盘读取制品，不依赖父级会话 |
| 大量测试断言同步遗漏 | 任务清单逐文件列出受影响测试；实现后运行全量 `pnpm test` |
| 快照 / 派生不一致 | 模板改动后必须 `pnpm build && pnpm generate:skills`；`skills-parity` 与派生测试兜底 |
| OpenCode / Pi / Codex 文本漂移 | 续跑契约在共享层渲染；各宿主分支仅在 `renderDelegate` 内差异，不做第二份模板 |
| auto-workflow 移除文档桥后无验证后用户门 | 验证分数与复查结论在报告中呈现；FAIL / 编译 / 测试失败仍暂停；门账本仅在流程基准 + 验证/复查均通过后写入 |
| `renderDelegate` 全局生效影响 migration / project-init | 将其自动阶段委派纳入回归断言；两者均复用同一 Agent / 续跑契约，行为一致 |
| 非门类阻塞（范围蔓延 / 歧义）导致死锁 | `blockedReason` + 父级用户决策 + `userDecision` + `resume=true`；既无 gate 也无 reason 才停止 |
| 验证自动修复后 handoff 包过期 | 父级在自动修复后按新指纹重建包一次；重建失败返回 `incomplete`，不进入实现 |
| 复查报告过大 | 回执只带 `reviewSummary`（≤2KB）+ `reportPath`；完整报告写文件 |
