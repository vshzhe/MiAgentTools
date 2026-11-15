## MODIFIED Requirements

### Requirement: CodeGraph primary channel and optional channels

系统 SHALL 把 `codegraph_explore` 定义为跨宿主唯一保证可用的 **CodeGraph 主通道**，用于文件结构发现、符号定位与任务级上下文获取；`codegraph_impact` SHALL 为可选增强通道；`codegraph_files` / `codegraph_search` / `codegraph_context` / `codegraph_node` / `codegraph_callers` / `codegraph_callees` SHALL 为「宿主暴露时可选」通道。可选通道缺失 MUST NOT 构成「索引不可用」判据，MUST NOT 触发 unlock / sync，查询 SHALL 回落到主通道。

能力可用性判定 SHALL 沿用既有三通道探测（MCP 具名工具 → `codegraph_explore` 时效横幅 → CLI `status --json`），MUST NOT 用 `.codegraph/` 目录存在性判定可用性 (D5)。

技能模板正文与 `references/*.md` 引用 CodeGraph / Semgrep 工具时 SHALL 使用**宿主中立名**（`codegraph_explore` / `codegraph_impact` / `semgrep_scan` 等）或「宿主暴露的 MCP 工具」表述，MUST NOT 硬编码 `mcp__codegraph__*` / `mcp__plugin_semgrep_*` 全名；具体 MCP 前缀由宿主在消费期解析。`allowedTools` 中的 MCP 条目仍由 `tool-whitelist.ts` 按宿主白名单常量生成，不受本要求影响。

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

#### Scenario: 模板正文工具名宿主中立

- **WHEN** 扫描 `src/core/templates/workflows/*.ts` 的模板正文与 references 内容
- **THEN** CodeGraph 工具引用 SHALL 使用 `codegraph_*` 中立名或「宿主暴露的 MCP 工具」表述
- **AND** MUST NOT 出现 `mcp__codegraph__` / `mcp__plugin_semgrep_` 字面量（`tool-whitelist.ts` 白名单常量除外）

#### Scenario: Semgrep 可选增强

- **WHEN** 模板正文引用 Semgrep 安全扫描
- **THEN** SHALL 声明其为可选增强，不可用时跳过并记录、不阻断工作流
- **AND** MUST NOT 把某一宿主的 Semgrep MCP 全名写成跨宿主硬约束
