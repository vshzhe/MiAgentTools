6. **实现任务（批调度循环，直至完成或被阻塞）**

   **变更级 handoff 包（流程级，一次产出、跨阶段复用）：**

   - **路径**：项目根下 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md`（用 `path.join()` 构造；该目录已被 `.gitignore` 排除，**不进提交面**）
   - **跨阶段复用（优先）**：`iagent-spec-propose` 在提案定稿时已产出该包 → apply **只读复用**，MUST NOT 重产整包；收尾时仅向 `## 阶段结论` 追加一行。包内并列节 `## 硬约束` 只读复用（MUST NOT 写入或改写）；本技能 MUST NOT 新增 grill 纸迹校验、术语写入或 ADR 判定逻辑
   - **独立调用时（包不存在）**：按同一六节协议**产出一次**（只在首次派发前产出，不按批重产、也不按单元重产）
   - **头部固定元信息**：`change: <name>` / `producedBy: propose|apply` / `producedAt: <ISO>` / `sourceFingerprint: <hash>`
   - **指纹校验**：阶段入口比对当前制品（proposal / design / specs / tasks）的内容指纹；与 `sourceFingerprint` 不一致 → 重建整包并记 WARN，MUST NOT 静默沿用陈旧包
   - handoff 包是实现的**只读输入面**：主 agent 只读该包（+ 任务清单），变更目录中的其他内容一律不读
   - 包内章节固定为六节 + 制品清单（位于契约节之后、规范要点节之前；**与六节并列、不计入六节**）+ `## 已确认门`（门账本，**与六节并列、不计入六节**）+ 并列节 `## 硬约束`（只读复用、**不计入六节**）+ 可选 `## 阶段结论`（六节顺序如下）：
     - `## 变更摘要` — 从 proposal.md 蒸馏出的变更要点（why/whatChanges）：本变更做什么、为什么
     - `## 契约` — 从 specs + design 蒸馏出的接口签名 / 数据结构 / 表字段
     - `## 规范要点` — 主 agent 一次性蒸馏出的**全部存在规则源**（`.iagent/rules/*.md`、`CLAUDE.md`、`AGENTS.md`）关键护栏，逐条标注来源路径（绝不由各任务分别蒸馏）
     - `## 文件归属表` — 派发单元 → 该单元允许修改的文件
     - `## Codebase 摘要` — 预扫描 / 探查摘要结论（分层 / 依赖事实，否则主 agent 需重新推导）
     - `## 已产出（跨单元可见）` — 产出登记表：已产出文件 + 公开签名，每批结束后追加
     - `## 已确认门`（门账本；**不是第七个内容节**，不改变六节语义与相对顺序）— 每行一个已确认门：Markdown 表格行 `| <门承载 id> | <确认阶段> |`（表头 `| 门 id | 确认阶段 |` 与分隔行 `| --- | --- |` 由解析侧跳过）。门 id 值域收敛到 `GATE_SKIP_IDS`（当前仅 `design-confirmation`），条目只表达「该门已由父级承载」，MUST NOT 记录业务决策正文、MUST NOT 写入父级阶段门 id；父级在门确认后立即写、委派前校验存在，本技能（及 verify / archive）**只读**该段，MUST NOT 改写既有条目
     - `## 硬约束`（并列节，**不是第七个内容节**）— 由 propose 产出，本技能**只读复用**（MUST NOT 写入、改写或回填），也 MUST NOT 据此新增 grill 纸迹校验、术语写入或 ADR 判定逻辑；缺失时按「无硬约束」处理并记 WARN，MUST NOT 判定整包无效
     - `## 阶段结论`（可选，**只追加不改写**）— 每阶段一条，五列：`phase` / `status` / `artifact` / `nextAllowed` / `tokens`（可用时填 `tokens=<数值>`，不可得填 `—`）
   - 产出后编排器 MUST NOT 重产整包 —— 只允许向 `## 已产出（跨单元可见）`、`## 已确认门`（仅追加新条目，MUST NOT 改写父级既有条目）与 `## 阶段结论` **追加**内容（见批后步骤）

   **批前加载批次大小：**
   - 从 `openspec/config.yaml` 读取 `apply.concurrency`（正整数）作为**每批单元数**软上限
   - 未配置时：使用默认 3；取值非法（非正数或非整数）时告警并回退 3
   - 该上限只约束每批处理的单元数；本协议**不派发子代理**，该值 MUST NOT 被解释为子代理并发

   **加载相邻合并配置：**
   - 从 `openspec/config.yaml` 读取 `apply.mergeAdjacent`（布尔）
   - 未配置时：默认 true（相邻的简单任务合并为一个派发单元）
   - 为 false 时：在模板层面跳过合并行为

   **加载批后编译检查配置：**
   - 从 `.iagent/config.yaml` 读取 `compileCheck.incremental`（段或字段缺失时运行 `iagent config show` 取生效值）
   - 为 true（缺省）时：每批任务完成后执行**批后编译检查** —— 复用收尾全量所用的**同一条命令**（显式 `command` 或描述符探测结果），只把报告范围限定为本批改动的模块；失败进入与收尾全量相同的自动修复循环（同一重试预算），耗尽即写 `fail` 证据并暂停
   - 为 false 时：跳过批后检查并说明「仅做 Step 8 收尾全量检查」
   - 旧位置 `openspec/config.yaml` 的 `apply.incrementalCheck` 不再生效（仅一次 WARN，见 Step 8 的配置弃用段）
   - 命令判定 / monorepo 归组去重 / 证据口径见 `references/compile-check.md`（执行前 MUST 先 Read）

   **批调度循环**（主 agent 单 agent 分批实现，按 Step 5.5 确认的统一批计划逐批执行）：

   **批形态判定（每批开始时 强制）：**
   - 批含 **≥2** 个单元 → 产出或复用 handoff 包（若尚未存在则按同一六节协议产出一次），由主 agent 按单元顺序实现
   - 批含 **<2** 个单元 → 由主 agent 直接实现，且 MUST NOT **新产出**包（已有 handoff 包仍可只读复用）

   1. **单任务批**：由你直接实现该任务 —— 标明「单任务批（串行）」；展示当前任务，完成所需代码改动，保持最小且聚焦
   2. **多单元批 —— 批状态提示**：输出批位置（Batch N/M）、本批单元数与任务组；说明「批内独立只读可并行、写同一文件串行」
   3. **批前重叠检查**：跨单元检查本批任务的目标文件；不同单元中会修改同一文件的任务 MUST 串行执行
   4. **批内并行只读**：同一批内独立 Read / Grep / CodeGraph 查询 MAY 在同一回合并行发起；MUST NOT 声称这是独立上下文的并行实现
   5. **写入规则**：写不同文件的任务 MAY 在同一回合发起；写同一文件的任务 MUST 串行；按任务顺序推进
   6. **批后收束**：对照任务需求核验结果 → 由你集中更新 tasks.md（`- [ ]` → `- [x]`，仅限已确认完成的任务）→ 向 handoff 包 `## 已产出（跨单元可见）` 与 `apply-progress.md` 追加本批产出文件与公开签名
   6.5 **批后编译检查**（`compileCheck.incremental=true` 时）：复用收尾全量的同一条命令对**本批改动模块**执行检查 → 失败进入自动修复循环（与收尾全量同一重试预算）→ 耗尽即写 `fail` 证据并**暂停**（MUST NOT 继续后续批次、MUST NOT 进入 Step 9）；`incremental=false` 时跳过并说明「仅做收尾全量检查」→ 通过后进入下一批
   7. **失败任务**：由你串行重试该失败任务一次 → 若重试仍失败，暂停并向用户报告（该任务保持未勾选 `- [ ]`）

   **进度与读取纪律（主 agent 职责）：**

   - **进度登记表**：`.openspec-tmp/pipeline-<change-name>/apply-progress.md`，每任务一行 —— `<任务 id> | <状态> | <产出文件> | <公开签名>`；MUST NOT 粘贴代码正文；失败任务附失败原因摘要。
   - 「公开签名」定义：产出中可能被其他任务引用的符号签名 —— 函数 / 方法 / 类型 / 接口 / 导出常量 / CLI 命令（含参数与返回类型）；无可引用产出时记「无」。
   - **空值**：包 `## 契约` 无对应条目时，包与进度表的公开签名列均记「无」，MUST NOT 留空；MUST NOT 编造。
   - **读取纪律**：MUST NOT 重读 handoff 包已覆盖的 proposal / specs / design，MUST NOT 重跑包已覆盖的 CodeGraph 查询；包缺项时 MAY 补查，并在进度表记录「缺什么、补查了什么」。
   - **反幻觉**：包是蒸馏视图，不是制品替代品；包中缺少某项时 MUST 查阅制品本身，MUST NOT 猜测字段或契约。

   **fail-safe 降级：**

   - 临时工作区不可写时：先降级到系统临时目录（`iagent-pipeline-<change-name>/`）；若仍失败，按下方降级
   - handoff 包无法产出，或项目没有 `.iagent/rules/coding-rules.md` 时：降级为既有内联读取并记录 WARN —— MUST NOT 阻断实现
   - `gate-skip=design-confirmation`（门承载参数；`auto-mode=true` 为兼容等价写法）只跳过 Step 5.5 设计确认门 —— 共享资源协议 MUST NOT 因该参数而豁免

   **执行方式（强制）：**
   - apply 阶段由**主 agent 内联**执行（`executionMode=inline`），MUST NOT 派发 `Agent` / `Task` 子代理；`apply.concurrency` 只表示每批单元数
   - 兼容窗内旧 `subagent` 回执记 deprecation WARN 并允许推进（下个 major 收紧）

   **串行降级（无依赖信息）：**
   - 若 Step 5.5 无法从 design.md 推断批计划（无可用依赖标注）：保持串行行为：对每个待办任务 —— 展示当前正在处理的任务、完成代码改动、把 tasks.md 中该任务勾选框置为 `- [x]`，继续下一个任务

   **任务产出处理规则：**

   实现任务时，按任务标签区分**三**类产出：

   **代码实现**（带 `[代码]` 标签或无标签的任务）：
   - 在合适的项目源码位置创建/修改文件
   - 遵循常规实现流程

   **测试代码**（带 `[测试]` 标签的任务）：
       - **MUST 委派 `iagent-test`**（传入测试层级与优先级）生成测试代码 —— MUST NOT 在 apply 内另立一套测试规则。`iagent-test` 不可用（degraded / 技能缺失）时记录 WARN 并按同一测试规则本地实现，MUST NOT 伪装为委派完成
       - **框架探测**：从构建文件（`pom.xml` → JUnit 4/5 + Mockito；`build.gradle` → JUnit 4/5 + Mockito；`package.json` → Vitest / Jest / Mocha）与结构线索（`src/test/` 或 `test/` 下的既有测试文件）探测项目测试框架；对齐**既有**测试风格（注解、断言、命名约定）—— 不得另造新风格
       - **覆盖范围**（最低要求）：① spec Scenario —— 为任务 `Spec Ref` 中引用的每个 `#### Scenario:` 写一个测试；② BCDE 边界 —— Boundary（最小/最大值、空集合）、Condition（null 入参、缺失字段）、Default（默认构造对象、未设置枚举）、Error（非法入参、抛出的异常）；③ 若某 Scenario 被判定为不可测，把结论以注释写入测试文件，使"未写"与"从未评估"可区分
       - **测试结构**：每个被测生产类一个测试类，命名为 `<ClassName>Test`（Java）或 `<className>.test.<ext>`（Node）；每个测试方法用 `@Test`（JUnit）/ `it(...)`（Vitest/Jest/Mocha）注解覆盖**一个**逻辑 Scenario；采用 Arrange-Act-Assert (AAA) 模式
       - **反模式防护**：MUST NOT 写永远通过的测试（无断言）、MUST NOT 用 `Thread.sleep()` 处理异步（用 `await` / `CompletableFuture`）、MUST NOT 依赖测试执行顺序（每个测试相互隔离）、MUST 用框架的 mock 库 mock 外部依赖（DB / HTTP / 文件 I/O）
       - 落盘位置遵循项目测试目录结构（如 `src/test/java/...`、`test/...`）—— `[测试]` 任务 MUST NOT 走 `产出:` → `attachments/` 规则，因为放在 `attachments/` 下的测试代码无法执行
       - `[测试]` 任务 MUST NOT 当作补充文档处理
       - 测试任务依赖其实现任务：当测试任务所测行为由另一任务实现时，把该测试任务排到更晚的批 —— MUST NOT 与其实现任务并发运行
   **补充文档**（带 `[DB脚本]`、`[使用说明]`、`[API文档]`、`[配置示例]`、`[部署说明]`、`[测试数据]` 标签的任务）：
   - 读取任务的 `产出:` 字段以确定输出路径
   - 默认路径：`<changeRoot>/attachments/<filename>`
   - 直接在默认 `attachments/` 位置创建文件，无需询问
   - 若 `产出:` 字段指定的路径在 `attachments/` 之外，或你判断其他位置更合适，MUST 暂停并询问用户确认后再放置文件
   - 用户批准其他位置后，更新 `tasks.md` 中的 `产出:` 字段以反映实际路径
   - 文件创建完成后标记该任务完成

   **计划外补充文档：**

   若实现过程中 AI 发现需要一份 `tasks.md` 中未列出的补充文档：
   - 暂停当前任务
   - 向用户说明所需文档及其原因
   - 等待用户确认
   - 用户确认：向 `tasks.md` 新增一个带相应类型标签与 `产出:` 路径的任务，执行它，然后继续剩余任务
   - 用户拒绝：记录该决定，不创建并继续

   **遇以下情况暂停：**
   - 任务含义不清 → 请求澄清
   - 实现暴露设计问题 → 建议更新制品
   - 遇到错误或阻塞 → 报告并等待指引
   - 用户中断 → 完成当前批、把剩余任务标为未完成，然后暂停
   - 实现揭示必须收窄、延后或简化某任务的 spec 行为才能通过 → 标 **[待确认]** 并说明差异，询问用户，确认后先更新 proposal/specs/design 再继续（见 Guardrails 中的范围蔓延护栏）

