# Changelog

本项目的全部显著变更记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

（暂无）

## [1.7.0] - 2026-09-28

### Added

- **工具调用白名单的调用类扩展**（变更 `improve-skills-tool-whitelist`）：技能与指令在
  Claude Code 中运行时，除对话级确认门之外的调用不再逐次弹权限窗 —— 补齐了三类此前完全
  缺失的放行条目，管线可连续自动执行。
- **CodeGraph MCP 条目双写**：使用 CodeGraph 的 10 个技能同时写入裸服务器形式
  `mcp__codegraph` 与 9 个具名工具条目。此前白名单只有 CLI 形态 `Bash(codegraph:*)`，
  而正文实际调用的是 MCP 工具 —— **两者是两套工具名，互不覆盖**。整服务器形式存在
  「不自动放行」的失效报告，双写使任一路径生效。
- **技能间委派条目**：7 个技能写入 `Skill(venus_xxx)` 精确条目（genfull 8 个、debug 4 个、
  auto-workflow / workflow 各 3 个、auto-migration 2 个、spec-propose / spec-apply 各 1 个）。
  **禁用 `Skill(*)` 通配**（不可靠且会一次性放行全部技能）。
- **子代理派发条目**：6 个确有派发动作的技能写入 `Agent, Task`（新旧工具名双写，兼容
  派发工具更名）。授权面向子代理传递，故**不整类放行** —— 仅错误处理段落提及「子代理失败」
  不构成派发。
- **会话级权限载体**（`src/core/permissions.ts`）：`venus init` / `venus update` 额外把本工具集
  条目**非破坏合并**进 `.claude/settings.json` 的 `permissions.allow`。存在的理由：frontmatter
  的授权**仅覆盖调用当轮**、用户下一条消息即释放，跨轮次长管线需要会话级放行。语义为
  「不删既有条目、不碰 `deny`、过滤 `Bash(*)` 一类全量放行条目、既有文件非法 JSON 时保留原文件
  仅告警、幂等」；写入失败不阻断安装。
- **白名单共享常量模块**（`src/core/templates/tool-whitelist.ts`）：`CODEGRAPH_MCP` /
  `SUBAGENT_DISPATCH` / `skillDelegation()`，供模板以拼接方式引用，避免 27 份手写漂移。

### Changed

- **指令白名单由硬编码改为派生自配对技能**（**核心修复**）：适配器此前对全部 27 个斜杠指令
  一律写死 `allowed-tools: Bash(venus:*)`，无视配对技能已有的完整白名单 —— 经 `/venus:*`
  执行时文件读取、检索、图谱查询、技能委派全部弹窗。现由 `getCommandTemplates()` 单点回填
  配对技能的白名单（`CommandTemplate.allowedTools` 为**可选**，因 27 个指令模板工厂彼此不知道
  配对技能、设必填会迫使白名单复制 27 份；`CommandContent.allowedTools` 为**必填**，作为
  「白名单必须存在」的强制点）。删除 `VENUS_CLI_ALLOWED_TOOLS` 常量。
- **存量漂移修复**：`venus_tr_impl_auto_workflow` 正文的 1.2.1.5 多项目扫描与 Phase 4 批调度
  均要求派发子代理，白名单却无对应条目（历史决策已与实际产物脱节）—— 随本版修复。
- **`venus_spec_bulk_archive`**：由仅 `Task` 改为 `Agent, Task` 双写。
- **术语修正**：`openspec/CONTEXT.md` 的 workflow 计数 23 → 27（实测值）；补入「工具调用白名单」
  与「会话级权限载体」两条术语，并与「归档标签白名单」明确区分。
- **文档同步**：`docs/skills-manual.md`（25 处白名单列举 + 新增白名单组合规则小节）、
  `docs/genfull-guide.md`、`docs/migration-suite-guide.md`、`AGENTS.md` 修改守则与仓库地图。

### 说明

- **非破坏性，无迁移动作**：frontmatter 字段名与语法格式完全沿用，仅值域扩大；下游消费方
  （`show` 详情展示、`validate` 字段校验）不受影响。存量项目执行一次 `venus update` 即可获得
  新白名单，**无需 `--force`**（手改保护由「文件内记录指纹 vs 文件内容指纹」判定，模板变更不触发误判）。
- **明确不做**：`src/commands/generate.ts` 骨架技能的裸 `Bash` 白名单（等价全量放行）维持现状，
  属存量行为，留作后续单独评估；本次**不扩大**任何技能的 `Write` / `Edit` / `Bash(...)` 授权面。

## [1.6.0] - 2026-09-28

### Changed

- **多子代理派发的共享资源协议**（变更 `improve-workflow-subagent-resource-sharing`）：
  派发多子代理时的 token 消耗从「随派发单元数成倍放大」改为「与单元数解耦」——
  协调者一次性产出共享制品，子代理只读共享制品而非各自重读全量变更制品。
- **共享上下文包**（`spec-apply.ts` Steps 6，单一源）：首次派发前**一次性**产出
  `context-pack.md` 于流程级临时工作区，含六节 —— `## 变更摘要` / `## 契约` /
  `## 规范要点` / `## 文件归属表` / `## Codebase 摘要` / `## 已产出（跨单元可见）`；
  此后每批**只追加**产出登记，不重产整包。包是子代理的**唯一必读制品**。
- **产出登记表**：每批完成后协调者把该批产出文件与公开签名追加进包，使后续批次子代理
  无需重扫代码库即可获知前序产出（消除跨波次重复探索）。
- **回执最小化**：子代理回执固定四列 `<任务 id> | <状态> | <产出文件> | <公开签名>`，
  **MUST NOT 粘贴代码正文**（失败任务仍须含失败原因摘要）；「公开签名」定义为该单元产出中
  可被其他单元引用的符号签名，无则记「无」（不留空、不编造）。
- **共享指令前缀**：调度指令固定为「共享前缀（包路径 / 规范要点引用 / 回执格式 / 禁止项）
  → 单元差异（本单元任务清单）」，同一流程内前缀**字节一致**。
- **调度指令瘦身**：`ai-coding.md` 规范摘要从指令内联**移出**（改引用包 `## 规范要点` 节）；
  任务细节**保持内联**（使子代理无需读 tasks.md）。分界为「跨单元不变量共享、单元变量内联」。
- **禁止项与包缺口回执**：子代理 MUST NOT 重读 proposal/specs/design、MUST NOT 重跑包已覆盖的
  CodeGraph 查询；MAY 对包未覆盖内容补查，但回执 MUST 附**包缺口回执**，协调者据此回填。
  包是制品的**蒸馏视图而非替代品** —— 缺项时须补查制品本身，MUST NOT 凭包猜测字段或契约。
- **派发协议规格化**（补齐既有规格缺口）：派发单元 / 并发上限（缺省 3、非法值回退）/ 滑动窗口
  派发 / 跨单元同文件拆出并发组 / 任务勾选与失败重试由协调者集中管理 / 无子代理能力时全串行降级 ——
  首次写入规格。
- **批次形态豁免与 auto-mode**：批次含 <2 派发单元时协调者直接实现且**不产出包**；
  `auto-mode=true` 只跳过设计确认门，共享资源协议**不豁免**。
- **fail-safe 降级**：工作区不可写 → 回退系统临时目录；包产出失败或项目无
  `openspec/rules/ai-coding.md` → **退化为既有内联注入 + WARN，绝不阻断实现**。
- **多项目扫描单代理化**：`venus_tr_impl_auto_workflow` 与 `venus_tr_impl_workflow` 的 1.2.1.5
  由「每项目一个子代理」改为「**单个子代理内串行扫描全部待查项目**」——原实现为顺序派发
  （无并行收益却有 N 次子代理冷启动），合并为 1 次为严格改进；降级仍保持**项目粒度**。
- **auto-workflow 显式继承声明**：Phase 4 明文声明继承 `venus_spec_apply` 的派发与共享资源
  协议四载体，MUST NOT 另立派发指令格式或重复协议文本。
- **debug 流程级探查摘要**（`venus_tr_impl_debug`）：新增
  `.openspec-tmp/debug-<keyword>/investigation-digest.md`（keyword 为调试主题的 kebab-case
  关键词，与探索文件同规则）；Phase 2 起始**先读复用**、仅做**增量查询**、逐步骤**增量写入**；
  新增**失效规则**（修复改动代码后受影响范围标记失效并重新查询）；调试循环回边同样先读；
  Phase 7 收尾**统一清理**（含非缺陷与中途退出路径）。摘要**仅为流程内缓存**，不替代诊断记录
  与 Phase 6 对 `exploration.md` 的持久化。
- **auto-migration 规范要点改写入包**（`venus_tr_impl_auto_migration`）：Phase 3 由「每个子代理
  指令内联注入目标项目规范要点」改为「**写入包的 `## 规范要点` 节**」（BINDING 约束地位不变）；
  包不可用时退化为内联注入 + WARN。
- **结构指标断言**：新增 `test/subagent-resource-sharing.test.ts`（18 用例）锁定 A1–A8 —— 包六节
  与路径、一次性产出与追加规则、规范摘要移出、禁止项与缺口回执、共享前缀字节一致、两技能
  四处单代理化、debug 七串两处、auto-migration 三串两处；并含反向断言（旧内联表述与
  「每项目一个子代理」残留不得回归）。

### 已知落差

- `venus_spec_propose`（按能力派发子代理生成 delta spec）与 `venus_spec_bulk_archive`
  （按变更派发子代理）存在同类冗余，但派发粒度不同，**本次未同步**，待后续单独变更处理。
- 真实 token 计量无法在自动化测试中复现，本次以**可断言的结构指标**替代，未追加实测比对。

## [1.5.0] - 2026-09-28

### Added

- **测试用例生成能力优化与四模式接入**（变更 `improve-tr-test-generate-case-rationalize`）：
  `venus_tr_test_generate` 从"独立可用"升级为"被编排链路消费"。
- **测试层级路由**（`tr-test.ts` 阶段一 1.3）：在语言/框架 schema 路由之外新增**测试层级**
  维度（单元测试 / 功能级测试），二者正交；按被测对象粒度与变更性质自动判定；项目缺功能级
  工具链时降级为单元测试并提示（MUST NOT 生成无法运行的测试代码）。`SCHEMA_JAVA` 新增
  J6.5 功能级小节（`@SpringBootTest` / `@WebMvcTest` + 模板 G），`SCHEMA_NODE` 新增 N2.5
  功能级小节（supertest）。
- **该不该测闸门与不测清单**（阶段二 2.1）：纯数据类的取值读写方法、无分支的转发方法、
  私有方法、框架生命周期回调、自动生成的代码不进入场景设计；落入清单必须输出"已评估、
  判定不生成"的结论与依据，**不得静默跳过**——使"没写测试"与"没评估过"可区分。
- **用例优先级分级**（阶段二 2.4）：P0 核心业务链路必生成 / P1 默认生成 / P2 边界补充
  需显式确认才生成；分级**影响生成决策**，而非仅作标注。
- **用例去重与合并规则**（阶段二 2.5）：同构输入强制合并为参数化用例，跨方法重复断言
  提取为共享断言。
- **FIRST 原则补回**（「强制约束」区）：Fast / Independent / Repeatable / Self-validating /
  Timely 五要素及违例特征。该约束在能力 spec 中已声明为 SHALL，但 v3.0 重构时实现丢失
  （`grep -c FIRST` 结果为 0），本次补回实现。
- **覆盖度度量**（阶段五 5.1）：优先实测（Java JaCoCo / Node c8 或 `--coverage`），
  无工具链时降级为「规格场景 → 用例」静态映射矩阵并**强制标注"未实测覆盖度"**；
  两种方式都必须列出未覆盖清单，不得仅给百分比。
- **`[测试]` 任务类型标签**（并列第五类）：`TASKS_TEMPLATE` 与 tasks artifact 生成指令
  扩为并列四类（`[代码]` / `[测试]` / `[DB脚本]` / `[使用说明]`），`[测试]` 带层级
  （`[单元]`/`[功能]`）与优先级（`[P0]`/`[P1]`/`[P2]`）子标注。`tr-commit-push` 早已按
  该标签工作，但此前没有任何模板会产出它——三处口径不齐本次拉通。
- **apply 测试执行关卡**（`spec-apply.ts` 新增 Step 9）：编译检查之后独立运行，**仅限
  变更范围**（`[测试]` 任务产出 + 变更文件的既有测试）；范围内失败自动修复重试上限 3 次后
  暂停且不进入归档；**范围外存量失败仅 WARN 不阻塞**（存量测试已红的项目很常见，全量判定
  会让关卡不可用而促使用户绕过）；项目无测试框架时降级 WARN 跳过。
- **任务输出类型扩为三类**（apply）：代码实现 / **测试代码** / 补充文档。`[测试]` 任务
  委派 `venus_tr_test_generate`，且 **MUST NOT 走补充文档的 `产出:` → `attachments/`
  路由**（测试代码落在 attachments/ 下无法执行）。
- **propose 测试规划判定**：逐个 specs Scenario 评估可测性——可测者产出带层级与优先级的
  `[测试]` 任务；不可测者仍产出 `[测试]` 任务记录"已评估、判定无需测试"的依据。
- **auto-workflow 自动通关测试关卡**（Phase 4.3）：继承 apply 的 §9 并 auto-pass；
  3 次修复后仍失败则暂停报告，**不得静默通过、不得进入归档**。
- **debug 回归测试委派**（4.2）：编写动作改为委派 `venus_tr_test_generate`（复用框架检测与
  既有风格对齐），同时**保留** debug 的两条硬要求——回归测试 MUST 覆盖缺陷链路的
  「异常节点 + 根因节点」，且 MUST 修复前 FAIL、修复后 PASS；委派不可用时降级自研并 WARN。
- **能力规格漂移修订**（`specs/tr-test-generate/spec.md`）：分层测试编写指南原以
  Vitest `vi.mock()` / `test.each` 写死单一语言，与 v3.0 多 schema 定位冲突，改为语言无关表述。

### Changed

- **BCDE 场景矩阵标注自洽修正**（`tr-test.ts` 阶段二）：示例原把「参数为 null → 抛异常」、
  「空集合入参」标为 `B`（正常路径），但按 BCDE 自身定义（Boundary：Null、空值）应为
  `Boundary`。示例是 AI 生成用例时的模仿对象，错误标注会使覆盖度评估失真。同步新增
  **标注自洽硬约束**：null/空集合/空字符串/零值/极值/临界值 MUST 标 `Boundary`。
- **废除固定场景数量配额**（阶段二 2.3）：原「每个方法至少 1-2 正常 + 2-3 边界 + 1-2 业务
  规则 + 1-2 异常」对每个方法一律适用，**无"该方法是否值得测"的前置判定**，直接驱动为凑配额
  生成低价值用例。改为场景数量由**分支复杂度**与**用例优先级分级**共同决定，并明确禁止凑数。
- **分层测试策略语言无关化**（阶段三）：移除绑定单一语言的表述，Mock 与参数化 API 一律按
  检测到的语言从 `schema-*.md` 取用；补充代码层次与测试层级的关系说明。
- **归档摘要补充标注改为标签白名单识别**（`spec-archive.ts` / `spec-bulk-archive.ts`）：
  原逻辑为"收集**所有非 `[代码]`** 的类型"，会把 `[测试][单元][P0]` 中的 `单元`、`P0`
  误收为任务类型（产出 `[含测试/单元/P0]`）。改为只识别白名单 `[测试]`/`[DB脚本]`/
  `[使用说明]`，白名单外忽略并可 WARN。
- **`tr-impl-workflow` 职责边界显式化**：实现期核实该技能为 explore → propose → verify
  三阶段、**不含代码实现**，故测试执行关卡不由其承担。正文新增声明"测试关卡由 apply 承担，
  本技能只规划 `[测试]` 任务"，避免误读。skill 版与 command 版双份正文同步。
- `tr-impl-auto-workflow` 的 `allowedTools` 补录 `mvn` / `gradle` / `ant` / `go` / `cargo`
  ——该技能继承测试关卡后会在 Java/Go/Rust 项目执行测试命令，原白名单只有 `npm`/`pnpm`/
  `node`，会被权限拦截。
- 版本号 1.3.1 → 1.5.0

## [1.3.1] - 2026-09-28

### Changed

- **本机产物统一改为不入库**：`.gitignore` 的 `.venus/` 条目扩展为覆盖 `.claude/`
  （dogfood 产物）—— 原规则只忽略 `.claude/` 下 openspec 相关部分，venus 产物入库
  65 个文件，与 `AGENTS.md` 项目约定「`.venus/` 与 `.claude/` 都提交到 git」一致，
  但该约定与 `.gitignore` 实际行为**互相矛盾**（`.venus/` 被忽略且历史上从未纳管）
- 本次按「本机状态不入库」统一：`.venus/`（本项目配置）、`.claude/`（dogfood 产物）、
  `openspec/`（本地产物）、`.codegraph/`（索引）全部由 `.gitignore` 排除；
  **可提交的模板真源是 `skills/` 静态快照**（CI 的 `skills-parity` 漂移检查只针对它，
  实测不依赖 `.claude/`；`test/` 亦只用临时目录中的 `.claude/`）
- `git rm -r --cached .claude` 移除已跟踪的 65 个文件（工作区文件保留不动）
- `.gitignore` 随之清理三个被 `.claude/` 整目录条目涵盖的冗余条目：
  `.claude/skills/openspec-*/`、`.claude/commands/opsx/`、`.claude/settings.local.json`
- 影响面：本仓库不再有「模板 → 快照 → dogfood」三层一致性中的 dogfood 入库层。
  `AGENTS.md` 守则 8 与项目约定、`README.md` 工程保障段同步改写（明确"不入库"与
  可提交真源）。本机刷新约定不变：`pnpm generate:skills` 刷快照、`venus update` 刷 dogfood
- 版本号 1.3.0 → 1.3.1

## [1.3.0] - 2026-09-28

### Changed

- **`venus update` 手改保护判定改用内容指纹**：原实现只用 frontmatter `generatedBy`
  版本号一个信号推断产物是否被手改，存在两个方向的错误 ——
  (1) **模板正文变更而版本号未递增时**，产物被误判为"用户手改"而无法升级，只能加
  `--force`，而 `--force` 会连带覆盖**真正手改过**的产物、失去保护（该顺序依赖曾于
  1.2.0 作为操作约束写入 `AGENTS.md` 守则 8）；
  (2) **包版本号一旦递增**，被手改的旧版本产物反被判为"可升级"而**静默覆盖**
  （`isFromEarlierVersion` 实现为 `!==` 而非"早于"，名实不符），`skippedModified`
  完全不触发。
  根因是判定信号不足：版本号未递增时，"未改动的旧产物"与"被手改的产物"在信息上
  不可区分。修复为在产物 frontmatter 记录 `metadata.generatedFingerprint`
  （新增模块 `src/core/command-generation/fingerprint.ts`）：指纹由产物内容派生
  （先置空指纹行打断自引用、归一化行尾为 LF 后取 sha256），生成时两趟拼装回填。
  判定改为「指纹自洽 ⇒ 自上次由 venus 写入后未被改动 ⇒ 安全升级」，**独立于版本号**
- 判定分支与归入：未安装 → 安装；内容与内置一致 → 幂等跳过（不重写）；
  **指纹自洽 → 升级**（核心修复）；**无指纹字段的存量产物 → 回退原版本号判定**
  （行为与旧版完全一致，零回归；一经升级即带上指纹，保护转为精确）；`--force` → 覆盖；
  其余（指纹失配 ⇒ 被改动）→ 跳过并列出。`isFromEarlierVersion` 更名为
  `isLegacyVersionMismatched` 并订正注释，明示"版本号不一致"而非"早于"，且仅供存量回退
- `generatedBy`（版本号）**不再参与**手改保护判定，仅保留供 `venus show` 展示；
  `AGENTS.md` 守则 8 的"先递增版本号再 update"约束随之**整条删除**
- 连带修复：CRLF 行尾污染不再被误判为手改（指纹计算归一化行尾，`show` / `update`
  的 frontmatter 解析容忍 `\r`）；`update` 与 `show` 各自复制的 `generatedBy` 正则
  收敛到指纹模块的 `readGeneratedBy`，消除格式漂移导致两处行为静默分叉的隐患
- 版本号 1.2.0 → 1.3.0；全部生成产物随指纹字段重生成（`skills/` 快照与 `.claude/`
  dogfood 产物）

### Added

- `test/validate-update.test.ts` 新增 6 条用例，覆盖此前**零覆盖**的"旧版本自动升级"
  分支：指纹确定性、模板变更而版本号未递增仍能升级（本题核心）、被手改的旧版本产物
  不再被静默覆盖（反向缺陷）、存量产物回退（无指纹 × 版本不一致 / 版本一致）、
  CRLF 行尾污染不误判 —— 其中 5 条已在旧实现上验证为失败（真回归测试）

## [1.2.0] - 2026-09-28

### Changed

- **调试技能排查深度分级**（`venus_tr_impl_debug`）：排查阶段新增**事前分级**步骤
  （编号 `2.2.3.5`，十进制插入以**不重排既有编号**）—— 位于常规查询（文件结构 →
  符号定位 → 调用链与爆炸半径）之后、深度探索之前，按三条客观信号选定排查路径：
  (a) 爆炸半径（`codegraph_impact` depth ≤ 2 受影响符号数 ≥ 5 或受影响文件数 ≥ 3）；
  (b) 跨 ≥ 2 个模块 / 目录；(c) 未能一步定位单一高置信根因。任一命中即**深度路径**，
  否则走**轻量路径**（止步于常规查询，不执行 6 维根因深度分析）。信号取值 MUST
  可追溯至实测查询结果（MUST NOT 编造「半径小」以走轻量路径）；信号缺失或落在
  阈值边界时取深度路径（宁可多查不漏）
- 深度探索（原 2.2.4）的**内容与编号保持不变**，仅**触发条件扩展**为「分级为深度路径
  **或** 轻量路径未定位单一高置信根因」—— 原事后触发保留为**升级兜底**。兜底是
  **触发条件**而非独立步骤（MUST NOT 新建独立章节或编号），由此大范围缺陷即便已
  一步定位根因仍执行 6 维分析，同时轻量路径不会因分级判错而卡死
- 分级与缺陷链路图**解耦**：分级只决定深度探索是否执行；2.5 缺陷链路图与流程最终
  确认门对两条路径**均强制**产出（轻量 ≠ 不验证），不使既有流程图规格失效
- **信号降级**：CodeGraph 不可用时分级**仍生效** —— 信号 (a) 降级为 Grep 文件数
  代理指标，(b)(c) 照常判定，诊断记录标注「信号降级」；与既有 `2.2.0` 降级路径
  语义连续（降级改取证工具，不改能力）
- 分级判定结果（三条信号取值 / 所选路径 / 是否降级）随根因分析一并持久化到变更
  `exploration.md`，使「为何走这条排查路径」可事后复盘
- **需求文档更新分支**（`venus_tr_impl_debug` Phase 7.3）：深度复查之后、生成之前新增
  **存在性判定**（范围仅 `openspec/changes/<change-name>/需求文档.md`）——**不存在**时
  调 `venus_tr_docs_requirement_doc` 非交互生成（既有行为不变）；**已存在**时改为
  **就地增量对齐更新**：`## 基本信息`（需求编号 / 需求名称 / 交付时间，含占位符状态）
  与 `## 八、评审记录` 为**人工域 MUST NOT 覆盖**，`一~七` 章节按同步后的制品重新派生；
  MUST NOT 调用该 skill（其「目标已存在则静默覆盖」规则会抹掉人工内容）；MUST NOT
  删除章节，格式破损时补建缺失章节并记录 WARN，目录不可读时记 WARN 按不存在处理
- 技能正文与其**手写压缩指令正文**双处同步（该技能指令正文为手写压缩版，非经
  `deriveCommandContent` 派生）；`openspec/CONTEXT.md` 新增 6 条术语（排查深度分级 /
  轻量路径 / 深度路径 / 升级兜底 / 人工域 / 就地增量对齐）
- `AGENTS.md` 守则 8 补充**执行顺序**约束：需刷新 `.claude/` dogfood 时
  **先递增版本号、再执行 `venus update`** —— `update` 的升级判定是「已装 `generatedBy`
  版本**早于**当前包版本」，版本号未变时该判定为否、产物被当作"用户手改"跳过，
  此时只能加 `--force` 覆盖，而 `--force` 会连带覆盖**真正手改过**的产物、失去手改保护
  （该顺序在本次交付中由遗漏发现并验证）
  —— **本条已于 1.3.0 消除**：手改保护改用内容指纹，不再依赖版本号与操作顺序

### 已知落差

- 另三处同构的「验证通过后生成需求文档」逻辑（`tr-impl-workflow` /
  `tr-impl-auto-workflow` / `tr-impl-genfull`）**本次未同步**，仍会在需求文档已存在时
  覆盖人工填写内容 —— 建议后续单独变更处理

## [1.1.1] - 2026-09-24

### Added

- 新增 `.gitattributes`：`* text=auto eol=lf` 统一仓库行尾为 LF。修复的环境问题：
  `core.autocrlf=true` 且无 `.gitattributes` 时，checkout/merge 会把工作区中内容有变化的
  文件转为 CRLF，而 `skills/**` 静态快照与模板生成结果恒为 LF（vite 转换 TS 时归一行尾），
  `skills-parity` 的字节级比较随即误报漂移（实测 13 个快照失配）。显式声明后任何 clone /
  checkout 都产出 LF，该测试与环境配置解耦
- `.gitignore` 补充预防性条目：`coverage/`、`*.tsbuildinfo`、`.eslintcache`、
  `.claude/settings.local.json`（当前仓库中均不存在）

### Changed

- `vitest.config.ts` 配置 `testTimeout: 20000`：默认 5s 对 shell 调用外部 CLI 的用例
  （`spec-commands` 的 venus↔openspec 互认校验，单跑约 3.9s）余量不足，全量并发下会间歇性
  超时失败（先例 commit `5ed5f20` 亦记录过同一现象）

### 核验澄清

- 本次**未改动任何已提交内容**：经 `git cat-file -p` 逐字节核实，仓库全部 blob 本就以 LF
  存储（`vendor/auto-package-svn/*` 与 `skills/venus_release_package/scripts/*.sh` 的 CR 字节
  数为 0），`git add --renormalize .` 亦无内容变更。此前观察到的 CRLF 仅存在于**工作区副本**
  （checkout 经 `core.autocrlf=true` 转换所致）—— 故本次新增 `.gitattributes` 属**行为性声明**
  （此后 checkout 产出 LF），非内容规范化。注意 `git show <rev>:<path>` 会应用行尾转换，
  测量 blob 行尾须用 `git cat-file -p`

## [1.1.0] - 2026-09-24

### Added

- **功能流程图制品与提案交叉验证**：5 个工作流技能（explore / workflow /
  auto-workflow / debug / genfull）在探索阶段产出结构化流程制品
  （Mermaid 流程图 + 关键操作节点清单），经**流程最终确认门**确认后成为
  propose / verify 的**流程基准** —— 独立于提案自身的交叉验证锚点
- 新增模板层唯一源模块 `src/core/templates/flowchart-gate.ts`：承载制品文本与
  两套场景列集（需求版 / 缺陷链路版），以 `buildFlowchartBlock(columns)` 参数化
  渲染、`buildFlowchartCompact(columns)` 压缩渲染，构建期内联进各技能正文
  （不新增技能，技能总数保持 27）
- 产出强度分级：4 个流程类技能（workflow / auto-workflow / genfull / debug）
  **强制产出**；`venus_spec_explore` **条件触发**（无业务功能流程时记录
  「本次无功能流程」直通），不改变其「无固定步骤、无强制产出」定位
- 节点准入规则：节点粒度 = 可独立验证的业务操作单元；每节点 MUST 可追溯代码
  证据（`文件:行`），**新建功能**节点标 `[新建]` + 预期产物（不要求预测文件路径），
  无法追溯证据的节点 MUST NOT 进入清单（反幻觉）
- 调试技能缺陷链路变体：只覆盖缺陷相关节点（前置条件 → 触发 → 异常 → 根因），
  新增 `🔴异常` / `🟠根因` 标记；Phase 4 验证口径改为覆盖「异常节点 + 根因节点」
- 编排技能（genfull）Bridge 1 新增流程图**兜底补建 + 确认**步骤（探索阶段未产出时
  依探索产物强制补建，并入桥梁门决策），并具备幂等性
- 提案技能以流程基准为生成锚点：设计引用流程图与节点清单；任务逐个标注对应节点
  标识（`[N4]` 形）；流程图缺失或未获确认时降级为仅凭探索产物生成并标注降级
- 提案验证技能新增维度 **D10 流程图节点覆盖度**：`覆盖度 = 被覆盖节点数 ÷ 总节点数`，
  与既有维度同权重纳入 90% 统一阈值；优先按节点标识显式标注匹配、未标注时辅以
  语义等价判定；无 `## 功能流程图` 段时该维度 SKIP（不计入分母、不判 FAIL）；
  评分不足时逐条列出未覆盖节点标识与操作名
- 与既有 D9（Business Steps）职责分离互补：D9 检查提案自身是否拆解复杂操作
  （自证），D10 与外部流程基准比对（他证）；D9 保留不动
- `openspec/CONTEXT.md` 新增 6 条术语：功能流程图 / 关键操作节点 / 流程最终确认门 /
  节点覆盖度 / 流程基准 / 缺陷链路，并与既有「提示词基线」「业务流程图」「D9」显式划界

### Changed

- `venus_spec_verify_proposal` 维度数由 9 增至 10（描述、章节标题、总分公式的
  维度区间与触发维度表同步更新）

## [1.0.1] - 2026-09-24

### Added

- `AGENTS.md` 新增「修改守则」第 8 条：**版本号更新规则** —— 完成功能变更时按 SemVer
  三段（BREAKING → major / 功能新增或变更 → minor / 修复·文档·重构·测试·构建 → patch）
  递增 `package.json` 的 `version`，把 `[Unreleased]` 归档为对应版本小节并同步底部链接引用，
  二者**随本次功能提交一并提交**（不再单独提交 `chore: 版本号`）
- `README.md` 安装验证示例中的 `venus --version` 输出同步为当前版本号

## [1.0.0] - 2026-09-24

### BREAKING

- `venus init` 默认行为变化：从全量安装 14 个技能改为安装默认集 7 个
  （`tr-init-project` + spec 全 6：explore/propose/apply/archive/verify/verify-proposal）。
  已安装的产物不会被自动删除（reconcile 仅提示），需恢复全量可执行
  `venus config --set tr-init-project,tr-impl-feature,tr-test-generate,tr-commit-change,tr-review-code,tr-release-version,tr-tools-pwd,tr-tools-list,spec-explore,spec-propose,spec-apply,spec-archive,spec-verify,spec-verify-proposal`

### Added

- profile 配置机制：`.venus/config.yaml` 新增 `workflows` 字段声明本项目要安装的
  workflow，`venus init` / `venus update` 据此过滤生成；字段缺失时使用默认集（7 项）
- 依赖注入自动补全：选了 `spec-propose` 自动补 `spec-verify-proposal`
  （提案评分门），选了 `spec-archive` 自动补 `spec-verify`（归档前验证），
  补入项在输出中提示
- `venus config` 命令三模式：交互式勾选（@inquirer/prompts checkbox）/
  `--show` 打印生效集（含来源与注入标注）/ `--set <list>` 非交互设置（脚本/CI 用，
  非法 id 报错退出非零）
- reconcile 检测提示：init/update 扫描已安装但不在配置集内的 venus 产物，
  保留不删，输出清单提示手工处理（`venus uninstall` 或手动删除）
- onboarding 引导按生效 workflow 集动态过滤（默认集 7 项）
- 新增运行依赖 `@inquirer/prompts`（交互式 checkbox）
- 迁移技能套件三技能（源自 OpenSpec 项目 auto-migration/feature-doc/migration-check
  三功能，语言无关化适配）：
  - `venus_tr_docs_feature_doc`（指令 `tr-docs-feature-doc`，新增第 9 类 `tr_docs` 文档类）：
    扫描源项目功能模块生成功能需求实现文档（4 种输出模式 / 框架档案 / 4 类流程图 /
    反幻觉规则 / CodeGraph 优先自动降级）
  - `venus_tr_impl_migration_check`（指令 `tr-impl-migration-check`）：迁移后源/目标
    六层一致性检查（Controller/Service/DAO/前端/SQL/数据库）+ C1-C6 对抗检查 +
    P0/P1/P2 分级 + 写回验证
  - `venus_tr_impl_auto_migration`（指令 `tr-impl-auto-migration`）：一站式自动迁移编排
    （蒸馏确认门 → 规范加载与提案 → 实现确认门 → 评审子代理与修复循环）
  - 依赖注入：选 `tr-impl-auto-migration` 自动补 `tr-docs-feature-doc` 与
    `tr-impl-migration-check`（编排技能依赖两子技能）
  - 三技能均不入默认集（可选扩展件），经 `.venus/config.yaml` 的 `workflows` 勾选安装

- 工作流技能套件五技能（源自 OpenSpec 项目 workflow/auto-workflow/debug/
  create-requirement-doc 四功能 + 用户级 openspec-proposal-review 定制版，
  语言无关化适配）：
  - `venus_tr_impl_workflow`（指令 `tr-impl-workflow`）：一站式引导工作流
    （结构化探索 checkpoint 体系 + grill 追问 L1-L5 → 提案内联生成 + CLI 降级 →
    自动验证门 → 深度复查与需求文档联动）
  - `venus_tr_impl_auto_workflow`（指令 `tr-impl-auto-workflow`）：全自动管线
    （探索 → 提案 → 验证 → auto-apply（auto-mode=true）→ auto-archive 五阶段）
  - `venus_tr_impl_debug`（指令 `tr-impl-debug`）：一站式调试工作流
    （强制复现 → CodeGraph 分层排查 + 根因确认门 → 关联变更判定 →
    修复 + 强制回归测试调试循环 → 编译检查 → 同步提案 → 验证）
  - `venus_tr_docs_requirement_doc`（指令 `tr-docs-requirement-doc`）：变更提案转
    八章节评审需求文档（双执行模式 / 场景分组 / 伪代码注入规则 / 归档状态输出路由）
  - `venus_tr_impl_review_proposal`（指令 `tr-impl-review-proposal`）：提案完整性复查
    （深度代码库探索 + 8 维度完整性检查 + 合规性验证 + 量化评分；
    Java/Venus4A 专项检查按项目特征触发）
  - 依赖注入（不动点迭代，连带补全传递依赖）：选 `tr-impl-workflow` 自动补
    `tr-impl-review-proposal` 与 `tr-docs-requirement-doc`；选
    `tr-impl-auto-workflow` 自动补 `tr-impl-workflow` 与 `tr-docs-requirement-doc`
    （并连带其依赖）；选 `tr-impl-debug` 自动补 `tr-docs-requirement-doc` 与
    `spec-verify-proposal`
  - 五技能均不入默认集（可选扩展件），经 `.venus/config.yaml` 的 `workflows` 勾选安装

- 共享制品生成协议：新增 `openspec/rules/artifact-generation.md`
  （G1 创建变更 → G2 status/instructions 依赖序循环 → G3 终态确认），
  供 `venus_tr_impl_workflow` 与 `venus_spec_propose` 共同引用，
  同时修复 `venus_spec_propose` 正文对该路径的悬空引用

- 生态引用闭环：`tr-docs-feature-doc` 恢复 NOT-for 边界引用指向
  `tr-docs-requirement-doc`；`tr-impl-auto-migration` 补充
  `/venus:tr-impl-workflow` 完整工作流选项引用（上次迁移因无对应物删除）

- `venus init` 依赖自检与自动安装：检测 codegraph CLI / 用户级 MCP 注册、
  openspec CLI / 项目 `openspec/` 目录，缺失时自动执行
  （`npm install -g`、`claude mcp add codegraph -s user`、`openspec init --tools claude`），
  作为后续功能集成的基础；已存在的依赖只检测不升级，
  安装失败仅警告不阻断主流程，`--no-deps` 可跳过

- 新增技能 `venus_tr_commit_push`（指令 `tr-commit-push`，迁移自源 SKILL tr-commit-push 并新增
  提案分类提交）：SVN 交互式提交——四环节强制确认（提交范围 → 内容清单与功能描述 →
  知识库推送询问 → 最终确认，缺一不可）、提交范围排除（target/、*.class 等编译产物永不提交，
  优先级最高）、UTF-8 无 BOM 注释落盘 + `--encoding UTF-8 -F`、SVN 证书/凭据处理
  （E230001/E215004，密码仅内存与 stdin）、提交后双验证（svn status + svn log --xml）、
  知识库推送（llm-wiki MCP 逐项确认，单次最多 5 个文件分批）；核心增量提案分类提交——
  `/venus:tr-commit-push 提交 <提案名> 提案` 按提案将变更自动归类功能代码/测试代码/文档三类
  （src/test/**、test/**、*Test.java、*Tests.java、*.test.* 归测试；已纳管 docs/**、其余 *.md、
  已纳管 openspec/ 制品归文档；其余归功能代码），N 笔分类分批提交，每笔提交信息尾行标注
  `提案: <变更名>` 溯源，提案关联校验不阻断由用户裁决，任一笔失败即停不回滚已成功笔。
  现有 `venus_tr_commit_change`（Git 版）行为零变更，两技能按 VCS 划分职责（SVN 项目用
  tr-commit-push、Git 项目用 tr-commit-change）；不入默认集，经 `.venus/config.yaml` 的
  `workflows` 勾选 `tr-commit-push` 安装


## [0.1.0] - 2026-09-08

首个可用版本：按生命周期类型（`tr_*`）分类生成与管理 `venus_` 前缀的 Agent 技能。

### Added

**核心功能**
- 7 类生命周期分类体系：`tr_init`（初始化）/ `tr_impl`（实现）/ `tr_test`（测试）/
  `tr_commit`（提交）/ `tr_review`（审查）/ `tr_release`（版本）/ `tr_tools`（工具）
- 8 个内置中文技能（每类 1 个，`tr_tools` 含 `venus_tr_tools_pwd` 查看当前路径等 2 个）
- 同步生成 Claude Code 斜杠指令（`.claude/commands/venus/<type>-<name>.md`）
- `venus init`：生成全部技能与指令到目标项目，含首次 onboarding 引导
- `venus list`：按类型分组列出已安装技能（`--json` 结构化输出）
- `venus show <query>`：查看技能详情（frontmatter / 类型 / 工具白名单 / 正文预览），
  支持前缀与片段模糊匹配，多命中列出候选
- `venus generate --type <tr_*> --name <kebab>`：按类型生成新技能骨架并安装
- `venus validate`：校验技能规范符合性（`venus_` 前缀 / name=目录名 / 必填字段 /
  类型合法），CRITICAL 时退出码 1，可接入 CI
- `venus update`：升级已安装技能到内置模板最新版，手改保护
  （内容一致幂等跳过 / 旧版本自动升级 / 用户手改跳过并提示，`--force` 覆盖）
- `venus uninstall`：干净移除 venus 管理的技能与指令
  （非 venus 技能不碰；`.venus/` 配置默认保留，`--purge-config` 一并删除）
- `venus completion install|uninstall`：shell 补全（bash 的 compgen +
  PowerShell 的 Register-ArgumentCompleter），标记块管理 rc/profile

**项目配置**
- `.venus/config.yaml`：项目背景（context）+ 规则引用（rules 显式 include）
- `.venus/rules/<type>.md`：按类型的规则文件（每行一条，`#` 注释），
  config 引用顺序即注入顺序，删除引用即停用
- `venus generate` 自动将 context 与对应类型 rules 注入骨架正文

**工程保障**
- 三层架构（模板层 → 生成层 → 命令层），`ToolCommandAdapter` 预留多工具扩展
- 每技能按正文实际命令声明 `allowed-tools` 白名单（防止权限拦截）
- `skills/` 静态快照 + parity 防漂移测试（模板变更未重新生成即失败）
- GitHub Actions CI：Ubuntu + Windows 双平台，build → lint → test → 快照一致性
- eslint（typescript-eslint）
- MIT LICENSE、README（安装/使用/架构）、AGENTS.md、docs/getting-started.md

### Changed

- 项目配置从单文件 `venus.config.yaml` 重构为 `.venus/` 目录结构
  （`config.yaml` 显式引用 `rules/` 下规则文件），重复 init 保留用户全部修改

[Unreleased]: https://github.com/venus-agent-tools/compare/v1.7.0...HEAD
[1.7.0]: https://github.com/venus-agent-tools/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/venus-agent-tools/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/venus-agent-tools/compare/v1.3.1...v1.5.0
[1.3.1]: https://github.com/venus-agent-tools/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/venus-agent-tools/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/venus-agent-tools/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/venus-agent-tools/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/venus-agent-tools/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/venus-agent-tools/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/venus-agent-tools/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/venus-agent-tools/releases/tag/v0.1.0
