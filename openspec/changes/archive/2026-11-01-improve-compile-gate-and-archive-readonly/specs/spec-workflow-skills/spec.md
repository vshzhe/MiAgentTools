## MODIFIED Requirements

### Requirement: spec-apply 实现技能

spec-apply 技能 SHALL 实现规格驱动实现工作流：优先通过 `iagent spec instructions apply --change <name> --json` 获取任务上下文（contextFiles / progress / dynamic instruction），命令不可用（旧版 CLI）时回退直接读变更目录文件 → 实现前呈现设计蓝图等待用户 "确认"（设计确认门）→ 按任务标签（[代码]/[测试]/[DB脚本]/[使用说明]）实现并勾选 tasks.md（仅当规格行为完整实现才可勾选 `- [x]`，部分完成或推迟不算）→ 实现后执行**硬编译检查**（配置载体 `.iagent/config.yaml` 的 `compileCheck`、命令运行时探测、`autoFix=true` 时自动修复最多 `maxRetries`（默认 3）次、结构化证据）→ **仅 `pass` / `not-applicable` / `disabled` 进入测试执行关卡，`fail` 暂停**；发现需要缩小/推迟/简化规格行为以让任务通过时 MUST 表面化并询问，禁止默默缩减。

`[测试]` 任务 SHALL 委派 `iagent_test` 技能生成测试代码，MUST NOT 在 apply 内另立一套测试规则。测试任务与实现任务存在依赖时 MUST 串行执行（测试依赖实现完成）。

**编译检查（硬门）**：技能 SHALL 在全部任务完成后执行编译检查，其终态只允许 `pass` / `fail` / `not-applicable` / `disabled` 四值（定义见 `compile-check-gate` 能力）。MUST NOT 提供会话级跳过出口（正文与输出模板 MUST NOT 出现「跳过检查」「跳过并记录警告」一类选项）；`disabled` 仅来自项目 `.iagent/config.yaml` 的 `compileCheck.enabled: false`，MUST NOT 由会话内授权伪造；`not-applicable` 仅当运行时未探测到任何可编译产物，MUST NOT 记为通过。自动修复重试耗尽后 MUST 暂停并报告（`autoFix=false` 时首次失败即暂停），MUST NOT 进入测试执行门、MUST NOT 勾选未完成任务、MUST NOT 建议归档。

**变更范围识别降级链**：技能 SHALL 按「变更文件（`tasks.md` 声明的产出与 `Spec Ref`）→ `git diff` 的已修改文件 → 状态 JSON 的 `contextFiles` / `changeRoot`」识别变更范围；MUST NOT 依赖状态 JSON 中不存在的 `allowedEditRoots` 字段（Step 2 的 workspace 护栏同样 MUST NOT 以该字段为必需条件，缺失时降级并记 WARN）。任一来源缺失时 SHALL 降级到下一来源并记录 WARN，MUST NOT 静默跳过编译检查。

**批后增量检查**：当 `compileCheck.incremental=true`（缺省）时，技能 SHALL 在每批任务完成后复用收尾全量的同一条命令执行本批改动范围的编译检查，失败即进入与收尾全量检查相同的自动修复循环；收尾仍执行一次全量检查。`incremental=false` 时只做收尾全量检查。

**编译证据与生命周期**：技能 SHALL 在 `.openspec-tmp/pipeline-<change-name>/compile-report.md` 写入结构化证据（列名 `change` / `command` / `exitCode` / `errorCount` / `fixedCount` / `status` / `scope` / `timestamp` / `reason`，多条命令逐行记录、列名不变）并向 handoff 包 `## 阶段结论` 追加 `compile` 行。收尾清理 MUST NOT 删除证据文件与 handoff 包（保留至父流程归档收尾）；独立调用时保留证据并在摘要中报告路径。

**测试执行关卡**：技能 SHALL 在编译检查之后运行本次变更范围内的测试——`[测试]` 任务产出的测试文件加上变更文件的对应既有测试。存量失败测试 MUST NOT 阻塞流程，仅以 WARN 展示；变更范围内的测试失败 MUST 进入失败处置分支。项目无测试框架时关卡 SHALL 降级为 WARN 并跳过，MUST NOT 阻塞流程。

**完成段（提案制品暂存）**：全部任务完成并通过测试关卡后，技能 SHALL 检测活跃变更并对**提案制品**执行**精确暂存**——清单固定为该变更目录下的 `proposal.md` / `design.md` / `tasks.md` / `exploration.md` / `specs/**/*.md`，逐条校验前缀 `openspec/changes/<change-name>/`，MUST NOT 使用 `git add -A` 或 `git add openspec`，MUST NOT 纳入 `attachments/**` 与 `需求文档.md`。暂存后 SHALL **提示**用户提案制品已暂存并给出建议的提交信息尾行 `提案: <change-name>`，MUST NOT 自动执行 `git commit`（人工闸保留）。仓库未跟踪 `openspec/` 或暂存失败时 SHALL 只记录 WARN 并提示手动处理，MUST NOT 阻断实现收尾。

#### Scenario: 设计确认门

- **WHEN** spec-apply 获取到待实现任务清单
- **THEN** 技能呈现统一批次计划（任务分组/复杂度/涉及文件）并暂停等待用户显式 "确认" 后才开始写代码

#### Scenario: 任务上下文获取

- **WHEN** spec-apply 启动并需要获取任务清单与上下文
- **THEN** 技能优先运行 `iagent spec instructions apply --change <name> --json`，从返回的 contextFiles（artifact→文件路径映射）/ progress / 动态 instruction 获取结构化任务上下文；命令不存在或执行失败（旧版 CLI 不支持）时回退为直接读变更目录文件（tasks.md / proposal.md / specs/ / design.md），并在日志记录回退原因

#### Scenario: 任务勾选推进

- **WHEN** 一个任务的规格行为完整实现（不是部分完成或推迟）
- **THEN** 对应 tasks.md 条目从 `- [ ]` 更新为 `- [x]`；部分完成或推迟的实现 SHALL NOT 勾选 `- [x]`

#### Scenario: scope-creep 防护

- **WHEN** 实现过程中发现需要缩小、推迟或简化规格行为才能让某任务通过
- **THEN** 技能 MUST 将发现表面化（标记 `[待确认]` 并说明差异）向用户询问，SHALL NOT 默默缩小/推迟/简化规格行为以让任务勾选通过；用户确认后须同步更新 proposal/specs/design 才可继续

#### Scenario: 编译检查读取新配置载体

- **WHEN** 全部代码任务完成、技能进入编译检查
- **THEN** 技能从 `.iagent/config.yaml` 读取 `compileCheck`（缺段即 `enabled=true` 等默认值），MUST NOT 以 `openspec/config.yaml` 作为权威来源（旧位置仅一次 WARN）

#### Scenario: 编译命令按目标项目探测

- **WHEN** `compileCheck.command` 为空且变更文件命中某构建描述符
- **THEN** 技能按该描述符构造并执行命令（如 `pom.xml` → `mvn compile -DskipTests`），MUST NOT 固化本项目命令

#### Scenario: 编译检查硬门无跳过出口

- **WHEN** 编译失败且自动修复重试耗尽
- **THEN** 技能暂停并报告剩余错误，MUST NOT 提供「跳过检查」选项、MUST NOT 进入测试执行门、MUST NOT 给出归档建议

#### Scenario: 无可编译产物记不适用

- **WHEN** 变更不含可编译产物且未配置命令
- **THEN** 技能记录 `not-applicable` 终态并在摘要中写明「未执行编译检查（无可编译产物）」，MUST NOT 表述为通过

#### Scenario: 项目级显式禁用

- **WHEN** `.iagent/config.yaml` 声明 `compileCheck.enabled: false`
- **THEN** 技能记录 `disabled` 终态并在摘要中说明「项目级显式禁用」，MUST NOT 提供会话级跳过，也 MUST NOT 记为通过

#### Scenario: 变更范围来源降级

- **WHEN** 状态 JSON 不含 `allowedEditRoots` 或 `git diff` 不可用
- **THEN** 技能降级到 `tasks.md` 产出声明与 `contextFiles` / `changeRoot` 推断范围并记录 WARN，MUST NOT 因此跳过编译检查

#### Scenario: Step 2 护栏不依赖不存在的字段

- **WHEN** 技能解析 `iagent spec status --change ... --json`
- **THEN** workspace 护栏 MUST NOT 以 `allowedEditRoots` 为必需条件；该字段缺失时按 `changeRoot` / `contextFiles` 继续并记 WARN，MUST NOT 因此把变更判为不可实现

#### Scenario: 批后增量检查

- **WHEN** `compileCheck.incremental=true` 且某批任务已完成
- **THEN** 技能对该批改动范围复用收尾全量的同一条命令执行编译检查，失败即进入自动修复循环（与收尾全量检查同一重试预算）

#### Scenario: 编译证据产出与保留

- **WHEN** 编译检查结束（任一终态）
- **THEN** `.openspec-tmp/pipeline-<change-name>/compile-report.md` 存在且含九个必填字段，handoff 包 `## 阶段结论` 含 `compile` 行；收尾清理后两者仍在

#### Scenario: [测试] 任务委派测试生成技能

- **WHEN** 批次命中带 `[测试]` 标签的任务
- **THEN** 技能委派 `iagent_test`（传测试层级与优先级）生成测试代码，不在 apply 内自行实现测试规则

#### Scenario: [测试] 任务不按补充文档路由

- **WHEN** 处理带 `[测试]` 标签的任务
- **THEN** 技能 MUST NOT 将其归入补充文档类别，MUST NOT 按 `产出:` 默认路由把测试文件写入 `<changeRoot>/attachments/`；测试代码 SHALL 由测试生成技能按项目测试目录结构落盘

#### Scenario: 未标注任务仍按代码实现处理

- **WHEN** 任务无任何类型标签
- **THEN** 技能沿用既有行为按代码实现处理（向后兼容不变）

#### Scenario: 测试执行关卡运行变更范围

- **WHEN** 编译检查放行且变更范围内存在测试
- **THEN** 技能运行变更范围测试（`[测试]` 任务产出 + 变更文件的既有测试），通过后进入收尾

#### Scenario: 存量失败测试不阻塞

- **WHEN** 测试执行关卡中变更范围外的既有测试失败
- **THEN** 技能仅输出 WARN 展示该类失败，不计入本次失败，不阻塞流程

#### Scenario: 变更范围测试失败处置

- **WHEN** 变更范围内的测试失败
- **THEN** 技能进入失败处置分支（自动修复重试上限 3 次）；仍失败则暂停并报告用户，MUST NOT 勾选对应任务、MUST NOT 进入归档

#### Scenario: 项目无测试框架时降级

- **WHEN** 项目未配置任何测试框架
- **THEN** 测试执行关卡降级为 WARN 并跳过，不阻塞流程

#### Scenario: 测试任务与实现任务的依赖串行

- **WHEN** 某 `[测试]` 任务的被测实现属于同批次另一任务
- **THEN** 技能将该 `[测试]` 任务置于实现任务之后的批次串行执行，MUST NOT 与实现任务并发

#### Scenario: 完成段精确暂存提案制品

- **WHEN** apply 全部任务完成并通过测试关卡
- **THEN** 技能对 `openspec/changes/<change-name>/` 下的 proposal / design / tasks / exploration / specs 逐条执行 `git add <精确路径>`，并提示建议提交信息尾行 `提案: <change-name>`

#### Scenario: 暂存不使用全量添加

- **WHEN** 技能构造暂存清单
- **THEN** MUST NOT 使用 `git add -A` / `git add openspec`，MUST NOT 纳入 `attachments/**` 与 `需求文档.md`

#### Scenario: 暂存后不自动提交

- **WHEN** 提案制品暂存成功
- **THEN** 技能 MUST NOT 执行 `git commit`，人工确认与提交动作仍由用户（或 commit 技能）发起

#### Scenario: 暂存失败不阻断收尾

- **WHEN** 仓库未跟踪 `openspec/` 或暂存命令失败
- **THEN** 技能记录 WARN 并提示手动处理，实现收尾与后续归档 MUST NOT 被阻断

### Requirement: spec-apply 派发协议与共享资源协议

**共享资源协议（四载体）**：

- **变更级 handoff 包**：协调者 SHALL 在**首次派发前**确保流程级工作区 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md` 存在。该包由 propose 阶段产出（跨阶段共享）；独立调用 apply 且包不存在时，技能 SHALL 按同一六节协议产出**一次**。六节为 —— `## 变更摘要`（proposal Why/What 蒸馏）、`## 契约`（接口签名 / 数据结构 / 表字段，由 specs + design 蒸馏）、`## 规范要点`（**项目侧** `.iagent/rules/coding-rules.md` 的关键防护摘要，协调者蒸馏一次；该文件为 `openspec/rules/ai-coding.md` 要点经 `iagent init` 蒸馏的产物）、`## 文件归属表`（派发单元 → 允许改动的文件）、`## Codebase 摘要`（协调者预扫描结论；`debug` 场景可复用 `investigation-digest` 结论）、`## 已产出（跨单元可见）`。handoff 包是子代理的**唯一必读制品**；产出后 MUST NOT 整包重产，只允许向 `## 已产出` 与 `## 阶段结论` 追加。
- **产出登记表**：每批完成后协调者 SHALL 向 `## 已产出（跨单元可见）` 节**追加**该批产出文件与公开签名，使后续批次子代理无需重扫代码即可获知前序产出。
- **回执最小化**：子代理回执 SHALL 采用固定格式 `<任务 id> | <状态> | <产出文件> | <公开签名>`，MUST NOT 粘贴代码正文；失败任务回执仍 MUST 含失败原因摘要。协调者 SHALL 据回执更新 tasks.md 与登记表。**「公开签名」定义**：该单元产出中**可被其他单元引用**的符号签名 —— 函数 / 方法 / 类型 / 接口 / 导出常量 / CLI 命令（含参数与返回类型）的声明行；无此类产出时记「无」。
- **共享指令前缀**：调度指令 SHALL 采用固定顺序「共享前缀（包路径 / 规范要点引用 / 回执格式 / 禁止项）→ 单元差异（本单元任务清单）」，使前缀在同一流程内跨派发字节一致。

**调度指令瘦身**：调度指令 MUST 含「handoff 包路径 + 本单元任务清单（含每任务全量细节与 Spec Ref）+ 回执格式 + 禁止项」，MUST NOT 再内联 coding 规范摘要全文（改引用包 `## 规范要点` 节）。任务细节 MUST 保持在指令内联，使子代理无需读 tasks.md。

**禁止项与包缺口回执**：子代理 MUST NOT 重读 proposal/specs/design（包已覆盖）与重跑包已覆盖的 CodeGraph 查询；MAY 查询包未覆盖内容，但回执 MUST 附**包缺口回执**（缺什么、补查了什么），协调者 SHALL 据此回填包，回填失败记 WARN 且 MUST NOT 阻断。包是制品的**蒸馏视图**而非替代品：包缺项时子代理 MUST 补查制品本身，MUST NOT 凭包内容猜测字段或契约。

**一致性校验**：阶段入口 SHALL 比对 handoff 包头部的制品指纹与当前制品；不一致（用户手改制品 / 包陈旧）时 SHALL 重建并记录 WARN，MUST NOT 静默沿用陈旧包。

**工作区生命周期**：`.openspec-tmp/pipeline-<change-name>/` 为**流程级**工作区 —— propose 产出、verify/apply/archive 只读追加、**归档收尾统一清理**；清理逻辑 MUST 同时识别 `pipeline-` 与旧 `apply-` 前缀（迁移期兼容），清理失败 SHALL 记 WARN 且 MUST NOT 阻断或改变已写入的阶段结论。**独立调用 apply 时由该技能自建，但收尾 MUST NOT 删除 `compile-report.md` 与 `handoff-pack.md`** —— 保留证据并在摘要报告路径，清理责任移交用户（与 `compile-check-gate / 编译证据生命周期` 一致）；父流程调用时由 archive / bulk-archive 在归档成功后清理。

**fail-safe 降级**：工作区不可写 / 包产出失败 / **项目无 `.iagent/rules/coding-rules.md`** 时，技能 SHALL **退化为既有内联注入行为**并记 WARN，MUST NOT 阻断实现；流程级临时工作区不可写时先回退系统临时目录，再失败方退化。

**批次形态豁免**：批次含少于 2 个派发单元时，协调者 SHALL 直接实现，MUST NOT 派发子代理且 MUST NOT 新产出包（已有 handoff 包仍可只读复用）。`auto-mode=true` 只跳过设计确认门，共享资源协议 SHALL 照常生效。

#### Scenario: 跨阶段复用 propose 产出的包

- **WHEN** apply 被父流程调用且 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md` 已由 propose 产出
- **THEN** 技能直接只读该包并按单元派发，MUST NOT 重新蒸馏 proposal/specs/design，MUST NOT 重产整包

#### Scenario: 独立调用时按同一协议产出包

- **WHEN** 独立调用 spec-apply 且 handoff 包不存在、批次含 ≥2 派发单元
- **THEN** 技能在 `.openspec-tmp/pipeline-<change-name>/` 产出 `handoff-pack.md`（六节齐全）后派发，格式与本协议一致

#### Scenario: 上下文包一次性产出

- **WHEN** 批次含 2 个及以上派发单元且即将首次派发
- **THEN** 协调者确保流程级工作区中存在 `handoff-pack.md`，含变更摘要 / 契约 / 规范要点 / 文件归属表 / Codebase 摘要 / 已产出六节；后续批次 MUST NOT 重产整包

#### Scenario: 流程级工作区收尾清理

- **WHEN** 流程走到 archive 收尾
- **THEN** 归档技能清理 `.openspec-tmp/pipeline-<change-name>/`，并同时识别旧 `apply-<change-name>/` 前缀；清理失败记 WARN，MUST NOT 改写既有阶段结论、MUST NOT 阻断归档

#### Scenario: 独立调用 apply 保留证据不强制清理

- **WHEN** 独立调用 spec-apply 完成收尾（无父流程）
- **THEN** 技能 MUST NOT 删除 `compile-report.md` 与 `handoff-pack.md`，在摘要中报告证据路径；清理责任移交用户

#### Scenario: 指纹不一致时重建

- **WHEN** 阶段入口发现 handoff 包头部指纹与当前 proposal/design/specs/tasks 不一致
- **THEN** 技能重建包并记录 WARN，MUST NOT 静默使用陈旧包

#### Scenario: 阶段结论只追加

- **WHEN** apply 阶段收束
- **THEN** 技能向包追加 `## 阶段结论` 一节（含 phase / status / artifact / nextAllowed），MUST NOT 改写其它阶段已写入的结论

#### Scenario: 调度指令瘦身与唯一必读制品

- **WHEN** 协调者构造某派发单元的调度指令
- **THEN** 指令含包路径、本单元任务清单、回执格式与禁止项，**不含** coding 规范摘要全文；子代理按「读包 + 本单元任务清单」即可开工，无需读 proposal/specs/design

#### Scenario: 产出登记表跨批共享

- **WHEN** 一批的多个派发单元全部返回且协调者完成校验
- **THEN** 协调者把该批产出文件与公开签名追加进包 `## 已产出（跨单元可见）` 节；下一批子代理读包即可获知前序产出，无需重扫代码

#### Scenario: 回执最小化

- **WHEN** 子代理完成其派发单元
- **THEN** 回执为 `<任务 id> | <状态> | <产出文件> | <公开签名>` 四列格式，不含代码正文；失败任务额外含失败原因摘要

#### Scenario: 共享指令前缀字节一致

- **WHEN** 同一流程向内多次派发不同派发单元
- **THEN** 各次调度指令的共享前缀部分（包路径 / 规范要点引用 / 回执格式 / 禁止项）字节一致，仅单元差异部分不同

#### Scenario: 禁止重读与禁止重跑已覆盖查询

- **WHEN** 子代理收到含 handoff 包的调度指令
- **THEN** 子代理 MUST NOT 重读 proposal/specs/design，MUST NOT 重跑包已覆盖的 CodeGraph 查询

#### Scenario: 空值处置不留空不编造

- **WHEN** 变更不涉及接口 / 数据结构 / 表字段，或某派发单元无可被其他单元引用的符号
- **THEN** 包 `## 契约` 节相应位置与回执「公开签名」列记「无」，MUST NOT 留空、MUST NOT 编造签名

#### Scenario: 包缺口回执与回填

- **WHEN** 子代理发现 handoff 包未覆盖其所需信息
- **THEN** 子代理 MAY 补查，但回执 MUST 附包缺口回执（缺什么、补查了什么）；协调者据此回填包，回填失败记 WARN 且不阻断流程

#### Scenario: 包机制失效 fail-safe 降级

- **WHEN** 临时工作区不可写、包产出失败，或项目无 `.iagent/rules/coding-rules.md`
- **THEN** 技能退化为既有内联注入行为并记 WARN，实现流程 MUST NOT 被阻断

#### Scenario: 单任务批次不新产出包

- **WHEN** 批次含少于 2 个派发单元且不存在既有 handoff 包
- **THEN** 协调者直接实现该任务，不派发子代理，不新产出包

#### Scenario: auto-mode 不豁免共享资源协议

- **WHEN** 技能以 `auto-mode=true` 被调用（如 auto-workflow Phase 4）
- **THEN** 设计确认门被跳过，但 handoff 包复用/产出、产出登记表、回执最小化与共享指令前缀均照常生效

#### Scenario: 派发单元与并发上限

- **WHEN** 批次含多个派发单元
- **THEN** 技能每单元派发一个子代理，同时运行数不超过 `apply.concurrency`（缺省 3），并采用滑动窗口派发；`apply.concurrency` 非法（非正整数）时告警并回退为 3

#### Scenario: 跨单元同文件拆出并发组

- **WHEN** 不同派发单元的任务会修改同一文件
- **THEN** 该任务从并发组拆出、串行执行；文件归属表须反映该拆分结果

#### Scenario: 无子代理能力的运行时降级

- **WHEN** 运行时不提供子代理分派工具
- **THEN** 技能降级为全串行实现并告知用户

#### Scenario: 任务勾选与失败重试由协调者集中管理

- **WHEN** 某个派发单元返回
- **THEN** 协调者按任务要求校验结果后集中更新 tasks.md 勾选（仅确认完整实现者勾选），子代理 MUST NOT 修改 tasks.md；某任务失败时协调者串行重试一次，仍失败则暂停并报告

### Requirement: spec-archive 归档技能

spec-archive 技能 SHALL 实现归档工作流：检查 CONTEXT.md 术语同步（不存在则创建）→ 从变更的 exploration.md 提取决策/术语/边界场景并追加到 `openspec/specs/<capability>/explorations.md`（冲突标记"已过时"但保留历史）→ **只读报告**需求文档存在性 → AI 智能合并 delta spec 到主 spec（ADDED/MODIFIED/REMOVED/RENAMED）→ 调用 `iagent spec archive` 移动目录 → CodeGraph **按需**同步（失败仅 WARN、不阻断）→ 追加 ARCHIVE-INDEX 条目。

**归档写入面（强制）**：归档 SHALL 只能写入 `openspec/specs/**`、`openspec/CONTEXT.md` 与 `openspec/changes/archive/ARCHIVE-INDEX.md`（追加式）；`openspec/changes/**` 在归档流程中只允许**整目录移动**，MUST NOT 改写其中任何文件的既有内容。流程级临时工作区 `.openspec-tmp/` 的清理不属于归档写入面（临时产物、不进提交面），见下文「归档收尾清理」。

**归档只读（强制）**：MUST NOT 修改 `openspec/changes/archive/` 下的既有内容——已归档变更是历史事实。整目录移动（`openspec/changes/<name>/` → `openspec/changes/archive/YYYY-MM-DD-<name>/`）SHALL NOT 视为改写；`ARCHIVE-INDEX.md` 的**追加**为该护栏的显式例外。

**需求文档只读报告**：技能 SHALL 在移动目录前检查变更目录内 `需求文档.md` 是否存在，并可读取变更 `exploration.md` 的 `## 需求文档状态` 段（`requirementDocStatus`）用于跨会话追溯；结果**只进入摘要报告**。MUST NOT 生成、MUST NOT 就地增量对齐、MUST NOT 迁出到 `openspec/devdocs/`，MUST NOT 委派 `iagent_requirement_doc`。`requirementDocStatus` MUST NOT 再被用于触发任何写入动作。

**MUST NOT** 调用 `iagent spec reindex` 或任何索引重建（索引已退役，归档不含索引步骤）；`ARCHIVE-INDEX.md` 的维护方式为**纯追加本批条目**，结构损坏时 MUST NOT 全量重建。

**CodeGraph 段 SHALL 采用能力探测 + 锁阶梯**：先按「MCP 具名工具 → 可用通道 → CLI `status --json`」探测可用性；需同步时读 `.codegraph/` 下的 `writer.pid` 判存活——**存活则只读复用**既有索引并 MUST NOT 执行 `codegraph unlock`；**不存活才** `codegraph unlock` + 重试一次；仍失败则降级 Glob/Grep 并记录 WARN。仅当确认**无 daemon**（纯 CLI 用户）时才执行一次 `codegraph sync`；daemon 活跃时 MUST NOT 显式 sync（同步责任归 daemon 文件监听）。全流程 MUST NOT 询问用户是否重试（沿用既有「任何错误不询问用户」口径）。

**归档收尾清理（流程级工作区）**：归档成功后技能 SHALL 清理该变更的 `.openspec-tmp/pipeline-<change-name>/`（含 `compile-report.md` 与 `handoff-pack.md`），同时识别旧 `apply-` 前缀；清理 MUST 发生在向 handoff 包追加 `phase=archive` 结论之后。清理失败 SHALL 记 WARN，MUST NOT 阻断归档、MUST NOT 改写已写入的阶段结论。清理 SHALL 经跨平台删除（`node -e "fs.rmSync(...)"`）执行，`allowedTools` 因此 SHALL 含 `Bash(node:*)`。

技能的 `allowedTools` SHALL 覆盖正文实际发起的调用：正文经 Bash 运行 `codegraph` CLI（`status` / `unlock` / 条件 `sync`）时 MUST 含共享常量 `CODEGRAPH_CLI`（`Bash(codegraph:*)`），MUST NOT 只写 MCP 条目。**因正文不再委派需求文档技能，`allowedTools` MUST NOT 保留 `Skill(iagent-requirement-doc)` 条目**（最小权限）；**因 Step 6 的 `需求文档.md` 迁移被删除，`Bash(ls:*)` 不再有正文调用，MUST NOT 保留该条目**；清理步骤所需的 `Bash(node:*)` SHALL 保留（真实调用支撑），MUST NOT 以 `Bash(rm:*)` 等更宽条目替代。

#### Scenario: 需求文档存在时只报告不写入

- **WHEN** 变更目录内存在 `需求文档.md`
- **THEN** 摘要报告「需求文档：已存在（未改写）」，文件内容与修改时间不变，MUST NOT 就地增量对齐

#### Scenario: 需求文档缺失时只报告不生成

- **WHEN** 变更目录内不存在 `需求文档.md` 且 `requirementDocStatus` 为任一取值（含 `absent`）
- **THEN** 摘要报告「需求文档：缺失」，MUST NOT 生成、MUST NOT 委派 `iagent_requirement_doc`，并继续归档

#### Scenario: 需求文档不迁出 devdocs

- **WHEN** 归档目录移动完成
- **THEN** `openspec/devdocs/` 不新增任何来自本次归档的 `需求文档.md`，文件随变更目录留在 `archive/` 内

#### Scenario: 需求文档状态读取失败不阻断

- **WHEN** 读取 `## 需求文档状态` 或检查文件存在性时 I/O 失败
- **THEN** 输出含路径与原因的 WARN，摘要记「需求文档：状态不可读」，继续归档，MUST NOT 生成或对齐

#### Scenario: 已归档内容只读

- **WHEN** 归档流程任一环节需要访问 `openspec/changes/archive/**` 下既有变更
- **THEN** 只读访问；MUST NOT 改写其中任何文件的既有内容（整目录移动与 ARCHIVE-INDEX 追加除外）

#### Scenario: 索引纯追加不重建

- **WHEN** `ARCHIVE-INDEX.md` 存在但结构部分损坏
- **THEN** 技能仅追加本批最小条目并输出 WARN 提示人工修复，MUST NOT 重建或覆盖整个文件

#### Scenario: 归档收尾清理流程级工作区

- **WHEN** 归档成功完成并已追加 `phase=archive` 结论
- **THEN** 技能清理 `.openspec-tmp/pipeline-<change-name>/`（同时识别旧 `apply-` 前缀），清理失败记 WARN 且不阻断归档

#### Scenario: 探索记忆同步

- **WHEN** 变更含 exploration.md 且其 Decisions 与能力级 explorations.md 的既有决策冲突
- **THEN** 旧决策标记为"已过时（由 <change-name> 取代）"保留，新决策追加，历史不被删除

#### Scenario: delta spec 智能合并

- **WHEN** 变更的 specs/<capability>/spec.md 含 ADDED 与 MODIFIED 需求
- **THEN** 技能将 ADDED 需求追加到主 spec、MODIFIED 需求更新对应条目，再执行 iagent spec archive 移动

#### Scenario: MODIFIED 目标在主 spec 缺失

- **WHEN** delta spec 的 `## MODIFIED Requirements` 条目在主 spec 中找不到对应的需求标识
- **THEN** 技能把该需求按新增需求追加到主 spec，并在归档摘要中列出「MODIFIED 目标缺失（已追加）」告警，继续归档；MUST NOT 中止归档、MUST NOT 丢弃该需求

#### Scenario: 归档不含索引重建

- **WHEN** archive 完成目录移动
- **THEN** 流程中 MUST NOT 调用 `iagent spec reindex`，也 MUST NOT 读写任何 `index.db`

#### Scenario: daemon 活跃时不同步也不解锁

- **WHEN** 归档 CodeGraph 段检测到 `writer.pid` 指向的进程仍存活
- **THEN** 技能只读复用既有索引，MUST NOT 执行 `codegraph sync`、MUST NOT 执行 `codegraph unlock`

#### Scenario: 无 daemon 时按需同步一次

- **WHEN** 归档检测到无 daemon 且需要在归档后更新索引
- **THEN** 技能经 CLI 执行 `codegraph sync` 恰一次；失败仅 WARN，不阻断归档

#### Scenario: 锁阶梯失败降级 Grep

- **WHEN** `writer.pid` 不存在、`codegraph unlock` 后重试一次仍失败
- **THEN** 技能降级为 Glob/Grep 并记录 WARN，继续完成归档，MUST NOT 询问用户

#### Scenario: CodeGraph 同步失败非阻塞

- **WHEN** CodeGraph 任一步骤执行失败
- **THEN** 输出 WARN 日志继续完成归档流程，不回滚
