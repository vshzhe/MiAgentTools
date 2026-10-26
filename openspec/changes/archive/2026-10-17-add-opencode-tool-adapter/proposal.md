## Why

现有工具适配是三层架构（`AI_TOOLS` 配置 → `ToolCommandAdapter` 适配器注册表 → `command-artifacts` 布局单点），已支持 Claude Code、Pi、Codex 三个目标工具。用户要求在此基础上新增 **OpenCode**（SST/Anomaly 开源的终端与桌面 AI 编码 Agent，本机 2.0.31）适配。

经回源核对 OpenCode 官方文档与上游源码（`packages/core/src/config/plugin/{skill,command}.ts`、`skill-file.ts`、`@opencode/schema`）：

1. OpenCode 原生支持 Agent Skills（`.opencode/skills/<name>/SKILL.md`）与自定义斜杠指令（`.opencode/commands/**/*.md`），与既有 `skillsDir`/`commandsDir`+布局模型天然契合。
2. OpenCode 的指令名 = 相对 `commands/` 的路径去 `.md`，故采用扁平 `prefixed-file` 布局（`.opencode/commands/iagent-<id>.md` → `/iagent-<id>`）最贴合其语义，并与 Pi 既有约定一致；OpenSpec 亦采用该布局（`.opencode/commands/opsx-<id>.md`）。
3. OpenCode 指令正文**只在显式占位符处接收参数**（`$ARGUMENTS` / `$1`）。既有指令正文使用 `**Input**:` 契约但不含占位符，需在适配器生成期注入，否则 `/iagent-<id> <参数>` 的参数会丢失（OpenSpec 已有同款处理）。
4. OpenCode 技能 frontmatter 的 `name` 为无约束字符串（`Skill.Name` = `Schema.String`），`iagent_*` 下划线命名可正常加载；未知顶层字段被静默丢弃、不报错。
5. OpenCode 的会话权限走 `opencode.json` 的 `permission` 段（与 Claude 的 `permissions.allow` 语法不同），且默认宽松（多数动作默认 `allow`）。故对 OpenCode **MUST NOT** 写 `.opencode/settings.json` 这一惰性载体。

用户明确要求：OpenCode 设为**可配置（opt-in）**——配置则生成、不配置不生成；会话级权限载体按 OpenCode 实际情况处理。

## What Changes

1. **新增 OpenCode 工具条目（opt-in）**：`AI_TOOLS` 追加 `opencode`，`skillsDir='.opencode'`、`commandsDir='.opencode/commands'`、`commandsLayout='prefixed-file'`，并标记 `optIn`。`resolveActiveTools` 的「未配置回退」MUST 排除 opt-in 工具，即未显式配置时不生成 `.opencode/` 产物；`--tools opencode` 或 `config.yaml` 的 `tools` 含 `opencode` 时才生成。
2. **新增 OpenCode 指令适配器**：`src/core/command-generation/adapters/opencode.ts`。`getFilePath` 走 `commandFilePath('opencode', id)`（复用布局单点）；`formatFile` 输出 OpenCode 官方极简 frontmatter（`description` + 记账用 `metadata`），并注入 `**Provided arguments**: $ARGUMENTS`（当正文无参数占位符且非 `None required` 时）。
3. **适配器注册与导出**：`CommandAdapterRegistry` 注册 `opencodeAdapter` 并统一导出。
4. **会话级权限载体按工具适用性**：新增 `AIToolOption.sessionPermissions`（默认 `true`）。OpenCode 置 `false`——其权限模型是 `opencode.json` 的 `permission` 段且默认宽松，写 `.opencode/settings.json` 属误导性惰性文件。`init`/`update` 的权限合并 MUST 跳过 `sessionPermissions === false` 的工具。
5. **`iagent generate` 尊重工具选择**：安装目标由「全部 `AI_TOOLS`」改为经 `resolveActiveTools` 解析的生效工具集，使 opt-in 语义对 generate 同样成立。
6. **边界收敛**：`project-scan` 的 `EXCLUDED_DIR_NAMES` 增 `.opencode`；`LEGACY_COMMAND_DIRS` 增 `opencode: ''`（OpenCode 无旧 venus 产物）；`.gitignore` 增 `.opencode/`；`config.yaml` 模板注释与 CLI `--tools` 帮助文案同步 opt-in 说明。
7. **测试与文档**：新增 OpenCode 适配器/opt-in/权限跳过回归测试；更新 README、AGENTS.md、CHANGELOG 并递增版本号。

## Capabilities

### New Capabilities

- `opencode-tool-adapter`: OpenCode 工具与指令适配——工具注册（`.opencode/skills`、`.opencode/commands` 扁平前缀布局）、指令 frontmatter 与 `$ARGUMENTS` 参数注入、会话级权限载体不适用、扫描排除。

### Modified Capabilities

- `ai-tool-selection`: 引入**可选（opt-in）工具**语义——未配置时的默认回退 MUST 排除 opt-in 工具；显式配置或 `--tools` 指定才纳入生效集；`iagent generate` 亦按生效工具集安装。

## Impact

### 直接影响的文件

- `src/core/config.ts`：`AI_TOOLS` 增 opencode 条目 + `AIToolOption` 增 `optIn` / `sessionPermissions` 字段
- `src/core/project-config.ts`：`resolveActiveTools` 默认回退过滤 opt-in；`config.yaml` 模板注释
- `src/core/command-generation/adapters/opencode.ts`：新建
- `src/core/command-generation/adapters/registry.ts`、`src/core/command-generation/index.ts`：注册与导出
- `src/commands/init.ts`、`src/commands/update.ts`：权限合并按 `sessionPermissions` 跳过
- `src/commands/generate.ts`：按 `resolveActiveTools` 安装
- `src/core/legacy-migration.ts`：`LEGACY_COMMAND_DIRS` 增 `opencode: ''`
- `src/core/project-scan.ts`：`EXCLUDED_DIR_NAMES` 增 `.opencode`
- `src/cli/index.ts`：`--tools` 帮助文案
- `test/`：新增/更新回归
- `.gitignore`、`README.md`、`AGENTS.md`、`CHANGELOG.md`、`package.json`

### 向后兼容

- **默认行为不变**：opencode 为 opt-in，未配置的项目 `iagent init/update` 产物与现状完全一致（仍为 claude/pi/codex）。
- **已有工具不受影响**：`optIn` 默认 `false`、`sessionPermissions` 默认 `true`，claude/pi/codex 行为零变化（含权限载体照写）。
- **`iagent generate` 行为收敛**：由「安装到全部工具」改为「安装到生效工具集」。未配置工具的项目回退集仍含 claude/pi/codex，故既有路径产物不变；仅在显式配置了 `tools` 的项目中不再向被排除工具安装（与本工具既有选择语义一致）。
