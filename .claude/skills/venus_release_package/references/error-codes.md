# 错误码与诊断手册

本文档是打包全流程的故障诊断速查表。当 `pre-package-check.sh`、`auto-package.sh`、`verify-package.sh` 任一环节报错时，按本文档对照定位根因。

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
- 处理：补齐参数。四个必填：`-n` 项目名、`-r` 版本号、`-l` 项目路径、`-o` 输出目录

**FAIL: 版本号格式错误: 'xxx'**
- 根因：版本号不是逗号分隔的纯数字
- 处理：改为 `64561,64562` 格式，不要带空格、字母、`r` 前缀

**FAIL: pack 模式缺少 -s/--svn-url**
- 根因：pack 模式需直连 SVN 仓库，要仓库地址
- 处理：加 `-s https://...`，或改用 `auto-pack` 模式（需本地 `.svn` 工作副本）

### 路径类

**FAIL: 项目路径不存在: /e/WorkSpaces_ahdx/Xxx**
- 根因：路径写错或项目未检出
- 处理：确认路径；`ls /e/WorkSpaces_ahdx/` 看实际项目名

**FAIL: auto-pack 模式要求项目为 SVN 工作副本（缺少 .svn 目录）**
- 根因：该目录不是 SVN 工作副本（可能是手动复制的源码）
- 处理：用 `svn checkout` 重新检出，或改用 `pack` 模式直连仓库

**WARN: 输出目录的父目录不存在**
- 根因：`-o` 的父目录不存在
- 处理：`auto-package.sh` 会 `mkdir -p`，但若父级不可写仍会失败；确认权限

### 配置类

**WARN: build.xml 未引用 WebRoot**
- 根因：Web 项目的 build.xml 应引用 `WebRoot`，未引用可能配置漂移
- 处理：人工核对 build.xml 是否与项目结构匹配

**WARN: build.xml 缺少 property: bin/lib/run**
- 根因：Server 项目的 build.xml 应声明 bin/lib/run 三个 property
- 处理：核对 build.xml 是否被改动过

**FAIL: 项目缺少物理目录: bin/（build.xml 引用但实际不存在）**
- 根因：build.xml 引用了 `bin/` 但项目里没有，结构损坏
- 处理：检查项目是否完整检出，或 build.xml 是否来自别的项目

**WARN: build.increment.xml 含 ${UPDATE-PART}/${DELETE-PART} 占位符未填充**
- 根因：Venus4A 的增量模板未填充，直接 `ant -f build.increment.xml` 会失败
- 处理：走 `auto-package.sh` 路线不需要填充（仅 WARN 不阻塞）；若要走 Ant 路线，用 `svnpackage.jar` 生成 `build.<rev>.xml`

### 工具链类

**FAIL: svn 命令不可用**
- 根因：SVN 客户端未装或未加入 PATH
- 处理：安装 TortoiseSVN 勾选"命令行工具"，或 `export PATH="/c/Program Files/TortoiseSVN/bin:$PATH"`

**FAIL: JAVA_HOME 下找不到 javac**
- 根因：`-j` 或 `DEFAULT_JAVA_HOME` 指向的目录不是 JDK（可能指向 JRE）
- 处理：确认路径指向 JDK（含 `bin/javac.exe`），不是 JRE（只有 `java.exe`）

**FAIL: 找不到 javac**
- 根因：没传 `-j`，PATH 里也没有 javac
- 处理：传 `-j <JDK路径>`，或在 `auto-package.conf` 设 `DEFAULT_JAVA_HOME`

**WARN: Ant 不可用**
- 根因：Ant 未装（auto-package.sh 不依赖 Ant，所以只 WARN）
- 处理：走 auto-package.sh 路线可忽略；走 Ant 模板路线需装 Ant 并传 `-a`

### 版本号类

**FAIL: 版本号 66591 超过 SVN 仓库 HEAD 66606**
- 根因：版本号大于仓库 HEAD，仓库中不存在该版本（版本号写错）
- 说明：2026-09 修正——上限从"本地工作副本根目录版本"改为**仓库 HEAD**（`svn info -r HEAD` 远程查询）。SVN 是 mixed-revision 模型，commit 只 bump 被提交文件的 revision，根目录 revision 停留在上次 update，旧口径会把用户自己刚提交的版本误判为超限
- 处理：`svn log -l 5` 核对近期版本号，修正 `-r` 参数

## 打包阶段（auto-package.sh）错误

### 编译类

**javac: 找不到符号 / 程序包 xxx 不存在**
- 根因：classpath 缺依赖 jar
- 处理：
  1. Web 项目：确认 `WebRoot/WEB-INF/lib/` 含所有依赖 jar
  2. Web 项目：确认 Tomcat 的 `servlet-api.jar`、`jsp-api.jar` 在 classpath（auto-package.sh 会自动找 `E:/devtools/tomcat/*/lib`）
  3. Server 项目：确认 `lib/` 含所有依赖
  4. 用 `-v` 看详细 classpath

**javac: 警告: 编码 UTF-8 的不可映射字符**
- 根因：源文件含非 UTF-8 字符（可能是 GBK 注释）
- 处理：`auto-package.sh` 已强制 `-encoding UTF-8`；若源文件本身是 GBK，需先转码或确认 IDE 编码设置

**编译失败，打包中止**
- 根因：javac 返回非 0，`auto-package.sh` 在 `compile_java_files` 失败后 `exit 1`
- 处理：看 `javac_output.log`（打包失败时会在产出目录附近留日志），定位具体编译错误

**Argument list too long**
- 根因：变更 Java 文件过多，命令行超 Windows 长度限制
- 处理：`auto-package.sh` 已用 argfile（`@argfile`）规避；若仍出现，确认 `compile_java_files` 函数生效（版本较新的脚本才有）

### SVN 类

**svn: E170001: Authentication required**
- 根因：SVN 需要认证但未传账号
- 处理：加 `-u <用户名> -p <密码>`，或在 `auto-package.conf` 设 `DEFAULT_SVN_USER`/`DEFAULT_SVN_PASS`

**svn: E160013: ... 不存在**
- 根因：版本号在仓库里不存在
- 处理：`svn log -l 10 <项目路径>` 看实际可用版本号

**SVN diff 失败 / 没有找到任何变更文件，打包中止**
- 根因：版本号区间无变更，或版本号写错
- 处理：`svn log -r <版本号> -v <项目路径>` 确认该版本确有变更；版本号区间是否搞反

### 输出类

**rm: 无法删除 ... 目录非空**
- 根因：`auto-package.sh` 清空旧输出目录时，有文件被占用
- 处理：关闭占用该目录的程序（IDE、资源管理器、Tomcat），重试

## 校验阶段（verify-package.sh）错误

### 无法校验类（退出码 2）

**产出目录不存在: /e/ProjectPackage/xxx/Venus4A**
- 根因：还没打包，或打包产出在别处
- 处理：先跑 `auto-package.sh` 打包；或确认 `-o` 指向正确的产出父目录（脚本会自动拼 `/<项目名>/`）

**auto-pack 模式要求 /xxx 为 SVN 工作副本（缺 .svn）**
- 根因：verify 也需要 SVN 工作副本来跑 `svn diff`
- 处理：用 SVN 检出的项目路径；或改用 `--cmd pack -s <svn-url>`

### 一致性差异类（退出码 1）

**[缺失] src/x/foo.java → 期望 WEB-INF/classes/x/foo.class，未找到**
- 根因：变更了 `.java` 但产出没有对应 `.class`
- 可能原因：
  1. 阶段二编译失败（但 auto-package.sh 会 exit 1，不会产出残包）
  2. 该类因依赖问题被 javac 跳过（javac 对单文件编译时，依赖不全不会编译出 class）
- 处理：单独 `javac -cp <classpath> <该.java>` 复现编译错误

**[缺失] WebRoot/x.jsp → 期望 x.jsp，未找到**
- 根因：JSP 变更了但没复制到产出
- 处理：回看阶段二是否报"复制资源"数量；确认 `auto-package.sh` 的 `run_web_build` 资源复制分支是否执行

**[编译缺失] src/x/foo.java → 未找到 foo.class**
- 同上 [缺失]，专门标注 Java 编译产物缺失（主类 `.class` 必须存在，旧版"任一存在即可"的宽松口径已收紧）

**[内部类缺失] src/x/foo.java → 内部类缺失: xxx/foo$1.class（基准: ...）**
- 根因：主类 `foo.class` 在产出中，但源项目本地编译输出目录（Web=`WebRoot/WEB-INF/classes/`，Server=`bin/`）中该主类的某内部类 `foo$*.class` 在产出中缺失
- 可能原因：
  1. 增量包在复制/传输过程中丢文件
  2. 手工清理增量包时误删
  3. 本地基准过期：源码已删该内部类，但本地编译输出还留着旧 class（重打包+全量编译后消除）
- 处理：重新打包再校验；复现则对照报告中的基准路径检查源项目编译产物

**[应删未删] src/x/foo.java 已删除但产出仍含 foo.class / foo$1.class**
- 根因：文件在某版本删除（D 操作），但产出仍有它（含内部类 `foo$*.class` 残留）
- 可能原因：
  1. 旧产出未清理（auto-package.sh 会 `rm -rf` 输出目录，若残留说明清理失败）
  2. 版本号区间选错，没包含到删除版本
  3. 该文件在更高版本又被重新添加（先 D 后 A，最终是 A，不应算应删未删——脚本已按"最终状态"判定）
- 处理：核对版本号区间；`svn log -r <版本> -v <路径>` 看该文件的操作历史

**[多余] xxx（变更清单中无此文件）**（仅 --strict）
- 根因：产出里有变更清单之外的文件
- 可能原因：
  1. 误打包了无关文件
  2. 旧产出残留（auto-package.sh 清理失败）
- 处理：核对文件是否确属误打包

### 内部类校验机制

一个 `Foo.java` 编译可能产出：
- `Foo.class`（主类）
- `Foo$1.class`（匿名内部类）
- `Foo$Bar.class`（命名内部类）

`verify-package.sh` 的策略（2026-09 优化后）：
- 主类 `Foo.class` 必须存在，缺失报 `[编译缺失]`
- 内部类以**源项目本地编译输出目录**中该主类的全部 `Foo$*.class` 为基准逐一核对，缺失报 `[内部类缺失]`；基准目录无该包或无内部类时跳过（该类无内部类，或本地未全量编译）
- 存在的内部类记入期望清单，strict 模式下不会被算成"多余"
- 基准目录在报告头部输出（`内部类基准: <路径>`），报缺失时同时给出基准文件路径，便于区分"增量包真缺"与"本地基准过期"

## 诊断辅助命令

```bash
# 看本地 SVN 版本号
svn info --show-item revision /e/WorkSpaces_ahdx/Venus4A

# 看某版本的变更文件
svn diff --summarize -r 66524:66525 /e/WorkSpaces_ahdx/Venus4A

# 看某版本的提交信息
svn log -r 66525 -v /e/WorkSpaces_ahdx/Venus4A

# 单独编译某 Java 文件复现错误
javac -encoding UTF-8 -cp "<classpath>" /e/WorkSpaces_ahdx/Venus4A/src/foo/Bar.java

# 看 auto-package.sh 的中间产物（变更清单）
cat <runtime_dir>/.openspec-tmp/<change>/merged_files.txt
```
