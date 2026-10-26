# Proposal

## Why

MiAgentTools 当前主要适配了技能与斜杠指令的文件布局，却把 Claude Code 的 `Skill`、`Agent`、`Task`、工具名和确认门语义直接复用到 Pi 与 OpenCode。结果是 Pi 能加载技能但参数丢失、工具调用不匹配、下游委派失败后静默转为当前 agent 本地执行；OpenCode V2 也未使用其原生 `skill`、`subagent`、agents 与 permissions 能力。需要把共享工作流语义与宿主运行时编排能力分离，避免宿主能力缺失时伪装成完整流程。

## What Changes

- 新增宿主无关的共享工作流协议：phase、input、handoff、receipt、gate、retry、required capabilities 与 strict/degraded 策略。
- 新增 Claude Code、OpenCode V2、Pi 的原生编排适配模型：共享模板不再直接写入宿主专属的 `Skill(...)`、`Agent/Task`、MCP 工具名或工具白名单语义。
- **BREAKING（带自动迁移）**：将新生成的外部技能 ID/目录统一为 kebab-case；canonical `workflowId` 采用既有 commandId（如 `spec-explore`），旧 `iagent_<name>` 产物在 init/update 时自动迁移并保留兼容解析。
- OpenCode V2 在项目内生成 `.opencode/agents/`、`.opencode/commands/`、`.opencode/skills/` 与 `.opencode/opencode.jsonc`；使用 V2 的 `skill`、`subagent`、`permissions`、`agent` 与 `subagent` 元数据，不修改用户根目录配置，除非项目级配置无法表达目标能力。
- Pi 初始化默认尝试以项目级方式安装 npm 包 `@tintinweb/pi-subagents` 的 latest 版本；安装成功且能力检测通过时启用 strict 编排。安装失败时继续生成明确标记为 degraded 的产物，并输出告警，不再次阻塞用户。
- Pi degraded 模式明确声明不保证子 agent 委派、阶段回执、严格 gate 与自动推进；不得把本地执行结果标记为 delegated 完成。strict/degraded 选择与运行时状态写入可诊断元数据。
- 保留未来替换 Pi 运行时的 provider 抽象，使后续可替换为 iagent 自有 npm 包而不改变共享协议或宿主适配层。
- 增加能力探测、包安装失败、OpenCode V2 配置生成、Pi 参数传递、宿主工具映射、委派回执、门控与旧下划线产物迁移的回归测试。

## Capabilities

### New Capabilities

- `host-orchestration`: 定义共享工作流协议、宿主能力协商、strict/degraded 行为，以及 Claude Code、OpenCode V2、Pi 原生编排适配的公共契约。

### Modified Capabilities

- `agent-tool-identity`: canonical workflowId 与 kebab-case 外部技能 ID、旧下划线产物自动迁移及兼容解析。
- `ai-tool-selection`: Pi 运行时能力探测、npm Extension 安装状态、strict/degraded 选择与初始化诊断。
- `opencode-tool-adapter`: OpenCode V2 项目级 agents、commands、skills、permissions 生成，以及 V2 原生 `skill` / `subagent` 语义。
- `workflow-suite-skills`: 共享协议驱动的阶段委派、handoff、receipt、gate 与能力缺失处理，移除宿主专属内联编排语义。

## Impact

- 生成与适配层：`src/core/command-generation/`、`src/core/command-artifacts.ts`、`src/core/config.ts`、`src/core/templates/`。
- 工作流与运行时：`src/commands/init.ts`、`src/commands/update.ts`、`src/core/project-config.ts`、遗留迁移与配置写入逻辑。
- OpenCode V2 项目产物：`.opencode/agents/`、`.opencode/commands/`、`.opencode/skills/`、`.opencode/opencode.jsonc`。
- Pi 项目运行时：项目级 Pi package 安装记录、Extension 能力检测、strict/degraded 产物与诊断；Pi Extension 本身由 npm 包提供，不作为本仓库运行时代码内嵌。
- 测试、静态技能快照、文档、版本号与变更日志均需同步。
- 外部依赖风险：`@tintinweb/pi-subagents` 是第三方可执行 Pi package，安装前后必须展示来源、解析版本、兼容性与失败告警；未来可替换为 iagent 自有 npm 包。
