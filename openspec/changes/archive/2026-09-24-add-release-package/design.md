## Context

**VenusAgentTools 技能体系**：技能由 `src/core/templates/workflows/*.ts` 的 TypeScript 模板定义（导出 `get<Name>SkillTemplate` + `get<Name>CommandTemplate`），在 `registry.ts` 的 `WORKFLOW_PAIRS` 数组注册，经 `pnpm generate:skills` 生成 `skills/` 静态快照、经 `venus init` 生成 `.claude/skills/` 安装产物。`skills-parity.test.ts` 保证快照与模板一致。

**references 机制**（校验脚本嵌入的关键）：`SkillReference` 类型为 `{path, content}`（`src/core/templates/types.ts:11`），`content` 类型签名是 `string`（不限定 markdown）。`writeSkillReferences`（`src/utils/file-system.ts:52`）与 `scripts/generate-skills.mjs:44-51` 按 utf8 写入，**content 无关**——支撑 .sh 脚本走同一通道嵌入。**但二进制文件（jar）不能走 references（utf8 字符串），且 `skills/` 快照被 generate-skills 的 `cleanSkillSubdirectories` 清空重建，真实二进制文件不可放 skills/ 下**。先例：`venus_tr_test_generate`（2 个 schema md）、`venus_tr_impl_frontend`（5 个模板 md，模板文件 92KB）。

**auto-package.sh 自包含性**（vendor 备份的关键）：`auto-package.sh` 第 14 行 `SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"`，用自身所在目录定位同目录的 `auto-package.conf`（`CONFIG_FILE="${SCRIPT_DIR}/auto-package.conf"`）与 `lib/ecj-4.6.3.jar`（conf 内 `DEFAULT_ECJ_JAR="${SCRIPT_DIR}/lib/ecj-4.6.3.jar"`）。因此只要保持 `auto-package.sh + auto-package.conf + lib/ecj-4.6.3.jar` 同目录结构，备份到项目内任意位置均可工作。校验脚本（pre-package-check.sh、verify-package.sh）不引用外部路径（grep 命中全在注释），原样嵌入 references 无需定点替换。

**源技能 auto-package-verifier**：三阶段校验（预检→打包监控→一致性校验），校验基准为 SVN 变更清单（非 build.xml，因 auto-package.sh 用 ECJ 直接增量编译不调 Ant）。依赖 auto-package 运行时（sh+conf+jar，本次备份到项目内 vendor），适用 `E:\WorkSpaces_ahdx\*` 下 Venus4A 系列（Web）与 AccountManager/AuthServer 等（Server）项目。

**迁移先例**（tr-migration-skills 2026-09-11、tr-workflow-suite-skills 2026-09-14）：不入 DEFAULT_WORKFLOWS、逐段复制 + 定点替换、allowedTools 分技能盘点、同步测试计数断言。

## Goals / Non-Goals

**Goals**:
- 迁移 auto-package-verifier 为 `venus_release_package`（tr_release 类型），三阶段校验行为与源技能一致
- 两个校验脚本 + 两个 references/*.md 作为 references 嵌入，随 build/init 生成（统一分发，消除脚本漂移）
- 把 auto-package 运行时（含 ecj jar 二进制）备份到项目内 `vendor/auto-package-svn/`，技能用项目内脚本
- 运行时路径可配置（读 `.venus/config.yaml` 的 `auto_package.runtime_dir`，默认 vendor），不写死路径
- 新增阶段四升级信息归集：读产出 readme.txt 反查 OpenSpec 提案，归集 SQL 四源 + 配置三源，输出升级文档.md 到产出目录
- 保持向后兼容（不入默认集，现有项目 init 不受影响）

**Non-Goals**:
- 不新增 SKILL_TYPES 类型（不扩 9→10，tr_release 足以承载）
- 不改 DEFAULT_WORKFLOWS / DEPS（可选扩展件定位）
- 不重写源技能三阶段正文（逐段复制 + 定点替换防行为漂移）
- 不修改 auto-package.sh 本体逻辑（仅备份到 vendor，保持自包含目录结构；阶段二改用可配置路径调用，不改脚本内容）
- 不单独迁移源 `使用说明.md`（其内容与 SKILL.md 高度重叠，venus 技能体系无独立用户文档约定；其快速开始/场景示例等独有内容并入 instructions 的"典型工作流"段，参考文档走 references）
- 不扩展 venus init/CLI 支持二进制资产部署（运行时路径可配置已解决部署语义：用户按需配置 `auto_package.runtime_dir` 指向其项目内 vendor 或外部路径，技能 AI 读 yaml 解析，无需 CLI 代码改动）
- 不脚本化阶段四（提案关联与 SQL/配置归集需 AI 语义判断，作为 instructions 指导 AI 执行，非 .sh 脚本）

## Decisions

### D1: 类型与命名
- **选择**: 归 `tr_release` 类型，名 `venus_release_package`，command id `release-package`
- **理由**: 打包校验 + 升级文档属发布交付活动，与现有 `venus_tr_release_version`（git tag/changelog）互补；先例 D1 表明新增类型需用户裁决，能不扩则不扩
- **备选**: 新增 `tr_package` 类型（9→10）——语义独立但改 SKILL_TYPES/config.ts 改动大，否决

### D2: 校验脚本嵌入策略
- **选择**: 两个校验脚本 .sh + 两个 references/*.md 作为 `references` 嵌入模板，随 build/init 生成
- **理由**: writeSkillReferences content 无关，先例 tr_test_generate/tr_impl_frontend 已验证多文件嵌入；校验脚本不引用外部路径可原样嵌入
- **备选**: 脚本独立存仓库（不随 init 生成，违背需求）；内联进 instructions（44KB 过大）
- **定点替换范围（实施期补充）**: `references` 嵌入内容与原文件一致，**唯一例外**为 `references/error-codes.md` 中的 `auto-package.sh` 中间产物路径——源文件引用外部仓库路径（`/e/github/Auto-Package-Svn/.openspec-tmp/<change>/merged_files.txt`），实施时按 D15 适配为通用形式 `<runtime_dir>/.openspec-tmp/<change>/merged_files.txt`。适配与 D4 定点替换原则一致（消除外部路径耦合），不改文档其余内容

### D3: 不入默认集
- **选择**: DEFAULT_WORKFLOWS 保持 8 项不变，经 workflows 勾选安装
- **理由**: 打包校验是 Venus4A 专项，非通用，与迁移套件/工作流套件先例一致
- **备选**: 入默认集——污染通用项目 init，否决

### D4: 迁移方式
- **选择**: 逐段复制 + 定点替换（源 SKILL.md → 模板 instructions，按替换表做生态引用适配）
- **理由**: 先例 D7，禁重写正文防行为漂移。定点替换点：阶段二 auto-package.sh 调用路径改为可配置运行时路径（D15）
- **备选**: 重写正文——行为漂移风险高，否决

### D5: 第3部分形态
- **选择**: 作为打包技能"阶段四：升级信息归集"（同一技能内）
- **理由**: 打包→校验→升级文档管线内聚
- **备选**: 独立技能（管线割裂）；嵌入 verify-package.sh（提案关联需语义判断，脚本难处理）

### D6-D9: 第3部分输入/输出（grill 确认）
- **D6 提案**: OpenSpec 变更提案 `openspec/changes/<name>/`
- **D7 SQL 来源**: 全四源（产出 .sql + Java/Mapper 内嵌 + db/migration + 提案 tasks [DB脚本]）
- **D8 配置来源**: 全三源（产出配置文件 + 提案声明 + 特定配置文件）
- **D9 输出**: 产出目录 `升级文档.md`

### D10: 提案关联机制
- **选择**: 读产出 readme.txt 提交说明提取 change 名 → 定位 openspec/changes/<name>/
- **理由**: 复用 auto-package.sh 已生成的 readme.txt，无需额外 svn 远程调用
- **备选**: svn log 远程查；扫描提案声明 revision

### D11: 反查失败处理
- **选择**: 静默跳过提案来源，仅归集产出文件 SQL/配置，不阻断/不提示
- **理由**: 升级文档始终可基于产出文件生成，提案来源为增强
- **备选**: fallback 手动指定；阻断要求关联

### D12: 多版本组织
- **选择**: 按 change 名去重分组（一文档多 change 区段，或一 change 跨多 revision）
- **理由**: 适应各种提交粒度，自然行为

### D13: allowedTools
- **选择**: `Bash(bash:*), Bash(svn:*), Bash(javac:*), Bash(cat:*), Bash(ls:*), Read, Write, Edit, Glob, Grep`
- **理由**: 先例 D6/AGENTS.md 守则 2（白名单必须覆盖正文实际命令）。逐项盘点正文（instructions + COMMAND_CONTENT）后确定：`bash` 调预检/打包/校验脚本；`svn` 为 `svn info/diff/log/update` 诊断与本地版本辅助；`javac` 为"单独编译定位编译缺失"；`cat` 见 reference 诊断辅助命令段。**仅作扫描（只读）用途的命令不拦截**；`Read` 用于读 .venus/config.yaml 与扫描产出/提案
- **备注**: 表内嵌的 `.sh` 脚本体（PRE_PACKAGE_CHECK / VERIFY_PACKAGE）内的 `grep`/`find`/`ant` 等由 `Bash(bash:*)` 覆盖，无需单独列出。正文诊断表另提及 `ant -f` 备用路线（Venus4A Ant 模板路线），当前未纳入白名单（非纯扫描命令，按需由用户确认）

### D14: auto-package 运行时备份（Scope Change）
- **选择**: 备份到项目内 `vendor/auto-package-svn/`，含 auto-package.sh + auto-package.conf + auto-package.ps1 + lib/ecj-4.6.3.jar + auto-package-使用说明.md；排除源仓库开发产物（.claude/、.openspec-tmp/、openspec/、*.bak）
- **理由**: auto-package.sh 自包含（SCRIPT_DIR 定位同目录 conf 与 lib/ecj jar），保持目录结构即工作；vendor/ 为稳定目录不被 generate-skills 清空，可 git-track 二进制 jar
- **备选**: 技能目录内（skills/ 被清空，二进制不可放）；继续用外部 E:\github（不可版本控制、不可移植，违背需求）

### D15: 运行时路径可配置（Scope Change）
- **选择**: 技能读 `.venus/config.yaml` 的 `auto_package.runtime_dir` 字段解析运行时目录，默认 `vendor/auto-package-svn`；用户可配置指向其他路径。解析顺序：配置值 → 默认 vendor → 不存在则报错提示
- **理由**: 用户裁决"增加可配置路径"——解耦技能与运行时位置，默认用项目内 vendor，用户也可指向外部路径或目标项目自己的 vendor；技能 AI Read yaml 解析，无需 CLI 代码改动
- **备选**: 写死 vendor 路径（不灵活）；扩展 venus init 部署二进制资产（改动大，路径可配置已解决部署语义）

### D16: 命名调整（Scope Change）
- **选择**: `venus_tr_release_package_verify` → `venus_release_package`，command id `tr-release-package-verify` → `release-package`，变更名/能力 spec 同步
- **理由**: 用户裁决 drop _verify
- **实施期补充（命名约定豁免，用户二次裁决）**: `venus_release_package` 不满足项目 `venus_<type>_<name>` 命名约定（缺 `tr_release` 类型段），是全仓库 27 个技能中唯一例外，会触发 `test/templates.test.ts` 的约定断言。实施期暴露该冲突后用户二次裁决：**保留短名**（斜杠指令 `/venus:release-package` 更简洁），在 `test/templates.test.ts` 中为该技能显式开豁免（`NAMING_EXEMPT` 集合），**不**改名为 `venus_tr_release_package`
- **代价（已接受）**: 命名约定测试不再对全部技能成立；豁免集合存在陈旧项（技能改名/删除后遗留）时不会自动报警

## 升级文档结构与反查约定

### change 名提取约定（D10 实现细则）

读产出 `readme.txt` 各 revision 提交说明，按以下顺序提取 change 名：

1. **显式标记优先**：匹配 `变更: <name>` 或 `[<name>]` 或 `change: <name>`（不区分大小写）格式的标记，提取 `<name>`。
2. **目录名回退匹配**：若无显式标记，将提交说明与 `openspec/changes/` 下全部未归档变更目录名做子串匹配（change 目录名形如 `<action>-<module>-<desc>`，全小写连字符），命中即关联。
3. **多 revision 累积**：每个 revision 独立提取，汇总后按 change 名去重（D12）。某 revision 提取不到 change 名时，该 revision 归入"未关联"区段（不阻断其他 revision 的反查）。

提取到的 change 名须 `openspec/changes/<name>/proposal.md` 存在方算关联成功，否则按 D11 静默降级。

### 运行时路径解析约定（D15 实现细则）

技能阶段二调用 auto-package.sh 前，按以下顺序解析运行时目录：

1. Read `.venus/config.yaml`，取 `auto_package.runtime_dir` 字段值（若存在）。
2. 未配置则用默认 `vendor/auto-package-svn`（项目根相对路径）。
3. 拼接 `<runtime_dir>/auto-package.sh`，若文件不存在则报错提示用户配置 `auto_package.runtime_dir` 或备份运行时到 vendor。
4. 解析到的 runtime_dir 同时用于定位 auto-package.conf（同目录）与 lib/ecj jar（runtime_dir/lib/）。

### 升级文档.md 结构骨架

输出到产出目录的 `升级文档.md`，结构如下（区段按反查到的 change 名去重分组，无 change 时退化为单"未关联提案"区段）：

```
# 升级文档 — <项目名> 版本 <revision 列表>

> 生成时间 / 关联提案状态（已关联 N 个 / 未关联，基于产出文件归集）

## 一、待执行 SQL
### 来源①：产出 .sql 文件
- <文件路径> — <SQL 摘要>
### 来源②：Java/Mapper XML 内嵌 SQL
- <源文件> → <SQL 类型(建表/改表/DML)> — <SQL 摘要>
### 来源③：db/migration 目录
- <脚本> — <说明>
### 来源④：提案 [DB脚本] 标记（依赖提案关联）
- <change 名> tasks <任务号> — <SQL 脚本说明>

## 二、待变更配置参数
### 来源①：产出配置文件
- <文件> — <新增/修改参数项>
### 来源②：提案声明配置项（依赖提案关联）
- <change 名> — <参数项与说明>
### 来源③：特定配置文件
- <文件> — <关键参数>

## 三、关联 OpenSpec 提案
- <change 名>（revision <r1,r2>）— proposal 要点摘要
- 或：未关联到 OpenSpec 提案（提交说明无 change 名 / 提案不存在）

## 四、增量包文件清单
- <产出文件清单，引自 readme.txt/filelist.txt>
```

各源为空时该子节标注"（无）"，不省略节标题（保持结构稳定，便于运维核对归集完整性）。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 校验脚本嵌入使模板文件增大（+44KB .sh + 11KB references） | 可接受——先例 tr-impl-frontend.ts 92KB；references 嵌入是既定机制 |
| ecj-4.6.3.jar 2.4MB 二进制 git-track 增大仓库体积 | vendor/ 目录单独跟踪；jar 是 ECJ 编译器不可压缩二进制，必须版本化以保证可移植；可接受（一次性 2.4MB） |
| 运行时路径可配置依赖 AI Read yaml 解析（非 CLI schema 强约束） | 字段简单（单字符串路径），AI Read 可靠；未配置有默认值；路径不存在报错提示。不强求 CLI 改动（最小改动原则） |
| readme.txt 反查依赖提交说明含 change 名约定（Venus4A 存量项目未必有） | D11 静默降级：反查失败仅归集产出文件，不阻断；升级文档头部注明是否关联提案 |
| 阶段四 SQL/配置归集依赖 AI 语义判断，非确定性脚本 | 作为 instructions 指导 AI 执行（非 .sh 脚本）；升级文档列明各源归集情况供人工复核 |
| 测试计数断言需手动同步 5 个测试文件 | 列入 tasks 清单逐项同步；先例既定流程 |
| 技能运行处需有 openspec/changes/（提案在运行项目，非 Venus4A SVN 项目） | 文档注明部署上下文：从 VenusAgentTools 或采用 OpenSpec 的项目运行，产出在 -o 路径 |
| ECJ 字节码抽检等既有行为迁移后漂移 | D4 逐段复制 verify-package.sh 原文，不改脚本逻辑 |
