/**
 * tr_release 类型技能模板：打包校验 + 升级信息归集。
 *
 * 迁移自 auto-package-verifier（用户全局技能），新增阶段四升级信息归集。
 * 三阶段校验正文逐段复制自源 SKILL.md（定点替换 auto-package.sh 调用路径为可配置运行时），
 * 阶段四为新增。校验脚本与参考文档作为 references 嵌入，随 build/init 生成。
 * 打包脚本本体（auto-package.sh + conf + ecj jar）备份在项目内 vendor/auto-package-svn/，
 * 路径经 .venus/config.yaml 的 auto_package.runtime_dir 配置。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';

const INSTRUCTIONS = `
# auto-package-verifier — 项目打包质量校验

## 这个技能解决什么问题

\`auto-package.sh\`（位于 \`vendor/auto-package-svn\`）是一个基于 SVN 版本号的增量打包工具，用于把指定版本的变更文件编译、复制、归集到输出目录，供上线部署。

打包过程涉及多个易错环节：
- **参数错配**：版本号超过 SVN 仓库 HEAD（不存在的版本）、项目路径错误、缺 JDK/Ant/SVN
- **配置漂移**：\`build.xml\` 声明的结构与实际目录不符
- **编译静默失败**：\`javac\` 编译错误被吞，产出缺 \`.class\`
- **文件漏打/多打**：SVN 变更清单里的文件没进产出，或产出里混入了不该有的文件
- **目录错位**：\`src/x.java\` 该映射到 \`WEB-INF/classes/x.class\` 却进了别处

本技能提供**四个阶段的流程**（前三阶段为校验脚本，第四阶段为升级信息归集），把这些错误拦在交付前并归集升级信息。四个阶段独立可用，也可串成闭环。

## 关键概念：校验基准

一致性校验**以 SVN 变更清单为准**，而不是以 \`build.xml\` 配置为准。理由：
- \`auto-package.sh\` 的实际工作逻辑是"读 SVN diff → 映射路径 → 编译/复制"，SVN 变更清单是它真正消费的输入
- \`build.xml\` 在 \`auto-package.sh\` 流程里**几乎不被使用**（脚本用 \`javac\` 直接增量编译，不调 Ant），所以以 \`build.xml\` 为基准会与实际打包口径错位
- SVN 变更清单是客观事实（仓库里哪些文件变了），产出是结果，两者比对能直接暴露"该打的没打、不该打的打了"

## 四阶段流程

### 阶段一：打包前预检（pre-package-check.sh）

**目的**：在调用 \`auto-package.sh\` 之前，把会导致打包失败的问题提前拦住。预检不通过就不要进入打包，避免浪费时间跑一个注定失败的流程。

**调用方式**：
\`\`\`bash
bash <技能目录>/scripts/pre-package-check.sh \\
  --cmd auto-pack \\
  -n <项目名> -r <版本号,逗号分隔> \\
  -l <本地项目路径> -o <输出目录> \\
  [-j <java-home>] [-a <ant-home>]
\`\`\`

\`--cmd\` 可选 \`auto-pack\`（默认，需 \`.svn\` 工作副本）或 \`pack\`（需 \`-s <svn-url>\`）。

**校验项**（5 类）：
1. 必填参数齐全性 + 版本号格式（逗号分隔的数字）
2. 项目路径存在 + SVN 工作副本（auto-pack 模式）+ 输出目录可写
3. 项目类型识别（Web=有 \`WebRoot/\`；Server=有 \`bin/+lib/\`）+ \`build.xml\` 配置一致性
4. 工具链：\`svn\`（必须）、\`javac\`（必须）、\`ant\`（可选）
5. 版本号 ≤ SVN 仓库 HEAD（\`svn info -r HEAD\` 远程查询；本地根目录版本老于目标版本仅 WARN 提示，mixed-revision 模型下根目录版本不代表文件内容新旧）

**退出码**：\`0\`=可打包（含警告），\`1\`=有错误不可打包。

**怎么用结果**：
- 退出码 1 → 向用户报告全部 FAIL 项，询问是否先修复再打包，**不要继续阶段二**
- 退出码 0 但有 WARN → 提示用户注意警告，通常可继续
- 退出码 0 无 WARN → 直接进入阶段二

### 阶段二：打包执行监控

这一阶段**不单独写脚本**——直接由你（Claude）调用 \`auto-package.sh\` 并解析其输出。理由是 \`auto-package.sh\` 自带 \`set -euo pipefail\` 和编译失败 \`exit 1\`，监控层只需捕获并解读。

**运行时路径解析**：阶段二调用 auto-package.sh 前，先读 \`.venus/config.yaml\` 的 \`auto_package.runtime_dir\` 字段（默认 \`vendor/auto-package-svn\`，项目根相对路径），定位 auto-package 运行时目录。未配置用默认值；拼接 \`<runtime_dir>/auto-package.sh\`，文件不存在则报错提示用户配置 \`auto_package.runtime_dir\` 或备份运行时到 vendor。auto-package.sh 自包含（\`SCRIPT_DIR\` 定位同目录 conf 与 \`lib/ecj jar\`），\`runtime_dir\` 同时定位 \`auto-package.conf\` 与 \`lib/ecj-4.6.3.jar\`。

**调用方式**（Git Bash）：
\`\`\`bash
# runtime_dir 从 .venus/config.yaml 的 auto_package.runtime_dir 读取，默认 vendor/auto-package-svn
bash <runtime_dir>/auto-package.sh auto-pack \\
  -n <项目名> -r <版本号> \\
  -l <本地项目路径> -o <输出目录> \\
  -j <java-home> -a <ant-home> -v
\`\`\`

\`-v\` 开启详细输出，便于诊断。PowerShell 环境可用 \`<runtime_dir>/auto-package.ps1\` 包装器。

**监控要点**：
- 退出码 0 → 进入阶段三校验产出
- 退出码非 0 → 解析 stderr，常见失败原因见下方"错误诊断"。**立即暂停**，向用户报告失败原因和上下文，不要继续阶段三
- 关注 stderr 里的 \`javac\` 编译错误（\`找不到符号\`、\`程序包不存在\`）、\`svn\` 失败（认证、路径）、\`Argument list too long\`

**如果用户说"已经打包完了，只校验"**：跳过阶段二，直接进阶段三。

### 阶段三：打包后一致性校验（verify-package.sh）

**目的**：以 SVN 变更清单为基准，逐项核对产出目录，确认该有的文件都在、不该有的没混入、目录结构正确、编译产物齐全。这是质量交付的最后一道闸门。

**调用方式**：
\`\`\`bash
bash <技能目录>/scripts/verify-package.sh \\
  -n <项目名> -r <版本号,逗号分隔> \\
  -l <本地项目路径> -o <产出目录> \\
  [--cmd auto-pack|pack] [--strict] [--workers N] [-j <JDK路径>]
\`\`\`

注意：\`-o\` 指的是**产出目录的父级**（与传给 \`auto-package.sh\` 的 \`-o\` 一致），脚本会自动在后面拼 \`/<项目名>/\` 找实际产出。

**\`--strict\` 严格模式**：开启后会检测"多余文件"（产出里有但变更清单里没有的文件，排除 \`readme.txt\`/\`filelist.txt\`）。日常增量打包建议开启，能发现误打包的文件。不开启时只报缺失/编译缺失/应删未删。

**\`--workers N\` 并行数**（默认 4）：控制两个并行点——各版本 \`svn diff\` 并发收集、变更文件分块并行核对。\`--workers 1\` 完全串行（调试对照用）。多版本大变更场景下并行优化可将校验耗时从 ~2 分钟降到 ~20 秒（diff 阶段受 SVN 服务器响应速度限制，为主要耗时）；内部类基准为 1 次批量扫描 + 内存查表。

**\`-j/--java-home\` JDK 路径**（可选，默认环境 \`JAVA_HOME\`）：用于 **ECJ 字节码抽检**——对产出 class 用 \`javap\` 与 IDE 产物（源项目 \`WebRoot/WEB-INF/classes/\` 或 \`bin/\`）精确对比指令序列，确认 auto-package 改用 ECJ 后字节码与 IDE 100% 一致。未指定且环境无 \`JAVA_HOME\` 时跳过抽检（不报错，仅 INFO）。

**校验逻辑**（与 \`auto-package.sh\` 路径映射完全对齐）：

| 变更类型 | 项目类型 | 期望产出 |
|---|---|---|
| A/M \`src/x/foo.java\` | Web | \`WEB-INF/classes/x/foo.class\`（含内部类 \`foo$*.class\`） |
| A/M \`src/x/foo.java\` | Server | \`bin/x/foo.class\` |
| A/M \`src/conf/x.xml\` | Web | \`WEB-INF/classes/conf/x.xml\` |
| A/M \`src/conf/x.xml\` | Server | \`bin/conf/x.xml\` |
| A/M \`WebRoot/x.jsp\` | Web | \`x.jsp\`（剥离 \`WebRoot/\` 前缀） |
| A/M \`lib/x.jar\` / \`run/x.sh\` | Server | 原样保留 |
| D \`src/x/foo.java\` | 任意 | 产出**不应**含对应 \`.class\` |
| D \`WebRoot/x.jsp\` | Web | 产出**不应**含 \`x.jsp\` |

**特殊处理**：
- **目录变更跳过**：SVN diff 在新增文件时会额外列出其所在目录（如 \`A src/.../service\`，无扩展名）。\`auto-package.sh\` 对这种目录行会被 \`cp\` 的 \`[[ ! -f ]]\` 跳过，本脚本同样跳过，避免误报缺失。
- **IDE 配置过滤**：与 \`auto-package.sh\` 同口径过滤 \`.settings/.classpath/.project/.git\`，避免误报。
- **内部类验证**：一个 \`.java\` 编译产出主类 \`foo.class\` + 内部类 \`foo$1.class\`、\`foo$Bar.class\` 等。主类必须存在；内部类以**源项目本地编译输出目录**（Web=\`WebRoot/WEB-INF/classes/\`，Server=\`bin/\`）中该主类的全部 \`foo$*.class\` 为基准逐一核对，缺失报 \`[内部类缺失]\`。基准目录无该包或无内部类时跳过（该类无内部类或本地未全量编译）。内部类同时记入期望清单（strict 模式不误报多余）。
- **多版本去重**：多版本打包时，同一文件路径取最新版本状态（先 A 后 D → 最终 D；先 D 后 A → 最终 A）。
- **ECJ 字节码抽检**：auto-package.sh 改用 ECJ 后，产出 class 字节码应与 IDE（Eclipse）一致。对每个产出 class（IDE 有对应产物的）用 \`javap -c -p\` 精确对比指令序列（去除地址/常量池索引/注释），diff=0 通过，diff>0 报 \`[字节码差异]\`。新增类（IDE 无对应产物）跳过。javap 不可用时跳过整段抽检。

**退出码**：\`0\`=一致（PASS），\`1\`=有差异（FAIL），\`2\`=无法校验（产出目录不存在/SVN 不可用等）。

**怎么解读报告**：
- \`[ OK ]\` 匹配成功（含"（内部类）"后缀的行 = 内部类核对通过）
- \`[缺失]\` 变更清单要求产出，但产出里没有 —— 多半是编译失败或路径映射错误
- \`[编译缺失]\` \`.java\` 变更了但主类 \`.class\` 不存在 —— 编译可能失败，回看阶段二的 javac 日志
- \`[内部类缺失]\` 主类 \`.class\` 在，但源项目基准中该类的某内部类 \`foo$*.class\` 在产出中缺失 —— 复制/清理环节丢失，或本地基准过期（源码删了内部类但旧 class 还在）
- \`[应删未删]\` 文件已在某版本删除，但产出仍包含（含已删类的 \`foo$*.class\` 残留）—— 旧产出未清理或版本号选错
- \`[多余]\`（仅 strict）产出里有变更清单之外的文件 —— 可能误打包了无关文件
- \`[字节码差异]\` 产出 class 与 IDE 产物指令序列不一致 —— ECJ 选项未对齐 IDE，或 ECJ jar 版本与 IDE 不匹配，回看 auto-package.sh 的 ECJ 编译选项（\`-1.8 -g -preserveAllLocals\`）
- **一致性评分**：\`匹配数/(A+M数)\`，100% 才算 PASS（内部类核对不加分，只扣缺失）。字节码差异不计入评分百分比，但计入 FAIL 判定（有字节码差异即 FAIL）。

### 阶段四：升级信息归集

**目的**：阶段三一致性校验通过后，归集本次增量包的升级信息（待执行 SQL、待变更配置参数），输出 \`升级文档.md\` 到产出目录，随增量包交付运维，补齐"打包→校验→升级文档"闭环。阶段四在阶段三 PASS 后触发；"只校验已有产出"场景（跳过阶段一二）同样适用。

**输入**：① 打包产出目录（含 readme.txt、变更文件清单）；② OpenSpec 变更提案（\`openspec/changes/<name>/\`，通过 readme.txt 反查关联）。

#### 流程

1. **提案反查**：读产出 \`readme.txt\`（auto-package.sh 已含各 revision 提交作者/日期/说明），按约定格式从提交说明提取 change 名，定位 \`openspec/changes/<name>/\`。提取顺序：
   - **显式标记优先**：匹配 \`变更: <name>\` / \`[<name>]\` / \`change: <name>\`（不区分大小写），提取 \`<name>\`。
   - **目录名回退匹配**：无显式标记时，将提交说明与 \`openspec/changes/\` 下全部未归档变更目录名做子串匹配（目录名形如 \`<action>-<module>-<desc>\`，全小写连字符），命中即关联。
   - **多 revision 累积**：每个 revision 独立提取，汇总后按 change 名去重分组。某 revision 提取不到 change 名时归入"未关联"区段，不阻断其他 revision 反查。
   - 提取到的 change 名须 \`openspec/changes/<name>/proposal.md\` 存在方算关联成功。

2. **反查失败处理**：\`readme.txt\` 无 change 名 / 提案不存在 / \`readme.txt\` 不存在时，**静默跳过提案来源**，仅归集产出文件中的 SQL/配置，不阻断、不提示用户手动指定。升级文档头部注明"未关联到 OpenSpec 提案"。

3. **SQL 四源归集**（待执行 SQL，各源互补，某源为空时该子节标"（无）"不报错）：
   - **来源①**：产出中的 \`.sql\` 文件（增量包内变更的 .sql 直接归集）
   - **来源②**：Java/Mapper XML 内嵌 SQL（扫描变更的 Java DAO/Service 或 MyBatis Mapper XML，抽取建表/改表/DML 语句）
   - **来源③**：独立 \`db/migration\` 目录（按版本号对应查找）
   - **来源④**：提案 tasks 的 \`[DB脚本]\` 标记（依赖提案关联成功，从 \`tasks.md\` 标 \`[DB脚本]\` 的任务抽取）

4. **配置参数三源归集**（待变更配置参数，各源互补，某源为空时该子节标"（无）"不报错）：
   - **来源①**：产出中的配置文件（\`.properties\`/\`.xml\`/\`.yaml\`，diff 出新增/修改参数项）
   - **来源②**：提案声明的配置项（从 \`proposal.md\`/\`design.md\` 显式声明抽取，依赖提案关联成功）
   - **来源③**：特定配置文件（\`auto-package.conf\` / 项目 config 等关键参数）

5. **多版本去重分组**：多版本打包时，按反查到的 change 名去重分组——一升级文档含多 change 区段，或一 change 跨多 revision 归一为该 change 区段。全部 revision 均无 change 名时退化为单"未关联提案"区段（仅产出文件归集）。

6. **输出 \`升级文档.md\`**：写入产出目录（与 \`readme.txt\`/\`filelist.txt\` 同级），结构：
   - **头部**：项目名 / 版本 / 生成时间 / 关联提案状态（已关联 N 个 / 未关联）
   - **一、待执行 SQL**（四来源各一子节）
   - **二、待变更配置参数**（三来源各一子节）
   - **三、关联 OpenSpec 提案**（change 名 + 关联 revision + proposal 要点摘要；或"未关联到 OpenSpec 提案"）
   - **四、增量包文件清单**（引自 \`readme.txt\`/\`filelist.txt\`）
   - 各源为空时该子节标"（无）"，不省略节标题（保持结构稳定，便于运维核对归集完整性）。

#### 怎么用结果

- 升级文档随增量包交付运维，运维按文档执行 SQL、变更配置参数完成升级部署。
- 未关联提案时文档仍可用（基于产出文件归集），但缺提案来源的 SQL/配置项需人工复核。
- 阶段四不阻断交付：即使提案反查失败、某源归集为空，仍输出升级文档（标注降级状态）。

## 典型工作流

### 场景 A：完整闭环打包（推荐）
用户说"打个 Venus4A 的包，版本 66525"：
1. 跑 \`pre-package-check.sh\` → 预检通过
2. 跑 \`auto-package.sh auto-pack ...\` → 监控输出，编译失败则暂停报告
3. 跑 \`verify-package.sh --strict\` → 一致性校验
4. 全绿则向用户报告"打包完成且校验通过，产出在 <目录>，共 N 个文件"；有问题则报告具体差异

### 场景 B：只校验已有产出
用户说"我已经打完包了，帮我看看对不对"：
1. 直接跑 \`verify-package.sh --strict\`（跳过阶段一二）
2. 报告一致性结果

### 场景 C：诊断打包失败
用户说"打包报错了"：
1. 跑 \`pre-package-check.sh\` 排除环境/参数问题
2. 如果预检通过，重新跑 \`auto-package.sh -v\` 捕获详细错误
3. 按"错误诊断"对照处理

## 使用 SKILL：参数传递与追问

本技能的两个脚本都需要一组打包参数。用户很少会一次说全，你的职责是从用户的自然语言描述里提取这些参数，缺失的主动追问，不要凭空假设。

### 必需参数（4 个，缺一不可）

| 参数 | 脚本选项 | 用户可能怎么说 | 缺失时的处理 |
|---|---|---|---|
| 项目名称 | \`-n\` | "打包 Venus4A""给 AccountManager 打个包" | 从用户描述提取；提取不到则追问"打包哪个项目？" |
| 版本号 | \`-r\` | "版本 66525""r66525-66528""今天提交的两个版本" | 追问"打哪个 SVN 版本号？多个用逗号分隔"。可先用 \`svn info --show-item revision <项目路径>\` 看本地版本辅助 |
| 项目路径 | \`-l\` | "Venus4A 在 E:\\WorkSpaces_ahdx" | 多数项目在 \`E:\\WorkSpaces_ahdx\\<项目名>\`，可先按此推断并让用户确认；不在则追问 |
| 输出目录 | \`-o\` | "输出到 F:\\ProjectPackage" | 默认用 \`auto-package.conf\` 的 \`DEFAULT_OUTPUT_DIR\`（\`E:/ProjectPackage\`）；用户未指定时用默认值并告知，不要追问 |

### 可选参数（有默认值，不追问除非用户在意）

| 参数 | 脚本选项 | 默认 | 何时需要问用户 |
|---|---|---|---|
| JDK 路径 | \`-j\` | \`auto-package.conf\` 的 \`DEFAULT_JAVA_HOME\`（JDK 1.8.0_202） | 一般用默认；项目要求其他 JDK（如 1.7/21）时才问"用哪个 JDK？" |
| Ant 路径 | \`-a\` | \`auto-package.conf\` 的 \`DEFAULT_ANT_HOME\` | 用默认即可，几乎不用问 |
| SVN 仓库地址 | \`-s\` | 无（仅 pack 模式需要） | 仅当用户要直连仓库（非本地工作副本）时追问"SVN 仓库地址是？" |
| 命令模式 | \`--cmd\` | \`auto-pack\` | 仅当用户明确要"直连仓库打包"或本地无 \`.svn\` 时用 \`pack\` |
| 严格模式 | \`--strict\` | 关 | 校验阶段默认建议开（能发现多余文件），除非用户明确说"只看缺不缺" |

### 追问原则

- **一次问清，不要挤牙膏**：缺多个参数时合并成一次提问，给用户选项减少输入负担。
- **给推断选项**：能从上下文推断的值（如项目路径默认 \`E:\\WorkSpaces_ahdx\\<项目名>\`），先给出推断结果让用户确认，而非空问。
- **不要假设版本号**：版本号是强语义参数，错一个数字就打错包，必须由用户明确给出，绝不自己猜。
- **版本号要匹配**：只校验场景下，校验用的版本号必须与打包时一致。用单版本去校验多版本合并的产出，strict 模式会把其他版本的文件判为"多余"——这是正确行为，要主动提醒用户。
- **默认值要说明**：用默认输出目录、默认 JDK 时，告知用户"用的是默认值 X"，让用户有机会否决。

### 参数到脚本的映射

用户给的自然语言，映射成脚本调用：

\`\`\`
用户："打包 Venus4A，版本 66525，输出到 E:\\ProjectPackage\\today"
        ↓ 提取
项目名=Venus4A  版本=66525  路径=E:\\WorkSpaces_ahdx\\Venus4A（推断）  输出=E:\\ProjectPackage\\today  JDK=默认
        ↓ 映射（路径转 POSIX）
pre-package-check.sh --cmd auto-pack -n Venus4A -r 66525 \\
  -l /e/WorkSpaces_ahdx/Venus4A -o /e/ProjectPackage/today
        ↓ 预检通过后
auto-package.sh auto-pack -n Venus4A -r 66525 \\
  -l /e/WorkSpaces_ahdx/Venus4A -o /e/ProjectPackage/today
        ↓ 打包通过后
verify-package.sh -n Venus4A -r 66525 \\
  -l /e/WorkSpaces_ahdx/Venus4A -o /e/ProjectPackage/today --strict
\`\`\`

注意 \`verify-package.sh\` 的 \`-o\` 与 \`auto-package.sh\` 的 \`-o\` 一致（都是产出父目录），脚本会自动拼 \`/<项目名>/\`。

### 典型调用对话

**对话 1（信息完整）**：
> 用户：帮我打 Venus4A 的包，版本 66525 和 66526，放 E:\\ProjectPackage\\0910

你：项目路径默认用 \`E:\\WorkSpaces_ahdx\\Venus4A\`，JDK 用默认 1.8.0_202，确认吗？
> 用户：嗯

→ 直接进预检 → 打包 → 校验。

**对话 2（缺版本号）**：
> 用户：打个 AccountManager 的增量包

你：打包 AccountManager，SVN 版本号是？可以多个用逗号分隔。要看本地最新版本的话我先帮你查 \`svn info\`。
> 用户：52241

→ 补全后进预检。

**对话 3（本地无 SVN 工作副本）**：
> 用户：用 SVN 仓库地址打包 Venus4A

你：auto-pack 需要本地工作副本。你这里走 pack 模式直连仓库——SVN 仓库地址是？版本号是？
> 用户：https://172.16.96.1/svn/venus/Venus4A/，版本 66525

→ 用 \`--cmd pack -s <url>\` 调脚本。

**对话 4（只校验）**：
> 用户：我已经打包完了 Venus4A，帮我看看产出对不对

你：产出在哪个目录？打的是哪个版本？（校验用的版本号必须和打包时一致，否则 strict 模式会把版本号区间外的文件判为多余）
> 用户：E:\\ProjectPackage\\0910，版本 66525 到 66528

→ 直接跑 \`verify-package.sh --strict -n Venus4A -r 66525,66526,66527,66528 -l ... -o ...\`，跳过预检和打包。

## 错误诊断（常见问题速查）

详细的错误码与诊断步骤见 \`references/error-codes.md\`。这里列最高频的几类：

| 现象 | 根因 | 处理 |
|---|---|---|
| \`javac\` 报"找不到符号"/"程序包不存在" | classpath 缺依赖 jar | 确认 \`WebRoot/WEB-INF/lib/\` 或 \`lib/\` 含全部依赖；Web 项目确认 Tomcat \`servlet-api.jar\` 在路径 |
| \`Argument list too long\` | 源文件过多超命令行长度 | \`auto-package.sh\` 已用 argfile 规避，若仍出现检查 \`compile_java_files\` 是否生效 |
| SVN diff 返回空 | 版本号超过本地工作副本 | \`svn update\` 到目标版本，或改用 \`pack\` 模式直连仓库 |
| verify 报"编译缺失"但阶段二没报错 | \`.java\` 有语法/依赖问题被 javac 跳过 | 回看阶段二 javac 日志，单独编译该文件定位 |
| verify 报"应删未删" | 旧产出未清理 | \`auto-package.sh\` 会 \`rm -rf\` 输出目录，若仍残留检查输出目录是否被占用 |
| pre-check 报"build.increment.xml 占位符未填充" | Venus4A 用 Ant 模板路线时需先填充 | 用 \`svnpackage.jar\` 生成 \`build.<rev>.xml\` 再 \`ant -f\` 执行（与 auto-package.sh 路线二选一） |

## 关于 build.xml 的角色澄清

\`build.xml\` 在 \`auto-package.sh\` 流程里**不是打包的执行依据**——脚本直接调 \`javac\` 做增量编译，不解析 \`build.xml\`。但 \`build.xml\` 仍是**全量打包/打 war/tar** 的配置（如 \`ant war\`、\`ant zip\`），且能反映项目的预期目录结构。

所以本技能里 \`build.xml\` 的作用是：
- 预检阶段：校验 \`build.xml\` 声明的 property（bin/lib/run/WebRoot）与实际目录是否一致，发现"配置漂移"
- 不作为一致性校验的基准（基准是 SVN 变更清单）

详细的 \`build.xml\` 配置规范与项目类型判定矩阵见 \`references/build-config-spec.md\`。

## 脚本路径

两个脚本都在本技能的 \`scripts/\` 目录下：
- \`scripts/pre-package-check.sh\` — 打包前预检
- \`scripts/verify-package.sh\` — 打包后一致性校验

调用时用绝对路径或相对于技能目录的路径。技能目录即本 \`SKILL.md\` 所在目录。

> **打包脚本本体**（\`auto-package.sh\` + \`auto-package.conf\` + \`lib/ecj-4.6.3.jar\`）不在技能 \`scripts/\` 目录，而是备份在项目内 \`vendor/auto-package-svn/\`（路径可经 \`.venus/config.yaml\` 的 \`auto_package.runtime_dir\` 配置，见阶段二"运行时路径解析"）。阶段二调用打包脚本本体，阶段一、三调用本技能 \`scripts/\` 下的校验脚本。

## 环境前提

- Git Bash（Windows）—— 脚本用 bash 语法，与 \`auto-package.sh\` 同生态
- auto-package 运行时（\`auto-package.sh\` + \`auto-package.conf\` + \`lib/ecj-4.6.3.jar\`）：默认项目内 \`vendor/auto-package-svn/\`，路径可经 \`.venus/config.yaml\` 的 \`auto_package.runtime_dir\` 配置
- SVN 命令行客户端（TortoiseSVN 命令行需加入 PATH）
- JDK（\`auto-package.sh\` 用 \`javac\` 编译，需通过 \`-j\` 或 \`auto-package.conf\` 的 \`DEFAULT_JAVA_HOME\` 指定）
- Ant（可选，仅 Ant 模板路线需要）

脚本路径转换逻辑与 \`auto-package.sh\` 完全一致（\`to_posix_path\`），所以传参时 Windows 路径（\`E:\\...\`）和 POSIX 路径（\`/e/...\`）都能接受。
`;

const PRE_PACKAGE_CHECK = `#!/bin/bash
# ============================================================
# pre-package-check.sh - 打包前预检
# 在调用 auto-package.sh 之前，对参数、项目结构、构建配置、
# 工具链环境做静态校验，提前拦截会导致打包失败的问题。
#
# 退出码约定：
#   0 = 全部通过，可进入打包
#   1 = 存在错误（参数缺失/路径不存在/配置不一致/工具缺失）
#   2 = 脚本自身使用错误（参数不合法）
#
# 用法：
#   bash pre-package-check.sh \\
#     -n <项目名> -r <版本号列表> -l <本地项目路径> -o <输出目录> \\
#     [-s <svn-url>] [-j <java-home>] [-a <ant-home>] [--cmd auto-pack|pack]
# ============================================================
set -uo pipefail

# ---------- 颜色输出 ----------
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

PASS_CNT=0
WARN_CNT=0
FAIL_CNT=0

# 说明：用 printf '%s' 输出消息体，避免路径中的反斜杠被 echo -e 当作转义符
# （如 \\a 被解释为响铃、\\t 被解释为制表符，导致路径显示错乱）
ok()   { printf '%b[PASS]%b %s\\n' "\${GREEN}" "\${NC}" "$*"; PASS_CNT=$((PASS_CNT+1)); }
warn() { printf '%b[WARN]%b %s\\n' "\${YELLOW}" "\${NC}" "$*"; WARN_CNT=$((WARN_CNT+1)); }
fail() { printf '%b[FAIL]%b %s\\n' "\${RED}" "\${NC}" "$*"; FAIL_CNT=$((FAIL_CNT+1)); }
info() { printf '%b[INFO]%b %s\\n' "\${BLUE}" "\${NC}" "$*"; }

# ---------- 路径转换（与 auto-package.sh 保持一致）----------
to_posix_path() {
    local path="$1"
    if [[ "$path" == /* ]]; then
        echo "$path"; return
    fi
    echo "$path" | sed 's|^\\([A-Za-z]\\):\\\\|/\\L\\1/|g; s|^\\([A-Za-z]\\):/|/\\L\\1/|g; s|\\\\|/|g'
}

# ---------- 参数默认值 ----------
PROJECT_NAME=""
REVISIONS=""
PROJECT_PATH=""
OUTPUT_DIR=""
SVN_URL=""
JAVA_HOME_OPT=""
ANT_HOME_OPT=""
CMD="auto-pack"

# ---------- 参数解析 ----------
while [[ $# -gt 0 ]]; do
    case "$1" in
        -n|--name)        PROJECT_NAME="$2"; shift 2 ;;
        -r|--revisions)   REVISIONS="$2"; shift 2 ;;
        -l|--local-path)  PROJECT_PATH="$(to_posix_path "$2")"; shift 2 ;;
        -o|--output)      OUTPUT_DIR="$(to_posix_path "$2")"; shift 2 ;;
        -s|--svn-url)     SVN_URL="$2"; shift 2 ;;
        -j|--java-home)   JAVA_HOME_OPT="$(to_posix_path "$2")"; shift 2 ;;
        -a|--ant-home)    ANT_HOME_OPT="$(to_posix_path "$2")"; shift 2 ;;
        --cmd)            CMD="$2"; shift 2 ;;
        -h|--help)
            cat << EOF
用法: bash pre-package-check.sh [options]
必填: -n 项目名 -r 版本号 -l 项目路径 -o 输出目录
可选: -s svn-url(pack模式) -j java-home -a ant-home --cmd auto-pack|pack
EOF
            exit 2
            ;;
        *) fail "未知参数: $1"; exit 2 ;;
    esac
done

echo "========================================"
echo "  打包前预检报告"
echo "========================================"
info "命令模式: \${CMD}"
info "项目名称: \${PROJECT_NAME:-<未提供>}"
info "版本号:   \${REVISIONS:-<未提供>}"
info "项目路径: \${PROJECT_PATH:-<未提供>}"
info "输出目录: \${OUTPUT_DIR:-<未提供>}"
if [[ -n "\${SVN_URL}" ]]; then info "SVN地址:  \${SVN_URL}"; fi
echo "----------------------------------------"

# ============================================================
# 1. 必填参数齐全性校验
# ============================================================
info "【1/5】校验必填参数"
PARAM_FAIL=0
[[ -z "\${PROJECT_NAME}" ]] && { fail "缺少 -n/--name (项目名称)"; PARAM_FAIL=1; }
[[ -z "\${PROJECT_PATH}" ]] && { fail "缺少 -l/--local-path (项目路径)"; PARAM_FAIL=1; }
[[ -z "\${REVISIONS}" ]] && { fail "缺少 -r/--revisions (版本号)"; PARAM_FAIL=1; }
[[ -z "\${OUTPUT_DIR}" ]] && { fail "缺少 -o/--output (输出目录)"; PARAM_FAIL=1; }
if [[ "\${CMD}" == "pack" && -z "\${SVN_URL}" ]]; then
    fail "pack 模式缺少 -s/--svn-url (SVN 仓库地址)"
    PARAM_FAIL=1
fi
if [[ \${PARAM_FAIL} -eq 0 ]]; then ok "必填参数齐全"; fi

# 版本号格式校验（应为逗号分隔的纯数字）
if [[ -n "\${REVISIONS}" ]]; then
    if [[ ! "\${REVISIONS}" =~ ^[0-9]+(,[0-9]+)*$ ]]; then
        fail "版本号格式错误: '\${REVISIONS}'，应为逗号分隔的数字（如 64561,64562）"
    else
        ok "版本号格式合法: \${REVISIONS}"
    fi
fi
echo "----------------------------------------"

# ============================================================
# 2. 项目路径存在性 + SVN 工作副本
# ============================================================
info "【2/5】校验项目路径与 SVN 工作副本"
if [[ -n "\${PROJECT_PATH}" ]]; then
    if [[ ! -d "\${PROJECT_PATH}" ]]; then
        fail "项目路径不存在: \${PROJECT_PATH}"
    else
        ok "项目路径存在: \${PROJECT_PATH}"
        # auto-pack 模式要求 .svn 目录
        if [[ "\${CMD}" == "auto-pack" ]]; then
            if [[ ! -d "\${PROJECT_PATH}/.svn" ]]; then
                fail "auto-pack 模式要求项目为 SVN 工作副本（缺少 .svn 目录）: \${PROJECT_PATH}"
            else
                ok "存在 .svn 目录（SVN 工作副本）"
            fi
        fi
    fi
fi

# 输出目录：若父目录不存在则告警（打包时会自动 mkdir，但父级不可写会失败）
if [[ -n "\${OUTPUT_DIR}" ]]; then
    PARENT_DIR="$(dirname "\${OUTPUT_DIR}")"
    if [[ ! -d "\${PARENT_DIR}" ]]; then
        warn "输出目录的父目录不存在: \${PARENT_DIR}（auto-package.sh 会尝试创建，但需确认可写权限）"
    else
        ok "输出目录父级存在: \${PARENT_DIR}"
    fi
fi
echo "----------------------------------------"

# ============================================================
# 3. 项目类型识别 + build.xml 配置一致性
# ============================================================
info "【3/5】校验项目类型与 build.xml 配置一致性"
PROJECT_TYPE=""
if [[ -d "\${PROJECT_PATH}" ]]; then
    if [[ -d "\${PROJECT_PATH}/WebRoot" ]]; then
        PROJECT_TYPE="web"
        ok "识别为 Web 项目（存在 WebRoot/）"
    elif [[ -d "\${PROJECT_PATH}/bin" && -d "\${PROJECT_PATH}/lib" ]]; then
        PROJECT_TYPE="server"
        ok "识别为 Server 项目（存在 bin/ + lib/）"
    else
        fail "无法识别项目类型：缺少 WebRoot/ 或 bin/+lib/ 目录（auto-package.sh 会判为 unknown）"
    fi
fi

# build.xml 配置一致性校验
BUILD_XML="\${PROJECT_PATH}/build.xml"
if [[ -n "\${PROJECT_TYPE}" && -f "\${BUILD_XML}" ]]; then
    ok "存在 build.xml: \${BUILD_XML}"

    # 读取 project name 属性（提取 name="..." 内容）
    # 用 ERE（-E）而非 PCRE（-P），兼容性更好；[[:space:]]\\+ 匹配一个或多个空白
    XML_PROJECT_NAME=$(grep -oE '<project[[:space:]]+name="[^"]*"' "\${BUILD_XML}" | head -1 | sed 's/.*name="//;s/"$//')
    if [[ -n "\${XML_PROJECT_NAME}" ]]; then
        info "  build.xml project name: \\"\${XML_PROJECT_NAME}\\""
    fi

    if [[ "\${PROJECT_TYPE}" == "web" ]]; then
        # Web 项目 build.xml 应引用 WebRoot
        if grep -q 'WebRoot' "\${BUILD_XML}"; then
            ok "build.xml 引用了 WebRoot（与项目结构一致）"
        else
            warn "build.xml 未引用 WebRoot，可能与 Web 项目结构不匹配"
        fi
        # Web 项目常见 target：war/zip/tar/update
        HAS_BUILD_TARGET=0
        for tgt in war zip tar update; do
            if grep -q "name=\\"\${tgt}\\"" "\${BUILD_XML}"; then HAS_BUILD_TARGET=1; break; fi
        done
        if [[ \${HAS_BUILD_TARGET} -eq 1 ]]; then
            ok "build.xml 含 Web 项目常见 target（war/zip/tar/update）"
        else
            warn "build.xml 未发现 war/zip/tar/update target，可能为自定义结构"
        fi
        # build.increment.xml 占位符校验（仅 Venus4A 系列使用模板）
        INCREMENT_XML="\${PROJECT_PATH}/build.increment.xml"
        if [[ -f "\${INCREMENT_XML}" ]]; then
            info "  发现 build.increment.xml（增量构建模板）"
            if grep -q 'UPDATE-PART\\|DELETE-PART' "\${INCREMENT_XML}"; then
                warn "build.increment.xml 含 \\\${UPDATE-PART}/\\\${DELETE-PART} 占位符未填充 —— 直接 ant 执行会失败，需先用 svnpackage.jar 生成具体 build.<rev>.xml"
            else
                ok "build.increment.xml 占位符已填充"
            fi
        fi
    elif [[ "\${PROJECT_TYPE}" == "server" ]]; then
        # Server 项目 build.xml 应含 bin/lib/run property
        local_miss=0
        for prop in bin lib run; do
            if grep -q "name=\\"\${prop}\\"" "\${BUILD_XML}"; then
                ok "build.xml 含 property: \${prop}"
            else
                warn "build.xml 缺少 property: \${prop}"
                local_miss=1
            fi
            # 校验对应物理目录存在
            if [[ ! -d "\${PROJECT_PATH}/\${prop}" ]]; then
                fail "项目缺少物理目录: \${prop}/（build.xml 引用但实际不存在）"
            fi
        done
        # Server 项目常见 target：copy/init/tar/zip
        HAS_BUILD_TARGET=0
        for tgt in copy init tar zip update; do
            if grep -q "name=\\"\${tgt}\\"" "\${BUILD_XML}"; then HAS_BUILD_TARGET=1; break; fi
        done
        if [[ \${HAS_BUILD_TARGET} -eq 1 ]]; then
            ok "build.xml 含 Server 项目常见 target（copy/init/tar/zip）"
        fi
    fi
elif [[ -n "\${PROJECT_TYPE}" && ! -f "\${BUILD_XML}" ]]; then
    warn "项目根目录无 build.xml（auto-package.sh 用 ECJ 直接增量编译，不依赖 Ant，可不阻塞，但全量打包/打 war 时会缺）"
fi
echo "----------------------------------------"

# ============================================================
# 4. 工具链环境校验（JDK / Ant / SVN）
# ============================================================
info "【4/5】校验工具链环境（JDK / Ant / SVN）"

# SVN（必须）
if command -v svn &>/dev/null; then
    SVN_VER=$(svn --version --quiet 2>/dev/null || echo "未知")
    ok "svn 可用: \${SVN_VER}"
else
    fail "svn 命令不可用 —— auto-package.sh 依赖系统 SVN 客户端（TortoiseSVN 命令行需加入 PATH）"
fi

# JDK（必须，auto-package.sh 用 ECJ 编译需 java；此处检查 javac 以确认完整 JDK 存在，字节码抽检需 javap）
JAVA_HOME_TO_USE="\${JAVA_HOME_OPT:-\${JAVA_HOME:-\${DEFAULT_JAVA_HOME:-}}}"
if [[ -n "\${JAVA_HOME_TO_USE}" ]]; then
    JAVAC_BIN="\${JAVA_HOME_TO_USE}/bin/javac"
    [[ ! -f "\${JAVAC_BIN}" ]] && JAVAC_BIN="\${JAVA_HOME_TO_USE}/bin/javac.exe"
    if [[ -f "\${JAVAC_BIN}" ]]; then
        JAVAC_VER=$("\${JAVAC_BIN}" -version 2>&1 | head -1)
        ok "javac 可用: \${JAVAC_VER}（\${JAVAC_BIN}）"
    else
        fail "JAVA_HOME 下找不到 javac: \${JAVA_HOME_TO_USE}/bin/javac"
    fi
else
    # 没有显式 JAVA_HOME，检查 PATH 中的 javac
    if command -v javac &>/dev/null; then
        ok "PATH 中 javac 可用: $(javac -version 2>&1 | head -1)"
    else
        fail "找不到 javac —— 需通过 -j/--java-home 或 auto-package.conf 的 DEFAULT_JAVA_HOME 指定 JDK 路径"
    fi
fi

# Ant（可选，仅 Ant 模式/build.increment.xml 路线需要）
ANT_HOME_TO_USE="\${ANT_HOME_OPT:-\${ANT_HOME:-\${DEFAULT_ANT_HOME:-}}}"
if [[ -n "\${ANT_HOME_TO_USE}" ]]; then
    ANT_BIN="\${ANT_HOME_TO_USE}/bin/ant"
    [[ ! -f "\${ANT_BIN}" ]] && ANT_BIN="\${ANT_HOME_TO_USE}/bin/ant.bat"
    if [[ -f "\${ANT_BIN}" ]] || command -v ant &>/dev/null; then
        ok "Ant 可用: \${ANT_HOME_TO_USE}"
    else
        warn "ANT_HOME 指定但找不到 ant 可执行: \${ANT_HOME_TO_USE}/bin/ant（不阻塞 auto-package.sh，但 Ant 路线不可用）"
    fi
else
    if command -v ant &>/dev/null; then
        ok "PATH 中 ant 可用: $(ant -version 2>&1 | head -1)"
    else
        warn "Ant 不可用（不阻塞 auto-package.sh 增量编译；若需 build.increment.xml 路线则需安装 Ant）"
    fi
fi
echo "----------------------------------------"

# ============================================================
# 5. 版本号有效性预检（检查版本号不超过 SVN 仓库 HEAD）
# 注意：上限必须用仓库 HEAD（svn info -r HEAD 远程查询），不能用本地
# 工作副本根目录 revision —— SVN 是 mixed-revision 模型，commit 只
# bump 被提交文件的 revision，根目录 revision 停留在上次 update，
# 用它做上限会把用户自己刚提交的版本误判为"超限"。
# 打包取清单走 svn diff -r A:B（服务器端对比），与本地副本版本无关。
# ============================================================
info "【5/5】校验版本号有效性（对比 SVN 仓库 HEAD）"
if [[ "\${CMD}" == "auto-pack" && -d "\${PROJECT_PATH}/.svn" && -n "\${REVISIONS}" && "\${REVISIONS}" =~ ^[0-9]+(,[0-9]+)*$ ]]; then
    # 仓库 HEAD（一次远程查询）；本地根目录 revision 仅用于内容一致性提示
    HEAD_REV=$(svn info -r HEAD --show-item revision "\${PROJECT_PATH}" 2>/dev/null || echo "")
    LOCAL_REV=$(svn info --show-item revision "\${PROJECT_PATH}" 2>/dev/null || echo "")
    # HEAD 查询失败（如离线）时回退用本地 revision 做上限，保持降级行为
    UPPER_REV="\${HEAD_REV:-\${LOCAL_REV}}"
    if [[ -n "\${UPPER_REV}" ]]; then
        info "SVN 仓库 HEAD 版本: \${HEAD_REV:-未知（离线？）}（本地工作副本根目录: \${LOCAL_REV:-未知}）"
        IFS=',' read -ra REV_ARR <<< "\${REVISIONS}"
        REV_EXCEED=0
        MAX_REV=0
        for rev in "\${REV_ARR[@]}"; do
            [[ \${rev} -gt \${MAX_REV} ]] && MAX_REV=\${rev}
            if [[ \${rev} -gt \${UPPER_REV} ]]; then
                fail "版本号 \${rev} 超过 SVN 仓库 HEAD \${UPPER_REV} —— 仓库中不存在该版本，请核对版本号"
                REV_EXCEED=1
            fi
        done
        if [[ \${REV_EXCEED} -eq 0 ]]; then
            ok "所有版本号均 ≤ 仓库 HEAD \${UPPER_REV}"
            # mixed-revision 提示：本地根目录版本低于最大目标版本时提醒（不阻断）
            # 根目录 revision 老不代表文件内容旧（用户自己 commit 的场景文件就是新的），
            # 但若本地确实未包含目标版本内容，编译产物会是旧内容，提示人工确认
            if [[ -n "\${HEAD_REV}" && -n "\${LOCAL_REV}" && \${MAX_REV} -gt \${LOCAL_REV} ]]; then
                warn "本地工作副本根目录版本 \${LOCAL_REV} 低于最大目标版本 \${MAX_REV}：若本地未包含这些版本的变更内容，请先 svn update（mixed-revision 下根目录版本老不一定代表文件内容旧，自己提交的版本内容即为最新）"
            fi
        fi
    else
        warn "无法获取 SVN 版本信息（svn info 失败），跳过版本号上限校验"
    fi
fi
echo "----------------------------------------"

# ============================================================
# 汇总
# ============================================================
echo "========================================"
echo "  预检汇总"
echo "========================================"
echo "  通过: \${PASS_CNT}  警告: \${WARN_CNT}  失败: \${FAIL_CNT}"
echo "----------------------------------------"

if [[ \${FAIL_CNT} -gt 0 ]]; then
    echo -e "\${RED}结论: FAIL - 存在 \${FAIL_CNT} 个错误，不建议进入打包\${NC}"
    exit 1
elif [[ \${WARN_CNT} -gt 0 ]]; then
    echo -e "\${YELLOW}结论: WARN - 存在 \${WARN_CNT} 个警告，可打包但需关注\${NC}"
    exit 0
else
    echo -e "\${GREEN}结论: PASS - 全部通过，可执行打包\${NC}"
    exit 0
fi
`;

const VERIFY_PACKAGE = `#!/bin/bash
# ============================================================
# verify-package.sh - 打包后一致性校验
# 以 SVN 变更清单（svn diff --summarize）为基准，逐项核对产出目录
# 中的文件是否齐全、是否多余、目录结构是否正确、编译产物是否缺失。
#
# 校验基准：SVN 变更清单为准（A/M 操作 → 产出应有对应文件；
#           D 操作 → 产出不应有该文件）。
# 编译产物校验：主类 .class 必须存在；内部类 Bar$*.class 以源项目
#           本地编译输出目录（WebRoot/WEB-INF/classes/ 或 bin/）为基准
#           逐一核对，防止内部类在复制/清理环节丢失。
# 路径映射规则：与 auto-package.sh 的 run_web_build/run_server_build
#           完全对齐，确保校验口径与打包口径一致。
#
# 退出码约定：
#   0 = 一致性通过（无缺失、无多余、无错位）
#   1 = 存在差异（缺失/多余/应删未删/编译缺失）
#   2 = 无法校验（环境/参数错误，如产出目录不存在、SVN 不可用）
#
# 用法：
#   bash verify-package.sh \\
#     -n <项目名> -r <版本号列表> -l <本地项目路径> -o <产出目录> \\
#     [-s <svn-url>] [--cmd auto-pack|pack] [--strict] [--workers N]
#
# 性能说明（并行加速）：
#   - SVN diff 按版本并行收集（并发数 = --workers，默认 4）
#   - 变更文件分块并行核对（worker 数 = --workers，默认 4）
#   - 内部类基准批量预收集 + 内存查表，消除逐文件 find/sort 的 fork 开销
#   - --workers 1 退化为完全串行（对照/调试用）
# ============================================================
set -uo pipefail

# ---------- 颜色输出 ----------
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

# 计数器
MISS_CNT=0          # 缺失文件
EXTRA_CNT=0         # 多余文件
NOTDEL_CNT=0        # 应删未删
NOCOMPILE_CNT=0     # 编译产物缺失
INNER_MISS_CNT=0    # 内部类缺失
BYTECODE_DIFF_CNT=0 # 字节码差异（ECJ产物 vs IDE产物）
BYTECODE_CHECK_CNT=0 # 字节码抽检数
MATCH_CNT=0         # 匹配成功

# 用 printf '%s' 输出消息体，避免路径反斜杠被转义
ok()     { printf '%b[ OK ]%b %s\\n' "\${GREEN}"  "\${NC}" "$*"; }
miss()   { printf '%b[缺失]%b %s\\n'   "\${RED}"    "\${NC}" "$*"; MISS_CNT=$((MISS_CNT+1)); }
extra()  { printf '%b[多余]%b %s\\n'   "\${YELLOW}" "\${NC}" "$*"; EXTRA_CNT=$((EXTRA_CNT+1)); }
notdel() { printf '%b[应删未删]%b %s\\n' "\${RED}" "\${NC}" "$*"; NOTDEL_CNT=$((NOTDEL_CNT+1)); }
nocompile() { printf '%b[编译缺失]%b %s\\n' "\${RED}" "\${NC}" "$*"; NOCOMPILE_CNT=$((NOCOMPILE_CNT+1)); }
innermiss() { printf '%b[内部类缺失]%b %s\\n' "\${RED}" "\${NC}" "$*"; INNER_MISS_CNT=$((INNER_MISS_CNT+1)); }
bytecode_diff() { printf '%b[字节码差异]%b %s\\n' "\${RED}" "\${NC}" "$*"; BYTECODE_DIFF_CNT=$((BYTECODE_DIFF_CNT+1)); }
info()   { printf '%b[INFO]%b %s\\n'   "\${BLUE}"   "\${NC}" "$*"; }

# ---------- 路径转换（与 auto-package.sh 一致）----------
to_posix_path() {
    local path="$1"
    if [[ "$path" == /* ]]; then echo "$path"; return; fi
    echo "$path" | sed 's|^\\([A-Za-z]\\):\\\\|/\\L\\1/|g; s|^\\([A-Za-z]\\):/|/\\L\\1/|g; s|\\\\|/|g'
}

# ============================================================
# 路径映射函数（对齐 auto-package.sh 的 run_web_build/run_server_build）
# 必须在主流程调用前定义
# ============================================================

# map_path: 将 SVN 路径映射为产出目录中的相对路径（非 Java 资源文件）
# 结果写入全局变量 MAPPED（不走 echo，避免 $( ) 命令替换的 fork 开销）
# 参数: $1 = SVN 变更路径（已转正斜杠）, $2 = 项目类型
map_path() {
    local file_path="$1"
    local ptype="$2"

    if [[ "\${ptype}" == "web" ]]; then
        # Web 项目（run_web_build 行421-427）
        if [[ "\${file_path}" == src/* ]]; then
            MAPPED="WEB-INF/classes/\${file_path#src/}"
        elif [[ "\${file_path}" == WebRoot/* ]]; then
            MAPPED="\${file_path#WebRoot/}"
        else
            MAPPED="\${file_path}"
        fi
    else
        # Server 项目（run_server_build 行486-490）
        if [[ "\${file_path}" == src/* ]]; then
            MAPPED="bin/\${file_path#src/}"
        else
            MAPPED="\${file_path}"
        fi
    fi
}

# map_java_to_class: 将 Java 源文件路径映射为产出 .class 路径
# 结果写入全局变量 CLASS_MAPPED（不走 echo，避免 $( ) 命令替换的 fork 开销）
# 参数: $1 = SVN 变更路径（已转正斜杠，.java 结尾）, $2 = 项目类型
map_java_to_class() {
    local file_path="$1"
    local ptype="$2"
    # 先去掉 .java 后缀，换成 .class
    local class_path="\${file_path%.java}.class"

    if [[ "\${ptype}" == "web" ]]; then
        # src/foo/Bar.java → WEB-INF/classes/foo/Bar.class
        if [[ "\${file_path}" == src/* ]]; then
            CLASS_MAPPED="WEB-INF/classes/\${class_path#src/}"
        else
            CLASS_MAPPED="\${class_path}"
        fi
    else
        # src/foo/Bar.java → bin/foo/Bar.class
        if [[ "\${file_path}" == src/* ]]; then
            CLASS_MAPPED="bin/\${class_path#src/}"
        else
            CLASS_MAPPED="\${class_path}"
        fi
    fi
}

# ---------- 参数默认值 ----------
PROJECT_NAME=""
REVISIONS=""
PROJECT_PATH=""
OUTPUT_DIR=""
SVN_URL=""
CMD="auto-pack"
STRICT="false"
WORKERS=4
JAVA_HOME="\${JAVA_HOME:-}"

while [[ $# -gt 0 ]]; do
    case "$1" in
        -n|--name)        PROJECT_NAME="$2"; shift 2 ;;
        -r|--revisions)   REVISIONS="$2"; shift 2 ;;
        -l|--local-path)  PROJECT_PATH="$(to_posix_path "$2")"; shift 2 ;;
        -o|--output)      OUTPUT_DIR="$(to_posix_path "$2")"; shift 2 ;;
        -s|--svn-url)     SVN_URL="$2"; shift 2 ;;
        --cmd)            CMD="$2"; shift 2 ;;
        --strict)         STRICT="true"; shift ;;
        --workers)        WORKERS="$2"; shift 2 ;;
        -j|--java-home)   JAVA_HOME="$(to_posix_path "$2")"; shift 2 ;;
        -h|--help)
            cat << EOF
用法: bash verify-package.sh [options]
必填: -n 项目名 -r 版本号 -l 项目路径(SVN工作副本) -o 产出目录
可选: --cmd auto-pack|pack  --strict(严格模式：多余文件也算FAIL)
      --workers N(并行数，默认4；1=串行，同时控制svn diff并发与核对分块)
      -j/--java-home <path> JDK路径(可选，默认环境JAVA_HOME；用于ECJ字节码抽检)
说明：以 svn diff --summarize 变更清单为基准核对产出。
EOF
            exit 2
            ;;
        *) info "未知参数: $1"; exit 2 ;;
    esac
done

# 并行数合法性校验
if ! [[ "\${WORKERS}" =~ ^[1-9][0-9]*$ ]]; then
    info "--workers 必须为正整数，当前值: \${WORKERS}"
    exit 2
fi

# ---------- 基本参数校验 ----------
ERR=0
[[ -z "\${PROJECT_NAME}" ]] && { info "缺少 -n/--name"; ERR=1; }
[[ -z "\${PROJECT_PATH}" ]] && { info "缺少 -l/--local-path"; ERR=1; }
[[ -z "\${REVISIONS}" ]] && { info "缺少 -r/--revisions"; ERR=1; }
[[ -z "\${OUTPUT_DIR}" ]] && { info "缺少 -o/--output"; ERR=1; }
if [[ \${ERR} -eq 1 ]]; then exit 2; fi

# auto-pack 模式需 SVN 工作副本；pack 模式需 SVN_URL
if [[ "\${CMD}" == "auto-pack" && ! -d "\${PROJECT_PATH}/.svn" ]]; then
    info "auto-pack 模式要求 \${PROJECT_PATH} 为 SVN 工作副本（缺 .svn）"; exit 2
fi
if [[ "\${CMD}" == "pack" && -z "\${SVN_URL}" ]]; then
    info "pack 模式需 -s/--svn-url"; exit 2
fi

# 产出目录必须存在（打包后才有东西可校验）
# 注意：auto-package.sh 实际产出在 OUTPUT_DIR/PROJECT_NAME/ 下
FINAL_OUTPUT="\${OUTPUT_DIR}/\${PROJECT_NAME}"
if [[ ! -d "\${FINAL_OUTPUT}" ]]; then
    info "产出目录不存在: \${FINAL_OUTPUT}"
    info "请先执行 auto-package.sh 完成打包，再运行校验"
    exit 2
fi

echo "========================================"
echo "  打包一致性校验报告"
echo "========================================"
info "项目名称: \${PROJECT_NAME}"
info "版本号:   \${REVISIONS}"
info "项目路径: \${PROJECT_PATH}"
info "产出目录: \${FINAL_OUTPUT}"
info "校验模式: \${CMD}（基准=SVN变更清单）"
info "并行数:   \${WORKERS}（SVN diff 并发收集 + 核对分块）"
echo "----------------------------------------"

# ---------- 项目类型识别（与 auto-package.sh detect_project_type 一致）----------
PROJECT_TYPE=""
if [[ -d "\${PROJECT_PATH}/WebRoot" ]]; then
    PROJECT_TYPE="web"
elif [[ -d "\${PROJECT_PATH}/bin" && -d "\${PROJECT_PATH}/lib" ]]; then
    PROJECT_TYPE="server"
fi

if [[ -z "\${PROJECT_TYPE}" ]]; then
    info "无法识别项目类型（缺 WebRoot/ 或 bin/+lib/），按 Server 口径映射"
    PROJECT_TYPE="server"
fi
info "项目类型: \${PROJECT_TYPE}"

# 源项目编译输出目录（内部类验证基准）
# javac 单次编译必然同时产出主类与全部内部类（Bar$*.class），
# 因此本地编译输出目录即该类应有的完整 class 清单
if [[ "\${PROJECT_TYPE}" == "web" ]]; then
    SRC_CLASSES_DIR="\${PROJECT_PATH}/WebRoot/WEB-INF/classes"
    PROD_CLASS_PREFIX="WEB-INF/classes"
else
    SRC_CLASSES_DIR="\${PROJECT_PATH}/bin"
    PROD_CLASS_PREFIX="bin"
fi
info "内部类基准: \${SRC_CLASSES_DIR}"
echo "----------------------------------------"

# ============================================================
# 收集 SVN 变更清单（基准）—— 按版本并行
# 复用 auto-package.sh collect_changed_files 的核心逻辑：
#   按版本升序，svn diff --summarize -r base:rev，过滤 IDE 配置
# 性能优化：各版本 diff 后台并行执行（并发数 = WORKERS，分批 wait），
#   结果落 diff_<rev>.txt，全部完成后按版本升序合并（保证去重语义不变），
#   IDE 过滤改为合并后一次性完成（每版本 2 次 grep -> 全局 2 次）
# ============================================================
info "并行收集 SVN 变更清单（并发 \${WORKERS}）..."

# 切换到项目目录执行 svn 命令
ORIG_DIR="$(pwd)"
cd "\${PROJECT_PATH}" 2>/dev/null || { info "无法进入项目目录: \${PROJECT_PATH}"; exit 2; }

# 解析版本号列表（升序）
IFS=',' read -ra REV_LIST <<< "\${REVISIONS}"
SORTED_REVS=$(printf "%s\\n" "\${REV_LIST[@]}" | sort -n)

# 临时文件存放合并后的变更清单（去重，保留最新版本状态）
TMP_DIR="\${FINAL_OUTPUT}/.verify-tmp"
mkdir -p "\${TMP_DIR}"
RAW_FILE="\${TMP_DIR}/raw_changes.txt"
MERGED_FILE="\${TMP_DIR}/merged_changes.txt"
> "\${RAW_FILE}"

DIFF_START=\${SECONDS}

# 并行收集：每个版本一个后台子壳，输出到独立文件（无竞争）
diff_batch=0
for rev in \${SORTED_REVS}; do
    (
        base_rev=$((rev - 1))
        out=$(LANG=C LC_ALL=C svn diff --summarize -r "\${base_rev}:\${rev}" --non-interactive . 2>/dev/null)
        if [[ -z "\${out}" ]]; then
            # diff 失败时回退到 svn log
            out=$(LANG=C LC_ALL=C svn log -v -r "\${rev}" --non-interactive . 2>/dev/null)
            out=$(printf '%s\\n' "\${out}" | grep -E '^[[:space:]]+[MARD][[:space:]]+' | \\
                sed -E 's/^[[:space:]]+([MARD])[[:space:]]+/\\1 /' | \\
                sed "s|^[MARD] /\${PROJECT_NAME}/||" || true)
        fi
        printf '%s\\n' "\${out}" > "\${TMP_DIR}/diff_\${rev}.txt"
    ) &
    diff_batch=$((diff_batch + 1))
    # 分批等待：每 WORKERS 个一批，控制并发数
    if (( diff_batch % WORKERS == 0 )); then
        wait
    fi
done
wait

# 按版本升序合并（后出现的记录覆盖先出现的，去重语义依赖此顺序）
for rev in \${SORTED_REVS}; do
    [[ -f "\${TMP_DIR}/diff_\${rev}.txt" ]] && cat "\${TMP_DIR}/diff_\${rev}.txt" >> "\${RAW_FILE}"
done
# 统一过滤 IDE 配置文件（与 auto-package.sh 同口径，一次性完成）
if [[ -s "\${RAW_FILE}" ]]; then
    grep -vE '^\\s*[MARD]\\s+\\.(settings|classpath|project|git)/' "\${RAW_FILE}" | \\
        grep -vE '^\\s*[MARD]\\s+\\.(settings|classpath|project)$' > "\${RAW_FILE}.filtered" || true
    mv "\${RAW_FILE}.filtered" "\${RAW_FILE}"
fi
rm -f "\${TMP_DIR}"/diff_*.txt

cd "\${ORIG_DIR}"

info "SVN 清单收集完成，耗时 $((SECONDS - DIFF_START)) 秒"

# 去重：同一文件路径保留最后出现的记录（最新版本状态）
# 用于 A/M/D 判定 —— 若先 A 后 D，最终状态是 D；若先 D 后 A，最终状态是 A
awk '{
    path = $2
    # 路径中的反斜杠统一成正斜杠，便于后续比对
    gsub(/\\\\/, "/", path)
    # 记录每个路径的最终状态（op）与原始行
    final[path] = $1
    order[path] = (order[path] ? order[path] "\\n" : "") $0
}
END {
    for (p in final) {
        print final[p] "\\t" p
    }
}' "\${RAW_FILE}" | sort > "\${MERGED_FILE}"

# 统计操作类型
CNT_A=0; CNT_M=0; CNT_D=0
while IFS=$'\\t' read -r op path; do
    case "\${op}" in
        A) CNT_A=$((CNT_A+1)) ;;
        M) CNT_M=$((CNT_M+1)) ;;
        D) CNT_D=$((CNT_D+1)) ;;
    esac
done < "\${MERGED_FILE}"

TOTAL_CHANGES=$((CNT_A + CNT_M + CNT_D))
info "变更清单统计: 文件数 \${TOTAL_CHANGES}（A:\${CNT_A} M:\${CNT_M} D:\${CNT_D}）"
echo "----------------------------------------"

if [[ \${TOTAL_CHANGES} -eq 0 ]]; then
    info "变更清单为空，无文件需要校验"
    echo "========================================"
    echo "  一致性: PASS（空变更）"
    echo "========================================"
    rm -rf "\${TMP_DIR}"
    exit 0
fi

# ============================================================
# 逐项核对产出 —— 分块并行
# 路径映射规则（对齐 auto-package.sh）：
#   Web 项目 run_web_build（行421-427）：
#     src/X.java     → WEB-INF/classes/X（编译，.java→.class）
#     src/conf/X.xml → WEB-INF/classes/conf/X.xml
#     WebRoot/X      → X（剥离 WebRoot/ 前缀）
#     其他前缀       → 保持原样
#   Server 项目 run_server_build（行486-490）：
#     src/X          → bin/X（src→bin 前缀替换；.java 编译为 .class）
#     其他前缀       → 保持原样
# 性能优化（消除 Git Bash/MSYS2 下昂贵的 fork）：
#   1. 内部类基准批量预收集：1 次 find 扫源项目编译输出全部 *$*.class，
#      构建关联数组 INNER_MAP[主类key]=内部类列表，循环内内存查表
#      （替代每个 .java 一次 find+sort，消除数百次 fork）
#   2. dirname/basename 改纯 bash 参数展开（\${var%/*}、\${var##*/}）
#   3. 变更清单 split 均分为 WORKERS 块，每块一个后台 worker 并行核对，
#      各写独立报告/期望清单/计数器文件，wait 后按块序合并
# ============================================================
info "逐项核对产出文件（\${WORKERS} 个并行 worker）..."

CHECK_START=\${SECONDS}

# 先收集产出目录的全部文件清单（用于"多余文件"检测）
# 排除 readme.txt、filelist.txt（auto-package.sh 自动生成的辅助文件）
PRODUCED_FILE="\${TMP_DIR}/produced_files.txt"
find "\${FINAL_OUTPUT}" -type f \\
    -not -name "readme.txt" \\
    -not -name "filelist.txt" \\
    -not -path "\${TMP_DIR}/*" \\
    2>/dev/null | sed "s|\${FINAL_OUTPUT}/||" | sort > "\${PRODUCED_FILE}"
PRODUCED_CNT=$(wc -l < "\${PRODUCED_FILE}")
info "产出文件数: \${PRODUCED_CNT}"

# ---------- 内部类基准批量预收集（源项目编译输出，1 次 find） ----------
# 按主类 key（去掉第一个 $ 起后缀的相对路径）分组：
#   cn/foo/Bar$1.class、cn/foo/Bar$Inner.class、cn/foo/Bar$1$In.class → key=cn/foo/Bar
# 基准目录不存在时清单为空，内部类校验自然全部跳过（与逐目录 find 行为一致）
INNER_BASE_FILE="\${TMP_DIR}/inner_base.txt"
( cd "\${SRC_CLASSES_DIR}" 2>/dev/null && find . -type f -name "*\\$*.class" -printf '%P\\n' 2>/dev/null ) > "\${INNER_BASE_FILE}"
declare -A INNER_MAP=()
while IFS= read -r inner_rel; do
    [[ -z "\${inner_rel}" ]] && continue
    INNER_MAP["\${inner_rel%%\\$*}"]+="\${inner_rel}"$'\\n'
done < "\${INNER_BASE_FILE}"
info "内部类基准: \${#INNER_MAP[@]} 个主类含内部类"

# ---------- 产出内部类索引（D 操作残留检测用，查表 0 fork） ----------
# key 与 INNER_MAP 一致：去掉产出前缀和 $ 后缀（如 cn/foo/Bar），value 保留产出相对路径
declare -A PROD_INNER_MAP=()
while IFS= read -r prod_rel; do
    [[ -z "\${prod_rel}" ]] && continue
    [[ "\${prod_rel}" == *\\$*.class ]] || continue
    prod_key="\${prod_rel#\${PROD_CLASS_PREFIX}/}"
    PROD_INNER_MAP["\${prod_key%%\\$*}"]+="\${prod_rel}"$'\\n'
done < "\${PRODUCED_FILE}"

# 期望产出清单（worker 各写分片，合并后用于多余文件检测）
EXPECTED_FILE="\${TMP_DIR}/expected_files.txt"
> "\${EXPECTED_FILE}"

# ---------- 单块核对函数（worker：主进程后台并行调用） ----------
# 入参：$1 = 分块文件（op\\tpath 行）
# 输出：stdout → 分块报告；<chunk>.expected → 期望清单分片；<chunk>.counts → 计数器
# worker 是主 shell 的子壳副本，函数/变量/关联数组快照继承，
# 计数器与期望清单通过文件传回主进程合并
verify_chunk() {
    local chunk_file="$1"
    EXPECTED_FILE="\${chunk_file}.expected"
    > "\${EXPECTED_FILE}"

    while IFS=$'\\t' read -r op path; do
        [[ -z "\${path}" ]] && continue

        # 跳过目录变更条目：SVN diff --summarize 在新增/删除文件时会
        # 额外列出其所在目录本身（如 "A src/.../service"，无文件扩展名）。
        # auto-package.sh 处理时对目录走 cp 跳过（[[ ! -f src_file ]]），
        # 此处对齐：无扩展名的路径视为目录，跳过，避免误报缺失。
        if [[ "\${path}" != *.* ]]; then
            info "  跳过目录变更: \${path}"
            continue
        fi

        if [[ "\${op}" == "D" ]]; then
            # 删除操作：产出不应包含该文件
            map_path "\${path}" "\${PROJECT_TYPE}"
            if [[ -n "\${MAPPED}" ]]; then
                if [[ "\${path}" == *.java ]]; then
                    map_java_to_class "\${path}" "\${PROJECT_TYPE}"
                    if [[ -n "\${CLASS_MAPPED}" ]]; then
                        # 主类残留
                        if [[ -f "\${FINAL_OUTPUT}/\${CLASS_MAPPED}" ]]; then
                            notdel "\${path} → 已删除但产出仍含 \${CLASS_MAPPED}"
                        fi
                        # 内部类残留（查产出内部类索引）
                        inner_key="\${CLASS_MAPPED#\${PROD_CLASS_PREFIX}/}"
                        inner_key="\${inner_key%.class}"
                        while IFS= read -r leftover; do
                            [[ -z "\${leftover}" ]] && continue
                            notdel "\${path} → 已删除但产出仍含 \${leftover}"
                        done <<< "\${PROD_INNER_MAP[\${inner_key}]-}"
                    fi
                elif [[ -f "\${FINAL_OUTPUT}/\${MAPPED}" ]]; then
                    notdel "\${path} → 已删除但产出仍含 \${MAPPED}"
                fi
            fi
            continue
        fi

        # A / M 操作：产出应有对应文件
        if [[ "\${path}" == *.java ]]; then
            # Java 文件 → 编译为 .class
            # 主类 Bar.class 必须存在；内部类 Bar$*.class 以源项目编译输出为基准逐一核对
            map_java_to_class "\${path}" "\${PROJECT_TYPE}"
            if [[ -z "\${CLASS_MAPPED}" ]]; then
                miss "\${path} → 无法映射 class 路径（项目类型未知）"
                continue
            fi

            # 主类产物必须存在（javac 编译 .java 必产顶层类 .class）
            if [[ ! -f "\${FINAL_OUTPUT}/\${CLASS_MAPPED}" ]]; then
                nocompile "\${path} → 未找到 \${CLASS_MAPPED}（编译可能失败或该类未被编译）"
                continue
            fi
            ok "\${path} → \${CLASS_MAPPED}"
            MATCH_CNT=$((MATCH_CNT+1))
            # 记录期望产出：主类（用于多余文件检测）
            echo "\${CLASS_MAPPED}" >> "\${EXPECTED_FILE}"

            # ---------- 内部类验证（查 INNER_MAP，0 fork） ----------
            # key = 产出 class 路径去掉前缀和 .class 后缀（如 cn/foo/Bar）
            inner_key="\${CLASS_MAPPED#\${PROD_CLASS_PREFIX}/}"
            inner_key="\${inner_key%.class}"
            inner_list="\${INNER_MAP[\${inner_key}]-}"
            if [[ -n "\${inner_list}" ]]; then
                while IFS= read -r inner_rel; do
                    [[ -z "\${inner_rel}" ]] && continue
                    inner_prod="\${PROD_CLASS_PREFIX}/\${inner_rel}"
                    if [[ -f "\${FINAL_OUTPUT}/\${inner_prod}" ]]; then
                        ok "\${path} → \${inner_prod}（内部类）"
                        # 记录期望产出：内部类（避免 strict 模式误报多余）
                        echo "\${inner_prod}" >> "\${EXPECTED_FILE}"
                    else
                        innermiss "\${path} → 内部类缺失: \${inner_prod}（基准: \${SRC_CLASSES_DIR}/\${inner_rel}）"
                    fi
                done <<< "\${inner_list}"
            fi
        else
            # 非 Java 资源文件 → 直接路径映射
            map_path "\${path}" "\${PROJECT_TYPE}"
            if [[ -z "\${MAPPED}" ]]; then
                miss "\${path} → 无法映射路径（项目类型未知）"
                continue
            fi
            if [[ -f "\${FINAL_OUTPUT}/\${MAPPED}" ]]; then
                ok "\${path} → \${MAPPED}"
                MATCH_CNT=$((MATCH_CNT+1))
                echo "\${MAPPED}" >> "\${EXPECTED_FILE}"
            else
                miss "\${path} → 期望 \${MAPPED}，未找到"
            fi
        fi
    done < "\${chunk_file}"

    # 计数器落盘（主进程汇总）：匹配 缺失 多余 应删未删 编译缺失 内部类缺失
    printf '%d %d %d %d %d %d\\n' \\
        "\${MATCH_CNT}" "\${MISS_CNT}" "\${EXTRA_CNT}" "\${NOTDEL_CNT}" "\${NOCOMPILE_CNT}" "\${INNER_MISS_CNT}" \\
        > "\${chunk_file}.counts"
}

# ---------- 分块并行核对 ----------
# split -n l/N：按行均分为 N 块不切断记录，生成 chunk_aa/chunk_ab/...（有序）
split -n "l/\${WORKERS}" "\${MERGED_FILE}" "\${TMP_DIR}/chunk_"

for chunk_file in "\${TMP_DIR}"/chunk_??; do
    [[ -f "\${chunk_file}" ]] || continue
    verify_chunk "\${chunk_file}" > "\${chunk_file}.report" 2>&1 &
done
wait

# ---------- 合并：按块序拼接报告与期望清单，汇总计数器 ----------
for report_file in "\${TMP_DIR}"/chunk_*.report; do
    [[ -f "\${report_file}" ]] || continue
    cat "\${report_file}"
    chunk_base="\${report_file%.report}"
    [[ -f "\${chunk_base}.expected" ]] && cat "\${chunk_base}.expected" >> "\${EXPECTED_FILE}"
done

MATCH_CNT=0; MISS_CNT=0; EXTRA_CNT=0; NOTDEL_CNT=0; NOCOMPILE_CNT=0; INNER_MISS_CNT=0
ALL_COUNTS="\${TMP_DIR}/all_counts.txt"
cat "\${TMP_DIR}"/chunk_*.counts > "\${ALL_COUNTS}" 2>/dev/null || > "\${ALL_COUNTS}"
while read -r c_match c_miss c_extra c_notdel c_nocompile c_innermiss; do
    [[ -z "\${c_match}" ]] && continue
    MATCH_CNT=$((MATCH_CNT + c_match))
    MISS_CNT=$((MISS_CNT + c_miss))
    EXTRA_CNT=$((EXTRA_CNT + c_extra))
    NOTDEL_CNT=$((NOTDEL_CNT + c_notdel))
    NOCOMPILE_CNT=$((NOCOMPILE_CNT + c_nocompile))
    INNER_MISS_CNT=$((INNER_MISS_CNT + c_innermiss))
done < "\${ALL_COUNTS}"
rm -f "\${TMP_DIR}"/chunk_*

info "核对完成，耗时 $((SECONDS - CHECK_START)) 秒"
echo "----------------------------------------"

# ============================================================
# 多余文件检测：产出中有但变更清单中没有的文件
# 仅在 strict 模式下报 FAIL；非 strict 模式仅 INFO 提示
# ============================================================
if [[ "\${STRICT}" == "true" ]]; then
    info "严格模式：检测多余文件..."
    # comm 一次差集替代逐文件 grep（产出清单已排序；期望清单 sort -u 去重）
    # comm -23 = 仅在产出清单中出现（即期望之外的多余文件）
    comm -23 "\${PRODUCED_FILE}" <(sort -u "\${EXPECTED_FILE}") > "\${TMP_DIR}/extras.txt" 2>/dev/null || > "\${TMP_DIR}/extras.txt"
    while IFS= read -r extra_file; do
        [[ -z "\${extra_file}" ]] && continue
        extra "\${extra_file}（变更清单中无此文件）"
    done < "\${TMP_DIR}/extras.txt"
    echo "----------------------------------------"
fi

# ============================================================
# 目录结构校验
# ============================================================
info "目录结构校验..."
if [[ "\${PROJECT_TYPE}" == "web" ]]; then
    if [[ -d "\${FINAL_OUTPUT}/WEB-INF/classes" ]]; then
        ok "Web 项目产出含 WEB-INF/classes/"
    else
        miss "Web 项目产出缺 WEB-INF/classes/ 目录"
    fi
elif [[ "\${PROJECT_TYPE}" == "server" ]]; then
    [[ -d "\${FINAL_OUTPUT}/bin" ]] && ok "Server 项目产出含 bin/" || miss "Server 项目产出缺 bin/ 目录"
    # lib/ 和 run/ 仅在变更涉及 jar/脚本时才出现，不强校验
fi
echo "----------------------------------------"

# ============================================================
# ECJ 字节码抽检：产出 class vs IDE 产物（SRC_CLASSES_DIR）字节码一致性
# auto-package.sh 改用 ECJ 后，产物字节码应与 IDE（Eclipse）100% 一致。
# 用 javap -c -p 精确对比指令序列（去除地址/#索引/注释），diff=0 通过。
# 跳过条件：javap 不可用、源项目编译输出目录不存在（不报错，仅 INFO）
# ============================================================
clean_bytecode() {
    # $1=javap_bin  $2=class 文件
    "$1" -c -p "$2" 2>/dev/null | sed 's|//.*||; s|#[0-9]*||g' | awk '{$1=""; sub(/^ +/,""); print}'
}

check_bytecode_align() {
    local prod_classes="\${FINAL_OUTPUT}/\${PROD_CLASS_PREFIX}"
    [[ -d "\${prod_classes}" ]] || { info "字节码抽检跳过：产出无 \${PROD_CLASS_PREFIX}/ 目录"; return 0; }
    [[ -d "\${SRC_CLASSES_DIR}" ]] || { info "字节码抽检跳过：源项目编译输出目录不存在 \${SRC_CLASSES_DIR}"; return 0; }

    local javap_bin="\${JAVA_HOME}/bin/javap"
    [[ ! -f "\${javap_bin}" ]] && javap_bin="\${JAVA_HOME}/bin/javap.exe"
    if [[ ! -f "\${javap_bin}" ]]; then
        info "字节码抽检跳过：javap 不可用（用 -j/--java-home 指定 JDK，或设环境 JAVA_HOME）"
        return 0
    fi

    info "ECJ 字节码抽检：产出 vs IDE 产物（\${SRC_CLASSES_DIR}）"
    local prod_cls ide_cls rel d
    while IFS= read -r prod_cls; do
        rel="\${prod_cls#\${prod_classes}/}"
        ide_cls="\${SRC_CLASSES_DIR}/\${rel}"
        [[ -f "\${ide_cls}" ]] || continue  # IDE 无对应产物（新增类），跳过
        BYTECODE_CHECK_CNT=$((BYTECODE_CHECK_CNT+1))
        d=$(diff <(clean_bytecode "\${javap_bin}" "\${prod_cls}") <(clean_bytecode "\${javap_bin}" "\${ide_cls}") | grep -cE "^[<>]")
        if [[ \${d} -eq 0 ]]; then
            ok "字节码一致: \${rel}"
        else
            bytecode_diff "\${rel}（指令差异 \${d} 行）"
        fi
    done < <(find "\${prod_classes}" -name "*.class" 2>/dev/null)
    info "字节码抽检完成：\${BYTECODE_CHECK_CNT} 个类比对，\${BYTECODE_DIFF_CNT} 个差异"
    echo "----------------------------------------"
}

check_bytecode_align

# ============================================================
# 汇总
# ============================================================
TOTAL_ISSUES=$((MISS_CNT + EXTRA_CNT + NOTDEL_CNT + NOCOMPILE_CNT + INNER_MISS_CNT + BYTECODE_DIFF_CNT))
SCORE_BASE=$((CNT_A + CNT_M))
SCORE_BASE=\${SCORE_BASE:-0}
if [[ \${SCORE_BASE} -gt 0 ]]; then
    SCORE_PCT=$(awk "BEGIN { printf \\"%.1f\\", (\${MATCH_CNT} / \${SCORE_BASE}) * 100 }")
else
    SCORE_PCT="100.0"
fi

echo "========================================"
echo "  一致性校验汇总"
echo "========================================"
echo "  变更文件数:   \${TOTAL_CHANGES}（A:\${CNT_A} M:\${CNT_M} D:\${CNT_D}）"
echo "  产出文件数:   \${PRODUCED_CNT}"
echo "  匹配成功:     \${MATCH_CNT}"
echo "  缺失文件:     \${MISS_CNT}"
echo "  编译缺失:     \${NOCOMPILE_CNT}"
echo "  内部类缺失:   \${INNER_MISS_CNT}"
echo "  应删未删:     \${NOTDEL_CNT}"
echo "  多余文件:     \${EXTRA_CNT}"
echo "  字节码差异:   \${BYTECODE_DIFF_CNT}（抽检 \${BYTECODE_CHECK_CNT} 个类）"
echo "----------------------------------------"
echo "  一致性评分:   \${MATCH_CNT}/\${SCORE_BASE} (\${SCORE_PCT}%)"
echo "========================================"

if [[ \${TOTAL_ISSUES} -gt 0 ]]; then
    printf '%b结论: FAIL - 发现 %d 个问题（缺失%d / 编译缺失%d / 内部类缺失%d / 应删未删%d / 多余%d / 字节码差异%d）%b\\n' \\
        "\${RED}" "\${TOTAL_ISSUES}" "\${MISS_CNT}" "\${NOCOMPILE_CNT}" "\${INNER_MISS_CNT}" "\${NOTDEL_CNT}" "\${EXTRA_CNT}" "\${BYTECODE_DIFF_CNT}" "\${NC}"
    rm -rf "\${TMP_DIR}"
    exit 1
else
    printf '%b结论: PASS - 产出与变更清单一致%b\\n' "\${GREEN}" "\${NC}"
    rm -rf "\${TMP_DIR}"
    exit 0
fi
`;

const BUILD_CONFIG_SPEC = `# build.xml 配置规范与项目类型判定矩阵

本文档说明 \`E:\\WorkSpaces_ahdx\\\` 下各项目的 \`build.xml\` 配置约定，以及 \`auto-package.sh\` 如何判定项目类型。预检脚本 \`pre-package-check.sh\` 依据此规范校验配置一致性。

## 项目类型判定（与 auto-package.sh detect_project_type 一致）

\`auto-package.sh\` 用目录存在性判定项目类型，**不读 build.xml 的 project name**：

| 判定条件 | 项目类型 | 典型项目 |
|---|---|---|
| 存在 \`WebRoot/\` 目录 | \`web\` | Venus4A、Venus4A_telecom、Venus4A_F1 |
| 存在 \`bin/\` + \`lib/\` 目录（且无 \`WebRoot/\`） | \`server\` | AccountManager、AuthServer、AnalysisServer、EventServer_HB、ComponentMonitorServer |
| 都不满足 | \`unknown\`（打包会异常） | — |

判定优先级：先看 \`WebRoot/\`，再看 \`bin/+lib/\`。所以 Venus4A 即使有 \`bin/\`（实际没有），也会被判定为 web。

## Web 项目 build.xml 规范

### 典型结构（以 Venus4A 为例）

\`\`\`xml
<project name="Venus4A Web Application" default="war" basedir=".">
    <property name="project" location="." />
    <property name="WebRoot" location="WebRoot" />
    <target name="war" description="copy files">
        <war warfile="WebRoot.war" webxml="\${WebRoot}/WEB-INF/web.xml">
            <fileset dir="\${WebRoot}"></fileset>
        </war>
    </target>
    <target name="zip" description="create zip file">
        <zip destfile="WebRoot.zip" basedir="\${WebRoot}"/>
    </target>
    <!-- tar / gzip / update / mqzip / all 等 -->
</project>
\`\`\`

### 预检校验点

| 校验项 | 通过条件 | 不通过处理 |
|---|---|---|
| build.xml 存在 | 项目根有 \`build.xml\` | WARN（auto-package.sh 不依赖它，但全量打包缺） |
| 引用 WebRoot | \`grep WebRoot\` 命中 | WARN（可能与 Web 结构不匹配） |
| 含 Web target | 含 \`war\`/\`zip\`/\`tar\`/\`update\` 任一 target | WARN（可能自定义结构） |
| build.increment.xml 占位符 | 无 \`\${UPDATE-PART}\`/\`\${DELETE-PART}\` | WARN（直接 ant 执行会失败） |

### build.increment.xml（增量构建模板）

仅 Venus4A 系列使用。这是一个**带占位符的 Ant 模板**，不能直接执行：

\`\`\`xml
<target name="copy" depends="compile">
    <delete includeEmptyDirs="true">
        \${DELETE-PART}    <!-- 占位符，需 svnpackage.jar 填充具体 fileset -->
    </delete>
    <copy todir="\${package}">
        <fileset dir="\${target}">
            \${UPDATE-PART}    <!-- 占位符 -->
        </fileset>
    </copy>
</target>
\`\`\`

**填充方式**：用 \`svnpackage.jar\`（\`E:\\devtools\\svnpackage-20251217\\svnpackage\\svnpackage.jar\`）根据版本号生成具体的 \`build.<rev>.xml\`，再 \`ant -f build.<rev>.xml\` 执行。

**与 auto-package.sh 的关系**：这是**另一条打包路线**，与 \`auto-package.sh\` 的 javac 增量编译路线二选一：
- \`auto-package.sh\` 路线：直接 javac 编译变更文件，不碰 build.xml
- svnpackage.jar + Ant 路线：填充模板 → ant 执行

本技能主要服务 \`auto-package.sh\` 路线。占位符未填充只是 WARN（不阻塞 auto-package.sh），因为走 auto-package.sh 不需要填充它。

## Server 项目 build.xml 规范

### 典型结构（以 AccountManager 为例）

\`\`\`xml
<project name="Venus4A Account Server" default="copy" basedir=".">
    <property name="project" location="." />
    <property name="build" location="AccountServer" />
    <property name="bin" location="bin" />
    <property name="lib" location="lib" />
    <property name="run" location="run" />
    <target name="init" depends="clean">
        <mkdir dir="\${build}" />
        <mkdir dir="\${build}/bin" />
        <mkdir dir="\${build}/lib" />
        <mkdir dir="\${build}/log" />
        <mkdir dir="\${build}/log/accountserver" />
    </target>
    <target name="copy" depends="init" description="copy files">
        <copy todir="\${build}/bin"><fileset dir="\${bin}"/></copy>
        <copy todir="\${build}/lib"><fileset dir="\${lib}"/></copy>
        <copy todir="\${build}"><fileset dir="\${run}"/></copy>
    </target>
    <!-- tar / zip / gzip / update / all -->
</project>
\`\`\`

### 预检校验点

| 校验项 | 通过条件 | 不通过处理 |
|---|---|---|
| build.xml 存在 | 项目根有 \`build.xml\` | WARN |
| 含 bin/lib/run property | 三个 property 都命中 | WARN（缺哪个提示哪个） |
| 物理目录存在 | \`bin/\`、\`lib/\`、\`run/\` 目录都存在 | FAIL（build.xml 引用但目录不存在，结构损坏） |
| 含 Server target | 含 \`copy\`/\`init\`/\`tar\`/\`zip\`/\`update\` 任一 | — |

### Server 项目差异点

各 Server 项目的 \`build.xml\` 几乎同构，差异只在：
- \`project name\`（如 "Venus4A Account Server"、"Venus4A Auth Server"）
- \`build\` property 的目录名（如 \`AccountServer\`、\`AuthServer\`、\`AnalysisServer\`）
- \`log\` 子目录名（如 \`log/accountserver\`、\`log/authserver\`、\`log/analysisserver\`、\`log/policyengine\`）

这些差异不影响 \`auto-package.sh\` 打包（脚本用 \`bin/lib/run\` 三个固定目录名，不读 \`build\` property），所以预检不强制校验这些差异。

## 各项目实际配置一览

| 项目 | 类型 | build.xml project name | 关键 property | 特殊点 |
|---|---|---|---|---|
| Venus4A | web | Venus4A Web Application | WebRoot | 有 build.increment.xml（占位符模板） |
| Venus4A_telecom | web | （同构） | WebRoot | — |
| Venus4A_F1 | web | （同构） | WebRoot | — |
| AccountManager | server | Venus4A Account Server | bin/lib/run | log/accountserver |
| AccountManager_telecom | server | （同构） | bin/lib/run | — |
| AuthServer | server | Venus4A Auth Server | bin/lib/run | 含 src_mysql/ 目录 |
| AnalysisServer | server | Venus4A Analysis Server | bin/lib/run | log/policyengine |
| EventServer_HB | server | Venus4A Event Server | bin/lib/run | log/eventserver |
| ComponentMonitorServer | server | Venus4A ComponentMonitorServer | bin/lib/run | log/authserver（注意命名） |
| ComponentMonitorServer_t1 | server | （同构） | bin/lib/run | — |
| ComponentMonitorServer_telecom | server | （同构） | bin/lib/run | bin/ 下有子 build.xml |

## 项目类型的实际影响

项目类型决定了 \`auto-package.sh\` 的**产出目录结构**和**路径映射规则**，这也是 \`verify-package.sh\` 校验的依据：

| 项目类型 | 产出根目录 | Java 编译目标 | 资源文件映射 |
|---|---|---|---|
| web | \`<output>/<name>/\` | \`WEB-INF/classes/\` | \`src/x\` → \`WEB-INF/classes/x\`；\`WebRoot/x\` → \`x\` |
| server | \`<output>/<name>/\` | \`bin/\` | \`src/x\` → \`bin/x\`；\`lib/\`、\`run/\` 原样 |

两类型都会生成：
- \`readme.txt\` — 版本变更说明（含 SVN 提交作者/日期/说明）
- Server 项目额外有 \`filelist.txt\`（变更文件清单）
`;

const ERROR_CODES = `# 错误码与诊断手册

本文档是打包全流程的故障诊断速查表。当 \`pre-package-check.sh\`、\`auto-package.sh\`、\`verify-package.sh\` 任一环节报错时，按本文档对照定位根因。

## 退出码总览

### pre-package-check.sh
| 退出码 | 含义 | 是否可继续打包 |
|---|---|---|
| 0 | 全部通过（PASS）或仅有警告（WARN） | 可继续 |
| 1 | 存在 FAIL（参数/路径/配置/工具链/版本号错误） | 不可继续，先修复 |
| 2 | 脚本参数错误（未知参数/缺必填） | 不可继续 |

### verify-package.sh
| 退出码 | 含义 | 说明 |
|---|---|---|
| 0 | 一致性 PASS | 产出与变更清单完全一致 |
| 1 | 一致性 FAIL | 有缺失/编译缺失/应删未删/多余（strict） |
| 2 | 无法校验 | 产出目录不存在/SVN 不可用/参数缺失 |

## 预检阶段（pre-package-check.sh）错误

### 参数类

**FAIL: 缺少 -n/--name (项目名称) / -l/-r/-o**
- 根因：必填参数没传
- 处理：补齐参数。四个必填：\`-n\` 项目名、\`-r\` 版本号、\`-l\` 项目路径、\`-o\` 输出目录

**FAIL: 版本号格式错误: 'xxx'**
- 根因：版本号不是逗号分隔的纯数字
- 处理：改为 \`64561,64562\` 格式，不要带空格、字母、\`r\` 前缀

**FAIL: pack 模式缺少 -s/--svn-url**
- 根因：pack 模式需直连 SVN 仓库，要仓库地址
- 处理：加 \`-s https://...\`，或改用 \`auto-pack\` 模式（需本地 \`.svn\` 工作副本）

### 路径类

**FAIL: 项目路径不存在: /e/WorkSpaces_ahdx/Xxx**
- 根因：路径写错或项目未检出
- 处理：确认路径；\`ls /e/WorkSpaces_ahdx/\` 看实际项目名

**FAIL: auto-pack 模式要求项目为 SVN 工作副本（缺少 .svn 目录）**
- 根因：该目录不是 SVN 工作副本（可能是手动复制的源码）
- 处理：用 \`svn checkout\` 重新检出，或改用 \`pack\` 模式直连仓库

**WARN: 输出目录的父目录不存在**
- 根因：\`-o\` 的父目录不存在
- 处理：\`auto-package.sh\` 会 \`mkdir -p\`，但若父级不可写仍会失败；确认权限

### 配置类

**WARN: build.xml 未引用 WebRoot**
- 根因：Web 项目的 build.xml 应引用 \`WebRoot\`，未引用可能配置漂移
- 处理：人工核对 build.xml 是否与项目结构匹配

**WARN: build.xml 缺少 property: bin/lib/run**
- 根因：Server 项目的 build.xml 应声明 bin/lib/run 三个 property
- 处理：核对 build.xml 是否被改动过

**FAIL: 项目缺少物理目录: bin/（build.xml 引用但实际不存在）**
- 根因：build.xml 引用了 \`bin/\` 但项目里没有，结构损坏
- 处理：检查项目是否完整检出，或 build.xml 是否来自别的项目

**WARN: build.increment.xml 含 \${UPDATE-PART}/\${DELETE-PART} 占位符未填充**
- 根因：Venus4A 的增量模板未填充，直接 \`ant -f build.increment.xml\` 会失败
- 处理：走 \`auto-package.sh\` 路线不需要填充（仅 WARN 不阻塞）；若要走 Ant 路线，用 \`svnpackage.jar\` 生成 \`build.<rev>.xml\`

### 工具链类

**FAIL: svn 命令不可用**
- 根因：SVN 客户端未装或未加入 PATH
- 处理：安装 TortoiseSVN 勾选"命令行工具"，或 \`export PATH="/c/Program Files/TortoiseSVN/bin:$PATH"\`

**FAIL: JAVA_HOME 下找不到 javac**
- 根因：\`-j\` 或 \`DEFAULT_JAVA_HOME\` 指向的目录不是 JDK（可能指向 JRE）
- 处理：确认路径指向 JDK（含 \`bin/javac.exe\`），不是 JRE（只有 \`java.exe\`）

**FAIL: 找不到 javac**
- 根因：没传 \`-j\`，PATH 里也没有 javac
- 处理：传 \`-j <JDK路径>\`，或在 \`auto-package.conf\` 设 \`DEFAULT_JAVA_HOME\`

**WARN: Ant 不可用**
- 根因：Ant 未装（auto-package.sh 不依赖 Ant，所以只 WARN）
- 处理：走 auto-package.sh 路线可忽略；走 Ant 模板路线需装 Ant 并传 \`-a\`

### 版本号类

**FAIL: 版本号 66591 超过 SVN 仓库 HEAD 66606**
- 根因：版本号大于仓库 HEAD，仓库中不存在该版本（版本号写错）
- 说明：2026-09 修正——上限从"本地工作副本根目录版本"改为**仓库 HEAD**（\`svn info -r HEAD\` 远程查询）。SVN 是 mixed-revision 模型，commit 只 bump 被提交文件的 revision，根目录 revision 停留在上次 update，旧口径会把用户自己刚提交的版本误判为超限
- 处理：\`svn log -l 5\` 核对近期版本号，修正 \`-r\` 参数

## 打包阶段（auto-package.sh）错误

### 编译类

**javac: 找不到符号 / 程序包 xxx 不存在**
- 根因：classpath 缺依赖 jar
- 处理：
  1. Web 项目：确认 \`WebRoot/WEB-INF/lib/\` 含所有依赖 jar
  2. Web 项目：确认 Tomcat 的 \`servlet-api.jar\`、\`jsp-api.jar\` 在 classpath（auto-package.sh 会自动找 \`E:/devtools/tomcat/*/lib\`）
  3. Server 项目：确认 \`lib/\` 含所有依赖
  4. 用 \`-v\` 看详细 classpath

**javac: 警告: 编码 UTF-8 的不可映射字符**
- 根因：源文件含非 UTF-8 字符（可能是 GBK 注释）
- 处理：\`auto-package.sh\` 已强制 \`-encoding UTF-8\`；若源文件本身是 GBK，需先转码或确认 IDE 编码设置

**编译失败，打包中止**
- 根因：javac 返回非 0，\`auto-package.sh\` 在 \`compile_java_files\` 失败后 \`exit 1\`
- 处理：看 \`javac_output.log\`（打包失败时会在产出目录附近留日志），定位具体编译错误

**Argument list too long**
- 根因：变更 Java 文件过多，命令行超 Windows 长度限制
- 处理：\`auto-package.sh\` 已用 argfile（\`@argfile\`）规避；若仍出现，确认 \`compile_java_files\` 函数生效（版本较新的脚本才有）

### SVN 类

**svn: E170001: Authentication required**
- 根因：SVN 需要认证但未传账号
- 处理：加 \`-u <用户名> -p <密码>\`，或在 \`auto-package.conf\` 设 \`DEFAULT_SVN_USER\`/\`DEFAULT_SVN_PASS\`

**svn: E160013: ... 不存在**
- 根因：版本号在仓库里不存在
- 处理：\`svn log -l 10 <项目路径>\` 看实际可用版本号

**SVN diff 失败 / 没有找到任何变更文件，打包中止**
- 根因：版本号区间无变更，或版本号写错
- 处理：\`svn log -r <版本号> -v <项目路径>\` 确认该版本确有变更；版本号区间是否搞反

### 输出类

**rm: 无法删除 ... 目录非空**
- 根因：\`auto-package.sh\` 清空旧输出目录时，有文件被占用
- 处理：关闭占用该目录的程序（IDE、资源管理器、Tomcat），重试

## 校验阶段（verify-package.sh）错误

### 无法校验类（退出码 2）

**产出目录不存在: /e/ProjectPackage/xxx/Venus4A**
- 根因：还没打包，或打包产出在别处
- 处理：先跑 \`auto-package.sh\` 打包；或确认 \`-o\` 指向正确的产出父目录（脚本会自动拼 \`/<项目名>/\`）

**auto-pack 模式要求 /xxx 为 SVN 工作副本（缺 .svn）**
- 根因：verify 也需要 SVN 工作副本来跑 \`svn diff\`
- 处理：用 SVN 检出的项目路径；或改用 \`--cmd pack -s <svn-url>\`

### 一致性差异类（退出码 1）

**[缺失] src/x/foo.java → 期望 WEB-INF/classes/x/foo.class，未找到**
- 根因：变更了 \`.java\` 但产出没有对应 \`.class\`
- 可能原因：
  1. 阶段二编译失败（但 auto-package.sh 会 exit 1，不会产出残包）
  2. 该类因依赖问题被 javac 跳过（javac 对单文件编译时，依赖不全不会编译出 class）
- 处理：单独 \`javac -cp <classpath> <该.java>\` 复现编译错误

**[缺失] WebRoot/x.jsp → 期望 x.jsp，未找到**
- 根因：JSP 变更了但没复制到产出
- 处理：回看阶段二是否报"复制资源"数量；确认 \`auto-package.sh\` 的 \`run_web_build\` 资源复制分支是否执行

**[编译缺失] src/x/foo.java → 未找到 foo.class**
- 同上 [缺失]，专门标注 Java 编译产物缺失（主类 \`.class\` 必须存在，旧版"任一存在即可"的宽松口径已收紧）

**[内部类缺失] src/x/foo.java → 内部类缺失: xxx/foo$1.class（基准: ...）**
- 根因：主类 \`foo.class\` 在产出中，但源项目本地编译输出目录（Web=\`WebRoot/WEB-INF/classes/\`，Server=\`bin/\`）中该主类的某内部类 \`foo$*.class\` 在产出中缺失
- 可能原因：
  1. 增量包在复制/传输过程中丢文件
  2. 手工清理增量包时误删
  3. 本地基准过期：源码已删该内部类，但本地编译输出还留着旧 class（重打包+全量编译后消除）
- 处理：重新打包再校验；复现则对照报告中的基准路径检查源项目编译产物

**[应删未删] src/x/foo.java 已删除但产出仍含 foo.class / foo$1.class**
- 根因：文件在某版本删除（D 操作），但产出仍有它（含内部类 \`foo$*.class\` 残留）
- 可能原因：
  1. 旧产出未清理（auto-package.sh 会 \`rm -rf\` 输出目录，若残留说明清理失败）
  2. 版本号区间选错，没包含到删除版本
  3. 该文件在更高版本又被重新添加（先 D 后 A，最终是 A，不应算应删未删——脚本已按"最终状态"判定）
- 处理：核对版本号区间；\`svn log -r <版本> -v <路径>\` 看该文件的操作历史

**[多余] xxx（变更清单中无此文件）**（仅 --strict）
- 根因：产出里有变更清单之外的文件
- 可能原因：
  1. 误打包了无关文件
  2. 旧产出残留（auto-package.sh 清理失败）
- 处理：核对文件是否确属误打包

### 内部类校验机制

一个 \`Foo.java\` 编译可能产出：
- \`Foo.class\`（主类）
- \`Foo$1.class\`（匿名内部类）
- \`Foo$Bar.class\`（命名内部类）

\`verify-package.sh\` 的策略（2026-09 优化后）：
- 主类 \`Foo.class\` 必须存在，缺失报 \`[编译缺失]\`
- 内部类以**源项目本地编译输出目录**中该主类的全部 \`Foo$*.class\` 为基准逐一核对，缺失报 \`[内部类缺失]\`；基准目录无该包或无内部类时跳过（该类无内部类，或本地未全量编译）
- 存在的内部类记入期望清单，strict 模式下不会被算成"多余"
- 基准目录在报告头部输出（\`内部类基准: <路径>\`），报缺失时同时给出基准文件路径，便于区分"增量包真缺"与"本地基准过期"

## 诊断辅助命令

\`\`\`bash
# 看本地 SVN 版本号
svn info --show-item revision /e/WorkSpaces_ahdx/Venus4A

# 看某版本的变更文件
svn diff --summarize -r 66524:66525 /e/WorkSpaces_ahdx/Venus4A

# 看某版本的提交信息
svn log -r 66525 -v /e/WorkSpaces_ahdx/Venus4A

# 单独编译某 Java 文件复现错误
javac -encoding UTF-8 -cp "<classpath>" /e/WorkSpaces_ahdx/Venus4A/src/foo/Bar.java

# 看 auto-package.sh 的中间产物（变更清单）
cat vendor/auto-package-svn/.openspec-tmp/apply-improve-auto-package-incremental-build/merged_files.txt
\`\`\`
`;

const COMMAND_CONTENT = `打包校验 —— 打包前预检 → 打包执行监控 → 打包后一致性校验 → 升级信息归集四阶段，每步确认后执行。

**输入**：\`/venus:release-package\` 后可跟项目名/版本号，或自然语言描述打包需求。

## 执行步骤

1. **阶段一预检**：\`bash <技能目录>/scripts/pre-package-check.sh\` 校验参数/路径/配置/工具链/版本号≤HEAD，FAIL 不打包。
2. **阶段二打包监控**：读 \`.venus/config.yaml\` 的 \`auto_package.runtime_dir\`（默认 \`vendor/auto-package-svn\`）→ \`bash <runtime_dir>/auto-package.sh -v\` 监控输出，失败暂停。
3. **阶段三一致性校验**：\`bash <技能目录>/scripts/verify-package.sh --strict\` 以 SVN 变更清单核对产出，FAIL 不进阶段四。
4. **阶段四升级信息归集**：读产出 \`readme.txt\` 反查 OpenSpec 提案 → 归集 SQL 四源 + 配置三源 → 输出 \`升级文档.md\` 到产出目录。反查失败静默降级。

## 必需参数（4 个，缺一不可）

项目名 \`-n\` / 版本号 \`-r\`（绝不猜测）/ 项目路径 \`-l\`（默认 \`E:\\WorkSpaces_ahdx\\<项目名>\` 推断确认）/ 输出目录 \`-o\`（默认 \`E:/ProjectPackage\` 并告知）。

## 约束

- 版本号绝不自行猜测，缺失追问
- 阶段二/三失败立即暂停，不继续
- 阶段四不阻断：提案反查失败仍输出升级文档（标注降级）
- 打包脚本本体在项目内 \`vendor/auto-package-svn/\`，路径可配置；校验脚本在技能 \`scripts/\` 下`;

export function getReleasePackageSkillTemplate(): SkillTemplate {
    return {
        name: 'venus_release_package',
        description: `项目打包质量校验与升级信息归集技能，覆盖"打包前预检→打包执行监控→打包后一致性校验→升级信息归集"四阶段闭环。基于 auto-package.sh 自动打包脚本（项目内 \`vendor/auto-package-svn/\`，路径可配置）与各项目 build.xml 配置，以 SVN 变更清单为基准校验产出一致性，并归集升级所需 SQL（四源）与配置参数（三源）输出 \`升级文档.md\`。适用 \`E:\\WorkSpaces_ahdx\` 下的 Web 项目（Venus4A 系列）和 Server 项目（AccountManager、AuthServer、AnalysisServer 等）。当用户要打包项目、检查打包结果、做打包一致性校验、归集升级 SQL/配置、生成升级文档、确认增量包是否打全、排查打包出错或文件对不上时使用。即使用户只说"打个包"，也应在打包完成后主动做一致性校验与升级信息归集，确保交付质量。`,
        allowedTools: 'Bash(bash:*), Bash(svn:*), Bash(javac:*), Bash(cat:*), Bash(ls:*), Read, Write, Edit, Glob, Grep',
        type: 'tr_release',
        instructions: INSTRUCTIONS,
        references: [
            { path: 'scripts/pre-package-check.sh', content: PRE_PACKAGE_CHECK },
            { path: 'scripts/verify-package.sh', content: VERIFY_PACKAGE },
            { path: 'references/build-config-spec.md', content: BUILD_CONFIG_SPEC },
            { path: 'references/error-codes.md', content: ERROR_CODES },
        ],
        license: 'MIT',
        compatibility: '需要 Git Bash、SVN 命令行、JDK 环境；auto-package 运行时默认项目内 vendor/auto-package-svn/（路径可配置）。',
        metadata: { author: 'venus-agent-tools', version: '1.0' },
    };
}

export function getReleasePackageCommandTemplate(): CommandTemplate {
    return {
        name: 'Venus: 打包校验',
        description: '打包校验 —— 预检→打包监控→一致性校验→升级信息归集四阶段',
        category: 'Venus / 版本',
        tags: ['venus', 'tr_release', 'package', 'auto-package', 'svn', 'verify', 'upgrade-doc'],
        content: COMMAND_CONTENT,
    };
}
