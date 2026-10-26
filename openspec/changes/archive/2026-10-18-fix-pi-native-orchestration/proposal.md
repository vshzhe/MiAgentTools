## Why

Pi 实际运行中加载技能后不按编排执行，而是分析后直接修改项目。核对确认有三个叠加原因：① 本机 `.pi/` 产物仍为 6.4.0 旧内容（含“探索与提案内联执行”、无宿主适配段），而 `iagent init` 对既有文件是跳过、不会刷新；② 即便刷新，`@tintinweb/pi-subagents` 的 `Agent` 工具需要 `.pi/agents/<name>.md` 定义，当前没有生成任何 Pi agent，正文写的“委派 iagent-spec-explore”无法解析；③ strict 判定只看 npm 包是否安装，未校验原生委派入口是否存在，属于“名义 strict”。此外 Pi 的 `.pi/settings.json` 被写入 Claude 风格的 `permissions.allow`，与 Pi 设置模型不一致。

## What Changes

- Pi 原生编排产物：为编排类 workflow 生成 `.pi/agents/iagent-orchestrator.md` 与阶段 agent（`name` 作为 `subagent_type`，含 `description`/`tools`/`prompt_mode`，嵌套派发由 `allowed_subagents` 授予），使 `@tintinweb/pi-subagents` 的 `Agent` 调用可解析；`tools` 只写上游内置名。
- Pi 委派语义可执行化：生成期在技能/指令正文中给出可执行的委派形态（`Agent({ subagent_type, prompt })`），而非仅自然语言“委派”。
- strict 判定收紧：Pi strict SHALL 同时满足「Pi 版本兼容 + 运行时包已安装 + 原生 agent 定义存在且可解析」；任一缺失即 degraded，并报告缺失项。
- 升级/刷新语义：明确 `iagent init` 不覆盖既有产物；升级后 SHALL 通过 `iagent update`（或 `init --force`）刷新，并在文档与输出中提示。
- Pi 设置不写 Claude 权限载体：`pi` 的 `sessionPermissions` SHALL 为 false，不再把 `permissions.allow` 写入 `.pi/settings.json`。
- 修正过期指令描述：`iagent-workflow` 等指令 description 的“提案内联生成”改为“委派生成”。
- 新增回归：Pi agent 定义生成与 frontmatter 契约、strict 判定三条件、纯生成物重建、orphan 清理、legacy 产物刷新、settings 不写权限段、描述一致性、Windows 路径与 UTF-8 断言。

## Capabilities

### New Capabilities

（无新增能力；本变更在既有宿主编排能力内修复）

### Modified Capabilities

- `host-orchestration`: Pi strict 的可执行委派契约（原生 agent 定义生成 + 可解析 `subagent_type`）与 strict 判定收紧。
- `ai-tool-selection`: Pi 运行时就绪判定纳入原生委派入口；Pi 不写 Claude 会话权限载体。
- `workflow-suite-skills`: Pi realization 由“声明式”改为“可执行委派形态”，并修正指令描述中的内联生成过期表述。

## Impact

### 直接影响的文件

- `src/core/pi-runtime.ts`: strict 判定纳入 agent 定义存在性；新增诊断字段。
- `src/core/host-orchestration/`: Pi 委派动作渲染为可执行 `Agent({ subagent_type })` 形态；新增 Pi agent 模板渲染。
- `src/core/opencode-v2.ts` 同级的 Pi 产物模块（新增 `src/core/pi-native.ts`）: 生成 `.pi/agents/*.md`。
- `src/commands/init.ts` / `update.ts`: 写入 Pi agent 定义；D6 顺序接线；刷新提示与诊断输出。
- `src/commands/uninstall.ts` / `src/core/reconcile.ts`: `iagent-` 前缀 agent 定义的清理与 orphan 统计。
- `src/core/config.ts`: `pi.sessionPermissions = false`。
- `src/core/templates/workflows/`: 修正指令 description 过期表述（按实际命中文件）。
- `README.md` / `AGENTS.md` / `docs/`: 升级刷新语义、Pi agent 定义与 strict 诊断说明。
- `test/pi-native.test.ts`（新增）、`test/pi-runtime.test.ts`、`test/host-orchestration.test.ts`、`test/host-smoke.test.ts`、`test/commands.test.ts`、`test/validate-update.test.ts`、`test/uninstall-show.test.ts`。

### 向后兼容

无破坏性变更。既有 `.pi/skills`、`.pi/prompts` 路径不变；新增 `.pi/agents/` 产物属增量。已生成的旧产物由 `iagent update` 刷新：带 `generatedFingerprint` 的走指纹自洽判定，无指纹的历史产物走 `generatedBy` 版本回退判定，均无需 `--force`。`iagent init` 跳过既有文件的行为保持不变，但文档与输出会明确提示使用 `update`。`.pi/agents/iagent-*.md` 为纯生成物，不设手改保护。
