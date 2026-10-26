# Tasks: iagent-rebrand

## 常量锚点与类型体系

- [x] [代码] 1.1 src/core/config.ts：SKILL_PREFIX 改为 'iagent_'、COMMAND_NAMESPACE 改为 'iagent'、TOOL_COMMANDS_SUBDIR 改为 'iagent'；SkillType 联合类型与 SKILL_TYPES 元数据的 9 个 id 去 tr 前缀（tr_init→init 等，spec 不变）；更新文件头注释中的工具名与类型体系说明
  - 对应: agent-tool-identity#身份 token 单一来源
  - 产出文件: `src/core/config.ts`

- [x] [代码] 1.2 src/core/project-config.ts：VENUS_DIR_NAME 改名为 IAGENT_DIR_NAME 且取值 '.iagent'；defaultConfigFileContent 的品牌名注释、rules 列表改为 [impl, test, spec]、默认 workflows 列表改为新 id（project-init / spec-explore / spec-propose / spec-apply / spec-archive / spec-verify / spec-verify-proposal）；defaultRuleFileContent 的键改为 impl/test/spec 并同步 rules/ 下默认规则文件名；ensureProjectConfig 的默认规则文件类型列表同步
  - 依赖: 1.1
  - 对应: agent-tool-identity#类型 id 集
  - 产出文件: `src/core/project-config.ts`

- [x] [代码] 1.3 src/core/project-scan.ts：SCAN_BASELINE_PATH 与写入路径引用改名后的配置目录常量，确认扫描基线落盘于 .iagent/scan-baseline.json
  - 依赖: 1.2
  - 对应: agent-tool-identity#身份 token 单一来源
  - 产出文件: `src/core/project-scan.ts`

- [x] [代码] 1.4 src/commands/generate.ts：技能名组合规则由 `${SKILL_PREFIX}${type}_${name}` 改为 `${SKILL_PREFIX}${name}`；类型仅写入产物 frontmatter 的 metadata.type；同步 --type 参数的描述文案
  - 依赖: 1.1
  - 对应: agent-tool-identity#generate 名称组合规则
  - 产出文件: `src/commands/generate.ts`

## 技能模板重命名

- [x] [代码] 2.1 重命名 26 个模板文件名，与技能新名对齐（去 tr 前缀、genfull→full-workflow、auto-migration→migration、commit-push→svn-commit、docs-feature-doc→feature-doc、docs-requirement-doc→requirement-doc、init→project-init、review-proposal→proposal-review、release-package→package、tools→tools 拆分保留等）；同步 registry.ts 的 import 路径。文件级映射：tr-init.ts→project-init.ts、tr-impl.ts→feature.ts、tr-impl-workflow.ts→workflow.ts、tr-impl-genfull.ts→full-workflow.ts、tr-impl-auto-workflow.ts→auto-workflow.ts、tr-impl-debug.ts→debug.ts、tr-impl-frontend.ts→frontend.ts、tr-impl-auto-migration.ts→migration.ts、tr-impl-migration-check.ts→migration-check.ts、tr-impl-review-proposal.ts→proposal-review.ts、tr-test.ts→test.ts、tr-commit.ts→commit.ts、tr-commit-push.ts→svn-commit.ts、tr-review.ts→review.ts、tr-release.ts→version.ts、release-package.ts→package.ts、tr-tools.ts→tools.ts、tr-docs-feature-doc.ts→feature-doc.ts、tr-docs-requirement-doc.ts→requirement-doc.ts、spec-*.ts 保持
  - 依赖: 1.1
  - 产出文件: `src/core/templates/workflows/`, `src/core/templates/registry.ts`

- [x] [代码] 2.2 重命名 26 个模板工厂导出符号，去掉 Tr 前缀并随技能名对齐（如 getTrImplFeatureSkillTemplate → getFeatureSkillTemplate、getTrImplGenfullSkillTemplate → getFullWorkflowSkillTemplate、getTrImplAutoMigrationSkillTemplate → getMigrationSkillTemplate、getTrToolsPwdSkillTemplate → getPwdSkillTemplate、getReleasePackageSkillTemplate → getPackageSkillTemplate）；同步 registry.ts 的全部 import 与 WORKFLOW_PAIRS 调用点
  - 依赖: 2.1
  - 产出文件: `src/core/templates/workflows/`, `src/core/templates/registry.ts`

- [x] [代码] 2.3 逐个更新 26 个模板文件内共 27 个技能模板的元数据：SkillTemplate.name 改为 iagent_ 新名、type 改为去 tr 的类型 id；CommandTemplate.name 展示名由 'Venus: xxx' 改为 'iAgent: xxx'；tags 数组的品牌标签 'venus' 改为 'iagent'、类型标签（'tr_impl'/'tr_tools'/'tr_commit'/'tr_docs'/'tr_release'）改用新类型 id，共 27 处；metadata.author 由 venus-agent-tools 改为 mi-agent-tools，共 26 处，与 generator.ts 的默认值保持一致；description 中出现的旧技能名与旧指令名（如 'use venus_tr_impl_feature'、'迁移自 tr-commit-push'）同步替换
  - 依赖: 2.2
  - 对应: agent-tool-identity#技能命名方案
  - 产出文件: `src/core/templates/workflows/`

- [x] [代码] 2.4 替换 26 个模板正文内共 197 处技能交叉引用与自引用旧名（重灾区：full-workflow 38 处、auto-workflow 25 处、workflow 24 处、debug 21 处、tools 10 处、migration 9 处）；替换依据为 design.context 的 27 项映射表，逐处人工确认而非批量正则
  - 依赖: 2.3
  - 对应: agent-tool-identity#旧标识零残留
  - 产出文件: `src/core/templates/workflows/`

- [x] [代码] 2.5 替换模板正文内的另外两类旧标识引用（与 2.4 的技能名交叉引用并列，不可合并为一次笼统替换）：配置目录路径引用 .venus/ 共 34 处，分布在 8 个模板（frontend 12、release-package 6、proposal-review 6、project-init 4、requirement-doc 3、spec-archive/spec-bulk-archive/spec-explore 各 1），这些是技能运行时指令（如 release-package 要求读 .iagent/config.yaml 的 auto_package.runtime_dir）；指令名引用 /venus: 共 49 处。替换须按标识符边界精确匹配，MUST NOT 触碰正文中的 Venus4A/Venustech 产品域名
  - 依赖: 2.3
  - 对应: agent-tool-identity#模板正文引用分类替换
  - 产出文件: `src/core/templates/workflows/`

## 委派白名单

- [x] [代码] 3.1 src/core/templates/tool-whitelist.ts：skillDelegation 传入的裸名列表与生成的 Skill(...) 条目改为新技能名（裸名仍为去 iagent_ 前缀的形态）；同步函数注释中的裸名约定说明与示例
  - 依赖: 2.2
  - 对应: agent-tool-identity#技能命名方案
  - 产出文件: `src/core/templates/tool-whitelist.ts`

- [x] [代码] 3.2 逐模板核准委派清单：按 AGENTS.md 修改守则第 2 条，逐条阅读模板正文确认实际委派的 Skill 目标，MUST NOT 采信 grep 结果；确认每个 Skill(iagent_xxx) 条目对应的技能确已注册，无死条目、无遗漏
  - 依赖: 3.1, 2.4
  - 对应: agent-tool-identity#技能命名方案
  - 产出文件: `src/core/templates/workflows/`, `src/core/templates/tool-whitelist.ts`

## CLI 与产物标识

- [x] [代码] 4.1 src/core/templates/registry.ts：deriveCommandId 的错误文案与文档示例改用新前缀与新命名；WORKFLOW_PAIRS 的分组注释（'迁移套件（tr_impl）' 等）改用新类型 id 与新技能名
  - 依赖: 1.1, 2.2
  - 产出文件: `src/core/templates/registry.ts`

- [x] [代码] 4.2 src/core/command-generation/generator.ts：frontmatter 默认 metadata.author 由 venus-agent-tools 改为 mi-agent-tools；SKILL_PREFIX 校验的错误文案随常量更新
  - 依赖: 1.1
  - 产出文件: `src/core/command-generation/generator.ts`

- [x] [代码] 4.3 src/core/command-generation/adapters/claude.ts 与 pi.ts：指令输出目录由 commands/venus/ 改为 commands/iagent/（引用 TOOL_COMMANDS_SUBDIR 常量而非硬编码）
  - 依赖: 1.1
  - 对应: agent-tool-identity#指令 id 派生与命名空间
  - 产出文件: `src/core/command-generation/adapters/claude.ts`, `src/core/command-generation/adapters/pi.ts`

- [x] [代码] 4.4 更新 11 个 CLI 模块中的标识符与文案：src/cli/index.ts（Commander 程序名 venus→iagent、描述中的品牌名、init/list/update/completion/uninstall/config/generate 各命令选项说明中的 .venus/ 路径）、init.ts（目录名、品牌名、--no-scan 说明）、list.ts（分组展示名与前缀判定）、show.ts（前缀剥离）、validate.ts（命名与类型校验）、update.ts（路径与前缀）、uninstall.ts（前缀过滤、--purge-config 目录名）、completion.ts（CLI 名与 VENUS_COMMANDS 表改名）、config.ts（workflow id 展示）、spec.ts（目录与品牌文案）、onboarding.ts（引导提示）
  - 依赖: 1.1, 1.2
  - 产出文件: `src/cli/index.ts`, `src/commands/init.ts`, `src/commands/list.ts`, `src/commands/show.ts`, `src/commands/validate.ts`, `src/commands/update.ts`, `src/commands/uninstall.ts`, `src/commands/completion.ts`, `src/commands/config.ts`, `src/commands/spec.ts`, `src/commands/onboarding.ts`

- [x] [代码] 4.5 更新核心模块中的前缀与目录引用：reconcile.ts（孤立产物检测的前缀与指令子目录过滤）、permissions.ts（会话级权限条目中的技能/指令标识）、dependencies.ts 与 profiles.ts（若含品牌文案）
  - 依赖: 1.1
  - 产出文件: `src/core/reconcile.ts`, `src/core/permissions.ts`, `src/core/dependencies.ts`, `src/core/profiles.ts`

- [x] [代码] 4.6 bin/venus.js 改名为 bin/iagent.js（含入口注释）；package.json 更新 name（mi-agent-tools）、description、keywords、bin（iagent）、version（1.18.1 → 2.0.0）
  - 对应: agent-tool-identity#身份 token 单一来源
  - 产出文件: `bin/venus.js`, `package.json`

- [x] [代码] 4.7 .gitignore：.venus/ 条目改为 .iagent/；文件头注释中的品牌名与目录说明同步；确认 .claude/ .pi/ .codex/ .codegraph/ 条目不变
  - 依赖: 1.2
  - 产出文件: `.gitignore`

- [x] [代码] 4.8 为指令侧遍历补空 commandsDir 守卫：uninstall.ts（第 83 行附近的指令目录删除）与 reconcile.ts（第 55 行附近的孤立指令扫描）在 commandsDir 为空字符串时跳过该工具，不做 path.join 拼接——否则会得到项目根下的 venus/ 或 iagent/ 路径，指向与本工具无关的目录；同时为删除目标加「必须位于该工具 skills/ 子目录之下」的边界校验
  - 依赖: 1.1
  - 对应: agent-tool-identity#空指令目录工具的安全遍历
  - 产出文件: `src/commands/uninstall.ts`, `src/core/reconcile.ts`

- [x] [代码] 4.9 更新关联源文件中的品牌标识：src/core/templates/flowchart-gate.ts 与 prompt-gate.ts 的注释技能名列举、src/core/templates/types.ts 的前缀与目录契约说明、scripts/split-frontend-skill.mjs 的硬编码技能名与 metadata.author、build.js 构建日志中的项目名 VenusAgentTools
  - 依赖: 1.1
  - 对应: agent-tool-identity#品牌标识与产品领域名的区分
  - 产出文件: `src/core/templates/flowchart-gate.ts`, `src/core/templates/prompt-gate.ts`, `src/core/templates/types.ts`, `scripts/split-frontend-skill.mjs`, `build.js`

- [x] [代码] 4.10 品牌命名的磁盘产物改名（实施期发现的 4 类非配置目录语义）：src/core/spec/sidecar-writer.ts 的 SIDECAR_DIR 由 '.venus' 改 '.iagent'、src/core/spec/sqlite-index.ts 的 INDEX_DB_PATH 与目录确保逻辑、src/core/spec/sidecar-schema.ts 头部注释中的三个遗留 sidecar 路径、src/commands/spec.ts 的遗留 sidecar 降级读取路径与点目录跳过注释、src/commands/completion.ts 的补全脚本文件名（~/.venus-completion.sh）、PowerShell profile 脚本名（VenusCompletion.ps1）与 rc/profile 标记块常量（COMPLETION_MARKERS 的 VENUS-COMPLETION:START/END）。旧产物的清理不在此任务，由伴生变更承担
  - 依赖: 1.1
  - 对应: agent-tool-identity#品牌命名的磁盘产物一同改名
  - 产出文件: `src/core/spec/sidecar-writer.ts`, `src/core/spec/sqlite-index.ts`, `src/core/spec/sidecar-schema.ts`, `src/commands/spec.ts`, `src/commands/completion.ts`

## 快照与测试

- [x] [代码] 5.1 按 AGENTS.md 修改守则第 1 条顺序执行 pnpm build && pnpm generate:skills，重生成 skills/ 静态快照（27 个技能目录改名 + 54 个文件内容更新）
  - 依赖: 2.4, 3.2, 4.6
  - 产出文件: `skills/`

- [x] [测试][单元][P0] 5.2 更新 26 个测试文件中的名称字面量：技能名、指令名、类型 id、目录名、CLI 名；重点覆盖 skills-parity（字节级快照比较）、allowed-tools（Skill(X) 对应已注册技能）、template-derivation、commands、completion-config、project-scan、tr-init-scan（文件名亦随技能改名）
  - 依赖: 5.1
  - 对应: agent-tool-identity#旧标识零残留
  - 产出文件: `test/`

- [x] [测试][单元][P0] 5.3 执行 pnpm lint 与 pnpm test，确认全绿；失败项按失败信息回溯到映射表修正，不得以放宽断言方式通过
  - 依赖: 5.2
  - 产出文件: `test/`

## 文档

- [x] [使用说明] 6.1 更新 13 篇 docs/ 文档中的标识符与示例命令（skills-manual 约 195 处、genfull-guide、migration-suite-guide、test-generate-guide、getting-started、openspec-comparison 等）；文档文件名随技能改名者一并改名（如 genfull-guide.md → full-workflow-guide.md、migration-suite-guide.md → migration-guide.md）
  - 依赖: 2.3
  - 产出文件: `docs/`

- [x] [使用说明] 6.2 更新 README.md（安装验证示例中的 venus --version 输出、指令清单）与 AGENTS.md（仓库地图的模板文件名、修改守则中的类型体系与命名示例、项目约定中的前缀与目录条目、9 类类型的表述）；同时更正 AGENTS.md 中已陈旧的测试统计——现写「test/ vitest（71 个用例，8 个文件）」，实测为 26 个测试文件
  - 依赖: 2.3, 4.6
  - 产出文件: `README.md`, `AGENTS.md`

- [x] [使用说明] 6.3 CHANGELOG.md：把 [Unreleased] 条目归档为 ## [2.0.0] - 2026-10-12 小节，按 Keep a Changelog 格式标注 BREAKING（技能与指令全面重命名、CLI 改名、配置目录迁移、类型去 tr、generate 行为变更）并指向伴生变更的自动迁移能力；保留空的 [Unreleased]；同步文件底部链接引用定义。注意：历史版本小节中的旧技能名与旧目录名 MUST 保留不改（历史记录的事实），仅新小节使用新名
  - 依赖: 4.6
  - 产出文件: `CHANGELOG.md`

- [x] [使用说明] 6.4 更新 LICENSE 中的项目名 VenusAgentTools → MiAgentTools；核对 package.json 的 license 字段不变
  - 依赖: 4.6
  - 产出文件: `LICENSE`

## 规格文本

- [x] [使用说明] 7.1 替换 openspec/specs/ 下 15 个规格正文中的标识符字面量：.venus/ → .iagent/、venus <命令> → iagent <命令>、tr-* workflow id → 新 id、tr_* 类型名 → 新类型名、指令名与技能名 → 新名；替换依据为映射表
  - 依赖: 2.3
  - 对应: agent-tool-identity#旧标识零残留
  - 产出文件: `openspec/specs/`

- [x] [使用说明] 7.2 重命名 4 个自带 tr- 前缀的规格目录：tr-workflow-suite-skills → workflow-suite-skills、tr-commit-push-skill → commit-push-skill、tr-migration-skills → migration-skills、tr-test-generate → test-generate；同步各目录内 spec.md 的标题行
  - 依赖: 7.1
  - 对应: agent-tool-identity#规格 id 命名约束
  - 产出文件: `openspec/specs/`

## 本机与仓库

- [x] [代码] 8.1 本机配置目录迁移：.venus/ 改名为 .iagent/，其中 config.yaml 的 rules 列表改为新类型 id、rules/tr_impl.md → rules/impl.md、rules/tr_test.md → rules/test.md、scan-baseline.json 随目录搬移（此为本机 dogfood 产物，不入库）
  - 依赖: 1.2
  - 产出文件: `.venus/`, `.iagent/`

- [x] [代码] 8.2 仓库目录改名为 MiAgentTools（git remote 为空，纯本地操作），改名后重新验证 node bin/iagent.js --version 与构建产物路径；按 AGENTS.md 修改守则第 6 条检查 Windows 路径兼容：路径断言统一以 replaceAll('\\','/') 归一化、path.join 不硬编码分隔符；确认无残留的旧路径引用（如 .vscode 配置、脚本内的绝对路径） 【阻塞（2026-10-12 实施会话记录）】：在本会话内执行改名失败——Rename-Item 报「另一个进程正在使用此文件」。已用 cwd 在父目录 D:ai_workspace 的独立进程复现同样失败，故占用者为 IDE/会话本体（VS Code 打开该工作区文件夹），而非执行改名的 shell。解除方式：关闭该工作区（或关闭 VS Code）后，在 D:ai_workspace 下执行 Rename-Item -Path VenusAgentTools -NewName MiAgentTools；改名后验证 node bin/iagent.js --version 输出 2.0.0。改名属目录级操作，不影响仓库内容与 git 历史（无远程）。
  - 依赖: 4.6, 5.3
  - 产出文件: `bin/iagent.js`, `package.json`

## 验证

- [x] [测试][功能][P0] 9.1 旧标识零残留验证：在 src/ test/ skills/ docs/ README.md AGENTS.md 中检索 venus_ 、.venus 、tr_ 、commands/venus 、VenusAgentTools、VENUS-COMPLETION、tags 中的 'venus'，确认零命中（例外仅限旧新映射表、遗留迁移模块与 CHANGELOG 历史小节）；同时确认 4 个旧规格 id 不再存在
  - 依赖: 5.3, 6.1, 6.2, 6.3, 7.2
  - 对应: agent-tool-identity#旧标识零残留
  - 产出文件: `src/`, `test/`, `skills/`, `docs/`, `README.md`, `AGENTS.md`, `openspec/specs/`

- [x] [测试][功能][P0] 9.2 命名契约验证：确认 27 个技能名与 27 条指令名与映射表一致且无重复；确认每一对新名可从名字推断功能（人工复核 genfull 一类不可解名已消除）；确认类型 id 集为 9 项且无 tr 前缀
  - 依赖: 5.1
  - 对应: agent-tool-identity#技能命名方案
  - 产出文件: `skills/`, `src/core/config.ts`

- [x] [测试][功能][P0] 9.3 端到端验证：在临时空目录执行 node bin/iagent.js init，确认生成 27 个 iagent_ 技能、27 条 /iagent:* 指令、.iagent/config.yaml 与 rules/ 默认文件、scan-baseline.json；执行 iagent list 确认按新类型 id 分组正确；执行 iagent generate --type impl --name foo 确认生成 iagent_foo 且 metadata.type 为 impl
  - 依赖: 8.2
  - 对应: agent-tool-identity#generate 名称组合规则
  - 产出文件: `bin/iagent.js`

- [x] [测试][功能][P0] 9.4 作用域界定验证：确认 vendor/auto-package-svn/ 全目录零改动（git diff 无该目录变更）；确认 skills/ 与 src/ 正文中的 Venus4A 与 Venustech 字符串数量与变更前一致（74 处）；确认 tags 中无残留 'venus' 品牌标签、metadata.author 全为 mi-agent-tools
  - 依赖: 5.1, 6.1
  - 对应: agent-tool-identity#品牌标识与产品领域名的区分
  - 产出文件: `vendor/auto-package-svn/`, `skills/`, `src/`

> 进度: 35/36 (97%)
