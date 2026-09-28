# VenusAgentTools

AI Agent 技能生成与管理 CLI —— 按生命周期类型（`tr_*`）分类生成 `venus_` 前缀的 SKILL 与斜杠指令，安装到目标项目的 `.claude/` 目录。

架构参考 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 的"模板层 → 生成层（适配器）→ 命令层"三层设计。

## 安装

### 方式一：本地全局安装（推荐，任意目录可用 `venus` 命令）

```bash
cd E:\github\VenusAgentTools

# 安装依赖并构建
pnpm install
pnpm build

# 全局链接（把 venus 命令挂到 PATH）
pnpm link --global
```

> **提示**：pnpm 10 偶发首次 link 不生成全局 bin 软链接 —— 若 `venus --version` 报"命令不存在"，
> 再执行一次 `pnpm link --global` 即可。已实测：链接后在任意目录（含 Git Bash / cmd / PowerShell）
> `venus` 直接可用。

验证安装：

```bash
venus --version    # 输出 1.2.0
venus --help       # 查看全部命令
```

卸载全局链接：

```bash
pnpm uninstall --global venus-agent-tools
```

### 方式二：项目内直接运行（不装全局命令）

```bash
cd E:\github\VenusAgentTools
node bin/venus.js <command>     # 效果与 venus <command> 完全一致
```

### 方式三：目标项目本地依赖（固定版本）

在目标项目中：

```bash
pnpm add file:E:\github\VenusAgentTools
pnpm exec venus init
```

## 快速开始

```bash
cd your-project

# 生成全部技能与指令到 .claude/
venus init

# 查看已安装技能（按 7 类分组）
venus list

# 校验技能规范符合性
venus validate

# 按类型生成新技能骨架
venus generate --type tr_tools --name env-check --desc "环境检查"
```

### 如何在 Claude Code 中使用关联指令

`venus init` 会在目标项目生成 **SKILL 与斜杠指令两套入口**，Claude Code 均可直接调用：

| 使用方式 | 输入形式 | 说明 |
| :--- | :--- | :--- |
| 斜杠指令 | `/venus:tools-pwd` | 输入 `/` 后补全列表中选择，回车触发 |
| 技能自动触发 | 直接说"看下当前目录在哪" | Claude 按技能 description 自动匹配调用 |

**使用步骤**（以查看当前路径为例）：

1. 在目标项目执行 `venus init`（生成 `.claude/` 产物）
2. 打开该项目的 Claude Code 会话
3. 输入 `/venus:tools-pwd`，或直接提问"当前目录是什么"
4. Claude 按技能指引运行 `pwd`（Windows cmd 环境自动降级 `echo %CD%`）并展示绝对路径

全部 8 个斜杠指令对照：

| 斜杠指令 | 功能 |
| :--- | :--- |
| `/venus:init-project` | 初始化项目（目录结构、配置、脚手架） |
| `/venus:impl-feature` | 实现功能（分层架构编写代码） |
| `/venus:test-generate` | 生成测试（目标驱动：先写用例再通过） |
| `/venus:commit-change` | 提交变更（规范提交信息 + 暂存管理） |
| `/venus:review-code` | 审查代码（分级审查报告） |
| `/venus:release-version` | 发布版本（SemVer + 变更日志） |
| `/venus:tools-pwd` | 查看当前路径 |
| `/venus:tools-list` | 列出可用技能 |

## 技能分类体系

每个技能归属一个生命周期类型（`tr_*`），技能名格式：`venus_<type>_<name>`。

| 类型 | 中文名 | 内置技能 | 斜杠指令 |
| :--- | :--- | :--- | :--- |
| `tr_init` | 初始化 | `venus_tr_init_project` | `/venus:init-project` |
| `tr_impl` | 实现 | `venus_tr_impl_feature` | `/venus:impl-feature` |
| `tr_test` | 测试 | `venus_tr_test_generate` | `/venus:test-generate` |
| `tr_commit` | 提交 | `venus_tr_commit_change` | `/venus:commit-change` |
| `tr_review` | 审查 | `venus_tr_review_code` | `/venus:review-code` |
| `tr_release` | 版本 | `venus_tr_release_version` | `/venus:release-version` |
| `tr_tools` | 工具 | `venus_tr_tools_pwd`、`venus_tr_tools_list` | `/venus:tools-pwd` 等 |

安装产物结构：

```text
your-project/
└── .claude/
    ├── skills/
    │   └── venus_<type>_<name>/SKILL.md    # Agent Skill（中文正文）
    └── commands/
        └── venus/<type>-<name>.md          # 斜杠指令（frontmatter + 正文）
```

## CLI 命令

| 命令 | 说明 | 主要参数 |
| :--- | :--- | :--- |
| `venus init` | 生成全部技能 + 指令到当前项目，并检测安装依赖（codegraph / openspec） | `--tools <ids>`、`--force`、`--no-deps`、`--onboarding` |
| `venus list` | 列出已安装技能（按类型分组） | `--json` |
| `venus show <query>` | 查看技能详情（frontmatter / 类型 / 白名单 / 正文预览） | `--json` |
| `venus validate` | 校验已安装技能规范符合性（frontmatter / 类型 / 命名） | `--json` |
| `venus update` | 更新技能到内置模板最新版（手改保护） | `--force` |
| `venus generate` | 按类型生成新技能骨架（写入 `skills/` 并安装） | `--type`、`--name`、`--desc`、`--force` |
| `venus uninstall` | 移除 venus 技能与指令（非 venus 技能不碰） | `--yes`、`--purge-config` |
| `venus completion` | 安装/卸载 shell 补全 | `<install\|uninstall>`、`--shell <bash\|powershell>` |

`show` 支持完整名（`venus_tr_tools_pwd`）、去前缀（`tr_tools_pwd`）与片段（`pwd`）匹配；
多命中时列出候选，`--json` 输出结构化详情。

`uninstall` 默认保留 `.venus/` 配置（用户维护的 rules 不丢）；先干跑展示影响面，
`--yes` 才执行，`--purge-config` 连配置一起删。

更多：[快速上手指南](docs/getting-started.md) · [AI 代理导航（AGENTS.md）](AGENTS.md) · [变更日志](CHANGELOG.md)

`validate` 校验项：`venus_` 前缀、frontmatter `name` = 目录名、`description` / `allowed-tools` / `metadata.type` 必填、`type` 为 7 类之一；存在 CRITICAL 时退出码 1（可接入 CI）。

`update` 保护策略：内容与内置一致 → 跳过（幂等）；来自旧版本 → 自动升级；检测到用户手改 → 跳过并列出（`--force` 才覆盖）。

## 依赖自检（codegraph / openspec）

`venus init` 会在生成技能后自动检测并安装后续功能集成所需的两个外部依赖（已存在则跳过，绝不升级覆盖）：

| 依赖 | 检测项 | 缺失时自动执行 |
| :--- | :--- | :--- |
| [codegraph](https://github.com/colbymchenry/codegraph)（代码知识图谱） | CLI 命令可用性；用户级 MCP 注册（`~/.claude.json`） | `npm install -g @colbymchenry/codegraph`；`claude mcp add codegraph -s user -- codegraph serve --mcp` |
| [openspec](https://github.com/Fission-AI/OpenSpec)（规格驱动开发） | CLI 命令可用性；项目根 `openspec/` 目录 | `npm install -g @fission-ai/openspec`；`openspec init --tools claude`（项目内非交互初始化） |

安装失败仅输出警告与手动执行命令，不阻断技能生成主流程；`--no-deps` 可跳过整个依赖步骤。

## Shell 补全

```bash
# 安装（bash + PowerShell 两个都装）
venus completion install

# 只装某一个
venus completion install --shell bash
venus completion install --shell powershell

# 卸载（只删 venus 管理的标记块，不动其他配置）
venus completion uninstall
```

- **bash**：脚本写入 `~/.venus-completion.sh`，`~/.bashrc` 中以 `VENUS-COMPLETION:START/END` 标记块 source；新开终端或 `source ~/.bashrc` 后生效
- **PowerShell**：脚本写入 `Documents/PowerShell/VenusCompletion.ps1`，`$PROFILE` 中标记块 dot-source；新开窗口生效（兼容 PowerShell 5.1 与 7+）
- 补全覆盖 5 个子命令 + 常用选项（如 `generate --type`、`list --json`）

## 项目级配置（.venus/ 目录）

`venus init` 会在项目根创建 `.venus/` 配置目录（已存在则保留，不覆盖你的修改）：

```text
.venus/
├── config.yaml          # 项目背景 + 规则引用
└── rules/
    ├── tr_impl.md       # 实现类规则（每行一条，# 为注释）
    └── tr_test.md       # 测试类规则
```

**config.yaml 通过 `rules` 列表显式引用规则文件**：

```yaml
context: |                       # 项目背景 —— generate 骨架时注入正文头部
  技术栈：JDK 17 + Spring Boot 3 + MySQL 8
  分层约定：Controller → Service → DAO

rules:                           # 引用 rules/ 下的文件，顺序即注入顺序
  - tr_impl                     # 删除某行即停用对应规则
  - tr_test                     # 新增类型：在 rules/ 建 tr_xxx.md 并在此登记
```

规则文件格式（`.venus/rules/tr_impl.md`）：

```markdown
# tr_impl 类型项目规则（每行一条，# 开头为注释）
遵循项目分层架构，禁止跨层调用
实现类需补充 JavaDoc/方法注释
```

`venus generate` 生成的骨架会自动带上 `context`（引用块）与该类型被引用的 `rules`（约束列表）；
未在 config.yaml 引用的规则文件不生效。引用了但文件缺失的类型会记入 `missingRuleFiles`。

## init 后的下一步引导

首次 `venus init`（`.venus/` 配置刚创建）时，终端会输出按生命周期排序的使用引导：

```text
═══════════════════════════════════════════════════════
  下一步：在 Claude Code 中试试这些指令
═══════════════════════════════════════════════════════

  /venus:tools-pwd
    在 Claude Code 中试试最简单的技能：问"当前目录是什么"
  ...
```

已初始化过的项目不重复打扰；想再看用 `venus init --onboarding`。

## 架构

```text
src/core/templates/workflows/tr-*.ts   模板层：7 类技能模板（内容，中文）
            │
src/core/command-generation/           生成层：格式化 + 路径解析
  ├── adapters/claude.ts               ToolCommandAdapter 接口（预留多工具扩展）
  ├── generator.ts                     generateCommand / generateSkillContent
  └── yaml.ts                          YAML 转义
            │
src/cli/index.ts + src/commands/        命令层：venus init / list / generate
```

设计要点（继承自 OpenSpec）：

- **内容与形式分离**：模板层定义工具无关的技能内容；适配器负责目标工具的路径与 frontmatter 格式
- **适配器可扩展**：新增 AI 工具只需实现 `ToolCommandAdapter` 并在 `CommandAdapterRegistry` 注册
- **指令 id 派生**：`venus_tr_tools_pwd` → `tr-tools-pwd`（`.claude/commands/venus/tr-tools-pwd.md`）

### 本地开发调试（修改本项目代码后）

```bash
pnpm build                  # 重新编译 dist/
node bin/venus.js list      # 直接验证新逻辑

# 已 pnpm link --global 的场景：dist/ 是真实引用（软链接指向本仓库），
# 重新 build 后全局 venus 命令即刻生效，无需重新 link
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
- 项目自身已 dogfood：`.claude/` 目录下的技能即由 `venus init` 生成

## 约束与规范

- 技能名强制 `venus_` 前缀；frontmatter `metadata.type` 必须为 7 类之一
- SKILL 正文使用中文；`name` / `description` 保留规范标识
- `generate` 的 `--name` 必须为 kebab-case；非法类型与命名直接报错
- 覆盖已存在文件必须显式 `--force`
