## ADDED Requirements

### Requirement: 技能蒸馏步骤与触发顺序

`iagent_project_init` SHALL 新增「技能蒸馏」步骤，作为项目信息产出流程的**最后一步**执行，固定顺序为：五类 `docs/project/` 文档 → `AGENTS.md` → `context` 回写 → 规则蒸馏 → **技能蒸馏**。该步骤 SHALL 为非阻断：扫描、判定或写入任一步失败 MUST 记 WARN 并继续，MUST NOT 中断初始化流程、MUST NOT 使流程以失败收场。该步骤 MUST NOT 需要新增工具授权或技能委派。

#### Scenario: 在规则蒸馏之后触发

- **WHEN** 技能已完成五类文档落盘、`AGENTS.md` 处理、`context` 回写与规则蒸馏
- **THEN** 技能 SHALL 执行技能蒸馏步骤并产出对应技能文档（存在证据时）

#### Scenario: 写入失败不阻断

- **WHEN** `.iagent/skills/` 目录不可写导致技能文件写入失败
- **THEN** 技能 SHALL 记 WARN 并完成其余初始化步骤，MUST NOT 使初始化失败

### Requirement: 框架证据判定与单侧缺失

技能蒸馏 SHALL 依据扫描基线 `signals` / `candidates`、五类项目知识文档与源码实际使用证据判定前端与后端框架；依赖或 jar 的存在只作候选线索，MUST NOT 据此断言「项目使用该框架」。某一侧（前端或后端）无充分证据时 MUST NOT 生成该侧技能，MUST NOT 生成占位空壳文档。证据不足的维度 SHALL 按零猜测规则补扫（Glob / Grep / Read），补扫后仍不足则不写该侧。

#### Scenario: 候选依赖不产生技能

- **WHEN** 依赖清单含某前端框架，但源码中该框架实际使用证据为零或极少
- **THEN** 技能蒸馏 MUST NOT 生成该框架对应的项目技能，仅可在报告中记为候选线索

#### Scenario: 纯后端项目

- **WHEN** 项目无任何前端页面、前端框架或前端构建配置
- **THEN** 蒸馏 SHALL 只生成后端侧技能，MUST NOT 生成 `frontend-design.md`

### Requirement: 产物形态与复杂度拆分

默认 SHALL 每侧生成一份技能文档：`.iagent/skills/frontend-design.md` 与 `.iagent/skills/backend-design.md`，每份含「设计要点」与「实现规范」两段，frontmatter `phases: both`。满足任一复杂度判据时 SHALL 拆分为 `<side>-design.md`（`phases: design`）与 `<side>-implement.md`（`phases: implement`）：同侧 ≥2 个框架；后端 ≥3 个分层或模块族；设计要点或实现规范任一段超过约 150 行。拆分判据与结论 MUST 记入初始化报告。同侧存在多个框架但未拆分时，SHALL 在同一文档内按框架分节，并在 frontmatter 的 `frameworks` 列表逐项列出。

#### Scenario: 默认单文档

- **WHEN** 前端仅使用一个框架且证据内容不复杂
- **THEN** 蒸馏 SHALL 生成单个 `frontend-design.md`，内含设计与实现两段，`phases: both`

#### Scenario: 复杂时拆分

- **WHEN** 后端存在 ≥3 个分层族，或实现规范段超过约 150 行
- **THEN** 蒸馏 SHALL 拆分为 `backend-design.md` 与 `backend-implement.md`，阶段分别为 `design` / `implement`，并在报告中记录拆分判据

#### Scenario: 多框架同文档分节

- **WHEN** 同侧存在两个前端框架且不满足拆分判据
- **THEN** 单份技能文档 SHALL 按框架分节，frontmatter `frameworks` 列出全部框架名

### Requirement: 已存在确认与人工域保护

写入任何技能文档之前 SHALL 检测目标是否存在。已存在时 MUST 逐份呈现并取得选择：「确认重新生成」/「修改」/「跳过」；选择「跳过」时该文件 MUST 逐字保持不变。选择重新生成时 SHALL 执行增量对齐：`<!-- 人工域:开始 -->` 与 `<!-- 人工域:结束 -->` 区间内内容逐字保留，区间外内容按本次蒸馏结果重派生；标记破损时 SHALL 取保留侧并记 WARN。全部跳过时流程 SHALL 正常结束。

#### Scenario: 逐份确认

- **WHEN** `backend-design.md` 已存在且蒸馏有新结果
- **THEN** 技能 SHALL 逐份呈现该文件并取得确认后才写入，MUST NOT 静默覆盖

#### Scenario: 人工域逐字保留

- **WHEN** 已存在的技能文件含人工域标记区间且用户选择重新生成
- **THEN** 区间内内容 MUST 逐字保留，区间外内容按本次结果重派生

#### Scenario: 全部跳过

- **WHEN** 用户对全部已存在技能文档选择「跳过」
- **THEN** 流程 SHALL 正常结束，MUST NOT 视为失败

### Requirement: 蒸馏产物自动注册

技能文档生成成功后 SHALL 自动注册到 `.iagent/config.yaml` 的 `skills:` 段：按角色写入对应分组，已存在的同名条目 MUST NOT 重复追加（幂等）。注册写入 MUST 采用段替换并保留其余行逐字不变；注册失败 SHALL 记 WARN 并继续，MUST NOT 回滚已生成的技能文件。

#### Scenario: 自动注册

- **WHEN** 蒸馏生成 `frontend-design.md` 且 `skills:` 段尚未包含 `frontend-design`
- **THEN** 配置 SHALL 在 `frontend` 分组追加该条目，其余配置行逐字保留

#### Scenario: 幂等

- **WHEN** 重复执行项目初始化且 `skills:` 已含同名条目
- **THEN** 配置 MUST NOT 产生重复条目或改动其余行

#### Scenario: 注册失败不回滚

- **WHEN** 技能文件写入成功但 `config.yaml` 回写失败
- **THEN** 系统 SHALL 记 WARN 并保留已生成文件，MUST NOT 删除技能文档

### Requirement: 蒸馏安全边界

技能蒸馏产出 MUST NOT 写入任何凭据值（口令、密钥、令牌、连接串口令段）或可利用的绕过细节；只记录约定、结构与配置**键名**。该约束与既有项目初始化安全扫描禁令一致。

#### Scenario: 配置文件含凭据

- **WHEN** 项目配置文件含 `PASSWORD` / `SECRET` 一类键
- **THEN** 技能文档 MUST NOT 记录其取值，只可记录键名与所在文件

### Requirement: 技能内容完整性自检门

技能蒸馏在写入任何技能文档**之前** SHALL 执行完整性自检（C1-C6），全部通过后才可写入：

- **C1 frontmatter 必填**：`name` / `description` / `phases` / `scope` / `source`（`source: distilled`）；
- **C2 必需章节齐全**：`## 框架与版本` / `## 目录与分层` / `## 设计规范` / `## 实现规范` / `## 约定与禁止项` / `## 证据索引` / `## 不适用项`；某章节在项目中无对应内容时 SHALL 在该章节写「不适用 + 探测依据」，MUST NOT 删除章节或留空。**拆分产物按 `phases` 计算必需章节**：`both` 文件需全部 7 个；`phases: design` 文件可将 `## 实现规范` 标为「不适用 + 依据」；`phases: implement` 文件可将 `## 设计规范` 标为「不适用 + 依据」；
- **C3 规则可追溯**：每条规则行 MUST 带证据锚点（`文件:行`、`类.方法` 或 `docs/project/...` 章节），无证据的规则行 MUST NOT 写入；
- **C4 无占位符**：MUST NOT 含空章节与占位符（`[待补充]` / `TODO` / `TBD` / `<...>`）；
- **C5 与规则不冲突**：与 `.iagent/rules/*.md` 冲突时以代码事实为准并记 WARN，冲突项 MUST 在 `## 证据索引` 标注；
- **C6 篇幅预算**：单文件超过约 300 行时 SHALL 按 D7 判据拆分或把明细下沉，MUST NOT 写入超长且无结构的文件。

自检未通过时 MUST 先补齐或修订；无法补齐时 MUST NOT 写入该侧文档，SHALL 记 WARN 并在报告中列出缺失章节、缺失证据与不适用判定依据。MUST NOT 写入不完整的技能文档（禁止「生成后才发现规则缺失」）。

#### Scenario: 完整通过写入

- **WHEN** 六项自检全部通过
- **THEN** 技能文档 SHALL 写入 `.iagent/skills/`，并在报告中记录 C1-C6 全部通过

#### Scenario: 缺章节可补齐

- **WHEN** 自检发现缺少 `## 设计规范` 且项目存在可补的设计证据
- **THEN** 技能 SHALL 补齐该章节与其证据锚点后重新自检，通过后写入

#### Scenario: 无法补齐不写入

- **WHEN** 某必需章节在项目中无对应内容且无法给出「不适用 + 探测依据」
- **THEN** 技能 MUST NOT 写入该侧文档，记 WARN 并在报告中列出缺失项与原因

#### Scenario: 占位符阻断

- **WHEN** 自检发现 `[待补充]` / `TODO` / `<...>` 一类占位符
- **THEN** 该文档 MUST NOT 写入，记 WARN 并要求先补齐真实内容

#### Scenario: 规则无证据不写入

- **WHEN** 某条拟写入规则无法给出 `文件:行` / 类.方法 / docs 章节锚点
- **THEN** 该规则行 MUST NOT 进入技能文档，仅在报告中列为「证据不足、未写入」

#### Scenario: 与既有规则冲突

- **WHEN** 蒸馏规则与 `.iagent/rules/coding-rules.md` 的同义规则相反
- **THEN** 技能 SHALL 以代码事实为准并记 WARN，冲突项在 `## 证据索引` 标注来源与取舍

#### Scenario: 超长拆分

- **WHEN** 单份技能文档草稿超过约 300 行
- **THEN** 技能 SHALL 按 D7 判据拆分为设计 / 实现两份或下沉明细，MUST NOT 写入超长无结构文件

#### Scenario: 拆分产物各自通过自检

- **WHEN** 蒸馏拆分为 `frontend-design.md`（`phases: design`）与 `frontend-implement.md`（`phases: implement`）
- **THEN** 两份文件 SHALL 各自通过 C1-C6（阶段专属章节可标「不适用 + 依据」），且 frontmatter `name` 分别等于各自文件名主干

### Requirement: 蒸馏报告完整性摘要

`iagent_project_init` 的技能蒸馏报告 SHALL 逐侧给出：生成文件路径、自检结论（C1-C6 逐项）、不适用项及探测依据、与既有规则的冲突项；未生成的一侧 SHALL 说明原因（证据不足）。MUST NOT 只报告「已生成」而省略完整性结论。

#### Scenario: 报告含自检结论

- **WHEN** 蒸馏完成并写入前端与后端技能文档
- **THEN** 报告 SHALL 逐侧列出 C1-C6 自检结论与不适用项依据

#### Scenario: 未生成侧说明原因

- **WHEN** 某侧因证据不足未生成
- **THEN** 报告 SHALL 写明该侧未生成及证据不足的具体维度，MUST NOT 静默省略
