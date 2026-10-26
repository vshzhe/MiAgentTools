## Why

`auto-package-verifier` 打包质量校验技能当前位于用户全局目录 `C:\Users\venus\.claude\skills\auto-package-verifier\`，不在 VenusAgentTools 技能体系内，存在四个问题：

1. **不可分发**：无法经 `venus init` 安装到目标项目，不随版本管理，不享受模板派生与 `skills-parity.test.ts` 一致性保障。
2. **脚本游离**：两个校验脚本（pre-package-check.sh、verify-package.sh）独立存放，技能迁移后脚本需手动同步，易漂移。
3. **打包脚本本体外部依赖**：`auto-package.sh` 及其运行时（conf、ECJ jar）位于外部 `E:\github\Auto-Package-Svn\`，不在项目内，不可版本控制、不可移植。
4. **交付闭环不全**：现有三阶段（预检→打包监控→一致性校验）止步于"产出文件正确"，未归集升级所需信息（待执行 SQL、待变更配置参数），运维拿到增量包后仍需人工排查升级步骤。

本次迁移将技能纳入 venus 体系（校验脚本随 SKILL/init 生成、打包脚本本体备份到项目内 vendor），并新增**阶段四：升级信息归集**，补齐"打包→校验→升级文档"交付闭环。

## What Changes

- **新增技能** `venus_release_package`（`tr_release` 类型，command id `release-package`）：迁移源 auto-package-verifier 三阶段校验（打包前预检 → 打包执行监控 → 打包后一致性校验），并新增阶段四升级信息归集。
- **校验脚本与参考文件随 SKILL 生成**：`pre-package-check.sh`、`verify-package.sh` 两个校验脚本 + `build-config-spec.md`、`error-codes.md` 两个参考文档，作为 `references` 嵌入模板，经 `pnpm generate:skills`（快照）与 `venus init`（安装）一并写入技能目录。
- **打包脚本本体备份到项目内**：把外部 `E:\github\Auto-Package-Svn` 运行时备份到项目内 `vendor/auto-package-svn/`，含 `auto-package.sh` + `auto-package.conf` + `auto-package.ps1` + `lib/ecj-4.6.3.jar`（2.4MB 二进制）+ `auto-package-使用说明.md`。排除源仓库自身开发产物（`.claude/`、`.openspec-tmp/`、`openspec/`、`*.bak`）。auto-package.sh 自包含（`SCRIPT_DIR` 定位同目录 conf 与 lib/ecj jar），保持目录结构即工作。
- **运行时路径可配置**：技能不写死 vendor 路径，读 `.venus/config.yaml` 的 `auto_package.runtime_dir` 字段解析 auto-package 运行时目录，默认 `vendor/auto-package-svn`。用户可配置指向其他路径。阶段二调用 `<runtime_dir>/auto-package.sh`。
- **新增阶段四：升级信息归集**：阶段三校验通过后，读产出 `readme.txt` 反查 OpenSpec 变更提案（按提交说明提取 change 名 → 定位 `openspec/changes/<name>/`），归集 SQL（四源：产出 .sql 文件、Java/Mapper XML 内嵌、db/migration 目录、提案 tasks [DB脚本] 标记）与配置参数（三源：产出配置文件、提案声明配置项、特定配置文件），输出 `升级文档.md` 到产出目录。
- **注册到 `registry.ts`** WORKFLOW_PAIRS，**不入 DEFAULT_WORKFLOWS**（经 `.venus/config.yaml` workflows 字段勾选安装，与迁移套件/工作流套件先例一致）。
- **同步测试计数断言**：技能总数 23 → 24，更新 `test/{commands,validate-update,uninstall-show,config-command,skills-parity}.test.ts` 硬编码计数。

## Capabilities

### New Capabilities

- `release-package`: 基于 auto-package.sh 的 SVN 增量打包质量校验技能，覆盖打包前预检 → 打包执行监控 → 打包后一致性校验 → 升级信息归集四阶段，以 SVN 变更清单为校验基准，归集升级所需 SQL 与配置参数输出升级文档；打包脚本本体备份到项目内 vendor，运行时路径可配置。

### Modified Capabilities

<!-- 无既有能力的需求变化（不入默认集、不改 DEPS、不改 SKILL_TYPES） -->

## Impact

### 直接影响的文件

- `src/core/templates/workflows/release-package.ts`：新建技能模板（instructions 逐段复制自源 SKILL.md + 阶段四新增 + references 嵌入校验脚本与参考文档 + 阶段二改用可配置运行时路径）。
- `src/core/templates/registry.ts`：WORKFLOW_PAIRS 新增注册项（tr_release 分区，紧跟 venus_tr_release_version 后）。
- `vendor/auto-package-svn/`：新建目录，备份 auto-package 运行时（auto-package.sh + conf + ps1 + lib/ecj-4.6.3.jar + 使用说明.md），git-tracked。
- `.venus/config.yaml`：新增可选字段 `auto_package.runtime_dir`（默认 `vendor/auto-package-svn`）+ workflows 列表新增 `release-package`。
- `skills/venus_release_package/`：快照目录（`pnpm generate:skills` 生成 SKILL.md + scripts/ + references/）。
- `.claude/skills/venus_release_package/`：dogfood 安装产物（`venus init` 生成）。
- `test/commands.test.ts`、`test/validate-update.test.ts`、`test/uninstall-show.test.ts`、`test/config-command.test.ts`、`test/skills-parity.test.ts`：技能数量计数断言 23 → 24。
- `openspec/CONTEXT.md`：已新增"提案""升级文档"术语 + 待补"打包运行时路径"术语。

### 向后兼容

无破坏性变更。新增技能不入 DEFAULT_WORKFLOWS，现有项目 `venus init` 行为不变（除非显式在 `.venus/config.yaml` workflows 勾选 `release-package` 才安装）。`auto_package.runtime_dir` 为可选字段，缺省时用默认 vendor 路径。技能依赖外部环境（Git Bash / SVN CLI / JDK），auto-package 运行时改为项目内 vendor（默认）或用户配置路径，不引入新环境耦合。
