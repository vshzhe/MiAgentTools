# Tasks: add-release-package

## 1. 技能模板创建

- [x] 1.1 [代码] 新建 `src/core/templates/workflows/release-package.ts`，导出 `getReleasePackageSkillTemplate()` 与 `getReleasePackageCommandTemplate()`
  - 文件：`src/core/templates/workflows/release-package.ts`
  - 验证：`pnpm build` 编译通过；导出函数签名与先例（tr-release.ts）一致

- [x] 1.2 [代码] 迁移三阶段校验 instructions：从源 `SKILL.md` 逐段复制"阶段一预检 / 阶段二打包监控 / 阶段三一致性校验"正文到 `instructions`，按替换表做生态引用适配。**定点替换**：阶段二 `auto-package.sh` 调用路径从外部 `E:\github\Auto-Package-Svn` 改为可配置运行时路径（读 `.venus/config.yaml` 的 `auto_package.runtime_dir`，默认 `vendor/auto-package-svn`，见 design D15）；校验脚本调用路径改为 `<技能目录>/scripts/xxx.sh`
  - 文件：`src/core/templates/workflows/release-package.ts`
  - 验证：三阶段行为与源 SKILL.md 一致（路径映射表、退出码、报告标记）；阶段二路径解析逻辑覆盖 D15

- [x] 1.3 [代码] 新增阶段四升级信息归集 instructions：写入"阶段四：升级信息归集"段落，覆盖读 readme.txt 反查提案（D10）、SQL 四源归集（D7）、配置三源归集（D8）、反查失败静默降级（D11）、多版本按 change 名去重分组（D12）、输出 升级文档.md 到产出目录（D9）
  - 文件：`src/core/templates/workflows/release-package.ts`
  - 验证：阶段四逻辑覆盖 spec 的 5 条需求（升级信息归集 / SQL 四源 / 配置三源 / 提案反查与失败降级 / 多版本去重分组）

- [x] 1.4 [代码] 迁移参数传递与追问 + 错误诊断段落：从源 SKILL.md 复制"使用 SKILL：参数传递与追问""错误诊断"段落到 instructions
  - 文件：`src/core/templates/workflows/release-package.ts`
  - 验证：4 必需参数追问规则、版本号绝不猜测原则保留

- [x] 1.5 [代码] 嵌入 references 校验脚本：将源 `scripts/pre-package-check.sh`（15KB）与 `scripts/verify-package.sh`（29KB）原文作为 `references` 数组项嵌入（path: `scripts/pre-package-check.sh`、`scripts/verify-package.sh`），内容逐字复制不改脚本逻辑（校验脚本不引用外部路径，无需定点替换）
  - 文件：`src/core/templates/workflows/release-package.ts`
  - 验证：`pnpm generate:skills` 后 `skills/venus_release_package/scripts/` 下两脚本与源文件字节一致（diff 为空）

- [x] 1.6 [代码] 嵌入 references 参考文档：将源 `references/build-config-spec.md` 与 `references/error-codes.md` 原文作为 `references` 数组项嵌入（path: `references/build-config-spec.md`、`references/error-codes.md`）
  - 文件：`src/core/templates/workflows/release-package.ts`
  - 验证：`pnpm generate:skills` 后两参考文档生成且内容与源一致
  - **定点替换例外**（见 design D2 补充）：`error-codes.md` 的 `auto-package.sh` 中间产物路径由源外部仓库路径适配为 `<runtime_dir>/.openspec-tmp/<change>/merged_files.txt`；其余内容与源一致

- [x] 1.7 [代码] 配置 SkillTemplate 元数据：`name: venus_release_package`、`type: 'tr_release'`、`allowedTools: 'Bash(bash:*), Bash(svn:*), Bash(javac:*), Bash(cat:*), Bash(ls:*), Read, Write, Edit, Glob, Grep'`（D13）、`description` 覆盖四阶段触发词、`license/compatibility/metadata` 对齐先例
  - 文件：`src/core/templates/workflows/release-package.ts`
  - 验证：frontmatter `metadata.type` 为 `tr_release`；allowedTools 覆盖正文实际命令（AGENTS.md 守则 2，`test/allowed-tools.test.ts` 不拦截）
  - 命令清单依据（正文逐项盘点）：`bash`（调预检/打包/校验脚本）、`svn`（`svn info/diff/log/update` 诊断）、`javac`（单独编译定位编译缺失）、`cat`（reference 诊断辅助命令，仅扫描）

## 2. 注册技能

- [x] 2.1 [代码] `src/core/templates/registry.ts` 顶部 import `getReleasePackageSkillTemplate` 与 `getReleasePackageCommandTemplate`
  - 文件：`src/core/templates/registry.ts`
  - 验证：`pnpm build` 通过，import 路径正确

- [x] 2.2 [代码] `WORKFLOW_PAIRS` 数组新增注册项，置于 `venus_tr_release_version` 之后（tr_release 分区内，与 SKILL_TYPES 顺序一致——先例 D9）
  - 文件：`src/core/templates/registry.ts`
  - 验证：`venus list` 展示新技能；`deriveCommandId('venus_release_package')` === `'release-package'`

- [x] 2.3 [代码] `.venus/config.yaml` 更新：workflows 列表新增 `release-package`（dogfood 安装）；新增可选字段 `auto_package.runtime_dir: vendor/auto-package-svn`（运行时路径可配置，D15）
  - 文件：`.venus/config.yaml`
  - 验证：`venus list` 显示 release-package 为已安装；`auto_package.runtime_dir` 字段存在且默认值正确

## 3. 打包运行时备份到项目内 vendor

- [x] 3.1 [代码] 新建 `vendor/auto-package-svn/` 目录，从 `E:\github\Auto-Package-Svn` 复制运行时文件：`auto-package.sh` + `auto-package.conf` + `auto-package.ps1` + `lib/ecj-4.6.3.jar` + `auto-package-使用说明.md`
  - 文件：`vendor/auto-package-svn/`（含 `lib/ecj-4.6.3.jar` 二进制）
  - 验证：vendor/auto-package-svn/ 下文件齐全；保持 auto-package.sh + lib/ecj jar 同目录结构（auto-package.sh 自包含 SCRIPT_DIR 定位）

- [x] 3.2 [代码] 排除源仓库非运行时产物：不复制 `.claude/`、`.openspec-tmp/`、`openspec/`、`auto-package.conf.bak`
  - 验证：vendor/auto-package-svn/ 不含上述排除项

- [x] 3.3 [代码] 验证 vendor 内 auto-package.sh 可执行：`bash vendor/auto-package-svn/auto-package.sh --help`（或 dry-run）能正常解析 conf 与 lib/ecj jar 路径
  - 验证：auto-package.sh 用 SCRIPT_DIR 正确定位 vendor/auto-package-svn/auto-package.conf 与 lib/ecj-4.6.3.jar，无路径错误

## 4. 快照与安装产物生成

- [x] 4.1 [代码] 执行 `pnpm build && pnpm generate:skills` 生成 `skills/venus_release_package/` 快照（SKILL.md + scripts/ + references/）
  - 文件：`skills/venus_release_package/`
  - 验证：`skills-parity.test.ts` 通过（快照与模板一致）；快照目录含 5 文件（SKILL.md + 2 校验脚本 + 2 参考文档，不含打包脚本本体——本体在 vendor）

- [x] 4.2 [代码] 执行 `venus init --force`（或 dogfood 更新）生成 `.claude/skills/venus_release_package/` 安装产物（前置：任务 2.3 已把 `release-package` 加入 `.venus/config.yaml` workflows）
  - 文件：`.claude/skills/venus_release_package/`
  - 验证：安装产物含 5 文件，与快照一致；`.claude/commands/venus/release-package.md` 指令生成

## 5. 测试计数断言同步

> 计数基线：实施前仓库技能总数为 **26**（`git log` 显示 `b724439` 已把断言由 25 同步到 26，`67909e3` 新增 venus_tr_commit_push），本次新增 1 个技能后为 **27**。以下行号为实施前快照，实施时以实际 grep 结果为准。

- [x] 5.1 [代码] `test/commands.test.ts`：技能/指令总数断言 26 → 27（第 32、33、57、69、80 行；第 54 行 `52 // 26*2` → `54`；第 188、189 行遗留技能数 `25` → `26`；测试标题"生成 26 个 SKILL.md 与 26 个指令文件"同步为 27）。**第 140、141 行（DEFAULT_WORKFLOWS 默认集 8 项）与第 166 行不变**——新技能不入默认集（design D3）
  - 文件：`test/commands.test.ts`
  - 验证：该测试通过

- [x] 5.2 [代码] `test/validate-update.test.ts`：`total` / `passed` 断言 26 → 27（第 32、40、41 行）
  - 文件：`test/validate-update.test.ts`
  - 验证：该测试通过

- [x] 5.3 [代码] `test/uninstall-show.test.ts`：`removedSkills` `27 // 26 内置 + 1 生成` → `28`（第 35、47 行），`removedCommands` `26` → `27`（第 36 行），注释同步
  - 文件：`test/uninstall-show.test.ts`
  - 验证：该测试通过

- [x] 5.4 [代码] `test/config-command.test.ts`：`listAllWorkflowIds` 断言 26 → 27（第 32 行），测试标题同步
  - 文件：`test/config-command.test.ts`
  - 验证：该测试通过

- [x] 5.5 [代码] `test/skills-parity.test.ts`：workflow id 总数断言 26 → 27（第 118 行），注释同步
  - 文件：`test/skills-parity.test.ts`
  - 验证：该测试通过

- [x] 5.6 [代码] `test/templates.test.ts`：技能总数断言 26 → 27（第 13 行测试标题的类型分解同步为 "8 类 tr_* 共 19 技能"，第 14 行断言）——**实施期发现的 §5 遗漏项**，`pnpm test` 全量运行才暴露
  - 文件：`test/templates.test.ts`
  - 验证：该测试通过（注意本文件第 28-34 行另有**技能命名约定**断言 `venus_<type>_` 前缀；`venus_release_package` 经用户裁决保留短名，在该断言中以 `NAMING_EXEMPT` 显式开豁免，见 design D16「命名约定豁免」）

## 6. 全量验证

- [x] 6.1 [代码] `pnpm test` 全量测试通过（71+ 用例 + 新增计数断言）
  - 文件：`test/`
  - 验证：全部测试 PASS，无回归

- [x] 6.2 [代码] `pnpm lint` 通过（src/ + test/）
  - 文件：`src/`、`test/`
  - 验证：eslint 无 error/warning

- [x] 6.3 [代码] 手工核验：`venus show venus_release_package` 展示技能详情（**修正**：`show` 按技能名而非 commandId 匹配，`show release-package` 无效——先例 `show tr-release-version` 同样无效，属既有 CLI 行为）；`venus list` tr_release 类型计数 +1；vendor/auto-package-svn/ 运行时可执行
  - 验证：技能可被 list/show 正确识别；type=tr_release；references 列表含 2 校验脚本 + 2 参考文档；vendor 运行时路径解析正确
