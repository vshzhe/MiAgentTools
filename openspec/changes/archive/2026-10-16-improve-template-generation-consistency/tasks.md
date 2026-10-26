# Tasks: improve-template-generation-consistency

<!-- 任务类型标签：[代码] / [DB脚本] / [使用说明]（默认产出至 attachments/） -->

## 1. 引用单一源基础设施

- [x] 1.1 [代码] 新建 `src/core/templates/command-references.ts`：导出 `commandRef(id)`（产出规范形 `/iagent:<id>`；对未注册 id 的处理按 design Open Question 裁决——倾向抛错防呆）、`KNOWN_COMMAND_IDS`（从 registry 的 `WORKFLOW_PAIRS` 经 `deriveCommandId` 运行时派生，MUST NOT 手工维护）、`rewriteCommandRefs(text, layout)`（`namespace-dir` → `/iagent:<id>`；`prefixed-file` → `/iagent-<id>`；仅改写 `KNOWN_COMMAND_IDS` 内的 id，未知名原样保留）
  - 文件：`src/core/templates/command-references.ts`（新建）
  - 验证：单元测试覆盖——规范形产出、两种布局改写、未知名不改写、`KNOWN_COMMAND_IDS` 与 registry 一致
  - Spec Ref：`template-generation / 模板正文指令引用 SHALL 单一源并可生成期校验`
  - Scenario Ref：引用以规范形书写并由单一源产出

- [x] 1.2 [代码] 在生成侧接入 `rewriteCommandRefs`：对技能 `instructions` 与指令 `content` 按目标工具布局改写（落点为 `command-generation/generator.ts` 或适配器 `formatFile`，按实现最小面选择）
  - 文件：`src/core/command-generation/generator.ts`（或 `adapters/*.ts`）
  - 验证：为 claude 生成时引用保持 `/iagent:<id>`；为 pi 生成时为 `/iagent-<id>`；既有快照除预期改动外不变
  - Spec Ref：`template-generation / 模板正文指令引用 SHALL 单一源并可生成期校验`
  - Scenario Ref：生成期按工具布局改写
  - Scenario Ref：引用改写不改变指令派生策略

## 2. 死引用回归锁与历史断链修复

- [x] 2.1 [代码] 新增 `test/command-reference-refs.test.ts`：① 扫描全部模板 `instructions` 与 `content`，提取 `/iagent:([a-z-]+)`，断言 id ∈ `KNOWN_COMMAND_IDS`；② 提取 `Skill\(([a-z_]+)\)`，断言 `iagent_<裸名>` 已注册；③ 断言所有被委派技能被 `profiles.ts` 的 `DEPS` 依赖闭包覆盖。MUST 仅做正则精确匹配，MUST NOT 对自由文本技能名做扫描（对齐 allowed-tools 测试的"不采信 grep"原则）
  - 文件：`test/command-reference-refs.test.ts`（新建）
  - 验证：先以当前代码运行应捕获 `commit-change` / `review-code` 两处（证明测试有效），修复后全绿
  - Spec Ref：`template-generation / 模板正文指令引用 SHALL 单一源并可生成期校验`
  - Scenario Ref：未注册 id 被测试拦截
  - Scenario Ref：无条件委派技能由 DEPS 覆盖
  - Scenario Ref：条件委派声明降级路径

- [x] 2.2 [代码] 修复 `commit.ts` 正文引用 `/iagent:commit-change` → `/iagent:commit`（建议改用 `commandRef('commit')`）；修复 `review.ts` 正文引用 `/iagent:review-code` → `/iagent:review`（建议改用 `commandRef('review')`）
  - 文件：`src/core/templates/workflows/commit.ts`、`src/core/templates/workflows/review.ts`
  - 验证：`grep -rn "commit-change\|review-code" src/` 零命中（`legacy-migration.ts` 的旧名映射表除外）；2.1 测试通过
  - Spec Ref：`template-generation / 模板正文指令引用 SHALL 单一源并可生成期校验`
  - Scenario Ref：历史断链修复

## 3. 白名单共享常量收敛

- [x] 3.1 [代码] `workflow.ts` / `auto-workflow.ts` / `debug.ts` 的 `allowedTools` 手写字面量改走 `${CODEGRAPH_MCP}` / `${skillDelegation([...])}` / `${SUBAGENT_DISPATCH}`；改前逐条记录原值，改后逐条比对确保等价（MUST NOT 扩条目）
  - 文件：`src/core/templates/workflows/workflow.ts`、`auto-workflow.ts`、`debug.ts`
  - 验证：`grep -c CODEGRAPH_MCP <file>` ≥ 1 且无 `mcp__codegraph` 裸字面量；改后 `allowedTools` 与改前逐条等价
  - Spec Ref：`tool-call-whitelist / 调用类白名单条目 SHALL 经共享常量构造`
  - Scenario Ref：编排技能白名单经共享常量构造
  - Scenario Ref：常量变更自动跟随
  - Scenario Ref：授权面不因来源统一而扩大

- [x] 3.2 [代码] 新增共享常量构造断言测试：含 MCP 条目者 `allowedTools.includes(CODEGRAPH_MCP)`；含派发条目者 `includes(SUBAGENT_DISPATCH)`；含委派条目者其 `Skill(...)` 条目可由 `skillDelegation(...)` 产出
  - 文件：`test/allowed-tools.test.ts`（扩展）或新建 `test/tool-whitelist-constants.test.ts`
  - 验证：`pnpm test` 全绿
  - Spec Ref：`tool-call-whitelist / 调用类白名单条目 SHALL 经共享常量构造`
  - Scenario Ref：编排技能白名单经共享常量构造

## 4. 移除 metadata.version

- [x] 4.1 [代码] 删除 `generator.ts` frontmatter 的 `version:` 行；更新 `types.ts` 中 `SkillTemplate.metadata` 契约注释（不再含 version）
  - 文件：`src/core/command-generation/generator.ts`、`src/core/templates/types.ts`
  - 验证：生成的 SKILL.md frontmatter `metadata` 无 `version` 行；`generatedBy` / `generatedFingerprint` 保留
  - Spec Ref：`template-generation / frontmatter 元数据字段 SHALL NOT 含 metadata.version`
  - Scenario Ref：模板与生成器不再写入 version
  - Scenario Ref：记账字段不受影响

- [x] 4.2 [代码] 移除 20 个模板 `metadata: { ... version: ... }` 中的 version 键；移除 `generate.ts` 骨架模板的 version 字段
  - 文件：`src/core/templates/workflows/*.ts`（20 个）、`src/commands/generate.ts`
  - 验证：`grep -rn "version: '1.0'\|version: '2.0'\|version: '3.0'" src/core/templates/workflows/ src/commands/generate.ts` 零命中
  - Spec Ref：`template-generation / frontmatter 元数据字段 SHALL NOT 含 metadata.version`
  - Scenario Ref：模板与生成器不再写入 version

- [x] 4.3 [测试][单元][P0] 更新既有断言：检查是否有测试断言 frontmatter 含 `version`（如有则改为断言不含）；新增"存量产物移除 version 后 `isUnmodified` 仍为真"的回归用例（构造旧产物 → 判定未手改 → 覆盖升级）
  - 文件：`test/generation.test.ts` / `test/validate-update.test.ts`（按实际断言位置）
  - 验证：`pnpm test` 全绿
  - Spec Ref：`template-generation / frontmatter 元数据字段 SHALL NOT 含 metadata.version`
  - Scenario Ref：存量产物移除 version 后仍可安全升级

## 5. 快照、文档与回归

- [x] 5.1 [代码] 重新生成快照并人工审查 diff：`pnpm build && pnpm generate:skills`；`git diff skills/` 与 `.claude/commands/iagent/` 仅允许两类差异——两处引用修复、20 处 version 行移除（及 Pi 侧按需引用改写）
  - 文件：`skills/`、`.pi/prompts/`、`.claude/commands/iagent/`（本机产物）
  - 验证：diff 仅含预期差异；`test/skills-parity.test.ts` 通过
  - Spec Ref：`template-generation / 模板正文指令引用 SHALL 单一源并可生成期校验`

- [x] 5.2 [代码] AGENTS.md 更新：仓库地图补充 `command-references.ts`；修改守则补充"指令引用以规范形书写、经生成期改写，未注册 id 由测试拦截"与"metadata 不含 version"约定；第 2 条白名单规则补"共享常量强制"
  - 文件：`AGENTS.md`
  - 验证：人工核对与实现一致

- [x] 5.3 [代码] 全量回归与版本收尾：`pnpm build && pnpm test` 全绿；按守则 8 递增 `package.json` 版本（frontmatter 契约变更 → major）并归档 `CHANGELOG.md` 的 `[Unreleased]`
  - 文件：`package.json`、`CHANGELOG.md`
  - 验证：`pnpm test` 全绿；CHANGELOG 生成新版本小节
