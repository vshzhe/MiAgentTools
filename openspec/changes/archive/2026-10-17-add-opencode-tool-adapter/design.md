## Context

- **三层适配架构**：`AI_TOOLS`（`src/core/config.ts`）声明工具与落点 → `ToolCommandAdapter` + `CommandAdapterRegistry`（`src/core/command-generation/`）负责指令格式化 → `command-artifacts.ts` 是布局与归属的单一来源（`namespace-dir` / `prefixed-file`）。`init`/`update`/`generate`/`reconcile`/`uninstall`/旧装机迁移/项目预扫描均遍历 `AI_TOOLS` 自动覆盖。
- **既有工具**：claude（`namespace-dir`）、pi（`prefixed-file`）、codex（skills-only）。新增工具的正常成本应仅「配置表一条 + 适配器一个 + 注册导出」，其余边界自动继承（见 `openspec/explorations/opencode-tool-adapter-explore-001.md`）。
- **OpenCode 事实**（回源核对，2026.2.0 / opencode 2.0.31）：技能目录 `.opencode/skills/<name>/SKILL.md`（同时兼容 `.opencode/skill/`、`.claude/skills/`、`.agents/skills/`）；指令目录 `.opencode/commands/**/*.md`（兼容单数 `.opencode/command/`），指令名 = 相对 `commands/` 的路径去 `.md`；指令 frontmatter 认 `description/agent/model/subagent`；正文仅通过 `$ARGUMENTS` / `$1` 接收参数。`Skill.Name` 无连字符正则校验（`Schema.String`），未知顶层字段被静默丢弃。
- **用户约束**：opencode 可配置（opt-in）；权限载体按 OpenCode 实际处理。

## Goals / Non-Goals

**Goals**

- 新增 OpenCode 适配：`.opencode/skills/` 技能 + `.opencode/commands/iagent-<id>.md` 扁平前缀指令。
- opencode 为 opt-in：未配置不生成、显式配置才生成，且 `generate` 同样尊重。
- OpenCode 指令正文可接收用户参数（`$ARGUMENTS` 注入）。
- 会话级权限载体按工具适用性开关，OpenCode 不写惰性文件。
- 默认工具集行为零变化（claude/pi/codex 产物与权限载体不变）。

**Non-Goals**

- 不实现 `opencode.json` 的 `permission` 段权限映射（Claude 风格条目无法无损翻译；另立变更）。
- 不为 Claude/pi/codex 引入新的权限载体差异（保持既有行为）。
- 不改技能模板正文、白名单、确认门、阶段行为与委派面（本变更零模板语义变化）。
- 不改 OpenCode 的 MCP/插件集成（`dependencies.ts` 的 CodeGraph 注入不在本次范围）。

## Decisions

### D1: 指令布局用 `prefixed-file`（`.opencode/commands/iagent-<id>.md`）

- **选择**：`commandsDir='.opencode/commands'`、`commandsLayout='prefixed-file'` → `/iagent-<id>`。
- **理由**：OpenCode 递归扫描 `.opencode/commands/**/*.md` 并以相对路径作为指令名；`namespace-dir` 会得到 `iagent/spec-apply` 这类嵌套名，TUI 可寻址性差。`prefixed-file` 与 Pi 既有约定一致，`rewriteCommandRefs` 已原生改写 `/iagent:<id>` → `/iagent-<id>`；OpenSpec 亦采用该布局（`opsx-<id>`）。
- **备选**：①`namespace-dir`——嵌套指令名不可靠，弃；②OpenCode 技能 `metadata["opencode/slash"]`——只能得到 `/iagent_<id>` 下划线形式且与指令文件重复，弃。

### D2: 适配器 frontmatter 极简 + `$ARGUMENTS` 注入

- **选择**：frontmatter 仅 `description` + `metadata.generatedBy/generatedFingerprint`；正文在满足条件时注入 `**Provided arguments**: $ARGUMENTS`。
- **理由**：OpenCode 指令只认 `description/agent/model/subagent`，`name/allowed-tools/category/tags` 无意义（会被丢弃）；`metadata` 记账字段保证 `update` 内容指纹手改保护可用（OpenCode 忽略未知键）。参数注入移植 OpenSpec `injectOpenCodeArgs` 语义——仅当无 `$ARGUMENTS`/`$n` 且 `**Input**:` 非 `None required` 时注入，避免重复或对无参指令画蛇添足。
- **备选**：①照抄 claude 全字段——含无效字段，弃；②不注入参数——`/iagent-<id> <topic>` 丢参，弃。

### D3: opt-in 用 `AIToolOption.optIn`，并由 `resolveActiveTools` 统一收口

- **选择**：`optIn?: boolean`（opencode=true）；默认回退改 `allTools.filter(t => !t.optIn)`；`generate` 改用 `resolveActiveTools(undefined, projectConfig?.tools, AI_TOOLS)`。
- **理由**：把「哪些工具属于默认集」表达在配置表单一处，`init`/`update`/`generate` 共用同一解析函数，避免各自硬编码。
- **备选**：①在 `resolveActiveTools` 里硬编码排除 `'opencode'`——第二份真源，弃；②让 opencode 默认生成、靠 `config.yaml` 关闭——与用户「不配置不生成」相悖，弃。

### D4: 会话级权限载体用 `sessionPermissions` 能力开关

- **选择**：`AIToolOption.sessionPermissions?: boolean`（默认 `true`）；opencode=false；`init`/`update` 跳过 `false` 的工具。
- **理由**：OpenCode 权限走 `opencode.json` 的 `permission` 段、默认宽松，`.opencode/settings.json` 不被读取。写它会产生「以为已授权、实际未生效」的误导。`false` 只对 opencode 生效，claude/pi/codex 行为不变。
- **备选**：①强行写 `.opencode/settings.json`——惰性且误导，弃；②映射到 `opencode.json` 的 `permission`——Claude 条目（`mcp__codegraph__*`、`Skill(...)`、`Agent`）到 OpenCode 权限键（`skill`/`task`/`bash`…）无损映射困难，超范围，另立变更。

### D5: 边界收敛到既有遍历

- **选择**：`project-scan` 排除 `.opencode`；`LEGACY_COMMAND_DIRS` 增 `opencode: ''`；`.gitignore` 增 `.opencode/`。
- **理由**：这些是 `AI_TOOLS` 遍历外的显式清单，需手工补齐以免 OpenCode 产物被误采为项目信号或迁移误删。
- **备选**：无（清单是单一源但非从 `AI_TOOLS` 派生，必须显式维护）。

## Risks / Trade-offs

- **OpenCode 版本演进**：`opencode/slash`、`permission` 等接口仍在演进（2.0.x）。本变更只用稳定的 `skills`/`commands` 目录契约；frontmatter 未知字段被静默丢弃，故降级安全。
- **opt-in 误配**：用户配置 `tools` 时须显式写入 `opencode`。CLI `--tools` 帮助文案与 `config.yaml` 注释会明确标注 opt-in，避免困惑。
- **generate 行为收敛**：`generate` 由「全部工具」改为「生效工具集」，在显式配置 `tools` 的项目里会改变安装目标——与本工具既有工具选择语义一致，属预期修正。

## Migration Plan

1. `src/core/config.ts` 加字段与 opencode 条目；`resolveActiveTools` 收口 opt-in。
2. 新建 `opencode.ts` 适配器并注册/导出。
3. `init`/`update` 权限合并按 `sessionPermissions` 跳过；`generate` 改用 `resolveActiveTools`。
4. 边界清单（project-scan / legacy-migration / .gitignore）。
5. 测试：适配器路径/frontmatter/参数注入/指纹、opt-in 默认回退与显式启用、generate 尊重、权限跳过、command-artifacts 边界。
6. 文档与版本：README / AGENTS.md / CHANGELOG / package.json。
7. `pnpm build && pnpm test`；归档。
