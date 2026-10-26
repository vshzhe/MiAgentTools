# Tasks

## 1. 协议与规则修正（单一源）

- [x] 1.1 重写 `openspec/rules/artifact-generation.md`：全部 `venus spec ...` → `iagent spec ...`；proposal/specs/design 明确「只写 change.json 段、MUST NOT 生成 MD、无 MD 手写降级」，仅 tasks 渲染 tasks.md；验证：`grep -n "venus spec" openspec/rules/artifact-generation.md` 零命中，且文本含 JSON-only 禁令
- [x] 1.2 确认协议为唯一源、模板不以复制步骤绕过（`template-generation` 的「生成协议单一源」约束）；验证：检查被改模板正文仅引用 `openspec/rules/artifact-generation.md` 而不内联分叉步骤

## 2. CLI 渲染收窄与渲染器删除

- [x] 2.1 `src/commands/spec.ts`：`RENDER_TYPES` 收窄为 `['tasks']`，删除 `renderChangeSection` 及 proposal/specs/design 分支；验证：`test/spec-commands.test.ts` 断言 `render tasks` 成功、`render proposal|specs|design` 报错且退出码非零、不产出 MD
- [x] 2.2 `src/core/spec/sidecar-writer.ts`：删除 `renderProposalMd` / `renderDesignMd` / `renderSpecsMd`；验证：`pnpm build` 通过且 `grep -rn "renderProposalMd\|renderDesignMd\|renderSpecsMd" src/` 零命中
- [x] 2.3 `src/core/spec/status.ts`：specs 完成判定以 `change.json` 的 `specs` 段为主，`specs/**/*.md` 仅保留为存量识别分支并加注释；验证：新增用例断言仅有 change.json specs 段的变更判为 done（无 MD 时也成立）
- [x] 2.4 `getApplyInstructions`（`src/commands/spec.ts`）文案与注释改为 `tasks.json` 口径（不再把 tasks.md 作为权威源），`instructions` / `reindex` 读取路径与新 spec 对齐；验证：用例断言 apply `instruction` 文本引用 tasks.json、contextFiles 指向 change.json/tasks.json

## 3. 模板归零（不再生成/要求 proposal/design/specs MD）

- [x] 3.1 `debug.ts`：删除「render <type> 含 proposal/specs/design」与「降级直接编辑 MD」，Phase 6 改为只更新 change.json + tasks.json + `render tasks`；验证：模板正文零 `render proposal|specs|design`
- [x] 3.2 `proposal-review.ts`：读取与修复改为 change.json，删除重渲染 specs/design 与直接编辑 MD 的降级；验证：零 `render specs|design`
- [x] 3.3 `spec-verify.ts`：删除「运行 `iagent spec render design` 重渲染」建议，改为只更新 change.json design 段；验证：零 `render design`
- [x] 3.4 `full-workflow.ts`：Bridge 2 就绪检查改为 `change.json` 段 + tasks.json；验证：正文不再以 proposal.md/design.md/specs/*.md/tasks.md 齐全为就绪条件
- [x] 3.5 `auto-workflow.ts`：Impact Analysis / design 内容改读 `change.json` 段；验证：不再引用 proposal.md/design.md 段标题
- [x] 3.6 `package.ts`：提案关联与配置项抽取改以 `change.json` 为准（无则存量 MD 只读降级 + WARN）；验证：正文不再以 `proposal.md` 存在判定关联
- [x] 3.7 `spec-archive.ts` / `spec-bulk-archive.ts`：术语表 / 摘要 / CodeGraph 查询 / TOC 等改读 change.json 段，MD 仅存量只读降级；验证：这些步骤不再以 proposal.md/design.md 为唯一来源
- [x] 3.8 收敛 `spec-apply.ts` / `spec-propose.ts` / `spec-explore.ts` / `requirement-doc.ts` 的 MD 降级措辞为「仅存量/已归档变更 + WARN」，不新增 MD 生成路径；验证：正文不再给出新变更手写 MD 的路径
- [x] 3.9 运行 `pnpm build && pnpm generate:skills` 刷新快照；验证：`test/skills-parity.test.ts` 通过

## 4. 测试与回归锁

- [x] 4.1 新增模板回归测试：全部模板正文 MUST NOT 含 `iagent spec render proposal|specs|design`，且不以 proposal.md/design.md/specs/*.md 作为生成或就绪条件（存量只读降级措辞白名单例外）；验证：`pnpm test` 通过
- [x] 4.2 更新 `test/spec-commands.test.ts`：render 类型收窄、拒绝三分支、tasks.md 仍可渲染；验证：相关用例通过
- [x] 4.3 新增 `detectCompleted` / 读取侧用例：有 change.json 时只读 JSON（不读 MD）；无 change.json 的存量变更只读降级 + WARN；验证：用例通过
- [x] 4.4 新增断言：`sidecar-writer` 不再导出 / 定义三个 MD 渲染器，`iagent spec render` 不写任何 proposal/design/specs MD；验证：用例通过
- [x] 4.5 新增/更新 `iagent spec instructions` / `instructions apply` / `reindex` 的 JSON 口径用例（outputPath=change.json、progress/taskList 来自 tasks.json、reindex change.json 优先）；验证：用例通过

## 5. 集成校验与发版收口

- [x] 5.1 运行 `pnpm build && pnpm test && pnpm lint` 全绿；验证：命令退出码均为 0
- [x] 5.2 更新 `README.md` / `AGENTS.md`：`iagent spec render` 仅 tasks；proposal/design/specs 为 JSON-only；MD 仅存量只读降级；修正协议旧 CLI 名相关描述；验证：文档与实际行为一致
- [x] 5.3 按修改守则递增 `package.json` 为 **3.0.0**（BREAKING：删除 CLI 渲染行为），把 `CHANGELOG.md` 的 Unreleased 归档为 3.0.0 小节（含 `### BREAKING`）并同步链接引用；验证：版本号与 CHANGELOG 同步且随本次提交

## Workflow follow-up

- 归档本变更（`iagent_spec_archive` / `openspec archive`），归档后确认主 spec 的 `artifact-json-sidecar`、`artifact-generation-protocol`、`spec-workflow-cli`、`spec-workflow-skills`、`workflow-suite-skills` 已同步。
- 本机执行一次 `iagent update` 刷新 dogfood 技能与指令，抽查 `iagent spec render proposal` 报错、`iagent spec render tasks` 正常。
