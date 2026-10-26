## Context

- **模板层结构**：`src/core/templates/workflows/*.ts` 共 20 个模板，每个导出 `getXxxSkillTemplate()` 与 `getXxxCommandTemplate()`，由 `registry.ts` 的 `WORKFLOW_PAIRS` 成对注册；`getCommandTemplates()` 把指令的 `allowedTools` 单点回填为配对技能白名单（[registry.ts](src/core/templates/registry.ts)）。
- **引用现状**：模板正文中的指令引用是裸字符串（如 `/iagent:spec-apply`），无生成期校验。已实测两处断链（`commit.ts` 的 `/iagent:commit-change`、`review.ts` 的 `/iagent:review-code`），证据见 `src/core/legacy-migration.ts` 的旧名映射表。
- **白名单共享常量**：`src/core/templates/tool-whitelist.ts` 已提供 `CODEGRAPH_MCP`（裸服务器 + 9 具名工具，双写）与 `skillDelegation(names)`；`migration` / `spec-archive` / `spec-bulk-archive` / `spec-propose` / `project-init` 已使用，但 `workflow` / `auto-workflow` / `debug` 手写字面量（`grep CODEGRAPH_MCP` = 0）。
- **派生策略边界**：`deriveCommandContent()` 为整段裁剪（`<!-- CMD:SKIP -->`），仅被 spec-* 采用（`test/template-derivation.test.ts` 作用域为 `getSkillTemplates('spec')`）；12 个模板手写 command content，压缩比为 12%–100%（`proposal-review` 12%、`workflow` 46%、spec-apply 92%）。
- **上游对照**：`@fission-ai/openspec` 的 `utils/command-references.ts`（引用拼写单一源 + 只改写已知 id）与 `core/templates/optional-workflow.ts`（生成期分支解析 + fail-loud 断言）为本次设计的直接参考。
- **手改保护机制**：`update.ts` 的 `isUnmodified(existing)` = `readGeneratedFingerprint(existing) === fingerprintOf(existing)`（内容自洽比对，独立于模板与版本号，见 `fingerprint.ts`）。

## Goals / Non-Goals

**Goals**:
- 建立模板正文指令引用的**单一源**（`commandRef()` + `KNOWN_COMMAND_IDS`）与**生成期按布局改写**能力；
- 用测试在源码侧**拦截死引用**（未注册指令 id / 未注册委派技能 / DEPS 未覆盖的委派），把"运行时 Fallback"收敛为"生成期失败"；
- 修复两处已断链引用；
- 收敛 `workflow` / `auto-workflow` / `debug` 的白名单字面量到共享常量；
- 移除遗留的 `metadata.version`。

**Non-Goals**:
- **不重构编排层**（P2）：`workflow` / `auto-workflow` 的探索/提案内联结构保持；委派化（`spec_explore` / `spec_propose` 补 non-interactive 契约、统一编排器委派策略）另立变更——它依赖本变更的引用/DEPS 校验先落地。
- **不强制全部模板走 `deriveCommandContent`**：派生是"整段裁剪"，与编排/大技能所需的"重写级压缩"（12–46%）是两种诉求，强行统一会使 `proposal-review` 指令从 4 KB 膨胀回 35 KB。派生契约仍只锁 spec-*。
- **不新增/收敛 OpenSpec 命名空间**：`openspec-*` 共存为有意设计（用户裁决），本变更不触及。
- **不引入 OpenSpec 的 `optional-workflow` 文本分支机制**：本项目已有 `profiles.ts` 的 `DEPS` 不动点注入，等价效果已具备；本变更只补"生成期校验 DEPS 覆盖性"，不引入双分支模板语法。
- **不做渐进披露（P1）与类型体系净化（P4/P8）**：各自另立变更。

## Decisions

### D1: 引用单一源模块——`commandRef()` + `KNOWN_COMMAND_IDS` 从 registry 派生
- **选择**：`src/core/templates/command-references.ts` 导出 `commandRef(id)`（返回规范形 `/iagent:<id>`）与 `KNOWN_COMMAND_IDS`（由 `registry.ts` 的 `WORKFLOW_PAIRS` 经 `deriveCommandId` 派生，运行时计算、不手维护）。模板正文以规范形书写；未注册 id 不由本函数产生（`commandRef` 可对未知名抛错，作为开发期防呆）。
- **理由**：把"字符串约定"升级为"单一真源 + 可校验"；沿用上游"规范形书写、生成期改写"的模式，降低分叉成本。
- **备选**：①枚举常量对象手维护（第二份真源，必然漂移，弃）；②直接把引用改为模板函数调用全部 20 模板（改动面过大，与 D2 的"未知名不改写"策略冲突，弃）。

### D2: 生成期按布局改写——仅已知 id、未知名原样保留
- **选择**：`rewriteCommandRefs(text, layout)`：`namespace-dir` 输出 `/iagent:<id>`（Claude，与规范形一致）；`prefixed-file` 输出 `/iagent-<id>`（Pi）。**仅改写 `KNOWN_COMMAND_IDS` 内的 id**；未知名保留原样。改写发生在生成侧（`generateSkillContent` / `generateCommand` 或适配器 `formatFile`）。
- **理由**：对齐上游注释所述教训（#727/#1307：工具列表漂移导致产物宣传不存在的命令）——静默改写拼写错误会掩盖真实缺陷，故只改已知 id，未知留给测试拦截。
- **假设 [待确认]**：Pi 的调用形式为 `/iagent-<id>`（与 `prefixed-file` 布局一致，见 `.pi/prompts/iagent-<id>.md`）；若 Pi 实际支持 `/iagent:<id>`，则本改写可退化为恒等，不影响其余设计。
- **备选**：仅在 Pi 侧改写（等价实现，落点更集中，可作实现细节）。

### D3: 死引用校验放测试、不放运行时
- **选择**：新增 `test/command-reference-refs.test.ts`：扫描全部模板 `instructions` 与 `content`，正则提取 `/iagent:([a-z-]+)`，断言 id ∈ `KNOWN_COMMAND_IDS`；提取 `Skill\(([a-z_]+)\)`，断言 `iagent_<裸名>` 已注册；断言所有被委派技能在 `DEPS` 中有覆盖路径（或其 workflow 依赖闭包覆盖）。
- **理由**：生成期失败比运行时 Fallback 更早、更确定；与既有 `allowed-tools.test.ts` / `skills-parity.test.ts` 同模式。
- **备选**：在 registry 注册时抛错（运行时生成中断）——对存量配置不友好；留在测试层，开发者与 CI 可拦截，用户侧不受影响。

### D4: 白名单共享常量强制——值等价来源统一
- **选择**：`workflow` / `auto-workflow` / `debug` 三模板改用 `${CODEGRAPH_MCP}` 与 `${skillDelegation([...])}`；新增测试断言"含 MCP / Skill( / `Agent`/`Task` 条目的技能，其白名单经共享常量构造（`includes(CODEGRAPH_MCP)` / `includes(SUBAGENT_DISPATCH)` / `skillDelegation` 逐条）"。
- **理由**：当前三模板手写字面量与常量**值恰好一致**，是"常量变更时不跟随"的静默漂移隐患；最小权限不变（只统一来源，不扩条目）。
- **备选**：仅加注释提醒（无强制力，弃）。

### D5: 移除 `metadata.version`——保留 author / generatedBy / generatedFingerprint
- **选择**：删除 `SkillTemplate.metadata.version`（22 处）、`generator.ts:85` 的 version 行、`generate.ts:91` 的 version 字段；保留 `metadata.author`。**不触碰** `metadata.generatedBy`（产物版本，CLI 写入）与 `generatedFingerprint`（内容指纹）。
- **理由**：`metadata.version` 只写不读，与守则 8 的 `generatedBy` 职责重叠且语义混乱（1.0/2.0/3.0 无规则）。手改保护基于指纹自洽比对，与模板字段无关，移除安全。
- **备选**：保留并纳入守则 8 版本规则（把游离字段制度化，但无消费者，徒增维护面，弃）。

## Architecture Mapping

```
模板层                                   生成层                         测试层
─────────                              ─────────                      ─────────
command-references.ts (新增)
  commandRef(id) ────────────┐
  KNOWN_COMMAND_IDS ◄── registry.WORKFLOW_PAIRS
  rewriteCommandRefs ────────┼──► generator / adapter ──► 产物正文(按布局)
                             │
workflows/*.ts（引用写规范形）│
tool-whitelist.ts（共享常量）─┘
                             │
                             └──► test/command-reference-refs.test.ts（拦截死引用）
                                  test/*（共享常量构造断言）
```

## Migration Plan

1. 新增 `command-references.ts`（`commandRef` / `KNOWN_COMMAND_IDS` / `rewriteCommandRefs`）+ 单测。
2. 修 `commit.ts` / `review.ts` 两处断链；新增死引用校验测试（此时应能捕获历史断链——作为测试有效性验证）。
3. 三模板白名单改共享常量 + 构造断言测试。
4. 删除 `metadata.version`（模板 / generator / generate.ts / types 注释）；更新相关断言。
5. `pnpm build && pnpm generate:skills` 重刷快照；`git diff skills/` 人工审查（预期差异：两处引用修复 + 移除 version 行）。
6. 全量 `pnpm test`。
7. 版本号递增 + CHANGELOG 归档（按守则 8：frontmatter 契约变更 → major）。

## Risks / Trade-offs

| 风险 | 缓解 |
| :--- | :--- |
| 引用改写引入 Pi 产物与预期不符 | `rewriteCommandRefs` 仅改已知 id 且仅按布局；`[待确认]` Pi 调用形式，实现前以真实 Pi 行为核对；未知名保留原样 |
| `KNOWN_COMMAND_IDS` 运行时从 registry 派生，若 registry 未导出足够信息 | registry 已导出 `getSkillTemplates()`（含 commandId），直接复用，不新增导出面 |
| 删除 `metadata.version` 影响存量产物的 update 判定 | 已核实指纹自洽比对（`fingerprintOf(existing)`），与模板无关；存量产物判为未手改，正常覆盖，无需 `--force` |
| 死引用测试对"散文提及技能名"误报 | 校验仅针对 `/iagent:<id>` 正则与 `Skill(...)` 精确条目，不做自由文本技能名扫描（对齐既有 `allowed-tools` 测试的"不采信 grep"原则） |
| 三模板改共享常量后白名单值发生意外变化 | 实现前逐条比对改前改后字符串；测试断言 `allowedTools.includes(CODEGRAPH_MCP)` 等 |
| 快照 diff 规模大（移除 20 处 version 行） | 属预期；`git diff skills/` 逐项审查，仅允许 version 行消失与两处引用修复 |

## Open Questions

- **[待确认]** Pi 的指令调用形式是否为 `/iagent-<id>`（`prefixed-file`）；若为 `/iagent:<id>` 则 `rewriteCommandRefs` 退化为恒等。
- **[待确认]** `commandRef()` 对未注册 id 是否应抛错（开发期防呆）还是返回原字符串（宽松）？倾向抛错（与"单一源"目标一致），实现前确认。
