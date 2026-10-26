# Proposal

## Why

两个初始化/更新链路的缺陷导致用户选择失效、目标工具产物落错位置：

1. **工具选择不持久化**：`iagent init --tools <ids>` 只在当次生效，`runInit` 从不回写
   `.iagent/config.yaml` 的 `tools` 字段；而 `ensureProjectConfig` 首次创建配置时把 `tools`
   写成全部工具。结果是用户显式排除的工具会在下一次 `iagent update` 被静默重新安装。
2. **Pi 指令从未被加载**：当前适配器把指令生成到 `.pi/commands/iagent/<id>.md`，但 Pi 实际
   从 `.pi/prompts/` 加载 prompt 模板（扁平、前缀命名，如 OpenSpec 的 `opsx-<id>.md`）。
   落错目录的产物永远不可见。

## What Changes

- `iagent init` 将解析后的目标工具集回写 `.iagent/config.yaml` 的 `tools` 字段，使选择持久化。
- `iagent update` 仅在显式传入 `--tools` 时回写该字段，避免常规刷新意外改动配置。
- Pi 指令产物改为 `.pi/prompts/iagent-<id>.md`（扁平、`iagent-` 命名空间前缀），frontmatter
  精简为 `description`，对齐 OpenSpec 的 Pi prompt 形态。
- `AI_TOOLS` 引入指令布局标识（`namespace-dir` / `prefixed-file`）；`reconcile`、`uninstall`
  与旧产物清理按布局只处理本工具命名产物——Pi 场景下 MUST NOT 触碰同目录的 `opsx-*` 或
  用户自建 prompt。
- `init` / `update` 顺带清理存量错误位置 `.pi/commands/iagent/`。
- 指令 id 派生规则与技能产物路径不变。

## Capabilities

### New Capabilities

- `ai-tool-selection`: 目标 AI 工具集的选择、解析与持久化语义——`config.tools` 与 `--tools`
  的优先级、init/update 的回写规则，以及未配置时的缺省行为。

### Modified Capabilities

- `agent-tool-identity`: 指令产物布局从"统一命名空间子目录"扩展为按工具区分
  （Claude 命名空间子目录 / Pi prompts 扁平前缀文件）；reconcile、uninstall 与旧产物清理的
  边界随之收紧为仅触碰 `iagent-*` 命名产物，并新增对 `.pi/commands/iagent/` 旧位置的清理。

## Impact

- `src/core/config.ts`：`AIToolOption` 新增指令布局字段；Pi 的 `commandsDir` 改为 `.pi/prompts`。
- `src/commands/init.ts` / `src/commands/update.ts`：工具集回写规则。
- `src/core/project-config.ts`：默认配置注释与 `writeToolsToConfig` 复用。
- `src/core/command-generation/adapters/pi.ts`、`types.ts`、`adapters/registry.ts`：Pi 适配器
  路径与 frontmatter 格式。
- `src/core/reconcile.ts`、`src/commands/uninstall.ts`：布局感知的扫描/删除与安全边界。
- `src/core/legacy-migration.ts`：旧 Pi 指令目录定位常量与清理。
- `README.md`、`AGENTS.md`、`CHANGELOG.md`、`package.json`（版本号）、`skills/` 快照。
- 测试：`test/generation.test.ts`、`test/commands.test.ts`、`test/legacy-migration.test.ts`
  及 reconcile/uninstall 相关用例。
