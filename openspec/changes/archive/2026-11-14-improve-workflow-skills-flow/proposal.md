## Why

用户对三个父编排技能（`iagent_workflow` / `iagent_auto_workflow` / `iagent_debug`）的「实现 → 测试 → 审查 → 归档」链路提出三点优化诉求（原始输入，2026-11-13）：

1. **实现后没有调用测试**：现状存在降级/不可用路径的静默跳过——`testGate.autoGenerate=false` 直跳、`iagent_test` 不可用时仅 WARN 继续（`spec-apply.ts:489`；auto-workflow §4.3 同口径），且该口径与「该不该测闸门」的留痕原则不一致，用户无法区分「没调用」与「没评估过」。
2. **实现后缺 review 环节**：三技能实现后链路一致缺失 `iagent_review`（代码级审查）——现有 `spec_verify`（一致性验证）与 `proposal_review`（提案复查）都不是代码审查，功能实现完整度无人检查。
3. **归档无确认门**：auto-workflow Phase 5 直接自动归档（技能正文 §5.1「无额外用户确认」），与其自身门白名单声明「归档桥 archive-confirmation（不可豁免）」自相矛盾；用户需要暂停等确认后再结束。

探索阶段（`exploration.md`，流程图 N1-N10 已确认）已将三点诉求收束为 9 项决策 D1-D9 与 6 个边界场景 B-1~B-6，并同步 `openspec/CONTEXT.md` 三个新术语（实现后测试调用 / 实现后 review 环节 / 归档确认门）。

## What Changes

三技能统一「实现后链路」口径（Option B：显式强制子阶段，收紧降级路径；决策依据见 `exploration.md` Decision Process）：

- **实现后测试调用强制化**（D1/D4/D9）：实现完成后调用 `iagent-test` 为显式强制子阶段；`iagent_test` 不可用 → strict 阻断并报告（MUST NOT 表述为「已测试」）；`testGate.autoGenerate=false`（项目配置显式关闭）→ 显式 degraded 留痕 + WARN，不阻断；无可测文件 → 不测清单留痕 + `not-applicable` 放行。同步收紧 `iagent_spec_apply` Step 8.11 的「WARN 继续」旧口径。
- **实现后 review 环节**（D2/D5/D7）：实现验证桥（`spec_verify` 一致性）通过后、归档门之前插入 `iagent_review` 代码审查；review 报告落盘并纳入归档就绪检查；P0/P1 回实现修复循环（共用既有 ≤3 预算），P2 记录不阻断；未收束 MUST NOT 进入归档门；无代码改动 → `not-applicable` 留痕直通。三模板 `skillDelegation([...])` 清单同步追加 review 委派条目。
- **归档确认门（仅 auto-workflow）**（D3/D6/D8）：Phase 5 在自动归档执行前插入 ⛔ GATE——呈现「实现摘要 + 三类证据（compile/test/conformance）+ 测试结果」，等待用户确认功能完成后再归档；语义复用 `iagent_workflow` 5.1 门蓝本；拒绝 = 返回实现阶段（不归档），不提供「跳过归档」选项。`iagent_workflow` 既有 5.1 门不动；`iagent_debug` 维持收束提示不加门（其流程不执行归档）。

**BREAKING**: 无（技能名 / 触发词 / 宿主技能 ID 不变；行为语义收紧不构成接口破坏）。

## Capabilities

### New Capabilities

- `workflow-implementation-chain`: 三父编排技能（workflow / auto-workflow / debug）统一的「实现 → 测试 → review → 归档」实现后链路语义——实现后测试调用强制口径、实现后 review 环节（位置 / 报告落盘 / 失败分级）、auto-workflow 归档确认门。

### Modified Capabilities

（无——`openspec/specs/` 当前为空，本变更首次建立该能力规格。）

## Impact

### 影响分析（Phase 2.0，CodeGraph blast radius）

| 符号 | 优先级 | 影响面 | 改动方式 |
| :--- | :--- | :--- | :--- |
| `getWorkflowSkillTemplate` (`src/core/templates/workflows/workflow.ts:133`) | HIGH | 5 callers（registry + 模板内部 command 派生）；tests: `test/stage-continuation.test.ts` | 仅改 instructions 字符串与 `skillDelegation([...])` 参数（追加 review），函数签名与返回结构不变 → 调用方零影响 |
| `getAutoWorkflowSkillTemplate` (`src/core/templates/workflows/auto-workflow.ts:16`) | HIGH | registry 调用；快照与装机产物派生 | 同上（description 微调 + §4.3 口径收紧 + Phase 5 门新增 + skillDelegation 追加 review） |
| `getDebugSkillTemplate` (`src/core/templates/workflows/debug.ts:204`) | HIGH | 6 callers（registry + 模板内部）；tests: `test/stage-continuation.test.ts` / `test/codegraph-protocol.test.ts` | 同上（测试口径统一 + review 环节插入 + skillDelegation 追加 review） |
| `renderGateWhitelistSection` (`src/core/templates/prompt-gate.ts:163`) | MEDIUM | 三模板门白名单段唯一源；`GATE_WHITELIST` 已含 `archive-confirmation` 类别 | 预期不修改；实现时核对归档门锚点 id 引用一致性 |
| `getTestSkillTemplate` (`src/core/templates/workflows/test.ts:713`) | MEDIUM | `iagent_test` 技能（「自动管线调用」条款 test.ts:729 已支持强制口径） | 预期不修改；仅核对其口径与三模板收紧后一致 |

### 直接影响的文件

- `src/core/templates/workflows/auto-workflow.ts`: description「全自动」表述微调（归档门语义如实呈现）；§4.3 `iagent_test` 不可用口径从「WARN 继续」收紧为「strict 阻断 / 显式 degraded」；Phase 5 新增归档确认门段（⛔ GATE + 拒绝出口 + 证据呈现）；`skillDelegation([...])` 追加 review；Guardrails 同步。
- `src/core/templates/workflows/workflow.ts`: `skillDelegation([...])` 追加 review 委派条目（既有 5.1 归档门不动，作为 auto-workflow 门语义蓝本）。
- `src/core/templates/workflows/debug.ts`: 修复后测试调用口径统一（strict 阻断 / 显式 degraded，与 D4/D9 一致）；验证收束阶段插入 review 环节（7.3 收束提示之前，维持收束不归档现状）；`skillDelegation([...])` 追加 review。
- `src/core/templates/workflows/spec-apply.ts`: Step 8.11（483-489 行）`iagent_test` 不可用口径从「WARN 继续」收紧为「strict 阻断 / 显式 degraded + 透明留痕」。
- `src/core/templates/tool-whitelist.ts`: review 委派条目经共享常量派生（如既有 `skillDelegation()` 已覆盖则零改动；禁逐模板手写白名单）。
- `skills/`（静态快照）: `pnpm build && pnpm generate:skills` 重新生成（模板改动的强制伴随步骤，`test/skills-parity.test.ts` 回归锁）。
- `openspec/CONTEXT.md`: 术语已于探索阶段同步（2026-11-13 增补节，3 术语），本变更不再改动。

### 向后兼容

无破坏性变更。生成产物（skills/ 快照、`.claude/` / `.opencode/` / `.pi/` 装机产物）随模板重建，宿主技能 ID 与指令 id 不变；行为收紧仅影响降级路径的表述与放行条件，交互式用法不受影响。
