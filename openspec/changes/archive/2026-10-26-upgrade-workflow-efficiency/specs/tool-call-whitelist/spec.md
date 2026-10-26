# tool-call-whitelist 增量规格

## ADDED Requirements

### Requirement: CodeGraph CLI 条目单一源

白名单的**CLI 形态** CodeGraph 条目标识 SHALL 由 `src/core/templates/tool-whitelist.ts` 的共享常量 `CODEGRAPH_CLI`（值 `Bash(codegraph:*)`）产出，供正文确实经 Bash 运行 `codegraph` 子命令（`status` / `unlock` / 条件 `sync` / `explore` 等）的技能引用：`iagent_spec_archive`、`iagent_spec_bulk_archive`、`iagent_spec_explore`、`iagent_debug`、`iagent_project_init`。

约束：

- **两套命名互不覆盖**：`Bash(codegraph:*)` 与 `mcp__codegraph*` 是不同工具的权限条目，使用 CLI 的技能 MUST 同时具备 CLI 条目；已有 MCP 条目的技能 MUST NOT 因新增 CLI 条目而删除 MCP 条目。
- **正文与授权同步**：技能正文只要有一处 `codegraph` CLI 调用，其 `allowedTools` MUST 含 `CODEGRAPH_CLI`（缺条目会在运行时被权限拦截，使归档的 CodeGraph 步骤必然弹窗或失败）。
- **来源统一**：MUST NOT 在模板中手写 `Bash(codegraph:*)` 字面量；测试 SHALL 断言这些技能的白名单包含该常量值。
- **授权面最小**：该条目只放行 `codegraph` 子命令，MUST NOT 扩展为 `Bash(*)` 或任意 shell 前缀。

#### Scenario: 归档类技能具备 CLI 条目

- **WHEN** 检查 `iagent_spec_archive` 与 `iagent_spec_bulk_archive` 的 `allowedTools`
- **THEN** 两者均含 `Bash(codegraph:*)`，且该值经 `CODEGRAPH_CLI` 常量产出

#### Scenario: 探索与调试技能具备 CLI 条目

- **WHEN** 检查 `iagent_spec_explore` / `iagent_debug` / `iagent_project_init` 的 `allowedTools`
- **THEN** 正文含 `codegraph` CLI 调用者均含 `Bash(codegraph:*)`

#### Scenario: 条目格式由共享常量产出

- **WHEN** 在模板中检索 `Bash(codegraph:*)` 字面量
- **THEN** 仅 `tool-whitelist.ts` 的常量定义处出现该字面量，模板一律以 `${CODEGRAPH_CLI}` 引用

#### Scenario: CLI 与 MCP 条目并存

- **WHEN** 某技能既调用 CodeGraph MCP 工具又经 Bash 运行 `codegraph status`
- **THEN** 其 `allowedTools` 同时含 `mcp__codegraph*` 条目与 `Bash(codegraph:*)`，任一都不被另一者替代

### Requirement: CodeGraph 探测顺序与锁阶梯单一源

CodeGraph 的**能力探测顺序**与**锁阶梯**文本 SHALL 收敛到 `src/core/templates/codegraph-protocol.ts` 的共享常量/渲染函数（`renderCodegraphProbeOrder({ withCli })` / `CODEGRAPH_LOCK_LADDER`），供正文需要该口径的技能模板插值引用；MUST NOT 在模板中手写第二份探测顺序或锁阶梯文本。

- **探测顺序（三通道）**：MCP 具名工具 → `codegraph_explore` 返回的时效横幅 → 经 Bash 运行 `codegraph status --json`；任一通道成功即视为可用，「工具名缺失」≠「索引不可用」。
- **两形态**：`withCli=true` 渲染三通道全文（调用方 MUST 同时具备 `CODEGRAPH_CLI`）；`withCli=false` 只渲染前两通道并声明「本技能不执行 CLI，第三通道不适用」——用于不持 CLI 权限的技能（如 `iagent_migration`），MUST NOT 另立第二份手写文本。
- **锁阶梯**：读 `.codegraph/` 下 `writer.pid` 判存活 → 存活则只读复用既有索引并 MUST NOT 执行 `codegraph unlock` → 不存活才 `unlock` + 重试一次 → 仍失败降级 Glob/Grep + WARN。
- **`writer.pid` 判据**：该文件为 JSON（形如 `{"pid":19488,"mode":"daemon","startedAt":<ms>,"ready":true}`），MUST NOT 假定为裸数字。文件缺失 → 视为无 daemon；解析失败 / `pid` 非正整数 / `ready:false` → 视为**不可判定**并按「存活」处理（禁止 unlock、禁止显式 sync，只读复用，查询失败则降级 Grep + WARN）；存活探测 MUST 为只读无副作用（MUST NOT 终止进程）。
- **既有护栏保留**：MUST NOT 用「`.codegraph/` 目录是否存在」判定索引可用性（点号目录的 Glob 假阴性会把 CodeGraph 误判为未初始化）；读取 `.codegraph/writer.pid` 属显式路径读取（判 daemon 存活），不违反该护栏 —— 两条判据的区分 MUST 写进协议文本。
- **同步责任**：显式 `codegraph sync` 仅在确认无 daemon（纯 CLI 用户）时按需执行一次；daemon 活跃时 MUST NOT 显式 sync。
- **引用面**：`iagent_spec_archive` / `iagent_spec_bulk_archive` / `iagent_spec_explore` / `iagent_debug` / `iagent_project_init` 插值引用该常量（正文确有 CLI 调用者另含 `CODEGRAPH_CLI`）；`iagent_migration` 正文提及同一口径时 SHALL 同样插值引用，MUST NOT 手写旧「`codegraph_status` 优先」措辞。

#### Scenario: 探测顺序与锁阶梯由共享常量产出

- **WHEN** 在技能模板中检索探测顺序或锁阶梯文本
- **THEN** 该文本仅在 `codegraph-protocol.ts` 定义一次，模板一律以常量插值引用，MUST NOT 出现手写副本

#### Scenario: daemon 存活禁止解锁

- **WHEN** 锁阶梯判定 `writer.pid` 指向的进程仍存活
- **THEN** 技能只读复用既有索引，MUST NOT 执行 `codegraph unlock`、MUST NOT 显式 `codegraph sync`

#### Scenario: writer.pid 不可解析时按存活处理

- **WHEN** `.codegraph/writer.pid` 存在但 JSON 解析失败、`pid` 非正整数或 `ready` 为 `false`
- **THEN** 技能按「不可判定 = 存活」处理：MUST NOT `unlock`、MUST NOT 显式 `sync`，只读复用索引；查询失败则降级 Glob/Grep 并记 WARN
- **AND** MUST NOT 因解析失败而删除该文件（删除活跃锁会损坏索引）

#### Scenario: 目录存在性不构成可用性判据

- **WHEN** 技能判定索引是否可用
- **THEN** 只走三通道探测；MUST NOT 以「`.codegraph/` 目录存在 / 不存在」作结论
- **AND** 读取 `.codegraph/writer.pid` 仅用于判 daemon 存活（显式路径读取，失败即视为无 daemon），不得反向用于判索引可用性

#### Scenario: 无 daemon 才按需同步

- **WHEN** 探测确认无 daemon（纯 CLI 用户）且需要更新索引
- **THEN** 技能经 CLI 执行 `codegraph sync` 恰一次；失败仅 WARN，不阻断流程

#### Scenario: 旧「先跑 status」口径不留残留

- **WHEN** 检查任一引用 CodeGraph 的模板
- **THEN** MUST NOT 出现「`codegraph_status` 必须是首个动作」类硬约束，也 MUST NOT 出现旧「遵循 `codegraph_status` 优先规则」措辞

## MODIFIED Requirements

### Requirement: 调用类白名单条目 SHALL 经共享常量构造

含"调用类"白名单条目（CodeGraph MCP、CodeGraph CLI、技能委派 `Skill(...)`、子代理派发 `Agent`/`Task`）的技能模板 MUST 经 `src/core/templates/tool-whitelist.ts` 的共享常量构造其 `allowedTools`——CodeGraph MCP 条目经 `${CODEGRAPH_MCP}`、CodeGraph CLI 条目经 `${CODEGRAPH_CLI}`、技能委派条目经 `${skillDelegation([...])}`、派发条目经 `${SUBAGENT_DISPATCH}`；MUST NOT 逐个模板手写字面量。

测试 MUST 断言：任一含 CodeGraph MCP 条目的技能，其 `allowedTools` 包含 `CODEGRAPH_MCP` 常量值；任一含 CodeGraph CLI 调用的技能包含 `CODEGRAPH_CLI` 常量值；任一含派发条目的技能包含 `SUBAGENT_DISPATCH` 常量值；任一含委派条目的技能的 `Skill(...)` 条目均可由 `skillDelegation(...)` 常量产出。该强制 MUST NOT 改变授权面（只统一来源，MUST NOT 新增未使用的条目）。

#### Scenario: 编排技能白名单经共享常量构造

- **WHEN** 检查 `iagent_workflow` / `iagent_auto_workflow` / `iagent_debug` 的 `allowedTools`
- **THEN** 其 CodeGraph MCP 条目 SHALL 由 `${CODEGRAPH_MCP}` 产出、技能委派条目 SHALL 由 `${skillDelegation([...])}` 产出、派发条目 SHALL 由 `${SUBAGENT_DISPATCH}` 产出，MUST NOT 为手写字面量

#### Scenario: CodeGraph CLI 条目由常量产出

- **WHEN** 检查任一正文含 `codegraph` CLI 调用的技能
- **THEN** 其 CLI 条目 SHALL 由 `${CODEGRAPH_CLI}` 产出，MUST NOT 为手写字面量

#### Scenario: 常量变更自动跟随

- **WHEN** `tool-whitelist.ts` 的 `CODEGRAPH_MCP` 或 `CODEGRAPH_CLI` 取值变更
- **THEN** 所有引用该常量的技能白名单 SHALL 在下次生成时自动包含新取值，无需逐模板手工同步

#### Scenario: 授权面不因来源统一而扩大

- **WHEN** 将手写字面量改为共享常量
- **THEN** 改前改后的 `allowedTools` 值 SHALL 逐条等价（仅来源统一），MUST NOT 新增任何原本不存在的条目；测试断言改后值等于共享常量构造结果

### Requirement: 白名单不改变对话级确认门

白名单化 SHALL 只消除**工具级**权限弹窗，MUST NOT 改变任何**对话级**确认门语义。确认门 SHALL 按**正向白名单**（`GATE_WHITELIST`）保留以下 5 类，且不得因白名单生效或直通句而跳过或静默通过：

- L1-L5 需求澄清门（提示词校验门 + grill 批量确认）
- 功能流程图门（流程基准确认）
- 实现 + 测试桥（Phase 3.7 实现确认 + 测试计划）
- 归档桥（Phase 5 归档确认）
- 破坏性改动确认（不可逆操作的独立安全条）

不在上述白名单内的动作 MUST NOT 请求确认：阶段宣告、技能委派（含「是否调用某技能」）、只读扫描、CodeGraph 查询、状态查询。

#### Scenario: 工具调用自动执行而确认门仍阻塞

- **WHEN** 管线在探索阶段执行 CodeGraph 查询、Grep 检索与技能间委派
- **THEN** 这些调用免弹窗连续执行，而提示词校验门与功能流程图确认门仍照常等待用户回复

#### Scenario: 自动化语义不构成跳过理由

- **WHEN** 技能处于全自动管线（auto 语义）中并抵达确认门
- **THEN** 仍须取得用户确认或走门的四条出口之一，MUST NOT 静默通过

#### Scenario: 纯委派动作不请求确认

- **WHEN** 技能在阶段推进时宣告「进入 Phase N」并委派下一阶段技能
- **THEN** MUST NOT 输出「是否调用 <技能>」类询问、MUST NOT 停下等待确认

#### Scenario: 破坏性改动仍需确认

- **WHEN** 某步骤将删除目录、覆盖既有制品、改写版本库跟踪或执行不可逆命令
- **THEN** 仍 MUST 取得用户确认，MUST NOT 因动作不在阶段门清单内而直通
