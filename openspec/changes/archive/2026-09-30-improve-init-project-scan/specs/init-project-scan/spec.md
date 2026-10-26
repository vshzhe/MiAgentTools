# init-project-scan Specification (Delta)

> 新增能力：项目扫描与知识文档沉淀。两段式 —— `venus init` 的**确定性预扫描**（Node，只输出「信号/候选」，含敏感值防护与遍历上限，非阻断降级）+ `venus_tr_init_project` 的**语义扫描**（五类文档、索引、不适用类、逐文档确认、增量对齐、人工域标记、`context` 回写、`tr-docs-feature-doc` 可选委派）。

## ADDED Requirements

### Requirement: 确定性预扫描

`venus init` SHALL 在既有安装步骤与依赖自检之后执行**确定性预扫描**——由纯 Node 代码提取项目内**机器可判定事实**（标志文件、构建设施、目录骨架、依赖清单、配置键名、路由声明位置），并在每次 init 时**覆盖刷新**。预扫描 MUST 为只读：MUST NOT 执行项目内任何脚本（`build.xml` / `package.json` / `package-lock.json` 等只解析不执行），MUST NOT 修改项目文件。

预扫描 MUST 为**非阻断**：任一环节失败（目录不可读、遍历超时、超限、写基线失败）时 SHALL 记录 WARN 并继续，MUST NOT 中断 `venus init` 主流程，MUST NOT 使 init 以非零码退出。

系统 SHALL 提供 `--no-scan` 逃生阀（与既有 `--no-deps` 同构），置位时跳过预扫描全部步骤且不产生任何扫描输出。

#### Scenario: 每次 init 覆盖刷新基线

- **WHEN** 项目已存在 `.venus/scan-baseline.json` 并再次执行 `venus init`
- **THEN** 系统重新执行预扫描并以本次结果**整体覆盖**既有基线文件，输出扫描报告；MUST NOT 保留上一次的陈旧事实

#### Scenario: `--no-scan` 跳过预扫描

- **WHEN** 执行 `venus init --no-scan`
- **THEN** 系统跳过预扫描全部步骤，不写基线、不输出扫描报告；技能与指令安装、权限合并、`.venus/` 配置等其余步骤行为不变

#### Scenario: Ant 项目（无 pom.xml）

- **WHEN** 项目根含 `build.xml` 而不含 `pom.xml` / `build.gradle` / `package.json`
- **THEN** 基线 SHALL 记录构建设施为 Ant（`build.xml`），MUST NOT 因缺少 `pom.xml` 而报告构建设施缺失或判定失败

#### Scenario: 非 Maven / Ant 族项目

- **WHEN** 项目为 Node / TypeScript 项目（含 `package.json` 与包管理器锁文件，不含 `build.xml` / `pom.xml`）
- **THEN** 基线 SHALL 记录构建设施与包管理器为该生态的对应项，MUST NOT 假设任一技术栈为默认（`build.xml` / `pom.xml` / `build.gradle` / `package.json` 平权受理）

#### Scenario: 遍历超限返回部分结果

- **WHEN** 项目文件数或目录深度超过系统内置上限
- **THEN** 系统 SHALL 返回已探测到的部分事实并记录 WARN 说明触及上限，MUST NOT 静默截断（WARN 中 MUST 说明是上限所致而非"无该内容"）

#### Scenario: 预扫描失败不阻断 init

- **WHEN** 预扫描因目录不可读、遍历超时或写基线失败而失败
- **THEN** 系统记录 WARN 并继续完成 init 其余步骤，init 退出码保持为 0

### Requirement: 信号与候选分层

预扫描输出 SHALL 分为两个判定层级，且 **MUST NOT 输出框架结论**：

- **信号**：直接观察到的事实（如"发现 `build.xml`"、"发现 `DataBase.properties`"、"发现目录 `src/` 直挂"）
- **候选**：可能的技术栈线索（如"发现 `spring-2.0.5.jar`"），MUST 显式标注为候选

系统 MUST NOT 依据文件或 jar 的**存在**断言框架正在被使用 —— 存在与实际使用是两件事，框架结论 MUST 由语义扫描阶段结合源码实际使用情况判定。

#### Scenario: jar 存在但未被源码使用

- **WHEN** 项目 lib 目录含某框架 jar，但源码中该框架的 import 命中数为 0 或极少
- **THEN** 基线 SHALL 仅将该 jar 记为「候选」线索，MUST NOT 输出"项目使用该框架"的结论

#### Scenario: 观察到的事实记为信号

- **WHEN** 预扫描在项目根发现 `build.xml`
- **THEN** 基线 SHALL 将「发现 `build.xml`」记为信号（观察事实），并在需要时附带解析出的 target 名称

### Requirement: 敏感值防护

预扫描 MUST 只输出配置项的**键名与所在文件路径，MUST NOT 输出任何取值**。该约束适用于数据库连接配置、认证配置、密钥配置及一切可能含凭据的配置文件。

系统 SHALL 内置文件排除清单，至少覆盖：含个人信息的非源码文件、编译产物目录、日志文件与崩溃转储、超大非源码文件、**venus 自身产物目录**（`.claude/` / `.venus/` / `.codegraph/` / `openspec/`）、第三方依赖目录（如 `node_modules/`）与构建输出目录（如 `dist/`）、以及第三方依赖自带的元数据文件（如依赖目录内的 `package.json`）。

排除 venus 自身产物目录是**必需**而非优化：`.claude/skills/` 下含全部已安装 venus 技能，若不排除，扫描器会把 venus 自身的安装产物报告为"项目信号"，污染基线与报告。

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

#### Scenario: venus 自身产物不被误报为项目信号

- **WHEN** 项目已安装 venus 技能（`.claude/skills/` 下含全部已安装技能目录）并执行预扫描
- **THEN** 基线 MUST NOT 把 `.claude/` 下的 venus 安装产物记为项目技术栈/模块信号，MUST NOT 因这些目录的存在而判定项目为多模块或触发遍历上限

### Requirement: 扫描基线落盘

预扫描结果 SHALL 写入 `.venus/scan-baseline.json`。基线定位为**给技能读的脚手架**（本机产物，不入库），MUST NOT 被视为交付物。

基线 MUST 为机器可读的结构化格式，且 SHALL 携带足以让技能判断其完整性的信息（探测范围、触及上限、失败项）。

写入失败 SHALL 仅记录 WARN 并继续（见「确定性预扫描」的非阻断要求）。

#### Scenario: 基线写入成功

- **WHEN** 预扫描在项目根成功完成且 `.venus/` 可写
- **THEN** 系统 SHALL 写入 `.venus/scan-baseline.json`，内容含信号集、候选集、探测范围与失败/超限标注

#### Scenario: 基线缺失时技能降级

- **WHEN** 技能被调用但 `.venus/scan-baseline.json` 不存在或无法解析
- **THEN** 技能 SHALL 记录 WARN 并自行执行机械探测（Glob/Grep/Read），继续完成语义扫描，MUST NOT 因基线缺失而终止

### Requirement: 语义扫描与技术栈判定回退链

`venus_tr_init_project` 技能 SHALL 执行语义扫描，产出五类项目知识文档的信息基础：**技术框架**、**模块与功能点**、**数据库**、**API 规范**、**安全规范**。

技术栈版本（如 JDK 版本）的判定 SHALL 按序回退：构建文件声明 → 工具链配置文件 → 构建脚本的编译参数 → 既有项目文档文本 → **标注为「未知」**。无可判定依据时 **MUST NOT 编造**版本号或框架名。

技术栈判定 SHALL 优先采信项目中**已结构化的技术栈声明**（如既有 `.venus/config.yaml` 的 `context` 段、`openspec/config.yaml` 的技术栈声明）—— 其可靠度高于从依赖文件推测。

#### Scenario: 版本无 machine-readable 声明

- **WHEN** 项目无 `pom.xml`、工具链配置中亦无版本条目，仅文档文本提及版本
- **THEN** 技能 SHALL 采信文档文本并**标注其来源为文档**；若无任何依据则标注「未知」，MUST NOT 编造版本号

#### Scenario: 项目已有结构化技术栈声明

- **WHEN** 项目 `openspec/config.yaml` 或 `.venus/config.yaml` 已声明技术栈
- **THEN** 技能 SHALL 优先采信该声明，并可结合代码扫描补充，MUST NOT 以纯推测结果覆盖已有声明

### Requirement: 五类文档与目录结构

技能 SHALL 将五类信息产出为独立的 Markdown 文档，落位于 `docs/project/` 下按类型划分的子目录，并使用中文文件名：

| 类型 | 路径 |
|---|---|
| 技术框架 | `docs/project/architecture/技术框架.md` |
| 模块与功能点 | `docs/project/modules/模块与功能点.md` |
| 数据库 | `docs/project/database/数据库.md` |
| API 规范 | `docs/project/api/API规范.md` |
| 安全规范 | `docs/project/security/安全规范.md` |

某类在项目中**无对应内容**时，系统 MUST NOT 生成该类文档；MUST NOT 生成仅含"无内容"占位的空壳文档。

#### Scenario: 五类齐全的项目

- **WHEN** 项目同时具备可识别的技术栈、业务模块、数据库配置、接口定义与安全机制
- **THEN** 系统 SHALL 在 `docs/project/` 下按上表生成五份文档

#### Scenario: 某类无对应内容

- **WHEN** 项目为纯前端项目、不存在任何数据库配置
- **THEN** 系统 MUST NOT 生成 `docs/project/database/数据库.md`；该类的「不适用」结论 SHALL 体现在索引中（见「索引文件」需求）

### Requirement: 索引文件

技能 SHALL 产出 `docs/project/README.md` 作为索引，汇总五类文档的路径、摘要与状态。

索引 MUST 列出全部五类（而非仅已生成的类）；未生成的类 SHALL 标注**「不适用」并附探测依据**，使「项目中确实没有」与「扫描未曾评估」可区分。MUST NOT 静默省略未生成的类。

#### Scenario: 索引含不适用类与依据

- **WHEN** 数据库类因项目无对应内容而未生成文档
- **THEN** 索引 SHALL 列出该类并标注"不适用"及探测依据（如"未发现 DDL 目录、连接配置或数据访问层"）

#### Scenario: 索引汇总已生成文档

- **WHEN** 五类中有三类生成了文档
- **THEN** 索引 SHALL 为每份已生成文档给出路径与一句话摘要，并列出其余两类的"不适用"结论及依据

### Requirement: 已存在文档的逐份确认

技能在写入任何项目知识文档或 `AGENTS.md` **之前**，SHALL 检测目标文档是否已存在。已存在的文档 MUST 逐一呈现给用户并取得选择，出口为：**确认重新生成** / **修改** / **跳过**。

用户选择「跳过」时，该文档 MUST 保持逐字不变，MUST NOT 被覆盖或部分改写。

用户对全部已存在文档均选择「跳过」时，流程 SHALL 正常结束（仍产出基线并回写 `context`），MUST NOT 视为失败。

#### Scenario: AGENTS.md 已存在

- **WHEN** 项目根已存在 `AGENTS.md` 且技能需要生成 `AGENTS.md`
- **THEN** 技能 SHALL 先向用户呈现该文档并询问处置方式（确认重新生成 / 修改 / 跳过），取得选择后才动作；MUST NOT 静默覆盖

#### Scenario: 用户选择跳过

- **WHEN** 用户对某个已存在文档选择「跳过」
- **THEN** 该文件内容 MUST 逐字保持原样（含时间戳与格式），技能 SHALL 在最终汇报中说明该文档被跳过

#### Scenario: 用户全部跳过

- **WHEN** 用户对所有已存在文档均选择「跳过」
- **THEN** 技能 SHALL 不写入任何文档、正常结束流程，并汇报"全部跳过"及仍已完成的动作（基线、`context` 回写）

### Requirement: 增量对齐与人工域标记

用户对已存在文档选择「确认重新生成」时，技能 SHALL 执行**增量对齐**（而非整体重写）：文档中被显式标记为**人工域**的段落 MUST 逐字保留，其余段落 SHALL 按当前扫描结果重新派生。

人工域 SHALL 以成对 HTML 注释标记界定：`<!-- 人工域:开始 -->` 与 `<!-- 人工域:结束 -->`。该标记在 Markdown 渲染时不可见。

文档不含任何人工域标记时，增量对齐 SHALL 退化为整体重新派生；该情形 MUST NOT 被视为错误。

增量对齐 MUST NOT 删除人工域内容；MUST NOT 因格式破损而丢弃全部内容 —— 格式破损时 SHALL 保留可识别内容并记录 WARN。

#### Scenario: 人工域逐字保留

- **WHEN** 已存在文档含 `<!-- 人工域:开始 -->` 与 `<!-- 人工域:结束 -->` 包裹的段落，且用户选择重新生成
- **THEN** 标记区间内的内容 SHALL 逐字保留，标记区间外的段落 SHALL 按当前扫描结果重新派生

#### Scenario: 无人工域标记

- **WHEN** 已存在文档不含任何人工域标记，且用户选择重新生成
- **THEN** 技能 SHALL 按当前扫描结果整体重新派生该文档，MUST NOT 报错或要求用户先补标记

#### Scenario: 人工域标记未闭合

- **WHEN** 已存在文档含开始标记但缺对应的结束标记
- **THEN** 技能 SHALL 由开始标记**至文末整体保留**并记录 WARN，MUST NOT 猜测闭合位置或删除该区间内容（破损情形一律取保留侧，避免不可逆地删除用户手写内容）

#### Scenario: 人工域标记嵌套或乱序

- **WHEN** 已存在文档的人工域标记出现嵌套或开始/结束乱序
- **THEN** 技能 SHALL 保留最外层的最大连续区间并记录 WARN，区间外内容按当前扫描结果重派生

### Requirement: 复用与降级（不改变默认安装集）

五类中「模块与功能点」「数据库」「API 规范」的信息基础，技能 SHALL 通过 `Skill` 工具**委派 `venus_tr_docs_feature_doc`** 获取，以复用其框架档案能力（该技能已覆盖前端交互、后端方法、字段级接口契约、数据库调用链与跨模块交互）。

委派 SHALL 为**可选降级**：`venus_tr_docs_feature_doc` 不可得时（未安装），技能 SHALL 自行扫描并记录 WARN，MUST NOT 终止流程。

本能力 **MUST NOT 引入依赖注入**：`tr-init-project ⇒ tr-docs-feature-doc` MUST NOT 加入依赖注入规则表，默认安装集 MUST 维持 9 项不变。

#### Scenario: 委派可得时复用

- **WHEN** `venus_tr_docs_feature_doc` 已安装且技能需要「模块与功能点 / 数据库 / API 规范」的信息基础
- **THEN** 技能 SHALL 通过 `Skill` 工具委派该技能，并复用其产出作为三类文档的信息基础

#### Scenario: 委派不可得时降级

- **WHEN** `venus_tr_docs_feature_doc` 未安装
- **THEN** 技能 SHALL 记录 WARN、自行执行扫描以产出三类文档，MUST NOT 因委派不可得而终止

#### Scenario: 项目无 CodeGraph 索引时降级

- **WHEN** 目标项目未初始化 CodeGraph（`codegraph_status` 不可用或报错）
- **THEN** 技能 SHALL 记录降级说明并改用 Glob / Grep / Read 完成扫描，MUST NOT 因索引缺失而终止或降低产出（降级路径沿用既有技能套约约定）

#### Scenario: 默认安装集不变

- **WHEN** 项目未配置 `workflows` 字段并执行 `venus init`
- **THEN** 生效 workflow 集仍为 9 项（8 显式 + 1 注入 `tr-docs-requirement-doc`），MUST NOT 因本能力新增 `tr-docs-feature-doc` 注入

### Requirement: `AGENTS.md` 生成与对齐

技能 SHALL 依据扫描结果生成项目根 `AGENTS.md`（面向 AI 编码代理的仓库导航：项目是什么、仓库地图、常用命令、修改守则）。

`AGENTS.md` 已存在时 SHALL 走「已存在文档的逐份确认」与「增量对齐」同一分支（见上述两条需求），MUST NOT 有独立的覆盖策略。

#### Scenario: 零文档项目生成 AGENTS.md

- **WHEN** 项目无任何既有文档（无 `AGENTS.md` / `CLAUDE.md` / `README.md` / `docs/`）
- **THEN** 技能 SHALL 纯由扫描结果生成 `AGENTS.md`，无需询问覆盖（目标不存在）

#### Scenario: 已有 AGENTS.md 时增量对齐

- **WHEN** 项目已存在 `AGENTS.md` 且用户选择重新生成
- **THEN** 技能 SHALL 保留其中的人工域段落、按当前扫描结果重派生其余段落

### Requirement: `context` 回写

技能 SHALL 将扫描得到的技术栈与项目约定回写至 `.venus/config.yaml` 的 `context` 段（该段在模板中为"待补充"占位）。

回写 MUST 沿用既有的**逐行保留 + 段替换**策略：仅替换 `context` 段内容，文件其余部分（含注释、未知段如 `auto_package` 配置、空行）MUST 逐字保留。系统 MUST NOT 重新序列化整个 YAML 文件。

`.venus/config.yaml` 不存在时 SHALL 先创建目录与默认配置再写入指定 `context`。

回写失败 SHALL 仅记录 WARN 并继续，MUST NOT 中断流程。

#### Scenario: 回写 context 段

- **WHEN** 扫描得出技术栈（语言、框架、构建工具、包管理器、分层约定）
- **THEN** 技能 SHALL 将之写入 `.venus/config.yaml` 的 `context` 段，替换原有"待补充"占位内容

#### Scenario: 保留未知段与注释

- **WHEN** `.venus/config.yaml` 含系统不识别配置段（如 `auto_package`）与注释行
- **THEN** 回写后这些段与注释 MUST 逐字保留，MUST NOT 因回写而丢失或重排

#### Scenario: 回写失败不中断

- **WHEN** `.venus/config.yaml` 因权限或占用等原因不可写
- **THEN** 系统记录 WARN 并继续完成其余步骤，MUST NOT 中止流程

### Requirement: 技能授权面按实放行

`venus_tr_init_project` 的 `allowed-tools` 白名单 SHALL 按技能正文的**实际使用**扩展，MUST NOT 无差别补齐。

调用类条目（CodeGraph MCP、技能委派）MUST 走 `src/core/templates/tool-whitelist.ts` 的共享常量生成（`CODEGRAPH_MCP` / `skillDelegation([...])`），MUST NOT 逐模板手写；MUST NOT 使用 `Skill(*)` 一类通配形式。

指令侧白名单 SHALL 由 `getCommandTemplates()` 从配对技能单点回填，MUST NOT 另立第二份真源。

#### Scenario: 委派条目精确列举

- **WHEN** 技能正文通过 `Skill` 工具委派 `venus_tr_docs_feature_doc`
- **THEN** 白名单 SHALL 含 `Skill(tr_docs_feature_doc)` 精确条目，MUST NOT 使用星号通配

#### Scenario: 指令白名单与技能一致

- **WHEN** `tr-init.ts` 的 skill 白名单扩展后重新生成产物
- **THEN** `tr-init-project` 指令的白名单 SHALL 与其配对技能完全一致（经 `getCommandTemplates()` 单点回填）

## REMOVED Requirements

无。

## RENAMED Requirements

无。
