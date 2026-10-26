# 提案：全流程工具调用白名单自动化

## Why

venus 技能与斜杠指令在 Claude Code 中运行时，**除对话级确认门之外的每一次工具调用都会触发权限弹窗**，把本应连续执行的全自动管线（auto-workflow / genfull / debug 等）切成碎片。实测根因不是零散遗漏，而是白名单机制的**三处结构性缺口**：

1. **27 个斜杠指令的白名单被硬编码为 `Bash(venus:*)`** —— 适配器 `claude.ts` 无视配对技能已有的完整白名单，一律写死单一 CLI 条目。通过 `/venus:*` 执行时，`Read` / `Grep` / `Glob` / MCP / Skill 全部触发弹窗。
2. **MCP 调用未列入任何白名单** —— 正文实际调用 `mcp__codegraph__*`（还有 `mcp__plugin_semgrep_semgrep__*`、`mcp__llm-wiki__*`），而白名单只有 CLI 形态 `Bash(codegraph:*)`。**MCP 工具与 CLI 是两套工具名**，前者不被后者覆盖。
3. **技能间 `Skill` 委派未列入任何白名单** —— genfull 委派 8 个子技能（via Skill tool）、auto-workflow 委派 5 个、debug 委派 1 个，均无对应条目。

存量还有两处漂移：`tr-impl-auto-workflow` 正文要求派发子代理却无 `Task`/`Agent` 条目；`CONTEXT.md` 术语表记 workflow「共 23 个」而实测 27。

为什么是现在：上一轮变更引入了「子代理派发资源共享协议」与「多阶段委派编排」，委派密度显著上升 —— 白名单缺口从「偶发打断」升级为「每条管线必被打断」。同时权限语法核查发现 `allowed-tools` 的授权**仅限调用当轮、下一条用户消息即释放**，因此单靠技能 frontmatter 无法覆盖跨轮次场景，需要补充会话级载体。

## What Changes

### 1. 技能白名单补齐「调用类」条目

27 个技能模板的 `allowedTools` 补齐三类缺失条目，**保持各技能既有的 `Write` / `Edit` / `Bash(...)` 条目不扩大**（护住 `spec-verify-proposal`、`spec-archive` 等只读技能的语义约束）：

- **CodeGraph MCP**：同时写裸形式 `mcp__codegraph` **与** 9 个具名工具（`codegraph_search` / `_status` / `_files` / `_context` / `_node` / `_callers` / `_callees` / `_impact` / `_explore`）。理由：整服务器形式的可靠性存在多处失效报告（见 design.md 决策依据），双写使任一路径生效即达成目标。
- **技能间委派**：`Skill(venus_xxx)` **逐技能精确枚举**（按正文实际委派核准，不用 `Skill(*)`——该写法被报多处不可靠）。
- **子代理派发**：`Agent, Task` 双写（`Task` 为 v2.1.63 前的旧名，仍作别名可用），**仅写入正文确有派发的技能**——授权面向子代理传递，不整类放行。

### 2. 指令白名单由硬编码改为继承配对技能（**核心修复**）

`CommandContent` 增加 `allowedTools` 字段；`registry.ts` 的 `WORKFLOW_PAIRS` 处统一回填配对技能的 `allowedTools`；`claude.ts` 适配器读取该字段而非常量。**指令是技能正文的压缩派生版，白名单亦应派生**，消除 27 份硬编码。

### 3. 新增会话级白名单载体

`venus init` 与 `venus update` 额外**非破坏性合并**写入 `.claude/settings.json` 的 `permissions.allow`（读 → 并入 → 去重 → 写；**不删除**用户既有条目、**不写** `deny`/`ask`；既有文件非法 JSON 时保留原文件并 WARN）。这是必需的补充：技能 frontmatter 的授权仅覆盖调用当轮，跨轮次管线需要会话级放行。

### 4. 存量漂移与文档修正

- 修复 `tr-impl-auto-workflow` 的「正文要求派发子代理但白名单无条目」漂移。
- 同步 `docs/skills-manual.md`（20+ 处硬列白名单）、`docs/genfull-guide.md`、`docs/migration-suite-guide.md`、`AGENTS.md`。
- 修正 `openspec/CONTEXT.md` 术语表 workflow 计数 23 → 27。
- 版本号 `1.6.0 → 1.7.0`，CHANGELOG 归档 `[Unreleased]`。

### 明确不做（记入后续评估）

- **不改** `src/commands/generate.ts:73` 骨架技能的裸 `Bash` 白名单（等价全量放行）——存量既有行为，超出本变更范围。
- **不扩大**任何技能的 `Write` / `Edit` / `Bash(...)` 授权面。
- **不改** frontmatter 字段名与语法格式（沿用逗号分隔字符串）。

## Capabilities

### New Capabilities

- `tool-call-whitelist`: 工具调用白名单的**组合规则与三载体落地**——技能白名单的「基底 + 调用类扩展」组合、指令白名单的配对继承、会话级 `permissions.allow` 的非破坏合并；并约束白名单与正文实际调用的一致性、只读技能授权面不扩大、以及「只消除工具级弹窗、不改对话级确认门」的边界。

### Modified Capabilities

- `tr-workflow-suite-skills`: 编排技能的委派与派发需求补充**白名单齐备性约束**——技能正文经 Skill 工具委派的子技能、以及派发的子代理，MUST 在自身 `allowedTools` 中有对应条目，否则委派在 Claude Code 中被权限拦截而无法执行（`tr-impl-auto-workflow` 现存此缺口，随本变更修复）。

## Impact

### 直接影响的文件

- `src/core/templates/workflows/*.ts`: 27 个技能模板的 `allowedTools` 字段补齐调用类条目
- `src/core/command-generation/types.ts`: `CommandContent` 新增 `allowedTools` 字段
- `src/core/command-generation/adapters/claude.ts`: `formatFile` 改为读取 `content.allowedTools`，移除硬编码常量
- `src/core/templates/registry.ts`: `WORKFLOW_PAIRS` 回填配对技能白名单，`getCommandTemplates` 透传
- `src/commands/init.ts`: 指令生成处传入白名单；新增权限文件合并写入步骤
- `src/commands/update.ts`: 同上（保证存量项目升级后获得新增条目）
- `src/core/permissions.ts`: **新增** —— `.claude/settings.json` 权限白名单的非破坏合并读写
- `scripts/generate-skills.mjs`: 无逻辑改动，须重跑以刷新 `skills/` 快照（27 技能 + 27 指令）
- `test/generation.test.ts`: `:64` 的硬断言 `allowed-tools: Bash(venus:*)` 随继承机制改写；`:52-62` 手工构造的 `CommandContent` 补 `allowedTools` 字段（改必填后编译期报错）
- `test/allowed-tools.test.ts`: 新增 MCP / Skill / Agent 条目齐备性与只读技能不扩权断言
- `test/commands.test.ts`: 新增「指令白名单等于配对技能白名单」端到端断言（原无 `allowed-tools` 断言）
- `test/templates.test.ts`: 新增「确认门文本未被白名单改动侵蚀」断言
- `test/permissions.test.ts`: **新增** —— 权限合并非破坏性五路径覆盖
- `docs/skills-manual.md` / `docs/genfull-guide.md` / `docs/migration-suite-guide.md`: 逐技能白名单列表同步
- `AGENTS.md`: 修改守则 2 补充白名单组合规则与快照刷新要求
- `openspec/CONTEXT.md`: 术语表 workflow 计数修正；视需要补入「工具调用白名单」术语
- `package.json` / `CHANGELOG.md`: 版本号 1.6.0 → 1.7.0 与变更日志归档

### 向后兼容

**非破坏性，无迁移动作。**

- **frontmatter 契约未变**：字段名 `allowed-tools` 与语法格式（逗号分隔规则串）完全沿用，仅**值域扩大**（新增条目）。消费方 `show.ts`（正则读取展示）与 `validate.ts`（仅校验字段存在）均不受影响。
- **不含 BREAKING**：不删技能、不改注册结构、不改 CLI 行为或参数、不改 frontmatter 契约 —— 按 AGENTS.md 守则 8 判定为 **minor**（功能新增/变更）。
- **存量项目**：`venus update` 会连同新条目一起刷新指令与技能；`settings.json` 合并写入为幂等且非破坏，用户既有配置与自定义条目全部保留。
- **降级安全**：`settings.json` 写入失败或既有内容非法时不覆盖原文件、仅 WARN，技能仍可正常安装。
- **不依赖 CodeGraph 可用性**：白名单只是放行清单，CodeGraph 未初始化时技能内已有的 Glob/Grep 回退路径照常工作。
