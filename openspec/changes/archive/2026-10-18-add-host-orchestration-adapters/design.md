# Design

## Context

See `proposal.md` for the motivation. 当前模板注册表以技能名派生 commandId，生成层主要负责路径、frontmatter 与参数注入；工作流正文仍直接携带 Claude Code 工具与委派语义。Pi 的 prompt template/skill 本身不提供严格编排，OpenCode V2 则提供 `skill`、`subagent`、项目 agents、commands 与 `permissions`，三者的运行时边界不同。

既有 `.iagent/config.yaml` 的 workflows、依赖注入与 legacy migration 已经以 commandId（连字符形式）作为工作流选择契约；已有技能目录与 frontmatter 则使用 `iagent_` 下划线形式。变更必须同时支持新 kebab-case 外部产物与存量迁移。

## Goals / Non-Goals

**Goals:**

- 固化宿主无关的 phase / handoff / receipt / gate / retry / capability 协议。
- 让 Claude Code、OpenCode V2 与 Pi 使用各自原生的编排能力。
- OpenCode 只生成项目级配置与 agents，不默认修改用户根目录配置。
- Pi init 默认尝试安装项目级 `@tintinweb/pi-subagents` latest；失败后无阻塞地生成 degraded 产物。
- 通过 provider 抽象为未来 iagent 自有 Pi npm 包保留替换点。
- 自动迁移旧 `iagent_<name>` 产物，并保留旧名查询与配置兼容。

**Non-Goals:**

- 本变更不实现一个新的 LLM agent runtime；Pi strict 编排依赖外部 npm package。
- 不把所有宿主强行统一为相同的工具名、权限格式或子 agent API。
- 不默认修改用户根目录 `opencode.json` / `opencode.jsonc`。
- 不删除非 iagent 技能、用户自建 commands、用户自建 agents 或已有非 iagent 配置。
- 不在 degraded 模式中伪造 strict 委派、回执或 gate 完成。

## Decisions

### 1. Canonical workflow identity 使用 commandId

选择现有 commandId（例如 `spec-explore`）作为 canonical workflowId，而不是继续以 `iagent_spec_explore` 作为核心 ID。

原因：commandId 已经是 workflows 配置、依赖注入、命令引用与 legacy 映射的共同契约。技能名只作为宿主产物标识派生：`iagent-<workflowId>`。旧下划线名作为 legacy alias 保留，避免修改 `.iagent/config.yaml` 与查询接口的既有语义。

替代方案：直接把所有内部技能名改成 kebab-case。该方案会同时影响模板注册、旧映射、测试快照、配置与迁移，破坏面更大，且没有必要。

### 2. 共享协议与宿主适配器分层

共享模板只描述阶段目标、输入、输出、回执字段、门与能力要求；宿主适配器负责把抽象动作映射为原生能力：

| 宿主 | 技能加载 | 阶段委派 | Gate / 状态 |
|---|---|---|---|
| Claude Code | Skill | Agent / Skill | AskUserQuestion、hooks、session |
| OpenCode V2 | `skill` | `subagent` + project agents | question/permissions/primary agent |
| Pi strict | Pi skill | `@tintinweb/pi-subagents` Extension | Extension workflow、receipt、状态工具 |
| Pi degraded | Pi skill / prompt | 当前 agent 明确降级执行 | 只提供声明性限制，不承诺严格门控 |

替代方案：为每个宿主维护完整独立模板。该方案会产生正文漂移与协议不一致，保留为只在宿主行为无法通过适配器表达时使用的例外。

### 3. Pi 默认使用第三方 npm runtime，但运行时可替换

当前默认 provider 为 `@tintinweb/pi-subagents`，以项目级方式通过 Pi package 安装；版本请求使用 npm latest，初始化记录 resolved version。provider 负责能力探测、安装状态与可用编排工具的报告，工作流协议不依赖该包的具体内部 API。

选择该包的原因：官方 Pi 包目录标明其支持 Pi 1.1.0 及以上，当前用户 Pi 1.2.0 满足要求；它提供隔离子 agent、并行/链式运行与脚本化 workflow，能承载 strict 编排。

替代方案：使用 `pi-agent-suite`。其当前包页声明的支持版本为 Pi 1.3.0，不满足当前 Pi 1.2.0，因此不作为默认 provider。未来 iagent 自有包发布后，通过 provider 注册替换，不改变协议。

### 4. Pi 安装失败自动继续 degraded

`iagent init` 默认尝试安装 Pi runtime。安装失败、版本不兼容或能力检测失败时，init 不阻断其他工具和 Pi 基础产物生成，而是写入 degraded 状态并报告限制。

这取代当前模板中的静默本地 fallback：模型不得把 degraded 本地执行标记为子 agent 或 strict 阶段完成。后续运行可重新执行 init/update 尝试恢复 strict。

### 5. OpenCode V2 使用项目级 `.opencode/` 配置

OpenCode V2 产物集中在项目 `.opencode/`：

```text
.opencode/
├─ opencode.jsonc
├─ agents/
├─ commands/
└─ skills/
```

workflow command 选择 primary orchestrator；阶段 worker 定义为 subagent。V2 `permissions` 以资源模式限定 iagent skill 与 subagent ID。写入采用增量合并，保留用户字段与非 iagent 规则；只有项目级配置不足时才输出根目录配置要求，不自动修改根配置。

替代方案：只生成 `.opencode/commands`，让当前 agent 依赖自然语言自行委派。该方案正是当前问题来源，不能满足严格编排。

### 6. Legacy 迁移先于产物生成

init/update 继续保持 legacy migration 最先执行。迁移识别 `iagent_<name>` 管理目录并生成 `iagent-<name>` canonical 产物；迁移报告记录源、目标、跳过与失败。现有 fingerprint 保护用于判断内容是否由 iagent 管理，非 iagent 文件与用户手工内容不被无条件覆盖。

### 7. OpenCode 配置与 Pi runtime 采用可诊断元数据

生成产物与项目配置记录 host、canonical workflowId、orchestration mode、runtime package 与 resolved version 等最小元数据。记账字段不参与用户手改保护；fingerprint 仍是手改保护的唯一信号。

## Risks / Trade-offs

- **[第三方包风险]** `@tintinweb/pi-subagents` 可执行 Extension 代码，且 latest 可能发生行为变化。→ 初始化展示包名、来源、解析版本与安全提醒；失败时安全降级；provider 可替换。
- **[最新版本可复现性]** latest 不是稳定锁定版本。→ 记录 resolved version，并在后续 update 中报告版本变化；不把版本写入 fingerprint 判定。
- **[OpenCode 配置冲突]** `.opencode/opencode.jsonc` 可能已有用户配置。→ 使用保留用户内容的增量合并；只写 iagent 管理区；冲突报告而非覆盖。
- **[ID 迁移冲突]** `iagent_<name>` 与 `iagent-<name>` 目标可能同时存在。→ 先做归属与 fingerprint 判断；冲突时保留两者并报告，禁止静默覆盖。
- **[Pi Extension 冲突]** 已有扩展可能注册同名 Workflow/SubagentWorkflow 工具。→ 能力检测记录冲突，strict 不启用；继续生成 degraded。
- **[协议与宿主能力差异]** 不同宿主的 gate、状态和子 agent 行为不能完全等价。→ 共享协议只要求可验证契约；各适配器声明能力差异，strict 缺能阻断，degraded 明示限制。

## Migration Plan

1. 发布包含共享协议与宿主适配器的版本，先保留旧 ID 解析与旧产物识别。
2. `iagent init` / `update` 最先扫描并迁移可识别的 `iagent_<name>` 目录；冲突与失败进入迁移报告。
3. 生成新的 kebab-case 产物、OpenCode V2 项目配置与 Pi runtime 状态。
4. Pi 安装成功时启用 strict；安装失败时完成 degraded 生成并输出手动重试命令。
5. `update` 继续用 fingerprint 保护用户手改内容；迁移后的 canonical 文件重新写入自洽 fingerprint。
6. 回滚时保留迁移报告与 legacy alias；不得自动删除 canonical 或 legacy 目录，恢复由后续显式迁移/清理操作完成。
