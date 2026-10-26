# spec-bulk-archive-skill 增量规格

## MODIFIED Requirements

### Requirement: CodeGraph 批量预检

批量验证前工作流 SHALL 执行**能力探测**（顺序固定，任一通道成功即视为可用）：① CodeGraph MCP 具名工具 → ② `codegraph_explore` 返回的索引时效横幅 → ③ 经 Bash 运行 `codegraph status --json`（需 `allowedTools` 含 `Bash(codegraph:*)`）。MUST NOT 以单一工具名（如 `codegraph_status`）作为唯一判定依据——宿主工具面可能只挂载部分工具，「工具名缺失」≠「索引不可用」。MUST NOT 用 Glob 预检 `.codegraph/` 目录（点前缀目录返回假阴性）。

探测成功 SHALL 记录当前索引统计（file/node 数）供后续对比；三条通道全部失败时 SHALL 自动跳过全部 CodeGraph 步骤（本次预检与后续批量同步）并记录 WARN，MUST NOT 询问用户是否重试。若探测通道为「daemon 活跃」（`writer.pid` 指向的进程存活），后续 SHALL 只读复用既有索引，MUST NOT 执行 `codegraph unlock`。

#### Scenario: 预检成功

- **WHEN** 任一探测通道可用（如 `codegraph status --json` 调用成功）
- **THEN** 记录索引统计，继续批量验证，后续批量同步步骤启用

#### Scenario: 仅部分工具可用时仍判定可用

- **WHEN** 宿主未提供 `codegraph_status` 但 `codegraph_explore` 或 CLI `status --json` 可用
- **THEN** 工作流判定 CodeGraph 可用并继续，MUST NOT 因缺少具名工具而跳过全部 CodeGraph 步骤

#### Scenario: 预检失败自动跳过

- **WHEN** 三条探测通道全部失败
- **THEN** 记录 WARN 并跳过全部 CodeGraph 步骤，直接继续批量归档，不向用户询问

#### Scenario: daemon 活跃时不尝试解锁

- **WHEN** 预检发现 `.codegraph/` 下 `writer.pid` 指向的进程存活
- **THEN** 后续步骤只读复用既有索引，MUST NOT 执行 `codegraph unlock`

### Requirement: CodeGraph 批量同步与验证

当且仅当批量预检确认 CodeGraph 可用、**确认无 daemon 在运行**（纯 CLI 场景）且至少一个变更成功归档时，主代理 SHALL 在索引更新后执行单次项目级 `codegraph sync`（MUST NOT 逐变更同步——知识图谱数据库需免并发写），随后以 MCP `codegraph_search` 或等价的可用查询通道单次查询本批成功变更的变更名与关键符号（取自各变更 tasks.md/design.md）验证索引，显示匹配计数；无匹配时 WARN（非代码变更可预期）。

**daemon 活跃时 MUST NOT 显式 sync**：CodeGraph daemon 自带文件监听自动同步，显式 `codegraph sync` 会与 writer 争同一 DB 写锁（表现为「sync 因数据库被进程锁定而跳过」）。此时 SHALL 只读复用既有索引并跳过同步步骤，记录一行说明（非 WARN）。

**锁阶梯**：确需同步且遇到锁冲突时，先读 `writer.pid` 判存活——存活则只读复用（禁止 unlock）；不存活才执行 `codegraph unlock` 并重试一次；仍失败则降级 Glob/Grep 并记录 WARN。同步失败（CLI 错误、超时、不在 PATH）SHALL 记录警告且 MUST NOT 阻塞批量归档。部分成功（≥1 成功）仍触发同步。

MUST NOT 调用 `iagent spec reindex` 或任何索引重建（跨变更 SQLite 索引已退役）。

#### Scenario: 单次项目级同步

- **WHEN** 预检通过、无 daemon 运行且 3 个变更全部成功归档
- **THEN** 主代理运行 `codegraph sync` 恰一次，随后单次查询验证并显示 "✓ symbols verified in index"

#### Scenario: daemon 活跃时跳过同步

- **WHEN** 归档完成且探测器确认 daemon 正在运行（文件监听已自动同步）
- **THEN** 主代理 MUST NOT 执行 `codegraph sync`、MUST NOT 执行 `codegraph unlock`，只读复用索引并在汇总中标注「由 daemon 自动同步」

#### Scenario: 锁冲突走阶梯

- **WHEN** 同步遇到写锁且 `writer.pid` 指向的进程已不存活
- **THEN** 主代理执行 `codegraph unlock` 并重试一次；仍失败则降级 Glob/Grep 并记 WARN

#### Scenario: 同步失败不阻塞

- **WHEN** `codegraph sync` 执行超时或 CLI 不可用
- **THEN** 记录 WARN，批量归档汇总与索引更新不受影响

#### Scenario: 归档不触发索引重建

- **WHEN** 批量归档全部完成
- **THEN** 流程中 MUST NOT 调用 `iagent spec reindex`，也 MUST NOT 读写任何 `index.db`
