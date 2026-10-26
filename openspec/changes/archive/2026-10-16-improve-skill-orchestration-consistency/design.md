## Context

本次审计覆盖 20 个技能模板、9 个 CLI 命令与 `spec` 子命令组、以及 6 类跨切面机制（`derive-command` / `GATE_PROTOCOL_PREAMBLE` / `prompt-gate` / `flowchart-gate` / `tool-whitelist` / `DEPS`）。审计记录与逐条证据见 `openspec/explorations/skill-orchestration-audit-explore-001.md`。

现状根因有三层：

1. **重构只做了一半**：6.0.0 与在飞的 `refactor-orchestrator-*` 系列把 Phase 1/2 从内联改为委派，但 Phase 4/5、Examples、Guardrails 未同步，留下"委派声明 + inline 指令"并存的矛盾正文。
2. **单一源机制未全覆盖**：`deriveCommandContent` 仅覆盖 8/20；`GATE_PROTOCOL_PREAMBLE` 仅 3/6；references 机制产生了孤儿文件。
3. **回归锁过窄**：`markdown-first-regression.test.ts` 只扫 4 个编排技能、只匹配少数正则，`migration` / `spec_explore` 的 JSON 残留漏网。

同时发现**共享制品状态**：`markdown-first-artifacts`（39/39 完成、未归档）已覆盖大部分 Markdown-first 规格修正，但未覆盖上述模板残留与主 spec 中残留的 JSON-first requirement。本变更需与其协调次序，避免重复与冲突。

## Goals / Non-Goals

**Goals**:
- 消除"正文自相矛盾 / 白名单与委派不一致"类执行歧义。
- 把跨切面不变量（单一源、Markdown-first 无残留、白名单/DEPS 齐备、验证契约唯一）变为可测试回归锁。
- 修正 DEPS、补全表、文档与 description 的结构性漂移。

**Non-Goals**:
- 不新增技能、不新增 CLI 命令、不改技能类型体系。
- 不改确认门的语义与数量（除双门去重的职责澄清）。
- 不重写 spec_explore 的 874 行探索协议（体量优化 F-18/F-19 留作后续独立变更）。
- 不实现 `markdown-first-artifacts` 已覆盖的部分（由其归档承接）。

## Decisions

### D1: auto-workflow 的 apply/archive 改为委派

- **选择**: Phase 4/5 经 Skill 委派 `iagent_spec_apply`（`auto-mode=true`）与 `iagent_spec_archive`（`change-name`），条件委派 `iagent_test`；白名单补 `Skill(spec_apply/spec_archive/test)`，DEPS 同步。
- **理由**: 与 6.0.0「Phase 1/2 委派」方向一致；消除 apply/archive 协议第二真源；`auto-mode` 语义已存在（仅跳设计门）。
- **备选**: 保留内联、删除虚假单一源声明。否决——协议仍将重复维护，且白名单缺口无法解释。

### D2: 提案验证维度契约唯一源置于 `iagent_spec_verify_proposal`

- **选择**: D1-D5 核心 + D6-D10 条件（统一 90%）唯一定义于 `spec_verify_proposal`；其它技能只引用。
- **理由**: 该技能本就承载评分门与 `references/conditional-dimensions.md`；单点即可被测试断言。
- **备选**: 抽出独立常量模块。否决——维度是自然语言评分口径，放入模板正文更可读，测试断言"唯一契约串"即可。

### D3: `proposal_review` 定位为深度层

- **选择**: `proposal_review` = `spec_verify_proposal` PASS 后的非重叠深度一致性 / 覆盖度复查，不重复 D1-DN 评分。
- **理由**: 消除双门重复打分与矛盾结论；保留其"8 维度深查 + 合规验证"的增量价值。
- **备选**: 合并两技能。否决——深度复查的探索成本高，应按 PASS 条件触发，不宜合并进评分门。

### D4: 复用既有单一源机制，不引入新机制

- **选择**: 门控导言统一走 `GATE_PROTOCOL_PREAMBLE`；指令派生扩大 `deriveCommandContent` 覆盖（用 `CMD:SKIP` 标记）；白名单继续走 `tool-whitelist.ts`。
- **理由**: AGENTS.md 已确立这些机制；新增机制会制造第三份真源。
- **备选**: 为指令版另建模板。否决。

### D5: 回归锁以"不变量 + 白名单"设计

- **选择**: 新增 `test/template-consistency.test.ts`（暂名），断言：① 全模板 `tasks.json/change.json` 写动词残留（legacy 只读白名单）；② `GATE PROTOCOL — ACTIVE` 字面量仅存于常量；③ references 无孤儿；④ `Skill(...)` 无幽灵条目且无条件委派被 DEPS 覆盖；⑤ 提案验证维度表述唯一；⑥ `spec` 补全子命令与 Commander 程序一致。
- **理由**: 把审计发现固化为可回归契约，防同类漂移。
- **备选**: 仅在评审记录中约定。否决——约定不可回归。

### D6: 与在飞变更的次序

- **选择**: 建议 `markdown-first-artifacts` 先归档，再实现本变更；本变更 Markdown-first 规格以补充契约（residual scan）为主，避免重写其 delta。
- **理由**: 避免两变更对 `spec-workflow-skills` 的 MODIFIED 冲突。
- **备选**: 合并进 markdown-first-artifacts。否决——审计范围远超 Markdown-first。

### D7: 验证桥接采用"显式声明或执行"二选一

- **选择**: workflow/auto-workflow 在 apply→archive 之间委派 `spec_verify`，或在归档桥就绪检查中显式声明省略理由并记录决策。
- **理由**: 与 `DEPS`（archive ⇒ verify）一致；同时不强行增加一个可能冗余的运行时步骤。
- **备选**: 强制委派。否决——可能与企业实际验证成本冲突，留可配置表述。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| auto-workflow 改委派后行为回归（批次调度 / 失败处置细节丢失） | 保留对 `spec_apply` 协议的单点引用；实现后以结构指标测试锁定继承声明 |
| 与在飞 `refactor-orchestrator-*` / `markdown-first-artifacts` 的 DEPS / spec delta 冲突 | D6 次序建议；DEPS 以 ADDED 不变量方式补充，减少对共享 requirement 文本的重写 |
| 回归锁误报（legacy 只读语义、示例性 JSON 提及） | 白名单限定 + 只匹配写动词；先以告警模式跑一轮再转硬断言 |
| description 补齐触发词导致长度膨胀 | 保持 ≤1024 硬上限与 ≥800 软告警；只补关键词不堆砌 |
| 扩大 `deriveCommandContent` 覆盖时 CMD:SKIP 标记遗漏 | fail-safe 设计（漏标只会让 command 更长）；以既有 `derive-command.test.ts` 与派生一致性测试守护 |
