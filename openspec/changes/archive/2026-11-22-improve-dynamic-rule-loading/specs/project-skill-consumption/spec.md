## MODIFIED Requirements

### Requirement: 探索起点技能基线

`iagent_spec_explore`（delegated 模式）与 `iagent_debug` SHALL 在探索 / 排查起点、**规则基线之后**加载项目技能基线：运行 `iagent skills --json --phase <design|implement>` 枚举并按阶段筛选后读取（探索 / 排查的设计阶段只加载 `phases` 含 `design` 或 `both` 的技能；`implement`-only 技能不进入设计约束），并把结果写入探索产物（或调试诊断记录）的 `## 项目技能基线` 段，至少包含：源路径、存在性、读取状态、**完整性状态（`ok` / `incomplete` 或 `null`）**与关键约束摘要。配置为空或全部缺失 SHALL 记「无技能配置」合法终态并继续；读取失败 SHALL 记 WARN 并计为未读，MUST NOT 伪装为已读。技能基线 MUST 在 grill 追问与功能设计之前建立。

**范围筛选（新增）**：当变更范围可判定（如探索已明确前端 / 后端侧重）时，MAY 追加 `--scope <backend|frontend>` 收窄技能集合；未判定时 MUST NOT 传该参数（MUST NOT 猜范围）。`scope: null` 的存量技能 MUST NOT 因范围筛选被排除。

#### Scenario: 建立技能基线

- **WHEN** 探索开始且配置声明前端与后端各一个技能
- **THEN** 探索文件 SHALL 含 `## 项目技能基线` 段，逐条列出路径、存在性与已读状态

#### Scenario: 无技能配置

- **WHEN** `.iagent/config.yaml` 无 `skills:` 段
- **THEN** 基线 SHALL 记「无技能配置」并继续探索，MUST NOT 阻断

#### Scenario: 读取失败计未读

- **WHEN** 配置声明的技能文件存在但读取抛出异常或 frontmatter 非法
- **THEN** 该条目 SHALL 记 WARN 且标为未读，MUST NOT 出现在已读集合中

#### Scenario: 范围可判定时收窄

- **WHEN** 探索已明确本次变更仅涉后端
- **THEN** 技能基线 MAY 以 `--scope backend` 收窄，结果不含 `scope: frontend` 条目
- **AND** `scope: null` 的存量条目 SHALL 保留

### Requirement: 实现消费与回执

`iagent_spec_apply` SHALL 在实现开始前读取技能基线中 `phases` 含 `implement`（或 `both`）的技能文件，按其中规范实现，并在阶段回执中携带 `skillsRead`（实际读取的技能路径列表）与 `skillsSkipped`（声明为不需要读的技能路径列表，含理由）。`iagent_workflow` 与 `iagent_auto_workflow` 在实现阶段 SHALL 核对被委派阶段回执的 `skillsRead` 与「`phases` 含 implement/both 且 `exists=true`」的声明集合一致；回执缺该字段时 SHALL 记 WARN，MUST NOT 伪造读取记录。`skillsSkipped` 声明的技能 MUST NOT 触发 `skills-not-read`。配置为空时 `skillsRead` 为空数组，属合法终态。

#### Scenario: 实现前读取技能

- **WHEN** 配置声明 `phases: implement` 的技能且 apply 开始
- **THEN** 回执 SHALL 含 `skillsRead` 列出该技能路径

#### Scenario: 声明跳过不判失败

- **WHEN** 某 implement 技能列入 `skillsSkipped` 并给出理由
- **THEN** 一致性门 MUST NOT 因该技能报 `skills-not-read`
