## Context

本设计以变更目录中的 `exploration.md`（其 Mermaid 与 N1–N47 节点表已由用户确认）为流程锚点，不重新设计业务流程。当前工作流模板在验证 PASS + proposal-review 后自动生成需求文档；debug 又禁止同一动作，archive 则在缺文档时兼容生成。验证阶段的 `requirementDoc` handoff 未穿过 apply 到 archive。debug host protocol 目前将 `fix-verify` 合为一阶段，无法表达多方案时阻塞、单一证据充分方案直通的条件。

CodeGraph 调用/影响链：

- 模板入口 `getWorkflowSkillTemplate` / `VERIFICATION_PROTOCOL_FULL`、`getAutoWorkflowSkillTemplate`、`getDebugSkillTemplate`、`getSpecVerifyProposalSkillTemplate`、`getRequirementDocSkillTemplate`、`getSpecArchiveChangeSkillTemplate` 由 `src/core/templates/registry.ts` 注册及派生 command；回归覆盖 `test/template-derivation.test.ts`、`test/templates.test.ts`、`test/template-consistency.test.ts`。
- 宿主协议由 `src/core/host-orchestration/workflows.ts` 的 `WORKFLOW_PROTOCOLS`、`PhaseSpec` / `GateSpec` 和 `evaluatePhaseTransition` 驱动；`render.ts` 的 `ORCHESTRATION_DELEGATIONS` 与 `iagentPermissionRules` 决定宿主委派资源。主要回归为 `test/host-orchestration.test.ts`、`test/claude-host-adapter.test.ts`、`test/opencode-v2.test.ts`。
- 技能授权经 `skillDelegation` 生成；真实委派需和 `allowedTools`、host delegation、OpenCode V2 权限同步。主要回归为 `test/tool-whitelist-constants.test.ts` 与 `test/allowed-tools.test.ts`。
- 改模板后生成的 `skills/` 快照须运行 `pnpm build && pnpm generate:skills` 同步。本变更只规划，不修改模板、应用代码、测试或快照。

### 测试职责冲突核对

`debug.ts` 的 Phase 4.2 正文要求 debug 内联检测框架并编写测试（约 345–363 行），末尾 Guardrails 又要求委派 `iagent_test`（约 568–570 行），而现有 debug `allowedTools` 未包含 `test`。这里采用**最小一致方案：委派 `iagent_test` 生成回归测试**，debug 仅提供缺陷链路、测试前置失败证据，并检查修复前 FAIL、修复后 PASS 与异常/根因节点覆盖。依据是既有 `workflow-suite-skills` 与 `spec-workflow-skills/explorations.md` 中已归档的测试能力决策：`iagent_test` 是测试规则唯一来源，debug 通过委派消费；不改变“每个修复必须有强制回归测试”的已确认语义。strict 缺少委派能力时遵守宿主阻断；仅宿主明确协商 degraded 后才允许透明降级，不伪装 strict 委派。

## Goals / Non-Goals

**Goals**:

- 在 workflow / auto-workflow / debug 的验证与深度复查之后，由父编排器承载需求文档生成/跳过桥；保持 verifier 为独立只读验证器。
- 持久化四值状态 `absent` / `skipped-by-user` / `generation-failed` / `generated`，让 archive 在跨会话调用时遵守同一决定；写入与读取失败固定重试一次后停止；继续保留已有文档增量对齐和历史无状态兼容生成。
- 对 debug 落实已确认的根因/缺陷链路确认顺序、条件修复方案门与 `fix` / `verify-close` host phase split，同时保留单一 debug SKILL。
- 将“入口意图/明确确认授权的下一技能”与宿主工具权限分离；去掉重复的业务调用确认，不绕过权限、strict/degraded 或其他业务门。
- 保持 workflow / auto-workflow / debug 的实际调用目标、模板白名单、host delegation、V2 permissions、测试与生成快照一致。

**Non-Goals**:

- 不改变 `iagent_spec_verify_proposal` 的评分与只读职责，不让它生成或询问需求文档。
- 不改变需求文档技能的 standalone 收集行为、八章节格式或已有目标文件静默覆盖原语；调用方仍负责保护人工域。
- `iagent_spec_propose` 独立调用不再自动生成需求文档（非目标）；桥仅属 workflow / auto-workflow / debug。
- 不新增 SKILL、不拆分 `iagent_debug` 为多个用户可调用技能、不更改模板注册结构或测试生成技能规则。
- 不新增 per-workflow strict 降级判定：Pi 的嵌套缺口仅以 `nestingGaps` 诊断 + WARN + 正文禁止伪装呈现。
- 本阶段不执行 Phase 3 验证、实现或归档。

## Decisions

### D1: 文档桥归父编排器，位于 PASS 与深度复查之后

- **选择**：workflow / auto-workflow / debug 在各自提案验证 PASS 且 proposal-review 深度复查收束后提供一次“生成 / 跳过”选择。确认生成后直接委派非交互 `iagent_requirement_doc`；跳过后持久记录状态并继续父流程。独立 `iagent_spec_verify_proposal` 不承载文档行为。
- **理由**：保持验证技能职责单一；将文档生成放在业务编排层，明确 auto-workflow 的用户桥不等同于额外的“是否调用技能”确认。
- **备选**：在 verifier 或 archive 决定是否生成。前者违反独立验证职责；后者会覆盖父流程已确认的 skip / generation-failed 决定。

### D2: 持久记录为四值状态模型，写入/读取均"重试一次后停止"

- **选择**：在变更 `exploration.md` 的 `## 需求文档状态` 段以 `requirementDocStatus` 持久记录 `skipped-by-user` / `generation-failed` / `generated` 三态；无该段为 `absent`（不落盘）。`generated` 为终态，使"曾生成但归档前文件被删除"可与"用户跳过"区分（`generated` + 缺失 → WARN 不重建）。archive 以**文件存在优先**（任何状态都走就地对齐）、缺失时按 `skipped-by-user` / `generation-failed` / `generated` / `absent` 四支分流，`absent` 保持历史兼容生成。叶技能 `iagent_requirement_doc` MUST NOT 写改该状态。
- **I/O 语义（已裁决）**：写入与读取均为"失败 → 自动重试同一操作一次 → 仍失败即停止"，MUST NOT 有第二次或无限重试。写入仍失败：不报已持久化、不委派生成、不进入依赖该状态的下一阶段、WARN + 恢复指引。读取仍失败：不得等同 `absent`、不得自动生成；文档存在时仍按已存在分支对齐，且不改变归档不阻断契约。
- **理由**：跨会话需要可靠来源；skip / 生成失败 / 已生成后丢失必须分别抑制 archive 补生成；`generated` 终态使"删除"分支可判定。
- **备选**：只在对话或 receipt 中保存状态，不能支持稍后独立 archive；成功只以文件存在为证据则无法区分"生成后删除"与"用户跳过"；在 archive 一律生成会抵消 skip；让 requirement-doc 自己合并人工区域会扩展叶技能职责并触发静默覆盖风险。

### D3: archive 状态分支以持久决定为准，已有文件始终优先对齐

- **选择**：archive 读取 change `exploration.md` 与需求文档文件。文件存在时，不调用生成器，始终按既有规则增量对齐 `一~七` 并原样保留 `## 基本信息` / `## 八、评审记录`（不区分状态）；文件缺失且 `skipped-by-user` 时跳过生成；`generation-failed` 时 WARN 并不重试；`generated` 时 WARN（曾生成但文件缺失）并不重建；`absent` 时维持既有兼容生成。状态或文件存在性读取 I/O 失败：重试一次，仍失败不得等同 `absent`、不得生成，WARN + 恢复指引并继续归档。bulk-archive 的 a.6 采用完全相同的语义。
- **理由**：与已裁决的四种结果（skip、已有文件、生成失败/已生成后丢失、历史兼容）一一对应；持久决策可覆盖跨会话缺失的回执。
- **备选**：用会话回执作为唯一来源，会在单独 archive 时丢失状态；状态无论何值都走旧生成会破坏 skip / 不重试 / 不重建语义。

### D4: debug 保持一个 SKILL，host protocol 拆成 investigate / fix / verify-close

- **选择**：保留 `iagent_debug` 作为唯一调试编排入口；host phase 序列为 `investigate` → `fix` → `verify-close`。`investigate` 对高置信单根因将证据与链路放在一次诊断确认包内；多候选先选根因，再在同一逻辑诊断门内确认据此生成的链路；**拒绝该确认包 = 终止修复并输出诊断报告**（不自动按推断继续、不标记可归档）。`investigate` handoff 增补 `changeName` / `defectChain`（`fix` 的必需输入，`changeName` 由变更归属判定在 investigate 收束时产生）。`fix` 承载方案判定、必要的用户方案确认、精准修复和 `iagent_test` 委派；`verify-close` 汇总编译、Markdown 同步、提案验证、深度复查与需求文档桥。
- **理由**：满足用户指定阶段拆分，同时不把 debug 拆成多个对外技能；分离修复回执与验证收束结果，降低宿主阶段契约的歧义。
- **备选**：保留 `fix-verify` 单阶段无法准确承载阶段 handoff；新建独立测试/验证 SKILL 会改变单一全流程技能语义。

### D5: 修复方案门必须条件化，保护唯一方案直通

- **选择**：多个可行修复方案时展示方案、影响和建议并等待选择；证据不足时按多方案处理。只有一个明确可行方案且项目约束与代码证据说明唯一性时，说明依据后直接实施。数据库/schema 的既有单独确认继续有效。
- **条件门（已确认）**：`GateSpec` 增加可选 `condition?: 'multiple-fix-options'`（等价字符串常量按既有风格）；`PhaseTransitionInput` 增加可选 `gateConditions?: Record<string, boolean>`。`evaluatePhaseTransition` 判定规则：门的 `condition` 未设置 → 保持现有静态门行为（`blocking ?? true` + `gateConfirmed`）；已设置 → `gateConditions[condition] === false` 视为该门不适用并跳过门确认要求，`=== true` 或该键未提供视为适用（**fail-safe**，仍按 `gateConfirmed` 要求确认）。`debug` 的 `fix` 阶段门绑定 `'multiple-fix-options'`：存在多个可行修复方案置 `true`，唯一且证据充分方案置 `false`。Claude / OpenCode V2 / Pi 适配器共享同一判定语义；任何既有未声明 `condition` 的门行为 MUST NOT 改变。
- **理由**：静态必经门会错误阻止唯一方案直通；完全删门又会让多方案未确认时实现。
- **备选**：每个方案都要求确认违反已确认的唯一方案路径；固定门恒通过则不能阻止多方案误实现。

### D6: 回归测试通过 `iagent_test` 生成，debug 验收缺陷专属口径

- **选择**：删除 debug 与 `iagent_test` 重复的内联框架/风格/生成规则，改为委派测试生成；debug 提供确认的缺陷链路和失败复现上下文，并验收每个修复都有修复前失败、修复后通过的测试，覆盖异常节点与根因节点。Phase 1 MAY 以内联临时测试建立失败证据，但该测试不构成回归测试：正式回归测试必须由 `iagent_test` 生成或改造落库，MUST NOT 以 Phase 1 临时测试充当唯一回归测试。严格模式能力缺失按 host protocol 阻断（MUST NOT 以"自写 + WARN"绕过）；显式 degraded 的限制与实际本地行为必须透明报告。
- **理由**：当前正文要求内联编写与 Guardrails 要求委派相互冲突；能力规格和归档的测试生成决策已选定 `iagent_test` 为唯一测试规则源。此方案只调整职责归属，不削弱强制回归测试的用户确认语义。
- **备选**：继续内联生成会延续已知矛盾并复制测试规则；无权限时静默本地编写会绕过 strict/degraded 与工具权限边界。

### D7: 已授权的当前下一技能直接调用，不授予后续动作

- **选择**：父工作流入口意图可直接授权其契约指定的首个技能；明确业务门只授权回执中唯一 `nextAllowed` 的当前技能及参数。调用前仍检查宿主权限与阶段能力；后续不同业务副作用仍按原门处理。
- **理由**：消除同一推进上的重复业务确认，同时保持工具权限审批和其他业务门边界。
- **备选**：重复询问是否调用技能会保留原体验问题；把业务确认当作全局权限会越权。

### D8: 同步模板派生、宿主授权、测试与交付产物

- **选择**：修改 workflow / auto-workflow / debug 与 archive 模板时同步真实调用清单、协议阶段/回执/门、`ORCHESTRATION_DELEGATIONS`、`DEPS`（`profiles.ts`）、Pi 阶段 agent 的 `allowed_subagents`、OpenCode V2 permissions 与测试断言。模板变更后按项目规定重建 `skills/`；功能行为变更按 AGENTS 规则同步 minor 版本号与 changelog。
- **理由**：这些产物是同一行为契约的不同宿主/生成视图，任何一处漏改会造成权限阻断、漂移或虚报阶段完成。
- **备选**：仅改 SKILL 正文不能满足 native host orchestration 或生成快照的一致性。

### D9: `iagent_spec_propose` 独立调用不提供文档桥（非目标）

- **选择**：`iagent_spec_propose` 独立（interactive）调用在验证 PASS 后**停止**，不再自动生成需求文档；保留用户手工调用 `iagent_requirement_doc`。三父流程（workflow / auto-workflow / debug）是唯一自动调用方（生成分支）+ archive 的 `absent` 兼容分支。
- **理由**：文档桥的确认面仅覆盖三父流程；propose 的规划边界本就是"到此为止等用户新请求"，自动生成文档属越界副作用，且无桥即无状态，无法与 archive 的状态分流对齐。
- **影响**：`spec-propose.ts` 删除生成调用与 `Skill(requirement_doc)` 条目；`template-generation` 的调用方 Requirement 按调用方枚举化；`command-reference-refs` 的条件委派表同步移除该条目。

### D10: Pi 阶段 agent 的嵌套委派按委派清单授予并报告缺口

- **选择**：`renderPiStageAgent` 为编排类阶段 agent 生成 `allowed_subagents`（= 该 workflow 的委派清单 ∩ 已安装 stages，前缀 `iagent-`）；声明但未安装的目标记入 `nestingGaps` 并 WARN。缺口按委派性质区分：**无条件必需委派**缺口 → 按能力阻断；**条件委派**（正文已声明 fallback / degraded 路径，如 `debug → proposal-review` 的内联复查、`debug → test` 的显式 degraded 本地编写）缺口 → 按该降级路径执行并记 WARN，`test` 仅显式协商 degraded 时允许本地编写，MUST NOT 被一律阻断；两类均 MUST NOT 本地伪装为 strict 委派完成。非编排阶段 agent 不生成该字段。不新增 per-workflow strict 降级（strict 仍由 host 级能力协商决定）。
- **理由**：既有 `host-orchestration / Pi native delegation entries` 规定"嵌套委派工具 MUST 由 `allowed_subagents` 授予"；不生成则 Pi 下 debug 的文档/测试委派不可用，且不能声称严格可用。

## Risks / Trade-offs

### 执行分层与副作用边界（引用已确认节点）

以下四组用于对应 tasks.md 的执行顺序，不新增或改写 exploration.md 的流程节点：

1. workflow / auto-workflow 从提案生成、验证与需求文档桥到 apply/verify/archive：N4–N20。
2. archive 对需求文档状态与文件存在性的预归档分流：N42–N47。
3. debug 从输入校验、复现、分层排查到修复和回归测试：N21–N32。
4. debug 相关 bug 循环、验证/复查、需求文档桥与收束：N33–N41。

适用执行层为技能模板层、宿主协议/回执层、exploration.md 状态层、archive 流程层、权限层与测试/生成层；本变更不涉及前端或 API 层。

**事务边界：** 本变更不新增数据库操作或数据库事务契约。需求文档状态写入、技能委派、文档产出、阶段回执与后续 archive 是不同阶段的操作，不应描述为一个原子事务。状态写入采用"失败自动重试一次后停止"，仍失败不得伪报已持久化或进入依赖阶段；恢复方法以 WARN 中的恢复指引承担。archive 的需求文档检查点位于目录移动之前，文档检查/生成/对齐失败按规格输出 WARN 并继续归档。debug 若涉及具体数据库/schema 修复，仍保留既有独立确认；本变更不定义其提交或回滚语义。

| 风险 | 缓解 |
|------|------|
| 探索文件状态与阶段回执不一致或持久化失败，archive 可能误走兼容生成 | 探索文件记录为跨会话依据，receipt 作为 handoff 镜像；写入/读取失败固定重试一次，仍失败时写入侧停止依赖阶段、读取侧不落 `absent` 且不生成、WARN + 恢复指引。 |
| `GateSpec` 当前只有静态门，简单加固定修复门会阻塞单一可行方案 | 采用已确认的 `GateSpec.condition` + `PhaseTransitionInput.gateConditions`：未声明 `condition` 的旧门保持静态行为；条件为 `false` 时门不适用，为 `true` 或未提供时按 `gateConfirmed` 要求确认（fail-safe）。因此单一可行方案不阻塞、多方案未确认仍阻断。 |
| debug 旧正文与 Guardrails、能力规格在测试职责上冲突 | 按既有 `iagent_test` 唯一规则源决策统一为委派；debug 只验证缺陷链路和 fail-before/pass-after；Phase 1 临时测试不构成回归测试；strict 缺能阻断而非自写。 |
| debug 新增需求文档/测试委派后任一宿主授权不全 | 同步 `allowedTools`、`ORCHESTRATION_DELEGATIONS`、`DEPS`、OpenCode V2 permissions 与 Pi `allowed_subagents`；使用精确技能条目并执行三套适配器测试。 |
| `debug` 无条件委派 `requirement-doc` 但未随装 | `DEPS.debug` 补 `requirement-doc`（`skill-profile` 能力规格同步），避免指向未安装技能的死引用。 |
| 将“直接调用”误读为跳过工具审批或另一个业务门 | 只对当前唯一 `nextAllowed` 技能生效；strict/degraded、宿主权限、receipt 与其他 gate 仍是推进条件。 |
| `iagent_requirement_doc` 对已有文件静默覆盖 | archive 对所有已有文件走增量对齐，不调用生成器，并保护两个人工章节。 |

### 技术细节（不改变已确认业务语义）

- 已成功生成的文档在 archive 前被删除时：状态为 `generated` + 缺失 → WARN 并继续归档，**不重新生成**（已裁决；见 D2 / D3）。
