# init-project-scan 增量规格

## ADDED Requirements

### Requirement: 忽略清单与忽略规则解析

预扫描的遍历入口 SHALL 按**三级忽略来源**决定「是否进入遍历」，并在跳过时按原因计数：

1. **内置固定目录名清单**：至少覆盖 `.git` / `.svn` / `.hg` / `node_modules` / `dist` / `build` / `target` / `out` / `classes` / `coverage` / `bin` / `.next` / `.venv` / `__pycache__`，以及 iagent 自身产物目录（`.claude` / `.pi` / `.codex` / `.opencode` / `.iagent` / `.codegraph` / `openspec`）；
2. **项目 `.gitignore`**：根级与嵌套（嵌套规则仅在其所在子树生效）；
3. **自定义 ignore 文件**：项目可提供独立 ignore 文件（不依赖 VCS 存在）。

规则语义 MUST 支持：`#` 注释行、`!` 否定规则、尾部 `/` 表示仅匹配目录、`*` 与 `**` 通配、不含 `/` 的模式按任意层级的 basename 匹配。命中忽略的目录与文件 MUST NOT 进入遍历或读取内容，并按 `limits.skipped.ignored` 计数（目录命中计 1，不展开统计未知子项）。

忽略规则文件解析失败时 SHALL **fail-open**（该文件不生效、不过滤）、记录 WARN 并计入 `limits.skipped.unreadable`，MUST NOT 因解析失败而漏扫项目内容。系统 SHALL 提供关闭开关（`respectIgnoreFiles=false`，经 `iagent init --no-scan-ignore` 触达）使解析整体退化为「仅固定忽略清单」。

**支持的规则子集（实现边界）**：`#` 注释、空行、`!` 否定、尾部 `/` 仅目录、`*` / `**` 通配、不含 `/` 的模式按任意层级 basename 匹配、含 `/` 的模式相对该 `.gitignore` 所在目录锚定。字符类 `[abc]`、反斜杠转义、`**/` 中段匹配等**未列出的语法 MAY 不支持 —— 不支持时 MUST 按「该行不产生忽略」处理（fail-open 方向），MUST NOT 抛错、MUST NOT 反向误忽略。

#### Scenario: 固定忽略清单目录不进入遍历

- **WHEN** 项目根存在 `node_modules/`、`dist/`、`.venv/`、`__pycache__/` 等目录且执行预扫描
- **THEN** 这些目录 MUST NOT 进入遍历、内容 MUST NOT 被读取，且 `limits.skipped.ignored` 逐项递增

#### Scenario: `.gitignore` 与否定规则生效

- **WHEN** 项目 `.gitignore` 忽略 `logs/` 但以 `!logs/keep.properties` 否定其中一项
- **THEN** `logs/` 下除 `keep.properties` 外的条目不出现在 `scope.files` 与 `signals` 中并计入 `skipped.ignored`；`keep.properties` 仍被正常归类

#### Scenario: 嵌套 `.gitignore` 作用域受限

- **WHEN** 子目录 `module-a/.gitignore` 忽略 `*.tmp`，而根目录下同名模式未声明
- **THEN** 仅 `module-a/` 子树内的 `*.tmp` 被跳过，其余目录的 `*.tmp` 不受影响

#### Scenario: 忽略规则解析失败 fail-open

- **WHEN** `.gitignore` 内容导致解析异常
- **THEN** 该文件不生效（不过滤）、记录 WARN 并计入 `skipped.unreadable`，遍历继续且 MUST NOT 静默漏扫

#### Scenario: 关闭忽略规则解析

- **WHEN** 调用方传入 `respectIgnoreFiles=false`（等价 `iagent init --no-scan-ignore`）
- **THEN** 仅内置固定目录名清单生效，`.gitignore` 与自定义 ignore 均不参与过滤

#### Scenario: 无 VCS 项目仍可遍历

- **WHEN** 项目目录不含 `.git/` 且没有任何 `.gitignore`（如 SVN 项目或纯目录交付）
- **THEN** 遍历 SHALL 照常进行（仅内置固定清单与自定义 ignore 生效），MUST NOT 因缺少 VCS 元数据而跳过扫描、报错或把跳过计入 `skipped.unreadable`

### Requirement: 软超时与跳过量统计

预扫描的遍历 SHALL 受**软超时预算**约束（默认 30s，可经 `softTimeoutMs` 注入覆盖）。超时语义为**受控停止而非失败**：

- 达到预算时 SHALL 停止继续遍历、按已采集结果收尾；
- MUST NOT 使 `iagent init` 以非零码退出、MUST NOT 记为 `state:'failed'`；
- SHALL 记录 `limits.softTimeout.exceeded = true`、`limits.skipped.timeout > 0` 与 `limits.reasons` 含 `soft-timeout`；
- 该提示 MUST 同时出现在**终端报告**与**基线 JSON**，MUST NOT 静默。

**`skipped.timeout` 的可判定口径**：断言为「因软超时未完成处理的条目数，从停止点起逐个计至本层枚举结束」（到点时正在归类的条目计 1，其后同一目录下已枚举返回但未处理的同级条目逐个计 1）；MUST NOT 试图递归统计未展开子树的未知子项，也 MUST NOT 被解读为精确漏扫量。消费侧文案统一为「因软超时跳过 N 项（可能不完整）」。恒满足 `exceeded=true ⇒ timeout ≥ 1`。

**可注入路径（否则验收不可测）**：`iagent init` MUST 提供两条注入/逃生路径，且二者都不改变默认行为、都不写入基线 schema —— ① `--no-scan-ignore` 关闭忽略规则解析（等价 `respectIgnoreFiles=false`，与 `--no-scan` / `--no-deps` 同构）；② 环境变量 `IAGENT_SCAN_SOFT_TIMEOUT_MS`（正整数毫秒，非法值忽略并 WARN）覆盖软超时预算。`config.yaml` 不新增 `scan` 段（`parseProjectConfig` 契约不变）。

不可读条目（权限拒绝 / IO 失败）SHALL 计入 `limits.skipped.unreadable` 并保留 `failures[]` 的具体原因，遍历继续。

`limits.hit` SHALL 表示「本次扫描发生了任一跳过」（忽略 / 软超时 / 不可读），不再表示「触及上限」；`limits.detail` SHALL 保持人读文案并逐类说明跳过原因。

#### Scenario: 软超时停止遍历但不失败

- **WHEN** 以极小 `softTimeoutMs`（如 1ms，或经 `IAGENT_SCAN_SOFT_TIMEOUT_MS=1` 覆盖）扫描含大量文件的项目
- **THEN** 遍历停止、`softTimeout.exceeded=true`、`skipped.timeout≥1`，终端报告与基线 JSON 均含超时提示，且 `iagent init` 退出码为 0
- **AND** 同一目录下未处理的同级条目按「`skipped.timeout` 可判定口径」逐个计数（不递归统计未展开子树）

#### Scenario: 不可读条目计入 skipped 与 failures

- **WHEN** 某目录因权限拒绝无法读取
- **THEN** 该目录计入 `skipped.unreadable`、其路径与原因写入 `failures[]`，遍历继续完成其余目录

#### Scenario: 无跳过时 hit 为 false

- **WHEN** 扫描完成且无忽略命中、无超时、无不可读
- **THEN** `limits.hit=false`、`reasons` 为空数组、`skipped` 三项皆为 0，`detail` 为「未发生跳过」类中性文案

#### Scenario: 不设深度与文件数上限

- **WHEN** 项目含深度 ≥12 的配置文件目录与超过 2000 个文件
- **THEN** 全部条目被遍历与归类（`scope.files` 与深度不再被截断），MUST NOT 出现「上限所致」类跳过

## MODIFIED Requirements

### Requirement: 确定性预扫描

`iagent init` SHALL 在既有安装步骤与依赖自检之后执行**确定性预扫描**——由纯 Node 代码提取项目内**机器可判定事实**（标志文件、构建设施、目录骨架、依赖清单、配置键名、路由声明位置），并在每次 init 时**覆盖刷新**。预扫描 MUST 为只读：MUST NOT 执行项目内任何脚本（`build.xml` / `package.json` / `package-lock.json` 等只解析不执行），MUST NOT 修改项目文件。

预扫描的遍历 MUST NOT 设置目录深度上限或文件数上限：遍历至自然结束，或有界性仅由「忽略清单 + 忽略规则」（见「忽略清单与忽略规则解析」）与「软超时」（见「软超时与跳过量统计」）承担。

预扫描 MUST 为**非阻断**：任一环节失败（目录不可读、遍历超时、写基线失败）时 SHALL 记录 WARN 并继续，MUST NOT 中断 `iagent init` 主流程，MUST NOT 使 init 以非零码退出。

系统 SHALL 提供 `--no-scan` 逃生阀（与既有 `--no-deps` 同构），置位时跳过预扫描全部步骤且不产生任何扫描输出。

#### Scenario: 每次 init 覆盖刷新基线

- **WHEN** 项目已存在 `.iagent/scan-baseline.json` 并再次执行 `iagent init`
- **THEN** 系统重新执行预扫描并以本次结果**整体覆盖**既有基线文件，输出扫描报告；MUST NOT 保留上一次的陈旧事实

#### Scenario: `--no-scan` 跳过预扫描

- **WHEN** 执行 `iagent init --no-scan`
- **THEN** 系统跳过预扫描全部步骤，不写基线、不输出扫描报告；技能与指令安装、权限合并、`.iagent/` 配置等其余步骤行为不变

#### Scenario: Ant 项目（无 pom.xml）

- **WHEN** 项目根含 `build.xml` 而不含 `pom.xml` / `build.gradle` / `package.json`
- **THEN** 基线 SHALL 记录构建设施为 Ant（`build.xml`），MUST NOT 因缺少 `pom.xml` 而报告构建设施缺失或判定失败

#### Scenario: 非 Maven / Ant 族项目

- **WHEN** 项目为 Node / TypeScript 项目（含 `package.json` 与包管理器锁文件，不含 `build.xml` / `pom.xml`）
- **THEN** 基线 SHALL 记录构建设施与包管理器为该生态的对应项，MUST NOT 假设任一技术栈为默认（`build.xml` / `pom.xml` / `build.gradle` / `package.json` 平权受理）

#### Scenario: 深度目录不再被漏采

- **WHEN** 项目在 `src/main/java/com/<org>/<module>/a/b/c/d/e/` 下存在 `db.properties`
- **THEN** 该配置文件的键名与路径 SHALL 出现在 `signals.config`，MUST NOT 因目录深度而被跳过

#### Scenario: 预扫描失败不阻断 init

- **WHEN** 预扫描因目录不可读或写基线失败而失败
- **THEN** 系统记录 WARN 并继续完成 init 其余步骤，init 退出码保持为 0

### Requirement: 敏感值防护

预扫描 MUST 只输出配置项的**键名与所在文件路径，MUST NOT 输出任何取值**。该约束适用于数据库连接配置、认证配置、密钥配置及一切可能含凭据的配置文件。

系统 SHALL 内置文件排除清单，至少覆盖：含个人信息的非源码文件、编译产物目录、日志文件与崩溃转储、超大非源码文件、**iagent 自身产物目录**（`.claude/` / `.iagent/` / `.codegraph/` / `openspec/`）、第三方依赖目录（如 `node_modules/`）与构建输出目录（如 `dist/`）、以及第三方依赖自带的元数据文件（如依赖目录内的 `package.json`）。

排除 iagent 自身产物目录是**必需**而非优化：`.claude/skills/` 下含全部已安装 iagent 技能，若不排除，扫描器会把 iagent 自身的安装产物报告为"项目信号"，污染基线与报告。该排除属固定忽略清单（见「忽略清单与忽略规则解析」），与扫描是否受软超时约束无关；`openspec/` 被纳入 VCS 跟踪不改变本排除语义。

同一配置的多环境变体（如 `.bak` / `_musql` / 环境后缀等派生文件）SHALL 被识别为同一配置的变体并**合并报告为一项**，MUST NOT 逐个列出。

语义扫描阶段产出的安全规范文档 MUST NOT 含凭据值与可利用的绕过细节 —— 它描述机制与约定，不描述攻击方法。

#### Scenario: 配置含凭据键

- **WHEN** 预扫描读取含 `PASSWORD` / `KEY` / `SECRET` 一类键的配置文件
- **THEN** 基线 SHALL 记录**键名**与文件路径，MUST NOT 记录任何键的取值

#### Scenario: 多环境配置变体合并

- **WHEN** 项目存在 `DataBase.properties` 及其变体（`.bak` / 环境后缀等）
- **THEN** 基线 SHALL 将其合并报告为该配置的一项，MUST NOT 逐个变体输出（避免清单爆炸与凭据多副本外泄）

#### Scenario: 排除清单内的文件

- **WHEN** 项目根存在含个人信息的非源码文件、编译产物目录或日志文件
- **THEN** 系统 MUST NOT 读取其内容，MUST NOT 将其记为项目事实

#### Scenario: iagent 自身产物不被误报为项目信号

- **WHEN** 项目已安装 iagent 技能（`.claude/skills/` 下含全部已安装技能目录）并执行预扫描
- **THEN** 基线 MUST NOT 把 `.claude/` 下的 iagent 安装产物记为项目技术栈/模块信号，MUST NOT 因这些目录的存在而判定项目为多模块，也 MUST NOT 将其计入 `skipped.ignored` 之外的其他跳过类别

### Requirement: 信号与候选分层

预扫描输出 SHALL 分为两个判定层级，且 **MUST NOT 输出框架结论**：

- **信号**：直接观察到的事实（如"发现 `build.xml`"、"发现 `DataBase.properties`"、"发现目录 `src/` 直挂"），维度含构建设施、源码骨架、配置键名、路由声明位置、既有文档，以及**测试探针**（`signals.tests`）：
  - **测试目录探测**：对标准测试目录名（如 `test/`、`tests/`、`__tests__/`、`e2e/`、`spec/`）按存在性记录事实；
  - **测试文件名模式计数**：对既有命名模式（如 `*.test.*`、`*.spec.*`、`*Test.java`、`*Tests.java`、`*_test.go`）计数记录；软超时导致未完成计数时 MUST 标注「因软超时跳过」（标注载体为 `limits.softTimeout.exceeded` + `limits.skipped.timeout`，MUST NOT 新增字段），MUST NOT 以已计数部分推断总量或占比；
  - 测试探针 MUST 保持只读机械事实（目录名 / 文件名 / 计数），MUST NOT 读取测试代码内容，MUST NOT 输出「项目使用某测试框架」的结论。
- **候选**：可能的技术栈线索（如"发现 `spring-2.0.5.jar`"），MUST 显式标注为候选。

系统 MUST NOT 依据文件或 jar 的**存在**断言框架正在被使用 —— 存在与实际使用是两件事，框架结论 MUST 由语义扫描阶段结合源码实际使用情况判定。

#### Scenario: jar 存在但未被源码使用

- **WHEN** 项目 lib 目录含某框架 jar，但源码中该框架的 import 命中数为 0 或极少
- **THEN** 基线 SHALL 仅将该 jar 记为「候选」线索，MUST NOT 输出"项目使用该框架"的结论

#### Scenario: 观察到的事实记为信号

- **WHEN** 预扫描在项目根发现 `build.xml`
- **THEN** 基线 SHALL 将「发现 `build.xml`」记为信号（观察事实），并在需要时附带解析出的 target 名称

#### Scenario: 测试目录探针记录事实

- **WHEN** 项目根存在 `test/` 目录（且不在忽略清单内）
- **THEN** 基线 SHALL 在 `signals.tests` 记录该测试目录事实，MUST NOT 因目录存在而断言测试框架

#### Scenario: 测试文件模式计数因软超时未完成

- **WHEN** 遍历在测试文件计数完成前触发软超时
- **THEN** 基线 SHALL 记录已计数部分，并在 `limits.softTimeout.exceeded` 与 `skipped.timeout` 中标注该跳过，MUST NOT 静默截断或据此推断框架结论

#### Scenario: 无测试探针时为空

- **WHEN** 项目未检出任何测试目录与测试文件名模式
- **THEN** `signals.tests` SHALL 为空（无内容即 NULL 语义），MUST NOT 生成"无测试"推断结论之外的编造条目

### Requirement: 扫描基线落盘

预扫描结果 SHALL 写入 `.iagent/scan-baseline.json`，结构版本为 `2`：

```jsonc
{
  "version": 2,
  "scannedAt": "<ISO 时间>",
  "scope": { "dirs": 0, "files": 0 },
  "limits": {
    "hit": false,
    "detail": "未发生跳过",
    "reasons": [],                        // ignored | soft-timeout | unreadable
    "softTimeout": { "ms": 30000, "exceeded": false },
    "skipped": { "ignored": 0, "timeout": 0, "unreadable": 0 }
  },
  "signals": { "build": [], "skeleton": [], "config": [], "routes": [], "docs": [], "tests": [] },
  "candidates": [],
  "failures": []
}
```

基线定位为**给技能读的脚手架**（本机产物，不入库），MUST NOT 被视为交付物。基线 MUST 为机器可读的结构化格式，且 SHALL 携带足以让技能判断其**完整性**的信息（探测范围、按原因分类的跳过量、失败项）。

**兼容**：读取方 SHALL 按 `version` 分支处理——`2` 读 v2 字段；`1`（或无 `version`）视为历史结构，仅读 `limits.hit` / `limits.detail` 与其余既有字段。写入方 MUST 始终写 `version: 2`，MUST NOT 写入 `maxDepth` / `maxFiles` 一类上限字段。

**消费侧闭环**：读取方 SHALL 把完整性信息呈现给用户 —— `project-init` 技能读取基线后 MUST 在报告中呈现 `limits.skipped` 的三类计数与 `failures[]` 的逐条失败项（`skipped` 三项全为 0 且 `failures` 为空时可省略该段），并在 `skipped` 任一非 0 时声明「跳过所致 ≠ 项目无该内容」。MUST NOT 只消费 `signals` / `candidates` 而静默丢弃跳过信息。

写入失败 SHALL 仅记录 WARN 并继续（见「确定性预扫描」的非阻断要求）。

#### Scenario: 基线写入成功

- **WHEN** 预扫描在项目根成功完成且 `.iagent/` 可写
- **THEN** 系统 SHALL 写入 `.iagent/scan-baseline.json`，内容含 `version: 2`、`signals`、`candidates`、`limits.skipped`、`limits.softTimeout` 与 `failures`

#### Scenario: 历史 v1 基线仍可读取

- **WHEN** 读到 `version: 1`（或缺失 `version`）的既有基线
- **THEN** 读取方 SHALL 仅使用 `limits.hit` / `limits.detail` 与既有事实字段，MUST NOT 因缺少 `skipped` 而报错

#### Scenario: 基线缺失时技能降级

- **WHEN** 技能被调用但 `.iagent/scan-baseline.json` 不存在或无法解析
- **THEN** 技能 SHALL 记录 WARN 并自行执行机械探测（Glob/Grep/Read），继续完成语义扫描，MUST NOT 因基线缺失而终止

#### Scenario: 消费侧呈现跳过与失败

- **WHEN** `project-init` 技能读到 `limits.skipped` 任一非 0 或 `failures[]` 非空的基线
- **THEN** 报告 MUST 含按 `ignored` / `timeout` / `unreadable` 分类的跳过量与逐条失败项，并声明「跳过所致 ≠ 项目无该内容」；`skipped` 三项全为 0 且 `failures` 为空时可省略该段

#### Scenario: 旧装机搬移的基线仍可解析

- **WHEN** `iagent init` / `iagent update` 的旧装机迁移把 `.venus/` 下的扫描基线搬至 `.iagent/scan-baseline.json`
- **THEN** 搬移结果 SHALL 可被 v2 读取方解析（旧结构按 v1 分支处理），迁移逻辑 MUST NOT 因 schema 升级而失败

## REMOVED Requirements

### Requirement: index.db 初始化步骤

**Reason**: 跨变更 SQLite 索引随 DEC-2 整体退役（同一变更删除 `iagent spec reindex` 命令、索引模块与 `sql.js` 依赖），`iagent init` 不再创建 `openspec/changes/archive/.iagent/index.db`。索引的历史定位为「可重建缓存」而非真源，移除不影响任何 Markdown 制品；历史 `index.db` 文件不由本工具删除（升级文档给出清理指引）。

**Migration**: 升级到本版本后 `iagent init` 不再输出索引创建结果；用户目录中既有 `index.db` 可保留只读，或用外部 `sqlite3` 打开；需要跨变更检索时改用 Glob/Grep 与 `openspec/specs/<capability>/explorations.md`。
