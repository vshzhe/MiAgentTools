# 自动打包工具使用说明

## 概述

`auto-package.sh` 是一个基于 SVN 版本号的自动打包工具，支持：
- 按 SVN 版本号提取变更文件
- 变更文件内容**按版本从 SVN 服务器拉取**（`svn cat`，不读本地工作副本，本地未提交修改或版本不一致不影响打包结果）
- 使用指定 JDK 版本编译 Java 源码
- 自动识别项目类型（Web / Server）
- 将变更文件按版本号打包到对应目录
- 多版本合并输出（同一文件多版本变更时取最新版本内容）

## 文件位置

```
E:\github\
├── auto-package.sh          # 主脚本（Bash）
├── auto-package.ps1         # PowerShell 包装器
└── auto-package.conf        # 默认配置文件
```

## 环境要求

- **操作系统**: Windows（Git Bash 或 PowerShell 环境）
- **SVN 客户端**: TortoiseSVN 或命令行 SVN（需加入 PATH）
- **JDK**: 1.7 / 1.8 / 11 / 17 / 21（根据项目需要）
- **Ant**: 可选（Server 项目不需要，Web 项目使用 Ant 模板模式时需要）
- **Git Bash**: PowerShell 模式需要 Git for Windows 提供的 `bash.exe`

## 快速开始

### 1. 首次使用 - 配置默认参数

编辑 `auto-package.conf` 文件，设置默认的 JDK 和 Ant 路径：

```bash
# JDK 路径（根据实际安装目录修改）
DEFAULT_JAVA_HOME="D:/Program/Java/jdk1.8.0_202"

# Ant 路径（根据实际安装目录修改）
DEFAULT_ANT_HOME="E:/devtools/apache-ant-1.10.15-bin/apache-ant-1.10.15"

# 默认输出目录
DEFAULT_OUTPUT_DIR="F:/ProjectPackage"
```

### 2. 自动打包（推荐）

#### Git Bash 环境
```bash
cd /e/github
./auto-package.sh auto-pack \
  -n Venus4A \
  -r 64561,64562 \
  -l /e/WorkSpaces_ahdx/Venus4A \
  -o /f/ProjectPackage/20260901
```

#### PowerShell 环境
```powershell
cd E:\github
.\auto-package.ps1 auto-pack -n Venus4A -r 64561,64562 -l "E:\WorkSpaces_ahdx\Venus4A" -o "E:\ProjectPackage\20260901"
```

> **注意：** PowerShell 下路径参数建议用双引号包裹，避免路径中的空格或特殊字符导致解析错误。

### 3. 手动指定 SVN 地址打包

当本地没有 SVN 工作副本时，手动指定 SVN 仓库地址：

```bash
cd /e/github
./auto-package.sh pack \
  -s https://172.16.96.1/svn/venus/anhui_code/Venus4A/ \
  -n Venus4A \
  -r 64561,64562 \
  -l /e/WorkSpaces_ahdx/Venus4A \
  -o /f/ProjectPackage/20260901
```

## 命令详解

### auto-pack 命令

从本地 SVN 工作副本自动获取信息并打包。

#### Git Bash
```
./auto-package.sh auto-pack [参数]
```

#### PowerShell
```
.\auto-package.ps1 auto-pack [参数]
```

**必填参数：**

| 参数 | 说明 | 示例 |
|------|------|------|
| `-n, --name` | 项目名称 | `-n Venus4A` |
| `-r, --revisions` | 版本号列表（逗号分隔） | `-r 64561,64562` |
| `-l, --local-path` | 本地项目路径（需有 `.svn` 目录） | `-l /e/WorkSpaces_ahdx/Venus4A` |
| `-o, --output` | 输出目录 | `-o /f/ProjectPackage` |

**可选参数：**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-j, --java-home` | JDK 路径 | 使用配置文件中的 `DEFAULT_JAVA_HOME` |
| `-a, --ant-home` | Ant 路径 | 使用配置文件中的 `DEFAULT_ANT_HOME` |
| `-v, --verbose` | 详细输出模式 | 关闭 |

### pack 命令

手动指定 SVN 仓库地址打包（需要 SVN 服务器访问权限）。

```
./auto-package.sh pack [参数]
```

**必填参数（比 auto-pack 多一个 `-s`）：**

| 参数 | 说明 | 示例 |
|------|------|------|
| `-s, --svn-url` | SVN 仓库地址 | `-s https://svn.example.com/svn/Venus4A/` |
| `-n, --name` | 项目名称 | `-n Venus4A` |
| `-r, --revisions` | 版本号列表 | `-r 64561,64562` |
| `-l, --local-path` | 本地项目路径 | `-l /e/WorkSpaces_ahdx/Venus4A` |
| `-o, --output` | 输出目录 | `-o /f/ProjectPackage` |

## 项目类型

脚本会自动检测项目类型，无需手动指定。

### Web 项目（如 Venus4A）

**检测条件：** 项目目录下存在 `WebRoot/` 文件夹

**处理流程：**
1. 从 SVN 服务器获取变更文件列表（`svn diff --summarize`）
2. 按版本从 SVN 服务器拉取变更的 Java 源文件（`svn cat URL@rev`，不读本地副本）
3. 编译拉取的源文件（使用指定 JDK + ECJ 编译器）
4. 编译后的 class 文件输出到 `WEB-INF/classes/` 对应包路径
5. 按版本从 SVN 服务器拉取变更的资源文件（JSP、XML、properties 等）到对应目录

**示例：**
```bash
./auto-package.sh auto-pack \
  -n Venus4A \
  -r 64561 \
  -l /e/WorkSpaces_ahdx/Venus4A \
  -o /f/ProjectPackage
```

### Server 项目（如 AccountManager、AuthServer、AnalysisServer、EventServer_HB、ComponentMonitorServer）

**检测条件：** 项目目录下存在 `bin/` + `lib/` 文件夹（且无 `WebRoot/`）

**处理流程：**
1. 从 SVN 服务器获取变更文件列表（`svn diff --summarize`）
2. 按版本从 SVN 服务器拉取变更的 Java 源文件（`svn cat URL@rev`，不读本地副本）
3. 编译拉取的源文件到 `bin/` 目录
4. 按版本拉取 `src/` 下的配置文件和 `conf/` 文件夹到 `bin/`（`src/` 前缀替换为 `bin/`，对齐真实 bin 目录结构）
5. 按版本拉取 `lib/`、`run/` 等其他变更文件到对应目录
6. 生成 `filelist.txt` 记录变更文件清单（记录映射后的 bin 相对路径）

**示例：**
```bash
./auto-package.sh auto-pack \
  -n AccountManager \
  -r 52241 \
  -l /e/WorkSpaces_ahdx/AccountManager \
  -o /f/ProjectPackage
```

## 输出目录结构

### Web 项目输出

```
<output_dir>/<project_name>/
├── WEB-INF/classes/...         ← 编译后的 class 文件（所有版本统一）
├── WEB-INF/lib/...             ← 如有 lib 变更
└── readme.txt                  ← 版本变更说明（含每个版本的SVN提交信息）
```

### Server 项目输出

```
<output_dir>/<project_name>/
├── bin/...                     ← 编译后的 class 文件 + src 下的配置文件和 conf 文件夹
├── lib/...                     ← 变更的 jar 包
├── run/...                     ← 变更的脚本
├── filelist.txt                ← 变更文件清单（记录映射后的 bin 相对路径）
└── readme.txt                  ← 版本变更说明（含每个版本的SVN提交信息）
```

> **bin 目录结构说明：** `src/` 下的所有文件按真实 `bin/` 目录结构镜像输出——`src/` 前缀替换为 `bin/`：
> - `src/cn/.../Foo.java` → 编译为 `bin/cn/.../Foo.class`
> - `src/conf/ehcache.xml` → `bin/conf/ehcache.xml`（conf 文件夹原样保留到 bin 下）
> - `src/DataBase.properties` → `bin/DataBase.properties`（src 根的配置文件）
> - `lib/`、`run/` 等其他前缀保持原路径不变
>
> **说明：** 优化后的打包流程不再创建每个版本的独立目录（如 `64561/`），也不再生成 `all/` 合并目录。所有版本的变更文件统一收集后一次性编译打包，直接输出到 `<project_name>/` 目录。readme.txt 增强版包含每个版本的 SVN 提交作者、提交日期和提交备注。

## 实际应用场景

### 场景 1：日常增量上线

```bash
# 1. 查看最近的 SVN 版本号
svn info /e/WorkSpaces_ahdx/Venus4A

# 2. 打包指定版本的变更文件
./auto-package.sh auto-pack \
  -n Venus4A \
  -r 64561,64562 \
  -l /e/WorkSpaces_ahdx/Venus4A \
  -o /f/ProjectPackage/AH/DX/20260901

# 3. 部署：将增量包复制到服务器
# 输出目录为 /f/ProjectPackage/AH/DX/20260901/Venus4A/
# cp -rf /f/ProjectPackage/AH/DX/20260901/Venus4A/* /tomcat/webapps/WebRoot/
```

### 场景 2：指定 JDK 版本打包

```bash
./auto-package.sh auto-pack \
  -n Venus4A \
  -r 64561 \
  -l /e/WorkSpaces_ahdx/Venus4A \
  -o /f/ProjectPackage \
  -j "D:/Program/Java/jdk1.8.0_202" \
  -v
```

### 场景 3：Server 项目增量打包

```bash
# 打包多个 Server 项目
for proj in AccountManager AuthServer AnalysisServer EventServer_HB; do
  ./auto-package.sh auto-pack \
    -n $proj \
    -r 52241 \
    -l /e/WorkSpaces_ahdx/$proj \
    -o /f/ProjectPackage/Servers/20260901
done
```

### 场景 4：使用现有 svnpackage.jar 替代方案

如果已有 `svnpackage.jar` 生成的 `build.<version>.xml`，也可以直接使用 Ant 执行：

```bash
cd /e/WorkSpaces_ahdx/Venus4A
ant -f build.64561.xml
# 输出在 package/ 目录
```

## 配置文件说明

`auto-package.conf` 完整配置项：

```bash
# ---------- JDK 配置 ----------
DEFAULT_JAVA_HOME="D:/Program/Java/jdk1.8.0_202"

# ---------- Ant 配置 ----------
DEFAULT_ANT_HOME="E:/devtools/apache-ant-1.10.15-bin/apache-ant-1.10.15"

# ---------- SVN 配置 ----------
DEFAULT_SVN_USER=""
DEFAULT_SVN_PASS=""

# ---------- 输出配置 ----------
DEFAULT_OUTPUT_DIR="F:/ProjectPackage"
MERGE_ALL_VERSIONS="true"          # 是否合并所有版本到 all/ 目录
GEN_README="true"                  # 是否生成版本说明文件

# ---------- 编译配置 ----------
COMPILE_MEMORY="512"               # 编译内存上限 (MB)
SOURCE_ENCODING="UTF-8"            # 源码编码
```

## 常见问题

### Q1: 编译报错 "找不到符号" 或 "包不存在"

**原因：** 编译 classpath 中缺少依赖的 jar 包。

**解决：**
1. 确认 `WebRoot/WEB-INF/lib/` 目录下包含所有依赖 jar
2. 确认 Tomcat 路径配置正确（Web 项目需要 servlet-api.jar）
3. 使用 `-v` 参数查看详细的 classpath 信息

### Q2: SVN 命令执行失败

**原因：** SVN 客户端未安装或未加入 PATH。

**解决：**
```bash
# 检查 SVN 是否可用
which svn
svn --version

# 如果不可用，将 TortoiseSVN 的 bin 目录加入 PATH
export PATH="/d/Programs/TortoiseSVN/bin:$PATH"
```

### Q3: 输出目录为空

**原因：** 指定的版本号在本地 SVN 工作副本中不存在。

**解决：**
```bash
# 查看本地 SVN 版本号
svn info /e/WorkSpaces_ahdx/Venus4A

# 确认版本号在本地历史中
svn log -l 5 /e/WorkSpaces_ahdx/Venus4A
```

### Q4: 如何同时打包多个项目？

```bash
# 批量打包脚本示例
cat > batch-pack.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d)
VERSIONS="64561,64562"
OUTPUT="/f/ProjectPackage/$DATE"

for proj in Venus4A AccountManager AnalysisServer; do
  ./auto-package.sh auto-pack \
    -n $proj \
    -r $VERSIONS \
    -l /e/WorkSpaces_ahdx/$proj \
    -o $OUTPUT/$proj
done
EOF
```

### Q5: readme.txt 提交说明中文显示为问号（乱码）

**原因：** Windows 下 SVN 客户端将提交日志输出到文件时，会经过系统 console codepage（GBK）转换，遇到 GBK 无法表示的字符会被替换成 `?`，信息在源头丢失。日期的本地化部分（周几、月份名）GBK 可表示故正常，提交说明部分字符不可表示故变 `?`。

**解决：** 脚本已改用 `svn log --xml` 获取提交信息，XML 输出强制 UTF-8，绕开 console codepage 转换；日期通过 `LC_ALL=zh_CN.UTF-8 date` 还原本地化格式（如 `(周一, 30 7月 2026)`）。无需额外配置。

若日期本地化部分显示为英文或纯数字，说明 Git Bash 环境缺少 `zh_CN.UTF-8` locale（可用 `locale -a | grep zh_CN` 确认），脚本会自动降级为 `2026-07-30 17:06:14 +0800` 格式，不影响提交说明本身（提交说明取自 XML，与 locale 无关）。

### Q6: 编译报错 "Argument list too long"

**原因：** 变更的 Java 文件较多（如 200+ 个）时，源文件路径作为命令行参数传给 javac，总长度超过 Windows 命令行长度限制（约 32KB）。

**解决：** 脚本已改用 javac 参数文件（`@argfile`）传递源文件列表，无长度限制。编译时自动生成临时参数文件，编译结束后自动清理，无需额外配置。

若编译仍失败，通常是 classpath 缺失问题（见 Q1），与参数长度无关。

## 与现有 svnpackage.jar 的关系

| 对比项 | svnpackage.jar | auto-package.sh |
|--------|---------------|-----------------|
| 实现方式 | Java 程序 | Shell 脚本 |
| SVN 连接 | 内置 SVNKit 库 | 调用系统 SVN 命令 |
| 编译方式 | Ant 全量编译 | 直接 javac 增量编译 |
| JDK 切换 | 通过参数 | 通过参数 + 配置文件 |
| 输出结构 | package/ 目录 | <version>/ 目录 |
| 多版本支持 | 单次单版本 | 批量多版本 |
| 适用场景 | 单版本 Ant 增量构建 | 多版本快速增量打包 |

## 相关文件

| 文件 | 说明 | 使用环境 |
|------|------|---------|
| `E:\github\auto-package.sh` | 主脚本 | Git Bash |
| `E:\github\auto-package.ps1` | PowerShell 包装器 | PowerShell |
| `E:\github\auto-package.conf` | 配置文件 | 通用 |
| `E:\devtools\svnpackage-20251217\svnpackage\svnpackage.jar` | 原有 Java 打包工具 | - |
| `E:\WorkSpaces_ahdx\*\build.xml` | 各项目 Ant 构建文件 | - |
| `E:\WorkSpaces_ahdx\*\build.increment.xml` | 增量构建模板（Web 项目） | - |

## 环境切换参考

| 操作 | Git Bash | PowerShell |
|------|----------|------------|
| 运行脚本 | `./auto-package.sh <命令>` | `.\auto-package.ps1 <命令>` |
| 路径格式 | `/e/WorkSpaces_ahdx/Venus4A` | `"E:\WorkSpaces_ahdx\Venus4A"` |
| 查看帮助 | `./auto-package.sh help` | `.\auto-package.ps1 help` |
| 自动打包 | `./auto-package.sh auto-pack ...` | `.\auto-package.ps1 auto-pack ...` |
| 手动打包 | `./auto-package.sh pack ...` | `.\auto-package.ps1 pack ...` |