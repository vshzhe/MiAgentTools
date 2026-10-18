# MiAgentTools

AI Agent 技能生成与管理 CLI —— 按技能类型分类生成 `iagent_` 前缀的 SKILL 与斜杠指令，安装到目标项目的 AI 工具目录（`.claude/`、`.pi/`、`.codex/`、`.opencode/`）。

架构参考 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 的"模板层 → 生成层（适配器）→ 命令层"三层设计。

## 安装

### 方式一：本地全局安装（推荐，任意目录可用 `iagent` 命令）

```bash
cd <MiAgentTools 仓库路径>

# 安装依赖并构建
pnpm install
pnpm build

# 全局链接（把 iagent 命令挂到 PATH）
pnpm link --global
```

> **前置条件**：`pnpm link --global` 要求 `PNPM_HOME` 已设置**且该目录在 PATH 中**。未满足时先执行
> `pnpm setup`，然后**重开终端 / 编辑器**——已启动的进程不会感知新写入的环境变量，会分别报
> `ERR_PNPM_NO_GLOBAL_BIN_DIR`（变量未生效）或 `The configured global bin directory ... is not in PATH`
> （PATH 未生效）。已实测确认。
>
> **提示**：pnpm 10 偶发首次 link 不生成全局 bin 软链接 —— 若 `iagent --version` 报"命令不存在"，
> 再执行一次 `pnpm link --global` 即可。已实测：链接后在任意目录（含 Git Bash / cmd / PowerShell）
> `iagent` 直接可用。

验证安装：

```bash
iagent --version    # 输出 7.0.1
iagent --help       # 查看全部命令
```

卸载全局链接：

```bash
pnpm uninstall --global mi-agent-tools
```

### 方式二：项目内直接运行（不装全局命令）

```bash
cd <MiAgentTools 仓库路径>
node bin/iagent.js <command>     # 效果与 iagent <command> 完全一致
```

### 方式三：目标项目本地依赖（固定版本）

在目标项目中：

```bash
pnpm add file:<MiAgentTools 仓库路径>
pnpm exec iagent init
```

## 从旧版升级（venus → iagent）

2.0.0 是破坏性改名（技能前缀、指令命名空间、配置目录、CLI 名全变）。**既有装机只需照常执行
一次 `iagent init`（或 `iagent update`）**，入口内置的一次性迁移会自动完成升级：

- **搬运配置**：`.venus/` → `.iagent/`，`context` 与自写规则行、注释、未知段逐字保留；
  `rules:` 列表与 `rules/*.md` 文件名按类型映射改名，`workflows:` 列表按旧→新指令 id 改名
- **删除旧产物**：各工具目录下 `venus_*` 技能与 `commands/venus/` 指令**一律删除**
  （不区分是否手工修改过，丢失风险以报告告警对冲）；同时清理旧补全脚本与 rc/profile 旧标记块、
  仓内旧 sidecar 目录与旧索引库。非 `venus_` 前缀的产物完全不触碰
- **输出报告**：搬运项 / 删除项 / 跳过项三段计数与明细 + 告警；无旧物时静默跳过，
  重复执行无副作用

**要保留手工修改过的旧技能正文，请在升级前自行留档**（迁移不做备份）。
`iagent init --no-migrate` 可跳过迁移、只安装新口径产物，供先看影响面的场景。

完整的自动行为、告警含义、边界场景与升级前动作见
[旧装机升级指引](docs/upgrade-guide.md)。

## 快速开始

```bash
cd your-project

# 生成全部技能与指令到默认工具目录（.claude/ .pi/ .codex/；OpenCode 为可选，需 --tools opencode）
iagent init

# 只生成指定工具
iagent init --tools claude,pi

# 查看已安装技能（按类型分组，多工具间去重）
iagent list

# 校验技能规范符合性
iagent validate

# 按类型生成新技能骨架
iagent generate --type tools --name env-check --desc "环境检查"
```

### 支持的目标工具

技能 ID 采用 canonical kebab-case：`iagent-<workflowId>`（如 `iagent-spec-explore`），
workflowId 即既有指令 id（如 `spec-explore`）。旧下划线形态 `iagent_<name>` 仅作兼容解析，
`iagent init` / `update` 会自动迁移既有产物。

| 工具 | 技能目录 | 指令产物 | 说明 |
| :--- | :--- | :--- | :--- |
| Claude Code | `.claude/skills/iagent-<workflowId>/` | `.claude/commands/iagent/<id>.md` | YAML frontmatter（name/allowed-tools/category/tags）+ Markdown |
| Pi | `.pi/skills/iagent-<workflowId>/` | `.pi/prompts/iagent-<id>.md` | Pi prompt 模板：扁平前缀、frontmatter 仅 description + 记账字段；参数经 `$ARGUMENTS` 注入 |
| Codex | `.codex/skills/iagent-<workflowId>/` | —（skills-invocable） | 仅生成技能，通过 `$` 前缀调用 |
| OpenCode V2 | `.opencode/skills/iagent-<workflowId>/` | `.opencode/commands/iagent-<id>.md` | V2 口径：指令含 `agent`/`subagent` 元数据；项目级 `.opencode/agents/` 与 `.opencode/opencode.jsonc`（`permissions`）随 init 生成。**可选（opt-in）** |

### 宿主原生编排

技能/指令产物按目标宿主**原生编排能力**生成（共享工作流协议 + 宿主适配器）：

| 宿主 | 技能加载 | 阶段委派 | 确认门 / 状态 |
| :--- | :--- | :--- | :--- |
| Claude Code | `Skill` 工具 | `Skill` / `Agent` | `AskUserQuestion` / hooks |
| OpenCode V2 | `skill` 工具 | `subagent` + 项目级 agent | `question` / `permissions` |
| Pi strict | `/skill:name` | Pi Runtime Extension | Extension workflow / gate 工具 |
| Pi degraded | `/skill:name` | 无（本地执行，显式声明不构成委派） | 无 |

**Pi 严格编排运行时**：默认安装 npm 包 `@tintinweb/pi-subagents`（latest，项目级）。
`iagent init` 默认尝试安装；安装失败、版本不兼容或能力检测失败时**不阻断**，继续生成
标记为 `degraded` 的产物并写入 `.iagent/pi-runtime.json` 诊断。恢复 strict 可重试安装后
重新执行 `iagent init` / `update`（Pi 内需 `/reload`）。

### 工具选择配置

`iagent init` 会把本次选择的工具集回写 `.iagent/config.yaml` 的 `tools` 字段（持久化）；
`iagent update` 仅在显式传入 `--tools` 时回写，避免常规刷新意外改动持久选择：

```yaml
# .iagent/config.yaml
tools:
  - claude
  - pi
  # 注释掉 codex 即不生成 Codex 适配产物
  # 加入 opencode 才生成 OpenCode 适配产物（可选工具，默认不生成）
```

优先级：`--tools` CLI 参数 > config.yaml `tools` 字段 > 默认工具集（claude / pi / codex；**OpenCode 为可选，未配置不生成**）。

```bash
# 指定工具并持久化到 config.yaml
iagent init --tools claude,pi

# 未传 --tools：读取 config.yaml 的 tools 字段；为空或缺省时用全部工具
iagent init

# update 仅在显式指定时回写（不带则只读）
iagent update --tools claude
```

`iagent init` 会在目标项目生成 **SKILL 与斜杠指令两套入口**（Pi、Codex 工具同理）：

| 使用方式 | Claude Code | Pi | OpenCode | Codex |
| :--- | :--- | :--- | :--- | :--- |
| 斜杠指令 | `/iagent:spec-apply` | `/iagent-spec-apply` | `/iagent-spec-apply` | —（skills-only） |
| 技能触发 | 按 description 自动匹配 | 按 description 自动匹配 | 按 description 自动匹配 | `$iagent_spec_apply` |

**使用步骤**（以 Claude Code 为例）：

1. 在目标项目执行 `iagent init`
2. 打开该项目的 Claude Code / Pi / OpenCode / Codex 会话
3. 输入 `/iagent:workflow <需求>`（Codex 用 `$iagent_workflow`），或直接用自然语言描述需求
4. AI 按技能指引完成探索→提案→验证→实现→归档

常用斜杠指令对照：

| 斜杠指令 | 功能 |
| :--- | :--- |
| `/iagent:workflow` | 一站式引导工作流（探索→提案→验证→实现→归档） |
| `/iagent:auto-workflow` | 全自动管线（无人确认门，L1-L5 后自动到底） |
| `/iagent:debug` | 一站式调试（复现→根因→修复→回归测试） |
| `/iagent:project-init` | 初始化项目（目录结构、配置、脚手架） |
| `/iagent:test` | 生成测试（目标驱动：先写用例再通过） |
| `/iagent:commit` / `/iagent:svn-commit` | 提交变更（Git / SVN） |
| `/iagent:review` | 审查代码（分级审查报告） |

> 查看当前目录用 AI 直接执行 `pwd`；查看已装技能用 `iagent list`；查看工具版本用 `iagent --version`。
> 完整的技能清单见 [技能使用说明书](docs/skills-manual.md) 或运行 `iagent list`。

## 技能分类体系

每个技能归属一个技能类型（`init` / `impl` / `test` / `commit` / `review` / `release` / `tools` / `docs` / `spec`）。技能名格式为 `iagent_<功能名>`，类型只写入 frontmatter 的 `metadata.type`，不进入技能名。

| 类型 | 中文名 | 内置技能 | 斜杠指令 |
| :--- | :--- | :--- | :--- |
| `init` | 初始化 | `iagent_project_init` | `/iagent:project-init` |
| `impl` | 实现 | `iagent_workflow`、`iagent_auto_workflow`、`iagent_debug`、`iagent_proposal_review`、`iagent_migration`、`iagent_migration_check` | `/iagent:workflow` 等 |
| `test` | 测试 | `iagent_test` | `/iagent:test` |
| `commit` | 提交 | `iagent_commit`、`iagent_svn_commit` | `/iagent:commit`、`/iagent:svn-commit` |
| `review` | 审查 | `iagent_review` | `/iagent:review` |
| `docs` | 文档 | `iagent_feature_doc`、`iagent_requirement_doc` | `/iagent:feature-doc` 等 |
| `spec` | 规格 | `iagent_spec_explore` 等 7 个 | `/iagent:spec-explore` 等 |

> `release` 与 `tools` 类型保留在类型体系中（供 `iagent generate --type` 扩展），当前无内置技能。

安装产物结构（以 Claude Code 为例，Pi/OpenCode/Codex 目录对称）：

```text
your-project/
├── .claude/
│   ├── skills/
│   │   └── iagent_<功能名>/SKILL.md         # Agent Skill（中文正文）
│   └── commands/
│       └── iagent/<指令 id>.md              # 斜杠指令（frontmatter + 正文）
├── .pi/                                     # Pi 工具
│   ├── skills/
│   └── prompts/iagent-<指令 id>.md          # Pi prompt 模板（扁平前缀）
├── .opencode/                               # OpenCode 工具（可选/opt-in）
│   ├── skills/
│   └── commands/iagent-<指令 id>.md         # 斜杠指令（扁平前缀，含 $ARGUMENTS 注入）
└── .codex/                                  # Codex 工具（仅 skills）
    └── skills/
```

## CLI 命令

| 命令 | 说明 | 主要参数 |
| :--- | :--- | :--- |
| `iagent init` | 生成全部技能 + 指令到当前项目，并检测安装依赖（codegraph / openspec） | `--tools <ids>`、`--force`、`--no-deps`、`--no-scan`、`--no-migrate`、`--onboarding` |
| `iagent list` | 列出已安装技能（按类型分组，多工具间去重） | `--json` |
| `iagent show <query>` | 查看技能详情（frontmatter / 类型 / 白名单 / 正文预览） | `--json` |
| `iagent validate` | 校验已安装技能规范符合性（frontmatter / 类型 / 命名，多工具间去重） | `--json` |
| `iagent update` | 更新技能到内置模板最新版（手改保护） | `--tools <ids>`、`--force`、`--no-migrate` |
| `iagent generate` | 按类型生成新技能骨架（写入 `skills/` 并安装） | `--type`、`--name`、`--desc`、`--force` |
| `iagent uninstall` | 移除 iagent 技能与指令（非 iagent 技能不碰） | `--yes`、`--purge-config` |
| `iagent completion` | 安装/卸载 shell 补全 | `<install\|uninstall>`、`--shell <bash\|powershell>` |
| `iagent --version` | 显示 CLI 版本号 | — |

`show` 支持完整名（`iagent_spec_apply`）、去前缀段（`spec-apply`）、前缀（`iagent_spec` / `mi`）与片段（≥3 字符，如 `migra`）匹配；
多命中时列出候选，`--json` 输出结构化详情。

`uninstall` 默认保留 `.iagent/` 配置（用户维护的 rules 不丢）；先干跑展示影响面，
`--yes` 才执行，`--purge-config` 连配置一起删。

更多：[快速上手指南](docs/getting-started.md) · [旧装机升级指引](docs/upgrade-guide.md) · [AI 代理导航（AGENTS.md）](AGENTS.md) · [变更日志](CHANGELOG.md)

`validate` 校验项：`iagent_` 前缀、frontmatter `name` = 目录名、`description` / `allowed-tools` / `metadata.type` 必填、`type` 为 9 类之一；存在 CRITICAL 时退出码 1（可接入 CI）。

`update` 保护策略：内容与内置一致 → 跳过（幂等）；产物未被改动（`generatedFingerprint`
内容指纹自洽）→ 自动升级；检测到用户手改 → 跳过并列出（`--force` 才覆盖）。
无指纹字段的存量产物回退到 `generatedBy` 版本号判定，行为与旧版一致。

## 依赖自检（codegraph / openspec）

`iagent init` 会在生成技能后自动检测并安装后续功能集成所需的两个外部依赖（已存在则跳过，绝不升级覆盖）：

| 依赖 | 检测项 | 缺失时自动执行 |
| :--- | :--- | :--- |
| [codegraph](https://github.com/colbymchenry/codegraph)（代码知识图谱） | CLI 命令可用性；用户级 MCP 注册（`~/.claude.json`） | `npm install -g @colbymchenry/codegraph`；`claude mcp add codegraph -s user -- codegraph serve --mcp` |
| [openspec](https://github.com/Fission-AI/OpenSpec)（规格驱动开发） | CLI 命令可用性；项目根 `openspec/` 目录 | `npm install -g @fission-ai/openspec`；`openspec init --tools claude`（项目内非交互初始化） |

安装失败仅输出警告与手动执行命令，不阻断技能生成主流程；`--no-deps` 可跳过整个依赖步骤。

## Shell 补全

```bash
# 安装（bash + PowerShell 两个都装）
iagent completion install

# 只装某一个
iagent completion install --shell bash
iagent completion install --shell powershell

# 卸载（只删 iagent 管理的标记块，不动其他配置）
iagent completion uninstall
```

- **bash**：脚本写入 `~/.iagent-completion.sh`，`~/.bashrc` 中以 `IAGENT-COMPLETION:START/END` 标记块 source；新开终端或 `source ~/.bashrc` 后生效
- **PowerShell**：脚本写入 `Documents/PowerShell/IagentCompletion.ps1`，`$PROFILE` 中标记块 dot-source；新开窗口生效（兼容 PowerShell 5.1 与 7+）
- 补全覆盖全部 CLI 命令 + 常用选项（如 `generate --type`、`list --json`、`spec <子命令>`）

## 项目级配置（.iagent/ 目录）

`iagent init` 会在项目根创建 `.iagent/` 配置目录（已存在则保留，不覆盖你的修改）：

```text
.iagent/
├── config.yaml          # 项目背景 + 规则引用
└── rules/
    ├── impl.md       # 实现类规则（每行一条，# 为注释）
    └── test.md       # 测试类规则
```

**config.yaml 通过 `rules` 列表显式引用规则文件**：

```yaml
context: |                       # 项目背景 —— generate 骨架时注入正文头部
  技术栈：JDK 17 + Spring Boot 3 + MySQL 8
  分层约定：Controller → Service → DAO

rules:                           # 引用 rules/ 下的文件，顺序即注入顺序
  - impl                     # 删除某行即停用对应规则
  - test                     # 新增类型：在 rules/ 建 <type>.md 并在此登记

tools:                           # 目标 AI 工具（iagent init/update 据此过滤生成）
  - claude                       # 删除该段或留空则回退默认工具集（claude, pi, codex）
  - pi
  - codex
  # - opencode                   # 可选（opt-in）工具：加入才生成 OpenCode 适配产物
```

规则文件格式（`.iagent/rules/impl.md`）：

```markdown
# impl 类型项目规则（每行一条，# 开头为注释）
遵循项目分层架构，禁止跨层调用
实现类需补充 JavaDoc/方法注释
```

`iagent generate` 生成的骨架会自动带上 `context`（引用块）与该类型被引用的 `rules`（约束列表）；
未在 config.yaml 引用的规则文件不生效。引用了但文件缺失的类型会记入 `missingRuleFiles`。

## init 后的下一步引导

首次 `iagent init`（`.iagent/` 配置刚创建）时，终端会输出按生命周期排序的使用引导：

```text
═══════════════════════════════════════════════════════
  下一步：在 Claude Code 中试试这些指令
═══════════════════════════════════════════════════════

  /iagent:tools-pwd
    在 Claude Code 中试试最简单的技能：问"当前目录是什么"
  ...
```

已初始化过的项目不重复打扰；想再看用 `iagent init --onboarding`。

## 架构

```text
src/core/templates/workflows/*.ts      模板层：技能模板（内容，中文）+ registry.ts 注册表
            │
src/core/command-generation/           生成层：格式化 + 路径解析
  ├── adapters/
  │   ├── claude.ts                    Claude Code 适配器（.claude/commands/iagent/）
  │   ├── pi.ts                        Pi 适配器（.pi/prompts/iagent-<id>.md）
  │   └── opencode.ts                  OpenCode 适配器（.opencode/commands/iagent-<id>.md）
  ├── generator.ts                     generateCommand / generateSkillContent
  └── yaml.ts                          YAML 转义
            │
src/cli/index.ts + src/commands/        命令层：iagent init / list / generate / update / spec …
```

设计要点：

- **内容与形式分离**：模板层定义工具无关的技能内容；适配器负责目标工具的路径与 frontmatter 格式
- **适配器可扩展**：新增 AI 工具只需实现 `ToolCommandAdapter` 并在 `CommandAdapterRegistry` 注册；skills-invocable 工具（如 Codex）无需适配器，仅生成技能
- **指令 id 派生**：`iagent_spec_apply` → `spec-apply`；落点按工具布局（Claude 命名空间子目录，Pi / OpenCode 扁平前缀 `iagent-<id>.md`）
- **工具选择**：`--tools` CLI 参数或 `.iagent/config.yaml` 的 `tools` 字段控制生成哪些工具的产物；init 持久化所选、update 仅显式 `--tools` 时回写；OpenCode 为可选（opt-in），未配置不生成

### 本地开发调试（修改本项目代码后）

```bash
pnpm build                  # 重新编译 dist/
node bin/iagent.js list      # 直接验证新逻辑

# 已 pnpm link --global 的场景：dist/ 是真实引用（软链接指向本仓库），
# 重新 build 后全局 iagent 命令即刻生效，无需重新 link
```

## 开发

```bash
pnpm build          # 构建（tsc → dist/）
pnpm test           # 运行 vitest 测试（57 个用例）
pnpm lint           # eslint 检查（src/ + test/）
pnpm generate:skills  # 重新生成 skills/ 静态快照（改模板后必须运行）
pnpm dev            # 监听模式编译
```

工程保障：

- **CI**（GitHub Actions）：Ubuntu + Windows 双平台跑 build → lint → test → 快照 parity 检查
- **快照防漂移**：`test/skills-parity.test.ts` 保证 `skills/` 提交内容与模板一致
- 项目自身已 dogfood：`.claude/` 目录下的技能即由 `iagent init` 生成（**本机产物，不入库** ——
  `.iagent/` / `.claude/` / `openspec/` / `.codegraph/` 均由 `.gitignore` 整体排除；
  可提交的模板真源是 `skills/` 静态快照）

## 约束与规范

- 技能名强制 `iagent_` 前缀；frontmatter `metadata.type` 必须为 9 类之一
- SKILL 正文使用中文；`name` / `description` 保留规范标识
- `generate` 的 `--name` 必须为 kebab-case；非法类型与命名直接报错
- 覆盖已存在文件必须显式 `--force`
