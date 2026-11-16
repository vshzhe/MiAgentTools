# 批量归档 CodeGraph 协议

执行「批量归档前的 CodeGraph 能力探测」与「批量 CodeGraph 同步 + 验证」时按本文件逐步执行。

## 能力探测顺序

**CodeGraph 能力探测（按顺序尝试，三条通道任一成功即视为可用）**：
1. 先调用 MCP 具名工具（`codegraph_explore` / `codegraph_status` 等）——能返回结果即视为可用；
2. 若 MCP 具名工具未暴露，改看 `codegraph_explore` 返回的**时效横幅**（含索引构建/滞后提示）——横幅存在即视为可用；
3. 若前两条通道均不可得，再经 Bash 运行 `codegraph status --json`——命令成功并返回 JSON 即视为可用。
- **工具名缺失 ≠ 索引不可用**：某一通道在当前宿主不存在，只说明该通道不可用，MUST NOT 据此断言索引未初始化。
- MUST NOT 用「`.codegraph/` 目录是否存在」判定索引可用性（点号目录的 Glob 存在假阴性）；目录存在性不构成可用性判据。

**CodeGraph 锁阶梯（读锁优先；误删活跃锁会损坏索引）**：
1. **读取** `.codegraph/writer.pid`（用 `path.join()` 构造显式路径）：文件缺失或为空 → 视为**无 daemon**，可进入 unlock 分支；
2. **解析**：该文件为 **JSON**（形如 `{"pid":19488,"mode":"daemon","startedAt":<ms>,"ready":true}`），MUST NOT 假定为裸数字；JSON 解析失败 / `pid` 非正整数 / `ready:false` → 视为**不可判定 = 存活**：MUST NOT `codegraph unlock`、MUST NOT 显式 `codegraph sync`，只读复用索引，查询失败则降级 Glob / Grep 并记 WARN，且 MUST NOT 删除该文件；
3. **存活判定**：`pid` 可用时以只读、无副作用的方式探测进程是否存在（`process.kill(pid, 0)` 语义或平台等价的只读探测）——MUST NOT 执行任何终止动作；
4. **存活 → 只读复用既有索引**：daemon 是合法写者，MUST NOT 执行 `codegraph unlock`、MUST NOT 显式 `codegraph sync`；
5. **不存活 → 执行一次 `codegraph unlock`**，随后重试读取一次；仍失败 → 降级 Glob / Grep 并记 WARN；
6. **仅确认无 daemon（纯 CLI 用户）时**才按需执行一次 `codegraph sync`；同步失败只记 WARN，不阻断流程；
7. 判 daemon 存活是显式路径读取（失败即视为无 daemon），与「MUST NOT 用目录存在性判索引可用性」是两条独立判据，MUST NOT 混用。

**CodeGraph 调用纪律（主通道优先，串行执行）**：
1. **主通道**是 `codegraph_explore`（文件结构发现 / 符号定位 / 任务级上下文均可用一次自然语言查询完成）；`codegraph_impact` 为**可选增强**；
2. `codegraph_files` / `codegraph_search` / `codegraph_context` / `codegraph_node` / `codegraph_callers` / `codegraph_callees` 为「**宿主暴露时可选**」通道：缺失时改用主通道，MUST NOT 记为「索引不可用」，MUST NOT 反复调用缺失工具；
3. **一次广查询优先**：多符号或多主题合并为一次 `codegraph_explore`；单次查询 `maxFiles` 默认不超过 12；
4. **串行**：同一时刻只发一个 CodeGraph 调用；需要多次查询时串行执行，MUST NOT 并行发起多个调用（并发正是 busy 排队的来源）。

**CodeGraph busy 阶梯（排队不是错误，也不是索引不可用；耗尽即跳过，不阻塞流程）**：
1. 识别 `busy serving other concurrent requests` 一类排队文案时，**等待 5–10 秒**；
2. 重试**同一调用**（同一查询参数），至多 **2 次**（合计至多 3 次调用，MUST NOT 超出）；
3. 仍 busy → 该 CodeGraph **步骤**记为 `skipped-busy`，改用内置工具（Glob / Grep）补足该步骤所需信息并记 WARN，**随后继续流程**；Glob / Grep 也无法覆盖时，该步骤结论记「未覆盖（CodeGraph busy 跳过）」，MUST NOT 据此停止或反复重试；
4. MUST NOT 因 busy 判「索引不可用」，MUST NOT 执行 `codegraph unlock` 或显式 `codegraph sync`；同一会话内已记 `skipped-busy` 的同类调用 MUST NOT 再次发起（避免重复排队）。

**CodeGraph CLI 边界（子命令白名单）**：
1. CLI 仅允许 `codegraph status --json` / `codegraph unlock` / `codegraph sync`（后两者受锁阶梯约束）；
2. MUST NOT 把 MCP 工具名当 CLI 子命令：`codegraph search` / `codegraph files` / `codegraph context` / `codegraph impact` 均**不存在**；
3. 遇 `unknown command` → 立即改用 MCP 主通道完成该次检索，MUST NOT 重试同类 CLI 子命令。

**CodeGraph 步骤可跳过（统一出口）**：
- 以下任一情形，该 CodeGraph 步骤 MUST 记为 `skipped-*` 并**继续主流程**，不得停止、不得反复重试：`skipped-busy`（busy 阶梯耗尽）/ `skipped-lock`（锁阶梯不可解）/ `skipped-unavailable`（能力探测三通道全失败）；
- 跳过 MUST 在产物中留痕（一行：步骤名 + 跳过原因 + 降级所用工具），使「没查到」与「项目中确实没有」可区分；
- 跳过 MUST NOT 被表述为「已完成 CodeGraph 检查」；
- 同一会话内对同一 CodeGraph 步骤至多发起一轮完整阶梯，后续同类步骤直接复用该次跳过结论，MUST NOT 重复排队。

## 批量特有约束

- CodeGraph 同步是**项目粒度**的，不是按变更的：整批在所有变更归档后只运行一次同步（Step 11）；daemon 活跃时只读复用、不显式同步。
- 同步与验证只由主代理执行，MUST NOT 在归档子代理内执行（项目级单次同步可避免知识图谱 DB 并发写入）。
- 验证查询只针对成功归档的变更（不含失败 / 跳过），且**仅一次**。