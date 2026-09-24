# Changelog

本项目的全部显著变更记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

（暂无）

## [1.1.1] - 2026-09-24

### Added

- 新增 `.gitattributes`：`* text=auto eol=lf` 统一仓库行尾为 LF。修复的环境问题：
  `core.autocrlf=true` 且无 `.gitattributes` 时，checkout/merge 会把工作区中内容有变化的
  文件转为 CRLF，而 `skills/**` 静态快照与模板生成结果恒为 LF（vite 转换 TS 时归一行尾），
  `skills-parity` 的字节级比较随即误报漂移（实测 13 个快照失配）。显式声明后任何 clone /
  checkout 都产出 LF，该测试与环境配置解耦
- `.gitignore` 补充预防性条目：`coverage/`、`*.tsbuildinfo`、`.eslintcache`、
  `.claude/settings.local.json`（当前仓库中均不存在）

### Changed

- `vitest.config.ts` 配置 `testTimeout: 20000`：默认 5s 对 shell 调用外部 CLI 的用例
  （`spec-commands` 的 venus↔openspec 互认校验，单跑约 3.9s）余量不足，全量并发下会间歇性
  超时失败（先例 commit `5ed5f20` 亦记录过同一现象）

### 核验澄清

- 本次**未改动任何已提交内容**：经 `git cat-file -p` 逐字节核实，仓库全部 blob 本就以 LF
  存储（`vendor/auto-package-svn/*` 与 `skills/venus_release_package/scripts/*.sh` 的 CR 字节
  数为 0），`git add --renormalize .` 亦无内容变更。此前观察到的 CRLF 仅存在于**工作区副本**
  （checkout 经 `core.autocrlf=true` 转换所致）—— 故本次新增 `.gitattributes` 属**行为性声明**
  （此后 checkout 产出 LF），非内容规范化。注意 `git show <rev>:<path>` 会应用行尾转换，
  测量 blob 行尾须用 `git cat-file -p`

## [1.1.0] - 2026-09-24

### Added

- **功能流程图制品与提案交叉验证**：5 个工作流技能（explore / workflow /
  auto-workflow / debug / genfull）在探索阶段产出结构化流程制品
  （Mermaid 流程图 + 关键操作节点清单），经**流程最终确认门**确认后成为
  propose / verify 的**流程基准** —— 独立于提案自身的交叉验证锚点
- 新增模板层唯一源模块 `src/core/templates/flowchart-gate.ts`：承载制品文本与
  两套场景列集（需求版 / 缺陷链路版），以 `buildFlowchartBlock(columns)` 参数化
  渲染、`buildFlowchartCompact(columns)` 压缩渲染，构建期内联进各技能正文
  （不新增技能，技能总数保持 27）
- 产出强度分级：4 个流程类技能（workflow / auto-workflow / genfull / debug）
  **强制产出**；`venus_spec_explore` **条件触发**（无业务功能流程时记录
  「本次无功能流程」直通），不改变其「无固定步骤、无强制产出」定位
- 节点准入规则：节点粒度 = 可独立验证的业务操作单元；每节点 MUST 可追溯代码
  证据（`文件:行`），**新建功能**节点标 `[新建]` + 预期产物（不要求预测文件路径），
  无法追溯证据的节点 MUST NOT 进入清单（反幻觉）
- 调试技能缺陷链路变体：只覆盖缺陷相关节点（前置条件 → 触发 → 异常 → 根因），
  新增 `🔴异常` / `🟠根因` 标记；Phase 4 验证口径改为覆盖「异常节点 + 根因节点」
- 编排技能（genfull）Bridge 1 新增流程图**兜底补建 + 确认**步骤（探索阶段未产出时
  依探索产物强制补建，并入桥梁门决策），并具备幂等性
- 提案技能以流程基准为生成锚点：设计引用流程图与节点清单；任务逐个标注对应节点
  标识（`[N4]` 形）；流程图缺失或未获确认时降级为仅凭探索产物生成并标注降级
- 提案验证技能新增维度 **D10 流程图节点覆盖度**：`覆盖度 = 被覆盖节点数 ÷ 总节点数`，
  与既有维度同权重纳入 90% 统一阈值；优先按节点标识显式标注匹配、未标注时辅以
  语义等价判定；无 `## 功能流程图` 段时该维度 SKIP（不计入分母、不判 FAIL）；
  评分不足时逐条列出未覆盖节点标识与操作名
- 与既有 D9（Business Steps）职责分离互补：D9 检查提案自身是否拆解复杂操作
  （自证），D10 与外部流程基准比对（他证）；D9 保留不动
- `openspec/CONTEXT.md` 新增 6 条术语：功能流程图 / 关键操作节点 / 流程最终确认门 /
  节点覆盖度 / 流程基准 / 缺陷链路，并与既有「提示词基线」「业务流程图」「D9」显式划界

### Changed

- `venus_spec_verify_proposal` 维度数由 9 增至 10（描述、章节标题、总分公式的
  维度区间与触发维度表同步更新）

## [1.0.1] - 2026-09-24

### Added

- `AGENTS.md` 新增「修改守则」第 8 条：**版本号更新规则** —— 完成功能变更时按 SemVer
  三段（BREAKING → major / 功能新增或变更 → minor / 修复·文档·重构·测试·构建 → patch）
  递增 `package.json` 的 `version`，把 `[Unreleased]` 归档为对应版本小节并同步底部链接引用，
  二者**随本次功能提交一并提交**（不再单独提交 `chore: 版本号`）
- `README.md` 安装验证示例中的 `venus --version` 输出同步为当前版本号

## [1.0.0] - 2026-09-24

### BREAKING

- `venus init` 默认行为变化：从全量安装 14 个技能改为安装默认集 7 个
  （`tr-init-project` + spec 全 6：explore/propose/apply/archive/verify/verify-proposal）。
  已安装的产物不会被自动删除（reconcile 仅提示），需恢复全量可执行
  `venus config --set tr-init-project,tr-impl-feature,tr-test-generate,tr-commit-change,tr-review-code,tr-release-version,tr-tools-pwd,tr-tools-list,spec-explore,spec-propose,spec-apply,spec-archive,spec-verify,spec-verify-proposal`

### Added

- profile 配置机制：`.venus/config.yaml` 新增 `workflows` 字段声明本项目要安装的
  workflow，`venus init` / `venus update` 据此过滤生成；字段缺失时使用默认集（7 项）
- 依赖注入自动补全：选了 `spec-propose` 自动补 `spec-verify-proposal`
  （提案评分门），选了 `spec-archive` 自动补 `spec-verify`（归档前验证），
  补入项在输出中提示
- `venus config` 命令三模式：交互式勾选（@inquirer/prompts checkbox）/
  `--show` 打印生效集（含来源与注入标注）/ `--set <list>` 非交互设置（脚本/CI 用，
  非法 id 报错退出非零）
- reconcile 检测提示：init/update 扫描已安装但不在配置集内的 venus 产物，
  保留不删，输出清单提示手工处理（`venus uninstall` 或手动删除）
- onboarding 引导按生效 workflow 集动态过滤（默认集 7 项）
- 新增运行依赖 `@inquirer/prompts`（交互式 checkbox）
- 迁移技能套件三技能（源自 OpenSpec 项目 auto-migration/feature-doc/migration-check
  三功能，语言无关化适配）：
  - `venus_tr_docs_feature_doc`（指令 `tr-docs-feature-doc`，新增第 9 类 `tr_docs` 文档类）：
    扫描源项目功能模块生成功能需求实现文档（4 种输出模式 / 框架档案 / 4 类流程图 /
    反幻觉规则 / CodeGraph 优先自动降级）
  - `venus_tr_impl_migration_check`（指令 `tr-impl-migration-check`）：迁移后源/目标
    六层一致性检查（Controller/Service/DAO/前端/SQL/数据库）+ C1-C6 对抗检查 +
    P0/P1/P2 分级 + 写回验证
  - `venus_tr_impl_auto_migration`（指令 `tr-impl-auto-migration`）：一站式自动迁移编排
    （蒸馏确认门 → 规范加载与提案 → 实现确认门 → 评审子代理与修复循环）
  - 依赖注入：选 `tr-impl-auto-migration` 自动补 `tr-docs-feature-doc` 与
    `tr-impl-migration-check`（编排技能依赖两子技能）
  - 三技能均不入默认集（可选扩展件），经 `.venus/config.yaml` 的 `workflows` 勾选安装

- 工作流技能套件五技能（源自 OpenSpec 项目 workflow/auto-workflow/debug/
  create-requirement-doc 四功能 + 用户级 openspec-proposal-review 定制版，
  语言无关化适配）：
  - `venus_tr_impl_workflow`（指令 `tr-impl-workflow`）：一站式引导工作流
    （结构化探索 checkpoint 体系 + grill 追问 L1-L5 → 提案内联生成 + CLI 降级 →
    自动验证门 → 深度复查与需求文档联动）
  - `venus_tr_impl_auto_workflow`（指令 `tr-impl-auto-workflow`）：全自动管线
    （探索 → 提案 → 验证 → auto-apply（auto-mode=true）→ auto-archive 五阶段）
  - `venus_tr_impl_debug`（指令 `tr-impl-debug`）：一站式调试工作流
    （强制复现 → CodeGraph 分层排查 + 根因确认门 → 关联变更判定 →
    修复 + 强制回归测试调试循环 → 编译检查 → 同步提案 → 验证）
  - `venus_tr_docs_requirement_doc`（指令 `tr-docs-requirement-doc`）：变更提案转
    八章节评审需求文档（双执行模式 / 场景分组 / 伪代码注入规则 / 归档状态输出路由）
  - `venus_tr_impl_review_proposal`（指令 `tr-impl-review-proposal`）：提案完整性复查
    （深度代码库探索 + 8 维度完整性检查 + 合规性验证 + 量化评分；
    Java/Venus4A 专项检查按项目特征触发）
  - 依赖注入（不动点迭代，连带补全传递依赖）：选 `tr-impl-workflow` 自动补
    `tr-impl-review-proposal` 与 `tr-docs-requirement-doc`；选
    `tr-impl-auto-workflow` 自动补 `tr-impl-workflow` 与 `tr-docs-requirement-doc`
    （并连带其依赖）；选 `tr-impl-debug` 自动补 `tr-docs-requirement-doc` 与
    `spec-verify-proposal`
  - 五技能均不入默认集（可选扩展件），经 `.venus/config.yaml` 的 `workflows` 勾选安装

- 共享制品生成协议：新增 `openspec/rules/artifact-generation.md`
  （G1 创建变更 → G2 status/instructions 依赖序循环 → G3 终态确认），
  供 `venus_tr_impl_workflow` 与 `venus_spec_propose` 共同引用，
  同时修复 `venus_spec_propose` 正文对该路径的悬空引用

- 生态引用闭环：`tr-docs-feature-doc` 恢复 NOT-for 边界引用指向
  `tr-docs-requirement-doc`；`tr-impl-auto-migration` 补充
  `/venus:tr-impl-workflow` 完整工作流选项引用（上次迁移因无对应物删除）

- `venus init` 依赖自检与自动安装：检测 codegraph CLI / 用户级 MCP 注册、
  openspec CLI / 项目 `openspec/` 目录，缺失时自动执行
  （`npm install -g`、`claude mcp add codegraph -s user`、`openspec init --tools claude`），
  作为后续功能集成的基础；已存在的依赖只检测不升级，
  安装失败仅警告不阻断主流程，`--no-deps` 可跳过

- 新增技能 `venus_tr_commit_push`（指令 `tr-commit-push`，迁移自源 SKILL tr-commit-push 并新增
  提案分类提交）：SVN 交互式提交——四环节强制确认（提交范围 → 内容清单与功能描述 →
  知识库推送询问 → 最终确认，缺一不可）、提交范围排除（target/、*.class 等编译产物永不提交，
  优先级最高）、UTF-8 无 BOM 注释落盘 + `--encoding UTF-8 -F`、SVN 证书/凭据处理
  （E230001/E215004，密码仅内存与 stdin）、提交后双验证（svn status + svn log --xml）、
  知识库推送（llm-wiki MCP 逐项确认，单次最多 5 个文件分批）；核心增量提案分类提交——
  `/venus:tr-commit-push 提交 <提案名> 提案` 按提案将变更自动归类功能代码/测试代码/文档三类
  （src/test/**、test/**、*Test.java、*Tests.java、*.test.* 归测试；已纳管 docs/**、其余 *.md、
  已纳管 openspec/ 制品归文档；其余归功能代码），N 笔分类分批提交，每笔提交信息尾行标注
  `提案: <变更名>` 溯源，提案关联校验不阻断由用户裁决，任一笔失败即停不回滚已成功笔。
  现有 `venus_tr_commit_change`（Git 版）行为零变更，两技能按 VCS 划分职责（SVN 项目用
  tr-commit-push、Git 项目用 tr-commit-change）；不入默认集，经 `.venus/config.yaml` 的
  `workflows` 勾选 `tr-commit-push` 安装


## [0.1.0] - 2026-09-08

首个可用版本：按生命周期类型（`tr_*`）分类生成与管理 `venus_` 前缀的 Agent 技能。

### Added

**核心功能**
- 7 类生命周期分类体系：`tr_init`（初始化）/ `tr_impl`（实现）/ `tr_test`（测试）/
  `tr_commit`（提交）/ `tr_review`（审查）/ `tr_release`（版本）/ `tr_tools`（工具）
- 8 个内置中文技能（每类 1 个，`tr_tools` 含 `venus_tr_tools_pwd` 查看当前路径等 2 个）
- 同步生成 Claude Code 斜杠指令（`.claude/commands/venus/<type>-<name>.md`）
- `venus init`：生成全部技能与指令到目标项目，含首次 onboarding 引导
- `venus list`：按类型分组列出已安装技能（`--json` 结构化输出）
- `venus show <query>`：查看技能详情（frontmatter / 类型 / 工具白名单 / 正文预览），
  支持前缀与片段模糊匹配，多命中列出候选
- `venus generate --type <tr_*> --name <kebab>`：按类型生成新技能骨架并安装
- `venus validate`：校验技能规范符合性（`venus_` 前缀 / name=目录名 / 必填字段 /
  类型合法），CRITICAL 时退出码 1，可接入 CI
- `venus update`：升级已安装技能到内置模板最新版，手改保护
  （内容一致幂等跳过 / 旧版本自动升级 / 用户手改跳过并提示，`--force` 覆盖）
- `venus uninstall`：干净移除 venus 管理的技能与指令
  （非 venus 技能不碰；`.venus/` 配置默认保留，`--purge-config` 一并删除）
- `venus completion install|uninstall`：shell 补全（bash 的 compgen +
  PowerShell 的 Register-ArgumentCompleter），标记块管理 rc/profile

**项目配置**
- `.venus/config.yaml`：项目背景（context）+ 规则引用（rules 显式 include）
- `.venus/rules/<type>.md`：按类型的规则文件（每行一条，`#` 注释），
  config 引用顺序即注入顺序，删除引用即停用
- `venus generate` 自动将 context 与对应类型 rules 注入骨架正文

**工程保障**
- 三层架构（模板层 → 生成层 → 命令层），`ToolCommandAdapter` 预留多工具扩展
- 每技能按正文实际命令声明 `allowed-tools` 白名单（防止权限拦截）
- `skills/` 静态快照 + parity 防漂移测试（模板变更未重新生成即失败）
- GitHub Actions CI：Ubuntu + Windows 双平台，build → lint → test → 快照一致性
- eslint（typescript-eslint）
- MIT LICENSE、README（安装/使用/架构）、AGENTS.md、docs/getting-started.md

### Changed

- 项目配置从单文件 `venus.config.yaml` 重构为 `.venus/` 目录结构
  （`config.yaml` 显式引用 `rules/` 下规则文件），重复 init 保留用户全部修改

[Unreleased]: https://github.com/venus-agent-tools/compare/v1.1.1...HEAD
[1.1.1]: https://github.com/venus-agent-tools/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/venus-agent-tools/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/venus-agent-tools/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/venus-agent-tools/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/venus-agent-tools/releases/tag/v0.1.0
