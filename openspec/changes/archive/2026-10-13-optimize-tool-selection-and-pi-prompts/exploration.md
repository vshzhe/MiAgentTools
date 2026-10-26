# 探索记录：init/update 工具选择持久化与 Pi prompts 适配

## Background

`iagent` 的目标工具适配链路上存在两个独立缺陷。

### 缺陷 1：工具选择不持久化

- `resolveActiveTools()`（`src/core/project-config.ts:305`）已实现优先级 `--tools` > `config.tools` > 全部工具。
- 但 `runInit()`（`src/commands/init.ts:100`）从不回写 `config.tools`；首次由 `ensureProjectConfig()`
  创建的默认 `config.yaml` 把 `tools` 写成全部三个工具。
- 结果：`iagent init --tools claude` 当次只装 claude，但配置文件仍为 `claude, pi, codex`；
  下一次 `iagent update`（不带 `--tools`）读配置后又把 pi/codex 装回。用户选择被静默推翻。

### 缺陷 2：Pi 指令产物落错目录

- `AI_TOOLS` 中 pi 的 `commandsDir` 为 `.pi/commands`（`src/core/config.ts:85`）。
- `piAdapter.getFilePath()` 生成 `.pi/commands/iagent/<id>.md`（`src/core/command-generation/adapters/pi.ts:18`）。
- 实际仓库中 Pi 的提示词产物位于 `.pi/prompts/`（扁平、命名空间前缀，如 OpenSpec 的 `opsx-*.md`）。
  即 Pi 从 `.pi/prompts/` 加载 prompt 模板，从不读取 `.pi/commands/iagent/`，故 iagent 为 Pi 生成的
  指令从未生效。

## 提示词基线 (Prompt Baseline)

**原始提示词**：优化项目 init update 逻辑，已经适配工具优化；
1、init 初始化选择工具后，后续除非指定工具，否则默认选择后的工具；或者使用 update 自动更新已选择工具，进行适配；
2、pi 工具生成适配，`.pi` 目录实际是 prompts，不是 commands，参考 openspec 逻辑进行生成。

**确认后的提示词基线**：修复 init/update 两处缺陷——(A) 工具选择持久化；(B) Pi 指令改为
`.pi/prompts/` 扁平前缀提示词；(C) 顺带清理存量错误位置。用户对三项分别裁决为：
A = init 回写、update 仅在显式 `--tools` 时回写；B = 跟随 OpenSpec 命名空间前缀 `/iagent-<id>`；
C = 清理旧 `.pi/commands/iagent/`。

## 关键决策 (Decisions)

- **A. 回写规则**：`runInit` 始终回写解析出的显式工具列表；`runUpdate` 仅在显式传入 `--tools`
  时回写，否则只读，避免常规刷新意外改配置。
- **B. Pi 布局**：`commandsDir` 改为 `.pi/prompts`，产物为 `iagent-<id>.md`，frontmatter 仅 `description`，
  调用 `/iagent-<id>`；Claude 仍为命名空间子目录 + 全字段 frontmatter。
- **C. 旧位置清理**：init/update 清理 `.pi/commands/iagent/`（幂等、失败仅告警）。
- **布局单一源**：新增 `core/command-artifacts.ts` 收敛「落点枚举/归属识别/删除」，供
  reconcile、uninstall、legacy 复用；避免 Pi 与 OpenSpec 共目录时误删 `opsx-*` 或用户 prompt。
- **旧装机定位**：`legacy-migration.ts` 用显式旧指令根常量（claude→`.claude/commands`、
  pi→`.pi/commands`）替代对 `tool.commandsDir` 的依赖，否则 Pi 的 `commandsDir` 变更会让
  venus 旧产物清理失效。

## Codebase Findings

### Discovered Files

- `src/core/config.ts`：`AIToolOption`、`AI_TOOLS`、`TOOL_COMMANDS_SUBDIR`（身份 token 单一来源）。
- `src/core/project-config.ts`：`resolveActiveTools`（优先级解析）、`writeToolsToConfig`（段替换回写）、
  `defaultConfigFileContent`（默认配置，含 `tools` 段）。
- `src/commands/init.ts`：`runInit`，技能/指令生成与配置创建顺序。
- `src/commands/update.ts`：`runUpdate`，手改指纹保护与指令刷新。
- `src/core/command-generation/adapters/pi.ts`：`getFilePath` / `formatFile`（路径与 frontmatter）。
- `src/core/command-generation/adapters/claude.ts`：对照参照（命名空间子目录布局）。
- `src/core/reconcile.ts`：`scanReconcileOrphans`（孤立产物扫描）。
- `src/commands/uninstall.ts`：`runUninstall`（产物删除与安全边界）。
- `src/core/legacy-migration.ts`：`detectLegacyArtifacts` / `cleanLegacyArtifacts`（旧产物定位与清理）。
- `README.md`：工具表、工具选择配置、架构图、Pi 调用示例。

### Identified Symbols

- `resolveActiveTools`（project-config.ts:305）：工具集优先级解析。
- `writeToolsToConfig`（project-config.ts）：`tools` 段替换回写（已存在，可直接复用）。
- `ensureProjectConfig`（project-config.ts）：首次创建 `.iagent/` 与默认配置。
- `piAdapter.getFilePath`（pi.ts:18）：Pi 指令路径（当前错误位置）。
- `scanReconcileOrphans`（reconcile.ts）：按 `commandsDir + TOOL_COMMANDS_SUBDIR` 扫描。
- `runUninstall`（uninstall.ts:100）：`rmSync` 命名空间目录。
- `cleanLegacyArtifacts`（legacy-migration.ts:640）：依赖 `tool.commandsDir` 定位旧 venus 指令。
- `deriveCommandId`（templates/registry.ts）：指令 id 派生（本次不变）。

### Evidence Points

- `.pi/prompts/opsx-*.md` 存在且 frontmatter 仅 `description`（`.pi/prompts/opsx-apply.md` 首 3 行）。
- `.pi/settings.json` 只有 `permissions` / `defaultTools`，无 `prompts` 资源声明 → Pi 采用约定目录。
- `.claude/commands/iagent/pwd.md` 与 `.claude/commands/opsx/apply.md` 为全字段 frontmatter，佐证两工具格式差异。

## 边界与错误条件 (Boundaries)

- Pi 目录与 OpenSpec/用户 prompt 混放：归属识别必须严格按 `iagent-` 前缀，且不删除承载目录。
- `.iagent/config.yaml` 不存在或 `tools` 为空：回退为全部工具。
- 非法工具 id：`resolveActiveTools` 抛错并列出合法值。
- 旧 `.pi/commands/iagent/` 不存在：清理无动作，主流程不中断。
- 清理失败/权限异常：降级为告警，MUST NOT 阻断 init/update。

## Pending

（空）以上决策均已由用户裁决并锁定，无遗留待确认项。

## 备注

本次为工具链/配置改造，**无业务功能流程**，故不含 `## 功能流程图` 段（评分维度 D10 相应 SKIP）。
