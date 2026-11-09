## ADDED Requirements

### Requirement: 项目技能配置段

系统 SHALL 支持 `.iagent/config.yaml` 的 `skills:` 段声明项目技能：按 `frontend` / `backend` 两个角色分组，组内为裸名列表（`- <name>`）。`skills:` 段缺失 SHALL 视为合法空集，MUST NOT 报错或阻断任何流程。解析 MUST 只读取该段，MUST NOT 重新序列化整个 YAML —— 注释、空行与未知段 MUST 逐字保留。

#### Scenario: 解析分组条目

- **WHEN** `config.yaml` 含 `skills: frontend: [frontend-design]` 与 `backend: [backend-design]`
- **THEN** 解析结果 SHALL 给出两个角色组及各自条目，顺序与文件一致

#### Scenario: 无 skills 段为空集

- **WHEN** `config.yaml` 不含 `skills:` 段
- **THEN** 解析结果为空集，`iagent skills --json` 正常返回空集合且退出码为 0，MUST NOT 阻断探索或实现流程

#### Scenario: 注释与未知段保留

- **WHEN** `config.yaml` 含注释行、空行与未知配置段，且执行技能注册回写
- **THEN** 回写后注释、空行与未知段 MUST 逐字保留，仅 `skills:` 段被替换

### Requirement: 项目技能文件载体与 frontmatter

项目技能 SHALL 以 Markdown 文档承载，默认路径 `.iagent/skills/<name>.md`。文件 frontmatter SHALL 支持 `phases`（`design` / `implement` / `both`，缺省 `both`）与可选 `scope`（`frontend` / `backend` / `both`，缺省取配置分组）、`frameworks`（框架名列表）与 `source`（`distilled` / `user`；蒸馏产物 MUST 写 `distilled`）。frontmatter `name` SHALL 等于文件名主干（`<name>`）且与 `skills:` 条目名一致；不一致 SHALL 记 WARN 并把该条目判为 `incomplete`（`nameMismatch=true`），MUST NOT 按配置名猜测加载。frontmatter 缺失或非法时 SHALL 记 WARN 并计为不可读，MUST NOT 猜测其阶段或角色。

#### Scenario: 读取有效技能文件

- **WHEN** `.iagent/skills/frontend-design.md` 存在且 frontmatter 声明 `phases: both` / `scope: frontend` / `frameworks: [jsp, vue]`
- **THEN** 枚举结果 SHALL 返回该文件的路径、字节数、`sha256` 前 12 位与上述元数据

#### Scenario: frontmatter 非法

- **WHEN** 技能文件存在但 frontmatter 缺 `phases` 且包含非法取值
- **THEN** 系统 SHALL 记 WARN 并把该文件计为未读，MUST NOT 以默认阶段静默加载

#### Scenario: 名称与文件名不一致

- **WHEN** 配置条目为 `frontend-design`，但 `.iagent/skills/frontend-design.md` 的 frontmatter `name` 为 `frontend-design-v2`
- **THEN** 该条目 SHALL 判为 `incomplete`（`nameMismatch=true`）并记 WARN，MUST NOT 按配置名加载该文件

### Requirement: 路径解析与宿主目录回退

路径解析 SHALL 按固定顺序：① `.iagent/skills/<name>.md`；② 未命中时按生效 `tools` 顺序在宿主 `<tool.skillsDir>/skills/<name>/SKILL.md` 查找同名 skill。`.iagent` 命中时 MUST 优先采用，MUST NOT 与宿主同名文件合并内容；发现同名冲突 SHALL 记 WARN。全部未命中 SHALL 返回 `exists=false` 并记 WARN，MUST NOT 判为一致性失败。

#### Scenario: .iagent 命中优先

- **WHEN** 配置声明 `frontend-design`，`.iagent/skills/frontend-design.md` 与 `.claude/skills/frontend-design/SKILL.md` 同时存在
- **THEN** 解析结果 SHALL 指向 `.iagent/skills/frontend-design.md`，并在发现内容差异时记 WARN

#### Scenario: 回退宿主目录

- **WHEN** `.iagent/skills/<name>.md` 不存在，但 `.claude/skills/<name>/SKILL.md` 存在
- **THEN** 解析结果 SHALL 指向宿主文件，并按 `tools` 顺序选择首个命中项

#### Scenario: 全部未命中

- **WHEN** `.iagent` 与全部生效宿主目录均无该技能
- **THEN** 枚举结果 SHALL 返回 `exists=false` 并记 WARN，流程继续

#### Scenario: 跨宿主回退顺序一致

- **WHEN** 项目同时生效 claude / pi / opencode 三个工具，且 `.iagent` 未命中
- **THEN** 回退查找 SHALL 按生效 `tools` 列表顺序依次尝试各宿主技能目录，MUST NOT 写入任何宿主专属语义或按宿主分叉技能内容

### Requirement: iagent skills 枚举命令

系统 SHALL 提供只读命令 `iagent skills --json`（及文本模式），枚举 `skills:` 配置条目并输出：角色组、条目名、解析路径、`exists`、`bytes`、`lines`、`sha256`（前 12 位，不存在为 `null`）与 frontmatter 元数据。命令 MUST NOT 修改任何文件，MUST NOT 执行技能文件中的内容；无配置或全部缺失时 SHALL 以退出码 0 返回空集合或 `exists=false` 条目。

#### Scenario: JSON 输出

- **WHEN** 运行 `iagent skills --json` 且配置含两个条目
- **THEN** 输出 SHALL 为结构化 JSON，逐条含路径、存在性、字节数、行数、`sha256` 与 frontmatter 元数据

#### Scenario: 无配置返回空集合

- **WHEN** `config.yaml` 无 `skills:` 段
- **THEN** 命令 SHALL 输出空集合并以 0 退出，MUST NOT 报错

#### Scenario: 命令只读

- **WHEN** 运行 `iagent skills --json`
- **THEN** 命令 MUST NOT 写入、移动或删除任何文件，MUST NOT 执行技能文件中的命令

### Requirement: 技能完整性校验输出

`iagent skills --json` SHALL 对每个 `exists=true` 的条目输出 `validation` 对象：`status`（`ok` / `incomplete`）、`missingSections`、`emptySections`、`placeholders`、`ruleLinesWithoutEvidence`（数值）、`nameMismatch`（布尔）。`status` SHALL 为 `ok` 仅当：frontmatter `name` 与文件名/配置名一致、必需章节齐全、无空章节、无占位符且规则行均带证据锚点。**必需章节按 `phases` 计算**：`both` → 全部 7 个章节；`design` → 6 个章节（`## 实现规范` 可写「不适用 + 探测依据」，否则计缺失）；`implement` → 6 个章节（`## 设计规范` 同上）。校验 MUST NOT 修改或修复文件，仅报告。

#### Scenario: 完整技能

- **WHEN** 技能文件含全部必需章节、无占位符且规则行均带证据锚点
- **THEN** `validation.status` SHALL 为 `ok`，各缺失数组为空、`ruleLinesWithoutEvidence` 为 0

#### Scenario: 缺章节

- **WHEN** 技能文件缺少 `## 实现规范` 且未在「不适用项」给出依据
- **THEN** `validation.status` SHALL 为 `incomplete`，`missingSections` 含该章节名

#### Scenario: 含占位符

- **WHEN** 技能文件含 `[待补充]` 或 `TODO`
- **THEN** `validation.status` SHALL 为 `incomplete`，`placeholders` 含命中文本

#### Scenario: 不存在条目

- **WHEN** 配置声明的技能解析为 `exists=false`
- **THEN** 该条目的 `validation` SHALL 为 `null`，MUST NOT 伪造成 `ok`

#### Scenario: 分阶段章节要求

- **WHEN** 拆分产物 `frontend-design.md`（`phases: design`）在 `## 实现规范` 写「不适用 + 探测依据」
- **THEN** `validation.status` SHALL 为 `ok`；若该章节既无内容也无「不适用」依据，则 SHALL 为 `incomplete`
