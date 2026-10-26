# Tasks: improve-tr-test-generate-case-rationalize

<!-- 任务类型标签：[代码] 实现代码 / [测试] 测试代码（子标注 [单元]/[功能] + [P0]/[P1]/[P2]）/ [DB脚本] 数据库脚本 / [使用说明] 补充文档（默认产出至 attachments/） -->

> 任务末尾的 `[Nx]` / `[Px]` / `[Ax]` / `[Wx]` / `[Dx]` / `[Ix]` 为 `exploration.md` 功能流程图的节点 id，详见该文件「关键操作节点清单」。

## 1. 测试能力真源：用例设计规则合理化

- [x] 1.1 [代码] 修正 BCDE 场景矩阵示例的标注矛盾——把"参数为 null → 抛异常"、"空集合入参"类示例从 `B` 改标为 `Boundary`，使示例与 BCDE 定义自洽；同时说明入参为 null/空集合/空字符串/零值/极值/临界值均归 `Boundary` [N4]
  - 文件：`src/core/templates/workflows/tr-test.ts`（`getTrTestGenerateSkillTemplate().instructions` 阶段二「场景矩阵模板」）
  - 验证：模板正文中不再存在标为 `B` 但描述为边界输入的场景行

- [x] 1.2 [代码] 废除「场景数量要求」的固定配额（原文"每个方法至少 1-2 正常 + 2-3 边界 + 1-2 业务规则 + 1-2 异常"），改为场景数量由被测方法复杂度与优先级分级共同决定 [N4]
  - 文件：`src/core/templates/workflows/tr-test.ts`（阶段二「场景数量要求」段）
  - 验证：模板正文不再含固定的场景数量区间要求

- [x] 1.3 [代码] 新增「该不该测」判定闸门与不测清单（纯数据类 DTO/VO/Entity 的 getter/setter、无分支的转发方法、私有方法、框架生命周期回调、自动生成的代码），并规定落入清单时 MUST 输出"已评估、判定不生成测试"的结论与依据（不得静默跳过） [N3]
  - 文件：`src/core/templates/workflows/tr-test.ts`（阶段二之前新增小节 + 「反模式清单与约束」区新增"不测清单"）
  - 验证：模板含不测清单条目与"判定结论必须留痕"要求；生成报告格式含"已生成"与"判定不生成"两类清单

- [x] 1.4 [代码] 新增用例优先级分级（P0 核心业务链路必生成 / P1 常规业务默认生成 / P2 边界补充需显式确认才生成），明确分级**影响生成决策**而非仅作标注 [N4]
  - 文件：`src/core/templates/workflows/tr-test.ts`（阶段二新增分级小节）
  - 验证：模板含三级定义与各自的生成决策规则；P2 明确要求确认

- [x] 1.5 [代码] 新增用例去重与合并规则——同一被测方法的同构输入 MUST 合并为参数化用例，跨方法重复断言 MUST 归并或提取为共享断言 [N5]
  - 文件：`src/core/templates/workflows/tr-test.ts`（阶段二新增去重小节）
  - 验证：模板含两条去重规则的明确表述

- [x] 1.6 [代码] 补回 FIRST 原则（Fast/Independent/Repeatable/Self-validating/Timely）——`openspec/specs/tr-test-generate/spec.md` 已声明该需求为 SHALL，但 v3.0 重构时实现丢失（`grep -c FIRST` 结果为 0），本次补回实现 [N4]
  - 文件：`src/core/templates/workflows/tr-test.ts`（「强制约束（语言无关）」区）
  - 验证：模板正文含 FIRST 五要素的明确定义

- [x] 1.7 [代码] 主 SKILL「分层测试策略」语言无关化——移除绑定单一语言的 Mock API 表述，改为「Mock API 按检测到的语言从对应 schema 取用」并给出 Java/Node 双示例对照；参数化测试的 API 同样按语言分流（Java: `@ParameterizedTest`；Node: `it.each`），确保语言专属 API MUST NOT 出现在语言无关的主 SKILL 中 [N4]
  - 文件：`src/core/templates/workflows/tr-test.ts`（阶段三「分层测试策略（通用）」区）
  - 验证：主 SKILL 正文中 `vi.mock()` 等单语言 API 不作为通用要求出现；对应关系在 spec 的「分层测试编写指南」MODIFIED 需求中已声明为验收口径

- [x] 1.8 [代码] `tr-test.ts` 的**配套指令正文（command 版）**手工同步第 1、2 组变更的语义——该文件双份正文均手工维护（`getTrTestGenerateCommandTemplate().content` 为手写压缩版，未纳入 `deriveCommandContent()` 派生机制），command 版 MUST 补入测试层级、该不该测闸门、优先级分级、用例去重与覆盖度度量的要点（压缩允许删减，MUST NOT 与 skill 版冲突）；同步更新 command 的 `description` 与 `tags` 以反映新增维度
  - 文件：`src/core/templates/workflows/tr-test.ts`（`getTrTestGenerateCommandTemplate()`，`:756` 起）
  - 验证：command 版正文含层级/闸门/分级/去重/覆盖度五项要点且与 skill 版语义一致；`description` 已反映新增维度

## 2. 测试能力真源：测试层级与覆盖度度量

- [x] 2.1 [代码] 主 SKILL 阶段一新增「1.3 测试层级路由」——在语言/框架 schema 路由之外新增测试层级维度（单元测试 / 功能级测试），明确层级与语言**正交**，并给出层级判定依据（被测对象粒度 + 变更性质）与"项目缺功能级工具链时降级为单元测试"的规则 [N2]
  - 文件：`src/core/templates/workflows/tr-test.ts`（阶段一新增 1.3 小节；阶段三「分层测试策略」补充层级与代码层次的关系说明）
  - 验证：模板含层级定义、判定依据与降级规则

- [x] 2.2 [代码] `SCHEMA_JAVA` 新增功能级测试小节——`@SpringBootTest` / `@WebMvcTest` + MockMvc 的功能级测试写法、适用场景与工具链检测（`spring-boot-starter-test` 缺失时降级） [N2]
  - 文件：`src/core/templates/workflows/tr-test.ts`（`SCHEMA_JAVA` 常量，J6 模板区扩展或新增 J6.5 小节）
  - 验证：Java schema 含功能级测试小节与工具链缺失的降级规则

- [x] 2.3 [代码] `SCHEMA_NODE` 新增功能级测试小节——supertest 的功能级测试写法、适用场景与工具链检测（`supertest` 缺失时降级） [N2]
  - 文件：`src/core/templates/workflows/tr-test.ts`（`SCHEMA_NODE` 常量，N2 分层示例区扩展）
  - 验证：Node schema 含功能级测试小节与工具链缺失的降级规则

- [x] 2.4 [代码] 阶段五新增覆盖度度量——优先实测（Java: JaCoCo；Node: c8/coverage），无工具链时降级为「specs Scenario → 用例」映射矩阵，降级结果 MUST 标注"未实测覆盖度"，报告 MUST 含未覆盖清单 [N8]
  - 文件：`src/core/templates/workflows/tr-test.ts`（阶段五「运行与验证」扩展）；`SCHEMA_JAVA` 与 `SCHEMA_NODE` 各补实测命令
  - 验证：模板含实测/降级两条路径与"未实测"标注要求；报告格式含未覆盖清单

## 3. `[测试]` 任务标签统一（CLI 模板与生成指令）

- [x] 3.1 [代码] `TASKS_TEMPLATE` 的类型标签注释扩为并列四类（`[代码]`/`[测试]`/`[DB脚本]`/`[使用说明]`），并新增 `[测试]` 的层级与优先级子标注说明与示例 [P3]
  - 文件：`src/core/spec/templates/index.ts`
  - 验证：模板注释含四类标签与 `[测试][单元][P0]` 形示例

- [x] 3.2 [代码] tasks artifact 的生成指令（`SPEC_DRIVEN_SCHEMA` 中 tasks 的 `instruction`）同步标签集，不得遗漏 `[测试]` [P3]
  - 文件：`src/core/spec/schema.ts:77`
  - 验证：instruction 文本列出含 `[测试]` 的标签集

- [x] 3.3 [测试][单元][P0] 新增单测断言 `venus spec instructions tasks` 返回的 `template` 含 `[测试]` 标签与子标注说明，且 `instruction` 与 `template` 的标签集一致 [P3]
  - 文件：`test/spec-instructions-apply.test.ts` 或新建 `test/task-label.test.ts`
  - 验证：`pnpm test` 该用例通过；人为移除 `[测试]` 标签时用例失败（验证测试有效性）

- [x] 3.4 [代码] 归档摘要的补充标注改为**标签白名单识别**——`spec-archive.ts` 与 `spec-bulk-archive.ts` 当前的逻辑是"扫描任务类型标签，收集**所有非 `[代码]`** 的类型"，会把 `[测试][单元][P0]` 中的 `单元`、`P0` 误收为类型（产出 `[含测试/单元/P0]` 噪音与语义错误）。改为只识别已知白名单 `[代码]`/`[测试]`/`[DB脚本]`/`[使用说明]`，白名单外忽略并可 WARN [P3]
  - 文件：`src/core/templates/workflows/spec-archive.ts`（归档条目摘要提取段，`:245` 附近）、`src/core/templates/workflows/spec-bulk-archive.ts`（`:309` 附近）
  - 验证：含 `[测试][单元][P0]` 任务的变更归档后摘要为 `[含测试]`；仅 `[代码]` 任务时不追加标注；两处逻辑一致

## 4. propose 模式接入

- [x] 4.1 [代码] `spec-propose.ts` 新增测试规划判定与 `[测试]` 任务产出规则——逐个 specs Scenario 评估可测性，可测者产出带层级与优先级的 `[测试]` 任务；不可测者仍产出任务记录"已评估、判定无需测试"的依据（使"没写测试"与"没评估过"可区分）；任务格式硬约束补入 `[测试]` [P2][P3]
  - 文件：`src/core/templates/workflows/spec-propose.ts`（tasks 生成规则区，`:235-236` 附近）
  - 验证：propose 生成的 tasks.md 含 `[测试]` 任务（可测 Scenario）与判定留痕任务（不可测 Scenario）

## 5. apply 模式接入

- [x] 5.1 [代码] `spec-apply.ts` 把任务输出类型从**两类扩为三类**——代码实现（`[代码]` 或未标注）/ **测试代码（`[测试]`）** / 补充文档（`[DB脚本]`/`[使用说明]`/`[API文档]`/`[配置示例]`/`[部署说明]`/`[测试数据]`）。

  **`[测试]` MUST NOT 并入补充文档列表**：补充文档按 `产出:` 默认路由到 `<changeRoot>/attachments/`，而测试代码必须写入项目源码测试目录（如 `src/test/java/...`、`test/...`）；混入会使测试文件被错误落盘到 `attachments/` 而无法执行。

  `[测试]` 任务执行规则：委派 `venus_tr_test_generate` 生成（MUST NOT 在 apply 内另立测试规则），落盘位置由测试生成技能按项目结构决定（不经 attachments 路由）；测试任务与实现任务存在依赖时 MUST 串行 [A2]
  - 文件：`src/core/templates/workflows/spec-apply.ts`（`:186-200` Supplement Document Handling Rules 区，`Code Implementation` 段之后新增 `Test Code` 段）
  - 验证：apply 正文含三类输出类型的完整分类；`[测试]` 不与补充文档同列表；含测试任务的批次串行约束；未标注任务仍按代码实现处理（向后兼容）

- [x] 5.2 [代码] `spec-apply.ts` 在 Step 8 编译检查之后新增「测试执行关卡」与失败处置分支——仅运行变更范围测试（`[测试]` 任务产出 + 变更文件的既有测试）；存量范围外失败仅 WARN 不阻塞；变更范围失败进入自动修复重试（上限 3 次），仍失败则暂停不进入归档；项目无测试框架时降级 WARN 跳过。**Step 8 的 `-DskipTests` 保持不动** [A4][A5]
  - 文件：`src/core/templates/workflows/spec-apply.ts`（Step 8 之后新增 Step 9，原 Step 9 收尾顺延为 Step 10）
  - 验证：apply 正文含测试关卡步骤、范围限定、存量红不阻塞与降级规则；`-DskipTests` 未被移除

## 6. auto-workflow 模式接入

- [x] 6.1 [代码] `tr-impl-auto-workflow.ts` **skill 版**：Phase 2 任务标签描述补入 `[测试]`；Phase 4 接入测试执行关卡并**自动通关**（失败自动修复 3 次后暂停，MUST NOT 静默通过、MUST NOT 进入归档）；Guardrails 段补对应条目 [W2]
  - 文件：`src/core/templates/workflows/tr-impl-auto-workflow.ts`（skill 版，`:482-483` 标签规则 + Phase 4 段 + Guardrails 段）
  - 验证：模板 Phase 4 含测试关卡引用与自动通关/暂停规则；Guardrails 含"测试失败 3 次后暂停"条目

- [x] 6.2 [代码] `tr-impl-auto-workflow.ts` **command 版**正文手工同步 6.1 的语义——该文件双份正文均手工维护（未纳入 `deriveCommandContent()` 派生机制），command 版 MUST 同步 `[测试]` 标签与 Phase 4 测试关卡自动通关/失败暂停语义，MUST NOT 只改 skill 版导致两版行为不一致 [W2]
  - 文件：`src/core/templates/workflows/tr-impl-auto-workflow.ts`（`getTrImplAutoWorkflowCommandTemplate().content`，`:615` 起）
  - 验证：command 版正文含 `[测试]` 标签与测试关卡自动通关/暂停语义，与 skill 版不冲突

## 7. debug 模式接入

- [x] 7.1 [代码] `tr-impl-debug.ts` 4.2 回归测试的**编写动作改为委派** `venus_tr_test_generate`（传测试层级与优先级 + 缺陷链路图作为覆盖口径），委派不可用时降级自研并 WARN；**保留**「覆盖异常节点 + 根因节点」与「修复前 FAIL、修复后 PASS」两条硬要求 [D2]
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`（4.2 段 `:305-312` + Guardrails 段 `:587-593`）
  - 验证：4.2 含委派规则与降级分支；两条硬要求原文保留；Guardrails 同步

- [x] 7.2 [代码] `tr-impl-debug.ts` 的配套指令正文（command 版）手工同步 4.2 委派语义——该技能 command 版为手写压缩版，MUST NOT 假设经 `deriveCommandContent()` 派生 [D2]
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`（`getTrImplDebugCommandTemplate().content`）
  - 验证：command 版正文含委派语义，与 skill 版语义一致不冲突

## 8. 交互式工作流接入

- [x] 8.1 [代码] `tr-impl-workflow.ts` **skill 版**正文的测试接入——内联提案的 tasks.md 沿用 `[测试]` 标签口径（四类标签 + 层级/优先级子标注 + 测试规划判定留痕）[I1]
  - 文件：`src/core/templates/workflows/tr-impl-workflow.ts`（skill 版正文标签规则段）
  - 验证：skill 版正文含 `[测试]` 标签与子标注说明、测试规划判定规则、`[测试]` 不按 `产出:` 路由的约束

  > **实现期偏差（已据实收窄）**：原任务描述含"实现阶段沿用测试执行关卡语义"，实现时核实 `venus_tr_impl_workflow` 为 explore → propose → verify 三阶段，**Phase 3 验证后即结束，不含代码实现阶段**（实现由用户另起 `venus_spec_apply`）。故本技能无实现阶段可挂测试关卡——已改为在正文中显式声明"测试执行关卡由 apply 承担，本技能只负责规划 `[测试]` 任务"。这不是价值削减：标签规划部分全部交付，测试关卡在 apply（任务 5.2）已交付。

- [x] 8.2 [代码] `tr-impl-workflow.ts` **command 版**正文同步 8.1 同一语义——该文件双份正文均手工维护（未纳入派生机制），两版 MUST NOT 冲突 [I1]
  - 文件：`src/core/templates/workflows/tr-impl-workflow.ts`（command 版正文标签规则段）
  - 验证：command 版正文与 skill 版对 `[测试]` 标签、测试规划判定、不按 `产出:` 路由的表述一致

## 9. 交付收尾

- [x] 9.1 [代码] 补录 `allowedTools`——测试关卡需要执行测试命令，核查结果（**已实测，非推测**）：
  - `tr-impl-auto-workflow.ts`（`:604`）缺 `Bash(mvn:*)`、`Bash(gradle:*)`、`Bash(ant:*)`、`Bash(go:*)`、`Bash(cargo:*)` → Java/Go/Rust 项目 Phase 4 自动测试关卡会被权限拦截，**本次补录**
  - `tr-impl-workflow.ts` **不需要改动**——实现期核实该技能无实现阶段、不执行测试关卡（见任务 8.1 的实现期偏差），原任务描述中的该条已作废
  - 已具备无需改动：`spec-apply.ts`（含 mvn/gradle/npm/pnpm/ant/go/cargo/tsc）、`tr-impl-debug.ts`（含 mvn/gradle/npm/pnpm/tsc）、`tr-test.ts`（含 pnpm/npm/node/mvn/gradle）
  - 补录后按 `test/allowed-tools.test.ts` 的告警提示复核
  - 文件：`src/core/templates/workflows/tr-impl-auto-workflow.ts`
  - 验证：该文件 `allowedTools` 含所需测试命令；`pnpm test` 中 allowed-tools 测试通过，无新增缺失告警

- [x] 9.2 [代码] 按 AGENTS.md 第 8 条更新版本号与变更日志——本次改动性质为"改技能模板行为"，递增位为 **minor**（`package.json` 的 `version`）；`CHANGELOG.md` 把 `[Unreleased]` 累积条目归档为新的 `## [<新版本>] - 2026-09-28` 小节（沿用 `### Added`/`### Changed` 子标题），保留空的 `[Unreleased]`，并同步文件底部链接引用定义；`README.md` 中 `venus --version` 输出示例同步
  - 文件：`package.json`、`CHANGELOG.md`、`README.md`
  - 验证：三处版本号一致；CHANGELOG 新小节含本次 Added/Changed 条目

- [x] 9.3 [代码] 重新生成 `skills/` 静态快照——改模板后必须执行，否则 `test/skills-parity.test.ts` 失败
  - 文件：`skills/**`（由脚本生成，禁止手编）
  - 验证：`pnpm build && pnpm generate:skills` 执行成功且快照与模板一致

- [x] 9.4 [测试][单元][P0] 全量回归验证——运行 `pnpm lint` 与 `pnpm test` 全绿，确认快照一致性测试、allowed-tools 测试、模板派生一致性测试（`test/template-derivation.test.ts`）均通过
  - 文件：`test/**`（只读验证，不新增文件，除非 3.3 新建的用例文件）
  - 验证：`pnpm lint` 无错误；`pnpm test` 全部通过；任一失败则修复后重跑
