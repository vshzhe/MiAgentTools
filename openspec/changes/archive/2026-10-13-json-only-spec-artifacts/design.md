# Design

## Context

参见 `proposal.md` 的 Why。实现相关现状：

- iagent spec 系统已声明 JSON-first：`src/core/spec/schema.ts` 中 proposal/specs/design 的
  `outputPath` 均为 `change.json`，tasks 为 `tasks.json`。
- 但三处仍产出 MD：`openspec/rules/artifact-generation.md` 全篇旧 CLI 名 `venus`；
  `debug.ts` / `proposal-review.ts` / `spec-verify.ts` / `full-workflow.ts` / `auto-workflow.ts` /
  `package.ts` / `spec-archive.ts` 仍指示渲染或读取 MD；`src/commands/spec.ts` 的
  `render proposal|specs|design` 与 `sidecar-writer.ts` 的三个渲染器仍在。
- 读取侧已是 JSON-primary + MD 降级，但措辞与降级边界未收紧。
- `detectCompleted`（`status.ts`）对 specs 用 `change.json specs 段非空 OR specs/**/*.md 存在`。

## Goals / Non-Goals

**Goals:**

- 新变更只产出 `change.json` + `tasks.json`（+ 渲染的 `tasks.md`），无 proposal/design/specs MD。
- 删除三处 MD 生成入口（协议文本、模板指令、CLI 渲染分支与渲染器）。
- 实现 / 校验 / 归档 / reindex / 需求文档统一 JSON-first；MD 仅存量只读降级。
- 修正协议中的旧 CLI 名。

**Non-Goals:**

- 不删除 `tasks.md`（人工评审唯一 MD 出口）。
- 不删除存量 / 已归档变更的既有 MD，也不移除其只读降级能力。
- 不改上游 `openspec` CLI 的行为（与本工具两套系统；JSON-only 仅约束 iagent 流程）。
- 不改 `change.json` / `tasks.json` 的 schema 字段。

## Decisions

### D1. 彻底删除 proposal/specs/design 的 MD 渲染

`iagent spec render` 的合法类型收窄为 `['tasks']`；删除 `renderChangeSection` 及
`sidecar-writer.ts` 的 `renderProposalMd` / `renderDesignMd` / `renderSpecsMd`。

**备选**：保留但加 `--legacy` 闸门。否决（用户裁决 ①）——该能力正是误生成的入口，
保留即留有第二真源；无已知正当用途。

### D2. 保留 `tasks.md` 渲染

`tasks.json` 是权威任务清单，`tasks.md` 由 `iagent spec render tasks` 确定性渲染供人工评审，
是本流程**唯一**的 MD 产物出口。

### D3. 读取侧 JSON-first，MD 降级严格限定

apply / verify / archive / reindex / requirement-doc 读取 `change.json` + `tasks.json`；
MD 降级仅在**目标变更无 `change.json`**（存量 / 已归档）时触发，且只读 + WARN。
存在 `change.json` 的变更 MUST NOT 读或写这些 MD。

### D4. `detectCompleted` 的 specs 判定

`change.json` 的 `specs` 段非空为主判定；保留 `specs/**/*.md` 的 OR 分支**仅用于识别存量变更**
（向后兼容），新变更不再依赖它。不新增任何 MD 完成依据。

### D5. 协议单一源重写

`openspec/rules/artifact-generation.md` 用 `iagent` CLI 名重写为 JSON-only：proposal/specs/design
写入 `change.json` 段，tasks 写 `tasks.json`，仅 tasks 渲染 `tasks.md`；删除「手写 MD 降级」。

### D6. 模板归零与回归锁

所有模板中「渲染 / 要求 proposal|design|specs MD」的指令与就绪检查改为 JSON-only。
新增回归测试：模板正文 MUST NOT 含 `iagent spec render proposal|specs|design`，
MUST NOT 以 proposal.md/design.md/specs/*.md 作为生成或就绪条件（存量降级措辞除外）。

### D7. 版本递增

删除 `render proposal|specs|design` 属 CLI 行为破坏性变更 → **major**（3.0.0）。

## Risks / Trade-offs

- [删除 render 破坏外部脚本] → 明示 **BREAKING**；命令改为清晰报错（仅支持 tasks）；CHANGELOG 记录。
- [回归：模板未来又被改回 MD 生成] → D6 的结构化回归测试拦截。
- [存量变更读取降级漂移] → D3 严格门控 + WARN；测试覆盖「有 change.json 不读 MD」与「无 change.json 只读降级」。
- [与上游 openspec CLI 混用仍产 MD] → 超出本次范围；文档说明 JSON-only 仅约束 iagent 流程。

## Migration Plan

1. 升级后 `iagent update` 刷新技能与指令。
2. 存量活跃变更若仅 MD：读取侧仍可只读降级；如需 JSON-first 可择机重写为 `change.json`。
3. 回滚：无数据迁移；删除的是生成能力，既有 MD 不被触碰。

## Open Questions

无。
