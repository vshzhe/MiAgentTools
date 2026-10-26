## Context

### 现状链路

```
src/core/templates/workflows/*.ts        27 个技能模板 + 27 个指令模板（唯一真源）
  ├─ SkillTemplate.allowedTools          技能白名单（必填，frontmatter allowed-tools）
  └─ CommandTemplate                     无 allowedTools 字段
        ↓ generator.ts
        ↓ adapters/claude.ts:14,27       ← 指令白名单硬编码 `Bash(venus:*)`
  产物：
    skills/<name>/SKILL.md               静态快照（入库，git/npm 分发）
    .claude/skills|commands/             本机安装产物（.gitignore 排除）
```

### 三处结构性缺口（实测）

1. **指令白名单硬编码**：`claude.ts` 导出常量 `VENUS_CLI_ALLOWED_TOOLS = 'Bash(venus:*)'`，`formatFile()` 对全部 27 个指令一律写死。`CommandContent` 类型无 `allowedTools` 字段，适配器无从取得配对技能的白名单。→ 经 `/venus:*` 执行时 `Read`/`Grep`/`Glob`/MCP/Skill 全部弹窗。
2. **MCP 未列入**：正文调用 `mcp__codegraph__*`（`tr-impl-workflow` 35 处、`tr-impl-debug` 23 处、`tr-impl-auto-workflow` 16 处）、`mcp__plugin_semgrep_semgrep__*`、`mcp__llm-wiki__*`；白名单仅含 CLI 形态 `Bash(codegraph:*)`。**MCP 工具名与 CLI 名是两套命名，后者不覆盖前者。**
3. **`Skill` 委派未列入**：`tr-impl-genfull` 委派 8 个子技能、`tr-impl-auto-workflow` 5 个、`tr-impl-debug` 1 个，白名单无任何 `Skill(...)` 条目。

### 存量漂移

- `tr-impl-auto-workflow` 正文要求派发子代理（1.2.1.5 多项目扫描、Phase 4 批调度），但白名单无 `Task`/`Agent`——历史决策曾记「auto-workflow 含 Agent」，实测已丢失。
- `openspec/CONTEXT.md` 记 workflow「共 23 个」，实测 27。

### 权限语法核查结论（决定设计形态的关键事实）

| 事实 | 影响 |
| :--- | :--- |
| `allowed-tools` 的授权**仅覆盖调用当轮**，用户下一条消息即释放，无会话级效力 | 单靠技能 frontmatter 无法覆盖跨轮次管线 → **必须**增设会话级载体 |
| 整服务器 MCP 放行（裸 `mcp__codegraph` 与 `mcp__codegraph__*`）存在多处「不自动放行」报告，仅逐工具全名被稳定支持 | → **双写**裸形式 + 具名工具 |
| `Skill(*)` 在多个 settings 载体上被报不可靠；`Skill(<名>)` 精确匹配本地技能（不加 `plugin:` 前缀） | → **逐技能精确枚举** |
| 派发工具 v2.1.63 由 `Task` 更名 `Agent`，旧名仍作别名 | → **双写** `Agent, Task` |
| `allowed-tools` 是**放行清单而非限制**：未列出者仍可调用，只是需审批 | 只读技能的「无 Write/Edit」是**软约束**（降低自动写文件能力），本次不削弱它 |
| 存在「技能 `allowed-tools` 对 Bash 授权不生效」的 bug 报告，绕过方式是写入全局 `permissions.allow` | 再次支持双载体 |

## Goals / Non-Goals

**Goals**:

- 消除**非确认门**的工具级权限弹窗：技能间 Skill 委派、CodeGraph MCP 调用、Grep/Glob/Read 检索、子代理派发在管线中连续自动执行。
- 把指令白名单从硬编码改为**配对继承**，使技能与指令的白名单同源，消除 27 份重复维护。
- 增设**会话级**权限载体（`.claude/settings.json`），覆盖跨轮次场景。
- 修复 `tr-impl-auto-workflow` 的派发条目漂移与 `CONTEXT.md` 术语陈旧。

**Non-Goals**:

- **不扩大**任何技能的 `Write` / `Edit` / `Bash(...)` 授权面（护住只读技能语义约束）。
- **不改** `src/commands/generate.ts:73` 骨架技能的裸 `Bash`（存量行为，记入后续评估）。
- **不改** frontmatter 字段名与语法格式（沿用逗号分隔字符串）。
- **不新增** CLI 子命令（权限写入内联到 `init` / `update`）。
- **不改**任何对话级确认门的语义或出口。

## Decisions

### D1: 白名单新增条目的组织方式

- **选择**: 新增共享常量模块 `src/core/templates/tool-whitelist.ts`，导出 `CODEGRAPH_MCP`（裸形式 + 9 具名工具，共 10 条的常量串）、`SUBAGENT_DISPATCH = 'Agent, Task'`，以及 `skillDelegation(names: readonly string[]): string`（产出 `Skill(a), Skill(b)`）。模板以模板字符串拼接：`` `Read, Write, ..., ${CODEGRAPH_MCP}, ${SUBAGENT_DISPATCH}` ``。
- **理由**: `CODEGRAPH_MCP` 需在 8+ 个技能中重复（10 个条目），手写 8 遍必然漂移；`skillDelegation` 消除 `Skill(...)` 条目的拼接错误。仅 1 个模块 + 3 个导出，无额外抽象层。
- **备选**: ① 在 27 个模板手写全部条目——重复且易漂移，否决；② 设计 `composeAllowedTools(base, options)` 组合函数——对「字符串拼接」这一动作引入不必要的 API 面，否决；③ 由 `SkillTemplate` 增加结构化字段（`mcpServers` / `delegatedSkills` / `spawnsSubagent`）再自动合成白名单——表达力更强但改动面扩大数倍（27 个模板全改结构 + 生成器改契约），本次不需要，否决。

### D2: CodeGraph MCP 条目双写

- **选择**: `CODEGRAPH_MCP` 同时含裸 `mcp__codegraph` 与 9 个具名工具（`codegraph_status` / `_files` / `_search` / `_context` / `_node` / `_callers` / `_callees` / `_impact` / `_explore`）。**仅对** `allowedTools` 已含 `Bash(codegraph:*)` 或正文引用 `codegraph_*` 的技能写入。
- **理由**: 整服务器形式有多处失效报告（`__*` 形式约 v2.1.195 后失效；另一处报告裸形式与 `__*` 均不自动放行，仅逐工具全名有效）。双写使任一路径生效即达成目标，未来新增工具仍被裸形式覆盖。冗余成本仅 10 个条目。
- **备选**: ① 仅裸形式——若命中失效报告则诉求落空，否决；② 仅具名枚举——新增工具即失效，需随 CodeGraph 升级反复改 8 个技能，否决；③ 不加 MCP 条目——维持现存弹窗，与诉求相悖，否决。

### D3: 技能间委派条目逐技能精确枚举

- **选择**: 为每个实际委派的子技能写 `Skill(<本地技能名>)`，如 `Skill(venus_spec_apply)`；**不使用** `Skill(*)`。
- **理由**: `Skill(*)` 在多个 settings 载体上被报不可靠，且通配会一次性放行全部技能，与最小权限原则相悖。
- **备选**: `Skill(*)` 一条搞定——不可靠 + 授权面过大，否决。
- **执行约束**: 委派清单 MUST 由**正文逐条人工核准**得出。关键词检索（`grep venus_`）会把散文提及误判为委派（如 `tr-tools` 列举它介绍的技能、`tr-impl-review-proposal` 正文中的 `venus_user` 是业务示例），MUST NOT 直接采信。

### D4: 子代理派发条目按实放行

- **选择**: 写入 `Agent, Task` 两条；**仅**正文确有派发的技能获得。
- **理由**: `Task` 为 v2.1.63 前旧名、`Agent` 为现名，双写兼容不同版本。授权面向子代理传递，整类放行会扩大风险面。
- **备选**: ① 全编排类统一放行——给不派发的技能开了子代理权限，否决；② 仅写 `Agent`（现名）——旧版本用户失效，否决；③ 本次不放行——子代理派发继续弹窗，与诉求相悖，否决。

### D5: 指令白名单改为配对继承

- **选择**: 涉及**三个类型/函数**的联动改动：
  1. `CommandTemplate`（`src/core/templates/types.ts`）新增**可选**字段 `allowedTools?: string` —— 作为回填容器。
  2. `registry.ts` 在处理 `WORKFLOW_PAIRS` 时统一回填 —— `getCommandTemplates()` 返回 `{ template: { ...command, allowedTools: skill.allowedTools }, id }`。
  3. `CommandContent`（`src/core/command-generation/types.ts`）新增**必填**字段 `allowedTools: string`；`claude.ts` 的 `formatFile` 读取 `content.allowedTools`，删除 `VENUS_CLI_ALLOWED_TOOLS` 常量。

  **为何两处必填性不同（实现期修正）**: `CommandTemplate` 设为**可选**——27 个指令模板工厂（`getXxxCommandTemplate()`）各自返回字面量、**彼此不知道配对技能**，设必填会让 27 处工厂集体类型报错，迫使把白名单复制 27 份（第二份真源，必然漂移）。可选 + registry 单点回填才是正确形态。`CommandContent` 设为**必填**——它是生成器的输入，是「白名单必须存在」的强制点，可选会为「缺失白名单」这一本次要修的缺陷留门。

  调用侧：`init.ts` 的 `buildCommand` 参数类型补 `allowedTools` 并透传；`update.ts` 的 `CommandContent` 字面量补该字段。
- **理由**: 指令正文是技能正文的压缩派生版（`deriveCommandContent` 只做裁剪），故技能白名单**必然是**指令所需白名单的超集，继承在语义上正确且安全。回填集中在 `getCommandTemplates()` 一处，避免 27 行逐一改动。
- **为何需要 `CommandTemplate` 也带字段（复查阶段补正）**: `init.ts` / `update.ts` 的指令循环是 `for (const { template, id } of getCommandTemplates(...))` —— **循环体内拿不到配对技能**。回填值必须随 `CommandTemplate` 一并从 `getCommandTemplates()` 传出，否则设计无落点。原表述遗漏了这一层，实现时会出现「无处回填」的死角。
- **影响面核验**: `test/template-derivation.test.ts:30` 断言 `command?.content === deriveCommandContent(skill.instructions)`，仅比较 `content` 字段，新增字段不影响；`test/subagent-resource-sharing.test.ts:32` 仅读 `template.content`，同样不受影响。
- **备选**: ① 为 `CommandTemplate` 增加独立 `allowedTools` 字段、由 27 个指令模板工厂各自声明——产生第二份真源，必然漂移，否决；② 保留常量但把常量值改为全量并集——丧失逐技能最小权限，且与只读技能约束冲突，否决。
- **兼容**: 字段设为必填而非可选——「缺失白名单」正是本次要修的缺陷，可选字段会为回归留门。`generate.ts` 的骨架技能走 `SkillTemplate` 路径而非 `CommandContent`，不受影响。
- **存量刷新路径已核验无阻（复查阶段确认）**: `venus update` 对 SKILL.md 走指纹判定——`isUnmodified(existing)` 比较「文件内记录的 `generatedFingerprint`」与「该文件内容的实际指纹」，二者相等即判定为**未被手改**，随即用新内容覆盖（`update.ts:188-191`、`:113-118`）。故模板白名单变更后，存量项目执行 `update` 即可获得新白名单，**无需 `--force`**。指令侧更简单——无手改保护，`existing !== generated.fileContent` 即重写（`update.ts:142-159`）。

### D6: 会话级权限载体（`.claude/settings.json`）

- **选择**: 新增 `src/core/permissions.ts`，导出两个纯函数式能力：
  - `buildPermissionEntries(skillTemplates): string[]` —— 从已安装技能模板的 `allowedTools` 拆分、去重、**过滤全量放行条目**（`Bash(*)`、裸 `*`）后得到的条目集，保证与 frontmatter 同源。
  - `mergePermissions(projectRoot, entries): MergeResult` —— 读 `.claude/settings.json` → 并入 `permissions.allow` → 去重 → 写回。返回 `created` / `merged` / `preserved-invalid` 状态供输出与测试断言。

  由 `runInit` 与 `runUpdate` 调用，结果并入各自的结果类型供输出提示。
- **理由**: 技能 frontmatter 的授权仅覆盖当轮，跨轮次管线（auto-workflow 的 Phase 1→5、genfull 的 Stage 1→4）必须依赖会话级放行。落点在 `init` + `update` 两处：`init` 保证新项目开箱可用，`update` 保证存量项目升级后获得新增条目。
- **过滤全量放行条目的理由**: 并集会把 `tr-impl-frontend` 的 `Bash(*)` 抬升为**项目级全量 bash 放行**——该条目在技能 frontmatter 中仅作用于该技能（现状），在 settings.json 中则作用于整个会话，性质完全不同。故 settings.json 层 MUST 过滤之（frontmatter 层保持原样，属存量行为不在本变更范围）。
- **备选**: ① 仅 `init` 写——存量项目升级后拿不到新条目，否决；② 新增 `venus permissions` 子命令手动触发——与「自动执行」诉求相悖，且用户已决策内联，否决；③ 直接覆写 `settings.json`——会摧毁用户自定义配置与 `deny` 段，否决。
- **安全边界**: 不删除用户既有 `allow` 条目、不触碰 `deny`/`ask`、既有文件非法 JSON 时保留原文件并 WARN、幂等。

### D7: 不扩大授权面

- **选择**: 本次只新增「调用类」条目（MCP / `Skill(...)` / `Agent, Task`）。各技能既有的 `Write` / `Edit` / `Bash(...)` 条目**数量与内容均不变**。
- **理由**: 白名单同时承载语义约束——`venus_spec_verify_proposal` 以「不含 Write/Edit」表达**只读评分**意图。虽然权限语法上 `allowed-tools` 是放行清单而非限制（未列出者仍可调用、只是需审批），但「不主动放行写操作」实质降低了自动写文件的可能，该意图应予保全。
- **备选**: 顺带按扫描告警补齐各技能漏列的 Bash 条目——修得更彻底但扩大改动面与回归风险，且与诉求无关，否决。

### D8: 测试策略

- **选择**:
  - 扩展 `test/allowed-tools.test.ts`：新增硬断言——引用 `codegraph_*` 的技能含 `mcp__codegraph` 与具名条目；有委派的技能含对应 `Skill(...)`；有派发的技能含 `Agent` 与 `Task`；**不存在** `Skill(*)` 通配；只读技能（`venus_spec_verify_proposal` / `venus_spec_verify`）不含 `Write`/`Edit`；指令白名单与配对技能一致。
  - **只读技能身份修正（实现期核验）**：只读者是 `venus_spec_verify_proposal`（`Read, Glob, Grep, Bash(venus:*)`）与 `venus_spec_verify`（`Bash(venus:*), Read, Glob, Grep`）。**`venus_spec_archive` 实际含 `Write`/`Edit`**（`Read, Write, Edit, Glob, Grep, Bash(venus:*), Bash(codegraph:*), Bash(ls:*)`）——探索 F6 与上下文包曾误把它列为只读，已更正；其现状按「不扩大授权面」原则维持不动。
  - 新增 `test/permissions.test.ts`：覆盖「全新创建 / 既有保留 / 去重幂等 / 非法 JSON 不覆盖 / 过滤 `Bash(*)`」五条路径。
  - 更新 `test/generation.test.ts`（`:64` 的原硬断言 `allowed-tools: Bash(venus:*)` 改写；`:52-62` 手工构造的 `CommandContent` 补 `allowedTools` 字段——字段改必填后此处编译期报错）与 `test/commands.test.ts`（原**无** `allowed-tools` 断言，属新增「指令白名单等于配对技能」端到端覆盖）。
- **理由**: 白名单是**放行清单**，条目缺失是静默失败（运行时才弹窗），必须由测试拦截；而正文命令扫描维持「仅告警」以不阻断无关改动（存量历史缺口）。
- **经核验不受影响**: `test/subagent-resource-sharing.test.ts` 仅读 `getCommandTemplates().template.content`，不触碰 frontmatter；`test/templates.test.ts` 只校验门文本，二者均无需改动。
- **备选**: 只靠正文扫描告警——静默失败无拦截力，否决。

### D9: 快照 / 文档 / 版本同步

- **选择**: 模板改动后依次 `pnpm build && pnpm generate:skills`（AGENTS.md 守则 1）；同步 `docs/skills-manual.md`（20+ 处）、`docs/genfull-guide.md`、`docs/migration-suite-guide.md`、`AGENTS.md` 守则 2；`openspec/CONTEXT.md` 修正 workflow 计数 23 → 27；`package.json` `1.6.0 → 1.7.0`，CHANGELOG 归档 `[Unreleased]`。
- **理由**: 守则 1/2/8 为仓库既有强制约束；文档逐技能硬列白名单，不同步即产生文档与产物漂移。
- **备选**: 文档改为引用模板单一源而不列举——属文档体系重构，超出本变更范围，否决。

## Risks / Trade-offs

| 风险 | 缓解 |
| :--- | :--- |
| **授权面扩张本身即安全风险**——本次主动扩大 AI 在目标项目中的免审批权限 | D7 只补调用类条目、D3 逐技能枚举（非 `Skill(*)`）、D4 仅对确有派发的技能放行、D6 过滤全量放行条目；四点共同保证「只放行正文实际会做的事」 |
| **`Skill(...)` 委派清单误判**——关键词检索把散文提及当委派，导致白名单过宽 | D3 强制逐条人工核准，并在 design 与 tasks 中明示 MUST NOT 采信 grep 结果 |
| **`Agent, Task` 授权向子代理传递**，子代理可发起进一步调用 | D4 限定范围 + 不扩大写类授权；子代理继承的仍是同一套条目 |
| **MCP 双写仍可能全部失效**（若两个形式在某版本同时不生效） | 回退路径存在：Claude Code 的 `/permissions` 可查实际生效规则；失效时仅表现为弹窗（功能降级，不损坏） |
| **`settings.json` 合并损坏用户配置** | D6 非破坏语义：不删既有条目、不碰 `deny`、非法 JSON 不覆盖、幂等；并由 `test/permissions.test.ts` 五路径覆盖 |
| **并集抬升 `Bash(*)` 为项目级全量放行** | D6 在 settings.json 层显式过滤全量放行条目 |
| **快照/文档漂移** | D9 与 `test/skills-parity.test.ts` 拦截；文档同步列入 tasks |
| **只读技能被无意扩权**（未来维护者顺手统一白名单） | D7 + D8 新增「只读技能不含 Write/Edit」硬断言，形成回归拦截 |
| **`CONTEXT.md` 术语修正属附带改动**，可能被视为范围蔓延 | 已获用户显式确认；改动为单词级计数修正，风险极低 |
