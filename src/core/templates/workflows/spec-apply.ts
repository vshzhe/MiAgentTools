/**
 * spec 类型技能模板：实现变更。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { deriveCommandContent } from '../derive-command.js';
import { SUBAGENT_DISPATCH, skillDelegation } from '../tool-whitelist.js';
import { renderGateWhitelistSection } from '../prompt-gate.js';
import {
    GATE_SKIP_IDS,
    LEGACY_AUTO_MODE_PARAM,
    renderDelegationModeContract,
    renderGateSkipOption,
} from '../../host-orchestration/delegation-contract.js';

const BATCH_SCHEDULING_FULL = `6. **实现任务（批调度循环，直至完成或被阻塞）**

   **变更级 handoff 包（流程级，一次产出、跨阶段复用）：**

   - **路径**：项目根下 \`.openspec-tmp/pipeline-<change-name>/handoff-pack.md\`（用 \`path.join()\` 构造；该目录已被 \`.gitignore\` 排除，**不进提交面**）
   - **跨阶段复用（优先）**：\`iagent_spec_propose\` 在提案定稿时已产出该包 → apply **只读复用**，MUST NOT 重产整包；收尾时仅向 \`## 阶段结论\` 追加一行
   - **独立调用时（包不存在）**：按同一六节协议**产出一次**（只在首次派发前产出，不按批重产、也不按单元重产）
   - **头部固定元信息**：\`change: <name>\` / \`producedBy: propose|apply\` / \`producedAt: <ISO>\` / \`sourceFingerprint: <hash>\`
   - **指纹校验**：阶段入口比对当前制品（proposal / design / specs / tasks）的内容指纹；与 \`sourceFingerprint\` 不一致 → 重建整包并记 WARN，MUST NOT 静默沿用陈旧包
   - handoff 包是子代理**唯一**必读的制品：每个子代理只读该包（+ 自己单元的任务清单），变更目录中的其他内容一律不读
   - 包内章节固定为六节 + 制品清单（位于契约节之后、规范要点节之前；**与六节并列、不计入六节**）+ \`## 已确认门\`（门账本，**与六节并列、不计入六节**）+ 可选 \`## 阶段结论\`（六节顺序如下）：
     - \`## 变更摘要\` — 从 proposal.md 蒸馏出的变更要点（why/whatChanges）：本变更做什么、为什么
     - \`## 契约\` — 从 specs + design 蒸馏出的接口签名 / 数据结构 / 表字段
     - \`## 规范要点\` — 编排器一次性蒸馏出的 \`.iagent/rules/coding-rules.md\` 关键护栏（绝不由各子代理分别蒸馏）
     - \`## 文件归属表\` — 派发单元 → 该单元允许修改的文件
     - \`## Codebase 摘要\` — 预扫描 / 探查摘要结论（分层 / 依赖事实，否则子代理需重新推导）
     - \`## 已产出（跨单元可见）\` — 产出登记表：已产出文件 + 公开签名，每批结束后追加
     - \`## 已确认门\`（门账本；**不是第七个内容节**，不改变六节语义与相对顺序）— 每行一个已确认门：Markdown 表格行 \`| <门承载 id> | <确认阶段> |\`（表头 \`| 门 id | 确认阶段 |\` 与分隔行 \`| --- | --- |\` 由解析侧跳过）。门 id 值域收敛到 \`GATE_SKIP_IDS\`（当前仅 \`design-confirmation\`），条目只表达「该门已由父级承载」，MUST NOT 记录业务决策正文、MUST NOT 写入父级阶段门 id；父级在门确认后立即写、委派前校验存在，本技能（及 verify / archive）**只读**该段，MUST NOT 改写既有条目
     - \`## 阶段结论\`（可选，**只追加不改写**）— 每阶段一条，五列：\`phase\` / \`status\` / \`artifact\` / \`nextAllowed\` / \`tokens\`（可用时填 \`tokens=<数值>\`，不可得填 \`—\`）
   - 产出后编排器 MUST NOT 重产整包 —— 只允许向 \`## 已产出（跨单元可见）\`、\`## 已确认门\`（仅追加新条目，MUST NOT 改写父级既有条目）与 \`## 阶段结论\` **追加**内容（见批后步骤）

   **派发前加载并发上限：**
   - 从 \`openspec/config.yaml\` 读取 \`apply.concurrency\`（正整数）
   - 未配置时：使用默认上限 3
   - 取值非法（非正数或非整数）时：告警用户并降级到默认值 3
   - 该上限约束一个批内同时运行的子代理（派发单元）数量；不拆分、不重排批次

   **加载相邻合并配置：**
   - 从 \`openspec/config.yaml\` 读取 \`apply.mergeAdjacent\`（布尔）
   - 未配置时：默认 true（相邻的简单任务合并为一个派发单元）
   - 为 false 时：在模板层面跳过合并行为

   **加载批后编译检查配置：**
   - 从 \`.iagent/config.yaml\` 读取 \`compileCheck.incremental\`（段或字段缺失时运行 \`iagent config show\` 取生效值）
   - 为 true（缺省）时：每批任务完成后执行**批后编译检查** —— 复用收尾全量所用的**同一条命令**（显式 \`command\` 或描述符探测结果），只把报告范围限定为本批改动的模块；失败进入与收尾全量相同的自动修复循环（同一重试预算），耗尽即写 \`fail\` 证据并暂停
   - 为 false 时：跳过批后检查并说明「仅做 Step 8 收尾全量检查」
   - 旧位置 \`openspec/config.yaml\` 的 \`apply.incrementalCheck\` 不再生效（仅一次 WARN，见 Step 8 的配置弃用段）
   - 命令判定 / monorepo 归组去重 / 证据口径见 \`references/compile-check.md\`（执行前 MUST 先 Read）

   **批调度循环**（按 Step 5.5 确认的统一批计划逐批执行）：

   **批派发形态判定（显式，每批开始时 强制）：**
   - 批含 **≥2** 个派发单元 → 产出或复用 handoff 包（若尚未存在则按六节协议产出）并派发子代理（见第 2–5 条）
   - 批含 **<2** 个派发单元 → 由编排器自己直接实现任务，且 MUST NOT **新产出**包（已有 handoff 包仍可只读复用）

   1. **单任务批**：由你直接实现该任务 —— 不派发子代理、不输出并发执行提示；标明按串行执行（单任务批）；展示当前正在处理的任务，完成所需代码改动，保持改动最小且聚焦
   2. **多单元批 —— 并发状态提示**：派发含多个派发单元的批**之前**，输出醒目提示，说明批位置（Batch N/M）、正在派发的子代理数量（= 派发单元数）、涉及的任务组（本批 \`dispatchUnits\` 的 \`group\` 标签；无 group 标签的单元用任务 id），并提醒任务勾选更新与失败重试由编排器集中管理
   3. **派发前重叠检查（跨单元降级）**：跨派发单元检查本批任务的目标文件（依据任务描述、Spec Ref 与 \`产出:\` 声明）；不同单元中会修改同一文件的任务 MUST 从并发组中拆出、改为串行执行 —— 同一单元内的任务由同一子代理串行实现，因此同组文件绝不会被并发编辑
   4. **并发派发 —— 每个派发单元一个子代理**：为每个待处理的派发单元派发一个子代理；该单元的任务由该子代理按任务顺序串行实现；批内同时运行的子代理（派发单元）数 MUST NOT 超过并发上限；采用滑动窗口派发 —— 一旦某个子代理完成，立即派发同一批中下一个待处理的派发单元
   5. **子代理派发指令 MUST 包含**（先共享指令前缀，再单元差异部分）：
      - handoff 包路径 —— 子代理**唯一**必读的制品（包位于流程级临时工作区 \`.openspec-tmp/pipeline-<change-name>/\`）；**MUST 先读取本包，再执行其它任何动作** —— 包已承载蒸馏后的契约 / 摘要 / 文件归属表，因此子代理 MUST NOT 通过重读 proposal/specs/design 或重跑包已覆盖的 CodeGraph 查询来重新推导这些信息
      - 指向包的 \`## 规范要点\` 章节以获取 AI 编码护栏（绝不猜测 DB 字段、API 参数或业务规则 —— 标 **[待确认]**）—— 指令 MUST NOT 内联完整护栏摘要
      - 回执格式与禁止项清单（见下文共享资源协议）
      - 按顺序给出该派发单元的任务清单及每个任务的完整细节（描述、需求、Spec Ref），并要求按该顺序串行实现单元任务 —— 任务细节 MUST 内联在指令中，使子代理无需读取 tasks.md
      - 与任务相关的源文件清单 —— 变更制品文件（proposal/specs/design）已由包覆盖，MUST NOT 再列入清单供重读
      - 临时工作区路径及约束：子代理只把文件写入该工作区 —— MUST NOT 删除工作区，MUST NOT 自行按任务创建/清理临时目录
      - 显式禁止：**禁止修改 tasks.md** —— 子代理 MUST NOT 编辑任务勾选框
      - **⛔ EXIT GUARD (强制 — 子代理退出守卫)**: 完成本单元分配的全部任务后 MUST **立即停止并提交回执**给编排器；MUST NOT 进入 plan 模式 / 设计模式、不得提出后续步骤、不得超出分配的任务范围、不得建议归档或验证步骤；唯一职责 = 实现本单元分配的任务清单、产出回执的四个字段并返回；编排器是唯一有权判停、汇总、推进阶段的角色 —— 子代理 MUST NOT 越权替代编排器做阶段收尾决策
   6. **整批返回后**：对照任务需求核验每个子代理的结果 → 由你集中更新 tasks.md（\`- [ ]\` → \`- [x]\`，仅限已确认完成的任务）→ 把本批的产出文件与公开签名追加到包的 \`## 已产出（跨单元可见）\` 章节
   6.5 **批后编译检查**（\`compileCheck.incremental=true\` 时）：复用收尾全量的同一条命令对**本批改动模块**执行检查 → 失败进入自动修复循环（与收尾全量同一重试预算）→ 耗尽即写 \`fail\` 证据并**暂停**（MUST NOT 继续后续批次、MUST NOT 进入 Step 9）；\`incremental=false\` 时跳过并说明「仅做收尾全量检查」→ 通过后进入下一批
   7. **失败任务**：由你串行重试该失败任务一次 → 若重试仍失败，暂停并向用户报告（该任务保持未勾选 \`- [ ]\`）

   **共享资源协议 —— 子代理职责与回执：**

   - **回执（回执最小化）**：子代理以固定四列回执行式回报，每个任务一行 —— \`<任务 id> | <状态> | <产出文件> | <公开签名>\`。回执 MUST NOT 粘贴代码正文。失败任务的回执 MUST 仍带失败原因摘要。
   - 「公开签名」定义：本单元产出中可能被其他单元引用的符号签名 —— 函数 / 方法 / 类型 / 接口 / 导出常量 / CLI 命令，含其参数与返回类型。若本单元没有可被引用的产出，记「无」。
   - **空值**：包的 \`## 契约\` 章节无对应条目时，在包中与回执的公开签名列均记「无」。MUST NOT 留空 / MUST NOT 编造。
   - **共享指令前缀**：每条派发指令按固定顺序拼装 —— 共享前缀（handoff 包路径 / \`## 规范要点\` 引用 / 回执格式 / 禁止项）→ 单元差异部分（本单元任务清单）。同一流程的每次派发，其共享前缀 MUST 逐字节一致。
   - **禁止项**（每条派发指令 MUST 携带它们）：子代理 MUST NOT 重读 proposal/specs/design；子代理 MUST NOT 重跑包已覆盖的 CodeGraph 查询。对包未覆盖的内容 MAY 运行补充查询，但此时回执 MUST 附上**包缺口回执**（缺了什么、查了什么）；编排器据此回填包 —— 回填失败时记录 WARN，且 MUST NOT 阻塞实现。
   - **反幻觉**：包是蒸馏视图，不是制品的替代品。包中缺少某项时，子代理 MUST 查阅制品本身，MUST NOT 猜测字段或契约。

   **共享资源协议 —— fail-safe 降级：**

   - 临时工作区不可写时：先降级到系统临时目录（\`iagent-pipeline-<change-name>/\`，既有的降级位置）；若仍失败，按下方降级
   - handoff 包无法产出，或项目没有 \`.iagent/rules/coding-rules.md\` 时：降级为既有内联注入行为并记录 WARN —— MUST NOT 阻塞实现。降级只会让指令更长，绝不会丢弃护栏
   - \`${renderGateSkipOption(GATE_SKIP_IDS)}\`（门承载参数；\`${LEGACY_AUTO_MODE_PARAM}=true\` 为兼容等价写法）只跳过 Step 5.5 设计确认门 —— 共享资源协议 MUST NOT 因该参数而豁免，仍然适用

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
       - **MUST 委派 \`iagent_test\`**（传入测试层级与优先级）生成测试代码 —— MUST NOT 在 apply 内另立一套测试规则。\`iagent_test\` 不可用（degraded / 技能缺失）时记录 WARN 并按同一测试规则本地实现，MUST NOT 伪装为委派完成
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

/**
 * Step 8 细则（`references/compile-check.md`）：描述符探测矩阵、命令构造、
 * monorepo 归组去重、证据模板与终态判定表。
 *
 * 下沉只为预算与渐进披露，**不降低约束强度**：主文件保留门 / 判定 / 证据 / 失败处置
 * 骨架；本文件不可读时按主文件内联摘要继续，MUST NOT 跳过编译检查。
 */
const COMPILE_CHECK_DETAIL = `# 编译检查细则（spec-apply Step 8）

> 本文件是 Step 8 的细则展开。主 SKILL 的 8.1–8.10 是**唯一执行顺序**；此处只补充如何判定、如何构造命令、证据长什么样。二者冲突时以主文件为准。

## 1. 配置读取与默认值

- 权威载体：项目 \`.iagent/config.yaml\` 的顶层 \`compileCheck\` 段；\`openspec/config.yaml\` 的同名字段与 \`apply.incrementalCheck\` **不再生效**（只读一次并 WARN，指向迁移目标）。
- 段或字段缺失时：运行 \`iagent config show\` 读取生效值（**单一默认值真源**在 \`src/core/project-config.ts\` 的 \`DEFAULT_COMPILE_CHECK\`）；CLI 不可用时按下表兜底并记 WARN —— MUST NOT 定义第二套默认值。

| 字段 | 类型 | 默认 | 语义 |
| :--- | :--- | :--- | :--- |
| \`enabled\` | 布尔 | \`true\` | 是否执行；\`false\` = 项目级显式禁用（唯一合法的 \`disabled\` 来源） |
| \`command\` | 字符串 | 空 | 显式命令（优先级最高）；空 = 自动探测 |
| \`timeoutMs\` | 整数 | \`600000\` | 单条命令超时（毫秒），超时计为失败 |
| \`incremental\` | 布尔 | \`true\` | 每批结束后是否执行批后编译检查（复用同一命令） |
| \`autoFix\` | 布尔 | \`true\` | 失败后是否进入自动修复循环 |
| \`maxRetries\` | 整数 | \`3\` | 自动修复重试上限（仅 \`autoFix=true\` 生效） |

作用域：\`command\` / \`timeoutMs\` / \`maxRetries\` / \`autoFix\` / \`incremental\` **仅约束本技能**；\`iagent_debug\` 只共享 \`enabled\` 与「缺省启用」语义。

## 2. 构建描述符探测矩阵

以**变更文件最近的祖先目录**为起点向上查找（同一目录命中多个描述符时按表中顺序取第一个，命中即停止继续上升）：

| 描述符 | 构造的命令 | 说明 |
| :--- | :--- | :--- |
| \`package.json\` 且含 \`scripts.build\` | \`<pkg> run build\` | 包管理器由同目录 lockfile 决定（见 3.1）；无 lockfile 时按 \`npm run build\` |
| \`package.json\` 无 \`build\` 而存在 \`tsconfig.json\` | \`tsc --noEmit\` | 纯类型检查（不产出构建产物） |
| \`pom.xml\` | \`mvn compile -DskipTests\` | Maven；保持「不跑测试」语义 |
| \`build.gradle\` / \`build.gradle.kts\` | \`gradle compileJava\` | Gradle |
| \`build.xml\` | \`ant compile\` | Ant |
| \`go.mod\` | \`go build ./...\` | Go |
| \`Cargo.toml\` | \`cargo build\` | Rust |
| \`build.js\` | \`node build.js\` | 仓库自带的 Node 构建脚本（**仅当目标项目确有该文件时**命中） |

**禁止**：把本仓库（iagent 自身）的命令写成唯一命令；把 \`npm run build\` 当万能回退（无描述符即 \`not-applicable\`）。

## 3. 命令构造细则

### 3.1 包管理器判定（按 lockfile）

| 同目录 lockfile | 命令 |
| :--- | :--- |
| \`pnpm-lock.yaml\` | \`pnpm run build\` |
| \`package-lock.json\` | \`npm run build\` |
| \`yarn.lock\` | \`yarn build\` |
| 无 lockfile | \`npm run build\`（记录 WARN：未发现 lockfile） |

### 3.2 显式命令优先

\`compileCheck.command\` 非空 → **只**执行该命令：不追加探测命令、不因描述符命中而多跑一条。

### 3.3 monorepo 归组与去重

1. 取本批 / 本次变更涉及的文件列表（见 4）；
2. 对每个文件求**最近的祖先目录**（含自身目录）中的构建描述符；
3. 按「描述符绝对路径 + 构造出的命令字符串」归组；
4. **去重**：同一命令字符串只执行一次，\`scope\` 记该组覆盖的模块目录（多个用逗号分隔）；
5. **逐条执行**，每条命令独立记录 \`command\` / \`exitCode\` / \`scope\`；
6. 任一命令非零退出 → 文件级汇总 \`status=fail\`（其余命令仍执行完毕，便于一次看全错误）。

## 4. 变更范围降级链

1. \`tasks.md\` 中声明的 \`文件：\` / 产出路径与 \`Spec Ref\`；
2. \`git diff --name-only\` + \`git ls-files --others --exclude-standard\`（**含未跟踪文件**）；
3. 状态 JSON 的 \`contextFiles\` / \`changeRoot\`（\`iagent spec status --change <name> --json\`）；
4. 三源皆不可得 → 以**项目根**为范围执行，证据 \`scope\` 记 \`project-root\`，并记 WARN。

每次降级 MUST 记录 WARN（「范围来源降级为 X」）；MUST NOT 依赖 \`allowedEditRoots\`（该字段不存在）。

## 5. 证据文件模板

路径：\`.openspec-tmp/pipeline-<change-name>/compile-report.md\`（\`path.join()\` 构造）。

\`\`\`markdown
| change | command | exitCode | errorCount | fixedCount | status | scope | timestamp | reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| add-x | pnpm run build | 0 | 0 | 2 | pass | packages/a | 2026-11-01T10:00:00Z | - |
| add-x | mvn compile -DskipTests | 1 | 3 | 0 | fail | services/b | 2026-11-01T10:00:05Z | 3 个编译错误，重试耗尽 |

**summary**: status=fail, commands=2, totalErrors=3, totalFixed=2
\`\`\`

列名固定（九个字段，顺序不变）。非执行终态（\`not-applicable\` / \`disabled\`）使用固定占位：

\`\`\`markdown
| change | command | exitCode | errorCount | fixedCount | status | scope | timestamp | reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| add-x | - | - | 0 | 0 | not-applicable | - | 2026-11-01T10:00:00Z | 未探测到可编译产物 |

**summary**: status=not-applicable, commands=0, totalErrors=0, totalFixed=0
\`\`\`

\`reason\` 的两种非执行文案固定为「未探测到可编译产物」/「项目级显式禁用」；MUST NOT 留空、MUST NOT 使用 \`N/A\` 等变体（父流程按固定列解析）。

handoff 包 \`## 阶段结论\` 追加行（五列，status 用**编译四值**，tokens 不可得填 \`—\`）：

\`\`\`markdown
| compile | pass | .openspec-tmp/pipeline-add-x/compile-report.md | archive | — |
\`\`\`

## 6. 终态判定表

| 情形 | 终态 | 后续 |
| :--- | :--- | :--- |
| 全部命令 exitCode 0 | \`pass\` | 进入测试执行门 |
| \`enabled: false\`（项目级显式禁用） | \`disabled\` | 写证据后进入测试执行门（WARN，不表述为通过） |
| 无任何可编译产物 / 无描述符且未配置命令 | \`not-applicable\` | 写证据后进入测试执行门（WARN，不表述为通过） |
| 任一命令非零退出 / 超时 / 依赖未安装 | \`fail\` | 修复循环 \`maxRetries\` 次；仍失败 → 写证据并暂停 |
| \`autoFix=false\` 且首次失败 | \`fail\` | 直接写证据并暂停（不进入修复循环） |
| 批后检查修复耗尽 | \`fail\` | 立即写证据并暂停（不继续后续批次、不进入测试门） |

**汇总优先级**：任一命令行 \`fail\` → \`fail\`；否则全部 \`pass\` → \`pass\`；零命令时只能是 \`not-applicable\` 或 \`disabled\`（二者互斥）。

## 7. 失败分类

- **可自动修复**：类型标注缺失 / 未使用变量 / import 顺序 / 明显的拼写与引用路径错误 —— 只修改变更范围内文件后重跑同一命令。
- **需人工介入**：接口签名冲突、缺失依赖包、业务逻辑错误、环境缺失（\`command not found\`、缺 \`node_modules\`）—— 记录 \`file:line\` 后暂停。
- 超时与依赖未安装一律计为 \`fail\`（MUST NOT 记为 \`not-applicable\`）。

## 8. 辅助检查边界

lint（\`eslint\` / \`mvn checkstyle:check\`）与前端校验（JSP 标签闭合与 EL 表达式、Vue/React 组件引用）是 **Step 8 的辅助项**：

- 项目适用时照常执行；
- 失败只记 WARN 与摘要，**不参与四值终态**、**不计入证据 \`errorCount\`**；
- MUST NOT 因重写 Step 8 而移除这两步（属既有能力，静默移除即为能力收缩）。
`;

export function getSpecApplyChangeSkillTemplate(): SkillTemplate {
    return {
        name: 'iagent_spec_apply',
        description: '实现变更。当 openspec/changes/ 下已有变更制品（proposal/specs/design/tasks），需要基于规格驱动实现任务清单时使用；触发词"实现变更 / apply / 执行任务 / 按规格实现"；NOT for 无变更制品时直接描述需求（改用 iagent_workflow 引导生成制品后再实现）。',
        allowedTools: `Read, Write, Edit, Glob, Grep, Bash(iagent:*), Bash(npm:*), Bash(pnpm:*), Bash(yarn:*), Bash(node:*), Bash(git:*), Bash(tsc:*), Bash(mvn:*), Bash(ant:*), Bash(gradle:*), Bash(go:*), Bash(cargo:*), ${skillDelegation(['test'])}, ${SUBAGENT_DISPATCH}`,
        type: 'spec',
        instructions: `**实现前先阅读 .iagent/rules/coding-rules.md 的 AI 编码护栏。** 禁止猜测数据库字段、API 参数或业务规则 —— 标 **[待确认]** 并询问用户。

按 openspec/changes/ 下的变更制品（proposal/specs/design/tasks）实现任务。

${renderGateWhitelistSection()}

**Input**: 可选指定变更名；省略时检查能否从对话上下文推断。若含糊或有歧义，MUST 提示可用变更供用户选择。工作流可传入 \`${renderGateSkipOption(GATE_SKIP_IDS)}\` 以跳过设计确认门，实现自动执行（\`${LEGACY_AUTO_MODE_PARAM}=true\` 为同语义的兼容写法；两者都**只**跳过设计确认门）。

${renderDelegationModeContract()}

**执行方式与增量复验（强制）**：

- 本阶段默认经前台 Agent 子代理执行，回执声明 executionMode=subagent；iagent_test 子阶段经子代理。
- 子代理 MUST FIRST 读 handoff 包「## 制品清单」，按锚点增量读取；回执写 readScope。
- 增量复验：验证 FAIL 修复后新开只读代理，传 fixDiff + 上轮 reportPath；只验证增量并对未覆盖范围输出 residual 清单；禁止 resume 充当复验（contextReplay=true 记 WARN）。
- 「## 阶段结论」使用 5 列（含 tokens），不可得填 —；指纹优先 iagent spec fingerprint --change <name>。

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
   - \`planningHome\`、\`changeRoot\` 与 \`artifactPaths\`：规划范围与编辑约束（编辑范围即 \`changeRoot\`；路径 MUST 取自 CLI 字段，不得自行拼接）
   - \`progress\`：任务总数、已完成数、剩余数
   - 哪个制品承载任务（spec-driven 通常为 "tasks"，其他类型以状态输出为准）

   **跳过制品（skipped）处理：** 若状态报告某制品为 \`skipped\`（变更声明了 \`skip_specs\`），不要把它当作缺失 —— 其依赖视为已满足，其余制品照常实现。此类制品不会在 Step 3 返回的 \`instruction\` 状态中被标为未完成。

   **范围字段非必需：** \`allowedEditRoots\` 等范围扩展字段**均非必需字段**（\`getChangeStatus\` 不返回它们）：字段缺失时按 \`changeRoot\` / \`contextFiles\` 继续并记 WARN，MUST NOT 因此把变更判为不可实现。

   **可选制品（optional）处理：** \`design\` 状态为 \`optional\` 表示未创建且不阻塞实现，MUST NOT 因其缺失把调度判为 blocked，也 MUST NOT 为补足状态而临时创建 design.md。

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

   **门承载参数检查（三级降级链，顺序强制 —— 主通道 → 兜底 → 门照常执行）**：

   1. **主通道 \`${renderGateSkipOption(GATE_SKIP_IDS)}\`（权威）**：若 apply 以 \`${renderGateSkipOption(GATE_SKIP_IDS)}\` 调用（兼容写法 \`${LEGACY_AUTO_MODE_PARAM}=true\`；来自 workflow / auto-workflow 自动 apply 上下文），跳过整个 Step 5.5 确认门 —— 直接进入 Step 6（批调度）。批计划仍在内部构建用于执行，但不向用户展示。该参数**仅**作用于本门，其余门与停点照常生效。主通道存在时 MUST NOT 读取账本作覆盖（\`gate-skip\` 是唯一权威）。
   2. **兜底通道 —— 门账本**：未传 \`gate-skip\` 时，只读变更级 handoff 包（\`.openspec-tmp/pipeline-<change-name>/handoff-pack.md\`，路径用 \`path.join()\` 构造，MUST NOT 作为委派参数传入）的 \`## 已确认门\` 段。段内声明 \`design-confirmation\` 且与父级阶段回执的 \`confirmedGates\` 一致 → 跳过 Step 5.5 并记 WARN「使用了门账本兜底通道」（否则无法区分「参数生效」与「账本兜底」）。账本条目 MUST NOT 超出回执声明的已确认门：**不一致 / 条目过期（伪造、人工改写）→ 记 WARN 并视为未确认**，回到第 3 级。
   3. **两者皆缺 —— 门照常执行（fail-safe）**：既无 \`gate-skip\` 也无账本条目（段缺失 / 段内无该门）时，Step 5.5 MUST 照常执行并等待用户显式确认；MUST NOT 静默跳过、MUST NOT 以「父流程不会重复确认」推断为已确认。

   **门账本只表达门承载语义**：条目取值域收敛到 \`GATE_SKIP_IDS\`（当前仅 \`design-confirmation\`），MUST NOT 写入父级阶段门 id（\`implementation-bridge\` 不在域内，写入即触发 \`invalid-receipt\`）；解析跳过表头行与分隔行、剥离首尾 \`|\`，未知门 id 忽略 + WARN；账本段缺失**不产生 WARN**（无账本属合法 fail-safe 状态）。本技能只读账本，MUST NOT 改写父级已写入的条目，只允许向 \`## 阶段结论\` 追加行。

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
   - **门承载参数覆盖**：\`${renderGateSkipOption(GATE_SKIP_IDS)}\`（兼容写法 \`${LEGACY_AUTO_MODE_PARAM}=true\`）时整道门被跳过 —— 不展示蓝图，直接进入 Step 6。未设置该参数或其为 false 时**不能**跳过本门（唯一例外：Step 5.5 第 2 级的账本兜底通道命中 —— 段内声明 \`design-confirmation\` 且与回执 \`confirmedGates\` 一致 → 跳过并记 WARN「使用了门账本兜底通道」；不一致 / 过期 → 视为未确认，本门照常执行）。
   - 本门**不能**跳过 —— 未经显式确认不得继续（除非主通道参数或账本兜底通道生效）

   **临时工作区协议（流程级，由主代理管理）：**
   - 用户确认设计后（或门承载参数生效时）、派发任何批**之前**，创建流程级临时工作区 —— **优先项目内**：项目根下的 \`.openspec-tmp/pipeline-<change-name>/\`（路径用 path.join 构建以保证跨平台）。若项目 \`.gitignore\` 中尚无 \`.openspec-tmp/\` 条目则补上，使该工作区不会污染 git status；清理后保留该条目供后续运行使用。若项目根不可写，降级到系统临时目录 \`iagent-pipeline-<change-name>/\` 并记录 WARN 说明降级位置
   - 流程内产生的所有临时文件（handoff 包、编译校验脚本、临时配置、草稿输出）MUST 放在该工作区内 —— 不得把临时文件散落到项目目录各处
   - 工作区是**流程级**（不是 apply 级）：流程开始时创建一次、流程结束时清理一次 —— 不得按任务或按批创建/删除临时目录

> **批调度细则下沉**：Step 6 并发批调度协议（批形态判定、子代理派发、共享资源协议、失败处理）见 \`references/batch-scheduling.md\`；执行 Step 6 前 MUST 先 \`Read\` 该文件。

7. **完成或暂停时展示状态**

   展示：
   - 本次会话完成的任务
   - 总体进度："N/M tasks complete"
   - 若全部完成：进入 Step 8（编译检查）
   - 若暂停：说明原因并等待指引

8. **编译检查阶段（硬门）** ⚠️ 强制

   全部任务完成后执行。**执行前 MUST 先 \`Read\` \`references/compile-check.md\`**（描述符探测矩阵、命令构造细则、monorepo 归组去重算法、证据模板、终态判定表）；该文件不可读时记录 WARN 并按本步内联摘要继续，MUST NOT 因此跳过编译检查或记为 \`not-applicable\`。

   **8.1 读取配置（唯一真源）**
   - 读 \`.iagent/config.yaml\` 的 \`compileCheck\`（\`enabled\` / \`command\` / \`timeoutMs\` / \`incremental\` / \`autoFix\` / \`maxRetries\`）；段或字段缺失时运行 \`iagent config show\` 取生效默认值；CLI 不可用时按 \`enabled=true\` / \`command=""\` / \`timeoutMs=600000\` / \`incremental=true\` / \`autoFix=true\` / \`maxRetries=3\` 执行并记 WARN
   - 旧位置弃用：\`openspec/config.yaml\` 若存在 \`compileCheck\` / \`apply.incrementalCheck\` 一类字段，只读一次并 WARN（指明迁移到 \`.iagent/config.yaml\` 的新字段），MUST NOT 采用其取值、MUST NOT 在两文件间合并或回退

   **8.2 启用判定**
   - \`enabled=false\` → 终态 \`disabled\`（项目级显式禁用）→ **仍须写 disabled 证据**（8.8）后再进入 Step 9，MUST NOT 跳过证据
   - \`enabled=true\` → 继续 8.3

   **8.3 变更范围（降级链，每次降级记 WARN）**
   1) \`tasks.md\` 声明的产出与 \`Spec Ref\`；2) \`git diff\`（含未跟踪文件）；3) 状态 JSON 的 \`contextFiles\` / \`changeRoot\`；三源皆不可得 → 以项目根为范围并在证据 \`scope\` 记 \`project-root\`。MUST NOT 依赖 \`allowedEditRoots\`（状态 JSON 不返回该字段）

   **8.4 命令判定（三级，运行时按目标项目确定）**
   1) \`compileCheck.command\` 非空 → 直接使用，不追加任何探测命令；2) 否则以**变更文件最近的祖先目录**向上查找构建描述符（\`package.json\` 的 \`scripts.build\` + lockfile、\`tsconfig.json\`、\`pom.xml\`、\`build.gradle(.kts)\`、\`build.xml\`、\`go.mod\`、\`Cargo.toml\`、\`build.js\`），按命中项构造命令（monorepo 按描述符归组、去重后逐条执行）；3) 均未命中 → \`not-applicable\`（\`reason\` 写「未探测到可编译产物」，MUST NOT 记为 \`pass\`）。MUST NOT 把本项目命令固化为唯一命令，也 MUST NOT 用 \`npm run build\` 当万能回退

   **8.5 执行与捕获**
   - 逐条执行命令（单条超时取 \`timeoutMs\`），记录 \`command\` / \`exitCode\` / \`scope\` 与错误数；命令超时、依赖未安装（\`command not found\` / 缺 \`node_modules\`）一律计为失败并进入 8.7，MUST NOT 归类为 \`not-applicable\`

   **8.6 失败判定**
   - 退出码非零或超时 → 失败；\`autoFix=false\` 时**首次失败即**写 \`fail\` 证据（8.8）并进入 8.9，MUST NOT 进入修复循环（\`maxRetries\` 仅在 \`autoFix=true\` 时生效）

   **8.7 自动修复循环（\`autoFix=true\`）**
   - 按可修复性分类问题（类型标注 / 未使用变量 / import 顺序），只修改变更范围内文件，重跑同一条命令；最多 \`maxRetries\` 次（默认 3）

   **8.8 写入编译证据（四终态均须产出，无终态可免写）**
   - 证据文件：\`.openspec-tmp/pipeline-<change-name>/compile-report.md\`（\`path.join()\` 构造），九列固定 \`change\` / \`command\` / \`exitCode\` / \`errorCount\` / \`fixedCount\` / \`status\` / \`scope\` / \`timestamp\` / \`reason\`，每次执行一行；文末汇总行 \`**summary**: status=<...>, commands=<n>, totalErrors=<n>, totalFixed=<n>\`（任一命令行 \`fail\` → \`fail\`；否则全部 \`pass\` → \`pass\`；零命令时只能是 \`not-applicable\` 或 \`disabled\`）
   - 非执行终态（\`not-applicable\` / \`disabled\`）的 \`command\` / \`exitCode\` / \`scope\` 记 \`-\`，\`errorCount\` / \`fixedCount\` 记 \`0\`，\`reason\` 分别写「未探测到可编译产物」/「项目级显式禁用」；MUST NOT 留空，MUST NOT 用 \`N/A\` 等自由文本变体
   - 向 handoff 包 \`## 阶段结论\` 追加一行 \`| compile | <编译四值> | <证据路径> | <nextAllowed> | — |\`（包缺失时先按六节协议产出一次）；该行 status 使用编译四值（\`pass\` / \`fail\` / \`not-applicable\` / \`disabled\`），MUST NOT 写成回执状态

   **8.9 终态判定（硬门，无会话级跳过出口）**
   - \`pass\` → 进入 Step 9
   - \`not-applicable\` / \`disabled\` → 记 WARN，摘要写「未执行编译检查（无可编译产物 / 项目级显式禁用）」，MUST NOT 表述为「通过」；随后进入 Step 9
   - \`fail\`（含重试耗尽、\`autoFix=false\`）→ **暂停并报告剩余错误（含 \`file:line\`）**：MUST NOT 进入 Step 9、MUST NOT 把任务勾为完成、MUST NOT 给出归档建议；用户要求「跳过检查继续」时保持 \`fail\`，MUST NOT 伪造 \`disabled\` / \`not-applicable\`

   **8.10 辅助检查（保留，仅 WARN）**
   - lint（TypeScript \`eslint\` / Java \`mvn checkstyle:check\`）与前端校验（JSP 标签闭合与 EL 表达式、Vue/React 组件引用）在项目适用时照常执行
   - 结果只记 WARN 与摘要，SHALL NOT 参与四值终态、SHALL NOT 计入证据 \`errorCount\`（避免「编译通过但有告警」被误判为 fail）

9. **测试执行门** ⚠️ 强制（仅限变更范围内）
   - 在编译检查（§8）之后运行。编译失败是硬错误；测试失败属于另一类问题（存量红灯测试、断言不匹配、环境问题）—— 这正是两道门分开、MUST NOT 合并为一道的原因。§8 MUST 保持其 \`-DskipTests\`/\`compile\` 语义；测试执行由本门负责。

   **9.1 探测测试命令** —— 基于 §8.4 命中的构建描述符（同一项目生态）：
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
   - 自动修复并重跑，最多 3 次（与 §8.7 相同的重试预算）。区分：测试代码有误 → 修测试；生产代码有缺陷 → 修实现（按 \`.iagent/rules/coding-rules.md\`）
   - 3 次后仍有失败：暂停并向用户报告。MUST NOT 把对应任务标为 \`[x]\`，MUST NOT 进入归档
   - 若必须收窄或简化测试的预期行为才能通过 → 适用范围蔓延护栏：标 **[待确认]**，说明差异并询问用户

   **9.6 测试门报告** —— 汇总：覆盖范围、范围内通过/失败数、范围外存量失败（WARN）、覆盖率工具运行时的覆盖率数据（见 \`iagent_test\` §5.1）

10. **统一临时工作区清理（保留编译证据与 handoff 包）** ⚠️ 强制
   - 编译检查（§8）与测试执行门（§9）都结束后执行**一次**清理；清理对象**只限临时脚本与草稿**（编译校验脚本、临时配置、草稿输出等）
   - **MUST 保留** \`.openspec-tmp/pipeline-<change-name>/compile-report.md\` 与 \`handoff-pack.md\` 至**父流程归档收尾** —— 它们是父流程就绪检查的唯一判据，MUST NOT 在此删除；**迁移期同时识别旧前缀 \`apply-<change-name>/\`**
   - **独立调用（无父流程）**：保留证据并在完成摘要中报告证据文件路径，清理责任移交用户
   - **父流程调用**：由 \`spec-archive\` / \`spec-bulk-archive\` 在归档成功后清理该工作区（apply 内不删除）
   - 清理失败（文件被占用、权限不足）：记录 WARN 并给出工作区路径，MUST NOT 阻断流程

10.5 **提案制品精确暂存（收尾提示，不提交）** ⚠️ 强制
   - 目标变更名：本次执行的 \`<change-name>\`（无父流程时取唯一活跃变更；多活跃变更时以本次 change-name 为准）
   - 固定清单（逐条精确暂存，逐条校验前缀 \`openspec/changes/<change-name>/\`）：\`proposal.md\` / \`design.md\` / \`tasks.md\` / \`exploration.md\` / \`.openspec.yaml\` / \`specs/**/*.md\`
   - **排除**：\`attachments/**\` 与 \`需求文档.md\`
   - 逐条执行 \`git add <精确路径>\`（不存在的条目跳过），并展示拟暂存清单；**MUST NOT 使用 \`git add -A\` / \`git add openspec\` / 目录级添加**
   - **MUST NOT 执行 \`git commit\`** —— 仅暂存并提示「提案制品已暂存」；建议的提交信息尾行为 \`提案: <change-name>\`，提交请走 \`/iagent:commit\`（人工闸）
   - 暂存失败（未纳管 / 权限不足 / 路径不存在）→ 只记 WARN 并提示手动处理，MUST NOT 阻断收尾

11. **最终状态与归档建议**

   展示：
   - 编译检查终态（\`pass\` / \`not-applicable\` / \`disabled\`）与证据文件路径 —— 后两者显式标注「未执行编译检查」
   - 测试执行门结果汇总
   - 全部任务完成状态
   - 仅在编译终态放行（\`pass\` / \`not-applicable\` / \`disabled\`）且测试门通过时，建议通过 iagent spec archive "<name>" --yes（或 iagent_spec_archive 技能）归档变更

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

**编译终态**: pass | 证据：.openspec-tmp/pipeline-<change-name>/compile-report.md
**命令**: <command>（scope: <range>）→ exitCode 0

| 检查项 | 状态 | 详情 |
|-------|------|------|
| Backend Compile | ✓ pass | <command>（exitCode 0） |
| Backend Lint | ⚠ WARN | eslint: 0 issues（辅助项，不计入编译终态） |
| Frontend | - 不适用 | 无前端文件（辅助项，不计入编译终态） |

**自动修复**: 2 issues fixed (type annotations, import order)

编译门通过。归档前父流程会读取上述证据文件判定就绪。
\`\`\`

**Output（编译门放行但未执行：not-applicable / disabled）**

\`\`\`
## Implementation Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 7/7 tasks complete ✓

## 编译检查报告

**编译终态**: not-applicable（未执行编译检查：无可编译产物）
              或 disabled（未执行编译检查：项目级显式禁用）
**证据**: .openspec-tmp/pipeline-<change-name>/compile-report.md（command / exitCode / scope 记 \`-\`，errorCount / fixedCount 记 \`0\`）

未执行编译检查 —— 这不等于通过。父流程会读取该证据并按对应终态记 WARN 后放行（不阻断归档）。
\`\`\`

**Output（编译检查失败时）**

\`\`\`
## Implementation Complete

**Change:** <change-name>
**Progress:** 7/7 tasks complete ✓

## 编译检查报告

**编译终态**: fail | 证据：.openspec-tmp/pipeline-<change-name>/compile-report.md

| 检查项 | 状态 | 详情 |
|-------|------|------|
| Backend Compile | ✗ fail | 3 errors |
| Backend Lint | ⚠ WARN | eslint: 0 issues（辅助项） |
| Frontend | - 不适用 | 无前端文件（辅助项） |

**自动修复**: Applied 2 fixes, 3 issues remain

### 需人工处理的问题
1. \`src/main.ts:45\` - Type mismatch: string vs number
2. \`src/utils.ts:12\` - Cannot find name 'config'
3. \`src/api.ts:78\` - Missing return type

**已暂停** —— 编译检查是硬门，没有「跳过检查」出口，也不会给出归档建议。
修复上述错误后重新执行 apply（测试执行门与归档均未进入）。
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
- ⚠️ **强制**：全部任务完成后执行 Step 8 编译检查（硬门：终态只有 \`pass\` / \`fail\` / \`not-applicable\` / \`disabled\` 四值，配置载体为 \`.iagent/config.yaml\` 的 \`compileCheck\`）
- ⚠️ **强制**：编译检查后执行 Step 9 测试执行门 —— 范围限定为本次变更（范围内失败阻塞；范围外存量失败仅 WARN 且 MUST NOT 阻塞）
- ⚠️ **强制**：\`[测试]\` 任务 MUST 经**前台 Agent 子代理**委派 \`iagent_test\`（传测试层级与优先级）生成测试代码，MUST NOT 在 apply 内另立一套测试规则；该技能不可用时记录 WARN 并按同一规则本地实现（MUST NOT 伪装为委派完成）；MUST NOT 走补充文档的 \`产出:\` → \`attachments/\` 规则（放在 attachments/ 下的测试代码无法运行）。子代理返回后 MUST 继续批次调度，MUST NOT 停在子技能回执

- ⚠️ **强制**：子代理派发指令 MUST 携带 EXIT GUARD（子代理退出守卫）—— 完成分配任务后立即停止并返回回执，MUST NOT 进入 plan 模式 / 设计模式，也不得提出后续步骤；编排器是唯一有权判停和推进阶段的角色
- ⚠️ **强制**：子代理 MUST 先读取 handoff 包（\`.openspec-tmp/pipeline-<change-name>/handoff-pack.md\`），再执行其它任何动作 —— 不得先做其他动作；MUST NOT 重读 proposal/specs/design，MUST NOT 重跑包已覆盖的 CodeGraph 查询；仅做增量查询
- ⚠️ **强制**：收尾按固定清单精确暂存提案制品（逐条 \`git add\`，MUST NOT 全量添加），**MUST NOT 自动 commit**；暂存失败只 WARN、不阻断收尾
- ⚠️ **强制**：编译检查为硬门 —— \`fail\` 时 MUST 暂停并报告剩余错误（含 \`file:line\`），MUST NOT 提供「跳过检查」选项、MUST NOT 进入测试执行门、MUST NOT 给出归档建议；用户要求跳过时保持 \`fail\`
- ⚠️ **强制**：MUST NOT 伪造 \`not-applicable\` / \`disabled\` —— \`disabled\` 仅来自 \`.iagent/config.yaml\` 的 \`compileCheck.enabled: false\`，\`not-applicable\` 仅当运行时未探测到任何可编译产物；\`autoFix=false\` 时首次失败即 \`fail\`
- ⚠️ **强制**：编译证据 \`compile-report.md\` 与 handoff 包 MUST 保留至归档收尾 —— Step 10 只清理临时脚本与草稿，MUST NOT 删除证据文件

**流畅工作流集成**

本技能支持"对变更的动作"模型：

- **可随时调用**：全部制品完成前（只要有任务存在）、部分实现后、与其他动作交错进行时均可调用
- **允许更新制品**：实现暴露设计问题时，建议更新制品 —— 不受阶段锁定，流畅推进`,
        license: 'MIT',
        compatibility: '依赖 iagent CLI（spec 命令组）。',
        metadata: { author: 'mi-agent-tools' },
        references: [
            { path: 'references/batch-scheduling.md', content: BATCH_SCHEDULING_FULL },
            { path: 'references/compile-check.md', content: COMPILE_CHECK_DETAIL },
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
