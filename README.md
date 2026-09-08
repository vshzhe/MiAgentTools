# VenusAgentTools

AI Agent 技能生成与管理 CLI —— 按生命周期类型（`tr_*`）分类生成 `venus_` 前缀的 SKILL 与斜杠指令，安装到目标项目的 `.claude/` 目录。

架构参考 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 的"模板层 → 生成层（适配器）→ 命令层"三层设计。

## 安装

```bash
pnpm install
pnpm build
```

本地开发运行：

```bash
node bin/venus.js <command>
```

## 快速开始

```bash
cd your-project

# 生成全部技能与指令到 .claude/
venus init

# 查看已安装技能（按 7 类分组）
venus list

# 按类型生成新技能骨架
venus generate --type tr_tools --name env-check --desc "环境检查"
```

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
