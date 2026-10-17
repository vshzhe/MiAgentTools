# AGENTS.md

面向 AI 编码代理（Claude Code 等）的仓库导航。人类读者请从 [README.md](README.md) 开始。

## 这是什么项目

AI Agent 技能生成与管理 CLI：按技能类型（`init` / `impl` / `test` / `commit` / `review` / `release` / `tools` / `docs` / `spec`）生成 `iagent_` 前缀的 SKILL 与斜杠指令，安装到目标项目的 `.claude/` 目录。技能名以功能命名，类型只写入 frontmatter `metadata.type`。TypeScript + Commander.js + ESM，参考 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 的三层架构。

技术栈：TypeScript 5.9 + Node.js 20+ + pnpm 10 + Commander.js 14 + Vitest 3 + sql.js

## 仓库地图

```text
src/
├── cli/index.ts                      CLI 入口（Commander 程序，全部 11 个命令注册处）
├── commands/                         命令实现（每个命令一个文件）
│   ├── init.ts                       iagent init
│   ├── list.ts                       iagent list（scanInstalledSkills 被 show 复用）
│   ├── validate.ts                   iagent validate
│   ├── update.ts                     iagent update（内容指纹 + 手改保护）
│   ├── generate.ts                   iagent generate（骨架 + .iagent 配置注入）
│   ├── uninstall.ts                  iagent uninstall（dry-run 预览 + 安全边界）
│   ├── show.ts                       iagent show（模糊匹配 + 详情）
│   ├── completion.ts                 iagent completion（bash/pwsh 补全脚本生成与安装）
│   ├── onboarding.ts                 init 后的引导提示
│   ├── spec.ts                       iagent spec 子命令组（new / status / instructions / validate / migrate / archive / reindex / render / sidecar）
│   └── config.ts                     iagent config（交互式 workflow 配置）
├── core/
│   ├── config.ts                     常量中心：SKILL_PREFIX、9 类 SKILL_TYPES、AI_TOOLS
│   ├── project-config.ts             .iagent/ 配置读写（config.yaml + rules/）
│   ├── templates/
│   │   ├── types.ts                 SkillTemplate / CommandTemplate 接口
│   │   ├── registry.ts              模板注册表 + deriveCommandId 派生规则 + 指令白名单回填
│   │   ├── tool-whitelist.ts        白名单共享常量（CodeGraph MCP 双写 / 派发条目 / 委派条目生成）
│   │   ├── command-references.ts    指令引用单一源（规范形 /iagent:<id> + 按工具布局改写 + KNOWN id 派生）
│   │   ├── derive-command.ts        spec 模板 command 压缩版派生（CMD:SKIP 标记裁剪）
│   │   ├── prompt-gate.ts          提示门控逻辑
│   │   ├── flowchart-gate.ts       流程图门控
│   │   └── workflows/              技能模板（中文正文）：功能名命名的 *.ts + spec-*.ts 共 20 个模板
│   ├── permissions.ts               会话级权限载体（settings.json 的 permissions.allow 非破坏合并）
│   ├── command-generation/
│   │   ├── types.ts                 ToolCommandAdapter 接口（多工具扩展点）
│   │   ├── generator.ts             generateSkillContent / generateCommand
│   │   ├── fingerprint.ts           产物内容指纹（手改保护判定信号）
│   │   ├── yaml.ts                  YAML 转义
│   │   └── adapters/                指令适配器（claude / pi / opencode；codex 无适配器）
│   ├── spec/                        规格驱动工作流
│   │   ├── schema.ts               内置 spec-driven 依赖图（Markdown 输出路径）
│   │   ├── status.ts               Markdown 状态查询（done/ready/blocked/invalid）
│   │   ├── archive.ts              变更归档
│   │   ├── instructions.ts         Markdown 模板分发
│   │   ├── new-change.ts           新变更创建
│   │   ├── parser/                 Markdown 解析（公共 + proposal/design/spec/tasks）
│   │   ├── model/artifact-model.ts 运行时类型（Markdown 唯一真源）
│   │   ├── validation/             结构校验 + Scenario→Task 追溯
│   │   ├── migration.ts            显式 JSON → OpenSpec Markdown 迁移
│   │   ├── legacy-artifacts.ts     历史 JSON 只读兼容边界
│   │   ├── markdown-index.ts       Markdown → SQLite 索引
│   │   ├── index-cache.ts          索引内容指纹缓存
│   │   ├── sqlite-index.ts         SQLite 索引后端
│   │   ├── sqlite-memory-backend.ts SQLite 内存后端（sql.js WASM）
│   │   ├── sidecar-schema.ts       历史 JSON schema（@deprecated，仅兼容读取）
│   │   ├── sidecar-writer.ts       历史 JSON 读写 / tasks.md 渲染（@deprecated，仅兼容）
│   │   └── templates/index.ts      规格模板
│   ├── profiles.ts                  框架档案
│   ├── dependencies.ts              依赖检测（codegraph / openspec）
│   ├── project-scan.ts              项目预扫描（scan-baseline.json）
│   ├── reconcile.ts                 孤立产物协调
│   ├── shell-completion.ts          shell rc/profile 路径解析与标记块增删（补全与迁移共用）
│   └── legacy-migration.ts          旧装机一次性迁移（旧标识常量 + 映射表的唯一落点）
└── utils/file-system.ts             文件系统工具

test/                                vitest（29 个测试文件 + setup）
test/setup-home-sandbox.ts           vitest setupFiles：把主目录沙箱到临时目录
skills/                              静态快照（勿手编，pnpm generate:skills 生成）
scripts/generate-skills.mjs          快照生成脚本
docs/project/                        项目知识文档（五类语义扫描产物）
```

## 常用命令

```bash
pnpm install            # 安装依赖
pnpm build              # 构建（tsc → dist/）
pnpm test               # 全量测试
pnpm lint               # eslint（src/ + test/）
pnpm generate:skills    # 重新生成 skills/ 快照（改模板后必须运行）
node bin/iagent.js <cmd> # 直接运行 CLI
```

`pnpm test` 经 `test/setup-home-sandbox.ts`（vitest `setupFiles`）把用户主目录指向临时目录：
`init` / `update` 内置的旧装机迁移会读写主目录下的旧补全产物与 rc/profile，测试不得触碰
开发者本机的真实主目录。需要指定主目录的用例请显式注入 `homeDir`（迁移接口）或 `env`
（CLI 子进程）。CLI 端到端用例跑的是 `bin/iagent.js` → `dist/`，改 CLI 行为后须先 `pnpm build`。

## 旧装机升级（venus → iagent）

2.0.0 的破坏性改名后，既有装机的清理与配置搬运由 `src/core/legacy-migration.ts` 承担，
内置于 `init` / `update` 入口。两条边界（用户可见的行为契约）：

- **旧产物一律删除**：各工具目录下旧前缀技能与旧命名空间指令整体删除，**不区分是否被手工修改过**
  （丢失风险以报告告警对冲，不做备份——备份目录需用户手动清理且会在下次 init 造成重复备份）
- **配置内容保真搬运**：`context`、自写规则行、注释行、未知段与自定义字段逐字保留；只有类型
  （`rules:` 列表与 `rules/*.md` 文件名）与 `workflows:` 列表按映射改名。搬运走 `project-config.ts`
  的逐行段替换，**MUST NOT** 重新序列化 YAML

告警含义、`--no-migrate` 用法、升级前动作与边界场景表见 [docs/upgrade-guide.md](docs/upgrade-guide.md)。

## 修改守则

1. **改技能模板**（`src/core/templates/workflows/`）后必须依次：
   `pnpm build && pnpm generate:skills` —— 否则 `test/skills-parity.test.ts` 失败
2. **改模板正文的命令**时同步更新 `allowedTools` 字段 —— 否则技能在 Claude Code 中被权限拦截
   （`test/allowed-tools.test.ts` 会拦截部分回归）。白名单按**三层**组合，新增条目必须走
   `src/core/templates/tool-whitelist.ts` 的共享常量，不得逐模板手写：

   | 层 | 内容 | 约束 |
   |---|---|---|
   | 只读检索 | `Read` / `Glob` / `Grep` | 按正文实际使用，不无差别补齐 |
   | 调用类 | CodeGraph MCP、`Skill(<裸名>)`、`Agent, Task` | 见下列四条规则 |
   | 技能专有 | `Bash(...)` / `Write` / `Edit` | 只增不减地维持现状，MUST NOT 扩大 |

   - **MCP 双写**：用 CodeGraph 的技能同时写 `${CODEGRAPH_MCP}`（裸服务器形式 + 9 个具名工具）——
     服务器级形式有失效报告，双写使任一路径生效；CLI 形态 `Bash(codegraph:*)` 与 MCP 工具名是
     **两套命名**，互不覆盖
   - **委派逐技能枚举**：写 `${skillDelegation([...])}` 产出 `Skill(<裸名>)` 精确条目
     （裸名 = 技能名去掉 `iagent_` 前缀，如 `spec_apply`、`requirement_doc`；写成全名
     `Skill(iagent_spec_apply)` 会产出永不放行的死条目），**禁用** `Skill(*)`；
     清单须逐条读正文核准，**MUST NOT 采信 grep 结果**（散文提及他技能名不构成委派）
   - **派发按实放行**：仅正文**确有派发动作**的技能写 `${SUBAGENT_DISPATCH}`（`Agent, Task` 新旧名双写）
     ——授权面向子代理传递，不整类放行；仅错误处理段落提及「子代理失败」不构成派发
   - **指令白名单派生自配对技能**：斜杠指令的白名单与其配对技能**完全一致**（由 `getCommandTemplates()`
     单点回填），不得硬编码或另立第二份真源。`CommandTemplate.allowedTools` 为**可选**（工厂不知配对技能），
     `CommandContent.allowedTools` 为**必填**（作为存在性强制点）

   **会话级载体**：技能 frontmatter 的授权仅覆盖调用当轮，跨轮次管线需会话级放行 —— `iagent init` /
   `iagent update` 会把本工具集条目**非破坏合并**进 `.claude/settings.json` 的 `permissions.allow`
   （见 `src/core/permissions.ts`：不删既有条目、不碰 `deny`、过滤 `Bash(*)`、非法 JSON 保留原文件、幂等）
3. **新增 CLI 命令**：`src/commands/<name>.ts` + `src/cli/index.ts` 注册 +
   `src/commands/completion.ts` 的 `IAGENT_COMMANDS` 表同步（补全覆盖）
4. **新增技能类型**：`src/core/config.ts` 的 `SKILL_TYPES` 加条目，类型体系即 9→N 类
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
   - 其它出现版本号的位置同步更新（当前为 `README.md` 安装验证中的 `iagent --version` 输出示例；
     新增此类引用时一并纳入本规则）
   - 版本号写入生成产物 frontmatter 的 `generatedBy`（供 `iagent show` 展示），
     **不参与**手改保护判定 —— 保护由 `generatedFingerprint`（内容指纹，见
     `src/core/command-generation/fingerprint.ts`）承担
   - `.claude/` dogfood 产物**不入库**（见「项目约定」）—— 刷新与否不影响提交，
     故递增版本号无需同步刷新它；本机需要刷新时也没有操作顺序要求（旧实现只用
     `generatedBy` 推断手改，导致"模板正文变更但版本号未递增"时产物被误判手改、
     只能 `--force`；改用内容指纹后，未被改动的产物无论版本号是否递增都能安全升级）

## 项目约定

- 技能名强制 `iagent_` 前缀，命名方案：`iagent_<功能名>`（下划线分词）。功能名 MUST NOT 含生命周期类型段；
  承载「依赖 openspec/ 与 openspec CLI」的技能保留 `spec_` 领域段（如 `iagent_spec_propose`）。
  类型只出现在 frontmatter `metadata.type`（必须是 `SKILL_TYPES` 之一）、`.iagent/rules/<type>.md`
  文件名与 `iagent generate --type` 参数中，不进技能名
- 类型体系（9 类）：`release` / `tools` 为**预留类型**（`SkillTypeMeta.reserved`，当前无内置技能，仍可用于
  `iagent generate --type`）；`impl` 语义为「实现域编排」；`review` 语义为「审查 / 检查」（含
  `iagent_review` / `iagent_proposal_review` / `iagent_migration_check`）；`spec` 兼具类型 id 与名称领域段
- 技能 `description` 统一结构：**中文一句话用途 + 触发词（中英）+ `NOT for …（改用 X）` 排歧**；长度
  ≤ 1024（硬，Agent Skills 上限）、≥ 800 软告警；英文化改写 MUST 保留原英文触发关键词
- 技能主 `SKILL.md` 渐进披露：行数 ≤ 500（`test/skill-size-budget.test.ts` 守护）；主文件保留触发/阶段骨架/
  确认门/委派清单/护栏，参考性明细下沉 `references/*.md` 并以 `Read references/...` 引导按需加载
- 模板正文中的指令引用以**规范形** `/iagent:<id>` 书写（单一源 `command-references.ts`），生成期按工具
  布局改写（Pi 为 `/iagent-<id>`）；未注册 id 由 `test/command-reference-refs.test.ts` 拦截
- `iagent generate` 组合规则为 `<技能前缀><name 参数>`，类型仅写入 `metadata.type`
- `.iagent/` 在本工具中有三处独立含义，改动时勿混为一谈：① 项目配置目录（`config.yaml`、`rules/`、
  `scan-baseline.json`）；② 变更目录下的遗留 sidecar 目录（`SIDECAR_DIR`，@deprecated 布局）；
  ③ 跨变更索引目录（`INDEX_DB_PATH` 所在）
- 品牌标识 vs 产品领域名：`venus`（小写品牌 token：`venus_` / `.venus` / `/venus:` / `commands/venus` /
  `VenusAgentTools`）属本工具品牌；`Venus4A` / `Venustech` / SVN 仓库路径 `/svn/venus/` /
  `E:\WorkSpaces_ahdx\Venus4A` 属产品与仓库领域名，仅作历史 / 示例语境出现，**MUST NOT**
  当作旧品牌 token 替换，也**不得进入技能模板的条件分支**。
  Venus4A 专用能力（`frontend` JSP 前端、`package` auto-package 打包及其运行时
  `vendor/auto-package-svn/`）已移除；`feature-doc` 的框架档案与 `proposal-review` 的
  语言/框架专项检查改为**运行时按项目实际信息探测**（读 `.iagent/config.yaml` 的 context/rules
  与既有源码 / 构建文件），**不内置任何框架预设**
- 旧品牌 token（`venus_` / `.venus` / `commands/venus` / `VENUS-COMPLETION` 等）的唯一代码落点是
  `src/core/legacy-migration.ts`（旧值常量与「旧新标识映射表」），**MUST NOT** 在其它生产代码中新增
  旧 token 字面量。`LEGACY_WORKFLOW_ID_MAP` 是该映射表的唯一真源：新增/改名技能后若映射目标与注册表
  的 `commandId` 集不一致，`test/legacy-migration.test.ts` 立即失败（映射不可能静默漂移）
- 旧装机迁移内置于 `init` / `update` 入口（无独立命令），**必须最先执行**：先于配置读取与产物生成，
  也先于 reconcile 扫描 —— 否则旧产物会被误报为「不在生效 workflows 配置中」的孤立产物。
  改动 `init` / `update` 的步骤顺序时须保持这一前置关系
- 指令产物布局（`namespace-dir` / `prefixed-file`）与归属识别 MUST 走单一来源
  `src/core/command-artifacts.ts`：适配器取落点，reconcile / uninstall / 旧位置清理做识别与删除。
  Pi 的指令目录是 `.pi/prompts/`（扁平 `iagent-<id>.md`，与 OpenSpec 的 `opsx-*` 共目录），
  OpenCode 的指令目录是 `.opencode/commands/`（扁平 `iagent-<id>.md`），
  **MUST NOT** 退回 `.pi/commands/` 子目录；`prefixed-file` 删除只认 `iagent-` 前缀、不删承载目录
- OpenCode 为**可选（opt-in）工具**：`AI_TOOLS` 条目带 `optIn: true`，未配置 `tools` 的默认回退集不含它，
  仅 `--tools opencode` 或 `config.yaml` 的 `tools` 显式列出时生成；其 `sessionPermissions: false`
  （权限走 `opencode.json` 的 `permission` 段，不写 `.opencode/settings.json`）
- 工具选择持久化：`iagent init` 回写 `config.yaml` 的 `tools` 字段，`iagent update` 仅显式 `--tools` 时回写
- 自定义 iagent 流程为 **Markdown-first**：新变更以 `proposal.md`、`design.md`、
  `specs/<capability>/spec.md`、`tasks.md` 为唯一可编辑真源；CLI `--json` 仅为机器响应，不写回制品。
  技能逐个任务在 `tasks.md` 上勾选；`iagent spec render` 仅保留渲染兼容提示（不再生成/覆盖 tasks.md）。
  历史 `change.json` / `tasks.json` 只读兼容，通过 `iagent spec migrate --from-json` 显式迁移。
  新增能力或模板时 MUST NOT 重新引入 JSON 主产物（`test/markdown-first-regression.test.ts` 回归锁）
- SKILL 正文中文；代码注释中文；标识符英文
- `update` 的手改保护依赖 frontmatter `generatedFingerprint`（内容指纹）—— 生成路径必须写全该字段；
  无该字段的存量产物回退到 `generatedBy` 版本号判定
- 指令 id 派生：`iagent_spec_apply` → `spec-apply`（下划线转连字符，去前缀）
- 本机产物均**不入库**（`.gitignore` 忽略）：`.iagent/`（本项目配置）、`.claude/`（dogfood 产物）、
  `openspec/`（本地产物）、`.codegraph/`。模板的可提交真源是 `skills/` 静态快照；
  `.claude/` 仅供本机 Claude Code 使用，其旧内容曾入库、现由 `.gitignore` 整体排除
- 提交信息：Conventional Commits 一行式，中文描述