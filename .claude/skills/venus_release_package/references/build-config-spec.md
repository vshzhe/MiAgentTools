# build.xml 配置规范与项目类型判定矩阵

本文档说明 `E:\WorkSpaces_ahdx\` 下各项目的 `build.xml` 配置约定，以及 `auto-package.sh` 如何判定项目类型。预检脚本 `pre-package-check.sh` 依据此规范校验配置一致性。

## 项目类型判定（与 auto-package.sh detect_project_type 一致）

`auto-package.sh` 用目录存在性判定项目类型，**不读 build.xml 的 project name**：

| 判定条件 | 项目类型 | 典型项目 |
|---|---|---|
| 存在 `WebRoot/` 目录 | `web` | Venus4A、Venus4A_telecom、Venus4A_F1 |
| 存在 `bin/` + `lib/` 目录（且无 `WebRoot/`） | `server` | AccountManager、AuthServer、AnalysisServer、EventServer_HB、ComponentMonitorServer |
| 都不满足 | `unknown`（打包会异常） | — |

判定优先级：先看 `WebRoot/`，再看 `bin/+lib/`。所以 Venus4A 即使有 `bin/`（实际没有），也会被判定为 web。

## Web 项目 build.xml 规范

### 典型结构（以 Venus4A 为例）

```xml
<project name="Venus4A Web Application" default="war" basedir=".">
    <property name="project" location="." />
    <property name="WebRoot" location="WebRoot" />
    <target name="war" description="copy files">
        <war warfile="WebRoot.war" webxml="${WebRoot}/WEB-INF/web.xml">
            <fileset dir="${WebRoot}"></fileset>
        </war>
    </target>
    <target name="zip" description="create zip file">
        <zip destfile="WebRoot.zip" basedir="${WebRoot}"/>
    </target>
    <!-- tar / gzip / update / mqzip / all 等 -->
</project>
```

### 预检校验点

| 校验项 | 通过条件 | 不通过处理 |
|---|---|---|
| build.xml 存在 | 项目根有 `build.xml` | WARN（auto-package.sh 不依赖它，但全量打包缺） |
| 引用 WebRoot | `grep WebRoot` 命中 | WARN（可能与 Web 结构不匹配） |
| 含 Web target | 含 `war`/`zip`/`tar`/`update` 任一 target | WARN（可能自定义结构） |
| build.increment.xml 占位符 | 无 `${UPDATE-PART}`/`${DELETE-PART}` | WARN（直接 ant 执行会失败） |

### build.increment.xml（增量构建模板）

仅 Venus4A 系列使用。这是一个**带占位符的 Ant 模板**，不能直接执行：

```xml
<target name="copy" depends="compile">
    <delete includeEmptyDirs="true">
        ${DELETE-PART}    <!-- 占位符，需 svnpackage.jar 填充具体 fileset -->
    </delete>
    <copy todir="${package}">
        <fileset dir="${target}">
            ${UPDATE-PART}    <!-- 占位符 -->
        </fileset>
    </copy>
</target>
```

**填充方式**：用 `svnpackage.jar`（`E:\devtools\svnpackage-20251217\svnpackage\svnpackage.jar`）根据版本号生成具体的 `build.<rev>.xml`，再 `ant -f build.<rev>.xml` 执行。

**与 auto-package.sh 的关系**：这是**另一条打包路线**，与 `auto-package.sh` 的 javac 增量编译路线二选一：
- `auto-package.sh` 路线：直接 javac 编译变更文件，不碰 build.xml
- svnpackage.jar + Ant 路线：填充模板 → ant 执行

本技能主要服务 `auto-package.sh` 路线。占位符未填充只是 WARN（不阻塞 auto-package.sh），因为走 auto-package.sh 不需要填充它。

## Server 项目 build.xml 规范

### 典型结构（以 AccountManager 为例）

```xml
<project name="Venus4A Account Server" default="copy" basedir=".">
    <property name="project" location="." />
    <property name="build" location="AccountServer" />
    <property name="bin" location="bin" />
    <property name="lib" location="lib" />
    <property name="run" location="run" />
    <target name="init" depends="clean">
        <mkdir dir="${build}" />
        <mkdir dir="${build}/bin" />
        <mkdir dir="${build}/lib" />
        <mkdir dir="${build}/log" />
        <mkdir dir="${build}/log/accountserver" />
    </target>
    <target name="copy" depends="init" description="copy files">
        <copy todir="${build}/bin"><fileset dir="${bin}"/></copy>
        <copy todir="${build}/lib"><fileset dir="${lib}"/></copy>
        <copy todir="${build}"><fileset dir="${run}"/></copy>
    </target>
    <!-- tar / zip / gzip / update / all -->
</project>
```

### 预检校验点

| 校验项 | 通过条件 | 不通过处理 |
|---|---|---|
| build.xml 存在 | 项目根有 `build.xml` | WARN |
| 含 bin/lib/run property | 三个 property 都命中 | WARN（缺哪个提示哪个） |
| 物理目录存在 | `bin/`、`lib/`、`run/` 目录都存在 | FAIL（build.xml 引用但目录不存在，结构损坏） |
| 含 Server target | 含 `copy`/`init`/`tar`/`zip`/`update` 任一 | — |

### Server 项目差异点

各 Server 项目的 `build.xml` 几乎同构，差异只在：
- `project name`（如 "Venus4A Account Server"、"Venus4A Auth Server"）
- `build` property 的目录名（如 `AccountServer`、`AuthServer`、`AnalysisServer`）
- `log` 子目录名（如 `log/accountserver`、`log/authserver`、`log/analysisserver`、`log/policyengine`）

这些差异不影响 `auto-package.sh` 打包（脚本用 `bin/lib/run` 三个固定目录名，不读 `build` property），所以预检不强制校验这些差异。

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

项目类型决定了 `auto-package.sh` 的**产出目录结构**和**路径映射规则**，这也是 `verify-package.sh` 校验的依据：

| 项目类型 | 产出根目录 | Java 编译目标 | 资源文件映射 |
|---|---|---|---|
| web | `<output>/<name>/` | `WEB-INF/classes/` | `src/x` → `WEB-INF/classes/x`；`WebRoot/x` → `x` |
| server | `<output>/<name>/` | `bin/` | `src/x` → `bin/x`；`lib/`、`run/` 原样 |

两类型都会生成：
- `readme.txt` — 版本变更说明（含 SVN 提交作者/日期/说明）
- Server 项目额外有 `filelist.txt`（变更文件清单）
