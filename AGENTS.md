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
│   ├── update.ts                     venus update（内容指纹 + 手改保护）
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
│       ├── fingerprint.ts            产物内容指纹（手改保护判定信号）
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
8. **版本号更新**：完成功能变更时同步更新版本号与变更日志，二者**随本次功能提交一并提交**
   （不再单独提交 `chore: 版本号`）。以 `package.json` 当前 `version` 为基线，按改动大小递增：

   | 改动性质 | 典型情形 | 递增位 |
   |---|---|---|
   | BREAKING（不兼容） | 删技能、改注册结构、改 CLI 行为或参数、改 frontmatter 契约 | major |
   | 功能新增或变更 | 新增技能或命令、改技能模板行为、改派生规则 | minor |
   | 修复/文档/重构/测试/构建 | bug 修复、README/AGENTS 文档、纯重构、测试调整 | patch |

   - `package.json` 的 `version` 字段按上表递增；判定有歧义时取**较大**的递增位
   - `CHANGELOG.md` 把 `[Unreleased]` 中已累积的条目归档为 `## [<新版本>] - YYYY-MM-DD`
     小节（Keep a Changelog 格式，沿用 `### BREAKING` / `### Added` / `### Changed` 子标题），
     保留一个空的 `## [Unreleased]` 供后续累积，并同步文件底部的链接引用定义
     （`[Unreleased]` 的比较基线改为新版本 tag，新增 `[<新版本>]` 的 compare/tag 链接）
   - 其它出现版本号的位置同步更新（当前为 `README.md` 安装验证中的 `venus --version` 输出示例；
     新增此类引用时一并纳入本规则）
   - 版本号写入生成产物 frontmatter 的 `generatedBy`（供 `venus show` 展示），
     **不参与**手改保护判定 —— 保护由 `generatedFingerprint`（内容指纹，见
     `src/core/command-generation/fingerprint.ts`）承担
   - `.claude/` dogfood 产物**不入库**（见「项目约定」）—— 刷新与否不影响提交，
     故递增版本号无需同步刷新它；本机需要刷新时也没有操作顺序要求（旧实现只用
     `generatedBy` 推断手改，导致"模板正文变更但版本号未递增"时产物被误判手改、
     只能 `--force`；改用内容指纹后，未被改动的产物无论版本号是否递增都能安全升级）

## 项目约定

- 技能名强制 `venus_` 前缀；frontmatter `metadata.type` 必须是 `SKILL_TYPES` 之一
- SKILL 正文中文；代码注释中文；标识符英文
- `update` 的手改保护依赖 frontmatter `generatedFingerprint`（内容指纹）—— 生成路径必须写全该字段；
  无该字段的存量产物回退到 `generatedBy` 版本号判定
- 指令 id 派生：`venus_tr_tools_pwd` → `tr-tools-pwd`（下划线转连字符，去前缀）
- 本机产物均**不入库**（`.gitignore` 忽略）：`.venus/`（本项目配置）、`.claude/`（dogfood 产物）、
  `openspec/`（本地产物）、`.codegraph/`。模板的可提交真源是 `skills/` 静态快照；
  `.claude/` 仅供本机 Claude Code 使用，其旧内容曾入库、现由 `.gitignore` 整体排除
- 提交信息：Conventional Commits 一行式，中文描述
