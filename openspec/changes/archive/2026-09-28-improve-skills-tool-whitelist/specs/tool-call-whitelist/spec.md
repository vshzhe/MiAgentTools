## ADDED Requirements

### Requirement: 白名单组合规则

技能模板的 `allowedTools` SHALL 按「只读检索工具 + 调用类扩展 + 技能专有条目」三层组合：只读检索工具（`Read` / `Glob` / `Grep`）取自该技能正文的实际使用，调用类扩展来自正文实际使用的 MCP 工具、经 Skill 工具委派的子技能、派发的子代理，技能专有条目为既有 `Bash(...)` 与写类工具。

本次变更的**新增面仅限调用类扩展**：只读检索工具与技能专有条目 SHALL 维持各技能现状，MUST NOT 因「统一基底」而对未使用检索工具的技能无差别补齐。

白名单 MUST 覆盖正文实际会发起的调用——**未覆盖即会在 Claude Code 中被权限拦截，使技能无法执行**。清单 MUST 由正文逐条核准得出，MUST NOT 采信关键词检索命中（散文提及他技能名不构成委派）。

#### Scenario: 白名单覆盖正文全部调用类别

- **WHEN** 某技能正文既调用 CodeGraph MCP、又经 Skill 工具委派子技能
- **THEN** 该技能的 `allowedTools` 同时含 CodeGraph MCP 条目与对应子技能的 `Skill(venus_xxx)` 条目

#### Scenario: 散文提及不构成委派

- **WHEN** 某技能正文仅以散文提到另一个技能名（如「区别于 venus_tr_impl_workflow」），未经 Skill 工具委派
- **THEN** 该技能名 MUST NOT 被写入 `allowedTools`

### Requirement: CodeGraph MCP 条目双写

使用 CodeGraph 的技能（`allowedTools` 含 `Bash(codegraph:*)` 或正文引用 `codegraph_*` 工具者）SHALL 在 `allowedTools` 中同时写入**裸服务器形式** `mcp__codegraph` **与 9 个具名工具条目**（`codegraph_status` / `codegraph_files` / `codegraph_search` / `codegraph_context` / `codegraph_node` / `codegraph_callers` / `codegraph_callees` / `codegraph_impact` / `codegraph_explore`）。

双写的理由：整服务器形式（裸形式与 `mcp__codegraph__*`）存在多处「不自动放行」的失效报告，仅逐工具全名被稳定支持；双写使任一路径生效即达成免弹窗，且未来新增工具仍被裸形式覆盖。MCP 工具名与 CLI 名（`Bash(codegraph:*)`）是两套命名，后者 MUST NOT 被视为已覆盖前者。

#### Scenario: 使用 CodeGraph 的技能具备双写条目

- **WHEN** 某技能正文调用 `mcp__codegraph__codegraph_impact`
- **THEN** 其 `allowedTools` 同时含 `mcp__codegraph` 与 `mcp__codegraph__codegraph_impact`

#### Scenario: 不使用 CodeGraph 的技能不写 MCP 条目

- **WHEN** 某技能正文既不调用 CodeGraph MCP 也不引用 `codegraph_*` 工具
- **THEN** 其 `allowedTools` MUST NOT 含任何 `mcp__codegraph*` 条目

### Requirement: 技能间委派条目逐技能枚举

经 Skill 工具委派子技能的技能 SHALL 为**每一个实际委派的子技能**写入 `Skill(<技能名>)` 精确条目，技能名取本地技能名（如 `Skill(venus_spec_apply)`），MUST NOT 带 `plugin:` 命名空间前缀。

MUST NOT 使用 `Skill(*)` 一类通配写法——该写法在多个 settings 载体上被报不可靠；且通配会一次性放行全部技能，与最小权限原则相悖。

#### Scenario: 编排技能委派多子技能

- **WHEN** 某编排技能正文经 Skill 工具委派 `venus_spec_explore`、`venus_spec_propose`、`venus_spec_archive`
- **THEN** 其 `allowedTools` 含 `Skill(venus_spec_explore), Skill(venus_spec_propose), Skill(venus_spec_archive)` 三条精确条目

#### Scenario: 不使用通配条目

- **WHEN** 任意技能的 `allowedTools` 被检查
- **THEN** MUST NOT 出现 `Skill(*)` 通配条目

### Requirement: 子代理派发条目按实际派发放行

正文经子代理派发任务的技能 SHALL 写入 `Agent` 与 `Task` **两条**条目：`Task` 为派发工具的旧名、`Agent` 为现名，双写以兼容不同版本。授权面向子代理传递，故仅正文确有派发的技能可写入，MUST NOT 对同类技能整类放行。

#### Scenario: 确有派发的技能获得双写条目

- **WHEN** 某技能正文要求派发子代理执行并行任务
- **THEN** 其 `allowedTools` 同时含 `Agent` 与 `Task`

#### Scenario: 无派发的技能不获条目

- **WHEN** 某技能正文不含任何子代理派发
- **THEN** 其 `allowedTools` MUST NOT 含 `Agent` 或 `Task`

#### Scenario: 存量漂移修复

- **WHEN** 某编排技能正文已要求派发子代理但其 `allowedTools` 缺失派发条目
- **THEN** 该缺口随本变更一并补齐（正文与白名单恢复同步）

### Requirement: 指令白名单配对继承

斜杠指令的 frontmatter `allowed-tools` SHALL **派生自其配对技能模板的 `allowedTools`**，取值与配对技能一致。指令正文是技能正文的压缩派生版，白名单亦应同源派生。

生成器 MUST NOT 对指令硬编码固定白名单值，MUST NOT 使指令与配对技能的白名单出现分歧。

#### Scenario: 指令继承配对技能白名单

- **WHEN** `venus init` 生成某斜杠指令文件
- **THEN** 该文件 frontmatter 的 `allowed-tools` 与其配对技能模板的 `allowedTools` 完全一致

#### Scenario: 技能白名单变更后指令同步

- **WHEN** 某技能模板的 `allowedTools` 新增条目后重新生成指令
- **THEN** 该技能的斜杠指令白名单同步包含该新增条目，无需另行手工维护

### Requirement: 会话级权限载体非破坏合并

`venus init` 与 `venus update` SHALL 在安装产物之外，向 `.claude/settings.json` 的 `permissions.allow` **合并写入**本工具集所需的放行条目。此举为必需补充：技能与指令 frontmatter 的授权仅覆盖调用当轮，跨轮次管线需要会话级放行。

合并语义为「读取既有配置 → 并入待写条目 → 去重 → 写回」，且 MUST 满足：

- MUST NOT 删除或改写用户既有的任何 `allow` 条目
- MUST NOT 写入 `deny` 或 `ask` 段
- MUST NOT 写入 `Bash(*)` 一类全量放行条目
- 既有文件内容非法（非合法 JSON）时 MUST 保留原文件不覆盖，记 WARN 并继续安装，MUST NOT 阻断
- 操作 SHALL 幂等：重复执行不产生重复条目、不改变已合并结果

#### Scenario: 全新项目写入权限文件

- **WHEN** 目标项目无 `.claude/settings.json` 且执行 `venus init`
- **THEN** 生成含本工具集放行条目的 `permissions.allow`，其余字段结构符合 Claude Code 设置文件规范

#### Scenario: 既有配置被保留

- **WHEN** `.claude/settings.json` 已存在且含用户自定义的 `permissions.allow` 条目与 `deny` 段
- **THEN** 本工具集条目并入 `allow`，用户既有 `allow` 条目原样保留，`deny` 段不被触碰

#### Scenario: 幂等重复执行

- **WHEN** 对同一项目连续两次执行 `venus update`
- **THEN** `permissions.allow` 结果一致，不出现重复条目

#### Scenario: 既有文件非法时不覆盖

- **WHEN** `.claude/settings.json` 内容不是合法 JSON
- **THEN** 原文件字节不变，输出 WARN，技能与指令安装照常完成

#### Scenario: update 使存量项目获得新增条目

- **WHEN** 已安装旧版本的存量项目执行 `venus update`
- **THEN** 新增的白名单条目（技能 frontmatter、指令 frontmatter 与 `permissions.allow` 三处）均已刷新到位

### Requirement: 只读技能授权面不扩大

白名单同时承载语义约束：以「不含 `Write` / `Edit`」表达只读意图的技能（如 `venus_spec_verify_proposal` 的只读评分语义），其 `allowedTools` MUST 维持不含 `Write` / `Edit`；本变更 MUST NOT 扩大任何技能的写类工具或 `Bash(...)` 授权面。

本次仅补齐「调用类」条目（MCP / Skill / 子代理），不改变各技能既有的读写与命令授权。

#### Scenario: 只读技能不被扩权

- **WHEN** 某只读评分技能的 `allowedTools` 在白名单补齐后被检查
- **THEN** 仍不含 `Write` 与 `Edit`，其只读语义约束未被削弱

#### Scenario: 写类与命令授权面不变

- **WHEN** 对比任一技能白名单变更前后的条目集合
- **THEN** 原有的 `Write` / `Edit` / `Bash(...)` 条目在数量与内容上均未新增

### Requirement: 白名单不改变对话级确认门

白名单化 SHALL 只消除**工具级**权限弹窗，MUST NOT 改变任何**对话级**确认门语义。下列门 MUST 继续等待用户确认，不得因白名单生效而跳过或静默通过：

- 提示词校验门（探索前的输入澄清门）
- 功能流程图与流程最终确认门
- 实现前的设计确认门
- L1-L5 需求追问门

#### Scenario: 工具调用自动执行而确认门仍阻塞

- **WHEN** 管线在探索阶段执行 CodeGraph 查询、Grep 检索与技能间委派
- **THEN** 这些调用免弹窗连续执行，而提示词校验门与功能流程图确认门仍照常等待用户回复

#### Scenario: 自动化语义不构成跳过理由

- **WHEN** 技能处于全自动管线（auto 语义）中并抵达确认门
- **THEN** 仍须取得用户确认或走门的四条出口之一，MUST NOT 静默通过

### Requirement: 白名单与正文一致性校验

测试 SHALL 拦截关键白名单条目的缺失：每个技能 `allowedTools` 非空、使用 CodeGraph 的技能含 MCP 条目、存在委派的技能含对应 `Skill(...)` 条目、存在派发的技能含 `Agent` / `Task` 条目、生成的 SKILL.md 与指令文件的 frontmatter 白名单与模板一致。

正文命令与白名单的一致性扫描 SHALL 保留告警（不拦截）语义，避免存量历史缺口阻断无关改动。

#### Scenario: 条目缺失被测试拦截

- **WHEN** 某技能使用 CodeGraph 但 `allowedTools` 缺少 MCP 条目
- **THEN** 测试失败

#### Scenario: 生成产物白名单与模板一致

- **WHEN** 生成 SKILL.md 与斜杠指令文件
- **THEN** 两者的 frontmatter 白名单均与来源模板一致，测试可逐字节断言

#### Scenario: 正文命令扫描仅告警

- **WHEN** 某技能正文出现未列入白名单的命令
- **THEN** 输出扫描告警但不使测试失败

#### Scenario: 条目格式合法

- **WHEN** 检查任一技能 `allowedTools`、任一指令 frontmatter `allowed-tools` 以及 `permissions.allow` 的条目
- **THEN** 每条均为合法权限规则串（形如 `Tool` 或 `Tool(specifier)`），不含空条目、不含首尾空白、不含重复项——**非法条目会被运行时静默忽略而放行失效**，故 MUST 由测试断言

### Requirement: 快照与文档同步

`skills/` 静态快照 SHALL 在模板改动后重新生成，与模板保持字节级一致；逐技能列出白名单的文档（技能手册、编排指南、迁移套件指南）与 `AGENTS.md` 修改守则 SHALL 同步更新。

白名单取值来源为模板单一源，MUST NOT 手工维护快照或文档中的白名单文本。

#### Scenario: 快照漂移被测试拦截

- **WHEN** 模板白名单变更后未重新生成 `skills/` 快照
- **THEN** 快照一致性测试失败

#### Scenario: 文档白名单同步

- **WHEN** 某技能白名单发生变更
- **THEN** 该技能在技能手册与相关指南中列出的白名单同步更新
