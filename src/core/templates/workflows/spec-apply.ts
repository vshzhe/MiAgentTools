/**
 * spec 类型技能模板：实现变更。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { deriveCommandContent } from '../derive-command.js';
import { SUBAGENT_DISPATCH } from '../tool-whitelist.js';

const BATCH_SCHEDULING_FULL = `6. **实现任务（批调度循环，直至完成或被阻塞）**

   **共享上下文包（流程级，只产出一次）：**

   - 设计确认后（或 auto-mode 生效时）、首次派发**之前**，编排器在流程级临时工作区（项目根下 \`.openspec-tmp/apply-<change-name>/\`，用 path.join 构建）内的 \`context-pack.md\` 产出**一份**共享上下文包 —— 只在首次派发前产出一次，不按批重产、也不按单元重产
   - 上下文包是子代理**唯一**必读的制品：每个子代理只读该包加上自己单元的任务清单，变更目录中的其他内容一律不读
   - 产出后编排器 MUST NOT 重产整包 —— 只允许向包的 \`## 已产出（跨单元可见）\` 章节**追加**内容（见批后步骤）
   - 上下文包恰有六个章节，顺序如下：
     - \`## 变更摘要\` — 从 proposal.md 蒸馏出的变更要点（why/whatChanges）：本变更做什么、为什么
     - \`## 契约\` — 从 specs + design 蒸馏出的接口签名 / 数据结构 / 表字段
     - \`## 规范要点\` — 编排器一次性蒸馏出的 \`openspec/rules/ai-coding.md\` 关键护栏（绝不由各子代理分别蒸馏）
     - \`## 文件归属表\` — 派发单元 → 该单元允许修改的文件
     - \`## Codebase 摘要\` — 编排器的预扫描结论（分层 / 依赖事实，否则子代理需重新推导）
     - \`## 已产出（跨单元可见）\` — 产出登记表：已产出文件 + 公开签名，每批结束后追加

   **派发前加载并发上限：**
   - 从 \`openspec/config.yaml\` 读取 \`apply.concurrency\`（正整数）
   - 未配置时：使用默认上限 3
   - 取值非法（非正数或非整数）时：告警用户并降级到默认值 3
   - 该上限约束一个批内同时运行的子代理（派发单元）数量；不拆分、不重排批次

   **加载相邻合并配置：**
   - 从 \`openspec/config.yaml\` 读取 \`apply.mergeAdjacent\`（布尔）
   - 未配置时：默认 true（相邻的简单任务合并为一个派发单元）
   - 为 false 时：在模板层面跳过合并行为

   **加载增量检查配置：**
   - 从 \`openspec/config.yaml\` 读取 \`apply.incrementalCheck\`（布尔）
   - 未配置时：默认 true
   - 为 true 时：每批结束后运行增量编译检查（详见 Step 8）
   - 为 false 时：跳过增量检查，仅在 Step 8 运行最终全量检查

   **批调度循环**（按 Step 5.5 确认的统一批计划逐批执行）：

   **批派发形态判定（显式，每批开始时 强制）：**
   - 批含 **≥2** 个派发单元 → 产出共享上下文包（若尚未产出）并派发子代理（见第 2–5 条）
   - 批含 **<2** 个派发单元 → 由编排器自己直接实现任务，且 MUST NOT 产出上下文包（单任务批永不产出包）

   1. **单任务批**：由你直接实现该任务 —— 不派发子代理、不输出并发执行提示；标明按串行执行（单任务批）；展示当前正在处理的任务，完成所需代码改动，保持改动最小且聚焦
   2. **多单元批 —— 并发状态提示**：派发含多个派发单元的批**之前**，输出醒目提示，说明批位置（Batch N/M）、正在派发的子代理数量（= 派发单元数）、涉及的任务组（本批 \`dispatchUnits\` 的 \`group\` 标签；无 group 标签的单元用任务 id），并提醒任务勾选更新与失败重试由编排器集中管理
   3. **派发前重叠检查（跨单元降级）**：跨派发单元检查本批任务的目标文件（依据任务描述、Spec Ref 与 \`产出:\` 声明）；不同单元中会修改同一文件的任务 MUST 从并发组中拆出、改为串行执行 —— 同一单元内的任务由同一子代理串行实现，因此同组文件绝不会被并发编辑
   4. **并发派发 —— 每个派发单元一个子代理**：为每个待处理的派发单元派发一个子代理；该单元的任务由该子代理按任务顺序串行实现；批内同时运行的子代理（派发单元）数 MUST NOT 超过并发上限；采用滑动窗口派发 —— 一旦某个子代理完成，立即派发同一批中下一个待处理的派发单元
   5. **子代理派发指令 MUST 包含**（先共享指令前缀，再单元差异部分）：
      - 上下文包路径 —— 子代理**唯一**必读的制品（包位于流程级临时工作区）；**MUST 先读取本包，再执行其它任何动作** —— 包已承载蒸馏后的契约 / 摘要 / 文件归属表，因此子代理 MUST NOT 通过重读 proposal/specs/design 或重跑包已覆盖的 CodeGraph 查询来重新推导这些信息
      - 指向包的 \`## 规范要点\` 章节以获取 AI 编码护栏（绝不猜测 DB 字段、API 参数或业务规则 —— 标 **[待确认]**）—— 指令 MUST NOT 内联完整护栏摘要
      - 回执格式与禁止项清单（见下文共享资源协议）
      - 按顺序给出该派发单元的任务清单及每个任务的完整细节（描述、需求、Spec Ref），并要求按该顺序串行实现单元任务 —— 任务细节 MUST 内联在指令中，使子代理无需读取 tasks.md
      - 与任务相关的源文件清单 —— 变更制品文件（proposal/specs/design）已由包覆盖，MUST NOT 再列入清单供重读
      - 临时工作区路径及约束：子代理只把文件写入该工作区 —— MUST NOT 删除工作区，MUST NOT 自行按任务创建/清理临时目录
      - 显式禁止：**禁止修改 tasks.md** —— 子代理 MUST NOT 编辑任务勾选框
      - **⛔ EXIT GUARD (强制 — 子代理退出守卫)**: 完成本单元分配的全部任务后 MUST **立即停止并提交回执**给编排器；MUST NOT 进入 plan 模式 / 设计模式、不得提出后续步骤、不得超出分配的任务范围、不得建议归档或验证步骤；唯一职责 = 实现本单元分配的任务清单、产出回执的四个字段并返回；编排器是唯一有权判停、汇总、推进阶段的角色 —— 子代理 MUST NOT 越权替代编排器做阶段收尾决策
   6. **整批返回后**：对照任务需求核验每个子代理的结果 → 由你集中更新 tasks.md（\`- [ ]\` → \`- [x]\`，仅限已确认完成的任务）→ 把本批的产出文件与公开签名追加到包的 \`## 已产出（跨单元可见）\` 章节 → 进入下一批
   7. **失败任务**：由你串行重试该失败任务一次 → 若重试仍失败，暂停并向用户报告（该任务保持未勾选 \`- [ ]\`）

   **共享资源协议 —— 子代理职责与回执：**

   - **回执（回执最小化）**：子代理以固定四列回执行式回报，每个任务一行 —— \`<任务 id> | <状态> | <产出文件> | <公开签名>\`。回执 MUST NOT 粘贴代码正文。失败任务的回执 MUST 仍带失败原因摘要。
   - 「公开签名」定义：本单元产出中可能被其他单元引用的符号签名 —— 函数 / 方法 / 类型 / 接口 / 导出常量 / CLI 命令，含其参数与返回类型。若本单元没有可被引用的产出，记「无」。
   - **空值**：包的 \`## 契约\` 章节无对应条目时，在包中与回执的公开签名列均记「无」。MUST NOT 留空 / MUST NOT 编造。
   - **共享指令前缀**：每条派发指令按固定顺序拼装 —— 共享前缀（上下文包路径 / \`## 规范要点\` 引用 / 回执格式 / 禁止项）→ 单元差异部分（本单元任务清单）。同一流程的每次派发，其共享前缀 MUST 逐字节一致。
   - **禁止项**（每条派发指令 MUST 携带它们）：子代理 MUST NOT 重读 proposal/specs/design；子代理 MUST NOT 重跑包已覆盖的 CodeGraph 查询。对包未覆盖的内容 MAY 运行补充查询，但此时回执 MUST 附上**包缺口回执**（缺了什么、查了什么）；编排器据此回填包 —— 回填失败时记录 WARN，且 MUST NOT 阻塞实现。
   - **反幻觉**：包是蒸馏视图，不是制品的替代品。包中缺少某项时，子代理 MUST 查阅制品本身，MUST NOT 猜测字段或契约。

   **共享资源协议 —— fail-safe 降级：**

   - 临时工作区不可写时：先降级到系统临时目录（\`iagent-apply-<change-name>/\`，既有的降级位置）；若仍失败，按下方降级
   - 上下文包无法产出，或项目没有 \`openspec/rules/ai-coding.md\` 时：降级为既有内联注入行为并记录 WARN —— MUST NOT 阻塞实现。降级只会让指令更长，绝不会丢弃护栏
   - \`auto-mode=true\` 只跳过 Step 5.5 设计确认门 —— 共享资源协议 MUST NOT 因 auto-mode 而豁免，仍然适用

   **环境降级（无子代理能力）：**
   - 若运行时未提供子代理派发工具（Task/Agent 一类工具），降级为由你串行实现全部任务，并告知用户已降级

   **串行降级（无依赖信息）：**
   - 若 Step 5.5 无法从 design.md 推断批计划（无可用依赖标注）：保持串行行为：对每个待办任务 —— 展示当前正在处理的任务、完成代码改动、把 tasks.md 中该任务勾选框置为 \`- [x]\`，继续下一个任务

   **任务产出处理规则：**

   实现任务时，按任务标签区分**三**类产出：

   **代码实现**（带 \`[代码]\` 标签或无标签的任务）：
   - 在合适的项目源码位置创建/修改文件
   - 遵循常规实现流程

   **测试代码**（带 \`[测试]\` 标签的任务）：
       - **MUST 内联实现**（不得委派给外部技能）—— apply 工作流直接负责测试生成，MUST NOT 委派给 \`iagent_test\` 或其他技能；整套写测试逻辑运行在实现对应生产代码的同一子代理内
       - **框架探测**：从构建文件（\`pom.xml\` → JUnit 4/5 + Mockito；\`build.gradle\` → JUnit 4/5 + Mockito；\`package.json\` → Vitest / Jest / Mocha）与结构线索（\`src/test/\` 或 \`test/\` 下的既有测试文件）探测项目测试框架；对齐**既有**测试风格（注解、断言、命名约定）—— 不得另造新风格
       - **覆盖范围**（最低要求）：① spec Scenario —— 为任务 \`Spec Ref\` 中引用的每个 \`#### Scenario:\` 写一个测试；② BCDE 边界 —— Boundary（最小/最大值、空集合）、Condition（null 入参、缺失字段）、Default（默认构造对象、未设置枚举）、Error（非法入参、抛出的异常）；③ 若某 Scenario 被判定为不可测，把结论以注释写入测试文件，使"未写"与"从未评估"可区分
       - **测试结构**：每个被测生产类一个测试类，命名为 \`<ClassName>Test\`（Java）或 \`<className>.test.<ext>\`（Node）；每个测试方法用 \`@Test\`（JUnit）/ \`it(...)\`（Vitest/Jest/Mocha）注解覆盖**一个**逻辑 Scenario；采用 Arrange-Act-Assert (AAA) 模式
       - **反模式防护**：MUST NOT 写永远通过的测试（无断言）、MUST NOT 用 \`Thread.sleep()\` 处理异步（用 \`await\` / \`CompletableFuture\`）、MUST NOT 依赖测试执行顺序（每个测试相互隔离）、MUST 用框架的 mock 库 mock 外部依赖（DB / HTTP / 文件 I/O）
       - 落盘位置遵循项目测试目录结构（如 \`src/test/java/...\`、\`test/...\`）—— \`[测试]\` 任务 MUST NOT 走 \`产出:\` → \`attachments/\` 规则，因为放在 \`attachments/\` 下的测试代码无法执行
       - \`[测试]\` 任务 MUST NOT 当作补充文档处理
       - 测试任务依赖其实现任务：当测试任务所测行为由另一任务实现时，把该测试任务排到更晚的批 —— MUST NOT 与其实现任务并发运行
   **补充文档**（带 \`[DB脚本]\`、\`[使用说明]\`、\`[API文档]\`、\`[配置示例]\`、\`[部署说明]\`、\`[测试数据]\` 标签的任务）：
   - 读取任务的 \`产出:\` 字段以确定输出路径
   - 默认路径：\`<changeRoot>/attachments/<filename>\`
   - 直接在默认 \`attachments/\` 位置创建文件，无需询问
   - 若 \`产出:\` 字段指定的路径在 \`attachments/\` 之外，或你判断其他位置更合适，MUST 暂停并询问用户确认后再放置文件
   - 用户批准其他位置后，更新 \`tasks.md\` 中的 \`产出:\` 字段以反映实际路径
   - 文件创建完成后标记该任务完成

   **计划外补充文档：**

   若实现过程中 AI 发现需要一份 \`tasks.md\` 中未列出的补充文档：
   - 暂停当前任务
   - 向用户说明所需文档及其原因
   - 等待用户确认
   - 用户确认：向 \`tasks.md\` 新增一个带相应类型标签与 \`产出:\` 路径的任务，执行它，然后继续剩余任务
   - 用户拒绝：记录该决定，不创建并继续

   **遇以下情况暂停：**
   - 任务含义不清 → 请求澄清
   - 实现暴露设计问题 → 建议更新制品
   - 遇到错误或阻塞 → 报告并等待指引
   - 用户中断 → 完成当前批、把剩余任务标为未完成，然后暂停
   - 实现揭示必须收窄、延后或简化某任务的 spec 行为才能通过 → 标 **[待确认]** 并说明差异，询问用户，确认后先更新 proposal/specs/design 再继续（见 Guardrails 中的范围蔓延护栏）

`;

export function getSpecApplyChangeSkillTemplate(): SkillTemplate {
    return {
        name: 'iagent_spec_apply',
        description: '实现变更。当 openspec/changes/ 下已有变更制品（proposal/specs/design/tasks），需要基于规格驱动实现任务清单时使用；触发词"实现变更 / apply / 执行任务 / 按规格实现"；NOT for 无变更制品时直接描述需求（改用 iagent_workflow 引导生成制品后再实现）。',
        allowedTools: `Read, Write, Edit, Glob, Grep, Bash(iagent:*), Bash(npm:*), Bash(pnpm:*), Bash(node:*), Bash(git:*), Bash(tsc:*), Bash(mvn:*), Bash(ant:*), Bash(gradle:*), Bash(go:*), Bash(cargo:*), ${SUBAGENT_DISPATCH}`,
        type: 'spec',
        instructions: `**实现前先阅读 openspec/rules/ai-coding.md 的 AI 编码护栏。** 禁止猜测数据库字段、API 参数或业务规则 —— 标 **[待确认]** 并询问用户。

按 openspec/changes/ 下的变更制品（proposal/specs/design/tasks）实现任务。

**Input**: 可选指定变更名；省略时检查能否从对话上下文推断。若含糊或有歧义，MUST 提示可用变更供用户选择。工作流也可能传入 \`auto-mode=true\` 以跳过设计确认门，实现自动执行。

**Steps**

1. **选择变更**

   已提供名称则直接使用；否则：
   - 用户提到变更时，从对话上下文推断
   - 仅存在一个活动变更时自动选择
   - 若有歧义，运行 \`iagent spec status --json\` 获取可用变更，并用 **AskUserQuestion tool** 让用户选择

   始终声明"正在使用变更：<name>"，并说明如何覆盖（如 \`/iagent:spec-apply <other>\`）。

2. **检查状态以了解 schema**
   \`\`\`bash
   iagent spec status --change "<name>" --json
   \`\`\`
   解析 JSON 以了解：
   - \`schemaName\`：正在使用的工作流（如 "spec-driven"）
   - \`planningHome\`、\`changeRoot\` 与 \`actionContext\`：规划范围与编辑约束
   - \`progress\`：任务总数、已完成数、剩余数
   - 哪个制品承载任务（spec-driven 通常为 "tasks"，其他类型以状态输出为准）

   **工作区护栏：** 若状态 JSON 报告 \`actionContext.mode: "workspace-planning"\` 且 \`allowedEditRoots\` 为空，说明本切片不支持完整工作区 apply。把关联仓库与目录视为只读上下文，请用户通过显式实现工作流选择受影响区域，并在编辑文件前 STOP。

   **跳过制品（skipped）处理：** 若状态报告某制品为 \`skipped\`（变更声明了 \`skip_specs\`），不要把它当作缺失 —— 其依赖视为已满足，其余制品照常实现。此类制品不会在 Step 3 返回的 \`instruction\` 状态中被标为未完成。

3. **获取任务清单与上下文文件**

   **主路径 —— iagent CLI \`instructions apply\`（优先）：**
   \`\`\`bash
   iagent spec instructions apply --change "<name>" --json
   \`\`\`
   解析 JSON 以获得结构化任务上下文：
   - \`contextFiles\`：制品 → 文件路径映射（proposal/specs/design/tasks → 各自的绝对路径或变更内相对路径）；以此作为权威文件清单，不要假设标准文件名
   - \`progress\`：任务总数、已完成数、剩余数（用于 Step 5 的进度展示）
   - \`taskList\`：带勾选状态与分组标签的结构化任务条目（用于 Step 5.5 的批规划）
   - \`instruction\`：动态三态指令：
     - \`"blocked"\`：制品缺失或不完整 → 建议先运行 \`iagent_spec_verify\` 补全制品；实现前 STOP
     - \`"ready"\`：制品完整且存在待办任务 → 进入 Step 4（读取上下文文件）
     - \`"all_done"\`：全部任务已完成 → 祝贺并建议归档；STOP

   **Markdown 制品上下文（所有新变更的主源）：**

   直接读取 CLI 返回的 contextFiles 中的 proposal.md、design.md、specs/**/*.md 与 tasks.md。Markdown 是唯一可编辑的真源。历史 JSON-only 变更只作只读兼容输入且 MUST 输出 WARN；apply 期间不得更新它们。

   **任务状态：** 以 tasks.md 的勾选框为唯一权威。完成任务并验证所声明的行为后，只把该任务的勾选框从 \`- [ ]\` 改为 \`- [x]\`。不要创建或更新 tasks.json，也不要运行 render 命令。

   **降级路径（不支持 \`instructions apply\` 的旧 CLI）：**
   - 直接读取 proposal.md、specs/**/*.md、design.md 与 tasks.md。
   - 记录 WARN 说明降级原因。
   - 保持相同的 Markdown 优先语义与任务勾选规则。
   **状态处理（两条路径相同）：**
   - 制品缺失（proposal/specs/design/tasks）：给出提示，建议先用 \`iagent_spec_verify\` 补全制品
   - 全部任务已完成：祝贺并建议归档
   - 其他情况：进入实现

4. **读取上下文文件**

   遵循 Step 3 的 Markdown 优先规则 —— 直接读取结构化章节：
   - **proposal.md**：Why 与 What Changes
   - **design.md**：Decisions、架构与模块依赖
   - **specs/**/*.md**：delta 需求与 Scenario
   - **tasks.md**：带勾选状态的任务清单

   后续步骤中的 proposal/design/specs/tasks 均指这些 Markdown 制品。

5. **展示当前进度**

   展示：
   - 正在使用的 Schema
   - 进度："N/M tasks complete"
   - 剩余任务概览

**5.5. 设计确认门** ⚠️ 强制

   读完上下文文件后、实现任何任务前，先构建统一并发批计划、展示设计方案摘要，并等待用户确认：

   **auto-mode 检查**：若 apply 以 \`auto-mode=true\` 调用（来自 workflow 自动 apply 上下文），跳过整个 Step 5.5 确认门 —— 直接进入 Step 6（批调度）。批计划仍在内部构建用于执行，但不向用户展示。

   **先构建统一并发批计划：**
   - iagent CLI 不返回 \`batchPlan\` —— 需从 design.md 推断所有任务的依赖（架构分层、模块依赖）；无依赖标注的任务视为同组内相互独立
   - 把同组任务（\`## N\` 标题，取自各任务的 \`group\` 字段）聚合为派发单元 —— 每个单元一个子代理
   - 若 design.md 显示部分任务存在循环依赖：加入循环依赖告警行，并把这些任务降级为串行执行
   - 若 design.md 缺少依赖信息：按串行执行规划，并在蓝图中注明 "(串行执行 - 无依赖信息)"

   \`\`\`
   📋 **设计方案确认**

   **变更**: <change-name> | **Schema**: <schema-name>

   ### 变更概要
   <from proposal Why section>

   ### 关键设计决策
   <from design Decisions section>

   ### 涉及的数据结构 / API
   <from design or specs>

   ### [待确认] 项目
   <list pending items, or "(无 - 已全部解决)">

   ### 任务数: N (0/N 完成)

   ### 并发执行计划
   <"(串行执行 - 无依赖信息)" when no dependency info, otherwise:>
   | 批号 | 任务 | 依赖来源 | 并发/串行 |
   |-----|------|---------|----------|
   | 1 | <task descriptions or ids> | <AI 推断 / 无依赖> | 并发 |
   | 2 | <task descriptions or ids> | <依赖批 1 / AI 推断> | 并发/串行 |
   <if circular deps detected: "⚠️ 循环依赖: <task ids> — 已降级为串行执行">
   <AI-inferred rows MUST be labeled "AI 推断" in the 依赖来源 column>

   ### 补充文档
   <list supplement tasks with their type labels and output paths, or "(无)">

   WAIT for user to explicitly reply "确认" before implementing.
   [确认 ✓] [修改设计] [取消]
   \`\`\`

   - 若用户回复 **"确认"**：一次确认覆盖**全部**批 —— 进入 Step 6 开始批调度
   - 若用户回复 **"修改设计"** 或 **"取消"**：STOP 并等待设计更新（不实现任何任务）
   - **auto-mode 覆盖**：\`auto-mode=true\` 时整道门被跳过 —— 不展示蓝图，直接进入 Step 6。未设置 auto-mode 或其为 false 时**不能**跳过本门。
   - 本门**不能**跳过 —— 未经显式确认不得继续（除非 auto-mode 生效）

   **临时工作区协议（流程级，由主代理管理）：**
   - 用户确认设计后（或 auto-mode 生效时）、派发任何批**之前**，创建一个临时工作区目录 —— **优先项目内**：项目根下的 \`.openspec-tmp/apply-<change-name>/\`（路径用 path.join 构建以保证跨平台）。若项目 \`.gitignore\` 中尚无 \`.openspec-tmp/\` 条目则补上，使该工作区不会污染 git status；清理后保留该条目供后续运行使用。若项目根不可写，降级到系统临时目录 \`iagent-apply-<change-name>/\` 并记录 WARN 说明降级位置
   - 流程内产生的所有临时文件（编译校验脚本、临时配置、草稿输出）MUST 放在该工作区内 —— 不得把临时文件散落到项目目录各处
   - 工作区在流程开始时创建一次、流程结束时清理一次 —— 不得按任务或按批创建/删除临时目录

> **批调度细则下沉**：Step 6 并发批调度协议（批形态判定、子代理派发、共享资源协议、失败处理）见 \`references/batch-scheduling.md\`；执行 Step 6 前 MUST 先 \`Read\` 该文件。

7. **完成或暂停时展示状态**

   展示：
   - 本次会话完成的任务
   - 总体进度："N/M tasks complete"
   - 若全部完成：进入 Step 8（编译检查）
   - 若暂停：说明原因并等待指引

8. **编译检查阶段** ⚠️ 强制

   全部任务完成后，执行自动编译检查：

   **8.1 加载编译检查配置**
   - 读取 \`openspec/config.yaml\` 的 \`compileCheck\` 配置
   - 若 \`compileCheck.enabled: false\`，跳到 Step 9（测试执行门）

   **8.2 探测技术栈**
   - 从 \`config.yaml\` 的 context 中解析关键词（TypeScript、Java、Go、Rust）
   - 检查项目配置文件（tsconfig.json、pom.xml、go.mod、Cargo.toml）
   - Java：从配置或构建文件判定构建工具（Maven/Ant/Gradle）
   - 未探测到技术栈时，给出告警并跳过编译检查

   **8.3 获取变更范围文件**
   - 从状态 JSON 解析 \`allowedEditRoots\`
   - 用 \`git diff\` 识别变更范围内的已修改文件
   - 将文件分为后端（TypeScript/Java/Go/Rust）与前端（JSP/Vue/React）

   **8.4 执行后端编译检查**
   - 按技术栈执行编译命令：
     - TypeScript: \`tsc --noEmit\` or \`pnpm run build\` (fallback: \`npm run build\`)
     - Java-Maven: \`mvn compile -DskipTests\`
     - Java-Ant: \`ant compile\`
     - Java-Gradle: \`gradle compileJava\`
     - Go: \`go build ./...\`
     - Rust: \`cargo build\`
   - 捕获错误并解析为结构化格式

   **8.5 执行后端 lint 检查**（若已配置）
   - TypeScript：\`eslint\`
   - Java：\`mvn checkstyle:check\`
   - 区分可自动修复与不可自动修复的问题

   **8.6 执行前端校验**（若已配置）
   - JSP 文件：校验标签闭合、EL 表达式、自定义标签定义
   - Vue/React：检查组件引用

   **8.7 自动修复循环**（若已配置）
   - 若 \`autoFix.enabled: true\`：
     - 按可修复性分类问题（类型标注、未使用变量、import 顺序）
     - 对变更范围内的文件应用修复
     - 重新运行编译/lint 检查
     - 最多重复 \`maxRetries\` 次（默认 3）

   **8.8 生成编译检查报告**
   - 汇总结果：后端编译、lint、前端
   - 列出所有已修复问题及其 file:line 引用
   - 列出需人工介入的问题

   **8.9 处理检查失败**
   - 若自动修复后仍有失败：
     - 按 \`onFailure\` 配置展示失败处理选项
     - 选项：[1] 查看详情，[2] 手动修复，[3] 跳过并记录警告
   - 若全部检查通过：进入 Step 9（测试执行门）

9. **测试执行门** ⚠️ 强制（仅限变更范围内）
   - 在编译检查（§8）之后运行。编译失败是硬错误；测试失败属于另一类问题（存量红灯测试、断言不匹配、环境问题）—— 这正是两道门分开、MUST NOT 合并为一道的原因。§8 MUST 保持其 \`-DskipTests\`/\`compile\` 语义；测试执行由本门负责。

   **9.1 探测测试命令** —— 基于 §8.2 探测到的同一技术栈：
   - Java-Maven：\`mvn test\`（仅跑选定类时用 \`-Dtest=...\` 限定范围）
   - Java-Gradle：\`gradle test\`
   - Java-Ant：\`ant test\`
   - TypeScript/Node：\`pnpm test\` / \`npm test\`
   - Go：\`go test ./...\`  |  Rust：\`cargo test\`
   - 项目中未探测到测试框架 → 记录 WARN，跳过本门并继续（非阻塞）

   **9.2 确定变更范围** —— 需要运行的测试集为：
   - 本变更 \`[测试]\` 任务产出的测试文件（从 \`tasks.md\` 读取其 \`Spec Ref\` / 文件路径）
   - 覆盖本变更所修改文件的既有测试文件（按镜像包路径 / 命名约定匹配，如 \`UserServiceImpl\` → \`UserServiceImplTest\`）

   **9.3 运行变更范围测试** —— 只执行 §9.2 的范围。不得把全量测试套件的结果作为通过/失败判据。

   **9.4 判定**
   - **范围内测试全部通过** → 记录并进入 §10
   - **变更范围外的存量失败** → 仅作为 WARN 报告。MUST NOT 计为本变更的失败，MUST NOT 阻塞流程（存量红灯套件很常见；以全量套件为判据会让本门不可用，并促使用户绕过它）
   - **变更范围内的失败** → 进入失败处理分支（§9.5）

   **9.5 范围内失败处理**
   - 自动修复并重跑，最多 3 次（与 §8.7 相同的重试预算）。区分：测试代码有误 → 修测试；生产代码有缺陷 → 修实现（按 \`openspec/rules/ai-coding.md\`）
   - 3 次后仍有失败：暂停并向用户报告。MUST NOT 把对应任务标为 \`[x]\`，MUST NOT 进入归档
   - 若必须收窄或简化测试的预期行为才能通过 → 适用范围蔓延护栏：标 **[待确认]**，说明差异并询问用户

   **9.6 测试门报告** —— 汇总：覆盖范围、范围内通过/失败数、范围外存量失败（WARN）、覆盖率工具运行时的覆盖率数据（见 \`iagent_test\` §5.1）

10. **统一临时工作区清理** ⚠️ 强制
   - 编译检查（§8）与测试执行门（§9）都结束后 —— 无论通过、失败还是跳过 —— 在单次清理中删除整个临时工作区
   - 清理范围**包含**共享上下文包及其产出登记表（二者都在临时工作区内）—— 它们是流程级制品，MUST NOT 遗留
   - 若清理失败（文件被占用、权限不足）：记录 WARN 并给出工作区路径，便于用户手动删除，流程继续、不阻塞

11. **最终状态与归档建议**

   展示：
   - 编译检查结果汇总
   - 测试执行门结果汇总
   - 全部任务完成状态
   - 建议通过 iagent spec archive "<name>" --yes（或 iagent_spec_archive 技能）归档变更

<!-- CMD:SKIP -->
**Output（实现过程中）**

\`\`\`
## Implementing: <change-name> (schema: <schema-name>)

⏳ Concurrent execution — Batch 2/4
   Dispatching 3 sub-agents (groups: 1. Data contract / 3. Template / 4. Tests)
   Coordinator is centrally managing task checkboxes and failure retries
- Task 3: <task description> → ✓ Task complete (produced: <file list>)
- Task 4: <task description> → ✓ Task complete (produced: <file list>)
- Task 5: <task description> → ✗ failed → serial retry in progress

Batch 3/4: 1 task — serial execution (single-task batch — implemented directly)
Working on task 6/7: <task description>
[...implementation happening...]
✓ Task complete
\`\`\`

**Output（完成时）**

\`\`\`
## Implementation Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 7/7 tasks complete ✓

### Completed This Session
- [x] Task 1
- [x] Task 2
...

Starting compile check...

## 编译检查报告

| 检查项 | 状态 | 详情 |
|-------|------|------|
| Backend Compile | ✓ PASS | TypeScript: tsc --noEmit |
| Backend Lint | ✓ PASS | eslint: 0 issues |
| Frontend | ✓ PASS | No JSP files in scope |

**自动修复**: 2 issues fixed (type annotations, import order)

All checks passed! You can archive this change via iagent CLI.
\`\`\`

**Output（编译检查失败时）**

\`\`\`
## Implementation Complete

**Change:** <change-name>
**Progress:** 7/7 tasks complete ✓

## 编译检查报告

| 检查项 | 状态 | 详情 |
|-------|------|------|
| Backend Compile | ✗ FAIL | 3 errors |
| Backend Lint | ✓ PASS | eslint: 0 issues |
| Frontend | - SKIPPED | No JSP files |

**自动修复**: Applied 2 fixes, 3 issues remain

### 需人工处理的问题
1. \`src/main.ts:45\` - Type mismatch: string vs number
2. \`src/utils.ts:12\` - Cannot find name 'config'
3. \`src/api.ts:78\` - Missing return type

**处理选项**:
[1] 查看详细错误信息
[2] 手动修复后重新检查
[3] 跳过检查并归档（记录警告）

请选择处理方式？
\`\`\`

**Output（暂停：遇到问题时）**

\`\`\`
## Implementation Paused

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 4/7 tasks complete

### Issue Encountered
<description of the issue>

**Options:**
1. <option 1>
2. <option 2>
3. Other approach

What would you like to do?
\`\`\`

**Output（批任务失败暂停时）**

\`\`\`
## Implementation Paused — Task Failure

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 4/7 tasks complete

### Failed Task
<task description> (batch N — sub-agent failed, serial retry failed)

### Failure Reason
<description of the failure>

The failed task remains unchecked (\`- [ ]\`) in tasks.md; confirmed tasks in the same batch have been marked complete.

**Options:**
1. Fix the task manually, then continue with the remaining batches
2. Provide guidance and retry the task
3. Stop the apply workflow

What would you like to do?
\`\`\`
<!-- /CMD:SKIP -->

**Guardrails**
- 持续推进任务直至完成或被阻塞
- 开始前始终先阅读制品文件（proposal/specs/design/tasks）
- 任务含义不明时暂停，先询问再实现
- 实现暴露问题时暂停，并建议更新制品
- 保持代码改动最小且限定在单个任务范围内
- 集中更新 tasks.md：仅当任务的 spec 行为**完整实现**后才把已确认完成的任务标为 \`- [ ]\` → \`- [x]\` —— 部分实现或延后实现 SHALL NOT 勾选；直接实现的任务（串行降级或单任务批）在任务完全做完后立即标记完成
- ⚠️ **范围蔓延护栏**：若实现揭示必须收窄、延后或简化某任务的 spec 行为才能通过，MUST 显式提出该发现 —— 标 **[待确认]**，清楚说明 spec 与实际实现的差异，并询问用户。绝不为让任务勾选通过而静默缩小、延后或简化 spec 行为。用户确认后，MUST 先更新 proposal/specs/design 以反映调整后的范围，再继续实现。
- 遇错误、阻塞或需求不清时暂停 —— 不要猜测
- 绝不编造数据库字段名、类型或 API 端点 —— 对照既有代码核实
- 遵循分层生成顺序：Entity/DTO → Mapper/DAO → Service → Controller → Frontend
- 每个前端数据展示组件都要处理 Loading/Empty/Error/Data 状态
- 实现与既有代码或共享工具签名冲突时立即暂停
- 编译检查前做交付前自检：无猜测字段、API 契约对齐、参数已校验、UI 状态已覆盖
- 直接从变更目录读取制品文件 —— 除标准集合外不要假设具体文件名
- ⚠️ **强制**：全部任务完成后执行 Step 8 编译检查
- ⚠️ **强制**：编译检查后执行 Step 9 测试执行门 —— 范围限定为本次变更（范围内失败阻塞；范围外存量失败仅 WARN 且 MUST NOT 阻塞）
- ⚠️ **强制**：\`[测试]\` 任务 MUST 内联实现，遵循测试生成规则（框架探测 → 风格对齐 → BCDE 覆盖 → 反模式防护）；MUST NOT 委派给外部技能，MUST NOT 走补充文档的 \`产出:\` → \`attachments/\` 规则（放在 attachments/ 下的测试代码无法运行）

- ⚠️ **强制**：子代理派发指令 MUST 携带 EXIT GUARD（子代理退出守卫）—— 完成分配任务后立即停止并返回回执，MUST NOT 进入 plan 模式 / 设计模式，也不得提出后续步骤；编排器是唯一有权判停和推进阶段的角色
- ⚠️ **强制**：子代理 MUST 先读取上下文包，再执行其它任何动作 —— 不得先做其他动作；MUST NOT 重读 proposal/specs/design，MUST NOT 重跑包已覆盖的 CodeGraph 查询；仅做增量查询
- ⚠️ **强制**：给出归档建议前先解析编译错误并提供修复选项

**流畅工作流集成**

本技能支持"对变更的动作"模型：

- **可随时调用**：全部制品完成前（只要有任务存在）、部分实现后、与其他动作交错进行时均可调用
- **允许更新制品**：实现暴露设计问题时，建议更新制品 —— 不受阶段锁定，流畅推进`,
        license: 'MIT',
        compatibility: '依赖 iagent CLI（spec 命令组）。',
        metadata: { author: 'mi-agent-tools' },
        references: [
            { path: 'references/batch-scheduling.md', content: BATCH_SCHEDULING_FULL },
        ],
    };
}

export function getSpecApplyChangeCommandTemplate(): CommandTemplate {
    return {
        name: 'iAgent: 实现变更',
        description: '实现变更 —— 按变更制品的任务清单实现代码，设计确认后执行并勾选推进',
        category: 'iAgent / 规格',
        tags: ['iagent', 'spec', 'apply', 'tasks'],
        content: deriveCommandContent(getSpecApplyChangeSkillTemplate().instructions),
    };
}
