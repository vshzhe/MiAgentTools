## Why

2026-10 的两轮技能体系审计已修复单一源、编排委派、门预算等问题，但当前代码事实仍显示三类残留：

1. **Token 体积失控**：现有预算只约束主 `SKILL.md` 行数（≤500 行，`test/skill-size-budget.test.ts:15`），不约束字符/token。实测 `iagent-debug` 500 行 / 27,018 字符、`iagent-spec-apply` 493 行 / 23,186 字符、`iagent-workflow` 499 行 / 22,235 字符、`iagent-spec-bulk-archive` 497 行 / 20,713 字符、`iagent-auto-workflow` 306 行 / 20,112 字符——均接近或超过 20,000 字符，行数预算对中文长段落失真。
2. **重复协议**：`iagent-auto-workflow` 正文明确「MUST NOT 重复声明或内联 apply 协议正文」（`auto-workflow.ts:141`），但 `:153-190`、`:198-232`、`:261-304` 仍复述测试门 / 一致性门 / review / 归档与 43 条 Guardrails，形成子技能协议的第二份真源。
3. **宿主专属工具词**：`TodoWrite` 出现在 `spec-explore.ts:39,82`、`debug.ts:268,279`、`migration-check.ts:101`、`spec-propose.ts:173,196`、`workflow.ts:43,193,336`；`mcp__codegraph__*` / `mcp__plugin_semgrep_*` 出现在 `spec-explore.ts:850-874`、`workflow.ts:271`、`auto-workflow.ts:61`。当前 OpenCode 宿主不提供 `TodoWrite`，CodeGraph 工具以 `codegraph_*` 暴露，硬编码词会触发无效调用与重试，放大 token 与回合数。
4. **文档与产物漂移**：`AGENTS.md:44` 与 `docs/project/**` 仍写 22 个模板（实际 23）；`workflows.ts:203` 注释称 auto-workflow 归档阶段无阻塞门（实际 `AUTO_ARCHIVE_PHASE` 含 `archive-confirmation`）；`prompt-gate.ts:4-6` 注释称 4 个技能（实际 5 个）；`.opencode/skills` 为旧产物（缺归档门与 `spec-update`），且无新鲜度守卫。

本变更以最小行为改动收敛上述问题：补足字符预算、去除重复协议、宿主工具词中立化、同步文档与注释、刷新本机 dogfood 产物。

## What Changes

- **主 SKILL 字符预算**：在既有 500 行预算之外新增 20,000 字符预算（生成后正文 `string.length`），两者并行、以更严格者为准；`test/skill-size-budget.test.ts` 增加字符断言。
- **超限技能收敛**：对 `iagent-debug` / `iagent-spec-apply` / `iagent-workflow` / `iagent-spec-bulk-archive` / `iagent-auto-workflow` 按「控制流留主文件、参考性细则下沉 references」拆分或压缩；`auto-workflow` 删除重复的子技能协议与重复 Guardrails。
- **宿主工具词中立化**：`TodoWrite` 改为「宿主待办工具（可用时）」的中性表述；`mcp__codegraph__*` / `mcp__plugin_semgrep_*` 改为宿主中立的工具名表述；新增回归测试扫描模板正文中的宿主专属工具词。
- **文档与注释同步**：22→23 计数修正（`AGENTS.md`、`docs/project/**`）；修正 `workflows.ts` 归档门注释与 `prompt-gate.ts` 技能数注释；清理 `spec-explore` 快照重复分隔线。
- **本机产物刷新**：实现完成后刷新 `.opencode/` dogfood 产物（gitignored、不提交）；失败仅 WARN。
- **非目标**：不改变任何确认门、门白名单、阶段顺序、allowedTools 语义与技能职责边界；不新增 CLI 命令；不修改运行时业务逻辑。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `template-generation`: 主 SKILL 尺寸预算扩展为「500 行 + 20,000 字符」双预算；`references` 下沉判据与宿主中立工具词约束扩展至 `TodoWrite` / `mcp__*`。
- `workflow-suite-skills`: `auto-workflow` 禁止复述子技能协议；文档计数要求覆盖技能模板数量。
- `codegraph-call-protocol`: CodeGraph / Semgrep 工具名在模板正文中必须宿主中立。

## Impact

### 直接影响的文件

- `src/core/templates/workflows/auto-workflow.ts`: 删除重复子协议、压缩 Guardrails、工具词中立化。
- `src/core/templates/workflows/debug.ts`: 压缩超限正文、`TodoWrite` 中立化。
- `src/core/templates/workflows/spec-apply.ts`: 压缩测试门/编译门正文至 20,000 字符内。
- `src/core/templates/workflows/workflow.ts`: 压缩示例与 Guardrails、工具词中立化。
- `src/core/templates/workflows/spec-bulk-archive.ts`: 压缩至 20,000 字符内。
- `src/core/templates/workflows/spec-explore.ts`: `TodoWrite` / `mcp__*` 中立化；清理重复分隔线。
- `src/core/templates/workflows/spec-propose.ts` / `migration-check.ts`: `TodoWrite` 中立化。
- `test/skill-size-budget.test.ts`: 新增字符预算断言。
- `test/template-language.test.ts`（或新增回归锁）: 新增宿主专属工具词扫描。
- `src/core/host-orchestration/workflows.ts`: 修正归档门注释。
- `src/core/templates/prompt-gate.ts`: 修正技能数注释。
- `AGENTS.md` / `docs/project/architecture/技术框架.md` / `docs/project/modules/模块与功能点.md`: 22→23 计数修正。
- `.opencode/skills/**`: 本机刷新产物（gitignored，不提交）。

### 向后兼容

无破坏性变更。仅文本位置与工具词表述调整；确认门、阶段顺序、`allowedTools`、CLI 契约与公开 API 不变。`skills/` 快照由 `pnpm build && pnpm generate:skills` 重新生成；`.opencode/` 刷新不进入提交面。
