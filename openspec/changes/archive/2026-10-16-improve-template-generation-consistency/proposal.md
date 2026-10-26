## Why

模板层与生成层经 `venus → iagent` 改名（2.0.0）、JSON-first → Markdown-first（5.0.0）两次大重构后，积累了三类**同根**结构性问题（探索记录见 `openspec/explorations/skill-system-review-explore-001.md`）：

1. **模板正文内的指令引用缺单一源，已实际断链**。模板正文以裸字符串书写 `/iagent:<id>`，无生成期校验。改名后遗留两处指向旧 id 的死引用（铁证：`src/core/legacy-migration.ts` 的旧名映射表 `tr-commit-change→commit`、`tr-review-code→review`）：
   - `src/core/templates/workflows/commit.ts` 写 `/iagent:commit-change`，真实 id 为 `commit`（调用形式 `/iagent:commit`）；
   - `src/core/templates/workflows/review.ts` 写 `/iagent:review-code`，真实 id 为 `review`（调用形式 `/iagent:review`）。
   这两处已污染生成产物（`.claude/commands/iagent/commit.md` 正文含旧引用），用户复制该指令会得到不存在的命令。
2. **白名单共享常量"值一致但源不一致"**。`tool-call-whitelist.ts` 已把 CodeGraph MCP 条目与技能委派条目收敛为共享常量（`CODEGRAPH_MCP` / `skillDelegation()`），但 `workflow` / `auto-workflow` / `debug` 三个模板仍**手写** `mcp__codegraph…` 与 `Skill(...)` 字面量——当前值与常量恰好一致，却不受常量变更保护（常量一变即静默漂移）。
3. **`metadata.version` 语义游离**。20 个模板中 `project_init` 为 `2.0`、`test` 为 `3.0`、其余 18 个为 `1.0`；该字段被 `generator.ts` 写入 frontmatter，但**无任何逻辑读取**，且与 AGENTS.md 守则 8 规定的 `generatedBy`（写入产物版本）职责重叠。

根因是同一个：**模板层缺一层"引用/片段的生成期单一源与校验"**。上游 `@fission-ai/openspec`（与本项目同源架构）用 `utils/command-references.ts`（引用拼写单一源 + 只改写已知 id）与 `core/templates/optional-workflow.ts`（生成期按已安装集解析引用，失败即抛）解决同类问题。本变更参考其机制，在不改变既有派生策略（`deriveCommandContent` 仅覆盖 spec-*）与不重构编排结构的前提下，补齐这层缺失基础设施。

## What Changes

1. **新增引用单一源模块 `src/core/templates/command-references.ts`**：
   - 导出 `commandRef(id)`——以规范形 `/iagent:<id>` 书写引用；
   - 导出 `KNOWN_COMMAND_IDS`——从 registry（`WORKFLOW_PAIRS`）派生的全部合法 instruction id 集合，单一真源；
   - 导出 `rewriteCommandRefs(text, layout)`——生成期按工具指令布局改写：`namespace-dir`（Claude）保持 `/iagent:<id>`，`prefixed-file`（Pi）改写为 `/iagent-<id>`；**仅改写 `KNOWN_COMMAND_IDS` 内的 id，未知名原样保留**（对齐上游：不把拼写错误静默改造成另一个不存在的命令）。
2. **生成期死引用校验（回归锁）**：新增测试断言——① 全部模板 `instructions` 与 `content` 中的 `/iagent:<id>` 之 id MUST ∈ `KNOWN_COMMAND_IDS`；② 全部 `Skill(...)` 条目对应已注册技能（`iagent_<裸名>`）；③ `profiles.ts` 的 `DEPS` 覆盖全部被委派技能（委派目标必随装）。
3. **修复两处断链**：`commit.ts` / `review.ts` 的正文引用改为 `commandRef('commit')` / `commandRef('review')`（或规范形字面量），产物正文反映真实 id。
4. **白名单共享常量强制**：`workflow` / `auto-workflow` / `debug` 三模板的 CodeGraph MCP 条目与技能委派条目改走 `${CODEGRAPH_MCP}` / `${skillDelegation([...])}`；新增测试断言"含 MCP/委派/派发条目的技能其白名单经共享常量构造"。
5. **移除 `metadata.version`**：删除 `SkillTemplate.metadata.version`（22 处模板字面量）、`generator.ts` frontmatter 的 version 行、`generate.ts` 骨架模板的 version 字段；保留 `metadata.author`。**不改变** `metadata.generatedBy`（产物版本）与 `metadata.generatedFingerprint`（手改保护），二者语义不变。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `template-generation`: 新增"模板正文指令引用单一源与生成期校验"要求——引用以规范形书写、未注册 id 由测试拦截、生成期按工具布局改写；新增"frontmatter 移除 `metadata.version`"要求。
- `tool-call-whitelist`: 强化"调用类条目共享常量"要求——含 CodeGraph MCP / 技能委派 / 子代理派发条目的技能 MUST 经 `tool-whitelist.ts` 共享常量构造，MUST NOT 逐模板手写字面量。

## Impact

### 直接影响的文件

- `src/core/templates/command-references.ts`（新建）：引用单一源 + `KNOWN_COMMAND_IDS` + `rewriteCommandRefs`
- `src/core/templates/workflows/commit.ts` / `review.ts`：修复两处断链引用
- `src/core/templates/workflows/workflow.ts` / `auto-workflow.ts` / `debug.ts`：白名单字面量改走共享常量
- `src/core/command-generation/generator.ts`：删除 frontmatter 的 `version` 行
- `src/core/templates/types.ts`：`SkillTemplate.metadata` 契约注释更新（不再含 version）
- `src/commands/generate.ts`：骨架模板移除 version 字段
- `src/core/templates/workflows/*.ts`（20 个）：移除 `metadata: { ... version: ... }` 中的 version 键
- 生成侧（`generator.ts` 或适配器）：对 skill / command 正文调用 `rewriteCommandRefs`（按工具布局）
- `test/`：新增引用校验测试、共享常量构造测试；更新既有断言（如快照/元数据）
- `skills/`：快照重新生成（`pnpm build && pnpm generate:skills`）
- `AGENTS.md`：修改守则补充"引用单一源"与"元数据字段不含 version"约定（若必要）

### 向后兼容

- **引用修复与共享常量收敛**：只改变生成产物正文中的引用字符串与白名单的构造来源，值语义不变（除两处断链由错误 id 修正为正确 id，属预期修复）。
- **`metadata.version` 移除**：`iagent update` 的手改保护基于内容指纹自洽比对（`update.ts` 的 `isUnmodified` = `recorded === fingerprintOf(existing)`），与模板内容无关——存量产物移除 version 后仍判为"未手改"，`iagent update` 正常覆盖升级，**不需要 `--force`**。
- **未知名引用策略**：`rewriteCommandRefs` 对未知名保持原样，故新模块落地不会静默改写用户/历史内容；未知名由测试在源码侧拦截，而非运行时改写。
- **[待确认]** Pi 侧改写目标形式（`/iagent-<id>`）为假设，若 Pi 实际支持 `/iagent:<id>` 命名空间调用则仅 namespace-dir 需改写（design.md D2 记录）。
