## ADDED Requirements

### Requirement: 打包前预检（阶段一）

技能 SHALL 在调用 `auto-package.sh` 前执行预检脚本 `pre-package-check.sh`，拦截会导致打包失败的参数、路径、配置、工具链、版本号问题。预检退出码 `1`（有 FAIL）时 MUST NOT 进入阶段二。

#### Scenario: 必填参数缺失或版本号格式错误
- **WHEN** 用户未提供 4 个必需参数（项目名/版本号/项目路径/输出目录）之一，或版本号非逗号分隔数字
- **THEN** 预检报 FAIL 退出码 `1`，列出全部 FAIL 项，不进入阶段二

#### Scenario: 版本号超过 SVN 仓库 HEAD
- **WHEN** 版本号大于 `svn info -r HEAD` 查询的仓库 HEAD
- **THEN** 预检报 FAIL，提示版本号在仓库中不存在，建议 `svn log -l 5` 核对

#### Scenario: 预检通过含警告
- **WHEN** 预检退出码 `0` 但有 WARN（如 build.increment.xml 占位符未填充）
- **THEN** 提示用户注意警告，通常可继续进入阶段二

### Requirement: 打包执行监控（阶段二）

技能 SHALL 通过可配置运行时路径（见"打包运行时备份与路径可配置"需求，读 `.venus/config.yaml` 的 `auto_package.runtime_dir`，默认 `vendor/auto-package-svn`）调用 `auto-package.sh` 并监控其输出，捕获 ECJ 编译失败、SVN 失败、参数过长等错误。退出码非 `0` 时 MUST 暂停并报告，不继续阶段三。

#### Scenario: 打包成功
- **WHEN** `auto-package.sh` 退出码 `0`
- **THEN** 进入阶段三一致性校验

#### Scenario: 打包失败
- **WHEN** `auto-package.sh` 退出码非 `0`（ECJ 编译错误/SVN 认证或路径失败/Argument list too long）
- **THEN** 解析 stderr，立即暂停向用户报告失败原因与上下文，不继续阶段三

#### Scenario: 用户已自行打包
- **WHEN** 用户表示已打包完成只校验
- **THEN** 跳过阶段一、二，直接进入阶段三

### Requirement: 打包后一致性校验（阶段三）

技能 SHALL 以 SVN 变更清单为基准（非 `build.xml`），通过 `verify-package.sh` 逐项核对产出目录，检测缺失/编译缺失/内部类缺失/应删未删/多余文件。路径映射 MUST 与 `auto-package.sh` 完全对齐。

#### Scenario: 变更清单要求的产出缺失
- **WHEN** 变更清单要求产出某文件但产出目录无对应文件
- **THEN** 报 `[缺失]` 或 `[编译缺失]`（.java 变更无主类 .class），一致性评分 < 100%，FAIL

#### Scenario: 已删除文件残留产出
- **WHEN** 文件在某版本删除（D 操作）但产出仍含（含内部类 `foo$*.class` 残留）
- **THEN** 报 `[应删未删]`

#### Scenario: strict 模式检出多余文件
- **WHEN** strict 模式下产出含变更清单之外的文件（排除 readme.txt/filelist.txt）
- **THEN** 报 `[多余]`

#### Scenario: 校验通过进入阶段四
- **WHEN** 产出与变更清单完全一致，一致性评分 100% PASS
- **THEN** 退出码 `0`，可进入阶段四升级信息归集

### Requirement: 升级信息归集（阶段四）

阶段三校验通过后，技能 SHALL 归集本次增量包的升级信息并输出 `升级文档.md` 到产出目录（与 readme.txt/filelist.txt 同级）。阶段四 MUST 在阶段三 PASS 后触发，"只校验已有产出"场景同样适用。

#### Scenario: 阶段三通过触发阶段四
- **WHEN** 阶段三一致性校验 PASS
- **THEN** 自动触发阶段四，扫描产出文件 + 关联 OpenSpec 提案 + 归集 SQL 与配置参数

#### Scenario: 输出升级文档
- **WHEN** 阶段四归集完成
- **THEN** 输出 `升级文档.md` 到产出目录，含待执行 SQL 清单与待变更配置参数清单

### Requirement: SQL 四源归集

技能 SHALL 从四个来源归集待执行 SQL：①产出中的 .sql 文件 ②Java/Mapper XML 内嵌 SQL ③独立 db/migration 目录 ④提案 tasks 的 [DB脚本] 标记。各源互补，某源为空时不报错。

#### Scenario: 归集产出 .sql 文件
- **WHEN** 产出含变更的 .sql 文件
- **THEN** 归集为待执行 SQL，列入升级文档

#### Scenario: 抽取 Java/Mapper 内嵌 SQL
- **WHEN** 变更的 Java DAO/Service 或 MyBatis Mapper XML 含建表/改表/DML 语句
- **THEN** 抽取该 SQL 语句列入升级文档

#### Scenario: 归集提案 [DB脚本] 标记
- **WHEN** 提案 tasks.md 含 `[DB脚本]` 类型任务且提案关联成功
- **THEN** 归集该任务声明的 SQL 脚本信息列入升级文档

### Requirement: 配置参数三源归集

技能 SHALL 从三个来源归集待变更配置参数：①产出中的配置文件（.properties/.xml/.yaml）②提案声明的配置项 ③特定配置文件（auto-package.conf/项目 config 等关键参数）。各源互补，某源为空时不报错。

#### Scenario: diff 产出配置文件
- **WHEN** 产出含变更的配置文件
- **THEN** diff 出新增/修改的参数项列入升级文档

#### Scenario: 归集提案声明配置项
- **WHEN** 提案 proposal/design 显式声明需变更配置参数且提案关联成功
- **THEN** 归集该配置项列入升级文档

### Requirement: 提案反查与失败降级

技能 SHALL 读产出 `readme.txt`（auto-package.sh 已含各 revision 提交作者/日期/说明）按约定格式从提交说明提取 change 名，定位 `openspec/changes/<name>/`。反查失败时 MUST 静默跳过提案来源，仅归集产出文件信息，不阻断、不提示用户手动指定。

#### Scenario: 反查成功
- **WHEN** readme.txt 提交说明含 change 名且 `openspec/changes/<name>/` 存在
- **THEN** 关联提案，归集提案来源的 SQL（[DB脚本]标记）与配置（声明项）

#### Scenario: 反查失败静默降级
- **WHEN** readme.txt 提交说明无 change 名，或 `openspec/changes/<name>/` 不存在
- **THEN** 静默跳过提案来源，仅归集产出文件中的 SQL（.sql/Java Mapper/db migration）与配置（产出配置文件/特定配置文件），升级文档头部注明"未关联到 OpenSpec 提案"

#### Scenario: readme.txt 不存在
- **WHEN** 产出目录无 readme.txt（非 auto-package.sh 产出或手工打包）
- **THEN** 跳过反查，仅归集产出文件信息，升级文档头部注明

### Requirement: 多版本按 change 名去重分组

多版本打包（如 `-r 66525,66526,66527,66528`）时，技能 SHALL 按反查到的 change 名去重分组，一个 change 跨多 revision 归一为该 change 区段。

#### Scenario: 多版本多 change
- **WHEN** 多版本反查到多个不同 change 名
- **THEN** 升级文档含多个 change 区段，每区段列其关联 revision

#### Scenario: 多版本单 change
- **WHEN** 多版本全部反查到同一 change 名
- **THEN** 归一为单 change 区段，区段内列全部关联 revision

#### Scenario: 全部版本无 change 名
- **WHEN** 全部 revision 提交说明均无 change 名
- **THEN** 退化为单区段产出文件归集（D6 反查失败降级）

### Requirement: 校验脚本与参考文件随 SKILL 生成

技能的两个**校验脚本**（pre-package-check.sh、verify-package.sh）与参考文档（build-config-spec.md、error-codes.md）SHALL 作为 `references` 嵌入模板，经 `pnpm generate:skills`（快照）与 `venus init`（安装）一并写入技能目录。**打包脚本本体**（auto-package.sh + conf + lib/ecj jar）不嵌入 references（二进制 jar 不能 utf8 嵌入，且 skills/ 被清空重建），而是备份到项目内 `vendor/auto-package-svn/`（见"打包运行时备份与路径可配置"需求）。

#### Scenario: 快照生成
- **WHEN** 执行 `pnpm generate:skills`
- **THEN** `skills/venus_release_package/` 下生成 `SKILL.md` + `scripts/pre-package-check.sh` + `scripts/verify-package.sh` + `references/build-config-spec.md` + `references/error-codes.md`

#### Scenario: init 安装
- **WHEN** 执行 `venus init` 且生效 workflow 集含 `release-package`
- **THEN** `.claude/skills/venus_release_package/` 下生成同样文件集

#### Scenario: 校验脚本调用方式
- **WHEN** 阶段一、三调用校验脚本
- **THEN** 用 `bash <技能目录>/scripts/xxx.sh`（Windows 无 +x 位，靠 bash 调用，与源技能一致）

### Requirement: 打包运行时备份与路径可配置

技能的打包脚本本体（auto-package.sh + auto-package.conf + auto-package.ps1 + lib/ecj-4.6.3.jar + 使用说明.md）SHALL 备份到项目内 `vendor/auto-package-svn/`，保持 auto-package.sh 自包含目录结构（SCRIPT_DIR 定位同目录 conf 与 lib/ecj jar）。技能调用 auto-package.sh 时 SHALL 读 `.venus/config.yaml` 的 `auto_package.runtime_dir` 解析运行时目录，默认 `vendor/auto-package-svn`，不写死路径。

#### Scenario: 运行时备份到 vendor
- **WHEN** 本次变更实施
- **THEN** `vendor/auto-package-svn/` 含 auto-package.sh + auto-package.conf + auto-package.ps1 + lib/ecj-4.6.3.jar + auto-package-使用说明.md（排除源仓库 .claude/.openspec-tmp/openspec/*.bak），保持 auto-package.sh + lib/ecj jar 同目录结构

#### Scenario: 路径可配置解析
- **WHEN** 阶段二调用 auto-package.sh 前
- **THEN** Read `.venus/config.yaml` 取 `auto_package.runtime_dir`，未配置则用默认 `vendor/auto-package-svn`，拼接 `<runtime_dir>/auto-package.sh` 调用

#### Scenario: 配置指向其他路径
- **WHEN** 用户在 `.venus/config.yaml` 配置 `auto_package.runtime_dir` 为其他路径（如外部 `E:/github/Auto-Package-Svn` 或目标项目自己的 vendor）
- **THEN** 技能用该配置路径调用 auto-package.sh，不强制项目内 vendor

#### Scenario: 运行时路径不存在
- **WHEN** 解析到的 runtime_dir 下无 auto-package.sh
- **THEN** 报错提示用户配置 `auto_package.runtime_dir` 或备份运行时到 vendor，不继续打包

### Requirement: 参数传递与追问

技能 SHALL 从用户自然语言提取 4 个必需参数（项目名/版本号/项目路径/输出目录），缺失的主动追问，版本号 MUST NOT 自行猜测。

#### Scenario: 版本号缺失
- **WHEN** 用户未提供版本号
- **THEN** 追问"打哪个 SVN 版本号？多个用逗号分隔"，绝不自行猜测

#### Scenario: 项目路径推断
- **WHEN** 用户未指定项目路径
- **THEN** 按 `E:\WorkSpaces_ahdx\<项目名>` 推断并请用户确认，不空问

#### Scenario: 输出目录默认
- **WHEN** 用户未指定输出目录
- **THEN** 用默认值 `E:/ProjectPackage` 并告知用户，不追问
