## Why

debug 技能当前把「复现」当作唯一入口，确认面被拆成两次停点，且概览声明了一个正文并不存在的确认门 —— 三者叠加使「可验证」退化为「可复现才可处理」，并制造额外停顿：

- **强制复现没有第二入口**（`src/core/templates/workflows/debug.ts:203-226`；规范 `openspec/specs/workflow-suite-skills/spec.md:35` 与 `:56-59`）：无法建立失败测试复现时一律「向用户报告并停止」，零假设原则因此退化为「无法复现即无解」。生产日志已指向具体代码行、环境不可复现、间歇性缺陷这三类场景都没有出口 —— 而它们的证据强度并不低于一次手工复现。
- **诊断门与方案门两次停点**（2.4 `debug.ts:278-307`、4.0 `debug.ts:350-356`）：同一次逻辑诊断被拆成「确认根因」与「确认方案」两次停点；Phase 3 变更归属判定（`debug.ts:310-343`）又夹在两者之间，用户确认诊断后仍要再等一次停点才能给方案。
- **概览声明了正文没有的门**：概览第 5 条写作「每次修复后询问用户是否还有相关 bug」（`debug.ts:136`），正文没有任何对应步骤（N35 落差）—— 模型为兑现概览而自行补一个确认门，产生非预期停顿。
- **规范与新语义直接冲突**：`spec.md:56-59` 把「无法复现 → 不修复」写成硬约束；不 MODIFY 该 Requirement 与场景，双轨入口无法落地（U9）。

## What Changes

- **Phase 1 引入双轨入口（D7）**：新增复现契约 —— `reproductionStatus`（`reproduced` / `not-reproduced` / `intermittent` / `static-only`）与 `evidenceType`（`failing-test` / `manual-steps` / `log-trace` / `static-proof` / `review-finding`），写入诊断记录并在 Phase 6 持久化。
  - **复现优先仍是默认轨道**，地位不下调；证据优先轨道**仅在无复现条件时**启用。
  - **证据门槛**：证据优先轨道 MUST 有 `文件:行` 证据或日志 / 测试证据；`not-reproduced` / `static-only` 一律须过硬门槛；`intermittent` 须至少一条可重复证据（日志 / 测试 / 静态证明）。
  - **无可建立回归测试的证据 → 只报告候选，不修复**（零假设原则保留，不再「一律停止」）。
  - **U3（默认轨道判定）**：由缺陷五维的「复现步骤 Repro」维判定结果与 `reproductionStatus` **联合**判定；两者冲突或无法判定时**默认复现优先**。
- **2.4 诊断门与 4.0 方案门合并为「诊断 + 方案」包（D6 debug 部分 / U7）**：单一确认包内呈现「根因证据 + 缺陷链路图 + 修复方案（唯一方案说明唯一性证据；多方案给出候选与建议）」；方案随包确认，不再单独停一次。
  - **Phase 3 变更归属前移**到 2.4 之前，使 `changeName` 与 `affectedSymbols` 与诊断同批交付。
  - **回退路径**：若变更归属依赖根因之外的上下文（多变更候选、归档来源追溯、范围待定）→ 退回「2.4 诊断门 + 4.0 条件门」两次停点，但 4.0 **仅在多方案时触发**（唯一方案仍直通）。
  - **概览自造门处理**：`debug.ts:136` 的「每次修复后询问」降级为**非阻塞提示**并在正文显式声明「不构成确认门」，MUST NOT 作为停点。
- **规范同步（U9）**：`specs/workflow-suite-skills/spec.md` 以 MODIFY 更新两条 Requirement ——「debug 强制复现与根因确认门」（主规范 `:35`，含其「无法复现时不修复」场景 `:56-59`）与「debug 修复方案确认与回归测试职责」（主规范 `:736`，4.0 语义与回归测试口径的所在处）；前者保留复现优先默认轨道与零假设原则、新增 `not-reproduced` / `static-only` 证据门槛并改写原场景，后者把方案评估前移到 2.4 合并包并补 characterization test 口径。`specs/host-orchestration/spec.md` 以 MODIFY 更新「debug host protocol 拆分 fix 与 verify-close」（主规范 `:244-248`）—— `investigate` handoff 增补 `fixDecision`。
- **协议声明对齐，门预算不变**：`GATE_WHITELIST` 仍为 5 类、锚点集合逐字不变（`diagnostic-confirmation` / `fix-option-confirmation` 仍挂在 `requirement-clarification` 类别）；每阶段至多 1 个阻塞门；`DEBUG_FIX.gate`（`fix-option-confirmation` + `condition: multiple-fix-options`）保留为回退路径条件门。

## Capabilities

### New Capabilities

- 无（本变更全部为既有技能的入口契约与确认面调整）

### Modified Capabilities

- `workflow-suite-skills`: MODIFY「debug 强制复现与根因确认门」——保留复现优先默认轨道与零假设原则，新增证据优先轨道与 `not-reproduced` / `static-only` 证据门槛、「诊断 + 方案」单次确认包、Phase 3 归属前移与自造门降级；MODIFY 其「无法复现时不修复」场景为「无证据不修复」。MODIFY「debug 修复方案确认与回归测试职责」——方案评估前移到合并包内、回退路径改为 4.0 仅多方案触发、回归测试口径补 characterization test。
- `host-orchestration`: MODIFY「debug host protocol 拆分 fix 与 verify-close」——`investigate` 的 handoff 增补 `fixDecision`（合并包在 investigate 内产出修复方案决策），并声明「合并确认面不改变 5 类门白名单、锚点集合与每阶段 1 个阻塞门预算」。

## Impact

### 直接影响的文件

- `src/core/templates/workflows/debug.ts`: Phase 1（`:203-226`）双轨入口与复现契约；2.4（`:278-307`）合并为「诊断 + 方案」包；Phase 3（`:310-343`）前移至 2.4 之前；4.0（`:350-356`）降级为回退路径条件门；概览第 5 条（`:136`）自造门降级为非阻塞提示；4.2（`:377-393`）回归测试口径增加 characterization test；Guardrails（`:527-557`）同步零假设与证据门槛表述。
- `openspec/specs/workflow-suite-skills/spec.md`: `:35` Requirement、`:56-59` 场景与 `:736` Requirement（MODIFY，delta 见 `specs/workflow-suite-skills/spec.md`）。
- `openspec/specs/host-orchestration/spec.md`: `:244-248` Requirement（MODIFY，delta 见 `specs/host-orchestration/spec.md`）。
- `src/core/host-orchestration/workflows.ts`: `DEBUG_INVESTIGATE.handoff`（`:128-136`）增补 `fixDecision`，注释记录「诊断 + 方案」合并包语义；`DEBUG_FIX` 门声明（`:139-147`）保持不变。
- `src/core/host-orchestration/protocol.ts`: **不改**（`GATE_WHITELIST` 5 类 `:94-131` 与 `GATE_WHITELIST_ANCHORS` `:134-136`、`PHASE_GATE_CATEGORY` 逐字不变）—— 作为不变量由测试断言守护。
- `test/templates.test.ts`: debug 正文断言同步 —— 既有「在修改任何代码之前必须复现该 bug」「MUST NOT 在假设下修复一个不可复现的 bug」等断言按双轨语义改写；新增双轨契约、门合并、自造门降级断言；保留 `| 异常路径 |` 不得出现、`功能流程图` 与 `🟠根因` 必须出现的流程图文案断言。
- `test/host-orchestration.test.ts`: `investigate.handoff` 含 `fixDecision`、`fix` 阶段门 id / condition 不变的对齐断言。
- `skills/iagent-debug/**`: 快照重建（`pnpm build && pnpm generate:skills`，含 `SKILL.md`、指令版与 `references/*.md`）。

### 调用方（CodeGraph 实测）

- `getDebugSkillTemplate`（`src/core/templates/workflows/debug.ts:122`）：注册表 `src/core/templates/registry.ts` 消费；`getDebugCommandTemplate`（`:572`）经 `deriveCommandContent` 派生指令版，两者同源，改正文即同时生效。
- `DEBUG_INVESTIGATE` / `DEBUG_FIX`（`src/core/host-orchestration/workflows.ts:128` / `:139`）：各 1 个调用方（`WORKFLOW_PROTOCOLS.debug`，`:196-199`）；经 `getWorkflowProtocol` / `index.ts` 导出；测试 `test/host-orchestration.test.ts:306-330`。
- `GATE_WHITELIST`（`src/core/host-orchestration/protocol.ts:94`）：10 个调用方，含 `prompt-gate.ts`、`transition.ts`、`workflows.ts`（`auditGateWhitelistAlignment`）、`index.ts`；测试 `test/host-orchestration.test.ts`、`test/templates.test.ts`。
- `PHASE_GATE_CATEGORY`（`workflows.ts:219`）：4 个调用方（`index.ts`、`transition.ts`、`workflows.ts` 自身）；测试 `test/host-orchestration.test.ts:626-630`。
- `auditGateWhitelistAlignment`（`workflows.ts:233`）：2 个调用方（`index.ts`）；测试 `test/host-orchestration.test.ts`。

### 向后兼容

- **不移除任何确认门**：只合并确认面。`diagnostic-confirmation` / `fix-option-confirmation` 锚点保留在 `requirement-clarification` 类别；回退路径下两次停点头与既有行为一致。
- **复现优先轨道行为不变**：可复现缺陷的诊断、修复、回归测试与验收步骤逐条保留；变化只发生在「无复现条件」与「确认包内容」两处。
- **协议形状不变**：`GateSpec`、`condition` 语义与 `evaluatePhaseTransition` 判定逻辑不改；`DEBUG_INVESTIGATE.handoff` 仅**追加**字段，既有消费方读取旧字段不受影响。
- **零假设原则保留**：证据不足时仍然不修复，只把出口从「一律停止」扩展为「报告候选」。
- **无破坏性变更**（不需要 **BREAKING** 标注）；规划边界：本变更只提案，不实现。
