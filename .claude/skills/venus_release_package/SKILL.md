---
name: venus_release_package
description: "项目打包质量校验与升级信息归集技能，覆盖\"打包前预检→打包执行监控→打包后一致性校验→升级信息归集\"四阶段闭环。基于 auto-package.sh 自动打包脚本（项目内 `vendor/auto-package-svn/`，路径可配置）与各项目 build.xml 配置，以 SVN 变更清单为基准校验产出一致性，并归集升级所需 SQL（四源）与配置参数（三源）输出 `升级文档.md`。适用 `E:\\WorkSpaces_ahdx` 下的 Web 项目（Venus4A 系列）和 Server 项目（AccountManager、AuthServer、AnalysisServer 等）。当用户要打包项目、检查打包结果、做打包一致性校验、归集升级 SQL/配置、生成升级文档、确认增量包是否打全、排查打包出错或文件对不上时使用。即使用户只说\"打个包\"，也应在打包完成后主动做一致性校验与升级信息归集，确保交付质量。"
allowed-tools: Bash(bash:*), Bash(svn:*), Bash(javac:*), Bash(cat:*), Bash(ls:*), Read, Write, Edit, Glob, Grep
license: MIT
compatibility: 需要 Git Bash、SVN 命令行、JDK 环境；auto-package 运行时默认项目内 vendor/auto-package-svn/（路径可配置）。
metadata:
  author: venus-agent-tools
  version: "1.0"
  type: tr_release
  generatedBy: "0.1.0"
---


# auto-package-verifier — 项目打包质量校验

## 这个技能解决什么问题

`auto-package.sh`（位于 `vendor/auto-package-svn`）是一个基于 SVN 版本号的增量打包工具，用于把指定版本的变更文件编译、复制、归集到输出目录，供上线部署。

打包过程涉及多个易错环节：
- **参数错配**：版本号超过 SVN 仓库 HEAD（不存在的版本）、项目路径错误、缺 JDK/Ant/SVN
- **配置漂移**：`build.xml` 声明的结构与实际目录不符
- **编译静默失败**：`javac` 编译错误被吞，产出缺 `.class`
- **文件漏打/多打**：SVN 变更清单里的文件没进产出，或产出里混入了不该有的文件
- **目录错位**：`src/x.java` 该映射到 `WEB-INF/classes/x.class` 却进了别处

本技能提供**四个阶段的流程**（前三阶段为校验脚本，第四阶段为升级信息归集），把这些错误拦在交付前并归集升级信息。四个阶段独立可用，也可串成闭环。

## 关键概念：校验基准

一致性校验**以 SVN 变更清单为准**，而不是以 `build.xml` 配置为准。理由：
- `auto-package.sh` 的实际工作逻辑是"读 SVN diff → 映射路径 → 编译/复制"，SVN 变更清单是它真正消费的输入
- `build.xml` 在 `auto-package.sh` 流程里**几乎不被使用**（脚本用 `javac` 直接增量编译，不调 Ant），所以以 `build.xml` 为基准会与实际打包口径错位
- SVN 变更清单是客观事实（仓库里哪些文件变了），产出是结果，两者比对能直接暴露"该打的没打、不该打的打了"

## 四阶段流程

### 阶段一：打包前预检（pre-package-check.sh）

**目的**：在调用 `auto-package.sh` 之前，把会导致打包失败的问题提前拦住。预检不通过就不要进入打包，避免浪费时间跑一个注定失败的流程。

**调用方式**：
```bash
bash <技能目录>/scripts/pre-package-check.sh \
  --cmd auto-pack \
  -n <项目名> -r <版本号,逗号分隔> \
  -l <本地项目路径> -o <输出目录> \
  [-j <java-home>] [-a <ant-home>]
```

`--cmd` 可选 `auto-pack`（默认，需 `.svn` 工作副本）或 `pack`（需 `-s <svn-url>`）。

**校验项**（5 类）：
1. 必填参数齐全性 + 版本号格式（逗号分隔的数字）
2. 项目路径存在 + SVN 工作副本（auto-pack 模式）+ 输出目录可写
3. 项目类型识别（Web=有 `WebRoot/`；Server=有 `bin/+lib/`）+ `build.xml` 配置一致性
4. 工具链：`svn`（必须）、`javac`（必须）、`ant`（可选）
5. 版本号 ≤ SVN 仓库 HEAD（`svn info -r HEAD` 远程查询；本地根目录版本老于目标版本仅 WARN 提示，mixed-revision 模型下根目录版本不代表文件内容新旧）

**退出码**：`0`=可打包（含警告），`1`=有错误不可打包。

**怎么用结果**：
- 退出码 1 → 向用户报告全部 FAIL 项，询问是否先修复再打包，**不要继续阶段二**
- 退出码 0 但有 WARN → 提示用户注意警告，通常可继续
- 退出码 0 无 WARN → 直接进入阶段二

### 阶段二：打包执行监控

这一阶段**不单独写脚本**——直接由你（Claude）调用 `auto-package.sh` 并解析其输出。理由是 `auto-package.sh` 自带 `set -euo pipefail` 和编译失败 `exit 1`，监控层只需捕获并解读。

**运行时路径解析**：阶段二调用 auto-package.sh 前，先读 `.venus/config.yaml` 的 `auto_package.runtime_dir` 字段（默认 `vendor/auto-package-svn`，项目根相对路径），定位 auto-package 运行时目录。未配置用默认值；拼接 `<runtime_dir>/auto-package.sh`，文件不存在则报错提示用户配置 `auto_package.runtime_dir` 或备份运行时到 vendor。auto-package.sh 自包含（`SCRIPT_DIR` 定位同目录 conf 与 `lib/ecj jar`），`runtime_dir` 同时定位 `auto-package.conf` 与 `lib/ecj-4.6.3.jar`。

**调用方式**（Git Bash）：
```bash
# runtime_dir 从 .venus/config.yaml 的 auto_package.runtime_dir 读取，默认 vendor/auto-package-svn
bash <runtime_dir>/auto-package.sh auto-pack \
  -n <项目名> -r <版本号> \
  -l <本地项目路径> -o <输出目录> \
  -j <java-home> -a <ant-home> -v
```

`-v` 开启详细输出，便于诊断。PowerShell 环境可用 `<runtime_dir>/auto-package.ps1` 包装器。

**监控要点**：
- 退出码 0 → 进入阶段三校验产出
- 退出码非 0 → 解析 stderr，常见失败原因见下方"错误诊断"。**立即暂停**，向用户报告失败原因和上下文，不要继续阶段三
- 关注 stderr 里的 `javac` 编译错误（`找不到符号`、`程序包不存在`）、`svn` 失败（认证、路径）、`Argument list too long`

**如果用户说"已经打包完了，只校验"**：跳过阶段二，直接进阶段三。

### 阶段三：打包后一致性校验（verify-package.sh）

**目的**：以 SVN 变更清单为基准，逐项核对产出目录，确认该有的文件都在、不该有的没混入、目录结构正确、编译产物齐全。这是质量交付的最后一道闸门。

**调用方式**：
```bash
bash <技能目录>/scripts/verify-package.sh \
  -n <项目名> -r <版本号,逗号分隔> \
  -l <本地项目路径> -o <产出目录> \
  [--cmd auto-pack|pack] [--strict] [--workers N] [-j <JDK路径>]
```

注意：`-o` 指的是**产出目录的父级**（与传给 `auto-package.sh` 的 `-o` 一致），脚本会自动在后面拼 `/<项目名>/` 找实际产出。

**`--strict` 严格模式**：开启后会检测"多余文件"（产出里有但变更清单里没有的文件，排除 `readme.txt`/`filelist.txt`）。日常增量打包建议开启，能发现误打包的文件。不开启时只报缺失/编译缺失/应删未删。

**`--workers N` 并行数**（默认 4）：控制两个并行点——各版本 `svn diff` 并发收集、变更文件分块并行核对。`--workers 1` 完全串行（调试对照用）。多版本大变更场景下并行优化可将校验耗时从 ~2 分钟降到 ~20 秒（diff 阶段受 SVN 服务器响应速度限制，为主要耗时）；内部类基准为 1 次批量扫描 + 内存查表。

**`-j/--java-home` JDK 路径**（可选，默认环境 `JAVA_HOME`）：用于 **ECJ 字节码抽检**——对产出 class 用 `javap` 与 IDE 产物（源项目 `WebRoot/WEB-INF/classes/` 或 `bin/`）精确对比指令序列，确认 auto-package 改用 ECJ 后字节码与 IDE 100% 一致。未指定且环境无 `JAVA_HOME` 时跳过抽检（不报错，仅 INFO）。

**校验逻辑**（与 `auto-package.sh` 路径映射完全对齐）：

| 变更类型 | 项目类型 | 期望产出 |
|---|---|---|
| A/M `src/x/foo.java` | Web | `WEB-INF/classes/x/foo.class`（含内部类 `foo$*.class`） |
| A/M `src/x/foo.java` | Server | `bin/x/foo.class` |
| A/M `src/conf/x.xml` | Web | `WEB-INF/classes/conf/x.xml` |
| A/M `src/conf/x.xml` | Server | `bin/conf/x.xml` |
| A/M `WebRoot/x.jsp` | Web | `x.jsp`（剥离 `WebRoot/` 前缀） |
| A/M `lib/x.jar` / `run/x.sh` | Server | 原样保留 |
| D `src/x/foo.java` | 任意 | 产出**不应**含对应 `.class` |
| D `WebRoot/x.jsp` | Web | 产出**不应**含 `x.jsp` |

**特殊处理**：
- **目录变更跳过**：SVN diff 在新增文件时会额外列出其所在目录（如 `A src/.../service`，无扩展名）。`auto-package.sh` 对这种目录行会被 `cp` 的 `[[ ! -f ]]` 跳过，本脚本同样跳过，避免误报缺失。
- **IDE 配置过滤**：与 `auto-package.sh` 同口径过滤 `.settings/.classpath/.project/.git`，避免误报。
- **内部类验证**：一个 `.java` 编译产出主类 `foo.class` + 内部类 `foo$1.class`、`foo$Bar.class` 等。主类必须存在；内部类以**源项目本地编译输出目录**（Web=`WebRoot/WEB-INF/classes/`，Server=`bin/`）中该主类的全部 `foo$*.class` 为基准逐一核对，缺失报 `[内部类缺失]`。基准目录无该包或无内部类时跳过（该类无内部类或本地未全量编译）。内部类同时记入期望清单（strict 模式不误报多余）。
- **多版本去重**：多版本打包时，同一文件路径取最新版本状态（先 A 后 D → 最终 D；先 D 后 A → 最终 A）。
- **ECJ 字节码抽检**：auto-package.sh 改用 ECJ 后，产出 class 字节码应与 IDE（Eclipse）一致。对每个产出 class（IDE 有对应产物的）用 `javap -c -p` 精确对比指令序列（去除地址/常量池索引/注释），diff=0 通过，diff>0 报 `[字节码差异]`。新增类（IDE 无对应产物）跳过。javap 不可用时跳过整段抽检。

**退出码**：`0`=一致（PASS），`1`=有差异（FAIL），`2`=无法校验（产出目录不存在/SVN 不可用等）。

**怎么解读报告**：
- `[ OK ]` 匹配成功（含"（内部类）"后缀的行 = 内部类核对通过）
- `[缺失]` 变更清单要求产出，但产出里没有 —— 多半是编译失败或路径映射错误
- `[编译缺失]` `.java` 变更了但主类 `.class` 不存在 —— 编译可能失败，回看阶段二的 javac 日志
- `[内部类缺失]` 主类 `.class` 在，但源项目基准中该类的某内部类 `foo$*.class` 在产出中缺失 —— 复制/清理环节丢失，或本地基准过期（源码删了内部类但旧 class 还在）
- `[应删未删]` 文件已在某版本删除，但产出仍包含（含已删类的 `foo$*.class` 残留）—— 旧产出未清理或版本号选错
- `[多余]`（仅 strict）产出里有变更清单之外的文件 —— 可能误打包了无关文件
- `[字节码差异]` 产出 class 与 IDE 产物指令序列不一致 —— ECJ 选项未对齐 IDE，或 ECJ jar 版本与 IDE 不匹配，回看 auto-package.sh 的 ECJ 编译选项（`-1.8 -g -preserveAllLocals`）
- **一致性评分**：`匹配数/(A+M数)`，100% 才算 PASS（内部类核对不加分，只扣缺失）。字节码差异不计入评分百分比，但计入 FAIL 判定（有字节码差异即 FAIL）。

### 阶段四：升级信息归集

**目的**：阶段三一致性校验通过后，归集本次增量包的升级信息（待执行 SQL、待变更配置参数），输出 `升级文档.md` 到产出目录，随增量包交付运维，补齐"打包→校验→升级文档"闭环。阶段四在阶段三 PASS 后触发；"只校验已有产出"场景（跳过阶段一二）同样适用。

**输入**：① 打包产出目录（含 readme.txt、变更文件清单）；② OpenSpec 变更提案（`openspec/changes/<name>/`，通过 readme.txt 反查关联）。

#### 流程

1. **提案反查**：读产出 `readme.txt`（auto-package.sh 已含各 revision 提交作者/日期/说明），按约定格式从提交说明提取 change 名，定位 `openspec/changes/<name>/`。提取顺序：
   - **显式标记优先**：匹配 `变更: <name>` / `[<name>]` / `change: <name>`（不区分大小写），提取 `<name>`。
   - **目录名回退匹配**：无显式标记时，将提交说明与 `openspec/changes/` 下全部未归档变更目录名做子串匹配（目录名形如 `<action>-<module>-<desc>`，全小写连字符），命中即关联。
   - **多 revision 累积**：每个 revision 独立提取，汇总后按 change 名去重分组。某 revision 提取不到 change 名时归入"未关联"区段，不阻断其他 revision 反查。
   - 提取到的 change 名须 `openspec/changes/<name>/proposal.md` 存在方算关联成功。

2. **反查失败处理**：`readme.txt` 无 change 名 / 提案不存在 / `readme.txt` 不存在时，**静默跳过提案来源**，仅归集产出文件中的 SQL/配置，不阻断、不提示用户手动指定。升级文档头部注明"未关联到 OpenSpec 提案"。

3. **SQL 四源归集**（待执行 SQL，各源互补，某源为空时该子节标"（无）"不报错）：
   - **来源①**：产出中的 `.sql` 文件（增量包内变更的 .sql 直接归集）
   - **来源②**：Java/Mapper XML 内嵌 SQL（扫描变更的 Java DAO/Service 或 MyBatis Mapper XML，抽取建表/改表/DML 语句）
   - **来源③**：独立 `db/migration` 目录（按版本号对应查找）
   - **来源④**：提案 tasks 的 `[DB脚本]` 标记（依赖提案关联成功，从 `tasks.md` 标 `[DB脚本]` 的任务抽取）

4. **配置参数三源归集**（待变更配置参数，各源互补，某源为空时该子节标"（无）"不报错）：
   - **来源①**：产出中的配置文件（`.properties`/`.xml`/`.yaml`，diff 出新增/修改参数项）
   - **来源②**：提案声明的配置项（从 `proposal.md`/`design.md` 显式声明抽取，依赖提案关联成功）
   - **来源③**：特定配置文件（`auto-package.conf` / 项目 config 等关键参数）

5. **多版本去重分组**：多版本打包时，按反查到的 change 名去重分组——一升级文档含多 change 区段，或一 change 跨多 revision 归一为该 change 区段。全部 revision 均无 change 名时退化为单"未关联提案"区段（仅产出文件归集）。

6. **输出 `升级文档.md`**：写入产出目录（与 `readme.txt`/`filelist.txt` 同级），结构：
   - **头部**：项目名 / 版本 / 生成时间 / 关联提案状态（已关联 N 个 / 未关联）
   - **一、待执行 SQL**（四来源各一子节）
   - **二、待变更配置参数**（三来源各一子节）
   - **三、关联 OpenSpec 提案**（change 名 + 关联 revision + proposal 要点摘要；或"未关联到 OpenSpec 提案"）
   - **四、增量包文件清单**（引自 `readme.txt`/`filelist.txt`）
   - 各源为空时该子节标"（无）"，不省略节标题（保持结构稳定，便于运维核对归集完整性）。

#### 怎么用结果

- 升级文档随增量包交付运维，运维按文档执行 SQL、变更配置参数完成升级部署。
- 未关联提案时文档仍可用（基于产出文件归集），但缺提案来源的 SQL/配置项需人工复核。
- 阶段四不阻断交付：即使提案反查失败、某源归集为空，仍输出升级文档（标注降级状态）。

## 典型工作流

### 场景 A：完整闭环打包（推荐）
用户说"打个 Venus4A 的包，版本 66525"：
1. 跑 `pre-package-check.sh` → 预检通过
2. 跑 `auto-package.sh auto-pack ...` → 监控输出，编译失败则暂停报告
3. 跑 `verify-package.sh --strict` → 一致性校验
4. 全绿则向用户报告"打包完成且校验通过，产出在 <目录>，共 N 个文件"；有问题则报告具体差异

### 场景 B：只校验已有产出
用户说"我已经打完包了，帮我看看对不对"：
1. 直接跑 `verify-package.sh --strict`（跳过阶段一二）
2. 报告一致性结果

### 场景 C：诊断打包失败
用户说"打包报错了"：
1. 跑 `pre-package-check.sh` 排除环境/参数问题
2. 如果预检通过，重新跑 `auto-package.sh -v` 捕获详细错误
3. 按"错误诊断"对照处理

## 使用 SKILL：参数传递与追问

本技能的两个脚本都需要一组打包参数。用户很少会一次说全，你的职责是从用户的自然语言描述里提取这些参数，缺失的主动追问，不要凭空假设。

### 必需参数（4 个，缺一不可）

| 参数 | 脚本选项 | 用户可能怎么说 | 缺失时的处理 |
|---|---|---|---|
| 项目名称 | `-n` | "打包 Venus4A""给 AccountManager 打个包" | 从用户描述提取；提取不到则追问"打包哪个项目？" |
| 版本号 | `-r` | "版本 66525""r66525-66528""今天提交的两个版本" | 追问"打哪个 SVN 版本号？多个用逗号分隔"。可先用 `svn info --show-item revision <项目路径>` 看本地版本辅助 |
| 项目路径 | `-l` | "Venus4A 在 E:\WorkSpaces_ahdx" | 多数项目在 `E:\WorkSpaces_ahdx\<项目名>`，可先按此推断并让用户确认；不在则追问 |
| 输出目录 | `-o` | "输出到 F:\ProjectPackage" | 默认用 `auto-package.conf` 的 `DEFAULT_OUTPUT_DIR`（`E:/ProjectPackage`）；用户未指定时用默认值并告知，不要追问 |

### 可选参数（有默认值，不追问除非用户在意）

| 参数 | 脚本选项 | 默认 | 何时需要问用户 |
|---|---|---|---|
| JDK 路径 | `-j` | `auto-package.conf` 的 `DEFAULT_JAVA_HOME`（JDK 1.8.0_202） | 一般用默认；项目要求其他 JDK（如 1.7/21）时才问"用哪个 JDK？" |
| Ant 路径 | `-a` | `auto-package.conf` 的 `DEFAULT_ANT_HOME` | 用默认即可，几乎不用问 |
| SVN 仓库地址 | `-s` | 无（仅 pack 模式需要） | 仅当用户要直连仓库（非本地工作副本）时追问"SVN 仓库地址是？" |
| 命令模式 | `--cmd` | `auto-pack` | 仅当用户明确要"直连仓库打包"或本地无 `.svn` 时用 `pack` |
| 严格模式 | `--strict` | 关 | 校验阶段默认建议开（能发现多余文件），除非用户明确说"只看缺不缺" |

### 追问原则

- **一次问清，不要挤牙膏**：缺多个参数时合并成一次提问，给用户选项减少输入负担。
- **给推断选项**：能从上下文推断的值（如项目路径默认 `E:\WorkSpaces_ahdx\<项目名>`），先给出推断结果让用户确认，而非空问。
- **不要假设版本号**：版本号是强语义参数，错一个数字就打错包，必须由用户明确给出，绝不自己猜。
- **版本号要匹配**：只校验场景下，校验用的版本号必须与打包时一致。用单版本去校验多版本合并的产出，strict 模式会把其他版本的文件判为"多余"——这是正确行为，要主动提醒用户。
- **默认值要说明**：用默认输出目录、默认 JDK 时，告知用户"用的是默认值 X"，让用户有机会否决。

### 参数到脚本的映射

用户给的自然语言，映射成脚本调用：

```
用户："打包 Venus4A，版本 66525，输出到 E:\ProjectPackage\today"
        ↓ 提取
项目名=Venus4A  版本=66525  路径=E:\WorkSpaces_ahdx\Venus4A（推断）  输出=E:\ProjectPackage\today  JDK=默认
        ↓ 映射（路径转 POSIX）
pre-package-check.sh --cmd auto-pack -n Venus4A -r 66525 \
  -l /e/WorkSpaces_ahdx/Venus4A -o /e/ProjectPackage/today
        ↓ 预检通过后
auto-package.sh auto-pack -n Venus4A -r 66525 \
  -l /e/WorkSpaces_ahdx/Venus4A -o /e/ProjectPackage/today
        ↓ 打包通过后
verify-package.sh -n Venus4A -r 66525 \
  -l /e/WorkSpaces_ahdx/Venus4A -o /e/ProjectPackage/today --strict
```

注意 `verify-package.sh` 的 `-o` 与 `auto-package.sh` 的 `-o` 一致（都是产出父目录），脚本会自动拼 `/<项目名>/`。

### 典型调用对话

**对话 1（信息完整）**：
> 用户：帮我打 Venus4A 的包，版本 66525 和 66526，放 E:\ProjectPackage\0910

你：项目路径默认用 `E:\WorkSpaces_ahdx\Venus4A`，JDK 用默认 1.8.0_202，确认吗？
> 用户：嗯

→ 直接进预检 → 打包 → 校验。

**对话 2（缺版本号）**：
> 用户：打个 AccountManager 的增量包

你：打包 AccountManager，SVN 版本号是？可以多个用逗号分隔。要看本地最新版本的话我先帮你查 `svn info`。
> 用户：52241

→ 补全后进预检。

**对话 3（本地无 SVN 工作副本）**：
> 用户：用 SVN 仓库地址打包 Venus4A

你：auto-pack 需要本地工作副本。你这里走 pack 模式直连仓库——SVN 仓库地址是？版本号是？
> 用户：https://172.16.96.1/svn/venus/Venus4A/，版本 66525

→ 用 `--cmd pack -s <url>` 调脚本。

**对话 4（只校验）**：
> 用户：我已经打包完了 Venus4A，帮我看看产出对不对

你：产出在哪个目录？打的是哪个版本？（校验用的版本号必须和打包时一致，否则 strict 模式会把版本号区间外的文件判为多余）
> 用户：E:\ProjectPackage\0910，版本 66525 到 66528

→ 直接跑 `verify-package.sh --strict -n Venus4A -r 66525,66526,66527,66528 -l ... -o ...`，跳过预检和打包。

## 错误诊断（常见问题速查）

详细的错误码与诊断步骤见 `references/error-codes.md`。这里列最高频的几类：

| 现象 | 根因 | 处理 |
|---|---|---|
| `javac` 报"找不到符号"/"程序包不存在" | classpath 缺依赖 jar | 确认 `WebRoot/WEB-INF/lib/` 或 `lib/` 含全部依赖；Web 项目确认 Tomcat `servlet-api.jar` 在路径 |
| `Argument list too long` | 源文件过多超命令行长度 | `auto-package.sh` 已用 argfile 规避，若仍出现检查 `compile_java_files` 是否生效 |
| SVN diff 返回空 | 版本号超过本地工作副本 | `svn update` 到目标版本，或改用 `pack` 模式直连仓库 |
| verify 报"编译缺失"但阶段二没报错 | `.java` 有语法/依赖问题被 javac 跳过 | 回看阶段二 javac 日志，单独编译该文件定位 |
| verify 报"应删未删" | 旧产出未清理 | `auto-package.sh` 会 `rm -rf` 输出目录，若仍残留检查输出目录是否被占用 |
| pre-check 报"build.increment.xml 占位符未填充" | Venus4A 用 Ant 模板路线时需先填充 | 用 `svnpackage.jar` 生成 `build.<rev>.xml` 再 `ant -f` 执行（与 auto-package.sh 路线二选一） |

## 关于 build.xml 的角色澄清

`build.xml` 在 `auto-package.sh` 流程里**不是打包的执行依据**——脚本直接调 `javac` 做增量编译，不解析 `build.xml`。但 `build.xml` 仍是**全量打包/打 war/tar** 的配置（如 `ant war`、`ant zip`），且能反映项目的预期目录结构。

所以本技能里 `build.xml` 的作用是：
- 预检阶段：校验 `build.xml` 声明的 property（bin/lib/run/WebRoot）与实际目录是否一致，发现"配置漂移"
- 不作为一致性校验的基准（基准是 SVN 变更清单）

详细的 `build.xml` 配置规范与项目类型判定矩阵见 `references/build-config-spec.md`。

## 脚本路径

两个脚本都在本技能的 `scripts/` 目录下：
- `scripts/pre-package-check.sh` — 打包前预检
- `scripts/verify-package.sh` — 打包后一致性校验

调用时用绝对路径或相对于技能目录的路径。技能目录即本 `SKILL.md` 所在目录。

> **打包脚本本体**（`auto-package.sh` + `auto-package.conf` + `lib/ecj-4.6.3.jar`）不在技能 `scripts/` 目录，而是备份在项目内 `vendor/auto-package-svn/`（路径可经 `.venus/config.yaml` 的 `auto_package.runtime_dir` 配置，见阶段二"运行时路径解析"）。阶段二调用打包脚本本体，阶段一、三调用本技能 `scripts/` 下的校验脚本。

## 环境前提

- Git Bash（Windows）—— 脚本用 bash 语法，与 `auto-package.sh` 同生态
- auto-package 运行时（`auto-package.sh` + `auto-package.conf` + `lib/ecj-4.6.3.jar`）：默认项目内 `vendor/auto-package-svn/`，路径可经 `.venus/config.yaml` 的 `auto_package.runtime_dir` 配置
- SVN 命令行客户端（TortoiseSVN 命令行需加入 PATH）
- JDK（`auto-package.sh` 用 `javac` 编译，需通过 `-j` 或 `auto-package.conf` 的 `DEFAULT_JAVA_HOME` 指定）
- Ant（可选，仅 Ant 模板路线需要）

脚本路径转换逻辑与 `auto-package.sh` 完全一致（`to_posix_path`），所以传参时 Windows 路径（`E:\...`）和 POSIX 路径（`/e/...`）都能接受。

