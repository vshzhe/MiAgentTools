# 探索记录：自定义 iagent 流程 JSON-only 制品

## Background

自定义 iagent 流程已声明 JSON-first（`change.json` 为 proposal/specs/design 的结构化真源），
但三处残留仍产出 `proposal.md` / `design.md` / `specs/*.md`，形成 JSON 与 MD 两份真源：

1. `openspec/rules/artifact-generation.md`（唯一源协议）全篇仍写旧 CLI 名 `venus spec ...`
   （`venus spec new` / `status` / `instructions` / `render tasks`），AI 执行失败后行为退化。
2. 多个模板仍指示渲染或读取这些 MD：
   - `debug.ts`：`iagent spec render <type>`（type 含 proposal/specs/design）与「降级直接编辑 MD」
   - `proposal-review.ts`：更新 JSON 段后重渲染 specs/design、降级编辑 MD
   - `spec-verify.ts`：建议 `iagent spec render design` 重渲染
   - `full-workflow.ts`：Bridge 2 就绪检查要求 `proposal.md/design.md/specs/*.md/tasks.md` 齐全
   - `auto-workflow.ts`：读 proposal.md / design.md 段标题
   - `package.ts`：以 `proposal.md` 存在判定提案关联、从 MD 抽配置项
   - `spec-archive.ts`：TOC/术语/摘要/CodeGraph 查询仍以 proposal.md/design.md 为源
3. CLI `src/commands/spec.ts` 仍提供 `render proposal|specs|design`，`sidecar-writer.ts` 有
   `renderProposalMd` / `renderDesignMd` / `renderSpecsMd`。

## 提示词基线 (Prompt Baseline)

**原始提示词**：优化自定义项目提案生成、实现、归档等相关功能逻辑；当前使用自定义流程 iagent 时，
除了生成 json 文件外，还是会生成 proposal/design/spec 规格文档；使用自研流程时应不生成对应的 md
文件，只有 change.json 文件；同时在实现、一致性校验和归档时读取对应 json 文件进行数据处理。

**确认后的提示词基线**：自研 iagent 流程改为 JSON-only —— 新变更只写 `change.json` +
`tasks.json`（tasks.md 保留渲染供人工评审）；删除 proposal/design/specs 的 MD 生成入口；
实现/校验/归档/索引统一读 JSON；MD 降级仅限存量/已归档变更的只读回退。

**用户裁决**：
- Q1 = ① 直接删除 `iagent spec render proposal|specs|design`；
- Q2 = 保留 `tasks.md` 渲染；
- Q3 = 保留历史存量变更的 MD 只读降级。

## 关键决策 (Decisions)

- **D1**：`RENDER_TYPES` 收窄为 `['tasks']`，删除 `renderChangeSection` 与三个渲染器。
- **D2**：`tasks.json` 为权威任务清单，`tasks.md` 为唯一 MD 出口。
- **D3**：读取侧 JSON-first；MD 降级仅在变更无 `change.json` 时且只读 + WARN。
- **D4**：`detectCompleted` 的 specs 判定以 `change.json` 段为主，`specs/**/*.md` 仅作存量识别。
- **D5**：`openspec/rules/artifact-generation.md` 用 `iagent` CLI 重写为 JSON-only。
- **D6**：所有模板归零 + 结构化回归测试防反弹。
- **D7**：删除 CLI 渲染行为属 BREAKING → 版本 major（3.0.0）。

## Codebase Findings

### Discovered Files

- `openspec/rules/artifact-generation.md`：唯一源协议（旧 CLI 名 + MD 提及）。
- `src/core/spec/schema.ts`：artifact 定义（proposal/specs/design → change.json；tasks → tasks.json）。
- `src/commands/spec.ts`：`render <type>`、`renderChangeSection`、`getApplyInstructions`、`parseTaskList`。
- `src/core/spec/sidecar-writer.ts`：`renderProposalMd` / `renderDesignMd` / `renderSpecsMd`。
- `src/core/spec/status.ts`：`detectCompleted`（JSON 段 + 遗留 `specs/**/*.md`）、`parseTaskProgress`（读 tasks.json）。
- 模板：`debug.ts`、`proposal-review.ts`、`spec-verify.ts`、`full-workflow.ts`、`auto-workflow.ts`、
  `package.ts`、`spec-archive.ts`、`spec-bulk-archive.ts`、`spec-apply.ts`、`spec-propose.ts`、
  `spec-explore.ts`、`requirement-doc.ts`。

### Identified Symbols

- `RENDER_TYPES`（spec.ts）：渲染合法类型清单。
- `renderChangeSection`（spec.ts）：三分支 MD 写出。
- `renderProposalMd/renderDesignMd/renderSpecsMd`（sidecar-writer.ts）：待删除。
- `detectCompleted`（status.ts）：artifact 完成判定。
- `parseTaskList` / `parseTaskProgress`（已在读 tasks.json）。
- `getApplyInstructions`（spec.ts）：contextFiles 已指向 change.json/tasks.json。

## 边界与错误条件 (Boundaries)

- `iagent spec render proposal|specs|design`：MUST 报错退出码非零，MUST NOT 写 MD。
- 存在 `change.json` 的变更：读取 MUST NOT 触碰 proposal.md/design.md/specs/*.md。
- 无 `change.json` 的存量/已归档变更：只读 MD 降级 + WARN。
- 上游 `openspec` CLI 混用仍可能产 MD：明确超出本次范围（仅约束 iagent 流程）。
- 删除 render 为 BREAKING：明示 CHANGELOG 与命令报错。

## Pending

（空）Q1/Q2/Q3 已由用户裁决，无遗留待确认项。

## 备注

本次为工具链/制品契约改造，**无业务功能流程**，故不含 `## 功能流程图` 段（评分维度 D10 相应 SKIP）。
