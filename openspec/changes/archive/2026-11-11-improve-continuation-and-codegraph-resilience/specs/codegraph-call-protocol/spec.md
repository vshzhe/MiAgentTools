## ADDED Requirements

### Requirement: CodeGraph primary channel and optional channels

系统 SHALL 把 `codegraph_explore` 定义为跨宿主唯一保证可用的 **CodeGraph 主通道**，用于文件结构发现、符号定位与任务级上下文获取；`codegraph_impact` SHALL 为可选增强通道；`codegraph_files` / `codegraph_search` / `codegraph_context` / `codegraph_node` / `codegraph_callers` / `codegraph_callees` SHALL 为「宿主暴露时可选」通道。可选通道缺失 MUST NOT 构成「索引不可用」判据，MUST NOT 触发 unlock / sync，查询 SHALL 回落到主通道。

能力可用性判定 SHALL 沿用既有三通道探测（MCP 具名工具 → `codegraph_explore` 时效横幅 → CLI `status --json`），MUST NOT 用 `.codegraph/` 目录存在性判定可用性 (D5)。

#### Scenario: 宿主仅暴露主通道时扫描仍完成

- **WHEN** 宿主只提供 `codegraph_explore`，未提供 `codegraph_files` / `codegraph_search` / `codegraph_context`
- **THEN** 文件结构与符号发现 SHALL 经 `codegraph_explore` 完成
- **AND** MUST NOT 记为「索引不可用」，MUST NOT 反复调用缺失工具

#### Scenario: 可选通道存在时增强而非替代

- **WHEN** 宿主同时提供 `codegraph_impact`
- **THEN** 影响半径分析 MAY 使用该通道
- **AND** 该通道失败 MUST NOT 阻断扫描，回落主通道结果

#### Scenario: 探测失败才降级内置工具

- **WHEN** 三通道探测全部失败
- **THEN** 系统 SHALL 降级 Glob / Grep 并记 WARN
- **AND** MUST NOT 在探测成功时使用 Glob / Grep 作为捷径

### Requirement: Serial call discipline and busy ladder

CodeGraph 调用 SHALL 串行：同一时刻 MUST NOT 发起多个 CodeGraph 调用；多符号或多主题查询 SHALL 合并为一次自然语言查询，或串行分次执行。单次查询 SHALL 有界（`maxFiles` 默认不超过 12）。

收到 `busy serving other concurrent requests` 时，系统 SHALL 按固定阶梯处置：等待 5–10 秒后**重试同一调用**，至多 2 次；仍 busy 时 SHALL 在本步骤降级内置工具并记 WARN，随后继续流程 (D7)。busy MUST NOT 被判为索引不可用，MUST NOT 触发 `codegraph unlock` 或显式 `codegraph sync` (D5/D7)。

#### Scenario: 首次 busy 后重试成功

- **WHEN** 首次调用返回 busy 文案，等待后重试返回正常结果
- **THEN** 系统 SHALL 采用该结果继续
- **AND** MUST NOT 记为索引不可用或触发 unlock / sync

#### Scenario: 重试耗尽后本步骤降级

- **WHEN** 同一调用连续三次返回 busy（首次 + 2 次重试）
- **THEN** 该步骤 SHALL 降级为内置工具并记 WARN
- **AND** 流程 SHALL 继续，MUST NOT 阻断阶段

#### Scenario: 禁止并行发起 CodeGraph 调用

- **WHEN** 需要分析两个及以上符号
- **THEN** 调用 SHALL 合并为一次查询或串行执行
- **AND** MUST NOT 并行发起多个 CodeGraph 调用

### Requirement: CLI subcommand boundary

CodeGraph CLI 仅 SHALL 允许 `status`、`unlock`、`sync` 三个子命令 (D6)；MUST NOT 把 MCP 工具名当作 CLI 子命令（如 `codegraph search` / `codegraph files` / `codegraph context` 不存在）。遇到 `unknown command` 时，系统 SHALL 立即改用 MCP 主通道，MUST NOT 重试同类 CLI 命令。CLI 的 `unlock` / `sync` 仍受既有锁阶梯约束（存活 daemon → 只读复用，MUST NOT unlock / sync）。

#### Scenario: 未知子命令改用 MCP

- **WHEN** CLI 返回 `unknown command 'search'`
- **THEN** 系统 SHALL 改用 MCP 主通道完成该次检索
- **AND** MUST NOT 重试 `codegraph search` 或同类未定义子命令

#### Scenario: CLI 不越权执行写操作

- **WHEN** daemon 存活（`.codegraph/writer.pid` 可解析且 `ready:true`）
- **THEN** MUST NOT 执行 `codegraph unlock` 或显式 `codegraph sync`
- **AND** SHALL 只读复用既有索引
