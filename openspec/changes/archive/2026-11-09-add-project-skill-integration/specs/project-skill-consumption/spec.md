## ADDED Requirements

### Requirement: 探索起点技能基线

`iagent_spec_explore`（delegated 模式）与 `iagent_debug` SHALL 在探索 / 排查起点、**规则基线之后**加载项目技能基线：运行 `iagent skills --json` 枚举配置条目，**按阶段筛选**后读取（探索 / 排查的设计阶段只加载 `phases` 含 `design` 或 `both` 的技能；`implement`-only 技能不进入设计约束），并把结果写入探索产物（或调试诊断记录）的 `## 项目技能基线` 段，至少包含：源路径、存在性、读取状态、**完整性状态（`ok` / `incomplete` 或 `null`）**与关键约束摘要。配置为空或全部缺失 SHALL 记「无技能配置」合法终态并继续；读取失败 SHALL 记 WARN 并计为未读，MUST NOT 伪装为已读。技能基线 MUST 在 grill 追问与功能设计之前建立。

#### Scenario: 建立技能基线

- **WHEN** 探索开始且配置声明前端与后端各一个技能
- **THEN** 探索文件 SHALL 含 `## 项目技能基线` 段，逐条列出路径、存在性与已读状态

#### Scenario: 无技能配置

- **WHEN** `.iagent/config.yaml` 无 `skills:` 段
- **THEN** 基线 SHALL 记「无技能配置」并继续探索，MUST NOT 阻断

#### Scenario: 读取失败计未读

- **WHEN** 配置声明的技能文件存在但读取抛出异常或 frontmatter 非法
- **THEN** 该条目 SHALL 记 WARN 且标为未读，MUST NOT 出现在已读集合中

### Requirement: 设计与排查以技能为约束

探索的 grill 追问、方案讨论与功能设计，以及 debug 的根因分析与修复方案，SHALL 以技能基线中 `phases` 含 `design`（或 `both`）的技能要点为约束；技能与项目规则冲突时 SHALL 显式呈现冲突（以代码事实为优先证据），MUST NOT 静默选择任一方。无可用技能时 SHALL 按既有规则与代码证据继续，MUST NOT 编造技能内容。

#### Scenario: 设计阶段加载 design 技能

- **WHEN** 技能基线含 `phases: design` 的技能且探索进入功能设计
- **THEN** 设计方案 SHALL 引用该技能的相关约定，并在制品中标注来源路径

#### Scenario: 技能与代码冲突

- **WHEN** 技能文档约定与源码事实矛盾
- **THEN** 系统 SHALL 在探索产物或确认门中显式呈现冲突，MUST NOT 静默按任一方推进

### Requirement: handoff 技能要点

`iagent_spec_propose` 的 handoff 包 `## 规范要点` SHALL 在规则源要点之外追加「技能要点」子节，逐条标注来源技能路径，供 verify / apply / archive 只读消费。技能要点 MUST NOT 替代规则源要点；无技能配置时该子节 SHALL 显式记为「无技能配置」，MUST NOT 省略或编造。

#### Scenario: 技能要点入包

- **WHEN** 探索建立了含技能的技能基线并生成 handoff 包
- **THEN** `## 规范要点` SHALL 含「技能要点」子节并逐条标注来源路径

#### Scenario: 无技能时显式记录

- **WHEN** 项目无 `skills:` 配置
- **THEN** handoff 包的技能要点子节 SHALL 写「无技能配置」，MUST NOT 留空或编造内容

### Requirement: 实现消费与回执

`iagent_spec_apply` SHALL 在实现开始前读取技能基线中 `phases` 含 `implement`（或 `both`）的技能文件，按其中规范实现，并在阶段回执中携带 `skillsRead`（实际读取的技能路径列表）。`iagent_workflow` 与 `iagent_auto_workflow` 在实现阶段 SHALL 核对被委派阶段回执的 `skillsRead` 与配置声明集合一致；回执缺该字段时 SHALL 记 WARN，MUST NOT 伪造读取记录。配置为空时 `skillsRead` 为空数组，属合法终态。

#### Scenario: 实现前读取技能

- **WHEN** 配置声明 `backend-implement` 且其文件存在，apply 开始实现
- **THEN** apply SHALL 读取该文件并在回执 `skillsRead` 中列出其路径

#### Scenario: 回执缺字段

- **WHEN** 实现阶段回执不含 `skillsRead` 字段
- **THEN** 编排 SHALL 记 WARN 并按回执缺失处理，MUST NOT 推断为已读

#### Scenario: 无配置合法终态

- **WHEN** 项目无 `skills:` 配置
- **THEN** 回执 `skillsRead` SHALL 为空数组，实现流程继续

### Requirement: skills-not-read 一致性诊断

实现一致性门 SHALL 输出 `skills-not-read` 诊断：**仅统计 `phases` 含 `implement` 或 `both` 的配置技能**——当某此类技能 `exists=true` 但 apply 回执的 `skillsRead` 未包含该路径时，判定为 `fail` 并列出缺失路径；`design`-only 技能 MUST NOT 被要求读取、MUST NOT 因其未读判 fail；配置声明但文件不存在（`exists=false`）时 SHALL 仅记 WARN，MUST NOT 判 fail；配置为空时该诊断 SHALL 为 pass。该诊断与 `rules-not-read` 按各自集合独立校验，MUST NOT 互相替代。

#### Scenario: 声明且存在但未读

- **WHEN** 配置声明 `backend-implement`（`phases: implement`）且文件存在，但 `skillsRead` 不含该路径
- **THEN** 一致性结果 SHALL 为 `fail`，诊断码 `skills-not-read`，报告列出缺失路径

#### Scenario: design-only 技能不要求读取

- **WHEN** 配置声明 `frontend-design`（`phases: design`），apply 未读取该文件
- **THEN** `skills-not-read` MUST NOT 将其计入缺失，诊断保持 pass

#### Scenario: 声明但文件缺失

- **WHEN** 配置声明某技能但全部解析路径均不存在
- **THEN** 系统 SHALL 记 WARN 并判该条 `exists=false`，MUST NOT 判 `skills-not-read` fail

#### Scenario: 与 rules-not-read 独立

- **WHEN** 某次实现未读 `coding-rules.md`（`rules-not-read`）但已读全部声明技能
- **THEN** `skills-not-read` SHALL 为 pass，两条诊断 MUST NOT 互相覆盖或合并计数

### Requirement: 技能基线与规则基线并列

`## 项目技能基线` SHALL 为探索产物中的独立并列段，MUST NOT 并入 `## 项目规则基线`；两段各自承载来源、存在性与读取状态，消费侧 MUST NOT 以一段替代另一段。既有规则基线的枚举集合（`.iagent/config.yaml` 的 context / rules、`.iagent/rules/*.md`、`CLAUDE.md`、`AGENTS.md`）MUST 保持不变，技能文件 MUST NOT 被计入规则源集合。

#### Scenario: 两段并列存在

- **WHEN** 项目同时含规则源与 `skills:` 配置
- **THEN** 探索产物 SHALL 同时含 `## 项目规则基线` 与 `## 项目技能基线`，各自独立记录

#### Scenario: 技能不计入规则源

- **WHEN** 运行 `iagent rules --json`
- **THEN** `.iagent/skills/*.md` MUST NOT 出现在规则源枚举结果中

### Requirement: 不完整技能的消费处置

探索技能基线与实现消费 SHALL 显式处理 `validation.status=incomplete` 的技能：探索基线 MUST 记 WARN 并列出缺失章节 / 占位符 / 无证据规则数，MUST NOT 把不完整技能当作完整规范静默使用；`iagent_spec_apply` 回执 SHALL 增加 `skillsIncomplete`（不完整技能路径列表）并在实现前提示补齐，MUST NOT 静默忽略。一致性诊断 SHALL 输出 `skills-incomplete` 为 **WARN**（不判 fail）——由用户决定回项目初始化重新蒸馏或手工补齐。

#### Scenario: 基线记录不完整状态

- **WHEN** 配置技能文件存在但 `validation.status=incomplete`
- **THEN** `## 项目技能基线` SHALL 记录该状态并列出缺失项，同时记 WARN

#### Scenario: apply 回执记录不完整技能

- **WHEN** apply 读取到不完整的技能文件
- **THEN** 回执 `skillsIncomplete` SHALL 列出其路径，并使 `skills-not-read` 不因「已读但不完整」判 fail

#### Scenario: 诊断仅告警

- **WHEN** 已读技能中存在 `skillsIncomplete` 条目
- **THEN** 一致性诊断 SHALL 输出 `skills-incomplete` 为 WARN，整体结果 MUST NOT 因此判 fail

### Requirement: 编排层跨阶段透传与核对

`iagent_workflow` 与 `iagent_auto_workflow` SHALL 在 Phase 1 委派探索时要求被委派阶段产出 `## 项目技能基线` 并在回执中报告其状态；在 Phase 4 实现阶段 SHALL 核对被委派回执的 `skillsRead` 与 `skillsIncomplete`。`iagent_spec_propose` SHALL 读取 exploration 的 `## 项目技能基线` 生成 handoff「技能要点」，MUST NOT 重新枚举配置；基线缺失时 SHALL 记 WARN 并枚举一次（`iagent skills --json`），MUST NOT 编造技能要点。

#### Scenario: Phase 1 透传基线状态

- **WHEN** workflow / auto-workflow 委派探索且探索产出 `## 项目技能基线`
- **THEN** 编排 SHALL 在回执/阶段结论中保留技能基线状态，供后续阶段读取

#### Scenario: Phase 4 核对实现回执

- **WHEN** 实现阶段返回回执
- **THEN** 编排 SHALL 核对 `skillsRead` / `skillsIncomplete` 是否覆盖配置声明（按阶段过滤），缺字段记 WARN

#### Scenario: propose 复用而非重枚举

- **WHEN** exploration 含 `## 项目技能基线`
- **THEN** propose MUST 直接读取该段生成技能要点，MUST NOT 再次枚举配置

#### Scenario: 基线缺失降级

- **WHEN** exploration 不含 `## 项目技能基线`（历史变更或探索未执行该检查点）
- **THEN** propose SHALL 记 WARN 并执行一次 `iagent skills --json` 枚举，MUST NOT 编造技能要点

### Requirement: debug 修复阶段消费实现技能

`iagent_debug` 的修复阶段（实现侧）SHALL 读取 `phases` 含 `implement` 或 `both` 的项目技能，并在修复回执中记录 `skillsRead` / `skillsIncomplete`；`design`-only 技能 MUST NOT 被要求读取。该阶段的 `skills-not-read` 判定 SHALL 与 apply 采用相同的阶段过滤规则。

#### Scenario: 修复前读取实现技能

- **WHEN** debug 进入修复阶段且配置声明 `backend-implement`
- **THEN** 修复 SHALL 读取该技能并在回执 `skillsRead` 中登记

#### Scenario: design-only 不进入修复约束

- **WHEN** 配置仅声明 `phases: design` 的技能
- **THEN** debug 修复阶段 MUST NOT 要求读取该技能，`skills-not-read` MUST NOT 判 fail
