## MODIFIED Requirements

### Requirement: 技能间委派条目逐技能枚举

经 Skill 工具委派子技能的技能 SHALL 为**每一个实际委派的子技能**写入一条精确条目 `Skill(iagent-<workflowId>)`（如 `Skill(iagent-spec-apply)`），其取值 MUST 与生成期的宿主技能 ID（技能目录名与 SKILL.md frontmatter `name`，即 `deriveSkillId` 的结果）逐字一致。

条目 MUST 经 `skillDelegation([...])` 共享常量构造：入参为该子技能的裸名（`spec_apply` 与 `spec-apply` 两种写法 SHALL 等价），函数内部统一归一化为 `iagent-<kebab>`；模板 MUST NOT 手写 `Skill(...)` 字面量。

MUST NOT 产出裸名条目（`Skill(spec_apply)`）——宿主按完整技能名匹配授权，裸名条目永不放行（宿主「始终允许」落盘记录为完整技能名，属既有实证）；MUST NOT 双写裸名与 canonical 两种形态（授权面翻倍且残留死条目）；MUST NOT 使用 `Skill(*)` 通配；MUST NOT 带 `plugin:` 命名空间前缀。

#### Scenario: 编排技能委派多子技能

- **WHEN** 某编排技能正文经 Skill 工具委派 `iagent_spec_explore`、`iagent_spec_propose`、`iagent_spec_archive`
- **THEN** 其 `allowedTools` 含 `Skill(iagent-spec-explore), Skill(iagent-spec-propose), Skill(iagent-spec-archive)` 三条 canonical 条目

#### Scenario: 不使用通配条目

- **WHEN** 任意技能的 `allowedTools` 被检查
- **THEN** MUST NOT 出现 `Skill(*)` 通配条目

#### Scenario: 不产出裸名条目

- **WHEN** 检查任一技能 `allowedTools` 中的全部 `Skill(...)` 条目
- **THEN** 每个条目的名称 MUST 以 `iagent-` 前缀开头，且为小写 kebab-case；MUST NOT 存在不带前缀的裸名条目

#### Scenario: 入参写法不影响输出形态

- **WHEN** 分别以 `spec_apply` 与 `spec-apply` 调用 `skillDelegation([...])`
- **THEN** 两者输出均为 `Skill(iagent-spec-apply)`，不出现下划线形态

### Requirement: 调用类白名单条目 SHALL 经共享常量构造

含"调用类"白名单条目（CodeGraph MCP、CodeGraph CLI、技能委派 `Skill(...)`、子代理派发 `Agent`/`Task`）的技能模板 MUST 经 `src/core/templates/tool-whitelist.ts` 的共享常量构造其 `allowedTools`——CodeGraph MCP 条目经 `${CODEGRAPH_MCP}`、CodeGraph CLI 条目经 `${CODEGRAPH_CLI}`、技能委派条目经 `${skillDelegation([...])}`、派发条目经 `${SUBAGENT_DISPATCH}`；MUST NOT 逐个模板手写字面量，MUST NOT 在模板中另立第二份「裸名 → canonical」派生逻辑。

测试 MUST 断言：任一含 CodeGraph MCP 条目的技能，其 `allowedTools` 包含 `CODEGRAPH_MCP` 常量值；任一含 CodeGraph CLI 调用的技能包含 `CODEGRAPH_CLI` 常量值；任一含派发条目的技能包含 `SUBAGENT_DISPATCH` 常量值；任一含委派条目的技能的 `Skill(...)` 条目均可由 `skillDelegation(...)` 常量产出。该强制 MUST NOT 改变授权面（只统一来源，MUST NOT 新增未使用的条目）。

#### Scenario: 编排技能白名单经共享常量构造

- **WHEN** 检查 `iagent_workflow` / `iagent_auto_workflow` / `iagent_debug` 的 `allowedTools`
- **THEN** 其 CodeGraph MCP 条目 SHALL 由 `${CODEGRAPH_MCP}` 产出、技能委派条目 SHALL 由 `${skillDelegation([...])}` 产出、派发条目 SHALL 由 `${SUBAGENT_DISPATCH}` 产出，MUST NOT 为手写字面量

#### Scenario: CodeGraph CLI 条目由常量产出

- **WHEN** 检查任一正文含 `codegraph` CLI 调用的技能
- **THEN** 其 CLI 条目 SHALL 由 `${CODEGRAPH_CLI}` 产出，MUST NOT 为手写字面量

#### Scenario: 常量变更自动跟随

- **WHEN** `tool-whitelist.ts` 的 `CODEGRAPH_MCP`、`CODEGRAPH_CLI` 或 `skillDelegation()` 的派生规则变更
- **THEN** 所有引用该常量的技能白名单 SHALL 在下次生成时自动包含新取值，无需逐模板手工同步

#### Scenario: 授权面不因来源统一而扩大

- **WHEN** 将手写字面量改为共享常量
- **THEN** 改前改后的 `allowedTools` 值 SHALL 逐条等价（仅来源统一），MUST NOT 新增任何原本不存在的条目；测试断言改后值等于共享常量构造结果

### Requirement: 归档技能的需求文档委派条目

归档类技能（`iagent_spec_archive` / `iagent_spec_bulk_archive`）的 `allowedTools` SHALL 覆盖其**预归档需求文档生成检查点**的实际调用面：两者正文均经 Skill 工具非交互委派 `iagent_requirement_doc`（缺失且状态为 `absent` 的兼容分支）与就地增量对齐（已存在分支，不调用技能），故两者的 `allowedTools` MUST 含精确条目 `Skill(iagent-requirement-doc)`（**canonical 宿主技能 ID**，由 `skillDelegation(['requirement_doc'])` 产出），MUST NOT 使用 `Skill(*)` 通配。

**嵌套委派的权限归属**：编排技能（如 `iagent_workflow`）经 Skill 工具委派归档技能、归档技能再委派需求文档技能时，**内层委派的放行归属会话级权限载体**——`permissions.allow` 由 `iagent_spec_archive` 自身的白名单聚合而来（`buildPermissionEntries` 接收全部已安装技能的 `allowedTools`），故外层编排技能的 `allowedTools` MUST NOT 为其非本轮实际委派的技能写入条目。

配套约束：归档技能正文新增委派后，其**配对斜杠指令**的 `allowed-tools` MUST 经既有派生链继承同一取值（`spec-*.ts` 走 `deriveCommandContent` 派生；MUST NOT 手工维护指令侧白名单），且正文 ↔ 白名单一致性测试 SHALL 覆盖该新增委派。

#### Scenario: spec-archive 具备需求文档委派条目

- **WHEN** 检查 `iagent_spec_archive` 的 `allowedTools`
- **THEN** 含 `Skill(iagent-requirement-doc)`（canonical），与其预归档需求文档检查点（`absent` 缺失分支委派该技能）一致

#### Scenario: spec-bulk-archive 具备需求文档委派条目

- **WHEN** 检查 `iagent_spec_bulk_archive` 的 `allowedTools`
- **THEN** 含 `Skill(iagent-requirement-doc)`（canonical），与其 a.6 需求文档检查点的 `absent` 缺失分支一致

#### Scenario: 指令侧白名单同步派生

- **WHEN** 重新生成 `iagent_spec_archive` / `iagent_spec_bulk_archive` 的配对斜杠指令
- **THEN** 其 frontmatter `allowed-tools` 与配对技能模板的 `allowedTools` 完全一致（含新增的 `Skill(iagent-requirement-doc)` 条目），无需手工维护指令侧

#### Scenario: 嵌套委派不使外层白名单虚增

- **WHEN** `iagent_workflow` 的 `allowedTools` 在其 Phase 5 委派 `iagent_spec_archive`（后者将再委派需求文档技能）后被检查
- **THEN** `iagent_workflow` MUST NOT 因该嵌套链路额外写入 `Skill(iagent-requirement-doc)`（其条目仅来自 workflow 本轮 Phase 3 文档桥生成分支的实际委派）；内层委派由会话级 `permissions.allow` 放行

#### Scenario: 未使用条目被剔除

- **WHEN** 某编排技能正文不再委派某技能（如 `iagent_migration` 不委派 `requirement-doc`）
- **THEN** 其 `allowedTools` MUST NOT 继续保留该技能的 `Skill(...)` 条目（最小权限；条目存在但正文不调用属授权面虚增）

### Requirement: debug 文档与回归测试委派授权齐备

当 `iagent_debug` 正文委派需求文档或回归测试技能时，其 `allowedTools` SHALL 使用共享 `skillDelegation([...])` 为 `requirement_doc` 与 `test` 添加精确 canonical 条目（`Skill(iagent-requirement-doc)` / `Skill(iagent-test)`）；MUST NOT 使用 `Skill(*)`、裸名条目或带 `iagent_` 下划线形态的死条目，MUST NOT 把 Claude 专属委派语法作为跨宿主唯一机制。新增委派还 SHALL 同步宿主委派清单（派生自模板，见 host-orchestration 能力）及对应一致性测试；不改变既有写类工具或 Bash 授权面。

debug 实际使用的 `spec_verify_proposal`、`proposal_review`、`requirement_doc` 与条件 `test` 委派必须与生成的宿主能力声明一致。`iagent_test` 负责测试生成规则；debug 的授权仅允许按其正文中的真实委派使用测试技能，不得因正文只提及技能名而扩展授权。

#### Scenario: debug 正文真实委派获得精确条目

- **WHEN** `iagent_debug` 正文在验证后调用 `iagent_requirement_doc`，并在修复阶段条件调用 `iagent_test`
- **THEN** `allowedTools` 包含 `Skill(iagent-requirement-doc)` 与 `Skill(iagent-test)`，由 `skillDelegation(['requirement_doc', 'test'])` 等共享常量形式生成

#### Scenario: debug 授权与宿主委派表一致

- **WHEN** 生成 Claude、OpenCode V2 或 Pi 的 debug 宿主产物
- **THEN** 所需子技能均出现在相应宿主的授权/委派能力中（委派清单派生自模板 `Skill(...)` 条目），严格能力缺失时按既有策略阻断；不得依靠共享正文绕过宿主权限

#### Scenario: 最小权限保持

- **WHEN** 更新 debug 的需求文档与测试委派授权
- **THEN** 不新增 `Skill(*)`、不新增无真实正文调用的技能条目、不扩大 `Write` / `Edit` / `Bash(...)` 授权面

## ADDED Requirements

### Requirement: 白名单形态的回归锁与文档同步

白名单形态由 `Skill(<裸名>)` 收敛为 `Skill(iagent-<workflowId>)` 后，回归锁 SHALL 断言 canonical 形态：解析 `Skill(...)` 条目的正则 MUST 容纳 kebab-case 名称，注册校验 MUST 以 `iagent-<workflowId>` 为对照，MUST NOT 继续以「`Skill(X)` ↔ 注册技能 `iagent_X`」的裸名假设校验。

同步义务：
- `AGENTS.md` 修改守则中的技能委派规则、`openspec/CONTEXT.md` 的「工具调用白名单」术语、`docs/skills-manual.md` 与 `docs/migration-guide.md` 中列出白名单或委派形态的段落 SHALL 使用 canonical 形态；
- 既有能力记忆中「裸名才是真实条目」的结论（`openspec/specs/tool-call-whitelist/explorations.md` 的 D5）SHALL 标注「已过时（由本变更取代）」并保留历史，MUST NOT 删除；
- `skills/` 快照 MUST 经 `pnpm build && pnpm generate:skills` 重生成，MUST NOT 手工编辑。
- `docs/host-permission-verification.md`（新建，D6 验收载体）SHALL 记录每次手工验证的**权限姿态**（Claude `default` / `acceptEdits` / `plan` / `bypassPermissions`，或 CLI 等价姿态）、`settings.local.json` 落盘规则名与判定准则；`bypassPermissions`（或等价全放行姿态）下的「未弹窗」MUST NOT 作为通过证据，MUST 以非 bypass 姿态重跑后才可判定；存量项目中残留的旧裸名条目 SHALL 记录为「死条目、无放行作用」，MUST NOT 作为缺陷未修复的证据。

#### Scenario: 回归锁容纳 canonical 形态

- **WHEN** 运行白名单相关测试（`allowed-tools` / `command-reference-refs` / `template-consistency` / `tool-whitelist-constants`）
- **THEN** 测试 SHALL 正确解析 `Skill(iagent-spec-apply)` 形态并对照注册技能集合；对裸名条目 SHALL 判为失败

#### Scenario: 文档与守则同步 canonical 形态

- **WHEN** 检查 `AGENTS.md`、`openspec/CONTEXT.md` 与技能手册中描述技能委派条目的段落
- **THEN** MUST NOT 再声称「裸名才是真实条目」；canonical 形态与派生规则 SHALL 被明确写出

#### Scenario: 旧记忆标注已过时

- **WHEN** 读取 `openspec/specs/tool-call-whitelist/explorations.md` 的 D5 结论
- **THEN** 该结论 SHALL 带「已过时（由本变更取代）」标注且历史内容保留

#### Scenario: 手工验证不被权限姿态掩盖

- **WHEN** 按 `docs/host-permission-verification.md` 在 Claude UI 与 CLI 各执行一次技能间委派
- **THEN** 清单 SHALL 记录当次权限姿态与 `settings.local.json` 新增规则形态
- **AND** 处于 `bypassPermissions`（或等价全放行姿态）时的「无弹窗」MUST NOT 被记为通过证据
