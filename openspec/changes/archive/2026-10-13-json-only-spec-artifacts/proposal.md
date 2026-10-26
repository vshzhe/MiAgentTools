# Proposal

## Why

自定义 iagent 流程已声明 JSON-first（`change.json` 为结构化真源），但三处残留仍会产出
`proposal.md` / `design.md` / `specs/*.md`，形成 JSON 与 MD 两份真源、增加漂移与维护成本：

1. 单一源协议 `openspec/rules/artifact-generation.md` 仍全篇使用旧 CLI 名 `venus spec ...`，
   AI 执行失败后行为退化，可能回退手写 MD；
2. 多个技能模板仍在指示渲染或读取这些 MD（debug / proposal-review / spec-verify /
   full-workflow / auto-workflow / package / spec-archive）；
3. CLI `iagent spec render` 仍提供 `proposal` / `specs` / `design` 三个 MD 渲染分支，
   与「不生成 MD」的模板声明直接冲突。

## What Changes

- **BREAKING**：移除 `iagent spec render proposal|specs|design` —— `render` 仅保留 `tasks`；
  删除 `renderChangeSection` 与 `renderProposalMd` / `renderDesignMd` / `renderSpecsMd`。
- 修正 `openspec/rules/artifact-generation.md` 的旧 CLI 名（`venus` → `iagent`），并明确
  proposal / design / specs **无 MD 产物、无 MD 生成路径、无 MD 降级**。
- 清理所有模板中「渲染 / 要求 / 依赖 proposal/design/specs MD」的指令与就绪检查：
  debug、proposal-review、spec-verify、full-workflow、auto-workflow、package、spec-archive。
- 实现（apply）/ 一致性校验（verify）/ 归档（archive）/ reindex / 需求文档统一以
  `change.json` + `tasks.json` 为数据源；MD 降级**仅保留给存量 / 已归档变更**（只读 + WARN）。
- `detectCompleted` 对 `specs` 的判定以 `change.json` 的 `specs` 段为准；遗留 `specs/**/*.md`
  仅用于识别存量变更，不再作为新变更的完成依据。
- `tasks.md` **保留**渲染（人工评审的唯一 MD 出口），由 `iagent spec render tasks` 产出。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `artifact-json-sidecar`: `render*Md` 收窄为仅 `tasks.md`；proposal / design / specs 不再有
  MD 渲染与产物。
- `artifact-generation-protocol`: 协议改用 `iagent` CLI 且明示 JSON-only。
- `spec-workflow-cli`: `iagent spec render` 仅支持 `tasks`；`instructions` / `instructions apply` /
  `reindex` / `status` 以 `change.json` + `tasks.json` 为数据源（修正 MD 口径漂移）。
- `spec-workflow-skills`: 6 个 spec 技能制品读写 JSON-only，MD 降级仅限存量 / 已归档变更。
- `workflow-suite-skills`: 编排与辅助技能 MUST NOT 生成或要求 proposal / design / specs MD。

## Impact

- `openspec/rules/artifact-generation.md`：CLI 名与 JSON-only 契约。
- 模板 `src/core/templates/workflows/`：`debug.ts`、`proposal-review.ts`、`spec-verify.ts`、
  `full-workflow.ts`、`auto-workflow.ts`、`package.ts`、`spec-archive.ts`、`spec-bulk-archive.ts`、
  `spec-apply.ts`、`spec-propose.ts`、`spec-explore.ts`、`requirement-doc.ts`（措辞收敛）。
- CLI/内核：`src/commands/spec.ts`、`src/core/spec/sidecar-writer.ts`、`src/core/spec/status.ts`。
- 测试：`test/spec-commands.test.ts`、`test/template-derivation.test.ts`、`test/templates.test.ts`
  及受影响模板用例；`skills/` 快照重新生成。
- 文档与发版：`README.md`、`AGENTS.md`、`CHANGELOG.md`、`package.json`（major 递增，因删除 CLI 行为）。
