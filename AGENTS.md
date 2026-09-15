# AGENTS.md

面向 AI 编码代理（Claude Code 等）的仓库导航。人类读者请从 [README.md](README.md) 开始。

## 这是什么项目

AI Agent 技能生成与管理 CLI：按生命周期类型（`tr_*`）分类生成 `venus_` 前缀的 SKILL 与斜杠指令，安装到目标项目的 `.claude/` 目录。TypeScript + Commander.js + ESM，参考 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 的三层架构。

## 仓库地图

```text
src/
├── cli/index.ts                      CLI 入口（Commander 程序，全部命令注册处）
├── commands/                         命令实现（每个命令一个文件）
│   ├── init.ts                       venus init
│   ├── list.ts                       venus list（scanInstalledSkills 被 show 复用）
│   ├── validate.ts                   venus validate
│   ├── update.ts                     venus update（generatedBy 版本对比 + 手改保护）
│   ├── generate.ts                   venus generate（骨架 + .venus 配置注入）
│   ├── uninstall.ts                  venus uninstall（dry-run 预览 + 安全边界）
│   ├── show.ts                       venus show（模糊匹配 + 详情）
│   ├── completion.ts                 venus completion（bash/pwsh 补全脚本生成与安装）
│   └── onboarding.ts                 init 后的引导提示
├── core/
│   ├── config.ts                     常量中心：SKILL_PREFIX、7 类 SKILL_TYPES、AI_TOOLS
│   ├── project-config.ts             .venus/ 配置读写（config.yaml + rules/）
│   ├── templates/
│   │   ├── types.ts                 SkillTemplate / CommandTemplate 接口
│   │   ├── registry.ts               模板注册表 + deriveCommandId 派生规则
│   │   ├── derive-command.ts         spec 模板 command 压缩版派生（CMD:SKIP 标记裁剪）
│   │   └── workflows/               技能模板（中文正文）：tr-*.ts 生命周期 7 类
│   │                                 + spec-*.ts 规格工作流（单一源，command 派生）
│   └── command-generation/
│       ├── types.ts                  ToolCommandAdapter 接口（多工具扩展点）
│       ├── generator.ts              generateSkillContent / generateCommand
│       ├── yaml.ts                   YAML 转义
│       └── adapters/claude.ts         Claude Code 适配器
└── utils/file-system.ts              文件系统工具

test/                                 vitest（71 个用例，8 个文件）
skills/                               静态快照（勿手编，pnpm generate:skills 生成）
scripts/generate-skills.mjs          快照生成脚本
```

## 常用命令

```bash
pnpm install            # 安装依赖
pnpm build              # 构建（tsc → dist/）
pnpm test               # 全量测试
pnpm lint               # eslint（src/ + test/）
pnpm generate:skills    # 重新生成 skills/ 快照（改模板后必须运行）
node bin/venus.js <cmd> # 直接运行 CLI
```

## 修改守则

1. **改技能模板**（`src/core/templates/workflows/`）后必须依次：
   `pnpm build && pnpm generate:skills` —— 否则 `test/skills-parity.test.ts` 失败
2. **改模板正文的命令**时同步更新 `allowedTools` 字段 —— 否则技能在 Claude Code 中被权限拦截
   （`test/allowed-tools.test.ts` 会拦截部分回归）
3. **新增 CLI 命令**：`src/commands/<name>.ts` + `src/cli/index.ts` 注册 +
   `src/commands/completion.ts` 的 `VENUS_COMMANDS` 表同步（补全覆盖）
4. **新增技能类型**：`src/core/config.ts` 的 `SKILL_TYPES` 加条目，类型体系即 7→N 类
5. **YAML 转义**：含冒号/引号的 frontmatter 值必须走 `escapeYamlValue`
6. Windows 兼容：路径断言用 `replaceAll('\\', '/')` 归一化；`path.join` 不硬编码分隔符
7. **spec 模板单一源（已落地）**：`workflows/spec-*.ts` 的正文仅维护 skill 版
   `getSpecXxxSkillTemplate().instructions`（唯一源），command 版 content 由
   `derive-command.ts` 的 `deriveCommandContent()` 从唯一源派生 —— 禁止直接编辑
   派生产物或另立手工字符串。裁剪段落用 `<!-- CMD:SKIP -->` / `<!-- /CMD:SKIP -->`
   成对标记（仅 skill 版可见）；未标记段落默认进入 command 版（fail-safe：漏标
   只会让 command 更长，不会缺失防护语句）；Guardrails 段永不标记。改动模板后
   仍须依次 `pnpm build && pnpm generate:skills`（见第 1 条）

## 项目约定

- 技能名强制 `venus_` 前缀；frontmatter `metadata.type` 必须是 `SKILL_TYPES` 之一
- SKILL 正文中文；代码注释中文；标识符英文
- `update` 的手改保护依赖 frontmatter `generatedBy` —— 生成路径必须写全该字段
- 指令 id 派生：`venus_tr_tools_pwd` → `tr-tools-pwd`（下划线转连字符，去前缀）
- `.venus/`（本项目配置）与 `.claude/`（dogfood 产物）都提交到 git
- 提交信息：Conventional Commits 一行式，中文描述
