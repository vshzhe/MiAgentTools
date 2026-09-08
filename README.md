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
venus --version    # 输出 0.1.0
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
| `venus init` | 生成全部技能 + 指令到当前项目 | `--tools <ids>`、`--force` |
| `venus list` | 列出已安装技能（按类型分组） | `--json` |
| `venus validate` | 校验已安装技能规范符合性（frontmatter / 类型 / 命名） | `--json` |
| `venus update` | 更新技能到内置模板最新版（手改保护） | `--force` |
| `venus generate` | 按类型生成新技能骨架（写入 `skills/` 并安装） | `--type`、`--name`、`--desc`、`--force` |

`validate` 校验项：`venus_` 前缀、frontmatter `name` = 目录名、`description` / `allowed-tools` / `metadata.type` 必填、`type` 为 7 类之一；存在 CRITICAL 时退出码 1（可接入 CI）。

`update` 保护策略：内容与内置一致 → 跳过（幂等）；来自旧版本 → 自动升级；检测到用户手改 → 跳过并列出（`--force` 才覆盖）。

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
pnpm test           # 运行 vitest 测试（47 个用例）
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
