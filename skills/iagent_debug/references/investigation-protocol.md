### 2.2 CodeGraph 排查（分层结构）

Adapt the workflow's CodeGraph query system (status check → file scan → symbol + context → call chain + impact → **triage** → explore + deep-dive) to the debug investigation context. Record all findings to the diagnosis record in real time (after EACH query step, not batched at the end) so Phase 6 can persist the full investigation path.

#### 2.2.0 Status 预检（强制首动作与硬回退）

**MUST run `codegraph_status` as the FIRST action of Phase 2.** Until `codegraph_status` returns unavailable, you MUST NOT use Grep or Glob for symbol/file investigation — the `codegraph_*` tools (2.2.1–2.2.4) are the primary path, not an optional one.

- If initialized (files/nodes > 0): proceed with the CodeGraph tools in 2.2.1–2.2.4
- If `codegraph_status` confirms unavailable (uninitialized, error, or tool not mounted): ONLY THEN fall back to Glob (file structure) and Grep (symbol search), record "CodeGraph unavailable — used Glob/Grep fallback" in the diagnosis record

Grep/Glob is a **last resort**, permitted ONLY after `codegraph_status` confirms unavailability — never as a shortcut to skip CodeGraph. The fallback MUST NOT block the investigation, but it MUST NOT be taken before the availability check runs.

#### 2.2.1 文件结构扫描（codegraph_files）

- Scan the project file tree with `codegraph_files` to identify directories and files relevant to the bug description
- Write findings to the diagnosis record Codebase Findings > Discovered Files as "<file-path>: <relevance-reason>"
- All file paths MUST be constructed with `path.join()` for cross-platform compatibility (Windows/macOS/Linux) — never hardcode slashes
- Fallback (when CodeGraph unavailable): Glob for file structure discovery
- **仅增量（摘要命中范围跳过）**: MUST NOT re-run CodeGraph queries already covered — **incremental queries only**（仅执行增量查询，见 2.1.5）；摘要未覆盖的范围照常扫描

#### 2.2.2 符号定位与任务级上下文（codegraph_search + codegraph_context）

- `codegraph_search` — locate the symbols involved in the failing behavior; record "<symbol-name> (<file-path>:<line>): <reason>" to Codebase Findings > Identified Symbols
- `codegraph_context --task <bug-description>` — build comprehensive task-level context around the bug (aggregating entry points, related symbols, key code), turning the bug description into a scoped investigation context
- Fallback (when CodeGraph unavailable): Grep for symbol search
- **仅增量（摘要命中范围跳过）**: MUST NOT re-run CodeGraph queries already covered — **incremental queries only**（仅执行增量查询，见 2.1.5）；摘要未覆盖的符号与上下文照常定位

#### 2.2.3 调用链追踪与爆炸半径（codegraph_callers / codegraph_callees / codegraph_impact）

- `codegraph_callers` / `codegraph_callees` — trace the call chain around the suspected code (upstream callers and downstream callees)
- `codegraph_impact` — assess the blast radius of the suspected defect AND of the candidate fix
- Record call chains (ASCII diagrams when helpful) and affected symbols in the diagnosis record for root cause confirmation
- **仅增量（摘要命中范围跳过）**: MUST NOT re-run CodeGraph queries already covered — **incremental queries only**（仅执行增量查询，见 2.1.5）；摘要未覆盖的调用链与爆炸半径照常追踪

#### 2.2.3.5 排查深度分级（Triage · 事前选定排查路径）

**⚠️ MANDATORY: 本步在常规查询（2.2.1–2.2.3）之后、深度探索（2.2.4）之前执行。** 三条分级信号全部产自常规查询，故本步不得前移；编号采用**十进制插入**（`2.2.3.5`）以**不重排既有编号**（2.2.0–2.2.4 的编号与语义均不变）。

**分级信号（三条客观信号，任一命中即深度路径）**：

- **(a) 爆炸半径**：`codegraph_impact` 在 depth ≤ 2 的受影响符号数 **≥ 5**，或受影响文件数 **≥ 3**
- **(b) 跨模块**：受影响范围跨 **≥ 2** 个模块 / 目录
- **(c) 根因清晰度**：2.2.2（`codegraph_search` + `codegraph_context`）**未能**一步定位单一高置信根因

**分级结果（两条路径）**：

- **轻量路径（路径 A）**：止步于 2.2.1–2.2.3，**不执行** 6 维根因深度分析
- **深度路径（路径 B）**：进入 2.2.4 执行 `codegraph_explore` + 6 维根因深度分析

**保守取值**：信号缺失或落在阈值边界（无法判定是否超阈）时**取深度路径** —— 误走深度路径的代价是查询成本，误走轻量路径的代价是**漏检根因**（不可逆），宁可多查不漏。

**信号降级（CodeGraph 不可用时分级仍生效）**：

- 信号 **(a)** 降级为 **Grep 代理指标**（以 2.2.1 的文件结构扫描结果计受影响文件数，阈值同 3）
- 信号 **(b)(c)** 不依赖 CodeGraph，照常判定
- 诊断记录 MUST 标注「信号降级」；**MUST NOT 因 CodeGraph 不可用而跳过分级**

**信号可追溯（反幻觉硬约束）**：信号取值 MUST 可追溯至 `codegraph_impact` / `codegraph_files`（降级时为 Grep）的**实测查询结果**并在诊断记录留痕；MUST NOT 以"半径小"等未经实测的结论支撑轻量路径判定（违反 Zero-Assumption）。

**与 2.5 解耦**：分级结果**只**影响 2.2.4 是否执行；2.5 缺陷链路图与流程最终确认门对两条路径**均强制**产出，轻量路径 MUST NOT 豁免。

**记录规范**：分级结论（三条信号取值 + 所选路径 + 是否降级）随 Step 2.2 的记录规范一并实时写入诊断记录，供 Phase 6 随根因分析持久化到变更 `exploration.md`。

#### 2.2.4 深度探索与根因深度分析（条件触发）

**Trigger**: 满足以下任一条件时执行本节 ——

1. **分级为深度路径（2.2.3.5 路径 B）** —— 即便已一步定位到单一高置信根因，大范围 / 跨模块缺陷仍须经 6 维分析确认是否存在未检视的系统性根因（设计意图 / 约束 / 权衡 / 模式 / 历史边界 / 隐式假设）
2. **升级兜底**：轻量路径（路径 A）下 2.2.1–2.2.3 **未能**定位单一高置信根因（多候选或置信不足）

**仅当**分级为轻量路径 **且** 已定位单一高置信根因时，SKIP 本节以让简单缺陷走轻量路径。

**⚠️ 兜底是触发条件，不是独立步骤**：本节的内容与编号（2.2.4）**保持不变**；升级兜底即上述条件 2，MUST NOT 为其新建独立章节或编号。

When triggered:
- `codegraph_explore` — deep exploration of the suspected code area
- 6-dimension root cause deep analysis (adapted from workflow Implementation Deep-Dive, repositioned for root cause localization — the root cause often hides in WHY the code was designed this way):
  - **Design Rationale** — why the code was designed this way (code comments, docstrings, ADRs) — root cause may be a violated design intent
  - **Constraints** — hard constraints that shaped the code (config files, linter rules) — root cause may be a constraint that no longer holds
  - **Trade-offs** — multi-option trade-offs consciously accepted (TODO/FIXME/HACK comments) — root cause may be a trade-off that failed under new conditions
  - **Pattern Usage** — design patterns in use (class/interface structure) — root cause may be a pattern misuse
  - **Historical Context** — design evolution (`git log --follow`, `git blame`) — root cause may be a consciously accepted historical edge case (cross-reference capability memory boundary scenarios)
  - **Implicit Assumptions** — undocumented assumptions (type guards, default values, missing null checks) — root cause frequently hides here
- Write findings to the diagnosis record Implementation Deep-Dive section; dimensions with no findings are marked "<!-- No findings -->"
- Connects to the 2.4 root cause confirmation gate: multiple candidates → STOP and let the user choose; deep-dive insights assist confirmation

#### 2.2.4.5 摘要增量写入（与诊断记录并行）

**⚠️ MANDATORY: 2.2.1–2.2.4 每步完成后执行。** 每一步的结论 MUST 以 **incrementally appended** 方式写入 `.openspec-tmp/debug-<keyword>/investigation-digest.md` —— 按步骤顺序追加，不批量补写、不重写已有段落。

**并行写入、互不替代**：本步与「实时写诊断记录」（见下节 记录规范）**并行执行** —— 摘要写入 MUST NOT 替代诊断记录，诊断记录写入也 MUST NOT 替代摘要，两者各自独立完整。

#### 记录规范（所有子节共用）

All CodeGraph findings (Discovered Files / Identified Symbols / call chains / blast radius / Implementation Deep-Dive) MUST be structured into the diagnosis record's corresponding subsections and updated in real time after EACH query step (not batched at the end of the investigation). When CodeGraph is unavailable and the Glob/Grep fallback is used, findings still follow the same structure with the fallback noted — investigation traceability MUST NOT be lost due to fallback.

